'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../../types';
import { toast } from 'sonner';
import { user } from '../../../../lib/services/Class/user';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { createPurchaseRequest } from '../../server/query';
import { supabase } from '../../../../lib/services/client/supabase';
import { SearchableDropdown, SearchableDropdownOption } from '../../../../components/ui/SearchableDropdown';
import {
    Package,
    Building2,
    User,
    FileText,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Plus,
    Trash2,
    Calendar,
    Phone,
    Briefcase,
    Tag,
    X,
    Clock,
    Sparkles
} from 'lucide-react';

interface InternalRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    inventoryItems: InventoryItem[];
    preSelectedItem?: InventoryItem | null;
}

const DEPARTMENTS = [
    'Warehouse',
    'Fleet',
    'Operations',
    'Office',
    'Procurement',
    'IT',
    'HR',
    'Finance',
    'Other'
];

const STANDARD_CATEGORIES = [
    'Office Supplies & Stationery',
    'Packaging & Shipping Materials',
    'IT & Computer Hardware',
    'Electronics & Gadgets',
    'Hardware & Maintenance Tools',
    'Cleaning & Janitorial Supplies',
    'Safety Equipment & PPE',
    'Warehouse & Logistics Consumables',
    'Raw Materials & Chemicals',
    'Printing & Signage Media',
    'Furniture & Fixtures',
    'Electrical & Power Supplies',
    'Medical & First Aid Supplies',
    'Pantry, Food & Beverages',
    'Automotive & Fleet Parts',
    'General Commercial Supplies',
];

export const STANDARD_UNITS = [
    'pcs',
    'reams',
    'boxes',
    'rolls',
    'packs',
    'sets',
    'units',
    'kg',
    'meters',
    'liters',
    'bottles',
    'cans',
    'pairs',
    'bundles',
    'tubes',
    'gallons',
    'cartons',
];

export const normalizeUnit = (u?: string): string => {
    if (!u) return 'pcs';
    const trimmed = u.trim();
    const lower = trimmed.toLowerCase();

    if (lower === 'pc' || lower === 'piece' || lower === 'pieces' || lower === 'pcs') return 'pcs';
    if (lower === 'box' || lower === 'boxes' || lower === 'bx') return 'boxes';
    if (lower === 'ream' || lower === 'reams' || lower === 'rm') return 'reams';
    if (lower === 'roll' || lower === 'rolls' || lower === 'rl') return 'rolls';
    if (lower === 'pack' || lower === 'packs' || lower === 'pk') return 'packs';
    if (lower === 'set' || lower === 'sets') return 'sets';
    if (lower === 'unit' || lower === 'units') return 'units';
    if (lower === 'kg' || lower === 'kilogram' || lower === 'kilograms' || lower === 'kgs') return 'kg';
    if (lower === 'meter' || lower === 'meters' || lower === 'm') return 'meters';
    if (lower === 'liter' || lower === 'liters' || lower === 'l') return 'liters';
    if (lower === 'bottle' || lower === 'bottles' || lower === 'btl') return 'bottles';
    if (lower === 'pair' || lower === 'pairs' || lower === 'pr') return 'pairs';
    if (lower === 'bundle' || lower === 'bundles' || lower === 'bdl') return 'bundles';
    if (lower === 'carton' || lower === 'cartons' || lower === 'ctn') return 'cartons';
    if (lower === 'can' || lower === 'cans') return 'cans';
    if (lower === 'tube' || lower === 'tubes') return 'tubes';
    if (lower === 'gallon' || lower === 'gallons' || lower === 'gal') return 'gallons';

    const match = STANDARD_UNITS.find(std => std.toLowerCase() === lower);
    if (match) return match;

    return trimmed;
};

interface RequestItemInput {
    id?: string;
    name: string;
    category: string;
    customCategoryText?: string;
    isCustomCategory?: boolean;
    quantity: number;
    unit: string;
    specs: string;
}

export function InternalRequestModal({
    isOpen,
    onClose,
    onSuccess,
    inventoryItems,
    preSelectedItem = null,
}: InternalRequestModalProps) {
    const [department, setDepartment] = useState<string>('Warehouse');
    const [requestedBy, setRequestedBy] = useState<string>('');
    const [requesterPosition, setRequesterPosition] = useState<string>('');
    const [requesterContact, setRequesterContact] = useState<string>('');
    const [requestedFor, setRequestedFor] = useState<string>('');
    const [requestType, setRequestType] = useState<'Regular' | 'Advance'>('Regular');
    const [type, setType] = useState<string>('Inventory Addition');
    const [priority, setPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Normal');
    const [purpose, setPurpose] = useState<string>('Warehouse stock replenishment');
    const [description, setDescription] = useState<string>('');
    const [urgencyReason, setUrgencyReason] = useState<string>('');
    const [advanceReason, setAdvanceReason] = useState<string>('');
    const [neededByDate, setNeededByDate] = useState<string>('');
    const [requesterNotes, setRequesterNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Compute today's date formatted as YYYY-MM-DD for min date constraint
    const todayStr = useMemo(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    // Dynamic categories fetched from active suppliers in suppliers table
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(false);

    const [items, setItems] = useState<RequestItemInput[]>([
        { name: '', category: '', customCategoryText: '', quantity: 10, unit: 'pcs', specs: '' }
    ]);

    // Fetch dynamic categories directly from active suppliers in suppliers table
    useEffect(() => {
        let isMounted = true;
        const loadCategories = async () => {
            try {
                setIsLoadingCategories(true);
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('category, is_active, status')
                    .not('category', 'is', null)
                    .order('category');

                if (!error && data && isMounted) {
                    // Strictly extract unique literal category entries from active suppliers
                    const literalCategories = Array.from(
                        new Set(
                            data
                                .filter((s: any) => s.is_active !== false && s.status !== 'inactive')
                                .map((s: any) => (typeof s.category === 'string' ? s.category.trim() : ''))
                                .filter((c: string) => Boolean(c) && c.length > 0)
                        )
                    ).sort();

                    setSupplierCategories(literalCategories);
                }
            } catch (err) {
                console.warn('Could not fetch supplier categories:', err);
            } finally {
                if (isMounted) setIsLoadingCategories(false);
            }
        };

        if (isOpen) {
            loadCategories();
        }
        return () => { isMounted = false; };
    }, [isOpen]);

    // Format options for SearchableDropdown combining Active Suppliers and Standard Categories
    const categoryOptions: SearchableDropdownOption[] = useMemo(() => {
        const activeSet = new Set(supplierCategories.map(c => c.toLowerCase().trim()));

        // All distinct categories
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
                label: hasActive ? `${cat} (Active Supplier Available)` : cat,
                icon: hasActive ? 'fas fa-store' : 'fas fa-tag',
            };
        });

        options.push({
            value: '__other__',
            label: '+ Other / Custom Category...',
            icon: 'fas fa-pen',
        });

        return options;
    }, [supplierCategories]);

    // Initialize user and pre-selected item
    useEffect(() => {
        if (isOpen) {
            const userName = user.getName() || user.getEmail() || 'Staff Member';
            setRequestedBy(userName);
            setRequesterPosition(user.getRole() || 'Staff');
            
            if (preSelectedItem) {
                setItems([
                    {
                        id: preSelectedItem.id,
                        name: preSelectedItem.item_name,
                        category: preSelectedItem.category || '',
                        quantity: Math.max(10, Number(preSelectedItem.minimum_stock || 10)),
                        unit: normalizeUnit(preSelectedItem.unit),
                        specs: `Restock request for item code ${preSelectedItem.item_code}`
                    }
                ]);
                setType('Inventory Restock');
                setPurpose(`Restock replenishment for ${preSelectedItem.item_name}`);
            } else {
                setItems([{ name: '', category: '', quantity: 10, unit: 'pcs', specs: '' }]);
                setType('Inventory Addition');
                setPurpose('Warehouse inventory requisition');
            }

            setDepartment('Warehouse');
            setPriority('Normal');
            setRequestType('Regular');
            setUrgencyReason('');
            setAdvanceReason('');
            setRequesterNotes('');
        }
    }, [isOpen, preSelectedItem]);

    const handleAddItemRow = () => {
        setItems(prev => [
            ...prev,
            { name: '', category: '', quantity: 10, unit: 'pcs', specs: '' }
        ]);
    };

    const handleRemoveItemRow = (index: number) => {
        if (items.length <= 1) {
            toast.warning('At least one item is required in the request');
            return;
        }
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof RequestItemInput, value: any) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };

            // When item name is typed or selected from datalist suggestions, auto-populate unit and category from inventory
            if (field === 'name') {
                const strVal = String(value || '').trim().toLowerCase();
                if (!strVal) {
                    next[index].id = undefined;
                    return next;
                }

                // Match against inventory items by name, item_code, or combined "code - name"
                const matched = inventoryItems.find(i => {
                    const nameMatch = i.item_name?.toLowerCase().trim() === strVal;
                    const codeMatch = i.item_code?.toLowerCase().trim() === strVal;
                    const combinedMatch = `${i.item_code} - ${i.item_name}`.toLowerCase().trim() === strVal;
                    return nameMatch || codeMatch || combinedMatch;
                });

                if (matched) {
                    next[index].id = matched.id;
                    if (next[index].name !== matched.item_name) {
                        next[index].name = matched.item_name;
                    }
                    // Auto-change unit from chosen inventory item
                    if (matched.unit) {
                        next[index].unit = normalizeUnit(matched.unit);
                    }
                    // Auto-populate category if present in inventory
                    if (matched.category) {
                        next[index].category = matched.category;
                        next[index].isCustomCategory = false;
                        next[index].customCategoryText = '';
                    }
                } else {
                    next[index].id = undefined;
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!requestedBy.trim()) {
            toast.warning('Please specify requester name');
            return;
        }

        // Validate each item row
        for (let i = 0; i < items.length; i++) {
            const itm = items[i];
            if (!itm.name.trim()) {
                toast.warning(`Please enter an Item Name for item #${i + 1}`);
                return;
            }
            const effCat = (itm.category === '__other__' || itm.category === 'Others' || itm.isCustomCategory)
                ? (itm.customCategoryText || '').trim()
                : itm.category.trim();

            if (!effCat) {
                toast.warning(`Please specify or select a Category for Item #${i + 1} (${itm.name || 'unnamed'})`);
                return;
            }
            if (Number(itm.quantity) <= 0) {
                toast.warning(`Quantity for Item #${i + 1} must be greater than 0`);
                return;
            }
        }

        const validItems = items.filter(i => {
            const effCat = (i.category === '__other__' || i.category === 'Others' || i.isCustomCategory)
                ? (i.customCategoryText || '').trim()
                : i.category.trim();
            return i.name.trim() && effCat && Number(i.quantity) > 0;
        });
        if (validItems.length === 0) {
            toast.warning('Please enter valid item names, categories, and quantities (> 0)');
            return;
        }

        if (priority !== 'Normal' && !urgencyReason.trim()) {
            toast.warning('Please provide an urgency reason for Urgent/Critical requests');
            return;
        }

        if (requestType === 'Advance' && !advanceReason.trim()) {
            toast.warning('Please provide an advance reason for Advance requests');
            return;
        }

        // Validate that Needed By Date is not in the past
        if (neededByDate && neededByDate < todayStr) {
            toast.warning('Needed By Date cannot be earlier than today.');
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading('Submitting inventory request...');

        try {
            const res = await createPurchaseRequest({
                request_type: requestType,
                type: type.trim() || 'Inventory Addition',
                description: description.trim() || purpose.trim(),
                purpose: purpose.trim() || 'Department operational requirement',
                requested_by: requestedBy.trim(),
                requester_position: requesterPosition.trim(),
                requester_contact: requesterContact.trim(),
                department,
                requested_for: requestedFor.trim(),
                items: validItems.map(i => {
                    const effCat = (i.category === '__other__' || i.category === 'Others' || i.isCustomCategory)
                        ? (i.customCategoryText || 'Custom Category').trim()
                        : i.category.trim();
                    const lineId = i.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
                    return {
                        id: lineId,
                        item_id: lineId,
                        name: i.name.trim(),
                        category: effCat,
                        quantity: Number(i.quantity),
                        unit: i.unit.trim() || 'pcs',
                        specs: i.specs.trim(),
                        status: 'Pending',
                    };
                }),
                priority,
                needed_by_date: neededByDate || undefined,
                urgency_reason: priority !== 'Normal' ? urgencyReason.trim() : undefined,
                advance_reason: requestType === 'Advance' ? advanceReason.trim() : undefined,
                requester_notes: requesterNotes.trim(),
            });

            if (res.success) {
                toast.success(res.message || 'Inventory request submitted successfully!', { id: toastId });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to submit request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error submitting inventory request:', err);
            toast.error(err?.message || 'Failed to submit request', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200/80 dark:border-white/[0.08] shadow-none animate-in zoom-in-95 duration-200 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 border border-pink-500/30 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-inner">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                    Request Department Items
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Request items needed by your department. Admin will verify inventory stock availability.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-[#12131b] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 flex-1 text-xs">

                        {/* Requester & Department Section */}
                        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.4)] space-y-3.5">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                Department & Requester Details
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Department <span className="text-pink-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
                                            value={department}
                                            onChange={(e) => setDepartment(e.target.value)}
                                            required
                                        >
                                            {DEPARTMENTS.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Requested By <span className="text-pink-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                        placeholder="Full Name"
                                        value={requestedBy}
                                        onChange={(e) => setRequestedBy(e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Position / Role
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                        placeholder="e.g. Warehouse Staff, HR Lead"
                                        value={requesterPosition}
                                        onChange={(e) => setRequesterPosition(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Contact Number / Email
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                        placeholder="e.g. +63 912 345 6789 or email"
                                        value={requesterContact}
                                        onChange={(e) => setRequesterContact(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Requested For (End User / Purpose Area)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                        placeholder="e.g. HR Documentation, Hub 2 Packaging"
                                        value={requestedFor}
                                        onChange={(e) => setRequestedFor(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Request Configuration Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Priority Level
                                </label>
                                <select
                                    className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as any)}
                                >
                                    <option value="Normal">Normal Priority</option>
                                    <option value="Urgent">Urgent Priority</option>
                                    <option value="Critical">Critical Priority</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Needed By Date
                                </label>
                                <input
                                    type="date"
                                    min={todayStr}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 cursor-pointer"
                                    value={neededByDate}
                                    onChange={(e) => setNeededByDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {priority !== 'Normal' && (
                            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 shadow-inner">
                                <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">
                                    Urgency Reason <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-amber-300 dark:border-amber-800/80 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]"
                                    placeholder="Explain why this request is urgent/critical (e.g., zero safety stock, customer escalation)..."
                                    value={urgencyReason}
                                    onChange={(e) => setUrgencyReason(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {/* Items Section (No Estimated Costs) */}
                        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[6px_6px_16px_rgba(0,0,0,0.4)] space-y-3.5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-pink-500" />
                                    Requested Items & Quantities ({items.length})
                                </h4>
                                <button
                                    type="button"
                                    onClick={handleAddItemRow}
                                    className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Another Item</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {items.map((item, idx) => {
                                    // Check live match from catalog
                                    const matched = inventoryItems.find(
                                        inv => inv.item_name.toLowerCase().trim() === item.name.toLowerCase().trim() ||
                                               inv.item_code?.toLowerCase().trim() === item.name.toLowerCase().trim() ||
                                               (item.id && inv.id === item.id)
                                    );

                                    return (
                                        <div
                                            key={idx}
                                            className="p-3.5 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#13141d]/70 border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)] space-y-3"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                                {/* Item Name / Catalog Select */}
                                                <div className="sm:col-span-4">
                                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Item Name #{idx + 1} <span className="text-pink-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            list={`inv-suggestions-${idx}`}
                                                            className="w-full bg-[#f0f3f8] dark:bg-[#161722] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                                            placeholder="Type item name (e.g. Bond Paper A4, Packing Tape)..."
                                                            value={item.name}
                                                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                                            required
                                                        />
                                                        <datalist id={`inv-suggestions-${idx}`}>
                                                            {inventoryItems.map(inv => (
                                                                <option key={inv.id} value={inv.item_name}>
                                                                    {inv.item_code} - {inv.item_name} ({inv.current_stock} {inv.unit || 'pcs'} on hand)
                                                                </option>
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                    {matched && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                            <span>In inventory: <strong>{matched.current_stock} {matched.unit || 'pcs'}</strong> on hand</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Category - Dynamic from Suppliers table with SearchableDropdown */}
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                                        <span>Category <span className="text-pink-500">*</span></span>
                                                        {isLoadingCategories && (
                                                            <span className="text-[10px] text-slate-400 font-normal">Loading...</span>
                                                        )}
                                                    </label>
                                                    <SearchableDropdown
                                                        value={item.category}
                                                        onChange={(val) => {
                                                            handleItemChange(idx, 'category', val);
                                                            if (val === '__other__' || val === 'Others') {
                                                                handleItemChange(idx, 'isCustomCategory', true);
                                                            } else {
                                                                handleItemChange(idx, 'isCustomCategory', false);
                                                            }
                                                        }}
                                                        options={categoryOptions}
                                                        placeholder="-- Select Category --"
                                                        allOptionLabel="None / Clear"
                                                        searchPlaceholder="Search category..."
                                                        icon="fas fa-tag"
                                                        className="w-full"
                                                        tone="pink"
                                                        emptyValue=""
                                                        title={`Category for item #${idx + 1}`}
                                                    />

                                                    {/* Custom Category Input if selected __other__ */}
                                                    {(item.category === '__other__' || item.category === 'Others' || item.isCustomCategory) && (
                                                        <div className="mt-2 space-y-1 animate-in fade-in duration-150">
                                                            <input
                                                                type="text"
                                                                className="w-full bg-[#f0f3f8] dark:bg-[#161722] border border-pink-400 dark:border-pink-500/60 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                                                                placeholder="Type custom category name (e.g. Lab Supplies)..."
                                                                value={item.customCategoryText || ''}
                                                                onChange={(e) => handleItemChange(idx, 'customCategoryText', e.target.value)}
                                                                required
                                                            />
                                                            <p className="text-[9.5px] text-amber-600 dark:text-amber-400 font-medium">
                                                                Custom category will route to potential supplier discovery if not in active suppliers.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Quantity */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Quantity <span className="text-pink-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-full bg-[#f0f3f8] dark:bg-[#161722] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                                                        required
                                                    />
                                                </div>

                                                {/* Unit - Increased width to sm:col-span-2 */}
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                        Unit
                                                    </label>
                                                    <select
                                                        className="w-full appearance-none bg-[#f0f3f8] dark:bg-[#161722] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none cursor-pointer"
                                                        value={item.unit}
                                                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                    >
                                                        {item.unit && !STANDARD_UNITS.includes(item.unit) && (
                                                            <option key={item.unit} value={item.unit}>{item.unit}</option>
                                                        )}
                                                        {STANDARD_UNITS.map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Delete Row */}
                                                <div className="sm:col-span-1 flex justify-center pb-1">
                                                    {items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItemRow(idx)}
                                                            className="p-2.5 rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                                            title="Remove item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Specs / Notes row */}
                                            <div className="grid grid-cols-1 gap-2 items-center">
                                                <div>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-[#f0f3f8] dark:bg-[#161722] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] focus:outline-none"
                                                        placeholder="Optional specifications, dimensions, brand preference, or remarks..."
                                                        value={item.specs}
                                                        onChange={(e) => handleItemChange(idx, 'specs', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Purpose & Notes */}
                        <div className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Purpose & Justification <span className="text-pink-500">*</span>
                                </label>
                                <textarea
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl p-3.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                    rows={2}
                                    placeholder="Explain why these items are requested and how they will be utilized..."
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Additional Requester Notes
                                </label>
                                <textarea
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-slate-300/80 dark:border-white/[0.12] rounded-2xl p-3.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                                    rows={2}
                                    placeholder="Any special handling, storage requirements, or instructions..."
                                    value={requesterNotes}
                                    onChange={(e) => setRequesterNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Form Footer */}
                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                Cancel
                            </AppButton>

                            <AppButton
                                type="submit"
                                variant="primary"
                                size="md"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <i className="fas fa-spinner fa-spin mr-1.5" />
                                ) : (
                                    <FileText className="w-4 h-4 mr-1.5" />
                                )}
                                <span>Submit Item Request</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
