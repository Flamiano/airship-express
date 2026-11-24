import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "../../../lib/permissions";
import { getRouteLocationCoordinates, isWithinMetroManila } from "../../../lib/metroManilaGeo";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../lib/server/ftmSupabase";
import { syncRouteParcelLinks, validateRouteParcelSelection, validateRouteParcelSuggestions } from "../../../lib/server/ftmParcels";
import { isRoutePlanSchemaUnavailable, normalizeRoutePlan } from "../../../lib/server/ftmRoutePlans";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers, isAirshipCourier } from "../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function routePolylineFromPlan(plan: Record<string, unknown>) {
  const geojson = asRecord(plan.route_geojson || plan.routeGeojson);
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  const geometry = asRecord(geojson.route_geometry || asRecord(features[0]).geometry);
  const coordinates = geometry.coordinates;
  return Array.isArray(coordinates)
    ? coordinates.filter((coordinate: unknown) => Array.isArray(coordinate) && coordinate.length >= 2)
      .map((coordinate: number[]) => ({ lng: coordinate[0], lat: coordinate[1] }))
    : [];
}

function isAirshipRoutePlan(routePlan: Record<string, unknown>, courierIds: Set<string>) {
  const details = asRecord(routePlan.route_details || routePlan.routeDetails);
  return belongsToAirshipCourier(routePlan, courierIds)
    || (details.manual_fleet === true && isAirshipCourier(details.owner));
}

async function ensureRoutePlanBooking(supabase: SupabaseClient, routePlan: Record<string, unknown>) {
  const routePlanId = String(routePlan.id);
  const findExisting = () => supabase.from("bookings").select("id").eq("route_plan_id", routePlanId).limit(1).maybeSingle();
  const { data: existing, error: lookupError } = await findExisting();
  if (lookupError) throw new Error(`Unable to find an existing booking for this route: ${lookupError.message}`);

  const details = asRecord(routePlan.route_details || routePlan.routeDetails);
  const parcelIdsValue = details.included_parcel_ids ?? details.parcel_ids ?? routePlan.parcel_ids ?? routePlan.parcelIds ?? [];
  const parcelIds = Array.isArray(parcelIdsValue) ? Array.from(new Set(parcelIdsValue.map(String).filter(Boolean))) : [];
  const destinations = Array.isArray(routePlan.delivery_destinations) ? routePlan.delivery_destinations : [];
  const destination = asRecord(destinations[destinations.length - 1] || details.destination);
  const origin = asRecord(details.origin || routePlan.depot);
  let bookingId = String(existing?.id || "");
  if (!bookingId) {
    const { data: created, error: createError } = await supabase.from("bookings").insert({
      id: `ROUTE-${routePlanId}`,
      route_plan_id: routePlanId,
      pickup_location: routePlan.pickup_location || origin.name || origin.address || "Airship Express Hub - Binondo, Manila",
      dropoff_location: destination.name || destination.address || routePlan.pickup_location || "Route destination",
      status: "Pending",
    }).select("id").maybeSingle();
    if (createError) {
      const { data: concurrentBooking } = await findExisting();
      if (!concurrentBooking) throw new Error(`Unable to create a booking for this route: ${createError.message}`);
      bookingId = String(concurrentBooking.id);
    } else if (created) {
      bookingId = String(created.id);
    } else {
      throw new Error("The route booking was not returned after creation.");
    }
  }

  if (parcelIds.length) {
    const parcelClient = createFtmParcelClient();
    if (!parcelClient) throw new Error("The parcel database is not configured, so route parcels could not be linked to the booking.");
    const { error: parcelLinkError } = await parcelClient.from("parcels")
      .update({ booking_id: bookingId })
      .in("id", parcelIds)
      .eq("route_plan_id", routePlanId);
    if (parcelLinkError) throw new Error(`Booking was created, but route parcels could not be linked: ${parcelLinkError.message}`);
  }
  return bookingId;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }
  const { data, error } = await context.serviceClient.from("route_plans").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isRoutePlanSchemaUnavailable(error)) return NextResponse.json({ error: "Route plan not found" }, { status: 404 });
    return NextResponse.json({ error: `Unable to load route plan: ${error.message}` }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Route plan not found" }, { status: 404 });
  const courierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id));
  if (!isAirshipRoutePlan(data, courierIds)) return NextResponse.json({ error: "Route plan not found" }, { status: 404 });
  return NextResponse.json(normalizeRoutePlan(data));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "update")) {
    return NextResponse.json({ error: "Permission denied: vrds.update" }, { status: 403 });
  }
  const { data: existingPlan, error: existingPlanError } = await context.serviceClient.from("route_plans").select("*").eq("id", id).maybeSingle();
  if (existingPlanError) return NextResponse.json({ error: `Unable to load route plan: ${existingPlanError.message}` }, { status: 500 });
  if (!existingPlan) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  const updateCourierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id));
  if (!isAirshipRoutePlan(existingPlan, updateCourierIds)) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  if (!updateCourierIds.size) return NextResponse.json({ error: "No active Airship Express courier is registered." }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const allowedStatuses = new Set(["draft", "planned", "assigned", "vehicle_assigned", "driver_assigned", "ready", "active", "in_progress", "completed", "completed_with_remaining", "failed", "cancelled"]);
  if (body.status && !allowedStatuses.has(String(body.status).toLowerCase())) {
    return NextResponse.json({ error: "Invalid route plan status." }, { status: 400 });
  }
  const routeDetailsValue = body.route_details ?? body.routeDetails;
  const routeDetails = asRecord(routeDetailsValue);
  const locationsChanged = routeDetailsValue !== undefined
    || body.delivery_destinations !== undefined
    || body.deliveryDestinations !== undefined
    || body.pickup_latitude !== undefined
    || body.pickup_longitude !== undefined
    || body.pickupLatitude !== undefined
    || body.pickupLongitude !== undefined;
  if (locationsChanged) {
    const storedDetails = asRecord(existingPlan.route_details || existingPlan.routeDetails);
    const effectiveDetails = { ...storedDetails, ...routeDetails };
    const deliveryDestinations = body.delivery_destinations
      ?? body.deliveryDestinations
      ?? existingPlan.delivery_destinations
      ?? [];
    const deliveries = Array.isArray(deliveryDestinations) ? deliveryDestinations : [];
    const origin = effectiveDetails.origin || {
      lat: body.pickup_latitude ?? body.pickupLatitude ?? existingPlan.pickup_latitude,
      lng: body.pickup_longitude ?? body.pickupLongitude ?? existingPlan.pickup_longitude,
    };
    const destination = effectiveDetails.destination || deliveries[deliveries.length - 1];
    const routeLocations = [
      { label: "Origin", point: origin },
      ...(Array.isArray(effectiveDetails.stops)
        ? effectiveDetails.stops.map((point: unknown, index: number) => ({ label: `Stop #${index + 1}`, point }))
        : []),
      { label: "Destination", point: destination },
      ...deliveries.map((point: unknown, index: number) => ({ label: `Destination #${index + 1}`, point })),
    ];
    const invalidLocation = routeLocations.find(({ point }) => {
      const coordinates = getRouteLocationCoordinates(point);
      return !coordinates || !isWithinMetroManila(coordinates.lat, coordinates.lng);
    });
    if (invalidLocation) {
      return NextResponse.json({
        error: `${invalidLocation.label} must have valid coordinates inside Metro Manila.`,
      }, { status: 400 });
    }
  }
  let includedParcelIds = routeDetails?.included_parcel_ids ?? routeDetails?.parcel_ids;
  const suggestedParcelIds = routeDetails?.suggested_parcel_ids ?? routeDetails?.suggestedParcelIds;
  if (includedParcelIds !== undefined) {
    if (!Array.isArray(includedParcelIds)) return NextResponse.json({ error: "included_parcel_ids must be an array." }, { status: 400 });
    if (includedParcelIds.length) {
      const parcelClient = createFtmParcelClient();
      if (!parcelClient) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      const selection = await validateRouteParcelSelection(context.serviceClient, parcelClient, includedParcelIds.map(String), id);
      if (!selection.valid) return NextResponse.json({ error: selection.error }, { status: 409 });
    }
  }
  if (suggestedParcelIds !== undefined) {
    if (!Array.isArray(suggestedParcelIds)) return NextResponse.json({ error: "suggested_parcel_ids must be an array." }, { status: 400 });
    const parcelClient = suggestedParcelIds.length ? createFtmParcelClient() : null;
    if (suggestedParcelIds.length && !parcelClient) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    const effectiveDetails = routeDetailsValue !== undefined
      ? routeDetails
      : asRecord(existingPlan.route_details || existingPlan.routeDetails);
    const routeCoverage = [effectiveDetails.origin, ...(Array.isArray(effectiveDetails.stops) ? effectiveDetails.stops : []), effectiveDetails.destination,
      ...(Array.isArray(body.delivery_destinations ?? body.deliveryDestinations) ? body.delivery_destinations ?? body.deliveryDestinations : existingPlan.delivery_destinations || [])]
      .filter((point) => point && typeof point === "object");
    const assignedIds = includedParcelIds ?? effectiveDetails.included_parcel_ids ?? effectiveDetails.parcel_ids ?? [];
    const mergedPlan = { ...existingPlan, ...body };
    const suggestionResult = suggestedParcelIds.length && parcelClient
      ? await validateRouteParcelSuggestions(context.serviceClient, parcelClient, suggestedParcelIds.map(String), Array.isArray(assignedIds) ? assignedIds.map(String) : [], id, routeCoverage, routePolylineFromPlan(mergedPlan), Number(effectiveDetails.suggestion_distance_threshold_km) || 5)
      : { suggestions: [], error: null };
    if (suggestionResult.error) return NextResponse.json({ error: suggestionResult.error }, { status: 500 });
    if (routeDetailsValue !== undefined) {
      const autoLinkedSuggestions = body.auto_assign_suggestions === true
        ? suggestionResult.suggestions.filter(({ pickupDistanceKm, deliveryDistanceKm, pickupUsesRouteOriginFallback }) =>
          (pickupDistanceKm != null && pickupDistanceKm <= 2) || (pickupUsesRouteOriginFallback && deliveryDistanceKm != null && deliveryDistanceKm <= 2))
        : [];
      const autoLinkedIds = autoLinkedSuggestions.map(({ parcel }) => String(parcel.id));
      if (autoLinkedIds.length) {
        const combinedIds = Array.from(new Set([...(Array.isArray(includedParcelIds) ? includedParcelIds.map(String) : []), ...autoLinkedIds]));
        const parcelClientForSelection = createFtmParcelClient();
        if (!parcelClientForSelection) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
        const selection = await validateRouteParcelSelection(context.serviceClient, parcelClientForSelection, combinedIds, id);
        if (!selection.valid) return NextResponse.json({ error: selection.error }, { status: 409 });
        includedParcelIds = combinedIds;
        routeDetails.included_parcel_ids = combinedIds;
        const previouslyAutoLinkedIds = Array.isArray(routeDetails.auto_linked_parcel_ids) ? routeDetails.auto_linked_parcel_ids.map(String) : [];
        routeDetails.auto_linked_parcel_ids = Array.from(new Set([...previouslyAutoLinkedIds, ...autoLinkedIds]));
        const includedParcels = Array.isArray(routeDetails.included_parcels) ? routeDetails.included_parcels : [];
        routeDetails.included_parcels = [...includedParcels.filter((item: Record<string, unknown>) => !autoLinkedIds.includes(String(item.id))), ...autoLinkedSuggestions.map(({ parcel }) => ({
          id: String(parcel.id),
          tracking_number: parcel.tracking_number || parcel.trackingNumber || String(parcel.id),
          pickup_address: parcel.pickup_address || parcel.pickup_location || parcel.sender_address || asRecord(effectiveDetails.origin).address || asRecord(effectiveDetails.origin).name || body.pickup_location || existingPlan.pickup_location || "",
          delivery_address: parcel.dropoff_location || parcel.delivery_address || parcel.destination || parcel.address || "",
        }))];
      }
      const remainingSuggestions = suggestionResult.suggestions.filter(({ parcel }) => !autoLinkedIds.includes(String(parcel.id)));
      routeDetails.suggested_parcel_ids = remainingSuggestions.map(({ parcel }) => String(parcel.id));
      routeDetails.suggested_parcels = remainingSuggestions.map(({ parcel, distanceKm, matchedLocation, reason }) => ({
        id: String(parcel.id),
        distance_km: Number(distanceKm.toFixed(2)),
        matched_location: matchedLocation,
        reason,
      }));
    }
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const assign = (column: string, ...keys: string[]) => {
    const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(body, candidate));
    if (key) updates[column] = body[key];
  };
  assign("status", "status");
  assign("pickup_location", "pickup_location", "pickupLocation");
  assign("pickup_latitude", "pickup_latitude", "pickupLatitude");
  assign("pickup_longitude", "pickup_longitude", "pickupLongitude");
  assign("delivery_destinations", "delivery_destinations", "deliveryDestinations");
  assign("planned_delivery_date", "planned_delivery_date", "plannedDeliveryDate");
  assign("vehicle_id", "vehicle_id", "vehicleId");
  assign("driver_id", "driver_id", "driverId");
  assign("vehicle_info", "vehicle_info", "vehicleInfo");
  assign("driver_info", "driver_info", "driverInfo");
  assign("route_geojson", "route_geojson", "routeGeojson");
  assign("baseline_route", "baseline_route", "baselineRoute");
  assign("optimized_route", "optimized_route", "optimizedRoute");
  assign("stop_sequence", "stop_sequence", "stopSequence");
  assign("depot", "depot");
  assign("distance_km", "distance_km", "distanceKm");
  assign("estimated_duration_min", "estimated_duration_min", "durationMinutes");
  assign("baseline_distance_km", "baseline_distance_km", "baselineDistanceKm");
  assign("baseline_duration_min", "baseline_duration_min", "baselineDurationMinutes");
  assign("optimized_distance_km", "optimized_distance_km", "optimizedDistanceKm");
  assign("optimized_duration_min", "optimized_duration_min", "optimizedDurationMinutes");
  assign("distance_saved_km", "distance_saved_km", "distanceSavedKm");
  assign("fuel_efficiency_km_per_l", "fuel_efficiency_km_per_l", "fuelEfficiencyKmPerL");
  assign("baseline_fuel_liters", "baseline_fuel_liters", "baselineFuelLiters");
  assign("optimized_fuel_liters", "optimized_fuel_liters", "optimizedFuelLiters");
  assign("fuel_saved_liters", "fuel_saved_liters", "fuelSavedLiters");
  assign("eta_impact_min", "eta_impact_min", "etaImpactMinutes");
  assign("optimization_result", "optimization_result", "optimizationResult");
  if (routeDetailsValue !== undefined) updates.route_details = routeDetails;
  if (body.courier !== undefined && (typeof body.courier !== "string" || !isAirshipCourier(body.courier))) return NextResponse.json({ error: "Route plans can only use Airship Express." }, { status: 400 });
  updates.courier = AIRSHIP_COURIER_NAME;
  updates.courier_id = String(existingPlan.courier_id || [...updateCourierIds][0]);

  const { data, error } = await context.serviceClient.from("route_plans").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: `Unable to update route plan: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  if (Array.isArray(includedParcelIds)) {
    const parcelClient = createFtmParcelClient();
    const linkResult = parcelClient ? await syncRouteParcelLinks(parcelClient, String(data.id), includedParcelIds.map(String)) : { error: "Parcel database is not configured." };
    if (linkResult.error) return NextResponse.json({ error: linkResult.error, route_plan: normalizeRoutePlan(data) }, { status: 500 });
  }
  const status = String(updates.status || data.status || "").toLowerCase();
  if (status === "in_progress") {
    try {
      const bookingId = await ensureRoutePlanBooking(context.serviceClient, data);
      return NextResponse.json({ ...normalizeRoutePlan(data), booking_id: bookingId });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Route activated, but its booking could not be prepared." }, { status: 500 });
    }
  }
  return NextResponse.json(normalizeRoutePlan(data));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "delete")) {
    return NextResponse.json({ error: "Permission denied: vrds.delete" }, { status: 403 });
  }
  const { data: plan, error: lookupError } = await context.serviceClient.from("route_plans").select("id,trip_id,status,courier,courier_id,route_details").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: `Unable to load route plan: ${lookupError.message}` }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  const deleteCourierIds = new Set((await getAirshipCouriers(context.serviceClient)).map((courier) => courier.id));
  if (!isAirshipRoutePlan(plan, deleteCourierIds)) return NextResponse.json({ error: "Route plan not found." }, { status: 404 });
  if (plan.trip_id || ["in_progress", "completed", "completed_with_remaining"].includes(String(plan.status || "").toLowerCase())) {
    return NextResponse.json({ error: "This route plan is linked to trip history and cannot be deleted. Cancel it instead." }, { status: 409 });
  }
  const { error } = await context.serviceClient.from("route_plans").delete().eq("id", id);
  if (error) return NextResponse.json({ error: `Unable to delete route plan: ${error.message}` }, { status: 500 });
  return NextResponse.json({ success: true, id });
}