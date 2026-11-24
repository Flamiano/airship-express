"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import { fetchJson } from "../../../lib/api";

type DataRecord = Record<string, unknown>;
type TripMeasurement = {
  id: string;
  raw: DataRecord;
  vehicleId: string | null;
  driverId: string | null;
  date: string | null;
  distanceKm: number | null;
  consumedLiters: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
  distanceSource: string;
  qualityWarnings: string[];
};
type VehicleEfficiency = {
  id: string;
  name: string;
  type: string;
  driverName: string;
  distanceKm: number | null;
  consumedLiters: number | null;
  pairedDistanceKm: number;
  pairedLiters: number;
  efficiencyKmPerL: number | null;
  trips: TripMeasurement[];
  periodStart: string | null;
  periodEnd: string | null;
  warnings: string[];
};

const EMPTY_RECORDS: DataRecord[] = [];
const PAGE_SIZES = [10, 25, 50];
const kmPerLiter = (distance: number, liters: number) => liters > 0 ? distance / liters : null;
const numberText = (value: number | null, digits = 1) => value == null
  ? "No data available"
  : value.toLocaleString("en-PH", { maximumFractionDigits: digits });

function asNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function dateValue(record: DataRecord) {
  const raw = firstValue(record.actual_arrival, record.completed_at, record.actual_departure, record.started_at, record.created_at, record.createdAt);
  if (raw == null) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function consumedFuelLiters(record: DataRecord) {
  const value = asNumber(firstValue(
    record.actual_fuel_consumed_liters,
    record.fuel_consumed_liters,
    record.consumed_liters,
    record.fuel_used_liters,
  ));
  return value != null && value > 0 ? value : null;
}

function makeTripMeasurement(record: DataRecord): TripMeasurement {
  const startOdometer = asNumber(firstValue(record.odometer_start_km, record.odometerStartKm));
  const endOdometer = asNumber(firstValue(record.odometer_end_km, record.odometerEndKm));
  const storedDistance = asNumber(firstValue(record.actual_distance_km, record.actualDistanceKm));
  const odometerDistance = startOdometer != null && endOdometer != null && startOdometer >= 0 && endOdometer > startOdometer
    ? endOdometer - startOdometer
    : null;
  const validStoredDistance = storedDistance != null && storedDistance > 0 ? storedDistance : null;
  const invalidOdometer = startOdometer != null && endOdometer != null && (startOdometer < 0 || endOdometer <= startOdometer);
  const id = String(firstValue(record.id, record.trip_id) ?? "");
  const warnings: string[] = [];
  if (invalidOdometer && !validStoredDistance) warnings.push("Odometer readings are invalid or not increasing.");
  if (storedDistance != null && storedDistance <= 0) warnings.push("Recorded actual distance is not greater than zero.");
  if (consumedFuelLiters(record) == null) warnings.push("No actual consumed-fuel measurement is available; refueling entries are excluded.");
  return {
    id,
    raw: record,
    vehicleId: firstValue(record.vehicle_id, record.vehicleId) == null ? null : String(firstValue(record.vehicle_id, record.vehicleId)),
    driverId: firstValue(record.driver_id, record.driverId) == null ? null : String(firstValue(record.driver_id, record.driverId)),
    date: dateValue(record),
    distanceKm: validStoredDistance ?? odometerDistance,
    consumedLiters: consumedFuelLiters(record),
    startOdometer,
    endOdometer,
    distanceSource: validStoredDistance != null ? "Recorded actual distance" : odometerDistance != null ? "Start/end odometer difference" : invalidOdometer ? "Invalid odometer sequence" : "Not recorded",
    qualityWarnings: warnings,
  };
}

function formatDate(value: string | null, includeTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-PH", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function vehicleLabel(vehicle: DataRecord | undefined, id: string) {
  return String(firstValue(vehicle?.plate_number, vehicle?.plateNumber, vehicle?.name) || id);
}

function driverLabel(driver: DataRecord | undefined, trips: TripMeasurement[]) {
  return String(firstValue(driver?.full_name, driver?.fullName, driver?.name, ...trips.map((trip) => trip.raw.driverName), ...trips.map((trip) => trip.raw.driver_name)) || "Driver name unavailable");
}

function vehicleTypeLabel(vehicle: DataRecord | undefined) {
  return String(firstValue(vehicle?.vehicle_type, vehicle?.vehicleType, vehicle?.type) || "Type unavailable");
}

function MetricCard({ label, value, unit, support, icon: Icon }: { label: string; value: string; unit?: string; support: string; icon: typeof Truck }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025] transition hover:border-pink-200 hover:shadow-md">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{label}</p><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-50 text-[#b80049]"><Icon className="h-4 w-4" /></span></div>
    <p className="mt-3 truncate text-2xl font-bold text-slate-900">{value}{unit && <span className="ml-1 text-xs font-semibold text-slate-500">{unit}</span>}</p>
    <p className="mt-1 truncate text-[10px] text-slate-500">{support}</p>
  </article>;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]"><h2 className="text-xs font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p><div className="mt-3">{children}</div></article>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-[205px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center"><div><Info className="mx-auto h-4 w-4 text-[#b80049]" /><p className="mt-2 text-[11px] font-semibold text-slate-600">No data available</p><p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-500">{message}</p></div></div>;
}

function DetailSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen} className="group border-b border-slate-100 last:border-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-xs font-bold text-slate-700">{title}<ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" /></summary><div className="grid grid-cols-2 gap-x-3 gap-y-3 pb-3">{children}</div></details>;
}

function DetailField({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  const display = value == null || value === "" ? "Not recorded" : typeof value === "string" || typeof value === "number" ? String(value) : "Not recorded";
  return <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}><p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-0.5 break-words text-[10px] font-medium text-slate-700">{display}</p></div>;
}

function SelectFilter({ label, value, onChange, options, getLabel = (option: string) => option }: { label: string; value: string; onChange: (value: string) => void; options: string[]; getLabel?: (option: string) => string }) {
  return <label className="relative flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5"><span className="mr-2 shrink-0 text-[10px] text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full appearance-none bg-transparent py-2 pr-5 text-[11px] font-semibold text-slate-700 outline-none"><option value="all">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{getLabel(option)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" /></label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-[10px] text-slate-500">{label}</span><span className="max-w-[60%] text-right text-[10px] font-semibold text-slate-700">{value}</span></div>;
}

export default function FuelEfficiencyPage() {
  const [snapshot, setSnapshot] = useState<DataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "efficiency" | "distance">("efficiency");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchJson("/api/dashboard")
      .then((data) => { if (active) { setSnapshot(data || {}); setLoadError(null); } })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Fleet measurement data could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const vehicles = (snapshot?.vehicles as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const drivers = (snapshot?.drivers as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const trips = (snapshot?.trips as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [String(driver.id), driver])), [drivers]);

  const measurements = useMemo(() => trips.map(makeTripMeasurement).filter((measurement) => measurement.id), [trips]);
  const filteredMeasurements = useMemo(() => measurements.filter((measurement) => {
    if (dateFrom && (!measurement.date || measurement.date.slice(0, 10) < dateFrom)) return false;
    if (dateTo && (!measurement.date || measurement.date.slice(0, 10) > dateTo)) return false;
    if (vehicleFilter !== "all" && measurement.vehicleId !== vehicleFilter) return false;
    if (driverFilter !== "all" && measurement.driverId !== driverFilter) return false;
    const vehicle = measurement.vehicleId ? vehicleById.get(measurement.vehicleId) : undefined;
    if (vehicleTypeFilter !== "all" && vehicleTypeLabel(vehicle) !== vehicleTypeFilter) return false;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      const driver = measurement.driverId ? driverById.get(measurement.driverId) : undefined;
      const name = String(firstValue(driver?.full_name, driver?.fullName, driver?.name, measurement.raw.driverName, measurement.raw.driver_name) || "");
      const haystack = [measurement.id, measurement.vehicleId, vehicle?.plate_number, vehicle?.plateNumber, name, measurement.raw.route_name, measurement.raw.from_location, measurement.raw.to_location]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }), [measurements, dateFrom, dateTo, vehicleFilter, driverFilter, vehicleTypeFilter, search, vehicleById, driverById]);

  const vehicleRows = useMemo(() => {
    const groups = new Map<string, TripMeasurement[]>();
    filteredMeasurements.forEach((measurement) => {
      if (!measurement.vehicleId) return;
      groups.set(measurement.vehicleId, [...(groups.get(measurement.vehicleId) || []), measurement]);
    });
    return [...groups.entries()].map(([id, vehicleTrips]): VehicleEfficiency => {
      const validDistanceTrips = vehicleTrips.filter((trip) => trip.distanceKm != null && trip.distanceKm > 0);
      const validFuelTrips = vehicleTrips.filter((trip) => trip.consumedLiters != null && trip.consumedLiters > 0);
      const pairedTrips = vehicleTrips.filter((trip) => trip.distanceKm != null && trip.distanceKm > 0 && trip.consumedLiters != null && trip.consumedLiters > 0);
      const pairedDistanceKm = pairedTrips.reduce((sum, trip) => sum + (trip.distanceKm || 0), 0);
      const pairedLiters = pairedTrips.reduce((sum, trip) => sum + (trip.consumedLiters || 0), 0);
      const rawVehicle = vehicleById.get(id);
      const vehicleDriverId = firstValue(rawVehicle?.driver_id, rawVehicle?.driverId);
      const driver = vehicleDriverId ? driverById.get(String(vehicleDriverId)) : undefined;
      const name = vehicleLabel(rawVehicle, id);
      const type = vehicleTypeLabel(rawVehicle);
      const warnings = [...new Set(vehicleTrips.flatMap((trip) => trip.qualityWarnings))];
      const dates = vehicleTrips.map((trip) => trip.date).filter((date): date is string => Boolean(date)).sort();
      return {
        id,
        name,
        type,
        driverName: driverLabel(driver, vehicleTrips),
        distanceKm: validDistanceTrips.length ? validDistanceTrips.reduce((sum, trip) => sum + (trip.distanceKm || 0), 0) : null,
        consumedLiters: validFuelTrips.length ? validFuelTrips.reduce((sum, trip) => sum + (trip.consumedLiters || 0), 0) : null,
        pairedDistanceKm,
        pairedLiters,
        efficiencyKmPerL: kmPerLiter(pairedDistanceKm, pairedLiters),
        trips: vehicleTrips,
        periodStart: dates[0] || null,
        periodEnd: dates[dates.length - 1] || null,
        warnings,
      };
    });
  }, [filteredMeasurements, vehicleById, driverById]);

  const validVehicles = vehicleRows.filter((row) => row.efficiencyKmPerL != null);
  const totalValidDistance = validVehicles.reduce((sum, row) => sum + row.pairedDistanceKm, 0);
  const totalValidLiters = validVehicles.reduce((sum, row) => sum + row.pairedLiters, 0);
  const fleetEfficiency = totalValidLiters > 0 ? totalValidDistance / totalValidLiters : null;
  const bestVehicle = [...validVehicles].sort((left, right) => (right.efficiencyKmPerL || 0) - (left.efficiencyKmPerL || 0))[0] || null;

  const sortedRows = useMemo(() => [...vehicleRows].sort((left, right) => {
    let comparison = 0;
    if (sortKey === "name") comparison = left.name.localeCompare(right.name);
    if (sortKey === "efficiency") comparison = (left.efficiencyKmPerL ?? -Infinity) - (right.efficiencyKmPerL ?? -Infinity);
    if (sortKey === "distance") comparison = (left.distanceKm ?? -Infinity) - (right.distanceKm ?? -Infinity);
    return comparison * (sortAscending ? 1 : -1);
  }), [vehicleRows, sortKey, sortAscending]);

  const pages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedVehicle = selectedVehicleId ? vehicleRows.find((row) => row.id === selectedVehicleId) || null : null;
  const selectedRawVehicle = selectedVehicle ? vehicleById.get(selectedVehicle.id) : undefined;
  const trendData = useMemo(() => {
    const paired = filteredMeasurements.filter((measurement) => measurement.date && measurement.distanceKm != null && measurement.distanceKm > 0 && measurement.consumedLiters != null && measurement.consumedLiters > 0);
    const byDay = new Map<string, { distance: number; liters: number }>();
    paired.forEach((measurement) => {
      const date = measurement.date!.slice(0, 10);
      const totals = byDay.get(date) || { distance: 0, liters: 0 };
      totals.distance += measurement.distanceKm || 0;
      totals.liters += measurement.consumedLiters || 0;
      byDay.set(date, totals);
    });
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, totals]) => ({
      date: new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      efficiency: totals.liters > 0 ? totals.distance / totals.liters : null,
    }));
  }, [filteredMeasurements]);

  const comparisonData = [...validVehicles].sort((a, b) => (b.efficiencyKmPerL || 0) - (a.efficiencyKmPerL || 0)).slice(0, 12).map((vehicle) => ({ vehicle: vehicle.name, id: vehicle.id, efficiency: vehicle.efficiencyKmPerL }));
  const distributionData = [
    { range: "0–5", min: 0, max: 5 },
    { range: "5–10", min: 5, max: 10 },
    { range: "10–15", min: 10, max: 15 },
    { range: "15–20", min: 15, max: 20 },
    { range: "20+", min: 20, max: Infinity },
  ].map((bin) => ({ range: bin.range, vehicles: validVehicles.filter((vehicle) => vehicle.efficiencyKmPerL! >= bin.min && vehicle.efficiencyKmPerL! < bin.max).length }));

  function resetFilters() {
    setDateFrom(""); setDateTo(""); setVehicleFilter("all"); setVehicleTypeFilter("all"); setDriverFilter("all"); setSearch(""); setPage(1);
  }

  function exportReport() {
    const headers = ["vehicle_id", "vehicle", "vehicle_type", "driver", "valid_distance_km", "actual_fuel_consumed_liters", "efficiency_km_per_l", "paired_distance_km", "paired_consumed_liters", "reporting_period", "quality_warnings"];
    const lines = sortedRows.map((row) => [row.id, row.name, row.type, row.driverName, row.distanceKm, row.consumedLiters, row.efficiencyKmPerL, row.pairedDistanceKm, row.pairedLiters, `${row.periodStart || ""} to ${row.periodEnd || ""}`, row.warnings.join("; ")].map(csvCell).join(","));
    const blob = new Blob([[headers.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `fuel-efficiency-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900">
    <GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b80049]">Fleet operations · Fuel management</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Fuel Efficiency</h1><p className="mt-1 max-w-2xl text-xs text-slate-500">Compare vehicle efficiency using actual consumed-fuel measurements paired with verified trip distance.</p></header>
      {loadError && <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"><AlertCircle className="h-4 w-4" />{loadError}</div>}

      <section aria-label="Efficiency filters" className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.025] sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto_auto]">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" /><input aria-label="Date from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="min-w-0 w-full py-2 text-[11px] outline-none" /><span className="text-[10px] text-slate-400">to</span><input aria-label="Date to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="min-w-0 w-full py-2 text-[11px] outline-none" /></div>
        <SelectFilter label="Vehicle" value={vehicleFilter} onChange={(value) => { setVehicleFilter(value); setPage(1); }} options={[...new Set(measurements.map((measurement) => measurement.vehicleId).filter((id): id is string => Boolean(id)))].sort()} getLabel={(id) => vehicleLabel(vehicleById.get(id), id)} />
        <SelectFilter label="Vehicle type" value={vehicleTypeFilter} onChange={(value) => { setVehicleTypeFilter(value); setPage(1); }} options={[...new Set(vehicles.map(vehicleTypeLabel).filter((type) => type !== "Type unavailable"))].sort()} />
        <SelectFilter label="Driver" value={driverFilter} onChange={(value) => { setDriverFilter(value); setPage(1); }} options={[...new Set(measurements.map((measurement) => measurement.driverId).filter((id): id is string => Boolean(id)))].sort()} getLabel={(id) => { const driver = driverById.get(id); return String(firstValue(driver?.full_name, driver?.fullName, driver?.name) || "Driver name unavailable"); }} />
        <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:border-pink-200 hover:bg-pink-50">Reset filters</button>
        <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#97003c]"><Download className="h-3.5 w-3.5" />Export Report</button>
      </section>

      <section aria-label="Efficiency KPIs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Average Fleet Efficiency" value={fleetEfficiency == null ? "No data available" : numberText(fleetEfficiency, 2)} unit={fleetEfficiency == null ? "" : "km/L"} support={validVehicles.length ? "Weighted across paired measurements" : "Requires consumed liters and valid distance"} icon={Truck} />
        <MetricCard label="Best Performing Vehicle" value={bestVehicle?.name || "No data available"} support={bestVehicle ? `${numberText(bestVehicle.efficiencyKmPerL, 2)} km/L from valid records` : "No valid vehicle efficiency records"} icon={UserRound} />
        <MetricCard label="Total Distance Analyzed" value={totalValidDistance > 0 ? numberText(totalValidDistance) : "No data available"} unit={totalValidDistance > 0 ? "km" : ""} support={validVehicles.length ? "Distance paired with actual fuel use" : "No paired measurements in this selection"} icon={ArrowDownWideNarrow} />
        <MetricCard label="Vehicles with Valid Efficiency Records" value={String(validVehicles.length)} support={`${vehicleRows.length} vehicles in the filtered trip records`} icon={Info} />
      </section>

      <section aria-label="Efficiency charts" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartPanel title="Fuel Efficiency Trend" subtitle="Weighted daily kilometers per liter">
          {trendData.length ? <div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis unit=" km/L" tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${numberText(Number(value), 2)} km/L`, "Efficiency"]} /><Line type="monotone" dataKey="efficiency" name="Efficiency" stroke="#b80049" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <EmptyChart message="No paired trip-distance and actual consumed-fuel measurements are available. Refueling transactions are excluded." />}
        </ChartPanel>
        <ChartPanel title="Vehicle Efficiency Comparison" subtitle="Highest measured kilometers per liter">
          {comparisonData.length ? <div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="vehicle" tick={{ fontSize: 9 }} /><YAxis unit=" km/L" tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${numberText(Number(value), 2)} km/L`, "Efficiency"]} /><Bar dataKey="efficiency" name="Efficiency" fill="#c93878" radius={[4, 4, 0, 0]} onClick={(entry) => { if (entry?.id) setSelectedVehicleId(String(entry.id)); }} /></BarChart></ResponsiveContainer></div> : <EmptyChart message="Vehicle comparison requires actual fuel consumed and valid distance for the same reporting period." />}
        </ChartPanel>
        <ChartPanel title="Efficiency Distribution" subtitle="Vehicles by measured km/L range">
          {validVehicles.length ? <div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={distributionData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="range" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${value} vehicles`, "Count"]} /><Bar dataKey="vehicles" name="Vehicles" fill="#e98bb5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyChart message="No valid efficiency records are available to classify." />}
        </ChartPanel>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
        <section aria-label="Vehicle efficiency records" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Vehicle Efficiency Records</h2><p className="mt-0.5 text-[10px] text-slate-500">{sortedRows.length} vehicles match the current filters</p></div><label className="relative min-w-0 sm:w-64"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search vehicle, driver..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-[11px] outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" /></label></div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3"><button type="button" onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600"><ArrowDownWideNarrow className="h-3.5 w-3.5" />{sortAscending ? "Ascending" : "Descending"}</button><select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600"><option value="efficiency">Sort by efficiency</option><option value="name">Sort by vehicle</option><option value="distance">Sort by distance</option></select><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} aria-label="Rows per page" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[930px] text-left text-[10px]"><thead className="bg-[#fbf9fa] text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500"><tr><th className="px-3 py-2.5">Vehicle</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Assigned driver</th><th className="px-3 py-2.5 text-right">Distance</th><th className="px-3 py-2.5 text-right">Fuel consumed</th><th className="px-3 py-2.5 text-right">Efficiency</th><th className="px-3 py-2.5">Reporting period</th><th className="px-3 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => { const status = row.efficiencyKmPerL == null ? "No valid data" : fleetEfficiency == null ? "Measured" : row.efficiencyKmPerL >= fleetEfficiency ? "At or above fleet average" : "Below fleet average"; return <tr key={row.id} onClick={() => { setSelectedVehicleId(row.id); setDetailsOpen(false); }} className={`cursor-pointer transition hover:bg-pink-50/60 ${selectedVehicleId === row.id ? "bg-pink-50/80" : ""}`} aria-selected={selectedVehicleId === row.id}><td className="px-3 py-2.5"><span className="block font-semibold text-slate-800">{row.name}</span><span className="mt-0.5 block font-mono text-[9px] text-slate-400">{row.id}</span></td><td className="px-3 py-2.5">{row.type}</td><td className="px-3 py-2.5">{row.driverName}</td><td className="px-3 py-2.5 text-right tabular-nums">{row.distanceKm == null ? "No data available" : `${numberText(row.distanceKm)} km`}</td><td className="px-3 py-2.5 text-right tabular-nums">{row.consumedLiters == null ? "No data available" : `${numberText(row.consumedLiters)} L`}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.efficiencyKmPerL == null ? "No data available" : `${numberText(row.efficiencyKmPerL, 2)} km/L`}</td><td className="whitespace-nowrap px-3 py-2.5">{row.periodStart ? `${formatDate(row.periodStart, false)} – ${formatDate(row.periodEnd, false)}` : "Not recorded"}</td><td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${row.efficiencyKmPerL == null ? "border-slate-200 bg-slate-50 text-slate-500" : "border-pink-200 bg-pink-50 text-[#a10040]"}`}>{status}</span></td></tr>; })}
            {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500">Loading verified trip measurements…</td></tr>}
            {!loading && !visibleRows.length && <tr><td colSpan={8} className="px-4 py-12 text-center"><p className="text-xs font-semibold text-slate-600">{loadError ? "Efficiency data unavailable" : "No vehicles match these filters"}</p><p className="mt-1 text-[10px] text-slate-400">{loadError ? "Check connectivity and permissions, then reload." : "Adjust the filters or date range to see other records."}</p></td></tr>}
          </tbody></table></div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5"><p className="text-[10px] text-slate-500">{sortedRows.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedRows.length)} of ${sortedRows.length}` : "0 vehicles"}</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center text-[10px] font-semibold">{currentPage} / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div></footer>
        </section>

        <aside aria-label="Fuel Efficiency Information" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b80049]">Efficiency detail</p><h2 className="mt-0.5 text-sm font-bold text-slate-900">Fuel Efficiency Information</h2><p className="mt-0.5 text-[10px] text-slate-500">{selectedVehicle?.name || `${validVehicles.length} vehicles with valid measurements`}</p></div>{selectedVehicle && <button type="button" aria-label="Clear vehicle selection" onClick={() => setSelectedVehicleId(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}</div>
          {selectedVehicle ? <div className="max-h-[790px] overflow-y-auto px-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-3"><div><p className="text-xs font-bold text-slate-900">{selectedVehicle.name}</p><p className="mt-0.5 font-mono text-[9px] text-slate-400">{selectedVehicle.id}</p></div><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${selectedVehicle.efficiencyKmPerL == null ? "border-slate-200 bg-slate-50 text-slate-500" : "border-pink-200 bg-pink-50 text-[#a10040]"}`}>{selectedVehicle.efficiencyKmPerL == null ? "No valid data" : `${numberText(selectedVehicle.efficiencyKmPerL, 2)} km/L`}</span></div>
            <DetailSection title="Vehicle Details" defaultOpen><DetailField label="Vehicle ID" value={selectedVehicle.id} /><DetailField label="Plate / display name" value={selectedVehicle.name} /><DetailField label="Vehicle type" value={selectedVehicle.type} /><DetailField label="Assigned driver" value={selectedVehicle.driverName} /><DetailField label="Make / model" value={firstValue(selectedRawVehicle?.manufacturer, selectedRawVehicle?.make, selectedRawVehicle?.model)} /><DetailField label="Current odometer" value={selectedRawVehicle?.mileage == null ? null : `${selectedRawVehicle.mileage} km`} /></DetailSection>
            <DetailSection title="Reporting Period" defaultOpen><DetailField label="From" value={formatDate(selectedVehicle.periodStart, false)} /><DetailField label="To" value={formatDate(selectedVehicle.periodEnd, false)} /><DetailField label="Trips in selection" value={selectedVehicle.trips.length} /></DetailSection>
            <DetailSection title="Distance and Fuel Measurements" defaultOpen><DetailField label="Valid distance" value={selectedVehicle.distanceKm == null ? null : `${numberText(selectedVehicle.distanceKm)} km`} /><DetailField label="Distance used in efficiency" value={`${numberText(selectedVehicle.pairedDistanceKm)} km`} /><DetailField label="Actual fuel consumed" value={selectedVehicle.consumedLiters == null ? null : `${numberText(selectedVehicle.consumedLiters)} L`} /><DetailField label="Fuel used in efficiency" value={`${numberText(selectedVehicle.pairedLiters)} L`} /><DetailField label="Distance measurement" value={selectedVehicle.trips.map((trip) => trip.distanceSource).filter((source) => source !== "Not recorded").join(", ") || "Not recorded"} wide /></DetailSection>
            <DetailSection title="Efficiency Calculation" defaultOpen><DetailField label="Calculated efficiency" value={selectedVehicle.efficiencyKmPerL == null ? "No data available" : `${numberText(selectedVehicle.efficiencyKmPerL, 2)} km/L`} /><DetailField label="Formula" value="Valid kilometers traveled ÷ actual liters consumed" wide /><DetailField label="Calculation inputs" value={`${numberText(selectedVehicle.pairedDistanceKm)} km ÷ ${numberText(selectedVehicle.pairedLiters)} L`} wide /><DetailField label="Reporting basis" value="Only trips with both actual consumed liters and valid distance are included." wide /></DetailSection>
            <DetailSection title="Data Source"><DetailField label="Primary records" value="Trip measurements" /><DetailField label="Fuel data" value="Explicit consumed-fuel fields only" /><DetailField label="Refueling transactions" value="Excluded; purchased fuel is not consumed fuel" wide /><DetailField label="Latest source update" value={formatDate(selectedVehicle.trips.map((trip) => trip.raw.updated_at).filter((value): value is string => typeof value === "string").sort().at(-1) || null)} /></DetailSection>
            <DetailSection title="Data Quality Warnings">{selectedVehicle.warnings.length ? selectedVehicle.warnings.map((warning, index) => <p key={`${warning}-${index}`} className="col-span-2 text-[10px] text-amber-700">{warning}</p>) : <p className="col-span-2 text-[10px] text-slate-500">No quality warnings for this selection.</p>}</DetailSection>
            <div className="py-3"><button type="button" onClick={() => setDetailsOpen(true)} className="w-full rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-[10px] font-bold text-[#a10040] hover:bg-pink-100">Open trip measurement details</button></div>
          </div> : <div className="px-4 py-5"><div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-[#b80049] shadow-sm"><Info className="h-4 w-4" /></span><p className="mt-2 text-xs font-bold text-slate-700">No vehicle selected</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Select a vehicle to inspect its measurements, calculation inputs, reporting period, and data-quality warnings.</p></div><div className="mt-4 space-y-3"><SummaryRow label="Vehicles in current view" value={String(vehicleRows.length)} /><SummaryRow label="Vehicles with paired valid data" value={String(validVehicles.length)} /><SummaryRow label="Fleet efficiency" value={fleetEfficiency == null ? "No data available" : `${numberText(fleetEfficiency, 2)} km/L`} /><SummaryRow label="Distance analyzed" value={totalValidDistance > 0 ? `${numberText(totalValidDistance)} km` : "No data available"} /><SummaryRow label="Efficiency formula" value="km traveled ÷ actual liters consumed" /><SummaryRow label="Purchased liters" value="Excluded from efficiency" /></div></div>}
        </aside>
      </section>
    </main>
    <GlobalFooter />

    {detailsOpen && selectedVehicle && <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="efficiency-modal-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b80049]">Trip measurement detail</p><h2 id="efficiency-modal-title" className="mt-1 text-base font-bold text-slate-900">{selectedVehicle.name} · {selectedVehicle.type}</h2></div><button type="button" aria-label="Close trip details" onClick={() => setDetailsOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-[10px]"><thead className="border-b border-slate-100 text-[9px] uppercase text-slate-500"><tr><th className="py-2 pr-3">Trip ID</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Distance</th><th className="py-2 pr-3">Fuel consumed</th><th className="py-2 pr-3">Source</th><th className="py-2">Warnings</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedVehicle.trips.map((trip) => <tr key={trip.id}><td className="py-2 pr-3 font-mono">{trip.id}</td><td className="whitespace-nowrap py-2 pr-3">{formatDate(trip.date)}</td><td className="py-2 pr-3">{trip.distanceKm == null ? "No data" : `${numberText(trip.distanceKm)} km`}</td><td className="py-2 pr-3">{trip.consumedLiters == null ? "No data" : `${numberText(trip.consumedLiters)} L`}</td><td className="py-2 pr-3">{trip.distanceSource}</td><td className="py-2">{trip.qualityWarnings.join(" ") || "None"}</td></tr>)}</tbody></table></div></section></div>}
  </div>;
}