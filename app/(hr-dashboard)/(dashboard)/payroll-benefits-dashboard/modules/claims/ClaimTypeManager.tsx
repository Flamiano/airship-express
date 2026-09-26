'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Tag,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Receipt,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { Input } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Input';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { HR4ClaimType } from '../../types';

const EMPTY_FORM = {
    name: '',
    description: '',
    max_amount: '',
    requires_receipt: true,
    is_active: true,
};

const formatCurrency = (amount: number | null) =>
    amount === null || amount === undefined
        ? 'No limit'
        : `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({
    icon: Icon,
    label,
    value,
    tint,
}: {
    icon: React.ComponentType<{ className?: string; size?: number; title?: string }>;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'gray' | 'red';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
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

const ClaimTypeManager = () => {
    const toast = useToast();
    const [types, setTypes] = useState<HR4ClaimType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<HR4ClaimType | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<HR4ClaimType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { fetchData, postData, putData, deleteData } = useApi(
        '/payroll-benefits-dashboard/api/claims/types'
    );

    useEffect(() => {
        loadTypes();
    }, []);

    const loadTypes = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setTypes(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error('Load claim types error:', error);
            toast.showError(error?.message || 'Failed to load claim types');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (type: HR4ClaimType) => {
        setEditTarget(type);
        setForm({
            name: type.name,
            description: type.description || '',
            max_amount: type.max_amount !== null ? String(type.max_amount) : '',
            requires_receipt: type.requires_receipt,
            is_active: type.is_active,
        });
        setIsModalOpen(true);
    };

    const isSaveDisabled = useMemo(() => {
        if (isSaving) return true;
        if (!form.name.trim()) return true;
        if (form.max_amount.trim()) {
            const n = Number(form.max_amount);
            if (!Number.isFinite(n) || n < 0) return true;
        }
        return false;
    }, [form.name, form.max_amount, isSaving]);

    const handleSave = async () => {
        if (isSaveDisabled) return;

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            max_amount: form.max_amount.trim() ? Number(form.max_amount) : null,
            requires_receipt: form.requires_receipt,
            is_active: form.is_active,
        };

        setIsSaving(true);
        try {
            if (editTarget) {
                await putData(`/${editTarget.id}`, payload);
                toast.showSuccess('Claim type updated');
            } else {
                await postData('', payload);
                toast.showSuccess('Claim type created');
            }
            setIsModalOpen(false);
            setForm(EMPTY_FORM);
            setEditTarget(null);
            loadTypes();
        } catch (error: any) {
            console.error('Save claim type error:', error);
            toast.showError(error?.message || 'Failed to save claim type');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (type: HR4ClaimType) => {
        try {
            await putData(`/${type.id}`, { is_active: !type.is_active });
            toast.showSuccess(`Claim type ${type.is_active ? 'deactivated' : 'activated'}`);
            loadTypes();
        } catch (error: any) {
            console.error('Toggle active error:', error);
            toast.showError(error?.message || 'Failed to update claim type');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Claim type deleted');
            setDeleteTarget(null);
            loadTypes();
        } catch (error: any) {
            console.error('Delete claim type error:', error);
            toast.showError(error?.message || 'Failed to delete claim type');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredTypes = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return types;
        return types.filter(
            (t) =>
                t.name.toLowerCase().includes(term) ||
                (t.description || '').toLowerCase().includes(term)
        );
    }, [types, searchTerm]);

    const activeCount = useMemo(() => types.filter((t) => t.is_active).length, [types]);
    const receiptRequiredCount = useMemo(
        () => types.filter((t) => t.requires_receipt).length,
        [types]
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard icon={Tag} label="Total Types" value={String(types.length)} tint="blue" />
                <StatCard icon={CheckCircle2} label="Active" value={String(activeCount)} tint="emerald" />
                <StatCard
                    icon={Receipt}
                    label="Require Receipt"
                    value={String(receiptRequiredCount)}
                    tint="amber"
                />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <Search
                    placeholder="Search claim types..."
                    onSearch={setSearchTerm}
                    className="w-full md:max-w-sm"
                />
                <Button
                    onClick={openCreate}
                    className="w-full md:w-auto shrink-0 font-rethink text-xs h-9 px-3 rounded-md bg-pink-600 text-white hover:bg-pink-700 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                >
                    <span className="flex flex-row items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-nowrap leading-none">New Claim Type</span>
                    </span>
                </Button>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading claim types…
                    </div>
                ) : types.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30 mb-3">
                            <Tag className="h-6 w-6 text-pink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No claim types yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Create one to start accepting claims.
                        </p>
                    </div>
                ) : filteredTypes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30 mb-3">
                            <Tag className="h-6 w-6 text-pink-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No matches</p>
                        <p className="text-xs text-muted font-rethink mt-1">
                            Try a different keyword.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4">
                        <AnimatePresence initial={false}>
                            {filteredTypes.map((type) => (
                                <motion.div
                                    key={type.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="group relative rounded-xl border border-line bg-paper p-4 dark:border-line/30 hover:bg-ink/[0.015] transition-colors overflow-hidden"
                                >
                                    <div
                                        className={`absolute inset-y-0 left-0 w-1 ${type.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                                            }`}
                                    />
                                    <div className="flex items-start justify-between gap-3 pl-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-ink font-rethink truncate">
                                                    {type.name}
                                                </p>
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium font-rethink ${type.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
                                                        }`}
                                                >
                                                    {type.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            {type.description && (
                                                <p className="mt-1 text-xs text-muted font-rethink line-clamp-2">
                                                    {type.description}
                                                </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-rethink text-ink/70">
                                                <span className="font-mono">{formatCurrency(type.max_amount)}</span>
                                                <span className="flex items-center gap-1">
                                                    {type.requires_receipt ? (
                                                        <>
                                                            <Receipt className="h-3 w-3 text-amber-500" /> Receipt
                                                            required
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="h-3 w-3 text-muted" /> No receipt
                                                            needed
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 gap-1.5">
                                            <button
                                                onClick={() => toggleActive(type)}
                                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:scale-105 ${type.is_active
                                                        ? 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400'
                                                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                    }`}
                                                aria-label={type.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {type.is_active ? (
                                                    <XCircle className="h-3.5 w-3.5" />
                                                ) : (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => openEdit(type)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                aria-label="Edit"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(type)}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
                                                aria-label="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </Card>

            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editTarget ? 'Edit Claim Type' : 'New Claim Type'}
                    className="max-w-lg"
                    accent="pink"
                    icon={Tag}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                className="w-full sm:w-auto font-rethink"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaveDisabled}
                                className="w-full sm:w-auto font-rethink"
                            >
                                {isSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Type'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Transportation"
                                leftIcon={<Tag className="h-4 w-4 text-accent" />}
                            />
                            {!form.name.trim() && (
                                <p className="mt-1 text-[10px] text-red-600 font-rethink">
                                    Required to create a claim type.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Description
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="What this claim type covers (optional)"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">
                                Max Amount (optional)
                            </label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.max_amount}
                                onChange={(e) => setForm((f) => ({ ...f, max_amount: e.target.value }))}
                                placeholder="Leave blank for no limit"
                                leftIcon={
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                        ₱
                                    </span>
                                }
                                className="font-mono"
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">
                                Require receipt upload
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setForm((f) => ({ ...f, requires_receipt: !f.requires_receipt }))
                                }
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.requires_receipt ? 'bg-accent' : 'bg-ink/15'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.requires_receipt ? 'translate-x-4' : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs font-medium text-ink font-rethink">Active</span>
                            <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${form.is_active ? 'bg-accent' : 'bg-ink/15'
                                    }`}
                            >
                                <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Claim Type"
                    className="max-w-md"
                    accent="red"
                    icon={AlertTriangle}
                    footer={
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
                                className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                            >
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                                Delete the claim type &ldquo;{deleteTarget.name}&rdquo;?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-rethink">
                                Existing claims of this type will keep their reference but this type will no
                                longer be selectable.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ClaimTypeManager;