"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import { getCostEntries, getDashboardSnapshot, getFuelLogs } from "../lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const formatPeso = (value: number, fractionDigits = 2) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;

export default function FuelOverviewPage() {
  const [selectedTrendView, setSelectedTrendView] = useState<"Daily" | "Weekly">("Daily");
  const [selectedEnergyType, setSelectedEnergyType] = useState<"All" | "EV" | "Hybrid" | "Diesel">("All");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [showMetricValues, setShowMetricValues] = useState(false);

  useEffect(() => {
    const handleMetricVisibilityShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        setShowMetricValues(true);
      }
      if (key === "h") {
        event.preventDefault();
        setShowMetricValues(false);
      }
    };

    window.addEventListener("keydown", handleMetricVisibilityShortcut);
    return () => window.removeEventListener("keydown", handleMetricVisibilityShortcut);
  }, []);

  const [hasData, setHasData] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  const trendData = (() => {
    if (!hasData || !snapshot) {
      return {
        fuelSpendDelta: 0,
        fuelSpendDirection: "flat" as const,
        routeEfficiencyDelta: 0,
        routeEfficiencyDirection: "flat" as const,
        routeConsumptionDelta: 0,
        routeConsumptionDirection: "flat" as const,
        dispatchEfficiencyDelta: 0,
        dispatchEfficiencyDirection: "flat" as const,
      };
    }

    const logs = (snapshot.fuelLogs || []) as any[];
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

    const currentMonthLogs = logs.filter((log) => {
      const time = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? 0).getTime();
      return time >= currentMonthStart;
    });

    const previousMonthLogs = logs.filter((log) => {
      const time = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? 0).getTime();
      return time >= previousMonthStart && time <= previousMonthEnd;
    });

    const sum = (items: number[]) => items.reduce((acc, value) => acc + value, 0);
    const getMonthDelta = (current: number, previous: number) => {
      if (!previous) return 0;
      return ((current - previous) / previous) * 100;
    };

    const currentSpend = sum(currentMonthLogs.map((log) => Number(log.cost ?? log.amount ?? 0) || 0));
    const previousSpend = sum(previousMonthLogs.map((log) => Number(log.cost ?? log.amount ?? 0) || 0));
    const fuelSpendDelta = getMonthDelta(currentSpend, previousSpend);

    const currentRouteDistance = sum(currentMonthLogs.map((log) => Number(log.distance ?? 0) || 0));
    const previousRouteDistance = sum(previousMonthLogs.map((log) => Number(log.distance ?? 0) || 0));
    const currentRouteConsumption = sum(currentMonthLogs.map((log) => Number(log.liters ?? log.consumption ?? log.volume ?? 0) || 0));
    const previousRouteConsumption = sum(previousMonthLogs.map((log) => Number(log.liters ?? log.consumption ?? log.volume ?? 0) || 0));

    const currentEfficiency = currentRouteConsumption ? currentRouteDistance / currentRouteConsumption : 0;
    const previousEfficiency = previousRouteConsumption ? previousRouteDistance / previousRouteConsumption : 0;
    const routeEfficiencyDelta = getMonthDelta(currentEfficiency, previousEfficiency);

    const routeConsumptionDelta = getMonthDelta(currentRouteConsumption, previousRouteConsumption);

    const vehicles = (snapshot.vehicles || []) as any[];
    const currentDispatchEfficiency = vehicles.length
      ? vehicles.reduce((total, vehicle) => total + (Number(vehicle.efficiency ?? 0) || 0), 0) / vehicles.length
      : currentEfficiency;
    const dispatchEfficiencyDelta = getMonthDelta(currentDispatchEfficiency, previousEfficiency || currentDispatchEfficiency || 0);

    return {
      fuelSpendDelta,
      fuelSpendDirection: fuelSpendDelta > 0 ? "up" : fuelSpendDelta < 0 ? "down" : "flat",
      routeEfficiencyDelta,
      routeEfficiencyDirection: routeEfficiencyDelta > 0 ? "up" : routeEfficiencyDelta < 0 ? "down" : "flat",
      routeConsumptionDelta,
      routeConsumptionDirection: routeConsumptionDelta > 0 ? "up" : routeConsumptionDelta < 0 ? "down" : "flat",
      dispatchEfficiencyDelta,
      dispatchEfficiencyDirection: dispatchEfficiencyDelta > 0 ? "up" : dispatchEfficiencyDelta < 0 ? "down" : "flat",
    };
  })();

  const totalFuelSpend = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => s + Number(l.cost ?? l.amount ?? 0), 0) : null;
  const totalRouteConsumption = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => s + Number(l.liters ?? l.consumption ?? l.volume ?? 0), 0) : null;
  const totalRouteDistance = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0) : null;
  const avgRouteEfficiency = totalRouteConsumption ? (totalRouteDistance / totalRouteConsumption) : null;
  const dispatchEfficiency = hasData && snapshot && snapshot.vehicles ? (() => {
    const vehicles = snapshot.vehicles || [];
    const eff = vehicles.length ? (vehicles.reduce((s: number, v: any) => s + Number(v.efficiency ?? 0), 0) / vehicles.length) : null;
    return eff;
  })() : null;

  const formatTrend = (value: number) => {
    const rounded = Math.abs(value).toFixed(1);
    return `${value >= 0 ? "+" : "-"}${rounded}%`;
  };

  const getTrendMeta = (value: number) => {
    if (Math.abs(value) < 0.05) return { direction: "flat" as const, text: "0.0%", arrow: "→" };
    if (value > 0) return { direction: "up" as const, text: formatTrend(value), arrow: "↗" };
    return { direction: "down" as const, text: formatTrend(value), arrow: "↘" };
  };

  const fuelSpendTrend = getTrendMeta(trendData.fuelSpendDelta);
  const routeEfficiencyTrend = getTrendMeta(trendData.routeEfficiencyDelta);
  const routeConsumptionTrend = getTrendMeta(trendData.routeConsumptionDelta);
  const dispatchEfficiencyTrend = getTrendMeta(trendData.dispatchEfficiencyDelta);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, fuelLogs, costEntries] = await Promise.all([
          getDashboardSnapshot(),
          getFuelLogs(),
          getCostEntries(),
        ]);
        const isFuelCategory = (value?: string | null) => /fuel|energy/i.test(String(value ?? ""));
        const fuelCostEntries = (Array.isArray(costEntries) ? costEntries : []).filter(
          (entry: any) => isFuelCategory(entry.category)
        );
        const measurementLogs = Array.isArray(fuelLogs) && fuelLogs.length > 0 ? fuelLogs : (dash.fuelLogs || []);
        const logsById = new Map<string, any>(measurementLogs.map((log: any) => [String(log.id), log]));
        const logs = fuelCostEntries.length > 0
          ? fuelCostEntries.map((entry: any) => {
              const measurement = logsById.get(String(entry.id));
              const receiptAmount = Number(entry.amount ?? entry.cost ?? 0) || 0;
              const measurementAmount = Number(measurement?.cost ?? measurement?.amount ?? 0) || 0;
              return {
                ...measurement,
                ...entry,
                vehicleId: measurement?.vehicleId ?? entry.vehicleId ?? entry.vehicle_id ?? null,
                tripId: measurement?.tripId ?? entry.tripId ?? entry.trip_id ?? null,
                liters: measurement?.liters ?? (entry.categoryCost?.liters != null ? Number(entry.categoryCost.liters) : null),
                distance: measurement?.distance ?? 0,
                cost: receiptAmount > 0 ? receiptAmount : measurementAmount,
                odometerReading: measurement?.odometerReading ?? entry.categoryCost?.odometer_reading ?? null,
                loggedAt: measurement?.loggedAt ?? entry.entryDate ?? entry.entry_date ?? entry.recorded_at ?? entry.created_at ?? null,
              };
            })
          : measurementLogs;
        if (mounted) {
          setSnapshot({ ...dash, fuelLogs: logs });
          setHasData(Boolean(logs.length));
        }
      } catch (e) {
        console.warn("Failed to load fuel snapshot", e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When no data, keep structure visible; components will show placeholders (0 / "—").

  // Derived view data (compute from snapshot when available, otherwise show placeholders)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const consumptionDataDailyView = (() => {
    if (hasData && snapshot) {
      const logs = snapshot.fuelLogs || [];
      return days.map((day, index) => {
        const matching = logs.filter((log: any) => {
          if (!log.loggedAt && !log.logged_at && !log.createdAt && !log.created_at) return false;
          const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at);
          if (Number.isNaN(date.getTime())) return false;
          return date.getDay() === ((index + 6) % 7);
        });
        const consumption = matching.reduce((s: number, l: any) => s + Number(l.liters ?? l.consumption ?? 0), 0);
        const distance = matching.reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0);
        return { period: day, consumption: Math.round(consumption || 0), distance: Math.round(distance || 0) };
      });
    }
    return days.map((d) => ({ period: d, consumption: 0, distance: 0 }));
  })();

  // simple weekly buckets derived from log week numbers (keep last 7 weeks)
  function getWeekKey(date: Date) {
    const year = date.getFullYear();
    const onejan = new Date(year, 0, 1);
    const week = Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${year}-W${week}`;
  }

  const consumptionDataWeeklyView = (() => {
    if (hasData && snapshot) {
      const logs = snapshot.fuelLogs || [];
      const map: Record<string, { period: string; consumption: number; distance: number }> = {};
      logs.forEach((log: any) => {
        const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? 0);
        if (Number.isNaN(date.getTime())) return;
        const key = getWeekKey(date);
        map[key] = map[key] || { period: key, consumption: 0, distance: 0 };
        map[key].consumption += Number(log.liters ?? log.consumption ?? 0);
        map[key].distance += Number(log.distance ?? 0);
      });
      const arr = Object.values(map).slice(-7);
      if (arr.length) return arr;
    }
    return [
      { period: "Week 1", consumption: 0, distance: 0 },
      { period: "Week 2", consumption: 0, distance: 0 },
      { period: "Week 3", consumption: 0, distance: 0 },
      { period: "Week 4", consumption: 0, distance: 0 },
      { period: "Week 5", consumption: 0, distance: 0 },
      { period: "Week 6", consumption: 0, distance: 0 },
      { period: "Week 7", consumption: 0, distance: 0 },
    ];
  })();

  const fuelTypeBreakdownView = (() => {
    if (hasData && snapshot) {
      const vehicles = snapshot.vehicles || [];
      const logs = snapshot.fuelLogs || [];
      const totals: Record<string, number> = {};
      vehicles.forEach((v: any) => { totals[v.vehicleType ?? "Other"] = 0; });
      logs.forEach((l: any) => {
        const vid = l.vehicleId ?? l.vehicle_id;
        const v = vehicles.find((x: any) => x.id === vid) || {};
        const key = v.vehicleType || l.fuelType || "Other";
        totals[key] = (totals[key] || 0) + Number(l.liters ?? l.consumption ?? 0);
      });
      const entries = Object.entries(totals).map(([name, value]) => ({ name, value }));
      const total = entries.reduce((s, e) => s + e.value, 0) || 1;
      const colors = ["#b80049", "#ec4899", "#f43f5e", "#fb7185"];
      return entries.slice(0, 4).map((e, i) => ({ name: e.name, value: Math.round(e.value), color: colors[i % colors.length], share: `${Math.round((e.value / total) * 100)}%` }));
    }
    return [
      { name: "Electric (EV)", value: 0, color: "#b80049", share: "0%" },
      { name: "Hybrid", value: 0, color: "#ec4899", share: "0%" },
      { name: "Diesel", value: 0, color: "#f43f5e", share: "0%" },
    ];
  })();

  const efficiencyTrendDataView = (() => {
    if (hasData && snapshot) {
      const logs = snapshot.fuelLogs || [];
      return days.map((day, index) => {
        const matching = logs.filter((log: any) => {
          if (!log.loggedAt && !log.logged_at && !log.createdAt && !log.created_at) return false;
          const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at);
          if (Number.isNaN(date.getTime())) return false;
          return date.getDay() === ((index + 6) % 7);
        });
        const consumption = matching.reduce((s: number, l: any) => s + Number(l.liters ?? l.consumption ?? 0), 0);
        const distance = matching.reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0);
        const efficiency = consumption > 0 ? Number((distance / consumption).toFixed(2)) : 0;
        return { day, efficiency, target: 0 };
      });
    }
    return days.map((d) => ({ day: d, efficiency: 0, target: 0 }));
  })();

  const hasConsumptionMeasurements = Boolean(
    hasData && (snapshot?.fuelLogs || []).some(
      (log: any) => Number(log.liters ?? log.consumption ?? log.volume ?? 0) > 0
        || Number(log.distance ?? 0) > 0
    )
  );

  const transactionsView = (() => {
    if (hasData && snapshot) {
      const logs = (snapshot.fuelLogs || []).slice().sort((a: any, b: any) => new Date(b.loggedAt ?? b.logged_at ?? b.createdAt ?? b.created_at ?? 0).getTime() - new Date(a.loggedAt ?? a.logged_at ?? a.createdAt ?? a.created_at ?? 0).getTime());
      return logs.slice(0, 12).map((l: any, idx: number) => ({
        id: l.id ?? `L-${idx}`,
        name: (l.vehicleId || l.vehicle_id) ? `Unit ${l.vehicleId ?? l.vehicle_id}` : (l.name || "Delivery Unit"),
        person: l.driverName || l.person || "—",
        time: new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cost: l.cost ? formatPeso(Number(l.cost)) : "—",
        volume: `${Math.round(Number(l.liters ?? l.volume ?? 0))} L`,
        alert: Boolean(l.alert),
      }));
    }
    return [];
  })();

  const handleExportReport = () => {
    setShowExportNotice(true);
    setNoticeMessage(null);
    window.setTimeout(() => setShowExportNotice(false), 3000);
  };

  const handleAlertAction = (msg: string) => {
    setNoticeMessage(msg);
    window.setTimeout(() => setNoticeMessage(null), 3000);
  };

  return (
    <div className="bg-[#fcf7fa] text-slate-900 min-h-screen flex flex-col font-sans">
      <GlobalNavbar />

      {/* Ultra-Wide Full Screen Area Container */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-8 transition-all">
        
        {/* Header Section & Anomaly Alert */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 sm:p-8 rounded-2xl border border-pink-100 shadow-sm shadow-pink-900/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-pink-100 text-[#b80049] border border-pink-200/60">
                Courier Delivery Ops
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Dispatch Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Airship Express Fuel & Delivery Operations
            </h1>
            <p className="text-slate-500 text-sm sm:text-base max-w-3xl">
              Real-time monitoring of delivery fuel consumption, route efficiency, refueling anomalies, and cost performance across nationwide courier operations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700">
              {hasData ? "Fuel records synchronized" : "No fuel records available"}
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/fuel/efficiency"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-bold text-[#b80049] transition-colors hover:bg-pink-50"
              >
                <Icon name="speed" className="text-[18px]" />
                Efficiency
              </a>
              <a
                href="/fuel/refueling-log"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-bold text-[#b80049] transition-colors hover:bg-pink-50"
              >
                <Icon name="local_gas_station" className="text-[18px]" />
                Refueling Log
              </a>
            </div>

            {/* Export Action Button */}
            <button
              onClick={handleExportReport}
              className="inline-flex items-center justify-center gap-2 bg-[#b80049] hover:bg-[#96003b] text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-pink-900/15 shrink-0 active:scale-95"
            >
              <Icon name="download" className="text-[18px]" />
              Export Report
            </button>
          </div>
        </header>

        {/* Toast / Notification Banner */}
        {(showExportNotice || noticeMessage) && (
          <div className="flex items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 text-[#b80049] px-5 py-3.5 text-sm font-semibold shadow-sm animate-fade-in">
            <Icon name="info" className="text-xl" />
            <span>
              {noticeMessage ?? "Courier fuel telemetry export started successfully. Preparing your detailed report..."}
            </span>
          </div>
        )}

        {/* Enhanced KPI Bento Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            label="Total Delivery Fuel Spend"
            value={hasData && totalFuelSpend != null ? `₱${Math.round(totalFuelSpend).toLocaleString()}` : "₱0"}
            unit={hasData ? undefined : undefined}
            icon="payments"
            trend={fuelSpendTrend.text}
            trendDirection={fuelSpendTrend.direction}
            subtext={hasData ? "vs prior month" : "No data"}
            isGoodTrend={true}
            showValues={showMetricValues}
            onToggle={() => setShowMetricValues((current) => !current)}
          />
          <KpiCard
            label="Avg Route Efficiency"
            value={hasData && avgRouteEfficiency != null ? `${avgRouteEfficiency.toFixed(2)}` : "0.00"}
            unit={hasData ? "km/L" : undefined}
            icon="speed"
            trend={routeEfficiencyTrend.text}
            trendDirection={routeEfficiencyTrend.direction}
            subtext="Optimized routing gain"
            isGoodTrend={true}
            showValues={showMetricValues}
            onToggle={() => setShowMetricValues((current) => !current)}
          />
          <KpiCard
            label="Total Route Consumption"
            value={hasData && totalRouteConsumption != null ? `${Math.round(totalRouteConsumption).toLocaleString()}` : "0"}
            unit={hasData ? "L" : undefined}
            icon="ev_station"
            trend={routeConsumptionTrend.text}
            trendDirection={routeConsumptionTrend.direction}
            subtext="Increased total mileage"
            isGoodTrend={false}
            showValues={showMetricValues}
            onToggle={() => setShowMetricValues((current) => !current)}
          />
          <KpiCard
            label="Dispatch Efficiency"
            value={hasData && dispatchEfficiency != null ? `${dispatchEfficiency.toFixed(1)}` : "0.0"}
            unit={hasData ? "Tons" : undefined}
            icon="eco"
            trend={dispatchEfficiencyTrend.text}
            trendDirection={dispatchEfficiencyTrend.direction}
            subtext="Route optimization progress"
            isGoodTrend={true}
            showValues={showMetricValues}
            onToggle={() => setShowMetricValues((current) => !current)}
          />
        </section>

        {/* Main Chart Row: Consumption vs Distance (2/3 Width) + Energy Mix Donut (1/3 Width) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Chart: Consumption vs Distance */}
          <div className="lg:col-span-2 bg-white border border-pink-100 rounded-2xl p-6 sm:p-7 shadow-sm shadow-pink-900/5 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <span className="text-xs font-bold text-[#b80049] uppercase tracking-wider">Trend Analysis</span>
                <h2 className="text-lg font-black text-slate-900">
                  Fuel Consumption vs. Delivery Distance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Correlation between total delivery distance and fuel draw over time.
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-pink-50/80 p-1 rounded-xl border border-pink-200/80">
                <button
                  onClick={() => setSelectedTrendView("Daily")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedTrendView === "Daily"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-slate-600 hover:text-[#b80049]"
                  }`}
                >
                  Daily View
                </button>
                <button
                  onClick={() => setSelectedTrendView("Weekly")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedTrendView === "Weekly"
                      ? "bg-[#b80049] text-white shadow-xs"
                      : "text-slate-600 hover:text-[#b80049]"
                  }`}
                >
                  Weekly View
                </button>
              </div>
            </div>

            {/* Recharts Bar/Line Chart */}
            <div className="w-full h-[340px]">
              {!hasConsumptionMeasurements ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-pink-200 bg-pink-50/30 px-6 text-center text-sm font-semibold text-slate-500">
                  Fuel cost records are available, but liters or distance measurements have not been recorded yet.
                </div>
              ) : <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedTrendView === "Weekly" ? consumptionDataWeeklyView : consumptionDataDailyView}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fbcfe8" vertical={false} opacity={0.4} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                    axisLine={{ stroke: "#f1f5f9" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #fbcfe8",
                      boxShadow: "0 10px 25px -5px rgba(184, 0, 73, 0.1)",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "15px", fontSize: "12px", fontWeight: "600" }} />
                  <Bar
                    yAxisId="left"
                    dataKey="consumption"
                    fill="#b80049"
                    name="Fuel Draw (L)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="distance"
                    stroke="#2563eb"
                    name="Distance (km)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                  />
                </BarChart>
              </ResponsiveContainer>}
            </div>
          </div>

          {/* New Feature Chart: Energy Mix Breakdown Donut Chart */}
          <div className="bg-white border border-pink-100 rounded-2xl p-6 sm:p-7 shadow-sm shadow-pink-900/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#b80049] uppercase tracking-wider">Route Mix Analysis</span>
                <span className="text-xs text-slate-400">By Delivery Unit Type</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">Delivery Fuel Breakdown</h2>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of fuel cost across courier delivery routes and unit types.</p>
            </div>

            <div className="w-full h-[220px] relative my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                      data={fuelTypeBreakdownView}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                      {fuelTypeBreakdownView.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #fbcfe8",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900">{hasData ? formatPeso(totalFuelSpend ?? 0, 0) : "—"}</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Total Spend</span>
              </div>
            </div>

            {/* Custom Donut Legend */}
            <div className="grid grid-cols-3 gap-2 border-t border-pink-100 pt-4">
              {fuelTypeBreakdownView.map((item) => (
                <div key={item.name} className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-700">{item.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">{item.share}</span>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* Lower Row: Efficiency Trend Area Chart (2/3 Width) + Recent Refueling Transactions (1/3 Width) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* New Feature Chart: Real-time Miles Per kWh Efficiency Line/Area Chart */}
          <div className="lg:col-span-2 bg-white border border-pink-100 rounded-2xl p-6 sm:p-7 shadow-sm shadow-pink-900/5 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <span className="text-xs font-bold text-[#b80049] uppercase tracking-wider">Efficiency Index</span>
                <h2 className="text-lg font-black text-slate-900">
                  Courier Route Efficiency Curve
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target efficiency threshold vs active courier route performance.
                </p>
              </div>

              {/* Powertrain Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Filter:</span>
                {(["All", "EV", "Hybrid"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedEnergyType(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                      selectedEnergyType === type
                        ? "bg-pink-100 text-[#b80049] border-pink-300"
                        : "bg-white text-slate-600 border-slate-200 hover:border-pink-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Efficiency Area Chart */}
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrendDataView} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b80049" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#b80049" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fbcfe8" vertical={false} opacity={0.4} />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "#f1f5f9" }} tickLine={false} />
                  <YAxis domain={[1.8, 3.0]} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #fbcfe8",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#b80049"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorEff)"
                    name="Actual Efficiency (km/L)"
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                    name="Target Benchmark"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Refueling Transactions Table/Sidebar */}
          <div className="bg-white border border-pink-100 rounded-2xl p-6 sm:p-7 shadow-sm shadow-pink-900/5 flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Recent Delivery Fuel Activity</h2>
                <p className="text-xs text-slate-500">Live delivery fuel events log</p>
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleAlertAction("Opening complete delivery fuel transaction ledger...");
                }}
                className="text-xs font-bold text-[#b80049] hover:underline"
              >
                View Full Log
              </a>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
              {transactionsView.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => handleAlertAction(`Viewing details for delivery fuel event ${t.id} (${t.name})`)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    t.alert
                      ? "bg-rose-50/70 border-rose-200 hover:border-rose-300"
                      : "bg-pink-50/30 border-pink-100/80 hover:bg-pink-50/80 hover:border-pink-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        t.alert
                          ? "bg-rose-500 text-white shadow-xs"
                          : "bg-pink-100 text-[#b80049] border border-pink-200/60"
                      }`}
                    >
                      {t.id}
                    </div>
                    <div>
                      <span className={`text-sm font-bold block leading-tight ${t.alert ? "text-rose-700" : "text-slate-900"}`}>
                        {t.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{t.person} • {t.time}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-black block leading-tight ${t.alert ? "text-rose-600" : "text-slate-900"}`}>
                      {t.cost}
                    </span>
                    <span className="text-xs text-slate-500 font-bold">{t.volume}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

      </main>

      <GlobalFooter />
    </div>
  );
}

// KPI Card Component
function KpiCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendDirection,
  subtext,
  isGoodTrend,
  showValues = true,
  onToggle,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  subtext: string;
  isGoodTrend: boolean;
  showValues?: boolean;
  onToggle?: () => void;
}) {
  const displayValue = showValues ? value : (label.toLowerCase().includes("spend") || label.toLowerCase().includes("cost") ? "₱****" : "****");
  const trendColor = trendDirection === "up" ? "text-emerald-600" : trendDirection === "down" ? "text-rose-600" : "text-slate-500";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={showValues ? "Hide value" : "Show value"}
      className="bg-white/90 border border-pink-100 rounded-2xl p-4 shadow-sm shadow-pink-500/5 hover:border-pink-200 transition-all min-h-[150px] flex flex-col justify-between text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-[#b80049] shrink-0">
          <Icon name={icon} className="text-[20px]" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-end justify-between gap-2">
          <span className="text-[26px] font-black tracking-tight text-slate-900 leading-none">{displayValue}</span>
          <div className={`flex items-center gap-1 text-[11px] font-bold ${trendColor}`}>
            <span>{trendDirection === "up" ? "↗" : trendDirection === "down" ? "↘" : "→"}</span>
            <span>{trend}</span>
          </div>
        </div>
        <div className="mt-2 text-xs font-medium text-slate-700 leading-snug">{label}</div>
      </div>

      {subtext && <div className="mt-2 text-[11px] font-medium text-slate-400">{subtext}</div>}
    </button>
  );
}

// Icon Helper Component
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

// Mock Data Models
// Mock seed arrays removed — views are computed from `snapshot` above.