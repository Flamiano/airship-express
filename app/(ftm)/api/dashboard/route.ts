import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../lib/server/ftmSupabase";
import { normalizeTrip } from "../../lib/server/ftmTrips";
import { normalizeVehicle } from "../../lib/server/ftmVehicles";
import { normalizeRoutePlan } from "../../lib/server/ftmRoutePlans";
import { belongsToAirshipCourier, getAirshipCouriers } from "../../lib/server/ftmCourier";
import { isOperationalTrip } from "../../lib/parcelTypes";

export const dynamic = "force-dynamic";

type TrackingLocation = {
  lat: number;
  lng: number;
  recorded_at: string | null;
  is_fresh: boolean;
  driver_id?: string | null;
  vehicle_id?: string | null;
  trip_id?: string | null;
  source: "mobile_device_tracking" | "driver_tracking";
};
type DashboardRecord = Record<string, unknown> & {
  id?: string | number | null;
  trip_id?: string | number | null;
  booking_id?: string | number | null;
  route_plan_id?: string | number | null;
  vehicle_id?: string | number | null;
  driver_id?: string | number | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  estimated_arrival?: string | null;
  duration_minutes?: number | string | null;
};
type DashboardTrip = ReturnType<typeof normalizeTrip> & {
  currentLocation: TrackingLocation | null;
  events: DashboardRecord[];
  proof_of_delivery: DashboardRecord | null;
  proofOfDelivery: DashboardRecord | null;
};

const DASHBOARD_PAGE_SIZE = 1000;

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function getErrorDetails(error: unknown): { message: string; code?: string } | null {
  if (typeof error === "string") return { message: error };
  if (typeof error !== "object" || error === null || !("message" in error) || typeof error.message !== "string") return null;
  return {
    message: error.message,
    code: "code" in error && typeof error.code === "string" ? error.code : undefined,
  };
}

async function fetchAllPages(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: DashboardRecord[] | null;
    error: { message: string; code?: string } | null;
  }>,
) {
  const rows: DashboardRecord[] = [];
  for (let from = 0; ; from += DASHBOARD_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + DASHBOARD_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data || [];
    rows.push(...page);
    if (page.length < DASHBOARD_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

function normalizeLocation(row: DashboardRecord, source: TrackingLocation["source"]): TrackingLocation | null {
  if (row.is_mock_location === true || row.is_mock_location === "true" || row.is_mock_location === 1) return null;
  if (/^(inactive|invalid|rejected|offline|stopped)$/i.test(String(row.status || "").trim())) return null;
  const rawLat = row.lat ?? row.latitude ?? row.location_lat;
  const rawLng = row.lng ?? row.longitude ?? row.location_lng;
  if (rawLat == null || rawLng == null || String(rawLat).trim() === "" || String(rawLng).trim() === "") return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const recordedAt = row.recorded_at || row.created_at || null;
  const recordedTime = recordedAt ? Date.parse(String(recordedAt)) : NaN;
  if (Number.isFinite(recordedTime) && recordedTime > Date.now() + 5 * 60_000) return null;
  return {
    lat,
    lng,
    recorded_at: recordedAt ? String(recordedAt) : null,
    is_fresh: Number.isFinite(recordedTime) && recordedTime <= Date.now() && Date.now() - recordedTime <= 5 * 60_000,
    driver_id: row.driver_id == null ? null : String(row.driver_id),
    vehicle_id: row.vehicle_id == null ? null : String(row.vehicle_id),
    trip_id: row.trip_id == null ? null : String(row.trip_id),
    source,
  };
}

function latestMatchingLocation(locations: TrackingLocation[], relation: { driverId?: unknown; vehicleId?: unknown; tripId?: unknown }) {
  const driverId = relation.driverId == null ? null : String(relation.driverId);
  const vehicleId = relation.vehicleId == null ? null : String(relation.vehicleId);
  const tripId = relation.tripId == null ? null : String(relation.tripId);
  return locations
    .filter((location) => {
      if (location.driver_id && driverId && String(location.driver_id) !== driverId) return false;
      if (location.vehicle_id && vehicleId && String(location.vehicle_id) !== vehicleId) return false;
      if (location.trip_id && tripId && String(location.trip_id) !== tripId) return false;
      if (location.trip_id && !tripId) return false;
      return Boolean((location.driver_id && driverId && String(location.driver_id) === driverId) ||
        (location.vehicle_id && vehicleId && String(location.vehicle_id) === vehicleId));
    })
    .sort((left, right) => (Date.parse(right.recorded_at || "") || 0) - (Date.parse(left.recorded_at || "") || 0))[0] || null;
}

function addDriverLocation(driver: DashboardRecord, location: DashboardRecord | undefined) {
  if (!location) return driver;
  const lat = location.lat ?? location.latitude ?? location.location_lat;
  const lng = location.lng ?? location.longitude ?? location.location_lng;
  if (lat != null && lng != null) {
    driver.last_location_lat = Number(lat);
    driver.last_location_lng = Number(lng);
    driver.last_location_latitude = Number(lat);
    driver.last_location_longitude = Number(lng);
    driver.location = { lat: Number(lat), lng: Number(lng) };
    driver.latitude = Number(lat);
    driver.longitude = Number(lng);
  }
  if (location.recorded_at) {
    driver.last_location_at = location.recorded_at;
    driver.last_seen_at = location.recorded_at;
  }
  if (!driver.vehicle_id && location.vehicle_id) driver.vehicle_id = location.vehicle_id;
  return driver;
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  }
  const supabase = context.serviceClient;
  const parcelsSupabase = createFtmParcelClient() || supabase;

  try {
    const [vehiclesResult, tripsResult, bookingsResult, parcelsResult, routePlansResult, initialDriversResult, fuelLogsResult, costEntriesResult] = await Promise.all([
      fetchAllPages((from, to) => supabase.from("vehicles").select("*").order("created_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("trips").select("*").order("created_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("bookings").select("*").order("created_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => parcelsSupabase.from("parcels").select("*").order("created_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("route_plans").select("*").order("created_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("users").select("id,email,full_name,avatar_url,role,phone,courier_id,created_at,updated_at").eq("role", "driver").order("full_name", { ascending: true }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("fuel_logs").select("*").order("logged_at", { ascending: false }).range(from, to)),
      fetchAllPages((from, to) => supabase.from("cost_entries").select("*").order("entry_date", { ascending: false }).range(from, to)),
    ]);

    let driversResult: { data: DashboardRecord[] | null; error: { message: string; code?: string } | null } = initialDriversResult;
    if (driversResult.error && /avatar_url.*does not exist|column.*avatar_url/i.test(driversResult.error.message)) {
      driversResult = await fetchAllPages((from, to) => supabase.from("users").select("id,email,full_name,role,phone,courier_id,created_at,updated_at").eq("role", "driver").order("full_name", { ascending: true }).range(from, to));
    }

    const sourceErrors: string[] = [];
    const sourceResults: Array<[string, unknown]> = [
      ["Bookings", bookingsResult.error],
      ["Parcels", parcelsResult.error],
      ["Route plans", routePlansResult.error],
      ["Drivers", driversResult.error],
      ["Fuel records", fuelLogsResult.error],
      ["Cost entries", costEntriesResult.error],
    ];
    sourceResults.forEach(([source, error]) => {
      const details = getErrorDetails(error);
      if (details) sourceErrors.push(`${source} unavailable: ${details.message}`);
    });

    const coreError = vehiclesResult.error || tripsResult.error;
    const coreErrorDetails = getErrorDetails(coreError);
    if (coreErrorDetails) {
      if (/relationship|schema cache|Could not find the table|Could not find a relationship/i.test(coreErrorDetails.message) || ["PGRST002", "42501", "PGRST303"].includes(coreErrorDetails.code || "")) {
        return NextResponse.json({ error: "Dashboard data sources are unavailable; no live fleet snapshot can be shown." }, { status: 503 });
      }
      return NextResponse.json({ error: "Failed to fetch dashboard snapshot data" }, { status: 500 });
    }

    const airshipCouriers = await getAirshipCouriers(supabase);
    const airshipCourierIds = new Set<string>(airshipCouriers.map((courier) => courier.id));
    const routePlanRows = (routePlansResult.data || []).filter((routePlan) => belongsToAirshipCourier(routePlan, airshipCourierIds));
    const routePlans = routePlanRows.map(normalizeRoutePlan);
    const routePlanById = new Map<string, DashboardRecord>(routePlans.map((routePlan) => [String(routePlan.id), routePlan]));
    const bookings = (bookingsResult.data || []).filter((booking) => {
      const routePlan = booking.route_plan_id ? routePlanById.get(String(booking.route_plan_id)) : null;
      return belongsToAirshipCourier({
        ...booking,
        courier: booking.courier || routePlan?.courier,
        courier_id: booking.courier_id || routePlan?.courier_id || routePlan?.courierId,
      }, airshipCourierIds);
    }).map((booking) => ({
      ...booking,
      id: booking.id,
      parcel_ids: Array.isArray(booking.parcel_ids)
        ? booking.parcel_ids
        : String(booking.cargo_description || "").match(/parcel_ids=([^;\s]+)/i)?.[1]?.split(",").map((id: string) => id.trim()).filter(Boolean) || [],
      routePlan: booking.route_plan_id ? routePlanById.get(String(booking.route_plan_id)) || null : null,
    }));
    const bookingById = new Map<string, DashboardRecord>(bookings.map((booking) => [String(booking.id), booking]));
    const driverRows = (driversResult.data || []).filter((driver) => airshipCourierIds.has(String(driver.courier_id || "")));
    const driverIds = driverRows.map((driver) => driver.id);
    const vehicleRows = (vehiclesResult.data || []).filter((vehicle) => belongsToAirshipCourier(vehicle, airshipCourierIds));
    const vehicleIds = vehicleRows.map((vehicle) => vehicle.id ?? vehicle.vehicle_id).filter(Boolean);
    const tripBookingIds = [...new Set((tripsResult.data || []).map((trip) => trip.booking_id).filter(Boolean).map(String))];

    const [assignmentResult, mobileResult, trackingResult, bookingAssignmentsByVehicleResult, bookingAssignmentsByTripResult] = await Promise.all([
      vehicleIds.length ? supabase.from("driver_assignments").select("vehicle_id,driver_id").in("vehicle_id", vehicleIds) : Promise.resolve({ data: [] as DashboardRecord[], error: null }),
      driverIds.length ? supabase.from("mobile_device_tracking").select("*").in("driver_id", driverIds).order("recorded_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] as DashboardRecord[], error: null }),
      driverIds.length ? supabase.from("driver_tracking").select("*").in("driver_id", driverIds).order("recorded_at", { ascending: false }).limit(1000) : Promise.resolve({ data: [] as DashboardRecord[], error: null }),
      vehicleIds.length ? supabase.from("booking_assignments").select("vehicle_id,driver_id,status,assigned_at").in("vehicle_id", vehicleIds).order("assigned_at", { ascending: false }) : Promise.resolve({ data: [] as DashboardRecord[], error: null }),
      tripBookingIds.length ? supabase.from("booking_assignments").select("booking_id,driver_id,vehicle_id,route_plan_id,status,assigned_at").in("booking_id", tripBookingIds) : Promise.resolve({ data: [] as DashboardRecord[], error: null }),
    ]);
    if (assignmentResult.error && bookingAssignmentsByVehicleResult.error) sourceErrors.push(`Vehicle assignments unavailable: ${assignmentResult.error.message}; ${bookingAssignmentsByVehicleResult.error.message}`);
    if (bookingAssignmentsByTripResult.error) sourceErrors.push(`Trip booking assignments unavailable: ${bookingAssignmentsByTripResult.error.message}`);
    const mobileTrackingSchemaUnavailable = Boolean(mobileResult.error && /could not find the table|schema cache|relation .* does not exist/i.test(mobileResult.error.message));
    if (mobileResult.error && !mobileTrackingSchemaUnavailable) sourceErrors.push(`Mobile tracking unavailable: ${mobileResult.error.message}`);
    if (trackingResult.error) sourceErrors.push(`Driver tracking unavailable: ${trackingResult.error.message}`);

    const assignments = new Map<string, string>();
    (assignmentResult.data || []).forEach((row) => {
      if (row?.vehicle_id && row?.driver_id && !assignments.has(String(row.vehicle_id))) assignments.set(String(row.vehicle_id), String(row.driver_id));
    });
    const activeAssignmentStatuses = new Set(["assigned", "accepted", "in_progress"]);
    const assignedDriverByVehicle = new Map<string, string>();
    const assignedVehicleByDriver = new Map<string, string>();
    (bookingAssignmentsByVehicleResult.data || []).forEach((row) => {
      const vehicleId = row?.vehicle_id == null ? "" : String(row.vehicle_id);
      const driverId = row?.driver_id == null ? "" : String(row.driver_id);
      if (!vehicleId || !driverId || !activeAssignmentStatuses.has(String(row.status || "").toLowerCase())) return;
      if (!assignedDriverByVehicle.has(vehicleId)) assignedDriverByVehicle.set(vehicleId, driverId);
      if (!assignedVehicleByDriver.has(driverId)) assignedVehicleByDriver.set(driverId, vehicleId);
    });
    const tripAssignmentByBookingId = new Map<string, DashboardRecord>(
      (bookingAssignmentsByTripResult.data || []).map((assignment: DashboardRecord): [string, DashboardRecord] => [
        String(assignment.booking_id),
        assignment,
      ])
    );
    const locations = [
      ...(mobileResult.data || []).map((row: DashboardRecord) => normalizeLocation(row, "mobile_device_tracking")),
      ...(trackingResult.data || []).map((row: DashboardRecord) => normalizeLocation(row, "driver_tracking")),
    ].filter((location): location is TrackingLocation => Boolean(location));
    const drivers = driverRows.map((driver) => {
      const enriched = {
        id: driver.id,
        email: driver.email,
        full_name: driver.full_name || null,
        name: driver.full_name || null,
        role: driver.role || null,
        phone: driver.phone || null,
        created_at: driver.created_at,
        updated_at: driver.updated_at,
        vehicle_id: null as string | null,
      };
      const assignment = assignmentResult.data?.find((row: DashboardRecord) => String(row.driver_id) === String(driver.id));
      if (assignment?.vehicle_id || assignedVehicleByDriver.has(String(driver.id))) enriched.vehicle_id = assignment?.vehicle_id || assignedVehicleByDriver.get(String(driver.id)) || null;
      const location = latestMatchingLocation(locations, { driverId: driver.id, vehicleId: enriched.vehicle_id });
      return addDriverLocation(enriched, location || undefined);
    });
    const driverById = new Map(drivers.map((driver) => [String(driver.id), driver]));

    const airshipVehicleIds = new Set(vehicleRows.map((vehicle) => String(vehicle.id ?? vehicle.vehicle_id)).filter(Boolean));
    const airshipDriverIds = new Set(driverRows.map((driver) => String(driver.id)).filter(Boolean));
    const scopedTripRows = (tripsResult.data || []).filter((trip) => {
      const bookingAssignment = trip.booking_id ? tripAssignmentByBookingId.get(String(trip.booking_id)) : null;
      return belongsToAirshipCourier(trip, airshipCourierIds)
        || Boolean(trip.route_plan_id && routePlanById.has(String(trip.route_plan_id)))
        || Boolean(trip.booking_id && bookingById.has(String(trip.booking_id)))
        || Boolean(trip.vehicle_id && airshipVehicleIds.has(String(trip.vehicle_id)))
        || Boolean(trip.driver_id && airshipDriverIds.has(String(trip.driver_id)))
        || Boolean(bookingAssignment?.route_plan_id && routePlanById.has(String(bookingAssignment.route_plan_id)))
        || Boolean(bookingAssignment?.vehicle_id && airshipVehicleIds.has(String(bookingAssignment.vehicle_id)))
        || Boolean(bookingAssignment?.driver_id && airshipDriverIds.has(String(bookingAssignment.driver_id)));
    });
    const linkedBookingIds = [...new Set(scopedTripRows.map((trip) => trip.booking_id).filter(Boolean).map(String))];
    const [eventsResult, proofResult] = scopedTripRows.length
      ? await Promise.all([
        supabase.from("trip_events").select("trip_id,status,remarks,created_at,created_by").in("trip_id", scopedTripRows.map((trip) => trip.id)).order("created_at", { ascending: true }).limit(5000),
        supabase.from("proof_of_delivery").select("trip_id,driver_id,receiver_name,receiver_signature_url,delivery_photo_url,remarks,delivered_at").in("trip_id", scopedTripRows.map((trip) => trip.id)),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const linkedBookingSet = new Set(linkedBookingIds);
    const bookingAssignmentsResult = {
      data: (bookingAssignmentsByTripResult.data || []).filter((assignment) => linkedBookingSet.has(String(assignment.booking_id))),
      error: bookingAssignmentsByTripResult.error,
    };
    const isOptionalActivityTableMissing = (error: unknown) =>
      Boolean(getErrorDetails(error)?.message && /could not find the table|schema cache|relation .* does not exist/i.test(getErrorDetails(error)?.message || ""));
    const activityResults: Array<[string, unknown]> = [
      ["Trip events", eventsResult.error],
      ["Delivery proofs", proofResult.error],
      ["Booking assignments", bookingAssignmentsResult.error],
    ];
    activityResults.forEach(([source, error]) => {
      const details = getErrorDetails(error);
      if (details && !isOptionalActivityTableMissing(error)) sourceErrors.push(`${source} unavailable: ${details.message}`);
    });
    const bookingAssignmentsByBookingId = new Map<string, DashboardRecord>(
      (bookingAssignmentsResult.data || []).map((assignment: DashboardRecord): [string, DashboardRecord] => [
        String(assignment.booking_id),
        assignment,
      ])
    );
    const tripRows: Array<NonNullable<Parameters<typeof normalizeTrip>[0]>> = scopedTripRows.map((trip) => {
      const assignment = trip.booking_id ? bookingAssignmentsByBookingId.get(String(trip.booking_id)) : null;
      return {
        ...trip,
        id: trip.id,
        status: nullableString(trip.status),
        updated_at: nullableString(trip.updated_at),
        created_at: nullableString(trip.created_at),
        estimated_arrival: nullableString(trip.estimated_arrival),
        booking_id: trip.booking_id,
        distance_km: trip.distance_km,
        duration_minutes: trip.duration_minutes,
        from_location: trip.from_location,
        to_location: trip.to_location,
        from_latitude: trip.from_latitude,
        from_longitude: trip.from_longitude,
        to_latitude: trip.to_latitude,
        to_longitude: trip.to_longitude,
        load_kg: trip.load_kg,
        driver_name: trip.driver_name,
        vehicle_id: nullableString(trip.vehicle_id || assignment?.vehicle_id),
        driver_id: nullableString(trip.driver_id || assignment?.driver_id),
        route_plan_id: nullableString(trip.route_plan_id || assignment?.route_plan_id),
      };
    });
    const eventsByTrip = new Map<string, DashboardRecord[]>();
    (eventsResult.data || []).forEach((event) => {
      const key = String(event.trip_id);
      eventsByTrip.set(key, [...(eventsByTrip.get(key) || []), event]);
    });
    const proofByTrip = new Map<string, DashboardRecord>(
      (proofResult.data || []).map((proof: DashboardRecord): [string, DashboardRecord] => [String(proof.trip_id), proof])
    );
    const activeTripByVehicle = new Map<string, NonNullable<Parameters<typeof normalizeTrip>[0]>>();
    tripRows.filter((trip) => trip.vehicle_id && isOperationalTrip({ id: String(trip.id), status: String(trip.status) })).forEach((trip) => {
      const key = String(trip.vehicle_id);
      const current = activeTripByVehicle.get(key);
      const currentTime = Date.parse(current?.updated_at || current?.created_at || "") || 0;
      const tripTime = Date.parse(String(trip.updated_at || trip.created_at || "")) || 0;
      if (!current || tripTime > currentTime) activeTripByVehicle.set(key, trip);
    });

    const vehicles = vehicleRows.map((row) => {
      const vehicle = normalizeVehicle(row);
      const vehicleId = String(vehicle.id ?? vehicle.vehicle_id ?? row.id ?? row.vehicle_id);
      const activeTrip = activeTripByVehicle.get(vehicleId);
      const assignedDriverId = activeTrip?.driver_id || assignedDriverByVehicle.get(vehicleId) || assignments.get(vehicleId) || null;
      const driver = assignedDriverId ? driverById.get(assignedDriverId) : null;
      const location = latestMatchingLocation(locations, {
        driverId: assignedDriverId,
        vehicleId,
        tripId: activeTrip?.id,
      });
      const driverName = driver?.full_name || vehicle.driverName || vehicle.driver || null;
      return {
        ...vehicle,
        driver_id: assignedDriverId,
        driver: driverName,
        driverName,
        locationLat: location?.lat ?? null,
        locationLng: location?.lng ?? null,
        locationSource: location?.source ?? null,
        locationRecordedAt: location?.recorded_at ?? null,
      };
    });

    const trips: DashboardTrip[] = tripRows.map((trip) => {
      const booking = trip.booking_id ? bookingById.get(String(trip.booking_id)) : null;
      const driver = trip.driver_id ? driverById.get(String(trip.driver_id)) : null;
      const routePlan = trip.route_plan_id ? routePlanById.get(String(trip.route_plan_id)) : null;
      const currentLocation = latestMatchingLocation(locations, {
        driverId: trip.driver_id,
        vehicleId: trip.vehicle_id,
        tripId: trip.id,
      });
      return {
        ...normalizeTrip({
        ...trip,
        bookings: booking || null,
        routePlan: routePlan || null,
        distance_km: routePlan?.optimizedDistanceKm ?? trip.distance_km,
        duration_minutes: routePlan?.optimizedDurationMinutes ?? trip.duration_minutes,
        from_location: trip.from_location || booking?.pickup_location || null,
        to_location: trip.to_location || booking?.dropoff_location || null,
        from_latitude: trip.from_latitude ?? booking?.pickup_latitude ?? null,
        from_longitude: trip.from_longitude ?? booking?.pickup_longitude ?? null,
        to_latitude: trip.to_latitude ?? booking?.dropoff_latitude ?? null,
        to_longitude: trip.to_longitude ?? booking?.dropoff_longitude ?? null,
        load_kg: trip.load_kg ?? booking?.cargo_weight ?? null,
        }),
        status: trip.status || null,
        driverName: driver?.full_name || trip.driver_name || null,
        currentLocation,
        locationLat: currentLocation?.lat ?? null,
        locationLng: currentLocation?.lng ?? null,
        locationRecordedAt: currentLocation?.recorded_at ?? null,
        events: eventsByTrip.get(String(trip.id)) || [],
        proof_of_delivery: proofByTrip.get(String(trip.id)) || null,
        proofOfDelivery: proofByTrip.get(String(trip.id)) || null,
      };
    });
    const airshipRoutePlanIds = new Set(routePlans.map((routePlan) => String(routePlan.id)));
    const airshipBookingIds = new Set(bookings.map((booking) => String(booking.id)));
    const parcels = (parcelsResult.data || []).filter((parcel) =>
      belongsToAirshipCourier(parcel, airshipCourierIds)
      || Boolean(parcel.route_plan_id && airshipRoutePlanIds.has(String(parcel.route_plan_id)))
      || Boolean(parcel.booking_id && airshipBookingIds.has(String(parcel.booking_id)))
    );
    const airshipTripIds = new Set(trips.map((trip) => String(trip.id)).filter(Boolean));
    const fuelLogs = (fuelLogsResult.data || []).filter((log) =>
      airshipVehicleIds.has(String(log.vehicle_id || log.vehicleId || "")) || airshipTripIds.has(String(log.trip_id || log.tripId || ""))
    ).map((log) => ({
      id: log.id,
      vehicleId: log.vehicle_id ?? log.vehicleId,
      driverId: log.driver_id ?? log.driverId,
      tripId: log.trip_id ?? log.tripId,
      liters: Number(log.liters ?? 0),
      cost: Number(log.cost ?? 0),
      loggedAt: log.logged_at ?? log.loggedAt,
    }));
    const costEntries = (costEntriesResult.data || []).filter((entry) =>
      airshipVehicleIds.has(String(entry.vehicle_id || entry.vehicleId || "")) || airshipTripIds.has(String(entry.trip_id || entry.tripId || ""))
    ).map((entry) => ({
      ...entry,
      amount: Number(entry.amount ?? entry.cost ?? 0),
      category: entry.category || "Other",
      entryDate: entry.entry_date ?? entry.entryDate ?? entry.created_at,
    }));

    const deployments = trips.flatMap((trip) => {
      const activeTrip = activeTripByVehicle.get(String(trip.vehicle_id || ""));
      const currentLocation = trip.currentLocation;
      if (activeTrip?.id !== trip.id || !currentLocation) return [];
      const booking = trip.booking_id ? bookingById.get(String(trip.booking_id)) : null;
      const routePlan = trip.route_plan_id ? routePlanById.get(String(trip.route_plan_id)) : null;
      const eta = trip.estimated_arrival ? new Date(trip.estimated_arrival) : null;
      const flightTimeLeft = eta && !Number.isNaN(eta.getTime()) ? `${Math.max(0, Math.ceil((eta.getTime() - Date.now()) / 60000))} min` : trip.duration_minutes ? `${trip.duration_minutes} min` : "--:--";
      return [{
        tripId: trip.id || null,
        vehicleId: trip.vehicle_id || null,
        driverId: trip.driver_id || null,
        driverName: trip.driverName || null,
        vehiclePlate: trip.vehicle_plate || null,
        destination: trip.to_location || booking?.dropoff_location || routePlan?.destination || "Assigned route",
        status: trip.status,
        flightTimeLeft,
        cargoWeight: trip.load_kg || booking?.cargo_weight || routePlan?.cargo_weight || "-",
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        locationRecordedAt: currentLocation.recorded_at,
      }];
    });
    const hubs = routePlans.map((routePlan) => {
      const lat = routePlan.pickup_latitude ?? routePlan.pickupLatitude ?? routePlan.hub_latitude;
      const lng = routePlan.pickup_longitude ?? routePlan.pickupLongitude ?? routePlan.hub_longitude;
      const latitude = Number(lat);
      const longitude = Number(lng);
      return lat == null || lng == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)
        ? null
        : { name: routePlan.name || routePlan.route_name || routePlan.hub_name || "Hub", lat: latitude, lng: longitude };
    }).filter(Boolean);
    const labels = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const hourlyDispatchTrend = labels.map((time, index) => ({
      time,
      volume: trips.filter((trip) => {
        const timestamp = trip.created_at || trip.createdAt;
        if (!timestamp) return false;
        const date = new Date(timestamp);
        return !Number.isNaN(date.getTime()) && date.getHours() >= index * 3 && date.getHours() < (index + 1) * 3;
      }).length,
    }));

    return NextResponse.json({
      counts: { vehicles: vehicles.length, trips: trips.length, bookings: bookings.length, drivers: drivers.length, parcels: parcels.length },
      vehicles,
      trips,
      bookings,
      parcels,
      fuelLogs,
      costEntries,
      drivers,
      routePlans,
      routePlanBookings: [],
      deployments,
      hubs,
      hourlyDispatchTrend,
      sourceErrors: [...new Set(sourceErrors)],
    });
  } catch (error) {
    console.error("Dashboard snapshot error:", error);
    return NextResponse.json({ error: "Unable to load dashboard snapshot" }, { status: 500 });
  }
}