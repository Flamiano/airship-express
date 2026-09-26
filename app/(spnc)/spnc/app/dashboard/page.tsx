"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Map,
  DollarSign,
  ClipboardList,
  Calendar,
  Loader2,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";

const PINK = "#F2419B";
const PINK_SOFT = "#FF8CC6";
const RING_COLORS = ["#F2419B", "#FF6FB1", "#FF8CC6", "#FFB3D9", "#C22A78"];
const PAGE_SIZE = 3;

const userFullName = "ADMIN"; // TODO: replace with real session user's full_name

const getArrayLength = (payload: unknown, key: string) => {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value.length : 0;
  }
  return Array.isArray(payload) ? payload.length : 0;
};

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

export default function DashboardPage() {
  const { theme } = useShell();
  const isDark = theme === "dark";

  const [providerCount, setProviderCount] = useState<number | null>(null);
  const [routeCount, setRouteCount] = useState<number | null>(null);
  const [rateCount, setRateCount] = useState<number | null>(null);
  const [scheduleCount, setScheduleCount] = useState<number | null>(null);
  const [sopCount, setSopCount] = useState<number | null>(null);

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

    load("/spnc/app/api/service-providers", "providers", setProviderCount);
    load("/spnc/app/api/routes", "routes", setRouteCount);
    load("/spnc/app/api/rates", "rates", setRateCount);
    load("/spnc/app/api/schedules", "schedules", setScheduleCount);
    load("/spnc/app/api/sops", "sops", setSopCount);
  }, []);

  const isLoading =
    providerCount === null ||
    routeCount === null ||
    rateCount === null ||
    scheduleCount === null ||
    sopCount === null;

  const stats = [
    { label: "Service Providers", short: "Providers", desc: "Carriers, forwarders & vendors", value: providerCount ?? 0, icon: Building2, href: "/spnc/app/service-providers" },
    { label: "Network & Routes", short: "Routes", desc: "Origin-destination planning", value: routeCount ?? 0, icon: Map, href: "/spnc/app/routes" },
    { label: "Rates & Tariffs", short: "Rates", desc: "Pricing & validity", value: rateCount ?? 0, icon: DollarSign, href: "/spnc/app/rates" },
    { label: "SOPs", short: "SOPs", desc: "Standard operating procedures", value: sopCount ?? 0, icon: ClipboardList, href: "/spnc/app/sops" },
    { label: "Schedules", short: "Schedules", desc: "Upcoming departures", value: scheduleCount ?? 0, icon: Calendar, href: "/spnc/app/schedules" },
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
        title={userFullName}
        subtitle={`Network Control overview · ${today}`}
        showThemeToggle
      />

      <div className="px-8">
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
                                  <Link href={s.href} suppressHydrationWarning
                                    className={`inline-flex items-center gap-1 text-xs transition hover:text-[#F2419B] ${muted}`}>
                                    <Eye size={14} /> See detail
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                          {pageRows.length === 0 && (
                            <tr><td colSpan={3} className={`py-6 text-center text-xs ${muted}`}>No modules match "{query}".</td></tr>
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
                <p className={`mt-1 mb-4 text-xs ${muted}`}>Open a module to manage its records</p>

                <div className="flex flex-col gap-3">
                  {stats.map(({ label, desc, value, icon: Icon, href }, i) => (
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
    </div>
  );
}
