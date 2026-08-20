
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { sanitizeText } from '@/app/(supplyChain)/components/global/sanitize';
import { EditItemFormData, InventoryItem, Supplier } from '../../types';

interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: EditItemFormData) => Promise<void>;
    item: InventoryItem;
    suppliers: Supplier[];
    loading?: boolean;
}

export function EditItemModal({
    isOpen,
    onClose,
    onSave,
    item,
    suppliers,
    loading = false
}: EditItemModalProps) {
    const [formData, setFormData] = useState<EditItemFormData>({
        id: '',
        item_code: '',
        item_name: '',
        category: '',
        unit: '',
        description: '',
        current_stock: 0,
        minimum_stock: 0,
        storage_location: '',
        supplier: '',
        purchase_price: 0,
        status: 'available'
    });

    // Populate form when item changes
    useEffect(() => {
        if (isOpen && item) {
            setFormData({
                id: item.id,
                item_code: item.item_code,
                item_name: item.item_name,
                category: item.category,
                unit: item.unit,
                description: item.description || '',
                current_stock: item.current_stock,
                minimum_stock: item.minimum_stock,
                storage_location: item.storage_location || '',
                supplier: item.supplier || '',
                purchase_price: item.purchase_price || 0,
                status: item.status || 'available'
            });
        }
    }, [isOpen, item]);

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
            className="fixed inset-0 bg-slate-950/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl dark:shadow-2xl border border-slate-200/90 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <i className="fas fa-pen-to-square text-base"></i>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                                Edit Inventory Item
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Update item attributes, stock levels, and pricing details
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100/80 dark:bg-slate-800/70 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
                        disabled={loading}
                        type="button"
                    >
                        <i className="fas fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-6 space-y-6 flex-1">

                        {/* Basic Details */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-circle-info text-blue-500 dark:text-blue-400"></i>
                                <span>Basic Details</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Item Code <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-hashtag absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                            value={formData.item_code}
                                            onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                                            placeholder="e.g. PKG-001"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Item Name <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-tag absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: sanitizeText(e.target.value) })}
                                            placeholder="e.g. Bubble Wrap Roll"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Category <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-layer-group absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none outline-none cursor-pointer"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            required
                                            disabled={loading}
                                        >
                                            <option value="Packaging Materials" className="dark:bg-slate-900">Packaging Materials</option>
                                            <option value="Warehouse Supplies" className="dark:bg-slate-900">Warehouse Supplies</option>
                                            <option value="Equipment" className="dark:bg-slate-900">Equipment</option>
                                            <option value="Warehouse Equipment" className="dark:bg-slate-900">Warehouse Equipment</option>
                                            <option value="Cleaning Supplies" className="dark:bg-slate-900">Cleaning Supplies</option>
                                            <option value="Office Supplies" className="dark:bg-slate-900">Office Supplies</option>
                                            <option value="Other" className="dark:bg-slate-900">Other</option>
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Unit Measurement <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-ruler-horizontal absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                            value={formData.unit}
                                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            placeholder="e.g. rolls, pcs, boxes"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-800" />

                        {/* Stock Thresholds */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-boxes-stacked text-blue-500 dark:text-blue-400"></i>
                                <span>Stock Thresholds</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/60 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Current Stock <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                        value={formData.current_stock}
                                        onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                                        required
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Minimum Stock Alert Level <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                        value={formData.minimum_stock}
                                        onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-800" />

                        {/* Logistics & Cost */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-truck-ramp-box text-blue-500 dark:text-blue-400"></i>
                                <span>Logistics & Cost</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Storage Location
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                            value={formData.storage_location}
                                            onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                                            placeholder="e.g. Shelf A-04, Zone 2"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Supplier
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-building-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none outline-none cursor-pointer"
                                            value={formData.supplier}
                                            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                            disabled={loading}
                                        >
                                            <option value="" className="dark:bg-slate-900">Select supplier</option>
                                            {suppliers.map((s) => (
                                                <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                            ))}
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Purchase Price
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-semibold pointer-events-none">₱</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                            value={formData.purchase_price}
                                            onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                                            placeholder="0.00"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Notes / Description
                                    </label>
                                    <textarea
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Add optional notes regarding handling, specs, or restock details..."
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin text-xs"></i>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check text-xs"></i>
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}