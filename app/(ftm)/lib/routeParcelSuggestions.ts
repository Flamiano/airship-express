export type ParcelRouteSuggestion = {
  parcel: Record<string, unknown>;
  distanceKm: number;
  pickupDistanceKm: number | null;
  deliveryDistanceKm: number | null;
  pickupUsesRouteOriginFallback: boolean;
  matchedLocation: "pickup" | "delivery" | "both";
  reason: string;
};

type Coordinate = { lat: number; lng: number };

function firstValue(record: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value != null && String(value).trim() !== "");
}

function parcelPoint(parcel: Record<string, unknown>, kind: "pickup" | "delivery") {
  const addressKeys = kind === "pickup"
    ? ["pickup_address", "pickupAddress", "pickup_location", "pickupLocation", "sender_address", "senderAddress", "origin_address", "originAddress"]
    : ["dropoff_location", "dropoffLocation", "delivery_address", "deliveryAddress", "destination", "destination_address", "destinationAddress", "address"];
  const latitudeKeys = kind === "pickup"
    ? ["pickup_lat", "pickup_latitude", "pickupLat", "pickupLatitude", "origin_lat", "originLatitude"]
    : ["dest_lat", "destLat", "dropoff_latitude", "dropoffLatitude", "delivery_lat", "deliveryLatitude", "latitude", "lat"];
  const longitudeKeys = kind === "pickup"
    ? ["pickup_lng", "pickup_longitude", "pickupLng", "pickupLongitude", "origin_lng", "originLongitude"]
    : ["dest_lng", "destLng", "dropoff_longitude", "dropoffLongitude", "delivery_lng", "deliveryLongitude", "longitude", "lng"];
  const address = firstValue(parcel, addressKeys);
  const latValue = firstValue(parcel, latitudeKeys);
  const lngValue = firstValue(parcel, longitudeKeys);
  if (latValue == null || lngValue == null) return null;
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { address: String(address || ""), lat, lng };
}

function distanceToSegmentKm(point: Coordinate, start: Coordinate, end: Coordinate) {
  const scaleY = 111.32;
  const scaleX = Math.cos((point.lat * Math.PI) / 180) * 111.32;
  const px = (point.lng - start.lng) * scaleX;
  const py = (point.lat - start.lat) * scaleY;
  const dx = (end.lng - start.lng) * scaleX;
  const dy = (end.lat - start.lat) * scaleY;
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared ? Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared)) : 0;
  return Math.hypot(px - progress * dx, py - progress * dy);
}

function validCoordinate(value: Record<string, unknown>) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function isEligibleParcel(parcel: Record<string, unknown>) {
  const status = String(parcel.status ?? parcel.parcel_status ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (["delivered", "cancelled", "canceled", "completed", "closed", "booked", "assigned", "in_transit", "out_for_pickup", "assigned_to_route", "collected"].includes(status)) return false;
  if (parcel.collected_at || parcel.collectedAt) return false;
  return !(
    parcel.route_plan_id != null || parcel.routePlanId != null || parcel.route_id != null || parcel.routeId != null ||
    parcel.trip_id != null || parcel.tripId != null || parcel.booking_id != null || parcel.bookingId != null
  );
}

export function computeMatchingParcelSuggestions(
  parcels: Record<string, unknown>[],
  routePoints: Array<Record<string, unknown>>,
  routePolyline: Array<Record<string, unknown>> = [],
  options: { distanceThresholdKm?: number; excludedParcelIds?: Iterable<string> } = {},
): ParcelRouteSuggestion[] {
  const threshold = Number(options.distanceThresholdKm ?? 5);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) return [];
  const excludedIds = new Set(Array.from(options.excludedParcelIds || [], String));
  const line = routePolyline.filter(validCoordinate).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }));
  const points = routePoints.filter(validCoordinate).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }));
  const coverage = line.length > 1 ? line : points;
  if (!coverage.length) return [];
  const segments = coverage.length > 1
    ? coverage.slice(1).map((point, index) => [coverage[index], point] as const)
    : [[coverage[0], coverage[0]] as const];
  const distanceFromRoute = (point: Coordinate) => Math.min(...segments.map(([start, end]) => distanceToSegmentKm(point, start, end)));
  const suggestions = new Map<string, ParcelRouteSuggestion>();

  for (const parcel of parcels) {
    const id = String(parcel.id || "");
    if (!id || excludedIds.has(id) || !isEligibleParcel(parcel)) continue;
    const pickup = parcelPoint(parcel, "pickup");
    const delivery = parcelPoint(parcel, "delivery");
    const pickupAddress = firstValue(parcel, ["pickup_address", "pickupAddress", "pickup_location", "pickupLocation", "sender_address", "senderAddress", "origin_address", "originAddress"]);
    const pickupDistance = pickup ? distanceFromRoute(pickup) : Infinity;
    const deliveryDistance = delivery ? distanceFromRoute(delivery) : Infinity;
    const pickupMatches = pickupDistance <= threshold;
    const deliveryMatches = deliveryDistance <= threshold;
    if (!pickupMatches && !deliveryMatches) continue;

    const matchedLocation = pickupMatches && deliveryMatches ? "both" : pickupMatches ? "pickup" : "delivery";
    const distanceKm = Math.min(pickupDistance, deliveryDistance);
    const reason = matchedLocation === "both"
      ? `Pickup and delivery are within ${threshold} km of the route`
      : `${matchedLocation === "pickup" ? "Pickup" : "Delivery"} is ${distanceKm.toFixed(1)} km from the route`;
    const pickupUsesRouteOriginFallback = !pickup && !pickupAddress;
    suggestions.set(id, {
      parcel,
      distanceKm,
      pickupDistanceKm: Number.isFinite(pickupDistance) ? pickupDistance : null,
      deliveryDistanceKm: Number.isFinite(deliveryDistance) ? deliveryDistance : null,
      pickupUsesRouteOriginFallback,
      matchedLocation,
      reason: pickupUsesRouteOriginFallback ? `${reason}; pickup unavailable, collection uses route origin` : reason,
    });
  }

  return Array.from(suggestions.values()).sort((first, second) => first.distanceKm - second.distanceKm);
}