type Coordinate = { lat: number; lng: number };
type RouteRecord = Record<string, unknown>;

const CLOSED_ROUTE_STATUSES = new Set(["completed", "completed_with_remaining", "failed", "cancelled", "canceled", "closed"]);
const COLLECTED_PARCEL_STATUSES = new Set(["collected", "picked_up"]);
const TERMINAL_PARCEL_STATUSES = new Set(["delivered", "cancelled", "canceled", "completed", "closed"]);

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeRouteAddress(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function coordinateValue(value: unknown) {
  return value == null || !String(value).trim() ? Number.NaN : Number(value);
}

function asRecord(value: unknown): RouteRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RouteRecord : {};
}

function isRecord(value: unknown): value is RouteRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function distanceToRouteSegmentKm(point: Coordinate, start: Coordinate, end: Coordinate) {
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

export function isParcelAssignedToRoute(parcel: RouteRecord, route: RouteRecord) {
  const parcelRouteId = String(parcel.route_plan_id || parcel.routePlanId || parcel.route_id || parcel.routeId || "");
  if (parcelRouteId) return parcelRouteId === String(route.id);
  const details = asRecord(route.route_details || route.routeDetails);
  const includedIds = details.included_parcel_ids ?? details.parcel_ids ?? route.parcel_ids ?? route.parcelIds ?? [];
  return Array.isArray(includedIds) && includedIds.map(String).includes(String(parcel.id));
}

export function isRouteClosedForParcelCollection(route: RouteRecord) {
  return CLOSED_ROUTE_STATUSES.has(normalizeStatus(route.status));
}

export function isParcelAlreadyCollected(parcel: RouteRecord) {
  return Boolean(parcel.collected_at || parcel.collectedAt)
    || COLLECTED_PARCEL_STATUSES.has(normalizeStatus(parcel.status ?? parcel.parcel_status));
}

export function isParcelTerminalForCollection(parcel: RouteRecord) {
  return TERMINAL_PARCEL_STATUSES.has(normalizeStatus(parcel.status ?? parcel.parcel_status));
}

export function isParcelPickupOnRoute(parcel: RouteRecord, route: RouteRecord, toleranceKm = 2) {
  const details = asRecord(route.route_details || route.routeDetails);
  let pickupAddress = parcel.pickup_address ?? parcel.pickupAddress ?? parcel.pickup_location ?? parcel.pickupLocation
    ?? parcel.sender_address ?? parcel.senderAddress ?? parcel.origin_address ?? parcel.originAddress;
  let latitude = coordinateValue(parcel.pickup_lat ?? parcel.pickup_latitude ?? parcel.pickupLat ?? parcel.pickupLatitude ?? parcel.origin_lat ?? parcel.originLatitude);
  let longitude = coordinateValue(parcel.pickup_lng ?? parcel.pickup_longitude ?? parcel.pickupLng ?? parcel.pickupLongitude ?? parcel.origin_lng ?? parcel.originLongitude);
  let normalizedPickupAddress = normalizeRouteAddress(pickupAddress);
  if (!normalizedPickupAddress && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    const origin = asRecord(details.origin || route.depot);
    pickupAddress = origin.address || origin.name || route.pickup_location;
    if (isParcelAssignedToRoute(parcel, route) && pickupAddress) {
      normalizedPickupAddress = normalizeRouteAddress(pickupAddress);
      latitude = coordinateValue(origin.lat ?? origin.latitude ?? route.pickup_latitude);
      longitude = coordinateValue(origin.lng ?? origin.longitude ?? route.pickup_longitude);
    }
  }
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0);
  if (!normalizedPickupAddress && !hasCoordinates) return false;

  const routePoints = [asRecord(details.origin), ...recordArray(details.stops), asRecord(details.destination),
    ...recordArray(route.delivery_destinations)]
    .filter((point) => Object.keys(point).length > 0);
  if (normalizedPickupAddress && routePoints.some((point) => normalizeRouteAddress(point.address ?? point.name) === normalizedPickupAddress)) return true;

  const point = { lat: latitude, lng: longitude };
  if (!hasCoordinates) return false;
  const coordinatePoints = routePoints.map((item) => ({
    lat: coordinateValue(item.lat ?? item.latitude),
    lng: coordinateValue(item.lng ?? item.longitude),
  })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  if (coordinatePoints.some((candidate) => distanceToRouteSegmentKm(point, candidate, candidate) <= toleranceKm)) return true;

  const routeGeojson = asRecord(route.route_geojson || route.routeGeojson);
  const geometry = asRecord(routeGeojson.route_geometry);
  const coordinates: unknown[] = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  for (let index = 1; index < coordinates.length; index += 1) {
    const startCoordinates = Array.isArray(coordinates[index - 1]) ? coordinates[index - 1] as unknown[] : [];
    const endCoordinates = Array.isArray(coordinates[index]) ? coordinates[index] as unknown[] : [];
    const start = { lat: coordinateValue(startCoordinates[1]), lng: coordinateValue(startCoordinates[0]) };
    const end = { lat: coordinateValue(endCoordinates[1]), lng: coordinateValue(endCoordinates[0]) };
    if (![start.lat, start.lng, end.lat, end.lng].every(Number.isFinite)) continue;
    if (distanceToRouteSegmentKm(point, start, end) <= toleranceKm) return true;
  }
  return false;
}

export function canCollectParcelOnRoute(parcel: RouteRecord, route: RouteRecord) {
  return isParcelAssignedToRoute(parcel, route)
    && !isRouteClosedForParcelCollection(route)
    && !isParcelAlreadyCollected(parcel)
    && !isParcelTerminalForCollection(parcel)
    && isParcelPickupOnRoute(parcel, route);
}
