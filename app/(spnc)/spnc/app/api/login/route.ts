import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseClient } from "../../../lib/supabase";
import {
  createPendingToken,
  pendingCookie,
  sendEmailOtp,
  maskEmail,
  getRequestInfo,
} from "../../../lib/otp";
import {
  clearFailures,
  getLockRemaining,
  getPasswordLockRemaining,
  lockedResponse,
  registerFailure,
  type LimitKind,
} from "../../../lib/authLimiter";
import { normalizeSessionRole } from "../../../lib/session";
import { can } from "../../../lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Compared against when the Employee ID doesn't exist, so unknown IDs take about as long as wrong passwords.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 10));

const MAX_ID_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 200;

// Step 1 of 2: check Employee ID + password, then email a 6-digit code.
// The real session is created in ./otp/verify/route.ts once the code is correct.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idNumber = body?.idNumber;
    const password = body?.password;
    const deviceModel = body?.deviceModel; // real phone model from the browser (shown in the OTP email)

    const trimmedId = typeof idNumber === "string" ? idNumber.trim() : "";

    if (!trimmedId || typeof password !== "string" || !password) {
      return NextResponse.json(
        { message: "User ID and password are required." },
        { status: 400 }
      );
    }

    if (trimmedId.length > MAX_ID_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ message: "Incorrect User ID or password." }, { status: 401 });
    }

    // User IDs only contain letters, numbers, "-", "_" and ".". Anything else (quotes,
    // semicolons, spaces...) can't be a real ID, so it is refused before it reaches the database.
    // It is not counted as a failed attempt, so junk input never fills the lock table.
    if (!/^[A-Za-z0-9._-]+$/.test(trimmedId)) {
      return NextResponse.json({ message: "Incorrect User ID or password." }, { status: 401 });
    }

    // Server-side lockout (can't be bypassed by calling this endpoint directly).
    // Locks: employee 15 min, admin 5 min, Employee ID that doesn't exist 5 min.
    const pwLocked = await getPasswordLockRemaining(trimmedId);
    if (pwLocked > 0) return lockedResponse(pwLocked, true);

    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("id, id_number, email, password, role")
      .eq("id_number", trimmedId)
      .maybeSingle();

    // A database problem (bad key, RLS, missing table, network) is NOT a wrong password.
    if (error) {
      console.error("Login: Supabase query failed:", error);
      return NextResponse.json(
        { message: "Unable to verify credentials right now. Please try again." },
        { status: 500 }
      );
    }

    // Same message for unknown ID and wrong password so IDs can't be probed.
    if (!user || !user.password) {
      await bcrypt.compare(password, getDummyHash());
      const lockedFor = await registerFailure("pwx", trimmedId);
      if (lockedFor > 0) return lockedResponse(lockedFor, true);
      return NextResponse.json({ message: "Incorrect User ID or password." }, { status: 401 });
    }

    // Admins get the shorter lock so a locked admin isn't stuck with nobody to unlock them.
    const isAdmin = can(normalizeSessionRole(user.role) as Parameters<typeof can>[0], "users:create");
    const pwKind: LimitKind = isAdmin ? "pwa" : "pw";

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const lockedFor = await registerFailure(pwKind, trimmedId);
      if (lockedFor > 0) return lockedResponse(lockedFor, true);
      return NextResponse.json({ message: "Incorrect User ID or password." }, { status: 401 });
    }

    // Password is correct: reset the password counter.
    // The OTP counter is intentionally NOT reset here, so re-entering the password can't be used
    // to get fresh code guesses.
    await clearFailures(pwKind, trimmedId);

    // If the code step is locked, don't send another code.
    const otpLocked = await getLockRemaining("otp", user.id_number);
    if (otpLocked > 0) return lockedResponse(otpLocked);

    // The OTP code goes to the email stored on the user's record.
    // (403 is not counted as a failed attempt by the login page.)
    if (typeof user.email !== "string" || !user.email.includes("@")) {
      return NextResponse.json(
        { message: "No email address is on file for this account. Contact HR." },
        { status: 403 }
      );
    }

    const sent = await sendEmailOtp(user.email, await getRequestInfo(req, deviceModel));
    // 429 = Supabase's per-address cooldown: a code was sent in the last minute and is still
    // valid, so carry on to the code screen instead of failing.
    if (sent.error && sent.status !== 429) {
      console.error("Login: sending OTP failed:", { status: sent.status, error: sent.error });
      return NextResponse.json(
        { message: "Couldn't send the verification code. Please try again." },
        { status: 502 }
      );
    }

    const response = NextResponse.json({
      otpRequired: true,
      maskedEmail: maskEmail(user.email),
    });

    // Proves the password step passed. Not a session: it only allows the OTP routes to continue.
    response.cookies.set(pendingCookie(createPendingToken(user.id_number)));

    return response;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}