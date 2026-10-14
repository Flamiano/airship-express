'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { InventoryRequest, InventoryItem } from '../../types';
import Portal from '../../../../components/client/Portal';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { AppButton } from '../../../../components/ui/AppButton';
import { useConfirm } from '../../../../components/ui/ConfirmModal';
import { toast } from 'sonner';
import { approveInventoryRequest, rejectInventoryRequest } from '../../server/query';
import { user } from '../../../../lib/services/Class/user';
import {
    FileText,
    Building2,
    User,
    Calendar,
    Phone,
    Briefcase,
    AlertTriangle,
    Check,
    X,
    Boxes,
    Clock,
    CheckCircle2,
    XCircle,
    Info,
    MessageSquare,
    Layers,
    Tag,
    Sparkles,
    Search,
    Compass,
    MapPin,
    Store,
    Loader2,
    ArrowRight
} from 'lucide-react';
import { evaluateItemMatch } from '../../utils/itemMatching';

const isCategoryMatch = (catA?: string, catB?: string) => {
    if (!catA || !catB) return false;
    const a = catA.toLowerCase().trim();
    const b = catB.toLowerCase().trim();
    return a === b || a.includes(b) || b.includes(a);
};

export interface PurchaseRequestFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InventoryRequest | null;
    inventoryItems?: InventoryItem[];
    suppliers?: any[];
    canManageRequests?: boolean;
    userRole?: string;
    isBidAwarded?: boolean;
    onSuccess?: (updatedRecord?: any) => void;
    onOpenStockModal?: (request: InventoryRequest) => void;
    onOpenSupplierModal?: (request: InventoryRequest) => void;
    onOpenMessageSupplier?: (supplier: any) => void;
}

export function PurchaseRequestFormModal({
    isOpen,
    onClose,
    request,
    inventoryItems = [],
    suppliers = [],
    canManageRequests = true,
    userRole = 'Admin',
    isBidAwarded = false,
    onSuccess,
    onOpenStockModal,
    onOpenSupplierModal,
    onOpenMessageSupplier,
}: PurchaseRequestFormModalProps) {
    const { confirm } = useConfirm();
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [localStatus, setLocalStatus] = useState<string | null>(null);
    const [localItems, setLocalItems] = useState<any[]>([]);
    const [itemActionLoadingIdx, setItemActionLoadingIdx] = useState<number | null>(null);

    useEffect(() => {
        setLocalStatus(null);
        setShowRejectInput(false);
        setRejectionReason('');
        const rawItems = Array.isArray(request?.items) && request.items.length > 0 
            ? request.items 
            : request ? [{ name: request.item_name, quantity: request.quantity_requested || 1, unit: request.unit || 'units', specs: '' }] : [];
        setLocalItems(rawItems);
    }, [request?.id, request?.items]);

    const items = useMemo(() => {
        if (localItems.length > 0) return localItems;
        if (Array.isArray(request?.items) && request.items.length > 0) return request.items;
        if (request) return [{ name: request.item_name, quantity: request.quantity_requested || 1, unit: request.unit || 'units', specs: '' }];
        return [];
    }, [localItems, request]);

    const effectiveStatus = (localStatus || request?.status || '').toLowerCase();
    const hasReleasedItems = Array.isArray(items) && items.length > 0 && items.some((it: any) => it.is_released === true || it.is_issued === true || it.status === 'Released' || it.status === 'Delivered');
    const isReleased = 
        effectiveStatus === 'delivered' || 
        effectiveStatus === 'completed' || 
        effectiveStatus === 'fulfilled' || 
        effectiveStatus === 'received' || 
        Boolean(request?.completed_at) ||
        Boolean(request?.fulfilled_at) || 
        Boolean(request?.fulfilled_by) ||
        hasReleasedItems;

    const itemWithRelease = items.find((it: any) => it.released_by || it.released_at);
    const releasingOfficer = itemWithRelease?.released_by || request?.fulfilled_by || 'Warehouse Releasing Custodian';
    const releaseTimestamp = itemWithRelease?.released_at || request?.completed_at || request?.fulfilled_at || null;

    const totalRequestedQty = items.reduce((a: number, b: any) => a + Number(b.quantity || b.quantity_requested || 1), 0) || Number(request?.quantity_requested || 1);
    const totalIssuedQty = items.reduce((acc: number, it: any) => {
        const isItemReleased = it.is_released === true || it.is_issued === true || (it.status || '').toLowerCase() === 'released';
        const qty = it.issued_quantity !== undefined ? Number(it.issued_quantity) : isItemReleased ? Number(it.approved_quantity ?? it.quantity) : 0;
        return acc + qty;
    }, 0) || (isReleased ? Number(request?.issued_quantity ?? request?.quantity_approved ?? totalRequestedQty) : 0);
    const totalDeficitQty = items.reduce((acc: number, it: any) => {
        const reqQ = Number(it.quantity || it.quantity_requested || 1);
        const isItemReleased = it.is_released === true || it.is_issued === true || (it.status || '').toLowerCase() === 'released';
        const qty = it.issued_quantity !== undefined ? Number(it.issued_quantity) : isItemReleased ? Number(it.approved_quantity ?? it.quantity) : 0;
        const def = it.deficit_quantity !== undefined ? Number(it.deficit_quantity) : Math.max(0, reqQ - qty);
        return acc + def;
    }, 0) || (isReleased ? Math.max(0, totalRequestedQty - totalIssuedQty) : 0);

    const isPartialHandover = isReleased && (totalDeficitQty > 0 || (totalIssuedQty > 0 && totalIssuedQty < totalRequestedQty));

    const pendingItemsCount = items.filter(it => (!it.status || it.status === 'Pending') && !it.is_approved && !it.is_approve && !it.is_released && !it.is_issued).length;
    const approvedItemsCount = items.filter(it => it.status === 'Approved' || it.is_approved === true || it.is_approve === true).length;
    const rejectedItemsCount = items.filter(it => it.status === 'Rejected').length;
    const isFullyApproved = items.length > 0 && items.every(it => it.status === 'Approved' || it.is_approved === true || it.is_approve === true || it.is_released || it.is_issued);
    const isFullyRejected = items.length > 0 && items.every(it => it.status === 'Rejected');
    const isPartiallyReviewed = !isReleased && items.length > 1 && (approvedItemsCount > 0 || rejectedItemsCount > 0) && pendingItemsCount > 0;

    const isPending = !isReleased && (pendingItemsCount > 0 || effectiveStatus === 'pending' || isPartiallyReviewed);
    const isApproved = !isReleased && (isFullyApproved || (effectiveStatus === 'approved' && pendingItemsCount === 0));
    const isRejected = !isReleased && (isFullyRejected || (effectiveStatus === 'rejected' && pendingItemsCount === 0));
    const isCompleted = isReleased || effectiveStatus === 'completed' || effectiveStatus === 'received';

    const isOthersCategory = items.some(
        (item) => (item.category || (request as any)?.category || '').trim().toLowerCase() === 'others'
    );
    const itemEvals = items.map((item) =>
        evaluateItemMatch(item.name, item.quantity || 1, inventoryItems)
    );

    const stockFeasibilitySummary = React.useMemo(() => {
        let totalReqUnits = 0;
        let availableUnits = 0;
        let deficitUnits = 0;
        let fullyInStockCount = 0;
        let partialOrDeficitCount = 0;
        let newItemsCount = 0;

        items.forEach((item, idx) => {
            const qty = Number(item.quantity || 1);
            totalReqUnits += qty;
            const evalResult = itemEvals[idx];
            if (!evalResult) return;

            if (evalResult.matchType === 'exact') {
                const stock = Number(evalResult.currentStock || 0);
                if (stock >= qty) {
                    availableUnits += qty;
                    fullyInStockCount += 1;
                } else {
                    availableUnits += Math.max(0, stock);
                    deficitUnits += Math.max(0, qty - stock);
                    partialOrDeficitCount += 1;
                }
            } else if (evalResult.matchType === 'partial') {
                partialOrDeficitCount += 1;
                deficitUnits += qty;
            } else {
                newItemsCount += 1;
                deficitUnits += qty;
            }
        });

        return {
            totalReqUnits,
            availableUnits,
            deficitUnits,
            fullyInStockCount,
            partialOrDeficitCount,
            newItemsCount,
        };
    }, [items, itemEvals]);

    const activeSupplierCategories = new Set(
        (suppliers || [])
            .filter((s: any) => s && (s.is_active === undefined || s.is_active === true) && s.status !== 'inactive')
            .map((s: any) => (s.category || '').toLowerCase().trim())
            .filter(Boolean)
    );

    const hasCategoryWithoutActiveSupplier = items.some((item) => {
        const cat = (item.category || (request as any)?.category || '').toLowerCase().trim();
        return Boolean(cat && !activeSupplierCategories.has(cat));
    });

    const hasPossible = itemEvals.some((e) => e.matchType === 'partial');
    const hasUnavailable = itemEvals.some((e) => e.matchType === 'none' || e.isOutOfStock);
    const showFindSupplierBtn = hasPossible || hasUnavailable || hasCategoryWithoutActiveSupplier || isOthersCategory;

    const handleApproveSingleItem = async (itemIdx: number, item: any) => {
        if (!request) return;
        const itemName = item.name || item.item_name || 'Item';
        const confirmed = await confirm({
            title: `Approve Item: ${itemName}`,
            message: `Approve "${itemName}" (Qty: ${item.quantity || 1} ${item.unit || 'units'}) for request #${request.request_number || request.id.slice(0, 8)}? Lacking or new quantities will be routed to Procurement Stage 1.`,
            confirmText: 'Approve Item',
            confirmVariant: 'success',
        });
        if (!confirmed) return;

        setItemActionLoadingIdx(itemIdx);
        const toastId = toast.loading(`Approving ${itemName}...`);
        try {
            const userName = user.getName();
            const userEmail = user.getEmail();
            const effectiveRole = userRole || user.getRole() || 'Admin';
            const performerDisplayName = userName && userName !== 'User'
                ? `${userName} (${effectiveRole})`
                : (userEmail || effectiveRole);

            const res = await approveInventoryRequest(
                request.id,
                user.getId() || effectiveRole,
                adminNotes,
                performerDisplayName,
                {
                    itemIndex: itemIdx,
                    action: 'approve',
                }
            );

            if (res.success) {
                if (res.data?.items) {
                    setLocalItems(res.data.items);
                } else {
                    setLocalItems(prev => prev.map((it, idx) => idx === itemIdx ? { ...it, status: 'Approved', is_approved: true, is_approve: true } : it));
                }
                if (res.data?.status) {
                    setLocalStatus(res.data.status);
                }
                toast.success(res.message || `Approved ${itemName}!`, { id: toastId });
                onSuccess?.(res.data || { ...request, items: localItems });
            } else {
                toast.error(res.error || `Failed to approve ${itemName}`, { id: toastId });
            }
        } catch (err: any) {
            console.error('Error approving item:', err);
            toast.error(err?.message || 'Failed to approve item', { id: toastId });
        } finally {
            setItemActionLoadingIdx(null);
        }
    };

    const handleRejectSingleItem = async (itemIdx: number, item: any) => {
        if (!request) return;
        const itemName = item.name || item.item_name || 'Item';
        const confirmed = await confirm({
            title: `Reject Item: ${itemName}`,
            message: `Are you sure you want to reject "${itemName}" for request #${request.request_number || request.id.slice(0, 8)}?`,
            confirmText: 'Reject Item',
            confirmVariant: 'danger',
        });
        if (!confirmed) return;

        setItemActionLoadingIdx(itemIdx);
        const toastId = toast.loading(`Rejecting ${itemName}...`);
        try {
            const userName = user.getName();
            const userEmail = user.getEmail();
            const effectiveRole = userRole || user.getRole() || 'Admin';
            const performerDisplayName = userName && userName !== 'User'
                ? `${userName} (${effectiveRole})`
                : (userEmail || effectiveRole);

            const res = await approveInventoryRequest(
                request.id,
                user.getId() || effectiveRole,
                adminNotes,
                performerDisplayName,
                {
                    itemIndex: itemIdx,
                    action: 'reject',
                }
            );

            if (res.success) {
                if (res.data?.items) {
                    setLocalItems(res.data.items);
                } else {
                    setLocalItems(prev => prev.map((it, idx) => idx === itemIdx ? { ...it, status: 'Rejected' } : it));
                }
                if (res.data?.status) {
                    setLocalStatus(res.data.status);
                }
                toast.success(res.message || `Rejected ${itemName}!`, { id: toastId });
                onSuccess?.(res.data || { ...request, items: localItems });
            } else {
                toast.error(res.error || `Failed to reject ${itemName}`, { id: toastId });
            }
        } catch (err: any) {
            console.error('Error rejecting item:', err);
            toast.error(err?.message || 'Failed to reject item', { id: toastId });
        } finally {
            setItemActionLoadingIdx(null);
        }
    };

    const handleApprove = async () => {
        if (!request) return;
        if (!canManageRequests) {
            toast.error('Only Admin and Executive can approve purchase requests.');
            return;
        }

        const isFullyInWarehouse = stockFeasibilitySummary.deficitUnits === 0 && stockFeasibilitySummary.newItemsCount === 0;
        const confirmationTitle = isFullyInWarehouse
            ? 'Approve for Warehouse Releasing'
            : 'Approve & Route to Procurement';

        const confirmationMsg = isFullyInWarehouse
            ? `All ${stockFeasibilitySummary.totalReqUnits} requested units are fully in stock. Approving will route this requisition directly to Warehousing for department dispatch.`
            : `Request has items requiring procurement (${stockFeasibilitySummary.deficitUnits} units deficit/new). Approving will register available stock and route external items to Procurement Stage 1.`;

        const confirmed = await confirm({
            title: confirmationTitle,
            message: confirmationMsg,
            confirmText: 'Confirm Approval',
            confirmVariant: 'success',
        });
        if (!confirmed) return;

        setIsApproving(true);
        const toastId = toast.loading(`Approving request #${request.request_number || request.id.slice(0, 8)}...`);
        try {
            const userName = user.getName();
            const userEmail = user.getEmail();
            const effectiveRole = userRole || user.getRole() || 'Admin';
            const performerDisplayName = userName && userName !== 'User'
                ? `${userName} (${effectiveRole})`
                : (userEmail || effectiveRole);

            const res = await approveInventoryRequest(
                request.id,
                user.getId() || effectiveRole,
                adminNotes,
                performerDisplayName
            );
            if (res.success) {
                setLocalStatus('Approved');
                toast.success(res.message || 'Request approved successfully!', { id: toastId });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to approve request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error approving request:', err);
            toast.error(err?.message || 'Failed to approve request', { id: toastId });
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!request) return;
        if (!canManageRequests) {
            toast.error('Only Admin and Executive can reject purchase requests.');
            return;
        }

        if (!rejectionReason.trim()) {
            toast.warning('Please provide a reason for rejecting this request');
            return;
        }

        setIsRejecting(true);
        const toastId = toast.loading(`Rejecting request #${request.request_number || request.id.slice(0, 8)}...`);
        try {
            const res = await rejectInventoryRequest(request.id, rejectionReason.trim(), userRole, adminNotes);
            if (res.success) {
                setLocalStatus('Rejected');
                toast.success(res.message || 'Request rejected.', { id: toastId });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to reject request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error rejecting request:', err);
            toast.error(err?.message || 'Failed to reject request', { id: toastId });
        } finally {
            setIsRejecting(false);
        }
    };

    if (!isOpen || !request) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-[1400px] w-full max-h-[94vh] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Top Unified Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-[#ebf0f7]/80 dark:bg-[#14151e]/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/30 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-inner shrink-0">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                        Department Item Request &amp; Live Inventory Verification
                                    </h3>
                                    <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-lg border border-pink-200 dark:border-pink-900/50">
                                        {request.request_number || `#REQ-${request.id.slice(0, 8)}`}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Unified requisition review &amp; warehouse inventory feasibility command center
                                </p>
                            </div>
                        </div>

                        {/* Quick Status Ribbon in Header */}
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-bold">
                                    <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                    {request.department || 'Warehouse'}
                                </span>
                                <StatusBadge tone={request.priority === 'Critical' ? 'rose' : request.priority === 'Urgent' ? 'amber' : 'neutral'} size="xs">
                                    {request.priority || 'Normal'}
                                </StatusBadge>
                                <StatusBadge tone={isReleased ? (isPartialHandover ? 'amber' : 'emerald') : isApproved ? 'emerald' : isCompleted ? 'emerald' : isRejected ? 'rose' : 'amber'} size="xs" dot>
                                    {isReleased ? (isPartialHandover ? `Partially Released (${totalIssuedQty}/${totalRequestedQty})` : 'Released & Fulfilled') : localStatus || request.status || 'Pending'}
                                </StatusBadge>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#12131b] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] cursor-pointer shrink-0"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Warehouse Handover Banner (if already released) */}
                    {isReleased && (
                        <div className={`mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 flex-wrap ${
                            isPartialHandover 
                                ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-100 shadow-[inset_1px_1px_2px_rgba(245,158,11,0.15)]'
                                : 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-100 shadow-[inset_1px_1px_2px_rgba(16,185,129,0.15)]'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md ${
                                    isPartialHandover ? 'bg-amber-600' : 'bg-emerald-600'
                                }`}>
                                    {isPartialHandover ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-extrabold text-xs sm:text-sm ${isPartialHandover ? 'text-amber-950 dark:text-amber-50' : 'text-emerald-950 dark:text-emerald-50'}`}>
                                            {isPartialHandover 
                                                ? `Supplies Partially Released (${totalIssuedQty}/${totalRequestedQty} Given)` 
                                                : 'Supplies Already Released to Department'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white ${
                                            isPartialHandover ? 'bg-amber-600' : 'bg-emerald-600'
                                        }`}>
                                            {isPartialHandover ? `Partial Release (${totalIssuedQty}/${totalRequestedQty})` : 'Handover Fulfilled'}
                                        </span>
                                    </div>
                                    <p className={`text-[11px] mt-0.5 ${isPartialHandover ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                        Handed over <strong className="font-bold">{totalIssuedQty} of {totalRequestedQty}</strong> by <strong className="font-bold">{releasingOfficer}</strong>
                                        {isPartialHandover && ` (Deficit: ${totalDeficitQty} units)`}
                                        {releaseTimestamp && (
                                            <> on <span className="font-semibold font-mono">{new Date(releaseTimestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scrollable Side-by-Side Main Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            
                            {/* ======================================================== */}
                            {/* LEFT SIDE: DEPARTMENT REQUEST FORM (PR)                  */}
                            {/* ======================================================== */}
                            <div className="lg:col-span-6 flex flex-col space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-pink-500" />
                                        Department Request &amp; Decision Form
                                    </h4>
                                    <span className="text-[11px] font-semibold text-slate-400">
                                        Requisition Details ({items.length} items)
                                    </span>
                                </div>

                                {/* Requisition Dossier Card */}
                                <div className="p-4 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#12131b]/70 border border-white/80 dark:border-white/[0.05] space-y-3.5 shadow-sm">
                                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200/50 dark:border-white/[0.05]">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Requester</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block truncate mt-0.5">
                                                {request.requested_by || 'Staff Member'}
                                            </span>
                                            {request.requester_position && (
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                                    {request.requester_position}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Contact &amp; Beneficiary</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs block truncate mt-0.5">
                                                {request.requester_contact || 'N/A'}
                                            </span>
                                            {request.requested_for && (
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                                    For: {request.requested_for}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Purpose & Dates */}
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Operational Purpose</span>
                                            <p className="text-slate-800 dark:text-slate-200 font-medium text-xs mt-1 leading-relaxed">
                                                {request.purpose || request.description || 'General operational requirement'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Submitted:</span>
                                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                                    {request.created_at ? new Date(request.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                                                </span>
                                            </div>

                                            {request.needed_by_date && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold">
                                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                    <span>Needed By:</span>
                                                    <span className="font-mono font-bold">
                                                        {new Date(request.needed_by_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {(request.urgency_reason || request.advance_reason) && (
                                            <div className="space-y-1.5 pt-1.5">
                                                {request.urgency_reason && (
                                                    <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold uppercase tracking-wider text-[9px] block">Urgency Reason</span>
                                                            <span className="line-clamp-2">{request.urgency_reason}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {request.advance_reason && (
                                                    <div className="p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-[11px]">
                                                        <span className="font-bold uppercase tracking-wider text-[9px] block">Advance Reason</span>
                                                        <span className="line-clamp-2">{request.advance_reason}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Requested Items Table */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-pink-500" />
                                            Requested Items &amp; Approval Status
                                        </h5>
                                        <span className="text-[10px] text-slate-400">
                                            {items.length} line item(s)
                                        </span>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] overflow-x-auto shadow-sm">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-[#e8edf5]/80 dark:bg-[#12131a] border-b border-slate-200/60 dark:border-white/[0.06] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <th className="px-3 py-2 w-10 text-center">#</th>
                                                    <th className="px-3 py-2">Requested Item</th>
                                                    <th className="px-3 py-2 text-center w-24">Qty</th>
                                                    <th className="px-3 py-2 text-center w-28">Status / Review</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] bg-[#ebf0f7]/40 dark:bg-[#14151e]/40">
                                                {items.map((item, idx) => {
                                                    const itemName = item.name || item.item_name || 'Item';
                                                    const itemQty = Number(item.quantity || 1);
                                                    const itemUnit = item.unit || (item as any).uom || 'units';
                                                    const itemCategory = item.category || (item as any).category_name || (request as any).category || '';
                                                    const itemRemarks = item.specs || item.specifications || item.remarks || '';
                                                    const itemStatus = item.status || (item.is_approved === true || item.is_approve === true ? 'Approved' : 'Pending');
                                                    const isItemReleased = isReleased || item.is_released === true || item.is_issued === true || item.status === 'Released' || item.status === 'Delivered';
                                                    const itemIssuedQty = item.issued_quantity !== undefined ? Number(item.issued_quantity) : isItemReleased ? Number(item.approved_quantity ?? itemQty) : 0;
                                                    const itemDeficitQty = item.deficit_quantity !== undefined ? Number(item.deficit_quantity) : isItemReleased ? Math.max(0, itemQty - itemIssuedQty) : 0;

                                                    return (
                                                        <tr key={idx} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-3 py-2.5 text-center font-mono text-slate-400 font-bold align-top text-xs w-10">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="px-3 py-2.5 align-top">
                                                                <div className="space-y-1">
                                                                    <span className="font-bold text-slate-900 dark:text-white block text-xs leading-snug">
                                                                        {itemName}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        {itemCategory && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/70 dark:border-pink-800/50 text-[9px] font-semibold">
                                                                                <Tag className="w-2.5 h-2.5 text-pink-500" />
                                                                                <span>{itemCategory}</span>
                                                                            </span>
                                                                        )}
                                                                        {isItemReleased && (
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                                                                itemIssuedQty > 0 && itemIssuedQty < itemQty
                                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                            }`}>
                                                                                {itemIssuedQty > 0 && itemIssuedQty < itemQty ? `Given ${itemIssuedQty}/${itemQty}` : 'Released'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {itemRemarks && (
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-1">
                                                                            "{itemRemarks}"
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center align-top w-24">
                                                                <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100 block">
                                                                    {itemQty} {itemUnit}
                                                                </span>
                                                                {isItemReleased && itemDeficitQty > 0 && (
                                                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 block">
                                                                        {itemDeficitQty} deficit
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center align-top w-28">
                                                                {isReleased ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                        <span>Released</span>
                                                                    </span>
                                                                ) : itemStatus === 'Approved' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80">
                                                                        <Check className="w-3 h-3 text-emerald-500" />
                                                                        <span>Approved</span>
                                                                    </span>
                                                                ) : itemStatus === 'Rejected' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/80">
                                                                        <X className="w-3 h-3 text-rose-500" />
                                                                        <span>Rejected</span>
                                                                    </span>
                                                                ) : canManageRequests ? (
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleApproveSingleItem(idx, item)}
                                                                            disabled={itemActionLoadingIdx === idx || isApproving || isRejecting}
                                                                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                                                                            title="Approve this item"
                                                                        >
                                                                            {itemActionLoadingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRejectSingleItem(idx, item)}
                                                                            disabled={itemActionLoadingIdx === idx || isApproving || isRejecting}
                                                                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                                                                            title="Reject this item"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 text-[10px] font-semibold">Pending</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Admin Notes / Rejection Reason Box */}
                                <div className="space-y-2">
                                    {request.admin_notes && (
                                        <div className="p-3 rounded-xl bg-white/60 dark:bg-[#12131b]/60 border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[9px] flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3 text-pink-500" /> Admin / Reviewer Notes
                                            </span>
                                            <p className="text-slate-700 dark:text-slate-300 text-xs">
                                                {request.admin_notes}
                                            </p>
                                        </div>
                                    )}

                                    {isRejected && request.rejection_reason && (
                                        <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200/70 dark:border-rose-900/50 space-y-1">
                                            <span className="font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[9px] flex items-center gap-1">
                                                <XCircle className="w-3 h-3" /> Rejection Reason
                                            </span>
                                            <p className="text-rose-800 dark:text-rose-200 font-medium text-xs">{request.rejection_reason}</p>
                                        </div>
                                    )}

                                    {/* Inline Rejection Reason Form */}
                                    {showRejectInput && isPending && (
                                        <form onSubmit={handleReject} className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2.5 animate-in fade-in duration-150">
                                            <label className="font-bold text-rose-700 dark:text-rose-300 block text-xs">
                                                Specify Rejection Reason <span className="text-rose-500">*</span>
                                            </label>
                                            <textarea
                                                className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/80 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                                rows={2}
                                                placeholder="Explain why this request is rejected..."
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="sm"
                                                    onClick={() => setShowRejectInput(false)}
                                                >
                                                    Cancel
                                                </AppButton>
                                                <AppButton
                                                    type="submit"
                                                    variant="danger"
                                                    size="sm"
                                                    disabled={isRejecting || !rejectionReason.trim()}
                                                >
                                                    {isRejecting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <X className="w-3 h-3 mr-1" />}
                                                    <span>Confirm Rejection</span>
                                                </AppButton>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>

                            {/* ======================================================== */}
                            {/* RIGHT SIDE: LIVE INVENTORY ITEMS & STOCK FEASIBILITY      */}
                            {/* ======================================================== */}
                            <div className="lg:col-span-6 flex flex-col space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <Boxes className="w-4 h-4 text-pink-500" />
                                        Live Inventory Stock &amp; Catalog Match
                                    </h4>
                                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60">
                                        {stockFeasibilitySummary.availableUnits} Available / {stockFeasibilitySummary.totalReqUnits} Requested
                                    </span>
                                </div>

                                {/* Feasibility Overview KPI Card */}
                                <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#12131c]/70 border border-slate-200/60 dark:border-white/[0.05] space-y-2.5 shadow-sm">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Warehouse Dispatch Feasibility
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                {stockFeasibilitySummary.availableUnits} Ready in Stock
                                            </span>
                                            {stockFeasibilitySummary.deficitUnits > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                    {stockFeasibilitySummary.deficitUnits} Deficit Needed
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Breakdown stats */}
                                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-200/50 dark:border-white/[0.04]">
                                        <div className="p-2 rounded-xl bg-[#ebf0f7]/70 dark:bg-[#151622]/70">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">In-Stock</span>
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                {stockFeasibilitySummary.fullyInStockCount} item(s)
                                            </span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-[#ebf0f7]/70 dark:bg-[#151622]/70">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Low / Possible</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                                                {stockFeasibilitySummary.partialOrDeficitCount} item(s)
                                            </span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-[#ebf0f7]/70 dark:bg-[#151622]/70">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">New Items</span>
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                                                {stockFeasibilitySummary.newItemsCount} item(s)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Item-by-Item Live Stock Cards */}
                                <div className="space-y-3">
                                    {items.map((item, idx) => {
                                        const itemName = item.name || item.item_name || 'Item';
                                        const itemQty = Number(item.quantity || 1);
                                        const itemUnit = item.unit || (item as any).uom || 'units';

                                        const matchEval = evaluateItemMatch(
                                            itemName,
                                            itemQty,
                                            inventoryItems || [],
                                            item.item_code || item.id
                                        );

                                        const matchedCatalog = matchEval.matchedItem;
                                        const currentStock = matchEval.currentStock;
                                        const minStock = matchEval.minimumStock;
                                        const isExact = matchEval.matchType === 'exact';
                                        const isPartial = matchEval.matchType === 'partial';
                                        const isNone = matchEval.matchType === 'none';

                                        // Lookup supplier if available
                                        const itemCategory = item.category || (item as any).category_name || (request as any).category || matchedCatalog?.category;
                                        const catalogSupplier = matchedCatalog?.supplier || matchedCatalog?.latest_po?.supplier_name || (item as any).supplier;
                                        const foundSupplier = suppliers.find((s: any) => {
                                            if (!s) return false;
                                            const sName = (s.name || '').toLowerCase().trim();
                                            const cName = (catalogSupplier || '').toLowerCase().trim();
                                            return cName && sName && (sName === cName || sName.includes(cName) || cName.includes(sName));
                                        });

                                        return (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#13141d]/80 border border-slate-200/60 dark:border-white/[0.06] space-y-2.5 shadow-sm"
                                            >
                                                {/* Card Header: Item info & Status Pill */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate" title={itemName}>
                                                                {itemName}
                                                            </h5>
                                                            {itemCategory && (
                                                                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                    {itemCategory}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 pl-6.5 block">
                                                            Requested: <strong className="font-mono text-slate-700 dark:text-slate-200">{itemQty} {itemUnit}</strong>
                                                        </span>
                                                    </div>

                                                    {/* Live Stock Feasibility Badge */}
                                                    <div className="shrink-0">
                                                        {isExact ? (
                                                            matchEval.isOutOfStock ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                                    <XCircle className="w-3 h-3 text-rose-500" />
                                                                    Out of Stock (0)
                                                                </span>
                                                            ) : matchEval.isLowStock ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                                    Low Stock ({currentStock})
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                    In Stock ({currentStock})
                                                                </span>
                                                            )
                                                        ) : isPartial ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                <Sparkles className="w-3 h-3 text-amber-500" />
                                                                Possible Match ({matchEval.candidates.length})
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                <Tag className="w-3 h-3 text-blue-500" />
                                                                New Item (0)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Matched Catalog Details */}
                                                {isExact && (
                                                    <div className="p-2 rounded-xl bg-[#ebf0f7]/70 dark:bg-[#12131b]/70 border border-slate-200/50 dark:border-white/[0.04] space-y-1 text-xs">
                                                        <div className="flex items-center justify-between gap-1.5">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0" title={`${matchedCatalog?.item_code} - ${matchedCatalog?.item_name}`}>
                                                                <strong className="font-mono text-emerald-600 dark:text-emerald-400 mr-1.5">{matchedCatalog?.item_code}</strong>
                                                                {matchedCatalog?.item_name}
                                                            </span>
                                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] shrink-0">
                                                                {currentStock} {matchedCatalog?.unit || itemUnit} On-Hand
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                                            <span>Location: <strong className="text-slate-600 dark:text-slate-300">{(matchedCatalog as any)?.location || 'Main Storage'}</strong></span>
                                                            <span>Min threshold: <strong className="font-mono text-slate-600 dark:text-slate-300">{minStock}</strong></span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Possible Match Candidates List */}
                                                {isPartial && matchEval.candidates.length > 0 && (
                                                    <div className="p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 space-y-1.5 text-xs">
                                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">
                                                            Similar Warehouse Items:
                                                        </span>
                                                        <div className="space-y-1 max-h-24 overflow-y-auto">
                                                            {matchEval.candidates.map((cand, cIdx) => (
                                                                <div key={cIdx} className="flex items-center justify-between gap-1 text-[11px]">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                                                                        <strong className="font-mono text-pink-600 dark:text-pink-400 mr-1">{cand.item.item_code}</strong>
                                                                        {cand.item.item_name}
                                                                    </span>
                                                                    <span className={`font-mono font-bold text-[10px] shrink-0 ${Number(cand.item.current_stock || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                                        {cand.item.current_stock} {cand.item.unit}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* New Item Procurement Notice */}
                                                {isNone && (
                                                    <div className="p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 text-[11px] text-blue-800 dark:text-blue-300">
                                                        Item is not yet cataloged in warehouse stock. External procurement or supplier quotation required.
                                                    </div>
                                                )}

                                                {/* Supplier Leads / Sourcing Action */}
                                                {(foundSupplier || (catalogSupplier && catalogSupplier !== 'N/A')) && (
                                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/40 dark:border-white/[0.04] text-[10px]">
                                                        <span className="text-slate-400 flex items-center gap-1">
                                                            <Store className="w-3 h-3 text-pink-500" />
                                                            <span>Supplier: <strong className="text-slate-700 dark:text-slate-300">{foundSupplier?.name || catalogSupplier}</strong></span>
                                                        </span>
                                                        {onOpenMessageSupplier && foundSupplier && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenMessageSupplier(foundSupplier)}
                                                                className="text-pink-600 dark:text-pink-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                                            >
                                                                <span>Message</span>
                                                                <ArrowRight className="w-2.5 h-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Bottom Modal Actions */}
                    <div className="p-4 sm:p-5 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-[#ebf0f7]/80 dark:bg-[#14151e]/80 backdrop-blur-md shrink-0 flex-wrap">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                        >
                            <span>Close</span>
                        </AppButton>

                        <div className="flex items-center gap-2 flex-wrap">
                            {isReleased && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 shadow-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span>Supplies Already Released</span>
                                </span>
                            )}

                            {isApproved && !isPending && !isReleased && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 shadow-xs">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    <span>Approved &amp; Routed</span>
                                </span>
                            )}

                            {isRejected && !isPending && !isReleased && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-500/20 shadow-xs">
                                    <X className="w-4 h-4 text-rose-500" />
                                    <span>Request Declined</span>
                                </span>
                            )}

                            {isPending && !showRejectInput && canManageRequests && (
                                <>
                                    {isPartiallyReviewed && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/20 mr-auto">
                                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                                            <span>{approvedItemsCount}/{items.length} Approved ({pendingItemsCount} Pending)</span>
                                        </span>
                                    )}
                                    <AppButton
                                        type="button"
                                        variant="danger"
                                        size="md"
                                        onClick={() => setShowRejectInput(true)}
                                        disabled={isApproving || isRejecting}
                                    >
                                        <X className="w-4 h-4 mr-1.5" />
                                        <span>{isPartiallyReviewed ? 'Reject Remaining' : 'Reject'}</span>
                                    </AppButton>

                                    <AppButton
                                        type="button"
                                        variant="primary"
                                        size="md"
                                        onClick={handleApprove}
                                        disabled={isApproving || isRejecting}
                                        loading={isApproving}
                                        title={
                                            stockFeasibilitySummary.deficitUnits === 0 && stockFeasibilitySummary.newItemsCount === 0
                                                ? 'Approve and route to Warehousing for releasing'
                                                : 'Approve and route external items to Procurement Stage 1'
                                        }
                                    >
                                        <Check className="w-4 h-4 mr-1.5" />
                                        <span>
                                            {isPartiallyReviewed 
                                                ? 'Approve Remaining'
                                                : stockFeasibilitySummary.deficitUnits === 0 && stockFeasibilitySummary.newItemsCount === 0
                                                ? 'Approve for Warehouse Releasing'
                                                : 'Approve & Route to Procurement'}
                                        </span>
                                    </AppButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
