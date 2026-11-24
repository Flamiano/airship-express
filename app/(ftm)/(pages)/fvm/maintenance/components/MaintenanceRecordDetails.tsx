"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarPlus, CheckCircle2, Pencil, Play, Wrench, X } from "lucide-react";
import { fetchJson } from "../../../../lib/api";
import {
  formatMaintenanceCurrency,
  formatMaintenanceDate,
  formatMaintenanceTime,
  getMaintenanceStatus,
  STATUS_LABEL,
  totalMaintenanceCost,
  vehicleLabel,
  type MaintenanceAuditEntry,
  type MaintenanceRecord,
  type MaintenanceVehicle,
} from "./maintenanceTypes";

type Props = {
  record: MaintenanceRecord;
  history: MaintenanceRecord[];
  vehiclesById: Map<string, MaintenanceVehicle>;
  canUpdate: boolean;
  onClose: () => void;
  onEdit: (record: MaintenanceRecord) => void;
  onRecordWork: (record: MaintenanceRecord) => void;
  onStart: (record: MaintenanceRecord) => void;
  onCancel: (record: MaintenanceRecord) => void;
  onFollowUp: (record: MaintenanceRecord) => void;
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: "border-pink-200 bg-pink-50 text-pink-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-900",
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[#fff9fc] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{value || "Not recorded"}</p></div>;
}

export default function MaintenanceRecordDetails({ record, history, vehiclesById, canUpdate, onClose, onEdit, onRecordWork, onStart, onCancel, onFollowUp }: Props) {
  const vehicle = vehiclesById.get(String(record.vehicle_id));
  const status = getMaintenanceStatus(record, vehicle);
  const recordHistory = history.filter((item) => String(item.vehicle_id) === String(record.vehicle_id) && String(item.id) !== String(record.id))
    .sort((left, right) => Date.parse(right.performed_at || right.scheduled_at || "") - Date.parse(left.performed_at || left.scheduled_at || ""));
  const issueKey = String(record.reported_issue || "").trim().toLowerCase();
  const repeatedIssueCount = issueKey ? history.filter((item) => String(item.vehicle_id) === String(record.vehicle_id) && String(item.reported_issue || "").trim().toLowerCase() === issueKey).length : 0;
  const inspection = Array.isArray(record.inspection_results) ? record.inspection_results : [];
  const parts = Array.isArray(record.replaced_parts) ? record.replaced_parts : [];
  const costRecorded = record.labor_cost != null || record.parts_cost != null || (record.cost != null && Number(record.cost) !== 0);
  const [audit, setAudit] = useState<MaintenanceAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("keydown", closeOnEscape); previous?.focus(); };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setAuditLoading(true);
      setAuditError("");
      void fetchJson(`/api/maintenance/audit?vehicle_id=${encodeURIComponent(String(record.vehicle_id))}`, { cache: "no-store" })
        .then((result) => { if (active) setAudit(Array.isArray(result) ? result as MaintenanceAuditEntry[] : []); })
        .catch((error) => { if (active) setAuditError(error instanceof Error ? error.message.replace(/^Request failed \\d+: /, "") : "Audit history is unavailable."); })
        .finally(() => { if (active) setAuditLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [record.vehicle_id]);

  return <div className="fixed inset-0 z-[1300] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="maintenance-detail-title" className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-pink-100 bg-[#fffafd] shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-pink-100 bg-white px-5 py-4 sm:px-6"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-pink-700">{record.id} · {vehicleLabel(vehicle, record.vehicle_id)}</p><h2 id="maintenance-detail-title" className="mt-1 truncate text-xl font-black text-slate-900">{record.maintenance_type}</h2><p className="mt-1 text-[10px] text-slate-500">{record.maintenance_category || "Category not recorded"}</p></div><button type="button" aria-label="Close maintenance details" onClick={onClose} className="rounded-lg border border-pink-100 p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button></header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink-100 bg-white p-3"><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span><p className="mt-2 text-[10px] text-slate-500">Vehicle status: <span className="font-bold text-slate-700">{vehicle?.status || "Not recorded"}</span></p></div>{canUpdate && <div className="flex flex-wrap gap-2">
          {status === "scheduled" || status === "overdue" ? <button type="button" onClick={() => onStart(record)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-amber-700"><Play className="h-3 w-3" />Start service</button> : null}
          {status === "in_progress" && <button type="button" onClick={() => onRecordWork(record)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-emerald-800"><CheckCircle2 className="h-3 w-3" />Record work & complete</button>}
          {status !== "completed" && status !== "cancelled" && <button type="button" onClick={() => onCancel(record)} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50">Cancel service</button>}
          <button type="button" onClick={() => onEdit(record)} className="inline-flex items-center gap-1.5 rounded-lg border border-pink-200 px-3 py-2 text-[10px] font-bold text-pink-700 hover:bg-pink-50"><Pencil className="h-3 w-3" />Edit</button>
        </div>}</section>

        {record.vehicle_status_warning && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">{record.vehicle_status_warning}</p>}
        {repeatedIssueCount > 1 && <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />This reported issue appears on {repeatedIssueCount} maintenance records for this vehicle.</div>}

        <section><h3 className="mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Service details</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Schedule source" value={record.is_automated ? `Automatic · ${record.maintenance_source || "system recommendation"}` : "Manually scheduled / confirmed"} />
          <Field label="Vehicle ID" value={record.vehicle_id} />
          <Field label="Category" value={record.maintenance_category || "Not recorded"} />
          <Field label="Priority" value={record.priority || "Not recorded"} />
          <Field label="Scheduled" value={`${formatMaintenanceDate(record.scheduled_at)} ${formatMaintenanceTime(record.scheduled_at)}`} />
          <Field label="Actual service" value={record.performed_at ? `${formatMaintenanceDate(record.performed_at)} ${formatMaintenanceTime(record.performed_at)}` : "Not recorded"} />
          <Field label="Odometer" value={record.odometer_reading == null ? "Not recorded" : `${Number(record.odometer_reading).toLocaleString()} km`} />
          <Field label="Mechanic / provider" value={record.mechanic || record.performed_by || "Not recorded"} />
          <Field label="Duration" value={record.duration_minutes ? `${record.duration_minutes} minutes` : "Not recorded"} />
          <Field label="Next due" value={record.next_due_date ? formatMaintenanceDate(record.next_due_date) : record.next_due_mileage != null ? `${Number(record.next_due_mileage).toLocaleString()} km` : "Not recorded"} />
        </div></section>

        {record.is_automated && <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-3"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-sky-900">Automatic trigger details</h3><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-sky-900"><p>Source: {String(record.trigger_data?.source || record.maintenance_source || "Not recorded")}</p><p>Calculated: {String(record.trigger_data?.calculated_at || "Not recorded")}</p><p>Previous odometer: {record.trigger_data?.previous_odometer_km == null ? "Not recorded" : `${Number(record.trigger_data.previous_odometer_km).toLocaleString()} km`}</p><p>Current odometer: {record.trigger_data?.current_odometer_km == null ? "Not recorded" : `${Number(record.trigger_data.current_odometer_km).toLocaleString()} km`}</p><p>Interval: {record.interval_days_snapshot == null ? "" : `${record.interval_days_snapshot} days`}{record.interval_days_snapshot != null && record.interval_km_snapshot != null ? " · " : ""}{record.interval_km_snapshot == null ? "" : `${Number(record.interval_km_snapshot).toLocaleString()} km`}{record.interval_days_snapshot == null && record.interval_km_snapshot == null ? "Not recorded" : ""}</p><p>Trigger: {String(record.trigger_data?.reason || "Not recorded")}</p></div></section>}

        {record.reported_issue && <section><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Reported issue</h3><p className="mt-2 whitespace-pre-wrap rounded-lg border border-pink-100 bg-white p-3 text-xs text-slate-700">{record.reported_issue}</p></section>}
        {record.diagnosis && <section><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Diagnosis</h3><p className="mt-2 whitespace-pre-wrap rounded-lg border border-pink-100 bg-white p-3 text-xs text-slate-700">{record.diagnosis}</p></section>}
        {record.work_performed && <section><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Work performed</h3><p className="mt-2 whitespace-pre-wrap rounded-lg border border-pink-100 bg-white p-3 text-xs text-slate-700">{String(record.work_performed)}</p></section>}

        <section className="rounded-xl border border-pink-100 bg-white p-3"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Inspection results</h3>{inspection.length ? <div className="mt-2 divide-y divide-pink-50">{inspection.map((item, index) => <div key={`${item.item}-${index}`} className="flex items-start justify-between gap-2 py-2"><span className="text-[10px] font-semibold text-slate-700">{item.item}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.result === "pass" ? "bg-emerald-50 text-emerald-700" : item.result === "attention" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`}>{item.result === "pass" ? "Pass" : item.result === "attention" ? "Needs attention" : "Not checked"}</span></div>)}</div> : <p className="mt-2 text-[10px] text-slate-400">Inspection results not recorded.</p>}</section>

        <section className="rounded-xl border border-pink-100 bg-white p-3"><div className="flex items-center justify-between"><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Replaced components</h3><Wrench className="h-3.5 w-3.5 text-pink-600" /></div>{parts.length ? <div className="mt-2 divide-y divide-pink-50">{parts.map((part, index) => <div key={`${part.name}-${index}`} className="flex justify-between gap-3 py-2 text-[10px]"><span className="font-semibold text-slate-700">{part.name} · {part.quantity}</span><span className="text-slate-500">{part.unit_cost == null ? "Cost not recorded" : formatMaintenanceCurrency(Number(part.unit_cost) * Number(part.quantity))}</span></div>)}</div> : <p className="mt-2 text-[10px] text-slate-400">No replaced components recorded.</p>}</section>

        <section className="grid grid-cols-2 gap-2"><Field label="Labor cost" value={record.labor_cost == null ? "Not recorded" : formatMaintenanceCurrency(Number(record.labor_cost))} /><Field label="Parts cost" value={record.parts_cost == null ? "Not recorded" : formatMaintenanceCurrency(Number(record.parts_cost))} /><div className="col-span-2 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2"><p className="text-[9px] font-bold uppercase text-pink-700">Total cost</p><p className="mt-1 text-sm font-black text-slate-900">{costRecorded ? formatMaintenanceCurrency(totalMaintenanceCost(record)) : "Not recorded"}</p></div></section>
        <section className="grid grid-cols-2 gap-2"><Field label="Cost review" value={record.cost_review_status || "Pending review"} /><Field label="Reviewed by" value={record.cost_reviewer_name || record.cost_reviewed_by || "Not reviewed"} />{record.cost_reviewed_at && <Field label="Reviewed at" value={`${formatMaintenanceDate(record.cost_reviewed_at)} ${formatMaintenanceTime(record.cost_reviewed_at)}`} />}{record.cost_review_notes && <div className="col-span-2"><Field label="Review remarks" value={record.cost_review_notes} /></div>}{record.source_cost_entry_id && <div className="col-span-2"><Field label="Linked Driver App expense ID" value={record.source_cost_entry_id} /></div>}</section>
        {record.notes && <section><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Notes</h3><p className="mt-2 whitespace-pre-wrap rounded-lg border border-pink-100 bg-white p-3 text-xs text-slate-700">{record.notes}</p></section>}

        <section className="rounded-xl border border-pink-100 bg-white p-3"><div><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Maintenance calculation audit</h3><p className="mt-1 text-[9px] text-slate-400">Trigger source, odometer evidence, interval, and manual changes</p></div>
          {auditLoading ? <div className="mt-3 h-10 animate-pulse rounded-lg bg-pink-50" /> : auditError ? <p role="status" className="mt-2 text-[10px] text-amber-800">{auditError}</p> : audit.length ? <div className="mt-2 divide-y divide-pink-50">{audit.slice(0, 12).map((entry) => <div key={entry.id} className="py-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-800">{entry.source.replace(/_/g, " ")}</span><span className="text-[9px] text-slate-400">{formatMaintenanceDate(entry.calculated_at)} {formatMaintenanceTime(entry.calculated_at)}</span></div><p className="mt-1 text-[9px] text-slate-600">Odometer: {entry.previous_odometer_km == null ? "Not recorded" : `${Number(entry.previous_odometer_km).toLocaleString()} km`} → {entry.current_odometer_km == null ? "Not recorded" : `${Number(entry.current_odometer_km).toLocaleString()} km`}</p><p className="mt-0.5 text-[9px] text-slate-500">Interval: {entry.interval_days == null ? "" : `${entry.interval_days} days`}{entry.interval_days != null && entry.interval_km != null ? " · " : ""}{entry.interval_km == null ? "Not recorded" : `${Number(entry.interval_km).toLocaleString()} km`} · Next {entry.next_due_date ? formatMaintenanceDate(entry.next_due_date) : entry.next_due_mileage == null ? "not calculated" : `${Number(entry.next_due_mileage).toLocaleString()} km`}</p>{entry.details?.reason && <p className="mt-0.5 text-[9px] text-slate-500">{String(entry.details.reason)}</p>}{Array.isArray(entry.details?.changed_fields) && <p className="mt-0.5 text-[9px] text-slate-500">Changed: {(entry.details.changed_fields as unknown[]).map(String).join(", ") || "No fields listed"}</p>}</div>)}</div> : <p className="mt-3 text-[10px] text-slate-400">No automation or manual audit events are recorded.</p>}
        </section>

        <section className="rounded-xl border border-pink-100 bg-white p-3"><div className="flex items-center justify-between gap-2"><div><h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Vehicle service history</h3><p className="mt-1 text-[9px] text-slate-400">Previous maintenance records for this vehicle</p></div><button type="button" onClick={() => onFollowUp(record)} className="inline-flex items-center gap-1 rounded-lg border border-pink-200 px-2.5 py-1.5 text-[9px] font-bold text-pink-700 hover:bg-pink-50"><CalendarPlus className="h-3 w-3" />Schedule follow-up</button></div>
          {recordHistory.length ? <div className="mt-2 divide-y divide-pink-50">{recordHistory.slice(0, 8).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="block text-[10px] font-bold text-slate-700">{item.maintenance_type}</span><span className="text-[9px] text-slate-400">{formatMaintenanceDate(item.performed_at || item.scheduled_at)} · {item.maintenance_category || "Category not recorded"}</span></span><span className="text-[9px] font-semibold text-slate-600">{item.cost == null || Number(item.cost) === 0 ? "Cost not recorded" : formatMaintenanceCurrency(totalMaintenanceCost(item))}</span></div>)}</div> : <p className="mt-3 text-[10px] text-slate-400">No other maintenance history for this vehicle.</p>}
        </section>
      </div>
    </section>
  </div>;
}