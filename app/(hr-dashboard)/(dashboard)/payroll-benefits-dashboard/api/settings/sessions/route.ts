import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function deviceFromUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  const lc = ua.toLowerCase();
  let os = "Unknown OS";
  if (lc.includes("iphone")) os = "iPhone";
  else if (lc.includes("ipad")) os = "iPad";
  else if (lc.includes("android")) os = "Android";
  else if (lc.includes("windows nt 11")) os = "Windows 11";
  else if (lc.includes("windows nt 10")) os = "Windows 10";
  else if (lc.includes("windows nt 6.3")) os = "Windows 8.1";
  else if (lc.includes("windows nt 6.2")) os = "Windows 8";
  else if (lc.includes("windows nt 6.1")) os = "Windows 7";
  else if (lc.includes("windows")) os = "Windows";
  else if (lc.includes("cros")) os = "ChromeOS";
  else if (lc.includes("mac os x") || lc.includes("macintosh")) os = "macOS";
  else if (lc.includes("linux")) os = "Linux";

  let browser = "Browser";
  if (lc.includes("edg/")) browser = "Edge";
  else if (lc.includes("opr/") || lc.includes("opera")) browser = "Opera";
  else if (lc.includes("chrome/")) browser = "Chrome";
  else if (lc.includes("firefox/")) browser = "Firefox";
  else if (lc.includes("safari/")) browser = "Safari";

  return `${browser} on ${os}`;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;
    const admin = authResult as { id: string };

    const [liveRes, devicesRes, logRes] = await Promise.all([
      supabaseAdmin
        .from("hr_admin_active_sessions")
        .select(
          "session_id, user_id, created_at, updated_at, not_after, ip, user_agent"
        )
        .eq("user_id", admin.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("hr_admin_session_devices")
        .select(
          "session_id, device, device_type, user_agent, ip, city, country, metadata, last_seen_at"
        )
        .eq("admin_id", admin.id),
      supabaseAdmin
        .from("hr_session_log")
        .select("id, event, ip, user_agent, metadata, created_at")
        .eq("admin_id", admin.id)
        .in("event", ["login_success", "logout_absolute", "logout_manual"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const live = liveRes.data ?? [];
    const devices = devicesRes.data ?? [];
    const log = logRes.data ?? [];

    const deviceMap = new Map<string, any>();
    devices.forEach((d: any) => deviceMap.set(d.session_id, d));

    const labeled = live.map((s: any) => {
      const meta = deviceMap.get(s.session_id);
      const userAgent = meta?.user_agent ?? s.user_agent ?? null;

      let metadata = meta?.metadata ?? null;
      if (!metadata) {
        const closeLog = log.find(
          (l: any) =>
            Math.abs(
              new Date(l.created_at).getTime() -
                new Date(s.created_at).getTime()
            ) <
            5 * 60 * 1000
        );
        metadata = closeLog?.metadata ?? null;
      }

      return {
        session_id: s.session_id,
        created_at: s.created_at,
        updated_at: s.updated_at,
        not_after: s.not_after,
        ip: meta?.ip ?? s.ip ?? null,
        user_agent: userAgent,
        device: meta?.device ?? deviceFromUA(userAgent),
        device_type: meta?.device_type ?? "desktop",
        metadata,
      };
    });

    return NextResponse.json({ sessions: labeled });
  } catch (err: any) {
    console.error("[sessions GET] unexpected:", err);
    return NextResponse.json(
      { sessions: [], error: err?.message ?? "Failed to load sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;
    const admin = authResult as { id: string };

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const action = String(body?.action ?? "");

    if (action === "sign_out_session") {
      const sessionId = String(body?.session_id ?? "");
      if (!sessionId) {
        return NextResponse.json(
          { error: "Missing session_id" },
          { status: 400 }
        );
      }

      const { data: target } = await supabaseAdmin
        .from("hr_admin_active_sessions")
        .select("session_id, user_id")
        .eq("session_id", sessionId)
        .eq("user_id", admin.id)
        .maybeSingle();

      if (!target) {
        return NextResponse.json(
          { error: "Session not found or not yours." },
          { status: 404 }
        );
      }

      const { error } = await supabaseAdmin.rpc("delete_session_by_id", {
        p_session_id: sessionId,
        p_user_id: admin.id,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const ip = request.headers.get("x-forwarded-for") ?? null;
      const ua = request.headers.get("user-agent") ?? null;

      await supabaseAdmin.rpc("hr_session_log_write", {
        p_admin_id: admin.id,
        p_event: "logout_absolute",
        p_ip: ip,
        p_user_agent: ua,
        p_metadata: {
          reason: "session_revoked_by_admin",
          session_id: sessionId,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "sign_out_all") {
      const { error } = await supabaseAdmin.rpc(
        "delete_all_sessions_for_user",
        {
          p_user_id: admin.id,
        }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const ip = request.headers.get("x-forwarded-for") ?? null;
      const ua = request.headers.get("user-agent") ?? null;

      await supabaseAdmin.rpc("hr_session_log_write", {
        p_admin_id: admin.id,
        p_event: "logout_absolute",
        p_ip: ip,
        p_user_agent: ua,
        p_metadata: { reason: "sign_out_all_devices" },
      });

      const { error: authError } = await supabaseAdmin.auth.admin.signOut(
        admin.id
      );
      if (authError) {
        console.error("[sessions POST sign_out_all auth]", authError);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[sessions POST] unexpected:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to process request." },
      { status: 500 }
    );
  }
}
