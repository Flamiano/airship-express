'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Eye, PlayCircle, Ban, Loader2, ClipboardList, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    processing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    approved: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
    voided: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
};

const PAY_SCHEDULE_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    semi_monthly: 'Semi-monthly',
    weekly: 'Weekly',
    bi_weekly: 'Bi-Weekly',
};

const EMPTY_FORM = { period_start: '', period_end: '', pay_schedule: 'semi_monthly' };

const formatDate = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

interface PayrollRunManagerProps {
    onViewPayslips: (run: any) => void;
}

const PayrollRunManager = ({ onViewPayslips }: PayrollRunManagerProps) => {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [processingTarget, setProcessingTarget] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [voidTarget, setVoidTarget] = useState<any>(null);
    const [isVoiding, setIsVoiding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/payroll/runs');

    useEffect(() => {
        loadRuns();
    }, []);

    const loadRuns = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setRuns(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error("Load runs error:", error);
            toast.error(error?.message || 'Failed to load payroll runs');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.period_start || !form.period_end) {
            toast.error('Set both a period start and end date');
            return;
        }

        if (new Date(form.period_start) > new Date(form.period_end)) {
            toast.error('Period start must be before period end');
            return;
        }

        setIsSaving(true);
        try {
            await postData('', form);
            toast.success('Payroll run created as draft');
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            loadRuns();
        } catch (error: any) {
            console.error("Create error:", error);
            toast.error(error?.message || 'Failed to create payroll run');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmProcess = async () => {
        if (!processingTarget) return;
        setIsProcessing(true);
        try {
            await postData(`/${processingTarget.id}/process`, {});
            toast.success('Payroll run processed — payslips generated');
            setProcessingTarget(null);
            loadRuns();
        } catch (error: any) {
            console.error("Process error:", error);
            toast.error(error?.message || 'Failed to process payroll run');
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmVoid = async () => {
        if (!voidTarget) return;
        setIsVoiding(true);
        try {
            await putData(`/${voidTarget.id}`, { status: 'voided' });
            toast.success('Payroll run voided');
            setVoidTarget(null);
            loadRuns();
        } catch (error: any) {
            console.error("Void error:", error);
            toast.error(error?.message || 'Failed to void payroll run');
        } finally {
            setIsVoiding(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            // Just call DELETE - backend will handle voiding if needed
            await deleteData(`/${deleteTarget.id}`);
            toast.success('Payroll run deleted successfully');
            setDeleteTarget(null);
            loadRuns();
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error(error?.message || 'Failed to delete payroll run');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteClick = (run: any) => {
        setDeleteTarget(run);
    };

    const sortedRuns = useMemo(() => {
        return [...runs].sort((a, b) => {
            if (!a.period_start || !b.period_start) return 0;
            return new Date(b.period_start).getTime() - new Date(a.period_start).getTime();
        });
    }, [runs]);

    const totalPages = Math.max(1, Math.ceil(sortedRuns.length / PAGE_SIZE));

    const paginatedRuns = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedRuns.slice(start, start + PAGE_SIZE);
    }, [sortedRuns, currentPage]);

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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                        <ClipboardList className="h-4.5 w-4.5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">Payroll Runs</h3>
                        <p className="text-xs text-muted font-rethink">
                            {runs.length} run{runs.length === 1 ? '' : 's'} on record
                        </p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="shrink-0 font-rethink">
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Payroll Run
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading payroll runs…
                    </div>
                ) : runs.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No payroll runs yet. Create one to start processing payslips." />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line bg-paper dark:border-line/30">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Period
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Schedule
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Status
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Payslips
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Total Net Pay
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRuns.map((run: any) => (
                                            <motion.tr
                                                key={run.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015] dark:border-line/30 dark:hover:bg-ink/[0.05]"
                                            >
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <p className="text-sm font-medium text-ink font-rethink">
                                                        {formatDate(run.period_start)} – {formatDate(run.period_end)}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-ink/80 font-rethink whitespace-nowrap">
                                                    {PAY_SCHEDULE_LABELS[run.pay_schedule] || run.pay_schedule}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize font-rethink ${STATUS_STYLES[run.status] || 'bg-ink/5 text-ink/70 border-line dark:bg-ink/10 dark:border-line/30'
                                                        }`}>
                                                        {run.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    {run.payslip_count ?? 0}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {formatCurrency(run.total_net_pay ?? 0)}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => onViewPayslips(run)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink/70 hover:bg-ink/5 transition-colors dark:border-line/30"
                                                            aria-label="View payslips"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {run.status === 'draft' && (
                                                            <button
                                                                onClick={() => setProcessingTarget(run)}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 transition-colors dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                                                aria-label="Process payroll run"
                                                            >
                                                                <PlayCircle className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {(run.status === 'draft' || run.status === 'processing') && (
                                                            <button
                                                                onClick={() => setVoidTarget(run)}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                                                aria-label="Void payroll run"
                                                            >
                                                                <Ban className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {/* Delete button for ALL runs */}
                                                        <button
                                                            onClick={() => handleDeleteClick(run)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                                            aria-label="Delete payroll run"
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

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedRuns.map((run: any) => (
                                    <motion.div
                                        key={run.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-ink font-rethink">
                                                    {formatDate(run.period_start)} – {formatDate(run.period_end)}
                                                </p>
                                                <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[run.status] || 'bg-ink/5 text-ink/70 border-line dark:bg-ink/10 dark:border-line/30'
                                                    }`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                {formatCurrency(run.total_net_pay ?? 0)}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-2.5 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => onViewPayslips(run)} className="flex-1 min-w-[60px]">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                View
                                            </Button>
                                            {run.status === 'draft' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setProcessingTarget(run)}
                                                    className="flex-1 min-w-[60px] border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                                >
                                                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                                                    Process
                                                </Button>
                                            )}
                                            {(run.status === 'draft' || run.status === 'processing') && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setVoidTarget(run)}
                                                    className="flex-1 min-w-[60px] border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                                >
                                                    <Ban className="h-3.5 w-3.5 mr-1.5" />
                                                    Void
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDeleteClick(run)}
                                                className="flex-1 min-w-[60px] border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                Delete
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Create Modal */}
            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Payroll Run" className="max-w-lg">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Period Start</label>
                                <input
                                    type="date"
                                    value={form.period_start}
                                    onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Period End</label>
                                <input
                                    type="date"
                                    value={form.period_end}
                                    onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Pay Schedule</label>
                            <select
                                value={form.pay_schedule}
                                onChange={(e) => setForm((f) => ({ ...f, pay_schedule: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            >
                                <option value="monthly">Monthly</option>
                                <option value="semi_monthly">Semi-monthly</option>
                                <option value="weekly">Weekly</option>
                                <option value="bi_weekly">Bi-Weekly</option>
                            </select>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleCreate} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? (
                                    <>
                                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Creating…
                                    </>
                                ) : (
                                    'Create Run'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Process Confirmation Modal */}
            {processingTarget && (
                <Modal isOpen={!!processingTarget} onClose={() => setProcessingTarget(null)} title="Process Payroll Run" className="max-w-md">
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-4 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                            <PlayCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5 dark:text-emerald-400" />
                            <p className="text-sm text-emerald-800/90 font-rethink leading-relaxed dark:text-emerald-300/90">
                                Generate payslips for {formatDate(processingTarget.period_start)} – {formatDate(processingTarget.period_end)}?
                                This computes SSS, PhilHealth, and Pag-IBIG shares for every active employee based on their attendance.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setProcessingTarget(null)} disabled={isProcessing} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmProcess} disabled={isProcessing} className="w-full sm:w-auto font-rethink shadow-sm">
                                {isProcessing ? 'Processing…' : 'Process Run'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Void Confirmation Modal */}
            {voidTarget && (
                <Modal isOpen={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void Payroll Run" className="max-w-md">
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Void the run for {formatDate(voidTarget.period_start)} – {formatDate(voidTarget.period_end)}?
                                This will mark the run as voided and cannot be undone.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setVoidTarget(null)} disabled={isVoiding} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmVoid} disabled={isVoiding} className="w-full sm:w-auto font-rethink shadow-sm">
                                {isVoiding ? 'Voiding…' : 'Void Run'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Payroll Run" className="max-w-md">
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                    Delete the payroll run for {formatDate(deleteTarget.period_start)} – {formatDate(deleteTarget.period_end)}?
                                </p>
                                {deleteTarget.status !== 'draft' && (
                                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-rethink">
                                        ⚠️ This run is <strong>{deleteTarget.status}</strong>. It will be voided first, then permanently deleted.
                                    </p>
                                )}
                                <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                    This action <strong>cannot be undone</strong>. All payslips associated with this run will also be deleted.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto font-rethink shadow-sm">
                                {isDeleting ? (
                                    <>
                                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Deleting…
                                    </>
                                ) : (
                                    'Delete Permanently'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PayrollRunManager;