"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { VehicleFormValues } from "./inventoryTypes";

type Props = {
  mode: "create" | "edit";
  title: string;
  initialValues: VehicleFormValues;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

const INPUT = "mt-1 block w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100";

export default function VehicleFormDialog({ mode, title, initialValues, saving, error, onClose, onSubmit }: Props) {
  const [form, setForm] = useState(initialValues);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const setField = (key: keyof VehicleFormValues, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const plate = form.plate_number.trim().toUpperCase();
    if (plate.length < 3 || plate.length > 20) {
      setValidationError("Enter a plate number between 3 and 20 characters.");
      return;
    }
    if (!form.vehicle_type.trim()) {
      setValidationError("Vehicle type is required.");
      return;
    }
    const year = form.year.trim() ? Number(form.year) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      setValidationError("Enter a valid model year.");
      return;
    }
    const capacity = form.capacity_kg.trim() ? Number(form.capacity_kg) : null;
    if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) {
      setValidationError("Cargo capacity must be greater than zero.");
      return;
    }
    const mileage = form.mileage.trim() ? Number(form.mileage) : 0;
    if (!Number.isFinite(mileage) || mileage < 0) {
      setValidationError("Mileage must be a non-negative number.");
      return;
    }

    await onSubmit({
      ...form,
      plate_number: plate,
      vehicle_type: form.vehicle_type.trim(),
      manufacturer: form.manufacturer.trim(),
      model: form.model.trim(),
      year,
      capacity_kg: capacity,
      fuel_type: form.fuel_type.trim(),
      mileage,
      registration_expiry: form.registration_expiry || null,
      insurance_expiry: form.insurance_expiry || null,
      vin_number: form.vin_number.trim(),
      engine_number: form.engine_number.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-pink-100 bg-white shadow-2xl sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-pink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-pink-700">Vehicle record</p>
            <h2 id="vehicle-form-title" className="mt-1 text-lg font-black text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close vehicle form" className="rounded-lg border border-pink-100 p-2 text-slate-500 hover:bg-pink-50 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <form onSubmit={(event) => void submit(event)} className="space-y-6 p-5 sm:p-6">
          {(validationError || error) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">{validationError || error}</div>}

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Identity and specifications</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-[10px] font-bold text-slate-600">Plate number <span className="text-rose-600">*</span><input autoFocus required minLength={3} maxLength={20} value={form.plate_number} onChange={(event) => setField("plate_number", event.target.value.toUpperCase())} className={INPUT} autoComplete="off" /></label>
              <label className="text-[10px] font-bold text-slate-600">Vehicle type <span className="text-rose-600">*</span><input required value={form.vehicle_type} onChange={(event) => setField("vehicle_type", event.target.value)} className={INPUT} placeholder="Delivery van" /></label>
              <label className="text-[10px] font-bold text-slate-600">Brand<input value={form.manufacturer} onChange={(event) => setField("manufacturer", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Model<input value={form.model} onChange={(event) => setField("model", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Model year<input type="number" min="1900" max={new Date().getFullYear() + 1} value={form.year} onChange={(event) => setField("year", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Cargo capacity (kg)<input type="number" min="0.1" step="any" value={form.capacity_kg} onChange={(event) => setField("capacity_kg", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Fuel type<input value={form.fuel_type} onChange={(event) => setField("fuel_type", event.target.value)} className={INPUT} placeholder="Diesel, gasoline, electric" /></label>
              <label className="text-[10px] font-bold text-slate-600">Odometer (km)<input type="number" min="0" step="any" value={form.mileage} onChange={(event) => setField("mileage", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">VIN<input value={form.vin_number} onChange={(event) => setField("vin_number", event.target.value)} maxLength={64} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Engine number<input value={form.engine_number} onChange={(event) => setField("engine_number", event.target.value)} maxLength={64} className={INPUT} /></label>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Registration and insurance</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-bold text-slate-600">Registration expiry<input type="date" value={form.registration_expiry} onChange={(event) => setField("registration_expiry", event.target.value)} className={INPUT} /></label>
              <label className="text-[10px] font-bold text-slate-600">Insurance expiry<input type="date" value={form.insurance_expiry} onChange={(event) => setField("insurance_expiry", event.target.value)} className={INPUT} /></label>
            </div>
          </section>

          <footer className="flex flex-col-reverse gap-2 border-t border-pink-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-pink-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : mode === "create" ? "Register vehicle" : "Save changes"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}