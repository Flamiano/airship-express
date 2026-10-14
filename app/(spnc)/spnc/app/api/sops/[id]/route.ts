// Save as: app/(spnc)/spnc/app/api/sops/[id]/route.ts
//
//   GET     → one SOP (not archived)
//   PUT     → admin: updates the SOP now. employee: saves the edit as a pending change for an admin.
//   DELETE  → admin only: archives the SOP (sets archived_at)
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../lib/session";
import { can } from "../../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

const FIELDS = [
  "title", "sop_code", "category", "scope", "department", "version",
  "effective_date", "review_date", "content", "owner", "status",
] as const;
type Field = (typeof FIELDS)[number];

const DATES: Field[] = ["effective_date", "review_date"];
const TEXT_NULLABLE: Field[] = ["scope", "department", "content", "owner"];

// Same cleaning for what is sent AND what is saved, so "no change" comparisons are reliable.
function normalize(field: Field, v: unknown): string | null {
  if (DATES.includes(field)) {
    const s = v === undefined || v === null ? "" : String(v).trim().slice(0, 10);
    return s === "" ? null : s;
  }
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (TEXT_NULLABLE.includes(field)) return s === "" ? null : s;
  if (field === "category") return s || "general";
  if (field === "version") return s || "1.0";
  if (field === "status") return s || "draft";
  return s; // title, sop_code
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { data, error } = await getSupabaseClient()
    .from("sops")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error("Fetch SOP error:", error);
    return NextResponse.json({ message: "Could not load SOP." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "SOP not found." }, { status: 404 });

  return NextResponse.json({ sop: data });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role, full_name").eq("id", userId).maybeSingle();
  const isApprover = can(normalizeSessionRole(me?.role), "sops:approve");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid request." }, { status: 400 });

  const { data: current } = await supabase.from("sops").select("*").eq("id", id).is("archived_at", null).maybeSingle();
  if (!current) return NextResponse.json({ message: "SOP not found." }, { status: 404 });

  // What the request wants each field to be (only fields that were sent)
  const next: Partial<Record<Field, string | null>> = {};
  for (const f of FIELDS) if (body[f] !== undefined) next[f] = normalize(f, body[f]);

  if (("title" in next && !next.title) || ("sop_code" in next && !next.sop_code)) {
    return NextResponse.json({ message: "Title and SOP code are required." }, { status: 400 });
  }

  // A different SOP code must not already exist
  if (typeof next.sop_code === "string" && next.sop_code !== String(current.sop_code ?? "").trim()) {
    const { data: dup } = await supabase
      .from("sops")
      .select("id")
      .eq("sop_code", next.sop_code)
      .is("archived_at", null)
      .neq("id", id)
      .limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json({ message: `SOP code "${next.sop_code}" already exists.` }, { status: 409 });
    }
  }

  /* ---------- EMPLOYEE: save as a pending change, don't touch the SOP ---------- */
  if (!isApprover) {
    if (current.pending_changes) {
      return NextResponse.json({ message: "This SOP already has an edit waiting for admin approval." }, { status: 409 });
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of FIELDS) {
      if (!(f in next)) continue;
      const before = normalize(f, current[f]);
      if (next[f] !== before) changes[f] = { from: before, to: next[f] };
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: "No changes to submit. Change at least one field first." }, { status: 400 });
    }

    const { error } = await supabase
      .from("sops")
      .update({
        pending_changes: changes,
        pending_by: userId,
        pending_by_name: me?.full_name ?? null,
        pending_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Submit pending SOP edit error:", error);
      return NextResponse.json({ message: "Could not submit your request." }, { status: 500 });
    }

    const actor = await getAuditActor(req);
    if (actor) {
      await logAuditEvent({
        ...actor,
        eventType: "user_activity",
        action: `${actor.actorName} requested changes to SOP "${current.title}" (waiting for admin approval)`,
        entityType: "sop",
        entityId: id,
        request: req,
      });
    }

    // 202 = accepted, but not applied yet. The page shows "sent to an admin for approval".
    return NextResponse.json({ pending: true, message: "Sent to an admin for approval." }, { status: 202 });
  }

  /* ---------- ADMIN: update right away ---------- */
  const update: Record<string, unknown> = { ...next };
  // An admin edit replaces anything that was waiting for approval.
  update.pending_changes = null;
  update.pending_by = null;
  update.pending_by_name = null;
  update.pending_at = null;

  const { data, error } = await supabase
    .from("sops")
    .update(update)
    .eq("id", id)
    .is("archived_at", null)
    .select()
    .single();

  if (error) {
    console.error("Update SOP error:", error);
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { message: duplicate ? `SOP code "${next.sop_code}" already exists.` : "Could not update SOP." },
      { status: duplicate ? 409 : 500 }
    );
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated SOP "${data.title}"`,
      entityType: "sop",
      entityId: data.id,
      request: req,
    });
  }

  return NextResponse.json({ sop: data });
}

// Archive (not delete): sets archived_at so the SOP disappears from the list
// but can be retrieved later from the audit log (POST /api/audit-logs/[id]/restore). Admins only.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "sops:approve")) {
    return NextResponse.json({ message: "Only admins can archive SOPs." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("sops")
    .update({
      archived_at: new Date().toISOString(),
      pending_changes: null,
      pending_by: null,
      pending_by_name: null,
      pending_at: null,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("id, title, sop_code")
    .maybeSingle();

  if (error) {
    console.error("Archive SOP error:", error);
    return NextResponse.json({ message: "Could not archive SOP." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "SOP not found or already archived." }, { status: 404 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    // eventType "archive" is what Audit Logs → Retrieve depends on: keep it.
    await logAuditEvent({
      ...actor,
      eventType: "archive",
      action: `${actor.actorName} archived SOP "${[data.sop_code, data.title].filter(Boolean).join(" · ")}"`,
      entityType: "sop",
      entityId: data.id,
      request: req,
    });
  }

  return NextResponse.json({ success: true });
}