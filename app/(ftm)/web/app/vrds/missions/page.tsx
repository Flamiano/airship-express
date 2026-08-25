"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParcelStore } from "../../lib/parcelStore";
import { getRoutePlan, getTrips } from "../../lib/api";
import { HUB_POS } from "../../lib/parcelTypes";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import type { LeafletMarker } from "../../components/LeafletMap";

// Average speed for ETA calculation (km/h)
const AVERAGE_SPEED_KMH = 30;

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

const SERVICE_CITY_COORDINATES: Record<string, LatLng> = {
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

function resolveDestination(route: string, coordinates?: LatLng | null): LatLng {
  if (coordinates && (coordinates.lat !== 0 || coordinates.lng !== 0)) return coordinates;
  const city = Object.keys(SERVICE_CITY_COORDINATES).find((name) => route.toLowerCase().includes(name.toLowerCase()));
  return city ? SERVICE_CITY_COORDINATES[city] : HUB_POS;
}

/**
 * Fetches real road distance and duration from OSRM (Open Source Routing Machine).
 * Uses the /route endpoint to get actual driving metrics instead of straight-line distance.
 * Falls back gracefully if OSRM is unavailable.
 */
async function fetchOsrmRouteMetrics(waypoints: LatLng[]): Promise<{ distanceKm: number; durationMin: number } | null> {
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
    console.warn("[missions] OSRM route request failed:", error);
    return null;
  }
}

export default function VrdsMissionsPage() {
  const [view, setView] = useState<"list" | "map">("list");
  const [activeMarker, setActiveMarker] = useState<LeafletMarker | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [showRouteLines, setShowRouteLines] = useState(true);
  const [timeUpdate, setTimeUpdate] = useState(0); // Incremented every minute to trigger ETA recalculation
  const { bookings, parcels, drivers, vehicles } = useParcelStore();
  const [trips, setTrips] = useState<any[]>([]);
  const [routePlans, setRoutePlans] = useState<Record<string, any>>({});
  const [roadPaths, setRoadPaths] = useState<Record<string, LatLng[]>>({});
  const [osrmMetrics, setOsrmMetrics] = useState<Record<string, { distanceKm: number; durationMin: number }>>({});

  useEffect(() => {
    getTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

  useEffect(() => {
    const ids = Array.from(
      new Set([
        ...trips.map((trip) => trip.routePlanId || trip.route_plan_id).filter(Boolean),
        ...bookings.filter((booking) => booking.routePlanId).map((booking) => booking.routePlanId),
        ...parcels.filter((parcel) => parcel.routePlanId).map((parcel) => parcel.routePlanId),
      ])
    ) as string[];

    if (ids.length === 0) {
      setRoutePlans({});
      return;
    }

    let cancelled = false;
    Promise.all(
      ids.map(async (id) => {
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

  const normalizeTripStatus = (value?: string | null) => {
    const status = String(value || "").trim().toLowerCase();
    if (!status) return "in-transit" as const;
    if (/critical|rush|urgent|late|delayed/.test(status)) return "critical" as const;
    if (/completed|delivered|finished/.test(status)) return "completed" as const;
    if (/approach|near|arriving/.test(status)) return "approaching" as const;
    return "in-transit" as const;
  };

  const calculateEtaAndProgress = (trip: any, booking?: any, osrmMetrics?: { distanceKm: number; durationMin: number } | null) => {
    const now = new Date().getTime();
    
    // Priority 1: Use OSRM real road distance + average speed calculation
    if (osrmMetrics && osrmMetrics.distanceKm > 0) {
      const etaMinutes = osrmMetrics.durationMin || Math.ceil((osrmMetrics.distanceKm / AVERAGE_SPEED_KMH) * 60);
      
      // For progress calculation, prefer estimated times if available
      const estimatedDeparture = trip?.estimatedDeparture || trip?.estimated_departure;
      const estimatedArrival = trip?.estimatedArrival || trip?.estimated_arrival;
      
      if (estimatedDeparture && estimatedArrival) {
        const departureTime = new Date(estimatedDeparture).getTime();
        const arrivalTime = new Date(estimatedArrival).getTime();
        
        if (Number.isFinite(departureTime) && Number.isFinite(arrivalTime) && arrivalTime > departureTime) {
          const totalDuration = (arrivalTime - departureTime) / 60000;
          const elapsedTime = Math.max(0, (now - departureTime) / 60000);
          const progress = Math.min(100, Math.max(0, (elapsedTime / totalDuration) * 100));
          
          return {
            etaMinutes: Math.ceil(etaMinutes),
            progress: Math.round(progress),
            distanceKm: osrmMetrics.distanceKm,
          };
        }
      }
      
      // Fallback: assume trip just started if no times available
      return {
        etaMinutes: Math.ceil(etaMinutes),
        progress: Number(trip?.progress || 0),
        distanceKm: osrmMetrics.distanceKm,
      };
    }
    
    // Priority 2: Use estimated departure/arrival times from database
    const estimatedDeparture = trip?.estimatedDeparture || trip?.estimated_departure;
    const estimatedArrival = trip?.estimatedArrival || trip?.estimated_arrival;

    if (estimatedDeparture && estimatedArrival) {
      const departureTime = new Date(estimatedDeparture).getTime();
      const arrivalTime = new Date(estimatedArrival).getTime();

      if (Number.isFinite(departureTime) && Number.isFinite(arrivalTime) && arrivalTime > departureTime) {
        const totalDuration = (arrivalTime - departureTime) / 60000;
        const elapsedTime = Math.max(0, (now - departureTime) / 60000);
        const remainingTime = Math.max(0, totalDuration - elapsedTime);
        const progress = Math.min(100, Math.max(0, (elapsedTime / totalDuration) * 100));

        return {
          etaMinutes: Math.ceil(remainingTime),
          progress: Math.round(progress),
        };
      }
    }

    // Fallback: use provided duration or defaults
    const durationMinutes = Number(trip?.durationMinutes ?? trip?.duration_minutes);
    return {
      etaMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0,
      progress: Number(trip?.progress || 0),
    };
  };

  const resolveDriverName = (driverId?: string | null, fallbackName?: string | null) => {
    if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
    if (!driverId) return "Assigned driver";
    const driver = drivers.find((item) => String(item.id) === String(driverId));
    return driver?.name || `Driver ${String(driverId)}`;
  };

  const resolveDriverPhone = (driverId?: string | null) => {
    if (!driverId) return null;
    const driver = drivers.find((item) => String(item.id) === String(driverId)) as any;
    return driver?.phone || driver?.phoneNumber || null;
  };

  const DELIVERIES: Delivery[] = useMemo(() => {
    const persistedDeliveries = trips.filter((trip) => {
      const booking = bookings.find((item) => item.id === trip.bookingId || item.id === trip.booking_id);
      const driverId = trip.driverId || trip.driver_id || booking?.driverId;
      const vehicleId = trip.vehicleId || trip.vehicle_id || booking?.vehicleId;
      return Boolean(driverId && vehicleId);
    }).map((trip) => {
      const booking = bookings.find((item) => item.id === trip.bookingId || item.id === trip.booking_id);
      const bookingParcels = parcels.filter((p) => p.bookingId === trip.bookingId || p.bookingId === trip.booking_id);
      const routePlanId = booking?.routePlanId || bookingParcels.find((parcel: any) => parcel.routePlanId)?.routePlanId || trip.routePlanId || trip.route_plan_id;
      const routePlan = routePlanId ? routePlans[routePlanId] : null;
      const parcelCount = bookingParcels.length || booking?.parcelIds.length || booking?.parcelCount || 0;
      const fromLocation = trip.fromLocation || trip.from || routePlan?.pickupLocation || booking?.routeLabel || "Airship Express Hub – Binondo, Manila";
      const routeStops = Array.isArray(trip.stops)
        ? trip.stops
            .map((s: any) => ({
              name: s.name || s.label || "Warehouse stop",
              lat: Number(s.lat ?? s.latitude),
              lng: Number(s.lng ?? s.longitude),
              status: s.status,
            }))
            .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        : [];
      const bookingStops = Array.isArray(booking?.deliveryDestinations)
        ? booking.deliveryDestinations
            .map((s: any) => ({
              name: s.name || s.label || "Warehouse stop",
              lat: Number(s.lat ?? s.latitude),
              lng: Number(s.lng ?? s.longitude),
              status: s.status,
            }))
            .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        : [];
      const routePlanStops = Array.isArray(routePlan?.deliveryDestinations)
        ? routePlan.deliveryDestinations
            .map((s: any) => ({
              name: s.name || s.label || "Warehouse stop",
              lat: Number(s.lat ?? s.latitude),
              lng: Number(s.lng ?? s.longitude),
              status: s.status,
            }))
            .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        : routeStops.length > 0
          ? routeStops
          : bookingStops;
      const destinationStop = routePlanStops[routePlanStops.length - 1];
      const destinationName = destinationStop?.name || trip.toLocation || trip.to || booking?.routeLabel || "Assigned route";
      const destinationPosition = destinationStop
        ? { lat: Number(destinationStop.lat), lng: Number(destinationStop.lng) }
        : resolveDestination(destinationName, trip.toCoords || (booking && booking.dropoffLatitude && booking.dropoffLongitude ? { lat: Number(booking.dropoffLatitude), lng: Number(booking.dropoffLongitude) } : null));
      const stops = routePlanStops.length > 0 ? routePlanStops : bookingStops;
      const stopCountLabel = stops.length > 1 ? ` • ${stops.length} stops` : "";
      const startPoint = trip.fromCoords || (booking?.pickupLatitude && booking?.pickupLongitude ? { lat: Number(booking.pickupLatitude), lng: Number(booking.pickupLongitude) } : null) || (routePlan?.pickupLocation ? { lat: Number(routePlan.pickupLatitude || 14.5995), lng: Number(routePlan.pickupLongitude || 120.9745) } : HUB_POS);

      const { etaMinutes, progress } = calculateEtaAndProgress(trip, booking, osrmMetrics[trip.id]);

      // Extract courier info with smart fallback
      // Priority: parcel courier > route plan courier > booking ID (for color diversity)
      const courierFromParcels = bookingParcels.find((p) => p.courier)?.courier;
      const courierFromRoutePlan = routePlan?.courier;
      const courier = courierFromParcels || courierFromRoutePlan || `Route-${(trip.bookingId || trip.booking_id)?.substring(0, 6) || 'unknown'}`;
      const driverName = resolveDriverName(trip.driverId || trip.driver_id, trip.driverName || booking?.driverName);
      const parcelDetails = bookingParcels.slice(0, 4).map((parcel) => {
        const parcelAny = parcel as any;
        const recipient = parcelAny.recipientName || parcelAny.recipient_name || "Recipient";
        const type = parcelAny.parcelType || parcelAny.type || "Parcel";
        const address = parcelAny.destinationAddress || parcelAny.address || parcelAny.dropoffAddress || "Address pending";
        return `${recipient} • ${type} • ${address}`;
      }).filter(Boolean);

      return {
        id: trip.id,
        name: driverName,
        driverName,
        driverPhone: resolveDriverPhone(trip.driverId || trip.driver_id || booking?.driverId),
        vehiclePlate: trip.vehicleId || "Assigned vehicle",
        parcelSummary: `${parcelCount} parcels — ${destinationName}${stopCountLabel}`,
        parcelCount,
        parcelDetails,
        origin: fromLocation,
        destination: destinationName,
        originPos: startPoint,
        destPos: destinationPosition,
        currentPos: trip.fromCoords || startPoint,
        progress,
        etaMinutes,
        status: normalizeTripStatus(trip.status),
        bookingId: trip.bookingId || trip.booking_id,
        courier,
        stops,
      } as Delivery;
    });

    const localDeliveries = bookings
      .filter((b) => {
        // Only show bookings that have BOTH driver AND vehicle assigned (fully dispatched)
        const isFullyDispatched = Boolean(b.driverId && b.vehicleId);
        const notInTrips = !trips.some((trip) => trip.bookingId === b.id || trip.booking_id === b.id);
        return isFullyDispatched && notInTrips;
      })
      .map((b) => {
        const bookingParcels = parcels.filter((p) => p.bookingId === b.id);
        const routePlan = b.routePlanId ? routePlans[b.routePlanId] : null;
        
        const { etaMinutes, progress } = calculateEtaAndProgress(b, b, osrmMetrics[b.id]);
        const isRush = etaMinutes > 0 && etaMinutes <= 15;

        // Extract courier info with smart fallback
        // Priority: parcel courier > route plan courier > booking ID (for color diversity)
        const courierFromParcels = bookingParcels.find((p) => p.courier)?.courier;
        const courierFromRoutePlan = routePlan?.courier;
        const courier = courierFromParcels || courierFromRoutePlan || `Route-${b.id?.substring(0, 6) || 'unknown'}`;
        const driverName = resolveDriverName(b.driverId, b.driverName);
        const parcelDetails = bookingParcels.slice(0, 4).map((parcel) => {
          const parcelAny = parcel as any;
          const recipient = parcelAny.recipientName || parcelAny.recipient_name || "Recipient";
          const type = parcelAny.parcelType || parcelAny.type || "Parcel";
          const address = parcelAny.destinationAddress || parcelAny.address || parcelAny.dropoffAddress || "Address pending";
          return `${recipient} • ${type} • ${address}`;
        }).filter(Boolean);

        const bookingStops = Array.isArray(b.deliveryDestinations)
          ? b.deliveryDestinations
              .map((s: any) => ({ name: s.name || s.label || "Warehouse stop", lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude), status: s.status }))
              .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          : [];
        const routePlanStops = Array.isArray(routePlan?.deliveryDestinations)
          ? routePlan.deliveryDestinations
              .map((s: any) => ({ name: s.name || s.label || "Warehouse stop", lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude), status: s.status }))
              .filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          : bookingStops;
        const destinationStop = routePlanStops[routePlanStops.length - 1];
        const destination = destinationStop?.name || b.routeLabel || "Assigned route";
        const originPos = routePlan?.pickupLatitude && routePlan?.pickupLongitude
          ? { lat: Number(routePlan.pickupLatitude), lng: Number(routePlan.pickupLongitude) }
          : HUB_POS;
        const currentPos = b.dispatch?.currentPos || originPos;

        return {
          id: b.id,
          name: driverName,
          driverName,
          driverPhone: (b as any).driverPhone || resolveDriverPhone(b.driverId),
          vehiclePlate: b.vehiclePlate || "Unassigned",
          parcelSummary: `${bookingParcels.length || b.parcelIds.length} parcels — ${destination}${routePlanStops.length > 1 ? ` • ${routePlanStops.length} stops` : ""}`,
          parcelCount: bookingParcels.length || b.parcelIds.length || 0,
          parcelDetails,
          origin: routePlan?.pickupLocation || "Airship Express Hub – Binondo, Manila",
          destination,
          originPos,
          destPos: destinationStop ? { lat: Number(destinationStop.lat), lng: Number(destinationStop.lng) } : (bookingParcels[0] ? { lat: bookingParcels[0].destLat, lng: bookingParcels[0].destLng } : HUB_POS),
          currentPos,
          progress,
          etaMinutes,
          status: b.status === "DISPATCHED"
            ? (isRush ? "critical" : b.dispatch?.status === "DELIVERING" ? "approaching" : "in-transit")
            : "in-transit",
          bookingId: b.id,
          courier,
          stops: routePlanStops,
        } as Delivery;
      });

    const inTransitParcels = parcels.filter((parcel) => {
      if (parcel.status !== "IN_TRANSIT" || !parcel.bookingId) return false;
      const booking = bookings.find((item) => String(item.id) === String(parcel.bookingId));
      return Boolean(booking?.driverId && booking?.vehicleId);
    });
    const inTransitGroups = new Map<string, typeof inTransitParcels>();
    inTransitParcels.forEach((parcel) => {
      const groupKey = parcel.bookingId || parcel.bulk_qr_code || parcel.id;
      inTransitGroups.set(groupKey, [...(inTransitGroups.get(groupKey) || []), parcel]);
    });

    const parcelDeliveries = Array.from(inTransitGroups.entries()).map(([groupKey, groupParcels]) => {
      const firstParcel = groupParcels[0];
      const booking = bookings.find((item) => String(item.id) === String(firstParcel.bookingId || groupKey));
      const assignedDriver = booking?.driverId ? drivers.find((driver) => String(driver.id) === String(booking.driverId)) : null;
      const assignedVehicle = booking?.vehicleId ? vehicles.find((vehicle) => String(vehicle.id) === String(booking.vehicleId)) : null;
      const destination = firstParcel.destinationAddress || "Destination pending";
      const destinationPosition = firstParcel.destLat || firstParcel.destLng
        ? { lat: Number(firstParcel.destLat), lng: Number(firstParcel.destLng) }
        : resolveDestination(destination);
      const { etaMinutes, progress } = calculateEtaAndProgress(firstParcel);
      const parcelBookingId = firstParcel.bookingId || `in-transit-${groupKey}`;

      return {
        id: `parcel-${groupKey}`,
        name: firstParcel.courier || "In-transit parcel",
        driverName: booking?.driverName || assignedDriver?.name || "Unassigned driver",
        driverPhone: (booking as any)?.driverPhone || resolveDriverPhone(booking?.driverId),
        vehiclePlate: booking?.vehiclePlate || assignedVehicle?.plate || "Not assigned",
        parcelSummary: `${groupParcels.length} parcel${groupParcels.length === 1 ? "" : "s"} — ${destination}`,
        parcelCount: groupParcels.length,
        parcelDetails: groupParcels.slice(0, 4).map((parcel) =>
          `${parcel.trackingNumber} • ${parcel.destinationAddress || "Address pending"}`
        ),
        origin: "Airship Express Hub - Binondo, Manila",
        destination,
        originPos: HUB_POS,
        destPos: destinationPosition,
        currentPos: HUB_POS,
        progress,
        etaMinutes,
        status: "in-transit",
        bookingId: parcelBookingId,
        courier: firstParcel.courier || "LBC",
        stops: [],
      } as Delivery;
    });

    // A trip is the canonical mission; an assigned booking is the fallback;
    // in-transit parcels are only a final fallback. Deduplicate by booking so
    // one delivery cannot produce multiple cards from those three sources.
    const missionsByBooking = new Map<string, Delivery>();
    for (const delivery of [...persistedDeliveries, ...localDeliveries, ...parcelDeliveries]) {
      const missionKey = String(delivery.bookingId || delivery.id);
      if (!missionsByBooking.has(missionKey)) missionsByBooking.set(missionKey, delivery);
    }

    // Keep dispatched missions visible before OSRM returns an ETA. Previously
    // an ETA of zero filtered out every new mission, which also prevented the
    // OSRM effect below from ever fetching its route and ETA.
    const validDeliveries = Array.from(missionsByBooking.values()).filter((d) => {
      if (d.status === "completed" || d.status === "cancelled") return false;
      const booking = bookings.find((b) => String(b.id) === String(d.bookingId));
      const trip = trips.find(
        (t) => String(t.bookingId || t.booking_id) === String(d.bookingId)
      );
      return Boolean(booking || trip || d.bookingId);
    });

    // Show all valid active mission deliveries, newest first
    if (validDeliveries.length > 0) {
      return [...validDeliveries].sort((a, b) => {
        const tripA = trips.find((t) => t.bookingId === a.bookingId || t.booking_id === a.bookingId);
        const tripB = trips.find((t) => t.bookingId === b.bookingId || t.booking_id === b.bookingId);

        const timeA = tripA?.createdAt || tripA?.created_at || 0;
        const timeB = tripB?.createdAt || tripB?.created_at || 0;

        const dateA = new Date(timeA).getTime();
        const dateB = new Date(timeB).getTime();
        return dateB - dateA;
      });
    }

    return validDeliveries;
  }, [bookings, parcels, routePlans, trips, timeUpdate, osrmMetrics]);

  // Update ETA and progress every minute as time passes
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate((prev: number) => prev + 1); // Trigger recalculation of memoized DELIVERIES
    }, 60000); // Update every 60 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tasks: Promise<[string, LatLng[]] | [string, null] | null>[] = [];
    
    DELIVERIES.forEach((delivery) => {
      if (delivery.destPos.lat === HUB_POS.lat && delivery.destPos.lng === HUB_POS.lng) {
        tasks.push(Promise.resolve(null));
      } else {
        // Route through every intermediate warehouse stop (in OR-Tools
        // visiting order), not just a straight origin->destination leg, so
        // the drawn path matches the multi-stop route the driver is on.
        const waypoints = delivery.stops && delivery.stops.length > 0
          ? [delivery.originPos, ...delivery.stops.map((s) => ({ lat: s.lat, lng: s.lng }))]
          : [delivery.originPos, delivery.destPos];
        
        tasks.push((async () => {
          const coordinates = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
          try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
            const result = await response.json();
            const geometry = result?.routes?.[0]?.geometry?.coordinates;
            if (!Array.isArray(geometry)) return null;
            return [delivery.id, geometry.map(([lng, lat]: [number, number]) => ({ lat, lng }))] as [string, LatLng[]];
          } catch {
            return null;
          }
        })());
      }
    });

    Promise.all(tasks).then((results) => {
      if (cancelled) return;
      setRoadPaths(Object.fromEntries(results.filter(Boolean) as [string, LatLng[]][]));
    });

    // Also fetch OSRM metrics (distance and duration) for ETA calculation
    const metricsPromises = DELIVERIES.map(async (delivery) => {
      if (delivery.destPos.lat === HUB_POS.lat && delivery.destPos.lng === HUB_POS.lng) {
        return null;
      }

      const waypoints = delivery.stops && delivery.stops.length > 0
        ? [delivery.originPos, ...delivery.stops.map((s) => ({ lat: s.lat, lng: s.lng })), delivery.destPos]
        : [delivery.originPos, delivery.destPos];

      const metrics = await fetchOsrmRouteMetrics(waypoints);
      if (!metrics) return null;
      return [delivery.id, metrics] as const;
    });

    Promise.all(metricsPromises).then((results) => {
      if (cancelled) return;
      setOsrmMetrics(Object.fromEntries(results.filter(Boolean) as [string, { distanceKm: number; durationMin: number }][]));
    });

    return () => { cancelled = true; };
  }, [DELIVERIES]);

  const critical = DELIVERIES.find((m) => m.status === "critical");
  const others = DELIVERIES.filter((m) => m.id !== critical?.id);

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
    const uniqueCouriers = Array.from(new Set(DELIVERIES.map((d) => d.courier || "LBC")));
    uniqueCouriers.forEach((courier, idx) => {
      colors.set(courier, colorPalette[idx % colorPalette.length]);
    });
    return colors;
  }, [DELIVERIES]);

  const markers: LeafletMarker[] = [
    {
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
    },
    ...DELIVERIES.flatMap((m) => {
      const deliveryMarkers: LeafletMarker[] = [
        {
          id: m.id,
          position: m.currentPos,
          color: m.status === "critical" ? "#e11d48" : "#be185d",
          label: (
            <div className="space-y-1 text-sm leading-tight">
              <div className="font-semibold text-slate-900">{m.name}</div>
              <div className="text-slate-600">Driver: {m.driverName}</div>
              <div className="text-slate-600">Vehicle: {m.vehiclePlate}</div>
              <div className="text-slate-600">ETA: {formatEta(m.etaMinutes)}</div>
              <div className="text-slate-600">{m.parcelSummary}</div>
            </div>
          ),
          radius: m.status === "critical" ? 10 : 7,
          meta: {
            title: m.driverName || "Mission",
            subtitle: `${m.courier || "Courier"} • ${m.vehiclePlate}`,
            details: (
              <div className="space-y-1 text-slate-600">
                <div><span className="font-semibold text-slate-800">Courier:</span> {m.courier || "Unassigned"}</div>
                <div><span className="font-semibold text-slate-800">Driver:</span> {m.driverName}</div>
                <div><span className="font-semibold text-slate-800">Parcel count:</span> {m.parcelCount}</div>
                <div className="pt-1 border-t border-slate-200 mt-1">
                  <div className="font-semibold text-slate-800">Parcel details</div>
                  {m.parcelDetails.length > 0 ? (
                    <div className="space-y-1">
                      {m.parcelDetails.map((detail, idx) => (
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

      // Add stop markers for each stop in the route
      if (m.stops && m.stops.length > 0) {
        m.stops.forEach((stop, index) => {
          deliveryMarkers.push({
            id: `${m.id}-stop-${index}`,
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

      // Add destination marker
      deliveryMarkers.push({
        id: `${m.id}-dest`,
        position: m.destPos,
        color: "#f43f5e",
        label: (
          <div className="space-y-1 text-sm leading-tight">
            <div className="font-semibold text-slate-900">Destination</div>
            <div className="text-slate-600">{m.destination}</div>
            <div className="text-slate-600">Route end point</div>
          </div>
        ),
        radius: 6,
        meta: {
          title: "Destination",
          subtitle: m.destination,
          details: <div className="text-sm text-slate-600">Route end point</div>,
        },
      });

      return deliveryMarkers;
    }),
  ];

  const isSamePoint = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
  const fallbackEndpoint = (point: LatLng) => ({ lat: point.lat + 0.0025, lng: point.lng + 0.0035 });

  const coloredPaths = useMemo(() => {
    return DELIVERIES
      .map((m) => {
        // If a delivery is selected, only show its path
        if (selectedDeliveryId && m.id !== selectedDeliveryId) {
          return null;
        }
        
        const color = courierColors.get(m.courier || "LBC") || "#3b82f6";
        const roadPath = roadPaths[m.id];
        
        if (roadPath && roadPath.length > 1) {
          return {
            points: roadPath,
            color,
            label: m.courier || "LBC",
          };
        }
        
        const lines = [] as LatLng[][];
        if (m.originPos && m.currentPos && !isSamePoint(m.originPos, m.currentPos)) {
          lines.push([m.originPos, m.currentPos]);
        }
        if (m.currentPos && m.destPos && !isSamePoint(m.currentPos, m.destPos)) {
          lines.push([m.currentPos, m.destPos]);
        }
        if (lines.length === 0 && m.originPos) {
          const fallback = fallbackEndpoint(m.originPos);
          lines.push([m.originPos, fallback]);
        }
        
        return lines.length > 0 ? { points: lines[0], color, label: m.courier || "LBC" } : null;
      })
      .filter(Boolean) as Array<{ points: LatLng[]; color: string; label: string }>;
  }, [DELIVERIES, roadPaths, selectedDeliveryId, courierColors]);

  const paths = coloredPaths.flatMap((p) => p.points);

  // Get selected delivery details for coordinate display
  const selectedDelivery = selectedDeliveryId 
    ? DELIVERIES.find((d) => d.id === selectedDeliveryId)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-inherit">
      <GlobalNavbar />

      <main className="flex-1 w-full px-4 py-8 md:px-8 lg:px-12">
        <div className="mx-auto max-w-container py-6 space-y-12">
          {/* Header & Controls */}
          <section className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-pink-600">VRDS Mission Control</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Active deliveries</h1>
                <p className="mt-2 max-w-2xl text-slate-600">
                  Monitor current dispatches, reroute urgent deliveries, and keep the fleet moving on time.
                </p>
              </div>

              <div className="inline-flex gap-2">
                <button
                  onClick={() => setView("list")}
                  className={`px-4 py-1.5 text-sm font-semibold transition ${
                    view === "list" ? "text-pink-600 underline underline-offset-8" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setView("map")}
                  className={`px-4 py-1.5 text-sm font-semibold transition ${
                    view === "map" ? "text-pink-600 underline underline-offset-8" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Map View
                </button>
              </div>
            </div>

            {/* Flat Stats Grid */}
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 pt-4">
              <StatItem icon="local_shipping" label="Active deliveries" value={`${DELIVERIES.length}`} sub={`${critical ? 1 : 0} rush`} />
              <StatItem icon="schedule" label="Average ETA" value={DELIVERIES.length ? `${Math.round(DELIVERIES.reduce((sum, m) => sum + m.etaMinutes, 0) / DELIVERIES.length)}m` : "—"} />
              <StatItem icon="warning" label="Critical missions" value={`${critical ? 1 : 0}`} sub="Needs attention" />
              <StatItem icon="map" label="Vehicles tracked" value={`${DELIVERIES.length}`} sub="Live location points" />
            </div>
          </section>

          {/* Main View Switching */}
          {view === "list" ? (
            <div className="grid gap-12 xl:grid-cols-[1.95fr_1fr]">
              <section className="space-y-8">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Live delivery queue</h2>
                    <p className="text-sm text-slate-600">Prioritized deliveries in progress with ETA and vehicle status.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRouteLines((visible) => !visible)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-50"
                      title={showRouteLines ? "Hide direction lines and track markers" : "Show optimized direction lines"}
                    >
                      <span className="material-symbols-outlined text-[16px]">{showRouteLines ? "route" : "location_searching"}</span>
                      {showRouteLines ? "Hide Route" : "Track Vehicles / Parcels"}
                    </button>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600">
                      <span className="material-symbols-outlined text-[18px]">traffic</span>
                      {DELIVERIES.length} active routes
                    </div>
                  </div>
                </div>

                {DELIVERIES.length === 0 ? (
                  <p className="py-8 text-slate-500">No booked deliveries with an assigned driver and vehicle yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {[...(critical ? [critical] : []), ...others].map((delivery) => (
                        <DeliveryCard
                          key={delivery.id}
                          delivery={delivery}
                          isSelected={selectedDeliveryId === delivery.id}
                          onSelect={setSelectedDeliveryId}
                        />
                      ))}
                  </div>
                )}

              </section>

              <aside className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Fleet map</h3>
                  <p className="text-sm text-slate-600">Track current delivery positions and fleet spread.</p>
                </div>
                <div className="h-[540px] w-full">
                  <LeafletMap 
                    center={HUB_POS} 
                    zoom={12} 
                    markers={markers} 
                    coloredPaths={showRouteLines || selectedDeliveryId ? coloredPaths : []} 
                    routeColor="#ec4899" 
                    onMarkerClick={(marker) => {
                      setActiveMarker(marker);
                      const deliveryId = marker.id.split('-')[0];
                      setSelectedDeliveryId(deliveryId);
                    }}
                  />
                </div>
              </aside>
            </div>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Live fleet map</h2>
                  <p className="text-sm text-slate-600">All active delivery assets and critical locations in one view.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRouteLines((visible) => !visible)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-50"
                    title={showRouteLines ? "Hide direction lines and track markers" : "Show optimized direction lines"}
                  >
                    <span className="material-symbols-outlined text-[16px]">{showRouteLines ? "route" : "location_searching"}</span>
                    {showRouteLines ? "Hide Route" : "Track Vehicles / Parcels"}
                  </button>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-600">
                    <span className="material-symbols-outlined text-[18px]">public</span>
                    {DELIVERIES.length || 0} vehicles tracked
                  </div>
                </div>
              </div>

              <div className="h-[720px] w-full">
                <LeafletMap 
                  center={HUB_POS} 
                  zoom={11} 
                  markers={markers} 
                  coloredPaths={showRouteLines || selectedDeliveryId ? coloredPaths : []} 
                  routeColor="#ec4899" 
                  onMarkerClick={(marker) => {
                    setActiveMarker(marker);
                    const deliveryId = marker.id.split('-')[0];
                    setSelectedDeliveryId(deliveryId);
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </main>
      <GlobalFooter />

      {/* Inline Marker Detail Overlay */}
      {activeMarker && (() => {
        const deliveryFromMarker = DELIVERIES.find((d) => activeMarker.id === d.id || activeMarker.id.startsWith(`${d.id}-`));
        const isDeliveryMarker = Boolean(deliveryFromMarker);

        return (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm space-y-3 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">
                  {isDeliveryMarker ? "Mission Info" : "Marker details"}
                </p>
                <h4 className="text-base font-bold text-slate-900">
                  {isDeliveryMarker
                    ? (deliveryFromMarker?.driverName || deliveryFromMarker?.name || deliveryFromMarker?.courier || activeMarker.meta?.title || "Mission")
                    : (activeMarker.meta?.title || activeMarker.meta?.subtitle || "Mission")}
                </h4>
                {activeMarker.meta?.subtitle && (
                  <p className="text-xs text-slate-600">{activeMarker.meta.subtitle}</p>
                )}
              </div>
              <button type="button" onClick={() => setActiveMarker(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {isDeliveryMarker && deliveryFromMarker ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span>Courier:</span>
                    <span className="font-semibold text-slate-900 text-right">{deliveryFromMarker.courier || "Unassigned"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Driver:</span>
                    <span className="font-semibold text-slate-900 text-right">{deliveryFromMarker.driverName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Parcel count:</span>
                    <span className="font-semibold text-slate-900 text-right">{deliveryFromMarker.parcelCount}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <div className="font-semibold text-slate-900 mb-1">Parcel details</div>
                    <div className="space-y-1">
                      {deliveryFromMarker.parcelDetails && deliveryFromMarker.parcelDetails.length > 0 ? (
                        deliveryFromMarker.parcelDetails.map((detail, idx) => (
                          <div key={idx} className="break-words text-[11px] leading-relaxed text-slate-700">{detail}</div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-500">No parcel details available.</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {activeMarker.meta?.details}
                  <div className="text-slate-500">Location details are shown for this map marker.</div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Delivery Detail Panel - Shows coordinates and route info when card is selected */}
      {selectedDelivery && (
        <div className="fixed bottom-6 left-6 z-50 max-w-md space-y-4 bg-white p-5 rounded-2xl shadow-2xl border border-pink-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Mission Info</p>
              <h4 className="text-base font-bold text-slate-900">{selectedDelivery.driverName || selectedDelivery.courier || "Mission"}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{selectedDelivery.destination}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedDeliveryId(null)} 
              className="text-xs font-semibold text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-slate-900">Delivery Details</div>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Courier:</span>
                  <span className="font-semibold text-slate-900 text-right">{selectedDelivery.courier || "Unassigned"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Driver:</span>
                  <span className="font-semibold text-slate-900 text-right">{selectedDelivery.driverName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Parcel Count:</span>
                  <span className="font-semibold text-slate-900 text-right">{selectedDelivery.parcelCount || Number.parseInt(selectedDelivery.parcelSummary.match(/\d+/)?.[0] ?? "0", 10) || 0}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Status:</span>
                  <span className="font-semibold text-slate-900 text-right">{selectedDelivery.progress}% Complete</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>ETA:</span>
                  <span className="font-semibold text-slate-900 text-right">{formatEta(selectedDelivery.etaMinutes)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="font-semibold text-slate-900">Parcel Details</div>
              <div className="space-y-1 text-slate-600 bg-slate-50 p-2 rounded">
                {selectedDelivery.parcelDetails && selectedDelivery.parcelDetails.length > 0 ? (
                  selectedDelivery.parcelDetails.map((detail, idx) => (
                    <div key={idx} className="break-words text-[11px] leading-relaxed text-slate-700">{detail}</div>
                  ))
                ) : (
                  <div className="text-[11px] text-slate-500">No parcel details available.</div>
                )}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-200 text-slate-600">
              <div className="font-semibold text-slate-900">Route</div>
              <div>{selectedDelivery.origin} → {selectedDelivery.destination}</div>
              {selectedDelivery.stops && selectedDelivery.stops.length > 0 && (
                <div className="text-[10px]">
                  <div className="font-semibold text-slate-700 mt-1">Stops ({selectedDelivery.stops.length}):</div>
                  <div className="space-y-0.5 mt-1">
                    {selectedDelivery.stops.map((stop, idx) => (
                      <div key={idx} className="text-slate-500">
                        {idx + 1}. {stop.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type LatLng = { lat: number; lng: number };

type Delivery = {
  id: string;
  name: string;
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
  driverName: string;
  driverPhone?: string | null;
  status: "critical" | "in-transit" | "approaching" | "completed" | "cancelled";
  bookingId: string;
  courier?: string;
  // Ordered waypoints (e.g. the courier warehouses an OR-Tools-optimized
  // bulk route visits, in visiting order) between origin and destination.
  stops?: { name: string; lat: number; lng: number; status?: string }[];
};

function StatItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="material-symbols-outlined text-pink-600 text-[18px]">{icon}</span>
        {label}
      </div>
      <div className="text-3xl font-extrabold text-slate-900">{value}</div>
      {sub && <div className="text-xs font-semibold text-pink-600">{sub}</div>}
    </div>
  );
}

function formatEta(min: number) {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }
  return `${min}m`;
}

const DELIVERY_STATUS_LABEL: Record<Delivery["status"], string> = {
  critical: "In Transit",
  "in-transit": "In Transit",
  approaching: "Approaching",
  completed: "Completed",
  cancelled: "Cancelled",
};

function DeliveryCard({ delivery, isSelected, onSelect }: { delivery: Delivery; isSelected?: boolean; onSelect?: (id: string) => void }) {
  if (delivery.status === "critical") {
    return (
      <>
      <article 
        onClick={() => onSelect?.(delivery.id)}
        className={`rounded-lg border p-4 cursor-pointer transition-colors ${
          isSelected 
            ? 'border-rose-600 bg-rose-50' 
            : 'border-slate-200 bg-white hover:shadow-md'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                RUSH PRIORITY
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Courier</p>
              <h3 className="text-base font-bold text-slate-900 mt-1">{delivery.driverName || delivery.name}</h3>
              <p className="text-xs text-slate-500">{delivery.vehiclePlate || "Vehicle not assigned"}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-rose-600">{formatEta(delivery.etaMinutes)}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400">ETA</div>
            </div>
          </div>

          <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-rose-600 transition-all" style={{ width: `${delivery.progress}%` }} />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-rose-600">RUSH PRIORITY</span>
            <span className="font-medium text-slate-500">{delivery.progress}% complete</span>
          </div>
        </div>
      </article>
      </>
    );
  }

  return (
    <>
    <article 
      onClick={() => onSelect?.(delivery.id)}
      className={`rounded-lg border p-4 cursor-pointer transition-colors ${
        isSelected 
          ? 'border-pink-600 bg-pink-50' 
          : 'border-slate-200 bg-white hover:shadow-md'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Courier</p>
            <h3 className="text-base font-bold text-slate-900">{delivery.driverName || delivery.name}</h3>
            <p className="text-xs text-slate-500">{delivery.vehiclePlate || "Vehicle not assigned"}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-pink-600">{formatEta(delivery.etaMinutes)}</div>
            <div className="text-[10px] font-bold uppercase text-slate-400">ETA</div>
          </div>
        </div>

        <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-pink-600 transition-all" style={{ width: `${delivery.progress}%` }} />
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="font-semibold text-pink-600">
            {DELIVERY_STATUS_LABEL[delivery.status]} • {delivery.progress}%
          </span>
          <span className="font-medium text-slate-500">ETA shown above</span>
        </div>
      </div>
    </article>
    </>
  );
}

