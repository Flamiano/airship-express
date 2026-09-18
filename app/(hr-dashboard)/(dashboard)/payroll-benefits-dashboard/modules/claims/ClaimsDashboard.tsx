'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Tag, Banknote } from 'lucide-react';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import ClaimsManager from './ClaimsManager';
import ClaimTypeManager from './ClaimTypeManager';
import ReimbursementManager from './ReimbursementManager';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

const TABS = [
    { value: 'claims', label: 'Claims' },
    { value: 'reimbursement', label: 'Reimbursement' },
    { value: 'types', label: 'Claim Types' },
];

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const ClaimsDashboard = () => {
    const [activeTab, setActiveTab] = useState<'claims' | 'reimbursement' | 'types'>('claims');
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { fetchData } = useApi('/payroll-benefits-dashboard/api/claims/summary');

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

    return (
        <div className="space-y-5">
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
                                <span className="font-semibold text-ink">{loading ? '...' : summary?.total_claims ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Total Amount</span>
                                <span className="font-semibold text-ink">{loading ? '...' : peso(summary?.total_amount || 0)}</span>
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
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{loading ? '...' : peso(summary?.total_reimbursed || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Awaiting Payment</span>
                                <span className="font-semibold text-amber-600 dark:text-amber-400">{loading ? '...' : peso(summary?.approved_amount || 0)}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4 sm:p-5 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <Tag className="h-4 w-4 text-accent" />
                            <h4 className="text-sm font-semibold text-ink font-rethink">Quick Summary</h4>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Awaiting your review</span>
                                <span className="font-semibold text-ink">{loading ? '...' : summary?.pending_count ?? 0} claim{summary?.pending_count === 1 ? '' : 's'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Approved, waiting on payout</span>
                                <span className="font-semibold text-ink">{loading ? '...' : peso(summary?.approved_amount || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-rethink">
                                <span className="text-muted">Paid out this month</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{loading ? '...' : peso(summary?.reimbursed_this_month || 0)}</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <div className="flex items-center gap-1 border-b border-line dark:border-line/30">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value as 'claims' | 'reimbursement' | 'types')}
                        className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${activeTab === tab.value
                                ? 'border-accent text-ink'
                                : 'border-transparent text-muted hover:text-ink/70'
                            }`}
                    >
                        {tab.value === 'claims' && <Receipt className="h-3.5 w-3.5" />}
                        {tab.value === 'reimbursement' && <Banknote className="h-3.5 w-3.5" />}
                        {tab.value === 'types' && <Tag className="h-3.5 w-3.5" />}
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'claims' && <ClaimsManager />}
            {activeTab === 'reimbursement' && <ReimbursementManager />}
            {activeTab === 'types' && <ClaimTypeManager />}
        </div>
    );
};

export default ClaimsDashboard;