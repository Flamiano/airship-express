// One AI anomaly scan, shared by the dashboard (/api/anomaly-detect) and the assistant.
// Keeps Groq usage low so you stay under its rate limits:
//   - Results are cached for 10 minutes per data snapshot, so the dashboard, the assistant and
//     every open browser tab reuse one scan instead of each calling Groq.
//   - Identical scans running at the same time share one request.
//   - On 429 it switches to another Groq model (each has its own quota, see groq.ts). Only if every
//     model is rate-limited does it return the last good result, marked stale, plus when to retry.
//   - The request is kept under Groq's tokens-per-minute limit (free tier: 8,000 per request
//     INCLUDING the reply budget). The data is sent as compact tables with short record ids
//     (P1, R1, S1, T1, RT1, SH1 instead of long UUIDs) and, if it is still too big, the least important
//     rows are left out (flagged / open records are always kept first). On a 413 "Request too
//     large" it reads the real limit from Groq's message and retries once with less data.

import { createHash } from "crypto";
import { ANOMALY_SYSTEM_PROMPT, parseAnomalyReply, type RawAnomaly } from "./AnomalyPrompt";
import { groqRequest } from "./groq";

const CACHE_MS = Number(process.env.ASSISTANT_ANOMALY_CACHE_MINUTES || 10) * 60_000;
// Groq tokens-per-minute limit for your plan/model (free on_demand tier: 8000)
const TPM_LIMIT = Number(process.env.GROQ_TPM_LIMIT || 8000);
// Room for the AI's reply. Groq counts this against the limit too, so keep it modest.
const MAX_OUTPUT_TOKENS = Number(process.env.ASSISTANT_ANOMALY_MAX_TOKENS || 2200);
const SAFETY_TOKENS = 400; // estimates aren't exact; leave some slack
const MAX_TEXT_CHARS = 120; // long remarks / titles are cut to this

export type ScanInput = {
  today: string;
  now?: string;
  providers: unknown[];
  rates: unknown[];
  sops: unknown[];
  trips?: unknown[];
  routes?: unknown[]; // network routes, with automatic pre-check flags
  schedules?: unknown[]; // only schedules that have a problem (flags)
};
export type ScanResult = {
  anomalies: RawAnomaly[];
  cached?: boolean;
  stale?: boolean; // showing the previous result because a fresh scan failed
  error?: string;
  retryAfter?: number; // seconds until it's worth trying again
  note?: string; // e.g. "Scanned 180 of 240 records (Groq request size limit)"
};

const fmtWait = (sec: number) => (sec >= 90 ? `${Math.round(sec / 60)} min` : `${sec}s`);

// Rough token count (JSON-ish text is ~3–3.5 characters per token); errs on the high side.
const estTokens = (s: string) => Math.ceil(s.length / 3);

type Entry = { at: number; anomalies: RawAnomaly[]; note?: string };
const cache = new Map<string, Entry>();
let lastGood: Entry | null = null;
const inFlight = new Map<string, Promise<ScanResult>>();
// If Groq says the real limit is lower than TPM_LIMIT, remember it
let learnedLimit: number | null = null;

/* ---------------- Compact payload ---------------- */

type Rec = Record<string, unknown>;
type SectionKey = "providers" | "rates" | "sops" | "trips" | "routes" | "schedules";
const SECTIONS: { key: SectionKey; prefix: string }[] = [
  { key: "providers", prefix: "P" },
  { key: "rates", prefix: "R" },
  { key: "sops", prefix: "S" },
  { key: "trips", prefix: "T" },
  { key: "routes", prefix: "RT" },
  { key: "schedules", prefix: "SH" },
];

function cleanValue(v: unknown): unknown {
  if (v === null || v === undefined || v === "") return undefined;
  if (Array.isArray(v)) {
    const parts = v.map((x) => String(x)).filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }
  if (typeof v === "boolean" || typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.length > MAX_TEXT_CHARS ? `${s.slice(0, MAX_TEXT_CHARS - 1)}…` : s;
}

function cleanRows(rows: unknown[]): Rec[] {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const o: Rec = {};
      for (const [k, v] of Object.entries((r ?? {}) as Rec)) {
        const c = cleanValue(v);
        if (c !== undefined) o[k] = c;
      }
      return o;
    })
    .sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? ""))); // stable order → stable cache key
}

// Higher = more important to keep when the request has to be trimmed
function priority(key: SectionKey, r: Rec) {
  let p = 0;
  if (r.flags) p += 10; // automatic pre-check found something
  if (key === "trips") {
    if (!r.delivered_at) p += 5; // open trips can be late
    if (r.last_status === "delayed") p += 5;
  }
  if (key === "rates") {
    const s = String(r.status ?? "").toLowerCase();
    if (s && s !== "active") p += 3;
    if (r.valid_to) p += 1;
  }
  if (key === "sops" && r.has_content === false) p += 3;
  // Schedules are only sent when they have a problem, so they are always worth keeping.
  // Routes without flags are the first rows to be left out when the request is too big.
  if (key === "schedules") p += 2;
  if (r.status === "archived") p -= 5;
  return p;
}

type Compact = { text: string; aliasToId: Map<string, string>; sent: number; total: number };

/** Builds the user message. `keep[key]` = how many rows of that section to include (most important first). */
function buildPayload(input: ScanInput, sections: Record<SectionKey, Rec[]>, keep: Record<SectionKey, number>): Compact {
  const aliasToId = new Map<string, string>();
  const tables: Record<string, { cols: string[]; rows: unknown[][]; omitted?: number }> = {};
  let sent = 0;
  let total = 0;

  for (const { key, prefix } of SECTIONS) {
    const all = sections[key];
    total += all.length;
    const rows = all.slice(0, keep[key]);
    sent += rows.length;

    // A section with no records at all (e.g. no problem schedules) is left out completely
    if (all.length === 0) continue;

    // Columns: id first, then every field that appears in any row
    const cols = ["id"];
    for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);

    tables[key] = {
      cols,
      rows: rows.map((r, i) => {
        const alias = `${prefix}${i + 1}`;
        if (r.id !== undefined) aliasToId.set(alias, String(r.id));
        return cols.map((c) => (c === "id" ? alias : r[c] ?? null));
      }),
      ...(all.length > rows.length ? { omitted: all.length - rows.length } : {}),
    };
  }

  const text =
    "DATA FORMAT: each list below is a table. \"cols\" are the field names and every entry in \"rows\" is one record " +
    "with values in the same order (null = empty). Record ids are short codes (P1 = provider, R1 = rate, S1 = SOP, RT1 = route, SH1 = schedule, " +
    "T1 = trip); whenever you return a record id, use that short code exactly. In titles and descriptions refer to " +
    "records by their name or code (e.g. rate_code, sop_code, trip_code, route_code, schedule_code), never by the short id. " +
    "\"omitted\" = lower-priority records left out to keep the request small; don't report anything about them.\n" +
    JSON.stringify({ today: input.today, now: input.now, ...tables });

  return { text, aliasToId, sent, total };
}

/** Fits the data into `inputBudget` tokens, dropping the least important rows first. */
function compactInput(input: ScanInput, inputBudget: number): Compact {
  const sections = {} as Record<SectionKey, Rec[]>;
  for (const { key } of SECTIONS) {
    const rows = cleanRows((input[key] as unknown[]) ?? []);
    // most important first (stable: ties keep id order)
    sections[key] = rows
      .map((r, i) => ({ r, i, p: priority(key, r) }))
      .sort((a, b) => b.p - a.p || a.i - b.i)
      .map((x) => x.r);
  }

  const keep = {} as Record<SectionKey, number>;
  for (const { key } of SECTIONS) keep[key] = sections[key].length;

  let out = buildPayload(input, sections, keep);
  // Too big? Take rows off the biggest section (least important first) until it fits.
  while (estTokens(out.text) > inputBudget) {
    const biggest = SECTIONS.map((s) => s.key)
      .filter((k) => keep[k] > 0)
      .sort((a, b) => keep[b] - keep[a])[0];
    if (!biggest) break;
    keep[biggest] = Math.max(0, keep[biggest] - Math.max(1, Math.ceil(keep[biggest] * 0.1)));
    out = buildPayload(input, sections, keep);
  }
  return out;
}

/** Puts the real record ids back (only exact matches like "R3", never inside sentences). */
function restoreIds<T>(value: T, aliasToId: Map<string, string>): T {
  if (typeof value === "string") return (aliasToId.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map((v) => restoreIds(v, aliasToId)) as T;
  if (value && typeof value === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) o[k] = restoreIds(v, aliasToId);
    return o as T;
  }
  return value;
}

function inputBudgetFor(limit: number) {
  return limit - MAX_OUTPUT_TOKENS - estTokens(ANOMALY_SYSTEM_PROMPT) - SAFETY_TOKENS;
}

/* ---------------- Groq call ---------------- */

type GroqOutcome =
  | { ok: true; anomalies: RawAnomaly[] }
  | { ok: false; status: number; waitMs: number | null; error: string };

async function callGroq(payload: string): Promise<GroqOutcome> {
  // groqRequest moves to another Groq model when one is rate-limited (each model has its own quota).
  const r = await groqRequest({
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANOMALY_SYSTEM_PROMPT },
      { role: "user", content: payload },
    ],
  });
  if (!r.ok) return r;
  return { ok: true, anomalies: parseAnomalyReply(r.data.choices?.[0]?.message?.content ?? "") };
}

// "… Limit 8000, Requested 12013 …" → { limit: 8000, requested: 12013 }
function parseTooLarge(error: string) {
  const m = /Limit\s+(\d+),\s*Requested\s+(\d+)/i.exec(error || "");
  return m ? { limit: Number(m[1]), requested: Number(m[2]) } : null;
}

/**
 * cachedOnly: never call Groq; return the cached (or last good) result, or nothing.
 * Used where waiting on the AI would slow things down, e.g. the assistant's Network Overview.
 */
export async function scanAnomalies(input: ScanInput, opts: { cachedOnly?: boolean } = {}): Promise<ScanResult> {
  if (!process.env.GROQ_API_KEY) return { anomalies: [], error: "Missing GROQ_API_KEY" };

  const limit = learnedLimit ?? TPM_LIMIT;
  const budget = inputBudgetFor(limit);
  if (budget < 500) {
    return {
      anomalies: [],
      error: `ASSISTANT_ANOMALY_MAX_TOKENS (${MAX_OUTPUT_TOKENS}) is too big for a ${limit}-token Groq limit. Lower it.`,
    };
  }

  let compact = compactInput(input, budget);
  if (compact.sent === 0 && compact.total > 0) return { anomalies: [], error: "Too much data to scan in one request" };

  const key = createHash("sha1").update(compact.text).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { anomalies: hit.anomalies, cached: true, ...(hit.note ? { note: hit.note } : {}) };
  if (opts.cachedOnly) return lastGood ? { anomalies: lastGood.anomalies, cached: true, stale: true } : { anomalies: [] };

  const running = inFlight.get(key);
  if (running) return running;

  const job = (async (): Promise<ScanResult> => {
    try {
      let r = await callGroq(compact.text);

      // 413 "Request too large": learn the real limit from Groq and try once more with less data
      if (!r.ok && r.status === 413) {
        const info = parseTooLarge(r.error);
        const newLimit = info ? info.limit : Math.floor(limit * 0.75);
        // also shrink by how far off the estimate was
        const ratio = info ? Math.min(1, info.limit / info.requested) : 0.75;
        learnedLimit = newLimit;
        const retryBudget = Math.min(inputBudgetFor(newLimit), Math.floor(estTokens(compact.text) * ratio * 0.85));
        if (retryBudget >= 500) {
          compact = compactInput(input, retryBudget);
          console.warn(`Groq anomaly scan: request too large, retrying with ${compact.sent}/${compact.total} records`);
          r = await callGroq(compact.text);
        }
      }

      if (r.ok) {
        const anomalies = restoreIds(r.anomalies, compact.aliasToId);
        const note =
          compact.sent < compact.total
            ? `Scanned ${compact.sent} of ${compact.total} records (the most important ones) to stay within the AI's request size limit.`
            : undefined;
        if (note) console.warn(`Groq anomaly scan: ${note}`);
        const entry: Entry = { at: Date.now(), anomalies, note };
        cache.set(key, entry);
        lastGood = entry;
        for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k); // keep the cache small
        return { anomalies, ...(note ? { note } : {}) };
      }

      console.error("Groq anomaly scan failed", r.status, r.error);
      const retryAfter = r.status === 429 ? Math.max(30, Math.ceil((r.waitMs ?? 60_000) / 1000)) : undefined;
      const error =
        r.status === 429
          ? `The AI is busy (Groq rate limit on all models). Trying again in ${fmtWait(retryAfter ?? 60)}.`
          : r.status === 413
          ? "Too much data for the AI's request size limit. Lower ASSISTANT_ANOMALY_MAX_TOKENS or set GROQ_TPM_LIMIT to your plan's limit."
          : `Groq returned ${r.status}`;
      // Better to show the last result than nothing
      if (lastGood) return { anomalies: lastGood.anomalies, stale: true, error, retryAfter };
      return { anomalies: [], error, retryAfter };
    } catch (err) {
      console.error("Groq anomaly scan error", err);
      if (lastGood) return { anomalies: lastGood.anomalies, stale: true, error: "Couldn't reach the AI" };
      return { anomalies: [], error: "Couldn't reach the AI" };
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}