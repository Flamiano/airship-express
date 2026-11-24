"use client";

import Image from "next/image";
import { isValidElement, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  Banknote,
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
  Receipt,
  Search,
  X,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlobalNavbar from "../../components/global/GlobalNavbar";
import GlobalFooter from "../../components/global/GlobalFooter";
import { fetchJson, getCurrentProfile, getDashboardSnapshot, getFuelLogs } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

// Fuel API records have a server-normalized shape plus optional source fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
const EMPTY_RECORDS: AnyRecord[] = [];
type FuelTab = "records" | "costs" | "liters";
type FuelRow = {
  id: string;
  raw: AnyRecord;
  vehicleId: string | null;
  driverId: string | null;
  tripId: string | null;
  date: string | null;
  liters: number | null;
  pricePerLiter: number | null;
  recordedCost: number | null;
  totalCost: number | null;
  fuelType: string;
  source: string;
  station: string | null;
  receipt: string | null;
  receiptVerified: boolean;
  status: string;
  flags: string[];
  isLegacyFuelLog: boolean;
};

const PINKS = ["#b80049", "#e04788", "#f28ab5", "#7b173f", "#fbbed5", "#a43c6d"];
const PAGE_SIZE = 10;
const currency = (value: number | null, digits = 2) => value == null
  ? "Not recorded"
  : `₱${value.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const numberText = (value: number | null, digits = 2) => value == null
  ? "Not recorded"
  : value.toLocaleString("en-PH", { maximumFractionDigits: digits });
const textValue = (value: unknown) => value == null || String(value).trim() === "" ? "Not recorded" : String(value);

function parseDetails(value: unknown): AnyRecord {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function firstValue(...values: unknown[]) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function validNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeFuelType(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Not recorded";
  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateFor(row: AnyRecord) {
  const value = firstValue(row.loggedAt, row.logged_at, row.entryDate, row.entry_date, row.createdAt, row.created_at, row.recorded_at);
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value: string | null, includeTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-PH", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function getVehicleFuelType(vehicle: AnyRecord | undefined) {
  return firstValue(vehicle?.fuel_type, vehicle?.fuelType, vehicle?.fuel_type_name);
}

function buildRows(logs: AnyRecord[], rawEntries: AnyRecord[], vehicles: AnyRecord[]) {
  const entryById = new Map(rawEntries.map((entry) => [String(entry.id ?? entry.entry_id), entry]));
  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle]));
  return logs.map((log): FuelRow => {
    const id = String(log.id ?? log.entry_id ?? "");
    const raw = { ...(entryById.get(id) || {}), ...log };
    const details = parseDetails(firstValue(raw.category_details, raw.categoryDetails, raw.category_metadata, raw.details));
    const vehicleId = firstValue(raw.vehicleId, raw.vehicle_id);
    const vehicle = vehicleId ? vehicleById.get(String(vehicleId)) : undefined;
    const liters = validNumber(firstValue(raw.liters, details.liters, raw.quantity));
    const pricePerLiter = validNumber(firstValue(raw.pricePerLiter, raw.price_per_liter, details.price_per_liter));
    const recordedCost = validNumber(firstValue(raw.cost, raw.amount, raw.calculated_amount));
    const calculatedCost = liters != null && liters > 0 && pricePerLiter != null && pricePerLiter > 0
      ? liters * pricePerLiter
      : null;
    const totalCost = recordedCost != null && recordedCost > 0 ? recordedCost : calculatedCost;
    const explicitFuelType = firstValue(raw.fuelType, raw.fuel_type, details.fuel_type, details.fuelType);
    const fuelType = normalizeFuelType(explicitFuelType ?? getVehicleFuelType(vehicle));
    const source = firstValue(raw.source_app, raw.sourceApp, raw.source_module, raw.sourceModule);
    const flags = Array.isArray(raw.reviewFlags) ? raw.reviewFlags : Array.isArray(raw.review_flags) ? raw.review_flags : [];
    const rawDriverId = firstValue(raw.driverId, raw.driver_id);
    const rawTripId = firstValue(raw.tripId, raw.trip_id);
    return {
      id,
      raw,
      vehicleId: vehicleId == null ? null : String(vehicleId),
      driverId: rawDriverId == null ? null : String(rawDriverId),
      tripId: rawTripId == null ? null : String(rawTripId),
      date: dateFor(raw),
      liters: liters != null && liters > 0 ? liters : null,
      pricePerLiter: pricePerLiter != null && pricePerLiter > 0 ? pricePerLiter : null,
      recordedCost: recordedCost != null && recordedCost > 0 ? recordedCost : null,
      totalCost,
      fuelType,
      source: source == null ? "Not recorded" : String(source),
      station: firstValue(raw.station, raw.fuel_station, raw.fuelStation, details.fuel_station, details.fuelStation, details.location) as string | null,
      receipt: firstValue(raw.fuelReceiptImage, raw.receipt_image, raw.receiptImage) as string | null,
      receiptVerified: Boolean(firstValue(raw.receiptVerified, raw.receipt_verified)),
      status: String(firstValue(raw.reviewStatus, raw.review_status, raw.status) || "pending").toLowerCase(),
      flags: flags.map(String),
      isLegacyFuelLog: raw.isLegacyFuelLog === true,
    };
  }).filter((row) => row.id);
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function displaySource(source: string) {
  const value = source.replace(/[_-]+/g, " ").trim();
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "approved"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "rejected"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${style}`}>{status}</span>;
}

function MetricCard({ label, value, support, icon: Icon }: { label: string; value: string; support: string; icon: typeof Fuel }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-50 text-[#b80049]"><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-3 truncate text-2xl font-bold tracking-normal text-slate-900">{value}</p>
    <p className="mt-1 truncate text-[11px] text-slate-500">{support}</p>
  </article>;
}

function DetailSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen} className="group border-b border-slate-100 last:border-0">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-xs font-bold text-slate-700">
      {title}<ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" />
    </summary>
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 pb-3">{children}</div>
  </details>;
}

function DetailField({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  return <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
    <div className="mt-0.5 break-words text-[11px] font-medium text-slate-700">{renderDetailValue(value)}</div>
  </div>;
}

function renderDetailValue(value: unknown): React.ReactNode {
  if (value == null || value === "") return "Not recorded";
  if (isValidElement(value)) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return "Not recorded";
}

export default function FuelOverviewPage() {
  const [snapshot, setSnapshot] = useState<AnyRecord | null>(null);
  const [fuelLogs, setFuelLogs] = useState<AnyRecord[]>([]);
  const [profile, setProfile] = useState<AnyRecord | null>(null);
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
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FuelTab>("records");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [auditById, setAuditById] = useState<Record<string, AnyRecord[]>>({});
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const canReviewFuel = hasPermission(profile?.role, "fuelManagement", "update");
  const vehicles = (snapshot?.vehicles as AnyRecord[] | undefined) ?? EMPTY_RECORDS;
  const drivers = (snapshot?.drivers as AnyRecord[] | undefined) ?? EMPTY_RECORDS;
  const trips = (snapshot?.trips as AnyRecord[] | undefined) ?? EMPTY_RECORDS;
  const rawEntries = (snapshot?.costEntries as AnyRecord[] | undefined) ?? EMPTY_RECORDS;
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id ?? vehicle.vehicle_id), vehicle])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [String(driver.id), driver])), [drivers]);
  const tripById = useMemo(() => new Map(trips.map((trip) => [String(trip.id), trip])), [trips]);
  const rows = useMemo(() => buildRows(fuelLogs, rawEntries, vehicles), [fuelLogs, rawEntries, vehicles]);

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
          setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message.replace(/^Request failed \d+: /, "") : "Fuel records could not be loaded.");
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

  const filterOptions = useMemo(() => ({
    fuelTypes: [...new Set(rows.map((row) => row.fuelType).filter((value) => value !== "Not recorded"))].sort(),
    vehicles: [...new Set(rows.map((row) => row.vehicleId).filter((value): value is string => Boolean(value)))].sort(),
    drivers: [...new Set(rows.map((row) => row.driverId).filter((value): value is string => Boolean(value)))].sort(),
  }), [rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (vehicleFilter !== "all" && row.vehicleId !== vehicleFilter) return false;
      if (driverFilter !== "all" && row.driverId !== driverFilter) return false;
      if (fuelTypeFilter !== "all" && row.fuelType !== fuelTypeFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (dateFrom && (!row.date || row.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!row.date || row.date.slice(0, 10) > dateTo)) return false;
      if (needle) {
        const vehicle = row.vehicleId ? vehicleById.get(row.vehicleId) : undefined;
        const driver = row.driverId ? driverById.get(row.driverId) : undefined;
        const haystack = [row.id, row.source, row.vehicleId, vehicle?.plate_number, row.driverId, driver?.full_name, driver?.email, row.fuelType, row.station, row.tripId, row.status]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    }).sort((a, b) => {
      const left = a.date ? new Date(a.date).getTime() : 0;
      const right = b.date ? new Date(b.date).getTime() : 0;
      return (left - right) * (sortAscending ? 1 : -1);
    });
  }, [rows, vehicleFilter, driverFilter, fuelTypeFilter, statusFilter, dateFrom, dateTo, search, vehicleById, driverById, sortAscending]);

  const totals = useMemo(() => {
    const pricedRows = filteredRows.filter((row) => row.totalCost != null && row.totalCost > 0);
    const validLiters = filteredRows.filter((row) => row.liters != null && row.liters > 0);
    const totalCost = pricedRows.reduce((sum, row) => sum + (row.totalCost || 0), 0);
    const totalLiters = validLiters.reduce((sum, row) => sum + (row.liters || 0), 0);
    const validPurchaseRows = filteredRows.filter((row) => row.totalCost != null && row.totalCost > 0 && row.liters != null && row.liters > 0);
    const validCost = validPurchaseRows.reduce((sum, row) => sum + (row.totalCost || 0), 0);
    const validVolume = validPurchaseRows.reduce((sum, row) => sum + (row.liters || 0), 0);
    return {
      cost: pricedRows.length ? totalCost : null,
      liters: validLiters.length ? totalLiters : null,
      average: validVolume > 0 ? validCost / validVolume : null,
      refuelings: filteredRows.length,
      approvedCost: pricedRows.filter((row) => row.status === "approved").reduce((sum, row) => sum + (row.totalCost || 0), 0),
      pending: filteredRows.filter((row) => row.status === "pending").length,
      pricedRows: pricedRows.length,
    };
  }, [filteredRows]);

  const trendData = useMemo(() => {
    const datedRows = filteredRows.filter((row) => row.date && row.totalCost != null);
    if (!datedRows.length) return [] as { period: string; amount: number }[];
    const first = Math.min(...datedRows.map((row) => new Date(row.date!).getTime()));
    const last = Math.max(...datedRows.map((row) => new Date(row.date!).getTime()));
    const spanDays = Math.max(1, (last - first) / 86400000);
    const keyFor = (date: Date) => {
      if (spanDays <= 31) return date.toISOString().slice(0, 10);
      if (spanDays <= 120) {
        const start = new Date(date);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        return start.toISOString().slice(0, 10);
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    };
    const totalsByPeriod = new Map<string, number>();
    datedRows.forEach((row) => {
      const key = keyFor(new Date(row.date!));
      totalsByPeriod.set(key, (totalsByPeriod.get(key) || 0) + (row.totalCost || 0));
    });
    return [...totalsByPeriod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, amount]) => ({
      period: spanDays > 120
        ? new Date(`${period}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "2-digit" })
        : new Date(`${period}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      amount,
    }));
  }, [filteredRows]);

  const vehicleChart = useMemo(() => {
    const totalsByVehicle = new Map<string, number>();
    filteredRows.forEach((row) => {
      if (row.totalCost == null) return;
      const key = row.vehicleId || "Vehicle not recorded";
      totalsByVehicle.set(key, (totalsByVehicle.get(key) || 0) + row.totalCost);
    });
    return [...totalsByVehicle.entries()].map(([id, value], index) => ({
      id,
      name: id === "Vehicle not recorded" ? id : String(vehicleById.get(id)?.plate_number || id),
      value,
      color: PINKS[index % PINKS.length],
    })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredRows, vehicleById]);

  const fuelChart = useMemo(() => {
    const totalsByType = new Map<string, number>();
    filteredRows.forEach((row) => {
      if (row.totalCost == null) return;
      totalsByType.set(row.fuelType, (totalsByType.get(row.fuelType) || 0) + row.totalCost);
    });
    return [...totalsByType.entries()].map(([name, value], index) => ({ name, value, color: PINKS[index % PINKS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows]);

  const tableRows = tab === "costs"
    ? filteredRows.filter((row) => row.totalCost != null)
    : tab === "liters"
      ? filteredRows.filter((row) => row.liters != null)
      : filteredRows;
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = tableRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = selectedId ? filteredRows.find((row) => row.id === selectedId) || null : null;
  const selectedVehicle = selected?.vehicleId ? vehicleById.get(selected.vehicleId) : undefined;
  const selectedDriver = selected?.driverId ? driverById.get(selected.driverId) : undefined;
  const selectedTrip = selected?.tripId ? tripById.get(selected.tripId) : undefined;
  const selectedDetails = selected ? parseDetails(firstValue(selected.raw.category_details, selected.raw.categoryDetails, selected.raw.category_metadata)) : {};
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setDateFrom(""); setDateTo(""); setVehicleFilter("all"); setDriverFilter("all");
    setFuelTypeFilter("all"); setStatusFilter("all"); setSearch(""); setPage(1);
  }

  async function selectRecord(id: string) {
    setSelectedId(id);
    const entry = rows.find((row) => row.id === id);
    if (!canReviewFuel || entry?.isLegacyFuelLog || Object.prototype.hasOwnProperty.call(auditById, id)) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const audit = await fetchJson(`/api/costs/${encodeURIComponent(id)}/audit`);
      setAuditById((current) => ({ ...current, [id]: Array.isArray(audit) ? audit : [] }));
    } catch (error) {
      setAuditError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Audit history is unavailable.");
    } finally {
      setAuditLoading(false);
    }
  }

  function exportReport() {
    const columns = ["transaction_id", "date_time", "source", "vehicle_id", "driver_id", "fuel_type", "liters", "price_per_liter", "total_cost", "station", "receipt_available", "status"];
    const lines = filteredRows.map((row) => [row.id, row.date, row.source, row.vehicleId, row.driverId, row.fuelType, row.liters, row.pricePerLiter, row.totalCost, row.station, row.receipt ? "Yes" : "No", row.status]
      .map(csvCell).join(","));
    const blob = new Blob([[columns.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `airship-fuel-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice(`Exported ${filteredRows.length} filtered fuel record${filteredRows.length === 1 ? "" : "s"}.`);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function reviewFuelEntry(id: string, action: "verify_receipt" | "approve" | "reject") {
    const entry = rows.find((row) => row.id === id);
    if (!entry) return;
    if (entry.isLegacyFuelLog) {
      setNotice("Legacy fuel records are read-only; review actions are available for cost-ledger records.");
      window.setTimeout(() => setNotice(null), 3500);
      return;
    }
    const reviewNotes = action === "reject" ? window.prompt("Reason for rejection") : null;
    if (action === "reject" && !reviewNotes?.trim()) return;
    if (action === "approve" && (entry.liters == null || entry.pricePerLiter == null || !entry.receipt)) {
      setNotice("Fuel approval requires recorded liters, price per liter, and a receipt.");
      window.setTimeout(() => setNotice(null), 3500);
      return;
    }
    setReviewBusy(id);
    try {
      await fetchJson("/api/costs", {
        method: "PATCH",
        body: JSON.stringify(action === "verify_receipt"
          ? { id, action: "verify_receipt" }
          : { id, action: "review", review_status: action === "approve" ? "approved" : "rejected", review_notes: reviewNotes }),
      });
      window.localStorage.setItem("ftm:costs-updated", String(Date.now()));
      window.dispatchEvent(new Event("ftm:costs-updated"));
      const [freshLogsResult, freshSnapshotResult] = await Promise.allSettled([getFuelLogs(), getDashboardSnapshot()]);
      if (freshLogsResult.status === "rejected") throw freshLogsResult.reason;
      setFuelLogs(freshLogsResult.value.rows);
      setSourceWarnings(freshLogsResult.value.sourceErrors);
      if (freshSnapshotResult.status === "fulfilled") {
        setSnapshot(freshSnapshotResult.value || {});
      } else {
        setSnapshot(null);
        setSourceWarnings((current) => [...current, `Vehicle, driver, and trip references unavailable: ${freshSnapshotResult.reason instanceof Error ? freshSnapshotResult.reason.message.replace(/^Request failed \d+: /, "") : "request failed"}`]);
      }
      setAuditById((current) => { const next = { ...current }; delete next[id]; return next; });
      setNotice(action === "verify_receipt" ? "Receipt verification recorded." : `Fuel expense ${action === "approve" ? "approved" : "rejected"}.`);
      setAuditError(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Could not update the fuel expense.");
    } finally {
      setReviewBusy(null);
      window.setTimeout(() => setNotice(null), 3500);
    }
  }

  const tableLabel = tab === "costs" ? "Fuel Costs" : tab === "liters" ? "Liters Usage" : "Fuel Records";

  return <div className="flex min-h-screen flex-col bg-[#f7f8fa] text-slate-900">
    <GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b80049]">Fleet operations · Fuel management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Fuel Overview</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">Review recorded fuel purchases, costs, and source transactions across your fleet.</p>
        </div>
      </header>

      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-medium text-[#8e1647]"><Info className="h-4 w-4 shrink-0" />{notice}</div>}
      {loadError && <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</div>}
      {sourceWarnings.length > 0 && <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"><AlertCircle className="h-4 w-4 shrink-0" />{sourceWarnings.join(" · ")}</div>}

      <section aria-label="Fuel record filters" className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.025] sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_auto_auto]">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input aria-label="Start date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => updateFilter(setDateFrom, event.target.value)} className="min-w-0 w-full py-2 text-[11px] text-slate-700 outline-none" />
          <span className="text-[10px] text-slate-400">to</span>
          <input aria-label="End date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => updateFilter(setDateTo, event.target.value)} className="min-w-0 w-full py-2 text-[11px] text-slate-700 outline-none" />
        </div>
        <FilterSelect label="Vehicle" value={vehicleFilter} onChange={(value) => updateFilter(setVehicleFilter, value)} options={filterOptions.vehicles} optionLabel={(id) => String(vehicleById.get(id)?.plate_number || id)} />
        <FilterSelect label="Driver" value={driverFilter} onChange={(value) => updateFilter(setDriverFilter, value)} options={filterOptions.drivers} optionLabel={(id) => String(driverById.get(id)?.full_name || driverById.get(id)?.email || id)} />
        <FilterSelect label="Fuel type" value={fuelTypeFilter} onChange={(value) => updateFilter(setFuelTypeFilter, value)} options={filterOptions.fuelTypes} />
        <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-[#b80049]">Clear filters</button>
        <button onClick={exportReport} type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#97003c]">
          <Download className="h-3.5 w-3.5" />Export Report
        </button>
      </section>

      <section aria-label="Fuel purchase metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Fuel Cost" value={currency(totals.cost, 0)} support={totals.cost == null ? "No cost recorded in this selection" : `${currency(totals.approvedCost, 0)} approved`} icon={CircleDollarSign} />
        <MetricCard label="Total Liters Purchased" value={totals.liters == null ? "Not recorded" : `${numberText(totals.liters)} L`} support={totals.liters == null ? "No valid purchase volume recorded" : "Recorded purchase volume, not consumption"} icon={Fuel} />
        <MetricCard label="Average Price per Liter" value={totals.average == null ? "Not recorded" : `${currency(totals.average)}/L`} support={totals.average == null ? "Requires valid cost and liters" : "Weighted across valid purchase records"} icon={Banknote} />
        <MetricCard label="Total Refuelings" value={String(totals.refuelings)} support={`${totals.pending} pending review · ${filteredRows.length} matching records`} icon={Receipt} />
      </section>

      <section aria-label="Fuel purchase analytics" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartPanel title="Fuel Cost Trend" subtitle="Recorded transaction cost by date">
          {trendData.length ? <div className="h-[210px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(value) => `₱${Number(value).toLocaleString("en-PH", { notation: "compact" })}`} />
            <Tooltip formatter={(value) => currency(Number(value))} contentStyle={{ borderRadius: 8, borderColor: "#f1d7e2", fontSize: 11 }} />
            <Line type="monotone" dataKey="amount" name="Fuel cost" stroke="#b80049" strokeWidth={2.5} dot={{ r: 3, fill: "#b80049", stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
          </LineChart></ResponsiveContainer></div> : <ChartEmpty loading={loading} text="No dated purchase costs match these filters." />}
        </ChartPanel>
        <ChartPanel title="Fuel by Vehicle" subtitle="Purchase cost by recorded vehicle">
          <DonutChart data={vehicleChart} empty={loading ? "Loading records…" : "No vehicle-linked costs match these filters."} />
        </ChartPanel>
        <ChartPanel title="Fuel Type Distribution" subtitle="Purchase cost by recorded fuel type">
          <DonutChart data={fuelChart} empty={loading ? "Loading records…" : "No fuel-type costs match these filters."} />
        </ChartPanel>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
        <section aria-label="Fuel records" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-bold text-slate-900">{tableLabel}</h2><p className="mt-0.5 text-[10px] text-slate-500">{tableRows.length} records match the current view</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Fuel record view">
                <TabButton active={tab === "records"} onClick={() => { setTab("records"); setPage(1); }}>Fuel Records</TabButton>
                <TabButton active={tab === "costs"} onClick={() => { setTab("costs"); setPage(1); }}>Fuel Costs</TabButton>
                <TabButton active={tab === "liters"} onClick={() => { setTab("liters"); setPage(1); }}>Liters Usage</TabButton>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search ID, vehicle, driver, station..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 focus:ring-pink-100" />
            </label>
            <FilterSelect label="Status" value={statusFilter} onChange={(value) => updateFilter(setStatusFilter, value)} options={["pending", "approved", "rejected"]} />
            <button type="button" onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50" aria-label={`Sort by date ${sortAscending ? "descending" : "ascending"}`}>
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />Date {sortAscending ? "Oldest" : "Newest"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-left text-[10px]">
              <thead className="bg-[#fbf9fa] text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500"><tr>
                <th className="px-3 py-2.5">Transaction ID</th><th className="px-3 py-2.5">Date &amp; time</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Vehicle</th><th className="px-3 py-2.5">Driver</th><th className="px-3 py-2.5">Fuel type</th><th className="px-3 py-2.5 text-right">Liters</th><th className="px-3 py-2.5 text-right">Price / L</th><th className="px-3 py-2.5 text-right">Total cost</th><th className="px-3 py-2.5">Station</th><th className="px-3 py-2.5">Receipt</th><th className="px-3 py-2.5">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => {
                  const vehicle = row.vehicleId ? vehicleById.get(row.vehicleId) : undefined;
                  const driver = row.driverId ? driverById.get(row.driverId) : undefined;
                  const active = selectedId === row.id;
                  return <tr key={row.id} onClick={() => void selectRecord(row.id)} className={`cursor-pointer transition hover:bg-pink-50/50 ${active ? "bg-pink-50/70" : ""}`} aria-selected={active}>
                    <td className="px-3 py-2.5"><button type="button" onClick={() => void selectRecord(row.id)} className="font-mono font-bold text-[#a10040] hover:underline">{row.id}</button></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(row.date)}</td>
                    <td className="max-w-24 truncate px-3 py-2.5 text-slate-600" title={displaySource(row.source)}>{displaySource(row.source)}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{textValue(vehicle?.plate_number || row.vehicleId)}</td>
                    <td className="max-w-28 truncate px-3 py-2.5 text-slate-600">{textValue(driver?.full_name || driver?.email || row.driverId)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{row.fuelType}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{numberText(row.liters)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.pricePerLiter)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{currency(row.totalCost)}</td>
                    <td className="max-w-32 truncate px-3 py-2.5 text-slate-600" title={row.station || "Not recorded"}>{textValue(row.station)}</td>
                    <td className="px-3 py-2.5">{row.receipt ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />Available</span> : <span className="text-slate-400">Missing</span>}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
                  </tr>;
                })}
                {!loading && visibleRows.length === 0 && <tr><td colSpan={12} className="px-4 py-12 text-center">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400"><Receipt className="h-4 w-4" /></div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">{loadError ? "Fuel records unavailable" : "No fuel records found"}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{loadError ? "Check your connection and permissions, then reload the page." : "Adjust the filters or date range to see other records."}</p>
                </td></tr>}
                {loading && <tr><td colSpan={12} className="px-4 py-12 text-center text-xs text-slate-500">Loading fuel records…</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">{tableRows.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, tableRows.length)} of ${tableRows.length}` : "0 records"}</p>
            <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center text-[10px] font-semibold text-slate-600">{currentPage} / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div>
          </footer>
        </section>

        <aside aria-label="Fuel information" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#b80049]">Selected record</p><h2 className="mt-0.5 text-sm font-bold text-slate-900">Fuel Information</h2><p className="mt-0.5 text-[10px] text-slate-500">{selected ? selected.id : `${filteredRows.length} records in current view`}</p></div>
            {selected && <button type="button" onClick={() => setSelectedId(null)} aria-label="Clear selected fuel record" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>}
          </div>
          {selected ? <div className="max-h-[760px] overflow-y-auto px-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{selected.id}</p><p className="mt-0.5 text-[10px] text-slate-500">{displaySource(selected.source)}</p></div><StatusBadge status={selected.status} /></div>
            {selected.flags.length > 0 && <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900"><p className="font-bold">Review flags</p><ul className="mt-1 list-inside list-disc">{selected.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}
            <DetailSection title="Transaction Details" defaultOpen><DetailField label="Transaction ID" value={selected.id} /><DetailField label="Source module" value={displaySource(selected.source)} /><DetailField label="Approval status" value={<StatusBadge status={selected.status} />} /><DetailField label="Record date & time" value={formatDate(selected.date)} /><DetailField label="Created at" value={formatDate(firstValue(selected.raw.created_at, selected.raw.createdAt) as string | null)} /><DetailField label="Updated at" value={formatDate(firstValue(selected.raw.updated_at, selected.raw.updatedAt) as string | null)} /><DetailField label="Submission source" value={displaySource(String(firstValue(selected.raw.source_app, selected.raw.sourceApp) || "Not recorded"))} /><DetailField label="Submitted at" value={formatDate(firstValue(selected.raw.created_at, selected.raw.submitted_at, selected.raw.loggedAt) as string | null)} /></DetailSection>
            <DetailSection title="Vehicle Information" defaultOpen><DetailField label="Vehicle ID" value={selected.vehicleId} /><DetailField label="Plate number" value={selectedVehicle?.plate_number} /><DetailField label="Make / model" value={firstValue(selectedVehicle?.manufacturer, selectedVehicle?.make, selectedVehicle?.brand) ? `${firstValue(selectedVehicle?.manufacturer, selectedVehicle?.make, selectedVehicle?.brand)} ${firstValue(selectedVehicle?.model, selectedVehicle?.vehicle_model) || ""}` : firstValue(selectedVehicle?.model, selectedVehicle?.vehicle_model)} /><DetailField label="Vehicle type" value={firstValue(selectedVehicle?.vehicle_type, selectedVehicle?.vehicleType, selectedVehicle?.type)} /><DetailField label="Fuel specification" value={getVehicleFuelType(selectedVehicle)} /><DetailField label="Vehicle status" value={selectedVehicle?.status} /></DetailSection>
            <DetailSection title="Driver Information" defaultOpen><DetailField label="Driver name" value={firstValue(selectedDriver?.full_name, selectedDriver?.name, selected.raw.driver_name)} /><DetailField label="Driver ID" value={selected.driverId} /><DetailField label="Email" value={selectedDriver?.email} /><DetailField label="Phone" value={selectedDriver?.phone} /><DetailField label="Account created" value={formatDate(firstValue(selectedDriver?.created_at, selectedDriver?.createdAt) as string | null, false)} /></DetailSection>
            <DetailSection title="Cost Breakdown" defaultOpen><DetailField label="Recorded transaction total" value={currency(selected.recordedCost)} /><DetailField label="Calculated liters × price" value={selected.liters != null && selected.pricePerLiter != null ? currency(selected.liters * selected.pricePerLiter) : "Not recorded"} /><DetailField label="Displayed purchase total" value={currency(selected.totalCost)} /><DetailField label="Liters purchased" value={selected.liters == null ? "Not recorded" : `${numberText(selected.liters)} L`} /><DetailField label="Price per liter" value={selected.pricePerLiter == null ? "Not recorded" : `${currency(selected.pricePerLiter)}/L`} /><DetailField label="Currency" value={textValue(firstValue(selected.raw.currency, selectedDetails.currency))} /></DetailSection>
            <DetailSection title="Refueling Measurements" defaultOpen><DetailField label="Fuel type" value={selected.fuelType} /><DetailField label="Odometer reading" value={firstValue(selected.raw.odometerReading, selected.raw.odometer_reading, selectedDetails.odometer_reading) != null ? `${firstValue(selected.raw.odometerReading, selected.raw.odometer_reading, selectedDetails.odometer_reading)} km` : "Not recorded"} /><DetailField label="Quantity unit" value={firstValue(selected.raw.unit, selectedDetails.unit) || "Liters"} /><DetailField label="Fuel station" value={selected.station} wide /><DetailField label="Location" value={firstValue(selected.raw.location, selectedDetails.location)} wide /></DetailSection>
            <DetailSection title="Related Trip"><DetailField label="Trip ID" value={selected.tripId} /><DetailField label="Trip status" value={selectedTrip?.status} /><DetailField label="Origin" value={selectedTrip ? firstValue(selectedTrip.from_location, selectedTrip.origin, selectedTrip.routePlan?.origin, selectedTrip.routePlan?.pickup_location) : null} /><DetailField label="Destination" value={selectedTrip ? firstValue(selectedTrip.to_location, selectedTrip.destination, selectedTrip.routePlan?.destination, selectedTrip.routePlan?.dropoff_location) : null} /><DetailField label="Trip date" value={formatDate(firstValue(selectedTrip?.actual_departure, selectedTrip?.departure_time, selectedTrip?.created_at) as string | null)} /><DetailField label="Distance" value={validNumber(firstValue(selectedTrip?.actual_distance_km, selectedTrip?.distance_km)) != null ? `${numberText(validNumber(firstValue(selectedTrip?.actual_distance_km, selectedTrip?.distance_km)))} km` : "Not recorded"} /></DetailSection>
            <DetailSection title="Receipt and Attachments" defaultOpen><DetailField label="Receipt available" value={selected.receipt ? "Yes" : "No receipt attached"} /><DetailField label="Verification" value={selected.receiptVerified ? "Verified" : selected.receipt ? "Not verified" : "Not available"} /><DetailField label="Verified by" value={firstValue(selected.raw.receipt_verifier_name, selected.raw.receipt_verified_by)} /><DetailField label="Verified at" value={formatDate(firstValue(selected.raw.receipt_verified_at, selected.raw.receiptVerifiedAt) as string | null)} />
              {selected.receipt && <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><div className="mb-2 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><FileImage className="h-3.5 w-3.5" />Receipt preview</span><a href={selected.receipt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a10040] hover:underline">View receipt<ExternalLink className="h-3 w-3" /></a></div><a href={selected.receipt} target="_blank" rel="noreferrer" aria-label={`Open receipt for ${selected.id}`}><Image src={selected.receipt} alt={`Fuel receipt for ${selected.id}`} width={640} height={480} unoptimized className="max-h-40 w-full rounded-md bg-white object-contain" /></a></div>}
            </DetailSection>
            <DetailSection title="Approval History" defaultOpen><DetailField label="Review status" value={<StatusBadge status={selected.status} />} /><DetailField label="Reviewer" value={firstValue(selected.raw.reviewer_name, selected.raw.reviewed_by)} /><DetailField label="Reviewed at" value={formatDate(firstValue(selected.raw.reviewed_at, selected.raw.reviewedAt) as string | null)} /><DetailField label="Reviewer remarks" value={firstValue(selected.raw.review_notes, selected.raw.remarks, selected.raw.description)} wide />
              {canReviewFuel ? auditLoading ? <p className="col-span-2 text-[10px] text-slate-400">Loading approval history…</p> : auditError ? <p className="col-span-2 text-[10px] text-amber-700">{auditError}</p> : (auditById[selected.id] || []).length ? <div className="col-span-2 space-y-2">{(auditById[selected.id] || []).map((entry) => <div key={entry.id} className="border-l-2 border-pink-200 pl-2.5 text-[10px]"><p className="font-semibold capitalize text-slate-700">{String(entry.action || "Change").replace(/_/g, " ")}</p><p className="mt-0.5 text-slate-500">{textValue(entry.actor_name || entry.actor_id)} · {formatDate(entry.changed_at)}</p>{(entry.new_values?.review_notes || entry.new_values?.remarks) && <p className="mt-1 text-slate-600">{entry.new_values.review_notes || entry.new_values.remarks}</p>}</div>)}</div> : <p className="col-span-2 text-[10px] text-slate-400">No approval history recorded.</p> : <p className="col-span-2 text-[10px] text-slate-400">Approval history is restricted to fuel reviewers.</p>}
            </DetailSection>
            <DetailSection title="Audit Trail"><DetailField label="Record ID" value={selected.id} /><DetailField label="Created by" value={firstValue(selected.raw.created_by, selected.raw.submitted_by)} /><DetailField label="Last updated by" value={firstValue(selected.raw.updated_by, selected.raw.modified_by)} /><DetailField label="Audit events" value={selected.isLegacyFuelLog ? "Legacy source; no cost-ledger audit" : canReviewFuel ? (auditById[selected.id] || []).length : "Restricted"} /><DetailField label="Remarks" value={firstValue(selected.raw.remarks, selectedDetails.note, selectedDetails.description)} wide /></DetailSection>
            {canReviewFuel && !selected.isLegacyFuelLog && <div className="flex flex-wrap gap-2 py-3">
              {selected.receipt && !selected.receiptVerified && <button disabled={reviewBusy === selected.id} onClick={() => void reviewFuelEntry(selected.id, "verify_receipt")} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{reviewBusy === selected.id ? "Saving…" : "Verify receipt"}</button>}
              {selected.status !== "approved" && <button disabled={reviewBusy === selected.id} onClick={() => void reviewFuelEntry(selected.id, "approve")} className="rounded-lg bg-[#b80049] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#97003c] disabled:opacity-50">Approve</button>}
              {selected.status !== "rejected" && <button disabled={reviewBusy === selected.id} onClick={() => void reviewFuelEntry(selected.id, "reject")} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>}
            </div>}
          </div> : <div className="px-4 py-5">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-[#b80049] shadow-sm"><Info className="h-4 w-4" /></span>
              <p className="mt-2 text-xs font-bold text-slate-700">No transaction selected</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Select a fuel record to view transaction, vehicle, driver, trip, receipt, and review details. The panel will follow your current filters.</p>
            </div>
            <div className="mt-4 space-y-3">
              <SummaryRow label="Records in current view" value={String(filteredRows.length)} />
              <SummaryRow label="Active date range" value={dateFrom || dateTo ? `${dateFrom || "Any date"} to ${dateTo || "Any date"}` : "All recorded dates"} />
              <SummaryRow label="Vehicle filter" value={vehicleFilter === "all" ? "All vehicles" : String(vehicleById.get(vehicleFilter)?.plate_number || vehicleFilter)} />
              <SummaryRow label="Driver filter" value={driverFilter === "all" ? "All drivers" : String(driverById.get(driverFilter)?.full_name || driverFilter)} />
              <SummaryRow label="Fuel type" value={fuelTypeFilter === "all" ? "All recorded types" : fuelTypeFilter} />
              <SummaryRow label="Pending review" value={String(totals.pending)} />
              <SummaryRow label="Records with cost" value={String(totals.pricedRows)} />
            </div>
          </div>}
        </aside>
      </section>
    </main>
    <GlobalFooter />
  </div>;
}

function FilterSelect({ label, value, onChange, options, optionLabel = (option: string) => option }: { label: string; value: string; onChange: (value: string) => void; options: string[]; optionLabel?: (option: string) => string }) {
  return <label className="relative flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5">
    <span className="mr-2 shrink-0 text-[10px] text-slate-400">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full appearance-none bg-transparent py-2 pr-5 text-[11px] font-semibold text-slate-700 outline-none">
      <option value="all">All {label.toLowerCase()}s</option>
      {options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
    </select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
  </label>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-md px-2 py-1.5 text-[9px] font-semibold transition sm:px-2.5 ${active ? "bg-white text-[#a10040] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{children}</button>;
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.025]">
    <h2 className="text-xs font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p><div className="mt-3">{children}</div>
  </article>;
}

function ChartEmpty({ loading, text }: { loading: boolean; text: string }) {
  return <div className="grid h-[210px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[10px] text-slate-400">{loading ? "Loading fuel records…" : text}</div>;
}

function DonutChart({ data, empty }: { data: { name: string; value: number; color: string }[]; empty: string }) {
  if (!data.length) return <ChartEmpty loading={empty.startsWith("Loading")} text={empty} />;
  return <div className="grid min-h-[210px] grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)] items-center gap-2">
    <div className="relative h-[175px] min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="white" strokeWidth={2}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} contentStyle={{ borderRadius: 8, borderColor: "#f1d7e2", fontSize: 10 }} /></PieChart></ResponsiveContainer></div>
    <div className="space-y-2">{data.map((entry) => <div key={entry.name} className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} /><span className="min-w-0 flex-1 truncate text-[10px] text-slate-600" title={entry.name}>{entry.name}</span><span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-800">{currency(entry.value, 0)}</span></div>)}</div>
  </div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-[10px] text-slate-500">{label}</span><span className="max-w-[60%] text-right text-[10px] font-semibold text-slate-700">{value}</span></div>;
}