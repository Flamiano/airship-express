import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { buildTripPayload, isInTransitStatus, normalizeTrip, normalizeTripStop, notifyDriverTripAssigned, persistTripStops, updateRemoteParcelStatus, updateTripResources, validateTripAssignment } from "../../lib/server/ftmTrips";
import { isRoutePlanSchemaUnavailable, normalizeRoutePlan } from "../../lib/server/ftmRoutePlans";
import { belongsToAirshipCourier, getAirshipCouriers, isAirshipCourier } from "../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  }

  const url = new URL(request.url);
  const light = url.searchParams.get("light") === "true";
  const allRows = url.searchParams.get("all") === "true";
  const includePerformanceTimestamps = url.searchParams.get("performance") === "true";
  const pageSize = light ? 100 : 200;
  let query = context.serviceClient.from("trips").select("*").order("created_at", { ascending: false });
  const status = url.searchParams.get("status");
  if (status) query = query.eq("status", status);
  const driverId = context.user.role === "driver" ? context.user.id : url.searchParams.get("driver_id");
  if (driverId) query = query.eq("driver_id", driverId);
  let trips: Record<string, unknown>[] = [];
  let error: { message: string } | null = null;
  if (allRows) {
    for (let from = 0; ; from += pageSize) {
      const result = await query.range(from, from + pageSize - 1);
      if (result.error) { error = result.error; break; }
      trips.push(...(result.data || []));
      if ((result.data || []).length < pageSize) break;
    }
  } else {
    const result = await query.limit(pageSize);
    trips = result.data || [];
    error = result.error;
  }
  if (error) {
    const forbidden = /permission denied|not authorized|rls|jwt/i.test(error.message);
    return NextResponse.json({ error: forbidden ? "RLS policies not configured" : "Unable to load trips", details: error.message }, { status: forbidden ? 403 : 500 });
  }

  const tripRows = trips || [];
  const bookingIds = [...new Set(tripRows.map((trip) => trip.booking_id).filter(Boolean))];
  const routePlanIds = [...new Set(tripRows.map((trip) => trip.route_plan_id).filter(Boolean))];
  const vehicleIds = [...new Set(tripRows.map((trip) => trip.vehicle_id).filter(Boolean).map(String))];
  const driverIds = [...new Set(tripRows.map((trip) => trip.driver_id).filter(Boolean).map(String))];
  const [bookingsResult, stopsResult, routePlansResult, eventsResult, proofResult, vehiclesResult, driversResult, bookingAssignmentsResult] = await Promise.all([
    bookingIds.length ? context.serviceClient.from("bookings").select("*").in("id", bookingIds) : Promise.resolve({ data: [], error: null }),
    !light && tripRows.length ? context.serviceClient.from("trip_stops").select("trip_id,sequence,name,latitude,longitude,status").in("trip_id", tripRows.map((trip) => trip.id)) : Promise.resolve({ data: [], error: null }),
    routePlanIds.length ? context.serviceClient.from("route_plans").select("*").in("id", routePlanIds) : Promise.resolve({ data: [], error: null }),
    !light && tripRows.length ? context.serviceClient.from("trip_events").select("*").in("trip_id", tripRows.map((trip) => trip.id)).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    tripRows.length && (!light || includePerformanceTimestamps)
      ? includePerformanceTimestamps
        ? context.serviceClient.from("proof_of_delivery").select("trip_id,delivered_at").in("trip_id", tripRows.map((trip) => trip.id))
        : context.serviceClient.from("proof_of_delivery").select("*").in("trip_id", tripRows.map((trip) => trip.id))
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length ? context.serviceClient.from("vehicles").select("id,courier_id").in("id", vehicleIds) : Promise.resolve({ data: [], error: null }),
    driverIds.length ? context.serviceClient.from("users").select("id,courier_id,role").in("id", driverIds) : Promise.resolve({ data: [], error: null }),
    bookingIds.length ? context.serviceClient.from("booking_assignments").select("booking_id,driver_id,vehicle_id,route_plan_id").in("booking_id", bookingIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (routePlansResult.error && !isRoutePlanSchemaUnavailable(routePlansResult.error)) {
    return NextResponse.json({ error: `Unable to load trip route plans: ${routePlansResult.error.message}` }, { status: 500 });
  }
  const isOptionalActivityTableMissing = (error: { message: string } | null) =>
    Boolean(error && /could not find the table|schema cache|relation .* does not exist/i.test(error.message));
  const relationshipError = [bookingsResult.error, stopsResult.error, eventsResult.error, proofResult.error, vehiclesResult.error, driversResult.error, bookingAssignmentsResult.error]
    .find((error) => error && !isOptionalActivityTableMissing(error));
  if (relationshipError) return NextResponse.json({ error: `Unable to load trip relationships: ${relationshipError.message}` }, { status: 500 });
  let airshipCourierIds: Set<string>;
  try { airshipCourierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id)); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve Airship Express trips." }, { status: 500 });
  }
  const eventsByTrip = new Map<string, Record<string, unknown>[]>();
  (eventsResult.data || []).forEach((event) => {
    const key = String(event.trip_id);
    eventsByTrip.set(key, [...(eventsByTrip.get(key) || []), event]);
  });
  const proofByTrip = new Map((proofResult.data || []).map((proof) => [String(proof.trip_id), proof]));
  const stops = new Map<string, Array<{ sequence: number; [key: string]: unknown }>>();
  (stopsResult.data || []).forEach((stop) => {
    const list = stops.get(String(stop.trip_id)) || [];
    list.push(stop);
    stops.set(String(stop.trip_id), list);
  });
  const routePlans = new Map((routePlansResult.data || [])
    .filter((routePlan) => belongsToAirshipCourier(routePlan, airshipCourierIds))
    .map((routePlan) => [String(routePlan.id), normalizeRoutePlan(routePlan)]));
  const airshipVehicleIds = new Set((vehiclesResult.data || [])
    .filter((vehicle) => belongsToAirshipCourier(vehicle, airshipCourierIds))
    .map((vehicle) => String(vehicle.id)));
  const airshipDriverIds = new Set((driversResult.data || [])
    .filter((driver) => String(driver.role || "").toLowerCase() === "driver" && airshipCourierIds.has(String(driver.courier_id || "")))
    .map((driver) => String(driver.id)));
  const assignmentByBookingId = new Map((bookingAssignmentsResult.data || []).map((assignment) => [String(assignment.booking_id), assignment]));
  const bookings = new Map((bookingsResult.data || []).flatMap((booking) => {
    const routePlan = booking.route_plan_id ? routePlans.get(String(booking.route_plan_id)) : null;
    const assignment = assignmentByBookingId.get(String(booking.id));
    const inAirshipScope = belongsToAirshipCourier({
      ...booking,
      courier: booking.courier || routePlan?.courier,
      courier_id: booking.courier_id || routePlan?.courier_id || routePlan?.courierId,
    }, airshipCourierIds)
      || Boolean(assignment?.vehicle_id && airshipVehicleIds.has(String(assignment.vehicle_id)))
      || Boolean(assignment?.driver_id && airshipDriverIds.has(String(assignment.driver_id)));
    return inAirshipScope ? [[String(booking.id), booking] as const] : [];
  }));
  const airshipTrips = tripRows.filter((trip) => {
    const routePlanId = String(trip.route_plan_id || "");
    const bookingId = String(trip.booking_id || "");
    const assignment = bookingId ? assignmentByBookingId.get(bookingId) : null;
    return isAirshipCourier(trip.courier) || airshipCourierIds.has(String(trip.courier_id || ""))
      || Boolean(routePlanId && routePlans.has(routePlanId))
      || Boolean(bookingId && bookings.has(bookingId))
      || Boolean(trip.vehicle_id && airshipVehicleIds.has(String(trip.vehicle_id)))
      || Boolean(trip.driver_id && airshipDriverIds.has(String(trip.driver_id)))
      || Boolean(assignment?.vehicle_id && airshipVehicleIds.has(String(assignment.vehicle_id)))
      || Boolean(assignment?.driver_id && airshipDriverIds.has(String(assignment.driver_id)));
  });
  return NextResponse.json(airshipTrips.map((trip) => {
    const booking = bookings.get(String(trip.booking_id));
    const routePlan = routePlans.get(String(trip.route_plan_id));
    const assignment = trip.booking_id ? assignmentByBookingId.get(String(trip.booking_id)) : null;
    const tripStops = (stops.get(String(trip.id)) || []).sort((left, right) => left.sequence - right.sequence);
    const routeStops = Array.isArray(routePlan?.deliveryDestinations) ? routePlan.deliveryDestinations : [];
    const resolvedStops = (tripStops.length ? tripStops : routeStops).map(normalizeTripStop).filter(Boolean);
    return normalizeTrip({
      ...trip,
      vehicle_id: trip.vehicle_id || assignment?.vehicle_id || null,
      driver_id: trip.driver_id || assignment?.driver_id || null,
      route_plan_id: trip.route_plan_id || assignment?.route_plan_id || null,
      routePlan: routePlan || null,
      distance_km: routePlan?.optimizedDistanceKm ?? trip.distance_km,
      duration_minutes: routePlan?.optimizedDurationMinutes ?? trip.duration_minutes,
      from_location: trip.from_location || routePlan?.pickupLocation || booking?.pickup_location,
      to_location: trip.to_location || booking?.dropoff_location,
      from_latitude: trip.from_latitude ?? routePlan?.pickupLatitude ?? booking?.pickup_latitude,
      from_longitude: trip.from_longitude ?? routePlan?.pickupLongitude ?? booking?.pickup_longitude,
      to_latitude: trip.to_latitude ?? booking?.dropoff_latitude,
      to_longitude: trip.to_longitude ?? booking?.dropoff_longitude,
      load_kg: trip.load_kg ?? booking?.cargo_weight,
      stops: resolvedStops,
      routePlanStops: resolvedStops,
      events: eventsByTrip.get(String(trip.id)) || [],
      proof_of_delivery: proofByTrip.get(String(trip.id)) || null,
      proofOfDelivery: proofByTrip.get(String(trip.id)) || null,
    });
  }));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "create")) {
    return NextResponse.json({ error: "Permission denied: operations.create" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const stops = Array.isArray(body.stops) ? body.stops : [];
  const payload = buildTripPayload(body);
  if (!payload.id || !payload.from_location || !payload.to_location) {
    return NextResponse.json({ error: "id, from_location, and to_location are required" }, { status: 400 });
  }
  if (isInTransitStatus(payload.status) && !payload.vehicle_id) {
    return NextResponse.json({ error: "A vehicle must be assigned before a trip can be dispatched." }, { status: 400 });
  }

  let assignment;
  if (payload.driver_id || payload.vehicle_id) {
    try {
      assignment = await validateTripAssignment(context.serviceClient, payload, payload.driver_id || undefined);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Driver and vehicle are not eligible for this trip." }, { status: 409 });
    }
    if (!isAirshipCourier(assignment.courier.name || assignment.courier.code)) {
      return NextResponse.json({ error: "Only Airship Express resources can be dispatched from VRDS." }, { status: 409 });
    }
    payload.courier_id = assignment.courier.id || payload.courier_id;
  }

  let { data, error } = await context.serviceClient.from("trips").insert(payload).select("*").single();
  if (error && (/column|schema cache/i.test(error.message) || error.code === "PGRST204")) {
    const legacy = {
      id: payload.id,
      booking_id: payload.booking_id,
      vehicle_id: payload.vehicle_id,
      driver_id: payload.driver_id,
      status: payload.status,
      progress: payload.progress,
      estimated_departure: payload.scheduled_at,
    };
    ({ data, error } = await context.serviceClient.from("trips").insert(legacy).select("*").single());
  }
  if (error?.code === "23503" && /trips_driver_id_fkey/i.test(error.message)) {
    return NextResponse.json({ error: "The selected driver has no dispatch profile yet. Apply the driver-profile backfill migration, then assign again." }, { status: 409 });
  }
  if (error?.code === "23505") {
    const existing = await context.serviceClient.from("trips").select("*").eq("booking_id", payload.booking_id).maybeSingle();
    if (!existing.error && existing.data) return NextResponse.json(normalizeTrip(existing.data));
  }
  if (error) {
    const forbidden = /permission denied|not authorized|rls|jwt/i.test(error.message);
    return NextResponse.json({ error: `Unable to create trip: ${error.message}` }, { status: forbidden ? 403 : 500 });
  }

  const activeStatus = isInTransitStatus(data.status);
  const assignmentStatus = activeStatus ? "in_progress" : "assigned";
  const bookingStatus = activeStatus ? "In Transit" : "Dispatched";
  if (data.booking_id && data.driver_id && data.vehicle_id) {
    const assignedAt = data.updated_at || new Date().toISOString();
    const { error: assignmentError } = await context.serviceClient.from("booking_assignments").upsert({
      booking_id: data.booking_id,
      driver_id: data.driver_id,
      vehicle_id: data.vehicle_id,
      route_plan_id: data.route_plan_id || payload.route_plan_id || null,
      assigned_at: assignedAt,
      status: assignmentStatus,
      updated_at: assignedAt,
    }, { onConflict: "booking_id" });
    if (assignmentError) return NextResponse.json({ error: `Trip was created, but its shared booking assignment could not be saved: ${assignmentError.message}` }, { status: 500 });
  }
  if (data.driver_id) await notifyDriverTripAssigned(context.serviceClient, data);
  await updateTripResources(context.serviceClient, { driverId: data.driver_id, vehicleId: data.vehicle_id }, activeStatus ? "In Transit" : "Assigned");
  if (data.booking_id) {
    await context.serviceClient.from("bookings").update({
      driver_id: data.driver_id || null,
      driver_name: payload.driver_name || null,
      vehicle_id: data.vehicle_id || null,
      vehicle_plate: body.vehicle_plate || null,
      status: bookingStatus,
    }).eq("id", data.booking_id);
  }
  const routePlanId = data.route_plan_id || payload.route_plan_id;
  if (routePlanId) {
    await context.serviceClient.from("route_plans").update({ trip_id: data.id, status: isInTransitStatus(data.status) ? "in_progress" : "assigned" }).eq("id", routePlanId);
  }
  if (data.booking_id) await updateRemoteParcelStatus(context.serviceClient, data.booking_id, activeStatus ? "in_transit" : "booked");
  await persistTripStops(context.serviceClient, data.id, stops);
  return NextResponse.json(normalizeTrip({ ...data, stops }), { status: 201 });
}