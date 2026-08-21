"use client";

import type { Kpi } from "../lib/data";
import TrendIcon from "./TrendIcon";
import { useMask } from "../lib/MaskContext";

function KpiCard({ kpi }: { kpi: Kpi }) {
  const { showValues, toggleItem, isItemVisible } = useMask();

  const isPercent = kpi.value.includes("%");
  const visible = isPercent || isItemVisible(kpi.label);

  return (
    <div
      className={`bg-surface-container-lowest rounded-DEFAULT p-4 border border-outline-variant flex flex-col justify-between shadow-soft border-b-4 ${kpi.accent}`}
    >
      <span className="text-label-sm text-secondary font-label-sm uppercase tracking-wider">
        {kpi.label}
      </span>
      <div className="flex items-center gap-1 mt-2">
        {isPercent ? (
          <span
            className={`text-title-md font-title-md font-bold ${kpi.valueColor ?? "text-on-surface"}`}
          >
            {kpi.value}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => toggleItem(kpi.label)}
            title={isItemVisible(kpi.label) ? "Hide value" : "Show value"}
            className={`text-title-md font-title-md font-bold ${kpi.valueColor ?? "text-on-surface"} rounded-sm p-0.5 hover:bg-surface-container-low cursor-pointer text-left`}
          >
            {visible ? kpi.value : "*******"}
          </button>
        )}
        {kpi.trend && (
          <TrendIcon trend={kpi.trend} colorOverride={kpi.valueColor} />
        )}
      </div>
    </div>
  );
}

export function PrimaryKpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}

export function SecondaryKpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}
