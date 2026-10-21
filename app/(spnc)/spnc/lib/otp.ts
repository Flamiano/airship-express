// Server-only helpers for the email OTP (2FA) step.
// Lives next to lib/supabase.ts, lib/session.ts, lib/audit.ts and lib/authLimiter.ts.
//
// Required env vars (server side):
//   OTP_COOKIE_SECRET_SPNC      long random string used to sign the "password passed" cookie
//   NEXT_PUBLIC_SPNC_URL        used to send/verify the code
//   NEXT_PUBLIC_SPNC_ANON_KEY   used to send/verify the code
//   SUPABASE_SPNC_ROLE_KEY      service-role key (same one lib/supabase.ts uses), used to attach
//                               device/location/IP to the auth user. NEVER give it a NEXT_PUBLIC_ prefix.
//
// Employee emails are read with your existing getSupabaseClient(), the same one /api/login uses.
//
// Never import this file from a "use client" component.

import crypto from "crypto";
import type { NextRequest } from "next/server";
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

// ---------- Request info (device / location / IP shown in the OTP email) ----------

export type RequestInfo = { device: string; location: string; ip: string };

function isPrivateIp(ip: string): boolean {
  return (
    !ip ||
    ip === "Unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fe80")
  );
}

// Fallback for localhost (no Vercel headers). For a private/loopback IP, the lookup services
// use this server's own public IP, which on localhost is your real public IP.
// Tries several free services in order, so one being rate-limited doesn't break it.
type Geo = { ip?: string; location?: string };

async function fetchJson(url: string, ms = 4000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function lookupGeo(ip: string): Promise<Geo | null> {
  const target = isPrivateIp(ip) ? "" : encodeURIComponent(ip);

  const providers: Array<() => Promise<Geo>> = [
    async () => {
      const g = await fetchJson(`https://ipwho.is/${target}`);
      if (g.success === false) throw new Error(g.message || "ipwho.is failed");
      return { ip: g.ip, location: [g.city, g.region, g.country].filter(Boolean).join(", ") };
    },
    async () => {
      const g = await fetchJson(`https://ipapi.co/${target ? target + "/" : ""}json/`);
      if (g.error) throw new Error(g.reason || "ipapi.co failed");
      return { ip: g.ip, location: [g.city, g.region, g.country_name].filter(Boolean).join(", ") };
    },
    async () => {
      const g = await fetchJson(`https://ipinfo.io/${target ? target + "/" : ""}json`);
      if (g.bogon) throw new Error("private address");
      return { ip: g.ip, location: [g.city, g.region, g.country].filter(Boolean).join(", ") };
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result.ip || result.location) return result;
    } catch (e) {
      console.log("[otp] geo provider failed:", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

// The device label sent by the browser is untrusted text that ends up in an email, so keep it short
// and strip anything that isn't a plain letter, number or simple punctuation.
function cleanDeviceLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^A-Za-z0-9 ._+\-()/]/g, "").trim().slice(0, 60);
}

export async function getRequestInfo(req: NextRequest, clientDevice?: unknown): Promise<RequestInfo> {
  const h = req.headers;

  let ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "Unknown";

  const ua = h.get("user-agent") ?? "";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" :
             /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" :
                  /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";

  // Real model / OS version from the browser when it offers it (see deviceHint.ts), else the OS name.
  const deviceName = cleanDeviceLabel(clientDevice) || os;

  // Vercel provides these headers in production.
  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const country = h.get("x-vercel-ip-country");
  let cityName = city ?? "";
  try { cityName = city ? decodeURIComponent(city) : ""; } catch {}
  let location = [cityName, region, country].filter(Boolean).join(", ");

  // Localhost (or anywhere without Vercel headers): look it up.
  if (!location || isPrivateIp(ip)) {
    const geo = await lookupGeo(ip);
    if (geo?.location && !location) location = geo.location;
    if (geo?.ip && isPrivateIp(ip)) ip = geo.ip;
  }

  return { device: `${deviceName} · ${browser}`, location: location || "Unknown", ip };
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

// Service-role client: only for auth.admin calls. Server-side only, never expose this key.
// Uses the same env var names as lib/supabase.ts.
function adminClient() {
  const url = need("NEXT_PUBLIC_SPNC_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "FTM_SUPABASE_URL");
  const key = need(
    "SUPABASE_SPNC_ROLE_KEY",
    "SUPABASE_SPNC_SERVICE_ROLE_KEY",
    "FTM_SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Finds the Supabase Auth user for an email, searching every page of users.
async function findAuthUserByEmail(admin: ReturnType<typeof adminClient>, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
  return null;
}

export async function sendEmailOtp(
  email: string,
  info?: RequestInfo
): Promise<{ error?: string; status?: number }> {
  // Existing Supabase Auth users ignore `data` in signInWithOtp, so write the values to the
  // auth user first. The email template reads them as {{ .Data.device }} etc.
  // If this fails, the code is still sent (the email just shows "Unknown").
  if (info) {
    try {
      const admin = adminClient();
      const authUser = await findAuthUserByEmail(admin, email);

      if (authUser) {
        const { error: updErr } = await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: { ...authUser.user_metadata, ...info },
        });
        if (updErr) throw updErr;
      }
      // No auth user yet: the values go in signInWithOtp `data` below (brand-new users).
    } catch (e) {
      console.error("[otp] FAILED to attach sign-in info (email still sent):", e);
    }
  }

  const { error } = await anonClient().auth.signInWithOtp({
    email,
    // true because employees may not exist in Supabase Auth yet. Supabase is only used to send and
    // check the code; your own session (lib/session.ts) stays the source of truth for who is logged in.
    // NOTE: both the "Confirm signup" and "Magic Link" email templates in Supabase must contain {{ .Token }}.
    // `data` covers brand-new users; the block above covers existing ones.
    options: { shouldCreateUser: true, ...(info ? { data: { ...info } } : {}) },
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