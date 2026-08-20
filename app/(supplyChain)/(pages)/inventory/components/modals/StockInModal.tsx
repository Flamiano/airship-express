// app/(supplyChain)/inventory/components/modals/StockInModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { InventoryItem } from '../../types';
import { toast } from "sonner";

interface StockInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStockIn: (itemName: string, quantity: number, supplier?: string, reference?: string, remarks?: string) => Promise<void>;
    inventoryItems: InventoryItem[];
    preSelectedItem?: string;
    loading?: boolean;
}

export function StockInModal({
    isOpen,
    onClose,
    onStockIn,
    inventoryItems,
    preSelectedItem = '',
    loading = false
}: StockInModalProps) {
    const [formData, setFormData] = useState({
        item: preSelectedItem,
        quantity: 0,
        supplier: '',
        reference: '',
        remarks: ''
    });

    useEffect(() => {
        if (isOpen && preSelectedItem) {
            setFormData(prev => ({ ...prev, item: preSelectedItem }));
        }
    }, [isOpen, preSelectedItem]);

    const currentItem = inventoryItems.find(i => i.item_name === formData.item);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.quantity <= 0) {
            toast.warning('Quantity must be greater than 0');
            return;
        }
        await onStockIn(formData.item, formData.quantity, formData.supplier, formData.reference, formData.remarks);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div
                    className="bg-white dark:bg-ink rounded-2xl max-w-lg w-full p-6 shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] border border-slate-200/80 dark:border-ink/20 animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink/20 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs shrink-0">
                                <i className="fas fa-arrow-down text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                    Stock In
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Add stock quantity to existing inventory item
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-all flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
                            disabled={loading}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Target Item <span className="text-pink-500 dark:text-pink-400">*</span>
                            </label>
                            <div className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-sm text-slate-800 dark:text-slate-200 font-semibold">
                                <div className="flex items-center gap-2 truncate">
                                    <i className="fas fa-box text-slate-400 dark:text-slate-500 text-xs shrink-0"></i>
                                    <span className="truncate">{formData.item || "Select Item"}</span>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/50 px-2 py-0.5 rounded-md shrink-0">
                                    Read-only
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Current Stock
                                </label>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            {currentItem ? `${currentItem.current_stock} ${currentItem.unit}` : "0"}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${!currentItem
                                                ? "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                                : currentItem.current_stock <= 0
                                                    ? "bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/30"
                                                    : currentItem.current_stock < currentItem.minimum_stock
                                                        ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30"
                                                        : "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30"
                                                }`}
                                        >
                                            {!currentItem
                                                ? "Unknown"
                                                : currentItem.current_stock <= 0
                                                    ? "Out of Stock"
                                                    : currentItem.current_stock < currentItem.minimum_stock
                                                        ? "Low Stock"
                                                        : "Available"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    New Total <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(auto)</span>
                                </label>
                                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/30 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <i className="fas fa-calculator text-emerald-600 dark:text-emerald-400 text-xs"></i>
                                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                                            {currentItem
                                                ? `${currentItem.current_stock + (formData.quantity || 0)} ${currentItem.unit}`
                                                : "0"}
                                        </span>
                                    </div>
                                    <i className="fas fa-arrow-up-right-dots text-emerald-500 dark:text-emerald-400 text-xs"></i>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Quantity to Add <span className="text-pink-500 dark:text-pink-400">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all font-semibold"
                                    placeholder="Enter quantity to add"
                                    value={formData.quantity || ""}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            quantity: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Supplier <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all"
                                    placeholder="Supplier name"
                                    value={formData.supplier || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, supplier: e.target.value })
                                    }
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Reference No. <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all"
                                    placeholder="e.g., PO-2026-001"
                                    value={formData.reference || ""}
                                    onChange={(e) =>
                                        setFormData({ ...formData, reference: e.target.value })
                                    }
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Remarks <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
                            </label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all resize-none"
                                rows={2}
                                placeholder="Additional notes or shipment context"
                                value={formData.remarks || ""}
                                onChange={(e) =>
                                    setFormData({ ...formData, remarks: e.target.value })
                                }
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-ink/20">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-white dark:bg-ink border border-slate-200/80 dark:border-ink/30 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-ink/40 transition-all active:scale-[0.98] disabled:opacity-50"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-500 dark:hover:bg-emerald-700 text-white rounded-xl transition-all shadow-xs hover:shadow-emerald-600/20 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin text-xs"></i>
                                        <span>Adding Stock...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-plus text-xs"></i>
                                        <span>Confirm Stock In</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}