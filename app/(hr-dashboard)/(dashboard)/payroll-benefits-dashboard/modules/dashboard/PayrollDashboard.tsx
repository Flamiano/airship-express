'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
    BarChart3,
    Check,
    Circle,
    CircleDot,
    HeartPulse,
    Receipt,
    RefreshCw,
    TrendingUp,
    Wallet,
} from 'lucide-react';

import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { AiryButton } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/ui/AiryButton';
import { AiryChatDrawer } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/ai/ui/AiryChatDrawer';
import { AiryBriefingCard } from './AiryBriefingCard';
import { AiryInsightsCard } from './AiryInsightsCard';
import { AiryQuickActions } from './AiryQuickActions';
import { supabase } from '@/app/(hr-dashboard)/supabase/client';

import { HeroCarousel } from './HeroCarousel';
import { StatsCards } from './StatsCards';
import { BenefitsStatsCard } from './BenefitsStatsCard';
import { PayrollCalendar } from './PayrollCalendar';
import { RecentPayrollRuns } from './RecentPayrollRuns';
import { BudgetStatusCard } from './BudgetStatusCard';
import { NotificationsCard } from './NotificationsCard';
import { ChartsRow } from './ChartsRow';
import { EmployeesTable } from './EmployeesTable';
import AiryAnomaliesCard from './AiryAnomaliesCard';
import AiryPayslipExplainerCard from './AiryPayslipExplainerCard';

const CYCLE_STEPS = [
    { key: 'timesheets_locked', label: 'Timesheets locked' },
    { key: 'payroll_draft', label: 'Payroll draft' },
    { key: 'hr_review', label: 'HR review & approval' },
    { key: 'disbursement', label: 'Disbursement' },
    { key: 'payslips_released', label: 'Payslips released' },
] as const;

interface CycleData {
    [key: string]: any;
}

function pickNum(obj: any, ...keys: string[]): number {
    if (!obj) return 0;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v);
            if (!Number.isNaN(n)) return n;
        }
    }
    return 0;
}

export function PayrollDashboard() {
    const [cycle, setCycle] = useState<CycleData | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [airyOpen, setAiryOpen] = useState(false);
    const [adminUserId, setAdminUserId] = useState<string | undefined>(undefined);

    const { fetchData: fetchSummary } = useApi(
        '/payroll-benefits-dashboard/api/payroll/summary'
    );

    useEffect(() => {
        let mounted = true;
        supabase.auth.getUser().then(({ data }) => {
            if (!mounted) return;
            if (data.user?.id) setAdminUserId(data.user.id);
        });
        return () => {
            mounted = false;
        };
    }, []);

    const loadSummary = async () => {
        try {
            const d = await fetchSummary().catch(() => null);
            if (d) setCycle(d as CycleData);
        } catch { }
    };

    useEffect(() => {
        void loadSummary();
    }, [fetchSummary]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadSummary();
        setRefreshing(false);
    };

    const currentStep = pickNum(cycle, 'current_step', 'currentStep');

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                        AirshipExpress · Payroll &amp; Benefits
                    </p>
                    <h1 className="mt-2 font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
                        Here&rsquo;s where this cycle stands.
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Refresh dashboard data"
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-medium text-muted transition-colors hover:bg-accent/[0.06] hover:text-ink disabled:opacity-50 dark:border-paper/10"
                >
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-w-0 flex-col gap-5 self-start">
                    <HeroCarousel />
                    <StatsCards />
                    <BenefitsStatsCard />
                    <ChartsRow />
                    <EmployeesTable />

                    <div className="relative w-full overflow-hidden rounded-2xl border border-line px-5 py-6 sm:px-8 sm:py-7 dark:border-paper/10">
                        <CircleDot
                            size={96}
                            className="pointer-events-none absolute -bottom-4 -right-4 text-accent opacity-[0.05]"
                        />
                        <p className="relative text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                            Current pay cycle
                        </p>
                        <ol className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-0">
                            {CYCLE_STEPS.map((step, i) => {
                                const done = i < currentStep;
                                const active = i === currentStep;
                                const dateStr = cycle?.step_dates?.[step.key] ?? null;
                                const dateLabel = dateStr
                                    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: '2-digit',
                                    })
                                    : '—';
                                return (
                                    <li
                                        key={step.key}
                                        className="flex flex-1 items-start gap-3 sm:flex-col sm:items-start sm:gap-2 sm:border-l sm:border-line sm:pl-4 sm:first:border-l-0 sm:first:pl-0 dark:sm:border-paper/10"
                                    >
                                        <span className="mt-0.5 shrink-0 sm:mt-0">
                                            {done ? (
                                                <Check size={16} className="text-accent" strokeWidth={2.5} />
                                            ) : active ? (
                                                <CircleDot size={16} className="text-accent" strokeWidth={2} />
                                            ) : (
                                                <Circle size={16} className="text-line" strokeWidth={2} />
                                            )}
                                        </span>
                                        <span>
                                            <span
                                                className={`block text-[13px] font-medium ${active || done ? 'text-ink' : 'text-muted'
                                                    }`}
                                            >
                                                {step.label}
                                            </span>
                                            <span className="block text-[12px] text-muted">{dateLabel}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-5 self-start">
                    <AiryBriefingCard adminUserId={adminUserId} />
                    <PayrollCalendar />
                    <BudgetStatusCard />
                    <AiryInsightsCard />
                    <AiryAnomaliesCard />
                    <AiryPayslipExplainerCard />
                    <AiryQuickActions onOpen={() => setAiryOpen(true)} />
                    <RecentPayrollRuns />
                    <NotificationsCard />
                </div>
            </div>

            <AiryButton onClick={() => setAiryOpen(true)} />
            <AiryChatDrawer
                isOpen={airyOpen}
                onClose={() => setAiryOpen(false)}
                adminUserId={adminUserId}
                context={{
                    active_employees: cycle?.active_employees,
                    pending_claims_count: cycle?.pending_claims_count,
                    next_pay_run_date: cycle?.next_pay_run_date,
                    page: 'payroll-dashboard',
                }}
            />
        </div>
    );
}

export default PayrollDashboard;