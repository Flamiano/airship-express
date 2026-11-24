"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  dateInputValue,
  formatMaintenanceTime,
  INSPECTION_ITEMS,
  MAINTENANCE_CATEGORIES,
  type InspectionResult,
  type MaintenanceRecord,
  type MaintenanceVehicle,
  type ReplacedPart,
} from "./maintenanceTypes";

type Props = {
  record: MaintenanceRecord | null;
  vehicles: MaintenanceVehicle[];
  existingCategories: string[];
  defaultDate?: Date;
  defaultVehicleId?: string;
  defaultStatus?: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

type FormState = {
  vehicle_id: string;
  maintenance_category: string;
  maintenance_type: string;
  scheduled_date: string;
  scheduled_time: string;
  performed_at: string;
  mechanic: string;
  priority: string;
  duration_minutes: string;
  status: string;
  odometer_reading: string;
  reported_issue: string;
  diagnosis: string;
  work_performed: string;
  inspection_results: InspectionResult[];
  replaced_parts: ReplacedPart[];
  labor_cost: string;
  parts_cost: string;
  next_due_date: string;
  next_due_mileage: string;
  notes: string;
  recurrence_rule: "none" | "weekly" | "monthly";
  recurrence_count: string;
};

const INPUT = "mt-1 block w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100";
const LABEL = "text-[10px] font-bold text-slate-600";

function localDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${dateInputValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function makeForm(record: MaintenanceRecord | null, defaultDate: Date, defaultVehicleId: string, defaultStatus?: string): FormState {
  const date = record?.scheduled_at ? new Date(record.scheduled_at) : defaultDate;
  const storedInspection = Array.isArray(record?.inspection_results) ? record.inspection_results : [];
  const inspectionResults = INSPECTION_ITEMS.map((item) => storedInspection.find((result) => result.item === item) || { item, result: "not_checked" as const });
  return {
    vehicle_id: record?.vehicle_id || defaultVehicleId,
    maintenance_category: record?.maintenance_category || "",
    maintenance_type: record?.maintenance_type || "",
    scheduled_date: Number.isFinite(date.getTime()) ? dateInputValue(date) : dateInputValue(defaultDate),
    scheduled_time: record?.scheduled_at ? formatMaintenanceTime(record.scheduled_at) : "09:00",
    performed_at: localDateTimeInput(record?.performed_at),
    mechanic: record?.mechanic || record?.performed_by || "",
    priority: record?.priority || "normal",
    duration_minutes: String(record?.duration_minutes || 60),
    status: defaultStatus || record?.status || "scheduled",
    odometer_reading: record?.odometer_reading == null ? "" : String(record.odometer_reading),
    reported_issue: record?.reported_issue || "",
    diagnosis: record?.diagnosis || "",
    work_performed: record?.work_performed || "",
    inspection_results: inspectionResults,
    replaced_parts: Array.isArray(record?.replaced_parts) ? record.replaced_parts.map((part) => ({ ...part })) : [],
    labor_cost: record?.labor_cost == null ? "" : String(record.labor_cost),
    parts_cost: record?.parts_cost == null ? "" : String(record.parts_cost),
    next_due_date: record?.next_due_date ? dateInputValue(new Date(record.next_due_date)) : "",
    next_due_mileage: record?.next_due_mileage == null ? "" : String(record.next_due_mileage),
    notes: record?.notes || "",
    recurrence_rule: (record?.recurrence_rule || "none") as FormState["recurrence_rule"],
    recurrence_count: "4",
  };
}

export default function MaintenanceRecordDialog({ record, vehicles, existingCategories, defaultDate = new Date(), defaultVehicleId = "", defaultStatus, saving, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(() => makeForm(record, defaultDate, defaultVehicleId, defaultStatus));
  const [validationError, setValidationError] = useState("");
  const availableCategories = [...new Set([...MAINTENANCE_CATEGORIES, ...existingCategories].filter(Boolean))].sort((a, b) => {
    const left = MAINTENANCE_CATEGORIES.indexOf(a as (typeof MAINTENANCE_CATEGORIES)[number]);
    const right = MAINTENANCE_CATEGORIES.indexOf(b as (typeof MAINTENANCE_CATEGORIES)[number]);
    if (left >= 0 && right >= 0) return left - right;
    if (left >= 0) return -1;
    if (right >= 0) return 1;
    return a.localeCompare(b);
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const partsCostFromLines = form.replaced_parts.reduce((sum, part) => sum + Number(part.quantity || 0) * Number(part.unit_cost || 0), 0);
  const laborValue = form.labor_cost === "" ? null : Number(form.labor_cost);
  const partsValue = form.parts_cost === "" ? (partsCostFromLines || null) : Number(form.parts_cost);
  const costPreview = laborValue == null && partsValue == null ? null : (laborValue || 0) + (partsValue || 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const labor = form.labor_cost === "" ? null : Number(form.labor_cost);
    const parts = form.parts_cost === "" ? (partsCostFromLines || null) : Number(form.parts_cost);
    const odometer = form.odometer_reading === "" ? null : Number(form.odometer_reading);
    const nextMileage = form.next_due_mileage === "" ? null : Number(form.next_due_mileage);
    const numericValues = [labor, parts, odometer, nextMileage].filter((value): value is number => value !== null);
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      setValidationError("Costs and mileage must be non-negative numbers.");
      return;
    }
    if (form.replaced_parts.some((part) => !part.name.trim() || !Number.isFinite(Number(part.quantity)) || Number(part.quantity) <= 0)) {
      setValidationError("Each replaced part needs a name and a quantity greater than zero.");
      return;
    }
    if (form.status === "completed" && !form.work_performed.trim()) {
      setValidationError("Record the work performed before completing this service.");
      return;
    }
    if (form.status === "completed" && !form.performed_at && !record?.performed_at) {
      setValidationError("Enter the actual service date and time before completing this record.");
      return;
    }
    const occurrenceCount = Number(form.recurrence_count);
    if (!record && form.recurrence_rule !== "none" && (!Number.isInteger(occurrenceCount) || occurrenceCount < 2 || occurrenceCount > 24)) {
      setValidationError("Recurring schedules must contain between 2 and 24 occurrences.");
      return;
    }
    const scheduled = new Date(`${form.scheduled_date}T${form.scheduled_time || "09:00"}:00`);
    if (!Number.isFinite(scheduled.getTime())) {
      setValidationError("Choose a valid scheduled date and time.");
      return;
    }
    const payload: Record<string, unknown> = {
      ...(record?.id ? { id: record.id } : {}),
      vehicle_id: form.vehicle_id,
      maintenance_category: form.maintenance_category.trim() || null,
      maintenance_type: form.maintenance_type.trim(),
      description: form.work_performed.trim() || form.maintenance_type.trim(),
      reported_issue: form.reported_issue.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      work_performed: form.work_performed.trim() || null,
      inspection_results: form.inspection_results.filter((item) => item.result !== "not_checked" || item.notes?.trim()),
      replaced_parts: form.replaced_parts.filter((part) => part.name.trim()).map((part) => ({ name: part.name.trim(), quantity: Number(part.quantity), unit_cost: part.unit_cost == null ? null : Number(part.unit_cost) })),
      odometer_reading: odometer,
      mechanic: form.mechanic.trim() || null,
      priority: form.priority,
      duration_minutes: Number(form.duration_minutes),
      scheduled_at: scheduled.toISOString(),
      performed_at: form.performed_at ? new Date(form.performed_at).toISOString() : record?.performed_at || null,
      next_due_date: form.next_due_date || null,
      next_due_mileage: nextMileage,
      labor_cost: labor,
      parts_cost: parts,
      cost: labor == null && parts == null ? null : (labor || 0) + (parts || 0),
      notes: form.notes.trim() || null,
      status: form.status,
      recurrence_rule: form.recurrence_rule,
      recurrence_series_id: record?.recurrence_series_id || null,
      recurrence_count: record ? 1 : form.recurrence_rule === "none" ? 1 : occurrenceCount,
    };
    await onSubmit(payload);
  }

  return <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="maintenance-form-title" className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-pink-100 bg-[#fffafd] shadow-2xl sm:rounded-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-pink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6"><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-pink-700">Maintenance record</p><h2 id="maintenance-form-title" className="mt-1 text-lg font-black text-slate-900">{record ? "Edit service record" : "Schedule maintenance"}</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close maintenance form" className="rounded-lg border border-pink-100 p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button></header>
      <form onSubmit={(event) => void submit(event)} className="space-y-5 p-4 sm:p-6">
        {(validationError || error) && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">{validationError || error}</div>}
        <section><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Vehicle and service</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={LABEL}>Vehicle <span className="text-rose-600">*</span><select required value={form.vehicle_id} onChange={(event) => setField("vehicle_id", event.target.value)} className={INPUT}><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number || vehicle.id} · {[vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Vehicle"}</option>)}</select></label>
          <label className={LABEL}>Category <span className="text-rose-600">*</span><input required list="maintenance-categories" value={form.maintenance_category} onChange={(event) => setField("maintenance_category", event.target.value)} className={INPUT} placeholder="Choose or enter category" /><datalist id="maintenance-categories">{availableCategories.map((category) => <option key={category} value={category} />)}</datalist></label>
          <label className={LABEL}>Service / repair <span className="text-rose-600">*</span><input required value={form.maintenance_type} onChange={(event) => setField("maintenance_type", event.target.value)} className={INPUT} placeholder="Oil and filter change" /></label>
          <label className={LABEL}>Scheduled date<input required type="date" value={form.scheduled_date} onChange={(event) => setField("scheduled_date", event.target.value)} className={INPUT} /></label>
          <label className={LABEL}>Scheduled time<input required type="time" value={form.scheduled_time} onChange={(event) => setField("scheduled_time", event.target.value)} className={INPUT} /></label>
          <label className={LABEL}>Priority<select value={form.priority} onChange={(event) => setField("priority", event.target.value)} className={INPUT}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label className={LABEL}>Mechanic / service provider<input value={form.mechanic} onChange={(event) => setField("mechanic", event.target.value)} className={INPUT} /></label>
          <label className={LABEL}>Estimated / actual duration<select value={form.duration_minutes} onChange={(event) => setField("duration_minutes", event.target.value)} className={INPUT}>{[30, 60, 90, 120, 240, 480, 720, 1440].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}</option>)}</select></label>
          <label className={LABEL}>Status<select value={form.status} onChange={(event) => setField("status", event.target.value)} className={INPUT}><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        </div></section>

        <section><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Condition and work record</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>Reported issue<textarea rows={2} value={form.reported_issue} onChange={(event) => setField("reported_issue", event.target.value)} className={`${INPUT} resize-y`} placeholder="Describe the reported fault; leave blank if none was reported." /></label>
          <label className={LABEL}>Diagnosis<textarea rows={2} value={form.diagnosis} onChange={(event) => setField("diagnosis", event.target.value)} className={`${INPUT} resize-y`} placeholder="Enter only a confirmed diagnosis." /></label>
          <label className={`${LABEL} sm:col-span-2`}>Work performed<textarea rows={3} value={form.work_performed} onChange={(event) => setField("work_performed", event.target.value)} className={`${INPUT} resize-y`} placeholder="Record completed work. Do not mark complete until documented." /></label>
          <label className={LABEL}>Actual service date and time<input type="datetime-local" value={form.performed_at} onChange={(event) => setField("performed_at", event.target.value)} className={INPUT} /></label>
          <label className={LABEL}>Odometer reading (km)<input type="number" min="0" step="any" value={form.odometer_reading} onChange={(event) => setField("odometer_reading", event.target.value)} className={INPUT} placeholder="Not recorded" /></label>
        </div></section>

        <section className="rounded-xl border border-pink-100 bg-white p-3 sm:p-4"><div><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Inspection and safety checks</h3><p className="mt-1 text-[9px] text-slate-400">Only mark items that were actually inspected.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{form.inspection_results.map((item, index) => <div key={item.item} className="grid grid-cols-[minmax(90px,1fr)_132px] items-center gap-2 rounded-lg bg-[#fff9fc] px-2.5 py-2"><span className="text-[10px] font-semibold text-slate-700">{item.item}</span><select aria-label={`${item.item} inspection result`} value={item.result} onChange={(event) => setField("inspection_results", form.inspection_results.map((current, i) => i === index ? { ...current, result: event.target.value as InspectionResult["result"] } : current))} className="rounded-md border border-pink-100 bg-white px-2 py-1.5 text-[9px] text-slate-700"><option value="not_checked">Not checked</option><option value="pass">Pass</option><option value="attention">Needs attention</option></select></div>)}</div></section>

        <section className="rounded-xl border border-pink-100 bg-white p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><div><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Parts replaced</h3><p className="mt-1 text-[9px] text-slate-400">Leave empty when no parts were replaced.</p></div><button type="button" onClick={() => setField("replaced_parts", [...form.replaced_parts, { name: "", quantity: 1, unit_cost: null }])} className="inline-flex items-center gap-1 rounded-lg border border-pink-200 px-2.5 py-1.5 text-[9px] font-bold text-pink-700 hover:bg-pink-50"><Plus className="h-3 w-3" />Add part</button></div>
          <div className="mt-3 space-y-2">{form.replaced_parts.map((part, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_95px_130px_34px]"><label className={`${LABEL} sr-only`}>Part name<input aria-label="Part name" value={part.name} onChange={(event) => setField("replaced_parts", form.replaced_parts.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} className={INPUT} placeholder="Part name" /></label><label className={`${LABEL} sr-only`}>Quantity<input aria-label="Part quantity" type="number" min="0.01" step="any" value={part.quantity} onChange={(event) => setField("replaced_parts", form.replaced_parts.map((row, i) => i === index ? { ...row, quantity: Number(event.target.value) } : row))} className={INPUT} /></label><label className={`${LABEL} sr-only`}>Unit cost<input aria-label="Part unit cost" type="number" min="0" step="0.01" value={part.unit_cost ?? ""} onChange={(event) => setField("replaced_parts", form.replaced_parts.map((row, i) => i === index ? { ...row, unit_cost: event.target.value === "" ? null : Number(event.target.value) } : row))} className={INPUT} placeholder="Unit cost (PHP)" /></label><button type="button" aria-label={`Remove ${part.name || "part"}`} onClick={() => setField("replaced_parts", form.replaced_parts.filter((_, i) => i !== index))} className="mt-1 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50"><Trash2 className="mx-auto h-3.5 w-3.5" /></button></div>)}</div>
        </section>

        <section><h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Costs and next service</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={LABEL}>Labor cost (PHP)<input type="number" min="0" step="0.01" value={form.labor_cost} onChange={(event) => setField("labor_cost", event.target.value)} className={INPUT} placeholder="Not recorded" /></label>
          <label className={LABEL}>Parts cost (PHP)<input type="number" min="0" step="0.01" value={form.parts_cost} onChange={(event) => setField("parts_cost", event.target.value)} className={INPUT} placeholder="Can be calculated from parts" /></label>
          <label className={LABEL}>Next service date<input type="date" value={form.next_due_date} onChange={(event) => setField("next_due_date", event.target.value)} className={INPUT} /></label>
          <label className={LABEL}>Next service mileage (km)<input type="number" min="0" step="any" value={form.next_due_mileage} onChange={(event) => setField("next_due_mileage", event.target.value)} className={INPUT} /></label>
        </div><div className="mt-3 flex items-center justify-between rounded-lg bg-pink-50/70 px-3 py-2"><span className="text-[10px] font-bold text-slate-600">Total recorded cost</span><span className="text-sm font-black text-pink-800">{costPreview == null ? "Not recorded" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(costPreview)}</span></div></section>

        <section className="grid gap-3 rounded-xl border border-pink-100 bg-white p-3 sm:grid-cols-[1fr_170px]"><label className={LABEL}>Recurring schedule<select disabled={Boolean(record)} value={form.recurrence_rule} onChange={(event) => setField("recurrence_rule", event.target.value as FormState["recurrence_rule"])} className={INPUT}><option value="none">Does not repeat</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>{form.recurrence_rule !== "none" && <label className={LABEL}>Occurrences<input disabled={Boolean(record)} type="number" min="2" max="24" value={form.recurrence_count} onChange={(event) => setField("recurrence_count", event.target.value)} className={INPUT} /></label>}{record && record.recurrence_rule && record.recurrence_rule !== "none" && <p className="text-[9px] text-slate-400 sm:col-span-2">Edits apply to this occurrence; other scheduled records in its series remain unchanged.</p>}</section>

        <label className={`${LABEL} block`}>Notes<textarea rows={2} value={form.notes} onChange={(event) => setField("notes", event.target.value)} className={`${INPUT} resize-y`} /></label>
        <footer className="flex flex-col-reverse gap-2 border-t border-pink-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-pink-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-pink-800 disabled:opacity-50">{saving ? "Saving…" : form.status === "completed" ? "Save completed work" : record ? "Save maintenance record" : "Schedule service"}</button></footer>
      </form>
    </section>
  </div>;
}