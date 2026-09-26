'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { airyBriefing } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/actions/payrollActions';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

interface Props {
    adminUserId?: string;
}

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'error';
type TimeOfDay = 'morning' | 'afternoon' | 'evening';

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

function num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function getTimeOfDay(): TimeOfDay {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
}

function labelFor(t: TimeOfDay): string {
    if (t === 'morning') return 'Airy · Morning Briefing';
    if (t === 'afternoon') return 'Airy · Afternoon Briefing';
    return 'Airy · Evening Briefing';
}

function loadingTextFor(t: TimeOfDay): string {
    if (t === 'morning') return 'Airy is reviewing your payroll…';
    if (t === 'afternoon') return 'Airy is checking the rest of your day…';
    return 'Airy is wrapping up today’s payroll…';
}

export function AiryBriefingCard({ adminUserId }: Props) {
    const [briefing, setBriefing] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());
    const loadedRef = useRef(false);

    const { fetchData: fetchSummary } = useApi(
        '/payroll-benefits-dashboard/api/payroll/summary'
    );
    const { fetchData: fetchRuns } = useApi(
        '/payroll-benefits-dashboard/api/payroll/runs'
    );
    const { fetchData: fetchBudget } = useApi(
        '/payroll-benefits-dashboard/api/compensation/labor-budget'
    );
    const { fetchData: fetchBank } = useApi(
        '/payroll-benefits-dashboard/api/payroll/bank-status'
    );
    const { fetchData: fetchClaims } = useApi(
        '/payroll-benefits-dashboard/api/claims/summary'
    );
    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );

    useEffect(() => {
        const tick = () => setTimeOfDay(getTimeOfDay());
        tick();
        const id = setInterval(tick, 60 * 1000);
        return () => clearInterval(id);
    }, []);

    const headerLabel = useMemo(() => labelFor(timeOfDay), [timeOfDay]);
    const loadingLabel = useMemo(() => loadingTextFor(timeOfDay), [timeOfDay]);

    const load = useCallback(async () => {
        setStatus('loading');
        setErrorMsg(null);
        try {
            const year = new Date().getFullYear();
            const [summaryRaw, runsRaw, budgetRaw, bankRaw, claimsRaw, empRaw] =
                await Promise.all([
                    fetchSummary().catch(() => null),
                    fetchRuns().catch(() => []),
                    fetchBudget(`?fiscal_year=${year}`).catch(() => ({ rows: [] })),
                    fetchBank().catch(() => null),
                    fetchClaims().catch(() => null),
                    fetchEmployees().catch(() => []),
                ]);

            const summary = summaryRaw ?? {};
            const runs: any[] = Array.isArray(runsRaw) ? runsRaw : [];
            const rows: any[] = (budgetRaw as any)?.rows || [];
            const employees: any[] = Array.isArray(empRaw) ? empRaw : empRaw?.rows ?? [];

            const thisMonth = new Date().getMonth() + 1;
            const monthRow = rows.find((r: any) => r.month === thisMonth);

            const pendingApprovals = runs.filter(
                (r) => r.approval_status === 'pending_approval'
            ).length;
            const approvedNotDistributed = runs.filter(
                (r) => r.approval_status === 'approved'
            ).length;
            const rejectedRuns = runs.filter(
                (r) => r.approval_status === 'rejected'
            ).length;
            const openDraftRuns = runs.filter((r) => r.status === 'draft').length;

            const activeEmployees = num(
                summary.active_employees ?? summary.headcount ?? employees.length
            );
            const totalPositions = num(summary.total_jobs ?? summary.total_positions);
            const openForHiring = num(summary.open_for_hiring);
            const todayAttendance = num(summary.today_attendance);
            const attendanceRate = num(summary.attendance_rate);
            const ytdNetPay = num(summary.ytd_net_pay);
            const ytdGrossPay = num(summary.ytd_gross_pay);
            const lastRunNetPay = num(summary.last_run_net_pay);

            const missingBank = num((bankRaw as any)?.total_affected);
            const withBank = num((bankRaw as any)?.with_bank);

            const pendingClaims = num(
                (claimsRaw as any)?.pending ??
                (claimsRaw as any)?.pending_count ??
                (claimsRaw as any)?.pendingCount
            );
            const approvedClaims = num(
                (claimsRaw as any)?.approved ??
                (claimsRaw as any)?.approved_count ??
                (claimsRaw as any)?.approvedCount
            );
            const claimsTotalAmount = num(
                (claimsRaw as any)?.pending_total ?? (claimsRaw as any)?.pendingTotal
            );

            const uniqueDepartments = new Set(
                employees
                    .map((e) => e.department)
                    .filter((d): d is string => typeof d === 'string' && d.length > 0)
            ).size;

            const currentTimeOfDay = getTimeOfDay();

            const text = await withTimeout(
                airyBriefing(
                    {
                        pending_approvals: pendingApprovals,
                        approved_not_distributed: approvedNotDistributed,
                        rejected_runs: rejectedRuns,
                        missing_bank: missingBank,
                        missing_birthdate: 0,
                        open_draft_runs: openDraftRuns,
                        this_month_planned: num(monthRow?.planned_amount),
                        this_month_actual: num(monthRow?.actual_amount),

                        active_employees: activeEmployees,
                        total_positions: totalPositions,
                        open_for_hiring: openForHiring,
                        unique_departments: uniqueDepartments,
                        today_attendance: todayAttendance,
                        attendance_rate: attendanceRate,
                        ytd_net_pay: ytdNetPay,
                        ytd_gross_pay: ytdGrossPay,
                        last_run_net_pay: lastRunNetPay,
                        with_bank: withBank,
                        pending_claims: pendingClaims,
                        approved_claims: approvedClaims,
                        claims_pending_amount: claimsTotalAmount,
                        current_month: thisMonth,
                        current_year: year,
                        time_of_day: currentTimeOfDay,
                    } as any,
                    adminUserId
                ),
                TIMEOUT_MS
            );

            const cleaned = (text ?? '').toString().trim();
            if (!cleaned) {
                setStatus('empty');
                setBriefing(null);
            } else {
                setBriefing(cleaned);
                setStatus('ok');
            }
            loadedRef.current = true;
        } catch (err: any) {
            console.error('[AiryBriefingCard] load failed:', err);
            let msg = 'Airy could not generate a briefing right now.';
            if (err?.message === 'Timeout') {
                msg = 'Airy took too long to respond. Try again in a moment.';
            } else if (typeof err?.message === 'string' && err.message.length < 120) {
                msg = err.message;
            }
            setStatus('error');
            setErrorMsg(msg);
            setBriefing(null);
        }
    }, [
        fetchSummary,
        fetchRuns,
        fetchBudget,
        fetchBank,
        fetchClaims,
        fetchEmployees,
        adminUserId,
    ]);

    useEffect(() => {
        if (loadedRef.current) return;
        void load();
    }, [load]);

    const refresh = () => {
        loadedRef.current = false;
        setTimeOfDay(getTimeOfDay());
        void load();
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-line border-l-4 border-l-accent bg-gradient-to-r from-pink-50/60 to-white p-4 dark:from-pink-950/20 dark:to-transparent dark:border-paper/10">
            <Sparkles
                size={72}
                className="pointer-events-none absolute -bottom-3 -right-3 text-accent opacity-[0.06]"
            />
            <div className="relative flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/20 bg-white">
                    <img
                        src="/images/airy-ai/hi-full.png"
                        alt="Airy"
                        className="h-9 w-9 object-contain"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-ink font-bricolage">
                            {headerLabel}
                        </p>
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={status === 'loading'}
                            title="Refresh briefing"
                            className="flex h-5 w-5 items-center justify-center rounded-md text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw
                                className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>

                    {status === 'loading' && (
                        <div className="flex items-center gap-2 py-1">
                            <video
                                src="/images/airy-ai/hi-run.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="h-6 w-6 object-contain"
                            />
                            <span className="text-xs text-muted font-rethink">{loadingLabel}</span>
                        </div>
                    )}

                    {status === 'ok' && briefing && (
                        <p className="text-xs text-ink font-rethink leading-relaxed whitespace-pre-wrap">
                            {briefing}
                        </p>
                    )}

                    {status === 'empty' && (
                        <div className="flex items-start gap-2 py-0.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted font-rethink leading-relaxed">
                                Airy didn&rsquo;t have anything new to report right now.
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex items-start gap-2 py-0.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-rethink leading-relaxed">
                                {errorMsg}
                            </p>
                        </div>
                    )}

                    {(status === 'empty' || status === 'error') && (
                        <button
                            type="button"
                            onClick={refresh}
                            className="mt-2 text-[11px] font-medium text-accent hover:underline"
                        >
                            Try again →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AiryBriefingCard;