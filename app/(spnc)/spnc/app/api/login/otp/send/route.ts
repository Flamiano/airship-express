// POST /api/login/otp/send  -> "Resend code" button.
// Only works for someone who has already passed the password step (valid pending cookie).
// Pressing Resend MAX_RESENDS times locks the account (employee: until an admin unlocks it,
// admin: 5 minutes), the same as too many wrong passwords.

import { NextRequest, NextResponse } from "next/server";
import { OTP_COOKIE, pendingCookie, readPendingToken, lookupEmail, sendEmailOtp, maskEmail } from "../../../../../lib/otp";
import {
  getLockRemaining,
  getPasswordLockRemaining,
  lockAccount,
  lockedResponse,
  clearFailures,
  registerFailure,
} from "../../../../../lib/authLimiter";
import { getSupabaseClient } from "../../../../../lib/supabase";
import { normalizeSessionRole } from "../../../../../lib/session";
import { can } from "../../../../../lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const idNumber = readPendingToken(req.cookies.get(OTP_COOKIE)?.value);
  if (!idNumber) {
    return NextResponse.json({ message: "Your sign-in session expired. Please start again." }, { status: 410 });
  }

  // Already locked (too many resends, wrong passwords or wrong codes): don't send another code.
  const accountLocked = await getPasswordLockRemaining(idNumber);
  if (accountLocked > 0) {
    const res = lockedResponse(accountLocked, true);
    res.cookies.set(pendingCookie("", 0));
    return res;
  }
  const locked = await getLockRemaining("otp", idNumber);
  if (locked > 0) return lockedResponse(locked);

  // Count this Resend press. The 5th press locks the account instead of sending another code.
  const resendLimitHit = await registerFailure("otpsend", idNumber);
  if (resendLimitHit > 0) {
    const { data: user } = await getSupabaseClient().from("users").select("role").eq("id_number", idNumber).maybeSingle();
    const isAdmin = !!user && can(normalizeSessionRole(user.role) as Parameters<typeof can>[0], "users:create");
    const lockedFor = await lockAccount(isAdmin ? "pwa" : "pw", idNumber);
    await clearFailures("otpsend", idNumber);

    const res = lockedResponse(lockedFor || 1, true);
    res.cookies.set(pendingCookie("", 0)); // end this sign-in; they have to start over
    return res;
  }

  const email = await lookupEmail(idNumber);
  if (!email) {
    return NextResponse.json({ message: "No email on file for this account. Contact HR." }, { status: 404 });
  }

  const { error, status } = await sendEmailOtp(email);
  if (error) {
    // 429 = Supabase's resend cooldown / rate limit
    const code = status === 429 ? 429 : 502;
    if (code === 502) console.error("OTP resend failed:", { status, error });
    return NextResponse.json(
      { message: code === 429 ? "Please wait a minute before requesting another code." : "Couldn't send the code. Try again." },
      { status: code }
    );
  }

  return NextResponse.json({ maskedEmail: maskEmail(email) });
}