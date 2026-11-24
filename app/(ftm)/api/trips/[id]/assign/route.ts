import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { isAirshipCourier } from "../../../../lib/server/ftmCourier";
import { normalizeTrip, notifyDriverTripAssigned, updateTripResources, validateTripAssignment } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }

  let body: { driver_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.driver_id) return NextResponse.json({ error: "driver_id is required" }, { status: 400 });

  const supabase = context.serviceClient;
  const { data: trip, error: tripError } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (tripError) return NextResponse.json({ error: `Unable to load trip: ${tripError.message}` }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  let assignment;
  try {
    assignment = await validateTripAssignment(supabase, trip, body.driver_id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Driver is not eligible for this trip." }, { status: 409 });
  }
  if (!isAirshipCourier(assignment.courier.name || assignment.courier.code)) return NextResponse.json({ error: "Only Airship Express trips can be assigned from VRDS." }, { status: 409 });
  const { data, error } = await supabase.from("trips").update({
    driver_id: body.driver_id,
    driver_name: assignment.driver.full_name || null,
    courier_id: assignment.courier.id || trip.courier_id,
    status: "Driver Assigned",
  }).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to assign trip" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (data.booking_id && data.vehicle_id) {
    const assignedAt = new Date().toISOString();
    const { error: assignmentError } = await supabase.from("booking_assignments").upsert({
      booking_id: data.booking_id,
      driver_id: data.driver_id,
      vehicle_id: data.vehicle_id,
      route_plan_id: data.route_plan_id || null,
      assigned_at: assignedAt,
      status: "assigned",
      updated_at: assignedAt,
    }, { onConflict: "booking_id" });
    if (assignmentError) return NextResponse.json({ error: `Trip was assigned, but the shared booking assignment could not be saved: ${assignmentError.message}` }, { status: 500 });
    const { error: bookingError } = await supabase.from("bookings").update({
      driver_id: data.driver_id,
      driver_name: data.driver_name,
      vehicle_id: data.vehicle_id,
      vehicle_plate: data.vehicle_plate,
      status: "Dispatched",
    }).eq("id", data.booking_id);
    if (bookingError) return NextResponse.json({ error: `Trip was assigned, but the booking could not be synchronized: ${bookingError.message}` }, { status: 500 });
  }
  await notifyDriverTripAssigned(supabase, data);
  await updateTripResources(supabase, { driverId: data.driver_id, vehicleId: data.vehicle_id }, "Assigned");
  return NextResponse.json(normalizeTrip(data));
}