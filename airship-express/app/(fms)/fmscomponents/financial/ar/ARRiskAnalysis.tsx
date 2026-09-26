"use client";

import React from "react";
import { ShieldAlert, PieChart } from "lucide-react";
import { AgingBreakdown } from "@/app/(fms)/fmscomponents/financial/ar/AgingBreakdown";

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export interface ARRiskAnalysisProps {
  agingBreakdown: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90Plus: number;
  };
  outstandingBalance: number;
  portfolioStatusDistribution: {
    paid: { count: number; amount: number; pct: number };
    partiallyPaid: { count: number; amount: number; pct: number };
    unpaid: { count: number; amount: number; pct: number };
    overdue: { count: number; amount: number; pct: number };
  };
  totalInvoicesCount: number;
  overdueCount: number;
}

export function ARRiskAnalysis({
  agingBreakdown,
  outstandingBalance,
  portfolioStatusDistribution,
  totalInvoicesCount,
  overdueCount,
}: ARRiskAnalysisProps) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#e5167e]" />
            Receivables Aging & Portfolio Breakdown
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor aging schedules for open exposure and distribution across payment statuses.
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          Total Invoices: <strong className="text-foreground">{totalInvoicesCount}</strong>
        </div>
      </div>

      {/* Grid: Aging Breakdown + Portfolio Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Column 1: Aging Schedule */}
        <AgingBreakdown {...agingBreakdown} totalOpenExposure={outstandingBalance} />

        {/* Column 2: Payment Status Distribution */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5 flex flex-col justify-between hover:border-[#e5167e]/30 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#e5167e]" />
                Payment Status Distribution
              </h3>
              <span className="text-xs font-bold text-muted-foreground font-mono">
                {totalInvoicesCount} Invoices
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Proportional distribution of billed invoices by current payment state
            </p>
          </div>

          <div className="space-y-4">
            {/* Multi-segment status bar */}
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                style={{ width: `${portfolioStatusDistribution.paid.pct}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Paid: ${portfolioStatusDistribution.paid.pct}%`}
              />
              <div
                style={{ width: `${portfolioStatusDistribution.partiallyPaid.pct}%` }}
                className="bg-amber-500 h-full transition-all duration-500"
                title={`Partially Paid: ${portfolioStatusDistribution.partiallyPaid.pct}%`}
              />
              <div
                style={{ width: `${portfolioStatusDistribution.unpaid.pct}%` }}
                className="bg-blue-500 h-full transition-all duration-500"
                title={`Current Unpaid: ${portfolioStatusDistribution.unpaid.pct}%`}
              />
              <div
                style={{ width: `${portfolioStatusDistribution.overdue.pct}%` }}
                className="bg-rose-500 h-full transition-all duration-500"
                title={`Overdue: ${portfolioStatusDistribution.overdue.pct}%`}
              />
            </div>

            {/* Status Breakdown Items */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between text-emerald-500 font-bold">
                  <span>Paid ({portfolioStatusDistribution.paid.count})</span>
                  <span>{portfolioStatusDistribution.paid.pct}%</span>
                </div>
                <div className="font-extrabold text-foreground font-mono">
                  {formatPeso(portfolioStatusDistribution.paid.amount)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between text-amber-500 font-bold">
                  <span>Partially Paid ({portfolioStatusDistribution.partiallyPaid.count})</span>
                  <span>{portfolioStatusDistribution.partiallyPaid.pct}%</span>
                </div>
                <div className="font-extrabold text-foreground font-mono">
                  {formatPeso(portfolioStatusDistribution.partiallyPaid.amount)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <div className="flex items-center justify-between text-blue-500 font-bold">
                  <span>Current Unpaid ({portfolioStatusDistribution.unpaid.count})</span>
                  <span>{portfolioStatusDistribution.unpaid.pct}%</span>
                </div>
                <div className="font-extrabold text-foreground font-mono">
                  {formatPeso(portfolioStatusDistribution.unpaid.amount)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                <div className="flex items-center justify-between text-rose-500 font-bold">
                  <span>Overdue ({portfolioStatusDistribution.overdue.count})</span>
                  <span>{portfolioStatusDistribution.overdue.pct}%</span>
                </div>
                <div className="font-extrabold text-foreground font-mono">
                  {formatPeso(portfolioStatusDistribution.overdue.amount)}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#e5167e] shrink-0" />
            <span>
              {overdueCount === 0
                ? "Collection realization rate is on target with zero past-due exposure."
                : `${overdueCount} past due ${
                    overdueCount === 1 ? "invoice requires" : "invoices require"
                  } follow-up.`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}