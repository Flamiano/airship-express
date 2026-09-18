'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, Gift, CheckCircle2, XCircle,
    AlertTriangle, DollarSign, TrendingUp, Calendar
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HR4CompenEmployeeBenefit, BenefitType, BenefitFrequency } from '../../types';

const PAGE_SIZE = 8;

const BENEFIT_TYPES: { value: BenefitType; label: string }[] = [
    { value: 'allowance', label: 'Allowance' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'incentive', label: 'Incentive' },
    { value: 'commission', label: 'Commission' },
    { value: 'overtime', label: 'Overtime' },
    { value: 'night_diff', label: 'Night Differential' },
    { value: 'holiday_pay', label: 'Holiday Pay' },
    { value: 'other', label: 'Other' },
];

const FREQUENCIES: { value: BenefitFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semi_annual', label: 'Semi-Annual' },
    { value: 'annual', label: 'Annual' },
    { value: 'one_time', label: 'One Time' },
];

const EMPTY_FORM = {
    employee_id: '',
    benefit_type: 'allowance' as BenefitType,
    benefit_name: '',
    amount: '',
    frequency: 'monthly' as BenefitFrequency,
    is_taxable: true,
    is_active: true,
    effective_date: '',
    expiry_date: '',
    description: '',
};

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

const BenefitsManager = () => {
    const toast = useToast();
    const [benefits, setBenefits] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/employee-benefits');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [benefitsData, employeesData] = await Promise.all([
                fetchData(),
                fetchEmployees(),
            ]);
            setBenefits(benefitsData || []);
            setEmployees(employeesData || []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Failed to load benefits');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditTarget(null);
        setForm({
            ...EMPTY_FORM,
            effective_date: new Date().toISOString().split('T')[0],
        });
        setIsModalOpen(true);
    };

    const openEdit = (benefit: any) => {
        setEditTarget(benefit);
        setForm({
            employee_id: String(benefit.employee_id || ''),
            benefit_type: benefit.benefit_type || 'allowance',
            benefit_name: benefit.benefit_name || '',
            amount: String(benefit.amount || ''),
            frequency: benefit.frequency || 'monthly',
            is_taxable: benefit.is_taxable !== undefined ? benefit.is_taxable : true,
            is_active: benefit.is_active !== undefined ? benefit.is_active : true,
            effective_date: benefit.effective_date?.split('T')[0] || new Date().toISOString().split('T')[0],
            expiry_date: benefit.expiry_date?.split('T')[0] || '',
            description: benefit.description || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.employee_id || !form.benefit_name || !form.amount) {
            toast.showError('Employee, benefit name, and amount are required');
            return;
        }

        const payload = {
            employee_id: form.employee_id,
            benefit_type: form.benefit_type,
            benefit_name: form.benefit_name.trim(),
            amount: Number(form.amount) || 0,
            frequency: form.frequency,
            is_taxable: form.is_taxable,
            is_active: form.is_active,
            effective_date: form.effective_date,
            expiry_date: form.expiry_date || null,
            description: form.description.trim() || null,
        };

        setIsSaving(true);
        try {
            if (editTarget) {
                await putData(`/${editTarget.id}`, payload);
                toast.showSuccess('Benefit updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Benefit added');
            }
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            setEditTarget(null);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save benefit');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (benefit: any) => {
        try {
            await putData(`/${benefit.id}`, { is_active: !benefit.is_active });
            toast.showSuccess(`Benefit ${benefit.is_active ? 'deactivated' : 'activated'}`);
            loadData();
        } catch (error: any) {
            console.error('Toggle error:', error);
            toast.showError(error?.message || 'Failed to update benefit');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Benefit deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.showError(error?.message || 'Failed to delete benefit');
        } finally {
            setIsDeleting(false);
        }
    };

    const getEmployeeName = (employeeId: string) => {
        const emp = employees.find(e => e.employee_id === employeeId);
        return emp?.employee_name || 'Unknown Employee';
    };

    const filteredBenefits = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return benefits;
        return benefits.filter((b) =>
            b.benefit_name?.toLowerCase().includes(term) ||
            getEmployeeName(b.employee_id).toLowerCase().includes(term) ||
            b.benefit_type?.toLowerCase().includes(term)
        );
    }, [benefits, searchTerm, employees]);

    const totalPages = Math.max(1, Math.ceil(filteredBenefits.length / PAGE_SIZE));
    const paginatedBenefits = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredBenefits.slice(start, start + PAGE_SIZE);
    }, [filteredBenefits, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const activeCount = useMemo(() => benefits.filter((b) => b.is_active).length, [benefits]);
    const totalMonthlyBenefits = useMemo(
        () => benefits.filter(b => b.frequency === 'monthly' && b.is_active)
            .reduce((sum, b) => sum + (b.amount || 0), 0),
        [benefits]
    );
    const totalAnnualBenefits = useMemo(
        () => benefits.filter(b => b.is_active).reduce((sum, b) => {
            const amount = Number(b.amount || 0);
            const multipliers: Record<string, number> = {
                monthly: 12,
                quarterly: 4,
                semi_annual: 2,
                annual: 1,
                one_time: 1,
            };
            return sum + (amount * (multipliers[b.frequency] || 1));
        }, 0),
        [benefits]
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Gift} label="Total Benefits" value={String(benefits.length)} tint="blue" />
                <StatCard icon={CheckCircle2} label="Active" value={String(activeCount)} tint="emerald" />
                <StatCard icon={DollarSign} label="Monthly Benefits" value={peso(totalMonthlyBenefits)} tint="purple" />
                <StatCard icon={TrendingUp} label="Annual Benefits" value={peso(totalAnnualBenefits)} tint="amber" />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <Search placeholder="Search benefits by employee, name, or type..." onSearch={setSearchTerm} className="w-full md:max-w-sm" />
                <Button
                    onClick={openCreate}
                    className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-2 w-full">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Add Benefit</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading benefits…
                    </div>
                ) : benefits.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No benefits added yet. Add employee benefits and allowances." />
                    </CardBody>
                ) : filteredBenefits.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No benefits match your search." />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Benefit</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Type</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Frequency</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedBenefits.map((benefit) => (
                                            <motion.tr
                                                key={benefit.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <p className="text-[13px] font-medium text-ink font-rethink">
                                                        {getEmployeeName(benefit.employee_id)}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap hidden md:table-cell max-w-[150px] truncate">
                                                    {benefit.benefit_name}
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap hidden lg:table-cell capitalize">
                                                    {benefit.benefit_type}
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(benefit.amount)}
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap hidden md:table-cell capitalize">
                                                    {benefit.frequency}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${benefit.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                                                        }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${benefit.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                        {benefit.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => toggleActive(benefit)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                        >
                                                            {benefit.is_active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => openEdit(benefit)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(benefit)}
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

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredBenefits.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Modal */}
            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editTarget ? 'Edit Benefit' : 'Add Benefit'}
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Benefit'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
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
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Benefit Type</label>
                                <select
                                    value={form.benefit_type}
                                    onChange={(e) => setForm((f) => ({ ...f, benefit_type: e.target.value as BenefitType }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    {BENEFIT_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Frequency</label>
                                <select
                                    value={form.frequency}
                                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as BenefitFrequency }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                >
                                    {FREQUENCIES.map((freq) => (
                                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Benefit Name</label>
                            <input
                                type="text"
                                value={form.benefit_name}
                                onChange={(e) => setForm((f) => ({ ...f, benefit_name: e.target.value }))}
                                placeholder="e.g. Transportation Allowance"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Effective Date</label>
                                <input
                                    type="date"
                                    value={form.effective_date}
                                    onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Expiry Date (optional)</label>
                                <input
                                    type="date"
                                    value={form.expiry_date}
                                    onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="Brief description of this benefit"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">Taxable</span>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, is_taxable: !f.is_taxable }))}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.is_taxable ? 'bg-accent' : 'bg-ink/15'}`}
                            >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_taxable ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">Active</span>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.is_active ? 'bg-accent' : 'bg-ink/15'}`}
                            >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Benefit"
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
                                Delete the benefit "{deleteTarget.benefit_name}" for {getEmployeeName(deleteTarget.employee_id)}?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                This will permanently remove this benefit from the employee's compensation package.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BenefitsManager;