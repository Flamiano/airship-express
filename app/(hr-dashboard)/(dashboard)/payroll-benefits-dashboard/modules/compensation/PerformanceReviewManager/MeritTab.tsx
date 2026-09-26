'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, BarChart3, Users, AlertTriangle,
    TrendingUp, Star, Clock, Printer, FileSpreadsheet, Sparkles, Info,
    CheckCircle2, XCircle, PieChart, Bell,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import OtpModal from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpModal';
import OtpUnlockBanner from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/OtpUnlockBanner';
import { useOtpSessionContext } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/providers/OtpSessionProvider';
import { printTable, exportExcel, printFormatters, PrintColumn } from '../../../modules/compensation/print-utils';
import {
    StatCard, peso, avatarClass, initialsOf, cssVar, todayISO,
    MERIT_POLICY, RATING_LABEL, STATUS_STYLES,
    employeeHasBank, starsFromRating,
    type LatestPerformanceRating,
    type LatestPerformanceRatingMap,
} from './shared';

const COVERAGE_PAGE_SIZE = 8;

const EMPTY_MERIT_FORM = {
    employee_id: '',
    performance_appraisal_id: '',
    performance_rating: '',
    current_salary: '',
    recommended_increase_percent: '',
    recommended_new_salary: '',
    proposed_effective_date: todayISO(),
    approver_notes: '',
    status: 'draft',
};

type PendingAction =
    | { kind: 'save'; payload: any; isEdit: boolean; editId?: any }
    | { kind: 'delete'; id: any; name: string }
    | null;

const MeritTab = () => {
    const toast = useToast();
    const { active, secondsLeft, unlock, lock } = useOtpSessionContext();

    const [meritPlans, setMeritPlans] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [latestRatings, setLatestRatings] = useState<LatestPerformanceRatingMap>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [coveragePage, setCoveragePage] = useState(1);
    const [coverageFilter, setCoverageFilter] = useState<'all' | 'rated' | 'unrated'>('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [form, setForm] = useState(EMPTY_MERIT_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [isOtpOpen, setIsOtpOpen] = useState(false);
    const [otpPurpose, setOtpPurpose] = useState<'merit' | 'merit_delete'>('merit');

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/merit-planning');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');
    const { fetchData: fetchLatestRatings } = useApi('/payroll-benefits-dashboard/api/compensation/latest-ratings');

    const ratingDistChartRef = useRef<HTMLCanvasElement | null>(null);
    const ratingDistChartInstanceRef = useRef<Chart | null>(null);
    const topRatedChartRef = useRef<HTMLCanvasElement | null>(null);
    const topRatedChartInstanceRef = useRef<Chart | null>(null);
    const coverageChartRef = useRef<HTMLCanvasElement | null>(null);
    const coverageChartInstanceRef = useRef<Chart | null>(null);

    useEffect(() => {
        loadAllRatingsOnce();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadMeritPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]);

    const loadAllRatingsOnce = async () => {
        setLoading(true);
        try {
            const [employeeData, ratingData] = await Promise.all([
                fetchEmployees().catch(() => []),
                fetchLatestRatings().catch(() => []),
            ]);
            setEmployees(Array.isArray(employeeData) ? employeeData : []);

            const map: LatestPerformanceRatingMap = {};
            const years: number[] = [];
            if (Array.isArray(ratingData)) {
                ratingData.forEach((r: LatestPerformanceRating) => {
                    if (!r?.employee_id) return;
                    map[r.employee_id] = r;
                    if (r.cycle_year != null) years.push(r.cycle_year);
                });
            }
            setLatestRatings(map);

            if (years.length > 0) {
                const latestYear = Math.max(...years);
                setSelectedYear((prev) => (years.includes(prev) ? prev : latestYear));
            }
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load ratings');
        } finally {
            setLoading(false);
        }
    };

    const loadMeritPlans = async () => {
        try {
            const meritData = await fetchData(`?fiscal_year=${selectedYear}`).catch(() => []);
            setMeritPlans(Array.isArray(meritData) ? meritData : []);
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to load merit plans');
        }
    };

    const ratingsForYear = useMemo(() => {
        const out: LatestPerformanceRatingMap = {};
        Object.entries(latestRatings).forEach(([empId, r]) => {
            if (r.cycle_year == null || r.cycle_year === selectedYear) {
                out[empId] = r;
            }
        });
        return out;
    }, [latestRatings, selectedYear]);

    const getCurrentSalaryForEmployee = (employeeId: string): number => {
        const emp = employees.find((e) => e.employee_id === employeeId);
        if (!emp) return 0;
        return (
            Number(emp.effective_daily_rate) * 24 ||
            Number(emp.basic_salary) ||
            Number(emp.daily_rate) * 24 ||
            0
        );
    };

    const activeRatingSource = (employeeId: string): LatestPerformanceRating | null =>
        ratingsForYear[employeeId] || null;

    const getEmployeeName = (id: string) => {
        const emp = employees.find((e) => e.employee_id === id);
        return emp?.employee_name || 'Unknown Employee';
    };

    const getEmployeeNumber = (id: string) => {
        const emp = employees.find((e) => e.employee_id === id);
        return emp?.employee_id_number || '';
    };

    const openCreate = () => {
        setEditTarget(null);
        setForm({ ...EMPTY_MERIT_FORM, proposed_effective_date: todayISO() });
        setIsModalOpen(true);
    };

    const openEdit = (plan: any) => {
        setEditTarget(plan);
        setForm({
            employee_id: plan.employee_id,
            performance_appraisal_id: plan.performance_appraisal_id || '',
            performance_rating: String(plan.performance_rating || ''),
            current_salary: String(plan.current_salary || ''),
            recommended_increase_percent: String(plan.recommended_increase_percent ?? ''),
            recommended_new_salary: String(plan.recommended_new_salary ?? ''),
            proposed_effective_date: plan.proposed_effective_date?.split('T')[0] || todayISO(),
            approver_notes: plan.approver_notes || '',
            status: plan.status || 'draft',
        });
        setIsModalOpen(true);
    };

    const handleEmployeeChange = (employeeId: string) => {
        const hr3 = ratingsForYear[employeeId];
        const currentSalary = getCurrentSalaryForEmployee(employeeId);
        const ratingNum =
            hr3?.performance_rating != null ? Number(hr3.performance_rating) : null;
        const pct = ratingNum != null ? MERIT_POLICY[ratingNum] ?? 0 : 0;
        const suggestedNew = currentSalary + currentSalary * (pct / 100);

        setForm((f) => ({
            ...f,
            employee_id: employeeId,
            performance_appraisal_id: hr3?.appraisal_id || '',
            performance_rating: ratingNum != null ? String(ratingNum) : '',
            current_salary: currentSalary ? String(currentSalary) : '',
            recommended_increase_percent: pct ? String(pct) : '',
            recommended_new_salary:
                suggestedNew > 0 ? String(Math.round(suggestedNew * 100) / 100) : '',
        }));
    };

    const applyPolicy = () => {
        const ratingNum = Number(form.performance_rating);
        if (!ratingNum) return;
        const pct = MERIT_POLICY[ratingNum] ?? 0;
        const current = Number(form.current_salary) || 0;
        const newSalary = current + current * (pct / 100);
        setForm((f) => ({
            ...f,
            recommended_increase_percent: String(pct),
            recommended_new_salary: String(Math.round(newSalary * 100) / 100),
        }));
    };

    const buildPayload = () => ({
        employee_id: form.employee_id,
        fiscal_year: selectedYear,
        performance_appraisal_id: form.performance_appraisal_id || null,
        performance_rating: Number(form.performance_rating) || 0,
        current_salary: Number(form.current_salary) || 0,
        recommended_increase_percent: Number(form.recommended_increase_percent) || 0,
        recommended_new_salary: Number(form.recommended_new_salary) || 0,
        proposed_effective_date: form.proposed_effective_date,
        approver_notes: form.approver_notes.trim(),
        status: form.status,
    });

    const handleSave = async () => {
        if (!form.employee_id) { toast.showError('Select an employee'); return; }
        if (!activeRatingSource(form.employee_id)) {
            toast.showError(`Cannot create merit plan — no HR3 rating for this employee in ${selectedYear}.`);
            return;
        }
        if (!form.performance_rating) { toast.showError('No performance rating available'); return; }
        if (!form.recommended_new_salary) { toast.showError('New salary is required'); return; }
        if (!form.proposed_effective_date) { toast.showError('Effective date is required'); return; }
        if (!form.approver_notes.trim()) { toast.showError('Approver notes are required'); return; }
        if (!employeeHasBank(employees, form.employee_id)) {
            toast.showError('Cannot save — this employee has no bank account on file.');
            return;
        }

        const payload = buildPayload();
        const isEdit = !!editTarget;
        const editId = editTarget?.id;

        if (!active) {
            setPendingAction({ kind: 'save', payload, isEdit, editId });
            setOtpPurpose('merit');
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
                toast.showSuccess('Merit plan updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Merit plan created');
            }
            setIsModalOpen(false);
            setForm({ ...EMPTY_MERIT_FORM, proposed_effective_date: todayISO() });
            setEditTarget(null);
            setPendingAction(null);
            loadMeritPlans();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to save merit plan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = (plan: any) => {
        if (!plan?.id) {
            toast.showError('Cannot delete — invalid record');
            return;
        }

        if (active) {
            setDeleteTarget({ id: plan.id, name: getEmployeeName(plan.employee_id) });
            return;
        }

        const name = getEmployeeName(plan.employee_id);
        setPendingAction({ kind: 'delete', id: plan.id, name });
        setOtpPurpose('merit_delete');
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
            toast.showSuccess('Merit plan deleted');
            setDeleteTarget(null);
            loadMeritPlans();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredMerit = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return meritPlans;
        return meritPlans.filter((m) => getEmployeeName(m.employee_id).toLowerCase().includes(term));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meritPlans, searchTerm, employees]);

    const totalMeritIncrease = useMemo(
        () =>
            meritPlans
                .filter((m) => m.status === 'approved' || m.status === 'implemented')
                .reduce((sum, m) => sum + (m.recommended_new_salary - m.current_salary), 0),
        [meritPlans]
    );

    const pendingMerit = useMemo(
        () => meritPlans.filter((m) => m.status === 'draft' || m.status === 'pending_review').length,
        [meritPlans]
    );

    const ratedEmployeesList = useMemo(
        () =>
            Object.values(ratingsForYear)
                .filter((r) => r.performance_rating != null)
                .sort((a, b) => {
                    const at = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0;
                    const bt = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0;
                    return bt - at;
                }),
        [ratingsForYear]
    );

    const ratingDistribution = useMemo(() => {
        const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratedEmployeesList.forEach((r) => {
            const stars = starsFromRating(r.performance_rating);
            if (stars > 0) dist[stars] = (dist[stars] || 0) + 1;
        });
        return dist;
    }, [ratedEmployeesList]);

    const topRatedEmployees = useMemo(
        () =>
            [...ratedEmployeesList]
                .sort((a, b) => (b.performance_rating ?? 0) - (a.performance_rating ?? 0))
                .slice(0, 7)
                .map((r) => ({
                    name: getEmployeeName(r.employee_id),
                    rating: r.performance_rating ?? 0,
                })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ratedEmployeesList, employees]
    );

    const coverageRows = useMemo(() => {
        const rows = employees.map((emp) => {
            const hr3 = ratingsForYear[emp.employee_id];
            return {
                employee_id: emp.employee_id,
                employee_name: emp.employee_name || 'Unknown Employee',
                employee_id_number: emp.employee_id_number || '',
                department: emp.department || '',
                has_rating: hr3?.performance_rating != null,
                performance_rating: hr3?.performance_rating ?? null,
                letter_grade: hr3?.letter_grade ?? null,
                cycle_name: hr3?.cycle_name ?? null,
            };
        });
        const term = searchTerm.trim().toLowerCase();
        const searched = term
            ? rows.filter(
                (r) =>
                    r.employee_name.toLowerCase().includes(term) ||
                    r.employee_id_number.toLowerCase().includes(term) ||
                    r.department.toLowerCase().includes(term)
            )
            : rows;
        if (coverageFilter === 'rated') return searched.filter((r) => r.has_rating);
        if (coverageFilter === 'unrated') return searched.filter((r) => !r.has_rating);
        return searched;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, ratingsForYear, searchTerm, coverageFilter]);

    const coverageTotalPages = Math.max(1, Math.ceil(coverageRows.length / COVERAGE_PAGE_SIZE));
    const paginatedCoverage = useMemo(() => {
        const start = (coveragePage - 1) * COVERAGE_PAGE_SIZE;
        return coverageRows.slice(start, start + COVERAGE_PAGE_SIZE);
    }, [coverageRows, coveragePage]);

    useEffect(() => {
        if (coveragePage > coverageTotalPages) setCoveragePage(coverageTotalPages);
    }, [coverageTotalPages, coveragePage]);
    useEffect(() => {
        setCoveragePage(1);
    }, [searchTerm, coverageFilter, selectedYear]);

    const coverageTotals = useMemo(() => {
        const total = employees.length;
        const rated = employees.filter(
            (e) => ratingsForYear[e.employee_id]?.performance_rating != null
        ).length;
        const unrated = total - rated;
        const pct = total > 0 ? Math.round((rated / total) * 100) : 0;
        return { total, rated, unrated, pct };
    }, [employees, ratingsForYear]);

    useEffect(() => {
        if (loading || !ratingDistChartRef.current) return;
        ratingDistChartInstanceRef.current?.destroy();
        ratingDistChartInstanceRef.current = new Chart(ratingDistChartRef.current, {
            type: 'bar',
            data: {
                labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'],
                datasets: [{
                    label: 'Employees',
                    data: [
                        ratingDistribution[1], ratingDistribution[2], ratingDistribution[3],
                        ratingDistribution[4], ratingDistribution[5],
                    ],
                    backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'],
                    borderRadius: 6,
                    barThickness: 32,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} employee(s)` } },
                },
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
        return () => { ratingDistChartInstanceRef.current?.destroy(); };
    }, [ratingDistribution, loading]);

    useEffect(() => {
        if (loading || !topRatedChartRef.current) return;
        topRatedChartInstanceRef.current?.destroy();
        topRatedChartInstanceRef.current = new Chart(topRatedChartRef.current, {
            type: 'bar',
            data: {
                labels: topRatedEmployees.length === 0 ? ['No data'] : topRatedEmployees.map((e) => e.name),
                datasets: [{
                    label: 'Rating',
                    data: topRatedEmployees.length === 0 ? [0] : topRatedEmployees.map((e) => e.rating),
                    backgroundColor: cssVar('--accent', '#e5167e'),
                    borderRadius: 6,
                    barThickness: 20,
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} / 5` } },
                },
                scales: {
                    x: {
                        beginAtZero: true, max: 5,
                        ticks: { stepSize: 1, color: cssVar('--muted', '#6b6b76'), font: { size: 10 } },
                        grid: { color: cssVar('--line', '#eaeaea') },
                    },
                    y: {
                        ticks: { color: cssVar('--ink', '#1c1b1f'), font: { size: 11 } },
                        grid: { display: false },
                    },
                },
            },
        });
        return () => { topRatedChartInstanceRef.current?.destroy(); };
    }, [topRatedEmployees, loading]);

    useEffect(() => {
        if (loading || !coverageChartRef.current) return;
        coverageChartInstanceRef.current?.destroy();
        coverageChartInstanceRef.current = new Chart(coverageChartRef.current, {
            type: 'doughnut',
            data: {
                labels: ['With Rating', 'No Rating'],
                datasets: [{
                    data: [coverageTotals.rated, coverageTotals.unrated],
                    backgroundColor: [cssVar('--philhealth', '#0b8f6b'), cssVar('--line', '#eaeaea')],
                    borderWidth: 2,
                    borderColor: cssVar('--paper', '#fff'),
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '68%', animation: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 10, usePointStyle: true, pointStyle: 'circle',
                            font: { size: 11 }, color: cssVar('--ink', '#1c1b1f'),
                        },
                    },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} employee(s)` } },
                },
            },
        });
        return () => { coverageChartInstanceRef.current?.destroy(); };
    }, [coverageTotals, loading]);

    const printColumns: PrintColumn[] = [
        { key: 'employee_id', label: 'Employee', format: (v) => getEmployeeName(v) },
        { key: 'performance_rating', label: 'Rating', align: 'center' },
        { key: 'current_salary', label: 'Current Salary', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'recommended_increase_percent', label: 'Increase %', align: 'right', format: (v) => `${v}%` },
        { key: 'recommended_new_salary', label: 'New Salary', align: 'right', format: (v) => printFormatters.peso(v) },
        { key: 'proposed_effective_date', label: 'Effective', format: (v) => printFormatters.date(v) },
        { key: 'status', label: 'Status', format: (v) => printFormatters.capitalize(v) },
    ];

    const handlePrint = () => {
        if (filteredMerit.length === 0) { toast.showError('No merit plans to print.'); return; }
        printTable({
            companyName: 'Airship Express',
            companyAddress: 'Binondo, Manila, Philippines',
            reportTitle: 'Merit Increase Plans',
            reportSubtitle: `Fiscal Year ${selectedYear}`,
            filters: {
                'Total Plans': filteredMerit.length,
                Approved: meritPlans.filter((m) => m.status === 'approved' || m.status === 'implemented').length,
                Pending: pendingMerit,
                'Total Increase': peso(totalMeritIncrease),
            },
        }, printColumns, filteredMerit);
    };

    const handleExport = () => {
        if (filteredMerit.length === 0) { toast.showError('No merit plans to export.'); return; }
        exportExcel(`merit-plans-${selectedYear}`, printColumns, filteredMerit);
        toast.showSuccess('Merit plans exported to Excel.');
    };

    const hasHr3 = form.employee_id ? !!activeRatingSource(form.employee_id) : false;
    const formHasBank = form.employee_id ? employeeHasBank(employees, form.employee_id) : false;

    const isSaveDisabled =
        isSaving ||
        !form.employee_id ||
        !form.performance_rating ||
        !form.recommended_new_salary ||
        !form.proposed_effective_date ||
        !form.approver_notes.trim() ||
        !hasHr3 ||
        !formHasBank;

    const availableYears = useMemo(() => {
        const set = new Set<number>();
        Object.values(latestRatings).forEach((r) => {
            if (r.cycle_year != null) set.add(r.cycle_year);
        });
        const currentYear = new Date().getFullYear();
        set.add(currentYear);
        set.add(selectedYear);
        return Array.from(set).sort((a, b) => b - a);
    }, [latestRatings, selectedYear]);

    return (
        <div className="space-y-5">
            <OtpUnlockBanner
                active={active}
                secondsLeft={secondsLeft}
                onLock={() => void lock()}
                scopeLabel="save & delete allowed without re-verifying"
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Users} label="Merit Plans" value={String(meritPlans.length)} tint="blue" />
                <StatCard icon={TrendingUp} label="Total Merit Increase" value={peso(totalMeritIncrease)} tint="emerald" />
                <StatCard icon={Star} label="Rated Employees" value={String(coverageTotals.rated)} tint="amber" />
                <StatCard icon={Clock} label="Pending Review" value={String(pendingMerit)} tint="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <p className="text-xs font-semibold text-ink font-rethink">HR3 Rating Distribution</p>
                            <span className="ml-auto text-[10px] text-muted font-rethink">
                                {coverageTotals.rated} rated · {selectedYear}
                            </span>
                        </div>
                        <div className="h-56"><canvas ref={ratingDistChartRef} /></div>
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <TrendingUp className="h-3.5 w-3.5 text-accent" />
                            <p className="text-xs font-semibold text-ink font-rethink">Top Rated Employees</p>
                            <span className="ml-auto text-[10px] text-muted font-rethink">
                                top {Math.min(topRatedEmployees.length, 7)}
                            </span>
                        </div>
                        <div className="h-56"><canvas ref={topRatedChartRef} /></div>
                    </CardBody>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <Card variant="default" padding="none" className="lg:col-span-2 bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <PieChart className="h-3.5 w-3.5 text-emerald-500" />
                            <p className="text-xs font-semibold text-ink font-rethink">HR3 Coverage</p>
                        </div>
                        <div className="h-56"><canvas ref={coverageChartRef} /></div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                                <p className="text-[9px] uppercase tracking-wide text-emerald-600">Rated</p>
                                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{coverageTotals.rated}</p>
                            </div>
                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                <p className="text-[9px] uppercase tracking-wide text-muted">Unrated</p>
                                <p className="font-mono font-semibold text-ink">{coverageTotals.unrated}</p>
                            </div>
                            <div className="rounded-md bg-accent/5 px-2 py-1.5">
                                <p className="text-[9px] uppercase tracking-wide text-accent">Coverage</p>
                                <p className="font-mono font-semibold text-accent">{coverageTotals.pct}%</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card variant="default" padding="none" className="lg:col-span-3 bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                            <Users className="h-3.5 w-3.5 text-blue-600" />
                            <p className="text-xs font-semibold text-ink font-rethink">HR3 Rating Coverage</p>
                            <span className="text-[10px] text-muted font-rethink bg-ink/[0.03] px-2 py-0.5 rounded-full border border-line">
                                {coverageRows.length} employee{coverageRows.length === 1 ? '' : 's'}
                            </span>
                            <div className="ml-auto flex gap-1">
                                {(['all', 'rated', 'unrated'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setCoverageFilter(f)}
                                        className={`rounded-md px-2 py-1 text-[10px] font-medium font-rethink transition-colors ${coverageFilter === f
                                            ? 'bg-accent/10 text-accent ring-1 ring-accent/30'
                                            : 'bg-ink/[0.03] text-muted hover:bg-ink/[0.06] dark:bg-ink/[0.06]'
                                            }`}
                                    >
                                        {f === 'all' ? 'All' : f === 'rated' ? 'With Rating' : 'No Rating'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto rounded-md border border-line dark:border-line/30">
                            <table className="w-full border-collapse text-sm">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-line bg-paper dark:bg-ink/40">
                                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden sm:table-cell">Department</th>
                                        <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rating</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden md:table-cell">Cycle</th>
                                        <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedCoverage.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted font-rethink">
                                                    No employees match this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedCoverage.map((row) => (
                                                <motion.tr
                                                    key={row.employee_id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(row.employee_name)}`}>
                                                                {initialsOf(row.employee_name)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-medium text-ink font-rethink truncate">{row.employee_name}</p>
                                                                <p className="text-[10px] text-muted font-rethink">{row.employee_id_number || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-[12px] text-ink/70 font-rethink whitespace-nowrap hidden sm:table-cell">
                                                        {row.department || '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {row.has_rating ? (
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <div className="flex">
                                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                                        <Star
                                                                            key={i}
                                                                            className={`h-3.5 w-3.5 ${i < starsFromRating(row.performance_rating) ? 'text-amber-500 fill-amber-500' : 'text-ink/15'}`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-xs font-semibold text-ink">{row.performance_rating}</span>
                                                                {row.letter_grade && (
                                                                    <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                                                        {row.letter_grade}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-muted italic">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-[11px] text-muted font-rethink whitespace-nowrap hidden md:table-cell">
                                                        {row.cycle_name || '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {row.has_rating ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/40">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Rated
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/40">
                                                                <XCircle className="h-3 w-3" />
                                                                No Rating
                                                            </span>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {coverageTotalPages > 1 && (
                            <div className="mt-3">
                                <Pagination
                                    currentPage={coveragePage}
                                    totalPages={coverageTotalPages}
                                    onPageChange={setCoveragePage}
                                    itemsPerPage={COVERAGE_PAGE_SIZE}
                                    totalItems={coverageRows.length}
                                />
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <Search placeholder="Search by employee..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-9 rounded-md border border-line bg-paper px-2.5 text-xs font-rethink text-ink outline-none focus:border-accent dark:border-line/30"
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
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
                            <span className="whitespace-nowrap leading-none">New Merit Plan</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading merit plans…
                    </div>
                ) : filteredMerit.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30 mb-3">
                            <BarChart3 className="h-6 w-6 text-pink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No merit plans yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Create a merit plan to assign a salary increase based on HR3 performance.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Current</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Increase</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">New Salary</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Rating</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filteredMerit.map((plan) => {
                                        const hr3 = ratingsForYear[plan.employee_id];
                                        const matchesHr3 =
                                            hr3?.performance_rating != null &&
                                            Number(plan.performance_rating) === hr3.performance_rating;
                                        const statusStyle = STATUS_STYLES[plan.status] || STATUS_STYLES.draft;
                                        const empName = getEmployeeName(plan.employee_id);
                                        const empNo = getEmployeeNumber(plan.employee_id);
                                        const hasBank = employeeHasBank(employees, plan.employee_id);
                                        return (
                                            <motion.tr
                                                key={plan.id}
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
                                                            <p className="text-[10px] text-muted font-rethink">
                                                                {empNo || (hr3?.cycle_name ? `HR3 · ${hr3.cycle_name}` : 'No HR3 cycle')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right text-[12px] font-mono text-ink/70 whitespace-nowrap">{peso(plan.current_salary)}</td>
                                                <td className="px-3 py-3 text-right text-[12px] font-mono font-semibold text-emerald-600 whitespace-nowrap">{plan.recommended_increase_percent}%</td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">{peso(plan.recommended_new_salary)}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <div className="flex">
                                                            {Array.from({ length: 5 }).map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    className={`h-3.5 w-3.5 ${i < starsFromRating(plan.performance_rating) ? 'text-amber-500 fill-amber-500' : 'text-ink/15'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className="text-xs font-medium text-ink">{plan.performance_rating}</span>
                                                        {matchesHr3 && (
                                                            <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                                                HR3
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ring-1 font-rethink ${statusStyle}`}>
                                                        {plan.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openEdit(plan)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:scale-105 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                                            aria-label="Edit merit plan"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(plan)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            aria-label="Delete merit plan"
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
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editTarget ? 'Edit Merit Plan' : 'New Merit Plan'}
                    className="max-w-lg"
                    accent="pink"
                    icon={BarChart3}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={handleSave} disabled={isSaveDisabled} className="font-rethink">
                                {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => handleEmployeeChange(e.target.value)}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => {
                                    const hr3 = ratingsForYear[emp.employee_id];
                                    const hasBank = employeeHasBank(employees, emp.employee_id);
                                    const stars = starsFromRating(hr3?.performance_rating ?? null);
                                    const starsText = stars > 0 ? ` · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}` : ' · no rating';
                                    return (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.employee_name}
                                            {emp.employee_id_number ? ` (${emp.employee_id_number})` : ''}
                                            {starsText}
                                            {!hasBank ? ' · ⚠ no bank' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {form.employee_id && activeRatingSource(form.employee_id) && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800/30 dark:bg-blue-950/20 space-y-2">
                                <div className="flex items-start gap-2.5">
                                    <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                                    <div className="text-[11px] text-blue-800 dark:text-blue-300 font-rethink leading-relaxed">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold">HR3 rating:</span>
                                            <div className="flex">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-3.5 w-3.5 ${i < starsFromRating(activeRatingSource(form.employee_id)?.performance_rating) ? 'text-amber-500 fill-amber-500' : 'text-ink/15'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="font-semibold">
                                                {activeRatingSource(form.employee_id)?.performance_rating ?? '—'} / 5
                                            </span>
                                            {activeRatingSource(form.employee_id)?.letter_grade && (
                                                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                                    {activeRatingSource(form.employee_id)?.letter_grade}
                                                </span>
                                            )}
                                        </div>
                                        {activeRatingSource(form.employee_id)?.cycle_name && (
                                            <p className="text-blue-700/80 dark:text-blue-300/80">
                                                Cycle: {activeRatingSource(form.employee_id)?.cycle_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {activeRatingSource(form.employee_id)?.comments && (
                                    <div className="text-[11px] text-blue-800/90 dark:text-blue-300/90 font-rethink">
                                        <p className="font-semibold">Manager notes:</p>
                                        <p className="italic">{activeRatingSource(form.employee_id)?.comments}</p>
                                    </div>
                                )}
                                {activeRatingSource(form.employee_id)?.strengths && (
                                    <div className="text-[11px] text-blue-800/90 dark:text-blue-300/90 font-rethink">
                                        <p className="font-semibold">Strengths:</p>
                                        <p className="italic">{activeRatingSource(form.employee_id)?.strengths}</p>
                                    </div>
                                )}
                                {activeRatingSource(form.employee_id)?.improvements && (
                                    <div className="text-[11px] text-blue-800/90 dark:text-blue-300/90 font-rethink">
                                        <p className="font-semibold">Improvements:</p>
                                        <p className="italic">{activeRatingSource(form.employee_id)?.improvements}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {form.employee_id && !activeRatingSource(form.employee_id) && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-800/30 dark:bg-red-950/20">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                                <div className="text-[11px] text-red-800 dark:text-red-300 font-rethink space-y-1">
                                    <p className="font-semibold">Cannot create merit plan without an HR3 rating</p>
                                    <p>This employee has no finalized HR3 appraisal for {selectedYear}.</p>
                                </div>
                            </div>
                        )}

                        {form.employee_id && !employeeHasBank(employees, form.employee_id) && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
                                <Bell className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-rethink space-y-1">
                                    <p className="font-semibold">Bank details not set up</p>
                                    <p>This employee has no bank account on file. Set up their bank details before creating a merit plan.</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                    Performance Rating
                                    <span className="ml-1 text-[10px] text-muted">(from HR3 · read-only)</span>
                                </label>
                                <div className="flex items-center gap-2 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:bg-ink/[0.05]">
                                    {form.performance_rating ? (
                                        <>
                                            <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                                            <span className="text-sm font-semibold text-ink">{form.performance_rating} / 5</span>
                                            <span className="text-xs text-muted truncate">{RATING_LABEL[Number(form.performance_rating)] || ''}</span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-muted italic">No rating available</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                    Current Salary
                                    <span className="ml-1 text-[10px] text-muted">(from HR4 · read-only)</span>
                                </label>
                                <div className="flex items-center gap-2 rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:bg-ink/[0.05]">
                                    {form.current_salary ? (
                                        <span className="text-sm font-mono font-semibold text-ink tabular-nums">{peso(Number(form.current_salary))}</span>
                                    ) : (
                                        <span className="text-xs text-muted italic">Not available</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="block text-xs font-medium text-ink font-rethink">Increase %</label>
                                    <button
                                        type="button"
                                        onClick={applyPolicy}
                                        disabled={!form.performance_rating || !form.current_salary}
                                        className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        Auto-suggest
                                    </button>
                                </div>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.recommended_increase_percent}
                                    onChange={(e) => {
                                        const pct = Number(e.target.value);
                                        const current = Number(form.current_salary) || 0;
                                        const newSalary = current + current * (pct / 100);
                                        setForm((f) => ({
                                            ...f,
                                            recommended_increase_percent: e.target.value,
                                            recommended_new_salary: String(Math.round(newSalary * 100) / 100),
                                        }));
                                    }}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                                {form.performance_rating && (
                                    <p className="mt-1 text-[10px] text-muted font-rethink">
                                        Policy for {form.performance_rating}★: {MERIT_POLICY[Number(form.performance_rating)] ?? 0}% recommended
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">New Salary</label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={form.recommended_new_salary}
                                    onChange={(e) => setForm((f) => ({ ...f, recommended_new_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Proposed Effective Date</label>
                            <input
                                type="date"
                                value={form.proposed_effective_date}
                                onChange={(e) => setForm((f) => ({ ...f, proposed_effective_date: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Approver Notes <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={form.approver_notes}
                                onChange={(e) => setForm((f) => ({ ...f, approver_notes: e.target.value }))}
                                rows={2}
                                placeholder="Justify this merit decision (required)"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                            {!form.approver_notes.trim() && (
                                <p className="mt-1 text-[10px] text-red-600 font-rethink">Required to save the merit plan.</p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="pending_review">Pending Review</option>
                                <option value="approved">Approved</option>
                                <option value="implemented">Implemented</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Merit Plan"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <>
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="font-rethink">Cancel</Button>
                            <Button type="button" onClick={confirmDelete} disabled={isDeleting} variant="danger" className="font-rethink">
                                {isDeleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the merit plan for {deleteTarget.name}?
                        </p>
                    </div>
                </Modal>
            )}

            {isOtpOpen && (
                <OtpModal
                    isOpen={true}
                    onClose={() => {
                        setIsOtpOpen(false);
                        setPendingAction(null);
                    }}
                    onVerified={async (s) => {
                        unlock(s.scope || 'all', s.secondsLeft);

                        const action = pendingAction;
                        setPendingAction(null);
                        setIsOtpOpen(false);

                        if (action?.kind === 'save') {
                            await commitSave(action.payload, action.isEdit, action.editId);
                        } else if (action?.kind === 'delete') {
                            setDeleteTarget({ id: action.id, name: action.name });
                        }
                    }}
                    purpose={otpPurpose}
                    title={otpPurpose === 'merit' ? 'Verify Merit Plan' : 'Verify Merit Deletion'}
                    subtitle={
                        otpPurpose === 'merit'
                            ? 'Enter the 6-digit code sent to your email to authorize this merit plan.'
                            : 'Enter the 6-digit code sent to your email to authorize deleting this merit plan.'
                    }
                    actionLabel={otpPurpose === 'merit' ? 'merit plan' : 'deletion'}
                />
            )}
        </div>
    );
};

export default MeritTab;