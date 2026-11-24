"use client";

import React from "react";
import { formatCurrency, formatDateTime, formatNumber, statusTone } from "../services/fleetService";
import type { StructuredCard, StructuredCardType } from "../types/chatbot";

type CardData = Record<string, unknown>;

function isCardData(value: unknown): value is CardData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCardData(value: unknown): CardData {
  return isCardData(value) ? value : {};
}

function asCardDataList(value: unknown): CardData[] {
  return Array.isArray(value) ? value.filter(isCardData) : [];
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

function FleetSummaryCard({ data }: { data: CardData }) {
  const vehicles = asCardData(data.vehicles);
  const trips = asCardData(data.trips);
  const drivers = asCardData(data.drivers);
  return (
    <CardShell title="Fleet Summary">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(asNumber(vehicles.available))}</p>
          <p className="text-[10px] text-slate-500">Vehicles Available</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(asNumber(trips.inTransit))}</p>
          <p className="text-[10px] text-slate-500">In Transit</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(asNumber(drivers.total))}</p>
          <p className="text-[10px] text-slate-500">Drivers</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>Total vehicles: {formatNumber(asNumber(vehicles.total))}</span>
        <span>In maintenance: {formatNumber(asNumber(vehicles.inMaintenance))}</span>
      </div>
    </CardShell>
  );
}

function VehicleListCard({ data }: { data: CardData }) {
  const vehicles = asCardDataList(data.vehicles);
  return (
    <CardShell title={`Vehicles (${asText(data.count, String(vehicles.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {vehicles.length === 0 && <p className="text-xs text-slate-400">No vehicles matched.</p>}
        {vehicles.map((v, index) => (
          <div key={asText(v.id, String(index))} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{asText(v.plate_number) || asText(v.id, "—")}</p>
              <p className="text-[11px] text-slate-500">{[v.vehicle_type, v.manufacturer, v.model].map((value) => asText(value)).filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <StatusPill status={asText(v.availability) || asText(v.status) || null} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function VehicleCard({ data }: { data: CardData }) {
  const v = asCardDataList(data.vehicles)[0];
  if (!v) return <CardShell title="Vehicle">{asText(data.message, "Not found.")}</CardShell>;
  return (
    <CardShell title={`Vehicle ${asText(v.plate_number) || asText(v.id)}`}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Status</span><StatusPill status={asText(v.status) || null} /></div>
        <div className="flex justify-between"><span>Availability</span><StatusPill status={asText(v.availability) || null} /></div>
        <div className="flex justify-between"><span>Driver</span><span>{asText(v.driver, "Unassigned")}</span></div>
        <div className="flex justify-between"><span>Location</span><span>{asText(v.location, "—")}</span></div>
        <div className="flex justify-between"><span>Mileage</span><span>{formatNumber(asNumber(v.mileage), " km")}</span></div>
        <div className="flex justify-between"><span>Next service</span><span>{asText(v.next_service, "—")}</span></div>
      </div>
    </CardShell>
  );
}

function TripListCard({ data }: { data: CardData }) {
  const trips = asCardDataList(data.trips);
  return (
    <CardShell title={`Active Trips (${asText(data.count, String(trips.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {trips.length === 0 && <p className="text-xs text-slate-400">No active trips.</p>}
        {trips.map((t, index) => (
          <div key={asText(t.id, String(index))} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{asText(t.id)}</p>
              <StatusPill status={asText(t.status) || null} />
            </div>
            <p className="text-[11px] text-slate-500">
              {asText(t.driver_name, "Unassigned driver")} · {asText(t.vehicle_plate) || asText(t.vehicle_id, "No vehicle")}
            </p>
            {typeof t.delay_reason === "string" && <p className="text-[11px] text-rose-500">Delay: {t.delay_reason}</p>}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function TripCard({ data }: { data: CardData }) {
  const t = asCardData(data.trip);
  if (!Object.keys(t).length) return <CardShell title="Trip">{asText(data.message, "Not found.")}</CardShell>;
  return (
    <CardShell title={`Trip ${asText(t.id)}`}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Status</span><StatusPill status={asText(t.status) || null} /></div>
        <div className="flex justify-between"><span>Driver</span><span>{asText(t.driver_name, "—")}</span></div>
        <div className="flex justify-between"><span>Vehicle</span><span>{asText(t.vehicle_plate) || asText(t.vehicle_id, "—")}</span></div>
        <div className="flex justify-between"><span>ETA</span><span>{formatDateTime(asText(t.estimated_arrival) || null)}</span></div>
        <div className="flex justify-between"><span>Progress</span><span>{formatNumber(asNumber(t.progress), "%")}</span></div>
      </div>
    </CardShell>
  );
}

function DriverListCard({ data }: { data: CardData }) {
  const drivers = asCardDataList(data.drivers);
  return (
    <CardShell title={`Available Drivers (${asText(data.count, String(drivers.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {drivers.length === 0 && <p className="text-xs text-slate-400">No available drivers.</p>}
        {drivers.map((d, index) => (
          <div key={asText(d.id, String(index))} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{asText(d.full_name, "Unnamed driver")}</p>
            <span className="text-[11px] text-slate-500">{asText(d.phone, "—")}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function DriverCard({ data }: { data: CardData }) {
  const d = asCardData(data.driver);
  if (!Object.keys(d).length) return <CardShell title="Driver">{asText(data.message, "Not found.")}</CardShell>;
  const currentAssignment = asCardData(data.currentAssignment);
  const performance = asCardData(data.performance);
  return (
    <CardShell title={asText(d.full_name, "Driver")}>
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Phone</span><span>{asText(d.phone, "—")}</span></div>
        <div className="flex justify-between"><span>Assigned vehicle</span><span>{asText(currentAssignment.vehicle_id, "Unassigned")}</span></div>
        <div className="flex justify-between"><span>Completed trips</span><span>{formatNumber(asNumber(performance.completed_trips))}</span></div>
        <div className="flex justify-between"><span>Safety score</span><span>{formatNumber(asNumber(performance.safety_score))}</span></div>
      </div>
    </CardShell>
  );
}

function DispatchListCard({ data }: { data: CardData }) {
  const dispatches = asCardDataList(data.dispatches);
  return (
    <CardShell title={`Active Dispatches (${asText(data.count, String(dispatches.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {dispatches.length === 0 && <p className="text-xs text-slate-400">No dispatches found.</p>}
        {dispatches.map((d, index) => (
          <div key={asText(d.id, String(index))} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Trip {asText(d.trip_id)}</p>
              <StatusPill status={asText(asCardData(d.trip).status) || null} />
            </div>
            <p className="text-[11px] text-slate-500">{formatDateTime(asText(d.dispatched_at) || null)}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function RouteListCard({ data }: { data: CardData }) {
  const routes = asCardDataList(data.routes);
  return (
    <CardShell title={`Route Plans (${asText(data.count, String(routes.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {routes.length === 0 && <p className="text-xs text-slate-400">No route plans found.</p>}
        {routes.map((r, index) => (
          <div key={asText(r.id, String(index))} className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{asText(r.route_number) || asText(r.id)}</p>
              <StatusPill status={asText(r.status) || null} />
            </div>
            <p className="text-[11px] text-slate-500">{asText(r.pickup_location, "—")} · {formatNumber(asNumber(r.distance_km), " km")}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function FuelSummaryCard({ data }: { data: CardData }) {
  return (
    <CardShell title={`Fuel Summary (${asText(data.periodDays, "—")}d)`}>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-slate-900">{formatNumber(asNumber(data.totalLiters), " L")}</p>
          <p className="text-[10px] text-slate-500">Total Liters</p>
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{formatCurrency(asNumber(data.totalCost))}</p>
          <p className="text-[10px] text-slate-500">Total Cost</p>
        </div>
      </div>
    </CardShell>
  );
}

function MaintenanceListCard({ data }: { data: CardData }) {
  const records = asCardDataList(data.records);
  return (
    <CardShell title={`Maintenance History (${asText(data.count, String(records.length))})`}>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {records.length === 0 && <p className="text-xs text-slate-400">No maintenance records found.</p>}
        {records.map((r, index) => (
          <div key={asText(r.id, String(index))} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{asText(r.maintenance_type)}</p>
            <p className="text-[11px] text-slate-500">{formatDateTime(asText(r.performed_at) || null)} · {formatCurrency(asNumber(r.cost))}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function IncidentCreatedCard({ data }: { data: CardData }) {
  const r = asCardData(data.report);
  return (
    <CardShell title="Issue Reported">
      <div className="space-y-1 text-sm text-slate-700">
        <div className="flex justify-between"><span>Type</span><span>{asText(r.incident_type)}</span></div>
        <div className="flex justify-between"><span>Reported</span><span>{formatDateTime(asText(r.reported_at) || null)}</span></div>
      </div>
    </CardShell>
  );
}

type CardRenderer = (props: { data: CardData }) => React.ReactNode;

const RENDERERS: Partial<Record<StructuredCardType, CardRenderer>> = {
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
