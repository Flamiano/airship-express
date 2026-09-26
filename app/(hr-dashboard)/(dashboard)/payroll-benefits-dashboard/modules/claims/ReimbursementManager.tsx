'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Toast';
import {
    Wallet, Banknote, Eye, Loader2, Clock3, User, XCircle,
    FileText, CalendarClock, UserCircle2, Trash2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Button';
import { Modal } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Modal';
import { Card, CardBody } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Card';
import { Pagination } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Pagination';
import { Search as SearchInput } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/Search';
import { useApi } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/hooks/api/useApi';
import { ImageViewer } from '@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/components/ui/ImageViewer';

const PAGE_SIZE = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_STYLES: Record<string, string> = {
    reimbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
};

const STATUS_DOT_COLORS: Record<string, string> = {
    reimbursed: 'bg-emerald-500',
    approved: 'bg-blue-500',
    rejected: 'bg-red-500',
};

const PAYMENT_FILTERS = ['all', 'reimbursed', 'approved', 'rejected'] as const;

const formatDate = (value: string) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return value; }
};

const peso = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const initialsOf = (name: string) =>
    (name || '??').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

const AVATAR_PALETTE = [
    'from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300',
    'from-pink-100 to-rose-100 text-pink-700 dark:from-pink-950/40 dark:to-rose-950/40 dark:text-pink-300',
    'from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-emerald-300',
];
const avatarClass = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

function StatCard({ icon: Icon, label, value, tint }: { icon: React.ComponentType<{ className?: string; size?: number; title?: string }>; label: string; value: string; tint: 'emerald' | 'blue' | 'amber' | 'gray' | 'accent'; }) {
    const tints: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
        gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
        accent: 'bg-accent/10 text-accent',
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

const ReimbursementManager = () => {
    const toast = useToast();
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    const { fetchData, deleteData } = useApi('/payroll-benefits-dashboard/api/claims');

    useEffect(() => { loadClaims(); }, []);

    const loadClaims = async () => {
        setLoading(true);
        try {
            const data = await fetchData();
            const cleaned = (Array.isArray(data) ? data : [])
                .filter((c: any) => typeof c?.id === 'string' && UUID_RE.test(c.id));
            setClaims(cleaned);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Load reimbursements error:', error);
            toast.showError(error?.message || 'Failed to load reimbursements');
        } finally { setLoading(false); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget || typeof deleteTarget.id !== 'string' || !UUID_RE.test(deleteTarget.id)) {
            toast.showError('Invalid claim id');
            setDeleteTarget(null);
            return;
        }
        setIsDeleting(true);
        try {
            await deleteData(`/${deleteTarget.id}`);
            toast.showSuccess('Claim deleted');
            setDeleteTarget(null);
            loadClaims();
        } catch (error: any) {
            toast.showError(error?.message || 'Failed to delete claim');
        } finally { setIsDeleting(false); }
    };

    const paymentClaims = useMemo(() => {
        return claims.filter((c) => c.status === 'reimbursed' || c.status === 'approved' || c.status === 'rejected');
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
        if (paymentFilter !== 'all') result = result.filter((c) => c.status === paymentFilter);
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

    const totalReimbursed = useMemo(() => paymentClaims.filter((c) => c.status === 'reimbursed').reduce((s, c) => s + Number(c.amount || 0), 0), [paymentClaims]);
    const totalApproved = useMemo(() => paymentClaims.filter((c) => c.status === 'approved').reduce((s, c) => s + Number(c.amount || 0), 0), [paymentClaims]);
    const totalRejected = useMemo(() => paymentClaims.filter((c) => c.status === 'rejected').reduce((s, c) => s + Number(c.amount || 0), 0), [paymentClaims]);
    const uniqueEmployees = useMemo(() => new Set(paymentClaims.map((c) => c.employee_id)).size, [paymentClaims]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Wallet} label="Total Reimbursed" value={peso(totalReimbursed)} tint="emerald" />
                <StatCard icon={Clock3} label="Pending Pay" value={peso(totalApproved)} tint="amber" />
                <StatCard icon={XCircle} label="Rejected" value={peso(totalRejected)} tint="gray" />
                <StatCard icon={User} label="Employees Paid" value={String(uniqueEmployees)} tint="blue" />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchInput placeholder="Search by employee, type, or ID..." onSearch={setSearchTerm} className="w-full lg:max-w-sm" />
                <div className="flex flex-wrap items-center gap-1.5">
                    {PAYMENT_FILTERS.map((s) => (
                        <button
                            key={s}
                            onClick={() => setPaymentFilter(s)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize font-rethink transition-colors ${paymentFilter === s ? 'bg-accent text-white border-accent' : 'bg-paper text-ink/70 border-line hover:bg-ink/5 dark:border-line/30'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <Card variant="default" padding="none" className="bg-paper border-line overflow-hidden dark:border-line/30">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-14 text-sm text-muted font-rethink">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                        Loading reimbursements…
                    </div>
                ) : filteredClaims.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                            <Banknote className="h-6 w-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-ink font-rethink">No reimbursements yet</p>
                        <p className="text-xs text-muted font-rethink mt-1 max-w-xs">
                            Claims will appear here once approved and paid.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-line bg-ink/[0.02] dark:bg-ink/[0.04]">
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Employee</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink hidden lg:table-cell">Type</th>
                                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Payment Date</th>
                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Amount</th>
                                        <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted font-rethink">Status</th>
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
                                                className="group border-b border-line last:border-b-0 transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[220px]">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(claim.employee_name || claim.employee_id)}`}>
                                                            {initialsOf(claim.employee_name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-medium text-ink font-rethink truncate">{claim.employee_name}</p>
                                                            {claim.employee_id_number && (
                                                                <p className="text-[10px] text-muted font-rethink">{claim.employee_id_number}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-[11px] font-medium text-ink font-rethink">
                                                        <FileText className="h-3 w-3 text-accent" />
                                                        {claim.claim_type_name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink/70 font-rethink">
                                                        <CalendarClock className="h-3 w-3 text-muted" />
                                                        {formatDate(claim.reimbursed_at || claim.reviewed_at || claim.submitted_at)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-md bg-ink/[0.04] px-2 py-1 font-mono text-[12px] font-semibold text-ink dark:bg-ink/[0.08]">
                                                        {peso(claim.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setSelected(claim)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:scale-105 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(claim)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400"
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
                                {paginatedClaims.map((claim) => (
                                    <motion.div
                                        key={claim.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="rounded-lg border border-line p-3.5 dark:border-line/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold bg-gradient-to-br ${avatarClass(claim.employee_name || claim.employee_id)}`}>
                                                    {initialsOf(claim.employee_name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-ink font-rethink truncate">{claim.employee_name}</p>
                                                    <p className="text-[11px] text-muted font-rethink truncate">
                                                        {claim.claim_type_name} · {formatDate(claim.reimbursed_at || claim.reviewed_at || claim.submitted_at)}
                                                    </p>
                                                    <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize font-rethink ${STATUS_STYLES[claim.status]}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[claim.status]}`} />
                                                        {claim.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="shrink-0 text-sm font-mono font-semibold tabular-nums text-ink whitespace-nowrap">{peso(claim.amount)}</p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3 dark:border-line/30">
                                            <Button size="sm" variant="outline" onClick={() => setSelected(claim)} className="flex-1 min-w-[60px] text-xs">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(claim)} className="flex-1 min-w-[60px] text-xs border-red-200 bg-red-50 text-red-600 dark:border-red-800/30 dark:bg-red-950/30 dark:text-red-400">
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
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
                                    totalItems={filteredClaims.length}
                                />
                            </div>
                        )}
                    </>
                )}
            </Card>

            {selected && (
                <Modal
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                    title={selected.employee_name}
                    className="max-w-lg"
                    accent="emerald"
                    icon={UserCircle2}
                    footer={<Button type="button" variant="outline" onClick={() => setSelected(null)} className="font-rethink">Close</Button>}
                >
                    <div className="space-y-4 font-rethink">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold bg-gradient-to-br ${avatarClass(selected.employee_name || selected.employee_id)}`}>
                                {initialsOf(selected.employee_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{selected.employee_name}</p>
                                {selected.employee_id_number && (
                                    <p className="text-[11px] text-muted">{selected.employee_id_number}</p>
                                )}
                            </div>
                            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${STATUS_STYLES[selected.status]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[selected.status]}`} />
                                {selected.status}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-emerald-200/60 bg-emerald-50 px-4 py-3 dark:border-emerald-800/30 dark:bg-emerald-950/30">
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Amount</span>
                            <span className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-300">{peso(selected.amount)}</span>
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
                    accent="red"
                    icon={AlertTriangle}
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="w-full sm:w-auto font-rethink">Cancel</Button>
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
                    onClose={() => { setImageViewerOpen(false); setSelectedImageUrl(null); }}
                    imageUrl={selectedImageUrl}
                    title={`Receipt - ${selected?.employee_name || 'Claim'}`}
                />
            )}
        </div>
    );
};

export default ReimbursementManager;