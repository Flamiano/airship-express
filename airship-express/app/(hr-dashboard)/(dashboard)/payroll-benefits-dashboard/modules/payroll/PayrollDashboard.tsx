'use client';

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
    Users,
    ClipboardList,
    Wallet,
    TrendingUp,
    UserCheck,
    AlertTriangle,
    X,
    Loader2,
    Briefcase,
    CircleCheck,
    CircleX,
    UserPlus,
    PieChart,
    Search,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { useApi, ApiError } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import EmployeePayrollInfoManager from './EmployeePayrollInfoManager';
import PayrollRunManager from './PayrollRunManager';
import PayslipManager from './PayslipManager';

const TABS = [
    { label: 'Payroll Runs', value: 'runs' },
    { label: 'Employee Payroll Info', value: 'employees' },
];

const CATEGORY_STYLES: Record<string, string> = {
    no_account: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    inactive: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    incomplete: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
};

function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function calculateTenure(dateHired: string | null | undefined) {
    if (!dateHired) return '—';
    try {
        const hired = new Date(dateHired);
        const now = new Date();
        const diffDays = Math.ceil(
            Math.abs(now.getTime() - hired.getTime()) / (1000 * 60 * 60 * 24)
        );
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        const parts: string[] = [];
        if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
        if (months > 0) parts.push(`${months} mo${months > 1 ? 's' : ''}`);
        return parts.length > 0 ? parts.join(', ') : 'Less than a month';
    } catch {
        return '—';
    }
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    tint: 'blue' | 'amber' | 'emerald' | 'purple' | 'red' | 'gray' | 'pink';
}

const TINT_MAP: Record<StatCardProps['tint'], string> = {
    blue: 'bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400',
    emerald: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400',
    red: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400',
    pink: 'bg-pink-50 text-pink-500 dark:bg-pink-950/40 dark:text-pink-400',
};

const StatCard = ({ icon, label, value, tint }: StatCardProps) => (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 dark:border-line/30">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TINT_MAP[tint]}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                {label}
            </p>
            <p className="text-base font-mono font-semibold text-ink truncate">
                {value}
            </p>
        </div>
    </div>
);

const PayrollDashboard = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'runs' | 'employees'>('runs');
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [bankStatus, setBankStatus] = useState<any>(null);
    const [bankStatusLoading, setBankStatusLoading] = useState(true);
    const [alertDismissed, setAlertDismissed] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankSearch, setBankSearch] = useState('');
    const [bankFilter, setBankFilter] = useState<'all' | 'no_account' | 'inactive' | 'incomplete'>('all');

    const positionChartRef = useRef<HTMLCanvasElement | null>(null);
    const positionChartInstanceRef = useRef<Chart | null>(null);
    const bankChartRef = useRef<HTMLCanvasElement | null>(null);
    const bankChartInstanceRef = useRef<Chart | null>(null);

    const { fetchData: fetchSummary } = useApi(
        '/payroll-benefits-dashboard/api/payroll/summary'
    );
    const { fetchData: fetchBankStatus } = useApi(
        '/payroll-benefits-dashboard/api/payroll/bank-status'
    );

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const authFailedRef = useRef(false);

    const loadSummary = useCallback(async () => {
        if (authFailedRef.current) return;
        try {
            const data = await fetchSummary();
            setSummary(data);
        } catch (error: any) {
            if (error instanceof ApiError && error.status === 401) {
                authFailedRef.current = true;
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            } else {
                console.error('Summary error:', error);
            }
        } finally {
            setLoading(false);
        }
    }, [fetchSummary]);

    const loadBankStatus = useCallback(async () => {
        setBankStatusLoading(true);
        try {
            const data = await fetchBankStatus();
            setBankStatus(data);
        } catch (error) {
            console.error('Bank status error:', error);
        } finally {
            setBankStatusLoading(false);
        }
    }, [fetchBankStatus]);

    useEffect(() => {
        loadSummary();
        loadBankStatus();

        intervalRef.current = setInterval(() => {
            if (!authFailedRef.current) loadSummary();
        }, 60000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadSummary, loadBankStatus]);

    const positionData = useMemo(() => {
        const raw = summary?.position_distribution || {};
        const labels = Object.keys(raw);
        const values = Object.values(raw) as number[];
        return { labels, values };
    }, [summary]);

    useEffect(() => {
        if (loading || !positionChartRef.current || positionData.labels.length === 0) return;
        positionChartInstanceRef.current?.destroy();

        const palette = [
            cssVar('--accent', '#e5167e'),
            cssVar('--sss', '#2455c7'),
            cssVar('--philhealth', '#0b8f6b'),
            cssVar('--pagibig', '#b8720e'),
            '#8b5cf6',
            '#f59e0b',
            '#06b6d4',
        ];

        positionChartInstanceRef.current = new Chart(positionChartRef.current, {
            type: 'doughnut',
            data: {
                labels: positionData.labels,
                datasets: [
                    {
                        data: positionData.values,
                        backgroundColor: positionData.labels.map(
                            (_, i) => palette[i % palette.length]
                        ),
                        borderWidth: 0,
                        hoverOffset: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${ctx.raw}`,
                        },
                    },
                },
            },
        });

        return () => {
            positionChartInstanceRef.current?.destroy();
            positionChartInstanceRef.current = null;
        };
    }, [positionData, loading]);

    const bankChartValues = useMemo(
        () => [
            bankStatus?.with_bank ?? 0,
            bankStatus?.no_account ?? 0,
            bankStatus?.inactive ?? 0,
            bankStatus?.incomplete ?? 0,
        ],
        [bankStatus]
    );

    useEffect(() => {
        if (!showBankModal || bankStatusLoading || !bankChartRef.current) return;

        bankChartInstanceRef.current?.destroy();

        bankChartInstanceRef.current = new Chart(bankChartRef.current, {
            type: 'doughnut',
            data: {
                labels: ['With Bank Details', 'No Account', 'Inactive Account', 'Incomplete Details'],
                datasets: [
                    {
                        data: bankChartValues,
                        backgroundColor: ['#0b8f6b', '#ef4444', '#f59e0b', '#f97316'],
                        borderWidth: 3,
                        borderColor: cssVar('--paper', '#ffffff'),
                        hoverOffset: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${ctx.raw}`,
                        },
                    },
                },
            },
        });

        return () => {
            bankChartInstanceRef.current?.destroy();
            bankChartInstanceRef.current = null;
        };
    }, [showBankModal, bankStatusLoading, bankChartValues]);

    const peso = (n: number) =>
        `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const isLoading = loading && !summary;
    const affectedCount = bankStatus?.total_affected ?? 0;

    const openBankStatusModal = () => {
        loadBankStatus();
        setShowBankModal(true);
    };

    const goToBankDetails = () => {
        setShowBankModal(false);
        router.push('/payroll-benefits-dashboard/bank');
    };

    const legendRows = [
        { label: 'With Bank Details', value: bankStatus?.with_bank ?? 0, color: '#0b8f6b' },
        { label: 'No Bank Account', value: bankStatus?.no_account ?? 0, color: '#ef4444' },
        { label: 'Inactive Account', value: bankStatus?.inactive ?? 0, color: '#f59e0b' },
        { label: 'Incomplete Details', value: bankStatus?.incomplete ?? 0, color: '#f97316' },
    ];

    const filteredAffected = useMemo(() => {
        if (!bankStatus?.affected_employees) return [];
        const term = bankSearch.trim().toLowerCase();
        return bankStatus.affected_employees.filter((e: any) => {
            if (bankFilter !== 'all' && e.category !== bankFilter) return false;
            if (!term) return true;
            return (
                e.employee_name?.toLowerCase().includes(term) ||
                e.employee_id_number?.toLowerCase().includes(term)
            );
        });
    }, [bankStatus, bankSearch, bankFilter]);

    return (
        <div className="space-y-5">
            {!bankStatusLoading && affectedCount > 0 && !alertDismissed && (
                <div className="relative flex items-start gap-4 rounded-xl border-l-4 border-amber-400 bg-amber-50/70 px-5 py-4 dark:bg-amber-950/30 dark:border-amber-500">
                    <button
                        type="button"
                        onClick={openBankStatusModal}
                        className="flex flex-1 items-start gap-4 text-left min-w-0"
                    >
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5 dark:text-amber-400" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 font-rethink">
                                {affectedCount} Employee{affectedCount === 1 ? '' : 's'} Missing Bank Details
                            </p>
                            <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-300/90 font-rethink leading-relaxed">
                                Payroll runs cannot be processed until all active employees have complete and active bank account details. Please set up their bank accounts first.
                            </p>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setAlertDismissed(true)}
                        aria-label="Dismiss alert"
                        className="shrink-0 rounded-md p-1 text-amber-700/70 hover:text-amber-900 hover:bg-amber-100/50 transition-colors dark:text-amber-400/70 dark:hover:text-amber-200 dark:hover:bg-amber-900/30"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 border border-line dark:bg-ink/10 dark:border-line/30">
                    <Wallet className="h-4.5 w-4.5 text-ink/60" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold font-bricolage text-ink">
                        Payroll Management
                    </h1>
                    <p className="mt-0.5 text-sm text-muted font-rethink">
                        Manage employee payroll info, run payroll, and review payslips.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<Users className="h-4 w-4" />}
                    label="Active Employees"
                    value={isLoading ? '...' : (summary?.active_employees ?? 0)}
                    tint="blue"
                />
                <StatCard
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Open Payroll Runs"
                    value={isLoading ? '...' : (summary?.open_runs ?? 0)}
                    tint="amber"
                />
                <StatCard
                    icon={<Wallet className="h-4 w-4" />}
                    label="Last Run Net Pay"
                    value={isLoading ? '...' : peso(summary?.last_run_net_pay ?? 0)}
                    tint="emerald"
                />
                <StatCard
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Total Jobs"
                    value={isLoading ? '...' : (summary?.total_jobs ?? 0)}
                    tint="gray"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="YTD Gross Pay"
                    value={isLoading ? '...' : peso(summary?.ytd_gross_pay ?? 0)}
                    tint="purple"
                />
                <StatCard
                    icon={<Wallet className="h-4 w-4" />}
                    label="YTD Net Pay"
                    value={isLoading ? '...' : peso(summary?.ytd_net_pay ?? 0)}
                    tint="emerald"
                />
                <StatCard
                    icon={<CircleCheck className="h-4 w-4" />}
                    label="Open for Hiring"
                    value={isLoading ? '...' : (summary?.open_for_hiring ?? 0)}
                    tint="emerald"
                />
                <StatCard
                    icon={<CircleX className="h-4 w-4" />}
                    label="Closed for Hiring"
                    value={isLoading ? '...' : (summary?.closed_for_hiring ?? 0)}
                    tint="red"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<UserCheck className="h-4 w-4" />}
                    label="Today's Attendance"
                    value={isLoading ? '...' : (summary?.today_attendance ?? 0)}
                    tint="emerald"
                />
                <StatCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Attendance Rate"
                    value={isLoading ? '...' : `${summary?.attendance_rate ?? 0}%`}
                    tint="purple"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/30">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-accent" />
                            <p className="text-sm font-semibold text-ink font-rethink">
                                Recent Hires
                            </p>
                            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-muted font-rethink dark:bg-ink/10">
                                Latest 3
                            </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-muted font-rethink">
                            Tenure
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-10 text-sm text-muted font-rethink">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : (summary?.recent_hires?.length ?? 0) === 0 ? (
                        <p className="py-8 text-center text-xs text-muted font-rethink">
                            No recent hires.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {summary.recent_hires.map((hire: any) => (
                                <div
                                    key={hire.id}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-ink/[0.015] px-3.5 py-2.5 dark:border-line/20 dark:bg-ink/[0.03]"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500 dark:bg-pink-950/40 dark:text-pink-400">
                                            <span className="text-xs font-semibold font-mono">
                                                {hire.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-ink font-rethink truncate">
                                                {hire.name}
                                            </p>
                                            <p className="text-[11px] text-muted font-rethink truncate">
                                                {hire.position}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-muted font-rethink">
                                            Hired
                                        </p>
                                        <p className="text-[11px] font-medium text-ink font-rethink">
                                            {new Date(hire.date_hired).toLocaleDateString(
                                                undefined,
                                                { month: 'short', day: 'numeric', year: 'numeric' }
                                            )}
                                        </p>
                                        <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-pink-50 px-1.5 py-0.5 text-[9px] font-medium text-pink-600 dark:bg-pink-950/40 dark:text-pink-400">
                                            {calculateTenure(hire.date_hired)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/30">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-accent" />
                            <p className="text-sm font-semibold text-ink font-rethink">
                                Job Positions Distribution
                            </p>
                            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-muted font-rethink dark:bg-ink/10">
                                {summary?.total_jobs ?? 0} positions
                            </span>
                        </div>
                    </div>

                    {isLoading || positionData.labels.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-sm text-muted font-rethink">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : (
                        <div className="h-56">
                            <canvas ref={positionChartRef} />
                        </div>
                    )}
                </div>
            </div>

            {selectedRun ? (
                <PayslipManager run={selectedRun} onBack={() => setSelectedRun(null)} />
            ) : (
                <>
                    <div className="flex items-center gap-1 border-b border-line dark:border-line/30">
                        {TABS.map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value as 'runs' | 'employees')}
                                className={`border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${activeTab === tab.value
                                        ? 'border-accent text-ink'
                                        : 'border-transparent text-muted hover:text-ink/70'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'runs' && (
                        <PayrollRunManager
                            onViewPayslips={setSelectedRun}
                            bankStatus={bankStatus}
                            onOpenBankModal={openBankStatusModal}
                        />
                    )}
                    {activeTab === 'employees' && <EmployeePayrollInfoManager />}
                </>
            )}

            {showBankModal && (
                <Modal
                    isOpen={showBankModal}
                    onClose={() => setShowBankModal(false)}
                    title="Incomplete Bank Details"
                    className="max-w-2xl"
                    accent="orange"
                    icon={AlertTriangle}
                    footer={
                        <div className="flex w-full flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowBankModal(false)}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Close
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={goToBankDetails}
                                leftIcon={<Briefcase className="h-4 w-4" />}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Bank Details
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-5">
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 dark:text-amber-400" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 font-rethink">
                                    Payroll blocked
                                </p>
                                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 font-rethink mt-0.5">
                                    {bankStatus?.total_affected ?? 0} employee
                                    {(bankStatus?.total_affected ?? 0) === 1 ? '' : 's'} need complete bank details.
                                </p>
                            </div>
                        </div>

                        {bankStatusLoading ? (
                            <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted font-rethink">
                                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                                Loading bank status…
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/30">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                                        <div className="h-40 sm:h-44 relative">
                                            <canvas ref={bankChartRef} />
                                        </div>
                                        <div className="space-y-2">
                                            {legendRows.map((row) => (
                                                <div
                                                    key={row.label}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-ink/[0.015] px-3 py-2 dark:border-line/20 dark:bg-ink/[0.03]"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span
                                                            className="h-2.5 w-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: row.color }}
                                                        />
                                                        <span className="text-xs font-medium text-ink font-rethink truncate">
                                                            {row.label}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-mono font-semibold tabular-nums text-ink shrink-0">
                                                        {row.value}
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink/[0.03] px-3 py-2 dark:border-line/30 dark:bg-ink/[0.06] mt-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink font-rethink">
                                                    Total Active
                                                </span>
                                                <span className="text-sm font-mono font-bold tabular-nums text-ink">
                                                    {bankStatus?.total_active ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Affected Employees
                                        </p>
                                        <span className="text-[11px] text-muted font-rethink">
                                            {filteredAffected.length} of {bankStatus?.total_affected ?? 0}
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                                            <input
                                                type="text"
                                                value={bankSearch}
                                                onChange={(e) => setBankSearch(e.target.value)}
                                                placeholder="Search by name or ID…"
                                                className="w-full rounded-lg border border-line bg-paper pl-9 pr-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                            />
                                        </div>
                                        <select
                                            value={bankFilter}
                                            onChange={(e) =>
                                                setBankFilter(
                                                    e.target.value as 'all' | 'no_account' | 'inactive' | 'incomplete'
                                                )
                                            }
                                            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                        >
                                            <option value="all">All Issues</option>
                                            <option value="no_account">No Bank Account</option>
                                            <option value="inactive">Inactive Account</option>
                                            <option value="incomplete">Incomplete Details</option>
                                        </select>
                                    </div>

                                    {filteredAffected.length === 0 ? (
                                        <div className="rounded-lg border border-line bg-ink/[0.02] px-4 py-6 text-center text-xs text-muted font-rethink dark:border-line/30">
                                            {bankStatus?.affected_employees?.length === 0
                                                ? 'All active employees have complete bank details.'
                                                : 'No employees match the current search or filter.'}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            {filteredAffected.map((emp: any) => (
                                                <div
                                                    key={emp.employee_id}
                                                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-4 py-2.5 dark:border-line/30"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500 dark:bg-pink-950/40 dark:text-pink-400">
                                                            <span className="text-xs font-semibold font-mono">
                                                                {emp.employee_name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-ink font-rethink truncate">
                                                                {emp.employee_name}
                                                            </p>
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                {emp.employee_id_number}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium font-rethink ${CATEGORY_STYLES[emp.category] ||
                                                            'bg-ink/5 text-ink/70 border-line'
                                                            }`}
                                                    >
                                                        {emp.reason}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PayrollDashboard;