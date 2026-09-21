'use client';

import React from 'react';

export const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    return v || fallback;
}

export const todayISO = () => new Date().toISOString().split('T')[0];

export const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
    'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300',
    'from-purple-100 to-violet-100 text-purple-700 dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300',
];

export const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

export const initialsOf = (name: string) =>
    (name || '??')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

export const findEmployeeById = (employees: any[], employeeId: string) =>
    employees.find((e) => e.employee_id === employeeId);

export const employeeHasBank = (employees: any[], employeeId: string) => {
    const emp = findEmployeeById(employees, employeeId);
    if (!emp) return false;
    return (
        emp.has_complete_bank === true ||
        (!!emp.bank_account_no && !!emp.bank_name)
    );
};

export const STATUS_STYLES: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40',
    implemented: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40',
    pending_review: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40',
    pending_approval: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40',
    rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40',
    draft: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700',
};

export type StatTint =
    | 'blue'
    | 'emerald'
    | 'amber'
    | 'purple'
    | 'pink'
    | 'rose'
    | 'slate';

const TINTS: Record<StatTint, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    emerald:
        'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    purple:
        'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    slate:
        'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
};

export function StatCard({
    icon: Icon,
    label,
    value,
    tint,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: StatTint;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TINTS[tint]}`}
            >
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">
                    {label}
                </p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">
                    {value}
                </p>
            </div>
        </div>
    );
}

export const Toggle = ({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: () => void;
    label?: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper dark:focus:ring-offset-ink ${checked ? 'bg-accent' : 'bg-ink/20 dark:bg-ink/30'
            }`}
    >
        <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0.5'
                }`}
        />
    </button>
);