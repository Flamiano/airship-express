import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const EVENT_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Failed sign-in",
  logout_manual: "Signed out",
  logout_inactivity: "Signed out (idle)",
  logout_absolute: "Session ended",
  otp_sent: "OTP sent",
  otp_verified: "OTP verified",
  otp_failed: "OTP failed",
};

const ALLOWED_EVENTS = [
  "login_success",
  "login_failed",
  "logout_manual",
  "logout_inactivity",
  "logout_absolute",
  "otp_sent",
  "otp_verified",
  "otp_failed",
] as const;

type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

function isAllowedEvent(v: unknown): v is AllowedEvent {
  return (
    typeof v === "string" && (ALLOWED_EVENTS as readonly string[]).includes(v)
  );
}

type GeoResult = {
  country: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  is_private: boolean;
};

const EMPTY_GEO: GeoResult = {
  country: null,
  country_name: null,
  region: null,
  city: null,
  isp: null,
  is_private: false,
};

const LOCAL_GEO: GeoResult = {
  country: "PH",
  country_name: "Philippines",
  region: "Metro Manila",
  city: "Local",
  isp: "Local network",
  is_private: true,
};

function isPrivateIp(clean: string): boolean {
  if (!clean) return true;
  if (clean === "::1") return true;
  if (clean.startsWith("127.")) return true;
  if (clean.startsWith("10.")) return true;
  if (clean.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true;
  return false;
}

async function geolocate(ip: string | null): Promise<GeoResult> {
  if (!ip) return LOCAL_GEO;

  const clean = ip.split(",")[0].trim();
  if (isPrivateIp(clean)) return LOCAL_GEO;

  try {
    const res = await fetch(`https://ipapi.co/${clean}/json/`, {
      headers: { "User-Agent": "AirshipExpress/1.0" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();

    if (data?.error) throw new Error(data.reason ?? "lookup failed");

    return {
      country:
        typeof data?.country_code === "string" ? data.country_code : null,
      country_name:
        typeof data?.country_name === "string" ? data.country_name : null,
      region: typeof data?.region === "string" ? data.region : null,
      city: typeof data?.city === "string" ? data.city : null,
      isp: typeof data?.org === "string" ? data.org : null,
      is_private: false,
    };
  } catch {
    return EMPTY_GEO;
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };

  const nowIso = new Date().toISOString();

  const [
    sessionLogRes,
    otpSessionRes,
    otpPendingRes,
    otpLockRes,
    securityEventsRes,
    bankAttemptsRes,
    emailChangeRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("hr_session_log")
      .select("id, event, ip, user_agent, metadata, created_at")
      .eq("admin_id", admin.id)
      .order("created_at", { ascending: false })
      .limit(30),

    supabaseAdmin
      .from("hr_admin_otp_session")
      .select("id, scope, expires_at, created_at")
      .eq("admin_id", admin.id)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("hr_admin_otp")
      .select("id, purpose, expires_at, attempts, resend_count, created_at")
      .eq("admin_id", admin.id)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(5),

    supabaseAdmin
      .from("hr_admin_otp_lock")
      .select("admin_id, purpose, locked_until, locked_at")
      .eq("admin_id", admin.id),

    supabaseAdmin
      .from("hr4_airy_security_events")
      .select(
        "id, event_type, trigger_intent, severity, trigger_message, created_at"
      )
      .eq("admin_id", admin.id)
      .order("created_at", { ascending: false })
      .limit(15),

    supabaseAdmin
      .from("hr4_bank_pass_attempts")
      .select(
        "attempts, last_attempt_at, locked_until, create_attempts, create_locked_until"
      )
      .eq("admin_id", admin.id)
      .maybeSingle(),

    supabaseAdmin
      .from("hr_admin_email_change")
      .select(
        "id, old_email, new_email, new_email_expires_at, attempts, created_at"
      )
      .eq("admin_id", admin.id)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .maybeSingle(),
  ]);

  const lastLogin =
    (sessionLogRes.data ?? []).find((e: any) => e.event === "login_success") ??
    null;

  const failedAttempts24h = (sessionLogRes.data ?? []).filter(
    (e: any) =>
      e.event === "login_failed" &&
      new Date(e.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
  ).length;

  const criticalCount = (securityEventsRes.data ?? []).filter(
    (e: any) => e.severity === "critical"
  ).length;

  const otpLocked = (otpLockRes.data ?? []).some(
    (l: any) => new Date(l.locked_until) > new Date()
  );

  const bankLocked =
    bankAttemptsRes.data?.locked_until &&
    new Date(bankAttemptsRes.data.locked_until) > new Date();

  const createBankLocked =
    bankAttemptsRes.data?.create_locked_until &&
    new Date(bankAttemptsRes.data.create_locked_until) > new Date();

  const healthScore = Math.max(
    0,
    100 -
      failedAttempts24h * 5 -
      criticalCount * 15 -
      (otpLocked ? 20 : 0) -
      (bankLocked ? 10 : 0)
  );

  return NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    },
    lastLogin,
    failedAttempts24h,
    securityEvents: securityEventsRes.data ?? [],
    sessionLog: sessionLogRes.data ?? [],
    otp: {
      activeSessions: otpSessionRes.data ?? [],
      pending: otpPendingRes.data ?? [],
      locks: otpLockRes.data ?? [],
      locked: otpLocked,
    },
    bank: {
      attempts: bankAttemptsRes.data?.attempts ?? 0,
      lastAttemptAt: bankAttemptsRes.data?.last_attempt_at ?? null,
      lockedUntil: bankAttemptsRes.data?.locked_until ?? null,
      locked: !!bankLocked,
      createAttempts: bankAttemptsRes.data?.create_attempts ?? 0,
      createLockedUntil: bankAttemptsRes.data?.create_locked_until ?? null,
      createLocked: !!createBankLocked,
    },
    emailChange: emailChangeRes.data ?? null,
    healthScore,
    eventLabels: EVENT_LABELS,
    fetchedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  const cfCountry = request.headers.get("cf-ipcountry") ?? null;

  let body: any;
  try {
    body = await request.clone().json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = String(body?.action ?? "");

  if (action === "log_event" && body?.event === "login_failed") {
    const empId = String(body?.metadata?.employee_id_attempted ?? "").trim();
    if (empId) {
      const { data: adminRow } = await supabaseAdmin
        .from("hr_admin")
        .select("id")
        .eq("employee_id", empId)
        .maybeSingle();

      if (adminRow) {
        const geo = await geolocate(ip);

        const metadata = {
          ...(body?.metadata ?? {}),
          country: cfCountry ?? geo.country,
          country_name: geo.country_name,
          region: geo.region,
          city: geo.city,
          isp: geo.isp,
          is_private: geo.is_private,
        };

        await supabaseAdmin.rpc("hr_session_log_write", {
          p_admin_id: adminRow.id,
          p_event: "login_failed",
          p_ip: ip,
          p_user_agent: userAgent,
          p_metadata: metadata,
        });
      }
    }
    return NextResponse.json({ success: true });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const admin = authResult as { id: string; email: string };

  switch (action) {
    case "log_event": {
      const event = body?.event;
      if (!isAllowedEvent(event)) {
        return NextResponse.json({ error: "Invalid event" }, { status: 400 });
      }

      const geo = await geolocate(ip);

      const metadata = {
        ...(body?.metadata ?? {}),
        country: cfCountry ?? geo.country,
        country_name: geo.country_name,
        region: geo.region,
        city: geo.city,
        isp: geo.isp,
        is_private: geo.is_private,
      };

      await supabaseAdmin.rpc("hr_session_log_write", {
        p_admin_id: admin.id,
        p_event: event,
        p_ip: ip,
        p_user_agent: userAgent,
        p_metadata: metadata,
      });
      return NextResponse.json({ success: true });
    }

    case "revoke_otp_sessions": {
      await supabaseAdmin
        .from("hr_admin_otp_session")
        .delete()
        .eq("admin_id", admin.id);

      await supabaseAdmin
        .from("hr_admin_otp")
        .delete()
        .eq("admin_id", admin.id)
        .is("consumed_at", null);

      await supabaseAdmin
        .from("hr_admin_otp_lock")
        .delete()
        .eq("admin_id", admin.id);

      await supabaseAdmin.rpc("hr_session_log_write", {
        p_admin_id: admin.id,
        p_event: "logout_manual",
        p_ip: ip,
        p_user_agent: userAgent,
        p_metadata: {
          reason: "otp_sessions_revoked_by_admin",
          country: cfCountry,
        },
      });

      return NextResponse.json({ success: true });
    }

    case "clear_bank_lock": {
      await supabaseAdmin.from("hr4_bank_pass_attempts").upsert(
        {
          admin_id: admin.id,
          attempts: 0,
          locked_until: null,
          create_attempts: 0,
          create_locked_until: null,
          last_attempt_at: null,
          create_last_attempt_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "admin_id" }
      );

      return NextResponse.json({ success: true });
    }

    case "cancel_email_change": {
      await supabaseAdmin
        .from("hr_admin_email_change")
        .delete()
        .eq("admin_id", admin.id)
        .is("consumed_at", null);

      return NextResponse.json({ success: true });
    }

    case "sign_out_all": {
      await supabaseAdmin
        .from("hr_admin_otp_session")
        .delete()
        .eq("admin_id", admin.id);

      await supabaseAdmin.rpc("hr_session_log_write", {
        p_admin_id: admin.id,
        p_event: "logout_absolute",
        p_ip: ip,
        p_user_agent: userAgent,
        p_metadata: {
          reason: "sign_out_all_devices",
          country: cfCountry,
        },
      });

      const { error } = await supabaseAdmin.auth.admin.signOut(admin.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
