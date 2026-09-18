'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Wallet, Banknote, Eye, Loader2, Archive, ArchiveRestore, FileText,
    CheckCircle2, Clock3, TrendingUp, Search, Calendar, User, Tag,
    XCircle,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Alert } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Alert';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search as SearchInput } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { ImageViewer } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/ImageViewer';

const PAGE_SIZE = 8;

const STATUS_STYLES: Record<string, string> = {
    reimbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
};

const STATUS_DOT_COLORS: Record<string, string> = {
    reimbursed: 'bg-emerald-500',
    approved: 'bg-blue-500',
    rejected: 'bg-red-500',
    cancelled: 'bg-gray-400',
};

const PAYMENT_FILTERS = ['all', 'reimbursed', 'approved', 'rejected'] as const;

const formatDate = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return value;
    }
};

const formatDateShort = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return value;
    }
};

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function StatCard({
    icon: Icon, label, value, subtitle, tint,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    subtitle?: string;
    tint: 'emerald' | 'blue' | 'amber' | 'gray' | 'accent';
}) {
    const tints: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
        accent: 'bg-accent/10 text-accent',
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3.5 dark:border-line/30 transition-colors duration-300">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tints[tint]}`}>
                <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted font-rethink">{label}</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-ink truncate">{value}</p>
                {subtitle && <p className="text-[10px] text-muted font-rethink">{subtitle}</p>}
            </div>
        </div>
    );
}

const ReimbursementManager = () => {
    const toast = useToast();
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected] = useState<any | null>(null);
    const [unarchiveTarget, setUnarchiveTarget] = useState<any | null>(null);
    const [isUnarchiving, setIsUnarchiving] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const { fetchData, putData } = useApi('/payroll-benefits-dashboard/api/claims');

    useEffect(() => {
        loadClaims();
    }, []);

    const loadClaims = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            setClaims(data || []);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load reimbursements error:', error);
            toast.showError(error?.message || 'Failed to load reimbursements');
        } finally {
            setLoading(false);
        }
    };

    const confirmUnarchive = async () => {
        if (!unarchiveTarget) return;
        setIsUnarchiving(true);
        try {
            await putData(`/${unarchiveTarget.id}`, { is_archived: false });
            toast.showSuccess('Claim restored from archive');
            setUnarchiveTarget(null);
            loadClaims();
        } catch (error: any) {
            console.error('Unarchive claim error:', error);
            toast.showError(error?.message || 'Failed to restore claim');
        } finally {
            setIsUnarchiving(false);
        }
    };

    const paymentClaims = useMemo(() => {
        return claims.filter((c) =>
            c.status === 'reimbursed' || c.status === 'approved' || c.status === 'rejected'
        );
    }, [claims]);

    const sortedClaims = useMemo(() => {
        return [...paymentClaims].sort((a, b) => {
            const dateA = a.reimbursed_at || a.reviewed_at || a.submitted_at;
            const dateB = b.reimbursed_at || b.reviewed_at || b.submitted_at;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [paymentClaims]);

    const filteredClaims = useMemo(() => {
        let result = sortedClaims;
        if (paymentFilter !== 'all') {
            result = result.filter((c) => c.status === paymentFilter);
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            result = result.filter((c) =>
                (c.employee_name || '').toLowerCase().includes(term) ||
                (c.claim_type_name || '').toLowerCase().includes(term) ||
                (c.employee_id_number || '').toLowerCase().includes(term)
            );
        }
        return result;
    }, [sortedClaims, paymentFilter, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
    const paginatedClaims = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredClaims.slice(start, start + PAGE_SIZE);
    }, [filteredClaims, currentPage]);

    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, paymentFilter]);

    const totalReimbursed = useMemo(
        () => paymentClaims.filter((c) => c.status === 'reimbursed').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [paymentClaims]
    );
    const totalApproved = useMemo(
        () => paymentClaims.filter((c) => c.status === 'approved').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [paymentClaims]
    );
    const totalRejected = useMemo(
        () => paymentClaims.filter((c) => c.status === 'rejected').reduce((sum, c) => sum + Number(c.amount || 0), 0),
        [paymentClaims]
    );
    const uniqueEmployees = useMemo(
        () => new Set(paymentClaims.map((c) => c.employee_id)).size,
        [paymentClaims]
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Banknote className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold font-bricolage text-ink leading-tight">Reimbursements</h3>
                        <p className="text-[11px] sm:text-xs text-muted font-rethink">
                            {paymentClaims.length} payment{paymentClaims.length === 1 ? '' : 's'} processed
                            {filteredClaims.length !== paymentClaims.length && ` (${filteredClaims.length} filtered)`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Wallet} label="Total Reimbursed" value={peso(totalReimbursed)} tint="emerald" />
                <StatCard icon={Clock3} label="Approved (Pending Pay)" value={peso(totalApproved)} tint="amber" />
                <StatCard icon={XCircle} label="Rejected" value={peso(totalRejected)} tint="gray" />
                <StatCard icon={User} label="Employees Paid" value={String(uniqueEmployees)} tint="blue" />
            </div>

            <div className="flex flex-col gap-3">
                <SearchInput
                    placeholder="Search by employee, type, or ID..."
                    onSearch={setSearchTerm}
                    className="w-full"
                />
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {PAYMENT_FILTERS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setPaymentFilter(s)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize font-rethink transition-colors ${paymentFilter === s
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-paper text-ink/70 border-line hover:bg-ink/5 dark:border-line/30'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted font-rethink">
                        <Archive className="h-3.5 w-3.5" />
                        <span>Archived claims hidden</span>
                    </div>
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading reimbursements…
                    </div>
                ) : paymentClaims.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No reimbursements processed yet. Claims will appear here once approved and paid." />
                    </CardBody>
                ) : filteredClaims.length === 0 ? (
                    <CardBody className="p-6 sm:p-8">
                        <Alert variant="info" message="No payments match your search or filter." />
                    </CardBody>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Type</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Payment Date</th>
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
                                                    {formatDate(claim.reimbursed_at || claim.reviewed_at || claim.submitted_at)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold tabular-nums text-ink whitespace-nowrap">
                                                    {peso(claim.amount)}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setSelected(claim)}
                                                            className="inline-flex items-center justify-center rounded-md border border-line bg-ink/5 p-1.5 text-ink transition-colors hover:bg-ink/10 dark:bg-ink/10 dark:hover:bg-ink/20"
                                                            aria-label="View claim"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {claim.is_archived ? (
                                                            <button
                                                                onClick={() => setUnarchiveTarget(claim)}
                                                                className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400"
                                                                aria-label="Restore from archive"
                                                            >
                                                                <ArchiveRestore className="h-3.5 w-3.5" />
                                                            </button>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-500 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400">
                                                                Active
                                                            </span>
                                                        )}
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
                                                <p className="text-[11px] text-muted font-rethink">{claim.claim_type_name} · {formatDateShort(claim.reimbursed_at || claim.reviewed_at || claim.submitted_at)}</p>
                                                <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                    {claim.status}
                                                </span>
                                                {claim.is_archived && (
                                                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[9px] font-medium text-gray-500 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400">
                                                        <Archive className="h-3 w-3" />
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                            <p className="shrink-0 text-[15px] font-mono font-semibold tabular-nums text-ink">{peso(claim.amount)}</p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(claim)} className="flex-1 min-w-[60px] text-xs">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                                View
                                            </Button>
                                            {claim.is_archived && (
                                                <Button size="sm" variant="outline" onClick={() => setUnarchiveTarget(claim)} className="flex-1 min-w-[60px] text-xs border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400">
                                                    <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                                                    Restore
                                                </Button>
                                            )}
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
                                    totalItems={filteredClaims.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {selected && (
                <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Payment Details" className="max-w-lg">
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-ink">{selected.employee_name}</p>
                                {selected.employee_id_number && <p className="text-xs text-muted">{selected.employee_id_number}</p>}
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[selected.status]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[selected.status]}`} />
                                {selected.status}
                            </span>
                        </div>
                        <div className="space-y-1.5 rounded-lg border border-line p-3.5 dark:border-line/30">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Type</span>
                                <span className="text-sm text-ink">{selected.claim_type_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted">Submitted</span>
                                <span className="text-sm text-ink">{formatDate(selected.submitted_at)}</span>
                            </div>
                            {selected.reviewed_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Reviewed</span>
                                    <span className="text-sm text-ink">{formatDate(selected.reviewed_at)}</span>
                                </div>
                            )}
                            {selected.reimbursed_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted">Paid</span>
                                    <span className="text-sm text-ink">{formatDate(selected.reimbursed_at)}</span>
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
                                    <button
                                        onClick={() => {
                                            setSelectedImageUrl(selected.receipt_url);
                                            setImageViewerOpen(true);
                                        }}
                                        className="text-sm text-accent underline hover:text-accent-dark cursor-pointer text-left"
                                    >
                                        View Receipt
                                    </button>
                                    <div className="mt-2">
                                        <img
                                            src={selected.receipt_url}
                                            alt="Receipt"
                                            className="max-h-48 rounded-lg border border-line object-contain cursor-pointer hover:opacity-80 transition-opacity dark:border-line/30"
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
                            {selected.is_archived && (
                                <div className="pt-1">
                                    <span className="text-sm text-muted">Status</span>
                                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700/30 dark:bg-gray-800/30 dark:text-gray-400">
                                        <Archive className="h-3 w-3" />
                                        Archived
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${selected.status === 'reimbursed'
                            ? 'bg-emerald-50 border border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/30'
                            : selected.status === 'approved'
                                ? 'bg-amber-50 border border-amber-200/60 dark:bg-amber-950/30 dark:border-amber-800/30'
                                : 'bg-gray-50 border border-gray-200/60 dark:bg-gray-800/30 dark:border-gray-700/30'
                            }`}>
                            <span className={`text-sm font-medium ${selected.status === 'reimbursed'
                                ? 'text-emerald-800 dark:text-emerald-400'
                                : selected.status === 'approved'
                                    ? 'text-amber-800 dark:text-amber-400'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}>Amount</span>
                            <span className={`text-lg font-mono font-semibold ${selected.status === 'reimbursed'
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : selected.status === 'approved'
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}>{peso(selected.amount)}</span>
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
                                The claim will reappear in the Claims and Reimbursement tables.
                            </p>
                        </div>
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
                    title={`Receipt - ${selected?.employee_name || 'Payment'}`}
                />
            )}
        </div>
    );
};

export default ReimbursementManager;