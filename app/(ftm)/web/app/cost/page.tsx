"use client";

import { useEffect, useState } from "react";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import { KpiGrid } from "./src/components/KpiRow";
import AnalyticsRow from "./src/components/AnalyticsRow";
import DataTableRow from "./src/components/DataTableRow";
import { getCostEntries } from "../lib/api";
import { getCurrentRole, hasRoleAccess, type AppRole } from "../lib/roleAccess";
import { supabase } from "../lib/supabaseClient";
import { MaskProvider } from "./src/lib/MaskContext";
import type { Kpi, Trend } from "./src/lib/data";

type CostEntry = {
  id: string;
  vehicleId?: string | null;
  tripId?: string | null;
  category: string;
  amount: number | null;
  entryDate?: string | null;
  remarks?: string | null;
  receipt_image?: string | null;
};

type ExpenseSlice = {
  label: string;
  percent: number;
  color: string;
  dot: string;
};

type CostDriver = {
  rank: number;
  label: string;
  percent: string;
};

type TrendData = {
  labels: string[];
  actual: number[];
  planned: number[];
  trendLine: number[];
};

type Insight = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  valueSuffix?: string;
  borderLeft?: boolean;
};

// Refined color palette tailored for the Pink & White theme
const CATEGORY_STYLES: Record<string, { color: string; dot: string }> = {
  Fuel: { color: "#ec4899", dot: "bg-pink-500" },
  Maintenance: { color: "#f43f5e", dot: "bg-rose-500" },
  Toll: { color: "#fb7185", dot: "bg-rose-400" },
  Salary: { color: "#d946ef", dot: "bg-fuchsia-500" },
  Insurance: { color: "#a855f7", dot: "bg-purple-500" },
  Other: { color: "#94a3b8", dot: "bg-slate-400" },
  Driver: { color: "#f472b6", dot: "bg-pink-400" },
  "Driver Allowance": { color: "#8b5cf6", dot: "bg-violet-500" },
  "Mobile Data & Internet": { color: "#0ea5e9", dot: "bg-sky-500" },
  Parking: { color: "#fbbf24", dot: "bg-amber-400" },
  Revenue: { color: "#10b981", dot: "bg-emerald-500" },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFuelCategory(value?: string | null) {
  return /fuel|energy/i.test(String(value ?? ""));
}

function normalizeCostEntry(entry: Record<string, unknown> | null | undefined): CostEntry {
  const record = entry ?? {};
  const rawCategory = String((record.category as string | null | undefined) ?? "Other").trim();
  const category = isFuelCategory(rawCategory)
    ? "Fuel"
    : rawCategory.toLowerCase().includes("maintenance") || rawCategory.toLowerCase().includes("service") || rawCategory.toLowerCase().includes("repair")
      ? "Maintenance"
      : rawCategory;

  const numericAmount = Number((record.amount ?? record.cost ?? 0) as number | string | null | undefined);

  return {
    ...record,
    id: String(record.id ?? ""),
    vehicleId: (record.vehicleId as string | null | undefined) ?? (record.vehicle_id as string | null | undefined) ?? null,
    tripId: (record.tripId as string | null | undefined) ?? (record.trip_id as string | null | undefined) ?? null,
    category,
    amount: Number.isFinite(numericAmount) ? numericAmount : null,
    entryDate: (record.entryDate as string | null | undefined) ?? (record.entry_date as string | null | undefined) ?? (record.recorded_at as string | null | undefined) ?? (record.created_at as string | null | undefined) ?? null,
  };
}

function buildCategoryTotals(entries: CostEntry[]) {
  const totals = new Map<string, number>();
  let totalAmount = 0;

  for (const entry of entries) {
    const amount = entry.amount ?? 0;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + amount);
    totalAmount += amount;
  }

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const slices: ExpenseSlice[] = [];
  let topSum = 0;

  for (let i = 0; i < sorted.length && i < 5; i += 1) {
    const [label, amount] = sorted[i];
    topSum += amount;
    const style = CATEGORY_STYLES[label] ?? {
      color: "#cbd5e1",
      dot: "bg-slate-400",
    };
    slices.push({
      label,
      percent: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      color: style.color,
      dot: style.dot,
    });
  }

  if (sorted.length > 5 && totalAmount > 0) {
    slices.push({
      label: "Other",
      percent: ((totalAmount - topSum) / totalAmount) * 100,
      color: "#cbd5e1",
      dot: "bg-slate-400",
    });
  }

  return slices;
}

function buildTopDrivers(entries: CostEntry[]): CostDriver[] {
  const totals = buildCategoryTotals(entries);
  return totals.slice(0, 5).map((slice, index) => ({
    rank: index + 1,
    label: slice.label,
    percent: `${slice.percent.toFixed(0)}%`,
  }));
}

function buildTrendData(entries: CostEntry[]): TrendData {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 8; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: getMonthKey(date), label: getMonthLabel(date) });
  }

  const totalsByMonth = new Map(months.map((month) => [month.key, 0]));
  for (const entry of entries) {
    const date = normalizeDate(entry.entryDate || null);
    if (!date) continue;
    const key = getMonthKey(date);
    if (!totalsByMonth.has(key)) continue;
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + (entry.amount ?? 0));
  }

  const actual = months.map((month) => totalsByMonth.get(month.key) ?? 0);
  const planned = actual.map((value) => Math.round(value * 0.92));
  const trendLine = actual.map((_, index) => {
    const slice = actual.slice(Math.max(0, index - 2), index + 1);
    return Math.round(
      slice.reduce((sum, value) => sum + value, 0) / slice.length
    );
  });

  return {
    labels: months.map((month) => month.label),
    actual,
    planned,
    trendLine,
  };
}

function buildKpis(
  entries: CostEntry[],
  trendData: TrendData
): { primary: Kpi[]; secondary: Kpi[] } {
  const totalCost = entries.reduce(
    (sum, entry) => sum + (entry.amount ?? 0),
    0
  );
  const fuelCost = entries
    .filter((entry) => isFuelCategory(entry.category))
    .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const maintenanceCost = entries
    .filter((entry) => entry.category === "Maintenance")
    .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const categoryCost = (source: CostEntry[], pattern: RegExp) =>
    source
      .filter((entry) => pattern.test(String(entry.category)))
      .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const driverAllowancePattern = /driver\s*allowance|allowance/i;
  const mobileDataPattern = /mobile\s*data|data\s*(?:&|and)?\s*internet|internet/i;
  const driverAllowanceCost = categoryCost(entries, driverAllowancePattern);
  const mobileDataCost = categoryCost(entries, mobileDataPattern);
  const uniqueVehicles = new Set(
    entries.map((entry) => entry.vehicleId).filter(Boolean)
  ).size;
  const uniqueTrips = new Set(
    entries.map((entry) => entry.tripId).filter(Boolean)
  ).size;
  const averageEntry = entries.length ? totalCost / entries.length : 0;
  const latest = trendData.actual[trendData.actual.length - 1] ?? 0;
  const previous = trendData.actual[trendData.actual.length - 2] ?? 0;
  const change = previous ? ((latest - previous) / previous) * 100 : 0;

  const fuelShare = totalCost ? (fuelCost / totalCost) * 100 : 0;
  const maintenanceShare = totalCost
    ? (maintenanceCost / totalCost) * 100
    : 0;
  const getMonthEntries = (monthOffset: number) => {
    const target = new Date();
    target.setMonth(target.getMonth() + monthOffset, 1);
    return entries.filter((entry) => {
      const date = normalizeDate(entry.entryDate || null);
      return date && getMonthKey(date) === getMonthKey(target);
    });
  };
  const currentMonthEntries = getMonthEntries(0);
  const previousMonthEntries = getMonthEntries(-1);
  const getPercentChange = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;
  const getTrend = (changeValue: number): Trend =>
    changeValue > 0 ? "up" : changeValue < 0 ? "down" : "flat";
  const currentMonthTotal = currentMonthEntries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const previousMonthTotal = previousMonthEntries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const currentFuelCost = currentMonthEntries.filter((entry) => isFuelCategory(entry.category)).reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const previousFuelCost = previousMonthEntries.filter((entry) => isFuelCategory(entry.category)).reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const currentMaintenanceCost = currentMonthEntries.filter((entry) => entry.category === "Maintenance").reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const previousMaintenanceCost = previousMonthEntries.filter((entry) => entry.category === "Maintenance").reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const currentDriverAllowanceCost = categoryCost(currentMonthEntries, driverAllowancePattern);
  const previousDriverAllowanceCost = categoryCost(previousMonthEntries, driverAllowancePattern);
  const currentMobileDataCost = categoryCost(currentMonthEntries, mobileDataPattern);
  const previousMobileDataCost = categoryCost(previousMonthEntries, mobileDataPattern);
  const currentFuelShare = currentMonthTotal ? (currentFuelCost / currentMonthTotal) * 100 : 0;
  const previousFuelShare = previousMonthTotal ? (previousFuelCost / previousMonthTotal) * 100 : 0;
  const currentMaintenanceShare = currentMonthTotal ? (currentMaintenanceCost / currentMonthTotal) * 100 : 0;
  const previousMaintenanceShare = previousMonthTotal ? (previousMaintenanceCost / previousMonthTotal) * 100 : 0;
  const currentAverageEntry = currentMonthEntries.length ? currentMonthTotal / currentMonthEntries.length : 0;
  const previousAverageEntry = previousMonthEntries.length ? previousMonthTotal / previousMonthEntries.length : 0;
  const currentUniqueVehicles = new Set(currentMonthEntries.map((entry) => entry.vehicleId).filter(Boolean)).size;
  const previousUniqueVehicles = new Set(previousMonthEntries.map((entry) => entry.vehicleId).filter(Boolean)).size;
  const currentUniqueTrips = new Set(currentMonthEntries.map((entry) => entry.tripId).filter(Boolean)).size;
  const previousUniqueTrips = new Set(previousMonthEntries.map((entry) => entry.tripId).filter(Boolean)).size;
  const monthlyChangeTrend: Trend = change > 0 ? "up" : change < 0 ? "down" : "flat";

  const sortedByCategory = Array.from(
    entries.reduce((map, entry) => {
      map.set(
        entry.category,
        (map.get(entry.category) ?? 0) + (entry.amount ?? 0)
      );
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const topCategory = sortedByCategory.length
    ? sortedByCategory[0][0]
    : "TEC";
  const topCategoryAmount = sortedByCategory.length ? sortedByCategory[0][1] : 0;
  const topCategoryShare = totalCost ? (topCategoryAmount / totalCost) * 100 : 0;

  const primaryKpis: Kpi[] = [
    {
      label: "Total Fleet Cost",
      value: formatCurrency(totalCost),
      trend: getTrend(change),
      trendValue: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      accent: "border-b-pink-500",
    },
    {
      label: "Monthly Cost Change",
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      trend: monthlyChangeTrend,
      trendValue: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      accent: change > 0 ? "border-b-rose-500" : change < 0 ? "border-b-emerald-500" : "border-b-slate-300",
      valueColor: change > 0 ? "text-rose-600" : change < 0 ? "text-emerald-600" : "text-slate-600",
    },
    {
      label: "Fuel Cost",
      value: formatCurrency(fuelCost),
      trend: getTrend(getPercentChange(currentFuelCost, previousFuelCost)),
      trendValue: `${getPercentChange(currentFuelCost, previousFuelCost) >= 0 ? "+" : ""}${getPercentChange(currentFuelCost, previousFuelCost).toFixed(1)}%`,
      accent: "border-b-pink-400",
    },
    {
      label: "Maintenance Cost",
      value: formatCurrency(maintenanceCost),
      trend: getTrend(getPercentChange(currentMaintenanceCost, previousMaintenanceCost)),
      trendValue: `${getPercentChange(currentMaintenanceCost, previousMaintenanceCost) >= 0 ? "+" : ""}${getPercentChange(currentMaintenanceCost, previousMaintenanceCost).toFixed(1)}%`,
      accent: "border-b-rose-400",
    },
    {
      label: "Driver Allowance",
      value: formatCurrency(driverAllowanceCost),
      trend: getTrend(getPercentChange(currentDriverAllowanceCost, previousDriverAllowanceCost)),
      trendValue: `${getPercentChange(currentDriverAllowanceCost, previousDriverAllowanceCost) >= 0 ? "+" : ""}${getPercentChange(currentDriverAllowanceCost, previousDriverAllowanceCost).toFixed(1)}%`,
      accent: "border-b-violet-500",
    },
    {
      label: "Mobile Data & Internet",
      value: formatCurrency(mobileDataCost),
      trend: getTrend(getPercentChange(currentMobileDataCost, previousMobileDataCost)),
      trendValue: `${getPercentChange(currentMobileDataCost, previousMobileDataCost) >= 0 ? "+" : ""}${getPercentChange(currentMobileDataCost, previousMobileDataCost).toFixed(1)}%`,
      accent: "border-b-sky-500",
    },
    {
      label: "Avg Cost per Entry",
      value: formatCurrency(averageEntry),
      trend: getTrend(getPercentChange(currentAverageEntry, previousAverageEntry)),
      trendValue: `${getPercentChange(currentAverageEntry, previousAverageEntry) >= 0 ? "+" : ""}${getPercentChange(currentAverageEntry, previousAverageEntry).toFixed(1)}%`,
      accent: "border-b-pink-600",
    },
    {
      label: "Unique Vehicles",
      value: String(uniqueVehicles),
      trend: getTrend(getPercentChange(currentUniqueVehicles, previousUniqueVehicles)),
      trendValue: `${getPercentChange(currentUniqueVehicles, previousUniqueVehicles) >= 0 ? "+" : ""}${getPercentChange(currentUniqueVehicles, previousUniqueVehicles).toFixed(1)}%`,
      accent: "border-b-fuchsia-500",
    },
  ];

  const secondaryKpis: Kpi[] = [
    {
      label: "Fuel Share",
      value: `${fuelShare.toFixed(1)}%`,
      trend: getTrend(getPercentChange(currentFuelShare, previousFuelShare)),
      trendValue: `${getPercentChange(currentFuelShare, previousFuelShare) >= 0 ? "+" : ""}${getPercentChange(currentFuelShare, previousFuelShare).toFixed(1)}%`,
      accent: "border-b-pink-500",
    },
    {
      label: "Maintenance Share",
      value: `${maintenanceShare.toFixed(1)}%`,
      trend: getTrend(getPercentChange(currentMaintenanceShare, previousMaintenanceShare)),
      trendValue: `${getPercentChange(currentMaintenanceShare, previousMaintenanceShare) >= 0 ? "+" : ""}${getPercentChange(currentMaintenanceShare, previousMaintenanceShare).toFixed(1)}%`,
      accent: "border-b-rose-500",
    },
    {
      label: "Top Expense Category",
      value: `${topCategory} (${topCategoryShare.toFixed(1)}%)`,
      trend: getTrend(getPercentChange(topCategoryAmount, previousMonthTotal)),
      trendValue: `${getPercentChange(topCategoryAmount, previousMonthTotal) >= 0 ? "+" : ""}${getPercentChange(topCategoryAmount, previousMonthTotal).toFixed(1)}%`,
      accent: "border-b-fuchsia-500",
    },
    {
      label: "Distinct Trips",
      value: String(uniqueTrips),
      trend: getTrend(getPercentChange(currentUniqueTrips, previousUniqueTrips)),
      trendValue: `${getPercentChange(currentUniqueTrips, previousUniqueTrips) >= 0 ? "+" : ""}${getPercentChange(currentUniqueTrips, previousUniqueTrips).toFixed(1)}%`,
      accent: "border-b-pink-400",
    },
    {
      label: "Entries Recorded",
      value: String(entries.length),
      trend: getTrend(getPercentChange(currentMonthEntries.length, previousMonthEntries.length)),
      trendValue: `${getPercentChange(currentMonthEntries.length, previousMonthEntries.length) >= 0 ? "+" : ""}${getPercentChange(currentMonthEntries.length, previousMonthEntries.length).toFixed(1)}%`,
      accent: "border-b-pink-600",
    },
  ];

  return { primary: primaryKpis, secondary: secondaryKpis };
}

function buildInsights(entries: CostEntry[], totalCost: number): Insight[] {
  const fuelCost = entries
    .filter((entry) => isFuelCategory(entry.category))
    .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const maintenanceCost = entries
    .filter((entry) => entry.category === "Maintenance")
    .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const feed = entries.reduce((map, entry) => {
    map.set(entry.category, (map.get(entry.category) ?? 0) + (entry.amount ?? 0));
    return map;
  }, new Map<string, number>());
  const topCategory =
    Array.from(feed.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "TEC";

  return [
    {
      icon: "savings",
      iconColor: "text-pink-600",
      label: "Fuel Share",
      value: totalCost ? formatPercent((fuelCost / totalCost) * 100) : "0%",
      valueColor: "text-pink-600",
      valueSuffix: "of spend",
    },
    {
      icon: "construction",
      iconColor: "text-rose-500",
      label: "Maintenance Share",
      value: totalCost ? formatPercent((maintenanceCost / totalCost) * 100) : "0%",
      valueColor: "text-rose-500",
      valueSuffix: "of spend",
    },
    {
      icon: "calendar_month",
      iconColor: "text-fuchsia-600",
      label: "Top Expense Category",
      value: topCategory,
      valueColor: "text-on-surface",
    },
    {
      icon: "warning",
      iconColor: "text-pink-500",
      label: "Entries Recorded",
      value: String(entries.length),
      valueColor: "text-pink-600",
    },
  ];
}

type BudgetRequest = {
  id: string;
  category: string;
  amount: number;
  reason: string;
  requestedBy: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
};

type AuditEntry = {
  id: string;
  user: string;
  action: string;
  details: string;
  createdAt: string;
};

const DEFAULT_BUDGET_LIMIT = 1500000;

const makeResourceId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function getRoleLabel(role: string | null) {
  switch (role) {
    case "admin":
      return "Admin";
    case "fleet_manager":
      return "Fleet Manager";
    case "dispatcher":
      return "Dispatcher";
    default:
      return "User";
  }
}

async function verifyCurrentUserPassword(password: string) {
  const email = window.localStorage.getItem("email");
  if (!email) {
    throw new Error("Your account email is unavailable for verification.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    throw new Error(error?.message || "The password verification failed.");
  }

  return data.user;
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [budgetLimit, setBudgetLimit] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_BUDGET_LIMIT;
    const savedBudgetLimit = window.localStorage.getItem("ftm_budget_limit");
    const parsedLimit = Number(savedBudgetLimit ?? "");
    return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_BUDGET_LIMIT;
  });
  const [budgetRequest, setBudgetRequest] = useState({ category: "Fuel", amount: "", reason: "", password: "" });
  const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedRequests = window.localStorage.getItem("ftm_budget_requests");
      return savedRequests ? (JSON.parse(savedRequests) as BudgetRequest[]) : [];
    } catch {
      return [];
    }
  });
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedAudit = window.localStorage.getItem("ftm_budget_audit_log");
      return savedAudit ? (JSON.parse(savedAudit) as AuditEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsMounted(true);
    setCurrentRole(getCurrentRole());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let mounted = true;

    void getCostEntries()
      .then((loadedEntries) => {
        if (!mounted) return;
        setCostEntries(
          Array.isArray(loadedEntries) ? loadedEntries.map(normalizeCostEntry) : []
        );
      })
      .catch((error) => {
        console.error("Failed to load cost entries:", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ftm_budget_requests", JSON.stringify(budgetRequests));
  }, [budgetRequests]);

  useEffect(() => {
    window.localStorage.setItem("ftm_budget_audit_log", JSON.stringify(auditEntries));
  }, [auditEntries]);

  useEffect(() => {
    window.localStorage.setItem("ftm_budget_limit", String(budgetLimit));
  }, [budgetLimit]);

  const roleForAccess = isMounted ? currentRole : null;
  const canManageBudget = hasRoleAccess(["fleet_manager"], roleForAccess);
  const canViewBudget = hasRoleAccess(["admin", "fleet_manager"], roleForAccess);
  const isDispatcher = roleForAccess === "dispatcher";

  if (!isMounted) {
    return (
      <MaskProvider>
        <div className="min-h-screen flex flex-col bg-background text-on-background">
          <GlobalNavbar />
          <main className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="max-w-lg rounded-2xl border border-pink-200 bg-white p-8 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Loading</p>
              <h1 className="mt-3 text-2xl font-bold text-on-surface">Loading cost dashboard…</h1>
            </div>
          </main>
          <GlobalFooter />
        </div>
      </MaskProvider>
    );
  }

  const totalCost = costEntries.reduce(
    (sum, entry) => sum + (entry.amount ?? 0),
    0
  );
  const remainingBudget = Math.max(budgetLimit - totalCost, 0);
  const utilization = budgetLimit > 0 ? Math.min((totalCost / budgetLimit) * 100, 100) : 0;
  const expenseBreakdown = buildCategoryTotals(costEntries);
  const topCostDrivers = buildTopDrivers(costEntries);
  const trendData = buildTrendData(costEntries);
  const { primary: primaryKpis, secondary: secondaryKpis } = buildKpis(
    costEntries,
    trendData
  );
  const insights = buildInsights(costEntries, totalCost);

  const addAuditEntry = (action: string, details: string) => {
    const nextEntry: AuditEntry = {
      id: makeResourceId("audit"),
      user: getRoleLabel(currentRole),
      action,
      details,
      createdAt: new Date().toISOString(),
    };

    setAuditEntries((previous) => [nextEntry, ...previous].slice(0, 8));
  };

  const submitBudgetRequest = async () => {
    if (!canManageBudget) {
      setErrorMessage("Budget requests are limited to fleet managers.");
      return;
    }

    const amount = Number(budgetRequest.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Enter a valid budget amount greater than zero.");
      return;
    }

    if (!budgetRequest.reason.trim()) {
      setErrorMessage("Add a short reason for the request.");
      return;
    }

    if (!budgetRequest.password.trim()) {
      setErrorMessage("Enter your account password to verify this action.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);
      await verifyCurrentUserPassword(budgetRequest.password);

      const nextRequest: BudgetRequest = {
        id: makeResourceId("budget-request"),
        category: budgetRequest.category,
        amount,
        reason: budgetRequest.reason.trim(),
        requestedBy: getRoleLabel(currentRole),
        status: "Pending",
        createdAt: new Date().toISOString(),
      };

      setBudgetRequests((previous) => [nextRequest, ...previous].slice(0, 5));
      setAuditEntries((previous) => [{
        id: makeResourceId("audit"),
        user: getRoleLabel(currentRole),
        action: "Budget request",
        details: `${budgetRequest.category} request for ${formatCurrency(amount)} (${budgetRequest.reason})`,
        createdAt: new Date().toISOString(),
      }, ...previous].slice(0, 8));
      setStatusMessage("Budget request submitted and queued for review.");
      setBudgetRequest((previous) => ({ ...previous, amount: "", reason: "", password: "" }));
      setIsRequestModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The password verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const approveBudgetLimit = async () => {
    if (!canManageBudget) {
      setErrorMessage("Only fleet managers can approve budgeting changes.");
      return;
    }

    if (!budgetRequest.password.trim()) {
      setErrorMessage("Enter your password to confirm the budget change.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);
      await verifyCurrentUserPassword(budgetRequest.password);

      const updatedLimit = Math.max(budgetLimit, totalCost || 1);
      setBudgetLimit(updatedLimit);
      addAuditEntry("Budget update", `Adjusted budget limit to ${formatCurrency(updatedLimit)} after verification.`);
      setStatusMessage("Approved budget ceiling updated successfully.");
      setBudgetRequest((previous) => ({ ...previous, password: "" }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The budget update could not be verified.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!canViewBudget) {
    return (
      <MaskProvider>
        <div className="min-h-screen flex flex-col bg-background text-on-background">
          <GlobalNavbar />
          <main className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="max-w-lg rounded-2xl border border-pink-200 bg-white p-8 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Access restricted</p>
              <h1 className="mt-3 text-2xl font-bold text-on-surface">Costing access is restricted</h1>
              <p className="mt-3 text-secondary">
                Budget analytics are available to admin and fleet manager roles only. Your current role is {getRoleLabel(currentRole)}.
              </p>
            </div>
          </main>
          <GlobalFooter />
        </div>
      </MaskProvider>
    );
  }

  return (
    <MaskProvider>
      <div className="cost-page min-h-screen flex flex-col bg-background text-on-background">
        <GlobalNavbar />

        <main className="cost-page__main flex-1 w-full max-w-none mx-0 px-3 sm:px-4 lg:px-6 py-6 flex flex-col gap-6">
          <div className="cost-page__hero flex flex-col gap-6 rounded-[24px] border border-[#f0e7eb] bg-[linear-gradient(180deg,#fdfdfe_0%,#f5f3f4_100%)] p-6 shadow-[10px_10px_22px_rgba(15,23,42,0.06),-8px_-8px_18px_rgba(255,255,255,0.8)] md:flex-row md:items-center md:justify-between sm:p-8">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef489d] shadow-[0_0_0_4px_rgba(239,72,157,0.12)] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d93a8e]">
                  Financial Intelligence
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-[#1f1f22] sm:text-3xl">
                Fleet Cost & Budget Management
              </h1>
              <p className="mt-1 text-sm text-[#4b5563]">
                Secure monitoring of fleet spend, category performance, and budget approvals for {getRoleLabel(currentRole)} users.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[#f2d8e6] bg-[#fff3fa] px-3 py-2 text-sm shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(217,58,142,0.04)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.12)]" />
              <span className="font-semibold text-[#d93a8e]">{getRoleLabel(currentRole)} view</span>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <div className="cost-panel rounded-[24px] border border-[#f0e7eb] bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f3f4_100%)] p-5 shadow-[10px_10px_18px_rgba(15,23,42,0.04),-8px_-8px_14px_rgba(255,255,255,0.9)]">
              <div className="flex items-center justify-between border-b border-[#eedfe7] pb-3">
                <h2 className="text-lg font-bold text-[#1f1f22]">Budget controls</h2>
                <span className="rounded-full border border-[#f4d5e6] bg-[#fff3fa] px-2.5 py-1 text-[11px] font-semibold text-[#d93a8e] shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">
                  {isDispatcher ? "View only" : canManageBudget ? "Manager access" : "Admin access"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[18px] border border-[#f1e5ea] bg-[linear-gradient(180deg,#ffffff_0%,#f7f5f6_100%)] p-4 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7280]">Approved budget</p>
                  <p className="mt-2 text-2xl font-bold text-[#1f2937]">{formatCurrency(budgetLimit)}</p>
                </div>
                <div className="rounded-[18px] border border-[#f1e5ea] bg-[linear-gradient(180deg,#ffffff_0%,#f7f5f6_100%)] p-4 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7280]">Utilization</p>
                  <p className="mt-2 text-2xl font-bold text-[#d93a8e]">{utilization.toFixed(1)}%</p>
                </div>
                <div className="rounded-[18px] border border-[#f1e5ea] bg-[linear-gradient(180deg,#ffffff_0%,#f7f5f6_100%)] p-4 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7280]">Available</p>
                  <p className="mt-2 text-2xl font-bold text-[#16a34a]">{formatCurrency(remainingBudget)}</p>
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#ece7ea] shadow-[inset_1px_1px_2px_rgba(15,23,42,0.08)]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#ef489d_0%,#f97316_100%)] shadow-[0_2px_8px_rgba(239,72,157,0.25)]" style={{ width: `${Math.min(utilization, 100)}%` }} />
              </div>

              {canManageBudget && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStatusMessage(null);
                      setIsRequestModalOpen(true);
                    }}
                    className="rounded-xl bg-[linear-gradient(180deg,#ec4899_0%,#d93a8e_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(217,58,142,0.22),inset_1px_1px_0_rgba(255,255,255,0.22)] transition hover:translate-y-[-1px]"
                  >
                    Request budget adjustment
                  </button>
                  <button
                    type="button"
                    onClick={approveBudgetLimit}
                    className="rounded-xl border border-[#efdbe4] bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f7_100%)] px-4 py-2.5 text-sm font-semibold text-[#d93a8e] shadow-[6px_6px_16px_rgba(15,23,42,0.04),-4px_-4px_12px_rgba(255,255,255,0.7)] transition hover:translate-y-[-1px]"
                  >
                    {isVerifying ? "Verifying..." : "Confirm budget update"}
                  </button>
                </div>
              )}

              {(statusMessage || errorMessage) && (
                <div className={`mt-5 rounded-xl border px-3 py-2 text-sm ${errorMessage ? "border-[#f4c5d3] bg-[#fff1f5] text-[#b91c4d]" : "border-[#cfead8] bg-[#f1fff7] text-[#166534]"}`}>
                  {errorMessage ?? statusMessage}
                </div>
              )}
            </div>

            <div className="cost-panel rounded-[24px] border border-[#f0e7eb] bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f3f4_100%)] p-5 shadow-[10px_10px_18px_rgba(15,23,42,0.04),-8px_-8px_14px_rgba(255,255,255,0.9)]">
              <h2 className="text-lg font-bold text-[#1f1f22]">Budget request status</h2>
              <div className="mt-4 space-y-3">
                {budgetRequests.length === 0 ? (
                  <div className="rounded-[18px] border border-[#f0e8eb] bg-[#f9f7f8] p-4 text-sm text-[#4b5563] shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">No active requests yet.</div>
                ) : (
                  budgetRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-[18px] border border-[#f0e8eb] bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f7_100%)] p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.9),inset_-1px_-1px_0_rgba(15,23,42,0.02)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#1f2937]">{request.category}</p>
                        <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b45309]">
                          {request.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#4b5563]">{request.reason}</p>
                      <p className="mt-2 text-sm font-semibold text-[#d93a8e]">{formatCurrency(request.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <KpiGrid kpis={[...primaryKpis, ...secondaryKpis]} />
          </section>

          <section>
            <AnalyticsRow
              expenseBreakdown={expenseBreakdown}
              topCostDrivers={topCostDrivers}
              trendData={trendData}
              insights={insights}
              totalCost={totalCost}
            />
          </section>

          <section className="cost-panel rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-pink-100 pb-3">
              <h2 className="text-lg font-bold text-on-surface">Recent audit log</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-secondary">Secure</span>
            </div>

            <div className="space-y-3">
              {auditEntries.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-secondary">No security actions have been recorded.</div>
              ) : (
                auditEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-on-surface">{entry.action}</span>
                      <span className="text-xs text-secondary">{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-secondary">{entry.user}</p>
                    <p className="mt-2 text-sm text-on-surface">{entry.details}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <DataTableRow costEntries={costEntries} insights={insights} />
          </section>
        </main>

        {isRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-pink-100 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-on-surface">Submit budget request</h3>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-secondary"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-secondary">Category</span>
                  <select
                    value={budgetRequest.category}
                    onChange={(event) => setBudgetRequest((previous) => ({ ...previous, category: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-on-surface outline-none focus:border-primary"
                  >
                    <option value="Fuel">Fuel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Toll">Toll</option>
                    <option value="Driver Allowance">Driver Allowance</option>
                    <option value="Parking">Parking</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-secondary">Requested amount</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetRequest.amount}
                    onChange={(event) => setBudgetRequest((previous) => ({ ...previous, amount: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-on-surface outline-none focus:border-primary"
                    placeholder="25000"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-secondary">Reason</span>
                  <textarea
                    value={budgetRequest.reason}
                    onChange={(event) => setBudgetRequest((previous) => ({ ...previous, reason: event.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-on-surface outline-none focus:border-primary"
                    placeholder="Explain the budget adjustment needed for the next operating cycle."
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-secondary">Password verification</span>
                  <input
                    type="password"
                    value={budgetRequest.password}
                    onChange={(event) => setBudgetRequest((previous) => ({ ...previous, password: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-on-surface outline-none focus:border-primary"
                    placeholder="Enter your account password"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitBudgetRequest}
                  disabled={isVerifying}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isVerifying ? "Verifying..." : "Submit request"}
                </button>
              </div>
            </div>
          </div>
        )}

        <GlobalFooter />
      </div>
    </MaskProvider>
  );
}
