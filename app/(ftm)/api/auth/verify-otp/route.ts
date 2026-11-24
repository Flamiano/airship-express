import { NextResponse } from "next/server";
import { createFtmServiceClient } from "../../../lib/server/ftmSupabase";
import { hashOtpCode, MAX_OTP_ATTEMPTS } from "../../../lib/server/ftmOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").replace(/\D/g, "");
  if (!email || !code) return NextResponse.json({ error: "Email and OTP code are required." }, { status: 400 });

  const supabase = createFtmServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });

  const { data: record, error } = await supabase
    .from("ftm_email_otps")
    .select("code_hash, expires_at, attempts")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error("OTP state lookup failed:", error.message);
    return NextResponse.json({ error: "OTP storage is unavailable. Apply the FTM email OTP database migration." }, { status: 503 });
  }
  if (!record) return NextResponse.json({ error: "No active OTP was found for this email." }, { status: 401 });

  if (Date.now() > new Date(record.expires_at).getTime()) {
    await supabase.from("ftm_email_otps").delete().eq("email", email);
    return NextResponse.json({ error: "The verification code has expired. Please request a new one." }, { status: 410 });
  }

  if (record.code_hash !== hashOtpCode(email, code)) {
    const attempts = Number(record.attempts || 0) + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await supabase.from("ftm_email_otps").delete().eq("email", email);
      return NextResponse.json({ error: "Too many incorrect codes. Request a new verification code and try again.", attemptsRemaining: 0 }, { status: 429 });
    }
    await supabase.from("ftm_email_otps").update({ attempts }).eq("email", email);
    return NextResponse.json({ error: "The verification code is invalid.", attemptsRemaining: MAX_OTP_ATTEMPTS - attempts }, { status: 401 });
  }

  await supabase.from("ftm_email_otps").delete().eq("email", email);
  return NextResponse.json({ verified: true, message: "Verification successful." });
}