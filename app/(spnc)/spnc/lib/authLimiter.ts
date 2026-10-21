// Server-only brute-force protection for the password step and the email-code step.
// Lives next to lib/supabase.ts, lib/otp.ts, lib/session.ts and lib/audit.ts.
// Requires sql/auth_attempts.sql to have been run, and getSupabaseClient() must use the
// SERVICE ROLE key (the table is locked down for anon/authenticated).
//
// If the limiter itself errors (e.g. table not created yet) it logs loudly and lets the request
// continue, so a missing table never locks everyone out. Check your server logs after deploying.
//
// Never import this file from a "use client" component.

import { NextResponse } from "next/server";
import { getSupabaseClient } from "./supabase";

// Password step lock kinds:
//   pw  = employee account   -> no timer: stays locked until an admin clicks Unlock
//   pwa = admin account      -> 5 minutes, clears by itself
//   pwx = Employee ID that does not exist (typo) -> 5 minutes, clears by itself
// otp = the emailed-code step -> 15 minutes
// otpsend = counts presses of "Resend code"; reaching the limit locks the whole account.
export type LimitKind = "pw" | "pwa" | "pwx" | "otp" | "otpsend";

// "No timer" is stored as a very long lock (10 years), so no SQL change is needed.
export const ADMIN_UNLOCK_SECONDS = 10 * 365 * 24 * 60 * 60;
const ADMIN_LOCK_THRESHOLD_SECONDS = 24 * 60 * 60; // longer than a day = "an admin must unlock it"

export const LIMITS: Record<LimitKind, { maxFailures: number; lockSeconds: number }> = {
  pw: { maxFailures: 5, lockSeconds: ADMIN_UNLOCK_SECONDS },
  pwa: { maxFailures: 5, lockSeconds: 5 * 60 },
  pwx: { maxFailures: 5, lockSeconds: 5 * 60 },
  otp: { maxFailures: 5, lockSeconds: 15 * 60 },
  otpsend: { maxFailures: 5, lockSeconds: 60 }, // only used as a counter; see lockAccount()
};

const PASSWORD_KINDS: LimitKind[] = ["pw", "pwa", "pwx"];
const TABLE = "auth_attempts";

function keyFor(kind: LimitKind, idNumber: string): string {
  return `${kind}:${idNumber.trim().toLowerCase()}`;
}

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Seconds left on an active lock, or 0 if not locked. */
export async function getLockRemaining(kind: LimitKind, idNumber: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from(TABLE)
    .select("locked_until")
    .eq("key", keyFor(kind, idNumber))
    .maybeSingle();

  if (error) {
    console.error("authLimiter: lock check failed (continuing without limit):", error.message);
    return 0;
  }
  return secondsUntil(data?.locked_until as string | null | undefined);
}

/** Longest active password lock for this ID (employee, admin or unknown-ID), or 0. */
export async function getPasswordLockRemaining(idNumber: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from(TABLE)
    .select("locked_until")
    .in(
      "key",
      PASSWORD_KINDS.map((k) => keyFor(k, idNumber))
    );

  if (error) {
    console.error("authLimiter: lock check failed (continuing without limit):", error.message);
    return 0;
  }
  return Math.max(0, ...(data ?? []).map((row) => secondsUntil(row.locked_until as string | null)));
}

/** Records one failure. Returns seconds locked for if this failure triggered a lock, else 0. */
export async function registerFailure(kind: LimitKind, idNumber: string): Promise<number> {
  const { maxFailures, lockSeconds } = LIMITS[kind];
  const { data, error } = await getSupabaseClient().rpc("register_auth_failure", {
    p_key: keyFor(kind, idNumber),
    p_max: maxFailures,
    p_lock_seconds: lockSeconds,
  });

  if (error) {
    console.error("authLimiter: registerFailure failed (continuing without limit):", error.message);
    return 0;
  }
  return secondsUntil(data as string | null);
}

/**
 * Locks the account right now (same lock as 5 wrong passwords: employee = until an admin
 * unlocks, admin = 5 minutes). Used when "Resend code" is pressed too many times.
 * Returns the seconds locked for.
 */
export async function lockAccount(kind: "pw" | "pwa", idNumber: string): Promise<number> {
  const { lockSeconds } = LIMITS[kind];
  const { data, error } = await getSupabaseClient().rpc("register_auth_failure", {
    p_key: keyFor(kind, idNumber),
    p_max: 1, // one failure is enough to trigger the lock
    p_lock_seconds: lockSeconds,
  });
  if (error) {
    console.error("authLimiter: lockAccount failed:", error.message);
    return 0;
  }
  return secondsUntil(data as string | null);
}

/** Clears the counter after a success. */
export async function clearFailures(kind: LimitKind, idNumber: string): Promise<void> {
  const { error } = await getSupabaseClient().from(TABLE).delete().eq("key", keyFor(kind, idNumber));
  if (error) console.error("authLimiter: clearFailures failed:", error.message);
}

/** Which of these Employee IDs have a locked password step? Returns lowercase, trimmed IDs. */
export async function getLockedIdNumbers(idNumbers: string[]): Promise<Set<string>> {
  const locked = new Set<string>();
  const ids = idNumbers.map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) return locked;

  const keys = ids.flatMap((id) => (["pw", "pwa"] as LimitKind[]).map((k) => keyFor(k, id)));
  const { data, error } = await getSupabaseClient().from(TABLE).select("key, locked_until").in("key", keys);

  if (error) {
    console.error("authLimiter: listing locked accounts failed:", error.message);
    return locked;
  }
  for (const row of data ?? []) {
    if (secondsUntil(row.locked_until as string | null) > 0) {
      const key = String(row.key);
      locked.add(key.slice(key.indexOf(":") + 1));
    }
  }
  return locked;
}

/** Admin unlock: clears the password locks and the email-code lock for this Employee ID. */
export async function unlockAccount(idNumber: string): Promise<void> {
  await clearFailures("pw", idNumber);
  await clearFailures("pwa", idNumber);
  await clearFailures("otp", idNumber);
  await clearFailures("otpsend", idNumber);
}

/**
 * Standard 429 response for a locked account.
 * `hideTime: true` (used for the password step) keeps the "account locked" message without
 * minutes, but now also sends `retryAfterSeconds` so the login page can show a countdown.
 * retryAfterSeconds is null when an admin has to unlock the account (no timer).
 * The email-code step keeps the "try again in X minutes" message.
 */
export function lockedResponse(seconds: number, hideTime = false): NextResponse {
  if (hideTime || seconds > ADMIN_LOCK_THRESHOLD_SECONDS) {
    const needsAdmin = seconds > ADMIN_LOCK_THRESHOLD_SECONDS;
    return NextResponse.json(
      {
        locked: true,
        retryAfterSeconds: needsAdmin ? null : seconds,
        message: "Your account is locked after too many failed attempts. Please contact SPNC Admin to unlock it.",
      },
      { status: 429 }
    );
  }

  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return NextResponse.json(
    {
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}