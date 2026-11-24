import { NextResponse } from "next/server";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";
const DEFAULT_LIFETIME = 60;
const ALLOWED_LIFETIMES = new Set([60, 120, 240, 300, 600]);

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { data, error } = await auth.context.serviceClient.from("ftm_security_settings").select("otp_lifetime_seconds").eq("id", true).maybeSingle();
  if (error) console.warn("OTP policy fetch failed:", error.message);
  const value = Number(data?.otp_lifetime_seconds);
  return NextResponse.json({ otpLifetimeSeconds: ALLOWED_LIFETIMES.has(value) ? value : DEFAULT_LIFETIME });
}

export async function PATCH(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!["admin", "fleet_manager"].includes(auth.context.user.role)) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }
  let body: { otpLifetimeSeconds?: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const lifetime = Number(body.otpLifetimeSeconds);
  if (!ALLOWED_LIFETIMES.has(lifetime)) {
    return NextResponse.json({ error: "OTP expiration must be 1, 2, 4, 5, or 10 minutes." }, { status: 400 });
  }
  const supabase = auth.context.serviceClient;
  const payload = { id: true, otp_lifetime_seconds: lifetime, updated_at: new Date().toISOString(), updated_by: auth.context.user.id };
  let { error } = await supabase.from("ftm_security_settings").upsert(payload, { onConflict: "id" });
  if (error && /updated_by|foreign key|schema cache|column .* does not exist/i.test(error.message)) {
    ({ error } = await supabase.from("ftm_security_settings").upsert({ id: true, otp_lifetime_seconds: lifetime, updated_at: payload.updated_at }, { onConflict: "id" }));
  }
  if (error) return NextResponse.json({ error: "Unable to save the OTP expiration policy.", details: error.message }, { status: 500 });
  return NextResponse.json({ otpLifetimeSeconds: lifetime });
}