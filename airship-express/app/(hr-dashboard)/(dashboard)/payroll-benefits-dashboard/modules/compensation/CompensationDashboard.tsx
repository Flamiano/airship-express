'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingUp, Users, Award, Gift, Coins, BarChart3, PieChart, Calendar, Clock
} from 'lucide-react';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { OtpSessionProvider } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import SalaryStructureManager from './SalaryStructureManager';
import BenefitsManager from './BenefitsManager/page';
import BudgetPlanningManager from './BudgetPlanningManager';
import PerformanceReviewManager from './PerformanceReviewManager/page';
import CompensationReports from './CompensationReports';

type TabKey = 'salary-structure' | 'benefits' | 'budget' | 'performance' | 'reports';

const TABS: { value: TabKey; label: string; icon: React.ElementType }[] = [
    { value: 'salary-structure', label: 'Salary Structure', icon: Award },
    { value: 'benefits', label: 'Benefits & Allowances', icon: Gift },
    { value: 'budget', label: 'Budget Planning', icon: PieChart },
    { value: 'performance', label: 'Performance Review', icon: BarChart3 },
    { value: 'reports', label: 'Reports', icon: Calendar },
];

const DEFAULT_TAB: TabKey = 'salary-structure';

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, subtitle, tint }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subtitle?: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray' | 'red';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
                {subtitle && <p className="text-[10px] text-muted font-rethink">{subtitle}</p>}
            </div>
        </div>
    );
}

const CompensationDashboard = () => {
    const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { fetchData } = useApi('/payroll-benefits-dashboard/api/compensation/summary');

    useEffect(() => {
        loadSummary();
    }, []);

    const loadSummary = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setSummary(data);
        } catch (error) {
            console.error('Load summary error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = useCallback((tab: TabKey) => {
        setActiveTab(tab);
    }, []);

    return (
        <OtpSessionProvider>
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line dark:border-line/30">
                        <Coins className="h-4.5 w-4.5 text-muted" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold font-bricolage text-ink">Compensation Planning</h1>
                        <p className="mt-0.5 text-sm text-muted font-rethink">
                            Design salary structures, plan compensation budgets, and manage total rewards across the organization.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                        icon={Users}
                        label="Total Employees"
                        value={loading ? '...' : String(summary?.total_employees ?? 0)}
                        tint="blue"
                    />
                    <StatCard
                        icon={DollarSign}
                        label="Monthly Payroll"
                        value={loading ? '...' : peso(summary?.total_monthly_payroll || 0)}
                        tint="emerald"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Avg Monthly Salary"
                        value={loading ? '...' : peso(summary?.average_salary || 0)}
                        tint="purple"
                    />
                    <StatCard
                        icon={Award}
                        label="Salary Grades"
                        value={loading ? '...' : String(summary?.salary_grade_count ?? 0)}
                        tint="amber"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                        icon={Gift}
                        label="Total Allowances"
                        value={loading ? '...' : peso(summary?.total_allowances || 0)}
                        tint="accent"
                    />
                    <StatCard
                        icon={BarChart3}
                        label="Bonus Allocated"
                        value={loading ? '...' : peso(summary?.total_bonus_allocated || 0)}
                        tint="blue"
                    />
                    <StatCard
                        icon={PieChart}
                        label="Budget Utilization"
                        value={loading ? '...' : `${summary?.budget_utilization || 0}%`}
                        tint="amber"
                    />
                    <StatCard
                        icon={Clock}
                        label="Pending Merit Reviews"
                        value={loading ? '...' : String(summary?.pending_merit_reviews ?? 0)}
                        tint="red"
                    />
                </div>

                <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto">
                    {TABS.map((tab) => {
                        const active = activeTab === tab.value;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.value}
                                onClick={() => handleTabChange(tab.value)}
                                className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${active
                                    ? 'border-accent text-ink'
                                    : 'border-transparent text-muted hover:text-ink/80'
                                    }`}
                            >
                                <span
                                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${active
                                        ? 'bg-accent/10 text-accent'
                                        : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                                        }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'salary-structure' && <SalaryStructureManager />}
                {activeTab === 'benefits' && <BenefitsManager />}
                {activeTab === 'budget' && <BudgetPlanningManager />}
                {activeTab === 'performance' && <PerformanceReviewManager />}
                {activeTab === 'reports' && <CompensationReports />}
            </div>
        </OtpSessionProvider>
    );
};

export default CompensationDashboard;