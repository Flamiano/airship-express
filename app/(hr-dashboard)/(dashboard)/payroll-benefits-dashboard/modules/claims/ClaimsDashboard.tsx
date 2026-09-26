'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Receipt,
    Banknote,
    Tag,
    Clock3,
    CheckCircle2,
    Wallet,
    TrendingUp,
} from 'lucide-react';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { OtpSessionProvider } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import ClaimsManager from './ClaimsManager';
import ClaimTypeManager from './ClaimTypeManager';
import ReimbursementManager from './ReimbursementManager';

type ClaimsTab = 'claims' | 'reimbursement' | 'types';

const TABS: { value: ClaimsTab; label: string; icon: React.ComponentType<{ className?: string; size?: number; title?: string }> }[] = [
    { value: 'claims', label: 'Claims', icon: Receipt },
    { value: 'reimbursement', label: 'Reimbursement', icon: Banknote },
    { value: 'types', label: 'Claim Types', icon: Tag },
];

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({
    icon: Icon,
    label,
    value,
    tint,
}: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'amber' | 'blue' | 'purple';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
            </div>
        </div>
    );
}

const ClaimsDashboardInner = () => {
    const [activeTab, setActiveTab] = useState<ClaimsTab>('claims');
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { fetchData } = useApi('/payroll-benefits-dashboard/api/claims/summary');

    const loadSummary = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setSummary(data);
        } catch (error) {
            console.error('Load summary error:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchData]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Receipt} label="Total Claims" value={loading ? '...' : String(summary?.total_claims ?? 0)} tint="blue" />
                <StatCard icon={Clock3} label="Pending Review" value={loading ? '...' : String(summary?.pending_count ?? 0)} tint="amber" />
                <StatCard icon={CheckCircle2} label="Awaiting Payout" value={loading ? '...' : peso(summary?.approved_amount || 0)} tint="purple" />
                <StatCard icon={Wallet} label="Reimbursed Total" value={loading ? '...' : peso(summary?.total_reimbursed || 0)} tint="emerald" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4 sm:p-5 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <Receipt className="h-4 w-4 text-accent" />
                            <h4 className="text-sm font-semibold text-ink font-rethink">Claims Summary</h4>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Total Claims</span>
                                <span className="font-semibold font-mono text-ink">{loading ? '...' : summary?.total_claims ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Total Amount</span>
                                <span className="font-semibold font-mono text-ink">{loading ? '...' : peso(summary?.total_amount || 0)}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4 sm:p-5 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <Banknote className="h-4 w-4 text-emerald-500" />
                            <h4 className="text-sm font-semibold text-ink font-rethink">Reimbursement Summary</h4>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Paid Out</span>
                                <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">{loading ? '...' : peso(summary?.total_reimbursed || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Awaiting Payment</span>
                                <span className="font-semibold font-mono text-amber-600 dark:text-amber-400">{loading ? '...' : peso(summary?.approved_amount || 0)}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4 sm:p-5 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            <h4 className="text-sm font-semibold text-ink font-rethink">This Month</h4>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Paid out this month</span>
                                <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">{loading ? '...' : peso(summary?.reimbursed_this_month || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Awaiting your review</span>
                                <span className="font-semibold font-mono text-ink">
                                    {loading ? '...' : `${summary?.pending_count ?? 0} claim${summary?.pending_count === 1 ? '' : 's'}`}
                                </span>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto">
                {TABS.map((tab) => {
                    const active = activeTab === tab.value;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => setActiveTab(tab.value)}
                            className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink/80'
                                }`}
                        >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${active ? 'bg-accent/10 text-accent' : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                                }`}>
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {activeTab === 'claims' && <ClaimsManager />}
            {activeTab === 'reimbursement' && <ReimbursementManager />}
            {activeTab === 'types' && <ClaimTypeManager />}
        </div>
    );
};

const ClaimsDashboard = () => (
    <OtpSessionProvider>
        <ClaimsDashboardInner />
    </OtpSessionProvider>
);

export default ClaimsDashboard;