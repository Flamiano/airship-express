'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Landmark,
    Loader2,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

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

const EmployeePayrollInfoManager = () => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const { fetchData } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const recordsData = await fetchData();
            setRecords(recordsData || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.error(
                error?.message ||
                'Unable to load employee payroll information. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) =>
            (a.employee_name || '').localeCompare(b.employee_name || '')
        );
    }, [records]);

    const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedRecords.slice(start, start + PAGE_SIZE);
    }, [sortedRecords, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const activeCount = useMemo(
        () => records.filter((r) => r.is_active).length,
        [records]
    );
    const withBankCount = useMemo(
        () => records.filter((r) => r.has_complete_bank).length,
        [records]
    );
    const missingBankCount = useMemo(
        () => records.filter((r) => r.is_active && !r.has_complete_bank).length,
        [records]
    );

    const formatCurrency = (amount: number | null | undefined) =>
        `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line">
                    <Landmark className="h-4.5 w-4.5 text-ink/70" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">
                        Employee Payroll Information
                    </h3>
                    <p className="text-xs text-muted font-rethink">
                        {activeCount} active of {records.length} employee
                        {records.length === 1 ? '' : 's'} on record
                    </p>
                </div>
            </div>

            {missingBankCount > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5 dark:text-amber-400" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 font-rethink">
                            {missingBankCount} employee{missingBankCount === 1 ? ' has' : 's have'} incomplete bank information
                        </p>
                        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-rethink leading-snug mt-0.5">
                            Payroll processing is unavailable until all active employees have complete bank details on file. Please update the affected records in the <strong>Bank Accounts</strong> module.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                        <Landmark className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Active Payroll</p>
                        <p className="text-sm font-semibold font-mono tabular-nums text-ink">{activeCount}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">With Bank Details</p>
                        <p className="text-sm font-semibold font-mono tabular-nums text-ink">{withBankCount}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
                    <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${missingBankCount > 0
                                ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                            }`}
                    >
                        {missingBankCount > 0 ? (
                            <XCircle className="h-4.5 w-4.5" />
                        ) : (
                            <CheckCircle2 className="h-4.5 w-4.5" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Missing Bank Details</p>
                        <p
                            className={`text-sm font-semibold font-mono tabular-nums ${missingBankCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-ink'
                                }`}
                        >
                            {missingBankCount}
                        </p>
                    </div>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading employee payroll information…
                    </div>
                ) : records.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message="No employee payroll records are currently available. Please ensure that employees have been registered and payroll information has been configured before proceeding."
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Employee</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Position</th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Daily Rate</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Schedule</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Bank Details</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Attendance</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Status</th>
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
                                                className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015]"
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
                                                    {record.has_complete_bank ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            Complete
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            Missing
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium font-rethink ${ATTENDANCE_STATUS_STYLES[record.attendance_status] ||
                                                                'bg-gray-50 text-gray-400 border-gray-200'
                                                                }`}
                                                        >
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
                                                    {record.is_active ? (
                                                        <span className="text-xs font-medium text-emerald-700">Active</span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-muted">Inactive</span>
                                                    )}
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
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium font-rethink ${ATTENDANCE_STATUS_STYLES[record.attendance_status] ||
                                                    'bg-gray-50 text-gray-400 border-gray-200'
                                                    }`}
                                            >
                                                <Clock className="h-3 w-3" />
                                                {record.attendance_status || 'No record'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {record.has_complete_bank ? (
                                                    <span className="text-[10px] text-emerald-600">Bank OK</span>
                                                ) : (
                                                    <span className="text-[10px] text-red-600">No bank</span>
                                                )}
                                                {record.is_active ? (
                                                    <span className="text-xs font-medium text-emerald-700">Active</span>
                                                ) : (
                                                    <span className="text-xs font-medium text-muted">Inactive</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
};

export default EmployeePayrollInfoManager;