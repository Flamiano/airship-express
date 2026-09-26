"use client";

import { useState, useEffect } from "react";
import { getDashboardSnapshot, getFuelLogs } from "../../lib/api";
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

  // Quick Action Feedback
  const triggerToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const exportFuelData = () => {
    const rows = filteredFuelLogs.length ? filteredFuelLogs : (snapshot?.fuelLogs ?? []);
    if (!rows.length) {
      triggerToast("No fuel data available to export.");
      return;
    }

    const headers = [
      "id",
      "vehicleId",
      "vehicleType",
      "station",
      "loggedAt",
      "fuelType",
      "liters",
      "amount",
      "distance",
      "cost",
      "status",
    ];

    const escapeCsvValue = (value: any) => {
      const stringValue = value == null ? "" : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvRows = rows.map((log: any) => {
      const vehicle = snapshot?.vehicles?.find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const values = headers.map((header) => {
        const normalizedKey = header === "vehicleType" ? "vehicleType" : header;
        const raw = normalizedKey === "vehicleType"
          ? (vehicle?.vehicle_type ?? vehicle?.vehicleType ?? "")
          : (log[header] ?? log[header.toLowerCase()] ?? log[header.replace(/([A-Z])/g, "_$1").toLowerCase()] ?? "");
        return escapeCsvValue(raw);
      });
      return values.join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fuel-consumption-${selectedPeriod.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Fuel export generated.");
  };

  const [hasData, setHasData] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dash, fuelLogs] = await Promise.all([
          getDashboardSnapshot(),
          getFuelLogs(),
        ]);
        const logs = Array.isArray(fuelLogs) && fuelLogs.length > 0
          ? fuelLogs
          : (dash.fuelLogs || []);
        if (mounted) {
          setHasData(Boolean(logs.length));
          setSnapshot({ ...dash, fuelLogs: logs });
        }
      } catch (e) {
        console.warn('Failed to load fuel snapshot', e);
        if (mounted) setHasData(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // When no data, we'll keep rendering the page but components should display placeholders (0 / "—").

  const filteredFuelLogs = (() => {
    if (!hasData || !snapshot) return [] as any[];

    const logs = snapshot.fuelLogs || [];
    const vehicles = snapshot.vehicles || [];
    const now = new Date();

    const getStartOfRange = () => {
      if (selectedPeriod === "This Week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (selectedPeriod === "This Month") return new Date(now.getFullYear(), now.getMonth(), 1);
      return new Date(now.getFullYear(), 0, 1);
    };

    const start = getStartOfRange();

    return logs.filter((log: any) => {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      if (Number.isNaN(date.getTime()) || date < start) return false;

      const vehicle = vehicles.find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const vtype = String(vehicle?.vehicle_type ?? vehicle?.vehicleType ?? vehicle?.model ?? "").toLowerCase();
      const isEv = /ev|electric/.test(vtype);
      const isDiesel = !isEv;

      if (activeTab === "ev" && !isEv) return false;
      if (activeTab === "diesel" && !isDiesel) return false;
      return true;
    });
  })();

  const pesoFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });

  const formatPeso = (value: number) => pesoFormatter.format(Number.isFinite(value) ? value : 0);

  // Derived view data (computed from snapshot when available)
  const chartDataView = (() => {
    const labels = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const buckets = labels.map((l) => ({ label: l, diesel: 0, ev: 0, total: "₱0" }));
    if (!filteredFuelLogs.length) return buckets;

    const vehicles = snapshot?.vehicles || [];
    for (const log of filteredFuelLogs) {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      const hour = date.getHours();
      const idx = Math.floor(hour / 3) % 8;
      const cost = Number(log.cost ?? log.amount ?? 0) || 0;
      const vehicle = vehicles.find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const vtype = String(vehicle?.vehicle_type ?? vehicle?.vehicleType ?? vehicle?.model ?? "").toLowerCase();
      if (/ev|electric/.test(vtype)) buckets[idx].ev += cost;
      else buckets[idx].diesel += cost;
    }
    for (const b of buckets) {
      const total = b.diesel + b.ev;
      b.total = formatPeso(total);
    }
    return buckets;
  })();

  const classBreakdownView = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const vehicles = snapshot.vehicles || [];
    const logs = filteredFuelLogs;
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
      const cost = Number(log.cost ?? log.amount ?? 0) || 0;
      const key = /rig|truck|class/.test(t) ? "Heavy Rig" : /ev|electric/.test(t) ? "EV Delivery Vans" : /bike|pedal|cargo/.test(t) ? "Urban Cargo eBikes" : "Other";
      if (groups[key]) groups[key].value += cost;
    }
    const maxValue = Math.max(...Object.values(groups).map((g) => g.value), 1);
    const items = Object.values(groups).map((g) => ({
      ...g,
      value: formatPeso(g.value),
      efficiency: g.value > 0 ? `${((g.value / maxValue) * 100).toFixed(0)}% mix` : "0%",
      width: maxValue > 0 ? `${(g.value / maxValue) * 100}%` : "0%",
    }));
    return items;
  })();

  const anomaliesView = (() => {
    if (!hasData || !snapshot) return [] as AnomalyAlert[];
    const logs = filteredFuelLogs;
    const alerts: AnomalyAlert[] = [];
    for (const log of logs) {
      const cost = Number(log.cost ?? log.amount ?? 0) || 0;
      const liters = Number(log.liters ?? 0) || 0;
      const fuelCostThreshold = 25000;
      const idleThreshold = 200;
      const isSupplySpike = cost > fuelCostThreshold;
      const isIdleWaste = (log.idle === true) || Number(log.distance ?? 0) < 1;
      if (isSupplySpike || (isIdleWaste && liters > idleThreshold)) {
        alerts.push({
          id: String(log.id ?? Math.random()),
          target: `Unit ${log.vehicleId ?? "?"}`,
          type: isIdleWaste ? "High Idle" : "Irregular Draw",
          severity: cost > fuelCostThreshold ? "critical" : "warning",
          description: isIdleWaste
            ? `Idle route spill detected with ₱${Number(cost).toLocaleString()} in fuel draw.`
            : `Unusually high fuel draw for route: ₱${Number(cost).toLocaleString()}.`,
          metric: formatPeso(cost),
        });
      }
    }
    return alerts;
  })();

  const recentEventsView = (() => {
    if (!hasData || !snapshot) return [] as any[];
    const logs = filteredFuelLogs.slice().sort((a: any, b: any) => new Date(b.loggedAt ?? b.logged_at ?? b.createdAt ?? b.created_at ?? 0).getTime() - new Date(a.loggedAt ?? a.logged_at ?? a.createdAt ?? a.created_at ?? 0).getTime());
    const vehicles = snapshot.vehicles || [];
    return logs.slice(0, 8).map((l: any) => {
      const date = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? Date.now());
      const v = vehicles.find((x: any) => x.id === (l.vehicleId ?? l.vehicle_id));
      const vtype = String(v?.vehicle_type ?? v?.vehicleType ?? "").toLowerCase();
      const unit = /ev|electric/.test(vtype) ? "kWh" : "L";
      const costValue = Number(l.cost ?? l.amount ?? 0) || 0;
      return { id: l.id ?? "-", type: /ev|electric/.test(vtype) ? "Electric" : "Diesel", location: l.station ?? "—", amount: `${Math.round(Number(l.liters ?? l.amount ?? 0) || 0)} ${unit}`, cost: costValue ? `₱${Number(costValue).toLocaleString()}` : "—", time: date.toLocaleTimeString() };
    });
  })();

  // KPIs computed from snapshot (fallbacks when no data)
  const handleKpiToggle = () => setShowMetricValues((current) => !current);

  const kpiTotalFuelUsage = (() => {
    const fallback = "₱0";
    if (!hasData || !snapshot) return showMetricValues ? fallback : "***";
    const totalCost = filteredFuelLogs.reduce((s: number, l: any) => s + Number(l.cost ?? l.amount ?? 0), 0);
    const value = formatPeso(totalCost);
    return showMetricValues ? value : "***";
  })();

  const kpiAvgEfficiency = (() => {
    const fallback = "0 km/L";
    if (!hasData || !snapshot) return showMetricValues ? fallback : "***";
    const logs = filteredFuelLogs;
    const totalLiters = logs.reduce((s: number, l: any) => s + Number(l.liters ?? 0), 0);
    const totalDistance = logs.reduce((s: number, l: any) => s + Number(l.distance ?? 0), 0);
    const eff = totalLiters > 0 ? (totalDistance / totalLiters) : 0;
    const value = eff ? `${eff.toFixed(2)} km/L` : "0 km/L";
    return showMetricValues ? value : "***";
  })();

  const kpiIdleWaste = (() => {
    const fallback = "₱0";
    if (!hasData || !snapshot) return showMetricValues ? fallback : "***";
    const logs = filteredFuelLogs;
    const idleCost = logs.filter((l: any) => (l.idle === true) || Number(l.distance ?? 0) < 1).reduce((s: number, l: any) => s + Number(l.cost ?? l.amount ?? 0), 0);
    const value = formatPeso(idleCost);
    return showMetricValues ? value : "***";
  })();

  const kpiDispatchEfficiency = (() => {
    const fallback = "0%";
    if (!hasData || !snapshot) return showMetricValues ? fallback : "***";
    const trips = snapshot.trips || [];
    if (!trips.length) return showMetricValues ? "0%" : "***";
    const optimized = trips.filter((t: any) => Boolean(t.optimized) || Boolean(t.isOptimized)).length;
    const pct = Math.round((optimized / trips.length) * 100);
    const value = `${pct}%`;
    return showMetricValues ? value : "***";
  })();

  // small helper to compute percent change between two numbers
  function percentChange(current: number, previous: number) {
    if (previous === 0 && current === 0) return "0.0%";
    if (previous === 0 || !isFinite(previous)) return "0.0%";
    const diff = current - previous;
    const pct = (diff / Math.abs(previous)) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  // compute deltas over the last 30 days vs previous 30 days
  const now = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000;

  const getPeriodWindow = () => {
    if (selectedPeriod === "This Week") {
      const periodEnd = now;
      const periodStart = now - 7 * MS_DAY;
      const prevPeriodStart = periodStart - 7 * MS_DAY;
      const prevPeriodEnd = periodStart - 1;
      return { periodStart, periodEnd, prevPeriodStart, prevPeriodEnd };
    }

    if (selectedPeriod === "This Month") {
      const periodEnd = now;
      const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const prevPeriodStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
      const prevPeriodEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999).getTime();
      return { periodStart, periodEnd, prevPeriodStart, prevPeriodEnd };
    }

    const periodEnd = now;
    const periodStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const prevPeriodStart = new Date(new Date().getFullYear() - 1, 0, 1).getTime();
    const prevPeriodEnd = new Date(new Date().getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
    return { periodStart, periodEnd, prevPeriodStart, prevPeriodEnd };
  };

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

  const { periodStart, periodEnd, prevPeriodStart, prevPeriodEnd } = getPeriodWindow();

  const totalCurrent = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => {
    const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
    return ts >= periodStart && ts <= periodEnd ? s + Number(l.cost ?? l.amount ?? 0) : s;
  }, 0) : 0;
  const totalPrevious = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => {
    const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
    return ts >= prevPeriodStart && ts <= prevPeriodEnd ? s + Number(l.cost ?? l.amount ?? 0) : s;
  }, 0) : 0;
  const totalChange = percentChange(totalCurrent, totalPrevious);

  const idleCurrent = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => {
    const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
    const isIdle = Boolean(l.idle) || Number(l.distance ?? 0) < 1;
    return ts >= periodStart && ts <= periodEnd && isIdle ? s + Number(l.cost ?? l.amount ?? 0) : s;
  }, 0) : 0;
  const idlePrevious = hasData && snapshot ? (snapshot.fuelLogs || []).reduce((s: number, l: any) => {
    const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
    const isIdle = Boolean(l.idle) || Number(l.distance ?? 0) < 1;
    return ts >= prevPeriodStart && ts <= prevPeriodEnd && isIdle ? s + Number(l.cost ?? l.amount ?? 0) : s;
  }, 0) : 0;
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

  function sumFuelLitersInRange(startMs: number, endMs: number) {
    if (!snapshot) return 0;
    const logs = snapshot.fuelLogs || [];
    return logs.reduce((s: number, l: any) => {
      const ts = new Date(l.loggedAt ?? l.logged_at ?? l.createdAt ?? l.created_at ?? 0).getTime();
      if (ts >= startMs && ts <= endMs) return s + Number(l.liters ?? l.amount ?? 0);
      return s;
    }, 0);
  }

  const litersCurrent = hasData && snapshot ? sumFuelLitersInRange(periodStart, periodEnd) : 0;
  const litersPrevious = hasData && snapshot ? sumFuelLitersInRange(prevPeriodStart, prevPeriodEnd) : 0;
  const effCurrent = litersCurrent > 0 ? distCurrent / litersCurrent : 0;
  const effPrevious = litersPrevious > 0 ? distPrevious / litersPrevious : 0;
  const efficiencyChange = effPrevious > 0 ? percentChange(effCurrent, effPrevious) : "0.0%";

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

  const aiRecommendation = (() => {
    if (!snapshot || !filteredFuelLogs.length) {
      return "No fuel data available for AI recommendation.";
    }

    const totalFuelSpend = filteredFuelLogs.reduce((sum: number, log: any) => sum + Number(log.cost ?? log.amount ?? 0), 0);
    const idleFuelSpend = filteredFuelLogs.filter((log: any) => (log.idle === true) || Number(log.distance ?? 0) < 1).reduce((sum: number, log: any) => sum + Number(log.cost ?? log.amount ?? 0), 0);
    const dispatchRate = ((snapshot.trips || []).filter((t: any) => Boolean(t.optimized) || Boolean(t.isOptimized)).length / Math.max((snapshot.trips || []).length, 1)) * 100;

    if (idleFuelSpend > totalFuelSpend * 0.2) {
      return `Idle route waste is ${formatPeso(idleFuelSpend)}; reschedule depot idling to reduce unnecessary fuel spend.`;
    }
    if (dispatchRate < 70) {
      return `Dispatch optimization is below target (${dispatchRate.toFixed(0)}%); re-balance routes to cut fuel cost.`;
    }
    return "Fleet performance is healthy. Keep current route mix and monitor spend trends for the next cycle.";
  })();

  const weeklyFuelTrend = (() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const buckets = labels.map((label) => ({ label, diesel: 0, ev: 0 }));

    if (!snapshot || !filteredFuelLogs.length) return buckets;

    const now = new Date();
    const startOfWindow = new Date(now);
    startOfWindow.setHours(0, 0, 0, 0);
    startOfWindow.setDate(now.getDate() - 6);

    for (const log of filteredFuelLogs) {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      if (Number.isNaN(date.getTime()) || date < startOfWindow) continue;

      const index = Math.min(6, Math.max(0, Math.floor((date.getTime() - startOfWindow.getTime()) / (24 * 60 * 60 * 1000))));
      const vehicle = (snapshot.vehicles || []).find((v: any) => v.id === (log.vehicleId ?? log.vehicle_id));
      const isEv = /ev|electric/.test(String(vehicle?.vehicle_type ?? vehicle?.vehicleType ?? vehicle?.model ?? "").toLowerCase());
      const cost = Number(log.cost ?? log.amount ?? 0) || 0;
      if (activeTab === "all") {
        if (isEv) buckets[index].ev += cost;
        else buckets[index].diesel += cost;
      } else if (activeTab === "ev" && isEv) {
        buckets[index].ev += cost;
      } else if (activeTab === "diesel" && !isEv) {
        buckets[index].diesel += cost;
      }
    }

    return buckets;
  })();

  const weeklyEfficiencyTrend = (() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const buckets = labels.map((label) => ({ label, value: 0 }));

    if (!snapshot || !filteredFuelLogs.length) return buckets;

    const now = new Date();
    const startOfWindow = new Date(now);
    startOfWindow.setHours(0, 0, 0, 0);
    startOfWindow.setDate(now.getDate() - 6);

    for (const log of filteredFuelLogs) {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      if (Number.isNaN(date.getTime()) || date < startOfWindow) continue;

      const index = Math.min(6, Math.max(0, Math.floor((date.getTime() - startOfWindow.getTime()) / (24 * 60 * 60 * 1000))));
      const liters = Number(log.liters ?? log.amount ?? 0) || 0;
      const distance = Number(log.distance ?? 0) || 0;
      const efficiency = liters > 0 ? distance / liters : 0;
      buckets[index].value += efficiency;
    }

    return buckets.map((bucket) => ({ ...bucket, value: Number(bucket.value.toFixed(1)) }));
  })();

  const weeklyIdleTrend = (() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const buckets = labels.map((label) => ({ label, value: 0 }));

    if (!snapshot || !filteredFuelLogs.length) return buckets;

    const now = new Date();
    const startOfWindow = new Date(now);
    startOfWindow.setHours(0, 0, 0, 0);
    startOfWindow.setDate(now.getDate() - 6);

    for (const log of filteredFuelLogs) {
      const date = new Date(log.loggedAt ?? log.logged_at ?? log.createdAt ?? log.created_at ?? Date.now());
      if (Number.isNaN(date.getTime()) || date < startOfWindow) continue;

      const index = Math.min(6, Math.max(0, Math.floor((date.getTime() - startOfWindow.getTime()) / (24 * 60 * 60 * 1000))));
      const isIdle = Boolean(log.idle) || Number(log.distance ?? 0) < 1;
      if (isIdle) buckets[index].value += Number(log.cost ?? log.amount ?? 0) || 0;
    }

    return buckets.map((bucket) => ({ ...bucket, value: Number(bucket.value.toFixed(0)) }));
  })();

  const analyticsCards = [
    {
      title: "Fuel Spend Trend",
      subtitle: "Operational fuel draw by route segment",
      colorA: "#ec2188",
      colorB: "#b80049",
      series: weeklyFuelTrend.map((item) => ({
        label: item.label,
        value: item.diesel + item.ev,
        tooltip: `₱${(item.diesel + item.ev).toLocaleString()}`,
      })),
    },
    {
      title: "Route Efficiency",
      subtitle: "Distance vs fuel draw efficiency",
      colorA: "#f7b9d5",
      colorB: "#ec2188",
      series: weeklyEfficiencyTrend.map((item) => ({
        label: item.label,
        value: item.value || 0,
        tooltip: `${item.value.toFixed(1)} km/L`,
      })),
    },
    {
      title: "Idle Waste",
      subtitle: "Unplanned draw and non-productive use",
      colorA: "#f5a9bc",
      colorB: "#d7085a",
      series: weeklyIdleTrend.map((item) => ({
        label: item.label,
        value: item.value || 0,
        tooltip: `₱${(item.value || 0).toLocaleString()}`,
      })),
    },
  ];

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
            <div className="flex items-center bg-[#f3e9ee] p-1 rounded-full border border-[#f1dfe7] overflow-hidden shadow-inner shadow-white/80">
              {(["This Week", "This Month", "YTD"] as Period[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-5 py-2.5 rounded-full text-[15px] font-medium transition-all duration-200 ${
                    selectedPeriod === period
                      ? "bg-[#b80049] text-white shadow-[0_2px_10px_rgba(184,0,73,0.18)]"
                      : "text-[#1e1a1c] hover:text-[#b80049]"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <button
              onClick={exportFuelData}
              className="px-4 py-2.5 bg-[#17191d] hover:bg-[#1c1f25] text-white rounded-full text-[15px] font-medium transition-all flex items-center gap-2 shadow-sm border border-[#0d0e10]"
            >
              <Icon name="download" className="text-base" /> Export Data
            </button>
          </div>
        </div>

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            title="Total Fuel Usage"
            value={kpiTotalFuelUsage}
            change={totalChange}
            isIncreaseBad={true}
            subtext={totalChange !== "—" ? `${totalChange} vs prev` : "0.0%"}
            icon="bolt"
            accent="pink"
            onToggle={handleKpiToggle}
          />
          <KpiCard
            title="Avg Fuel Efficiency"
            value={kpiAvgEfficiency}
            change={efficiencyChange}
            isIncreaseBad={false}
            subtext={efficiencyChange !== "—" ? `${efficiencyChange} vs prev` : "0.0%"}
            icon="speed"
            accent="green"
            onToggle={handleKpiToggle}
          />
          <KpiCard
            title="Idle Route Waste"
            value={kpiIdleWaste}
            change={idleChange}
            isIncreaseBad={false}
            subtext={idleChange !== "—" ? `${idleChange} vs prev` : "0.0%"}
            icon="timer"
            accent="orange"
            onToggle={handleKpiToggle}
          />
          <KpiCard
            title="Dispatch Efficiency"
            value={kpiDispatchEfficiency}
            change={dispatchChange}
            isIncreaseBad={false}
            subtext={dispatchChange !== "—" ? `${dispatchChange} vs prev` : "0.0%"}
            icon="eco"
            accent="pink"
            onToggle={handleKpiToggle}
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
                {aiRecommendation}
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Layout: Fuel Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {analyticsCards.map((chart) => {
            const maxValue = Math.max(...chart.series.map((point) => point.value), 1);

            return (
              <div key={chart.title} className="bg-white rounded-3xl p-5 border border-[#b80049]/10 shadow-[0_8px_30px_rgba(184,0,73,0.04)]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1e1a1c]">{chart.title}</h3>
                    <p className="text-[11px] text-[#706068]">{chart.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#faf1f5] text-[#b80049]">Live</span>
                </div>

                <div className="relative h-[170px] rounded-2xl bg-[#faf8f9] border border-gray-100 p-3">
                  <div className="absolute inset-0 flex flex-col justify-between px-3 py-4 pointer-events-none">
                    {[0, 25, 50, 75, 100].map((line) => (
                      <div key={line} className="border-t border-dashed border-[#f0dfe8]" />
                    ))}
                  </div>

                  <div className="relative z-10 h-full flex items-end justify-between gap-2">
                    {chart.series.map((point) => {
                      const height = Math.max(10, (point.value / maxValue) * 100);
                      return (
                        <div key={`${chart.title}-${point.label}`} className="group flex-1 flex flex-col items-center justify-end h-full gap-2">
                          <div className="relative w-full h-full flex items-end justify-center">
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1e1a1c] px-2 py-1 text-[9px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg">
                              {point.tooltip}
                            </div>
                            <div
                              className="w-full rounded-t-xl transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_8px_18px_rgba(184,0,73,0.20)]"
                              style={{
                                height: `${height}%`,
                                background: `linear-gradient(180deg, ${chart.colorA} 0%, ${chart.colorB} 100%)`,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-medium text-[#706068]">{point.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
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
  onToggle,
}: {
  title: string;
  value: string;
  change: string;
  isIncreaseBad: boolean;
  subtext: string;
  icon: string;
  accent: "pink" | "green" | "orange";
  onToggle?: () => void;
}) {
  const isHidden = value.includes("*");
  const isPositive = change.startsWith("+");
  const isNegative = change.startsWith("-");
  const isFlat = !isPositive && !isNegative;
  const isBad = isPositive ? isIncreaseBad : !isIncreaseBad;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle?.();
        }
      }}
      className="group bg-[#f6f5f6] border border-[#efdfe5] rounded-[28px] p-4 flex flex-col justify-between text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(184,0,73,0.06)] min-h-[130px] outline-none focus:ring-2 focus:ring-[#b80049]/20"
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-[16px] border ${
            accent === "pink"
              ? "bg-[#faedf3] border-[#f4dfe9] text-[#b80049]"
              : accent === "green"
              ? "bg-[#ebfaf2] border-[#d9f2e8] text-[#0d8b66]"
              : "bg-[#fff1df] border-[#f5e1bc] text-[#d97b00]"
          }`}
        >
          <Icon name={icon} className="text-[22px]" fill />
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
            accent === "pink"
              ? "border-[#f4dfe9] bg-[#fff5f9] text-[#b80049]"
              : accent === "green"
              ? "border-[#d9f2e8] bg-[#f2fff9] text-[#0d8b66]"
              : "border-[#f5e1bc] bg-[#fffaf2] text-[#d97b00]"
          }`}
        >
          {isPositive ? "Live" : isFlat ? "Stable" : "Watch"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="text-[30px] font-black tracking-[-0.06em] text-[#1d1a1c] leading-none">
          {value}
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-bold ${
            isFlat
              ? "bg-slate-100 text-slate-600"
              : isBad
              ? "bg-red-50 text-red-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <Icon
            name={isFlat ? "horizontal_rule" : isPositive ? "north_east" : "south_east"}
            className="text-[12px]"
          />
          {change}
        </span>
      </div>

      <div className="mt-2 text-[12px] font-medium text-[#50444a] leading-snug">{title}</div>
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