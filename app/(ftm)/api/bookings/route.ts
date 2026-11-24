import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers } from "../../lib/server/ftmCourier";
import { buildBookingPayload, normalizeBooking } from "../../lib/server/ftmBookings";
import { isRoutePlanSchemaUnavailable, normalizeRoutePlan } from "../../lib/server/ftmRoutePlans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }

  const { data, error } = await context.serviceClient.from("bookings").select("*");
  if (error) {
    if (/JWT issued at future|permission denied for table bookings|Could not find the table 'public\.bookings'|invalid JWT|Unauthorized|timed out/i.test(error.message)) {
      console.warn("Bookings table unavailable; returning empty list fallback:", error.message);
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: `Unable to load bookings: ${error.message}` }, { status: 500 });
  }
    const bookings: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const result = await context.serviceClient.from("bookings").select("*").range(from, from + 999);
      if (result.error) {
        if (/JWT issued at future|permission denied for table bookings|Could not find the table 'public\.bookings'|invalid JWT|Unauthorized|timed out/i.test(result.error.message)) {
          return NextResponse.json({ error: `Unable to load bookings: ${result.error.message}` }, { status: 503 });
        }
        return NextResponse.json({ error: `Unable to load bookings: ${result.error.message}` }, { status: 500 });
      }
      bookings.push(...(result.data || []));
      if ((result.data || []).length < 1000) break;
    }
  const routePlanIds = [...new Set(bookings.map((booking) => booking.route_plan_id).filter(Boolean).map(String))];
  const routePlansResult = routePlanIds.length
    ? await context.serviceClient.from("route_plans").select("*").in("id", routePlanIds)
    : { data: [], error: null };
  if (routePlansResult.error && !isRoutePlanSchemaUnavailable(routePlansResult.error)) {
    return NextResponse.json({ error: `Unable to load booking route plans: ${routePlansResult.error.message}` }, { status: 500 });
  }
  const routePlansById = new Map((routePlansResult.data || []).map((routePlan) => [String(routePlan.id), normalizeRoutePlan(routePlan)] as const));
  let courierIds: Set<string>;
  try { courierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id)); } catch (courierError) {
    return NextResponse.json({ error: "Unable to resolve Airship Express booking scope.", details: courierError instanceof Error ? courierError.message : String(courierError) }, { status: 500 });
  }
    const bookingIds = bookings.map((booking) => String(booking.id)).filter(Boolean);
    const bookingAssignmentsResult = bookingIds.length
      ? await context.serviceClient.from("booking_assignments").select("booking_id,driver_id,vehicle_id").in("booking_id", bookingIds)
      : { data: [], error: null };
    if (bookingAssignmentsResult.error) {
      return NextResponse.json({ error: `Unable to load booking assignments: ${bookingAssignmentsResult.error.message}` }, { status: 500 });
    }
    const assignmentsByBooking = new Map((bookingAssignmentsResult.data || []).map((assignment) => [String(assignment.booking_id), assignment] as const));
    const assignedVehicleIds = [...new Set(bookings.flatMap((booking) => {
      const assignment = assignmentsByBooking.get(String(booking.id));
      const id = booking.vehicle_id || assignment?.vehicle_id;
      return id ? [String(id)] : [];
    }))];
    const assignedDriverIds = [...new Set(bookings.flatMap((booking) => {
      const assignment = assignmentsByBooking.get(String(booking.id));
      const id = booking.driver_id || assignment?.driver_id;
      return id ? [String(id)] : [];
    }))];
    const [vehiclesResult, driversResult] = await Promise.all([
      assignedVehicleIds.length ? context.serviceClient.from("vehicles").select("id,courier_id").in("id", assignedVehicleIds) : Promise.resolve({ data: [], error: null }),
      assignedDriverIds.length ? context.serviceClient.from("users").select("id,courier_id,role").in("id", assignedDriverIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const resourceLookupError = vehiclesResult.error || driversResult.error;
    if (resourceLookupError) return NextResponse.json({ error: `Unable to verify booking resource ownership: ${resourceLookupError.message}` }, { status: 500 });
    const airshipVehicleIds = new Set((vehiclesResult.data || []).filter((vehicle) => courierIds.has(String(vehicle.courier_id || ""))).map((vehicle) => String(vehicle.id)));
    const airshipDriverIds = new Set((driversResult.data || []).filter((driver) => String(driver.role || "").toLowerCase() === "driver" && courierIds.has(String(driver.courier_id || ""))).map((driver) => String(driver.id)));
  const airshipBookings = bookings.filter((booking) => {
    const routePlan = booking.route_plan_id ? routePlansById.get(String(booking.route_plan_id)) : null;
      const assignment = assignmentsByBooking.get(String(booking.id));
    return belongsToAirshipCourier({
      ...booking,
      courier: booking.courier || routePlan?.courier,
      courier_id: booking.courier_id || routePlan?.courier_id || routePlan?.courierId,
      }, courierIds)
        || Boolean((booking.vehicle_id || assignment?.vehicle_id) && airshipVehicleIds.has(String(booking.vehicle_id || assignment?.vehicle_id)))
        || Boolean((booking.driver_id || assignment?.driver_id) && airshipDriverIds.has(String(booking.driver_id || assignment?.driver_id)));
  });
  return NextResponse.json(airshipBookings.map((booking) => normalizeBooking({
    ...booking,
    routePlan: booking.route_plan_id ? routePlansById.get(String(booking.route_plan_id)) || null : null,
  })));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "create")) {
    return NextResponse.json({ error: "Permission denied: vrds.create" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const payload = buildBookingPayload(body);
  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(context.serviceClient))[0]; } catch (error) {
    return NextResponse.json({ error: "Unable to resolve Airship Express courier.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "Register an active Airship Express courier before creating bookings." }, { status: 409 });
  payload.courier = AIRSHIP_COURIER_NAME;
  payload.courier_id = airshipCourier.id;
  if (!payload.id || !payload.pickup_location || !payload.dropoff_location) {
    return NextResponse.json({ error: "id, pickup_location, and dropoff_location are required" }, { status: 400 });
  }

  const { data, error } = await context.serviceClient.from("bookings").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: `Unable to create booking: ${error.message}` }, { status: 500 });
  return NextResponse.json(normalizeBooking(data), { status: 201 });
}