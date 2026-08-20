// app/(supplyChain)/inventory/components/modals/StockOutModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { InventoryItem } from '../../types';

interface StockOutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStockOut: (itemName: string, quantity: number, department?: string, purpose?: string, remarks?: string) => Promise<void>;
    inventoryItems: InventoryItem[];
    preSelectedItem?: string;
    loading?: boolean;
}

export function StockOutModal({
    isOpen,
    onClose,
    onStockOut,
    inventoryItems,
    preSelectedItem = '',
    loading = false
}: StockOutModalProps) {
    const [formData, setFormData] = useState({
        item: preSelectedItem,
        quantity: 0,
        department: '',
        purpose: '',
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
        if (currentItem && formData.quantity > currentItem.current_stock) {
            toast.error(`Insufficient stock! Available: ${currentItem.current_stock} ${currentItem.unit}`);
            return;
        }
        await onStockOut(formData.item, formData.quantity, formData.department, formData.purpose, formData.remarks);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-ink rounded-2xl max-w-lg w-full p-6 shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-ink/20 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-ink/20">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <i className="fas fa-arrow-up text-base"></i>
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Stock Out</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reduce stock level for this item</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all flex items-center justify-center"
                        disabled={loading}
                    >
                        <i className="fas fa-times text-sm"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-slate-50/80 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-ink/20">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Target Item</span>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                            {formData.item || 'No Item Selected'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-ink/20 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Current Stock</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${!currentItem ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' :
                                    currentItem.current_stock <= 0 ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' :
                                        currentItem.current_stock < currentItem.minimum_stock ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                                            'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                    }`}>
                                    {!currentItem ? 'Unknown' :
                                        currentItem.current_stock <= 0 ? 'Out of Stock' :
                                            currentItem.current_stock < currentItem.minimum_stock ? 'Low Stock' :
                                                'Available'}
                                </span>
                            </div>
                            <div className="text-base font-bold text-slate-900 dark:text-slate-200">
                                {currentItem ? `${currentItem.current_stock} ${currentItem.unit}` : '0'}
                            </div>
                        </div>

                        <div className="bg-orange-50/50 dark:bg-orange-950/20 p-3 rounded-xl border border-orange-100/60 dark:border-orange-800/30 flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-orange-800/70 dark:text-orange-400/80">New Total</span>
                            <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                                {currentItem ? `${Math.max(0, currentItem.current_stock - (formData.quantity || 0))} ${currentItem.unit}` : '0'}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Quantity to Remove <span className="text-orange-500 dark:text-orange-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                max={currentItem?.current_stock || 0}
                                className="w-full bg-white dark:bg-ink/60 border border-slate-200 dark:border-ink/30 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                                placeholder="0"
                                value={formData.quantity || ''}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Department / User
                            </label>
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-ink/60 border border-slate-200 dark:border-ink/30 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                                placeholder="e.g., Warehouse"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Purpose
                            </label>
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-ink/60 border border-slate-200 dark:border-ink/30 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                                placeholder="e.g., Packing"
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Remarks <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                        </label>
                        <textarea
                            className="w-full bg-white dark:bg-ink/60 border border-slate-200 dark:border-ink/30 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all resize-none"
                            rows={2}
                            placeholder="Add any extra notes..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-ink/20">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold bg-white dark:bg-ink border border-slate-200 dark:border-ink/30 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:border-slate-300 dark:hover:border-ink/40 transition-all active:scale-[0.98]"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-xs font-semibold bg-orange-600 dark:bg-orange-600 hover:bg-orange-500 dark:hover:bg-orange-500 text-white rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><i className="fas fa-spinner fa-spin w-3.5 h-3.5"></i> Removing...</>
                            ) : (
                                <><i className="fas fa-check w-3.5 h-3.5"></i> Remove Stock</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}