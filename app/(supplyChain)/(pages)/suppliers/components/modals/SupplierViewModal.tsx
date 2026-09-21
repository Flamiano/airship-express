// modal component displaying detailed profile and history for a single supplier

"use client";

import React from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { Supplier, PurchaseOrder } from "../../types";
import { getStatusBadge, getPaidBadge } from "../../utils/formatters";

interface SupplierViewModalProps {
    isOpen: boolean;
    supplier: Supplier | null;
    purchaseOrders: PurchaseOrder[];
    onClose: () => void;
    onEdit: (supplier: Supplier) => void;
    onDelete: (id: number, name: string) => void;
}

export function SupplierViewModal({
    isOpen,
    supplier,
    purchaseOrders,
    onClose,
    onEdit,
    onDelete,
}: SupplierViewModalProps) {
    if (!isOpen || !supplier) return null;

    const supplierOrders = purchaseOrders.filter((po) => po.supplier_id === supplier.id);

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
                                <i className="fas fa-building text-sm" />
                            </span>
                            <div>
                                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                        {supplier.name}
                                    </h2>
                                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-[#ebf0f7] dark:bg-[#14151e] text-pink-600 dark:text-pink-400 font-bold border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]">
                                        SUP-{String(supplier.id).padStart(3, '0')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <span>Category:</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                        {supplier.category || 'General'}
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
                                    <i className="fas fa-user text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Contact Person
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {supplier.contact_person || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-phone text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Phone Number
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                        {supplier.phone || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-envelope text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Email Address
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate font-mono">
                                        {supplier.email || '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fas fa-map-marker-alt text-xs" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Location
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {supplier.location || '—'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {supplier.fb_link && (
                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#f0f3f8] dark:bg-[#191a24] flex items-center justify-center shrink-0 text-pink-500 dark:text-pink-400 border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <i className="fab fa-facebook text-xs" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                                        Facebook / Social
                                    </span>
                                    <a
                                        href={supplier.fb_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs sm:text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline truncate block"
                                    >
                                        {supplier.fb_link}
                                    </a>
                                </div>
                            </div>
                        )}

                        {supplier.products && (
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Products & Services
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {supplier.products.split(',').map((product: string, idx: number) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 bg-[#ebf0f7] dark:bg-[#14151e] text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)] rounded-xl text-xs font-semibold"
                                        >
                                            {product.trim()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {supplier.notes && (
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Internal Notes
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 bg-[#ebf0f7] dark:bg-[#14151e] p-3.5 rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.55)] leading-relaxed whitespace-pre-wrap">
                                    {supplier.notes}
                                </p>
                            </div>
                        )}

                        {supplierOrders.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                        Recent Purchase Orders
                                    </h3>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        Showing last 5
                                    </span>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {supplierOrders.slice(0, 5).map((po) => (
                                        <div
                                            key={po.id}
                                            className="flex items-center justify-between bg-[#ebf0f7] dark:bg-[#14151e] px-4 py-2.5 rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.25)]"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {po.po_number}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3.5">
                                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                                    ₱{po.total_amount?.toLocaleString() || '0'}
                                                </span>
                                                <div>{getStatusBadge(po.status)}</div>
                                                <div>{getPaidBadge(po.paid || false)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/50 dark:bg-[#14151e]/50 flex items-center justify-between">
                        <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => onDelete(supplier.id, supplier.name)}
                        >
                            Delete Supplier
                        </AppButton>

                        <div className="flex items-center gap-2">
                            <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                                Close
                            </AppButton>
                            <AppButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    onEdit(supplier);
                                    onClose();
                                }}
                            >
                                Edit Supplier
                            </AppButton>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
