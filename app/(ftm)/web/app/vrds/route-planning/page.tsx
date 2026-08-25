"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import { createRouteBooking, useParcelStore, refreshStoreFromBackend } from "../../lib/parcelStore";
import { createBulkBooking, createRoutePlan, fetchJson } from "../../lib/api";
import { getCityCoordinate } from "../../lib/serviceAreas";
import { getCourierWarehouse, resolveKnownCity } from "../../lib/courierWarehouses";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 animate-pulse rounded-2xl">
      <span className="material-symbols-outlined text-4xl mb-2">map</span>
      <span className="text-sm font-medium">Loading Map Engine...</span>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RouteStop = { id: string; label: string; lat: number; lng: number; courier: string };
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

const BOOKED_STATUSES = new Set(["BOOKED", "IN_TRANSIT", "PICKED_UP", "READY", "RECEIVED"]);

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

function isBookedParcel(parcel: { status?: string }) {
  return BOOKED_STATUSES.has(String(parcel.status || "").trim().toUpperCase());
}

function isAlreadyAssignedToRouteOrTrip(parcel: any) {
  const status = String(parcel?.status || "").trim().toUpperCase();
  if (["IN_TRANSIT", "DELIVERED", "CANCELLED"].includes(status)) return true;

  const routeAssignment = parcel?.routePlanId || parcel?.route_plan_id || parcel?.routeId || parcel?.route_id;
  const tripAssignment = parcel?.tripId || parcel?.trip_id || parcel?.trip?.id;
  return Boolean(routeAssignment || tripAssignment || parcel?.bookingId);
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
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) return { lat: lng, lng: lat };
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  return null;
}

function isValidLatLngLike(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  const lat = Number(v.lat ?? v.latitude);
  const lng = Number(v.lng ?? v.lon ?? v.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
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

/** One place that decides which delivery city/point the plan is targeting,
 *  given the persisted "service area" filter from the Bulk page. Used by
 *  every effect/memo that needs to resolve a destination — previously this
 *  logic was copy-pasted three times with small drifts between copies. */
function resolveDestinationForCoverage(
  coverage: string | null,
  stops: RouteStop[],
  fallback: LatLng & { label: string }
): LatLng & { label: string } {
  const base = stops[0] ?? fallback;

  if (!coverage || coverage === ALL_SERVICE_CITIES_LABEL) {
    return { ...base, label: ALL_SERVICE_CITIES_LABEL };
  }

  const cityCoord = getCityCoordinate(coverage);
  if (cityCoord) {
    return { lat: cityCoord.lat, lng: cityCoord.lng, label: coverage };
  }

  const matchingStop = stops.find((stop) => stop.label === coverage);
  return matchingStop ? { ...matchingStop, label: coverage } : { ...fallback, label: coverage };
}

function readPersistedServiceArea(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(PERSISTED_SERVICE_AREA_KEY);
  if (!stored || stored === ALL_SERVICE_AREA_SENTINEL) return ALL_SERVICE_CITIES_LABEL;
  return stored || null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function VrdsRoutePlanningPage() {
  const router = useRouter();
  const { parcels, vehicles, bookings } = useParcelStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  // Single source of truth for "parcel destination coordinates we resolved
  // ourselves" (as opposed to coordinates that came straight from the DB or
  // a booking record). Populated by geocoding addresses that don't match a
  // known courier warehouse or service-area city.
  const [resolvedPositions, setResolvedPositions] = useState<Map<string, LatLng>>(new Map());
  const [selectedRouteParcelIds, setSelectedRouteParcelIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [courierRoutes, setCourierRoutes] = useState<Map<string, OptimizeResponse>>(new Map());
  const [courierStopsMap, setCourierStopsMap] = useState<Map<string, string[]>>(new Map());
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);

  const [creatingBookings, setCreatingBookings] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  const [initialPolyline, setInitialPolyline] = useState<LatLng[] | null>(null);
  const [initialMetrics, setInitialMetrics] = useState<{ distanceMi: number; etaMinutes: number } | null>(null);

  const origin = useMemo(() => DEPOT_ORIGIN, []);

  /* ---------------- Parcel refresh on load ---------------- */

  useEffect(() => {
    (async () => {
      setIsRefreshing(true);
      try {
        await refreshStoreFromBackend();
      } catch (error) {
        console.warn("Failed to refresh parcels:", error);
      } finally {
        setIsRefreshing(false);
      }
    })();
  }, []);

  async function handleManualRefresh() {
    setIsRefreshing(true);
    try {
      await refreshStoreFromBackend();
    } catch (error) {
      console.error("Failed to refresh parcels:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  /* ---------------- Derived parcel sets ---------------- */

  // Build a set of all parcel IDs that are already in bookings
  const bookedParcelIds = useMemo(
    () => {
      const ids = new Set<string>();
      bookings.forEach((booking) => {
        (booking.parcelIds || []).forEach((parcelId) => {
          ids.add(String(parcelId));
        });
      });
      return ids;
    },
    [bookings]
  );

  const bookedParcels = useMemo(
    () => parcels.filter((parcel) => isBookedParcel(parcel) && !isAlreadyAssignedToRouteOrTrip(parcel)),
    [parcels]
  );
  const bookedUnassignedParcels = useMemo(
    () => bookedParcels.filter((p) => !p.bookingId && !bookedParcelIds.has(p.id)),
    [bookedParcels, bookedParcelIds]
  );
  const bookedAssignedParcels = useMemo(
    () => bookedParcels.filter((p) => p.bookingId || bookedParcelIds.has(p.id)),
    [bookedParcels, bookedParcelIds]
  );
  const planningParcels = useMemo(
    () => bookedUnassignedParcels.filter((p) => selectedRouteParcelIds.has(p.id)),
    [bookedUnassignedParcels, selectedRouteParcelIds]
  );

  // Default-select every eligible parcel the first time the queue loads,
  // then only ever prune IDs that became ineligible (keep the planner's
  // deliberate de-selections otherwise).
  useEffect(() => {
    setSelectedRouteParcelIds((current) => {
      const eligibleIds = new Set(bookedUnassignedParcels.map((p) => p.id));
      if (current.size === 0) return eligibleIds;
      return new Set([...current].filter((id) => eligibleIds.has(id)));
    });
  }, [bookedUnassignedParcels]);

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
    console.log('  - bookedParcelIds count:', bookedParcelIds.size);
    console.log('  - allParcels count:', parcels.length);
    console.log('  - allParcels statuses:', new Set(parcels.map((p: any) => p.status)));
  }, [bookedUnassignedParcels, bookedAssignedParcels, selectedRouteParcelIds, bookedParcelIds, parcels]);

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
      const city = resolveKnownCity(address) ?? resolveParcelCity(address);
      const courier = parcel.courier || "LBC";
      if (city === "Unknown" && !address) return;

      const warehouse = getCourierWarehouse(courier, city);

      // Fallback chain when the courier has no fixed warehouse in this
      // city: service-area city centroid -> exact DB coords -> geocoded
      // coords resolved above.
      let position: LatLng | null = null;
      if (warehouse) {
        position = { lat: warehouse.lat, lng: warehouse.lng };
      } else {
        const cityCoord = getCityCoordinate(city);
        const exactPosition = hasDbCoords(parcel)
          ? normalizePosition({ lat: parcel.destLat, lng: parcel.destLng })
          : null;
        const geocodedPosition = normalizePosition(resolvedPositions.get(parcel.id));
        position = cityCoord ? { lat: cityCoord.lat, lng: cityCoord.lng } : exactPosition ?? geocodedPosition;
      }

      if (!position || (position.lat === 0 && position.lng === 0)) return;

      const key = `${courier}::${city}`;
      if (!unique.has(key)) {
        unique.set(key, {
          id: `stop-${key.replace(/\s+/g, "-")}`,
          label: warehouse ? warehouse.name : city !== "Unknown" ? `${courier} \u2013 ${city}` : address,
          courier,
          ...position,
        });
      }
      const stopId = `stop-${key.replace(/\s+/g, "-")}`;
      counts.set(stopId, (counts.get(stopId) ?? 0) + 1);
    });

    return { stops: Array.from(unique.values()), stopParcelCounts: counts };
  }, [planningParcels, resolvedPositions]);

  const unmappedBookedParcels = useMemo(
    () => planningParcels.filter((p) => !hasDbCoords(p) && !resolvedPositions.has(p.id)),
    [planningParcels, resolvedPositions]
  );

  /* ---------------- Destination (delivery coverage) resolution ---------------- */

  const currentFallbackDestination = useMemo(
    () => ({ ...DEPOT_ORIGIN, label: "Airship Express - Binondo, Manila" }),
    []
  );

  const [destination, setDestination] = useState<LatLng & { label: string }>(currentFallbackDestination);

  useEffect(() => {
    const persisted = readPersistedServiceArea();
    setDestination((prev) => {
      if (persisted) {
        return resolveDestinationForCoverage(persisted, activeStops, currentFallbackDestination);
      }
      if (activeStops.length === 0) return currentFallbackDestination;
      const isUsingFallback =
        prev.label === "Manila" ||
        prev.label === "Route Preview" ||
        prev.label === "Airship Express Hub - Binondo, Manila";
      return isUsingFallback ? { ...activeStops[0] } : prev;
    });
  }, [activeStops, currentFallbackDestination]);

  useEffect(() => {
    const syncCoverage = () => {
      const persisted = readPersistedServiceArea();
      if (!persisted) return;
      setDestination(resolveDestinationForCoverage(persisted, activeStops, currentFallbackDestination));
    };
    window.addEventListener("storage", syncCoverage);
    return () => window.removeEventListener("storage", syncCoverage);
  }, [activeStops, currentFallbackDestination]);

  /* ---------------- Reset optimization state when inputs change ---------------- */

  useEffect(() => {
    setCourierRoutes(new Map());
    setCourierStopsMap(new Map());
    setSelectedCourier(null);
    setBookingMessage(null);
  }, [planningParcels, activeStops]);

  /* ---------------- Couriers, colors, vehicles ---------------- */

  const availableCouriers = useMemo(() => {
    const couriers = new Set<string>();
    planningParcels.forEach((p) => couriers.add(p.courier || "LBC"));
    return Array.from(couriers).sort();
  }, [planningParcels]);

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

  useEffect(() => {
    if (!activeStops.length) {
      setInitialPolyline(null);
      setInitialMetrics(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        const coords = [
          [origin.lng, origin.lat],
          ...activeStops.map((s) => [s.lng, s.lat]),
          [destination.lng, destination.lat],
        ];
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
          setInitialMetrics(calculatePolylineMetrics(polyline));
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
  }, [activeStops, origin, destination]);

  /* ---------------- Optimization (shared by "optimize all" and "recalculate one") ---------------- */

  async function requestOptimizedRoute(courierStops: RouteStop[]): Promise<OptimizeResponse> {
    const res = await fetch("/api/optimize-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        stops: courierStops,
        vehicleCount: Math.max(1, availableVehicleOptions.length),
        availableVehicles: availableVehicleOptions,
        initialDistanceMi: initialMetrics?.distanceMi ?? undefined,
        initialEtaMinutes: initialMetrics?.etaMinutes ?? undefined,
      }),
    });
    if (!res.ok) throw new Error(`optimize-route failed: ${res.status}`);
    return res.json();
  }

  /** Optimizes each requested courier's stop list independently and merges
   *  the results into state. Used by both "optimize everyone" and
   *  "recalculate a single courier" — they only differ in which couriers
   *  they pass in and whether a single courier ends up selected after. */
  async function optimizeCouriers(couriers: string[]) {
    setLoading(true);
    try {
      const stopsByCourier = new Map<string, RouteStop[]>();
      activeStops.forEach((stop) => {
        if (!couriers.includes(stop.courier)) return;
        if (!stopsByCourier.has(stop.courier)) stopsByCourier.set(stop.courier, []);
        stopsByCourier.get(stop.courier)!.push(stop);
      });

      const settled = await Promise.all(
        Array.from(stopsByCourier.entries()).map(async ([courier, courierStops]) => {
          try {
            const data = await requestOptimizedRoute(courierStops);
            return { courier, stopIds: courierStops.map((s) => s.id), data };
          } catch (err) {
            console.error(`Optimization failed for ${courier}:`, err);
            return null;
          }
        })
      );

      setCourierRoutes((prev) => {
        const next = new Map(prev);
        settled.forEach((entry) => entry && next.set(entry.courier, entry.data));
        return next;
      });
      setCourierStopsMap((prev) => {
        const next = new Map(prev);
        settled.forEach((entry) => entry && next.set(entry.courier, entry.stopIds));
        return next;
      });

      return settled.filter(Boolean) as { courier: string; stopIds: string[]; data: OptimizeResponse }[];
    } finally {
      setLoading(false);
    }
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
    await optimizeCouriers(availableCouriers);
  }

  // Auto-optimize every courier once parcels/stops are available.
  useEffect(() => {
    if (planningParcels.length > 0 && courierRoutes.size === 0 && !loading && availableCouriers.length > 0) {
      const timer = setTimeout(() => handleOptimizeAllCouriers(), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningParcels.length, courierRoutes.size, availableCouriers.length]);

  /* ---------------- Derived: which result set is "current" ---------------- */

  const currentResult = useMemo(() => {
    if (selectedCourier && courierRoutes.has(selectedCourier)) return courierRoutes.get(selectedCourier)!;
    if (!selectedCourier && courierRoutes.size > 0) return Array.from(courierRoutes.values())[0];
    return null;
  }, [selectedCourier, courierRoutes]);

  const filteredActiveStops = useMemo(() => {
    if (!selectedCourier || courierStopsMap.size === 0) return activeStops;
    const stopIds = new Set(courierStopsMap.get(selectedCourier) || []);
    return activeStops.filter((stop) => stopIds.has(stop.id));
  }, [activeStops, selectedCourier, courierStopsMap]);

  // Stops grouped by courier, in optimized order, for the timeline UI.
  const courierWaypoints = useMemo(() => {
    const grouped = new Map<string, RouteStop[]>();
    const stopMap = new Map(activeStops.map((s) => [s.id, s]));

    if (selectedCourier === null && courierRoutes.size > 0) {
      availableCouriers.forEach((c) => grouped.set(c, []));
      for (const [courier, result] of courierRoutes.entries()) {
        const orderedIds = result.routes?.length
          ? result.routes.flatMap((r) => r.orderedStopIds)
          : result.orderedStopIds;
        const stops = (orderedIds || []).map((id) => stopMap.get(id)).filter((s): s is RouteStop => Boolean(s));
        grouped.set(courier, stops);
      }
      return grouped;
    }

    if (!currentResult) {
      availableCouriers.forEach((courier) => {
        grouped.set(courier, activeStops.filter((stop) => stop.courier === courier));
      });
      return grouped;
    }
    const orderedIds = currentResult.routes?.length
      ? currentResult.routes.flatMap((r) => r.orderedStopIds)
      : currentResult.orderedStopIds;
    const filteredMap = new Map(filteredActiveStops.map((s) => [s.id, s]));
    const stops = (orderedIds || []).map((id) => filteredMap.get(id)).filter((s): s is RouteStop => Boolean(s));
    grouped.set(selectedCourier || "All Couriers", stops);
    return grouped;
  }, [selectedCourier, courierRoutes, availableCouriers, activeStops, filteredActiveStops, currentResult]);

  const orderedStops = useMemo(() => {
    if (selectedCourier === null && courierRoutes.size > 0) {
      return Array.from(courierWaypoints.values()).flat();
    }
    if (!currentResult) return filteredActiveStops;
    const orderedIds = currentResult.routes?.length
      ? currentResult.routes.flatMap((r) => r.orderedStopIds)
      : currentResult.orderedStopIds;
    const stopMap = new Map(filteredActiveStops.map((s) => [s.id, s]));
    const stops = (orderedIds || []).map((id) => stopMap.get(id)).filter((s): s is RouteStop => Boolean(s));
    return stops.length ? stops : filteredActiveStops;
  }, [selectedCourier, courierRoutes, currentResult, filteredActiveStops, courierWaypoints]);

  /* ---------------- Map markers & polylines ---------------- */

  const markers: MapMarker[] = useMemo(
    () => [
      { id: "origin", position: origin, color: "#b80049", label: "Origin" },
      ...activeStops.map((stop, idx) => {
        const count = stopParcelCounts.get(stop.id) ?? 0;
        return {
          id: stop.id,
          position: { lat: stop.lat, lng: stop.lng },
          color: courierColors.get(stop.courier) ?? "#3b82f6",
          label: `${idx + 1}. ${stop.label || "Stop"} \u2022 ${count} parcel${count === 1 ? "" : "s"}`,
        };
      }),
      { id: "dest", position: destination, color: "#10b981", label: "Destination" },
    ],
    [activeStops, destination, stopParcelCounts, origin, courierColors]
  );

  const courierColoredPaths = useMemo(() => {
    const colored: Array<{ points: LatLng[]; color: string; label: string }> = [];
    const collect = (courier: string, result: OptimizeResponse | undefined, color: string) => {
      if (!result) return;
      const points = result.polyline?.length
        ? result.polyline
        : result.routes?.flatMap((r) => r.polyline || []).filter(Boolean) ?? [];
      if (points.length > 1) colored.push({ points, color, label: courier });
    };

    if (selectedCourier === null && courierRoutes.size > 0) {
      for (const [courier, result] of courierRoutes.entries()) {
        collect(courier, result, courierColors.get(courier) || "#3b82f6");
      }
    } else if (selectedCourier) {
      collect(selectedCourier, courierRoutes.get(selectedCourier), courierColors.get(selectedCourier) || "#b80049");
    }
    return colored;
  }, [selectedCourier, courierRoutes, courierColors]);

  const { initialPath, optimizedPath } = useMemo(() => {
    const clean = (polyline: LatLng[] | null | undefined) => {
      if (!polyline) return null;
      const normalized = polyline.map(normalizePosition).filter((p): p is LatLng => p !== null);
      return normalized.length > 1 ? normalized : null;
    };

    const initial = clean(initialPolyline);

    const optimizedPoints: LatLng[] = [];
    const appendResultPoints = (result: OptimizeResponse) => {
      if (result.polyline?.length) {
        for (const point of result.polyline) optimizedPoints.push(point);
        return;
      }

      for (const route of result.routes || []) {
        for (const point of route.polyline || []) optimizedPoints.push(point);
      }
    };

    if (!selectedCourier && courierRoutes.size > 0) {
      for (const result of courierRoutes.values()) {
        appendResultPoints(result);
      }
    } else if (selectedCourier && courierRoutes.has(selectedCourier)) {
      appendResultPoints(courierRoutes.get(selectedCourier)!);
    }

    return { initialPath: initial, optimizedPath: clean(optimizedPoints) };
  }, [initialPolyline, selectedCourier, courierRoutes]);

  const directionPath = useMemo(() => {
    if (optimizedPath) return [optimizedPath];
    if (initialPath) return [initialPath];
    return [];
  }, [initialPath, optimizedPath]);

  /* ---------------- Booking confirmation ---------------- */

  // Bulk parcels for the SAME courier but spread across DIFFERENT cities get
  // their own OR-Tools optimization run: depot = the central sorting hub
  // (origin), stops = that courier's fixed warehouse in every city its
  // parcels are headed to. Each courier's route is optimized independently,
  // since different couriers don't share warehouses.
  async function handleCreateBookings() {
    const groups = new Map<string, typeof planningParcels>();
    planningParcels.forEach((parcel) => {
      const courier = parcel.courier || "LBC";
      groups.set(courier, [...(groups.get(courier) || []), parcel]);
    });
    if (groups.size === 0) {
      setBookingMessage("Select at least one booked parcel before confirming the route.");
      return;
    }

    setCreatingBookings(true);
    setBookingMessage(null);
    const summaries: string[] = [];
    const failures: string[] = [];
    const assignedParcelIds = new Set<string>();

    try {
      for (const [courier, courierParcels] of groups.entries()) {
        const byCity = new Map<string, { city: string; parcelIds: string[]; weightKg: number }>();
        courierParcels.forEach((parcel) => {
          const address = getParcelAddress(parcel) || "Parcel destination";
          const city = resolveKnownCity(address) ?? resolveParcelCity(address);
          const entry = byCity.get(city) || { city, parcelIds: [] as string[], weightKg: 0 };
          entry.parcelIds.push(parcel.id);
          entry.weightKg += Number(parcel.weightKg || 0);
          byCity.set(city, entry);
        });

        const destinations = Array.from(byCity.values())
          .map((entry) => {
            const warehouse = getCourierWarehouse(courier, entry.city);
            const coord = warehouse ?? getCityCoordinate(entry.city);
            if (!coord) return null;
            return {
              name: warehouse ? warehouse.name : entry.city,
              lat: coord.lat,
              lng: coord.lng,
              latitude: coord.lat,
              longitude: coord.lng,
              city: entry.city,
              demand: Math.max(0, Math.round(entry.weightKg)),
              parcel_ids: entry.parcelIds,
            };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);

        if (destinations.length === 0) {
          failures.push(`${courier}: no resolvable delivery cities for its parcels.`);
          continue;
        }

        const parcelIds = courierParcels.map((p) => p.id);

        let routePlan: any = null;
        try {
          routePlan = await createRoutePlan({
            courier,
            pickup_location: origin.label,
            pickup_latitude: origin.lat,
            pickup_longitude: origin.lng,
            delivery_destinations: destinations,
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          failures.push(`${courier}: route plan creation failed (${detail})`);
          continue;
        }

        if (!routePlan?.id) {
          failures.push(`${courier}: route plan save failed (${routePlan?.error || "missing ID"})`);
          continue;
        }

        const orderedDestinations =
          Array.isArray(routePlan?.deliveryDestinations) && routePlan.deliveryDestinations.length > 0
            ? routePlan.deliveryDestinations
            : destinations;
        const dropoffLabel =
          orderedDestinations.map((d: any) => d.name).filter(Boolean).join(" \u2192 ") || destination.label;

        const response = await createBulkBooking({
          courier,
          parcel_ids: parcelIds,
          pickup_location: origin.label,
          pickup_latitude: origin.lat,
          pickup_longitude: origin.lng,
          dropoff_location: dropoffLabel,
          route_plan_id: routePlan.id,
        });

        createRouteBooking(
          parcelIds,
          `${origin.label} \u2192 ${dropoffLabel}`,
          response.booking?.id,
          routePlan.id,
          orderedDestinations
        );

        parcelIds.forEach((id) => assignedParcelIds.add(id));

        const stopCount = orderedDestinations.length;
        summaries.push(
          `${courier}: ${stopCount} warehouse stop${stopCount === 1 ? "" : "s"} across ${byCity.size} cit${byCity.size === 1 ? "y" : "ies"} (${parcelIds.length} parcel${parcelIds.length === 1 ? "" : "s"})${routePlan.distanceKm != null ? `, ${routePlan.distanceKm} km` : ""}`
        );
      }

      if (assignedParcelIds.size > 0) {
        setSelectedRouteParcelIds((current) => {
          const next = new Set(current);
          assignedParcelIds.forEach((id) => next.delete(id));
          return next;
        });
        try {
          // Refresh store to get new bookings and updated parcels
          await refreshStoreFromBackend();
          // Debug: Log what happened after refresh
          console.log('[DEBUG] After refreshStoreFromBackend:');
          console.log('  - assignedParcelIds:', Array.from(assignedParcelIds));
          console.log('  - bookings count:', bookings.length);
          bookings.forEach((b: any, idx: number) => {
            console.log(`    Booking ${idx}: id=${b.id}, parcelIds=${JSON.stringify(b.parcelIds)}, routePlanId=${b.routePlanId}`);
          });
        } catch (error) {
          console.warn("Store refresh failed after booking creation:", error);
        }
      }

      if (summaries.length === 0) {
        setBookingMessage(failures.join(" ") || "Unable to create bookings.");
      } else {
        setBookingMessage(
          `Optimized bookings created \u2014 ${summaries.join(" \u00b7 ")}${
            failures.length ? ` (skipped: ${failures.join(" ")})` : ""
          }`
        );
      }
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : "Unable to create bookings.");
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
              Build a delivery plan from booked parcels, optimize the stop order, then send the confirmed plan to Bookings.
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

              <div className="h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm relative">
                <LeafletMap
                  center={
                    markers.length > 0
                      ? { lat: markers[markers.length - 1].position.lat, lng: markers[markers.length - 1].position.lng }
                      : { lat: destination.lat, lng: destination.lng }
                  }
                  zoom={11}
                  markers={markers}
                  coloredPaths={courierColoredPaths}
                  initialPath={initialPath}
                  optimizedPath={optimizedPath}
                  routeColor="#b80049"
                />

                <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200/80 shadow-xs flex items-center gap-4 text-[11px] font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b80049]" /> Origin
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Waypoints ({filteredActiveStops.length})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Destination
                  </span>
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Fuel Savings"
                icon="local_gas_station"
                iconColor="text-emerald-600"
                value={currentResult ? `${currentResult.fuelSavingsPct}%` : "0%"}
                caption="vs. unoptimized"
              />
              <KpiCard
                label="ETA Impact"
                icon="timer"
                iconColor="text-blue-600"
                value={currentResult ? `-${formatDuration(currentResult.etaImprovementMin)}` : "0m"}
                caption="time reduced"
              />
              <KpiCard
                label="Distance"
                icon="distance"
                iconColor="text-amber-600"
                value={
                  currentResult && initialMetrics
                    ? `${currentResult.distanceMi} mi`
                    : initialMetrics
                    ? `${initialMetrics.distanceMi} mi`
                    : "\u2014"
                }
                caption={
                  currentResult && initialMetrics
                    ? `${initialMetrics.distanceMi} mi \u2192 ${currentResult.distanceMi} mi`
                    : "total polyline"
                }
              />
              <KpiCard
                label="Est. Duration"
                icon="schedule"
                iconColor="text-[#b80049]"
                value={
                  currentResult && initialMetrics
                    ? formatDuration(currentResult.etaMinutes)
                    : initialMetrics
                    ? formatDuration(initialMetrics.etaMinutes)
                    : "\u2014"
                }
                caption={
                  currentResult && initialMetrics
                    ? `${formatDuration(initialMetrics.etaMinutes)} \u2192 ${formatDuration(currentResult.etaMinutes)}`
                    : "in-transit time"
                }
              />
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
                    <p className="text-sm text-slate-500">Select the booked parcels to include in this delivery route.</p>
                  </div>
                  <span className="text-xs font-semibold text-[#b80049]">{planningParcels.length} selected</span>
                </div>

                {bookedUnassignedParcels.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No booked parcels are available for route planning.
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
                      {bookedUnassignedParcels.map((parcel) => {
                        const address = getParcelDisplayAddress(parcel);
                        const { displayedPos, source } = resolveParcelDisplayPosition(parcel);
                        const isSelected = selectedRouteParcelIds.has(parcel.id);

                        return (
                          <label
                            key={parcel.id}
                            className={`flex h-full cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                              isSelected ? "border-[#b80049]/40 bg-pink-50/60 ring-1 ring-[#b80049]/15" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedRouteParcelIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(parcel.id)) next.delete(parcel.id);
                                      else next.add(parcel.id);
                                      return next;
                                    })
                                  }
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#b80049] focus:ring-[#b80049]"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">{parcel.trackingNumber || `Parcel ${parcel.id}`}</p>
                                  <p className="text-xs text-slate-500 mt-1">{address}</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] font-semibold text-slate-700">
                              {isSelected ? "Included in this route plan." : "Not included in this route plan."}
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div className="rounded-md bg-white border border-slate-200 p-2">
                                <p className="font-semibold text-slate-800">Coords</p>
                                <p className="mt-1">
                                  {displayedPos
                                    ? `${displayedPos.lat.toFixed(4)}, ${displayedPos.lng.toFixed(4)}${source ? ` (${source})` : ""}`
                                    : "Missing coordinates"}
                                </p>
                              </div>
                              <div className="rounded-md bg-white border border-slate-200 p-2">
                                <p className="font-semibold text-slate-800">Courier</p>
                                <p className="mt-1 text-slate-600">{parcel.courier || "Unknown"}</p>
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
                <button
                  onClick={handleOptimizeAllCouriers}
                  disabled={loading || planningParcels.length === 0}
                  className="w-full rounded-xl bg-[#b80049] hover:bg-[#a0003f] active:bg-[#880035] text-white py-3 px-4 font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Generating Route Plan...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      <span>
                        {planningParcels.length === 0
                          ? "Select parcels to plan"
                          : `Generate Route Plan AI · ${planningParcels.length} parcel${planningParcels.length === 1 ? "" : "s"}`}
                      </span>
                    </>
                  )}
                </button>

                {courierRoutes.size > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-slate-600">
                      {courierRoutes.size} courier{courierRoutes.size === 1 ? "" : "s"} optimized
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from(courierRoutes.keys())
                        .sort()
                        .map((courier) => (
                          <button
                            key={courier}
                            onClick={() => setSelectedCourier(courier)}
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
                <span className="text-xs text-slate-400">{orderedStops.length + 2} total stops</span>
              </div>

              {courierWaypoints.size > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from(courierWaypoints.entries()).map(([courier, courierStops]) => {
                    return (
                      <div
                        key={courier}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{courier} Route</p>
                            <p className="mt-0.5 text-[11px] font-medium text-slate-400">Optimized delivery sequence</p>
                          </div>
                          <span
                            className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                          >
                            {courierStops.length} stop{courierStops.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {courierStops.length > 0 ? (
                          <div className="space-y-2 p-2.5">
                            {courierStops.map((stop, idx) => (
                              <div key={stop.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
                                <div
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[10px] font-bold text-slate-600"
                                >
                                  {idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold text-slate-800">{stop.label}</span>
                                  <p className="mt-0.5 truncate text-[10px] text-slate-400">{stop.lat}, {stop.lng}</p>
                                </div>
                                <span className="hidden shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline">
                                  {courierRoutes.size > 0 ? `Waypoint #${idx + 1}` : "Pending order"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="m-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                            No mapped stops for this courier yet.
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-xs">
                          <span className="font-semibold text-slate-600">{courierRoutes.size > 0 ? "AI order ready" : "Awaiting AI route generation"}</span>
                          <span className="max-w-[48%] truncate rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{destination.label}</span>
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

