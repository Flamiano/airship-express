// Master-data anomalies for the assistant's Alerts:
//   1) Rule checks: the checks your anomaly-detect prompt says are "already covered"
//      (expired or expiring rates, price outliers, overdue SOP reviews, low ratings,
//      missing contact details, rates on inactive providers).
//   2) AI checks: the same Groq prompt as app/api/anomaly-detect, run on the server
//      and cached so the chat stays fast.
//
// Tables are read straight from Supabase. Change the names with env vars if yours differ:
//   ASSISTANT_RATES_SOURCE (default "rates"), ASSISTANT_SOPS_SOURCE (default "sops")

import { getSupabaseClient } from "../supabase";
import { hasGroq } from "./groq";
import { scanAnomalies } from "./Anomalyscan";
import { buildScanInput } from "./anomalyInput";
import type { Alert, Severity } from "./network";

type Row = Record<string, unknown>;

const RATES_TABLE = process.env.ASSISTANT_RATES_SOURCE || "rates";
const SOPS_TABLE = process.env.ASSISTANT_SOPS_SOURCE || "sops";

const DAY = 86_400_000;

/* ---------- helpers ---------- */

/**
 * Link that opens the page and red-highlights the record, the same way your anomaly alerts do:
 *   /spnc/app/service-providers?highlight=<id>&field=<field>&highlightName=<name>
 */
export function fixHref(href: string, id: unknown, field?: string | null, name?: string | null) {
  const [base, existing = ""] = href.split("?");
  const q = new URLSearchParams(existing); // keeps e.g. ?requests=1
  if (id != null && String(id).trim()) q.set("highlight", String(id).trim());
  if (field) q.set("field", field);
  if (name) q.set("highlightName", name);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

async function readTable(table: string): Promise<{ ok: boolean; rows: Row[] }> {
  const { data, error } = await getSupabaseClient().from(table).select("*").limit(2000);
  if (error) {
    // A missing table isn't an error for the assistant; it just skips those checks.
    if (!/does not exist|could not find the table/i.test(error.message || "") && !["42P01", "PGRST205"].includes(error.code ?? ""))
      console.error(`Assistant anomalies: read ${table} failed:`, error.message);
    return { ok: false, rows: [] };
  }
  const rows = ((data as Row[]) ?? []).filter((r) => !r.archived_at && !r.deleted_at);
  return { ok: true, rows };
}

/* ------------------------------------------------------------------ */
/* Rule checks                                                         */
/* ------------------------------------------------------------------ */

// Same rules and thresholds as buildDataAnomalies() on your dashboard (app/dashboard/page.tsx),
// so the assistant and the dashboard always show the same anomalies.
const DATA_RULES = {
  rateExpiringDays: 7,
  rateOutlierFactor: 3,
  rateOutlierMinPeers: 3,
  sopReviewCriticalDays: 30,
  providerLowRating: 2,
  requestStaleHours: 48,
  requestVeryStaleDays: 7,
};
const REQUEST_STATUSES = ["pending", "declined"];
const isRequestRow = (r: Row) => REQUEST_STATUSES.includes(String(r.status ?? ""));
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", PHP: "₱" };
const CHARGE_TYPE_LABELS: Record<string, string> = {
  per_kg: "Per Kg", per_container: "Per Container", per_km: "Per Km", flat: "Flat", per_pallet: "Per Pallet",
};
const money = (currency: unknown, amount: number) =>
  `${CURRENCY_SYMBOLS[String(currency ?? "")] ?? `${currency ?? ""} `}${Math.round(amount).toLocaleString()}`;
const localDateString = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: process.env.ASSISTANT_TIMEZONE || "Asia/Manila" }); // YYYY-MM-DD
const daysFromToday = (dateStr: string, todayStr: string) =>
  Math.round((Date.parse(`${dateStr.slice(0, 10)}T00:00:00`) - Date.parse(`${todayStr}T00:00:00`)) / DAY);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// Dashboard severities are critical/high/medium; the assistant shows critical as high.
const sevOf = (s: "critical" | "high" | "medium"): Severity => (s === "medium" ? "medium" : "high");

function ruleChecks(providers: Row[], rates: Row[], sops: Row[]): Alert[] {
  const now = new Date();
  const todayStr = localDateString(now);
  const out: Alert[] = [];
  const PROVIDERS = "/spnc/app/service-providers";
  const str = (v: unknown) => (v == null ? "" : String(v));

  // ----- Rates -----
  const officialRates = rates.filter((r) => !isRequestRow(r));
  const providerById = new Map(providers.map((p) => [String(p.id), p]));

  for (const r of officialRates) {
    const code = str(r.rate_code) || "Unnamed rate";
    const validTo = str(r.valid_to);
    if (r.status === "active" && validTo) {
      const days = daysFromToday(validTo, todayStr);
      if (Number.isFinite(days) && days < 0) {
        out.push({
          id: `rate-expired-${r.id}`, kind: "rate_expired", severity: sevOf(-days > 30 ? "critical" : "high"),
          title: `Expired rate still active: ${code}`,
          detail: `Ended ${plural(-days, "day")} ago, still Active.`,
          subject: code, expected: `Valid until ${validTo.slice(0, 10)}`, current: `Ended ${plural(-days, "day")} ago, still Active`,
          href: fixHref("/spnc/app/rates", r.id, "valid_to", code), recordId: String(r.id), field: "valid_to", source: "rules",
        });
      } else if (Number.isFinite(days) && days <= DATA_RULES.rateExpiringDays) {
        const cur = days === 0 ? "Ends today" : `Ends in ${plural(days, "day")}`;
        out.push({
          id: `rate-expiring-${r.id}`, kind: "rate_expiring", severity: sevOf(days <= 2 ? "high" : "medium"),
          title: `Rate expiring soon: ${code}`, detail: `${cur}.`,
          subject: code, expected: `More than ${DATA_RULES.rateExpiringDays} days of validity`, current: cur,
          href: fixHref("/spnc/app/rates", r.id, "valid_to", code), recordId: String(r.id), field: "valid_to", source: "rules",
        });
      }
    }
    if (r.status === "active" && r.service_provider_id) {
      const p = providerById.get(String(r.service_provider_id));
      if (p && p.status !== "active") {
        const pn = str(p.name) || "Provider";
        out.push({
          id: `rate-provider-${r.id}`, kind: "rate_inactive_provider", severity: "high",
          title: `Active rate, inactive provider: ${code}`, detail: `${pn} is ${str(p.status) || "not active"}.`,
          subject: code, expected: "Provider is Active", current: `${pn} is ${str(p.status) || "not active"}`,
          providerName: pn,
          href: fixHref(PROVIDERS, p.id, "status", pn), recordId: String(p.id), field: "status", source: "rules",
        });
      }
    }
  }

  // Price outliers vs the median of rates with the same charge type + currency
  const groups = new Map<string, Row[]>();
  for (const r of officialRates) {
    const amt = Number(r.base_rate);
    if (r.status === "expired" || !amt || amt <= 0) continue;
    const key = `${str(r.charge_type)}|${str(r.currency)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const list of groups.values()) {
    if (list.length < DATA_RULES.rateOutlierMinPeers) continue;
    const sorted = list.map((r) => Number(r.base_rate)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (median <= 0) continue;
    for (const r of list) {
      const ratio = Number(r.base_rate) / median;
      const off = Math.max(ratio, 1 / ratio);
      if (off < DATA_RULES.rateOutlierFactor) continue;
      const label = CHARGE_TYPE_LABELS[str(r.charge_type)] ?? str(r.charge_type);
      const code = str(r.rate_code) || "Unnamed rate";
      const cur = `${money(r.currency, Number(r.base_rate))} · ${off.toFixed(1)}× ${ratio > 1 ? "higher" : "lower"}`;
      out.push({
        id: `rate-outlier-${r.id}`, kind: "rate_outlier", severity: sevOf(off >= 5 ? "critical" : "high"),
        title: `Unusual rate amount: ${code}`, detail: `${cur} than the median.`,
        subject: code, expected: `About ${money(r.currency, median)} (median of ${list.length} ${label} rates)`, current: cur,
        href: fixHref("/spnc/app/rates", r.id, "base_rate", code), recordId: String(r.id), field: "base_rate", source: "rules",
      });
    }
  }

  // ----- SOPs -----
  for (const sp of sops) {
    const rd = str(sp.review_date);
    if (sp.status !== "published" || !rd) continue;
    const days = daysFromToday(rd, todayStr);
    if (!Number.isFinite(days) || days >= 0) continue;
    const subject = [str(sp.sop_code), str(sp.title)].filter(Boolean).join(" · ") || "Untitled SOP";
    out.push({
      id: `sop-review-${sp.id}`, kind: "sop_review_overdue", severity: sevOf(-days >= DATA_RULES.sopReviewCriticalDays ? "high" : "medium"),
      title: `SOP review overdue: ${subject}`, detail: `Overdue by ${plural(-days, "day")}.`,
      subject, expected: `Reviewed by ${rd.slice(0, 10)}`, current: `Overdue by ${plural(-days, "day")}`,
      href: fixHref("/spnc/app/sops", sp.id, "review_date", subject), recordId: String(sp.id), field: "review_date", source: "rules",
    });
  }

  // ----- Service providers -----
  for (const p of providers) {
    if (p.status !== "active") continue;
    const name = str(p.name) || "Unnamed provider";
    const rating = p.rating === null || p.rating === undefined || p.rating === "" ? null : Number(p.rating);
    if (rating != null && Number.isFinite(rating) && rating <= DATA_RULES.providerLowRating) {
      out.push({
        id: `provider-rating-${p.id}`, kind: "provider_low_rating", severity: sevOf(rating <= 1 ? "high" : "medium"),
        title: `Low-rated provider: ${name}`, detail: `${rating}/5 rating.`, providerName: name,
        subject: name, expected: `Above ${DATA_RULES.providerLowRating}/5`, current: `${rating}/5 rating`,
        href: fixHref(PROVIDERS, p.id, "rating", name), recordId: String(p.id), field: "rating", source: "rules",
      });
    }
    if (!str(p.email).trim() && !str(p.phone).trim()) {
      out.push({
        id: `provider-contact-${p.id}`, kind: "provider_missing_contact", severity: "medium",
        title: `Provider has no contact: ${name}`, detail: "No email and no phone.", providerName: name,
        subject: name, expected: "Email or phone on file", current: "No email and no phone",
        href: fixHref(PROVIDERS, p.id, "email", name), recordId: String(p.id), field: "email", source: "rules",
      });
    }
  }

  // ----- Requests waiting too long -----
  const sources = [
    { module: "Service Providers", base: "/spnc/app/service-providers?requests=1", highlight: true, rows: providers.map((p) => ({ id: p.id, label: str(p.name) || "Unnamed", created_at: p.created_at, status: p.status })) },
    { module: "Rates", base: "/spnc/app/rates", highlight: false, rows: rates.map((r) => ({ id: r.id, label: str(r.rate_code) || "Unnamed", created_at: r.created_at, status: r.status })) },
    { module: "SOPs", base: "/spnc/app/sops", highlight: false, rows: sops.map((x) => ({ id: x.id, label: str(x.title) || str(x.sop_code) || "Untitled", created_at: x.created_at, status: x.status })) },
  ];
  for (const src of sources) {
    for (const row of src.rows) {
      if (row.status !== "pending" || !row.created_at) continue;
      const sent = Date.parse(String(row.created_at));
      if (!Number.isFinite(sent)) continue;
      const hours = (now.getTime() - sent) / 3_600_000;
      if (hours < DATA_RULES.requestStaleHours) continue;
      const days = Math.floor(hours / 24);
      const subject = `${src.module} · ${row.label}`;
      let href = src.base;
      if (src.highlight) {
        const q = new URLSearchParams({ highlight: String(row.id), highlightName: row.label });
        href = `${src.base}&${q}`;
      }
      out.push({
        id: `request-stale-${src.module}-${row.id}`, kind: "request_stale", severity: sevOf(days >= DATA_RULES.requestVeryStaleDays ? "high" : "medium"),
        title: `Request waiting too long: ${subject}`, detail: `Waiting ${plural(days, "day")} for approval.`,
        subject, expected: `Reviewed within ${DATA_RULES.requestStaleHours / 24} days`, current: `Waiting ${plural(days, "day")}`,
        href, recordId: src.highlight ? String(row.id) : undefined, source: "rules",
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* AI checks (Groq)                                                    */
/* ------------------------------------------------------------------ */

/** Which page a record lives on when the model didn't say. */
function guessPage(a: { recordId?: string }) {
  const id = String(a.recordId ?? "");
  if (lastIds.rates.has(id)) return "/spnc/app/rates";
  if (lastIds.sops.has(id)) return "/spnc/app/sops";
  if (lastIds.routes.has(id)) return "/spnc/app/routes";
  if (lastIds.schedules.has(id)) return "/spnc/app/schedules";
  return "/spnc/app/service-providers";
}
const lastIds = {
  rates: new Set<string>(),
  sops: new Set<string>(),
  trips: new Set<string>(),
  routes: new Set<string>(),
  schedules: new Set<string>(),
};

let lastAiError: string | null = null;

async function aiChecks(mode: "run" | "cached-only"): Promise<Alert[]> {
  if (!hasGroq()) return [];
  // Same server-built input as the dashboard's /api/anomaly-detect → one shared, cached scan.
  const input = await buildScanInput();
  lastIds.rates = new Set((input.rates as Row[]).map((r) => String(r.id)));
  lastIds.sops = new Set((input.sops as Row[]).map((r) => String(r.id)));
  lastIds.trips = new Set(((input.trips ?? []) as Row[]).map((r) => String(r.id)));
  lastIds.routes = new Set(((input.routes ?? []) as Row[]).map((r) => String(r.id)));
  lastIds.schedules = new Set(((input.schedules ?? []) as Row[]).map((r) => String(r.id)));

  const result = await scanAnomalies(input, { cachedOnly: mode === "cached-only" });
  lastAiError = result.error ?? null;

  return result.anomalies.map((a, i) => {
    const subject = a.subject ?? "Record";
    const isTrip = a.type === "delivery_delay" || a.type === "location_gap" || lastIds.trips.has(a.recordId ?? "");
    return {
      id: `ai-${a.key ?? i}`,
      severity: (a.severity === "critical" || a.severity === "high" ? "high" : "medium") as Severity,
      kind: a.type ?? "ai_detected",
      title: a.title ? `${a.title}: ${subject}` : `${subject}${a.field ? `: ${a.field.replace(/_/g, " ")}` : ""} looks wrong`,
      detail: `${a.current ?? ""}${a.expected ? ` (expected: ${a.expected})` : ""}`,
      subject,
      expected: a.expected,
      current: a.current,
      href: isTrip ? fixHref("/spnc/app/schedules", a.recordId, a.field ?? null, subject) : fixHref(a.href ?? guessPage(a), a.recordId, a.href?.includes("requests=1") ? null : a.field ?? null, subject),
      field: a.field,
      recordId: a.recordId,
      shipmentId: isTrip ? a.recordId : undefined, // lets the assistant open the live map
      source: "ai",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

/**
 * Master-data alerts, found by the AI (same prompt as the dashboard's /api/anomaly-detect).
 * mode "run": call Groq if the cache is stale (Alerts quick action).
 * mode "cached-only": never wait on Groq (Network Overview counts).
 */
export async function masterDataAlerts(
  providers: Row[],
  mode: "run" | "cached-only" = "run"
): Promise<{ rules: Alert[]; ai: Alert[]; aiEnabled: boolean; aiError: string | null }> {
  const [rates, sops] = await Promise.all([readTable(RATES_TABLE), readTable(SOPS_TABLE)]);
  const activeProviders = providers.filter((p) => !p.archived_at && !p.deleted_at);
  // Detection is done by the AI only. Set ASSISTANT_RULE_CHECKS=on to also run the fixed rule checks.
  const rules = process.env.ASSISTANT_RULE_CHECKS === "on" ? ruleChecks(activeProviders, rates.rows, sops.rows) : [];
  const ai = await aiChecks(mode);
  return { rules, ai, aiEnabled: hasGroq(), aiError: lastAiError };
}