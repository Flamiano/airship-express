'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus, Eye, PlayCircle, Ban, Loader2, ClipboardList, AlertTriangle,
    Trash2, Send, Mail, ShieldCheck, FileText, Bell, MessageSquareWarning, UserCircle2,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi, ApiError } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';

const PAGE_SIZE = 8;

const APPROVAL_STYLES: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700' },
    pending_approval: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40' },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40' },
    distributed: { label: 'Distributed', cls: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-800/40' },
};

const PAY_SCHEDULE_LABELS: Record<string, string> = {
    monthly: 'Monthly', semi_monthly: 'Semi-monthly', weekly: 'Weekly', bi_weekly: 'Bi-Weekly',
};

const EMPTY_FORM = { period_start: '', period_end: '', pay_schedule: 'semi_monthly' };

const formatDate = (value: string) => {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return value; }
};

interface BankStatusProp { total_affected: number; }
interface PayrollRunManagerProps {
    onViewPayslips: (run: any) => void;
    bankStatus?: BankStatusProp | null;
    onOpenBankModal?: () => void;
}

function ApprovalBadge({ status }: { status: string | null }) {
    const s = status || 'draft';
    const conf = APPROVAL_STYLES[s] || APPROVAL_STYLES.draft;
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${conf.cls}`}>
            {conf.label}
        </span>
    );
}

const PayrollRunManager = ({ onViewPayslips, bankStatus, onOpenBankModal }: PayrollRunManagerProps) => {
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
    const [submitTarget, setSubmitTarget] = useState<any>(null);
    const [distributeTarget, setDistributeTarget] = useState<any>(null);
    const [distributeResult, setDistributeResult] = useState<any>(null);
    const [isDistributing, setIsDistributing] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [detailTarget, setDetailTarget] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const { fetchData, postData, putData, deleteData, patchData } = useApi('/payroll-benefits-dashboard/api/payroll/runs');

    useEffect(() => { loadRuns(); }, []);

    const loadRuns = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setRuns(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            toast.error(error?.message || 'Unable to load payroll runs.');
        } finally { setLoading(false); }
    };

    const handleNewRunClick = () => {
        const affected = bankStatus?.total_affected ?? 0;
        if (affected > 0) { onOpenBankModal?.(); return; }
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const handleCreate = async () => {
        if (!form.period_start || !form.period_end) { toast.error('Select both period dates.'); return; }
        if (new Date(form.period_start) > new Date(form.period_end)) { toast.error('Start must be before end.'); return; }
        setIsSaving(true);
        try {
            await postData('', form);
            toast.success('Payroll run created as draft.');
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            loadRuns();
        } catch (error: any) { toast.error(error?.message || 'Unable to create.'); }
        finally { setIsSaving(false); }
    };

    const confirmProcess = async () => {
        if (!processingTarget) return;
        setIsProcessing(true);
        try {
            await postData(`/${processingTarget.id}/process`, {});
            toast.success('Run processed. Payslips generated.');
            setProcessingTarget(null);
            loadRuns();
        } catch (error: any) {
            if (error instanceof ApiError && error.response?.employees_with_incomplete_bank) {
                const n = error.response.employees_with_incomplete_bank.length;
                toast.error(`${n} employee(s) missing bank info. Update Bank Accounts first.`, { duration: 8000 });
            } else {
                toast.error(error?.message || 'Unable to process.');
            }
        } finally { setIsProcessing(false); }
    };

    const confirmVoid = async () => {
        if (!voidTarget) return;
        setIsVoiding(true);
        try {
            await putData(`/${voidTarget.id}`, { status: 'voided' });
            toast.success('Run voided.');
            setVoidTarget(null);
            loadRuns();
        } catch (e: any) { toast.error(e?.message || 'Unable to void.'); }
        finally { setIsVoiding(false); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.success('Run deleted.');
            setDeleteTarget(null);
            loadRuns();
        } catch (e: any) { toast.error(e?.message || 'Unable to delete.'); }
        finally { setIsDeleting(false); }
    };

    const confirmSubmit = async () => {
        if (!submitTarget) return;
        setIsWorking(true);
        try {
            await patchData(`/${submitTarget.id}`, { action: 'submit' });
            toast.success('Run submitted to Financial.');
            setSubmitTarget(null);
            loadRuns();
        } catch (e: any) { toast.error(e?.message || 'Unable to submit.'); }
        finally { setIsWorking(false); }
    };

    const confirmDistribute = async () => {
        if (!distributeTarget) return;
        setIsDistributing(true);
        try {
            const res: any = await postData(`/${distributeTarget.id}/distribute`, {});
            setDistributeResult(res);
            toast.success(`Sent ${res.sent} payslip email(s).`);
            loadRuns();
        } catch (e: any) { toast.error(e?.message || 'Unable to distribute.'); }
        finally { setIsDistributing(false); }
    };

    const sortedRuns = useMemo(
        () => [...runs].sort((a, b) => new Date(b.period_start || 0).getTime() - new Date(a.period_start || 0).getTime()),
        [runs]
    );

    const totalPages = Math.max(1, Math.ceil(sortedRuns.length / PAGE_SIZE));
    const paginatedRuns = useMemo(() => sortedRuns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedRuns, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

    const formatCurrency = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const pendingCount = runs.filter((r) => r.approval_status === 'pending_approval').length;
    const approvedCount = runs.filter((r) => r.approval_status === 'approved').length;
    const rejectedCount = runs.filter((r) => r.approval_status === 'rejected').length;

    return (
        <div className="space-y-5">
            {pendingCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-800/30 dark:bg-amber-950/20">
                    <Bell className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 animate-pulse" />
                    <div className="text-[12px] text-amber-800 dark:text-amber-300 font-rethink leading-relaxed">
                        <p className="font-semibold">{pendingCount} run(s) awaiting Financial approval</p>
                        <p className="mt-0.5">Financial will review and approve or reject each submitted run.</p>
                    </div>
                </div>
            )}

            {approvedCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-800/30 dark:bg-emerald-950/20">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div className="text-[12px] text-emerald-800 dark:text-emerald-300 font-rethink leading-relaxed">
                        <p className="font-semibold">{approvedCount} approved run(s) ready to distribute</p>
                        <p className="mt-0.5">Click the mail icon on approved runs to email payslips.</p>
                    </div>
                </div>
            )}

            {rejectedCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-800/30 dark:bg-red-950/20">
                    <MessageSquareWarning className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="text-[12px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                        <p className="font-semibold">{rejectedCount} run(s) rejected by Financial</p>
                        <p className="mt-0.5">Open the detail modal to see the reason, revise, and resubmit.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                        <ClipboardList className="h-4.5 w-4.5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">Payroll Runs</h3>
                        <p className="text-xs text-muted font-rethink">{runs.length} run{runs.length === 1 ? '' : 's'} on record</p>
                    </div>
                </div>
                <Button onClick={handleNewRunClick} title="Create a new payroll run draft" className="shrink-0 font-rethink">
                    <span className="inline-flex flex-row items-center gap-1.5 whitespace-nowrap">
                        <Plus className="h-4 w-4 shrink-0" /><span>New Payroll Run</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" /> Loading payroll runs…
                    </div>
                ) : runs.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No payroll runs yet. Create one to begin." />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line">
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Period</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Schedule</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Approval</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Payslips</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Total Net</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRuns.map((run: any) => {
                                            const approval = run.approval_status || 'draft';
                                            const isDraft = run.status === 'draft';
                                            const isCompleted = run.status === 'completed';
                                            return (
                                                <motion.tr
                                                    key={run.id}
                                                    layout
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015]"
                                                >
                                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                                        <p className="text-sm font-medium text-ink font-rethink">
                                                            {formatDate(run.period_start)} – {formatDate(run.period_end)}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm text-ink/80 font-rethink whitespace-nowrap">
                                                        {PAY_SCHEDULE_LABELS[run.pay_schedule] || run.pay_schedule}
                                                    </td>
                                                    <td className="px-4 py-3.5 whitespace-nowrap"><ApprovalBadge status={approval} /></td>
                                                    <td className="px-4 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                        {run.payslip_count ?? 0}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                        {formatCurrency(run.total_net_pay ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => setDetailTarget(run)} title="View run details and approval trail"
                                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400">
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={() => onViewPayslips(run)} title="View payslips for this run"
                                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink/70 hover:bg-ink/5 transition-colors dark:border-line/30">
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </button>
                                                            {isDraft && (
                                                                <button onClick={() => setProcessingTarget(run)} title="Process the run to generate payslips"
                                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                                    <PlayCircle className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            {isCompleted && (approval === 'draft' || approval === 'rejected') && (
                                                                <button onClick={() => setSubmitTarget(run)} title="Submit this run to Financial for approval"
                                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors dark:border-indigo-800/30 dark:bg-indigo-950/30 dark:text-indigo-400">
                                                                    <Send className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            {approval === 'approved' && (
                                                                <button onClick={() => { setDistributeTarget(run); setDistributeResult(null); }} title="Distribute payslips via email to all employees"
                                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                                                                    <Mail className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            {(run.status === 'draft' || run.status === 'processing') && (
                                                                <button onClick={() => setVoidTarget(run)} title="Void this payroll run"
                                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400">
                                                                    <Ban className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            <button onClick={() => setDeleteTarget(run)} title="Delete this payroll run"
                                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400">
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

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedRuns.map((run: any) => (
                                    <motion.div key={run.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-ink font-rethink">
                                                    {formatDate(run.period_start)} – {formatDate(run.period_end)}
                                                </p>
                                                <div className="mt-1"><ApprovalBadge status={run.approval_status} /></div>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold text-ink whitespace-nowrap">
                                                {formatCurrency(run.total_net_pay ?? 0)}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-2.5 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => onViewPayslips(run)} title="View payslips">
                                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                                            </Button>
                                            {run.status === 'draft' && (
                                                <Button size="sm" variant="outline" onClick={() => setProcessingTarget(run)} title="Process run">
                                                    <PlayCircle className="h-3.5 w-3.5 mr-1" /> Process
                                                </Button>
                                            )}
                                            {run.status === 'completed' && (run.approval_status === 'draft' || run.approval_status === 'rejected') && (
                                                <Button size="sm" variant="outline" onClick={() => setSubmitTarget(run)} title="Submit to Financial">
                                                    <Send className="h-3.5 w-3.5 mr-1" /> Submit
                                                </Button>
                                            )}
                                            {run.approval_status === 'approved' && (
                                                <Button size="sm" variant="outline" onClick={() => { setDistributeTarget(run); setDistributeResult(null); }} title="Distribute payslips">
                                                    <Mail className="h-3.5 w-3.5 mr-1" /> Distribute
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Payroll Run" className="max-w-lg" accent="blue" icon={ClipboardList}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} title="Cancel" className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button type="button" onClick={handleCreate} disabled={isSaving} title="Create the payroll run draft" className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Creating…' : 'Create Run'}
                            </Button>
                        </div>
                    }>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Period Start</label>
                                <input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                                    title="Select the period start date" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30" />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Period End</label>
                                <input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                                    title="Select the period end date" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30" />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Pay Schedule</label>
                            <select value={form.pay_schedule} onChange={(e) => setForm((f) => ({ ...f, pay_schedule: e.target.value }))}
                                title="Select the pay schedule" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30">
                                <option value="monthly">Monthly</option>
                                <option value="semi_monthly">Semi-monthly</option>
                                <option value="weekly">Weekly</option>
                                <option value="bi_weekly">Bi-Weekly</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {processingTarget && (
                <Modal isOpen={!!processingTarget} onClose={() => setProcessingTarget(null)} title="Process Payroll Run" className="max-w-md" accent="green" icon={PlayCircle}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button variant="outline" onClick={() => setProcessingTarget(null)} disabled={isProcessing} title="Cancel" className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button onClick={confirmProcess} disabled={isProcessing} title="Generate payslips for this run" className="w-full sm:w-auto font-rethink">
                                {isProcessing ? 'Processing…' : 'Process Run'}
                            </Button>
                        </div>
                    }>
                    <div className="space-y-3">
                        <p className="text-sm text-ink font-rethink">
                            Generate payslips for <strong>{formatDate(processingTarget.period_start)} – {formatDate(processingTarget.period_end)}</strong>?
                        </p>
                        <Alert variant="warning" message="All active employees must have complete bank details before processing." />
                    </div>
                </Modal>
            )}

            {submitTarget && (
                <Modal isOpen={!!submitTarget} onClose={() => setSubmitTarget(null)} title="Submit to Financial" className="max-w-md" accent="pink" icon={Send}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button variant="outline" onClick={() => setSubmitTarget(null)} disabled={isWorking} title="Cancel submission" className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button onClick={confirmSubmit} disabled={isWorking} title="Send this run to Financial for approval" className="w-full sm:w-auto font-rethink">
                                {isWorking ? 'Submitting…' : 'Submit to Financial'}
                            </Button>
                        </div>
                    }>
                    <p className="text-sm text-ink font-rethink">
                        Submit the run for <strong>{formatDate(submitTarget.period_start)} – {formatDate(submitTarget.period_end)}</strong> to Financial for review?
                    </p>
                </Modal>
            )}

            {distributeTarget && (
                <Modal isOpen={!!distributeTarget} onClose={() => { setDistributeTarget(null); setDistributeResult(null); }} title="Distribute Payslips" className="max-w-lg" accent="pink" icon={Mail}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button variant="outline" onClick={() => { setDistributeTarget(null); setDistributeResult(null); }} disabled={isDistributing} title="Close" className="w-full sm:w-auto font-rethink">
                                {distributeResult ? 'Close' : 'Cancel'}
                            </Button>
                            {!distributeResult && (
                                <Button onClick={confirmDistribute} disabled={isDistributing} title="Send payslip emails to all employees" className="w-full sm:w-auto font-rethink">
                                    {isDistributing ? 'Sending…' : 'Send to All Employees'}
                                </Button>
                            )}
                        </div>
                    }>
                    {!distributeResult ? (
                        <div className="space-y-3">
                            <p className="text-sm text-ink font-rethink">
                                Email payslips to all {distributeTarget.payslip_count || 'employees'} for{' '}
                                <strong>{formatDate(distributeTarget.period_start)} – {formatDate(distributeTarget.period_end)}</strong>?
                            </p>
                            <Alert variant="info" message="Each employee gets a link to their payslip. They will enter a 6-digit birthdate password (MMDDYY) before viewing." />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-emerald-200/40 bg-emerald-50 p-3 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                    <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-rethink">Sent</p>
                                    <p className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-400">{distributeResult.sent}</p>
                                </div>
                                <div className={`rounded-lg border p-3 ${distributeResult.failed > 0 ? 'border-red-200/40 bg-red-50 dark:border-red-800/30 dark:bg-red-950/30' : 'border-line bg-ink/[0.02]'}`}>
                                    <p className={`text-[10px] uppercase tracking-wide font-rethink ${distributeResult.failed > 0 ? 'text-red-600' : 'text-muted'}`}>Failed</p>
                                    <p className={`text-lg font-mono font-semibold ${distributeResult.failed > 0 ? 'text-red-700 dark:text-red-400' : 'text-ink'}`}>{distributeResult.failed}</p>
                                </div>
                            </div>
                            <Alert variant="info" message="A summary report has been emailed to you." />
                        </div>
                    )}
                </Modal>
            )}

            {voidTarget && (
                <Modal isOpen={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void Payroll Run" className="max-w-md" accent="red" icon={AlertTriangle}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={isVoiding} title="Cancel" className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button variant="danger" onClick={confirmVoid} disabled={isVoiding} title="Void this run" className="w-full sm:w-auto font-rethink">
                                {isVoiding ? 'Voiding…' : 'Void Run'}
                            </Button>
                        </div>
                    }>
                    <p className="text-sm text-ink font-rethink">
                        Void the run for <strong>{formatDate(voidTarget.period_start)} – {formatDate(voidTarget.period_end)}</strong>? This cannot be undone.
                    </p>
                </Modal>
            )}

            {deleteTarget && (
                <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Payroll Run" className="max-w-md" accent="red" icon={AlertTriangle}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} title="Cancel" className="w-full sm:w-auto font-rethink">Cancel</Button>
                            <Button variant="danger" onClick={confirmDelete} disabled={isDeleting} title="Permanently delete the run and its payslips" className="w-full sm:w-auto font-rethink">
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }>
                    <p className="text-sm text-red-800 dark:text-red-300 font-rethink">
                        Delete the run for <strong>{formatDate(deleteTarget.period_start)} – {formatDate(deleteTarget.period_end)}</strong>? All payslips and distribution logs will be deleted. This cannot be undone.
                    </p>
                </Modal>
            )}

            {detailTarget && (
                <Modal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} title={`Run — ${formatDate(detailTarget.period_start)} to ${formatDate(detailTarget.period_end)}`} className="max-w-lg" accent="pink" icon={ClipboardList}
                    footer={<Button variant="outline" onClick={() => setDetailTarget(null)} title="Close" className="font-rethink">Close</Button>}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-ink font-rethink">Approval Status</span>
                            <ApprovalBadge status={detailTarget.approval_status} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Payslips</p>
                                <p className="text-sm font-mono font-semibold text-ink mt-0.5">{detailTarget.payslip_count ?? 0}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200/40 bg-emerald-50 p-3 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-rethink">Total Net Pay</p>
                                <p className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    {formatCurrency(detailTarget.total_net_pay ?? 0)}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2 text-xs">
                            {detailTarget.submitted_for_approval_at && (
                                <div className="flex items-center justify-between rounded-lg border border-amber-200/40 bg-amber-50 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-950/30">
                                    <span className="text-amber-700 dark:text-amber-300 font-rethink">Submitted</span>
                                    <span className="text-amber-800 dark:text-amber-200 font-rethink">{formatDate(detailTarget.submitted_for_approval_at)}</span>
                                </div>
                            )}
                            {detailTarget.approved_by_name && (
                                <div className="flex items-center justify-between rounded-lg border border-emerald-200/40 bg-emerald-50 px-3 py-2 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                    <span className="text-emerald-700 dark:text-emerald-300 font-rethink">Approved by</span>
                                    <span className="text-emerald-800 dark:text-emerald-200 font-rethink">
                                        {detailTarget.approved_by_name} · {formatDate(detailTarget.approved_at || '')}
                                    </span>
                                </div>
                            )}
                            {detailTarget.rejected_by_name && (
                                <div className="rounded-lg border border-red-200/40 bg-red-50 p-3 dark:border-red-800/30 dark:bg-red-950/30">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] uppercase tracking-wide text-red-600 font-rethink">Rejected by</p>
                                        <p className="text-[11px] text-red-700 dark:text-red-300 font-rethink">
                                            {detailTarget.rejected_by_name} · {formatDate(detailTarget.rejected_at || '')}
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-800 dark:text-red-300 font-rethink mt-1.5">{detailTarget.rejection_reason}</p>
                                </div>
                            )}
                            {detailTarget.distributed_at && (
                                <div className="flex items-center justify-between rounded-lg border border-blue-200/40 bg-blue-50 px-3 py-2 dark:border-blue-800/30 dark:bg-blue-950/30">
                                    <span className="text-blue-700 dark:text-blue-300 font-rethink">Distributed</span>
                                    <span className="text-blue-800 dark:text-blue-200 font-rethink">
                                        {formatDate(detailTarget.distributed_at)} · {detailTarget.distributed_by_name}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PayrollRunManager;