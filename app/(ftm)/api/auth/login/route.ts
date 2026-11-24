import { NextResponse } from "next/server";
import { createFtmAuthClient, createFtmServiceClient } from "../../../lib/server/ftmSupabase";
import { clearLoginFailures, getLoginLock, recordFailedLogin } from "../../../lib/server/ftmLoginProtection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function profileFromUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email,
    full_name: metadata.full_name || user.email?.split("@")[0] || "User",
    phone: metadata.phone || null,
    role: metadata.role || null,
    vehicle_id: metadata.vehicle_id || null,
  };
}

function createSessionResponse(
  body: Record<string, unknown>,
  session: { access_token: string; refresh_token: string; expires_in?: number }
) {
  const response = NextResponse.json(body);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("ftm_access_token", session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: session.expires_in || 3600,
  });
  response.cookies.set("ftm_refresh_token", session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const serviceClient = createFtmServiceClient();
    const loginKey = email.toLowerCase();
    const lock = await getLoginLock(serviceClient, loginKey);
    if (lock) {
      return NextResponse.json({ error: "Account temporarily locked after repeated failed login attempts.", retryAfterSeconds: lock.retryAfterSeconds }, { status: 423 });
    }

    const authClient = createFtmAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      const notConfirmed = error.code === "email_not_confirmed" || /email not confirmed|confirm your email/i.test(error.message);
      const failedLogin = notConfirmed ? null : await recordFailedLogin(serviceClient, loginKey);
      if (failedLogin?.locked) {
        return NextResponse.json({ error: "Account temporarily locked after 5 failed login attempts.", retryAfterSeconds: failedLogin.retryAfterSeconds }, { status: 423 });
      }
      return NextResponse.json({
        error: notConfirmed ? "Please verify your email before signing in." : "Invalid email or password",
        ...(notConfirmed ? { code: "email_not_confirmed" } : {}),
        ...(!notConfirmed && failedLogin ? { attemptsRemaining: failedLogin.attemptsRemaining } : {}),
      }, { status: notConfirmed ? 403 : 401 });
    }

    await clearLoginFailures(serviceClient, loginKey);

    const user = data.user;
    if (!user?.id || !data.session) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: "Please verify your email before signing in.", code: "email_not_confirmed" }, { status: 403 });
    }

    if (serviceClient) {
      const { data: profile, error: profileError } = await serviceClient
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError && profile) {
        return createSessionResponse({ user: profile, session: data.session, message: "Login successful" }, data.session);
      }

      if (profileError) {
        console.error("FTM login profile lookup failed:", profileError.message);
      } else {
        const fallbackProfile = profileFromUser(user);
        const { data: restored, error: restoreError } = await serviceClient
          .from("users")
          .upsert([fallbackProfile], { onConflict: "id" })
          .select("*")
          .maybeSingle();
        if (!restoreError && restored) {
          return createSessionResponse({ user: restored, session: data.session, message: "Login successful" }, data.session);
        }
      }
    }

    return createSessionResponse({
      user: profileFromUser(user),
      session: data.session,
      profilePending: true,
      message: "Login successful. Your profile is being synchronized.",
    }, data.session);
  } catch (error) {
    console.error("FTM login request failed:", error);
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
}