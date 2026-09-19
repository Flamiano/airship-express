"use client";

import React from "react";
import {
  ReceiptText,
  Clock,
  RefreshCw,
  Download,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Layers,
} from "lucide-react";

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export interface AROverviewHeroProps {
  outstandingBalance: number;
  totalReceivables: number;
  totalPaid: number;
  overdueTotal: number;
  unpaidAmount: number;
  collectionRate: number;
  pendingCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  overdueCount: number;
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
  onExportCSV: () => void;
  onCreateInvoice: () => void;
}

export function AROverviewHero({
  outstandingBalance,
  totalReceivables,
  totalPaid,
  overdueTotal,
  unpaidAmount,
  collectionRate,
  pendingCount,
  unpaidCount,
  partiallyPaidCount,
  overdueCount,
  totalCount,
  loading,
  onRefresh,
  onExportCSV,
  onCreateInvoice,
}: AROverviewHeroProps) {
  const overdueRatio =
    totalReceivables > 0 ? Math.round((overdueTotal / totalReceivables) * 100) : 0;
  const outstandingRatio = Math.max(0, 100 - collectionRate);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/90 to-background border border-border p-6 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <ReceiptText className="w-4 h-4" />
              Accounts Receivable
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mt-1">
              Receivables <span className="text-[#e5167e]">Overview</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
              Track customer billing statements, open exposure, aging schedules, and collection realization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onRefresh}
              title="Refresh Receivables"
              className="p-2 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e5167e]/40"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"
                }`}
              />
            </button>

            <button
              onClick={onExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm group focus:outline-none focus:ring-2 focus:ring-[#e5167e]/40"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              Export CSV
            </button>

            <button
              onClick={onCreateInvoice}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#e5167e] rounded-xl hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#e5167e]/40"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Hero Focal Area & Lifecycle Flow */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 space-y-6 relative overflow-hidden group hover:border-[#e5167e]/30 transition-colors">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#e5167e]/5 rounded-bl-full pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main Anchor Metric: Total Outstanding Exposure */}
          <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-border/60 pb-6 lg:pb-0 lg:pr-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#e5167e] bg-[#e5167e]/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Active Open Exposure
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {pendingCount} Active Accounts
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Outstanding Exposure
              </h2>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground break-words font-mono">
                {formatPeso(outstandingBalance)}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Uncollected balance across customer invoices ({unpaidCount} unpaid, {partiallyPaidCount} partially settled).
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-0.5">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">
                  Current Unpaid
                </div>
                <div className="text-sm font-extrabold font-mono text-foreground truncate">
                  {formatPeso(unpaidAmount)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-0.5">
                <div className="text-[10px] font-bold text-rose-500 uppercase flex items-center justify-between">
                  <span>Overdue</span>
                  <span className="text-[9px] font-mono">{overdueCount} accounts</span>
                </div>
                <div className="text-sm font-extrabold font-mono text-foreground truncate">
                  {formatPeso(overdueTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* AR Receivables Lifecycle Flow */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#e5167e]" />
                Receivables Lifecycle Flow
              </h3>
              <span className="text-xs font-mono font-bold text-[#e5167e]">
                {collectionRate}% Realized
              </span>
            </div>

            {/* Segmented Flow Bar */}
            <div className="space-y-3">
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex p-0.5">
                <div
                  style={{ width: `${collectionRate}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                  title={`Collected: ${collectionRate}%`}
                />
                <div
                  style={{
                    width: `${Math.max(0, outstandingRatio - overdueRatio)}%`,
                  }}
                  className="bg-blue-500 h-full transition-all duration-500"
                  title={`Open Unpaid: ${Math.max(
                    0,
                    outstandingRatio - overdueRatio
                  )}%`}
                />
                <div
                  style={{ width: `${overdueRatio}%` }}
                  className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
                  title={`Overdue: ${overdueRatio}%`}
                />
              </div>

              {/* Lifecycle Stage Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* Stage 1: Billed */}
                <div className="p-3 rounded-xl bg-card border border-border space-y-1 relative overflow-hidden">
                  <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>1. Billed</span>
                    <span className="text-foreground/40 font-mono">100%</span>
                  </div>
                  <div className="font-extrabold font-mono text-foreground truncate text-xs">
                    {formatPeso(totalReceivables)}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {totalCount} total invoices
                  </div>
                </div>

                {/* Stage 2: Realized */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 relative overflow-hidden">
                  <div className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider flex items-center justify-between">
                    <span>2. Realized</span>
                    <span className="font-mono">{collectionRate}%</span>
                  </div>
                  <div className="font-extrabold font-mono text-foreground truncate text-xs">
                    {formatPeso(totalPaid)}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1 font-medium">
                    <TrendingUp className="w-3 h-3 shrink-0" /> Settled
                  </div>
                </div>

                {/* Stage 3: Open */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1 relative overflow-hidden">
                  <div className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider flex items-center justify-between">
                    <span>3. Open</span>
                    <span className="font-mono">{outstandingRatio}%</span>
                  </div>
                  <div className="font-extrabold font-mono text-foreground truncate text-xs">
                    {formatPeso(outstandingBalance)}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate flex items-center gap-1 font-medium">
                    <ArrowRight className="w-3 h-3 shrink-0" /> Outstanding
                  </div>
                </div>

                {/* Stage 4: Overdue */}
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1 relative overflow-hidden">
                  <div className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider flex items-center justify-between">
                    <span>4. Overdue</span>
                    <span className="font-mono">{overdueRatio}%</span>
                  </div>
                  <div className="font-extrabold font-mono text-foreground truncate text-xs">
                    {formatPeso(overdueTotal)}
                  </div>
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Action Required
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}