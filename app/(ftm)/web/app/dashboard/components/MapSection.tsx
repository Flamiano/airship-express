"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DashboardTrip, DashboardVehicle, DashboardBooking } from "../page";
import type { LeafletMarker } from "../../components/LeafletMap";
import { useParcelStore } from "../../lib/parcelStore";
import { getRoutePlan } from "../../lib/api";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <div className="text-xs text-slate-500 font-medium">Loading map…</div>
    </div>
  ),
});

// Default hub location (Manila)
const HUB_POS = { lat: 14.5995, lng: 120.9842 };

// Service city coordinates for fallback destination mapping
const SERVICE_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Caloocan": { lat: 14.6579, lng: 120.9830 },
  "Quezon City": { lat: 14.6760, lng: 121.0437 },
  "Manila": { lat: 14.5995, lng: 120.9842 },
  "Makati": { lat: 14.5547, lng: 121.0244 },
  "Pasig": { lat: 14.5764, lng: 121.0851 },
  "Mandaluyong": { lat: 14.5794, lng: 121.0359 },
  "San Juan": { lat: 14.6019, lng: 121.0355 },
  "Marikina": { lat: 14.6507, lng: 121.1029 },
  "Pasay": { lat: 14.5378, lng: 120.9927 },
  "Taguig": { lat: 14.5176, lng: 121.0509 },
  "Parañaque": { lat: 14.4793, lng: 121.0198 },
  "Valenzuela": { lat: 14.7000, lng: 120.9830 },
};

function resolveDestination(route: string, coordinates?: { lat: number; lng: number } | null): { lat: number; lng: number } {
  if (coordinates && (coordinates.lat !== 0 || coordinates.lng !== 0)) return coordinates;
  const city = Object.keys(SERVICE_CITY_COORDINATES).find((name) => route.toLowerCase().includes(name.toLowerCase()));
  return city ? SERVICE_CITY_COORDINATES[city] : HUB_POS;
}

type LatLng = { lat: number; lng: number };

type Delivery = {
  id: string;
  name: string;
  driverName: string;
  vehiclePlate: string;
  parcelSummary: string;
  parcelCount: number;
  parcelDetails: string[];
  origin: string;
  destination: string;
  originPos: LatLng;
  destPos: LatLng;
  currentPos: LatLng;
  progress: number;
  etaMinutes: number;
  status: "critical" | "in-transit" | "approaching" | "completed";
  bookingId: string;
  courier?: string;
  stops?: { name: string; lat: number; lng: number; status?: string }[];
};

async function fetchOsrmRoutePath(waypoints: Array<{ lat: number; lng: number }>) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  try {
    const coords = waypoints.map((point) => `${point.lng},${point.lat}`).join(";");
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, {
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!response || !response.ok) return null;
    const data = await response.json();
    const geometry = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(geometry) || geometry.length < 2) return null;
    return geometry.map(([lng, lat]: [number, number]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

async function fetchOsrmMetrics(waypoints: LatLng[]): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  
  try {
    const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!response || !response.ok) return null;
    
    const data = await response.json();
    if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) return null;
    
    const route = data.routes[0];
    const distanceKm = Number(((route.distance || 0) / 1000).toFixed(2));
    const durationMin = Math.ceil((route.duration || 0) / 60);
    
    return { distanceKm, durationMin };
  } catch (error) {
    console.warn("[MapSection] OSRM route request failed:", error);
    return null;
  }
}

const isActiveTripStatus = (status?: string | null) => {
  const value = (status || "").toLowerCase();
  return Boolean(value) && !/completed|cancelled|delivered|failed|closed/i.test(value)
    && /transit|assigned|dispatch|scheduled|active|moving|in_transit|in transit|en route|route|delayed|late|critical/i.test(value);
};

const MAX_MAP_DELIVERIES = 6;

export default function MapSection({ 
  trips, 
  vehicles, 
  bookings = [],
  parcels = [],
  drivers = [],
  isFullscreen: externalFullscreen,
  onToggleFullscreen,
}: { 
  trips: DashboardTrip[]; 
  vehicles: DashboardVehicle[]; 
  bookings?: DashboardBooking[];
  parcels?: any[];
  drivers?: any[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const { bookings: storeBookings = [], parcels: storeParcels = [], drivers: storeDrivers = [] } = useParcelStore();
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [routePlans, setRoutePlans] = useState<Record<string, any>>({});
  const [roadPaths, setRoadPaths] = useState<Record<string, LatLng[]>>({});
  const [osrmMetrics, setOsrmMetrics] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});
  const [timeUpdate, setTimeUpdate] = useState(0);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showOnlyTrackingVehicles, setShowOnlyTrackingVehicles] = useState(false);

  const isFullscreen = externalFullscreen ?? internalFullscreen;
  const setIsFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }

    setInternalFullscreen((value) => !value);
  };

  // Fetch route plans (like mission page does)
  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...trips.map((trip) => (trip as any)?.routePlanId || (trip as any)?.route_plan_id).filter(Boolean),
        ...bookings.filter((booking) => (booking as any).routePlanId).map((booking) => (booking as any).routePlanId),
        ...parcels.filter((parcel) => parcel.routePlanId).map((parcel) => parcel.routePlanId),
      ])
    ) as string[];

    if (ids.length === 0) {
      setRoutePlans({});
      return;
    }

    const limitedIds = ids.slice(0, 6);
    let cancelled = false;
    Promise.all(
      limitedIds.map(async (id) => {
        try {
          const plan = await getRoutePlan(id);
          return [id, plan] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const nextRoutePlans = Object.fromEntries(results.filter(Boolean) as [string, any][]);
      setRoutePlans(nextRoutePlans);
    });

    return () => {
      cancelled = true;
    };
  }, [bookings, parcels, trips]);

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
  }, [isFullscreen]);

  const locatedVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.locationLat != null && vehicle.locationLng != null),
    [vehicles]
  );

  const activeTrips = useMemo(
    () => trips.filter((trip) => isActiveTripStatus(trip.status) || (!trip.status && trip.id)),
    [trips]
  );

  const visibleTrips = useMemo(
    () => activeTrips.slice(0, MAX_MAP_DELIVERIES),
    [activeTrips]
  );

  // Helper to calculate ETA and progress (like mission page)
  const calculateEtaAndProgress = (trip: DashboardTrip, osrmMetric?: { distanceKm: number; durationMin: number } | null) => {
    const AVERAGE_SPEED_KMH = 30;
    
    // Priority 1: Use OSRM real road distance + average speed calculation
    if (osrmMetric && osrmMetric.distanceKm > 0) {
      const etaMinutes = osrmMetric.durationMin || Math.ceil((osrmMetric.distanceKm / AVERAGE_SPEED_KMH) * 60);
      
      return {
        etaMinutes: Math.ceil(etaMinutes),
        progress: Number(trip?.progress || 0),
      };
    }
    
    // Fallback: use default duration
    return {
      etaMinutes: 35,
      progress: Number(trip?.progress || 0),
    };
  };

  const normalizeTripStatus = (value?: string | null) => {
    const status = String(value || "").trim().toLowerCase();
    if (!status) return "in-transit" as const;
    if (/critical|rush|urgent|late|delayed/.test(status)) return "critical" as const;
    if (/completed|delivered|finished/.test(status)) return "completed" as const;
    if (/approach|near|arriving/.test(status)) return "approaching" as const;
    return "in-transit" as const;
  };

  const resolveDriverName = (driverId?: string | null, fallbackName?: string | null) => {
    if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
    if (!driverId) return "Assigned driver";
    const driver = drivers.find((item) => String(item.id) === String(driverId));
    return driver?.name || driver?.full_name || `Driver ${String(driverId)}`;
  };

  type MapStop = {
    id?: string | null;
    name?: string | null;
    label?: string | null;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
  };

  const normalizeStop = (trip: DashboardTrip, stop: MapStop, index: number) => {
    const lat = Number(stop?.lat ?? stop?.latitude ?? 0);
    const lng = Number(stop?.lng ?? stop?.longitude ?? 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return null;
    }

    return {
      id: stop?.id || `${trip.id || 'trip'}-stop-${index}`,
      name: stop?.name || stop?.label || `Stop ${index + 1}`,
      lat,
      lng,
      status: stop?.status || 'pending',
    };
  };

  const resolveTripStops = (trip: DashboardTrip, booking?: DashboardBooking, routePlan?: any) => {
    const explicitStops: MapStop[] = Array.isArray(trip.stops) ? trip.stops as MapStop[] : [];
    const routePlanStops: MapStop[] = Array.isArray(trip.routePlanStops)
      ? trip.routePlanStops as MapStop[]
      : Array.isArray(routePlan?.deliveryDestinations)
        ? routePlan.deliveryDestinations
        : [];
    const bookingStops: MapStop[] = Array.isArray((booking as any)?.deliveryDestinations)
      ? (booking as any).deliveryDestinations
      : [];
    const sourceStops = explicitStops.length > 0 ? explicitStops : routePlanStops.length > 0 ? routePlanStops : bookingStops;

    return sourceStops
      .map((stop, index) => normalizeStop(trip, stop, index))
      .filter((stop): stop is { id: string; name: string; lat: number; lng: number; status: string } => Boolean(stop));
  };

  const getTripWaypoints = (trip: DashboardTrip) => {
    const start = trip.fromCoords || { lat: HUB_POS.lat, lng: HUB_POS.lng };
    const end = trip.toCoords || { lat: HUB_POS.lat, lng: HUB_POS.lng };
    const stopPoints = resolveTripStops(trip).map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    const points = [start, ...stopPoints, end];

    const deduped: Array<{ lat: number; lng: number }> = [];
    for (const point of points) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
      const isDuplicate = deduped.some((existing) => Math.abs(existing.lat - point.lat) < 0.000001 && Math.abs(existing.lng - point.lng) < 0.000001);
      if (!isDuplicate) deduped.push(point);
    }

    return deduped.length >= 2 ? deduped : [start, end];
  };

  // Build delivery objects from trips (like mission page does)
  const deliveries = useMemo(() => {
    return visibleTrips.map((trip) => {
      const bookingId = (trip as any)?.bookingId || (trip as any)?.booking_id || "";
      const driverId = (trip as any)?.driverId || (trip as any)?.driver_id || "";
      const driverName = (trip as any)?.driverName || "";
      
      const booking = bookingId ? bookings.find((item) => item.id === bookingId) : undefined;
      const tripParcels = bookingId ? parcels.filter((p) => p.bookingId === bookingId) : [];
      const routePlanId = (booking as any)?.routePlanId || tripParcels.find((p: any) => p.routePlanId)?.routePlanId || (trip as any)?.routePlanId || (trip as any)?.route_plan_id;
      const routePlan = routePlanId ? routePlans[routePlanId] : null;
      
      const stops = resolveTripStops(trip, booking, routePlan)
        .map((s) => ({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          status: s.status || "pending",
        }));
      
      const destinationStop = stops[stops.length - 1];
      const destination = destinationStop?.name || trip.toLocation || trip.destination_location || (trip as any)?.to || "Destination";
      const originPos = trip.fromCoords || { lat: HUB_POS.lat, lng: HUB_POS.lng };
      const destPos = destinationStop
        ? { lat: destinationStop.lat, lng: destinationStop.lng }
        : (trip.toCoords || { lat: HUB_POS.lat, lng: HUB_POS.lng });
      
      const { etaMinutes, progress } = calculateEtaAndProgress(trip, osrmMetrics[trip.id || ""]);
      
      const courierFromParcels = tripParcels.find((p) => p.courier)?.courier;
      const courierFromRoutePlan = routePlan?.courier;
      const courier = courierFromParcels || courierFromRoutePlan || `Route-${(bookingId)?.substring(0, 6) || 'unknown'}`;
      const resolvedDriverName = resolveDriverName(driverId, driverName);
      const parcelDetails = tripParcels.slice(0, 4).map((parcel) => {
        const recipient = parcel.recipientName || parcel.recipient_name || "Recipient";
        const type = parcel.parcelType || parcel.type || "Parcel";
        const address = parcel.destinationAddress || parcel.address || parcel.dropoffAddress || "Address pending";
        return `${recipient} • ${type} • ${address}`;
      }).filter(Boolean);

      return {
        id: trip.id || "",
        name: resolvedDriverName,
        driverName: resolvedDriverName,
        vehiclePlate: trip.vehicleId || "Assigned vehicle",
        parcelSummary: `${tripParcels.length} parcels — ${destination}${stops.length > 1 ? ` • ${stops.length} stops` : ""}`,
        parcelCount: tripParcels.length || 0,
        parcelDetails,
        origin: trip.fromLocation || trip.pickup_location || "Airship Express Hub – Binondo, Manila",
        destination,
        originPos,
        destPos,
        currentPos: trip.fromCoords || originPos,
        progress,
        etaMinutes,
        status: normalizeTripStatus(trip.status),
        bookingId,
        courier,
        stops,
      } as Delivery;
    });
  }, [visibleTrips, bookings, parcels, osrmMetrics, drivers, routePlans]);

  // Courier colors for visual distinction on map
  const courierColors = useMemo(() => {
    const colors = new Map<string, string>();
    const colorPalette = [
      "#3b82f6", // Blue
      "#ef4444", // Red
      "#f59e0b", // Amber
      "#10b981", // Emerald
      "#8b5cf6", // Violet
      "#ec4899", // Pink
      "#06b6d4", // Cyan
      "#84cc16", // Lime
    ];
    const uniqueCouriers = Array.from(new Set(deliveries.map((d) => d.courier || "LBC")));
    uniqueCouriers.forEach((courier, idx) => {
      colors.set(courier, colorPalette[idx % colorPalette.length]);
    });
    return colors;
  }, [deliveries]);

  // Parallel OSRM route path fetching (matching mission page logic)
  useEffect(() => {
    let cancelled = false;
    const visibleDeliveries = deliveries.slice(0, 6);
    const tasks: Promise<[string, LatLng[]] | null>[] = [];

    visibleDeliveries.forEach((delivery) => {
      const waypoints = delivery.stops && delivery.stops.length > 0
        ? [delivery.originPos, ...delivery.stops.map((s) => ({ lat: s.lat, lng: s.lng }))]
        : [delivery.originPos, delivery.destPos];

      tasks.push((async () => {
        const path = await fetchOsrmRoutePath(waypoints);
        if (!path || cancelled) return null;
        return [delivery.id, path] as const;
      })());
    });

    Promise.all(tasks).then((results) => {
      if (cancelled) return;
      const next = Object.fromEntries(results.filter(Boolean) as [string, LatLng[]][]);
      setRoadPaths(next);
    });

    const metricsPromises = visibleDeliveries.map(async (delivery) => {
      const waypoints = delivery.stops && delivery.stops.length > 0
        ? [delivery.originPos, ...delivery.stops.map((s) => ({ lat: s.lat, lng: s.lng })), delivery.destPos]
        : [delivery.originPos, delivery.destPos];

      const metrics = await fetchOsrmMetrics(waypoints);
      if (!metrics) return null;
      return [delivery.id, metrics] as const;
    });

    Promise.all(metricsPromises).then((results) => {
      if (cancelled) return;
      setOsrmMetrics(Object.fromEntries(results.filter(Boolean) as [string, { distanceKm: number; durationMin: number }][]));
    });

    return () => { cancelled = true; };
  }, [deliveries]);

  const coloredPaths = useMemo(
    () => {
      const filtered = selectedDeliveryId
        ? deliveries.filter((d) => d.id === selectedDeliveryId)
        : deliveries;

      return filtered
        .map((delivery) => {
          const color = courierColors.get(delivery.courier || "LBC") || "#3b82f6";
          const roadPath = roadPaths[delivery.id];
          
          if (roadPath && roadPath.length > 1) {
            return {
              points: roadPath,
              color,
              label: delivery.courier || "LBC",
            };
          }

          return null;
        })
        .filter(Boolean) as Array<{ points: LatLng[]; color: string; label: string }>;
    },
    [deliveries, roadPaths, courierColors, selectedDeliveryId]
  );

  const filteredDeliveries = useMemo(() => {
    const list = showOnlyTrackingVehicles
      ? deliveries.filter((delivery) => {
          const lat = Number(delivery.currentPos?.lat ?? 0);
          const lng = Number(delivery.currentPos?.lng ?? 0);
          return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        })
      : deliveries;

    return list.slice(0, MAX_MAP_DELIVERIES);
  }, [deliveries, showOnlyTrackingVehicles]);

  const mapMarkers = useMemo<LeafletMarker[]>(
    () => {
      const markers: LeafletMarker[] = [];

      if (!showOnlyTrackingVehicles) {
        markers.push({
          id: "airship-hub",
          position: HUB_POS,
          color: "#db2777",
          radius: 10,
          isHub: true,
          label: (
            <div className="space-y-1 text-sm leading-tight">
              <div className="font-semibold text-pink-950">Airship Express</div>
              <div className="text-[13px] text-pink-700/80">Courier service · 352 Escolta St</div>
              <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-pink-600">
                <span className="inline-flex items-center gap-1 text-amber-400">★ ★ ★ ★ ★</span>
                Open · Closes 5 PM
              </div>
            </div>
          ),
          meta: {
            title: "Airship Express",
            subtitle: "Courier service · 352 Escolta St",
            details: <div className="text-sm text-pink-800/80">Open · Closes 5 PM</div>,
          },
        });
      }

      filteredDeliveries.forEach((delivery) => {
        // Skip if a different delivery is selected
        if (selectedDeliveryId && delivery.id !== selectedDeliveryId) {
          return;
        }

        const deliveryMarkers: LeafletMarker[] = [
          {
            id: delivery.id,
            position: delivery.currentPos,
            color: delivery.status === "critical" ? "#e11d48" : "#be185d",
            label: (
              <div className="space-y-1 text-sm leading-tight">
                <div className="font-semibold text-slate-900">{delivery.name}</div>
                <div className="text-slate-600">Driver: {delivery.driverName}</div>
                <div className="text-slate-600">Vehicle: {delivery.vehiclePlate}</div>
                <div className="text-slate-600">ETA: {Math.ceil(delivery.etaMinutes)}m</div>
                <div className="text-slate-600">{delivery.parcelSummary}</div>
              </div>
            ),
            radius: delivery.status === "critical" ? 10 : 7,
            meta: {
              title: delivery.driverName || "Mission",
              subtitle: `${delivery.courier || "Courier"} • ${delivery.vehiclePlate}`,
              details: (
                <div className="space-y-1 text-slate-600 text-sm">
                  <div><span className="font-semibold text-slate-800">Courier:</span> {delivery.courier || "Unassigned"}</div>
                  <div><span className="font-semibold text-slate-800">Driver:</span> {delivery.driverName}</div>
                  <div><span className="font-semibold text-slate-800">Parcel count:</span> {delivery.parcelCount}</div>
                  {showCoordinates && (
                    <div><span className="font-semibold text-slate-800">Coordinates:</span> {delivery.currentPos.lat.toFixed(5)}, {delivery.currentPos.lng.toFixed(5)}</div>
                  )}
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
          },
        ];

        // Show stops when selected or in normal non-tracking view
        if ((selectedDeliveryId === delivery.id || !showOnlyTrackingVehicles) && delivery.stops && delivery.stops.length > 0) {
          delivery.stops.forEach((stop, index) => {
            deliveryMarkers.push({
              id: `${delivery.id}-stop-${index}`,
              position: { lat: stop.lat, lng: stop.lng },
              color: "#8b5cf6",
              label: `Stop ${index + 1}: ${stop.name}`,
              radius: 5,
              meta: {
                title: `Stop ${index + 1}`,
                subtitle: stop.name,
                details: <div className="text-sm text-slate-600">Delivery stop</div>,
              },
            });
          });
        }

        // Show destination when selected or in normal non-tracking view
        if (selectedDeliveryId === delivery.id || !showOnlyTrackingVehicles) {
          deliveryMarkers.push({
            id: `${delivery.id}-dest`,
            position: delivery.destPos,
            color: "#f43f5e",
            label: (
              <div className="space-y-1 text-sm leading-tight">
                <div className="font-semibold text-slate-900">Destination</div>
                <div className="text-slate-600">{delivery.destination}</div>
                <div className="text-slate-600">Route end point</div>
              </div>
            ),
            radius: 6,
            meta: {
              title: "Destination",
              subtitle: delivery.destination,
              details: <div className="text-sm text-slate-600">Route end point</div>,
            },
          });
        }

        markers.push(...deliveryMarkers);
      });

      return markers;
    },
    [filteredDeliveries, showOnlyTrackingVehicles, showCoordinates, selectedDeliveryId]
  );

  const stats = [
    { icon: "directions_car", value: locatedVehicles.length, unit: "vehicles", label: "Located Vehicles" },
    { icon: "alt_route", value: activeTrips.length, unit: "active", label: "Active Trips" },
    { icon: "local_shipping", value: activeTrips.filter(t => /transit|active|in_transit|dispatch|moving|route/i.test(t.status || "")).length, unit: "in transit", label: "In Transit" },
    { icon: "task_alt", value: trips.filter(t => /completed|delivered/i.test(t.status || "")).length, unit: "completed", label: "Completed" },
  ];

  const vehicleCards = filteredDeliveries.slice(0, MAX_MAP_DELIVERIES).map((delivery) => ({
    id: delivery.id,
    name: delivery.driverName,
    plate: delivery.vehiclePlate,
    status: delivery.status,
    eta: Math.ceil(delivery.etaMinutes),
    lat: delivery.currentPos.lat,
    lng: delivery.currentPos.lng,
  }));

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

      {/* Map Container */}
      <div
        style={isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : undefined}
        className={isFullscreen ? "relative h-screen w-screen overflow-hidden bg-slate-950" : "relative h-[520px] w-full overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-blue-50 to-blue-100 mb-4"}
      >
        {/* Map Background */}
        <LeafletMap
          center={HUB_POS}
          zoom={12}
          markers={mapMarkers}
          coloredPaths={showOnlyTrackingVehicles && !selectedDeliveryId ? [] : coloredPaths}
          routeColor="#ec4899"
          className={isFullscreen ? "w-full h-full min-h-screen pointer-events-auto" : "h-full w-full rounded-xl overflow-hidden border border-pink-100 bg-gradient-to-br from-blue-50 to-blue-100"}
          onMarkerClick={(marker) => {
            const deliveryId = marker.id.split('-')[0];
            if (deliveryId !== "airship" && deliveryId !== "vehicle") {
              setSelectedDeliveryId(deliveryId);
            }
          }}
        />

        {/* Floating Overlays */}
        <div className="pointer-events-none absolute left-3 top-3 z-[10000] w-[260px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-pink-100 bg-white/90 backdrop-blur-md p-3 shadow-xl shadow-pink-500/10">
          <div className="pointer-events-auto">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-pink-700">Tracking</div>
              <span className="text-[10px] font-medium text-slate-500">{filteredDeliveries.length} active</span>
            </div>
            <div className="space-y-2">
              {vehicleCards.length > 0 ? vehicleCards.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedDeliveryId(selectedDeliveryId === vehicle.id ? null : vehicle.id)}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    selectedDeliveryId === vehicle.id
                      ? "border-pink-400 bg-pink-100/40 shadow-md shadow-pink-200/50"
                      : "border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-slate-800">{vehicle.name}</div>
                      <div className="truncate text-[10px] text-slate-500">{vehicle.plate}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedDeliveryId === vehicle.id && (
                        <span className="text-pink-600 text-xs">✓</span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${vehicle.status === "critical" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {vehicle.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>ETA {vehicle.eta}m</span>
                    {showCoordinates && (
                      <span>{vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}</span>
                    )}
                  </div>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[10px] text-slate-500">
                  No tracking vehicles available.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen Exit Button - Top Right */}
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

            {/* Tracking Only Toggle - Floating Button */}
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
      {selectedDeliveryId && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Mission Details</h2>
              <button
                onClick={() => setSelectedDeliveryId(null)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Panel Content */}
            <div className="p-4 space-y-4">
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
                        <div>
                          <span className="font-semibold text-slate-800">Vehicle:</span>{" "}
                          {delivery.vehiclePlate}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">Parcel Count:</span>{" "}
                          {delivery.parcelCount}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">Status:</span>{" "}
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              delivery.status === "critical"
                                ? "bg-red-100 text-red-700"
                                : delivery.status === "approaching"
                                ? "bg-yellow-100 text-yellow-700"
                                : delivery.status === "in-transit"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {delivery.progress}% Complete
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">ETA:</span>{" "}
                          {delivery.etaMinutes > 60
                            ? `${Math.floor(delivery.etaMinutes / 60)}h ${delivery.etaMinutes % 60}m`
                            : `${delivery.etaMinutes}m`}
                        </div>
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

                    {/* Route Info */}
                    {delivery.stops && delivery.stops.length > 0 && (
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <h4 className="text-sm font-semibold text-slate-800">Route ({delivery.stops.length + 1} stops)</h4>
                        <div className="space-y-2 text-xs text-slate-600">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 font-bold mt-0.5">◆</span>
                            <div>
                              <p className="font-semibold text-slate-800">Origin</p>
                              <p>{delivery.origin}</p>
                            </div>
                          </div>
                          {delivery.stops.map((stop, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-purple-600 font-bold mt-0.5">◆</span>
                              <div>
                                <p className="font-semibold text-slate-800">Stop {idx + 1}</p>
                                <p>{stop.name}</p>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 font-bold mt-0.5">◆</span>
                            <div>
                              <p className="font-semibold text-slate-800">Destination</p>
                              <p>{delivery.destination}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
