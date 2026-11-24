import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { isAirshipCourier } from "../../../../lib/server/ftmCourier";
import { normalizeTrip, updateRemoteParcelStatus, validateTripAssignment } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as { driver_id?: string };
  const supabase = context.serviceClient;
  const { data: trip, error: tripError } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (tripError) return NextResponse.json({ error: `Unable to load trip: ${tripError.message}` }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.driver_id || trip.driver_id) {
    try {
      const assignment = await validateTripAssignment(supabase, trip, body.driver_id || trip.driver_id);
      if (!isAirshipCourier(assignment.courier.name || assignment.courier.code)) return NextResponse.json({ error: "Only Airship Express trips can be accepted in VRDS." }, { status: 409 });
      update.driver_id = body.driver_id || trip.driver_id;
      update.driver_name = assignment.driver.full_name || null;
      update.courier_id = assignment.courier.id || trip.courier_id;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Driver is not eligible for this trip." }, { status: 409 });
    }
  }
  update.status = "Scheduled";
  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("trips").update(update).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to accept trip" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (data.booking_id && data.driver_id && data.vehicle_id) {
    const now = new Date().toISOString();
    const { error: assignmentError } = await supabase.from("booking_assignments").upsert({
      booking_id: data.booking_id,
      driver_id: data.driver_id,
      vehicle_id: data.vehicle_id,
      route_plan_id: data.route_plan_id || null,
      assigned_at: now,
      status: "accepted",
      updated_at: now,
    }, { onConflict: "booking_id" });
    if (assignmentError) return NextResponse.json({ error: `Trip accepted, but the shared assignment could not be synchronized: ${assignmentError.message}` }, { status: 500 });
    const { error: bookingError } = await supabase.from("bookings").update({ status: "DRIVER_VEHICLE_ASSIGNED" }).eq("id", data.booking_id);
    if (bookingError) return NextResponse.json({ error: `Trip accepted, but the booking status could not be synchronized: ${bookingError.message}` }, { status: 500 });
  }
  if (data.booking_id) {
    const parcelSyncError = await updateRemoteParcelStatus(supabase, data.booking_id, "in_transit");
    if (parcelSyncError) {
      return NextResponse.json({
        error: "Trip accepted, but its linked parcels could not be marked in transit.",
        details: parcelSyncError,
        trip_id: data.id,
      }, { status: 500 });
    }
  }
  return NextResponse.json(normalizeTrip(data));
}