import React from "react";
import { Bell, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { BudgetStatus } from "../types";

export function PayrollStatusBadge({ status }: { status: BudgetStatus }) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap";

  if (status === null) return <span className={`${base} bg-muted/50 text-muted-foreground border-border/50`}>No Plan</span>;
  if (status === "pending_approval") return <span className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20`}><Bell className="w-3 h-3" />Pending Approval</span>;
  if (status === "approved") return <span className={`${base} bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20`}><ShieldCheck className="w-3 h-3" />Approved</span>;
  if (status === "active") return <span className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20`}><CheckCircle2 className="w-3 h-3" />Active</span>;
  if (status === "rejected") return <span className={`${base} bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20`}><XCircle className="w-3 h-3" />Rejected</span>;
  if (status === "closed") return <span className={`${base} bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20`}><CheckCircle2 className="w-3 h-3" />Closed</span>;

  return <span className={`${base} bg-muted/50 text-muted-foreground border-border/50`}>Draft</span>;
}