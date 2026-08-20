"use client";

import { useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

// --- Types ---
type Period = "This Week" | "This Month" | "YTD";

interface AnomalyAlert {
  id: string;
  target: string;
  type: "High Idle" | "Low Efficiency" | "Irregular Draw";
  severity: "critical" | "warning";
  description: string;
  metric: string;
}

export default function FuelConsumptionPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("This Week");
  const [investigateTarget, setInvestigateTarget] = useState<AnomalyAlert | null>(null);
  const [showHeatmapFilters, setShowHeatmapFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "diesel" | "ev">("all");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Quick Action Feedback
  const triggerToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const [hasData, setHasData] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dash = await getDashboardSnapshot();
        const logs = dash.fuelLogs || [];
        if (mounted) {
          setHasData(Boolean(logs.length));
          setSnapshot(dash);
        }
      } catch (e) {
        console.warn('Failed to load fuel snapshot', e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When no data, we'll keep rendering the page but components should display placeholders (0 / "—").

  // Derived view data (computed from snapshot when available)
  const chartDataView = (() => {
    const labels = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const buckets = labels.map((l) => ({ label: l, diesel: 0, ev: 0, total: "0" }));
    if (!hasData || !snapshot) return buckets;
    const logs = snapshot.fuelLogs || [];
    const vehicles = snapshot.vehicles || [];
    for (const log of logs) {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      const hour = date.getHours();
      const idx = Math.floor(hour / 3) % 8;
      const liters = Number(log.liters ?? log.amount ?? 0) || 0;
      const vehicle = vehicles.find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const vtype = String(vehicle?.vehicle_type ?? vehicle?.vehicleType ?? vehicle?.model ?? "").toLowerCase();
      if (/ev|electric/.test(vtype)) buckets[idx].ev += liters;
      else buckets[idx].diesel += liters;
    }
    for (const b of buckets) {
      b.total = (b.diesel + b.ev).toFixed(1);
    }
    return buckets;
  })();

  const classBreakdownView = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const vehicles = snapshot.vehicles || [];
    const logs = snapshot.fuelLogs || [];
    const groups: Record<string, { icon: string; label: string; count: number; value: number; efficiency: string; bar: string }> = {};
    for (const v of vehicles) {
      const t = String(v.vehicle_type ?? v.vehicleType ?? "").toLowerCase();
      let key = "Other";
      if (/rig|truck|class/.test(t)) key = "Heavy Rig";
      else if (/ev|electric/.test(t)) key = "EV Delivery Vans";
      else if (/bike|pedal|cargo/.test(t)) key = "Urban Cargo eBikes";
      if (!groups[key]) groups[key] = { icon: key === "Heavy Rig" ? "local_shipping" : key === "EV Delivery Vans" ? "electric_car" : "pedal_bike", label: key, count: 0, value: 0, efficiency: "—", bar: key === "Heavy Rig" ? "bg-[#1e1a1c]" : key === "EV Delivery Vans" ? "bg-[#ec2188]" : "bg-[#b80049]" };
      groups[key].count += 1;
    }
    for (const log of logs) {
      const v = vehicles.find((x: any) => x.id === (log.vehicleId ?? log.vehicle_id));
      const t = String(v?.vehicle_type ?? v?.vehicleType ?? "").toLowerCase();
      const liters = Number(log.liters ?? log.amount ?? 0) || 0;
      const key = /rig|truck|class/.test(t) ? "Heavy Rig" : /ev|electric/.test(t) ? "EV Delivery Vans" : /bike|pedal|cargo/.test(t) ? "Urban Cargo eBikes" : "Other";
      if (groups[key]) groups[key].value += liters;
    }
    const items = Object.values(groups).map((g) => ({ ...g, value: `${Math.round(g.value)} kWh` }));
    return items;
  })();

  const anomaliesView = (() => {
    if (!hasData || !snapshot) return [] as AnomalyAlert[];
    // simple anomaly detection: very large single-fill events
    const logs = snapshot.fuelLogs || [];
    const alerts: AnomalyAlert[] = [];
    for (const log of logs) {
      const liters = Number(log.liters ?? log.amount ?? 0) || 0;
      if (liters > 500) {
        alerts.push({ id: String(log.id ?? Math.random()), target: `Unit ${log.vehicleId ?? "?"}`, type: "High Idle", severity: "critical", description: `Large refuel event of ${liters}`, metric: `${liters}` });
      }
    }
    return alerts;
  })();

  const recentEventsView = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const logs = (snapshot.fuelLogs || []).slice().sort((a: any, b: any) => new Date(b.loggedAt ?? b.logged_at ?? b.createdAt ?? b.created_at ?? 0).getTime() - new Date(a.loggedAt ?? a.logged_at ?? a.createdAt ?? a.created_at ?? 0).getTime());
    const vehicles = snapshot.vehicles || [];
    return logs.slice(0, 8).map((l: any) => {
      const date = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? Date.now());
      const v = vehicles.find((x: any) => x.id === (l.vehicleId ?? l.vehicle_id));
      const vtype = String(v?.vehicle_type ?? v?.vehicleType ?? "").toLowerCase();
      const unit = /ev|electric/.test(vtype) ? "kWh" : "Gal";
      return { id: l.id ?? "-", type: /ev|electric/.test(vtype) ? "Electric" : "Diesel", location: l.station ?? "—", amount: `${Math.round(Number(l.liters ?? l.amount ?? 0) || 0)} ${unit}`, cost: l.cost ? `$${Number(l.cost).toFixed(2)}` : "—", time: date.toLocaleTimeString() };
    });
  })();

  // KPIs computed from snapshot (fallbacks when no data)
  const kpiTotalFuelUsage = (() => {
    if (!hasData || !snapshot) return "—";
    const totalLiters = (snapshot.fuelLogs || []).reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0);
    return `${Math.round(totalLiters).toLocaleString()} kWh`;
  })();

  const kpiAvgEfficiency = (() => {
    if (!hasData || !snapshot) return "—";
    const logs = snapshot.fuelLogs || [];
    const totalLiters = logs.reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0);
    const totalDistance = logs.reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0);
    const eff = totalLiters > 0 ? (totalDistance / totalLiters) : 0;
    return eff ? `${eff.toFixed(2)} mi/kWh` : "—";
  })();

  const kpiIdleWaste = (() => {
    if (!hasData || !snapshot) return "—";
    // simple estimate: sum of logs marked as idle or with very low distance
    const logs = snapshot.fuelLogs || [];
    const idleLiters = logs.filter((l: any) => (l.idle === true) || Number(l.distance ?? 0) < 1).reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0);
    return `${Math.round(idleLiters).toLocaleString()} kWh`;
  })();

  const kpiDispatchEfficiency = (() => {
    if (!hasData || !snapshot) return "—";
    // heuristic: percent of trips with optimized=true
    const trips = snapshot.trips || [];
    if (!trips.length) return "—";
    const optimized = trips.filter((t: any) => Boolean(t.optimized) || Boolean(t.isOptimized)).length;
    const pct = Math.round((optimized / trips.length) * 100);
    return `${pct}%`;
  })();

  // small helper to compute percent change between two numbers
  function percentChange(current: number, previous: number) {
    if (previous === 0 || !isFinite(previous)) return "—";
    const diff = current - previous;
    const pct = (diff / Math.abs(previous)) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  // compute deltas over the last 30 days vs previous 30 days
  const now = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000;
  const windowDays = 30;

  function sumLogsInRange(startMs: number, endMs: number, predicate?: (l: any) => boolean) {
    if (!snapshot) return 0;
    const logs = snapshot.fuelLogs || [];
    return logs.reduce((s: number, l: any) => {
      const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
      if (ts >= startMs && ts <= endMs && (!predicate || predicate(l))) {
        return s + Number(l.liters ?? l.amount ?? 0);
      }
      return s;
    }, 0);
  }

  const periodEnd = now;
  const periodStart = now - windowDays * MS_DAY;
  const prevPeriodStart = periodStart - windowDays * MS_DAY;
  const prevPeriodEnd = periodStart - 1;

  const totalCurrent = hasData && snapshot ? sumLogsInRange(periodStart, periodEnd) : 0;
  const totalPrevious = hasData && snapshot ? sumLogsInRange(prevPeriodStart, prevPeriodEnd) : 0;
  const totalChange = percentChange(totalCurrent, totalPrevious);

  const idleCurrent = hasData && snapshot ? sumLogsInRange(periodStart, periodEnd, (l) => Boolean(l.idle) || Number(l.distance ?? 0) < 1) : 0;
  const idlePrevious = hasData && snapshot ? sumLogsInRange(prevPeriodStart, prevPeriodEnd, (l) => Boolean(l.idle) || Number(l.distance ?? 0) < 1) : 0;
  const idleChange = percentChange(idleCurrent, idlePrevious);

  // efficiency: distance / liters
  function sumDistanceInRange(startMs: number, endMs: number) {
    if (!snapshot) return 0;
    const logs = snapshot.fuelLogs || [];
    return logs.reduce((s: number, l: any) => {
      const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
      if (ts >= startMs && ts <= endMs) return s + Number(l.distance ?? 0);
      return s;
    }, 0);
  }

  const distCurrent = hasData && snapshot ? sumDistanceInRange(periodStart, periodEnd) : 0;
  const distPrevious = hasData && snapshot ? sumDistanceInRange(prevPeriodStart, prevPeriodEnd) : 0;

  const effCurrent = totalCurrent > 0 ? distCurrent / totalCurrent : 0;
  const effPrevious = totalPrevious > 0 ? distPrevious / totalPrevious : 0;
  const efficiencyChange = effPrevious > 0 ? percentChange(effCurrent, effPrevious) : "—";

  const tripsCurrent = hasData && snapshot ? (snapshot.trips || []).filter((t: any) => {
    const ts = new Date(t.createdAt ?? t.created_at ?? 0).getTime();
    return ts >= periodStart && ts <= periodEnd;
  }) : [];
  const tripsPrevious = hasData && snapshot ? (snapshot.trips || []).filter((t: any) => {
    const ts = new Date(t.createdAt ?? t.created_at ?? 0).getTime();
    return ts >= prevPeriodStart && ts <= prevPeriodEnd;
  }) : [];
  const optCurrent = tripsCurrent.filter((t: any) => Boolean(t.optimized) || Boolean(t.isOptimized)).length;
  const optPrevious = tripsPrevious.filter((t: any) => Boolean(t.optimized) || Boolean(t.isOptimized)).length;
  const dispatchChange = percentChange(optCurrent, optPrevious);

  const toggleHeatmapFilters = () => {
    setShowHeatmapFilters((prev) => !prev);
    triggerToast(`Depot filters ${showHeatmapFilters ? "hidden" : "activated"}`);
  };

  return (
    <div className="min-h-screen bg-[#faf8f9] text-[#1e1a1c] font-sans flex flex-col selection:bg-[#b80049] selection:text-white">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#b80049] text-white px-5 py-3 rounded-2xl shadow-xl shadow-[#b80049]/20 animate-slide-up text-sm font-medium">
          <Icon name="info" className="text-lg" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Global Navigation */}
      <GlobalNavbar />

      {/* Main Dashboard Layout - Full Screen Width Utilization */}
      <main className="flex-grow w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-8 flex flex-col gap-8">
        
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-[#b80049]/10 shadow-[0_4px_24px_rgba(184,0,73,0.03)]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#b80049]/10 text-[#b80049] text-xs font-bold rounded-full uppercase tracking-wider">
                Courier Operations Analytics
              </span>
              <span className="text-xs text-[#706068] font-mono">Updated 2 mins ago</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#1e1a1c]">
              Fuel Consumption &amp; Courier Dispatch Operations
            </h1>
            <p className="text-sm lg:text-base text-[#6b5862]">
              Real-time monitoring of fuel use, route efficiency, and depot distribution across Airship Express delivery operations.
            </p>
          </div>

          {/* Timeframe & Category Switches */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-[#f5eef2] p-1.5 rounded-2xl border border-[#b80049]/10">
              {(["This Week", "This Month", "YTD"] as Period[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    selectedPeriod === period
                      ? "bg-[#b80049] text-white shadow-md shadow-[#b80049]/25 scale-[1.02]"
                      : "text-[#6b5862] hover:text-[#b80049] hover:bg-[#b80049]/5"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <button
              onClick={() => triggerToast("Exporting Courier Fuel Report (CSV)...")}
              className="px-4 py-2.5 bg-[#1e1a1c] hover:bg-[#b80049] text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <Icon name="download" className="text-base" /> Export Data
            </button>
          </div>
        </div>

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            title="Total Delivery Fuel Usage"
            value={kpiTotalFuelUsage}
            change={totalChange}
            isIncreaseBad={true}
            subtext={totalChange !== "—" ? `${totalChange} vs previous 30 days` : ""}
            icon="bolt"
            accent="pink"
          />
          <KpiCard
            title="Avg Delivery Efficiency"
            value={kpiAvgEfficiency}
            change={efficiencyChange}
            isIncreaseBad={false}
            subtext={efficiencyChange !== "—" ? `${efficiencyChange} vs previous 30 days` : ""}
            icon="speed"
            accent="green"
          />
          <KpiCard
            title="Idle Route Waste"
            value={kpiIdleWaste}
            change={idleChange}
            isIncreaseBad={false}
            subtext={idleChange !== "—" ? `${idleChange} vs previous 30 days` : ""}
            icon="timer"
            accent="orange"
          />
          <KpiCard
            title="Dispatch Efficiency Progress"
            value={kpiDispatchEfficiency}
            change={dispatchChange}
            isIncreaseBad={false}
            subtext={dispatchChange !== "—" ? `${dispatchChange} vs previous 30 days` : ""}
            icon="eco"
            accent="pink"
          />
        </div>

        {/* Primary Interactive Section: Chart + Anomaly Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Energy Consumption Chart (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 lg:p-8 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)] flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1e1a1c]">Consumption Flow &amp; Peak Loads</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#b80049]/10 text-[#b80049]">
                    Dual-Stream
                  </span>
                </div>
                <p className="text-xs text-[#706068]">Hourly breakdown comparing route fuel draw and delivery load demand</p>
              </div>

              {/* Stream Filters */}
              <div className="flex items-center gap-2 bg-[#faf8f9] p-1 rounded-xl border border-gray-100">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    activeTab === "all" ? "bg-white text-[#b80049] shadow-sm" : "text-[#706068]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab("diesel")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    activeTab === "diesel" ? "bg-white text-[#1e1a1c] shadow-sm" : "text-[#706068]"
                  }`}
                >
                  Diesel
                </button>
                <button
                  onClick={() => setActiveTab("ev")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    activeTab === "ev" ? "bg-white text-[#ec2188] shadow-sm" : "text-[#706068]"
                  }`}
                >
                  Electric
                </button>
              </div>
            </div>

            {/* Custom Interactive SVG Area/Bar Chart */}
            <div className="w-full h-[320px] relative flex flex-col justify-end pt-8">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                {[100, 75, 50, 25, 0].map((val) => (
                  <div key={val} className="border-b border-dashed border-[#b80049] w-full flex justify-between text-[10px] text-[#706068]">
                    <span>{val * 200} kGal</span>
                  </div>
                ))}
              </div>

              {/* Dynamic Bar Chart Visual */}
              <div className="w-full h-full flex items-end justify-between gap-2 z-10 pt-4">
                {chartDataView.map((d, i) => {
                  const isPeak = i === 7;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-12 z-20 bg-[#1e1a1c] text-white text-[11px] py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl">
                        <span className="font-bold text-[#ec2188]">{d.label}:</span> {d.total} kGal
                      </div>

                      {/* Stacked Bar Representation */}
                      <div className="w-full max-w-[36px] flex flex-col justify-end h-full gap-0.5">
                        {/* EV Component */}
                        {(activeTab === "all" || activeTab === "ev") && (
                          <div
                            style={{ height: `${d.ev}%` }}
                            className="w-full bg-gradient-to-t from-[#ec2188] to-[#ff66b3] rounded-t-sm transition-all duration-300 group-hover:brightness-110"
                          />
                        )}
                        {/* Diesel Component */}
                        {(activeTab === "all" || activeTab === "diesel") && (
                          <div
                            style={{ height: `${d.diesel}%` }}
                            className={`w-full transition-all duration-300 group-hover:brightness-110 ${
                              isPeak ? "bg-[#b80049]" : "bg-[#2d2529] rounded-b-sm"
                            }`}
                          />
                        )}
                      </div>

                      <span className="text-[10px] font-medium text-[#706068] mt-2 group-hover:text-[#b80049]">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart Legend */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#2d2529]" />
                  <span className="text-[#6b5862] font-medium">Diesel Route Fleet</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#ec2188]" />
                  <span className="text-[#6b5862] font-medium">Route Energy Draw</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#b80049]" />
                  <span className="text-[#6b5862] font-medium">Peak Demand Hours</span>
                </div>
              </div>
              <span className="text-xs text-[#b80049] font-bold cursor-pointer hover:underline">
                View Full Telemetry Log →
              </span>
            </div>
          </div>

          {/* Anomaly & Alert Intelligence Center (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)] flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-red-50 text-[#b80049]">
                    <Icon name="warning" fill className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1e1a1c]">Consumption Alerts</h3>
                    <p className="text-xs text-[#706068]">{anomaliesView.length > 0 ? `${anomaliesView.length} active delivery anomalies detected` : "No active anomalies"}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-red-100 text-red-700 font-extrabold text-[10px] rounded-full animate-pulse">
                  CRITICAL
                </span>
              </div>

              {/* Alert List */}
              <div className="space-y-3">
                {anomaliesView.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      investigateTarget?.id === alert.id
                        ? "bg-[#b80049]/5 border-[#b80049] ring-2 ring-[#b80049]/20"
                        : "bg-[#faf8f9] border-gray-100 hover:border-[#b80049]/30"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-bold text-sm text-[#1e1a1c]">{alert.target}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          alert.severity === "critical"
                            ? "bg-red-500 text-white"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {alert.metric}
                      </span>
                    </div>
                    <p className="text-xs text-[#6b5862] mb-3 leading-relaxed">{alert.description}</p>
                    <button
                      onClick={() => {
                        setInvestigateTarget(alert);
                        triggerToast(`Investigating details for ${alert.target}`);
                      }}
                      className="text-xs font-bold text-[#b80049] hover:text-[#900038] flex items-center gap-1 transition-colors"
                    >
                      Investigate Anomaly <Icon name="arrow_forward" className="text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Optimization Tip */}
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-[#b80049]/10 via-[#ec2188]/5 to-transparent border border-[#b80049]/15">
              <div className="flex items-center gap-2 text-[#b80049] font-bold text-xs mb-1">
                <Icon name="auto_awesome" className="text-base" />
                <span>AI Recommendation</span>
              </div>
              <p className="text-xs text-[#52434a] leading-relaxed">
                Shifting Depot 4 overnight charging schedules by 2 hours reduces peak utility charges by $4,200/mo.
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Layout: Fleet Class Mix + Depot Interactive Map Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Class Breakdown (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 lg:p-7 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#1e1a1c]">Consumption by Delivery Unit Class</h3>
                  <p className="text-xs text-[#706068]">Fuel distribution across delivery unit types</p>
                </div>
                <button className="text-xs font-bold text-[#b80049] hover:underline">Configure Mix</button>
              </div>

              <div className="space-y-5">
                {classBreakdownView.map((item) => (
                  <div key={item.label} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[#faf8f9] text-[#b80049] group-hover:bg-[#b80049] group-hover:text-white transition-colors">
                          <Icon name={item.icon} className="text-lg" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1e1a1c]">{item.label}</p>
                          <p className="text-[10px] text-[#706068]">{item.count} Active Units</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-[#1e1a1c] block">{item.value}</span>
                        <span className="text-[10px] text-green-600 font-medium">{item.efficiency}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#faf8f9] rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.bar}`}
                        style={{ width: item.width }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[#706068]">Route efficiency program on track (+12% savings YoY)</span>
              <button
                onClick={() => triggerToast("Navigating to Route Configuration...")}
                className="font-bold text-[#b80049] hover:underline flex items-center gap-1"
              >
                Route Config <Icon name="chevron_right" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Depot Regional Heatmap Matrix (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 lg:p-7 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1e1a1c]">Dispatch Hub Fuel Heatmap</h3>
                <p className="text-xs text-[#706068]">Geographic grid draw and fuel storage monitoring</p>
              </div>
              <button
                onClick={toggleHeatmapFilters}
                className="p-2 rounded-xl bg-[#faf8f9] border border-gray-200 hover:border-[#b80049]/30 text-[#1e1a1c] transition-all flex items-center gap-1.5 text-xs font-bold"
              >
                <Icon name="filter_list" className="text-base" />
                <span>Filters</span>
              </button>
            </div>

            {/* Map Container */}
            <div className="w-full h-[280px] bg-[#faf8f9] rounded-2xl border border-gray-200/70 relative overflow-hidden flex items-center justify-center">
              {showHeatmapFilters && (
                <div className="absolute top-3 right-3 z-20 bg-[#1e1a1c] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg animate-fade-in flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ec2188] animate-ping" />
                  Showing High-Draw Depots Only
                </div>
              )}

              {/* Stylized Vector Map Grid */}
              <svg viewBox="0 0 800 450" className="w-full h-full opacity-30 object-cover">
                <path
                  d="M 100,100 L 200,80 L 350,120 L 500,90 L 650,140 L 720,220 L 680,350 L 520,380 L 320,400 L 150,320 Z"
                  fill="none"
                  stroke="#b80049"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                />
              </svg>

              {/* Interactive Heatmap Nodes (derived from snapshot when available) */}
              {(() => {
                // build hubs view by grouping common hub/station fields in fuelLogs
                const logs = (snapshot?.fuelLogs || []) as any[];
                const hubKey = (l: any) => l.station || l.hub || l.depot || l.station_name || l.location || l.stationId || l.hub_name || null;
                const grouped: Record<string, { name: string; usage: number; status: "normal" | "high" | "alert" }> = {};
                for (const l of logs) {
                  const key = String(hubKey(l) ?? "Unknown Hub");
                  grouped[key] = grouped[key] || { name: key, usage: 0, status: "normal" };
                  grouped[key].usage += Number(l.liters ?? l.amount ?? 0) || 0;
                }
                const hubs = Object.values(grouped).map((h) => ({ ...h, usageLabel: `${Math.round(h.usage)} kWh` }));
                if (!hubs.length) {
                  return (
                    <div className="flex items-center justify-center w-full h-[220px]">
                      <div className="text-center text-sm text-[#706068]">No hub telemetry available — waiting for live depot data.</div>
                    </div>
                  );
                }

                // If we have hubs but no coordinates, render them evenly across the map area
                return hubs.map((h, i) => {
                  const left = `${10 + (i * 80) / Math.max(1, hubs.length - 1)}%`;
                  const top = `${20 + (i * 60) / Math.max(1, hubs.length - 1)}%`;
                  const status: "normal" | "high" | "alert" = h.usage > 500 ? "alert" : h.usage > 200 ? "high" : "normal";
                  return <DepotNode key={h.name} top={top} left={left} name={h.name} usage={h.usageLabel} status={status} />;
                });
              })()}
            </div>

            {/* Depot Status Legend Bar */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-[#706068]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Optimal
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#706068]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ec2188]" /> Peak Draw
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#706068]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Critical Alert
                </span>
              </div>
              {(() => {
                const active = Object.keys((snapshot?.fuelLogs || []).reduce((acc: any, l: any) => {
                  const key = String(l.station || l.hub || l.depot || l.station_name || l.location || "Unknown");
                  acc[key] = true; return acc;
                }, {})).length;
                return <span className="text-[11px] text-[#706068] font-mono">{active} Active Hubs Online</span>;
              })()}
            </div>
          </div>
        </div>

        {/* Refueling & Grid Charge Log Table */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)]">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#1e1a1c]">Recent Delivery Fuel Events</h3>
              <p className="text-xs text-[#706068]">Live telematics stream from automated dispenser nodes</p>
            </div>
            <button
              onClick={() => triggerToast("Opening full Refueling Log page...")}
              className="text-xs font-bold text-[#b80049] hover:text-[#900038] flex items-center gap-1"
            >
              View Full Log →
            </button>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[#706068] font-semibold">
                  <th className="pb-3 px-3">Unit ID</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3">Location Node</th>
                  <th className="pb-3 px-3">Fuel Dispensed</th>
                  <th className="pb-3 px-3">Total Cost</th>
                  <th className="pb-3 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[#1e1a1c]">
                {recentEventsView.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-[#faf8f9] transition-colors">
                    <td className="py-3.5 px-3 font-bold font-mono text-[#b80049]">{ev.id}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          ev.type === "Electric"
                            ? "bg-pink-100 text-[#ec2188]"
                            : "bg-gray-100 text-[#1e1a1c]"
                        }`}
                      >
                        {ev.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[#52434a]">{ev.location}</td>
                    <td className="py-3.5 px-3 font-bold">{ev.amount}</td>
                    <td className="py-3.5 px-3 font-medium">{ev.cost}</td>
                    <td className="py-3.5 px-3 text-right text-[#706068] font-mono">{ev.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <GlobalFooter />
    </div>
  );
}

/* ============================================================================
 * Helper Components & Mock Data
 * ============================================================================ */

function KpiCard({
  title,
  value,
  change,
  isIncreaseBad,
  subtext,
  icon,
  accent,
}: {
  title: string;
  value: string;
  change: string;
  isIncreaseBad: boolean;
  subtext: string;
  icon: string;
  accent: "pink" | "green" | "orange";
}) {
  const isPositive = change.startsWith("+");
  const isBad = isPositive ? isIncreaseBad : !isIncreaseBad;

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#b80049]/10 shadow-[0_4px_20px_rgba(184,0,73,0.03)] flex flex-col justify-between hover:shadow-lg transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold text-[#706068] tracking-wide">{title}</span>
        <div
          className={`p-2 rounded-2xl ${
            accent === "pink"
              ? "bg-[#b80049]/10 text-[#b80049]"
              : accent === "green"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          <Icon name={icon} className="text-xl" fill />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl lg:text-3xl font-extrabold text-[#1e1a1c] tracking-tight">{value}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              isBad ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <Icon name={isPositive ? "north_east" : "south_east"} className="text-xs" />
            {change}
          </span>
          <span className="text-[11px] text-[#706068] truncate">{subtext}</span>
        </div>
      </div>
    </div>
  );
}

function DepotNode({
  top,
  left,
  name,
  usage,
  status,
}: {
  top: string;
  left: string;
  name: string;
  usage: string;
  status: "normal" | "high" | "alert";
}) {
  return (
    <div
      style={{ top, left }}
      className="absolute group -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
    >
      <div className="relative flex items-center justify-center">
        {status === "alert" && (
          <span className="absolute w-8 h-8 rounded-full bg-red-500/30 animate-ping" />
        )}
        <div
          className={`w-4 h-4 rounded-full border-2 border-white shadow-md transition-all group-hover:scale-125 ${
            status === "alert"
              ? "bg-red-500"
              : status === "high"
              ? "bg-[#ec2188]"
              : "bg-emerald-500"
          }`}
        />

        {/* Floating Tag */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-[#1e1a1c] text-white px-2.5 py-1 rounded-xl shadow-xl opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all whitespace-nowrap text-center pointer-events-none">
          <p className="text-[10px] font-bold">{name}</p>
          <p className="text-[9px] text-[#ec2188] font-mono">{usage}</p>
        </div>
      </div>
    </div>
  );
}

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}
      style={{ fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}




// removed seeded/mock data; values are now computed from `snapshot` in the component