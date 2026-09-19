import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toLowerCase().trim();
  let colorStyles = "bg-muted/50 text-muted-foreground border-border/50";

  if (["paid", "completed", "approved"].includes(normalized)) {
    colorStyles = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else if (["pending", "proposed", "partially paid"].includes(normalized)) {
    colorStyles = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  } else if (["unpaid", "overdue", "cancelled"].includes(normalized)) {
    colorStyles = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
  } else if (["recorded"].includes(normalized)) {
    colorStyles = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${colorStyles} ${className}`}>
      {status}
    </span>
  );
}