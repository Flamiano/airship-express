"use client";

// app/(spnc)/spnc/app/employees/page.tsx  → /spnc/app/employees
// Real-time employee activity monitor (same look as Rates & Tariffs).
//   Active           → active in the last 60s
//   Inactive · 12m   → idle for 12 minutes (counts up live every second)
//   Never seen       → hasn't used the app since this feature was added

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, Search, UserPlus, X } from "lucide-react";
import { useShell } from "../../components/ShellContext";
import PageHeader from "../../components/PageHeader";
import SpncAssistant from "../../components/SpncAssistant";
import { can } from "../../lib/rbac";

// "Create Account" opens the admin Create Account page (app/(spnc)/spnc/app/accounts/page.tsx).
// After saving, that page comes back here with ?created=<name>&createdRole=<role>.
const CREATE_ACCOUNT_PATH = "/spnc/app/accounts";

type ApiEmployee = {
  id: string;
  id_number: string | null;
  full_name: string | null;
  email: string;
  role: string;
  last_seen_at: string | null;
  locked?: boolean;
};

type Filter = "all" | "active" | "inactive" | "locked";

const POLL_EVERY_MS = 10_000; // refresh from server
const ACTIVE_WINDOW_MS = 60_000; // heartbeat is every 20s, so 60s gives slack
const LONG_IDLE_MS = 30 * 60_000; // amber → red after 30 min

const PAGE_SIZE = 10;
const RECENT_SEARCHES_KEY = "employees_recent_searches";
const MAX_RECENT_SEARCHES = 5;

// Fixed table layout (same idea as Rates): columns never jump, every row is the same height,
// and short pages are padded with empty rows so the table and Back / Next don't move.
const EMP_COLUMNS: { label: string; width: number }[] = [
  { label: "Employee", width: 280 },
  { label: "Employee ID", width: 170 },
  { label: "Role", width: 130 },
  { label: "Email Address", width: 260 },
  { label: "Status", width: 190 },
  { label: "Last Active", width: 210 },
  { label: "Action", width: 230 },
];
const EMP_TABLE_WIDTH = EMP_COLUMNS.reduce((sum, c) => sum + c.width, 0);
const EMP_ROW_HEIGHT = 76;

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

// Employee ID = users.id_number. Falls back to a short form of users.id if it's empty.
const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
const employeeId = (e: { id: string; id_number: string | null }) => e.id_number?.trim() || shortId(e.id);


const roleLabel = (role: string) => (role ? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ") : "—");

export default function EmployeesPage() {
  const { theme, role, roleLoading } = useShell();
  // Only admins can create accounts; employees don't see the button.
  const canCreateAccount = !roleLoading && can(role, "users:create");
  const isDark = theme === "dark";

  const muted = isDark ? "text-[#8FA0AF]" : "text-gray-500";
  const strong = isDark ? "text-[#F2F1EC]" : "text-gray-900";

  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  // Search: typed (searchInput) vs. applied (searchTerm) — applied on Enter or the Search button
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Message after coming back from the Create Account page
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get("created");
    if (!created) return;
    const createdRole = params.get("createdRole");
    setCreatedNotice(
      `Created ${createdRole ? `${createdRole} ` : ""}account for ${created}. They appear in the list as "Never seen" until they sign in.`
    );
    // Clean the address bar so a refresh doesn't show the message again
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!createdNotice) return;
    const id = setTimeout(() => setCreatedNotice(null), 8000);
    return () => clearTimeout(id);
  }, [createdNotice]);

  // Poll the server
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/spnc/app/api/presence", { cache: "no-store" });
        if (res.status === 403) throw new Error("You don't have permission to view this page.");
        if (!res.ok) throw new Error("Couldn't refresh — retrying…");
        const data = await res.json();
        if (cancelled) return;
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
        setClockOffset(new Date(data.serverNow).getTime() - Date.now());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't refresh — retrying…");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, POLL_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Tick every second so the inactive timer counts up live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Recent searches (saved in this browser)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.filter((t) => typeof t === "string").slice(0, MAX_RECENT_SEARCHES));
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!showRecentSearches) return;
    const onDown = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) setShowRecentSearches(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showRecentSearches]);

  function persistRecentSearches(list: string[]) {
    setRecentSearches(list);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function runSearch(term: string = searchInput) {
    const trimmed = term.trim();
    setSearchInput(term);
    setSearchTerm(trimmed);
    setShowRecentSearches(false);
    if (trimmed) {
      persistRecentSearches(
        [trimmed, ...recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES)
      );
    }
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  // "Change details" (admins): edit name, User ID and email of an employee
  type EditForm = { id: string; full_name: string; id_number: string; email: string; password: string };
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(emp: ApiEmployee) {
    setEditError(null);
    setShowEditPassword(false);
    setEditing({ id: emp.id, full_name: emp.full_name ?? "", id_number: emp.id_number ?? "", email: emp.email ?? "", password: "" });
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/spnc/app/api/presence/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't save the changes.");
      setEmployees((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...data.employee } : x)));
      setCreatedNotice(
        `Saved the details for ${data.employee?.full_name || editing.full_name}${editing.password ? " and set a new password" : ""}.`
      );
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save the changes.");
    } finally {
      setEditSaving(false);
    }
  }

  // Admin unlock for a locked account
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  async function unlockAccount(emp: { id: string; id_number: string | null; full_name: string | null }) {
    const idNumber = emp.id_number?.trim();
    if (!idNumber) return;
    const name = emp.full_name || idNumber;
    if (!window.confirm(`Unlock ${name}? They will be able to sign in again.`)) return;

    setUnlockingId(emp.id);
    try {
      const res = await fetch("/spnc/app/api/presence/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't unlock the account.");
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, locked: false } : e)));
      setCreatedNotice(`Unlocked ${name}. They can sign in again.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't unlock the account.");
    } finally {
      setUnlockingId(null);
    }
  }

  const rows = useMemo(() => {
    const serverNow = now + clockOffset;
    // Admin accounts are not listed on this page, only employees.
    return employees.filter((e) => e.role === "employee").map((e) => {
      const seen = e.last_seen_at ? new Date(e.last_seen_at).getTime() : null;
      const idleMs = seen === null ? null : Math.max(0, serverNow - seen);
      return { ...e, idleMs, active: idleMs !== null && idleMs < ACTIVE_WINDOW_MS, locked: !!e.locked };
    });
  }, [employees, now, clockOffset]);

  const visible = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return rows
      .filter((r) =>
        filter === "active" ? r.active : filter === "inactive" ? !r.active : filter === "locked" ? r.locked : true
      )
      .filter(
        (r) =>
          !q ||
          employeeId(r).toLowerCase().includes(q) ||
          (r.full_name ?? "").toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.role ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.idleMs ?? Infinity) - (b.idleMs ?? Infinity));
  }, [rows, searchTerm, filter]);

  const employeeRows = visible;

  // 10 per page; a new search or filter starts at page 1
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filter]);
  const totalPages = Math.max(1, Math.ceil(employeeRows.length / PAGE_SIZE));
  const pageNow = Math.min(page, totalPages);
  const pagedRows = employeeRows.slice((pageNow - 1) * PAGE_SIZE, pageNow * PAGE_SIZE);

  const activeCount = rows.filter((r) => r.active).length;
  const neverCount = rows.filter((r) => r.idleMs === null).length;
  const lockedCount = rows.filter((r) => r.locked).length;
  const employeeCount = rows.length;

  const statCards = [
    { label: "Total employees", value: employeeCount, accent: strong },
    { label: "Active now", value: activeCount, accent: isDark ? "text-emerald-400" : "text-emerald-600" },
    { label: "Inactive", value: rows.length - activeCount - neverCount, accent: isDark ? "text-amber-400" : "text-amber-600" },
    { label: "Never seen", value: neverCount, accent: muted },
    { label: "Locked", value: lockedCount, accent: lockedCount > 0 ? (isDark ? "text-[#E2685A]" : "text-red-600") : muted },
  ];

  const pagerBtn = `flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
    isDark ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]" : "border-gray-300 text-gray-600 hover:bg-gray-100"
  }`;

  const emptyBox = (text: string) => (
    <div
      className={`rounded-lg border border-dashed px-4 py-10 text-center text-sm ${
        isDark ? "border-[#2C4356] text-[#8FA0AF]" : "border-gray-300 text-gray-500"
      }`}
    >
      {text}
    </div>
  );

  const renderTable = (list: typeof pagedRows, withFiller: boolean) => (
              <div className={`overflow-hidden rounded-lg border ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left" style={{ tableLayout: "fixed", minWidth: EMP_TABLE_WIDTH }}>
          <colgroup>
            {EMP_COLUMNS.map((c) => (
              <col key={c.label} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead className={isDark ? "bg-[#0B1220] text-[#8FA0AF]" : "bg-gray-50 text-gray-500"}>
            <tr>
              {EMP_COLUMNS.map((c) => (
                <th key={c.label} className="truncate px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isDark ? "divide-y divide-[#23303D] text-[#C7D1DA]" : "divide-y divide-gray-200 text-gray-700"}>
            {list.map((r) => {
              const long = r.idleMs !== null && r.idleMs >= LONG_IDLE_MS;
              const seen = r.last_seen_at ? formatDate(r.last_seen_at) : null;
              return (
                <tr
                  key={r.id}
                  style={{ height: EMP_ROW_HEIGHT }}
                  className={isDark ? "bg-[#121B26] hover:bg-[#182230]" : "bg-white hover:bg-gray-50"}
                >
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <div className="truncate font-semibold text-[#F2419B]" title={r.full_name || undefined}>
                        {r.full_name || "Unnamed employee"}
                      </div>
                      <div className={`truncate text-xs ${muted}`}>Service Provider and Network Control</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm font-medium">
                    {r.id_number?.trim() ? (
                      <span className="truncate">{r.id_number}</span>
                    ) : (
                      <span className={muted} title={r.id}>
                        — not set
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.role === "employee"
                          ? isDark
                            ? "bg-[#1A2530] text-[#C7D1DA]"
                            : "bg-gray-100 text-gray-600"
                          : isDark
                          ? "bg-[#3A1229] text-[#F2419B]"
                          : "bg-[#FDE7F2] text-[#D12C80]"
                      }`}
                    >
                      {roleLabel(r.role)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-sm">
                    <span className="block truncate" title={r.email}>
                      {r.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top">
                    {r.locked ? (
                      <Badge dot="bg-[#E2685A]" cls={isDark ? "bg-[#E2685A]/15 text-[#E2685A]" : "bg-red-100 text-red-600"}>
                        Locked
                      </Badge>
                    ) : r.active ? (
                      <Badge dot="bg-emerald-400" cls={isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"} pulse>
                        Active
                      </Badge>
                    ) : r.idleMs === null ? (
                      <Badge dot={isDark ? "bg-[#4B5A68]" : "bg-gray-400"} cls={isDark ? "bg-[#4B5A68]/20 text-[#8FA0AF]" : "bg-gray-100 text-gray-500"}>
                        Never seen
                      </Badge>
                    ) : long ? (
                      <Badge dot="bg-[#E2685A]" cls={isDark ? "bg-[#E2685A]/15 text-[#E2685A]" : "bg-red-100 text-red-600"}>
                        Inactive · {formatDuration(r.idleMs)}
                      </Badge>
                    ) : (
                      <Badge dot="bg-amber-400" cls={isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-700"}>
                        Inactive · {formatDuration(r.idleMs)}
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top">
                    {seen ? (
                      <>
                        <div className={`text-sm ${strong}`}>{seen.date}</div>
                        <div className={`text-xs ${muted}`}>{seen.time}</div>
                      </>
                    ) : (
                      <span className={muted}>—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top">
                    {canCreateAccount && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                            isDark
                              ? "border-[#2C4356] text-[#C7D1DA] hover:bg-[#1A2530]"
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          Change details
                        </button>
                        {r.locked && canCreateAccount && (
                          <button
                            type="button"
                            onClick={() => unlockAccount(r)}
                            disabled={unlockingId === r.id}
                            className="flex items-center gap-1.5 rounded-md bg-[#F2419B] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {unlockingId === r.id && <Loader2 size={12} className="animate-spin" />}
                            Unlock
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Empty rows keep every page the same height */}
            {withFiller && totalPages > 1 &&
              Array.from({ length: PAGE_SIZE - list.length }, (_, i) => (
                <tr key={`filler-${i}`} aria-hidden="true" style={{ height: EMP_ROW_HEIGHT }}>
                  <td colSpan={EMP_COLUMNS.length} />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={`min-h-full pb-24 ${isDark ? "bg-[#0B1220]" : "bg-white"}`}>
      <PageHeader
        icon={<Activity size={20} />}
        title="Employee Activity"
        subtitle="Team monitor · who is online right now and how long others have been idle"
      />

      <div className="px-8">
        {/* Create account (admins) + live status */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className={`flex items-center gap-2 text-xs font-medium ${muted}`}>
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin text-[#F2419B]" />
                Connecting…
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  {!error && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-[#E2685A]" : "bg-emerald-400"}`} />
                </span>
                {error ? "Offline" : "Live · updates every 10s"}
              </>
            )}
          </span>

          {canCreateAccount && (
            <Link
              href={CREATE_ACCOUNT_PATH}
              className="flex items-center gap-2 rounded-md bg-[#F2419B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#F55CAB]"
            >
              <UserPlus size={16} />
              Create Account
            </Link>
          )}
        </div>

        {createdNotice && (
          <div
            role="status"
            className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{createdNotice}</span>
            <button type="button" onClick={() => setCreatedNotice(null)} aria-label="Dismiss" className="ml-auto rounded p-0.5 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-md border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="animate-spin text-[#F2419B]" />
            <p className="text-sm font-semibold text-[#F2419B]">Loading</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {statCards.map((s) => (
                <div
                  key={s.label}
                  className={`rounded-lg border px-4 py-3 ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${s.accent}`} style={{ fontFamily: "var(--font-display)" }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Filters (left) + search (right) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`flex rounded-md border p-1 text-sm ${isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-gray-50"}`}>
                {(["all", "active", "inactive", "locked"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded px-3 py-1.5 capitalize transition ${
                      filter === f
                        ? "bg-[#F2419B] font-semibold text-white"
                        : isDark
                        ? "text-[#8FA0AF] hover:text-[#F2F1EC]"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="relative w-full max-w-md" ref={searchWrapperRef}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (!e.target.value.trim()) setSearchTerm("");
                  }}
                  onFocus={() => setShowRecentSearches(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      runSearch();
                    } else if (event.key === "Escape") setShowRecentSearches(false);
                  }}
                  placeholder="Search employee ID, name, email, role..."
                  className={`w-full rounded-md border py-2.5 pl-3 pr-20 text-sm outline-none ${
                    isDark
                      ? "border-[#2C4356] bg-[#121B26] text-[#F2F1EC] placeholder:text-[#4B5A68] focus:border-[#F2419B]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#F2419B]"
                  }`}
                />
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  {searchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      aria-label="Clear search"
                      title="Clear"
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                        isDark ? "text-[#8FA0AF] hover:bg-[#1A2530] hover:text-[#F2F1EC]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <X size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runSearch()}
                    aria-label="Search"
                    title="Search"
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F2419B] text-white transition hover:bg-[#F55CAB]"
                  >
                    <Search size={15} />
                  </button>
                </div>
                {showRecentSearches && recentSearches.length > 0 && (
                  <div
                    className={`absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-md border shadow-lg ${
                      isDark ? "border-[#2C4356] bg-[#121B26]" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className={`flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide ${muted}`}>
                      <span>Recent searches</span>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          persistRecentSearches([]);
                        }}
                        className={`normal-case ${isDark ? "text-[#8FA0AF] hover:text-[#F2F1EC]" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        Clear
                      </button>
                    </div>
                    <ul>
                      {recentSearches.map((term) => (
                        <li key={term}>
                          <div
                            className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                              isDark ? "text-[#C7D1DA] hover:bg-[#182230]" : "text-gray-700 hover:bg-gray-50"
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              runSearch(term);
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Clock size={13} className={`shrink-0 ${isDark ? "text-[#4B5A68]" : "text-gray-400"}`} />
                              <span className="truncate">{term}</span>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                persistRecentSearches(recentSearches.filter((item) => item !== term));
                              }}
                              aria-label={`Remove "${term}" from recent searches`}
                              className={`opacity-0 transition group-hover:opacity-100 ${
                                isDark ? "text-[#4B5A68] hover:text-[#F2F1EC]" : "text-gray-300 hover:text-gray-600"
                              }`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Employees table */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className={`text-base font-semibold ${strong}`}>Employees</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isDark ? "bg-[#1A2530] text-[#C7D1DA]" : "bg-gray-100 text-gray-600"}`}>
                  Total: {employeeCount}
                </span>
              </div>
              {employeeRows.length === 0 ? emptyBox("No employees found.") : renderTable(pagedRows, true)}
            </section>

            {employeeRows.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button type="button" onClick={() => setPage(pageNow - 1)} disabled={pageNow === 1} className={pagerBtn}>
                  <ChevronLeft size={16} />
                  Back
                </button>
                <span className={`text-sm ${muted}`}>
                  Page {pageNow} of {totalPages}
                </span>
                <button type="button" onClick={() => setPage(pageNow + 1)} disabled={pageNow === totalPages} className={pagerBtn}>
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SPNC AI assistant (floating robot button, bottom-right) */}
      {/* Change details dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <form
            onSubmit={saveEdit}
            autoComplete="off"
            className={`w-full max-w-md rounded-lg border p-6 shadow-xl ${
              isDark ? "border-[#23303D] bg-[#121B26]" : "border-gray-200 bg-white"
            }`}
          >
            <h3 className={`text-lg font-semibold ${strong}`}>Change details</h3>
            <p className={`mt-1 mb-4 text-sm ${muted}`}>Update this employee&apos;s name, User ID, email or password.</p>

            {editError && (
              <div role="alert" className="mb-4 rounded-md border border-[#E2685A]/40 bg-[#E2685A]/10 px-3 py-2 text-sm text-[#E2685A]">
                {editError}
              </div>
            )}

            {([
              { key: "full_name", label: "Full name", type: "text", max: 100 },
              { key: "id_number", label: "User ID", type: "text", max: 64 },
              { key: "email", label: "Email address", type: "email", max: 254 },
            ] as { key: "full_name" | "id_number" | "email"; label: string; type: string; max: number }[]).map((f) => (
              <label key={f.key} className="mb-4 block">
                <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${muted}`}>{f.label}</span>
                <input
                  type={f.type}
                  required
                  maxLength={f.max}
                  autoComplete="off"
                  value={editing[f.key]}
                  onChange={(e) => {
                    // User ID: only letters, numbers, - _ . (same rule as the login page)
                    const v = f.key === "id_number" ? e.target.value.replace(/[^A-Za-z0-9._-]/g, "") : e.target.value;
                    setEditing({ ...editing, [f.key]: v });
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#F2419B] ${
                    isDark ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC]" : "border-gray-300 bg-white text-gray-900"
                  }`}
                />
              </label>
            ))}

            <label className="mb-4 block">
              <span className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${muted}`}>New password</span>
              <div className="relative">
                <input
                  type={showEditPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={200}
                  placeholder="Leave blank to keep the current password"
                  value={editing.password}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  className={`w-full rounded-md border py-2 pl-3 pr-16 text-sm outline-none focus:border-[#F2419B] ${
                    isDark
                      ? "border-[#2C4356] bg-[#0B1220] text-[#F2F1EC] placeholder:text-[#4B5A68]"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((v) => !v)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${muted} hover:underline`}
                >
                  {showEditPassword ? "Hide" : "Show"}
                </button>
              </div>
              <span className={`mt-1 block text-xs ${muted}`}>At least 8 characters. Tell the employee the new password.</span>
            </label>

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={editSaving} className={pagerBtn}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex items-center gap-2 rounded-md bg-[#F2419B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#F55CAB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editSaving && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      <SpncAssistant isDark={isDark} />
    </div>
  );
}

function Badge({ children, dot, cls, pulse }: { children: React.ReactNode; dot: string; cls: string; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      {children}
    </span>
  );
}