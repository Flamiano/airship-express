// app/(spnc)/spnc/app/api/presence/update/route.ts
// POST /spnc/app/api/presence/update   body: { id, full_name, id_number, email, password? }   (admins only)
// Changes an employee's name, User ID and email, and (optionally) sets a new password.
// The role is NOT changed here. Leave "password" empty to keep the current password.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseClient } from "../../../../lib/supabase";
import { getSessionUserId } from "../../../../lib/currentUser";
import { normalizeSessionRole } from "../../../../lib/session";
import { can } from "../../../../lib/rbac";
import { unlockAccount } from "../../../../lib/authLimiter";
import { logAuditEvent } from "../../../../lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/; // same rule as the login page
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200; // same limit the login route uses
const EMAIL_PATTERN = /^[^\s@'"<>;,()\\]+@[^\s@'"<>;,()\\]+\.[^\s@'"<>;,()\\]+$/;

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
  const targetId = typeof body?.id === "string" ? body.id : "";
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim().replace(/\s+/g, " ") : "";
  const idNumber = typeof body?.id_number === "string" ? body.id_number.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const newPassword = typeof body?.password === "string" ? body.password : "";

  if (!targetId) return NextResponse.json({ message: "Employee not found." }, { status: 400 });
  if (!fullName || fullName.length > 100) {
    return NextResponse.json({ message: "Enter the employee's full name (up to 100 characters)." }, { status: 400 });
  }
  if (!ID_PATTERN.test(idNumber)) {
    return NextResponse.json(
      { message: "User ID can only contain letters, numbers, - _ . (up to 64 characters)." },
      { status: 400 }
    );
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (newPassword && (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH)) {
    return NextResponse.json(
      { message: `The new password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // The person being changed must exist and be an employee (admin accounts are not edited here).
  const { data: target, error: targetErr } = await supabase
    .from("users")
    .select("id, id_number, role, full_name, email")
    .eq("id", targetId)
    .maybeSingle();
  if (targetErr) {
    console.error("Update lookup error:", targetErr);
    return NextResponse.json({ message: "Couldn't save the changes." }, { status: 500 });
  }
  if (!target || target.role !== "employee") {
    return NextResponse.json({ message: "Employee not found." }, { status: 404 });
  }

  // User ID and email must not belong to someone else.
  const { data: idTaken } = await supabase.from("users").select("id").eq("id_number", idNumber).neq("id", targetId).limit(1);
  if (idTaken && idTaken.length > 0) {
    return NextResponse.json({ message: "That User ID is already used by another account." }, { status: 409 });
  }
  const { data: emailTaken } = await supabase.from("users").select("id").eq("email", email).neq("id", targetId).limit(1);
  if (emailTaken && emailTaken.length > 0) {
    return NextResponse.json({ message: "That email is already used by another account." }, { status: 409 });
  }

  const updates: Record<string, string> = { full_name: fullName, id_number: idNumber, email };
  if (newPassword) updates.password = await bcrypt.hash(newPassword, 10); // stored as a hash, like at login

  const { data: updated, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", targetId)
    .select("id, id_number, full_name, email, role, last_seen_at")
    .maybeSingle();

  if (error || !updated) {
    console.error("Update error:", error);
    return NextResponse.json({ message: "Couldn't save the changes." }, { status: 500 });
  }

  // If the User ID changed, clear any leftover login locks under the old ID.
  if (target.id_number && target.id_number !== idNumber) await unlockAccount(target.id_number);
  // A new password also clears any lock, so the employee can sign in with it right away.
  if (newPassword) await unlockAccount(idNumber);

  // Audit log: record who changed what (old -> new), only for the fields that actually changed.
  const changes: Record<string, { from: string | null; to: string }> = {};
  if (target.full_name !== fullName) changes.full_name = { from: target.full_name ?? null, to: fullName };
  if (target.id_number !== idNumber) changes.id_number = { from: target.id_number ?? null, to: idNumber };
  if (target.email !== email) changes.email = { from: target.email ?? null, to: email };
  if (Object.keys(changes).length > 0 || newPassword) {
    await logAuditEvent({
      eventType: "user_activity",
      actorId: userId,
      actorName: me.full_name,
      actorRole: me.role,
      action: `${me.full_name} changed the ${newPassword ? "details and password" : "details"} of ${fullName} (${idNumber})`,
      entityType: "user",
      entityId: targetId,
      metadata: { changes, password_changed: !!newPassword }, // the password itself is never logged
      request: req,
    });
  }

  return NextResponse.json({ ok: true, employee: updated });
}