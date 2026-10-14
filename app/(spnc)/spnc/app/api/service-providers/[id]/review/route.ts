// app/(spnc)/spnc/app/api/service-providers/[id]/review/route.ts
// POST { action: "approve" | "decline" }  → admins only
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../../lib/supabase";
import { getSessionUserId } from "../../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../../lib/session";
import { can } from "../../../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../../../lib/audit";

// Only these fields can ever be applied from a pending edit (whitelist).
const EDITABLE = [
  "name", "type", "agency", "department", "contact_person", "email", "phone",
  "address", "country", "service_modes", "status", "rating", "contract_ref", "notes", "attachments",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 15+. On Next 14 use { params: { id: string } } and drop the await.

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data: me } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!can(normalizeSessionRole(me?.role), "providers:approve")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { action } = await req.json().catch(() => ({ action: null }));
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ message: "Invalid action." }, { status: 400 });
  }

  const { data: p } = await supabase
    .from("service_providers")
    .select("name, pending_changes, pending_by_name")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (!p?.pending_changes) {
    return NextResponse.json({ message: "No pending edit for this provider." }, { status: 404 });
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
    for (const [field, change] of Object.entries(p.pending_changes as Record<string, { to: unknown }>)) {
      if (EDITABLE.includes(field)) update[field] = change.to;
    }
  }

  const { error } = await supabase.from("service_providers").update(update).eq("id", id);
  if (error) {
    console.error("Review provider edit error:", error);
    return NextResponse.json({ message: "Couldn't process the request." }, { status: 500 });
  }

  const actor = await getAuditActor(req);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} ${action === "approve" ? "approved" : "declined"} ${p.pending_by_name || "an employee"}'s changes to service provider "${p.name}"`,
      entityType: "service_provider",
      entityId: id,
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}