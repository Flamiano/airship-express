"use client";

import { createElement, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import { createRouteBooking, useParcelStore } from "../../lib/parcelStore";
import { createBulkBooking, createRoutePlan, fetchJson } from "../../lib/api";
import { getCityCoordinate } from "../../lib/serviceAreas";
import { getCourierWarehouseLocation, listCourierWarehouses, resolveCourierName, resolveKnownCity } from "../../lib/courierWarehouses";
import { getParcelGroupKey } from "../../lib/parcelGrouping";
import { SkeletonMap } from "../../components/PageSkeleton";
import { QRCodeSVG } from "qrcode.react";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
  loading: () => <SkeletonMap className="h-full min-h-[320px] w-full" />,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RouteStop = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  courier: string;
  kind?: "warehouse" | "parcel";
  city?: string;
  parcelId?: string | null;
};
type LatLng = { lat: number; lng: number };

type VehicleRouteResult = {
  vehicleId: string;
  orderedStopIds: string[];
  polyline: LatLng[];
  distanceMi: number;
  etaMinutes: number;
};

type OptimizeResponse = {
  orderedStopIds: string[];
  polyline: LatLng[];
  routes?: VehicleRouteResult[];
  distanceMi: number;
  etaMinutes: number;
  fuelSavingsPct: number;
  etaImprovementMin: number;
  engine: "or-tools" | "heuristic-fallback";
  baselineDistanceMi?: number;
  baselineEtaMinutes?: number;
};

type MapMarker = {
  id: string;
  position: LatLng;
  color?: string;
  label?: string;
};

/* ------------------------------------------------------------------ */
/* Module-level constants & pure helpers (no reason to live in state   */
/* or be recreated every render)                                       */
/* ------------------------------------------------------------------ */

const PERSISTED_SERVICE_AREA_KEY = "vrds-bulk-service-area";
const ALL_SERVICE_AREA_SENTINEL = "__ALL_SERVICE_CITIES__";
const ALL_SERVICE_CITIES_LABEL = "All Service Cities";

const DEPOT_ORIGIN = {
  lat: 14.5995,
  lng: 120.9745,
  label: "Airship Express - Binondo, Manila",
};

const PHILIPPINES_BOUNDS = { minLat: 5.0, maxLat: 20.0, minLng: 119.0, maxLng: 129.0 };

const COLOR_PALETTE = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

const COURIER_LOGOS: Record<string, string> = {
  "Flash Express": "/images/partners/flash.png",
  "GOGO Xpress": "/images/partners/gogo.png",
  "JNT Express": "/images/partners/jnt.png",
  "J&T Express": "/images/partners/jnt.png",
  "J&T Cargo": "/images/partners/jnt.png",
  "Lazada Express": "/images/partners/lazada.png",
  "LBC": "/images/partners/lbc.png",
  "LBC Express": "/images/partners/lbc.png",
  "Airship Express": "/images/airship.png",
  "Airship": "/images/airship.png",
  "ShopeeXpress": "/images/partners/shopee.png",
  "Shopee Xpress": "/images/partners/shopee.png",
  "TikTok Delivery": "/images/partners/tiktok.png",
};

// The API requests database `picked_up`; the parcel store exposes it as PICKED_UP.
const PICKUP_READY_STATUSES = new Set(["PICKED_UP"]);
const ACTIVE_PARCEL_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

function isWithinPhilippines(lat: number, lng: number) {
  return (
    lat >= PHILIPPINES_BOUNDS.minLat &&
    lat <= PHILIPPINES_BOUNDS.maxLat &&
    lng >= PHILIPPINES_BOUNDS.minLng &&
    lng <= PHILIPPINES_BOUNDS.maxLng
  );
}

function resolveParcelCity(address: string) {
  const raw = (address || "").trim().replace(/\s+/g, " ");
  if (!raw) return "Unknown";
  const segments = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return segments[segments.length - 1] || "Unknown";
}

function isPickupReadyParcel(parcel: { status?: string }) {
  return PICKUP_READY_STATUSES.has(String(parcel.status || "").trim().toUpperCase());
}

function isAlreadyAssignedToRouteOrTrip(parcel: any) {
  return Boolean(parcel.bookingId || parcel.routePlanId || parcel.tripId);
}

function getParcelAddress(parcel: any) {
  return (
    parcel.destinationAddress ||
    parcel.destination ||
    parcel.dropoffLocation ||
    parcel.dropoff_location ||
    parcel.pickupLocation ||
    parcel.pickup_location ||
    ""
  );
}

// Some data sources accidentally store lng/lat swapped. Detect and fix,
// or drop the point entirely rather than render a wildly wrong location.
function normalizePosition(pos: { lat: number; lng: number } | null | undefined): LatLng | null {
  if (!pos) return null;
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) return { lat: lng, lng: lat };
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  return null;
}

function isValidLatLngLike(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  const lat = Number(v.lat ?? v.latitude);
  const lng = Number(v.lng ?? v.lon ?? v.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function hasUsableCoordinate(point: { lat: number; lng: number } | null | undefined): point is { lat: number; lng: number } {
  if (!point) return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function hasDbCoords(parcel: any) {
  return (
    Number.isFinite(parcel.destLat) && parcel.destLat !== 0 &&
    Number.isFinite(parcel.destLng) && parcel.destLng !== 0
  );
}

function formatDuration(mins: number) {
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${mins}m`;
}

function formatFiveDigitValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(5)).toString();
}

function calculateFuelSavingsPct(baselineDistanceMi: number | null, routeDistanceMi: number | null) {
  if (baselineDistanceMi === null || routeDistanceMi === null || !Number.isFinite(baselineDistanceMi) || !Number.isFinite(routeDistanceMi) || baselineDistanceMi <= 0) return 0;
  return Math.max(0, Math.min(100, ((baselineDistanceMi - routeDistanceMi) / baselineDistanceMi) * 100));
}

function calculateEtaMinutes(distanceMi: number | null) {
  if (distanceMi === null || !Number.isFinite(distanceMi) || distanceMi <= 0) return null;
  return Math.max(1, Math.round((distanceMi / 32) * 60));
}

function sortStopsForNavigation(stops: RouteStop[]) {
  return [...stops].sort((left, right) => {
    const leftWeight = left.kind === "warehouse" ? 0 : 1;
    const rightWeight = right.kind === "warehouse" ? 0 : 1;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;

    const leftParcelOrder = left.kind === "parcel" ? 1 : 0;
    const rightParcelOrder = right.kind === "parcel" ? 1 : 0;
    if (leftParcelOrder !== rightParcelOrder) return leftParcelOrder - rightParcelOrder;

    return left.label.localeCompare(right.label);
  });
}

function prioritizeWarehouseFirst(stops: RouteStop[], orderedIds?: string[]) {
  const stopMap = new Map(stops.map((stop) => [stop.id, stop]));
  const fallbackIds = stops.map((stop) => stop.id);
  const existingIds = (orderedIds && orderedIds.length ? orderedIds : fallbackIds).filter((id) => stopMap.has(id));
  const warehouseIds = stops.filter((stop) => stop.kind === "warehouse").map((stop) => stop.id);
  const parcelIds = stops.filter((stop) => stop.kind !== "warehouse").map((stop) => stop.id);

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const id of existingIds) {
    if (seen.has(id)) continue;
    if (stopMap.get(id)?.kind === "warehouse") {
      ordered.push(id);
      seen.add(id);
    }
  }

  for (const id of warehouseIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  for (const id of existingIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  for (const id of parcelIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
  }

  const finalIds = ordered.length ? ordered : fallbackIds;
  const finalMap = new Map(finalIds.map((id) => [id, stopMap.get(id)]));

  const restoredWarehouseIds = warehouseIds.filter((id) => !finalMap.has(id));
  const output = [...finalIds, ...restoredWarehouseIds];

  const outputMap = new Map(output.map((id) => [id, stopMap.get(id)]));
  const outputWarehouseIds = output.filter((id) => outputMap.get(id)?.kind === "warehouse");
  const outputParcelIds = output.filter((id) => outputMap.get(id)?.kind !== "warehouse");

  return [...outputWarehouseIds, ...outputParcelIds];
}

function buildWarehouseFirstPolyline({
  stops,
  origin,
  destination,
  orderedIds,
}: {
  stops: RouteStop[];
  origin: LatLng;
  destination: LatLng;
  orderedIds?: string[];
}) {
  const stopMap = new Map(stops.map((stop) => [stop.id, stop]));
  const ordered = prioritizeWarehouseFirst(stops, orderedIds ?? stops.map((stop) => stop.id));
  const orderedPoints = ordered
    .map((id) => stopMap.get(id))
    .filter((stop): stop is RouteStop => Boolean(stop))
    .filter((stop, index, list) => list.findIndex((item) => item.id === stop.id) === index)
    .map((stop) => ({ lat: stop.lat, lng: stop.lng }));

  if (orderedPoints.length === 0) {
    return [origin, destination];
  }

  return [origin, ...orderedPoints, destination];
}

function ensureWarehouseFirst(stops: RouteStop[]) {
  const warehouseStops = stops.filter((stop) => stop.kind === "warehouse");
  const parcelStops = stops.filter((stop) => stop.kind !== "warehouse");
  return [...warehouseStops, ...parcelStops];
}

function routePolylineNeedsWarehouseRebuild(stops: RouteStop[], polyline?: LatLng[] | null, orderedIds?: string[]) {
  if (!polyline || polyline.length <= 2) return true;

  const stopIds = new Set((orderedIds && orderedIds.length ? orderedIds : stops.map((stop) => stop.id)).filter(Boolean));
  const waypointCount = stops.filter((stop) => stop.kind === "warehouse" || stopIds.has(stop.id)).length;
  if (waypointCount === 0) return false;

  const hasWarehouseWaypoint = stops.some((stop) => {
    if (stop.kind !== "warehouse") return false;
    return polyline.some((point) => Math.abs(point.lat - stop.lat) < 1e-6 && Math.abs(point.lng - stop.lng) < 1e-6);
  });

  return !hasWarehouseWaypoint;
}

function getNearestWarehouseForParcel(courier: string, parcelPosition: LatLng) {
  const warehouseOptions = listCourierWarehouses(courier);
  if (!warehouseOptions.length) return null;

  let nearest = null as { lat: number; lng: number; name: string; city: string; dist: number } | null;
  for (const warehouse of warehouseOptions) {
    const dist = Math.hypot(parcelPosition.lat - warehouse.lat, parcelPosition.lng - warehouse.lng);
    if (!nearest || dist < nearest.dist) {
      nearest = {
        lat: warehouse.lat,
        lng: warehouse.lng,
        name: warehouse.name,
        city: warehouse.city,
        dist,
      };
    }
  }

  return nearest;
}

/** One place that decides which delivery city/point the plan is targeting,
 *  given the persisted "service area" filter from the Bulk page. Used by
 *  every effect/memo that needs to resolve a destination — previously this
 *  logic was copy-pasted three times with small drifts between copies. */
function resolveDestinationForCoverage(
  coverage: string | null,
  stops: RouteStop[],
  fallback: LatLng & { label: string }
): LatLng & { label: string } {
  const actualParcelStop = stops.find((stop) => stop.kind !== "warehouse") ?? stops[0] ?? fallback;

  // Route planning must always target the actual parcel destination; the saved
  // service-area filter is only a UI grouping tool and must never override the
  // physical destination of the selected parcel(s).
  return {
    lat: actualParcelStop.lat,
    lng: actualParcelStop.lng,
    label: actualParcelStop.label,
  };
}

function readPersistedServiceArea(): string | null {
  return null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function VrdsRoutePlanningPage() {
  const router = useRouter();
  // Route planning uses only the active pickup queue. Archived history stays
  // available on the Parcel page and is never loaded into this queue.
  const parcelStore = useParcelStore({ history: true });
  const parcels = Array.isArray(parcelStore.parcels) ? parcelStore.parcels : [];
  const vehicles = Array.isArray(parcelStore.vehicles) ? parcelStore.vehicles : [];
  const bookings = Array.isArray(parcelStore.bookings) ? parcelStore.bookings : [];

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  // Single source of truth for "parcel destination coordinates we resolved
  // ourselves" (as opposed to coordinates that came straight from the DB or
  // a booking record). Populated by geocoding addresses that don't match a
  // known courier warehouse or service-area city.
  const [resolvedPositions, setResolvedPositions] = useState<Map<string, LatLng>>(new Map());
  const [selectedRouteParcelIds, setSelectedRouteParcelIds] = useState<Set<string>>(new Set());
  const [locallyBookedParcelIds, setLocallyBookedParcelIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [courierRoutes, setCourierRoutes] = useState<Map<string, OptimizeResponse>>(new Map());
  const [lastGeneratedResult, setLastGeneratedResult] = useState<OptimizeResponse | null>(null);
  const [courierStopsMap, setCourierStopsMap] = useState<Map<string, string[]>>(new Map());
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);

  const [creatingBookings, setCreatingBookings] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  const [initialPolyline, setInitialPolyline] = useState<LatLng[] | null>(null);
  const [initialMetrics, setInitialMetrics] = useState<{ distanceMi: number; etaMinutes: number } | null>(null);

  // Modal state for waypoint details
  const [selectedWaypoint, setSelectedWaypoint] = useState<RouteStop | null>(null);
  const [waypointModalOpen, setWaypointModalOpen] = useState(false);
  const [selectedCourierWaypoints, setSelectedCourierWaypoints] = useState<{ courier: string; stops: RouteStop[] } | null>(null);
  const [courierWaypointsModalOpen, setCourierWaypointsModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const origin = useMemo(() => DEPOT_ORIGIN, []);

  /* Modal drag handlers */
  const handleModalMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setModalPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Reset modal position when opening
  useEffect(() => {
    if (courierWaypointsModalOpen) {
      // Start at center (0, 0) since the flex container centers it
      setModalPosition({ x: 0, y: 0 });
    }
  }, [courierWaypointsModalOpen]);

  // Listen for map navigation events from modal
  useEffect(() => {
    const handleCenterMap = (event: Event) => {
      const customEvent = event as CustomEvent<{ lat: number; lng: number; label: string }>;
      const mapContainer = document.querySelector('[data-map-container]');
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const handleShowWaypoints = () => {
      const mapContainer = document.querySelector('[data-map-container]');
      if (mapContainer) {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Optionally close the modal to see all waypoints on map
      setCourierWaypointsModalOpen(false);
      setTimeout(() => setSelectedCourierWaypoints(null), 200);
    };

    window.addEventListener('centerMapOnPoint', handleCenterMap);
    window.addEventListener('showWaypointsOnMap', handleShowWaypoints);
    
    return () => {
      window.removeEventListener('centerMapOnPoint', handleCenterMap);
      window.removeEventListener('showWaypointsOnMap', handleShowWaypoints);
    };
  }, []);

  const bookedParcels = useMemo(
    () => parcels.filter((parcel) => {
      if (locallyBookedParcelIds.has(String(parcel.id))) return false;
      if (!isPickupReadyParcel(parcel) || isAlreadyAssignedToRouteOrTrip(parcel)) return false;
      const status = String(parcel.status || "").trim().toUpperCase();
      if (["DELIVERED", "CANCELLED"].includes(status)) return false;
      const receivedAt = parcel.receivedAt ? new Date(parcel.receivedAt).getTime() : Date.now();
      return Date.now() - receivedAt < ACTIVE_PARCEL_WINDOW_MS;
    }),
    [parcels, locallyBookedParcelIds]
  );
  const bookedUnassignedParcels = useMemo(
    () => bookedParcels,
    [bookedParcels]
  );
  const bookedAssignedParcels = useMemo(
    () => [],
    []
  );
  const qrCodeParcels = useMemo(
    // The route planner generates the display QR from courier and destination
    // grouping, so a picked-up parcel does not need a stored QR value yet.
    () => bookedUnassignedParcels,
    [bookedUnassignedParcels]
  );
  const planningParcels = useMemo(
    () => qrCodeParcels.filter((p) => selectedRouteParcelIds.has(p.id)),
    [qrCodeParcels, selectedRouteParcelIds]
  );

  const qrCodeGroups = useMemo(() => {
    const groups = new Map<string, { key: string; qrCode: string; parcels: typeof qrCodeParcels; courier: string; address: string }>();

    qrCodeParcels.forEach((parcel) => {
      const address = getParcelDisplayAddress(parcel);
      const group = getParcelGroupKey({
        courier: resolveCourierName(parcel.courier || "Unknown"),
        destinationAddress: address,
        destLat: parcel.destLat,
        destLng: parcel.destLng,
      });
      const courier = group.courier;
      const city = group.city;
      const key = group.key;
      const qrCode = `BULK-${key.replace(/::/g, "-")}`;
      const existing = groups.get(key);

      if (existing) {
        existing.parcels.push(parcel);
      } else {
        groups.set(key, {
          key,
          qrCode,
          parcels: [parcel],
          courier,
          address,
        });
      }
    });

    return Array.from(groups.values());
  }, [qrCodeParcels]);
  const selectedQrCodeCount = useMemo(
    () => qrCodeGroups.filter((group) => group.parcels.some((parcel) => selectedRouteParcelIds.has(parcel.id))).length,
    [qrCodeGroups, selectedRouteParcelIds]
  );

  // Default-select every eligible parcel the first time the queue loads,
  // then only ever prune IDs that became ineligible (keep the planner's
  // deliberate de-selections otherwise).
  useEffect(() => {
    setSelectedRouteParcelIds((current) => {
      const eligibleIds = new Set(qrCodeParcels.map((p) => p.id));
      if (current.size === 0) return eligibleIds;
      return new Set([...current].filter((id) => eligibleIds.has(id)));
    });
  }, [qrCodeParcels]);

  // Debug: Log parcel filtering state
  useEffect(() => {
    console.log('[DEBUG] Parcel filtering state:');
    console.log('  - bookedUnassignedParcels:', bookedUnassignedParcels.length);
    console.log('  - bookedAssignedParcels (already in booking):', bookedAssignedParcels.length);
    console.log('  - selectedRouteParcelIds count:', selectedRouteParcelIds.size);
    if (bookedUnassignedParcels.length > 0) {
      console.log('  - bookedUnassignedParcels sample:', bookedUnassignedParcels.slice(0, 3).map((p: any) => ({ 
        id: p.id, 
        status: p.status, 
        bookingId: p.bookingId, 
        routePlanId: p.routePlanId 
      })));
    }
    if (bookedAssignedParcels.length > 0) {
      console.log('  - bookedAssignedParcels sample:', bookedAssignedParcels.slice(0, 3).map((p: any) => ({ 
        id: p.id, 
        status: p.status, 
        bookingId: p.bookingId, 
        routePlanId: p.routePlanId 
      })));
    }
    console.log('  - allParcels count:', parcels.length);
    console.log('  - allParcels statuses:', new Set(parcels.map((p: any) => p.status)));
  }, [bookedUnassignedParcels, bookedAssignedParcels, selectedRouteParcelIds, parcels]);

  /* ---------------- Geocoding fallback for parcels with no coords ---------------- */

  const parcelsMissingCoords = useMemo(
    () =>
      planningParcels.filter(
        (p) => !hasDbCoords(p) && !resolvedPositions.has(p.id)
      ),
    [planningParcels, resolvedPositions]
  );

  useEffect(() => {
    if (parcelsMissingCoords.length === 0) {
      setGeocodeMessage(null);
      return;
    }

    let active = true;
    setGeocoding(true);
    setGeocodeMessage(
      `Geocoding ${parcelsMissingCoords.length} booked parcel${parcelsMissingCoords.length === 1 ? "" : "s"}...`
    );

    (async () => {
      const next = new Map(resolvedPositions);
      for (const parcel of parcelsMissingCoords) {
        if (!active) return;
        const address = getParcelAddress(parcel).trim();
        if (!address || next.has(parcel.id)) continue;
        try {
          const results = await fetchJson(`/api/geocode/search?q=${encodeURIComponent(address)}`);
          const match = Array.isArray(results)
            ? results.find((r: any) => r.lat && r.lon && isWithinPhilippines(Number(r.lat), Number(r.lon)))
            : null;
          if (match) {
            next.set(parcel.id, { lat: Number(match.lat), lng: Number(match.lon) });
          }
        } catch (error) {
          console.warn("Geocode failed for parcel", parcel.id, error);
        }
      }
      if (!active) return;
      setResolvedPositions(next);
      setGeocodeMessage(null);
    })().finally(() => {
      if (active) setGeocoding(false);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelsMissingCoords]);

  /* ---------------- Stops: one per (courier, city), pinned to that   */
  /* courier's fixed warehouse in that city ---------------- */

  const { stops: activeStops, stopParcelCounts } = useMemo(() => {
    const unique = new Map<string, RouteStop>();
    const counts = new Map<string, number>();

    planningParcels.forEach((parcel) => {
      const address = getParcelAddress(parcel) || "Parcel destination";
      const courier = resolveCourierName(parcel.courier);
      const parcelPosition = hasDbCoords(parcel)
        ? normalizePosition({ lat: parcel.destLat, lng: parcel.destLng })
        : normalizePosition(resolvedPositions.get(parcel.id));

      const nearestWarehouse = parcelPosition ? getNearestWarehouseForParcel(courier, parcelPosition) : null;
      const city = resolveKnownCity(address) ?? nearestWarehouse?.city ?? resolveParcelCity(address) ?? "Unknown";
      if (!address && city === "Unknown") return;

      const warehouse = nearestWarehouse ?? getCourierWarehouseLocation(courier, city) ?? listCourierWarehouses(courier)[0] ?? null;
      const warehousePosition = warehouse
        ? { lat: warehouse.lat, lng: warehouse.lng }
        : getCityCoordinate(city)
          ? { lat: getCityCoordinate(city)!.lat, lng: getCityCoordinate(city)!.lng }
          : null;

      if (warehousePosition && (warehousePosition.lat !== 0 || warehousePosition.lng !== 0)) {
        const warehouseKey = warehouse ? `warehouse-${courier}-${warehouse.city}` : `warehouse-${courier}-${city}`;
        if (!unique.has(warehouseKey)) {
          unique.set(warehouseKey, {
            id: warehouseKey,
            label: warehouse ? warehouse.name : `${courier} warehouse • ${city}`,
            courier,
            city: warehouse?.city ?? city,
            kind: "warehouse",
            lat: warehousePosition.lat,
            lng: warehousePosition.lng,
          });
        }
      }

      if (parcelPosition && (parcelPosition.lat !== 0 || parcelPosition.lng !== 0)) {
        const parcelKey = `parcel-${parcel.id}`;
        unique.set(parcelKey, {
          id: parcelKey,
          label: address,
          courier,
          city,
          kind: "parcel",
          parcelId: String(parcel.id),
          lat: parcelPosition.lat,
          lng: parcelPosition.lng,
        });
        counts.set(parcelKey, (counts.get(parcelKey) ?? 0) + 1);
      }
    });

    return {
      stops: sortStopsForNavigation(Array.from(unique.values())),
      stopParcelCounts: counts,
    };
  }, [planningParcels, resolvedPositions]);

  const unmappedBookedParcels = useMemo(
    () => planningParcels.filter((p) => !hasDbCoords(p) && !resolvedPositions.has(p.id)),
    [planningParcels, resolvedPositions]
  );

  /* ---------------- Destination (delivery coverage) resolution ---------------- */

  const parcelAddressDestination = useMemo(() => {
    const targetStops = selectedCourier
      ? activeStops.filter((stop) => stop.courier === selectedCourier)
      : activeStops;

    const candidateParcels = selectedCourier
      ? planningParcels.filter((parcel) => resolveCourierName(parcel.courier) === selectedCourier)
      : planningParcels;

    const fallbackParcel = candidateParcels.find((parcel) => {
      const dbPoint = hasDbCoords(parcel)
        ? normalizePosition({ lat: parcel.destLat, lng: parcel.destLng })
        : null;
      const geoPoint = normalizePosition(resolvedPositions.get(parcel.id));
      return !!(dbPoint || geoPoint);
    }) ?? candidateParcels[0] ?? planningParcels[0] ?? null;

    if (!fallbackParcel) {
      return { ...origin, label: "Parcel destination" };
    }

    const parcelPoint = hasDbCoords(fallbackParcel)
      ? normalizePosition({ lat: fallbackParcel.destLat, lng: fallbackParcel.destLng })
      : normalizePosition(resolvedPositions.get(fallbackParcel.id));

    if (parcelPoint) {
      return {
        lat: parcelPoint.lat,
        lng: parcelPoint.lng,
        label: getParcelAddress(fallbackParcel) || "Parcel destination",
      };
    }

    const actualParcelStop = targetStops.find((stop) => stop.kind !== "warehouse") ?? targetStops[0];
    return actualParcelStop
      ? { lat: actualParcelStop.lat, lng: actualParcelStop.lng, label: actualParcelStop.label }
      : { ...origin, label: "Parcel destination" };
  }, [activeStops, planningParcels, resolvedPositions, selectedCourier, origin]);

  const [destination, setDestination] = useState<LatLng & { label: string }>(parcelAddressDestination);

  useEffect(() => {
    const targetStops = selectedCourier
      ? activeStops.filter((stop) => stop.courier === selectedCourier)
      : activeStops;

    if (targetStops.length === 0) {
      setDestination(parcelAddressDestination);
      return;
    }

    const orderedTargetStops = ensureWarehouseFirst(sortStopsForNavigation(targetStops));
    const finalParcelStop = [...orderedTargetStops].reverse().find((stop) => stop.kind !== "warehouse") ?? orderedTargetStops[0];
    const finalDestination = finalParcelStop ?? orderedTargetStops[0];

    setDestination({
      lat: finalDestination.lat,
      lng: finalDestination.lng,
      label: finalDestination.label,
    });
  }, [activeStops, parcelAddressDestination, selectedCourier]);

  useEffect(() => {
    const syncCoverage = () => {
      const targetStops = selectedCourier
        ? activeStops.filter((stop) => stop.courier === selectedCourier)
        : activeStops;
      if (targetStops.length === 0) {
        setDestination(parcelAddressDestination);
        return;
      }

      const orderedTargetStops = ensureWarehouseFirst(sortStopsForNavigation(targetStops));
      const finalParcelStop = [...orderedTargetStops].reverse().find((stop) => stop.kind !== "warehouse") ?? orderedTargetStops[0];
      setDestination({
        lat: finalParcelStop.lat,
        lng: finalParcelStop.lng,
        label: finalParcelStop.label,
      });
    };
    window.addEventListener("storage", syncCoverage);
    return () => window.removeEventListener("storage", syncCoverage);
  }, [activeStops, parcelAddressDestination, selectedCourier]);

  /* ---------------- Reset optimization state only when selected parcels change ---------------- */

  const routeSelectionKey = useMemo(
    () => planningParcels.map((parcel) => String(parcel.id)).sort().join("|"),
    [planningParcels]
  );

  const previousRouteSelectionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!routeSelectionKey) {
      if (courierRoutes.size > 0 || courierStopsMap.size > 0) {
        setCourierRoutes(new Map());
        setCourierStopsMap(new Map());
        setLastGeneratedResult(null);
      }
      setBookingMessage(null);
      previousRouteSelectionKey.current = null;
      return;
    }

    if (previousRouteSelectionKey.current && previousRouteSelectionKey.current !== routeSelectionKey) {
      setCourierRoutes(new Map());
      setCourierStopsMap(new Map());
      setBookingMessage(null);
    }

    previousRouteSelectionKey.current = routeSelectionKey;
  }, [routeSelectionKey, courierRoutes.size, courierStopsMap.size]);

  /* ---------------- Couriers, colors, vehicles ---------------- */

  const availableCouriers = useMemo(() => {
    const couriers = new Set<string>();
    planningParcels.forEach((p) => couriers.add(resolveCourierName(p.courier)));
    return Array.from(couriers).sort();
  }, [planningParcels]);

  useEffect(() => {
    if (selectedCourier && !availableCouriers.includes(selectedCourier)) {
      setSelectedCourier(null);
    }
  }, [availableCouriers, selectedCourier]);

  const courierColors = useMemo(() => {
    const colors = new Map<string, string>();
    availableCouriers.forEach((courier, idx) => {
      colors.set(courier, COLOR_PALETTE[idx % COLOR_PALETTE.length]);
    });
    return colors;
  }, [availableCouriers]);

  const availableVehicleOptions = useMemo(() => {
    const inventory = (vehicles || []).filter((v) => v.status === "Available");
    return inventory.length
      ? inventory.map((v) => ({ id: v.id, capacityKg: Number(v.capacityKg ?? 500), plate: v.plate, name: v.plate }))
      : [
          { id: "vehicle-1", capacityKg: 500 },
          { id: "vehicle-2", capacityKg: 800 },
          { id: "vehicle-3", capacityKg: 1200 },
        ];
  }, [vehicles]);

  /* ---------------- Initial (unoptimized) route preview via OSRM ---------------- */

  function calculatePolylineMetrics(polyline: LatLng[]): { distanceMi: number; etaMinutes: number } {
    if (!polyline.length) return { distanceMi: 0, etaMinutes: 0 };
    let distanceMi = 0;
    const R = 3958.8;
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i];
      const b = polyline[i + 1];
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const lat1 = (a.lat * Math.PI) / 180;
      const lat2 = (b.lat * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      distanceMi += 2 * R * Math.asin(Math.sqrt(h));
    }
    return { distanceMi: Math.round(distanceMi * 10) / 10, etaMinutes: Math.round((distanceMi / 32) * 60) };
  }

  function isLikelyStraightLinePolyline(polyline: LatLng[] | null | undefined, firstPoint: LatLng, lastPoint: LatLng) {
    if (!polyline || polyline.length < 3) return false;

    const pathDistance = calculatePolylineMetrics(polyline).distanceMi;
    const directDistance = calcDistanceMiles(firstPoint, lastPoint);
    if (!Number.isFinite(directDistance) || directDistance <= 0) return false;

    // A valid generated OSRM route can legitimately be shorter or more direct than
    // the pre-generated preview. Reject only degenerate synthetic paths, not a real
    // road route that happens to be faster.
    return polyline.length <= 5 && pathDistance <= directDistance * 0.08;
  }

  function calcDistanceMiles(a: LatLng, b: LatLng) {
    const R = 3958.8;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  useEffect(() => {
    const routeStops = (selectedCourier
      ? activeStops.filter((stop) => stop.courier === selectedCourier)
      : activeStops
    ).filter((stop) => hasUsableCoordinate(stop));

    if (!routeStops.length || !hasUsableCoordinate(origin) || !hasUsableCoordinate(destination)) {
      setInitialPolyline(null);
      setInitialMetrics(null);
      return;
    }

    setInitialPolyline(null);
    setInitialMetrics(null);

    let active = true;
    (async () => {
      try {
        const coords = [
          [origin.lng, origin.lat],
          ...routeStops.map((s) => [s.lng, s.lat]),
          [destination.lng, destination.lat],
        ].filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && !(lat === 0 && lng === 0));

        if (coords.length < 2) {
          if (!active) return;
          setInitialPolyline(null);
          setInitialMetrics(null);
          return;
        }

        const url = new URL(
          "https://router.project-osrm.org/route/v1/driving/" + coords.map((c) => c.join(",")).join(";")
        );
        url.searchParams.set("geometries", "geojson");
        url.searchParams.set("overview", "full");
        url.searchParams.set("steps", "false");

        const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const json = await res.json();
        const geometry = json?.routes?.[0]?.geometry;
        if (!active) return;
        if (geometry?.type === "LineString") {
          const polyline = geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
          setInitialPolyline(polyline);
          const routeDistanceMi = Number(json?.routes?.[0]?.distance) / 1609.344;
          const routeEtaMinutes = Number(json?.routes?.[0]?.duration) / 60;
          setInitialMetrics({
            distanceMi: Number.isFinite(routeDistanceMi) && routeDistanceMi > 0
              ? Math.round(routeDistanceMi * 10) / 10
              : calculatePolylineMetrics(polyline).distanceMi,
            etaMinutes: Number.isFinite(routeEtaMinutes) && routeEtaMinutes > 0
              ? Math.max(1, Math.round(routeEtaMinutes))
              : Math.max(1, calculatePolylineMetrics(polyline).etaMinutes),
          });
        } else {
          setInitialPolyline(null);
          setInitialMetrics(null);
        }
      } catch (err) {
        if (!active) return;
        console.warn("Failed to fetch initial polyline:", err);
        setInitialPolyline(null);
        setInitialMetrics(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeStops, destination, origin, selectedCourier]);

  /* ---------------- Optimization (shared by "optimize all" and "recalculate one") ---------------- */

  async function requestOptimizedRoute(courierStops: RouteStop[]): Promise<OptimizeResponse> {
    const res = await fetch("/api/optimize-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        stops: courierStops,
        vehicleCount: 1,
        availableVehicles: availableVehicleOptions.slice(0, 1),
        initialDistanceMi: initialMetrics?.distanceMi ?? undefined,
        initialEtaMinutes: initialMetrics?.etaMinutes ?? undefined,
        optimizationMode: "balanced",
        prioritizeFuelEfficiency: false,
      }),
    });
    if (!res.ok) throw new Error(`optimize-route failed: ${res.status}`);
    return res.json();
  }

  /** Optimizes each requested courier's stop list independently and merges
   *  the results into state. Used by both "optimize everyone" and
   *  "recalculate a single courier" — they only differ in which couriers
   *  they pass in and whether a single courier ends up selected after. */
  async function optimizeCouriers(couriers: string[], p0: { selectCourierAfter: any; }) {
    setLoading(true);
    try {
      const stopsByCourier = new Map<string, RouteStop[]>();
      activeStops.forEach((stop) => {
        if (!couriers.includes(stop.courier)) return;
        if (!stopsByCourier.has(stop.courier)) stopsByCourier.set(stop.courier, []);
        stopsByCourier.get(stop.courier)!.push(stop);
      });

      for (const [courier, courierStops] of stopsByCourier.entries()) {
        const sorted = ensureWarehouseFirst(sortStopsForNavigation(courierStops));
        stopsByCourier.set(courier, sorted);
      }

      const settled: { courier: string; stopIds: string[]; data: OptimizeResponse }[] = [];
      for (const [courier, courierStops] of stopsByCourier.entries()) {
        try {
          const data = await requestOptimizedRoute(courierStops);
          const safeOrderedIds = prioritizeWarehouseFirst(courierStops, data.orderedStopIds);
          const normalizedData: OptimizeResponse = {
            ...data,
            orderedStopIds: safeOrderedIds,
            routes: Array.isArray(data.routes)
              ? data.routes.map((route) => ({
                  ...route,
                  orderedStopIds: prioritizeWarehouseFirst(courierStops, route.orderedStopIds),
                }))
              : data.routes,
          };
          settled.push({ courier, stopIds: courierStops.map((s) => s.id), data: normalizedData });
        } catch (err) {
          console.error(`Optimization failed for ${courier}:`, err);
          const fallbackPolyline = buildWarehouseFirstPolyline({
            stops: courierStops,
            origin,
            destination,
            orderedIds: courierStops.map((stop) => stop.id),
          });
          const fallbackMetrics = calculatePolylineMetrics(fallbackPolyline);
          const orderedIds = prioritizeWarehouseFirst(courierStops, courierStops.map((stop) => stop.id));
          settled.push({
            courier,
            stopIds: courierStops.map((s) => s.id),
            data: {
              orderedStopIds: orderedIds,
              polyline: fallbackPolyline,
              distanceMi: fallbackMetrics.distanceMi,
              etaMinutes: Math.max(1, fallbackMetrics.etaMinutes),
              fuelSavingsPct: 0,
              etaImprovementMin: 0,
              engine: "heuristic-fallback",
            },
          });
        }
      }

      const normalizedSettled = settled.map((entry) => {
        const polyline = entry.data.polyline?.length
          ? entry.data.polyline
          : entry.data.routes?.[0]?.polyline || [];
        const polylineMetrics = polyline.length > 1 ? calculatePolylineMetrics(polyline) : null;
        const distanceMi = entry.data.distanceMi > 0 ? entry.data.distanceMi : polylineMetrics?.distanceMi || 0;
        const etaMinutes = entry.data.etaMinutes > 0
          ? entry.data.etaMinutes
          : polylineMetrics?.etaMinutes || calculateEtaMinutes(distanceMi) || 0;
        const fuelSavingsPct = entry.data.fuelSavingsPct > 0
          ? entry.data.fuelSavingsPct
          : calculateFuelSavingsPct(initialMetrics?.distanceMi ?? null, distanceMi);
        const etaImprovementMin = entry.data.etaImprovementMin > 0
          ? entry.data.etaImprovementMin
          : Math.max(0, (initialMetrics?.etaMinutes || calculateEtaMinutes(initialMetrics?.distanceMi ?? null) || 0) - etaMinutes);

        return {
          ...entry,
          data: {
            ...entry.data,
            distanceMi,
            etaMinutes,
            fuelSavingsPct,
            etaImprovementMin,
            polyline: entry.data.polyline?.length ? entry.data.polyline : polyline,
          },
        };
      });

      setCourierRoutes((prev) => {
        const next = new Map(prev);
        normalizedSettled.forEach((entry) => next.set(entry.courier, entry.data));
        return next;
      });
      setCourierStopsMap((prev) => {
        const next = new Map(prev);
        normalizedSettled.forEach((entry) => next.set(entry.courier, entry.stopIds));
        return next;
      });

      const generatedResult = normalizedSettled.length === 1
        ? normalizedSettled[0].data
        : {
            orderedStopIds: normalizedSettled.flatMap((entry) => entry.data.orderedStopIds || []),
            polyline: normalizedSettled.flatMap((entry) => entry.data.polyline || []),
            routes: normalizedSettled.flatMap((entry) => entry.data.routes || []),
            distanceMi: normalizedSettled.reduce((total, entry) => total + (entry.data.distanceMi || 0), 0),
            etaMinutes: Math.max(...normalizedSettled.map((entry) => entry.data.etaMinutes || 0)),
            fuelSavingsPct: normalizedSettled.length
              ? normalizedSettled.reduce((total, entry) => total + (entry.data.fuelSavingsPct || 0), 0) / normalizedSettled.length
              : 0,
            etaImprovementMin: normalizedSettled.reduce((total, entry) => total + (entry.data.etaImprovementMin || 0), 0),
            baselineDistanceMi: normalizedSettled[0]?.data.baselineDistanceMi,
            baselineEtaMinutes: normalizedSettled[0]?.data.baselineEtaMinutes,
            engine: normalizedSettled.some((entry) => entry.data.engine === "or-tools") ? "or-tools" : "heuristic-fallback",
          } satisfies OptimizeResponse;
      setLastGeneratedResult(generatedResult);

      return settled;
    } finally {
      setLoading(false);
    }
  }

  async function handleOptimizeCourier(courier: string) {
    if (!courier) {
      setBookingMessage("Select a courier first before recalculating its route.");
      return;
    }
    if (planningParcels.length === 0) {
      setBookingMessage("Select at least one parcel before generating a route plan.");
      return;
    }
    if (activeStops.length === 0) {
      setBookingMessage("Route plan unavailable: the selected parcels need a valid destination or map coordinates.");
      return;
    }

    setSelectedCourier(courier);
    setBookingMessage(null);
    await optimizeCouriers([courier], { selectCourierAfter: courier });
  }

  async function handleOptimizeSelectedCourier() {
    if (!selectedCourier) {
      setBookingMessage("Select a courier first before recalculating its route.");
      return;
    }
    await handleOptimizeCourier(selectedCourier);
  }

  async function handleOptimizeAllCouriers() {
    if (planningParcels.length === 0) {
      setBookingMessage("Select at least one parcel before generating a route plan.");
      return;
    }
    if (activeStops.length === 0) {
      setBookingMessage("Route plan unavailable: the selected parcels need a valid destination or map coordinates.");
      return;
    }

    setSelectedCourier(null);
    setBookingMessage(null);
    await optimizeCouriers(availableCouriers, { selectCourierAfter: null });
  }

  const selectedCourierStops = useMemo(() => {
    if (!selectedCourier) return activeStops;
    const stops = activeStops.filter((stop) => stop.courier === selectedCourier);
    return ensureWarehouseFirst(stops.length ? stops : activeStops);
  }, [activeStops, selectedCourier]);

  /* ---------------- Derived: which result set is "current" ---------------- */

  const currentResult = useMemo(() => {
    if (selectedCourier && courierRoutes.has(selectedCourier)) {
      const result = courierRoutes.get(selectedCourier)!;
      if (result.etaMinutes > 0 || selectedCourierStops.length === 0) {
        const normalizedOrderedIds = prioritizeWarehouseFirst(selectedCourierStops, result.orderedStopIds);
        return {
          ...result,
          orderedStopIds: normalizedOrderedIds,
          routes: Array.isArray(result.routes)
            ? result.routes.map((route) => ({
                ...route,
                orderedStopIds: prioritizeWarehouseFirst(selectedCourierStops, route.orderedStopIds),
              }))
            : result.routes,
        } satisfies OptimizeResponse;
      }

      const preferredOrderedIds = prioritizeWarehouseFirst(selectedCourierStops, result.orderedStopIds?.length ? result.orderedStopIds : selectedCourierStops.map((stop) => stop.id));
      const rebuiltPolyline = buildWarehouseFirstPolyline({
        stops: selectedCourierStops,
        origin,
        destination,
        orderedIds: preferredOrderedIds,
      });
      const polyline = routePolylineNeedsWarehouseRebuild(selectedCourierStops, result.polyline, preferredOrderedIds)
        ? rebuiltPolyline
        : result.polyline?.length
        ? result.polyline
        : rebuiltPolyline;
      const metrics = calculatePolylineMetrics(polyline);
      return {
        ...result,
        orderedStopIds: preferredOrderedIds,
        polyline,
        distanceMi: result.distanceMi || metrics.distanceMi,
        etaMinutes: Math.max(1, metrics.etaMinutes),
        engine: "heuristic-fallback" as const,
      } satisfies OptimizeResponse;
    }
    if (!selectedCourier && courierRoutes.size > 0) {
      const results = Array.from(courierRoutes.values());
      const polyline = results.flatMap((result) => result.polyline || []);
      return {
        orderedStopIds: results.flatMap((result) => result.orderedStopIds || []),
        polyline,
        routes: results.flatMap((result) => result.routes || []),
        distanceMi: results.reduce((total, result) => total + (result.distanceMi || 0), 0),
        etaMinutes: Math.max(...results.map((result) => result.etaMinutes || 0)),
        fuelSavingsPct: results.length ? Math.round((results.reduce((total, result) => total + (result.fuelSavingsPct || 0), 0) / results.length) * 10) / 10 : 0,
        etaImprovementMin: results.reduce((total, result) => total + (result.etaImprovementMin || 0), 0),
        engine: "or-tools" as const,
      } satisfies OptimizeResponse;
    }
    if (lastGeneratedResult && !selectedCourier) return lastGeneratedResult;
    return null;
  }, [lastGeneratedResult, selectedCourier, courierRoutes]);

  const baselineStops = selectedCourier ? selectedCourierStops : activeStops;
  const baselineFallbackPolyline = buildWarehouseFirstPolyline({
    stops: baselineStops,
    origin,
    destination,
    orderedIds: baselineStops.map((stop) => stop.id),
  });
  const baselineFallbackMetrics = calculatePolylineMetrics(baselineFallbackPolyline);
  const baselineDistanceMi = currentResult?.baselineDistanceMi
    ?? initialMetrics?.distanceMi
    ?? (baselineFallbackMetrics.distanceMi > 0 ? baselineFallbackMetrics.distanceMi : null);
  const baselineEtaMinutes = calculateEtaMinutes(baselineDistanceMi);
  const currentDistanceMi = currentResult?.distanceMi && currentResult.distanceMi > 0
    ? currentResult.distanceMi
    : initialMetrics?.distanceMi ?? null;
  const currentEtaMinutes = currentResult?.etaMinutes && currentResult.etaMinutes > 0
    ? currentResult.etaMinutes
    : calculateEtaMinutes(currentDistanceMi);
  const displayedFuelSavingsPct = currentResult
    ? currentResult.fuelSavingsPct > 0
      ? currentResult.fuelSavingsPct
      : calculateFuelSavingsPct(baselineDistanceMi, currentDistanceMi)
    : 0;
  const displayedEtaImprovementMin = currentEtaMinutes !== null && baselineEtaMinutes !== null
    ? Math.max(0, baselineEtaMinutes - currentEtaMinutes)
    : 0;
  const routePlanningExplanation = planningParcels.length === 0
    ? "There are no picked-up parcels available for route planning. Select or receive parcels first."
    : activeStops.length === 0
    ? "The selected parcels do not have usable destinations or map coordinates yet."
    : selectedCourier
    ? `Showing the active route scope for ${selectedCourier}. Click All couriers to compare every courier.`
    : courierRoutes.size === 0
    ? `Ready to generate routes for ${availableCouriers.length} courier${availableCouriers.length === 1 ? "" : "s"} and ${activeStops.length} stop${activeStops.length === 1 ? "" : "s"}.`
    : `Showing combined data for all ${courierRoutes.size} generated courier route${courierRoutes.size === 1 ? "" : "s"}.`;

  const filteredActiveStops = useMemo(() => {
    if (!selectedCourier) return activeStops;

    const stopIds = new Set(courierStopsMap.get(selectedCourier) || []);
    const bySelectedCourier = selectedCourierStops;
    const matchedStops = activeStops.filter((stop) => stopIds.has(stop.id));
    const resolved = matchedStops.length > 0 ? matchedStops : bySelectedCourier;

    return ensureWarehouseFirst(resolved);
  }, [activeStops, selectedCourier, selectedCourierStops, courierStopsMap]);

  const displayedMapStops = useMemo(() => {
    return selectedCourier ? filteredActiveStops : activeStops;
  }, [activeStops, filteredActiveStops, selectedCourier]);

  // Stops grouped by courier, in optimized order, for the timeline UI.
  const courierWaypoints = useMemo(() => {
    const grouped = new Map<string, RouteStop[]>();
    const stopMap = new Map(activeStops.map((s) => [s.id, s]));

    if (selectedCourier) {
      const selectedStops = selectedCourierStops;
      if (currentResult) {
        const routes = Array.isArray(currentResult.routes) ? currentResult.routes : [];
        const orderedIds = routes.length
          ? routes.flatMap((r) => r.orderedStopIds)
          : currentResult.orderedStopIds;
        const filteredMap = new Map(filteredActiveStops.map((s) => [s.id, s]));
        const stops = (orderedIds || []).map((id) => filteredMap.get(id)).filter((s): s is RouteStop => Boolean(s));
        grouped.set(selectedCourier, stops.length > 0 ? stops : selectedStops);
        return grouped;
      }

      grouped.set(selectedCourier, selectedStops);
      return grouped;
    }

    if (courierRoutes.size > 0) {
      availableCouriers.forEach((courier) => {
        grouped.set(courier, activeStops.filter((stop) => stop.courier === courier));
      });
      for (const [courier, result] of courierRoutes.entries()) {
        const orderedIds = result.routes?.length
          ? result.routes.flatMap((r) => r.orderedStopIds)
          : result.orderedStopIds;
        const stops = (orderedIds || []).map((id) => stopMap.get(id)).filter((s): s is RouteStop => Boolean(s));
        if (stops.length > 0) grouped.set(courier, stops);
      }
      return grouped;
    }

    availableCouriers.forEach((courier) => {
      grouped.set(courier, activeStops.filter((stop) => stop.courier === courier));
    });
    return grouped;
  }, [selectedCourier, selectedCourierStops, courierRoutes, availableCouriers, activeStops, filteredActiveStops, currentResult]);

  const orderedStops = useMemo(() => {
    if (selectedCourier) {
      if (currentResult) {
        const routes = Array.isArray(currentResult.routes) ? currentResult.routes : [];
        const orderedIds = routes.length
          ? routes.flatMap((r) => r.orderedStopIds)
          : currentResult.orderedStopIds;
        const stopMap = new Map(filteredActiveStops.map((s) => [s.id, s]));
        const ordered = prioritizeWarehouseFirst(filteredActiveStops, orderedIds || filteredActiveStops.map((s) => s.id));
        const stops = ordered.map((id) => stopMap.get(id)).filter((s): s is RouteStop => Boolean(s));
        return stops.length ? stops : filteredActiveStops;
      }
      return filteredActiveStops;
    }

    if (courierRoutes.size > 0) {
      return Array.from(courierWaypoints.values()).flat();
    }

    return activeStops;
  }, [selectedCourier, courierRoutes, currentResult, filteredActiveStops, courierWaypoints, activeStops]);

  const visibleCourierWaypoints = useMemo(() => {
    if (selectedCourier) {
      return Array.from(courierWaypoints.entries()).filter(([courier]) => courier === selectedCourier);
    }

    const allStops = Array.from(courierWaypoints.values()).flat();
    const totalStops = allStops.length;

    return totalStops > 0
      ? [["All couriers", allStops] as const, ...Array.from(courierWaypoints.entries())]
      : Array.from(courierWaypoints.entries());
  }, [courierWaypoints, selectedCourier]);

  const selectedRouteTotalStops = useMemo(() => {
    if (!selectedCourier) {
      return Array.from(courierWaypoints.values()).flat().length;
    }

    return courierWaypoints.get(selectedCourier)?.length ?? 0;
  }, [courierWaypoints, selectedCourier]);

  const handleCourierSelection = (courier: string | null) => {
    setSelectedCourier(courier);
    if (courier === null) {
      setCourierRoutes(new Map());
      setCourierStopsMap(new Map());
    }
    setBookingMessage(null);
  };

  /* ---------------- Map markers & polylines ---------------- */

  const markers: MapMarker[] = useMemo(
    () => [
      { id: "origin", position: origin, color: "#b80049", label: "Origin" },
      ...displayedMapStops.map((stop, idx) => {
        const count = stopParcelCounts.get(stop.id) ?? 0;
        const typeLabel = stop.kind === "warehouse" ? "Warehouse" : "Parcel";
        const countLabel = stop.kind === "warehouse" ? ` • ${stop.city || "Address"}` : ` • ${count} parcel${count === 1 ? "" : "s"}`;
        return {
          id: stop.id,
          position: { lat: stop.lat, lng: stop.lng },
          color: courierColors.get(stop.courier) ?? "#3b82f6",
          label: `${idx + 1}. ${stop.label || "Stop"} • ${typeLabel}${countLabel}`,
        };
      }),
      { id: "dest", position: destination, color: "#10b981", label: "Destination" },
    ],
    [displayedMapStops, destination, stopParcelCounts, origin, courierColors]
  );

  const initialPath = useMemo(() => {
    if (!selectedCourier) return null;

    const clean = (polyline: LatLng[] | null | undefined) => {
      if (!polyline) return null;
      const normalized = polyline.map(normalizePosition).filter((p): p is LatLng => p !== null);
      return normalized.length > 1 ? normalized : null;
    };

    return clean(initialPolyline);
  }, [initialPolyline, selectedCourier]);

  const courierColoredPaths = useMemo(() => {
    const colored: Array<{ points: LatLng[]; color: string; label: string }> = [];
    const collect = (courier: string, result: OptimizeResponse | undefined, color: string) => {
      if (!result) return;

      const generatedPolyline = result.polyline?.length ? result.polyline : null;
      const firstRoutePolyline = result.routes?.[0]?.polyline?.length ? result.routes[0].polyline : null;
      const preferredPath = generatedPolyline && generatedPolyline.length >= 4
        ? generatedPolyline
        : firstRoutePolyline && firstRoutePolyline.length >= 4
        ? firstRoutePolyline
        : initialPath && initialPath.length >= 4
        ? initialPath
        : null;

      if (preferredPath && preferredPath.length > 1) {
        colored.push({ points: preferredPath, color, label: courier });
      }
    };

    if (selectedCourier === null && courierRoutes.size > 0) {
      for (const [courier, result] of courierRoutes.entries()) {
        collect(courier, result, courierColors.get(courier) || "#3b82f6");
      }
    } else if (selectedCourier) {
      collect(selectedCourier, courierRoutes.get(selectedCourier), courierColors.get(selectedCourier) || "#b80049");
    }
    return colored;
  }, [selectedCourier, courierRoutes, courierColors, initialPath]);

  const optimizedPath = useMemo(() => {
    if (selectedCourier) {
      const selectedResult = courierRoutes.get(selectedCourier);
      if (!selectedResult) {
        return initialPath && initialPath.length >= 4 ? initialPath : null;
      }

      const generatedPath = selectedResult.polyline?.length
        ? selectedResult.polyline
        : selectedResult.routes?.[0]?.polyline?.length
        ? selectedResult.routes[0].polyline
        : null;

      if (generatedPath && generatedPath.length >= 4) {
        return generatedPath;
      }

      return initialPath && initialPath.length >= 4 ? initialPath : null;
    }

    if (courierRoutes.size > 0) {
      const generatedRoutes = Array.from(courierRoutes.values())
        .map((result) => result.polyline?.length ? result.polyline : result.routes?.[0]?.polyline?.length ? result.routes[0].polyline : null)
        .filter((points): points is LatLng[] => Boolean(points) && points.length >= 4);

      if (generatedRoutes.length > 0) {
        return generatedRoutes[0];
      }
    }

    return initialPath && initialPath.length >= 4 ? initialPath : null;
  }, [initialPath, selectedCourier, courierRoutes]);

  const directionPath = useMemo(() => {
    if (courierRoutes.size > 0) {
      const generatedPaths = Array.from(courierRoutes.entries())
        .map(([courier, result]) => {
          const generatedPolyline = result.polyline?.length
            ? result.polyline
            : result.routes?.[0]?.polyline?.length
            ? result.routes[0].polyline
            : null;
          if (!generatedPolyline || generatedPolyline.length < 4) return null;
          return { courier, points: generatedPolyline };
        })
        .filter((entry): entry is { courier: string; points: LatLng[] } => Boolean(entry));

      if (selectedCourier) {
        const selectedGenerated = generatedPaths.find((entry) => entry.courier === selectedCourier);
        return selectedGenerated ? [selectedGenerated.points] : optimizedPath ? [optimizedPath] : [];
      }

      if (generatedPaths.length > 0) {
        return generatedPaths.map((entry) => entry.points);
      }
    }

    return initialPath ? [initialPath] : [];
  }, [initialPath, optimizedPath, selectedCourier, courierRoutes]);

  /* ---------------- Booking confirmation ---------------- */

  async function handleCreateBookings() {
      const generatedCouriers = Array.from(courierRoutes.keys()).filter((courier) =>
      planningParcels.some((parcel) => resolveCourierName(parcel.courier) === courier)
    );

    if (generatedCouriers.length === 0) {
      setBookingMessage("Generate an optimized route before creating the bookings.");
      return;
    }

    setCreatingBookings(true);
    setBookingMessage(null);

    try {
      const bookedParcelIds: string[] = [];
      const savedCouriers: string[] = [];

      for (const courier of generatedCouriers) {
        const optimizedResult = courierRoutes.get(courier);
        if (!optimizedResult) continue;

        const courierParcels = planningParcels.filter((parcel) => resolveCourierName(parcel.courier) === courier);
        const parcelIds = courierParcels.map((parcel) => parcel.id);
        const courierStopsForPlan = ensureWarehouseFirst(activeStops.filter((stop) => stop.courier === courier).slice());
        const stopById = new Map(courierStopsForPlan.map((stop) => [stop.id, stop]));
        const orderedStopIds = (optimizedResult.orderedStopIds?.length
          ? optimizedResult.orderedStopIds
          : courierStopsForPlan.map((stop) => stop.id)
        ).filter((id) => stopById.has(id));
        const destinations = orderedStopIds
          .map((id, index) => ({ stop: stopById.get(id), index }))
          .filter(({ stop }) => Boolean(stop))
          .map(({ stop, index }) => {
            const safeIndex = index + 1;
            if (stop!.kind === "warehouse") {
              const cityLabel = stop!.city || "Warehouse";
              return {
                id: `${stop!.id}-route-stop-${safeIndex}`,
                name: `${stop!.label} • ${cityLabel} • ${safeIndex}`,
                lat: stop!.lat,
                lng: stop!.lng,
                latitude: stop!.lat,
                longitude: stop!.lng,
                city: cityLabel,
                demand: 0,
                parcel_ids: [],
              };
            }

            const parcel = courierParcels.find((candidate) => String(candidate.id) === String(stop!.parcelId));
            if (!parcel) return null;
            const address = getParcelAddress(parcel) || "Parcel destination";
            const city = resolveKnownCity(address) ?? resolveParcelCity(address) ?? "Unknown City";
            const parcelCoord = hasDbCoords(parcel)
              ? normalizePosition({ lat: parcel.destLat, lng: parcel.destLng })
              : normalizePosition(resolvedPositions.get(parcel.id));
            if (!parcelCoord) return null;
            return {
              id: `${stop!.id}-route-stop-${safeIndex}`,
              name: `${stop!.label || address} • ${city} • ${safeIndex}`,
              lat: parcelCoord.lat,
              lng: parcelCoord.lng,
              latitude: parcelCoord.lat,
              longitude: parcelCoord.lng,
              city,
              demand: Math.max(0, Math.round(Number(parcel.weightKg || 0))),
              parcel_ids: [String(parcel.id)],
            };
          })
          .filter((destination): destination is NonNullable<typeof destination> => destination !== null);

        if (parcelIds.length === 0 || destinations.length === 0) continue;

        const fallbackPolyline = buildWarehouseFirstPolyline({
          stops: courierStopsForPlan,
          origin,
          destination,
          orderedIds: orderedStopIds,
        });
        const routePolyline = optimizedResult.polyline?.length ? optimizedResult.polyline : fallbackPolyline;
        const fallbackMetrics = calculatePolylineMetrics(fallbackPolyline);
        const routePlanKey = `${courier}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const routePlan = await createRoutePlan({
          courier,
          bulk_qr_code: routePlanKey,
          pickup_location: origin.label,
          pickup_latitude: origin.lat,
          pickup_longitude: origin.lng,
          delivery_destinations: destinations,
          route_geojson: {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: { type: "LineString", coordinates: routePolyline.map((point) => [point.lng, point.lat]) },
              properties: {
                orderedStopIds,
                distanceMi: optimizedResult.distanceMi || fallbackMetrics.distanceMi,
                etaMinutes: optimizedResult.etaMinutes || fallbackMetrics.etaMinutes,
                fuelSavingsPct: optimizedResult.fuelSavingsPct,
              },
            }],
          },
          distance_km: Number(((optimizedResult.distanceMi || fallbackMetrics.distanceMi) * 1.609344).toFixed(2)),
          estimated_duration_min: Math.max(1, Math.round(optimizedResult.etaMinutes || fallbackMetrics.etaMinutes)),
          generated_by: optimizedResult.engine || "OR-Tools",
          status: "assigned",
        });

        if (!routePlan?.id) throw new Error(`${courier}: route plan save failed.`);
        const persistedDestinations = Array.isArray(routePlan.deliveryDestinations) && routePlan.deliveryDestinations.length
          ? routePlan.deliveryDestinations
          : destinations;
        const dropoffLabel = persistedDestinations.map((item: any) => item.name).filter(Boolean).join(" \u2192 ") || destination.label;
        const response = await createBulkBooking({
          courier,
          bulk_qr_code: routePlanKey,
          parcel_ids: parcelIds,
          pickup_location: origin.label,
          pickup_latitude: origin.lat,
          pickup_longitude: origin.lng,
          dropoff_location: dropoffLabel,
          route_plan_id: routePlan.id,
        });

        createRouteBooking(parcelIds, `${origin.label} \u2192 ${dropoffLabel}`, response.booking?.id, routePlan.id, persistedDestinations);
        bookedParcelIds.push(...parcelIds.map(String));
        savedCouriers.push(courier);
      }

      if (savedCouriers.length === 0) throw new Error("No generated courier routes could be saved.");
      setLocallyBookedParcelIds((current) => new Set([...current, ...bookedParcelIds]));
      setSelectedRouteParcelIds((current) => new Set([...current].filter((id) => !bookedParcelIds.includes(String(id)))));
      setBookingMessage(`Saved ${savedCouriers.length} courier booking${savedCouriers.length === 1 ? "" : "s"}: ${savedCouriers.join(", ")}.`);
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : "Unable to create the optimized booking.");
    } finally {
      setCreatingBookings(false);
    }
  }

  /* ---------------- Render helpers ---------------- */

  function resolveParcelDisplayPosition(parcel: any) {
    let bookingPos: LatLng | null = null;
    if (parcel.bookingId && Array.isArray(bookings) && bookings.length > 0) {
      const booking = bookings.find(
        (b: any) => String(b.id) === String(parcel.bookingId) || (Array.isArray(b.parcelIds) && b.parcelIds.map(String).includes(String(parcel.id)))
      );
      if (booking) {
        const dests = Array.isArray(booking.deliveryDestinations) ? booking.deliveryDestinations : [];
        if (dests.length > 0 && isValidLatLngLike(dests[0])) {
          const d = dests[0] as any;
          bookingPos = { lat: Number(d.lat ?? d.latitude), lng: Number(d.lng ?? d.lon ?? d.longitude) };
        } else if (isValidLatLngLike({ lat: booking.dropoffLatitude, lng: booking.dropoffLongitude })) {
          bookingPos = { lat: Number(booking.dropoffLatitude), lng: Number(booking.dropoffLongitude) };
        }
      }
    }

    const parcelPos = hasDbCoords(parcel) ? normalizePosition({ lat: parcel.destLat, lng: parcel.destLng }) : null;
    const geocodedPos = normalizePosition(resolvedPositions.get(parcel.id));
    const displayedPos = normalizePosition(bookingPos) ?? parcelPos ?? geocodedPos ?? null;
    const source = bookingPos ? "booking" : parcelPos ? "parcel" : geocodedPos ? "geocoded" : null;
    return { displayedPos, source };
  }

  function getParcelDisplayAddress(parcel: any) {
    let address = getParcelAddress(parcel) || "";
    if (!address && parcel.bookingId && Array.isArray(bookings) && bookings.length > 0) {
      const booking = bookings.find(
        (b: any) => String(b.id) === String(parcel.bookingId) || (Array.isArray(b.parcelIds) && b.parcelIds.map(String).includes(String(parcel.id)))
      );
      address = booking?.routeLabel || "";
    }
    return address || "No address provided";
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-inherit font-sans antialiased">
      <GlobalNavbar />

      {loading && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
          <div className="w-[min(92vw,420px)] rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-4 flex h-20 w-28 items-center justify-center overflow-hidden rounded-2xl bg-rose-50">
                <div className="absolute left-2 right-2 top-1/2 flex -translate-y-1/2 items-center justify-between">
                  <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
                  <div className="ml-4 h-2 w-16 rounded-full bg-rose-200">
                    <div className="h-full w-1/2 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-4xl text-rose-600 animate-bounce">local_shipping</span>
                </div>
                <div className="absolute -left-8 bottom-3 h-3 w-16 rounded-full bg-slate-300/80" />
                <div className="absolute bottom-3 right-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-rose-500">Route planning</p>
              <h3 className="mt-2 text-xl font-extrabold text-slate-900">Generating route plan</h3>
              <p className="mt-2 text-sm text-slate-600">Optimizing courier stops and delivery sequence for the selected parcels.</p>

              <div className="mt-5 flex w-full items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-rose-100">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-fuchsia-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Route Planning Workspace</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Solver
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Build a delivery plan from booked parcels, automatically optimize the stop order, then send the confirmed plan to Bookings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentResult && (
              <div className="flex items-center gap-2 self-start sm:self-auto text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
                <span className="material-symbols-outlined text-base text-slate-500">memory</span>
                <span>Engine:</span>
                <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                  {currentResult.engine}
                </span>
              </div>
            )}
           
          </div>
        </div>

        {/* 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Map & KPIs */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#b80049] shrink-0" />
                  <span className="truncate max-w-[180px]" title={origin.label}>
                    <strong className="text-slate-800">Origin:</strong> {origin.label}
                  </span>
                </div>
                <span className="text-slate-300 hidden sm:inline">\u2192</span>
                <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate max-w-[180px]" title={destination.label}>
                    <strong className="text-slate-800">Dest:</strong> {destination.label}
                  </span>
                </div>
              </div>

              <div className={`rounded-xl border px-4 py-3 text-sm ${planningParcels.length === 0 || activeStops.length === 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-600"}`} role="status">
                <p className="font-semibold">{routePlanningExplanation}</p>
                {!currentResult && <p className="mt-1 text-xs text-slate-500">Distance and duration will appear here after you generate a route.</p>}
              </div>

              <div className="h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm relative">
                <LeafletMap
                  data-map-container
                  zoom={7}
                  markers={markers}
                  coloredPaths={courierColoredPaths}
                  initialPath={selectedCourier ? initialPath : null}
                  optimizedPath={selectedCourier ? optimizedPath : null}
                  routeColor="#b80049"
                />

                <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-4 text-[11px] font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b80049]" /> Origin
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Waypoints ({displayedMapStops.length})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Destination
                  </span>
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="rounded-2xl border border-pink-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900">Generated route calculations</h3>
                <span className="text-xs font-semibold text-emerald-600">{currentResult ? "Calculated" : "Generate a route plan"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Fuel Savings"
                icon="local_gas_station"
                iconColor="text-emerald-600"
                value={currentResult ? `${formatFiveDigitValue(displayedFuelSavingsPct)}%` : "0%"}
                caption={currentResult && baselineDistanceMi !== null && currentDistanceMi !== null
                  ? currentDistanceMi > baselineDistanceMi
                    ? `Generated route is ${(currentDistanceMi - baselineDistanceMi).toFixed(1)} mi longer`
                    : `Baseline ${baselineDistanceMi} mi → generated ${currentDistanceMi} mi`
                  : "Calculated after generation"}
              />
              <KpiCard
                label="ETA Impact"
                icon="timer"
                iconColor="text-blue-600"
                value={currentResult && displayedEtaImprovementMin > 0 ? `-${formatDuration(displayedEtaImprovementMin)}` : "0m"}
                caption={currentResult
                  ? displayedEtaImprovementMin > 0
                    ? "time reduced"
                    : currentEtaMinutes !== null && baselineEtaMinutes !== null && currentEtaMinutes > baselineEtaMinutes
                    ? "longer than baseline"
                    : "No time reduction"
                  : "Calculated after generation"}
              />
              <KpiCard
                label="Distance"
                icon="distance"
                iconColor="text-amber-600"
                value={currentDistanceMi !== null ? `${currentDistanceMi} mi` : "—"}
                caption={
                  currentDistanceMi !== null && baselineDistanceMi !== null
                    ? `${baselineDistanceMi} mi → ${currentDistanceMi} mi`
                    : currentDistanceMi !== null
                    ? "total polyline"
                    : "total polyline"
                }
              />
              <KpiCard
                label="Est. Duration"
                icon="schedule"
                iconColor="text-[#b80049]"
                value={currentEtaMinutes !== null ? formatDuration(currentEtaMinutes) : "—"}
                caption={
                  currentEtaMinutes !== null && baselineEtaMinutes !== null
                    ? `${formatDuration(baselineEtaMinutes)} → ${formatDuration(currentEtaMinutes)}`
                    : currentEtaMinutes !== null
                    ? "in-transit time"
                    : "in-transit time"
                }
              />
              </div>
            </div>
          </div>

          {/* RIGHT: Parameters & Route Control */}
          <div className="contents">
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Planning Queue */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Planning Queue</p>
                    <p className="text-sm text-slate-500">Select the QR codes to include in this delivery route.</p>
                  </div>
                  <span className="text-xs font-semibold text-[#b80049]">{selectedQrCodeCount} QR selected</span>
                </div>

                {qrCodeParcels.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No booked parcel QR codes are available for route planning.
                  </div>
                ) : (
                  <>
                    {bookedAssignedParcels.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-3">
                        {bookedAssignedParcels.length} booked parcel{bookedAssignedParcels.length === 1 ? "" : "s"} already have a route booking.
                        <button
                          type="button"
                          onClick={() => router.push("/vrds/bookings")}
                          className="ml-2 text-xs font-semibold text-[#b80049] underline"
                        >
                          Open Bookings
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1">
                      {qrCodeGroups.map((group) => {
                        const isSelected = group.parcels.some((parcel) => selectedRouteParcelIds.has(parcel.id));

                        return (
                          <label
                            key={group.key}
                            className={`flex h-full cursor-pointer flex-col rounded-xl border p-3 transition-colors ${
                              isSelected ? "border-[#b80049]/40 bg-pink-50/60 ring-1 ring-[#b80049]/15" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2">
                                {createElement(QRCodeSVG as any, {
                                  value: group.qrCode,
                                  size: 88,
                                  level: "M",
                                  includeMargin: true,
                                  "aria-label": `QR code ${group.qrCode}`,
                                })}
                              </div>
                              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedRouteParcelIds((current) => {
                                      const next = new Set(current);
                                      const groupParcelIds = group.parcels.map((parcel) => parcel.id);
                                      const hasAnySelected = groupParcelIds.some((id) => next.has(id));

                                      groupParcelIds.forEach((id) => {
                                        if (hasAnySelected) next.delete(id);
                                        else next.add(id);
                                      });

                                      return next;
                                    })
                                  }
                                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-[#b80049] focus:ring-[#b80049]"
                                />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">QR Code</p>
                                  <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-900">{group.qrCode}</p>
                                  <p className="mt-2 text-[11px] font-medium text-slate-600">{group.courier || "Unknown"}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  {group.parcels.length}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                {courierRoutes.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600">
                        {courierRoutes.size} courier{courierRoutes.size === 1 ? "" : "s"} optimized
                      </p>
                      {selectedCourier && (
                        <button
                          type="button"
                          onClick={handleOptimizeSelectedCourier}
                          disabled={loading}
                          className="text-[11px] font-semibold text-[#b80049] underline decoration-[#b80049]/30 underline-offset-2 disabled:opacity-60"
                        >
                          {loading ? "Recalculating..." : "Recalculate selected"}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedCourier && (
                        <button
                          type="button"
                          onClick={() => handleCourierSelection(null)}
                          className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          Unselect
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCourierSelection(null)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedCourier === null
                            ? "bg-slate-800 text-white border border-slate-800"
                            : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        All couriers
                      </button>
                      {Array.from(courierRoutes.keys())
                        .sort()
                        .map((courier) => (
                          <button
                            key={courier}
                            onClick={() => handleCourierSelection(courier)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              selectedCourier === courier
                                ? "bg-[#b80049] text-white border border-[#b80049]"
                                : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {courier}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {currentResult && (
                  <button
                    type="button"
                    onClick={handleCreateBookings}
                    disabled={creatingBookings || planningParcels.length === 0}
                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-2.5 px-4 font-semibold text-sm transition-colors disabled:opacity-60"
                  >
                    {creatingBookings ? "Confirming Route..." : "Confirm Route & Move to Bookings"}
                  </button>
                )}
                {bookingMessage && <p className="text-xs font-semibold text-slate-600">{bookingMessage}</p>}
                {bookedUnassignedParcels.length === 0 && bookedParcels.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    All booked parcels already have route bookings. Use the Bookings page to assign drivers and vehicles.
                  </p>
                )}

              </div>
            </div>

            {/* Optimized route cards */}
            <div className="lg:col-span-12 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 text-lg">format_list_bulleted</span>
                  Optimized Waypoint Sequence
                </h3>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-slate-400 sm:inline">Click to preview; use Generate route plan to calculate</span>
                  <span className="text-xs text-slate-400">{selectedRouteTotalStops} total stop{selectedRouteTotalStops === 1 ? "" : "s"}</span>
                </div>
              </div>

              {visibleCourierWaypoints.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleCourierWaypoints.map(([courier, courierStops]) => {
                    const isAllCouriersCard = courier === "All couriers";
                    const cardCourier = isAllCouriersCard ? "All couriers" : courier;
                    const cardResult = isAllCouriersCard ? currentResult : courierRoutes.get(courier);
                    const cardDistance = cardResult?.distanceMi && cardResult.distanceMi > 0 ? cardResult.distanceMi : null;
                    const cardEta = cardResult?.etaMinutes && cardResult.etaMinutes > 0 ? cardResult.etaMinutes : calculateEtaMinutes(cardDistance);
                    const cardFuel = cardResult
                      ? cardResult.fuelSavingsPct > 0
                        ? cardResult.fuelSavingsPct
                        : calculateFuelSavingsPct(baselineDistanceMi, cardDistance)
                      : null;
                    const courierLogo = isAllCouriersCard ? null : COURIER_LOGOS[courier] ?? null;
                    const courierShortLabel = isAllCouriersCard
                      ? "ALL"
                      : courier
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? "")
                          .join("") || "C";

                    return (
                      <div
                        key={cardCourier}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedCourier === courier || (isAllCouriersCard && selectedCourier === null)}
                        onClick={() => handleCourierSelection(isAllCouriersCard ? null : courier)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleCourierSelection(isAllCouriersCard ? null : courier);
                          }
                        }}
                        className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-white transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#b80049] focus:ring-offset-2 ${isAllCouriersCard ? (selectedCourier === null ? "border-[#b80049] shadow-lg ring-2 ring-[#b80049]/20" : "border-slate-200 hover:border-slate-400") : selectedCourier === courier ? "border-[#b80049] shadow-lg ring-2 ring-[#b80049]/20" : "border-slate-200 hover:border-slate-400"}`}
                      >
                        {courierLogo ? (
                          <div className="absolute inset-0 z-0 bg-slate-100">
                            <img
                              src={courierLogo}
                              alt={`${courier} logo`}
                              className="h-full w-full object-contain object-center opacity-100"
                            />
                          </div>
                        ) : (
                          <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-200 text-3xl font-black text-slate-700">
                            {courierShortLabel}
                          </div>
                        )}

                        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/5 via-black/15 to-black/45" />

                        <div className="relative z-10 flex h-full min-h-[250px] justify-end transition-all duration-300">
                          <div className="self-end w-full rounded-t-xl border-t border-white/15 bg-black/10 px-3 py-2.5 text-right text-xs text-white backdrop-blur-sm">
                            <span className="inline-flex rounded-full bg-white/90 px-2.5 py-1 font-bold text-slate-700 shadow-sm">
                              {courierStops.length} stop{courierStops.length === 1 ? "" : "s"}
                            </span>
                            {cardResult && (
                              <div className="mt-2 grid grid-cols-3 gap-1 text-left text-[10px] font-semibold text-white">
                                <span className="rounded-md bg-black/35 px-1.5 py-1">{cardDistance !== null ? `${cardDistance} mi` : "Distance —"}</span>
                                <span className="rounded-md bg-black/35 px-1.5 py-1">{cardEta !== null ? formatDuration(cardEta) : "ETA —"}</span>
                                <span className="rounded-md bg-black/35 px-1.5 py-1">{cardFuel !== null ? `${formatFiveDigitValue(cardFuel)}%` : "Fuel —"}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2.5 bg-black/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100 p-3">
                          {!isAllCouriersCard && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedCourierWaypoints({ courier, stops: courierStops });
                                  setCourierWaypointsModalOpen(true);
                                }}
                                className="min-w-[92px] rounded-md bg-white hover:bg-slate-50 text-slate-900 font-semibold py-2 px-3 text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm">visibility</span>
                                View
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleOptimizeCourier(courier);
                                }}
                                disabled={loading}
                                className="min-w-[110px] rounded-md bg-[#b80049] hover:bg-[#a0003f] disabled:bg-[#b80049]/50 text-white font-semibold py-2 px-3 text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5"
                              >
                                {loading ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ...
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                    Generate route plan
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          {isAllCouriersCard && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCourierSelection(null);
                              }}
                              className="min-w-[120px] rounded-md bg-white hover:bg-slate-50 text-slate-900 font-semibold py-2 px-3 text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">dashboard</span>
                              Show combined
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Waypoint Details Modal */}
      {waypointModalOpen && selectedWaypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                  📍
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Waypoint Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedWaypoint.courier} Delivery</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setWaypointModalOpen(false);
                  setTimeout(() => setSelectedWaypoint(null), 200);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Stop Info */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Stop Location</p>
                <p className="text-lg font-bold text-slate-900 mb-1">{selectedWaypoint.label}</p>
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="material-symbols-outlined text-base text-slate-400 mt-0.5">location_on</span>
                  <div>
                    <p className="font-mono text-xs font-semibold text-slate-700">{selectedWaypoint.lat}</p>
                    <p className="font-mono text-xs font-semibold text-slate-700">{selectedWaypoint.lng}</p>
                  </div>
                </div>
              </div>

              {/* Courier & ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Courier</p>
                  <p className="text-sm font-bold text-blue-900">{selectedWaypoint.courier}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 border border-purple-100">
                  <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1">Stop ID</p>
                  <p className="text-xs font-mono font-bold text-purple-900 break-all">{selectedWaypoint.id.substring(0, 8)}...</p>
                </div>
              </div>

              {/* Coordinates */}
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2">Coordinates</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 font-medium">Latitude:</span>
                    <span className="font-mono text-xs font-bold text-amber-900">{selectedWaypoint.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 font-medium">Longitude:</span>
                    <span className="font-mono text-xs font-bold text-amber-900">{selectedWaypoint.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>

              {/* Map Link */}
              <a
                href={`https://maps.google.com/?q=${selectedWaypoint.lat},${selectedWaypoint.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 text-sm transition-colors"
              >
                <span className="material-symbols-outlined text-base">public</span>
                Open in Google Maps
              </a>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-3 flex gap-2">
              <button
                onClick={() => {
                  setWaypointModalOpen(false);
                  setTimeout(() => setSelectedWaypoint(null), 200);
                }}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courier Waypoints Modal - Show all waypoints for a courier */}
      {courierWaypointsModalOpen && selectedCourierWaypoints && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            ref={modalRef}
            onMouseDown={handleModalMouseDown}
            style={{
              transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
              cursor: isDragging ? 'grabbing' : 'auto',
              userSelect: isDragging ? 'none' : 'auto'
            }}
            className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-200 max-h-[70vh] overflow-hidden flex flex-col"
          >
            {/* Header - Draggable */}
            <div 
              className="flex items-center justify-between border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-slate-50 to-white cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleModalMouseDown}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b80049]/10">
                  <span className="text-sm">🗺️</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{selectedCourierWaypoints.courier}</h2>
                  <p className="text-xs text-slate-400">{selectedCourierWaypoints.stops.length} waypoint{selectedCourierWaypoints.stops.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCourierWaypointsModalOpen(false);
                  setTimeout(() => setSelectedCourierWaypoints(null), 200);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-2">
              {selectedCourierWaypoints.stops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="group flex items-start gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition-all hover:shadow-sm border border-slate-100/50 hover:border-slate-200/50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#b80049]/10 text-xs font-semibold text-[#b80049] group-hover:bg-[#b80049]/20 transition-colors">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm mb-0.5 truncate">{stop.label}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                      <span className="font-mono font-medium">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Center map on this waypoint
                      const mapElement = document.querySelector('[data-map-container]');
                      if (mapElement) {
                        window.dispatchEvent(new CustomEvent('centerMapOnPoint', { detail: { lat: stop.lat, lng: stop.lng, label: stop.label } }));
                      }
                    }}
                    className="shrink-0 p-1.5 rounded-md bg-white hover:bg-[#b80049]/10 border border-slate-200 hover:border-[#b80049]/30 transition-all"
                    title="View on map"
                  >
                    <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-[#b80049]">location_on</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-5 py-3 bg-gradient-to-r from-white to-slate-50 flex gap-2">
              <button
                onClick={() => {
                  setCourierWaypointsModalOpen(false);
                  setTimeout(() => setSelectedCourierWaypoints(null), 200);
                }}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Show all waypoints on map
                  window.dispatchEvent(new CustomEvent('showWaypointsOnMap', { detail: selectedCourierWaypoints.stops }));
                }}
                className="flex-1 rounded-lg bg-[#b80049] hover:bg-[#a0003f] text-white font-medium py-2 text-sm transition-colors"
              >
                Show All
              </button>
            </div>
          </div>
        </div>
      )}

      <GlobalFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  icon,
  iconColor,
  value,
  caption,
}: {
  label: string;
  icon: string;
  iconColor: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</span>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <span className="text-[10px] text-slate-400">{caption}</span>
    </div>
  );
}

