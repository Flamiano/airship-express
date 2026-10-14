// Save as: app/(spnc)/spnc/app/api/sops/[id]/review/route.ts
// POST { action: "approve" | "decline" }  → admins only
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../../lib/supabase";
import { getSessionUserId } from "../../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../../lib/session";
import { can } from "../../../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../../../lib/audit";

// Only these fields can ever be applied from a pending edit (whitelist).
const EDITABLE = [
  "title", "sop_code", "category", "scope", "department", "version",
  "effective_date", "review_date", "content", "owner", "status",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "sops:approve")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { action } = await req.json().catch(() => ({ action: null }));
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ message: "Invalid action." }, { status: 400 });
  }

  const { data: r } = await supabase
    .from("sops")
    .select("title, sop_code, pending_changes, pending_by_name")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!r?.pending_changes) {
    return NextResponse.json({ message: "No pending edit for this SOP." }, { status: 404 });
  }

  // Clear the pending edit either way.
  const update: Record<string, unknown> = {
    pending_changes: null,
    pending_by: null,
    pending_by_name: null,
    pending_at: null,
  };

  // Approve → also apply the proposed values.
  if (action === "approve") {
    for (const [field, change] of Object.entries(r.pending_changes as Record<string, { to: unknown }>)) {
      if (EDITABLE.includes(field)) update[field] = change.to;
    }
  }

  const { error } = await supabase.from("sops").update(update).eq("id", id);
  if (error) {
    console.error("Review SOP edit error:", error);
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { message: duplicate ? "Can't approve: that SOP code is now used by another SOP." : "Could not process the request." },
      { status: duplicate ? 409 : 500 }
    );
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} ${action === "approve" ? "approved" : "declined"} ${r.pending_by_name || "an employee"}'s changes to SOP "${r.title}"`,
      entityType: "sop",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}