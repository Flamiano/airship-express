'use client';

import { useEffect, useState } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface RecentRun {
    id: number;
    period_start: string;
    period_end: string;
    pay_schedule: string | null;
    total_net_pay: number | null;
    payslip_count: number | null;
    approval_status: string;
}

const pesoShort = (n: number) => {
    const v = Number(n || 0);
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `₱${(v / 1_000).toFixed(1)}K`;
    return `₱${v.toFixed(2)}`;
};

const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
    });

function statusLabel(s: string) {
    switch (s) {
        case 'approved':
            return { text: 'Approved', cls: 'text-emerald-600' };
        case 'distributed':
            return { text: 'Disbursed', cls: 'text-emerald-600' };
        case 'pending_approval':
            return { text: 'Pending', cls: 'text-amber-600' };
        case 'rejected':
            return { text: 'Rejected', cls: 'text-rose-600' };
        default:
            return { text: 'Draft', cls: 'text-muted' };
    }
}

export function RecentPayrollRuns() {
    const [runs, setRuns] = useState<RecentRun[]>([]);
    const [loading, setLoading] = useState(true);

    const { fetchData: fetchRuns } = useApi(
        '/payroll-benefits-dashboard/api/payroll/runs'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchRuns().catch(() => []);
                if (cancelled) return;
                const list: RecentRun[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.runs)
                        ? data.runs
                        : Array.isArray(data?.rows)
                            ? data.rows
                            : [];
                const sorted = [...list].sort((a, b) =>
                    (b.period_end || '').localeCompare(a.period_end || '')
                );
                setRuns(sorted.slice(0, 4));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchRuns]);

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-line border-l-4 border-l-indigo-500 px-5 py-5 dark:border-paper/10">
            <Clock
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-indigo-500 opacity-[0.06]"
            />
            <p className="relative text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Recent payroll runs
            </p>

            {loading ? (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading runs…
                </div>
            ) : runs.length === 0 ? (
                <p className="relative mt-4 text-[12px] text-muted">No payroll runs yet.</p>
            ) : (
                <div className="relative mt-4 flex flex-col gap-3">
                    {runs.map((run) => {
                        const st = statusLabel(run.approval_status);
                        return (
                            <div key={run.id} className="flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-medium text-ink">
                                        {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
                                    </p>
                                    <p className="text-[11.5px] text-muted">
                                        PR-{String(run.id).padStart(4, '0')}
                                        {run.payslip_count != null ? ` · ${run.payslip_count} payslips` : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-medium text-ink">
                                        {pesoShort(run.total_net_pay ?? 0)}
                                    </p>
                                    <span className={`text-[11px] font-medium ${st.cls}`}>{st.text}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}