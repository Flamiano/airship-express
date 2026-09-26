'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { explainPayslip } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/explainPayslip';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

const TIMEOUT_MS = 30000;

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

export function AiryPayslipExplainerCard() {
    const [explanation, setExplanation] = useState<string | null>(null);
    const [sampleName, setSampleName] = useState<string | null>(null);
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
                        r.status === 'completed' ||
                        r.approval_status === 'approved' ||
                        r.approval_status === 'distributed'
                )
                .sort((a: any, b: any) =>
                    String(b.period_end ?? '').localeCompare(String(a.period_end ?? ''))
                );
            const latest = completed[0];
            if (!latest) {
                setStatus('empty');
                return;
            }

            const detail = await fetch(
                `/payroll-benefits-dashboard/api/payroll/runs/${latest.id}`,
                { credentials: 'include' }
            )
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null);

            const slips: any[] = Array.isArray((detail as any)?.payslips)
                ? (detail as any).payslips
                : Array.isArray(detail)
                    ? detail
                    : [];

            if (slips.length === 0) {
                setStatus('empty');
                return;
            }

            const sample = [...slips].sort(
                (a, b) => Number(b.net_pay ?? 0) - Number(a.net_pay ?? 0)
            )[0];

            const context: any = {
                periodLabel: `${latest.period_start} to ${latest.period_end}`,
                employeeName: sample.employee_name ?? sample.employee?.employee_name ?? 'Employee',
                grossPay: Number(sample.gross_pay ?? 0),
                netPay: Number(sample.net_pay ?? 0),
                basicPay: Number(sample.basic_pay ?? 0),
                overtimeHours: Number(sample.overtime_hours ?? 0),
                sss: Number(sample.sss_employee_share ?? 0),
                philhealth: Number(sample.philhealth_employee_share ?? 0),
                pagibig: Number(sample.pagibig_employee_share ?? 0),
                tax: Number(sample.withholding_tax ?? 0),
                totalDeductions: Number(sample.total_deductions ?? 0),
            };

            const text = await withTimeout(explainPayslip(context), TIMEOUT_MS);
            const cleaned = (text ?? '').trim();
            if (!cleaned) {
                setStatus('empty');
                return;
            }
            setSampleName(context.employeeName);
            setExplanation(cleaned);
            setStatus('ok');
        } catch (err: any) {
            console.error('[AiryPayslipExplainerCard] load failed:', err);
            setStatus('error');
            setErrorMsg(
                err?.message === 'Timeout'
                    ? 'Payslip explanation took too long.'
                    : err?.message ?? 'Could not explain the payslip.'
            );
        }
    }, [fetchRuns]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-indigo-500 bg-paper px-5 py-5 dark:border-paper/10">
            <FileText
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-indigo-500 opacity-[0.06]"
            />
            <div className="relative flex items-center gap-2">
                <FileText size={13} className="text-indigo-500" />
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Airy payslip explainer
                </p>
                <button
                    type="button"
                    onClick={load}
                    disabled={status === 'loading'}
                    title="Refresh explanation"
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {status === 'loading' && (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Airy is reading the latest payslip…
                </div>
            )}

            {status === 'empty' && (
                <p className="relative mt-4 text-[12px] text-muted">
                    No completed payroll run to explain yet.
                </p>
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

            {status === 'ok' && explanation && (
                <div className="relative mt-4">
                    {sampleName && (
                        <p className="text-[11px] uppercase tracking-wider text-muted mb-1.5">
                            Sample: {sampleName}
                        </p>
                    )}
                    <p className="text-[12px] text-ink font-rethink leading-relaxed whitespace-pre-wrap">
                        {explanation}
                    </p>
                </div>
            )}
        </div>
    );
}

export default AiryPayslipExplainerCard;