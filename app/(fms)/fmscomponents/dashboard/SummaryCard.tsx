import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  isPositive?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  isPositive = true,
  icon,
  className = "",
  children,
}: SummaryCardProps) {
  return (
    <div
      className={`bg-card text-card-foreground rounded-2xl p-5 md:p-6 border border-border shadow-sm hover:border-[#e5167e]/40 transition-colors duration-200 flex flex-col justify-between group overflow-hidden ${className}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              {title}
            </h4>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground break-words min-w-0">
              {value}
            </div>
          </div>

          {icon && (
            <div className="p-2.5 bg-muted/50 text-muted-foreground rounded-xl shrink-0 group-hover:bg-[#e5167e]/10 group-hover:text-[#e5167e] transition-colors duration-300">
              {React.isValidElement(icon)
                ? React.cloneElement(
                    icon as React.ReactElement<{ className?: string }>,
                    {
                      className: "w-5 h-5",
                    }
                  )
                : icon}
            </div>
          )}
        </div>

        {(subtitle || trend) && (
          <div className="pt-3 border-t border-border/40 flex items-center gap-2 text-xs min-w-0">
            {trend && (
              <span
                className={`inline-flex items-center font-bold shrink-0 ${
                  isPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-1 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-1 shrink-0" />
                )}
                {trend}
              </span>
            )}
            {subtitle && (
              <span className="text-muted-foreground truncate min-w-0 flex-1">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {children && (
        <div className="mt-4 pt-3 border-t border-border/40">{children}</div>
      )}
    </div>
  );
}