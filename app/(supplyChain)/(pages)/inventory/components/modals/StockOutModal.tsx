// app/(supplyChain)/inventory/components/modals/StockOutModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { InventoryItem } from '../../types';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';

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
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
            <div
                className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-lg w-full p-6 border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                            <i className="fas fa-arrow-up text-base"></i>
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Stock Out</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reduce stock level for this item</p>
                        </div>
                    </div>
                    <AppButton
                        type="button"
                        variant="neutral"
                        size="icon-sm"
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Close modal"
                    >
                        <i className="fas fa-times text-xs"></i>
                    </AppButton>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-[#ebf0f7] dark:bg-[#14151e] rounded-2xl p-3.5 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Target Item</span>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
                            {formData.item || 'No Item Selected'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#ebf0f7] dark:bg-[#14151e] p-3.5 rounded-2xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Current Stock</span>
                                <span className={`px-2 py-0.5 rounded-xl text-[10px] font-medium ${!currentItem ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' :
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
                            <div className="text-base font-bold text-slate-900 dark:text-slate-200 font-mono">
                                {currentItem ? `${currentItem.current_stock} ${currentItem.unit}` : '0'}
                            </div>
                        </div>

                        <div className="bg-[#ebf0f7] dark:bg-[#14151e] p-3.5 rounded-2xl border border-orange-200/50 dark:border-orange-800/30 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-orange-800/80 dark:text-orange-400">New Total</span>
                            <div className="text-base font-bold text-orange-600 dark:text-orange-400 font-mono">
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
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-all font-mono"
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
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-all"
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
                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-all"
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
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-all resize-none"
                            rows={2}
                            placeholder="Add any extra notes..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            disabled={loading}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="md"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            type="submit"
                            variant="danger"
                            size="md"
                            disabled={loading}
                            loading={loading}
                        >
                            {!loading && <i className="fas fa-check text-xs"></i>}
                            <span>Remove Stock</span>
                        </AppButton>
                    </div>
                </form>
            </div>
            </div>
        </Portal>
    );
}