'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, Gift, CheckCircle2, DollarSign,
    TrendingUp, Printer, FileSpreadsheet, PieChart, BarChart3, AlertTriangle,
    Wallet2, Bell, CalendarDays, ShieldAlert,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import OtpModal from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpModal';
import OtpUnlockBanner from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpUnlockBanner';
import { useOtpSessionContext } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import { printTable, exportExcel, printFormatters, PrintColumn } from '../print-utils';
import { peso, cssVar, StatCard, employeeHasBank } from './shared';

const PAGE_SIZE = 8;

const BENEFIT_TYPES = [
    { value: 'allowance', label: 'Allowance' },
    { value: 'incentive', label: 'Incentive' },
    { value: 'commission', label: 'Commission' },
    { value: 'injury_or_loss', label: 'Injury or Loss' },
];

const FREQUENCY_BY_TYPE: Record<string, { value: string; label: string }[]> = {
    allowance: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'semi_annual', label: 'Semi-Annual' },
        { value: 'annual', label: 'Annual' },
        { value: 'one_time', label: 'One Time' },
    ],
    incentive: [{ value: 'one_time', label: 'One Time' }],
    commission: [{ value: 'one_time', label: 'One Time' }],
    injury_or_loss: [{ value: 'one_time', label: 'One Time' }],
};

const EMPTY_FORM = {
    employee_id: '',
    benefit_type: 'allowance',
    benefit_name: '',
    amount: '',
    frequency: 'monthly',
    payroll_run_id: '',
    is_taxable: true,
    deduct_from_payroll: true,
    is_active: true,
    description: '',
};

const TYPE_STYLES: Record<string, { bg: string; text: string; ring: string; dot: string; label: string; icon: React.ElementType }> = {
    allowance: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-200 dark:ring-blue-800/40', dot: 'bg-blue-500', label: 'Allowance', icon: Wallet2 },
    incentive: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-800/40', dot: 'bg-amber-500', label: 'Incentive', icon: TrendingUp },
    commission: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-200 dark:ring-purple-800/40', dot: 'bg-purple-500', label: 'Commission', icon: DollarSign },
    injury_or_loss: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-200 dark:ring-rose-800/40', dot: 'bg-rose-500', label: 'Injury or Loss', icon: ShieldAlert },
};

const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
    'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300',
    'from-purple-100 to-violet-100 text-purple-700 dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300',
];
const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

const initialsOf = (name: string) =>
    (name || '??').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

type PendingAction =
    | { kind: 'save'; payload: any; isEdit: boolean; editId?: any }
    | { kind: 'delete'; id: any; name: string }
    | null;

const BenefitsTab = () => {
    const toast = useToast();
    const { active, secondsLeft, unlock, lock } = useOtpSessionContext();

    const [benefits, setBenefits] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [isOtpOpen, setIsOtpOpen] = useState(false);
    const [otpPurpose, setOtpPurpose] = useState<'benefit' | 'benefit_delete'>('benefit');

    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/compensation/employee-benefits'
    );
    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );
    const { fetchData: fetchRuns } = useApi(
        '/payroll-benefits-dashboard/api/payroll/runs'
    );

    const typeChartRef = useRef<HTMLCanvasElement | null>(null);
    const typeChartInstanceRef = useRef<Chart | null>(null);
    const taxChartRef = useRef<HTMLCanvasElement | null>(null);
    const taxChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [b, e, r] = await Promise.all([
                fetchData().catch(() => []),
                fetchEmployees().catch(() => []),
                fetchRuns().catch(() => []),
            ]);
            setBenefits(Array.isArray(b) ? b : []);
            setEmployees(Array.isArray(e) ? e : []);
            setPayrollRuns(Array.isArray(r) ? r : []);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load benefits');
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

    const filteredBenefits = useMemo(() => {
        const list = benefits.filter(
            (b) => !b.night_diff_enabled && b.benefit_type !== 'holiday_pay' && b.benefit_type !== 'bonus'
        );
        const term = searchTerm.trim().toLowerCase();
        if (!term) return list;
        return list.filter(
            (b) =>
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

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const activeCount = useMemo(() => filteredBenefits.filter((b) => b.is_active).length, [filteredBenefits]);
    const monthlyTotal = useMemo(
        () => filteredBenefits
            .filter((b) => b.frequency === 'monthly' && b.is_active && b.deduct_from_payroll)
            .reduce((s, b) => s + (b.amount || 0), 0),
        [filteredBenefits]
    );
    const annualTotal = useMemo(
        () => filteredBenefits
            .filter((b) => b.is_active && b.deduct_from_payroll)
            .reduce((s, b) => {
                const mult: Record<string, number> = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1, one_time: 1 };
                return s + (b.amount || 0) * (mult[b.frequency] || 1);
            }, 0),
        [filteredBenefits]
    );

    const typeCounts = useMemo(() => {
        const c: Record<string, number> = {};
        filteredBenefits.forEach((b) => { c[b.benefit_type] = (c[b.benefit_type] || 0) + 1; });
        return c;
    }, [filteredBenefits]);

    const taxableCount = useMemo(() => filteredBenefits.filter((b) => b.is_taxable).length, [filteredBenefits]);
    const nonTaxableCount = useMemo(() => filteredBenefits.filter((b) => !b.is_taxable).length, [filteredBenefits]);

    useEffect(() => {
        if (loading || !typeChartRef.current) return;
        typeChartInstanceRef.current?.destroy();
        const labels = Object.keys(typeCounts);
        if (labels.length === 0) return;
        const palette = [
            cssVar('--accent', '#e5167e'),
            cssVar('--sss', '#2455c7'),
            cssVar('--philhealth', '#0b8f6b'),
            cssVar('--pagibig', '#b8720e'),
            '#e11d48',
            '#8b5cf6',
            '#f59e0b',
        ];
        typeChartInstanceRef.current = new Chart(typeChartRef.current, {
            type: 'doughnut',
            data: {
                labels: labels.map((l) => l.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
                datasets: [{
                    data: labels.map((l) => typeCounts[l]),
                    backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                    borderWidth: 2,
                    borderColor: cssVar('--paper', '#fff'),
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { padding: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: cssVar('--ink', '#1c1b1f') },
                    },
                },
            },
        });
        return () => { typeChartInstanceRef.current?.destroy(); };
    }, [typeCounts, loading]);

    useEffect(() => {
        if (loading || !taxChartRef.current) return;
        taxChartInstanceRef.current?.destroy();
        if (taxableCount === 0 && nonTaxableCount === 0) return;
        taxChartInstanceRef.current = new Chart(taxChartRef.current, {
            type: 'doughnut',
            data: {
                labels: ['Taxable', 'Non-Taxable'],
                datasets: [{
                    data: [taxableCount, nonTaxableCount],
                    backgroundColor: [cssVar('--pagibig', '#b8720e'), cssVar('--philhealth', '#0b8f6b')],
                    borderWidth: 2,
                    borderColor: cssVar('--paper', '#fff'),
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { padding: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, color: cssVar('--ink', '#1c1b1f') },
                    },
                },
            },
        });
        return () => { taxChartInstanceRef.current?.destroy(); };
    }, [taxableCount, nonTaxableCount, loading]);

    const openCreate = () => {
        setEditTarget(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const openEdit = (b: any) => {
        setEditTarget(b);
        setForm({
            employee_id: String(b.employee_id || ''),
            benefit_type: b.benefit_type || 'allowance',
            benefit_name: b.benefit_name || '',
            amount: String(b.amount || ''),
            frequency: b.frequency || 'monthly',
            payroll_run_id: String(b.payroll_run_id || ''),
            is_taxable: b.is_taxable ?? true,
            deduct_from_payroll: b.deduct_from_payroll ?? true,
            is_active: b.is_active ?? true,
            description: b.description || '',
        });
        setIsModalOpen(true);
    };

    const buildPayload = () => {
        const run = payrollRuns.find((r) => String(r.id) === String(form.payroll_run_id));
        return {
            employee_id: form.employee_id,
            benefit_type: form.benefit_type,
            benefit_name: form.benefit_name.trim(),
            amount: Number(form.amount) || 0,
            frequency: form.frequency,
            payroll_run_id: Number(form.payroll_run_id),
            effective_date: run?.period_start || new Date().toISOString().split('T')[0],
            expiry_date: run?.period_end || null,
            is_taxable: form.is_taxable,
            deduct_from_payroll: form.deduct_from_payroll,
            is_active: form.is_active,
            description: form.description.trim() || null,
        };
    };

    const handleSave = async () => {
        if (!form.employee_id || !form.benefit_name || !form.amount) {
            toast.showError('Employee, benefit name, and amount are required');
            return;
        }
        if (!form.payroll_run_id) {
            toast.showError('Select a payroll run for this benefit');
            return;
        }
        if (!employeeHasBank(employees, form.employee_id)) {
            toast.showError('Cannot save — this employee has no bank account on file.');
            return;
        }

        const payload = buildPayload();
        const isEdit = !!editTarget;
        const editId = editTarget?.id;

        if (!active) {
            setPendingAction({ kind: 'save', payload, isEdit, editId });
            setOtpPurpose('benefit');
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
                toast.showSuccess('Benefit updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Benefit added');
            }
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            setEditTarget(null);
            setPendingAction(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save benefit');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (benefit: any) => {
        if (!benefit?.id) {
            toast.showError('Cannot delete — invalid record');
            return;
        }

        if (active) {
            setDeleteTarget(benefit);
            return;
        }

        const name = benefit.benefit_name || getEmployeeName(benefit.employee_id);
        setPendingAction({ kind: 'delete', id: benefit.id, name });
        setOtpPurpose('benefit_delete');
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
            toast.showSuccess('Deleted');
            setDeleteTarget(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOtpSuccess = async (meta?: { secondsLeft?: number; scope?: string }) => {
        setIsOtpOpen(false);
        unlock(meta?.scope || 'all', meta?.secondsLeft);

        const action = pendingAction;
        setPendingAction(null);

        if (!action) return;

        if (action.kind === 'save') {
            await commitSave(action.payload, action.isEdit, action.editId);
        } else if (action.kind === 'delete') {
            await performDelete(action.id, action.name);
        }
    };

    const performDelete = async (id: any, name: string) => {
        setIsDeleting(true);
        try {
            await deleteData(`/${id}`);
            toast.showSuccess('Deleted');
            setDeleteTarget(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const printColumns: PrintColumn[] = [
        { key: 'employee_id', label: 'Employee', format: (v) => getEmployeeName(v) },
        { key: 'benefit_name', label: 'Benefit' },
        { key: 'benefit_type', label: 'Type', format: (v) => printFormatters.capitalize(v) },
        { key: 'amount', label: 'Amount', align: 'right', format: (v) => printFormatters.peso(v) },
        {
            key: 'payroll_run_id', label: 'Payroll Run', format: (v) => {
                const run = payrollRuns.find((r) => r.id === v);
                if (!run) return '—';
                return `${printFormatters.date(run.period_start)} – ${printFormatters.date(run.period_end)}`;
            }
        },
        { key: 'is_taxable', label: 'Taxable', format: (v) => (v ? 'Yes' : 'No') },
        { key: 'deduct_from_payroll', label: 'Counted', format: (v) => (v ? 'Yes' : 'No') },
        { key: 'is_active', label: 'Status', format: (v) => (v ? 'Active' : 'Inactive') },
    ];

    const handlePrint = () => {
        if (filteredBenefits.length === 0) { toast.showError('No benefits to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Allowances, Incentives, Commissions & Injury/Loss',
            reportSubtitle: 'Employee compensation extras',
            filters: { 'Total Records': filteredBenefits.length, 'Monthly Total': peso(monthlyTotal), 'Annual Total': peso(annualTotal) },
            logoPath: '/images/logo-remove-bg.png',
        }, printColumns, filteredBenefits);
    };

    const handleExport = () => {
        if (filteredBenefits.length === 0) { toast.showError('No benefits to export.'); return; }
        exportExcel(`benefits-${new Date().toISOString().split('T')[0]}`, printColumns, filteredBenefits, {
            reportTitle: 'Allowances, Incentives, Commissions & Injury/Loss',
            reportSubtitle: 'Employee compensation extras',
            filters: { 'Total Records': filteredBenefits.length, 'Monthly Total': peso(monthlyTotal), 'Annual Total': peso(annualTotal) },
        });
        toast.showSuccess('Benefits exported to Excel.');
    };

    const formHasBank = form.employee_id ? employeeHasBank(employees, form.employee_id) : false;
    const isOneTime = form.frequency === 'one_time';

    const isSaveDisabled =
        isSaving ||
        !form.employee_id ||
        !form.benefit_name ||
        !form.amount ||
        (isOneTime && !form.payroll_run_id) ||
        !formHasBank;

    const frequencyOptions = FREQUENCY_BY_TYPE[form.benefit_type] || FREQUENCY_BY_TYPE.allowance;

    return (
        <div className="space-y-5">
            <OtpUnlockBanner
                active={active}
                secondsLeft={secondsLeft}
                onLock={() => void lock()}
                scopeLabel="save & delete allowed without re-verifying"
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Gift} label="Total Records" value={String(filteredBenefits.length)} tint="blue" />
                <StatCard icon={CheckCircle2} label="Active" value={String(activeCount)} tint="emerald" />
                <StatCard icon={DollarSign} label="Monthly Total" value={peso(monthlyTotal)} tint="purple" />
                <StatCard icon={TrendingUp} label="Annual Total" value={peso(annualTotal)} tint="amber" />
            </div>

            {!loading && filteredBenefits.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                        <CardBody className="p-4">
                            <div className="flex items-center gap-1.5 mb-3">
                                <PieChart className="h-3.5 w-3.5 text-accent" />
                                <p className="text-xs font-semibold text-ink font-rethink">Benefit Type Distribution</p>
                            </div>
                            <div className="h-56"><canvas ref={typeChartRef} /></div>
                        </CardBody>
                    </Card>
                    <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                        <CardBody className="p-4">
                            <div className="flex items-center gap-1.5 mb-3">
                                <BarChart3 className="h-3.5 w-3.5 text-philhealth" />
                                <p className="text-xs font-semibold text-ink font-rethink">Taxable vs Non-Taxable</p>
                            </div>
                            <div className="h-56"><canvas ref={taxChartRef} /></div>
                        </CardBody>
                    </Card>
                </div>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search placeholder="Search benefits by employee, name, or type..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
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
                    <Button onClick={openCreate} className="font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Add Benefit</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading benefits…
                    </div>
                ) : filteredBenefits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30 mb-3">
                            <Gift className="h-6 w-6 text-pink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No benefits yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Add allowances, incentives, commissions, or injury/loss benefits per employee.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Benefit</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Type</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Payroll Run</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Tax</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedBenefits.map((benefit) => {
                                            const run = payrollRuns.find((r) => r.id === benefit.payroll_run_id);
                                            const style = TYPE_STYLES[benefit.benefit_type] || TYPE_STYLES.allowance;
                                            const TypeIcon = style.icon;
                                            const empName = getEmployeeName(benefit.employee_id);
                                            const empNo = getEmployeeNumber(benefit.employee_id);
                                            const hasBank = employeeHasBank(employees, benefit.employee_id);
                                            return (
                                                <motion.tr
                                                    key={benefit.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-pink-50/40 dark:hover:bg-pink-950/10"
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
                                                                <p className="text-[10px] text-muted font-rethink">{empNo || benefit.frequency?.replace('_', ' ')}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <p className="text-[13px] text-ink font-rethink max-w-[180px] break-words">{benefit.benefit_name}</p>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}>
                                                            <TypeIcon className="h-3 w-3" />
                                                            {style.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold text-ink whitespace-nowrap">
                                                        {peso(benefit.amount)}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        {benefit.frequency === 'one_time' ? (
                                                            run ? (
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 px-2 py-1 text-[11px] font-rethink text-pink-700 dark:bg-pink-950/30 dark:text-pink-300">
                                                                    <CalendarDays className="h-3 w-3" />
                                                                    {new Date(run.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(run.period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-muted italic font-rethink">Not assigned</span>
                                                            )
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">All runs</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {benefit.is_taxable ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                Taxable
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Non-Tax
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {benefit.is_active ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => openEdit(benefit)}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                                                                aria-label="Edit benefit"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(benefit)}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                                                                aria-label="Delete benefit"
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

                        <div className="md:hidden divide-y divide-line">
                            <AnimatePresence initial={false}>
                                {paginatedBenefits.map((benefit) => {
                                    const run = payrollRuns.find((r) => r.id === benefit.payroll_run_id);
                                    const style = TYPE_STYLES[benefit.benefit_type] || TYPE_STYLES.allowance;
                                    const TypeIcon = style.icon;
                                    const empName = getEmployeeName(benefit.employee_id);
                                    const hasBank = employeeHasBank(employees, benefit.employee_id);
                                    return (
                                        <motion.div
                                            key={benefit.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="p-3.5 space-y-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(empName)}`}>
                                                        {initialsOf(empName)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">{empName}</p>
                                                            {!hasBank && <Bell className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                                                        </div>
                                                        <p className="text-[11px] text-muted font-rethink truncate">{benefit.benefit_name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        onClick={() => openEdit(benefit)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                                                        aria-label="Edit benefit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(benefit)}
                                                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                                                        aria-label="Delete benefit"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}>
                                                    <TypeIcon className="h-3 w-3" />
                                                    {style.label}
                                                </span>
                                                {benefit.is_taxable ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        Taxable
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        Non-Tax
                                                    </span>
                                                )}
                                                {benefit.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="text-[11px] text-muted font-rethink">
                                                    {benefit.frequency === 'one_time' ? (
                                                        run ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <CalendarDays className="h-3 w-3" />
                                                                {new Date(run.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(run.period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        ) : (
                                                            <span className="italic">Not assigned</span>
                                                        )
                                                    ) : (
                                                        <span className="italic">All runs</span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-sm font-semibold text-ink">{peso(benefit.amount)}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={filteredBenefits.length}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setForm(EMPTY_FORM); setEditTarget(null); }}
                title={editTarget ? 'Edit Benefit' : 'Add Benefit'}
                size="lg"
            >
                <div className="space-y-4">
                    {form.employee_id && !formHasBank && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 font-rethink">No bank account on file</p>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400/80 font-rethink mt-0.5">
                                    This employee cannot receive payroll-linked benefits until bank details are added.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee <span className="text-rose-500">*</span></label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name}{emp.employee_id_number ? ` (${emp.employee_id_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Benefit Type <span className="text-rose-500">*</span></label>
                            <select
                                value={form.benefit_type}
                                onChange={(e) => {
                                    const t = e.target.value;
                                    const freqs = FREQUENCY_BY_TYPE[t] || FREQUENCY_BY_TYPE.allowance;
                                    const nextFreq = freqs.some((f) => f.value === form.frequency) ? form.frequency : freqs[0].value;
                                    setForm({
                                        ...form,
                                        benefit_type: t,
                                        frequency: nextFreq,
                                        payroll_run_id: nextFreq === 'one_time' ? form.payroll_run_id : '',
                                    });
                                }}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-line/30"
                            >
                                {BENEFIT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Frequency <span className="text-rose-500">*</span></label>
                            <select
                                value={form.frequency}
                                onChange={(e) => {
                                    const f = e.target.value;
                                    setForm({
                                        ...form,
                                        frequency: f,
                                        payroll_run_id: f === 'one_time' ? form.payroll_run_id : '',
                                    });
                                }}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-line/30"
                            >
                                {frequencyOptions.map((f) => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {isOneTime && (
                            <div className="sm:col-span-2 rounded-lg border border-pink-200 bg-pink-50/50 p-3 dark:border-pink-800/40 dark:bg-pink-950/10">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <CalendarDays className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                                    <p className="text-xs font-semibold text-pink-700 dark:text-pink-300 font-rethink">One Time — assign to payroll run</p>
                                </div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Payroll Run <span className="text-rose-500">*</span></label>
                                <select
                                    value={form.payroll_run_id}
                                    onChange={(e) => setForm({ ...form, payroll_run_id: e.target.value })}
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-line/30"
                                >
                                    <option value="">Select payroll run…</option>
                                    {payrollRuns.map((run) => (
                                        <option key={run.id} value={run.id}>
                                            {new Date(run.period_start).toLocaleDateString()} – {new Date(run.period_end).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-muted font-rethink mt-1.5">
                                    This one-time benefit will be released on the selected payroll run only.
                                </p>
                            </div>
                        )}

                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Benefit Name <span className="text-rose-500">*</span></label>
                            <Input
                                type="text"
                                value={form.benefit_name}
                                onChange={(e) => setForm({ ...form, benefit_name: e.target.value })}
                                placeholder="e.g. Transportation Allowance"
                                leftIcon={<Gift className="h-4 w-4 text-pink-500" />}
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount (₱) <span className="text-rose-500">*</span></label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                placeholder="0.00"
                                leftIcon={
                                    <span className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-emerald-600">₱</span>
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                        </span>
                                    </span>
                                }
                                className="font-mono"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                placeholder="Optional notes…"
                                className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink font-rethink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-line/30"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {([
                            { key: 'is_taxable' as const, label: 'Taxable' },
                            { key: 'deduct_from_payroll' as const, label: 'Counted in Payroll' },
                            { key: 'is_active' as const, label: 'Active' },
                        ]).map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setForm({ ...form, [key]: !form[key] })}
                                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${form[key]
                                    ? 'border-accent/40 bg-accent/5 dark:border-accent/30'
                                    : 'border-line bg-paper dark:border-line/30'
                                    }`}
                            >
                                <span className="text-xs font-medium text-ink font-rethink">{label}</span>
                                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form[key] ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-line pt-4 dark:border-line/30">
                        <Button
                            onClick={() => { setIsModalOpen(false); setForm(EMPTY_FORM); setEditTarget(null); }}
                            disabled={isSaving}
                            className="font-rethink text-xs h-9 px-4 rounded-md bg-ink/5 text-ink hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/15 transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className="font-rethink text-xs h-9 px-4 rounded-md bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {editTarget ? 'Update Benefit' : 'Add Benefit'}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Delete Benefit"
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30">
                            <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-ink font-rethink">Are you sure?</p>
                            <p className="text-xs text-muted font-rethink mt-1">
                                This will permanently delete{' '}
                                <span className="font-medium text-ink">
                                    {deleteTarget?.benefit_name || (deleteTarget && getEmployeeName(deleteTarget.employee_id))}
                                </span>
                                . This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-line pt-4 dark:border-line/30">
                        <Button
                            onClick={() => setDeleteTarget(null)}
                            disabled={isDeleting}
                            className="font-rethink text-xs h-9 px-4 rounded-md bg-ink/5 text-ink hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/15 transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="font-rethink text-xs h-9 px-4 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            {isDeleting ? (
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Deleting…
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            <OtpModal
                isOpen={isOtpOpen}
                onClose={() => { setIsOtpOpen(false); setPendingAction(null); }}
                purpose={otpPurpose}
                onVerified={(meta) => handleOtpSuccess(meta)}
            />
        </div>
    );
};

export default BenefitsTab;