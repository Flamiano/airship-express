"use client";

import { useState } from "react";
import ExpenseDonutChart from "./ExpenseDonutChart";
import TopCostDriversPieChart from "./TopCostDriversPieChart";
import TrendChart from "./TrendChart";

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
  const [showTotal, setShowTotal] = useState(false);
  const toggleTotal = () => setShowTotal((visible) => !visible);

  return (
    <div className="bg-white rounded-md p-5 border border-pink-100 shadow-sm col-span-1">
      <h3 className="font-title-md text-title-md text-on-surface mb-6 border-b border-pink-100 pb-2">
        Expense Breakdown
      </h3>
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48 mb-6">
          {expenseBreakdown.length > 0 ? (
            <ExpenseDonutChart
              breakdown={expenseBreakdown}
              onClick={toggleTotal}
              title={showTotal ? "Hide total cost" : "Show total cost"}
            />
          ) : (
            <button
              type="button"
              onClick={toggleTotal}
              title={showTotal ? "Hide total cost" : "Show total cost"}
              className="absolute inset-3 rounded-full border-[18px] border-slate-100 bg-white shadow-inner transition hover:border-pink-100"
              aria-label={showTotal ? "Hide total cost" : "Show total cost"}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-body-md text-secondary text-center leading-tight">
              Total
              <br />
              {showTotal ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(totalCost) : "Hidden"}
            </span>
          </div>
        </div>
        <ul className="w-full space-y-2">
          {expenseBreakdown.length > 0 ? expenseBreakdown.map((slice) => (
            <li
              key={slice.label}
              className="flex justify-between items-center text-body-md"
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${slice.dot}`} />
                <span className="font-bold text-on-surface">{`${slice.percent.toFixed(1)}%`}</span>{" "}
                <span className="text-secondary">{slice.label}</span>
              </div>
            </li>
          )) : (
            <li className="flex items-center justify-between border-t border-surface-variant pt-2 text-body-md text-secondary">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-200" />No expenses recorded</span>
              <span className="font-bold">0.0%</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TrendChartCard({ trendData }: { trendData: TrendData }) {
  return (
    <div className="bg-white rounded-md p-5 border border-pink-100 shadow-sm col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-6 border-b border-pink-100 pb-2">
        <h3 className="font-title-md text-title-md text-on-surface">
          Monthly Cost Trend
        </h3>
        <div className="flex gap-4 text-label-sm text-secondary">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-600 rounded-sm" /> Planned
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-orange-400 rounded-sm" /> Actual
          </div>
        </div>
      </div>
      <div className="w-full h-[300px]">
        {trendData.labels.length > 0 ? (
          <TrendChart trendData={trendData} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-slate-50/60 text-secondary">
            <span className="material-symbols-outlined text-3xl text-slate-300">show_chart</span>
            <span className="text-sm font-medium">No monthly cost data</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TopCostDriversCard({ topCostDrivers }: { topCostDrivers: CostDriver[] }) {
  return (
    <div className="bg-white rounded-md p-5 border border-pink-100 shadow-sm col-span-1">
      <h3 className="font-title-md text-title-md text-on-surface mb-6 border-b border-pink-100 pb-2">
        Top Cost Drivers
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,162px)] gap-5 items-center">
        <ul className="space-y-4">
          {topCostDrivers.length > 0 ? topCostDrivers.map((driver) => (
            <li
              key={driver.rank}
              className="flex justify-between items-center text-body-md border-b border-surface-variant pb-2"
            >
              <div className="flex gap-2 text-on-surface">
                <span className="font-bold w-4">{driver.rank}.</span>{" "}
                {driver.label}
              </div>
              <span className="font-bold text-on-surface">{driver.percent}</span>
            </li>
          )) : (
            <li className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-lg bg-slate-50/60 text-center text-secondary">
              <span className="material-symbols-outlined text-3xl text-slate-300">pie_chart</span>
              <span className="text-sm font-medium">No cost drivers yet</span>
              <span className="text-xs">Add an expense to see the breakdown.</span>
            </li>
          )}
        </ul>
        <div className="w-full h-[170px]">
          {topCostDrivers.length > 0 ? (
            <TopCostDriversPieChart drivers={topCostDrivers} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="h-32 w-32 rounded-full border-[18px] border-slate-100 bg-white shadow-inner" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsRow({
  expenseBreakdown,
  topCostDrivers,
  trendData,
  insights,
  totalCost,
}: AnalyticsRowProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-gutter">
      <ExpenseBreakdownCard expenseBreakdown={expenseBreakdown} totalCost={totalCost} />
      <TrendChartCard trendData={trendData} />
      <TopCostDriversCard topCostDrivers={topCostDrivers} />
    </div>
  );
}
