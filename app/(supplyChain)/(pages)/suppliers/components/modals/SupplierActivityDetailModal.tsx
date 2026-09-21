// modal component displaying activity metrics when clicking a supplier in the activity bar chart

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { SelectedChartData, PurchaseOrder } from "../../types";
import { getStatusBadge, getPaidBadge } from "../../utils/formatters";

interface SupplierActivityDetailModalProps {
    isOpen: boolean;
    chartData: SelectedChartData;
    purchaseOrders: PurchaseOrder[];
    onClose: () => void;
}

export function SupplierActivityDetailModal({
    isOpen,
    chartData,
    purchaseOrders,
    onClose,
}: SupplierActivityDetailModalProps) {
    if (!isOpen || !chartData.supplierName) return null;

    const filteredOrders = purchaseOrders.filter(
        (po) => po.supplier_name === chartData.supplierName
    );

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-md max-h-[80vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-chart-bar text-sm" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Supplier Details
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {chartData.supplierName}
                                </p>
                            </div>
                        </div>
                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-center">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Total Orders
                                </p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {chartData.orderCount || 0}
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-center">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Total Paid
                                </p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                    ₱{(chartData.totalSpent || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)]">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                                Recent Orders
                            </p>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {filteredOrders.slice(0, 5).map((po) => (
                                    <div
                                        key={po.id}
                                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-white/[0.06] shadow-[1px_1px_3px_rgba(166,175,195,0.25)]"
                                    >
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {po.po_number}
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            ₱{po.total_amount?.toLocaleString() || '0'}
                                        </span>
                                        <div>{getStatusBadge(po.status)}</div>
                                        <div>{getPaidBadge(po.paid || false)}</div>
                                    </div>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                                        No orders found for this supplier
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex justify-end">
                        <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                            Close
                        </AppButton>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
