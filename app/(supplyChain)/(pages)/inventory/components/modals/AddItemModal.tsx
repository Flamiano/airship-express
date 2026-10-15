'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { sanitizeText } from '../../../../components/global/sanitize';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { supabase } from '../../../../lib/services/client/supabase';
import { SearchableDropdown, SearchableDropdownOption } from '../../../../components/ui/SearchableDropdown';

export interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: any) => Promise<void>;
    suppliers?: Array<{ id: string | number; name: string }>;
    loading?: boolean;
}

const STANDARD_CATEGORIES = [
    'Packaging Materials',
    'Office Supplies & Stationery',
    'Warehouse Supplies',
    'Warehouse Equipment',
    'Equipment & Machinery',
    'Cleaning & Janitorial Supplies',
    'Safety Equipment & PPE',
    'IT & Computer Hardware',
    'Electronics & Gadgets',
    'Hardware & Maintenance Tools',
    'Logistics & Fleet Consumables',
    'Raw Materials & Chemicals',
    'Printing & Signage Media',
    'Furniture & Fixtures',
    'Electrical & Power Supplies',
    'Medical & First Aid Supplies',
    'Pantry & Breakroom Supplies',
    'General Commercial Supplies'
];

export function AddItemModal({
    isOpen,
    onClose,
    onSave,
    suppliers = [],
    loading = false
}: AddItemModalProps) {
    const [localSuppliers, setLocalSuppliers] = useState<Array<{ id: string | number; name: string }>>(suppliers);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryText, setCustomCategoryText] = useState('');

    const [formData, setFormData] = useState({
        item_code: '',
        item_name: '',
        category: 'Packaging Materials',
        unit: 'pcs',
        current_stock: 0,
        minimum_stock: 10,
        storage_location: '',
        supplier: '',
        purchase_price: '' as number | string,
        description: '',
        status: 'In Stock'
    });

    useEffect(() => {
        if (suppliers && suppliers.length > 0) {
            const activeOnly = suppliers.filter((s: any) => s.is_active !== false && s.is_active !== 0 && s.is_active !== 'false');
            setLocalSuppliers(activeOnly);
        }
    }, [suppliers]);

    // Fetch active suppliers & unique supplier categories
    useEffect(() => {
        if (isOpen) {
            let isMounted = true;
            setIsLoadingSuppliers(true);

            const loadData = async () => {
                try {
                    const { data: suppData, error: suppErr } = await supabase
                        .from('suppliers')
                        .select('id, name, category, is_active, status')
                        .order('name');

                    if (isMounted && !suppErr && suppData && suppData.length > 0) {
                        const activeSupps = suppData.filter((s: any) => s.is_active !== false && s.status !== 'inactive');
                        setLocalSuppliers(activeSupps);

                        const activeCats = Array.from(
                            new Set(
                                activeSupps
                                    .map((s: any) => (typeof s.category === 'string' ? s.category.trim() : ''))
                                    .filter(Boolean)
                            )
                        ).sort();
                        setSupplierCategories(activeCats);
                    }
                } catch (err) {
                    console.error('Error fetching suppliers/categories:', err);
                } finally {
                    if (isMounted) {
                        setIsLoadingSuppliers(false);
                    }
                }
            };

            loadData();

            return () => {
                isMounted = false;
            };
        }
    }, [isOpen]);

    // Format options for SearchableDropdown (Custom Design)
    const categoryOptions: SearchableDropdownOption[] = useMemo(() => {
        const activeSet = new Set(supplierCategories.map(c => c.toLowerCase().trim()));

        const combined = Array.from(
            new Set([
                ...supplierCategories,
                ...STANDARD_CATEGORIES,
            ])
        ).filter(
            cat => cat.toLowerCase().trim() !== 'others' && cat.toLowerCase().trim() !== 'other' && cat.toLowerCase().trim() !== '__other__'
        ).sort((a, b) => {
            const aActive = activeSet.has(a.toLowerCase().trim());
            const bActive = activeSet.has(b.toLowerCase().trim());
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return a.localeCompare(b);
        });

        const options: SearchableDropdownOption[] = combined.map(cat => {
            const hasActive = activeSet.has(cat.toLowerCase().trim());
            return {
                value: cat,
                label: hasActive ? `${cat} (Active Supplier)` : cat,
                icon: hasActive ? 'fas fa-store' : 'fas fa-tag',
            };
        });

        options.push({
            value: '__other__',
            label: '+ Custom Category...',
            icon: 'fas fa-pen',
        });

        return options;
    }, [supplierCategories]);

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setFormData({
                item_code: '',
                item_name: '',
                category: 'Packaging Materials',
                unit: 'pcs',
                current_stock: 0,
                minimum_stock: 10,
                storage_location: '',
                supplier: '',
                purchase_price: '',
                description: '',
                status: 'In Stock'
            });
            setIsCustomCategory(false);
            setCustomCategoryText('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        const effectiveCategory = (isCustomCategory || formData.category === '__other__')
            ? customCategoryText.trim()
            : formData.category.trim();

        if (!formData.item_code.trim() || !formData.item_name.trim() || !effectiveCategory || !formData.unit.trim()) {
            toast.warning('Please fill in all required fields including category');
            return;
        }

        if (!formData.storage_location.trim()) {
            toast.warning('Please enter a storage location');
            return;
        }

        const numericPrice = Number(formData.purchase_price);
        if (formData.purchase_price === '' || isNaN(numericPrice) || numericPrice <= 0) {
            toast.warning('Please enter a valid unit purchase price');
            return;
        }

        await onSave({
            ...formData,
            category: effectiveCategory,
            purchase_price: numericPrice
        });
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
                className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.06] mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex items-center justify-center text-pink-600 dark:text-pink-400 shrink-0">
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
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
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
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
                                    placeholder="e.g., Packing Tape"
                                    value={formData.item_name}
                                    onChange={(e) => setFormData({ ...formData, item_name: sanitizeText(e.target.value) })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <SearchableDropdown
                                    value={formData.category}
                                    onChange={(val) => {
                                        setFormData({ ...formData, category: val });
                                        if (val === '__other__') {
                                            setIsCustomCategory(true);
                                        } else {
                                            setIsCustomCategory(false);
                                        }
                                    }}
                                    options={categoryOptions}
                                    placeholder="-- Select Category --"
                                    searchPlaceholder="Search category..."
                                    icon="fas fa-layer-group"
                                    className="w-full"
                                    tone="pink"
                                    emptyValue=""
                                    title="Item Category"
                                    disabled={loading}
                                />
                                {(isCustomCategory || formData.category === '__other__') && (
                                    <div className="mt-2 space-y-1 animate-in fade-in duration-150">
                                        <label className="block text-[11px] font-bold text-pink-600 dark:text-pink-400">
                                            Specify Custom Category Name <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-pink-400 dark:border-pink-500/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
                                            placeholder="Type custom category name (e.g. Lab Supplies)..."
                                            value={customCategoryText}
                                            onChange={(e) => setCustomCategoryText(e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Unit of Measure <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#ebf0f7] dark:bg-[#14151e] p-3.5 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Current Stock <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
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
                                    className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
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
                                    Storage Location <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <input
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
                                    placeholder="e.g., Aisle 3, Rack B, Shelf 2"
                                    value={formData.storage_location}
                                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Supplier <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">(Optional)</span>
                                </label>
                                <select
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all cursor-pointer appearance-none disabled:opacity-50"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                    value={formData.supplier}
                                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                    disabled={loading || isLoadingSuppliers}
                                >
                                    <option value="">{isLoadingSuppliers ? 'Loading suppliers...' : 'Select supplier (optional)'}</option>
                                    {localSuppliers.map((s) => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Unit Purchase Price <span className="text-pink-500 dark:text-pink-400">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-semibold text-xs sm:text-sm">
                                        ₱
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-8 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50"
                                        placeholder="0"
                                        value={formData.purchase_price}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Description / Notes
                                </label>
                                <textarea
                                    className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-all resize-none disabled:opacity-50"
                                    rows={2}
                                    placeholder="Brief description or handling notes for this item..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06] mt-4">
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
                            variant="primary"
                            size="md"
                            disabled={loading}
                            loading={loading}
                        >
                            {!loading && <i className="fas fa-check text-xs"></i>}
                            <span>Save Item</span>
                        </AppButton>
                    </div>
                </form>
            </div>
            </div>
        </Portal>
    );
}

export default AddItemModal;