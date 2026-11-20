'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { sanitizeText } from '../../../../components/global/sanitize';
import { EditItemFormData, InventoryItem, Supplier, WarehouseStorageZone } from '../../types';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { supabase } from '../../../../lib/services/client/supabase';
import { SearchableDropdown, SearchableDropdownOption } from '../../../../components/ui/SearchableDropdown';

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
    suppliers = [],
    loading = false
}: EditItemModalProps) {
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryText, setCustomCategoryText] = useState('');

    const [storageZones, setStorageZones] = useState<WarehouseStorageZone[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(false);

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
        warehouse_storage_zone_id: '',
        supplier: '',
        purchase_price: 0,
        status: 'available'
    });

    useEffect(() => {
        if (suppliers && suppliers.length > 0) {
            const activeOnly = suppliers.filter((s: any) => s.is_active !== false && s.is_active !== 0 && s.is_active !== 'false');
            setLocalSuppliers(activeOnly);
        }
    }, [suppliers]);

    useEffect(() => {
        if (isOpen) {
            let isMounted = true;
            setIsLoadingSuppliers(true);
            setIsLoadingZones(true);

            const loadData = async () => {
                try {
                    const [suppRes, zonesRes] = await Promise.all([
                        supabase
                            .from('suppliers')
                            .select('id, name, category, is_active, status')
                            .order('name'),
                        supabase
                            .from('warehouse_storage_zones')
                            .select('id, zone_code, zone_name, total_capacity_units, current_utilized_units, type, building_or_hub')
                            .order('zone_code')
                    ]);

                    if (isMounted) {
                        if (!suppRes.error && suppRes.data && suppRes.data.length > 0) {
                            const activeSupps = suppRes.data.filter((s: any) => s.is_active !== false && s.status !== 'inactive');
                            setLocalSuppliers(activeSupps as unknown as Supplier[]);

                            const activeCats = Array.from(
                                new Set(
                                    activeSupps
                                        .map((s: any) => (typeof s.category === 'string' ? s.category.trim() : ''))
                                        .filter(Boolean)
                                )
                            ).sort();
                            setSupplierCategories(activeCats);
                        }

                        if (!zonesRes.error && zonesRes.data) {
                            setStorageZones(zonesRes.data as WarehouseStorageZone[]);
                        }
                    }
                } catch (err) {
                    console.error('Error fetching suppliers/zones:', err);
                } finally {
                    if (isMounted) {
                        setIsLoadingSuppliers(false);
                        setIsLoadingZones(false);
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
                ...(item?.category ? [item.category] : [])
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
    }, [supplierCategories, item]);

    // Currently selected storage zone details
    const selectedZone = useMemo(() => {
        return storageZones.find(z => 
            (formData.warehouse_storage_zone_id && z.id === formData.warehouse_storage_zone_id) || 
            (formData.storage_location && z.zone_code.toLowerCase().trim() === formData.storage_location.toLowerCase().trim())
        );
    }, [storageZones, formData.warehouse_storage_zone_id, formData.storage_location]);

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
                warehouse_storage_zone_id: item.warehouse_storage_zone_id || '',
                supplier: item.supplier || '',
                purchase_price: item.purchase_price || 0,
                status: item.status || 'available'
            });
            setIsCustomCategory(false);
            setCustomCategoryText('');
        }
    }, [isOpen, item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const effectiveCategory = (isCustomCategory || formData.category === '__other__')
            ? customCategoryText.trim()
            : (formData.category || '').trim();

        if (!formData.item_code.trim() || !formData.item_name.trim() || !effectiveCategory || !formData.unit.trim()) {
            toast.warning('Please fill in all required fields including category');
            return;
        }

        const numericPrice = Number(formData.purchase_price);
        if (formData.purchase_price === undefined || formData.purchase_price === null || isNaN(numericPrice) || numericPrice <= 0) {
            toast.warning('Please enter a valid unit purchase price');
            return;
        }

        await onSave({
            ...formData,
            storage_location: (formData.storage_location || item?.storage_location || '').trim(),
            warehouse_storage_zone_id: formData.warehouse_storage_zone_id || item?.warehouse_storage_zone_id || (selectedZone ? selectedZone.id : undefined),
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
                className="bg-[#ebf0f7] dark:bg-[#151726] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200/80 dark:border-white/[0.08] shadow-none animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between bg-[#e8edf5]/80 dark:bg-[#131422]/70 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#161828] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <i className="fas fa-pen-to-square text-base"></i>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                Edit Inventory Item
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Update item specifications, threshold alerts, and commercial details
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Close modal"
                        className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#161826] hover:bg-[#e2e8f2] dark:hover:bg-[#1a1d30] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border border-slate-200/60 dark:border-white/10 shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),_2px_2px_4px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.5)] transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-40"
                    >
                        <i className="fas fa-times text-xs"></i>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-6 space-y-6 flex-1">

                        {/* Basic Details */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
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
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
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
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: sanitizeText(e.target.value) })}
                                            placeholder="e.g. Bubble Wrap Roll"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
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
                                            <label className="block text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                                Specify Custom Category Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-blue-400 dark:border-blue-500/60 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Unit Measurement <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-ruler-horizontal absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <input
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
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

                        {/* Stock Thresholds */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-boxes-stacked text-blue-500 dark:text-blue-400"></i>
                                <span>Stock Thresholds</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#ebf0f7] dark:bg-[#14151e] p-4 rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)]">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Current Stock <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
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
                                        className="w-full bg-[#e4ebf5] dark:bg-[#111218] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
                                        value={formData.minimum_stock}
                                        onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Storage Location (Warehouse Zone) - VIEW ONLY */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fas fa-warehouse text-blue-500 dark:text-blue-400"></i>
                                    <span>Storage Location (Warehouse Zone)</span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e0e6f0] dark:bg-[#1a1c2d] text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-white/10 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3)]">
                                    View Only
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131e] border border-white/80 dark:border-white/[0.06] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">
                                        <i className="fas fa-location-dot"></i>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                                                {formData.storage_location || item?.storage_location || "Unassigned Location"}
                                            </span>
                                            {selectedZone?.zone_name && (
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                    — {selectedZone.zone_name}
                                                </span>
                                            )}
                                            {selectedZone?.type && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                                                    {selectedZone.type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                            {selectedZone?.building_or_hub && (
                                                <span>Hub: <strong>{selectedZone.building_or_hub}</strong> •</span>
                                            )}
                                            <span>To relocate stock to another zone, use <strong>Warehousing &gt; Storage Locations</strong></span>
                                        </div>
                                    </div>
                                </div>

                                {selectedZone && (
                                    <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#1a1c2b] border border-slate-200/60 dark:border-white/10 text-[11px] font-mono text-right ml-auto">
                                        <div className="text-[10px] uppercase text-slate-400 font-bold">Zone Capacity</div>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedZone.current_utilized_units || 0}</span>
                                        <span className="text-slate-400"> / {selectedZone.total_capacity_units || 0} units</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Commercial & Supplier Details */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-coins text-blue-500 dark:text-blue-400"></i>
                                <span>Commercial &amp; Supplier Details</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Supplier <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">(Optional)</span>
                                    </label>
                                    <div className="relative">
                                        <i className="fas fa-building-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <select
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                            value={formData.supplier}
                                            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                            disabled={loading || isLoadingSuppliers}
                                        >
                                            <option value="" className="dark:bg-slate-900">{isLoadingSuppliers ? 'Loading suppliers...' : 'Select supplier (optional)'}</option>
                                            {localSuppliers.map((s) => (
                                                <option key={s.id} value={s.name} className="dark:bg-slate-900">{s.name}</option>
                                            ))}
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Unit Purchase Price <span className="text-rose-500 dark:text-rose-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-semibold pointer-events-none">₱</span>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                                            value={formData.purchase_price === 0 ? '' : formData.purchase_price}
                                            onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0) })}
                                            placeholder="0.00"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Notes / Description
                                    </label>
                                    <textarea
                                        className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
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
                    <div className="px-6 py-4 bg-[#e8edf5]/80 dark:bg-[#131422]/70 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] hover:bg-[#e2e8f2] dark:hover:bg-[#1c1f32] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_4px_rgba(255,255,255,0.02),_2px_2px_4px_rgba(0,0,0,0.5)] active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(59,130,246,0.35)] active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {loading ? (
                                <i className="fas fa-spinner fa-spin text-xs"></i>
                            ) : (
                                <i className="fas fa-check text-xs"></i>
                            )}
                            <span>{loading ? "Saving..." : "Save Changes"}</span>
                        </button>
                    </div>
                </form>
            </div>
            </div>
        </Portal>
    );
}