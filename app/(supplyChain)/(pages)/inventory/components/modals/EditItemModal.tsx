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

        if (!formData.storage_location.trim()) {
            toast.warning('Please select a warehouse storage zone');
            return;
        }

        const numericPrice = Number(formData.purchase_price);
        if (formData.purchase_price === undefined || formData.purchase_price === null || isNaN(numericPrice) || numericPrice <= 0) {
            toast.warning('Please enter a valid unit purchase price');
            return;
        }

        await onSave({
            ...formData,
            storage_location: formData.storage_location.trim(),
            warehouse_storage_zone_id: formData.warehouse_storage_zone_id || (selectedZone ? selectedZone.id : undefined),
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
                className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-white/90 dark:border-white/[0.08] animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
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

                        {/* Logistics & Cost */}
                        <div className="space-y-4">
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-truck-ramp-box text-blue-500 dark:text-blue-400"></i>
                                <span>Logistics & Cost</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Storage Location (Warehouse Zone) <span className="text-rose-500 dark:text-rose-400">*</span>
                                        </label>
                                        {isLoadingZones && (
                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                <i className="fas fa-spinner fa-spin text-[10px]"></i> Loading zones...
                                            </span>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <i className="fas fa-warehouse absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                        <select
                                            className="w-full bg-[#ebf0f7] dark:bg-[#14151e] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-lg pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none disabled:opacity-50"
                                            value={formData.storage_location}
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                const matched = storageZones.find(z => z.zone_code === code);
                                                setFormData({
                                                    ...formData,
                                                    storage_location: code,
                                                    warehouse_storage_zone_id: matched ? matched.id : ''
                                                });
                                            }}
                                            required
                                            disabled={loading || isLoadingZones}
                                        >
                                            <option value="" className="dark:bg-slate-900">{isLoadingZones ? 'Loading zones from warehouse...' : '-- Select Warehouse Storage Zone --'}</option>
                                            {storageZones.map((zone) => {
                                                const utilized = Number(zone.current_utilized_units || 0);
                                                const total = Number(zone.total_capacity_units || 0);
                                                const available = Math.max(0, total - utilized);
                                                return (
                                                    <option key={zone.id} value={zone.zone_code} className="dark:bg-slate-900">
                                                        {zone.zone_code} - {zone.zone_name} ({utilized}/{total} units • {available} free)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <i className="fas fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                                    </div>

                                    {selectedZone && (() => {
                                        const currentUtil = Number(selectedZone.current_utilized_units || 0);
                                        const totalCap = Number(selectedZone.total_capacity_units || 0);
                                        const currentStock = Number(formData.current_stock || 0);
                                        const prevStock = Number(item?.current_stock || 0);
                                        const diff = currentStock - prevStock;
                                        const isSameZone = (item?.storage_location || '').trim() === selectedZone.zone_code.trim();
                                        // If same zone, projected = currentUtil + diff; if new zone, projected = currentUtil + currentStock
                                        const projectedUtil = isSameZone ? (currentUtil + diff) : (currentUtil + currentStock);
                                        const currentPct = totalCap > 0 ? Math.min(100, Math.round((currentUtil / totalCap) * 100)) : 0;
                                        const projectedPct = totalCap > 0 ? Math.min(100, Math.round((projectedUtil / totalCap) * 100)) : 0;
                                        const isOverCap = totalCap > 0 && projectedUtil > totalCap;

                                        return (
                                            <div className="p-3 bg-[#e5ecf6] dark:bg-[#111218] rounded-xl border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2 animate-in fade-in duration-150">
                                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                                            <i className="fas fa-map-pin text-[11px] text-blue-500"></i>
                                                            {selectedZone.zone_name}
                                                        </span>
                                                        {selectedZone.building_or_hub && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                {selectedZone.building_or_hub}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                        Capacity: <strong className="text-slate-900 dark:text-white">{currentUtil}</strong> / {totalCap} units
                                                    </span>
                                                </div>

                                                {/* Capacity Progress Bar */}
                                                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                        style={{ width: `${currentPct}%` }}
                                                    />
                                                    {isOverCap && (
                                                        <div
                                                            className="h-full bg-rose-500 rounded-full absolute top-0 left-0 transition-all duration-300"
                                                            style={{ width: '100%' }}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        Zone utilization: <strong>{currentPct}%</strong> ({Math.max(0, totalCap - currentUtil)} units free)
                                                    </span>
                                                    {isOverCap ? (
                                                        <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                                            <i className="fas fa-triangle-exclamation"></i> Over capacity by {projectedUtil - totalCap} units!
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                            <i className="fas fa-circle-check text-[10px]"></i> Space available
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

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
                    <div className="px-6 py-4 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
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
                            <span>Save Changes</span>
                        </AppButton>
                    </div>
                </form>
            </div>
            </div>
        </Portal>
    );
}