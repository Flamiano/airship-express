import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { normalizeTrip, updateTripStatus, validateTripAssignment } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }

  const { data: trip, error } = await context.serviceClient.from("trips").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: `Unable to load trip: ${error.message}` }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.pickup_status !== "confirmed") {
    return NextResponse.json({ error: "Pickup proof and manifest verification are required before starting the delivery trip." }, { status: 409 });
  }
  try {
    await validateTripAssignment(context.serviceClient, trip);
  } catch (validationError) {
    return NextResponse.json({ error: validationError instanceof Error ? validationError.message : "The current driver and vehicle are no longer eligible to dispatch this trip." }, { status: 409 });
  }

  const result = await updateTripStatus(context.serviceClient, id, "In Transit", 5, { pickupStatus: "started", bookingId: trip.booking_id });
  if (result.error) return NextResponse.json({ error: `Unable to update trip: ${result.error.message}` }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  return NextResponse.json(normalizeTrip(result.data));
}