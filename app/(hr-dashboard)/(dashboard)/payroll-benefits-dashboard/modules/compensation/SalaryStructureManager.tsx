'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Loader2, Award, CheckCircle2, XCircle, TrendingUp, Briefcase,
    Printer, FileSpreadsheet, UserCircle2, History, Users, Wallet2,
    Coins, BarChart3, PieChart, Building2, CalendarClock,
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

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function cssVar(name: string, fallback: string) {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

const initialsOf = (name: string) =>
    (name || '??')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

/* Deterministic pastel avatar color from a string */
const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
    'from-amber-100 to-orange-100 text-amber-700 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-300',
    'from-purple-100 to-violet-100 text-purple-700 dark:from-purple-950/40 dark:to-violet-950/40 dark:text-purple-300',
    'from-cyan-100 to-sky-100 text-cyan-700 dark:from-cyan-950/40 dark:to-sky-950/40 dark:text-cyan-300',
];
const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

interface JobSettingRow {
    id: string;
    job_position_id: string;
    title: string;
    department: string;
    daily_rate: number;
    basic_salary: number;
    hours_per_day: number;
    break_hours: number;
    overtime_rate: number;
    is_active: boolean;
    edited_by?: string | null;
    last_modified_by_name?: string | null;
    created_at: string;
    updated_at: string;
}

interface EmployeeRow {
    id: number | null;
    employee_id: string;
    employee_name: string;
    employee_id_number: string;
    job_title: string | null;
    department: string | null;
    position_daily_rate: number;
    effective_daily_rate: number;
    custom_daily_rate: number | null;
    has_custom_rate: boolean;
    salary_adjustment_reason: string | null;
    daily_rate: number;
    hours_per_day: number;
    break_hours: number;
    overtime_rate: number;
    basic_salary: number | null;
    pay_schedule: string | null;
    incentives: number;
    attendance_status: string;
    attendance_count: number;
    date_hired: string | null;
    is_active: boolean;
    edited_by?: string | null;
}

function StatCard({ icon: Icon, label, value, tint }: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: 'blue' | 'emerald' | 'amber' | 'purple' | 'pink' | 'rose';
}) {
    const tints: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
        pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
            </div>
        </div>
    );
}

const SalaryStructureManager = () => {
    const toast = useToast();
    const [tab, setTab] = useState<'position' | 'employee'>('position');

    const [positions, setPositions] = useState<JobSettingRow[]>([]);
    const [employees, setEmployees] = useState<EmployeeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [positionDetail, setPositionDetail] = useState<JobSettingRow | null>(null);
    const [employeeDetail, setEmployeeDetail] = useState<EmployeeRow | null>(null);

    const { fetchData: fetchJobSettings } = useApi('/payroll-benefits-dashboard/api/payroll/job-settings');
    const { fetchData: fetchEmployeeInfo } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');

    const positionChartRef = useRef<HTMLCanvasElement | null>(null);
    const positionChartInstanceRef = useRef<Chart | null>(null);
    const departmentChartRef = useRef<HTMLCanvasElement | null>(null);
    const departmentChartInstanceRef = useRef<Chart | null>(null);
    const employeeChartRef = useRef<HTMLCanvasElement | null>(null);
    const employeeChartInstanceRef = useRef<Chart | null>(null);
    const customRateChartRef = useRef<HTMLCanvasElement | null>(null);
    const customRateChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [jobData, employeeData] = await Promise.all([
                fetchJobSettings().catch((e) => { console.error('job-settings failed:', e); return []; }),
                fetchEmployeeInfo().catch((e) => { console.error('employee-info failed:', e); return []; }),
            ]);
            setPositions(Array.isArray(jobData) ? jobData : []);
            setEmployees(Array.isArray(employeeData) ? employeeData : []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Unable to load salary structure.');
        } finally { setLoading(false); }
    };

    useEffect(() => { setSearchTerm(''); setCurrentPage(1); }, [tab]);

    const filteredPositions = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return positions;
        return positions.filter(
            (p) =>
                p.title?.toLowerCase().includes(term) ||
                p.department?.toLowerCase().includes(term)
        );
    }, [positions, searchTerm]);

    const filteredEmployees = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return employees;
        return employees.filter(
            (e) =>
                e.employee_name?.toLowerCase().includes(term) ||
                e.employee_id_number?.toLowerCase().includes(term) ||
                (e.job_title || '').toLowerCase().includes(term) ||
                (e.department || '').toLowerCase().includes(term)
        );
    }, [employees, searchTerm]);

    const activeRows = tab === 'position' ? filteredPositions : filteredEmployees;
    const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

    const paginatedPositions = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredPositions.slice(start, start + PAGE_SIZE);
    }, [filteredPositions, currentPage]);

    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEmployees.slice(start, start + PAGE_SIZE);
    }, [filteredEmployees, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const ratedCount = useMemo(() => positions.filter((p) => p.daily_rate > 0).length, [positions]);
    const avgRate = useMemo(
        () => (ratedCount > 0 ? positions.reduce((s, p) => s + (p.daily_rate || 0), 0) / ratedCount : 0),
        [positions, ratedCount]
    );
    const openCount = useMemo(() => positions.filter((p) => p.is_active).length, [positions]);
    const unsetCount = useMemo(
        () => positions.filter((p) => !p.daily_rate || p.daily_rate <= 0).length,
        [positions]
    );

    const totalEmployees = employees.length;
    const customRateCount = useMemo(
        () => employees.filter((e) => e.has_custom_rate).length,
        [employees]
    );
    const avgEffectiveRate = useMemo(
        () => employees.length > 0
            ? employees.reduce((s, e) => s + (e.effective_daily_rate || 0), 0) / employees.length
            : 0,
        [employees]
    );
    const totalIncentives = useMemo(
        () => employees.reduce((s, e) => s + (e.incentives || 0), 0),
        [employees]
    );

    const topRatedPositions = useMemo(
        () => [...positions].filter((p) => p.daily_rate > 0).sort((a, b) => b.daily_rate - a.daily_rate).slice(0, 7),
        [positions]
    );

    const departmentCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        positions.forEach((p) => {
            const d = p.department || 'Unassigned';
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    }, [positions]);

    const topEmployeeRates = useMemo(
        () => [...employees].sort((a, b) => (b.effective_daily_rate || 0) - (a.effective_daily_rate || 0)).slice(0, 7),
        [employees]
    );

    useEffect(() => {
        if (loading || tab !== 'position' || !positionChartRef.current) return;
        positionChartInstanceRef.current?.destroy();
        if (topRatedPositions.length === 0) return;

        positionChartInstanceRef.current = new Chart(positionChartRef.current, {
            type: 'bar',
            data: {
                labels: topRatedPositions.map((p) => p.title),
                datasets: [{
                    label: 'Daily Rate',
                    data: topRatedPositions.map((p) => p.daily_rate),
                    backgroundColor: cssVar('--accent', '#e5167e'),
                    borderRadius: 6,
                    barThickness: 20,
                }],
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `₱${Number(ctx.raw).toLocaleString()}` } },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76'), font: { size: 10 } },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    y: { ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } }, grid: { display: false } },
                },
            },
        });
        return () => { positionChartInstanceRef.current?.destroy(); };
    }, [topRatedPositions, loading, tab]);

    useEffect(() => {
        if (loading || tab !== 'position' || !departmentChartRef.current) return;
        departmentChartInstanceRef.current?.destroy();
        const labels = Object.keys(departmentCounts);
        if (labels.length === 0) return;
        const palette = [
            cssVar('--accent', '#e5167e'),
            cssVar('--sss', '#2455c7'),
            cssVar('--philhealth', '#0b8f6b'),
            cssVar('--pagibig', '#b8720e'),
            '#8b5cf6', '#f59e0b', '#06b6d4',
        ];
        departmentChartInstanceRef.current = new Chart(departmentChartRef.current, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: labels.map((l) => departmentCounts[l]),
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
        return () => { departmentChartInstanceRef.current?.destroy(); };
    }, [departmentCounts, loading, tab]);

    useEffect(() => {
        if (loading || tab !== 'employee' || !employeeChartRef.current) return;
        employeeChartInstanceRef.current?.destroy();
        if (topEmployeeRates.length === 0) return;
        employeeChartInstanceRef.current = new Chart(employeeChartRef.current, {
            type: 'bar',
            data: {
                labels: topEmployeeRates.map((e) => e.employee_name),
                datasets: [{
                    label: 'Effective Daily Rate',
                    data: topEmployeeRates.map((e) => e.effective_daily_rate),
                    backgroundColor: cssVar('--philhealth', '#0b8f6b'),
                    borderRadius: 6,
                    barThickness: 20,
                }],
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `₱${Number(ctx.raw).toLocaleString()}` } },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => `₱${v}`, color: cssVar('--muted', '#6b6b76'), font: { size: 10 } },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    y: { ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } }, grid: { display: false } },
                },
            },
        });
        return () => { employeeChartInstanceRef.current?.destroy(); };
    }, [topEmployeeRates, loading, tab]);

    useEffect(() => {
        if (loading || tab !== 'employee' || !customRateChartRef.current) return;
        customRateChartInstanceRef.current?.destroy();
        const custom = customRateCount;
        const standard = Math.max(totalEmployees - custom, 0);
        if (custom === 0 && standard === 0) return;
        customRateChartInstanceRef.current = new Chart(customRateChartRef.current, {
            type: 'doughnut',
            data: {
                labels: ['Custom Rate', 'Position Default'],
                datasets: [{
                    data: [custom, standard],
                    backgroundColor: [cssVar('--pagibig', '#b8720e'), cssVar('--line', '#eaeaea')],
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
        return () => { customRateChartInstanceRef.current?.destroy(); };
    }, [customRateCount, totalEmployees, loading, tab]);

    const positionPrintColumns: PrintColumn[] = [
        { key: 'title', label: 'Position' },
        { key: 'department', label: 'Department' },
        { key: 'daily_rate', label: 'Daily Rate', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'basic_salary', label: 'Monthly Basic Salary', align: 'right', format: (v, row: any) => printFormatters.peso(Number(row.daily_rate) * 24) },
        { key: 'hours_per_day', label: 'Hours / Day', align: 'center', format: (v) => `${v}h` },
        { key: 'break_hours', label: 'Break (hrs)', align: 'center', format: (v) => `${v}h` },
        { key: 'overtime_rate', label: 'OT Multiplier', align: 'center', format: (v) => `${v}x` },
        { key: 'is_active', label: 'Status', format: (v) => (v ? 'Open for Hiring' : 'Closed') },
        { key: 'last_modified_by_name', label: 'Last Edited By', format: (v) => printFormatters.text(v || '—') },
        { key: 'updated_at', label: 'Last Updated', format: (v) => printFormatters.date(v) },
    ];

    const employeePrintColumns: PrintColumn[] = [
        { key: 'employee_name', label: 'Employee' },
        { key: 'employee_id_number', label: 'Employee ID' },
        { key: 'job_title', label: 'Position', format: (v) => printFormatters.text(v || '—') },
        { key: 'department', label: 'Department', format: (v) => printFormatters.text(v || '—') },
        { key: 'position_daily_rate', label: 'Position Rate', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'custom_daily_rate', label: 'Custom Rate', align: 'right', format: (v) => (v != null ? printFormatters.peso(v) : '—') },
        { key: 'effective_daily_rate', label: 'Effective Rate', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'basic_salary', label: 'Monthly Salary', align: 'right', format: (v) => printFormatters.peso(v || 0) },
        { key: 'incentives', label: 'Incentives', align: 'right', format: (v) => printFormatters.peso(v || 0) },
        { key: 'has_custom_rate', label: 'Rate Source', format: (v) => (v ? 'Custom' : 'Position Default') },
        { key: 'salary_adjustment_reason', label: 'Adjustment Reason', format: (v) => printFormatters.text(v || '—') },
    ];

    const handlePrintPositions = () => {
        if (filteredPositions.length === 0) { toast.showError('Nothing to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Salary Structure — By Job Position',
            reportSubtitle: 'Position-based salary framework (from Job Settings)',
            filters: {
                'Total Positions': positions.length,
                Rated: ratedCount,
                'Average Daily Rate': peso(avgRate),
                'Open for Hiring': openCount,
                'Rate Not Set': unsetCount,
            },
            logoPath: '/images/logo-remove-bg.png',
        }, positionPrintColumns, filteredPositions.map((p) => ({ ...p, basic_salary: Number(p.daily_rate) * 24 })));
    };

    const handleExportPositions = () => {
        if (filteredPositions.length === 0) { toast.showError('Nothing to export.'); return; }
        exportExcel(
            `salary-structure-by-position-${new Date().toISOString().split('T')[0]}`,
            positionPrintColumns,
            filteredPositions.map((p) => ({ ...p, basic_salary: Number(p.daily_rate) * 24 })),
            {
                reportTitle: 'Salary Structure — By Job Position',
                reportSubtitle: 'Position-based salary framework (from Job Settings)',
                filters: { 'Total Positions': positions.length, Rated: ratedCount, 'Average Daily Rate': peso(avgRate), 'Open for Hiring': openCount },
            }
        );
        toast.showSuccess('Salary structure (by position) exported to Excel.');
    };

    const handlePrintEmployees = () => {
        if (filteredEmployees.length === 0) { toast.showError('Nothing to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Salary Structure — By Employee',
            reportSubtitle: 'Per-employee salary framework (from Job Settings)',
            filters: {
                'Total Employees': totalEmployees,
                'On Custom Rate': customRateCount,
                'Avg. Effective Rate': peso(avgEffectiveRate),
                'Total Incentives': peso(totalIncentives),
            },
            logoPath: '/images/logo-remove-bg.png',
        }, employeePrintColumns, filteredEmployees);
    };

    const handleExportEmployees = () => {
        if (filteredEmployees.length === 0) { toast.showError('Nothing to export.'); return; }
        exportExcel(
            `salary-structure-by-employee-${new Date().toISOString().split('T')[0]}`,
            employeePrintColumns,
            filteredEmployees,
            {
                reportTitle: 'Salary Structure — By Employee',
                reportSubtitle: 'Per-employee salary framework (from Job Settings)',
                filters: { 'Total Employees': totalEmployees, 'On Custom Rate': customRateCount, 'Avg. Effective Rate': peso(avgEffectiveRate), 'Total Incentives': peso(totalIncentives) },
            }
        );
        toast.showSuccess('Salary structure (by employee) exported to Excel.');
    };

    const handlePrint = () => { tab === 'position' ? handlePrintPositions() : handlePrintEmployees(); };
    const handleExportExcel = () => { tab === 'position' ? handleExportPositions() : handleExportEmployees(); };

    return (
        <div className="space-y-5">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-line dark:border-line/30 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setTab('position')}
                    className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${tab === 'position' ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink/80'
                        }`}
                >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${tab === 'position' ? 'bg-accent/10 text-accent' : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                        }`}>
                        <Briefcase className="h-3.5 w-3.5" />
                    </span>
                    <span>By Job Position</span>
                </button>
                <button
                    type="button"
                    onClick={() => setTab('employee')}
                    className={`group relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium font-rethink transition-colors whitespace-nowrap ${tab === 'employee' ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink/80'
                        }`}
                >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${tab === 'employee' ? 'bg-accent/10 text-accent' : 'bg-ink/[0.03] text-muted group-hover:bg-ink/[0.06] group-hover:text-ink/70'
                        }`}>
                        <Users className="h-3.5 w-3.5" />
                    </span>
                    <span>By Employee</span>
                </button>
            </div>

            {tab === 'position' && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard icon={Briefcase} label="Total Positions" value={String(positions.length)} tint="blue" />
                        <StatCard icon={Award} label="Rated Positions" value={String(ratedCount)} tint="emerald" />
                        <StatCard icon={TrendingUp} label="Avg. Daily Rate" value={peso(avgRate)} tint="purple" />
                        <StatCard icon={XCircle} label="Rate Not Set" value={String(unsetCount)} tint="rose" />
                    </div>

                    {!loading && positions.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                            <Card variant="default" padding="none" className="lg:col-span-3 bg-paper border-line overflow-hidden dark:border-line/30">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <BarChart3 className="h-3.5 w-3.5 text-philhealth" />
                                        <p className="text-xs font-semibold text-ink font-rethink">Top Daily Rates by Position</p>
                                    </div>
                                    {topRatedPositions.length === 0 ? (
                                        <p className="py-10 text-center text-xs text-muted font-rethink">No rated positions yet.</p>
                                    ) : (
                                        <div style={{ height: Math.min(topRatedPositions.length, 7) * 38 + 20 }}>
                                            <canvas ref={positionChartRef} />
                                        </div>
                                    )}
                                </CardBody>
                            </Card>

                            <Card variant="default" padding="none" className="lg:col-span-2 bg-paper border-line overflow-hidden dark:border-line/30">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <PieChart className="h-3.5 w-3.5 text-accent" />
                                        <p className="text-xs font-semibold text-ink font-rethink">Position Distribution by Department</p>
                                    </div>
                                    <div className="h-56"><canvas ref={departmentChartRef} /></div>
                                </CardBody>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {tab === 'employee' && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard icon={Users} label="Total Employees" value={String(totalEmployees)} tint="blue" />
                        <StatCard icon={Wallet2} label="On Custom Rate" value={String(customRateCount)} tint="amber" />
                        <StatCard icon={TrendingUp} label="Avg. Effective Rate" value={peso(avgEffectiveRate)} tint="purple" />
                        <StatCard icon={Coins} label="Total Incentives" value={peso(totalIncentives)} tint="emerald" />
                    </div>

                    {!loading && employees.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                            <Card variant="default" padding="none" className="lg:col-span-3 bg-paper border-line overflow-hidden dark:border-line/30">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <BarChart3 className="h-3.5 w-3.5 text-philhealth" />
                                        <p className="text-xs font-semibold text-ink font-rethink">Top Effective Rates by Employee</p>
                                    </div>
                                    {topEmployeeRates.length === 0 ? (
                                        <p className="py-10 text-center text-xs text-muted font-rethink">No employee rates yet.</p>
                                    ) : (
                                        <div style={{ height: Math.min(topEmployeeRates.length, 7) * 38 + 20 }}>
                                            <canvas ref={employeeChartRef} />
                                        </div>
                                    )}
                                </CardBody>
                            </Card>

                            <Card variant="default" padding="none" className="lg:col-span-2 bg-paper border-line overflow-hidden dark:border-line/30">
                                <CardBody className="p-4">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <PieChart className="h-3.5 w-3.5 text-pagibig" />
                                        <p className="text-xs font-semibold text-ink font-rethink">Custom vs. Position Default</p>
                                    </div>
                                    <div className="h-56"><canvas ref={customRateChartRef} /></div>
                                </CardBody>
                            </Card>
                        </div>
                    )}
                </>
            )}

            {/* Toolbar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search
                    placeholder={tab === 'position' ? 'Search position or department...' : 'Search employee, ID, or position...'}
                    onSearch={setSearchTerm}
                    className="w-full lg:max-w-sm"
                />
                <div className="flex gap-2 flex-wrap justify-stretch sm:justify-end w-full lg:w-auto">
                    <Button
                        onClick={handlePrint}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex-1 sm:flex-none"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Print</span>
                        </span>
                    </Button>
                    <Button
                        onClick={handleExportExcel}
                        className="font-rethink text-xs h-9 px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex-1 sm:flex-none"
                    >
                        <span className="flex flex-row items-center justify-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap leading-none">Export Excel</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Alert
                variant="info"
                message="This view is read-only. To add or change rates, go to Job Settings — By Job Position for position rates, By Employee for per-employee customization."
            />

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading salary structure…
                    </div>
                ) : tab === 'position' ? (
                    positions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                                <Briefcase className="h-6 w-6 text-blue-500" />
                            </div>
                            <p className="text-sm font-medium text-ink font-rethink">No position rates yet</p>
                            <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                                Configure positions in Job Settings → By Job Position.
                            </p>
                        </div>
                    ) : filteredPositions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                                <Briefcase className="h-6 w-6 text-blue-500" />
                            </div>
                            <p className="text-sm font-medium text-ink font-rethink">No positions match your search</p>
                            <p className="text-xs text-muted font-rethink mt-1">Try a different keyword.</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Position</th>
                                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Department</th>
                                            <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Daily Rate</th>
                                            <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Monthly Basic</th>
                                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">OT</th>
                                            <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Last Edited By</th>
                                            <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <AnimatePresence initial={false}>
                                            {paginatedPositions.map((row) => (
                                                <motion.tr
                                                    key={row.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/10"
                                                >
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold bg-gradient-to-br ${avatarClass(row.title || row.id)}`}>
                                                                <Briefcase className="h-3.5 w-3.5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-medium text-ink font-rethink truncate max-w-[160px]">{row.title}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {row.department ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-ink/80 font-rethink dark:bg-ink/[0.08]">
                                                                <Building2 className="h-3 w-3 text-muted" />
                                                                {row.department}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted italic text-[12px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        {row.daily_rate > 0 ? (
                                                            <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[12px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                                {peso(row.daily_rate)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted italic text-[12px]">Not set</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        {row.daily_rate > 0 ? (
                                                            <span className="font-mono font-semibold text-[13px] text-accent">
                                                                {peso(row.daily_rate * 24)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted text-[12px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-mono text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                            {row.overtime_rate}x
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        {row.is_active ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Open
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:ring-gray-700">
                                                                <XCircle className="h-3 w-3" />
                                                                Closed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap max-w-[160px]">
                                                        {row.last_modified_by_name ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink font-rethink">
                                                                <UserCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                                                                <span className="truncate">{row.last_modified_by_name}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic font-rethink">Never edited</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right whitespace-nowrap">
                                                        <button
                                                            onClick={() => setPositionDetail(row)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 opacity-70 group-hover:opacity-100 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                            aria-label="View details"
                                                        >
                                                            <History className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden space-y-2.5 p-3">
                                <AnimatePresence initial={false}>
                                    {paginatedPositions.map((row) => (
                                        <motion.div
                                            key={row.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2.5 min-w-0">
                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${avatarClass(row.title || row.id)}`}>
                                                        <Briefcase className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-ink font-rethink truncate">{row.title}</p>
                                                        <p className="text-[11px] text-muted font-rethink truncate">{row.department || '—'}</p>
                                                    </div>
                                                </div>
                                                <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(row.daily_rate)}
                                                </p>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="rounded-md bg-accent/5 px-2 py-1.5">
                                                    <p className="text-[9px] uppercase tracking-wide text-accent">Monthly Basic</p>
                                                    <p className="font-mono font-semibold text-accent">{peso(row.daily_rate * 24)}</p>
                                                </div>
                                                <div className="rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
                                                    <p className="text-[9px] uppercase tracking-wide text-amber-600">OT Multiplier</p>
                                                    <p className="font-mono font-semibold text-amber-700 dark:text-amber-400">{row.overtime_rate}x</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-line/30">
                                                {row.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Open
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                                                        <XCircle className="h-3 w-3" />
                                                        Closed
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setPositionDetail(row)}
                                                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                >
                                                    <History className="h-3 w-3" />
                                                    Details
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            {totalPages > 1 && (
                                <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPageChange={setCurrentPage}
                                        itemsPerPage={PAGE_SIZE}
                                        totalItems={filteredPositions.length}
                                    />
                                </div>
                            )}
                        </>
                    )
                ) : employees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                            <Users className="h-6 w-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No employee payroll records yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Configure them in Job Settings → By Employee.
                        </p>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                            <Users className="h-6 w-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No employees match your search</p>
                        <p className="text-xs text-muted font-rethink mt-1">Try a different keyword.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Position</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Position Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Custom Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Effective Rate</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Monthly Salary</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Incentives</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedEmployees.map((row) => (
                                            <motion.tr
                                                key={row.employee_id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[200px]">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(row.employee_name || row.employee_id)}`}>
                                                            {initialsOf(row.employee_name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">
                                                                {row.employee_name}
                                                            </p>
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                {row.employee_id_number}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[160px]">
                                                    <p className="text-[12px] text-ink font-rethink truncate">
                                                        {row.job_title || '—'}
                                                    </p>
                                                    {row.department && (
                                                        <p className="text-[10px] text-muted font-rethink truncate">
                                                            {row.department}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[12px] text-ink whitespace-nowrap">
                                                    {peso(row.position_daily_rate)}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    {row.has_custom_rate ? (
                                                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-mono text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                            {peso(row.custom_daily_rate)}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-ink/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted dark:bg-ink/[0.08]">
                                                            Default
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="font-mono font-semibold text-[13px] text-accent">
                                                        {peso(row.effective_daily_rate)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 font-mono text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                        {peso(row.basic_salary || row.effective_daily_rate * 24)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    {row.incentives > 0 ? (
                                                        <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 font-mono text-[12px] font-semibold text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:ring-teal-800/40">
                                                            {peso(row.incentives)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted text-[12px]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => setEmployeeDetail(row)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 opacity-70 group-hover:opacity-100 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                        aria-label="View details"
                                                    >
                                                        <History className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-2.5 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedEmployees.map((row) => (
                                    <motion.div
                                        key={row.employee_id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(row.employee_name || row.employee_id)}`}>
                                                    {initialsOf(row.employee_name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-ink font-rethink truncate">
                                                        {row.employee_name}
                                                    </p>
                                                    <p className="text-[11px] text-muted font-rethink truncate">
                                                        {row.job_title || row.department || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            {row.has_custom_rate ? (
                                                <span className="shrink-0 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
                                                    Custom
                                                </span>
                                            ) : (
                                                <span className="shrink-0 inline-flex items-center rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-muted">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Position Rate</p>
                                                <p className="font-mono text-ink">{peso(row.position_daily_rate)}</p>
                                            </div>
                                            <div className="rounded-md bg-accent/5 px-2 py-1.5">
                                                <p className="text-[9px] uppercase tracking-wide text-accent">Effective Rate</p>
                                                <p className="font-mono font-semibold text-accent">
                                                    {peso(row.effective_daily_rate)}
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-emerald-600">Monthly Salary</p>
                                                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                                    {peso(row.basic_salary || row.effective_daily_rate * 24)}
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-teal-50 px-2 py-1.5 dark:bg-teal-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-teal-600">Incentives</p>
                                                <p className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                                                    {peso(row.incentives || 0)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-end border-t border-line pt-2.5 dark:border-line/30">
                                            <button
                                                onClick={() => setEmployeeDetail(row)}
                                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                            >
                                                <History className="h-3 w-3" />
                                                Details
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5 dark:border-line/30">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={filteredEmployees.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {positionDetail && (
                <Modal
                    isOpen={!!positionDetail}
                    onClose={() => setPositionDetail(null)}
                    title={positionDetail.title}
                    className="max-w-md"
                    accent="pink"
                    icon={Briefcase}
                    footer={
                        <Button type="button" variant="outline" onClick={() => setPositionDetail(null)} className="font-rethink">Close</Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarClass(positionDetail.title || positionDetail.id)}`}>
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink font-rethink truncate">{positionDetail.title}</p>
                                <p className="text-[11px] text-muted font-rethink">{positionDetail.department || '—'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Daily Rate</p>
                                <p className="text-sm font-mono font-semibold text-ink mt-0.5">{peso(positionDetail.daily_rate)}</p>
                            </div>
                            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-accent font-rethink">Monthly Basic</p>
                                <p className="text-sm font-mono font-semibold text-accent mt-0.5">{peso(positionDetail.daily_rate * 24)}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Hours / Day</p>
                                <p className="text-sm font-mono text-ink mt-0.5">{positionDetail.hours_per_day}h</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Break</p>
                                <p className="text-sm font-mono text-ink mt-0.5">{positionDetail.break_hours}h</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">OT Multiplier</p>
                                <p className="text-sm font-mono text-ink mt-0.5">{positionDetail.overtime_rate}x</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Status</p>
                                <p className="text-sm font-rethink mt-0.5">
                                    {positionDetail.is_active ? (
                                        <span className="text-emerald-700">Open for Hiring</span>
                                    ) : (
                                        <span className="text-muted">Closed</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                            <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Last Updated</p>
                            <p className="text-sm text-ink font-rethink mt-0.5">
                                {printFormatters.date(positionDetail.updated_at)}
                                {positionDetail.last_modified_by_name ? ` — ${positionDetail.last_modified_by_name}` : ''}
                            </p>
                        </div>

                        <p className="text-[11px] text-muted font-rethink">
                            Edit this position rate in Job Settings → By Job Position.
                        </p>
                    </div>
                </Modal>
            )}

            {employeeDetail && (
                <Modal
                    isOpen={!!employeeDetail}
                    onClose={() => setEmployeeDetail(null)}
                    title={employeeDetail.employee_name}
                    className="max-w-md"
                    accent="pink"
                    icon={Users}
                    footer={
                        <Button type="button" variant="outline" onClick={() => setEmployeeDetail(null)} className="font-rethink">Close</Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-gradient-to-br ${avatarClass(employeeDetail.employee_name || employeeDetail.employee_id)}`}>
                                {initialsOf(employeeDetail.employee_name)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink font-rethink truncate">{employeeDetail.employee_name}</p>
                                <p className="text-[11px] text-muted font-rethink">{employeeDetail.employee_id_number}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-rethink text-muted">
                            <span>{employeeDetail.job_title || '—'}</span>
                            <span className="text-muted/30">•</span>
                            <span>{employeeDetail.department || '—'}</span>
                            {employeeDetail.date_hired && (
                                <>
                                    <span className="text-muted/30">•</span>
                                    <span className="inline-flex items-center gap-1">
                                        <CalendarClock className="h-3 w-3" />
                                        Hired {printFormatters.date(employeeDetail.date_hired)}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Position Rate</p>
                                <p className="text-sm font-mono text-ink mt-0.5">{peso(employeeDetail.position_daily_rate)}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Custom Rate</p>
                                <p className={`text-sm font-mono mt-0.5 ${employeeDetail.has_custom_rate ? 'font-semibold text-pagibig' : 'text-muted'}`}>
                                    {employeeDetail.custom_daily_rate != null ? peso(employeeDetail.custom_daily_rate) : '—'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-accent font-rethink">Effective Daily Rate</p>
                                <p className="text-sm font-mono font-semibold text-accent mt-0.5">{peso(employeeDetail.effective_daily_rate)}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200/40 bg-emerald-50 p-3 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                                <p className="text-[10px] uppercase tracking-wide text-emerald-600 font-rethink">Monthly Salary</p>
                                <p className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    {peso(employeeDetail.basic_salary || employeeDetail.effective_daily_rate * 24)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-teal-200/40 bg-teal-50 p-3 dark:border-teal-800/30 dark:bg-teal-950/30">
                                <p className="text-[10px] uppercase tracking-wide text-teal-600 font-rethink">Incentives</p>
                                <p className="text-sm font-mono font-semibold text-teal-700 dark:text-teal-400 mt-0.5">{peso(employeeDetail.incentives || 0)}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Rate Source</p>
                                <p className="text-sm font-rethink mt-0.5">
                                    {employeeDetail.has_custom_rate ? 'Custom Rate' : 'Position Default'}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                            <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Salary Adjustment Reason</p>
                            <p className="text-sm text-ink font-rethink mt-0.5">{employeeDetail.salary_adjustment_reason || '—'}</p>
                        </div>

                        <div className="rounded-lg border border-line bg-ink/[0.02] p-3 dark:bg-ink/[0.05]">
                            <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">Pay Schedule</p>
                            <p className="text-sm text-ink font-rethink mt-0.5 capitalize">
                                {(employeeDetail.pay_schedule || 'semi_monthly').replace('_', '-')}
                            </p>
                        </div>

                        <p className="text-[11px] text-muted font-rethink">
                            Customize this employee's rate in Job Settings → By Employee.
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SalaryStructureManager;