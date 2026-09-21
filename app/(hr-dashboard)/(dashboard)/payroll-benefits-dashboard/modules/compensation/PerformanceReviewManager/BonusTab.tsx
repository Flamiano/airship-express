'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, Gift, Users, TrendingUp,
    Clock, Printer, FileSpreadsheet, AlertTriangle, CalendarDays, Bell,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import OtpModal from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpModal';
import OtpUnlockBanner from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpUnlockBanner';
import { useOtpSessionContext } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import { printTable, exportExcel, printFormatters, PrintColumn } from '../../../modules/compensation/print-utils';
import {
    StatCard, peso, avatarClass, initialsOf, STATUS_STYLES, BONUS_TYPES,
    employeeHasBank,
} from './shared';

const EMPTY_BONUS_FORM = {
    employee_id: '',
    payroll_run_id: '',
    bonus_type: 'performance',
    amount: '',
    bonus_percentage: '',
    notes: '',
    status: 'draft',
};

type PendingAction =
    | { kind: 'save'; payload: any; isEdit: boolean; editId?: any }
    | { kind: 'delete'; id: any; name: string }
    | null;

const BonusTab = () => {
    const toast = useToast();
    const { active, secondsLeft, unlock, lock } = useOtpSessionContext();

    const [bonuses, setBonuses] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [form, setForm] = useState(EMPTY_BONUS_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [isOtpOpen, setIsOtpOpen] = useState(false);
    const [otpPurpose, setOtpPurpose] = useState<'bonus' | 'bonus_delete'>('bonus');

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/bonus-allocation');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');
    const { fetchData: fetchRuns } = useApi('/payroll-benefits-dashboard/api/payroll/runs');

    useEffect(() => { loadData(); }, [selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bonusData, employeeData, runData] = await Promise.all([
                fetchData(`?fiscal_year=${selectedYear}`).catch(() => []),
                fetchEmployees().catch(() => []),
                fetchRuns().catch(() => []),
            ]);
            setBonuses(Array.isArray(bonusData) ? bonusData : []);
            setEmployees(Array.isArray(employeeData) ? employeeData : []);
            setPayrollRuns(Array.isArray(runData) ? runData : []);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load bonuses');
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeName = (id: string) => {
        const emp = employees.find((e) => e.employee_id === id);
        return emp?.employee_name || 'Unknown Employee';
    };

    const getEmployeeNumber = (id: string) => {
        const emp = employees.find((e) => e.employee_id === id);
        return emp?.employee_id_number || '';
    };

    const getRun = (runId: number | string) =>
        payrollRuns.find((r) => String(r.id) === String(runId));

    const filteredBonuses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return bonuses;
        return bonuses.filter((b) => getEmployeeName(b.employee_id).toLowerCase().includes(term));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bonuses, searchTerm, employees]);

    const totalBonuses = useMemo(
        () =>
            bonuses
                .filter((b) => b.status === 'approved' || b.status === 'paid')
                .reduce((sum, b) => sum + (b.amount || 0), 0),
        [bonuses]
    );

    const pendingBonuses = useMemo(
        () => bonuses.filter((b) => b.status === 'draft' || b.status === 'pending_approval').length,
        [bonuses]
    );

    const bonusThisYear = useMemo(
        () => bonuses.filter((b) => b.fiscal_year === selectedYear).reduce((sum, b) => sum + (b.amount || 0), 0),
        [bonuses, selectedYear]
    );

    const openCreate = () => {
        setEditTarget(null);
        setForm({ ...EMPTY_BONUS_FORM, bonus_type: 'performance' });
        setIsModalOpen(true);
    };

    const openEdit = (bonus: any) => {
        setEditTarget(bonus);
        setForm({
            employee_id: bonus.employee_id,
            payroll_run_id: bonus.payroll_run_id ? String(bonus.payroll_run_id) : '',
            bonus_type: bonus.bonus_type,
            amount: String(bonus.amount),
            bonus_percentage: String(bonus.bonus_percentage || ''),
            notes: bonus.notes || '',
            status: bonus.status,
        });
        setIsModalOpen(true);
    };

    const buildPayload = () => {
        const run = getRun(form.payroll_run_id);
        return {
            employee_id: form.employee_id,
            fiscal_year: selectedYear,
            payroll_run_id: form.payroll_run_id ? Number(form.payroll_run_id) : null,
            bonus_type: form.bonus_type,
            amount: Number(form.amount) || 0,
            bonus_percentage: Number(form.bonus_percentage) || null,
            effective_date: run?.period_start || null,
            expiry_date: run?.period_end || null,
            notes: form.notes.trim() || null,
            status: form.status,
        };
    };

    const handleSave = async () => {
        if (!form.employee_id) { toast.showError('Select an employee'); return; }
        if (!form.payroll_run_id) { toast.showError('Select a payroll run'); return; }
        if (!form.amount) { toast.showError('Amount is required'); return; }
        if (!employeeHasBank(employees, form.employee_id)) {
            toast.showError('Cannot save — this employee has no bank account on file.');
            return;
        }

        const payload = buildPayload();
        const isEdit = !!editTarget;
        const editId = editTarget?.id;

        if (!active) {
            setPendingAction({ kind: 'save', payload, isEdit, editId });
            setOtpPurpose('bonus');
            setIsOtpOpen(true);
            return;
        }

        await commitSave(payload, isEdit, editId);
    };

    const commitSave = async (payload: any, isEdit: boolean, editId?: any) => {
        setIsSaving(true);
        try {
            if (isEdit) {
                await putData(`/${editId}`, payload);
                toast.showSuccess('Bonus updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Bonus created');
            }
            setIsModalOpen(false);
            setForm(EMPTY_BONUS_FORM);
            setEditTarget(null);
            setPendingAction(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save bonus');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (bonus: any) => {
        if (!bonus?.id) {
            toast.showError('Cannot delete — invalid record');
            return;
        }

        if (active) {
            setDeleteTarget({ id: bonus.id, name: getEmployeeName(bonus.employee_id) });
            return;
        }

        const name = getEmployeeName(bonus.employee_id);
        setPendingAction({ kind: 'delete', id: bonus.id, name });
        setOtpPurpose('bonus_delete');
        setIsOtpOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget?.id) {
            toast.showError('Invalid delete target');
            setDeleteTarget(null);
            return;
        }
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Bonus deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const printColumns: PrintColumn[] = [
        { key: 'employee_id', label: 'Employee', format: (v) => getEmployeeName(v) },
        { key: 'bonus_type', label: 'Type', format: (v) => printFormatters.capitalize(v) },
        { key: 'amount', label: 'Amount', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'bonus_percentage', label: 'Bonus %', align: 'right', format: (v) => (v != null ? `${v}%` : '—') },
        {
            key: 'payroll_run_id', label: 'Payroll Run', format: (v) => {
                const run = getRun(v);
                if (!run) return '—';
                return `${printFormatters.date(run.period_start)} – ${printFormatters.date(run.period_end)}`;
            },
        },
        { key: 'status', label: 'Status', format: (v) => printFormatters.capitalize(v) },
    ];

    const handlePrint = () => {
        if (filteredBonuses.length === 0) { toast.showError('No bonuses to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Bonus Allocations',
            reportSubtitle: `Fiscal Year ${selectedYear}`,
            filters: { 'Total Bonuses': filteredBonuses.length, 'Total Amount': peso(totalBonuses) },
        }, printColumns, filteredBonuses);
    };

    const handleExport = () => {
        if (filteredBonuses.length === 0) { toast.showError('No bonuses to export.'); return; }
        exportExcel(`bonus-allocations-${selectedYear}`, printColumns, filteredBonuses);
        toast.showSuccess('Bonuses exported to Excel.');
    };

    const formHasBank = form.employee_id ? employeeHasBank(employees, form.employee_id) : false;

    const isSaveDisabled =
        isSaving ||
        !form.employee_id ||
        !form.payroll_run_id ||
        !form.amount ||
        !formHasBank;

    return (
        <div className="space-y-5">
            <OtpUnlockBanner
                active={active}
                secondsLeft={secondsLeft}
                onLock={() => void lock()}
                scopeLabel="save & delete allowed without re-verifying"
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Gift} label="Total Bonuses" value={String(bonuses.length)} tint="purple" />
                <StatCard icon={TrendingUp} label="Approved Amount" value={peso(totalBonuses)} tint="emerald" />
                <StatCard icon={Clock} label="Pending" value={String(pendingBonuses)} tint="amber" />
                <StatCard icon={Users} label={`Total ${selectedYear}`} value={peso(bonusThisYear)} tint="blue" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <Search placeholder="Search bonuses by employee..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-9 rounded-md border border-line bg-paper px-2.5 text-xs font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 justify-stretch sm:justify-end w-full lg:w-auto">
                    <Button onClick={handlePrint} className="font-rethink text-xs h-9 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Print</span>
                        </span>
                    </Button>
                    <Button onClick={handleExport} className="font-rethink text-xs h-9 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Export</span>
                        </span>
                    </Button>
                    <Button onClick={openCreate} className="font-rethink text-xs h-9 px-3 rounded-md bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Add Bonus</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading bonuses…
                    </div>
                ) : filteredBonuses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/30 mb-3">
                            <Gift className="h-6 w-6 text-purple-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No bonuses yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Add bonuses per employee and assign them to a payroll run.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Type</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Payroll Run</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filteredBonuses.map((bonus) => {
                                        const statusStyle = STATUS_STYLES[bonus.status] || STATUS_STYLES.draft;
                                        const empName = getEmployeeName(bonus.employee_id);
                                        const empNo = getEmployeeNumber(bonus.employee_id);
                                        const run = getRun(bonus.payroll_run_id);
                                        const hasBank = employeeHasBank(employees, bonus.employee_id);
                                        return (
                                            <motion.tr
                                                key={bonus.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-purple-50/40 dark:hover:bg-purple-950/10"
                                            >
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(empName)}`}>
                                                            {initialsOf(empName)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-[13px] font-medium text-ink font-rethink truncate">{empName}</p>
                                                                {!hasBank && (
                                                                    <Bell className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="No bank details" />
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted font-rethink">{empNo || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-medium text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:ring-purple-800/40 capitalize">
                                                        <Gift className="h-3 w-3" />
                                                        {bonus.bonus_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(bonus.amount)}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {run ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-ink/[0.03] px-2 py-1 text-[11px] font-rethink text-ink/80 dark:bg-ink/[0.08]">
                                                            <CalendarDays className="h-3 w-3 text-muted" />
                                                            {new Date(run.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(run.period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ring-1 font-rethink ${statusStyle}`}>
                                                        {bonus.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEdit(bonus)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:scale-105 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(bonus)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
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
                    title={editTarget ? 'Edit Bonus' : 'Add Bonus'}
                    className="max-w-lg"
                    accent="pink"
                    icon={Gift}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={handleSave} disabled={isSaveDisabled} className="font-rethink">
                                {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Bonus'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => {
                                    const hasBank = employeeHasBank(employees, emp.employee_id);
                                    return (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.employee_name}
                                            {emp.employee_id_number ? ` (${emp.employee_id_number})` : ''}
                                            {!hasBank ? ' · ⚠ no bank' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {form.employee_id && !employeeHasBank(employees, form.employee_id) && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                                <Bell className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-rethink space-y-1">
                                    <p className="font-semibold">Bank details not set up</p>
                                    <p>This employee has no bank account on file. Set up their bank details before adding a bonus.</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Payroll Run <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={form.payroll_run_id}
                                onChange={(e) => setForm((f) => ({ ...f, payroll_run_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="">Select payroll run…</option>
                                {payrollRuns.map((run: any) => (
                                    <option key={run.id} value={run.id}>
                                        {new Date(run.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(run.period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ({run.status})
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-[10px] text-muted font-rethink">
                                Bonus will be counted on this payroll run.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bonus Type</label>
                            <select
                                value={form.bonus_type}
                                onChange={(e) => setForm((f) => ({ ...f, bonus_type: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                {BONUS_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bonus % (optional)</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.bonus_percentage}
                                    onChange={(e) => setForm((f) => ({ ...f, bonus_percentage: e.target.value }))}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                rows={2}
                                placeholder="Reason or notes for this bonus"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
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
                    title="Delete Bonus"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={confirmDelete} disabled={isDeleting} variant="danger" className="font-rethink">
                                {isDeleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the bonus for {deleteTarget.name}?
                        </p>
                    </div>
                </Modal>
            )}

            {isOtpOpen && (
                <OtpModal
                    isOpen={true}
                    onClose={() => {
                        setIsOtpOpen(false);
                        setPendingAction(null);
                    }}
                    onVerified={async (s) => {
                        unlock(s.scope || 'all', s.secondsLeft);

                        const action = pendingAction;
                        setPendingAction(null);
                        setIsOtpOpen(false);

                        if (action?.kind === 'save') {
                            await commitSave(action.payload, action.isEdit, action.editId);
                        } else if (action?.kind === 'delete') {
                            setDeleteTarget({ id: action.id, name: action.name });
                        }
                    }}
                    purpose={otpPurpose}
                    title={otpPurpose === 'bonus' ? 'Verify Bonus' : 'Verify Bonus Deletion'}
                    subtitle={
                        otpPurpose === 'bonus'
                            ? 'Enter the 6-digit code sent to your email to authorize this bonus.'
                            : 'Enter the 6-digit code sent to your email to authorize deleting this bonus.'
                    }
                    actionLabel={otpPurpose === 'bonus' ? 'bonus' : 'deletion'}
                />
            )}
        </div>
    );
};

export default BonusTab;