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
  Clock3,
  Download,
  ExternalLink,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Search,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
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
import { getAlerts, getDrivers, getTrips } from "../../../lib/api";
import {
  getDriverLinkedTripCohort,
  getTripDeliveryDeadline,
  isCompletedPerformanceStatus,
  isEligiblePerformanceStatus,
  normalizePerformanceStatus,
} from "../../../lib/driverPerformanceMetrics";

type Driver = {
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

type RoutePlan = {
  routeDetails?: { schedule?: { depart_at?: string | null; window_end?: string | null; expected_arrival?: string | null } } | null;
  route_details?: { schedule?: { depart_at?: string | null; window_end?: string | null; expected_arrival?: string | null } } | null;
  planned_delivery_date?: string | null;
  plannedDeliveryDate?: string | null;
};

type Trip = {
  id?: string | null;
  driver_id?: string | null;
  driverId?: string | null;
  driver_name?: string | null;
  driverName?: string | null;
  status?: string | null;
  from_location?: string | null;
  fromLocation?: string | null;
  to_location?: string | null;
  toLocation?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  started_at?: string | null;
  startedAt?: string | null;
  actual_departure?: string | null;
  actualDeparture?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  actual_arrival?: string | null;
  actualArrival?: string | null;
  delivered_at?: string | null;
  deliveredAt?: string | null;
  eta_at?: string | null;
  routePlan?: RoutePlan | null;
  route_plan?: RoutePlan | null;
  exception_type?: string | null;
  exceptionType?: string | null;
  exception_reason?: string | null;
  exceptionReason?: string | null;
  proof_of_delivery?: { delivered_at?: string | null } | null;
};

type Incident = {
  id?: string | number;
  driverId?: string | null;
  tripId?: string | null;
  incidentType?: string | null;
  description?: string | null;
  reportedAt?: string | null;
};

type Alert = {
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

type Preset = "Today" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range";
type Metric = "completed" | "onTimeRate" | "completionRate" | "averageDuration";
type DriverMetrics = {
  driver: Driver;
  assigned: number;
  completed: number;
  eligible: number;
  completionRate: number | null;
  onTimeCount: number;
  onTimeEligible: number;
  onTimeRate: number | null;
  durations: number[];
  averageDuration: number | null;
  exceptions: number;
  lastActivity: Date | null;
};

const presets: Preset[] = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "Custom Range"];
const chartMetrics: Array<{ key: Metric; label: string }> = [
  { key: "completed", label: "Completed Trips" },
  { key: "onTimeRate", label: "On-Time Delivery Rate" },
  { key: "completionRate", label: "Completion Rate" },
  { key: "averageDuration", label: "Average Delivery Duration" },
];
function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
}

function makeWindow(preset: Preset, startDate: string, endDate: string) {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (preset === "Today") return { start, end };
  if (preset === "Last 7 Days") start.setDate(start.getDate() - 6);
  if (preset === "Last 30 Days") start.setDate(start.getDate() - 29);
  if (preset === "This Month") start.setDate(1);
  if (preset === "Custom Range") return { start: parseLocalDate(startDate), end: parseLocalDate(endDate, true) };
  return { start, end };
}

function statusOf(trip: Trip) {
  return normalizePerformanceStatus(trip.status);
}

function isCompleted(trip: Trip) {
  return isCompletedPerformanceStatus(trip.status);
}

function isCancelled(trip: Trip) {
  return /cancel|void|deleted/.test(statusOf(trip));
}

function isEligible(trip: Trip) {
  return isEligiblePerformanceStatus(trip.status);
}

function driverIdOf(trip: Trip) {
  return String(trip.driver_id ?? trip.driverId ?? "");
}

function tripStart(trip: Trip) {
  return trip.actual_departure ?? trip.actualDeparture ?? trip.started_at ?? trip.startedAt ?? null;
}

function tripEnd(trip: Trip) {
  return trip.completed_at ?? trip.completedAt ?? trip.actual_arrival ?? trip.actualArrival
    ?? trip.proof_of_delivery?.delivered_at ?? trip.delivered_at ?? trip.deliveredAt ?? null;
}

function tripWindowEnd(trip: Trip) {
  return getTripDeliveryDeadline(trip);
}

function scheduledDeparture(trip: Trip) {
  const plan = trip.routePlan ?? trip.route_plan;
  return plan?.routeDetails?.schedule?.depart_at
    ?? plan?.route_details?.schedule?.depart_at
    ?? null;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(trip: Trip) {
  return parseTimestamp(isCompleted(trip) ? tripEnd(trip) : trip.created_at ?? trip.createdAt)
    ?? parseTimestamp(trip.created_at ?? trip.createdAt);
}

function onTimeValue(trip: Trip) {
  if (!isCompleted(trip)) return null;
  const deadline = parseTimestamp(tripWindowEnd(trip));
  const actual = parseTimestamp(tripEnd(trip));
  return deadline && actual ? actual.getTime() <= deadline.getTime() : null;
}

function durationMinutes(trip: Trip) {
  if (!isCompleted(trip)) return null;
  const start = parseTimestamp(tripStart(trip));
  const end = parseTimestamp(tripEnd(trip));
  if (!start || !end || end < start) return null;
  return (end.getTime() - start.getTime()) / 60000;
}

function exceptionType(trip: Trip) {
  if (isCancelled(trip)) return null;
  const status = statusOf(trip);
  const explicit = trip.exception_type ?? trip.exceptionType;
  if (explicit) return String(explicit);
  if (/delay|late/.test(status)) return "Delayed";
  if (/exception/.test(status)) return "Exception";
  if (/fail/.test(status)) return "Failed";
  return null;
}

function inWindow(value: Date | null, start: Date | null, end: Date | null) {
  return Boolean(value && start && end && value >= start && value <= end);
}

function nameOf(driver: Driver) {
  return driver.full_name || driver.fullName || driver.name || driver.email || "Unnamed driver";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function metricsForDriver(driver: Driver, trips: Trip[], cohortTrips: Trip[] = trips): DriverMetrics {
  const driverTrips = trips.filter((trip) => driverIdOf(trip) === String(driver.id));
  const assignedTrips = cohortTrips.filter((trip) => driverIdOf(trip) === String(driver.id) && isEligible(trip));
  const completedAssignedTrips = assignedTrips.filter(isCompleted);
  const completedTrips = driverTrips.filter(isCompleted);
  const timely = completedTrips.map(onTimeValue).filter((value): value is boolean => value !== null);
  const durations = completedTrips.map(durationMinutes).filter((value): value is number => value !== null);
  const activityDates = driverTrips.map((trip) => parseTimestamp(trip.updated_at ?? trip.updatedAt ?? tripEnd(trip) ?? trip.created_at ?? trip.createdAt)).filter((value): value is Date => value !== null);
  const completed = completedAssignedTrips.length;
  return {
    driver,
    assigned: assignedTrips.length,
    completed,
    eligible: assignedTrips.length,
    completionRate: assignedTrips.length ? (completed / assignedTrips.length) * 100 : null,
    onTimeCount: timely.filter(Boolean).length,
    onTimeEligible: timely.length,
    onTimeRate: timely.length ? (timely.filter(Boolean).length / timely.length) * 100 : null,
    durations,
    averageDuration: average(durations),
    exceptions: driverTrips.filter((trip) => exceptionType(trip) !== null).length,
    lastActivity: activityDates.length ? new Date(Math.max(...activityDates.map((date) => date.getTime()))) : null,
  };
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
  const date = value instanceof Date ? value : parseTimestamp(value);
  return date ? date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function tripDriverName(trip: Trip, drivers: Driver[]) {
  const driver = drivers.find((entry) => String(entry.id) === driverIdOf(trip));
  return driver ? nameOf(driver) : trip.driver_name || trip.driverName || "Unassigned";
}

function metricLabel(key: Metric) {
  return chartMetrics.find((metric) => metric.key === key)?.label ?? "Performance";
}

function PerformanceTooltip({ active, payload, label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Record<string, unknown> | undefined;
  return (
    <div className="min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="text-[11px] font-bold text-slate-900">{String(point?.periodLabel || label)}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {String(point?.tripCount ?? 0)} activity records · {String(point?.completedCount ?? 0)} completed
      </p>
      {typeof point?.cohortAssignedCount === "number" && (
        <p className="mt-1 text-[9px] text-slate-500">
          Created-trip cohort: {String(point.cohortCompletedCount ?? 0)} completed / {point.cohortAssignedCount} driver-linked trips
        </p>
      )}
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={String(entry.dataKey)} className="flex justify-between gap-4 text-[10px] text-slate-600">
            <span>{String(entry.name)}</span>
            <strong className="text-slate-900">
              {entry.value == null
                ? "Unavailable"
                : `${Number(entry.value).toFixed(1)}${String(entry.dataKey).toLowerCase().includes("rate") ? "%" : entry.dataKey === "averageDuration" ? " min" : ""}`}
            </strong>
          </p>
        ))}
      </div>
      {typeof point?.durationCount === "number" && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-500">
          Valid actual start/end pairs: {point.durationCount}
        </p>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note, comparison, tone = "pink" }: {
  icon: typeof Truck;
  label: string;
  value: string | number;
  note: string;
  comparison?: { difference: number | null; unit?: string; inverse?: boolean };
  tone?: "pink" | "green" | "amber" | "red" | "slate";
}) {
  const tones = { pink: "border-pink-100 bg-pink-50 text-[#b80049]", green: "border-emerald-100 bg-emerald-50 text-emerald-700", amber: "border-amber-100 bg-amber-50 text-amber-700", red: "border-rose-100 bg-rose-50 text-rose-700", slate: "border-slate-200 bg-slate-100 text-slate-500" };
  const favorable = comparison?.difference != null && ((comparison.difference > 0) !== Boolean(comparison.inverse));
  return (
    <article className="flex min-h-[132px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold leading-4 text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="text-[21px] font-bold leading-7 text-[#122038]">{value}</p>
        <div className="mt-1 min-h-4 text-[9px] leading-4 text-slate-400">
          {comparison?.difference != null && comparison.difference !== 0 && (
            <span className={`mr-1 inline-flex items-center gap-0.5 font-semibold ${favorable ? "text-emerald-700" : "text-rose-700"}`}>
              {favorable ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
              {Math.abs(comparison.difference).toFixed(1)}{comparison.unit || "%"} vs prior period
            </span>
          )}
          {note}
        </div>
      </div>
    </article>
  );
}

export default function DriverPerformancePage() {
  const [preset, setPreset] = useState<Preset>("Last 30 Days");
  const [customStart, setCustomStart] = useState(() => localDateString(new Date(Date.now() - 6 * 86400000)));
  const [customEnd, setCustomEnd] = useState(() => localDateString(new Date()));
  const [driverFilter, setDriverFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exceptionFilter, setExceptionFilter] = useState("");
  const [timelinessFilter, setTimelinessFilter] = useState<"all" | "on-time" | "late">("all");
  const [search, setSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [metric, setMetric] = useState<Metric>("completed");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [searchForComparison, setSearchForComparison] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof DriverMetrics>("completed");
  const [ascending, setAscending] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    const run = async () => {
      try {
        const [driverRows, tripRows, alertResult] = await Promise.all([
          getDrivers(),
          getTrips({ light: true, all: true, performance: true }),
          getAlerts({ category: "SAFETY" }).then((value: unknown) => ({ value, error: null as string | null })).catch((reason: unknown) => ({ value: [], error: reason instanceof Error ? reason.message : "Incident data could not be loaded." })),
        ]);
        if (!active || requestId !== requestIdRef.current) return;
        const driverList = Array.isArray(driverRows) ? driverRows as Driver[] : [];
        const tripMap = new Map<string, Trip>();
        (Array.isArray(tripRows) ? tripRows : []).forEach((trip: Trip, index: number) => {
          const id = String(trip.id ?? `trip-without-id-${index}`);
          if (!tripMap.has(id)) tripMap.set(id, trip);
        });
        const tripList = [...tripMap.values()];
        const driverIds = new Set(driverList.map((driver) => String(driver.id)));
        const tripIds = new Set(tripList.map((trip) => String(trip.id ?? "")));
        const incidentList = (Array.isArray(alertResult.value) ? alertResult.value as Alert[] : [])
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
        setError(null);
        setDrivers(driverList);
        setTrips(tripList);
        setIncidents(incidentList);
        setIncidentError(alertResult.error);
        hasLoadedRef.current = true;
        setLastRefreshed(new Date());
      } catch (reason) {
        if (active && requestId === requestIdRef.current) setError(reason instanceof Error ? reason.message : "Unable to load driver performance records.");
      } finally {
        if (active && requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void run();
    return () => { active = false; };
  }, [retry]);

  const windowRange = makeWindow(preset, customStart, customEnd);
  const validRange = Boolean(windowRange.start && windowRange.end && windowRange.start <= windowRange.end);
  const query = search.trim().toLowerCase();
  const matchesTripFilters = (trip: Trip, includeDriver = true) => (!includeDriver || !driverFilter || driverIdOf(trip) === driverFilter)
    && (statusFilter === "all" || String(trip.status ?? "Unknown") === statusFilter)
    && (!exceptionFilter || exceptionType(trip) === exceptionFilter)
    && (!query || `${trip.id ?? ""} ${tripDriverName(trip, drivers)} ${trip.status ?? ""} ${trip.from_location ?? trip.fromLocation ?? ""} ${trip.to_location ?? trip.toLocation ?? ""}`.toLowerCase().includes(query));
  const matchesActivityFilters = (trip: Trip, includeDriver = true) => matchesTripFilters(trip, includeDriver)
    && (timelinessFilter === "all" || onTimeValue(trip) === (timelinessFilter === "on-time"));
  const dateTrips = validRange ? trips.filter((trip) => inWindow(eventDate(trip), windowRange.start, windowRange.end)) : [];
  const activityTrips = dateTrips.filter((trip) => matchesTripFilters(trip));
  const visibleTrips = activityTrips.filter((trip) => matchesActivityFilters(trip));
  const assignmentCohortTrips = validRange
    ? getDriverLinkedTripCohort(trips, windowRange.start, windowRange.end).filter((trip) => matchesTripFilters(trip))
    : [];
  const statusOptions = [...new Set(dateTrips.map((trip) => String(trip.status ?? "Unknown")))].sort((a, b) => a.localeCompare(b));
  const completedTrips = activityTrips.filter(isCompleted);
  const assignedTrips = assignmentCohortTrips;
  const completedAssignedTrips = assignedTrips.filter(isCompleted);
  const validOnTime = completedTrips.map(onTimeValue).filter((value): value is boolean => value !== null);
  const durationValues = completedTrips.map(durationMinutes).filter((value): value is number => value !== null);
  const onTimeRate = validOnTime.length ? (validOnTime.filter(Boolean).length / validOnTime.length) * 100 : null;
  const completionRate = assignedTrips.length ? (completedAssignedTrips.length / assignedTrips.length) * 100 : null;
  const avgDuration = average(durationValues);
  const exceptionTrips = activityTrips.filter((trip) => exceptionType(trip) !== null);

  const rangeDuration = windowRange.start && windowRange.end ? windowRange.end.getTime() - windowRange.start.getTime() + 1 : 0;
  const previousEnd = windowRange.start ? new Date(windowRange.start.getTime() - 1) : null;
  const previousStart = previousEnd && rangeDuration ? new Date(previousEnd.getTime() - rangeDuration + 1) : null;
  const previousTrips = previousStart && previousEnd ? trips.filter((trip) =>
    inWindow(eventDate(trip), previousStart, previousEnd) && matchesTripFilters(trip)) : [];
  const previousCompleted = previousTrips.filter(isCompleted);
  const previousAssignmentCohortTrips = previousStart && previousEnd
    ? getDriverLinkedTripCohort(trips, previousStart, previousEnd).filter((trip) => matchesTripFilters(trip))
    : [];
  const previousAssigned = previousAssignmentCohortTrips;
  const previousCompletedAssigned = previousAssigned.filter(isCompleted);
  const previousValidOnTime = previousCompleted.map(onTimeValue).filter((value): value is boolean => value !== null);
  const previousDurations = previousCompleted.map(durationMinutes).filter((value): value is number => value !== null);
  const previousOnTimeRate = previousValidOnTime.length ? (previousValidOnTime.filter(Boolean).length / previousValidOnTime.length) * 100 : null;
  const previousCompletionRate = previousAssigned.length ? (previousCompletedAssigned.length / previousAssigned.length) * 100 : null;
  const previousDuration = average(previousDurations);
  const previousExceptionCount = previousTrips.filter((trip) => exceptionType(trip) !== null).length;
  const change = (value: number, previous: number | null) => previous == null || previous === 0 ? null : ((value - previous) / previous) * 100;
  const pointChange = (value: number | null, previous: number | null) => value == null || previous == null ? null : value - previous;

  const allDriverMetrics = drivers.map((driver) => metricsForDriver(driver, activityTrips, assignmentCohortTrips));
  const displayedMetrics = allDriverMetrics.filter((record) => !driverSearch.trim() || `${nameOf(record.driver)} ${record.driver.id}`.toLowerCase().includes(driverSearch.trim().toLowerCase()))
    .filter((record) => !query || `${nameOf(record.driver)} ${record.driver.id}`.toLowerCase().includes(query) || visibleTrips.some((trip) => driverIdOf(trip) === record.driver.id));
  const sortedMetrics = [...displayedMetrics].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const leftComparable = leftValue instanceof Date ? leftValue.getTime() : Number(leftValue ?? -1);
    const rightComparable = rightValue instanceof Date ? rightValue.getTime() : Number(rightValue ?? -1);
    const order = leftComparable - rightComparable;
    return ascending ? order : -order;
  });
  const pageCount = Math.max(1, Math.ceil(sortedMetrics.length / pageSize));
  const pagedMetrics = sortedMetrics.slice((page - 1) * pageSize, page * pageSize);
  const comparisonTrips = dateTrips.filter((trip) => matchesTripFilters(trip, false));
  const comparisonCohortTrips = validRange
    ? getDriverLinkedTripCohort(trips, windowRange.start, windowRange.end).filter((trip) => matchesTripFilters(trip, false))
    : [];
  const comparedMetrics = comparisonIds.map((id) => drivers.find((driver) => driver.id === id))
    .filter((driver): driver is Driver => Boolean(driver))
    .map((driver) => metricsForDriver(driver, comparisonTrips, comparisonCohortTrips));
  const compareSelection = drivers.filter((driver) => !searchForComparison.trim() || `${nameOf(driver)} ${driver.id}`.toLowerCase().includes(searchForComparison.trim().toLowerCase()));

  const bucketStep = rangeDuration > 180 * 86400000 ? "month" : rangeDuration > 45 * 86400000 ? "week" : "day";
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  if (windowRange.start && windowRange.end && validRange) {
    const cursor = new Date(windowRange.start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= windowRange.end) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      if (bucketStep === "month") end.setMonth(end.getMonth() + 1, 0);
      else if (bucketStep === "week") end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      if (end > windowRange.end) end.setTime(windowRange.end.getTime());
      const label = bucketStep === "month"
        ? start.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : bucketStep === "week"
          ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      buckets.push({ start, end, label });
      if (bucketStep === "month") cursor.setMonth(cursor.getMonth() + 1, 1);
      else cursor.setDate(cursor.getDate() + (bucketStep === "week" ? 7 : 1));
    }
  }

  const trendRows = buckets.map((bucket) => {
    const group = activityTrips.filter((trip) => inWindow(eventDate(trip), bucket.start, bucket.end));
    const completed = group.filter(isCompleted);
    const assignmentCohort = getDriverLinkedTripCohort(trips, bucket.start, bucket.end)
      .filter((trip) => matchesTripFilters(trip));
    const completedAssigned = assignmentCohort.filter(isCompleted);
    const deadlines = completed.map(onTimeValue).filter((value): value is boolean => value !== null);
    const durations = completed.map(durationMinutes).filter((value): value is number => value !== null);
    const shiftedStart = new Date(bucket.start.getTime() - rangeDuration);
    const shiftedEnd = new Date(bucket.end.getTime() - rangeDuration);
    const previousBucketTrips = previousStart && previousEnd
      ? trips.filter((trip) => inWindow(eventDate(trip), shiftedStart, shiftedEnd) && matchesTripFilters(trip))
      : [];
    const previousBucketCompleted = previousBucketTrips.filter(isCompleted);
    const previousBucketCohort = getDriverLinkedTripCohort(trips, shiftedStart, shiftedEnd)
      .filter((trip) => matchesTripFilters(trip));
    const previousBucketCompletedAssigned = previousBucketCohort.filter(isCompleted);
    const previousBucketOnTime = previousBucketCompleted.map(onTimeValue).filter((value): value is boolean => value !== null);
    const previousBucketDurations = previousBucketCompleted.map(durationMinutes).filter((value): value is number => value !== null);
    return {
      label: bucket.label,
      periodLabel: `${bucket.start.toLocaleDateString()} – ${bucket.end.toLocaleDateString()}`,
      totalTrips: group.length,
      bucketStart: bucket.start.toISOString(),
      bucketEnd: bucket.end.toISOString(),
      completedCount: completed.length,
      cohortAssignedCount: assignmentCohort.length,
      cohortCompletedCount: completedAssigned.length,
      durationCount: durations.length,
      completed: completed.length,
      completedPrevious: previousBucketCompleted.length,
      onTimeRate: deadlines.length ? deadlines.filter(Boolean).length / deadlines.length * 100 : null,
      onTimeRatePrevious: previousBucketOnTime.length ? previousBucketOnTime.filter(Boolean).length / previousBucketOnTime.length * 100 : null,
      completionRate: assignmentCohort.length ? completedAssigned.length / assignmentCohort.length * 100 : null,
      completionRatePrevious: previousBucketCohort.length ? previousBucketCompletedAssigned.length / previousBucketCohort.length * 100 : null,
      averageDuration: average(durations),
      averageDurationPrevious: average(previousBucketDurations),
      tripCount: group.length,
    };
  });
  const trendValue = (row: (typeof trendRows)[number], key: Metric, previous = false) => {
    if (key === "completed") return previous ? row.completedPrevious : row.completed;
    if (key === "onTimeRate") return previous ? row.onTimeRatePrevious : row.onTimeRate;
    if (key === "completionRate") return previous ? row.completionRatePrevious : row.completionRate;
    return previous ? row.averageDurationPrevious : row.averageDuration;
  };
  const metricHasData = (metric === "completionRate" ? assignmentCohortTrips.length > 0 : activityTrips.length > 0)
    && trendRows.some((row) => trendValue(row, metric) != null);

  const durationBuckets = [
    { label: "Under 1 hr", min: 0, max: 60 },
    { label: "1–3 hrs", min: 60, max: 180 },
    { label: "3–6 hrs", min: 180, max: 360 },
    { label: "6+ hrs", min: 360, max: Infinity },
  ].map((bucket) => ({ ...bucket, count: durationValues.filter((value) => value >= bucket.min && value < bucket.max).length }));
  const statusDistribution = [...new Set(visibleTrips.map((trip) => String(trip.status || "Unknown")))].map((status) => ({
    status,
    count: visibleTrips.filter((trip) => String(trip.status || "Unknown") === status).length,
  })).sort((a, b) => b.count - a.count);
  const exceptionDistribution = [...new Set(exceptionTrips.map((trip) => exceptionType(trip) || "Other"))].map((type) => ({
    type,
    count: exceptionTrips.filter((trip) => exceptionType(trip) === type).length,
  })).sort((a, b) => b.count - a.count);

  const incidentByTrip = new Map<string, Incident[]>();
  incidents.forEach((incident) => {
    if (!incident.tripId) return;
    incidentByTrip.set(String(incident.tripId), [...(incidentByTrip.get(String(incident.tripId)) || []), incident]);
  });
  const selectedDriverMetrics = selectedDriver ? metricsForDriver(selectedDriver, activityTrips, assignmentCohortTrips) : null;
  const selectedDriverTrips = selectedDriver ? visibleTrips.filter((trip) => driverIdOf(trip) === selectedDriver.id) : [];
  const periodText = windowRange.start && windowRange.end ? `${windowRange.start.toLocaleDateString()} – ${windowRange.end.toLocaleDateString()}` : "Invalid reporting period";

  const exportReport = () => {
    if (!validRange) return;
    try {
      const csvRows: unknown[][] = [
        ["Airship Express Driver Performance Report"],
        ["Reporting period", periodText],
        ["Filters", `Driver: ${driverFilter || "All"}; trip status: ${statusFilter}; exception: ${exceptionFilter || "All"}; timeliness: ${timelinessFilter}`],
        ["Definitions", "Completion rate = currently completed, driver-linked, recognized trip records created during the reporting period / all such records created during the period. Trip creation time is used because no assignment timestamp is exposed. Completed, on-time, and duration activity is based on completion timestamps."],
        ["Driver-linked trips created in period", assignedTrips.length],
        ["Completed from created-trip cohort", completedAssignedTrips.length],
        ["Trips completed during activity period", completedTrips.length],
        ["Trip completion rate", formatPercent(completionRate)],
        ["On-time delivery rate", formatPercent(onTimeRate)],
        ["Average delivery duration", formatDuration(avgDuration)],
        ["Delivery exceptions", exceptionTrips.length],
        [],
        ["Driver", "Driver ID", "Trips created in cohort", "Completed in cohort", "Cohort completion rate", "On-time rate", "Average duration minutes", "Exceptions", "Last activity"],
        ...displayedMetrics.map((record) => [nameOf(record.driver), record.driver.id, record.assigned, record.completed, formatPercent(record.completionRate), formatPercent(record.onTimeRate), record.averageDuration, record.exceptions, record.lastActivity?.toISOString() || ""]),
        [],
        ["Trip ID", "Driver", "From", "To", "Status", "Scheduled departure", "Actual start", "Delivery window end", "Actual completion", "Duration minutes", "On-time", "Exception"],
        ...visibleTrips.map((trip) => [trip.id, tripDriverName(trip, drivers), trip.from_location ?? trip.fromLocation, trip.to_location ?? trip.toLocation, trip.status, scheduledDeparture(trip), tripStart(trip), tripWindowEnd(trip), tripEnd(trip), durationMinutes(trip), onTimeValue(trip), exceptionType(trip)]),
      ];
      const content = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `driver-performance-${localDateString(windowRange.start!)}-to-${localDateString(windowRange.end!)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportMessage("Filtered driver and trip report exported.");
    } catch {
      setExportMessage("The report could not be exported. Please try again.");
    }
    window.setTimeout(() => setExportMessage(null), 3500);
  };

  const toggleComparison = (id: string) => {
    setComparisonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  };
  const toggleSort = (key: keyof DriverMetrics) => {
    if (sortBy === key) setAscending((value) => !value);
    else { setSortBy(key); setAscending(false); }
    setPage(1);
  };
  const changeStatusFromChart = (status: string) => {
    setStatusFilter((current) => current === status ? "all" : status);
    setPage(1);
  };
  const changeExceptionFromChart = (type: string) => {
    setExceptionFilter((current) => current === type ? "" : type);
    setPage(1);
  };
  const changeTimelinessFromChart = (value: "on-time" | "late") => {
    setTimelinessFilter((current) => current === value ? "all" : value);
    setPage(1);
  };
  const emptyMessage = loading ? "Loading driver performance records…" : error ? "The driver records could not be loaded. Retry to refresh this page." : `No trips match ${periodText} and the current filters.`;

  return <div className="min-h-screen bg-[#f4f7fb] text-[#122038]"><GlobalNavbar />
    <main className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.035)] sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-bold tracking-tight text-[#122038] sm:text-2xl">Driver Performance</h1><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse motion-reduce:animate-none bg-amber-500" : lastRefreshed ? "bg-emerald-500" : "bg-slate-400"}`} />{refreshing ? "Refreshing" : lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Waiting for data"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Analyze driver productivity, delivery reliability, and operational efficiency.</p><p className="mt-1 text-[10px] text-slate-400">Reporting period: {periodText} · Completion uses trip-created cohorts because assignment timestamps are unavailable; delivery metrics use activity timestamps · Aggregation: {bucketStep === "day" ? "daily" : bucketStep === "week" ? "weekly" : "monthly"}</p></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[170px_150px_150px_210px_auto_auto]">
          <label className="relative"><span className="sr-only">Reporting period</span><CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b80049]" size={14} /><select value={preset} onChange={(event) => { setPreset(event.target.value as Preset); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">{presets.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Filter by driver</span><select value={driverFilter} onChange={(event) => { setDriverFilter(event.target.value); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="">All drivers</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{nameOf(driver)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Filter by trip status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[11px] text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100"><option value="all">All trip statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /></label>
          <label className="relative"><span className="sr-only">Search driver, trip, or route</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Driver, trip ID, or route" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></label>
          <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={refreshing || loading} aria-label="Refresh performance data" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049] disabled:opacity-50">{refreshing ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}<span className="sm:hidden">Refresh</span></button>
          <button type="button" onClick={exportReport} disabled={loading || !validRange || visibleTrips.length === 0} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#b80049] px-3.5 text-[11px] font-semibold text-white hover:bg-[#97003d] disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} />Export Report</button>
        </div>
        {preset === "Custom Range" && <div className="flex flex-wrap items-center gap-2 xl:basis-full xl:justify-end"><label htmlFor="performance-start" className="text-[10px] font-semibold text-slate-500">From</label><input id="performance-start" type="date" value={customStart} max={customEnd} onChange={(event) => { setCustomStart(event.target.value); setPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /><label htmlFor="performance-end" className="text-[10px] font-semibold text-slate-500">To</label><input id="performance-end" type="date" value={customEnd} min={customStart} max={localDateString(new Date())} onChange={(event) => { setCustomEnd(event.target.value); setPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></div>}
      </header>

      {(exceptionFilter || timelinessFilter !== "all") && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-pink-100 bg-pink-50/60 px-3 py-2 text-[9px] text-slate-600"><span className="font-semibold text-slate-700">Breakdown filters:</span>{exceptionFilter && <button type="button" onClick={() => setExceptionFilter("")} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 font-semibold text-amber-800">Exception: {exceptionFilter}<X size={10} /></button>}{timelinessFilter !== "all" && <button type="button" onClick={() => setTimelinessFilter("all")} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-800">Timeliness: {timelinessFilter}<X size={10} /></button>}</div>}
      {!validRange && preset === "Custom Range" && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">Select a valid reporting period to calculate performance.</p>}
      {error && <div role="alert" className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"><span><strong>Performance data could not be loaded.</strong> {error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-md border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100 sm:self-auto"><RefreshCw size={13} />Retry</button></div>}
      {incidentError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[10px] text-amber-900">Trip analysis is available, but incident records are unavailable: {incidentError}</p>}
      {exportMessage && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800"><Check size={14} />{exportMessage}</p>}

      <section aria-label="Driver performance key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[132px] animate-pulse motion-reduce:animate-none rounded-xl border border-slate-200 bg-white" />) : <>
          <MetricCard icon={Truck} label="Trips Created in Period" value={assignedTrips.length} note="Driver-linked, recognized trip records; creation date used because assignment time is unavailable" comparison={{ difference: change(assignedTrips.length, previousAssigned.length) }} />
          <MetricCard icon={Check} label="Completed Trips" value={completedTrips.length} note="Completed by completion timestamp in the reporting period" comparison={{ difference: change(completedTrips.length, previousCompleted.length) }} tone="green" />
          <MetricCard icon={Activity} label="Trip Completion Rate" value={formatPercent(completionRate)} note={`${completedAssignedTrips.length} completed from created-trip cohort / ${assignedTrips.length} cohort trips`} comparison={{ difference: pointChange(completionRate, previousCompletionRate), unit: " pp" }} tone={completionRate == null ? "slate" : completionRate >= 90 ? "green" : completionRate >= 75 ? "amber" : "red"} />
          <MetricCard icon={Clock3} label="On-Time Delivery Rate" value={formatPercent(onTimeRate)} note={validOnTime.length ? `${validOnTime.length} trips with a route-plan deadline and actual completion` : "Needs a route-plan window end or expected arrival, plus actual completion"} comparison={{ difference: pointChange(onTimeRate, previousOnTimeRate), unit: " pp" }} tone={onTimeRate == null ? "slate" : onTimeRate >= 95 ? "green" : onTimeRate >= 85 ? "amber" : "red"} />
          <MetricCard icon={Gauge} label="Average Delivery Duration" value={formatDuration(avgDuration)} note={durationValues.length ? `${durationValues.length} valid start/completion pairs` : "Needs actual start and completion timestamps"} comparison={{ difference: avgDuration != null && previousDuration != null ? avgDuration - previousDuration : null, unit: " min", inverse: true }} tone={avgDuration == null ? "slate" : "pink"} />
          <MetricCard icon={AlertTriangle} label="Delivery Exceptions" value={exceptionTrips.length} note="Explicit exception field or delayed, late, failed status" comparison={{ difference: change(exceptionTrips.length, previousExceptionCount), inverse: true }} tone={exceptionTrips.length ? "amber" : "green"} />
        </>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-bold text-[#122038]">Driver Performance Trends</h2><p className="mt-1 text-[10px] text-slate-500">Completion rates follow trip-created cohorts; completed trips, on-time rates, and durations follow activity timestamps.</p></div><label><span className="sr-only">Trend metric</span><select value={metric} onChange={(event) => setMetric(event.target.value as Metric)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100">{chartMetrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
          <div className="mt-4 h-[280px] min-w-0">{metricHasData ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendRows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="#e8edf4" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#718096", fontSize: 9 }} axisLine={{ stroke: "#dfe6ef" }} tickLine={false} minTickGap={20} /><YAxis allowDecimals={metric !== "completed"} domain={metric === "onTimeRate" || metric === "completionRate" ? [0, 100] : [0, "auto"]} tick={{ fill: "#718096", fontSize: 9 }} axisLine={false} tickLine={false} width={42} tickFormatter={(value: number) => metric === "onTimeRate" || metric === "completionRate" ? `${value}%` : metric === "averageDuration" ? `${value}m` : String(value)} /><Tooltip content={PerformanceTooltip} /><Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />{metric === "completed" ? <><Bar dataKey="completed" name="Completed trips" fill="#b80049" radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="completedPrevious" name="Previous period" stroke="#91a0b4" strokeDasharray="4 4" dot={false} /></> : <><Line type="monotone" dataKey={metric} name="Current period" stroke="#b80049" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} /><Line type="monotone" dataKey={`${metric}Previous`} name="Previous period" stroke="#93a2b5" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} /></>}</ComposedChart></ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 text-center"><Gauge size={22} className="mb-2 text-slate-400" /><p className="text-xs font-semibold text-slate-700">{visibleTrips.length ? `${metricLabel(metric)} unavailable for this period` : "No trips in this reporting period"}</p><p className="mt-1 max-w-md text-[10px] leading-4 text-slate-500">{metric === "averageDuration" ? "Requires actual start and completion timestamps for the same trip." : metric === "onTimeRate" ? "Requires a route-plan delivery-window end and actual completion timestamp." : "Try a different date, driver, or trip status."}</p></div>}</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[9px] text-slate-500"><span>{metricLabel(metric)} · {bucketStep} intervals · {periodText}</span><span>{visibleTrips.length} filtered trip records</span></div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex flex-col gap-3"><div><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-[#122038]">Driver Performance Comparison</h2><span className="rounded-full bg-pink-50 px-2 py-1 text-[9px] font-semibold text-[#b80049]">Up to 4 drivers</span></div><p className="mt-1 text-[10px] text-slate-500">Compare the same date/status cohort for each driver.</p></div><label className="relative block"><span className="sr-only">Search comparison drivers</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><input value={searchForComparison} onChange={(event) => setSearchForComparison(event.target.value)} placeholder="Find a driver to compare" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100" /></label></div>
          <div className="mt-3 max-h-[104px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">{compareSelection.map((driver) => <label key={driver.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[10px] text-slate-700 hover:bg-white"><input type="checkbox" checked={comparisonIds.includes(driver.id)} onChange={() => toggleComparison(driver.id)} disabled={!comparisonIds.includes(driver.id) && comparisonIds.length >= 4} className="h-3.5 w-3.5 accent-[#b80049]" /><span className="truncate">{nameOf(driver)}</span></label>)}{!compareSelection.length && <p className="px-2 py-3 text-center text-[10px] text-slate-500">No drivers match.</p>}</div>
          {comparedMetrics.length ? <div className="mt-3 max-h-[300px] space-y-3 overflow-auto">{comparedMetrics.map((record) => <div key={record.driver.id} className="rounded-lg border border-slate-200 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold text-slate-800">{nameOf(record.driver)}</span><button type="button" onClick={() => setComparisonIds((ids) => ids.filter((id) => id !== record.driver.id))} aria-label={`Remove ${nameOf(record.driver)} from comparison`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><X size={12} /></button></div><div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[9px]"><span className="text-slate-500">Completed <strong className="ml-1 text-slate-800">{record.completed}</strong></span><span className="text-slate-500">On time <strong className="ml-1 text-slate-800">{formatPercent(record.onTimeRate)}</strong></span><span className="text-slate-500">Completion <strong className="ml-1 text-slate-800">{formatPercent(record.completionRate)}</strong></span><span className="text-slate-500">Avg duration <strong className="ml-1 text-slate-800">{formatDuration(record.averageDuration)}</strong></span><span className="col-span-2 text-slate-500">Exceptions <strong className="ml-1 text-slate-800">{record.exceptions}</strong></span></div></div>)}</div> : <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center"><Users className="mx-auto mb-2 text-slate-300" size={19} /><p className="text-[10px] font-semibold text-slate-700">Select drivers to compare</p><p className="mt-1 text-[9px] text-slate-500">Missing values stay unavailable; no score is assigned to them.</p></div>}
          <p className="mt-3 text-[9px] leading-4 text-slate-400">Rates use the same status rules. On-time and duration include only valid timestamp pairs.</p>
        </article>
      </section>

      <section><div className="mb-3"><h2 className="text-sm font-bold text-[#122038]">Delivery Efficiency Breakdown</h2><p className="mt-1 text-[10px] text-slate-500">Click a trip status to apply it to all sections; select it again to clear.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><h3 className="text-[11px] font-bold text-slate-800">On-time vs late deliveries</h3><p className="mt-1 text-[9px] text-slate-500">Completed trips with schedule.window_end and actual completion.</p>{validOnTime.length ? <div className="mt-4 space-y-2"><div className="flex justify-between text-[9px]"><button type="button" onClick={() => changeTimelinessFromChart("on-time")} aria-pressed={timelinessFilter === "on-time"} className={`font-semibold ${timelinessFilter === "on-time" ? "rounded bg-emerald-100 px-1.5 text-emerald-900" : "text-emerald-700"}`}>On time · {validOnTime.filter(Boolean).length}</button><button type="button" onClick={() => changeTimelinessFromChart("late")} aria-pressed={timelinessFilter === "late"} className={`font-semibold ${timelinessFilter === "late" ? "rounded bg-amber-100 px-1.5 text-amber-900" : "text-amber-700"}`}>Late · {validOnTime.filter((value) => !value).length}</button></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-100"><div className="bg-emerald-600" style={{ width: `${onTimeRate}%` }} /><div className="bg-amber-500" style={{ width: `${100 - (onTimeRate || 0)}%` }} /></div><p className="text-[9px] text-slate-400">{validOnTime.length} valid records · trip ID matched route plan</p></div> : <p className="mt-4 rounded-lg bg-slate-50 p-2.5 text-[9px] leading-4 text-slate-500">No completed trips with both valid window and actual time.</p>}</article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><h3 className="text-[11px] font-bold text-slate-800">Trip status distribution</h3><p className="mt-1 text-[9px] text-slate-500">Actual trip statuses in the current filtered cohort.</p>{statusDistribution.length ? <div className="mt-3 h-[140px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusDistribution} layout="vertical" margin={{ top: 2, right: 10, left: 4, bottom: 0 }}><CartesianGrid stroke="#edf1f6" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#8794a7", fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="status" width={78} tick={{ fill: "#536176", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="count" name="Trips" fill="#b80049" radius={[0, 3, 3, 0]} onClick={(entry) => {
          const payload: unknown = entry.payload;
          const status = typeof payload === "object" && payload !== null ? Reflect.get(payload, "status") : null;
          if (typeof status === "string") changeStatusFromChart(status);
        }} cursor="pointer" /></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-[9px] text-slate-500">No trip statuses recorded.</p>}</article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><h3 className="text-[11px] font-bold text-slate-800">Delivery duration distribution</h3><p className="mt-1 text-[9px] text-slate-500">Actual start to actual completion; duration recorded in minutes.</p>{durationValues.length ? <div className="mt-3 h-[140px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={durationBuckets} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}><CartesianGrid stroke="#edf1f6" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#536176", fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#8794a7", fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="count" name="Trips" fill="#d44a87" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="mt-4 rounded-lg bg-slate-50 p-2.5 text-[9px] leading-4 text-slate-500">No completed trips have valid actual start and completion timestamps.</p>}</article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><h3 className="text-[11px] font-bold text-slate-800">Exceptions by type</h3><p className="mt-1 text-[9px] text-slate-500">Explicit trip exception fields and delayed, late, failed, or exception statuses.</p>{exceptionDistribution.length ? <div className="mt-3 space-y-2">{exceptionDistribution.map((entry) => <button type="button" key={entry.type} aria-pressed={exceptionFilter === entry.type} onClick={() => changeExceptionFromChart(entry.type)} className={`w-full rounded-md p-1 text-left hover:bg-amber-50 ${exceptionFilter === entry.type ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}><div className="mb-1 flex justify-between text-[9px]"><span className="text-slate-600">{entry.type}</span><strong className="text-slate-800">{entry.count}</strong></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(5, entry.count / exceptionTrips.length * 100)}%` }} /></div></button>)}</div> : <p className="mt-4 rounded-lg bg-slate-50 p-2.5 text-[9px] text-slate-500">No exceptions recorded for this filtered cohort.</p>}<p className="mt-3 text-[9px] text-slate-400">No dedicated exception table is exposed by the current APIs.</p></article>
      </div></section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-[#122038]">Performance Insights</h2><p className="mt-1 text-[10px] text-slate-500">Rule-based observations from the filtered dataset and prior equivalent period.</p></div><span className="text-[9px] text-slate-400">{periodText}</span></div><div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">{(() => {
        const insights: Array<{ title: string; detail: string; tone: string }> = [];
        if (previousAssigned.length >= 3 && assignedTrips.length < previousAssigned.length) insights.push({ title: "Assigned trip volume decreased", detail: `${assignedTrips.length} assigned trips versus ${previousAssigned.length} in the previous equivalent period.`, tone: "amber" });
        if (previousAssigned.length >= 3 && assignedTrips.length > previousAssigned.length) insights.push({ title: "Assigned trip volume increased", detail: `${assignedTrips.length} assigned trips versus ${previousAssigned.length} previously.`, tone: "pink" });
        if (validOnTime.length >= 3 && previousValidOnTime.length >= 3 && onTimeRate != null && previousOnTimeRate != null && Math.abs(onTimeRate - previousOnTimeRate) >= 5) insights.push({ title: onTimeRate < previousOnTimeRate ? "On-time delivery rate declined" : "On-time delivery rate improved", detail: `${onTimeRate.toFixed(1)}% from ${validOnTime.length} valid deliveries; prior rate ${previousOnTimeRate.toFixed(1)}% from ${previousValidOnTime.length}.`, tone: onTimeRate < previousOnTimeRate ? "amber" : "green" });
        if (exceptionTrips.length >= 3) {
          const leading = exceptionDistribution[0];
          if (leading) insights.push({ title: "Recurring exception status", detail: `${leading.type} appears on ${leading.count} of ${exceptionTrips.length} trips with a recognized exception.`, tone: "amber" });
        }
        if (!insights.length) return <div className="col-span-full rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center"><p className="text-[10px] font-semibold text-slate-700">Insufficient comparable records for a trend insight</p><p className="mt-1 text-[9px] text-slate-500">Volume comparisons require at least 3 prior assigned trips; rate comparisons require 3 valid deliveries in each period.</p></div>;
        return insights.map((insight) => <article key={insight.title} className={`rounded-lg border p-3 ${insight.tone === "green" ? "border-emerald-100 bg-emerald-50/60" : insight.tone === "pink" ? "border-pink-100 bg-pink-50/50" : "border-amber-100 bg-amber-50/60"}`}><p className="text-[10px] font-bold text-slate-800">{insight.title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{insight.detail}</p></article>);
      })()}</div></section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-[#122038]">Driver Performance Records</h2><p className="mt-1 text-[10px] text-slate-500">{periodText} · {statusFilter === "all" ? "All trip statuses" : statusFilter} · {driverFilter ? nameOf(drivers.find((driver) => driver.id === driverFilter)!) : "All drivers"}</p></div><div className="flex flex-wrap items-center gap-2"><label className="relative"><span className="sr-only">Search driver records</span><Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><input value={driverSearch} onChange={(event) => { setDriverSearch(event.target.value); setPage(1); }} placeholder="Filter driver rows" className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[10px] outline-none focus:border-[#b80049] focus:ring-2 focus:ring-pink-100 sm:w-40" /></label><span className="text-[9px] text-slate-400">Safety score unavailable</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-left"><thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3 sm:px-5">Driver</th>{[{ key: "assigned", label: "Assigned" }, { key: "completed", label: "Completed" }, { key: "completionRate", label: "Completion rate" }, { key: "onTimeRate", label: "On-time rate" }, { key: "averageDuration", label: "Avg duration" }, { key: "exceptions", label: "Exceptions" }, { key: "lastActivity", label: "Last activity" }].map((column) => <th key={column.key} className="px-3 py-3"><button type="button" onClick={() => toggleSort(column.key as keyof DriverMetrics)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#b80049]">{column.label}{sortBy === column.key && (ascending ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}</button></th>)}</tr></thead><tbody className="divide-y divide-slate-100 text-[10px]">{pagedMetrics.map((record) => <tr key={record.driver.id} tabIndex={0} onClick={() => setSelectedDriver(record.driver)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedDriver(record.driver); }} className="cursor-pointer hover:bg-pink-50/40 focus:bg-pink-50/50 focus:outline-none"><td className="px-4 py-3 sm:px-5"><span className="flex items-center gap-2.5"><FtmProfileAvatar name={nameOf(record.driver)} userId={record.driver.id} src={record.driver.avatar_url ?? record.driver.avatarUrl} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-100 bg-pink-50 text-[9px] font-bold text-[#b80049]" /><span><strong className="block max-w-[160px] truncate text-slate-800">{nameOf(record.driver)}</strong><span className="font-mono text-[8px] text-slate-400">{record.driver.id}</span></span></span></td><td className="px-3 py-3 font-semibold text-slate-700">{record.assigned}</td><td className="px-3 py-3 font-semibold text-slate-700">{record.completed}</td><td className="px-3 py-3 text-slate-700">{formatPercent(record.completionRate)}</td><td className="px-3 py-3">{record.onTimeRate == null ? <span className="text-slate-400" title="Requires valid schedule.window_end and completion timestamps">Unavailable</span> : <span className={`rounded px-1.5 py-1 font-bold ${record.onTimeRate >= 95 ? "bg-emerald-50 text-emerald-800" : record.onTimeRate >= 85 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>{record.onTimeRate.toFixed(1)}% · n={record.onTimeEligible}</span>}</td><td className="px-3 py-3 text-slate-700">{formatDuration(record.averageDuration)}</td><td className="px-3 py-3 text-slate-700">{record.exceptions}</td><td className="px-3 py-3 text-slate-500">{record.lastActivity ? formatDateTime(record.lastActivity) : "Not recorded"}</td></tr>)}{!pagedMetrics.length && <tr><td colSpan={8} className="px-5 py-10 text-center"><p className="text-[10px] font-semibold text-slate-700">{emptyMessage}</p><p className="mt-1 text-[9px] text-slate-500">Cancelled and unrecognized statuses are not counted as assigned or completed.</p></td></tr>}</tbody></table></div><div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><span>{sortedMetrics.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedMetrics.length)} of ${sortedMetrics.length} drivers` : "0 drivers"}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous driver page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={13} /></button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Next driver page" className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={13} /></button></div></div></section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]"><div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5"><div><h2 className="text-sm font-bold text-[#122038]">Trip-Level Performance Details</h2><p className="mt-1 text-[10px] text-slate-500">Actual trip records in the same period and filter cohort as the KPIs above.</p></div><span className="text-[9px] text-slate-400">{visibleTrips.length} trips</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-left"><thead className="bg-slate-50/80 text-[9px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Trip ID</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Route</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Scheduled departure</th><th className="px-3 py-3">Actual start</th><th className="px-3 py-3">Delivery window end</th><th className="px-3 py-3">Completed</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Timeliness / exception</th></tr></thead><tbody className="divide-y divide-slate-100 text-[9px]">{visibleTrips.slice(0, 100).map((trip, index) => {
        const duration = durationMinutes(trip);
        const timely = onTimeValue(trip);
        const statusException = exceptionType(trip);
        const incident = trip.id ? incidentByTrip.get(String(trip.id))?.[0] : undefined;
        return <tr key={String(trip.id ?? index)} className="hover:bg-slate-50"><td className="px-4 py-3"><button type="button" onClick={() => setSelectedTrip(trip)} className="font-mono font-semibold text-[#b80049] hover:underline focus:outline-none focus:ring-2 focus:ring-pink-200" aria-label={`Open trip ${trip.id || "without identifier"}`}>{trip.id || "ID unavailable"}</button></td><td className="px-3 py-3 text-slate-700">{tripDriverName(trip, drivers)}</td><td className="max-w-[180px] px-3 py-3 text-slate-600"><span className="block truncate">{trip.from_location || trip.fromLocation || "Origin unavailable"} → {trip.to_location || trip.toLocation || "Destination unavailable"}</span></td><td className="px-3 py-3"><button type="button" onClick={() => changeStatusFromChart(String(trip.status || "Unknown"))} className={`rounded px-1.5 py-1 font-semibold ${statusFilter === trip.status ? "bg-pink-100 text-[#b80049]" : "bg-slate-100 text-slate-700"}`}>{trip.status || "Unspecified"}</button></td><td className="px-3 py-3 text-slate-500">{formatDateTime(scheduledDeparture(trip))}</td><td className="px-3 py-3 text-slate-500">{formatDateTime(tripStart(trip))}</td><td className="px-3 py-3 text-slate-500">{formatDateTime(tripWindowEnd(trip))}</td><td className="px-3 py-3 text-slate-500">{formatDateTime(tripEnd(trip))}</td><td className="px-3 py-3 text-slate-700">{formatDuration(duration)}</td><td className="px-3 py-3">{timely == null ? statusException ? <span className="font-semibold text-amber-700">{statusException}{incident?.incidentType ? ` · ${incident.incidentType}` : ""}</span> : <span className="text-slate-400">Not measured</span> : <span className={timely ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{timely ? "On time" : "Late"}{incident?.incidentType ? ` · ${incident.incidentType}` : ""}</span>}</td></tr>;
      })}{!visibleTrips.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-[10px] text-slate-500">{emptyMessage}</td></tr>}</tbody></table></div>{visibleTrips.length > 100 && <p className="border-t border-slate-100 px-4 py-2 text-[9px] text-slate-500">Showing 100 of {visibleTrips.length} filtered trips. Export includes all filtered records.</p>}</section>
    </main>
    <GlobalFooter />

    {selectedDriver && selectedDriverMetrics && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDriver(null); }}><section role="dialog" aria-modal="true" aria-labelledby="driver-performance-detail-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FtmProfileAvatar name={nameOf(selectedDriver)} userId={selectedDriver.id} src={selectedDriver.avatar_url ?? selectedDriver.avatarUrl} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-pink-200 bg-pink-50 text-xs font-bold text-[#b80049]" /><div className="min-w-0"><h2 id="driver-performance-detail-title" className="truncate text-sm font-bold text-[#122038]">{nameOf(selectedDriver)}</h2><p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{selectedDriver.id} · {periodText}</p></div></div><button type="button" aria-label="Close driver performance detail" onClick={() => setSelectedDriver(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><p className="rounded-lg bg-slate-50 p-3 text-[9px] text-slate-500">Assigned<strong className="mt-1 block text-base text-slate-800">{selectedDriverMetrics.assigned}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[9px] text-slate-500">Completed<strong className="mt-1 block text-base text-slate-800">{selectedDriverMetrics.completed}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[9px] text-slate-500">On time<strong className="mt-1 block text-base text-slate-800">{formatPercent(selectedDriverMetrics.onTimeRate)}</strong></p><p className="rounded-lg bg-slate-50 p-3 text-[9px] text-slate-500">Avg duration<strong className="mt-1 block text-base text-slate-800">{formatDuration(selectedDriverMetrics.averageDuration)}</strong></p></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><article className="rounded-lg border border-slate-200 p-3"><h3 className="text-[10px] font-bold text-slate-700">Trip trend for selected driver</h3><div className="mt-2 h-[170px]">{trendRows.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendRows.map((row) => {
          const start = parseTimestamp(row.bucketStart);
          const end = parseTimestamp(row.bucketEnd);
          const group = start && end ? selectedDriverTrips.filter((trip) => inWindow(eventDate(trip), start, end)) : [];
          const completed = group.filter(isCompleted);
          const timely = completed.map(onTimeValue).filter((value): value is boolean => value !== null);
          const eligible = group.filter(isEligible);
          return { ...row, driverCompleted: completed.length, driverRate: timely.length ? timely.filter(Boolean).length / timely.length * 100 : null, driverCompletion: eligible.length ? completed.length / eligible.length * 100 : null };
        })} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}><CartesianGrid stroke="#edf1f6" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 8, fill: "#718096" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 8, fill: "#718096" }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="driverCompleted" name="Completed trips" stroke="#b80049" strokeWidth={2} dot={false} connectNulls={false} /></LineChart></ResponsiveContainer> : <p className="pt-12 text-center text-[9px] text-slate-500">No trips for this driver in this period.</p>}</div></article><article className="rounded-lg border border-slate-200 p-3"><h3 className="text-[10px] font-bold text-slate-700">Late deliveries and exceptions</h3><ul className="mt-2 max-h-[150px] divide-y divide-slate-100 overflow-y-auto">{selectedDriverTrips.filter((trip) => onTimeValue(trip) === false || exceptionType(trip) !== null).slice(0, 12).map((trip, index) => <li key={String(trip.id ?? index)} className="flex justify-between gap-3 py-2 text-[9px]"><span className="min-w-0"><strong className="block truncate text-slate-700">{trip.id || "Trip ID not recorded"}</strong><span className="text-slate-500">{exceptionType(trip) || "Late delivery"} · {trip.status || "Unspecified"}</span></span><span className="shrink-0 text-right text-slate-400">{formatDateTime(tripEnd(trip))}</span></li>)}{!selectedDriverTrips.some((trip) => onTimeValue(trip) === false || exceptionType(trip) !== null) && <li className="py-5 text-center text-[9px] text-slate-500">No late deliveries or status exceptions recorded.</li>}</ul></article></div><div className="mt-4"><h3 className="text-[10px] font-bold text-slate-700">Filtered trip records</h3><div className="mt-2 max-h-[180px] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">{selectedDriverTrips.map((trip, index) => <button key={String(trip.id ?? index)} type="button" onClick={() => setSelectedTrip(trip)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-pink-50"><span className="min-w-0"><strong className="block truncate font-mono text-[9px] text-[#b80049]">{trip.id || "Trip ID unavailable"}</strong><span className="block truncate text-[9px] text-slate-500">{trip.from_location || trip.fromLocation || "Origin unavailable"} → {trip.to_location || trip.toLocation || "Destination unavailable"}</span></span><span className="shrink-0 text-[9px] text-slate-500">{trip.status || "Unspecified"} · {formatDateTime(tripEnd(trip))}</span></button>)}{!selectedDriverTrips.length && <p className="px-3 py-5 text-center text-[9px] text-slate-500">No driver-linked trip records in this period.</p>}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="text-[9px] text-slate-400">Safety score unavailable: no verified score source.</span><a href="/driver/leaderboard" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-700 hover:border-pink-200 hover:text-[#b80049]">Existing leaderboard <ExternalLink size={12} /></a></div></section></div>}

    {selectedTrip && <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTrip(null); }}><section role="dialog" aria-modal="true" aria-labelledby="trip-performance-detail-title" className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wide text-[#b80049]">Trip performance record</p><h2 id="trip-performance-detail-title" className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{selectedTrip.id || "Trip identifier unavailable"}</h2></div><button type="button" aria-label="Close trip detail" onClick={() => setSelectedTrip(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div><p className="mt-2 text-[10px] text-slate-500">{tripDriverName(selectedTrip, drivers)} · {selectedTrip.status || "Status not recorded"}</p><dl className="mt-4 grid grid-cols-2 gap-2 text-[9px]">{[
        ["Origin", selectedTrip.from_location ?? selectedTrip.fromLocation ?? "Not recorded"],
        ["Destination", selectedTrip.to_location ?? selectedTrip.toLocation ?? "Not recorded"],
        ["Actual start", formatDateTime(tripStart(selectedTrip))],
        ["Delivery window end", formatDateTime(tripWindowEnd(selectedTrip))],
        ["Actual completion", formatDateTime(tripEnd(selectedTrip))],
        ["Duration", formatDuration(durationMinutes(selectedTrip))],
        ["Timeliness", onTimeValue(selectedTrip) == null ? "Not measured: valid window and completion required" : onTimeValue(selectedTrip) ? "On time" : "Late"],
        ["Exception", exceptionType(selectedTrip) || "No status exception recorded"],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd></div>)}</dl><p className="mt-3 text-[9px] leading-4 text-slate-500">Trip-level details are from the existing trip API; no dedicated trip detail route was found.</p><div className="mt-4 flex justify-end"><button type="button" onClick={() => setSelectedTrip(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">Close details</button></div></section></div>}
  </div>;
}