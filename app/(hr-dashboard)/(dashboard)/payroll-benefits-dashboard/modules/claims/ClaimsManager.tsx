'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Plus, Eye, Check, X, Banknote, Loader2, Receipt, AlertTriangle, Trash2, Archive, ArchiveRestore,
    Wallet, Clock3, CheckCircle2, XCircle, FileText, Upload, Image, Calendar, User, Tag, Pencil,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { createClient } from '@/app/(hr-dashboard)/supabase/client';
import { ImageViewer } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/ImageViewer';

const PAGE_SIZE = 8;

const STORAGE_BUCKET = 'hr4';
const STORAGE_FOLDER = 'claims';

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
    reimbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
};

const STATUS_DOT_COLORS: Record<string, string> = {
    pending: 'bg-amber-500',
    approved: 'bg-blue-500',
    rejected: 'bg-red-500',
    reimbursed: 'bg-emerald-500',
    cancelled: 'bg-gray-400',
};

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'reimbursed'] as const;

const EMPTY_FORM = { employee_id: '', claim_type_id: '', amount: '', description: '', receipt_url: '' };

const formatDate = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

const formatDateTime = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return value;
    }
};

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({
    icon: Icon, label, value, tint,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    tint: 'accent' | 'emerald' | 'blue' | 'amber' | 'red' | 'gray';
}) {
    const tints: Record<string, string> = {
        accent: 'bg-accent/10 text-accent',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30 transition-colors duration-300">
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

const ClaimsManager = () => {
    const toast = useToast();
    const supabase = createClient();
    const [claims, setClaims] = useState<any[]>([]);
    const [archivedClaims, setArchivedClaims] = useState<any[]>([]);
    const [claimTypes, setClaimTypes] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showArchived, setShowArchived] = useState(false);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [selected, setSelected] = useState<any | null>(null);
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [editAction, setEditAction] = useState<'approve' | 'reject' | 'reimburse' | 'archive' | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<any | null>(null);
    const [isUnarchiving, setIsUnarchiving] = useState(false);

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const { fetchData, postData, putData, deleteData } = useApi('/payroll-benefits-dashboard/api/claims');
    const { fetchData: fetchTypes } = useApi('/payroll-benefits-dashboard/api/claims/types');
    const { fetchData: fetchEmployees } = useApi('/payroll-benefits-dashboard/api/payroll/employee-info');

    const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [claimsData, typesData, employeesData] = await Promise.all([
                fetchData(),
                fetchTypes(),
                fetchEmployees(),
            ]);

            const activeClaims = (claimsData || []).filter((c: any) => !c.is_archived);
            const archived = (claimsData || []).filter((c: any) => c.is_archived);

            setClaims(activeClaims);
            setArchivedClaims(archived);
            setClaimTypes((typesData || []).filter((t: any) => t.is_active));
            setEmployees(employeesData || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load claims error:', error);
            toast.showError(error?.message || 'Failed to load claims');
        } finally {
            setLoading(false);
        }
    }, [fetchData, fetchTypes, fetchEmployees, toast]);

    useEffect(() => {
        loadAll();

        autoRefreshInterval.current = setInterval(() => {
            loadAll();
        }, 30000);

        return () => {
            if (autoRefreshInterval.current) {
                clearInterval(autoRefreshInterval.current);
            }
        };
    }, [loadAll]);

    const uploadImageToStorage = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${STORAGE_FOLDER}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.message.includes('bucket not found')) {
                toast.showError(`Storage bucket "${STORAGE_BUCKET}" not found. Please create it in Supabase Storage.`, 'Bucket Error');
            } else {
                toast.showError(uploadError.message, 'Upload Failed');
            }
            throw new Error(uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleFileSelect = (file: File) => {
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(previewUrl);
        setSelectedFile(file);
        setUploadedFileName(file.name);
        toast.showSuccess('Image selected. Preview available below.');
    };

    const handleRemoveImage = () => {
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl(null);
        setSelectedFile(null);
        setUploadedFileName(null);
        setForm((f) => ({ ...f, receipt_url: '' }));
    };

    const handleCreate = async () => {
        if (!form.employee_id || !form.claim_type_id || !form.amount) {
            toast.showError('Employee, claim type, and amount are required');
            return;
        }
        if (Number(form.amount) <= 0) {
            toast.showError('Amount must be greater than zero');
            return;
        }

        setIsSaving(true);
        try {
            let receiptUrl = form.receipt_url || null;

            if (selectedFile) {
                setUploadingImage(true);
                try {
                    receiptUrl = await uploadImageToStorage(selectedFile);
                    setForm((f) => ({ ...f, receipt_url: receiptUrl }));
                } catch (error) {
                    setUploadingImage(false);
                    setIsSaving(false);
                    return;
                }
                setUploadingImage(false);
            }

            await postData('', {
                employee_id: form.employee_id,
                claim_type_id: Number(form.claim_type_id),
                amount: Number(form.amount),
                description: form.description.trim() || null,
                receipt_url: receiptUrl,
            });

            toast.showSuccess('Claim submitted');
            setIsCreateOpen(false);
            setForm(EMPTY_FORM);
            setSelectedFile(null);
            setUploadedFileName(null);
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
                setImagePreviewUrl(null);
            }
            loadAll();
        } catch (error: any) {
            console.error('Create claim error:', error);
            toast.showError(error?.message || 'Failed to submit claim');
        } finally {
            setIsSaving(false);
            setUploadingImage(false);
        }
    };

    const openEditModal = (claim: any, action: 'approve' | 'reject' | 'reimburse' | 'archive') => {
        setEditTarget(claim);
        setEditAction(action);
        setEditNotes('');
        setIsProcessing(false);
    };

    const handleApprove = async () => {
        if (!editTarget) return;

        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, { status: 'approved' });
            toast.showSuccess(`Claim from ${editTarget.employee_name} approved`);
            setEditTarget(null);
            setEditAction(null);
            setEditNotes('');
            loadAll();
        } catch (error: any) {
            console.error('Approve error:', error);
            toast.showError(error?.message || 'Failed to approve claim');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!editTarget) return;

        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, {
                status: 'rejected',
                review_notes: editNotes.trim() || null
            });
            toast.showSuccess(`Claim from ${editTarget.employee_name} rejected`);
            setEditTarget(null);
            setEditAction(null);
            setEditNotes('');
            loadAll();
        } catch (error: any) {
            console.error('Reject error:', error);
            toast.showError(error?.message || 'Failed to reject claim');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReimburse = async () => {
        if (!editTarget) return;

        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, { status: 'reimbursed' });
            toast.showSuccess(`Claim from ${editTarget.employee_name} marked as reimbursed`);
            setEditTarget(null);
            setEditAction(null);
            setEditNotes('');
            loadAll();
        } catch (error: any) {
            console.error('Reimburse error:', error);
            toast.showError(error?.message || 'Failed to mark claim as reimbursed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleArchive = async () => {
        if (!editTarget) return;

        setIsProcessing(true);
        try {
            await putData(`/${editTarget.id}`, { is_archived: true });
            toast.showSuccess(`Claim from ${editTarget.employee_name} archived`);
            setEditTarget(null);
            setEditAction(null);
            setEditNotes('');
            loadAll();
        } catch (error: any) {
            console.error('Archive error:', error);
            toast.showError(error?.message || 'Failed to archive claim');
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Claim deleted');
            setDeleteTarget(null);
            loadAll();
        } catch (error: any) {
            console.error('Delete claim error:', error);
            toast.showError(error?.message || 'Failed to delete claim');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmUnarchive = async () => {
        if (!unarchiveTarget) return;
        setIsUnarchiving(true);
        try {
            await putData(`/${unarchiveTarget.id}`, { is_archived: false });
            toast.showSuccess('Claim restored from archive');
            setUnarchiveTarget(null);
            loadAll();
        } catch (error: any) {
            console.error('Unarchive claim error:', error);
            toast.showError(error?.message || 'Failed to restore claim');
        } finally {
            setIsUnarchiving(false);
        }
    };

    const sortedClaims = useMemo(() => {
        return [...claims].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }, [claims]);

    const filteredClaims = useMemo(() => {
        let result = sortedClaims;
        if (statusFilter !== 'all') {
            result = result.filter((c) => c.status === statusFilter);
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            result = result.filter((c) =>
                (c.employee_name || '').toLowerCase().includes(term) ||
                (c.claim_type_name || '').toLowerCase().includes(term) ||
                (c.description || '').toLowerCase().includes(term)
            );
        }
        return result;
    }, [sortedClaims, statusFilter, searchTerm]);

    const displayClaims = showArchived ? archivedClaims : filteredClaims;
    const totalPages = Math.max(1, Math.ceil(displayClaims.length / PAGE_SIZE));
    const paginatedClaims = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return displayClaims.slice(start, start + PAGE_SIZE);
    }, [displayClaims, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, showArchived]);

    const pendingCount = useMemo(() => claims.filter((c) => c.status === 'pending').length, [claims]);
    const approvedAmount = useMemo(
        () => claims.filter((c) => c.status === 'approved').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [claims]
    );
    const reimbursedYtd = useMemo(
        () => claims.filter((c) => c.status === 'reimbursed').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [claims]
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                        <Receipt className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold font-bricolage text-ink leading-tight">Claims &amp; Reimbursements</h3>
                        <p className="text-[11px] sm:text-xs text-muted font-rethink">
                            {claims.length} claim{claims.length === 1 ? '' : 's'} on record
                            {archivedClaims.length > 0 && ` (${archivedClaims.length} archived)`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Clock3} label="Pending Review" value={String(pendingCount)} tint="amber" />
                <StatCard icon={CheckCircle2} label="Approved (Unpaid)" value={peso(approvedAmount)} tint="blue" />
                <StatCard icon={Wallet} label="Reimbursed Total" value={peso(reimbursedYtd)} tint="emerald" />
                <StatCard icon={FileText} label="Total Claims" value={String(claims.length)} tint="gray" />
            </div>

            <div className="flex flex-col gap-3">
                <Search placeholder="Search by employee, type, or description..." onSearch={setSearchTerm} className="w-full" />
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {STATUS_FILTERS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize font-rethink transition-colors ${statusFilter === s
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-paper text-ink/70 border-line hover:bg-ink/5 dark:border-line/30'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                        {archivedClaims.length > 0 && (
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize font-rethink transition-colors flex items-center gap-1.5 ${showArchived
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-paper text-ink/70 border-line hover:bg-ink/5 dark:border-line/30'
                                    }`}
                            >
                                <Archive className="h-3 w-3" />
                                Archived ({archivedClaims.length})
                            </button>
                        )}
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="w-full md:w-auto shrink-0 font-rethink text-sm h-[42px] px-4 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                    >
                        <span className="flex flex-row items-center justify-center gap-2 w-full">
                            <Plus className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap leading-none">New Claim</span>
                        </span>
                    </Button>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading claims…
                    </div>
                ) : displayClaims.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message={showArchived ? "No archived claims found." : "No claims yet. Submit one to get started."} />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Type</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Submitted</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence initial={false}>
                                        {paginatedClaims.map((claim) => (
                                            <motion.tr
                                                key={claim.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-ink/[0.025]"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <p className="text-[13px] font-medium text-ink font-rethink">{claim.employee_name}</p>
                                                    {claim.employee_id_number && (
                                                        <p className="text-[10px] text-muted font-rethink">{claim.employee_id_number}</p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap hidden lg:table-cell">
                                                    {claim.claim_type_name}
                                                </td>
                                                <td className="px-3 py-3 text-[12px] text-ink/70 font-rethink whitespace-nowrap">
                                                    {formatDate(claim.submitted_at)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(claim.amount)}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                        {claim.is_archived && (
                                                            <span className="ml-1 text-[8px] text-muted">(archived)</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setSelected(claim)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                            title="View claim details"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>

                                                        {!claim.is_archived && claim.status === 'pending' && (
                                                            <button
                                                                onClick={() => openEditModal(claim, 'approve')}
                                                                className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                                title="Approve or reject this claim"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}

                                                        {!claim.is_archived && claim.status === 'approved' && (
                                                            <button
                                                                onClick={() => openEditModal(claim, 'reimburse')}
                                                                className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800/30 dark:bg-blue-950/30 dark:text-blue-400"
                                                                title="Mark as reimbursed"
                                                            >
                                                                <Banknote className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}

                                                        {!claim.is_archived && (claim.status === 'reimbursed' || claim.status === 'rejected') && (
                                                            <button
                                                                onClick={() => openEditModal(claim, 'archive')}
                                                                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400"
                                                                title="Archive this claim"
                                                            >
                                                                <Archive className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}

                                                        {claim.is_archived && (
                                                            <button
                                                                onClick={() => setUnarchiveTarget(claim)}
                                                                className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                                title="Restore from archive"
                                                            >
                                                                <ArchiveRestore className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => setDeleteTarget(claim)}
                                                            className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400"
                                                            title="Delete this claim permanently"
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

                        <div className="md:hidden space-y-3 p-3">
                            <AnimatePresence initial={false}>
                                {paginatedClaims.map((claim, i) => (
                                    <motion.div
                                        key={claim.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.03 }}
                                        className="rounded-xl border border-line bg-paper p-4 shadow-sm dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-medium text-ink font-rethink truncate">{claim.employee_name}</p>
                                                <p className="text-[11px] text-muted font-rethink">{claim.claim_type_name} · {formatDate(claim.submitted_at)}</p>
                                                <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                    {claim.status}
                                                    {claim.is_archived && (
                                                        <span className="ml-1 text-[8px] text-muted">(archived)</span>
                                                    )}
                                                </span>
                                            </div>
                                            <p className="shrink-0 text-[15px] font-mono font-semibold tabular-nums text-ink">{peso(claim.amount)}</p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(claim)} className="flex-1 min-w-[60px] text-xs" title="View claim details">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                View
                                            </Button>

                                            {!claim.is_archived && claim.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => openEditModal(claim, 'approve')} className="flex-1 min-w-[60px] text-xs border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400" title="Approve or reject this claim">
                                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                    Review
                                                </Button>
                                            )}

                                            {!claim.is_archived && claim.status === 'approved' && (
                                                <Button size="sm" variant="outline" onClick={() => openEditModal(claim, 'reimburse')} className="flex-1 min-w-[60px] text-xs border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/30 dark:bg-blue-950/30 dark:text-blue-400" title="Mark as reimbursed">
                                                    <Banknote className="h-3.5 w-3.5 mr-1.5" />
                                                    Reimburse
                                                </Button>
                                            )}

                                            {!claim.is_archived && (claim.status === 'reimbursed' || claim.status === 'rejected') && (
                                                <Button size="sm" variant="outline" onClick={() => openEditModal(claim, 'archive')} className="flex-1 min-w-[60px] text-xs border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400" title="Archive this claim">
                                                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                                                    Archive
                                                </Button>
                                            )}

                                            {claim.is_archived && (
                                                <Button size="sm" variant="outline" onClick={() => setUnarchiveTarget(claim)} className="flex-1 min-w-[60px] text-xs border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-950/30 dark:text-emerald-400" title="Restore from archive">
                                                    <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                                                    Restore
                                                </Button>
                                            )}

                                            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(claim)} className="flex-1 min-w-[60px] text-xs border-red-200 bg-red-50 text-red-600 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400" title="Delete this claim permanently">
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                Delete
                                            </Button>
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
                                    itemsPerPage={PAGE_SIZE}
                                    totalItems={displayClaims.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {isCreateOpen && (
                <Modal
                    isOpen={isCreateOpen}
                    onClose={() => {
                        setIsCreateOpen(false);
                        setForm(EMPTY_FORM);
                        setSelectedFile(null);
                        setUploadedFileName(null);
                        if (imagePreviewUrl) {
                            URL.revokeObjectURL(imagePreviewUrl);
                            setImagePreviewUrl(null);
                        }
                    }}
                    title="New Claim"
                    className="max-w-lg"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => {
                                setIsCreateOpen(false);
                                setForm(EMPTY_FORM);
                                setSelectedFile(null);
                                setUploadedFileName(null);
                                if (imagePreviewUrl) {
                                    URL.revokeObjectURL(imagePreviewUrl);
                                    setImagePreviewUrl(null);
                                }
                            }} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleCreate} disabled={isSaving} className="w-full sm:w-auto font-rethink">
                                {isSaving ? 'Submitting…' : 'Submit Claim'}
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Employee</label>
                            <select
                                value={form.employee_id}
                                onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            >
                                <option value="">Select employee…</option>
                                {employees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_name} {emp.employee_id_number ? `(${emp.employee_id_number})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Claim Type</label>
                            <select
                                value={form.claim_type_id}
                                onChange={(e) => setForm((f) => ({ ...f, claim_type_id: e.target.value }))}
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            >
                                <option value="">Select claim type…</option>
                                {claimTypes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Amount</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={2}
                                placeholder="Brief note on this claim"
                                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Receipt / Proof</label>
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-rethink text-accent hover:bg-accent/10 transition-colors flex-1">
                                    <Upload className="h-4 w-4" />
                                    <span>{selectedFile ? 'Change Image' : 'Select Image'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileSelect(file);
                                        }}
                                        disabled={isSaving || uploadingImage}
                                    />
                                </label>
                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-rethink text-red-600 hover:bg-red-100 transition-colors"
                                        title="Remove image"
                                        disabled={isSaving || uploadingImage}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {imagePreviewUrl && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Image className="h-4 w-4 text-emerald-500" />
                                            <span className="text-xs font-medium text-ink font-rethink">
                                                {selectedFile?.name || 'Image preview'}
                                            </span>
                                            <span className="text-[10px] text-muted font-rethink">
                                                ({(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB)
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-amber-500 font-rethink">
                                            Will be uploaded on submit
                                        </span>
                                    </div>
                                    <div className="relative rounded-lg border border-line overflow-hidden dark:border-line/30 bg-paper/50">
                                        <img
                                            src={imagePreviewUrl}
                                            alt="Receipt preview"
                                            className="max-h-48 w-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded font-rethink">
                                            Preview
                                        </div>
                                    </div>
                                </div>
                            )}

                            {uploadingImage && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-muted font-rethink">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Uploading image...
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {editTarget && editAction && (
                <Modal
                    isOpen={!!editTarget}
                    onClose={() => {
                        setEditTarget(null);
                        setEditAction(null);
                        setEditNotes('');
                    }}
                    title={
                        editAction === 'approve' ? 'Review Claim' :
                            editAction === 'reject' ? 'Reject Claim' :
                                editAction === 'reimburse' ? 'Mark as Reimbursed' :
                                    'Archive Claim'
                    }
                    className="max-w-md"
                    footer={
                        editAction === 'approve' ? (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 w-full">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditTarget(null);
                                        setEditAction(null);
                                        setEditNotes('');
                                    }}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto font-rethink"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                                >
                                    {isProcessing ? 'Processing…' : 'Reject'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleApprove}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto font-rethink bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                                >
                                    {isProcessing ? 'Processing…' : 'Approve'}
                                </Button>
                            </div>
                        ) : editAction === 'reject' ? (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                                <Button type="button" variant="outline" onClick={() => {
                                    setEditTarget(null);
                                    setEditAction(null);
                                    setEditNotes('');
                                }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">
                                    Cancel
                                </Button>
                                <Button type="button" onClick={handleReject} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                    {isProcessing ? 'Processing…' : 'Reject'}
                                </Button>
                            </div>
                        ) : editAction === 'reimburse' ? (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                                <Button type="button" variant="outline" onClick={() => {
                                    setEditTarget(null);
                                    setEditAction(null);
                                    setEditNotes('');
                                }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">
                                    Cancel
                                </Button>
                                <Button type="button" onClick={handleReimburse} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500">
                                    {isProcessing ? 'Processing…' : 'Confirm Reimbursement'}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                                <Button type="button" variant="outline" onClick={() => {
                                    setEditTarget(null);
                                    setEditAction(null);
                                    setEditNotes('');
                                }} disabled={isProcessing} className="w-full sm:w-auto font-rethink">
                                    Cancel
                                </Button>
                                <Button type="button" onClick={handleArchive} disabled={isProcessing} className="w-full sm:w-auto font-rethink bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500">
                                    {isProcessing ? 'Processing…' : 'Archive'}
                                </Button>
                            </div>
                        )
                    }
                >
                    <div className="space-y-4">
                        <div className={`flex items-start gap-4 rounded-xl border px-4 py-4 ${editAction === 'approve' ? 'border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/30' :
                            editAction === 'reject' ? 'border-red-200/60 bg-red-50/50 dark:border-red-800/30 dark:bg-red-950/30' :
                                editAction === 'reimburse' ? 'border-blue-200/60 bg-blue-50/50 dark:border-blue-800/30 dark:bg-blue-950/30' :
                                    'border-gray-200/60 bg-gray-50/50 dark:border-gray-700/30 dark:bg-gray-800/30'
                            }`}>
                            {editAction === 'approve' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5 dark:text-emerald-400" />}
                            {editAction === 'reject' && <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5 dark:text-red-400" />}
                            {editAction === 'reimburse' && <Banknote className="h-5 w-5 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" />}
                            {editAction === 'archive' && <Archive className="h-5 w-5 shrink-0 text-gray-600 mt-0.5 dark:text-gray-400" />}
                            <div>
                                <p className={`text-sm font-rethink leading-relaxed ${editAction === 'approve' ? 'text-emerald-800/90 dark:text-emerald-300/90' :
                                    editAction === 'reject' ? 'text-red-800/90 dark:text-red-300/90' :
                                        editAction === 'reimburse' ? 'text-blue-800/90 dark:text-blue-300/90' :
                                            'text-gray-800/90 dark:text-gray-300/90'
                                    }`}>
                                    {editAction === 'approve' && `Approve or reject the ${peso(editTarget.amount)} claim from ${editTarget.employee_name}?`}
                                    {editAction === 'reject' && `Reject the ${peso(editTarget.amount)} claim from ${editTarget.employee_name}?`}
                                    {editAction === 'reimburse' && `Confirm that ${peso(editTarget.amount)} has been paid out to ${editTarget.employee_name}?`}
                                    {editAction === 'archive' && `Archive the ${peso(editTarget.amount)} claim from ${editTarget.employee_name}?`}
                                </p>
                                {(editAction === 'archive') && (
                                    <p className="text-xs text-gray-600/80 dark:text-gray-400/80 font-rethink mt-1">
                                        Archived claims will be hidden from the main Claims table.
                                    </p>
                                )}
                            </div>
                        </div>

                        {(editAction === 'reject' || editAction === 'approve') && (
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-ink font-rethink">Reason (optional for reject)</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Let the employee know why (for rejections)"
                                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-rethink text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors dark:border-line/30 resize-none"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between rounded-lg bg-paper border border-line px-3.5 py-2.5 dark:border-line/30">
                            <span className="text-xs text-muted font-rethink">Amount</span>
                            <span className="text-sm font-mono font-semibold text-ink">{peso(editTarget.amount)}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {selected && (
                <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Claim Details" className="max-w-lg">
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-ink">{selected.employee_name}</p>
                                {selected.employee_id_number && <p className="text-xs text-muted">{selected.employee_id_number}</p>}
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[selected.status]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[selected.status]}`} />
                                {selected.status}
                                {selected.is_archived && (
                                    <span className="ml-1 text-[8px] text-muted">(archived)</span>
                                )}
                            </span>
                        </div>
                        <div className="space-y-1.5 rounded-lg border border-line p-3.5 dark:border-line/30">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Type</span>
                                <span className="text-sm text-ink">{selected.claim_type_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Submitted</span>
                                <span className="text-sm text-ink">{formatDateTime(selected.submitted_at)}</span>
                            </div>
                            {selected.reviewed_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Reviewed</span>
                                    <span className="text-sm text-ink">{formatDateTime(selected.reviewed_at)}</span>
                                </div>
                            )}
                            {selected.reimbursed_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Reimbursed</span>
                                    <span className="text-sm text-ink">{formatDateTime(selected.reimbursed_at)}</span>
                                </div>
                            )}
                            {selected.archived_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Archived</span>
                                    <span className="text-sm text-ink">{formatDateTime(selected.archived_at)}</span>
                                </div>
                            )}
                            {selected.reviewed_by_name && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Reviewed By</span>
                                    <span className="text-sm text-ink">{selected.reviewed_by_name}</span>
                                </div>
                            )}
                            {selected.description && (
                                <div className="pt-1">
                                    <span className="text-sm text-muted">Description</span>
                                    <p className="mt-0.5 text-sm text-ink">{selected.description}</p>
                                </div>
                            )}
                            {selected.receipt_url && (
                                <div className="pt-1">
                                    <span className="text-sm text-muted">Receipt / Proof</span>
                                    <div className="mt-1">
                                        <button
                                            onClick={() => {
                                                setSelectedImageUrl(selected.receipt_url);
                                                setImageViewerOpen(true);
                                            }}
                                            className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-dark hover:underline transition-colors font-medium"
                                        >
                                            <Image className="h-4 w-4" />
                                            View Receipt
                                        </button>
                                        <img
                                            src={selected.receipt_url}
                                            alt="Receipt"
                                            className="mt-2 max-h-48 rounded-lg border border-line object-contain cursor-pointer hover:opacity-80 transition-opacity dark:border-line/30"
                                            onClick={() => {
                                                setSelectedImageUrl(selected.receipt_url);
                                                setImageViewerOpen(true);
                                            }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                            {selected.review_notes && (
                                <div className="pt-1">
                                    <span className="text-sm text-muted">Review Notes</span>
                                    <p className="mt-0.5 text-sm text-ink">{selected.review_notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/60 px-4 py-3 dark:bg-emerald-950/30 dark:border-emerald-800/30">
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Amount</span>
                            <span className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-300">{peso(selected.amount)}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {unarchiveTarget && (
                <Modal
                    isOpen={!!unarchiveTarget}
                    onClose={() => setUnarchiveTarget(null)}
                    title="Restore from Archive"
                    className="max-w-md"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setUnarchiveTarget(null)} disabled={isUnarchiving} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmUnarchive} disabled={isUnarchiving} className="w-full sm:w-auto font-rethink bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500">
                                {isUnarchiving ? 'Restoring…' : 'Restore Claim'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-4 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                        <ArchiveRestore className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5 dark:text-emerald-400" />
                        <div className="space-y-1">
                            <p className="text-sm text-emerald-800/90 font-rethink leading-relaxed dark:text-emerald-300/90">
                                Restore the {peso(unarchiveTarget.amount)} {unarchiveTarget.status} claim from {unarchiveTarget.employee_name}?
                            </p>
                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-rethink">
                                The claim will reappear in the main Claims table.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Claim"
                    className="max-w-md"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmDelete} disabled={isDeleting} className="w-full sm:w-auto font-rethink bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                                {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex items-start gap-4 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-4 dark:border-red-800/30 dark:bg-red-950/30">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-800/90 font-rethink leading-relaxed dark:text-red-300/90">
                            Delete the {peso(deleteTarget.amount)} claim from {deleteTarget.employee_name}? This cannot be undone.
                        </p>
                    </div>
                </Modal>
            )}

            {imageViewerOpen && selectedImageUrl && (
                <ImageViewer
                    isOpen={imageViewerOpen}
                    onClose={() => {
                        setImageViewerOpen(false);
                        setSelectedImageUrl(null);
                    }}
                    imageUrl={selectedImageUrl}
                    title={`Receipt - ${selected?.employee_name || 'Claim'}`}
                />
            )}
        </div>
    );
};

export default ClaimsManager;