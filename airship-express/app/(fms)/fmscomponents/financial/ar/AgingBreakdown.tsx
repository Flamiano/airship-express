import React from "react";
import { Layers } from "lucide-react";

export interface AgingBreakdownProps {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90Plus: number;
  totalOpenExposure: number;
}

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export function AgingBreakdown({
  current,
  d1_30,
  d31_60,
  d61_90,
  d90Plus,
  totalOpenExposure,
}: AgingBreakdownProps) {
  const grandTotal = totalOpenExposure > 0 ? totalOpenExposure : (current + d1_30 + d31_60 + d61_90 + d90Plus) || 1;

  const pctCurrent = Math.round((current / grandTotal) * 100);
  const pct1_30 = Math.round((d1_30 / grandTotal) * 100);
  const pct31_60 = Math.round((d31_60 / grandTotal) * 100);
  const pct61_90 = Math.round((d61_90 / grandTotal) * 100);
  const pct90Plus = Math.round((d90Plus / grandTotal) * 100);

  return (
    <section className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5 flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#e5167e]" />
            Aging Breakdown
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border/60 text-muted-foreground">
            Total Open: <strong className="text-foreground">{formatPeso(totalOpenExposure)}</strong>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Outstanding receivables exposure categorized by overdue timeline maturity
        </p>
      </div>

      <div className="space-y-4">
        {/* Multi-segment visual exposure bar */}
        <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
          <div
            style={{ width: `${pctCurrent}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Current: ${pctCurrent}%`}
          />
          <div
            style={{ width: `${pct1_30}%` }}
            className="bg-blue-500 h-full transition-all duration-500"
            title={`1–30 Days: ${pct1_30}%`}
          />
          <div
            style={{ width: `${pct31_60}%` }}
            className="bg-amber-500 h-full transition-all duration-500"
            title={`31–60 Days: ${pct31_60}%`}
          />
          <div
            style={{ width: `${pct61_90}%` }}
            className="bg-orange-500 h-full transition-all duration-500"
            title={`61–90 Days: ${pct61_90}%`}
          />
          <div
            style={{ width: `${pct90Plus}%` }}
            className="bg-rose-500 h-full transition-all duration-500"
            title={`90+ Days: ${pct90Plus}%`}
          />
        </div>

        {/* Bucket metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 text-xs">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              <span>Current</span>
              <span>{pctCurrent}%</span>
            </div>
            <p className="text-sm font-extrabold font-mono text-foreground truncate">
              {formatPeso(current)}
            </p>
            <p className="text-[9px] text-muted-foreground">Not past due</p>
          </div>

          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
              <span>1–30 Days</span>
              <span>{pct1_30}%</span>
            </div>
            <p className="text-sm font-extrabold font-mono text-foreground truncate">
              {formatPeso(d1_30)}
            </p>
            <p className="text-[9px] text-muted-foreground">1–30d overdue</p>
          </div>

          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
              <span>31–60 Days</span>
              <span>{pct31_60}%</span>
            </div>
            <p className="text-sm font-extrabold font-mono text-foreground truncate">
              {formatPeso(d31_60)}
            </p>
            <p className="text-[9px] text-muted-foreground">31–60d overdue</p>
          </div>

          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
              <span>61–90 Days</span>
              <span>{pct61_90}%</span>
            </div>
            <p className="text-sm font-extrabold font-mono text-foreground truncate">
              {formatPeso(d61_90)}
            </p>
            <p className="text-[9px] text-muted-foreground">61–90d overdue</p>
          </div>

          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
              <span>90+ Days</span>
              <span>{pct90Plus}%</span>
            </div>
            <p className="text-sm font-extrabold font-mono text-foreground truncate">
              {formatPeso(d90Plus)}
            </p>
            <p className="text-[9px] text-muted-foreground">Over 90d overdue</p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between gap-2">
        <span>
          {d90Plus > 0
            ? "High-risk exposure present in the 90+ days bucket."
            : "No critical aging exposure detected past 90 days."}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">
          Live Exposure
        </span>
      </div>
    </section>
  );
}