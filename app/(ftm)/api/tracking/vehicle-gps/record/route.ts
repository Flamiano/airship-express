import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "create")) return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const { vehicle_id, lat, lng, speed, heading, accuracy, signal_strength, battery_level, status, notes } = body;
  if (!vehicle_id || lat === undefined || lng === undefined) return NextResponse.json({ error: "vehicle_id, lat, and lng are required" }, { status: 400 });
  const payload = {
    vehicle_id,
    lat: Number.parseFloat(String(lat)),
    lng: Number.parseFloat(String(lng)),
    speed: speed ? Number.parseFloat(String(speed)) : null,
    heading: heading ? Number.parseFloat(String(heading)) : null,
    accuracy: accuracy ? Number.parseFloat(String(accuracy)) : null,
    signal_strength: signal_strength ? Number.parseInt(String(signal_strength), 10) : null,
    battery_level: battery_level ? Number.parseInt(String(battery_level), 10) : null,
    status: status || "active",
    notes: notes || null,
  };
  const { data, error } = await auth.context.serviceClient.from("vehicle_gps_tracking").insert([payload]).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to record vehicle GPS point", details: error.message || "permission denied for table vehicle_gps_tracking" }, { status: 500 });
  try {
    await auth.context.serviceClient.from("tracking_history").insert([{
      trip_id: data.trip_id || null,
      vehicle_id: data.vehicle_id,
      latitude: data.lat,
      longitude: data.lng,
      speed: data.speed || null,
      recorded_at: data.recorded_at || null,
    }]);
  } catch {
    // Tracking history mirroring is best-effort for older schemas.
  }
  return NextResponse.json(data, { status: 201 });
}