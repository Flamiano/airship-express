'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Home, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line transition-colors duration-300">
                        <Home className="h-4.5 w-4.5 text-muted" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold font-bricolage text-ink">
                            Pag-IBIG Contribution Tiers
                        </h3>
                        <p className="text-[11px] text-muted font-rethink">
                            {tiers.length} tier{tiers.length === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setEditingTier(null);
                        setIsModalOpen(true);
                    }}
                    className="w-full sm:w-auto shrink-0 text-sm"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Tier
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden transition-colors duration-300">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading...
                    </div>
                ) : tiers.length === 0 ? (
                    <CardBody className="p-6">
                        <Alert variant="info" message="No Pag-IBIG tiers yet. Add one to start computing contributions." />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] transition-colors duration-300">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Tier
                                        </th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Salary Range
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Employer
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Employee
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">
                                            Max Employer
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hidden lg:table-cell">
                                            Max Employee
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
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
                                                className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.02]"
                                            >
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink">
                                                        {tier.tier_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 font-mono text-[13px] text-ink whitespace-nowrap">
                                                    ₱{Number(tier.salary_min).toLocaleString()}
                                                    <span className="mx-1 text-muted">–</span>
                                                    <span className="text-muted">
                                                        {tier.salary_max ? `₱${Number(tier.salary_max).toLocaleString()}` : 'Above'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono font-semibold text-[13px] text-pagibig border-pagibig/20 bg-pagibig/5 dark:border-pagibig/30 dark:bg-pagibig/10 dark:text-pagibig">
                                                        {(tier.employer_rate * 100).toFixed(2)}%
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    {(tier.employee_rate * 100).toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employer_share ? `₱${Number(tier.max_employer_share).toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-muted whitespace-nowrap hidden lg:table-cell">
                                                    {tier.max_employee_share ? `₱${Number(tier.max_employee_share).toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTier(tier);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-1.5 rounded-md border border-line bg-ink/5 text-ink hover:bg-ink/10 transition-colors"
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(tier)}
                                                            className="p-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
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

                        {totalPages > 1 && (
                            <div className="border-t border-line px-3 py-3 transition-colors duration-300">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    totalItems={tiers.length}
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
                        <div className="flex items-start gap-3 rounded-lg border border-line bg-ink/[0.02] px-4 py-3 transition-colors duration-300">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-ink/90 font-rethink leading-relaxed">
                                Deactivate "{deleteTarget.tier_name}"? It will no longer be used.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="w-full sm:w-auto bg-red-600 text-white hover:bg-red-700"
                            >
                                {isDeleting ? 'Deactivating...' : 'Deactivate'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PagIbigTierManager;