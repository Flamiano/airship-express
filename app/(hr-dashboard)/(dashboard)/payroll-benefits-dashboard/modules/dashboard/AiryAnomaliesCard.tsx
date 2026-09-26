'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { flagAnomalies } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/flagAnomalies';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface AIInsight {
    severity?: 'low' | 'medium' | 'high' | 'info' | 'warning' | 'critical';
    title?: string;
    message?: string;
    employeeId?: string;
}

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

const TIMEOUT_MS = 25000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Timeout')), ms);
        p.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            }
        );
    });
}

function severityStyle(s: string | undefined) {
    const v = (s ?? 'low').toLowerCase();
    if (v === 'high' || v === 'critical')
        return { cls: 'bg-rose-50 text-rose-600', Icon: AlertOctagon };
    if (v === 'medium' || v === 'warning')
        return { cls: 'bg-amber-50 text-amber-600', Icon: AlertTriangle };
    return { cls: 'bg-blue-50 text-blue-600', Icon: Info };
}

export function AiryAnomaliesCard() {
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const { fetchData: fetchRuns } = useApi(
        '/payroll-benefits-dashboard/api/payroll/runs'
    );

    const load = useCallback(async () => {
        setStatus('loading');
        setErrorMsg(null);
        try {
            const runsRaw = await fetchRuns().catch(() => []);
            const runs: any[] = Array.isArray(runsRaw) ? runsRaw : [];

            const completed = runs
                .filter(
                    (r: any) =>
                        (r.status === 'completed' || r.approval_status === 'approved' || r.approval_status === 'distributed')
                )
                .sort((a: any, b: any) =>
                    String(b.period_end ?? '').localeCompare(String(a.period_end ?? ''))
                );

            const latest = completed[0];
            if (!latest) {
                setStatus('empty');
                setInsights([]);
                return;
            }

            const slipsRaw = await fetch(
                `/payroll-benefits-dashboard/api/payroll/runs/${latest.id}`,
                { credentials: 'include' }
            )
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null);

            const slips: any[] = Array.isArray((slipsRaw as any)?.payslips)
                ? (slipsRaw as any).payslips
                : Array.isArray(slipsRaw)
                    ? slipsRaw
                    : [];

            if (slips.length === 0) {
                setStatus('empty');
                setInsights([]);
                return;
            }

            const records = slips.map((s: any) => ({
                id: s.id,
                employee_name: s.employee_name ?? s.employee?.employee_name ?? 'Unknown',
                net_pay: Number(s.net_pay ?? 0),
                days_worked: Number(s.days_worked ?? 0),
                overtime_hours: Number(s.overtime_hours ?? 0),
            }));

            const result = await withTimeout(flagAnomalies(records), TIMEOUT_MS);
            const list: AIInsight[] = Array.isArray(result) ? result : [];

            if (list.length === 0) {
                setStatus('empty');
                setInsights([]);
            } else {
                setStatus('ok');
                setInsights(list.slice(0, 5));
            }
        } catch (err: any) {
            console.error('[AiryAnomaliesCard] load failed:', err);
            setStatus('error');
            setErrorMsg(
                err?.message === 'Timeout'
                    ? 'Anomaly scan took too long. Try again in a moment.'
                    : err?.message ?? 'Could not scan for anomalies.'
            );
        }
    }, [fetchRuns]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-amber-500 bg-paper px-5 py-5 dark:border-paper/10">
            <ShieldCheck
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-amber-500 opacity-[0.06]"
            />
            <div className="relative flex items-center gap-2">
                <ShieldCheck size={13} className="text-amber-500" />
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Airy anomaly scan
                </p>
                <button
                    type="button"
                    onClick={load}
                    disabled={status === 'loading'}
                    title="Rescan"
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {status === 'loading' && (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Scanning latest payroll run for outliers…
                </div>
            )}

            {status === 'empty' && (
                <div className="relative mt-4 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[12.5px] font-medium text-emerald-700 dark:text-emerald-400">
                            No anomalies detected
                        </p>
                        <p className="text-[11px] text-muted leading-relaxed">
                            Net pay, overtime, and deductions are all within expected ranges for the latest run.
                        </p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="relative mt-4 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[12px] text-amber-700 dark:text-amber-400">{errorMsg}</p>
                        <button
                            type="button"
                            onClick={load}
                            className="mt-1.5 text-[11px] font-medium text-amber-600 hover:underline"
                        >
                            Try again →
                        </button>
                    </div>
                </div>
            )}

            {status === 'ok' && insights.length > 0 && (
                <div className="relative mt-4 flex flex-col gap-2.5">
                    {insights.map((ins, i) => {
                        const { cls, Icon } = severityStyle(ins.severity);
                        return (
                            <div key={i} className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cls}`}>
                                    <Icon size={11} strokeWidth={2.25} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-medium text-ink truncate">
                                        {ins.title ?? 'Anomaly detected'}
                                    </p>
                                    <p className="text-[11px] text-muted leading-relaxed">
                                        {ins.message ?? ''}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default AiryAnomaliesCard;