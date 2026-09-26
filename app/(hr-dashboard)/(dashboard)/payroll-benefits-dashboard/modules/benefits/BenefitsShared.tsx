'use client';

import React from 'react';

export function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

export const formatCurrency = (amount: number | null | undefined) =>
    `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export const formatPercent = (rate: number | null | undefined, digits = 2) =>
    `${(Number(rate || 0) * 100).toFixed(digits)}%`;

export type StatTint = 'blue' | 'amber' | 'emerald' | 'purple' | 'red' | 'gray' | 'pink';

export const TINT_CLASSES: Record<StatTint, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    gray: 'bg-ink/5 text-muted dark:bg-ink/10',
    pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400',
};

interface StatCardProps {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    value: string;
    tint: StatTint;
    hint?: string;
}

export function StatCard({ icon: Icon, label, value, tint, hint }: StatCardProps) {
    return (
        <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/30">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted font-rethink">{label}</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${TINT_CLASSES[tint]}`}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <p className="mt-1.5 text-xl font-mono font-semibold text-ink">{value}</p>
            {hint && <p className="mt-0.5 text-[10px] text-muted font-rethink">{hint}</p>}
        </div>
    );
}

export const chartAxisColor = () => cssVar('--muted', '#6b6b76');
export const chartGridColor = () => cssVar('--line', '#eaeaea');
export const chartInkColor = () => cssVar('--ink', '#1c1b1f');