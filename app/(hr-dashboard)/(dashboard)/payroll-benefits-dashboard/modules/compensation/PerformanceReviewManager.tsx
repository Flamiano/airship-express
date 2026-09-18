'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, BarChart3, CheckCircle2, XCircle,
    AlertTriangle, Users, DollarSign, TrendingUp, Star, Gift,
    Clock
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HR4CompenMeritPlanning, HR4CompenBonusAllocation } from '../../types';

const EMPTY_MERIT_FORM = {
    employee_id: '',
    performance_rating: '',
    current_salary: '',
    recommended_increase_percent: '',
    recommended_new_salary: '',
    proposed_effective_date: '',
    manager_notes: '',
    hr_notes: '',
    status: 'draft' as const,
};

const EMPTY_BONUS_FORM = {
    employee_id: '',
    bonus_type: 'performance' as const,
    amount: '',
    bonus_percentage: '',
    performance_rating: '',
    notes: '',
    status: 'draft' as const,
};

const BONUS_TYPES = [
    { value: 'performance', label: 'Performance Bonus' },
    { value: 'christmas', label: 'Christmas Bonus' },
    { value: 'attendance', label: 'Attendance Bonus' },
    { value: 'signing', label: 'Signing Bonus' },
    { value: 'referral', label: 'Referral Bonus' },
    { value: 'other', label: 'Other' },
];

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, tint }: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
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

const PerformanceReviewManager = () => {
    const toast = useToast();
    const [meritPlans, setMeritPlans] = useState<HR4CompenMeritPlanning[]>([]);
    const [bonuses, setBonuses] = useState<HR4CompenBonusAllocation[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'merit' | 'bonus'>('merit');

    const [isMeritModalOpen, setIsMeritModalOpen] = useState(false);
    const [editMerit, setEditMerit] = useState<HR4CompenMeritPlanning | null>(null);
    const [meritForm, setMeritForm] = useState(EMPTY_MERIT_FORM);

    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
    const [editBonus, setEditBonus] = useState<HR4CompenBonusAllocation | null>(null);
    const [bonusForm, setBonusForm] = useState(EMPTY_BONUS_FORM);

    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/merit-planning');
    const { fetchData: fetchBonuses, postData: postBonus, putData: putBonus, deleteData: deleteBonus } = useApi('/payroll-benefits-dashboard/api/compensation/bonus-allocation');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [meritData, bonusData, employeeData] = await Promise.all([
                fetchData(`?fiscal_year=${selectedYear}`),
                fetchBonuses(`?fiscal_year=${selectedYear}`),
                fetchEmployees(),
            ]);
            setMeritPlans(meritData || []);
            setBonuses(bonusData || []);
            setEmployees(employeeData || []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const openCreateMerit = () => {
        setEditMerit(null);
        setMeritForm({
            ...EMPTY_MERIT_FORM,
            proposed_effective_date: new Date().toISOString().split('T')[0],
        });
        setIsMeritModalOpen(true);
    };

    const openEditMerit = (plan: HR4CompenMeritPlanning) => {
        setEditMerit(plan);
        setMeritForm({
            employee_id: plan.employee_id,
            performance_rating: String(plan.performance_rating),
            current_salary: String(plan.current_salary),
            recommended_increase_percent: String(plan.recommended_increase_percent),
            recommended_new_salary: String(plan.recommended_new_salary),
            proposed_effective_date: plan.proposed_effective_date?.split('T')[0] || '',
            manager_notes: plan.manager_notes || '',
            hr_notes: plan.hr_notes || '',
            status: plan.status,
        });
        setIsMeritModalOpen(true);
    };

    const handleSaveMerit = async () => {
        if (!meritForm.employee_id || !meritForm.performance_rating || !meritForm.recommended_new_salary) {
            toast.showError('Employee, performance rating, and new salary are required');
            return;
        }

        const payload = {
            employee_id: meritForm.employee_id,
            fiscal_year: selectedYear,
            performance_rating: Number(meritForm.performance_rating) || 0,
            current_salary: Number(meritForm.current_salary) || 0,
            recommended_increase_percent: Number(meritForm.recommended_increase_percent) || 0,
            recommended_new_salary: Number(meritForm.recommended_new_salary) || 0,
            proposed_effective_date: meritForm.proposed_effective_date,
            manager_notes: meritForm.manager_notes.trim() || null,
            hr_notes: meritForm.hr_notes.trim() || null,
            status: meritForm.status,
        };

        setIsSaving(true);
        try {
            if (editMerit) {
                await putData(`/${editMerit.id}`, payload);
                toast.showSuccess('Merit plan updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Merit plan created');
            }
            setIsMeritModalOpen(false);
            setMeritForm(EMPTY_MERIT_FORM);
            setEditMerit(null);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save merit plan');
        } finally {
            setIsSaving(false);
        }
    };

    const openCreateBonus = () => {
        setEditBonus(null);
        setBonusForm({
            ...EMPTY_BONUS_FORM,
            bonus_type: 'performance',
        });
        setIsBonusModalOpen(true);
    };

    const handleSaveBonus = async () => {
        if (!bonusForm.employee_id || !bonusForm.amount) {
            toast.showError('Employee and amount are required');
            return;
        }

        const payload = {
            employee_id: bonusForm.employee_id,
            fiscal_year: selectedYear,
            bonus_type: bonusForm.bonus_type,
            amount: Number(bonusForm.amount) || 0,
            bonus_percentage: Number(bonusForm.bonus_percentage) || null,
            performance_rating: Number(bonusForm.performance_rating) || null,
            notes: bonusForm.notes.trim() || null,
            status: bonusForm.status,
        };

        setIsSaving(true);
        try {
            if (editBonus) {
                await putBonus(`/${editBonus.id}`, payload);
                toast.showSuccess('Bonus allocation updated');
            } else {
                await postBonus('', payload);
                toast.showSuccess('Bonus allocated');
            }
            setIsBonusModalOpen(false);
            setBonusForm(EMPTY_BONUS_FORM);
            setEditBonus(null);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save bonus');
        } finally {
            setIsSaving(false);
        }
    };

    const getEmployeeName = (employeeId: string) => {
        const emp = employees.find(e => e.employee_id === employeeId);
        return emp?.employee_name || 'Unknown Employee';
    };

    const filteredMerit = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return meritPlans;
        return meritPlans.filter((m) =>
            getEmployeeName(m.employee_id).toLowerCase().includes(term)
        );
    }, [meritPlans, searchTerm, employees]);

    const filteredBonuses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return bonuses;
        return bonuses.filter((b) =>
            getEmployeeName(b.employee_id).toLowerCase().includes(term)
        );
    }, [bonuses, searchTerm, employees]);

    const totalMeritIncrease = useMemo(
        () => meritPlans.filter(m => m.status === 'approved' || m.status === 'implemented')
            .reduce((sum, m) => sum + (m.recommended_new_salary - m.current_salary), 0),
        [meritPlans]
    );
    const totalBonuses = useMemo(
        () => bonuses.filter(b => b.status === 'approved' || b.status === 'paid')
            .reduce((sum, b) => sum + (b.amount || 0), 0),
        [bonuses]
    );
    const pendingMerit = useMemo(
        () => meritPlans.filter(m => m.status === 'draft' || m.status === 'pending_review').length,
        [meritPlans]
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Users} label="Merit Plans" value={String(meritPlans.length)} tint="blue" />
                <StatCard icon={TrendingUp} label="Total Merit Increase" value={peso(totalMeritIncrease)} tint="emerald" />
                <StatCard icon={Gift} label="Total Bonuses" value={peso(totalBonuses)} tint="purple" />
                <StatCard icon={Clock} label="Pending Review" value={String(pendingMerit)} tint="amber" />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Search placeholder="Search by employee..." onSearch={setSearchTerm} className="w-full md:max-w-xs" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'merit' ? (
                        <Button
                            onClick={openCreateMerit}
                            className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            <span className="flex flex-row items-center justify-center gap-2 w-full">
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap leading-none">New Merit Plan</span>
                            </span>
                        </Button>
                    ) : (
                        <Button
                            onClick={openCreateBonus}
                            className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            <span className="flex flex-row items-center justify-center gap-2 w-full">
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap leading-none">Allocate Bonus</span>
                            </span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-line dark:border-line/30">
                <button
                    onClick={() => setActiveTab('merit')}
                    className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${activeTab === 'merit'
                            ? 'border-accent text-ink'
                            : 'border-transparent text-muted hover:text-ink/70'
                        }`}
                >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Merit Increases
                </button>
                <button
                    onClick={() => setActiveTab('bonus')}
                    className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors ${activeTab === 'bonus'
                            ? 'border-accent text-ink'
                            : 'border-transparent text-muted hover:text-ink/70'
                        }`}
                >
                    <Gift className="h-3.5 w-3.5" />
                    Bonuses
                </button>
            </div>

            {/* Merit Plans */}
            {activeTab === 'merit' && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                            Loading merit plans…
                        </div>
                    ) : meritPlans.length === 0 ? (
                        <CardBody className="p-6 sm:p-8">
                            <Alert variant="info" message="No merit plans for this year. Create one to get started." />
                        </CardBody>
                    ) : filteredMerit.length === 0 ? (
                        <CardBody className="p-6 sm:p-8">
                            <Alert variant="info" message="No merit plans match your search." />
                        </CardBody>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Current</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Increase</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">New Salary</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rating</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {filteredMerit.map((plan) => (
                                            <motion.tr
                                                key={plan.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                                                            <span className="text-xs font-semibold font-mono">
                                                                {getEmployeeName(plan.employee_id)?.charAt(0) || '?'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[13px] font-medium text-ink font-rethink truncate max-w-[120px]">
                                                            {getEmployeeName(plan.employee_id)}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right text-[12px] font-mono text-ink/70 whitespace-nowrap">
                                                    {peso(plan.current_salary)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-[12px] font-mono font-semibold text-emerald-600 whitespace-nowrap">
                                                    {plan.recommended_increase_percent}%
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(plan.recommended_new_salary)}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                                        <span className="text-xs font-medium text-ink">{plan.performance_rating}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${plan.status === 'approved' || plan.status === 'implemented'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                            : plan.status === 'pending_review'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : plan.status === 'rejected'
                                                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
                                                                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                                                        }`}>
                                                        {plan.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEditMerit(plan)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget({ id: plan.id, type: 'merit', name: getEmployeeName(plan.employee_id) })}
                                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Bonuses */}
            {activeTab === 'bonus' && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                            Loading bonuses…
                        </div>
                    ) : bonuses.length === 0 ? (
                        <CardBody className="p-6 sm:p-8">
                            <Alert variant="info" message="No bonuses allocated for this year." />
                        </CardBody>
                    ) : filteredBonuses.length === 0 ? (
                        <CardBody className="p-6 sm:p-8">
                            <Alert variant="info" message="No bonuses match your search." />
                        </CardBody>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Type</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rating</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {filteredBonuses.map((bonus) => (
                                            <motion.tr
                                                key={bonus.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <p className="text-[13px] font-medium text-ink font-rethink">
                                                        {getEmployeeName(bonus.employee_id)}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap capitalize">
                                                    {bonus.bonus_type}
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(bonus.amount)}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {bonus.performance_rating ? (
                                                        <div className="flex items-center gap-1">
                                                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                                            <span className="text-xs text-ink">{bonus.performance_rating}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${bonus.status === 'paid' || bonus.status === 'approved'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                            : bonus.status === 'pending_approval'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                                                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                                                        }`}>
                                                        {bonus.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditBonus(bonus);
                                                                setBonusForm({
                                                                    employee_id: bonus.employee_id,
                                                                    bonus_type: bonus.bonus_type,
                                                                    amount: String(bonus.amount),
                                                                    bonus_percentage: String(bonus.bonus_percentage || ''),
                                                                    performance_rating: String(bonus.performance_rating || ''),
                                                                    notes: bonus.notes || '',
                                                                    status: bonus.status,
                                                                });
                                                                setIsBonusModalOpen(true);
                                                            }}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget({ id: bonus.id, type: 'bonus', name: getEmployeeName(bonus.employee_id) })}
                                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Merit Modal */}
            {isMeritModalOpen && (
                <Modal
                    isOpen={isMeritModalOpen}
                    onClose={() => setIsMeritModalOpen(false)}
                    title={editMerit ? 'Edit Merit Plan' : 'New Merit Plan'}
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsMeritModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveMerit} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Saving…' : editMerit ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={meritForm.employee_id}
                                onChange={(e) => setMeritForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name} {emp.employee_id_number ? `(${emp.employee_id_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Performance Rating</label>
                                <select
                                    value={meritForm.performance_rating}
                                    onChange={(e) => setMeritForm((f) => ({ ...f, performance_rating: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    <option value="">Select rating…</option>
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <option key={r} value={r}>{r} - {r <= 2 ? 'Needs Improvement' : r === 3 ? 'Meets Expectations' : r === 4 ? 'Exceeds Expectations' : 'Outstanding'}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Current Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={meritForm.current_salary}
                                    onChange={(e) => setMeritForm((f) => ({ ...f, current_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Increase %</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={meritForm.recommended_increase_percent}
                                    onChange={(e) => {
                                        const pct = Number(e.target.value);
                                        const current = Number(meritForm.current_salary) || 0;
                                        const newSalary = current + (current * (pct / 100));
                                        setMeritForm((f) => ({
                                            ...f,
                                            recommended_increase_percent: e.target.value,
                                            recommended_new_salary: String(Math.round(newSalary * 100) / 100)
                                        }));
                                    }}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">New Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={meritForm.recommended_new_salary}
                                    onChange={(e) => setMeritForm((f) => ({ ...f, recommended_new_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Proposed Effective Date</label>
                            <input
                                type="date"
                                value={meritForm.proposed_effective_date}
                                onChange={(e) => setMeritForm((f) => ({ ...f, proposed_effective_date: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Manager Notes</label>
                            <textarea
                                value={meritForm.manager_notes}
                                onChange={(e) => setMeritForm((f) => ({ ...f, manager_notes: e.target.value }))}
                                rows={2}
                                placeholder="Notes from manager"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">HR Notes</label>
                            <textarea
                                value={meritForm.hr_notes}
                                onChange={(e) => setMeritForm((f) => ({ ...f, hr_notes: e.target.value }))}
                                rows={2}
                                placeholder="Notes from HR"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Status</label>
                            <select
                                value={meritForm.status}
                                onChange={(e) => setMeritForm((f) => ({ ...f, status: e.target.value as any }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="pending_review">Pending Review</option>
                                <option value="approved">Approved</option>
                                <option value="implemented">Implemented</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Bonus Modal */}
            {isBonusModalOpen && (
                <Modal
                    isOpen={isBonusModalOpen}
                    onClose={() => setIsBonusModalOpen(false)}
                    title={editBonus ? 'Edit Bonus Allocation' : 'Allocate Bonus'}
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsBonusModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveBonus} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Saving…' : editBonus ? 'Save Changes' : 'Allocate Bonus'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={bonusForm.employee_id}
                                onChange={(e) => setBonusForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name} {emp.employee_id_number ? `(${emp.employee_id_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bonus Type</label>
                                <select
                                    value={bonusForm.bonus_type}
                                    onChange={(e) => setBonusForm((f) => ({ ...f, bonus_type: e.target.value as any }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    {BONUS_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Performance Rating</label>
                                <select
                                    value={bonusForm.performance_rating}
                                    onChange={(e) => setBonusForm((f) => ({ ...f, performance_rating: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    <option value="">N/A</option>
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={bonusForm.amount}
                                    onChange={(e) => setBonusForm((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bonus %</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={bonusForm.bonus_percentage}
                                    onChange={(e) => setBonusForm((f) => ({ ...f, bonus_percentage: e.target.value }))}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Notes</label>
                            <textarea
                                value={bonusForm.notes}
                                onChange={(e) => setBonusForm((f) => ({ ...f, notes: e.target.value }))}
                                rows={2}
                                placeholder="Reason or notes for this bonus"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Status</label>
                            <select
                                value={bonusForm.status}
                                onChange={(e) => setBonusForm((f) => ({ ...f, status: e.target.value as any }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="pending_approval">Pending Approval</option>
                                <option value="approved">Approved</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title={`Delete ${deleteTarget.type === 'merit' ? 'Merit Plan' : 'Bonus'}`}
                    className="max-w-md"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={async () => {
                                setIsDeleting(true);
                                try {
                                    if (deleteTarget.type === 'merit') {
                                        await deleteData(`/${deleteTarget.id}`);
                                    } else {
                                        await deleteBonus(`/${deleteTarget.id}`);
                                    }
                                    toast.showSuccess(`${deleteTarget.type === 'merit' ? 'Merit plan' : 'Bonus'} deleted`);
                                    setDeleteTarget(null);
                                    loadData();
                                } catch (error: any) {
                                    toast.showError(error?.message || 'Failed to delete');
                                } finally {
                                    setIsDeleting(false);
                                }
                            }} disabled={isDeleting} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                {isDeleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Delete the {deleteTarget.type} for {deleteTarget.name}?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                This action cannot be undone.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PerformanceReviewManager;