import { NextResponse } from "next/server";
import { createFtmServiceClient } from "../../../lib/server/ftmSupabase";
import {
  generateOtpCode,
  getOtpLifetimeSeconds,
  hashOtpCode,
  OTP_RESEND_COOLDOWN_SECONDS,
  sendOtpEmail,
} from "../../../lib/server/ftmOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const supabase = createFtmServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });

  const now = Date.now();
  const { data: existing, error: lookupError } = await supabase
    .from("ftm_email_otps")
    .select("last_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("OTP state lookup failed:", lookupError.message);
    return NextResponse.json({ error: "OTP storage is unavailable. Apply the FTM email OTP database migration." }, { status: 503 });
  }

  const lastSentAt = existing?.last_sent_at ? new Date(existing.last_sent_at).getTime() : 0;
  if (lastSentAt && now - lastSentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return NextResponse.json({
      error: "Please wait before requesting another verification code.",
      retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now - lastSentAt)) / 1000),
    }, { status: 429 });
  }

  const lifetimeSeconds = await getOtpLifetimeSeconds(supabase);
  const code = generateOtpCode();
  const expiresAt = now + lifetimeSeconds * 1000;
  const { error: saveError } = await supabase.from("ftm_email_otps").upsert({
    email,
    code_hash: hashOtpCode(email, code),
    expires_at: new Date(expiresAt).toISOString(),
    attempts: 0,
    last_sent_at: new Date(now).toISOString(),
  }, { onConflict: "email" });
  if (saveError) {
    console.error("OTP state save failed:", saveError.message);
    return NextResponse.json({ error: "Unable to save verification state." }, { status: 503 });
  }

  try {
    await sendOtpEmail(email, code, lifetimeSeconds);
  } catch (error) {
    await supabase.from("ftm_email_otps").delete().eq("email", email);
    console.error("OTP email send failed:", error);
    return NextResponse.json({ error: "Unable to send the verification email. Please check the email configuration." }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    message: "A 6-digit verification code was sent to your email.",
    expiresAt,
    expiresInSeconds: lifetimeSeconds,
    resendAvailableAt: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
  });
}