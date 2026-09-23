'use client';

import { useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../../types';
import { toast } from 'sonner';
import { user } from '../../../../lib/services/Class/user';
import { AppButton } from '../../../../components/ui/AppButton';
import Portal from '../../../../components/client/Portal';
import { createInternalInventoryRequest } from '../../server/query';
import { Package, Building2, User, FileText, AlertCircle, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface InternalRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    inventoryItems: InventoryItem[];
    preSelectedItem?: InventoryItem | null;
}

const DEPARTMENTS = [
    'Logistics & Dispatch',
    'Customer Operations',
    'Warehouse & Sorting',
    'Fleet & Drivers',
    'Administration & HR',
    'IT & Technical Support',
    'Procurement & Supply',
    'Executive Office',
];

const PURPOSE_PRESETS = [
    'Parcel Packaging & Supplies',
    'Operational Equipment',
    'Office Consumables',
    'Hardware Maintenance',
    'Branch Transfer Requisition',
    'Urgent Customer Fulfillment',
    'Other Internal Requirement',
];

export function InternalRequestModal({
    isOpen,
    onClose,
    onSuccess,
    inventoryItems,
    preSelectedItem = null,
}: InternalRequestModalProps) {
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [itemSearch, setItemSearch] = useState<string>('');
    const [quantity, setQuantity] = useState<number>(1);
    const [department, setDepartment] = useState<string>('');
    const [showDeptSuggestions, setShowDeptSuggestions] = useState<boolean>(false);
    const [requestedBy, setRequestedBy] = useState<string>('');
    const [purpose, setPurpose] = useState<string>(PURPOSE_PRESETS[0]);
    const [customPurpose, setCustomPurpose] = useState<string>('');
    const [remarks, setRemarks] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    const recommendedDepartments = useMemo(() => {
        if (!department.trim()) return DEPARTMENTS;
        const q = department.toLowerCase().trim();
        return DEPARTMENTS.filter(d => d.toLowerCase().includes(q));
    }, [department]);

    // Initialize user and selected item
    useEffect(() => {
        if (isOpen) {
            const userName = user.getName() || user.getEmail() || 'Staff Member';
            setRequestedBy(userName);
            if (!department) {
                setDepartment(DEPARTMENTS[0]);
            }
            if (preSelectedItem) {
                setSelectedItemId(preSelectedItem.id);
            } else if (inventoryItems.length > 0 && !selectedItemId) {
                setSelectedItemId(inventoryItems[0].id);
            }
            setQuantity(1);
            setRemarks('');
        }
    }, [isOpen, preSelectedItem, inventoryItems, selectedItemId]);

    const currentItem = useMemo(() => {
        return inventoryItems.find((i) => String(i.id) === String(selectedItemId)) || null;
    }, [inventoryItems, selectedItemId]);

    const filteredItems = useMemo(() => {
        if (!itemSearch.trim()) return inventoryItems;
        const q = itemSearch.toLowerCase();
        return inventoryItems.filter(
            (i) => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
        );
    }, [inventoryItems, itemSearch]);

    const currentStock = Number(currentItem?.current_stock || 0);
    const exportingStock = Number(currentItem?.exporting_stock || 0);
    const availableStock = Math.max(0, currentStock - exportingStock);

    const isStockSufficient = currentItem ? availableStock >= quantity && availableStock > 0 : false;
    const isOutOfStock = availableStock <= 0;
    const isQuantityExceeded = quantity > availableStock;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentItem) {
            toast.error('Please select an inventory item');
            return;
        }

        if (quantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        const effectivePurpose = purpose === 'Other Internal Requirement' && customPurpose.trim()
            ? customPurpose.trim()
            : purpose;

        setSubmitting(true);
        const toastId = toast.loading('Submitting internal requisition...');

        try {
            const res = await createInternalInventoryRequest({
                item_id: currentItem.id,
                item_name: currentItem.item_name,
                item_code: currentItem.item_code,
                quantity_requested: quantity,
                department: department,
                requested_by: requestedBy.trim() || 'Internal User',
                purpose: effectivePurpose,
                remarks: remarks.trim() || undefined,
            });

            if (res.success) {
                toast.success(res.message || 'Internal request submitted successfully!', { id: toastId });
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || 'Failed to submit request', { id: toastId });
            }
        } catch (err: any) {
            console.error('Error submitting internal request:', err);
            toast.error(err?.message || 'Failed to submit request', { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-xl bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08]  overflow-hidden transition-all my-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-500/25">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                                    New Internal Stock Request
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Requisition products from warehouse storage
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-[#ebf0f7] dark:bg-[#1b1c28] shadow-inner transition-colors cursor-pointer"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        {/* Item Selection */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Select Warehouse Item <span className="text-pink-500">*</span>
                            </label>
                            <div className="space-y-2">
                                <select
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all cursor-pointer"
                                >
                                    <option value="" disabled>-- Choose an item --</option>
                                    {inventoryItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.item_name} ({item.item_code}) — Stock: {item.current_stock} {item.unit}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Live Stock Status Indicator Card */}
                        {currentItem && (
                            <div className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                                isStockSufficient
                                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
                                    : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-300'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 opacity-80" />
                                        Warehouse Availability
                                    </span>
                                    {isStockSufficient ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Stock Available
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Insufficient Stock (Will flag Pending)
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-center">
                                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl">
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Physical Stock</p>
                                        <p className="font-extrabold text-slate-900 dark:text-slate-100">{currentStock} {currentItem.unit}</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl">
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Committed Export</p>
                                        <p className="font-extrabold text-pink-600 dark:text-pink-400">{exportingStock} {currentItem.unit}</p>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-xl">
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">Net Available</p>
                                        <p className={`font-extrabold ${availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {availableStock} {currentItem.unit}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quantity & Department */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Requested Quantity <span className="text-pink-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="999999"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                        placeholder="Quantity"
                                        required
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                        {currentItem?.unit || 'units'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5 relative">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        Requesting Department <span className="text-pink-500">*</span>
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-400">Type or select</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={department}
                                        onChange={(e) => {
                                            setDepartment(e.target.value);
                                            setShowDeptSuggestions(true);
                                        }}
                                        onFocus={() => setShowDeptSuggestions(true)}
                                        placeholder="Type or pick department..."
                                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                        required
                                    />
                                    {showDeptSuggestions && recommendedDepartments.length > 0 && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-10" 
                                                onClick={() => setShowDeptSuggestions(false)} 
                                            />
                                            <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-44 overflow-y-auto rounded-2xl bg-[#f0f3f8] dark:bg-[#181926] border border-white/90 dark:border-white/[0.1] shadow-[8px_8px_20px_rgba(0,0,0,0.15)] dark:shadow-[8px_8px_25px_rgba(0,0,0,0.6)] p-1.5 space-y-0.5">
                                                <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                    Department Recommendations
                                                </div>
                                                {recommendedDepartments.map((dept) => (
                                                    <button
                                                        key={dept}
                                                        type="button"
                                                        onClick={() => {
                                                            setDepartment(dept);
                                                            setShowDeptSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 transition-colors flex items-center justify-between"
                                                    >
                                                        <span>{dept}</span>
                                                        {department.toLowerCase() === dept.toLowerCase() && (
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Requester & Purpose */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    Requester Name <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={requestedBy}
                                    onChange={(e) => setRequestedBy(e.target.value)}
                                    placeholder="Enter your name or ID"
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                    Purpose / Requisition Type
                                </label>
                                <select
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                                >
                                    {PURPOSE_PRESETS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {purpose === 'Other Internal Requirement' && (
                            <div className="space-y-1.5 animate-in fade-in duration-150">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Specific Purpose Description <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customPurpose}
                                    onChange={(e) => setCustomPurpose(e.target.value)}
                                    placeholder="Specify reason for requisition..."
                                    className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500"
                                    required
                                />
                            </div>
                        )}

                        {/* Additional Remarks */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Remarks / Notes (Optional)
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                placeholder="Additional details or instructions for warehouse staff..."
                                className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 resize-none"
                            />
                        </div>

                        {/* Form Actions */}
                        <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-3">
                            <AppButton type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
                                Cancel
                            </AppButton>
                            <AppButton type="submit" variant="primary" size="md" disabled={submitting || !currentItem}>
                                {submitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin text-xs mr-1" />
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane text-xs mr-1" />
                                        <span>Submit Internal Request</span>
                                    </>
                                )}
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
