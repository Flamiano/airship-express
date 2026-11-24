"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { Activity, Clock3, Crosshair, MapPin, Package, Route, Truck, UserRound } from "lucide-react";
import type { DashboardTrip, DashboardVehicle, DashboardBooking } from "../page";
import type { LeafletMarker } from "../../../components/map/LeafletMap";
import { isCompletedTripStatus, isOperationalTrip, isTripInTransitStatus } from "../../../lib/parcelTypes";
import { SkeletonMap } from "../../../components/global/PageSkeleton";

const LeafletMap = dynamic(() => import("../../../components/map/LeafletMap"), {
  ssr: false,
  loading: () => <SkeletonMap className="h-[400px] w-full" />,
});

type LatLng = { lat: number; lng: number };
type DataRecord = Record<string, unknown>;
type MapParcel = {
  id?: string | number | null;
  bookingId?: string | number | null;
  booking_id?: string | number | null;
  tripId?: string | number | null;
  trip_id?: string | number | null;
  routePlanId?: string | number | null;
  route_plan_id?: string | number | null;
  courier?: string | null;
  trackingNumber?: string | null;
  tracking_number?: string | null;
  recipientName?: string | null;
  recipient_name?: string | null;
  parcelType?: string | null;
  type?: string | null;
  destinationAddress?: string | null;
  address?: string | null;
  dropoffAddress?: string | null;
};
type MapDriver = {
  id?: string | number | null;
  name?: string | null;
  full_name?: string | null;
};
type RouteStop = {
  name: string;
  label: string;
  lat: unknown;
  lng: unknown;
  status?: string | null;
};

function asRecord(value: unknown): DataRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    const initialUpdate = window.setTimeout(updateTime, 0);
    const interval = window.setInterval(updateTime, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

function validCoordinates(lat: unknown, lng: unknown): LatLng | null {
  if (lat == null || lng == null || String(lat).trim() === "" || String(lng).trim() === "") return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  return { lat: latitude, lng: longitude };
}

type Delivery = {
  id: string;
  name: string;
  driverName: string;
  vehiclePlate: string | null;
  etaMinutes: number | null;
  parcelSummary: string;
  parcelCount: number;
  parcelReference: string | null;
  recipientName: string | null;
  parcelDetails: string[];
  origin: string;
  destination: string;
  originPos: LatLng | null;
  destPos: LatLng | null;
  currentPos: LatLng | null;
  locationIsFresh: boolean;
  status: string;
  bookingId: string;
  courier?: string;
  vehicleId: string;
  locationRecordedAt: string | null;
  stops: Array<{ name: string; lat: number | null; lng: number | null; status?: string | null }>;
  routePlanPolyline?: LatLng[] | null;
  routeWaypoints?: LatLng[];
  routeCoordinatesComplete?: boolean;
  isSavedPlan?: boolean;
  routePlanId?: string | null;
  routePlanName?: string | null;
  routeStarted?: boolean;
  progress?: number | null;
};

function normalizeRoutePlanPolyline(value: unknown): LatLng[] | null {
  const routePlan = asRecord(value);
  const route = asRecord(routePlan?.route);
  const geometry = asRecord(routePlan?.geometry);
  const source = routePlan?.polyline || route?.polyline || geometry?.coordinates || value;
  if (!Array.isArray(source)) return null;

  const points = source.flatMap((point: unknown) => {
    if (Array.isArray(point)) {
      const coordinates = validCoordinates(point[1], point[0]);
      return coordinates ? [coordinates] : [];
    }

    const pointRecord = asRecord(point);
    const coordinates = validCoordinates(
      pointRecord?.lat ?? pointRecord?.latitude,
      pointRecord?.lng ?? pointRecord?.longitude
    );
    return coordinates ? [coordinates] : [];
  });

  return points.length > 1 ? points : null;
}

function pointFromRouteRecord(value: unknown): LatLng | null {
  const record = asRecord(value);
  if (!record) return null;
  const location = asRecord(record.location);
  return validCoordinates(
    record.lat ?? record.latitude ?? location?.lat ?? location?.latitude,
    record.lng ?? record.longitude ?? location?.lng ?? location?.longitude
  );
}

function resolveTripStops(
  trip: DashboardTrip,
  booking?: DashboardBooking,
  routePlan?: DataRecord | null
): RouteStop[] {
  const tripRecord = asRecord(trip) ?? {};
  const bookingRecord = asRecord(booking);
  const explicitStops = Array.isArray(tripRecord.stops) ? tripRecord.stops : [];
  const planStops = Array.isArray(routePlan?.stops) ? routePlan.stops : [];
  const bookingStops = Array.isArray(bookingRecord?.stops) ? bookingRecord.stops : [];
  const routePlanStopRecords = Array.isArray(routePlan?.routePlanStops) ? routePlan.routePlanStops : [];
  const fallbackStops = Array.isArray(tripRecord.routePlanStops) ? tripRecord.routePlanStops : routePlanStopRecords;

  const candidates = [...explicitStops, ...fallbackStops, ...planStops, ...bookingStops];
  return candidates.flatMap((stop) => {
    const stopRecord = asRecord(stop);
    if (!stopRecord) return [];
    const location = asRecord(stopRecord.location);
    const name = String(stopRecord.name || stopRecord.label || stopRecord.stop_name || "Stop");
    const label = String(stopRecord.label || stopRecord.name || stopRecord.stop_name || "Stop");
    return [{
      name,
      label,
      lat: stopRecord.lat ?? stopRecord.latitude ?? location?.lat ?? null,
      lng: stopRecord.lng ?? stopRecord.longitude ?? location?.lng ?? null,
      status: typeof stopRecord.status === "string" ? stopRecord.status : null,
    }];
  });
}

function routeIsStarted(status?: string | null) {
  return /^(started|in transit|en route|departed|on the way|picked up)$/i.test(String(status || ""));
}

function distanceKmBetween(start: LatLng, end: LatLng) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

const isActiveTripStatus = (status?: string | null) => {
  return isOperationalTrip({ id: status ? "status" : null, status });
};

function hasFreshDeviceLocation(trip: DashboardTrip, now: number) {
  const tripRecord = asRecord(trip) ?? {};
  const currentLocation = asRecord(tripRecord.currentLocation);
  if (typeof currentLocation?.is_fresh === "boolean") return currentLocation.is_fresh;
  const position = validCoordinates(
    currentLocation?.lat ?? tripRecord.locationLat,
    currentLocation?.lng ?? tripRecord.locationLng,
  );
  const recordedAt = currentLocation?.recorded_at || tripRecord.locationRecordedAt;
  const recordedAtMs = recordedAt ? Date.parse(String(recordedAt)) : NaN;
  return Boolean(position) && Number.isFinite(recordedAtMs) && recordedAtMs <= now + 5 * 60_000 && now - recordedAtMs <= 5 * 60_000;
}

function calculateEtaAndProgress(trip: DashboardTrip, now: number | null) {
  const plan = trip.routePlan ?? trip.route_plan;
  const arrival = trip.estimated_arrival || trip.eta_at
    || plan?.routeDetails?.schedule?.expected_arrival
    || plan?.route_details?.schedule?.expected_arrival;
  const arrivalTime = arrival ? Date.parse(String(arrival)) : NaN;
  return {
    etaMinutes: now !== null && Number.isFinite(arrivalTime) ? Math.max(0, Math.ceil((arrivalTime - now) / 60000)) : null,
    progress: trip.progress == null || !Number.isFinite(Number(trip.progress)) ? null : Number(trip.progress),
  };
}

export default function MapSection({
  trips,
  vehicles,
  bookings = [],
  parcels = [],
  drivers = [],
  routePlans = [],
  isFullscreen: externalFullscreen,
  onToggleFullscreen,
}: {
  trips: DashboardTrip[];
  vehicles: DashboardVehicle[];
  bookings?: DashboardBooking[];
  parcels?: MapParcel[];
  drivers?: MapDriver[];
  routePlans?: DataRecord[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const [pickupRoadPaths, setPickupRoadPaths] = useState<Record<string, { key: string; points: LatLng[]; distanceKm: number | null; durationMin: number | null }>>({});
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showCoordinates] = useState(true);
  const [showOnlyTrackingVehicles, setShowOnlyTrackingVehicles] = useState(false);
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const now = useCurrentTime();
  const routePlansById = useMemo<Record<string, DataRecord>>(
    () => Object.fromEntries(routePlans.flatMap((plan) => {
      const id = plan.id;
      return id == null || id === "" ? [] : [[String(id), plan] as const];
    })),
    [routePlans]
  );
  const routePlansByTripId = useMemo<Record<string, DataRecord>>(
    () => Object.fromEntries(routePlans.flatMap((plan) => {
      const tripId = plan.trip_id || plan.tripId;
      return tripId == null || tripId === "" ? [] : [[String(tripId), plan] as const];
    })),
    [routePlans]
  );

  const isFullscreen = externalFullscreen ?? internalFullscreen;
  const setIsFullscreen = useCallback(() => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }

    setInternalFullscreen((value) => !value);
  }, [onToggleFullscreen]);

  const selectDelivery = useCallback((deliveryId: string) => {
    setSelectedDeliveryId(deliveryId);
    setModalOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    dragState.current = null;
  }, [selectedDeliveryId]);

  // Keyboard shortcuts: Ctrl+F for fullscreen, ESC to exit
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC to exit fullscreen
      if (event.key === "Escape" && isFullscreen) {
        event.preventDefault();
        setIsFullscreen();
        return;
      }

      // Ctrl+F or Cmd+F for fullscreen
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        setIsFullscreen();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, setIsFullscreen]);

  const uniqueTrips = useMemo(
    () => Array.from(new Map(trips.filter((trip) => trip.id).map((trip) => [String(trip.id), trip])).values()),
    [trips]
  );
  const activeTrips = useMemo(
    () => uniqueTrips.filter((trip) => isActiveTripStatus(trip.status)),
    [uniqueTrips]
  );

  const visibleTrips = useMemo(
    () => activeTrips,
    [activeTrips]
  );

  const normalizeTripStatus = (value?: string | null) => {
    const status = String(value || "").trim().toLowerCase();
    if (isCompletedTripStatus(status)) return "Completed";
    if (/critical|late|delayed/.test(status)) return "Delayed";
    if (/approach|near|arriving/.test(status)) return "Approaching";
    if (isTripInTransitStatus(status)) return "In Transit";
    return status ? status.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
  };

  const resolveDriverName = useCallback((driverId?: string | null, fallbackName?: string | null) => {
    if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
    if (!driverId) return "Unassigned driver";
    const driver = drivers.find((item) => String(item.id) === String(driverId));
    return driver?.name || driver?.full_name || "Unassigned driver";
  }, [drivers]);

  const deliveries = useMemo<Delivery[]>(() => {
    const tripDeliveries = visibleTrips.flatMap((trip) => {
      const tripRecord = asRecord(trip) ?? {};
      const bookingId = String(tripRecord.bookingId ?? tripRecord.booking_id ?? "");
      const driverId = String(tripRecord.driverId ?? tripRecord.driver_id ?? "");
      const vehicleId = String(trip.vehicleId || trip.vehicle_id || "");
      const vehicle = vehicles.find((item) => String(item.id || item.vehicle_id || "") === vehicleId);
      const driverName = String(tripRecord.driverName || tripRecord.driver_name || "");
      const currentLocation = asRecord(tripRecord.currentLocation);
      const currentPos = validCoordinates(
        currentLocation?.lat ?? tripRecord.locationLat,
        currentLocation?.lng ?? tripRecord.locationLng
      );

      const booking = bookingId
        ? bookings.find((item) => String(item.id) === String(bookingId))
        : undefined;
      const bookingRecord = asRecord(booking);
      const routePlanId = String(
        bookingRecord?.routePlanId || bookingRecord?.route_plan_id
        || tripRecord.routePlanId || tripRecord.route_plan_id || ""
      );
      const parcelIds = bookingRecord?.parcelIds ?? bookingRecord?.parcel_ids;
      const bookingParcelIds = new Set(Array.isArray(parcelIds) ? parcelIds.map(String) : []);
      const bookingCargoCount = Number(
        String(bookingRecord?.cargo_description || "").match(/(\d+)\s+parcel/i)?.[1] || 0
      );
      const tripId = String(tripRecord.id || tripRecord.trip_id || "");
      const normalizedRoutePlanId: string = routePlanId;
      const tripParcels = parcels.filter((parcel) => {
        const parcelId = String(parcel.id || "");
        return (
          (bookingId && String(parcel.bookingId || parcel.booking_id || "") === bookingId) ||
          (tripId && String(parcel.tripId || parcel.trip_id || "") === tripId) ||
          (normalizedRoutePlanId && String(parcel.routePlanId || parcel.route_plan_id || "") === normalizedRoutePlanId) ||
          bookingParcelIds.has(parcelId)
        );
      });
      const distinctTripParcels = Array.from(new Map(tripParcels.map((parcel) => [String(parcel.id), parcel])).values());
      const firstParcel = distinctTripParcels[0];
      const parcelCount = distinctTripParcels.length || bookingParcelIds.size
        || Number(bookingRecord?.parcelCount || bookingRecord?.parcel_count || 0)
        || bookingCargoCount;
      const routePlan = (routePlanId ? routePlansById[routePlanId] : null) || routePlansByTripId[tripId] || null;
      const resolvedRoutePlanId = routePlanId || (routePlan ? String(routePlan.id || "") : "");
      const routePlanPolyline = normalizeRoutePlanPolyline(routePlan);

      const orderedStops = resolveTripStops(trip, booking, routePlan);
      const routeDetails = asRecord(routePlan?.routeDetails);
      const routeDetailsSnakeCase = asRecord(routePlan?.route_details);
      const routeDestination = routeDetails?.destination || routeDetailsSnakeCase?.destination;
      const destinationRecord = routeDestination || orderedStops[orderedStops.length - 1] || null;
      const destinationStop = orderedStops[orderedStops.length - 1];
      const planDestinationIsSeparate = Boolean(routeDestination || destinationStop);
      const routeStopRecords = routePlan && planDestinationIsSeparate ? orderedStops.slice(0, -1) : orderedStops;
      const stops = routeStopRecords.map((stop) => ({
        name: stop.name || "Stop",
        lat: validCoordinates(stop.lat, stop.lng)?.lat ?? null,
        lng: validCoordinates(stop.lat, stop.lng)?.lng ?? null,
        status: stop.status,
      }));
      const destinationProperties = asRecord(destinationRecord);
      const destination = String(
        destinationProperties?.name || destinationProperties?.label
        || trip.toLocation || trip.destination_location || tripRecord.to || "Unknown destination"
      );
      const originPos = trip.fromCoords || validCoordinates(trip.from_latitude, trip.from_longitude)
        || (routePlan ? validCoordinates(
          routePlan.pickupLatitude ?? routePlan.pickup_latitude,
          routePlan.pickupLongitude ?? routePlan.pickup_longitude
        ) : null);
      const destPos = pointFromRouteRecord(destinationRecord)
        || trip.toCoords || validCoordinates(trip.to_latitude, trip.to_longitude);
      const validOrderedStopPoints = orderedStops.map((stop) => pointFromRouteRecord(stop));
      const routeWaypoints = [originPos, ...validOrderedStopPoints.filter((point): point is LatLng => Boolean(point)), ...(destPos ? [destPos] : [])]
        .filter((point): point is LatLng => Boolean(point))
        .filter((point, index, points) => index === 0 || point.lat !== points[index - 1].lat || point.lng !== points[index - 1].lng);
      const routeCoordinatesComplete = Boolean(originPos && destPos) && validOrderedStopPoints.every(Boolean);
      const pickupStatus = String(tripRecord.pickup_status || tripRecord.pickupStatus || "").toLowerCase().replace(/[_-]+/g, " ");
      const routeStarted = pickupStatus === "started" || routeIsStarted(trip.status);

      const { etaMinutes, progress } = calculateEtaAndProgress(trip, now);

      const courierFromParcels = distinctTripParcels.find((p) => p.courier)?.courier;
      const courierFromRoutePlan = typeof routePlan?.courier === "string" ? routePlan.courier : null;
      const courier = courierFromParcels || courierFromRoutePlan || "Unassigned courier";
      const resolvedDriverName = resolveDriverName(driverId, driverName);
      const parcelDetails = distinctTripParcels.slice(0, 4).map((parcel) => {
        const recipient = parcel.recipientName || parcel.recipient_name || "Recipient";
        const type = parcel.parcelType || parcel.type || "Parcel";
        const address = parcel.destinationAddress || parcel.address || parcel.dropoffAddress || "Address pending";
        return `${recipient} • ${type} • ${address}`;
      }).filter(Boolean);

      return [{
        id: String(tripRecord.id || tripRecord.trip_id || ""),
        routePlanId: routePlan ? String(routePlan.id || resolvedRoutePlanId) : null,
        routePlanName: routePlan
          ? String(routePlan.route_name || routePlan.routeName || routeDetails?.route_name || "") || null
          : null,
        routeStarted,
        routeWaypoints,
        routeCoordinatesComplete,
        isSavedPlan: false,
        vehicleId,
        name: resolvedDriverName,
        driverName: resolvedDriverName,
        vehiclePlate: vehicle ? vehicle.plateNumber || vehicle.plate_number || null : null,
        parcelSummary: `${parcelCount} parcels — ${destination}${stops.length > 1 ? ` • ${stops.length} stops` : ""}`,
        parcelCount,
        parcelReference: firstParcel ? firstParcel.trackingNumber || firstParcel.tracking_number || null : null,
        recipientName: firstParcel ? firstParcel.recipientName || firstParcel.recipient_name || null : null,
        parcelDetails,
        origin: trip.fromLocation || trip.pickup_location || "Unknown pickup",
        destination,
        originPos,
        destPos,
        currentPos,
        locationIsFresh: now !== null && hasFreshDeviceLocation(trip, now),
        progress,
        etaMinutes,
        status: normalizeTripStatus(trip.status),
        bookingId,
        courier,
        stops,
        routePlanPolyline,
        locationRecordedAt: typeof (currentLocation?.recorded_at ?? tripRecord.locationRecordedAt) === "string"
          ? String(currentLocation?.recorded_at ?? tripRecord.locationRecordedAt)
          : null,
      }];
    });

    return tripDeliveries;
  }, [visibleTrips, vehicles, bookings, parcels, routePlansById, routePlansByTripId, now, resolveDriverName]);

  const selectedDelivery = deliveries.find((delivery) => delivery.id === selectedDeliveryId) || null;
  const focusableDelivery = selectedDelivery?.currentPos && selectedDelivery.originPos
    ? selectedDelivery
    : deliveries.find((delivery) => delivery.currentPos && delivery.originPos) || selectedDelivery;
  const canFocusRoute = Boolean(focusableDelivery?.currentPos && focusableDelivery.originPos);
  const focusRoute = () => {
    if (!canFocusRoute || !focusableDelivery) return;
    selectDelivery(focusableDelivery.id);
    setMapFocusRequest((value) => value + 1);
  };
  const pickupDeliveryId = selectedDelivery?.id;
  const pickupStartLat = selectedDelivery?.currentPos?.lat;
  const pickupStartLng = selectedDelivery?.currentPos?.lng;
  const pickupOriginLat = selectedDelivery?.originPos?.lat;
  const pickupOriginLng = selectedDelivery?.originPos?.lng;
  const pickupRouteRequest = useMemo(() => {
    if (
      !pickupDeliveryId ||
      pickupStartLat == null ||
      pickupStartLng == null ||
      pickupOriginLat == null ||
      pickupOriginLng == null
    ) return null;
    const start = { lat: pickupStartLat, lng: pickupStartLng };
    const pickup = { lat: pickupOriginLat, lng: pickupOriginLng };
    return {
      key: `${pickupDeliveryId}:${start.lat},${start.lng}:${pickup.lat},${pickup.lng}`,
      tripId: pickupDeliveryId,
      waypoints: [start, pickup],
    };
  }, [pickupDeliveryId, pickupStartLat, pickupStartLng, pickupOriginLat, pickupOriginLng]);

  useEffect(() => {
    if (!pickupRouteRequest) return;
    let cancelled = false;
    void fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints: pickupRouteRequest.waypoints }),
      cache: "no-store",
    })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (cancelled || !Array.isArray(result?.polyline)) return;
        const points = normalizeRoutePlanPolyline(result.polyline);
        if (points) setPickupRoadPaths((current) => ({
          ...current,
          [pickupRouteRequest.tripId]: {
            key: pickupRouteRequest.key,
            points,
            distanceKm: Number.isFinite(Number(result.distanceKm)) && Number(result.distanceKm) > 0 ? Number(result.distanceKm) : null,
            durationMin: Number.isFinite(Number(result.durationMin)) && Number(result.durationMin) > 0 ? Number(result.durationMin) : null,
          },
        }));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [pickupRouteRequest]);

  const locatedVehicles = useMemo(
    () => Array.from(new Map(deliveries
      .filter((delivery) => delivery.currentPos)
      .map((delivery) => [delivery.vehicleId, delivery])).values()),
    [deliveries]
  );

  const coloredPaths = useMemo(
    () => {
      const paths: Array<{ points: LatLng[]; color: string; label: string; dashArray?: string }> = [];

      const pickupPath = selectedDelivery && pickupRouteRequest
        ? pickupRoadPaths[selectedDelivery.id]
        : null;
      if (selectedDelivery && pickupRouteRequest) {
        const hasCurrentRoadPath = pickupPath?.key === pickupRouteRequest.key;
        paths.push({
          points: hasCurrentRoadPath ? pickupPath.points : pickupRouteRequest.waypoints,
          color: "#0284c7",
          label: hasCurrentRoadPath ? "Vehicle to pickup" : "Direct direction to pickup",
          ...(!hasCurrentRoadPath ? { dashArray: "7 7" } : {}),
        });
      }
      return paths;
    },
    [selectedDelivery, pickupRouteRequest, pickupRoadPaths]
  );

  const filteredDeliveries = useMemo(() => {
    const list = showOnlyTrackingVehicles
      ? deliveries.filter((delivery) => delivery.currentPos || delivery.id === selectedDeliveryId)
      : deliveries;

    return list;
  }, [deliveries, showOnlyTrackingVehicles, selectedDeliveryId]);

  const mapMarkers = useMemo<LeafletMarker[]>(
    () => {
      const markers: LeafletMarker[] = [];

      filteredDeliveries.forEach((delivery) => {
        // Skip if a different delivery is selected
        if (selectedDeliveryId && delivery.id !== selectedDeliveryId) {
          return;
        }

        const deliveryMarkers: LeafletMarker[] = [];
        if (selectedDeliveryId === delivery.id && delivery.originPos) deliveryMarkers.push({
          id: `${delivery.id}-pickup`,
          position: delivery.originPos,
          color: "#db2777",
          label: "Pickup",
          meta: { title: "Pickup origin", subtitle: delivery.origin },
        });
        if (delivery.currentPos) deliveryMarkers.push({
            id: delivery.id,
            position: delivery.currentPos,
            color: /delayed|critical/i.test(delivery.status) ? "#e11d48" : delivery.locationIsFresh ? "#be185d" : "#64748b",
            isVehicle: true,
            label: (
              <div className="space-y-1 text-sm leading-tight">
                <div className="font-semibold text-slate-900">{delivery.name}</div>
                <div className="text-slate-600">Driver: {delivery.driverName}</div>
                <div className="text-slate-600">Vehicle: {delivery.vehiclePlate}</div>
                {delivery.currentPos && <div className="text-slate-600">Position: {delivery.locationIsFresh ? "Live GPS" : "Last known position"}</div>}
                {delivery.etaMinutes != null && <div className="text-slate-600">ETA: {`${delivery.etaMinutes}m`}</div>}
                <div className="text-slate-600">{delivery.parcelSummary}</div>
              </div>
            ),
            radius: /delayed|critical/i.test(delivery.status) ? 10 : 7,
            meta: {
              title: delivery.driverName || "Mission",
              subtitle: delivery.vehiclePlate ? `${delivery.courier || "Courier"} • ${delivery.vehiclePlate}` : delivery.courier || "Courier",
              details: (
                <div className="space-y-1 text-slate-600 text-sm">
                  <div><span className="font-semibold text-slate-800">Courier:</span> {delivery.courier || "Unassigned"}</div>
                  <div><span className="font-semibold text-slate-800">Driver:</span> {delivery.driverName}</div>
                  {delivery.vehiclePlate && <div><span className="font-semibold text-slate-800">Vehicle:</span> {delivery.vehiclePlate}</div>}
                  {delivery.parcelCount > 0 && <div><span className="font-semibold text-slate-800">Parcel count:</span> {delivery.parcelCount}</div>}
                  {delivery.currentPos && <div><span className="font-semibold text-slate-800">Position:</span> {delivery.locationIsFresh ? "Live GPS" : "Last known position"}</div>}
                  {showCoordinates && <div><span className="font-semibold text-slate-800">Coordinates:</span> {delivery.currentPos.lat.toFixed(5)}, {delivery.currentPos.lng.toFixed(5)}</div>}
                  <div className="pt-1 border-t border-slate-200 mt-1">
                    <div className="font-semibold text-slate-800">Parcel details</div>
                    {delivery.parcelDetails.length > 0 ? (
                      <div className="space-y-1">
                        {delivery.parcelDetails.map((detail, idx) => (
                          <div key={idx} className="break-words text-[11px] leading-relaxed text-slate-700">
                            {detail}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">No parcel details available.</div>
                    )}
                  </div>
                </div>
              ),
            },
          });

        markers.push(...deliveryMarkers);
      });

      return markers;
    },
    [filteredDeliveries, showCoordinates, selectedDeliveryId]
  );

  const stats = [
    { icon: "directions_car", value: locatedVehicles.length, unit: "vehicles", label: "Located Vehicles" },
    { icon: "alt_route", value: activeTrips.length, unit: "active", label: "Active Trips" },
    { icon: "local_shipping", value: activeTrips.filter((trip) => isTripInTransitStatus(trip.status)).length, unit: "in transit", label: "In Transit" },
    { icon: "task_alt", value: uniqueTrips.filter((trip) => isCompletedTripStatus(trip.status)).length, unit: "completed", label: "Completed" },
  ];

  const vehicleCards = filteredDeliveries.map((delivery) => ({
    id: delivery.id,
    name: delivery.driverName,
    plate: delivery.vehiclePlate,
    status: delivery.status,
    eta: delivery.etaMinutes,
    locationRecordedAt: delivery.locationRecordedAt,
    locationIsFresh: delivery.locationIsFresh,
    lat: delivery.currentPos?.lat ?? null,
    lng: delivery.currentPos?.lng ?? null,
  }));
  const selectedPickupPath = selectedDelivery && pickupRouteRequest && pickupRoadPaths[selectedDelivery.id]?.key === pickupRouteRequest.key
    ? pickupRoadPaths[selectedDelivery.id]
    : null;
  const selectedPickupDistance = selectedPickupPath?.distanceKm
    ?? (selectedDelivery?.currentPos && selectedDelivery.originPos ? distanceKmBetween(selectedDelivery.currentPos, selectedDelivery.originPos) : null);
  const selectedPickupEta = now !== null && selectedPickupPath?.durationMin
    ? new Date(now + selectedPickupPath.durationMin * 60_000).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Fleet Map</h3>
            <p className="text-xs text-slate-500">Real-time vehicle tracking and locations</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={setIsFullscreen}
              className="relative z-[600] order-first sm:order-last rounded-lg bg-[#b80049] px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-[#9a003c]"
            >
              ⛶ Full screen
            </button>
          </div>
        </div>
      )}

      {selectedDelivery && <section aria-label="Selected mission summary" className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-pink-100 bg-white px-4 py-3 text-[10px] text-slate-600 shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2.5 py-1 font-bold text-pink-700"><Activity className="h-3 w-3" />{selectedDelivery.status}</span>
        <span className="inline-flex items-center gap-1.5"><UserRound className="h-3 w-3 text-pink-600" />{selectedDelivery.driverName}</span>
        {selectedDelivery.vehiclePlate && <span className="inline-flex items-center gap-1.5"><Truck className="h-3 w-3 text-pink-600" />{selectedDelivery.vehiclePlate}</span>}
        {(selectedDelivery.parcelCount > 0 || selectedDelivery.parcelReference || selectedDelivery.recipientName) && <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3 text-pink-600" />{selectedDelivery.parcelCount > 0 ? `${selectedDelivery.parcelCount} parcel${selectedDelivery.parcelCount === 1 ? "" : "s"}` : "Parcel"}{selectedDelivery.parcelReference && ` · ${selectedDelivery.parcelReference}`}{selectedDelivery.recipientName && ` · ${selectedDelivery.recipientName}`}</span>}
        {selectedDelivery.origin && selectedDelivery.origin !== "Unknown pickup" && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-pink-600" />{selectedDelivery.origin}</span>}
        {selectedPickupDistance != null && <span className="inline-flex items-center gap-1.5"><Route className="h-3 w-3 text-pink-600" />{selectedPickupPath?.distanceKm != null ? `${selectedPickupPath.distanceKm.toFixed(1)} km to pickup` : `Approx. ${selectedPickupDistance.toFixed(1)} km to pickup`}</span>}
        {selectedPickupEta && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3 w-3 text-pink-600" />Pickup ETA {selectedPickupEta}</span>}
        <button type="button" onClick={() => setMapFocusRequest((value) => value + 1)} disabled={!selectedDelivery.currentPos && !selectedDelivery.originPos} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 font-bold text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-45"><Crosshair className="h-3 w-3" />Focus route</button>
      </section>}

      <div
        style={isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}
        className={isFullscreen ? "relative h-screen w-screen overflow-hidden bg-slate-950" : "relative h-[520px] w-full overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-blue-50 to-blue-100 mb-4"}
      >
        <LeafletMap
          markers={mapMarkers}
          coloredPaths={showOnlyTrackingVehicles && !selectedDeliveryId ? [] : coloredPaths}
          focusKey={selectedDeliveryId ? `${selectedDeliveryId}:${selectedDelivery?.currentPos?.lat ?? ""},${selectedDelivery?.currentPos?.lng ?? ""}:${selectedDelivery?.originPos?.lat ?? ""},${selectedDelivery?.originPos?.lng ?? ""}:${mapFocusRequest}` : null}
          focusPoints={selectedDelivery ? [selectedDelivery.currentPos, selectedDelivery.originPos].filter((point): point is LatLng => Boolean(point)) : []}
          routeColor="#ec4899"
          className={isFullscreen ? "w-full h-full min-h-screen pointer-events-auto" : "h-full w-full rounded-xl overflow-hidden border border-pink-100 bg-gradient-to-br from-blue-50 to-blue-100"}
          onMarkerClick={(marker) => {
            const deliveryId = deliveries.find((delivery) =>
              marker.id === delivery.id || marker.id.startsWith(`${delivery.id}-`)
            )?.id;
            if (deliveryId) {
              selectDelivery(deliveryId);
            }
          }}
        />

        <div className="pointer-events-none absolute left-3 top-3 z-[10000] w-[260px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-3 shadow-xl shadow-pink-500/10">
          <div className="pointer-events-auto">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-pink-700">Tracking</div>
              <div className="flex items-center gap-2"><span className="text-[10px] font-medium text-slate-500">{filteredDeliveries.length} active</span><button type="button" onClick={focusRoute} disabled={!canFocusRoute} className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[9px] font-bold text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-40"><Crosshair className="h-3 w-3" />Focus route</button></div>
            </div>
            <div className="space-y-2">
              {vehicleCards.length > 0 ? vehicleCards.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => selectDelivery(vehicle.id)}
                  onDoubleClick={() => {
                    selectDelivery(vehicle.id);
                    setIsMissionModalOpen(true);
                  }}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    selectedDeliveryId === vehicle.id
                      ? "border-pink-400 bg-pink-100/40 shadow-md shadow-pink-200/50"
                      : "border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-slate-800">{vehicle.name}</div>
                      {vehicle.plate && <div className="truncate text-[10px] text-slate-500">{vehicle.plate}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedDeliveryId === vehicle.id && (
                        <span className="text-pink-600 text-xs">✓</span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${/delayed|critical/i.test(vehicle.status) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {vehicle.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    {vehicle.eta != null && <span>ETA {vehicle.eta}m</span>}
                    {vehicle.lat != null && vehicle.lng != null
                      ? showCoordinates && <span>{vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}</span>
                      : <span className="font-semibold text-amber-700">No Location Data</span>}
                  </div>
                  {vehicle.locationRecordedAt && (
                    <div className="mt-1 text-[9px] text-slate-400">{vehicle.locationIsFresh ? "GPS updated" : "Last known GPS"} {new Date(vehicle.locationRecordedAt).toLocaleString()}</div>
                  )}
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[10px] text-slate-500">
                  No tracking vehicles available.
                </div>
              )}
            </div>
          </div>
        </div>

        {isFullscreen && (
          <>
            <button
              type="button"
              onClick={() => {
                if (onToggleFullscreen) {
                  onToggleFullscreen();
                  return;
                }

                setInternalFullscreen(false);
              }}
              className="pointer-events-auto absolute top-4 right-4 z-[10000] rounded-lg bg-[#b80049] px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-[#9a003c]"
            >
              ✕ Exit full
            </button>

            <button
              type="button"
              onClick={() => setShowOnlyTrackingVehicles((value) => !value)}
              className="pointer-events-auto absolute top-4 right-32 z-[10000] rounded-lg px-3 py-2 text-xs font-bold text-white shadow-lg transition-colors"
              style={{
                backgroundColor: showOnlyTrackingVehicles ? "#10b981" : "#6b7280",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {showOnlyTrackingVehicles ? "📍 Tracking only" : "🚗 All stops"}
            </button>
          </>
        )}
      </div>

      {/* Stats Grid - Hidden during fullscreen */}
      {!isFullscreen && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-pink-100 bg-white/80 p-2.5 flex flex-col items-center justify-center text-center"
              >
                <span className="material-symbols-outlined text-[16px] text-[#b80049] mb-1">{stat.icon}</span>
                <div className="text-sm font-bold text-slate-900">
                  {stat.value}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-600 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            <span className="font-semibold text-slate-700">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#b80049" }} />
              <span>Located Vehicle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10b981" }} />
              <span>Trip Pickup (Active)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <span>Trip Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-slate-300" />
              <span>No Location Data</span>
            </div>
          </div>
        </>
      )}

      {/* Mission Info Panel */}
      {isMissionModalOpen && selectedDeliveryId && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[2147483645] bg-black/25"
          onClick={() => setIsMissionModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-details-title"
            onClick={(event) => event.stopPropagation()}
            style={{ transform: `translate(calc(-50% + ${modalOffset.x}px), ${modalOffset.y}px)` }}
            className="fixed left-1/2 top-20 z-[2147483646] flex max-h-[calc(100vh-6rem)] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/55 bg-white/45 shadow-2xl backdrop-blur-xl"
          >
            {/* Close Button */}
            <div
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                dragState.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  offsetX: modalOffset.x,
                  offsetY: modalOffset.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = dragState.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                setModalOffset({
                  x: drag.offsetX + event.clientX - drag.startX,
                  y: drag.offsetY + event.clientY - drag.startY,
                });
              }}
              onPointerUp={(event) => {
                if (dragState.current?.pointerId !== event.pointerId) return;
                dragState.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                dragState.current = null;
              }}
              className="sticky top-0 flex cursor-grab touch-none items-center justify-between border-b border-white/55 bg-white/55 p-4 active:cursor-grabbing backdrop-blur-xl"
            >
              <h2 id="mission-details-title" className="text-lg font-bold text-slate-900">Mission Details</h2>
              <button
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setIsMissionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Panel Content */}
            <div
              className="hide-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
            >
              {deliveries
                .filter((d) => d.id === selectedDeliveryId)
                .map((delivery) => (
                  <div key={delivery.id} className="space-y-4">
                    {/* Header */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{delivery.driverName}</h3>
                      <p className="text-sm text-slate-500">
                        {delivery.origin} – {delivery.destination}
                      </p>
                    </div>

                    {/* Delivery Details */}
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <h4 className="text-sm font-semibold text-slate-800">Delivery Details</h4>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div>
                          <span className="font-semibold text-slate-800">Courier:</span>{" "}
                          {delivery.courier || "Unassigned"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">Driver:</span>{" "}
                          {delivery.driverName}
                        </div>
                        {delivery.vehiclePlate && <div>
                          <span className="font-semibold text-slate-800">Vehicle:</span>{" "}
                          {delivery.vehiclePlate}
                        </div>}
                        <div>
                          <span className="font-semibold text-slate-800">Parcel Count:</span>{" "}
                          {delivery.parcelCount}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">Status:</span>{" "}
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              /delayed|critical/i.test(delivery.status)
                                ? "bg-red-100 text-red-700"
                                : /approach/i.test(delivery.status)
                                ? "bg-yellow-100 text-yellow-700"
                                : /in transit/i.test(delivery.status)
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {delivery.status}
                          </span>
                        </div>
                        {delivery.etaMinutes != null && <div><span className="font-semibold text-slate-800">ETA:</span>{" "}{delivery.etaMinutes > 60 ? `${Math.floor(delivery.etaMinutes / 60)}h ${delivery.etaMinutes % 60}m` : `${delivery.etaMinutes}m`}</div>}
                        {delivery.currentPos && <div><span className="font-semibold text-slate-800">Vehicle location:</span>{" "}{delivery.locationIsFresh ? "Live GPS" : "Last known position"}{showCoordinates ? ` · ${delivery.currentPos.lat.toFixed(5)}, ${delivery.currentPos.lng.toFixed(5)}` : ""}</div>}
                        {delivery.locationRecordedAt && <div><span className="font-semibold text-slate-800">GPS recorded:</span>{" "}{new Date(delivery.locationRecordedAt).toLocaleString()}</div>}
                        {delivery.originPos && <div><span className="font-semibold text-slate-800">Pickup coordinates:</span>{" "}{delivery.originPos.lat.toFixed(5)}, {delivery.originPos.lng.toFixed(5)}</div>}
                        {delivery.currentPos && delivery.originPos && <div><span className="font-semibold text-slate-800">Direction to pickup:</span>{" "}{pickupRouteRequest?.tripId === delivery.id && pickupRoadPaths[delivery.id]?.key === pickupRouteRequest.key ? "Road route" : "Direct fallback while routing"}</div>}
                      </div>
                    </div>

                    {/* Parcel Details */}
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <h4 className="text-sm font-semibold text-slate-800">Parcel Details</h4>
                      {delivery.parcelDetails.length > 0 ? (
                        <div className="space-y-2">
                          {delivery.parcelDetails.map((detail, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 rounded p-2 text-xs text-slate-700 border border-slate-200"
                            >
                              {detail}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No parcel details available.</p>
                      )}
                    </div>

                  </div>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
