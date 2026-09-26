import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../lib/supabase";
import { normalizeSessionRole, SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

async function getCurrentUser(request: NextRequest) {
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

const supabaseAdmin = getSupabaseClient();

const EVENT_TYPES = ["login", "logout", "session_timeout", "user_activity", "archive"] as const;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, monthRes, recentRes] = await Promise.all([
    supabaseAdmin.from("audit_logs").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("audit_logs").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabaseAdmin.from("audit_logs").select("event_type, created_at").gte("created_at", thirtyDaysAgo),
  ]);

  if (totalRes.error || monthRes.error || recentRes.error) {
    console.error("Fetch audit stats error:", totalRes.error || monthRes.error || recentRes.error);
    return NextResponse.json({ message: "Failed to fetch audit log stats." }, { status: 500 });
  }

  const byEventType: Record<string, number> = Object.fromEntries(EVENT_TYPES.map((t) => [t, 0]));
  const dailyMap = new Map<string, number>();

  for (const row of recentRes.data || []) {
    if (row.event_type in byEventType) byEventType[row.event_type] += 1;
    const day = String(row.created_at).slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }

  // Fill every day in the last 30, even ones with zero events, so the
  // chart reads as a continuous trend rather than skipping gaps.
  const dailyTrend: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyTrend.push({ date: key, count: dailyMap.get(key) || 0 });
  }

  return NextResponse.json({
    total: totalRes.count || 0,
    thisMonth: monthRes.count || 0,
    byEventType,
    dailyTrend,
  });
}