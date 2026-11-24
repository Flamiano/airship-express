"use client";

import { ArrowDown, ArrowUp, Eye, Wrench } from "lucide-react";
import {
  formatMaintenanceCurrency,
  formatMaintenanceDate,
  getMaintenanceStatus,
  STATUS_LABEL,
  totalMaintenanceCost,
  vehicleLabel,
  type MaintenanceRecord,
  type MaintenanceVehicle,
  type RecordStatus,
} from "./maintenanceTypes";

export type MaintenanceSortKey = "scheduled_at" | "vehicle_id" | "maintenance_category" | "maintenance_type" | "priority" | "status" | "cost";

type Props = {
  records: MaintenanceRecord[];
  vehiclesById: Map<string, MaintenanceVehicle>;
  page: number;
  pageSize: number;
  sortKey: MaintenanceSortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: MaintenanceSortKey) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onSelect: (record: MaintenanceRecord) => void;
};

const STATUS_STYLE: Record<RecordStatus, string> = {
  scheduled: "border-pink-200 bg-pink-50 text-pink-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-900",
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function MaintenanceRecordTable({ records, vehiclesById, page, pageSize, sortKey, sortDirection, onSort, onPage, onPageSize, onSelect }: Props) {
  const sorted = [...records].sort((left, right) => {
    const vehicleLeft = vehiclesById.get(String(left.vehicle_id));
    const vehicleRight = vehiclesById.get(String(right.vehicle_id));
    let result = 0;
    if (sortKey === "cost") result = totalMaintenanceCost(left) - totalMaintenanceCost(right);
    else if (sortKey === "status") result = getMaintenanceStatus(left, vehicleLeft).localeCompare(getMaintenanceStatus(right, vehicleRight));
    else if (sortKey === "vehicle_id") result = vehicleLabel(vehicleLeft, left.vehicle_id).localeCompare(vehicleLabel(vehicleRight, right.vehicle_id), undefined, { numeric: true });
    else result = String(left[sortKey] || "").localeCompare(String(right[sortKey] || ""), undefined, { numeric: true, sensitivity: "base" });
    return result * (sortDirection === "asc" ? 1 : -1);
  });
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);
  const heading = (key: MaintenanceSortKey, label: string) => <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-pink-700">{label}{sortKey === key ? sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}</button>;
  const Status = ({ record }: { record: MaintenanceRecord }) => {
    const status = getMaintenanceStatus(record, vehiclesById.get(String(record.vehicle_id)));
    return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
  };

  return <section className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-100 p-3 sm:px-4"><div><h2 className="text-sm font-black text-slate-900">Maintenance schedule and records</h2><p className="mt-0.5 text-[10px] text-slate-500">{records.length} matching services</p></div><div className="flex items-center gap-2"><label htmlFor="maintenance-page-size" className="sr-only">Rows per page</label><select id="maintenance-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-pink-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">{[8, 12, 24].map((size) => <option key={size} value={size}>{size} / page</option>)}</select><span className="text-[10px] font-semibold text-slate-500">{current}/{pages}</span></div></header>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1080px] text-left text-xs"><thead className="border-b border-pink-100 bg-[#fff9fc] text-[9px] font-black uppercase tracking-[0.12em] text-slate-500"><tr>
      <th className="px-3 py-3">{heading("scheduled_at", "Scheduled")}</th><th className="px-3 py-3">{heading("vehicle_id", "Vehicle")}</th><th className="px-3 py-3">{heading("maintenance_category", "Category")}</th><th className="px-3 py-3">{heading("maintenance_type", "Service / repair")}</th><th className="px-3 py-3">{heading("priority", "Priority")}</th><th className="px-3 py-3">Mechanic / provider</th><th className="px-3 py-3">{heading("status", "Status")}</th><th className="px-3 py-3">Next due</th><th className="px-3 py-3">{heading("cost", "Total cost")}</th><th className="px-3 py-3 text-right">Details</th>
    </tr></thead><tbody className="divide-y divide-pink-50">{visible.map((record) => { const vehicle = vehiclesById.get(String(record.vehicle_id)); return <tr key={record.id} className="transition hover:bg-pink-50/40"><td className="px-3 py-3"><span className="block font-semibold text-slate-800">{formatMaintenanceDate(record.scheduled_at || record.performed_at)}</span><span className="mt-0.5 block text-[9px] text-slate-400">{record.scheduled_at ? new Date(record.scheduled_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "Time not recorded"}</span></td><td className="px-3 py-3"><span className="font-mono font-bold text-pink-700">{vehicleLabel(vehicle, record.vehicle_id)}</span><span className="mt-0.5 block text-[9px] text-slate-400">ID {record.vehicle_id}</span></td><td className="px-3 py-3">{record.maintenance_category || "Not recorded"}</td><td className="max-w-48 px-3 py-3"><span className="block truncate font-semibold text-slate-800">{record.maintenance_type}</span>{record.reported_issue && <span className="mt-0.5 block truncate text-[9px] text-slate-500">Issue: {record.reported_issue}</span>}</td><td className="px-3 py-3 capitalize">{record.priority || "Not recorded"}</td><td className="px-3 py-3">{record.mechanic || record.performed_by || "Not assigned"}</td><td className="px-3 py-3"><Status record={record} /></td><td className="px-3 py-3">{record.next_due_date ? formatMaintenanceDate(record.next_due_date) : record.next_due_mileage != null ? `${Number(record.next_due_mileage).toLocaleString()} km` : "Not set"}</td><td className="px-3 py-3">{record.labor_cost == null && record.parts_cost == null && (!record.cost || Number(record.cost) === 0) ? "Not recorded" : formatMaintenanceCurrency(totalMaintenanceCost(record))}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => onSelect(record)} aria-label={`View maintenance ${record.id}`} className="rounded-lg border border-pink-100 p-2 text-slate-600 hover:bg-pink-50 hover:text-pink-700"><Eye className="h-3.5 w-3.5" /></button></td></tr>; })}</tbody></table></div>
    <div className="divide-y divide-pink-100 md:hidden">{visible.map((record) => { const vehicle = vehiclesById.get(String(record.vehicle_id)); return <button key={record.id} type="button" onClick={() => onSelect(record)} className="block w-full p-3 text-left transition hover:bg-pink-50/40"><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-xs font-black text-slate-900">{record.maintenance_type}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{vehicleLabel(vehicle, record.vehicle_id)} · {record.maintenance_category || "Category not recorded"}</span></span><Status record={record} /></div><div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-slate-500"><span>Scheduled {formatMaintenanceDate(record.scheduled_at || record.performed_at)}</span><span>{record.mechanic || record.performed_by || "Provider not assigned"}</span><span>{record.next_due_date ? `Next ${formatMaintenanceDate(record.next_due_date)}` : record.next_due_mileage != null ? `Next ${Number(record.next_due_mileage).toLocaleString()} km` : "Next service not set"}</span><span>{record.labor_cost == null && record.parts_cost == null && (!record.cost || Number(record.cost) === 0) ? "Cost not recorded" : formatMaintenanceCurrency(totalMaintenanceCost(record))}</span></div></button>; })}</div>
    {visible.length === 0 && <div className="p-10 text-center"><Wrench className="mx-auto h-7 w-7 text-pink-300" /><p className="mt-2 text-sm font-bold text-slate-800">No matching maintenance records</p><p className="mt-1 text-[10px] text-slate-500">Clear or adjust the filters to show more records.</p></div>}
    <footer className="flex items-center justify-between border-t border-pink-100 px-3 py-2.5 sm:px-4"><p className="text-[9px] text-slate-500">{sorted.length ? `${Math.min((current - 1) * pageSize + 1, sorted.length)}–${Math.min(current * pageSize, sorted.length)} of ${sorted.length}` : "0 records"}</p><div className="flex gap-2"><button type="button" disabled={current <= 1} onClick={() => onPage(current - 1)} className="rounded-lg border border-pink-200 px-2.5 py-1.5 text-[9px] font-bold disabled:opacity-40">Previous</button><button type="button" disabled={current >= pages} onClick={() => onPage(current + 1)} className="rounded-lg border border-pink-200 px-2.5 py-1.5 text-[9px] font-bold disabled:opacity-40">Next</button></div></footer>
  </section>;
}