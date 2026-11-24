"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { formatMaintenanceDate, type MaintenanceRecord, type MaintenanceVehicle } from "./maintenanceTypes";

type Props = {
  vehicles: MaintenanceVehicle[];
  records: MaintenanceRecord[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (vehicleId: string, policy: Record<string, unknown>) => Promise<void>;
};

type PolicyDraft = {
  intervalDays: string;
  intervalKm: string;
  dueSoonKm: string;
  recurringFaultLimit: string;
  baseDate: string;
  baseOdometer: string;
};

const INPUT = "mt-1 block w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100";

export default function MaintenancePolicyDialog({ vehicles, records, saving, error, onClose, onSave }: Props) {
  const [vehicleId, setVehicleId] = useState("");
  const vehicle = vehicles.find((item) => String(item.id) === vehicleId) || null;
  const [drafts, setDrafts] = useState<Record<string, PolicyDraft>>({});
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving]);

  const defaultDraft: PolicyDraft = {
    intervalDays: vehicle?.maintenance_interval_days == null ? "" : String(vehicle.maintenance_interval_days),
    intervalKm: vehicle?.maintenance_interval_km == null ? "" : String(vehicle.maintenance_interval_km),
    dueSoonKm: vehicle?.maintenance_due_soon_km == null ? "" : String(vehicle.maintenance_due_soon_km),
    recurringFaultLimit: vehicle?.maintenance_recurring_fault_limit == null ? "" : String(vehicle.maintenance_recurring_fault_limit),
    baseDate: vehicle?.maintenance_base_date?.slice(0, 10) || "",
    baseOdometer: vehicle?.maintenance_base_odometer == null ? "" : String(vehicle.maintenance_base_odometer),
  };
  const draft = drafts[vehicleId] || defaultDraft;
  function setDraft<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    if (!vehicleId) return;
    setDrafts((current) => ({ ...current, [vehicleId]: { ...(current[vehicleId] || defaultDraft), [key]: value } }));
  }

  const latestCompleted = records.filter((record) => String(record.vehicle_id) === vehicleId && record.status === "completed")
    .sort((left, right) => Date.parse(right.performed_at || "") - Date.parse(left.performed_at || ""))[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    if (!vehicleId) { setValidationError("Select a vehicle for this policy."); return; }
    const days = draft.intervalDays === "" ? null : Number(draft.intervalDays);
    const km = draft.intervalKm === "" ? null : Number(draft.intervalKm);
    const dueSoon = draft.dueSoonKm === "" ? null : Number(draft.dueSoonKm);
    const faultLimit = draft.recurringFaultLimit === "" ? null : Number(draft.recurringFaultLimit);
    const baselineKm = draft.baseOdometer === "" ? null : Number(draft.baseOdometer);
    if (days !== null && (!Number.isInteger(days) || days <= 0)) { setValidationError("Time interval must be a positive whole number of days."); return; }
    if (km !== null && (!Number.isFinite(km) || km <= 0)) { setValidationError("Mileage interval must be greater than zero kilometers."); return; }
    if (dueSoon !== null && (!Number.isFinite(dueSoon) || dueSoon < 0 || km == null)) { setValidationError("A due-soon kilometer threshold requires a configured mileage interval."); return; }
    if (faultLimit !== null && (!Number.isInteger(faultLimit) || faultLimit < 2)) { setValidationError("Recurring-fault threshold must be a whole number of at least 2 reports."); return; }
    if (baselineKm !== null && (!Number.isFinite(baselineKm) || baselineKm < 0)) { setValidationError("Baseline odometer must be a non-negative number."); return; }
    if (days !== null && !draft.baseDate && !latestCompleted?.performed_at) { setValidationError("Enter a verified last-service date or complete a maintenance record with its actual service date."); return; }
    if (km !== null && baselineKm == null && latestCompleted?.odometer_reading == null) { setValidationError("Enter a verified baseline odometer or complete a maintenance record with its odometer reading."); return; }

    await onSave(vehicleId, {
      maintenance_interval_days: days,
      maintenance_interval_km: km,
      maintenance_due_soon_km: dueSoon,
      maintenance_recurring_fault_limit: faultLimit,
      maintenance_base_date: draft.baseDate || null,
      maintenance_base_odometer: baselineKm,
    });
  }

  return <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="maintenance-policy-title" className="w-full max-w-2xl overflow-hidden rounded-t-2xl border border-pink-100 bg-[#fffafd] shadow-2xl sm:rounded-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-pink-100 bg-white px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-pink-700">Fleet manager settings</p><h2 id="maintenance-policy-title" className="mt-1 text-lg font-black text-slate-900">Service interval policy</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close service policy" className="rounded-lg border border-pink-100 p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button></header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-4 sm:p-5">
        {(validationError || error) && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">{validationError || error}</div>}
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-[10px] leading-relaxed text-sky-900">Only enter an interval from a verified manufacturer recommendation or an approved fleet policy. Blank intervals stay disabled; no default interval is assumed.</p>
        <label className="block text-[10px] font-bold text-slate-600">Vehicle<select required value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setValidationError(""); }} className={INPUT}><option value="">Select vehicle</option>{vehicles.map((item) => <option key={item.id} value={item.id}>{item.plate_number || item.id} · {[item.manufacturer, item.model].filter(Boolean).join(" ") || item.vehicle_type || "Vehicle"}</option>)}</select></label>
        {vehicle && <>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold text-slate-600">Service interval (days)<input type="number" min="1" step="1" value={draft.intervalDays} onChange={(event) => setDraft("intervalDays", event.target.value)} className={INPUT} placeholder="Not configured" /></label><label className="text-[10px] font-bold text-slate-600">Service interval (km)<input type="number" min="0.1" step="any" value={draft.intervalKm} onChange={(event) => setDraft("intervalKm", event.target.value)} className={INPUT} placeholder="Not configured" /></label><label className="text-[10px] font-bold text-slate-600">Due-soon warning distance (km)<input type="number" min="0" step="any" value={draft.dueSoonKm} onChange={(event) => setDraft("dueSoonKm", event.target.value)} className={INPUT} placeholder="Optional; no default" /></label><label className="text-[10px] font-bold text-slate-600">Recurring fault escalation (reports / 90 days)<input type="number" min="2" step="1" value={draft.recurringFaultLimit} onChange={(event) => setDraft("recurringFaultLimit", event.target.value)} className={INPUT} placeholder="Not configured" /></label><label className="text-[10px] font-bold text-slate-600">Verified baseline service date<input type="date" value={draft.baseDate} onChange={(event) => setDraft("baseDate", event.target.value)} className={INPUT} /><span className="mt-1 block text-[9px] font-normal text-slate-400">Latest completed: {latestCompleted?.performed_at ? formatMaintenanceDate(latestCompleted.performed_at) : "Not recorded"}</span></label><label className="text-[10px] font-bold text-slate-600">Verified baseline odometer (km)<input type="number" min="0" step="any" value={draft.baseOdometer} onChange={(event) => setDraft("baseOdometer", event.target.value)} className={INPUT} placeholder={latestCompleted?.odometer_reading == null ? "Not recorded; enter only if verified" : `Latest completed: ${Number(latestCompleted.odometer_reading).toLocaleString()} km`} /></label></div>
          <div className="rounded-lg bg-white px-3 py-2.5 text-[10px] text-slate-600"><span className="font-bold">Current odometer:</span> {vehicle.mileage == null ? "Not recorded" : `${Number(vehicle.mileage).toLocaleString()} km`}<span className="ml-2 text-slate-400">· {vehicle.maintenance_attention_status || "Policy not calculated"}</span></div>
        </>}
        <footer className="flex justify-end gap-2 border-t border-pink-100 pt-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancel</button><button type="submit" disabled={saving || !vehicleId} className="rounded-lg bg-pink-700 px-4 py-2 text-xs font-bold text-white hover:bg-pink-800 disabled:opacity-50">{saving ? "Saving…" : "Save policy"}</button></footer>
      </form>
    </section>
  </div>;
}
