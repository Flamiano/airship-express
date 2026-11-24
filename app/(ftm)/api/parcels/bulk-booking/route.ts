import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../lib/server/ftmSupabase";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers, isAirshipCourier } from "../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "create")) {
    return NextResponse.json({ error: "Permission denied: vrds.create" }, { status: 403 });
  }

  let body: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!isJsonRecord(parsed)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const requestedCourier = body.courier;
  if (requestedCourier && !isAirshipCourier(requestedCourier)) return NextResponse.json({ error: "Bulk bookings can only be created for Airship Express." }, { status: 400 });
  const requestedIds = Array.isArray(body.parcel_ids)
    ? body.parcel_ids.filter((id): id is string | number => typeof id === "string" || typeof id === "number")
    : [];
  const routePlanId = body.route_plan_id || null;
  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(context.serviceClient))[0]; } catch (error) {
    return NextResponse.json({ error: "Unable to resolve Airship Express courier.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "No active Airship Express courier is registered." }, { status: 409 });
  const courier = AIRSHIP_COURIER_NAME;

  const parcelsSupabase = createFtmParcelClient();
  const bookingsSupabase = context.serviceClient;
  if (!parcelsSupabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let routePlan = isJsonRecord(body.route_plan) ? body.route_plan : null;
  const persistedRoutePlanId = routePlanId;
  if (routePlanId) {
    const { data, error } = await bookingsSupabase.from("route_plans").select("*").eq("id", routePlanId).maybeSingle();
    if (error) {
      return NextResponse.json({ error: `Unable to load route plan: ${error.message}` }, { status: 500 });
    }
    if (data && isJsonRecord(data)) routePlan = data;
  }
  if (!routePlan) return NextResponse.json({ error: "route_plan or route_plan_id is required" }, { status: 400 });
  if (!persistedRoutePlanId) {
    return NextResponse.json({ error: "A persisted route_plan_id is required before creating its booking." }, { status: 400 });
  }
  if (!belongsToAirshipCourier(routePlan, new Set([airshipCourier.id]))) {
    return NextResponse.json({ error: "That route plan does not belong to the selected courier" }, { status: 400 });
  }

  let parcelQuery = parcelsSupabase.from("parcels").select("*");
  parcelQuery = requestedIds.length ? parcelQuery.in("id", requestedIds) : parcelQuery.eq("courier", courier);
  const { data: parcelRows, error: parcelError } = await parcelQuery;
  if (parcelError) return NextResponse.json({ error: `Unable to load parcels: ${parcelError.message}` }, { status: 500 });
  const parcels = (parcelRows || []).filter((parcel) => belongsToAirshipCourier(parcel, new Set([airshipCourier.id])));
  if (!parcels?.length) return NextResponse.json({ error: `No pending parcels found for courier "${courier}"` }, { status: 400 });

  const totalWeight = parcels.reduce((sum, parcel) => sum + Number(parcel.weight_kg || parcel.weight || 0), 0);
  const parcelIds = parcels.map((parcel) => parcel.id);
  const destinations = Array.isArray(routePlan.delivery_destinations)
    ? routePlan.delivery_destinations.filter(isJsonRecord)
    : [];
  const linkedRoutePlanId = String(persistedRoutePlanId);
  const bookingIdempotencyKey = `bulk-booking:${linkedRoutePlanId}`;
  const [idempotentBookingResult, routePlanBookingResult] = await Promise.all([
    bookingsSupabase.from("bookings").select("id,status").eq("idempotency_key", bookingIdempotencyKey).maybeSingle(),
    bookingsSupabase.from("bookings").select("id,status").eq("route_plan_id", linkedRoutePlanId).maybeSingle(),
  ]);
  const bookingLookupError = idempotentBookingResult.error || routePlanBookingResult.error;
  if (bookingLookupError) {
    return NextResponse.json({ error: `Unable to check for an existing booking: ${bookingLookupError.message}` }, { status: 500 });
  }
  const existingBooking = idempotentBookingResult.data || routePlanBookingResult.data || null;
  const bookingId = existingBooking?.id || `BK-${linkedRoutePlanId}`;
  const bookingPayload = {
    id: bookingId,
    idempotency_key: bookingIdempotencyKey,
    courier,
    courier_id: airshipCourier.id,
    route_plan_id: linkedRoutePlanId,
    delivery_destinations: destinations,
    pickup_location: routePlan.pickup_location,
    pickup_latitude: routePlan.pickup_latitude,
    pickup_longitude: routePlan.pickup_longitude,
    dropoff_location: destinations.length ? destinations[destinations.length - 1].name : routePlan.pickup_location,
    cargo_type: "BulkDelivery",
    cargo_description: `${parcels.length} parcel(s) for ${courier}; parcel_ids=${parcelIds.join(",")}`,
    cargo_weight: totalWeight,
    status: existingBooking?.status || "Pending",
  };
  const bookingQuery = existingBooking
    ? bookingsSupabase.from("bookings").update(bookingPayload).eq("id", existingBooking.id)
    : bookingsSupabase.from("bookings").upsert(bookingPayload, { onConflict: "idempotency_key" });
  const { data: booking, error: bookingError } = await bookingQuery.select("*").single();
  if (bookingError) return NextResponse.json({ error: `Unable to create bulk booking: ${bookingError.message}` }, { status: 500 });

  const { error: routeBookingLinkError } = await bookingsSupabase
    .from("route_plan_bookings")
    .upsert({ route_plan_id: linkedRoutePlanId, booking_id: booking.id }, { onConflict: "route_plan_id,booking_id" });
  const legacyRouteBookingLinkSchema = Boolean(routeBookingLinkError
    && /route_plan_bookings/i.test(routeBookingLinkError.message)
    && /route_plan_id/i.test(routeBookingLinkError.message)
    && (routeBookingLinkError.code === "42703"
      || routeBookingLinkError.code === "PGRST204"
      || /schema cache/i.test(routeBookingLinkError.message)));
  if (routeBookingLinkError && !legacyRouteBookingLinkSchema) {
    return NextResponse.json({ error: `Booking ${booking.id} was saved, but its route-plan link failed: ${routeBookingLinkError.message}`, booking_id: booking.id }, { status: 500 });
  }
  if (legacyRouteBookingLinkSchema) {
    console.warn("route_plan_bookings.route_plan_id is missing; booking.route_plan_id remains the route-plan link.");
  }

  const parcelStatusUpdate = { status: "booked" };
  let update = await parcelsSupabase.from("parcels").update(parcelStatusUpdate).in("id", parcelIds.map(String));
  let updateError = update.error;
  if (update.error && /invalid input value|status.*constraint|check constraint/i.test(update.error.message)) {
    update = await parcelsSupabase.from("parcels").update({ status: "picked_up" }).in("id", parcelIds.map(String));
    updateError = update.error;
  }
  if (updateError && /invalid input syntax for type bigint|type bigint|column .* does not exist|could not match/i.test(updateError.message)) {
    updateError = null;
    for (const id of parcelIds) {
      let result = await parcelsSupabase.from("parcels").update(parcelStatusUpdate).eq("id", String(id));
      if (result.error && /invalid input value|status.*constraint|check constraint/i.test(result.error.message)) {
        result = await parcelsSupabase.from("parcels").update({ status: "picked_up" }).eq("id", String(id));
      }
      if (result.error) {
        updateError = result.error;
        break;
      }
    }
  }
  if (updateError) {
    return NextResponse.json({ error: `Booking ${booking.id} was saved, but parcel linking failed: ${updateError.message}`, booking_id: booking.id }, { status: 500 });
  }
  return NextResponse.json({ booking, routePlan, parcelCount: parcels.length, totalWeight, parcelIds }, { status: existingBooking ? 200 : 201 });
}