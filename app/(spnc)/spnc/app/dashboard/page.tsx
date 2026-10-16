"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Map as MapIcon,
  DollarSign,
  ClipboardList,
  Calendar,
  Loader2,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  Truck,
  MapPinOff,
  Activity,
  CheckCircle2,
  ShieldCheck,
  CalendarX,
  TrendingUp,
  Star,
  Hourglass,
  PhoneOff,
  Link2Off,
  FileWarning,
  Sparkles,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import SpncAssistant from "../../components/SpncAssistant";

const PINK = "#F2419B";
const PINK_SOFT = "#FF8CC6";
const RING_COLORS = ["#F2419B", "#FF6FB1", "#FF8CC6", "#FFB3D9", "#C22A78"];
const PAGE_SIZE = 3;
const ANOMALY_POLL_MS = 60_000; // vehicles report every minute, so poll at the same pace



const getArrayLength = (payload: unknown, key: string) => {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value.length : 0;
  }
  return Array.isArray(payload) ? payload.length : 0;
};

/* ---------- Anomaly alerts: types, rules, sample data ---------- */
type AnomalyType =
  // from /api/anomalies (fleet & network)
  | "delivery_delay"
  | "location_gap"
  | "traffic_spike"
  // worked out on the dashboard from Rates, SOPs and Service Providers (Supabase)
  | "rate_expired"
  | "rate_expiring"
  | "rate_outlier"
  | "rate_inactive_provider"
  | "sop_review_overdue"
  | "provider_low_rating"
  | "provider_missing_contact"
  | "request_stale"
  // found by the AI scan (/api/anomaly-detect)
  | "ai_detected";
type Severity = "critical" | "high" | "medium";

type Anomaly = {
  id: string;
  type: AnomalyType;
  subject: string;        // e.g. TRUCK-024 or a network link name
  expected: string;       // human-readable normal range
  current: string;        // human-readable observed value
  ratio: number;          // how far off normal: observed / normal upper bound
  detectedAt: string;     // ISO timestamp
  severity?: Severity;    // optional: API may supply; otherwise derived from ratio
  href?: string;          // page to open for this alert
  recordId?: string;      // id of the record to highlight on the opened page
  field?: string;         // which field is wrong (e.g. "email") → that column gets a red border
  title?: string;         // short title written by the AI (falls back to the type's title)
};

// Builds the "Open" link: the alert's page plus which record/field to highlight in red,
// e.g. /spnc/app/service-providers?highlight=<id>&field=email
// Keeps any query the href already has (e.g. ?requests=1).
function anomalyLink(a: Pick<Anomaly, "href" | "recordId" | "field" | "subject">) {
  if (!a.href) return null;
  const [path, existing = ""] = a.href.split("?");
  const params = new URLSearchParams(existing);
  if (a.recordId) params.set("highlight", a.recordId);
  if (a.subject) params.set("highlightName", a.subject); // backup: find the row by name if the id doesn't match
  if (a.field) params.set("field", a.field);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// State of one "Ask AI" request, stored per alert id
type AiAdvice = { status: "loading" | "done" | "error"; text?: string };

const ANOMALY_META: Record<AnomalyType, { title: string; subjectLabel: string; source: string; icon: typeof Truck }> = {
  delivery_delay: { title: "Unusual Delivery Delay", subjectLabel: "Vehicle", source: "Fleet", icon: Truck },
  location_gap: { title: "Location Signal Lost", subjectLabel: "Vehicle", source: "Fleet", icon: MapPinOff },
  traffic_spike: { title: "Network Traffic Spike", subjectLabel: "Link", source: "Network", icon: Activity },
  rate_expired: { title: "Expired Rate Still Active", subjectLabel: "Rate", source: "Rates", icon: CalendarX },
  rate_expiring: { title: "Rate Expiring Soon", subjectLabel: "Rate", source: "Rates", icon: Calendar },
  rate_outlier: { title: "Unusual Rate Amount", subjectLabel: "Rate", source: "Rates", icon: TrendingUp },
  rate_inactive_provider: { title: "Active Rate, Inactive Provider", subjectLabel: "Rate", source: "Rates", icon: Link2Off },
  sop_review_overdue: { title: "SOP Review Overdue", subjectLabel: "SOP", source: "SOPs", icon: FileWarning },
  provider_low_rating: { title: "Low-Rated Provider", subjectLabel: "Provider", source: "Service Providers", icon: Star },
  provider_missing_contact: { title: "Provider Has No Contact", subjectLabel: "Provider", source: "Service Providers", icon: PhoneOff },
  request_stale: { title: "Request Waiting Too Long", subjectLabel: "Request", source: "Requests", icon: Hourglass },
  ai_detected: { title: "AI-Detected Anomaly", subjectLabel: "Record", source: "AI", icon: Sparkles },
};

// [critical threshold, high threshold] on `ratio`; anything lower is medium.
// Data-derived alerts set `severity` directly, so they don't need an entry here.
const SEVERITY_RULES: Partial<Record<AnomalyType, [number, number]>> = {
  delivery_delay: [2, 1.5],   // 2x / 1.5x the 3-hour upper bound
  location_gap: [30, 10],     // 30 / 10 missed 1-minute pings
  traffic_spike: [3, 2],      // 3x / 2x normal traffic
};

const SEVERITY_STYLE: Record<Severity, { label: string; color: string; rank: number }> = {
  critical: { label: "Critical", color: "#E11D48", rank: 0 },
  high: { label: "High", color: "#F97316", rank: 1 },
  medium: { label: "Medium", color: "#EAB308", rank: 2 },
};

const severityOf = (a: Anomaly): Severity => {
  if (a.severity) return a.severity;
  const rule = SEVERITY_RULES[a.type];
  if (!rule) return "medium";
  const [crit, high] = rule;
  return a.ratio >= crit ? "critical" : a.ratio >= high ? "high" : "medium";
};

/* ---------- Rows sent to the AI scan ---------- */
// Rows as returned by /api/rates, /api/sops and /api/service-providers (only the fields used here).
type ProviderRow = {
  id: string; name?: string | null; status?: string | null; rating?: number | null;
  email?: string | null; phone?: string | null; created_at?: string | null;
};
type RateRow = {
  id: string; rate_code?: string | null; status?: string | null; valid_from?: string | null; valid_to?: string | null;
  base_rate?: number | null; charge_type?: string | null; currency?: string | null;
  service_provider_id?: string | null; created_at?: string | null;
};
type SopRow = {
  id: string; title?: string | null; sop_code?: string | null; status?: string | null;
  review_date?: string | null; created_at?: string | null;
};

// Rows with these statuses are department requests, not official records.
const REQUEST_STATUSES = ["pending", "declined"];
const isRequestRow = (r: { status?: string | null }) => REQUEST_STATUSES.includes(r.status ?? "");

const getArray = <T,>(payload: unknown, key: string): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, T[]>)[key];
  }
  return [];
};

const localDateString = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD
const AI_TYPES: AnomalyType[] = [
  "delivery_delay", "location_gap",
  "rate_expired", "rate_expiring", "rate_outlier", "rate_inactive_provider", "sop_review_overdue",
  "provider_low_rating", "provider_missing_contact", "request_stale", "ai_detected",
];

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : `${Math.floor(hrs / 24)} d ago`;
};

const ALERT_FLOW = [
  "System Data",
  "AI Anomaly Detection",
  "Anomaly Found",
  "Risk / Severity Analysis",
  "Alert",
  "Admin / Network Controller",
];

/* ---------- Half-circle gauge ---------- */
function Gauge({ percent, value, label, isDark }: {
  percent: number; value: number; label: string; isDark: boolean;
}) {
  const w = 220, h = 130, stroke = 16, r = 90, cx = w / 2, cy = 112;
  const arc = Math.PI * r;
  const offset = arc - (Math.min(Math.max(percent, 0), 100) / 100) * arc;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="relative mx-auto" style={{ width: w, height: h }}>
      <svg width={w} height={h}>
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PINK_SOFT} />
            <stop offset="100%" stopColor={PINK} />
          </linearGradient>
        </defs>
        <path d={d} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={isDark ? "#26262E" : "#F3E6EE"} />
        <path d={d} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke="url(#gauge-grad)" strokeDasharray={arc} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center">
        <span className={`text-4xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </span>
        <span className={`text-xs ${isDark ? "text-[#9A9AA8]" : "text-gray-500"}`}>{label}</span>
      </div>
    </div>
  );
}

/* ---------- Concentric rings ---------- */
function ConcentricRings({ values, total, isDark }: {
  values: number[]; total: number; isDark: boolean;
}) {
  const size = 250, stroke = 11, gap = 6, start = 112;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {values.map((v, i) => {
          const r = start - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const pct = total > 0 ? v / total : 0;
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
                stroke={isDark ? "#22222A" : "#F6ECF1"} />
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
                stroke={RING_COLORS[i % RING_COLORS.length]} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c - pct * c}
                style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "var(--font-display)" }}>
          {total}
        </span>
        <span className={`text-xs ${isDark ? "text-[#9A9AA8]" : "text-gray-500"}`}>total records</span>
      </div>
    </div>
  );
}

/* ---------- Anomaly alert panel ---------- */
const ALERTS_PREVIEW = 6; // cards shown before "Show all"

function AnomalyAlerts({ anomalies, aiScanning, aiError, aiStale, acknowledged, onAcknowledge, isDark, card, heading, muted }: {
  anomalies: Anomaly[];
  aiScanning: boolean;
  aiError: string | null;
  aiStale: boolean;
  acknowledged: Set<string>;
  onAcknowledge: (id: string) => void;
  isDark: boolean;
  card: string;
  heading: string;
  muted: string;
}) {
  const sorted = [...anomalies].sort((a, b) => {
    const ackDiff = Number(acknowledged.has(a.id)) - Number(acknowledged.has(b.id));
    if (ackDiff !== 0) return ackDiff;
    const sevDiff = SEVERITY_STYLE[severityOf(a)].rank - SEVERITY_STYLE[severityOf(b)].rank;
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
  const openCount = anomalies.filter((a) => !acknowledged.has(a.id)).length;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sorted : sorted.slice(0, ALERTS_PREVIEW);

  // AI suggestions, keyed by alert id. Lives here so answers survive the
  // 60-second refresh and each alert is only ever explained once.
  const [advice, setAdvice] = useState<Record<string, AiAdvice>>({});

  const askAi = async (a: Anomaly) => {
    const state = advice[a.id]?.status;
    if (state === "loading" || state === "done") return; // never ask twice

    setAdvice((p) => ({ ...p, [a.id]: { status: "loading" } }));
    try {
      const res = await fetch("/spnc/app/api/anomaly-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: a.title || ANOMALY_META[a.type].title,
          subject: a.subject,
          expected: a.expected,
          current: a.current,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.advice) throw new Error(data.error || "No advice");
      setAdvice((p) => ({ ...p, [a.id]: { status: "done", text: data.advice } }));
    } catch {
      setAdvice((p) => ({ ...p, [a.id]: { status: "error" } }));
    }
  };

  return (
    <div className={`mb-5 rounded-3xl p-6 ${card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`flex flex-wrap items-center gap-2 text-base font-semibold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
            Anomaly alerts
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ background: openCount > 0 ? SEVERITY_STYLE.critical.color : "#22C55E" }}
            >
              {openCount} open
            </span>
            {aiScanning && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isDark ? "bg-[#26262E] text-[#FF8CC6]" : "bg-[#FDE7F1] text-[#F2419B]"
              }`}>
                <Loader2 size={11} className="animate-spin" /> AI scanning…
              </span>
            )}
          </p>
          <p className={`mt-1 text-xs ${muted}`}>
            Problems found by AI in deliveries, rates, SOPs, service providers and pending requests
          </p>
        </div>
      </div>

      {/* Detection flow */}
      <div className="mt-4 mb-5 flex flex-wrap items-center gap-1.5">
        {ALERT_FLOW.map((step, i) => (
          <span key={step} className="flex items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              i === ALERT_FLOW.length - 2
                ? "bg-[#F2419B] text-white"
                : isDark ? "bg-[#1C1C24] text-[#C8C8D2]" : "bg-[#F7F2F5] text-gray-600"
            }`}>
              {step}
            </span>
            {i < ALERT_FLOW.length - 1 && <ChevronRight size={12} className={muted} />}
          </span>
        ))}
      </div>

      {aiError && (
        /rate limit|busy/i.test(aiError) ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#F97316]/10 px-3 py-2 text-xs font-medium text-[#C2410C]">
            <Hourglass size={14} /> {aiError}
            {aiStale && anomalies.length > 0 && " Showing the last results meanwhile."}
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#E11D48]/10 px-3 py-2 text-xs font-medium text-[#E11D48]">
            <AlertTriangle size={14} /> AI scan failed: {aiError}
          </div>
        )
      )}

      {sorted.length === 0 ? (
        aiScanning ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={28} className="animate-spin text-[#F2419B]" />
            <p className={`text-sm font-semibold ${heading}`}>AI is checking your data…</p>
            <p className={`text-xs ${muted}`}>Deliveries, rates, SOPs, service providers and pending requests.</p>
          </div>
        ) : aiError ? null : (
          <div className="flex flex-col items-center gap-2 py-8">
            <ShieldCheck size={28} className="text-[#22C55E]" />
            <p className={`text-sm font-semibold ${heading}`}>All systems normal</p>
            <p className={`text-xs ${muted}`}>The AI found no problems in deliveries, rates, SOPs, service providers or requests.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((a) => {
            const meta = ANOMALY_META[a.type];
            const sev = SEVERITY_STYLE[severityOf(a)];
            const isAck = acknowledged.has(a.id);
            const Icon = meta.icon;
            const ai = advice[a.id];
            return (
              <div
                key={a.id}
                className={`flex flex-col rounded-2xl border-l-4 p-4 transition ${
                  isDark ? "bg-[#1A1A22]" : "bg-[#FCF8FA]"
                } ${isAck ? "opacity-60" : ""}`}
                style={{ borderLeftColor: sev.color }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider" style={{ color: sev.color }}>
                    <AlertTriangle size={14} /> AI · {meta.source.toUpperCase()}
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ background: `${sev.color}22`, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>

                <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${heading}`}>
                  <Icon size={16} className="shrink-0 text-[#F2419B]" /> {a.title || meta.title}
                </p>

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className={muted}>{meta.subjectLabel}</dt>
                  <dd className={`break-words font-semibold ${heading}`}>{a.subject}</dd>
                  <dt className={muted}>Expected</dt>
                  <dd className={heading}>{a.expected}</dd>
                  <dt className={muted}>Current</dt>
                  <dd className="font-semibold" style={{ color: sev.color }}>{a.current}</dd>
                  <dt className={muted}>Status</dt>
                  <dd className={`font-semibold ${heading}`}>{isAck ? "Acknowledged" : "Requires Investigation"}</dd>
                </dl>

                {/* AI suggestion */}
                <div className="mt-3">
                  {ai?.status === "done" ? (
                    <div className={`rounded-xl p-3 text-xs leading-relaxed ${
                      isDark ? "bg-[#14141A] text-[#C8C8D2]" : "bg-white text-gray-600"
                    }`}>
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#F2419B]">
                        <Sparkles size={12} /> AI SUGGESTION
                      </p>
                      {ai.text}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => askAi(a)}
                      disabled={ai?.status === "loading"}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
                        isDark ? "bg-[#26262E] text-[#FF8CC6] hover:bg-[#2E2E38]" : "bg-[#FDE7F1] text-[#F2419B] hover:bg-[#FBD5E7]"
                      }`}
                    >
                      {ai?.status === "loading" ? (
                        <><Loader2 size={12} className="animate-spin" /> Thinking…</>
                      ) : (
                        <><Sparkles size={12} /> {ai?.status === "error" ? "Try again" : "Ask AI"}</>
                      )}
                    </button>
                  )}
                </div>

                <div className={`mt-4 flex items-center justify-between border-t pt-3 ${
                  isDark ? "border-[#24242C]" : "border-gray-100"
                }`}>
                  <span className={`text-[11px] ${muted}`}>Detected {timeAgo(a.detectedAt)}</span>
                  <div className="flex items-center gap-3">
                  {a.href && (
                    <Link href={anomalyLink(a) ?? a.href} suppressHydrationWarning
                      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold transition hover:text-[#F2419B] ${muted}`}>
                      Open <ArrowUpRight size={12} />
                    </Link>
                  )}
                  {isAck ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22C55E]">
                      <CheckCircle2 size={13} /> Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      className="rounded-full px-3 py-1 text-[11px] font-semibold text-white transition hover:brightness-110"
                      style={{ background: `linear-gradient(90deg, ${PINK}, ${PINK_SOFT})` }}
                    >
                      Acknowledge
                    </button>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > ALERTS_PREVIEW && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              isDark ? "bg-[#1C1C24] text-[#C8C8D2] hover:bg-[#26262E]" : "bg-[#F7F2F5] text-gray-600 hover:bg-[#F3E6EE]"
            }`}
          >
            {showAll ? "Show fewer" : `Show all ${sorted.length} alerts`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";

  const [providerCount, setProviderCount] = useState<number | null>(null);
  const [routeCount, setRouteCount] = useState<number | null>(null);
  const [rateCount, setRateCount] = useState<number | null>(null);
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [sopCount, setSopCount] = useState<number | null>(null);

  // Rows from Supabase for the three connected modules (null = still loading)
  const [providerRows, setProviderRows] = useState<ProviderRow[] | null>(null);
  const [rateRows, setRateRows] = useState<RateRow[] | null>(null);
  const [sopRows, setSopRows] = useState<SopRow[] | null>(null);

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Alerts: everything is found by the AI scan of providers, rates, SOPs and requests
  const [aiAnomalies, setAiAnomalies] = useState<Anomaly[]>([]);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [aiStale, setAiStale] = useState(false); // showing the previous scan because the AI is busy
  const [scanNonce, setScanNonce] = useState(0); // bump to force a rescan (used after a rate limit)
  const lastScan = useRef(""); // signature of the last data sent to the AI, so unchanged data isn't rescanned
  const retryTimer = useRef<number | undefined>(undefined);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    const load = (url: string, key: string, set: (n: number) => void) =>
      fetch(url, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => set(getArrayLength(data, key)))
        .catch(() => set(0));

    load("/spnc/app/api/routes", "routes", setRouteCount);
    load("/spnc/app/api/schedules", "schedules", setScheduleCount);
  }, []);

  // Service providers, rates and SOPs: full rows, so the dashboard can count official records,
  // count pending requests, and check them for anomalies. Refreshed every minute with the alerts.
  useEffect(() => {
    let cancelled = false;
    const loadRows = <T,>(url: string, key: string, set: (rows: T[]) => void) =>
      fetch(url, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => { if (!cancelled) set(getArray<T>(data, key)); })
        .catch(() => { if (!cancelled) set([]); });

    const loadAll = () => {
      // ?summary=1 skips heavy columns (attachments are base64 PDFs) that the dashboard doesn't need.
      loadRows<ProviderRow>("/spnc/app/api/service-providers?summary=1", "providers", setProviderRows);
      loadRows<RateRow>("/spnc/app/api/rates", "rates", setRateRows);
      loadRows<SopRow>("/spnc/app/api/sops", "sops", setSopRows);
    };

    loadAll();
    const timer = setInterval(loadAll, ANOMALY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Official records only (pending / declined requests are counted separately)
  useEffect(() => {
    if (providerRows) setProviderCount(providerRows.filter((r) => !isRequestRow(r)).length);
  }, [providerRows]);
  useEffect(() => {
    if (rateRows) setRateCount(rateRows.filter((r) => !isRequestRow(r)).length);
  }, [rateRows]);
  useEffect(() => {
    if (sopRows) setSopCount(sopRows.filter((r) => !isRequestRow(r)).length);
  }, [sopRows]);

  const pendingOf = (rows: { status?: string | null }[] | null) => rows?.filter((r) => r.status === "pending").length ?? 0;
  const pendingProviders = pendingOf(providerRows);
  const pendingRates = pendingOf(rateRows);
  const pendingSops = pendingOf(sopRows);
  const pendingTotal = pendingProviders + pendingRates + pendingSops;

  // AI anomaly detection: sends the module data to /api/anomaly-detect.
  // Only re-runs when the data actually changes, so the 60-second refresh doesn't spend tokens.
  useEffect(() => {
    if (!providerRows || !rateRows || !sopRows) return;

    const signature = JSON.stringify({
      today: localDateString(new Date()),
      providers: providerRows.map(({ id, name, status, rating, email, phone, created_at }) => ({ id, name, status, rating, email, phone, created_at: created_at?.slice(0, 10) })),
      rates: rateRows.map(({ id, rate_code, status, valid_from, valid_to, base_rate, charge_type, currency, service_provider_id, created_at }) => ({ id, rate_code, status, valid_from: valid_from?.slice(0, 10), valid_to: valid_to?.slice(0, 10), base_rate, charge_type, currency, service_provider_id, created_at: created_at?.slice(0, 10) })),
      sops: sopRows.map(({ id, title, sop_code, status, review_date, created_at }) => ({ id, title, sop_code, status, review_date: review_date?.slice(0, 10), created_at: created_at?.slice(0, 10) })),
    });
    if (lastScan.current === signature) return;
    lastScan.current = signature;

    let cancelled = false;
    let finished = false;
    setAiScanning(true);
    window.clearTimeout(retryTimer.current);

    fetch("/spnc/app/api/anomaly-detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: signature,
    })
      .then((r) => r.json())
      .then((data) => {
        finished = true;
        if (cancelled) return;
        setAiDone(true);
        setAiError(data.error ? String(data.error) : null);
        setAiStale(!!data.stale);
        // Groq rate limit: try again by itself after the wait it asked for
        if (typeof data.retryAfter === "number" && data.retryAfter > 0) {
          retryTimer.current = window.setTimeout(() => {
            lastScan.current = "";
            setScanNonce((n) => n + 1);
          }, Math.min(data.retryAfter, 300) * 1000);
        }
        if (!Array.isArray(data.anomalies)) return;
        // Keep what's on screen if this attempt failed and returned nothing
        if (data.error && data.anomalies.length === 0) return;
        const now = new Date().toISOString();
        setAiAnomalies(
          data.anomalies.map((a: any, i: number): Anomaly => ({
            id: `ai-${a.key || i}`,
            type: AI_TYPES.includes(a.type) ? a.type : "ai_detected",
            title: typeof a.title === "string" && a.title ? a.title : undefined,
            subject: String(a.subject ?? "Unknown"),
            expected: String(a.expected ?? ""),
            current: String(a.current ?? ""),
            ratio: 1,
            severity: ["critical", "high", "medium"].includes(a.severity) ? a.severity : "medium",
            detectedAt: now,
            href: typeof a.href === "string" && a.href.startsWith("/spnc/app/") ? a.href : undefined,
            // Which record and field the AI flagged, so "Open" can outline that cell in red.
            recordId: typeof a.recordId === "string" && a.recordId ? a.recordId : undefined,
            field: typeof a.field === "string" && a.field ? a.field : undefined,
          }))
        );
      })
      .catch(() => {
        finished = true;
        if (!cancelled) {
          setAiDone(true);
          setAiError("Couldn't reach the AI. Check your connection or GROQ_API_KEY.");
        }
      })
      .finally(() => { if (!cancelled) setAiScanning(false); });

    return () => {
      cancelled = true;
      // If React tore this effect down before the scan finished (e.g. Strict Mode in dev),
      // clear the signature so the next run isn't skipped.
      if (!finished) lastScan.current = "";
    };
  }, [providerRows, rateRows, sopRows, scanNonce]);

  // Stop a pending retry when leaving the page
  useEffect(() => () => window.clearTimeout(retryTimer.current), []);

  // Deliveries change over time even when rates/SOPs don't, so rescan every 5 minutes.
  // (The server reuses its cached scan when nothing changed, so this doesn't waste AI calls.)
  useEffect(() => {
    const id = window.setInterval(() => {
      lastScan.current = "";
      setScanNonce((n) => n + 1);
    }, 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Only AI-detected alerts (no sample data, no rule checks). Shown once the rows have loaded.
  const allAnomalies = providerRows && rateRows && sopRows ? aiAnomalies : null;

  const acknowledge = (id: string) => {
    setAcknowledged((prev) => new Set(prev).add(id));
  };

  const isLoading =
    providerCount === null ||
    routeCount === null ||
    rateCount === null ||
    scheduleCount === null ||
    sopCount === null;

  const stats = [
    { label: "Service Providers", short: "Providers", desc: "Carriers, forwarders & vendors", value: providerCount ?? 0, pending: pendingProviders, icon: Building2, href: "/spnc/app/service-providers" },
    { label: "Network & Routes", short: "Routes", desc: "Origin-destination planning", value: routeCount ?? 0, pending: 0, icon: MapIcon, href: "/spnc/app/routes" },
    { label: "Rates & Tariffs", short: "Rates", desc: "Pricing & validity", value: rateCount ?? 0, pending: pendingRates, icon: DollarSign, href: "/spnc/app/rates" },
    { label: "SOPs", short: "SOPs", desc: "Standard operating procedures", value: sopCount ?? 0, pending: pendingSops, icon: ClipboardList, href: "/spnc/app/sops" },
    { label: "Schedules", short: "Schedules", desc: "Upcoming departures", value: scheduleCount ?? 0, pending: 0, icon: Calendar, href: "/spnc/app/schedules" },
  ];

  const total = stats.reduce((sum, s) => sum + s.value, 0);
  const max = Math.max(...stats.map((s) => s.value), 1);
  const modulesWithData = stats.filter((s) => s.value > 0).length;
  const coverage = (modulesWithData / stats.length) * 100;
  const largest = stats.reduce((a, b) => (b.value > a.value ? b : a));
  const smallest = stats.reduce((a, b) => (b.value < a.value ? b : a));

  const filtered = stats.filter((s) => s.label.toLowerCase().includes(query.trim().toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const card = isDark
    ? "border border-[#24242C] bg-[#14141A]"
    : "bg-white shadow-[0_10px_30px_-12px_rgba(242,65,155,0.18)]";
  const heading = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-[#9A9AA8]" : "text-gray-500";
  const divider = isDark ? "border-[#24242C]" : "border-gray-100";

  return (
    <div className={`min-h-full pb-8 ${isDark ? "bg-[#0A0A0E]" : "bg-[#F7F2F5]"}`}>
      <PageHeader
        icon={<LayoutDashboard size={20} />}
        title="Dashboard"
        subtitle={`Network Control overview · ${today}`}
        showThemeToggle
      />

      <div className="px-8">
        {/* Anomaly alerts — shown as soon as they load, independent of module counts */}
        {allAnomalies !== null && (
          <AnomalyAlerts
            anomalies={allAnomalies}
            aiScanning={aiScanning || !aiDone}
            aiError={aiError}
            aiStale={aiStale}
            acknowledged={acknowledged}
            onAcknowledge={acknowledge}
            isDark={isDark}
            card={card}
            heading={heading}
            muted={muted}
          />
        )}

        {isLoading ? (
          <div className="mb-10 flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <>
            {/* Row 1: gauge card + rings & table card */}
            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
              {/* Gauge card */}
              <div className={`flex flex-col rounded-3xl p-6 ${card}`}>
                <p className={`text-base font-semibold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
                  Setup progress
                </p>
                <p className={`mt-1 mb-4 text-xs ${muted}`}>Modules with at least one record</p>

                <Gauge percent={coverage} value={total} label="Total records" isDark={isDark} />

                <div className={`mt-5 grid grid-cols-2 gap-4 border-t pt-4 ${divider}`}>
                  <div>
                    <p className={`text-xs ${muted}`}>Largest</p>
                    <p className={`text-2xl font-bold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
                      {largest.value}
                    </p>
                    <p className="text-xs font-semibold text-[#F2419B]">{largest.short}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${muted}`}>Smallest</p>
                    <p className={`text-2xl font-bold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
                      {smallest.value}
                    </p>
                    <p className={`text-xs font-semibold ${muted}`}>{smallest.short}</p>
                  </div>
                </div>

                <Link
                  href={largest.href}
                  suppressHydrationWarning
                  className="mt-5 inline-flex items-center justify-center gap-1 self-center rounded-full px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F2419B]/30 transition hover:brightness-110"
                  style={{ background: `linear-gradient(90deg, ${PINK}, ${PINK_SOFT})` }}
                >
                  Open {largest.short} <ArrowUpRight size={14} />
                </Link>
              </div>

              {/* Rings + table */}
              <div className={`rounded-3xl p-6 ${card}`}>
                <p className={`text-base font-semibold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
                  Records overview
                </p>
                <p className={`mt-1 mb-4 text-xs ${muted}`}>Each ring shows a module's share of all records</p>

                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <ConcentricRings values={stats.map((s) => s.value)} total={total} isDark={isDark} />

                  <div className="w-full min-w-0 flex-1">
                    <div className="relative mb-3 ml-auto w-full max-w-xs">
                      <Search size={14} className={`absolute top-1/2 left-3 -translate-y-1/2 ${muted}`} />
                      <input
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                        placeholder="Search modules"
                        className={`w-full rounded-full py-2 pr-4 pl-9 text-xs outline-none focus:ring-2 focus:ring-[#F2419B]/40 ${
                          isDark ? "bg-[#1C1C24] text-white placeholder:text-[#6B6B78]" : "bg-[#F7F2F5] text-gray-900 placeholder:text-gray-400"
                        }`}
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className={`text-xs ${muted}`}>
                            <th className="pb-2 font-medium">Module</th>
                            <th className="pb-2 font-medium">Records</th>
                            <th className="pb-2 font-medium">Requests</th>
                            <th className="pb-2 font-medium">Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((s) => {
                            const idx = stats.indexOf(s);
                            return (
                              <tr key={s.label} className={`border-t ${divider}`}>
                                <td className="py-3">
                                  <span className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: RING_COLORS[idx % RING_COLORS.length] }} />
                                    <span className={`font-semibold ${heading}`}>{s.label}</span>
                                  </span>
                                </td>
                                <td className={`py-3 font-semibold ${heading}`}>{s.value}</td>
                                <td className="py-3">
                                  {s.pending > 0 ? (
                                    <span className="rounded-full bg-[#E5484D] px-2 py-0.5 text-[11px] font-bold text-white">
                                      {s.pending} pending
                                    </span>
                                  ) : (
                                    <span className={`text-xs ${muted}`}>—</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  <Link href={s.href} suppressHydrationWarning
                                    className={`inline-flex items-center gap-1 text-xs transition hover:text-[#F2419B] ${muted}`}>
                                    <Eye size={14} /> See detail
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                          {pageRows.length === 0 && (
                            <tr><td colSpan={4} className={`py-6 text-center text-xs ${muted}`}>No modules match "{query}".</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-1">
                      <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}
                        className={`p-1 disabled:opacity-30 ${muted}`} aria-label="Previous page">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                        <button key={n} onClick={() => setPage(n)}
                          className={`h-6 w-6 rounded-md text-xs font-semibold ${
                            n === safePage ? "bg-[#F2419B] text-white" : muted
                          }`}>
                          {n}
                        </button>
                      ))}
                      <button onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage === pageCount}
                        className={`p-1 disabled:opacity-30 ${muted}`} aria-label="Next page">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: module list */}
            <div>
              <div className={`rounded-3xl p-6 ${card}`}>
                <p className={`text-base font-semibold ${heading}`} style={{ fontFamily: "var(--font-display)" }}>
                  Subsystem modules
                </p>
                <p className={`mt-1 mb-4 text-xs ${muted}`}>
                  Open a module to manage its records
                  {pendingTotal > 0 && (
                    <> · <span className="font-semibold text-[#E5484D]">{pendingTotal} request{pendingTotal === 1 ? "" : "s"} waiting for approval</span></>
                  )}
                </p>

                <div className="flex flex-col gap-3">
                  {stats.map(({ label, desc, value, pending, icon: Icon, href }, i) => (
                    <Link
                      key={label}
                      href={href}
                      suppressHydrationWarning
                      className={`group flex items-center gap-4 rounded-2xl p-3 transition ${
                        isDark ? "hover:bg-[#1A1A22]" : "hover:bg-[#FDF3F8]"
                      }`}
                    >
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                        style={{ background: `linear-gradient(135deg, ${RING_COLORS[i % RING_COLORS.length]}, ${PINK_SOFT})` }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${heading}`}>{label}</p>
                        <p className={`truncate text-xs ${muted}`}>{desc}</p>
                      </div>
                      <div className="hidden w-40 sm:block lg:w-72">
                        <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? "bg-[#26262E]" : "bg-[#F3E6EE]"}`}>
                          <div className="h-full rounded-full"
                            style={{ width: `${(value / max) * 100}%`, background: `linear-gradient(90deg, ${PINK}, ${PINK_SOFT})` }} />
                        </div>
                      </div>
                      {pending > 0 && (
                        <span className="shrink-0 rounded-full bg-[#E5484D] px-2 py-0.5 text-[11px] font-bold text-white" title="Requests waiting for approval">
                          {pending} pending
                        </span>
                      )}
                      <span className={`w-10 text-right text-sm font-semibold ${heading}`}>{value}</span>
                      <span
                        className={`hidden rounded-md px-2.5 py-1 text-[11px] font-semibold sm:inline ${
                          value > 0
                            ? isDark ? "bg-[#F2419B]/15 text-[#FF8CC6]" : "bg-[#FDE7F1] text-[#F2419B]"
                            : isDark ? "bg-[#26262E] text-[#9A9AA8]" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {value > 0 ? "In use" : "Empty"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* SPNC AI assistant (floating robot button, bottom-right) */}
      <SpncAssistant isDark={isDark} />
    </div>
  );
}
