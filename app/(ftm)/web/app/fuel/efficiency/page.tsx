"use client";

import GlobalNavbar from "../../components/GlobalNavbar";
import GlobalFooter from "../../components/GlobalFooter";

import { useState, useEffect } from "react";
import { getDashboardSnapshot } from "../../lib/api";
import { usePathname } from "next/navigation";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";

// Efficiency and hourly-load arrays are computed from the live snapshot when available.

export default function FuelEfficiencyPage() {
  const [selectedMode, setSelectedMode] = useState<"Daily" | "Weekly">("Daily");
  const [selectedRange, setSelectedRange] = useState<"Last 7 Days" | "Last 30 Days" | "This Month">("Last 30 Days");
  const [showFleetFilter, setShowFleetFilter] = useState(false);
  const [smartRoutingApplied, setSmartRoutingApplied] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState<"Drivers" | "Vehicles">("Drivers");
  const [selectedVehicleClass, setSelectedVehicleClass] = useState<string>("All Classes");

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

  // Keep rendering the page structure even if no live fuel logs; UI shows placeholders.

  const efficiencyTrendDataView = (() => {
    const days = 10;
    const results: { date: string; efficiency: number; regen: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      results.push({ date: label, efficiency: 0, regen: 0 });
    }
    if (!hasData || !snapshot) return results;
    const logs = snapshot.fuelLogs || [];
    for (const r of results) {
      const dayLogs = logs.filter((l: any) => new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at).toLocaleDateString() === new Date(r.date).toLocaleDateString());
      const totalLiters = dayLogs.reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0);
      r.efficiency = totalLiters > 0 ? Math.max(0, Number((1000 / totalLiters).toFixed(2))) : 0;
    }
    return results;
  })();

  const hourlyLoadDataView = (() => {
    const slots = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const result = slots.map((s) => ({ hour: s, load: 0 }));
    if (!hasData || !snapshot) return result;
    const logs = snapshot.fuelLogs || [];
    const totalVehicles = Math.max(1, (snapshot.vehicles || []).length);
    for (const l of logs) {
      const h = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at).getHours();
      const idx = Math.floor((h - 6) / 3);
      const place = Math.max(0, Math.min(result.length - 1, idx));
      result[place].load += 1;
    }
    return result.map((r) => ({ hour: r.hour, load: Math.min(100, Math.round((r.load / totalVehicles) * 100)) }));
  })();

  // Helper: percent change
  function percentChange(current: number, previous: number) {
    if (!isFinite(previous) || previous === 0) return "—";
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  // KPI: average efficiency (distance / liters)
  const avgEfficiency = (() => {
    if (!hasData || !snapshot) return "—";
    const logs = snapshot.fuelLogs || [];
    const totalLiters = logs.reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0);
    const totalDistance = logs.reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0);
    if (totalLiters <= 0) return "—";
    return (totalDistance / totalLiters).toFixed(2);
  })();

  // Compute 30-day change vs previous 30-day window
  const now = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000;
  const windowDays = 30;
  const periodEnd = now;
  const periodStart = now - windowDays * MS_DAY;
  const prevPeriodStart = periodStart - windowDays * MS_DAY;
  const prevPeriodEnd = periodStart - 1;

  function sumRange(startMs: number, endMs: number, field = "liters") {
    if (!snapshot) return 0;
    const logs = snapshot.fuelLogs || [];
    return logs.reduce((s: number, l: any) => {
      const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
      if (ts >= startMs && ts <= endMs) return s + Number(l[field] ?? l.amount ?? 0);
      return s;
    }, 0);
  }

  const currentLiters = hasData && snapshot ? sumRange(periodStart, periodEnd) : 0;
  const previousLiters = hasData && snapshot ? sumRange(prevPeriodStart, prevPeriodEnd) : 0;
  const efficiencyChange = (() => {
    if (!hasData || !snapshot) return "—";
    // compute efficiency as distance/liters for windows
    const currDist = sumRange(periodStart, periodEnd, "distance");
    const prevDist = sumRange(prevPeriodStart, prevPeriodEnd, "distance");
    const currEff = currentLiters > 0 ? currDist / currentLiters : 0;
    const prevEff = previousLiters > 0 ? prevDist / previousLiters : 0;
    return prevEff > 0 ? percentChange(currEff, prevEff) : "—";
  })();

  // Total fuel YTD
  const totalFuelYTD = (() => {
    if (!hasData || !snapshot) return "—";
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const total = sumRange(yearStart, Date.now());
    return `${Math.round(total).toLocaleString()} kWh`;
  })();

  // Regen groups (group by vehicle type share of total fuel)
  const regenRoutesView = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const vehicles = snapshot.vehicles || [];
    const logs = snapshot.fuelLogs || [];
    const totalsByType: Record<string, number> = {};
    for (const l of logs) {
      const v = vehicles.find((vv: any) => vv.id === (l.vehicleId ?? l.vehicle_id));
      const t = String(v?.vehicleType ?? v?.vehicle_type ?? "Other").toLowerCase();
      const key = /ev|electric/.test(t) ? "EV" : /hybrid/.test(t) ? "Hybrid" : /truck|rig|van/.test(t) ? "Heavy" : "Other";
      totalsByType[key] = (totalsByType[key] || 0) + Number(l.liters ?? l.amount ?? 0);
    }
    const entries = Object.entries(totalsByType).map(([label, value]) => ({ label, value }));
    const total = entries.reduce((s, e) => s + e.value, 0) || 1;
    const colors = ["#b80049", "#ec4899", "#f43f5e", "#fb7185"];
    return entries.slice(0, 3).map((e, i) => ({ label: e.label === "Heavy" ? "Highway Routes (Steady)" : e.label === "EV" ? "Urban Routes (Stop-and-Go)" : e.label === "Hybrid" ? "Suburban Routes (Mixed)" : e.label, pct: Math.round((e.value / total) * 100), opacity: i === 0 ? "" : i === 1 ? "opacity-80" : "opacity-50" }));
  })();

  // Route recovery percent (uses `regen` / `recovered` fields if present)
  const routeRecoveryPct = (() => {
    if (!hasData || !snapshot) return null as number | null;
    const logs = snapshot.fuelLogs || [];
    const recovered = logs.reduce((s: number, l: any) => s + Number(l.regen ?? l.recovered ?? 0), 0);
    const total = logs.reduce((s: number, l: any) => s + Number(l.liters ?? l.amount ?? 0), 0) || 1;
    const pct = Math.round((recovered / total) * 100);
    return Math.min(100, Math.max(0, pct));
  })();

  const numRoutes = (() => {
    if (!hasData || !snapshot) return "—";
    const trips = snapshot.trips || [];
    return (trips.length || 0) as number | string;
  })();

  // Leaderboard by vehicle (efficiency = distance / liters)
  const leaderboardItems = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const logs = snapshot.fuelLogs || [];
    const vehicles = snapshot.vehicles || [];
    const byVehicle: Record<string, { id: string; name: string; liters: number; distance: number }> = {};
    for (const l of logs) {
      const vid = l.vehicleId ?? l.vehicle_id ?? "unknown";
      byVehicle[vid] = byVehicle[vid] || { id: vid, name: `Unit ${vid}`, liters: 0, distance: 0 };
      byVehicle[vid].liters += Number(l.liters ?? l.amount ?? 0);
      byVehicle[vid].distance += Number(l.distance ?? 0);
    }
    const arr = Object.values(byVehicle).map((v) => ({ ...v, efficiency: v.liters > 0 ? Number((v.distance / v.liters).toFixed(2)) : 0 }));
    arr.sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0));
    return arr.slice(0, 5).map((v, idx) => ({ rank: idx + 1, name: v.name, route: v.id, value: `${v.efficiency}` }));
  })();

  return (
    <div className="flex flex-col min-h-screen bg-[#fff7fc] text-[#141d23]">
      <GlobalNavbar />
      
      <main className="flex-grow w-full max-w-[1700px] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-[#ec2188]/15 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#b80049]/10 text-[#b80049] uppercase tracking-wider">
                Courier Route Telemetry
              </span>
              <span className="text-xs text-[#5b6b79]">• Live Monitoring</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#141d23] tracking-tight">Courier Route Efficiency & Fuel</h1>
            <p className="text-sm md:text-base text-[#5b6b79] mt-1.5 max-w-2xl">
              Advanced analytics tracking delivery route efficiency, dispatch fuel use, and real-time courier asset performance across active Airship Express operations.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <button
                onClick={() => setSelectedRange("Last 30 Days")}
                className="flex items-center gap-2 bg-white border border-[#ec2188]/20 px-4 py-2.5 rounded-xl text-sm font-medium text-[#141d23] hover:border-[#b80049] hover:bg-[#fff7fc] transition-all shadow-xs"
              >
                <Icon name="calendar_month" className="text-[#b80049] text-[18px]" />
                {selectedRange}
                <Icon name="expand_more" className="text-[#5b6b79] text-[18px]" />
              </button>
            </div>

            <button
              onClick={() => setShowFleetFilter((prev) => !prev)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs border ${
                showFleetFilter 
                  ? "bg-[#b80049] text-white border-[#b80049]" 
                  : "bg-white border-[#ec2188]/20 text-[#141d23] hover:border-[#b80049] hover:bg-[#fff7fc]"
              }`}
            >
              <Icon name="tune" className={`text-[18px] ${showFleetFilter ? "text-white" : "text-[#b80049]"}`} />
              Filter Routes
            </button>
          </div>
        </div>

        {/* Expandable Fleet Filters */}
        {showFleetFilter && (
          <div className="rounded-2xl border border-[#b80049]/30 bg-white p-6 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#141d23] flex items-center gap-2">
                <Icon name="filter_alt" className="text-[#b80049]" /> Advanced Route Segmentation
              </h3>
              <button 
                onClick={() => setShowFleetFilter(false)}
                className="text-xs text-[#5b6b79] hover:text-[#b80049] font-medium"
              >
                Close Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Delivery Unit Class</label>
                <select 
                  value={selectedVehicleClass}
                  onChange={(e) => setSelectedVehicleClass(e.target.value)}
                  className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30"
                >
                  <option>All Classes</option>
                  <option>Class 3 Delivery Vans</option>
                  <option>Class 5 Box Trucks</option>
                  <option>Heavy Hauler Semi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Service Region</label>
                <select className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30">
                  <option>All Regions (Metro & Suburban)</option>
                  <option>Zone A - Urban Core</option>
                  <option>Zone B - West Suburbs</option>
                  <option>Zone C - Northern Corridor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5b6b79] mb-1.5">Route Status</label>
                <select className="w-full bg-[#fff7fc] border border-[#ec2188]/20 rounded-xl px-3.5 py-2 text-sm text-[#141d23] focus:outline-none focus:ring-2 focus:ring-[#b80049]/30">
                  <option>All States</option>
                  <option>Active / En Route (&gt;20% SOC)</option>
                  <option>Charging Hub</option>
                  <option>Low Battery Flagged</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Bento Grid Layout (Full Width Usage) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Primary Trend Chart (8 Columns) */}
          <section className="lg:col-span-8 bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="monitoring" className="text-xl" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-[#141d23]">Route Efficiency Trend</h2>
                    <p className="text-xs text-[#5b6b79]">Tracking fuel performance across active delivery routes</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-4xl font-extrabold text-[#141d23]">{avgEfficiency !== "—" ? avgEfficiency : "—"}</span>
                  <span className="text-sm font-medium text-[#5b6b79]">Avg. mi/kWh</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center border border-emerald-200">
                    <Icon name="trending_up" className="text-[14px] mr-1" />
                    {efficiencyChange}
                  </span>
                </div>
              </div>

              <div className="flex bg-[#fff7fc] p-1 rounded-xl border border-[#ec2188]/20">
                <button
                  onClick={() => setSelectedMode("Daily")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedMode === "Daily"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-[#5b6b79] hover:text-[#141d23]"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setSelectedMode("Weekly")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedMode === "Weekly"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-[#5b6b79] hover:text-[#141d23]"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            <div className="w-full h-[320px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrendDataView} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b80049" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#b80049" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis domain={[2.5, 4.5]} tick={{ fill: "#5b6b79", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #ec2188/30", boxShadow: "0 10px 25px rgba(184,0,73,0.1)" }}
                    formatter={(value: any) => [`${value} mi/kWh`, "Efficiency"]}
                  />
                  <Area type="monotone" dataKey="efficiency" stroke="#b80049" strokeWidth={3} fillOpacity={1} fill="url(#primaryGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Predictive Insight & Energy Banner (4 Columns) */}
          <section className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between flex-1">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="p-2.5 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="lightbulb" className="text-xl" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#141d23]">Dispatch Insight</h3>
                    <p className="text-xs text-[#5b6b79]">Route load optimization recommendation</p>
                  </div>
                </div>
                <p className="text-sm text-[#5b6b79] leading-relaxed mb-6">
                  Reducing active route load by 12% across urban delivery corridors (Zone A) during peak afternoon hours could improve route-wide mileage output by <strong className="text-[#b80049] font-bold">0.4 mi/gal</strong>.
                </p>
                <div className="bg-[#fff7fc] p-4 rounded-xl border border-[#ec2188]/20 mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-[#5b6b79]">Projected Daily Savings</span>
                    <span className="text-sm font-bold text-[#b80049]">{Math.round((currentLiters - previousLiters) || 0)} kWh</span>
                  </div>
                  <div className="w-full bg-[#f0e2ec] rounded-full h-2 overflow-hidden">
                    <div className="bg-[#b80049] h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.abs(currentLiters - previousLiters) / Math.max(1, previousLiters) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSmartRoutingApplied(true)}
                className="w-full bg-[#fff7fc] hover:bg-[#b80049] hover:text-white text-[#141d23] text-sm font-semibold py-3 rounded-xl transition-all border border-[#ec2188]/30 flex justify-center items-center gap-2 group shadow-xs"
              >
                <span>Apply Dispatch Routing Profile</span>
                <Icon name="arrow_forward" className="text-sm transition-transform group-hover:translate-x-1" />
              </button>
              
              {smartRoutingApplied && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in duration-200">
                  ✓ Dispatch routing profile successfully deployed. Route predictions updated.
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-[#b80049] to-[#ec2188] rounded-2xl p-6 shadow-md text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex justify-between items-start relative z-10">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Fuel Saved YTD</span>
                <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Icon name="eco" className="text-white text-lg" />
                </span>
              </div>
                <div className="mt-6 relative z-10">
                <div className="text-3xl font-black tracking-tight">{totalFuelYTD}</div>
                <div className="text-xs opacity-85 mt-1">Total fuel used YTD</div>
              </div>
            </div>
          </section>

        </div>

        {/* Secondary Row: Live Peak Load Chart & Energy Recovery & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* New Added Feature Chart: Hourly Thermal / HVAC Load Curve */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="bolt" className="text-lg" />
                  </span>
                  <h3 className="text-base font-bold text-[#141d23]">Peak Route Load Profile</h3>
                </div>
                <span className="text-xs bg-[#fff7fc] text-[#5b6b79] px-2.5 py-1 rounded-full border border-[#ec2188]/20">Today</span>
              </div>
              <p className="text-xs text-[#5b6b79] mb-4">Active route load utilization across urban zone nodes.</p>
            </div>

            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyLoadDataView} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e2ec" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#5b6b79", fontSize: 11 }} axisLine={{ stroke: "#f0e2ec" }} tickLine={false} />
                  <YAxis tick={{ fill: "#5b6b79", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #ec2188/30" }}
                    formatter={(val: any) => [`${val}% Capacity`, "Load"]}
                  />
                  <Bar dataKey="load" fill="#b80049" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Energy Recovery (Regen ROI) */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                  <Icon name="battery_charging_full" className="text-lg" />
                </span>
                <h3 className="text-base font-bold text-[#141d23]">Route Fuel Recovery</h3>
              </div>
              <span className="text-xs text-[#5b6b79] border border-[#ec2188]/20 px-3 py-1 rounded-full bg-[#fff7fc]">
                This Week
              </span>
            </div>

            <div className="flex gap-4 items-center my-auto py-2">
              <div className="relative w-28 h-28 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#f0e2ec]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <path
                    className="text-[#b80049]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${routeRecoveryPct ?? 0}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-[#141d23]">{routeRecoveryPct === null ? "—" : `${routeRecoveryPct}%`}</span>
                  <span className="text-[10px] font-semibold text-[#5b6b79] text-center uppercase tracking-wider">Recaptured</span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {regenRoutesView.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs text-[#141d23] mb-1 font-medium">
                      <span className="truncate pr-2">{r.label}</span>
                      <span className="font-bold text-[#b80049]">{r.pct}%</span>
                    </div>
                    <div className="w-full bg-[#f0e2ec] rounded-full h-2 overflow-hidden">
                      <div
                        className={`bg-[#b80049] h-2 rounded-full ${r.opacity}`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Efficiency Leaderboard */}
          <section className="bg-white rounded-2xl border border-[#ec2188]/15 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#fff7fc] text-[#b80049] border border-[#ec2188]/20">
                    <Icon name="emoji_events" className="text-lg" />
                  </span>
                  <h3 className="text-base font-bold text-[#141d23]">Efficiency Leaderboard</h3>
                </div>
                <div className="flex bg-[#fff7fc] p-1 rounded-lg border border-[#ec2188]/20">
                  <button
                    onClick={() => setLeaderboardView("Drivers")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      leaderboardView === "Drivers"
                        ? "bg-[#b80049] text-white shadow-xs"
                        : "text-[#5b6b79] hover:text-[#141d23]"
                    }`}
                  >
                    Drivers
                  </button>
                  <button
                    onClick={() => setLeaderboardView("Vehicles")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      leaderboardView === "Vehicles"
                        ? "bg-[#b80049] text-white shadow-xs"
                        : "text-[#5b6b79] hover:text-[#141d23]"
                    }`}
                  >
                    Vehicles
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 mt-2">
                {leaderboardItems.map((l) => (
                  <div
                    key={l.rank}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      l.rank === 1
                        ? "bg-[#fff7fc] border-[#ec2188]/30 shadow-xs"
                        : "bg-white hover:bg-[#fff7fc]/50 border-[#f0e2ec]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold ${
                          l.rank === 1 ? "bg-[#b80049] text-white shadow-xs" : "bg-[#f0e2ec] text-[#5b6b79]"
                        }`}
                      >
                        {l.rank}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#141d23]">{l.name}</div>
                        <div className="text-[11px] text-[#5b6b79]">{l.route}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#b80049]">{l.value}</div>
                      <div className="text-[10px] text-[#5b6b79]">mi/kWh</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0e2ec] flex items-center justify-between px-2 bg-[#fff7fc] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#5b6b79] font-bold">{numRoutes}</span>
                <span className="text-xs font-bold text-[#141d23]">Your Route Average</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-[#141d23]">{avgEfficiency !== "—" ? avgEfficiency : "—"}</span>
                <span className="text-[10px] text-[#5b6b79] ml-1">mi/kWh</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

// regenRoutes and leaderboard are derived from live snapshot above

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return <span className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>{name}</span>;
}