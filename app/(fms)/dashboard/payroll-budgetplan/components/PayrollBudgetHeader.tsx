import React from "react";
import Link from "next/link";
import { ClipboardList, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export function PayrollBudgetHeader({ loading, onRefresh }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/90 to-background border border-border p-6 md:p-8 shadow-sm">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
            <ClipboardList className="w-4 h-4" />
            Financial Management / Finance Review
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-1">
            Payroll Budget Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Review monthly labor budget submissions from Payroll & Benefits and approve or reject each before it can be activated.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/budget-management"
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            Back to Budget
          </Link>
          <button
            type="button"
            title="Refresh payroll budget submissions"
            onClick={onRefresh}
            className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}