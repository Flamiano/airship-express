// Builds the data the AI anomaly scan looks at, on the server, straight from Supabase:
// service providers, rates, SOPs (with automatic pre-check flags), pending requests, trips (deliveries)
// AND the network: routes and schedules (with automatic pre-check flags, see routeChecks.ts).
// The dashboard (/api/anomaly-detect) and the assistant both use this, so they always send
// identical data and share one cached Groq scan.

import { getSupabaseClient } from "../supabase";
import type { ScanInput } from "./Anomalyscan";
import { duplicateNames, duplicateSops, emailIssue, nameIssue, phoneIssue, sopIssues } from "./dataChecks";
import { duplicateRoutes, routeIssues, scheduleIssues, tripIssues } from "./routeChecks";

type Row = Record<string, unknown>;

const TZ = process.env.ASSISTANT_TIMEZONE || "Asia/Manila";
const RATES_TABLE = process.env.ASSISTANT_RATES_SOURCE || "rates";
const SOPS_TABLE = process.env.ASSISTANT_SOPS_SOURCE || "sops";
const TRIP_LOOKBACK_DAYS = 7; // delivered trips older than this aren't sent (keeps the request small)
const NOW_STEP_MIN = 15; // "now" is rounded to 15 min so the cached scan can be reused for that long
const TRIP_STALE_HOURS = Number(process.env.ASSISTANT_TRIP_STALE_HOURS || 6); // open trip with no checkpoint for this long
const TRIP_OVER_ETA_FACTOR = Number(process.env.ASSISTANT_TRIP_OVER_ETA_FACTOR || 1.5); // trip took this many times the route estimate

const day = (v: unknown) => (v == null || v === "" ? undefined : String(v).slice(0, 10));
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const ms = (v: unknown) => {
  if (!v) return undefined;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? undefined : t;
};
const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Date → "2026-10-01 14:30" in Philippine time (what the AI compares against "now") */
export function localStamp(d: Date | string | null | undefined) {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return undefined;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

async function read(table: string, select = "*", keepArchived = false): Promise<Row[]> {
  const { data, error } = await getSupabaseClient().from(table).select(select).limit(2000);
  if (error) {
    if (!/does not exist|could not find/i.test(error.message || "")) console.error(`Anomaly input: read ${table} failed:`, error.message);
    return [];
  }
  const rows = (data as unknown as Row[]) ?? [];
  return keepArchived ? rows : rows.filter((r) => !r.archived_at && !r.deleted_at);
}

export async function buildScanInput(): Promise<ScanInput> {
  const nowMs = Math.floor(Date.now() / (NOW_STEP_MIN * 60_000)) * NOW_STEP_MIN * 60_000;
  const now = new Date(nowMs);

  const [providers, rates, sops, routes, schedules, trips] = await Promise.all([
    // archived providers are kept (marked "archived") so a rate pointing at one is reported
    // as "inactive provider", not as a missing provider
    read("service_providers", "*", true),
    read(RATES_TABLE),
    read(SOPS_TABLE),
    // "*" on purpose: it works whether or not routes has an archived_at column
    read("routes"),
    read("schedules", "id, schedule_code, route_id, departure_datetime, arrival_datetime, status, archived_at"),
    read("trips", "id, trip_code, schedule_id, vehicle_plate_no, driver_name, archived_at, checkpoints:trip_checkpoints ( checkpoint_no, location, recorded_at, status, remarks )"),
  ]);

  const scheduleById = new Map(schedules.map((s) => [String(s.id), s]));
  const routeById = new Map(routes.map((r) => [String(r.id), r]));
  const providerById = new Map(providers.map((p) => [String(p.id), p]));
  // a schedule counts as "started" once any of its trips has at least one checkpoint
  const scheduleHasTrip = new Set(
    trips.filter((t) => t.schedule_id && ((t.checkpoints as Row[]) ?? []).length > 0).map((t) => String(t.schedule_id))
  );
  const cutoff = nowMs - TRIP_LOOKBACK_DAYS * 86_400_000;

  const tripRows = trips
    .map((t) => {
      const cps = ((t.checkpoints as Row[]) ?? []).slice().sort((a, b) => Number(a.checkpoint_no) - Number(b.checkpoint_no));
      const first = cps[0];
      const last = cps[cps.length - 1];
      const delivered = cps.find((c) => ["delivered", "completed"].includes(norm(c.status)));
      const sch = t.schedule_id ? scheduleById.get(String(t.schedule_id)) : undefined;
      const route = sch?.route_id ? routeById.get(String(sch.route_id)) : undefined;
      const etaHours = numOrNull(route?.estimated_transit_hours);
      const lastStatus = last ? norm(last.status) : "not_started";

      // Automatic pre-checks against the route estimate, checkpoint freshness and the planned times
      const flags = tripIssues(
        {
          delivered: !!delivered,
          cancelled: lastStatus === "cancelled",
          lastStatus,
          hasCheckpoints: cps.length > 0,
          departedMs: ms(first?.recorded_at),
          deliveredMs: ms(delivered?.recorded_at),
          lastUpdateMs: ms(last?.recorded_at),
          plannedDepartureMs: ms(sch?.departure_datetime),
          plannedArrivalMs: ms(sch?.arrival_datetime),
          routeEtaHours: etaHours,
        },
        nowMs,
        { staleHours: TRIP_STALE_HOURS, overEtaFactor: TRIP_OVER_ETA_FACTOR }
      );

      return {
        id: t.id,
        trip_code: t.trip_code,
        vehicle: t.vehicle_plate_no,
        driver: t.driver_name,
        schedule: sch?.schedule_code,
        route: route?.route_code,
        route_eta_hours: etaHours ?? undefined,
        planned_departure: localStamp(sch?.departure_datetime as string),
        planned_arrival: localStamp(sch?.arrival_datetime as string),
        departed_at: localStamp(first?.recorded_at as string),
        delivered_at: localStamp(delivered?.recorded_at as string),
        last_status: lastStatus,
        last_location: last?.location,
        last_update: localStamp(last?.recorded_at as string),
        last_remarks: last?.remarks || undefined,
        ...(flags.length ? { flags } : {}),
        _sortTime: new Date(String(delivered?.recorded_at ?? last?.recorded_at ?? sch?.arrival_datetime ?? 0)).getTime(),
      };
    })
    // keep open trips, and finished ones from the last week
    .filter((t) => !t.delivered_at || t._sortTime >= cutoff)
    .filter((t) => t.last_status !== "cancelled")
    .map(({ _sortTime, ...rest }) => {
      void _sortTime;
      return rest;
    });

  // Routes: pre-checks + duplicates. Unflagged routes are kept but are the first to be trimmed
  // when the request is too big (flagged records always come first, see Anomalyscan.ts).
  const dupRoutes = duplicateRoutes(routes);
  const routeRows = routes.map((r) => {
    const provider = r.service_provider_id ? providerById.get(String(r.service_provider_id)) : undefined;
    const flags = [...routeIssues(r, providerById), dupRoutes.get(String(r.id)) ?? null].filter((f): f is string => !!f);
    return {
      id: r.id,
      route_code: r.route_code,
      route_name: r.route_name,
      origin: r.origin,
      destination: r.destination,
      mode: r.mode_of_transport,
      provider: provider?.name,
      status: r.status,
      distance_km: r.distance_km,
      eta_hours: r.estimated_transit_hours,
      ...(flags.length ? { flags } : {}),
    };
  });

  // Schedules: only the ones with a problem are sent (late, never started, no route, inactive route, …)
  const scheduleRows = schedules
    .map((s) => ({ s, flags: scheduleIssues(s, { nowMs, routeById, scheduleHasTrip }) }))
    .filter((x) => x.flags.length > 0)
    .map(({ s, flags }) => ({
      id: s.id,
      schedule_code: s.schedule_code,
      route: s.route_id ? routeById.get(String(s.route_id))?.route_code : undefined,
      status: s.status,
      planned_departure: localStamp(s.departure_datetime as string),
      planned_arrival: localStamp(s.arrival_datetime as string),
      flags,
    }));

  const today = localStamp(now)!.slice(0, 10);
  const dupSops = duplicateSops(sops.filter((x) => !["pending", "declined"].includes(String(x.status ?? "").toLowerCase())));
  const dupProviders = duplicateNames(providers.filter((p) => !p.archived_at && !p.deleted_at).map((p) => ({ id: p.id, name: p.name })));

  return {
    today,
    now: localStamp(now),
    providers: providers.map((p) => {
      const archived = !!(p.archived_at || p.deleted_at);
      // Automatic pre-checks: hints the AI must confirm and report (skipped for archived records)
      const flags = archived
        ? []
        : [
            emailIssue(p.email),
            phoneIssue(p.phone),
            nameIssue(p.name, "provider name"),
            nameIssue(p.contact_person, "contact person"),
            dupProviders.get(String(p.id)) ?? null,
          ].filter((f): f is string => !!f);
      return {
        id: p.id, name: p.name, status: archived ? "archived" : p.status,
        type: p.type ?? p.provider_type, contact_person: p.contact_person,
        rating: p.rating, email: p.email, phone: p.phone, country: p.country, created_at: day(p.created_at),
        ...(flags.length ? { flags } : {}),
      };
    }),
    rates: rates.map((r) => ({
      id: r.id, rate_code: r.rate_code, status: r.status, valid_from: day(r.valid_from), valid_to: day(r.valid_to),
      base_rate: r.base_rate, charge_type: r.charge_type, currency: r.currency, created_at: day(r.created_at),
      // rates are not linked to providers or routes, so those fields are not sent
    })),
    sops: sops
      .filter((x) => String(x.status ?? "").toLowerCase() !== "declined")
      .map((x) => {
        // Automatic pre-checks (review overdue / due soon, missing owner or department, empty content,
        // test-looking names, duplicate codes). The AI confirms each one and writes the alert.
        const flags = [...sopIssues(x, today), dupSops.get(String(x.id)) ?? null].filter((f): f is string => !!f);
        return {
          id: x.id, title: x.title, sop_code: x.sop_code, status: x.status, category: x.category,
          department: x.department || undefined, owner: x.owner || undefined, version: x.version,
          effective_date: day(x.effective_date), review_date: day(x.review_date), created_at: day(x.created_at),
          has_content: !!String(x.content ?? "").trim(),
          ...(flags.length ? { flags } : {}),
        };
      }),
    trips: tripRows,
    routes: routeRows,
    schedules: scheduleRows,
  };
}