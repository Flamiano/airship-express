import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers } from "../../lib/server/ftmCourier";
import { buildVehiclePayload, getNextVehicleId, normalizeVehicle } from "../../lib/server/ftmVehicles";
import { isOperationalTrip } from "../../lib/parcelTypes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "fvm", "view")) return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  let airshipCouriers;
  try {
    airshipCouriers = await getAirshipCouriers(context.serviceClient);
  } catch (error) {
    return NextResponse.json({ error: "Unable to load Airship Express vehicles", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  const courierIds = new Set<string>(airshipCouriers.map((courier) => courier.id));
  if (!courierIds.size) return NextResponse.json([]);
  let query = context.serviceClient.from("vehicles").select("*").order("created_at", { ascending: false });
  const plate = new URL(request.url).searchParams.get("plate_number")?.trim();
  if (plate) query = query.ilike("plate_number", plate);
  const data: Array<Record<string, unknown>> = [];
  let error: { message: string } | null = null;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const result = await query.range(from, from + pageSize - 1);
    if (result.error) { error = result.error; break; }
    data.push(...(result.data || []));
    if ((result.data || []).length < pageSize) break;
  }
  if (error) {
    const forbidden = /permission denied|not authorized|rls|jwt/i.test(error.message);
    return NextResponse.json({ error: forbidden ? "Vehicle list is not available from Supabase yet" : "Unable to load vehicles", details: error.message }, { status: forbidden ? 403 : 500 });
  }
  const courierById = new Map(airshipCouriers.map((courier) => [courier.id, courier.name]));
  const vehicles: Array<Record<string, unknown>> = (data || [])
    .map((vehicle) => ({
      ...vehicle,
      courier: courierById.get(String(vehicle.courier_id || "")) || vehicle.courier || vehicle.courier_name || vehicle.courierName || null,
    }))
    .filter((vehicle) => belongsToAirshipCourier(vehicle, courierIds));
  if (new URL(request.url).searchParams.get("include_assignments") !== "true") {
    return NextResponse.json(vehicles.map(normalizeVehicle));
  }
  const vehicleIds = vehicles.map((vehicle) => String(vehicle.id || vehicle.vehicle_id || "")).filter(Boolean);
  const loadVehicleTrips = async () => {
    const rows: Array<Record<string, unknown>> = [];
    if (!vehicleIds.length) return { data: rows, error: null };
    const tripsQuery = context.serviceClient.from("trips").select("*").in("vehicle_id", vehicleIds).order("created_at", { ascending: false });
    for (let from = 0; ; from += 1000) {
      const result = await tripsQuery.range(from, from + 999);
      if (result.error) return { data: null, error: result.error };
      rows.push(...((result.data || []) as Array<Record<string, unknown>>));
      if ((result.data || []).length < 1000) break;
    }
    return { data: rows, error: null };
  };
  const [tripsResult, assignmentsResult, bookingAssignmentsResult] = await Promise.all([
    loadVehicleTrips(),
    vehicleIds.length
      ? context.serviceClient.from("driver_assignments").select("vehicle_id,driver_id").in("vehicle_id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? context.serviceClient.from("booking_assignments").select("vehicle_id,driver_id,status,assigned_at").in("vehicle_id", vehicleIds).order("assigned_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const assignmentDriversByVehicle = new Map<string, Set<string>>();
  (assignmentsResult.data || []).forEach((assignment) => {
    if (!assignment.vehicle_id || !assignment.driver_id) return;
    const vehicleId = String(assignment.vehicle_id);
    const driverIds = assignmentDriversByVehicle.get(vehicleId) || new Set<string>();
    driverIds.add(String(assignment.driver_id));
    assignmentDriversByVehicle.set(vehicleId, driverIds);
  });
  const activeAssignmentStatuses = new Set(["assigned", "accepted", "in_progress"]);
  const canonicalDriverByVehicle = new Map<string, string>();
  (bookingAssignmentsResult.data || []).forEach((assignment) => {
    const vehicleId = assignment.vehicle_id == null ? "" : String(assignment.vehicle_id);
    const driverId = assignment.driver_id == null ? "" : String(assignment.driver_id);
    if (!vehicleId || !driverId || !activeAssignmentStatuses.has(String(assignment.status || "").toLowerCase()) || canonicalDriverByVehicle.has(vehicleId)) return;
    canonicalDriverByVehicle.set(vehicleId, driverId);
    const driverIds = assignmentDriversByVehicle.get(vehicleId) || new Set<string>();
    driverIds.add(driverId);
    assignmentDriversByVehicle.set(vehicleId, driverIds);
  });
  const activeTripByVehicle = new Map<string, Record<string, unknown>>();
  (tripsResult.data || []).forEach((trip) => {
    const vehicleId = String(trip.vehicle_id || "");
    if (vehicleId && !activeTripByVehicle.has(vehicleId) && isOperationalTrip({
      id: trip.id == null ? null : String(trip.id),
      status: trip.status == null ? null : String(trip.status),
    })) {
      activeTripByVehicle.set(vehicleId, trip);
    }
  });
  const routePlanIds = [...new Set([...activeTripByVehicle.values()].map((trip) => String(trip.route_plan_id || "")).filter(Boolean))];
  const { data: routePlans } = routePlanIds.length
    ? await context.serviceClient.from("route_plans").select("*").in("id", routePlanIds)
    : { data: [] };
  const routeNameByPlanId = new Map((routePlans || []).map((plan) => {
    const details = plan.route_details || plan.routeDetails || {};
    const routeName = details.route_name || plan.route_name || plan.routeName || plan.pickup_location || null;
    return [String(plan.id), routeName ? String(routeName) : ""];
  }));
  const driverIds = [...new Set([
    ...[...assignmentDriversByVehicle.values()].flatMap((ids) => [...ids]),
    ...[...activeTripByVehicle.values()].map((trip) => String(trip.driver_id || "")).filter(Boolean),
  ])];
  const { data: drivers } = driverIds.length
    ? await context.serviceClient.from("users").select("id,full_name").in("id", driverIds)
    : { data: [] };
  const driverNameById = new Map((drivers || []).map((driver) => [String(driver.id), String(driver.full_name || "")]));

  return NextResponse.json(vehicles.map((vehicle) => {
    const normalized = normalizeVehicle(vehicle);
    const vehicleId = String(normalized.id || normalized.vehicle_id || "");
    const activeTrip = activeTripByVehicle.get(vehicleId) || null;
    const assignmentDriverIds = assignmentDriversByVehicle.get(vehicleId) || new Set<string>();
    const assignmentConflict = assignmentDriverIds.size > 1 && !activeTrip;
    const driverId = String(activeTrip?.driver_id || canonicalDriverByVehicle.get(vehicleId) || (assignmentDriverIds.size === 1 ? [...assignmentDriverIds][0] : "") || "") || null;
    const routeName = activeTrip
      ? activeTrip.route_name || activeTrip.routeName || routeNameByPlanId.get(String(activeTrip.route_plan_id || "")) || null
      : null;
    return {
      ...normalized,
      active_trip: activeTrip ? { ...activeTrip, route_name: routeName } : null,
      driver_id: driverId,
      driver: (driverId && driverNameById.get(driverId)) || activeTrip?.driver_name || null,
      assignment_conflict: assignmentConflict,
      trip_data_available: !tripsResult.error,
      assignment_data_available: !bookingAssignmentsResult.error || !assignmentsResult.error,
    };
  }));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "fvm", "create")) return NextResponse.json({ error: "Permission denied: fvm.create" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(context.serviceClient))[0]; } catch (error) {
    return NextResponse.json({ error: "Unable to resolve Airship Express courier", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "Register an active Airship Express courier before creating vehicles." }, { status: 409 });
  if (body.courier_id && String(body.courier_id) !== airshipCourier.id) {
    return NextResponse.json({ error: "Vehicles can only be registered for Airship Express." }, { status: 400 });
  }
  const payload = buildVehiclePayload(body);
  const courierId = airshipCourier.id;
  payload.courier_id = airshipCourier.id;
  payload.courier = AIRSHIP_COURIER_NAME;
  payload.status = "Available";
  payload.availability = "available";
  payload.assignment_status = payload.courier_id ? "pending" : null;
  if (typeof payload.id !== "string" || typeof payload.plate_number !== "string" || typeof payload.vehicle_type !== "string") {
    return NextResponse.json({ error: "id, plate_number, and vehicle_type are required" }, { status: 400 });
  }

  const supabase = context.serviceClient;
  const { data: duplicate } = await supabase.from("vehicles").select("id").ilike("plate_number", payload.plate_number).limit(1);
  if (duplicate?.length) return NextResponse.json({ error: "This plate number is already registered." }, { status: 409 });

  const insert = async (vehicle: Record<string, unknown>) => supabase.from("vehicles").insert(vehicle).select("*").single();
  let { data, error } = await insert(payload);
  if (error && /assignment_status|schema cache|column .* does not exist/i.test(error.message)) {
    const legacy = { ...payload };
    delete legacy.assignment_status;
    ({ data, error } = await insert(legacy));
  }
  if (error?.code === "23505" && /vehicles_pkey|duplicate key/i.test(error.message)) {
    try {
      payload.id = await getNextVehicleId(supabase, courierId);
      ({ data, error } = await insert(payload));
      if (error && /assignment_status|schema cache|column .* does not exist/i.test(error.message)) {
        const legacy = { ...payload };
        delete legacy.assignment_status;
        ({ data, error } = await insert(legacy));
      }
    } catch (retryError) {
      return NextResponse.json({ error: `Unable to create vehicle: ${retryError instanceof Error ? retryError.message : String(retryError)}` }, { status: 500 });
    }
  }
  if (error) {
    const forbidden = /permission denied|not authorized|rls|jwt/i.test(error.message);
    return NextResponse.json({ error: forbidden ? "Vehicle could not be created in Supabase" : `Unable to create vehicle: ${error.message}` }, { status: forbidden ? 403 : 500 });
  }
  if (payload.courier_id) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: payload.courier_id,
      title: "Vehicle assignment request",
      message: `You have been assigned vehicle ${data.plate_number || data.id}. Accept or reject it in the driver app.`,
      is_read: false,
    });
    if (notificationError) console.warn("Vehicle created but assignment notification could not be sent:", notificationError.message);
  }
  return NextResponse.json(normalizeVehicle(data), { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "fvm", "update")) {
    return NextResponse.json({ error: "Permission denied: fvm.update" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "A vehicle id is required." }, { status: 400 });

  const supabase = context.serviceClient;
  let courierIds: Set<string>;
  try { courierIds = new Set((await getAirshipCouriers(supabase)).map((courier) => courier.id)); } catch (error) {
    return NextResponse.json({ error: "Unable to verify Airship Express vehicle scope", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  const { data: existing, error: lookupError } = await supabase.from("vehicles").select("id,courier_id").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: `Unable to load vehicle: ${lookupError.message}` }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (!belongsToAirshipCourier(existing, courierIds)) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const fields: Array<[string, string]> = [
    ["plate_number", "plate_number"], ["vehicle_type", "vehicle_type"], ["manufacturer", "manufacturer"],
    ["model", "model"], ["year", "year"], ["capacity_kg", "capacity_kg"], ["fuel_type", "fuel_type"],
    ["mileage", "mileage"], ["registration_expiry", "registration_expiry"], ["insurance_expiry", "insurance_expiry"],
    ["vin_number", "vin_number"], ["engine_number", "engine_number"], ["last_service", "last_service"],
    ["maintenance_interval_days", "maintenance_interval_days"], ["maintenance_interval_km", "maintenance_interval_km"],
    ["maintenance_due_soon_km", "maintenance_due_soon_km"], ["maintenance_recurring_fault_limit", "maintenance_recurring_fault_limit"], ["maintenance_base_date", "maintenance_base_date"],
    ["maintenance_base_odometer", "maintenance_base_odometer"],
  ];
  fields.forEach(([input, column]) => {
    if (body[input] !== undefined) updates[column] = body[input] === "" ? null : body[input];
  });

  if (updates.plate_number != null) {
    const plate = String(updates.plate_number).trim().toUpperCase();
    if (plate.length < 3 || plate.length > 20) return NextResponse.json({ error: "Enter a valid plate number." }, { status: 400 });
    const { data: duplicate, error: duplicateError } = await supabase.from("vehicles").select("id").ilike("plate_number", plate).neq("id", id).limit(1);
    if (duplicateError) return NextResponse.json({ error: `Unable to validate plate number: ${duplicateError.message}` }, { status: 500 });
    if (duplicate?.length) return NextResponse.json({ error: "This plate number is already registered." }, { status: 409 });
    updates.plate_number = plate;
  }

  if (updates.year != null && (!Number.isInteger(Number(updates.year)) || Number(updates.year) < 1900 || Number(updates.year) > new Date().getFullYear() + 1)) {
    return NextResponse.json({ error: "Enter a valid vehicle year." }, { status: 400 });
  }
  for (const field of ["capacity_kg", "mileage"] as const) {
    if (updates[field] != null && (!Number.isFinite(Number(updates[field])) || Number(updates[field]) < 0 || (field === "capacity_kg" && Number(updates[field]) === 0))) {
      return NextResponse.json({ error: `${field === "capacity_kg" ? "Capacity" : "Mileage"} must be a valid non-negative number.` }, { status: 400 });
    }
  }
  for (const field of ["maintenance_interval_days", "maintenance_interval_km", "maintenance_due_soon_km", "maintenance_recurring_fault_limit", "maintenance_base_odometer"] as const) {
    if (updates[field] != null && (!Number.isFinite(Number(updates[field])) || Number(updates[field]) < 0 || (["maintenance_interval_days", "maintenance_interval_km"].includes(field) && Number(updates[field]) === 0))) {
      return NextResponse.json({ error: `${field.replaceAll("_", " ")} must be a valid positive or non-negative number.` }, { status: 400 });
    }
  }
  if (updates.maintenance_interval_days != null && !Number.isInteger(Number(updates.maintenance_interval_days))) {
    return NextResponse.json({ error: "Maintenance interval days must be a whole number." }, { status: 400 });
  }
  if (updates.maintenance_recurring_fault_limit != null && (!Number.isInteger(Number(updates.maintenance_recurring_fault_limit)) || Number(updates.maintenance_recurring_fault_limit) < 2)) {
    return NextResponse.json({ error: "Recurring fault escalation must be a whole-number threshold of at least 2 reports." }, { status: 400 });
  }
  if (updates.maintenance_base_date != null && !Number.isFinite(Date.parse(String(updates.maintenance_base_date)))) {
    return NextResponse.json({ error: "Enter a valid maintenance baseline date." }, { status: 400 });
  }

  if (body.status !== undefined) {
    const requested = String(body.status).trim().toLowerCase().replace(/[_-]+/g, " ");
    const statuses: Record<string, { status: string; availability: string }> = {
      available: { status: "Available", availability: "available" },
      "under maintenance": { status: "Under Maintenance", availability: "under maintenance" },
      inactive: { status: "Inactive", availability: "inactive" },
    };
    const nextStatus = statuses[requested];
    if (!nextStatus) return NextResponse.json({ error: "Vehicle status must be Available, Under Maintenance, or Inactive. On Trip is set by trip assignments." }, { status: 400 });
    const { data: linkedTrips, error: tripsError } = await supabase.from("trips").select("id,status").eq("vehicle_id", id);
    if (tripsError) return NextResponse.json({ error: `Unable to validate vehicle assignment status: ${tripsError.message}` }, { status: 500 });
    const hasActiveTrip = (linkedTrips || []).some((trip) => {
      const status = String(trip.status || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      return /assign|accepted|pickup|scheduled|dispatch|transit|deliver|enroute|active|moving|progress|delay|late/.test(status)
        && !/complete|delivered|arrived|cancel|reject|fail/.test(status);
    });
    if (hasActiveTrip) return NextResponse.json({ error: "Vehicle status cannot be changed while it is linked to an active trip." }, { status: 409 });
    if (nextStatus.availability === "available") {
      const { data: activeMaintenance, error: maintenanceError } = await supabase.from("maintenance_history").select("id,status").eq("vehicle_id", id).eq("status", "in_progress").limit(1);
      if (maintenanceError && !/could not find the table|schema cache|relation .* does not exist/i.test(maintenanceError.message)) {
        return NextResponse.json({ error: `Unable to validate maintenance status: ${maintenanceError.message}` }, { status: 500 });
      }
      if (activeMaintenance?.length) return NextResponse.json({ error: "Vehicle cannot be marked available while maintenance is in progress." }, { status: 409 });
    }
    updates.status = nextStatus.status;
    updates.availability = nextStatus.availability;
  }

  if (!Object.keys(updates).length) return NextResponse.json({ error: "No vehicle fields were provided." }, { status: 400 });
  updates.updated_at = new Date().toISOString();
  let result = await supabase.from("vehicles").update(updates).eq("id", id).select("*").maybeSingle();
  if (result.error && /column .* does not exist|schema cache/i.test(result.error.message) && updates.updated_at) {
    const legacy = { ...updates };
    delete legacy.updated_at;
    result = await supabase.from("vehicles").update(legacy).eq("id", id).select("*").maybeSingle();
  }
  if (result.error) return NextResponse.json({ error: `Unable to update vehicle: ${result.error.message}` }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  return NextResponse.json(normalizeVehicle(result.data));
}