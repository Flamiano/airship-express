'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, PieChart, CheckCircle2,
    AlertTriangle, DollarSign, TrendingUp, Printer, FileSpreadsheet,
    RefreshCw, Bell, BarChart3,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { printTable, exportExcel, printFormatters, PrintColumn } from './print-utils';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const EMPTY_FORM = {
    month: new Date().getMonth() + 1,
    planned_amount: '',
    notes: '',
    status: 'draft',
};

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({
    icon: Icon, label, value, tint, subtitle,
}: {
    icon: React.ElementType;
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

type Row = {
    month: number;
    planned_amount: number;
    actual_amount: number;
    variance: number;
    variance_pct: number;
    is_over_budget: boolean;
    status: string | null;
    plan_id: string | null;
    notes: string | null;
    created_by_name: string | null;
    last_modified_by_name: string | null;
};

const BudgetPlanningManager = () => {
    const toast = useToast();
    const [rows, setRows] = useState<Row[]>([]);
    const [totals, setTotals] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Row | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/compensation/labor-budget'
    );

    const lineChartRef = useRef<HTMLCanvasElement | null>(null);
    const lineChartInstanceRef = useRef<Chart | null>(null);
    const radarChartRef = useRef<HTMLCanvasElement | null>(null);
    const radarChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        loadData();
    }, [selectedYear]);

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

    const overBudgetMonths = useMemo(
        () => rows.filter((r) => r.is_over_budget),
        [rows]
    );

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(
            (r) =>
                MONTHS[r.month - 1].toLowerCase().includes(term) ||
                (r.notes || '').toLowerCase().includes(term) ||
                (r.status || '').toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    const openCreate = () => {
        setEditTarget(null);
        setForm({ ...EMPTY_FORM, month: new Date().getMonth() + 1 });
        setIsModalOpen(true);
    };

    const openEdit = (row: Row) => {
        setEditTarget(row);
        setForm({
            month: row.month,
            planned_amount: String(row.planned_amount || ''),
            notes: row.notes || '',
            status: row.status || 'draft',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.planned_amount) {
            toast.showError('Planned amount is required');
            return;
        }
        setIsSaving(true);
        try {
            await postData('', {
                fiscal_year: selectedYear,
                month: form.month,
                planned_amount: Number(form.planned_amount) || 0,
                notes: form.notes.trim() || null,
                status: form.status,
            });
            toast.showSuccess(
                editTarget ? 'Labor budget updated' : 'Labor budget planned'
            );
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            setEditTarget(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save labor budget');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget?.plan_id) {
            toast.showError('No plan to delete for this month');
            setDeleteTarget(null);
            return;
        }
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.plan_id}`);
            toast.showSuccess('Labor plan deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
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
                    {
                        label: 'Planned',
                        data: planned,
                        borderColor: '#2455c7',
                        backgroundColor: 'rgba(36,85,199,0.10)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#2455c7',
                    },
                    {
                        label: 'Actual',
                        data: actual,
                        borderColor: '#e5167e',
                        backgroundColor: 'rgba(229,22,126,0.10)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#e5167e',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 12,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                `${ctx.dataset.label}: ₱${Number(
                                    ctx.raw || 0
                                ).toLocaleString()}`,
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => `₱${Number(v).toLocaleString()}`,
                            color: '#6b6b76',
                            font: { size: 10 },
                        },
                        grid: { color: '#eaeaea' },
                    },
                    x: {
                        ticks: { color: '#1c1b1f', font: { size: 10 } },
                        grid: { display: false },
                    },
                },
            },
        });
        return () => { lineChartInstanceRef.current?.destroy(); };
    }, [rows, loading]);

    useEffect(() => {
        if (loading || !radarChartRef.current) return;
        radarChartInstanceRef.current?.destroy();

        const labels = MONTH_SHORT;
        const planned = rows.map((r) => r.planned_amount);
        const actual = rows.map((r) => r.actual_amount);

        radarChartInstanceRef.current = new Chart(radarChartRef.current, {
            type: 'radar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Planned',
                        data: planned,
                        borderColor: '#2455c7',
                        backgroundColor: 'rgba(36,85,199,0.18)',
                        borderWidth: 2,
                        pointBackgroundColor: '#2455c7',
                    },
                    {
                        label: 'Actual',
                        data: actual,
                        borderColor: '#e5167e',
                        backgroundColor: 'rgba(229,22,126,0.18)',
                        borderWidth: 2,
                        pointBackgroundColor: '#e5167e',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 12,
                            font: { size: 11 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                `${ctx.dataset.label}: ₱${Number(
                                    ctx.raw || 0
                                ).toLocaleString()}`,
                        },
                    },
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        angleLines: { color: '#eaeaea' },
                        grid: { color: '#eaeaea' },
                        pointLabels: {
                            color: '#1c1b1f',
                            font: { size: 10 },
                        },
                        ticks: {
                            display: false,
                            backdropColor: 'transparent',
                        },
                    },
                },
            },
        });
        return () => { radarChartInstanceRef.current?.destroy(); };
    }, [rows, loading]);

    const printColumns: PrintColumn[] = [
        { key: 'month', label: 'Month', format: (v) => MONTHS[v - 1] },
        { key: 'planned_amount', label: 'Planned', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'actual_amount', label: 'Actual', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'variance', label: 'Variance', align: 'right', format: (v) => printFormatters.peso(v) },
        {
            key: 'variance_pct',
            label: 'Variance %',
            align: 'right',
            format: (v) => `${Number(v || 0).toFixed(2)}%`,
        },
        {
            key: 'is_over_budget',
            label: 'Over Budget',
            format: (v) => (v ? 'Yes' : 'No'),
        },
        { key: 'status', label: 'Status', format: (v) => printFormatters.capitalize(v || '—') },
        { key: 'notes', label: 'Notes', format: (v) => printFormatters.text(v || '—') },
    ];

    const handlePrint = () => {
        if (filteredRows.length === 0) {
            toast.showError('No labor budget rows to print.');
            return;
        }
        printTable(
            {
                companyName: 'Airship Express',
                companyAddress: 'Binondo, Manila, Philippines',
                reportTitle: 'Monthly Labor Budget Plan',
                reportSubtitle: `Fiscal Year ${selectedYear}`,
                filters: {
                    'Total Planned': peso(totals?.total_planned || 0),
                    'Total Actual': peso(totals?.total_actual || 0),
                    'Months Over Budget': totals?.months_over || 0,
                },
                logoPath: '/images/logo-remove-bg.png',
            },
            printColumns,
            filteredRows
        );
    };

    const handleExport = () => {
        if (filteredRows.length === 0) {
            toast.showError('No labor budget rows to export.');
            return;
        }
        exportExcel(
            `labor-budget-${selectedYear}`,
            printColumns,
            filteredRows,
            {
                reportTitle: 'Monthly Labor Budget Plan',
                reportSubtitle: `Fiscal Year ${selectedYear}`,
            }
        );
        toast.showSuccess('Labor budget exported to Excel.');
    };

    return (
        <div className="space-y-5">
            {overBudgetMonths.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-800/30 dark:bg-red-950/20">
                    <Bell className="h-4 w-4 shrink-0 text-red-600 mt-0.5 animate-pulse" />
                    <div className="text-[12px] text-red-800 dark:text-red-300 font-rethink leading-relaxed">
                        <p className="font-semibold">
                            {overBudgetMonths.length} month
                            {overBudgetMonths.length === 1 ? '' : 's'} exceeded the labor budget
                        </p>
                        <p className="mt-1">
                            {overBudgetMonths
                                .map(
                                    (r) =>
                                        `${MONTHS[r.month - 1]} (+${peso(r.variance)})`
                                )
                                .join(', ')}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    icon={PieChart}
                    label="Total Planned"
                    value={peso(totals?.total_planned || 0)}
                    tint="blue"
                    subtitle={`${totals?.months_planned || 0} months planned`}
                />
                <StatCard
                    icon={DollarSign}
                    label="Total Actual"
                    value={peso(totals?.total_actual || 0)}
                    tint="amber"
                    subtitle="From processed payslips"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Overall Variance"
                    value={peso(totals?.variance || 0)}
                    tint={(totals?.variance || 0) > 0 ? 'red' : 'emerald'}
                    subtitle={`${Number(totals?.variance_pct || 0).toFixed(2)}%`}
                />
                <StatCard
                    icon={AlertTriangle}
                    label="Months Over Budget"
                    value={String(totals?.months_over || 0)}
                    tint={(totals?.months_over || 0) > 0 ? 'red' : 'emerald'}
                />
            </div>

            {!loading && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <Card
                        variant="default"
                        padding="none"
                        className="lg:col-span-3 bg-paper border-line overflow-hidden dark:border-line/30"
                    >
                        <CardBody className="p-4">
                            <div className="flex items-center gap-1.5 mb-3">
                                <BarChart3 className="h-3.5 w-3.5 text-accent" />
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    Planned vs Actual Labor — Monthly Trend
                                </p>
                            </div>
                            <div className="h-64">
                                <canvas ref={lineChartRef} />
                            </div>
                        </CardBody>
                    </Card>

                    <Card
                        variant="default"
                        padding="none"
                        className="lg:col-span-2 bg-paper border-line overflow-hidden dark:border-line/30"
                    >
                        <CardBody className="p-4">
                            <div className="flex items-center gap-1.5 mb-3">
                                <PieChart className="h-3.5 w-3.5 text-philhealth" />
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    Labor Coverage by Month
                                </p>
                            </div>
                            <div className="h-64">
                                <canvas ref={radarChartRef} />
                            </div>
                        </CardBody>
                    </Card>
                </div>
            )}

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Search
                        placeholder="Search month or notes..."
                        onSearch={setSearchTerm}
                        className="w-full md:max-w-xs"
                    />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-9 rounded-md border border-line bg-paper px-2.5 text-xs font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                    >
                        {[2023, 2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-slate-600 text-white hover:bg-slate-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <RefreshCw
                                className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''
                                    }`}
                            />
                            <span className="whitespace-nowrap leading-none">Refresh</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handlePrint}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Print</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handleExport}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Export</span>
                        </span>
                    </Button>
                    <Button
                        onClick={openCreate}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Plan Month</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card
                variant="default"
                padding="none"
                className="bg-paper border-line overflow-hidden dark:border-line/30"
            >
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
                        <p className="text-sm font-medium text-ink font-rethink">
                            No labor budget for {selectedYear}
                        </p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Click Plan Month to set a monthly labor budget.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Month
                                    </th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Planned
                                    </th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Actual
                                    </th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Variance
                                    </th>
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">
                                        Usage
                                    </th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Status
                                    </th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filteredRows.map((row) => {
                                        const hasPlan = row.planned_amount > 0;
                                        const usagePct = hasPlan
                                            ? Math.min(
                                                (row.actual_amount /
                                                    row.planned_amount) *
                                                100,
                                                150
                                            )
                                            : 0;
                                        const overBudget = row.is_over_budget;
                                        return (
                                            <motion.tr
                                                key={row.month}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className={`group border-b border-line last:border-b-0 transition-colors ${overBudget
                                                        ? 'bg-red-50/40 hover:bg-red-50/60 dark:bg-red-950/10 dark:hover:bg-red-950/20'
                                                        : 'hover:bg-ink/[0.025]'
                                                    }`}
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {overBudget && (
                                                            <Bell className="h-3.5 w-3.5 shrink-0 text-red-500 animate-pulse" />
                                                        )}
                                                        <div>
                                                            <p className="text-[13px] font-medium text-ink font-rethink">
                                                                {MONTHS[row.month - 1]}
                                                            </p>
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                FY {selectedYear}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    {hasPlan ? (
                                                        <span className="text-[13px] font-mono font-semibold tabular-nums text-ink">
                                                            {peso(row.planned_amount)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">
                                                            Not planned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span
                                                        className={`text-[13px] font-mono font-semibold tabular-nums ${overBudget
                                                                ? 'text-red-600'
                                                                : 'text-ink'
                                                            }`}
                                                    >
                                                        {peso(row.actual_amount)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    {hasPlan ? (
                                                        <span
                                                            className={`text-[12px] font-mono font-semibold ${overBudget
                                                                    ? 'text-red-600'
                                                                    : row.variance > 0
                                                                        ? 'text-amber-600'
                                                                        : 'text-emerald-600'
                                                                }`}
                                                        >
                                                            {row.variance > 0 ? '+' : ''}
                                                            {peso(row.variance)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 hidden lg:table-cell align-middle">
                                                    {hasPlan ? (
                                                        <div className="w-32">
                                                            <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${overBudget
                                                                            ? 'bg-red-500'
                                                                            : usagePct > 80
                                                                                ? 'bg-amber-500'
                                                                                : 'bg-emerald-500'
                                                                        }`}
                                                                    style={{
                                                                        width: `${Math.min(
                                                                            usagePct,
                                                                            100
                                                                        )}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <p className="mt-1 text-[10px] text-muted font-mono">
                                                                {usagePct.toFixed(1)}%
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    {overBudget ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800/40">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                                            Over Budget
                                                        </span>
                                                    ) : hasPlan ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium capitalize text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {row.status || 'Planned'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700">
                                                            No Plan
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEdit(row)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:scale-105 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        {hasPlan && (
                                                            <button
                                                                onClick={() => setDeleteTarget(row)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
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
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={
                        editTarget && editTarget.planned_amount > 0
                            ? `Edit ${MONTHS[form.month - 1]} Budget`
                            : `Plan ${MONTHS[form.month - 1]} Budget`
                    }
                    className="max-w-md"
                    accent="pink"
                    icon={PieChart}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="font-rethink"
                            >
                                {isSaving
                                    ? 'Saving…'
                                    : editTarget && editTarget.planned_amount > 0
                                        ? 'Save Changes'
                                        : 'Save Plan'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Month
                            </label>
                            <select
                                value={form.month}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        month: Number(e.target.value),
                                    }))
                                }
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>
                                        {m} {selectedYear}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Planned Labor Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.planned_amount}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        planned_amount: e.target.value,
                                    }))
                                }
                                placeholder="0.00"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-mono text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                            <p className="mt-1 text-[10px] text-muted font-rethink">
                                Total gross payroll you allow for this month.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, status: e.target.value }))
                                }
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="approved">Approved</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Notes
                            </label>
                            <textarea
                                value={form.notes}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, notes: e.target.value }))
                                }
                                rows={2}
                                placeholder="e.g. Includes holiday premium budget"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Labor Budget"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                variant="danger"
                                className="font-rethink"
                            >
                                {isDeleting ? 'Deleting…' : 'Delete Plan'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the {MONTHS[deleteTarget.month - 1]} {selectedYear} labor
                            budget plan?
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BudgetPlanningManager;