// Save as: app/(spnc)/spnc/app/api/users/route.ts
// Admin-only: create an account with a chosen role.
// Unlike /register, this does NOT sign the new user in (the admin stays signed in as themselves).
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../../../lib/supabase";
import { requirePermission } from "../../../lib/authz";
import { toRole } from "../../../lib/rbac";
import { getAuditActor, logAuditEvent } from "../../../lib/audit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, "users:create");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = toRole(body.role); // only roles defined in rbac.ts are accepted
  const idNumber = String(body.id_number ?? "").trim(); // optional employee ID, e.g. AE130292352

  if (!fullName || !email || !password) {
    return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ message: "Choose a valid role." }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: user, error } = await supabase
    .from("users")
    // users.id and users.created_at have no defaults in the database, so set them here.
    .insert({
      id: randomUUID(),
      email,
      password: hashedPassword,
      full_name: fullName,
      role,
      created_at: new Date().toISOString(),
      ...(idNumber ? { id_number: idNumber } : {}),
    })
    .select("id, email, full_name, role")
    .single();

  if (error || !user) {
    console.error("Create account error:", error);
    return NextResponse.json({ message: "Couldn't create the account. Please try again." }, { status: 500 });
  }

  const actor = await getAuditActor(request);
  if (actor) {
    await logAuditEvent({
      ...actor,
      eventType: "user_activity",
      action: `${actor.actorName} created ${role} account for ${user.full_name} (${user.email})`,
      entityType: "user",
      entityId: String(user.id),
      request,
    });
  }

  return NextResponse.json({ success: true, user }, { status: 201 });
}