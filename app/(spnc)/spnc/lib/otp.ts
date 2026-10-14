// Server-only helpers for the email OTP (2FA) step.
// Lives next to lib/supabase.ts, lib/session.ts, lib/audit.ts and lib/authLimiter.ts.
//
// Required env vars (server side):
//   OTP_COOKIE_SECRET_SPNC      long random string used to sign the "password passed" cookie
//   NEXT_PUBLIC_SPNC_URL        used to send/verify the code
//   NEXT_PUBLIC_SPNC_ANON_KEY   used to send/verify the code
//
// Employee emails are read with your existing getSupabaseClient(), the same one /api/login uses.
//
// Never import this file from a "use client" component.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

// ---- Adjust if your table/columns are named differently ---------------------
const USERS_TABLE = "users";
const COL_EMPLOYEE_ID = "id_number";
const COL_EMAIL = "email";
// ----------------------------------------------------------------------------

export const OTP_COOKIE = "spnc-otp-pending";
export const PENDING_TTL_SEC = 10 * 60; // password step stays valid for 10 minutes
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/spnc/app";

function need(...names: string[]): string {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  throw new Error(`Missing env var ${names.join(" or ")}`);
}

// ---------- Pending-login cookie (proves the password step was passed) ----------

function sign(payload: string): string {
  return crypto.createHmac("sha256", need("OTP_COOKIE_SECRET_SPNC")).update(payload).digest("base64url");
}

export function createPendingToken(idNumber: string): string {
  const body = Buffer.from(
    JSON.stringify({ id: idNumber, exp: Date.now() + PENDING_TTL_SEC * 1000 })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the Employee ID if the token is valid and not expired, otherwise null. */
export function readPendingToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const { id, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof id !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return id;
  } catch {
    return null;
  }
}

export function pendingCookie(value: string, maxAgeSec = PENDING_TTL_SEC) {
  return {
    name: OTP_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: BASE,
    maxAge: maxAgeSec,
  };
}

// ---------- Supabase ----------

/** Looks up the employee's email in your users table (used by "Resend code"). */
export async function lookupEmail(idNumber: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from(USERS_TABLE)
    .select(COL_EMAIL)
    .eq(COL_EMPLOYEE_ID, idNumber)
    .maybeSingle();

  if (error || !data) return null;
  const email = (data as unknown as Record<string, unknown>)[COL_EMAIL];
  return typeof email === "string" && email.includes("@") ? email : null;
}

function anonClient() {
  return createClient(
    need("NEXT_PUBLIC_SPNC_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    need("NEXT_PUBLIC_SPNC_ANON_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function sendEmailOtp(email: string): Promise<{ error?: string; status?: number }> {
  const { error } = await anonClient().auth.signInWithOtp({
    email,
    // true because employees may not exist in Supabase Auth yet. Supabase is only used to send and
    // check the code; your own session (lib/session.ts) stays the source of truth for who is logged in.
    // NOTE: both the "Confirm signup" and "Magic Link" email templates in Supabase must contain {{ .Token }}.
    options: { shouldCreateUser: true },
  });
  return error ? { error: error.message, status: error.status } : {};
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  const { data, error } = await anonClient().auth.verifyOtp({ email, token: code, type: "email" });
  return !error && !!data.user;
}

export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const shown = name.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}