"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";
import RoleRestricted from "../../components/RoleRestricted";

import { useMemo, useState, useEffect } from "react";
import { getBookings, getRoutePlan, getTrips, getVehicles } from "../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VehicleStatus = "active" | "idle" | "maintenance";

type Vehicle = {
  id: string;
  name: string;
  type: string;
  plate: string;
  status: VehicleStatus;
  driver: string | null;
  route: string;
  utilizationPct: number;
  distanceTodayMi: number;
  distanceSource: "telemetry" | "route-plan";
  fuelPct: number | null;
  lastUpdated: string;
};

const FLEET_CACHE_KEY = "airship-fleet-analytics-cache";

function readFleetCache(): Vehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = JSON.parse(window.localStorage.getItem(FLEET_CACHE_KEY) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

// Fleet is loaded through the lightweight vehicles endpoint and normalized into `Vehicle[]`.

const STATUS_LABEL: Record<VehicleStatus, string> = {
  active: "On Route",
  idle: "Idle",
  maintenance: "Maintenance",
};

const STATUS_STYLE: Record<VehicleStatus, string> = {
  active: "bg-pink-100 text-pink-700 border border-pink-200",
  idle: "bg-slate-100 text-slate-600 border border-slate-200",
  maintenance: "bg-rose-100 text-rose-700 border border-rose-200",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMi(value: number) {
  return `${value.toLocaleString()} mi`;
}

function normalizeVehicleStatus(value: unknown, hasActiveTrip = false): VehicleStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (hasActiveTrip || ["active", "on route", "in transit", "dispatched", "moving"].includes(status)) return "active";
  if (["maintenance", "under maintenance", "out of service", "repair"].includes(status)) return "maintenance";
  return "idle";
}

function estimatedRouteDistanceKm(plan: any) {
  const optimizedDistance = Number(plan?.distanceKm ?? plan?.distance_km ?? plan?.routeGeojson?.routes?.[0]?.distance_km ?? plan?.route_geojson?.routes?.[0]?.distance_km ?? 0);
  if (optimizedDistance > 0) return optimizedDistance;

  const start = { lat: Number(plan?.pickupLatitude ?? plan?.pickup_latitude), lng: Number(plan?.pickupLongitude ?? plan?.pickup_longitude) };
  const stops = Array.isArray(plan?.deliveryDestinations) ? plan.deliveryDestinations : Array.isArray(plan?.delivery_destinations) ? plan.delivery_destinations : [];
  if (!Number.isFinite(start.lat) || !Number.isFinite(start.lng) || stops.length === 0) return 0;

  const toRadians = (value: number) => (value * Math.PI) / 180;
  let distanceKm = 0;
  let current = start;
  for (const stop of stops) {
    const next = { lat: Number(stop.lat ?? stop.latitude), lng: Number(stop.lng ?? stop.longitude) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) continue;
    const dLat = toRadians(next.lat - current.lat);
    const dLng = toRadians(next.lng - current.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(current.lat)) * Math.cos(toRadians(next.lat)) * Math.sin(dLng / 2) ** 2;
    distanceKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    current = next;
  }
  return distanceKm;
}

function UtilizationBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-pink-500" : value >= 40 ? "bg-pink-300" : "bg-slate-300";
  return (
    <div style={{ width: "100%" }} className="h-2 rounded-full bg-pink-50 overflow-hidden border border-pink-100">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FvmAnalyticsPage() {
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    const cachedFleet = readFleetCache();
    if (cachedFleet.length === 0) return;
    setFleet(cachedFleet);
    setHasData(true);
    setSelectedId((current) => current || cachedFleet[0]?.id || "");
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [vehicleRows, trips, bookings] = await Promise.all([getVehicles(), getTrips({ light: true }), getBookings()]);
        const activeTrips = (trips || []).filter((trip: any) =>
          /in[ _-]?transit|active|dispatch|moving|approach|delayed|late|critical/i.test(String(trip.status ?? ""))
        );
        const activeVehicleIds = new Set(
          activeTrips.map((trip: any) => String(trip.vehicleId ?? trip.vehicle_id ?? "")).filter(Boolean)
        );
        const activeTripByVehicle = new Map(activeTrips.map((trip: any) => [String(trip.vehicleId ?? trip.vehicle_id ?? ""), trip]));
        const bookingsById = new Map((bookings || []).map((booking: any) => [String(booking.id), booking]));
        const routePlanIds = Array.from(new Set(
          activeTrips
            .map((trip: any) => {
              const booking = bookingsById.get(String(trip.bookingId ?? trip.booking_id ?? ""));
              return trip.routePlanId ?? trip.route_plan_id ?? booking?.routePlanId ?? booking?.route_plan_id;
            })
            .filter(Boolean)
        ));
        const routePlans = await Promise.all(routePlanIds.map(async (id) => {
          try { return await getRoutePlan(String(id)); } catch { return null; }
        }));
        const routeDistanceByPlanId = new Map(routePlans.filter(Boolean).map((plan: any) => [
          String(plan.id),
          estimatedRouteDistanceKm(plan),
        ]));
        const plannedDistanceByVehicle = new Map<string, number>();
        activeTrips.forEach((trip: any) => {
          const booking = bookingsById.get(String(trip.bookingId ?? trip.booking_id ?? ""));
          const routePlanId = trip.routePlanId ?? trip.route_plan_id ?? booking?.routePlanId ?? booking?.route_plan_id;
          const distanceKm = routeDistanceByPlanId.get(String(routePlanId)) ?? 0;
          const vehicleId = String(trip.vehicleId ?? trip.vehicle_id ?? "");
          if (vehicleId && distanceKm > 0) plannedDistanceByVehicle.set(vehicleId, distanceKm * 0.621371);
        });
        const vehicles = (vehicleRows || []).map((v: any) => {
          const vehicleId = v.id || v.vehicle_id || String(v.plate || v.name || "").slice(0, 12);
          const status = normalizeVehicleStatus(v.status ?? v.availability, activeVehicleIds.has(String(vehicleId)));
          const telemetryDistance = Number((v.distanceTodayMi ?? v.distance_today_mi ?? v.distance) || 0);
          const plannedDistance = plannedDistanceByVehicle.get(String(vehicleId)) ?? 0;
          const activeTrip = activeTripByVehicle.get(String(vehicleId));
          const rawFuelPct = v.fuelPct ?? v.fuel_pct ?? v.battery_pct;
          const fuelPct = Number(rawFuelPct);
          const tripProgress = Number(activeTrip?.progress ?? 0);
          const reportedUtilization = Number(v.utilizationPct ?? v.utilization ?? 0);
          return {
            id: vehicleId,
            name: v.name || v.model || v.make || "Unit",
            type: v.type || v.vehicle_type || "Unknown",
            plate: v.plate_number || v.plate || "",
            status,
            driver: v.driverName || v.driver || activeTrip?.driverName || activeTrip?.driver_name || null,
            route: v.route || v.current_route || "",
            utilizationPct: Math.round(reportedUtilization > 0 ? reportedUtilization : activeTrip ? Math.max(5, tripProgress) : 0),
            distanceTodayMi: Math.round(telemetryDistance > 0 ? telemetryDistance : plannedDistance),
            distanceSource: telemetryDistance > 0 ? "telemetry" : "route-plan",
            fuelPct: Number.isFinite(fuelPct) && fuelPct > 0 ? Math.round(fuelPct) : null,
            lastUpdated: v.lastUpdated || v.updated_at || "",
          } as Vehicle;
        });
        if (mounted) {
          setFleet(vehicles);
          setHasData(Boolean(vehicles.length));
          window.localStorage.setItem(FLEET_CACHE_KEY, JSON.stringify(vehicles));
          if (!selectedId && vehicles.length) setSelectedId(vehicles[0].id);
        }
      } catch (e) {
        console.warn("Failed to load fleet snapshot", e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredFleet = useMemo(() => {
    return fleet.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        vehicle.name.toLowerCase().includes(q) ||
        vehicle.id.toLowerCase().includes(q) ||
        vehicle.route.toLowerCase().includes(q) ||
        (vehicle.driver ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [statusFilter, query, fleet]);

  const selectedVehicle = fleet.find((v) => v.id === selectedId) ?? fleet[0] ?? (null as Vehicle | null);

  const totalVehicles = fleet.length;
  const activeCount = fleet.filter((v) => v.status === "active").length;
  const idleCount = fleet.filter((v) => v.status === "idle").length;
  const maintenanceCount = fleet.filter((v) => v.status === "maintenance").length;
  const averageUtilization =
    fleet.length > 0
      ? Math.round((fleet.reduce((sum, v) => sum + v.utilizationPct, 0) / fleet.length) * 10) / 10
      : 0;
  const totalDistanceMi = fleet.reduce((sum, v) => sum + v.distanceTodayMi, 0);
  const predictions = useMemo(() => {
    const nextHourLoad = totalVehicles
      ? Math.min(100, Math.round(((activeCount + Math.min(idleCount, 1)) / totalVehicles) * 100))
      : 0;
    const constrainedFleet = maintenanceCount > 0 || idleCount === 0;
    const highUtilization = fleet.filter((vehicle) => vehicle.utilizationPct >= 80).length;

    return [
      {
        icon: "query_stats",
        label: "Next-hour fleet load",
        value: `${nextHourLoad}%`,
        detail: `${activeCount} active vehicle${activeCount === 1 ? "" : "s"}; forecast includes one ready unit.`,
        tone: "text-pink-700 bg-pink-50 border-pink-100",
      },
      {
        icon: "warning",
        label: "Dispatch capacity risk",
        value: constrainedFleet ? "Elevated" : "Low",
        detail: constrainedFleet ? "Fleet availability may constrain the next dispatch wave." : `${idleCount} vehicle${idleCount === 1 ? " is" : "s are"} ready for assignment.`,
        tone: constrainedFleet ? "text-rose-700 bg-rose-50 border-rose-100" : "text-emerald-700 bg-emerald-50 border-emerald-100",
      },
      {
        icon: "model_training",
        label: "Utilization pressure",
        value: highUtilization ? `${highUtilization} high-risk` : "Normal",
        detail: highUtilization ? "High-utilization vehicles should be monitored before their next assignment." : "No vehicle is currently above the 80% utilization threshold.",
        tone: highUtilization ? "text-amber-700 bg-amber-50 border-amber-100" : "text-indigo-700 bg-indigo-50 border-indigo-100",
      },
    ];
  }, [activeCount, fleet, idleCount, maintenanceCount, totalVehicles]);

  return (
    <div className="flex flex-col min-h-screen bg-rose-50/30 text-slate-800 dark:bg-[#05060a] dark:text-slate-100 font-sans selection:bg-pink-200 selection:text-pink-900">
      <GlobalNavbar />

      <main className="flex-grow flex flex-col gap-6 px-4 md:px-8 py-8 w-full mx-auto" style={{ width: '100%' }}>
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-pink-100 pb-6 dark:border-pink-900/50">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-pink-500 mb-1">
              Fleet Analytics
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight dark:text-slate-100">
              Vehicle Utilization Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Live utilization, distance, and telemetry status across the active delivery fleet
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-end px-3 py-1.5 rounded-full bg-white border border-pink-200 shadow-sm dark:bg-slate-900 dark:border-pink-900/50">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Live Updates</span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 dark:text-slate-400">Total Fleet</p>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{totalVehicles}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 dark:text-slate-400">On Route</p>
            <p className="text-3xl font-black text-pink-600 dark:text-pink-400">{activeCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 dark:text-slate-400">Idle</p>
            <p className="text-3xl font-black text-slate-700 dark:text-slate-200">{idleCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 dark:text-slate-400">Maintenance</p>
            <p className="text-3xl font-black text-rose-500 dark:text-rose-400">{maintenanceCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 col-span-2 md:col-span-1 dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 dark:text-slate-400">Avg Utilization</p>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{averageUtilization}%</p>
          </div>
        </div>

        <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-100/50 dark:border-pink-900/40 dark:bg-slate-900 dark:shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-pink-600">model_training</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Predictive Fleet Analytics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Near-term capacity and utilization forecast from live fleet signals</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {predictions.map((prediction) => (
              <div key={prediction.label} className={`rounded-xl border p-3 ${prediction.tone}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="material-symbols-outlined text-base">{prediction.icon}</span>
                  {prediction.label}
                </div>
                <p className="mt-1 text-xl font-black">{prediction.value}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">{prediction.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Fleet Table Section */}
          <section className="w-full lg:w-2/3 bg-white rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 overflow-hidden flex flex-col dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-pink-100 bg-rose-50/20 dark:border-pink-900/40 dark:bg-slate-950/30">
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vehicle, driver, or route..."
                  className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition dark:bg-slate-900 dark:text-slate-100 dark:border-pink-900/40 dark:placeholder-slate-500 dark:focus:border-pink-500 dark:focus:ring-pink-500/20"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(["all", "active", "idle", "maintenance"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      statusFilter === status
                        ? "bg-pink-500 text-white shadow-sm shadow-pink-300"
                        : "bg-white text-slate-600 border border-pink-100 hover:bg-rose-50 hover:text-pink-600 dark:bg-slate-900 dark:text-slate-300 dark:border-pink-900/40 dark:hover:bg-slate-800 dark:hover:text-pink-400"
                    }`}
                  >
                    {status === "all" ? "All" : STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-pink-50 max-h-[580px] overflow-y-auto dark:divide-slate-800">
              {filteredFleet.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No vehicles match your criteria.</p>
              )}
              {filteredFleet.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedId(vehicle.id)}
                  className={`w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition hover:bg-rose-50/40 dark:hover:bg-slate-800/70 ${
                    vehicle.id === selectedId
                      ? "bg-rose-50/80 border-l-4 border-pink-500 dark:bg-pink-900/20 dark:border-pink-400"
                      : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-slate-900 truncate dark:text-slate-100">{vehicle.name}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[vehicle.status]}`}>
                        {STATUS_LABEL[vehicle.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">
                      <span className="font-medium text-pink-600 dark:text-pink-400">{vehicle.id}</span> · {vehicle.type} · {vehicle.driver ?? "Unassigned"}
                    </p>
                  </div>

                  <div className="w-full sm:w-36 shrink-0">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1 dark:text-slate-400">
                      <span>Utilization</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{vehicle.utilizationPct}%</span>
                    </div>
                    <UtilizationBar value={vehicle.utilizationPct} />
                  </div>

                  <div className="w-full sm:w-24 shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatMi(vehicle.distanceTodayMi)}</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold dark:text-slate-500">{vehicle.distanceSource === "route-plan" ? "Route plan" : "Today"}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Selected Vehicle Detail Sidebar */}
          <aside className="w-full lg:w-1/3 bg-white rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 p-6 flex flex-col gap-6 h-fit dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <div className="border-b border-pink-100 pb-4 dark:border-pink-900/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-pink-500">Vehicle Profile</p>
                {selectedVehicle ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[selectedVehicle.status]}`}>
                    {STATUS_LABEL[selectedVehicle.status]}
                  </span>
                ) : (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">—</span>
                )}
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{selectedVehicle ? selectedVehicle.name : "—"}</h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 dark:text-slate-400">
                {selectedVehicle ? (
                  <>{selectedVehicle.id} <span className="mx-1">•</span> Plate: {selectedVehicle.plate}</>
                ) : (
                  ""
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-pink-100 dark:bg-slate-800/80 dark:border-pink-900/40">
               <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 dark:text-slate-400">Type</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle ? selectedVehicle.type : "—"}</p>
              </div>
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-pink-100 dark:bg-slate-800/80 dark:border-pink-900/40">
               <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 dark:text-slate-400">Driver</p> {
               selectedVehicle && selectedVehicle.driver ? (
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle.driver}</p>
               ) : (
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Unassigned</p>
               )}
              </div>
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-pink-100 dark:bg-slate-800/80 dark:border-pink-900/40">
               <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 dark:text-slate-400">{selectedVehicle?.distanceSource === "route-plan" ? "Planned Route" : "Distance"}</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle ? formatMi(selectedVehicle.distanceTodayMi) : "—"}</p>
              </div>
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-pink-100 dark:bg-slate-800/80 dark:border-pink-900/40">
               <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 dark:text-slate-400">Fuel</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle?.fuelPct != null ? `${selectedVehicle.fuelPct}%` : "No telemetry"}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 dark:text-slate-400">
                <span className="font-semibold">Current Utilization</span>
                <span className="font-extrabold text-pink-600 dark:text-pink-400">{selectedVehicle ? `${selectedVehicle.utilizationPct}%` : "—"}</span>
              </div>
              <UtilizationBar value={selectedVehicle ? selectedVehicle.utilizationPct : 0} />
            </div>

              <div className="pt-4 border-t border-pink-100 dark:border-pink-900/50">
                <p className="text-xs font-bold uppercase tracking-wider text-pink-500 mb-1">Assigned Route</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle ? selectedVehicle.route : "—"}</p>
                <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">Telemetry updated {selectedVehicle ? selectedVehicle.lastUpdated : "—"}</p>
              </div>

            <div className="pt-4 border-t border-pink-100 grid grid-cols-2 gap-3 text-center dark:border-pink-900/50">
              <div className="bg-rose-50/30 p-3 rounded-xl border border-pink-100 dark:bg-slate-800/70 dark:border-pink-900/40">
                <p className="text-base font-black text-slate-900 dark:text-slate-100">{formatMi(totalDistanceMi)}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-400">Fleet Total Distance</p>
              </div>
              <div className="bg-rose-50/30 p-3 rounded-xl border border-pink-100 dark:bg-slate-800/70 dark:border-pink-900/40">
                <p className="text-base font-black text-slate-900 dark:text-slate-100">{averageUtilization}%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-400">Fleet Avg Utilization</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
