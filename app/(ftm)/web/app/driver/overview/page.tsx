"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

import { useState, useMemo, useEffect } from "react";
import { getAlertsSnapshot, getDashboardSnapshot } from "../../lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const DRIVER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBrNiOJSbTNAaZuGuGh0lCnCHhmRrqnONBy6LeY68hsxPaIsW4Ed4mGPtmFo4AZBi-kCP8Mk_UZCfO4aDMbXRAGgbZFz6xAs6PDOpSCLUqRVgyfulPPwXQ_0vpHeGNBsI6dMpr9UMUphgaHST-xHDFPHwudCggRdXfo40Mw0uXKHm7hH0chn1W1_svnt-hf47kSe7bbF8AnDOKCs36ZfvOafSCxq0JesRL2XsZdIGxeepfjOaCmv2E1Xw";

// start with empty alerts; will be populated from Supabase

function generateOverviewTrend(metric: "Efficiency" | "Volume", range: string) {
  const points = range === "Last 7 Days" ? 7 : range === "Last 30 Days" ? 8 : 6;
  const data: { period: string; value: number }[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(
      now.getTime() - i * 24 * 60 * 60 * 1000 * (range === "Last 7 Days" ? 1 : 7)
    );
    const label =
      range === "Last 7 Days"
        ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : `Wk ${points - i}`;
    const base = metric === "Efficiency" ? 7.0 : 90;
    const variance = metric === "Efficiency" ? 0.6 : 25;
    const value =
      Math.round(
        (base + (Math.cos(i) * variance) / 10 + Math.random() * (variance / 4)) * 10
      ) / 10;
    data.push({ period: label, value });
  }
  return data;
}

export default function DriverOverviewPage() {
  const [selectedRange, setSelectedRange] = useState<
    "Last 7 Days" | "Last 30 Days" | "This Month"
  >("Last 30 Days");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [selectedChart, setSelectedChart] = useState<"Efficiency" | "Volume">(
    "Efficiency"
  );
  const [activeTab, setActiveTab] = useState("Overview");

  const [alerts, setAlerts] = useState<any[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<{safety:number|null, efficiency:number|null, onTime:number|null, activeDrivers:number}>({ safety: null, efficiency: null, onTime: null, activeDrivers: 0 });
  const [topPerformer, setTopPerformer] = useState<any>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      try {
        const snap = await getAlertsSnapshot();
        const items: any[] = [];
        (snap.incidents || []).forEach((inc: any) => {
          items.push({ id: `inc-${inc.id}`, title: inc.incidentType || 'Incident', meta: inc.reportedAt || inc.reported_at || '', icon: 'warning', severity: 'high' });
        });
        (snap.notifications || []).forEach((n: any) => {
          items.push({ id: `not-${n.id}`, title: n.title || 'Notification', meta: n.createdAt || n.created_at || '', icon: 'notifications', severity: 'low' });
        });
        (snap.trackingEvents || []).slice(-5).forEach((t: any, idx: number) => {
          items.push({ id: `evt-${idx}-${t.id || ''}`, title: 'Tracking event', meta: t.recordedAt || t.recorded_at || '', icon: 'gps_fixed', severity: 'low' });
        });
        if (mounted) setAlerts(items.slice(0, 10));

        // also fetch dashboard snapshot to compute KPIs
        try {
          const dash = await getDashboardSnapshot();
          const incidentsCount = (snap.incidents || []).length || 0;
          const driversCount = dash.counts?.drivers || (dash.drivers || []).length || 0;
          const tripsCount = dash.counts?.trips || (dash.trips || []).length || 0;
          const safety = driversCount || incidentsCount ? Math.max(60, 100 - incidentsCount * 3) : null;
          const efficiency = driversCount ? Math.round((7 + Math.min(3, tripsCount / Math.max(1, driversCount * 10))) * 10) / 10 : null;
          const onTime = driversCount ? Math.max(85, Math.round(95 - incidentsCount / Math.max(1, driversCount) * 2)) : null;
          if (mounted) {
            setOverviewMetrics({ safety, efficiency, onTime, activeDrivers: driversCount });
            const top = (dash.drivers || [])[0] ?? null;
            setTopPerformer(top ? { name: top.full_name ?? 'Driver', deliveries: Math.max(0, Math.floor(tripsCount / Math.max(1, driversCount || 1))), onTime: `${onTime ?? '—'}%` } : null);
            // determine if there's any real data to show
            const has = Boolean((dash.counts?.drivers || 0) + (dash.counts?.trips || 0) + (snap.incidents || []).length + (snap.notifications || []).length + (snap.trackingEvents || []).length);
            setHasData(has);
          }
        } catch (e) {
          console.warn('Failed to load dashboard snapshot', e);
        }
      } catch (e) {
        console.warn('Failed to load alerts', e);
      }
    }
    loadAlerts();
    return () => { mounted = false; };
  }, []);

  const refresh = () => {
    setHasData(null);
    setOverviewMetrics({ safety: null, efficiency: null, onTime: null, activeDrivers: 0 });
    setTopPerformer(null);
    // re-run effect by calling loader: simple approach - call getAlertsSnapshot/getDashboardSnapshot directly
    (async () => {
      try {
        const snap = await getAlertsSnapshot();
        const dash = await getDashboardSnapshot();
        const incidentsCount = (snap.incidents || []).length || 0;
        const driversCount = dash.counts?.drivers || (dash.drivers || []).length || 0;
        const tripsCount = dash.counts?.trips || (dash.trips || []).length || 0;
        const safety = driversCount || incidentsCount ? Math.max(60, 100 - incidentsCount * 3) : null;
        const efficiency = driversCount ? Math.round((7 + Math.min(3, tripsCount / Math.max(1, driversCount * 10))) * 10) / 10 : null;
        const onTime = driversCount ? Math.max(85, Math.round(95 - incidentsCount / Math.max(1, driversCount) * 2)) : null;
        setOverviewMetrics({ safety, efficiency, onTime, activeDrivers: driversCount });
        const has = Boolean((dash.counts?.drivers || 0) + (dash.counts?.trips || 0) + (snap.incidents || []).length + (snap.notifications || []).length + (snap.trackingEvents || []).length);
        setHasData(has);
        const items: any[] = [];
        (snap.incidents || []).forEach((inc: any) => items.push({ id: `inc-${inc.id}`, title: inc.incidentType || 'Incident', meta: inc.reportedAt || inc.reported_at || '', icon: 'warning', severity: 'high' }));
        (snap.notifications || []).forEach((n: any) => items.push({ id: `not-${n.id}`, title: n.title || 'Notification', meta: n.createdAt || n.created_at || '', icon: 'notifications', severity: 'low' }));
        setAlerts(items.slice(0,10));
      } catch (e) {
        console.warn('refresh failed', e);
      }
    })();
  };

  const cycleRange = () => {
    setSelectedRange((current) => {
      if (current === "Last 30 Days") return "This Month";
      if (current === "This Month") return "Last 7 Days";
      return "Last 30 Days";
    });
  };

  const chartData = useMemo(
    () => generateOverviewTrend(selectedChart, selectedRange),
    [selectedChart, selectedRange]
  );

  const TABS = [
    { label: "Overview", icon: "dashboard" },
    { label: "Driver Performance", icon: "monitoring" },
    { label: "Safety Scores", icon: "security" },
    { label: "Leaderboard", icon: "leaderboard" },
  ];

  return (
    <div className="bg-transparent text-inherit min-h-screen flex flex-col font-sans antialiased">
      <GlobalNavbar />

      {/* Main Container - Expands to maximum width */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-pink-100 text-[#b80049] rounded-full">
                Analytics
              </span>
              <span className="text-xs text-slate-400">• Live Updating</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
              Courier Operations Overview
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              Executive summary of delivery performance, safety metrics, and dispatch efficiency for the selected range.
            </p>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto">
            <button
              type="button"
              onClick={cycleRange}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-pink-50/60 border border-pink-200 text-slate-700 hover:bg-pink-100 hover:border-pink-300 transition-all text-xs font-semibold text-slate-800"
            >
              <span className="material-symbols-outlined text-[18px] text-[#b80049]">
                calendar_month
              </span>
              {selectedRange}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowExportNotice(true);
                window.setTimeout(() => setShowExportNotice(false), 2500);
              }}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#b80049] text-white hover:bg-[#96003b] transition-all text-xs font-semibold shadow-sm hover:shadow-pink-200"
            >
              <span className="material-symbols-outlined text-[18px]">
                download
              </span>
              Export Report
            </button>
          </div>
        </div>

        {/* Toast Export Notification */}
        {showExportNotice && (
          <div className="flex items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 text-[#b80049] px-5 py-3.5 shadow-sm text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="material-symbols-outlined text-[20px]">
              check_circle
            </span>
            Export request queued. Your summary is downloading shortly.
          </div>
        )}

        {/* Empty state when no Supabase data */}
        {hasData === false && (
          <div className="w-full flex items-center justify-center py-20">
            <div className="max-w-xl text-center p-8 bg-white rounded-2xl border border-pink-100 shadow-sm">
              <div className="text-3xl font-extrabold text-slate-900 mb-2">No data available</div>
              <div className="text-sm text-slate-500 mb-6">We couldn't find any driver, trip, or alert data in Supabase for the selected range. Seed some data or check your Supabase connection.</div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={refresh} className="px-4 py-2 rounded-xl bg-[#b80049] text-white font-semibold">Retry</button>
                <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-pink-50 text-[#b80049] border border-pink-100 font-semibold">Reload Page</button>
              </div>
            </div>
          </div>
        )}

        {/* Top KPI Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Safety Score */}
          <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-md hover:border-pink-300 transition-all relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-pink-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100/70 flex items-center justify-center text-[#b80049]">
                  <span className="material-symbols-outlined">
                    health_and_safety
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-600">
                  Safety Score
                </h3>
              </div>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  trending_up
                </span>
                +2.4%
              </span>
            </div>
            <div className="relative z-10 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{overviewMetrics.safety ?? '—'}</span>
              <span className="text-sm font-semibold text-slate-400">/100</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Excellent standing across active delivery units and courier routes.
            </p>
          </div>

          {/* Card 2: Fuel Efficiency */}
          <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-md hover:border-pink-300 transition-all relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-pink-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100/70 flex items-center justify-center text-[#b80049]">
                  <span className="material-symbols-outlined">speed</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-600">
                  Route Efficiency
                </h3>
              </div>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  trending_up
                </span>
                +1.1%
              </span>
            </div>
            <div className="relative z-10 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{overviewMetrics.efficiency ?? '—'}</span>
              <span className="text-sm font-semibold text-slate-400">/10</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Average route efficiency rate for this delivery cycle.
            </p>
          </div>

          {/* Card 3: On-Time Delivery Rate */}
          <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-md hover:border-pink-300 transition-all relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-pink-50 rounded-full group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100/70 flex items-center justify-center text-[#b80049]">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-600">
                  On-Time Rate
                </h3>
              </div>
              <span className="bg-rose-50 text-rose-600 border border-rose-100 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  trending_down
                </span>
                -0.5%
              </span>
            </div>
            <div className="relative z-10 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">{overviewMetrics.onTime ?? '—'}</span>
              <span className="text-sm font-semibold text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Deliveries completed within designated SLA window.
            </p>
          </div>

        </div>

        {/* Main Section: Chart + Secondary Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Analytics Chart (Spans 8 Columns) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Delivery Performance Trends
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate operational analytics breakdown over time.
                </p>
              </div>

              {/* Chart Toggle Pills */}
              <div className="flex bg-pink-50 p-1 rounded-xl border border-pink-100">
                <button
                  onClick={() => setSelectedChart("Efficiency")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedChart === "Efficiency"
                      ? "bg-white text-[#b80049] shadow-xs"
                      : "text-slate-600 hover:text-[#b80049]"
                  }`}
                >
                  Efficiency
                </button>
                <button
                  onClick={() => setSelectedChart("Volume")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedChart === "Volume"
                      ? "bg-white text-[#b80049] shadow-xs"
                      : "text-slate-600 hover:text-[#b80049]"
                  }`}
                >
                  Volume
                </button>
              </div>
            </div>

            {/* Recharts Wrapper */}
            <div className="w-full h-[340px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b80049" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#b80049" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={{ stroke: "#f1f5f9" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#fbcfe8",
                      borderRadius: "12px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#b80049"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#pinkGradient)"
                    activeDot={{ r: 6, fill: "#b80049", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side Column Widgets (Spans 4 Columns) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Top Performer Card */}
            <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#b80049] uppercase tracking-wider bg-pink-100 px-2.5 py-0.5 rounded-md">
                    Featured
                  </span>
                  <h3 className="text-base font-bold text-slate-900">Top Performer</h3>
                </div>
                <span className="material-symbols-outlined text-[#b80049]">
                  workspace_premium
                </span>
              </div>

              <div className="flex items-center gap-4">
                <img
                  alt="Top Driver"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-pink-300 p-0.5 bg-white shadow-xs"
                  src={DRIVER_AVATAR}
                />
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {topPerformer?.name ?? (hasData === false ? "—" : "—")}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Route 4B • Metro Area
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-[#b80049]">
                    <span className="material-symbols-outlined text-[16px] text-amber-500 fill-amber-500">
                      star
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      4.98 <span className="text-slate-400 font-normal">(120 reviews)</span>
                    </span>
                  </div>
                </div>
              </div>

                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                  <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100/60">
                    <div className="text-lg font-black text-slate-900">{topPerformer?.deliveries ?? '—'}</div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Deliveries
                    </div>
                  </div>
                  <div className="bg-pink-50/50 p-3 rounded-xl border border-pink-100/60">
                    <div className="text-lg font-black text-[#b80049]">{topPerformer?.onTime ?? '—'}</div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      On-Time
                    </div>
                  </div>
                </div>
            </div>

            {/* Recent Alerts List */}
            <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900">
                    Recent Alerts
                  </h3>
                  <button className="text-[#b80049] hover:underline text-xs font-bold">
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                        alert.severity === "high"
                          ? "bg-rose-50/60 border-rose-200"
                          : "bg-slate-50/70 border-slate-100 hover:bg-pink-50/40 hover:border-pink-200"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          alert.severity === "high"
                            ? "bg-rose-500 text-white shadow-xs"
                            : "bg-pink-100 text-[#b80049]"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {alert.icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {alert.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {alert.meta}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="mt-4 w-full py-2.5 rounded-xl bg-pink-50 text-[#b80049] border border-pink-200 hover:bg-pink-100 transition-all text-xs font-bold flex items-center justify-center gap-1">
                <span>Open Security Center</span>
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>

          </div>

        </div>

      </main>

      <GlobalFooter />
    </div>
  );
}