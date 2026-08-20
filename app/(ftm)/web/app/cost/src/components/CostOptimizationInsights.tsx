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
  calendar_month: "📅",
  savings: "₱",
  construction: "🧰",
  warning: "⚠",
};

export default function CostOptimizationInsights({ insights }: { insights: Insight[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-DEFAULT p-6 border border-outline-variant shadow-soft col-span-1 flex flex-col gap-4">
      <h3 className="font-title-md text-title-md text-on-surface mb-2 border-b border-outline-variant pb-2">
        Cost Optimization Insights
      </h3>
      <div className="flex flex-col gap-3">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className={`bg-surface-container p-3 rounded-md shadow-sm flex items-center justify-between ${
              insight.borderLeft ? "border-l-4 border-primary" : ""
            }`}
          >
            <div className="flex items-center gap-2 text-secondary">
              <span
                className={`material-symbols-outlined icon-fill ${insight.iconColor}`}
              >
                {insightGlyphMap[insight.icon] ?? insight.icon}
              </span>
              <span className="text-body-md">{insight.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-primary">{insight.value}</span>
              {insight.valueSuffix && (
                <span className="text-label-sm text-primary/70">
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
