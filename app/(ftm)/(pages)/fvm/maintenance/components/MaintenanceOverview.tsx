"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Wrench } from "lucide-react";
import {
  formatMaintenanceDate,
  getMaintenanceStatus,
  STATUS_LABEL,
  type MaintenanceRecord,
  type MaintenanceVehicle,
  getFollowUpState,
} from "./maintenanceTypes";

type Props = {
  records: MaintenanceRecord[];
  vehicles: MaintenanceVehicle[];
  vehiclesById: Map<string, MaintenanceVehicle>;
  onSelect: (record: MaintenanceRecord) => void;
};

function AlertsList({ title, records: items, empty, urgent = false, vehiclesById, onSelect }: {
  title: string;
  records: MaintenanceRecord[];
  empty: string;
  urgent?: boolean;
  vehiclesById: Map<string, MaintenanceVehicle>;
  onSelect: (record: MaintenanceRecord) => void;
}) {
  return <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
    <div className="mb-2 flex items-center gap-2"><span className={`rounded-lg p-1.5 ${urgent ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}><AlertTriangle className="h-3.5 w-3.5" /></span><h2 className="text-xs font-black text-slate-800">{title}</h2><span className="ml-auto rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{items.length}</span></div>
    {items.length ? <ul className="divide-y divide-pink-50">{items.slice(0, 4).map((record) => {
      const vehicle = vehiclesById.get(String(record.vehicle_id));
      const serviceDate = record.next_due_date || record.scheduled_at;
      const mileage = Number(record.next_due_mileage);
      const followUpState = getFollowUpState(record, vehicle);
      return <li key={record.id}><button type="button" onClick={() => onSelect(record)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-pink-50/50">
        <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-slate-800">{vehicle?.plate_number || record.vehicle_id} · {record.maintenance_type}</span><span className="mt-0.5 block truncate text-[9px] text-slate-500">{record.maintenance_category || "Category not recorded"} · {serviceDate ? formatMaintenanceDate(serviceDate) : "Date not recorded"}{Number.isFinite(mileage) && mileage > 0 ? ` · ${mileage.toLocaleString()} km` : ""}</span></span>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${urgent ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{followUpState === "overdue" ? "Follow-up overdue" : followUpState === "due_soon" ? "Due soon" : STATUS_LABEL[getMaintenanceStatus(record, vehicle)]}</span>
      </button></li>;
    })}</ul> : <p className="py-4 text-center text-[10px] text-slate-400">{empty}</p>}
  </article>;
}

export default function MaintenanceOverview({ records, vehicles, vehiclesById, onSelect }: Props) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueSoon = records.filter((record) => {
    const vehicle = vehiclesById.get(String(record.vehicle_id));
    if (getFollowUpState(record, vehicle, now) === "due_soon") return true;
    if (getMaintenanceStatus(record, vehicle, now) !== "scheduled") return false;
    const dueDate = record.next_due_date || record.scheduled_at;
    if (!dueDate) return false;
    const date = new Date(dueDate);
    return Number.isFinite(date.getTime()) && date >= today && date < new Date(today.getTime() + 8 * 86_400_000);
  });
  const overdue = records.filter((record) => {
    const vehicle = vehiclesById.get(String(record.vehicle_id));
    return getMaintenanceStatus(record, vehicle, now) === "overdue" || getFollowUpState(record, vehicle, now) === "overdue";
  });
  const scheduled = records.filter((record) => record.status === "scheduled").length;
  const inProgress = records.filter((record) => record.status === "in_progress").length;
  const completed = records.filter((record) => record.status === "completed").length;
  const flaggedVehicles = vehicles.filter((vehicle) => ["maintenance_due_soon", "maintenance_due", "overdue", "urgent_inspection_required", "needs_baseline"].includes(String(vehicle.maintenance_attention_status || "")))
    .sort((left, right) => {
      const priority = (status: string) => status === "urgent_inspection_required" ? 0 : status === "overdue" ? 1 : status === "maintenance_due" ? 2 : status === "maintenance_due_soon" ? 3 : 4;
      return priority(String(left.maintenance_attention_status)) - priority(String(right.maintenance_attention_status));
    });
  const metrics = [
    { label: "Scheduled", value: scheduled, note: "Open service records", icon: CalendarClock, tone: "text-pink-700 bg-pink-50" },
    { label: "Due soon", value: dueSoon.length, note: "Within 7 days", icon: Clock3, tone: "text-amber-700 bg-amber-50" },
    { label: "Overdue", value: overdue.length, note: "Date or mileage reached", icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
    { label: "In progress", value: inProgress, note: "Vehicles in service", icon: Wrench, tone: "text-orange-700 bg-orange-50" },
    { label: "Completed", value: completed, note: "Recorded services", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
  ];

  return <section className="space-y-3" aria-label="Maintenance overview">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{metrics.map(({ label, value, note, icon: Icon, tone }) => <article key={label} className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p><span className={`rounded-lg p-1.5 ${tone}`}><Icon className="h-3.5 w-3.5" /></span></div><p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p><p className="mt-0.5 text-[9px] text-slate-400">{note}</p></article>)}</div>
    {vehicles.length > 0 && <article className="rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Automatic maintenance status</h2><p className="mt-0.5 text-[9px] text-slate-500">Based on configured intervals and recorded odometer readings</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-600">{vehicles.filter((vehicle) => Number(vehicle.maintenance_interval_days) > 0 || Number(vehicle.maintenance_interval_km) > 0).length} / {vehicles.length} policies configured</span></div>
      {flaggedVehicles.length ? <div className="mt-2 divide-y divide-pink-50">{flaggedVehicles.slice(0, 5).map((vehicle) => {
        const status = String(vehicle.maintenance_attention_status || "needs_baseline");
        const mileage = Number(vehicle.mileage ?? vehicle.odometer);
        const dueMileage = Number(vehicle.maintenance_next_due_mileage);
        const remainingKm = Number.isFinite(mileage) && Number.isFinite(dueMileage) ? dueMileage - mileage : null;
        const label = status === "urgent_inspection_required" ? "Urgent inspection" : status === "overdue" ? "Overdue" : status === "maintenance_due" ? "Due" : status === "maintenance_due_soon" ? "Due soon" : "Baseline needed";
        const color = status === "urgent_inspection_required" || status === "overdue" ? "bg-rose-50 text-rose-700" : status === "maintenance_due_soon" ? "bg-amber-50 text-amber-800" : "bg-pink-50 text-pink-700";
        return <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0"><span className="block truncate text-[10px] font-bold text-slate-800">{vehicle.plate_number || vehicle.id}</span><span className="block truncate text-[9px] text-slate-500">{vehicle.maintenance_attention_reason || "Maintenance status requires review."}</span></span><span className="flex shrink-0 items-center gap-2"><span className="text-[9px] text-slate-500">{remainingKm == null ? (vehicle.maintenance_next_due_date ? `Due ${formatMaintenanceDate(vehicle.maintenance_next_due_date)}` : "Mileage unavailable") : remainingKm <= 0 ? `${Math.abs(remainingKm).toLocaleString()} km overdue` : `${remainingKm.toLocaleString()} km remaining`}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${color}`}>{label}</span></span></div>;
      })}</div> : <p className="mt-2 text-[10px] text-slate-400">No configured vehicle policy is currently due. Vehicles without intervals remain unconfigured rather than receiving an assumed service interval.</p>}
    </article>}
    <div className="grid gap-2 lg:grid-cols-2"><AlertsList title="Overdue services" records={overdue} empty="No services are overdue." urgent vehiclesById={vehiclesById} onSelect={onSelect} /><AlertsList title="Upcoming services" records={dueSoon} empty="No services are due in the next 7 days." vehiclesById={vehiclesById} onSelect={onSelect} /></div>
  </section>;
}