"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { optimizeRoute, SAMPLE_OPTIMIZATION_PAYLOAD } from "../../lib/optimize";
import { getDashboardSnapshot, getParcels } from "../../lib/api";
import { listCourierWarehouses } from "../../lib/courierWarehouses";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

import RoleRestricted from "../../components/RoleRestricted";

export type DashboardVehicle = {
  id?: string;
  status?: string;
  plate_number?: string;
  plateNumber?: string;
  last_location_lat?: number;
  last_location_lng?: number;
  locationLat?: number;
  locationLng?: number;
  vehicleType?: string;
  capacityKg?: number;
};

export type DashboardTrip = {
  id?: string;
  status?: string;
  updated_at?: string;
  updatedAt?: string;
  vehicle_id?: string;
  vehicleId?: string;
  from_location?: string;
  to_location?: string;
  fromLocation?: string;
  toLocation?: string;
  createdAt?: string;
  loadKg?: number;
};

export type DashboardBooking = {
  id?: string;
  pickup_location?: string;
  dropoff_location?: string;
  status?: string;
  created_at?: string;
};

type VrdsDashboardSnapshot = {
  counts?: {
    vehicles?: number;
    trips?: number;
    bookings?: number;
    drivers?: number;
      parcels?: number;
  };
  vehicles?: Array<{ id?: string; status?: string; plate_number?: string; plateNumber?: string; last_location_lat?: number; last_location_lng?: number; locationLat?: number; locationLng?: number; fuel_efficiency?: number; fuelEfficiency?: number }>;
  trips?: Array<{ id?: string; status?: string; updated_at?: string; vehicle_id?: string; from_location?: string; to_location?: string }>; 
  bookings?: Array<{ id?: string; pickup_location?: string; dropoff_location?: string }>;
  drivers?: Array<{ id?: string; full_name?: string }>; 
  parcels?: Array<{
    id?: string;
    status?: string;
    parcel_status?: string;
    route_plan_id?: string | null;
    routePlanId?: string | null;
    route_id?: string | null;
    routeId?: string | null;
    trip_id?: string | null;
    tripId?: string | null;
    booking_id?: string | null;
    bookingId?: string | null;
    fuel_efficiency?: number;
    fuelEfficiency?: number;
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
  }>;
};

export default function VrdsDashboardPage() {
  const [scrambleStatus, setScrambleStatus] = useState<string | null>(null);
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [showMetricValues, setShowMetricValues] = useState(false);
  const [snapshot, setSnapshot] = useState<VrdsDashboardSnapshot>({ vehicles: [], trips: [], bookings: [], drivers: [] });
  const [parcelRecords, setParcelRecords] = useState<VrdsDashboardSnapshot["parcels"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleMetricVisibilityShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setShowMetricValues(true);
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setShowMetricValues(false);
      }
    };

    window.addEventListener("keydown", handleMetricVisibilityShortcut);
    return () => window.removeEventListener("keydown", handleMetricVisibilityShortcut);
  }, []);

  const handleScramble = () => {
    setScrambleStatus("Backup rider dispatched. Monitoring response.");
    setAlertActionMessage(null);
    setOptimizationMessage(null);
    window.setTimeout(() => setScrambleStatus(null), 3000);
  };

  const handleAlertAction = (label: string) => {
    setAlertActionMessage(`"${label}" action triggered.`);
    setScrambleStatus(null);
    setOptimizationMessage(null);
    window.setTimeout(() => setAlertActionMessage(null), 3000);
  };

  const handleReroute = async () => {
    setOptimizing(true);
    setOptimizationMessage(null);
    try {
      const result = await optimizeRoute(SAMPLE_OPTIMIZATION_PAYLOAD);
      setOptimizationMessage(
        `OR-Tools optimized route with ${result.orderedStopIds.length} stops. ETA ${result.etaMinutes} min.`
      );
    } catch (err) {
      setOptimizationMessage("Route optimization unavailable. Using fallback path.");
    } finally {
      setOptimizing(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardSnapshot(), getParcels()])
      .then(([data, parcelsData]) => {
        if (!active) return;
        const payload = data?.data && typeof data.data === "object" ? data.data : data;
        const parcelPayload = parcelsData?.data && Array.isArray(parcelsData.data) ? parcelsData.data : parcelsData;
        setSnapshot(payload ?? { vehicles: [], trips: [], bookings: [], parcels: [], drivers: [] });
        setParcelRecords(Array.isArray(parcelPayload) ? parcelPayload : []);
      })
      .catch((error) => console.error("Failed to load fleet snapshot:", error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const vehicles = (snapshot.vehicles ?? []).map((vehicle) => ({
    ...vehicle,
    status: vehicle.status ?? "Unknown",
    locationLat: vehicle.locationLat ?? vehicle.last_location_lat,
    locationLng: vehicle.locationLng ?? vehicle.last_location_lng,
  }));
  const trips = snapshot.trips ?? [];
  const bookings = snapshot.bookings ?? [];
  const parcels = (parcelRecords.length > 0 ? parcelRecords : snapshot.parcels ?? [])
    .filter((parcel) => {
      const status = String(parcel.status ?? parcel.parcel_status ?? "").trim();
      const isTerminal = /delivered|cancelled|canceled|completed|closed/i.test(status);
      const isAssigned = Boolean(
        parcel.route_plan_id ?? parcel.routePlanId ?? parcel.route_id ?? parcel.routeId
        ?? parcel.trip_id ?? parcel.tripId ?? parcel.booking_id ?? parcel.bookingId
      );
      return !isTerminal && !isAssigned;
    })
    .map((parcel) => ({
      ...parcel,
      status: parcel.status ?? "Unknown",
      createdAt: parcel.createdAt ?? parcel.created_at,
      updatedAt: parcel.updatedAt ?? parcel.updated_at,
    }));
  const canonicalParcelStatus = (status: unknown) => String(status ?? "received").trim().toLowerCase().replace(/\s+/g, "_");
  const parcelStatusCounts = parcels.reduce(
    (counts, parcel) => {
      const status = canonicalParcelStatus(parcel.status ?? parcel.parcel_status);
      if (["picked_up", "pickedup", "booked", "assigned"].includes(status)) counts.pickedUp += 1;
      else if (["in_transit", "transit", "dispatched", "dispatch", "delivering"].includes(status)) counts.inTransit += 1;
      else if (["received", "pending", "ready", "ready_for_booking", "ready_for_pickup"].includes(status)) counts.received += 1;
      return counts;
    },
    { received: 0, pickedUp: 0, inTransit: 0 }
  );
  const totalVehicles = snapshot.counts?.vehicles ?? vehicles.length;
  const totalParcels = parcels.length;
  const activeTrips = trips.filter((trip: any) => /in[_ ]?transit|transit|active|assigned|moving|dispatched/i.test(String(trip.status ?? ""))).length;
  const inTransitParcels = parcelStatusCounts.inTransit;
  const pickedUpParcels = parcelStatusCounts.pickedUp;
  const bookedParcels = parcelStatusCounts.received;
  const deliveredParcels = parcels.filter((parcel) => /delivered|completed/i.test(parcel.status ?? "")).length;
  const delayedParcels = parcels.filter((parcel) => /delayed|late|exception/i.test(parcel.status ?? "")).length;
  const activeVehicles = vehicles.filter((vehicle) => /active|available|ready|assigned|transit|in transit/i.test(vehicle.status ?? "")).length;
  const parcelShare = (count: number) => totalParcels > 0 ? `${((count / totalParcels) * 100).toFixed(1)}%` : "—";
  const activeVehicleShare = totalVehicles > 0 ? `${((activeVehicles / totalVehicles) * 100).toFixed(1)}%` : "—";
  const fuelEfficiencyValues = vehicles
    .map((vehicle) => Number(vehicle.fuelEfficiency ?? vehicle.fuel_efficiency))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageFuelEfficiency = fuelEfficiencyValues.length > 0
    ? `${(fuelEfficiencyValues.reduce((sum, value) => sum + value, 0) / fuelEfficiencyValues.length).toFixed(1)} km/L`
    : "0 km/L";
  const liveMapMarkers = useMemo(() => [
    {
      id: "airship-origin",
      position: { lat: 14.5995, lng: 120.9842 },
      color: "#b80049",
      label: "Airship Express Origin",
      isHub: true,
      meta: {
        title: "Airship Express",
        subtitle: "Company origin / main hub",
        details: (
          <div className="space-y-2 text-xs text-slate-600">
            <img src="/airship-logo.png" alt="Airship Express" className="h-10 w-auto max-w-[150px] object-contain" />
            <div>Origin and dispatch hub</div>
            <div>Binondo, Manila</div>
          </div>
        ),
      },
    },
    ...listCourierWarehouses().map((warehouse) => {
      const courierImage = warehouse.courier === "JNT Express"
        ? "/images/partners/jnt.png"
        : warehouse.courier === "ShopeeXpress"
          ? "/images/partners/shopee.png"
          : warehouse.courier === "Lazada Express"
            ? "/images/partners/lazada.png"
            : warehouse.courier === "Flash Express"
              ? "/images/partners/flash.png"
              : warehouse.courier === "TikTok Delivery"
                ? "/images/partners/tiktok.png"
                : warehouse.courier === "LBC"
                  ? "/images/partners/lbc.png"
                  : warehouse.courier === "GOGO Xpress"
                    ? "/images/partners/gogo.png"
                    : "/airship-logo.png";
      return {
        id: `warehouse-${warehouse.id}`,
        position: { lat: warehouse.lat, lng: warehouse.lng },
        color: "#8b5cf6",
        label: warehouse.name,
        isHub: true,
        meta: {
          title: warehouse.name,
          subtitle: `${warehouse.courier} warehouse`,
          details: (
            <div className="space-y-2 text-xs text-slate-600">
              <img src={courierImage} alt={warehouse.courier} className="h-9 w-24 rounded border border-slate-100 bg-white object-contain p-1" />
              <div>Courier: {warehouse.courier}</div>
              <div>Service city: {warehouse.city}</div>
              <div>Warehouse coordinates: {warehouse.lat.toFixed(6)}, {warehouse.lng.toFixed(6)}</div>
            </div>
          ),
        },
      };
    }),
    ...vehicles
      .filter((vehicle) => Number.isFinite(Number(vehicle.locationLat)) && Number.isFinite(Number(vehicle.locationLng)))
      .map((vehicle, index) => ({
        id: `vehicle-${vehicle.id || index}`,
        position: { lat: Number(vehicle.locationLat), lng: Number(vehicle.locationLng) },
        color: "#b80049",
        label: `Vehicle ${vehicle.plateNumber || vehicle.plate_number || vehicle.id || index + 1}`,
        meta: {
          title: vehicle.plateNumber || vehicle.plate_number || vehicle.id || "Vehicle",
          subtitle: "Active fleet vehicle",
          details: <div className="text-xs text-slate-600">Status: {vehicle.status || "Unknown"}</div>,
        },
      })),
    ...parcels
      .map((parcel: any, index) => {
        const lat = Number(parcel.dest_lat ?? parcel.destLat ?? parcel.dropoff_latitude ?? parcel.dropoffLatitude ?? parcel.latitude ?? parcel.lat);
        const lng = Number(parcel.dest_lng ?? parcel.destLng ?? parcel.dropoff_longitude ?? parcel.dropoffLongitude ?? parcel.longitude ?? parcel.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
        return {
          id: `parcel-${parcel.id || index}`,
          position: { lat, lng },
          color: "#3b82f6",
          label: `Parcel ${parcel.tracking_number || parcel.trackingNumber || parcel.id || index + 1}`,
          meta: {
            title: parcel.tracking_number || parcel.trackingNumber || parcel.id || "Active parcel",
            subtitle: "Active parcel destination",
            details: <div className="text-xs text-slate-600">Status: {parcel.status || "Unknown"}</div>,
          },
        };
      })
      .filter(Boolean),
  ], [parcels, vehicles]);
  const displayMetricValue = (value: string) => showMetricValues ? value : "****";
  const alerts = useMemo(() => {
    const criticalTrips = trips.filter((trip) => /delayed|late|delay|exception|problem|hold/i.test(trip.status ?? ""));
    if (criticalTrips.length > 0) {
      return criticalTrips.slice(0, 3).map((trip, index) => ({
        id: `trip-${trip.id}-${index}`,
        title: `Delay Alert - ${trip.vehicle_id ?? trip.id ?? "Unassigned"}`,
        detail: `Trip status is ${trip.status ?? "unknown"}. Immediate attention required.`,
        timeAgo: trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now",
        severity: "critical" as const,
        actionLabel: "View Trip",
      }));
    }

    return trips.slice(0, 3).map((trip, index) => ({
      id: `trip-${trip.id}-${index}`,
      title: `Live Update - ${trip.vehicle_id ?? trip.id ?? "Unassigned"}`,
      detail: `Last status: ${trip.status ?? "unknown"}. Updated at ${trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now"}`,
      timeAgo: trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now",
      severity: "warning" as const,
      actionLabel: "Inspect",
    }));
  }, [trips]);

  const operationalOverview = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
      return { date, day: date.toLocaleDateString("en-US", { weekday: "short" }) };
    });

    return days.map(({ date, day }) => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const parcelsOnDay = parcels.filter((parcel) => {
        const rawDate = parcel.createdAt || parcel.created_at || parcel.updatedAt || parcel.updated_at;
        if (!rawDate) return false;
        const parcelDate = new Date(rawDate);
        return !Number.isNaN(parcelDate.getTime()) && parcelDate >= date && parcelDate < nextDay;
      });

      return {
        day,
        parcels: parcelsOnDay.length,
        delivered: parcelsOnDay.filter((parcel) => /delivered|completed/i.test(parcel.status ?? "")).length,
      };
    });
  }, [parcels]);

  const statusMixData = useMemo(() => [
    { name: "In Transit", value: inTransitParcels || 0, color: "#ec4899" },
    { name: "Picked Up", value: pickedUpParcels || 0, color: "#8b5cf6" },
    { name: "Booked", value: bookedParcels || 0, color: "#f59e0b" },
    { name: "Delivered", value: deliveredParcels || 0, color: "#10b981" },
    { name: "Delayed", value: delayedParcels || 0, color: "#f43f5e" },
  ], [inTransitParcels, pickedUpParcels, bookedParcels, deliveredParcels, delayedParcels]);

  const fleetHealthData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vehicle of vehicles) {
      const rawStatus = String(vehicle.status ?? "Unknown").trim();
      const status = /active|available|ready|assigned|transit|in transit/i.test(rawStatus)
        ? "Active"
        : /maintenance|repair|service/i.test(rawStatus)
          ? "Maintenance"
          : /inactive|retired|unavailable|offline/i.test(rawStatus)
            ? "Unavailable"
            : "Unknown";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
      color: name === "Active" ? "#10b981" : name === "Maintenance" ? "#f59e0b" : name === "Unavailable" ? "#f43f5e" : "#94a3b8",
    }));
  }, [vehicles]);

  const tripStatusSeries = useMemo(() => {
    const sourceRecords = trips.length > 0
      ? trips
      : bookings.filter((booking: any) => {
          const status = String(booking.status ?? "").toLowerCase();
          const isTerminal = /completed|delivered|cancelled|canceled|closed|rejected/.test(status);
          const hasAssignment = Boolean(booking.driver_id ?? booking.driverId ?? booking.vehicle_id ?? booking.vehicleId ?? booking.route_plan_id ?? booking.routePlanId);
          return !isTerminal && hasAssignment;
        });
    const counts = new Map([
      ["In Transit", 0],
      ["Queued", 0],
      ["Delayed", 0],
      ["Completed", 0],
    ]);

    for (const record of sourceRecords) {
      const recordData = record as any;
      const status = String(recordData.status ?? "").trim();
      const key = /delayed|late|exception|problem|hold/i.test(status)
        ? "Delayed"
        : /in[_ ]?transit|transit|active|assigned|moving|dispatched/i.test(status)
          ? "In Transit"
          : /delivered|completed|arrived/i.test(status)
            ? "Completed"
            : "Queued";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([label, value]) => ({
      label,
      value,
      color: label === "Delayed" ? "#f43f5e" : label === "In Transit" ? "#ec4899" : label === "Completed" ? "#10b981" : "#f59e0b",
    }));
  }, [bookings, trips]);

  const operationalTripCount = trips.length > 0
    ? trips.length
    : tripStatusSeries.reduce((total, item) => total + item.value, 0);

  const parcelStatusSeries = useMemo(() => {
    return [
      { label: "Received", value: parcelStatusCounts.received, color: "#f59e0b" },
      { label: "Picked Up", value: parcelStatusCounts.pickedUp, color: "#8b5cf6" },
      { label: "In Transit", value: parcelStatusCounts.inTransit, color: "#ec4899" },
    ];
  }, [parcelStatusCounts]);

  return (
    <RoleRestricted allowedRoles={["fleet_manager", "admin", "dispatcher"]} hideWhenRestricted>
      <div className="min-h-screen flex flex-col bg-transparent text-inherit font-sans">
        <GlobalNavbar />

        {/* Main Full-Width Dashboard Container */}
        <main className="flex-1 w-full max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
        
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-pink-100 shadow-sm shadow-pink-500/5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                VRDS Dispatch Operations
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                System Live
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Real-time dispatch visibility, vehicle telemetry, and fleet routing engine for Metro Manila.
            </p>
          </div>

        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon="inventory_2"
            label="Total Parcels"
            value={displayMetricValue(String(totalParcels))}
            sub={<span className="text-slate-500">{parcelShare(inTransitParcels)} in transit</span>}
            progress={totalParcels > 0 ? 100 : 0}
            trendValue={parcelShare(inTransitParcels)}
          />
          <StatCard
            icon="local_shipping"
            label="Active Fleet"
            value={displayMetricValue(String(activeVehicles))}
            sub={<span className="text-slate-500">{activeVehicleShare} utilization</span>}
            progress={totalVehicles > 0 ? Math.min(100, (activeVehicles / totalVehicles) * 100) : 0}
            trendValue={activeVehicleShare}
          />
          <StatCard
            icon="route"
            label="Active Trips"
            value={displayMetricValue(String(activeTrips))}
            sub={<span className="text-slate-500">currently in progress</span>}
            progress={trips.length > 0 ? Math.min(100, (activeTrips / trips.length) * 100) : 0}
            trendValue={trips.length > 0 ? `${Math.round((activeTrips / trips.length) * 100)}%` : "—"}
          />
          <StatCard
            icon="bolt"
            label="Avg Fuel Efficiency"
            value={displayMetricValue(String(averageFuelEfficiency))}
            sub={<span className="text-slate-500">fleet efficiency</span>}
            progress={fuelEfficiencyValues.length > 0 ? Math.min(100, (Number(averageFuelEfficiency.replace(/[^0-9.]/g, "")) / 20) * 100) : 0}
            trendValue={fuelEfficiencyValues.length > 0 ? "+8.2%" : "—"}
          />
          <StatCard
            icon="pending_actions"
            label="Alerts"
            value={displayMetricValue(String(alerts.length))}
            sub={<span className="text-slate-500">{delayedParcels} delayed parcels</span>}
            progress={alerts.length > 0 ? Math.min(100, (alerts.length / 5) * 100) : 0}
            trendValue={delayedParcels > 0 ? `${delayedParcels} flagged` : "Clear"}
          />
        </div>

        {/* Global Action / Notification Banner */}
        {(scrambleStatus || alertActionMessage || optimizationMessage) && (
          <div className="rounded-xl border border-pink-200 bg-pink-50/90 backdrop-blur-sm px-5 py-3.5 text-pink-900 text-sm font-medium flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-pink-600 text-[20px]">
                info
              </span>
              <span>{scrambleStatus ?? alertActionMessage ?? optimizationMessage}</span>
            </div>
          </div>
        )}

        {/* Operational Charts Instead of KPI Cards */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-pink-100 bg-white/90 p-4 shadow-sm shadow-pink-500/5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volume</p>
                <h3 className="text-base font-bold text-slate-900">Parcel Throughput</h3>
              </div>
              <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-semibold text-pink-700">{totalParcels} total</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={operationalOverview}>
                  <defs>
                    <linearGradient id="throughputFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #fbcfe8", borderRadius: 12 }}
                    formatter={(value: number) => [`${value} parcels`, "Volume"]}
                  />
                  <Area type="monotone" dataKey="parcels" stroke="#ec4899" strokeWidth={3} fill="url(#throughputFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-pink-100 bg-white/90 p-4 shadow-sm shadow-pink-500/5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                <h3 className="text-base font-bold text-slate-900">Status Mix</h3>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{parcels.length} items</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusMixData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #fbcfe8", borderRadius: 12 }}
                    formatter={(value: number) => [`${value} parcels`, "Count"]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {statusMixData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-pink-100 bg-white/90 p-4 shadow-sm shadow-pink-500/5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fleet</p>
                <h3 className="text-base font-bold text-slate-900">Fleet Health</h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{activeVehicles}/{totalVehicles} active</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fleetHealthData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {fleetHealthData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #fbcfe8", borderRadius: 12 }}
                    formatter={(value: number) => [`${value} vehicles`, "Fleet"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Main Grid Section: Operations Map & Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Map Section (Spans 8 columns on large screens) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-pink-100/70 text-pink-600">
                  <span className="material-symbols-outlined text-[20px] block">public</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Metro Manila Live Operations
                  </h2>
                  <p className="text-xs text-slate-500">Live GPS tracking & delivery zone coverage</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3.5 py-1.5 text-xs font-semibold text-pink-700 border border-pink-200/60">
                <span className="material-symbols-outlined text-[15px] text-pink-600">hub</span>
                OR-Tools v9.8
              </span>
            </div>

            {/* Interactive Map Wrapper */}
            <div className="grid min-h-[460px] grid-cols-1 overflow-hidden rounded-2xl border border-pink-100 bg-slate-50 shadow-sm shadow-pink-500/5 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-h-[320px] relative">
                <LeafletMap
                  center={{ lat: 14.62, lng: 121.05 }}
                  zoom={10}
                  markers={liveMapMarkers}
                />
              </div>

              {/* Service Area Sidebar */}
              <aside className="hidden border-l border-pink-100 bg-white/80 md:flex md:flex-col">
                <div className="border-b border-pink-100 px-4 py-3.5 bg-pink-50/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">
                    Active Coverage
                  </p>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {liveMapMarkers.length} Live Points
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                  {SERVICE_AREAS.map((area) => (
                    <div
                      key={area.name}
                      className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-700 hover:bg-pink-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                          style={{ backgroundColor: area.color }}
                        />
                        <span className="font-medium">{area.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Active</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-pink-100 px-4 py-2.5 text-[11px] text-slate-500 bg-slate-50/50 text-center font-medium">
                  + expanding coverage weekly
                </div>
              </aside>
            </div>

            {/* Map Legend Footer */}
            <div className="mt-3.5 flex items-center gap-6 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-600 inline-block" /> In Transit
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Delayed
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Delivered
              </span>
            </div>
          </div>

          {/* Right Control Center (Spans 4 columns on large screens) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-pink-100 bg-white/90 p-5 shadow-sm shadow-pink-500/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Operations Pulse</h3>
                  <p className="text-[11px] text-slate-500">Live dispatch and parcel mix</p>
                </div>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                  Live
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wider">Trip Status</span>
                    <span>{operationalTripCount} trips</span>
                  </div>
                  <div className="flex h-28 items-end gap-2">
                    {tripStatusSeries.map((item) => {
                      const max = Math.max(...tripStatusSeries.map((entry) => entry.value), 1);
                      return (
                        <div key={item.label} className="group flex-1 flex flex-col items-center justify-end gap-2">
                          <div className="relative flex h-full w-full items-end justify-center">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-2 py-1 text-[9px] font-semibold text-white opacity-0 transition-all group-hover:opacity-100 whitespace-nowrap">
                              {item.value}
                            </div>
                            <div
                              className={`w-full rounded-t-xl transition-all duration-200 group-hover:scale-[1.03] ${item.value === 0 ? "min-h-[3px] opacity-30" : ""}`}
                              style={{
                                height: `${(item.value / max) * 100}%`,
                                background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`,
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500">{item.label.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wider">Parcel Flow</span>
                    <span>{parcels.length} parcels</span>
                  </div>
                  <div className="flex h-28 items-end gap-2">
                    {parcelStatusSeries.map((item) => {
                      const max = Math.max(...parcelStatusSeries.map((entry) => entry.value), 1);
                      const barHeight = Math.max(8, Math.round((item.value / max) * 92));
                      return (
                        <div key={item.label} className="group flex-1 flex flex-col items-center justify-end gap-2">
                          <div className="relative flex h-full w-full items-end justify-center">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-2 py-1 text-[9px] font-semibold text-white opacity-0 transition-all group-hover:opacity-100 whitespace-nowrap">
                              {item.value}
                            </div>
                            <div
                              className="w-full rounded-t-xl transition-all duration-200 group-hover:scale-[1.03]"
                              style={{
                                height: `${barHeight}px`,
                                minHeight: "8px",
                                opacity: item.value === 0 ? 0.35 : 1,
                                background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`,
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500">{item.label.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </main>

        <GlobalFooter />
      </div>
    </RoleRestricted>
  );
}

// Data Structures

const SERVICE_AREAS = [
  { name: "Caloocan", position: { lat: 14.65, lng: 120.98 }, color: "#f59e0b" },
  { name: "Quezon City", position: { lat: 14.676, lng: 121.043 }, color: "#3b82f6" },
  { name: "Manila", position: { lat: 14.5995, lng: 120.9842 }, color: "#db177c" },
  { name: "Makati", position: { lat: 14.5547, lng: 121.0244 }, color: "#10b981" },
  { name: "Pasig", position: { lat: 14.5764, lng: 121.0851 }, color: "#8b5cf6" },
  { name: "Mandaluyong", position: { lat: 14.5794, lng: 121.0359 }, color: "#f97316" },
  { name: "San Juan", position: { lat: 14.6019, lng: 121.0355 }, color: "#06b6d4" },
  { name: "Marikina", position: { lat: 14.6507, lng: 121.1029 }, color: "#84cc16" },
  { name: "Pasay", position: { lat: 14.5378, lng: 121.0014 }, color: "#d946ef" },
  { name: "Taguig", position: { lat: 14.5176, lng: 121.0509 }, color: "#14b8a6" },
  { name: "Paranaque", position: { lat: 14.4793, lng: 121.0198 }, color: "#ec4899" },
  { name: "Valenzuela", position: { lat: 14.7006, lng: 120.983 }, color: "#f43f5e" },
];

const SERVICE_AREA_MARKERS = SERVICE_AREAS.map((area) => ({
  id: area.name,
  position: area.position,
  color: area.color,
  label: area.name,
}));

type Alert = {
  id: string;
  title: string;
  detail: string;
  timeAgo: string;
  severity: "critical" | "warning";
  actionLabel: string;
};

// UI Components
function StatCard({
  icon,
  label,
  value,
  sub,
  progress,
  trendValue,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  progress?: number;
  trendValue?: string;
}) {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-md p-3 border border-pink-100 shadow-sm shadow-pink-500/5 flex min-h-[104px] flex-col justify-between hover:border-pink-200 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 border border-pink-100">
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
          <span className="text-[11px] font-bold text-slate-400" title="Current snapshot share">
            → {trendValue ?? "—"}
          </span>
        </div>
        {progress !== undefined && (
          <div className="mt-2">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-rose-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Capacity</span>
              <span>{progress}% Capacity</span>
            </div>
          </div>
        )}
        {sub && <div className="mt-1 text-[10px]">{sub}</div>}
      </div>
    </div>
  );
}

function AlertItem({ alert, onAction }: { alert: Alert; onAction: (label: string) => void }) {
  const isCritical = alert.severity === "critical";
  return (
    <div
      className={`rounded-xl p-3.5 border transition-all ${
        isCritical
          ? "border-pink-200 bg-pink-50/60"
          : "border-slate-200/80 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-slate-900">{alert.title}</span>
        <span className="text-[10px] font-medium text-slate-400 shrink-0">{alert.timeAgo}</span>
      </div>
      <p className="mt-1 text-xs text-slate-600 leading-normal">{alert.detail}</p>
      <button
        type="button"
        onClick={() => onAction(alert.actionLabel)}
        className="mt-2 text-xs font-bold text-pink-600 hover:text-pink-700 hover:underline inline-flex items-center gap-1"
      >
        <span>{alert.actionLabel}</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
      </button>
    </div>
  );
}


