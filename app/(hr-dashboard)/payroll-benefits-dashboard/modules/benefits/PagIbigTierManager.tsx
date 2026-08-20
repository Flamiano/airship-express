'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Home, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Badge } from '@/payroll-benefits-dashboard/components/ui/Badge';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';
import ContributionForm from './ContributionForm';

const PAGE_SIZE = 8;

const PagIbigTierManager = () => {
    const [tiers, setTiers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/benefits/pagibig');

    useEffect(() => {
        loadTiers();
    }, []);

    const loadTiers = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setTiers(data || []);
            setCurrentPage(1);
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
            toast.error('Failed to deactivate Pag-IBIG tier');
        } finally {
            setIsDeleting(false);
        }
    };

    const sortedTiers = useMemo(() => {
        return [...tiers].sort((a, b) => Number(a.salary_min) - Number(b.salary_min));
    }, [tiers]);

    const totalPages = Math.max(1, Math.ceil(sortedTiers.length / PAGE_SIZE));

    const paginatedTiers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedTiers.slice(start, start + PAGE_SIZE);
    }, [sortedTiers, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line">
                        <Home className="h-4.5 w-4.5 text-ink/70" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">Pag-IBIG Contribution Tiers</h3>
                        <p className="text-xs text-muted font-rethink">Sorted by salary, low to high</p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setEditingTier(null);
                        setIsModalOpen(true);
                    }}
                    className="w-full sm:w-auto shrink-0 font-rethink"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Tier
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-white border-line overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading tiers…
                    </div>
                ) : tiers.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message="No Pag-IBIG tiers yet. Add one to start computing contributions."
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Tier
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Salary Range
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employer
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employee
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink hidden lg:table-cell">
                                            Max Employer
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink hidden lg:table-cell">
                                            Max Employee
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedTiers.map((tier: any) => (
                                            <motion.tr
                                                key={tier.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015]"
                                            >
                                                <td className="px-5 py-3.5">
                                                    <Badge variant="outline" className="font-medium">
                                                        {tier.tier_name}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-ink whitespace-nowrap">
                                                    ₱{Number(tier.salary_min).toLocaleString()}
                                                    <span className="mx-1.5 text-muted/50">–</span>
                                                    <span className="text-muted">
                                                        {tier.salary_max ? `₱${Number(tier.salary_max).toLocaleString()}` : 'Above'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-pagibig whitespace-nowrap">
                                                    {(tier.employer_rate * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    {(tier.employee_rate * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employer_share ? `₱${Number(tier.max_employer_share).toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employee_share ? `₱${Number(tier.max_employee_share).toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTier(tier);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                            aria-label="Edit tier"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(tier)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                                                            aria-label="Deactivate tier"
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
                                {paginatedTiers.map((tier: any) => (
                                    <motion.div
                                        key={tier.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5"
                                    >
                                        <Badge variant="outline" className="font-medium">
                                            {tier.tier_name}
                                        </Badge>
                                        <p className="mt-1.5 text-sm font-mono tabular-nums text-ink">
                                            ₱{Number(tier.salary_min).toLocaleString()}
                                            <span className="mx-1 text-muted/50">–</span>
                                            {tier.salary_max ? `₱${Number(tier.salary_max).toLocaleString()}` : 'Above'}
                                        </p>
                                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Employer Rate
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-pagibig">
                                                    {(tier.employer_rate * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Employee Rate
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-ink/80">
                                                    {(tier.employee_rate * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Max Employer
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-ink/80">
                                                    {tier.max_employer_share ? `₱${Number(tier.max_employer_share).toLocaleString()}` : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Max Employee
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-ink/80">
                                                    {tier.max_employee_share ? `₱${Number(tier.max_employee_share).toLocaleString()}` : '—'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingTier(tier);
                                                    setIsModalOpen(true);
                                                }}
                                                className="flex-1 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300"
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => setDeleteTarget(tier)}
                                                className="flex-1 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                Delete
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-line px-4 py-3 sm:px-5">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
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
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed">
                                Deactivate the "<span className="font-semibold">{deleteTarget.tier_name}</span>" tier? It will no
                                longer be used for new contribution computations.
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
                                variant="destructive"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="w-full sm:w-auto font-rethink shadow-sm"
                            >
                                {isDeleting ? (
                                    <>
                                        <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Deactivating…
                                    </>
                                ) : (
                                    'Deactivate'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PagIbigTierManager;