// app/(spnc)/spnc/app/api/service-providers/[id]/route.ts
//
//   GET     → one provider
//   PUT     → admin: updates the provider now. employee: saves the edit as a pending change for an admin.
//   DELETE  → admin only: archives the provider (sets archived_at)
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../lib/session";
import { can } from "../../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../../lib/audit";

// Fields an employee can propose changes to. PDF attachments are handled separately below.
const EDITABLE = [
  "name", "type", "agency", "department", "contact_person", "email", "phone",
  "address", "country", "service_modes", "status", "rating", "contract_ref", "notes",
] as const;

// True when two values are the same, treating null / undefined / "" as equal,
// comparing arrays by content and numbers by value (rating may be 4 or "4").
const same = (a: unknown, b: unknown) => {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return String(a ?? "").trim() === String(b ?? "").trim();
};

type Ctx = { params: Promise<{ id: string }> }; // Next 15+. On Next 14 use { params: { id: string } } and drop the awaits.

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("service_providers")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error("Fetch provider error:", error);
    return NextResponse.json({ message: "Couldn't load provider." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Provider not found." }, { status: 404 });
  return NextResponse.json({ provider: data });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role, full_name").eq("id", userId).maybeSingle();
  const isApprover = can(normalizeSessionRole(me?.role), "providers:approve");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const { data: current } = await supabase
    .from("service_providers")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (!current) return NextResponse.json({ message: "Provider not found." }, { status: 404 });

  /* ---------- EMPLOYEE: save as a pending change, don't touch the provider ---------- */
  if (!isApprover) {
    if (current.pending_changes) {
      return NextResponse.json(
        { message: "This provider already has an edit waiting for admin approval." },
        { status: 409 }
      );
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of EDITABLE) {
      if (body[f] === undefined) continue;
      const to = body[f] === "" ? null : body[f];
      if (!same(to, current[f])) changes[f] = { from: current[f] ?? null, to };
    }

    // PDF attachments: also go through approval. "from" keeps only the file names (for display),
    // "to" keeps the full files so an approval can apply them.
    if (Array.isArray(body.attachments)) {
      const toFiles = (body.attachments as { name?: unknown; dataUrl?: unknown }[])
        .filter((a) => a && typeof a.name === "string")
        .map((a) => ({ name: String(a.name), dataUrl: typeof a.dataUrl === "string" ? a.dataUrl : "" }));
      const currentFiles = (Array.isArray(current.attachments) ? current.attachments : []) as { name: string; dataUrl?: string }[];
      const fileKey = (list: { name: string; dataUrl?: string }[]) => JSON.stringify(list.map((a) => [a.name, a.dataUrl ?? ""]));

      if (fileKey(toFiles) !== fileKey(currentFiles)) {
        const totalBytes = toFiles.reduce((sum, a) => sum + a.dataUrl.length, 0);
        if (totalBytes > 12_000_000) {
          return NextResponse.json({ message: "The PDF files are too large to submit (about 9 MB in total at most)." }, { status: 413 });
        }
        changes.attachments = { from: currentFiles.map((a) => a.name), to: toFiles };
      }
    }

    if (Object.keys(changes).length === 0) {
      // Temporary: shows exactly what was sent vs what is saved. Remove once everything works.
      console.log(
        "[providers PUT] compare",
        EDITABLE.map((f) => ({
          field: f,
          sent: body[f] === undefined ? "(not sent)" : body[f],
          saved: current[f],
        }))
      );
      console.warn("[providers PUT] 400 no changes. role =", me?.role, "isApprover =", isApprover, "id =", id);
      return NextResponse.json(
        { message: "No changes to submit. Change at least one field first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("service_providers")
      .update({
        pending_changes: changes,
        pending_by: userId,
        pending_by_name: me?.full_name ?? null,
        pending_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Submit pending edit error:", error);
      return NextResponse.json({ message: "Couldn't submit your request." }, { status: 500 });
    }

    const actor = await getAuditActor(req);
    if (actor) {
      await logAuditEvent({
        ...actor,
        eventType: "user_activity",
        action: `${actor.actorName} requested changes to service provider "${current.name}" (waiting for admin approval)`,
        entityType: "service_provider",
        entityId: id,
        request: req,
      });
    }

    // 202 = accepted, but not applied yet. The page shows "sent to an admin for approval".
    return NextResponse.json({ pending: true, message: "Sent to an admin for approval." }, { status: 202 });
  }

  /* ---------- ADMIN: update right away ---------- */
  const update: Record<string, unknown> = {};
  for (const f of EDITABLE) {
    if (body[f] === undefined) continue;
    update[f] = body[f] === "" && f !== "name" && f !== "type" ? null : body[f];
  }
  if (Array.isArray(body.attachments)) update.attachments = body.attachments;

  if (("name" in update && !update.name) || ("type" in update && !update.type)) {
    console.warn("[providers PUT] 400 name/type missing. role =", me?.role, "isApprover =", isApprover, "id =", id);
    return NextResponse.json({ message: "Company name and type are required." }, { status: 400 });
  }

  // An admin edit replaces anything that was waiting for approval.
  update.pending_changes = null;
  update.pending_by = null;
  update.pending_by_name = null;
  update.pending_at = null;

  const { data, error } = await supabase.from("service_providers").update(update).eq("id", id).select().single();

  if (error) {
    console.error("Update provider error:", error);
    return NextResponse.json({ message: "Couldn't update provider." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated service provider "${data.name}"`,
      entityType: "service_provider",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ provider: data });
}

// Archive (soft delete). Admins only.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "providers:approve")) {
    return NextResponse.json({ message: "Only admins can archive providers." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("service_providers")
    .update({
      archived_at: new Date().toISOString(),
      pending_changes: null,
      pending_by: null,
      pending_by_name: null,
      pending_at: null,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("name")
    .maybeSingle();

  if (error) {
    console.error("Archive provider error:", error);
    return NextResponse.json({ message: "Couldn't archive provider." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Provider not found." }, { status: 404 });

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} archived service provider "${data.name}"`,
      entityType: "service_provider",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}