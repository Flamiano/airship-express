// Save as: app/(spnc)/spnc/lib/assistant/routeChecks.ts   (next to dataChecks.ts)
//
// Automatic pre-checks for the Network side of the anomaly scan: routes, schedules and trips.
// Same idea as dataChecks.ts: these are plain, cheap checks that run on the server and attach a
// `flags` list to a record. The AI then confirms each flag and writes the alert, so Groq only has
// to look at records that already have a reason to be looked at.

type Row = Record<string, unknown>;

const HOUR = 3_600_000;

const text = (v: unknown) => String(v ?? "").trim();
const lc = (v: unknown) => text(v).toLowerCase();
const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isInactive = (s: unknown) => ["inactive", "suspended", "archived", "closed"].includes(lc(s));

/** 90 → "1.5 h", 60 hours → "3 days" */
export const fmtHours = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : `${Math.round(h * 10) / 10} h`);

// Fastest believable average speed per mode (km/h). Anything above this means the distance or the
// estimated transit hours on the route is wrong.
const MAX_KMH: Record<string, number> = { road: 110, rail: 140, sea: 60, air: 1100 };

// Deliveries planned on the Service Network & Route Planning page are saved as schedules with codes
// "SCH-SHP-…". That page never creates trips, so "departure passed but no trip has started" would
// fire for every one of them. While this is true, that single flag is skipped for those schedules
// (their other flags, such as "no route" or "arrival time passed", still apply).
// Set it to false to flag them like any other schedule.
export const EXEMPT_PLANNER_FROM_NO_TRIP = true;
const isPlannerSchedule = (s: Row) => /^SCH-SHP-/i.test(text(s.schedule_code));

/* ---------------- Routes ---------------- */

export function routeIssues(r: Row, providerById: Map<string, Row>): string[] {
  const out: string[] = [];
  const status = lc(r.status);
  const active = status === "" || status === "active";
  const pid = r.service_provider_id ? String(r.service_provider_id) : "";
  const provider = pid ? providerById.get(pid) : undefined;

  if (active && !pid) out.push("active route has no service provider assigned");
  if (pid && !provider) out.push("assigned service provider was not found");
  if (provider && (provider.archived_at || provider.deleted_at || isInactive(provider.status))) {
    out.push(`service provider "${text(provider.name)}" is inactive or archived`);
  }

  if (lc(r.origin) && lc(r.origin) === lc(r.destination)) out.push("origin and destination are the same");

  const km = num(r.distance_km);
  const hrs = num(r.estimated_transit_hours);
  if (active && (!km || km <= 0)) out.push("distance (km) is missing");
  if (active && (!hrs || hrs <= 0)) out.push("estimated transit hours is missing");
  if (km && hrs && km > 0 && hrs > 0) {
    const max = MAX_KMH[lc(r.mode_of_transport)];
    const kmh = km / hrs;
    if (max && kmh > max) out.push(`estimated transit time is too short for the distance (${Math.round(kmh)} km/h average)`);
  }
  return out;
}

/** id → message, for routes that share a code or the same origin/destination/mode/provider. */
export function duplicateRoutes(routes: Row[]): Map<string, string> {
  const flags = new Map<string, string>();

  const byCode = new Map<string, Row[]>();
  const byLane = new Map<string, Row[]>();
  for (const r of routes) {
    const code = lc(r.route_code);
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), r]);
    const lane = [lc(r.origin), lc(r.destination), lc(r.mode_of_transport), text(r.service_provider_id)].join("|");
    if (lc(r.origin) && lc(r.destination)) byLane.set(lane, [...(byLane.get(lane) ?? []), r]);
  }

  for (const [, group] of byCode) {
    if (group.length < 2) continue;
    for (const r of group) flags.set(String(r.id), `duplicate route code "${text(r.route_code)}" (${group.length} routes)`);
  }
  for (const [, group] of byLane) {
    if (group.length < 2) continue;
    for (const r of group) {
      if (flags.has(String(r.id))) continue;
      const others = group.filter((x) => x !== r).map((x) => text(x.route_code)).join(", ");
      flags.set(String(r.id), `same origin, destination, mode and provider as route ${others}`);
    }
  }
  return flags;
}

/* ---------------- Schedules ---------------- */

export function scheduleIssues(
  s: Row,
  ctx: { nowMs: number; routeById: Map<string, Row>; scheduleHasTrip: Set<string> }
): string[] {
  const status = lc(s.status);
  if (!["scheduled", "delayed"].includes(status)) return []; // completed / cancelled schedules are fine

  const out: string[] = [];
  const dep = s.departure_datetime ? Date.parse(String(s.departure_datetime)) : NaN;
  const arr = s.arrival_datetime ? Date.parse(String(s.arrival_datetime)) : NaN;

  if (status === "delayed") out.push("schedule is marked Delayed");

  if (Number.isFinite(dep) && Number.isFinite(arr) && arr <= dep) out.push("arrival time is not after departure time");

  if (Number.isFinite(arr) && arr < ctx.nowMs) {
    out.push(`arrival time passed ${fmtHours((ctx.nowMs - arr) / HOUR)} ago but the schedule is still ${status}`);
  } else if (
    status === "scheduled" &&
    Number.isFinite(dep) &&
    dep < ctx.nowMs - HOUR &&
    !ctx.scheduleHasTrip.has(String(s.id)) &&
    !(EXEMPT_PLANNER_FROM_NO_TRIP && isPlannerSchedule(s))
  ) {
    out.push(`departure time passed ${fmtHours((ctx.nowMs - dep) / HOUR)} ago but no trip has started`);
  }

  const rid = s.route_id ? String(s.route_id) : "";
  const route = rid ? ctx.routeById.get(rid) : undefined;
  if (!rid) out.push("no route assigned");
  else if (!route) out.push("assigned route was not found");
  else if (isInactive(route.status) || route.archived_at) out.push(`route "${text(route.route_code)}" is inactive`);

  return out;
}

/* ---------------- Trips ---------------- */

export function tripIssues(
  t: {
    delivered: boolean;
    cancelled: boolean;
    lastStatus: string;
    hasCheckpoints: boolean;
    departedMs?: number;
    deliveredMs?: number;
    lastUpdateMs?: number;
    plannedDepartureMs?: number;
    plannedArrivalMs?: number;
    routeEtaHours?: number | null;
  },
  nowMs: number,
  opts: { staleHours: number; overEtaFactor: number }
): string[] {
  if (t.cancelled) return [];
  const out: string[] = [];
  const eta = t.routeEtaHours && t.routeEtaHours > 0 ? t.routeEtaHours : null;
  const finite = (n?: number): n is number => typeof n === "number" && Number.isFinite(n);

  if (!t.delivered) {
    if (t.hasCheckpoints && finite(t.lastUpdateMs) && nowMs - t.lastUpdateMs > opts.staleHours * HOUR) {
      out.push(`no checkpoint update for ${fmtHours((nowMs - t.lastUpdateMs) / HOUR)} and not delivered`);
    }
    if (finite(t.departedMs) && eta) {
      const elapsed = (nowMs - t.departedMs) / HOUR;
      if (elapsed > eta * opts.overEtaFactor) out.push(`in transit ${fmtHours(elapsed)} vs route estimate ${fmtHours(eta)}`);
    }
    if (!t.hasCheckpoints && finite(t.plannedDepartureMs) && t.plannedDepartureMs < nowMs - HOUR) {
      out.push("planned departure passed but the trip has no checkpoints");
    }
    if (finite(t.plannedArrivalMs) && nowMs > t.plannedArrivalMs + HOUR) {
      out.push(`planned arrival passed ${fmtHours((nowMs - t.plannedArrivalMs) / HOUR)} ago and not delivered`);
    }
  } else if (finite(t.departedMs) && finite(t.deliveredMs) && eta) {
    const took = (t.deliveredMs - t.departedMs) / HOUR;
    if (took > eta * opts.overEtaFactor) out.push(`delivered after ${fmtHours(took)} vs route estimate ${fmtHours(eta)}`);
  }
  return out;
}