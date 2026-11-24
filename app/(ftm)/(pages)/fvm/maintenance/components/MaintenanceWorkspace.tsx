"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Filter, Plus, RefreshCw, Search, Wrench, X } from "lucide-react";
import { fetchJson, updateVehicle } from "../../../../lib/api";
import { getCurrentRole, hasAppPermission } from "../../../../lib/roleAccess";
import MaintenanceCalendar from "./MaintenanceCalendar";
import MaintenanceOverview from "./MaintenanceOverview";
import MaintenanceRecordDetails from "./MaintenanceRecordDetails";
import MaintenanceRecordDialog from "./MaintenanceRecordDialog";
import MaintenanceRecordTable, { type MaintenanceSortKey } from "./MaintenanceRecordTable";
import MaintenancePolicyDialog from "./MaintenancePolicyDialog";
import {
  getMaintenanceStatus,
  MAINTENANCE_CATEGORIES,
  type CalendarView,
  type MaintenanceRecord,
  type MaintenanceVehicle,
  type RecordStatus,
} from "./maintenanceTypes";

type ConfirmAction = { record: MaintenanceRecord; status: "in_progress" | "cancelled" } | null;

function errorText(error: unknown) {
  return error instanceof Error ? error.message.replace(/^Request failed \d+: /, "") : "The request could not be completed.";
}

function notifyCostDataChanged() {
  window.localStorage.setItem("ftm:costs-updated", String(Date.now()));
  window.dispatchEvent(new Event("ftm:costs-updated"));
}

export default function MaintenanceWorkspace() {
  const [role, setRole] = useState<string | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<MaintenanceVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortKey, setSortKey] = useState<MaintenanceSortKey>("scheduled_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [dialogDate, setDialogDate] = useState<Date>(new Date());
  const [dialogVehicleId, setDialogVehicleId] = useState("");
  const [dialogStatus, setDialogStatus] = useState<string | undefined>();
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRole(getCurrentRole()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const canCreate = hasAppPermission(role, "fvm", "create");
  const canUpdate = hasAppPermission(role, "fvm", "update");

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    const [maintenanceResult, vehicleResult] = await Promise.allSettled([
      fetchJson("/api/maintenance", { cache: "no-store" }),
      fetchJson("/api/vehicles", { cache: "no-store" }),
    ]);
    if (maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value)) {
      setRecords(maintenanceResult.value as MaintenanceRecord[]);
    } else if (maintenanceResult.status === "rejected") {
      setLoadError(errorText(maintenanceResult.reason));
    }
    if (vehicleResult.status === "fulfilled" && Array.isArray(vehicleResult.value)) {
      setVehicles(vehicleResult.value as MaintenanceVehicle[]);
    } else if (vehicleResult.status === "rejected") {
      setLoadError((current) => current ? `${current} · Vehicle references are unavailable: ${errorText(vehicleResult.reason)}` : `Vehicle references are unavailable: ${errorText(vehicleResult.reason)}`);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadData(), 0);
    const interval = window.setInterval(() => void loadData(true), 60_000);
    const onCostChange = (event: StorageEvent) => { if (event.key === "ftm:costs-updated") void loadData(true); };
    const onCostChangeLocal = () => void loadData(true);
    window.addEventListener("storage", onCostChange);
    window.addEventListener("ftm:costs-updated", onCostChangeLocal);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
      window.removeEventListener("storage", onCostChange);
      window.removeEventListener("ftm:costs-updated", onCostChangeLocal);
    };
  }, [loadData]);

  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle])), [vehicles]);
  const categories = useMemo(() => [...new Set([...MAINTENANCE_CATEGORIES, ...records.map((record) => record.maintenance_category).filter((value): value is string => Boolean(value))])], [records]);
  const statuses = useMemo(() => ["scheduled", "in_progress", "overdue", "completed", "cancelled"] as RecordStatus[], []);

  const filtered = useMemo(() => records.filter((record) => {
    const vehicle = vehiclesById.get(String(record.vehicle_id));
    const status = getMaintenanceStatus(record, vehicle);
    if (vehicleFilter !== "all" && String(record.vehicle_id) !== vehicleFilter) return false;
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (categoryFilter !== "all" && String(record.maintenance_category || "") !== categoryFilter) return false;
    if (priorityFilter !== "all" && String(record.priority || "normal") !== priorityFilter) return false;
    if (search) {
      const haystack = [
        record.id,
        vehicle?.plate_number,
        vehicle?.id,
        record.maintenance_category,
        record.maintenance_type,
        record.reported_issue,
        record.diagnosis,
        record.work_performed,
        record.mechanic,
        record.performed_by,
        record.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [records, vehiclesById, vehicleFilter, statusFilter, categoryFilter, priorityFilter, search]);

  const selectedRecord = selectedId ? records.find((record) => String(record.id) === selectedId) || null : null;
  const existingCategories = useMemo(() => [...new Set(records.map((record) => record.maintenance_category).filter((category): category is string => Boolean(category)))], [records]);

  function clearFilters() {
    setSearch("");
    setVehicleFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setPage(1);
  }

  function openSchedule(date = new Date(), vehicleId = "") {
    setEditing(null);
    setDialogDate(date);
    setDialogVehicleId(vehicleId);
    setDialogStatus(undefined);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(record: MaintenanceRecord, status?: string) {
    setEditing(record);
    setDialogDate(record.scheduled_at ? new Date(record.scheduled_at) : new Date());
    setDialogVehicleId(record.vehicle_id);
    setDialogStatus(status);
    setFormError("");
    setDialogOpen(true);
  }

  async function saveRecord(payload: Record<string, unknown>) {
    setSaving(true);
    setFormError("");
    const saved: MaintenanceRecord[] = [];
    try {
      const isEditing = Boolean(editing?.id);
      const recurrenceRule = String(payload.recurrence_rule || "none");
      const occurrenceCount = isEditing || recurrenceRule === "none" ? 1 : Number(payload.recurrence_count || 1);
      const seriesId = !isEditing && recurrenceRule !== "none" ? window.crypto.randomUUID() : payload.recurrence_series_id;
      for (let index = 0; index < occurrenceCount; index += 1) {
        const occurrence = { ...payload };
        delete occurrence.recurrence_count;
        if (recurrenceRule !== "none" && occurrenceCount > 1) {
          occurrence.recurrence_series_id = seriesId;
          const occurrenceDate = new Date(String(payload.scheduled_at));
          if (recurrenceRule === "weekly") occurrenceDate.setDate(occurrenceDate.getDate() + index * 7);
          if (recurrenceRule === "monthly" && index > 0) {
            const dayOfMonth = occurrenceDate.getDate();
            occurrenceDate.setDate(1);
            occurrenceDate.setMonth(occurrenceDate.getMonth() + index);
            occurrenceDate.setDate(Math.min(dayOfMonth, new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth() + 1, 0).getDate()));
          }
          occurrence.scheduled_at = occurrenceDate.toISOString();
        }
        const result = await fetchJson("/api/maintenance", {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(occurrence),
        }) as MaintenanceRecord;
        saved.push(result);
      }
      const result = saved[0];
      setRecords((current) => {
        const next = [...current];
        saved.forEach((item) => {
          const recordIndex = next.findIndex((existing) => String(existing.id) === String(item.id));
          if (recordIndex < 0) next.unshift(item);
          else next[recordIndex] = item;
        });
        return next;
      });
      setSelectedId(String(result.id));
      setDialogOpen(false);
      setEditing(null);
      setSuccess(result.vehicle_status_warning || (saved.length > 1 ? `${saved.length} recurring services scheduled.` : `${result.maintenance_type} ${isEditing ? "updated" : "scheduled"}.`));
      notifyCostDataChanged();
      window.setTimeout(() => setSuccess(""), 5000);
      await loadData(true);
    } catch (error) {
      setFormError(errorText(error));
      if (saved.length) {
        setSuccess(`${saved.length} recurring service${saved.length === 1 ? "" : "s"} saved before a later occurrence failed.`);
        await loadData(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(record: MaintenanceRecord, status: "in_progress" | "cancelled") {
    setConfirming(true);
    setLoadError("");
    try {
      const updated = await fetchJson("/api/maintenance", {
        method: "PATCH",
        body: JSON.stringify({ ...record, status }),
      }) as MaintenanceRecord;
      setRecords((current) => current.map((item) => String(item.id) === String(updated.id) ? updated : item));
      setSelectedId(String(updated.id));
      setConfirm(null);
      setSuccess(updated.vehicle_status_warning || `${updated.maintenance_type} marked ${status === "in_progress" ? "in progress" : "cancelled"}.`);
      notifyCostDataChanged();
      window.setTimeout(() => setSuccess(""), 5000);
      await loadData(true);
    } catch (error) {
      setLoadError(errorText(error));
      setConfirm(null);
    } finally {
      setConfirming(false);
    }
  }

  async function savePolicy(vehicleId: string, policy: Record<string, unknown>) {
    setPolicySaving(true);
    setPolicyError("");
    try {
      await updateVehicle(vehicleId, policy);
      setPolicyDialogOpen(false);
      setSuccess("Maintenance intervals saved. The backend recalculated this vehicle's next service thresholds.");
      window.setTimeout(() => setSuccess(""), 5000);
      await loadData(true);
    } catch (error) {
      setPolicyError(errorText(error));
    } finally {
      setPolicySaving(false);
    }
  }

  function toggleSort(key: MaintenanceSortKey) {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  }

  return <main className="fvm-page-shell min-h-[calc(100vh-80px)] px-3 py-4 text-slate-800 sm:px-5 lg:px-7"><div className="mx-auto max-w-[1640px] space-y-4">
    <header className="flex flex-col justify-between gap-3 rounded-2xl border border-pink-100 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(236,72,153,0.07)] sm:flex-row sm:items-center sm:px-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-700"><Wrench className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.19em] text-pink-700">Fleet & Vehicle Management</p><h1 className="mt-0.5 text-xl font-black text-slate-900">Maintenance operations</h1><p className="mt-1 text-[10px] text-slate-500">Plan service, document work, manage cost, and follow the next due interval.</p></div></div><div className="flex flex-wrap gap-2 self-start sm:self-auto"><button type="button" onClick={() => void loadData(true)} disabled={refreshing} aria-label="Refresh maintenance records" className="rounded-lg border border-pink-200 bg-white p-2.5 text-slate-600 hover:bg-pink-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>{canUpdate && <button type="button" onClick={() => { setPolicyError(""); setPolicyDialogOpen(true); }} className="rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-xs font-bold text-pink-700 hover:bg-pink-50">Service intervals</button>}{canCreate && <button type="button" onClick={() => openSchedule()} className="inline-flex items-center gap-2 rounded-lg bg-pink-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-pink-800"><Plus className="h-4 w-4" />Schedule maintenance</button>}</div></header>

    {(loadError || success) && <div role={loadError ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${loadError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{loadError || success}</span>{loadError && <button type="button" onClick={() => void loadData()} className="ml-auto font-bold underline">Retry</button>}</div>}
    {!loading && <MaintenanceOverview records={records} vehicles={vehicles} vehiclesById={vehiclesById} onSelect={(record) => setSelectedId(String(record.id))} />}

    <MaintenanceCalendar records={filtered} vehiclesById={vehiclesById} date={calendarDate} view={calendarView} onDateChange={setCalendarDate} onViewChange={setCalendarView} onSchedule={openSchedule} onSelect={(record) => setSelectedId(String(record.id))} />

    <section className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)] sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black text-slate-900">Service register</h2><p className="mt-0.5 text-[10px] text-slate-500">Search and filter recorded work by vehicle, category, urgency, and status.</p></div>{(search || vehicleFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all") && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold text-pink-700 hover:bg-pink-50"><X className="h-3 w-3" />Clear filters</button>}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(125px,1fr))]"><label className="relative"><span className="sr-only">Search maintenance records</span><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search vehicle, service, issue, provider…" className="w-full rounded-lg border border-pink-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label><label className="flex items-center gap-2 rounded-lg border border-pink-200 px-2.5"><Wrench className="h-3.5 w-3.5 text-pink-600" /><span className="sr-only">Filter vehicle</span><select value={vehicleFilter} onChange={(event) => { setVehicleFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent py-2.5 text-[10px] text-slate-700 outline-none"><option value="all">All vehicles</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number || vehicle.id}</option>)}</select></label><label className="flex items-center gap-2 rounded-lg border border-pink-200 px-2.5"><Filter className="h-3.5 w-3.5 text-pink-600" /><span className="sr-only">Filter status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent py-2.5 text-[10px] text-slate-700 outline-none"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label><label className="flex items-center gap-2 rounded-lg border border-pink-200 px-2.5"><span className="sr-only">Filter category</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent py-2.5 text-[10px] text-slate-700 outline-none"><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="flex items-center gap-2 rounded-lg border border-pink-200 px-2.5"><span className="sr-only">Filter priority</span><select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent py-2.5 text-[10px] text-slate-700 outline-none"><option value="all">All priorities</option>{["urgent", "high", "normal", "low"].map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>)}</select></label></div></section>

    {loading ? <section className="space-y-2 rounded-xl border border-pink-100 bg-white p-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-pink-50" />)}</section> : <MaintenanceRecordTable records={filtered} vehiclesById={vehiclesById} page={page} pageSize={pageSize} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} onSelect={(record) => setSelectedId(String(record.id))} />}

    {!loading && records.length === 0 && !loadError && <section className="rounded-xl border border-dashed border-pink-200 bg-white px-5 py-10 text-center"><CalendarPlus className="mx-auto h-7 w-7 text-pink-300" /><h2 className="mt-2 text-sm font-black text-slate-800">No maintenance records</h2><p className="mt-1 text-[10px] text-slate-500">Schedule the first service from a real vehicle record.</p>{canCreate && <button type="button" onClick={() => openSchedule()} className="mt-3 rounded-lg bg-pink-700 px-3 py-2 text-[10px] font-bold text-white">Schedule first service</button>}</section>}
  </div>

  {dialogOpen && <MaintenanceRecordDialog key={`${editing?.id || "new"}-${dialogStatus || "default"}`} record={editing} vehicles={vehicles} existingCategories={existingCategories} defaultDate={dialogDate} defaultVehicleId={dialogVehicleId} defaultStatus={dialogStatus} saving={saving} error={formError} onClose={() => { if (!saving) { setDialogOpen(false); setEditing(null); } }} onSubmit={saveRecord} />}
  {policyDialogOpen && <MaintenancePolicyDialog vehicles={vehicles} records={records} saving={policySaving} error={policyError} onClose={() => { if (!policySaving) setPolicyDialogOpen(false); }} onSave={savePolicy} />}
  {selectedRecord && <MaintenanceRecordDetails record={selectedRecord} history={records} vehiclesById={vehiclesById} canUpdate={canUpdate} onClose={() => { setSelectedId(null); setConfirm(null); }} onEdit={(record) => openEdit(record)} onRecordWork={(record) => openEdit(record, "completed")} onStart={(record) => setConfirm({ record, status: "in_progress" })} onCancel={(record) => setConfirm({ record, status: "cancelled" })} onFollowUp={(record) => { const due = record.next_due_date ? new Date(record.next_due_date) : new Date(Date.now() + 30 * 86_400_000); openSchedule(due, record.vehicle_id); }} />}
  {confirm && <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirming) setConfirm(null); }}><section role="dialog" aria-modal="true" aria-labelledby="maintenance-confirm-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl"><h2 id="maintenance-confirm-title" className="text-sm font-black text-slate-900">{confirm.status === "in_progress" ? "Start this service?" : "Cancel this service?"}</h2><p className="mt-2 text-xs leading-relaxed text-slate-600">{confirm.status === "in_progress" ? `Starting ${confirm.record.maintenance_type} will mark ${vehiclesById.get(String(confirm.record.vehicle_id))?.plate_number || confirm.record.vehicle_id} Under Maintenance. The system blocks this while a trip is active.` : `Cancel ${confirm.record.maintenance_type}? The maintenance history will be retained.`}</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={confirming} onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Keep record</button><button type="button" disabled={confirming} onClick={() => void updateStatus(confirm.record, confirm.status)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${confirm.status === "cancelled" ? "bg-rose-600" : "bg-amber-600"}`}>{confirming ? "Updating…" : confirm.status === "in_progress" ? "Start service" : "Confirm cancellation"}</button></div></section></div>}
  </main>;
}