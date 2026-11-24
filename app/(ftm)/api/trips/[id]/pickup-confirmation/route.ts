import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../../lib/server/ftmSupabase";
import { normalizeTrip, updateRemoteParcelStatus } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }

  let body: { driver_id?: string; proof_url?: string; manifest_verified?: boolean; picked_up_parcel_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.proof_url || body.manifest_verified !== true) {
    return NextResponse.json({ error: "Pickup proof and manifest verification are required before starting the trip." }, { status: 400 });
  }

  const { data: trip, error: tripError } = await context.serviceClient.from("trips").select("*").eq("id", id).maybeSingle();
  if (tripError) return NextResponse.json({ error: `Unable to load trip: ${tripError.message}` }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (body.driver_id && trip.driver_id && String(body.driver_id) !== String(trip.driver_id)) {
    return NextResponse.json({ error: "Only the assigned driver can confirm this pickup." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data, error } = await context.serviceClient.from("trips").update({
    pickup_status: "confirmed",
    pickup_proof_url: body.proof_url,
    pickup_confirmed_at: now,
    status: "Pickup Confirmed",
  }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: `Unable to confirm pickup: ${error.message}` }, { status: 500 });

  if (trip.booking_id) {
    const [{ error: bookingError }, { error: assignmentError }] = await Promise.all([
      context.serviceClient.from("bookings").update({ status: "Picked Up" }).eq("id", trip.booking_id),
      context.serviceClient.from("booking_assignments").update({ status: "accepted", updated_at: now }).eq("booking_id", trip.booking_id),
    ]);
    const syncError = bookingError || assignmentError;
    if (syncError) {
      return NextResponse.json({ error: `Pickup was recorded, but related records could not be synchronized: ${syncError.message}` }, { status: 500 });
    }
    await updateRemoteParcelStatus(context.serviceClient, trip.booking_id, "picked_up");
  }
  if (body.picked_up_parcel_ids?.length) {
    const parcels = createFtmParcelClient();
    if (parcels) await parcels.from("parcels").update({ status: "picked_up" }).in("id", body.picked_up_parcel_ids);
  }
  return NextResponse.json(normalizeTrip(data));
}