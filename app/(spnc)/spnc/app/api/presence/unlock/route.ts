// app/(spnc)/spnc/app/api/presence/unlock/route.ts
// POST /spnc/app/api/presence/unlock   body: { idNumber: string }   (admins only)
// Clears the failed-login lock for that Employee ID so the person can sign in again.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../lib/session";
import { can } from "../../../../lib/rbac";
import { unlockAccount } from "../../../../lib/authLimiter";
import { logAuditEvent } from "../../../../lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseClient();

  const { data: me } = await supabase.from("users").select("role, full_name").eq("id", userId).maybeSingle();
  const role = normalizeSessionRole(me?.role);
  if (!me || !can(role as Parameters<typeof can>[0], "users:create")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const idNumber = typeof body?.idNumber === "string" ? body.idNumber.trim() : "";
  if (!idNumber) return NextResponse.json({ message: "Employee ID is required." }, { status: 400 });

  // Only unlock IDs that belong to a real account.
  const { data: target, error } = await supabase
    .from("users")
    .select("id, id_number, full_name")
    .eq("id_number", idNumber)
    .maybeSingle();
  if (error) {
    console.error("Unlock lookup error:", error);
    return NextResponse.json({ message: "Couldn't unlock the account." }, { status: 500 });
  }
  if (!target) return NextResponse.json({ message: "Employee not found." }, { status: 404 });

  await unlockAccount(idNumber);

  await logAuditEvent({
    eventType: "user_activity",
    actorId: userId,
    actorName: me.full_name,
    actorRole: me.role,
    action: `${me.full_name} unlocked the account of ${target.full_name || idNumber} (${idNumber})`,
    entityType: "user",
    entityId: target.id,
    request: req,
  });

  return NextResponse.json({ ok: true });
}