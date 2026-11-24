"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  ExternalLink,
  FileClock,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import FtmProfileAvatar from "../../../components/global/FtmProfileAvatar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import { getAlertHistory, getAlerts, getCurrentProfile, getDrivers, getTrips, updateAlertStatus } from "../../../lib/api";
import { hasPermission } from "../../../lib/permissions";

type Driver = {
  id: string;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  is_active?: boolean | null;
};

type SafetyAlert = {
  id: string;
  source_id?: string | null;
  source_type?: string | null;
  alert_type?: string | null;
  category?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  driver_id?: string | null;
  trip_id?: string | null;
  vehicle_id?: string | null;
  assigned_to?: string | null;
  action_required?: boolean | null;
  metadata?: {
    reported_at?: string | null;
    photo_url?: string | null;
    reason?: string | null;
    due_date?: string | null;
    status?: string | null;
    [key: string]: unknown;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
};

type AlertHistory = {
  id: string;
  alert_id?: string | null;
  action?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  description?: string | null;
  created_at?: string | null;
  actor_id?: string | null;
  alerts?: { id?: string; source_type?: string; source_id?: string; driver_id?: string | null } | null;
};

type DateRange = "Today" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range";
type SafetyStatus = "all" | "open" | "closed";
type TrendMetric = "reports" | "highSeverity";

const dateRanges: DateRange[] = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "Custom Range"];
const openStatuses = new Set(["ACTIVE", "ACKNOWLEDGED", "IN_PROGRESS"]);
const closedStatuses = new Set(["RESOLVED", "DISMISSED", "EXPIRED"]);
const severityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
}

function getPeriod(range: DateRange, customStart: string, customEnd: string) {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (range === "Last 7 Days") start.setDate(start.getDate() - 6);
  else if (range === "Last 30 Days") start.setDate(start.getDate() - 29);
  else if (range === "This Month") start.setDate(1);
  else if (range === "Custom Range") return { start: parseLocalDate(customStart), end: parseLocalDate(customEnd, true) };
  return { start, end };
}

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reportDate(alert: SafetyAlert) {
  return timestamp(alert.metadata?.reported_at ?? alert.created_at);
}

function isOpen(alert: SafetyAlert) {
  return hasCanonicalAlertId(alert) && openStatuses.has(String(alert.status || "ACTIVE").toUpperCase());
}

function isClosed(alert: SafetyAlert) {
  return hasCanonicalAlertId(alert) && closedStatuses.has(String(alert.status || "").toUpperCase());
}

function isSafetyIncident(alert: SafetyAlert) {
  return String(alert.source_type || "").toUpperCase() === "INCIDENT_REPORT";
}

function hasCanonicalAlertId(alert: SafetyAlert) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alert.id);
}

function caseStatusLabel(alert: SafetyAlert) {
  return hasCanonicalAlertId(alert) ? alert.status || "ACTIVE" : "Case tracking unavailable";
}

function driverName(driver: Driver) {
  return driver.full_name || driver.fullName || driver.name || driver.email || "Unnamed driver";
}

function formatDate(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : timestamp(value);
  return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
}

function formatDateTime(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : timestamp(value);
  return date ? date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}

function severityLabel(value: string | null | undefined) {
  return String(value || "Not recorded").toUpperCase();
}

function severityTone(value: string | null | undefined) {
  const severity = severityLabel(value);
  if (severity === "CRITICAL") return "border-rose-200 bg-rose-50 text-rose-800";
  if (severity === "HIGH") return "border-orange-200 bg-orange-50 text-orange-800";
  if (severity === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-800";
  if (severity === "LOW") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusTone(value: string | null | undefined) {
  const status = String(value || "ACTIVE").toUpperCase();
  if (status === "CASE TRACKING UNAVAILABLE") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "RESOLVED" || status === "DISMISSED" || status === "EXPIRED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "IN_PROGRESS") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "ACKNOWLEDGED") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function periodIncludes(value: Date | null, start: Date | null, end: Date | null) {
  return Boolean(value && start && end && value >= start && value <= end);
}

function SafetyTooltip({ active, payload, label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const row = payload[0]?.payload as { fullPeriod?: string; reports?: number; highSeverity?: number } | undefined;
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg"><p className="text-[10px] font-bold text-slate-900">{row?.fullPeriod || label}</p><p className="mt-1 text-[10px] text-slate-600">{payload[0]?.name}: <strong className="text-slate-900">{value == null ? "Not available" : Number(value).toLocaleString()}</strong></p><p className="mt-1 text-[9px] text-slate-500">{row?.reports ?? 0} distinct incident reports</p>{row?.highSeverity != null && <p className="mt-0.5 text-[9px] text-slate-500">{row.highSeverity} HIGH/CRITICAL by existing alert classification</p>}</div>;
}

async function fetchPages(fetchPage: (offset: number) => Promise<unknown>) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 200) {
    const result = await fetchPage(offset);
    if (!Array.isArray(result)) break;
    rows.push(...result as Record<string, unknown>[]);
    if (result.length < 200) break;
  }
  return rows;
}

export default function DriverSafetyPage() {
  const [range, setRange] = useState<DateRange>("Last 30 Days");
  const [customStart, setCustomStart] = useState(() => localDateString(new Date(Date.now() - 29 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => localDateString(new Date()));
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [incidentType, setIncidentType] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>("all");
  const [incidentSearch, setIncidentSearch] = useState("");
  const [driverRows, setDriverRows] = useState<Driver[]>([]);
  const [alertRows, setAlertRows] = useState<SafetyAlert[]>([]);
  const [auditRows, setAuditRows] = useState<AlertHistory[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadedRef = useRef(false);
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [trendMetric, setTrendMetric] = useState<"reports" | "highSeverity">("reports");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SafetyAlert | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setDriverPage] = useState(1);
  const [incidentPage, setIncidentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"incidents" | "lastIncident" | "name">("incidents");
  const [ascending, setAscending] = useState(false);
  const [incidentCountFilter, setIncidentCountFilter] = useState("");
  const scoreBand = incidentCountFilter;
  const setScoreBand = setIncidentCountFilter;
  const pageSize = 10;
  const setPage = (next: number | ((current: number) => number)) => {
    setDriverPage(next);
    if (next === 1) setIncidentPage(1);
  };

  useEffect(() => {
    const requestId = ++requestRef.current;
    let active = true;
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    const load = async () => {
      try {
        const [driversResult, tripsResult, alertsResult, historyResult, profileResult] = await Promise.all([
          getDrivers(),
          getTrips({ light: true, all: true }),
          fetchPages((offset) => getAlerts({ category: "SAFETY", limit: 200, offset })),
          fetchPages((offset) => getAlertHistory({ limit: 200, offset })).then((rows) => ({ rows, error: null as string | null })).catch((error: unknown) => ({ rows: [], error: error instanceof Error ? error.message : "Safety audit history is unavailable." })),
          getCurrentProfile().catch(() => null),
        ]);
        if (!active || requestId !== requestRef.current) return;
        const drivers = Array.isArray(driversResult) ? driversResult as Driver[] : [];
        const driverIds = new Set(drivers.map((driver) => String(driver.id)));
        const tripDriverById = new Map<string, string>();
        (Array.isArray(tripsResult) ? tripsResult : []).forEach((trip: { id?: string | null; driver_id?: string | null; driverId?: string | null }) => {
          if (trip.id && (trip.driver_id || trip.driverId)) tripDriverById.set(String(trip.id), String(trip.driver_id || trip.driverId));
        });
        const incidentMap = new Map<string, SafetyAlert>();
        alertsResult.forEach((record) => {
          if (String(record.source_type || "").toUpperCase() !== "INCIDENT_REPORT" || !(record.source_id || record.id)) return;
          const explicitDriverId = String(record.driver_id || "");
          const linkedDriverId = tripDriverById.get(String(record.trip_id || "")) || "";
          const resolvedDriverId = driverIds.has(explicitDriverId) ? explicitDriverId : linkedDriverId;
          if (!resolvedDriverId || !driverIds.has(resolvedDriverId)) return;
          const incident = { ...record, driver_id: resolvedDriverId } as SafetyAlert;
          if (!hasCanonicalAlertId(incident)) incident.status = "Case tracking unavailable";
          incidentMap.set(String(record.source_id || record.id), incident);
        });
        const incidentAlerts = [...incidentMap.values()];
        setDriverRows(drivers);
        setAlertRows(incidentAlerts);
        setAuditRows(historyResult.rows.filter((entry) => {
          const alert = entry.alerts as Record<string, unknown> | null | undefined;
          return String(alert?.source_type || "").toUpperCase() === "INCIDENT_REPORT"
            && incidentAlerts.some((item) => String(item.id) === String(entry.alert_id) || String(item.id) === String(alert?.id));
        }) as AlertHistory[]);
        setHistoryError(historyResult.error);
        setRole(profileResult?.role ?? null);
        setLastUpdated(new Date());
        loadedRef.current = true;
        setLoadError(null);
      } catch (error) {
        if (active && requestId === requestRef.current) setLoadError(error instanceof Error ? error.message : "Unable to load safety records.");
      } finally {
        if (active && requestId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [retry]);

  const period = getPeriod(range, customStart, customEnd);
  const validPeriod = Boolean(period.start && period.end && period.start <= period.end);
  const incidentQuery = incidentSearch.trim().toLowerCase();
  const normalizedDriverSearch = driverSearch.trim().toLowerCase();
  const filteredDrivers = driverRows.filter((driver) => !normalizedDriverSearch || `${driverName(driver)} ${driver.id}`.toLowerCase().includes(normalizedDriverSearch));
  const availableAlerts = alertRows.filter((alert) => {
    const reported = reportDate(alert);
    if (!periodIncludes(reported, period.start, period.end)) return false;
    if (selectedDriverId && String(alert.driver_id || "") !== selectedDriverId) return false;
    if (incidentType !== "all" && String(alert.alert_type || alert.title || "") !== incidentType) return false;
    if (severityFilter !== "all" && severityLabel(alert.severity) !== severityFilter) return false;
    if (safetyStatus === "open" && !isOpen(alert)) return false;
    if (safetyStatus === "closed" && !isClosed(alert)) return false;
    if (incidentQuery && !`${alert.source_id || ""} ${alert.title || ""} ${alert.message || ""} ${alert.driver_id || ""} ${alert.trip_id || ""}`.toLowerCase().includes(incidentQuery)) return false;
    return true;
  });
  const uniqueIncidentMap = new Map<string, SafetyAlert>();
  availableAlerts.forEach((alert) => uniqueIncidentMap.set(String(alert.source_id || alert.id), alert));
  const filteredIncidents = [...uniqueIncidentMap.values()].sort((a, b) => (reportDate(b)?.getTime() ?? 0) - (reportDate(a)?.getTime() ?? 0));
  const uniqueDriverIds = new Set(filteredIncidents.map((alert) => String(alert.driver_id || "")).filter(Boolean));
  const caseMatchesFilters = (alert: SafetyAlert) =>
    (!selectedDriverId || String(alert.driver_id || "") === selectedDriverId)
    && (incidentType === "all" || String(alert.alert_type || alert.title || "") === incidentType)
    && (severityFilter === "all" || severityLabel(alert.severity) === severityFilter)
    && (!incidentQuery || `${alert.source_id || ""} ${alert.title || ""} ${alert.message || ""} ${alert.driver_id || ""} ${alert.trip_id || ""}`.toLowerCase().includes(incidentQuery))
    && (safetyStatus === "all" || (safetyStatus === "open" ? isOpen(alert) : isClosed(alert)));
  const openCases = alertRows.filter((alert) => isSafetyIncident(alert) && isOpen(alert) && caseMatchesFilters(alert));
  const filteredOpenCases = openCases;
  const requiringReview = new Set(filteredOpenCases.filter((alert) => alert.action_required || ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity))).map((alert) => String(alert.driver_id || "")).filter(Boolean));
  const incidentTypes = [...new Set(alertRows.map((alert) => String(alert.alert_type || alert.title || "Not recorded")))].sort((a, b) => a.localeCompare(b));
  const severityOptions = [...new Set(alertRows.map((alert) => severityLabel(alert.severity)).filter((value) => value !== "NOT RECORDED"))].sort((a, b) => (severityWeight[b] ?? -1) - (severityWeight[a] ?? -1));
  const reportedDriverStats = filteredDrivers.map((driver) => {
    const incidents = filteredIncidents.filter((alert) => String(alert.driver_id || "") === String(driver.id));
    const dates = incidents.map(reportDate).filter((date): date is Date => date !== null);
    const relatedCases = filteredOpenCases.filter((alert) => String(alert.driver_id || "") === String(driver.id));
    return {
      driver,
      incidentCount: incidents.length,
      highSeverityCount: incidents.filter((alert) => ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity))).length,
      openCases: relatedCases.length,
      latestIncident: dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null,
      score: null as number | null,
      classification: null as string | null,
    };
  });
  const unscoredDrivers = reportedDriverStats;
  const filteredUnscored = unscoredDrivers
    .filter((item) => !selectedDriverId || item.driver.id === selectedDriverId)
    .filter((item) => !normalizedDriverSearch || `${driverName(item.driver)} ${item.driver.id}`.toLowerCase().includes(normalizedDriverSearch))
    .sort((a, b) => {
      const result = sortBy === "name" ? driverName(a.driver).localeCompare(driverName(b.driver))
        : sortBy === "lastIncident" ? (a.latestIncident?.getTime() ?? -1) - (b.latestIncident?.getTime() ?? -1)
          : a.incidentCount - b.incidentCount;
      return ascending ? result : -result;
    });
  const scoreFilteredUnscored = filteredUnscored.filter((item) => !incidentCountFilter || (incidentCountFilter === "1" ? item.incidentCount === 1 : item.incidentCount >= 2));
  const pageCount = Math.max(1, Math.ceil(scoreFilteredUnscored.length / pageSize));
  const pagedUnscored = scoreFilteredUnscored.slice((page - 1) * pageSize, page * pageSize);

  const previousDuration = period.start && period.end ? period.end.getTime() - period.start.getTime() + 1 : 0;
  const previousEnd = period.start ? new Date(period.start.getTime() - 1) : null;
  const previousStart = previousEnd && previousDuration ? new Date(previousEnd.getTime() - previousDuration + 1) : null;
  const previousIncidents = alertRows.filter((alert) => {
    const reported = reportDate(alert);
    return periodIncludes(reported, previousStart, previousEnd)
      && (!selectedDriverId || String(alert.driver_id || "") === selectedDriverId)
      && (incidentType === "all" || String(alert.alert_type || alert.title || "") === incidentType)
      && (severityFilter === "all" || severityLabel(alert.severity) === severityFilter)
      && (safetyStatus === "all" || (safetyStatus === "open" ? isOpen(alert) : isClosed(alert)))
      && (!incidentQuery || `${alert.source_id || ""} ${alert.title || ""} ${alert.message || ""} ${alert.driver_id || ""} ${alert.trip_id || ""}`.toLowerCase().includes(incidentQuery))
      && isSafetyIncident(alert);
  });
  const previousIncidentCount = new Set(previousIncidents.map((alert) => String(alert.source_id || alert.id))).size;
  const change = (current: number, previous: number) => previous ? ((current - previous) / previous) * 100 : null;
  const days = period.start && period.end ? Math.ceil((period.end.getTime() - period.start.getTime() + 1) / 86400000) : 0;
  const interval: "day" | "week" | "month" = days > 180 ? "month" : days > 45 ? "week" : "day";
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  if (validPeriod && period.start && period.end) {
    const cursor = new Date(period.start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= period.end) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      if (interval === "month") end.setMonth(end.getMonth() + 1, 0);
      else if (interval === "week") end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (end > period.end) end.setTime(period.end.getTime());
      const label = interval === "month" ? start.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : interval === "week" ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      buckets.push({ start, end, label });
      if (interval === "month") cursor.setMonth(cursor.getMonth() + 1, 1);
      else cursor.setDate(cursor.getDate() + (interval === "week" ? 7 : 1));
    }
  }
  const trendData = buckets.map((bucket) => {
    const reports = filteredIncidents.filter((alert) => periodIncludes(reportDate(alert), bucket.start, bucket.end));
    const previousBucketStart = new Date(bucket.start.getTime() - previousDuration);
    const previousBucketEnd = new Date(bucket.end.getTime() - previousDuration);
    const prior = alertRows.filter((alert) => isSafetyIncident(alert)
      && periodIncludes(reportDate(alert), previousBucketStart, previousBucketEnd)
      && (!selectedDriverId || String(alert.driver_id || "") === selectedDriverId)
      && (incidentType === "all" || String(alert.alert_type || alert.title || "") === incidentType)
      && (severityFilter === "all" || severityLabel(alert.severity) === severityFilter)
      && (!incidentQuery || `${alert.source_id || ""} ${alert.title || ""} ${alert.message || ""} ${alert.driver_id || ""} ${alert.trip_id || ""}`.toLowerCase().includes(incidentQuery))
      && (!incidentQuery || `${alert.source_id || ""} ${alert.title || ""} ${alert.message || ""} ${alert.driver_id || ""} ${alert.trip_id || ""}`.toLowerCase().includes(incidentQuery))
      && (safetyStatus === "all" || (safetyStatus === "open" ? isOpen(alert) : isClosed(alert))));
    const highSeverity = reports.filter((alert) => ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity))).length;
    const priorHigh = prior.filter((alert) => ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity))).length;
    return {
      label: bucket.label,
      fullPeriod: `${bucket.start.toLocaleDateString()} – ${bucket.end.toLocaleDateString()}`,
      reports: reports.length,
      reportsPrevious: prior.length,
      highSeverity,
      highSeverityPrevious: priorHigh,
    };
  });
  const hasTrendData = filteredIncidents.length > 0;

  const dueAlerts = filteredOpenCases.filter((alert) => {
    const due = timestamp(alert.metadata?.due_date);
    return Boolean(due && due < new Date());
  });
  const seriousAlerts = filteredIncidents.filter((alert) => ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity)));
  const followUpItems = [
    ...dueAlerts.map((alert) => ({ alert, label: "Overdue follow-up", detail: `Due ${formatDate(alert.metadata?.due_date)}`, urgent: true })),
    ...filteredOpenCases.filter((alert) => ["HIGH", "CRITICAL"].includes(severityLabel(alert.severity)) && !dueAlerts.includes(alert)).map((alert) => ({ alert, label: "Open serious case", detail: `${severityLabel(alert.severity)} · ${String(alert.status || "ACTIVE")}`, urgent: true })),
    ...seriousAlerts.filter((alert) => !isOpen(alert)).slice(0, 3).map((alert) => ({ alert, label: "Recent serious incident", detail: `${severityLabel(alert.severity)} · reported ${formatDate(reportDate(alert))}`, urgent: false })),
  ].sort((a, b) => Number(b.urgent) - Number(a.urgent) || (severityWeight[severityLabel(b.alert.severity)] ?? 0) - (severityWeight[severityLabel(a.alert.severity)] ?? 0) || (reportDate(b.alert)?.getTime() ?? 0) - (reportDate(a.alert)?.getTime() ?? 0)).slice(0, 6);

  const selectedDriverIncidents = selectedDriver ? alertRows.filter((alert) => isSafetyIncident(alert) && alert.driver_id === selectedDriver.id).sort((a, b) => (reportDate(b)?.getTime() ?? 0) - (reportDate(a)?.getTime() ?? 0)) : [];
  const selectedDriverOpen = selectedDriverIncidents.filter(isOpen).length;
  const selectedDriverHistory = auditRows.filter((entry) => selectedDriverIncidents.some((alert) => String(alert.id) === String(entry.alert_id) || String(alert.id) === String(entry.alerts?.id)));
  const selectedIncidentHistory = selectedIncident ? auditRows.filter((entry) => String(entry.alert_id) === String(selectedIncident.id) || String(entry.alerts?.id) === String(selectedIncident.id)) : [];
  const canUpdateCases = hasPermission(role, "alerts", "update");
  const incidentPageCount = Math.max(1, Math.ceil(filteredIncidents.length / 10));
  const shownIncidentPage = Math.min(incidentPage, incidentPageCount);
  const pagedIncidents = filteredIncidents.slice((shownIncidentPage - 1) * 10, shownIncidentPage * 10);
  const periodLabel = period.start && period.end ? `${period.start.toLocaleDateString()} – ${period.end.toLocaleDateString()}` : "Choose dates";

  const refresh = () => setRetry((value) => value + 1);
  const resetPagination = () => { setPage(1); setIncidentPage(1); };
  const updateCase = async (alert: SafetyAlert, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED") => {
    if (!canUpdateCases || !alert.id) return;
    setUpdatingId(alert.id);
    setNotice(null);
    try {
      await updateAlertStatus(alert.id, status);
      setAlertRows((current) => current.map((item) => item.id === alert.id ? { ...item, status, updated_at: new Date().toISOString() } : item));
      setSelectedIncident((current) => current?.id === alert.id ? { ...current, status, updated_at: new Date().toISOString() } : current);
      setNotice(`Safety case ${alert.source_id || alert.id} updated to ${status.replace(/_/g, " ")}.`);
      window.setTimeout(() => setNotice(null), 3500);
      try {
        const history = await fetchPages((offset) => getAlertHistory({ limit: 200, offset }));
        setAuditRows(history.filter((entry) => {
          const item = entry.alerts as Record<string, unknown> | null | undefined;
          return String(item?.source_type || "").toUpperCase() === "INCIDENT_REPORT"
            && (String(entry.alert_id) === String(alert.id) || String(item?.id) === String(alert.id));
        }) as AlertHistory[]);
        setHistoryError(null);
      } catch {
        setHistoryError("Case updated, but audit history could not be refreshed.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update this safety case.");
    } finally {
      setUpdatingId(null);
    }
  };

  const exportReport = () => {
    if (!validPeriod) return;
    const rows: unknown[][] = [
      ["Airship Express Driver Safety Report"],
      ["Reporting period", periodLabel],
      ["Source", "Authenticated alerts API; unique INCIDENT_REPORT source_id records"],
      ["Score methodology", "No verified safety-score source or scoring formula is available; scores and risk classifications are not calculated."],
      ["Distinct drivers with recorded incidents", uniqueDriverIds.size],
      ["Unique incidents in period", filteredIncidents.length],
      ["Drivers requiring review", requiringReview.size],
      ["Incident-free drivers", "Not calculated; incident source coverage is not complete enough to prove no incidents."],
      ["Open cases", filteredOpenCases.length],
      [],
      ["Incident ID", "Driver ID", "Driver", "Trip ID", "Type", "Existing alert severity", "Case status", "Reported at", "Description", "Assigned reviewer", "Follow-up deadline"],
      ...filteredIncidents.map((alert) => [alert.source_id || alert.id, alert.driver_id, driverRows.find((driver) => driver.id === alert.driver_id) ? driverName(driverRows.find((driver) => driver.id === alert.driver_id)!) : "Driver not linked", alert.trip_id, alert.title || alert.alert_type, alert.severity || "Not recorded", caseStatusLabel(alert), alert.metadata?.reported_at || alert.created_at, alert.message, alert.assigned_to, alert.metadata?.due_date]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `driver-safety-${localDateString(period.start!)}-to-${localDateString(period.end!)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Filtered safety report exported.");
    window.setTimeout(() => setNotice(null), 3500);
  };

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setAscending((value) => !value);
    else { setSortBy(key); setAscending(false); }
    setPage(1);
  };

  return <div className="min-h-screen bg-[#f4f7fb] text-[#122038]"><GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.035)] sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-bold tracking-tight text-[#122038] sm:text-2xl">Driver Safety Scores</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse motion-reduce:animate-none bg-amber-500" : lastUpdated ? "bg-emerald-500" : "bg-slate-400"}`} />{refreshing ? "Refreshing" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Waiting for data"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Monitor recorded safety incidents, review active cases, and identify drivers who may need follow-up.</p><p className="mt-1 text-[10px] text-slate-400">Incident report period: {periodLabel} · Score history: not available from current data sources</p></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[170px_200px_160px_170px_auto_auto]">
          <label className="relative"><span className="sr-only">Incident reporting period</span><CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b80049]" size={14} /><select value={range} onChange={(event) => { setRange(event.target.value as DateRange); resetPagination(); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">{dateRanges.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Filter by driver</span><select value={selectedDriverId} onChange={(event) => { setSelectedDriverId(event.target.value); resetPagination(); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="">All drivers</option>{filteredDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driverName(driver)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Filter incident type</span><select value={incidentType} onChange={(event) => { setIncidentType(event.target.value); resetPagination(); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="all">All incident types</option>{incidentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Filter safety case status</span><select value={safetyStatus} onChange={(event) => { setSafetyStatus(event.target.value as SafetyStatus); resetPagination(); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="all">All case statuses</option><option value="open">Open cases</option><option value="closed">Closed cases</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <button type="button" onClick={refresh} disabled={loading || refreshing} aria-label="Refresh safety data" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049] disabled:opacity-50">{refreshing ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw size={14} />}<span className="sm:hidden">Refresh</span></button>
          <button type="button" onClick={exportReport} disabled={loading || !validPeriod || filteredIncidents.length === 0} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 text-[11px] font-semibold text-white hover:bg-[#97003d] disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} />Export Report</button>
        </div>
        {range === "Custom Range" && <div className="flex flex-wrap items-center gap-2 xl:basis-full xl:justify-end"><label htmlFor="safety-start" className="text-[10px] font-semibold text-slate-500">From</label><input id="safety-start" type="date" value={customStart} max={customEnd} onChange={(event) => { setCustomStart(event.target.value); resetPagination(); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /><label htmlFor="safety-end" className="text-[10px] font-semibold text-slate-500">To</label><input id="safety-end" type="date" value={customEnd} min={customStart} max={localDateString(new Date())} onChange={(event) => { setCustomEnd(event.target.value); resetPagination(); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></div>}
      </header>
      {range === "Custom Range" && !validPeriod && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">Select a valid date range.</p>}
      {loadError && <div role="alert" className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"><span><strong>Safety data could not be loaded.</strong> {loadError}</span><button type="button" onClick={refresh} className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100 sm:self-auto"><RefreshCw size={13} />Retry</button></div>}
      {historyError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] text-amber-900">Incident records loaded, but review history is unavailable: {historyError}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800"><Check size={14} />{notice}</p>}

      <section aria-label="Safety indicators" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[128px] animate-pulse motion-reduce:animate-none rounded-xl border border-slate-200 bg-white" />) : <>
          <SafetyKpi icon={Users} label="Drivers with Safety Records" value={uniqueDriverIds.size} note="Distinct linked drivers with a reported incident in this period" tone="pink" />
          <SafetyKpi icon={ShieldCheck} label="Average Safety Score" value="Unavailable" note="No verified score field or calculation history exists" tone="slate" />
          <SafetyKpi icon={AlertTriangle} label="Recorded Safety Incidents" value={filteredIncidents.length} note="Unique incident source IDs, reported during this period" comparison={change(filteredIncidents.length, previousIncidentCount)} inverse tone={filteredIncidents.length ? "amber" : "green"} />
          <SafetyKpi icon={ShieldAlert} label="Drivers Requiring Review" value={requiringReview.size} note="Distinct drivers with an open action-required or HIGH/CRITICAL case" tone={requiringReview.size ? "red" : "green"} />
          <SafetyKpi icon={CircleHelp} label="Incident-Free Drivers" value="Unavailable" note="A missing report cannot prove an incident-free record" tone="slate" />
          <SafetyKpi icon={FileClock} label="Open Safety Cases" value={filteredOpenCases.length} note="Current open status; not limited to the reporting period" tone={filteredOpenCases.length ? "amber" : "green"} />
        </>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.85fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-bold text-[#122038]">Safety Score Distribution</h2><p className="mt-1 text-[10px] text-slate-500">Eligible drivers and established score bands, if the source records provide them.</p></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold text-slate-600">{driverRows.length} drivers in directory</span></div><div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center"><ShieldCheck className="mb-2 text-slate-400" size={24} /><p className="text-xs font-semibold text-slate-700">Safety score distribution unavailable</p><p className="mt-1 max-w-xl text-[10px] leading-4 text-slate-500">The current driver and incident APIs expose no verified safety score, score history, approved thresholds, or classification bands. No scores or risk grades are inferred from incident counts.</p><p className="mt-2 text-[9px] font-medium text-slate-400">Stored score fields available in driver records: none</p></div></article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex flex-col gap-3"><div><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-[#122038]">Safety Trends</h2><span className="text-[9px] text-slate-400">{interval} intervals</span></div><p className="mt-1 text-[10px] text-slate-500">Counts use reported_at; volume changes do not prove behavior worsened.</p></div><label><span className="sr-only">Safety trend metric</span><select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as TrendMetric)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="reports">Recorded Incidents</option><option value="highSeverity">HIGH / CRITICAL reports</option></select></label></div><div className="mt-4 h-[220px]">{hasTrendData && trendData.some((row) => row[trendMetric] > 0) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#e8edf4" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#718096", fontSize: 8 }} axisLine={{ stroke: "#dfe6ef" }} tickLine={false} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fill: "#718096", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip content={<SafetyTooltip />} /><Line type="monotone" dataKey={trendMetric} name={trendMetric === "reports" ? "Reported incidents" : "HIGH / CRITICAL"} stroke="#b80049" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} /><Line type="monotone" dataKey={`${trendMetric}Previous`} name="Previous period" stroke="#9aa8b9" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center"><p className="text-[10px] font-semibold text-slate-700">{filteredIncidents.length ? "No trend values in this period" : "No safety incidents reported in this period"}</p><p className="mt-1 text-[9px] text-slate-500">Reported incident counts reflect reporting activity, not a verified change in driver behavior.</p></div>}</div><p className="mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">Severity trend uses the existing alert classifier: {severityOptions.join(", ") || "no severity values"}. Occurrence timestamps are not stored separately from report timestamps.</p></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Driver Safety Leaderboard</h2><p className="mt-1 text-[10px] text-slate-500">Scores cannot be ranked: no approved score source or classification exists. Showing the unscored incident group.</p></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold text-slate-600">Unscored group · {filteredUnscored.length}</span></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="relative block flex-1"><span className="sr-only">Search drivers</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input value={driverSearch} onChange={(event) => { setDriverSearch(event.target.value); setPage(1); }} placeholder="Search driver name or ID" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></label><label><span className="sr-only">Filter by incident count</span><select value={scoreBand} onChange={(event) => { setScoreBand(event.target.value); setPage(1); }} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="">All incident counts</option><option value="1">1 incident</option><option value="2+">2 or more</option></select></label><span className="text-[9px] text-slate-400">Sort by</span><button type="button" onClick={() => toggleSort("incidents")} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-700 hover:border-pink-200">Incidents {sortBy === "incidents" && (ascending ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button><button type="button" onClick={() => toggleSort("lastIncident")} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-700 hover:border-pink-200">Last report {sortBy === "lastIncident" && (ascending ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3 sm:px-5">Driver</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Reported incidents</th><th className="px-3 py-3">High severity</th><th className="px-3 py-3">Last report</th><th className="px-3 py-3">Open cases</th><th className="px-3 py-3">Classification</th></tr></thead><tbody className="divide-y divide-slate-100 text-[10px]">{pagedUnscored.filter((item) => !scoreBand || (scoreBand === "1" ? item.incidentCount === 1 : item.incidentCount >= 2)).map((item) => <tr key={item.driver.id} tabIndex={0} onClick={() => setSelectedDriver(item.driver)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedDriver(item.driver); }} className="cursor-pointer hover:bg-pink-50/40 focus:bg-pink-50/50 focus:outline-none"><td className="px-4 py-3 sm:px-5"><span className="flex items-center gap-2"><FtmProfileAvatar name={driverName(item.driver)} userId={item.driver.id} src={item.driver.avatar_url ?? item.driver.avatarUrl} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-100 bg-pink-50 text-[9px] font-bold text-[#b80049]" /><span><strong className="block text-slate-800">{driverName(item.driver)}</strong><span className="font-mono text-[8px] text-slate-400">{item.driver.id}</span></span></span></td><td className="px-3 py-3 text-slate-400">Not recorded</td><td className="px-3 py-3 font-semibold text-slate-700">{item.incidentCount}</td><td className="px-3 py-3 text-slate-700">{item.highSeverityCount}</td><td className="px-3 py-3 text-slate-500">{formatDate(item.latestIncident)}</td><td className="px-3 py-3 text-slate-700">{item.openCases}</td><td className="px-3 py-3 text-slate-400">No approved classification</td></tr>)}{!pagedUnscored.length && <tr><td colSpan={7} className="px-4 py-9 text-center text-[10px] text-slate-500">{loading ? "Loading incident records…" : loadError || "No drivers with incidents match this period and filters."}</td></tr>}</tbody></table></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500"><span>Scores are not ranked; incident coverage varies by reporting history.</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous safety page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronLeft size={13} /></button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next safety page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronRight size={13} /></button></div></div></article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Safety Follow-up</h2><p className="mt-1 text-[10px] text-slate-500">Open cases and serious reported incidents; no automatic score penalties.</p></div><ShieldAlert className="text-[#b80049]" size={17} /></div>{followUpItems.length ? <ul className="mt-3 divide-y divide-slate-100">{followUpItems.map((item, index) => <li key={`${item.alert.id}-${item.label}-${index}`}><button type="button" onClick={() => setSelectedIncident(item.alert)} className="flex w-full items-start gap-2.5 py-3 text-left hover:bg-slate-50"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.urgent ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}><AlertTriangle size={14} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-slate-800">{item.label}</strong><span className="mt-0.5 block truncate text-[9px] text-slate-500">{item.alert.title || item.alert.alert_type} · {item.detail}</span><span className="mt-0.5 block text-[8px] text-slate-400">{item.alert.driver_id ? driverName(driverRows.find((driver) => driver.id === item.alert.driver_id) || { id: item.alert.driver_id }) : "Driver not linked"} · reported {formatDateTime(reportDate(item.alert))}</span></span><ChevronRight size={13} className="mt-1 shrink-0 text-slate-400" /></button></li>)}</ul> : <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><ShieldCheck className="mx-auto mb-2 text-emerald-600" size={22} /><p className="text-[10px] font-semibold text-slate-700">No qualifying follow-up cases</p><p className="mt-1 text-[9px] text-slate-500">No open action-required HIGH/CRITICAL cases or overdue recorded deadlines.</p></div>}</article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-[#122038]">Safety Incidents</h2><p className="mt-1 text-[10px] text-slate-500">Distinct incident reports filtered by the selected reporting period. Incident occurrence time is not a separate source field.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><span className="sr-only">Filter incident severity</span><select value={severityFilter} onChange={(event) => { setSeverityFilter(event.target.value); setPage(1); }} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049]"><option value="all">All severities</option>{severityOptions.map((severity) => <option key={severity}>{severity}</option>)}</select></label><label className="relative"><span className="sr-only">Search incident records</span><Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><input value={incidentSearch} onChange={(event) => { setIncidentSearch(event.target.value); setPage(1); }} placeholder="ID, driver, trip, or text" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-[10px] outline-none focus:border-[#b80049] sm:w-48" /></label></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Incident ID</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Trip</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Severity</th><th className="px-3 py-3">Reported at</th><th className="px-3 py-3">Case status</th><th className="px-3 py-3">Reviewer</th><th className="px-3 py-3">Follow-up due</th></tr></thead><tbody className="divide-y divide-slate-100 text-[9px]">{pagedIncidents.map((alert) => <tr key={String(alert.source_id || alert.id)} tabIndex={0} onClick={() => setSelectedIncident(alert)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedIncident(alert); }} className="cursor-pointer hover:bg-pink-50/30 focus:bg-pink-50/40 focus:outline-none"><td className="px-4 py-3 font-mono font-semibold text-[#b80049]">{alert.source_id || alert.id}</td><td className="px-3 py-3 text-slate-700">{alert.driver_id ? driverName(driverRows.find((driver) => driver.id === alert.driver_id) || { id: alert.driver_id }) : "Not linked"}</td><td className="px-3 py-3 font-mono text-slate-600">{alert.trip_id || "Not linked"}</td><td className="px-3 py-3 text-slate-700">{alert.title || alert.alert_type || "Type not recorded"}</td><td className="px-3 py-3"><span className={`rounded-md border px-1.5 py-1 font-bold ${severityTone(alert.severity)}`}>{severityLabel(alert.severity)}</span></td><td className="px-3 py-3 text-slate-500">{formatDateTime(reportDate(alert))}</td><td className="px-3 py-3"><span className={`rounded-md border px-1.5 py-1 font-semibold ${statusTone(alert.status)}`}>{alert.status || "ACTIVE"}</span></td><td className="px-3 py-3 font-mono text-slate-500">{alert.assigned_to || "Not assigned"}</td><td className="px-3 py-3 text-slate-500">{formatDate(alert.metadata?.due_date)}</td></tr>)}{!pagedIncidents.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-[10px] text-slate-500">{loading ? "Loading incident reports…" : loadError || `No incident reports match ${periodLabel} and these filters.`}</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500"><span>{filteredIncidents.length} distinct incidents · source_id deduplicated</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous incident page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronLeft size={13} /></button><span>Page {page} of {incidentPageCount}</span><button type="button" disabled={page >= incidentPageCount} onClick={() => setPage((value) => Math.min(incidentPageCount, value + 1))} aria-label="Next incident page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronRight size={13} /></button></div></div></section>
      <div className="flex items-center justify-between gap-3 rounded-b-xl border border-t-0 border-slate-200 bg-white px-4 py-3 text-[9px] text-slate-500"><span>{filteredIncidents.length} distinct incident reports</span><div className="flex items-center gap-2"><button type="button" disabled={shownIncidentPage <= 1} onClick={() => setIncidentPage((value) => Math.max(1, value - 1))} aria-label="Previous incident page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronLeft size={13} /></button><span>Incident page {shownIncidentPage} of {incidentPageCount}</span><button type="button" disabled={shownIncidentPage >= incidentPageCount} onClick={() => setIncidentPage((value) => Math.min(incidentPageCount, value + 1))} aria-label="Next incident page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronRight size={13} /></button></div></div>
    </main><GlobalFooter />

    {selectedDriver && <SafetyDriverDrawer driver={selectedDriver} incidents={selectedDriverIncidents} openCases={selectedDriverOpen} history={selectedDriverHistory} onClose={() => setSelectedDriver(null)} onOpenIncident={setSelectedIncident} />}
    {selectedIncident && <SafetyIncidentDrawer alert={selectedIncident} history={selectedIncidentHistory} driver={driverRows.find((item) => item.id === selectedIncident.driver_id) || null} canUpdate={canUpdateCases && hasCanonicalAlertId(selectedIncident)} updating={updatingId === selectedIncident.id} onClose={() => setSelectedIncident(null)} onUpdate={(status) => void updateCase(selectedIncident, status)} />}
  </div>;
}

function SafetyKpi({ icon: Icon, label, value, note, tone = "pink", comparison, inverse = false }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  note: string;
  tone?: "pink" | "green" | "amber" | "red" | "slate";
  comparison?: number | null;
  inverse?: boolean;
}) {
  const tones = { pink: "border-pink-100 bg-pink-50 text-[#b80049]", green: "border-emerald-100 bg-emerald-50 text-emerald-700", amber: "border-amber-100 bg-amber-50 text-amber-700", red: "border-rose-100 bg-rose-50 text-rose-700", slate: "border-slate-200 bg-slate-100 text-slate-500" };
  const positive = comparison != null && ((comparison > 0) !== inverse);
  return <article className="flex min-h-[128px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-semibold leading-4 text-slate-500">{label}</p><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon size={15} /></span></div><div><p className="text-[21px] font-bold leading-7 text-[#122038]">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-400">{comparison != null && comparison !== 0 && <span className={`mr-1 inline-flex items-center gap-0.5 font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(comparison).toFixed(1)}% vs prior period</span>}{note}</p></div></article>;
}

function SafetyDriverDrawer({ driver, incidents, openCases, history, onClose, onOpenIncident }: {
  driver: Driver;
  incidents: SafetyAlert[];
  openCases: number;
  history: AlertHistory[];
  onClose: () => void;
  onOpenIncident: (alert: SafetyAlert) => void;
}) {
  const lifetimeScore = null;
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="safety-driver-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FtmProfileAvatar name={driverName(driver)} userId={driver.id} src={driver.avatar_url ?? driver.avatarUrl} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-200 bg-pink-50 text-xs font-bold text-[#b80049]" /><div className="min-w-0"><h2 id="safety-driver-title" className="truncate text-sm font-bold text-[#122038]">{driverName(driver)}</h2><p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{driver.id} · safety profile</p></div></div><button type="button" onClick={onClose} aria-label="Close safety profile" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[9px] text-slate-500">Stored score<strong className="mt-1 block text-sm text-slate-700">{lifetimeScore == null ? "Not available" : lifetimeScore}</strong></p><p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[9px] text-slate-500">Reported incidents<strong className="mt-1 block text-sm text-slate-700">{incidents.length}</strong></p><p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[9px] text-slate-500">Open cases<strong className="mt-1 block text-sm text-slate-700">{openCases}</strong></p><p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[9px] text-slate-500">Latest reported activity<strong className="mt-1 block text-[10px] text-slate-700">{incidents.length ? formatDateTime(reportDate(incidents[0])) : "Not recorded"}</strong></p></div><p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-[9px] leading-4 text-amber-900">No safety formula, score history, or classification thresholds are exposed. Incident counts do not produce a score.</p><div className="mt-4 grid gap-3 lg:grid-cols-2"><section className="rounded-lg border border-slate-200 p-3"><h3 className="text-[10px] font-bold text-slate-800">Incident timeline</h3><div className="mt-2 max-h-[310px] divide-y divide-slate-100 overflow-y-auto">{incidents.map((alert) => <button type="button" key={alert.id} onClick={() => onOpenIncident(alert)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-pink-50"><span className="min-w-0"><strong className="block truncate text-[9px] text-slate-800">{alert.title || alert.alert_type || "Incident report"}</strong><span className="mt-0.5 block truncate text-[8px] text-slate-500">Trip {alert.trip_id || "not linked"} · {alert.status || "ACTIVE"}</span></span><span className="shrink-0 text-right"><span className={`block rounded border px-1 py-0.5 text-[8px] font-bold ${severityTone(alert.severity)}`}>{severityLabel(alert.severity)}</span><span className="mt-1 block text-[8px] text-slate-400">{formatDateTime(reportDate(alert))}</span></span></button>)}{!incidents.length && <p className="py-6 text-center text-[9px] text-slate-500">No linked incident reports found.</p>}</div></section><section className="rounded-lg border border-slate-200 p-3"><h3 className="text-[10px] font-bold text-slate-800">Recorded review history</h3><div className="mt-2 max-h-[310px] divide-y divide-slate-100 overflow-y-auto">{history.map((entry) => <div key={entry.id} className="py-2.5"><p className="text-[9px] font-semibold text-slate-700">{entry.action || entry.new_status || "Review update"}</p><p className="mt-0.5 text-[8px] text-slate-500">{entry.description || `${entry.previous_status || "Status"} → ${entry.new_status || "updated"}`}</p><p className="mt-0.5 text-[8px] text-slate-400">{formatDateTime(entry.created_at)} · reviewer {entry.actor_id || "not recorded"}</p></div>)}{!history.length && <p className="py-6 text-center text-[9px] text-slate-500">No audit history is linked to these incidents.</p>}</div></section></div><div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><a href="/driver/performance" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049]">Open driver performance <ExternalLink size={12} /></a></div></section></div>;
}

function SafetyIncidentDrawer({ alert, history, driver, canUpdate, updating, onClose, onUpdate }: {
  alert: SafetyAlert;
  history: AlertHistory[];
  driver: Driver | null;
  canUpdate: boolean;
  updating: boolean;
  onClose: () => void;
  onUpdate: (status: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED") => void;
}) {
  const evidence = typeof alert.metadata?.photo_url === "string" ? alert.metadata.photo_url : null;
  return <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="safety-incident-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wide text-[#b80049]">Safety incident · {alert.source_id || alert.id}</p><h2 id="safety-incident-title" className="mt-1 text-sm font-bold text-slate-900">{alert.title || alert.alert_type || "Incident report"}</h2></div><button type="button" onClick={onClose} aria-label="Close incident details" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded border px-2 py-1 text-[9px] font-bold ${severityTone(alert.severity)}`}>{severityLabel(alert.severity)} · existing alert classification</span><span className={`rounded border px-2 py-1 text-[9px] font-semibold ${statusTone(alert.status)}`}>{alert.status || "ACTIVE"}</span></div><dl className="mt-4 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Driver</dt><dd className="mt-1 font-semibold text-slate-800">{driver ? driverName(driver) : alert.driver_id || "Not linked"}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Related trip</dt><dd className="mt-1 font-mono font-semibold text-slate-800">{alert.trip_id || "Not linked"}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Reported at</dt><dd className="mt-1 font-semibold text-slate-800">{formatDateTime(reportDate(alert))}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Occurrence time</dt><dd className="mt-1 font-semibold text-slate-800">Not stored separately</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Assigned reviewer</dt><dd className="mt-1 font-mono font-semibold text-slate-800">{alert.assigned_to || "Not assigned"}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Follow-up deadline</dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(alert.metadata?.due_date)}</dd></div></dl><div className="mt-3 rounded-lg border border-slate-200 p-3"><h3 className="text-[9px] font-bold text-slate-700">Recorded report details</h3><p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{alert.message || alert.metadata?.reason || "No description recorded."}</p></div>{evidence && <div className="mt-3 rounded-lg border border-slate-200 p-3"><h3 className="text-[9px] font-bold text-slate-700">Evidence link</h3><a href={evidence} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-[9px] font-semibold text-[#b80049] hover:underline">Open recorded attachment <ExternalLink size={11} /></a></div>}<section className="mt-3 rounded-lg border border-slate-200 p-3"><h3 className="text-[9px] font-bold text-slate-700">Review history</h3><div className="mt-2 divide-y divide-slate-100">{history.map((entry) => <div key={entry.id} className="py-2"><p className="text-[9px] font-semibold text-slate-700">{entry.action || entry.new_status || "Review update"}</p><p className="mt-0.5 text-[8px] text-slate-500">{entry.description || `${entry.previous_status || "Status"} → ${entry.new_status || "updated"}`}</p><p className="mt-0.5 text-[8px] text-slate-400">{formatDateTime(entry.created_at)} · reviewer {entry.actor_id || "not recorded"}</p></div>)}{!history.length && <p className="py-3 text-[8px] text-slate-500">No review history is recorded.</p>}</div></section>{canUpdate && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">{(["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const).filter((status) => String(alert.status || "ACTIVE").toUpperCase() !== status).map((status) => <button key={status} type="button" disabled={updating} onClick={() => onUpdate(status)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-[9px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049] disabled:opacity-50">{updating ? <LoaderCircle size={11} className="animate-spin motion-reduce:animate-none" /> : <Check size={11} />}{status.replace(/_/g, " ")}</button>)}</div>}<div className="mt-3 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white hover:bg-slate-700">Close</button></div></section></div>;
}