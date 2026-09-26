'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Wallet,
    TrendingUp,
    Receipt,
    HeartPulse,
    BarChart3,
    Bot,
    Activity,
    Check,
    CircleDot,
    Circle,
} from 'lucide-react';

import { useCurrentUser } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/useCurrentUser';
import { StatsCards } from './StatsCards';
import { PayrollCalendar } from './PayrollCalendar';
import { RecentPayrollRuns } from './RecentPayrollRuns';

const PAY_CYCLE_STEPS = [
    { label: 'Timesheets locked', date: 'Aug 05' },
    { label: 'Payroll draft', date: 'Aug 06' },
    { label: 'HR review & approval', date: 'Aug 07' },
    { label: 'Disbursement', date: 'Aug 08' },
    { label: 'Payslips released', date: 'Aug 08' },
];
const currentStep = 1;

const BANNER_PILLS = [
    { label: 'Employees', value: 312 },
    { label: 'Pending claims', value: 18 },
    { label: 'Active contracts', value: 6 },
];

const MODULES = [
    { icon: Wallet, label: 'Payroll Management', href: '/payroll-benefits-dashboard/payroll-management' },
    { icon: TrendingUp, label: 'Compensation Planning', href: '/payroll-benefits-dashboard/compensation-planning' },
    { icon: Receipt, label: 'Claims and Reimbursement', href: '/payroll-benefits-dashboard/claims-and-reimbursement' },
    { icon: HeartPulse, label: 'HMO & Benefits Administration', href: '/payroll-benefits-dashboard/hmo-benefits-administration' },
    { icon: BarChart3, label: 'HR Analytics Dashboard', href: '/payroll-benefits-dashboard/hr-analytics-dashboard' },
    { icon: Bot, label: 'Payroll Assistant (AI)', href: '/payroll-benefits-dashboard/chatbot' },
];

export function PayrollDashboard() {
    const { user } = useCurrentUser();
    const firstName = user?.fullName?.split(' ')[0] ?? 'there';
    const roleLabel = user?.role ? `${user.role.replace('_', ' ')} session active` : 'Session active';

    return (
        <div className="space-y-6">
            <div>
                <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
                    AirshipExpress · Payroll &amp; Benefits
                </p>
                <h1 className="mt-2 font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
                    Here&rsquo;s where this cycle stands.
                </h1>
            </div>

            <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
                        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-dark px-6 py-7 text-paper sm:px-8 sm:py-9"
                    >
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em]">
                            <Activity size={12} strokeWidth={2} />
                            {roleLabel}
                        </span>
                        <p className="mt-4 text-[15px] text-paper/70">Welcome back,</p>
                        <h2 className="font-bricolage text-[28px] font-semibold tracking-tight sm:text-[40px]">
                            {firstName}
                        </h2>

                        <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
                            {BANNER_PILLS.map((p) => (
                                <div
                                    key={p.label}
                                    className="rounded-xl bg-paper/10 px-4 py-2.5 backdrop-blur-sm"
                                >
                                    <p className="font-bricolage text-[20px] font-semibold leading-none">
                                        {p.value}
                                    </p>
                                    <p className="mt-1 text-[11px] text-paper/70">{p.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <StatsCards />

                    <div className="w-full rounded-2xl border border-line px-5 py-6 sm:px-8 sm:py-7 dark:border-paper/10">
                        <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                            Current pay cycle
                        </p>
                        <ol className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-0">
                            {PAY_CYCLE_STEPS.map((step, i) => {
                                const done = i < currentStep;
                                const active = i === currentStep;
                                return (
                                    <li
                                        key={step.label}
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
                                            <span className="block text-[12px] text-muted">{step.date}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>

                    <div className="w-full rounded-2xl border border-line px-5 py-6 sm:px-8 sm:py-7 dark:border-paper/10">
                        <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                            Modules
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3 dark:border-paper/10 dark:bg-paper/10">
                            {MODULES.map(({ icon: Icon, label, href }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="group flex items-center gap-3 bg-paper px-4 py-4 transition-colors hover:bg-accent/[0.06]"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors group-hover:border-accent group-hover:text-accent dark:border-paper/15">
                                        <Icon size={16} strokeWidth={1.75} />
                                    </span>
                                    <span className="text-[13px] font-medium text-ink">{label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                    <PayrollCalendar />
                    <RecentPayrollRuns />

                    <Link
                        href="/payroll-benefits-dashboard/chatbot"
                        className="group flex w-full flex-col gap-3 rounded-2xl border border-line px-5 py-5 transition-colors hover:bg-accent/[0.06] dark:border-paper/10"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-accent dark:border-paper/15">
                            <Bot size={16} strokeWidth={1.75} />
                        </span>
                        <div>
                            <p className="text-[13px] font-medium text-ink">Payroll Assistant</p>
                            <p className="mt-1 text-[12px] text-muted">
                                Ask for payroll computations, claim checks, or benefit summaries.
                            </p>
                        </div>
                        <span className="text-[12px] font-medium text-accent">Open assistant →</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}