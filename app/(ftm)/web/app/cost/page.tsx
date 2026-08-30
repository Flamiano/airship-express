import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import { KpiGrid } from "./src/components/KpiRow";
import AnalyticsRow from "./src/components/AnalyticsRow";
import DataTableRow from "./src/components/DataTableRow";
import { getCostEntries } from "../lib/api";
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
    .filter((entry) => entry.category === "Fuel")
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
  const currentFuelCost = currentMonthEntries.filter((entry) => entry.category === "Fuel").reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  const previousFuelCost = previousMonthEntries.filter((entry) => entry.category === "Fuel").reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
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
    .filter((entry) => entry.category === "Fuel")
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

export default async function Home() {
  let costEntries: CostEntry[] = [];

  try {
    costEntries = await getCostEntries();
  } catch (error) {
    console.error("Failed to load cost entries:", error);
  }

  const totalCost = costEntries.reduce(
    (sum, entry) => sum + (entry.amount ?? 0),
    0
  );
  const expenseBreakdown = buildCategoryTotals(costEntries);
  const topCostDrivers = buildTopDrivers(costEntries);
  const trendData = buildTrendData(costEntries);
  const { primary: primaryKpis, secondary: secondaryKpis } = buildKpis(
    costEntries,
    trendData
  );
  const insights = buildInsights(costEntries, totalCost);

  return (
    <MaskProvider>
      <div className="min-h-screen flex flex-col bg-background text-on-background">
        <GlobalNavbar />

        {/* Main Container - Full Width Utilization */}
        <main className="flex-1 w-full max-w-none mx-0 px-3 sm:px-4 lg:px-6 py-6 flex flex-col gap-6">
          
          {/* Dashboard Header Banner */}
          <div className="bg-white p-6 sm:p-8 rounded-xl border border-pink-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Financial Intelligence
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-on-background tracking-tight">
                Fleet Cost & Expense Analytics
              </h1>
              <p className="text-secondary text-sm mt-1">
                Comprehensive telemetry, expenditure breakdown, and cost drivers overview.
              </p>
            </div>

          </div>

        {/* Primary & Secondary KPIs */}
        <section className="space-y-4">
          <KpiGrid kpis={[...primaryKpis, ...secondaryKpis]} />
        </section>

        {/* Interactive Analytics Section */}
        <section>
          <AnalyticsRow
            expenseBreakdown={expenseBreakdown}
            topCostDrivers={topCostDrivers}
            trendData={trendData}
            insights={insights}
            totalCost={totalCost}
          />
        </section>

        {/* Receipt Gallery Section */}
        {(() => {
          const receiptEntries = costEntries.filter((entry) => !!entry.receipt_image);

          if (receiptEntries.length === 0) {
            return null;
          }

          return (
            <section className="bg-white p-6 rounded-xl border border-pink-100 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Receipts</p>
                  <h2 className="text-xl font-extrabold text-on-background">Driver expense gallery</h2>
                </div>
                <span className="rounded-full bg-primary-container/20 text-primary text-xs font-semibold px-3 py-1.5 border border-primary/30">
                  {receiptEntries.length} uploads
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {receiptEntries.slice(0, 9).map((entry) => (
                  <div key={entry.id} className="group overflow-hidden rounded-lg border border-pink-100 bg-white transition-all hover:shadow-sm">
                    <div className="relative aspect-[4/3] overflow-hidden bg-pink-50">
                      <img
                        src={entry.receipt_image ?? undefined}
                        alt={`${entry.category} receipt`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center rounded-full bg-primary-container text-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                          {entry.category}
                        </span>
                        <span className="text-sm font-bold text-on-surface">
                          {entry.amount != null ? formatCurrency(entry.amount) : "—"}
                        </span>
                      </div>

                      <p className="text-xs text-secondary mb-1">
                        {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}
                      </p>

                      {entry.remarks ? (
                        <p className="text-sm text-secondary line-clamp-2">{entry.remarks}</p>
                      ) : (
                        <p className="text-sm text-secondary/70">No note attached</p>
                      )}

                      <a
                        href={entry.receipt_image ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container"
                      >
                        View original
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Insights and records */}
        <section>
          <DataTableRow costEntries={costEntries} insights={insights} />
        </section>
      </main>

      <GlobalFooter />
    </div>
  </MaskProvider>
  );
}
