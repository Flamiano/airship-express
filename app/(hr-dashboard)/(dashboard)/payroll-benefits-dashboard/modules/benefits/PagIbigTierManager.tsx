'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, Home, Loader2, AlertTriangle,
    TrendingUp, Coins, Users,
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

const PagIbigTierManager = () => {
    const [tiers, setTiers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/benefits/pagibig'
    );

    useEffect(() => { loadTiers(); }, []);

    const loadTiers = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setTiers(Array.isArray(data) ? data : []);
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load Pag-IBIG tiers');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (formData: any) => {
        try {
            if (editingTier) {
                await putData(`/${editingTier.id}`, formData);
                toast.success('Pag-IBIG tier updated');
            } else {
                await postData('', formData);
                toast.success('Pag-IBIG tier added');
            }
            setIsModalOpen(false);
            loadTiers();
        } catch {
            toast.error('Failed to save Pag-IBIG tier');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.success('Pag-IBIG tier deactivated');
            setDeleteTarget(null);
            loadTiers();
        } catch {
            toast.error('Failed to deactivate Pag-IBIG tier');
        } finally {
            setIsDeleting(false);
        }
    };

    const sortedTiers = useMemo(
        () => [...tiers].sort((a, b) => Number(a.salary_min) - Number(b.salary_min)),
        [tiers]
    );

    const filteredTiers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedTiers;
        return sortedTiers.filter((t) => {
            const name = String(t.tier_name ?? '').toLowerCase();
            const min = String(t.salary_min ?? '');
            const max = String(t.salary_max ?? '');
            return name.includes(term) || min.includes(term) || max.includes(term);
        });
    }, [sortedTiers, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredTiers.length / PAGE_SIZE));

    const paginatedTiers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredTiers.slice(start, start + PAGE_SIZE);
    }, [filteredTiers, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const highestEmployerRate = useMemo(
        () => tiers.reduce((m, t) => Math.max(m, Number(t.employer_rate ?? 0)), 0),
        [tiers]
    );
    const highestEmployeeRate = useMemo(
        () => tiers.reduce((m, t) => Math.max(m, Number(t.employee_rate ?? 0)), 0),
        [tiers]
    );
    const maxSalaryCovered = useMemo(() => {
        const top = sortedTiers.find((t) => !t.salary_max);
        if (top) return Number(top.salary_min);
        return sortedTiers.reduce((m, t) => Math.max(m, Number(t.salary_max ?? 0)), 0);
    }, [sortedTiers]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Home} label="Total Tiers" value={String(tiers.length)} tint="emerald" />
                <StatCard icon={TrendingUp} label="Max Employer Rate" value={`${(highestEmployerRate * 100).toFixed(2)}%`} tint="blue" />
                <StatCard icon={Coins} label="Max Employee Rate" value={`${(highestEmployeeRate * 100).toFixed(2)}%`} tint="amber" />
                <StatCard icon={Users} label="Salary Covered Up To" value={peso(maxSalaryCovered)} tint="purple" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search
                    placeholder="Search by tier name or salary range..."
                    onSearch={setSearchTerm}
                    className="w-full lg:max-w-sm"
                />
                <Button
                    onClick={() => { setEditingTier(null); setIsModalOpen(true); }}
                    className="w-full lg:w-auto shrink-0 font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Add Tier</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading Pag-IBIG tiers…
                    </div>
                ) : tiers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                            <Home className="h-6 w-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No Pag-IBIG tiers yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Add one to start computing contributions.
                        </p>
                    </div>
                ) : filteredTiers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                            <Home className="h-6 w-6 text-emerald-500" />
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
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Tier</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Salary Range</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employer</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Max Employer</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Max Employee</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedTiers.map((tier) => (
                                            <motion.tr
                                                key={tier.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                        {tier.tier_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap font-mono text-[12px] text-ink">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.04] px-2 py-1 font-semibold dark:bg-ink/[0.08]">
                                                        <span>{peso(tier.salary_min)}</span>
                                                        <span className="text-muted">–</span>
                                                        <span>{tier.salary_max ? peso(tier.salary_max) : 'Above'}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 font-mono text-[12px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                        {((tier.employer_rate ?? 0) * 100).toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {((tier.employee_rate ?? 0) * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employer_share ? peso(tier.max_employer_share) : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employee_share ? peso(tier.max_employee_share) : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => { setEditingTier(tier); setIsModalOpen(true); }}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(tier)}
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
                                {paginatedTiers.map((tier) => (
                                    <motion.div
                                        key={tier.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                    {tier.tier_name}
                                                </span>
                                                <p className="mt-1.5 font-mono text-[11px] text-ink/70">
                                                    {peso(tier.salary_min)} – {tier.salary_max ? peso(tier.salary_max) : 'Above'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => { setEditingTier(tier); setIsModalOpen(true); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                    aria-label="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(tier)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                    aria-label="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-emerald-600">Employer</p>
                                                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                                    {((tier.employer_rate ?? 0) * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Employee</p>
                                                <p className="font-mono font-semibold text-ink">
                                                    {((tier.employee_rate ?? 0) * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Max Employer</p>
                                                <p className="font-mono text-ink/80">{tier.max_employer_share ? peso(tier.max_employer_share) : '—'}</p>
                                            </div>
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">Max Employee</p>
                                                <p className="font-mono text-ink/80">{tier.max_employee_share ? peso(tier.max_employee_share) : '—'}</p>
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
                                    totalItems={filteredTiers.length}
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
                    title={editingTier ? 'Edit Pag-IBIG Tier' : 'Add Pag-IBIG Tier'}
                    className="max-w-2xl"
                >
                    <ContributionForm
                        type="pagibig"
                        initialData={editingTier}
                        onSave={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Deactivate Tier"
                    className="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Deactivate "{deleteTarget.tier_name}"? It will no longer be used.
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

export default PagIbigTierManager;