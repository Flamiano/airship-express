'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, Building2, Loader2, AlertTriangle,
    Users, TrendingUp, Coins, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import ContributionForm from './ContributionForm';
import { StatCard } from './BenefitsShared';

const PAGE_SIZE = 8;

const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const SSSBracketManager = () => {
    const [brackets, setBrackets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBracket, setEditingBracket] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/benefits/sss'
    );

    useEffect(() => { loadBrackets(); }, []);

    const loadBrackets = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setBrackets(Array.isArray(data) ? data : []);
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load SSS brackets');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (formData: any) => {
        try {
            if (editingBracket) {
                await putData(`/${editingBracket.id}`, formData);
                toast.success('SSS bracket updated');
            } else {
                await postData('', formData);
                toast.success('SSS bracket added');
            }
            setIsModalOpen(false);
            loadBrackets();
        } catch {
            toast.error('Failed to save SSS bracket');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.success('SSS bracket deactivated');
            setDeleteTarget(null);
            loadBrackets();
        } catch {
            toast.error('Failed to deactivate SSS bracket');
        } finally {
            setIsDeleting(false);
        }
    };

    const sortedBrackets = useMemo(
        () => [...brackets].sort((a, b) => Number(a.range_min) - Number(b.range_min)),
        [brackets]
    );

    const filteredBrackets = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sortedBrackets;
        return sortedBrackets.filter((b) => {
            const min = String(b.range_min ?? '');
            const max = String(b.range_max ?? '');
            const msc = String(b.monthly_salary_credit ?? '');
            return (
                min.includes(term) ||
                max.includes(term) ||
                msc.includes(term)
            );
        });
    }, [sortedBrackets, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredBrackets.length / PAGE_SIZE));

    const paginatedBrackets = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredBrackets.slice(start, start + PAGE_SIZE);
    }, [filteredBrackets, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const activeCount = brackets.length;
    const highestMsc = useMemo(
        () => brackets.reduce((m, b) => Math.max(m, Number(b.monthly_salary_credit || 0)), 0),
        [brackets]
    );
    const avgEmployer = useMemo(() => {
        if (brackets.length === 0) return 0;
        const total = brackets.reduce((s, b) => s + Number(b.employer_share || 0), 0);
        return total / brackets.length;
    }, [brackets]);
    const coverage = useMemo(() => {
        if (brackets.length === 0) return 0;
        const min = Math.min(...brackets.map((b) => Number(b.range_min || 0)));
        const top = brackets.find((b) => !b.range_max);
        const max = top ? Number(top.range_min) : Math.max(...brackets.map((b) => Number(b.range_max || b.range_min || 0)));
        return max > 0 ? Math.round(((max - min) / max) * 100) : 0;
    }, [brackets]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Building2} label="Total Brackets" value={String(activeCount)} tint="blue" />
                <StatCard icon={TrendingUp} label="Highest MSC" value={peso(highestMsc)} tint="emerald" />
                <StatCard icon={Coins} label="Avg Employer Share" value={peso(avgEmployer)} tint="purple" />
                <StatCard icon={ShieldCheck} label="Coverage" value={`${coverage}%`} tint="amber" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Search
                    placeholder="Search by salary range or MSC..."
                    onSearch={setSearchTerm}
                    className="w-full lg:max-w-sm"
                />
                <Button
                    onClick={() => { setEditingBracket(null); setIsModalOpen(true); }}
                    className="w-full lg:w-auto shrink-0 font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">Add Bracket</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading SSS brackets…
                    </div>
                ) : brackets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                            <Building2 className="h-6 w-6 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No SSS brackets yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Add one to start computing contributions.
                        </p>
                    </div>
                ) : filteredBrackets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 mb-3">
                            <Building2 className="h-6 w-6 text-blue-500" />
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
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Salary Range</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">MSC</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employer</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Effective</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedBrackets.map((bracket) => (
                                            <motion.tr
                                                key={bracket.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 font-mono text-[12px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                                        <span>{peso(bracket.range_min)}</span>
                                                        <span className="text-muted">–</span>
                                                        <span>{bracket.range_max ? peso(bracket.range_max) : 'Above'}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[13px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                        {peso(bracket.monthly_salary_credit)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {peso(bracket.employer_share)}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {peso(bracket.employee_share)}
                                                </td>
                                                <td className="px-3 py-3 text-[11px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {bracket.effective_date
                                                        ? new Date(bracket.effective_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => { setEditingBracket(bracket); setIsModalOpen(true); }}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(bracket)}
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
                                {paginatedBrackets.map((bracket) => (
                                    <motion.div
                                        key={bracket.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 font-mono text-[12px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                                                    <span>{peso(bracket.range_min)}</span>
                                                    <span className="text-muted">–</span>
                                                    <span>{bracket.range_max ? peso(bracket.range_max) : 'Above'}</span>
                                                </span>
                                                <p className="text-[10px] text-muted font-rethink mt-1">
                                                    {bracket.effective_date
                                                        ? new Date(bracket.effective_date).toLocaleDateString()
                                                        : '—'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => { setEditingBracket(bracket); setIsModalOpen(true); }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                    aria-label="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(bracket)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                    aria-label="Delete"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                            <div className="rounded-md bg-ink/[0.03] px-2 py-1.5 dark:bg-ink/[0.06]">
                                                <p className="text-[9px] uppercase tracking-wide text-muted">MSC</p>
                                                <p className="font-mono font-semibold text-ink">{peso(bracket.monthly_salary_credit)}</p>
                                            </div>
                                            <div className="rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-emerald-600">Employer</p>
                                                <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{peso(bracket.employer_share)}</p>
                                            </div>
                                            <div className="rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
                                                <p className="text-[9px] uppercase tracking-wide text-amber-600">Employee</p>
                                                <p className="font-mono font-semibold text-amber-700 dark:text-amber-400">{peso(bracket.employee_share)}</p>
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
                                    totalItems={filteredBrackets.length}
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
                    title={editingBracket ? 'Edit SSS Bracket' : 'Add SSS Bracket'}
                    className="max-w-2xl"
                >
                    <ContributionForm
                        type="sss"
                        initialData={editingBracket}
                        onSave={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Deactivate Bracket"
                    className="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Deactivate {peso(deleteTarget.range_min)} –{' '}
                                {deleteTarget.range_max ? peso(deleteTarget.range_max) : 'Above'}? It will no longer be used.
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

export default SSSBracketManager;