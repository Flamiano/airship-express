"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { optimizeRoute, SAMPLE_OPTIMIZATION_PAYLOAD } from "../../lib/optimize";
import { getDashboardSnapshot } from "../../lib/api";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

import RoleRestricted from "../../components/RoleRestricted";

async function fetchOsrmServiceAreaRoute(points: Array<{ lat: number; lng: number }>) {
  if (points.length < 2) return [];

  try {
    const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return [];

    const data = await response.json();
    const geometry = data?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(geometry)
      ? geometry.map(([lng, lat]: [number, number]) => ({ lat, lng }))
      : [];
  } catch {
    return [];
  }
}

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
  };
  vehicles?: Array<{ id?: string; status?: string; plate_number?: string; last_location_lat?: number; last_location_lng?: number }>;
  trips?: Array<{ id?: string; status?: string; updated_at?: string; vehicle_id?: string; from_location?: string; to_location?: string }>; 
  bookings?: Array<{ id?: string; pickup_location?: string; dropoff_location?: string }>;
  drivers?: Array<{ id?: string; full_name?: string }>; 
};

export default function VrdsDashboardPage() {
  const [scrambleStatus, setScrambleStatus] = useState<string | null>(null);
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [snapshot, setSnapshot] = useState<VrdsDashboardSnapshot>({ vehicles: [], trips: [], bookings: [], drivers: [] });
  const [loading, setLoading] = useState(true);
  const [serviceAreaRoute, setServiceAreaRoute] = useState<Array<{ lat: number; lng: number }>>([]);

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
    getDashboardSnapshot()
      .then((data) => {
        if (active) setSnapshot(data ?? { vehicles: [], trips: [], bookings: [], drivers: [] });
      })
      .catch((error) => console.error("Failed to load fleet snapshot:", error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchOsrmServiceAreaRoute(SERVICE_AREAS.map((area) => area.position)).then((route) => {
      if (active && route.length > 1) setServiceAreaRoute(route);
    });

    return () => {
      active = false;
    };
  }, []);

  const vehicles = snapshot.vehicles ?? [];
  const trips = snapshot.trips ?? [];
  const bookings = snapshot.bookings ?? [];
  const totalVehicles = snapshot.counts?.vehicles ?? vehicles.length;
  const activeDeliveries = trips.filter((trip) => /transit|assigned|scheduled|dispatch|in transit/i.test(trip.status ?? "")).length;
  const completedTrips = trips.filter((trip) => /delivered|completed|done|success/i.test(trip.status ?? "")).length;
  const delayedTrips = trips.filter((trip) => /delayed|late|delay|exception|problem|hold/i.test(trip.status ?? "")).length;
  const activeVehicles = vehicles.filter((vehicle) => /active|available|ready|assigned|transit|in transit/i.test(vehicle.status ?? "")).length;
  const vehicleUtilization = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
  const coverageZones = new Set(
    trips
      .flatMap((trip: any) => [trip.from_location, trip.to_location, trip.fromLocation, trip.toLocation])
      .filter(Boolean)
      .map(String)
  ).size || new Set(bookings.flatMap((booking: any) => [booking.pickup_location, booking.dropoff_location]).filter(Boolean).map(String)).size;
  const onTimeRate = trips.length > 0 ? Math.round((completedTrips / trips.length) * 100) : 0;
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

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReroute}
              disabled={optimizing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-600/20 hover:from-pink-700 hover:to-rose-700 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                {optimizing ? "sync" : "alt_route"}
              </span>
              {optimizing ? "Optimizing Route..." : "Run Route Optimizer"}
            </button>
          </div>
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

        {/* Key Metrics / Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            icon="schedule"
            label="On-Time Delivery Rate"
            value={`${onTimeRate}%`}
            sub={
              <span className="text-emerald-600 inline-flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[15px]">trending_up</span>
                {completedTrips} deliveries completed on time
              </span>
            }
          />
          <StatCard
            icon="local_shipping"
            label="Active Fleet Deliveries"
            value={String(activeDeliveries)}
            sub={
              <span className="text-slate-500 inline-flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                {loading ? "Loading live dispatch" : `${activeDeliveries} active trips`}
              </span>
            }
          />
          <StatCard
            icon="bar_chart"
            label="Vehicle Utilization"
            value={`${vehicleUtilization}%`}
            progress={vehicleUtilization}
          />
          <StatCard
            icon="map"
            label="Coverage Zones"
            value={`${coverageZones} zones`}
            sub={
              <span className="text-pink-600 font-medium">
                {bookings.length} recent booking locations
              </span>
            }
          />
        </div>

        {/* Main Grid Section: Operations Map & Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Map Section (Spans 8 columns on large screens) */}
          <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-pink-100 shadow-sm shadow-pink-500/5 flex flex-col justify-between">
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
            <div className="grid min-h-[460px] grid-cols-1 overflow-hidden rounded-xl border border-pink-100 bg-slate-50 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-h-[320px] relative">
                <LeafletMap
                  center={{ lat: 14.62, lng: 121.05 }}
                  zoom={10}
                  markers={SERVICE_AREA_MARKERS}
                  paths={serviceAreaRoute.length > 1 ? [serviceAreaRoute] : []}
                />
              </div>

              {/* Service Area Sidebar */}
              <aside className="hidden border-l border-pink-100 bg-white/80 md:flex md:flex-col">
                <div className="border-b border-pink-100 px-4 py-3.5 bg-pink-50/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">
                    Active Coverage
                  </p>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                    12 Service Hubs
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
            
            {/* Quick Dispatch Action Card */}
            <div className="rounded-2xl border border-pink-200 bg-gradient-to-b from-white via-pink-50/30 to-white p-6 shadow-sm shadow-pink-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-pink-200/30 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pink-600 text-white shadow-md shadow-pink-600/30">
                  <span className="material-symbols-outlined text-[20px] block">rocket_launch</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Quick Dispatch</h3>
                  <p className="text-xs text-slate-500">Emergency backup assignment</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Immediately allocate the nearest available standby rider to recover delayed or failed package drop-offs.
              </p>
              <button
                type="button"
                onClick={handleScramble}
                className="mt-4 w-full rounded-xl bg-slate-900 text-white hover:bg-pink-600 py-3 text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-md hover:shadow-pink-600/20 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">navigation</span>
                Dispatch Backup Rider
              </button>
            </div>

            {/* System Alerts Center */}
            <div className="rounded-2xl bg-white/90 backdrop-blur-md p-6 border border-pink-100 shadow-sm shadow-pink-500/5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-pink-600">warning</span>
                  <h3 className="text-base font-bold text-slate-900">System Alerts</h3>
                </div>
                <span className="rounded-full bg-pink-100 text-pink-700 text-xs font-bold px-2.5 py-0.5 border border-pink-200/80">
                  {alerts.length} Active
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {alerts.length > 0 ? alerts.map((a) => (
                  <AlertItem key={a.id} alert={a} onAction={handleAlertAction} />
                )) : (
                  <div className="rounded-xl p-3.5 border border-slate-200/80 bg-slate-50 text-xs text-slate-500">
                    No active alerts in the current snapshot.
                  </div>
                )}
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
}: {
  icon: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-pink-100 shadow-sm shadow-pink-500/5 flex flex-col justify-between hover:border-pink-200 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 border border-pink-100">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
        {progress !== undefined && (
          <div className="mt-3">
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
        {sub && <div className="mt-2 text-xs">{sub}</div>}
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


