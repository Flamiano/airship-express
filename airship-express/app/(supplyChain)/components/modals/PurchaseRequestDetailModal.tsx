'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Calendar, User, Building, Tag, Package, Trash2, Edit3, Check, X, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/services/client/supabase';
import { useConfirm } from '../ui/ConfirmModal';
import { AppButton } from '../ui/AppButton';
import { StatusBadge } from '../ui/StatusBadge';
import Portal from '../client/Portal';
import { deletePurchaseRequest, updatePurchaseRequest, patchPurchaseRequest } from '../../(pages)/procurement/utils/procurementApi';
import { user } from '../../lib/services/Class/user';

interface PurchaseRequestDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: string | null;
    requestNumber?: string | null;
    userRole?: string;
    onSuccess?: () => void;
}

export function PurchaseRequestDetailModal({
    isOpen,
    onClose,
    requestId,
    requestNumber,
    userRole: propUserRole,
    onSuccess,
}: PurchaseRequestDetailModalProps) {
    const { confirm } = useConfirm();

    const [isLoading, setIsLoading] = useState(false);
    const [request, setRequest] = useState<any | null>(null);
    const [linkedPO, setLinkedPO] = useState<any | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPatching, setIsPatching] = useState(false);

    const currentUserRole = useMemo(() => {
        if (propUserRole) return propUserRole.trim().toLowerCase();
        return (user.getRole() || 'User').trim().toLowerCase();
    }, [propUserRole]);

    const fetchRequestDetails = useCallback(async () => {
        if (!requestId && !requestNumber) return;
        setIsLoading(true);
        setIsEditing(false);
        setEditForm(null);

        try {
            let query = supabase.from('purchase_requests').select('*');
            if (requestId) {
                query = query.eq('id', requestId);
            } else if (requestNumber) {
                query = query.eq('request_number', requestNumber);
            }

            const { data, error } = await query.maybeSingle();
            if (error) throw error;
            if (!data) {
                toast.error('Purchase request not found');
                onClose();
                return;
            }

            setRequest(data);
            setEditForm(JSON.parse(JSON.stringify(data)));

            // Check if there is an associated purchase order
            const { data: po } = await supabase
                .from('purchase_orders')
                .select('id, po_number, status')
                .eq('request_id', data.id)
                .maybeSingle();

            setLinkedPO(po || null);
        } catch (err: any) {
            console.error('Error loading purchase request:', err);
            toast.error(err?.message || 'Failed to load purchase request details');
        } finally {
            setIsLoading(false);
        }
    }, [requestId, requestNumber, onClose]);

    useEffect(() => {
        if (isOpen) {
            fetchRequestDetails();
        } else {
            setRequest(null);
            setLinkedPO(null);
            setIsEditing(false);
            setEditForm(null);
        }
    }, [isOpen, fetchRequestDetails]);

    // Permissions:
    // "allow to see the purchase request and can delete and edit by managers, but when approved only admin and executives can edit unless it is sent confirmed, delivered"
    // "executive and admin role when click the Purchase Request Details pending allow update from there"
    const { canEdit, canDelete, canApproveReject, isLocked, isAdminOrExec } = useMemo(() => {
        if (!request) return { canEdit: false, canDelete: false, canApproveReject: false, isLocked: false, isAdminOrExec: false };

        const reqStatus = (request.status || '').toLowerCase();
        const poStatus = (linkedPO?.status || '').toLowerCase();

        const locked =
            ['sent', 'confirmed', 'delivered', 'completed'].includes(reqStatus) ||
            ['sent', 'confirmed', 'delivered'].includes(poStatus);

        const adminOrExec = ['admin', 'executive', 'super_admin', 'superadmin', 'administrator'].includes(currentUserRole);
        const isManager = ['manager', 'warehouse_manager', 'inventory_manager'].includes(currentUserRole);

        // When locked (sent, confirmed, delivered, completed), no one can edit or delete
        if (locked) {
            return { canEdit: false, canDelete: false, canApproveReject: false, isLocked: true, isAdminOrExec: adminOrExec };
        }

        // When Pending:
        // - Admin and Executive can edit, update, delete, approve, and reject
        // - Manager can edit and delete
        if (reqStatus === 'pending') {
            return {
                canEdit: adminOrExec || isManager,
                canDelete: adminOrExec || isManager,
                canApproveReject: adminOrExec,
                isLocked: false,
                isAdminOrExec: adminOrExec,
            };
        }

        // When Approved: Only Admin and Executive can edit (unless sent, confirmed, delivered)
        if (reqStatus === 'approved') {
            return {
                canEdit: adminOrExec,
                canDelete: false, // Approved requests should not be casually deleted
                canApproveReject: false,
                isLocked: false,
                isAdminOrExec: adminOrExec,
            };
        }

        // When Rejected: Admin and Executive can delete
        if (reqStatus === 'rejected') {
            return {
                canEdit: false,
                canDelete: adminOrExec,
                canApproveReject: false,
                isLocked: false,
                isAdminOrExec: adminOrExec,
            };
        }

        return { canEdit: false, canDelete: false, canApproveReject: false, isLocked: false, isAdminOrExec: adminOrExec };
    }, [request, linkedPO, currentUserRole]);

    const handleItemChange = (index: number, field: string, val: any) => {
        if (!editForm) return;
        const items = [...(editForm.items || [])];
        const target = { ...items[index] };

        if (field === 'name') {
            target.name = val;
            target.item_name = val;
        } else if (field === 'quantity') {
            const qty = Math.max(1, Number(val) || 1);
            target.quantity = qty;
            const price = Number(target.unit_price ?? target.price ?? 0);
            target.total = qty * price;
        } else if (field === 'unit_price') {
            const price = Math.max(0, Number(val) || 0);
            target.unit_price = price;
            target.price = price;
            const qty = Math.max(1, Number(target.quantity) || 1);
            target.total = qty * price;
        }

        items[index] = target;
        const newTotal = items.reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0);

        setEditForm({
            ...editForm,
            items,
            amount: newTotal,
        });
    };

    const handleAddItem = () => {
        if (!editForm) return;
        const items = [...(editForm.items || [])];
        items.push({
            name: '',
            quantity: 1,
            unit_price: 0,
            price: 0,
            total: 0,
        });
        setEditForm({
            ...editForm,
            items,
        });
    };

    const handleRemoveItem = (index: number) => {
        if (!editForm) return;
        if ((editForm.items || []).length <= 1) {
            toast.warning('A request must contain at least one line item');
            return;
        }
        const items = (editForm.items || []).filter((_: any, idx: number) => idx !== index);
        const newTotal = items.reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0);
        setEditForm({
            ...editForm,
            items,
            amount: newTotal,
        });
    };

    const handleSaveEdits = async () => {
        if (!request || !editForm) return;

        const rawItems = editForm.items || [];
        const hasEmptyName = rawItems.some((it: any) => !(it.name || it.item_name || '').trim());
        if (hasEmptyName) {
            toast.warning('Please provide a name for all line items');
            return;
        }

        setIsSaving(true);
        try {
            const sanitizedItems = rawItems.map((item: any) => {
                const name = (item.name || item.item_name || 'Item').trim();
                const quantity = Math.max(1, Number(item.quantity) || 1);
                const unit_price = Number(item.unit_price ?? item.price ?? 0);
                return {
                    name,
                    quantity,
                    unit_price,
                    price: unit_price,
                    total: quantity * unit_price,
                };
            });

            const computedAmount = sanitizedItems.reduce((acc: number, it: any) => acc + it.total, 0);

            const payload: any = {
                id: request.id,
                items: sanitizedItems,
                amount: computedAmount > 0 ? computedAmount : (Number(editForm.amount) || 0),
                description: sanitizedItems.map((i: any) => `${i.name} (${i.quantity} @ ₱${i.unit_price.toLocaleString()})`).join(', '),
                priority: editForm.priority || request.priority,
                reason: editForm.reason || request.reason,
                status: editForm.status || request.status,
            };

            await updatePurchaseRequest(payload);

            toast.success('Purchase request updated successfully');
            setRequest({
                ...request,
                ...payload,
            });
            setIsEditing(false);
            onSuccess?.();
        } catch (err: any) {
            console.error('Error saving request edits:', err);
            toast.error(err?.message || 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!request) return;

        const confirmed = await confirm({
            title: 'Approve Purchase Request',
            message: `Are you sure you want to approve purchase request ${request.request_number || request.id}? This will authorize procurement to proceed with generating a Purchase Order.`,
            confirmText: 'Approve Request',
            cancelText: 'Cancel',
            confirmVariant: 'success',
        });

        if (!confirmed) return;

        setIsPatching(true);
        try {
            await patchPurchaseRequest({ id: request.id, action: 'approve', role: currentUserRole });
            toast.success(`Purchase request ${request.request_number || ''} approved successfully`);
            setRequest((prev: any) => (prev ? { ...prev, status: 'Approved' } : null));
            onSuccess?.();
        } catch (err: any) {
            console.error('Error approving purchase request:', err);
            toast.error(err?.message || 'Failed to approve request');
        } finally {
            setIsPatching(false);
        }
    };

    const handleReject = async () => {
        if (!request) return;

        const confirmed = await confirm({
            title: 'Reject Purchase Request',
            message: `Are you sure you want to reject purchase request ${request.request_number || request.id}?`,
            confirmText: 'Reject Request',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsPatching(true);
        try {
            await patchPurchaseRequest({ id: request.id, action: 'reject', role: currentUserRole });
            toast.success(`Purchase request ${request.request_number || ''} marked as rejected`);
            setRequest((prev: any) => (prev ? { ...prev, status: 'Rejected' } : null));
            onSuccess?.();
        } catch (err: any) {
            console.error('Error rejecting purchase request:', err);
            toast.error(err?.message || 'Failed to reject request');
        } finally {
            setIsPatching(false);
        }
    };

    const handleDelete = async () => {
        if (!request) return;

        const confirmed = await confirm({
            title: 'Delete Purchase Request',
            message: `Are you sure you want to delete purchase request ${request.request_number}? This action cannot be undone.`,
            confirmText: 'Delete Request',
            cancelText: 'Cancel',
            confirmVariant: 'danger',
        });

        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await deletePurchaseRequest(request.id);
            toast.success(`Purchase request ${request.request_number} deleted successfully`);
            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('Error deleting purchase request:', err);
            toast.error(err?.message || 'Failed to delete request');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    const displayData = isEditing && editForm ? editForm : request;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full p-6 dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                                        Purchase Request Details
                                    </h3>
                                    {request?.request_number && (
                                        <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] px-2.5 py-0.5 rounded-lg border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                            #{request.request_number}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    {isEditing ? 'Modify request line items, quantities, and parameters' : 'Review replenishment request status and authorization actions'}
                                </p>
                            </div>
                        </div>

                        <AppButton
                            type="button"
                            variant="neutral"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <X className="h-4 w-4" />
                        </AppButton>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin h-8 w-8 text-pink-600 dark:text-pink-400" />
                                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading request details...</span>
                            </div>
                        ) : !request ? (
                            <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
                                Unable to find or display purchase request.
                            </div>
                        ) : (
                            <>
                                {/* Status bar & Metadata */}
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <StatusBadge
                                            tone={
                                                request.status === 'Approved' ? 'purple' :
                                                request.status === 'Rejected' ? 'rose' :
                                                request.status === 'Completed' ? 'pink' : 'amber'
                                            }
                                            dot
                                            size="sm"
                                        >
                                            {request.status}
                                        </StatusBadge>

                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={editForm?.priority || 'Normal'}
                                                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#e4ebf5] dark:bg-[#111218] border border-pink-300 dark:border-pink-800 text-pink-600 dark:text-pink-400 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] focus:outline-none cursor-pointer"
                                                >
                                                    <option value="Low">Low Priority</option>
                                                    <option value="Normal">Normal Priority</option>
                                                    <option value="Urgent">Urgent Priority</option>
                                                    <option value="Critical">Critical Priority</option>
                                                </select>

                                                {isAdminOrExec && (
                                                    <select
                                                        value={editForm?.status || request.status || 'Pending'}
                                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#e4ebf5] dark:bg-[#111218] border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] focus:outline-none cursor-pointer"
                                                    >
                                                        <option value="Pending">Pending</option>
                                                        <option value="Approved">Approved</option>
                                                        <option value="Rejected">Rejected</option>
                                                    </select>
                                                )}
                                            </div>
                                        ) : (
                                            <StatusBadge
                                                tone={
                                                    request.priority === 'Critical' ? 'rose' :
                                                    request.priority === 'Urgent' ? 'amber' : 'indigo'
                                                }
                                                size="xs"
                                            >
                                                {request.priority} Priority
                                            </StatusBadge>
                                        )}

                                        {linkedPO && (
                                            <StatusBadge tone="pink" icon="fas fa-file-invoice" size="xs">
                                                PO #{linkedPO.po_number} ({linkedPO.status})
                                            </StatusBadge>
                                        )}

                                        {isLocked && (
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 italic">
                                                (Locked: {linkedPO?.status ? `PO ${linkedPO.status}` : request.status})
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <span>
                                            Requested on {request.date || (request.created_at ? new Date(request.created_at).toLocaleDateString() : '—')}
                                        </span>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-3.5 border border-white/80 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                            <User className="h-3.5 w-3.5 text-pink-500" />
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Requester</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{request.requested_by}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">{request.department || 'Warehouse'}</p>
                                    </div>

                                    <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-3.5 border border-white/80 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                            <Building className="h-3.5 w-3.5 text-pink-500" />
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Supplier</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{request.supplier_name || 'Selected Supplier'}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vendor</p>
                                    </div>

                                    <div className="bg-[#f0f3f8] dark:bg-[#1a1b26] rounded-2xl p-3.5 border border-white/80 dark:border-[#2a2b38] shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)]">
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                                            <Tag className="h-3.5 w-3.5 text-pink-500" />
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Amount</span>
                                        </div>
                                        <p className="text-sm font-extrabold text-pink-600 dark:text-pink-400">
                                            ₱{Number(displayData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Estimated Value</p>
                                    </div>
                                </div>

                                {/* Reason / Notes */}
                                <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-3.5 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-1">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        Justification / Reason
                                    </span>
                                    {isEditing ? (
                                        <textarea
                                            value={editForm?.reason || ''}
                                            onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                                            rows={2}
                                            className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)] resize-none"
                                            placeholder="Provide reason for request"
                                        />
                                    ) : (
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                            {request.reason || request.description || 'No detailed reason provided.'}
                                        </p>
                                    )}
                                </div>

                                {/* Line Items */}
                                <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-4 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2.5">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/[0.04]">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-pink-500" />
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                Requested Line Items
                                            </span>
                                        </div>
                                        {isEditing && (
                                            <AppButton type="button" variant="pink" size="xs" onClick={handleAddItem}>
                                                + Add Item
                                            </AppButton>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/40 dark:border-white/[0.03]">
                                                    <th className="py-2 px-2.5">Item Name</th>
                                                    <th className="py-2 px-2.5 text-center w-24">Quantity</th>
                                                    <th className="py-2 px-2.5 text-right w-28">Unit Price</th>
                                                    <th className="py-2 px-2.5 text-right w-28">Total</th>
                                                    {isEditing && <th className="py-2 px-2 text-center w-10"></th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/40 dark:divide-white/[0.03] font-medium">
                                                {isEditing ? (
                                                    (editForm?.items || []).map((item: any, idx: number) => {
                                                        const qty = Number(item.quantity) || 1;
                                                        const price = Number(item.unit_price ?? item.price ?? 0);
                                                        const total = qty * price;
                                                        return (
                                                            <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                                                <td className="py-2 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.name || item.item_name || ''}
                                                                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                                                        placeholder="Item name"
                                                                        className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.quantity || 1}
                                                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                                        className="w-20 text-center bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={item.unit_price ?? item.price ?? 0}
                                                                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                                                        className="w-24 text-right bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-pink-500 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3)]"
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-2.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                                                                    ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2 px-1 text-center">
                                                                    {(editForm?.items || []).length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveItem(idx)}
                                                                            className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                                                            title="Remove item"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    (request.items || []).map((item: any, idx: number) => {
                                                        const qty = Number(item.quantity) || 1;
                                                        const price = Number(item.unit_price ?? item.price ?? 0);
                                                        const total = Number(item.total) > 0 ? Number(item.total) : qty * price;
                                                        return (
                                                            <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                                                <td className="py-2.5 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                                                                    {item.name || item.item_name || 'Inventory Item'}
                                                                </td>
                                                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 dark:text-slate-400">
                                                                    {qty}
                                                                </td>
                                                                <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                                    ₱{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-2.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                                                                    ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Controls */}
                    {request && (
                        <div className="pt-4 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between flex-wrap gap-2.5 shrink-0">
                            <div className="flex items-center gap-2">
                                {canDelete && !isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isDeleting || isPatching}
                                        className="px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/40 shadow-[2px_2px_5px_rgba(166,175,195,0.25)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                    >
                                        {isDeleting ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        <span>Delete Request</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2.5 ml-auto flex-wrap">
                                {/* Approve & Reject Buttons for Admin / Executive on Pending PR */}
                                {canApproveReject && !isEditing && request.status === 'Pending' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleReject}
                                            disabled={isPatching || isSaving}
                                            className="px-3.5 py-2 rounded-2xl text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-[#f0f3f8] dark:bg-[#1a1b26] border border-rose-300 dark:border-rose-900/50 shadow-[2px_2px_5px_rgba(166,175,195,0.25),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isPatching ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                            <span>Reject</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleApprove}
                                            disabled={isPatching || isSaving}
                                            className="px-4 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-[2px_2px_6px_rgba(16,185,129,0.35)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isPatching ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                            <span>Approve PR</span>
                                        </button>
                                    </>
                                )}

                                {canEdit && !isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        disabled={isPatching}
                                        className="px-4 py-2 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-[#f0f3f8] dark:bg-[#1a1b26] border border-indigo-200/80 dark:border-indigo-900/40 shadow-[2px_2px_5px_rgba(166,175,195,0.3),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" />
                                        <span>Edit Request</span>
                                    </button>
                                )}

                                {isEditing ? (
                                    <>
                                        <AppButton
                                            type="button"
                                            variant="neutral"
                                            size="sm"
                                            onClick={() => {
                                                setEditForm(JSON.parse(JSON.stringify(request)));
                                                setIsEditing(false);
                                            }}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </AppButton>
                                        <AppButton
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={handleSaveEdits}
                                            disabled={isSaving}
                                            loading={isSaving}
                                        >
                                            <Check className="h-3.5 w-3.5 mr-1" />
                                            <span>Save Changes</span>
                                        </AppButton>
                                    </>
                                ) : (
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="sm"
                                        onClick={onClose}
                                    >
                                        Close
                                    </AppButton>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Portal>
    );
}
