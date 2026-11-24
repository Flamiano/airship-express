import { NextResponse } from "next/server";
import { createFtmAuthClient, createFtmServiceClient } from "../../../../lib/server/ftmSupabase";
import { clearLoginFailures, getLoginLock, recordFailedLogin } from "../../../../lib/server/ftmLoginProtection";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDriver(value: unknown) {
  const user = isRecord(value) ? value : {};
  const email = typeof user.email === "string" ? user.email : "";
  return {
    ...user,
    fullName: user.full_name || user.fullName || email.split("@")[0] || "Driver",
    phone: user.phone || null,
    role: user.role || "driver",
    vehicleId: user.vehicle_id || user.vehicleId || null,
  };
}

function profileFromUser(value: unknown) {
  const user = isRecord(value) ? value : {};
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const email = typeof user.email === "string" ? user.email : "";
  return {
    id: user.id,
    email: user.email,
    full_name: metadata.full_name || email.split("@")[0] || "Driver",
    phone: metadata.phone || null,
    role: metadata.role || "driver",
    courier_id: metadata.courier_id || null,
    vehicle_id: null,
  };
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

  try {
    const supabase = createFtmAuthClient();
    const service = createFtmServiceClient();
    const loginKey = body.email.trim().toLowerCase();
    const lock = await getLoginLock(service, loginKey);
    if (lock) {
      return NextResponse.json({ error: "Account temporarily locked after repeated failed login attempts.", retryAfterSeconds: lock.retryAfterSeconds }, { status: 423 });
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error) {
      if (error.code === "email_not_confirmed" || /email not confirmed|confirm your email/i.test(error.message)) {
        return NextResponse.json({ error: "Please verify your email before signing in.", code: "email_not_confirmed" }, { status: 403 });
      }
      const failedLogin = await recordFailedLogin(service, loginKey);
      if (failedLogin.locked) {
        return NextResponse.json({ error: "Account temporarily locked after 5 failed login attempts.", retryAfterSeconds: failedLogin.retryAfterSeconds }, { status: 423 });
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await clearLoginFailures(service, loginKey);
    if (!data.user?.id || !data.session) return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    if (!data.user.email_confirmed_at) return NextResponse.json({ error: "Please verify your email before signing in.", code: "email_not_confirmed" }, { status: 403 });

    if (!service) return NextResponse.json({ user: normalizeDriver(profileFromUser(data.user)), session: data.session, profilePending: true, message: "Login successful. Your dispatcher can complete the driver profile assignment." });
    const { data: profile, error: profileError } = await service.from("users").select("*").eq("id", data.user.id).maybeSingle();
    if (profileError) {
      const fallback = profileFromUser(data.user);
      return NextResponse.json({ user: normalizeDriver(fallback), session: data.session, profilePending: true, message: "Login successful. Your dispatcher can complete the driver profile assignment." });
    }
    if (profile) return NextResponse.json({ user: normalizeDriver(profile), session: data.session, message: "Login successful" });

    const fallback = profileFromUser(data.user);
    const { data: restored, error: restoreError } = await service.from("users").upsert([fallback], { onConflict: "id" }).select("*").maybeSingle();
    if (!restoreError && restored) return NextResponse.json({ user: normalizeDriver(restored), session: data.session, message: "Login successful" });
    return NextResponse.json({ user: normalizeDriver(fallback), session: data.session, profilePending: true, message: "Login successful. Your driver profile is being synchronized." });
  } catch (error) {
    console.error("Driver login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}