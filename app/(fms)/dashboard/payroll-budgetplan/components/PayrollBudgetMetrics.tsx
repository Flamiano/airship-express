import React from "react";
import { Bell, ShieldCheck, XCircle, Wallet } from "lucide-react";
import { SummaryCard } from "../../../fmscomponents/dashboard/SummaryCard";
import { formatPeso } from "../utils";

interface MetricsProps {
  metrics: {
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    totalPlannedValue: number;
  };
  fiscalYear: number;
}

export function PayrollBudgetMetrics({ metrics, fiscalYear }: MetricsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-start">
      <SummaryCard
        title="Pending Review"
        value={String(metrics.pendingCount)}
        subtitle="Awaiting Finance decision"
        trend={metrics.pendingCount > 0 ? "Needs Action" : "All Clear"}
        isPositive={metrics.pendingCount === 0}
        icon={<Bell className="w-5 h-5" />}
        className={metrics.pendingCount > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}
      />
      <SummaryCard
        title="Approved This Year"
        value={String(metrics.approvedCount)}
        subtitle={`Fiscal year ${fiscalYear}`}
        trend="Approved"
        isPositive={true}
        icon={<ShieldCheck className="w-5 h-5" />}
        className="border-emerald-500/20 hover:border-emerald-500/40"
      />
      <SummaryCard
        title="Rejected This Year"
        value={String(metrics.rejectedCount)}
        subtitle={`Fiscal year ${fiscalYear}`}
        trend={metrics.rejectedCount > 0 ? "Review Needed" : "None"}
        isPositive={metrics.rejectedCount === 0}
        icon={<XCircle className="w-5 h-5" />}
        className={metrics.rejectedCount > 0 ? "border-rose-500/30 bg-rose-500/5" : ""}
      />
      <SummaryCard
        title="Total Planned Value"
        value={formatPeso(metrics.totalPlannedValue)}
        subtitle="Approved and active budgets"
        trend="Authorized"
        isPositive={true}
        icon={<Wallet className="w-5 h-5" />}
        className="border-[#e5167e]/30 bg-gradient-to-br from-card via-card to-[#e5167e]/5"
      />
    </section>
  );
}