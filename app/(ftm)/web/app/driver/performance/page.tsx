"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from "recharts";
import GlobalNavbar from "../../components/GlobalNavbar";
import { getDashboardSnapshot, getTrips, getAlertsSnapshot } from "../../lib/api";

 

function GlobalFooter() {
  return (
    <footer className="bg-white border-t border-pink-100 w-full py-8 mt-auto">
      <div className="w-full max-w-[1800px] mx-auto px-4 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="text-sm font-bold text-slate-800">Airship Express Courier Operations</div>
          <div className="text-xs text-slate-400 mt-0.5">
            © 2026 Airship Express Philippines-based courier service. All rights reserved.
          </div>
        </div>
        <nav className="flex flex-wrap gap-6 text-xs font-medium text-slate-500">
          <a className="hover:text-pink-600 transition-colors" href="#">
            Privacy Policy
          </a>
          <a className="hover:text-pink-600 transition-colors" href="#">
            Terms of Service
          </a>
          <a className="hover:text-pink-600 transition-colors" href="#">
            Fleet Portal
          </a>
          <a className="hover:text-pink-600 transition-colors" href="#">
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}

export default function DriverPerformancePage() {
  const [selectedRange, setSelectedRange] = useState<"Last 7 Days" | "Last 30 Days" | "This Month">(
    "Last 30 Days"
  );
  const [selectedMetric, setSelectedMetric] = useState<"Efficiency" | "Volume">("Efficiency");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);
  const [driversState, setDriversState] = useState<any[]>(
    (typeof window !== 'undefined' && (window as any).__computedDrivers) || []
  );
  const [metricsState, setMetricsState] = useState<any[]>([]);
  const drivers = driversState.length
    ? driversState
    : (typeof window !== 'undefined' && (window as any).__computedDrivers) || [];

  function handleExport() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = drivers.filter((d: any) => {
      if (!q) return true;
      return String(d.name).toLowerCase().includes(q) || String(d.id).toLowerCase().includes(q);
    });
    const headers = [
      "Driver ID",
      "Name",
      "Safety",
      "Efficiency",
      "OnTime",
      "Missions",
      "LastMission",
      "Metric",
      "Range",
    ];
    const rows = filtered.map((d: any) => [
      d.id,
      d.name,
      String(d.safety),
      String(d.efficiency),
      String(d.onTime),
      String(d.missions || 0),
      d.lastMission,
      selectedMetric,
      selectedRange,
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r: any) => (r as any[]).map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `driver-performance-${selectedMetric.replace(/\s+/g, "").toLowerCase()}-${selectedRange.replace(
      /\s+/g,
      ""
    )}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setShowExportNotice(true);
    setTimeout(() => setShowExportNotice(false), 2500);
  }

  function getDriverLogs(id: string) {
    return [
      { ts: "2026-07-12T14:22:00Z", event: "Completed mission", note: "No incidents" },
      { ts: "2026-07-09T09:11:00Z", event: "Hard braking detected", note: "Brake event severity: medium" },
      { ts: "2026-07-02T18:02:00Z", event: "Speeding alert", note: "15km/h over limit" },
    ];
  }

  function generateTrendData(metric: "Efficiency" | "Volume", range: string) {
    let points = 7;
    if (range === "Last 7 Days") points = 7;
    else if (range === "Last 30 Days") points = 30;
    else {
      const now = new Date();
      points = now.getDate();
    }
    const data: { period: string; value: number }[] = [];
    const now = new Date();
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const base = metric === "Efficiency" ? 7.5 : 100;
      const variance = metric === "Efficiency" ? 0.8 : 30;
      const value =
        Math.round((base + (Math.sin(i) * variance) / 10 + Math.random() * (variance / 3)) * 10) / 10;
      data.push({ period: label, value });
    }
    return data;
  }

  const chartData = useMemo(
    () => generateTrendData(selectedMetric, selectedRange),
    [selectedMetric, selectedRange]
  );

  useEffect(() => {
    document.title = "Airship Express - Driver Performance";
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const snap = await getDashboardSnapshot();
        const trips = await getTrips();
        const alerts = await getAlertsSnapshot();

        const tripsByDriver: Record<string, any[]> = {};
        (trips || []).forEach((t: any) => {
          const id = String(t.driverId ?? "");
          if (!id) return;
          tripsByDriver[id] = tripsByDriver[id] || [];
          tripsByDriver[id].push(t);
        });

        const computedDrivers = (snap.drivers || []).map((d: any, idx: number) => {
          const id = d.id ?? `drv-${idx}`;
          const missions = (tripsByDriver[id] || []).length;
          const safety = Math.max(60, 100 - ((alerts?.incidents || []).filter((i: any) => String(i.driverId) === String(id)).length * 8));
          const efficiency = (7 + Math.min(3, missions / 40)).toFixed(1);
          const onTime = missions > 0 ? `${Math.max(85, Math.round(90 + (missions % 10))) }%` : "N/A";
          return {
            name: d.full_name ?? d.fullName ?? d.email ?? "Driver",
            id,
            avatar: null,
            initials: String(d.full_name ?? d.fullName ?? "").split(" ").map((s: string) => s[0]).slice(0,2).join("").toUpperCase(),
            safety,
            efficiency: String(efficiency),
            missions,
            onTime,
            lastMission: (tripsByDriver[id] && tripsByDriver[id][0] && tripsByDriver[id][0].fromLocation) || "-",
          };
        });

        if (mounted) {
          (window as any).__computedDrivers = computedDrivers;
          setDriversState(computedDrivers);

          // compute simple KPI metrics
          const safetyVals = computedDrivers.map((c: any) => Number(c.safety) || 0);
          const safetyAvg = safetyVals.length ? Math.round((safetyVals.reduce((a: number,b: number)=>a+b,0)/safetyVals.length)*10)/10 : 0;
          const effVals = computedDrivers.map((c: any) => parseFloat(String(c.efficiency)) || 0);
          const effAvg = effVals.length ? Math.round((effVals.reduce((a:number,b:number)=>a+b,0)/effVals.length)*10)/10 : 0;
          const onTimeVals = computedDrivers.map((c:any) => {
            const v = String(c.onTime || "").replace("%","");
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
          });
          const onTimeAvg = onTimeVals.length ? Math.round((onTimeVals.reduce((a:number,b:number)=>a+b,0)/onTimeVals.length)*10)/10 : 0;
          const activeDrivers = computedDrivers.length;

          setMetricsState([
            { label: "Average Safety Score", icon: "security", value: `${safetyAvg}%`, delta: null },
            { label: "Efficiency Rating", icon: "eco", value: `${effAvg}`, valueSuffix: "/10", note: `Fleet Avg: ${effAvg}` },
            { label: "On-Time Rate", icon: "schedule", value: `${onTimeAvg}%`, delta: null },
            { label: "Active Drivers", icon: "group", value: `${activeDrivers}`, note: "Currently on shift" },
          ]);

          try {
            window.dispatchEvent(new CustomEvent("__drivers_updated"));
          } catch (e) {}
        }
      } catch (e) {
        console.warn("Failed to load driver snapshot", e);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="bg-transparent text-inherit min-h-screen flex flex-col font-sans">
      <GlobalNavbar />

      {/* Main Full-Width Layout Container */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 md:px-10 py-6 md:py-8">
        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-900/5 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-700">
                  Driver performance
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Airship Express courier performance
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Monitor delivery efficiency, on-time completion, and operational consistency across active courier routes.
                </p>
              </div>

              <div className="rounded-2xl bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 ring-1 ring-pink-200">
                Live dispatch view
              </div>
            </div>
          </section>

          {/* Export Notification Toast */}
          {showExportNotice && (
            <div className="rounded-xl border border-pink-200 bg-pink-50/80 text-pink-900 px-4 py-3 text-xs font-medium flex items-center gap-2 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-pink-600 text-[20px]">
                check_circle
              </span>
              <span>
                Export queued for <strong>{selectedMetric}</strong> • <strong>{selectedRange}</strong>.
                Your report will download automatically.
              </span>
            </div>
          )}

          {/* Metric Cards Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricsState.map((m) => (
              <div
                key={m.label}
                className="bg-white p-5 rounded-2xl border border-pink-100/80 shadow-xs hover:shadow-md hover:border-pink-200 transition-all flex flex-col justify-between relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-100/60 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
                
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {m.label}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 shadow-2xs">
                    <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {m.value}
                  </span>
                  {m.valueSuffix && (
                    <span className="text-sm font-semibold text-slate-400">{m.valueSuffix}</span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {m.delta && (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <span className="material-symbols-outlined text-[13px] mr-0.5">trending_up</span>
                      {m.delta}
                    </span>
                  )}
                  {m.note && <span className="text-xs font-medium text-slate-400">{m.note}</span>}
                </div>
              </div>
            ))}
          </section>

          {/* Trend Chart Card */}
          <section className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Delivery Performance Trend Analysis</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Displaying {selectedMetric} delivery metrics for {selectedRange}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-pink-50/60 p-1 rounded-xl border border-pink-100">
                <button
                  onClick={() => setSelectedMetric("Efficiency")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedMetric === "Efficiency"
                      ? "bg-pink-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-pink-600"
                  }`}
                >
                  Efficiency
                </button>
                <button
                  onClick={() => setSelectedMetric("Volume")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedMetric === "Volume"
                      ? "bg-pink-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-pink-600"
                  }`}
                >
                  Volume
                </button>
              </div>
            </div>

            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#db2777" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#db2777" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#fbcfe8",
                      borderRadius: "0.75rem",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#831843",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={selectedMetric}
                    stroke="#db2777"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#db2777", strokeWidth: 2, stroke: "#ffffff" }}
                    activeDot={{ r: 6, fill: "#be185d", stroke: "#fbcfe8", strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Driver Table Card */}
          <section className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            {/* Table Header Controls */}
            <div className="px-6 py-5 border-b border-pink-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pink-50/20">
              <div>
                <h2 className="text-base font-bold text-slate-900">Courier Driver Performance Roster</h2>
                <p className="text-xs text-slate-500">Real-time courier delivery metrics and recent route activity</p>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-1.5 bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/20 transition-all w-full sm:w-64">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none focus:outline-none text-xs text-slate-800 placeholder-slate-400 w-full"
                  placeholder="Search by driver name or ID..."
                  type="text"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-500 border-b border-pink-100 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-3.5">Driver</th>
                    <th className="px-6 py-3.5">Safety Score</th>
                    <th className="px-6 py-3.5">Efficiency</th>
                    <th className="px-6 py-3.5">On-Time %</th>
                    <th className="px-6 py-3.5">Last Mission Hub</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {drivers
                    .filter((d: any) => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return String(d.name).toLowerCase().includes(q) || String(d.id).toLowerCase().includes(q);
                    })
                    .slice()
                    .sort((a: any, b: any) => {
                      if (selectedMetric === "Efficiency") {
                        const ea = parseFloat(a.efficiency as any) || 0;
                        const eb = parseFloat(b.efficiency as any) || 0;
                        return eb - ea;
                      }
                      return (b.missions || 0) - (a.missions || 0);
                    })
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((d: any) => (
                      <tr key={d.id} className="hover:bg-pink-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {d.avatar ? (
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-pink-200 shrink-0 shadow-2xs">
                                <img alt={d.name} className="w-full h-full object-cover" src={d.avatar} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full border border-pink-200 bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-xs shrink-0 shadow-2xs">
                                {d.initials}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{d.name}</div>
                              <div className="text-[11px] font-mono text-pink-600 font-semibold">{d.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900 w-9">{d.safety}%</span>
                            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600"
                                style={{ width: `${d.safety}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">
                            {d.efficiency}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">mpg</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              d.onTime.startsWith("100") || d.onTime.startsWith("96")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {d.onTime}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-slate-700 flex items-center gap-1.5 font-medium">
                            <span className="material-symbols-outlined text-[16px] text-pink-500">
                              pin_drop
                            </span>
                            {d.lastMission}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition-all"
                              title="Message Driver"
                              onClick={() => {
                                setMessageTarget(d);
                                setMessageText("");
                              }}
                            >
                              <span className="material-symbols-outlined text-[18px]">chat</span>
                            </button>
                            <button
                              className="bg-slate-900 hover:bg-pink-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs"
                              onClick={() => setDetailsTarget(d)}
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-pink-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/40">
              {(() => {
                const total = drivers.filter((d: any) => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return String(d.name).toLowerCase().includes(q) || String(d.id).toLowerCase().includes(q);
                }).length;
                const pageCount = Math.max(1, Math.ceil(total / pageSize));
                const first = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
                const last = Math.min(currentPage * pageSize, total);
                return (
                  <>
                    <span className="text-xs text-slate-500 font-medium">
                      Showing <strong className="text-slate-800">{first}-{last}</strong> of{" "}
                      <strong className="text-slate-800">{total}</strong> drivers
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-40 transition-all"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pageCount) }).map((_, idx) => {
                          const page = Math.min(Math.max(1, currentPage - 2 + idx), pageCount);
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                                page === currentPage
                                  ? "bg-pink-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:bg-pink-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50 disabled:opacity-40 transition-all"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, pageCount))}
                        disabled={currentPage === pageCount}
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </section>

          {/* Message Modal */}
          {messageTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-pink-100 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-pink-100 bg-pink-50/40 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-900">
                    Message {messageTarget.name}
                  </h2>
                  <button
                    onClick={() => setMessageTarget(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Message Content
                  </label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type dispatch instructions or delivery notes..."
                    className="w-full border border-slate-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl p-3 text-xs text-slate-800 outline-none h-32 resize-none"
                  />
                </div>
                <div className="flex gap-2 px-6 py-4 border-t border-slate-100 justify-end bg-slate-50/50">
                  <button
                    className="rounded-xl border border-slate-200 hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-all"
                    onClick={() => setMessageTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-5 py-2 text-xs font-semibold transition-all shadow-sm shadow-pink-600/30"
                    onClick={() => {
                      setActionNotice(`Message sent to ${messageTarget.name}`);
                      setMessageTarget(null);
                      setMessageText("");
                      setTimeout(() => setActionNotice(null), 2500);
                    }}
                  >
                    Send Dispatch Note
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Details Modal */}
          {detailsTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-pink-100 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-pink-100 bg-pink-50/30">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Driver Details — {detailsTarget.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ID: <span className="font-mono text-pink-600 font-semibold">{detailsTarget.id}</span> • Hub: {detailsTarget.lastMission}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailsTarget(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-pink-50/40 border border-pink-100 p-3.5 rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Delivery Safety Score
                      </div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {detailsTarget.safety}%
                      </div>
                    </div>
                    <div className="bg-pink-50/40 border border-pink-100 p-3.5 rounded-xl">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Route Efficiency
                      </div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {detailsTarget.efficiency} <span className="text-xs font-normal text-slate-500">mpg</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Delivery Overview
                    </h4>
                    <div className="text-xs font-semibold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                      {detailsTarget.missions || 0} total deliveries completed in the recent period
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Recent Activity Log
                    </h4>
                    <ul className="space-y-2">
                      {getDriverLogs(detailsTarget.id).map((l) => (
                        <li
                          key={l.ts}
                          className="text-xs bg-slate-50 border border-slate-200/60 p-3 rounded-xl space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">
                              {new Date(l.ts).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-medium text-pink-700 bg-pink-100 px-2 py-0.5 rounded-md">
                              {l.note}
                            </span>
                          </div>
                          <div className="text-slate-600">{l.event}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-100 justify-end bg-slate-50/50">
                  <button
                    onClick={() => setDetailsTarget(null)}
                    className="rounded-xl border border-slate-200 hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setActionNotice(`Ticket created for ${detailsTarget.name}`);
                      setDetailsTarget(null);
                      setTimeout(() => setActionNotice(null), 2500);
                    }}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-semibold transition-all shadow-2xs"
                  >
                    Create Ticket
                  </button>
                  <button
                    onClick={() => {
                      const logs = getDriverLogs(detailsTarget.id);
                      const blob = new Blob([JSON.stringify(logs, null, 2)], {
                        type: "application/json",
                      });
                      const u = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = `${detailsTarget.id}-logs.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(u);
                      setActionNotice("Logs exported");
                      setTimeout(() => setActionNotice(null), 2500);
                    }}
                    className="rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 px-4 py-2 text-xs font-semibold text-pink-700 transition-all"
                  >
                    Export Logs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Action Notice Toast */}
          {actionNotice && (
            <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-pink-200 bg-white text-slate-900 px-5 py-3.5 shadow-xl shadow-pink-500/10 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
              <span className="material-symbols-outlined text-pink-600 text-[20px]">
                check_circle
              </span>
              <span className="text-xs font-bold">{actionNotice}</span>
            </div>
          )}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}



 