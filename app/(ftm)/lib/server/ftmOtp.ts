import "server-only";
import { createHmac, randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";

const OTP_LIFETIME_OPTIONS = new Set([60, 120, 240, 300, 600]);
export const DEFAULT_OTP_LIFETIME_SECONDS = 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const MAX_OTP_ATTEMPTS = 5;

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode(email: string, code: string) {
  const secret = process.env.FTM_OTP_HASH_SECRET || process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("FTM OTP hashing secret is not configured.");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function getOtpLifetimeSeconds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ftm_security_settings")
    .select("otp_lifetime_seconds")
    .eq("id", true)
    .maybeSingle();
  if (error) console.warn("OTP lifetime lookup failed, using default:", error.message);
  const seconds = Number(data?.otp_lifetime_seconds);
  return OTP_LIFETIME_OPTIONS.has(seconds) ? seconds : DEFAULT_OTP_LIFETIME_SECONDS;
}

export async function sendOtpEmail(email: string, code: string, lifetimeSeconds: number) {
  const subject = "Airship Express MFA verification code";
  const duration = `${Math.ceil(lifetimeSeconds / 60)} minute${lifetimeSeconds >= 120 ? "s" : ""}`;
  const text = `Your Airship Express verification code is ${code}. It expires in ${duration}.`;
  const html = `<div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px"><h2 style="margin:0 0 12px;color:#f472b6">Airship Express MFA</h2><p style="margin:0 0 18px;color:#e2e8f0">Use the code below to complete your verification.</p><div style="display:inline-block;background:#111827;border:1px solid #374151;border-radius:8px;padding:18px 20px;font-size:28px;font-weight:700;letter-spacing:6px;color:#fff">${code}</div><p style="margin-top:18px;color:#cbd5e1">This code expires in ${duration}.</p></div>`;

  const resendApiKey = process.env.FTM_RESEND_API_KEY;
  if (resendApiKey) {
    const from = process.env.FTM_RESEND_FROM;
    if (!from) throw new Error("FTM_RESEND_FROM must be set to a sender address on a verified Resend domain.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `Resend email API returned HTTP ${response.status}.`);
    return;
  }

  const host = process.env.FTM_SMTP_HOST;
  const user = process.env.FTM_SMTP_USER;
  const pass = process.env.FTM_SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("Email is not configured. Set FTM_RESEND_API_KEY and FTM_RESEND_FROM or configure FTM_SMTP_*.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.FTM_SMTP_PORT || 587),
    secure: String(process.env.FTM_SMTP_SECURE || "false").toLowerCase() === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
  await transporter.sendMail({ from: process.env.FTM_SMTP_FROM || user, to: email, subject, text, html });
}