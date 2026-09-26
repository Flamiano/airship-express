"use client";

import TopCostDriversPieChart from "./TopCostDriversPieChart";
import TrendChart from "./TrendChart";
import { useMask } from "../lib/MaskContext";

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

interface AnalyticsRowProps {
  expenseBreakdown: ExpenseSlice[];
  topCostDrivers: CostDriver[];
  trendData: TrendData;
  insights: Insight[];
  totalCost: number;
}

function ExpenseBreakdownCard({ expenseBreakdown, totalCost }: { expenseBreakdown: ExpenseSlice[]; totalCost: number }) {
  const { showValues, toggle } = useMask();
  const maxPercent = Math.max(...expenseBreakdown.map((slice) => slice.percent), 0, 1);

  return (
    <div className="cost-panel rounded-[24px] border border-[#f0e7eb] bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f3f4_100%)] p-4 shadow-[10px_10px_18px_rgba(15,23,42,0.04),-8px_-8px_14px_rgba(255,255,255,0.9)]">
      <div className="mb-4 flex items-center justify-between border-b border-[#eedfe7] pb-3">
        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-[#1f1f22]">Category Breakdown</h3>
        <button
          type="button"
          onClick={toggle}
          className="rounded-xl border border-[#ecd5e1] bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f7_100%)] px-2.5 py-1 text-[12px] font-semibold text-[#d93a8e] shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)] transition hover:translate-y-[-1px]"
          aria-label={showValues ? "Hide expense breakdown values" : "Show expense breakdown values"}
        >
          {showValues ? "Hide values" : "Show values"}
        </button>
      </div>

      <div className="mb-5 rounded-[18px] border border-[#f2d8e6] bg-[#fff1f8] px-3 py-2 text-sm text-[#d93a8e] shadow-[inset_1px_1px_0_rgba(255,255,255,0.9)]">
        <span className="font-semibold text-[#d93a8e]">Current spend:</span>{" "}
        {showValues ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(totalCost) : "Hidden"}
      </div>

      <div className="space-y-4">
        {expenseBreakdown.length > 0 ? expenseBreakdown.map((slice) => {
          const amount = (slice.percent / 100) * totalCost;
          return (
            <div key={slice.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${slice.dot}`} />
                  <span className="truncate text-[#4b5563]">{slice.label}</span>
                </div>
                <span className="font-semibold text-[#1f2937]">
                  {showValues ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount) : "—"}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max((slice.percent / maxPercent) * 100, 8)}%`, backgroundColor: slice.color }}
                />
              </div>
              <div className="text-right text-xs text-[#6b7280]">{slice.percent.toFixed(1)}%</div>
            </div>
          );
        }) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl bg-[#f4f4f5] text-center text-[#4b5563]">
            <span className="material-symbols-outlined text-4xl text-[#b4b9c3]">bar_chart</span>
            <span className="text-[15px] font-medium text-[#404854]">No category data yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChartCard({ trendData }: { trendData: TrendData }) {
  return (
    <div className="cost-panel rounded-[18px] border border-[#e7e1df] bg-[#f9f8f8] p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <div className="mb-4 flex items-center justify-between border-b border-[#e7e1df] pb-3">
        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-[#1c1c1c]">Monthly Cost Trend</h3>
        <div className="flex items-center gap-4 text-[12px] text-[#4b5563]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /> Planned
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ef489d]" /> Actual
          </div>
        </div>
      </div>
      <div className="h-[310px] w-full">
        {trendData.labels.length > 0 ? (
          <TrendChart trendData={trendData} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-[#f4f4f5] text-[#4b5563]">
            <span className="material-symbols-outlined text-4xl text-[#b4b9c3]">show_chart</span>
            <span className="text-[15px] font-medium text-[#404854]">No monthly cost data</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TopCostDriversCard({ topCostDrivers }: { topCostDrivers: CostDriver[] }) {
  return (
    <div className="cost-panel rounded-[24px] border border-[#f0e7eb] bg-[linear-gradient(180deg,#fcfcfd_0%,#f6f3f4_100%)] p-4 shadow-[10px_10px_18px_rgba(15,23,42,0.04),-8px_-8px_14px_rgba(255,255,255,0.9)]">
      <h3 className="mb-4 border-b border-[#eedfe7] pb-3 text-[18px] font-bold tracking-[-0.02em] text-[#1f1f22]">
        Top Cost Drivers
      </h3>

      <div className="flex min-h-[250px] items-center justify-center gap-4">
        {topCostDrivers.length > 0 ? (
          <>
            <ul className="w-full space-y-3 text-[15px] text-[#1f2937]">
              {topCostDrivers.map((driver) => (
                <li key={driver.rank} className="flex items-center justify-between border-b border-[#ece8e8] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1f2937]">{driver.rank}.</span>
                    <span>{driver.label}</span>
                  </div>
                  <span className="font-bold text-[#1f2937]">{driver.percent}</span>
                </li>
              ))}
            </ul>
            <div className="h-[160px] w-[160px] shrink-0">
              <TopCostDriversPieChart drivers={topCostDrivers} />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 text-center text-[#4b5563]">
              <div className="mb-3 text-3xl text-[#d2d7dd]">ⓘ</div>
              <div className="text-[15px] font-medium text-[#404854]">No cost drivers yet</div>
              <div className="mt-2 text-[13px] text-[#6b7280]">Add an expense to see the breakdown.</div>
            </div>
            <div className="flex h-[160px] w-[160px] items-center justify-center rounded-full border-[14px] border-[#ececec] bg-white shadow-inner">
              <div className="h-[90px] w-[90px] rounded-full border-[10px] border-[#f3f4f6] bg-[#fafafa]" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsRow(props: AnalyticsRowProps) {
  const { expenseBreakdown, topCostDrivers, trendData, totalCost } = props;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <ExpenseBreakdownCard expenseBreakdown={expenseBreakdown} totalCost={totalCost} />
      <TrendChartCard trendData={trendData} />
      <TopCostDriversCard topCostDrivers={topCostDrivers} />
    </div>
  );
}
