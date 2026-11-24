"use client";

import { useEffect, useRef, useState } from "react";
import {
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
  ExternalLink,
  Gauge,
  LoaderCircle,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FtmProfileAvatar from "../../../components/global/FtmProfileAvatar";
import GlobalFooter from "../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../components/global/GlobalNavbar";
import { getAlerts, getDrivers, getTrips } from "../../../lib/api";

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

type RoutePlan = {
  routeDetails?: { schedule?: { window_end?: string | null } } | null;
  route_details?: { schedule?: { window_end?: string | null } } | null;
};

type Trip = {
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
  actual_departure?: string | null;
  actualDeparture?: string | null;
  started_at?: string | null;
  startedAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  actual_arrival?: string | null;
  actualArrival?: string | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  eta_at?: string | null;
  routePlan?: RoutePlan | null;
  route_plan?: RoutePlan | null;
  proof_of_delivery?: { delivered_at?: string | null } | null;
  from_location?: string | null;
  fromLocation?: string | null;
  to_location?: string | null;
  toLocation?: string | null;
  exception_type?: string | null;
  exceptionType?: string | null;
};

type SafetyAlert = {
  source_type?: string | null;
  source_id?: string | null;
  id?: string | null;
  driver_id?: string | null;
  severity?: string | null;
  status?: string | null;
  alert_type?: string | null;
  title?: string | null;
  created_at?: string | null;
  metadata?: { reported_at?: string | null } | null;
};

type Period = "Today" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range";
type Ranking = "completed" | "onTime" | "completion" | "duration" | "safety";
type Category = "all" | "ranked" | "unranked";
type DriverMetric = {
  driver: Driver;
  assigned: number;
  completed: number;
  completionRate: number | null;
  completedLinked: number;
  onTimeCount: number;
  onTimeRecords: number;
  onTimeRate: number | null;
  durations: number[];
  averageDuration: number | null;
  exceptions: number;
  highSeverity: number;
  lastActivity: Date | null;
  rankingValue: number | null;
  rankingCount: number;
};

const periodOptions: Period[] = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "Custom Range"];
const tripStatuses = new Set([
  "pending", "scheduled", "assigned", "accepted", "in progress", "in transit", "dispatched", "picked up",
  "out for delivery", "delayed", "late", "exception", "completed", "complete", "delivered",
]);
const rankingOptions: Array<{ value: Ranking; label: string; available: boolean }> = [
  { value: "completed", label: "Completed Deliveries", available: true },
  { value: "onTime", label: "On-Time Rate", available: true },
  { value: "completion", label: "Trip Completion Rate", available: true },
  { value: "duration", label: "Average Delivery Duration", available: true },
  { value: "safety", label: "Safety Score (unavailable)", available: false },
];

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
}

function makePeriod(period: Period, startDate: string, endDate: string) {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (period === "Last 7 Days") start.setDate(start.getDate() - 6);
  else if (period === "Last 30 Days") start.setDate(start.getDate() - 29);
  else if (period === "This Month") start.setDate(1);
  else if (period === "Custom Range") return { start: localDate(startDate), end: localDate(endDate, true) };
  return { start, end };
}

function normalizedStatus(trip: Trip) {
  return String(trip.status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function isCompleted(trip: Trip) {
  return ["completed", "complete", "delivered"].includes(normalizedStatus(trip));
}

function isCancelled(trip: Trip) {
  return /cancel|void|deleted/.test(normalizedStatus(trip));
}

function isEligibleTrip(trip: Trip) {
  return tripStatuses.has(normalizedStatus(trip)) && !isCancelled(trip);
}

function driverIdOf(trip: Trip) {
  return String(trip.driver_id ?? trip.driverId ?? "");
}

function tripStartedAt(trip: Trip) {
  return trip.actual_departure ?? trip.actualDeparture ?? trip.started_at ?? trip.startedAt ?? null;
}

function tripCompletedAt(trip: Trip) {
  return trip.completed_at ?? trip.completedAt ?? trip.actual_arrival ?? trip.actualArrival
    ?? trip.proof_of_delivery?.delivered_at ?? trip.delivered_at ?? trip.deliveredAt ?? null;
}

function scheduledWindowEnd(trip: Trip) {
  const plan = trip.routePlan ?? trip.route_plan;
  return plan?.routeDetails?.schedule?.window_end ?? plan?.route_details?.schedule?.window_end ?? null;
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function activityDate(trip: Trip) {
  return parseTime(isCompleted(trip) ? tripCompletedAt(trip) : trip.created_at ?? trip.createdAt)
    ?? parseTime(trip.created_at ?? trip.createdAt);
}

function onTime(trip: Trip) {
  if (!isCompleted(trip)) return null;
  const deadline = parseTime(scheduledWindowEnd(trip));
  const actual = parseTime(tripCompletedAt(trip));
  return deadline && actual ? actual.getTime() <= deadline.getTime() : null;
}

function duration(trip: Trip) {
  if (!isCompleted(trip)) return null;
  const start = parseTime(tripStartedAt(trip));
  const end = parseTime(tripCompletedAt(trip));
  return start && end && end >= start ? (end.getTime() - start.getTime()) / 60000 : null;
}

function hasException(trip: Trip) {
  if (isCancelled(trip)) return false;
  return Boolean(trip.exception_type || trip.exceptionType) || /late|delay|exception|fail/.test(normalizedStatus(trip));
}

function inPeriod(date: Date | null, start: Date | null, end: Date | null) {
  return Boolean(date && start && end && date >= start && date <= end);
}

function periodIncludesReport(alert: SafetyAlert, start: Date | null, end: Date | null) {
  return inPeriod(parseTime(alert.metadata?.reported_at ?? alert.created_at), start, end);
}

function severityLabel(value: string | null | undefined) {
  return String(value || "Not recorded").toUpperCase();
}

function nameOf(driver: Driver) {
  return driver.full_name || driver.fullName || driver.name || driver.email || "Unnamed driver";
}

function formatPercent(value: number | null) {
  return value == null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function formatDuration(value: number | null) {
  if (value == null) return "Unavailable";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatDateTime(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : parseTime(value);
  return date ? date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}

function driverMetrics(driver: Driver, trips: Trip[], alerts: SafetyAlert[]): DriverMetric {
  const assignedTrips = trips.filter((trip) => driverIdOf(trip) === String(driver.id));
  const eligible = assignedTrips.filter(isEligibleTrip);
  const completed = assignedTrips.filter(isCompleted);
  const linkedCompleted = completed.filter((trip) => Boolean(driverIdOf(trip)));
  const timing = completed.map(onTime).filter((value): value is boolean => value !== null);
  const durations = completed.map(duration).filter((value): value is number => value !== null);
  const uniqueIncidents = new Map<string, SafetyAlert>();
  alerts.filter((alert) => String(alert.driver_id || "") === String(driver.id)).forEach((alert) => {
    uniqueIncidents.set(String(alert.source_id || alert.id), alert);
  });
  const times = assignedTrips.map((trip) => parseTime(trip.updated_at ?? trip.updatedAt ?? tripCompletedAt(trip) ?? trip.created_at ?? trip.createdAt)).filter((date): date is Date => date !== null);
  return {
    driver,
    assigned: eligible.length,
    completed: completed.length,
    completionRate: eligible.length ? linkedCompleted.length / eligible.length * 100 : null,
    completedLinked: linkedCompleted.length,
    onTimeCount: timing.filter(Boolean).length,
    onTimeRecords: timing.length,
    onTimeRate: timing.length ? timing.filter(Boolean).length / timing.length * 100 : null,
    durations,
    averageDuration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    exceptions: assignedTrips.filter(hasException).length,
    highSeverity: [...uniqueIncidents.values()].filter((alert) => ["HIGH", "CRITICAL"].includes(String(alert.severity || "").toUpperCase())).length,
    lastActivity: times.length ? new Date(Math.max(...times.map((date) => date.getTime()))) : null,
    rankingValue: null,
    rankingCount: 0,
  };
}

function metricFor(record: DriverMetric, ranking: Ranking) {
  if (ranking === "completed") return record.completed;
  if (ranking === "onTime") return record.onTimeRate;
  if (ranking === "completion") return record.completionRate;
  if (ranking === "duration") return record.averageDuration;
  return null;
}

function aggregateMetric(trips: Trip[], ranking: Ranking) {
  const linked = trips.filter((trip) => Boolean(driverIdOf(trip)));
  const completed = linked.filter(isCompleted);
  if (ranking === "completed") return { value: completed.length, count: completed.length };
  if (ranking === "onTime") {
    const valid = completed.map(onTime).filter((value): value is boolean => value !== null);
    return { value: valid.length ? valid.filter(Boolean).length / valid.length * 100 : null, count: valid.length };
  }
  if (ranking === "completion") {
    const eligible = linked.filter(isEligibleTrip);
    return { value: eligible.length ? completed.length / eligible.length * 100 : null, count: eligible.length };
  }
  if (ranking === "duration") {
    const valid = completed.map(duration).filter((value): value is number => value !== null);
    return { value: valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null, count: valid.length };
  }
  return { value: null, count: 0 };
}

function sampleCount(record: DriverMetric, ranking: Ranking) {
  if (ranking === "completed") return record.completed;
  if (ranking === "onTime") return record.onTimeRecords;
  if (ranking === "completion") return record.assigned;
  if (ranking === "duration") return record.durations.length;
  return 0;
}

function metricName(ranking: Ranking) {
  return rankingOptions.find((option) => option.value === ranking)?.label ?? "Selected metric";
}

function metricText(record: DriverMetric, ranking: Ranking) {
  const value = metricFor(record, ranking);
  if (ranking === "onTime" || ranking === "completion") return formatPercent(value);
  if (ranking === "duration") return formatDuration(value);
  return value == null ? "Unavailable" : `${value} trips`;
}

function isEligibleForRanking(record: DriverMetric, ranking: Ranking) {
  if (!rankingOptions.find((option) => option.value === ranking)?.available) return false;
  const value = metricFor(record, ranking);
  const sample = sampleCount(record, ranking);
  const minimumSample = ranking === "completed" ? 1 : ranking === "onTime" || ranking === "completion" || ranking === "duration" ? 3 : Infinity;
  return value != null && Number.isFinite(value) && sample >= minimumSample;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function getAllPages(fetchPage: (offset: number) => Promise<unknown>) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await fetchPage(offset);
    if (!Array.isArray(page)) break;
    rows.push(...page as Record<string, unknown>[]);
    if (page.length < 200) break;
  }
  return rows;
}

export default function DriverLeaderboardPage() {
  const [period, setPeriod] = useState<Period>("Last 30 Days");
  const [customStart, setCustomStart] = useState(() => localDateString(new Date(Date.now() - 29 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => localDateString(new Date()));
  const [ranking, setRanking] = useState<Ranking>("completed");
  const [category, setCategory] = useState<Category>("all");
  const [tripStatus, setTripStatus] = useState("all");
  const [driverSearch, setDriverSearch] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadedRef = useRef(false);
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonSearch, setComparisonSearch] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [page, setPage] = useState(1);
  const [tableSort, setTableSort] = useState<keyof DriverMetric | "rank">("rank");
  const [ascending, setAscending] = useState(false);
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const requestId = ++requestRef.current;
    let active = true;
    if (loadedRef.current) setRefreshing(true);
    else setLoading(true);
    const load = async () => {
      try {
        const [driversResult, tripResult, alertResult] = await Promise.all([
          getDrivers(),
          getTrips({ light: true, all: true, performance: true }),
          getAllPages((offset) => getAlerts({ category: "SAFETY", limit: 200, offset })),
        ]);
        if (!active || requestId !== requestRef.current) return;
        const driverList = Array.isArray(driversResult) ? driversResult as Driver[] : [];
        const tripById = new Map<string, Trip>();
        (Array.isArray(tripResult) ? tripResult : []).forEach((trip: Trip, index: number) => {
          const id = String(trip.id ?? `missing-trip-id-${index}`);
          if (!tripById.has(id)) tripById.set(id, trip);
        });
        const driverIds = new Set(driverList.map((driver) => String(driver.id)));
        const uniqueAlerts = new Map<string, SafetyAlert>();
        alertResult.filter((alert) => String(alert.source_type || "").toUpperCase() === "INCIDENT_REPORT").forEach((record) => {
          const id = String(record.source_id || record.id || "");
          if (!id) return;
          const linkedDriverId = String(record.driver_id || "");
          const linkedTrip = record.trip_id ? tripById.get(String(record.trip_id)) : null;
          const resolvedDriverId = driverIds.has(linkedDriverId) ? linkedDriverId : String(linkedTrip?.driver_id || linkedTrip?.driverId || "");
          if (!resolvedDriverId || !driverIds.has(resolvedDriverId)) return;
          uniqueAlerts.set(id, { ...record, driver_id: resolvedDriverId } as SafetyAlert);
        });
        setDrivers(driverList);
        setTrips([...tripById.values()]);
        setSafetyAlerts([...uniqueAlerts.values()]);
        setLastUpdated(new Date());
        setError(null);
        loadedRef.current = true;
      } catch (reason) {
        if (active && requestId === requestRef.current) setError(reason instanceof Error ? reason.message : "Unable to load leaderboard data.");
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

  const datePeriod = makePeriod(period, customStart, customEnd);
  const validPeriod = Boolean(datePeriod.start && datePeriod.end && datePeriod.start <= datePeriod.end);
  const query = driverSearch.trim().toLowerCase();
  const matchedDriverIds = new Set(drivers.filter((driver) => !query || `${nameOf(driver)} ${driver.id}`.toLowerCase().includes(query)).map((driver) => String(driver.id)));
  const periodTrips = validPeriod ? trips.filter((trip) => inPeriod(activityDate(trip), datePeriod.start, datePeriod.end)) : [];
  const filteredTrips = periodTrips.filter((trip) => (tripStatus === "all" || String(trip.status || "Unknown") === tripStatus)
    && matchedDriverIds.has(driverIdOf(trip)));
  const filteredAlerts = safetyAlerts.filter((alert) => periodIncludesReport(alert, datePeriod.start, datePeriod.end));
  const statusOptions = [...new Set(periodTrips.map((trip) => String(trip.status || "Unknown")))].sort((a, b) => a.localeCompare(b));
  const rankedAll = drivers.filter((driver) => matchedDriverIds.has(String(driver.id))).map((driver) => {
    const metric = driverMetrics(driver, filteredTrips, filteredAlerts);
    return { ...metric, rankingCount: sampleCount(metric, ranking) };
  });
  const validRanked = rankedAll.filter((record) => isEligibleForRanking(record, ranking));
  const unranked = rankedAll.filter((record) => !isEligibleForRanking(record, ranking));
  const compareValues = (record: DriverMetric) => metricFor(record, ranking);
  const ranked = validRanked.sort((a, b) => {
    const aValue = compareValues(a) as number;
    const bValue = compareValues(b) as number;
    const reverse = ranking === "duration";
    const difference = reverse ? aValue - bValue : bValue - aValue;
    return difference || b.completed - a.completed || nameOf(a.driver).localeCompare(nameOf(b.driver));
  }).map((record, index) => ({ ...record, rank: index + 1 }));
  const matchedDrivers = ranked;
  const categoryRanked = matchedDrivers.filter((record) => category === "all" || category === "ranked");
  const categoryUnranked = unranked.filter((record) => category === "all" || category === "unranked");
  const topThree = categoryRanked.slice(0, 3);
  const eligibleDriverCount = validRanked.length;
  const assignedDriverMetrics = rankedAll.map((record) => record).filter((record) => record.assigned > 0);
  const averageCompleted = assignedDriverMetrics.length ? assignedDriverMetrics.reduce((sum, record) => sum + record.completed, 0) / assignedDriverMetrics.length : null;
  const validOnTimeRows = filteredTrips.filter((trip) => isCompleted(trip) && onTime(trip) != null);
  const fleetOnTime = validOnTimeRows.length ? validOnTimeRows.filter((trip) => onTime(trip) === true).length / validOnTimeRows.length * 100 : null;

  const selectedComparison = comparisonIds.map((id) => rankedAll.find((record) => record.driver.id === id)).filter((record): record is DriverMetric => Boolean(record));
  const comparisonOptions = drivers.filter((driver) => matchedDriverIds.has(String(driver.id)) && (!comparisonSearch.trim() || `${nameOf(driver)} ${driver.id}`.toLowerCase().includes(comparisonSearch.trim().toLowerCase())));

  const durationMs = datePeriod.start && datePeriod.end ? datePeriod.end.getTime() - datePeriod.start.getTime() + 1 : 0;
  const previousEnd = datePeriod.start ? new Date(datePeriod.start.getTime() - 1) : null;
  const previousStart = previousEnd && durationMs ? new Date(previousEnd.getTime() - durationMs + 1) : null;
  const previousTrips = previousStart && previousEnd ? trips.filter((trip) => inPeriod(activityDate(trip), previousStart, previousEnd)
    && (tripStatus === "all" || String(trip.status || "Unknown") === tripStatus)
    && matchedDriverIds.has(driverIdOf(trip))) : [];
  const previousCompleted = previousTrips.filter(isCompleted);
  const previousCompletedCount = previousCompleted.length;
  const previousOnTimeRecords = previousCompleted.map(onTime).filter((value): value is boolean => value !== null);
  const previousOnTimeRate = previousOnTimeRecords.length ? previousOnTimeRecords.filter(Boolean).length / previousOnTimeRecords.length * 100 : null;
  const previousDriverMetrics = drivers.filter((driver) => matchedDriverIds.has(String(driver.id))).map((driver) => driverMetrics(driver, previousTrips, safetyAlerts));
  const previousEligibleDrivers = previousDriverMetrics.filter((record) => isEligibleForRanking(record, ranking));
  const previousAssignedDrivers = previousDriverMetrics.filter((record) => record.assigned > 0);
  const previousCompletedAverage = previousAssignedDrivers.length ? previousCompletedCount / previousAssignedDrivers.length : null;
  const change = (current: number, previous: number | null) => previous == null || previous === 0 ? null : ((current - previous) / previous) * 100;
  const periodLabel = datePeriod.start && datePeriod.end ? `${datePeriod.start.toLocaleDateString()} – ${datePeriod.end.toLocaleDateString()}` : "Invalid period";

  const step = durationMs > 180 * 86400000 ? "month" : durationMs > 45 * 86400000 ? "week" : "day";
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  if (validPeriod && datePeriod.start && datePeriod.end) {
    const cursor = new Date(datePeriod.start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= datePeriod.end) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      if (step === "month") end.setMonth(end.getMonth() + 1, 0);
      else if (step === "week") end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (end > datePeriod.end) end.setTime(datePeriod.end.getTime());
      const label = step === "month" ? start.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : step === "week" ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      buckets.push({ start, end, label });
      if (step === "month") cursor.setMonth(cursor.getMonth() + 1, 1);
      else cursor.setDate(cursor.getDate() + (step === "week" ? 7 : 1));
    }
  }
  const trendData = buckets.map((bucket) => {
    const group = filteredTrips.filter((trip) => inPeriod(activityDate(trip), bucket.start, bucket.end));
    const priorStart = new Date(bucket.start.getTime() - durationMs);
    const priorEnd = new Date(bucket.end.getTime() - durationMs);
    const prior = trips.filter((trip) => inPeriod(activityDate(trip), priorStart, priorEnd)
      && (tripStatus === "all" || String(trip.status || "Unknown") === tripStatus)
      && matchedDriverIds.has(driverIdOf(trip)));
    const currentValue = aggregateMetric(group, ranking);
    const previousValue = aggregateMetric(prior, ranking);
    return {
      label: bucket.label,
      periodLabel: `${bucket.start.toLocaleDateString()} – ${bucket.end.toLocaleDateString()}`,
      currentValue: currentValue.value,
      previousValue: previousValue.value,
      completedCount: group.filter(isCompleted).length,
      tripCount: group.length,
      sampleCount: currentValue.count,
    };
  });
  const exportLeaderboard = () => {
    if (!validPeriod) return;
    const rows: unknown[][] = [
      ["Airship Express Driver Performance Leaderboard"],
      ["Period", periodLabel],
      ["Ranking metric", metricName(ranking)],
      ["Ranking method", `Ranked by ${metricName(ranking)} only; no composite score or weighting is defined. Ties break on completed trips, then driver name.`],
      ["Trip eligibility", "Recognized non-cancelled statuses for assigned trips; completed = completed, complete, or delivered."],
      ["On-time definition", "Completed trip with route-plan schedule.window_end and actual completion timestamp."],
      ["Duration definition", "Completed trip with actual departure/start and actual completion timestamp."],
      ["Safety score", "Unavailable: no approved safety score source or formula."],
      [],
      ["Rank", "Driver", "Driver ID", "Assigned trips", "Completed trips", "Completion rate", "On-time rate", "On-time records", "Average duration minutes", "Safety score", "Exceptions"],
      ...categoryRanked.map((record, index) => [index + 1, nameOf(record.driver), record.driver.id, record.assigned, record.completed, record.completionRate, record.onTimeRate, record.onTimeRecords, record.averageDuration, "Unavailable", record.exceptions]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `driver-leaderboard-${localDateString(datePeriod.start!)}-to-${localDateString(datePeriod.end!)}-${ranking}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setShowExportNotice(true);
    setNotice(null);
    window.setTimeout(() => setShowExportNotice(false), 3200);
  };

  const toggleComparison = (id: string) => setComparisonIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : current);
  const resetComparison = () => setComparisonIds([]);
  const showDriver = (driver: Driver) => setSelectedDriver(driver);
  const profileTarget = selectedDriver ? selectedDriver : null;
  const top = topThree;
  const podiumOrder = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const ranks = categoryRanked.map((record, index) => ({ ...record, rank: index + 1 }));
  const unrankedRows = category === "all" || category === "unranked" ? categoryUnranked.map((record) => ({ ...record, rank: null as number | null })) : [];
  const tableRows = category === "unranked" ? unrankedRows : category === "all" ? [...ranks, ...unrankedRows] : ranks;
  const sortedTableRows = tableSort === "rank" ? tableRows : [...tableRows].sort((left, right) => {
    const leftValue = left[tableSort];
    const rightValue = right[tableSort];
    const compare = leftValue instanceof Date && rightValue instanceof Date
      ? leftValue.getTime() - rightValue.getTime()
      : Number(leftValue ?? -1) - Number(rightValue ?? -1);
    return ascending ? compare : -compare;
  });
  const pageCount = Math.max(1, Math.ceil(sortedTableRows.length / pageSize));
  const visibleRanked = sortedTableRows.slice((page - 1) * pageSize, page * pageSize);
  const sortTable = (key: keyof DriverMetric | "rank") => {
    if (tableSort === key) setAscending((value) => !value);
    else { setTableSort(key); setAscending(false); }
    setPage(1);
  };

  return <div className="min-h-screen bg-[#f4f7fb] text-[#122038]"><GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.035)] sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-bold tracking-tight text-[#122038] sm:text-2xl">Driver Performance Leaderboard</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse motion-reduce:animate-none bg-amber-500" : lastUpdated ? "bg-emerald-500" : "bg-slate-400"}`} />{refreshing ? "Refreshing" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Waiting for data"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Compare driver productivity, delivery reliability, and operational efficiency.</p><p className="mt-1 text-[10px] text-slate-400">{periodLabel} · Ranking by {metricName(ranking)} · ties: completed trips, then name</p></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[170px_190px_190px_180px_auto_auto]">
          <label className="relative"><span className="sr-only">Reporting period</span><CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b80049]" size={14} /><select value={period} onChange={(event) => { setPeriod(event.target.value as Period); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">{periodOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Ranking metric</span><select value={ranking} onChange={(event) => { setRanking(event.target.value as Ranking); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">{rankingOptions.map((option) => <option key={option.value} value={option.value} disabled={!option.available}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Trip status filter</span><select value={tripStatus} onChange={(event) => { setTripStatus(event.target.value); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="all">All trip statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Search drivers</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input value={driverSearch} onChange={(event) => { setDriverSearch(event.target.value); setPage(1); }} placeholder="Search driver" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></label>
          <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={loading || refreshing} aria-label="Refresh leaderboard data" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049] disabled:opacity-50">{refreshing ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw size={14} />}<span className="sm:hidden">Refresh</span></button>
          <button type="button" onClick={exportLeaderboard} disabled={loading || !validPeriod || categoryRanked.length === 0} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 text-[11px] font-semibold text-white hover:bg-[#97003d] disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} />Export Leaderboard</button>
        </div>
        {period === "Custom Range" && <div className="flex flex-wrap items-center gap-2 xl:basis-full xl:justify-end"><label htmlFor="leaderboard-start" className="text-[10px] font-semibold text-slate-500">From</label><input id="leaderboard-start" type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /><label htmlFor="leaderboard-end" className="text-[10px] font-semibold text-slate-500">To</label><input id="leaderboard-end" type="date" value={customEnd} min={customStart} max={localDateString(new Date())} onChange={(event) => setCustomEnd(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></div>}
      </header>
      {period === "Custom Range" && !validPeriod && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">Select a valid date range.</p>}
      {error && <div role="alert" className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"><span><strong>Leaderboard data could not be loaded.</strong> {error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100 sm:self-auto"><RefreshCw size={13} />Retry</button></div>}
      {showExportNotice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800"><Check size={14} />Filtered leaderboard exported.</p>}
      {notice && <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700">{notice}</p>}

      <section aria-label="Leaderboard summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{loading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[112px] animate-pulse motion-reduce:animate-none rounded-xl border border-slate-200 bg-white" />) : <>
        <SummaryCard icon={Users} label="Total Eligible Drivers" value={validRanked.length} note={`Rankable by ${metricName(ranking)} with valid records`} comparison={change(validRanked.length, previousEligibleDrivers.length)} tone="pink" />
        <SummaryCard icon={Truck} label="Average Completed Deliveries / Driver" value={averageCompleted == null ? "Unavailable" : averageCompleted.toFixed(1)} note={`${assignedDriverMetrics.length} drivers with assigned-trip records`} comparison={averageCompleted == null ? null : change(averageCompleted, previousCompletedAverage)} tone="green" />
        <SummaryCard icon={Clock3} label="Fleet On-Time Delivery Rate" value={formatPercent(fleetOnTime)} note={validOnTimeRows.length ? `${validOnTimeRows.length} completed trips with valid delivery windows` : "Requires route-plan window_end and actual completion"} comparison={fleetOnTime == null || previousOnTimeRate == null ? null : fleetOnTime - previousOnTimeRate} comparisonUnit=" pp" tone={fleetOnTime == null ? "slate" : fleetOnTime >= 95 ? "green" : fleetOnTime >= 85 ? "amber" : "red"} />
        <SummaryCard icon={CircleHelp} label="Drivers Meeting Performance Targets" value="Unavailable" note="No approved fleet target thresholds are configured" tone="slate" />
      </>}</section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Top Performers</h2><p className="mt-1 text-[10px] text-slate-500">Ranked by {metricName(ranking)} · one valid record minimum · no composite score</p></div><span className="text-[9px] text-slate-400">{periodLabel}</span></div>{topThree.length ? <div className={`grid gap-3 ${topThree.length === 1 ? "max-w-md" : "md:grid-cols-3"}`}>{podiumOrder.map((record) => {
        const position = ranked.findIndex((item) => item.driver.id === record.driver.id) + 1;
        const podiumTone = position === 1 ? "border-amber-200 bg-amber-50/60" : position === 2 ? "border-slate-200 bg-slate-50" : "border-orange-200 bg-orange-50/40";
        const rankIcon = position === 1 ? <Trophy size={16} /> : <Medal size={16} />;
        return <article key={record.driver.id} className={`flex min-h-[168px] flex-col rounded-lg border p-4 ${podiumTone}`}><div className="flex items-start justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-2 py-1 text-[9px] font-bold text-slate-700">{rankIcon} #{position}</span><strong className="text-[11px] text-[#b80049]">{metricText(record, ranking)} <span className="text-[8px] font-normal text-slate-500">n={record.rankingCount}</span></strong></div><div className="mt-3 flex items-center gap-2.5"><FtmProfileAvatar name={nameOf(record.driver)} userId={record.driver.id} src={record.driver.avatar_url ?? record.driver.avatarUrl} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-pink-100 text-[10px] font-bold text-[#b80049]" /><div className="min-w-0"><button type="button" onClick={() => showDriver(record.driver)} className="block max-w-full truncate text-left text-[11px] font-bold text-slate-900 hover:text-[#b80049]">{nameOf(record.driver)}</button><span className="block truncate font-mono text-[8px] text-slate-500">{record.driver.id}</span></div></div><div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[9px]"><span className="text-slate-500">Completed <strong className="ml-1 text-slate-800">{record.completed}</strong></span><span className="text-slate-500">On time <strong className="ml-1 text-slate-800">{formatPercent(record.onTimeRate)}</strong></span><span className="text-slate-500">Completion <strong className="ml-1 text-slate-800">{formatPercent(record.completionRate)}</strong></span><span className="text-slate-500">Safety <strong className="ml-1 text-slate-500">Unavailable</strong></span></div></article>;
      })}</div> : <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><Users className="mx-auto mb-2 text-slate-300" size={22} /><p className="text-[10px] font-semibold text-slate-700">No drivers have enough valid records for this ranking</p><p className="mt-1 text-[9px] text-slate-500">Choose a metric with available records or adjust the period and filters. Empty places are not filled.</p></div>}</section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]"><article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Verified Metric Distribution</h2><p className="mt-1 text-[10px] text-slate-500">Completed deliveries by driver · click a bar to filter this leaderboard.</p></div><span className="text-[9px] text-slate-400">No historical ranking snapshots are available</span></div>{ranked.length ? <div className="mt-3 h-[240px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={ranked.slice(0, 10).map((record) => ({ name: nameOf(record.driver), driverId: record.driver.id, completed: record.completed }))} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}><CartesianGrid stroke="#edf1f6" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#8794a7", fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={100} tick={{ fill: "#536176", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="completed" name="Completed trips" fill="#b80049" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(entry) => {
        const payload: unknown = entry.payload;
        const driverId = typeof payload === "object" && payload !== null ? Reflect.get(payload, "driverId") : null;
        if (typeof driverId === "string") setDriverSearch(driverId);
      }} /></BarChart></ResponsiveContainer></div> : <p className="mt-6 text-center text-[10px] text-slate-500">No eligible records in this period.</p>}</article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#122038]">Metric Notes</h2><p className="mt-1 text-[10px] text-slate-500">Transparent ranking definitions</p></div><CircleHelp size={16} className="text-[#b80049]" /></div><dl className="mt-3 divide-y divide-slate-100 text-[9px]"><div className="py-2"><dt className="font-semibold text-slate-700">Completed deliveries</dt><dd className="mt-0.5 text-slate-500">Completed, complete, or delivered status, matched by driver ID.</dd></div><div className="py-2"><dt className="font-semibold text-slate-700">On-time rate</dt><dd className="mt-0.5 text-slate-500">Completed trips with route-plan schedule.window_end and actual completion; sample count shown.</dd></div><div className="py-2"><dt className="font-semibold text-slate-700">Completion rate</dt><dd className="mt-0.5 text-slate-500">Driver-linked completed trips / recognized, non-cancelled eligible trips.</dd></div><div className="py-2"><dt className="font-semibold text-slate-700">Average duration</dt><dd className="mt-0.5 text-slate-500">Actual start to actual completion, valid records only; shorter durations sort higher.</dd></div><div className="py-2"><dt className="font-semibold text-slate-700">Safety and overall score</dt><dd className="mt-0.5 text-slate-500">Unavailable: no score source, formula, or approved ranking weights exist.</dd></div></dl></article></section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.8fr)]"><article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Driver Standings</h2><p className="mt-1 text-[10px] text-slate-500">Sorted by {metricName(ranking)} · valid sample counts shown for rates/durations</p></div><div className="flex items-center gap-2"><label className="text-[9px] text-slate-500" htmlFor="leaderboard-category">Show</label><select id="leaderboard-category" value={category} onChange={(event) => { setCategory(event.target.value as Category); setPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-[#b80049]"><option value="all">Ranked and unranked</option><option value="ranked">Ranked only</option><option value="unranked">Unranked only</option></select></div></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left"><thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Driver ID</th><th className="px-3 py-3">Assigned</th><th className="px-3 py-3">Completed</th><th className="px-3 py-3">Completion rate</th><th className="px-3 py-3">On-time rate</th><th className="px-3 py-3">Avg duration</th><th className="px-3 py-3">Safety score</th><th className="px-3 py-3">Exceptions</th></tr></thead><tbody className="divide-y divide-slate-100 text-[9px]">{visibleRanked.map((record) => <tr key={record.driver.id} tabIndex={0} onClick={() => showDriver(record.driver)} onKeyDown={(event) => { if (event.key === "Enter") showDriver(record.driver); }} className="cursor-pointer hover:bg-pink-50/40 focus:bg-pink-50/50 focus:outline-none"><td className="px-3 py-3 font-black text-[#b80049]">#{record.rank}</td><td className="px-3 py-3"><span className="flex items-center gap-2"><FtmProfileAvatar name={nameOf(record.driver)} userId={record.driver.id} src={record.driver.avatar_url ?? record.driver.avatarUrl} className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-100 bg-pink-50 text-[8px] font-bold text-[#b80049]" /><strong className="max-w-[130px] truncate text-slate-800">{nameOf(record.driver)}</strong></span></td><td className="px-3 py-3 font-mono text-slate-500">{record.driver.id}</td><td className="px-3 py-3 text-slate-700">{record.assigned}</td><td className="px-3 py-3 font-semibold text-slate-800">{record.completed}</td><td className="px-3 py-3">{formatPercent(record.completionRate)}{record.completionRate != null && <span className="ml-1 text-[8px] text-slate-400">n={record.assigned}</span>}</td><td className="px-3 py-3">{formatPercent(record.onTimeRate)}{record.onTimeRate != null && <span className="ml-1 text-[8px] text-slate-400">n={record.onTimeRecords}</span>}</td><td className="px-3 py-3">{formatDuration(record.averageDuration)}{record.averageDuration != null && <span className="ml-1 text-[8px] text-slate-400">n={record.durations.length}</span>}</td><td className="px-3 py-3 text-slate-400">Not recorded</td><td className="px-3 py-3 text-slate-700">{record.exceptions}</td></tr>)}{category === "unranked" && unranked.filter((record) => !driverSearch.trim() || `${nameOf(record.driver)} ${record.driver.id}`.toLowerCase().includes(driverSearch.trim().toLowerCase())).slice((page - 1) * pageSize, page * pageSize).map((record) => <tr key={record.driver.id} tabIndex={0} onClick={() => showDriver(record.driver)} className="cursor-pointer bg-slate-50/60 hover:bg-slate-100"><td className="px-3 py-3 text-slate-400">Unranked</td><td className="px-3 py-3 font-semibold text-slate-700">{nameOf(record.driver)}</td><td className="px-3 py-3 font-mono text-slate-500">{record.driver.id}</td><td className="px-3 py-3">{record.assigned}</td><td className="px-3 py-3">{record.completed}</td><td className="px-3 py-3 text-slate-500">{formatPercent(record.completionRate)}</td><td className="px-3 py-3 text-slate-500">{formatPercent(record.onTimeRate)}</td><td className="px-3 py-3 text-slate-500">{formatDuration(record.averageDuration)}</td><td className="px-3 py-3 text-slate-400">Not recorded</td><td className="px-3 py-3">{record.exceptions}</td></tr>)}{category === "all" && !visibleRanked.length && !unranked.length && <tr><td colSpan={10} className="px-4 py-9 text-center text-[10px] text-slate-500">{loading ? "Loading driver records…" : error || "No driver records match this period and search."}</td></tr>}</tbody></table></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500"><span>{categoryRanked.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, categoryRanked.length)} of ${categoryRanked.length} ranked drivers` : `${unranked.length} unranked drivers`}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous leaderboard page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronLeft size={13} /></button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next leaderboard page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-40"><ChevronRight size={13} /></button></div></div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#122038]">Driver Comparison</h2><p className="mt-1 text-[10px] text-slate-500">Select two to four drivers for the same date/status cohort.</p></div><div className="flex items-center gap-2"><label className="relative"><span className="sr-only">Search comparison drivers</span><Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={11} /><input value={comparisonSearch} onChange={(event) => setComparisonSearch(event.target.value)} placeholder="Find driver" className="h-8 w-36 rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[9px] outline-none focus:border-[#b80049]" /></label><button type="button" onClick={resetComparison} disabled={!comparisonIds.length} className="h-8 rounded-md border border-slate-200 px-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Reset</button></div></div><div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]"><div className="max-h-[190px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">{comparisonOptions.map((driver) => <label key={driver.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[9px] text-slate-700 hover:bg-white"><input type="checkbox" checked={comparisonIds.includes(driver.id)} disabled={!comparisonIds.includes(driver.id) && comparisonIds.length >= 4} onChange={() => toggleComparison(driver.id)} className="h-3.5 w-3.5 accent-[#b80049]" /><span className="truncate">{nameOf(driver)}</span></label>)}</div>{selectedComparison.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{selectedComparison.map((record) => <article key={record.driver.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-[9px] font-bold text-slate-800">{nameOf(record.driver)}</span><button type="button" aria-label={`Remove ${nameOf(record.driver)} from comparison`} onClick={() => setComparisonIds((ids) => ids.filter((id) => id !== record.driver.id))} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={11} /></button></div><dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 text-[8px]"><div><dt className="text-slate-400">Completed</dt><dd className="font-bold text-slate-700">{record.completed}</dd></div><div><dt className="text-slate-400">On time</dt><dd className="font-bold text-slate-700">{formatPercent(record.onTimeRate)}</dd></div><div><dt className="text-slate-400">Completion</dt><dd className="font-bold text-slate-700">{formatPercent(record.completionRate)}</dd></div><div><dt className="text-slate-400">Avg duration</dt><dd className="font-bold text-slate-700">{formatDuration(record.averageDuration)}</dd></div><div><dt className="text-slate-400">Exceptions</dt><dd className="font-bold text-slate-700">{record.exceptions}</dd></div><div><dt className="text-slate-400">Safety</dt><dd className="font-bold text-slate-500">Unavailable</dd></div></dl></article>)}</div> : <div className="flex min-h-[90px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center"><Users size={18} className="mb-1 text-slate-300" /><p className="text-[9px] font-semibold text-slate-600">Choose up to four drivers to compare</p></div>}</div></article>
    </section>

    {unranked.length > 0 && <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[9px] text-slate-600"><strong className="font-semibold text-slate-700">Unranked drivers:</strong> {unranked.length} drivers lack the minimum valid record for {metricName(ranking)}. Missing data is not treated as zero.</section>}
  </main><GlobalFooter />

  {profileTarget && <DriverRankingDrawer driver={profileTarget} metrics={rankedAll.find((record) => record.driver.id === profileTarget.id)!} rank={ranked.find((record) => record.driver.id === profileTarget.id)?.rank ?? null} ranking={ranking} periodLabel={periodLabel} trips={filteredTrips.filter((trip) => driverIdOf(trip) === profileTarget.id)} alerts={safetyAlerts.filter((alert) => alert.driver_id === profileTarget.id)} onClose={() => setSelectedDriver(null)} />}
  </div>;
}

function SummaryCard({ icon: Icon, label, value, note, tone = "pink", comparison, comparisonUnit = "%" }: { icon: typeof Users; label: string; value: string | number; note: string; tone?: "pink" | "green" | "amber" | "red" | "slate"; comparison?: number | null; comparisonUnit?: string }) {
  const tones = { pink: "border-pink-100 bg-pink-50 text-[#b80049]", green: "border-emerald-100 bg-emerald-50 text-emerald-700", amber: "border-amber-100 bg-amber-50 text-amber-700", red: "border-rose-100 bg-rose-50 text-rose-700", slate: "border-slate-200 bg-slate-100 text-slate-500" };
  return <article className="flex min-h-[112px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between"><p className="text-[10px] font-semibold text-slate-500">{label}</p><span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon size={14} /></span></div><div><p className="text-lg font-bold text-[#122038]">{value}</p><p className="mt-0.5 text-[9px] leading-4 text-slate-400">{comparison != null && comparison !== 0 && <span className={`mr-1 inline-flex items-center gap-0.5 font-semibold ${comparison > 0 ? "text-emerald-700" : "text-rose-700"}`}>{comparison > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}{Math.abs(comparison).toFixed(1)}{comparisonUnit} vs previous period</span>}{note}</p></div></article>;
}

function DriverRankingDrawer({ driver, metrics, rank, ranking, periodLabel, trips, alerts, onClose }: {
  driver: Driver;
  metrics: DriverMetric;
  rank: number | null;
  ranking: Ranking;
  periodLabel: string;
  trips: Trip[];
  alerts: SafetyAlert[];
  onClose: () => void;
}) {
  const eligibleTrips = trips.filter(isEligibleTrip);
  const completed = trips.filter(isCompleted);
  const late = completed.filter((trip) => onTime(trip) === false);
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="driver-ranking-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FtmProfileAvatar name={nameOf(driver)} userId={driver.id} src={driver.avatar_url ?? driver.avatarUrl} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-200 bg-pink-50 text-xs font-bold text-[#b80049]" /><div className="min-w-0"><h2 id="driver-ranking-title" className="truncate text-sm font-bold text-slate-900">{nameOf(driver)}</h2><p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{driver.id} · {periodLabel}</p></div></div><button type="button" onClick={onClose} aria-label="Close driver ranking details" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><p className="rounded-lg bg-slate-50 p-3 text-[8px] text-slate-500">Selected rank<strong className="mt-1 block text-sm text-slate-800">{rank == null ? "Unranked" : `#${rank}`}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[8px] text-slate-500">Ranked by<strong className="mt-1 block text-[10px] text-slate-800">{metricName(ranking)}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[8px] text-slate-500">Completed<strong className="mt-1 block text-sm text-slate-800">{metrics.completed}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[8px] text-slate-500">Valid samples<strong className="mt-1 block text-sm text-slate-800">{metrics.rankingCount}</strong></p></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><p className="rounded-lg border border-slate-100 p-3 text-[8px] text-slate-500">Assigned trips<strong className="mt-1 block text-[10px] text-slate-800">{metrics.assigned}</strong></p><p className="rounded-lg border border-slate-100 p-3 text-[8px] text-slate-500">Completion rate<strong className="mt-1 block text-[10px] text-slate-800">{formatPercent(metrics.completionRate)}</strong></p><p className="rounded-lg border border-slate-100 p-3 text-[8px] text-slate-500">On-time rate<strong className="mt-1 block text-[10px] text-slate-800">{formatPercent(metrics.onTimeRate)}</strong></p><p className="rounded-lg border border-slate-100 p-3 text-[8px] text-slate-500">Average duration<strong className="mt-1 block text-[10px] text-slate-800">{formatDuration(metrics.averageDuration)}</strong></p></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><section className="rounded-lg border border-slate-200 p-3"><h3 className="text-[9px] font-bold text-slate-800">Recent trips</h3><div className="mt-2 max-h-[240px] divide-y divide-slate-100 overflow-y-auto">{trips.slice().sort((a, b) => (activityDate(b)?.getTime() ?? 0) - (activityDate(a)?.getTime() ?? 0)).slice(0, 20).map((trip, index) => <div key={String(trip.id ?? index)} className="flex items-center justify-between gap-2 py-2 text-[8px]"><span className="min-w-0"><strong className="block truncate font-mono text-slate-700">{trip.id || "Trip ID unavailable"}</strong><span className="block truncate text-slate-500">{trip.from_location || trip.fromLocation || "Origin not recorded"} → {trip.to_location || trip.toLocation || "Destination not recorded"} · {trip.status || "Unknown"}</span></span><span className="shrink-0 text-right text-slate-400">{formatDateTime(tripCompletedAt(trip))}</span></div>)}{!trips.length && <p className="py-5 text-center text-[8px] text-slate-500">No linked trips in this period.</p>}</div></section><section className="rounded-lg border border-slate-200 p-3"><h3 className="text-[9px] font-bold text-slate-800">Safety records</h3><p className="mt-1 text-[8px] text-slate-500">{alerts.length} linked incident reports · safety score not available</p><div className="mt-2 max-h-[190px] divide-y divide-slate-100 overflow-y-auto">{alerts.slice().sort((a, b) => (parseTime(b.created_at)?.getTime() ?? 0) - (parseTime(a.created_at)?.getTime() ?? 0)).map((alert) => <div key={String(alert.source_id || alert.id)} className="py-2"><p className="text-[8px] font-semibold text-slate-700">{alert.title || alert.alert_type || "Incident report"} · {severityLabel(alert.severity)}</p><p className="mt-0.5 text-[8px] text-slate-400">{alert.status || "Case status unavailable"} · reported {formatDateTime(alert.metadata?.reported_at || alert.created_at)}</p></div>)}{!alerts.length && <p className="py-5 text-center text-[8px] text-slate-500">No linked incident reports loaded.</p>}</div></section></div><div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[8px] leading-4 text-amber-900">Rank explanation: {rank == null ? "No valid sample exists for the selected ranking metric." : `Ranked #${rank} by ${metricName(ranking)} for the selected period. Ties favor more completed trips, then driver name.`} Safety score and target status are unavailable because no approved source or formula exists. Eligible denominator: {eligibleTrips.length} recognized non-cancelled assigned trips.</div><div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3"><a href="/driver/performance" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049]">Performance details <ExternalLink size={11} /></a><a href="/driver/safety" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049]">Safety records <ExternalLink size={11} /></a><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-3 py-2 text-[9px] font-semibold text-white hover:bg-slate-700">Close</button></div></section></div>;
}