// lib/authz.ts  (save next to lib/session.ts, lib/supabase.ts, lib/rbac.ts)
// Server-side permission gate for API routes.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "./supabase";
import { normalizeSessionRole, SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { can, type Permission } from "./rbac";

export async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const session = await verifySessionToken(sessionCookie);
  if (!session) return null;

  let role = session.role;
  if (!role) {
    const { data: user } = await getSupabaseClient()
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    role = user?.role;
  }

  return {
    id: session.userId,
    name: session.full_name,
    role: normalizeSessionRole(role),
  };
}

/**
 * Usage in a route:
 *   const auth = await requirePermission(request, "audit-logs:view");
 *   if (!auth.ok) return auth.response;
 *   // auth.user is available here
 */
export async function requirePermission(request: NextRequest, permission: Permission) {
  const user = await getSessionUser(request);
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (!can(user.role, permission)) {
    return { ok: false as const, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}