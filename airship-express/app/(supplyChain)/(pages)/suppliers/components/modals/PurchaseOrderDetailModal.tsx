// modal component for viewing complete purchase order details and line items

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { PurchaseOrder } from "../../types";
import { getStatusBadge, getPaidBadge } from "../../utils/formatters";

interface PurchaseOrderDetailModalProps {
    isOpen: boolean;
    purchaseOrder: PurchaseOrder | null;
    onClose: () => void;
}

export function PurchaseOrderDetailModal({
    isOpen,
    purchaseOrder,
    onClose,
}: PurchaseOrderDetailModalProps) {
    if (!isOpen || !purchaseOrder) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-start justify-between bg-[#ebf0f7]/50 dark:bg-[#14151e]/50">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-file-invoice text-sm" />
                            </span>
                            <div>
                                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                        Purchase Order
                                    </h2>
                                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151e] text-pink-600 dark:text-pink-400 font-bold border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        {purchaseOrder.po_number}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <span>Supplier:</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                        {purchaseOrder.supplier_name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-building text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Supplier
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {purchaseOrder.supplier_name}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-dollar-sign text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Total Amount
                                    </span>
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
                                        ₱{purchaseOrder.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-calendar-alt text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Date Created
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {new Date(purchaseOrder.created_at).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-truck text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Delivery Date
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {purchaseOrder.delivery_date
                                            ? new Date(purchaseOrder.delivery_date).toLocaleDateString(undefined, {
                                                  year: 'numeric',
                                                  month: 'long',
                                                  day: 'numeric',
                                              })
                                            : 'Not set'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-tag text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Status
                                    </span>
                                    <div>{getStatusBadge(purchaseOrder.status)}</div>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-credit-card text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Payment Status
                                    </span>
                                    <div>{getPaidBadge(purchaseOrder.paid || false)}</div>
                                </div>
                            </div>
                        </div>

                        {purchaseOrder.notes && (
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Order Notes
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] p-3.5 rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] leading-relaxed whitespace-pre-wrap">
                                    {purchaseOrder.notes}
                                </p>
                            </div>
                        )}

                        {purchaseOrder.items && purchaseOrder.items.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                        Order Items
                                    </h3>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        {purchaseOrder.items.length} items
                                    </span>
                                </div>

                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {purchaseOrder.items.map((item: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between bg-[#ebf0f7] dark:bg-[#14151e] px-4 py-2.5 rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {item.name || `Item ${idx + 1}`}
                                                </span>
                                                {item.quantity && (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        × {item.quantity}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3.5">
                                                {item.price && (
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 font-mono">
                                                        @₱{item.price.toLocaleString()}
                                                    </span>
                                                )}
                                                {item.total && (
                                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                                        ₱{item.total.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex items-center justify-end">
                        <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                            Close
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
