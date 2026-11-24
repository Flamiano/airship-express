import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { getRouteLocationCoordinates, isWithinMetroManila } from "../../lib/metroManilaGeo";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../lib/server/ftmSupabase";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers } from "../../lib/server/ftmCourier";
import { syncRouteParcelLinks, validateRouteParcelSelection, validateRouteParcelSuggestions } from "../../lib/server/ftmParcels";
import { createRoutePlanIdempotencyKey, isOpenRoutePlan, isRoutePlanSchemaUnavailable, normalizeRoutePlan, prepareRoutePlanPayload, upsertRoutePlan } from "../../lib/server/ftmRoutePlans";
import { computeMatchingParcelSuggestions } from "../../lib/routeParcelSuggestions";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function routePolylineFromBody(body: Record<string, unknown>) {
  const geojson = asRecord(body.route_geojson || body.routeGeojson);
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  const geometry = asRecord(geojson.route_geometry || asRecord(features[0]).geometry);
  const coordinates = geometry.coordinates;
  return Array.isArray(coordinates)
    ? coordinates.filter((coordinate: unknown) => Array.isArray(coordinate) && coordinate.length >= 2)
      .map((coordinate: number[]) => ({ lng: coordinate[0], lat: coordinate[1] }))
    : [];
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }
  const url = new URL(request.url);
  let query = context.serviceClient.from("route_plans").select("*").order("created_at", { ascending: false });
  const courier = url.searchParams.get("courier");
  if (courier) query = query.eq("courier", courier);
  const { data, error } = await query;
  if (error) {
    if (isRoutePlanSchemaUnavailable(error)) return NextResponse.json([]);
    return NextResponse.json({ error: `Unable to load route plans: ${error.message}` }, { status: 500 });
  }
  const includeClosed = url.searchParams.get("includeClosed") === "true";
  const status = url.searchParams.get("status")?.trim().toLowerCase();
  let courierIds: Set<string>;
  try { courierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id)); } catch (courierError) {
    return NextResponse.json({ error: "Unable to resolve Airship Express route scope.", details: courierError instanceof Error ? courierError.message : String(courierError) }, { status: 500 });
  }
  const requestedIsAirship = !courier || /airship/i.test(courier) || courierIds.has(courier);
  const plans = (data || []).filter((plan) => requestedIsAirship && belongsToAirshipCourier(plan, courierIds) && (includeClosed || isOpenRoutePlan(plan)));
  return NextResponse.json(plans.filter((plan) => !status || String(plan.status || "draft").toLowerCase() === status).map(normalizeRoutePlan));
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
  const incomingRouteDetails = asRecord(body.route_details || body.routeDetails);
  const rawParcelIds = body.parcel_ids ?? body.parcelIds ?? incomingRouteDetails.included_parcel_ids ?? [];
  if (!Array.isArray(rawParcelIds)) return NextResponse.json({ error: "parcel_ids must be an array." }, { status: 400 });
  let parcelIds: unknown[] = rawParcelIds;
  const routeDetails = asRecord(body.route_details || body.routeDetails);
  const suggestedParcelIds = routeDetails.suggested_parcel_ids ?? routeDetails.suggestedParcelIds ?? [];
  if (!Array.isArray(suggestedParcelIds)) return NextResponse.json({ error: "suggested_parcel_ids must be an array." }, { status: 400 });
  if (parcelIds.length) {
    const parcelClient = createFtmParcelClient();
    if (!parcelClient) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    const selection = await validateRouteParcelSelection(context.serviceClient, parcelClient, parcelIds.map(String));
    if (!selection.valid) return NextResponse.json({ error: selection.error }, { status: 409 });
  }
  const manualFleet = asRecord(body.route_details).manual_fleet === true || asRecord(body.routeDetails).manualFleet === true;
  const routeStatus = String(body.status || "draft").toLowerCase();
  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(context.serviceClient))[0]; } catch (error) {
    return NextResponse.json({ error: "Unable to resolve Airship Express courier.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "Register an active Airship Express courier before creating route plans." }, { status: 409 });
  const courier = AIRSHIP_COURIER_NAME;
  if (!body.pickup_location || !Array.isArray(body.delivery_destinations) || !body.delivery_destinations.length) {
    return NextResponse.json({ error: "courier, pickup_location, and at least one delivery destination are required" }, { status: 400 });
  }

  const depot = { name: body.pickup_location, lat: Number(body.pickup_latitude), lng: Number(body.pickup_longitude) };
  if (!Number.isFinite(depot.lat) || !Number.isFinite(depot.lng)) {
    return NextResponse.json({ error: "pickup_latitude/pickup_longitude are required" }, { status: 400 });
  }
  const finalStops = body.delivery_destinations.filter((stop: Record<string, unknown>) => {
    const latitude = Number(stop.lat ?? stop.latitude);
    const longitude = Number(stop.lng ?? stop.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });
  if (!finalStops.length || finalStops.length !== body.delivery_destinations.length) {
    return NextResponse.json({ error: "Every delivery destination must have valid coordinates." }, { status: 400 });
  }

  const routeLocations = [
    { label: "Origin", point: depot },
    ...[routeDetails.origin, ...(Array.isArray(routeDetails.stops) ? routeDetails.stops : []), routeDetails.destination]
      .filter((point: unknown) => point && typeof point === "object")
      .map((point: unknown, index: number) => ({ label: `Route location ${index + 1}`, point })),
    ...finalStops.map((point: unknown, index: number) => ({ label: `Destination #${index + 1}`, point })),
  ];
  const outsideLocation = routeLocations.find(({ point }) => {
    const coordinates = getRouteLocationCoordinates(point);
    return !coordinates || !isWithinMetroManila(coordinates.lat, coordinates.lng);
  });
  if (outsideLocation) {
    return NextResponse.json({
      error: `${outsideLocation.label} must have valid coordinates inside Metro Manila.`,
    }, { status: 400 });
  }

  const uniqueSuggestionIds = Array.from(new Set(suggestedParcelIds.map(String).filter(Boolean)));
  const parcelClient = uniqueSuggestionIds.length ? createFtmParcelClient() : null;
  if (uniqueSuggestionIds.length && !parcelClient) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const coverage = [routeDetails.origin, ...(Array.isArray(routeDetails.stops) ? routeDetails.stops : []), routeDetails.destination, ...finalStops]
    .filter((point) => point && typeof point === "object");
  const suggestionResult = uniqueSuggestionIds.length && parcelClient
    ? await validateRouteParcelSuggestions(context.serviceClient, parcelClient, uniqueSuggestionIds, parcelIds.map(String), body.id ? String(body.id) : null, coverage, routePolylineFromBody(body), Number(routeDetails.suggestion_distance_threshold_km) || 5)
    : { suggestions: [], error: null };
  if (suggestionResult.error) return NextResponse.json({ error: suggestionResult.error }, { status: 500 });
  const canCollectOnRoute = ({ pickupDistanceKm, deliveryDistanceKm, pickupUsesRouteOriginFallback }: typeof suggestionResult.suggestions[number]) =>
    (pickupDistanceKm != null && pickupDistanceKm <= 2) || (pickupUsesRouteOriginFallback && deliveryDistanceKm != null && deliveryDistanceKm <= 2);
  const autoLinkedSuggestions = suggestionResult.suggestions.filter(canCollectOnRoute);
  const remainingSuggestions = suggestionResult.suggestions.filter((suggestion) => !canCollectOnRoute(suggestion));
  const autoLinkedIds = autoLinkedSuggestions.map(({ parcel }) => String(parcel.id));
  parcelIds = Array.from(new Set([...parcelIds.map(String), ...autoLinkedIds]));
  if (parcelIds.length) {
    const parcelClientForSelection = createFtmParcelClient();
    if (!parcelClientForSelection) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    const selection = await validateRouteParcelSelection(context.serviceClient, parcelClientForSelection, parcelIds.map(String), body.id ? String(body.id) : null);
    if (!selection.valid) return NextResponse.json({ error: selection.error }, { status: 409 });
  }
  routeDetails.included_parcel_ids = parcelIds;
  routeDetails.auto_linked_parcel_ids = autoLinkedIds;
  const existingIncludedParcels = Array.isArray(routeDetails.included_parcels) ? routeDetails.included_parcels : [];
  routeDetails.included_parcels = [...existingIncludedParcels.filter((item: Record<string, unknown>) => !autoLinkedIds.includes(String(item.id))), ...autoLinkedSuggestions.map(({ parcel }) => ({
    id: String(parcel.id),
    tracking_number: parcel.tracking_number || parcel.trackingNumber || String(parcel.id),
    pickup_address: parcel.pickup_address || parcel.pickup_location || parcel.sender_address || asRecord(routeDetails.origin).address || asRecord(routeDetails.origin).name || body.pickup_location || "",
    delivery_address: parcel.dropoff_location || parcel.delivery_address || parcel.destination || parcel.address || "",
  }))];
  routeDetails.suggested_parcel_ids = remainingSuggestions.map(({ parcel }) => String(parcel.id));
  routeDetails.suggested_parcels = remainingSuggestions.map(({ parcel, distanceKm, matchedLocation, reason }) => ({
    id: String(parcel.id),
    distance_km: Number(distanceKm.toFixed(2)),
    matched_location: matchedLocation,
    reason,
  }));

  const routeGeojson = asRecord(body.route_geojson || body.routeGeojson);
  const features = Array.isArray(routeGeojson.features) ? routeGeojson.features : [];
  const featureProperties = asRecord(asRecord(features[0]).properties);
  const optimizationResult = asRecord(body.optimization_result || body.optimizationResult);
  const optionalNumber = (...values: unknown[]) => {
    for (const value of values) {
      if (value == null || value === "") continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  };
  const featureDistanceMi = featureProperties.distanceMi == null ? null : Number(featureProperties.distanceMi);
  const distanceKm = optionalNumber(body.optimized_distance_km, body.optimizedDistanceKm, body.distance_km, body.distanceKm, featureProperties.optimizedDistanceKm, featureDistanceMi !== null && Number.isFinite(featureDistanceMi) ? featureDistanceMi * 1.609344 : null);
  const durationMin = optionalNumber(body.optimized_duration_min, body.optimizedDurationMinutes, body.estimated_duration_min, body.durationMinutes, featureProperties.etaMinutes);
  const baselineDistanceKm = optionalNumber(body.baseline_distance_km, body.baselineDistanceKm, featureProperties.baselineDistanceKm);
  const baselineDurationMin = optionalNumber(body.baseline_duration_min, body.baselineDurationMinutes, featureProperties.baselineDurationMinutes);
  const hasMetrics = [distanceKm, durationMin, baselineDistanceKm, baselineDurationMin].every((value) => value !== null);
  if (!hasMetrics && !manualFleet) {
    return NextResponse.json({ error: "Complete baseline and optimized route metrics are required before saving." }, { status: 400 });
  }

  const idempotencyKey = String(body.idempotency_key || body.idempotencyKey || createRoutePlanIdempotencyKey(courier, finalStops, parcelIds));
  const stopSequence = body.stop_sequence || body.stopSequence || {
    baseline: asRecord(body.baseline_route || body.baselineRoute).stops || body.delivery_destinations,
    optimized: asRecord(body.optimized_route || body.optimizedRoute).stops || body.delivery_destinations,
    optimizedStopIds: body.optimized_stop_ids || body.optimizedStopIds || optimizationResult.orderedStopIds || [],
  };
  const optimized = {
    idempotency_key: idempotencyKey,
    order: optimizationResult.orderedStopIds || body.optimized_stop_ids || body.optimizedStopIds || finalStops.map((stop: Record<string, unknown>) => stop.id || stop.name || stop.address || stop.delivery_address),
    stop_sequence: stopSequence,
    routes: Array.isArray(body.routes) ? body.routes : Array.isArray(routeGeojson.routes) ? routeGeojson.routes : null,
    route_geometry: routeGeojson.route_geometry || asRecord(features[0]).geometry || null,
    distance_km: distanceKm,
    duration_min: durationMin,
    optimized_distance_km: distanceKm,
    optimized_duration_min: durationMin,
    baseline_distance_km: baselineDistanceKm,
    baseline_duration_min: baselineDurationMin,
    distance_saved_km: baselineDistanceKm !== null && distanceKm !== null ? Number(body.distance_saved_km ?? body.distanceSavedKm ?? baselineDistanceKm - distanceKm) : null,
    baseline_route: body.baseline_route || body.baselineRoute || featureProperties.baselineRoute || null,
    optimized_route: body.optimized_route || body.optimizedRoute || featureProperties.optimizedRoute || null,
    depot: body.depot || { name: body.pickup_location, lat: depot.lat, lng: depot.lng },
    vehicle_id: body.vehicle_id || body.vehicleId || null,
    driver_id: body.driver_id || body.driverId || null,
    vehicle_info: body.vehicle_info || body.vehicleInfo || null,
    driver_info: body.driver_info || body.driverInfo || null,
    fuel_efficiency_km_per_l: body.fuel_efficiency_km_per_l ?? body.fuelEfficiencyKmPerL ?? null,
    baseline_fuel_liters: body.baseline_fuel_liters ?? body.baselineFuelLiters ?? null,
    optimized_fuel_liters: body.optimized_fuel_liters ?? body.optimizedFuelLiters ?? null,
    fuel_saved_liters: body.fuel_saved_liters ?? body.fuelSavedLiters ?? null,
    fuel_savings_pct: body.fuel_savings_pct ?? body.fuelSavingsPct ?? featureProperties.fuelSavingsPct ?? null,
    eta_impact_min: body.eta_impact_min ?? body.etaImpactMinutes ?? (baselineDurationMin !== null && durationMin !== null ? baselineDurationMin - durationMin : null),
    optimization_result: optimizationResult,
    solver: body.generated_by || "or-tools",
  };
  const payload = prepareRoutePlanPayload({ ...body, route_details: routeDetails, courier, courier_id: airshipCourier.id, created_by: body.created_by || context.user.id }, optimized, finalStops);
  const { data, error } = await upsertRoutePlan(context.serviceClient, payload);
  if (error) {
    if (/permission denied|not authorized|rls|jwt/i.test(error.message)) {
      return NextResponse.json({ error: "Unable to save route plan: permission denied for table route_plans", details: "Supabase RLS policies are not configured for service-role access." }, { status: 403 });
    }
    if (isRoutePlanSchemaUnavailable(error) || /column .* of 'route_plans'/i.test(error.message)) {
      return NextResponse.json({ error: "route_plans calculation columns are not migrated.", details: error.message, migration: "20261005_route_plan_calculation_persistence.sql" }, { status: 500 });
    }
    return NextResponse.json({ error: `Unable to save route plan: ${error.message}` }, { status: 500 });
  }
  if (parcelIds.length) {
    const parcelClient = createFtmParcelClient();
    const linkResult = parcelClient ? await syncRouteParcelLinks(parcelClient, String(data.id), parcelIds.map(String)) : { error: "Parcel database is not configured." };
    if (linkResult.error) return NextResponse.json({ error: linkResult.error, route_plan: normalizeRoutePlan(data) }, { status: 500 });
  }
  return NextResponse.json(normalizeRoutePlan(data), { status: 200 });
}