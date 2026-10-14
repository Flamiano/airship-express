"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Pencil,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Search,
  Truck,
  Map as MapIcon,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import TripLogTable from "../../components/Triplogtable";
import TripTrackingModal from "../../components/TripTrackingModal";
import SpncAssistant from "../../components/SpncAssistant";

const FREQUENCY_OPTIONS = ["daily", "weekly", "bi_weekly", "monthly", "on_demand"];
const UNIT_OPTIONS = ["kg", "container", "pallet", "teu"];
const STATUS_OPTIONS = ["scheduled", "delayed", "cancelled", "completed"];
const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_CELL = 3;
const DAY_RECENT_SEARCHES_KEY = "schedules_day_recent_searches";
const MAX_DAY_RECENT_SEARCHES = 5;
const DAY_LIST_PAGE_SIZE = 10; // schedules + trips shown per page in the selected-day list, with Back / Next

type RouteItem = {
  id: string;
  route_code?: string;
  route_name: string;
  origin?: string;
  destination?: string;
  mode_of_transport?: string;
  service_provider_id?: string | null;
  service_providers?: { name: string } | null;
};

type Schedule = {
  id: string;
  schedule_code: string;
  route_id: string;
  routes?: {
    route_code?: string;
    route_name: string;
    origin?: string;
    destination?: string;
    mode_of_transport?: string;
  } | null;
  service_provider_id?: string | null;
  service_providers?: { name: string } | null;
  departure_datetime: string;
  arrival_datetime: string;
  frequency: string;
  day_of_week?: string;
  capacity?: number | null;
  unit_type: string;
  cutoff_hours: number;
  status: string;
  notes?: string;
};

type CalendarEvent = {
  key: string;
  kind: "departure" | "arrival";
  at: Date;
  schedule: Schedule;
};

// ---- Trips (actual movements, from /api/trips) ----
type TripCheckpoint = {
  id: string;
  checkpoint_no: number;
  location: string;
  recorded_at: string;
  status: string;
};

type TripLite = {
  id: string;
  trip_code: string;
  schedule_id: string | null;
  vehicle_plate_no: string;
  driver_name?: string;
  checkpoints: TripCheckpoint[];
};

// A trip shows up on the calendar twice at most: when it departed (first checkpoint)
// and when it was delivered (last checkpoint, only if its status is "delivered").
type TripEvent = {
  key: string;
  kind: "departure" | "arrival";
  at: Date;
  trip: TripLite;
  checkpoint: TripCheckpoint;
};

const emptyForm = {
  schedule_code: "",
  route_id: null as string | null,
  service_provider_id: null as string | null,
  departure_datetime: "",
  arrival_datetime: "",
  frequency: [] as string[],
  day_of_week: [] as string[],
  capacity: "",
  unit_type: [] as string[],
  cutoff_hours: "24",
  status: "scheduled",
  notes: "",
};

const pad = (n: number) => String(n).padStart(2, "0");

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Local-date key, so events land on the day the user sees in their own timezone.
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}

function monthLabel(d: Date, withYear = true) {
  return d.toLocaleDateString(undefined, withYear ? { month: "long", year: "numeric" } : { month: "long" });
}

// "bi_weekly, on_demand" -> "bi weekly, on demand"
function formatFrequency(value: string) {
  return (value || "").replace(/_/g, " ");
}

// Weeks of the month, Monday first. Days outside the month are null (blank cells).
function buildMonthGrid(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Mon=0 … Sun=6

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function routeCodeLabel(r: RouteItem) {
  return r.route_code || r.route_name;
}

function routeAddress(r: RouteItem) {
  if (r.origin && r.destination) return `${r.origin} → ${r.destination}`;
  return null;
}

function scheduleRouteLabel(r: Schedule["routes"], fallbackId: string) {
  if (!r) return fallbackId;
  if (r.route_code) return r.route_code;
  if (r.origin && r.destination) {
    return `${r.origin} → ${r.destination}${r.mode_of_transport ? ` (${r.mode_of_transport})` : ""}`;
  }
  return r.route_name;
}

/* ---------- Deliveries from Route Planning ----------
 * The Service Network & Route Planning page adds every planned delivery to public.schedules automatically
 * (schedule codes "SCH-SHP-…"). This page reloads schedules every LIVE_REFRESH_MS, when the tab is focused,
 * and immediately when Route Planning announces a change on the "spnc-schedules" channel, so those
 * deliveries land on the calendar by themselves.
 */
const LIVE_REFRESH_MS = 15_000;
const SCHEDULES_CHANNEL = "spnc-schedules";

const isFromRoutePlanning = (s: Pick<Schedule, "schedule_code" | "notes">) =>
  (s.schedule_code || "").toUpperCase().startsWith("SCH-SHP-") || (s.notes || "").startsWith("From Route Planning");

// Route text for a schedule: the linked route, or (for Route Planning deliveries without a route yet) the path in the notes
function scheduleLabel(s: Schedule) {
  if (s.routes) return scheduleRouteLabel(s.routes, s.route_id);
  const fromNotes = (s.notes || "").split("\n").find((l) => l.startsWith("Route: "));
  if (fromNotes) return fromNotes.replace(/^Route:\s*/, "").replace(/\s*·\s*[\d.,]+\s*km$/, "");
  return s.route_id ? s.route_id : "No route linked";
}

/* ---------- Upcoming / On-going / Delivered (same tabs as the Route Planning page) ----------
 * Worked out from the times, so it is always current:
 *   Upcoming  = departure still ahead
 *   On-going  = departed, not arrived yet
 *   Delivered = arrival time passed, or the schedule is marked completed
 */
type DayTab = "upcoming" | "ongoing" | "delivered";
const DAY_TABS: { key: DayTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming deliveries" },
  { key: "ongoing", label: "On-going deliveries" },
  { key: "delivered", label: "Delivered" },
];

function schedulePhase(s: Pick<Schedule, "status" | "departure_datetime" | "arrival_datetime">, now: number): DayTab {
  if ((s.status || "").toLowerCase() === "completed") return "delivered";
  const dep = new Date(s.departure_datetime).getTime();
  const arr = new Date(s.arrival_datetime).getTime();
  if (Number.isFinite(arr) && now >= arr) return "delivered";
  if (Number.isFinite(dep) && now >= dep) return "ongoing";
  return "upcoming";
}

function tripPhase(ev: { checkpoint: { status: string } }): DayTab {
  const st = (ev.checkpoint.status || "").toLowerCase();
  return st === "delivered" || st === "completed" ? "delivered" : "ongoing";
}

function routeAddressLine(r: Schedule["routes"]) {
  if (!r) return null;
  if (r.origin && r.destination) return `${r.origin} → ${r.destination}`;
  return null;
}

// Generic comma-separated-string <-> string[] parser, used by every multi-select field.
function parseList(value: string): string[] {
  return value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

// Shared multi-select dropdown used for Frequency, Day of Week and Unit Type.
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  formatOption,
  isDark,
  mutedText,
  error,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  formatOption?: (opt: string) => string;
  isDark: boolean;
  mutedText: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Defensive: if a caller ever passes a plain string (legacy single-value code path)
  // instead of an array, normalize it here rather than crashing the render.
  const selectedArr: string[] = Array.isArray(selected) ? selected : selected ? [selected as unknown as string] : [];

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  function toggleOption(opt: string) {
    const next = selectedArr.includes(opt) ? selectedArr.filter((o) => o !== opt) : [...selectedArr, opt];
    onChange(next);
  }

  const display = (opt: string) => (formatOption ? formatOption(opt) : opt);

  return (
    <div className="relative" ref={ref}>
      <p className={`mb-1.5 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>{label}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full flex-wrap items-center gap-1 rounded-md border px-2.5 py-2 text-left text-sm outline-none ${
          error ? "border-[#E2685A]" : isDark ? "border-[#2C4356]" : "border-gray-300"
        } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
      >
        {selectedArr.length === 0 ? (
          <span className={mutedText}>Select…</span>
        ) : (
          selectedArr.map((s) => (
            <span
              key={s}
              className="rounded-full bg-[#F2419B]/15 px-2 py-0.5 text-xs font-medium capitalize text-[#F2419B]"
            >
              {display(s)}
            </span>
          ))
        )}
        <ChevronDown size={15} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""} ${mutedText}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-lg border py-1 shadow-xl ${
            isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
          }`}
        >
          {options.map((opt) => {
            const isSelected = selectedArr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleOption(opt)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm capitalize transition ${
                  isSelected
                    ? isDark
                      ? "bg-[#F2419B]/15 text-[#F2419B]"
                      : "bg-[#FCE4F1] text-[#F2419B]"
                    : isDark
                    ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {display(opt)}
                {isSelected && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Single-select dropdown used for Status — same look as the multi-select fields, but only one value at a time.
function SingleSelectDropdown({
  label,
  options,
  selected,
  onChange,
  formatOption,
  isDark,
  mutedText,
  error,
}: {
  label: string;
  options: string[];
  selected: string;
  onChange: (next: string) => void;
  formatOption?: (opt: string) => string;
  isDark: boolean;
  mutedText: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  function selectOption(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  const display = (opt: string) => (formatOption ? formatOption(opt) : opt);

  return (
    <div className="relative" ref={ref}>
      <p className={`mb-1.5 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>{label}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-1 rounded-md border px-2.5 py-2 text-left text-sm outline-none ${
          error ? "border-[#E2685A]" : isDark ? "border-[#2C4356]" : "border-gray-300"
        } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
      >
        {selected ? (
          <span className="rounded-full bg-[#F2419B]/15 px-2 py-0.5 text-xs font-medium capitalize text-[#F2419B]">
            {display(selected)}
          </span>
        ) : (
          <span className={mutedText}>Select…</span>
        )}
        <ChevronDown size={15} className={`ml-auto shrink-0 transition ${open ? "rotate-180" : ""} ${mutedText}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-lg border py-1 shadow-xl ${
            isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
          }`}
        >
          {options.map((opt) => {
            const isSelected = selected === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(opt)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm capitalize transition ${
                  isSelected
                    ? isDark
                      ? "bg-[#F2419B]/15 text-[#F2419B]"
                      : "bg-[#FCE4F1] text-[#F2419B]"
                    : isDark
                    ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {display(opt)}
                {isSelected && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Trip details shown in the Edit Schedule form (data from trips + trip_overview) ----
type TripRow = Record<string, unknown> & { id: string; trip_code?: string };
type TripOverview = Record<string, unknown> | null;
type LinkedTrip = { trip: TripRow; overview: TripOverview };

// Fields only appear if that column exists on your trips table.
const TRIP_FIELDS: { group: string; key: string; label: string; type?: "number"; placeholder?: string }[] = [
  { group: "Vehicle", key: "vehicle_plate_no", label: "Plate No.", placeholder: "NBC 1234" },
  { group: "Vehicle", key: "vehicle_type", label: "Type", placeholder: "10-Wheeler Truck" },
  { group: "Vehicle", key: "vehicle_make_model", label: "Make / Model", placeholder: "Isuzu Giga" },
  { group: "Vehicle", key: "vehicle_capacity_tons", label: "Capacity (t)", type: "number", placeholder: "12" },
  { group: "Driver", key: "driver_name", label: "Driver", placeholder: "Juan Dela Cruz" },
  { group: "Driver", key: "driver_license_no", label: "License No.", placeholder: "N01-12-345678" },
  { group: "Driver", key: "driver_contact_no", label: "Contact No.", placeholder: "0917 123 4567" },
  { group: "Driver", key: "helper_name", label: "Helper", placeholder: "Pedro Santos" },
  { group: "Cargo", key: "cargo_description", label: "Description", placeholder: "Canned goods (palletized)" },
  { group: "Cargo", key: "cargo_quantity", label: "Quantity", type: "number", placeholder: "20" },
  { group: "Cargo", key: "cargo_unit", label: "Unit", placeholder: "pallets" },
  { group: "Cargo", key: "cargo_weight_kg", label: "Weight (kg)", type: "number", placeholder: "9500" },
];

const tripValue = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function SchedulesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [trips, setTrips] = useState<TripLite[]>([]);
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);
  const [tripLogKey, setTripLogKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  // Live link with Route Planning
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // ---- Anomaly alert highlight ----
  // Alerts open /spnc/app/schedules?highlight=<trip or schedule id>&highlightName=<"TRP-0102 · NBC 1234">&field=…
  // The calendar jumps to that day and outlines the trip (and its schedule) in red; the trip log below does the same.
  const [hlTripId, setHlTripId] = useState<string | null>(null);
  const [hlScheduleId, setHlScheduleId] = useState<string | null>(null);
  const [dayPage, setDayPage] = useState(1); // page of the selected-day list
  const [dayTab, setDayTab] = useState<DayTab>("upcoming");
  // Search of the selected-day list (same behaviour as the Rates search):
  // type, then press Enter or the pink button; recent searches show when the box is focused.
  const [daySearch, setDaySearch] = useState(""); // the search applied to the list
  const [daySearchInput, setDaySearchInput] = useState(""); // what's typed in the box
  const [dayRecent, setDayRecent] = useState<string[]>([]);
  const [showDayRecent, setShowDayRecent] = useState(false);
  const daySearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DAY_RECENT_SEARCHES_KEY);
      if (stored) setDayRecent(JSON.parse(stored));
    } catch {
      // ignore unavailable/corrupt storage
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (daySearchRef.current && !daySearchRef.current.contains(e.target as Node)) setShowDayRecent(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function persistDayRecent(next: string[]) {
    setDayRecent(next);
    try {
      window.localStorage.setItem(DAY_RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function runDaySearch(term: string = daySearchInput) {
    const trimmed = term.trim();
    setDaySearchInput(term);
    setDaySearch(trimmed);
    setShowDayRecent(false);
    if (trimmed) {
      persistDayRecent(
        [trimmed, ...dayRecent.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_DAY_RECENT_SEARCHES)
      );
    }
  }

  function clearDaySearch() {
    setDaySearchInput("");
    setDaySearch("");
  }
  const [nowTick, setNowTick] = useState(() => Date.now()); // moves deliveries between tabs as time passes
  const [hlLabel, setHlLabel] = useState<string | null>(null);
  const [hlMissing, setHlMissing] = useState<string | null>(null);
  const handledSearch = useRef<string | null>(null);
  const [urlTick, setUrlTick] = useState(0);

  // Calendar state
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayPanelRef = useRef<HTMLDivElement>(null);

  // Month/year picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => today.getFullYear());
  // What's typed in the year box; only applied on Enter / blur so it can be cleared while typing.
  const [yearDraft, setYearDraft] = useState(() => String(today.getFullYear()));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setYearDraft(String(pickerYear)), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pickerYear]);

  function commitYearDraft() {
    const y = Number(yearDraft.trim());
    if (Number.isInteger(y) && y >= 1000 && y <= 9999) {
      setPickerYear(y);
    } else {
      setYearDraft(String(pickerYear)); // invalid → revert
    }
  }
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [pickerOpen]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Linked trip(s) for the schedule being edited
  const [linkedTrips, setLinkedTrips] = useState<LinkedTrip[]>([]);
  const [activeTripIdx, setActiveTripIdx] = useState(0);
  const [tripForm, setTripForm] = useState<Record<string, string>>({});
  const [tripLoading, setTripLoading] = useState(false);
  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);


  const [form, setForm] = useState(emptyForm);

  // Searchable Route dropdown (custom, since we need a search box + rich labels)
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");
  const routeMenuRef = useRef<HTMLDivElement>(null);
  const routeSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!routeMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (routeMenuRef.current && !routeMenuRef.current.contains(e.target as Node)) setRouteMenuOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setRouteMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    const focusTimeout = window.setTimeout(() => routeSearchInputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      window.clearTimeout(focusTimeout);
    };
  }, [routeMenuOpen]);

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const haystack = [routeCodeLabel(r), r.route_name, r.origin, r.destination, r.service_providers?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [routes, routeSearch]);

  function statusColor(s: string) {
    switch (s) {
      case "completed":
        return isDark ? { bg: "bg-[#0F2E22]", text: "text-[#3BD68A]" } : { bg: "bg-[#E1F7EC]", text: "text-[#1FA968]" };
      case "delayed":
        return isDark ? { bg: "bg-[#2A2010]", text: "text-[#F2A23B]" } : { bg: "bg-[#FDF0DD]", text: "text-[#C9791A]" };
      case "cancelled":
        return isDark ? { bg: "bg-[#2A1212]", text: "text-[#E2685A]" } : { bg: "bg-[#FBE4E1]", text: "text-[#D9483A]" };
      default:
        return isDark ? { bg: "bg-[#0F1F2E]", text: "text-[#38BDF8]" } : { bg: "bg-[#FCE4F1]", text: "text-[#D9297E]" };
    }
  }

  // Departure = pink, Arrival = sky blue
  function eventColor(kind: CalendarEvent["kind"]) {
    if (kind === "departure") {
      return isDark
        ? "bg-[#F2419B]/15 text-[#F77DBB] border-l-[#F2419B]"
        : "bg-[#FCE4F1] text-[#B81E6A] border-l-[#F2419B]";
    }
    return isDark
      ? "bg-[#38BDF8]/15 text-[#7DD3FC] border-l-[#38BDF8]"
      : "bg-[#E0F2FE] text-[#0369A1] border-l-[#0EA5E9]";
  }

  // Actual trip movements are green, so they read differently from the planned schedule events.
  const tripEventColor = isDark
    ? "bg-[#10B981]/15 text-[#6EE7B7] border-l-[#10B981]"
    : "bg-[#D1FAE5] text-[#047857] border-l-[#10B981]";

  // silent = background refresh (no spinner, the calendar stays where it is)
  async function fetchSchedules(silent = false) {
    if (silent) setLiveRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/spnc/app/api/schedules", { cache: "no-store" });
      const data = await res.json();
      setSchedules(data.schedules || []);
      setLastSynced(new Date());
    } catch (err) {
      console.error("Fetch schedules failed:", err);
    } finally {
      if (silent) setLiveRefreshing(false);
      else setLoading(false);
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/spnc/app/api/routes", { cache: "no-store" });
      const data = await res.json();
      setRoutes(data.routes || []);
    } catch {
      // non-fatal
    }
  }

  async function fetchTrips() {
    try {
      const res = await fetch("/spnc/app/api/trips", { cache: "no-store" });
      const data = await res.json();
      setTrips(data.trips || []);
    } catch {
      // non-fatal: the calendar just won't show trip events
    } finally {
      setTripsLoaded(true);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([fetchSchedules(), fetchRoutes(), fetchTrips()]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // The trip log manages its own data, so re-read trips when the tab regains focus
  // to keep the calendar in step with checkpoints logged elsewhere.
  useEffect(() => {
    function handleFocus() {
      void fetchTrips();
      if (!modalOpen) void fetchSchedules(true);
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // Live: deliveries planned in Route Planning appear on the calendar automatically.
  // Paused while the schedule form is open so nothing changes under you.
  useEffect(() => {
    if (modalOpen) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void fetchSchedules(true);
    };
    const timer = window.setInterval(refresh, LIVE_REFRESH_MS);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SCHEDULES_CHANNEL);
      channel.onmessage = () => void fetchSchedules(true);
    } catch {
      // BroadcastChannel not available: the timer still refreshes
    }
    return () => {
      window.clearInterval(timer);
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  const filteredSchedules = schedules;

  // New day selected → first page of its list
  useEffect(() => {
    setDayPage(1);
  }, [selectedDay]);

  // ---- Anomaly alert highlight: find the trip / schedule, jump the calendar to its day ----
  useEffect(() => {
    if (loading || !tripsLoaded) return;
    const search = window.location.search;
    if (!search || handledSearch.current === search) return;
    const params = new URLSearchParams(search);
    const id = params.get("highlight");
    const name = params.get("highlightName");
    if (!id && !name) return;
    handledSearch.current = search;

    const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
    const parts = norm(name).split(/\s*[·|]\s*/).filter(Boolean); // "TRP-0102 · NBC 1234" → trip code, plate
    const trip =
      trips.find((t) => !!id && t.id === id) ??
      trips.find((t) => parts.includes(norm(t.trip_code))) ??
      trips.find((t) => parts.length > 1 && parts.includes(norm(t.vehicle_plate_no)));
    const schedule =
      schedules.find((s) => !!id && s.id === id) ??
      (trip?.schedule_id ? schedules.find((s) => s.id === trip.schedule_id) : undefined) ??
      schedules.find((s) => parts.includes(norm(s.schedule_code)));

    if (!trip && !schedule) {
      console.warn("[Schedules] Anomaly alert: trip/schedule not found", { id, name });
      setHlMissing(name || id || "the trip");
      return;
    }
    setHlMissing(null);
    setHlTripId(trip?.id ?? null);
    setHlScheduleId(schedule?.id ?? null);
    setHlLabel(trip ? `${trip.trip_code}${trip.vehicle_plate_no ? ` · ${trip.vehicle_plate_no}` : ""}` : schedule?.schedule_code ?? null);

    // Which day to show: the trip's latest checkpoint, else the schedule's arrival (when it was due), else departure
    const cps = [...(trip?.checkpoints || [])].sort((a, b) => a.checkpoint_no - b.checkpoint_no);
    const candidates = [cps[cps.length - 1]?.recorded_at, schedule?.arrival_datetime, schedule?.departure_datetime];
    const when = candidates.map((v) => (v ? new Date(v) : null)).find((d) => d && !Number.isNaN(d.getTime()));
    if (when) {
      setViewMonth(new Date(when.getFullYear(), when.getMonth(), 1));
      setSelectedDay(new Date(when.getFullYear(), when.getMonth(), when.getDate()));
    }
    window.setTimeout(() => dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tripsLoaded, trips, schedules, urlTick]);

  // Also react when the address changes while you're already on this page
  useEffect(() => {
    const onNav = () => {
      if (window.location.search && handledSearch.current !== window.location.search) setUrlTick((n) => n + 1);
    };
    window.addEventListener("popstate", onNav);
    const timer = window.setInterval(onNav, 800);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.clearInterval(timer);
    };
  }, []);

  function clearScheduleHighlight() {
    setHlTripId(null);
    setHlScheduleId(null);
    setHlLabel(null);
    setHlMissing(null);
  }

  // Red outline for highlighted calendar items (inline so it always shows)
  const hlItemStyle = { outline: "2px solid #E5484D", outlineOffset: 1, background: "rgba(229, 72, 77, 0.15)" } as const;
  const hlRowStyle = { outline: "2px solid #E5484D", outlineOffset: -2, background: "rgba(229, 72, 77, 0.08)" } as const;

  // Every schedule becomes two calendar events: one on its departure day, one on its arrival day.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const add = (ev: CalendarEvent) => {
      const k = dayKey(ev.at);
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    };
    for (const s of filteredSchedules) {
      const dep = new Date(s.departure_datetime);
      const arr = new Date(s.arrival_datetime);
      if (!Number.isNaN(dep.getTime())) add({ key: `${s.id}-dep`, kind: "departure", at: dep, schedule: s });
      if (!Number.isNaN(arr.getTime())) add({ key: `${s.id}-arr`, kind: "arrival", at: arr, schedule: s });
    }
    for (const list of map.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules]);

  // Trips become events from their own checkpoints, so they show up whether or not
  // they are linked to a schedule: first checkpoint = departed, delivered checkpoint = arrived.
  const tripEventsByDay = useMemo(() => {
    const map = new Map<string, TripEvent[]>();
    const add = (ev: TripEvent) => {
      const k = dayKey(ev.at);
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    };
    for (const t of trips) {
      const cps = [...(t.checkpoints || [])].sort((a, b) => a.checkpoint_no - b.checkpoint_no);
      if (cps.length === 0) continue;

      const first = cps[0];
      const dep = new Date(first.recorded_at);
      if (!Number.isNaN(dep.getTime())) {
        add({ key: `${t.id}-dep`, kind: "departure", at: dep, trip: t, checkpoint: first });
      }

      const last = cps[cps.length - 1];
      const arr = new Date(last.recorded_at);
      if (last.status === "delivered" && !Number.isNaN(arr.getTime())) {
        add({ key: `${t.id}-arr`, kind: "arrival", at: arr, trip: t, checkpoint: last });
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());
    return map;
  }, [trips]);

  const weeks = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);

  const monthCounts = useMemo(() => {
    let departures = 0;
    let arrivals = 0;
    const prefix = `${viewMonth.getFullYear()}-${pad(viewMonth.getMonth() + 1)}-`;
    for (const [k, list] of eventsByDay) {
      if (!k.startsWith(prefix)) continue;
      for (const ev of list) {
        if (ev.kind === "departure") departures++;
        else arrivals++;
      }
    }
    for (const [k, list] of tripEventsByDay) {
      if (!k.startsWith(prefix)) continue;
      for (const ev of list) {
        if (ev.kind === "departure") departures++;
        else arrivals++;
      }
    }
    return { departures, arrivals };
  }, [eventsByDay, tripEventsByDay, viewMonth]);

  // Search: code, route, provider, vehicle, cargo, notes, status — and for trips: trip code, plate, driver, location
  const dayQuery = daySearch.trim().toLowerCase();
  const matches = (...parts: (string | null | undefined)[]) =>
    !dayQuery || parts.filter(Boolean).join(" ").toLowerCase().includes(dayQuery);
  // Each schedule's Departs row comes first, its Arrives row right under it.
  // Schedules are ordered by departure time (then code), so the same code always stays together.
  const allDaySchedEvents = [...(eventsByDay.get(dayKey(selectedDay)) || [])].sort((a, b) => {
    const da = new Date(a.schedule.departure_datetime).getTime();
    const db = new Date(b.schedule.departure_datetime).getTime();
    if (da !== db) return da - db;
    const byCode = (a.schedule.schedule_code || "").localeCompare(b.schedule.schedule_code || "");
    if (byCode !== 0) return byCode;
    if (a.schedule.id !== b.schedule.id) return a.schedule.id.localeCompare(b.schedule.id);
    return a.kind === b.kind ? 0 : a.kind === "departure" ? -1 : 1;
  });
  const allDayTripEvents = tripEventsByDay.get(dayKey(selectedDay)) || [];
  const daySchedEvents = allDaySchedEvents.filter(({ schedule: sc }) =>
    matches(
      sc.schedule_code,
      scheduleLabel(sc),
      routeAddressLine(sc.routes),
      sc.service_providers?.name,
      sc.status,
      sc.frequency,
      sc.notes,
      (sc as Schedule & { vehicle?: string | null }).vehicle,
      (sc as Schedule & { cargo_details?: string | null }).cargo_details
    )
  );
  const dayTripEvents = allDayTripEvents.filter(({ trip: t, checkpoint: cp }) =>
    matches(t.trip_code, t.vehicle_plate_no, t.driver_name, cp.location, cp.status)
  );
  const dayTotal = daySchedEvents.length + dayTripEvents.length;
  const tabCount = (tab: DayTab) =>
    daySchedEvents.filter((ev) => schedulePhase(ev.schedule, nowTick) === tab).length +
    dayTripEvents.filter((ev) => tripPhase(ev) === tab).length;
  const tabCounts: Record<DayTab, number> = { upcoming: tabCount("upcoming"), ongoing: tabCount("ongoing"), delivered: tabCount("delivered") };

  // the list shows the open tab only
  const selectedEvents = daySchedEvents.filter((ev) => schedulePhase(ev.schedule, nowTick) === dayTab);
  const selectedTripEvents = dayTripEvents.filter((ev) => tripPhase(ev) === dayTab);
  const selectedTotal = selectedEvents.length + selectedTripEvents.length;

  // 10 per page: schedule events first, then trip events, split across pages in that order
  const dayPages = Math.max(1, Math.ceil(selectedTotal / DAY_LIST_PAGE_SIZE));
  const dayPageNow = Math.min(dayPage, dayPages);
  const pageStart = (dayPageNow - 1) * DAY_LIST_PAGE_SIZE;
  const pageEnd = pageStart + DAY_LIST_PAGE_SIZE;
  const pagedSelectedEvents = selectedEvents.slice(pageStart, pageEnd);
  const pagedSelectedTripEvents = selectedTripEvents.slice(
    Math.max(0, pageStart - selectedEvents.length),
    Math.max(0, pageEnd - selectedEvents.length)
  );

  // Anomaly highlight: open the page that holds the highlighted schedule / trip
  useEffect(() => {
    const i = hlScheduleId ? selectedEvents.findIndex((ev) => ev.schedule.id === hlScheduleId) : -1;
    const j = i < 0 && hlTripId ? selectedTripEvents.findIndex((ev) => ev.trip.id === hlTripId) : -1;
    const idx = i >= 0 ? i : j >= 0 ? selectedEvents.length + j : -1;
    if (idx >= 0) setDayPage(Math.floor(idx / DAY_LIST_PAGE_SIZE) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlScheduleId, hlTripId, selectedTotal]);
  const selectedDepartures =
    daySchedEvents.filter((e) => e.kind === "departure").length + dayTripEvents.filter((e) => e.kind === "departure").length;
  const selectedArrivals =
    daySchedEvents.filter((e) => e.kind === "arrival").length + dayTripEvents.filter((e) => e.kind === "arrival").length;

  // Tick every 30 s so deliveries move from Upcoming → On-going → Delivered on their own
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setDayPage(1);
  }, [daySearch]);

  // New day: open the first tab that has something (Upcoming → On-going → Delivered)
  useEffect(() => {
    const first = DAY_TABS.find((t) => tabCounts[t.key] > 0);
    setDayTab(first ? first.key : "upcoming");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Anomaly highlight: open the tab of the highlighted schedule / trip
  useEffect(() => {
    const ev = hlScheduleId ? daySchedEvents.find((e) => e.schedule.id === hlScheduleId) : undefined;
    if (ev) return setDayTab(schedulePhase(ev.schedule, Date.now()));
    const tev = hlTripId ? dayTripEvents.find((e) => e.trip.id === hlTripId) : undefined;
    if (tev) setDayTab(tripPhase(tev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlScheduleId, hlTripId, dayTotal]);

  // "YYYY-MM" keys of months that have at least one departure or arrival.
  const monthsWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const k of eventsByDay.keys()) set.add(k.slice(0, 7));
    for (const k of tripEventsByDay.keys()) set.add(k.slice(0, 7));
    return set;
  }, [eventsByDay, tripEventsByDay]);

  function openPicker() {
    setPickerYear(viewMonth.getFullYear());
    setPickerOpen((o) => !o);
  }

  function pickMonth(monthIndex: number) {
    goToMonth(new Date(pickerYear, monthIndex, 1));
    setPickerOpen(false);
  }

  function goToMonth(d: Date) {
    const nextMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const selectedDate = Math.min(selectedDay.getDate(), daysInNextMonth);
    setViewMonth(nextMonth);
    setSelectedDay(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), selectedDate));
  }

  function goToToday() {
    const t = new Date();
    goToMonth(t);
    setSelectedDay(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
  }

  function selectDay(d: Date, scroll = false) {
    setSelectedDay(d);
    if (scroll) {
      setTimeout(() => dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
    setRouteSearch("");
    setRouteMenuOpen(false);
  }

  function openEditModal(s: Schedule) {
    setEditingId(s.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setRouteSearch("");
    setForm({
      schedule_code: s.schedule_code,
      route_id: s.route_id,
      service_provider_id: s.service_provider_id || null,
      departure_datetime: toDatetimeLocalValue(s.departure_datetime),
      arrival_datetime: toDatetimeLocalValue(s.arrival_datetime),
      frequency: parseList(s.frequency || ""),
      day_of_week: parseList(s.day_of_week || ""),
      capacity: s.capacity != null ? String(s.capacity) : "",
      unit_type: parseList(s.unit_type || ""),
      cutoff_hours: String(s.cutoff_hours ?? 24),
      status: s.status || "scheduled",
      notes: s.notes || "",
    });
    setModalOpen(true);
    void loadLinkedTrips(s.id);
  }

  function tripToForm(t: TripRow) {
    const f: Record<string, string> = {};
    for (const fd of TRIP_FIELDS) if (fd.key in t) f[fd.key] = tripValue(t[fd.key]);
    return f;
  }

  async function loadLinkedTrips(scheduleId: string) {
    setLinkedTrips([]);
    setTripForm({});
    setActiveTripIdx(0);
    setTripLoadError(null);
    setTripLoading(true);
    try {
      const res = await fetch(`/spnc/app/api/schedules/${scheduleId}/trip`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTripLoadError(data.message || "Couldn't load the trip for this schedule.");
        return;
      }
      const list: LinkedTrip[] = data.trips ?? [];
      setLinkedTrips(list);
      if (list[0]) setTripForm(tripToForm(list[0].trip));
    } catch {
      setTripLoadError("Couldn't reach the server to load the trip.");
    } finally {
      setTripLoading(false);
    }
  }

  function switchTrip(idx: number) {
    setActiveTripIdx(idx);
    setTripForm(tripToForm(linkedTrips[idx].trip));
  }

  // Saves the trip part of the Edit form. Returns an error message, or null when fine.
  async function saveTripDetails(): Promise<string | null> {
    if (!editingId) return null;
    const current = linkedTrips[activeTripIdx]?.trip;
    if (!current) return null;
    const original = tripToForm(current);
    const changed = Object.keys(tripForm).some((k) => tripForm[k] !== original[k]);
    if (!changed) return null;
    try {
      const res = await fetch(`/spnc/app/api/schedules/${editingId}/trip`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: current.id, ...tripForm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.message || "Schedule saved, but the trip details could not be updated.";
      }
      return null;
    } catch {
      return "Schedule saved, but the trip details could not be updated (no connection).";
    }
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
    setLinkedTrips([]);
    setTripForm({});
    setTripLoadError(null);
  }

  // Picking a route locks the Service Provider to that route's provider.
  // The provider is derived entirely from the route and cannot be overridden.
  function handleRouteChange(routeId: string) {
    const selected = routes.find((r) => r.id === routeId) || null;
    setForm({
      ...form,
      route_id: selected ? selected.id : null,
      service_provider_id: selected?.service_provider_id ?? null,
    });
    setRouteMenuOpen(false);
    setRouteSearch("");
  }

  const selectedRoute = useMemo(() => routes.find((r) => r.id === form.route_id) || null, [routes, form.route_id]);

  function fieldBorderClass(value: string) {
    if (showFieldErrors && !value.trim()) {
      return "border-[#E2685A] focus:border-[#E2685A]";
    }
    return isDark ? "border-[#2C4356] focus:border-[#F2419B]" : "border-gray-300 focus:border-[#F2419B]";
  }

  async function handleSave() {
    const missing: string[] = [];
    if (!form.schedule_code.trim()) missing.push("Schedule Code");
    if (!form.departure_datetime) missing.push("Departure");
    if (!form.arrival_datetime) missing.push("Arrival");
    // Edit only shows Code, Departure, Arrival and Notes — the other fields keep their
    // saved values (loaded in openEditModal) and are sent back unchanged.
    if (!editingId) {
      if (!form.route_id) missing.push("Route");
      if (!form.capacity.trim()) missing.push("Capacity");
      if (form.frequency.length === 0) missing.push("Frequency");
      if (form.day_of_week.length === 0) missing.push("Day of Week");
      if (form.unit_type.length === 0) missing.push("Unit Type");
    }

    if (missing.length > 0) {
      setSaveError(`Please fill in: ${missing.join(", ")}.`);
      setShowFieldErrors(true);
      return;
    }

    setShowFieldErrors(false);

    const departure = new Date(form.departure_datetime);
    const arrival = new Date(form.arrival_datetime);
    if (arrival.getTime() <= departure.getTime()) {
      setSaveError("Arrival must be after departure.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      schedule_code: form.schedule_code,
      route_id: form.route_id,
      service_provider_id: form.service_provider_id,
      departure_datetime: departure.toISOString(),
      arrival_datetime: arrival.toISOString(),
      frequency: form.frequency.join(", "),
      day_of_week: form.day_of_week.join(", "),
      capacity: form.capacity ? Number(form.capacity) : null,
      unit_type: form.unit_type.join(", "),
      cutoff_hours: form.cutoff_hours ? Number(form.cutoff_hours) : 24,
      status: form.status,
      notes: form.notes,
    };

    try {
      const url = editingId ? `/spnc/app/api/schedules/${editingId}` : "/spnc/app/api/schedules";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message || (editingId ? "Could not update schedule." : "Could not save schedule."));
        return;
      }

      // Save the linked trip's vehicle / driver / cargo too (Edit only)
      const tripErr = await saveTripDetails();
      if (tripErr) {
        setSaveError(tripErr);
        fetchSchedules();
        return;
      }
      if (editingId) setTripLogKey((k) => k + 1); // refresh the Trip Log table

      // Jump the calendar to the saved departure so the user sees it land.
      goToMonth(departure);
      setSelectedDay(new Date(departure.getFullYear(), departure.getMonth(), departure.getDate()));

      closeModal();
      fetchSchedules();
      fetchTrips();
    } catch (err) {
      console.error("Save schedule failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const mutedText = isDark ? "text-[#8FA0AF]" : "text-gray-500";
  const gridBorder = isDark ? "border-[#23303D]" : "border-gray-200";
  const iconBtn = `flex h-7 w-7 items-center justify-center rounded-md transition ${
    isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
  }`;

  return (
    <div className={`min-h-full pb-16 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Calendar size={18} />}
        title="Schedule & Transit Timetable"
        subtitle="Departure/arrival schedules and timetables"
      />

      <div className="px-5">
        {/* Live link with Route Planning */}
        <div className={`mb-3 flex flex-wrap items-center gap-3 text-[11px] ${mutedText}`}>
          <span className="flex items-center gap-1.5 font-semibold text-[#1FA968]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FA968] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1FA968]" />
            </span>
            Live
          </span>
          <span>
            Deliveries planned in Route Planning are added to this calendar automatically ·{" "}
            {schedules.filter(isFromRoutePlanning).length} on the calendar · updated{" "}
            {lastSynced ? lastSynced.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
          <button
            type="button"
            onClick={() => void fetchSchedules(true)}
            disabled={liveRefreshing || loading}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold transition disabled:opacity-50 ${
              isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <RefreshCw size={11} className={liveRefreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>


        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Loader2 size={26} className="animate-spin text-[#F2419B]" />
            <p className="text-xs font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <>
            {/* Month navigation */}
            <div className="mb-2 grid grid-cols-3 items-center">
              <button
                type="button"
                onClick={() => goToMonth(prevMonth)}
                className="flex items-center gap-1 justify-self-start text-xs font-medium text-[#F2419B] hover:underline"
              >
                <ChevronLeft size={14} />
                {monthLabel(prevMonth, false)}
              </button>

              <div className="relative text-center" ref={pickerRef}>
                <button
                  type="button"
                  onClick={openPicker}
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                  title="Pick a month and year"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-lg font-semibold transition ${
                    isDark ? "text-[#F2F1EC] hover:bg-[#1A2530]" : "text-gray-800 hover:bg-gray-100"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {monthLabel(viewMonth)}
                  <ChevronDown size={15} className={`transition ${pickerOpen ? "rotate-180" : ""} ${mutedText}`} />
                </button>

                {pickerOpen && (
                  <div
                    role="dialog"
                    aria-label="Choose month and year"
                    className={`absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border p-2.5 text-left shadow-xl ${
                      isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => y - 1)}
                        aria-label="Previous year"
                        className={iconBtn}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="YYYY"
                        value={yearDraft}
                        onChange={(e) => setYearDraft(e.target.value.replace(/\D/g, ""))}
                        onFocus={(e) => e.target.select()}
                        onBlur={commitYearDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitYearDraft();
                          }
                        }}
                        aria-label="Year"
                        className={`w-20 rounded-md border bg-transparent px-2 py-1 text-center text-sm font-semibold outline-none focus:border-[#F2419B] ${
                          isDark ? "border-[#2C4356] text-[#F2F1EC]" : "border-gray-300 text-gray-900"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setPickerYear((y) => y + 1)}
                        aria-label="Next year"
                        className={iconBtn}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {Array.from({ length: 12 }, (_, i) => {
                        const isCurrent = viewMonth.getFullYear() === pickerYear && viewMonth.getMonth() === i;
                        const isThisMonth = today.getFullYear() === pickerYear && today.getMonth() === i;
                        const hasEvents = monthsWithEvents.has(`${pickerYear}-${pad(i + 1)}`);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickMonth(i)}
                            className={`relative rounded-md py-1.5 text-xs transition ${
                              isCurrent
                                ? "bg-[#F2419B] font-semibold text-white"
                                : isThisMonth
                                ? "border border-[#F2419B]/60 text-[#F2419B]"
                                : isDark
                                ? "text-[#C7D1DA] hover:bg-[#1A2530]"
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {new Date(pickerYear, i, 1).toLocaleDateString(undefined, { month: "short" })}
                            {hasEvents && (
                              <span
                                className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                                  isCurrent ? "bg-white" : "bg-[#F2419B]"
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        goToToday();
                        setPickerOpen(false);
                      }}
                      className="mt-2.5 w-full rounded-md py-1 text-[11px] font-medium text-[#F2419B] transition hover:bg-[#F2419B]/10"
                    >
                      Jump to today
                    </button>
                  </div>
                )}
                <p className={`mt-0.5 text-[11px] ${mutedText}`}>
                  {monthCounts.departures} departures · {monthCounts.arrivals} arrivals
                </p>
              </div>

              <button
                type="button"
                onClick={() => goToMonth(nextMonth)}
                className="flex items-center gap-1 justify-self-end text-xs font-medium text-[#F2419B] hover:underline"
              >
                {monthLabel(nextMonth, false)}
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className={`flex items-center gap-3 text-[11px] ${mutedText}`}>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[#F2419B]" /> Departure
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[#0EA5E9]" /> Arrival
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-[#10B981]" /> Trip
                </span>
                <span className="flex items-center gap-1">
                  <span className="line-through">SCH</span> Cancelled
                </span>
              </div>
              <button
                type="button"
                onClick={goToToday}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Today
              </button>
            </div>

            {/* Month grid */}
            <div className="overflow-x-auto">
              <div className={`min-w-[680px] overflow-hidden rounded-lg border ${gridBorder}`}>
                <div className={`grid grid-cols-7 ${isDark ? "bg-[#0B1220]" : "bg-gray-50"}`}>
                  {WEEKDAY_HEADERS.map((d) => (
                    <div
                      key={d}
                      className={`border-b px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${gridBorder} ${mutedText}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                      const cellBorder = `${di < 6 ? "border-r" : ""} ${wi < weeks.length - 1 ? "border-b" : ""} ${gridBorder}`;

                      if (!day) {
                        return <div key={di} className={`min-h-[88px] ${cellBorder} ${isDark ? "bg-[#0E1621]" : "bg-gray-50/60"}`} />;
                      }

                      const events = eventsByDay.get(dayKey(day)) || [];
                      const tripEvents = tripEventsByDay.get(dayKey(day)) || [];
                      const visible = events.slice(0, MAX_EVENTS_PER_CELL);
                      // Trips fill whatever room the schedule events leave in the cell.
                      const tripVisible = tripEvents.slice(0, Math.max(0, MAX_EVENTS_PER_CELL - visible.length));
                      const hidden = events.length + tripEvents.length - visible.length - tripVisible.length;
                      const hasAny = events.length + tripEvents.length > 0;
                      const isToday = isSameDay(day, today);
                      const isSelected = isSameDay(day, selectedDay);

                      return (
                        <div
                          key={di}
                          onClick={() => selectDay(day)}
                          title="Click to see the day"
                          className={`min-h-[88px] cursor-pointer p-1.5 transition ${cellBorder} ${
                            isSelected
                              ? isDark
                                ? "bg-[#182230]"
                                : "bg-[#FDF2F8]"
                              : isDark
                              ? "bg-[#121B26] hover:bg-[#162130]"
                              : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                                isToday
                                  ? "bg-[#F2419B] font-semibold text-white"
                                  : hasAny
                                  ? "font-semibold text-[#F2419B]"
                                  : isDark
                                  ? "text-[#C7D1DA]"
                                  : "text-gray-700"
                              }`}
                            >
                              {day.getDate()}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            {visible.map((ev) => (
                              <button
                                key={ev.key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/spnc/app/schedules/${ev.schedule.id}`);
                                }}
                                title={`${ev.kind === "departure" ? "Departs" : "Arrives"} ${formatTime(ev.at)} · ${
                                  ev.schedule.schedule_code
                                } · ${scheduleLabel(ev.schedule)}${
                                  routeAddressLine(ev.schedule.routes) ? ` (${routeAddressLine(ev.schedule.routes)})` : ""
                                } · ${ev.schedule.status}${isFromRoutePlanning(ev.schedule) ? " · from Route Planning" : ""}`}
                                style={hlScheduleId === ev.schedule.id ? hlItemStyle : undefined}
                                className={`flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-[11px] transition hover:opacity-80 ${eventColor(
                                  ev.kind
                                )} ${ev.schedule.status === "cancelled" ? "line-through opacity-60" : ""}`}
                              >
                                {ev.kind === "departure" ? (
                                  <ArrowUpRight size={10} className="shrink-0" />
                                ) : (
                                  <ArrowDownLeft size={10} className="shrink-0" />
                                )}
                                <span className="shrink-0 font-medium">{formatTime(ev.at)}</span>
                                {isFromRoutePlanning(ev.schedule) && <Truck size={10} className="shrink-0" aria-label="From Route Planning" />}
                                <span className="truncate">{ev.schedule.schedule_code}</span>
                              </button>
                            ))}

                            {tripVisible.map((ev) => (
                              <div
                                key={ev.key}
                                title={`Trip ${ev.trip.trip_code} · ${ev.kind === "departure" ? "departed" : "delivered"} ${formatTime(
                                  ev.at
                                )} · ${ev.checkpoint.location} · ${ev.trip.vehicle_plate_no}`}
                                style={hlTripId === ev.trip.id ? hlItemStyle : undefined}
                                className={`flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-[11px] ${tripEventColor}`}
                              >
                                {ev.kind === "departure" ? (
                                  <ArrowUpRight size={10} className="shrink-0" />
                                ) : (
                                  <ArrowDownLeft size={10} className="shrink-0" />
                                )}
                                <span className="shrink-0 font-medium">{formatTime(ev.at)}</span>
                                <span className="truncate">{ev.trip.trip_code}</span>
                              </div>
                            ))}

                            {hidden > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectDay(day, true);
                                }}
                                className={`px-1 text-[11px] font-medium ${mutedText} hover:text-[#F2419B]`}
                              >
                                +{hidden} more
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected-day agenda */}
            {hlMissing && !hlLabel && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-[#F2A23B]/50 bg-[#F2A23B]/10 px-3 py-2 text-xs text-[#C9791A]">
                <span className="font-semibold">Anomaly alert:</span>
                <span>Couldn&apos;t find &quot;{hlMissing}&quot;. It may have been archived.</span>
                <button type="button" onClick={() => setHlMissing(null)} className="ml-auto rounded px-2 py-0.5 font-semibold hover:bg-[#F2A23B]/15">
                  Dismiss
                </button>
              </div>
            )}
            {hlLabel && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-xs text-[#E5484D]">
                <span className="font-semibold">Anomaly alert:</span>
                <span>
                  {hlLabel} is outlined in red on the calendar{hlTripId ? " and in the trip log below" : ""}.
                </span>
                {hlTripId && (
                  <button
                    type="button"
                    onClick={() => setTrackingTripId(hlTripId)}
                    className="flex items-center gap-1 rounded-md bg-[#E5484D] px-2 py-0.5 font-semibold text-white hover:bg-[#d63c41]"
                  >
                    <MapIcon size={12} /> Track
                  </button>
                )}
                <button type="button" onClick={clearScheduleHighlight} className="ml-auto rounded px-2 py-0.5 font-semibold hover:bg-[#E5484D]/15">
                  Dismiss
                </button>
              </div>
            )}

            <div ref={dayPanelRef} className={`mt-4 scroll-mt-4 rounded-lg border ${gridBorder} ${isDark ? "bg-[#121B26]" : "bg-white"}`}>
              <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 ${gridBorder}`}>
                <div>
                  <h3 className={`text-xs font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>
                    {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </h3>
                  <p className={`text-[11px] ${mutedText}`}>
                    {allDaySchedEvents.length + allDayTripEvents.length === 0
                      ? "Nothing departing or arriving"
                      : dayQuery
                      ? `${dayTotal} matching “${daySearch.trim()}”`
                      : `${selectedDepartures} departing · ${selectedArrivals} arriving`}
                  </p>
                </div>

                <div className="relative w-full max-w-xs" ref={daySearchRef}>
                  <input
                    type="text"
                    value={daySearchInput}
                    onChange={(e) => {
                      setDaySearchInput(e.target.value);
                      if (!e.target.value.trim()) setDaySearch(""); // emptied the box → show everything again
                    }}
                    onFocus={() => setShowDayRecent(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        runDaySearch();
                      } else if (e.key === "Escape") {
                        setShowDayRecent(false);
                      }
                    }}
                    placeholder="Search code, route, provider, trip…"
                    aria-label="Search this day's schedules and trips"
                    className={`w-full rounded-md border py-1.5 pl-3 pr-16 text-xs outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                  <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {daySearchInput && (
                      <button
                        type="button"
                        onClick={clearDaySearch}
                        aria-label="Clear search"
                        title="Clear"
                        className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                          isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => runDaySearch()}
                      aria-label="Search"
                      title="Search"
                      className="flex h-6 w-7 items-center justify-center rounded-md bg-[#F2419B] text-white transition hover:bg-[#F55CAB]"
                    >
                      <Search size={13} />
                    </button>
                  </div>

                  {showDayRecent && dayRecent.length > 0 && (
                    <div
                      className={`absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-md border shadow-lg ${
                        isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className={`flex items-center justify-between px-3 py-2 text-[10px] font-medium uppercase tracking-wide ${mutedText}`}>
                        <span>Recent searches</span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            persistDayRecent([]);
                          }}
                          className={`normal-case ${isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-700"}`}
                        >
                          Clear
                        </button>
                      </div>
                      <ul>
                        {dayRecent.map((term) => (
                          <li key={term}>
                            <div
                              className={`group flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs ${
                                isDark ? "text-[#C7D1DA] hover:bg-[#182230]" : "text-gray-700 hover:bg-gray-50"
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runDaySearch(term);
                              }}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Clock size={12} className={`shrink-0 ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`} />
                                <span className="truncate">{term}</span>
                              </span>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  persistDayRecent(dayRecent.filter((t) => t !== term));
                                }}
                                aria-label={`Remove "${term}" from recent searches`}
                                className={`opacity-0 transition group-hover:opacity-100 ${
                                  isDark ? "text-[#4B5A68] hover:text-[#F2F1EC]" : "text-gray-300 hover:text-gray-600"
                                }`}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming / On-going / Delivered */}
              <div className={`flex border-b px-2 ${gridBorder}`}>
                {DAY_TABS.map((t) => {
                  const on = dayTab === t.key;
                  const color = t.key === "upcoming" ? "#F2419B" : t.key === "ongoing" ? "#38BDF8" : "#1FA968";
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setDayTab(t.key);
                        setDayPage(1);
                      }}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                        on ? "" : `border-transparent ${mutedText} hover:opacity-80`
                      }`}
                      style={on ? { borderColor: color, color: isDark ? "#F2F1EC" : "#111827" } : undefined}
                    >
                      {t.label}
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>
                        {tabCounts[t.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedTotal === 0 ? (
                <p className={`px-3 py-6 text-center text-xs ${mutedText}`}>
                  {schedules.length === 0 && trips.length === 0
                    ? "No schedules or trips yet."
                    : dayQuery
                    ? `Nothing in this tab matches “${daySearch.trim()}”.`
                    : dayTab === "upcoming"
                    ? "No upcoming deliveries on this day."
                    : dayTab === "ongoing"
                    ? "Nothing on the road on this day."
                    : "Nothing delivered on this day yet."}
                </p>
              ) : (
                <ul className={`divide-y ${isDark ? "divide-[#23303D]" : "divide-gray-200"}`}>
                  {pagedSelectedEvents.map((ev) => {
                    const s = ev.schedule;
                    const phase = schedulePhase(s, nowTick);
                    const st = (s.status || "").toLowerCase();
                    const badge =
                      st === "cancelled" ? "cancelled" : st === "delayed" && phase !== "delivered" ? "delayed" : phase === "delivered" ? "completed" : phase;
                    const badgeLabel =
                      badge === "cancelled" ? "Cancelled" : badge === "delayed" ? "Delayed" : badge === "completed" ? "Delivered" : badge === "ongoing" ? "On-going" : "Upcoming";
                    const sc =
                      badge === "ongoing"
                        ? isDark
                          ? { bg: "bg-[#38BDF8]/15", text: "text-[#7DD3FC]" }
                          : { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]" }
                        : statusColor(badge === "upcoming" ? "scheduled" : badge);
                    return (
                      <li key={ev.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={hlScheduleId === s.id ? hlRowStyle : undefined}>
                        <div className={`flex w-24 shrink-0 items-center gap-1 rounded border-l-2 px-1.5 py-1 text-[11px] font-medium ${eventColor(ev.kind)}`}>
                          {ev.kind === "departure" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                          {ev.kind === "departure" ? "Departs" : "Arrives"} {formatTime(ev.at)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#F2419B]">{s.schedule_code}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}>{badgeLabel}</span>
                            {isFromRoutePlanning(s) && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  isDark ? "bg-[#1A2530] text-[#7DD3FC]" : "bg-[#E0F2FE] text-[#0369A1]"
                                }`}
                              >
                                <Truck size={10} /> Route Planning
                              </span>
                            )}
                          </div>
                          <div className={`truncate text-xs ${isDark ? "text-[#C7D1DA]" : "text-gray-700"}`}>
                            {scheduleLabel(s)}
                            {routeAddressLine(s.routes) && <span className={`ml-1.5 text-[11px] ${mutedText}`}>{routeAddressLine(s.routes)}</span>}
                          </div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {s.service_providers?.name || "No provider"} · {formatFrequency(s.frequency)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/spnc/app/schedules/${s.id}`)}
                            aria-label={`View ${s.schedule_code}`}
                            title="View schedule details"
                            className={iconBtn}
                          >
                            <Eye size={13} />
                          </button>
                          <button type="button" onClick={() => openEditModal(s)} aria-label={`Edit ${s.schedule_code}`} title="Edit" className={iconBtn}>
                            <Pencil size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}

                  {pagedSelectedTripEvents.map((ev) => {
                    const t = ev.trip;
                    const sc = statusColor(ev.checkpoint.status === "delivered" ? "completed" : ev.checkpoint.status);
                    return (
                      <li key={ev.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={hlTripId === t.id ? hlRowStyle : undefined}>
                        <div className={`flex w-24 shrink-0 items-center gap-1 rounded border-l-2 px-1.5 py-1 text-[11px] font-medium ${tripEventColor}`}>
                          {ev.kind === "departure" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                          {ev.kind === "departure" ? "Departed" : "Delivered"} {formatTime(ev.at)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Truck size={13} className="shrink-0 text-[#10B981]" />
                            <span className="text-sm font-semibold text-[#F2419B]">{t.trip_code}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${sc.bg} ${sc.text}`}>
                              {ev.checkpoint.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className={`truncate text-xs ${isDark ? "text-[#C7D1DA]" : "text-gray-700"}`}>{ev.checkpoint.location}</div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {t.vehicle_plate_no}
                            {t.driver_name ? ` · ${t.driver_name}` : ""}
                            {t.schedule_id ? "" : " · No schedule linked"}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTrackingTripId(t.id)}
                            aria-label={`Track ${t.trip_code} on map`}
                            title="Track on map"
                            className={iconBtn}
                          >
                            <MapIcon size={13} />
                          </button>
                          {/* View: the schedule page if the trip is linked to one, otherwise the trip's own details page */}
                          <button
                            type="button"
                            onClick={() =>
                              router.push(t.schedule_id ? `/spnc/app/schedules/${t.schedule_id}` : `/spnc/app/trips/${t.id}`)
                            }
                            aria-label={`View ${t.trip_code}`}
                            title={t.schedule_id ? "View trip and its schedule" : "View trip details"}
                            className={iconBtn}
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedTotal > DAY_LIST_PAGE_SIZE && (
                <div className={`flex items-center justify-center gap-4 border-t px-3 py-2.5 ${gridBorder}`}>
                  <button
                    type="button"
                    onClick={() => setDayPage(Math.max(1, dayPageNow - 1))}
                    disabled={dayPageNow === 1}
                    className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ChevronLeft size={14} /> Back
                  </button>
                  <span className={`text-xs ${mutedText}`}>
                    Page {dayPageNow} of {dayPages} · {selectedTotal} items
                  </span>
                  <button
                    type="button"
                    onClick={() => setDayPage(Math.min(dayPages, dayPageNow + 1))}
                    disabled={dayPageNow === dayPages}
                    className={`flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Vehicle & cargo trip log */}
            <TripLogTable
              isDark={isDark}
              mutedText={mutedText}
              gridBorder={gridBorder}
              schedules={schedules}
              selectedDay={selectedDay}
              onViewSchedule={(id) => router.push(`/spnc/app/schedules/${id}`)}
              onTrackTrip={(id) => setTrackingTripId(id)}
              refreshKey={tripLogKey}
            />
          </>
        )}
      </div>

      {/* SPNC AI assistant (floating robot button, bottom-right) */}
      <SpncAssistant isDark={isDark} />

      {trackingTripId && (
        <TripTrackingModal
          tripId={trackingTripId}
          isDark={isDark}
          onClose={() => setTrackingTripId(null)}
          onChanged={() => {
            void fetchTrips(); // calendar events
            setTripLogKey((k) => k + 1); // trip log table
          }}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`max-h-[88vh] w-full max-w-md overflow-y-auto rounded-lg border p-5 ${
              isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                className={`text-lg font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {editingId ? "Edit Schedule" : "New Schedule"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className={isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-900"}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Schedule Code *</p>
                <input
                  type="text"
                  placeholder="SCH-001"
                  value={form.schedule_code}
                  onChange={(e) => setForm({ ...form, schedule_code: e.target.value })}
                  className={`w-full rounded-md border px-2.5 py-2 text-sm outline-none ${fieldBorderClass(form.schedule_code)} ${
                    isDark ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]" : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {!editingId && (
                <>
              <div className="relative" ref={routeMenuRef}>
                <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Route *</p>
                {routes.length === 0 ? (
                  <p className={`text-[11px] ${mutedText}`}>No routes yet — create one in Network & Routes first.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setRouteMenuOpen((o) => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={routeMenuOpen}
                      className={`flex w-full items-start justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm outline-none ${
                        showFieldErrors && !form.route_id ? "border-[#E2685A]" : isDark ? "border-[#2C4356]" : "border-gray-300"
                      } ${isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"}`}
                    >
                      {selectedRoute ? (
                        <span className="truncate font-semibold text-[#F2419B]">{routeCodeLabel(selectedRoute)}</span>
                      ) : (
                        <span className={mutedText}>Select a route…</span>
                      )}
                      <ChevronDown size={15} className={`shrink-0 transition ${routeMenuOpen ? "rotate-180" : ""} ${mutedText}`} />
                    </button>

                    {selectedRoute && (selectedRoute.origin || selectedRoute.destination) && (
                      <div className={`mt-1.5 grid grid-cols-2 gap-3 text-sm ${mutedText}`}>
                        {selectedRoute.origin && (
                          <p>
                            <span className="font-medium">Origin:</span> {selectedRoute.origin}
                          </p>
                        )}
                        {selectedRoute.destination && (
                          <p>
                            <span className="font-medium">Destination:</span> {selectedRoute.destination}
                          </p>
                        )}
                      </div>
                    )}

                    {routeMenuOpen && (
                      <div
                        role="listbox"
                        className={`absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-hidden rounded-lg border shadow-xl ${
                          isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className={`relative border-b p-2 ${isDark ? "border-[#23303D]" : "border-gray-200"}`}>
                          <Search
                            size={14}
                            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${mutedText}`}
                          />
                          <input
                            ref={routeSearchInputRef}
                            type="text"
                            value={routeSearch}
                            onChange={(e) => setRouteSearch(e.target.value)}
                            placeholder="Search route code, place, or provider…"
                            className={`w-full rounded-md border py-1.5 pl-8 pr-2 text-sm outline-none ${
                              isDark
                                ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                                : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                            }`}
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto py-1">
                          {filteredRoutes.length === 0 ? (
                            <p className={`px-3 py-4 text-center text-xs ${mutedText}`}>No routes match your search.</p>
                          ) : (
                            filteredRoutes.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                role="option"
                                aria-selected={form.route_id === r.id}
                                onClick={() => handleRouteChange(r.id)}
                                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition ${
                                  form.route_id === r.id
                                    ? isDark
                                      ? "bg-[#F2419B]/15"
                                      : "bg-[#FCE4F1]"
                                    : isDark
                                    ? "hover:bg-[#1A2530]"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                <span className="font-semibold text-[#F2419B]">{routeCodeLabel(r)}</span>
                                {routeAddress(r) && (
                                  <span className={`truncate text-xs ${mutedText}`}>{routeAddress(r)}</span>
                                )}
                                <span className={`text-[11px] ${mutedText}`}>
                                  {r.service_providers?.name || "No provider assigned"}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <p className={`mb-1.5 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Service Provider</p>
                <div
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
                    isDark ? "border-[#2C4356] bg-[#0B1220]/60 text-[#C7D1DA]" : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  <Lock size={13} className={mutedText} />
                  <span>
                    {selectedRoute ? selectedRoute.service_providers?.name || "No provider assigned to this route" : "Select a route first"}
                  </span>
                </div>
                <p className={`mt-1 text-[11px] ${mutedText}`}>Fixed to the selected route's provider — cannot be changed here.</p>
              </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Departure *</p>
                  <input
                    type="datetime-local"
                    value={form.departure_datetime}
                    onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })}
                    className={`w-full rounded-md border px-2.5 py-2 text-sm outline-none ${fieldBorderClass(form.departure_datetime)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Arrival *</p>
                  <input
                    type="datetime-local"
                    value={form.arrival_datetime}
                    onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })}
                    className={`w-full rounded-md border px-2.5 py-2 text-sm outline-none ${fieldBorderClass(form.arrival_datetime)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
              </div>

              {!editingId && (
                <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Capacity *</p>
                  <input
                    type="number"
                    placeholder="500"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className={`w-full rounded-md border px-2.5 py-2 text-sm outline-none ${fieldBorderClass(form.capacity)} ${
                      isDark
                        ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Cutoff (hrs)</p>
                  <input
                    type="number"
                    placeholder="24"
                    value={form.cutoff_hours}
                    onChange={(e) => setForm({ ...form, cutoff_hours: e.target.value })}
                    className={`w-full rounded-md border px-2.5 py-2 text-sm outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              <MultiSelectDropdown
                label="Frequency *"
                options={FREQUENCY_OPTIONS}
                selected={form.frequency}
                onChange={(next) => setForm({ ...form, frequency: next })}
                formatOption={formatFrequency}
                isDark={isDark}
                mutedText={mutedText}
                error={showFieldErrors && form.frequency.length === 0}
              />

              <MultiSelectDropdown
                label="Day of Week *"
                options={DAY_OPTIONS}
                selected={form.day_of_week}
                onChange={(next) => setForm({ ...form, day_of_week: next })}
                isDark={isDark}
                mutedText={mutedText}
                error={showFieldErrors && form.day_of_week.length === 0}
              />

              <MultiSelectDropdown
                label="Unit Type *"
                options={UNIT_OPTIONS}
                selected={form.unit_type}
                onChange={(next) => setForm({ ...form, unit_type: next })}
                isDark={isDark}
                mutedText={mutedText}
                error={showFieldErrors && form.unit_type.length === 0}
              />

              <SingleSelectDropdown
                label="Status"
                options={STATUS_OPTIONS}
                selected={form.status}
                onChange={(next) => setForm({ ...form, status: next })}
                isDark={isDark}
                mutedText={mutedText}
              />
                </>
              )}

              <div>
                <p className={`mb-1 text-[11px] font-medium tracking-wide uppercase ${mutedText}`}>Notes</p>
                <textarea
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`h-16 w-full resize-none rounded-md border px-2.5 py-2 text-sm outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {editingId && (
                <div className={`rounded-lg border p-3 ${isDark ? "border-[#23303D] bg-[#0B1220]/40" : "border-gray-200 bg-gray-50"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase ${isDark ? "text-[#F2F1EC]" : "text-gray-800"}`}>
                      <Truck size={13} className="text-[#F2419B]" /> Trip Details
                    </p>
                    {linkedTrips.length > 1 && (
                      <div className="flex gap-1">
                        {linkedTrips.map((lt, i) => (
                          <button
                            key={lt.trip.id}
                            type="button"
                            onClick={() => switchTrip(i)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              i === activeTripIdx ? "bg-[#F2419B] text-white" : isDark ? "bg-[#1A2530] text-[#8FA0AF]" : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {String(lt.trip.trip_code ?? `Trip ${i + 1}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {tripLoading ? (
                    <p className={`flex items-center gap-1.5 text-xs ${mutedText}`}>
                      <Loader2 size={13} className="animate-spin" /> Loading trip…
                    </p>
                  ) : tripLoadError ? (
                    <p className="text-xs text-[#E2685A]">{tripLoadError}</p>
                  ) : linkedTrips.length === 0 ? (
                    <p className={`text-xs ${mutedText}`}>No trip is linked to this schedule yet.</p>
                  ) : (
                    (() => {
                      const lt = linkedTrips[activeTripIdx];
                      const o = lt.overview;
                      const status = o?.current_status ? String(o.current_status).replace(/_/g, " ") : "not started";
                      const lastUpdate = o?.last_update ? new Date(String(o.last_update)) : null;
                      const groups = ["Vehicle", "Driver", "Cargo"]
                        .map((g) => ({ g, fields: TRIP_FIELDS.filter((f) => f.group === g && f.key in tripForm) }))
                        .filter((x) => x.fields.length > 0);
                      return (
                        <div className="space-y-3">
                          {/* Read-only summary from trip_overview */}
                          <div className={`space-y-0.5 text-xs ${isDark ? "text-[#C7D1DA]" : "text-gray-700"}`}>
                            <p>
                              <span className="font-semibold text-[#F2419B]">{String(lt.trip.trip_code ?? "")}</span>
                              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${isDark ? "bg-[#1A2530] text-[#7DD3FC]" : "bg-[#E0F2FE] text-[#0369A1]"}`}>
                                {status}
                              </span>
                            </p>
                            {o?.route_code || o?.route_name ? (
                              <p className={mutedText}>
                                Route: {String(o?.route_code ?? "")} {o?.route_name ? `· ${String(o.route_name)}` : ""}
                              </p>
                            ) : null}
                            {o?.origin || o?.destination ? (
                              <p className={mutedText}>
                                {String(o?.origin ?? "—")} → {String(o?.destination ?? "—")}
                                {o?.distance_km != null ? ` · ${String(o.distance_km)} km` : ""}
                                {o?.estimated_transit_hours != null ? ` · ~${String(o.estimated_transit_hours)} h` : ""}
                              </p>
                            ) : null}
                            {o?.service_provider_name ? <p className={mutedText}>Provider: {String(o.service_provider_name)}</p> : null}
                            {o?.last_location ? (
                              <p className={mutedText}>
                                Last seen: {String(o.last_location)}
                                {lastUpdate && !Number.isNaN(lastUpdate.getTime()) ? ` · ${lastUpdate.toLocaleString()}` : ""}
                              </p>
                            ) : null}
                          </div>

                          {/* Editable trip fields */}
                          {groups.map(({ g, fields }) => (
                            <div key={g}>
                              <p className={`mb-1 text-[10px] font-semibold tracking-wider uppercase ${mutedText}`}>{g}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {fields.map((f) => (
                                  <label key={f.key} className={f.key === "cargo_description" ? "col-span-2" : ""}>
                                    <span className={`mb-0.5 block text-[10px] ${mutedText}`}>{f.label}</span>
                                    <input
                                      type={f.type === "number" ? "number" : "text"}
                                      inputMode={f.type === "number" ? "decimal" : undefined}
                                      min={f.type === "number" ? 0 : undefined}
                                      value={tripForm[f.key] ?? ""}
                                      placeholder={f.placeholder}
                                      onChange={(e) => setTripForm({ ...tripForm, [f.key]: e.target.value })}
                                      className={`w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-[#F2419B] ${
                                        isDark
                                          ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                                          : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                                      }`}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {saveError && (
                <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-2.5 py-1.5 text-xs text-[#E2685A]">{saveError}</div>
              )}
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className={`flex-1 rounded-md border py-2 text-xs font-medium transition ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#F2419B] py-2 text-xs font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:bg-[#4B5A68]"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? (editingId ? "Updating…" : "Saving…") : editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}