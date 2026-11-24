"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, Plus, RefreshCw, Search, ShieldAlert, Truck, X } from "lucide-react";
import GlobalFooter from "../../../../components/global/GlobalFooter";
import GlobalNavbar from "../../../../components/global/GlobalNavbar";
import RoleRestricted from "../../../../components/global/RoleRestricted";
import { createVehicle, createVehicleDocument, fetchJson, getNextVehicleId, updateVehicle, uploadVehicleDocument } from "../../../../lib/api";
import { getCurrentRole, hasAppPermission } from "../../../../lib/roleAccess";
import VehicleDetailsPanel from "./VehicleDetailsPanel";
import VehicleFormDialog from "./VehicleFormDialog";
import VehicleInventoryTable from "./VehicleInventoryTable";
import {
  documentExpiry,
  getAssignmentLabel,
  getVehicleStatus,
  isVehicleAssigned,
  valueOf,
  VEHICLE_STATUSES,
  type InventoryRecord,
  type InventoryRow,
  type VehicleDocument,
  type VehicleFormValues,
  type VehicleSortField,
} from "./inventoryTypes";
import type { FleetVehicleStatus } from "../../fleetData";

type AssignmentFilter = "all" | "assigned" | "unassigned" | "unverified";
type ConfirmAction = "status" | "deactivate" | null;

const PAGE_SIZE = 12;
const EMPTY_FORM: VehicleFormValues = {
  plate_number: "",
  vehicle_type: "",
  manufacturer: "",
  model: "",
  year: "",
  capacity_kg: "",
  fuel_type: "",
  mileage: "0",
  registration_expiry: "",
  insurance_expiry: "",
  vin_number: "",
  engine_number: "",
};

function toForm(vehicle?: InventoryRecord): VehicleFormValues {
  if (!vehicle) return EMPTY_FORM;
  return {
    plate_number: String(vehicle.plate_number || ""),
    vehicle_type: String(valueOf(vehicle, "vehicle_type", "type") || ""),
    manufacturer: String(vehicle.manufacturer || ""),
    model: String(vehicle.model || ""),
    year: String(vehicle.year || ""),
    capacity_kg: String(valueOf(vehicle, "capacity_kg", "capacity") ?? ""),
    fuel_type: String(valueOf(vehicle, "fuel_type", "fuelType") || ""),
    mileage: String(valueOf(vehicle, "mileage", "odometer") ?? "0"),
    registration_expiry: String(valueOf(vehicle, "registration_expiry", "registrationExpiry") || "").slice(0, 10),
    insurance_expiry: String(valueOf(vehicle, "insurance_expiry", "insuranceExpiry") || "").slice(0, 10),
    vin_number: String(vehicle.vin_number || ""),
    engine_number: String(vehicle.engine_number || ""),
  };
}

function assignmentState(vehicle: InventoryRecord): AssignmentFilter {
  if (vehicle.assignment_conflict && !vehicle.active_trip?.id) return "unverified";
  if (vehicle.assignment_data_available === false && !isVehicleAssigned(vehicle)) return "unverified";
  return isVehicleAssigned(vehicle) ? "assigned" : "unassigned";
}

function responseMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed. Try again.";
}

function Metric({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick?: () => void }) {
  const content = <><p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p></>;
  return onClick ? <button type="button" onClick={onClick} className={`rounded-xl border border-pink-100 bg-white p-3 text-left shadow-[0_8px_22px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>{content}</button> : <article className={`rounded-xl border border-pink-100 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)] ${tone}`}>{content}</article>;
}

export default function VehicleInventoryPage() {
  const [role, setRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<InventoryRecord[]>([]);
  const [maintenance, setMaintenance] = useState<InventoryRecord[]>([]);
  const [relationshipsReady, setRelationshipsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [sortField, setSortField] = useState<VehicleSortField>("plate_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formVehicle, setFormVehicle] = useState<InventoryRecord | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [documentsVehicleId, setDocumentsVehicleId] = useState<string | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pendingStatus, setPendingStatus] = useState<FleetVehicleStatus>("Available");
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
    setError("");

    const [vehicleResult, maintenanceResult] = await Promise.allSettled([
      fetchJson("/api/vehicles?include_assignments=true", { cache: "no-store" }),
      fetchJson("/api/maintenance", { cache: "no-store" }),
    ]);
    const nextVehicles = vehicleResult.status === "fulfilled" && Array.isArray(vehicleResult.value)
      ? vehicleResult.value as InventoryRecord[]
      : [];
    const nextMaintenance = maintenanceResult.status === "fulfilled" && Array.isArray(maintenanceResult.value)
      ? maintenanceResult.value as InventoryRecord[]
      : [];

    if (vehicleResult.status === "rejected") setError(responseMessage(vehicleResult.reason));
    else if (maintenanceResult.status === "rejected") setError(`Maintenance status could not be verified: ${responseMessage(maintenanceResult.reason)}`);

    setVehicles(nextVehicles);
    setMaintenance(nextMaintenance);
    setRelationshipsReady(
      vehicleResult.status === "fulfilled"
      && maintenanceResult.status === "fulfilled"
      && nextVehicles.every((vehicle) => vehicle.trip_data_available !== false),
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadData(), 0);
    const interval = window.setInterval(() => void loadData(true), 30_000);
    const events = new EventSource("/api/events/assignments");
    let refreshTimer = 0;
    const refreshSoon = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadData(true), 400);
    };
    events.addEventListener("assignment", refreshSoon);
    events.addEventListener("tracking", refreshSoon);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      events.close();
    };
  }, [loadData]);

  useEffect(() => {
    if (!selectedVehicleId) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setDocuments([]);
      setDocumentsError("");
      setDocumentsLoading(true);
      void fetchJson(`/api/vehicles/documents?vehicle_id=${encodeURIComponent(selectedVehicleId)}`, { cache: "no-store" })
        .then((result) => {
          if (active) {
            setDocuments(Array.isArray(result) ? result as VehicleDocument[] : []);
            setDocumentsVehicleId(selectedVehicleId);
          }
        })
        .catch((loadError) => {
          if (active) {
            setDocumentsError(responseMessage(loadError));
            setDocumentsVehicleId(selectedVehicleId);
          }
        })
        .finally(() => {
          if (active) setDocumentsLoading(false);
        });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedVehicleId]);

  const rows = useMemo<InventoryRow[]>(() => vehicles.map((vehicle) => ({
    vehicle,
    status: getVehicleStatus(vehicle, maintenance, relationshipsReady),
  })), [vehicles, maintenance, relationshipsReady]);

  const vehicleTypes = useMemo(() => [...new Set(rows.map(({ vehicle }) => String(valueOf(vehicle, "vehicle_type", "type") || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const statusOptions = useMemo(() => [...new Set(rows.map((row) => row.status))].sort((a, b) => VEHICLE_STATUSES.indexOf(a) - VEHICLE_STATUSES.indexOf(b)), [rows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(({ vehicle, status }) => {
      const vehicleType = String(valueOf(vehicle, "vehicle_type", "type") || "");
      if (typeFilter !== "all" && vehicleType !== typeFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      const state = assignmentState(vehicle);
      if (assignmentFilter !== "all" && state !== assignmentFilter) return false;
      if (needle) {
        const trip = vehicle.active_trip as InventoryRecord | null;
        const searchable = [
          vehicle.id,
          vehicle.plate_number,
          vehicle.vehicle_type,
          vehicle.manufacturer,
          vehicle.model,
          vehicle.fuel_type,
          vehicle.driver,
          vehicle.driver_id,
          trip?.id,
          trip?.to_location,
          status,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!searchable.includes(needle)) return false;
      }
      return true;
    });

    const valueForSort = (row: InventoryRow) => {
      if (sortField === "status") return row.status;
      if (sortField === "assignment") return getAssignmentLabel(row.vehicle);
      return row.vehicle[sortField] ?? "";
    };
    filtered.sort((left, right) => {
      const leftValue = valueForSort(left);
      const rightValue = valueForSort(right);
      let comparison = 0;
      if (["capacity_kg", "mileage"].includes(sortField)) comparison = (Number(leftValue) || 0) - (Number(rightValue) || 0);
      else if (["registration_expiry", "insurance_expiry"].includes(sortField)) {
        const leftTime = leftValue ? Date.parse(String(leftValue)) : Number.MAX_SAFE_INTEGER;
        const rightTime = rightValue ? Date.parse(String(rightValue)) : Number.MAX_SAFE_INTEGER;
        comparison = leftTime - rightTime;
      } else comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return comparison * (sortDirection === "asc" ? 1 : -1);
    });
    return filtered;
  }, [rows, query, typeFilter, statusFilter, assignmentFilter, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const counts = useMemo(() => ({
    total: rows.length,
    available: rows.filter((row) => row.status === "Available").length,
    onTrip: rows.filter((row) => row.status === "On Trip").length,
    attention: rows.filter((row) => ["Under Maintenance", "Inactive", "Unverified"].includes(row.status)).length,
    assigned: rows.filter(({ vehicle }) => isVehicleAssigned(vehicle)).length,
  }), [rows]);

  const complianceWarnings = useMemo(() => {
    let registrations = 0;
    let insurance = 0;
    let incomplete = 0;
    vehicles.forEach((vehicle) => {
      const registration = documentExpiry(valueOf(vehicle, "registration_expiry", "registrationExpiry"));
      const policy = documentExpiry(valueOf(vehicle, "insurance_expiry", "insuranceExpiry"));
      if (registration === "missing" || registration === "expired" || registration === "soon") registrations += 1;
      if (policy === "missing" || policy === "expired" || policy === "soon") insurance += 1;
      if (!vehicle.plate_number || !valueOf(vehicle, "vehicle_type", "type") || !vehicle.manufacturer || !vehicle.model || vehicle.capacity_kg == null || !valueOf(vehicle, "fuel_type", "fuelType")) incomplete += 1;
    });
    const unavailable = rows.filter((row) => row.status === "Under Maintenance" || row.status === "Inactive").length;
    return { registrations, insurance, incomplete, unavailable };
  }, [vehicles, rows]);

  const selectedVehicle = selectedVehicleId ? vehicles.find((vehicle) => String(vehicle.id) === selectedVehicleId) || null : null;
  const selectedStatus = selectedVehicle ? getVehicleStatus(selectedVehicle, maintenance, relationshipsReady) : "Unverified";

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? "" : current), 4000);
  }

  function openCreate() {
    setFormVehicle(null);
    setFormError("");
    setFormMode("create");
  }

  function openEdit(vehicle: InventoryRecord) {
    setFormVehicle(vehicle);
    setFormError("");
    setFormMode("edit");
  }

  async function saveVehicle(payload: Record<string, unknown>) {
    setSaving(true);
    setFormError("");
    try {
      const plate = String(payload.plate_number || "").trim().toUpperCase();
      const duplicate = vehicles.find((vehicle) =>
        String(vehicle.plate_number || "").trim().toUpperCase() === plate
        && String(vehicle.id) !== String(formVehicle?.id || ""),
      );
      if (duplicate) throw new Error("This plate number is already registered.");

      const result = formMode === "create"
        ? await createVehicle({ ...payload, id: await getNextVehicleId(), status: "Available", availability: "available" })
        : await updateVehicle(String(formVehicle?.id || ""), payload);
      setFormMode(null);
      showNotice(`${String(result?.plate_number || result?.id || "Vehicle")} ${formMode === "create" ? "registered" : "updated"}.`);
      await loadData(true);
    } catch (saveError) {
      setFormError(responseMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(file: File, type: string, documentNumber: string, expiry: string) {
    setDocumentsError("");
    try {
      if (!selectedVehicle) throw new Error("Select a vehicle before uploading a document.");
      if (file.size > 15 * 1024 * 1024) throw new Error("The selected file exceeds the 15 MB limit.");
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") throw new Error("Choose a PDF or image file.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${selectedVehicle.id}/${Date.now()}-${safeName}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      await uploadVehicleDocument({ path, content: btoa(binary), content_type: file.type || "application/octet-stream" });
      await createVehicleDocument({
        vehicle_id: String(selectedVehicle.id),
        document_type: type,
        document_number: documentNumber || null,
        expiry_date: expiry || null,
        file_url: path,
        status: "Valid",
      });
      const result = await fetchJson(`/api/vehicles/documents?vehicle_id=${encodeURIComponent(String(selectedVehicle.id))}`, { cache: "no-store" });
      setDocuments(Array.isArray(result) ? result as VehicleDocument[] : []);
      showNotice(`${type} document uploaded.`);
      return true;
    } catch (uploadError) {
      setDocumentsError(responseMessage(uploadError));
      return false;
    }
  }

  function startStatusChange() {
    if (!selectedVehicle) return;
    setPendingStatus(selectedStatus === "Available" ? "Under Maintenance" : "Available");
    setConfirmAction("status");
  }

  async function confirmVehicleAction() {
    if (!selectedVehicle) return;
    setConfirming(true);
    setError("");
    try {
      const nextStatus = confirmAction === "deactivate" ? "Inactive" : pendingStatus;
      await updateVehicle(String(selectedVehicle.id), { status: nextStatus });
      setConfirmAction(null);
      showNotice(`${String(selectedVehicle.plate_number || selectedVehicle.id)} marked ${nextStatus}.`);
      await loadData(true);
    } catch (actionError) {
      setError(responseMessage(actionError));
    } finally {
      setConfirming(false);
    }
  }

  function toggleSort(field: VehicleSortField) {
    if (sortField === field) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setAssignmentFilter("all");
    setPage(1);
  }

  return (
    <RoleRestricted permission={{ module: "fvm", action: "view" }} hideWhenRestricted>
      <div className="fvm-page-shell flex min-h-screen flex-col bg-[#fffafd] text-slate-800">
        <GlobalNavbar />
        <main className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <header className="rounded-2xl border border-pink-100 bg-white p-4 shadow-[0_12px_36px_rgba(236,72,153,0.07)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-pink-700">Fleet & Vehicle Management</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Vehicle inventory</h1>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">Vehicle records, specifications, compliance documents, and current assignment context.</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button type="button" onClick={() => void loadData(true)} disabled={refreshing} aria-label="Refresh vehicle inventory" title="Refresh inventory" className="rounded-lg border border-pink-200 bg-white p-2.5 text-slate-600 transition hover:bg-pink-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button>
                {canCreate && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-pink-700"><Plus className="h-4 w-4" />Register vehicle</button>}
              </div>
            </div>
          </header>

          {!loading && <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <Metric label="Registered vehicles" value={counts.total} tone="" />
            <Metric label="Available" value={counts.available} tone="" onClick={() => { setStatusFilter("Available"); setPage(1); }} />
            <Metric label="On trip" value={counts.onTrip} tone="" onClick={() => { setStatusFilter("On Trip"); setPage(1); }} />
            <Metric label="Needs attention" value={counts.attention} tone="" onClick={() => { setStatusFilter("all"); setPage(1); }} />
            <Metric label="Assigned" value={counts.assigned} tone="" onClick={() => { setAssignmentFilter("assigned"); setPage(1); }} />
          </section>}

          {(error || notice) && <div role={error ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{error || notice}
            {error && <button type="button" onClick={() => void loadData()} className="ml-auto shrink-0 font-bold underline">Retry</button>}
          </div>}

          {!loading && vehicles.length > 0 && (complianceWarnings.registrations > 0 || complianceWarnings.insurance > 0 || complianceWarnings.incomplete > 0 || complianceWarnings.unavailable > 0) && <section className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-xs font-bold text-amber-900">Record and document checks</p><p className="mt-0.5 text-[10px] text-amber-800">Warnings reflect missing fields or document dates within 30 days / past expiry.</p></div></div>
            <div className="flex flex-wrap gap-2 text-[9px] font-bold text-amber-900">
              {complianceWarnings.registrations > 0 && <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">Registration: {complianceWarnings.registrations}</span>}
              {complianceWarnings.insurance > 0 && <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">Insurance: {complianceWarnings.insurance}</span>}
              {complianceWarnings.incomplete > 0 && <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">Incomplete records: {complianceWarnings.incomplete}</span>}
              {complianceWarnings.unavailable > 0 && <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">Unavailable: {complianceWarnings.unavailable}</span>}
            </div>
          </section>}

          <section className="rounded-2xl border border-pink-100 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.03)] sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="text-sm font-black text-slate-900">Vehicle records</h2><p className="mt-0.5 text-[10px] text-slate-500">{filteredRows.length} shown · {vehicles.length} total</p></div>
              {(query || typeFilter !== "all" || statusFilter !== "all" || assignmentFilter !== "all") && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-pink-700 hover:bg-pink-50"><X className="h-3 w-3" />Clear filters</button>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(3,minmax(140px,1fr))]">
              <label className="relative block">
                <span className="sr-only">Search vehicles</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search plate, ID, make, trip…" className="w-full rounded-lg border border-pink-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500"><Truck className="h-3.5 w-3.5 text-pink-600" /><span className="sr-only">Filter vehicle type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"><option value="all">All vehicle types</option>{vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500"><Filter className="h-3.5 w-3.5 text-pink-600" /><span className="sr-only">Filter vehicle status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label className="flex items-center gap-2 rounded-lg border border-pink-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500"><span className="sr-only">Filter assignment state</span><select value={assignmentFilter} onChange={(event) => { setAssignmentFilter(event.target.value as AssignmentFilter); setPage(1); }} className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"><option value="all">All assignment states</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option><option value="unverified">Assignment unverified</option></select></label>
            </div>
          </section>

          {loading ? <section aria-label="Loading vehicle inventory" className="space-y-2 rounded-2xl border border-pink-100 bg-white p-4">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-pink-50" />)}</section> : vehicles.length === 0 && !error ? <section className="rounded-2xl border border-dashed border-pink-200 bg-white px-5 py-14 text-center"><Truck className="mx-auto h-8 w-8 text-pink-300" /><h2 className="mt-3 text-sm font-black text-slate-900">No vehicle records yet</h2><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Register a vehicle to begin building the live fleet inventory.</p>{canCreate && <button type="button" onClick={openCreate} className="mt-4 rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white hover:bg-pink-700">Register first vehicle</button>}</section> : <VehicleInventoryTable
            rows={pageRows}
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            totalRows={filteredRows.length}
            sortField={sortField}
            sortDirection={sortDirection}
            canUpdate={canUpdate}
            onSort={toggleSort}
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
            onView={(row) => setSelectedVehicleId(String(row.vehicle.id))}
            onEdit={(row) => openEdit(row.vehicle)}
          />}
        </main>
        <GlobalFooter />

        {formMode && <VehicleFormDialog
          key={`${formMode}-${String(formVehicle?.id || "new")}`}
          mode={formMode}
          title={formMode === "create" ? "Register a vehicle" : `Edit ${String(formVehicle?.plate_number || formVehicle?.id || "vehicle")}`}
          initialValues={toForm(formVehicle || undefined)}
          saving={saving}
          error={formError}
          onClose={() => { if (!saving) setFormMode(null); }}
          onSubmit={saveVehicle}
        />}

        {selectedVehicle && <VehicleDetailsPanel
          vehicle={selectedVehicle}
          status={selectedStatus}
          documents={documents}
          documentsLoading={documentsLoading || documentsVehicleId !== selectedVehicleId}
          documentsError={documentsError}
          canCreate={canCreate}
          canUpdate={canUpdate}
          onClose={() => { setSelectedVehicleId(null); setConfirmAction(null); }}
          onEdit={() => openEdit(selectedVehicle)}
          onChangeStatus={startStatusChange}
          onDeactivate={() => setConfirmAction("deactivate")}
          onUpload={uploadDocument}
        />}

        {confirmAction && selectedVehicle && <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirming) setConfirmAction(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="vehicle-confirm-title" className="w-full max-w-md rounded-2xl border border-pink-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-50 p-2 text-amber-700"><AlertTriangle className="h-4 w-4" /></div><div><h2 id="vehicle-confirm-title" className="text-sm font-black text-slate-900">{confirmAction === "deactivate" ? "Deactivate vehicle?" : "Update operational status?"}</h2><p className="mt-1 text-xs leading-relaxed text-slate-600">{confirmAction === "deactivate" ? `This marks ${String(selectedVehicle.plate_number || selectedVehicle.id)} as Inactive. Its vehicle and trip history will remain in the system.` : `Change status for ${String(selectedVehicle.plate_number || selectedVehicle.id)}. Active trip and maintenance rules are checked by the server.`}</p></div></div>
            {confirmAction === "status" && <label className="mt-4 block text-[10px] font-bold text-slate-600">New status<select value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value as FleetVehicleStatus)} className="mt-1 w-full rounded-lg border border-pink-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-pink-500"><option value="Available">Available</option><option value="Under Maintenance">Under Maintenance</option><option value="Inactive">Inactive</option></select></label>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirmAction(null)} disabled={confirming} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Cancel</button><button type="button" onClick={() => void confirmVehicleAction()} disabled={confirming || (confirmAction === "status" && pendingStatus === selectedStatus)} className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${confirmAction === "deactivate" || pendingStatus === "Inactive" ? "bg-rose-600 hover:bg-rose-700" : "bg-pink-600 hover:bg-pink-700"}`}>{confirming ? "Updating…" : confirmAction === "deactivate" ? "Deactivate vehicle" : "Confirm status"}</button></div>
          </section>
        </div>}
      </div>
    </RoleRestricted>
  );
}