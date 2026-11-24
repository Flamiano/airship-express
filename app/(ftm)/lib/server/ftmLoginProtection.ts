import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function getLoginLock(supabase: SupabaseClient | null, email: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.from("ftm_login_attempts").select("attempts, locked_until").eq("email", email).maybeSingle();
  if (error) {
    if (/Could not find the table 'public\.ftm_login_attempts'|schema cache/i.test(error.message)) {
      console.warn("Login lockout migration is not applied; durable account lockout is unavailable.");
      return null;
    }
    throw error;
  }
  if (!data?.locked_until) return null;
  const lockedUntil = new Date(data.locked_until).getTime();
  if (!Number.isFinite(lockedUntil) || lockedUntil <= Date.now()) return null;
  return { lockedUntil, retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000), attemptsRemaining: 0 };
}

export async function recordFailedLogin(supabase: SupabaseClient | null, email: string) {
  if (!supabase) return { locked: false, retryAfterSeconds: 0, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  const current = await getLoginLock(supabase, email);
  if (current) return { locked: true, retryAfterSeconds: current.retryAfterSeconds, attemptsRemaining: 0 };
  const { data: existing, error: readError } = await supabase.from("ftm_login_attempts").select("attempts, locked_until").eq("email", email).maybeSingle();
  if (readError) {
    if (/Could not find the table 'public\.ftm_login_attempts'|schema cache/i.test(readError.message)) return { locked: false, retryAfterSeconds: 0, attemptsRemaining: MAX_FAILED_ATTEMPTS };
    throw readError;
  }
  const attempts = Number(existing?.attempts || 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = locked ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
  const { error } = await supabase.from("ftm_login_attempts").upsert({
    email,
    attempts: locked ? 0 : attempts,
    locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });
  if (error) {
    if (!/Could not find the table 'public\.ftm_login_attempts'|schema cache/i.test(error.message)) throw error;
    return { locked: false, retryAfterSeconds: 0, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }
  return { locked, retryAfterSeconds: locked ? Math.ceil(LOCKOUT_MS / 1000) : 0, attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - attempts) };
}

export async function clearLoginFailures(supabase: SupabaseClient | null, email: string) {
  if (!supabase) return;
  const { error } = await supabase.from("ftm_login_attempts").delete().eq("email", email);
  if (error && !/Could not find the table 'public\.ftm_login_attempts'|schema cache/i.test(error.message)) {
    console.warn("Unable to clear login failure state:", error.message);
  }
}