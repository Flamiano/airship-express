"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileImage,
  Fuel,
  Info,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import { fetchJson, getCurrentProfile, getDashboardSnapshot, getFuelLogs } from "../../../lib/api";
import { hasPermission } from "../../../lib/permissions";

type DataRecord = Record<string, unknown>;
type SortKey = "date" | "vehicle" | "driver" | "liters" | "cost" | "status";
type FuelTransaction = {
  id: string;
  raw: DataRecord;
  vehicleId: string | null;
  driverId: string | null;
  tripId: string | null;
  date: string | null;
  fuelType: string;
  liters: number | null;
  pricePerLiter: number | null;
  recordedCost: number | null;
  totalCost: number | null;
  costCalculated: boolean;
  station: string | null;
  odometer: number | null;
  receipt: string | null;
  receiptVerified: boolean;
  status: string;
  flags: string[];
  source: string;
  isLegacyFuelLog: boolean;
};

const EMPTY_RECORDS: DataRecord[] = [];
const PAGE_SIZES = [10, 25, 50];
const CHART_COLORS = ["#b80049", "#e04788", "#f28ab5", "#7b173f", "#fbbed5", "#a43c6d"];

function firstValue(...values: unknown[]) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function parseDetails(value: unknown): DataRecord {
  if (typeof value === "string") {
    try { return JSON.parse(value) as DataRecord; } catch { return {}; }
  }
  return value && typeof value === "object" ? value as DataRecord : {};
}

function numeric(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFuelType(value: unknown) {
  const text = String(value ?? "").trim().replace(/[_-]+/g, " ");
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function normalizeDate(record: DataRecord) {
  const value = firstValue(record.loggedAt, record.logged_at, record.entryDate, record.entry_date, record.createdAt, record.created_at);
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value: number | null, digits = 2) {
  return value == null ? "Not recorded" : `₱${value.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatNumber(value: number | null, digits = 2) {
  return value == null ? "Not recorded" : value.toLocaleString("en-PH", { maximumFractionDigits: digits });
}

function recordDetails(record: DataRecord) {
  return parseDetails(firstValue(record.category_details, record.categoryDetails, record.category_metadata, record.details));
}

function buildTransactions(logs: DataRecord[], entries: DataRecord[], vehicles: DataRecord[]) {
  const entryById = new Map(entries.map((entry) => [String(entry.id ?? entry.entry_id), entry]));
  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle]));
  return logs.map((log): FuelTransaction => {
    const id = String(firstValue(log.id, log.entry_id) || "");
    const raw = { ...(entryById.get(id) || {}), ...log };
    const details = recordDetails(raw);
    const vehicleId = firstValue(raw.vehicleId, raw.vehicle_id);
    const driverId = firstValue(raw.driverId, raw.driver_id);
    const tripId = firstValue(raw.tripId, raw.trip_id);
    const vehicle = vehicleId == null ? undefined : vehicleById.get(String(vehicleId));
    const litersValue = numeric(firstValue(raw.liters, details.liters, raw.quantity));
    const priceValue = numeric(firstValue(raw.pricePerLiter, raw.price_per_liter, details.price_per_liter));
    const amountValue = numeric(firstValue(raw.cost, raw.amount, raw.calculated_amount, raw.calculatedCost));
    const liters = litersValue != null && litersValue > 0 ? litersValue : null;
    const pricePerLiter = priceValue != null && priceValue > 0 ? priceValue : null;
    const recordedCost = amountValue != null && amountValue > 0 ? amountValue : null;
    const calculatedCost = liters != null && pricePerLiter != null ? liters * pricePerLiter : null;
    const totalCost = recordedCost ?? calculatedCost;
    const rawFlags = Array.isArray(raw.reviewFlags) ? raw.reviewFlags : Array.isArray(raw.review_flags) ? raw.review_flags : [];
    return {
      id,
      raw,
      vehicleId: vehicleId == null ? null : String(vehicleId),
      driverId: driverId == null ? null : String(driverId),
      tripId: tripId == null ? null : String(tripId),
      date: normalizeDate(raw),
      fuelType: normalizeFuelType(firstValue(raw.fuelType, raw.fuel_type, details.fuel_type, details.fuelType)),
      liters,
      pricePerLiter,
      recordedCost,
      totalCost,
      costCalculated: recordedCost == null && calculatedCost != null,
      station: firstValue(raw.station, raw.fuel_station, raw.fuelStation, details.fuel_station, details.fuelStation, details.location) == null
        ? null
        : String(firstValue(raw.station, raw.fuel_station, raw.fuelStation, details.fuel_station, details.fuelStation, details.location)),
      odometer: numeric(firstValue(raw.odometerReading, raw.odometer_reading, details.odometer_reading)),
      receipt: firstValue(raw.fuelReceiptImage, raw.receipt_image, raw.receiptImage) == null
        ? null
        : String(firstValue(raw.fuelReceiptImage, raw.receipt_image, raw.receiptImage)),
      receiptVerified: Boolean(firstValue(raw.receiptVerified, raw.receipt_verified)),
      status: String(firstValue(raw.reviewStatus, raw.review_status, raw.status) || "pending").toLowerCase(),
      flags: rawFlags.map(String),
      source: String(firstValue(raw.source_app, raw.sourceApp, raw.source_module, raw.sourceModule) || "Not recorded"),
      isLegacyFuelLog: raw.isLegacyFuelLog === true,
    };
  }).filter((record) => record.id);
}

function displayName(record: DataRecord | undefined, fallback: string | null) {
  return String(firstValue(record?.full_name, record?.name, record?.email, fallback) || "Name unavailable");
}

function routeLabel(trip: DataRecord | undefined) {
  if (!trip) return "Not linked";
  const routePlan = trip.routePlan && typeof trip.routePlan === "object" ? trip.routePlan as DataRecord : {};
  const booking = trip.bookings && typeof trip.bookings === "object" ? trip.bookings as DataRecord : {};
  const name = firstValue(trip.route_name, trip.routeName, trip.route_label, routePlan.route_name, routePlan.name);
  if (name) return String(name);
  const origin = firstValue(trip.from_location, trip.origin, routePlan.pickup_location, booking.pickup_location);
  const destination = firstValue(trip.to_location, trip.destination, booking.dropoff_location);
  return origin && destination ? `${origin} to ${destination}` : "Route unavailable";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "approved"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "rejected"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${classes}`}>{status}</span>;
}

function FilterSelect({ label, value, options, onChange, getLabel = (option: string) => option }: { label: string; value: string; options: string[]; onChange: (value: string) => void; getLabel?: (option: string) => string }) {
  return <label className="relative flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5"><span className="mr-2 shrink-0 text-[10px] text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full appearance-none bg-transparent py-2 pr-5 text-[11px] font-semibold text-slate-700 outline-none"><option value="all">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{getLabel(option)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" /></label>;
}

function MetricCard({ title, value, support, icon: Icon }: { title: string; value: string; support: string; icon: typeof Fuel }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-500">{title}</p><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-50 text-[#b80049]"><Icon className="h-4 w-4" /></span></div><p className="mt-3 truncate text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 truncate text-[10px] text-slate-500">{support}</p></article>;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]"><h2 className="text-xs font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p><div className="mt-3">{children}</div></article>;
}

function DetailSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen} className="group border-b border-slate-100 last:border-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-xs font-bold text-slate-700">{title}<ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" /></summary><div className="grid grid-cols-2 gap-x-3 gap-y-3 pb-3">{children}</div></details>;
}

function DetailField({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  const text = value == null || value === "" ? "Not recorded" : typeof value === "string" || typeof value === "number" ? String(value) : "Not recorded";
  return <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}><p className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className="mt-0.5 break-words text-[10px] font-medium text-slate-700">{text}</p></div>;
}

export default function FuelRefuelingLogPage() {
  const [snapshot, setSnapshot] = useState<DataRecord | null>(null);
  const [fuelLogs, setFuelLogs] = useState<DataRecord[]>([]);
  const [profile, setProfile] = useState<DataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [fuelTypeFilter, setFuelTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stationSearch, setStationSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [auditById, setAuditById] = useState<Record<string, DataRecord[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState({ vehicleId: "", driverId: "", tripId: "", loggedAt: new Date().toISOString().slice(0, 10), liters: "", pricePerLiter: "", odometerReading: "", fuelReceiptImage: "", fuelType: "", station: "", location: "", paymentMethod: "", referenceNumber: "" });
  const [reviewDialog, setReviewDialog] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const canCreate = hasPermission(profile?.role as string | null, "fuelManagement", "create");
  const canReview = hasPermission(profile?.role as string | null, "fuelManagement", "update");
  const vehicles = (snapshot?.vehicles as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const drivers = (snapshot?.drivers as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const trips = (snapshot?.trips as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const entries = (snapshot?.costEntries as DataRecord[] | undefined) ?? EMPTY_RECORDS;
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [String(driver.id), driver])), [drivers]);
  const tripById = useMemo(() => new Map(trips.map((trip) => [String(trip.id), trip])), [trips]);
  const allRows = useMemo(() => buildTransactions(fuelLogs, entries, vehicles), [fuelLogs, entries, vehicles]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getDashboardSnapshot(), getFuelLogs(), getCurrentProfile()])
      .then(([dashboardResult, logsResult, profileResult]) => {
        if (!active) return;
        const warnings: string[] = [];
        if (dashboardResult.status === "fulfilled") {
          setSnapshot(dashboardResult.value || {});
        } else {
          setSnapshot(null);
          warnings.push(`Vehicle, driver, and trip references unavailable: ${dashboardResult.reason instanceof Error ? dashboardResult.reason.message.replace(/^Request failed \d+: /, "") : "request failed"}`);
        }
        if (logsResult.status === "fulfilled") {
          setFuelLogs(logsResult.value.rows);
          warnings.push(...logsResult.value.sourceErrors);
          setLoadError(null);
        } else {
          setFuelLogs([]);
          setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message.replace(/^Request failed \d+: /, "") : "Fuel transactions could not be loaded.");
        }
        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value || null);
        } else {
          setProfile(null);
          warnings.push(`Reviewer profile unavailable: ${profileResult.reason instanceof Error ? profileResult.reason.message.replace(/^Request failed \d+: /, "") : "request failed"}`);
        }
        setSourceWarnings(warnings);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const options = useMemo(() => ({
    vehicles: [...new Set(allRows.map((row) => row.vehicleId).filter((id): id is string => Boolean(id)))].sort(),
    drivers: [...new Set(allRows.map((row) => row.driverId).filter((id): id is string => Boolean(id)))].sort(),
    fuelTypes: [...new Set(allRows.map((row) => row.fuelType).filter((type) => type !== "Not recorded"))].sort(),
    stations: [...new Set(allRows.map((row) => row.station).filter((station): station is string => Boolean(station)))].sort(),
    statuses: [...new Set(allRows.map((row) => row.status))].sort(),
  }), [allRows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const stationNeedle = stationSearch.trim().toLowerCase();
    return allRows.filter((row) => {
      if (vehicleFilter !== "all" && row.vehicleId !== vehicleFilter) return false;
      if (driverFilter !== "all" && row.driverId !== driverFilter) return false;
      if (fuelTypeFilter !== "all" && row.fuelType !== fuelTypeFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (dateFrom && (!row.date || row.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!row.date || row.date.slice(0, 10) > dateTo)) return false;
      if (stationNeedle && !String(row.station || "").toLowerCase().includes(stationNeedle)) return false;
      const vehicle = row.vehicleId ? vehicleById.get(row.vehicleId) : undefined;
      const driver = row.driverId ? driverById.get(row.driverId) : undefined;
      const trip = row.tripId ? tripById.get(row.tripId) : undefined;
      if (needle && ![row.id, row.vehicleId, vehicle?.plate_number, displayName(driver, row.driverId), row.fuelType, row.station, row.tripId, routeLabel(trip), row.status]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)) return false;
      return true;
    }).sort((left, right) => {
      let comparison = 0;
      if (sortKey === "date") comparison = String(left.date || "").localeCompare(String(right.date || ""));
      if (sortKey === "vehicle") comparison = String(vehicleById.get(left.vehicleId || "")?.plate_number || left.vehicleId || "").localeCompare(String(vehicleById.get(right.vehicleId || "")?.plate_number || right.vehicleId || ""));
      if (sortKey === "driver") comparison = displayName(driverById.get(left.driverId || ""), left.driverId).localeCompare(displayName(driverById.get(right.driverId || ""), right.driverId));
      if (sortKey === "liters") comparison = (left.liters ?? -1) - (right.liters ?? -1);
      if (sortKey === "cost") comparison = (left.totalCost ?? -1) - (right.totalCost ?? -1);
      if (sortKey === "status") comparison = left.status.localeCompare(right.status);
      return comparison * (sortAscending ? 1 : -1);
    });
  }, [allRows, vehicleFilter, driverFilter, fuelTypeFilter, statusFilter, dateFrom, dateTo, stationSearch, search, vehicleById, driverById, tripById, sortKey, sortAscending]);

  const transactionCount = filteredRows.length;
  const litersTotal = filteredRows.reduce((sum, row) => sum + (row.liters || 0), 0);
  const costRows = filteredRows.filter((row) => row.totalCost != null && row.totalCost > 0);
  const totalCost = costRows.length ? costRows.reduce((sum, row) => sum + (row.totalCost || 0), 0) : null;
  const validAverageRows = filteredRows.filter((row) => row.totalCost != null && row.totalCost > 0 && row.liters != null && row.liters > 0);
  const averagePrice = validAverageRows.length
    ? validAverageRows.reduce((sum, row) => sum + (row.totalCost || 0), 0) / validAverageRows.reduce((sum, row) => sum + (row.liters || 0), 0)
    : null;

  const activityData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredRows.forEach((row) => { if (row.date) grouped.set(row.date.slice(0, 10), (grouped.get(row.date.slice(0, 10)) || 0) + 1); });
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => ({ day: new Date(`${key}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), count }));
  }, [filteredRows]);

  const costTrendData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredRows.forEach((row) => { if (row.date && row.totalCost != null) grouped.set(row.date.slice(0, 10), (grouped.get(row.date.slice(0, 10)) || 0) + row.totalCost); });
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, amount]) => ({ day: new Date(`${key}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }), amount }));
  }, [filteredRows]);

  const fuelTypeData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredRows.forEach((row) => grouped.set(row.fuelType, (grouped.get(row.fuelType) || 0) + 1));
    return [...grouped.entries()].map(([name, count], index) => ({ name, count, color: CHART_COLORS[index % CHART_COLORS.length] })).sort((a, b) => b.count - a.count);
  }, [filteredRows]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = selectedId ? filteredRows.find((row) => row.id === selectedId) || null : null;
  const selectedVehicle = selected?.vehicleId ? vehicleById.get(selected.vehicleId) : undefined;
  const selectedDriver = selected?.driverId ? driverById.get(selected.driverId) : undefined;
  const selectedTrip = selected?.tripId ? tripById.get(selected.tripId) : undefined;
  const selectedDetails = selected ? recordDetails(selected.raw) : {};
  const selectedAudit = selected ? auditById[selected.id] || [] : [];
  const selectedAllVisible = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));

  function setFilter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }
  function clearFilters() {
    setDateFrom(""); setDateTo(""); setVehicleFilter("all"); setDriverFilter("all"); setFuelTypeFilter("all"); setStatusFilter("all"); setStationSearch(""); setSearch(""); setPage(1);
  }

  function exportReport() {
    const headers = ["transaction_id", "date_time", "vehicle_id", "vehicle", "driver_id", "driver", "trip_id", "fuel_type", "liters_purchased", "price_per_liter", "recorded_total_cost", "cost_source", "station", "odometer_km", "receipt_available", "receipt_verified", "approval_status", "source_module"];
    const lines = filteredRows.map((row) => {
      const trip = row.tripId ? tripById.get(row.tripId) : undefined;
      return [row.id, row.date, row.vehicleId, vehicleById.get(row.vehicleId || "")?.plate_number, row.driverId, displayName(row.driverId ? driverById.get(row.driverId) : undefined, row.driverId), row.tripId, row.fuelType, row.liters, row.pricePerLiter, row.totalCost, row.costCalculated ? "Calculated from liters x price" : row.recordedCost == null ? "Unavailable" : "Recorded total", row.station, row.odometer, row.receipt ? "Yes" : "No", row.receiptVerified ? "Yes" : "No", row.status, row.source || routeLabel(trip)].map(csvCell).join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `airship-refuel-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice(`Exported ${filteredRows.length} filtered transaction${filteredRows.length === 1 ? "" : "s"}.`);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function refreshTransactions() {
    const [logsResult, dashboardResult] = await Promise.allSettled([getFuelLogs(), getDashboardSnapshot()]);
    if (logsResult.status === "rejected") throw logsResult.reason;
    setFuelLogs(logsResult.value.rows);
    setSourceWarnings(logsResult.value.sourceErrors);
    if (dashboardResult.status === "fulfilled") {
      setSnapshot(dashboardResult.value || {});
    } else {
      setSnapshot(null);
      setSourceWarnings((current) => [...current, `Vehicle, driver, and trip references unavailable: ${dashboardResult.reason instanceof Error ? dashboardResult.reason.message.replace(/^Request failed \d+: /, "") : "request failed"}`]);
    }
  }

  async function loadAudit(id: string) {
    if (Object.prototype.hasOwnProperty.call(auditById, id) || !canReview) return;
    if (allRows.find((row) => row.id === id)?.isLegacyFuelLog) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const audit = await fetchJson(`/api/costs/${encodeURIComponent(id)}/audit`);
      setAuditById((current) => ({ ...current, [id]: Array.isArray(audit) ? audit : [] }));
    } catch (error) {
      setAuditError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Audit history could not be loaded.");
    } finally { setAuditLoading(false); }
  }

  async function createTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    const liters = Number(createForm.liters);
    const pricePerLiter = Number(createForm.pricePerLiter);
    if (!(liters > 0) || !(pricePerLiter > 0) || !createForm.vehicleId) {
      setNotice("Select a vehicle and enter valid liters and price per liter.");
      return;
    }
    setCreateBusy(true);
    try {
      await fetchJson("/api/fuel/logs", { method: "POST", body: JSON.stringify({
        vehicleId: createForm.vehicleId,
        driverId: createForm.driverId || null,
        tripId: createForm.tripId || null,
        liters,
        pricePerLiter,
        cost: liters * pricePerLiter,
        odometerReading: createForm.odometerReading ? Number(createForm.odometerReading) : null,
        fuelReceiptImage: createForm.fuelReceiptImage || null,
        fuelType: createForm.fuelType,
        station: createForm.station,
        location: createForm.location,
        paymentMethod: createForm.paymentMethod,
        referenceNumber: createForm.referenceNumber,
        loggedAt: createForm.loggedAt,
      }) });
      await refreshTransactions();
      setCreateOpen(false);
      setCreateForm({ vehicleId: "", driverId: "", tripId: "", loggedAt: new Date().toISOString().slice(0, 10), liters: "", pricePerLiter: "", odometerReading: "", fuelReceiptImage: "", fuelType: "", station: "", location: "", paymentMethod: "", referenceNumber: "" });
      setNotice("Refueling transaction submitted for review.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "The refueling transaction could not be submitted.");
    } finally { setCreateBusy(false); }
  }

  async function verifyReceipt(row: FuelTransaction) {
    if (row.isLegacyFuelLog) {
      setNotice("Legacy fuel records are read-only; receipt verification is available for cost-ledger records.");
      window.setTimeout(() => setNotice(null), 3500);
      return;
    }
    setReviewBusy(row.id);
    try {
      await fetchJson("/api/costs", { method: "PATCH", body: JSON.stringify({ id: row.id, action: "verify_receipt" }) });
      setAuditById((current) => { const next = { ...current }; delete next[row.id]; return next; });
      await refreshTransactions();
      setNotice("Receipt verification recorded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Receipt verification failed.");
    } finally { setReviewBusy(null); window.setTimeout(() => setNotice(null), 3500); }
  }

  async function confirmReview() {
    if (!reviewDialog || !canReview) return;
    if (allRows.find((row) => row.id === reviewDialog.id)?.isLegacyFuelLog) {
      setNotice("Legacy fuel records are read-only; review actions are available for cost-ledger records.");
      setReviewDialog(null);
      window.setTimeout(() => setNotice(null), 3500);
      return;
    }
    if (reviewDialog.action === "reject" && !reviewNotes.trim()) {
      setNotice("A rejection reason is required.");
      return;
    }
    setReviewBusy(reviewDialog.id);
    try {
      await fetchJson("/api/costs", { method: "PATCH", body: JSON.stringify({
        id: reviewDialog.id,
        action: "review",
        review_status: reviewDialog.action === "approve" ? "approved" : "rejected",
        review_notes: reviewNotes.trim() || null,
      }) });
      setAuditById((current) => { const next = { ...current }; delete next[reviewDialog.id]; return next; });
      setReviewDialog(null);
      setReviewNotes("");
      await refreshTransactions();
      setNotice(`Transaction ${reviewDialog.action === "approve" ? "approved" : "rejected"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "The review could not be saved.");
    } finally { setReviewBusy(null); window.setTimeout(() => setNotice(null), 3500); }
  }

  const changeSelection = (id: string) => {
    setSelectedId(id);
    void loadAudit(id);
  };
  const selectedCostIsUsable = selected?.totalCost != null && selected.totalCost > 0;

  return <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900">
    <GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b80049]">Fleet operations · Fuel management</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Refuel Log</h1><p className="mt-1 max-w-2xl text-xs text-slate-500">Review and manage fleet refueling transactions, receipts, and approval status.</p></div><div className="flex gap-2"><button type="button" onClick={exportReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-pink-200 hover:bg-pink-50"><Download className="h-3.5 w-3.5 text-[#b80049]" />Export Report</button>{canCreate && <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#b80049] px-3 py-2 text-xs font-bold text-white hover:bg-[#97003c]"><Plus className="h-3.5 w-3.5" />New Refuel</button>}</div></header>
      {notice && <div role="status" className="rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-medium text-[#8e1647]">{notice}</div>}
      {loadError && <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</div>}
      {sourceWarnings.length > 0 && <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0" />{sourceWarnings.join(" · ")}</div>}

      <section aria-label="Refueling filters" className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.025] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr_1fr_auto]">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" /><input type="date" aria-label="Date from" value={dateFrom} max={dateTo || undefined} onChange={(event) => setFilter(setDateFrom, event.target.value)} className="min-w-0 w-full py-2 text-[10px] outline-none" /><span className="text-[10px] text-slate-400">to</span><input type="date" aria-label="Date to" value={dateTo} min={dateFrom || undefined} onChange={(event) => setFilter(setDateTo, event.target.value)} className="min-w-0 w-full py-2 text-[10px] outline-none" /></div>
        <FilterSelect label="Vehicle" value={vehicleFilter} options={options.vehicles} onChange={(value) => setFilter(setVehicleFilter, value)} getLabel={(id) => String(vehicleById.get(id)?.plate_number || id)} />
        <FilterSelect label="Driver" value={driverFilter} options={options.drivers} onChange={(value) => setFilter(setDriverFilter, value)} getLabel={(id) => displayName(driverById.get(id), id)} />
        <FilterSelect label="Fuel type" value={fuelTypeFilter} options={options.fuelTypes} onChange={(value) => setFilter(setFuelTypeFilter, value)} />
        <label className="relative flex min-w-0 items-center rounded-lg border border-slate-200 px-2.5"><Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" /><input aria-label="Search by station" value={stationSearch} onChange={(event) => setFilter(setStationSearch, event.target.value)} placeholder="Station or location" className="min-w-0 w-full py-2 text-[11px] outline-none placeholder:text-slate-400" /></label>
        <FilterSelect label="Status" value={statusFilter} options={options.statuses} onChange={(value) => setFilter(setStatusFilter, value)} />
        <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Clear</button>
      </section>

      <section aria-label="Refuel transaction metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Refueling Transactions" value={transactionCount.toLocaleString()} support={`${filteredRows.filter((row) => row.status === "pending").length} pending review`} icon={Receipt} />
        <MetricCard title="Total Liters Purchased" value={filteredRows.some((row) => row.liters != null) ? `${formatNumber(litersTotal)} L` : "Not recorded"} support={`${filteredRows.filter((row) => row.liters != null).length} with recorded volume`} icon={Fuel} />
        <MetricCard title="Total Recorded Fuel Cost" value={formatMoney(totalCost, 0)} support={`${costRows.length} records with usable cost`} icon={CircleDollarSign} />
        <MetricCard title="Average Price per Liter" value={averagePrice == null ? "Not available" : `${formatMoney(averagePrice)}/L`} support={averagePrice == null ? "Requires valid liters and purchase cost" : "Weighted cost ÷ valid liters"} icon={ShieldCheck} />
      </section>

      <section aria-label="Refueling analytics" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartPanel title="Refueling Activity Trend" subtitle="Transactions by recorded date">
          {activityData.length ? <div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={activityData} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="day" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => [value, "Transactions"]} contentStyle={{ borderRadius: 8, borderColor: "#f1d7e2", fontSize: 10 }} /><Line type="monotone" dataKey="count" name="Transactions" stroke="#b80049" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <ChartEmpty loading={loading} text="No dated refueling transactions match these filters." />}
        </ChartPanel>
        <ChartPanel title="Fuel Cost Trend" subtitle="Recorded purchase cost by date">
          {costTrendData.length ? <div className="h-[205px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={costTrendData} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f3" /><XAxis dataKey="day" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} tickFormatter={(value) => `₱${Number(value).toLocaleString("en-PH", { notation: "compact" })}`} /><Tooltip formatter={(value) => [formatMoney(Number(value)), "Recorded cost"]} contentStyle={{ borderRadius: 8, borderColor: "#f1d7e2", fontSize: 10 }} /><Line type="monotone" dataKey="amount" name="Recorded cost" stroke="#d63379" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <ChartEmpty loading={loading} text="No recorded purchase costs match these filters." />}
        </ChartPanel>
        <ChartPanel title="Fuel Type Distribution" subtitle="Transaction count by recorded fuel type">
          {fuelTypeData.length ? <div className="grid min-h-[205px] grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)] items-center gap-2"><div className="h-[175px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={fuelTypeData} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="white" strokeWidth={2}>{fuelTypeData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [value, "Transactions"]} contentStyle={{ borderRadius: 8, borderColor: "#f1d7e2", fontSize: 10 }} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{fuelTypeData.map((item) => <div key={item.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{item.name}</span><span className="text-[10px] font-bold text-slate-800">{item.count}</span></div>)}</div></div> : <ChartEmpty loading={loading} text="Fuel type is not recorded for matching transactions." />}
        </ChartPanel>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
        <section aria-label="Refueling transactions" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Refueling Transactions</h2><p className="mt-0.5 text-[10px] text-slate-500">{filteredRows.length} transactions match the current filters{selectedIds.size ? ` · ${selectedIds.size} selected` : ""}</p></div><label className="relative min-w-0 sm:w-72"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search ID, vehicle, driver, trip..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-[11px] outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100" /></label></div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3"><button type="button" onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"><ArrowDownWideNarrow className="h-3.5 w-3.5" />{sortAscending ? "Oldest first" : "Newest first"}</button><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} aria-label="Sort transactions by" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600"><option value="date">Sort by date</option><option value="vehicle">Sort by vehicle</option><option value="driver">Sort by driver</option><option value="liters">Sort by liters</option><option value="cost">Sort by cost</option><option value="status">Sort by status</option></select><label className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">Rows<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 font-semibold text-slate-700">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1340px] text-left text-[10px]"><thead className="bg-[#fbf9fa] text-[9px] font-bold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-2 py-2.5"><input aria-label="Select visible transactions" type="checkbox" checked={selectedAllVisible} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); visibleRows.forEach((row) => event.target.checked ? next.add(row.id) : next.delete(row.id)); return next; })} className="accent-[#b80049]" /></th><th className="px-2 py-2.5">Transaction ID</th><th className="px-2 py-2.5">Date &amp; time</th><th className="px-2 py-2.5">Vehicle</th><th className="px-2 py-2.5">Driver</th><th className="px-2 py-2.5">Fuel type</th><th className="px-2 py-2.5 text-right">Liters</th><th className="px-2 py-2.5 text-right">Price / L</th><th className="px-2 py-2.5 text-right">Total cost</th><th className="px-2 py-2.5">Station / location</th><th className="px-2 py-2.5 text-right">Odometer</th><th className="px-2 py-2.5">Receipt</th><th className="px-2 py-2.5">Status</th><th className="px-2 py-2.5">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => { const vehicle = row.vehicleId ? vehicleById.get(row.vehicleId) : undefined; const driver = row.driverId ? driverById.get(row.driverId) : undefined; return <tr key={row.id} onClick={() => changeSelection(row.id)} className={`cursor-pointer hover:bg-pink-50/50 ${selectedId === row.id ? "bg-pink-50/70" : ""}`} aria-selected={selectedId === row.id}><td className="px-2 py-2.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select transaction ${row.id}`} checked={selectedIds.has(row.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; })} className="accent-[#b80049]" /></td><td className="px-2 py-2.5 font-mono font-bold text-[#a10040]">{row.id}</td><td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{formatDate(row.date)}</td><td className="px-2 py-2.5 font-semibold">{String(vehicle?.plate_number || row.vehicleId || "Not recorded")}</td><td className="px-2 py-2.5">{displayName(driver, row.driverId)}</td><td className="px-2 py-2.5">{row.fuelType}</td><td className="px-2 py-2.5 text-right tabular-nums">{row.liters == null ? "Not recorded" : `${formatNumber(row.liters)} L`}</td><td className="px-2 py-2.5 text-right tabular-nums">{row.pricePerLiter == null ? "Not recorded" : formatMoney(row.pricePerLiter)}</td><td className="px-2 py-2.5 text-right font-bold tabular-nums">{formatMoney(row.totalCost)}{row.costCalculated && <span className="block text-[9px] font-normal text-slate-400">Calculated</span>}</td><td className="max-w-32 truncate px-2 py-2.5" title={row.station || "Not recorded"}>{row.station || "Not recorded"}</td><td className="px-2 py-2.5 text-right tabular-nums">{row.odometer == null ? "Not recorded" : `${formatNumber(row.odometer)} km`}</td><td className="px-2 py-2.5">{row.receipt ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />Available</span> : <span className="text-rose-600">Missing</span>}</td><td className="px-2 py-2.5"><StatusBadge status={row.status} /></td><td className="px-2 py-2.5"><button type="button" onClick={(event) => { event.stopPropagation(); changeSelection(row.id); }} className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-600 hover:border-pink-200 hover:text-[#b80049]">Details</button></td></tr>; })}
            {loading && <tr><td colSpan={14} className="px-4 py-12 text-center text-xs text-slate-500">Loading refueling transactions…</td></tr>}
            {!loading && visibleRows.length === 0 && <tr><td colSpan={14} className="px-4 py-12 text-center"><p className="text-xs font-semibold text-slate-600">{loadError ? "Transactions unavailable" : "No transactions match these filters"}</p><p className="mt-1 text-[10px] text-slate-400">{loadError ? "Check your connection and access, then reload." : "Try changing the date range or clearing a filter."}</p></td></tr>}
          </tbody></table></div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5"><p className="text-[10px] text-slate-500">{filteredRows.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length}` : "0 transactions"}</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center text-[10px] font-semibold">{currentPage} / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div></footer>
        </section>

        <aside aria-label="Refuel information" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b80049]">Transaction details</p><h2 className="mt-0.5 text-sm font-bold text-slate-900">Refuel Information</h2><p className="mt-0.5 text-[10px] text-slate-500">{selected ? selected.id : `${filteredRows.length} filtered transactions`}</p></div>{selected && <button type="button" aria-label="Clear selection" onClick={() => setSelectedId(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}</div>
          {selected ? <div className="max-h-[820px] overflow-y-auto px-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-3"><div><p className="font-mono text-xs font-bold text-slate-900">{selected.id}</p><p className="mt-0.5 text-[10px] text-slate-500">{selected.source}</p></div><StatusBadge status={selected.status} /></div>
            {selected.isLegacyFuelLog && <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">Legacy fuel record · view only. New review actions are available for cost-ledger records.</p>}
            {selected.flags.length > 0 && <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900"><p className="font-bold">Review flags</p><ul className="mt-1 list-inside list-disc">{selected.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}
            <DetailSection title="Transaction Details" defaultOpen><DetailField label="Transaction ID" value={selected.id} /><DetailField label="Source module" value={selected.source} /><DetailField label="Submission status" value={selected.status === "pending" ? "Submitted · pending review" : selected.status} /><DetailField label="Approval status" value={selected.status} /><DetailField label="Date & time" value={formatDate(selected.date)} /><DetailField label="Created at" value={formatDate(normalizeDate({ created_at: selected.raw.created_at }))} /><DetailField label="Updated at" value={formatDate(normalizeDate({ updated_at: selected.raw.updated_at }))} /></DetailSection>
            <DetailSection title="Vehicle Information" defaultOpen><DetailField label="Vehicle ID" value={selected.vehicleId} /><DetailField label="Plate number" value={selectedVehicle?.plate_number} /><DetailField label="Make / model" value={firstValue(selectedVehicle?.manufacturer, selectedVehicle?.make, selectedVehicle?.model)} /><DetailField label="Vehicle type" value={firstValue(selectedVehicle?.vehicle_type, selectedVehicle?.vehicleType, selectedVehicle?.type)} /><DetailField label="Fuel specification" value={firstValue(selectedVehicle?.fuel_type, selectedVehicle?.fuelType)} /><DetailField label="Current mileage" value={selectedVehicle?.mileage == null ? null : `${selectedVehicle.mileage} km`} /></DetailSection>
            <DetailSection title="Driver Information" defaultOpen><DetailField label="Driver name" value={displayName(selectedDriver, selected.driverId)} /><DetailField label="Driver ID" value={selected.driverId} /><DetailField label="Email" value={selectedDriver?.email} /><DetailField label="Phone" value={selectedDriver?.phone} /></DetailSection>
            <DetailSection title="Fuel Measurements" defaultOpen><DetailField label="Fuel type" value={selected.fuelType} /><DetailField label="Liters purchased" value={selected.liters == null ? null : `${formatNumber(selected.liters)} L`} /><DetailField label="Price per liter" value={selected.pricePerLiter == null ? null : `${formatMoney(selected.pricePerLiter)}/L`} /><DetailField label="Odometer reading" value={selected.odometer == null ? null : `${formatNumber(selected.odometer)} km`} /><DetailField label="Quantity source" value="Recorded refueling transaction" /></DetailSection>
            <DetailSection title="Cost Breakdown" defaultOpen><DetailField label="Recorded transaction total" value={formatMoney(selected.recordedCost)} /><DetailField label="Calculated liters × price" value={selected.liters != null && selected.pricePerLiter != null ? formatMoney(selected.liters * selected.pricePerLiter) : null} /><DetailField label="Displayed purchase cost" value={formatMoney(selected.totalCost)} /><DetailField label="Cost basis" value={selected.costCalculated ? "Calculated from valid liters and price per liter" : selected.recordedCost != null ? "Recorded transaction amount" : "Not available"} wide /><DetailField label="Currency" value="PHP" /></DetailSection>
            <DetailSection title="Station and Location"><DetailField label="Station" value={selected.station} wide /><DetailField label="Location" value={firstValue(selected.raw.location, selectedDetails.location)} wide /><DetailField label="Payment method" value={firstValue(selected.raw.payment_method, selectedDetails.payment_method)} /><DetailField label="Reference number" value={firstValue(selected.raw.reference_number, selectedDetails.reference_number)} /></DetailSection>
            <DetailSection title="Related Trip"><DetailField label="Trip ID" value={selected.tripId} /><DetailField label="Route" value={routeLabel(selectedTrip)} /><DetailField label="Trip status" value={selectedTrip?.status} /><DetailField label="Origin" value={firstValue(selectedTrip?.from_location, selectedTrip?.bookings && typeof selectedTrip.bookings === "object" ? (selectedTrip.bookings as DataRecord).pickup_location : null)} /><DetailField label="Destination" value={firstValue(selectedTrip?.to_location, selectedTrip?.bookings && typeof selectedTrip.bookings === "object" ? (selectedTrip.bookings as DataRecord).dropoff_location : null)} /></DetailSection>
            <DetailSection title="Receipt and Attachments" defaultOpen><DetailField label="Receipt availability" value={selected.receipt ? "Available" : "Missing"} /><DetailField label="Receipt verification" value={selected.receiptVerified ? "Verified" : selected.receipt ? "Not verified" : "Not available"} /><DetailField label="Verified by" value={firstValue(selected.raw.receipt_verifier_name, selected.raw.receipt_verified_by)} /><DetailField label="Verified at" value={selected.raw.receipt_verified_at} />{selected.receipt && <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><div className="mb-2 flex items-center justify-between"><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600"><FileImage className="h-3.5 w-3.5" />Receipt preview</span><a href={selected.receipt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a10040]">View receipt<ExternalLink className="h-3 w-3" /></a></div><a href={selected.receipt} target="_blank" rel="noreferrer" aria-label={`Open receipt for ${selected.id}`}><Image src={selected.receipt} alt={`Receipt for ${selected.id}`} width={640} height={480} unoptimized className="max-h-40 w-full rounded-md bg-white object-contain" /></a></div>}</DetailSection>
            <DetailSection title="Approval History" defaultOpen><DetailField label="Status" value={selected.status} /><DetailField label="Reviewer" value={firstValue(selected.raw.reviewer_name, selected.raw.reviewed_by)} /><DetailField label="Reviewed at" value={selected.raw.reviewed_at} /><DetailField label="Reviewer remarks" value={firstValue(selected.raw.review_notes, selected.raw.remarks)} wide />{canReview ? auditLoading ? <p className="col-span-2 text-[10px] text-slate-400">Loading audit history…</p> : auditError ? <p className="col-span-2 text-[10px] text-amber-700">{auditError}</p> : selectedAudit.length ? <div className="col-span-2 space-y-2">{selectedAudit.map((audit, index) => <div key={String(audit.id ?? index)} className="border-l-2 border-pink-200 pl-2 text-[10px]"><p className="font-semibold capitalize">{String(audit.action || "Change").replace(/_/g, " ")}</p><p className="text-slate-500">{String(audit.actor_name || audit.actor_id || "Actor unavailable")} · {formatDate(String(audit.changed_at || ""))}</p><p className="text-slate-600">{String((audit.new_values as DataRecord | undefined)?.review_notes || "")}</p></div>)}</div> : <p className="col-span-2 text-[10px] text-slate-400">No review audit entries.</p> : <p className="col-span-2 text-[10px] text-slate-400">Review history is restricted to fuel reviewers.</p>}</DetailSection>
            <DetailSection title="Audit Trail"><DetailField label="Transaction ID" value={selected.id} /><DetailField label="Created by" value={firstValue(selected.raw.created_by, selected.raw.submitted_by)} /><DetailField label="Updated at" value={selected.raw.updated_at} /><DetailField label="Remarks" value={firstValue(selected.raw.remarks, selected.raw.description, selectedDetails.note)} wide /><DetailField label="Review flags" value={selected.flags.length ? selected.flags.join("; ") : "None recorded"} wide /></DetailSection>
            {selected.receipt && !selected.receiptVerified && canReview && !selected.isLegacyFuelLog && <button type="button" disabled={reviewBusy === selected.id} onClick={() => void verifyReceipt(selected)} className="my-3 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{reviewBusy === selected.id ? "Saving…" : "Verify receipt"}</button>}
            {canReview && !selected.isLegacyFuelLog && <div className="flex gap-2 py-3">{selected.status !== "approved" && <button disabled={reviewBusy === selected.id || !selectedCostIsUsable || !selected.receipt} title={!selectedCostIsUsable || !selected.receipt ? "Approval requires a recorded cost and receipt" : undefined} onClick={() => { setReviewNotes(""); setReviewDialog({ id: selected.id, action: "approve" }); }} className="rounded-lg bg-[#b80049] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Approve</button>}{selected.status !== "rejected" && <button disabled={reviewBusy === selected.id} onClick={() => { setReviewNotes(""); setReviewDialog({ id: selected.id, action: "reject" }); }} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>}</div>}
          </div> : <div className="px-4 py-5"><div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-[#b80049] shadow-sm"><Info className="h-4 w-4" /></span><p className="mt-2 text-xs font-bold text-slate-700">No transaction selected</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Select a row to inspect its source, amounts, receipt, linked trip, and review history.</p></div><div className="mt-4 space-y-3"><SummaryRow label="Filtered transactions" value={String(transactionCount)} /><SummaryRow label="Total liters" value={filteredRows.some((row) => row.liters != null) ? `${formatNumber(litersTotal)} L` : "Not recorded"} /><SummaryRow label="Recorded fuel cost" value={formatMoney(totalCost, 0)} /><SummaryRow label="Pending review" value={String(filteredRows.filter((row) => row.status === "pending").length)} /><SummaryRow label="Date range" value={dateFrom || dateTo ? `${dateFrom || "Any date"} to ${dateTo || "Any date"}` : "All recorded dates"} /><SummaryRow label="Vehicle filter" value={vehicleFilter === "all" ? "All vehicles" : String(vehicleById.get(vehicleFilter)?.plate_number || vehicleFilter)} /><SummaryRow label="Fuel type filter" value={fuelTypeFilter === "all" ? "All recorded types" : fuelTypeFilter} /></div></div>}
        </aside>
      </section>
    </main>
    <GlobalFooter />

    {createOpen && <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !createBusy) setCreateOpen(false); }}>
      <form onSubmit={(event) => void createTransaction(event)} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 className="text-sm font-bold text-slate-900">New refueling transaction</h2><p className="mt-1 text-[10px] text-slate-500">A submitted transaction is created as pending review.</p></div><button type="button" aria-label="Close form" onClick={() => setCreateOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-semibold text-slate-600">Vehicle *<select required value={createForm.vehicleId} onChange={(event) => setCreateForm((form) => ({ ...form, vehicleId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={String(vehicle.id ?? vehicle.vehicle_id)} value={String(vehicle.id ?? vehicle.vehicle_id)}>{String(vehicle.plate_number || vehicle.id || vehicle.vehicle_id)}</option>)}</select></label>
          <label className="text-[10px] font-semibold text-slate-600">Driver<select value={createForm.driverId} onChange={(event) => setCreateForm((form) => ({ ...form, driverId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="">Not assigned</option>{drivers.map((driver) => <option key={String(driver.id)} value={String(driver.id)}>{String(driver.full_name || driver.email || driver.id)}</option>)}</select></label>
          <label className="text-[10px] font-semibold text-slate-600">Related trip<select value={createForm.tripId} onChange={(event) => setCreateForm((form) => ({ ...form, tripId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="">Not linked</option>{trips.map((trip) => <option key={String(trip.id)} value={String(trip.id)}>{String(trip.id)} · {routeLabel(trip)}</option>)}</select></label>
          <label className="text-[10px] font-semibold text-slate-600">Date *<input required type="date" value={createForm.loggedAt} onChange={(event) => setCreateForm((form) => ({ ...form, loggedAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Liters purchased *<input required min="0.01" step="0.01" type="number" value={createForm.liters} onChange={(event) => setCreateForm((form) => ({ ...form, liters: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Price per liter *<input required min="0.01" step="0.01" type="number" value={createForm.pricePerLiter} onChange={(event) => setCreateForm((form) => ({ ...form, pricePerLiter: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Fuel type<input value={createForm.fuelType} onChange={(event) => setCreateForm((form) => ({ ...form, fuelType: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Fuel station<input value={createForm.station} onChange={(event) => setCreateForm((form) => ({ ...form, station: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Location<input value={createForm.location} onChange={(event) => setCreateForm((form) => ({ ...form, location: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Payment method<input value={createForm.paymentMethod} onChange={(event) => setCreateForm((form) => ({ ...form, paymentMethod: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Reference number<input value={createForm.referenceNumber} onChange={(event) => setCreateForm((form) => ({ ...form, referenceNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Odometer reading<input min="0" step="0.1" type="number" value={createForm.odometerReading} onChange={(event) => setCreateForm((form) => ({ ...form, odometerReading: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Receipt URL<input type="url" value={createForm.fuelReceiptImage} onChange={(event) => setCreateForm((form) => ({ ...form, fuelReceiptImage: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" placeholder="Optional" /></label>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[10px] text-slate-500">Total cost is recorded as liters × price per liter. Refueling purchases are not shown as fuel consumed.</p>
        <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={createBusy} onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={createBusy} className="rounded-lg bg-[#b80049] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{createBusy ? "Submitting…" : "Submit for review"}</button></div>
      </form>
    </div>}
    {reviewDialog && <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4"><section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><h2 className="text-sm font-bold text-slate-900">{reviewDialog.action === "approve" ? "Approve this refuel transaction?" : "Reject this refuel transaction?"}</h2><p className="mt-1 text-[10px] text-slate-500">{reviewDialog.id} · {reviewDialog.action === "reject" ? "A rejection reason is required." : "This updates the existing source record."}</p><textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} maxLength={1000} placeholder={reviewDialog.action === "reject" ? "Reason for rejection" : "Optional reviewer remarks"} className="mt-4 w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-pink-300" /><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={Boolean(reviewBusy)} onClick={() => setReviewDialog(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="button" disabled={Boolean(reviewBusy) || (reviewDialog.action === "reject" && !reviewNotes.trim())} onClick={() => void confirmReview()} className="rounded-lg bg-[#b80049] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{reviewBusy ? "Saving…" : "Confirm"}</button></div></section></div>}
  </div>;
}

function ChartEmpty({ loading, text }: { loading: boolean; text: string }) {
  return <div className="grid h-[205px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[10px] text-slate-400">{loading ? "Loading transactions…" : text}</div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-[10px] text-slate-500">{label}</span><span className="max-w-[60%] text-right text-[10px] font-semibold text-slate-700">{value}</span></div>;
}