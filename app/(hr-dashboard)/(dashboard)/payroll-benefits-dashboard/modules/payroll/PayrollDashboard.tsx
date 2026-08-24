'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Users, ClipboardList, Wallet, TrendingUp, Clock, UserCheck } from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import EmployeePayrollInfoManager from './EmployeePayrollInfoManager';
import PayrollRunManager from './PayrollRunManager';
import PayslipManager from './PayslipManager';

const TABS = [
    { label: 'Payroll Runs', value: 'runs' },
    { label: 'Employee Payroll Info', value: 'employees' },
];

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: 'blue' | 'amber' | 'emerald' | 'purple' | 'red' | 'gray';
}

const StatCard = ({ icon, label, value, color = 'gray' }: StatCardProps) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
        gray: 'bg-ink/5 text-muted dark:bg-ink/10',
    };

    return (
        <div className="rounded-xl border border-line bg-paper p-4 dark:border-line/30">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted font-rethink">{label}</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ${colorClasses[color]}`}>
                    {icon}
                </span>
            </div>
            <p className="mt-1.5 text-xl font-mono font-semibold text-ink">{value}</p>
        </div>
    );
};

const PayrollDashboard = () => {
    const [activeTab, setActiveTab] = useState<'runs' | 'employees'>('runs');
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { fetchData } = useApi('/payroll-benefits-dashboard/api/payroll/summary');

    useEffect(() => {
        loadSummary();
        const interval = setInterval(loadSummary, 60000);
        return () => clearInterval(interval);
    }, []);

    const loadSummary = async () => {
        try {
            const data = await fetchData();
            setSummary(data);
        } catch (error: any) {
            console.error("Summary error:", error);
        } finally {
            setLoading(false);
        }
    };

    const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold font-bricolage text-ink">Payroll Management</h1>
                <p className="mt-0.5 text-sm text-muted font-rethink">
                    Manage employee payroll info, run payroll, and review payslips.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={<Users className="h-4 w-4" />}
                    label="Active Employees"
                    value={loading ? '...' : (summary?.active_employees ?? '—')}
                    color="blue"
                />
                <StatCard
                    icon={<ClipboardList className="h-4 w-4" />}
                    label="Open Payroll Runs"
                    value={loading ? '...' : (summary?.open_runs ?? '—')}
                    color="amber"
                />
                <StatCard
                    icon={<Wallet className="h-4 w-4" />}
                    label="Last Run Net Pay"
                    value={loading ? '...' : (summary ? peso(summary.last_run_net_pay) : '—')}
                    color="emerald"
                />
                <StatCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Net Pay (YTD)"
                    value={loading ? '...' : (summary ? peso(summary.ytd_net_pay) : '—')}
                    color="purple"
                />
            </div>

            {summary?.today_attendance !== undefined && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        icon={<UserCheck className="h-4 w-4" />}
                        label="Today's Attendance"
                        value={loading ? '...' : (summary.today_attendance ?? '—')}
                        color="emerald"
                    />
                </div>
            )}

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

                    {activeTab === 'runs' && <PayrollRunManager onViewPayslips={setSelectedRun} />}
                    {activeTab === 'employees' && <EmployeePayrollInfoManager />}
                </>
            )}
        </div>
    );
};

export default PayrollDashboard;