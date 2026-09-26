'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Pencil,
    Users,
    RotateCcw,
    Loader2,
    Search,
    TrendingUp,
    Wallet,
    History,
    UserCircle2,
    Coins,
    Wallet2,
    Calendar,
    Clock3,
    Gift,
    Plus,
    X,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { IncentivesModal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/modules/payroll/JobPositionSettingsManager/components/IncentivesModal';
import type { EmployeePayrollInfoRow } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/types';
import { HistoryModal, ConfirmModal, StatCard, cssVar, formatCurrency, formatDate, calculateTenure } from './shared';

type EmployeeRow = EmployeePayrollInfoRow & { edited_by?: string | null };

const PAGE_SIZE = 8;

interface EmployeeRateForm {
    custom_daily_rate: string;
    reason: string;
}

const EMPTY_EMPLOYEE_FORM: EmployeeRateForm = {
    custom_daily_rate: '',
    reason: '',
};

interface AllowanceForm {
    id?: number;
    benefit_name: string;
    amount: string;
    frequency: string;
    is_taxable: boolean;
    effective_date: string;
    expiry_date: string;
    description: string;
}

const EMPTY_ALLOWANCE_FORM: AllowanceForm = {
    benefit_name: '',
    amount: '',
    frequency: 'monthly',
    is_taxable: true,
    effective_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    description: '',
};

const FREQUENCIES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semi_annual', label: 'Semi-Annual' },
    { value: 'annual', label: 'Annual' },
    { value: 'one_time', label: 'One Time' },
];

interface IncentiveListEntry {
    id: string;
    employee_id: string;
    employee_name: string;
    amount: number;
    description: string | null;
    created_at: string;
    period_start: string;
    period_end: string;
    is_active_now: boolean;
}

interface AllowanceEntry {
    id: number;
    employee_id: string;
    benefit_type: string;
    benefit_name: string;
    amount: number;
    frequency: string;
    is_taxable: boolean;
    is_active: boolean;
    effective_date: string;
    expiry_date: string | null;
    description: string | null;
    last_modified_by_name: string | null;
    updated_at: string;
}

const ByEmployee = () => {
    const [rows, setRows] = useState<EmployeeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState<EmployeeRow | null>(null);
    const [form, setForm] = useState<EmployeeRateForm>(EMPTY_EMPLOYEE_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [historyTitle, setHistoryTitle] = useState('');

    const [confirmResetRow, setConfirmResetRow] = useState<EmployeeRow | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    const [incentivesRow, setIncentivesRow] = useState<EmployeeRow | null>(null);

    const [allowancesModalOpen, setAllowancesModalOpen] = useState(false);
    const [allowancesEmployee, setAllowancesEmployee] = useState<EmployeeRow | null>(null);
    const [allowances, setAllowances] = useState<AllowanceEntry[]>([]);
    const [allowancesLoading, setAllowancesLoading] = useState(false);
    const [allowanceForm, setAllowanceForm] = useState<AllowanceForm>(EMPTY_ALLOWANCE_FORM);
    const [editingAllowance, setEditingAllowance] = useState<AllowanceEntry | null>(null);
    const [isSavingAllowance, setIsSavingAllowance] = useState(false);
    const [deletingAllowanceId, setDeletingAllowanceId] = useState<number | null>(null);

    const [incentiveEntries, setIncentiveEntries] = useState<IncentiveListEntry[]>([]);
    const [incentivesLoading, setIncentivesLoading] = useState(true);

    const { fetchData, putData, postData } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');
    const { fetchData: fetchHistory } = useApi('/payroll-benefits-dashboard/api/payroll/rate-history');
    const { fetchData: fetchAllIncentives } = useApi('/payroll-benefits-dashboard/api/payroll/incentives');
    const {
        fetchData: fetchAllowances,
        postData: postAllowance,
        putData: putAllowance,
        deleteData: deleteAllowance,
    } = useApi('/payroll-benefits-dashboard/api/compensation/employee-benefits');

    const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const donutCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const donutInstanceRef = useRef<Chart | null>(null);
    const incentivesChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const incentivesChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        loadRows();
        loadIncentiveEntries();
    }, []);

    const loadRows = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setRows(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.error(error?.message || 'Unable to load employee rates. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const loadIncentiveEntries = async () => {
        setIncentivesLoading(true);
        try {
            const data = await fetchAllIncentives();
            const list: IncentiveListEntry[] = data || [];
            setIncentiveEntries(
                list
                    .filter((e) => e.is_active_now)
                    .sort(
                        (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                    )
            );
        } catch (error: any) {
            console.error('Load incentives error:', error);
        } finally {
            setIncentivesLoading(false);
        }
    };

    const openHistory = async (row: EmployeeRow) => {
        setHistoryTitle(`Edit History — ${row.employee_name}`);
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const data = await fetchHistory(`?employee_id=${row.employee_id}`);
            setHistoryEntries(data || []);
        } catch (error: any) {
            toast.error(error?.message || 'Unable to load edit history. Please try again.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const openAllowances = async (row: EmployeeRow) => {
        setAllowancesEmployee(row);
        setAllowancesModalOpen(true);
        setAllowancesLoading(true);
        try {
            const data = await fetchAllowances(`?employee_id=${row.employee_id}`);
            setAllowances(data || []);
        } catch (error: any) {
            console.error('Load allowances error:', error);
            toast.error(error?.message || 'Unable to load allowances. Please try again.');
        } finally {
            setAllowancesLoading(false);
        }
    };

    const openEditAllowance = (allowance: AllowanceEntry) => {
        setEditingAllowance(allowance);
        setAllowanceForm({
            id: allowance.id,
            benefit_name: allowance.benefit_name,
            amount: String(allowance.amount),
            frequency: allowance.frequency,
            is_taxable: allowance.is_taxable,
            effective_date:
                allowance.effective_date?.split('T')[0] ||
                new Date().toISOString().split('T')[0],
            expiry_date: allowance.expiry_date?.split('T')[0] || '',
            description: allowance.description || '',
        });
    };

    const handleSaveAllowance = async () => {
        if (!allowanceForm.benefit_name.trim() || !allowanceForm.amount) {
            toast.error('Benefit name and amount are required.');
            return;
        }

        if (!allowancesEmployee) return;

        setIsSavingAllowance(true);
        try {
            const payload = {
                employee_id: allowancesEmployee.employee_id,
                benefit_type: 'allowance',
                benefit_name: allowanceForm.benefit_name.trim(),
                amount: Number(allowanceForm.amount) || 0,
                frequency: allowanceForm.frequency,
                is_taxable: allowanceForm.is_taxable,
                is_active: true,
                effective_date: allowanceForm.effective_date,
                expiry_date: allowanceForm.expiry_date || null,
                description: allowanceForm.description.trim() || null,
            };

            if (editingAllowance) {
                await putAllowance(`/${editingAllowance.id}`, payload);
                toast.success('Allowance has been updated successfully.');
            } else {
                await postAllowance('', payload);
                toast.success('Allowance has been added successfully.');
            }

            setAllowanceForm(EMPTY_ALLOWANCE_FORM);
            setEditingAllowance(null);
            await openAllowances(allowancesEmployee);
            loadRows();
        } catch (error: any) {
            console.error('Save allowance error:', error);
            toast.error(error?.message || 'Unable to save allowance. Please try again.');
        } finally {
            setIsSavingAllowance(false);
        }
    };

    const handleDeleteAllowance = async (id: number) => {
        setDeletingAllowanceId(id);
        try {
            await deleteAllowance(`/${id}`);
            toast.success('Allowance has been removed.');
            if (allowancesEmployee) {
                await openAllowances(allowancesEmployee);
                loadRows();
            }
        } catch (error: any) {
            console.error('Delete allowance error:', error);
            toast.error(error?.message || 'Unable to remove allowance. Please try again.');
        } finally {
            setDeletingAllowanceId(null);
        }
    };

    const filteredRows = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return rows.filter(
            (r) =>
                r.employee_name?.toLowerCase().includes(term) ||
                r.job_title?.toLowerCase().includes(term) ||
                r.department?.toLowerCase().includes(term)
        );
    }, [rows, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRows.slice(start, start + PAGE_SIZE);
    }, [filteredRows, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const customCount = useMemo(() => rows.filter((r) => r.has_custom_rate).length, [rows]);
    const totalIncentives = useMemo(
        () => rows.reduce((s, r) => s + (r.incentives || 0), 0),
        [rows]
    );
    const avgEffectiveRate = useMemo(
        () =>
            rows.length
                ? rows.reduce((s, r) => s + r.effective_daily_rate, 0) / rows.length
                : 0,
        [rows]
    );

    const topIncentiveRows = useMemo(
        () =>
            rows
                .filter((r) => (r.incentives || 0) > 0)
                .sort((a, b) => b.incentives - a.incentives)
                .slice(0, 8),
        [rows]
    );

    useEffect(() => {
        if (loading || !donutCanvasRef.current) return;
        donutInstanceRef.current?.destroy();
        donutInstanceRef.current = new Chart(donutCanvasRef.current, {
            type: 'doughnut',
            data: {
                labels: ['Custom Rate', 'Position Default'],
                datasets: [
                    {
                        data: [customCount, Math.max(rows.length - customCount, 0)],
                        backgroundColor: [
                            cssVar('--accent', '#e5167e'),
                            cssVar('--line', '#eaeaea'),
                        ],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
            },
        });
        return () => {
            donutInstanceRef.current?.destroy();
        };
    }, [rows, loading, customCount]);

    useEffect(() => {
        if (loading || !incentivesChartCanvasRef.current) return;
        incentivesChartInstanceRef.current?.destroy();
        if (topIncentiveRows.length === 0) return;

        incentivesChartInstanceRef.current = new Chart(incentivesChartCanvasRef.current, {
            type: 'bar',
            data: {
                labels: topIncentiveRows.map((r) => r.employee_name),
                datasets: [
                    {
                        data: topIncentiveRows.map((r) => r.incentives),
                        backgroundColor: cssVar('--philhealth', '#0b8f6b'),
                        borderRadius: 6,
                        barThickness: 18,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76') },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    y: {
                        ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } },
                        grid: { display: false },
                    },
                },
            },
        });
        return () => {
            incentivesChartInstanceRef.current?.destroy();
        };
    }, [topIncentiveRows, loading]);

    const openEdit = (row: EmployeeRow) => {
        setEditingRow(row);
        setForm({
            custom_daily_rate: row.custom_daily_rate ? String(row.custom_daily_rate) : '',
            reason: row.salary_adjustment_reason || '',
        });
        setIsModalOpen(true);
    };

    useEffect(() => {
        if (!isModalOpen || !editingRow || !chartCanvasRef.current) return;
        const proposedRate = Number(form.custom_daily_rate) || editingRow.position_daily_rate;

        chartInstanceRef.current?.destroy();
        chartInstanceRef.current = new Chart(chartCanvasRef.current, {
            type: 'bar',
            data: {
                labels: ['Position Rate', 'New Rate'],
                datasets: [
                    {
                        data: [editingRow.position_daily_rate, proposedRate],
                        backgroundColor: [
                            cssVar('--muted', '#6b6b76'),
                            proposedRate > editingRow.position_daily_rate
                                ? cssVar('--philhealth', '#0b8f6b')
                                : cssVar('--pagibig', '#b8720e'),
                        ],
                        borderRadius: 6,
                        barThickness: 40,
                    },
                ],
            },
            options: {
                responsive: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76') },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    x: { ticks: { color: cssVar('--ink', '#1c1b1f') }, grid: { display: false } },
                },
            },
        });
        return () => {
            chartInstanceRef.current?.destroy();
        };
    }, [isModalOpen, editingRow, form.custom_daily_rate]);

    const handleSave = async () => {
        if (!editingRow) return;
        const rate = Number(form.custom_daily_rate);
        if (form.custom_daily_rate && rate > 0 && !form.reason.trim()) {
            toast.warning('Please provide a reason for this custom rate (for example, tenure or performance).');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                employee_id: editingRow.employee_id,
                custom_daily_rate: rate > 0 ? rate : null,
                salary_adjustment_reason: rate > 0 ? form.reason.trim() : null,
            };

            await postData('', payload);
            toast.success('Employee rate has been saved successfully.');
            setIsModalOpen(false);
            loadRows();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error(error?.message || 'Unable to save employee rate. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmReset = async () => {
        if (!confirmResetRow) return;
        setIsResetting(true);
        try {
            if (confirmResetRow.id) {
                await putData(`/${confirmResetRow.id}`, { reset: true });
            } else {
                await postData('', {
                    employee_id: confirmResetRow.employee_id,
                    custom_daily_rate: null,
                    salary_adjustment_reason: null,
                });
            }
            toast.success('The employee has been reverted to the position default rate.');
            setConfirmResetRow(null);
            loadRows();
        } catch (error: any) {
            toast.error(error?.message || 'Unable to reset rate. Please try again.');
        } finally {
            setIsResetting(false);
        }
    };

    const totalMonthlyAllowances = useMemo(() => {
        return allowances
            .filter((a) => a.is_active && a.frequency === 'monthly')
            .reduce((sum, a) => sum + a.amount, 0);
    }, [allowances]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Users} label="Total Employees" value={String(rows.length)} tint="blue" />
                <StatCard icon={Wallet2} label="On Custom Rate" value={String(customCount)} tint="amber" />
                <StatCard icon={TrendingUp} label="Avg. Effective Rate" value={formatCurrency(avgEffectiveRate)} tint="purple" />
                <StatCard icon={Wallet} label="Active Incentives" value={formatCurrency(totalIncentives)} tint="emerald" />
            </div>

            <div className="flex items-center gap-2.5 bg-ink/[0.03] border border-line rounded-full pl-2 pr-3 py-1 w-fit transition-colors duration-300 dark:bg-ink/[0.06]">
                <canvas ref={donutCanvasRef} width={28} height={28} />
                <span className="text-[11px] font-rethink text-muted">
                    <span className="font-semibold text-ink">{customCount}</span> of {rows.length} on custom rates
                </span>
            </div>

            <div className="flex items-center gap-2 border border-line rounded-lg bg-paper px-3 shadow-sm transition-colors duration-300">
                <Search className="h-4 w-4 text-muted" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by employee name, position, or department…"
                    className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                <Card variant="default" padding="none" className="lg:col-span-2 bg-paper border-line overflow-hidden transition-colors duration-300">
                    <CardBody className="p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink font-rethink">
                            <TrendingUp className="h-3.5 w-3.5 text-philhealth" />
                            Top Incentives by Employee
                        </p>
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted font-rethink">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : topIncentiveRows.length === 0 ? (
                            <p className="py-10 text-center text-xs text-muted font-rethink">
                                No active incentives are currently recorded.
                            </p>
                        ) : (
                            <div className="h-56">
                                <canvas ref={incentivesChartCanvasRef} />
                            </div>
                        )}
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="lg:col-span-3 bg-paper border-line overflow-hidden transition-colors duration-300">
                    <CardBody className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink font-rethink">
                                <Coins className="h-3.5 w-3.5 text-philhealth" />
                                Employees with Active Incentives
                            </p>
                            <span className="text-[11px] text-muted font-rethink">
                                {incentiveEntries.length} active
                            </span>
                        </div>
                        {incentivesLoading ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted font-rethink">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading…
                            </div>
                        ) : incentiveEntries.length === 0 ? (
                            <p className="py-10 text-center text-xs text-muted font-rethink">
                                No employees currently have an active incentive.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {incentiveEntries.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => {
                                            const match = rows.find(
                                                (r) => r.employee_id === entry.employee_id
                                            );
                                            if (match) setIncentivesRow(match);
                                        }}
                                        className="w-full flex items-start justify-between gap-3 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-left transition-colors hover:bg-ink/[0.05] dark:bg-ink/[0.05]"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[12.5px] font-medium text-ink font-rethink truncate">
                                                {entry.employee_name}
                                            </p>
                                            <p className="text-[11px] text-muted font-rethink truncate">
                                                {entry.description || 'No reason provided'}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-muted/80 font-rethink">
                                                Granted {formatDate(entry.created_at)}
                                            </p>
                                        </div>
                                        <span className="shrink-0 font-mono font-semibold text-[13px] text-philhealth">
                                            {formatCurrency(entry.amount)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden transition-colors duration-300">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-muted" />
                        Loading employees…
                    </div>
                ) : filteredRows.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message={
                                rows.length === 0
                                    ? 'No employee payroll records are currently available.'
                                    : 'No employees match your search.'
                            }
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] transition-colors duration-300">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Position</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Custom Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Forecast M.Salary</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Allowances</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Incentives</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden xl:table-cell">Edited By</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRows.map((row) => (
                                            <motion.tr
                                                key={row.employee_id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.02]"
                                            >
                                                <td className="px-3 py-2.5 whitespace-nowrap max-w-[150px]">
                                                    <p className="text-[13px] font-medium text-ink font-rethink truncate">
                                                        {row.employee_name}
                                                    </p>
                                                    <p className="text-[10px] text-muted font-rethink">
                                                        {row.employee_id_number}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2.5 text-[13px] text-ink font-rethink whitespace-nowrap hidden md:table-cell max-w-[120px] truncate">
                                                    {row.job_title}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-ink whitespace-nowrap">
                                                    {formatCurrency(row.position_daily_rate)}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    {row.has_custom_rate ? (
                                                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-[13px] text-pagibig">
                                                            <Wallet2 className="h-3 w-3" />
                                                            {formatCurrency(row.custom_daily_rate)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted italic text-[12px]">
                                                            Default
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    <span className="font-mono font-semibold text-[13px] text-accent">
                                                        {formatCurrency(row.basic_salary)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap hidden lg:table-cell">
                                                    <button
                                                        onClick={() => openAllowances(row)}
                                                        className="text-[12px] font-mono tabular-nums text-blue-600 hover:underline flex items-center justify-end gap-1"
                                                    >
                                                        <Gift className="h-3 w-3" />
                                                        {row.incentives > 0 ? formatCurrency(row.incentives) : '—'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap hidden lg:table-cell">
                                                    <button
                                                        onClick={() => setIncentivesRow(row)}
                                                        className="text-[12px] font-mono tabular-nums text-philhealth hover:underline"
                                                    >
                                                        {row.incentives > 0 ? formatCurrency(row.incentives) : '—'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell max-w-[130px]">
                                                    {row.edited_by ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink font-rethink truncate">
                                                            <UserCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                                                            <span className="truncate">{row.edited_by}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-muted italic font-rethink">
                                                            Never edited
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => openHistory(row)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                            aria-label="View edit history"
                                                        >
                                                            <History className="h-3 w-3" />
                                                        </button>
                                                        {row.has_custom_rate && (
                                                            <button
                                                                onClick={() => setConfirmResetRow(row)}
                                                                className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                                aria-label="Reset to position default"
                                                            >
                                                                <RotateCcw className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openEdit(row)}
                                                            className="inline-flex items-center rounded-md border border-accent/20 bg-accent/5 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
                                                        >
                                                            <Pencil className="h-3 w-3 mr-1" />
                                                            {row.has_custom_rate ? 'Edit' : 'Custom'}
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
                            <div className="border-t border-line px-3 py-3 transition-colors duration-300">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredRows.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && editingRow && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={
                        <div className="flex flex-row items-center gap-3 min-w-0">
                            <span className="text-base font-semibold whitespace-nowrap truncate">
                                Customize Rate — {editingRow.employee_name}
                            </span>
                        </div>
                    }
                    className="max-w-lg"
                    accent="pink"
                    icon={Wallet2}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full sm:w-auto font-rethink"
                            >
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
                    }
                >
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-rethink text-muted">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Hired: {formatDate(editingRow.date_hired)}
                            </span>
                            <span className="text-muted/30">•</span>
                            <span className="inline-flex items-center gap-1 bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-medium">
                                <Clock3 className="h-3 w-3" />
                                {calculateTenure(editingRow.date_hired)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-ink font-rethink">Position</p>
                                <p className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-sm text-ink font-rethink dark:bg-ink/[0.05]">
                                    {editingRow.job_title}
                                </p>
                            </div>
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-ink font-rethink">Position Rate</p>
                                <p className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 text-sm font-mono text-ink dark:bg-ink/[0.05]">
                                    {formatCurrency(editingRow.position_daily_rate)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Custom Daily Rate
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={form.custom_daily_rate}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, custom_daily_rate: e.target.value }))
                                }
                                placeholder={String(editingRow.position_daily_rate)}
                                className="font-mono"
                            />
                            <p className="mt-1 text-[10px] text-muted font-rethink">
                                Leave blank to use the position default.
                            </p>
                        </div>

                        {Number(form.custom_daily_rate) > 0 && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                    Reason for adjustment <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={form.reason}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, reason: e.target.value }))
                                    }
                                    placeholder="For example: increased due to five years of tenure and consistent performance ratings."
                                    rows={3}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none focus:ring-2 focus:ring-accent/30"
                                />
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setIncentivesRow(editingRow)}
                            className="w-full flex items-center justify-between rounded-lg border border-philhealth/20 bg-philhealth-soft px-3.5 py-2.5 text-left transition-colors hover:brightness-95"
                        >
                            <span className="flex items-center gap-2 text-sm font-medium text-philhealth font-rethink">
                                <Coins className="h-4 w-4" />
                                Manage Incentives
                            </span>
                            <span className="text-sm font-mono font-semibold text-philhealth">
                                {editingRow.incentives > 0
                                    ? formatCurrency(editingRow.incentives)
                                    : 'None active'}
                            </span>
                        </button>

                        <div className="flex flex-col items-center rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                            <canvas ref={chartCanvasRef} width={260} height={140} />
                        </div>

                        {Number(form.custom_daily_rate) > 0 && (
                            <div className="rounded-lg bg-accent/5 border border-accent/20 dark:bg-accent/10 dark:border-accent/30 p-3 flex items-center justify-between">
                                <p className="text-xs font-medium text-accent font-rethink">
                                    New Basic Salary (Monthly)
                                </p>
                                <p className="text-sm font-mono font-semibold text-accent">
                                    {formatCurrency(Number(form.custom_daily_rate) * 24)}
                                </p>
                            </div>
                        )}

                        {editingRow.edited_by && (
                            <p className="text-[11px] text-muted font-rethink">
                                Last edited by{' '}
                                <span className="text-ink font-medium">{editingRow.edited_by}</span>
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            {allowancesModalOpen && allowancesEmployee && (
                <Modal
                    isOpen={allowancesModalOpen}
                    onClose={() => {
                        setAllowancesModalOpen(false);
                        setAllowancesEmployee(null);
                        setEditingAllowance(null);
                        setAllowanceForm(EMPTY_ALLOWANCE_FORM);
                    }}
                    title={`Allowances — ${allowancesEmployee.employee_name}`}
                    className="max-w-lg"
                    accent="blue"
                    icon={Gift}
                >
                    <div className="space-y-4">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/30 dark:bg-blue-950/30">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-blue-800 dark:text-blue-400 font-rethink">
                                    Total Monthly Allowances
                                </span>
                                <span className="text-sm font-mono font-semibold text-blue-800 dark:text-blue-400">
                                    {formatCurrency(totalMonthlyAllowances)}
                                </span>
                            </div>
                            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-rethink mt-0.5">
                                Base salary is calculated separately as Daily Rate × 24.
                            </p>
                        </div>

                        <div className="rounded-lg border border-line bg-ink/[0.02] p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-ink font-rethink">
                                    {editingAllowance ? 'Edit Allowance' : 'Add Allowance'}
                                </p>
                                {editingAllowance && (
                                    <button
                                        onClick={() => {
                                            setEditingAllowance(null);
                                            setAllowanceForm({
                                                ...EMPTY_ALLOWANCE_FORM,
                                                effective_date: new Date().toISOString().split('T')[0],
                                            });
                                        }}
                                        className="text-xs text-muted hover:text-ink transition-colors"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Benefit Name
                                    </label>
                                    <Input
                                        type="text"
                                        value={allowanceForm.benefit_name}
                                        onChange={(e) =>
                                            setAllowanceForm((f) => ({
                                                ...f,
                                                benefit_name: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Transportation Allowance"
                                        className="text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Amount
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={allowanceForm.amount}
                                        onChange={(e) =>
                                            setAllowanceForm((f) => ({ ...f, amount: e.target.value }))
                                        }
                                        placeholder="0.00"
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Frequency
                                    </label>
                                    <select
                                        value={allowanceForm.frequency}
                                        onChange={(e) =>
                                            setAllowanceForm((f) => ({ ...f, frequency: e.target.value }))
                                        }
                                        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:ring-2 focus:ring-accent/30"
                                    >
                                        {FREQUENCIES.map((freq) => (
                                            <option key={freq.value} value={freq.value}>
                                                {freq.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Taxable
                                    </label>
                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAllowanceForm((f) => ({ ...f, is_taxable: !f.is_taxable }))
                                            }
                                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${allowanceForm.is_taxable ? 'bg-accent' : 'bg-ink/15'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${allowanceForm.is_taxable ? 'translate-x-4' : 'translate-x-0.5'
                                                    }`}
                                            />
                                        </button>
                                        <span className="text-xs text-muted font-rethink">
                                            {allowanceForm.is_taxable ? 'Taxable' : 'Non-taxable'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Effective Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={allowanceForm.effective_date}
                                        onChange={(e) =>
                                            setAllowanceForm((f) => ({
                                                ...f,
                                                effective_date: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                        Expiry Date (optional)
                                    </label>
                                    <Input
                                        type="date"
                                        value={allowanceForm.expiry_date}
                                        onChange={(e) =>
                                            setAllowanceForm((f) => ({
                                                ...f,
                                                expiry_date: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-medium text-muted font-rethink">
                                    Description
                                </label>
                                <Input
                                    type="text"
                                    value={allowanceForm.description}
                                    onChange={(e) =>
                                        setAllowanceForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                    placeholder="Brief description"
                                />
                            </div>
                            <Button
                                type="button"
                                onClick={handleSaveAllowance}
                                disabled={isSavingAllowance}
                                className="w-full font-rethink text-sm h-[38px]"
                            >
                                {isSavingAllowance ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {editingAllowance ? 'Updating…' : 'Adding…'}
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        {editingAllowance ? 'Update Allowance' : 'Add Allowance'}
                                    </>
                                )}
                            </Button>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-ink font-rethink">Active Allowances</p>
                                <span className="text-[10px] text-muted font-rethink">
                                    {allowances.filter((a) => a.is_active).length} active
                                </span>
                            </div>

                            {allowancesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted" />
                                </div>
                            ) : allowances.filter((a) => a.is_active).length === 0 ? (
                                <p className="py-6 text-center text-xs text-muted font-rethink">
                                    No active allowances for this employee.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {allowances
                                        .filter((a) => a.is_active)
                                        .map((allowance) => (
                                            <div
                                                key={allowance.id}
                                                className="flex items-center justify-between rounded-lg border border-line bg-ink/[0.02] px-3 py-2.5 dark:border-line/30"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Gift className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        <span className="text-sm font-medium text-ink font-rethink">
                                                            {allowance.benefit_name}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted font-rethink">
                                                        <span className="font-mono font-semibold text-blue-600">
                                                            {formatCurrency(allowance.amount)}
                                                        </span>
                                                        <span className="capitalize">{allowance.frequency}</span>
                                                        {allowance.is_taxable ? (
                                                            <span className="text-amber-500">Taxable</span>
                                                        ) : (
                                                            <span className="text-emerald-500">Non-taxable</span>
                                                        )}
                                                        {allowance.effective_date && (
                                                            <span>
                                                                • Effective: {formatDate(allowance.effective_date)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {allowance.description && (
                                                        <p className="mt-0.5 text-[10px] text-muted/70">
                                                            {allowance.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <button
                                                        onClick={() => openEditAllowance(allowance)}
                                                        className="rounded-md p-1.5 text-ink hover:bg-ink/5 transition-colors"
                                                        aria-label="Edit allowance"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAllowance(allowance.id)}
                                                        disabled={deletingAllowanceId === allowance.id}
                                                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50 transition-colors dark:hover:bg-red-950/30"
                                                        aria-label="Delete allowance"
                                                    >
                                                        {deletingAllowanceId === allowance.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2Icon />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmModal
                isOpen={!!confirmResetRow}
                onClose={() => setConfirmResetRow(null)}
                onConfirm={confirmReset}
                title="Reset to Position Default"
                message={`This removes ${confirmResetRow?.employee_name || 'this employee'
                    }'s custom rate and adjustment reason. Their pay will revert to the ${confirmResetRow?.job_title || 'position'
                    } default rate.`}
                confirmLabel="Reset Rate"
                isProcessing={isResetting}
            />

            <HistoryModal
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                title={historyTitle}
                entries={historyEntries}
                loading={historyLoading}
            />

            {incentivesRow && (
                <IncentivesModal
                    isOpen={!!incentivesRow}
                    onClose={() => {
                        setIncentivesRow(null);
                        loadRows();
                        loadIncentiveEntries();
                    }}
                    employeeId={incentivesRow.employee_id}
                    employeeName={incentivesRow.employee_name}
                />
            )}
        </div>
    );
};

function Trash2Icon() {
    return (
        <svg
            className="h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
    );
}

export default ByEmployee;