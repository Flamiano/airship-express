'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Landmark, Loader2, ToggleLeft, ToggleRight, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;

const PAY_SCHEDULE_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    semi_monthly: 'Semi-monthly',
    weekly: 'Weekly',
    bi_weekly: 'Bi-Weekly',
};

const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
    'On-Shift': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'On-Break': 'bg-amber-50 text-amber-700 border-amber-200',
    'Tardy': 'bg-red-50 text-red-700 border-red-200',
    'Absent': 'bg-gray-50 text-gray-600 border-gray-200',
    'No record': 'bg-gray-50 text-gray-400 border-gray-200',
};

const EMPTY_FORM = {
    employee_id: '',
    basic_salary: '',
    pay_schedule: 'semi_monthly',
    bank_name: '',
    bank_account_no: '',
};

const EmployeePayrollInfoManager = () => {
    const [records, setRecords] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState<any>(null);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { fetchData, postData, putData } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employees');

    useEffect(() => {
        loadRecords();
    }, []);

    const unassignedEmployees = useMemo(() => {
        const assignedIds = new Set(records.map((r) => r.employee_id));
        return employees.filter((e) => !assignedIds.has(e.id));
    }, [employees, records]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const [recordsData, employeesData] = await Promise.all([fetchData(), fetchEmployees()]);
            setRecords(recordsData || []);
            setEmployees(employeesData || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error("Load error:", error);
            toast.error(error?.message || 'Failed to load employee payroll info');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        if (unassignedEmployees.length === 0) {
            toast.error('Every employee already has payroll info on file');
            return;
        }
        setEditingRecord(null);
        setForm({ ...EMPTY_FORM, employee_id: unassignedEmployees[0].id });
        setIsModalOpen(true);
    };

    const openEdit = (record: any) => {
        setEditingRecord(record);
        setForm({
            employee_id: record.employee_id,
            basic_salary: String(record.basic_salary || ''),
            pay_schedule: record.pay_schedule || 'semi_monthly',
            bank_name: record.bank_name || '',
            bank_account_no: record.bank_account_no || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingRecord && !form.employee_id) {
            toast.error('Employee ID is required');
            return;
        }
        if (!form.basic_salary || Number(form.basic_salary) <= 0) {
            toast.error('Enter a valid basic salary');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                employee_id: form.employee_id,
                basic_salary: Number(form.basic_salary),
                pay_schedule: form.pay_schedule,
                bank_name: form.bank_name || null,
                bank_account_no: form.bank_account_no || null,
            };

            if (editingRecord) {
                await putData(`/${editingRecord.id}`, payload);
                toast.success('Payroll info updated');
            } else {
                await postData('', { ...payload, is_active: true });
                toast.success('Employee payroll info added');
            }
            setIsModalOpen(false);
            loadRecords();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error?.message || 'Failed to save payroll info');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (record: any) => {
        if (!record.id) {
            toast.error('Cannot update status - no payroll record found');
            return;
        }
        try {
            await putData(`/${record.id}`, { is_active: !record.is_active });
            toast.success(record.is_active ? 'Employee marked inactive' : 'Employee marked active');
            loadRecords();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to update status');
        }
    };

    const confirmDeactivate = async () => {
        if (!deactivateTarget) return;
        setIsDeactivating(true);
        try {
            await putData(`/${deactivateTarget.id}`, { is_active: false });
            toast.success('Employee removed from active payroll');
            setDeactivateTarget(null);
            loadRecords();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to deactivate employee');
        } finally {
            setIsDeactivating(false);
        }
    };

    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));
    }, [records]);

    const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedRecords.slice(start, start + PAGE_SIZE);
    }, [sortedRecords, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const formatCurrency = (amount: number) => {
        return `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line">
                        <Landmark className="h-4.5 w-4.5 text-ink/70" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">
                            Employee Payroll Information
                        </h3>
                        <p className="text-xs text-muted font-rethink">
                            {records.filter((r) => r.is_active).length} active of {records.length} employee
                            {records.length === 1 ? '' : 's'} on record
                        </p>
                    </div>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto shrink-0 font-rethink">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Employee
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-white border-line overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading employee payroll info…
                    </div>
                ) : records.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message={
                                employees.length === 0
                                    ? 'No employees found in hr1_employees yet — add employees first.'
                                    : 'No employee payroll info yet. Add an employee to start running payroll.'
                            }
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employee
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Position
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Daily Rate
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Schedule
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Attendance
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Status
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRecords.map((record: any) => (
                                            <motion.tr
                                                key={record.id || record.employee_id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015]"
                                            >
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <p className="text-sm font-medium text-ink font-rethink">
                                                        {record.employee_name || record.employee_id}
                                                    </p>
                                                    {record.employee_id_number && (
                                                        <p className="text-[11px] text-muted font-rethink">{record.employee_id_number}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-ink/80 font-rethink whitespace-nowrap">
                                                    {record.job_title || record.department || '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {formatCurrency(record.daily_rate || 0)}
                                                    <span className="text-[10px] text-muted font-rethink block">
                                                        {record.hours_per_day || 8}h / {record.break_hours || 1}h break
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-ink/80 font-rethink whitespace-nowrap">
                                                    {PAY_SCHEDULE_LABELS[record.pay_schedule] || '—'}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium font-rethink ${ATTENDANCE_STATUS_STYLES[record.attendance_status] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                            <Clock className="h-3 w-3" />
                                                            {record.attendance_status || 'No record'}
                                                        </span>
                                                        {record.attendance_count > 0 && (
                                                            <span className="text-[10px] text-muted font-rethink">
                                                                ({record.attendance_count} scans)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <button
                                                        onClick={() => toggleActive(record)}
                                                        className="flex items-center gap-1.5 text-xs font-medium font-rethink"
                                                        disabled={!record.id}
                                                    >
                                                        {record.is_active ? (
                                                            <>
                                                                <ToggleRight className="h-4 w-4 text-emerald-600" />
                                                                <span className="text-emerald-700">Active</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ToggleLeft className="h-4 w-4 text-muted" />
                                                                <span className="text-muted">Inactive</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openEdit(record)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                            aria-label="Edit employee payroll info"
                                                            disabled={!record.id}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedRecords.map((record: any) => (
                                    <motion.div
                                        key={record.id || record.employee_id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-ink font-rethink">
                                                    {record.employee_name || record.employee_id}
                                                </p>
                                                <p className="mt-1 text-[11px] text-muted font-rethink">
                                                    {record.job_title || record.department || '—'}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                {formatCurrency(record.daily_rate || 0)}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium font-rethink ${ATTENDANCE_STATUS_STYLES[record.attendance_status] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                <Clock className="h-3 w-3" />
                                                {record.attendance_status || 'No record'}
                                            </span>
                                            <button onClick={() => toggleActive(record)} className="flex items-center gap-1 text-xs font-medium">
                                                {record.is_active ? (
                                                    <span className="text-emerald-700">Active</span>
                                                ) : (
                                                    <span className="text-muted">Inactive</span>
                                                )}
                                            </button>
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEdit(record)}
                                                className="border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300"
                                                disabled={!record.id}
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                Edit
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editingRecord ? 'Edit Employee Payroll Info' : 'Add Employee Payroll Info'}
                    className="max-w-lg"
                >
                    <div className="space-y-4">
                        {!editingRecord && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                                <select
                                    value={form.employee_id}
                                    onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                                    className="w-full rounded-lg border border-line px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                                >
                                    {unassignedEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name} — {emp.position_title || emp.department} ({emp.employee_id_number})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {editingRecord && (
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-ink font-rethink">Employee</p>
                                <p className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-sm text-ink/80 font-rethink">
                                    {editingRecord.employee_name || editingRecord.employee_id}
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Basic Salary (Monthly)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.basic_salary}
                                onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))}
                                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-mono font-rethink text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                                placeholder="0.00"
                            />
                            <p className="mt-1 text-[10px] text-muted font-rethink">
                                This will be used as the monthly base salary. Daily rate will be computed automatically.
                            </p>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Pay Schedule</label>
                            <select
                                value={form.pay_schedule}
                                onChange={(e) => setForm((f) => ({ ...f, pay_schedule: e.target.value }))}
                                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                            >
                                <option value="monthly">Monthly</option>
                                <option value="semi_monthly">Semi-monthly</option>
                                <option value="weekly">Weekly</option>
                                <option value="bi_weekly">Bi-Weekly</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Bank Name</label>
                                <input
                                    type="text"
                                    value={form.bank_name}
                                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                                    className="w-full rounded-lg border border-line px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                                    placeholder="e.g. BDO"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Account No.</label>
                                <input
                                    type="text"
                                    value={form.bank_account_no}
                                    onChange={(e) => setForm((f) => ({ ...f, bank_account_no: e.target.value }))}
                                    className="w-full rounded-lg border border-line px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-ink/40 focus:ring-2 focus:ring-ink/10"
                                    placeholder="Account number"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? (
                                    <>
                                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {deactivateTarget && (
                <Modal
                    isOpen={!!deactivateTarget}
                    onClose={() => setDeactivateTarget(null)}
                    title="Remove From Active Payroll"
                    className="max-w-md"
                >
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed">
                                Mark {deactivateTarget.employee_name || 'this employee'} as inactive? They&apos;ll be excluded
                                from future payroll runs until reactivated.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)} disabled={isDeactivating} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmDeactivate} disabled={isDeactivating} className="w-full sm:w-auto font-rethink shadow-sm">
                                {isDeactivating ? 'Deactivating…' : 'Deactivate'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EmployeePayrollInfoManager;