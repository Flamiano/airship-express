'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, PieChart, CheckCircle2, XCircle,
    AlertTriangle, Wallet2, TrendingUp, Printer, FileSpreadsheet,
    RefreshCw, Bell, BarChart3, Send, ShieldCheck, Lock,
    FileText, UserCircle2, MessageSquareWarning,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { printTable, exportExcel, printFormatters, PrintColumn } from './print-utils';

const PAGE_SIZE = 8;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type BudgetStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'rejected' | 'closed';

type Row = {
    id: string | null;
    plan_id: string | null;
    month: number;
    planned_amount: number;
    actual_amount: number;
    remaining: number;
    overspend: number;
    usage_pct: number;
    is_over_budget: boolean;
    status: BudgetStatus | null;
    notes: string | null;
    rejection_reason: string | null;
    created_by_name: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
    rejected_by_name: string | null;
    rejected_at: string | null;
    submitted_for_approval_at: string | null;
    last_modified_by_name: string | null;
};

const EMPTY_FORM = {
    month: new Date().getMonth() + 1,
    planned_amount: '',
    notes: '',
};

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, tint, subtitle }: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray' | 'red';
    subtitle?: string;
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

function StatusBadge({ status }: { status: BudgetStatus | null }) {
    if (!status) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700">
                No Plan
            </span>
        );
    }
    const map: Record<BudgetStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string; size?: number; title?: string }> }> = {
        draft: { label: 'Draft', cls: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700', icon: FileText },
        pending_approval: { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40', icon: Send },
        approved: { label: 'Approved', cls: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-800/40', icon: ShieldCheck },
        active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40', icon: Lock },
        rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40', icon: XCircle },
        closed: { label: 'Closed', cls: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:ring-slate-700', icon: CheckCircle2 },
    };
    const { label, cls, icon: Icon } = map[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${cls}`}>
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

const BudgetPlanningManager = () => {
    const toast = useToast();
    const [rows, setRows] = useState<Row[]>([]);
    const [totals, setTotals] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Row | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [submitTarget, setSubmitTarget] = useState<Row | null>(null);
    const [activateTarget, setActivateTarget] = useState<Row | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [detailTarget, setDetailTarget] = useState<Row | null>(null);

    const { fetchData, postData, patchData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/compensation/labor-budget'
    );

    const lineChartRef = useRef<HTMLCanvasElement | null>(null);
    const lineChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => { loadData(); }, [selectedYear]);

    const loadData = async (manualRefresh = false) => {
        if (manualRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res: any = await fetchData(`?fiscal_year=${selectedYear}`);
            setRows(Array.isArray(res?.rows) ? res.rows : []);
            setTotals(res?.totals || null);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load labor budget');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedYear]);

    const overBudgetMonths = useMemo(() => rows.filter((r) => r.is_over_budget), [rows]);
    const pendingApprovalCount = useMemo(
        () => rows.filter((r) => r.status === 'pending_approval').length,
        [rows]
    );
    const rejectedCount = useMemo(
        () => rows.filter((r) => r.status === 'rejected').length,
        [rows]
    );
    const approvedAwaitingActivation = useMemo(
        () => rows.filter((r) => r.status === 'approved').length,
        [rows]
    );

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(
            (r) =>
                MONTHS[r.month - 1].toLowerCase().includes(term) ||
                (r.notes || '').toLowerCase().includes(term) ||
                (r.status || '').toLowerCase().includes(term) ||
                (r.created_by_name || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRows.slice(start, start + PAGE_SIZE);
    }, [filteredRows, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

    const openCreate = () => {
        setEditTarget(null);
        setForm({ ...EMPTY_FORM, month: new Date().getMonth() + 1 });
        setIsModalOpen(true);
    };

    const openEdit = (row: Row) => {
        if (row.status && !['draft', 'rejected'].includes(row.status)) {
            toast.showError('Only draft or rejected budgets can be edited.');
            return;
        }
        setEditTarget(row);
        setForm({
            month: row.month,
            planned_amount: String(row.planned_amount || ''),
            notes: row.notes || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.planned_amount || Number(form.planned_amount) <= 0) {
            toast.showError('Planned amount must be greater than zero.');
            return;
        }
        setIsSaving(true);
        try {
            await postData('', {
                fiscal_year: selectedYear,
                month: form.month,
                planned_amount: Number(form.planned_amount) || 0,
                notes: form.notes.trim() || null,
            });
            toast.showSuccess(editTarget ? 'Budget draft updated' : 'Budget draft created');
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            setEditTarget(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save budget');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget?.plan_id) { toast.showError('No plan to delete'); setDeleteTarget(null); return; }
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.plan_id}`);
            toast.showSuccess('Budget deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmSubmit = async () => {
        if (!submitTarget?.plan_id) return;
        setIsProcessing(true);
        try {
            await patchData(`/${submitTarget.plan_id}`, { action: 'submit' });
            toast.showSuccess(`${MONTHS[submitTarget.month - 1]} budget sent to Financial for approval.`);
            setSubmitTarget(null);
            loadData();
        } catch (e: any) {
            toast.showError(e?.message || 'Failed to submit');
        } finally { setIsProcessing(false); }
    };

    const confirmActivate = async () => {
        if (!activateTarget?.plan_id) return;
        setIsProcessing(true);
        try {
            await patchData(`/${activateTarget.plan_id}`, { action: 'activate' });
            toast.showSuccess(`${MONTHS[activateTarget.month - 1]} budget is now ACTIVE and enforced.`);
            setActivateTarget(null);
            loadData();
        } catch (e: any) {
            toast.showError(e?.message || 'Failed to activate');
        } finally { setIsProcessing(false); }
    };

    useEffect(() => {
        if (loading || !lineChartRef.current) return;
        lineChartInstanceRef.current?.destroy();
        const labels = rows.map((r) => MONTH_SHORT[r.month - 1]);
        const planned = rows.map((r) => r.planned_amount);
        const actual = rows.map((r) => r.actual_amount);
        lineChartInstanceRef.current = new Chart(lineChartRef.current, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Planned Budget', data: planned, borderColor: '#2455c7', backgroundColor: 'rgba(36,85,199,0.10)', borderWidth: 2, tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#2455c7' },
                    { label: 'Actual Payroll', data: actual, borderColor: '#e5167e', backgroundColor: 'rgba(229,22,126,0.10)', borderWidth: 2, tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#e5167e' },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ₱${Number(ctx.raw || 0).toLocaleString()}` } },
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (v) => `₱${Number(v).toLocaleString()}`, color: '#6b6b76', font: { size: 10 } }, grid: { color: '#eaeaea' } },
                    x: { ticks: { color: '#1c1b1f', font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
        return () => { lineChartInstanceRef.current?.destroy(); };
    }, [rows, loading]);

    const printColumns: PrintColumn[] = [
        { key: 'month', label: 'Month', format: (v) => MONTHS[v - 1] },
        { key: 'planned_amount', label: 'Planned Budget', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'actual_amount', label: 'Actual Payroll', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'remaining', label: 'Remaining', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'usage_pct', label: 'Usage %', align: 'right', format: (v) => `${Number(v || 0).toFixed(2)}%` },
        { key: 'is_over_budget', label: 'Over Budget', format: (v) => (v ? 'Yes' : 'No') },
        { key: 'status', label: 'Status', format: (v) => printFormatters.capitalize((v || '—').replace('_', ' ')) },
        { key: 'approved_by_name', label: 'Approved By', format: (v) => printFormatters.text(v || '—') },
        { key: 'rejected_by_name', label: 'Rejected By', format: (v) => printFormatters.text(v || '—') },
        { key: 'rejection_reason', label: 'Rejection Reason', format: (v) => printFormatters.text(v || '—') },
        { key: 'notes', label: 'Notes', format: (v) => printFormatters.text(v || '—') },
    ];

    const handlePrint = () => {
        if (filteredRows.length === 0) { toast.showError('No budget rows to print.'); return; }
        printTable(
            {
                companyName: 'Airship Express',
                companyAddress: 'Binondo, Manila, Philippines',
                reportTitle: 'Monthly Labor Budget Plan',
                reportSubtitle: `Fiscal Year ${selectedYear}`,
                filters: {
                    'Total Planned': peso(totals?.total_planned || 0),
                    'Total Actual': peso(totals?.total_actual || 0),
                    'Total Remaining': peso(totals?.total_remaining || 0),
                    'Months Over Budget': totals?.months_over || 0,
                },
                logoPath: '/images/logo-remove-bg.png',
            },
            printColumns,
            filteredRows
        );
    };

    const handleExport = () => {
        if (filteredRows.length === 0) { toast.showError('No budget rows to export.'); return; }
        exportExcel(`labor-budget-${selectedYear}`, printColumns, filteredRows, {
            reportTitle: 'Monthly Labor Budget Plan',
            reportSubtitle: `Fiscal Year ${selectedYear}`,
        });
        toast.showSuccess('Labor budget exported to Excel.');
    };

    return (
        <div className="space-y-5">
            {pendingApprovalCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-800/30 dark:bg-amber-950/20">
                    <Bell className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 animate-pulse" />
                    <div className="text-[12px] text-amber-800 dark:text-amber-300 font-rethink leading-relaxed">
                        <p className="font-semibold">
                            {pendingApprovalCount} budget{pendingApprovalCount === 1 ? '' : 's'} awaiting Financial approval
                        </p>
                        <p className="mt-0.5">
                            Financial will review and either approve or reject each submitted budget.
                        </p>
                    </div>
                </div>
            )}

            {approvedAwaitingActivation > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-800/30 dark:bg-blue-950/20">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                    <div className="text-[12px] text-blue-800 dark:text-blue-300 font-rethink leading-relaxed">
                        <p className="font-semibold">
                            {approvedAwaitingActivation} budget{approvedAwaitingActivation === 1 ? '' : 's'} approved by Financial
                        </p>
                        <p className="mt-0.5">
                            Click Activate on the approved months to enforce the cap on payroll runs.
                        </p>
                    </div>
                </div>
            )}

            {rejectedCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-800/30 dark:bg-red-950/20">
                    <MessageSquareWarning className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="text-[12px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                        <p className="font-semibold">
                            {rejectedCount} budget{rejectedCount === 1 ? '' : 's'} rejected by Financial
                        </p>
                        <p className="mt-0.5">Open the rejected months to see the reason, revise, and resubmit.</p>
                    </div>
                </div>
            )}

            {overBudgetMonths.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-800/30 dark:bg-red-950/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="text-[12px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                        <p className="font-semibold">
                            {overBudgetMonths.length} month{overBudgetMonths.length === 1 ? '' : 's'} exceeded the approved budget
                        </p>
                        <p className="mt-1">
                            {overBudgetMonths.map((r) => `${MONTHS[r.month - 1]} (+${peso(r.overspend)})`).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={PieChart} label="Total Planned" value={peso(totals?.total_planned || 0)} tint="blue" subtitle={`${totals?.months_planned || 0} months planned`} />
                <StatCard icon={Wallet2} label="Total Actual" value={peso(totals?.total_actual || 0)} tint="amber" subtitle="From processed payslips" />
                <StatCard icon={TrendingUp} label="Budget Remaining" value={peso(totals?.total_remaining || 0)} tint={(totals?.total_remaining || 0) >= 0 ? 'emerald' : 'red'} subtitle="Planned − Actual" />
                <StatCard icon={ShieldCheck} label="Pending Approval" value={String(pendingApprovalCount)} tint={pendingApprovalCount > 0 ? 'amber' : 'emerald'} subtitle="Waiting for Financial" />
            </div>

            {!loading && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <BarChart3 className="h-3.5 w-3.5 text-accent" />
                            <p className="text-xs font-semibold text-ink font-rethink">Planned Budget vs Actual Payroll — Monthly Trend</p>
                        </div>
                        <div className="h-64"><canvas ref={lineChartRef} /></div>
                    </CardBody>
                </Card>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <Search placeholder="Search month, status, or creator..." onSearch={setSearchTerm} className="w-full md:max-w-xs" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        title="Filter by fiscal year"
                        className="h-9 rounded-md border border-line bg-paper px-2.5 text-xs font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        title="Reload budget data from the server"
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-slate-600 text-white hover:bg-slate-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="whitespace-nowrap leading-none">Refresh</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handlePrint}
                        title="Print the labor budget report"
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 shrink-0" /><span className="whitespace-nowrap leading-none">Print</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handleExport}
                        title="Export labor budget as Excel file"
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" /><span className="whitespace-nowrap leading-none">Export</span>
                        </span>
                    </Button>
                    <Button
                        onClick={openCreate}
                        title="Create a new monthly labor budget draft"
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" /><span className="whitespace-nowrap leading-none">Plan Month</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Alert
                variant="info"
                message="Workflow: You create a Draft → Submit it for Financial approval → Financial approves or rejects (with reason) → You activate the approved budget. Once Active, payroll runs are capped at the planned amount."
            />

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading labor budget…
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                            <PieChart className="h-6 w-6 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No labor budget for {selectedYear}</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Click Plan Month to set a monthly labor budget.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Month</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Planned</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actual</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Remaining</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Usage</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden xl:table-cell">Approved By</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRows.map((row) => {
                                            const hasPlan = row.planned_amount > 0;
                                            const overBudget = row.is_over_budget;
                                            const remaining = row.remaining;
                                            const isRejected = row.status === 'rejected';
                                            return (
                                                <motion.tr
                                                    key={row.month}
                                                    layout
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className={`group border-b border-line last:border-b-0 transition-colors ${overBudget
                                                            ? 'bg-red-50/40 hover:bg-red-50/60 dark:bg-red-950/10 dark:hover:bg-red-950/20'
                                                            : isRejected
                                                                ? 'bg-red-50/20 hover:bg-red-50/40 dark:bg-red-950/5 dark:hover:bg-red-950/15'
                                                                : 'hover:bg-ink/[0.025]'
                                                        }`}
                                                >
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {overBudget && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                                                            <div>
                                                                <p className="text-[13px] font-medium text-ink font-rethink">{MONTHS[row.month - 1]}</p>
                                                                <p className="text-[10px] text-muted font-rethink">FY {selectedYear}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        {hasPlan ? (
                                                            <span className="text-[13px] font-mono font-semibold tabular-nums text-ink">{peso(row.planned_amount)}</span>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">Not planned</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        <span className={`text-[13px] font-mono font-semibold tabular-nums ${overBudget ? 'text-red-600' : 'text-ink'}`}>
                                                            {peso(row.actual_amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        {hasPlan ? (
                                                            <span className={`text-[13px] font-mono font-semibold tabular-nums ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-amber-600' : 'text-emerald-600'
                                                                }`}>
                                                                {peso(remaining)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 hidden lg:table-cell align-middle">
                                                        {hasPlan ? (
                                                            <div className="w-32">
                                                                <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : row.usage_pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                                            }`}
                                                                        style={{ width: `${Math.min(row.usage_pct, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <p className="mt-1 text-[10px] text-muted font-mono">{row.usage_pct.toFixed(1)}%</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center whitespace-nowrap">
                                                        <StatusBadge status={row.status} />
                                                    </td>
                                                    <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap">
                                                        {row.approved_by_name ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink font-rethink">
                                                                <UserCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                                                                <span className="truncate">{row.approved_by_name}</span>
                                                            </span>
                                                        ) : row.rejected_by_name ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-red-600 font-rethink">
                                                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                                <span className="truncate">{row.rejected_by_name}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setDetailTarget(row)}
                                                                title="View full budget details and approval trail"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                                aria-label="View details"
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </button>

                                                            {(!row.status || ['draft', 'rejected'].includes(row.status)) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => openEdit(row)}
                                                                        title="Edit this budget draft"
                                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:scale-105 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                                                        aria-label="Edit"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    {row.plan_id && (
                                                                        <button
                                                                            onClick={() => setSubmitTarget(row)}
                                                                            disabled={isProcessing}
                                                                            title="Submit this draft to Financial for approval"
                                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 transition-all hover:bg-indigo-100 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-400"
                                                                            aria-label="Submit for approval"
                                                                        >
                                                                            <Send className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                                    {row.plan_id && (
                                                                        <button
                                                                            onClick={() => setDeleteTarget(row)}
                                                                            title="Delete this budget draft"
                                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                                            aria-label="Delete"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {row.status === 'approved' && (
                                                                <button
                                                                    onClick={() => setActivateTarget(row)}
                                                                    disabled={isProcessing}
                                                                    title="Activate this approved budget to enforce the payroll cap"
                                                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition-all hover:bg-emerald-100 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                                    aria-label="Activate"
                                                                >
                                                                    <Lock className="h-3 w-3" /> Activate
                                                                </button>
                                                            )}
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
                                {paginatedRows.map((row) => {
                                    const hasPlan = row.planned_amount > 0;
                                    const overBudget = row.is_over_budget;
                                    const isRejected = row.status === 'rejected';
                                    return (
                                        <motion.div
                                            key={row.month}
                                            layout
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className={`rounded-lg border p-3.5 dark:border-line/30 ${overBudget
                                                    ? 'border-red-200 bg-red-50/40 dark:border-red-800/30 dark:bg-red-950/10'
                                                    : isRejected
                                                        ? 'border-red-200 bg-red-50/20 dark:border-red-800/30 dark:bg-red-950/5'
                                                        : 'border-line'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-ink font-rethink">{MONTHS[row.month - 1]}</p>
                                                    <p className="text-[10px] text-muted font-rethink">FY {selectedYear}</p>
                                                </div>
                                                <StatusBadge status={row.status} />
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="rounded-md bg-blue-50 px-2 py-1.5 dark:bg-blue-950/30">
                                                    <p className="text-[9px] uppercase tracking-wide text-blue-600">Planned</p>
                                                    <p className="font-mono font-semibold text-blue-700 dark:text-blue-400">{peso(row.planned_amount)}</p>
                                                </div>
                                                <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                    <p className="text-[9px] uppercase tracking-wide text-muted">Actual</p>
                                                    <p className="font-mono text-ink">{peso(row.actual_amount)}</p>
                                                </div>
                                                <div className={`rounded-md px-2 py-1.5 ${row.remaining < 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                                                    <p className={`text-[9px] uppercase tracking-wide ${row.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Remaining</p>
                                                    <p className={`font-mono font-semibold ${row.remaining < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                                        {peso(row.remaining)}
                                                    </p>
                                                </div>
                                                <div className="rounded-md bg-purple-50 px-2 py-1.5 dark:bg-purple-950/30">
                                                    <p className="text-[9px] uppercase tracking-wide text-purple-600">Usage</p>
                                                    <p className="font-mono font-semibold text-purple-700 dark:text-purple-400">{row.usage_pct.toFixed(1)}%</p>
                                                </div>
                                            </div>

                                            {isRejected && row.rejection_reason && (
                                                <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
                                                    <p className="text-[9px] uppercase tracking-wide text-red-600 font-rethink">Rejection Reason</p>
                                                    <p className="text-[11px] text-red-800 dark:text-red-300 font-rethink mt-0.5">{row.rejection_reason}</p>
                                                </div>
                                            )}

                                            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-line/30">
                                                <button
                                                    onClick={() => setDetailTarget(row)}
                                                    title="View full budget details and approval trail"
                                                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                >
                                                    <FileText className="h-3 w-3" /> Details
                                                </button>
                                                <div className="flex gap-1.5">
                                                    {(!row.status || ['draft', 'rejected'].includes(row.status)) && row.plan_id && (
                                                        <>
                                                            <button
                                                                onClick={() => openEdit(row)}
                                                                title="Edit this budget draft"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSubmitTarget(row)}
                                                                title="Submit this draft to Financial for approval"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-400"
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(row)}
                                                                title="Delete this budget draft"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {row.status === 'approved' && (
                                                        <button
                                                            onClick={() => setActivateTarget(row)}
                                                            title="Activate this approved budget to enforce the payroll cap"
                                                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={PAGE_SIZE} totalItems={filteredRows.length} />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editTarget ? `Edit ${MONTHS[form.month - 1]} Budget Draft` : `Plan ${MONTHS[form.month - 1]} Budget`}
                    className="max-w-md" accent="pink" icon={PieChart}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                title="Close without saving"
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                title="Save as draft"
                                className="font-rethink"
                            >
                                {isSaving ? 'Saving…' : 'Save Draft'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <Alert variant="info" message="This is saved as a DRAFT. Use the Submit button in the table to send it to Financial for approval." />
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Month</label>
                            <select
                                value={form.month}
                                onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                                title="Select the month to plan"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {selectedYear}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Planned Labor Amount</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.planned_amount}
                                onChange={(e) => setForm((f) => ({ ...f, planned_amount: e.target.value }))}
                                placeholder="0.00"
                                title="Total gross payroll allowed for this month"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-mono text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                            <p className="mt-1 text-[10px] text-muted font-rethink">Total gross payroll you allow for this month.</p>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Notes (optional)</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                rows={2}
                                placeholder="e.g. Includes holiday premium budget"
                                title="Optional notes for Financial reviewer"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {submitTarget && (
                <Modal
                    isOpen={!!submitTarget}
                    onClose={() => setSubmitTarget(null)}
                    title="Submit for Financial Approval"
                    className="max-w-md" accent="pink" icon={Send}
                    footer={
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setSubmitTarget(null)}
                                disabled={isProcessing}
                                title="Cancel submission"
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmSubmit}
                                disabled={isProcessing}
                                title="Send this budget to Financial for approval"
                                className="font-rethink"
                            >
                                {isProcessing ? 'Submitting…' : 'Submit to Financial'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <p className="text-sm text-ink font-rethink">
                            Submit the <strong>{MONTHS[submitTarget.month - 1]} {selectedYear}</strong> labor budget of{' '}
                            <strong>{peso(submitTarget.planned_amount)}</strong> to Financial?
                        </p>
                        <p className="text-xs text-muted font-rethink">
                            Once submitted, you can no longer edit it until Financial approves or rejects it.
                        </p>
                    </div>
                </Modal>
            )}

            {activateTarget && (
                <Modal
                    isOpen={!!activateTarget}
                    onClose={() => setActivateTarget(null)}
                    title="Activate Budget"
                    className="max-w-md" accent="pink" icon={Lock}
                    footer={
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setActivateTarget(null)}
                                disabled={isProcessing}
                                title="Cancel activation"
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmActivate}
                                disabled={isProcessing}
                                title="Enforce this budget on all future payroll runs this month"
                                className="font-rethink"
                            >
                                {isProcessing ? 'Activating…' : 'Activate Budget'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <p className="text-sm text-ink font-rethink">
                            Activate the <strong>{MONTHS[activateTarget.month - 1]} {selectedYear}</strong> budget of{' '}
                            <strong>{peso(activateTarget.planned_amount)}</strong>?
                        </p>
                        <p className="text-xs text-muted font-rethink">
                            Once active, any payroll run for this month will be capped at the planned amount.
                        </p>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Budget Draft"
                    className="max-w-md" accent="red" icon={AlertTriangle}
                    footer={
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                title="Cancel deletion"
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                title="Permanently delete this draft"
                                className="font-rethink"
                            >
                                {isDeleting ? 'Deleting…' : 'Delete Draft'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the {MONTHS[deleteTarget.month - 1]} {selectedYear} draft? This cannot be undone.
                        </p>
                    </div>
                </Modal>
            )}

            {detailTarget && (
                <Modal
                    isOpen={!!detailTarget}
                    onClose={() => setDetailTarget(null)}
                    title={`${MONTHS[detailTarget.month - 1]} ${selectedYear} Budget`}
                    className="max-w-lg" accent="pink" icon={PieChart}
                    footer={
                        <Button
                            variant="outline"
                            onClick={() => setDetailTarget(null)}
                            title="Close details"
                            className="font-rethink"
                        >
                            Close
                        </Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-ink font-rethink">Status</p>
                            <StatusBadge status={detailTarget.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-blue-200/40 bg-blue-50 p-3 dark:border-blue-800/30 dark:bg-blue-950/30">
                                <p className="text-[10px] uppercase tracking-wide text-blue-600 font-rethink">Planned Budget</p>
                                <p className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-400 mt-0.5">{peso(detailTarget.planned_amount)}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Actual Payroll</p>
                                <p className="text-sm font-mono font-semibold text-ink mt-0.5">{peso(detailTarget.actual_amount)}</p>
                            </div>
                            <div className={`rounded-lg border p-3 ${detailTarget.remaining < 0
                                    ? 'border-red-200/40 bg-red-50 dark:border-red-800/30 dark:bg-red-950/30'
                                    : 'border-emerald-200/40 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-950/30'
                                }`}>
                                <p className={`text-[10px] uppercase tracking-wide font-rethink ${detailTarget.remaining < 0 ? 'text-red-600' : 'text-emerald-600'
                                    }`}>Remaining</p>
                                <p className={`text-sm font-mono font-semibold mt-0.5 ${detailTarget.remaining < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                                    }`}>
                                    {peso(detailTarget.remaining)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-purple-200/40 bg-purple-50 p-3 dark:border-purple-800/30 dark:bg-purple-950/30">
                                <p className="text-[10px] uppercase tracking-wide text-purple-600 font-rethink">Usage</p>
                                <p className="text-sm font-mono font-semibold text-purple-700 dark:text-purple-400 mt-0.5">{detailTarget.usage_pct.toFixed(1)}%</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs">
                            {detailTarget.created_by_name && (
                                <div className="flex items-center justify-between rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:bg-ink/[0.05]">
                                    <span className="text-muted font-rethink">Created by</span>
                                    <span className="text-ink font-rethink">{detailTarget.created_by_name}</span>
                                </div>
                            )}
                            {detailTarget.submitted_for_approval_at && (
                                <div className="flex items-center justify-between rounded-lg border border-amber-200/40 bg-amber-50 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-950/30">
                                    <span className="text-amber-700 dark:text-amber-300 font-rethink">Submitted</span>
                                    <span className="text-amber-800 dark:text-amber-200 font-rethink">
                                        {printFormatters.date(detailTarget.submitted_for_approval_at)}
                                    </span>
                                </div>
                            )}
                            {detailTarget.approved_by_name && (
                                <div className="flex items-center justify-between rounded-lg border border-emerald-200/40 bg-emerald-50 px-3 py-2 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                    <span className="text-emerald-700 dark:text-emerald-300 font-rethink">Approved by</span>
                                    <span className="text-emerald-800 dark:text-emerald-200 font-rethink">
                                        {detailTarget.approved_by_name} · {printFormatters.date(detailTarget.approved_at || '')}
                                    </span>
                                </div>
                            )}
                            {detailTarget.rejected_by_name && (
                                <div className="rounded-lg border border-red-200/40 bg-red-50 p-3 dark:border-red-800/30 dark:bg-red-950/30">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] uppercase tracking-wide text-red-600 font-rethink">Rejected by</p>
                                        <p className="text-[11px] text-red-700 dark:text-red-300 font-rethink">
                                            {detailTarget.rejected_by_name} · {printFormatters.date(detailTarget.rejected_at || '')}
                                        </p>
                                    </div>
                                    <p className="text-xs text-red-800 dark:text-red-300 font-rethink mt-1.5">
                                        {detailTarget.rejection_reason || '—'}
                                    </p>
                                </div>
                            )}
                            {detailTarget.notes && (
                                <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                    <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Notes</p>
                                    <p className="text-xs text-ink font-rethink mt-0.5">{detailTarget.notes}</p>
                                </div>
                            )}
                            {detailTarget.last_modified_by_name && (
                                <div className="flex items-center justify-between rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:bg-ink/[0.05]">
                                    <span className="text-muted font-rethink">Last modified by</span>
                                    <span className="text-ink font-rethink">{detailTarget.last_modified_by_name}</span>
                                </div>
                            )}
                        </div>

                        {detailTarget.is_over_budget && (
                            <Alert
                                variant="error"
                                message={`This month is OVER budget by ${peso(detailTarget.overspend)}. Payroll runs may be blocked until the budget is amended.`}
                            />
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BudgetPlanningManager;