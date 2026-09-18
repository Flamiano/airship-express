'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, PieChart, CheckCircle2, XCircle,
    AlertTriangle, DollarSign, TrendingUp, Calendar, Building2
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HR4CompenBudgetPlan, BudgetSummary } from '../../types';

const EMPTY_BUDGET_FORM = {
    fiscal_year: new Date().getFullYear(),
    department: '',
    total_budget: '',
    salary_budget: '',
    bonus_budget: '',
    allowance_budget: '',
    training_budget: '',
    other_budget: '',
    status: 'draft' as const,
};

const DEPARTMENTS = ['All', 'HR', 'IT', 'Operations', 'Finance', 'Marketing', 'Sales', 'Engineering', 'Admin'];

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

const BudgetPlanningManager = () => {
    const toast = useToast();
    const [budgets, setBudgets] = useState<HR4CompenBudgetPlan[]>([]);
    const [budgetSummary, setBudgetSummary] = useState<BudgetSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedDept, setSelectedDept] = useState<string>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<HR4CompenBudgetPlan | null>(null);
    const [form, setForm] = useState(EMPTY_BUDGET_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<HR4CompenBudgetPlan | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/budget');
    const { fetchData: fetchSummary } = useApi('/payroll-benefits-dashboard/api/compensation/budget-summary');

    useEffect(() => {
        loadData();
    }, [selectedYear, selectedDept]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [budgetData, summaryData] = await Promise.all([
                fetchData(`?fiscal_year=${selectedYear}&department=${selectedDept === 'All' ? '' : selectedDept}`),
                fetchSummary(`?fiscal_year=${selectedYear}`),
            ]);
            setBudgets(budgetData || []);
            setBudgetSummary(summaryData || []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Failed to load budget data');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditTarget(null);
        setForm({
            ...EMPTY_BUDGET_FORM,
            fiscal_year: selectedYear,
            department: selectedDept === 'All' ? '' : selectedDept,
        });
        setIsModalOpen(true);
    };

    const openEdit = (budget: HR4CompenBudgetPlan) => {
        setEditTarget(budget);
        setForm({
            fiscal_year: budget.fiscal_year,
            department: budget.department || '',
            total_budget: String(budget.total_budget),
            salary_budget: String(budget.salary_budget),
            bonus_budget: String(budget.bonus_budget),
            allowance_budget: String(budget.allowance_budget),
            training_budget: String(budget.training_budget || ''),
            other_budget: String(budget.other_budget || ''),
            status: budget.status,
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.total_budget || !form.salary_budget) {
            toast.showError('Total budget and salary budget are required');
            return;
        }

        const payload = {
            fiscal_year: form.fiscal_year,
            department: form.department.trim() || null,
            total_budget: Number(form.total_budget) || 0,
            salary_budget: Number(form.salary_budget) || 0,
            bonus_budget: Number(form.bonus_budget) || 0,
            allowance_budget: Number(form.allowance_budget) || 0,
            training_budget: Number(form.training_budget) || null,
            other_budget: Number(form.other_budget) || null,
            status: form.status,
        };

        setIsSaving(true);
        try {
            if (editTarget) {
                await putData(`/${editTarget.id}`, payload);
                toast.showSuccess('Budget plan updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Budget plan created');
            }
            setIsModalOpen(false);
            setForm(EMPTY_BUDGET_FORM);
            setEditTarget(null);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save budget plan');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Budget plan deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.showError(error?.message || 'Failed to delete budget plan');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredBudgets = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return budgets;
        return budgets.filter((b) =>
            (b.department || '').toLowerCase().includes(term) ||
            b.status.toLowerCase().includes(term)
        );
    }, [budgets, searchTerm]);

    const totalBudget = useMemo(
        () => budgets.reduce((sum, b) => sum + (b.total_budget || 0), 0),
        [budgets]
    );
    const totalActualSpent = useMemo(
        () => budgets.reduce((sum, b) => sum + (b.actual_spent || 0), 0),
        [budgets]
    );
    const utilization = totalBudget > 0 ? Math.round((totalActualSpent / totalBudget) * 100) : 0;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={PieChart} label="Total Budget" value={peso(totalBudget)} tint="blue" />
                <StatCard icon={DollarSign} label="Actual Spent" value={peso(totalActualSpent)} tint="amber" />
                <StatCard icon={TrendingUp} label="Utilization" value={`${utilization}%`} tint="purple" />
                <StatCard icon={CheckCircle2} label="Active Plans" value={String(budgets.filter(b => b.status === 'active').length)} tint="emerald" />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Search placeholder="Search budgets..." onSearch={setSearchTerm} className="w-full md:max-w-xs" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                    >
                        {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
                <Button
                    onClick={openCreate}
                    className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-2 w-full">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="whitespace-nowrap leading-none">New Budget Plan</span>
                    </span>
                </Button>
            </div>

            {budgetSummary.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {budgetSummary.slice(0, 3).map((summary) => (
                        <Card key={summary.department || 'overall'} variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                            <CardBody className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-ink font-rethink">{summary.department || 'Overall'}</p>
                                        <p className="text-sm font-semibold font-mono text-ink mt-1">{peso(summary.total_budget)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-muted font-rethink">Utilization</p>
                                        <p className={`text-sm font-semibold font-mono ${summary.variance_percentage > 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {summary.variance_percentage}%
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-2 h-1.5 w-full rounded-full bg-line overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${summary.variance_percentage > 10 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(summary.variance_percentage, 100)}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex justify-between text-[10px] text-muted font-rethink">
                                    <span>Spent: {peso(summary.actual_spent)}</span>
                                    <span>Remaining: {peso(summary.remaining_budget)}</span>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading budgets…
                    </div>
                ) : budgets.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No budget plans for this year. Create one to get started." />
                    </CardBody>
                ) : filteredBudgets.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No budgets match your search." />
                    </CardBody>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Department</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Total Budget</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Salary</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Bonuses</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Allowances</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filteredBudgets.map((budget) => (
                                        <motion.tr
                                            key={budget.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                        >
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <p className="text-[13px] font-medium text-ink font-rethink">{budget.department || 'Overall'}</p>
                                                <p className="text-[10px] text-muted font-rethink">FY {budget.fiscal_year}</p>
                                            </td>
                                            <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                {peso(budget.total_budget)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-[12px] font-mono text-ink/70 whitespace-nowrap">
                                                {peso(budget.salary_budget)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-[12px] font-mono text-ink/70 whitespace-nowrap hidden md:table-cell">
                                                {peso(budget.bonus_budget)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-[12px] font-mono text-ink/70 whitespace-nowrap hidden lg:table-cell">
                                                {peso(budget.allowance_budget)}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${budget.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' :
                                                        budget.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800' :
                                                            budget.status === 'draft' ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700' :
                                                                'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
                                                    }`}>
                                                    {budget.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEdit(budget)}
                                                        className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(budget)}
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

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editTarget ? 'Edit Budget Plan' : 'New Budget Plan'}
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Fiscal Year</label>
                                <input
                                    type="number"
                                    min="2023"
                                    max="2030"
                                    value={form.fiscal_year}
                                    onChange={(e) => setForm((f) => ({ ...f, fiscal_year: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Department</label>
                                <select
                                    value={form.department}
                                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    <option value="">Overall</option>
                                    {DEPARTMENTS.filter(d => d !== 'All').map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Total Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.total_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, total_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Salary Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.salary_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, salary_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bonus Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.bonus_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, bonus_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Allowance Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.allowance_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, allowance_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Training Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.training_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, training_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Other Budget</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.other_budget}
                                    onChange={(e) => setForm((f) => ({ ...f, other_budget: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="pending_approval">Pending Approval</option>
                                <option value="approved">Approved</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Budget Plan"
                    className="max-w-md"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Delete the budget plan for {deleteTarget.department || 'Overall'} FY {deleteTarget.fiscal_year}?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                This will permanently remove this budget plan and all associated tracking data.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BudgetPlanningManager;