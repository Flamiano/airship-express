"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleDollarSign, Clock3, Download, Ellipsis, Eye, Filter,
  Fuel, RefreshCw, Search, Wrench, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import GlobalNavbar from "../../components/global/GlobalNavbar";
import GlobalFooter from "../../components/global/GlobalFooter";
import { fetchJson, getCurrentProfile } from "../../lib/api";
import { getCostOptimizationOpportunities } from "../../lib/costOptimization";
import { hasPermission } from "../../lib/permissions";

type AnyRecord = Record<string, unknown> & {
  id?: string | number;
  name?: string | null;
  quantity?: string | number | null;
  unit_cost?: string | number | null;
  status?: string | null;
  maintenance_type?: string | null;
  plate_number?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  mechanic?: string | null;
  performed_by?: string | null;
  action?: string | null;
  changed_at?: string | number | null;
  calculated_at?: string | number | null;
  actor_name?: string | null;
  actor_id?: string | null;
  source_maintenance_record_id?: string | number | null;
  replaced_parts?: Array<{
    name?: string | null;
    quantity?: string | number | null;
    unit_cost?: string | number | null;
  }> | null;
  categoryCost?: { liters?: unknown; price_per_liter?: unknown } | null;
  maintenance_source?: {
    id?: string | number | null;
    cost_review_status?: string | null;
    maintenance_type?: string | null;
    work_performed?: string | null;
  } | null;
  new_values?: {
    cost_review_status?: string | null;
    review_status?: string | null;
    cost_review_notes?: string | null;
    review_notes?: string | null;
  } | null;
};
type ReviewStatus = "pending" | "approved" | "rejected" | "planned" | "cancelled";
type SourceModule = "Driver App" | "Fuel Management" | "FVM Maintenance" | "FTM Cost Entry";
type CostRow = {
  key: string;
  sourceId: string;
  source: SourceModule;
  category: string;
  vehicleId: string | null;
  driverId: string | null;
  driverName: string | null;
  providerName: string | null;
  tripId: string | null;
  date: string | null;
  amount: number | null;
  status: ReviewStatus;
  receipt: string | null;
  notes: string | null;
  flags: string[];
  isEstimate: boolean;
  record: AnyRecord;
};

type SortKey = "id" | "date" | "amount" | "source" | "category" | "status" | "vehicle";
type ReviewAction = { row: CostRow; action: "approved" | "rejected" } | null;
type LinkAction = { row: CostRow; maintenance: AnyRecord } | null;

const PINKS = ["#b80049", "#ec2188", "#f472b6", "#fb7185", "#be123c", "#fda4af"];
const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  planned: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

function currency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function costShareNote(value: number, total: number) {
  return total > 0 ? `${(value / total * 100).toFixed(1)}% of filtered approved costs` : "No filtered approved cost records";
}

function fieldText(value: unknown) {
  if (value == null) return null;
  const text = typeof value === "string" ? value.trim() : String(value).trim();
  return text === "" ? null : text;
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numeric(value: unknown) {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function formatTimestamp(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-PH") : null;
}

function expenseValue(record: AnyRecord) {
  const category = String(record.category || "").toLowerCase();
  if (category === "revenue") return null;
  if (category === "fuel") {
    const categoryCost = isRecord(record.categoryCost) ? record.categoryCost : null;
    const liters = numeric(record.liters ?? categoryCost?.liters);
    const price = numeric(record.price_per_liter ?? categoryCost?.price_per_liter);
    return liters != null && liters > 0 && price != null && price > 0 ? liters * price : null;
  }
  const amount = numeric(record.amount);
  return amount != null && amount > 0 ? amount : null;
}

function maintenanceValue(record: AnyRecord) {
  const labor = numeric(record.labor_cost);
  const parts = numeric(record.parts_cost);
  if (labor != null && parts != null) return labor + parts;
  const total = numeric(record.cost);
  return total != null && total > 0 ? total : null;
}

function toCostRow(record: AnyRecord): CostRow {
  const category = String(record.category || "Other");
  const normalizedCategory = category.toLowerCase();
  const sourceApp = String(record.source_app || "").toLowerCase();
  const source: SourceModule = sourceApp === "driver_app"
    ? "Driver App"
    : sourceApp === "ftm_manual" ? "FTM Cost Entry"
      : record.driver_id ? "Driver App"
        : normalizedCategory === "fuel" ? "Fuel Management" : "FTM Cost Entry";
  const flags = Array.isArray(record.review_flags) ? record.review_flags.map(String) : [];
  if (normalizedCategory === "revenue") flags.push("Revenue record excluded from transportation expense totals");
  if (normalizedCategory !== "revenue" && expenseValue(record) == null) flags.push("Recorded expense amount unavailable");
  if (!record.vehicleId && !record.vehicle_id) flags.push("Vehicle is unavailable");
  if (normalizedCategory === "fuel" && expenseValue(record) == null && !flags.some((flag) => /liters|price per liter/i.test(flag))) {
    flags.push("Fuel amount unavailable: recorded liters and price per liter are required");
  }
    return {
    key: `${source}:${String(record.id)}`,
    sourceId: String(record.id),
    source,
    category,
    vehicleId: fieldText(record.vehicleId || record.vehicle_id),
    driverId: fieldText(record.driverId || record.driver_id),
    driverName: fieldText(record.driver_name),
    providerName: null,
    tripId: fieldText(record.tripId || record.trip_id),
    date: dateValue(record.entryDate || record.entry_date || record.created_at),
    amount: expenseValue(record),
    status: ["pending", "approved", "rejected"].includes(String(record.review_status || "pending").toLowerCase())
      ? String(record.review_status || "pending").toLowerCase() as ReviewStatus
      : "pending",
    receipt: fieldText(record.receipt_image),
    notes: fieldText(record.review_notes || record.remarks),
    flags: [...new Set(flags)],
    isEstimate: false,
    record,
  };
}

function toMaintenanceRow(record: AnyRecord): CostRow {
  const complete = String(record.status || "").toLowerCase() === "completed";
  const cancelled = String(record.status || "").toLowerCase() === "cancelled";
  const amount = maintenanceValue(record);
  const flags: string[] = [];
  if (amount == null) flags.push("Maintenance amount unavailable");
  if (!record.vehicle_id) flags.push("Vehicle unavailable");
  const sourceReviewStatus = String(record.cost_review_status || "pending").toLowerCase();
  const reviewStatus: ReviewStatus = cancelled ? "cancelled" : !complete ? "planned" : ["pending", "approved", "rejected"].includes(sourceReviewStatus) ? sourceReviewStatus as ReviewStatus : "pending";
  return {
    key: `FVM Maintenance:${String(record.id)}`,
    sourceId: String(record.id),
    source: "FVM Maintenance",
    category: fieldText(record.maintenance_category || record.maintenance_type) || "Maintenance",
    vehicleId: fieldText(record.vehicle_id),
    driverId: null,
    driverName: fieldText(record.mechanic || record.performed_by),
    providerName: fieldText(record.mechanic || record.performed_by),
    tripId: fieldText(record.source_trip_id),
    date: dateValue(record.performed_at || record.scheduled_at || record.created_at),
    amount,
    status: reviewStatus,
    receipt: null,
    notes: fieldText(record.cost_review_notes || record.work_performed || record.notes),
    flags,
    isEstimate: !complete && !cancelled,
    record,
  };
}

function actualTripDistance(trip: AnyRecord | undefined) {
  if (!trip) return null;
  const actual = numeric(trip.actual_distance_km);
  if (actual != null && actual > 0) return actual;
  if (trip.odometer_start_km == null || trip.odometer_end_km == null) return null;
  const start = numeric(trip.odometer_start_km);
  const end = numeric(trip.odometer_end_km);
  return start != null && end != null && end >= start ? end - start : null;
}

function Metric({ label, value, note, icon: Icon, tone = "pink" }: { label: string; value: string | null; note: string; icon: typeof CircleDollarSign; tone?: string }) {
  if (!value) return null;
  const toneClass = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-pink-50 text-pink-700";
  return <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p><span className={`rounded-lg p-1.5 ${toneClass}`}><Icon className="h-3.5 w-3.5" /></span></div><p className="mt-1 break-words text-xl font-black tabular-nums text-slate-900">{value}</p><p className="mt-0.5 text-[9px] text-slate-400">{note}</p></article>;
}

export default function TransportationCostPage() {
  const [costRecords, setCostRecords] = useState<AnyRecord[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<AnyRecord[]>([]);
  const [trips, setTrips] = useState<AnyRecord[]>([]);
  const [vehicles, setVehicles] = useState<AnyRecord[]>([]);
  const [drivers, setDrivers] = useState<AnyRecord[]>([]);
  const [profile, setProfile] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expenseTab, setExpenseTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selected, setSelected] = useState<CostRow | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [audit, setAudit] = useState<AnyRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const auditRequestId = useRef(0);
  const [linkTarget, setLinkTarget] = useState<LinkAction>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadErrors([]);
    const results = await Promise.allSettled([
      fetchJson("/api/costs", { cache: "no-store" }),
      fetchJson("/api/maintenance", { cache: "no-store" }),
        fetchJson("/api/trips?light=true&all=true", { cache: "no-store" }),
      fetchJson("/api/vehicles", { cache: "no-store" }),
      fetchJson("/api/drivers", { cache: "no-store" }),
      getCurrentProfile(),
    ]);
    const names = ["Driver and fuel expenses", "FVM maintenance records", "Trip references", "Vehicle references", "Driver references", "Reviewer profile"];
    const errors: string[] = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") errors.push(`${names[index]} unavailable: ${result.reason instanceof Error ? result.reason.message.replace(/^Request failed \d+: /, "") : "request failed"}`);
    });
    if (results[0].status === "fulfilled") setCostRecords(Array.isArray(results[0].value) ? results[0].value : []);
    if (results[1].status === "fulfilled") setMaintenanceRecords(Array.isArray(results[1].value) ? results[1].value : []);
    if (results[2].status === "fulfilled") setTrips(Array.isArray(results[2].value) ? results[2].value : []);
    if (results[3].status === "fulfilled") setVehicles(Array.isArray(results[3].value) ? results[3].value : []);
    if (results[4].status === "fulfilled") setDrivers(Array.isArray(results[4].value) ? results[4].value : []);
    if (results[5].status === "fulfilled") setProfile(isRecord(results[5].value) ? results[5].value : null);
    setLoadErrors(errors);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(true), 60_000);
    const onCostChange = (event: StorageEvent) => { if (event.key === "ftm:costs-updated") void refresh(true); };
    const onCostChangeLocal = () => void refresh(true);
    window.addEventListener("storage", onCostChange);
    window.addEventListener("ftm:costs-updated", onCostChangeLocal);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("storage", onCostChange);
      window.removeEventListener("ftm:costs-updated", onCostChangeLocal);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selected && !reviewAction && !linkTarget && !showUnlinkConfirm) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || reviewBusy || linkBusy || unlinkBusy) return;
      setSelected(null); setReviewAction(null); setLinkTarget(null); setShowUnlinkConfirm(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [selected, reviewAction, linkTarget, showUnlinkConfirm, reviewBusy, linkBusy, unlinkBusy]);

  const rows = useMemo(() => {
    const unique = new Map<string, CostRow>();
    costRecords.forEach((record) => { const row = toCostRow(record); unique.set(row.key, row); });
    const linkedMaintenanceIds = new Set(costRecords.map((record) => record.source_maintenance_record_id).filter(Boolean).map(String));
    maintenanceRecords.forEach((record) => {
      if (record.source_cost_entry_id || linkedMaintenanceIds.has(String(record.id))) return;
      const row = toMaintenanceRow(record);
      unique.set(row.key, row);
    });
    return [...unique.values()];
  }, [costRecords, maintenanceRecords]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [String(driver.id), driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle])), [vehicles]);
  const tripById = useMemo(() => new Map(trips.map((trip) => [String(trip.id), trip])), [trips]);
  const hasCompleteSources = !loadErrors.some((error) => /expenses|maintenance records/i.test(error));

  const filterOptions = useMemo(() => ({
    categories: [...new Set(rows.map((row) => row.category))].sort(),
    sources: [...new Set(rows.map((row) => row.source))].sort(),
  }), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const driver = driverById.get(String(row.driverId || ""));
      const vehicle = vehicleById.get(String(row.vehicleId || ""));
      const driverName = row.driverName || driver?.full_name || driver?.email || "";
      if (needle && ![row.sourceId, row.source, row.category, row.vehicleId, vehicle?.plate_number, row.driverId, driverName, row.providerName, row.tripId, row.notes].filter(Boolean).join(" ").toLowerCase().includes(needle)) return false;
      if (vehicleFilter !== "all" && row.vehicleId !== vehicleFilter) return false;
      if (driverFilter !== "all" && row.driverId !== driverFilter) return false;
      if (tripFilter !== "all" && row.tripId !== tripFilter) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (expenseTab !== "all" && row.status !== expenseTab) return false;
      if (flaggedOnly && row.flags.length === 0) return false;
      if (dateFrom && (!row.date || row.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!row.date || row.date.slice(0, 10) > dateTo)) return false;
      return true;
    }).sort((left, right) => {
      let comparison = 0;
      if (sortKey === "id") comparison = left.sourceId.localeCompare(right.sourceId, undefined, { numeric: true });
      if (sortKey === "date") comparison = String(left.date || "").localeCompare(String(right.date || ""));
      if (sortKey === "amount") comparison = (left.amount ?? -Infinity) - (right.amount ?? -Infinity);
      if (sortKey === "source") comparison = left.source.localeCompare(right.source);
      if (sortKey === "category") comparison = left.category.localeCompare(right.category);
      if (sortKey === "status") comparison = left.status.localeCompare(right.status);
      if (sortKey === "vehicle") comparison = String(left.vehicleId || "").localeCompare(String(right.vehicleId || ""), undefined, { numeric: true });
      return comparison * (sortDirection === "asc" ? 1 : -1);
    });
  }, [rows, driverById, vehicleById, query, vehicleFilter, driverFilter, tripFilter, categoryFilter, sourceFilter, statusFilter, expenseTab, flaggedOnly, dateFrom, dateTo, sortKey, sortDirection]);

  const official = useMemo(() => filtered.filter((row) => row.status === "approved" && row.amount != null && row.flags.length === 0 && row.category.toLowerCase() !== "revenue"), [filtered]);
  const approvedTotal = hasCompleteSources ? official.reduce((sum, row) => sum + (row.amount || 0), 0) : null;
  const pending = filtered.filter((row) => row.status === "pending");
  const rejected = filtered.filter((row) => row.status === "rejected");
  const planned = filtered.filter((row) => row.isEstimate);
  const maintenanceTotal = hasCompleteSources ? official.filter((row) => row.source === "FVM Maintenance" || /maintenance|repair|inspection|parts replacement/i.test(row.category)).reduce((sum, row) => sum + (row.amount || 0), 0) : null;
  const fuelTotal = hasCompleteSources ? official.filter((row) => row.category.toLowerCase() === "fuel").reduce((sum, row) => sum + (row.amount || 0), 0) : null;
  const otherTotal = hasCompleteSources ? official.filter((row) => row.category.toLowerCase() !== "fuel" && !/maintenance|repair|inspection|parts replacement/i.test(row.category)).reduce((sum, row) => sum + (row.amount || 0), 0) : null;

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    official.forEach((row) => totals.set(row.category, (totals.get(row.category) || 0) + (row.amount || 0)));
    return [...totals.entries()].map(([name, value], index) => ({ name, value, color: PINKS[index % PINKS.length] })).sort((a, b) => b.value - a.value);
  }, [official]);
  const monthlyData = useMemo(() => {
    const start = new Date();
    const months = Array.from({ length: 6 }, (_, index) => new Date(start.getFullYear(), start.getMonth() - 5 + index, 1));
    return months.map((month) => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      const monthRows = filtered.filter((row) => !row.isEstimate && row.date?.slice(0, 7) === key && row.amount != null && row.category.toLowerCase() !== "revenue");
      const sumStatus = (status: ReviewStatus) => monthRows.filter((row) => row.status === status && row.flags.length === 0).reduce((sum, row) => sum + (row.amount || 0), 0);
      return {
        period: month.toLocaleDateString("en-PH", { month: "short" }),
        approved: sumStatus("approved"),
        pending: sumStatus("pending"),
        rejected: sumStatus("rejected"),
      };
    });
  }, [filtered]);
  const vehicleData = useMemo(() => {
    const totals = new Map<string, number>();
    official.forEach((row) => { if (row.vehicleId) totals.set(row.vehicleId, (totals.get(row.vehicleId) || 0) + (row.amount || 0)); });
    return [...totals.entries()].map(([id, amount]) => ({
      id,
      name: vehicleById.get(id)?.plate_number || id,
      amount,
    })).sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [official, vehicleById]);
  const vehicleKmData = useMemo(() => {
    const tripsByVehicle = new Map<string, Map<string, { distance: number; cost: number }>>();
    official.forEach((row) => {
      if (!row.tripId) return;
      const trip = tripById.get(String(row.tripId));
      const vehicleId = String(row.vehicleId || trip?.vehicle_id || "");
      const distance = actualTripDistance(trip);
      if (!vehicleId || distance == null || distance <= 0) return;
      const tripsForVehicle = tripsByVehicle.get(vehicleId) || new Map<string, { distance: number; cost: number }>();
      const aggregate = tripsForVehicle.get(String(row.tripId)) || { distance, cost: 0 };
      aggregate.cost += row.amount || 0;
      tripsForVehicle.set(String(row.tripId), aggregate);
      tripsByVehicle.set(vehicleId, tripsForVehicle);
    });
    return [...tripsByVehicle.entries()].map(([id, tripRows]) => {
      const total = [...tripRows.values()].reduce((summary, trip) => ({ cost: summary.cost + trip.cost, distance: summary.distance + trip.distance }), { cost: 0, distance: 0 });
      return { id, name: fieldText(vehicleById.get(id)?.plate_number) || id, costPerKm: total.distance > 0 ? total.cost / total.distance : null };
    }).filter((vehicle) => vehicle.costPerKm != null).sort((left, right) => Number(right.costPerKm) - Number(left.costPerKm));
  }, [official, tripById, vehicleById]);
  const vehicleKmChartData = vehicleKmData.slice(0, 8);
  const optimizationSourcesComplete = !loadErrors.some((error) => /trip references|vehicle references/i.test(error));
  const optimizationOpportunities = hasCompleteSources && optimizationSourcesComplete
    ? getCostOptimizationOpportunities(vehicleKmData)
    : [];

  const canReviewCost = (row: CostRow) => row.source === "FVM Maintenance"
    ? hasPermission(fieldText(profile?.role), "fvm", "update") && hasPermission(fieldText(profile?.role), "costAnalysis", "update")
    : row.category.toLowerCase() === "fuel"
      ? hasPermission(fieldText(profile?.role), "fuelManagement", "update")
      : hasPermission(fieldText(profile?.role), "costAnalysis", "update");
  const linkCandidates = (row: CostRow) => {
    if (row.source !== "Driver App" || !/maintenance/i.test(row.category) || row.status !== "pending" || row.amount == null) return [];
    return maintenanceRecords.filter((record) => {
      if (String(record.status || "").toLowerCase() !== "completed" || record.source_cost_entry_id || record.cost_review_status && record.cost_review_status !== "pending") return false;
      if (String(record.vehicle_id || "") !== String(row.vehicleId || "")) return false;
      const amount = maintenanceValue(record);
      return amount != null && Math.abs(amount - row.amount!) <= 0.01;
    });
  };
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleKeys = visibleRows.map((row) => row.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));

  function changeFilter(update: () => void) { update(); setPage(1); }
  function clearFilters() {
    setQuery(""); setDateFrom(""); setDateTo(""); setVehicleFilter("all"); setDriverFilter("all"); setTripFilter("all");
    setCategoryFilter("all"); setSourceFilter("all"); setStatusFilter("all"); setFlaggedOnly(false); setDateRange("all"); setPage(1);
  }
  function selectDateRange(value: string) {
    setDateRange(value);
    const today = new Date();
    const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (value === "all" || value === "custom") {
      if (value === "all") { setDateFrom(""); setDateTo(""); }
    } else if (value === "month") {
      setDateFrom(toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
      setDateTo(toDateInput(today));
    } else {
      const days = Number(value);
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
      setDateFrom(toDateInput(from));
      setDateTo(toDateInput(today));
    }
    setPage(1);
  }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection(key === "date" ? "desc" : "asc"); }
  }
  function toggleRowSelection(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleVisibleSelection() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleKeys.forEach((key) => next.delete(key));
      else visibleKeys.forEach((key) => next.add(key));
      return next;
    });
  }

  const loadAudit = useCallback(async (row: CostRow) => {
    const requestId = ++auditRequestId.current;
    setAudit([]);
    setAuditLoading(true);
    setAuditError("");
    const paths = row.source === "FVM Maintenance"
      ? [`/api/maintenance/audit?maintenance_id=${encodeURIComponent(row.sourceId)}`]
      : [
        `/api/costs/${encodeURIComponent(row.sourceId)}/audit`,
        ...(row.record.source_maintenance_record_id ? [`/api/maintenance/audit?maintenance_id=${encodeURIComponent(String(row.record.source_maintenance_record_id))}`] : []),
      ];
    try {
      const results = await Promise.all(paths.map((path) => fetchJson(path, { cache: "no-store" })));
      if (requestId === auditRequestId.current) {
        setAudit(results.flatMap((result) => Array.isArray(result) ? result.filter(isRecord) : []));
      }
    } catch (error) {
      if (requestId === auditRequestId.current) {
        setAuditError(error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Audit history unavailable.");
      }
    } finally {
      if (requestId === auditRequestId.current) setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    void Promise.resolve().then(() => loadAudit(selected));
  }, [selected, loadAudit]);

  async function confirmReview() {
    if (!reviewAction) return;
    const { row, action } = reviewAction;
    if (action === "rejected" && !reviewNotes.trim()) {
      setFeedback({ type: "error", text: "A rejection reason is required." });
      return;
    }
    setReviewBusy(true); setFeedback(null);
    try {
      if (row.source === "FVM Maintenance") {
        await fetchJson("/api/maintenance", { method: "PATCH", body: JSON.stringify({
          id: row.sourceId, action: "review_cost", cost_review_status: action, cost_review_notes: reviewNotes.trim() || null,
        }) });
      } else {
        await fetchJson("/api/costs", { method: "PATCH", body: JSON.stringify({
          id: row.sourceId, action: "review", review_status: action, review_notes: reviewNotes.trim() || null,
        }) });
      }
      setReviewAction(null); setReviewNotes(""); setSelected(null);
      setFeedback({ type: "success", text: `Source record ${row.sourceId} ${action}.` });
      window.localStorage.setItem("ftm:costs-updated", String(Date.now()));
      window.dispatchEvent(new Event("ftm:costs-updated"));
      await refresh(true);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Review could not be saved." });
    } finally { setReviewBusy(false); }
  }

  async function confirmLink() {
    if (!linkTarget) return;
    setLinkBusy(true); setFeedback(null);
    try {
      await fetchJson("/api/costs", { method: "PATCH", body: JSON.stringify({
        id: linkTarget.row.sourceId,
        action: "link_maintenance",
        maintenance_record_id: linkTarget.maintenance.id,
      }) });
      setLinkTarget(null); setSelected(null);
      setFeedback({ type: "success", text: `Linked Driver App expense ${linkTarget.row.sourceId} to FVM record ${linkTarget.maintenance.id}. The amount is counted once.` });
      window.localStorage.setItem("ftm:costs-updated", String(Date.now()));
      window.dispatchEvent(new Event("ftm:costs-updated"));
      await refresh(true);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Source records could not be linked." });
    } finally { setLinkBusy(false); }
  }

  async function confirmUnlink() {
    if (!selected) return;
    setUnlinkBusy(true); setFeedback(null);
    try {
      await fetchJson("/api/costs", { method: "PATCH", body: JSON.stringify({ id: selected.sourceId, action: "unlink_maintenance" }) });
      setShowUnlinkConfirm(false); setSelected(null);
      setFeedback({ type: "success", text: `Source link for ${selected.sourceId} removed. Both records remain pending and retained.` });
      window.localStorage.setItem("ftm:costs-updated", String(Date.now()));
      window.dispatchEvent(new Event("ftm:costs-updated"));
      await refresh(true);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "Source records could not be unlinked." });
    } finally { setUnlinkBusy(false); }
  }

  function exportCsv() {
    const headers = ["expense_id", "source_module", "category", "vehicle_id", "driver_id", "trip_id", "date", "amount", "status", "receipt_available", "linked_maintenance_record_id"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((row) => [row.sourceId, row.source, row.category, row.vehicleId, row.driverId, row.tripId, row.date, row.amount, row.status, row.receipt ? "yes" : "no", row.record.source_maintenance_record_id || row.record.source_cost_entry_id || ""].map(escape).join(","));
    const blob = new Blob([[headers.map(escape).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tcao-expenses.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="fvm-page-shell min-h-screen text-slate-800">
    <GlobalNavbar />
    <main className="min-h-[calc(100vh-80px)] px-3 py-4 sm:px-5 lg:px-7"><div className="mx-auto max-w-[1640px] space-y-4">
      <header className="pb-1"><h1 className="text-2xl font-black text-slate-900">Transportation Cost Analysis &amp; Optimization (TCAO)</h1><p className="mt-1 text-[11px] text-slate-500">Monitor transportation costs, review submitted expenses, and identify fleet optimization opportunities.</p></header>

      <section className="rounded-xl border border-pink-100 bg-white p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"><div className="grid items-center gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(135px,1.2fr)_repeat(6,minmax(105px,1fr))_auto_auto]"><label className="flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-2"><span className="text-[9px] font-semibold text-slate-500">Range</span><select value={dateRange} onChange={(event) => selectDateRange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-[10px] text-slate-700 outline-none"><option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option><option value="custom">Custom</option></select></label><FilterSelect label="Vehicle" value={vehicleFilter} onChange={(value) => changeFilter(() => setVehicleFilter(value))} options={vehicles.map((vehicle) => String(vehicle.id))} optionLabels={new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle.plate_number || String(vehicle.id)]))} /><FilterSelect label="Driver" value={driverFilter} onChange={(value) => changeFilter(() => setDriverFilter(value))} options={drivers.map((driver) => String(driver.id))} optionLabels={new Map(drivers.map((driver) => [String(driver.id), driver.full_name || driver.email || String(driver.id)]))} /><FilterSelect label="Trip" value={tripFilter} onChange={(value) => changeFilter(() => setTripFilter(value))} options={[...new Set(rows.map((row) => row.tripId).filter((tripId): tripId is string => Boolean(tripId)))]} /><FilterSelect label="Category" value={categoryFilter} onChange={(value) => changeFilter(() => setCategoryFilter(value))} options={filterOptions.categories} /><FilterSelect label="Source" value={sourceFilter} onChange={(value) => changeFilter(() => setSourceFilter(value))} options={filterOptions.sources} /><FilterSelect label="Status" value={statusFilter} onChange={(value) => changeFilter(() => setStatusFilter(value))} options={["pending", "approved", "rejected", "planned", "cancelled"]} /><button type="button" onClick={() => void refresh(true)} disabled={refreshing || loading} aria-label="Refresh transportation costs" className="rounded-lg border border-pink-200 bg-white p-2.5 text-slate-600 hover:bg-pink-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button><button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-700 px-3 py-2.5 text-[10px] font-bold text-white hover:bg-pink-800 disabled:opacity-40"><Download className="h-3.5 w-3.5" />Export Report</button></div>{dateRange === "custom" && <div className="mt-2 flex flex-wrap items-center gap-2"><label className="flex items-center gap-1 rounded-lg border border-pink-200 px-2 py-1"><span className="text-[9px] text-slate-500">From</span><input type="date" value={dateFrom} onChange={(event) => changeFilter(() => setDateFrom(event.target.value))} className="text-[9px] outline-none" aria-label="Date from" /></label><label className="flex items-center gap-1 rounded-lg border border-pink-200 px-2 py-1"><span className="text-[9px] text-slate-500">To</span><input type="date" value={dateTo} onChange={(event) => changeFilter(() => setDateTo(event.target.value))} className="text-[9px] outline-none" aria-label="Date to" /></label></div>}</section>

        {feedback && <div role={feedback.type === "error" ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${feedback.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span className="flex-1">{feedback.text}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message"><X className="h-3.5 w-3.5" /></button></div>}
        {loadErrors.length > 0 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] text-rose-800"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Some source records are unavailable. Official total is withheld until the cost and maintenance sources load.</div><ul className="mt-1 list-inside list-disc">{loadErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Transportation cost summary">
          {approvedTotal != null && <Metric label="Total Approved Costs" value={currency(approvedTotal)} note="Filtered approved actual expenses; flagged and planned records are excluded" icon={CircleDollarSign} />}
          <Metric label="Pending Review" value={loading ? "Loading…" : String(pending.length)} note={`${pending.length} items`} icon={Clock3} tone="amber" />
          <Metric label="Rejected Expenses" value={loading ? "Loading…" : String(rejected.length)} note={`${rejected.length} items`} icon={X} tone="rose" />
          {maintenanceTotal != null && approvedTotal != null && <Metric label="Maintenance Costs" value={currency(maintenanceTotal)} note={costShareNote(maintenanceTotal, approvedTotal)} icon={Wrench} />}
          {fuelTotal != null && approvedTotal != null && <Metric label="Fuel Costs" value={currency(fuelTotal)} note={costShareNote(fuelTotal, approvedTotal)} icon={Fuel} />}
          {otherTotal != null && approvedTotal != null && <Metric label="Other Expenses" value={currency(otherTotal)} note={costShareNote(otherTotal, approvedTotal)} icon={CircleDollarSign} />}
        </section>

      {planned.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-[10px] text-sky-900"><BarChart3 className="h-4 w-4" /><strong>{planned.length} planned maintenance record(s)</strong><span>are shown as estimates, not actual transportation cost.</span></div>}
      {rows.some((row) => row.flags.length > 0) && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{rows.filter((row) => row.flags.length > 0).length} source record(s) have missing or unsupported values; they remain visible and are excluded from official totals until resolved.</span></div>}

        <section className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)] sm:p-4" aria-label="Cost optimization opportunities">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="text-sm font-black text-slate-900">Cost optimization opportunities</h2><p className="mt-1 text-[10px] text-slate-500">Compare approved trip-linked cost per kilometer against the filtered fleet median. These are review signals, not guaranteed savings.</p></div>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold text-emerald-800">{vehicleKmData.length} vehicles compared</span>
          </div>
          {loading ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">Loading cost and distance records…</p>
            : !hasCompleteSources || !optimizationSourcesComplete
              ? <p role="status" className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] text-amber-800">Optimization comparison is withheld because one or more expense, maintenance, trip, or vehicle sources failed to load.</p>
              : optimizationOpportunities.length
                ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{optimizationOpportunities.map((opportunity) => <article key={opportunity.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold text-slate-800">{opportunity.name}</p><p className="mt-1 text-lg font-black tabular-nums text-slate-900">{currency(opportunity.costPerKm)}/km</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800">Review</span></div><p className="mt-1 text-[9px] leading-4 text-slate-600">{opportunity.percentAboveMedian.toFixed(1)}% above the filtered fleet median of {currency(opportunity.fleetMedianCostPerKm)}/km.</p><p className="mt-1 text-[9px] leading-4 text-slate-500">Check route distance, fuel, and maintenance records before taking action.</p><button type="button" onClick={() => changeFilter(() => { setVehicleFilter(opportunity.id); setStatusFilter("approved"); setExpenseTab("approved"); setFlaggedOnly(false); })} className="mt-2 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-emerald-800 hover:bg-emerald-50">Review approved costs</button></article>)}</div>
                : vehicleKmData.length < 2
                  ? <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-500">At least two vehicles need approved trip-linked expenses and actual distance before a peer comparison is available.</p>
                  : <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-[10px] text-emerald-800">No vehicles are above the filtered fleet median in this selection.</p>}
        </section>

        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.1fr_0.95fr_1.15fr_1.15fr]" aria-label="Transportation analytics">
          <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-700">Cost Trend</p>
                <p className="mt-1 text-[9px] text-slate-500">Actual source amounts by month</p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-pink-100 bg-pink-50 px-2 py-1 text-[8px] font-semibold text-pink-700"><span className="h-2 w-2 rounded-full bg-pink-500" />Approved</div>
            </div>
            <div className="h-[220px]">{rows.some((row) => !row.isEstimate && row.amount != null) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" /><XAxis dataKey="period" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={(value) => currency(Number(value))} /><Line type="monotone" dataKey="approved" name="Approved" stroke="#b80049" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" strokeWidth={1.5} dot={false} /><Line type="monotone" dataKey="rejected" name="Rejected" stroke="#e11d48" strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer> : <ChartEmpty loading={loading} text="No recorded expense values." />}</div>
          </article>
          <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-700">Expense Breakdown</p>
                <p className="mt-1 text-[9px] text-slate-500">Approved actual cost by category</p>
              </div>
            </div>
            <div className="flex h-[220px] items-center gap-1">{categoryData.length ? <><div className="h-full min-w-0 flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2} onClick={(item) => { const name = item.name; if (typeof name === "string") changeFilter(() => setCategoryFilter(name)); }}>{categoryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} /></PieChart></ResponsiveContainer></div><div className="flex max-w-[45%] flex-col gap-1 overflow-y-auto">{categoryData.map((item) => { const share = approvedTotal ? item.value / approvedTotal * 100 : 0; return <button type="button" key={item.name} onClick={() => changeFilter(() => setCategoryFilter(item.name))} className="flex items-center gap-1 text-left text-[8px] text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span>{share.toFixed(0)}%</span></button>; })}</div></> : <ChartEmpty loading={loading} text="No approved actual expenses." />}</div>
          </article>
          <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-700">Cost by Vehicle</p>
                <p className="mt-1 text-[9px] text-slate-500">Approved actual transportation costs</p>
              </div>
            </div>
            <div className="h-[220px]">{vehicleData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={vehicleData} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" /><XAxis dataKey="name" tick={{ fontSize: 8 }} /><YAxis tick={{ fontSize: 8 }} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="amount" name="Approved cost" fill="#ec2188" radius={[4, 4, 0, 0]} onClick={(item) => changeFilter(() => setVehicleFilter(String(item.id)))}><LabelList dataKey="amount" position="top" formatter={(value) => currency(Number(value))} className="fill-slate-600" fontSize={8} />{vehicleData.map((item, index) => <Cell key={item.id} fill={PINKS[index % PINKS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} text="No approved vehicle costs." />}</div>
          </article>
          <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-700">Cost per Kilometer</p>
                <p className="mt-1 text-[9px] text-slate-500">Trip-linked actual cost ÷ actual distance</p>
              </div>
              <button type="button" className="rounded-full border border-pink-100 bg-pink-50 p-1 text-slate-500"><X className="h-3 w-3" /></button>
            </div>
            <div className="h-[220px]">{vehicleKmChartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={vehicleKmChartData} margin={{ top: 16, right: 4, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" /><XAxis dataKey="name" tick={{ fontSize: 8 }} /><YAxis tick={{ fontSize: 8 }} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="costPerKm" name="Cost per km" fill="#b80049" radius={[4, 4, 0, 0]}><LabelList dataKey="costPerKm" position="top" formatter={(value) => currency(Number(value))} className="fill-slate-600" fontSize={8} />{vehicleKmChartData.map((item, index) => <Cell key={item.id} fill={PINKS[index % PINKS.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} text="Unavailable without actual trip distance." />}</div>
          </article>
        </section>

      <section className="overflow-hidden rounded-xl border border-pink-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.03)]" aria-label="Expense ledger">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-100 p-3 sm:px-4"><div><h2 className="text-sm font-black text-slate-900">Transportation expense ledger</h2><p className="mt-0.5 text-[10px] text-slate-500">Source IDs are preserved; Driver/Fuel records and FVM work remain independently traceable.</p></div><div className="flex items-center gap-2"><label htmlFor="tcao-page-size" className="sr-only">Rows per page</label><select id="tcao-page-size" value={pageSize} onChange={(event) => changeFilter(() => { setPageSize(Number(event.target.value)); })} className="rounded-lg border border-pink-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">{[12, 24, 48].map((size) => <option key={size} value={size}>{size} / page</option>)}</select><span className="text-[10px] font-semibold text-slate-500">{Math.min(page, pages)}/{pages}</span></div></header>
        <div className="grid gap-2 border-b border-pink-100 bg-[#fff9fc]/70 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search transportation costs</span><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} placeholder="Search source ID, vehicle, driver, trip…" className="w-full rounded-lg border border-pink-200 bg-white py-2.5 pl-9 pr-3 text-[10px] outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label>
          <FilterSelect label="Source module" value={sourceFilter} onChange={(value) => changeFilter(() => setSourceFilter(value))} options={filterOptions.sources} />
          <FilterSelect label="Category" value={categoryFilter} onChange={(value) => changeFilter(() => setCategoryFilter(value))} options={filterOptions.categories} />
          <FilterSelect label="Status" value={statusFilter} onChange={(value) => changeFilter(() => setStatusFilter(value))} options={["pending", "approved", "rejected", "planned", "cancelled"]} />
          <FilterSelect label="Vehicle" value={vehicleFilter} onChange={(value) => changeFilter(() => setVehicleFilter(value))} options={vehicles.map((vehicle) => String(vehicle.id))} optionLabels={new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle.plate_number || String(vehicle.id)]))} />
          <FilterSelect label="Driver" value={driverFilter} onChange={(value) => changeFilter(() => setDriverFilter(value))} options={drivers.map((driver) => String(driver.id))} optionLabels={new Map(drivers.map((driver) => [String(driver.id), driver.full_name || driver.email || String(driver.id)]))} />
          <label className="flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-2"><span className="text-[9px] text-slate-500">From</span><input type="date" value={dateFrom} onChange={(event) => changeFilter(() => setDateFrom(event.target.value))} className="min-w-0 flex-1 py-2 text-[9px] outline-none" aria-label="Date from" /></label>
          <label className="flex items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-2"><span className="text-[9px] text-slate-500">To</span><input type="date" value={dateTo} onChange={(event) => changeFilter(() => setDateTo(event.target.value))} className="min-w-0 flex-1 py-2 text-[9px] outline-none" aria-label="Date to" /></label>
          <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-1 rounded-lg border border-pink-200 bg-white px-2.5 py-2 text-[9px] font-bold text-pink-700 hover:bg-pink-50"><Filter className="h-3 w-3" />Clear filters</button>
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1320px] text-left text-[10px]"><thead className="border-b border-pink-100 bg-[#fff9fc] text-[9px] font-black uppercase tracking-[0.1em] text-slate-500"><tr><th className="px-3 py-3"><SortButton label="Expense ID" column="id" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3"><SortButton label="Source module" column="source" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3"><SortButton label="Category" column="category" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3"><SortButton label="Vehicle" column="vehicle" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3">Driver / provider</th><th className="px-3 py-3">Trip</th><th className="px-3 py-3"><SortButton label="Date" column="date" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3 text-right"><SortButton label="Amount" column="amount" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3">Receipt</th><th className="px-3 py-3"><SortButton label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} /></th><th className="px-3 py-3 text-right">Review</th></tr></thead><tbody className="divide-y divide-pink-50">{visibleRows.map((row) => <tr key={row.key} className="transition hover:bg-pink-50/40"><td className="px-3 py-3"><button type="button" onClick={() => setSelected(row)} className="font-mono font-bold text-pink-700 hover:underline">{row.sourceId}</button>{row.flags.length > 0 && <span className="mt-1 block max-w-40 truncate text-[9px] text-amber-700" title={row.flags.join("; ")}>Review flag</span>}</td><td className="px-3 py-3">{row.source}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3 font-semibold">{fieldText(vehicleById.get(String(row.vehicleId || ""))?.plate_number ?? row.vehicleId)}</td><td className="px-3 py-3">{fieldText(row.driverName || driverById.get(String(row.driverId || ""))?.full_name || row.driverId)}</td><td className="px-3 py-3">{fieldText(row.tripId)}</td><td className="px-3 py-3 whitespace-nowrap">{row.date ? new Date(row.date).toLocaleDateString("en-PH") : "Unavailable"}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{currency(row.amount)}{row.isEstimate && <span className="mt-1 block text-[8px] font-semibold text-sky-700">Estimate</span>}</td><td className="px-3 py-3">{row.receipt ? <button type="button" onClick={() => setSelected(row)} className="inline-flex items-center gap-1 font-bold text-pink-700 hover:underline"><Eye className="h-3 w-3" />View</button> : <span className="text-slate-400">Unavailable</span>}</td><td className="px-3 py-3"><StatusPill status={row.status} /></td><td className="px-3 py-3 text-right">{canReviewCost(row) && row.status !== "approved" && row.status !== "planned" && row.status !== "rejected" && <div className="inline-flex gap-1"><button type="button" onClick={() => { setReviewNotes(""); setReviewAction({ row, action: "approved" }); }} className="rounded-md bg-pink-700 px-2 py-1.5 text-[9px] font-bold text-white hover:bg-pink-800">Approve</button><button type="button" onClick={() => { setReviewNotes(""); setReviewAction({ row, action: "rejected" }); }} className="rounded-md border border-rose-200 px-2 py-1.5 text-[9px] font-bold text-rose-700 hover:bg-rose-50">Reject</button></div>}{canReviewCost(row) && row.status === "rejected" && <button type="button" onClick={() => { setReviewNotes(""); setReviewAction({ row, action: "approved" }); }} className="rounded-md bg-pink-700 px-2 py-1.5 text-[9px] font-bold text-white hover:bg-pink-800">Review again</button>}<button type="button" onClick={() => setSelected(row)} aria-label={`View expense ${row.sourceId}`} className="ml-1 rounded-lg border border-pink-100 p-1.5 text-slate-600 hover:bg-pink-50"><Eye className="h-3.5 w-3.5" /></button></td></tr>)}{visibleRows.length === 0 && !loading && <tr><td colSpan={11} className="p-9 text-center"><CircleDollarSign className="mx-auto h-7 w-7 text-pink-300" /><p className="mt-2 text-xs font-black text-slate-800">No matching expense records</p><p className="mt-1 text-[9px] text-slate-500">Adjust the filters or refresh the source modules.</p></td></tr>}</tbody></table></div>
        {loading && <div className="space-y-2 p-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-pink-50" />)}</div>}
        {!loading && <div className="divide-y divide-pink-100 md:hidden">{visibleRows.map((row) => <button type="button" key={row.key} onClick={() => setSelected(row)} className="block w-full p-3 text-left hover:bg-pink-50/40"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate font-mono text-[10px] font-bold text-pink-700">{row.sourceId} · {row.source}</span><span className="mt-1 block truncate text-[10px] font-bold text-slate-800">{row.category}{fieldText(vehicleById.get(String(row.vehicleId || ""))?.plate_number ?? row.vehicleId) ? ` · ${fieldText(vehicleById.get(String(row.vehicleId || ""))?.plate_number ?? row.vehicleId)}` : ""}</span></span><StatusPill status={row.status} /></div><div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-slate-500">{fieldText(row.driverName || row.driverId) && <span>Driver {fieldText(row.driverName || row.driverId)}</span>}{fieldText(row.tripId) && <span>Trip {fieldText(row.tripId)}</span>}{row.date ? <span>{new Date(row.date).toLocaleDateString("en-PH")}</span> : null}<span className="text-right font-bold text-slate-800">{currency(row.amount)}</span></div></button>)}{visibleRows.length === 0 && !loading && <div className="px-4 py-9 text-center text-[10px] text-slate-500">No matching expense records.</div>}</div>}
        <footer className="flex items-center justify-between border-t border-pink-100 px-3 py-2.5 sm:px-4"><p className="text-[9px] text-slate-500">{filtered.length ? `${Math.min((page - 1) * pageSize + 1, filtered.length)}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : "0 records"}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="rounded-lg border border-pink-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="text-[9px] font-semibold text-slate-500">{Math.min(page, pages)} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page" className="rounded-lg border border-pink-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button></div></footer>
      </section>
    </div></main>
    <GlobalFooter />

    {selected && <div className="fixed inset-0 z-[1300] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="tcao-detail-title" className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-pink-100 bg-[#fffafd] shadow-2xl"><header className="flex items-start justify-between gap-3 border-b border-pink-100 bg-white px-5 py-4"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-pink-700">{selected.source} · Source ID {selected.sourceId}</p><h2 id="tcao-detail-title" className="mt-1 truncate text-xl font-black text-slate-900">{selected.category}</h2>{(fieldText(selected.vehicleId) || fieldText(selected.tripId)) && <p className="mt-1 text-[10px] text-slate-500">{fieldText(selected.vehicleId) ? `Vehicle ${fieldText(selected.vehicleId)}` : null}{fieldText(selected.vehicleId) && fieldText(selected.tripId) ? " · " : ""}{fieldText(selected.tripId) ? `Trip ${fieldText(selected.tripId)}` : null}</p>}</div><button type="button" aria-label="Close cost details" onClick={() => setSelected(null)} className="rounded-lg border border-pink-100 p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button></header><div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"><section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink-100 bg-white p-3"><div><StatusPill status={selected.status} /><p className="mt-2 text-[10px] text-slate-500">{selected.isEstimate ? "Planned amount; estimate only" : selected.amount == null ? "Actual amount unavailable" : `Recorded actual amount · ${currency(selected.amount)}`}</p></div>{canReviewCost(selected) && selected.status !== "approved" && selected.status !== "planned" && <div className="flex gap-2">{selected.status !== "rejected" && <button type="button" onClick={() => { setReviewNotes(""); setReviewAction({ row: selected, action: "approved" }); }} className="rounded-lg bg-pink-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-pink-800">Approve</button>}{selected.status !== "rejected" && <button type="button" onClick={() => { setReviewNotes(""); setReviewAction({ row: selected, action: "rejected" }); }} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50">Reject</button>}</div>}</section>
      {selected.flags.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900"><strong>Review flags</strong><ul className="mt-1 list-inside list-disc">{selected.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}
      <section><h3 className="mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Source record</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><DetailField label="Expense ID" value={selected.sourceId} /><DetailField label="Source module" value={selected.source} /><DetailField label="Category" value={selected.category} /><DetailField label="Vehicle ID" value={selected.vehicleId} /><DetailField label="Driver / provider" value={selected.driverName || (selected.driverId ? driverById.get(selected.driverId)?.full_name : null)} /><DetailField label="Driver ID" value={selected.driverId} /><DetailField label="Trip ID" value={selected.tripId} /><DetailField label="Recorded date" value={selected.date ? new Date(selected.date).toLocaleString("en-PH") : null} /><DetailField label="Recorded amount" value={currency(selected.amount)} /></div></section>
      {selected.source === "FVM Maintenance" && <section className="grid grid-cols-2 gap-2"><DetailField label="Maintenance status" value={selected.record.status} /><DetailField label="Maintenance type" value={selected.record.maintenance_type} /><DetailField label="Mechanic / provider" value={selected.record.mechanic || selected.record.performed_by} /><DetailField label="Labor cost" value={selected.record.labor_cost == null ? null : currency(Number(selected.record.labor_cost))} /><DetailField label="Parts cost" value={selected.record.parts_cost == null ? null : currency(Number(selected.record.parts_cost))} /><DetailField label="Incident source ID" value={selected.record.source_incident_id} />{Array.isArray(selected.record.replaced_parts) && selected.record.replaced_parts.length > 0 && <div className="col-span-2 rounded-lg bg-[#fff9fc] px-3 py-2"><p className="text-[9px] font-bold uppercase text-slate-400">Recorded replaced parts</p>{selected.record.replaced_parts.map((part: AnyRecord, index: number) => <p key={`${part.name}-${index}`} className="mt-1 text-[10px] text-slate-700">{part.name} · {part.quantity} · {part.unit_cost == null ? "Unit cost unavailable" : currency(Number(part.unit_cost) * Number(part.quantity))}</p>)}</div>}</section>}
      {selected.record.maintenance_source && <section className="rounded-xl border border-pink-100 bg-white p-3"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Linked FVM source</h3><div className="mt-2 grid grid-cols-2 gap-2"><DetailField label="Maintenance record ID" value={selected.record.maintenance_source.id} /><DetailField label="FVM review status" value={selected.record.maintenance_source.cost_review_status || "pending"} /><DetailField label="Maintenance type" value={selected.record.maintenance_source.maintenance_type} /><DetailField label="Work performed" value={selected.record.maintenance_source.work_performed} /></div>{canReviewCost(selected) && selected.status !== "approved" && <button type="button" onClick={() => setShowUnlinkConfirm(true)} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-[9px] font-bold text-rose-700 hover:bg-rose-50">Unlink source records</button>}</section>}
      {!selected.record.source_maintenance_record_id && linkCandidates(selected).length > 0 && hasPermission(profile?.role, "fvm", "update") && hasPermission(profile?.role, "costAnalysis", "update") && <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-3"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-sky-900">Possible FVM source matches</h3><p className="mt-1 text-[9px] text-sky-800">Same vehicle and same recorded amount. Nothing is linked automatically.</p><div className="mt-2 divide-y divide-sky-100">{linkCandidates(selected).map((maintenance) => <div key={maintenance.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-[10px] text-slate-700">{maintenance.id} · {maintenance.maintenance_type} · {currency(maintenanceValue(maintenance))}</span><button type="button" onClick={() => setLinkTarget({ row: selected, maintenance })} className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-sky-800 hover:bg-sky-50">Review link</button></div>)}</div></section>}
      {selected.source !== "FVM Maintenance" && <section className="grid grid-cols-2 gap-2"><DetailField label="Liters purchased" value={selected.record.liters} /><DetailField label="Price per liter" value={selected.record.price_per_liter == null ? null : currency(Number(selected.record.price_per_liter))} /><DetailField label="Odometer reading" value={selected.record.odometer_reading == null ? null : `${selected.record.odometer_reading} km`} />{selected.record.receipt_verified ? <DetailField label="Receipt verification" value={`Verified by ${selected.record.receipt_verifier_name || selected.record.receipt_verified_by || "reviewer"}`} /> : selected.receipt ? <DetailField label="Receipt verification" value="Not verified" /> : null}</section>}
      {selected.receipt && <section><h3 className="mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Receipt</h3><a href={selected.receipt} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-pink-700 underline">Open original receipt</a><img src={selected.receipt} alt={`Receipt for ${selected.sourceId}`} className="mt-2 max-h-72 max-w-full rounded-lg border border-pink-100 bg-white object-contain" /></section>}
      {Boolean(selected.notes || selected.record.remarks || selected.record.work_performed || selected.record.reported_issue) && <section><h3 className="mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Remarks and source notes</h3><p className="whitespace-pre-wrap rounded-lg border border-pink-100 bg-white p-3 text-[10px] text-slate-700">{[selected.record.reported_issue, selected.record.work_performed, selected.record.remarks, selected.record.cost_review_notes, selected.record.review_notes].filter(Boolean).join("\n\n") || selected.notes}</p></section>}
      <section className="rounded-xl border border-pink-100 bg-white p-3"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Approval history</h3>{auditLoading ? <div className="mt-3 h-10 animate-pulse rounded-lg bg-pink-50" /> : auditError ? <p className="mt-2 text-[10px] text-amber-800">{auditError}</p> : audit.length ? <div className="mt-2 divide-y divide-pink-50">{audit.map((entry) => <div key={entry.id} className="py-2 text-[10px]"><div className="flex justify-between gap-2"><strong className="capitalize text-slate-800">{String(entry.action || "change").replace(/_/g, " ")}</strong><span className="text-slate-400">{formatTimestamp(entry.changed_at || entry.calculated_at) || "Timestamp unavailable"}</span></div><p className="mt-0.5 text-slate-500">{entry.actor_name || entry.actor_id || "Actor unavailable"}{entry.new_values?.cost_review_status ? ` · ${entry.new_values.cost_review_status}` : entry.new_values?.review_status ? ` · ${entry.new_values.review_status}` : ""}</p>{(entry.new_values?.cost_review_notes || entry.new_values?.review_notes) && <p className="mt-1 text-slate-600">Reason / remarks: {entry.new_values.cost_review_notes || entry.new_values.review_notes}</p>}</div>)}</div> : <p className="mt-2 text-[10px] text-slate-400">No approval or source-change audit entries.</p>}</section>
      </div></section></div>}

    {reviewAction && <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !reviewBusy) setReviewAction(null); }}><section role="dialog" aria-modal="true" aria-labelledby="tcao-review-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="tcao-review-title" className="text-sm font-black text-slate-900">{reviewAction.action === "approved" ? "Approve this expense?" : "Reject this expense?"}</h2><p className="mt-1 text-[10px] text-slate-500">{reviewAction.row.source} · {reviewAction.row.sourceId} · {currency(reviewAction.row.amount)}</p></div><button type="button" disabled={reviewBusy} onClick={() => setReviewAction(null)} aria-label="Close review confirmation" className="rounded-lg border border-pink-100 p-1.5 text-slate-500 hover:bg-pink-50"><X className="h-3.5 w-3.5" /></button></div><p className="mt-3 text-[10px] text-slate-600">This updates the originating source record and writes its reviewer, timestamp, and remarks to audit history.</p><label className="mt-4 block text-[10px] font-bold text-slate-700">{reviewAction.action === "rejected" ? "Rejection reason (required)" : "Reviewer remarks (optional)"}<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-lg border border-pink-200 px-3 py-2 text-[10px] font-normal outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" placeholder={reviewAction.action === "rejected" ? "Explain what is missing or unsupported…" : "Add a review note…"} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={reviewBusy} onClick={() => setReviewAction(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Cancel</button><button type="button" disabled={reviewBusy || (reviewAction.action === "rejected" && !reviewNotes.trim())} onClick={() => void confirmReview()} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50 ${reviewAction.action === "approved" ? "bg-pink-700 hover:bg-pink-800" : "bg-rose-600 hover:bg-rose-700"}`}>{reviewBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : reviewAction.action === "approved" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{reviewBusy ? "Saving…" : reviewAction.action === "approved" ? "Confirm approval" : "Confirm rejection"}</button></div></section></div>}
    {linkTarget && <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="tcao-link-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl"><h2 id="tcao-link-title" className="text-sm font-black text-slate-900">Link these source records?</h2><p className="mt-2 text-[10px] text-slate-600">Driver expense {linkTarget.row.sourceId} and FVM maintenance {linkTarget.maintenance.id} have matching vehicle and recorded amounts. TCAO will count the expense once and retain both source IDs and audit trails.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={linkBusy} onClick={() => setLinkTarget(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Cancel</button><button type="button" disabled={linkBusy} onClick={() => void confirmLink()} className="rounded-lg bg-pink-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{linkBusy ? "Linking…" : "Confirm link"}</button></div></section></div>}
    {showUnlinkConfirm && selected && <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="tcao-unlink-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl"><h2 id="tcao-unlink-title" className="text-sm font-black text-slate-900">Unlink source records?</h2><p className="mt-2 text-[10px] text-slate-600">Both original records will remain. Their review status returns to pending, and the unlink action is retained in audit history.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={unlinkBusy} onClick={() => setShowUnlinkConfirm(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Keep link</button><button type="button" disabled={unlinkBusy} onClick={() => void confirmUnlink()} className="rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">{unlinkBusy ? "Unlinking…" : "Confirm unlink"}</button></div></section></div>}
  </div>;
}

function SortButton({ label, column, sortKey, sortDirection, onToggle }: { label: string; column: SortKey; sortKey: SortKey; sortDirection: "asc" | "desc"; onToggle: (value: SortKey) => void }) {
  const key = label === "ID" || label === "Expense ID" ? "id" : column;
  return <button type="button" onClick={() => onToggle(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-pink-700">{label}{sortKey === key ? sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}</button>;
}

function FilterSelect({ label, value, onChange, options, optionLabels }: { label: string; value: string; onChange: (value: string) => void; options: string[]; optionLabels?: ReadonlyMap<string, unknown> }) {
  return <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-pink-200 bg-white px-2"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-[9px] text-slate-700 outline-none"><option value="all">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{String(optionLabels?.get(option) || option)}</option>)}</select></label>;
}

function StatusPill({ status }: { status: ReviewStatus }) {
  const normalized = STATUS_STYLE[status] ? status : "pending";
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold capitalize ${STATUS_STYLE[normalized]}`}>{normalized}</span>;
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return <div className="rounded-lg bg-[#fff9fc] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-[10px] font-semibold text-slate-800">{String(value)}</p></div>;
}

function ChartEmpty({ loading, text }: { loading: boolean; text: string }) {
  return <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-pink-200 bg-[#fffafd] px-4 text-center text-[10px] text-slate-500">{loading ? "Loading source records…" : text}</div>;
}
