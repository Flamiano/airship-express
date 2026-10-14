"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Network as NetworkIcon,
  RefreshCw,
  Route as RouteIcon,
  Truck,
  X,
  LocateFixed,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarPlus,
  ExternalLink,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import SpncAssistant from "../../components/SpncAssistant";

/* ------------------------------------------------------------------
   Service Network & Route Planner (Network Control)

   Part of the Freight Management System, Service Provider & Network Control group.
   This page does not own its reference data. It reads from the sibling modules:

     Shipments (other team)            -> incoming delivery requests
     Service Provider Management       -> PROVIDERS (status, vehicles, coverage)
     Rates & Tariffs Management        -> RATES (per vehicle), lane tolls, handling fee
     Schedules & Transit Timetable     -> LANES (transit times), TIMETABLE (departure slots)
     SOP Manager                       -> SOP_DEFS (procedures that apply to a delivery)

   Those five are sample data below, each in its own block, so every one can be
   replaced by a call to its real module later.

   Views
   1. Network         lanes, providers, timetable and live vehicles
   2. Route planning  a request from Shipments gets a route, a provider and a departure slot
   3. Deliveries      Upcoming (planned, waiting for departure) and On-going (monitored)

   Lifecycle: Request -> Planned (Upcoming) -> departure time -> On-going -> Delivered
------------------------------------------------------------------- */

type Bound = "Inbound" | "Outbound";
type Phase = "unplanned" | "upcoming" | "ongoing" | "delivered";
type Pt = { x: number; y: number }; // x = longitude, y = latitude
type Loc = { name: string; lat: number; lng: number; port?: boolean };
type Lane = { id: string; a: string; b: string; traffic: number; toll: number };
type Geo = { pts: Pt[]; cum: number[]; total: number };
type Provider = {
  id: string;
  name: string;
  status: "Active" | "Suspended" | "Under review";
  vehicles: string[];
  hubs: string[];
  rate: number; // rate index applied on top of the tariff
};
type RouteOption = {
  key: string;
  nodes: string[];
  laneIds: string[];
  km: number;
  transitMin: number;
  cost: number; // tariff cost before the provider rate index
  tags: string[];
};
type Plan = {
  route: string[];
  km: number;
  transitMin: number;
  cost: number;
  providerId: string;
  departAt: number; // scheduled shipping time (network clock, ms)
  plannedMs: number; // planned travel time; drop time = departAt + plannedMs
  speed: number; // 1 = on plan, below 1 = running slow (simulation only)
  tag: string;
  sops: string[];
};
type Shipment = {
  id: number;
  ref: string;
  cargo: string;
  bound: Bound;
  vehicle: string;
  origin: string;
  destination: string;
  readyAt: number;
  plan: Plan | null;
};
type Planned = Shipment & { plan: Plan };

/* ---------- Network clock (sped up so the demo is watchable) ---------- */

const MIN = 60_000;
const SIM_RATE = 1; // 1 real second = 2 network minutes. Set to 1 for real time.
const AVG_KPH = 45;
const ROAD_FACTOR = 1.3; // road distance ≈ straight-line distance × 1.3
const LEAD = 30 * MIN; // earliest a new plan can depart
const HANDLING_MIN = 15; // per intermediate hub
const HANDLING_FEE = 350; // per intermediate hub, PHP
const MAX_UNPLANNED = 6;
const DELIVERIES_PAGE_SIZE = 10; // deliveries per page, with Back / Next
const KEEP_DELIVERED_MS = 30 * MIN;

/* ---------- Network: hubs and lanes ---------- */

// Real locations (latitude, longitude) of each hub, used to place them on the map.
const LOCS: Record<string, Loc> = {
  subic: { name: "Subic Port", lat: 14.813, lng: 120.287, port: true }, // Subic Bay Freeport
  clark: { name: "Clark DC", lat: 15.186, lng: 120.547 }, // Clark Freeport, Pampanga
  bulacan: { name: "Bulacan WH", lat: 14.8433, lng: 120.8114 }, // Malolos, Bulacan
  qc: { name: "Quezon City WH", lat: 14.676, lng: 121.0437 },
  antipolo: { name: "Antipolo Hub", lat: 14.586, lng: 121.176 },
  manila: { name: "Manila Port", lat: 14.5869, lng: 120.9655, port: true }, // Port Area, Manila
  cavite: { name: "Cavite WH", lat: 14.4297, lng: 120.9367 }, // Imus, Cavite
  laguna: { name: "Laguna DC", lat: 14.2117, lng: 121.1653 }, // Calamba, Laguna
  batangas: { name: "Batangas Port", lat: 13.7565, lng: 121.0437, port: true },
  lucena: { name: "Lucena Hub", lat: 13.9314, lng: 121.617 },
};

// Great-circle distance in km
const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* Schedules & Transit Timetable (sample): lanes with traffic factor, plus departure slots per hub */
const LANES: Lane[] = [
  { id: "L1", a: "subic", b: "clark", traffic: 1.0, toll: 420 },
  { id: "L2", a: "clark", b: "bulacan", traffic: 1.0, toll: 260 },
  { id: "L3", a: "clark", b: "qc", traffic: 1.15, toll: 380 },
  { id: "L4", a: "bulacan", b: "qc", traffic: 1.25, toll: 150 },
  { id: "L5", a: "bulacan", b: "manila", traffic: 1.2, toll: 180 },
  { id: "L6", a: "qc", b: "manila", traffic: 1.5, toll: 90 },
  { id: "L7", a: "qc", b: "antipolo", traffic: 1.3, toll: 0 },
  { id: "L8", a: "manila", b: "cavite", traffic: 1.2, toll: 210 },
  { id: "L9", a: "manila", b: "laguna", traffic: 1.3, toll: 240 },
  { id: "L10", a: "antipolo", b: "laguna", traffic: 1.1, toll: 0 },
  { id: "L11", a: "cavite", b: "batangas", traffic: 1.0, toll: 320 },
  { id: "L12", a: "laguna", b: "batangas", traffic: 1.0, toll: 280 },
  { id: "L13", a: "laguna", b: "lucena", traffic: 1.0, toll: 230 },
  { id: "L14", a: "batangas", b: "lucena", traffic: 1.0, toll: 150 },
];

const TIMETABLE: Record<string, { everyH: number; offsetMin: number }> = {
  subic: { everyH: 3, offsetMin: 0 },
  clark: { everyH: 3, offsetMin: 30 },
  bulacan: { everyH: 2, offsetMin: 15 },
  qc: { everyH: 2, offsetMin: 0 },
  antipolo: { everyH: 3, offsetMin: 45 },
  manila: { everyH: 2, offsetMin: 30 },
  cavite: { everyH: 3, offsetMin: 15 },
  laguna: { everyH: 2, offsetMin: 45 },
  batangas: { everyH: 3, offsetMin: 0 },
  lucena: { everyH: 3, offsetMin: 30 },
};

const slotsFrom = (hub: string, after: number, n: number) => {
  const { everyH, offsetMin } = TIMETABLE[hub];
  const iv = everyH * 60 * MIN;
  const off = offsetMin * MIN;
  const first = Math.ceil((after - off) / iv) * iv + off;
  return Array.from({ length: n }, (_, i) => first + i * iv);
};

const laneKm = (l: Lane) => {
  const a = LOCS[l.a];
  const b = LOCS[l.b];
  return Math.max(5, Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng) * ROAD_FACTOR));
};
const laneMin = (l: Lane) => Math.round((laneKm(l) / AVG_KPH) * 60 * l.traffic);
const laneBetween = (a: string, b: string) => LANES.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));

/* ---------- Service Provider Management (sample) ---------- */

const PROVIDERS: Provider[] = [
  {
    id: "lbc",
    name: "LBC Express",
    status: "Active",
    vehicles: ["Closed Van", "Wing Van", "6-Wheeler Truck"],
    hubs: ["qc", "manila", "bulacan", "clark", "cavite", "laguna", "antipolo", "batangas"],
    rate: 1.0,
  },
  {
    id: "jt",
    name: "J&T Cargo",
    status: "Active",
    vehicles: ["Closed Van", "Wing Van", "6-Wheeler Truck", "10-Wheeler Truck"],
    hubs: ["clark", "bulacan", "qc", "manila", "cavite", "laguna", "antipolo", "batangas", "lucena"],
    rate: 0.95,
  },
  {
    id: "2go",
    name: "2GO Logistics",
    status: "Active",
    vehicles: ["6-Wheeler Truck", "10-Wheeler Truck", "Container Trailer"],
    hubs: ["subic", "clark", "bulacan", "qc", "manila", "cavite", "laguna", "batangas", "lucena"],
    rate: 1.1,
  },
  {
    id: "lalamove",
    name: "Lalamove Freight",
    status: "Active",
    vehicles: ["Closed Van", "Wing Van"],
    hubs: ["qc", "manila", "bulacan", "cavite", "laguna", "antipolo"],
    rate: 0.9,
  },
  {
    id: "coldlink",
    name: "Cold Link Reefers",
    status: "Active",
    vehicles: ["Reefer Truck"],
    hubs: ["clark", "bulacan", "qc", "manila", "cavite", "laguna", "batangas", "lucena"],
    rate: 1.2,
  },
  {
    id: "ninja",
    name: "Ninja Van B2B",
    status: "Suspended",
    vehicles: ["Closed Van"],
    hubs: ["qc", "manila", "bulacan", "clark", "cavite", "laguna", "antipolo", "batangas", "lucena", "subic"],
    rate: 0.85,
  },
];
const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<string, Provider>;

/* ---------- Rates & Tariffs Management (sample, PHP) ---------- */

const RATES: Record<string, { base: number; perKm: number }> = {
  "Closed Van": { base: 1800, perKm: 28 },
  "Wing Van": { base: 2800, perKm: 38 },
  "6-Wheeler Truck": { base: 3500, perKm: 45 },
  "10-Wheeler Truck": { base: 5200, perKm: 62 },
  "Reefer Truck": { base: 6800, perKm: 85 },
  "Container Trailer": { base: 7500, perKm: 95 },
};
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

/* ---------- SOP Manager (sample) ---------- */

const SOP_DEFS: Record<string, { title: string; note: string }> = {
  "SOP-01": { title: "Pre-dispatch checklist", note: "Vehicle, load and driver check before departure" },
  "SOP-02": { title: "Port and customs documents", note: "Required for routes touching a port hub" },
  "SOP-03": { title: "Cold-chain handling", note: "Temperature log and reefer pre-cool" },
  "SOP-04": { title: "Heavy vehicle routing and weigh-in", note: "Applies to 10-wheeler and container trailers" },
  "SOP-05": { title: "Proof of delivery", note: "Signed receipt at the drop-off hub" },
};

const sopsFor = (s: Pick<Shipment, "vehicle">, nodes: string[]) => {
  const out = ["SOP-01"];
  if (nodes.some((n) => LOCS[n].port)) out.push("SOP-02");
  if (s.vehicle === "Reefer Truck") out.push("SOP-03");
  if (s.vehicle === "10-Wheeler Truck" || s.vehicle === "Container Trailer") out.push("SOP-04");
  out.push("SOP-05");
  return out;
};

/* ---------- Shipments feed (simulated) ---------- */

const TEMPLATES: { origin: string; destination: string; bound: Bound; cargo: string; vehicles: string[] }[] = [
  { origin: "subic", destination: "qc", bound: "Inbound", cargo: "Import containers", vehicles: ["Container Trailer", "10-Wheeler Truck"] },
  { origin: "manila", destination: "qc", bound: "Inbound", cargo: "Port cargo", vehicles: ["Wing Van", "6-Wheeler Truck"] },
  { origin: "batangas", destination: "manila", bound: "Inbound", cargo: "Palletized goods", vehicles: ["6-Wheeler Truck", "Wing Van"] },
  { origin: "qc", destination: "antipolo", bound: "Outbound", cargo: "Retail orders", vehicles: ["Closed Van"] },
  { origin: "cavite", destination: "bulacan", bound: "Outbound", cargo: "Mixed freight", vehicles: ["Wing Van", "6-Wheeler Truck"] },
  { origin: "qc", destination: "batangas", bound: "Outbound", cargo: "Export cargo", vehicles: ["Container Trailer", "10-Wheeler Truck"] },
  { origin: "laguna", destination: "lucena", bound: "Outbound", cargo: "Consumer goods", vehicles: ["Closed Van", "6-Wheeler Truck"] },
  { origin: "clark", destination: "manila", bound: "Inbound", cargo: "Cold-chain produce", vehicles: ["Reefer Truck"] },
  { origin: "qc", destination: "lucena", bound: "Outbound", cargo: "Frozen goods", vehicles: ["Reefer Truck"] },
];

let seq = 1000;

// A request as it arrives from Shipments: no plan yet
function makeRequest(now: number): Shipment {
  const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const id = ++seq;
  return {
    id,
    ref: `SHP-${id}`,
    cargo: t.cargo,
    bound: t.bound,
    vehicle: t.vehicles[Math.floor(Math.random() * t.vehicles.length)],
    origin: t.origin,
    destination: t.destination,
    readyAt: now - Math.random() * 60 * MIN,
    plan: null,
  };
}

// Replace with the real Shipments request, e.g. `await fetch("/api/shipments?status=for-planning")`
async function fetchIncoming(now: number, count: number): Promise<Shipment[]> {
  await new Promise((r) => setTimeout(r, 500));
  return Array.from({ length: count }, () => makeRequest(now));
}

/* ---------- Route planning engine ---------- */

const optionCache = new Map<string, RouteOption[]>();

function evalRoute(nodes: string[], lanes: Lane[], vehicle: string): RouteOption {
  const mid = Math.max(0, nodes.length - 2);
  const km = lanes.reduce((n, l) => n + laneKm(l), 0);
  const transitMin = lanes.reduce((n, l) => n + laneMin(l), 0) + mid * HANDLING_MIN;
  const tolls = lanes.reduce((n, l) => n + l.toll, 0);
  const tariff = RATES[vehicle];
  return {
    key: nodes.join(">"),
    nodes,
    laneIds: lanes.map((l) => l.id),
    km,
    transitMin,
    cost: Math.round(tariff.base + tariff.perKm * km + tolls + mid * HANDLING_FEE),
    tags: [],
  };
}

// Up to three distinct options: fastest, lowest cost, shortest distance
function buildOptions(origin: string, destination: string, vehicle: string): RouteOption[] {
  const cacheKey = `${origin}>${destination}>${vehicle}`;
  const hit = optionCache.get(cacheKey);
  if (hit) return hit;

  const all: RouteOption[] = [];
  const dfs = (node: string, visited: string[], lanes: Lane[]) => {
    if (node === destination) {
      all.push(evalRoute(visited, lanes, vehicle));
      return;
    }
    if (lanes.length >= 5) return;
    for (const l of LANES) {
      const other = l.a === node ? l.b : l.b === node ? l.a : null;
      if (!other || visited.includes(other)) continue;
      dfs(other, [...visited, other], [...lanes, l]);
    }
  };
  dfs(origin, [origin], []);

  const by = (f: (o: RouteOption) => number) => [...all].sort((a, b) => f(a) - f(b));
  const fastest = by((o) => o.transitMin)[0];
  const cheapest = by((o) => o.cost)[0];
  const shortest = by((o) => o.km)[0];

  const picked: RouteOption[] = [];
  const add = (o: RouteOption | undefined, tag?: string) => {
    if (!o) return;
    let ex = picked.find((p) => p.key === o.key);
    if (!ex) {
      ex = { ...o, tags: [] };
      picked.push(ex);
    }
    if (tag && !ex.tags.includes(tag)) ex.tags.push(tag);
  };
  add(fastest, "Fastest");
  add(cheapest, "Lowest cost");
  add(shortest, "Shortest");
  for (const o of by((x) => x.transitMin)) {
    if (picked.length >= 3) break;
    add(o);
  }
  picked.sort((a, b) => a.transitMin - b.transitMin);

  optionCache.set(cacheKey, picked);
  return picked;
}

function evalProviders(opt: RouteOption, vehicle: string) {
  return PROVIDERS.map((p) => {
    let reason: string | null = null;
    if (p.status !== "Active") reason = p.status;
    else if (!p.vehicles.includes(vehicle)) reason = `No ${vehicle}`;
    else {
      const miss = opt.nodes.find((n) => !p.hubs.includes(n));
      if (miss) reason = `Does not cover ${LOCS[miss].name}`;
    }
    return { provider: p, eligible: !reason, reason, price: Math.round(opt.cost * p.rate) };
  });
}

function makePlan(s: Shipment, opt: RouteOption, providerId: string, price: number, departAt: number): Plan {
  return {
    route: opt.nodes,
    km: opt.km,
    transitMin: opt.transitMin,
    cost: price,
    providerId,
    departAt,
    plannedMs: opt.transitMin * MIN,
    speed: 1,
    tag: opt.tags[0] ?? "Alternative",
    sops: sopsFor(s, opt.nodes),
  };
}

/* ---------- Geometry and time helpers ---------- */

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

const geoCache = new Map<string, Geo>();
const geoOf = (route: string[]): Geo => {
  const key = route.join(">");
  const hit = geoCache.get(key);
  if (hit) return hit;
  // One point per hub; distances in km so progress is shared out by real lane length.
  const pts = route.map((id) => ({ x: LOCS[id].lng, y: LOCS[id].lat }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineKm(pts[i - 1].y, pts[i - 1].x, pts[i].y, pts[i].x));
  const g = { pts, cum, total: cum[cum.length - 1] };
  geoCache.set(key, g);
  return g;
};

const isPlanned = (s: Shipment): s is Planned => s.plan !== null;
const actualMs = (s: Planned) => s.plan.plannedMs / s.plan.speed;
const progressOf = (s: Planned, now: number) => clamp((now - s.plan.departAt) / actualMs(s), 0, 1);
const phaseOf = (s: Shipment, now: number): Phase => {
  if (!isPlanned(s)) return "unplanned";
  if (now < s.plan.departAt) return "upcoming";
  return progressOf(s, now) >= 1 ? "delivered" : "ongoing";
};
const dropPlanned = (s: Planned) => s.plan.departAt + s.plan.plannedMs;
const dropLive = (s: Planned) => s.plan.departAt + actualMs(s);
const delayMin = (s: Planned) => Math.round((actualMs(s) - s.plan.plannedMs) / MIN);
const routeLabel = (s: Shipment) => `${LOCS[s.origin].name} → ${LOCS[s.destination].name}`;
const pathLabel = (nodes: string[]) => nodes.map((n) => LOCS[n].name).join(" → ");

const fmtDateTime = (ms: number) => new Date(ms).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
const fmtDur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};
const fmtMin = (min: number) => fmtDur(min * MIN);

/* ---------- Link to Schedules (Schedules & Transit Timetable module) ----------
 * REAL DATA: Upcoming and On-going deliveries are read from public.schedules (GET /spnc/app/api/schedules),
 * so this page and the Schedules calendar always show the same deliveries.
 * When you confirm a plan, it is saved once to public.schedules (POST) and then shows up here from the database.
 * Nothing is saved automatically: only deliveries you plan yourself. While the delivery runs, the
 * schedule's status follows it: Scheduled → Delayed (5+ min late) → Completed (delivered).
 * route_id and service_provider_id are filled when a matching route / provider exists in the database.
 */
type DbRoute = { id: string; route_code?: string | null; route_name?: string | null; origin?: string | null; destination?: string | null };
type DbProvider = { id: string; name: string };
type DbSchedule = { id: string; schedule_code?: string | null };
type SchedLink = {
  state: "saving" | "saved" | "error";
  id?: string;
  code: string;
  error?: string;
  failedAt?: number;
  payload?: Record<string, unknown>;
  syncedStatus?: string;
};

const SCHEDULES_API = "/spnc/app/api/schedules";

// Tells an open Schedules page to reload right away (same channel name as the Schedules page)
const SCHEDULES_CHANNEL = "spnc-schedules";
function announceScheduleChange() {
  try {
    const ch = new BroadcastChannel(SCHEDULES_CHANNEL);
    ch.postMessage({ type: "schedules-changed", at: Date.now() });
    ch.close();
  } catch {
    // BroadcastChannel not available: the Schedules page still refreshes on its own timer
  }
}
const norm = (v?: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const looseMatch = (a?: string | null, b?: string | null) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

// Same delivery → same code every time, so it is never saved twice.
const scheduleCodeFor = (s: Planned) => `SCH-${s.ref}-${Math.floor(s.plan.departAt / 60_000).toString(36).toUpperCase()}`;

// What the schedule's status should be for where the delivery is now
const scheduleStatusFor = (s: Planned, now: number) => {
  const phase = phaseOf(s, now);
  if (phase === "delivered") return "completed";
  if (phase === "ongoing" && delayMin(s) >= 5) return "delayed";
  return "scheduled";
};

function findDbRoute(routes: DbRoute[], origin: string, destination: string) {
  const o = LOCS[origin].name;
  const d = LOCS[destination].name;
  return (
    routes.find((r) => looseMatch(r.origin, o) && looseMatch(r.destination, d)) ??
    routes.find((r) => looseMatch(r.route_name, `${o} ${d}`)) ??
    null
  );
}

function schedulePayload(s: Planned, routes: DbRoute[], providers: DbProvider[], status: string) {
  const provider = PROVIDER_BY_ID[s.plan.providerId];
  const dbRoute = findDbRoute(routes, s.origin, s.destination);
  const dbProvider = providers.find((p) => looseMatch(p.name, provider.name)) ?? null;
  const depart = new Date(s.plan.departAt);
  return {
    schedule_code: scheduleCodeFor(s),
    route_id: dbRoute?.id ?? null,
    service_provider_id: dbProvider?.id ?? null,
    departure_datetime: depart.toISOString(),
    arrival_datetime: new Date(dropPlanned(s)).toISOString(),
    frequency: "on_demand",
    day_of_week: depart.toLocaleDateString("en-US", { weekday: "short" }),
    capacity: s.vehicle === "Container Trailer" ? 1 : null,
    unit_type: s.vehicle === "Container Trailer" ? "container" : null,
    cutoff_hours: 24,
    status,
    // Extra schedule columns that already exist in public.schedules
    vehicle: s.vehicle,
    cargo_details: s.cargo,
    tracking: s.ref,
    notes: [
      `From Route Planning: ${s.ref} (${s.bound})`,
      `Route: ${pathLabel(s.plan.route)} · ${s.plan.km} km`,
      `Provider: ${provider.name}${dbProvider ? "" : " (not in Service Providers yet)"}`,
      `Vehicle: ${s.vehicle} · Cargo: ${s.cargo}`,
      `Est. cost: ${peso(s.plan.cost)} · SOPs: ${s.plan.sops.join(", ")}`,
      dbRoute ? "" : "No matching route in Network & Routes yet; pick one with Edit → Route.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* ---------- Schedules → deliveries on this page ---------- */
type DbScheduleRow = {
  id: string;
  schedule_code?: string | null;
  departure_datetime?: string | null;
  arrival_datetime?: string | null;
  status?: string | null;
  notes?: string | null;
  vehicle?: string | null;
  cargo_details?: string | null;
  tracking?: string | null;
  route_id?: string | null;
  service_provider_id?: string | null;
  frequency?: string | null;
  day_of_week?: string | null;
  capacity?: number | null;
  unit_type?: string | null;
  cutoff_hours?: number | null;
  routes?: { origin?: string | null; destination?: string | null } | null;
  service_providers?: { name?: string | null } | null;
};

const hubByName = (name?: string | null) => (name ? Object.keys(LOCS).find((k) => looseMatch(LOCS[k].name, name)) : undefined);

// "Label: value" pairs from the notes Route Planning writes (one per line, or joined with " · ")
function noteFields(notes?: string | null) {
  const out: Record<string, string> = {};
  (notes ?? "")
    .split(/\n/)
    .flatMap((line) => line.split(/\s+·\s+/))
    .forEach((part) => {
      const m = part.match(/^([A-Za-z. ]+):\s*(.+)$/);
      if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
    });
  return out;
}

function providerIdFor(name?: string | null) {
  const clean = (name ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  if (!clean) return null;
  const found = PROVIDERS.find((p) => looseMatch(p.name, clean));
  if (found) return found.id;
  // Provider from the database that this page doesn't know yet: add it so it can be shown
  const id = `db-${norm(clean).replace(/\s+/g, "-")}`;
  if (!PROVIDER_BY_ID[id]) PROVIDER_BY_ID[id] = { id, name: clean, status: "Active", vehicles: [], hubs: [], rate: 1 };
  return id;
}

/** One schedule row → one delivery on this page (null when it can't be placed on the network map). */
function scheduleToShipment(row: DbScheduleRow, numericId: number): Planned | null {
  const dep = row.departure_datetime ? new Date(row.departure_datetime).getTime() : NaN;
  const arr = row.arrival_datetime ? new Date(row.arrival_datetime).getTime() : NaN;
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return null;
  if ((row.status ?? "").toLowerCase() === "cancelled") return null;

  const f = noteFields(row.notes);
  const vehicle = row.vehicle && RATES[row.vehicle] ? row.vehicle : f["vehicle"] && RATES[f["vehicle"]] ? f["vehicle"] : "Closed Van";

  // Path: from the notes ("Route: A → B → C"), else the linked route's origin and destination
  let nodes = (f["route"] ?? "")
    .split("→")
    .map((n) => hubByName(n.trim()))
    .filter((k): k is string => !!k);
  const lanesOk = nodes.length >= 2 && nodes.every((n, i) => i === 0 || !!laneBetween(nodes[i - 1], n));
  if (!lanesOk) {
    const o = hubByName(row.routes?.origin) ?? nodes[0];
    const d = hubByName(row.routes?.destination) ?? nodes[nodes.length - 1];
    nodes = o && d && o !== d ? buildOptions(o, d, vehicle)[0]?.nodes ?? [] : [];
  }
  if (nodes.length < 2) return null;

  const lanes = nodes.slice(1).map((n, i) => laneBetween(nodes[i], n)!);
  const opt = evalRoute(nodes, lanes, vehicle);
  const fromPlanning = f["from route planning"]; // "SHP-1015 (Outbound)"
  const ref = fromPlanning?.split(/\s+/)[0] || row.schedule_code || "Schedule";
  const bound: Bound = /inbound/i.test(fromPlanning ?? "") ? "Inbound" : "Outbound";
  const cost = Number((f["est. cost"] ?? "").replace(/[^\d.]/g, ""));
  const providerId = providerIdFor(f["provider"] ?? row.service_providers?.name) ?? "jt";

  return {
    id: numericId,
    ref,
    cargo: row.cargo_details || f["cargo"] || "General cargo",
    bound,
    vehicle,
    origin: nodes[0],
    destination: nodes[nodes.length - 1],
    readyAt: dep,
    plan: {
      route: nodes,
      km: opt.km,
      transitMin: Math.round((arr - dep) / MIN),
      cost: Number.isFinite(cost) && cost > 0 ? cost : opt.cost,
      providerId,
      departAt: dep,
      plannedMs: arr - dep,
      speed: 1,
      tag: "From Schedules",
      sops: f["sops"] ? f["sops"].split(/\s*,\s*/).filter(Boolean) : sopsFor({ vehicle }, nodes),
    },
  };
}

// The full schedule as stored, so a status update (PUT) keeps every other field unchanged
function rowPayload(row: DbScheduleRow): Record<string, unknown> {
  return {
    schedule_code: row.schedule_code,
    route_id: row.route_id ?? null,
    service_provider_id: row.service_provider_id ?? null,
    departure_datetime: row.departure_datetime,
    arrival_datetime: row.arrival_datetime,
    frequency: row.frequency ?? "on_demand",
    day_of_week: row.day_of_week ?? null,
    capacity: row.capacity ?? null,
    unit_type: row.unit_type ?? null,
    cutoff_hours: row.cutoff_hours ?? 24,
    status: row.status ?? "scheduled",
    notes: row.notes ?? null,
    vehicle: row.vehicle ?? null,
    cargo_details: row.cargo_details ?? null,
    tracking: row.tracking ?? null,
  };
}

/* ---------- Colors ---------- */

const palette = (isDark: boolean) =>
  isDark
    ? { dark: true, card: "#0E1624", node: "#121B26", dot: "#1E2D40", line: "#4B5A68", border: "#2C4356", text: "#F2F1EC", muted: "#8FA0AF", row: "#121B26" }
    : { dark: false, card: "#F6F8FB", node: "#FFFFFF", dot: "#D5DCE6", line: "#9CA3AF", border: "#D1D5DB", text: "#111827", muted: "#6B7280", row: "#FFFFFF" };
type Palette = ReturnType<typeof palette>;

const PINK = "#F2419B";
const BLUE = "#3B82F6";
const GREEN = "#1FA968";
const RED = "#E2685A";
const AMBER = "#E5A93C";

/* ---------- Small pieces ---------- */

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `${color}22`, color }}>
      {children}
    </span>
  );
}

function BoundBadge({ bound }: { bound: Bound }) {
  const inbound = bound === "Inbound";
  const Icon = inbound ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <Badge color={inbound ? BLUE : AMBER}>
      <Icon size={12} /> {bound}
    </Badge>
  );
}

function SourceNote({ c, children }: { c: Palette; children: React.ReactNode }) {
  return (
    <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium" style={{ borderColor: c.border, color: c.muted }}>
      {children}
    </span>
  );
}

type Preview = { nodes: string[]; active: boolean }[];

/* ---------- Map (Leaflet + OpenStreetMap) ----------
 * The network is drawn on a real map. Leaflet is loaded from a CDN the first time a map appears,
 * so no npm package is needed. Lanes follow the actual roads (from the public OSRM routing service);
 * if that service can't be reached, a lane is drawn as a straight line between its two hubs.
 * Road shapes are cached in the browser so they are only requested once.
 */
type LatLng = [number, number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletNS = any;

const LEAFLET_VERSION = "1.9.4";
let leafletPromise: Promise<LeafletNS> | null = null;
function loadLeaflet(): Promise<LeafletNS> {
  const w = window as unknown as { L?: LeafletNS };
  if (w.L) return Promise.resolve(w.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-leaflet]")) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
        css.setAttribute("data-leaflet", "");
        document.head.appendChild(css);
      }
      const js = document.createElement("script");
      js.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      js.async = true;
      js.onload = () => (w.L ? resolve(w.L) : reject(new Error("Leaflet did not load")));
      js.onerror = () => {
        leafletPromise = null;
        reject(new Error("Couldn't load the map library"));
      };
      document.head.appendChild(js);
    });
  }
  return leafletPromise;
}

// Road shape of each lane, from hub a to hub b
const ROADS_KEY = "spnc_lane_roads_v1";
const laneRoads = new Map<string, LatLng[]>();
let roadsPromise: Promise<void> | null = null;

function straightLane(l: Lane): LatLng[] {
  return [
    [LOCS[l.a].lat, LOCS[l.a].lng],
    [LOCS[l.b].lat, LOCS[l.b].lng],
  ];
}

function loadRoads(): Promise<void> {
  if (roadsPromise) return roadsPromise;
  roadsPromise = (async () => {
    let cached: Record<string, LatLng[]> = {};
    try {
      cached = JSON.parse(window.localStorage.getItem(ROADS_KEY) || "{}");
    } catch {
      cached = {};
    }
    await Promise.all(
      LANES.map(async (l) => {
        const key = `${l.id}:${l.a}-${l.b}`;
        if (Array.isArray(cached[key]) && cached[key].length > 1) {
          laneRoads.set(l.id, cached[key]);
          return;
        }
        try {
          const a = LOCS[l.a];
          const b = LOCS[l.b];
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`
          );
          if (!res.ok) throw new Error(`OSRM ${res.status}`);
          const data = await res.json();
          const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
          if (!coords || coords.length < 2) throw new Error("No road found");
          // Keep at most ~300 points per lane so the map stays fast
          const step = Math.max(1, Math.floor(coords.length / 300));
          const line: LatLng[] = coords.filter((_, i) => i % step === 0 || i === coords.length - 1).map(([lng, lat]) => [lat, lng]);
          laneRoads.set(l.id, line);
          cached[key] = line;
        } catch {
          // Routing service unavailable: keep the straight line for this lane
        }
      })
    );
    try {
      window.localStorage.setItem(ROADS_KEY, JSON.stringify(cached));
    } catch {
      // ignore unavailable storage
    }
  })();
  return roadsPromise;
}

// Road shape between two neighbouring hubs, in travel direction
function legLine(from: string, to: string): LatLng[] {
  const l = laneBetween(from, to);
  if (!l) return [[LOCS[from].lat, LOCS[from].lng], [LOCS[to].lat, LOCS[to].lng]];
  const line = laneRoads.get(l.id) ?? straightLane(l);
  return l.a === from ? line : [...line].reverse();
}

// Position along a polyline at fraction t (0..1), using screen-like distances
function alongLine(line: LatLng[], t: number): { at: LatLng; upto: LatLng[] } {
  if (line.length < 2) return { at: line[0], upto: [...line] };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = haversineKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    seg.push(d);
    total += d;
  }
  let want = clamp(t, 0, 1) * total;
  const upto: LatLng[] = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const d = seg[i - 1];
    if (want <= d || i === line.length - 1) {
      const f = d ? Math.min(1, want / d) : 0;
      const at: LatLng = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
      upto.push(at);
      return { at, upto };
    }
    want -= d;
    upto.push(line[i]);
  }
  return { at: line[line.length - 1], upto };
}

// Whole route on the roads, plus where a vehicle is at overall progress f.
// Progress is split between legs by their length, the same way the timetable and the stop list do it.
function routeOnRoads(route: string[], f: number) {
  const g = geoOf(route);
  const full: LatLng[] = [];
  const done: LatLng[] = [];
  let at: LatLng = [LOCS[route[0]].lat, LOCS[route[0]].lng];
  const d = clamp(f, 0, 1) * g.total;
  for (let i = 1; i < route.length; i++) {
    const line = legLine(route[i - 1], route[i]);
    full.push(...(full.length ? line.slice(1) : line));
    const legStart = g.cum[i - 1];
    const legLen = g.cum[i] - legStart;
    if (d >= g.cum[i]) {
      done.push(...(done.length ? line.slice(1) : line));
      at = line[line.length - 1];
    } else if (d > legStart) {
      const part = alongLine(line, legLen ? (d - legStart) / legLen : 0);
      done.push(...(done.length ? part.upto.slice(1) : part.upto));
      at = part.at;
    }
  }
  return { full, done: done.length ? done : [at], at };
}

const TILE_LAYERS = {
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
};

const NETWORK_BOUNDS: LatLng[] = Object.values(LOCS).map((l) => [l.lat, l.lng]);

function RouteMap({
  c,
  now,
  ships = [],
  focus,
  preview,
  height = 460,
}: {
  c: Palette;
  now: number;
  ships?: Shipment[];
  focus?: Planned;
  preview?: Preview;
  height?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS>(null);
  const LRef = useRef<LeafletNS>(null);
  const tilesRef = useRef<LeafletNS>(null);
  const layers = useRef(new Map<string, LeafletNS>());
  const fittedKey = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, setRoadsVersion] = useState(0);
  const [follow, setFollow] = useState(false);

  const drawn: Planned[] = focus ? [focus] : ships.filter(isPlanned);
  const activeRoute = focus ? focus.plan.route : preview?.find((p) => p.active)?.nodes;
  const activeNodes = new Set<string>(activeRoute ?? drawn.flatMap((s) => s.plan.route));
  const origin = activeRoute?.[0];
  const drop = activeRoute?.[activeRoute.length - 1];

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(boxRef.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
        map.fitBounds(NETWORK_BOUNDS, { padding: [30, 30] });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    loadRoads().then(() => !cancelled && setRoadsVersion((v) => v + 1));
    const store = layers.current;
    return () => {
      cancelled = true;
      store.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  // Light / dark base map
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const t = c.dark ? TILE_LAYERS.dark : TILE_LAYERS.light;
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(t.url, { attribution: t.attribution, subdomains: t.subdomains, maxZoom: 18 }).addTo(map);
    tilesRef.current.bringToBack();
  }, [ready, c.dark]);

  // Draw / update everything (runs on every render; layers are reused, only positions and styles change)
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const seen = new Set<string>();

    const line = (key: string, pts: LatLng[], style: Record<string, unknown>) => {
      seen.add(key);
      const old = layers.current.get(key);
      if (old) {
        old.setLatLngs(pts);
        old.setStyle(style);
        return old;
      }
      const layer = L.polyline(pts, { interactive: false, lineJoin: "round", lineCap: "round", ...style }).addTo(map);
      layers.current.set(key, layer);
      return layer;
    };
    const dot = (key: string, at: LatLng, style: Record<string, unknown>, label?: { text: string; cls: string; dir?: string; offset?: [number, number] }) => {
      seen.add(key);
      let layer = layers.current.get(key);
      if (layer) {
        layer.setLatLng(at);
        layer.setStyle(style);
        if (style.radius !== undefined) layer.setRadius(style.radius);
      } else {
        layer = L.circleMarker(at, { ...style }).addTo(map);
        layers.current.set(key, layer);
      }
      if (label) {
        const tip = layer.getTooltip();
        if (!tip) {
          layer.bindTooltip(label.text, { permanent: true, direction: label.dir ?? "bottom", offset: label.offset ?? [0, 6], className: label.cls });
        } else {
          if (tip.getContent() !== label.text) layer.setTooltipContent(label.text);
          const el = tip.getElement?.();
          if (el) el.className = el.className.replace(/spnc-map-(hub|hub-active|veh|arrived)/g, "").trim() + ` ${label.cls}`;
        }
      } else if (layer.getTooltip()) {
        layer.unbindTooltip();
      }
      return layer;
    };

    // lanes of the network (on the roads)
    LANES.forEach((l) => line(`lane-${l.id}`, laneRoads.get(l.id) ?? straightLane(l), { color: c.dark ? "#5B6B7B" : "#94A3B8", weight: 3, opacity: 0.55 }));

    // route options being compared
    if (preview) {
      [...preview]
        .sort((a, b) => Number(a.active) - Number(b.active))
        .forEach((p) => {
          const r = routeOnRoads(p.nodes, 0);
          const ln = line(`opt-${p.nodes.join(">")}`, r.full, {
            color: p.active ? PINK : AMBER,
            weight: p.active ? 6 : 3.5,
            opacity: p.active ? 0.95 : 0.7,
            dashArray: p.active ? undefined : "8 8",
          });
          if (p.active) ln.bringToFront();
        });
    }

    // deliveries
    drawn.forEach((s) => {
      const phase = phaseOf(s, now);
      const r = routeOnRoads(s.plan.route, progressOf(s, now));
      const col = phase === "delivered" ? GREEN : delayMin(s) >= 5 ? RED : BLUE;
      if (phase === "upcoming") {
        line(`plan-${s.id}`, r.full, { color: focus ? PINK : c.dark ? "#9AA8B6" : "#64748B", weight: focus ? 5 : 3, dashArray: "8 8", opacity: focus ? 1 : 0.85 });
      } else {
        line(`plan-${s.id}`, r.full, { color: c.dark ? "#9AA8B6" : "#64748B", weight: 3, dashArray: "8 8", opacity: 0.6 });
        line(`done-${s.id}`, r.done, { color: col, weight: focus ? 6 : 4.5, opacity: 1 }).bringToFront();
      }
    });

    // hubs
    Object.entries(LOCS).forEach(([id, l]) => {
      const used = activeNodes.has(id);
      const isOrigin = origin === id;
      const isDrop = drop === id;
      const dim = !!(focus || preview) && !used;
      const fill = isOrigin ? GREEN : isDrop ? PINK : c.node;
      dot(
        `hub-${id}`,
        [l.lat, l.lng],
        {
          radius: used && (focus || preview) ? 8 : 6.5,
          color: isOrigin || isDrop ? fill : used ? c.text : c.line,
          weight: 2.5,
          fillColor: fill,
          fillOpacity: dim ? 0.45 : 1,
          opacity: dim ? 0.45 : 1,
        },
        { text: l.name + (l.port ? " ⚓" : ""), cls: used && (focus || preview) ? "spnc-map-hub-active" : "spnc-map-hub" }
      );
    });

    // vehicles
    let followAt: LatLng | null = null;
    drawn.forEach((s) => {
      const phase = phaseOf(s, now);
      if (phase === "upcoming") return;
      const r = routeOnRoads(s.plan.route, progressOf(s, now));
      const col = phase === "delivered" ? GREEN : delayMin(s) >= 5 ? RED : BLUE;
      if (focus) followAt = r.at;
      dot(`veh-halo-${s.id}`, r.at, { radius: focus ? 17 : 13, stroke: false, fillColor: col, fillOpacity: 0.22, interactive: false });
      const label = focus
        ? phase === "delivered"
          ? { text: "Arrived at destination", cls: "spnc-map-arrived", dir: "top", offset: [0, -12] as [number, number] }
          : { text: s.ref, cls: "spnc-map-veh", dir: "top", offset: [0, -12] as [number, number] }
        : undefined;
      const v = dot(`veh-${s.id}`, r.at, { radius: focus ? 8 : 6, color: "#FFFFFF", weight: 2.5, fillColor: col, fillOpacity: 1 }, label);
      if (!focus && !v.getTooltip()) v.bindTooltip(`${s.ref} · ${PROVIDER_BY_ID[s.plan.providerId].name}`, { direction: "top", offset: [0, -8] });
      v.bringToFront();
    });

    // remove layers that are no longer needed
    layers.current.forEach((layer, key) => {
      if (!seen.has(key)) {
        layer.remove();
        layers.current.delete(key);
      }
    });

    // zoom to the route that matters (once per focus / selected option)
    const fitKey = focus ? `f-${focus.id}` : activeRoute ? `p-${activeRoute.join(">")}` : "network";
    if (fittedKey.current !== fitKey) {
      fittedKey.current = fitKey;
      const pts = activeRoute ? routeOnRoads(activeRoute, 0).full : NETWORK_BOUNDS;
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
    }
    if (follow && followAt) map.panTo(followAt, { animate: false });
  });

  const fitNetwork = () => {
    setFollow(false);
    mapRef.current?.fitBounds(NETWORK_BOUNDS, { padding: [30, 30] });
  };
  const fitRoute = () => {
    setFollow(false);
    if (activeRoute) mapRef.current?.fitBounds(routeOnRoads(activeRoute, 0).full, { padding: [40, 40], maxZoom: 12 });
  };
  const ctrl = "flex h-10 w-10 items-center justify-center rounded-lg border shadow-md transition hover:opacity-90";
  const ctrlStyle = { background: c.node, borderColor: c.border, color: c.text };

  return (
    <div className="relative isolate w-full overflow-hidden" style={{ height }}>
      <style>{`
        .spnc-map-hub, .spnc-map-hub-active, .spnc-map-veh {
          background: transparent; border: 0; box-shadow: none; padding: 0;
          font: 600 11.5px/1.2 var(--font-sans, system-ui, sans-serif);
          color: ${c.text}; text-shadow: 0 0 3px ${c.card}, 0 0 3px ${c.card}, 0 0 3px ${c.card};
        }
        .spnc-map-hub { font-weight: 500; color: ${c.dark ? "#C7D1DA" : "#374151"}; }
        .spnc-map-veh { font-weight: 700; color: ${BLUE}; }
        .spnc-map-hub::before, .spnc-map-hub-active::before, .spnc-map-veh::before { display: none; }
        .spnc-map-arrived {
          background: #fff; color: ${RED}; border: 0; border-radius: 8px; padding: 6px 12px;
          font: 600 13px/1.2 var(--font-sans, system-ui, sans-serif); box-shadow: 0 4px 14px rgba(0,0,0,.18);
        }
        .leaflet-container { background: ${c.card}; font-family: inherit; }
      `}</style>

      <div ref={boxRef} className="h-full w-full" role="img" aria-label="Service network and route map" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ background: c.card, color: c.muted }}>
          {failed ? "Couldn't load the map. Check your internet connection." : "Loading map…"}
        </div>
      )}

      {ready && (
        <div className="absolute bottom-6 right-3 z-[1000] flex gap-2">
          {activeRoute && (
            <button type="button" onClick={fitRoute} className={ctrl} style={ctrlStyle} title="Zoom to route" aria-label="Zoom to route">
              <RouteIcon size={18} color={BLUE} />
            </button>
          )}
          <button type="button" onClick={fitNetwork} className={ctrl} style={ctrlStyle} title="Show whole network" aria-label="Show whole network">
            <MapPin size={18} color={RED} />
          </button>
          {focus && phaseOf(focus, now) !== "upcoming" && (
            <button
              type="button"
              onClick={() => setFollow((f) => !f)}
              className={ctrl}
              style={{ ...ctrlStyle, ...(follow ? { background: BLUE, color: "#fff", borderColor: BLUE } : {}) }}
              title={follow ? "Stop following the vehicle" : "Follow the vehicle"}
              aria-label="Follow the vehicle"
              aria-pressed={follow}
            >
              <LocateFixed size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

export default function RoutesPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";
  const c = palette(isDark);

  const t0Real = useRef(0);
  const t0Sim = useRef(0);
  const seeded = useRef(false);
  const simNow = useCallback(() => t0Sim.current + (Date.now() - t0Real.current) * SIM_RATE, []);

  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [ships, setShips] = useState<Shipment[]>([]);
  const shipsRef = useRef<Shipment[]>([]);
  shipsRef.current = ships;

  const [view, setView] = useState<"network" | "planning" | "deliveries">("deliveries");
  const [delTab, setDelTab] = useState<"upcoming" | "ongoing" | "delivered">("upcoming");
  const [delPage, setDelPage] = useState(1); // page of the open deliveries tab
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [deliveredTotal, setDeliveredTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Link to Schedules: one entry per delivery id
  const [schedLinks, setSchedLinks] = useState<Record<number, SchedLink>>({});
  const schedLinksRef = useRef(schedLinks);
  schedLinksRef.current = schedLinks;
  const dbRef = useRef<{ routes: DbRoute[]; providers: DbProvider[]; loaded: boolean }>({ routes: [], providers: [], loaded: false });

  // Routes and providers from the database, used to fill route_id / service_provider_id
  const loadDbRefs = useCallback(async () => {
    if (dbRef.current.loaded) return dbRef.current;
    const read = async <T,>(url: string, key: string): Promise<T[]> => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.[key]) ? data[key] : [];
      } catch {
        return [];
      }
    };
    const [routes, providers] = await Promise.all([
      read<DbRoute>("/spnc/app/api/routes", "routes"),
      read<DbProvider>("/spnc/app/api/service-providers", "providers"),
    ]);
    dbRef.current = { routes, providers, loaded: true };
    return dbRef.current;
  }, []);

  const findScheduleId = async (code: string): Promise<string | undefined> => {
    try {
      const res = await fetch(SCHEDULES_API, { cache: "no-store" });
      const data = await res.json();
      const list: DbSchedule[] = Array.isArray(data?.schedules) ? data.schedules : [];
      return list.find((x) => (x.schedule_code ?? "").toLowerCase() === code.toLowerCase())?.id;
    } catch {
      return undefined;
    }
  };

  // ---- Real deliveries from public.schedules ----
  const [dbShips, setDbShips] = useState<Planned[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const dbIds = useRef(new Map<string, number>()); // schedule id → number used by this page
  const nextDbId = useRef(1_000_000);

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await fetch(SCHEDULES_API, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const rows: DbScheduleRow[] = Array.isArray(data?.schedules) ? data.schedules : [];
      const t = Date.now();
      const list: Planned[] = [];
      const links: Record<number, SchedLink> = {};
      rows.forEach((row) => {
        let num = dbIds.current.get(row.id);
        if (num === undefined) {
          num = nextDbId.current++;
          dbIds.current.set(row.id, num);
        }
        const ship = scheduleToShipment(row, num);
        if (!ship) return;
        // finished deliveries stay visible for a short while after their drop time
        if (t > ship.plan.departAt + ship.plan.plannedMs + KEEP_DELIVERED_MS) return;
        list.push(ship);
        links[num] = {
          state: "saved",
          id: row.id,
          code: row.schedule_code || "",
          payload: rowPayload(row),
          syncedStatus: row.status ?? "scheduled",
        };
      });
      const codes = new Set(rows.map((r) => (r.schedule_code ?? "").toLowerCase()));
      setSchedLinks((prev) => ({ ...prev, ...links }));
      setDbShips(list);
      // a plan confirmed on this page is now in the database: show the database copy only
      setShips((prev) => prev.filter((x) => !x.plan || !codes.has(scheduleCodeFor(x as Planned).toLowerCase())));
    } catch {
      // keep what is shown; the next refresh will try again
    } finally {
      setDbLoaded(true);
    }
  }, []);

  // Load now, every 15 s, and right away when a schedule changes in another tab
  useEffect(() => {
    void loadDeliveries();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void loadDeliveries(), 15_000);
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(SCHEDULES_CHANNEL);
      ch.onmessage = () => void loadDeliveries();
    } catch {
      // timer only
    }
    return () => {
      window.clearInterval(timer);
      ch?.close();
    };
  }, [loadDeliveries]);

  // Save one planned delivery as a schedule
  const saveToSchedules = useCallback(
    async (s: Planned) => {
      const current = schedLinksRef.current[s.id];
      if (current?.state === "saving" || current?.state === "saved") return;
      const code = scheduleCodeFor(s);
      // mark right away (ref too) so the auto-save effect never starts the same delivery twice
      schedLinksRef.current = { ...schedLinksRef.current, [s.id]: { state: "saving", code } };
      setSchedLinks((prev) => ({ ...prev, [s.id]: { state: "saving", code } }));
      try {
        // Already saved earlier (e.g. same delivery, page reloaded)? Link to it instead of adding a copy.
        const existing = await findScheduleId(code);
        const refs = await loadDbRefs();
        const status = scheduleStatusFor(s, Date.now());
        const payload = schedulePayload(s, refs.routes, refs.providers, status);
        if (existing) {
          setSchedLinks((prev) => ({ ...prev, [s.id]: { state: "saved", id: existing, code, payload, syncedStatus: status } }));
          return;
        }
        const res = await fetch(SCHEDULES_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `Couldn't save the schedule (HTTP ${res.status}).`);
        const id: string | undefined = data?.schedule?.id ?? data?.data?.id ?? data?.id ?? (await findScheduleId(code));
        setSchedLinks((prev) => ({ ...prev, [s.id]: { state: "saved", id, code, payload, syncedStatus: status } }));
        announceScheduleChange();
        void loadDeliveries();
      } catch (err) {
        setSchedLinks((prev) => ({
          ...prev,
          [s.id]: { state: "error", code, failedAt: Date.now(), error: err instanceof Error ? err.message : "Couldn't save the schedule." },
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadDbRefs, loadDeliveries]
  );

  // planning selections
  const [planId, setPlanId] = useState<number | null>(null);
  const [optKey, setOptKey] = useState<string | null>(null);
  const [provId, setProvId] = useState<string | null>(null);
  const [slotChoice, setSlotChoice] = useState<number | null>(null);

  /* Pull new requests from Shipments */
  const sync = useCallback(async () => {
    const waiting = shipsRef.current.filter((s) => !s.plan).length;
    const room = MAX_UNPLANNED - waiting;
    setSyncing(true);
    const incoming = room > 0 ? await fetchIncoming(simNow(), Math.min(room, 1 + Math.floor(Math.random() * 2))) : [];
    if (incoming.length) setShips((prev) => [...prev, ...incoming]);
    setLastSync(simNow());
    setSyncing(false);
  }, [simNow]);

  /* Start the clock and load the first batch */
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    t0Real.current = Date.now();
    t0Sim.current = Date.now();
    const start = t0Sim.current;
    // Requests waiting for planning (sample until the Shipments module is connected).
    // Deliveries are NOT made up here: they come from public.schedules.
    const first: Shipment[] = Array.from({ length: 3 }, () => makeRequest(start));
    setShips(first);
    setNow(start);
    setLastSync(start);
    setReady(true);
  }, []);

  /* Clock tick: planned deliveries move to On-going at their shipping time, finished ones are closed out */
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const n = simNow();
      setNow(n);
      const cur = shipsRef.current;
      const keep = cur.filter((s) => !isPlanned(s) || n < dropLive(s) + KEEP_DELIVERED_MS);
      if (keep.length !== cur.length) {
        setDeliveredTotal((d) => d + (cur.length - keep.length));
        setShips(keep);
      }
    }, 250);
    return () => clearInterval(id);
  }, [ready, simNow]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(sync, 14000);
    return () => clearInterval(id);
  }, [ready, sync]);

  useEffect(() => {
    if (viewerId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewerId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerId]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(id);
  }, [notice]);

  /* ---------- Derived ---------- */

  // Deliveries = real schedules from the database (+ a plan just confirmed here, until the database has it)
  const dbCodes = new Set(dbShips.map((d) => (schedLinks[d.id]?.code ?? "").toLowerCase()));
  const localPlanned = ships.filter(isPlanned).filter((x) => !dbCodes.has(scheduleCodeFor(x).toLowerCase()));
  const allShips: Shipment[] = [...dbShips, ...localPlanned, ...ships.filter((x) => !x.plan)];
  const unplanned = ships.filter((s) => !s.plan).sort((a, b) => a.readyAt - b.readyAt);
  const planned = allShips.filter(isPlanned);
  const upcoming = planned.filter((s) => phaseOf(s, now) === "upcoming").sort((a, b) => a.plan.departAt - b.plan.departAt);
  const ongoing = planned.filter((s) => phaseOf(s, now) === "ongoing").sort((a, b) => dropLive(a) - dropLive(b));
  const delivered = planned.filter((s) => phaseOf(s, now) === "delivered").sort((a, b) => dropLive(b) - dropLive(a));
  const activeCount = ongoing.length;
  const delayedCount = ongoing.filter((s) => delayMin(s) >= 5).length;
  const deliveredCount = deliveredTotal + delivered.length;
  const viewing = viewerId !== null ? planned.find((s) => s.id === viewerId) ?? null : null;

  // 10 deliveries per page in the open tab
  const tabList = delTab === "upcoming" ? upcoming : delTab === "ongoing" ? ongoing : delivered;
  const delPages = Math.max(1, Math.ceil(tabList.length / DELIVERIES_PAGE_SIZE));
  const delPageNow = Math.min(delPage, delPages);
  const pageSlice = <T,>(list: T[]) => list.slice((delPageNow - 1) * DELIVERIES_PAGE_SIZE, delPageNow * DELIVERIES_PAGE_SIZE);
  const pagedUpcoming = pageSlice(upcoming);
  const pagedOngoing = pageSlice(delTab === "delivered" ? delivered : ongoing);

  // Keep each saved schedule's status in step with its delivery (Scheduled → Delayed → Completed)
  useEffect(() => {
    planned.forEach((s) => {
      const link = schedLinksRef.current[s.id];
      if (!link || link.state !== "saved" || !link.id || !link.payload) return;
      const status = scheduleStatusFor(s, now);
      if (status === link.syncedStatus) return;
      const payload = { ...link.payload, status };
      setSchedLinks((prev) => ({ ...prev, [s.id]: { ...link, payload, syncedStatus: status } }));
      fetch(`${SCHEDULES_API}/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(() => announceScheduleChange())
        .catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // "Schedule" cell: link to the saved schedule, or a button to add it
  const scheduleCell = (s: Planned) => {
    const link = schedLinks[s.id];
    if (link?.state === "saving")
      return (
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: c.muted }}>
          <Loader2 size={13} className="animate-spin" /> Saving…
        </span>
      );
    if (link?.state === "saved")
      return (
        <div className="leading-tight">
          {link.id ? (
            <a
              href={`/spnc/app/schedules/${link.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: GREEN }}
              title="Open in Schedules"
            >
              <CircleCheck size={13} /> {link.code} <ExternalLink size={11} />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: GREEN }}>
              <CircleCheck size={13} /> {link.code}
            </span>
          )}
          <div className="text-[11px] capitalize" style={{ color: c.muted }}>
            In Schedules · {link.syncedStatus ?? "scheduled"}
          </div>
        </div>
      );
    if (link?.state === "error")
      return (
        <button
          type="button"
          onClick={() => void saveToSchedules(s)}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
          style={{ borderColor: RED, color: RED, background: c.node }}
          title={link.error}
        >
          <CalendarPlus size={13} /> Not saved · Retry
        </button>
      );
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: c.muted }}>
        <Loader2 size={13} className="animate-spin" /> Adding to Schedules…
      </span>
    );
  };

  // planning
  const planShip = unplanned.find((s) => s.id === planId) ?? unplanned[0] ?? null;
  const options = planShip ? buildOptions(planShip.origin, planShip.destination, planShip.vehicle) : [];
  const opt = options.find((o) => o.key === optKey) ?? options[0] ?? null;
  const evals = (opt && planShip ? evalProviders(opt, planShip.vehicle) : []).sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.price - b.price);
  const chosen = evals.find((e) => e.provider.id === provId && e.eligible) ?? evals.find((e) => e.eligible) ?? null;
  const slots = planShip ? slotsFrom(planShip.origin, now + LEAD, 3) : [];
  const slotAt = slotChoice !== null && slots.includes(slotChoice) ? slotChoice : slots[0];

  const confirmPlan = () => {
    if (!planShip || !opt || !chosen) return;
    const plan = makePlan(planShip, opt, chosen.provider.id, chosen.price, slotAt);
    setShips((prev) => prev.map((s) => (s.id === planShip.id ? { ...s, plan } : s)));
    void saveToSchedules({ ...planShip, plan } as Planned);
    setNotice(`${planShip.ref} is planned with ${chosen.provider.name}. It is saved to Schedules and appears under Upcoming deliveries.`);
    setPlanId(null);
    setOptKey(null);
    setProvId(null);
    setSlotChoice(null);
  };

  const th = "px-4 py-2.5 text-xs font-semibold";
  const td = "whitespace-nowrap px-4 py-2.5";

  /* ---------- Pieces ---------- */

  const seeRoutes = (s: Planned, tracking: boolean) => (
    <button
      type="button"
      onClick={() => setViewerId(s.id)}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
      style={{ borderColor: tracking ? BLUE : PINK, color: tracking ? BLUE : PINK, background: c.node }}
      title={tracking ? "Track this delivery" : "View the planned route"}
    >
      {tracking ? <Navigation size={13} /> : <RouteIcon size={13} />} See routes
    </button>
  );

  const tabButton = (on: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: number | null, color: string) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition"
      style={{ borderColor: on ? color : "transparent", color: on ? c.text : c.muted }}
    >
      {icon}
      {label}
      {count !== null && (
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${color}22`, color }}>
          {count}
        </span>
      )}
    </button>
  );

  const card = "overflow-hidden rounded-lg border";

  /* ---------- View: Network ---------- */

  const networkView = () => {
    const live = [...upcoming, ...ongoing.filter((s) => phaseOf(s, now) === "ongoing")];
    const lanesInUse = (id: string) =>
      live.filter((s) => s.plan.route.some((n, i) => i > 0 && laneBetween(s.plan.route[i - 1], n)?.id === id)).length;
    const serving = (l: Lane) => PROVIDERS.filter((p) => p.status === "Active" && p.hubs.includes(l.a) && p.hubs.includes(l.b)).length;

    return (
      <div className="space-y-5">
        <div className={card} style={{ borderColor: c.border, background: c.card }}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="text-sm font-semibold" style={{ color: c.text }}>Service network</div>
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: c.muted }}>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: c.border }} /> Lane</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: c.line }} /> Planned</span>
              <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded" style={{ background: BLUE }} /> On the way</span>
              <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded" style={{ background: RED }} /> Delayed</span>
            </div>
          </div>
          <RouteMap c={c} now={now} ships={allShips} height={480} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className={card} style={{ borderColor: c.border, background: c.row }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
              <div className="text-sm font-semibold">Lanes</div>
              <SourceNote c={c}>Timetable and Rates: sample data</SourceNote>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead style={{ color: c.muted }}>
                  <tr className="border-t" style={{ borderColor: c.border }}>
                    {["Lane", "Distance", "Transit", "Toll", "Providers", "In use"].map((h) => <th key={h} className={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody style={{ color: c.text }}>
                  {LANES.map((l) => (
                    <tr key={l.id} className="border-t" style={{ borderColor: c.border }}>
                      <td className={td}>{LOCS[l.a].name} ↔ {LOCS[l.b].name}</td>
                      <td className={`${td} tabular-nums`}>{laneKm(l)} km</td>
                      <td className={`${td} tabular-nums`}>{fmtMin(laneMin(l))}</td>
                      <td className={`${td} tabular-nums`}>{l.toll ? peso(l.toll) : "—"}</td>
                      <td className={`${td} tabular-nums`}>{serving(l)}</td>
                      <td className={`${td} tabular-nums`}>{lanesInUse(l.id) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className={card} style={{ borderColor: c.border, background: c.row }}>
              <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
                <div className="text-sm font-semibold">Service providers</div>
                <SourceNote c={c}>Service Provider Management: sample data</SourceNote>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead style={{ color: c.muted }}>
                    <tr className="border-t" style={{ borderColor: c.border }}>
                      {["Provider", "Status", "Vehicles", "Hubs", "Rate"].map((h) => <th key={h} className={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody style={{ color: c.text }}>
                    {PROVIDERS.map((p) => (
                      <tr key={p.id} className="border-t" style={{ borderColor: c.border }}>
                        <td className={`${td} font-semibold`}>{p.name}</td>
                        <td className={td}><Badge color={p.status === "Active" ? GREEN : p.status === "Suspended" ? RED : AMBER}>{p.status}</Badge></td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: c.muted }}>{p.vehicles.join(", ")}</td>
                        <td className={`${td} tabular-nums`}>{p.hubs.length}/{Object.keys(LOCS).length}</td>
                        <td className={`${td} tabular-nums`}>×{p.rate.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={card} style={{ borderColor: c.border, background: c.row }}>
              <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
                <div className="text-sm font-semibold">Departure timetable</div>
                <SourceNote c={c}>Schedules & Transit Timetable: sample data</SourceNote>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead style={{ color: c.muted }}>
                    <tr className="border-t" style={{ borderColor: c.border }}>
                      {["Hub", "Departs every", "Next departure"].map((h) => <th key={h} className={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody style={{ color: c.text }}>
                    {Object.keys(LOCS).map((id) => (
                      <tr key={id} className="border-t" style={{ borderColor: c.border }}>
                        <td className={td}>{LOCS[id].name}</td>
                        <td className={td}>{TIMETABLE[id].everyH} h</td>
                        <td className={`${td} tabular-nums`}>{fmtDateTime(slotsFrom(id, now, 1)[0])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- View: Route planning ---------- */

  const planningView = () => {
    if (!planShip || !opt) {
      return (
        <div className={`${card} px-4 py-10 text-center text-sm`} style={{ borderColor: c.border, background: c.row, color: c.muted }}>
          No shipments are waiting for a plan. New requests from Shipments appear here.
        </div>
      );
    }
    const drop = slotAt + opt.transitMin * MIN;
    const sops = sopsFor(planShip, opt.nodes);

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* queue */}
        <div className={card} style={{ borderColor: c.border, background: c.row }}>
          <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
            <div className="text-sm font-semibold">Awaiting planning</div>
            <SourceNote c={c}>Sample requests (Shipments not connected yet)</SourceNote>
          </div>
          <ul className="list-none p-0">
            {unplanned.map((s) => {
              const on = s.id === planShip.id;
              return (
                <li key={s.id} className="border-t" style={{ borderColor: c.border }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanId(s.id);
                      setOptKey(null);
                      setProvId(null);
                      setSlotChoice(null);
                    }}
                    className="w-full px-4 py-3 text-left transition hover:opacity-90"
                    style={{ background: on ? `${PINK}12` : "transparent", boxShadow: on ? `inset 3px 0 0 ${PINK}` : undefined, color: c.text }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.ref}</span>
                      <BoundBadge bound={s.bound} />
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: c.muted }}>{routeLabel(s)}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: c.muted }}>{s.cargo} · {s.vehicle} · ready {fmtClock(s.readyAt)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* plan */}
        <div className="space-y-5 lg:col-span-2">
          <div className={card} style={{ borderColor: c.border, background: c.card }}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: c.text }}>Plan {planShip.ref}</div>
                <div className="text-xs" style={{ color: c.muted }}>{routeLabel(planShip)} · {planShip.cargo} · requires {planShip.vehicle}</div>
              </div>
              <BoundBadge bound={planShip.bound} />
            </div>
            <RouteMap c={c} now={now} preview={options.map((o) => ({ nodes: o.nodes, active: o.key === opt.key }))} height={380} />
          </div>

          <div className={card} style={{ borderColor: c.border, background: c.row }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
              <div className="text-sm font-semibold">1. Choose a route</div>
              <SourceNote c={c}>Cost from Rates & Tariffs, transit from Timetable</SourceNote>
            </div>
            <div className="space-y-2 px-4 pb-4">
              {options.map((o) => {
                const on = o.key === opt.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setOptKey(o.key)}
                    className="w-full rounded-md border px-3 py-2.5 text-left transition hover:opacity-90"
                    style={{ borderColor: on ? PINK : c.border, background: on ? `${PINK}0F` : c.node, color: c.text }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.tags.map((t) => <Badge key={t} color={t === "Fastest" ? BLUE : t === "Lowest cost" ? GREEN : AMBER}>{t}</Badge>)}
                        {o.tags.length === 0 && <Badge color={c.muted}>Alternative</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums" style={{ color: c.muted }}>
                        <span>{o.km} km</span>
                        <span>{fmtMin(o.transitMin)}</span>
                        <span className="font-semibold" style={{ color: c.text }}>from {peso(o.cost)}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: c.muted }}>{pathLabel(o.nodes)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={card} style={{ borderColor: c.border, background: c.row }}>
              <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
                <div className="text-sm font-semibold">2. Choose a service provider</div>
                <SourceNote c={c}>Service Provider Management</SourceNote>
              </div>
              <div className="space-y-1.5 px-4 pb-4">
                {evals.map((e) => {
                  const on = chosen?.provider.id === e.provider.id;
                  return (
                    <button
                      key={e.provider.id}
                      type="button"
                      disabled={!e.eligible}
                      onClick={() => setProvId(e.provider.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition enabled:hover:opacity-90 disabled:cursor-not-allowed"
                      style={{ borderColor: on ? PINK : c.border, background: on ? `${PINK}0F` : c.node, color: c.text, opacity: e.eligible ? 1 : 0.55 }}
                    >
                      <div>
                        <div className="font-semibold">{e.provider.name}</div>
                        <div className="text-[11px]" style={{ color: e.eligible ? c.muted : RED }}>{e.eligible ? `Rate ×${e.provider.rate.toFixed(2)}` : e.reason}</div>
                      </div>
                      {e.eligible && <span className="text-sm font-semibold tabular-nums">{peso(e.price)}</span>}
                    </button>
                  );
                })}
                {!chosen && (
                  <div className="rounded-md px-3 py-2 text-xs" style={{ background: `${RED}14`, color: RED }}>
                    No eligible provider for this route. Pick another route option.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className={card} style={{ borderColor: c.border, background: c.row }}>
                <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
                  <div className="text-sm font-semibold">3. Departure slot</div>
                  <SourceNote c={c}>Schedules & Transit Timetable</SourceNote>
                </div>
                <div className="space-y-1.5 px-4 pb-4">
                  {slots.map((t) => {
                    const on = t === slotAt;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSlotChoice(t)}
                        className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition hover:opacity-90"
                        style={{ borderColor: on ? PINK : c.border, background: on ? `${PINK}0F` : c.node, color: c.text }}
                      >
                        <span className="font-semibold tabular-nums">{fmtDateTime(t)}</span>
                        <span className="text-[11px]" style={{ color: c.muted }}>drop {fmtDateTime(t + opt.transitMin * MIN)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={card} style={{ borderColor: c.border, background: c.row }}>
                <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ color: c.text }}>
                  <div className="text-sm font-semibold">Applicable SOPs</div>
                  <SourceNote c={c}>SOP Manager</SourceNote>
                </div>
                <ul className="list-none space-y-1.5 px-4 pb-4 p-0">
                  {sops.map((id) => (
                    <li key={id} className="flex items-start gap-2 text-xs" style={{ color: c.text }}>
                      <FileText size={14} color={c.muted} className="mt-0.5 shrink-0" />
                      <span><b>{id}</b> {SOP_DEFS[id].title}<span style={{ color: c.muted }}> · {SOP_DEFS[id].note}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3" style={{ borderColor: c.border, background: c.row, color: c.text }}>
            <div className="text-xs" style={{ color: c.muted }}>
              {chosen ? (
                <>
                  <b style={{ color: c.text }}>{chosen.provider.name}</b> · departs {fmtDateTime(slotAt)} · drops {fmtDateTime(drop)} · estimated cost{" "}
                  <b style={{ color: c.text }}>{peso(chosen.price)}</b>
                </>
              ) : (
                "Select a route with an eligible provider to continue."
              )}
            </div>
            <button
              type="button"
              onClick={confirmPlan}
              disabled={!chosen}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: PINK }}
            >
              Confirm plan
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- View: Deliveries ---------- */

  const deliveriesView = () => (
    <div className={card} style={{ borderColor: c.border, background: c.row }}>
      <div className="flex border-b px-2" style={{ borderColor: c.border }}>
        {tabButton(delTab === "upcoming", () => { setDelTab("upcoming"); setDelPage(1); }, null, "Upcoming deliveries", upcoming.length, PINK)}
        {tabButton(delTab === "ongoing", () => { setDelTab("ongoing"); setDelPage(1); }, null, "On-going deliveries", ongoing.length, BLUE)}
        {tabButton(delTab === "delivered", () => { setDelTab("delivered"); setDelPage(1); }, null, "Delivered", delivered.length, GREEN)}
      </div>

      <div className="overflow-x-auto">
        {delTab === "upcoming" ? (
          <table className="min-w-full text-left text-sm">
            <thead style={{ color: c.muted }}>
              <tr>
                {["Shipment", "Service provider", "Bound", "Vehicle type", "Schedule of delivery", "Drop time", "Departs in", "Est. cost", "Schedule", ""].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody style={{ color: c.text }}>
              {upcoming.length === 0 ? (
                <tr className="border-t" style={{ borderColor: c.border }}>
                  <td colSpan={10} className="px-4 py-8 text-center" style={{ color: c.muted }}>
                    {dbLoaded ? "No upcoming deliveries in Schedules. Plan a shipment under Route planning." : "Loading deliveries from Schedules…"}
                  </td>
                </tr>
              ) : (
                pagedUpcoming.map((s) => {
                  const soon = s.plan.departAt - now < 15 * MIN;
                  return (
                    <tr key={s.id} className="border-t" style={{ borderColor: c.border }}>
                      <td className={td}>
                        <div className="font-semibold">{s.ref}</div>
                        <div className="text-[11px]" style={{ color: c.muted }}>{routeLabel(s)}</div>
                      </td>
                      <td className={td}>{PROVIDER_BY_ID[s.plan.providerId].name}</td>
                      <td className={td}><BoundBadge bound={s.bound} /></td>
                      <td className={td}><span className="inline-flex items-center gap-1.5"><Truck size={14} color={c.muted} /> {s.vehicle}</span></td>
                      <td className={`${td} tabular-nums`}>{fmtDateTime(s.plan.departAt)}</td>
                      <td className={`${td} tabular-nums`}><span className="inline-flex items-center gap-1.5"><MapPin size={13} color={c.muted} /> {fmtDateTime(dropPlanned(s))}</span></td>
                      <td className={td}><Badge color={soon ? AMBER : c.muted}>{fmtDur(s.plan.departAt - now)}</Badge></td>
                      <td className={`${td} tabular-nums`}>{peso(s.plan.cost)}</td>
                      <td className={td}>{scheduleCell(s)}</td>
                      <td className={`${td} text-right`}>{seeRoutes(s, false)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead style={{ color: c.muted }}>
              <tr>
                {["Shipment", "Service provider", "Bound", "Vehicle type", "Progress", "Drop time (ETA)", "Status", "Schedule", ""].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody style={{ color: c.text }}>
              {(delTab === "delivered" ? delivered : ongoing).length === 0 ? (
                <tr className="border-t" style={{ borderColor: c.border }}>
                  <td colSpan={9} className="px-4 py-8 text-center" style={{ color: c.muted }}>
                    {!dbLoaded
                      ? "Loading deliveries from Schedules…"
                      : delTab === "delivered"
                      ? "Nothing delivered yet. Deliveries move here when they reach their drop-off hub."
                      : "Nothing on the road yet. Upcoming deliveries appear here at their scheduled shipping time."}
                  </td>
                </tr>
              ) : (
                pagedOngoing.map((s) => {
                  const phase = phaseOf(s, now);
                  const prog = progressOf(s, now);
                  const late = delayMin(s) >= 5;
                  const col = phase === "delivered" ? GREEN : late ? RED : BLUE;
                  return (
                    <tr key={s.id} className="border-t" style={{ borderColor: c.border }}>
                      <td className={td}>
                        <div className="font-semibold">{s.ref}</div>
                        <div className="text-[11px]" style={{ color: c.muted }}>{routeLabel(s)}</div>
                      </td>
                      <td className={td}>{PROVIDER_BY_ID[s.plan.providerId].name}</td>
                      <td className={td}><BoundBadge bound={s.bound} /></td>
                      <td className={td}><span className="inline-flex items-center gap-1.5"><Truck size={14} color={c.muted} /> {s.vehicle}</span></td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full" style={{ background: c.border }}>
                            <div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: col }} />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: c.muted }}>{Math.round(prog * 100)}%</span>
                        </div>
                      </td>
                      <td className={`${td} tabular-nums`}>
                        {fmtDateTime(dropLive(s))}
                        {late && <div className="text-[11px]" style={{ color: RED }}>planned {fmtClock(dropPlanned(s))}</div>}
                      </td>
                      <td className={td}>
                        {phase === "delivered" ? <Badge color={GREEN}><CircleCheck size={12} /> Delivered</Badge> : late ? <Badge color={RED}>Delayed {delayMin(s)} min</Badge> : <Badge color={BLUE}>On time</Badge>}
                      </td>
                      <td className={td}>{scheduleCell(s)}</td>
                      <td className={`${td} text-right`}>{seeRoutes(s, true)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {tabList.length > DELIVERIES_PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 border-t px-4 py-3" style={{ borderColor: c.border }}>
          <button
            type="button"
            onClick={() => setDelPage(Math.max(1, delPageNow - 1))}
            disabled={delPageNow === 1}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: c.border, color: c.text, background: c.node }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <span className="text-sm" style={{ color: c.muted }}>
            Page {delPageNow} of {delPages} · {tabList.length} deliveries
          </span>
          <button
            type="button"
            onClick={() => setDelPage(Math.min(delPages, delPageNow + 1))}
            disabled={delPageNow === delPages}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: c.border, color: c.text, background: c.node }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );

  /* ---------- Route viewer (See routes) ---------- */

  const viewer = () => {
    if (!viewing) return null;
    const s = viewing;
    const phase = phaseOf(s, now);
    const prog = progressOf(s, now);
    const g = geoOf(s.plan.route);
    const late = delayMin(s) >= 5;
    const tracking = phase !== "upcoming";
    const provider = PROVIDER_BY_ID[s.plan.providerId];
    const stops = s.plan.route.map((id, i) => {
      const f = g.cum[i] / g.total;
      const passed = tracking && (i === 0 || prog >= f - 0.0001);
      return { id, passed, time: s.plan.departAt + f * (tracking ? actualMs(s) : s.plan.plannedMs) };
    });
    const nextIdx = phase === "ongoing" ? stops.findIndex((x) => !x.passed) : -1;
    const statusBadge =
      phase === "upcoming" ? <Badge color={PINK}>Scheduled</Badge> : phase === "delivered" ? <Badge color={GREEN}>Delivered</Badge> : late ? <Badge color={RED}>Delayed {delayMin(s)} min</Badge> : <Badge color={BLUE}>On time</Badge>;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setViewerId(null)}>
        <div
          className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border shadow-xl"
          style={{ borderColor: c.border, background: c.row, color: c.text }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Route for ${s.ref}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: c.border }}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{s.ref}</span>
                {statusBadge}
                <BoundBadge bound={s.bound} />
              </div>
              <div className="mt-0.5 text-xs" style={{ color: c.muted }}>
                {tracking ? "Live tracking" : "Planned route"} · {routeLabel(s)}
              </div>
            </div>
            <button type="button" onClick={() => setViewerId(null)} className="rounded-md p-1.5 transition hover:opacity-70" style={{ color: c.muted }} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
            <div className="overflow-hidden rounded-lg border lg:col-span-2" style={{ borderColor: c.border, background: c.card }}>
              <RouteMap c={c} now={now} focus={s} height={420} />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Service provider", provider.name],
                  ["Vehicle type", s.vehicle],
                  ["Cargo", s.cargo],
                  ["Distance", `${s.plan.km} km`],
                  ["Scheduled departure", fmtDateTime(s.plan.departAt)],
                  [tracking ? "Drop time (live ETA)" : "Drop time", fmtDateTime(tracking ? dropLive(s) : dropPlanned(s))],
                  ["Route type", s.plan.tag],
                  ["Est. cost", peso(s.plan.cost)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: c.muted }}>{k}</div>
                    <div className="text-sm font-semibold">{v}</div>
                  </div>
                ))}
              </div>

              {tracking ? (
                <div>
                  <div className="mb-1 flex justify-between text-xs" style={{ color: c.muted }}>
                    <span>Progress</span>
                    <span className="font-semibold" style={{ color: c.text }}>{Math.round(prog * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: c.border }}>
                    <div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: phase === "delivered" ? GREEN : late ? RED : BLUE }} />
                  </div>
                  {phase === "ongoing" && (
                    <div className="mt-1 text-[11px]" style={{ color: c.muted }}>
                      Arrives in {fmtDur(dropLive(s) - now)}
                      {late ? ` · running ${delayMin(s)} min behind plan` : ""}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md px-3 py-2 text-xs" style={{ background: `${PINK}14` }}>
                  Departs in <b>{fmtDur(s.plan.departAt - now)}</b>. It moves to On-going and tracking starts at {fmtClock(s.plan.departAt)}.
                </div>
              )}

              <ol className="list-none space-y-0 p-0">
                {stops.map((st, i) => {
                  const isLast = i === stops.length - 1;
                  const color = st.passed ? GREEN : i === nextIdx ? BLUE : c.line;
                  return (
                    <li key={`${st.id}-${i}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: color, background: st.passed ? color : c.node }} />
                        {!isLast && <span className="w-px flex-1" style={{ background: c.border }} />}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold">{LOCS[st.id].name}</span>
                          <span className="text-xs tabular-nums" style={{ color: c.muted }}>
                            {st.passed ? (i === 0 ? "Departed" : "Passed") : `${tracking ? "ETA" : "Planned"} ${fmtClock(st.time)}`}
                          </span>
                        </div>
                        <div className="text-[11px]" style={{ color: c.muted }}>
                          {i === 0 ? "Origin" : isLast ? "Drop-off" : "Stop"}
                          {i === nextIdx ? " · next stop" : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div>
                <div className="mb-1.5 text-xs font-semibold" style={{ color: c.muted }}>SOPs for this delivery</div>
                <ul className="list-none space-y-1 p-0">
                  {s.plan.sops.map((id) => (
                    <li key={id} className="text-xs"><b>{id}</b> {SOP_DEFS[id].title}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Render ---------- */

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Activity size={20} />}
        title="Service Network & Route Planning"
        subtitle="Network Control: plan routes for incoming shipments, then monitor upcoming and on-going deliveries"
      />

      {!ready ? (
        <div className="px-8 py-10 text-sm" style={{ color: c.muted }}>Loading shipments…</div>
      ) : (
        <div className="space-y-5 px-8">
          {/* Status strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge color={AMBER}>Awaiting planning {unplanned.length}</Badge>
              <Badge color={PINK}>Upcoming {upcoming.length}</Badge>
              <Badge color={BLUE}>On-going {activeCount}</Badge>
              <Badge color={RED}>Delayed {delayedCount}</Badge>
              <Badge color={GREEN}>Delivered {deliveredCount}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: c.muted }}>
              <span className="flex items-center gap-1.5"><Clock size={13} /> Network time {fmtClock(now)}</span>
              <span>Last synced from Shipments {lastSync ? fmtClock(lastSync) : "—"}</span>
              <button
                type="button"
                onClick={sync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: c.border, color: c.text, background: c.node }}
              >
                <RefreshCw size={13} className={syncing ? "animate-spin" : ""} /> Sync
              </button>
            </div>
          </div>

          {notice && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm" style={{ borderColor: GREEN, background: `${GREEN}14`, color: c.text }}>
              <span className="flex items-center gap-2"><CircleCheck size={16} color={GREEN} /> {notice}</span>
              <button
                type="button"
                onClick={() => {
                  setView("deliveries");
                  setDelTab("upcoming");
                  setNotice(null);
                }}
                className="text-xs font-semibold underline"
                style={{ color: GREEN }}
              >
                View upcoming
              </button>
            </div>
          )}

          {/* View tabs */}
          <div className="flex border-b" style={{ borderColor: c.border }}>
            {tabButton(view === "network", () => setView("network"), <NetworkIcon size={15} />, "Network", null, BLUE)}
            {tabButton(view === "planning", () => setView("planning"), <ClipboardList size={15} />, "Route planning", unplanned.length, AMBER)}
            {tabButton(view === "deliveries", () => setView("deliveries"), <Truck size={15} />, "Deliveries", upcoming.length + activeCount, PINK)}
          </div>

          {view === "network" && networkView()}
          {view === "planning" && planningView()}
          {view === "deliveries" && deliveriesView()}
        </div>
      )}

      {viewer()}

      {/* Airship Express AI assistant (floating robot button), same as the other SPNC pages */}
      <SpncAssistant isDark={isDark} />
    </div>
  );
}