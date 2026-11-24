import { NextResponse } from "next/server";
import { createFtmAuthClient, createFtmServiceClient } from "../../../../lib/server/ftmSupabase";
import { getAirshipCouriers } from "../../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

function normalizeDriver(value: unknown) {
  const user = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const email = typeof user.email === "string" ? user.email : "";
  return { ...user, fullName: user.full_name || user.fullName || email.split("@")[0] || "Driver", phone: user.phone || null, role: user.role || "driver", vehicleId: user.vehicle_id || user.vehicleId || null };
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string; full_name?: string; phone?: string; courier_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const { email, password, full_name, phone, courier_id } = body;
  if (!email || !password || !full_name || !courier_id) {
    return NextResponse.json({ error: "Email, password, full name, and courier_id are required" }, { status: 400 });
  }
  const authClient = createFtmAuthClient();
  const service = createFtmServiceClient();
  if (!service) return NextResponse.json({ error: "Auth service is not configured" }, { status: 503 });

  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(service)).find((courier) => courier.id === courier_id); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Airship Express courier." }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "Drivers can only be registered for Airship Express." }, { status: 400 });

  const metadata = { full_name, phone, role: "driver", courier_id: airshipCourier.id };
  const created = process.env.NODE_ENV === "production"
    ? await authClient.auth.signUp({ email, password, options: { data: metadata } })
    : await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (created.error) {
    const forbidden = /permission denied|not authorized|rls|jwt/i.test(created.error.message);
    return NextResponse.json({ error: forbidden ? "Supabase auth permission denied. Configure Supabase auth and RLS policies." : created.error.message }, { status: forbidden ? 500 : 400 });
  }
  const user = created.data.user;
  if (!user?.id) return NextResponse.json({ error: "Account creation did not return a user" }, { status: 500 });

  const profile = {
    id: user.id,
    email: user.email || email,
    full_name,
    phone: phone || null,
    role: "driver",
    courier_id: airshipCourier.id,
    vehicle_id: null,
  };
  const { data, error } = await service.from("users").upsert([profile], { onConflict: "id" }).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ user: normalizeDriver(profile), profilePending: true, message: "Driver account created. Your dispatcher can complete the profile assignment." }, { status: 201 });
  }
  const production = process.env.NODE_ENV === "production";
  return NextResponse.json({
    user: normalizeDriver(data || profile),
    message: production ? "Driver registered successfully. Check your email for confirmation." : "Driver account created and confirmed for local testing.",
  }, { status: 201 });
}