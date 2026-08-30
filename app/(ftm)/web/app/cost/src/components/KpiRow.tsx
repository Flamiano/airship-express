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
  const badgeClassByLabel: Record<string, string> = {
    "Total Fleet Cost": "bg-pink-50 text-pink-700",
    "Monthly Cost Change": "bg-pink-50 text-pink-700",
    "Fuel Cost": "bg-amber-50 text-amber-700",
    "Maintenance Cost": "bg-rose-50 text-rose-700",
    "Driver Allowance": "bg-violet-50 text-violet-700",
    "Mobile Data & Internet": "bg-sky-50 text-sky-700",
    "Avg Cost per Entry": "bg-emerald-50 text-emerald-700",
    "Unique Vehicles": "bg-pink-50 text-pink-700",
    "Fuel Share": "bg-amber-50 text-amber-700",
    "Maintenance Share": "bg-rose-50 text-rose-700",
    "Unique Trips": "bg-blue-50 text-blue-700",
    "Top Cost Category": "bg-fuchsia-50 text-fuchsia-700",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => toggleItem(kpi.label)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") toggleItem(kpi.label);
      }}
      className="flex min-h-[130px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 transition-colors hover:border-pink-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="material-symbols-outlined text-[19px] text-pink-600">
          {iconByLabel[kpi.label] ?? "analytics"}
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badgeClassByLabel[kpi.label] ?? "bg-slate-50 text-slate-600"}`}>
          {badgeByLabel[kpi.label] ?? "Metric"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-xl font-black tracking-tight ${kpi.valueColor ?? "text-slate-900"}`}>
          {visible ? kpi.value : "****"}
        </span>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}
