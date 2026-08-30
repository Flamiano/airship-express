'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import ContributionForm from './ContributionForm';

const PAGE_SIZE = 8;

const SSSBracketManager = () => {
    const [brackets, setBrackets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBracket, setEditingBracket] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/benefits/sss');

    useEffect(() => {
        loadBrackets();
    }, []);

    const loadBrackets = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setBrackets(data || []);
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

    const sortedBrackets = useMemo(() => {
        return [...brackets].sort((a, b) => Number(a.range_min) - Number(b.range_min));
    }, [brackets]);

    const totalPages = Math.max(1, Math.ceil(sortedBrackets.length / PAGE_SIZE));

    const paginatedBrackets = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedBrackets.slice(start, start + PAGE_SIZE);
    }, [sortedBrackets, currentPage]);

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
                        <Building2 className="h-4.5 w-4.5 text-muted" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold font-bricolage text-ink">
                            SSS Monthly Salary Credit
                        </h3>
                        <p className="text-[11px] text-muted font-rethink">
                            {brackets.length} bracket{brackets.length === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setEditingBracket(null);
                        setIsModalOpen(true);
                    }}
                    className="w-full sm:w-auto shrink-0 text-sm"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Bracket
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden transition-colors duration-300">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading...
                    </div>
                ) : brackets.length === 0 ? (
                    <CardBody className="p-6">
                        <Alert variant="info" message="No SSS brackets yet. Add one to start computing contributions." />
                    </CardBody>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] transition-colors duration-300">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Salary Range
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            MSC
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Employer
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Employee
                                        </th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">
                                            Effective
                                        </th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedBrackets.map((bracket: any) => (
                                            <motion.tr
                                                key={bracket.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.02]"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-[13px] text-ink">
                                                        ₱{Number(bracket.range_min).toLocaleString()}
                                                    </span>
                                                    <span className="mx-1 text-muted">–</span>
                                                    <span className="font-mono text-[13px] text-muted">
                                                        {bracket.range_max ? `₱${Number(bracket.range_max).toLocaleString()}` : 'Above'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono font-semibold text-[13px] text-sss border-sss/20 bg-sss/5 dark:border-sss/30 dark:bg-sss/10 dark:text-sss">
                                                        ₱{Number(bracket.monthly_salary_credit).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    ₱{Number(bracket.employer_share).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono text-[13px] text-ink/80 whitespace-nowrap">
                                                    ₱{Number(bracket.employee_share).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-3 text-[11px] text-muted whitespace-nowrap hidden sm:table-cell">
                                                    {new Date(bracket.effective_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingBracket(bracket);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-1.5 rounded-md border border-line bg-ink/5 text-ink hover:bg-ink/10 transition-colors"
                                                            aria-label="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(bracket)}
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
                                    totalItems={brackets.length}
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
                        <div className="flex items-start gap-3 rounded-lg border border-line bg-ink/[0.02] px-4 py-3 transition-colors duration-300">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-ink/90 font-rethink leading-relaxed">
                                Deactivate ₱{deleteTarget.range_min} –{' '}
                                {deleteTarget.range_max ? `₱${deleteTarget.range_max}` : 'Above'}? It will no longer be used.
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

export default SSSBracketManager;