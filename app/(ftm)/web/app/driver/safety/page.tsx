"use client";

import { useState, useEffect } from "react";
import { getDashboardSnapshot, getAlertsSnapshot } from "../../lib/api";
import { usePathname } from "next/navigation";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

export default function DriverSafetyPage() {
  const [selectedRange, setSelectedRange] = useState<"Last 30 Days" | "Last Quarter" | "Year to Date">("Last 30 Days");
  const [showExportNotice, setShowExportNotice] = useState(false);

  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [riskDistributionState, setRiskDistributionState] = useState<any[]>([]);
  const [incidentsState, setIncidentsState] = useState<any[]>([]);
  const [driverSafetyState, setDriverSafetyState] = useState<any[]>([]);
  const [activeUnits, setActiveUnits] = useState<number>(0);
  const [hasData, setHasData] = useState<boolean | null>(null);

  const handleExport = () => {
    const rows: string[][] = [
      ["Metric", "Value", "Range"],
    ];
    if (safetyScore != null) rows.push(["Courier Safety Index", String(safetyScore), selectedRange]);
    riskDistributionState.forEach((risk) => rows.push([risk.label, `${risk.value}%`, selectedRange]));
    incidentsState.forEach((incident) => rows.push([incident.title, String(incident.count), selectedRange]));
    downloadCsv(`safety-score-${selectedRange.replace(/\s+/g, "-").toLowerCase()}.csv`, rows);
    setShowExportNotice(true);
    window.setTimeout(() => setShowExportNotice(false), 3000);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [snap, dash, driverRecords] = await Promise.all([
          getAlertsSnapshot(),
          getDashboardSnapshot(),
          import("../../lib/api").then(({ getDrivers }) => getDrivers()),
        ]);
        const incidents = (snap.incidents || []).map((r: any) => ({
          title: r.incidentType || r.incident_type || 'Incident',
          severity: 'N/A',
          count: 1,
          icon: 'warning',
          iconBg: 'bg-rose-50 text-[#b80049]',
          trend: '+0%'
        }));
        const drivers = dash.counts?.drivers || (dash.drivers || []).length || 0;
        const incidentsCount = (snap.incidents || []).length || 0;
        const safety = drivers || incidentsCount ? Math.round(Math.max(60, 100 - incidentsCount * 3) * 10) / 10 : null;
        const driverSafety = (driverRecords || []).map((driver: any, index: number) => {
          const id = String(driver.id ?? driver.driver_id ?? `driver-${index}`);
          const driverIncidents = (snap.incidents || []).filter(
            (incident: any) => String(incident.driverId ?? incident.driver_id ?? "") === id
          ).length;
          return {
            id,
            name: driver.full_name ?? driver.fullName ?? driver.name ?? driver.email ?? "Driver",
            incidents: driverIncidents,
            score: Math.max(0, 100 - driverIncidents * 8),
          };
        });
        // simple distribution if we have drivers
        const distribution = drivers ? [
          { label: 'Low Risk', value: Math.max(0, Math.round((drivers - incidentsCount) / Math.max(1, drivers) * 100)), color: 'bg-emerald-500' },
          { label: 'Medium Risk', value: Math.max(0, Math.min(100, Math.round((incidentsCount / Math.max(1, drivers)) * 50))), color: 'bg-amber-500' },
          { label: 'High Risk', value: Math.max(0, Math.min(100, Math.round((incidentsCount / Math.max(1, drivers)) * 25))), color: 'bg-[#b80049]' },
        ] : [];
        if (mounted) {
          setSafetyScore(safety);
          setRiskDistributionState(distribution);
          setIncidentsState(incidents);
          setDriverSafetyState(driverSafety);
          setActiveUnits(drivers);
          setHasData(Boolean(drivers + incidentsCount));
        }
      } catch (e) {
        console.warn('Failed to load safety snapshot', e);
      }
    })();
    return () => { mounted = false; };
  }, [selectedRange]);

  return (
    <div className="bg-transparent text-inherit min-h-screen flex flex-col font-sans">
      <GlobalNavbar />

      {/* Main Container - Full Screen Span */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-6 md:px-10 py-8 transition-all">
        <div className="flex flex-col gap-8">
          
          {/* Header Section */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-[#b80049]">
                  Live Safety Telematics
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Courier Safety Analytics
              </h1>
              <p className="text-slate-500 text-sm sm:text-base mt-1 max-w-2xl">
                Real-time overview of courier delivery safety performance, risk distribution, and critical incident tracking across active routes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
                className="px-4 py-2.5 bg-pink-50/50 border border-pink-200/80 rounded-xl text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#b80049] transition-all cursor-pointer hover:bg-pink-100/50"
              >
                <option>Last 30 Days</option>
                <option>Last Quarter</option>
                <option>Year to Date</option>
              </select>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#b80049] hover:bg-[#96003b] text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-pink-900/20 active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                Export Report
              </button>
            </div>
          </header>

          {/* Export Notification Toast */}
          {showExportNotice && (
            <div className="flex items-center gap-3 rounded-xl border border-pink-300 bg-pink-50 text-[#b80049] px-5 py-3 text-sm font-medium shadow-sm animate-fade-in">
              <span className="material-symbols-outlined text-xl">check_circle</span>
              <span>Report exported successfully! Preparing your safety data download...</span>
            </div>
          )}

          {/* Empty state banner intentionally removed; render compact placeholders instead */}

          {/* Bento Grid layout - Full Width Spanning */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Courier Safety Index Card */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-6 sm:p-8 border border-pink-100 shadow-sm shadow-pink-900/5 flex flex-col justify-between relative overflow-hidden group hover:border-pink-300 transition-all">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#b80049] via-pink-400 to-[#b80049]" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Courier Safety Index</h2>
                  <p className="text-xs text-slate-500">Delivery safety metric</p>
                </div>
                <span className="p-2 bg-pink-50 text-[#b80049] rounded-lg">
                  <span className="material-symbols-outlined text-xl">verified_user</span>
                </span>
              </div>

              {/* Gauge Graphic */}
              <div className="relative w-52 h-52 mx-auto my-4 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="pinkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#b80049" />
                      <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                  {/* Outer Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#fce7f3"
                    strokeWidth="9"
                  />
                  {/* Gauge Arc Progress */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="url(#pinkGradient)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={safetyScore != null ? String(Math.max(0, 251.2 - (safetyScore / 100) * 251.2)) : "251.2"}
                    className="transition-all duration-1000 ease-out group-hover:drop-shadow-[0_0_8px_rgba(184,0,73,0.35)]"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                    {safetyScore != null ? String(safetyScore) : '—'}
                    <span className="text-2xl text-[#b80049]">{safetyScore != null ? '' : ''}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    +1.2%
                  </div>
                </div>
              </div>

              <div className="text-center bg-pink-50/50 rounded-xl p-3 border border-pink-100">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Overall safety score based on live telematics across <span className="font-semibold text-slate-900">{activeUnits || '—'} active delivery units</span>.
                </p>
              </div>
            </div>

            {/* Risk Distribution Card */}
            <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 border border-pink-100 shadow-sm shadow-pink-900/5 flex flex-col justify-between hover:border-pink-300 transition-all">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Risk Distribution</h2>
                    <p className="text-xs text-slate-500">Delivery unit safety categorization based on driver behavior</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Optimal
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Monitor
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#b80049]" /> Critical
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-6 my-4">
                  {riskDistributionState.length ? riskDistributionState.map((r) => (
                    <div key={r.label} className="group/risk flex items-center gap-4">
                      <div className="w-28 text-sm font-semibold text-slate-700">
                        {r.label}
                      </div>
                      <div className="flex-1 h-5 bg-pink-50 rounded-full overflow-hidden p-0.5 border border-pink-100">
                        <div
                          className={`h-full rounded-full ${r.color} transition-all duration-500 group-hover/risk:brightness-105`}
                          style={{ width: `${r.value}%` }}
                        />
                      </div>
                      <div className="w-14 text-sm font-bold text-slate-900 text-right">
                        {r.value}%
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-slate-500">No risk distribution data available.</div>
                  )}
                </div>
              </div>

              {/* Stat Summary Footer */}
              <div className="grid grid-cols-3 gap-4 pt-4 mt-6 border-t border-pink-100 text-center">
                <div className="p-3 bg-pink-50/40 rounded-xl">
                  <span className="text-xs text-slate-500 block">Active Units</span>
                  <span className="text-base font-bold text-slate-900">{activeUnits || '—'}</span>
                </div>
                <div className="p-3 bg-pink-50/40 rounded-xl">
                  <span className="text-xs text-slate-500 block">Monitored</span>
                  <span className="text-base font-bold text-slate-900">{riskDistributionState.length ? riskDistributionState[1]?.value ?? '—' : '—'} Delivery Units</span>
                </div>
                <div className="p-3 bg-pink-50/40 rounded-xl">
                  <span className="text-xs text-slate-500 block">High Risk</span>
                  <span className="text-base font-bold text-[#b80049]">{riskDistributionState.length ? riskDistributionState[2]?.value ?? '—' : '—'} Delivery Units</span>
                </div>
              </div>
            </div>

            {/* Driver Safety Roster */}
            <div className="lg:col-span-12 overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm shadow-pink-900/5">
              <div className="border-b border-pink-100 px-6 py-5 sm:px-8">
                <h2 className="text-lg font-bold text-slate-900">Driver Safety Roster</h2>
                <p className="text-xs text-slate-500">Individual safety scores calculated from reported incidents</p>
              </div>
              {driverSafetyState.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-pink-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-6 py-3.5">Driver</th>
                        <th className="px-6 py-3.5">Safety Score</th>
                        <th className="px-6 py-3.5">Reported Incidents</th>
                        <th className="px-6 py-3.5">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {driverSafetyState.map((driver) => (
                        <tr key={driver.id} className="hover:bg-pink-50/30">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{driver.name}</div>
                            <div className="font-mono text-[11px] text-pink-600">{driver.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="w-8 font-bold text-slate-900">{driver.score}%</span>
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-pink-600" style={{ width: `${driver.score}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700">{driver.incidents}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${driver.score >= 90 ? "bg-emerald-50 text-emerald-700" : driver.score >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                              {driver.score >= 90 ? "Low Risk" : driver.score >= 70 ? "Monitor" : "High Risk"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-6 py-8 text-sm text-slate-500 sm:px-8">No driver safety data available.</p>
              )}
            </div>

            {/* Incident Logs Table / Cards */}
            <div className="lg:col-span-12 bg-white rounded-2xl p-6 sm:p-8 border border-pink-100 shadow-sm shadow-pink-900/5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Top Delivery Safety Incidents</h2>
                  <p className="text-xs text-slate-500">Frequent delivery and route issues flagged by driver monitoring</p>
                </div>
                <button className="inline-flex items-center gap-1 text-sm font-bold text-[#b80049] hover:text-[#8a0037] hover:underline transition-colors">
                  View Detailed Safety Logs
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {incidentsState.length ? incidentsState.map((incident) => (
                  <div
                    key={incident.title}
                    className="group border border-pink-100 rounded-xl p-5 bg-white hover:border-pink-300 hover:shadow-md hover:shadow-pink-900/5 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${incident.iconBg}`}>
                            <span className="material-symbols-outlined text-2xl">{incident.icon}</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{incident.title}</h3>
                            <span className="text-xs font-medium text-slate-500">{incident.severity}</span>
                          </div>
                        </div>
                        <span className="bg-pink-50 text-[#b80049] text-xs font-bold px-2.5 py-1 rounded-full border border-pink-100">
                          {incident.count}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-500 font-medium">Monthly Trend</span>
                        <span className={`inline-flex items-center gap-0.5 font-bold ${incident.trendColor}`}>
                          <span className="material-symbols-outlined text-sm">
                            {incident.trendUp ? "trending_up" : "trending_down"}
                          </span>
                          {incident.trend}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-pink-50 rounded-full overflow-hidden border border-pink-100/80">
                        <div className={`h-full ${incident.barColor} ${incident.barWidth} rounded-full transition-all duration-300`} />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-slate-500">No incident reports available.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

// Data sets are sourced from Supabase via `getAlertsSnapshot()` and `getDashboardSnapshot()` above.

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function SubNav() {
  const pathname = usePathname();
  const TABS = [
    { label: "Overview", href: "/driver/overview", icon: "dashboard" },
    { label: "Driver Performance", href: "/driver/performance", icon: "monitoring" },
    { label: "Safety Scores", href: "/driver/safety", icon: "security" },
    { label: "Leaderboard", href: "/driver/leaderboard", icon: "leaderboard" },
  ];

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-pink-100 sticky top-0 z-30 w-full">
      <div className="flex justify-start items-center gap-6 sm:gap-8 px-4 sm:px-6 md:px-10 w-full max-w-[1800px] mx-auto h-14 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const active = pathname === tab.href || tab.href === "/driver/safety";
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 h-full whitespace-nowrap text-sm font-semibold transition-all border-b-2 ${
                active
                  ? "text-[#b80049] border-[#b80049]"
                  : "text-slate-500 border-transparent hover:text-[#b80049]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}