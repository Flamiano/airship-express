// POST /spnc/app/api/login/otp/verify   body: { code: "123456" }
// Step 2 of 2: check the emailed code, then create the session (same as the old /api/login did).

import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "../../../../../lib/audit";
import { getSupabaseClient } from "../../../../../lib/supabase";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../../../lib/session";
import { OTP_COOKIE, pendingCookie, readPendingToken, verifyEmailOtp } from "../../../../../lib/otp";
import { clearFailures, getLockRemaining, lockedResponse, registerFailure } from "../../../../../lib/authLimiter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Must match Supabase -> Authentication -> Sign In / Providers -> Email -> "Email OTP Length".
// Default 6. If you keep 8 in Supabase, set NEXT_PUBLIC_OTP_LENGTH=8 in .env.local and restart.
const OTP_LENGTH = Number(process.env.NEXT_PUBLIC_OTP_LENGTH ?? 6);

export async function POST(req: NextRequest) {
  // Tracks where we are, so a 500 tells you exactly which step failed (see the terminal log).
  let step = "start";

  try {
    step = "read pending cookie";
    const idNumber = readPendingToken(req.cookies.get(OTP_COOKIE)?.value);
    if (!idNumber) {
      return NextResponse.json(
        { message: "Your sign-in session expired. Please sign in again." },
        { status: 410 }
      );
    }

    // Server-side lockout on code guesses.
    step = "lockout check";
    const locked = await getLockRemaining("otp", idNumber);
    if (locked > 0) return lockedResponse(locked);

    step = "read request body";
    const { code } = await req.json().catch(() => ({ code: "" }));
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(code ?? ""))) {
      return NextResponse.json(
        { message: `Enter the ${OTP_LENGTH}-digit code.` },
        { status: 400 }
      );
    }

    // Only the columns this route needs (no password hash).
    // If this errors with "column ... does not exist", fix the names here or use .select("*").
    step = "load user from users table";
    const { data: user, error } = await getSupabaseClient()
      .from("users")
      .select("id, id_number, email, full_name, role")
      .eq("id_number", idNumber)
      .maybeSingle();

    if (error) {
      console.error("OTP verify: Supabase query failed:", error);
      return NextResponse.json(
        { message: "Unable to verify the code right now. Please try again." },
        { status: 500 }
      );
    }

    if (!user || typeof user.email !== "string") {
      return NextResponse.json(
        { message: "Your sign-in session expired. Please sign in again." },
        { status: 410 }
      );
    }

    step = "verify code with Supabase Auth";
    const ok = await verifyEmailOtp(user.email, String(code));
    if (!ok) {
      const lockedFor = await registerFailure("otp", idNumber);
      if (lockedFor > 0) {
        // Too many wrong codes: end this sign-in attempt and make them start over (after the lock).
        const res = lockedResponse(lockedFor);
        res.cookies.set(pendingCookie("", 0));
        return res;
      }
      return NextResponse.json({ message: "Invalid or expired code." }, { status: 401 });
    }

    step = "clear failure counter";
    await clearFailures("otp", idNumber);
    await clearFailures("otpsend", idNumber); // resend counter starts fresh after a good login

    step = "create session token";
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });

    // Audit logging should never block a valid login.
    step = "audit log";
    try {
      await logAuditEvent({
        eventType: "login",
        actorId: user.id,
        actorName: user.full_name,
        actorRole: user.role,
        action: `${user.full_name} (${user.id_number}) logged in`,
        request: req,
      });
    } catch (auditErr) {
      console.error("OTP verify: audit log failed (login continues):", auditErr);
    }

    step = "build response";
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        id_number: user.id_number,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      // Secure cookies are dropped over plain http (except on localhost in most browsers).
      // If you run a production build over http (e.g. an internal IP), set COOKIE_SECURE=false.
      secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // The pending cookie has done its job - delete it.
    response.cookies.set(pendingCookie("", 0));

    return response;
  } catch (err) {
    console.error(`OTP verify API error at step "${step}":`, err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}