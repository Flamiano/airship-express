"use server";

import { createClient } from "../library/supabase/server";
import { sendMfaCodeEmail } from "../lib/email/sendMfaCode";
import { generateOtp, hashOtp, verifyOtp } from "../lib/utils/otp";
import { recordAudit } from "../services/audit.service";
import { Const } from "three/src/nodes/core/VarNode.js";

export interface MfaActionResult {
  success: boolean;
  error?: string;
  mfaRequired?: boolean;
  backupCodes?: string[];
  retryAfterSeconds?: number;
}


const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_SENDS_PER_WINDOW = 3;
const OTP_WINDOW_MINUTES = 3;

/** OTP must be digits only - no letters, symbols or spaces. */
const OTP_DIGITS = /^[0-9]{6,8}$/;

function canSendOtp(profile: { mfa_otp_sent_count: number; mfa_otp_last_sent_at: string | null }): { allowed: boolean; retryAfterSeconds?: number; windowExpired?: boolean } {
  if (!profile.mfa_otp_last_sent_at) return { allowed: true };

  const lastSent = new Date(profile.mfa_otp_last_sent_at).getTime();
  const windowStart = Date.now() - OTP_WINDOW_MINUTES * 60 * 1000;

  if (lastSent < windowStart) return { allowed: true, windowExpired: true }; // Window expired, reset count
  if (profile.mfa_otp_sent_count < MAX_OTP_SENDS_PER_WINDOW) return { allowed: true };

  // Calculate remaining seconds in window
  const windowEnd = lastSent + OTP_WINDOW_MINUTES * 60 * 1000;
  const retryAfterSeconds = Math.ceil((windowEnd - Date.now()) / 1000);
  return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };

}

/**
 * Send an OTP to the given authenticated user.
 * The rate-limit counters live on the profile row keyed by Supabase user id,
 * so the counter is strictly per-user and never shared between staff/customers.
 */
export async function sendMfaCode(
  userId: string,
  purpose: "login" | "enable" | "disable" = "login"
): Promise<MfaActionResult> {
  const supabase = await createClient();

  // Look up by authenticated user id - never by a client-supplied email
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, mfa_enabled, mfa_otp_sent_count, mfa_otp_last_sent_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Account not found" };
  }

  if (!profile.email) {
    return { success: false, error: "User email not found" };
  }

  // Rate limiting - per profile row (per user)
  const rateLimit = canSendOtp(profile);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.retryAfterSeconds || 0) / 60);
    return {
      success: false,
      error: `Too many attempts. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds
    };
  }

  // Generate OTP
  const otp = generateOtp(6);
  const otpHash = await hashOtp(otp);
  // expiresAt is used for email template (OTP_EXPIRY_MINUTES)

  // Store hashed OTP in mfa_secret_hash (reused for login OTP)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      mfa_secret_hash: otpHash,
      mfa_otp_sent_count: (rateLimit.windowExpired ? 0 : profile.mfa_otp_sent_count) + 1,
      mfa_otp_last_sent_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("MFA OTP store error:", updateError);
    return { success: false, error: "Failed to send code" };
  }

  // Send email to the profile's own address
  const emailResult = await sendMfaCodeEmail({
    to: profile.email,
    otp,
    userName: profile.full_name || undefined,
    expiresIn: OTP_EXPIRY_MINUTES,
    purpose,
  });

  if (!emailResult.success) {
    console.error("MFA email send error:", emailResult.error);
    return { success: false, error: "Failed to send email" };
  }

  return { success: true };
}

/**
 * Verify an OTP for the given authenticated user.
 * @param userId - authenticated Supabase user id 
 */
export async function verifyMfaCode(
  userId: string,
  code: string,
  purpose: "login" | "enable" | "disable" = "login"
): Promise<MfaActionResult> {
  // Server-side format validation: digits only (backup codes are 8 digits)
  if (!code || !OTP_DIGITS.test(code)) {
    return { success: false, error: "Invalid code" };
  }

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, mfa_secret_hash, mfa_enabled, mfa_backup_codes")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Account not found" };
  }

  if (!profile.mfa_secret_hash) {
    return { success: false, error: "No pending MFA code" };
  }

  // Verify OTP
  let isValid = await verifyOtp(code, profile.mfa_secret_hash);

  // Also check backup codes for disable purpose
  let usedBackupCode = false;
  if (!isValid && purpose === "disable" && profile.mfa_backup_codes?.length) {
    for (const backupHash of profile.mfa_backup_codes) {
      if (await verifyOtp(code, backupHash)) {
        isValid = true;
        usedBackupCode = true;
        break;
      }
    }
  }

  if (!isValid) {
    return { success: false, error: "Invalid or expired code" };
  }

  // Clear OTP hash on successful verification (for login/enable)
  if (purpose !== "disable" || usedBackupCode) {
    await supabase
      .from("profiles")
      .update({ mfa_secret_hash: null })
      .eq("id", profile.id);
  }

  // If disabling MFA with backup code, remove that backup code
  if (purpose === "disable" && usedBackupCode) {
    const codeHash = await hashOtp(code);
    const updatedBackups = profile.mfa_backup_codes.filter(
      (h: string) => h !== codeHash
    );
    await supabase
      .from("profiles")
      .update({ mfa_backup_codes: updatedBackups })
      .eq("id", profile.id);
  }

  return { success: true };
}

export async function enableMfaWithPassword(
  userId: string,
  password: string
): Promise<MfaActionResult> {
  const supabase = await createClient();

  // Get profile with email for password verification
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, mfa_enabled")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Profile not found" };
  }

  if (profile.mfa_enabled) {
    return { success: false, error: "MFA already enabled" };
  }

  // Verify password via Supabase auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (authError) {
    return { success: false, error: "Invalid password" };
  }


  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      mfa_enabled: true,
      mfa_email_verified: false,
      mfa_secret_hash: null,
      mfa_backup_codes: [],
      mfa_last_used_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("MFA enable error:", updateError);
    return { success: false, error: "Failed to enable MFA" };
  }

  await recordAudit({
    action: "mfa.enabled",
    targetType: "profile",
    targetId: userId,
    description: "Multi-factor authentication enabled",
  });

  // Send MFA enabled notification email
  try {
    //const transporter = (await import("../lib/email/sendMfaCode")).getTransporter?.();
    // Use nodemailer directly for custom notification
    const nodemailer = (await import("nodemailer")).default;
    const mailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "crbc.airshipexpress@gmail.com",
        pass: "oetcyjmonkbxfeeq",
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
const EMAIL_CRBC_USER = "crbc.airshipexpress@gmail.com"
const EMAIL_CRBC_FROM_NAME = "Airship Express CRBC"
    await mailTransporter.sendMail({
      from: `"${EMAIL_CRBC_FROM_NAME}" <${EMAIL_CRBC_USER}>`,
      to: profile.email,
      subject: "Your MFA has been enabled",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 40px auto; padding: 0 20px;">
            <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden;">
              <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">MFA Enabled</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Two-factor authentication is now active</p>
              </div>
              <div style="padding: 32px;">
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                  ${profile.full_name ? `Hi ${profile.full_name},` : "Hi,"}
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                  Two-factor authentication (2FA) has been successfully enabled on your Airship Express CRBC account.
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                  From now on, you'll need to enter a verification code sent to your email each time you sign in.
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                  If you didn't enable MFA, please contact support immediately.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
                  Airship Express<br>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
MFA Enabled

${profile.full_name ? `Hi ${profile.full_name},` : "Hi,"}

Two-factor authentication (2FA) has been successfully enabled on your Airship Express CRBC account.

From now on, you'll need to enter a verification code sent to your email each time you sign in.

If you didn't enable MFA, please contact support immediately.

---
Airship Express CRBC
      `.trim(),
    });
  } catch (emailError) {
    console.error("MFA enabled notification email failed:", emailError);
    // Don't fail the MFA enable if email fails
  }

  return { success: true };
}

export async function disableMfa(
  userId: string,
  code: string,
  password: string // Re-verify password for security
): Promise<MfaActionResult> {
  const supabase = await createClient();

  // First verify password
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, mfa_enabled, mfa_backup_codes")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Profile not found" };
  }

  if (!profile.mfa_enabled) {
    return { success: false, error: "MFA not enabled" };
  }

  // Verify password via Supabase
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (authError) {
    return { success: false, error: "Invalid password" };
  }

  // Verify MFA code (can be OTP or backup code) against the authenticated user id
  const verifyResult = await verifyMfaCode(userId, code, "disable");
  if (!verifyResult.success) {
    return verifyResult;
  }

  // Disable MFA
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      mfa_enabled: false,
      mfa_email_verified: false,
      mfa_secret_hash: null,
      mfa_backup_codes: [],
    })
    .eq("id", userId);

  if (updateError) {
    console.error("MFA disable error:", updateError);
    return { success: false, error: "Failed to disable MFA" };
  }

  await recordAudit({
    action: "mfa.disabled",
    targetType: "profile",
    targetId: userId,
    description: "Multi-factor authentication disabled",
  });

  return { success: true };
}

export async function resendMfaCode(userId: string): Promise<MfaActionResult> {
  return sendMfaCode(userId, "login");
}