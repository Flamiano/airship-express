// @ts-nocheck
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
  utilizationTrend: number[];
  capacityKg: number | null;
  loadUtilizationPct: number | null;
  deliveriesToday: number | null;
  onTimeRatePct: number | null;
  costPerMile: number | null;
  costPerDelivery: number | null;
  depot: string | null;
  idleDurationMinutes: number | null;
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

const METRIC_LABELS = [
  "Total Fleet",
  "On Route",
  "Idle",
  "Maintenance",
  "Avg Utilization",
  "Next-hour fleet load",
  "Dispatch capacity risk",
  "Utilization pressure",
  "High utilization",
  "Balanced utilization",
  "Low utilization",
  "Driver coverage",
  "Telemetry coverage",
  "Fleet readiness",
  "Avg Load Utilization",
  "Deliveries Today",
  "On-Time Rate",
  "Cost per Mile",
  "Cost per Delivery",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMi(value: number) {
  return `${value.toLocaleString()} mi`;
}

function normalizeUtilizationTrend(value: unknown, currentValue: number) {
  const values = Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];
  if (values.length === 0) return Array(7).fill(currentValue);
  return values.slice(-7);
}

function recordDate(value: unknown) {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(value: unknown) {
  const date = recordDate(value);
  const now = new Date();
  return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate());
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function isCompletedRecord(record: any) {
  return /complete|delivered|finished|success/i.test(String(record?.status ?? record?.booking_status ?? ""));
}

function isOnTimeRecord(record: any) {
  if (typeof record?.onTime === "boolean") return record.onTime;
  if (typeof record?.on_time === "boolean") return record.on_time;
  return !/late|delay|overdue/i.test(String(record?.status ?? record?.delivery_status ?? record?.delay_reason ?? ""));
}

function hasConsecutiveUtilization(values: unknown, predicate: (value: number) => boolean, days = 3) {
  if (!Array.isArray(values)) return false;
  let consecutive = 0;
  for (const value of values) {
    consecutive = predicate(value) ? consecutive + 1 : 0;
    if (consecutive >= days) return true;
  }
  return false;
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
  const [depotFilter, setDepotFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7" | "30">("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [hiddenMetricValues, setHiddenMetricValues] = useState<Set<string>>(() => new Set(METRIC_LABELS));

  useEffect(() => {
    const handleMetricShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setHiddenMetricValues(new Set());
      }
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setHiddenMetricValues(new Set(METRIC_LABELS));
      }
    };

    window.addEventListener("keydown", handleMetricShortcut);
    return () => window.removeEventListener("keydown", handleMetricShortcut);
  }, []);

  const toggleMetricVisibility = (label: string) => {
    setHiddenMetricValues((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
        const bookingByVehicleId = new Map(
          (bookings || [])
            .map((booking: any) => [String(booking.vehicleId ?? booking.vehicle_id ?? ""), booking] as const)
            .filter(([vehicleId]) => Boolean(vehicleId))
        );
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
        const completedByVehicle = new Map<string, number>();
        const onTimeTotalsByVehicle = new Map<string, { total: number; onTime: number }>();
        const loadByVehicle = new Map<string, number>();
        (trips || []).forEach((trip: any) => {
          const vehicleId = String(trip.vehicleId ?? trip.vehicle_id ?? "");
          if (!vehicleId || !isCompletedRecord(trip) || !isToday(trip.actualArrival ?? trip.actual_arrival ?? trip.completedAt ?? trip.completed_at ?? trip.updatedAt ?? trip.updated_at ?? trip.createdAt ?? trip.created_at)) return;
          completedByVehicle.set(vehicleId, (completedByVehicle.get(vehicleId) ?? 0) + 1);
          const totals = onTimeTotalsByVehicle.get(vehicleId) ?? { total: 0, onTime: 0 };
          totals.total += 1;
          if (isOnTimeRecord(trip)) totals.onTime += 1;
          onTimeTotalsByVehicle.set(vehicleId, totals);
        });
        (activeTrips || []).forEach((trip: any) => {
          const vehicleId = String(trip.vehicleId ?? trip.vehicle_id ?? "");
          const booking = bookingsById.get(String(trip.bookingId ?? trip.booking_id ?? ""));
          const load = firstNumber(
            trip.loadKg,
            trip.load_kg,
            trip.cargoWeight,
            trip.cargo_weight,
            booking?.totalWeightKg,
            booking?.total_weight_kg,
            booking?.cargoWeight,
            booking?.cargo_weight,
            booking?.weightKg,
            booking?.weight_kg
          );
          if (vehicleId && load != null) loadByVehicle.set(vehicleId, load);
        });
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
          const activeBooking = activeTrip
            ? bookingsById.get(String(activeTrip.bookingId ?? activeTrip.booking_id ?? ""))
            : bookingByVehicleId.get(String(vehicleId));
          const rawFuelPct = v.fuelPct ?? v.fuel_pct ?? v.battery_pct;
          const fuelPct = Number(rawFuelPct);
          const tripProgress = Number(activeTrip?.progress ?? 0);
          const reportedUtilization = Number(v.utilizationPct ?? v.utilization ?? 0);
          const capacityKg = firstNumber(v.capacityKg, v.capacity_kg, v.capacity);
          const activeBookingWeight = loadByVehicle.get(String(vehicleId));
          const loadUtilizationPct = capacityKg && activeBookingWeight != null
            ? Math.min(100, Math.round((activeBookingWeight / capacityKg) * 100))
            : null;
          const onTimeTotals = onTimeTotalsByVehicle.get(String(vehicleId));
          const costAmount = firstNumber(v.costPerMile, v.cost_per_mile, v.costPerDelivery, v.cost_per_delivery, activeTrip?.cost, activeTrip?.cost_amount);
          const reportedIdleMinutes = firstNumber(v.idleDurationMinutes, v.idle_duration_minutes, v.idleMinutes, v.idle_minutes);
          const updatedAt = recordDate(v.lastUpdated ?? v.updated_at ?? v.updatedAt);
          const derivedIdleMinutes = status === "idle" && updatedAt
            ? Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 60000))
            : null;
          const driver =
            v.driverName ||
            v.driver_name ||
            v.driver ||
            activeTrip?.driverName ||
            activeTrip?.driver_name ||
            activeBooking?.driverName ||
            activeBooking?.driver_name ||
            activeBooking?.assignedDriverName ||
            activeBooking?.assigned_driver_name ||
            null;
          return {
            id: vehicleId,
            name: v.name || v.model || v.make || "Unit",
            type: v.type || v.vehicle_type || "Unknown",
            plate: v.plate_number || v.plate || "",
            status,
            driver,
            route: v.route || v.current_route || "",
            utilizationPct: Math.round(reportedUtilization > 0 ? reportedUtilization : activeTrip ? Math.max(5, tripProgress) : 0),
            utilizationTrend: normalizeUtilizationTrend(v.utilizationTrend ?? v.utilization_trend ?? v.trend ?? v.utilization_history, Math.round(reportedUtilization > 0 ? reportedUtilization : activeTrip ? Math.max(5, tripProgress) : 0)),
            capacityKg,
            loadUtilizationPct,
            deliveriesToday: completedByVehicle.has(String(vehicleId)) ? completedByVehicle.get(String(vehicleId)) ?? 0 : null,
            onTimeRatePct: onTimeTotals?.total ? Math.round((onTimeTotals.onTime / onTimeTotals.total) * 100) : null,
            costPerMile: costAmount != null && telemetryDistance > 0 ? Math.round((costAmount / telemetryDistance) * 100) / 100 : null,
            costPerDelivery: costAmount != null && completedByVehicle.get(String(vehicleId)) ? Math.round((costAmount / (completedByVehicle.get(String(vehicleId)) ?? 1)) * 100) / 100 : null,
            depot: v.depot || v.depotName || v.depot_name || v.hub || v.hubName || v.hub_name || v.location || null,
            idleDurationMinutes: reportedIdleMinutes ?? derivedIdleMinutes,
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
    const cutoff = dateRange === "all" ? null : new Date();
    if (cutoff) cutoff.setDate(cutoff.getDate() - (dateRange === "today" ? 1 : Number(dateRange)));
    return fleet.filter((vehicle) => {
      const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
      const matchesDepot = depotFilter === "all" || vehicle.depot === depotFilter;
      // TODO: Replace local timestamp filtering with date-scoped getTrips/getBookings calls.
      const updatedAt = recordDate(vehicle.lastUpdated);
      const matchesDate = !cutoff || !updatedAt || updatedAt >= cutoff;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        vehicle.name.toLowerCase().includes(q) ||
        vehicle.id.toLowerCase().includes(q) ||
        vehicle.route.toLowerCase().includes(q) ||
        (vehicle.driver ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesDepot && matchesDate && matchesQuery;
    });
  }, [dateRange, depotFilter, statusFilter, query, fleet]);

  const selectedVehicle = fleet.find((v) => v.id === selectedId) ?? fleet[0] ?? (null as Vehicle | null);
  const depotOptions = Array.from(new Set(fleet.map((vehicle) => vehicle.depot).filter(Boolean))) as string[];

  const totalVehicles = fleet.length;
  const activeCount = fleet.filter((v) => v.status === "active").length;
  const idleCount = fleet.filter((v) => v.status === "idle").length;
  const maintenanceCount = fleet.filter((v) => v.status === "maintenance").length;
  const averageUtilization =
    fleet.length > 0
      ? Math.round((fleet.reduce((sum, v) => sum + v.utilizationPct, 0) / fleet.length) * 10) / 10
      : 0;
  const totalDistanceMi = fleet.reduce((sum, v) => sum + v.distanceTodayMi, 0);
  const selectedUtilizationBand = selectedVehicle
    ? selectedVehicle.utilizationPct >= 80
      ? "High utilization"
      : selectedVehicle.utilizationPct >= 40
        ? "Balanced utilization"
        : "Low utilization"
    : "Low utilization";
  const selectedTrend = selectedVehicle?.utilizationTrend?.length
    ? selectedVehicle.utilizationTrend
    : Array(7).fill(selectedVehicle?.utilizationPct ?? 0);
  const trendChange = selectedTrend.length > 1
    ? Math.round((selectedTrend[selectedTrend.length - 1] - selectedTrend[0]) * 10) / 10
    : 0;
  const utilizationTone = selectedVehicle?.utilizationPct >= 80
    ? { ring: "#e11d48", dot: "bg-rose-500", label: "Needs attention" }
    : selectedVehicle?.utilizationPct >= 40
      ? { ring: "#d97706", dot: "bg-amber-500", label: "Healthy" }
      : { ring: "#db2777", dot: "bg-pink-500", label: "Low utilization" };
  const fleetUtilizationTrend = Array.from({ length: 7 }, (_, index) => {
    const values = fleet
      .map((vehicle) => vehicle.utilizationTrend?.[index])
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  });
  const typeUtilization = Array.from(fleet.reduce((groups, vehicle) => {
    const type = vehicle.type || "Unknown";
    const group = groups.get(type) ?? { total: 0, count: 0 };
    group.total += vehicle.utilizationPct;
    group.count += 1;
    groups.set(type, group);
    return groups;
  }, new Map<string, { total: number; count: number }>()).entries()).map(([type, group]) => ({ type, value: Math.round(group.total / group.count), count: group.count }));
  const utilizationFlags = fleet.flatMap((vehicle) => {
    const trend = vehicle.utilizationTrend;
    if (hasConsecutiveUtilization(trend, (value) => value >= 80)) return [{ vehicle, kind: "Overworked", tone: "text-rose-600", icon: "priority_high" }];
    if (hasConsecutiveUtilization(trend, (value) => value < 40)) return [{ vehicle, kind: "Underutilized", tone: "text-amber-600", icon: "trending_down" }];
    return [];
  });
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

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-8">
          {[
            { icon: "local_shipping", tag: "Fleet", label: "Total Fleet", value: totalVehicles, valueClass: "text-slate-900" },
            { icon: "alt_route", tag: "Live", label: "On Route", value: activeCount, valueClass: "text-pink-600" },
            { icon: "pause_circle", tag: "Ready", label: "Idle", value: idleCount, valueClass: "text-slate-900" },
            { icon: "build", tag: "Service", label: "Maintenance", value: maintenanceCount, valueClass: "text-rose-500" },
            { icon: "trending_up", tag: "Avg", label: "Avg Utilization", value: `${averageUtilization}%`, valueClass: "text-slate-900" },
            { icon: "inventory_2", tag: "Load", label: "Avg Load Utilization", value: fleet.some((vehicle) => vehicle.loadUtilizationPct != null) ? `${Math.round(fleet.filter((vehicle) => vehicle.loadUtilizationPct != null).reduce((sum, vehicle) => sum + (vehicle.loadUtilizationPct ?? 0), 0) / fleet.filter((vehicle) => vehicle.loadUtilizationPct != null).length)}%` : "No data", valueClass: "text-slate-900" },
            { icon: "package_2", tag: "Today", label: "Deliveries Today", value: fleet.some((vehicle) => vehicle.deliveriesToday != null) ? fleet.reduce((sum, vehicle) => sum + (vehicle.deliveriesToday ?? 0), 0) : "No data", valueClass: "text-slate-900" },
            { icon: "verified", tag: "KPI", label: "On-Time Rate", value: fleet.some((vehicle) => vehicle.onTimeRatePct != null) ? `${Math.round(fleet.filter((vehicle) => vehicle.onTimeRatePct != null).reduce((sum, vehicle) => sum + (vehicle.onTimeRatePct ?? 0), 0) / fleet.filter((vehicle) => vehicle.onTimeRatePct != null).length)}%` : "No data", valueClass: "text-slate-900" },
          ].map((metric) => (
            <div
              key={metric.label}
              role="button"
              tabIndex={0}
              onClick={() => toggleMetricVisibility(metric.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") toggleMetricVisibility(metric.label);
              }}
              className="min-h-28 cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50 transition hover:border-pink-300 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
            >
              <div className="flex items-center justify-between text-pink-700 dark:text-pink-400">
                <span className="material-symbols-outlined text-[20px]">{metric.icon}</span>
                <span className="rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">{metric.tag}</span>
              </div>
              <div className="mt-4">
                <div className={`text-xl font-black leading-none ${metric.valueClass} dark:text-slate-100`}>{hiddenMetricValues.has(metric.label) ? "***" : metric.value}</div>
                <div className="mt-2 text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">{metric.label}</div>
              </div>
            </div>
          ))}

          {predictions.map((prediction) => (
            <div
              key={prediction.label}
              role="button"
              tabIndex={0}
              onClick={() => toggleMetricVisibility(prediction.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") toggleMetricVisibility(prediction.label);
              }}
              className="min-h-28 cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50 transition hover:border-pink-300 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none"
            >
              <div className="flex items-center justify-between text-pink-700 dark:text-pink-400">
                <span className="material-symbols-outlined text-[20px]">{prediction.icon}</span>
                <span className="rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">Metric</span>
              </div>
              <div className="mt-4">
                <div className="text-lg font-black leading-none text-slate-900 dark:text-slate-100">{hiddenMetricValues.has(prediction.label) ? "***" : prediction.value}</div>
                <div className="mt-2 text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">{prediction.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-100/50 dark:border-pink-900/40 dark:bg-slate-900 dark:shadow-none">
            <div className="mb-4 flex items-center justify-between border-b border-pink-100 pb-3 dark:border-pink-900/40">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Fleet performance</p>
                <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">7-Day Utilization Trend</h2>
              </div>
              <span className="material-symbols-outlined text-pink-600">show_chart</span>
            </div>
            <div className="flex h-28 items-end gap-2">
              {fleetUtilizationTrend.map((value, index) => (
                <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{value}%</span>
                  <div className="flex h-16 w-full items-end rounded bg-pink-50 dark:bg-pink-950/20"><div className="w-full rounded bg-pink-500 transition-all" style={{ height: `${Math.max(value ? 8 : 2, value)}%` }} /></div>
                  <span className="text-[9px] font-medium text-slate-400">D-{6 - index}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-100/50 dark:border-pink-900/40 dark:bg-slate-900 dark:shadow-none">
            <div className="mb-4 flex items-center justify-between border-b border-pink-100 pb-3 dark:border-pink-900/40">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Fleet mix</p><h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">By Vehicle Type</h2></div>
              <span className="material-symbols-outlined text-pink-600">category</span>
            </div>
            <div className="space-y-3">
              {typeUtilization.length ? typeUtilization.map((group) => <div key={group.type}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-600 dark:text-slate-300">{group.type} <span className="text-slate-400">({group.count})</span></span><span className="font-bold text-slate-900 dark:text-slate-100">{group.value}%</span></div><UtilizationBar value={group.value} /></div>) : <p className="py-8 text-center text-xs text-slate-400">No vehicle type data</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-100/50 dark:border-pink-900/40 dark:bg-slate-900 dark:shadow-none">
            <div className="mb-4 flex items-center justify-between border-b border-pink-100 pb-3 dark:border-pink-900/40">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-pink-600">Action queue</p><h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">Utilization Flags</h2></div>
              <span className="material-symbols-outlined text-pink-600">notifications_active</span>
            </div>
            <div className="space-y-2">
              {utilizationFlags.length ? utilizationFlags.slice(0, 4).map((flag) => <div key={flag.vehicle.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800"><span className={`material-symbols-outlined text-base ${flag.tone}`}>{flag.icon}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{flag.vehicle.name}</p><p className={`text-[10px] font-semibold ${flag.tone}`}>{flag.kind} · {flag.vehicle.utilizationPct}%</p></div></div>) : <p className="py-8 text-center text-xs text-slate-400">No sustained utilization risks</p>}
            </div>
          </section>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Fleet Table Section */}
          <section className="w-full lg:w-2/3 bg-white rounded-2xl border border-pink-100 shadow-sm shadow-pink-100/50 overflow-hidden flex flex-col dark:bg-slate-900 dark:border-pink-900/40 dark:shadow-none">
            <div className="flex flex-col gap-3 p-4 border-b border-pink-100 bg-rose-50/20 dark:border-pink-900/40 dark:bg-slate-950/30">
              <div className="relative flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vehicle, driver, or route..."
                  className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition dark:bg-slate-900 dark:text-slate-100 dark:border-pink-900/40 dark:placeholder-slate-500 dark:focus:border-pink-500 dark:focus:ring-pink-500/20"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={depotFilter} onChange={(event) => setDepotFilter(event.target.value)} className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-pink-500 dark:border-pink-900/40 dark:bg-slate-900 dark:text-slate-300">
                  <option value="all">All depots</option>
                  {depotOptions.map((depot) => <option key={depot} value={depot}>{depot}</option>)}
                </select>
                <select value={dateRange} onChange={(event) => setDateRange(event.target.value as "all" | "today" | "7" | "30")} className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-pink-500 dark:border-pink-900/40 dark:bg-slate-900 dark:text-slate-300">
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
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
          <aside className="w-full lg:w-1/3 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-100/50 transition duration-200 hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md hover:shadow-pink-100/60 dark:border-pink-900/40 dark:bg-slate-900 dark:shadow-none dark:hover:border-pink-700">
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
              <div className="bg-rose-50/50 p-3.5 rounded-xl border border-pink-100 dark:bg-slate-800/80 dark:border-pink-900/40">
               <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 dark:text-slate-400">Idle duration</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle?.idleDurationMinutes != null ? `${selectedVehicle.idleDurationMinutes} min` : "No data"}</p>
              </div>
            </div>

            <div className="group rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition duration-200 hover:border-pink-200 hover:bg-pink-50/30 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-pink-800 dark:hover:bg-pink-950/20">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">Utilization Health</p>
                <div className="flex items-center gap-2 text-pink-600">
                  <span className="material-symbols-outlined text-lg">arrow_outward</span>
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-full transition duration-200 group-hover:scale-110" style={{ background: `conic-gradient(${utilizationTone.ring} ${selectedVehicle?.utilizationPct ?? 0}%, #e2e8f0 0)` }}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-[9px] font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100">{selectedVehicle ? `${selectedVehicle.utilizationPct}%` : "—"}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-[minmax(130px,0.8fr)_minmax(0,1.2fr)]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Utilization score</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{selectedVehicle ? `${selectedVehicle.utilizationPct}%` : "—"}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300"><span className={`h-2 w-2 rounded-full ${utilizationTone.dot}`} />{selectedVehicle ? utilizationTone.label : "No data"}</span>
                  </div>
                  <p className={`mt-1 text-xs font-semibold ${trendChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{trendChange >= 0 ? "+" : ""}{trendChange}% vs. last week</p>
                  <div className="mt-4 flex h-8 items-end gap-1">
                    {selectedTrend.map((value, index) => <span key={`${value}-${index}`} className="flex-1 rounded-sm bg-pink-400/70" style={{ height: `${Math.max(18, Math.min(100, value))}%` }} />)}
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">7-day trend</p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workload band</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><span className={`h-2 w-2 rounded-full ${utilizationTone.dot}`} />{selectedVehicle ? selectedUtilizationBand : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Distance source</p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{selectedVehicle ? (selectedVehicle.distanceSource === "telemetry" ? "Telemetry" : "Route plan") : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Driver coverage</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><span className={`h-2 w-2 rounded-full ${selectedVehicle?.driver ? "bg-sky-500" : "bg-slate-300"}`} />{selectedVehicle?.driver ? "Assigned" : "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Operational state</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><span className={`h-2 w-2 rounded-full ${selectedVehicle?.status === "active" ? "bg-emerald-500" : selectedVehicle?.status === "maintenance" ? "bg-rose-500" : "bg-slate-300"}`} />{selectedVehicle ? (selectedVehicle.status === "maintenance" ? "Unavailable" : selectedVehicle.status === "active" ? "On route" : "Available") : "—"}</p>
                </div>
              </div>
              </div>
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200">{selectedVehicle?.utilizationPct >= 80 ? "Needs attention" : trendChange > 0 ? "Utilization is improving" : selectedVehicle ? "Utilization is stable" : "Awaiting vehicle data"}</span>{" "}
                {selectedVehicle?.utilizationPct >= 80 ? "Consider redistributing the next assignment to reduce workload pressure." : selectedVehicle ? "Vehicle is currently within a manageable utilization range." : "Select a vehicle to view utilization health."}
              </p>
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
