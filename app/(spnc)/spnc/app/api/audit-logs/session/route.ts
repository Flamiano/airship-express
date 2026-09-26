import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { normalizeSessionRole, SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

// Returns the current logged-in user for ShellContext to read the role from.
// Uses the same session cookie / verification your other routes use.
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const session = await verifySessionToken(sessionCookie);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let role = session.role;
  if (!role) {
    const { data: user } = await getSupabaseClient()
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    role = user?.role;
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.full_name,
      role: normalizeSessionRole(role),
    },
  });
}