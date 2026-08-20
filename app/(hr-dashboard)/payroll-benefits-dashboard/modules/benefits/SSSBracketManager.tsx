'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/payroll-benefits-dashboard/components/ui/Pagination';
import { useApi } from '@/payroll-benefits-dashboard/hooks/api/useApi';
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 border border-line">
                        <Building2 className="h-4.5 w-4.5 text-ink/70" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold font-bricolage text-ink leading-tight">
                            SSS Monthly Salary Credit &amp; Contributions
                        </h3>
                        <p className="text-xs text-muted font-rethink">
                            {brackets.length} salary bracket{brackets.length === 1 ? '' : 's'} on record, sorted low to high
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setEditingBracket(null);
                        setIsModalOpen(true);
                    }}
                    className="w-full sm:w-auto shrink-0 font-rethink"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Bracket
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-white border-line overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                        Loading brackets…
                    </div>
                ) : brackets.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert
                            variant="info"
                            message="No SSS brackets yet. Add one to start computing contributions."
                        />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-line">
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Salary Range
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            MSC
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employer
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Employee
                                        </th>
                                        <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
                                            Effective
                                        </th>
                                        <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted font-rethink">
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
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.015]"
                                            >
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className="text-sm font-mono tabular-nums text-ink">
                                                        ₱{Number(bracket.range_min).toLocaleString()}
                                                    </span>
                                                    <span className="mx-1.5 text-muted/50">–</span>
                                                    <span className="text-sm font-mono tabular-nums text-muted">
                                                        {bracket.range_max ? `₱${Number(bracket.range_max).toLocaleString()}` : 'Above'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-sss whitespace-nowrap">
                                                    ₱{Number(bracket.monthly_salary_credit).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    ₱{Number(bracket.employer_share).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-ink/80 whitespace-nowrap">
                                                    ₱{Number(bracket.employee_share).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-muted font-rethink whitespace-nowrap">
                                                    {new Date(bracket.effective_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                setEditingBracket(bracket);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                            aria-label="Edit bracket"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(bracket)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                                                            aria-label="Deactivate bracket"
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
                                {paginatedBrackets.map((bracket: any) => (
                                    <motion.div
                                        key={bracket.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-mono tabular-nums text-ink">
                                                    ₱{Number(bracket.range_min).toLocaleString()}
                                                    <span className="mx-1 text-muted/50">–</span>
                                                    {bracket.range_max ? `₱${Number(bracket.range_max).toLocaleString()}` : 'Above'}
                                                </p>
                                                <p className="mt-1 text-[11px] text-muted font-rethink">
                                                    Effective {new Date(bracket.effective_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-sss whitespace-nowrap">
                                                ₱{Number(bracket.monthly_salary_credit).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Employer
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-ink/80">
                                                    ₱{Number(bracket.employer_share).toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted/70 font-rethink">
                                                    Employee
                                                </p>
                                                <p className="mt-0.5 text-sm font-mono tabular-nums text-ink/80">
                                                    ₱{Number(bracket.employee_share).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingBracket(bracket);
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
                                                onClick={() => setDeleteTarget(bracket)}
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
                    <div className="space-y-5">
                        <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed">
                                Deactivate the ₱{deleteTarget.range_min} –{' '}
                                {deleteTarget.range_max ? `₱${deleteTarget.range_max}` : 'Above'} bracket? It will no longer be
                                used for new contribution computations.
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

export default SSSBracketManager;