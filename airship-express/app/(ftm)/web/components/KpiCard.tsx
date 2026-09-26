import React from "react";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  trend?: string;
  trendDirection?: "up" | "down";
  trendGood?: boolean;
}

export default function KpiCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendDirection = "up",
  trendGood = true,
}: KpiCardProps) {
  return (
    <div className="bg-surface-container-lowest border border-surface-variant rounded-DEFAULT p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.04)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-label-md text-on-surface-variant">{label}</span>
        {icon && <span className="material-symbols-outlined text-secondary">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-headline-md text-on-background">{value}</span>
        {unit && <span className="text-body-md text-on-surface-variant">{unit}</span>}
      </div>
      {trend && (
        <div
          className={`text-label-md flex items-center gap-1 ${
            trendGood
              ? trendDirection === "up"
                ? "text-error"
                : "text-success"
              : trendDirection === "up"
              ? "text-success"
              : "text-error"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {trendDirection === "up" ? "trending_up" : "trending_down"}
          </span>
          {trend}
        </div>
      )}
    </div>
  );
}
