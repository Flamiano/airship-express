"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Pencil,
  Archive,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Search,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";

const FREQUENCY_OPTIONS = ["daily", "weekly", "bi_weekly", "monthly", "on_demand"];
const UNIT_OPTIONS = ["kg", "container", "pallet", "teu"];
const STATUS_OPTIONS = ["scheduled", "delayed", "cancelled", "completed"];
const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_CELL = 3;

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

// Shared multi-select dropdown used for Frequency, Day of Week, Unit Type and Status.
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

export default function SchedulesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function fetchSchedules() {
    setLoading(true);
    try {
      const res = await fetch("/spnc/app/api/schedules", { cache: "no-store" });
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error("Fetch schedules failed:", err);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([fetchSchedules(), fetchRoutes()]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredSchedules = schedules;

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

  const weeks = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);

  const monthCounts = useMemo(() => {
    let departures = 0;
    let arrivals = 0;
    for (const [k, list] of eventsByDay) {
      if (!k.startsWith(`${viewMonth.getFullYear()}-${pad(viewMonth.getMonth() + 1)}-`)) continue;
      for (const ev of list) {
        if (ev.kind === "departure") departures++;
        else arrivals++;
      }
    }
    return { departures, arrivals };
  }, [eventsByDay, viewMonth]);

  const selectedEvents = eventsByDay.get(dayKey(selectedDay)) || [];

  // "YYYY-MM" keys of months that have at least one departure or arrival.
  const monthsWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const k of eventsByDay.keys()) set.add(k.slice(0, 7));
    return set;
  }, [eventsByDay]);

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

  // Optionally pre-fill the departure date with the day the user picked on the calendar.
  function openAddModal(forDay?: Date) {
    resetForm();
    if (forDay) {
      const date = `${forDay.getFullYear()}-${pad(forDay.getMonth() + 1)}-${pad(forDay.getDate())}`;
      setForm({ ...emptyForm, departure_datetime: `${date}T08:00` });
    }
    setModalOpen(true);
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
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
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
    if (!form.route_id) missing.push("Route");
    if (!form.departure_datetime) missing.push("Departure");
    if (!form.arrival_datetime) missing.push("Arrival");
    if (!form.capacity.trim()) missing.push("Capacity");
    if (form.frequency.length === 0) missing.push("Frequency");
    if (form.day_of_week.length === 0) missing.push("Day of Week");
    if (form.unit_type.length === 0) missing.push("Unit Type");

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

      // Jump the calendar to the saved departure so the user sees it land.
      goToMonth(departure);
      setSelectedDay(new Date(departure.getFullYear(), departure.getMonth(), departure.getDate()));

      closeModal();
      fetchSchedules();
    } catch (err) {
      console.error("Save schedule failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this schedule?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/spnc/app/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Could not archive schedule.");
        return;
      }
      fetchSchedules();
    } catch (err) {
      console.error("Archive schedule failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
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
        {deleteError && (
          <div className="mb-3 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-1.5 text-xs text-[#E2685A]">{deleteError}</div>
        )}

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
                      const visible = events.slice(0, MAX_EVENTS_PER_CELL);
                      const hidden = events.length - visible.length;
                      const isToday = isSameDay(day, today);
                      const isSelected = isSameDay(day, selectedDay);

                      return (
                        <div
                          key={di}
                          onClick={() => selectDay(day)}
                          onDoubleClick={() => openAddModal(day)}
                          title="Click to see the day, double-click to add a schedule"
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
                                  : events.length > 0
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
                                } · ${scheduleRouteLabel(ev.schedule.routes, ev.schedule.route_id)}${
                                  routeAddressLine(ev.schedule.routes) ? ` (${routeAddressLine(ev.schedule.routes)})` : ""
                                } · ${ev.schedule.status}`}
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
                                <span className="truncate">{ev.schedule.schedule_code}</span>
                              </button>
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
            <div ref={dayPanelRef} className={`mt-4 scroll-mt-4 rounded-lg border ${gridBorder} ${isDark ? "bg-[#121B26]" : "bg-white"}`}>
              <div className={`flex items-center justify-between border-b px-3 py-2.5 ${gridBorder}`}>
                <div>
                  <h3 className={`text-xs font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}>
                    {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </h3>
                  <p className={`text-[11px] ${mutedText}`}>
                    {selectedEvents.length === 0
                      ? "Nothing departing or arriving"
                      : `${selectedEvents.filter((e) => e.kind === "departure").length} departing · ${
                          selectedEvents.filter((e) => e.kind === "arrival").length
                        } arriving`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAddModal(selectedDay)}
                  className="flex items-center gap-1 rounded-md border border-[#F2419B]/50 px-2.5 py-1 text-[11px] font-medium text-[#F2419B] transition hover:bg-[#F2419B]/10"
                >
                  <Plus size={12} />
                  Add on this day
                </button>
              </div>

              {selectedEvents.length === 0 ? (
                <p className={`px-3 py-6 text-center text-xs ${mutedText}`}>
                  {schedules.length === 0 ? "No schedules yet." : "No matching schedules on this day."}
                </p>
              ) : (
                <ul className={`divide-y ${isDark ? "divide-[#23303D]" : "divide-gray-200"}`}>
                  {selectedEvents.map((ev) => {
                    const s = ev.schedule;
                    const sc = statusColor(s.status);
                    return (
                      <li key={ev.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <div className={`flex w-24 shrink-0 items-center gap-1 rounded border-l-2 px-1.5 py-1 text-[11px] font-medium ${eventColor(ev.kind)}`}>
                          {ev.kind === "departure" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                          {ev.kind === "departure" ? "Departs" : "Arrives"} {formatTime(ev.at)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#F2419B]">{s.schedule_code}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${sc.bg} ${sc.text}`}>{s.status}</span>
                          </div>
                          <div className={`truncate text-xs ${isDark ? "text-[#C7D1DA]" : "text-gray-700"}`}>
                            {scheduleRouteLabel(s.routes, s.route_id)}
                            {routeAddressLine(s.routes) && <span className={`ml-1.5 text-[11px] ${mutedText}`}>{routeAddressLine(s.routes)}</span>}
                          </div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {s.service_providers?.name || "No provider"} · {s.frequency.replace("_", " ")}
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
                          <button
                            type="button"
                            onClick={() => handleArchive(s.id)}
                            disabled={deletingId === s.id}
                            aria-label={`Archive ${s.schedule_code}`}
                            title="Archive"
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-[#E2685A] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              isDark ? "hover:bg-[#2A1212]" : "hover:bg-[#FBE4E1]"
                            }`}
                          >
                            {deletingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => openAddModal()}
        aria-label="Add Schedule"
        className="fixed right-6 bottom-6 z-40 flex items-center gap-1.5 rounded-full bg-[#F2419B] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={16} />
        Add Schedule
      </button>

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
                formatOption={(f) => f.replace("_", " ")}
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
