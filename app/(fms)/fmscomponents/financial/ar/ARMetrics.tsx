"use client";

import React from "react";
import { SummaryCard } from "@/app/(fms)/fmscomponents/dashboard/SummaryCard";
import { ReceiptText, CheckCircle2, PieChart, ChevronDown, ChevronUp } from "lucide-react";

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export interface ARMetricsProps {
  totalReceivables: number;
  totalPaid: number;
  collectionRate: number;
  totalInvoicesCount: number;
  paidInvoicesCount: number;
  partiallyPaidInvoicesCount: number;
  isRealizationExpanded: boolean;
  onToggleRealization: () => void;
}

export function ARMetrics({
  totalReceivables,
  totalPaid,
  collectionRate,
  totalInvoicesCount,
  paidInvoicesCount,
  partiallyPaidInvoicesCount,
  isRealizationExpanded,
  onToggleRealization,
}: ARMetricsProps) {
  const activePayersCount = paidInvoicesCount + partiallyPaidInvoicesCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
      {/* Metric 1: Total Billed Volume */}
      <SummaryCard
        title="Total Billed Volume"
        value={formatPeso(totalReceivables)}
        subtitle={`${totalInvoicesCount} total customer invoices issued`}
        trend="Gross Portfolio"
        isPositive={true}
        icon={<ReceiptText className="w-5 h-5 text-muted-foreground" />}
      />

      {/* Metric 2: Realized Collections (with Expandable Detail) */}
      <SummaryCard
        title="Realized Collections"
        value={formatPeso(totalPaid)}
        subtitle={`${paidInvoicesCount} invoices fully settled`}
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        className="border-emerald-500/20 hover:border-emerald-500/40"
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={onToggleRealization}
            className="w-full flex items-center justify-between text-xs font-bold text-foreground/80 hover:text-[#e5167e] transition-colors focus:outline-none group/toggle"
            aria-expanded={isRealizationExpanded}
          >
            <span className="flex items-center gap-1.5">
              <span>Collection Realization</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-extrabold">
                {collectionRate}%
              </span>
            </span>
            {isRealizationExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground group-hover/toggle:text-[#e5167e] transition-transform" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover/toggle:text-[#e5167e] transition-transform" />
            )}
          </button>

          {isRealizationExpanded && (
            <div className="pt-2.5 space-y-3 transition-all duration-200 border-t border-border/40 mt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground font-medium">Realization Pace</span>
                  <span className="text-emerald-500 font-mono font-bold">{collectionRate}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-muted/30 border border-border/40 space-y-0.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Collected</div>
                  <div className="font-mono font-bold text-foreground truncate">{formatPeso(totalPaid)}</div>
                </div>
                <div className="p-2 rounded-xl bg-muted/30 border border-border/40 space-y-0.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Billed</div>
                  <div className="font-mono font-bold text-foreground truncate">{formatPeso(totalReceivables)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SummaryCard>

      {/* Metric 3: Realization Rate */}
      <SummaryCard
        title="Realization Rate"
        value={`${collectionRate}%`}
        subtitle="Portfolio settlement ratio"
        trend={`${activePayersCount} Active Payers`}
        isPositive={collectionRate >= 70}
        icon={<PieChart className="w-5 h-5 text-[#e5167e]" />}
      >
        <div className="space-y-1.5">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[#e5167e] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            <span>Settlement Progress</span>
            <span>{formatPeso(totalPaid)} of {formatPeso(totalReceivables)}</span>
          </div>
        </div>
      </SummaryCard>
    </div>
  );
}