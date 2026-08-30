import React from 'react';

interface CardProps {
 children: React.ReactNode;
 className?: string;
}

/** Base white card with the standard pink border used across the dashboard. */
export function Card({ children, className = '' }: CardProps) {
 return (
 <div
 className={`bg-white rounded-2xl border border-pink-100 shadow-sm ${className}`}
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
 className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pink-100 pb-3 ${className}`}
 >
 <div>
 <h3 className="font-bold text-pink-950 text-sm flex items-center gap-2">{title}</h3>
 {subtitle && <p className="text-xs text-pink-500 mt-0.5">{subtitle}</p>}
 </div>
 {action && <div className="flex items-center gap-2">{action}</div>}
 </div>
 );
}
