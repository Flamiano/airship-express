'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Wallet, XCircle } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface MonthlyRow {
    month: number;
    planned_amount: number;
    actual_amount?: number;
    status: string;
}

const pesoShort = (n: number) => {
    const v = Number(n || 0);
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}K`;
    return `₱${v.toFixed(2)}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function statusChip(status: string) {
    switch (status) {
        case 'approved':
        case 'active':
            return { text: 'Approved', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 };
        case 'pending_approval':
            return { text: 'Pending approval', cls: 'bg-amber-50 text-amber-700', Icon: Clock };
        case 'rejected':
            return { text: 'Rejected', cls: 'bg-rose-50 text-rose-700', Icon: XCircle };
        case 'closed':
            return { text: 'Closed', cls: 'bg-ink/5 text-muted', Icon: CheckCircle2 };
        default:
            return { text: 'Draft', cls: 'bg-ink/5 text-muted', Icon: Clock };
    }
}

export function BudgetStatusCard() {
    const [rows, setRows] = useState<MonthlyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const year = new Date().getFullYear();

    const { fetchData: fetchBudget } = useApi(
        `/payroll-benefits-dashboard/api/compensation/labor-budget?fiscal_year=${year}`
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const resp = (await fetchBudget().catch(() => null)) as any;
                if (cancelled) return;
                const list: MonthlyRow[] = resp?.rows ?? (Array.isArray(resp) ? resp : []);
                setRows(list);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchBudget]);

    const totalPlanned = rows.reduce((s, r) => s + Number(r.planned_amount || 0), 0);
    const totalActual = rows.reduce((s, r) => s + Number(r.actual_amount || 0), 0);
    const statuses = rows.map((r) => r.status);
    const overall =
        statuses.length === 0
            ? 'draft'
            : statuses.includes('rejected')
                ? 'rejected'
                : statuses.includes('pending_approval')
                    ? 'pending_approval'
                    : statuses.every((s) => s === 'approved' || s === 'active')
                        ? 'approved'
                        : 'draft';

    const chip = statusChip(overall);
    const ChipIcon = chip.Icon;
    const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-line border-l-4 border-l-indigo-500 px-5 py-5 dark:border-paper/10">
            <Wallet
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-indigo-500 opacity-[0.06]"
            />
            <div className="relative flex items-center justify-between">
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Labor budget · {year}
                </p>
                {!loading && rows.length > 0 && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${chip.cls}`}>
                        <ChipIcon size={11} />
                        {chip.text}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading budget…
                </div>
            ) : rows.length === 0 ? (
                <p className="relative mt-4 text-[12px] text-muted">No budget set for {year}.</p>
            ) : (
                <>
                    <div className="relative mt-4 flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30">
                            <Wallet size={16} strokeWidth={1.75} />
                        </span>
                        <div>
                            <p className="text-[18px] font-bricolage font-semibold tracking-tight text-ink">
                                {pesoShort(totalPlanned)}
                            </p>
                            <p className="text-[11.5px] text-muted">
                                {pesoShort(totalActual)} used · {pct}%
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-4 grid grid-cols-12 gap-[3px]">
                        {MONTHS.map((_, i) => {
                            const row = rows.find((m) => m.month === i + 1);
                            const planned = Number(row?.planned_amount || 0);
                            const filled =
                                planned > 0
                                    ? 'bg-indigo-500'
                                    : row
                                        ? 'bg-indigo-200 dark:bg-indigo-900/50'
                                        : 'bg-ink/5 dark:bg-paper/5';
                            return (
                                <span
                                    key={i}
                                    title={row ? `${MONTHS[i]}: ${pesoShort(planned)}` : MONTHS[i]}
                                    className={`h-1.5 rounded-full ${filled}`}
                                />
                            );
                        })}
                    </div>
                    <div className="relative mt-1.5 flex justify-between text-[9.5px] text-muted">
                        <span>Jan</span>
                        <span>Jun</span>
                        <span>Dec</span>
                    </div>

                    {overall === 'pending_approval' && (
                        <p className="relative mt-3 text-[11px] text-amber-700">Waiting for admin approval</p>
                    )}
                    {overall === 'rejected' && (
                        <p className="relative mt-3 text-[11px] text-rose-700">
                            Rejected — check budget module for details
                        </p>
                    )}
                </>
            )}
        </div>
    );
}