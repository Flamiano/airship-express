'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Lightbulb } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface Insight {
    kind: 'warning' | 'success' | 'info';
    title: string;
    body: string;
}

export function AiryInsightsCard() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);

    const { fetchData: fetchBank } = useApi(
        '/payroll-benefits-dashboard/api/payroll/bank-status'
    );
    const { fetchData: fetchRuns } = useApi(
        '/payroll-benefits-dashboard/api/payroll/runs'
    );
    const { fetchData: fetchClaims } = useApi(
        '/payroll-benefits-dashboard/api/claims/summary'
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [bankRaw, runsRaw, claimsRaw] = await Promise.all([
                    fetchBank().catch(() => null),
                    fetchRuns().catch(() => []),
                    fetchClaims().catch(() => null),
                ]);
                if (cancelled) return;

                const out: Insight[] = [];

                const missing = (bankRaw as any)?.total_affected ?? 0;
                if (missing > 0) {
                    out.push({
                        kind: 'warning',
                        title: `${missing} employee${missing === 1 ? '' : 's'} missing bank details`,
                        body: 'Payroll runs cannot be distributed until every active employee has a complete and active bank account.',
                    });
                } else if (bankRaw) {
                    out.push({
                        kind: 'success',
                        title: 'All bank details complete',
                        body: 'Every active employee has valid bank information on file.',
                    });
                }

                const runs: any[] = Array.isArray(runsRaw) ? runsRaw : [];
                const pending = runs.filter((r) => r.approval_status === 'pending_approval').length;
                if (pending > 0) {
                    out.push({
                        kind: 'info',
                        title: `${pending} payroll run${pending === 1 ? '' : 's'} awaiting approval`,
                        body: 'Review and approve them in Payroll Management to keep the cycle on track.',
                    });
                }
                const drafts = runs.filter((r) => r.status === 'draft').length;
                if (drafts > 0) {
                    out.push({
                        kind: 'info',
                        title: `${drafts} draft run${drafts === 1 ? '' : 's'} in progress`,
                        body: 'These have not been submitted for approval yet.',
                    });
                }

                const claimsPending =
                    (claimsRaw as any)?.pending ??
                    (claimsRaw as any)?.pending_count ??
                    (claimsRaw as any)?.pendingCount ??
                    0;
                if (claimsPending > 0) {
                    out.push({
                        kind: 'warning',
                        title: `${claimsPending} claim${claimsPending === 1 ? '' : 's'} pending review`,
                        body: 'Unreviewed claims may delay reimbursement on the next pay run.',
                    });
                }

                if (out.length === 0) {
                    out.push({
                        kind: 'success',
                        title: 'No anomalies detected',
                        body: 'Payroll, bank records, and claims are all in good standing for this cycle.',
                    });
                }

                setInsights(out.slice(0, 4));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [fetchBank, fetchRuns, fetchClaims]);

    const styleFor = (kind: Insight['kind']) => {
        if (kind === 'warning')
            return { cls: 'bg-amber-50 text-amber-600', Icon: AlertTriangle };
        if (kind === 'success')
            return { cls: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 };
        return { cls: 'bg-blue-50 text-blue-600', Icon: Info };
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-indigo-500 bg-paper px-5 py-5 dark:border-paper/10">
            <Lightbulb
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-indigo-500 opacity-[0.06]"
            />
            <div className="relative flex items-center gap-2">
                <Lightbulb size={13} className="text-indigo-500" />
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    Airy insights
                </p>
            </div>

            {loading ? (
                <div className="relative mt-4 flex items-center gap-2 text-[12px] text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                </div>
            ) : (
                <div className="relative mt-4 flex flex-col gap-3">
                    {insights.map((ins, i) => {
                        const { cls, Icon } = styleFor(ins.kind);
                        return (
                            <div key={i} className="flex items-start gap-2.5">
                                <span
                                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cls}`}
                                >
                                    <Icon size={12} strokeWidth={2} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-medium text-ink">{ins.title}</p>
                                    <p className="text-[11px] text-muted leading-relaxed">{ins.body}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default AiryInsightsCard;