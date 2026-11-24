"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Gauge,
  LoaderCircle,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
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
import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import FtmProfileAvatar from "../../../components/global/FtmProfileAvatar";
import { getAlerts, getDrivers, getTrips } from "../../../lib/api";

type DriverRecord = {
  id: string;
  full_name?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  is_active?: boolean | null;
  status?: string | null;
};

type TripRecord = {
  id?: string | null;
  driver_id?: string | null;
  driverId?: string | null;
  driver_name?: string | null;
  driverName?: string | null;
  status?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  eta_at?: string | null;
  etaAt?: string | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  routePlan?: {
    routeDetails?: { schedule?: { window_end?: string | null } } | null;
    route_details?: { schedule?: { window_end?: string | null } } | null;
  } | null;
};

type IncidentRecord = {
  id?: string | number;
  driverId?: string | null;
  tripId?: string | null;
  incidentType?: string | null;
  description?: string | null;
  reportedAt?: string | null;
};

type AlertRecord = {
  id?: string | number;
  source_type?: string | null;
  source_id?: string | null;
  driver_id?: string | null;
  trip_id?: string | null;
  alert_type?: string | null;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  metadata?: { reported_at?: string | null } | null;
};

type DatePreset = "Today" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range";
type DriverStats = {
  driver: DriverRecord;
  assigned: number;
  completed: number;
  onTimeCount: number;
  onTimeEligible: number;
  exceptions: number;
  onTimeRate: number | null;
};

const datePresets: DatePreset[] = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "Custom Range"];
const positiveTripStatuses = new Set([
  "pending", "scheduled", "assigned", "accepted", "in progress", "in_progress", "in transit", "in_transit",
  "dispatched", "picked up", "picked_up", "out for delivery", "delayed", "late", "exception", "failed", "failure",
  "completed", "complete", "delivered",
]);

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateWindow(preset: DatePreset, customStart: string, customEnd: string, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "Last 7 Days") start.setDate(start.getDate() - 6);
  else if (preset === "Last 30 Days") start.setDate(start.getDate() - 29);
  else if (preset === "This Month") start.setDate(1);
  else if (preset === "Custom Range") {
    return { start: parseLocalDate(customStart), end: parseLocalDate(customEnd, true) };
  }
  return { start, end };
}

function statusOf(trip: TripRecord) {
  return String(trip.status ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function isCompleted(trip: TripRecord) {
  return ["completed", "complete", "delivered"].includes(statusOf(trip));
}

function isCancelled(trip: TripRecord) {
  return /cancel|void|deleted/.test(statusOf(trip));
}

function isEligibleForCompletionRate(trip: TripRecord) {
  return positiveTripStatuses.has(statusOf(trip)) && !isCancelled(trip);
}

function tripDriverId(trip: TripRecord) {
  return String(trip.driver_id ?? trip.driverId ?? "");
}

function tripCreatedAt(trip: TripRecord) {
  return trip.created_at ?? trip.createdAt ?? null;
}

function tripCompletedAt(trip: TripRecord) {
  return trip.completed_at ?? trip.completedAt ?? trip.delivered_at ?? trip.deliveredAt ?? null;
}

function tripDeadline(trip: TripRecord) {
  return trip.routePlan?.routeDetails?.schedule?.window_end
    ?? trip.routePlan?.route_details?.schedule?.window_end
    ?? null;
}

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reportDate(trip: TripRecord) {
  return timestamp(isCompleted(trip) ? tripCompletedAt(trip) : tripCreatedAt(trip)) ?? timestamp(tripCreatedAt(trip));
}

function isInWindow(value: Date | null, start: Date | null, end: Date | null) {
  return Boolean(value && start && end && value >= start && value <= end);
}

function getOnTime(trip: TripRecord) {
  if (!isCompleted(trip)) return null;
  const deadline = timestamp(tripDeadline(trip));
  const delivered = timestamp(tripCompletedAt(trip));
  if (!deadline || !delivered) return null;
  return delivered.getTime() <= deadline.getTime();
}

function tripExceptionType(trip: TripRecord) {
  const status = statusOf(trip);
  if (/cancel|void|deleted/.test(status)) return null;
  if (/delay|late/.test(status)) return "Delayed";
  if (/exception/.test(status)) return "Exception";
  if (/fail/.test(status)) return "Failed";
  return null;
}

function driverName(driver: DriverRecord) {
  return driver.full_name || driver.fullName || driver.name || driver.email || "Unnamed driver";
}

function statsForDriver(driver: DriverRecord, trips: TripRecord[]): DriverStats {
  const assignedTrips = trips.filter((trip) => tripDriverId(trip) === String(driver.id));
  const completedTrips = assignedTrips.filter(isCompleted);
  const validOnTime = completedTrips.map(getOnTime).filter((value): value is boolean => value !== null);
  const onTimeCount = validOnTime.filter(Boolean).length;
  const exceptions = assignedTrips.filter((trip) => tripExceptionType(trip) !== null).length;
  return {
    driver,
    assigned: assignedTrips.length,
    completed: completedTrips.length,
    onTimeCount,
    onTimeEligible: validOnTime.length,
    exceptions,
    onTimeRate: validOnTime.length ? (onTimeCount / validOnTime.length) * 100 : null,
  };
}

function formatPercent(value: number | null) {
  return value == null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | Date | null | undefined) {
  const date = value instanceof Date ? value : timestamp(value);
  return date ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Time not recorded";
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function TrendTooltip({ active, payload, label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Record<string, unknown> | undefined;
  return (
    <div className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="text-xs font-bold text-slate-900">{String(point?.fullPeriod || label)}</p>
      <p className="mt-1 text-[10px] text-slate-500">{String(point?.recordCount ?? 0)} trip records</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <p key={String(item.dataKey)} className="flex justify-between gap-4 text-[11px] text-slate-600">
            <span>{item.name}</span>
            <span className="font-semibold text-slate-900">
              {item.value == null ? "No valid records" : `${Number(item.value).toFixed(String(item.dataKey).includes("Rate") ? 1 : 0)}${String(item.dataKey).includes("Rate") ? "%" : ""}`}
            </span>
          </p>
        ))}
      </div>
      {typeof point?.validDeadlineCount === "number" && <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">Valid delivery deadlines: {point.validDeadlineCount}</p>}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, note, comparison, tone = "pink", limitation, inverseComparison = false }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  note: string;
  comparison?: { value: number | null; label: string; unit?: string } | null;
  tone?: "pink" | "green" | "amber" | "red" | "slate";
  limitation?: boolean;
  inverseComparison?: boolean;
}) {
  const tones = {
    pink: "bg-pink-50 text-[#b80049] border-pink-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-rose-50 text-rose-700 border-rose-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <article className="flex min-h-[136px] flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] transition-shadow hover:shadow-md sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold leading-4 text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon size={16} aria-hidden="true" /></span>
      </div>
      <div>
        <p className={`text-[23px] font-bold leading-7 tracking-tight ${limitation ? "text-slate-500" : "text-[#122038]"}`}>{value}</p>
        <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] leading-4 text-slate-400">
          {comparison?.value != null && comparison.value !== 0 && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${(comparison.value > 0) !== inverseComparison ? "text-emerald-700" : "text-rose-700"}`}>
              {comparison.value > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(comparison.value).toFixed(1)}{comparison.unit || "%"} {comparison.label}
            </span>
          )}
          <span>{note}</span>
        </div>
      </div>
    </article>
  );
}

export default function DriverOverviewPage() {
  const [preset, setPreset] = useState<DatePreset>("Last 30 Days");
  const [customStart, setCustomStart] = useState(() => localDateString(new Date(Date.now() - 6 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => localDateString(new Date()));
  const [chartMode, setChartMode] = useState<"volume" | "efficiency">("volume");
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentIssue, setIncidentIssue] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverFilterId, setDriverFilterId] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<keyof DriverStats>("completed");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadError(null);
      if (hasLoadedRef.current) setRefreshing(true);
      else setLoading(true);
      try {
        const [driverRows, tripRows, alertResult] = await Promise.all([
          getDrivers(),
          getTrips({ light: true, all: true }),
          getAlerts({ category: "SAFETY" }).then((value: unknown) => ({ value, error: null as string | null })).catch((error: unknown) => ({
            value: [],
            error: error instanceof Error ? error.message : "Incident records could not be loaded.",
          })),
        ]);
        if (!active) return;
        const uniqueTrips = new Map<string, TripRecord>();
        (Array.isArray(tripRows) ? tripRows : []).forEach((trip: TripRecord, index: number) => {
          const id = String(trip.id ?? `missing-id-${index}`);
          if (!uniqueTrips.has(id)) uniqueTrips.set(id, trip);
        });
        const scopedDrivers = Array.isArray(driverRows) ? driverRows as DriverRecord[] : [];
        const scopedTrips = [...uniqueTrips.values()];
        const driverIds = new Set(scopedDrivers.map((driver) => String(driver.id)));
        const tripIds = new Set(scopedTrips.map((trip) => String(trip.id ?? "")));
        const scopedIncidents = (Array.isArray(alertResult.value) ? alertResult.value as AlertRecord[] : [])
          .filter((alert) => String(alert.source_type || "").toUpperCase() === "INCIDENT_REPORT")
          .filter((alert) => Boolean((alert.driver_id && driverIds.has(String(alert.driver_id))) || (alert.trip_id && tripIds.has(String(alert.trip_id)))))
          .map((alert) => ({
            id: alert.source_id || alert.id,
            driverId: alert.driver_id,
            tripId: alert.trip_id,
            incidentType: alert.title || alert.alert_type,
            description: alert.message,
            reportedAt: alert.metadata?.reported_at || alert.created_at,
          }));
        setDrivers(scopedDrivers);
        setTrips(scopedTrips);
        setIncidents(scopedIncidents);
        setIncidentIssue(alertResult.error);
        hasLoadedRef.current = true;
        setLastRefreshed(new Date());
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load driver performance records.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void run();
    return () => { active = false; };
  }, [retryKey]);

  const windowRange = getDateWindow(preset, customStart, customEnd);
  const validWindow = Boolean(windowRange.start && windowRange.end && windowRange.start <= windowRange.end);
  const dateScopedTrips = validWindow
    ? trips.filter((trip) => isInWindow(reportDate(trip), windowRange.start, windowRange.end))
    : [];
  const periodTrips = dateScopedTrips.filter((trip) =>
    (!driverFilterId || tripDriverId(trip) === driverFilterId)
    && (statusFilter === "all" || String(trip.status ?? "Unknown") === statusFilter));
  const activeDrivers = drivers.filter((driver) => driver.is_active !== false && String(driver.status ?? "").toLowerCase() !== "inactive").length;
  const completedTrips = periodTrips.filter(isCompleted);
  const eligibleTrips = periodTrips.filter(isEligibleForCompletionRate);
  const validDeliveryRecords = completedTrips.map((trip) => ({ trip, onTime: getOnTime(trip) })).filter((item) => item.onTime !== null);
  const onTimeCount = validDeliveryRecords.filter((item) => item.onTime).length;
  const onTimeRate = validDeliveryRecords.length ? (onTimeCount / validDeliveryRecords.length) * 100 : null;
  const completionRate = eligibleTrips.length ? (completedTrips.filter(isEligibleForCompletionRate).length / eligibleTrips.length) * 100 : null;
  const exceptionTrips = periodTrips.filter((trip) => tripExceptionType(trip) !== null);
  const previousWindow = (() => {
    if (!validWindow || !windowRange.start || !windowRange.end) return { start: null, end: null };
    const duration = windowRange.end.getTime() - windowRange.start.getTime() + 1;
    const end = new Date(windowRange.start.getTime() - 1);
    return { start: new Date(end.getTime() - duration + 1), end };
  })();
  const previousStartTime = previousWindow.start?.getTime() ?? null;
  const previousEndTime = previousWindow.end?.getTime() ?? null;
  const previousTrips = previousStartTime != null && previousEndTime != null
    ? trips.filter((trip) => isInWindow(reportDate(trip), new Date(previousStartTime), new Date(previousEndTime))
      && (!driverFilterId || tripDriverId(trip) === driverFilterId)
      && (statusFilter === "all" || String(trip.status ?? "Unknown") === statusFilter))
    : [];
  const previousCompleted = previousTrips.filter(isCompleted);
  const previousValid = previousCompleted.map(getOnTime).filter((value): value is boolean => value !== null);
  const previousOnTimeRate = previousValid.length ? (previousValid.filter(Boolean).length / previousValid.length) * 100 : null;
  const previousExceptions = previousTrips.filter((trip) => tripExceptionType(trip) !== null).length;
  const percentChange = (current: number, previous: number | null) => previous == null || previous === 0 ? null : ((current - previous) / previous) * 100;

  const driverStats = drivers
    .map((driver) => statsForDriver(driver, periodTrips))
    .filter((stats) => stats.assigned > 0);
  const topDriver = [...driverStats]
    .filter((stats) => stats.completed >= 3 && stats.onTimeEligible >= 3 && stats.onTimeRate != null)
    .sort((a, b) => (b.onTimeRate! - a.onTimeRate!) || (b.completed - a.completed) || driverName(a.driver).localeCompare(driverName(b.driver)))[0] ?? null;

  const dateBuckets = (() => {
    if (!validWindow || !windowRange.start || !windowRange.end) return [];
    const rangeDays = Math.ceil((windowRange.end.getTime() - windowRange.start.getTime() + 1) / 86400000);
    const step = rangeDays > 45 ? 7 : 1;
    const first = new Date(windowRange.start);
    first.setHours(0, 0, 0, 0);
    const last = new Date(windowRange.end);
    last.setHours(0, 0, 0, 0);
    const buckets: Array<{ start: Date; end: Date; label: string; fullPeriod: string }> = [];
    for (const start = new Date(first); start <= last; start.setDate(start.getDate() + step)) {
      const bucketStart = new Date(start);
      const end = new Date(start);
      end.setDate(end.getDate() + step);
      end.setMilliseconds(end.getMilliseconds() - 1);
      const bucketEnd = end > windowRange.end ? windowRange.end : end;
      const label = step === 1
        ? bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : `${bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${bucketEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      buckets.push({ start: bucketStart, end: bucketEnd, label, fullPeriod: label });
    }
    return buckets;
  })();

  const trendData = dateBuckets.map((bucket) => {
    const bucketTrips = periodTrips.filter((trip) => isInWindow(reportDate(trip), bucket.start, bucket.end));
    const bucketCompleted = bucketTrips.filter(isCompleted);
    const bucketValidOnTime = bucketCompleted.map(getOnTime).filter((value): value is boolean => value !== null);
    const bucketEligible = bucketTrips.filter(isEligibleForCompletionRate);
    const bucketExceptions = bucketTrips.filter((trip) => tripExceptionType(trip) !== null).length;
    return {
      period: bucket.label,
      fullPeriod: bucket.fullPeriod,
      recordCount: bucketTrips.length,
      total: bucketTrips.length,
      validDeadlineCount: bucketValidOnTime.length,
      completed: bucketCompleted.length,
      onTime: bucketValidOnTime.filter(Boolean).length,
      exceptions: bucketExceptions,
      efficiencyRate: bucketEligible.length ? (bucketCompleted.filter(isEligibleForCompletionRate).length / bucketEligible.length) * 100 : null,
    };
  });

  const exceptionBreakdown = ["Delayed", "Exception", "Failed"].map((name) => ({
    name,
    value: exceptionTrips.filter((trip) => tripExceptionType(trip) === name).length,
  })).filter((entry) => entry.value > 0);
  const statusOptions = [...new Set(dateScopedTrips.map((trip) => String(trip.status ?? "Unknown")))].sort((a, b) => a.localeCompare(b));

  const filteredStats = driverStats
    .filter((stats) => !driverSearch.trim() || `${driverName(stats.driver)} ${stats.driver.id}`.toLowerCase().includes(driverSearch.trim().toLowerCase()))
    .sort((left, right) => {
      const leftValue = sortKey === "driver" ? driverName(left.driver).toLowerCase() : left[sortKey];
      const rightValue = sortKey === "driver" ? driverName(right.driver).toLowerCase() : right[sortKey];
      const order = typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue)
        : (Number(leftValue ?? -1) - Number(rightValue ?? -1));
      return sortAscending ? order : -order;
    });
  const pageCount = Math.max(1, Math.ceil(filteredStats.length / pageSize));
  const visibleStats = filteredStats.slice((page - 1) * pageSize, page * pageSize);
  const detailDriver = selectedDriverId ? drivers.find((driver) => driver.id === selectedDriverId) : null;
  const detailStats = detailDriver ? statsForDriver(detailDriver, periodTrips) : null;

  const activity = (() => {
    const driverById = new Map(drivers.map((driver) => [String(driver.id), driverName(driver)]));
    const items: Array<{ id: string; kind: "completed" | "exception" | "incident"; title: string; detail: string; time: Date | null; status: string }> = [];
    periodTrips.forEach((trip, index) => {
      const driver = driverById.get(tripDriverId(trip)) || trip.driver_name || trip.driverName || "Unassigned driver";
      if (isCompleted(trip)) {
        const time = timestamp(tripCompletedAt(trip));
        if (time) items.push({ id: `completed-${trip.id ?? index}`, kind: "completed", title: "Trip completed", detail: `${driver} · ${trip.id || "Trip ID unavailable"}`, time, status: String(trip.status) });
      }
      const exception = tripExceptionType(trip);
      if (exception) {
        const time = timestamp(trip.updated_at ?? trip.updatedAt ?? tripCreatedAt(trip));
        items.push({ id: `exception-${trip.id ?? index}`, kind: "exception", title: `${exception} trip`, detail: `${driver} · ${trip.id || "Trip ID unavailable"}`, time, status: String(trip.status) });
      }
    });
    incidents.forEach((incident, index) => {
      const time = timestamp(incident.reportedAt);
      if (!isInWindow(time, windowRange.start, windowRange.end)) return;
      if (driverFilterId && String(incident.driverId || "") !== driverFilterId) return;
      const driver = incident.driverId ? driverById.get(String(incident.driverId)) || "Driver record unavailable" : "Driver not linked";
      items.push({ id: `incident-${incident.id ?? index}`, kind: "incident", title: incident.incidentType || "Safety incident", detail: `${driver} · ${incident.description || "Description not recorded"}`, time, status: "Recorded" });
    });
    return items.sort((a, b) => (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0)).slice(0, 6);
  })();

  const exportReport = () => {
    if (!validWindow) return;
    try {
      const rows: unknown[][] = [
        ["Airship Express Driver Performance Overview"],
        ["Reporting period", windowRange.start?.toLocaleDateString(), windowRange.end?.toLocaleDateString()],
        ["Total active drivers (current account status)", activeDrivers],
        ["Total trips", periodTrips.length],
        ["Completed trips", completedTrips.length],
        ["On-time delivery rate", formatPercent(onTimeRate)],
        ["Average driver safety score", "Unavailable: no verified score field/source in current driver or trip APIs"],
        ["Delivery exceptions", exceptionTrips.length],
        [],
        ["Driver", "Driver ID", "Assigned trips", "Completed trips", "On-time deliveries", "Valid deadline records", "On-time rate", "Trip exceptions"],
        ...filteredStats.map((stats) => [driverName(stats.driver), stats.driver.id, stats.assigned, stats.completed, stats.onTimeCount, stats.onTimeEligible, formatPercent(stats.onTimeRate), stats.exceptions]),
        [],
        ["Trip ID", "Driver", "Status", "Created at", "ETA", "Completed at"],
        ...periodTrips.map((trip) => [trip.id, driverByTripName(trip, drivers), trip.status, tripCreatedAt(trip), tripDeadline(trip), tripCompletedAt(trip)]),
      ];
      const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `airship-driver-performance-${localDateString(windowRange.start!)}-to-${localDateString(windowRange.end!)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportMessage("Report exported for the selected period.");
      window.setTimeout(() => setExportMessage(null), 3500);
    } catch {
      setExportMessage("The report could not be exported. Please retry.");
    }
  };

  const setSort = (key: keyof DriverStats) => {
    if (sortKey === key) setSortAscending((current) => !current);
    else { setSortKey(key); setSortAscending(false); }
    setPage(1);
  };

  const onTimeAvailable = validDeliveryRecords.length > 0;
  const efficiencyAvailable = eligibleTrips.length >= 2;
  const periodLabel = windowRange.start && windowRange.end
    ? `${windowRange.start.toLocaleDateString()} – ${windowRange.end.toLocaleDateString()}`
    : "Select valid dates";

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#122038]">
      <GlobalNavbar />
      <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.035)] sm:p-5 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-[#122038] sm:text-2xl">Driver Performance Overview</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
                {refreshing ? "Refreshing" : lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Waiting for data"}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">A focused view of driver productivity, delivery reliability, safety records, and operational efficiency.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="overview-range">Reporting period</label>
            <div className="relative min-w-[176px]">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b80049]" size={15} aria-hidden="true" />
              <select id="overview-range" value={preset} onChange={(event) => { setPreset(event.target.value as DatePreset); setPage(1); }} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">
                {datePresets.map((option) => <option key={option}>{option}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" />
            </div>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)} disabled={refreshing || loading} aria-label="Refresh dashboard data" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-pink-200 hover:text-[#b80049] focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:cursor-wait disabled:opacity-60">
              {refreshing ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}<span className="sm:hidden">Refresh</span>
            </button>
            <button type="button" onClick={exportReport} disabled={!validWindow || loading || periodTrips.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b80049] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#97003d] focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} />Export Report</button>
          </div>
          {preset === "Custom Range" && <div className="flex flex-wrap items-center gap-2 xl:basis-full xl:justify-end">
            <label className="text-[10px] font-semibold text-slate-500" htmlFor="custom-start">From</label><input id="custom-start" type="date" value={customStart} max={customEnd} onChange={(event) => { setCustomStart(event.target.value); setPage(1); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" />
            <label className="text-[10px] font-semibold text-slate-500" htmlFor="custom-end">To</label><input id="custom-end" type="date" value={customEnd} min={customStart} max={localDateString(new Date())} onChange={(event) => { setCustomEnd(event.target.value); setPage(1); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" />
          </div>}
        </header>

        {preset === "Custom Range" && !validWindow && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">Choose a valid start and end date to view this reporting period.</p>}
        {loadError && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"><span><strong className="font-semibold">Dashboard data could not be loaded.</strong> {loadError}</span><button type="button" onClick={() => setRetryKey((value) => value + 1)} className="inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-md border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100 sm:self-auto"><RefreshCw size={13} />Retry</button></div>}
        {incidentIssue && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-900">Trip and driver data are available, but incident activity is unavailable: {incidentIssue}</div>}
        {exportMessage && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800"><Check size={15} />{exportMessage}</div>}

        {loading ? <section aria-label="Loading driver performance data" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[136px] animate-pulse rounded-xl border border-slate-200 bg-white" />)}</section> : <>
          <section aria-label="Performance key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon={Users} label="Total Active Drivers" value={activeDrivers.toLocaleString()} note="Active accounts with trip activity in this period" tone="pink" />
            <KpiCard icon={Truck} label="Total Trips" value={periodTrips.length.toLocaleString()} note="Trip activity dated by completion, otherwise creation" comparison={{ value: percentChange(periodTrips.length, previousTrips.length), label: "vs previous period" }} tone="slate" />
            <KpiCard icon={Check} label="Completed Trips" value={completedTrips.length.toLocaleString()} note="Completed, complete, or delivered status" comparison={{ value: percentChange(completedTrips.length, previousCompleted.length), label: "vs previous period" }} tone="green" />
            <KpiCard icon={Clock3} label="On-Time Delivery Rate" value={formatPercent(onTimeRate)} note={onTimeAvailable ? `${validDeliveryRecords.length} completed trips with a recorded delivery window and actual time` : "Requires a completed trip with route-plan window_end and actual completion time"} comparison={{ value: onTimeRate != null && previousOnTimeRate != null ? onTimeRate - previousOnTimeRate : null, label: "vs previous", unit: " pp" }} tone={onTimeRate == null ? "slate" : onTimeRate >= 95 ? "green" : onTimeRate >= 85 ? "amber" : "red"} limitation={!onTimeAvailable} />
            <KpiCard icon={ShieldCheck} label="Average Driver Safety Score" value="Unavailable" note="No verified driver safety-score field or scoring source is exposed" tone="slate" limitation />
            <KpiCard icon={AlertTriangle} label="Delivery Exceptions" value={exceptionTrips.length.toLocaleString()} note="Trips with delayed, late, exception, or failed status" comparison={{ value: percentChange(exceptionTrips.length, previousExceptions), label: "vs previous period" }} tone={exceptionTrips.length ? "amber" : "green"} inverseComparison />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(290px,0.8fr)]">
            <article className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-sm font-bold text-[#122038]">Delivery Performance Trends</h2><p className="mt-1 text-[11px] text-slate-500">{chartMode === "volume" ? "Completed trips and supported outcomes by actual trip activity date." : "Completed trips divided by eligible, non-cancelled trip statuses."}</p></div>
                <div role="group" aria-label="Trend chart metric" className="inline-flex self-start rounded-lg border border-pink-100 bg-pink-50/70 p-1">
                  <button type="button" aria-pressed={chartMode === "volume"} onClick={() => setChartMode("volume")} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-pink-300 ${chartMode === "volume" ? "bg-white text-[#b80049] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Delivery Volume</button>
                  <button type="button" aria-pressed={chartMode === "efficiency"} onClick={() => setChartMode("efficiency")} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-pink-300 ${chartMode === "efficiency" ? "bg-white text-[#b80049] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Delivery Efficiency</button>
                </div>
              </div>
              <div className="mt-5 h-[280px] min-w-0">
                {(chartMode === "volume" ? periodTrips.length > 0 : efficiencyAvailable) ? <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 2 }}>
                    <CartesianGrid stroke="#e9eef5" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="period" tick={{ fill: "#718096", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#dfe6ef" }} minTickGap={22} />
                    <YAxis allowDecimals={chartMode === "efficiency"} domain={chartMode === "efficiency" ? [0, 100] : [0, "auto"]} tick={{ fill: "#718096", fontSize: 10 }} tickLine={false} axisLine={false} width={38} tickFormatter={(value: number) => chartMode === "efficiency" ? `${value}%` : String(value)} />
                    <Tooltip content={TrendTooltip} />
                    {chartMode === "volume" ? <>
                      <Line type="monotone" dataKey="total" name="Total trips" stroke="#8b9bb0" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="completed" name="Completed" stroke="#b80049" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="onTime" name="On time" stroke="#15803d" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="exceptions" name="Exceptions" stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                    </> : <Line type="monotone" dataKey="efficiencyRate" name="Completion rate" stroke="#b80049" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
                  </LineChart>
                </ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center"><Gauge className="mb-2 text-slate-400" size={22} /><p className="text-xs font-semibold text-slate-700">{chartMode === "efficiency" ? "Not enough eligible trips to show a trend" : "No trip activity in this reporting period"}</p><p className="mt-1 max-w-md text-[10px] leading-4 text-slate-500">{chartMode === "efficiency" ? "At least two records with a supported trip status are required for a meaningful completion-rate trend." : `There are no matching records for ${periodLabel}. Try another date range.`}</p></div>}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
                <div className="flex flex-wrap gap-x-4 gap-y-1">{chartMode === "volume" && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Total trips</span>}<span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#b80049]" />{chartMode === "volume" ? "Completed trips" : "Eligible completion rate"}</span>{chartMode === "volume" && <><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-700" />On-time, valid timestamps</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-600" />Trip status exceptions</span></>}</div>
                <span>{periodLabel}</span>
              </div>
            </article>

            <article className="flex flex-col rounded-xl border border-pink-100 bg-gradient-to-br from-white via-white to-pink-50/60 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#b80049]">Top Performing Driver</p><h2 className="mt-1 text-sm font-bold text-[#122038]">Most reliable eligible driver</h2></div><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-pink-100 bg-pink-50 text-[#b80049]"><Medal size={16} /></span></div>
              {topDriver ? <>
                <div className="mt-6 flex items-center gap-3"><FtmProfileAvatar name={driverName(topDriver.driver)} userId={topDriver.driver.id} src={topDriver.driver.avatar_url ?? topDriver.driver.avatarUrl} className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-200 bg-pink-100 text-sm font-bold text-[#b80049]" /><div className="min-w-0"><p className="truncate text-sm font-bold text-[#122038]">{driverName(topDriver.driver)}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{topDriver.driver.email || `Driver ${topDriver.driver.id}`}</p></div></div>
                <p className="mt-4 rounded-lg border border-pink-100 bg-white/80 px-3 py-2 text-[10px] leading-4 text-slate-500">Ranked by on-time delivery rate from valid completed trips; minimum 3 completed deliveries with valid ETA and actual timestamps. Ties favor more completed trips.</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-lg font-bold text-[#122038]">{topDriver.completed}</p><p className="mt-0.5 text-[10px] text-slate-500">Completed deliveries</p></div><div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3"><p className="text-lg font-bold text-emerald-800">{formatPercent(topDriver.onTimeRate)}</p><p className="mt-0.5 text-[10px] text-slate-500">On-time rate · n={topDriver.onTimeEligible}</p></div></div>
                <button type="button" onClick={() => setSelectedDriverId(topDriver.driver.id)} className="mt-auto inline-flex h-9 items-center justify-center gap-2 pt-4 text-xs font-semibold text-[#b80049] hover:text-[#8f0038] focus:outline-none focus:ring-2 focus:ring-pink-200">View Driver Details <ChevronRight size={14} /></button>
              </> : <div className="flex flex-1 flex-col items-center justify-center py-8 text-center"><Users className="mb-2 text-slate-300" size={24} /><p className="text-xs font-semibold text-slate-700">No eligible driver yet</p><p className="mt-1 max-w-[250px] text-[10px] leading-4 text-slate-500">A driver needs at least 3 completed trips with valid ETA and completion timestamps to be ranked fairly.</p></div>}
            </article>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-sm font-bold text-[#122038]">Driver Performance Breakdown</h2><p className="mt-1 text-[11px] text-slate-500">Period-specific delivery reliability, completion, exceptions, and safety data availability.</p></div><span className="hidden items-center gap-1 text-[10px] text-slate-400 sm:inline-flex"><CircleHelp size={13} /> Only supported records are included</span></div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between"><div><h3 className="text-xs font-bold text-slate-800">On-time vs late deliveries</h3><p className="mt-1 text-[10px] text-slate-500">Completed trips with both ETA and actual time</p></div><Clock3 className="text-[#b80049]" size={16} /></div>{onTimeAvailable ? <div className="mt-4 space-y-3"><div className="flex justify-between text-[10px]"><span className="font-semibold text-emerald-700">On time <strong>{onTimeCount}</strong></span><span className="font-semibold text-amber-700">Late <strong>{validDeliveryRecords.length - onTimeCount}</strong></span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-100"><div className="bg-emerald-600" style={{ width: `${onTimeRate}%` }} /><div className="bg-amber-500" style={{ width: `${100 - (onTimeRate || 0)}%` }} /></div><p className="text-[10px] text-slate-400">{validDeliveryRecords.length} valid records · timestamps are compared to trip eta_at</p></div> : <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] leading-4 text-slate-500">Unavailable for this period. Completed trips require both eta_at and completed_at.</p>}</article>
              <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between"><div><h3 className="text-xs font-bold text-slate-800">Trip completion rate</h3><p className="mt-1 text-[10px] text-slate-500">Completed / eligible non-cancelled trips</p></div><Activity className="text-[#b80049]" size={16} /></div>{completionRate == null ? <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] text-slate-500">No eligible trip statuses are recorded.</p> : <div className="mt-5"><div className="flex items-end justify-between"><p className="text-2xl font-bold text-[#122038]">{completionRate.toFixed(1)}%</p><p className="text-[10px] text-slate-500">{completedTrips.length} / {eligibleTrips.length} trips</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#b80049]" style={{ width: `${completionRate}%` }} /></div><p className="mt-2 text-[10px] text-slate-400">Cancelled, failed, and unknown statuses are excluded.</p></div>}</article>
              <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between"><div><h3 className="text-xs font-bold text-slate-800">Exceptions by trip status</h3><p className="mt-1 text-[10px] text-slate-500">Status-based categories; no exception table available</p></div><AlertTriangle className="text-amber-600" size={16} /></div>{exceptionBreakdown.length ? <div className="mt-4 space-y-2.5">{exceptionBreakdown.map((entry) => <div key={entry.name}><div className="mb-1 flex justify-between text-[10px]"><span className="font-medium text-slate-600">{entry.name}</span><span className="font-bold text-slate-800">{entry.value}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(6, (entry.value / exceptionTrips.length) * 100)}%` }} /></div></div>)}</div> : <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] text-slate-500">No delayed, late, exception, or failed trip statuses recorded.</p>}</article>
              <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between"><div><h3 className="text-xs font-bold text-slate-800">Driver safety scores</h3><p className="mt-1 text-[10px] text-slate-500">Verified score records only</p></div><ShieldCheck className="text-slate-400" size={16} /></div><div className="mt-4 flex min-h-[64px] flex-col justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3"><p className="text-xs font-semibold text-slate-600">Not available</p><p className="mt-1 text-[10px] leading-4 text-slate-500">The current driver/trip APIs expose incidents, but no validated safety score or scoring definition.</p></div><a href="/driver/safety" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#b80049] hover:underline">Open Safety Scores <ChevronRight size={12} /></a></article>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-sm font-bold text-[#122038]">Driver Leaderboard</h2><p className="mt-1 text-[10px] text-slate-500">Drivers with trips in {periodLabel}. On-time rate uses valid completed-trip timestamps only.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="relative block"><span className="sr-only">Search drivers</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input value={driverSearch} onChange={(event) => { setDriverSearch(event.target.value); setPage(1); }} placeholder="Search driver" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100 sm:w-44" /></label>
                <label className="relative block"><span className="sr-only">Filter by driver</span><select value={driverFilterId} onChange={(event) => { setDriverFilterId(event.target.value); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100 sm:w-48"><option value="">All drivers</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverName(driver)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
                <label className="relative block"><span className="sr-only">Filter by trip status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100 sm:w-40"><option value="all">All trip statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr>
                  <th className="px-4 py-3 sm:px-5">Driver</th>
                  {[{ key: "assigned", text: "Assigned Trips" }, { key: "completed", text: "Completed" }, { key: "onTimeRate", text: "On-Time Rate" }, { key: "exceptions", text: "Exceptions" }].map((column) => <th key={column.key} className="px-3 py-3"><button type="button" onClick={() => setSort(column.key as keyof DriverStats)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#b80049] focus:outline-none focus:ring-2 focus:ring-pink-200">{column.text}{sortKey === column.key && (sortAscending ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th>)}
                  <th className="px-3 py-3">Safety Score</th><th className="px-4 py-3 text-right sm:px-5">Details</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {visibleStats.map((stats) => <tr key={stats.driver.id} tabIndex={0} onClick={() => setSelectedDriverId(stats.driver.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedDriverId(stats.driver.id); }} className="cursor-pointer transition-colors hover:bg-pink-50/40 focus:bg-pink-50/50 focus:outline-none">
                    <td className="px-4 py-3 sm:px-5"><div className="flex items-center gap-2.5"><FtmProfileAvatar name={driverName(stats.driver)} userId={stats.driver.id} src={stats.driver.avatar_url ?? stats.driver.avatarUrl} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600" /><span><span className="block max-w-[170px] truncate font-semibold text-slate-800">{driverName(stats.driver)}</span><span className="mt-0.5 block font-mono text-[9px] text-slate-400">{stats.driver.id}</span></span></div></td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{stats.assigned}</td><td className="px-3 py-3 font-semibold text-slate-700">{stats.completed}</td>
                    <td className="px-3 py-3">{stats.onTimeRate == null ? <span className="text-slate-400" title="Requires valid ETA and completion timestamps">Unavailable</span> : <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${stats.onTimeRate >= 95 ? "bg-emerald-50 text-emerald-800" : stats.onTimeRate >= 85 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>{stats.onTimeRate.toFixed(1)}% <span className="font-normal opacity-75">n={stats.onTimeEligible}</span></span>}</td>
                    <td className="px-3 py-3 text-slate-700">{stats.exceptions}</td><td className="px-3 py-3 text-slate-400">Not recorded</td><td className="px-4 py-3 text-right sm:px-5"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedDriverId(stats.driver.id); }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#b80049] hover:bg-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-200">View</button></td>
                  </tr>)}
                  {!visibleStats.length && <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="text-xs font-semibold text-slate-700">No driver records match these filters</p><p className="mt-1 text-[10px] text-slate-500">Try another search, status, driver, or reporting period.</p></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>{filteredStats.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredStats.length)} of ${filteredStats.length} drivers` : "0 drivers"} · Current period: {periodLabel}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button><span>Page {Math.min(page, pageCount)} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button></div></div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
            <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-[#122038]">Recent Operational Activity</h2><p className="mt-1 text-[10px] text-slate-500">Actual completion, trip exception, and recorded safety incident events.</p></div><Activity className="text-[#b80049]" size={17} /></div>{activity.length ? <ol className="mt-4 divide-y divide-slate-100">{activity.map((item) => {
              const activityIcon = item.kind === "completed" ? <Check size={14} /> : item.kind === "incident" ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />;
              const activityTone = item.kind === "completed" ? "bg-emerald-50 text-emerald-700" : item.kind === "incident" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
              return <li key={item.id} className="flex gap-3 py-3 first:pt-1"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${activityTone}`}>{activityIcon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[11px] font-semibold text-slate-800">{item.title}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{item.status}</span></div><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.detail}</p></div><time className="shrink-0 text-right text-[9px] text-slate-400">{formatDateTime(item.time)}</time></li>;
            })}</ol> : <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><p className="text-xs font-semibold text-slate-700">No operational activity recorded</p><p className="mt-1 text-[10px] text-slate-500">No matching trip completions, exceptions, or safety incidents were found for this period.</p></div>}</article>
            <article className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div><h2 className="text-sm font-bold text-[#122038]">Driver Performance</h2><p className="mt-1 text-[10px] text-slate-500">Open the existing driver performance views.</p></div><nav aria-label="Driver performance pages" className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">{[
              { href: "/driver/performance", label: "Performance", detail: "Driver performance roster", icon: Gauge },
              { href: "/driver/safety", label: "Safety Scores", detail: "Safety and incident records", icon: ShieldCheck },
              { href: "/driver/leaderboard", label: "Leaderboard", detail: "Compare driver rankings", icon: Medal },
            ].map(({ href, label, detail, icon: Icon }) => <a key={href} href={href} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 transition-colors hover:border-pink-200 hover:bg-pink-50/50 focus:outline-none focus:ring-2 focus:ring-pink-200"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-pink-100 bg-pink-50 text-[#b80049]"><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-slate-800">{label}</span><span className="mt-0.5 block truncate text-[9px] text-slate-500">{detail}</span></span><ChevronRight size={14} className="text-slate-400" /></a>)}</nav><p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] leading-4 text-slate-500">Period: {periodLabel}. Metrics in this overview use the selected dates and current permission-scoped API records.</p></article>
          </section>
        </>}
      </main>
      <GlobalFooter />

      {detailStats && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDriverId(""); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="driver-detail-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-xl">
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><FtmProfileAvatar name={driverName(detailStats.driver)} userId={detailStats.driver.id} src={detailStats.driver.avatar_url ?? detailStats.driver.avatarUrl} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-200 bg-pink-100 text-xs font-bold text-[#b80049]" /><div className="min-w-0"><h2 id="driver-detail-title" className="truncate text-sm font-bold text-[#122038]">{driverName(detailStats.driver)}</h2><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{detailStats.driver.id}</p></div></div><button type="button" onClick={() => setSelectedDriverId("")} aria-label="Close driver details" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-200"><X size={17} /></button></div>
          <p className="mt-4 text-[10px] text-slate-500">Performance summary · {periodLabel}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">Assigned trips</dt><dd className="mt-1 text-lg font-bold text-slate-800">{detailStats.assigned}</dd></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">Completed trips</dt><dd className="mt-1 text-lg font-bold text-slate-800">{detailStats.completed}</dd></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">On-time rate</dt><dd className="mt-1 text-lg font-bold text-slate-800">{formatPercent(detailStats.onTimeRate)}</dd><dd className="text-[9px] text-slate-400">{detailStats.onTimeEligible} valid deliveries</dd></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] text-slate-500">Trip exceptions</dt><dd className="mt-1 text-lg font-bold text-slate-800">{detailStats.exceptions}</dd></div></dl>
          <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[10px] leading-4 text-amber-900">Safety score is unavailable because no validated score field or scoring definition is exposed in the current data source.</p>
          <div className="mt-4 flex justify-end"><a href="/driver/performance" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#b80049] px-3.5 text-[11px] font-semibold text-white hover:bg-[#97003d] focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2">Open performance roster <ChevronRight size={14} /></a></div>
        </section>
      </div>}
    </div>
  );
}

function driverByTripName(trip: TripRecord, drivers: DriverRecord[]) {
  const driver = drivers.find((record) => String(record.id) === tripDriverId(trip));
  return driver ? driverName(driver) : trip.driver_name || trip.driverName || "Unassigned";
}