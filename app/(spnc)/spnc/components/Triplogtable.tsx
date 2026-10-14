"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Truck,
  User,
  Package,
  CalendarClock,
  Gauge,
  MapPin,
  Navigation,
  ChevronRight,
  ChevronLeft,
  Search,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Phone,
  AlertTriangle,
  ChevronsUpDown,
  Map as MapIcon,
  Clock,
  X,
} from "lucide-react";
import TripTrackingModal from "./TripTrackingModal";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Expected API response from GET /spnc/app/api/trips:
 *   { trips: Trip[] }   // each trip with its checkpoints embedded
 */
export type TripCheckpoint = {
  id?: string;
  checkpoint_no: number;
  location: string;
  recorded_at: string; // ISO datetime (date + time of the checkpoint)
  odometer_km: number | null;
  status: string; // departed | in_transit | delayed | delivered | cancelled
  updated_by?: string | null;
  remarks?: string | null;
};

export type Trip = {
  id: string;
  trip_code: string; // e.g. TRP-0001
  schedule_id?: string | null; // links the trip to a schedule on the calendar

  // Vehicle details
  vehicle_plate_no: string;
  vehicle_type?: string | null;
  vehicle_make_model?: string | null;
  vehicle_capacity_tons?: number | null;

  // Driver details
  driver_name: string;
  driver_license_no?: string | null;
  driver_contact_no?: string | null;
  helper_name?: string | null;

  // Cargo details
  cargo_description: string;
  cargo_quantity?: number | null;
  cargo_unit?: string | null;
  cargo_weight_kg?: number | null;

  checkpoints?: TripCheckpoint[];
};

// Structurally compatible with the page's Schedule type.
type ScheduleLite = {
  id: string;
  schedule_code: string;
  departure_datetime: string;
  arrival_datetime: string;
  status: string;
  routes?: {
    route_code?: string;
    route_name: string;
    origin?: string;
    destination?: string;
  } | null;
};

type Leg = { km: number | null; hrs: number | null };

type TripStats = {
  checkpoints: TripCheckpoint[];
  legs: Leg[];
  last?: TripCheckpoint;
  actualDeparture: Date | null;
  actualArrival: Date | null;
  totalKm: number | null;
  totalHrs: number | null;
  avgKph: number | null;
  currentStatus: string;
  loadPct: number | null;
};

type Row = { trip: Trip; stats: TripStats; schedule?: ScheduleLite };

type StatusFilter = "all" | "active" | "delayed" | "delivered" | "pending";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const fmtDateTime = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

function fmtDuration(hrs: number) {
  const total = Math.round(hrs * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

const normStatus = (s?: string | null) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function statusBucket(s?: string | null): Exclude<StatusFilter, "all"> | "cancelled" {
  const n = normStatus(s);
  if (n === "delivered" || n === "completed") return "delivered";
  if (n === "delayed") return "delayed";
  if (n === "departed" || n === "in_transit") return "active";
  if (n === "cancelled") return "cancelled";
  return "pending";
}

const STATUS_META: Record<string, { label: string; light: string; dark: string; bar: string; progress: number }> = {
  pending: { label: "Pending", light: "bg-gray-100 text-gray-600", dark: "bg-[#1A2530] text-[#8FA0AF]", bar: "bg-gray-400", progress: 0 },
  departed: { label: "Departed", light: "bg-[#FCE4F1] text-[#B81E6A]", dark: "bg-[#F2419B]/15 text-[#F77DBB]", bar: "bg-[#F2419B]", progress: 20 },
  in_transit: { label: "In Transit", light: "bg-[#E0F2FE] text-[#0369A1]", dark: "bg-[#38BDF8]/15 text-[#7DD3FC]", bar: "bg-[#0EA5E9]", progress: 60 },
  delayed: { label: "Delayed", light: "bg-[#FDF0DD] text-[#C9791A]", dark: "bg-[#2A2010] text-[#F2A23B]", bar: "bg-[#F2A23B]", progress: 60 },
  delivered: { label: "Delivered", light: "bg-[#E1F7EC] text-[#1FA968]", dark: "bg-[#0F2E22] text-[#3BD68A]", bar: "bg-[#1FA968]", progress: 100 },
  completed: { label: "Completed", light: "bg-[#E1F7EC] text-[#1FA968]", dark: "bg-[#0F2E22] text-[#3BD68A]", bar: "bg-[#1FA968]", progress: 100 },
  cancelled: { label: "Cancelled", light: "bg-[#FBE4E1] text-[#D9483A]", dark: "bg-[#2A1212] text-[#E2685A]", bar: "bg-[#E2685A]", progress: 0 },
};

function statusMeta(s?: string | null) {
  return STATUS_META[normStatus(s)] ?? { ...STATUS_META.pending, label: s || "Unknown" };
}

function computeTrip(t: Trip): TripStats {
  const cps = [...(t.checkpoints ?? [])].sort((a, b) => a.checkpoint_no - b.checkpoint_no);

  // Km & hours from previous checkpoint (same as the grey columns in the sheet).
  const legs: Leg[] = cps.map((cp, i) => {
    if (i === 0) return { km: null, hrs: null };
    const prev = cps[i - 1];
    const km = cp.odometer_km != null && prev.odometer_km != null ? cp.odometer_km - prev.odometer_km : null;
    const a = toDate(prev.recorded_at);
    const b = toDate(cp.recorded_at);
    const hrs = a && b ? (b.getTime() - a.getTime()) / 3_600_000 : null;
    return { km: km != null && km >= 0 ? km : null, hrs: hrs != null && hrs >= 0 ? hrs : null };
  });

  const first = cps[0];
  const last = cps[cps.length - 1];
  const delivered = cps.find((c) => statusBucket(c.status) === "delivered");
  const endCp = delivered ?? last;

  const actualDeparture = first ? toDate(first.recorded_at) : null;
  const actualArrival = delivered ? toDate(delivered.recorded_at) : null;
  const endAt = endCp ? toDate(endCp.recorded_at) : null;

  const totalKm =
    first && endCp && endCp !== first && first.odometer_km != null && endCp.odometer_km != null
      ? endCp.odometer_km - first.odometer_km
      : null;
  const totalHrs =
    actualDeparture && endAt && endCp !== first ? (endAt.getTime() - actualDeparture.getTime()) / 3_600_000 : null;
  const avgKph = totalKm != null && totalHrs != null && totalHrs > 0 ? totalKm / totalHrs : null;

  const loadPct =
    t.cargo_weight_kg != null && t.vehicle_capacity_tons
      ? (t.cargo_weight_kg / (t.vehicle_capacity_tons * 1000)) * 100
      : null;

  return {
    checkpoints: cps,
    legs,
    last,
    actualDeparture,
    actualArrival,
    totalKm,
    totalHrs,
    avgKph,
    currentStatus: last?.status ?? "pending",
    loadPct,
  };
}

/** Compares actual vs planned time. Within ±15 min counts as on time. */
function delayInfo(planned: Date | null, actual: Date | null) {
  if (!planned || !actual) return null;
  const mins = Math.round((actual.getTime() - planned.getTime()) / 60000);
  if (Math.abs(mins) <= 15) return { text: "On time", tone: "ok" as const };
  if (mins > 0) return { text: `+${fmtDuration(mins / 60)} late`, tone: "late" as const };
  return { text: `${fmtDuration(-mins / 60)} early`, tone: "early" as const };
}

/* ------------------------------------------------------------------ */
/* Column layout (grouped like the spreadsheet)                        */
/* ------------------------------------------------------------------ */

const COLUMN_GROUPS = [
  { key: "trip", label: "Trip", color: "#475569", icon: Navigation, cols: ["Trip ID"] },
  { key: "vehicle", label: "Vehicle Details", color: "#1F4E79", icon: Truck, cols: ["Plate / Type", "Make / Model", "Capacity"] },
  { key: "driver", label: "Driver Details", color: "#375623", icon: User, cols: ["Driver / License", "Contact No.", "Helper"] },
  { key: "cargo", label: "Cargo Details", color: "#7F6000", icon: Package, cols: ["Description", "Quantity", "Weight / Load"] },
  { key: "schedule", label: "Departure & Arrival", color: "#B81E6A", icon: CalendarClock, cols: ["Departure", "Arrival"] },
  { key: "metrics", label: "Time & Km", color: "#0369A1", icon: Gauge, cols: ["Distance", "Travel Time", "Avg Speed"] },
  { key: "tracking", label: "Cargo Tracking", color: "#5B21B6", icon: MapPin, cols: ["Status", "Last Checkpoint"] },
] as const;

const TOTAL_COLS = COLUMN_GROUPS.reduce((n, g) => n + g.cols.length, 0);
const TRIPS_PAGE_SIZE = 10; // trips per page, with Back / Next
const TRIP_RECENT_SEARCHES_KEY = "triplog_recent_searches";
const MAX_TRIP_RECENT_SEARCHES = 5;

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In transit" },
  { key: "delayed", label: "Delayed" },
  { key: "delivered", label: "Delivered" },
  { key: "pending", label: "Pending" },
];

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDark ? m.dark : m.light}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.bar}`} />
      {m.label}
    </span>
  );
}

function TimeCell({
  kind,
  planned,
  actual,
  isDark,
  mutedText,
}: {
  kind: "dep" | "arr";
  planned: Date | null;
  actual: Date | null;
  isDark: boolean;
  mutedText: string;
}) {
  const Icon = kind === "dep" ? ArrowUpRight : ArrowDownLeft;
  const iconColor = kind === "dep" ? "text-[#F2419B]" : "text-[#0EA5E9]";
  const delay = delayInfo(planned, actual);
  const main = planned ?? actual;
  const tone = {
    ok: isDark ? "text-[#3BD68A]" : "text-[#1FA968]",
    late: isDark ? "text-[#F2A23B]" : "text-[#C9791A]",
    early: isDark ? "text-[#7DD3FC]" : "text-[#0369A1]",
  };
  return (
    <div className="whitespace-nowrap">
      <div className={`flex items-center gap-1 font-medium ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>
        <Icon size={12} className={iconColor} />
        {main ? fmtDateTime(main) : "—"}
      </div>
      {planned && <div className={`text-[11px] ${mutedText}`}>Actual: {actual ? fmtTime(actual) : "—"}</div>}
      {!planned && actual && <div className={`text-[11px] ${mutedText}`}>No schedule linked</div>}
      {delay && <div className={`text-[11px] font-medium ${tone[delay.tone]}`}>{delay.text}</div>}
    </div>
  );
}

function LoadBar({ pct, isDark, mutedText }: { pct: number; isDark: boolean; mutedText: string }) {
  const color = pct > 100 ? "bg-[#E2685A]" : pct >= 90 ? "bg-[#F2A23B]" : "bg-[#1FA968]";
  return (
    <div className="mt-1 flex items-center justify-end gap-1.5" title="Cargo weight vs. vehicle capacity">
      <div className={`h-1.5 w-16 overflow-hidden rounded-full ${isDark ? "bg-[#23303D]" : "bg-gray-200"}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[10px] ${pct > 100 ? "font-semibold text-[#E2685A]" : mutedText}`}>{fmtNum(pct)}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function TripLogTable({
  isDark,
  mutedText,
  gridBorder,
  schedules,
  selectedDay,
  onViewSchedule,
  onTrackTrip,
  refreshKey = 0,
  endpoint = "/spnc/app/api/trips",
}: {
  isDark: boolean;
  mutedText: string;
  gridBorder: string;
  schedules: ScheduleLite[];
  selectedDay: Date;
  onViewSchedule?: (scheduleId: string) => void;
  /** Open the tracking map for a trip. If omitted, the table shows the map itself. */
  onTrackTrip?: (tripId: string) => void;
  /** Bump to make the table re-read trips (e.g. after a checkpoint is logged elsewhere). */
  refreshKey?: number;
  endpoint?: string;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search: what is typed (searchInput) vs. what is applied (search) — applied on Enter or the Search button
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TRIP_RECENT_SEARCHES_KEY) ?? "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.filter((t) => typeof t === "string").slice(0, MAX_TRIP_RECENT_SEARCHES));
    } catch {
      /* storage unavailable — recent searches just stay empty */
    }
  }, []);

  useEffect(() => {
    if (!showRecent) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowRecent(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showRecent]);

  function persistRecent(list: string[]) {
    setRecentSearches(list);
    try {
      localStorage.setItem(TRIP_RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function runSearch(term: string = searchInput) {
    const trimmed = term.trim();
    setSearchInput(term);
    setSearch(trimmed);
    setShowRecent(false);
    if (trimmed) {
      persistRecent(
        [trimmed, ...recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_TRIP_RECENT_SEARCHES)
      );
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dayOnly, setDayOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ---- Anomaly alert highlight ----
  // The dashboard's delivery alerts open /spnc/app/schedules?highlight=<trip id>&highlightName=<trip code · plate>
  const [highlightTrip, setHighlightTrip] = useState<string | null>(null);
  const pendingHighlight = useRef<{ id: string | null; code: string | null } | null>(null);
  const handledSearch = useRef<string | null>(null);
  const [urlTick, setUrlTick] = useState(0);
  // Read ?highlight=…&highlightName=… (again whenever the address changes, e.g. Next.js updates it a moment after the page shows)
  const readHighlightFromUrl = useCallback(() => {
    const search = window.location.search;
    if (!search || handledSearch.current === search) return;
    const params = new URLSearchParams(search);
    const id = params.get("highlight");
    const name = params.get("highlightName");
    if (!id && !name) return;
    handledSearch.current = search;
    pendingHighlight.current = { id, code: name ? name.split("·")[0].trim().toLowerCase() : null };
  }, []);
  useEffect(() => {
    readHighlightFromUrl();
    const onNav = () => {
      if (window.location.search && handledSearch.current !== window.location.search) setUrlTick((n) => n + 1);
    };
    window.addEventListener("popstate", onNav);
    const timer = window.setInterval(onNav, 800);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.clearInterval(timer);
    };
  }, [readHighlightFromUrl]);

  const openTracking = (id: string) => (onTrackTrip ? onTrackTrip(id) : setTrackingId(id));

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        setTrips([]);
        setError(
          res.status === 404
            ? `The trip log API (${endpoint}) isn't set up yet.`
            : `Could not load trips (HTTP ${res.status}).`
        );
        return;
      }
      const data = await res.json();
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch (err) {
      console.error("Fetch trips failed:", err);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchTrips(), 0);
    return () => window.clearTimeout(id);
  }, [fetchTrips, refreshKey]);

  const scheduleById = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const rows: Row[] = useMemo(
    () =>
      trips.map((trip) => ({
        trip,
        stats: computeTrip(trip),
        schedule: trip.schedule_id ? scheduleById.get(trip.schedule_id) : undefined,
      })),
    [trips, scheduleById]
  );

  // Once trips load: find the flagged trip, clear filters, open its checkpoints, outline it and scroll to it
  useEffect(() => {
    if (loading) return;
    readHighlightFromUrl();
    const target = pendingHighlight.current;
    if (!target || trips.length === 0) return;
    pendingHighlight.current = null;
    const trip = trips.find(
      (t) => (!!target.id && t.id === target.id) || (!!target.code && t.trip_code.trim().toLowerCase() === target.code)
    );
    if (!trip) return;
    setSearch("");
    setSearchInput("");
    setStatusFilter("all");
    setDayOnly(false);
    setExpanded((prev) => new Set(prev).add(trip.id));
    setHighlightTrip(trip.id);
    // open the page that holds the trip (filters were just cleared, so use the full list order)
    const ordered = [...rows].sort((a, b) => {
      const da = toDate(a.schedule?.departure_datetime) ?? a.stats.actualDeparture;
      const db = toDate(b.schedule?.departure_datetime) ?? b.stats.actualDeparture;
      return (da?.getTime() ?? Infinity) - (db?.getTime() ?? Infinity);
    });
    const at = ordered.findIndex((r) => r.trip.id === trip.id);
    if (at >= 0) window.setTimeout(() => setPage(Math.floor(at / TRIPS_PAGE_SIZE) + 1), 50);
    window.setTimeout(() => {
      document.getElementById(`trip-row-${trip.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, trips, urlTick]);

  function clearHighlight() {
    setHighlightTrip(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selKey = dayKey(selectedDay);

    return rows
      .filter(({ trip, stats, schedule }) => {
        if (statusFilter !== "all" && statusBucket(stats.currentStatus) !== statusFilter) return false;

        if (dayOnly) {
          const dates = [
            toDate(schedule?.departure_datetime),
            toDate(schedule?.arrival_datetime),
            ...stats.checkpoints.map((c) => toDate(c.recorded_at)),
          ].filter((d): d is Date => d !== null);
          if (!dates.some((d) => dayKey(d) === selKey)) return false;
        }

        if (!q) return true;
        const hay = [
          trip.trip_code,
          trip.vehicle_plate_no,
          trip.vehicle_type,
          trip.vehicle_make_model,
          trip.driver_name,
          trip.driver_license_no,
          trip.helper_name,
          trip.cargo_description,
          schedule?.schedule_code,
          ...stats.checkpoints.map((c) => c.location),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const da = toDate(a.schedule?.departure_datetime) ?? a.stats.actualDeparture;
        const db = toDate(b.schedule?.departure_datetime) ?? b.stats.actualDeparture;
        return (da?.getTime() ?? Infinity) - (db?.getTime() ?? Infinity);
      });
  }, [rows, search, statusFilter, dayOnly, selectedDay]);

  // 10 trips per page; filters and search start again at page 1
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / TRIPS_PAGE_SIZE));
  const pageNow = Math.min(page, pageCount);
  const pagedRows = visibleRows.slice((pageNow - 1) * TRIPS_PAGE_SIZE, pageNow * TRIPS_PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dayOnly, selectedDay]);

  const summary = useMemo(() => {
    let active = 0;
    let delayed = 0;
    let delivered = 0;
    let km = 0;
    let kg = 0;
    for (const { trip, stats } of visibleRows) {
      const b = statusBucket(stats.currentStatus);
      if (b === "active") active++;
      if (b === "delayed") delayed++;
      if (b === "delivered") delivered++;
      km += stats.totalKm ?? 0;
      kg += trip.cargo_weight_kg ?? 0;
    }
    return { active, delayed, delivered, km, kg };
  }, [visibleRows]);

  const allExpanded = pagedRows.length > 0 && pagedRows.every((r) => expanded.has(r.trip.id));

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(pagedRows.map((r) => r.trip.id)));
  }

  /* ---------- style tokens ---------- */
  const panelBg = isDark ? "bg-[#121B26]" : "bg-white";
  const baseHex = isDark ? "#121B26" : "#FFFFFF";
  const primaryText = isDark ? "text-[#F2F1EC]" : "text-gray-900";
  const bodyText = isDark ? "text-[#C7D1DA]" : "text-gray-700";
  const calcBg = isDark ? "bg-[#0E1621]" : "bg-gray-50";
  const rowHover = isDark ? "group-hover:bg-[#162130]" : "group-hover:bg-[#FDF2F8]";
  const td = `border-b px-3 py-2.5 align-top ${gridBorder}`;
  const gl = `border-l ${gridBorder}`;

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
      active
        ? "border-[#F2419B] bg-[#F2419B] text-white"
        : isDark
        ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
        : "border-gray-300 text-gray-600 hover:bg-gray-100"
    }`;

  /* ---------- render ---------- */
  return (
    <section className={`mt-4 rounded-lg border ${gridBorder} ${panelBg}`}>
      {/* Header */}
      <div className={`flex flex-wrap items-start justify-between gap-2 border-b px-3 py-2.5 ${gridBorder}`}>
        <div>
          <h3 className={`flex items-center gap-1.5 text-xs font-semibold ${primaryText}`}>
            <Truck size={14} className="text-[#F2419B]" />
            Vehicle & Cargo Trip Log
          </h3>
          <p className={`text-[11px] ${mutedText}`}>
            Vehicle, driver and cargo per trip, with departure/arrival and checkpoint tracking. Shaded cells are calculated
            automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchTrips()}
          disabled={loading}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
            isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className={`grid grid-cols-2 gap-px border-b sm:grid-cols-3 lg:grid-cols-6 ${gridBorder} ${isDark ? "bg-[#23303D]" : "bg-gray-200"}`}>
        {[
          { label: "Trips", value: fmtNum(visibleRows.length) },
          { label: "In transit", value: fmtNum(summary.active), accent: "text-[#0EA5E9]" },
          { label: "Delayed", value: fmtNum(summary.delayed), accent: "text-[#F2A23B]" },
          { label: "Delivered", value: fmtNum(summary.delivered), accent: "text-[#1FA968]" },
          { label: "Distance logged", value: `${fmtNum(summary.km)} km` },
          { label: "Cargo weight", value: `${fmtNum(summary.kg / 1000, 1)} t` },
        ].map((s) => (
          <div key={s.label} className={`px-3 py-2 ${panelBg}`}>
            <p className={`text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>{s.label}</p>
            <p className={`text-sm font-semibold ${s.accent ?? primaryText}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-2 border-b px-3 py-2 ${gridBorder}`}>
        <div ref={searchBoxRef} className="relative flex min-w-[260px] flex-1 items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={13} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${mutedText}`} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value.trim()) setSearch("");
              }}
              onFocus={() => setShowRecent(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                } else if (e.key === "Escape") {
                  setShowRecent(false);
                }
              }}
              placeholder="Search trip, plate, driver, cargo, location…"
              className={`w-full rounded-md border py-1.5 pl-8 pr-7 text-xs outline-none focus:border-[#F2419B] ${
                isDark
                  ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                  : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
              }`}
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 ${mutedText} hover:text-[#F2419B]`}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => runSearch()}
            className="inline-flex items-center gap-1 rounded-md bg-[#F2419B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d93587]"
          >
            <Search size={12} />
            Search
          </button>

          {showRecent && recentSearches.length > 0 && (
            <div
              className={`absolute left-0 top-full z-30 mt-1 w-full max-w-md overflow-hidden rounded-md border shadow-lg ${
                isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
              }`}
            >
              <div className={`flex items-center justify-between border-b px-3 py-1.5 ${isDark ? "border-[#2C4356]" : "border-gray-100"}`}>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${mutedText}`}>Recent searches</span>
                <button type="button" onClick={() => persistRecent([])} className="text-[10px] font-medium text-[#F2419B] hover:underline">
                  Clear
                </button>
              </div>
              <ul>
                {recentSearches.map((term) => (
                  <li key={term} className={`group flex items-center ${isDark ? "hover:bg-[#1A2633]" : "hover:bg-gray-50"}`}>
                    <button
                      type="button"
                      onClick={() => runSearch(term)}
                      className={`flex flex-1 items-center gap-2 px-3 py-1.5 text-left text-xs ${primaryText}`}
                    >
                      <Clock size={12} className={mutedText} />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => persistRecent(recentSearches.filter((t) => t !== term))}
                      aria-label={`Remove ${term}`}
                      className={`mr-2 rounded p-0.5 opacity-0 group-hover:opacity-100 ${mutedText} hover:text-[#F2419B]`}
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)} className={chip(statusFilter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDayOnly((v) => !v)}
          className={chip(dayOnly)}
          title="Only show trips departing, arriving or checked in on the day selected in the calendar"
        >
          {selectedDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })} only
        </button>
        <button
          type="button"
          onClick={toggleAll}
          disabled={visibleRows.length === 0}
          className={`${chip(false)} flex items-center gap-1 disabled:opacity-40`}
        >
          <ChevronsUpDown size={12} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {highlightTrip && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-xs text-[#E5484D]">
          <AlertTriangle size={13} />
          <span className="font-semibold">Anomaly alert:</span>
          <span>
            {trips.find((t) => t.id === highlightTrip)?.trip_code ?? "This trip"} is outlined in red below, with its checkpoints open.
          </span>
          <button
            type="button"
            onClick={() => openTracking(highlightTrip)}
            className="rounded bg-[#E5484D] px-2 py-0.5 font-semibold text-white hover:brightness-110"
          >
            Track on map
          </button>
          <button type="button" onClick={clearHighlight} className="ml-auto rounded px-2 py-0.5 font-semibold hover:bg-[#E5484D]/15">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <Loader2 size={22} className="animate-spin text-[#F2419B]" />
          <p className="text-xs font-semibold text-[#F2419B]">Loading trips</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
          <AlertTriangle size={18} className="text-[#E2685A]" />
          <p className="text-xs text-[#E2685A]">{error}</p>
        </div>
      ) : visibleRows.length === 0 ? (
        <p className={`px-3 py-8 text-center text-xs ${mutedText}`}>
          {trips.length === 0 ? "No trips logged yet." : "No trips match your filters."}
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              {/* Group header row */}
              <tr>
                {COLUMN_GROUPS.map((g, gi) => {
                  const Icon = g.icon;
                  return (
                    <th
                      key={g.key}
                      colSpan={g.cols.length}
                      className={`px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-white ${
                        gi > 0 ? "border-l border-white/20" : "sticky left-0 z-30"
                      }`}
                      style={{ backgroundColor: g.color }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={12} />
                        {g.label}
                      </span>
                    </th>
                  );
                })}
              </tr>
              {/* Column header row */}
              <tr>
                {COLUMN_GROUPS.flatMap((g, gi) =>
                  g.cols.map((c, ci) => (
                    <th
                      key={`${g.key}-${c}`}
                      className={`whitespace-nowrap border-b px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide ${gridBorder} ${
                        isDark ? "text-[#C7D1DA]" : "text-gray-700"
                      } ${ci === 0 && gi > 0 ? gl : ""} ${gi === 0 ? "sticky left-0 z-30" : ""}`}
                      style={{
                        backgroundColor: baseHex,
                        backgroundImage: `linear-gradient(${g.color}${isDark ? "40" : "22"}, ${g.color}${isDark ? "40" : "22"})`,
                      }}
                    >
                      {c}
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {pagedRows.map(({ trip: t, stats, schedule }) => {
                const isOpen = expanded.has(t.id);
                const plannedDep = toDate(schedule?.departure_datetime);
                const plannedArr = toDate(schedule?.arrival_datetime);
                const meta = statusMeta(stats.currentStatus);
                const lastAt = toDate(stats.last?.recorded_at);

                return (
                  <Fragment key={t.id}>
                    <tr
                      id={`trip-row-${t.id}`}
                      className={`group cursor-pointer ${bodyText} ${highlightTrip === t.id ? "bg-[#E5484D]/10" : ""}`}
                      style={highlightTrip === t.id ? { outline: "2px solid #E5484D", outlineOffset: -2 } : undefined}
                      onClick={() => toggleRow(t.id)}
                      aria-expanded={isOpen}
                    >
                      {/* Trip (sticky) */}
                      <td
                        className={`${td} sticky left-0 z-10 ${highlightTrip === t.id ? "" : panelBg} ${rowHover}`}
                        style={highlightTrip === t.id ? { background: isDark ? "#3A1A1F" : "#FDECEC", boxShadow: "inset 2px 0 0 #E5484D" } : undefined}
                      >
                        <div className="flex items-start gap-1.5">
                          <ChevronRight
                            size={14}
                            className={`mt-0.5 shrink-0 transition ${isOpen ? "rotate-90 text-[#F2419B]" : mutedText}`}
                          />
                          <div>
                            <div className="whitespace-nowrap text-sm font-semibold text-[#F2419B]">{t.trip_code}</div>
                            {schedule ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewSchedule?.(schedule.id);
                                }}
                                className={`whitespace-nowrap text-[11px] ${mutedText} hover:text-[#F2419B] hover:underline`}
                                title="View schedule"
                              >
                                {schedule.schedule_code}
                                {schedule.routes?.origin && schedule.routes?.destination
                                  ? ` · ${schedule.routes.origin} → ${schedule.routes.destination}`
                                  : ""}
                              </button>
                            ) : (
                              <div className={`text-[11px] ${mutedText}`}>No schedule</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className={`${td} ${gl} ${rowHover}`}>
                        <div className={`whitespace-nowrap font-semibold ${primaryText}`}>{t.vehicle_plate_no}</div>
                        <div className={`whitespace-nowrap text-[11px] ${mutedText}`}>{t.vehicle_type || "—"}</div>
                      </td>
                      <td className={`${td} whitespace-nowrap ${rowHover}`}>{t.vehicle_make_model || "—"}</td>
                      <td className={`${td} whitespace-nowrap text-right ${rowHover}`}>
                        {t.vehicle_capacity_tons != null ? `${fmtNum(t.vehicle_capacity_tons, 1)} t` : "—"}
                      </td>

                      {/* Driver */}
                      <td className={`${td} ${gl} ${rowHover}`}>
                        <div className={`whitespace-nowrap font-semibold ${primaryText}`}>{t.driver_name}</div>
                        <div className={`whitespace-nowrap text-[11px] ${mutedText}`}>{t.driver_license_no || "No license on file"}</div>
                      </td>
                      <td className={`${td} whitespace-nowrap ${rowHover}`}>
                        {t.driver_contact_no ? (
                          <a
                            href={`tel:${t.driver_contact_no.replace(/\s/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-[#F2419B]"
                          >
                            <Phone size={11} />
                            {t.driver_contact_no}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap ${rowHover}`}>{t.helper_name || "—"}</td>

                      {/* Cargo */}
                      <td className={`${td} ${gl} max-w-[220px] ${rowHover}`}>
                        <div className="truncate" title={t.cargo_description}>
                          {t.cargo_description}
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap text-right ${rowHover}`}>
                        {t.cargo_quantity != null ? (
                          <>
                            <span className={`font-semibold ${primaryText}`}>{fmtNum(t.cargo_quantity)}</span>{" "}
                            <span className={mutedText}>{t.cargo_unit || ""}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap ${rowHover}`}>
                        <div className="text-right">
                          {t.cargo_weight_kg != null ? `${fmtNum(t.cargo_weight_kg)} kg` : "—"}
                        </div>
                        {stats.loadPct != null && <LoadBar pct={stats.loadPct} isDark={isDark} mutedText={mutedText} />}
                      </td>

                      {/* Departure & Arrival */}
                      <td className={`${td} ${gl} ${rowHover}`}>
                        <TimeCell kind="dep" planned={plannedDep} actual={stats.actualDeparture} isDark={isDark} mutedText={mutedText} />
                      </td>
                      <td className={`${td} ${rowHover}`}>
                        <TimeCell kind="arr" planned={plannedArr} actual={stats.actualArrival} isDark={isDark} mutedText={mutedText} />
                      </td>

                      {/* Time & Km (auto-calculated) */}
                      <td className={`${td} ${gl} ${calcBg} whitespace-nowrap text-right ${rowHover}`}>
                        {stats.totalKm != null ? (
                          <span className={`font-semibold ${primaryText}`}>{fmtNum(stats.totalKm)} km</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${td} ${calcBg} whitespace-nowrap text-right ${rowHover}`}>
                        {stats.totalHrs != null ? fmtDuration(stats.totalHrs) : "—"}
                      </td>
                      <td className={`${td} ${calcBg} whitespace-nowrap text-right ${rowHover}`}>
                        {stats.avgKph != null ? `${fmtNum(stats.avgKph, 1)} km/h` : "—"}
                      </td>

                      {/* Tracking */}
                      <td className={`${td} ${gl} ${rowHover}`}>
                        <StatusBadge status={stats.currentStatus} isDark={isDark} />
                        <div className={`mt-1.5 h-1 w-20 overflow-hidden rounded-full ${isDark ? "bg-[#23303D]" : "bg-gray-200"}`}>
                          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${meta.progress}%` }} />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTracking(t.id);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[#F2419B] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-[#F55CAB]"
                          title="Open live map"
                        >
                          <MapIcon size={11} />
                          Track on map
                        </button>
                      </td>
                      <td className={`${td} ${rowHover}`}>
                        {stats.last ? (
                          <>
                            <div className={`flex items-center gap-1 whitespace-nowrap font-medium ${primaryText}`}>
                              <MapPin size={11} className="text-[#F2419B]" />
                              {stats.last.location}
                            </div>
                            <div className={`whitespace-nowrap text-[11px] ${mutedText}`}>
                              #{stats.last.checkpoint_no} of {stats.checkpoints.length}
                              {lastAt ? ` · ${fmtDateTime(lastAt)}` : ""}
                            </div>
                          </>
                        ) : (
                          <span className={mutedText}>No checkpoints yet</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded: checkpoint log */}
                    {isOpen && (
                      <tr>
                        <td colSpan={TOTAL_COLS} className={`border-b px-3 py-3 ${gridBorder} ${isDark ? "bg-[#0E1621]" : "bg-[#FAFAFB]"}`}>
                          {stats.checkpoints.length === 0 ? (
                            <p className={`text-xs ${mutedText}`}>
                              No checkpoints logged for {t.trip_code} yet.{" "}
                              <button type="button" onClick={() => openTracking(t.id)} className="font-medium text-[#F2419B] hover:underline">
                                Open the map to log the first one
                              </button>
                            </p>
                          ) : (
                            <div className="sticky left-3 max-w-[1100px] space-y-3">
                              {/* Route stepper */}
                              <ol className="flex flex-wrap items-center gap-y-2">
                                {stats.checkpoints.map((cp, i) => {
                                  const m = statusMeta(cp.status);
                                  const leg = stats.legs[i];
                                  return (
                                    <li key={cp.id ?? cp.checkpoint_no} className="flex items-center">
                                      {i > 0 && (
                                        <div className="mx-1.5 flex flex-col items-center">
                                          <span className={`text-[10px] ${mutedText}`}>
                                            {leg.km != null ? `${fmtNum(leg.km)} km` : ""}
                                            {leg.km != null && leg.hrs != null ? " · " : ""}
                                            {leg.hrs != null ? fmtDuration(leg.hrs) : ""}
                                          </span>
                                          <span className={`h-px w-14 ${isDark ? "bg-[#2C4356]" : "bg-gray-300"}`} />
                                        </div>
                                      )}
                                      <div
                                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${gridBorder} ${panelBg}`}
                                        title={cp.remarks || undefined}
                                      >
                                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${m.bar}`}>
                                          {cp.checkpoint_no}
                                        </span>
                                        <span className={`whitespace-nowrap text-[11px] font-medium ${primaryText}`}>{cp.location}</span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ol>

                              {/* Checkpoint table */}
                              <div className={`overflow-hidden rounded-md border ${gridBorder}`}>
                                <table className="w-full border-separate border-spacing-0 text-[11px]">
                                  <thead>
                                    <tr className={isDark ? "bg-[#1A2530] text-[#C7D1DA]" : "bg-gray-100 text-gray-700"}>
                                      {[
                                        "#",
                                        "Location",
                                        "Date",
                                        "Time",
                                        "Odometer (km)",
                                        "Km from prev.",
                                        "Hrs from prev.",
                                        "Status",
                                        "Updated by",
                                        "Remarks",
                                      ].map((h, i) => (
                                        <th
                                          key={h}
                                          className={`whitespace-nowrap border-b px-2.5 py-1.5 font-semibold uppercase tracking-wide ${gridBorder} ${
                                            i === 0 || (i >= 4 && i <= 6) ? "text-right" : "text-left"
                                          }`}
                                        >
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stats.checkpoints.map((cp, i) => {
                                      const at = toDate(cp.recorded_at);
                                      const leg = stats.legs[i];
                                      const cell = `border-b px-2.5 py-1.5 ${gridBorder}`;
                                      return (
                                        <tr key={cp.id ?? cp.checkpoint_no} className={bodyText}>
                                          <td className={`${cell} text-right font-semibold`}>{cp.checkpoint_no}</td>
                                          <td className={`${cell} font-medium ${primaryText}`}>{cp.location}</td>
                                          <td className={`${cell} whitespace-nowrap`}>{at ? fmtDate(at) : "—"}</td>
                                          <td className={`${cell} whitespace-nowrap`}>{at ? fmtTime(at) : "—"}</td>
                                          <td className={`${cell} text-right`}>{cp.odometer_km != null ? fmtNum(cp.odometer_km) : "—"}</td>
                                          <td className={`${cell} ${calcBg} text-right`}>{leg.km != null ? fmtNum(leg.km) : ""}</td>
                                          <td className={`${cell} ${calcBg} text-right`}>{leg.hrs != null ? fmtNum(leg.hrs, 1) : ""}</td>
                                          <td className={cell}>
                                            <StatusBadge status={cp.status} isDark={isDark} />
                                          </td>
                                          <td className={`${cell} whitespace-nowrap`}>{cp.updated_by || "—"}</td>
                                          <td className={`${cell} ${mutedText}`}>{cp.remarks || ""}</td>
                                        </tr>
                                      );
                                    })}
                                    <tr className={`font-semibold ${primaryText}`}>
                                      <td colSpan={5} className="px-2.5 py-1.5 text-right">
                                        Trip total
                                      </td>
                                      <td className={`${calcBg} px-2.5 py-1.5 text-right`}>
                                        {stats.totalKm != null ? fmtNum(stats.totalKm) : "—"}
                                      </td>
                                      <td className={`${calcBg} px-2.5 py-1.5 text-right`}>
                                        {stats.totalHrs != null ? fmtNum(stats.totalHrs, 1) : "—"}
                                      </td>
                                      <td colSpan={3} className={`px-2.5 py-1.5 ${mutedText}`}>
                                        {stats.avgKph != null ? `Avg ${fmtNum(stats.avgKph, 1)} km/h` : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && visibleRows.length > TRIPS_PAGE_SIZE && (
        <div className={`flex items-center justify-center gap-4 border-t px-3 py-2.5 ${gridBorder}`}>
          <button
            type="button"
            onClick={() => setPage(Math.max(1, pageNow - 1))}
            disabled={pageNow === 1}
            className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <span className={`text-xs ${mutedText}`}>
            Page {pageNow} of {pageCount} · {visibleRows.length} trips
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, pageNow + 1))}
            disabled={pageNow === pageCount}
            className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className={`flex flex-wrap items-center gap-3 border-t px-3 py-2 text-[11px] ${gridBorder} ${mutedText}`}>
        <span className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm border ${gridBorder} ${calcBg}`} /> Auto-calculated
        </span>
        <span>Load % = cargo weight ÷ vehicle capacity</span>
        <span>On time = within 15 min of schedule</span>
        <span>Click a row to see its checkpoints</span>
        <span>“Track on map” shows the live route</span>
      </div>

      {trackingId && (
        <TripTrackingModal
          tripId={trackingId}
          isDark={isDark}
          onClose={() => setTrackingId(null)}
          onChanged={() => void fetchTrips()}
        />
      )}
    </section>
  );
}