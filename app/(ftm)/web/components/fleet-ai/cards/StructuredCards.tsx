"use client";

import { formatCurrency, formatDateTime, formatNumber, statusTone } from "../services/fleetService";
import type { StructuredCard } from "../types/chatbot";

const TONE_CLASSES: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  negative: "bg-rose-50 text-rose-700 border-rose-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusPill({ status }: { status?: string | null }) {
  const tone = statusTone(status);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      {status || "Unknown"}
    </span>
  );
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function FleetSummaryCard({ data }: { data: any }) {
  return (
    <CardShell title="Fleet Summary">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(data.vehicles?.available)}</p>
          <p className="text-[10px] text-slate-500">Vehicles Available</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(data.trips?.inTransit)}</p>
          <p className="text-[10px] text-slate-500">In Transit</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(data.drivers?.total)}</p>
          <p className="text-[10px] text-slate-500">Drivers</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>Total vehicles: {formatNumber(data.vehicles?.total)}</span>
        <span>In maintenance: {formatNumber(data.vehicles?.inMaintenance)}</span>
      </div>
    </CardShell>
  );
}

function VehicleListCard({ data }: { data: any }) {
  const vehicles = data.vehicles || [];
  return (
    <CardShell title={`Vehicles (${data.count ?? vehicles.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {vehicles.length === 0 && <p className="text-xs text-slate-400">No vehicles matched.</p>}
        {vehicles.map((v: any) => (
          <div key={v.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{v.plate_number || v.id}</p>
              <p className="text-[11px] text-slate-500">{[v.vehicle_type, v.manufacturer, v.model].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <StatusPill status={v.availability || v.status} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function VehicleCard({ data }: { data: any }) {
  const v = (data.vehicles || [])[0];
  if (!v) return <CardShell title="Vehicle">{data.message || "Not found."}</CardShell>;
  return (
    <CardShell title={`Vehicle ${v.plate_number || v.id}`}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Status</span><StatusPill status={v.status} /></div>
        <div className="flex justify-between"><span>Availability</span><StatusPill status={v.availability} /></div>
        <div className="flex justify-between"><span>Driver</span><span>{v.driver || "Unassigned"}</span></div>
        <div className="flex justify-between"><span>Location</span><span>{v.location || "—"}</span></div>
        <div className="flex justify-between"><span>Mileage</span><span>{formatNumber(v.mileage, " km")}</span></div>
        <div className="flex justify-between"><span>Next service</span><span>{v.next_service || "—"}</span></div>
      </div>
    </CardShell>
  );
}

function TripListCard({ data }: { data: any }) {
  const trips = data.trips || [];
  return (
    <CardShell title={`Active Trips (${data.count ?? trips.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {trips.length === 0 && <p className="text-xs text-slate-400">No active trips.</p>}
        {trips.map((t: any) => (
          <div key={t.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{t.id}</p>
              <StatusPill status={t.status} />
            </div>
            <p className="text-[11px] text-slate-500">
              {t.driver_name || "Unassigned driver"} · {t.vehicle_plate || t.vehicle_id || "No vehicle"}
            </p>
            {t.delay_reason && <p className="text-[11px] text-rose-500">Delay: {t.delay_reason}</p>}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function TripCard({ data }: { data: any }) {
  const t = data.trip;
  if (!t) return <CardShell title="Trip">{data.message || "Not found."}</CardShell>;
  return (
    <CardShell title={`Trip ${t.id}`}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Status</span><StatusPill status={t.status} /></div>
        <div className="flex justify-between"><span>Driver</span><span>{t.driver_name || "—"}</span></div>
        <div className="flex justify-between"><span>Vehicle</span><span>{t.vehicle_plate || t.vehicle_id || "—"}</span></div>
        <div className="flex justify-between"><span>ETA</span><span>{formatDateTime(t.estimated_arrival)}</span></div>
        <div className="flex justify-between"><span>Progress</span><span>{formatNumber(t.progress, "%")}</span></div>
      </div>
    </CardShell>
  );
}

function DriverListCard({ data }: { data: any }) {
  const drivers = data.drivers || [];
  return (
    <CardShell title={`Available Drivers (${data.count ?? drivers.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {drivers.length === 0 && <p className="text-xs text-slate-400">No available drivers.</p>}
        {drivers.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{d.full_name || "Unnamed driver"}</p>
            <span className="text-[11px] text-slate-500">{d.phone || "—"}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function DriverCard({ data }: { data: any }) {
  const d = data.driver;
  if (!d) return <CardShell title="Driver">{data.message || "Not found."}</CardShell>;
  return (
    <CardShell title={d.full_name || "Driver"}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Phone</span><span>{d.phone || "—"}</span></div>
        <div className="flex justify-between"><span>Assigned vehicle</span><span>{data.currentAssignment?.vehicle_id || "Unassigned"}</span></div>
        <div className="flex justify-between"><span>Completed trips</span><span>{formatNumber(data.performance?.completed_trips)}</span></div>
        <div className="flex justify-between"><span>Safety score</span><span>{formatNumber(data.performance?.safety_score)}</span></div>
      </div>
    </CardShell>
  );
}

function DispatchListCard({ data }: { data: any }) {
  const dispatches = data.dispatches || [];
  return (
    <CardShell title={`Active Dispatches (${data.count ?? dispatches.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {dispatches.length === 0 && <p className="text-xs text-slate-400">No dispatches found.</p>}
        {dispatches.map((d: any) => (
          <div key={d.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Trip {d.trip_id}</p>
              <StatusPill status={d.trip?.status} />
            </div>
            <p className="text-[11px] text-slate-500">{formatDateTime(d.dispatched_at)}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function RouteListCard({ data }: { data: any }) {
  const routes = data.routes || [];
  return (
    <CardShell title={`Route Plans (${data.count ?? routes.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {routes.length === 0 && <p className="text-xs text-slate-400">No route plans found.</p>}
        {routes.map((r: any) => (
          <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{r.route_number || r.id}</p>
              <StatusPill status={r.status} />
            </div>
            <p className="text-[11px] text-slate-500">{r.pickup_location || "—"} · {formatNumber(r.distance_km, " km")}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function FuelSummaryCard({ data }: { data: any }) {
  return (
    <CardShell title={`Fuel Summary (${data.periodDays}d)`}>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(data.totalLiters, " L")}</p>
          <p className="text-[10px] text-slate-500">Total Liters</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatCurrency(data.totalCost)}</p>
          <p className="text-[10px] text-slate-500">Total Cost</p>
        </div>
      </div>
    </CardShell>
  );
}

function MaintenanceListCard({ data }: { data: any }) {
  const records = data.records || [];
  return (
    <CardShell title={`Maintenance History (${data.count ?? records.length})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {records.length === 0 && <p className="text-xs text-slate-400">No maintenance records found.</p>}
        {records.map((r: any) => (
          <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{r.maintenance_type}</p>
            <p className="text-[11px] text-slate-500">{formatDateTime(r.performed_at)} · {formatCurrency(r.cost)}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function IncidentCreatedCard({ data }: { data: any }) {
  const r = data.report;
  return (
    <CardShell title="Issue Reported">
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Type</span><span>{r?.incident_type}</span></div>
        <div className="flex justify-between"><span>Reported</span><span>{formatDateTime(r?.reported_at)}</span></div>
      </div>
    </CardShell>
  );
}

const RENDERERS: Record<string, (props: { data: any }) => JSX.Element> = {
  fleet_summary: FleetSummaryCard,
  vehicle_list: VehicleListCard,
  vehicle: VehicleCard,
  trip_list: TripListCard,
  trip: TripCard,
  driver_list: DriverListCard,
  driver: DriverCard,
  dispatch_list: DispatchListCard,
  route_list: RouteListCard,
  fuel_summary: FuelSummaryCard,
  maintenance_list: MaintenanceListCard,
  incident_created: IncidentCreatedCard,
};

export default function StructuredCardRenderer({ card }: { card: StructuredCard }) {
  const Renderer = RENDERERS[card.type];
  if (!Renderer) return null;
  return <Renderer data={card.data} />;
}
