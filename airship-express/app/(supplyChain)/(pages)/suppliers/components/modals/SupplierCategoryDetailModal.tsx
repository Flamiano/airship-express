// modal component displaying category breakdown and suppliers list when clicking the doughnut chart

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { SelectedChartData, PurchaseOrder } from "../../types";

interface SupplierCategoryDetailModalProps {
    isOpen: boolean;
    chartData: SelectedChartData;
    purchaseOrders: PurchaseOrder[];
    onClose: () => void;
}

export function SupplierCategoryDetailModal({
    isOpen,
    chartData,
    purchaseOrders,
    onClose,
}: SupplierCategoryDetailModalProps) {
    if (!isOpen || !chartData.category) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[99999] bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] w-full max-w-lg max-h-[80vh] flex flex-col border border-white/90 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-6 py-4.5 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] text-pink-500 dark:text-pink-400 flex items-center justify-center shrink-0 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                                <i className="fas fa-tags text-sm" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                    Category Details
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {chartData.category} • {chartData.suppliers?.length || 0} suppliers
                                </p>
                            </div>
                        </div>
                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </AppButton>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Suppliers
                                    </p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                                        {chartData.suppliers?.length || 0}
                                    </p>
                                </div>
                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Active
                                    </p>
                                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {chartData.suppliers?.filter((s) => s.is_active).length || 0}
                                    </p>
                                </div>
                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] text-center">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Inactive
                                    </p>
                                    <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                        {chartData.suppliers?.filter((s) => !s.is_active).length || 0}
                                    </p>
                                </div>
                            </div>

                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                Suppliers in this category
                            </p>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {chartData.suppliers?.map((supplier) => {
                                    const orderCount = purchaseOrders.filter(
                                        (po) => po.supplier_id === supplier.id
                                    ).length;
                                    return (
                                        <div
                                            key={supplier.id}
                                            className="flex items-center justify-between p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                    {supplier.name}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                    {supplier.contact_person} • {supplier.location}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3 shrink-0">
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    {orderCount} orders
                                                </span>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                        supplier.is_active
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20'
                                                    }`}
                                                >
                                                    {supplier.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
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
