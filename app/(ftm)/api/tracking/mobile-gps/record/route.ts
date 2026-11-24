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
  const { driver_id, vehicle_id, lat, lng, latitude, longitude, speed, heading, accuracy, battery_level, device_type, app_version, status } = body;
  const parsedLat = lat ?? latitude;
  const parsedLng = lng ?? longitude;
  if (!driver_id || parsedLat === undefined || parsedLng === undefined) {
    return NextResponse.json({ error: "driver_id, lat/latitude, and lng/longitude are required" }, { status: 400 });
  }
  const supabase = auth.context.serviceClient;
  const payload = {
    driver_id,
    vehicle_id: vehicle_id || null,
    lat: Number.parseFloat(String(parsedLat)),
    lng: Number.parseFloat(String(parsedLng)),
    speed: speed != null ? Number.parseFloat(String(speed)) : null,
    heading: heading != null ? Number.parseFloat(String(heading)) : null,
    accuracy: accuracy != null ? Number.parseFloat(String(accuracy)) : null,
    battery_level: battery_level != null ? Number.parseInt(String(battery_level), 10) : null,
    device_type: device_type || "unknown",
    app_version: app_version || null,
    status: status || "active",
  };
  let { data, error } = await supabase.from("mobile_device_tracking").insert([payload]).select("*").maybeSingle();
  if (error && /mobile_device_tracking_vehicle_id_fkey/i.test(error.message)) {
    const retry = await supabase.from("mobile_device_tracking").insert([{ ...payload, vehicle_id: null }]).select("*").maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error && /could not find the table\s+'public\.mobile_device_tracking'/i.test(error.message)) {
    await supabase.from("tracking_history").insert([{ tracking_source: "mobile", driver_id: payload.driver_id, vehicle_id: payload.vehicle_id, latitude: payload.lat, longitude: payload.lng, speed: payload.speed, heading: payload.heading, accuracy: payload.accuracy, recorded_at: null }]);
    await supabase.from("driver_tracking").insert([{ driver_id: payload.driver_id, vehicle_id: payload.vehicle_id, trip_id: null, latitude: payload.lat, longitude: payload.lng, speed: payload.speed, heading: payload.heading, is_mock_location: false, recorded_at: null }]);
    return NextResponse.json({ warning: "mobile_device_tracking table missing; wrote fallback tracking records" }, { status: 201 });
  }
  if (error) return NextResponse.json({ error: "Failed to record mobile GPS point", details: error.message || "permission denied for table mobile_device_tracking" }, { status: 500 });

  await supabase.from("driver_tracking").insert([{
    driver_id: data.driver_id,
    vehicle_id: data.vehicle_id || null,
    trip_id: data.trip_id || null,
    latitude: data.lat,
    longitude: data.lng,
    speed: data.speed || null,
    heading: data.heading || null,
    is_mock_location: false,
    recorded_at: data.recorded_at || null,
  }]);
  return NextResponse.json(data, { status: 201 });
}