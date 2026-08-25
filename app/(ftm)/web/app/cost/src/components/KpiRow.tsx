"use client";

import type { Kpi } from "../lib/data";
import TrendIcon from "./TrendIcon";
import { useMask } from "../lib/MaskContext";

function KpiCard({ kpi }: { kpi: Kpi }) {
  const { toggleItem, isItemVisible } = useMask();

  const visible = isItemVisible(kpi.label);
  const iconByLabel: Record<string, string> = {
    "Total Fleet Cost": "account_balance",
    "Monthly Cost Change": "trending_up",
    "Fuel Cost": "local_gas_station",
    "Maintenance Cost": "build",
    "Driver Allowance": "payments",
    "Mobile Data & Internet": "wifi",
    "Avg Cost per Entry": "receipt_long",
    "Unique Vehicles": "directions_car",
    "Fuel Share": "local_gas_station",
    "Maintenance Share": "build",
    "Unique Trips": "route",
    "Top Cost Category": "category",
  };
  const badgeByLabel: Record<string, string> = {
    "Total Fleet Cost": "Cost",
    "Monthly Cost Change": "KPI",
    "Fuel Cost": "Fuel",
    "Maintenance Cost": "Cost",
    "Driver Allowance": "Driver",
    "Mobile Data & Internet": "Data",
    "Avg Cost per Entry": "Avg",
    "Unique Vehicles": "Fleet",
    "Fuel Share": "Fuel",
    "Maintenance Share": "Cost",
    "Unique Trips": "Trips",
    "Top Cost Category": "Top",
  };

  return (
    <div
      className="flex min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-pink-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="material-symbols-outlined text-[19px] text-pink-600">
          {iconByLabel[kpi.label] ?? "analytics"}
        </span>
        <span className="text-[9px] font-semibold text-slate-500">
          {badgeByLabel[kpi.label] ?? "Metric"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleItem(kpi.label)}
          title={visible ? "Hide value" : "Show value"}
          className={`text-lg font-bold tracking-tight ${kpi.valueColor ?? "text-slate-900"} cursor-pointer rounded-sm p-0.5 text-left hover:bg-pink-50`}
        >
          {visible ? kpi.value : "****"}
        </button>
        {kpi.trend && (
          <span className="inline-flex items-center text-[10px] font-bold text-slate-500">
            <TrendIcon trend={kpi.trend} colorOverride={kpi.valueColor} />
            {kpi.trendValue && <span>{kpi.trendValue}</span>}
          </span>
        )}
      </div>
      <span className="truncate text-[10px] font-medium text-slate-500">{kpi.label}</span>
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}
