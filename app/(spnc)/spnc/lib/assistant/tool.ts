// Tools the SPNC assistant can use. Each tool returns:
//   data   -> compact JSON the AI model reads to write its answer
//   blocks -> rich UI shown in the chat (stat tiles, tables, alert lists)

import {
  computeAlerts,
  computeExceptions,
  findProvider,
  findShipment,
  fmtDate,
  fmtMins,
  loadSnapshot,
  norm,
  performanceOf,
  providerFamily,
  readOptionalTable,
  readStoredAlerts,
  type Alert,
  type Performance,
  type Provider,
  type Shipment,
  type Snapshot,
} from "./network";
import { masterDataAlerts, fixHref } from "./anomalies";
import { buildScanInput } from "./anomalyInput";

/* ------------------------------------------------------------------ */
/* UI blocks                                                           */
/* ------------------------------------------------------------------ */

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export type Block =
  | { type: "stats"; title?: string; items: { label: string; value: string; tone?: Tone }[] }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
      tones?: (Tone | null)[]; // per-row status tone (colors the last column)
      shipmentIds?: (string | null)[]; // rows that can open the tracking map
      more?: number; // rows not shown
    }
  | { type: "alerts"; title: string; items: Alert[]; more?: number }
  | { type: "note"; text: string; tone?: Tone }
  | { type: "track"; shipmentId: string; label: string };

export type ToolResult = { data: unknown; blocks: Block[]; suggestions?: string[] };

const MAX_ROWS = 12;

const STATUS_LABEL: Record<Shipment["status"], string> = {
  pending: "Pending",
  departed: "Departed",
  in_transit: "In transit",
  delayed: "Delayed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function statusTone(s: Shipment): Tone {
  if (s.status === "cancelled") return "bad";
  if (s.isDelayed) return s.status === "delivered" ? "warn" : "bad";
  if (s.status === "delivered") return "good";
  if (s.status === "pending") return "neutral";
  return "info";
}

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);
const FAMILY_LABEL = {
  carrier: "Carrier",
  freight_forwarder: "Freight forwarder",
  customs_broker: "Customs broker",
  other: "Other",
} as const;

function rateTone(r: number | null): Tone {
  if (r == null) return "neutral";
  return r >= 90 ? "good" : r >= 75 ? "warn" : "bad";
}

function shipmentsOf(snap: Snapshot, p: Provider) {
  return snap.shipments.filter((s) => s.provider?.id === p.id);
}

function shipmentRow(s: Shipment): string[] {
  return [
    s.code,
    s.provider?.name ?? "—",
    s.route ? `${s.route.origin ?? "?"} → ${s.route.destination ?? "?"}` : "—",
    s.lastCheckpoint ? `${s.lastCheckpoint.location} (${fmtDate(s.lastCheckpoint.at)})` : "—",
    s.isDelayed && s.status !== "delivered" ? `Delayed · ${s.delayReason ?? ""}` : STATUS_LABEL[s.status],
  ];
}

function shipmentTable(title: string, list: Shipment[]): Block {
  const shown = list.slice(0, MAX_ROWS);
  return {
    type: "table",
    title,
    columns: ["Trip", "Provider", "Route", "Last checkpoint", "Status"],
    rows: shown.map(shipmentRow),
    tones: shown.map(statusTone),
    shipmentIds: shown.map((s) => s.id),
    more: Math.max(0, list.length - shown.length),
  };
}

function shipmentBrief(s: Shipment) {
  return {
    trip: s.code,
    status: s.status,
    delayed: s.isDelayed,
    delay_reason: s.delayReason,
    provider: s.provider?.name ?? null,
    route: s.route ? `${s.route.origin} → ${s.route.destination}` : null,
    schedule: s.schedule?.code ?? null,
    planned_arrival: s.schedule?.arrival?.toISOString() ?? null,
    last_checkpoint: s.lastCheckpoint
      ? { location: s.lastCheckpoint.location, at: s.lastCheckpoint.at?.toISOString(), status: s.lastCheckpoint.status }
      : null,
    vehicle: s.plate,
    driver: s.driver,
  };
}

function perfBrief(p: Performance) {
  return {
    trips: p.total,
    active: p.active,
    delivered: p.delivered,
    on_time_rate_pct: p.onTimeRate == null ? null : Math.round(p.onTimeRate),
    late_deliveries: p.late,
    delayed_now: p.delayedNow,
    cancelled: p.cancelled,
    avg_delay: p.avgDelayMins == null ? null : fmtMins(p.avgDelayMins),
    distance_km: Math.round(p.distanceKm),
    cargo_tons: Math.round(p.cargoT * 10) / 10,
    score: p.score,
  };
}

/* ------------------------------------------------------------------ */
/* Live route and schedule checks (no AI, read straight from Supabase) */
/* ------------------------------------------------------------------ */
// The same automatic pre-checks the AI scan uses (routeChecks.ts), run on every request,
// so route and schedule problems show up in the chat right away instead of after the
// 10-minute cached AI scan. If the AI scan already reported a record, its alert wins.

type Row = Record<string, unknown>;

const routeFlagField = (flag: string) => {
  const t = flag.toLowerCase();
  if (t.includes("service provider")) return "service_provider_id";
  if (t.includes("origin and destination are the same")) return "destination";
  if (t.includes("transit")) return "estimated_transit_hours";
  if (t.includes("distance")) return "distance_km";
  return "route_code";
};

const scheduleFlagField = (flag: string) => {
  const t = flag.toLowerCase();
  if (t.includes("route")) return "route_id";
  if (t.includes("arrival")) return "arrival_datetime";
  if (t.includes("departure")) return "departure_datetime";
  return "status";
};

const routeFlagSeverity = (flag: string): Alert["severity"] =>
  /missing|^same origin, destination, mode and provider/i.test(flag) ? "medium" : "high";
const scheduleFlagSeverity = (flag: string): Alert["severity"] => (/marked delayed/i.test(flag) ? "medium" : "high");

const flagsOf = (r: Row) => (Array.isArray(r.flags) ? (r.flags as unknown[]).map(String) : []);

let liveCache: { at: number; alerts: Alert[] } | null = null;
const LIVE_CACHE_MS = 20_000;

async function liveNetworkAlerts(): Promise<Alert[]> {
  if (liveCache && Date.now() - liveCache.at < LIVE_CACHE_MS) return liveCache.alerts;
  try {
    const input = await buildScanInput();
    const out: Alert[] = [];

    for (const r of (input.routes ?? []) as Row[]) {
      const subject = [r.route_code, r.route_name].filter(Boolean).join(" · ") || "Route";
      flagsOf(r).forEach((flag, i) => {
        const field = routeFlagField(flag);
        out.push({
          id: `live-route-${r.id}-${i}`,
          severity: routeFlagSeverity(flag),
          kind: "route_issue",
          title: `Route problem: ${subject}`,
          detail: flag.charAt(0).toUpperCase() + flag.slice(1),
          subject,
          expected: "No problems found by the route checks",
          current: flag,
          href: fixHref("/spnc/app/routes", r.id, field, subject),
          recordId: String(r.id),
          field,
          source: "rules",
        });
      });
    }

    for (const s of (input.schedules ?? []) as Row[]) {
      const subject = String(s.schedule_code ?? "Schedule");
      flagsOf(s).forEach((flag, i) => {
        const field = scheduleFlagField(flag);
        out.push({
          id: `live-schedule-${s.id}-${i}`,
          severity: scheduleFlagSeverity(flag),
          kind: "schedule_issue",
          title: `Schedule problem: ${subject}`,
          detail: flag.charAt(0).toUpperCase() + flag.slice(1),
          subject,
          expected: "No problems found by the schedule checks",
          current: flag,
          href: fixHref("/spnc/app/schedules", s.id, field, subject),
          recordId: String(s.id),
          field,
          source: "rules",
        });
      });
    }

    liveCache = { at: Date.now(), alerts: out };
    return out;
  } catch (err) {
    console.error("Assistant: live route/schedule checks failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Live alerts for records the AI scan has not already reported. */
function notCoveredByAi(live: Alert[], ai: Alert[]): Alert[] {
  const covered = new Set(
    ai.filter((a) => a.kind === "route_issue" || a.kind === "schedule_issue").map((a) => String(a.recordId ?? ""))
  );
  return live.filter((a) => !covered.has(String(a.recordId ?? "")));
}

/* ------------------------------------------------------------------ */
/* Tool implementations                                                */
/* ------------------------------------------------------------------ */

async function networkOverview(): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const perf = performanceOf(snap.shipments);
  const md = await masterDataAlerts(snap.providers.map((p) => p.raw), "cached-only");
  const live = notCoveredByAi(await liveNetworkAlerts(), md.ai);
  const alerts = [...(await readStoredAlerts()), ...computeAlerts(snap), ...md.rules, ...md.ai, ...live];
  const exceptions = computeExceptions(snap);
  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  const families = { carrier: 0, freight_forwarder: 0, customs_broker: 0, other: 0 };
  snap.providers.forEach((p) => families[providerFamily(p)]++);

  // Worst routes by current delays
  const byRoute = new Map<string, { name: string; delayed: number; total: number }>();
  for (const s of snap.shipments) {
    if (!s.route) continue;
    const r = byRoute.get(s.route.id) ?? { name: `${s.route.origin ?? "?"} → ${s.route.destination ?? "?"}`, delayed: 0, total: 0 };
    r.total++;
    if (s.isDelayed) r.delayed++;
    byRoute.set(s.route.id, r);
  }
  const hotRoutes = [...byRoute.values()].filter((r) => r.delayed > 0).sort((a, b) => b.delayed - a.delayed).slice(0, 5);

  const blocks: Block[] = [
    {
      type: "stats",
      title: "Network right now",
      items: [
        { label: "Providers", value: String(snap.providers.length) },
        { label: "Active shipments", value: String(perf.active), tone: "info" },
        { label: "Delayed", value: String(perf.delayedNow), tone: perf.delayedNow ? "bad" : "good" },
        { label: "On-time rate", value: pct(perf.onTimeRate), tone: rateTone(perf.onTimeRate) },
        { label: "Open alerts", value: String(alerts.length), tone: highAlerts ? "bad" : alerts.length ? "warn" : "good" },
        { label: "Exceptions", value: String(exceptions.length), tone: exceptions.length ? "warn" : "good" },
      ],
    },
    {
      type: "stats",
      title: "Totals",
      items: [
        { label: "Trips logged", value: String(perf.total) },
        { label: "Delivered", value: String(perf.delivered), tone: "good" },
        { label: "Routes", value: String(snap.routes.length) },
        { label: "Schedules", value: String(snap.schedules.length) },
        { label: "Distance", value: `${Math.round(perf.distanceKm).toLocaleString()} km` },
        { label: "Cargo moved", value: `${perf.cargoT.toFixed(1)} t` },
      ],
    },
  ];
  if (hotRoutes.length)
    blocks.push({
      type: "table",
      title: "Routes with delays",
      columns: ["Route", "Delayed", "Trips"],
      rows: hotRoutes.map((r) => [r.name, String(r.delayed), String(r.total)]),
      tones: hotRoutes.map(() => "bad" as Tone),
    });

  return {
    data: {
      providers: snap.providers.length,
      provider_types: families,
      routes: snap.routes.length,
      schedules: snap.schedules.length,
      performance: perfBrief(perf),
      open_alerts: alerts.length,
      high_alerts: highAlerts,
      exceptions: exceptions.length,
      routes_with_delays: hotRoutes,
    },
    blocks,
    suggestions: ["Delayed Shipments", "Alerts", "Provider ranking"],
  };
}

async function listProviders(args: { type?: string; search?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const want = norm(args.type);
  let list = snap.providers;
  if (want && want !== "all") {
    list = list.filter((p) => {
      const fam = providerFamily(p);
      return fam === want || norm(p.type).includes(want) || (want.includes("forward") && fam === "freight_forwarder") ||
        (want.includes("broker") && fam === "customs_broker") || (want.includes("carrier") && fam === "carrier");
    });
  }
  if (args.search) {
    const q = args.search.toLowerCase();
    list = list.filter((p) => [p.name, p.type, p.contact, p.email].filter(Boolean).join(" ").toLowerCase().includes(q));
  }

  const rows = list
    .map((p) => ({ p, perf: performanceOf(shipmentsOf(snap, p)) }))
    .sort((a, b) => (b.perf.score ?? -1) - (a.perf.score ?? -1) || a.p.name.localeCompare(b.p.name));
  const shown = rows.slice(0, MAX_ROWS);

  return {
    data: rows.map(({ p, perf }) => ({
      name: p.name,
      type: p.type,
      family: providerFamily(p),
      status: p.status,
      contact: p.contact,
      ...perfBrief(perf),
    })),
    blocks: rows.length
      ? [
          {
            type: "table",
            title: `Service providers${want && want !== "all" ? ` · ${args.type}` : ""} (${rows.length})`,
            columns: ["Provider", "Type", "Trips", "Active", "On-time", "Delayed now"],
            rows: shown.map(({ p, perf }) => [
              p.name,
              p.type ?? FAMILY_LABEL[providerFamily(p)],
              String(perf.total),
              String(perf.active),
              pct(perf.onTimeRate),
              String(perf.delayedNow),
            ]),
            tones: shown.map(({ perf }) => (perf.delayedNow ? "bad" : rateTone(perf.onTimeRate))),
            more: Math.max(0, rows.length - shown.length),
          },
        ]
      : [{ type: "note", text: "No providers match that." }],
    suggestions: shown.slice(0, 3).map(({ p }) => `How is ${p.name} performing?`),
  };
}

async function providerDetails(args: { provider: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const p = findProvider(snap, args.provider || "");
  if (!p) {
    return {
      data: { error: `No provider matching "${args.provider}".`, known_providers: snap.providers.map((x) => x.name).slice(0, 50) },
      blocks: [{ type: "note", text: `I couldn't find a provider matching “${args.provider}”.`, tone: "warn" }],
      suggestions: ["View Providers"],
    };
  }
  const list = shipmentsOf(snap, p);
  const perf = performanceOf(list);
  const assignedRoutes = snap.routes.filter((r) => r.providerId === p.id);
  const [rates, docs] = await Promise.all([
    readOptionalTable("ASSISTANT_RATES_TABLE", "provider_rates", p.id),
    readOptionalTable("ASSISTANT_DOCUMENTS_TABLE", "provider_documents", p.id),
  ]);

  const active = list.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
  const blocks: Block[] = [
    {
      type: "stats",
      title: `${p.name} · ${p.type ?? FAMILY_LABEL[providerFamily(p)]}`,
      items: [
        { label: "Score", value: perf.score == null ? "—" : `${perf.score}/100`, tone: rateTone(perf.score) },
        { label: "On-time rate", value: pct(perf.onTimeRate), tone: rateTone(perf.onTimeRate) },
        { label: "Trips", value: String(perf.total) },
        { label: "Active", value: String(perf.active), tone: "info" },
        { label: "Delayed now", value: String(perf.delayedNow), tone: perf.delayedNow ? "bad" : "good" },
        { label: "Avg lateness", value: perf.avgDelayMins == null ? "—" : fmtMins(perf.avgDelayMins) },
      ],
    },
  ];
  if (active.length) blocks.push(shipmentTable("Assigned shipments (active)", active));
  else if (list.length) blocks.push(shipmentTable("Recent shipments", list));
  blocks.push(...ratesBlocks(rates, p.name), ...docsBlocks(docs, p.name));

  return {
    data: {
      provider: {
        name: p.name,
        type: p.type,
        family: providerFamily(p),
        status: p.status,
        contact: p.contact,
        email: p.email,
        phone: p.phone,
      },
      performance: perfBrief(perf),
      routes: assignedRoutes.map((r) => `${r.code ?? ""} ${r.origin} → ${r.destination}`.trim()),
      active_shipments: active.slice(0, 20).map(shipmentBrief),
      rates: rates.available ? rates.rows.slice(0, 20) : "rates table not set up",
      documents: docs.available ? docs.rows.slice(0, 20) : "documents table not set up",
    },
    blocks,
    suggestions: ["Delayed Shipments", "View Providers", "Network Overview"],
  };
}

async function listShipments(args: { status?: string; provider?: string; search?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  let list = snap.shipments;
  const st = norm(args.status);
  if (st === "delayed") list = list.filter((s) => s.isDelayed && s.status !== "delivered" && s.status !== "cancelled");
  else if (st === "active") list = list.filter((s) => ["departed", "in_transit", "delayed"].includes(s.status));
  else if (st && st !== "all") list = list.filter((s) => s.status === st);

  if (args.provider) {
    const p = findProvider(snap, args.provider);
    list = p ? list.filter((s) => s.provider?.id === p.id) : [];
  }
  if (args.search) {
    const q = args.search.toLowerCase();
    list = list.filter((s) =>
      [s.code, s.plate, s.driver, s.cargo, s.route?.origin, s.route?.destination, s.lastCheckpoint?.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  if (st === "delayed") list = [...list].sort((a, b) => (b.delayMins ?? 0) - (a.delayMins ?? 0));

  const title = st === "delayed" ? "Delayed shipments" : st && st !== "all" ? `Shipments · ${args.status}` : "Shipments";
  return {
    data: { count: list.length, shipments: list.slice(0, 30).map(shipmentBrief) },
    blocks: list.length
      ? [shipmentTable(`${title} (${list.length})`, list)]
      : [{ type: "note", text: st === "delayed" ? "No delayed shipments right now. 🎉" : "No shipments match that.", tone: st === "delayed" ? "good" : "neutral" }],
    suggestions: st === "delayed" ? ["Alerts", "Exceptions", "Network Overview"] : ["Delayed Shipments"],
  };
}

async function shipmentDetails(args: { trip: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const s = findShipment(snap, args.trip || "");
  if (!s)
    return {
      data: { error: `No trip matching "${args.trip}".` },
      blocks: [{ type: "note", text: `I couldn't find trip “${args.trip}”.`, tone: "warn" }],
    };
  return {
    data: {
      ...shipmentBrief(s),
      cargo: s.cargo,
      weight_kg: s.weightKg,
      load_pct: s.loadPct == null ? null : Math.round(s.loadPct),
      distance_km: s.distanceKm,
      checkpoints: s.checkpoints.map((c) => ({ no: c.no, location: c.location, at: c.at?.toISOString(), status: c.status, remarks: c.remarks })),
    },
    blocks: [
      {
        type: "stats",
        title: `${s.code} · ${s.plate} · ${s.driver}`,
        items: [
          { label: "Status", value: s.isDelayed && s.status !== "delivered" ? "Delayed" : STATUS_LABEL[s.status], tone: statusTone(s) },
          { label: "Provider", value: s.provider?.name ?? "—" },
          { label: "Planned arrival", value: fmtDate(s.schedule?.arrival ?? null) },
          { label: "Delivered", value: fmtDate(s.deliveredAt) },
          { label: "Distance", value: s.distanceKm == null ? "—" : `${Math.round(s.distanceKm)} km` },
          { label: "Load", value: s.loadPct == null ? "—" : `${Math.round(s.loadPct)}%`, tone: s.loadPct != null && s.loadPct > 100 ? "bad" : undefined },
        ],
      },
      {
        type: "table",
        title: "Checkpoints",
        columns: ["#", "Location", "Time", "Status"],
        rows: s.checkpoints.map((c) => [String(c.no), c.location, fmtDate(c.at), c.status.replace(/_/g, " ")]),
        shipmentIds: s.checkpoints.map(() => null),
      },
      ...(s.delayReason ? [{ type: "note" as const, text: s.delayReason, tone: "warn" as Tone }] : []),
      { type: "track", shipmentId: s.id, label: `Track ${s.code} on map` },
    ],
    suggestions: ["Delayed Shipments", "Alerts"],
  };
}

async function listAlerts(args: { severity?: string; category?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const cat = norm(args.category);
  const wantNetwork = !cat || cat === "all" || cat === "network" || cat === "shipments";
  const wantData = !cat || cat === "all" || cat === "data" || cat === "anomalies" || cat === "master_data";

  const network = wantNetwork ? [...(await readStoredAlerts()), ...computeAlerts(snap)] : [];
  const md = wantData
    ? await masterDataAlerts(snap.providers.map((p) => p.raw), "run")
    : { rules: [], ai: [], aiEnabled: false, aiError: null as string | null };
  // Route and schedule problems found right now by the automatic checks (skips records the AI already reported)
  const live = wantData || wantNetwork ? notCoveredByAi(await liveNetworkAlerts(), md.ai) : [];
  const anomalies = [...md.ai, ...md.rules, ...live];

  const rank = { high: 0, medium: 1, low: 2 } as const;
  const sev = norm(args.severity);
  const filt = (list: Alert[]) =>
    (sev === "high" || sev === "medium" || sev === "low" ? list.filter((a) => a.severity === sev) : list).sort(
      (a, b) => rank[a.severity] - rank[b.severity]
    );
  const net = filt(network);
  const data = filt(anomalies);
  const total = net.length + data.length;

  const blocks: Block[] = [];
  if (wantNetwork)
    blocks.push(
      net.length
        ? { type: "alerts", title: `Network alerts (${net.length})`, items: net.slice(0, MAX_ROWS), more: Math.max(0, net.length - MAX_ROWS) }
        : { type: "note", text: "No network alerts. Shipments are moving normally.", tone: "good" }
    );
  if (wantData && md.aiError) blocks.push({ type: "note", text: md.aiError, tone: "warn" });
  if (wantData)
    blocks.push(
      data.length
        ? {
            type: "alerts",
            title: `Data anomalies (${data.length})${md.ai.length ? ` · ${md.ai.length} found by AI` : ""}`,
            items: data.slice(0, MAX_ROWS),
            more: Math.max(0, data.length - MAX_ROWS),
          }
        : { type: "note", text: "No anomalies in providers, rates, SOPs, routes or schedules.", tone: "good" }
    );

  return {
    data: {
      count: total,
      alerts: [...net, ...data].slice(0, 40), // combined list (kept for older route.ts versions)
      network_alerts: net.slice(0, 30),
      data_anomalies: data.slice(0, 30),
      ai_anomaly_detection: md.aiEnabled ? "on (Groq)" : "off (no GROQ_API_KEY)",
    },
    blocks,
    suggestions: ["Exceptions", "Delayed Shipments", "View Providers"],
  };
}

async function listExceptions(args: { kind?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  let items = computeExceptions(snap);
  if (args.kind) items = items.filter((e) => norm(e.kind).includes(norm(args.kind)));
  const byKind = items.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {});
  return {
    data: { count: items.length, by_kind: byKind, exceptions: items.slice(0, 40) },
    blocks: items.length
      ? [{ type: "alerts", title: `Exceptions (${items.length})`, items: items.slice(0, MAX_ROWS), more: Math.max(0, items.length - MAX_ROWS) }]
      : [{ type: "note", text: "No exceptions found.", tone: "good" }],
    suggestions: ["Alerts", "Network Overview"],
  };
}

async function listRoutes(args: { search?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  let routes = snap.routes;
  if (args.search) {
    const q = args.search.toLowerCase();
    routes = routes.filter((r) => [r.code, r.name, r.origin, r.destination].filter(Boolean).join(" ").toLowerCase().includes(q));
  }
  const rows = routes.map((r) => {
    const ships = snap.shipments.filter((s) => s.route?.id === r.id);
    const perf = performanceOf(ships);
    const provider = snap.providers.find((p) => p.id === r.providerId);
    return { r, perf, provider };
  });
  const shown = rows.slice(0, MAX_ROWS);
  return {
    data: rows.map(({ r, perf, provider }) => ({
      route: r.code ?? r.name,
      origin: r.origin,
      destination: r.destination,
      mode: r.mode,
      provider: provider?.name ?? null,
      ...perfBrief(perf),
    })),
    blocks: rows.length
      ? [
          {
            type: "table",
            title: `Routes (${rows.length})`,
            columns: ["Route", "Origin → Destination", "Mode", "Provider", "Trips", "On-time"],
            rows: shown.map(({ r, perf, provider }) => [
              r.code ?? r.name,
              `${r.origin ?? "?"} → ${r.destination ?? "?"}`,
              r.mode ?? "—",
              provider?.name ?? "—",
              String(perf.total),
              pct(perf.onTimeRate),
            ]),
            tones: shown.map(({ perf }) => (perf.delayedNow ? "bad" : rateTone(perf.onTimeRate))),
            more: Math.max(0, rows.length - shown.length),
          },
        ]
      : [{ type: "note", text: "No routes match that." }],
  };
}

/** Routes and schedules with problems, read live (distance, transit time, status, provider, timing). */
async function networkProblems(args: { search?: string }): Promise<ToolResult> {
  const input = await buildScanInput();
  const q = (args.search ?? "").trim().toLowerCase();
  const match = (r: Row) => !q || Object.values(r).filter((v) => typeof v === "string").join(" ").toLowerCase().includes(q);

  const allRoutes = (input.routes ?? []) as Row[];
  const routes = allRoutes.filter((r) => flagsOf(r).length && match(r));
  const schedules = ((input.schedules ?? []) as Row[]).filter((s) => flagsOf(s).length && match(s));

  const blocks: Block[] = [
    {
      type: "stats",
      title: "Routes and schedules right now",
      items: [
        { label: "Routes", value: String(allRoutes.length) },
        { label: "Routes with problems", value: String(routes.length), tone: routes.length ? "bad" : "good" },
        { label: "Schedules with problems", value: String(schedules.length), tone: schedules.length ? "bad" : "good" },
      ],
    },
  ];
  if (routes.length)
    blocks.push({
      type: "table",
      title: `Routes with problems (${routes.length})`,
      columns: ["Route", "Origin → Destination", "Provider", "Problems"],
      rows: routes.slice(0, MAX_ROWS).map((r) => [
        String(r.route_code ?? r.route_name ?? "Route"),
        `${r.origin ?? "?"} → ${r.destination ?? "?"}`,
        String(r.provider ?? "—"),
        flagsOf(r).join("; "),
      ]),
      tones: routes.slice(0, MAX_ROWS).map(() => "bad" as Tone),
      more: Math.max(0, routes.length - MAX_ROWS),
    });
  if (schedules.length)
    blocks.push({
      type: "table",
      title: `Schedules with problems (${schedules.length})`,
      columns: ["Schedule", "Route", "Status", "Problems"],
      rows: schedules.slice(0, MAX_ROWS).map((s) => [
        String(s.schedule_code ?? "Schedule"),
        String(s.route ?? "—"),
        String(s.status ?? "—"),
        flagsOf(s).join("; "),
      ]),
      tones: schedules.slice(0, MAX_ROWS).map(() => "bad" as Tone),
      more: Math.max(0, schedules.length - MAX_ROWS),
    });
  if (!routes.length && !schedules.length)
    blocks.push({ type: "note", text: "No problems found in routes or schedules.", tone: "good" });

  return {
    data: {
      routes_total: allRoutes.length,
      routes_with_problems: routes.slice(0, 40).map((r) => ({
        route: r.route_code,
        name: r.route_name,
        origin: r.origin,
        destination: r.destination,
        mode: r.mode,
        provider: r.provider ?? null,
        status: r.status,
        distance_km: r.distance_km ?? null,
        transit_hours: r.eta_hours ?? null,
        problems: flagsOf(r),
      })),
      schedules_with_problems: schedules.slice(0, 40).map((s) => ({
        schedule: s.schedule_code,
        route: s.route ?? null,
        status: s.status,
        planned_departure: s.planned_departure,
        planned_arrival: s.planned_arrival,
        problems: flagsOf(s),
      })),
    },
    blocks,
    suggestions: ["Alerts", "Network Overview", "Delayed Shipments"],
  };
}

function ratesBlocks(res: Awaited<ReturnType<typeof readOptionalTable>>, who?: string): Block[] {
  if (!res.available) return [];
  if (res.error) return [{ type: "note", text: `Couldn't read rates: ${res.error}`, tone: "warn" }];
  if (!res.rows.length) return [{ type: "note", text: `No rates on file${who ? ` for ${who}` : ""}.` }];
  const cols = Object.keys(res.rows[0]).filter((k) => !/^(id|created_at|updated_at|service_provider_id|archived_at)$/.test(k)).slice(0, 6);
  return [
    {
      type: "table",
      title: `Rates${who ? ` · ${who}` : ""}`,
      columns: cols.map((c) => c.replace(/_/g, " ")),
      rows: res.rows.slice(0, MAX_ROWS).map((r) => cols.map((c) => (r[c] == null ? "—" : String(r[c])))),
      more: Math.max(0, res.rows.length - MAX_ROWS),
    },
  ];
}

function docsBlocks(res: Awaited<ReturnType<typeof readOptionalTable>>, who?: string): Block[] {
  if (!res.available) return [];
  if (res.error) return [{ type: "note", text: `Couldn't read documents: ${res.error}`, tone: "warn" }];
  if (!res.rows.length) return [{ type: "note", text: `No documents on file${who ? ` for ${who}` : ""}.` }];
  const now = Date.now();
  const rows = res.rows.slice(0, MAX_ROWS);
  const expiry = (r: Record<string, unknown>) => {
    const v = r.expiry_date ?? r.expires_at ?? r.valid_until ?? r.expiration_date;
    const d = v ? new Date(String(v)) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  return [
    {
      type: "table",
      title: `Documents${who ? ` · ${who}` : ""}`,
      columns: ["Document", "Type", "Expires", "Status"],
      rows: rows.map((r) => {
        const d = expiry(r);
        const status = !d ? "—" : d.getTime() < now ? "Expired" : d.getTime() - now < 30 * 86400_000 ? "Expiring soon" : "Valid";
        return [
          String(r.document_name ?? r.name ?? r.title ?? r.file_name ?? "Document"),
          String(r.document_type ?? r.type ?? "—"),
          d ? d.toLocaleDateString("en-PH") : "—",
          status,
        ];
      }),
      tones: rows.map((r) => {
        const d = expiry(r);
        if (!d) return null;
        return d.getTime() < now ? "bad" : d.getTime() - now < 30 * 86400_000 ? "warn" : "good";
      }),
      more: Math.max(0, res.rows.length - rows.length),
    },
  ];
}

async function providerRates(args: { provider?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const p = args.provider ? findProvider(snap, args.provider) : null;
  const res = await readOptionalTable("ASSISTANT_RATES_TABLE", "provider_rates", p?.id);
  if (!res.available)
    return {
      data: { error: "Rates are not set up in this system yet (no provider_rates table)." },
      blocks: [{ type: "note", text: "Rates aren't set up yet. Add a `provider_rates` table to enable this.", tone: "warn" }],
    };
  return { data: { provider: p?.name ?? "all", rates: res.rows.slice(0, 40) }, blocks: ratesBlocks(res, p?.name) };
}

async function providerDocuments(args: { provider?: string }): Promise<ToolResult> {
  const snap = await loadSnapshot();
  const p = args.provider ? findProvider(snap, args.provider) : null;
  const res = await readOptionalTable("ASSISTANT_DOCUMENTS_TABLE", "provider_documents", p?.id);
  if (!res.available)
    return {
      data: { error: "Documents are not set up in this system yet (no provider_documents table)." },
      blocks: [{ type: "note", text: "Documents aren't set up yet. Add a `provider_documents` table to enable this.", tone: "warn" }],
    };
  return { data: { provider: p?.name ?? "all", documents: res.rows.slice(0, 40) }, blocks: docsBlocks(res, p?.name) };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

type ToolDef = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (args: Record<string, string>) => Promise<ToolResult>;
};

export const TOOLS: ToolDef[] = [
  {
    name: "network_overview",
    description: "Snapshot of the whole logistics network: provider counts, active/delayed shipments, on-time rate, alerts, exceptions, routes with delays.",
    input_schema: { type: "object", properties: {} },
    run: () => networkOverview(),
  },
  {
    name: "list_providers",
    description: "List service providers (carriers, freight forwarders, customs brokers) with performance: trips, active, on-time %, delayed now. Sorted best first.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter: carrier, freight_forwarder, customs_broker, or all" },
        search: { type: "string", description: "Text search on name/type/contact" },
      },
    },
    run: (a) => listProviders(a),
  },
  {
    name: "provider_details",
    description: "Full profile of one provider: contact, performance score, on-time rate, assigned routes and shipments, rates and documents.",
    input_schema: {
      type: "object",
      properties: { provider: { type: "string", description: "Provider name (partial is fine) or id" } },
      required: ["provider"],
    },
    run: (a) => providerDetails({ provider: a.provider }),
  },
  {
    name: "list_shipments",
    description: "List shipments/trips. Filter by status (active, delayed, delivered, pending, cancelled, all), provider, or text (trip code, plate, driver, cargo, place).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        provider: { type: "string" },
        search: { type: "string" },
      },
    },
    run: (a) => listShipments(a),
  },
  {
    name: "shipment_details",
    description: "Details and checkpoint history of one shipment by trip code (e.g. TRP-0001) or plate number.",
    input_schema: { type: "object", properties: { trip: { type: "string" } }, required: ["trip"] },
    run: (a) => shipmentDetails({ trip: a.trip }),
  },
  {
    name: "list_alerts",
    description:
      "Open alerts. Network alerts: delays, overdue arrivals, no tracking update, overloads, delayed schedules. Data anomalies in providers/rates/SOPs: expired or expiring rates, price outliers, overdue SOP reviews, low ratings, missing contacts, rates on inactive providers, plus AI-detected anomalies (duplicates, inconsistent codes, placeholder names, contradictions). Also route and schedule problems found live: routes with no or inactive provider, missing or impossible distance and transit time, duplicate routes, schedules whose arrival passed, never started, or with no or inactive route.",
    input_schema: {
      type: "object",
      properties: {
        severity: { type: "string", description: "high, medium or low" },
        category: { type: "string", description: "network, data, or all (default)" },
      },
    },
    run: (a) => listAlerts(a),
  },
  {
    name: "list_exceptions",
    description: "Process/data exceptions: cancellations, late deliveries, trips without schedule or provider, odometer errors, trips that never departed.",
    input_schema: { type: "object", properties: { kind: { type: "string" } } },
    run: (a) => listExceptions(a),
  },
  {
    name: "list_routes",
    description: "Routes with origin/destination, mode, assigned provider and on-time performance.",
    input_schema: { type: "object", properties: { search: { type: "string" } } },
    run: (a) => listRoutes(a),
  },
  {
    name: "network_problems",
    description:
      "Live check of the network setup: routes with problems (no provider, inactive provider, same origin and destination, missing or impossible distance or transit time, duplicate code or lane) and schedules with problems (arrival passed but not completed, never started, delayed, no route or inactive route). Use for questions like which routes have no provider, which schedules are late, or what is wrong with the routes.",
    input_schema: { type: "object", properties: { search: { type: "string", description: "Optional text filter, e.g. a route code or provider name" } } },
    run: (a) => networkProblems(a),
  },
  {
    name: "provider_rates",
    description: "Rates on file, optionally for one provider.",
    input_schema: { type: "object", properties: { provider: { type: "string" } } },
    run: (a) => providerRates(a),
  },
  {
    name: "provider_documents",
    description: "Provider documents (permits, accreditation, insurance, contracts) with expiry status, optionally for one provider.",
    input_schema: { type: "object", properties: { provider: { type: "string" } } },
    run: (a) => providerDocuments(a),
  },
];

export async function runTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { data: { error: `Unknown tool ${name}` }, blocks: [] };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(args ?? {})) if (v != null && v !== "") clean[k] = String(v);
  return tool.run(clean);
}