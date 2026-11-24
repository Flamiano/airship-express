"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import {
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
import GlobalFooter from "../../components/global/GlobalFooter";
import GlobalNavbar from "../../components/global/GlobalNavbar";
import RoleRestricted from "../../components/global/RoleRestricted";
import { fetchJson } from "../../lib/api";
import { getCurrentRole, hasAppPermission } from "../../lib/roleAccess";
import { getFleetVehicleStatus, type FleetVehicleStatus } from "./fleetData";

type Row = Record<string, unknown>;
type Range = "7" | "30" | "90";
type SourceState = { vehicles: boolean; trips: boolean; maintenance: boolean };
type VehicleRow = { vehicle: Row; id: string; status: FleetVehicleStatus };

const STATUS_COLORS: Record<FleetVehicleStatus, string> = {
  Available: "#16a36a",
  "On Trip": "#cf2870",
  "Under Maintenance": "#e49a26",
  Inactive: "#68758b",
  Unverified: "#aab3c2",
};

function field(record: Row | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value != null && String(value).trim() !== "") return value;
  }
  return null;
}

function text(value: unknown) {
  return value == null || String(value).trim() === "" ? null : String(value).trim();
}

function dateOf(record: Row, keys: string[]) {
  const value = field(record, ...keys);
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function rangeStart(range: Range, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(range) + 1);
  return start;
}

function formatDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" })
    : null;
}

function vehicleId(vehicle: Row) {
  return String(field(vehicle, "id", "vehicle_id") ?? "");
}

function vehicleLabel(vehicle: Row) {
  return text(field(vehicle, "plate_number", "plateNumber", "registration_number")) || vehicleId(vehicle) || "Vehicle";
}

function vehicleType(vehicle: Row) {
  return text(field(vehicle, "vehicle_type", "vehicleType", "type"));
}

function tripDate(trip: Row) {
  return dateOf(trip, ["actual_arrival", "delivered_at", "completed_at", "updated_at", "updatedAt", "created_at", "createdAt"]);
}

function MaintenanceDate({ value }: { value: unknown }) {
  const date = formatDate(value);
  return date ? <>{date}</> : null;
}

function Metric({ label, value, note, icon: Icon, accent }: {
  label: string;
  value: number | string;
  note?: string;
  icon: typeof Truck;
  accent: string;
}) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,0.035)]">
    <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent}`}><Icon className="h-4 w-4" aria-hidden="true" /></span></div>
    <p className="mt-3 text-2xl font-black tabular-nums text-[#17253b]">{value}</p>
    {note && <p className="mt-1 text-[10px] leading-4 text-slate-500">{note}</p>}
  </article>;
}

function Panel({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,0.035)] sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-[#17253b]">{title}</h2>{subtitle && <p className="mt-1 text-[10px] leading-4 text-slate-500">{subtitle}</p>}</div>{action}</div>
    {children}
  </section>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-[210px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center text-[11px] text-slate-500">{message}</div>;
}

export default function FvmWorkspace() {
  const [role, setRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [trips, setTrips] = useState<Row[]>([]);
  const [maintenance, setMaintenance] = useState<Row[]>([]);
  const [sources, setSources] = useState<SourceState>({ vehicles: false, trips: false, maintenance: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [range, setRange] = useState<Range>("30");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState<Row | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setRole(getCurrentRole()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const canCreate = hasAppPermission(role, "fvm", "create");
  const canAssign = hasAppPermission(role, "vrds", "update");

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    const results = await Promise.allSettled([
      fetchJson("/api/vehicles?include_assignments=true", { cache: "no-store" }),
      fetchJson("/api/trips?all=true", { cache: "no-store" }),
      fetchJson("/api/maintenance", { cache: "no-store" }),
    ]);
    const vehicleResult = results[0];
    const tripResult = results[1];
    const maintenanceResult = results[2];
    const nextSources: SourceState = {
      vehicles: vehicleResult.status === "fulfilled" && Array.isArray(vehicleResult.value),
      trips: tripResult.status === "fulfilled" && Array.isArray(tripResult.value),
      maintenance: maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value),
    };
    const nextVehicles = vehicleResult.status === "fulfilled" && Array.isArray(vehicleResult.value) ? vehicleResult.value as Row[] : [];
    const nextTrips = tripResult.status === "fulfilled" && Array.isArray(tripResult.value) ? tripResult.value as Row[] : [];
    const nextMaintenance = maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value) ? maintenanceResult.value as Row[] : [];
    const nextIssues = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        const label = ["Vehicle records", "Trip records", "Maintenance records"][index];
        return [`${label}: ${result.reason instanceof Error ? result.reason.message : "unavailable"}`];
      }
      if (!Array.isArray(result.value)) return [["Vehicle", "Trip", "Maintenance"][index] + " data returned an unexpected format."];
      return [];
    });

    setSources(nextSources);
    setVehicles(nextVehicles);
    setTrips(nextTrips);
    setMaintenance(nextMaintenance);
    setIssues(nextIssues);
    setUpdatedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const interval = window.setInterval(() => void loadData(true), 30_000);
    const source = new EventSource("/api/events/assignments");
    let refreshTimer = 0;
    const refreshSoon = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadData(true), 500);
    };
    source.addEventListener("assignment", refreshSoon);
    source.addEventListener("tracking", refreshSoon);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      source.close();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [loadData]);

  const now = useMemo(() => updatedAt ?? new Date(), [updatedAt]);
  const periodStart = rangeStart(range, now);
  const relationshipsReady = sources.trips && sources.maintenance && vehicles.every((vehicle) => vehicle.trip_data_available !== false);
  const vehicleRows = useMemo<VehicleRow[]>(() => vehicles.map((vehicle) => ({
    vehicle,
    id: vehicleId(vehicle),
    status: getFleetVehicleStatus(vehicle, trips, maintenance, relationshipsReady),
  })), [vehicles, trips, maintenance, relationshipsReady]);

  const periodTrips = useMemo(() => trips.filter((trip) => {
    const date = tripDate(trip);
    return Boolean(date && date >= periodStart && date <= now);
  }), [trips, periodStart, now]);
  const knownVehicleIds = useMemo(() => new Set(vehicles.map(vehicleId).filter(Boolean)), [vehicles]);

  const statusCounts = useMemo(() => vehicleRows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {} as Partial<Record<FleetVehicleStatus, number>>), [vehicleRows]);
  const statusData = useMemo(() => (Object.entries(statusCounts) as Array<[FleetVehicleStatus, number]>)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] })), [statusCounts]);
  const typeData = useMemo(() => {
    const counts = new Map<string, number>();
    vehicles.forEach((vehicle) => {
      const type = vehicleType(vehicle);
      if (type) counts.set(type, (counts.get(type) || 0) + 1);
    });
    return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [vehicles]);
  const activityData = useMemo(() => {
    const counts = new Map<string, number>();
    periodTrips.forEach((trip) => {
      const id = String(field(trip, "vehicle_id", "vehicleId") ?? "");
      if (!id || !knownVehicleIds.has(id)) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return [...counts].map(([id, value]) => ({
      id,
      name: vehicleLabel(vehicles.find((vehicle) => vehicleId(vehicle) === id) || { id }),
      value,
    })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [periodTrips, knownVehicleIds, vehicles]);
  const maintenanceTrend = useMemo(() => {
    const counts = new Map<string, number>();
    maintenance.forEach((record) => {
      if (!/^(completed|complete)$/i.test(String(record.status || ""))) return;
      const date = dateOf(record, ["performed_at"]);
      if (!date || date < periodStart || date > now) return;
      const key = date.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
      date: new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      value,
    }));
  }, [maintenance, periodStart, now]);

  const maintenanceByVehicle = useMemo(() => {
    const rows = new Map<string, Row>();
    maintenance.forEach((record) => {
      const id = String(field(record, "vehicle_id", "vehicleId") ?? "");
      if (!id || !knownVehicleIds.has(id)) return;
      const status = String(record.status || "").toLowerCase();
      if (status && status !== "completed") return;
      const performed = dateOf(record, ["performed_at"]);
      if (!performed) return;
      const current = rows.get(id);
      const currentDate = current ? dateOf(current, ["performed_at"]) : null;
      if (!currentDate || performed > currentDate) rows.set(id, record);
    });
    return rows;
  }, [maintenance, knownVehicleIds]);

  const upcomingVehicles = useMemo(() => {
    const end = new Date(now.getTime() + 30 * 86_400_000);
    const ids = new Set<string>();
    maintenance.forEach((record) => {
      const status = String(record.status || "").toLowerCase();
      if (status === "cancelled") return;
      const id = String(field(record, "vehicle_id", "vehicleId") ?? "");
      if (!knownVehicleIds.has(id)) return;
      const scheduled = dateOf(record, ["scheduled_at"]);
      const nextDue = dateOf(record, ["next_due_date"]);
      const scheduledUpcoming = status !== "completed" && scheduled && scheduled >= now && scheduled <= end;
      const followUpUpcoming = nextDue && nextDue >= now && nextDue <= end;
      if (scheduledUpcoming || followUpUpcoming) ids.add(id);
    });
    return ids.size;
  }, [maintenance, knownVehicleIds, now]);

  const typeOptions = useMemo(() => [...new Set(vehicles.map(vehicleType).filter((value): value is string => Boolean(value)))].sort(), [vehicles]);
  const statusOptions = useMemo(() => [...new Set(vehicleRows.map((row) => row.status))].sort(), [vehicleRows]);
  const filteredRows = useMemo(() => vehicleRows.filter(({ vehicle, status }) => {
    if (statusFilter !== "all" && status !== statusFilter) return false;
    const type = vehicleType(vehicle);
    if (typeFilter !== "all" && type !== typeFilter) return false;
    const haystack = [vehicleLabel(vehicle), vehicle.id, vehicle.manufacturer, vehicle.model, type, vehicle.driver, vehicle.driver_id]
      .map((value) => String(value ?? "").toLowerCase()).join(" ");
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [vehicleRows, statusFilter, typeFilter, query]);

  const operationalCount = statusCounts.Available != null || statusCounts["On Trip"] != null
    ? (statusCounts.Available || 0) + (statusCounts["On Trip"] || 0)
    : null;
  const statusSummaryComplete = relationshipsReady && !statusCounts.Unverified;
  const utilization = sources.vehicles && statusSummaryComplete && vehicles.length
    ? (statusCounts["On Trip"] || 0) / vehicles.length * 100
    : null;
  const hasDriverColumn = sources.vehicles && vehicles.every((vehicle) => vehicle.assignment_data_available !== false)
    && vehicles.some((vehicle) => text(field(vehicle, "driver", "driver_name", "driverName", "driver_id")));
  const hasRegistrationColumn = vehicles.some((vehicle) => text(field(vehicle, "plate_number", "plateNumber", "registration_number")));
  const hasTypeColumn = vehicles.some((vehicle) => vehicleType(vehicle));
  const hasStatusColumn = relationshipsReady;
  const hasMaintenanceColumn = sources.maintenance && [...maintenanceByVehicle.values()].length > 0;

  const selectStatus = (status: string) => setStatusFilter((current) => current === status ? "all" : status);
  const statusChart = <div className="h-[218px]">
    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2} onClick={(entry) => selectStatus(String(entry.name))} className="cursor-pointer">{statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} stroke="white" strokeWidth={2} />)}</Pie><Tooltip formatter={(value) => [value, "Vehicles"]} /></PieChart></ResponsiveContainer>
    <div className="-mt-[178px] pointer-events-none text-center"><p className="text-2xl font-black text-slate-900">{vehicles.length}</p><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Vehicles</p></div>
  </div>;

  return <RoleRestricted permission={{ module: "fvm", action: "view" }} hideWhenRestricted>
    <div className="fvm-page-shell flex min-h-screen flex-col bg-[#fffafd] text-slate-800"><GlobalNavbar />
      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-xl border border-pink-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-pink-700">Fleet & Vehicle Management</p><h1 className="mt-1 text-2xl font-black text-[#17253b]">Fleet overview</h1><p className="mt-1 text-xs text-slate-500">Live vehicle records, assignments, and maintenance activity.{updatedAt && <span> Updated {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative"><span className="sr-only">Activity date range</span><CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-pink-700" /><select value={range} onChange={(event) => setRange(event.target.value as Range)} className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-[11px] font-semibold text-slate-700 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /></label>
            <button type="button" onClick={() => void loadData(true)} disabled={refreshing} aria-label="Refresh fleet data" title="Refresh fleet data" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-pink-300 hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
            {canCreate && <a href="/fvm/inventory" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#c2185b] px-3 text-[11px] font-bold text-white transition hover:bg-[#a9134d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2"><Plus className="h-3.5 w-3.5" />Add vehicle</a>}
          </div>
        </header>

        {issues.length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">Some fleet data could not be verified. Affected metrics and fields are hidden. {issues.join(" · ")}</div>}

        {loading ? <section aria-label="Loading fleet overview" className="grid grid-cols-2 gap-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-[105px] animate-pulse rounded-xl border border-pink-100 bg-white" />)}</section> : <>
          {sources.vehicles && <section aria-label="Fleet key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label="Total vehicles" value={vehicles.length} note="Distinct registered vehicle records" icon={Truck} accent="bg-pink-50 text-pink-700" />
            {statusSummaryComplete && operationalCount != null && <Metric label="Active vehicles" value={operationalCount} note="Available or currently on trip" icon={Activity} accent="bg-emerald-50 text-emerald-700" />}
            {statusSummaryComplete && statusCounts["Under Maintenance"] != null && <Metric label="In maintenance" value={statusCounts["Under Maintenance"]} icon={Wrench} accent="bg-amber-50 text-amber-700" />}
            {statusSummaryComplete && statusCounts.Available != null && <Metric label="Available vehicles" value={statusCounts.Available} icon={Check} accent="bg-emerald-50 text-emerald-700" />}
            {utilization != null && <Metric label="Fleet utilization" value={`${utilization.toFixed(1)}%`} note={`${statusCounts["On Trip"] || 0} of ${vehicles.length} distinct vehicles currently on a trip`} icon={Activity} accent="bg-sky-50 text-sky-700" />}
            {sources.maintenance && <Metric label="Upcoming maintenance" value={upcomingVehicles} note="Vehicles due within 30 days" icon={CalendarDays} accent="bg-orange-50 text-orange-700" />}
          </section>}

          {!sources.vehicles && <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><Truck className="mx-auto h-7 w-7 text-slate-300" /><h2 className="mt-2 text-sm font-bold text-slate-800">Fleet records unavailable</h2><p className="mt-1 text-xs text-slate-500">Vehicle data could not be loaded. Refresh to try again.</p></section>}

          {sources.vehicles && vehicles.length > 0 && <>
            <section aria-label="Fleet charts" className="grid gap-3 xl:grid-cols-2">
              {relationshipsReady && <Panel title="Vehicle status" subtitle="Current state derived from vehicle, trip, and maintenance records.">
                {statusData.length ? <div className="grid items-center gap-2 sm:grid-cols-[minmax(180px,0.9fr)_1fr]">{statusChart}<div className="space-y-2">{statusData.map((entry) => <button key={entry.name} type="button" onClick={() => selectStatus(entry.name)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[11px] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 ${statusFilter === entry.name ? "bg-pink-50" : ""}`}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />{entry.name}</span><strong className="tabular-nums text-slate-800">{entry.value}</strong></button>)}</div></div> : <EmptyChart message="No vehicle status records are available." />}
              </Panel>}

              {sources.trips && <Panel title="Trip activity by vehicle" subtitle={`Linked trip records in the last ${range} days, grouped by distinct vehicle.`}>
                {activityData.length ? <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}><CartesianGrid stroke="#edf0f4" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [value, "Trips"]} /><Bar dataKey="value" name="Trips" fill="#c2185b" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyChart message="No linked vehicle trips were recorded in this date range." />}
              </Panel>}

              {sources.maintenance && <Panel title="Maintenance trend" subtitle={`Completed maintenance records by performed date · last ${range} days`}>
                {maintenanceTrend.length ? <div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={maintenanceTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}><CartesianGrid stroke="#edf0f4" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [value, "Completed records"]} /><Bar dataKey="value" name="Completed maintenance" fill="#e49a26" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyChart message="No completed maintenance records with a performed date in this range." />}
              </Panel>}

              {typeData.length > 0 && <Panel title="Vehicle types" subtitle="Distinct registered vehicles by recorded type.">
                <div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}><CartesianGrid stroke="#edf0f4" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [value, "Vehicles"]} /><Bar dataKey="value" name="Vehicles" fill="#da5a92" radius={[0, 4, 4, 0]} onClick={(entry) => setTypeFilter((current) => current === String(entry.name) ? "all" : String(entry.name))} className="cursor-pointer" /></BarChart></ResponsiveContainer></div>
              </Panel>}
            </section>

            <Panel title="Fleet vehicles" subtitle={`${filteredRows.length} of ${vehicles.length} distinct vehicles`} action={<div className="flex flex-wrap items-center gap-2">
              <label className="relative"><span className="sr-only">Search vehicles</span><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fleet" className="h-9 w-36 rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[10px] outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 sm:w-44" /></label>
              {hasTypeColumn && <label><span className="sr-only">Filter by vehicle type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 max-w-32 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-pink-400"><option value="all">All types</option>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select></label>}
              {hasStatusColumn && <label><span className="sr-only">Filter by vehicle status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-pink-400"><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>}
            </div>}>
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[11px]"><thead className="border-y border-pink-100 bg-[#fff8fb] text-[9px] font-bold uppercase tracking-wide text-slate-500"><tr>
                {hasRegistrationColumn && <th className="px-3 py-3">Registration</th>}{hasTypeColumn && <th className="px-3 py-3">Type</th>}{hasDriverColumn && <th className="px-3 py-3">Assigned driver</th>}{hasStatusColumn && <th className="px-3 py-3">Operational status</th>}{hasMaintenanceColumn && <th className="px-3 py-3">Last maintenance</th>}<th className="px-3 py-3 text-right">Details</th>
              </tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map(({ vehicle, id, status }) => {
                const maintenanceRecord = maintenanceByVehicle.get(id);
                const driver = text(field(vehicle, "driver", "driver_name", "driverName"));
                const driverId = text(field(vehicle, "driver_id", "driverId"));
                return <tr key={id} className="transition-colors hover:bg-pink-50/50 focus-within:bg-pink-50/50">
                  {hasRegistrationColumn && <td className="px-3 py-3"><p className="font-mono font-bold text-pink-700">{text(field(vehicle, "plate_number", "plateNumber", "registration_number"))}</p><p className="mt-0.5 font-mono text-[9px] text-slate-400">{id}</p></td>}
                  {hasTypeColumn && <td className="px-3 py-3 text-slate-700">{vehicleType(vehicle)}</td>}
                  {hasDriverColumn && <td className="px-3 py-3 text-slate-700">{driver || (driverId ? `Driver ${driverId}` : "Unassigned")}</td>}
                  {hasStatusColumn && <td className="px-3 py-3"><span className="inline-flex rounded-full border px-2 py-1 text-[9px] font-bold" style={{ borderColor: `${STATUS_COLORS[status]}55`, backgroundColor: `${STATUS_COLORS[status]}12`, color: status === "Unverified" ? "#68758b" : STATUS_COLORS[status] }}>{status}</span></td>}
                  {hasMaintenanceColumn && <td className="px-3 py-3 text-slate-600"><MaintenanceDate value={maintenanceRecord?.performed_at} /></td>}
                  <td className="px-3 py-3 text-right"><button type="button" onClick={() => setSelectedVehicle(vehicle)} aria-label={`View details for ${vehicleLabel(vehicle)}`} className="inline-flex items-center gap-1.5 rounded-md border border-pink-200 px-2.5 py-1.5 text-[10px] font-semibold text-pink-700 transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"><Eye className="h-3 w-3" /><span>View</span></button></td>
                </tr>;
              })}</tbody></table></div>
              {filteredRows.length === 0 && <div className="py-10 text-center"><Truck className="mx-auto h-6 w-6 text-pink-200" /><p className="mt-2 text-xs font-bold text-slate-700">No vehicles match these filters</p><button type="button" onClick={() => { setQuery(""); setTypeFilter("all"); setStatusFilter("all"); }} className="mt-1 text-[10px] font-semibold text-pink-700 hover:underline">Clear filters</button></div>}
            </Panel>
          </>}

          {sources.vehicles && vehicles.length === 0 && <section className="rounded-xl border border-dashed border-pink-200 bg-white px-5 py-12 text-center"><Truck className="mx-auto h-8 w-8 text-pink-300" /><h2 className="mt-3 text-sm font-bold text-slate-800">No vehicles registered</h2><p className="mt-1 text-xs text-slate-500">There are no vehicle records in this fleet yet.</p>{canCreate && <a href="/fvm/inventory" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-pink-700"><Plus className="h-3.5 w-3.5" />Register a vehicle</a>}</section>}
        </>}

        <nav aria-label="Fleet management actions" className="flex flex-wrap items-center gap-2 border-t border-pink-100 pt-3">
          <a href="/fvm/inventory" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Manage inventory<ArrowRight className="h-3 w-3" /></a>
          {canAssign && <a href="/vrds/bookings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Manage assignments<ArrowRight className="h-3 w-3" /></a>}
          <a href="/fvm/maintenance" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Maintenance records<ArrowRight className="h-3 w-3" /></a>
          <a href="/fvm/analytics" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">Fleet analytics<ArrowRight className="h-3 w-3" /></a>
        </nav>
      </main><GlobalFooter />

      {selectedVehicle && <div className="fixed inset-0 z-[1300] flex justify-end bg-slate-950/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedVehicle(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="fleet-vehicle-title" className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-pink-100 bg-[#fffafd] shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-pink-100 bg-white p-5"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-pink-700">Vehicle record</p><h2 id="fleet-vehicle-title" className="mt-1 text-xl font-black text-slate-900">{vehicleLabel(selectedVehicle)}</h2><p className="mt-1 font-mono text-[10px] text-slate-500">{vehicleId(selectedVehicle)}</p></div><button type="button" onClick={() => setSelectedVehicle(null)} aria-label="Close vehicle details" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"><X className="h-4 w-4" /></button></header>
          <div className="space-y-4 p-5">
            <section className="rounded-xl border border-pink-100 bg-white p-4"><h3 className="text-xs font-bold text-slate-800">Vehicle information</h3><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">{[
              ["Registration", field(selectedVehicle, "plate_number", "plateNumber", "registration_number")],
              ["Type", vehicleType(selectedVehicle)],
              ["Manufacturer", field(selectedVehicle, "manufacturer")],
              ["Model", field(selectedVehicle, "model")],
              ["Status", relationshipsReady ? getFleetVehicleStatus(selectedVehicle, trips, maintenance, true) : null],
              ["Assigned driver", field(selectedVehicle, "driver", "driver_name", "driverName", "driver_id")],
              ["Last maintenance", maintenanceByVehicle.get(vehicleId(selectedVehicle))?.performed_at],
            ].filter(([, value]) => value != null && String(value).trim() !== "").map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{String(label)}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-700">{label === "Last maintenance" ? formatDate(value) || "" : String(value)}</dd></div>)}</dl></section>
            {selectedVehicle.active_trip != null && typeof selectedVehicle.active_trip === "object" && <section className="rounded-xl border border-pink-100 bg-white p-4"><h3 className="text-xs font-bold text-slate-800">Active trip</h3><dl className="mt-3 grid grid-cols-2 gap-3">{Object.entries({
              "Trip ID": field(selectedVehicle.active_trip as Row, "id"),
              Status: field(selectedVehicle.active_trip as Row, "status"),
              Route: field(selectedVehicle.active_trip as Row, "route_name", "routeName"),
              Destination: field(selectedVehicle.active_trip as Row, "to_location", "toLocation"),
            }).filter(([, value]) => value != null).map(([label, value]) => <div key={label}><dt className="text-[9px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-xs font-semibold text-slate-700">{String(value)}</dd></div>)}</dl></section>}
            {canAssign && <a href="/vrds/bookings" className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-pink-700">Manage assignments<ArrowRight className="h-3.5 w-3.5" /></a>}
          </div>
        </section>
      </div>}
    </div>
  </RoleRestricted>;
}