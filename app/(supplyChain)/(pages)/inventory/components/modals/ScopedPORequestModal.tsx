'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { InventoryItem, Supplier } from '../../types';
import { user } from '../../../../lib/services/Class/user';
import { createScopedPurchaseRequestAction } from '../../server/actions/purchase-request';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

interface ScopedPORequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    suppliers: Supplier[];
    onSuccess?: () => void;
}

export function ScopedPORequestModal({
    isOpen,
    onClose,
    item,
    suppliers,
    onSuccess,
}: ScopedPORequestModalProps) {
    const [quantity, setQuantity] = useState<number>(1);
    const [unitPrice, setUnitPrice] = useState<number>(0);
    const [supplierId, setSupplierId] = useState<string>('');
    const [department, setDepartment] = useState<string>('Warehouse');
    const [priority, setPriority] = useState<string>('Normal');
    const [reason, setReason] = useState<string>('Inventory stock replenishment');
    const [submitting, setSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen && item) {
            // Suggest quantity to bring stock up to minimum stock + buffer
            const suggestedQty = item.minimum_stock > item.current_stock
                ? item.minimum_stock - item.current_stock
                : 10;
            setQuantity(Math.max(1, suggestedQty));
            setUnitPrice(item.purchase_price || 0);
            setReason(`Stock replenishment for ${item.item_name} (${item.item_code})`);

            // Attempt to match supplier
            if (item.supplier && suppliers.length > 0) {
                const matched = suppliers.find(
                    s => s.name.toLowerCase() === item.supplier?.toLowerCase() ||
                        String(s.id) === String(item.supplier)
                );
                if (matched) {
                    setSupplierId(String(matched.id));
                } else if (suppliers.length > 0) {
                    setSupplierId(String(suppliers[0].id));
                }
            } else if (suppliers.length > 0) {
                setSupplierId(String(suppliers[0].id));
            }
        }
    }, [isOpen, item, suppliers]);

    const totalAmount = useMemo(() => {
        return (quantity || 0) * (unitPrice || 0);
    }, [quantity, unitPrice]);

    if (!isOpen || !item) return null;

    const hasPendingPR = Boolean(
        item?.latest_po?.has_pending_pr ||
        (item?.latest_po?.is_request && item?.latest_po?.status === 'Pending')
    );
    const pendingPRNumber = item?.latest_po?.pending_pr_number || (item?.latest_po?.is_request && item?.latest_po?.status === 'Pending' ? item?.latest_po?.po_number : undefined);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (hasPendingPR) {
            toast.error(`A purchase request (${pendingPRNumber || 'Pending'}) is already awaiting approval for this item.`);
            return;
        }

        if (quantity <= 0) {
            toast.warning('Order quantity must be at least 1');
            return;
        }

        if (!supplierId) {
            toast.warning('Please select a supplier');
            return;
        }

        const selectedSupplier = suppliers.find(s => String(s.id) === String(supplierId));

        setSubmitting(true);
        const toastId = toast.loading('Creating Purchase Request...');

        try {
            const res = await createScopedPurchaseRequestAction({
                inventory_item_id: item.id,
                item_name: item.item_name,
                quantity: quantity,
                unit_price: unitPrice,
                supplier_id: supplierId,
                supplier_name: selectedSupplier?.name || 'Selected Supplier',
                requested_by: user.getName() || 'Inventory Officer',
                department: department,
                priority: priority,
                reason: reason,
            });

            if (res.success) {
                toast.success(`Purchase Request ${res.data?.request_number || ''} submitted successfully!`, { id: toastId });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to submit purchase request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error submitting PO request:', err);
            toast.error(err?.message || 'Failed to submit purchase request', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !item) return null;

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
                            <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0">
                                <i className="fas fa-cart-plus text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                                    Order / Purchase Request
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Initiate procurement replenishment for this inventory item
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

                    {/* Form Body */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                        {hasPendingPR && (
                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-600 dark:text-amber-400">
                                <i className="fas fa-exclamation-triangle text-sm mt-0.5 shrink-0"></i>
                                <div className="text-xs">
                                    <span className="font-bold block mb-0.5">Pending Purchase Request Exists</span>
                                    <span>
                                        Purchase Request <strong className="font-mono font-bold">{pendingPRNumber || 'Pending'}</strong> is currently awaiting approval for this item. You cannot create a new request or order until this request is approved or rejected.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Item Snapshot Card */}
                        <div className="p-4 bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-bold text-slate-600 dark:text-slate-300 bg-[#e4ebf5] dark:bg-[#111218] px-2.5 py-1 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                    {item.item_code}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#14151e] text-pink-600 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                    {item.category}
                                </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                {item.item_name}
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Current Stock:</span>
                                    <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                                        {item.current_stock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Minimum Level:</span>
                                    <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">
                                        {item.minimum_stock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Quantity & Unit Price Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Order Quantity <span className="text-pink-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-4 py-2.5 text-sm font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 transition-all font-mono"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                        {item.unit}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Est. Unit Price (₱) <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    required
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-4 py-2.5 text-sm font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 transition-all font-mono"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Total Estimated Cost Banner */}
                        <div className="p-3.5 bg-[#ebf0f7] dark:bg-[#14151e] border border-emerald-300/60 dark:border-emerald-800/40 rounded-2xl shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="fas fa-coins text-emerald-600 dark:text-emerald-400 text-sm"></i>
                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                    Total Estimated Amount:
                                </span>
                            </div>
                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                                ₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        {/* Supplier Selector */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Target Supplier <span className="text-pink-500">*</span>
                            </label>
                            <select
                                required
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 transition-all cursor-pointer appearance-none"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                    backgroundPosition: 'right 0.75rem center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '1.25em 1.25em'
                                }}
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.category})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Department & Priority */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Department
                                </label>
                                <select
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                >
                                    <option value="Warehouse">Warehouse</option>
                                    <option value="Fleet">Fleet</option>
                                    <option value="Logistics">Logistics</option>
                                    <option value="Operations">Operations</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Priority
                                </label>
                                <select
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>
                        </div>

                        {/* Reason / Notes */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Reason / Justification
                            </label>
                            <textarea
                                rows={2}
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                placeholder="Reason for purchase request..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
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
                                variant="primary"
                                size="md"
                                disabled={submitting || hasPendingPR}
                                loading={submitting}
                                title={hasPendingPR ? `Cannot submit: PR ${pendingPRNumber || 'Pending'} is awaiting approval` : undefined}
                            >
                                {!submitting}
                                <span>{hasPendingPR ? 'Pending Request Exists' : 'Submit'}</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
