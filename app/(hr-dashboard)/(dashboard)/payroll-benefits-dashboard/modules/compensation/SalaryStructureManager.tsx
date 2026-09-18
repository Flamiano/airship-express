'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Pencil, Trash2, Loader2, Award, CheckCircle2, XCircle,
    AlertTriangle, TrendingUp, BarChart3, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HR4CompenSalaryGrade, HR4CompenMarketBenchmark } from '../../types';

const EMPTY_GRADE_FORM = {
    grade_code: '',
    grade_name: '',
    grade_level: '',
    min_salary: '',
    mid_salary: '',
    max_salary: '',
    step_increment: '',
    market_reference: '',
    description: '',
    is_active: true,
};

const EMPTY_STEP = {
    step_number: '',
    step_amount: '',
    effective_date: '',
    expiry_date: '',
};

const EMPTY_BENCHMARK = {
    job_title: '',
    industry: '',
    location: '',
    min_salary: '',
    mid_salary: '',
    max_salary: '',
    percentile_25: '',
    percentile_50: '',
    percentile_75: '',
    data_source: '',
    survey_year: new Date().getFullYear(),
};

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, tint }: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'purple' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
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
    const [grades, setGrades] = useState<HR4CompenSalaryGrade[]>([]);
    const [benchmarks, setBenchmarks] = useState<HR4CompenMarketBenchmark[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
    const [showBenchmarks, setShowBenchmarks] = useState(false);

    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [editGrade, setEditGrade] = useState<HR4CompenSalaryGrade | null>(null);
    const [gradeForm, setGradeForm] = useState(EMPTY_GRADE_FORM);
    const [steps, setSteps] = useState<typeof EMPTY_STEP[]>([]);

    const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
    const [editBenchmark, setEditBenchmark] = useState<HR4CompenMarketBenchmark | null>(null);
    const [benchmarkForm, setBenchmarkForm] = useState(EMPTY_BENCHMARK);

    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<HR4CompenSalaryGrade | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/compensation/salary-structure');
    const { fetchData: fetchBenchmarks, postData: postBenchmark, deleteData: deleteBenchmark } = useApi('/payroll-benefits-dashboard/api/compensation/market-benchmarks');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [gradeData, benchmarkData] = await Promise.all([
                fetchData(),
                fetchBenchmarks(),
            ]);
            setGrades(gradeData || []);
            setBenchmarks(benchmarkData || []);
        } catch (error: any) {
            console.error('Load error:', error);
            toast.showError(error?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const toggleGradeExpand = (gradeId: number) => {
        const newExpanded = new Set(expandedGrades);
        if (newExpanded.has(gradeId)) {
            newExpanded.delete(gradeId);
        } else {
            newExpanded.add(gradeId);
        }
        setExpandedGrades(newExpanded);
    };

    const openCreateGrade = () => {
        setEditGrade(null);
        setGradeForm(EMPTY_GRADE_FORM);
        setSteps([]);
        setIsGradeModalOpen(true);
    };

    const openEditGrade = (grade: HR4CompenSalaryGrade) => {
        setEditGrade(grade);
        setGradeForm({
            grade_code: grade.grade_code,
            grade_name: grade.grade_name,
            grade_level: String(grade.grade_level),
            min_salary: String(grade.min_salary),
            mid_salary: String(grade.mid_salary),
            max_salary: String(grade.max_salary),
            step_increment: String(grade.step_increment || 0),
            market_reference: grade.market_reference || '',
            description: grade.description || '',
            is_active: grade.is_active,
        });
        loadSteps(grade.id);
        setIsGradeModalOpen(true);
    };

    const loadSteps = async (gradeId: number) => {
        try {
            const { fetchData: fetchSteps } = useApi(`/payroll-benefits-dashboard/api/compensation/salary-structure/${gradeId}/steps`);
            const data = await fetchSteps();
            setSteps(data?.map((s: any) => ({
                step_number: String(s.step_number),
                step_amount: String(s.step_amount),
                effective_date: s.effective_date?.split('T')[0] || '',
                expiry_date: s.expiry_date?.split('T')[0] || '',
            })) || []);
        } catch (error) {
            console.error('Load steps error:', error);
        }
    };

    const addStep = () => {
        setSteps([...steps, {
            step_number: '',
            step_amount: '',
            effective_date: new Date().toISOString().split('T')[0],
            expiry_date: '',
        }]);
    };

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const updateStep = (index: number, field: string, value: string) => {
        const updated = [...steps];
        updated[index] = { ...updated[index], [field]: value };
        setSteps(updated);
    };

    const handleSaveGrade = async () => {
        if (!gradeForm.grade_code.trim() || !gradeForm.grade_name.trim()) {
            toast.showError('Grade code and name are required');
            return;
        }

        const payload = {
            grade_code: gradeForm.grade_code.trim(),
            grade_name: gradeForm.grade_name.trim(),
            grade_level: Number(gradeForm.grade_level) || 0,
            min_salary: Number(gradeForm.min_salary) || 0,
            mid_salary: Number(gradeForm.mid_salary) || 0,
            max_salary: Number(gradeForm.max_salary) || 0,
            step_increment: Number(gradeForm.step_increment) || 0,
            market_reference: gradeForm.market_reference.trim() || null,
            description: gradeForm.description.trim() || null,
            is_active: gradeForm.is_active,
            steps: steps.filter(s => s.step_number && s.step_amount).map(s => ({
                step_number: Number(s.step_number),
                step_amount: Number(s.step_amount),
                effective_date: s.effective_date || new Date().toISOString().split('T')[0],
                expiry_date: s.expiry_date || null,
            })),
        };

        setIsSaving(true);
        try {
            if (editGrade) {
                await putData(`/${editGrade.id}`, payload);
                toast.showSuccess('Salary grade updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Salary grade created');
            }
            setIsGradeModalOpen(false);
            setGradeForm(EMPTY_GRADE_FORM);
            setSteps([]);
            setEditGrade(null);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.showError(error?.message || 'Failed to save salary grade');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleGradeActive = async (grade: HR4CompenSalaryGrade) => {
        try {
            await putData(`/${grade.id}`, { is_active: !grade.is_active });
            toast.showSuccess(`Salary grade ${grade.is_active ? 'deactivated' : 'activated'}`);
            loadData();
        } catch (error: any) {
            console.error('Toggle error:', error);
            toast.showError(error?.message || 'Failed to update salary grade');
        }
    };

    const confirmDeleteGrade = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Salary grade deleted');
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.showError(error?.message || 'Failed to delete salary grade');
        } finally {
            setIsDeleting(false);
        }
    };

    const openCreateBenchmark = () => {
        setEditBenchmark(null);
        setBenchmarkForm(EMPTY_BENCHMARK);
        setIsBenchmarkModalOpen(true);
    };

    const handleSaveBenchmark = async () => {
        if (!benchmarkForm.job_title.trim()) {
            toast.showError('Job title is required');
            return;
        }

        const payload = {
            job_title: benchmarkForm.job_title.trim(),
            industry: benchmarkForm.industry.trim() || null,
            location: benchmarkForm.location.trim() || null,
            min_salary: Number(benchmarkForm.min_salary) || 0,
            mid_salary: Number(benchmarkForm.mid_salary) || 0,
            max_salary: Number(benchmarkForm.max_salary) || 0,
            percentile_25: Number(benchmarkForm.percentile_25) || null,
            percentile_50: Number(benchmarkForm.percentile_50) || null,
            percentile_75: Number(benchmarkForm.percentile_75) || null,
            data_source: benchmarkForm.data_source.trim() || null,
            survey_year: Number(benchmarkForm.survey_year) || new Date().getFullYear(),
        };

        setIsSaving(true);
        try {
            if (editBenchmark) {
                await putData(`/${editBenchmark.id}`, payload);
                toast.showSuccess('Market benchmark updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Market benchmark added');
            }
            setIsBenchmarkModalOpen(false);
            setBenchmarkForm(EMPTY_BENCHMARK);
            setEditBenchmark(null);
            loadData();
        } catch (error: any) {
            console.error('Save benchmark error:', error);
            toast.showError(error?.message || 'Failed to save benchmark');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredGrades = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return grades;
        return grades.filter((g) =>
            g.grade_code.toLowerCase().includes(term) ||
            g.grade_name.toLowerCase().includes(term) ||
            (g.description || '').toLowerCase().includes(term)
        );
    }, [grades, searchTerm]);

    const activeCount = useMemo(() => grades.filter((g) => g.is_active).length, [grades]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Award} label="Total Grades" value={String(grades.length)} tint="blue" />
                <StatCard icon={CheckCircle2} label="Active" value={String(activeCount)} tint="emerald" />
                <StatCard icon={TrendingUp} label="Max Level" value={grades.length > 0 ? String(Math.max(...grades.map(g => g.grade_level))) : '-'} tint="purple" />
                <StatCard icon={BarChart3} label="Benchmarks" value={String(benchmarks.length)} tint="amber" />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Search placeholder="Search salary grades..." onSearch={setSearchTerm} className="w-full md:max-w-sm" />
                    <button
                        onClick={() => setShowBenchmarks(!showBenchmarks)}
                        className={`px-3 py-2 rounded-lg border text-sm font-rethink transition-colors ${showBenchmarks
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-line text-muted hover:bg-ink/5'
                            }`}
                    >
                        {showBenchmarks ? 'Hide Benchmarks' : 'Show Benchmarks'}
                    </button>
                </div>
                <div className="flex gap-2">
                    {showBenchmarks && (
                        <Button
                            onClick={openCreateBenchmark}
                            className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                            <span className="flex flex-row items-center justify-center gap-2 w-full">
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap leading-none">Add Benchmark</span>
                            </span>
                        </Button>
                    )}
                    <Button
                        onClick={openCreateGrade}
                        className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-2 w-full">
                            <Plus className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap leading-none">New Grade</span>
                        </span>
                    </Button>
                </div>
            </div>

            {showBenchmarks && benchmarks.length > 0 && (
                <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 className="h-4 w-4 text-accent" />
                            <h4 className="text-sm font-semibold text-ink font-rethink">Market Benchmarks</h4>
                            <span className="text-[10px] text-muted font-rethink bg-ink/[0.03] px-2 py-0.5 rounded-full border border-line">
                                {benchmarks.length} entries
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-line">
                                        <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink">Job Title</th>
                                        <th className="text-left px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink hidden md:table-cell">Industry</th>
                                        <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink">Min</th>
                                        <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink">Mid</th>
                                        <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink">Max</th>
                                        <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-muted font-rethink">Year</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {benchmarks.slice(0, 5).map((b) => (
                                        <tr key={b.id} className="border-b border-line/50 last:border-b-0">
                                            <td className="px-2 py-2 text-xs text-ink font-rethink">{b.job_title}</td>
                                            <td className="px-2 py-2 text-xs text-muted font-rethink hidden md:table-cell">{b.industry || '—'}</td>
                                            <td className="px-2 py-2 text-right text-xs font-mono text-ink/70">{peso(b.min_salary)}</td>
                                            <td className="px-2 py-2 text-right text-xs font-mono font-semibold text-ink">{peso(b.mid_salary)}</td>
                                            <td className="px-2 py-2 text-right text-xs font-mono text-ink/70">{peso(b.max_salary)}</td>
                                            <td className="px-2 py-2 text-right text-xs text-muted">{b.survey_year}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>
            )}

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading salary grades…
                    </div>
                ) : grades.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No salary grades yet. Create one to get started." />
                    </CardBody>
                ) : filteredGrades.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No salary grades match your search." />
                    </CardBody>
                ) : (
                    <div className="divide-y divide-line">
                        <AnimatePresence initial={false}>
                            {filteredGrades.map((grade) => (
                                <motion.div
                                    key={grade.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="p-4 hover:bg-ink/[0.015] transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleGradeExpand(grade.id)}
                                                    className="text-muted hover:text-ink transition-colors"
                                                >
                                                    {expandedGrades.has(grade.id) ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-ink font-rethink">
                                                            {grade.grade_code}
                                                        </p>
                                                        <span className="text-xs text-ink/70 font-rethink">Level {grade.grade_level}</span>
                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium font-rethink ${grade.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                                                            }`}>
                                                            {grade.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-ink/70 font-rethink">{grade.grade_name}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-rethink">
                                                <span className="text-muted">Min: <span className="font-mono text-ink">{peso(grade.min_salary)}</span></span>
                                                <span className="text-muted">Mid: <span className="font-mono text-ink font-semibold">{peso(grade.mid_salary)}</span></span>
                                                <span className="text-muted">Max: <span className="font-mono text-ink">{peso(grade.max_salary)}</span></span>
                                                {grade.step_increment > 0 && (
                                                    <span className="text-muted">Step: <span className="font-mono text-ink">{peso(grade.step_increment)}</span></span>
                                                )}
                                            </div>
                                            {grade.market_reference && (
                                                <p className="mt-1 text-[10px] text-muted font-rethink">
                                                    Market Ref: {grade.market_reference}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                onClick={() => toggleGradeActive(grade)}
                                                className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                            >
                                                {grade.is_active ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => openEditGrade(grade)}
                                                className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(grade)}
                                                className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedGrades.has(grade.id) && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-3 ml-7 pl-4 border-l-2 border-accent/20"
                                        >
                                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted font-rethink mb-2">
                                                Pay Steps
                                            </p>
                                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                <div className="text-[10px] font-medium text-muted font-rethink">Step</div>
                                                <div className="text-[10px] font-medium text-muted font-rethink col-span-2">Amount</div>
                                                <div className="text-[10px] font-medium text-muted font-rethink hidden sm:block">Effective</div>
                                                <div className="text-[10px] font-medium text-muted font-rethink hidden sm:block">Expiry</div>

                                                {grade.steps?.length > 0 ? (
                                                    grade.steps.map((step: any) => (
                                                        <React.Fragment key={step.id || step.step_number}>
                                                            <div className="text-xs font-mono text-ink">Step {step.step_number}</div>
                                                            <div className="text-xs font-mono text-ink col-span-2">{peso(step.step_amount)}</div>
                                                            <div className="text-xs text-muted hidden sm:block">{new Date(step.effective_date).toLocaleDateString()}</div>
                                                            <div className="text-xs text-muted hidden sm:block">{step.expiry_date ? new Date(step.expiry_date).toLocaleDateString() : '—'}</div>
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    <div className="col-span-5 text-xs text-muted font-rethink">No steps defined</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </Card>

            {/* Grade Modal */}
            {isGradeModalOpen && (
                <Modal
                    isOpen={isGradeModalOpen}
                    onClose={() => setIsGradeModalOpen(false)}
                    title={editGrade ? 'Edit Salary Grade' : 'New Salary Grade'}
                    className="max-w-2xl"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsGradeModalOpen(false)}
                                disabled={isSaving}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSaveGrade}
                                disabled={isSaving}
                                className="w-full sm:w-auto font-rethink"
                            >
                                {isSaving ? 'Saving…' : editGrade ? 'Save Changes' : 'Create Grade'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Grade Code</label>
                                <input
                                    type="text"
                                    value={gradeForm.grade_code}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, grade_code: e.target.value }))}
                                    placeholder="e.g. G-01"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Grade Name</label>
                                <input
                                    type="text"
                                    value={gradeForm.grade_name}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, grade_name: e.target.value }))}
                                    placeholder="e.g. Entry Level"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Grade Level</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={gradeForm.grade_level}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, grade_level: e.target.value }))}
                                    placeholder="1"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Min Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={gradeForm.min_salary}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, min_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Mid Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={gradeForm.mid_salary}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, mid_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Max Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={gradeForm.max_salary}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, max_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Step Increment</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={gradeForm.step_increment}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, step_increment: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Market Reference</label>
                                <input
                                    type="text"
                                    value={gradeForm.market_reference}
                                    onChange={(e) => setGradeForm((f) => ({ ...f, market_reference: e.target.value }))}
                                    placeholder="e.g. 2024 Market Data"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <textarea
                                value={gradeForm.description}
                                onChange={(e) => setGradeForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="Brief description of this salary grade"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30 resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">Active</span>
                            <button
                                type="button"
                                onClick={() => setGradeForm((f) => ({ ...f, is_active: !f.is_active }))}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${gradeForm.is_active ? 'bg-accent' : 'bg-ink/15'}`}
                            >
                                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${gradeForm.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="border-t border-line pt-4 dark:border-line/30">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-medium text-ink font-rethink">Pay Steps</label>
                                <Button type="button" variant="outline" size="sm" onClick={addStep} className="text-xs h-7 px-2.5">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Step
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {steps.length === 0 && (
                                    <p className="text-xs text-muted font-rethink">No steps added yet. Click "Add Step" to create pay steps.</p>
                                )}
                                {steps.map((step, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                min="1"
                                                value={step.step_number}
                                                onChange={(e) => updateStep(index, 'step_number', e.target.value)}
                                                placeholder="Step #"
                                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                            />
                                        </div>
                                        <div className="flex-[2]">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={step.step_amount}
                                                onChange={(e) => updateStep(index, 'step_amount', e.target.value)}
                                                placeholder="Step Amount"
                                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeStep(index)}
                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400"
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Benchmark Modal */}
            {isBenchmarkModalOpen && (
                <Modal
                    isOpen={isBenchmarkModalOpen}
                    onClose={() => setIsBenchmarkModalOpen(false)}
                    title={editBenchmark ? 'Edit Market Benchmark' : 'Add Market Benchmark'}
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setIsBenchmarkModalOpen(false)} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveBenchmark} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Saving…' : editBenchmark ? 'Save Changes' : 'Add Benchmark'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Job Title</label>
                            <input
                                type="text"
                                value={benchmarkForm.job_title}
                                onChange={(e) => setBenchmarkForm((f) => ({ ...f, job_title: e.target.value }))}
                                placeholder="e.g. Software Engineer"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Industry</label>
                                <input
                                    type="text"
                                    value={benchmarkForm.industry}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, industry: e.target.value }))}
                                    placeholder="e.g. Tech"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Location</label>
                                <input
                                    type="text"
                                    value={benchmarkForm.location}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, location: e.target.value }))}
                                    placeholder="e.g. Metro Manila"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Min Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={benchmarkForm.min_salary}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, min_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Mid Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={benchmarkForm.mid_salary}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, mid_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Max Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={benchmarkForm.max_salary}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, max_salary: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Survey Year</label>
                                <input
                                    type="number"
                                    min="2000"
                                    max={new Date().getFullYear() + 1}
                                    value={benchmarkForm.survey_year}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, survey_year: e.target.value }))}
                                    placeholder="2024"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Data Source</label>
                                <input
                                    type="text"
                                    value={benchmarkForm.data_source}
                                    onChange={(e) => setBenchmarkForm((f) => ({ ...f, data_source: e.target.value }))}
                                    placeholder="e.g. Mercer, Payscale"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 dark:border-line/30"
                                />
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Salary Grade"
                    className="max-w-md"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmDeleteGrade} disabled={isDeleting} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Delete the salary grade "{deleteTarget.grade_code} - {deleteTarget.grade_name}"?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                This will also delete all associated pay steps.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SalaryStructureManager;