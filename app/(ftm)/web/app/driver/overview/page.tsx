"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAlertsSnapshot, getDrivers, getTrips } from "../../lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type TripRecord = { id?: string; driver_id?: string; driverId?: string; status?: string; created_at?: string; createdAt?: string };

function isCompletedTrip(trip: TripRecord) {
  return /completed|delivered/i.test(trip.status ?? "");
}

function isLateTrip(trip: TripRecord) {
  return /delayed|late|exception/i.test(trip.status ?? "");
}

function buildTripStatusData(trips: TripRecord[]) {
  const statuses = [
    { name: "Completed", value: 0, color: "#b80049" },
    { name: "In Transit", value: 0, color: "#4f8dff" },
    { name: "Delayed", value: 0, color: "#f59e0b" },
    { name: "Pending", value: 0, color: "#94a3b8" },
  ];

  for (const trip of trips) {
    const status = trip.status ?? "";
    if (isCompletedTrip(trip)) statuses[0].value += 1;
    else if (isLateTrip(trip)) statuses[2].value += 1;
    else if (/transit|assigned|dispatch|picked|out for delivery/i.test(status)) statuses[1].value += 1;
    else statuses[3].value += 1;
  }

  return statuses.filter((status) => status.value > 0);
}

function buildDriverWorkloadData(drivers: any[], trips: TripRecord[]) {
  const tripsByDriver = new Map<string, { total: number; completed: number }>();
  for (const trip of trips) {
    const driverId = trip.driver_id ?? trip.driverId;
    if (!driverId) continue;
    const current = tripsByDriver.get(String(driverId)) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (isCompletedTrip(trip)) current.completed += 1;
    tripsByDriver.set(String(driverId), current);
  }

  return drivers
    .map((driver) => {
      const stats = tripsByDriver.get(String(driver.id)) ?? { total: 0, completed: 0 };
      return {
        name: String(driver.full_name ?? driver.fullName ?? driver.name ?? "Driver").split(" ")[0],
        assigned: stats.total,
        completed: stats.completed,
      };
    })
    .filter((driver) => driver.assigned > 0)
    .sort((left, right) => right.assigned - left.assigned)
    .slice(0, 6);
}

function buildOverviewTrend(trips: TripRecord[], metric: "Efficiency" | "Volume", range: string) {
  const now = new Date();
  const days = range === "Last 7 Days" ? 7 : range === "Last 30 Days" ? 30 : now.getDate();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  const bucketDays = range === "Last 7 Days" ? 1 : 7;
  const buckets = Array.from({ length: Math.ceil(days / bucketDays) }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index * bucketDays);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + bucketDays);
    return { bucketStart, bucketEnd, trips: [] as TripRecord[] };
  });

  for (const trip of trips) {
    const createdAt = new Date(trip.created_at ?? trip.createdAt ?? "");
    const bucket = buckets.find(({ bucketStart, bucketEnd }) => createdAt >= bucketStart && createdAt < bucketEnd);
    if (bucket) bucket.trips.push(trip);
  }

  return buckets.map(({ bucketStart, trips: bucketTrips }) => {
    const completed = bucketTrips.filter(isCompletedTrip).length;
    return {
      period: bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: metric === "Volume" ? bucketTrips.length : bucketTrips.length ? Math.round((completed / bucketTrips.length) * 100) / 10 : 0,
    };
  });
}

function buildOverviewMetrics(drivers: any[], trips: TripRecord[], incidents: any[]) {
  const totalTrips = trips.length;
  const completedTrips = trips.filter(isCompletedTrip).length;
  const lateTrips = trips.filter(isLateTrip).length;
  const activeDrivers = new Set(trips.map((trip) => trip.driver_id ?? trip.driverId).filter(Boolean)).size;
  const safety = drivers.length ? Math.max(0, Math.round((1 - incidents.length / drivers.length) * 100)) : null;
  const efficiency = totalTrips ? Math.round((completedTrips / totalTrips) * 100) / 10 : null;
  const onTime = totalTrips ? Math.max(0, Math.round(((totalTrips - lateTrips) / totalTrips) * 100)) : null;
  const tripsByDriver = new Map<string, number>();
  for (const trip of trips) {
    const driverId = trip.driver_id ?? trip.driverId;
    if (driverId) tripsByDriver.set(driverId, (tripsByDriver.get(driverId) ?? 0) + 1);
  }
  const top = [...drivers].sort((left, right) => (tripsByDriver.get(right.id) ?? 0) - (tripsByDriver.get(left.id) ?? 0))[0] ?? null;
  return { metrics: { safety, efficiency, onTime, activeDrivers }, top: top ? { name: top.full_name ?? top.name ?? "Driver", deliveries: tripsByDriver.get(top.id) ?? 0, onTime: onTime === null ? "—" : `${onTime}%` } : null };
}

export default function DriverOverviewPage() {
  const overviewKpiIds = ["safety", "efficiency", "on-time", "total-trips", "completed", "exceptions"];
  const [selectedRange, setSelectedRange] = useState<
    "Last 7 Days" | "Last 30 Days" | "This Month"
  >("Last 30 Days");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [selectedChart, setSelectedChart] = useState<"Efficiency" | "Volume">(
    "Efficiency"
  );
  const [alerts, setAlerts] = useState<any[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<{safety:number|null, efficiency:number|null, onTime:number|null, activeDrivers:number}>({ safety: null, efficiency: null, onTime: null, activeDrivers: 0 });
  const [topPerformer, setTopPerformer] = useState<any>(null);
  const [driverRecords, setDriverRecords] = useState<any[]>([]);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenKpis, setHiddenKpis] = useState<Set<string>>(new Set(overviewKpiIds));
  const router = useRouter();

  useEffect(() => {
    const handleVisibilityShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setHiddenKpis(new Set());
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setHiddenKpis(new Set(overviewKpiIds));
      }
    };

    window.addEventListener("keydown", handleVisibilityShortcut);
    return () => window.removeEventListener("keydown", handleVisibilityShortcut);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      try {
        if (mounted) setLoadError(null);
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

        // Fetch the page-specific records used to compute its KPIs.
        try {
          const [drivers, trips] = await Promise.all([getDrivers(), getTrips({ light: true })]);
          const overview = buildOverviewMetrics(drivers, trips, snap.incidents || []);
          if (mounted) {
            setTrips(trips);
            setDriverRecords(drivers);
            setOverviewMetrics(overview.metrics);
            setTopPerformer(overview.top);
            // determine if there's any real data to show
            const has = Boolean(drivers.length + trips.length + (snap.incidents || []).length + (snap.notifications || []).length + (snap.trackingEvents || []).length);
            setHasData(has);
          }
        } catch (e) {
          console.warn('Failed to load driver overview records', e);
          if (mounted) setLoadError("Unable to load driver and trip records. Please try again.");
        }
      } catch (e) {
        console.warn('Failed to load alerts', e);
        if (mounted) setLoadError("Unable to load the operational alerts. Please try again.");
      }
    }
    loadAlerts();
    return () => { mounted = false; };
  }, []);

  const refresh = () => {
    setHasData(null);
    setLoadError(null);
    setIsRefreshing(true);
    setOverviewMetrics({ safety: null, efficiency: null, onTime: null, activeDrivers: 0 });
    setTopPerformer(null);
    // Use the lightweight driver and trip endpoints: the aggregate dashboard endpoint
    // can wait on optional data sources that are unrelated to this page.
    (async () => {
      try {
        const snap = await getAlertsSnapshot();
        const [drivers, trips] = await Promise.all([getDrivers(), getTrips({ light: true })]);
        const overview = buildOverviewMetrics(drivers, trips, snap.incidents || []);
        setTrips(trips);
        setDriverRecords(drivers);
        setOverviewMetrics(overview.metrics);
        const has = Boolean(drivers.length + trips.length + (snap.incidents || []).length + (snap.notifications || []).length + (snap.trackingEvents || []).length);
        setHasData(has);
        setTopPerformer(overview.top);
        const items: any[] = [];
        (snap.incidents || []).forEach((inc: any) => items.push({ id: `inc-${inc.id}`, title: inc.incidentType || 'Incident', meta: inc.reportedAt || inc.reported_at || '', icon: 'warning', severity: 'high' }));
        (snap.notifications || []).forEach((n: any) => items.push({ id: `not-${n.id}`, title: n.title || 'Notification', meta: n.createdAt || n.created_at || '', icon: 'notifications', severity: 'low' }));
        setAlerts(items.slice(0,10));
      } catch (e) {
        console.warn('refresh failed', e);
        setLoadError("Unable to refresh the driver overview. Please try again.");
      } finally {
        setIsRefreshing(false);
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
    () => buildOverviewTrend(trips, selectedChart, selectedRange),
    [trips, selectedChart, selectedRange]
  );
  const tripStatusData = useMemo(() => buildTripStatusData(trips), [trips]);
  const driverWorkloadData = useMemo(() => buildDriverWorkloadData(driverRecords, trips), [driverRecords, trips]);
  const completedTrips = trips.filter(isCompletedTrip).length;
  const exceptionTrips = trips.filter(isLateTrip).length;
  const toggleKpiVisibility = (id: string) => {
    setHiddenKpis((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const renderKpiValue = (id: string, value: string | number) => hiddenKpis.has(id) ? "***" : value;
  const kpiCards = [
    { id: "safety", label: "Safety Score", icon: "health_and_safety", badge: "Live", badgeClass: "bg-pink-50 text-pink-700", value: overviewMetrics.safety ?? "—", suffix: "/100" },
    { id: "efficiency", label: "Route Efficiency", icon: "speed", badge: "Active", badgeClass: "bg-emerald-50 text-emerald-700", value: overviewMetrics.efficiency ?? "—", suffix: "/10" },
    { id: "on-time", label: "On-Time Rate", icon: "schedule", badge: "KPI", badgeClass: "bg-pink-50 text-pink-700", value: overviewMetrics.onTime ?? "—", suffix: "%" },
    { id: "total-trips", label: "Total Trips", icon: "local_shipping", badge: "Count", badgeClass: "bg-blue-50 text-blue-700", value: trips.length || "—", suffix: "" },
    { id: "completed", label: "Completed Trips", icon: "task_alt", badge: "Done", badgeClass: "bg-emerald-50 text-emerald-700", value: completedTrips, suffix: "", trend: `→ ${trips.length ? ((completedTrips / trips.length) * 100).toFixed(1) : "0.0"}%` },
    { id: "exceptions", label: "Exceptions", icon: "warning", badge: "Alert", badgeClass: "bg-amber-50 text-amber-700", value: exceptionTrips || "—", suffix: "" },
  ];

  const exportReport = () => {
    const headers = ["Trip ID", "Driver ID", "Status", "Created At"];
    const rows = trips.map((trip) => [trip.id ?? "", trip.driver_id ?? trip.driverId ?? "", trip.status ?? "", trip.created_at ?? trip.createdAt ?? ""]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `driver-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShowExportNotice(true);
    window.setTimeout(() => setShowExportNotice(false), 2500);
  };

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

        {/* Compact KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiCards.map((card) => (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleKpiVisibility(card.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") toggleKpiVisibility(card.id);
              }}
              className="flex min-h-[130px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 transition-colors hover:border-pink-300"
              aria-label={`${card.label}: click to ${hiddenKpis.has(card.id) ? "show" : "hide"} value`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="material-symbols-outlined text-[21px] text-[#b80049]">{card.icon}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.badgeClass}`}>{card.badge}</span>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xl font-black tracking-tight text-slate-900">
                  <span>{renderKpiValue(card.id, card.value)}</span>
                  <span className="text-[11px] font-bold text-slate-500">{hiddenKpis.has(card.id) ? "" : card.suffix}</span>
                  {card.trend && !hiddenKpis.has(card.id) && <span className="ml-1 text-[10px] font-bold text-slate-400">{card.trend}</span>}
                </div>
                <div className="mt-1 text-[11px] font-medium leading-tight text-slate-500">{card.label}</div>
              </div>
            </div>
          ))}
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
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100 text-xl font-bold text-[#b80049] ring-2 ring-pink-300">
                  {(topPerformer?.name ?? "—").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {topPerformer?.name ?? (hasData === false ? "—" : "—")}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Most trips in the selected records</div>
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
                  <button
                    type="button"
                    onClick={() => router.push("/alerts")}
                    className="text-[#b80049] hover:underline text-xs font-bold"
                  >
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

              <button
                type="button"
                onClick={() => router.push("/driver/safety")}
                className="mt-4 w-full py-2.5 rounded-xl bg-pink-50 text-[#b80049] border border-pink-200 hover:bg-pink-100 transition-all text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>Open Security Center</span>
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>

          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <section className="lg:col-span-2 bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Trip Status Mix</h2>
                <p className="text-xs text-slate-500 mt-0.5">Current distribution across loaded trips.</p>
              </div>
              <span className="material-symbols-outlined text-[#b80049]">donut_large</span>
            </div>
            {tripStatusData.length ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tripStatusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3}>
                      {tripStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderColor: "#fbcfe8", borderRadius: "12px", fontSize: "12px" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[250px] flex items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">No trip status data</div>}
          </section>

          <section className="lg:col-span-3 bg-white p-6 rounded-2xl border border-pink-100 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Driver Workload</h2>
                <p className="text-xs text-slate-500 mt-0.5">Assigned versus completed trips by active driver.</p>
              </div>
              <span className="material-symbols-outlined text-[#b80049]">bar_chart</span>
            </div>
            {driverWorkloadData.length ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={driverWorkloadData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderColor: "#fbcfe8", borderRadius: "12px", fontSize: "12px" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="assigned" name="Assigned" fill="#f9a8d4" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#b80049" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[250px] flex items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">No driver workload data</div>}
          </section>
        </div>

      </main>

      <GlobalFooter />
    </div>
  );
}
