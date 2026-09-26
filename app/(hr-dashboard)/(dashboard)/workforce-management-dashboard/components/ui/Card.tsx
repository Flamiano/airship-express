import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/** Standardized card matching the payroll & benefits paper/line theme. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-paper rounded-2xl border border-line shadow-sm transition-all duration-300 text-ink ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3 ${className}`}
    >
      <div>
        <h3 className="font-bold text-ink text-sm flex items-center gap-2">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
