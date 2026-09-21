'use client';

import { useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../../types';
import { toast } from "sonner";
import { user } from '../../../../lib/services/Class/user';
import { stockInItemAction } from '../../server/actions/stock-in';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

interface StockInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStockIn?: (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => Promise<void>;
    onSuccess?: () => void;
    inventoryItems: InventoryItem[];
    preSelectedItem?: string;
    targetItem?: InventoryItem | null;
    loading?: boolean;
}

export function StockInModal({
    isOpen,
    onClose,
    onStockIn,
    onSuccess,
    inventoryItems,
    preSelectedItem = '',
    targetItem = null,
    loading = false,
}: StockInModalProps) {
    const currentItem = useMemo(() => {
        if (targetItem) return targetItem;
        return inventoryItems.find(i => i.item_name === preSelectedItem) || null;
    }, [targetItem, inventoryItems, preSelectedItem]);

    const latestPo = currentItem?.latest_po || null;
    const isPoDelivered = latestPo?.status === 'Delivered';

    const orderedQty = latestPo?.quantity_ordered || 0;
    const receivedQty = latestPo?.quantity_received || 0;
    const remainingQty = isPoDelivered ? Math.max(0, orderedQty - receivedQty) : 0;

    const [quantity, setQuantity] = useState<number>(1);
    const [supplier, setSupplier] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [remarks, setRemarks] = useState<string>('');

    const [isForced, setIsForced] = useState<boolean>(false);
    const [forceReason, setForceReason] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    const currentUserRole = user.getRole();
    const normalizedRole = (currentUserRole || '').toLowerCase().trim();
    const isAdmin = ['admin', 'super_admin', 'superadmin'].includes(normalizedRole) || currentUserRole === 'Admin';
    const isExecutive = ['executive'].includes(normalizedRole) || currentUserRole === 'Executive';
    const canForce = isAdmin || isExecutive;
    const isManager = ['manager'].includes(normalizedRole) || currentUserRole === 'Manager';
    const isAdminOrManager = isAdmin || isManager || isExecutive;

    useEffect(() => {
        if (isOpen && currentItem) {
            const initialQty = remainingQty > 0 ? remainingQty : 1;
            setQuantity(initialQty);
            setSupplier(latestPo?.supplier_name || currentItem.supplier || '');
            setReference(latestPo?.po_number || '');
            setRemarks('');
            setIsForced(false);
            setForceReason('');
        }
    }, [isOpen, currentItem, remainingQty, latestPo]);

    const exceedsLimit = isPoDelivered && (quantity > remainingQty);
    const diffExceeded = exceedsLimit ? quantity - remainingQty : 0;
    const isMissingDeliveredPo = !isPoDelivered;

    const cannotSubmit = (exceedsLimit || isMissingDeliveredPo) && (!canForce || !isForced || (isForced && !forceReason.trim()));

    const projectedStock = useMemo(() => {
        const base = currentItem?.current_stock ?? 0;
        const add = Math.max(0, quantity || 0);
        return base + add;
    }, [currentItem, quantity]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (quantity <= 0) {
            toast.warning('Quantity must be greater than 0');
            return;
        }

        if (!currentItem) {
            toast.error('No inventory item selected');
            return;
        }

        if (cannotSubmit) {
            if (isMissingDeliveredPo && !canForce) {
                toast.error('Stock-in requires a Delivered Purchase Order. Administrator or Executive authorization is required.');
            } else if (exceedsLimit && !canForce) {
                toast.error(`Quantity exceeds delivered remainder by ${diffExceeded}. Administrator or Executive approval needed.`);
            } else if (isForced && !forceReason.trim()) {
                toast.warning('Please enter a reason for the override.');
            }
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading(`Adding ${quantity} ${currentItem.unit} to stock...`);

        try {
            const res = await stockInItemAction({
                inventory_item_id: currentItem.id,
                poi_id: latestPo?.poi_id || null,
                quantity: quantity,
                force: isForced,
                force_reason: forceReason,
                userId: user.getUserId() || null,
                userRole: currentUserRole,
                supplier: supplier,
                reference: reference || latestPo?.po_number || undefined,
                remarks: remarks,
            });

            if (res.success) {
                toast.success(`Successfully added ${quantity} ${currentItem.unit} to ${currentItem.item_name}!`, { id: toastId });
                onSuccess?.();
                if (onStockIn) {
                    await onStockIn(currentItem.item_name, quantity, supplier, reference, remarks);
                }
                onClose();
            } else {
                toast.error(res.error || 'Failed to stock in item', { id: toastId });
            }
        } catch (err: any) {
            console.error('Stock in error:', err);
            toast.error(err?.message || 'Failed to process stock in', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-lg w-full p-6  dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <i className="fas fa-arrow-down text-sm"></i>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                                Receive Stock-In
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Log received quantities and update current stock balance
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
                        <i className="fas fa-times text-xs"></i>
                    </AppButton>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    {/* Item Snapshot Card */}
                    <div className="p-4 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-300 bg-[#e4ebf5] dark:bg-[#111218] px-2.5 py-1 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                {currentItem?.item_code || '---'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#14151e] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                {currentItem?.category || 'General'}
                            </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {currentItem?.item_name || 'Select Item'}
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Current Stock:</span>
                                <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                                    {currentItem?.current_stock ?? 0} <span className="text-[10px] font-normal text-slate-400">{currentItem?.unit || 'units'}</span>
                                </strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Minimum Alert:</span>
                                <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                                    {currentItem?.minimum_stock ?? 0} <span className="text-[10px] font-normal text-slate-400">{currentItem?.unit || 'units'}</span>
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* PO Link Status Card */}
                    {latestPo && (
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2.5 text-xs transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                                    <i className="fas fa-file-invoice text-pink-500"></i>
                                    <span>Linked PO: <code className="font-mono text-pink-600 dark:text-pink-400 font-bold">{latestPo.po_number || latestPo.request_number}</code></span>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold border ${
                                    isPoDelivered
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                }`}>
                                    {latestPo.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06] text-[11px]">
                                <div>
                                    <span className="text-slate-400 block">Ordered:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{orderedQty}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block">Received:</span>
                                    <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs">{receivedQty}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block">Remaining:</span>
                                    <strong className="text-pink-600 dark:text-pink-400 font-mono font-extrabold text-xs">{remainingQty}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quantity to Add & Live Stock Preview */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Quantity to Receive <span className="text-pink-500">*</span>
                            </label>
                            {isPoDelivered && (
                                <button
                                    type="button"
                                    onClick={() => setQuantity(remainingQty)}
                                    className="text-[11px] text-pink-600 hover:text-pink-700 dark:text-pink-400 font-bold cursor-pointer"
                                >
                                    Fill Max Remaining ({remainingQty})
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                required
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-4 py-2.5 text-sm font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 transition-all font-mono"
                                placeholder="Enter quantity"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                {currentItem?.unit || 'units'}
                            </span>
                        </div>

                        {/* Stock Balance Projection Preview */}
                        <div className="mt-2 p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                Projected Stock Balance:
                            </span>
                            <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-slate-400">{currentItem?.current_stock ?? 0}</span>
                                <span className="text-emerald-500 font-bold">+{quantity || 0}</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-extrabold text-slate-900 dark:text-white text-sm bg-[#e4ebf5] dark:bg-[#111218] px-2 py-0.5 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                    {projectedStock} {currentItem?.unit}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Inline Warning: Exceeds delivered quantity */}
                    {exceedsLimit && (
                        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
                            <i className="fas fa-triangle-exclamation text-amber-500 text-sm shrink-0 mt-0.5"></i>
                            <div>
                                <p className="font-bold">
                                    Exceeds delivered quantity on PO #{latestPo?.po_number} by {diffExceeded} {currentItem?.unit}.
                                </p>
                                <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                                    Delivered remainder is {remainingQty}. Standard stock-in cannot exceed delivered lines without authorization.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Warning if PO is not delivered */}
                    {isMissingDeliveredPo && (
                        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-700 dark:text-rose-300">
                            <i className="fas fa-circle-exclamation text-rose-500 text-sm shrink-0 mt-0.5"></i>
                            <div>
                                <p className="font-bold">
                                    No delivered Purchase Order found for this item.
                                </p>
                                <p className="text-[11px] text-rose-700/80 dark:text-rose-400 mt-0.5">
                                    Stock-in requires a confirmed & delivered PO. Administrator or Executive override is required to force.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Force Stock In for Admin/Executive/Manager */}
                    {(exceedsLimit || isMissingDeliveredPo) && (
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <label className={`flex items-center gap-2.5 select-none ${canForce ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                                    <input
                                        type="checkbox"
                                        checked={canForce && isForced}
                                        disabled={!canForce}
                                        onChange={(e) => canForce && setIsForced(e.target.checked)}
                                        className="w-4 h-4 rounded text-pink-600 accent-pink-600 focus:ring-pink-500 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <i className="fas fa-shield-halved text-pink-500"></i>
                                        Force Stock In (Admin / Executive Override)
                                    </span>
                                </label>
                                {canForce ? (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {isAdmin ? 'Admin Authorized' : 'Executive Authorized'}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                        <i className="fas fa-lock text-[9px]"></i> Admin / Executive Only
                                    </span>
                                )}
                            </div>

                            {!canForce && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-400/90 flex items-center gap-1.5 px-1 font-medium">
                                    <i className="fas fa-circle-info text-amber-500 text-xs shrink-0"></i>
                                    <span>Force stock-in override is restricted to Administrator and Executive roles (disabled for Manager role).</span>
                                </p>
                            )}

                            {canForce && isForced && (
                                <div className="space-y-1.5 pt-1 animate-in fade-in">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Override Justification / Reason <span className="text-pink-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Authorized supplier buffer replacement, direct store-in"
                                        className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                                        value={forceReason}
                                        onChange={(e) => setForceReason(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Supplier & Reference Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Supplier
                            </label>
                            <input
                                type="text"
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                                placeholder="Supplier name"
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Reference No.
                            </label>
                            <input
                                type="text"
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500"
                                placeholder="e.g. PO-2026-001"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Remarks / Batch Notes
                        </label>
                        <textarea
                            rows={2}
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 resize-none"
                            placeholder="Additional stock-in details or batch notes..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            type="submit"
                            variant="success"
                            size="md"
                            disabled={submitting || cannotSubmit}
                            loading={submitting}
                            title={
                                cannotSubmit && !canForce
                                    ? 'Stock-in requires Administrator or Executive override when exceeding delivered quantity or without a delivered PO.'
                                    : undefined
                            }
                        >
                            {!submitting && <i className={`fas ${cannotSubmit && !canForce ? 'fa-lock' : 'fa-plus'} text-xs`}></i>}
                            <span>{cannotSubmit && !canForce ? 'Stock In Disabled (Admin / Executive Only)' : 'Confirm Stock In'}</span>
                        </AppButton>
                    </div>
                </form>
            </div>
        </div>
    </Portal>
);
}