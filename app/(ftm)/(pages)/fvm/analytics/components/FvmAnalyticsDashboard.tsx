"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Check,
  Clock3,
  Download,
  Gauge,
  Package,
  RefreshCw,
  Route,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlobalFooter from "../../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../../components/global/GlobalNavbar";
import RoleRestricted from "../../../../components/global/RoleRestricted";
import { fetchJson } from "../../../../lib/api";
import { getFleetVehicleStatus, isActiveFleetTrip, isCompletedFleetTrip, isDelayedFleetTrip, type FleetVehicleStatus } from "../../fleetData";
import { calcDelta, dateOf, field, formatCompactNumber, formatHours, formatPercent, getDateValue, getMaintenanceMinutes, getPreviousWindow, getRangeWindow, getTripDistanceKm, getTripDurationMinutes, getTripLoadKg, resolveVehicleId, resolveVehiclePlate, resolveVehicleType, safeNumber, type DateRange, type Row } from "./analyticsUtils";
import SummaryCard from "./SummaryCard";

type VehicleRecord = {
  vehicle: Row;
  status: FleetVehicleStatus;
  activeTrip: Row | null;
};

type DetailRow = {
  id: string;
  plate: string;
  type: string;
  status: string;
  trips: number;
  completedTrips: number;
  distanceKm: number;
  downtimeMinutes: number;
  utilization: number;
  capacityKg: number;
  loadKg: number;
  activeTripId: string | null;
};

const STATUS_COLORS: Record<FleetVehicleStatus, string> = {
  Available: "#10b981",
  "On Trip": "#ec4899",
  "Under Maintenance": "#f59e0b",
  Inactive: "#64748b",
  Unverified: "#94a3b8",
};

const STATUS_SEQUENCE: FleetVehicleStatus[] = ["Available", "On Trip", "Under Maintenance", "Inactive", "Unverified"];

function chartPayloadString(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value: unknown = Reflect.get(payload, key);
  return typeof value === "string" ? value : null;
}

function buildVehicleRows(vehicles: Row[], trips: Row[], maintenance: Row[], relationshipDataReady: boolean): VehicleRecord[] {
  return vehicles.map((vehicle) => ({
    vehicle,
    status: getFleetVehicleStatus(vehicle, trips, maintenance, relationshipDataReady),
    activeTrip: trips.find(
      (trip) => String(field(trip, "vehicle_id", "vehicleId") || "") === String(resolveVehicleId(vehicle)) && isActiveFleetTrip(trip),
    ) || null,
  }));
}

function toMetricValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

export default function FvmAnalyticsDashboard() {
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [trips, setTrips] = useState<Row[]>([]);
  const [maintenance, setMaintenance] = useState<Row[]>([]);
  const [relationshipDataReady, setRelationshipDataReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<FleetVehicleStatus | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<"completed" | "delayed" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof DetailRow>("utilization");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      fetchJson("/api/dashboard", { cache: "no-store" }),
      fetchJson("/api/maintenance", { cache: "no-store" }),
    ]);

    const dashboardResult = results[0];
    const maintenanceResult = results[1];

    if (dashboardResult.status === "rejected") {
      setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Fleet analytics data is unavailable.");
    }

    const snapshot = dashboardResult.status === "fulfilled" ? (dashboardResult.value as Row) : null;
    const nextVehicles = snapshot && Array.isArray(snapshot.vehicles) ? (snapshot.vehicles as Row[]) : [];
    const nextTrips = snapshot && Array.isArray(snapshot.trips) ? (snapshot.trips as Row[]) : [];
    const nextMaintenance = maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value) ? (maintenanceResult.value as Row[]) : [];

    setVehicles(nextVehicles);
    setTrips(nextTrips);
    setMaintenance(nextMaintenance);
    setRelationshipDataReady(Boolean(snapshot && Array.isArray(snapshot.trips) && maintenanceResult.status === "fulfilled"));
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setUpdatedAt(new Date().toISOString());
      void loadData();
    }, 0);
    const timer = window.setInterval(() => void loadData(true), 30_000);
    const source = new EventSource("/api/events/assignments");
    let refreshTimer = 0;
    const refreshSoon = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadData(true), 400);
    };

    source.addEventListener("assignment", refreshSoon);
    source.addEventListener("tracking", refreshSoon);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      source.close();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [loadData]);

  const now = updatedAt ? new Date(updatedAt).getTime() : 0;
  const currentWindow = useMemo(() => getRangeWindow(range, customFrom, customTo, now), [range, customFrom, customTo, now]);
  const previousWindow = useMemo(() => getPreviousWindow(range, customFrom, customTo, now), [range, customFrom, customTo, now]);

  const vehicleRows = useMemo(() => buildVehicleRows(vehicles, trips, maintenance, relationshipDataReady), [vehicles, trips, maintenance, relationshipDataReady]);

  const filteredVehicleRows = useMemo(() => {
    return vehicleRows.filter((row) => {
      const selectedId = resolveVehicleId(row.vehicle);
      if (vehicleFilter !== "all" && selectedId !== vehicleFilter) return false;
      return !selectedStatus || row.status === selectedStatus;
    });
  }, [vehicleRows, vehicleFilter, selectedStatus]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const linkedVehicle = String(field(trip, "vehicle_id", "vehicleId") || "");
      if (vehicleFilter !== "all" && linkedVehicle !== vehicleFilter) return false;

      const tripDate = dateOf(trip);
      if (!tripDate) return false;
      if (selectedDate) return tripDate.toISOString().slice(0, 10) === selectedDate;
      return tripDate >= currentWindow.start && tripDate <= currentWindow.end;
    });
  }, [trips, vehicleFilter, selectedDate, currentWindow]);

  const previousTrips = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = dateOf(trip);
      if (!tripDate) return false;
      return tripDate >= previousWindow.start && tripDate <= previousWindow.end;
    });
  }, [trips, previousWindow]);

  const completedTrips = useMemo(() => filteredTrips.filter(isCompletedFleetTrip), [filteredTrips]);
  const delayedTrips = useMemo(() => filteredTrips.filter((trip) => isDelayedFleetTrip(trip, now)), [filteredTrips, now]);
  const activeTrips = useMemo(() => filteredTrips.filter(isActiveFleetTrip), [filteredTrips]);

  const availableOperatingMinutesPerVehicle = useMemo(() => {
    const hours = (currentWindow.end.getTime() - currentWindow.start.getTime()) / 36_000_000;
    return Math.max(hours * 12 * 60, 0);
  }, [currentWindow]);

  const baselineUtilization = useMemo(() => {
    if (previousTrips.length === 0) return 0;
    const previousTripMinutes = previousTrips.reduce((sum, trip) => sum + getTripDurationMinutes(trip), 0);
    const previousVehicleCount = Math.max(vehicles.length, 1);
    const previousMinutes = previousVehicleCount * 12 * 60 * Math.max((previousWindow.end.getTime() - previousWindow.start.getTime()) / 36_000_000, 1);
    return previousMinutes > 0 ? Math.min((previousTripMinutes / previousMinutes) * 100, 100) : 0;
  }, [previousTrips, previousWindow, vehicles.length]);

  const utilizationSummary = useMemo(() => {
    const totalAvailableMinutes = Math.max(filteredVehicleRows.length * availableOperatingMinutesPerVehicle, 0);
    const maintenanceMinutes = maintenance.reduce((sum, record) => {
      const vehicleId = String(field(record, "vehicle_id", "vehicleId") || "");
      if (!vehicleId || !filteredVehicleRows.some((row) => resolveVehicleId(row.vehicle) === vehicleId)) return sum;
      const status = String(field(record, "status") || "").toLowerCase();
      if (["completed", "cancelled"].includes(status)) return sum;
      return sum + getMaintenanceMinutes(record);
    }, 0);

    const tripMinutes = filteredTrips.reduce((sum, trip) => sum + getTripDurationMinutes(trip), 0);
    const distanceKm = filteredTrips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0);
    const completedCount = completedTrips.length;
    const delayedCount = delayedTrips.length;
    const totalLoadKg = filteredTrips.reduce((sum, trip) => sum + getTripLoadKg(trip), 0);
    const capacityKg = filteredVehicleRows.reduce((sum, row) => sum + (safeNumber(field(row.vehicle, "capacity_kg", "capacityKg", "capacity")) ?? 0), 0);
    const availableMinutes = Math.max(totalAvailableMinutes - maintenanceMinutes, 0);
    const timeUtilization = totalAvailableMinutes > 0 ? Math.min((tripMinutes / Math.max(availableMinutes, 1)) * 100, 100) : 0;
    const tripUtilization = filteredVehicleRows.length ? Math.min((filteredTrips.length / filteredVehicleRows.length) * 100, 100) : 0;
    const capacityUtilization = capacityKg > 0 ? Math.min((totalLoadKg / capacityKg) * 100, 100) : 0;

    return {
      totalAvailableMinutes,
      maintenanceMinutes,
      tripMinutes,
      timeUtilization,
      completedCount,
      delayedCount,
      distanceKm,
      tripUtilization,
      capacityUtilization,
      totalTrips: filteredTrips.length,
      averageTripsPerVehicle: filteredVehicleRows.length ? filteredTrips.length / filteredVehicleRows.length : 0,
    };
  }, [filteredVehicleRows, filteredTrips, maintenance, availableOperatingMinutesPerVehicle, completedTrips.length, delayedTrips.length]);

  const statusData = useMemo(() => {
    return STATUS_SEQUENCE.map((status) => ({
      status,
      vehicles: filteredVehicleRows.filter((row) => row.status === status).length,
      fill: STATUS_COLORS[status],
    }));
  }, [filteredVehicleRows]);

  const dailyTrend = useMemo(() => {
    const durationMs = currentWindow.end.getTime() - currentWindow.start.getTime();
    const days = range === "today" ? 1 : range === "custom" ? Math.max(1, Math.ceil(durationMs / 86_400_000) + 1) : range === "7" ? 7 : range === "30" ? 30 : 31;
    const buckets = new Map<string, { date: string; label: string; completed: number; delayed: number; distance: number; utilization: number }>();

    for (let index = 0; index < days; index += 1) {
      const day = new Date(currentWindow.start);
      day.setDate(day.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, label: day.toLocaleDateString("en-PH", { month: "short", day: "numeric" }), completed: 0, delayed: 0, distance: 0, utilization: 0 });
    }

    filteredTrips.forEach((trip) => {
      const tripDate = dateOf(trip);
      if (!tripDate) return;
      const key = tripDate.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.completed += isCompletedFleetTrip(trip) ? 1 : 0;
      bucket.delayed += isDelayedFleetTrip(trip, now) ? 1 : 0;
      bucket.distance += getTripDistanceKm(trip);
      bucket.utilization += getTripDurationMinutes(trip);
    });

    return [...buckets.values()];
  }, [filteredTrips, currentWindow, range, now]);

  const maintenanceTrend = useMemo(() => {
    const durationMs = currentWindow.end.getTime() - currentWindow.start.getTime();
    const days = range === "today" ? 1 : range === "custom" ? Math.max(1, Math.ceil(durationMs / 86_400_000) + 1) : range === "7" ? 7 : range === "30" ? 30 : 31;
    const buckets = new Map<string, number>();

    for (let index = 0; index < days; index += 1) {
      const day = new Date(currentWindow.start);
      day.setDate(day.getDate() + index);
      buckets.set(day.toISOString().slice(0, 10), 0);
    }

    maintenance.forEach((record) => {
      const status = String(field(record, "status") || "").toLowerCase();
      if (["completed", "cancelled"].includes(status)) return;
      const startDate = getDateValue(record, ["scheduled_at", "scheduledAt", "started_at", "startedAt"]);
      const endDate = getDateValue(record, ["performed_at", "performedAt", "completed_at", "completedAt", "finished_at", "finishedAt"]);
      if (!startDate || !endDate) return;
      const key = startDate.toISOString().slice(0, 10);
      if (!buckets.has(key)) return;
      buckets.set(key, buckets.get(key)! + getMaintenanceMinutes(record) / 60);
    });

    return [...buckets.entries()].map(([date, hours]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      hours,
    }));
  }, [maintenance, currentWindow, range]);

  const utilizationRows = useMemo<DetailRow[]>(() => {
    return filteredVehicleRows.map((row) => {
      const vehicleId = resolveVehicleId(row.vehicle);
      const vehicleTrips = filteredTrips.filter((trip) => String(field(trip, "vehicle_id", "vehicleId") || "") === vehicleId);
      const tripMinutes = vehicleTrips.reduce((sum, trip) => sum + getTripDurationMinutes(trip), 0);
      const distanceKm = vehicleTrips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0);
      const loadKg = vehicleTrips.reduce((sum, trip) => sum + getTripLoadKg(trip), 0);
      const capacityKg = safeNumber(field(row.vehicle, "capacity_kg", "capacityKg", "capacity")) ?? 0;
      const downtimeMinutes = maintenance.reduce((sum, record) => {
        const recordVehicleId = String(field(record, "vehicle_id", "vehicleId") || "");
        if (recordVehicleId !== vehicleId) return sum;
        const status = String(field(record, "status") || "").toLowerCase();
        if (["completed", "cancelled"].includes(status)) return sum;
        return sum + getMaintenanceMinutes(record);
      }, 0);
      const hoursAvailable = Math.max(availableOperatingMinutesPerVehicle / 60, 0);
      const utilization = hoursAvailable > 0 ? Math.min((tripMinutes / Math.max(hoursAvailable * 60 - downtimeMinutes, 1)) * 100, 100) : 0;

      return {
        id: vehicleId,
        plate: resolveVehiclePlate(row.vehicle),
        type: resolveVehicleType(row.vehicle),
        status: row.status,
        trips: vehicleTrips.length,
        completedTrips: vehicleTrips.filter(isCompletedFleetTrip).length,
        distanceKm,
        downtimeMinutes,
        utilization,
        capacityKg,
        loadKg,
        activeTripId: row.activeTrip ? String(field(row.activeTrip, "id") || "") : null,
      };
    });
  }, [filteredVehicleRows, filteredTrips, maintenance, availableOperatingMinutesPerVehicle]);

  const rankedRows = useMemo(() => [...utilizationRows].sort((left, right) => right.utilization - left.utilization), [utilizationRows]);
  const utilizationByVehicle = useMemo(() => rankedRows.slice(0, 8).map((row) => ({ vehicle: row.plate, utilization: Number(row.utilization.toFixed(1)), trips: row.trips, distance: row.distanceKm })), [rankedRows]);

  const metricCards = useMemo(
    () => [
      { key: "vehicles", label: "Vehicles", value: `${filteredVehicleRows.length}`, icon: Truck, tone: "bg-pink-50 text-pink-700", delta: calcDelta(filteredVehicleRows.length, Math.max(vehicles.length - filteredVehicleRows.length, 0)) },
      { key: "utilization", label: "Utilization", value: `${utilizationSummary.timeUtilization.toFixed(1)}%`, icon: Gauge, tone: "bg-rose-50 text-rose-700", delta: calcDelta(utilizationSummary.timeUtilization, baselineUtilization) },
      { key: "completed", label: "Completed trips", value: `${utilizationSummary.completedCount}`, icon: Check, tone: "bg-emerald-50 text-emerald-700", delta: calcDelta(utilizationSummary.completedCount, Math.max(previousTrips.filter(isCompletedFleetTrip).length, 0)) },
      { key: "delayed", label: "Delayed trips", value: `${utilizationSummary.delayedCount}`, icon: AlertTriangle, tone: "bg-amber-50 text-amber-700", delta: calcDelta(utilizationSummary.delayedCount, Math.max(previousTrips.filter((trip) => isDelayedFleetTrip(trip, now)).length, 0)) },
      { key: "distance", label: "Distance", value: `${formatCompactNumber(utilizationSummary.distanceKm, " km")}`, icon: Route, tone: "bg-sky-50 text-sky-700", delta: calcDelta(utilizationSummary.distanceKm, previousTrips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0)) },
      { key: "downtime", label: "Downtime", value: `${formatHours(utilizationSummary.maintenanceMinutes / 60)}`, icon: Wrench, tone: "bg-amber-50 text-amber-700", delta: calcDelta(utilizationSummary.maintenanceMinutes / 60, previousWindow ? previousTrips.reduce((sum, trip) => sum + 0, 0) : 0) },
      { key: "trips-per-vehicle", label: "Trips / vehicle", value: `${utilizationSummary.averageTripsPerVehicle.toFixed(1)}`, icon: Clock3, tone: "bg-violet-50 text-violet-700", delta: null },
    ],
    [filteredVehicleRows.length, vehicles.length, utilizationSummary, baselineUtilization, previousTrips, now, previousWindow]);

  const tableRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...rankedRows]
      .filter((row) => !term || row.plate.toLowerCase().includes(term) || row.type.toLowerCase().includes(term) || row.status.toLowerCase().includes(term))
      .sort((left, right) => {
        switch (sortKey) {
          case "distanceKm": return right.distanceKm - left.distanceKm;
          case "trips": return right.trips - left.trips;
          case "completedTrips": return right.completedTrips - left.completedTrips;
          case "downtimeMinutes": return right.downtimeMinutes - left.downtimeMinutes;
          case "capacityKg": return right.capacityKg - left.capacityKg;
          default: return right.utilization - left.utilization;
        }
      });
  }, [rankedRows, sortKey, query]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const pagedRows = tableRows.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    if (!tableRows.length) return;
    const headers = ["plate", "type", "status", "utilization_pct", "trips", "completed_trips", "distance_km", "downtime_hours", "capacity_kg", "load_kg"];
    const csv = [headers, ...tableRows.map((row) => headers.map((column) => ({
      plate: row.plate,
      type: row.type,
      status: row.status,
      utilization_pct: row.utilization,
      trips: row.trips,
      completed_trips: row.completedTrips,
      distance_km: row.distanceKm,
      downtime_hours: row.downtimeMinutes / 60,
      capacity_kg: row.capacityKg,
      load_kg: row.loadKg,
    }[column] ?? "")))]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fleet-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const detailVehicle = selectedVehicleId ? rankedRows.find((row) => row.id === selectedVehicleId) ?? null : null;
  const emptyState = !loading && (!vehicles.length || !filteredTrips.length || !filteredVehicleRows.length);

  function clearSelection() {
    setSelectedVehicleId(null);
    setSelectedStatus(null);
    setSelectedOutcome(null);
    setSelectedDate(null);
  }

  return (
    <RoleRestricted permission={{ module: "fvm", action: "view" }} hideWhenRestricted>
      <div className="fvm-page-shell min-h-screen bg-[#fffafc] text-slate-800">
        <GlobalNavbar />
        <main className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <header className="fvm-panel rounded-[30px] border border-pink-100 bg-white/80 p-4 shadow-[0_20px_60px_rgba(244,114,182,0.08)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-700">FVM · Analytics</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Fleet intelligence dashboard</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">Track utilization, compare performance, and surface downtime issues from actual vehicle, trip, cargo, GPS, and maintenance records.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
                <div className="rounded-full border border-pink-200 bg-pink-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-pink-700">
                  Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </div>
                <button type="button" onClick={() => void loadData(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-pink-50 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-pink-100 bg-pink-50/60 p-3">
              <div className="flex flex-wrap gap-2">
                {(["today", "7", "30", "month"] as DateRange[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    className={`rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition ${range === option ? "bg-pink-600 text-white shadow-md" : "bg-white text-slate-600 hover:bg-pink-100"}`}
                  >
                    {option === "today" ? "Today" : option === "7" ? "Last 7 days" : option === "30" ? "Last 30 days" : "This month"}
                  </button>
                ))}
                <button type="button" onClick={() => setRange("custom")} className={`rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition ${range === "custom" ? "bg-pink-600 text-white shadow-md" : "bg-white text-slate-600 hover:bg-pink-100"}`}>
                  Custom
                </button>
              </div>

              {range === "custom" && (
                <>
                  <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500">
                    From
                    <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-md border border-pink-100 bg-white px-2 py-1 text-slate-700 outline-none" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500">
                    To
                    <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="rounded-md border border-pink-100 bg-white px-2 py-1 text-slate-700 outline-none" />
                  </label>
                </>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 font-semibold">
                  <Truck className="h-3.5 w-3.5 text-pink-600" />
                  <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} className="bg-transparent outline-none">
                    <option value="all">All vehicles</option>
                    {vehicles.map((vehicle) => (
                      <option key={String(resolveVehicleId(vehicle))} value={String(resolveVehicleId(vehicle))}>
                        {resolveVehiclePlate(vehicle)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </header>

          {error && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <button type="button" onClick={() => void loadData()} className="font-bold underline">Retry</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-[22px] bg-pink-100" />
              ))}
            </div>
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                {metricCards.map((card) => (
                  <button key={card.key} type="button" onClick={() => setSelectedStatus(card.key === "vehicles" ? null : null)} className="text-left">
                    <SummaryCard label={card.label} value={card.value} icon={card.icon} tone={card.tone} delta={card.delta} />
                  </button>
                ))}
              </section>

              {emptyState ? (
                <div className="rounded-[26px] border border-pink-100 bg-white p-6 text-center text-sm text-slate-600 shadow-[0_16px_42px_rgba(15,23,42,0.03)]">
                  No fleet analytics records are available for the selected date range or vehicle filter.
                </div>
              ) : (
                <>
                  <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-700">Vehicle utilization</p>
                          <h2 className="mt-1 text-xl font-black text-slate-900">Operating efficiency</h2>
                        </div>
                        <div className="rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-pink-700">
                          Formula: trip minutes ÷ available minutes
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-pink-50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Utilization</div>
                          <div className="mt-2 text-3xl font-black text-slate-900">{formatPercent(utilizationSummary.timeUtilization)}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Trip time</div>
                          <div className="mt-2 text-2xl font-black text-slate-900">{formatHours(utilizationSummary.tripMinutes / 60)}</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Distance</div>
                          <div className="mt-2 text-2xl font-black text-slate-900">{formatCompactNumber(utilizationSummary.distanceKm, " km")}</div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-pink-100 bg-slate-50/80 p-4 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Current calculation</span>
                          <span className="text-[10px] text-slate-500">{formatHours(utilizationSummary.tripMinutes / 60)} ÷ {formatHours(utilizationSummary.totalAvailableMinutes / 60)} available</span>
                        </div>
                        <p className="mt-2">
                          {formatCompactNumber(utilizationSummary.tripMinutes / 60, " hours")} of active trip time across {filteredVehicleRows.length || 0} vehicles, with {formatHours(utilizationSummary.maintenanceMinutes / 60)} recorded downtime in the same reporting window.
                        </p>
                      </div>

                      <div className="mt-5 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: "Trip time", value: utilizationSummary.tripMinutes / 60, fill: "#ec4899" },
                            { name: "Downtime", value: utilizationSummary.maintenanceMinutes / 60, fill: "#f59e0b" },
                            { name: "Idle time", value: Math.max((utilizationSummary.totalAvailableMinutes - utilizationSummary.tripMinutes - utilizationSummary.maintenanceMinutes) / 60, 0), fill: "#e2e8f0" },
                          ]}>
                            <CartesianGrid stroke="#fce7f3" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(1)}h`} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                              {["#ec4899", "#f59e0b", "#e2e8f0"].map((fill, index) => <Cell key={index} fill={fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-pink-700">Fleet status</p>
                          <h2 className="mt-1 text-lg font-black text-slate-900">Vehicle distribution</h2>
                        </div>
                        <CalendarRange className="h-4 w-4 text-pink-700" />
                      </div>

                      <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={statusData} dataKey="vehicles" nameKey="status" innerRadius={54} outerRadius={84} paddingAngle={2}>
                              {statusData.map((item) => <Cell key={item.status} fill={item.fill} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-2 space-y-2 text-[10px] text-slate-600">
                        {statusData.map((item) => (
                          <div key={item.status} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />{item.status}</span>
                            <span className="font-bold text-slate-800">{item.vehicles}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </section>

                  <section className="grid gap-4 xl:grid-cols-2">
                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-700">Trend</p>
                          <h2 className="mt-1 text-lg font-black text-slate-900">Performance over time</h2>
                        </div>
                        <Activity className="h-4 w-4 text-pink-700" />
                      </div>
                      <div className="mt-4 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dailyTrend}>
                            <defs>
                              <linearGradient id="utilPink" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#f472b6" stopOpacity={0.45} />
                                <stop offset="100%" stopColor="#f472b6" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#fce7f3" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="completed" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                            <Area type="monotone" dataKey="delayed" stroke="#ec4899" fill="url(#utilPink)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-700">Maintenance</p>
                          <h2 className="mt-1 text-lg font-black text-slate-900">Downtime overview</h2>
                        </div>
                        <Wrench className="h-4 w-4 text-pink-700" />
                      </div>
                      <div className="mt-4 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={maintenanceTrend}>
                            <CartesianGrid stroke="#fce7f3" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(1)}h`} />
                            <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                  </section>

                  <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-700">Comparisons</p>
                          <h2 className="mt-1 text-lg font-black text-slate-900">Vehicle rankings</h2>
                        </div>
                        <ArrowRight className="h-4 w-4 text-pink-700" />
                      </div>

                      <div className="mt-4 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={utilizationByVehicle} layout="vertical" margin={{ left: 14, right: 10 }}>
                            <CartesianGrid stroke="#fce7f3" strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="vehicle" width={76} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`} />
                            <Bar dataKey="utilization" radius={[0, 8, 8, 0]} fill="#ec4899" onClick={(entry) => {
                              const vehicle = chartPayloadString(entry.payload, "vehicle");
                              setSelectedVehicleId(vehicle ? rankedRows.find((row) => row.plate === vehicle)?.id ?? null : null);
                            }} cursor="pointer" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="rounded-[26px] border border-pink-100 bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.03)] sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-700">Insights</p>
                          <h2 className="mt-1 text-lg font-black text-slate-900">Operational signals</h2>
                        </div>
                        <Package className="h-4 w-4 text-pink-700" />
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        {rankedRows.length > 0 && (
                          <>
                            {rankedRows[0] && rankedRows[0].utilization >= 80 && (
                              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
                                <span className="font-black">High utilization:</span> {rankedRows[0].plate} is above 80% utilization and may need additional route balancing or maintenance planning.
                              </div>
                            )}
                            {rankedRows[rankedRows.length - 1] && rankedRows[rankedRows.length - 1].utilization <= 25 && (
                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                                <span className="font-black">Underused asset:</span> {rankedRows[rankedRows.length - 1].plate} remains below 25% utilization and may warrant reallocation or scheduling review.
                              </div>
                            )}
                          </>
                        )}
                        {utilizationSummary.delayedCount > 0 && (
                          <div className="rounded-2xl border border-pink-200 bg-pink-50 p-3 text-pink-800">
                            <span className="font-black">Delivery pressure:</span> {utilizationSummary.delayedCount} delayed trips are affecting service consistency. Review active assignments and ETA thresholds.
                          </div>
                        )}
                        {utilizationSummary.maintenanceMinutes > 0 && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                            <span className="font-black">Maintenance load:</span> {formatHours(utilizationSummary.maintenanceMinutes / 60)} of downtime has been recorded, reducing available operating time during this window.
                          </div>
                        )}
                        {utilizationSummary.capacityUtilization > 0 && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                            <span className="font-black">Cargo utilization:</span> {formatPercent(utilizationSummary.capacityUtilization)} of fleet cargo capacity is being utilized based on recorded load values.
                          </div>
                        )}
                      </div>
                    </article>
                  </section>

                  <section className="overflow-hidden rounded-[28px] border border-pink-100 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.03)]">
                    <div className="flex flex-col gap-3 border-b border-pink-100 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pink-700">Detailed analytics</p>
                        <h2 className="mt-1 text-lg font-black text-slate-900">Vehicle utilization table</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-[10px] font-bold text-slate-600">
                          <Search className="h-3.5 w-3.5 text-pink-700" />
                          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search vehicle" className="w-36 bg-transparent text-slate-700 outline-none placeholder:text-slate-400" />
                        </label>
                        <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                          <Download className="h-3.5 w-3.5" /> Export
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left text-xs">
                        <thead className="bg-pink-50/70 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                          <tr>
                            {[
                              ["plate", "Vehicle"],
                              ["type", "Type"],
                              ["status", "Status"],
                              ["utilization", "Utilization"],
                              ["trips", "Trips"],
                              ["completedTrips", "Completed"],
                              ["distanceKm", "Distance"],
                              ["downtimeMinutes", "Downtime"],
                              ["capacityKg", "Capacity"],
                            ].map(([key, label]) => (
                              <th key={key} className="px-3 py-3">
                                <button type="button" onClick={() => { setSortKey(key as keyof DetailRow); setPage(1); }} className="font-black">
                                  {label}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-100">
                          {pagedRows.length ? pagedRows.map((row) => (
                            <tr key={row.id} className="cursor-pointer transition hover:bg-pink-50/60" onClick={() => setSelectedVehicleId(row.id)}>
                              <td className="px-3 py-3 font-mono font-black text-pink-700">{row.plate}</td>
                              <td className="px-3 py-3">{row.type}</td>
                              <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{row.status}</span></td>
                              <td className="px-3 py-3 font-black text-slate-900">{formatPercent(row.utilization)}</td>
                              <td className="px-3 py-3">{row.trips}</td>
                              <td className="px-3 py-3">{row.completedTrips}</td>
                              <td className="px-3 py-3">{formatCompactNumber(row.distanceKm, " km")}</td>
                              <td className="px-3 py-3">{row.downtimeMinutes > 0 ? formatHours(row.downtimeMinutes / 60) : "—"}</td>
                              <td className="px-3 py-3">{row.capacityKg > 0 ? formatCompactNumber(row.capacityKg, " kg") : "—"}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">No vehicle data matches the current filter combination.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pink-100 p-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Page {page} of {totalPages}</div>
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-pink-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-50">Previous</button>
                        <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-pink-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                          {[5, 8, 12, 20].map((size) => <option key={size} value={size}>{size} per page</option>)}
                        </select>
                        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-pink-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-50">Next</button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <GlobalFooter />

        {detailVehicle && (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedVehicleId(null); }}>
            <section role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-[28px] border border-pink-100 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
              <header className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pink-700">Vehicle detail</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-900">{detailVehicle.plate}</h3>
                </div>
                <button type="button" onClick={() => setSelectedVehicleId(null)} className="rounded-full border border-pink-200 bg-pink-50 px-2 py-1 text-slate-700">×</button>
              </header>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-pink-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Type</p>
                  <p className="mt-2 text-lg font-black">{detailVehicle.type}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Status</p>
                  <p className="mt-2 text-lg font-black">{detailVehicle.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Utilization</p>
                  <p className="mt-2 text-lg font-black">{formatPercent(detailVehicle.utilization)}</p>
                </div>
                <div className="rounded-2xl bg-pink-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Trips</p>
                  <p className="mt-2 text-lg font-black">{detailVehicle.trips}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-pink-50 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Trip id</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Distance</th>
                      <th className="px-3 py-2">Load</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-100">
                    {filteredTrips.filter((trip) => String(field(trip, "vehicle_id", "vehicleId") || "") === detailVehicle.id).slice(0, 8).map((trip, index) => (
                      <tr key={String(field(trip, "id") || index)}>
                        <td className="px-3 py-2 font-mono font-black text-pink-700">{String(field(trip, "id") || "Trip")}</td>
                        <td className="px-3 py-2">{String(field(trip, "status") || "Unknown")}</td>
                        <td className="px-3 py-2">{formatCompactNumber(getTripDistanceKm(trip), " km")}</td>
                        <td className="px-3 py-2">{getTripLoadKg(trip) > 0 ? `${formatCompactNumber(getTripLoadKg(trip), " kg")}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </RoleRestricted>
  );
}
