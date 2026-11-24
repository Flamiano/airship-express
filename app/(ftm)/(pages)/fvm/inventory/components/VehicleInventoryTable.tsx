"use client";

import { ArrowDown, ArrowUp, Eye, Pencil, Truck } from "lucide-react";
import {
  documentExpiry,
  formatDate,
  getAssignmentLabel,
  getExpiryTone,
  isVehicleAssigned,
  textValue,
  valueOf,
  type InventoryRow,
  type VehicleSortField,
} from "./inventoryTypes";

type Props = {
  rows: InventoryRow[];
  page: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  sortField: VehicleSortField;
  sortDirection: "asc" | "desc";
  canUpdate: boolean;
  onSort: (field: VehicleSortField) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onView: (row: InventoryRow) => void;
  onEdit: (row: InventoryRow) => void;
};

const STATUS_TONE: Record<string, string> = {
  Available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "On Trip": "border-sky-200 bg-sky-50 text-sky-700",
  "Under Maintenance": "border-amber-200 bg-amber-50 text-amber-800",
  Inactive: "border-slate-200 bg-slate-100 text-slate-600",
  Unverified: "border-rose-200 bg-rose-50 text-rose-700",
};

function ExpiryLabel({ value }: { value: unknown }) {
  const state = documentExpiry(value);
  const label = state === "expired" ? "Expired" : state === "soon" ? "Due soon" : state === "missing" ? "Missing" : "Valid";
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-bold ${getExpiryTone(value)}`}>{label}</span>;
}

export default function VehicleInventoryTable({
  rows,
  page,
  pageCount,
  pageSize,
  totalRows,
  sortField,
  sortDirection,
  canUpdate,
  onSort,
  onPage,
  onPageSize,
  onView,
  onEdit,
}: Props) {
  const header = (field: VehicleSortField, label: string) => (
    <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-pink-700">
      {label}
      {sortField === field && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1210px] text-left text-xs">
          <thead className="border-b border-pink-100 bg-[#fff7fb] text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">{header("plate_number", "Vehicle")}</th>
              <th className="px-4 py-3">{header("manufacturer", "Brand / model")}</th>
              <th className="px-4 py-3">{header("vehicle_type", "Type")}</th>
              <th className="px-4 py-3">{header("capacity_kg", "Capacity")}</th>
              <th className="px-4 py-3">{header("mileage", "Mileage")}</th>
              <th className="px-4 py-3">{header("assignment", "Assignment")}</th>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Insurance</th>
              <th className="px-4 py-3">{header("status", "Status")}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {rows.map(({ vehicle, status }) => {
              const registration = valueOf(vehicle, "registration_expiry", "registrationExpiry");
              const insurance = valueOf(vehicle, "insurance_expiry", "insuranceExpiry");
              return (
                <tr key={String(vehicle.id)} className="transition-colors hover:bg-pink-50/40">
                  <td className="px-4 py-3">
                    <div className="font-mono font-black text-pink-700">{textValue(vehicle.plate_number)}</div>
                    <div className="mt-1 text-[10px] text-slate-500">ID {textValue(vehicle.id)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{[vehicle.manufacturer, vehicle.model].filter(Boolean).map(String).join(" ") || "Not recorded"}</div>
                    {vehicle.year ? <div className="mt-1 text-[10px] text-slate-500">Model year {String(vehicle.year)}</div> : null}
                  </td>
                  <td className="px-4 py-3">{textValue(valueOf(vehicle, "vehicle_type", "type"))}</td>
                  <td className="px-4 py-3">
                    <div>{vehicle.capacity_kg == null ? "Not recorded" : `${String(vehicle.capacity_kg)} kg`}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{textValue(valueOf(vehicle, "fuel_type", "fuelType"))}</div>
                  </td>
                  <td className="px-4 py-3">{vehicle.mileage == null ? "Not recorded" : `${Number(vehicle.mileage).toLocaleString()} km`}</td>
                  <td className="px-4 py-3">
                    <div className={`font-semibold ${isVehicleAssigned(vehicle) ? "text-slate-800" : "text-slate-500"}`}>{getAssignmentLabel(vehicle)}</div>
                    {vehicle.active_trip?.to_location ? <div className="mt-1 max-w-36 truncate text-[10px] text-slate-500">To {String(vehicle.active_trip.to_location)}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(registration)}</div>
                    <div className="mt-1"><ExpiryLabel value={registration} /></div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(insurance)}</div>
                    <div className="mt-1"><ExpiryLabel value={insurance} /></div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_TONE[status] || STATUS_TONE.Unverified}`}>{status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => onView({ vehicle, status })} aria-label={`View ${textValue(vehicle.plate_number)}`} title="View details" className="rounded-lg border border-pink-100 p-2 text-slate-600 transition hover:bg-pink-50 hover:text-pink-700"><Eye className="h-3.5 w-3.5" /></button>
                      {canUpdate && <button type="button" onClick={() => onEdit({ vehicle, status })} aria-label={`Edit ${textValue(vehicle.plate_number)}`} title="Edit vehicle" className="rounded-lg border border-pink-100 p-2 text-slate-600 transition hover:bg-pink-50 hover:text-pink-700"><Pencil className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-pink-100 md:hidden">
        {rows.map(({ vehicle, status }) => (
          <article key={String(vehicle.id)} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-black text-pink-700">{textValue(vehicle.plate_number)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{textValue(vehicle.id)} · {textValue(valueOf(vehicle, "vehicle_type", "type"))}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold ${STATUS_TONE[status] || STATUS_TONE.Unverified}`}>{status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
              <div><p className="uppercase tracking-wide text-slate-400">Brand / model</p><p className="mt-0.5 font-semibold text-slate-700">{[vehicle.manufacturer, vehicle.model].filter(Boolean).map(String).join(" ") || "Not recorded"}</p></div>
              <div><p className="uppercase tracking-wide text-slate-400">Capacity / fuel</p><p className="mt-0.5 font-semibold text-slate-700">{vehicle.capacity_kg == null ? "Not recorded" : `${String(vehicle.capacity_kg)} kg`} · {textValue(valueOf(vehicle, "fuel_type", "fuelType"))}</p></div>
              <div><p className="uppercase tracking-wide text-slate-400">Mileage</p><p className="mt-0.5 font-semibold text-slate-700">{vehicle.mileage == null ? "Not recorded" : `${Number(vehicle.mileage).toLocaleString()} km`}</p></div>
              <div><p className="uppercase tracking-wide text-slate-400">Assignment</p><p className="mt-0.5 truncate font-semibold text-slate-700">{getAssignmentLabel(vehicle)}</p></div>
              <div className="flex items-center gap-1"><span className="text-slate-500">Reg.</span><ExpiryLabel value={valueOf(vehicle, "registration_expiry", "registrationExpiry")} /></div>
              <div className="flex items-center gap-1"><span className="text-slate-500">Ins.</span><ExpiryLabel value={valueOf(vehicle, "insurance_expiry", "insuranceExpiry")} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onView({ vehicle, status })} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-pink-200 px-3 py-2 text-[10px] font-bold text-pink-700"><Eye className="h-3.5 w-3.5" />Details</button>
              {canUpdate && <button type="button" onClick={() => onEdit({ vehicle, status })} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-[10px] font-bold text-white"><Pencil className="h-3.5 w-3.5" />Edit</button>}
            </div>
          </article>
        ))}
      </div>
      {rows.length === 0 && <div className="p-8 text-center md:hidden"><Truck className="mx-auto h-7 w-7 text-pink-300" /><p className="mt-2 text-sm font-bold text-slate-800">No vehicles match these filters</p><p className="mt-1 text-xs text-slate-500">Change the search or filters to see more records.</p></div>}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-pink-100 bg-white px-4 py-3">
        <p className="text-[10px] text-slate-500">{totalRows ? `${Math.min((page - 1) * pageSize + 1, totalRows)}–${Math.min(page * pageSize, totalRows)} of ${totalRows} vehicles` : "0 vehicles"}</p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="inventory-page-size">Rows per page</label>
          <select id="inventory-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-pink-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
            {[8, 12, 24, 48].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-pink-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Previous</button>
          <span aria-live="polite" className="min-w-12 text-center text-[10px] font-semibold text-slate-600">{page} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="rounded-lg border border-pink-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Next</button>
        </div>
      </footer>
      {rows.length === 0 && <div className="hidden p-10 text-center md:block"><Truck className="mx-auto h-7 w-7 text-pink-300" /><p className="mt-2 text-sm font-bold text-slate-800">No vehicles match these filters</p><p className="mt-1 text-xs text-slate-500">Change the search or filters to see more records.</p></div>}
    </section>
  );
}