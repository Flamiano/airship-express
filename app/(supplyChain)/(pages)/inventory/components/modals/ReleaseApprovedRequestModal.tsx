'use client';

import { useState, useEffect } from 'react';
import { InventoryRequest } from '../../types';
import { toast } from 'sonner';
import { user } from '../../../../lib/services/Class/user';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { fulfillInventoryRequest } from '../../server/query';
import { ArrowUpRight, CheckCircle2, ShieldCheck, AlertCircle, Package } from 'lucide-react';

interface ReleaseApprovedRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    request: InventoryRequest | null;
}

export function ReleaseApprovedRequestModal({
    isOpen,
    onClose,
    onSuccess,
    request,
}: ReleaseApprovedRequestModalProps) {
    const [releaseQuantity, setReleaseQuantity] = useState<number>(1);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const currentUserRole = user.getRole() || 'Staff';
    const currentUserName = user.getName() || user.getEmail() || 'Warehouse Staff';

    const maxApprovedQty = request ? Number(request.quantity_requested || 1) : 1;

    useEffect(() => {
        if (isOpen && request) {
            setReleaseQuantity(maxApprovedQty);
        }
    }, [isOpen, request, maxApprovedQty]);

    if (!isOpen || !request) return null;

    const handleRelease = async (e: React.FormEvent) => {
        e.preventDefault();
        if (releaseQuantity <= 0) {
            toast.error('Release quantity must be greater than 0');
            return;
        }

        if (releaseQuantity > maxApprovedQty) {
            toast.error(`Cannot release more than the approved amount (${maxApprovedQty} units)`);
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading(`Releasing ${releaseQuantity} units for #${request.request_number}...`);

        try {
            const res = await fulfillInventoryRequest(
                request.id,
                `${currentUserName} (${currentUserRole})`,
                releaseQuantity
            );

            if (res.success) {
                toast.success(res.message || 'Stock released and deducted from inventory!', { 
                    id: toastId,
                    duration: 5000,
                });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to release stock', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error releasing approved request stock:', err);
            toast.error(err?.message || 'Failed to release stock', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-lg bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] overflow-hidden transition-all my-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    Release Approved Stock
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                        Approved
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Stock Out for Request #{request.request_number || (request.id ? request.id.slice(0, 8) : '')}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-[#ebf0f7] dark:bg-[#1b1c28] shadow-inner transition-colors cursor-pointer"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>

                    <form onSubmit={handleRelease} className="p-5 sm:p-6 space-y-4">
                        {/* Request Summary Card */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                <span className="text-slate-500 dark:text-slate-400">Item to Release</span>
                                <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-pink-500" />
                                    {request.item_name}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                                <span className="text-slate-500 dark:text-slate-400">Requester / Dept</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {request.requested_by || 'Staff'} ({request.department || request.requester_system || 'General'})
                                </span>
                            </div>
                            <div className="flex items-center justify-between pt-0.5 font-mono">
                                <span className="text-slate-500 dark:text-slate-400 font-sans">Approved Limit</span>
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                                    {maxApprovedQty} units max
                                </span>
                            </div>
                        </div>

                        {/* Release Quantity Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Quantity to Out / Release <span className="text-pink-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    max={maxApprovedQty}
                                    value={releaseQuantity}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setReleaseQuantity(Math.min(maxApprovedQty, Math.max(1, val)));
                                    }}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                    required
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                    Max: {maxApprovedQty}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                Managers can release up to the approved quantity of <strong>{maxApprovedQty}</strong> units.
                            </p>
                        </div>

                        {/* Role Authorization Notice */}
                        <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="font-bold">Authorized Stock Deduction</p>
                                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                                    Submitting this will deduct <strong>{releaseQuantity} units</strong> directly from warehouse stock and mark this requisition as <strong>Received / Fulfilled</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-3">
                            <AppButton type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                                Cancel
                            </AppButton>
                            <AppButton type="submit" variant="primary" size="md" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin text-xs mr-1" />
                                        <span>Releasing...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-arrow-up-right-from-square text-xs mr-1" />
                                        <span>Confirm Stock Out ({releaseQuantity})</span>
                                    </>
                                )}
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
