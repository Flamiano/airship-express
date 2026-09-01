"use client";

type Insight = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  valueSuffix?: string;
  borderLeft?: boolean;
};

const insightGlyphMap: Record<string, string> = {
  calendar_month: "category",
  savings: "savings",
  construction: "construction",
  warning: "warning",
};

export default function CostOptimizationInsights({ insights }: { insights: Insight[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pink-600">Financial overview</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Cost Optimization Insights
          </h3>
        </div>
        <span className="material-symbols-outlined rounded-lg bg-pink-50 p-2 text-xl text-pink-600">insights</span>
      </div>
      <div className="flex flex-col gap-2">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-pink-200 hover:bg-pink-50/30 ${
              insight.borderLeft ? "border-l-4 border-primary" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3 text-secondary">
              <span
                className={`material-symbols-outlined flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm ${insight.iconColor}`}
              >
                {insightGlyphMap[insight.icon] ?? insight.icon}
              </span>
              <span className="truncate text-sm font-medium text-slate-600">{insight.label}</span>
            </div>
            <div className="flex shrink-0 items-baseline gap-1">
              <span className={`text-base font-extrabold ${insight.valueColor || "text-pink-600"}`}>{insight.value}</span>
              {insight.valueSuffix && (
                <span className="text-xs font-medium text-slate-500">
                  {insight.valueSuffix}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
