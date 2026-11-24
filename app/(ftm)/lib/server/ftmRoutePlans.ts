import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OptimizeRequest } from "../optimize";
import { runFtmPythonOptimizer } from "./ftmPythonOptimizer";

type Point = { name?: string; lat: number; lng: number; [key: string]: unknown };
type RoutePlan = Record<string, unknown>;
type OsrmCostMatrices = { distanceMatrix: number[][]; durationMatrix: number[][] };

function isRoutePlanRecord(value: unknown): value is RoutePlan {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchOsrmCostMatrices(points: Point[]): Promise<OsrmCostMatrices> {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coordinates}`);
  url.searchParams.set("annotations", "distance,duration");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`OSRM table request failed with HTTP ${response.status}`);

  const result = await response.json();
  const isValidMatrix = (matrix: unknown) => Array.isArray(matrix)
    && matrix.length === points.length
    && matrix.every((row) => Array.isArray(row)
      && row.length === points.length
      && row.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0));
  if (result?.code !== "Ok" || !isValidMatrix(result.distances) || !isValidMatrix(result.durations)) {
    throw new Error("OSRM did not return complete distance and duration matrices for every selected stop.");
  }

  return {
    distanceMatrix: result.distances.map((row: number[]) => row.map((meters) => meters / 1609.344)),
    durationMatrix: result.durations.map((row: number[]) => row.map((seconds) => seconds / 60)),
  };
}

const LEGACY_COLUMNS = [
  "id", "trip_id", "courier", "courier_id", "pickup_location", "pickup_latitude", "pickup_longitude",
  "delivery_destinations", "status", "created_at", "updated_at",
];
const ROUTE_PLAN_COLUMNS = new Set([
  ...LEGACY_COLUMNS, "bulk_qr_code", "route_geojson", "distance_km", "estimated_duration_min", "fuel_savings",
  "eta_impact_min", "optimization_result", "route_details", "planned_delivery_date", "generated_by", "created_by",
  "idempotency_key", "baseline_route", "optimized_route", "stop_sequence", "depot", "vehicle_id", "driver_id",
  "vehicle_info", "driver_info", "baseline_distance_km", "baseline_duration_min", "optimized_distance_km",
  "optimized_duration_min", "distance_saved_km", "fuel_efficiency_km_per_l", "baseline_fuel_liters",
  "optimized_fuel_liters", "fuel_saved_liters",
]);
const OPEN_STATUSES = new Set(["draft", "assigned", "in_progress", "active", "archived"]);

export function normalizeRoutePlan(record: RoutePlan = {}): RoutePlan {
  return {
    ...record,
    bulkQrCode: record.bulk_qr_code ?? null,
    tripId: record.trip_id ?? null,
    idempotencyKey: record.idempotency_key ?? null,
    bookingId: record.booking_id ?? null,
    courierId: record.courier_id ?? record.courierId ?? null,
    vehicleId: record.vehicle_id ?? record.vehicleId ?? null,
    driverId: record.driver_id ?? record.driverId ?? null,
    vehicleInfo: record.vehicle_info ?? record.vehicleInfo ?? null,
    driverInfo: record.driver_info ?? record.driverInfo ?? null,
    pickupLocation: record.pickup_location,
    pickupLatitude: record.pickup_latitude ?? null,
    pickupLongitude: record.pickup_longitude ?? null,
    deliveryDestinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : [],
    routeGeojson: record.route_geojson || null,
    distanceKm: record.distance_km ?? null,
    durationMinutes: record.estimated_duration_min ?? null,
    baselineRoute: record.baseline_route ?? null,
    optimizedRoute: record.optimized_route ?? null,
    stopSequence: record.stop_sequence ?? [],
    depot: record.depot ?? null,
    baselineDistanceKm: record.baseline_distance_km ?? null,
    baselineDurationMinutes: record.baseline_duration_min ?? null,
    optimizedDistanceKm: record.optimized_distance_km ?? record.distance_km ?? null,
    optimizedDurationMinutes: record.optimized_duration_min ?? record.estimated_duration_min ?? null,
    distanceSavedKm: record.distance_saved_km ?? null,
    fuelEfficiencyKmPerL: record.fuel_efficiency_km_per_l ?? null,
    baselineFuelLiters: record.baseline_fuel_liters ?? null,
    optimizedFuelLiters: record.optimized_fuel_liters ?? null,
    fuelSavedLiters: record.fuel_saved_liters ?? null,
    fuelSavings: record.fuel_savings ?? null,
    etaImpactMinutes: record.eta_impact_min ?? null,
    optimizationResult: record.optimization_result || null,
    routeDetails: record.route_details || null,
    plannedDeliveryDate: record.planned_delivery_date || null,
  };
}

export function createRoutePlanIdempotencyKey(courier: string, stops: Point[], parcelIds: unknown[] = []) {
  const stableParcels = parcelIds.map(String).sort();
  const stableStops = stops
    .map((stop) => String(stop.id || `${Number(stop.lat)},${Number(stop.lng)}`))
    .sort();
  const stableInput = `${courier.trim().toLowerCase()}|${stableParcels.length ? stableParcels.join("|") : stableStops.join("|")}`;
  return createHash("sha256").update(stableInput).digest("hex");
}

function buildRoutePlanPayload(record: RoutePlan) {
  return {
    id: record.id || record.route_plan_id || null,
    trip_id: record.trip_id ?? record.tripId ?? null,
    idempotency_key: record.idempotency_key ?? record.idempotencyKey ?? null,
    booking_id: record.booking_id ?? record.bookingId ?? null,
    bulk_qr_code: record.bulk_qr_code ?? record.bulkQrCode ?? null,
    courier: record.courier || null,
    courier_id: record.courier_id ?? record.courierId ?? null,
    vehicle_id: record.vehicle_id ?? record.vehicleId ?? null,
    driver_id: record.driver_id ?? record.driverId ?? null,
    vehicle_info: record.vehicle_info ?? record.vehicleInfo ?? null,
    driver_info: record.driver_info ?? record.driverInfo ?? null,
    pickup_location: record.pickup_location || record.pickupLocation || null,
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    delivery_destinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : record.deliveryDestinations || [],
    route_geojson: record.route_geojson || record.routeGeojson || null,
    baseline_route: record.baseline_route ?? record.baselineRoute ?? null,
    optimized_route: record.optimized_route ?? record.optimizedRoute ?? null,
    stop_sequence: record.stop_sequence ?? record.stopSequence ?? [],
    depot: record.depot ?? null,
    distance_km: record.distance_km ?? record.distanceKm ?? null,
    estimated_duration_min: record.estimated_duration_min ?? record.durationMinutes ?? null,
    baseline_distance_km: record.baseline_distance_km ?? record.baselineDistanceKm ?? null,
    baseline_duration_min: record.baseline_duration_min ?? record.baselineDurationMinutes ?? null,
    optimized_distance_km: record.optimized_distance_km ?? record.optimizedDistanceKm ?? record.distance_km ?? record.distanceKm ?? null,
    optimized_duration_min: record.optimized_duration_min ?? record.optimizedDurationMinutes ?? record.estimated_duration_min ?? record.durationMinutes ?? null,
    distance_saved_km: record.distance_saved_km ?? record.distanceSavedKm ?? null,
    fuel_efficiency_km_per_l: record.fuel_efficiency_km_per_l ?? record.fuelEfficiencyKmPerL ?? null,
    baseline_fuel_liters: record.baseline_fuel_liters ?? record.baselineFuelLiters ?? null,
    optimized_fuel_liters: record.optimized_fuel_liters ?? record.optimizedFuelLiters ?? null,
    fuel_saved_liters: record.fuel_saved_liters ?? record.fuelSavedLiters ?? null,
    fuel_savings: record.fuel_savings ?? record.fuelSavings ?? null,
    eta_impact_min: record.eta_impact_min ?? record.etaImpactMinutes ?? null,
    optimization_result: record.optimization_result || record.optimizationResult || null,
    route_details: record.route_details || record.routeDetails || null,
    planned_delivery_date: record.planned_delivery_date || record.plannedDeliveryDate || null,
    status: record.status || "draft",
    generated_by: record.generated_by || "OR-Tools",
    created_by: record.created_by || null,
  };
}

export async function runFtmRouteOptimizer(
  depot: Point,
  stops: Point[],
  options: { numVehicles?: number; vehicleCapacities?: number[] } = {}
) {
  const stopById = new Map<string, Point>();
  const solverStops = stops.map((stop, index) => {
    const id = String(stop.id || stop.name || `stop-${index + 1}`);
    stopById.set(id, stop);
    return { ...stop, id, lat: Number(stop.lat), lng: Number(stop.lng) };
  });
  const vehicleCount = Math.max(1, Math.min(25, Math.floor(options.numVehicles || 1)));
  const availableVehicles = options.vehicleCapacities?.length === vehicleCount
    ? options.vehicleCapacities.map((capacityKg, index) => ({ id: `vehicle-${index + 1}`, capacityKg }))
    : [];
  const solverPayload: OptimizeRequest = {
    origin: { lat: Number(depot.lat), lng: Number(depot.lng) },
    destination: { lat: Number(depot.lat), lng: Number(depot.lng) },
    stops: solverStops,
    vehicleCount,
    availableVehicles,
    optimizationMode: "fastest",
  };
  const osrmCosts = await fetchOsrmCostMatrices([
    solverPayload.origin,
    ...solverStops,
    solverPayload.destination,
  ]);
  Object.assign(solverPayload, osrmCosts);
  const solved = await runFtmPythonOptimizer(solverPayload);
  const order = solved.orderedStopIds.map((id) => stopById.get(id)?.name || id);
  const distanceKm = Number((solved.distanceMi * 1.609344).toFixed(2));
  const durationMin = Number(solved.etaMinutes.toFixed(1));
  const routes = (solved.routes || []).map((route, index) => ({
    vehicle_id: index,
    stops: route.orderedStopIds.map((id) => stopById.get(id)?.name || id),
    distance_km: Number((route.distanceMi * 1.609344).toFixed(2)),
  }));
  const firstPolyline = solved.routes?.[0]?.polyline || [];

  return {
    depot: depot.name || "Depot",
    order,
    routes,
    distance_km: distanceKm,
    duration_min: durationMin,
    naive_distance_km: distanceKm,
    pct_shorter: 0,
    distance_source: "osrm-road-distance",
    route_provider: "osrm-table-costs",
    route_geometry: firstPolyline.length
      ? { type: "LineString", coordinates: firstPolyline.map((point) => [point.lng, point.lat]) }
      : null,
    solver: "OR-Tools (GUIDED_LOCAL_SEARCH)",
    used_ortools: true,
  };
}

export async function upsertRoutePlan(supabase: SupabaseClient, payload: RoutePlan) {
  const upsertPayload: RoutePlan = { ...payload, updated_at: new Date().toISOString() };
  if (!upsertPayload.idempotency_key) throw new Error("Route-plan idempotency_key is required");
  if (!upsertPayload.id) delete upsertPayload.id;
  const { data, error } = await supabase
    .from("route_plans")
    .upsert(upsertPayload, { onConflict: "idempotency_key" })
    .select("*")
    .single();
  return { data, error };
}

export function isRoutePlanSchemaUnavailable(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "PGRST002" || /Could not find the table 'public\.route_plans'|Could not query the database for the schema cache/i.test(error.message || "")));
}

export function isOpenRoutePlan(record: RoutePlan) {
  return !record?.status || OPEN_STATUSES.has(String(record.status).trim().toLowerCase());
}

export function prepareRoutePlanPayload(body: RoutePlan, optimized: RoutePlan, finalStops: Point[]) {
  const submittedGeojson = body.route_geojson || body.routeGeojson || null;
  const routeGeojson = isRoutePlanRecord(submittedGeojson) ? submittedGeojson : {};
  const optimizationResult = [
    optimized.optimization_result,
    optimized.optimizationResult,
    body.optimization_result,
    body.optimizationResult,
  ].find(isRoutePlanRecord) || optimized;
  const baselineRoute = optimized.baseline_route || optimized.baselineRoute || optimizationResult.baseline_route || optimizationResult.baselineRoute || null;
  const optimizedRoute = optimized.optimized_route || optimized.optimizedRoute || optimizationResult.optimized_route || optimizationResult.optimizedRoute || null;
  const baselineDistanceKm = optimized.baseline_distance_km ?? optimized.baselineDistanceKm ?? null;
  const optimizedDistanceKm = optimized.optimized_distance_km ?? optimized.optimizedDistanceKm ?? optimized.distance_km ?? null;
  const baselineDurationMin = optimized.baseline_duration_min ?? optimized.baselineDurationMinutes ?? null;
  const optimizedDurationMin = optimized.optimized_duration_min ?? optimized.optimizedDurationMinutes ?? optimized.duration_min ?? null;
  const distanceSavedKm = optimized.distance_saved_km ?? optimized.distanceSavedKm ?? null;
  const baselineFuelLiters = optimized.baseline_fuel_liters ?? optimized.baselineFuelLiters ?? null;
  const optimizedFuelLiters = optimized.optimized_fuel_liters ?? optimized.optimizedFuelLiters ?? null;
  const fuelSavedLiters = optimized.fuel_saved_liters ?? optimized.fuelSavedLiters ?? null;
  const raw = buildRoutePlanPayload({
    ...body,
    route_geojson: {
      ...routeGeojson,
      order: optimized.order,
      routes: optimized.routes || routeGeojson.routes || null,
      route_geometry: optimized.route_geometry || routeGeojson.route_geometry || null,
      baseline_route: baselineRoute,
      optimized_route: optimizedRoute,
      baseline_distance_km: baselineDistanceKm,
      baseline_duration_min: baselineDurationMin,
      optimized_distance_km: optimizedDistanceKm,
      optimized_duration_min: optimizedDurationMin,
      distance_saved_km: distanceSavedKm,
      fuel_efficiency_km_per_l: optimized.fuel_efficiency_km_per_l ?? optimized.fuelEfficiencyKmPerL ?? null,
      baseline_fuel_liters: baselineFuelLiters,
      optimized_fuel_liters: optimizedFuelLiters,
      fuel_saved_liters: fuelSavedLiters,
      distance_km: optimizedDistanceKm,
      estimated_duration_min: optimizedDurationMin,
      generated_by: optimized.solver || body.generated_by || "OR-Tools",
    },
    baseline_route: baselineRoute,
    optimized_route: optimizedRoute,
    stop_sequence: optimized.stop_sequence ?? optimized.stopSequence ?? optimized.optimized_stop_ids ?? optimized.orderedStopIds ?? [],
    depot: optimized.depot ?? body.depot ?? {
      name: body.pickup_location || body.pickupLocation || null,
      lat: body.pickup_latitude ?? body.pickupLatitude ?? null,
      lng: body.pickup_longitude ?? body.pickupLongitude ?? null,
    },
    distance_km: optimizedDistanceKm,
    estimated_duration_min: optimizedDurationMin,
    baseline_distance_km: baselineDistanceKm,
    baseline_duration_min: baselineDurationMin,
    optimized_distance_km: optimizedDistanceKm,
    optimized_duration_min: optimizedDurationMin,
    distance_saved_km: distanceSavedKm,
    fuel_efficiency_km_per_l: optimized.fuel_efficiency_km_per_l ?? optimized.fuelEfficiencyKmPerL ?? null,
    baseline_fuel_liters: baselineFuelLiters,
    optimized_fuel_liters: optimizedFuelLiters,
    fuel_saved_liters: fuelSavedLiters,
    fuel_savings: optimized.fuel_savings_pct ?? optimized.fuelSavingsPct ?? body.fuel_savings ?? body.fuelSavings ?? null,
    eta_impact_min: body.eta_impact_min ?? body.etaImpactMinutes ?? null,
    optimization_result: optimizationResult,
    route_details: {
      ...(body.route_details || body.routeDetails || {}),
      ...routeGeojson,
      baseline_route: baselineRoute,
      optimized_route: optimizedRoute,
      baseline_distance_km: baselineDistanceKm,
      optimized_distance_km: optimizedDistanceKm,
      distance_saved_km: distanceSavedKm,
      fuel_saved_liters: fuelSavedLiters,
    },
    generated_by: optimized.solver || "OR-Tools",
    delivery_destinations: finalStops,
    status: body.status || "draft",
    created_by: body.created_by || null,
  });
  const payload = Object.fromEntries(Object.entries(raw).filter(([, value]) => value != null).filter(([key]) => ROUTE_PLAN_COLUMNS.has(key)));
  return payload;
}