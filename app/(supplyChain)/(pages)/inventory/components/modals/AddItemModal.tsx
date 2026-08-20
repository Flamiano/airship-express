
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { sanitizeText } from '@/app/(supplyChain)/components/global/sanitize';
import { AddItemFormData, Supplier } from '../../types';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: AddItemFormData) => Promise<void>;
    suppliers: Supplier[];
    loading?: boolean;
}

const initialFormData: AddItemFormData = {
    item_code: '',
    item_name: '',
    category: 'Packaging Materials',
    unit: '',
    status: 'available',
    description: '',
    current_stock: 0,
    minimum_stock: 0,
    storage_location: '',
    supplier: '',
    purchase_price: 0
};

export function AddItemModal({
    isOpen,
    onClose,
    onSave,
    suppliers,
    loading = false
}: AddItemModalProps) {
    const [formData, setFormData] = useState<AddItemFormData>(initialFormData);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.item_code || !formData.item_name || !formData.category || !formData.unit) {
            toast.warning('Please fill in all required fields');
            return;
        }

        await onSave(formData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-ink rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.8),0_8px_10px_-6px_rgba(0,0,0,0.5)] border border-slate-200/80 dark:border-ink/20 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-ink/20 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-800/30 flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-2xs shrink-0">
                            <i className="fas fa-box text-base"></i>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                Add Inventory Item
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Add a new item to the warehouse inventory database
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center justify-center shrink-0"
                        disabled={loading}
                    >
                        <i className="fas fa-xmark text-sm"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto scrollbar-hide">
                    <div className="space-y-3">
                        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <i className="fas fa-circle-info text-[10px] text-pink-500 dark:text-pink-400"></i>
                            <span>Basic Details</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Item Code <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="e.g., TAPE-001"
                                    value={formData.item_code}
                                    onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Item Name <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="e.g., Packing Tape"
                                    value={formData.item_name}
                                    onChange={(e) => setFormData({ ...formData, item_name: sanitizeText(e.target.value) })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Category <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <select
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden appearance-none disabled:opacity-50"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    required
                                    disabled={loading}
                                >
                                    <option value="Packaging Materials">Packaging Materials</option>
                                    <option value="Warehouse Supplies">Warehouse Supplies</option>
                                    <option value="Equipment">Equipment</option>
                                    <option value="Warehouse Equipment">Warehouse Equipment</option>
                                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                                    <option value="Office Supplies">Office Supplies</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Unit of Measure <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="e.g., rolls, pcs, boxes"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <i className="fas fa-cubes text-[10px] text-pink-500 dark:text-pink-400"></i>
                            <span>Stock Levels</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-xl border border-slate-100 dark:border-ink/20">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Current Stock <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-white dark:bg-ink/60 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="0"
                                    value={formData.current_stock}
                                    onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Minimum Stock Alert Threshold <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-white dark:bg-ink/60 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="10"
                                    value={formData.minimum_stock}
                                    onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <i className="fas fa-truck-ramp-box text-[10px] text-pink-500 dark:text-pink-400"></i>
                            <span>Storage & Vendor</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Storage Location
                                </label>
                                <input
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                    placeholder="e.g., Aisle 3, Rack B, Shelf 2"
                                    value={formData.storage_location}
                                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Supplier
                                </label>
                                <select
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden appearance-none disabled:opacity-50"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                    value={formData.supplier}
                                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                    disabled={loading}
                                >
                                    <option value="">Select supplier</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Unit Purchase Price
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-medium text-xs sm:text-sm">
                                        ₱
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl pl-8 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden disabled:opacity-50"
                                        placeholder="0.00"
                                        value={formData.purchase_price}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Description / Notes
                                </label>
                                <textarea
                                    className="w-full bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200/80 dark:border-ink/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-ink/60 focus:border-pink-500 focus:ring-3 focus:ring-pink-500/10 transition-all outline-hidden resize-none disabled:opacity-50"
                                    rows={2}
                                    placeholder="Brief description or handling notes for this item..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-ink/20">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 rounded-xl transition-all border border-transparent disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-pink-500 dark:bg-pink-600 hover:bg-pink-600 dark:hover:bg-pink-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs hover:shadow-pink-500/20 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin text-xs"></i>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check text-xs"></i>
                                    <span>Save Item</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>);
}