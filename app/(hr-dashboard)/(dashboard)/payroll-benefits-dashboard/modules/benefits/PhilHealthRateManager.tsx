'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, HeartPulse, Loader2, AlertTriangle,
    TrendingUp, Coins, Percent,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import ContributionForm from './ContributionForm';
import { StatCard } from './BenefitsShared';

const PAGE_SIZE = 8;

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const PhilHealthRateManager = () => {
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/benefits/philhealth'
    );

    useEffect(() => { loadRates(); }, []);

    const loadRates = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setRates(Array.isArray(data) ? data : []);
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load PhilHealth rates');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (formData: any) => {
        try {
            if (editingRate) {
                await putData(`/${editingRate.id}`, formData);
                toast.success('PhilHealth rate updated');
            } else {
                await postData('', formData);
                toast.success('PhilHealth rate added');
            }
            setIsModalOpen(false);
            loadRates();
        } catch {
            toast.error('Failed to save PhilHealth rate');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.success('PhilHealth rate deactivated');
            setDeleteTarget(null);
            loadRates();
        } catch {
            toast.error('Failed to deactivate PhilHealth rate');
        } finally {
            setIsDeleting(false);
        }
    };

    const sortedRates = useMemo(
        () => [...rates].sort((a, b) => Number(a.base_min_salary ?? 0) - Number(b.base_min_salary ?? 0)),
        [rates]
    );

    const filteredRates = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedRates;
        return sortedRates.filter((r) => {
            const base = String(r.base_min_salary ?? '');
            const cap = String(r.premium_cap ?? '');
            const emp = String(((r.employee_rate ?? 0) * 100).toFixed(2));
            const empr = String(((r.employer_rate ?? 0) * 100).toFixed(2));
            return base.includes(term) || cap.includes(term) || emp.includes(term) || empr.includes(term);
        });
    }, [sortedRates, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredRates.length / PAGE_SIZE));

    const paginatedRates = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredRates.slice(start, start + PAGE_SIZE);
    }, [filteredRates, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const latestRate = useMemo(() => {
        if (sortedRates.length === 0) return null;
        return sortedRates[sortedRates.length - 1];
    }, [sortedRates]);

    const combinedRate = useMemo(
        () =>
            latestRate
                ? ((Number(latestRate.employer_rate ?? 0) + Number(latestRate.employee_rate ?? 0)) * 100).toFixed(2)
                : '0.00',
        [latestRate]
    );

    const highestCap = useMemo(
        () => sortedRates.reduce((m, r) => Math.max(m, Number(r.premium_cap ?? 0)), 0),
        [sortedRates]
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={HeartPulse} label="Total Rates" value={String(rates.length)} tint="red" />
                <StatCard icon={Percent} label="Latest Combined Rate" value={`${combinedRate}%`} tint="blue" />
                <StatCard icon={TrendingUp} label="Highest Premium Cap" value={peso(highestCap)} tint="amber" />
                <StatCard icon={Coins} label="Base Floor" value={latestRate ? peso(latestRate.base_min_salary) : '—'} tint="emerald" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search
                    placeholder="Search by base salary, cap, or rate..."
                    onSearch={setSearchTerm}
                    className="w-full lg:max-w-sm"
                />
                <Button
                    onClick={() => { setEditingRate(null); setIsModalOpen(true); }}
                    className="w-full lg:w-auto shrink-0 font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Add Rate</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading PhilHealth rates…
                    </div>
                ) : rates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30 mb-3">
                            <HeartPulse className="h-6 w-6 text-rose-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No PhilHealth rates yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Add a rate schedule to start computing premiums.
                        </p>
                    </div>
                ) : filteredRates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30 mb-3">
                            <HeartPulse className="h-6 w-6 text-rose-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No matches</p>
                        <p className="text-xs text-muted font-rethink mt-1">Try a different keyword.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Base Salary</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employer</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Premium Cap</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Effective</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedRates.map((rate) => (
                                            <motion.tr
                                                key={rate.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-rose-50/40 dark:hover:bg-rose-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 font-mono text-[12px] font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                                        {peso(rate.base_min_salary)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {((rate.employer_rate ?? 0) * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {((rate.employee_rate ?? 0) * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[13px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                        {peso(rate.premium_cap)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-[11px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {rate.effective_date
                                                        ? new Date(rate.effective_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => { setEditingRate(rate); setIsModalOpen(true); }}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(rate)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                            aria-label="Delete"
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
                                {paginatedRates.map((rate) => (
                                    <motion.div
                                        key={rate.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 font-mono text-[12px] font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                                    {peso(rate.base_min_salary)}
                                                </span>
                                                <p className="text-[10px] text-muted font-rethink mt-1">
                                                    {rate.effective_date
                                                        ? new Date(rate.effective_date).toLocaleDateString()
                                                        : '—'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => { setEditingRate(rate); setIsModalOpen(true); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                    aria-label="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(rate)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                    aria-label="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Employer</p>
                                                <p className="font-mono font-semibold text-ink">{((rate.employer_rate ?? 0) * 100).toFixed(2)}%</p>
                                            </div>
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Employee</p>
                                                <p className="font-mono font-semibold text-ink">{((rate.employee_rate ?? 0) * 100).toFixed(2)}%</p>
                                            </div>
                                            <div className="rounded-md bg-rose-50 px-2 py-1.5 dark:bg-rose-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-rose-600">Cap</p>
                                                <p className="font-mono font-semibold text-rose-700 dark:text-rose-400">{peso(rate.premium_cap)}</p>
                                            </div>
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
                                    totalItems={filteredRates.length}
                                    itemsPerPage={PAGE_SIZE}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editingRate ? 'Edit PhilHealth Rate' : 'Add PhilHealth Rate'}
                    className="max-w-2xl"
                >
                    <ContributionForm
                        type="philhealth"
                        initialData={editingRate}
                        onSave={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Deactivate Rate"
                    className="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Deactivate {((deleteTarget.employer_rate ?? 0) * 100).toFixed(2)}% /{' '}
                                {((deleteTarget.employee_rate ?? 0) * 100).toFixed(2)}% rate? It will no longer be used.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700"
                            >
                                {isDeleting ? 'Deactivating…' : 'Deactivate'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PhilHealthRateManager;