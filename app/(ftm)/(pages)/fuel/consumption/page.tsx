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
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import { fetchJson, getCurrentProfile } from "../../../lib/api";
import { parseMeasuredFuelLiters } from "../../../lib/fuelConsumptionMeasurement";
import { hasPermission } from "../../../lib/permissions";

type DataRecord = Record<string, unknown>;
type ConsumptionRecord = {
  id: string;
  raw: DataRecord;
  vehicleId: string | null;
  driverId: string | null;
  date: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  distanceKm: number | null;
  consumedLiters: number | null;
  distanceSource: string;
  status: string;
};

const EMPTY_RECORDS: DataRecord[] = [];
const PAGE_SIZE = 10;
const litersPer100Km = (liters: number, kilometers: number) => kilometers > 0 ? liters / kilometers * 100 : null;
const kmPerLiter = (liters: number, kilometers: number) => liters > 0 ? kilometers / liters : null;
const numberText = (value: number | null, digits = 1) => value == null
  ? null
  : value.toLocaleString("en-PH", { maximumFractionDigits: digits });
const fieldText = (value: unknown) => value == null || String(value).trim() === "" ? null : String(value);

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numeric(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function timestamp(record: DataRecord) {
  const value = firstValue(record.actual_arrival, record.completed_at, record.actual_departure, record.started_at, record.created_at, record.createdAt);
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function actualConsumedFuel(record: DataRecord) {
  const liters = numeric(firstValue(
    record.actual_fuel_consumed_liters,
    record.fuel_consumed_liters,
    record.consumed_liters,
    record.fuel_used_liters,
  ));
  return liters != null && liters > 0 ? liters : null;
}

function makeConsumptionRecord(trip: DataRecord): ConsumptionRecord {
  const startOdometer = numeric(firstValue(trip.odometer_start_km, trip.odometerStartKm));
  const endOdometer = numeric(firstValue(trip.odometer_end_km, trip.odometerEndKm));
  const storedDistance = numeric(firstValue(trip.actual_distance_km, trip.actualDistanceKm));
  const odometerDistance = startOdometer != null && endOdometer != null
    && startOdometer >= 0 && endOdometer > startOdometer
    ? endOdometer - startOdometer
    : null;
  const validStoredDistance = storedDistance != null && storedDistance > 0 ? storedDistance : null;
  const distanceKm = validStoredDistance ?? odometerDistance;
  const hasInconsistentOdometer = startOdometer != null && endOdometer != null
    && (startOdometer < 0 || endOdometer <= startOdometer);
  const id = String(firstValue(trip.id, trip.trip_id) ?? "");
  return {
    id,
    raw: trip,
    vehicleId: firstValue(trip.vehicle_id, trip.vehicleId) == null ? null : String(firstValue(trip.vehicle_id, trip.vehicleId)),
    driverId: firstValue(trip.driver_id, trip.driverId) == null ? null : String(firstValue(trip.driver_id, trip.driverId)),
    date: timestamp(trip),
    startOdometer,
    endOdometer,
    distanceKm,
    consumedLiters: actualConsumedFuel(trip),
    distanceSource: validStoredDistance ? "Recorded actual distance" : odometerDistance != null ? "Start/end odometer difference" : hasInconsistentOdometer ? "Invalid odometer sequence" : "Not recorded",
    status: String(firstValue(trip.status, trip.trip_status) || "Not recorded"),
  };
}

function nestedRecord(value: unknown): DataRecord {
  return value && typeof value === "object" ? value as DataRecord : {};
}

function routeLabel(record: ConsumptionRecord) {
  const routePlan = nestedRecord(record.raw.routePlan);
  const booking = nestedRecord(record.raw.bookings);
  const name = firstValue(record.raw.route_name, record.raw.routeName, record.raw.route_label, routePlan.route_name, routePlan.routeName, routePlan.name, booking.route_name, booking.routeName);
  if (name) return String(name);
  const origin = firstValue(record.raw.from_location, record.raw.origin, routePlan.pickup_location, routePlan.pickupLocation, booking.pickup_location);
  const destination = firstValue(record.raw.to_location, record.raw.destination, routePlan.destination, booking.dropoff_location);
  return origin && destination ? `${origin} to ${destination}` : null;
}

function driverLabel(record: ConsumptionRecord, driver?: DataRecord) {
  return firstValue(driver?.full_name, driver?.name, record.raw.driverName, record.raw.driver_name) ? String(firstValue(driver?.full_name, driver?.name, record.raw.driverName, record.raw.driver_name)) : null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function MetricCard({ title, value, unit, support, icon: Icon }: { title: string; value: string | null; unit: string; support: string; icon: typeof Truck }) {
  if (!value) return null;
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]">
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{title}</p><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-50 text-[#b80049]"><Icon className="h-4 w-4" /></span></div>
    <p className="mt-3 truncate text-2xl font-bold text-slate-900">{value}<span className="ml-1 text-xs font-semibold text-slate-500">{unit}</span></p>
    <p className="mt-1 truncate text-[10px] text-slate-500">{support}</p>
  </article>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-[210px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
    <div><Info className="mx-auto h-4 w-4 text-[#b80049]" /><p className="mt-2 text-[11px] font-semibold text-slate-600">Consumption data unavailable</p><p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-500">{message}</p></div>
  </div>;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]">
    <h2 className="text-xs font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p><div className="mt-3">{children}</div>
  </article>;
}

function DetailSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen} className="group border-b border-slate-100 last:border-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-xs font-bold text-slate-700">{title}<ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" /></summary>
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 pb-3">{children}</div>
  </details>;
}

function DetailField({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  if (value == null || value === "") return null;
  const shown = typeof value === "string" || typeof value === "number" ? String(value) : null;
  if (!shown) return null;
  return <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}><p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-0.5 break-words text-[10px] font-medium text-slate-700">{shown}</p></div>;
}

function SelectFilter({ label, value, onChange, options, getLabel = (option: string) => option }: { label: string; value: string; onChange: (value: string) => void; options: string[]; getLabel?: (option: string) => string | null }) {
  return <label className="relative flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5"><span className="mr-2 shrink-0 text-[10px] text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full appearance-none bg-transparent py-2 pr-5 text-[11px] font-semibold text-slate-700 outline-none"><option value="all">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{getLabel(option) ?? option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" /></label>;
}

export default function FuelConsumptionPage() {
  const [snapshot, setSnapshot] = useState<DataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [fuelConsumptionDraft, setFuelConsumptionDraft] = useState<{ tripId: string; value: string } | null>(null);
  const [savingFuelConsumption, setSavingFuelConsumption] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"date" | "distance" | "vehicle">("date");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchJson("/api/dashboard"), getCurrentProfile()])
      .then(([dashboardResult, profileResult]) => {
        if (!active) return;
        if (dashboardResult.status === "fulfilled") {
          setSnapshot(dashboardResult.value || {});
        } else {
          const error = dashboardResult.reason;
          setLoadError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Trip measurements could not be loaded.");
        }
        if (profileResult.status === "fulfilled") {
          setProfileRole(profileResult.value.role ?? null);
        } else {
          const error = profileResult.reason;
          setProfileError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Your profile could not be loaded.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const trips = (snapshot?.trips as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const vehicles = (snapshot?.vehicles as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const drivers = (snapshot?.drivers as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [String(driver.id), driver])), [drivers]);
  const records = useMemo(() => trips.map(makeConsumptionRecord).filter((record) => record.id), [trips]);

  const filterOptions = useMemo(() => ({
    vehicles: [...new Set(records.map((record) => record.vehicleId).filter((id): id is string => Boolean(id)))].sort(),
    drivers: [...new Set(records.map((record) => record.driverId).filter((id): id is string => Boolean(id)))].sort(),
    trips: [...new Set(records.map((record) => record.id))].sort(),
  }), [records]);

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((record) => {
      if (vehicleFilter !== "all" && record.vehicleId !== vehicleFilter) return false;
      if (driverFilter !== "all" && record.driverId !== driverFilter) return false;
      if (tripFilter !== "all" && record.id !== tripFilter) return false;
      if (statusFilter !== "all" && record.status.toLowerCase() !== statusFilter) return false;
      if (dateFrom && (!record.date || record.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!record.date || record.date.slice(0, 10) > dateTo)) return false;
      if (needle) {
        const vehicle = record.vehicleId ? vehicleById.get(record.vehicleId) : undefined;
        const driver = record.driverId ? driverById.get(record.driverId) : undefined;
        const haystack = [record.id, record.vehicleId, vehicle?.plate_number, driverLabel(record, driver), routeLabel(record), record.status, record.distanceSource]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    }).sort((left, right) => {
      let comparison = 0;
      if (sortKey === "date") comparison = String(left.date || "").localeCompare(String(right.date || ""));
      if (sortKey === "distance") comparison = (left.distanceKm ?? -1) - (right.distanceKm ?? -1);
      if (sortKey === "vehicle") comparison = String(left.vehicleId || "").localeCompare(String(right.vehicleId || ""), undefined, { numeric: true });
      return comparison * (sortAscending ? 1 : -1);
    });
  }, [records, vehicleFilter, driverFilter, tripFilter, statusFilter, dateFrom, dateTo, search, vehicleById, driverById, sortKey, sortAscending]);

  const distanceRows = useMemo(() => filteredRecords.filter((record) => record.distanceKm != null && record.distanceKm > 0), [filteredRecords]);
  const consumptionRows = useMemo(() => filteredRecords.filter((record) => record.consumedLiters != null && record.consumedLiters > 0), [filteredRecords]);
  const pairedRows = useMemo(() => filteredRecords.filter((record) => record.distanceKm != null && record.distanceKm > 0 && record.consumedLiters != null && record.consumedLiters > 0), [filteredRecords]);
  const totalDistance = distanceRows.length ? distanceRows.reduce((sum, record) => sum + (record.distanceKm || 0), 0) : null;
  const totalConsumed = consumptionRows.length ? consumptionRows.reduce((sum, record) => sum + (record.consumedLiters || 0), 0) : null;
  const averageLPer100 = pairedRows.length
    ? litersPer100Km(pairedRows.reduce((sum, record) => sum + (record.consumedLiters || 0), 0), pairedRows.reduce((sum, record) => sum + (record.distanceKm || 0), 0))
    : null;
  const vehiclesWithConsumption = new Set(consumptionRows.map((record) => record.vehicleId).filter(Boolean)).size;

  const trendData = useMemo(() => {
    const groups = new Map<string, number>();
    consumptionRows.forEach((record) => {
      const key = record.date?.slice(0, 10);
      if (key) groups.set(key, (groups.get(key) || 0) + (record.consumedLiters || 0));
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sourceDate, liters]) => ({
      sourceDate,
      date: new Date(`${sourceDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      liters,
    }));
  }, [consumptionRows]);

  const vehicleData = useMemo(() => {
    const groups = new Map<string, number>();
    consumptionRows.forEach((record) => {
      if (record.vehicleId) groups.set(record.vehicleId, (groups.get(record.vehicleId) || 0) + (record.consumedLiters || 0));
    });
    return [...groups.entries()].map(([id, liters]) => ({
      id,
      vehicle: String(vehicleById.get(id)?.plate_number || id),
      liters,
    })).sort((a, b) => b.liters - a.liters);
  }, [consumptionRows, vehicleById]);

  const scatterData = pairedRows.map((record) => ({ distance: record.distanceKm, liters: record.consumedLiters, id: record.id }));
  const pages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = selectedId ? filteredRecords.find((record) => record.id === selectedId) || null : null;
  const selectedVehicle = selected?.vehicleId ? vehicleById.get(selected.vehicleId) : undefined;
  const selectedDriver = selected?.driverId ? driverById.get(selected.driverId) : undefined;
  const canRecordFuelConsumption = hasPermission(profileRole, "fuelManagement", "update");
  const selectedTripIsComplete = selected ? ["completed", "delivered"].includes(selected.status.toLowerCase()) : false;
  const fuelConsumptionInput = selected
    ? fuelConsumptionDraft?.tripId === selected.id
      ? fuelConsumptionDraft.value
      : selected.consumedLiters == null ? "" : String(selected.consumedLiters)
    : "";
  const selectedRaw = selected?.raw;
  const selectedRoutePlan = selectedRaw?.routePlan && typeof selectedRaw.routePlan === "object" ? selectedRaw.routePlan as DataRecord : EMPTY_RECORDS[0];
  const selectedBooking = selectedRaw?.bookings && typeof selectedRaw.bookings === "object" ? selectedRaw.bookings as DataRecord : EMPTY_RECORDS[0];
  const selectedEvents = Array.isArray(selectedRaw?.events) ? selectedRaw.events as DataRecord[] : [];

  function applyFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function exportReport() {
    const columns = ["trip_record_id", "measurement_date", "vehicle_id", "driver_name", "driver_id", "route_name", "trip_status", "distance_km", "distance_source", "actual_fuel_consumed_liters", "consumption_l_per_100km", "measurement_formula"];
    const lines = filteredRecords.map((record) => [
      record.id,
      record.date,
      record.vehicleId,
      driverLabel(record, record.driverId ? driverById.get(record.driverId) : undefined),
      record.driverId,
      routeLabel(record),
      record.status,
      record.distanceKm,
      record.distanceSource,
      record.consumedLiters,
      record.distanceKm && record.consumedLiters ? litersPer100Km(record.consumedLiters, record.distanceKm) : null,
      "actual consumed liters / valid actual kilometers * 100; blank when consumed liters are not recorded",
    ].map(csv).join(","));
    const blob = new Blob([[columns.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fuel-consumption-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice(`Exported ${filteredRecords.length} filtered trip record${filteredRecords.length === 1 ? "" : "s"}.`);
    window.setTimeout(() => setNotice(null), 3500);
  }

  const hasConsumptionData = consumptionRows.length > 0;
  const selectedRate = selected?.distanceKm && selected.consumedLiters
    ? litersPer100Km(selected.consumedLiters, selected.distanceKm)
    : null;
  const selectedKmPerLiter = selected?.distanceKm && selected.consumedLiters
    ? kmPerLiter(selected.consumedLiters, selected.distanceKm)
    : null;

  async function saveFuelConsumption() {
    if (!selected || !canRecordFuelConsumption || !selectedTripIsComplete) return;
    const liters = parseMeasuredFuelLiters(fuelConsumptionInput);
    if (liters == null) {
      setNotice("Enter a measured fuel amount greater than zero liters.");
      return;
    }

    setSavingFuelConsumption(true);
    try {
      await fetchJson(`/api/trips/${encodeURIComponent(selected.id)}/fuel-consumption`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_fuel_consumed_liters: liters }),
      });
      setFuelConsumptionDraft({ tripId: selected.id, value: String(liters) });
      setSnapshot((current) => {
        if (!current || !Array.isArray(current.trips)) return current;
        return {
          ...current,
          trips: current.trips.map((trip: DataRecord) => (
            String(firstValue(trip.id, trip.trip_id) ?? "") === selected.id
              ? { ...trip, actual_fuel_consumed_liters: liters }
              : trip
          )),
        };
      });
      setNotice(`Saved ${numberText(liters, 3)} L of measured fuel consumption for trip ${selected.id}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Fuel consumption could not be saved.");
    } finally {
      setSavingFuelConsumption(false);
    }
  }

  return <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900">
    <GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b80049]">Fleet operations · Fuel management</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Fuel Consumption</h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-500">Monitor actual fuel consumption across the fleet using recorded fuel-use and trip-distance measurements.</p>
      </header>

      {notice && <div role="status" className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-medium text-[#8e1647]">{notice}</div>}
      {loadError && <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</div>}
      {profileError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Fuel-measurement editing is unavailable because your profile could not be loaded: {profileError}</div>}

      <section aria-label="Consumption filters" className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.025] sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_auto]">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" /><input type="date" aria-label="Date from" value={dateFrom} max={dateTo || undefined} onChange={(event) => applyFilter(setDateFrom, event.target.value)} className="min-w-0 w-full py-2 text-[11px] outline-none" /><span className="text-[10px] text-slate-400">to</span><input type="date" aria-label="Date to" value={dateTo} min={dateFrom || undefined} onChange={(event) => applyFilter(setDateTo, event.target.value)} className="min-w-0 w-full py-2 text-[11px] outline-none" /></div>
        <SelectFilter label="Vehicle" value={vehicleFilter} onChange={(value) => applyFilter(setVehicleFilter, value)} options={filterOptions.vehicles} getLabel={(id) => String(vehicleById.get(id)?.plate_number || id)} />
        <SelectFilter label="Driver" value={driverFilter} onChange={(value) => applyFilter(setDriverFilter, value)} options={filterOptions.drivers} getLabel={(id) => { const record = records.find((item) => item.driverId === id); return record ? driverLabel(record, driverById.get(id)) : "Driver name unavailable"; }} />
        <SelectFilter label="Route" value={tripFilter} onChange={(value) => applyFilter(setTripFilter, value)} options={filterOptions.trips} getLabel={(id) => { const record = records.find((item) => item.id === id); return record ? routeLabel(record) : "Route name unavailable"; }} />
        <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#97003c]"><Download className="h-3.5 w-3.5" />Export Report</button>
      </section>

      <section aria-label="Fuel consumption metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hasConsumptionData && totalConsumed != null && <MetricCard title="Total Fuel Consumed" value={numberText(totalConsumed)} unit="L" support={`${consumptionRows.length} measured records`} icon={Truck} />}
        {totalDistance != null && <MetricCard title="Total Distance Traveled" value={numberText(totalDistance)} unit="km" support={`${distanceRows.length} trips with measured distance`} icon={ArrowDownWideNarrow} />}
        {averageLPer100 != null && <MetricCard title="Average Consumption" value={numberText(averageLPer100, 2)} unit="L / 100 km" support="Weighted from paired measurements" icon={Info} />}
        {hasConsumptionData && <MetricCard title="Vehicles with Consumption Records" value={String(vehiclesWithConsumption)} unit="" support="Vehicles with actual fuel-use entries" icon={UserRound} />}
      </section>

      <section aria-label="Fuel consumption analytics" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartPanel title="Fuel Consumption Trend" subtitle="Actual liters consumed by measurement date">
          {trendData.length ? <div className="h-[210px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} onClick={(event) => { const point = typeof event.activeTooltipIndex === "number" ? trendData[event.activeTooltipIndex] : undefined; const match = point?.sourceDate ? filteredRecords.find((record) => record.date?.slice(0, 10) === point.sourceDate && record.consumedLiters != null) : null; if (match?.id) setSelectedId(match.id); }} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis unit=" L" tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${numberText(Number(value), 2)} L`, "Consumed"]} /><Line type="monotone" dataKey="liters" name="Fuel consumed" stroke="#b80049" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <EmptyChart message="This data source has no verified fuel-consumed measurement. Refueling or purchased liters are intentionally excluded." />}
        </ChartPanel>
        <ChartPanel title="Consumption by Vehicle" subtitle="Measured fuel use by vehicle">
          {vehicleData.length ? <div className="h-[210px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={vehicleData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="vehicle" tick={{ fontSize: 9 }} /><YAxis unit=" L" tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [`${numberText(Number(value), 2)} L`, "Consumed"]} /><Bar dataKey="liters" name="Fuel consumed" fill="#b80049" radius={[4, 4, 0, 0]}>{vehicleData.map((item) => <Cell key={item.id} className="cursor-pointer" onClick={() => { const match = filteredRecords.find((record) => record.vehicleId === item.id && record.consumedLiters != null); if (match) setSelectedId(match.id); }} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyChart message="No actual fuel-consumed measurements are available to compare vehicles." />}
        </ChartPanel>
        <ChartPanel title="Distance vs. Fuel Consumed" subtitle="Measured kilometers against actual liters used">
          {scatterData.length ? <div className="h-[210px]"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}><CartesianGrid stroke="#edf0f3" /><XAxis type="number" dataKey="distance" name="Distance" unit=" km" tick={{ fontSize: 9 }} /><YAxis type="number" dataKey="liters" name="Fuel consumed" unit=" L" tick={{ fontSize: 9 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [`${numberText(Number(value), 2)}${name === "Distance" ? " km" : " L"}`, name]} /><Scatter data={scatterData} fill="#d63379" onClick={(point) => { const id = recordValue(point.payload)?.id; if (typeof id === "string" || typeof id === "number") setSelectedId(String(id)); }} /></ScatterChart></ResponsiveContainer></div> : <EmptyChart message="Both actual fuel consumed and valid trip distance are required. Fuel purchases alone do not establish consumption." />}
        </ChartPanel>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
        <section aria-label="Consumption records" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Consumption Records</h2><p className="mt-0.5 text-[10px] text-slate-500">Trip records and supported distance measurements · {filteredRecords.length} matching</p></div><label className="relative min-w-0 sm:w-64"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => applyFilter(setSearch, event.target.value)} placeholder="Search trip, vehicle, driver..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-[11px] outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" /></label></div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3"><SelectFilter label="Status" value={statusFilter} onChange={(value) => applyFilter(setStatusFilter, value)} options={[...new Set(records.map((record) => record.status.toLowerCase()))].filter((value) => value !== "not recorded").sort()} /><button type="button" onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"><ArrowDownWideNarrow className="h-3.5 w-3.5" />{sortKey === "date" ? "Date" : sortKey === "distance" ? "Distance" : "Vehicle"} · {sortAscending ? "Ascending" : "Descending"}</button><label className="sr-only">Sort field</label><select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600"><option value="date">Sort by date</option><option value="distance">Sort by distance</option><option value="vehicle">Sort by vehicle</option></select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-[10px]"><thead className="bg-[#fbf9fa] text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500"><tr><th className="px-3 py-2.5">Record ID</th><th className="px-3 py-2.5">Date / period</th><th className="px-3 py-2.5">Vehicle</th><th className="px-3 py-2.5">Driver</th><th className="px-3 py-2.5">Route</th><th className="px-3 py-2.5 text-right">Distance</th><th className="px-3 py-2.5 text-right">Fuel consumed</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5">Measurement source</th><th className="px-3 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">
            {visibleRecords.map((record) => { const vehicle = record.vehicleId ? vehicleById.get(record.vehicleId) : undefined; const driver = record.driverId ? driverById.get(record.driverId) : undefined; const rate = record.consumedLiters != null && record.distanceKm != null ? litersPer100Km(record.consumedLiters, record.distanceKm) : null; return <tr key={record.id} onClick={() => setSelectedId(record.id)} className={`cursor-pointer hover:bg-pink-50/50 ${selectedId === record.id ? "bg-pink-50/70" : ""}`} aria-selected={selectedId === record.id}><td className="px-3 py-2.5 font-mono font-bold text-[#a10040]">{record.id}</td><td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(record.date)}</td><td className="px-3 py-2.5 font-medium">{fieldText(vehicle?.plate_number || record.vehicleId)}</td><td className="px-3 py-2.5">{driverLabel(record, driver)}</td><td className="px-3 py-2.5">{routeLabel(record)}</td>{record.distanceKm == null ? <td className="px-3 py-2.5 text-right tabular-nums" /> : <td className="px-3 py-2.5 text-right tabular-nums">{`${numberText(record.distanceKm)} km`}</td>}{record.consumedLiters == null ? <td className="px-3 py-2.5 text-right tabular-nums" /> : <td className="px-3 py-2.5 text-right tabular-nums">{`${numberText(record.consumedLiters)} L`}</td>}{rate == null ? <td className="px-3 py-2.5 text-right tabular-nums" /> : <td className="px-3 py-2.5 text-right tabular-nums">{`${numberText(rate, 2)} L/100 km`}</td>}{record.distanceSource ? <td className="px-3 py-2.5">{record.distanceSource}</td> : <td className="px-3 py-2.5" />}{record.status ? <td className="px-3 py-2.5 capitalize">{record.status}</td> : <td className="px-3 py-2.5" />}</tr>; })}
            {loading && <tr><td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-500">Loading trip and measurement records…</td></tr>}
            {!loading && !visibleRecords.length && <tr><td colSpan={10} className="px-4 py-12 text-center"><p className="text-xs font-semibold text-slate-600">{loadError ? "Trip records unavailable" : "No trip records match these filters"}</p><p className="mt-1 text-[10px] text-slate-400">{loadError ? "Check your connection and access, then reload." : "Try a wider date range or clear one of the filters."}</p></td></tr>}
          </tbody></table></div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5"><p className="text-[10px] text-slate-500">{filteredRecords.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of ${filteredRecords.length}` : "0 records"}</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center text-[10px] font-semibold">{currentPage} / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div></footer>
        </section>

        <aside aria-label="Fuel Consumption Information" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b80049]">Measurement details</p><h2 className="mt-0.5 text-sm font-bold text-slate-900">Fuel Consumption Information</h2><p className="mt-0.5 text-[10px] text-slate-500">{selected ? selected.id : `${filteredRecords.length} filtered trip records`}</p></div>{selected && <button type="button" aria-label="Clear selection" onClick={() => setSelectedId(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}</div>
          {selected ? <div className="max-h-[780px] overflow-y-auto px-4">
            <DetailSection title="Consumption Record Details" defaultOpen><DetailField label="Record / trip ID" value={selected.id} /><DetailField label="Status" value={selected.status} /><DetailField label="Measurement date" value={formatDate(selected.date)} /><DetailField label="Source" value={selected.distanceSource} /><DetailField label="Created at" value={formatDate(timestamp({ created_at: selected.raw.created_at }))} /><DetailField label="Updated at" value={formatDate(timestamp({ created_at: selected.raw.updated_at }))} /></DetailSection>
            <DetailSection title="Vehicle Information" defaultOpen><DetailField label="Vehicle ID" value={selected.vehicleId} /><DetailField label="Plate number" value={selectedVehicle?.plate_number} /><DetailField label="Make / model" value={firstValue(selectedVehicle?.manufacturer, selectedVehicle?.make, selectedVehicle?.model)} /><DetailField label="Vehicle type" value={firstValue(selectedVehicle?.vehicle_type, selectedVehicle?.vehicleType, selectedVehicle?.type)} /><DetailField label="Fuel specification" value={firstValue(selectedVehicle?.fuel_type, selectedVehicle?.fuelType)} /><DetailField label="Current odometer" value={selectedVehicle?.mileage == null ? null : `${selectedVehicle.mileage} km`} /></DetailSection>
            <DetailSection title="Driver Information" defaultOpen><DetailField label="Driver name" value={driverLabel(selected, selectedDriver)} /><DetailField label="Driver ID" value={selected.driverId} /><DetailField label="Email" value={selectedDriver?.email} /><DetailField label="Phone" value={selectedDriver?.phone} /></DetailSection>
            <DetailSection title="Trip and Route Details" defaultOpen><DetailField label="Route name" value={routeLabel(selected)} /><DetailField label="Trip reference" value={selected.id} /><DetailField label="Trip status" value={selected.status} /><DetailField label="Origin" value={firstValue(selected.raw.from_location, selected.raw.origin, selectedRoutePlan?.pickup_location, selectedBooking?.pickup_location)} /><DetailField label="Destination" value={firstValue(selected.raw.to_location, selected.raw.destination, selectedRoutePlan?.destination, selectedBooking?.dropoff_location)} /><DetailField label="Trip started" value={formatDate(timestamp({ actual_departure: firstValue(selected.raw.actual_departure, selected.raw.departure_time, selected.raw.created_at) }))} /></DetailSection>
            <DetailSection title="Distance Measurements" defaultOpen><DetailField label="Start odometer" value={selected.startOdometer == null ? null : `${numberText(selected.startOdometer, 2)} km`} /><DetailField label="End odometer" value={selected.endOdometer == null ? null : `${numberText(selected.endOdometer, 2)} km`} /><DetailField label="Recorded actual distance" value={numeric(selected.raw.actual_distance_km) == null ? null : `${numberText(numeric(selected.raw.actual_distance_km), 2)} km`} /><DetailField label="Distance used" value={selected.distanceKm == null ? null : `${numberText(selected.distanceKm, 2)} km`} /><DetailField label="Distance calculation" value={selected.distanceSource} wide />{selected.distanceSource === "Invalid odometer sequence" && <p className="col-span-2 text-[10px] text-amber-700">Odometer values must be non-negative and the end reading must exceed the start reading.</p>}</DetailSection>
            <DetailSection title="Fuel Consumption Measurements" defaultOpen><DetailField label="Actual fuel consumed" value={selected.consumedLiters == null ? null : `${numberText(selected.consumedLiters, 2)} L`} /><DetailField label="Fuel-use source field" value={firstValue(selected.raw.actual_fuel_consumed_liters, selected.raw.fuel_consumed_liters, selected.raw.consumed_liters, selected.raw.fuel_used_liters) == null ? null : "Explicit trip consumption measurement"} /><DetailField label="Fuel type" value={firstValue(selected.raw.fuel_type, selectedVehicle?.fuel_type, selectedVehicle?.fuelType)} /><DetailField label="Refueling liters" value="Excluded; purchases are not consumption" wide />
              {canRecordFuelConsumption && selectedTripIsComplete && <div className="col-span-2 rounded-lg border border-pink-100 bg-pink-50/60 p-3">
                <label htmlFor="actual-fuel-consumed" className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500">Measured fuel consumed (L)</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="actual-fuel-consumed" type="number" min="0.001" step="0.001" value={fuelConsumptionInput} onChange={(event) => { if (selected) setFuelConsumptionDraft({ tripId: selected.id, value: event.target.value }); }} placeholder="Enter actual liters used" className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" />
                  <button type="button" onClick={saveFuelConsumption} disabled={savingFuelConsumption} className="shrink-0 rounded-md bg-[#b80049] px-3 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{savingFuelConsumption ? "Saving..." : "Save"}</button>
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">Enter fuel actually used for this completed trip. Do not copy the amount purchased during refueling.</p>
              </div>}
              {canRecordFuelConsumption && !selectedTripIsComplete && <p className="col-span-2 text-[10px] text-slate-500">Actual fuel use can be recorded after this trip is completed.</p>}
            </DetailSection>
            <DetailSection title="Consumption Calculation" defaultOpen><DetailField label="Rate (L / 100 km)" value={selectedRate == null ? null : `${numberText(selectedRate, 2)} L / 100 km`} /><DetailField label="Alternative (km / L)" value={selectedKmPerLiter == null ? null : `${numberText(selectedKmPerLiter, 2)} km / L`} /><DetailField label="Formula" value="Actual consumed liters ÷ valid actual kilometers × 100" wide /><DetailField label="Data availability" value={selected.consumedLiters == null ? "No actual fuel-use measurement on this trip" : "Computed from recorded trip measurements"} wide /></DetailSection>
            <DetailSection title="Comparison and Trends"><DetailField label="Current selection records" value={filteredRecords.length} /><DetailField label="Selected distance" value={selected.distanceKm == null ? null : `${numberText(selected.distanceKm)} km`} /><DetailField label="Comparison state" value={pairedRows.length ? `${pairedRows.length} trips have both measurements` : "No paired consumption and distance records"} wide /></DetailSection>
            <DetailSection title="Data Source"><DetailField label="Source record type" value="Trip record" /><DetailField label="Distance source" value={selected.distanceSource} /><DetailField label="Fuel source" value={selected.consumedLiters == null ? "No verified consumption field available" : "Explicit trip fuel-use field"} /><DetailField label="Purchase data" value="Not used for consumption" /></DetailSection>
            <DetailSection title="Record History"><DetailField label="Created at" value={selected.raw.created_at} /><DetailField label="Last updated" value={selected.raw.updated_at} /><DetailField label="History events" value={selectedEvents.length} />{selectedEvents.length ? selectedEvents.map((event, index) => <DetailField key={String(event.id ?? index)} label={fieldText(event.status) ?? "Event"} value={firstValue(event.created_at, event.remarks)} wide />) : <p className="col-span-2 text-[10px] text-slate-400">No trip event history is attached to this record.</p>}</DetailSection>
          </div> : <div className="px-4 py-5"><div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-[#b80049] shadow-sm"><Info className="h-4 w-4" /></span><p className="mt-2 text-xs font-bold text-slate-700">No measurement selected</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Select a trip record to inspect its real distance, vehicle, driver, odometer, and history details. Fuel-use values remain unavailable unless an actual consumed-fuel measurement is recorded.</p></div><div className="mt-4 space-y-3"><SummaryRow label="Filtered trips" value={String(filteredRecords.length)} /><SummaryRow label="Trips with valid distance" value={String(distanceRows.length)} /><SummaryRow label="Trips with actual fuel-use data" value={String(consumptionRows.length)} /><SummaryRow label="Date range" value={dateFrom || dateTo ? `${dateFrom || "Any date"} to ${dateTo || "Any date"}` : "All recorded dates"} /><SummaryRow label="Distance metric" value="km" /><SummaryRow label="Consumption metric" value="L / 100 km, requires paired measurements" /></div></div>}
        </aside>
      </section>
    </main>
    <GlobalFooter />
  </div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-[10px] text-slate-500">{label}</span><span className="max-w-[60%] text-right text-[10px] font-semibold text-slate-700">{value}</span></div>;
}