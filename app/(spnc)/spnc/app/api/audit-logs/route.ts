import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabase";
import { normalizeSessionRole, SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

const EVENT_TYPES = ["login", "logout", "session_timeout", "user_activity", "archive"] as const;

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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const eventType = params.get("eventType") || "all";
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") || "25", 10) || 25));
  const search = params.get("q")?.trim().replace(/[%,()]/g, " ") || "";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getSupabaseClient()
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number])) {
    query = query.eq("event_type", eventType);
  }

  if (search) {
    query = query.or(`action.ilike.%${search}%,actor_name.ilike.%${search}%,entity_type.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Fetch audit logs error:", error);
    return NextResponse.json({ message: "Failed to fetch audit logs." }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [], total: count || 0, page, pageSize });
}
