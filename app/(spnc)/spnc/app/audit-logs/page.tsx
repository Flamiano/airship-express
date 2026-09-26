"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Loader2,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Clock,
  Activity,
  Archive,
  Sun,
  Moon,
} from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";

type AuditLog = {
  id: string;
  event_type: "login" | "logout" | "session_timeout" | "user_activity" | "archive";
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type AuditStats = {
  total: number;
  thisMonth: number;
  byEventType: Record<string, number>;
  dailyTrend: { date: string; count: number }[];
};

const EVENT_FILTERS: { label: string; value: string }[] = [
  { label: "All events", value: "all" },
  { label: "Logins", value: "login" },
  { label: "Logouts", value: "logout" },
  { label: "Session timeouts", value: "session_timeout" },
  { label: "User activity", value: "user_activity" },
  { label: "Archived / history", value: "archive" },
];

// Shades kept strictly within pink / black-gray / white so charts stay on-brand.
const EVENT_COLORS: Record<string, string> = {
  login: "#F2419B",
  session_timeout: "#B32E73",
  archive: "#F5A9D0",
  logout: "#8FA0AF",
  user_activity: "#4B5A68",
};

const PAGE_SIZE = 25;

function eventIcon(type: AuditLog["event_type"]) {
  const icons: Record<string, typeof LogIn> = {
    login: LogIn,
    logout: LogOut,
    session_timeout: Clock,
    user_activity: Activity,
    archive: Archive,
  };
  return icons[type] || Activity;
}

function eventBadge(type: AuditLog["event_type"], isDark: boolean) {
  const Icon = eventIcon(type);
  const isSecurityEvent = type === "login" || type === "session_timeout";
  const isArchived = type === "archive";

  const classes = isArchived
    ? isDark
      ? "bg-[#F2F1EC] text-[#0B1220]"
      : "bg-[#0B1220] text-white"
    : isSecurityEvent
    ? "bg-[#F2419B] text-white"
    : isDark
    ? "border border-[#2C4356] text-[#C7D1DA]"
    : "border border-gray-300 text-gray-600";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      <Icon size={12} />
      {type.replace("_", " ")}
    </span>
  );
}

function Sparkline({ data, gradientId, isDark }: { data: number[]; gradientId: string; isDark: boolean }) {
  const width = 100;
  const height = 40;
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2419B" stopOpacity={isDark ? 0.4 : 0.3} />
          <stop offset="100%" stopColor="#F2419B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke="#F2419B" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function EventDonut({ byEventType, isDark }: { byEventType: Record<string, number>; isDark: boolean }) {
  const segments = Object.entries(byEventType)
    .map(([label, value]) => ({ label, value, color: EVENT_COLORS[label] || "#8FA0AF" }))
    .filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-full border border-dashed border-[#2C4356]">
        <span className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}>No data</span>
      </div>
    );
  }

  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = (cumulative / total) * 360;
    cumulative += seg.value;
    const end = (cumulative / total) * 360;
    return `${seg.color} ${start}deg ${end}deg`;
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;
  const top = [...segments].sort((a, b) => b.value - a.value)[0];
  const topPct = Math.round((top.value / total) * 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full" style={{ background: gradient }}>
        <div className={`flex h-24 w-24 flex-col items-center justify-center rounded-full ${isDark ? "bg-[#121B26]" : "bg-white"}`}>
          <span className="text-xl font-bold text-[#F2419B]">{topPct}%</span>
          <span className={`text-[10px] capitalize ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
            {top.label.replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 self-stretch">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className={`capitalize ${isDark ? "text-[#C7D1DA]" : "text-gray-600"}`}>
                {seg.label.replace("_", " ")}
              </span>
            </span>
            <span className={isDark ? "text-[#8FA0AF]" : "text-gray-500"}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(logs: AuditLog[]) {
  const headers = ["Date", "Event", "Actor", "Role", "Action", "Entity Type", "Entity ID", "IP Address"];
  const rows = logs.map((l) => [
    new Date(l.created_at).toLocaleString(),
    l.event_type,
    l.actor_name || "",
    l.actor_role || "",
    l.action,
    l.entity_type || "",
    l.entity_id || "",
    l.ip_address || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { theme, role, roleLoading, toggleTheme } = useShell();
  const isDark = theme === "dark";

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventType, setEventType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const authorized = !roleLoading && !!role;

  useEffect(() => {
    if (!roleLoading && !role) {
      router.replace("/spnc/app/login");
      return;
    }
  }, [role, roleLoading, router]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const res = await fetch("/spnc/app/api/audit-logs/stats", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) setStats(data);
      } catch (err) {
        console.error("Fetch audit stats failed:", err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [authorized, refreshTick]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    async function loadLogs() {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ eventType, page: String(page), pageSize: String(PAGE_SIZE) });
        if (searchTerm.trim()) params.set("q", searchTerm.trim());

        const res = await fetch(`/spnc/app/api/audit-logs?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setLoadError(data.message || "Failed to load audit logs.");
          setLogs([]);
          setTotal(0);
          return;
        }
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (!cancelled) {
          console.error("Fetch audit logs failed:", err);
          setLoadError("Couldn't reach the server. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [authorized, eventType, page, searchTerm, refreshTick]);

  const trendValues = useMemo(() => (stats?.dailyTrend || []).map((d) => d.count), [stats]);

  if (roleLoading || (!authorized && !roleLoading)) {
    return (
      <div className={`flex min-h-full flex-col items-center justify-center gap-3 py-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
        <Loader2 size={32} className="animate-spin text-[#F2419B]" />
        <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
      </div>
    );
  }

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <div className="flex items-start justify-between px-8 pt-8">
        <PageHeader
          icon={<ShieldCheck size={20} />}
          title="Audit Log Overview"
          subtitle="Session timeouts, login/logout records, user activity & history"
          showThemeToggle={false}
        />
        <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Search size={14} />
              Search
            </button>
            <button
              type="button"
              onClick={() => exportCsv(logs)}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-[#F2419B] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              aria-label="Refresh"
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
              isDark
                ? "border-[#2C4356] text-[#F2A23B] hover:border-[#F2A23B]/40"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      <div className="px-8 pt-6">
        {/* Overview: stat cards + trend chart + breakdown donut */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={`rounded-lg border p-5 lg:col-span-2 ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  Total events
                </p>
                <p className="mt-1 text-3xl font-bold text-[#F2419B]" style={{ fontFamily: "var(--font-display)" }}>
                  {statsLoading ? "—" : (stats?.total ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                  This month
                </p>
                <p className={`mt-1 text-3xl font-bold ${isDark ? "text-[#F2F1EC]" : "text-gray-900"}`} style={{ fontFamily: "var(--font-display)" }}>
                  {statsLoading ? "—" : (stats?.thisMonth ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>Last 30 days</p>
            </div>
            <div className="mt-2 h-28">
              {statsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-[#F2419B]" />
                </div>
              ) : (
                <Sparkline data={trendValues} gradientId="trendFill" isDark={isDark} />
              )}
            </div>
          </div>

          <div className={`rounded-lg border p-5 ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
            <p className={`mb-3 text-xs font-medium uppercase tracking-wide ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
              Event breakdown
            </p>
            {statsLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#F2419B]" />
              </div>
            ) : (
              <EventDonut byEventType={stats?.byEventType || {}} isDark={isDark} />
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {EVENT_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setEventType(f.value);
                  setPage(1);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  eventType === f.value
                    ? "bg-[#F2419B] text-white"
                    : isDark
                    ? "border border-[#2C4356] text-[#C7D1DA] hover:border-[#F2419B]/40"
                    : "border border-gray-300 text-gray-600 hover:border-[#F2419B]/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {searchOpen && (
            <div className="relative w-full max-w-xs">
              <Search
                size={16}
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#8FA0AF]" : "text-gray-400"}`}
              />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search action, user, entity..."
                className={`w-full rounded-md border py-2.5 pl-10 pr-3 text-sm outline-none ${
                  isDark
                    ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                    : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                }`}
              />
            </div>
          )}
        </div>

        {loadError && (
          <div className="mt-4 border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">{loadError}</div>
        )}

        {/* Log table */}
        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 size={32} className="animate-spin text-[#F2419B]" />
              <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
            </div>
          ) : logs.length === 0 ? (
            <div className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"}`}>
              No audit log entries found.
            </div>
          ) : (
            <div className={`overflow-hidden rounded-lg border ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#23303D] text-left">
                  <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
                    <tr>
                      {["Status", "Event", "Actor", "Action", "Time", "IP Address"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
                    {logs.map((log) => (
                      <tr key={log.id} className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}>
                        <td className="px-4 py-3 align-top">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full bg-[#3BD68A]" />
                            Logged
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">{eventBadge(log.event_type, isDark)}</td>
                        <td className="px-4 py-3 align-top">
                          <div>{log.actor_name || "—"}</div>
                          {log.actor_role && (
                            <div className={`text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>{log.actor_role}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">{log.action}</td>
                        <td className="px-4 py-3 align-top text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 align-top text-xs ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                          {log.ip_address || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {total > 0 && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <span className={`text-sm ${isDark ? "text-[#8FA0AF]" : "text-gray-500"}`}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}