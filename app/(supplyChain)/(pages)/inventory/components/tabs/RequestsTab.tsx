'use client';

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { InventoryRequest, InventoryItem } from '../../types';
import { sanitizeSearch } from '../../../../components/global/sanitize';
import { Pagination } from '../../../../components/global/pagination';
import { TableRowsSkeleton } from '../../../../components/ui/SkeletonLoader';
import { AppButton } from '../../../../components/ui/AppButton';
import { CrudActionButton } from '../../../../components/ui/CrudActionButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { useConfirm } from '../../../../components/ui/ConfirmModal';
import { toast } from 'sonner';
import { supabase } from '../../../../lib/services/client/supabase';
import { user } from '../../../../lib/services/Class/user';
import { 
    Inbox, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    PackageCheck, 
    AlertTriangle, 
    Plus, 
    Building2, 
    User, 
    Filter, 
    Search,
    Layers,
    Check,
    X,
    FileText,
    ChevronDown,
    Sparkles,
    Bell,
    Compass,
    MapPin,
    Loader2
} from 'lucide-react';
import Portal from '../../../../components/client/Portal';
import { approveInventoryRequest, rejectInventoryRequest } from '../../server/query';
import { RequestedItemStockModal } from '../modals/RequestedItemStockModal';
import { PurchaseRequestFormModal } from '../modals/PurchaseRequestFormModal';
import { SupplierMessageModal } from '../../../suppliers/components/modals/SupplierMessageModal';
import { evaluateItemMatch } from '../../utils/itemMatching';
import { findBestMatchingPO, getPOStatusIndicator } from '../../../../lib/utils';

interface RequestsTabProps {
    requests: InventoryRequest[];
    inventoryItems: InventoryItem[];
    totalRequests: number;
    currentPage: number;
    totalPages: number;
    stats: {
        total: number;
        pending: number;
        approved: number;
        received: number;
        rejected: number;
    } | null;
    isLoading?: boolean;
    userRole?: string;
    searchTerm: string;
    statusFilter: string;
    typeFilter: 'all' | 'internal' | 'external';
    suppliers?: any[];
    onSearchChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onTypeChange: (value: 'all' | 'internal' | 'external') => void;
    onPageChange: (page: number) => void;
    onOpenInternalRequestModal: () => void;
    onOpenPOModal?: (item: any, selectedSupplier?: any) => void;
    onRefresh: () => void;
}

export const RequestsTab = memo(function RequestsTab({
    requests,
    inventoryItems,
    totalRequests,
    currentPage,
    totalPages,
    stats,
    isLoading = false,
    userRole = '',
    searchTerm,
    statusFilter,
    typeFilter,
    suppliers = [],
    onSearchChange,
    onStatusChange,
    onTypeChange,
    onPageChange,
    onOpenInternalRequestModal,
    onOpenPOModal,
    onRefresh,
}: RequestsTabProps) {
    const { confirm } = useConfirm();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [rejectingRequest, setRejectingRequest] = useState<InventoryRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [showBulkRejectModal, setShowBulkRejectModal] = useState<boolean>(false);
    const [bulkRejectReason, setBulkRejectReason] = useState<string>('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [optimisticApprovedIds, setOptimisticApprovedIds] = useState<Set<string>>(new Set());
    const [optimisticRejectedIds, setOptimisticRejectedIds] = useState<Set<string>>(new Set());
    const [selectedRequestForStock, setSelectedRequestForStock] = useState<InventoryRequest | null>(null);
    const [selectedRequestForForm, setSelectedRequestForForm] = useState<InventoryRequest | null>(null);
    const [selectedRequestForSupplierModal, setSelectedRequestForSupplierModal] = useState<InventoryRequest | null>(null);
    const [selectedSupplierForMessage, setSelectedSupplierForMessage] = useState<any | null>(null);
    const [awardedBids, setAwardedBids] = useState<Set<string>>(new Set());
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

    // Clear optimistic states when server requests prop updates
    useEffect(() => {
        if (optimisticApprovedIds.size > 0 || optimisticRejectedIds.size > 0) {
            setOptimisticApprovedIds(prev => {
                const next = new Set(prev);
                requests.forEach(r => {
                    const st = (r.status || '').toLowerCase();
                    if (st === 'approved' || st === 'completed') next.delete(r.id);
                });
                return next.size === prev.size ? prev : next;
            });
            setOptimisticRejectedIds(prev => {
                const next = new Set(prev);
                requests.forEach(r => {
                    const st = (r.status || '').toLowerCase();
                    if (st === 'rejected') next.delete(r.id);
                });
                return next.size === prev.size ? prev : next;
            });
        }
    }, [requests]);

    // Compute set of categories that have active registered suppliers
    const activeSupplierCategories = useMemo(() => {
        const set = new Set<string>();
        (suppliers || []).forEach((s: any) => {
            if (!s) return;
            const isActive = s.is_active !== false && s.status !== 'inactive';
            if (isActive && s.category) {
                set.add(s.category.toLowerCase().trim());
            }
        });
        return set;
    }, [suppliers]);

    // Fetch and sync accepted quotations in real-time from supplier_quotations table
    const fetchAwardedBids = useCallback(async () => {
        try {
            const set = new Set<string>();

            // Check supplier_quotations table for accepted/awarded status
            const { data: quoteData, error: qErr } = await supabase
                .from("supplier_quotations")
                .select("request_number, status, notes, item_name, supplier_id")
                .ilike("status", "%accept%");

            if (quoteData && !qErr) {
                quoteData.forEach((q: any) => {
                    if (q.request_number) {
                        const raw = String(q.request_number).trim().toLowerCase();
                        const clean = raw.replace(/[^a-z0-9]/g, '');
                        const withoutPr = raw.replace(/^pr-?/i, '').replace(/[^a-z0-9]/g, '');
                        set.add(raw);
                        set.add(clean);
                        if (withoutPr) set.add(withoutPr);
                    }
                });
            }

            // Also check suppliers table for selected bid winners or purchase_request_id
            const { data: winnerSuppliers } = await supabase
                .from("suppliers")
                .select("purchase_request_id, notes")
                .or("notes.ilike.%selected bid winner%,notes.ilike.%awarded bid%");

            if (winnerSuppliers) {
                winnerSuppliers.forEach((s: any) => {
                    if (s.purchase_request_id) {
                        const raw = String(s.purchase_request_id).trim().toLowerCase();
                        set.add(raw);
                        set.add(raw.replace(/[^a-z0-9]/g, ''));
                    }
                    if (s.notes) {
                        const prMatch = s.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                        if (prMatch && prMatch[1]) {
                            const raw = prMatch[1].trim().toLowerCase();
                            set.add(raw);
                            set.add(raw.replace(/[^a-z0-9]/g, ''));
                        }
                    }
                });
            }

            // Also check purchase_orders table for linked request_ids and active PO status
            const { data: poList } = await supabase
                .from("purchase_orders")
                .select("id, po_number, status, admin_approval, financial_approval, items, request_id, created_at, updated_at, notes")
                .order("created_at", { ascending: false });

            if (poList) {
                setPurchaseOrders(poList);
                poList.forEach((po: any) => {
                    if (po.request_id) {
                        const raw = String(po.request_id).trim().toLowerCase();
                        set.add(raw);
                        set.add(raw.replace(/[^a-z0-9]/g, ''));
                    }
                    if (po.notes) {
                        const prMatch = po.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                        if (prMatch && prMatch[1]) {
                            const raw = prMatch[1].trim().toLowerCase();
                            set.add(raw);
                            set.add(raw.replace(/[^a-z0-9]/g, ''));
                        }
                    }
                });
            }

            setAwardedBids(set);
        } catch (err) {
            console.error("Error fetching awarded bids from supplier_quotations:", err);
        }
    }, []);

    useEffect(() => {
        fetchAwardedBids();

        const channel = supabase
            .channel(`quotes_awarded_status_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supplier_quotations",
                },
                () => {
                    fetchAwardedBids();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAwardedBids]);

    // Sort requests by Priority (Critical -> Urgent -> Normal) and Created At (newest first)
    const sortedRequests = useMemo(() => {
        const getPriorityRank = (p?: string) => {
            const low = (p || '').toLowerCase().trim();
            if (low === 'critical') return 1;
            if (low === 'urgent' || low === 'high') return 2;
            return 3;
        };

        return [...requests].sort((a, b) => {
            const rankA = getPriorityRank(a.priority);
            const rankB = getPriorityRank(b.priority);
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }, [requests]);

    const currentRole = userRole || user.getRole();
    const canManageRequests = true; // Always show and allow approve on requests tab

    const allSelected = requests.length > 0 && requests.every(r => selectedIds.has(r.id));
    const someSelected = requests.some(r => selectedIds.has(r.id)) && !allSelected;

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(requests.map(r => r.id)));
        }
    }, [allSelected, requests]);

    const handleSelectOne = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleApprove = async (req: InventoryRequest) => {
        if (!canManageRequests) {
            toast.info("Only Admin and Executive can approve inventory requests.", {
                id: `approve-restricted-${req.id}`
            });
            return;
        }

        const confirmed = await confirm({
            title: 'Approve & Route Request',
            message: `Are you sure you want to approve request #${req.request_number || (req.id ? req.id.slice(0, 8) : '')} for ${req.quantity_requested || 1} unit(s) of "${req.item_name}"? Available items will NOT be deducted immediately, but queued to Warehousing (/warehousing?tab=issue) for issuing. Any lacking or new items will be routed to Procurement Stage 1.`,
            confirmText: 'Approve & Route',
            confirmVariant: 'success'
        });
        if (!confirmed) return;

        setActionLoadingId(req.id);
        setOptimisticApprovedIds(prev => new Set(prev).add(req.id));
        const toastId = toast.loading(`Approving request #${req.request_number || req.id.slice(0, 8)}...`);
        try {
            const userName = user.getName();
            const userEmail = user.getEmail();
            const effectiveRole = currentRole || userRole || 'Executive';
            const performerDisplayName = userName && userName !== 'User'
                ? `${userName} (${effectiveRole})`
                : (userEmail || effectiveRole);

            const res = await approveInventoryRequest(
                req.id, 
                user.getId() || effectiveRole, 
                undefined, 
                performerDisplayName
            );
            if (res.success) {
                toast.success(res.message || 'Request approved successfully! Available items routed to Warehousing, lacking items to Procurement.', { id: toastId });
                onRefresh();
            } else {
                setOptimisticApprovedIds(prev => {
                    const next = new Set(prev);
                    next.delete(req.id);
                    return next;
                });
                toast.error(res.error || 'Failed to approve request', { id: toastId });
            }
        } catch (err: any) {
            setOptimisticApprovedIds(prev => {
                const next = new Set(prev);
                next.delete(req.id);
                return next;
            });
            console.error('Error approving request:', err);
            toast.error(err?.message || 'Failed to approve request', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleBulkApprove = async () => {
        if (!canManageRequests) {
            toast.info("Only Admin and Executive can approve inventory requests.");
            return;
        }

        const pendingSelected = requests.filter(r => selectedIds.has(r.id) && (r.status || 'pending').toLowerCase() === 'pending');
        if (pendingSelected.length === 0) {
            toast.warning('No pending requests found in the current selection.');
            return;
        }

        const confirmed = await confirm({
            title: `Approve ${pendingSelected.length} Requests`,
            message: `Are you sure you want to approve ${pendingSelected.length} pending request(s)? Available items will be queued to Warehousing (/warehousing?tab=issue) for issuing (no immediate deduction), while lacking or new items will be routed to Procurement Stage 1.`,
            confirmText: `Approve (${pendingSelected.length})`,
            confirmVariant: 'success'
        });
        if (!confirmed) return;

        setActionLoadingId('bulk-approve');
        setOptimisticApprovedIds(prev => {
            const next = new Set(prev);
            pendingSelected.forEach(p => next.add(p.id));
            return next;
        });
        const toastId = toast.loading(`Approving ${pendingSelected.length} requests...`);
        try {
            const userName = user.getName();
            const userEmail = user.getEmail();
            const effectiveRole = currentRole || userRole || 'Executive';
            const performerDisplayName = userName && userName !== 'User'
                ? `${userName} (${effectiveRole})`
                : (userEmail || effectiveRole);

            const results = await Promise.all(
                pendingSelected.map(r => approveInventoryRequest(
                    r.id, 
                    user.getId() || effectiveRole, 
                    undefined, 
                    performerDisplayName
                ))
            );
            const successCount = results.filter(r => r.success).length;
            if (successCount > 0) {
                toast.success(`Successfully approved ${successCount} request(s)!`, { id: toastId });
                setSelectedIds(new Set());
                onRefresh();
            } else {
                setOptimisticApprovedIds(prev => {
                    const next = new Set(prev);
                    pendingSelected.forEach(p => next.delete(p.id));
                    return next;
                });
                toast.error('Failed to approve selected requests', { id: toastId });
            }
        } catch (err: any) {
            setOptimisticApprovedIds(prev => {
                const next = new Set(prev);
                pendingSelected.forEach(p => next.delete(p.id));
                return next;
            });
            console.error('Bulk approve error:', err);
            toast.error(err?.message || 'Failed to approve requests', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleConfirmBulkReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageRequests) {
            toast.error('Only Admin and Executive can reject inventory requests in bulk.');
            setShowBulkRejectModal(false);
            return;
        }
        const pendingSelected = requests.filter(r => selectedIds.has(r.id) && (r.status || 'pending').toLowerCase() === 'pending');
        if (pendingSelected.length === 0) {
            toast.warning('No pending requests found in current selection');
            setShowBulkRejectModal(false);
            return;
        }

        setActionLoadingId('bulk-reject');
        setOptimisticRejectedIds(prev => {
            const next = new Set(prev);
            pendingSelected.forEach(p => next.add(p.id));
            return next;
        });
        const toastId = toast.loading(`Rejecting ${pendingSelected.length} requests...`);
        const trimmedReason = bulkRejectReason.trim() || 'Declined in bulk by Purchase Officer';

        try {
            const results = await Promise.all(
                pendingSelected.map(r => rejectInventoryRequest(r.id, trimmedReason, userRole || 'Purchase Officer'))
            );
            const successCount = results.filter(r => r.success).length;

            // Send batch notification to Admin & Executive
            try {
                const currentName = user.getName() || user.getEmail() || 'Inventory Staff';
                const currentEmail = user.getEmail() || 'system@airship.com';
                await supabase
                    .from('notifications')
                    .insert({
                        creator_name: currentName,
                        creator_email: currentEmail,
                        title: `Bulk Requisitions Rejected (${successCount} requests)`,
                        message: `${successCount} inventory request(s) were rejected in bulk. Reason: "${trimmedReason}".`,
                        type: 'alert',
                        link: `/inventory?tab=requests&status=rejected`,
                        role: ['Admin', 'Executive'],
                        is_read: false
                    });
            } catch (notifErr) {
                console.error('Auto notification error on bulk reject:', notifErr);
            }

            toast.success(`Rejected ${successCount} request(s)!`, { id: toastId });
            setShowBulkRejectModal(false);
            setBulkRejectReason('');
            setSelectedIds(new Set());
            onRefresh();
        } catch (err: any) {
            setOptimisticRejectedIds(prev => {
                const next = new Set(prev);
                pendingSelected.forEach(p => next.delete(p.id));
                return next;
            });
            console.error('Bulk reject error:', err);
            toast.error(err?.message || 'Failed to reject requests', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleConfirmReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectingRequest) return;
        if (!canManageRequests) {
            toast.error('Only Admin and Executive can reject inventory requests.');
            setRejectingRequest(null);
            return;
        }

        const targetRejectReq = rejectingRequest;
        setActionLoadingId(targetRejectReq.id);
        setOptimisticRejectedIds(prev => new Set(prev).add(targetRejectReq.id));
        const toastId = toast.loading(`Rejecting request #${targetRejectReq.request_number}...`);
        const trimmedReason = rejectionReason.trim() || 'Declined by Purchase Officer';

        try {
            const res = await rejectInventoryRequest(
                targetRejectReq.id,
                trimmedReason,
                userRole || 'Purchase Officer'
            );
            if (res.success) {
                // Automatically send notification to Admin & Executive
                try {
                    const currentName = user.getName() || user.getEmail() || 'Inventory Staff';
                    const currentEmail = user.getEmail() || 'system@airship.com';
                    await supabase
                        .from('notifications')
                        .insert({
                            creator_name: currentName,
                            creator_email: currentEmail,
                            title: `Requisition Rejected: #${targetRejectReq.request_number || (targetRejectReq.id ? targetRejectReq.id.slice(0, 8) : '')}`,
                            message: `Inventory request #${targetRejectReq.request_number || targetRejectReq.id.slice(0, 8)} for ${targetRejectReq.quantity_requested || 1} unit(s) of "${targetRejectReq.item_name}" has been rejected. Reason: "${trimmedReason}". Requester: ${targetRejectReq.requested_by || 'Staff'} (${targetRejectReq.department || 'General'}).`,
                            type: 'alert',
                            link: `/inventory?tab=requests&search=${encodeURIComponent(targetRejectReq.request_number || targetRejectReq.item_name)}`,
                            role: ['Admin', 'Executive'],
                            is_read: false
                        });
                } catch (notifErr) {
                    console.error('Auto notification error on reject:', notifErr);
                }

                toast.success('Request rejected & Admin notified!', { id: toastId });
                setRejectingRequest(null);
                setRejectionReason('');
                onRefresh();
            } else {
                setOptimisticRejectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(targetRejectReq.id);
                    return next;
                });
                toast.error(res.error || 'Failed to reject request', { id: toastId });
            }
        } catch (err: any) {
            setOptimisticRejectedIds(prev => {
                const next = new Set(prev);
                next.delete(targetRejectReq.id);
                return next;
            });
            console.error('Error rejecting request:', err);
            toast.error(err?.message || 'Failed to reject request', { id: toastId });
        } finally {
            setActionLoadingId(null);
        }
    };

    const itemsPerPage = 20;
    const startIndex = totalRequests === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalRequests);

    // Memoize active selected request for unified Purchase Request & Inventory Stock Modal to prevent null reference issues
    const activeSelectedRequest = useMemo((): InventoryRequest | null => {
        const req = selectedRequestForForm || selectedRequestForStock;
        if (!req) return null;
        return {
            ...req,
            status: (optimisticApprovedIds.has(req.id)
                ? 'Approved'
                : optimisticRejectedIds.has(req.id)
                ? 'Rejected'
                : req.status) as InventoryRequest['status'],
            is_released: Boolean(req.is_released || (req.status || '').toLowerCase() === 'delivered' || (req.status || '').toLowerCase() === 'received' || req.fulfilled_at),
            is_issued: Boolean(req.is_issued || (req.status || '').toLowerCase() === 'delivered' || (req.status || '').toLowerCase() === 'received' || req.fulfilled_at),
        };
    }, [selectedRequestForForm, selectedRequestForStock, optimisticApprovedIds, optimisticRejectedIds]);

    const isSelectedRequestBidAwarded = useMemo((): boolean => {
        const req = selectedRequestForForm || selectedRequestForStock;
        if (!req) return false;
        return Boolean(
            awardedBids.has(req.request_number || '') ||
            awardedBids.has(req.id) ||
            ((req as any).bidding_status === 'awarded')
        );
    }, [selectedRequestForForm, selectedRequestForStock, awardedBids]);

    return (
        <div className="space-y-6">
            {/* Top KPI Cards - Minimalist & Calm */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Requests */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Total Requests
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.total || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            All incoming requisitions
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Inbox className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Pending */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Pending
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.pending || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Awaiting stock feasibility
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Clock className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Approved (Exporting) */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Approved (Exporting)
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.approved || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Committed ready for release
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <PackageCheck className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>

                {/* Received / Outed */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Received / Outed
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats?.received || 0}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Fulfilled and stock deducted
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.35),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] overflow-hidden transition-colors flex flex-col">
                {/* Filter Toolbar */}
                <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none group-focus-within:text-pink-500 transition-colors w-4 h-4" />
                            <input
                                className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                placeholder="Search by item, request code, requester..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="relative min-w-[140px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => onStatusChange(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="received">Supplies Released / Delivered</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>


                    </div>

                    {/* New Internal Request Action */}
                    <div className="flex items-center gap-2">
                        <AppButton type="button" variant="primary" size="md" onClick={onOpenInternalRequestModal}>
                            <Plus className="w-4 h-4 mr-1.5" />
                            <span>New Item Request</span>
                        </AppButton>
                    </div>
                </div>

                {/* Bulk Action Toolbar */}
                {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-pink-50/70 dark:bg-pink-950/30 border-b border-pink-200/70 dark:border-pink-900/40 text-xs animate-in fade-in duration-150">
                        <span className="font-bold text-pink-600 dark:text-pink-400 font-mono flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                            {selectedIds.size} request(s) selected
                        </span>
                        <div className="h-4 w-px bg-pink-200 dark:bg-pink-800 mx-1 hidden sm:block" />

                        {canManageRequests && (
                            <>
                                {/* Bulk Approve */}
                                <button
                                    type="button"
                                    onClick={handleBulkApprove}
                                    disabled={actionLoadingId === 'bulk-approve'}
                                    className="px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                                    title="Approve selected pending requests"
                                >
                                    {actionLoadingId === 'bulk-approve' ? (
                                        <i className="fas fa-spinner fa-spin text-xs" />
                                    ) : (
                                        <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>Approve Selected</span>
                                </button>

                                {/* Bulk Reject */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const pendingCount = requests.filter(r => selectedIds.has(r.id) && (r.status || 'pending').toLowerCase() === 'pending').length;
                                        if (pendingCount === 0) {
                                            toast.warning('No pending requests found in the current selection');
                                            return;
                                        }
                                        setShowBulkRejectModal(true);
                                    }}
                                    disabled={actionLoadingId === 'bulk-reject'}
                                    className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-rose-500/20 active:scale-95"
                                    title="Reject selected pending requests"
                                >
                                    {actionLoadingId === 'bulk-reject' ? (
                                        <i className="fas fa-spinner fa-spin text-xs" />
                                    ) : (
                                        <X className="w-3.5 h-3.5" />
                                    )}
                                    <span>Reject Selected</span>
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => setSelectedIds(new Set())}
                            className="ml-auto text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold underline text-[11px] cursor-pointer"
                        >
                            Deselect All
                        </button>
                    </div>
                )}

                {/* Table Content */}
                <div className="overflow-x-auto">
                    <table className="min-w-[1380px] w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-white/[0.06] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-[#ebf0f7]/40 dark:bg-[#12131b]/40">
                                <th className="w-12 min-w-[48px] px-3.5 py-3.5 text-center">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={(input) => {
                                            if (input) {
                                                input.indeterminate = someSelected;
                                            }
                                        }}
                                        onChange={handleSelectAll}
                                        aria-label="Select all requests"
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 transition-colors"
                                    />
                                </th>
                                <th className="px-4 py-3.5 w-36 min-w-[130px] whitespace-nowrap">Request #</th>
                                <th className="px-4 py-3.5 w-28 min-w-[110px] whitespace-nowrap">Date</th>
                                <th className="px-4 py-3.5 w-28 min-w-[100px] whitespace-nowrap">Priority</th>
                                <th className="px-4 py-3.5 w-36 min-w-[140px] whitespace-nowrap">Department</th>
                                <th className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">Requester</th>
                                <th className="px-4 py-3.5 w-60 min-w-[220px]">Requested Item</th>
                                <th className="px-4 py-3.5 w-24 min-w-[90px] text-center whitespace-nowrap">Qty</th>
                                <th className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">Stock Feasibility</th>
                                <th className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">Status</th>
                                <th className="px-4 py-3.5 w-40 min-w-[150px] text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] text-xs">
                            {isLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-12' },
                                        { type: 'mono', width: 'w-36' },
                                        { type: 'text', width: 'w-28' },
                                        { type: 'badge', width: 'w-28' },
                                        { type: 'text', width: 'w-36' },
                                        { type: 'text', width: 'w-44' },
                                        { type: 'text', width: 'w-60' },
                                        { type: 'mono', width: 'w-24', align: 'center' },
                                        { type: 'badge', width: 'w-44' },
                                        { type: 'badge', width: 'w-44' },
                                        { type: 'actions', align: 'right', width: 'w-40' },
                                    ]}
                                />
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-20 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-inner">
                                                <Inbox className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No inventory requests found</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                     Incoming requests from external systems or internal staff will show up here.
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedRequests.map((req) => {
                                    const isRowLoading = actionLoadingId === req.id || actionLoadingId === 'bulk-approve' || actionLoadingId === 'bulk-reject';
                                    const isOptimisticallyApproved = optimisticApprovedIds.has(req.id);
                                    const isOptimisticallyRejected = optimisticRejectedIds.has(req.id);

                                    const rawStatus = (
                                        isOptimisticallyApproved
                                            ? 'approved'
                                            : isOptimisticallyRejected
                                            ? 'rejected'
                                            : (req.status || 'pending')
                                    ).toLowerCase();

                                    const reqItems: any[] = Array.isArray(req.items) && req.items.length > 0 ? req.items : [];
                                    const hasMultipleItems = reqItems.length > 1;
                                    const approvedItemsCount = reqItems.filter((it) => it.status === 'Approved' || it.is_approved === true || it.is_approve === true).length;
                                    const rejectedItemsCount = reqItems.filter((it) => it.status === 'Rejected').length;
                                    const pendingItemsCount = reqItems.filter((it) => (!it.status || it.status === 'Pending') && !it.is_approved && !it.is_approve).length;
                                    const isPartiallyReviewed = hasMultipleItems && pendingItemsCount > 0 && (approvedItemsCount > 0 || rejectedItemsCount > 0);

                                    const requestedQty = Number(req.quantity_requested || (reqItems.length > 0 ? reqItems.reduce((acc, it) => acc + Number(it.quantity || it.quantity_requested || 0), 0) : 1));
                                    const approvedQty = req.quantity_approved !== undefined ? Number(req.quantity_approved) : (rawStatus === 'approved' ? requestedQty : 0);
                                    const remainingQty = req.quantity_remaining !== undefined ? Number(req.quantity_remaining) : Math.max(0, requestedQty - approvedQty);

                                    const issuedQty = req.issued_quantity !== undefined 
                                        ? Number(req.issued_quantity)
                                        : reqItems.length > 0
                                        ? reqItems.reduce((acc, it) => {
                                              const isItemReleased = it.is_released === true || it.is_issued === true || (it.status || '').toLowerCase() === 'released';
                                              const qty = it.issued_quantity !== undefined ? Number(it.issued_quantity) : isItemReleased ? Number(it.approved_quantity ?? it.quantity) : 0;
                                              return acc + qty;
                                          }, 0)
                                        : (req.is_released || req.is_issued ? requestedQty : 0);

                                    const deficitQty = req.deficit_quantity !== undefined
                                        ? Number(req.deficit_quantity)
                                        : reqItems.length > 0
                                        ? reqItems.reduce((acc, it) => {
                                              const reqQ = Number(it.quantity || it.quantity_requested || 0);
                                              const isItemReleased = it.is_released === true || it.is_issued === true || (it.status || '').toLowerCase() === 'released';
                                              const qty = it.issued_quantity !== undefined ? Number(it.issued_quantity) : isItemReleased ? Number(it.approved_quantity ?? it.quantity) : 0;
                                              const def = it.deficit_quantity !== undefined ? Number(it.deficit_quantity) : Math.max(0, reqQ - qty);
                                              return acc + def;
                                          }, 0)
                                        : Math.max(0, requestedQty - issuedQty);

                                    const hasItemReleased = reqItems.length > 0 && reqItems.some((it: any) => it.is_released === true || it.is_issued === true || (it.status || '').toLowerCase() === 'released' || (it.status || '').toLowerCase() === 'delivered');
                                    const isReceived = rawStatus === 'received' || rawStatus === 'fulfilled' || rawStatus === 'delivered' || rawStatus === 'completed' || Boolean(req.completed_at) || Boolean(req.fulfilled_at) || req.is_released === true || req.is_issued === true || hasItemReleased;
                                    const isPartialHandover = isReceived && (deficitQty > 0 || (issuedQty > 0 && issuedQty < requestedQty));
                                    const isApproved = !isReceived && !isPartiallyReviewed && (rawStatus === 'approved');
                                    const isPartiallyApproved = isApproved && approvedQty < requestedQty && approvedQty > 0;
                                    const isRoutedToProcurement = isApproved && approvedQty === 0;
                                    const isPending = !isReceived && (isPartiallyReviewed || rawStatus === 'pending') && !isOptimisticallyApproved && !isOptimisticallyRejected;
                                    const isRejected = !isReceived && !isPartiallyReviewed && rawStatus === 'rejected';

                                    const isInternal = req.Internal_request === true || req.internal_request === true || req.is_internal === true || Boolean(req.requested_by);
                                    
                                    // Live item match evaluation (Section 9: prioritize explicit item reference/ID before fallback to name)
                                    const explicitRef = (req as any).inventory_item_id || (req as any).item_id || (req as any).catalog_item_id || (req as any).item_code || (req.items && ((req.items[0] as any)?.inventory_item_id || (req.items[0] as any)?.catalog_item_id || (req.items[0] as any)?.item_code));
                                    const matchEval = evaluateItemMatch(req.item_name, requestedQty, inventoryItems, explicitRef ? String(explicitRef) : undefined);
                                    const item = matchEval.matchedItem || (req as any).inventory_item;
                                    const currentStock = matchEval.currentStock;
                                    const availableStock = currentStock;
                                    const isStockFeasible = matchEval.isStockSufficient;
                                    const isOutOfStock = matchEval.isOutOfStock;

                                    const priorityLower = (req.priority || 'normal').toLowerCase().trim();

                                    const isOthersCategory =
                                        ((req as any).category || (req.items && req.items[0]?.category) || '')
                                            .trim()
                                            .toLowerCase() === 'others';
                                    const isPossible = matchEval.matchType === 'partial';
                                    const isNewItem = matchEval.matchType === 'none';
                                    const isExactMatch = matchEval.matchType === 'exact';
                                    const isAvailable = isExactMatch && isStockFeasible;
                                    const isLowStock = isExactMatch && !isStockFeasible && !isOutOfStock;

                                    const reqNumKey = (req.request_number || '').toLowerCase().trim();
                                    const reqNumClean = reqNumKey.replace(/[^a-z0-9]/g, '');
                                    const reqNumWithoutPr = reqNumKey.replace(/^pr-?/i, '').replace(/[^a-z0-9]/g, '');
                                    const reqIdKey = (req.id || '').toLowerCase().trim();
                                    const reqIdClean = reqIdKey.replace(/[^a-z0-9]/g, '');

                                    // Disabled if there is an accepted supplier quotation, awarded supplier, or PO for this request
                                    const isBidAwarded = Boolean(
                                        (reqNumKey && awardedBids.has(reqNumKey)) ||
                                        (reqNumClean && awardedBids.has(reqNumClean)) ||
                                        (reqNumWithoutPr && awardedBids.has(reqNumWithoutPr)) ||
                                        (reqIdKey && awardedBids.has(reqIdKey)) ||
                                        (reqIdClean && awardedBids.has(reqIdClean))
                                    );

                                    const reqCategory = ((req as any).category || (req.items && req.items[0]?.category) || '').trim().toLowerCase();
                                    const isCategoryWithoutActiveSupplier = Boolean(reqCategory && !activeSupplierCategories.has(reqCategory));

                                    // Match against purchase orders using normalized item-name matching
                                    const matchingPO = findBestMatchingPO({ 
                                        id: req.id, 
                                        item_name: req.item_name, 
                                        source_request: req.request_number 
                                    }, purchaseOrders);
                                    const poIndicator = matchingPO ? getPOStatusIndicator(matchingPO) : null;

                                    return (
                                        <tr
                                            key={req.id}
                                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors duration-150 ${selectedIds.has(req.id) ? 'bg-pink-50/30 dark:bg-pink-950/10' : ''}`}
                                        >
                                            {/* 0. Checkbox */}
                                            <td className="w-12 min-w-[48px] px-3.5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(req.id)}
                                                    onChange={() => handleSelectOne(req.id)}
                                                    aria-label={`Select request #${req.request_number || req.id.slice(0, 8)}`}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 transition-colors"
                                                />
                                            </td>

                                            {/* 1. Request # */}
                                            <td className="px-4 py-3.5 w-36 min-w-[130px] whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRequestForForm(req)}
                                                    className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-[#ebf0f7] dark:bg-[#12131b] px-2.5 py-1 rounded-lg border border-white/80 dark:border-white/[0.05] shadow-inner text-[11px] hover:border-pink-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors cursor-pointer text-left inline-flex items-center gap-1.5"
                                                    title="Click to view purchase request document"
                                                >
                                                    <FileText className="w-3 h-3 text-pink-500 shrink-0" />
                                                    <span>{req.request_number || `#${req.id.slice(0, 8)}`}</span>
                                                </button>
                                            </td>

                                            {/* 2. Date */}
                                            <td className="px-4 py-3.5 w-28 min-w-[110px] whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                                {req.created_at ? (
                                                    new Date(req.created_at).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })
                                                ) : (
                                                    <span className="text-slate-400 italic">Recent</span>
                                                )}
                                            </td>

                                            {/* 3. Priority */}
                                            <td className="px-4 py-3.5 w-28 min-w-[100px] whitespace-nowrap">
                                                <StatusBadge
                                                    tone={
                                                        priorityLower === 'critical'
                                                            ? 'rose'
                                                            : priorityLower === 'urgent' || priorityLower === 'high'
                                                            ? 'amber'
                                                            : 'neutral'
                                                    }
                                                    size="xs"
                                                    dot
                                                >
                                                    {req.priority || 'Normal'}
                                                </StatusBadge>
                                            </td>

                                            {/* 4. Department */}
                                            <td className="px-4 py-3.5 w-36 min-w-[140px] whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate" title={req.department || 'General'}>{req.department || 'General'}</span>
                                                </div>
                                            </td>

                                            {/* 5. Requester */}
                                            <td className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                                                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[140px]" title={(req as any).requester_name || (isInternal ? 'Internal Staff' : (req.requester_system || 'External System'))}>
                                                        {(req as any).requester_name || (isInternal ? (req.department ? `${req.department} Staff` : 'Internal Staff') : (req.requester_system || 'External System'))}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 6. Requested Item */}
                                            <td className="px-4 py-3.5 w-60 min-w-[220px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRequestForStock(req)}
                                                    className="font-extrabold text-slate-900 dark:text-slate-100 block break-words whitespace-normal leading-snug text-left hover:text-pink-600 dark:hover:text-pink-400 transition-colors cursor-pointer"
                                                    title={`Click to check warehouse stock for ${req.item_name}`}
                                                >
                                                    {req.item_name}
                                                </button>
                                            </td>

                                            {/* 7. Quantity */}
                                            <td className="px-4 py-3.5 w-24 min-w-[90px] text-center whitespace-nowrap">
                                                {isReceived && isPartialHandover ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-mono font-extrabold text-sm whitespace-nowrap" title={`${issuedQty} of ${requestedQty} given`}>
                                                            <span className="text-amber-600 dark:text-amber-400">{issuedQty}</span>
                                                            <span className="text-slate-400 dark:text-slate-500 font-normal"> / {requestedQty}</span>
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap mt-0.5">
                                                            {issuedQty} given ({deficitQty} deficit)
                                                        </span>
                                                    </div>
                                                ) : isPartiallyApproved ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-mono font-extrabold text-sm whitespace-nowrap" title={`${approvedQty} of ${requestedQty} in warehouse`}>
                                                            <span className="text-amber-600 dark:text-amber-400">{approvedQty}</span>
                                                            <span className="text-slate-400 dark:text-slate-500 font-normal"> / {requestedQty}</span>
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap mt-0.5">
                                                            {remainingQty} to procurement
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                                                            {requestedQty} <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-sans">{req.unit || (req.items && req.items[0]?.unit) || 'units'}</span>
                                                        </span>
                                                        {isRoutedToProcurement && (
                                                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap mt-0.5">
                                                                in procurement
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 8. Stock Feasibility */}
                                            <td className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRequestForStock(req)}
                                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                                    title="Click to view detailed item stock comparison"
                                                >
                                                    {matchEval.matchType === 'partial' ? (
                                                        <span className="text-amber-600 dark:text-amber-400 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                            Possible ({matchEval.candidates.length})
                                                        </span>
                                                    ) : matchEval.matchType === 'none' ? (
                                                        <span className="text-blue-600 dark:text-blue-400 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                                            New Item
                                                        </span>
                                                    ) : isOutOfStock ? (
                                                        <span className="text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                            Out of stock (0)
                                                        </span>
                                                    ) : !isStockFeasible ? (
                                                        <span className="text-amber-600 dark:text-amber-400 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                            Low Stock ({availableStock})
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                            Available ({availableStock})
                                                        </span>
                                                    )}
                                                </button>
                                            </td>

                                            {/* 9. Status Badge */}
                                            <td className="px-4 py-3.5 w-44 min-w-[160px] whitespace-nowrap">
                                                {isRowLoading ? (
                                                    <StatusBadge tone="amber" dot size="xs">
                                                        <span className="inline-flex items-center gap-1.5 font-bold">
                                                            <Loader2 className="w-3 h-3 animate-spin text-amber-500 inline" />
                                                            {actionLoadingId === 'bulk-reject' ? 'Rejecting...' : 'Approving...'}
                                                        </span>
                                                    </StatusBadge>
                                                ) : (
                                                    <StatusBadge
                                                        tone={
                                                            isReceived
                                                                ? isPartialHandover ? 'amber' : 'emerald'
                                                                : isPartiallyReviewed
                                                                ? 'amber'
                                                                : isPartiallyApproved 
                                                                ? 'amber' 
                                                                : isApproved 
                                                                ? 'emerald' 
                                                                : isRejected 
                                                                ? 'rose' 
                                                                : 'amber'
                                                        }
                                                        dot
                                                        size="xs"
                                                    >
                                                        {isReceived
                                                            ? isPartialHandover
                                                                ? `Partially Released (${issuedQty}/${requestedQty})`
                                                                : 'Supplies Released'
                                                            : isPartiallyReviewed
                                                            ? `Partially Reviewed (${approvedItemsCount}/${reqItems.length})`
                                                            : isPartiallyApproved
                                                            ? `Partially Approved (${approvedQty}/${requestedQty})`
                                                            : isApproved
                                                            ? 'Approved'
                                                            : isRejected
                                                            ? 'Rejected'
                                                            : 'Pending'}
                                                    </StatusBadge>
                                                )}
                                                {isReceived && !isRowLoading && (
                                                    isPartialHandover ? (
                                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 truncate max-w-[140px] flex items-center gap-1" title={`${issuedQty} of ${requestedQty} given, Deficit: ${deficitQty}`}>
                                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500 inline shrink-0" />
                                                            <span>{issuedQty}/{requestedQty} Given ({deficitQty} Deficit)</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-[140px] flex items-center gap-1">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 inline shrink-0" />
                                                            <span>Handover Fulfilled</span>
                                                        </p>
                                                    )
                                                )}
                                                {isPartiallyReviewed && !isReceived && !isRowLoading && (
                                                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-1 truncate max-w-[140px]" title={`${approvedItemsCount} approved, ${rejectedItemsCount} rejected, ${pendingItemsCount} pending`}>
                                                        {approvedItemsCount} approved • {pendingItemsCount} pending
                                                    </p>
                                                )}
                                                {isPartiallyApproved && !isReceived && !isPartiallyReviewed && !isRowLoading && (
                                                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-1 truncate max-w-[140px]" title={`${approvedQty} in warehouse • ${remainingQty} in procurement`}>
                                                        {approvedQty} warehousing • {remainingQty} procurement
                                                    </p>
                                                )}
                                                {isApproved && !isReceived && !isPartiallyApproved && !isPartiallyReviewed && !isRowLoading && (
                                                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[140px]">
                                                        {isRoutedToProcurement ? 'Routed to Procurement' : 'Routed to Warehousing'}
                                                    </p>
                                                )}
                                                {isRejected && !isReceived && !isPartiallyReviewed && req.rejection_reason && !isRowLoading && (
                                                    <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 truncate max-w-[130px]" title={req.rejection_reason}>
                                                        {req.rejection_reason}
                                                    </p>
                                                )}

                                                {/* Matching Purchase Order Status Indicator */}
                                                {matchingPO && poIndicator && !isRowLoading && (
                                                    <div className="mt-1.5 flex items-center">
                                                        <span 
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                                                poIndicator === 'Delivered'
                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                    : poIndicator === 'Waiting for Delivery'
                                                                    ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                                    : poIndicator === 'Rejected Purchase Order'
                                                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                            }`}
                                                            title={`Matching Purchase Order #${matchingPO.po_number || ''} (${poIndicator})`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                poIndicator === 'Delivered'
                                                                    ? 'bg-emerald-500'
                                                                    : poIndicator === 'Waiting for Delivery'
                                                                    ? 'bg-sky-500'
                                                                    : poIndicator === 'Rejected Purchase Order'
                                                                    ? 'bg-rose-500'
                                                                    : 'bg-amber-500'
                                                            }`} />
                                                            <span>{poIndicator}</span>
                                                            {matchingPO.po_number && (
                                                                <span className="font-mono text-[9px] opacity-75">#{matchingPO.po_number}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 10. Actions */}
                                            <td className="px-4 py-3.5 w-40 min-w-[150px] text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Unified Review Request & Check Items */}
                                                    <CrudActionButton
                                                        action="custom"
                                                        label="Review Request"
                                                        icon={FileText}
                                                        variant="neutral"
                                                        onClick={() => setSelectedRequestForForm(req)}
                                                        ariaLabel={`Review request and check items for #${req.request_number || (req.id ? req.id.slice(0, 8) : '')}`}
                                                        title="Review request document and check warehouse stock"
                                                    />

                                                    {isPending && !isRowLoading && (
                                                        <>
                                                            <CrudActionButton
                                                                action="approve"
                                                                variant="neutral"
                                                                onClick={() => handleApprove(req)}
                                                                disabled={Boolean(actionLoadingId)}
                                                                loading={actionLoadingId === req.id}
                                                                ariaLabel={`Approve & process request #${req.request_number || (req.id ? req.id.slice(0, 8) : '')}`}
                                                                title="Approve request and route to Warehousing / Procurement"
                                                            />

                                                            <CrudActionButton
                                                                action="reject"
                                                                variant="pink"
                                                                onClick={() => setRejectingRequest(req)}
                                                                disabled={Boolean(actionLoadingId)}
                                                                ariaLabel={`Reject request #${req.request_number || req.id.slice(0, 8)}`}
                                                                title="Decline request"
                                                            />
                                                        </>
                                                    )}

                                                    {isRowLoading && (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 shadow-inner">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                                            <span>Processing...</span>
                                                        </span>
                                                    )}

                                                    {isApproved && !isRowLoading && (
                                                        <span 
                                                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 shadow-inner"
                                                            title={isRoutedToProcurement ? "Approved and routed to Procurement Stage 1" : "Approved and routed to Warehousing"}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                            <span>Approved</span>
                                                        </span>
                                                    )}

                                                    {isReceived && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" /> Fulfilled
                                                        </span>
                                                    )}

                                                    {isRejected && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                                            <XCircle className="w-3.5 h-3.5 text-slate-400" /> Declined
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex-shrink-0 p-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Showing <span className="font-extrabold text-slate-900 dark:text-slate-100">{startIndex}</span> to{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{endIndex}</span> of{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{totalRequests}</span> requests
                    </span>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>

            {/* Rejection Modal */}
            {rejectingRequest && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setRejectingRequest(null)}
                    >
                        <div
                            className="relative w-full max-w-md bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] overflow-hidden transition-all my-auto p-5 sm:p-6 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                                    <XCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        Reject Request #{rejectingRequest.request_number}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Item: {rejectingRequest.item_name}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleConfirmReject} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Reason for Rejection <span className="text-pink-500">*</span>
                                    </label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={3}
                                        placeholder="e.g., Out of stock / Discontinued / Exceeded department quota..."
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-rose-500 resize-none"
                                        required
                                    />
                                </div>

                                <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-[11px] text-amber-700/90 dark:text-amber-300/90">
                                        Admin & Executive will automatically receive a notification regarding this declined requisition.
                                    </span>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <AppButton type="button" variant="secondary" size="md" onClick={() => setRejectingRequest(null)}>
                                        Cancel
                                    </AppButton>
                                    <AppButton
                                        type="submit"
                                        variant="pink"
                                        size="md"
                                    >
                                        Confirm Rejection
                                    </AppButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Bulk Rejection Modal */}
            {showBulkRejectModal && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setShowBulkRejectModal(false)}
                    >
                        <div
                            className="relative w-full max-w-md bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] overflow-hidden transition-all my-auto p-5 sm:p-6 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                                    <XCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                        Bulk Reject Requests
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Rejecting {requests.filter(r => selectedIds.has(r.id) && (r.status || 'pending').toLowerCase() === 'pending').length} pending request(s)
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleConfirmBulkReject} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Reason for Bulk Rejection <span className="text-pink-500">*</span>
                                    </label>
                                    <textarea
                                        value={bulkRejectReason}
                                        onChange={(e) => setBulkRejectReason(e.target.value)}
                                        rows={3}
                                        placeholder="e.g., Exceeded department budget / Inventory unavailable / Batch cancellation..."
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-rose-500 resize-none"
                                        required
                                    />
                                </div>

                                <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-[11px] text-amber-700/90 dark:text-amber-300/90">
                                        Admin & Executive will automatically receive a batch notification regarding these declined requisitions.
                                    </span>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <AppButton type="button" variant="secondary" size="md" onClick={() => setShowBulkRejectModal(false)}>
                                        Cancel
                                    </AppButton>
                                    <AppButton
                                        type="submit"
                                        variant="pink"
                                        size="md"
                                    >
                                        Confirm Bulk Rejection
                                    </AppButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Unified Side-by-Side Purchase Request & Live Inventory Stock Modal */}
            <PurchaseRequestFormModal
                isOpen={Boolean(activeSelectedRequest)}
                onClose={() => {
                    setSelectedRequestForForm(null);
                    setSelectedRequestForStock(null);
                }}
                request={activeSelectedRequest}
                inventoryItems={inventoryItems}
                suppliers={suppliers}
                canManageRequests={canManageRequests}
                userRole={currentRole}
                isBidAwarded={isSelectedRequestBidAwarded}
                onSuccess={(updatedRecord) => {
                    onRefresh();
                    if (updatedRecord && Array.isArray(updatedRecord.items)) {
                        const hasPending = updatedRecord.items.some((it: any) => (!it.status || it.status === 'Pending') && !it.is_approved && !it.is_approve);
                        if (hasPending) {
                            setSelectedRequestForForm(updatedRecord);
                            return;
                        }
                    }
                    setSelectedRequestForForm(null);
                    setSelectedRequestForStock(null);
                }}
                onOpenSupplierModal={(req) => {
                    setSelectedRequestForForm(null);
                    setSelectedRequestForStock(null);
                    setSelectedRequestForSupplierModal(req);
                }}
                onOpenMessageSupplier={(supplier) => {
                    setSelectedSupplierForMessage(supplier);
                }}
            />


            {/* Modal 4: Direct Supplier Messaging & Live Chat */}
            <SupplierMessageModal
                isOpen={Boolean(selectedSupplierForMessage)}
                onClose={() => setSelectedSupplierForMessage(null)}
                supplier={selectedSupplierForMessage}
            />
        </div>
    );
});
