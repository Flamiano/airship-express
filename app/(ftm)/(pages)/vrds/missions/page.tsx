"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity, AlertCircle, ArrowDownUp, ArrowRight, CalendarClock, Check, CheckCircle2,
  Clock3, MapPin, Package, RefreshCw, Route, Search, Truck, UserRound, X,
} from "lucide-react";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import type { LeafletMarker } from "../../../components/map/LeafletMap";
import type { PersistedRoutePlan, RoutePlanDetails, RoutePlanPoint } from "../../../lib/parcelTypes";
import { fetchJson } from "../../../lib/api";

const LeafletMap = dynamic(() => import("../../../components/map/LeafletMap"), { ssr: false });

type Point = { lat: number; lng: number };
type LiveLegRoute = { tripId: string; start: Point; pickup: Point; points: Point[]; distanceKm: number; durationMin: number };
type RawRecord = Record<string, unknown>;
type DispatchTrip = RawRecord & {
  id: string;
  status?: string | null;
  bookingId?: string | null;
  booking_id?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
  driverName?: string | null;
  driver_name?: string | null;
  vehicleId?: string | null;
  vehicle_id?: string | null;
  vehiclePlate?: string | null;
  vehicle_plate?: string | null;
  routePlanId?: string | null;
  route_plan_id?: string | null;
  routePlan?: PersistedRoutePlan | null;
  stops?: RoutePlanPoint[] | null;
  routePlanStops?: RoutePlanPoint[] | null;
  fromLocation?: string | null;
  from_location?: string | null;
  toLocation?: string | null;
  to_location?: string | null;
  fromCoords?: Point | null;
  toCoords?: Point | null;
  progress?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  estimatedDeparture?: string | null;
  estimatedArrival?: string | null;
  pickupStatus?: string | null;
  pickupProofUrl?: string | null;
  pickupConfirmedAt?: string | null;
};
type DispatchBooking = RawRecord & {
  id: string;
  status?: string | null;
  routePlanId?: string | null;
  routePlan?: PersistedRoutePlan | null;
  courier?: string | null;
  courierId?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehiclePlate?: string | null;
  deliveryDestinations?: RoutePlanPoint[];
};
type DispatchParcel = RawRecord & {
  id: string;
  bookingId?: string | null;
  booking_id?: string | null;
  routePlanId?: string | null;
  route_plan_id?: string | null;
  tripId?: string | null;
  trip_id?: string | null;
  trackingNumber?: string | null;
  tracking_number?: string | null;
  status?: string | null;
  weightKg?: number | null;
  weight_kg?: number | null;
};
type TrackedDriver = RawRecord & {
  id: string;
  full_name?: string | null;
  last_location_lat?: number | string | null;
  last_location_lng?: number | string | null;
  last_location_at?: string | null;
};
type VehicleGpsRecord = RawRecord & {
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  recorded_at?: string | null;
};
type BoardFilter = "all" | "active" | "needs-assignment" | "in-progress" | "delayed" | "completed";
type SortMode = "latest" | "oldest" | "scheduled";

function asRows<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} response was not a list.`);
  return value as T[];
}

function field(record: RawRecord | null | undefined, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return null;
}

function text(record: RawRecord | null | undefined, ...keys: string[]): string {
  const value = field(record, ...keys);
  return value == null ? "" : String(value).trim();
}

function numeric(record: RawRecord | null | undefined, ...keys: string[]): number | null {
  const value = field(record, ...keys);
  if (value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function distanceBetween(start: Point, end: Point) {
  const radians = Math.PI / 180;
  const latitudeDelta = (end.lat - start.lat) * radians;
  const longitudeDelta = (end.lng - start.lng) * radians;
  const latitude1 = start.lat * radians;
  const latitude2 = end.lat * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToPath(point: Point, path: Point[]) {
  return path.length ? Math.min(...path.map((pathPoint) => distanceBetween(point, pathPoint))) : Number.POSITIVE_INFINITY;
}

function validPoint(point: Point | null): point is Point {
  return Boolean(point && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && (point.lat !== 0 || point.lng !== 0));
}

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function isCompleted(trip: DispatchTrip) {
  return /completed|delivered|finished|arrived/.test(normalizedStatus(trip.status));
}

function isCancelled(trip: DispatchTrip) {
  return /cancelled|canceled|failed|rejected/.test(normalizedStatus(trip.status));
}

function isDelayed(trip: DispatchTrip) {
  if (/delayed|late|critical/.test(normalizedStatus(trip.status))) return true;
  const arrival = trip.estimatedArrival || text(trip, "estimated_arrival", "eta_at");
  return Boolean(arrival && !isCompleted(trip) && !isCancelled(trip) && new Date(arrival).getTime() < Date.now());
}

function isInProgress(trip: DispatchTrip) {
  return /in transit|transit|delivering|en route|moving|dispatching|dispatched/.test(normalizedStatus(trip.status));
}

function needsAssignment(trip: DispatchTrip) {
  return (!trip.driverId && !trip.driver_id) || (!trip.vehicleId && !trip.vehicle_id) || /pending assignment|unassigned/.test(normalizedStatus(trip.status));
}

function isActive(trip: DispatchTrip) {
  return !isCompleted(trip) && !isCancelled(trip);
}

function routePlanFor(trip: DispatchTrip, booking?: DispatchBooking): PersistedRoutePlan | null {
  return trip.routePlan || booking?.routePlan || null;
}

function routeDetailsFor(plan?: PersistedRoutePlan | null): RoutePlanDetails {
  return plan?.routeDetails || plan?.route_details || {};
}

function planName(plan?: PersistedRoutePlan | null) {
  const details = routeDetailsFor(plan);
  return details.route_name || plan?.route_name || "Route plan not named";
}

function pointsFor(trip: DispatchTrip, booking?: DispatchBooking): RoutePlanPoint[] {
  const plan = routePlanFor(trip, booking);
  const planPoints = plan?.deliveryDestinations || plan?.delivery_destinations || booking?.deliveryDestinations || [];
  const tripPoints = trip.stops || trip.routePlanStops || [];
  return tripPoints.length ? tripPoints : planPoints;
}

function pointName(point?: RoutePlanPoint | null) {
  return point?.name || point?.address || "Stop location not recorded";
}

function pointCoordinates(point?: RoutePlanPoint | null): Point | null {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

function tripPointFrom(record: RawRecord, axis: "from" | "to"): Point | null {
  const pair = record[axis === "from" ? "fromCoords" : "toCoords"];
  if (pair && typeof pair === "object") {
    const point = pair as RawRecord;
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  }
  const lat = numeric(record, axis === "from" ? "from_latitude" : "to_latitude");
  const lng = numeric(record, axis === "from" ? "from_longitude" : "to_longitude");
  return lat != null && lng != null && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

function savedRoutePolyline(plan?: PersistedRoutePlan | null): Point[] | null {
  const raw = field(plan as RawRecord | null, "routeGeojson", "route_geojson");
  if (!raw || typeof raw !== "object") return null;
  const geo = raw as RawRecord;
  const geometry = (geo.route_geometry || geo.routeGeometry || geo.geometry || geo) as RawRecord;
  const features = Array.isArray(geo.features) ? geo.features : [];
  const featureLine = features.find((feature) => {
    const item = feature as RawRecord;
    return field(item.geometry as RawRecord | undefined, "type") === "LineString";
  }) as RawRecord | undefined;
  const source = geometry.coordinates || geometry.polyline || (featureLine?.geometry as RawRecord | undefined)?.coordinates
    || (Array.isArray(geo.routes) ? (geo.routes[0] as RawRecord | undefined)?.polyline : null);
  if (!Array.isArray(source)) return null;
  const points = source.map((item): Point | null => {
    if (Array.isArray(item) && item.length >= 2) {
      const lng = Number(item[0]);
      const lat = Number(item[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
    }
    if (!item || typeof item !== "object") return null;
    const point = item as RawRecord;
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }).filter((point): point is Point => Boolean(point));
  return points.length > 1 ? points : null;
}

function trackingWaypoints(trip: DispatchTrip, booking?: DispatchBooking): Point[] {
  const plan = routePlanFor(trip, booking);
  const stops = pointsFor(trip, booking);
  const planPickup = plan ? {
    lat: Number(plan.pickupLatitude ?? plan.pickup_latitude),
    lng: Number(plan.pickupLongitude ?? plan.pickup_longitude),
  } : null;
  const origin = tripPointFrom(trip, "from")
    || (planPickup && Number.isFinite(planPickup.lat) && Number.isFinite(planPickup.lng) && (planPickup.lat !== 0 || planPickup.lng !== 0) ? planPickup : null);
  const destination = tripPointFrom(trip, "to") || pointCoordinates(routeDetailsFor(plan).destination) || pointCoordinates(stops[stops.length - 1]);
  const points = [origin, ...stops.map(pointCoordinates), destination].filter((point): point is Point => Boolean(point));
  return points.filter((point, index) => index === 0 || point.lat !== points[index - 1].lat || point.lng !== points[index - 1].lng);
}

function formatDate(value: unknown, includeTime = true) {
  if (!value) return "Not scheduled";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return date.toLocaleString("en-PH", includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function statusStyle(trip: DispatchTrip) {
  if (isCancelled(trip)) return "border-slate-200 bg-slate-50 text-slate-600";
  if (isCompleted(trip)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (isDelayed(trip)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (isInProgress(trip)) return "border-sky-200 bg-sky-50 text-sky-700";
  if (needsAssignment(trip)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-pink-200 bg-pink-50 text-pink-700";
}

function statusLabel(trip: DispatchTrip) {
  if (isCancelled(trip)) return "Cancelled";
  if (isCompleted(trip)) return "Completed";
  if (isDelayed(trip)) return "Delayed";
  const value = String(trip.status || "Assigned").replace(/[_-]+/g, " ").trim();
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ trip }: { trip: DispatchTrip }) {
  const dot = isCompleted(trip) ? "bg-emerald-500" : isDelayed(trip) ? "bg-rose-500" : isInProgress(trip) ? "bg-sky-500" : needsAssignment(trip) ? "bg-amber-500" : "bg-pink-500";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle(trip)}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{statusLabel(trip)}</span>;
}

function SummaryMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail: string; icon: typeof Activity; tone: string }) {
  return <article className="rounded-2xl border border-rose-100/80 bg-white p-4 shadow-[0_4px_16px_rgba(190,24,93,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(190,24,93,0.08)]">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold leading-none text-slate-900 tabular-nums">{value}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span></div>
    <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
  </article>;
}

function InfoCell({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Activity }) {
  return <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/75 p-3">
    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{Icon && <Icon className="h-3 w-3" />}{label}</p>
    <p className="mt-1.5 break-words text-xs font-semibold leading-4 text-slate-800">{value || "Not recorded"}</p>
  </div>;
}

export default function VrdsMissionsPage() {
  const [trips, setTrips] = useState<DispatchTrip[]>([]);
  const [bookings, setBookings] = useState<DispatchBooking[]>([]);
  const [parcels, setParcels] = useState<DispatchParcel[]>([]);
  const [trackedDrivers, setTrackedDrivers] = useState<TrackedDriver[]>([]);
  const [vehicleGpsRecord, setVehicleGpsRecord] = useState<VehicleGpsRecord | null>(null);
  const [vehicleGpsError, setVehicleGpsError] = useState("");
  const [trackingUpdatedAt, setTrackingUpdatedAt] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingConnection, setTrackingConnection] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [liveLegRoute, setLiveLegRoute] = useState<LiveLegRoute | null>(null);
  const [liveLegError, setLiveLegError] = useState("");
  const [roadPaths, setRoadPaths] = useState<Record<string, { waypointKey: string; points: Point[] }>>({});
  const [roadPathErrors, setRoadPathErrors] = useState<Record<string, { waypointKey: string; message: string }>>({});
  const requestedRoadPaths = useRef(new Map<string, string>());
  const requestedLiveLegRef = useRef<{ tripId: string; start: Point; requestedAt: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dataWarning, setDataWarning] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("active");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [focusedTripId, setFocusedTripId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const tripsRef = useRef<DispatchTrip[]>([]);
  const pendingAcceptedTripIdRef = useRef<string | null>(null);
  const suppressAutoFocusRef = useRef(false);

  const loadDispatchData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setPageError("");
    setDataWarning("");

    const [tripResult, bookingResult, parcelResult, driverResult] = await Promise.allSettled([
      fetchJson("/api/trips", { cache: "no-store" }),
      fetchJson("/api/bookings", { cache: "no-store" }),
      fetchJson("/api/parcels?history=true", { cache: "no-store" }),
      fetchJson("/api/drivers", { cache: "no-store" }),
    ]);

    if (tripResult.status === "fulfilled") {
      try {
        const rows = asRows<DispatchTrip>(tripResult.value, "Dispatch");
        tripsRef.current = rows;
        setTrips(rows);
      }
      catch (error) { setPageError(error instanceof Error ? error.message : "Dispatch data is invalid."); }
    } else {
      setPageError(tripResult.reason instanceof Error ? tripResult.reason.message : "Unable to load dispatch records.");
    }

    const warnings: string[] = [];
    const setOptionalRows = <T,>(result: PromiseSettledResult<unknown>, label: string, setter: (rows: T[]) => void) => {
      if (result.status === "rejected") {
        warnings.push(result.reason instanceof Error ? result.reason.message : `Unable to load ${label}.`);
        setter([]);
        return;
      }
      try { setter(asRows<T>(result.value, label)); }
      catch (error) { warnings.push(error instanceof Error ? error.message : `Unable to load ${label}.`); setter([]); }
    };
    setOptionalRows<DispatchBooking>(bookingResult, "booking", setBookings);
    setOptionalRows<DispatchParcel>(parcelResult, "parcel", setParcels);
    if (driverResult.status === "fulfilled") {
      try {
        setTrackedDrivers(asRows<TrackedDriver>(driverResult.value, "Driver location"));
        setTrackingError("");
        setTrackingUpdatedAt(new Date().toISOString());
      } catch (error) {
        setTrackingError(error instanceof Error ? error.message : "Driver locations are unavailable.");
      }
    } else {
      setTrackedDrivers([]);
      setTrackingError(driverResult.reason instanceof Error ? driverResult.reason.message : "Driver locations are unavailable.");
    }
    setDataWarning(warnings.join(" "));
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDispatchData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDispatchData]);

  const refreshDriverLocations = useCallback(async () => {
    try {
      const rows = asRows<TrackedDriver>(await fetchJson("/api/drivers", { cache: "no-store" }), "Driver location");
      setTrackedDrivers(rows);
      setTrackingUpdatedAt(new Date().toISOString());
      setTrackingError("");
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : "Driver locations are unavailable.");
    }
  }, []);

  const refreshVehicleGps = useCallback(async () => {
    const trip = tripsRef.current.find((item) => item.id === focusedTripId);
    const vehicleId = String(trip?.vehicleId || trip?.vehicle_id || "");
    if (!vehicleId) {
      setVehicleGpsRecord(null);
      setVehicleGpsError("");
      return;
    }
    try {
      const rows = asRows<VehicleGpsRecord>(await fetchJson(`/api/tracking/vehicle-gps/${encodeURIComponent(vehicleId)}?limit=1`, { cache: "no-store" }), "Vehicle GPS");
      if (String(tripsRef.current.find((item) => item.id === focusedTripId)?.vehicleId || tripsRef.current.find((item) => item.id === focusedTripId)?.vehicle_id || "") !== vehicleId) return;
      setVehicleGpsRecord(rows[rows.length - 1] || null);
      setVehicleGpsError("");
    } catch (error) {
      setVehicleGpsRecord(null);
      setVehicleGpsError(error instanceof Error ? error.message : "Vehicle GPS is unavailable.");
    }
  }, [focusedTripId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshDriverLocations();
      void refreshVehicleGps();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refreshDriverLocations, refreshVehicleGps]);

  useEffect(() => {
    void refreshVehicleGps();
  }, [refreshVehicleGps]);

  useEffect(() => {
    const source = new EventSource("/api/events/assignments");
    let refreshTimer = 0;
    source.onopen = () => setTrackingConnection("live");
    source.onerror = () => setTrackingConnection("reconnecting");
    source.addEventListener("tracking_error", () => setTrackingConnection("reconnecting"));
    source.addEventListener("assignment", () => void loadDispatchData(true));
    source.addEventListener("accepted", (event) => {
      try {
        const tripId = String((JSON.parse((event as MessageEvent).data) as { trip_id?: string }).trip_id || "");
        if (!tripId) return;
        if (!tripsRef.current.some((trip) => trip.id === tripId)) {
          pendingAcceptedTripIdRef.current = tripId;
          return;
        }
        suppressAutoFocusRef.current = false;
        setFocusedTripId(tripId);
        setFilter("active");
      } catch {
        setTrackingConnection("reconnecting");
      }
    });
    source.addEventListener("tracking", () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = 0;
        void refreshDriverLocations();
        void refreshVehicleGps();
      }, 500);
    });
    return () => {
      source.close();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [loadDispatchData, refreshDriverLocations, refreshVehicleGps]);

  useEffect(() => {
    if (!selectedTripId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTripId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTripId]);

  const bookingsById = useMemo(() => new Map(bookings.map((booking) => [booking.id, booking])), [bookings]);

  useEffect(() => {
    let cancelled = false;
    const pending = trips.filter(isActive).flatMap((trip) => {
      const booking = bookingsById.get(String(trip.bookingId || trip.booking_id || ""));
      const plan = routePlanFor(trip, booking || undefined);
      if (savedRoutePolyline(plan)) return [];
      const waypoints = trackingWaypoints(trip, booking || undefined);
      if (waypoints.length < 2) return [];
      const waypointKey = waypoints.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join(";");
      if (requestedRoadPaths.current.get(trip.id) === waypointKey) return [];
      requestedRoadPaths.current.set(trip.id, waypointKey);
      return [{ tripId: trip.id, waypointKey, waypoints }];
    });

    pending.forEach(({ tripId, waypointKey, waypoints }) => {
      void (async () => {
        try {
          const result = await fetchJson("/api/route", {
            method: "POST",
            cache: "no-store",
            body: JSON.stringify({ waypoints }),
          }) as { polyline?: unknown };
          const points = Array.isArray(result?.polyline)
            ? result.polyline.map((point) => pointCoordinates(point as RoutePlanPoint)).filter((point): point is Point => Boolean(point))
            : [];
          if (points.length < 2) throw new Error("OSRM did not return a usable road path.");
          if (cancelled) return;
          setRoadPaths((current) => ({ ...current, [tripId]: { waypointKey, points } }));
          setRoadPathErrors((current) => {
            const next = { ...current };
            delete next[tripId];
            return next;
          });
        } catch (error) {
          if (cancelled) return;
          setRoadPathErrors((current) => ({
            ...current,
            [tripId]: { waypointKey, message: error instanceof Error ? error.message : "Road routing is unavailable." },
          }));
        } finally {
          if (cancelled && requestedRoadPaths.current.get(tripId) === waypointKey) requestedRoadPaths.current.delete(tripId);
        }
      })();
    });

    return () => { cancelled = true; };
  }, [bookingsById, trips]);

  const selectedTrip = selectedTripId ? trips.find((trip) => trip.id === selectedTripId) || null : null;
  const selectedBooking = selectedTrip ? bookingsById.get(String(selectedTrip.bookingId || selectedTrip.booking_id || "")) || null : null;
  const selectedPlan = selectedTrip ? routePlanFor(selectedTrip, selectedBooking || undefined) : null;
  const selectedPlanDetails = routeDetailsFor(selectedPlan);
  const selectedStops = selectedTrip ? pointsFor(selectedTrip, selectedBooking || undefined) : [];
  const selectedTripParcels = selectedTrip ? parcels.filter((parcel) => {
    const bookingId = String(selectedTrip.bookingId || selectedTrip.booking_id || "");
    const routePlanId = String(selectedTrip.routePlanId || selectedTrip.route_plan_id || "");
    return String(parcel.tripId || parcel.trip_id || "") === selectedTrip.id
      || Boolean(bookingId && String(parcel.bookingId || parcel.booking_id || "") === bookingId)
      || Boolean(routePlanId && String(parcel.routePlanId || parcel.route_plan_id || "") === routePlanId);
  }) : [];

  const activeTrips = trips.filter(isActive);
  const pendingAssignmentCount = activeTrips.filter(needsAssignment).length;
  const inProgressCount = trips.filter(isInProgress).length;
  const completedCount = trips.filter(isCompleted).length;
  const delayedCount = activeTrips.filter(isDelayed).length;
  const trackingTimestamp = trackingUpdatedAt ? new Date(trackingUpdatedAt).getTime() : 0;

  const displayedTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = trips.filter((trip) => {
      const booking = bookingsById.get(String(trip.bookingId || trip.booking_id || ""));
      const plan = routePlanFor(trip, booking || undefined);
      const related = parcels.filter((parcel) => {
        const bookingId = String(trip.bookingId || trip.booking_id || "");
        const routePlanId = String(trip.routePlanId || trip.route_plan_id || "");
        return String(parcel.tripId || parcel.trip_id || "") === trip.id
          || Boolean(bookingId && String(parcel.bookingId || parcel.booking_id || "") === bookingId)
          || Boolean(routePlanId && String(parcel.routePlanId || parcel.route_plan_id || "") === routePlanId);
      });
      const statusMatch = filter === "all"
        || (filter === "active" && isActive(trip))
        || (filter === "needs-assignment" && needsAssignment(trip))
        || (filter === "in-progress" && isInProgress(trip))
        || (filter === "delayed" && isDelayed(trip))
        || (filter === "completed" && isCompleted(trip));
      if (!statusMatch) return false;
      if (!query) return true;
      const stops = pointsFor(trip, booking || undefined).map(pointName).join(" ");
      const parcelTerms = related.map((parcel) => `${text(parcel, "trackingNumber", "tracking_number")} ${text(parcel, "recipientName", "recipient_name")} ${text(parcel, "destinationAddress", "delivery_address", "destination")}`).join(" ");
      const terms = [trip.id, trip.bookingId, trip.booking_id, trip.driverName, trip.driver_name, trip.vehiclePlate, trip.vehicle_plate, planName(plan), field(trip, "fromLocation", "from_location"), field(trip, "toLocation", "to_location"), stops, parcelTerms].filter(Boolean).join(" ").toLowerCase();
      return terms.includes(query);
    });
    return rows.sort((first, second) => {
      if (sortMode === "scheduled") {
        const firstTime = new Date(String(first.estimatedDeparture || first.estimated_departure || first.createdAt || first.created_at || "")).getTime();
        const secondTime = new Date(String(second.estimatedDeparture || second.estimated_departure || second.createdAt || second.created_at || "")).getTime();
        return (Number.isFinite(firstTime) ? firstTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(secondTime) ? secondTime : Number.MAX_SAFE_INTEGER);
      }
      const firstTime = new Date(String(first.updatedAt || first.updated_at || first.createdAt || first.created_at || "")).getTime();
      const secondTime = new Date(String(second.updatedAt || second.updated_at || second.createdAt || second.created_at || "")).getTime();
      const order = (Number.isFinite(firstTime) ? firstTime : 0) - (Number.isFinite(secondTime) ? secondTime : 0);
      return sortMode === "latest" ? -order : order;
    });
  }, [bookingsById, filter, parcels, search, sortMode, trips]);

  const liveTracking = (() => {
    const markers: LeafletMarker[] = [];
    const coloredPaths: Array<{ points: Point[]; color: string; label: string }> = [];
    const markerTripIds = new Map<string, string>();
    const focusPointsByTrip: Record<string, Point[]> = {};
    const gpsDriverIds = new Set<string>();
    const locations: Array<{ driverName: string; tripId: string; recordedAt: string | null; isFresh: boolean }> = [];
    let routesPending = 0;
    let routesUnavailable = 0;
    const routeColors = ["#db2777", "#2563eb", "#0f766e", "#b45309", "#7c3aed"];

    trips.filter(isActive).forEach((trip, tripIndex) => {
      const booking = bookingsById.get(String(trip.bookingId || trip.booking_id || ""));
      const plan = routePlanFor(trip, booking || undefined);
      const routePoints = trackingWaypoints(trip, booking || undefined);
      const waypointKey = routePoints.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join(";");
      const storedPath = savedRoutePolyline(plan);
      const requestedPath = roadPaths[trip.id];
      const roadPath = storedPath || (requestedPath?.waypointKey === waypointKey ? requestedPath.points : null);
      const routeError = roadPathErrors[trip.id];
      const routeColor = routeColors[tripIndex % routeColors.length];
      const trackingId = `dispatch-${trip.id}`;
      focusPointsByTrip[trip.id] = roadPath && roadPath.length > 1 ? roadPath : routePoints;

      if (roadPath && roadPath.length > 1) coloredPaths.push({ points: roadPath, color: routeColor, label: planName(plan) });
      else if (routePoints.length > 1) {
        if (routeError?.waypointKey === waypointKey) routesUnavailable += 1;
        else routesPending += 1;
      }
      routePoints.forEach((position, index) => {
        const markerId = `${trackingId}-route-${index}`;
        const label = index === 0 ? "P" : index === routePoints.length - 1 ? "D" : String(index);
        markers.push({ id: markerId, position, color: routeColor, label, meta: { title: planName(plan), subtitle: `${trip.id} · ${label === "P" ? "Pickup" : label === "D" ? "Delivery" : `Stop ${label}`}` } });
        markerTripIds.set(markerId, trip.id);
      });

      const driverId = String(trip.driverId || trip.driver_id || "");
      if (!driverId || gpsDriverIds.has(driverId)) return;
      const driver = trackedDrivers.find((item) => item.id === driverId);
      if (!driver) return;
      const lat = Number(driver.last_location_lat);
      const lng = Number(driver.last_location_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

      gpsDriverIds.add(driverId);
      const recordedAt = driver.last_location_at ? new Date(driver.last_location_at).getTime() : NaN;
      const isFresh = trackingTimestamp > 0 && Number.isFinite(recordedAt) && trackingTimestamp - recordedAt <= 5 * 60_000 && recordedAt <= trackingTimestamp;
      const markerId = `dispatch-${trip.id}-gps`;
      const driverName = text(driver, "full_name", "name") || text(trip, "driverName", "driver_name") || "Assigned driver";
      markers.push({
        id: markerId,
        position: { lat, lng },
        color: isFresh ? "#059669" : "#64748b",
        label: "GPS",
        isVehicle: true,
        meta: { title: driverName, subtitle: `${isFresh ? "Live GPS" : "Last known position"}${driver.last_location_at ? ` · ${formatDate(driver.last_location_at)}` : ""}` },
      });
      markerTripIds.set(markerId, trip.id);
      locations.push({ driverName, tripId: trip.id, recordedAt: driver.last_location_at || null, isFresh });
    });

    return { markers, coloredPaths, markerTripIds, focusPointsByTrip, gpsDriverCount: gpsDriverIds.size, locations, routesPending, routesUnavailable };
  })();

  const focusedTrip = focusedTripId ? trips.find((trip) => trip.id === focusedTripId) || null : null;
  const focusedBooking = focusedTrip ? bookingsById.get(String(focusedTrip.bookingId || focusedTrip.booking_id || "")) || null : null;
  const focusedPlan = focusedTrip ? routePlanFor(focusedTrip, focusedBooking || undefined) : null;
  const focusedTripStarted = Boolean(focusedTrip && (normalizedStatus(focusedTrip.status) === "in transit"
    || normalizedStatus(field(focusedTrip, "pickupStatus", "pickup_status")) === "started"));
  const focusedRouteWaypoints = focusedTrip ? trackingWaypoints(focusedTrip, focusedBooking || undefined) : [];
  const focusedWaypointKey = focusedRouteWaypoints.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join(";");
  const focusedSavedRoute = savedRoutePolyline(focusedPlan);
  const focusedRequestedRoute = focusedTrip ? roadPaths[focusedTrip.id] : null;
  const focusedRoutePlanPath = focusedSavedRoute
    || (focusedRequestedRoute?.waypointKey === focusedWaypointKey ? focusedRequestedRoute.points : []);
  const focusedDriverId = String(focusedTrip?.driverId || focusedTrip?.driver_id || "");
  const focusedDriver = trackedDrivers.find((driver) => driver.id === focusedDriverId) || null;
  const focusedVehicleGpsPosition = useMemo(() => {
    if (!vehicleGpsRecord) return null;
    const position = {
      lat: Number(vehicleGpsRecord.latitude ?? vehicleGpsRecord.lat),
      lng: Number(vehicleGpsRecord.longitude ?? vehicleGpsRecord.lng),
    };
    return validPoint(position) ? position : null;
  }, [vehicleGpsRecord]);
  const focusedDriverGpsPosition = useMemo(() => {
    if (!focusedDriver) return null;
    const position = { lat: Number(focusedDriver.last_location_lat), lng: Number(focusedDriver.last_location_lng) };
    return validPoint(position) ? position : null;
  }, [focusedDriver]);
  const focusedGpsPosition = focusedVehicleGpsPosition || focusedDriverGpsPosition;
  const focusedPickupPosition = useMemo(() => {
    if (!focusedTrip) return null;
    const pickup = trackingWaypoints(focusedTrip, focusedBooking || undefined)[0] || null;
    return validPoint(pickup) ? pickup : null;
  }, [focusedTrip, focusedBooking]);
  const focusedGpsAtValue = focusedVehicleGpsPosition ? vehicleGpsRecord?.recorded_at : focusedDriver?.last_location_at;
  const focusedGpsAt = focusedGpsAtValue ? new Date(focusedGpsAtValue) : null;
  const focusedGpsFresh = Boolean(focusedGpsAt && Date.now() - focusedGpsAt.getTime() <= 5 * 60_000);
  const focusedTripParcels = focusedTrip ? parcels.filter((parcel) => {
    const bookingId = String(focusedTrip.bookingId || focusedTrip.booking_id || "");
    const routePlanId = String(focusedTrip.routePlanId || focusedTrip.route_plan_id || "");
    return String(parcel.tripId || parcel.trip_id || "") === focusedTrip.id
      || Boolean(bookingId && String(parcel.bookingId || parcel.booking_id || "") === bookingId)
      || Boolean(routePlanId && String(parcel.routePlanId || parcel.route_plan_id || "") === routePlanId);
  }) : [];

  useEffect(() => {
    const pendingTripId = pendingAcceptedTripIdRef.current;
    if (pendingTripId && trips.some((trip) => trip.id === pendingTripId)) {
      pendingAcceptedTripIdRef.current = null;
      suppressAutoFocusRef.current = false;
      setFocusedTripId(pendingTripId);
      setFilter("active");
      return;
    }
    if (focusedTripId || suppressAutoFocusRef.current) return;
    const acceptedMission = trips
      .filter((trip) => /scheduled|accepted/.test(normalizedStatus(trip.status)) && !needsAssignment(trip))
      .sort((first, second) => new Date(String(second.updatedAt || second.updated_at || "")).getTime()
        - new Date(String(first.updatedAt || first.updated_at || "")).getTime())[0];
    if (!acceptedMission) return;
    setFocusedTripId(acceptedMission.id);
    setFilter("active");
  }, [trips, focusedTripId]);

  useEffect(() => {
    if (!focusedTrip || focusedTripStarted || !focusedGpsPosition || !focusedPickupPosition) return;
    const existingRouteMatches = liveLegRoute?.tripId === focusedTrip.id
      && liveLegRoute.pickup.lat === focusedPickupPosition.lat
      && liveLegRoute.pickup.lng === focusedPickupPosition.lng;
    const isOnExistingRoute = existingRouteMatches && distanceToPath(focusedGpsPosition, liveLegRoute.points) <= 0.4;
    if (isOnExistingRoute && distanceBetween(focusedGpsPosition, liveLegRoute.start) <= 0.5) return;

    const previousRequest = requestedLiveLegRef.current;
    if (previousRequest?.tripId === focusedTrip.id
      && Date.now() - previousRequest.requestedAt < 15_000
      && distanceBetween(focusedGpsPosition, previousRequest.start) < 0.5) return;

    const start = focusedGpsPosition;
    const tripId = focusedTrip.id;
    requestedLiveLegRef.current = { tripId, start, requestedAt: Date.now() };
    setLiveLegError("");
    void (async () => {
      try {
        const result = await fetchJson("/api/route", {
          method: "POST",
          cache: "no-store",
          body: JSON.stringify({ waypoints: [start, focusedPickupPosition] }),
        }) as { polyline?: unknown; distanceKm?: number; durationMin?: number };
        const points = Array.isArray(result.polyline)
          ? result.polyline.map((point) => pointCoordinates(point as RoutePlanPoint)).filter((point): point is Point => Boolean(point))
          : [];
        if (points.length < 2) throw new Error("No road route was returned.");
        if (requestedLiveLegRef.current?.tripId !== tripId) return;
        setLiveLegRoute({
          tripId,
          start,
          pickup: focusedPickupPosition,
          points,
          distanceKm: Number(result.distanceKm) || distanceBetween(start, focusedPickupPosition),
          durationMin: Number(result.durationMin) || 0,
        });
      } catch (error) {
        if (requestedLiveLegRef.current?.tripId !== tripId) return;
        setLiveLegError(error instanceof Error ? error.message : "Driving directions are unavailable.");
      }
    })();
  }, [focusedGpsPosition, focusedPickupPosition, focusedTrip, focusedTripStarted, liveLegRoute]);

  const focusedRouteMatches = Boolean(focusedTrip && liveLegRoute?.tripId === focusedTrip.id
    && focusedPickupPosition
    && liveLegRoute.pickup.lat === focusedPickupPosition.lat
    && liveLegRoute.pickup.lng === focusedPickupPosition.lng);
  const focusedRouteIsCurrent = Boolean(focusedRouteMatches && focusedGpsPosition
    && distanceToPath(focusedGpsPosition, liveLegRoute!.points) <= 0.4);
  const focusedPickupLegPath = focusedGpsPosition && focusedPickupPosition
    ? focusedRouteIsCurrent ? liveLegRoute!.points : [focusedGpsPosition, focusedPickupPosition]
    : [];
  const focusedMapPath = focusedTripStarted ? focusedRoutePlanPath : focusedPickupLegPath;
  const focusedMapMarkers: LeafletMarker[] = [
    ...(focusedGpsPosition ? [{
      id: `mission-${focusedTripId}-vehicle`,
      position: focusedGpsPosition,
      color: focusedGpsFresh ? "#059669" : "#64748b",
      label: "Vehicle",
      isVehicle: true,
      meta: { title: text(focusedTrip, "vehiclePlate", "vehicle_plate") || "Assigned vehicle", subtitle: `${focusedGpsFresh ? "Live" : "Last known"} ${focusedVehicleGpsPosition ? "vehicle GPS" : "driver GPS fallback"}` },
    }] : []),
    ...(focusedTripStarted
      ? focusedRouteWaypoints.map((position, index): LeafletMarker => ({
        id: `mission-${focusedTripId}-route-${index}`,
        position,
        color: index === 0 ? "#db2777" : "#2563eb",
        label: index === 0 ? "Pickup" : index === focusedRouteWaypoints.length - 1 ? "Delivery" : String(index),
        meta: { title: index === 0 ? "Pickup origin" : index === focusedRouteWaypoints.length - 1 ? "Delivery destination" : `Route stop ${index}`, subtitle: pointName(focusedTrip?.stops?.[index - 1]) },
      }))
      : focusedPickupPosition ? [{
        id: `mission-${focusedTripId}-pickup`,
        position: focusedPickupPosition,
        color: "#db2777",
        label: "Pickup",
        meta: { title: "Parcel pickup", subtitle: text(focusedTrip, "fromLocation", "from_location") || text(focusedBooking, "pickup_location", "pickupLocation") || "Pickup origin" },
      }] : []),
  ];
  const focusedMapFocusPoints = focusedTripStarted
    ? [...focusedMapPath, ...(focusedGpsPosition ? [focusedGpsPosition] : [])]
    : focusedMapPath;
  const focusedRouteDistanceExact = Boolean(focusedRouteIsCurrent && liveLegRoute && focusedGpsPosition
    && distanceBetween(focusedGpsPosition, liveLegRoute.start) <= 0.15);
  const focusedPlanDistance = numeric(focusedPlan as RawRecord | null, "optimizedDistanceKm", "optimized_distance_km", "distanceKm", "distance_km");
  const focusedRouteDistance = focusedTripStarted
    ? focusedPlanDistance ?? numeric(focusedTrip, "distanceKm", "distance_km")
    : focusedRouteDistanceExact && liveLegRoute
      ? liveLegRoute.distanceKm
      : focusedGpsPosition && focusedPickupPosition ? distanceBetween(focusedGpsPosition, focusedPickupPosition) : null;
  const focusedEta = focusedTripStarted
    ? formatDate(focusedTrip?.estimatedArrival || field(focusedTrip, "estimated_arrival", "eta_at") || routeDetailsFor(focusedPlan).schedule?.expected_arrival || focusedPlan?.plannedDeliveryDate || focusedPlan?.planned_delivery_date)
    : focusedRouteDistanceExact && liveLegRoute?.durationMin
      ? new Date(Date.now() + liveLegRoute.durationMin * 60_000).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
      : focusedTrip?.estimatedArrival || field(focusedTrip, "estimated_arrival", "eta_at")
        ? formatDate(focusedTrip?.estimatedArrival || field(focusedTrip, "estimated_arrival", "eta_at"))
        : "Unavailable";

  return (
    <div className="min-h-screen bg-[#faf8fa] text-slate-800 antialiased">
      <GlobalNavbar />
      <main className="mx-auto w-full max-w-[1800px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-rose-100 bg-white p-5 shadow-[0_6px_22px_rgba(190,24,93,0.045)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-rose-600"><Activity className="h-3.5 w-3.5" /> VRDS · Operations</div><h1 className="mt-1.5 text-xl font-extrabold text-slate-900 sm:text-2xl">Active Dispatch</h1><p className="mt-1 text-xs text-slate-500">Live trip assignments, pickup proof, route schedules, and delivery status.</p></div>
          <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => void loadDispatchData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button></div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Dispatch summary">
          <SummaryMetric label="Active dispatches" value={activeTrips.length} detail="Not yet completed" icon={Truck} tone="bg-rose-50 text-rose-600" />
          <SummaryMetric label="Pending assignment" value={pendingAssignmentCount} detail="Trips without assigned resources" icon={UserRound} tone="bg-amber-50 text-amber-700" />
          <SummaryMetric label="In progress" value={inProgressCount} detail="Pickup confirmed or en route" icon={Activity} tone="bg-sky-50 text-sky-700" />
          <SummaryMetric label="Completed" value={completedCount} detail="Delivered dispatches" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
          <SummaryMetric label="Delayed" value={delayedCount} detail="Past due or flagged late" icon={AlertCircle} tone="bg-rose-50 text-rose-700" />
        </section>

        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:gap-5">
        <section className="order-1 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-[0_5px_20px_rgba(190,24,93,0.045)] xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1 xl:self-stretch xl:min-h-[480px]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 px-4 py-3.5 sm:px-5">
            <div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${trackingConnection === "live" ? "bg-emerald-500" : "bg-amber-500"}`} /><h2 className="text-sm font-bold text-slate-900">{focusedTrip ? `Mission ${focusedTrip.id}` : "Live tracking"}</h2></div><p className="mt-1 text-[10px] text-slate-500">{focusedTripStarted ? "Pickup complete · following the started delivery route plan" : focusedTrip ? "Vehicle location and driving route to parcel pickup" : "Driver GPS fixes and recorded dispatch routes · live updates with polling fallback"}</p></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${trackingConnection === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><span className={`h-1.5 w-1.5 rounded-full ${trackingConnection === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />{trackingConnection === "live" ? "Realtime connected" : "Reconnecting · polling active"}</span>{!focusedTrip && <><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Road routes {liveTracking.coloredPaths.length}</span>{liveTracking.routesPending > 0 && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Routing {liveTracking.routesPending}</span>}</>}{trackingUpdatedAt && <span className="text-slate-400">Updated {formatDate(trackingUpdatedAt)}</span>}</div>
          </header>
          {focusedTrip && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-rose-50/40 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-600">
              <StatusBadge trip={focusedTrip} />
              <span className="inline-flex items-center gap-1.5"><UserRound className="h-3 w-3 text-rose-500" />{text(focusedDriver, "full_name", "name") || text(focusedTrip, "driverName", "driver_name") || "Driver not assigned"}</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="h-3 w-3 text-rose-500" />{text(focusedTrip, "vehiclePlate", "vehicle_plate") || "Vehicle not assigned"}</span>
              <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3 text-rose-500" />{focusedTripParcels.length} parcel{focusedTripParcels.length === 1 ? "" : "s"}{focusedTripParcels[0] ? ` · ${text(focusedTripParcels[0], "trackingNumber", "tracking_number") || focusedTripParcels[0].id} · ${text(focusedTripParcels[0], "recipientName", "recipient_name") || "Recipient not recorded"}` : ""}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-rose-500" />{text(focusedTrip, "fromLocation", "from_location") || text(focusedBooking, "pickup_location", "pickupLocation") || "Pickup location not recorded"}</span>
              <span className="inline-flex items-center gap-1.5"><Route className="h-3 w-3 text-rose-500" />{focusedRouteDistance == null ? "Distance unavailable" : `${focusedTripStarted ? "" : focusedRouteDistanceExact ? "" : "Approx. "}${focusedRouteDistance.toFixed(1)} km ${focusedTripStarted ? "planned" : "to pickup"}`}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3 w-3 text-rose-500" />{focusedTripStarted ? "Delivery ETA" : "Pickup ETA"} {focusedEta}</span>
            </div>
            <button type="button" onClick={() => { suppressAutoFocusRef.current = true; setFocusedTripId(null); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50"><X className="h-3 w-3" />All missions</button>
          </div>}
          <div className="flex min-h-0 flex-1 p-3 sm:p-4">
            <div className="relative h-[320px] min-h-0 w-full min-w-0 overflow-hidden rounded-xl border border-rose-100 bg-slate-50 sm:h-[390px] xl:h-full xl:min-h-[400px]">
              {(focusedTrip ? focusedMapMarkers.length > 0 : liveTracking.markers.length > 0) ? <LeafletMap center={focusedTrip ? focusedGpsPosition || focusedPickupPosition || liveTracking.markers[0]?.position : liveTracking.markers[0].position} zoom={focusedTrip ? 13 : 10} markers={focusedTrip ? focusedMapMarkers : liveTracking.markers} coloredPaths={focusedTrip ? (focusedMapPath.length > 1 ? [{ points: focusedMapPath, color: "#db2777", label: focusedTripStarted ? "Started route plan" : "Vehicle to pickup" }] : []) : liveTracking.coloredPaths} focusKey={focusedTrip ? `${focusedTrip.id}:${focusedTripStarted}:${focusedMapPath.length}:${mapFocusRequest}` : focusedTripId ? `${focusedTripId}:${liveTracking.focusPointsByTrip[focusedTripId]?.length || 0}` : null} focusPoints={focusedTrip ? focusedMapFocusPoints : focusedTripId ? liveTracking.focusPointsByTrip[focusedTripId] || [] : []} routeColor="#db2777" className="h-full min-h-0 w-full rounded-xl" onMarkerClick={(marker) => { const tripId = liveTracking.markerTripIds.get(marker.id); if (tripId) { setFocusedTripId(tripId); setSelectedTripId(tripId); } }} /> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><MapPin className="h-8 w-8 text-rose-300" /><p className="mt-3 text-xs font-bold text-slate-700">{loading ? "Loading mission locations" : focusedTrip ? "Mission coordinates unavailable" : "No location coordinates available"}</p><p className="mt-1 max-w-sm text-[10px] leading-4 text-slate-500">{loading ? "Loading trips and current driver locations..." : focusedTrip ? "Waiting for vehicle GPS and pickup coordinates from the linked trip records." : "The map will show driver GPS fixes and trip routes when valid coordinates are reported by the tracking service."}</p></div>}
              {!focusedTrip && trackingError && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg border border-amber-200 bg-white/95 px-3 py-2 text-[10px] text-amber-800 shadow-sm">Live driver locations unavailable: {trackingError}</p>}
              {focusedTrip && (!focusedGpsPosition || !focusedPickupPosition) && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg border border-amber-200 bg-white/95 px-3 py-2 text-[10px] text-amber-800 shadow-sm">{!focusedGpsPosition ? vehicleGpsError || trackingError || "Waiting for valid vehicle GPS coordinates." : "Pickup coordinates are missing from the linked trip, route plan, and booking."}</p>}
              {focusedTrip && !focusedTripStarted && focusedGpsPosition && focusedPickupPosition && (liveLegError || !focusedRouteIsCurrent) && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg border border-sky-200 bg-white/95 px-3 py-2 text-[10px] text-sky-800 shadow-sm">{liveLegError ? "Road routing unavailable; showing the direct direction to pickup." : "Updating driving route from the latest vehicle position…"}</p>}
              {focusedTripStarted && focusedMapPath.length < 2 && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg border border-sky-200 bg-white/95 px-3 py-2 text-[10px] text-sky-800 shadow-sm">Loading the saved or optimized route plan geometry…</p>}
              {!trackingError && (liveTracking.routesUnavailable > 0 || liveTracking.routesPending > 0) && <p role="status" className={`absolute bottom-2 left-2 right-2 rounded-lg border bg-white/95 px-3 py-2 text-[10px] shadow-sm ${liveTracking.routesUnavailable > 0 ? "border-amber-200 text-amber-800" : "border-sky-200 text-sky-800"}`}>{liveTracking.routesUnavailable > 0 ? `Road geometry unavailable for ${liveTracking.routesUnavailable} route${liveTracking.routesUnavailable === 1 ? "" : "s"}; no straight-line substitute is shown.` : `Calculating ${liveTracking.routesPending} road route${liveTracking.routesPending === 1 ? "" : "s"} with OSRM…`}{liveTracking.routesUnavailable > 0 && liveTracking.routesPending > 0 ? ` ${liveTracking.routesPending} more route${liveTracking.routesPending === 1 ? " is" : "s are"} still routing.` : ""}</p>}
            </div>
          </div>
        </section>

        {pageError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{pageError}</span><button type="button" onClick={() => void loadDispatchData()} className="font-bold underline">Retry</button></div>}
        {dataWarning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Some related records could not be loaded: {dataWarning}</div>}
        <section className="order-2 min-w-0 space-y-3 rounded-2xl border border-rose-100 bg-white p-3 shadow-[0_5px_20px_rgba(190,24,93,0.045)] xl:order-none xl:col-start-1 xl:row-start-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto hide-scrollbar">
            <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-rose-100 bg-white p-3 shadow-[0_4px_16px_rgba(190,24,93,0.035)]">
              <label className="relative block min-w-0 w-full"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dispatch, route, driver, vehicle, parcel…" className="block w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100" aria-label="Search dispatches" /></label>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <select value={filter} onChange={(event) => setFilter(event.target.value as BoardFilter)} aria-label="Filter dispatch status" className="block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"><option value="active">Active dispatches</option><option value="all">All statuses</option><option value="needs-assignment">Needs assignment</option><option value="in-progress">In progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option></select>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort dispatches" className="block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"><option value="latest">Latest activity</option><option value="oldest">Oldest activity</option><option value="scheduled">Departure time</option></select>
              </div>
            </div>

            <div className="flex items-center justify-between px-1"><div><h2 className="text-sm font-bold text-slate-900">Dispatch board</h2><p className="mt-0.5 text-[10px] text-slate-500">{displayedTrips.length} records {updatedAt ? `· Updated ${formatDate(updatedAt)}` : ""}</p></div><ArrowDownUp className="h-4 w-4 text-rose-400" /></div>

            {loading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl border border-rose-100 bg-white" /><div className="h-52 animate-pulse rounded-2xl border border-rose-100 bg-white" /></div>
              : displayedTrips.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-rose-200 bg-white px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><Route className="h-5 w-5" /></span><p className="mt-3 text-sm font-bold text-slate-800">{trips.length ? "No dispatches match these filters" : "No dispatch records yet"}</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{trips.length ? "Try another status or search term." : "Dispatches will appear here when trips are created from bookings."}</p>{trips.length > 0 && <button type="button" onClick={() => { setFilter("all"); setSearch(""); }} className="mt-3 text-xs font-bold text-rose-700 hover:text-rose-800">Clear filters</button>}</div>
              : <div className="grid grid-cols-1 gap-2">{displayedTrips.map((trip) => {
                const booking = bookingsById.get(String(trip.bookingId || trip.booking_id || ""));
                const plan = routePlanFor(trip, booking || undefined);
                const stops = pointsFor(trip, booking || undefined);
                const tripBookingId = String(trip.bookingId || trip.booking_id || "");
                const tripRoutePlanId = String(trip.routePlanId || trip.route_plan_id || "");
                const parcelsForTrip = parcels.filter((parcel) => String(parcel.tripId || parcel.trip_id || "") === trip.id
                  || Boolean(tripBookingId && String(parcel.bookingId || parcel.booking_id || "") === tripBookingId)
                  || Boolean(tripRoutePlanId && String(parcel.routePlanId || parcel.route_plan_id || "") === tripRoutePlanId));
                const origin = text(trip, "fromLocation", "from_location") || text(booking, "pickup_location", "pickupLocation") || plan?.pickupLocation || plan?.pickup_location || "Pickup not recorded";
                const destination = text(trip, "toLocation", "to_location") || routeDetailsFor(plan).destination?.address || routeDetailsFor(plan).destination?.name || (stops.length ? pointName(stops[stops.length - 1]) : "Delivery not recorded");
                const scheduledDeparture = trip.estimatedDeparture || field(trip, "estimated_departure", "scheduled_at") || routeDetailsFor(plan).schedule?.depart_at || plan?.plannedDeliveryDate || plan?.planned_delivery_date || booking?.bookingDate || field(booking, "booking_date");
                return <button key={trip.id} type="button" aria-pressed={focusedTripId === trip.id} onClick={() => { suppressAutoFocusRef.current = false; setFocusedTripId(trip.id); setMapFocusRequest((request) => request + 1); }} className={`group min-w-0 rounded-xl border p-3 text-left shadow-[0_2px_8px_rgba(190,24,93,0.035)] transition duration-200 hover:border-rose-200 hover:bg-rose-50/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${focusedTripId === trip.id ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-200" : "border-rose-100/90 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-[10px] font-bold text-rose-700">{trip.id}</p><p className="mt-1 truncate text-[10px] text-slate-400">Booking {trip.bookingId || trip.booking_id || "Not linked"}</p></div><StatusBadge trip={trip} /></div>
                  <div className="mt-3 flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /><p className="min-w-0 text-xs font-bold leading-5 text-slate-900"><span className="line-clamp-1">{origin}</span><span className="my-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400"><ArrowRight className="h-3 w-3" />{planName(plan)}</span><span className="line-clamp-1">{destination}</span></p></div>
                  <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-rose-50/50 px-2.5 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Driver</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-800">{text(trip, "driverName", "driver_name") || "Unassigned"}</p></div><div className="rounded-xl bg-slate-50 px-2.5 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Vehicle</p><p className="mt-1 truncate text-[10px] font-semibold text-slate-800">{text(trip, "vehiclePlate", "vehicle_plate") || "Unassigned"}</p></div></div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[9px] text-slate-500"><span className="inline-flex items-center gap-1"><Package className="h-3 w-3 text-rose-400" />{parcelsForTrip.length} parcels</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3 text-rose-400" />{formatDate(scheduledDeparture)}</span><span className="truncate">{routeDetailsFor(plan).priority || "Normal"} priority</span></div>
                  {numeric(trip, "progress") != null && <div className="mt-2.5"><div className="mb-1 flex justify-between text-[9px] text-slate-400"><span>Progress</span><span>{Math.max(0, Math.min(100, Number(trip.progress)))}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, Number(trip.progress)))}%` }} /></div></div>}
                  <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-bold text-rose-600 opacity-0 transition group-hover:opacity-100">Focus route <ArrowRight className="h-3 w-3" /></div>
                </button>;
              })}</div>}
          </section>
        </div>
      </main>

      {selectedTrip && <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTripId(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="dispatch-detail-heading" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-rose-100 bg-white shadow-2xl">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rose-100 bg-white/95 p-4 backdrop-blur sm:p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="dispatch-detail-heading" className="font-mono text-sm font-extrabold text-slate-900">{selectedTrip.id}</h2><StatusBadge trip={selectedTrip} /></div><p className="mt-1 text-xs text-slate-500">{planName(selectedPlan)}{selectedBooking ? ` · Booking ${selectedBooking.id}` : ""}</p></div><button type="button" aria-label="Close dispatch details" onClick={() => setSelectedTripId(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><X className="h-4 w-4" /></button></header>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><InfoCell label="Driver" value={text(selectedTrip, "driverName", "driver_name") || "Unassigned"} icon={UserRound} /><InfoCell label="Vehicle" value={text(selectedTrip, "vehiclePlate", "vehicle_plate") || "Unassigned"} icon={Truck} /><InfoCell label="Priority" value={String(selectedPlanDetails.priority || field(selectedTrip, "priority") || "Normal")} icon={Activity} /><InfoCell label="Parcel load" value={`${numeric(selectedTrip, "loadKg", "load_kg") ?? selectedTripParcels.reduce((sum, parcel) => sum + (Number(parcel.weightKg ?? parcel.weight_kg) || 0), 0)} kg · ${selectedTripParcels.length} parcels`} icon={Package} /></div>

            <section className="grid gap-2 sm:grid-cols-2"><InfoCell label="Pickup location" value={text(selectedTrip, "fromLocation", "from_location") || text(selectedBooking, "pickup_location", "pickupLocation") || selectedPlan?.pickupLocation || selectedPlan?.pickup_location || "Not recorded"} icon={MapPin} /><InfoCell label="Delivery location" value={text(selectedTrip, "toLocation", "to_location") || selectedPlanDetails.destination?.address || selectedPlanDetails.destination?.name || (selectedStops.length ? pointName(selectedStops[selectedStops.length - 1]) : "Not recorded")} icon={MapPin} /><InfoCell label="Scheduled departure" value={formatDate(selectedTrip.estimatedDeparture || field(selectedTrip, "estimated_departure", "scheduled_at") || selectedPlanDetails.schedule?.depart_at || selectedPlan?.plannedDeliveryDate || selectedPlan?.planned_delivery_date || selectedBooking?.bookingDate)} icon={CalendarClock} /><InfoCell label="Expected arrival" value={formatDate(selectedTrip.estimatedArrival || field(selectedTrip, "estimated_arrival", "eta_at") || selectedPlanDetails.schedule?.expected_arrival)} icon={Clock3} /><InfoCell label="Created" value={formatDate(selectedTrip.createdAt || field(selectedTrip, "created_at"))} icon={Clock3} /><InfoCell label="Last updated" value={formatDate(selectedTrip.updatedAt || field(selectedTrip, "updated_at"))} icon={RefreshCw} /><InfoCell label="Pickup confirmed" value={formatDate(selectedTrip.pickupConfirmedAt || field(selectedTrip, "pickup_confirmed_at"))} icon={CheckCircle2} /><InfoCell label="Completed" value={formatDate(field(selectedTrip, "completed_at", "actualArrival", "actual_arrival"))} icon={Check} /><InfoCell label="Pickup status" value={String(selectedTrip.pickupStatus || field(selectedTrip, "pickup_status") || "Pending").replace(/[_-]+/g, " ")} icon={CheckCircle2} /><InfoCell label="Distance / duration" value={`${numeric(selectedTrip, "distanceKm", "distance_km") ?? selectedPlan?.optimizedDistanceKm ?? selectedPlan?.distanceKm ?? "Not recorded"}${numeric(selectedTrip, "distanceKm", "distance_km") != null || selectedPlan?.optimizedDistanceKm != null || selectedPlan?.distanceKm != null ? " km" : ""} · ${numeric(selectedTrip, "durationMinutes", "duration_minutes") ?? selectedPlan?.optimizedDurationMinutes ?? selectedPlan?.durationMinutes ?? "Not recorded"}${numeric(selectedTrip, "durationMinutes", "duration_minutes") != null || selectedPlan?.optimizedDurationMinutes != null || selectedPlan?.durationMinutes != null ? " min" : ""}`} icon={Route} /></section>

            {selectedStops.length > 0 && <section><div className="mb-2 flex items-center gap-2"><Route className="h-4 w-4 text-rose-500" /><h3 className="text-xs font-bold text-slate-800">Route plan · {planName(selectedPlan)}</h3></div><ol className="space-y-2">{selectedStops.map((stop, index) => <li key={`${stop.id || stop.name || stop.address}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{pointName(stop)}</p>{stop.address && <p className="mt-0.5 break-words text-[10px] text-slate-500">{stop.address}</p>}<p className="mt-1 text-[9px] text-slate-400">{stop.arrival ? `Arrival ${formatDate(stop.arrival)}` : "Arrival time not recorded"}{stop.durationMinutes ? ` · ${stop.durationMinutes} min stop` : ""}</p></div></li>)}</ol></section>}

            <section><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-800">Parcel manifest</h3><span className="text-[10px] text-slate-400">{selectedTripParcels.length} records</span></div>{selectedTripParcels.length ? <div className="grid gap-2 sm:grid-cols-2">{selectedTripParcels.map((parcel) => <article key={parcel.id} className="min-w-0 rounded-xl border border-slate-100 bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="truncate font-mono text-[10px] font-bold text-rose-700">{text(parcel, "trackingNumber", "tracking_number") || parcel.id}</p><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">{String(parcel.status || "Unknown").replace(/[_-]+/g, " ")}</span></div><p className="mt-1 text-[10px] text-slate-700">{text(parcel, "recipientName", "recipient_name") || "Recipient not recorded"}</p><p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{text(parcel, "destinationAddress", "delivery_address", "destination") || "Delivery address not recorded"}</p><p className="mt-1 text-[9px] text-slate-400">{Number(parcel.weightKg ?? parcel.weight_kg) || 0} kg</p></article>)}</div> : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[10px] text-slate-500">No linked parcel records were returned for this dispatch.</p>}</section>

          </div>
        </section>
      </div>}

      <GlobalFooter />
    </div>
  );
}
