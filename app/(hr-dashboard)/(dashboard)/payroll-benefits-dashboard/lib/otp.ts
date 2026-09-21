import "server-only";
import crypto from "crypto";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

const TTL_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 5;
const CODE_LENGTH = 6;
const SESSION_MINUTES = 5;

export type OtpPurpose =
  | "merit"
  | "bonus"
  | "merit_delete"
  | "bonus_delete"
  | "benefit"
  | "benefit_delete"
  | "claim"
  | "claim_delete";

export type OtpScope = "all";

function hashCode(code: string): string {
  const secret = process.env.OTP_SECRET || "fallback-dev-secret";
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

export function generateCode(): string {
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH - 1;
  return String(crypto.randomInt(min, max + 1));
}

export async function getActiveLock(adminId: string): Promise<{
  locked: boolean;
  unlockAt: Date | null;
  minutesLeft: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("hr_admin_otp_lock")
    .select("locked_until")
    .eq("admin_id", adminId)
    .maybeSingle();

  if (error || !data) return { locked: false, unlockAt: null, minutesLeft: 0 };

  const unlockAt = new Date(data.locked_until);
  const diff = unlockAt.getTime() - Date.now();
  if (diff <= 0) {
    await supabaseAdmin
      .from("hr_admin_otp_lock")
      .delete()
      .eq("admin_id", adminId);
    return { locked: false, unlockAt: null, minutesLeft: 0 };
  }
  return {
    locked: true,
    unlockAt,
    minutesLeft: Math.ceil(diff / 60000),
  };
}

export async function lockAdmin(adminId: string, purpose: OtpPurpose) {
  const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
  await supabaseAdmin.from("hr_admin_otp_lock").upsert(
    {
      admin_id: adminId,
      purpose,
      locked_until: lockedUntil.toISOString(),
      locked_at: new Date().toISOString(),
    },
    { onConflict: "admin_id" }
  );
  return lockedUntil;
}

export async function createOtp({
  adminId,
  email,
  purpose,
}: {
  adminId: string;
  email: string;
  purpose: OtpPurpose;
}): Promise<{ code: string; expiresAt: Date }> {
  await supabaseAdmin
    .from("hr_admin_otp")
    .update({ consumed_at: new Date().toISOString() })
    .eq("admin_id", adminId)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  const { error } = await supabaseAdmin.from("hr_admin_otp").insert({
    admin_id: adminId,
    email,
    purpose,
    code_hash: codeHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(error.message);
  return { code, expiresAt };
}

export async function verifyOtp({
  adminId,
  purpose,
  code,
  email,
  adminName,
}: {
  adminId: string;
  purpose: OtpPurpose;
  code: string;
  email: string;
  adminName: string;
}): Promise<{
  ok: boolean;
  reason?: string;
  locked?: boolean;
  minutesLeft?: number;
}> {
  const lock = await getActiveLock(adminId);
  if (lock.locked) {
    return {
      ok: false,
      reason: "locked",
      locked: true,
      minutesLeft: lock.minutesLeft,
    };
  }

  const { data: rows, error } = await supabaseAdmin
    .from("hr_admin_otp")
    .select("*")
    .eq("admin_id", adminId)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return { ok: false, reason: "database_error" };
  if (!rows || rows.length === 0)
    return { ok: false, reason: "no_active_code" };

  const otp = rows[0];

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("hr_admin_otp")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);
    return { ok: false, reason: "expired" };
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  if (otp.code_hash !== hashCode(code)) {
    const nextAttempts = otp.attempts + 1;

    await supabaseAdmin
      .from("hr_admin_otp")
      .update({ attempts: nextAttempts })
      .eq("id", otp.id);

    if (nextAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = await lockAdmin(adminId, purpose);
      const { sendLockAlertEmail } = await import("./mailer");
      try {
        await sendLockAlertEmail({
          to: email,
          adminName,
          unlockTime: lockedUntil,
        });
      } catch (err) {
        console.error("[otp] failed to send lock alert email", err);
      }
      return {
        ok: false,
        reason: "locked_after_max_attempts",
        locked: true,
        minutesLeft: LOCK_MINUTES,
      };
    }

    return {
      ok: false,
      reason: "invalid_code",
      locked: false,
      minutesLeft: 0,
    };
  }

  await supabaseAdmin
    .from("hr_admin_otp")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", otp.id);

  await supabaseAdmin
    .from("hr_admin_otp_lock")
    .delete()
    .eq("admin_id", adminId);

  return { ok: true };
}

export async function createSession(
  adminId: string,
  scope: OtpScope = "all"
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000);

  await supabaseAdmin
    .from("hr_admin_otp_session")
    .delete()
    .eq("admin_id", adminId);

  const { data, error } = await supabaseAdmin
    .from("hr_admin_otp_session")
    .insert({
      admin_id: adminId,
      scope,
      expires_at: expiresAt.toISOString(),
    })
    .select("token")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create OTP session");
  }

  return { token: data.token as string, expiresAt };
}

export async function getActiveSession(adminId: string): Promise<{
  active: boolean;
  token: string | null;
  scope: OtpScope | null;
  expiresAt: Date | null;
  secondsLeft: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("hr_admin_otp_session")
    .select("token, scope, expires_at")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      active: false,
      token: null,
      scope: null,
      expiresAt: null,
      secondsLeft: 0,
    };
  }

  const expiresAt = new Date(data.expires_at);
  const diff = expiresAt.getTime() - Date.now();

  if (diff <= 0) {
    await supabaseAdmin
      .from("hr_admin_otp_session")
      .delete()
      .eq("admin_id", adminId);
    return {
      active: false,
      token: null,
      scope: null,
      expiresAt: null,
      secondsLeft: 0,
    };
  }

  return {
    active: true,
    token: data.token as string,
    scope: data.scope as OtpScope,
    expiresAt,
    secondsLeft: Math.ceil(diff / 1000),
  };
}

export async function clearSession(adminId: string): Promise<void> {
  await supabaseAdmin
    .from("hr_admin_otp_session")
    .delete()
    .eq("admin_id", adminId);
}

export async function validateSession(
  adminId: string,
  token: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("hr_admin_otp_session")
    .select("expires_at")
    .eq("admin_id", adminId)
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

export const OTP_TTL_MINUTES = TTL_MINUTES;
export const OTP_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const OTP_LOCK_MINUTES = LOCK_MINUTES;
export const OTP_SESSION_MINUTES = SESSION_MINUTES;
