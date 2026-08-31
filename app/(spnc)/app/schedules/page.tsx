"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Pencil,
  Trash2,
  X,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
} from "lucide-react";
import { useShell } from "@/components/ShellContext";
import PageHeader from "@/components/PageHeader";

const FREQUENCY_OPTIONS = ["daily", "weekly", "bi_weekly", "monthly", "on_demand"];
const UNIT_OPTIONS = ["kg", "container", "pallet", "teu"];
const STATUS_OPTIONS = ["scheduled", "delayed", "cancelled", "completed"];
const FILTERS = ["All", ...STATUS_OPTIONS];
const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_SIZE = 5;

type Provider = { id: string; name: string };

type RouteItem = {
  id: string;
  route_code?: string;
  route_name: string;
  origin?: string;
  destination?: string;
  mode_of_transport?: string;
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

const emptyForm = {
  schedule_code: "",
  route_id: null as string | null,
  service_provider_id: null as string | null,
  departure_datetime: "",
  arrival_datetime: "",
  frequency: "weekly",
  day_of_week: "",
  capacity: "",
  unit_type: "kg",
  cutoff_hours: "24",
  status: "scheduled",
  notes: "",
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Prefer showing the short route code (e.g. "RTE-001") over the full address string.
function routeCodeLabel(r: RouteItem) {
  return r.route_code || r.route_name;
}

// For the schedule card title — same preference, with a fallback chain if code is missing.
function scheduleRouteLabel(r: Schedule["routes"], fallbackId: string) {
  if (!r) return fallbackId;
  if (r.route_code) return r.route_code;
  if (r.origin && r.destination) {
    return `${r.origin} → ${r.destination}${r.mode_of_transport ? ` (${r.mode_of_transport})` : ""}`;
  }
  return r.route_name;
}

// Full address, shown as a secondary line under the route code.
function routeAddressLine(r: Schedule["routes"]) {
  if (!r) return null;
  if (r.origin && r.destination) {
    return `${r.origin} → ${r.destination}`;
  }
  return null;
}

function parseDays(value: string): string[] {
  return value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export default function SchedulesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const router = useRouter();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);

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

  async function fetchSchedules() {
    setLoading(true);
    try {
      const res = await fetch("/api/schedules", { cache: "no-store" });
      const data = await res.json();
      setSchedules(data.schedules || []);
      setPage(1);
    } catch (err) {
      console.error("Fetch schedules failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProviders() {
    try {
      const res = await fetch("/api/service-providers", { cache: "no-store" });
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {
      // non-fatal
    }
  }

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/routes", { cache: "no-store" });
      const data = await res.json();
      setRoutes(data.routes || []);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    fetchSchedules();
    fetchProviders();
    fetchRoutes();
  }, []);

  const filteredSchedules = (filter === "All" ? schedules : schedules.filter((s) => s.status === filter)).filter((schedule) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const haystack = [
      schedule.schedule_code,
      schedule.routes?.route_code,
      schedule.routes?.route_name,
      schedule.routes?.origin,
      schedule.routes?.destination,
      schedule.service_providers?.name,
      schedule.frequency,
      schedule.day_of_week,
      schedule.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / PAGE_SIZE));
  const pagedSchedules = filteredSchedules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, searchTerm]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  function goToPage(next: number) {
    if (next < 1 || next > totalPages || next === page) return;
    setPageLoading(true);
    setTimeout(() => {
      setPage(next);
      setPageLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 400);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSaveError(null);
    setShowFieldErrors(false);
  }

  function openAddModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(s: Schedule) {
    setEditingId(s.id);
    setSaveError(null);
    setShowFieldErrors(false);
    setForm({
      schedule_code: s.schedule_code,
      route_id: s.route_id,
      service_provider_id: s.service_provider_id || null,
      departure_datetime: toDatetimeLocalValue(s.departure_datetime),
      arrival_datetime: toDatetimeLocalValue(s.arrival_datetime),
      frequency: s.frequency,
      day_of_week: s.day_of_week || "",
      capacity: s.capacity != null ? String(s.capacity) : "",
      unit_type: s.unit_type,
      cutoff_hours: String(s.cutoff_hours ?? 24),
      status: s.status,
      notes: s.notes || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function toggleDay(day: string) {
    const current = parseDays(form.day_of_week);
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    const ordered = DAY_OPTIONS.filter((d) => next.includes(d));
    setForm({ ...form, day_of_week: ordered.join(", ") });
  }

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
      frequency: form.frequency,
      day_of_week: form.day_of_week,
      capacity: form.capacity ? Number(form.capacity) : null,
      unit_type: form.unit_type,
      cutoff_hours: form.cutoff_hours ? Number(form.cutoff_hours) : 24,
      status: form.status,
      notes: form.notes,
    };

    try {
      const url = editingId ? `/api/schedules/${editingId}` : "/api/schedules";
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

      closeModal();
      fetchSchedules();
    } catch (err) {
      console.error("Save schedule failed:", err);
      setSaveError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || "Could not delete schedule.");
        return;
      }
      fetchSchedules();
    } catch (err) {
      console.error("Delete schedule failed:", err);
      setDeleteError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Calendar size={20} />}
        title="Schedule & Transit Timetable"
        subtitle="Departure/arrival schedules and timetables"
      />

      <div className="px-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
                filter === f
                  ? "bg-[#F2419B] text-white"
                  : isDark
                  ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                  : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {deleteError && (
          <div className="mb-4 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
            {deleteError}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>No schedules found.</p>
        ) : pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="relative w-full max-w-md">
                  <Search
                    size={16}
                    className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                      isDark ? "text-[#8FA0AF]" : "text-gray-400"
                    }`}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search schedule, route, provider..."
                    className={`w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none ${
                      isDark
                        ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                    }`}
                  />
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <div
                  className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
                    isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
                  }`}
                >
                  No matching schedules found.
                </div>
              ) : (
                <div
                  className={`overflow-hidden rounded-lg border ${
                    isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#23303D] text-left">
                      <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
                        <tr>
                          {['Schedule', 'Route', 'Provider', 'Departure', 'Arrival', 'Status', 'Actions'].map((header) => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                        {pagedSchedules.map((s) => {
                          const sc = statusColor(s.status);
                          return (
                            <tr key={s.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                              <td className="px-4 py-4 align-top">
                                <div className="space-y-1">
                                  <div className="font-semibold text-[#F2419B]">{s.schedule_code}</div>
                                  <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                    {s.frequency.replace("_", " ")}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div className="space-y-1">
                                  <div>{scheduleRouteLabel(s.routes, s.route_id)}</div>
                                  {routeAddressLine(s.routes) && (
                                    <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                                      {routeAddressLine(s.routes)}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 align-top">{s.service_providers?.name || "—"}</td>
                              <td className="px-4 py-4 align-top">{formatDateTime(s.departure_datetime)}</td>
                              <td className="px-4 py-4 align-top">{formatDateTime(s.arrival_datetime)}</td>
                              <td className="px-4 py-4 align-top">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${sc.bg} ${sc.text}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/schedules/${s.id}`)}
                                    aria-label={`View ${s.schedule_code}`}
                                    title="View schedule details"
                                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                      isDark
                                        ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]"
                                        : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                    }`}
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(s)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                      isDark
                                        ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]"
                                        : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                                    }`}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#E2685A] transition hover:bg-[#2A1212] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {filteredSchedules.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 pb-24">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1 || pageLoading}
                  className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isDark
                      ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <span className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages || pageLoading}
                  className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isDark
                      ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={openAddModal}
        aria-label="Add Schedule"
        className="fixed right-8 bottom-8 z-40 flex items-center gap-2 rounded-full bg-[#F2419B] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:bg-[#F55CAB]"
      >
        <Plus size={18} />
        Add Schedule
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 ${
              isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className={`text-xl font-semibold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {editingId ? "Edit Schedule" : "New Schedule"}
              </h2>

              <button
                type="button"
                onClick={closeModal}
                className={isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-900"}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Schedule Code *
                </p>
                <input
                  type="text"
                  placeholder="SCH-001"
                  value={form.schedule_code}
                  onChange={(e) => setForm({ ...form, schedule_code: e.target.value })}
                  className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.schedule_code)} ${
                    isDark
                      ? "bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {/* ROUTE — now shows route code instead of the full address string */}
              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Route *
                </p>

                {routes.length === 0 ? (
                  <p className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    No routes yet — create one in Network & Routes first.
                  </p>
                ) : (
                  <div className={`flex flex-wrap gap-2 rounded-md ${showFieldErrors && !form.route_id ? "border border-[#E2685A] p-1" : ""}`}>
                    {routes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setForm({ ...form, route_id: r.id })}
                        title={r.origin && r.destination ? `${r.origin} → ${r.destination}` : undefined}
                        className={`rounded-full px-4 py-1.5 text-sm transition ${
                          form.route_id === r.id
                            ? "bg-[#F2419B] text-white"
                            : isDark
                            ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                            : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                        }`}
                      >
                        {routeCodeLabel(r)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Show the full address of the currently selected route beneath the chips */}
                {form.route_id && (
                  <p className={`mt-1.5 text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    {(() => {
                      const selected = routes.find((r) => r.id === form.route_id);
                      if (!selected) return null;
                      return selected.origin && selected.destination
                        ? `${selected.origin} → ${selected.destination}`
                        : selected.route_name;
                    })()}
                  </p>
                )}
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Service Provider
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, service_provider_id: null })}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${
                      form.service_provider_id === null
                        ? "bg-[#F2419B] text-white"
                        : isDark
                        ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                        : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                    }`}
                  >
                    None
                  </button>

                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, service_provider_id: p.id })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.service_provider_id === p.id
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Departure *
                  </p>
                  <input
                    type="datetime-local"
                    value={form.departure_datetime}
                    onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.departure_datetime)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>

                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Arrival *
                  </p>
                  <input
                    type="datetime-local"
                    value={form.arrival_datetime}
                    onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none ${fieldBorderClass(form.arrival_datetime)} ${
                      isDark ? "bg-[#0B1220] text-[#F2F1EC]" : "bg-white text-gray-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Frequency
                </p>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCY_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForm({ ...form, frequency: f })}
                      className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
                        form.frequency === f
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Day of Week
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const selected = parseDays(form.day_of_week).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-full px-4 py-1.5 text-sm transition ${
                          selected
                            ? "bg-[#F2419B] text-white"
                            : isDark
                            ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                            : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Capacity
                  </p>
                  <input
                    type="number"
                    placeholder="500"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>

                <div>
                  <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                    Cutoff (hrs)
                  </p>
                  <input
                    type="number"
                    placeholder="24"
                    value={form.cutoff_hours}
                    onChange={(e) => setForm({ ...form, cutoff_hours: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                      isDark
                        ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Unit Type
                </p>
                <div className="flex flex-wrap gap-2">
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setForm({ ...form, unit_type: u })}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${
                        form.unit_type === u
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-2 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
                        form.status === s
                          ? "bg-[#F2419B] text-white"
                          : isDark
                          ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                          : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={`mb-1.5 text-xs font-medium tracking-wide uppercase ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Notes
                </p>
                <textarea
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`h-20 w-full resize-none rounded-md border px-3 py-2.5 outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>

              {saveError && (
                <div className="border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
                  {saveError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className={`flex-1 rounded-md border py-2.5 text-sm font-medium transition ${
                  isDark
                    ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                    : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#F2419B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:bg-[#4B5A68]"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? (editingId ? "Updating…" : "Saving…") : editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}