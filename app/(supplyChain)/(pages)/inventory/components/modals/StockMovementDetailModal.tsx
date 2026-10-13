// app/(supplyChain)/(pages)/inventory/components/modals/StockMovementDetailModal.tsx
'use client';

import React from 'react';
import { StockMovement } from '../../types';
import Portal from '../../../../components/client/Portal';
import { AppButton } from '../../../../components/ui/AppButton';
import { 
    X, 
    Calendar, 
    Tag, 
    Package, 
    ArrowRight, 
    User, 
    Building2, 
    FileText, 
    Hash, 
    Clock, 
    ArrowDownLeft, 
    ArrowUpRight, 
    SlidersHorizontal,
    Store
} from 'lucide-react';

function formatMetadataAction(action?: string): string {
    if (!action) return '';
    return action
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StockMovementDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    movement: StockMovement | null;
}

export function StockMovementDetailModal({
    isOpen,
    onClose,
    movement,
}: StockMovementDetailModalProps) {
    if (!isOpen || !movement) return null;

    const formattedDate = new Date(movement.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

    const isStockIn = movement.movement_type === 'Stock In';
    const isStockOut = movement.movement_type === 'Stock Out';
    const isAdjustment = movement.movement_type === 'Adjustment';

    const qtyNumber = movement.quantity;
    const formattedQty = isStockIn
        ? `+${Math.abs(qtyNumber)}`
        : isStockOut
        ? `-${Math.abs(qtyNumber)}`
        : qtyNumber > 0
        ? `+${qtyNumber}`
        : `${qtyNumber}`;

    const hasMetadata = Boolean(movement.metadata && typeof movement.metadata === 'object' && Object.keys(movement.metadata).length > 0);

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-lg bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-none overflow-hidden transition-all my-auto max-h-[92vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200/70 dark:border-white/[0.08] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner ${
                                isStockIn
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : isStockOut
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                                {isStockIn && <ArrowDownLeft className="w-5 h-5 stroke-[2]" />}
                                {isStockOut && <ArrowUpRight className="w-5 h-5 stroke-[2]" />}
                                {isAdjustment && <SlidersHorizontal className="w-5 h-5 stroke-[2]" />}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                    Movement Details
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Audit record for inventory transaction
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-slate-200/50 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
                        {/* Status / Type Header Card */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Movement Type
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                                        isStockIn
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : isStockOut
                                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            isStockIn ? 'bg-emerald-500' : isStockOut ? 'bg-rose-500' : 'bg-amber-500'
                                        }`} />
                                        {movement.movement_type}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right space-y-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Quantity Changed
                                </span>
                                <div className={`text-xl font-extrabold font-mono ${
                                    isStockIn
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : isStockOut
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                    {formattedQty}
                                </div>
                            </div>
                        </div>

                        {/* Stock Balance Transition */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                                Inventory Level Transition
                            </span>
                            <div className="flex items-center justify-between gap-3 text-center">
                                <div className="flex-1 p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Previous Stock</span>
                                    <span className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                                        {movement.previous_stock.toLocaleString()}
                                    </span>
                                </div>

                                <div className="text-slate-400 dark:text-slate-500 flex items-center justify-center">
                                    <ArrowRight className="w-4 h-4 stroke-[2]" />
                                </div>

                                <div className="flex-1 p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">New Stock</span>
                                    <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                                        {movement.new_stock.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Detail Items Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Item Information */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <Package className="w-3.5 h-3.5" />
                                    <span>Item</span>
                                </div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                    {movement.item_name}
                                </div>
                                <div className="text-[11px] font-mono text-pink-600 dark:text-pink-400 font-medium">
                                    {movement.item_code}
                                </div>
                                {movement.item_id && (
                                    <div className="text-[10px] font-mono text-slate-400 truncate" title={String(movement.item_id)}>
                                        ID: {String(movement.item_id)}
                                    </div>
                                )}
                            </div>

                            {/* Reference Number */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <Hash className="w-3.5 h-3.5" />
                                    <span>Reference Number</span>
                                </div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                                    {movement.reference_number || movement.reference || 'N/A'}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    {isStockIn ? 'Purchase Order Ref' : isStockOut ? 'Item Request Ref' : 'Adjustment Ref'}
                                </div>
                            </div>

                            {/* Performed By */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <User className="w-3.5 h-3.5" />
                                    <span>Performed By</span>
                                </div>
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                    {movement.performed_by || 'Warehouse Staff'}
                                </div>
                                {movement.performed_by_id && (
                                    <div className="text-[10px] font-mono text-slate-400 truncate" title={movement.performed_by_id}>
                                        User ID: {movement.performed_by_id}
                                    </div>
                                )}
                            </div>

                            {/* Department */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Department</span>
                                </div>
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                    {movement.department || 'Warehouse & Operations'}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    Source / Destination
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>Date & Time</span>
                                </div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                    {formattedDate}
                                </div>
                            </div>

                            {/* Movement ID */}
                            <div className="p-3 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                    <Tag className="w-3.5 h-3.5" />
                                    <span>Movement ID</span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all select-all">
                                    {movement.id}
                                </div>
                            </div>
                        </div>

                        {/* Reason / Notes */}
                        <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05] space-y-1.5">
                            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-semibold">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Reason / Operational Notes</span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                {movement.reason || movement.notes || 'Standard inventory change procedure'}
                            </p>
                        </div>

                        {/* Additional Attributes Card (Metadata) */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-2.5">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                <Store className="w-3.5 h-3.5 text-pink-500" />
                                <span>Additional Attributes</span>
                            </div>

                            {hasMetadata ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {movement.metadata?.supplier && (
                                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Supplier</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{movement.metadata.supplier}</span>
                                        </div>
                                    )}
                                    {movement.metadata?.action && (
                                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Action Performed</span>
                                            <span className="font-bold text-pink-600 dark:text-pink-400">{formatMetadataAction(movement.metadata.action)}</span>
                                        </div>
                                    )}
                                    {movement.metadata?.is_new_item !== undefined && (
                                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Item Status</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {movement.metadata.is_new_item ? 'New Item Added to Catalog' : 'Existing Item Restocked'}
                                            </span>
                                        </div>
                                    )}
                                    {movement.metadata?.approved_quantity !== undefined && (
                                        <div className="p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Fulfillment</span>
                                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                                {movement.metadata.approved_quantity} / {movement.metadata.requested_quantity || '?'} Approved Units
                                            </span>
                                        </div>
                                    )}
                                    {Object.entries(movement.metadata || {})
                                        .filter(([k]) => !['supplier', 'action', 'is_new_item', 'approved_quantity', 'requested_quantity'].includes(k))
                                        .map(([k, v]) => (
                                            <div key={k} className="p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block capitalize">{k.replace(/_/g, ' ')}</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate block">{String(v)}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                                    No additional attributes recorded for this transaction.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 flex justify-end">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                        >
                            <span>Close Details</span>
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
