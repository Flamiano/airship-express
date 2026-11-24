import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";
const VALID_ROLES = new Set(["admin", "fleet_manager", "dispatcher", "driver", "customer"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (context.user.role !== "admin") return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  let body: { role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const role = String(body.role || "").trim().toLowerCase();
  if (!VALID_ROLES.has(role)) return NextResponse.json({ error: "Invalid user role" }, { status: 400 });
  if (id === context.user.id && role !== "admin") return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });

  const supabase = context.serviceClient;
  const { data: existing, error: readError } = await supabase.from("users").select("role").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message || "Failed to read current user role" }, { status: 500 });
  const { data: updatedAuth, error: authError } = await supabase.auth.admin.updateUserById(id, { app_metadata: { role } });
  if (authError) return NextResponse.json({ error: authError.message || "Failed to update auth role" }, { status: 500 });
  const { data: profile, error: profileError } = await supabase.from("users").update({ role }).eq("id", id).select("id, email, full_name, role").maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message || "Failed to update profile role" }, { status: 500 });
  const { error: auditError } = await supabase.from("role_change_audit").insert({
    changed_by: context.user.id,
    target_user: id,
    old_role: existing?.role || null,
    new_role: role,
  });
  if (auditError) console.error("Role change audit write failed:", auditError.message);
  return NextResponse.json(profile || { id, email: updatedAuth.user?.email || null, role });
}