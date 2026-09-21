'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, Calendar, Gift, RefreshCw,
    Printer, FileSpreadsheet, BarChart3, AlertTriangle, Sparkles, CalendarDays,
    TrendingUp, DollarSign,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { printTable, exportExcel, printFormatters, PrintColumn } from '../print-utils';
import { peso, cssVar, StatCard } from './shared';

const HOLIDAY_TYPES = [
    { value: 'regular', label: 'Regular Holiday' },
    { value: 'special_non_working', label: 'Special (Non-Working)' },
    { value: 'special_working', label: 'Special (Working)' },
];

const EMPTY_RULE_FORM = {
    employee_id: '',
    benefit_name: 'Holiday Pay',
    amount: '',
    holiday_multiplier: '2.00',
    is_taxable: true,
    deduct_from_payroll: true,
    is_active: true,
    effective_date: '',
};

const EMPTY_CALENDAR_FORM = {
    holiday_date: '',
    name: '',
    type: 'regular',
};

const HOLIDAY_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string; ring: string; label: string }> = {
    regular: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', ring: 'ring-rose-200 dark:ring-rose-800/40', label: 'Regular' },
    special_non_working: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', ring: 'ring-amber-200 dark:ring-amber-800/40', label: 'Special' },
    special_working: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', ring: 'ring-blue-200 dark:ring-blue-800/40', label: 'Working' },
};

const HolidayPayTab = () => {
    const toast = useToast();
    const [benefits, setBenefits] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editRule, setEditRule] = useState<any | null>(null);
    const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
    const [isSavingRule, setIsSavingRule] = useState(false);

    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [calendarForm, setCalendarForm] = useState(EMPTY_CALENDAR_FORM);
    const [isSavingCalendar, setIsSavingCalendar] = useState(false);

    const [deleteRuleTarget, setDeleteRuleTarget] = useState<any | null>(null);
    const [deleteHolidayTarget, setDeleteHolidayTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/compensation/employee-benefits'
    );
    const { fetchData: fetchEmployees } = useApi(
        '/payroll-benefits-dashboard/api/payroll/employee-info'
    );
    const { fetchData: fetchHolidays } = useApi(
        '/payroll-benefits-dashboard/api/compensation/ph-holidays'
    );
    const { postData: postHoliday, deleteData: deleteHoliday } = useApi(
        '/payroll-benefits-dashboard/api/compensation/ph-holidays'
    );

    const holidayChartRef = useRef<HTMLCanvasElement | null>(null);
    const holidayChartInstanceRef = useRef<Chart | null>(null);

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return Array.from({ length: 4 }, (_, i) => current - i).sort((a, b) => a - b);
    }, []);

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        loadHolidays();
    }, [holidayYear]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [b, e] = await Promise.all([
                fetchData().catch(() => []),
                fetchEmployees().catch(() => []),
            ]);
            setBenefits(Array.isArray(b) ? b : []);
            setEmployees(Array.isArray(e) ? e : []);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load holiday pay rules');
        } finally {
            setLoading(false);
        }
    };

    const loadHolidays = async (refresh = false): Promise<any[]> => {
        if (refresh) setRefreshing(true);
        try {
            const url = `?year=${holidayYear}${refresh ? '&refresh=true' : ''}`;
            const data = await fetchHolidays(url).catch(() => []);
            const list = Array.isArray(data) ? data : [];
            setHolidays(list);
            if (list.length === 0 && holidayYear <= new Date().getFullYear() && !refresh) {
                return loadHolidays(true);
            }
            return list;
        } catch {
            setHolidays([]);
            return [];
        } finally {
            setRefreshing(false);
        }
    };

    const getEmployeeName = (id: string) => {
        const emp = employees.find((e) => e.employee_id === id);
        return emp?.employee_name || 'Unknown Employee';
    };

    const rules = useMemo(
        () => benefits.filter((b) => b.benefit_type === 'holiday_pay'),
        [benefits]
    );

    const filteredRules = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return rules;
        return rules.filter(
            (b) =>
                b.benefit_name?.toLowerCase().includes(term) ||
                getEmployeeName(b.employee_id).toLowerCase().includes(term)
        );
    }, [rules, searchTerm, employees]);

    const filteredHolidays = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return holidays;
        return holidays.filter(
            (h) =>
                h.name?.toLowerCase().includes(term) ||
                h.type?.toLowerCase().includes(term)
        );
    }, [holidays, searchTerm]);

    const holidayTypeCounts = useMemo(() => {
        const c = { regular: 0, special_non_working: 0, special_working: 0 };
        holidays.forEach((h) => {
            if (h.type in c) c[h.type] += 1;
        });
        return c;
    }, [holidays]);

    useEffect(() => {
        if (loading || !holidayChartRef.current) return;
        holidayChartInstanceRef.current?.destroy();

        holidayChartInstanceRef.current = new Chart(holidayChartRef.current, {
            type: 'bar',
            data: {
                labels: ['Regular', 'Special (Non-Working)', 'Special (Working)'],
                datasets: [
                    {
                        label: 'Holidays',
                        data: [
                            holidayTypeCounts.regular,
                            holidayTypeCounts.special_non_working,
                            holidayTypeCounts.special_working,
                        ],
                        backgroundColor: [
                            cssVar('--accent', '#e5167e'),
                            cssVar('--pagibig', '#b8720e'),
                            cssVar('--sss', '#2455c7'),
                        ],
                        borderRadius: 8,
                        barThickness: 40,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: cssVar('--muted', '#6b6b76') },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    x: {
                        ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } },
                        grid: { display: false },
                    },
                },
            },
        });

        return () => {
            holidayChartInstanceRef.current?.destroy();
        };
    }, [holidayTypeCounts, loading]);

    const openRuleCreate = () => {
        setEditRule(null);
        setRuleForm({
            ...EMPTY_RULE_FORM,
            effective_date: `${holidayYear}-01-01`,
        });
        setIsRuleModalOpen(true);
    };

    const openRuleEdit = (r: any) => {
        setEditRule(r);
        setRuleForm({
            employee_id: String(r.employee_id || ''),
            benefit_name: r.benefit_name || 'Holiday Pay',
            amount: String(r.amount || ''),
            holiday_multiplier: String(r.holiday_multiplier || 2.0),
            is_taxable: r.is_taxable ?? true,
            deduct_from_payroll: r.deduct_from_payroll ?? true,
            is_active: r.is_active ?? true,
            effective_date: r.effective_date?.split('T')[0] || `${holidayYear}-01-01`,
        });
        setIsRuleModalOpen(true);
    };

    const handleSaveRule = async () => {
        if (!ruleForm.employee_id || !ruleForm.amount) {
            toast.showError('Employee and amount are required');
            return;
        }
        const yearStart = `${holidayYear}-01-01`;
        const yearEnd = `${holidayYear}-12-31`;

        const payload = {
            employee_id: ruleForm.employee_id,
            benefit_type: 'holiday_pay',
            benefit_name: ruleForm.benefit_name.trim(),
            amount: Number(ruleForm.amount) || 0,
            frequency: 'annual',
            effective_date: ruleForm.effective_date || yearStart,
            expiry_date: yearEnd,
            is_taxable: ruleForm.is_taxable,
            deduct_from_payroll: ruleForm.deduct_from_payroll,
            is_active: ruleForm.is_active,
            description: null,
            holiday_multiplier: Number(ruleForm.holiday_multiplier) || 2.0,
        };

        setIsSavingRule(true);
        try {
            if (editRule) {
                await putData(`/${editRule.id}`, payload);
                toast.showSuccess('Holiday pay rule updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Holiday pay rule added');
            }
            setIsRuleModalOpen(false);
            setRuleForm(EMPTY_RULE_FORM);
            setEditRule(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save holiday pay rule');
        } finally {
            setIsSavingRule(false);
        }
    };

    const confirmDeleteRule = async () => {
        if (!deleteRuleTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteRuleTarget.id}`);
            toast.showSuccess('Rule deleted');
            setDeleteRuleTarget(null);
            loadAll();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const openCalendarCreate = () => {
        setCalendarForm({
            holiday_date: '',
            name: '',
            type: 'regular',
        });
        setIsCalendarModalOpen(true);
    };

    const handleSaveCalendar = async () => {
        if (!calendarForm.holiday_date || !calendarForm.name) {
            toast.showError('Date and name are required');
            return;
        }
        setIsSavingCalendar(true);
        try {
            await postHoliday('', calendarForm);
            toast.showSuccess('Holiday saved');
            setIsCalendarModalOpen(false);
            loadHolidays();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save holiday');
        } finally {
            setIsSavingCalendar(false);
        }
    };

    const confirmDeleteHoliday = async () => {
        if (!deleteHolidayTarget) return;
        setIsDeleting(true);
        try {
            await deleteHoliday(`?id=${deleteHolidayTarget.id}`);
            toast.showSuccess('Holiday removed');
            setDeleteHolidayTarget(null);
            loadHolidays();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to remove holiday');
        } finally {
            setIsDeleting(false);
        }
    };

    const ruleColumns: PrintColumn[] = [
        { key: 'employee_id', label: 'Employee', format: (v) => getEmployeeName(v) },
        { key: 'benefit_name', label: 'Rule' },
        { key: 'holiday_multiplier', label: 'Multiplier', align: 'right', format: (v) => `${Number(v || 2).toFixed(2)}x` },
        { key: 'amount', label: 'Base Amount', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'is_taxable', label: 'Taxable', format: (v) => (v ? 'Yes' : 'No') },
        { key: 'is_active', label: 'Status', format: (v) => (v ? 'Active' : 'Inactive') },
    ];

    const calendarColumns: PrintColumn[] = [
        { key: 'holiday_date', label: 'Date', format: (v) => printFormatters.date(v) },
        { key: 'name', label: 'Holiday' },
        { key: 'type', label: 'Type', format: (v) => v === 'regular' ? 'Regular' : v === 'special_non_working' ? 'Special (Non-Working)' : 'Special (Working)' },
        { key: 'source', label: 'Source', format: (v) => printFormatters.capitalize(v) },
    ];

    const handlePrintRules = () => {
        if (filteredRules.length === 0) { toast.showError('No holiday pay rules to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Holiday Pay Rules',
            reportSubtitle: `Annual holiday rules — ${holidayYear}`,
            filters: { 'Total Rules': filteredRules.length },
            logoPath: '/images/logo-remove-bg.png',
        }, ruleColumns, filteredRules);
    };

    const handleExportRules = () => {
        if (filteredRules.length === 0) { toast.showError('No holiday pay rules to export.'); return; }
        exportExcel(`holiday-pay-rules-${holidayYear}`, ruleColumns, filteredRules, {
            reportTitle: 'Holiday Pay Rules',
            reportSubtitle: `Annual holiday rules — ${holidayYear}`,
        });
        toast.showSuccess('Holiday pay rules exported to Excel.');
    };

    const handlePrintCalendar = () => {
        if (filteredHolidays.length === 0) { toast.showError('No holidays to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: `Philippine Holidays — ${holidayYear}`,
            reportSubtitle: 'Auto-synced from Nager.Date',
            filters: { 'Total Holidays': holidays.length, Regular: holidayTypeCounts.regular, Special: holidayTypeCounts.special_non_working },
            logoPath: '/images/logo-remove-bg.png',
        }, calendarColumns, filteredHolidays);
    };

    const handleExportCalendar = () => {
        if (filteredHolidays.length === 0) { toast.showError('No holidays to export.'); return; }
        exportExcel(`ph-holidays-${holidayYear}`, calendarColumns, filteredHolidays, {
            reportTitle: `Philippine Holidays — ${holidayYear}`,
            reportSubtitle: 'Auto-synced from Nager.Date',
        });
        toast.showSuccess('Holidays exported to Excel.');
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Calendar} label={`Holidays ${holidayYear}`} value={String(holidays.length)} tint="blue" />
                <StatCard icon={Calendar} label="Regular" value={String(holidayTypeCounts.regular)} tint="rose" />
                <StatCard icon={Calendar} label="Special" value={String(holidayTypeCounts.special_non_working)} tint="amber" />
                <StatCard icon={Gift} label="Holiday Pay Rules" value={String(rules.length)} tint="purple" />
            </div>

            {!loading && holidays.length > 0 && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <BarChart3 className="h-3.5 w-3.5 text-accent" />
                            <p className="text-xs font-semibold text-ink font-rethink">
                                Holidays by Type — {holidayYear}
                            </p>
                        </div>
                        <div className="h-56"><canvas ref={holidayChartRef} /></div>
                    </CardBody>
                </Card>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search placeholder="Search rules or holiday calendar..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
                <div className="flex flex-wrap items-center gap-2 justify-stretch sm:justify-end w-full lg:w-auto">
                    <select
                        value={holidayYear}
                        onChange={(e) => setHolidayYear(Number(e.target.value))}
                        className="h-9 rounded-md border border-line bg-paper px-2.5 text-xs font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <Button
                        onClick={() => loadHolidays(true)}
                        disabled={refreshing}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="whitespace-nowrap leading-none">Sync</span>
                        </span>
                    </Button>
                    <Button
                        onClick={openCalendarCreate}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-orange-600 text-white hover:bg-orange-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Add Date</span>
                        </span>
                    </Button>
                    <Button
                        onClick={openRuleCreate}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Add Rule</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                <CardBody className="p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                            <Gift className="h-3.5 w-3.5 text-rose-600" />
                            <p className="text-xs font-semibold text-ink font-rethink">Holiday Pay Rules</p>
                            <span className="text-[10px] text-muted font-rethink bg-ink/[0.03] px-2 py-0.5 rounded-full border border-line">
                                Annual — {holidayYear}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <Button onClick={handlePrintRules} className="h-8 px-2.5 rounded-md font-rethink text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                <span className="flex flex-row items-center justify-center gap-1.5">
                                    <Printer className="h-3.5 w-3.5 shrink-0" />
                                    <span className="whitespace-nowrap leading-none">Print</span>
                                </span>
                            </Button>
                            <Button onClick={handleExportRules} className="h-8 px-2.5 rounded-md font-rethink text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                <span className="flex flex-row items-center justify-center gap-1.5">
                                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                                    <span className="whitespace-nowrap leading-none">Excel</span>
                                </span>
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                            Loading…
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30 mb-3">
                                <Gift className="h-6 w-6 text-rose-500" />
                            </div>
                            <p className="text-sm font-medium text-ink font-rethink">No holiday pay rules yet</p>
                            <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                                Add one rule per employee to start computing holiday premiums.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rule</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Multiplier</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Base Amount</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Tax</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {filteredRules.map((rule) => (
                                            <motion.tr
                                                key={rule.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-pink-50/40 dark:hover:bg-pink-950/10"
                                            >
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-rose-100 text-[11px] font-semibold text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300">
                                                            {getEmployeeName(rule.employee_id).split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">{getEmployeeName(rule.employee_id)}</p>
                                                            <p className="text-[10px] text-muted font-rethink truncate">{rule.benefit_name}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-[11px] font-medium text-ink font-rethink">
                                                        <Sparkles className="h-3 w-3 text-pink-500" />
                                                        {rule.benefit_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 font-mono text-[12px] font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                                        {Number(rule.holiday_multiplier || 2).toFixed(2)}x
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold text-ink whitespace-nowrap">{peso(rule.amount)}</td>
                                                <td className="px-3 py-3 text-center">
                                                    {rule.is_taxable ? (
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
                                                    {rule.is_active ? (
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
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openRuleEdit(rule)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:scale-105 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400" aria-label="Edit rule">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button onClick={() => setDeleteRuleTarget(rule)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400" aria-label="Delete rule">
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
                    )}
                </CardBody>
            </Card>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                <CardBody className="p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-accent" />
                            <p className="text-xs font-semibold text-ink font-rethink">Philippine Holiday Calendar</p>
                            <span className="text-[10px] text-muted font-rethink bg-ink/[0.03] px-2 py-0.5 rounded-full border border-line">
                                {holidays.length} entries
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <Button onClick={handlePrintCalendar} className="h-8 px-2.5 rounded-md font-rethink text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                <span className="flex flex-row items-center justify-center gap-1.5">
                                    <Printer className="h-3.5 w-3.5 shrink-0" />
                                    <span className="whitespace-nowrap leading-none">Print</span>
                                </span>
                            </Button>
                            <Button onClick={handleExportCalendar} className="h-8 px-2.5 rounded-md font-rethink text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                <span className="flex flex-row items-center justify-center gap-1.5">
                                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                                    <span className="whitespace-nowrap leading-none">Excel</span>
                                </span>
                            </Button>
                        </div>
                    </div>

                    {filteredHolidays.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                                <CalendarDays className="h-6 w-6 text-blue-500" />
                            </div>
                            <p className="text-sm font-medium text-ink font-rethink">No holidays for {holidayYear}</p>
                            <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                                Click <span className="font-semibold text-purple-600">Sync</span> to fetch the Philippine holiday calendar.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Date</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Holiday</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Type</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {filteredHolidays.map((h) => {
                                            const style = HOLIDAY_TYPE_STYLES[h.type] || HOLIDAY_TYPE_STYLES.regular;
                                            const d = new Date(h.holiday_date);
                                            return (
                                                <motion.tr
                                                    key={h.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-accent/[0.03] dark:hover:bg-accent/[0.06]"
                                                >
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-paper text-center leading-none">
                                                                <span className="text-[9px] font-semibold uppercase text-muted">
                                                                    {d.toLocaleDateString(undefined, { month: 'short' })}
                                                                </span>
                                                                <span className="text-[13px] font-bold text-ink font-mono">{d.getDate()}</span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] text-muted font-rethink">
                                                                    {d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <p className="text-[13px] font-medium text-ink font-rethink break-words">{h.name}</p>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                                            {style.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-top">
                                                        <button
                                                            onClick={() => setDeleteHolidayTarget(h)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 opacity-70 group-hover:opacity-100 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            aria-label="Remove holiday"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {isRuleModalOpen && (
                <Modal
                    isOpen={isRuleModalOpen}
                    onClose={() => setIsRuleModalOpen(false)}
                    title={editRule ? 'Edit Holiday Pay Rule' : 'Add Holiday Pay Rule'}
                    className="max-w-lg"
                    accent="pink"
                    icon={Gift}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setIsRuleModalOpen(false)} disabled={isSavingRule} className="font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveRule} disabled={isSavingRule} className="font-rethink">
                                {isSavingRule ? 'Saving…' : editRule ? 'Save Changes' : 'Add Rule'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={ruleForm.employee_id}
                                onChange={(e) => setRuleForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Rule Name</label>
                            <Input
                                type="text"
                                value={ruleForm.benefit_name}
                                onChange={(e) => setRuleForm((f) => ({ ...f, benefit_name: e.target.value }))}
                                leftIcon={<Sparkles className="h-4 w-4 text-pink-500" />}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Base Amount</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={ruleForm.amount}
                                    onChange={(e) => setRuleForm((f) => ({ ...f, amount: e.target.value }))}
                                    leftIcon={
                                        <span className="flex items-center gap-1">
                                            <span className="flex h-4 w-4 items-center justify-center text-sm font-bold text-emerald-600">₱</span>
                                        </span>
                                    }
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Multiplier</label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="0.05"
                                    value={ruleForm.holiday_multiplier}
                                    onChange={(e) => setRuleForm((f) => ({ ...f, holiday_multiplier: e.target.value }))}
                                    leftIcon={<TrendingUp className="h-4 w-4 text-rose-500" />}
                                    rightIcon={<span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">x</span>}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Effective From</label>
                            <Input
                                type="date"
                                value={ruleForm.effective_date}
                                onChange={(e) => setRuleForm((f) => ({ ...f, effective_date: e.target.value }))}
                                min={`${holidayYear}-01-01`}
                                max={`${holidayYear}-12-31`}
                                leftIcon={<Calendar className="h-4 w-4 text-blue-500" />}
                            />
                            <p className="mt-1 text-[10px] text-muted font-rethink">
                                Annual rule — expiry automatically set to Dec 31.
                            </p>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-800/30 dark:bg-amber-950/20 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-ink font-rethink">Taxable benefit</span>
                                <button
                                    type="button"
                                    onClick={() => setRuleForm((f) => ({ ...f, is_taxable: !f.is_taxable }))}
                                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${ruleForm.is_taxable ? 'bg-accent' : 'bg-ink/15'}`}
                                >
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ruleForm.is_taxable ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-ink font-rethink">Counted on payroll</span>
                                <button
                                    type="button"
                                    onClick={() => setRuleForm((f) => ({ ...f, deduct_from_payroll: !f.deduct_from_payroll }))}
                                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${ruleForm.deduct_from_payroll ? 'bg-accent' : 'bg-ink/15'}`}
                                >
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ruleForm.deduct_from_payroll ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-ink font-rethink">Active</span>
                                <button
                                    type="button"
                                    onClick={() => setRuleForm((f) => ({ ...f, is_active: !f.is_active }))}
                                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${ruleForm.is_active ? 'bg-accent' : 'bg-ink/15'}`}
                                >
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${ruleForm.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {isCalendarModalOpen && (
                <Modal
                    isOpen={isCalendarModalOpen}
                    onClose={() => setIsCalendarModalOpen(false)}
                    title="Add Holiday Date"
                    className="max-w-md"
                    accent="purple"
                    icon={Calendar}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setIsCalendarModalOpen(false)} disabled={isSavingCalendar} className="font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveCalendar} disabled={isSavingCalendar} className="font-rethink">
                                {isSavingCalendar ? 'Saving…' : 'Add Holiday'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Date</label>
                            <Input
                                type="date"
                                value={calendarForm.holiday_date}
                                onChange={(e) => setCalendarForm((f) => ({ ...f, holiday_date: e.target.value }))}
                                min={`${new Date().getFullYear() - 3}-01-01`}
                                max={`${new Date().getFullYear()}-12-31`}
                                leftIcon={<CalendarDays className="h-4 w-4 text-blue-500" />}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Name</label>
                            <Input
                                type="text"
                                value={calendarForm.name}
                                onChange={(e) => setCalendarForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Independence Day"
                                leftIcon={<Gift className="h-4 w-4 text-purple-500" />}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Type</label>
                            <select
                                value={calendarForm.type}
                                onChange={(e) => setCalendarForm((f) => ({ ...f, type: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                            >
                                {HOLIDAY_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteRuleTarget && (
                <Modal
                    isOpen={!!deleteRuleTarget}
                    onClose={() => setDeleteRuleTarget(null)}
                    title="Delete Holiday Pay Rule"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setDeleteRuleTarget(null)} disabled={isDeleting} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={confirmDeleteRule} disabled={isDeleting} variant="danger" className="font-rethink">
                                {isDeleting ? 'Deleting…' : 'Delete Rule'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete holiday pay rule for {getEmployeeName(deleteRuleTarget.employee_id)}?
                        </p>
                    </div>
                </Modal>
            )}

            {deleteHolidayTarget && (
                <Modal
                    isOpen={!!deleteHolidayTarget}
                    onClose={() => setDeleteHolidayTarget(null)}
                    title="Remove Holiday"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setDeleteHolidayTarget(null)} disabled={isDeleting} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={confirmDeleteHoliday} disabled={isDeleting} variant="danger" className="font-rethink">
                                {isDeleting ? 'Removing…' : 'Remove Holiday'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Remove "{deleteHolidayTarget.name}" from the holiday calendar?
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default HolidayPayTab;