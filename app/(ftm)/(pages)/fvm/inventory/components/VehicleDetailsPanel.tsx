"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowUpRight, FileText, Pencil, ShieldCheck, Truck, X } from "lucide-react";
import {
  formatDate,
  getAssignmentLabel,
  getExpiryLabel,
  getExpiryTone,
  isVehicleAssigned,
  textValue,
  valueOf,
  type InventoryRecord,
  type VehicleDocument,
} from "./inventoryTypes";
import type { FleetVehicleStatus } from "../../fleetData";

type Props = {
  vehicle: InventoryRecord;
  status: FleetVehicleStatus;
  documents: VehicleDocument[];
  documentsLoading: boolean;
  documentsError: string;
  canCreate: boolean;
  canUpdate: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChangeStatus: () => void;
  onDeactivate: () => void;
  onUpload: (file: File, type: string, documentNumber: string, expiry: string) => Promise<boolean>;
};

const STATUS_TONE: Record<string, string> = {
  Available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "On Trip": "border-sky-200 bg-sky-50 text-sky-700",
  "Under Maintenance": "border-amber-200 bg-amber-50 text-amber-800",
  Inactive: "border-slate-200 bg-slate-100 text-slate-600",
  Unverified: "border-rose-200 bg-rose-50 text-rose-700",
};
const INPUT = "mt-1 block w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100";

export default function VehicleDetailsPanel({
  vehicle,
  status,
  documents,
  documentsLoading,
  documentsError,
  canCreate,
  canUpdate,
  onClose,
  onEdit,
  onChangeStatus,
  onDeactivate,
  onUpload,
}: Props) {
  const [documentType, setDocumentType] = useState("Registration");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentExpiry, setDocumentExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const trip = vehicle.active_trip as InventoryRecord | null | undefined;
  const assigned = isVehicleAssigned(vehicle);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !uploading) onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, uploading]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const saved = await onUpload(file, documentType, documentNumber.trim(), documentExpiry);
      if (saved) {
        setFile(null);
        setDocumentNumber("");
        setDocumentExpiry("");
        const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
        if (input) input.value = "";
      }
    } finally {
      setUploading(false);
    }
  }

  const registration = valueOf(vehicle, "registration_expiry", "registrationExpiry");
  const insurance = valueOf(vehicle, "insurance_expiry", "insuranceExpiry");
  const missing = [
    !vehicle.plate_number && "Plate number",
    !valueOf(vehicle, "vehicle_type", "type") && "Vehicle type",
    !vehicle.manufacturer && "Brand",
    !vehicle.model && "Model",
    vehicle.capacity_kg == null && "Cargo capacity",
    !valueOf(vehicle, "fuel_type", "fuelType") && "Fuel type",
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[1300] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !uploading) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title" className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-pink-100 bg-[#fffafd] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-pink-100 bg-white px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-pink-700">Vehicle record · {textValue(vehicle.id)}</p>
            <h2 id="vehicle-details-title" className="mt-1 truncate text-2xl font-black text-slate-900">{textValue(vehicle.plate_number, "Vehicle details")}</h2>
            <p className="mt-1 text-xs text-slate-500">{[vehicle.manufacturer, vehicle.model, vehicle.year].filter(Boolean).map(String).join(" · ") || "Specifications not fully recorded"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close vehicle details" className="shrink-0 rounded-lg border border-pink-100 bg-white p-2 text-slate-500 hover:bg-pink-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-50 text-pink-700"><Truck className="h-5 w-5" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">Operational status</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_TONE[status] || STATUS_TONE.Unverified}`}>{status}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canUpdate && <button type="button" onClick={onChangeStatus} disabled={status === "On Trip" || status === "Unverified"} className="rounded-lg border border-pink-200 px-3 py-2 text-[10px] font-bold text-pink-700 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-45">Change status</button>}
                {canUpdate && status !== "Inactive" && <button type="button" onClick={onDeactivate} disabled={status === "On Trip" || status === "Unverified"} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45">Deactivate</button>}
                {canUpdate && <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-pink-700"><Pencil className="h-3 w-3" />Edit record</button>}
              </div>
            </div>
            {status === "On Trip" && <p className="mt-3 text-[10px] text-sky-800">This vehicle is assigned to an active trip. Status changes are blocked until that trip is resolved.</p>}
            {status === "Unverified" && <p className="mt-3 text-[10px] text-rose-800">Trip or maintenance relationship data is unavailable. Refresh before changing status.</p>}
          </section>

          {missing.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Missing vehicle information: {missing.join(", ")}.</span></div>}

          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Specifications</h3><span className="text-[9px] text-slate-400">Vehicle inventory</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Vehicle type", valueOf(vehicle, "vehicle_type", "type")],
                ["Cargo capacity", vehicle.capacity_kg == null ? null : `${vehicle.capacity_kg} kg`],
                ["Fuel type", valueOf(vehicle, "fuel_type", "fuelType")],
                ["Odometer", vehicle.mileage == null ? null : `${Number(vehicle.mileage).toLocaleString()} km`],
                ["VIN", vehicle.vin_number],
                ["Engine number", vehicle.engine_number],
                ["Registration expiry", registration],
                ["Insurance expiry", insurance],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-pink-100 bg-white px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{String(label)}</p>
                  <p className="mt-1 break-words text-xs font-semibold text-slate-800">{label === "Registration expiry" || label === "Insurance expiry" ? formatDate(value) : textValue(value)}</p>
                  {(label === "Registration expiry" || label === "Insurance expiry") && <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold ${getExpiryTone(value)}`}>{getExpiryLabel(value)}</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-pink-700" /><div><h3 className="text-xs font-black text-slate-900">Assignment and trip</h3><p className="mt-0.5 text-[10px] text-slate-500">Linked operational records</p></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Assignment state</p><p className="mt-1 text-xs font-bold text-slate-800">{getAssignmentLabel(vehicle)}</p><p className="mt-1 text-[10px] text-slate-500">{assigned ? textValue(vehicle.driver, `Driver ${String(vehicle.driver_id || trip?.driver_id || "assigned")}`) : "No linked driver assignment"}</p></div>
              {trip?.id ? <div className="rounded-xl bg-pink-50/70 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Active trip</p><p className="mt-1 text-xs font-bold text-slate-800">{String(trip.id)} · {textValue(trip.status, "Status not recorded")}</p><p className="mt-1 truncate text-[10px] text-slate-600">{textValue(trip.from_location, "Origin not recorded")} → {textValue(trip.to_location, "Destination not recorded")}</p><p className="mt-1 text-[10px] text-slate-500">Scheduled {formatDate(valueOf(trip, "scheduled_at", "estimated_departure", "created_at"))}</p></div> : <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Active trip</p><p className="mt-1 text-xs font-semibold text-slate-700">No active trip linked</p></div>}
            </div>
            {(vehicle.trip_data_available === false || vehicle.assignment_data_available === false) && <p className="mt-2 text-[10px] text-amber-800">Some assignment data could not be verified. Refresh to retry.</p>}
          </section>

          <section className="rounded-2xl border border-pink-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-pink-700" /><div><h3 className="text-xs font-black text-slate-900">Registration documents</h3><p className="mt-0.5 text-[10px] text-slate-500">Linked files and expiry metadata</p></div></div>
            {documentsLoading ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-pink-50" /> : documentsError ? <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-800">{documentsError}</div> : documents.length ? (
              <div className="mt-3 divide-y divide-pink-100">
                {documents.map((document) => (
                  <div key={String(document.id || `${document.document_type}-${document.file_url}`)} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0"><p className="text-xs font-bold text-slate-800">{textValue(document.document_type, "Vehicle document")}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{textValue(document.document_number, "No document number")} · Expires {formatDate(document.expiry_date)}</p></div>
                    {document.signed_url ? <a href={String(document.signed_url)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-pink-200 px-2.5 py-1.5 text-[10px] font-bold text-pink-700 hover:bg-pink-50">Open file<ArrowUpRight className="h-3 w-3" /></a> : <span className="text-[9px] text-slate-400">File unavailable</span>}
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[10px] text-slate-500">No linked document records.</p>}

            {canCreate && <form onSubmit={(event) => void upload(event)} className="mt-4 border-t border-pink-100 pt-4">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">Add a document</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[9px] font-bold text-slate-600">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className={INPUT}><option>Registration</option><option>Insurance</option><option>Permit</option><option>Inspection</option><option>Other</option></select></label>
                <label className="text-[9px] font-bold text-slate-600">Document number<input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} maxLength={80} className={INPUT} /></label>
                <label className="text-[9px] font-bold text-slate-600">Expiry date<input type="date" value={documentExpiry} onChange={(event) => setDocumentExpiry(event.target.value)} className={INPUT} /></label>
                <label className="text-[9px] font-bold text-slate-600">File (PDF or image)<input required type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} className={`${INPUT} file:mr-2 file:rounded-md file:border-0 file:bg-pink-50 file:px-2 file:py-1 file:text-[9px] file:font-bold file:text-pink-700`} /></label>
              </div>
              <button type="submit" disabled={!file || uploading} className="mt-3 rounded-lg bg-pink-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? "Uploading…" : "Upload document"}</button>
              <p className="mt-2 text-[9px] text-slate-400">Maximum file size: 15 MB. Vehicle documents are stored in private storage.</p>
            </form>}
          </section>
        </div>
      </section>
    </div>
  );
}