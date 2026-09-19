import React from "react";
import { FileSearch } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-border rounded-xl bg-card/30 ${className}`}>
      <div className="p-4 bg-muted/50 rounded-full text-muted-foreground mb-4 shadow-sm" aria-hidden="true">
        {icon || <FileSearch className="w-8 h-8" />}
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}