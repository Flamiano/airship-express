// app/(spnc)/spnc/app/api/rates/[id]/route.ts
//
// NOTE: I haven't seen your original version of this file. This one has GET, PUT and DELETE.
// If your current file has extra logic (a different GET shape for the detail page, or a special audit
// event on archive that "Audit Logs → Retrieve" depends on), keep those parts of your own file.
//
//   GET     → one rate
//   PUT     → admin: updates the rate now. employee: saves the edit as a pending change for an admin.
//   DELETE  → admin only: archives the rate (sets archived_at)
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../lib/session";
import { can } from "../../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

const FIELDS = [
  "rate_code", "description", "department", "charge_type", "currency",
  "base_rate", "min_charge", "surcharge_pct", "valid_from", "valid_to", "status", "notes",
] as const;
type Field = (typeof FIELDS)[number];

const MONEY: Field[] = ["base_rate", "min_charge", "surcharge_pct"];
const DATES: Field[] = ["valid_from", "valid_to"];
const TEXT_NULLABLE: Field[] = ["description", "department", "notes"];

// Same cleaning for what is sent AND what is saved, so "no change" comparisons are reliable.
function normalize(field: Field, v: unknown): string | number | null {
  if (MONEY.includes(field)) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  if (DATES.includes(field)) {
    const s = v === undefined || v === null ? "" : String(v).trim().slice(0, 10);
    return s === "" ? null : s;
  }
  if (TEXT_NULLABLE.includes(field)) {
    const s = v === undefined || v === null ? "" : String(v).trim();
    return s === "" ? null : s;
  }
  return v === undefined || v === null ? "" : String(v).trim(); // rate_code, charge_type, currency, status
}

type Ctx = { params: Promise<{ id: string }> }; // Next 15+. On Next 14 use { params: { id: string } } and drop the awaits.

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("rates").select("*").eq("id", id).is("archived_at", null).maybeSingle();
  if (error) {
    console.error("Fetch rate error:", error);
    return NextResponse.json({ message: "Could not load rate." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Rate not found." }, { status: 404 });
  return NextResponse.json({ rate: data });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role, full_name").eq("id", userId).maybeSingle();
  const isApprover = can(normalizeSessionRole(me?.role), "rates:approve");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid request." }, { status: 400 });

  const { data: current } = await supabase.from("rates").select("*").eq("id", id).is("archived_at", null).maybeSingle();
  if (!current) return NextResponse.json({ message: "Rate not found." }, { status: 404 });

  // What the request wants each field to be (only fields that were sent)
  const next: Partial<Record<Field, string | number | null>> = {};
  for (const f of FIELDS) if (body[f] !== undefined) next[f] = normalize(f, body[f]);

  if (("rate_code" in next && !next.rate_code) || ("base_rate" in body && (body.base_rate === "" || body.base_rate === null))) {
    return NextResponse.json({ message: "Rate code and base rate are required." }, { status: 400 });
  }

  // A different rate code must not already exist
  if (typeof next.rate_code === "string" && next.rate_code !== String(current.rate_code ?? "").trim()) {
    const { data: dup } = await supabase.from("rates").select("id").eq("rate_code", next.rate_code).neq("id", id).limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json({ message: `Rate code "${next.rate_code}" already exists.` }, { status: 409 });
    }
  }

  /* ---------- EMPLOYEE: save as a pending change, don't touch the rate ---------- */
  if (!isApprover) {
    if (current.pending_changes) {
      return NextResponse.json({ message: "This rate already has an edit waiting for admin approval." }, { status: 409 });
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of FIELDS) {
      if (!(f in next)) continue;
      const before = normalize(f, current[f]);
      if (next[f] !== before) changes[f] = { from: before, to: next[f] };
    }

    if (Object.keys(changes).length === 0) {
      console.warn("[rates PUT] 400 no changes. role =", me?.role, "id =", id);
      return NextResponse.json({ message: "No changes to submit. Change at least one field first." }, { status: 400 });
    }

    const { error } = await supabase
      .from("rates")
      .update({
        pending_changes: changes,
        pending_by: userId,
        pending_by_name: me?.full_name ?? null,
        pending_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Submit pending rate edit error:", error);
      return NextResponse.json({ message: "Could not submit your request." }, { status: 500 });
    }

    const actor = await getAuditActor(req);
    if (actor) {
      await logAuditEvent({
        ...actor,
        eventType: "user_activity",
        action: `${actor.actorName} requested changes to rate "${current.rate_code}" (waiting for admin approval)`,
        entityType: "rate",
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

  const { data, error } = await supabase.from("rates").update(update).eq("id", id).select().single();

  if (error) {
    console.error("Update rate error:", error);
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { message: duplicate ? `Rate code "${next.rate_code}" already exists.` : "Could not update rate." },
      { status: duplicate ? 409 : 500 }
    );
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} updated rate "${data.rate_code}"`,
      entityType: "rate",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ rate: data });
}

// Archive (soft delete). Admins only.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "rates:approve")) {
    return NextResponse.json({ message: "Only admins can archive rates." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("rates")
    .update({
      archived_at: new Date().toISOString(),
      pending_changes: null,
      pending_by: null,
      pending_by_name: null,
      pending_at: null,
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("rate_code")
    .maybeSingle();

  if (error) {
    console.error("Archive rate error:", error);
    return NextResponse.json({ message: "Could not archive rate." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ message: "Rate not found." }, { status: 404 });

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} archived rate "${data.rate_code}"`,
      entityType: "rate",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}