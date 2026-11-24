import { NextResponse } from "next/server";
import { createFtmServiceClient } from "../../../../../lib/server/ftmSupabase";

export const dynamic = "force-dynamic";

function normalizeDriver(value: unknown) {
  const record = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const email = typeof record.email === "string" ? record.email : "";
  return { ...record, fullName: record.full_name || record.fullName || email.split("@")[0] || "Driver", phone: record.phone || null, role: record.role || "driver", vehicleId: record.vehicle_id || record.vehicleId || null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const supabase = createFtmServiceClient();
  if (!supabase) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  const { data, error } = await supabase.from("users").select("*").eq("id", driverId).maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to fetch driver profile" }, { status: 500 });
  if (data) return NextResponse.json(normalizeDriver(data));

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(driverId);
  if (authError || !authData.user) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  const user = authData.user;
  const metadata = user.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata
    : {};
  const email = user.email || "";
  const fallback = {
    id: user.id,
    email: user.email,
    full_name: metadata.full_name || email.split("@")[0] || "Driver",
    phone: metadata.phone || null,
    role: metadata.role || "driver",
    courier_id: metadata.courier_id || null,
    vehicle_id: null,
  };
  const { data: restored, error: restoreError } = await supabase.from("users").upsert([fallback], { onConflict: "id" }).select("*").maybeSingle();
  if (!restoreError && restored) return NextResponse.json(normalizeDriver(restored));
  return NextResponse.json({ ...normalizeDriver(fallback), profilePending: true });
}