"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    X, 
    RotateCcw, 
    CheckCircle2, 
    Building2, 
    Calendar, 
    Package, 
    FileText, 
    Truck, 
    ShieldCheck, 
    MapPin, 
    Loader2, 
    AlertCircle,
    Boxes,
    Info,
    Sparkles
} from "lucide-react";
import { toast } from "sonner";
import Portal from "../../../../components/client/Portal";
import { user } from "../../../../lib/services/Class/user";
import { 
    receiveSupplierReplacementAction, 
    SupplierReturnRequestRecord 
} from "../../server/supplier-returns-actions";

interface ReceiveReplacementModalProps {
    isOpen: boolean;
    onClose: () => void;
    returnRequest: SupplierReturnRequestRecord | null;
    inventoryItems?: any[];
    onSuccess?: () => void;
}

export function ReceiveReplacementModal({
    isOpen,
    onClose,
    returnRequest,
    inventoryItems = [],
    onSuccess,
}: ReceiveReplacementModalProps) {
    const [receivedQuantity, setReceivedQuantity] = useState<number>(1);
    const [storageLocation, setStorageLocation] = useState<string>("");
    const [deliveryReceiptNumber, setDeliveryReceiptNumber] = useState<string>("");
    const [invoiceNumber, setInvoiceNumber] = useState<string>("");
    const [qcCondition, setQcCondition] = useState<string>("Passed QC Inspection - Brand New Replacement");
    const [receivedBy, setReceivedBy] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Available storage locations extracted from inventory items
    const availableLocations = useMemo(() => {
        const set = new Set<string>();
        inventoryItems.forEach((inv) => {
            if (inv.storage_location) set.add(String(inv.storage_location).trim());
        });
        const arr = Array.from(set).filter(Boolean);
        if (arr.length === 0) {
            return ["ZONE A - Fast Moving", "ZONE B - Electrical Components", "ZONE C - Heavy Supplies", "ZONE D - Mechanical Parts", "ZONE E - General Shelf"];
        }
        return arr;
    }, [inventoryItems]);

    useEffect(() => {
        if (returnRequest && isOpen) {
            const approvedQty = Number(returnRequest.defective_quantity) || 1;
            setReceivedQuantity(approvedQty);

            // Match existing inventory item for location recommendation
            const matchedInv = inventoryItems.find(
                (inv) =>
                    inv.item_code === returnRequest.item_code ||
                    inv.item_name?.toLowerCase() === returnRequest.item_name?.toLowerCase()
            );
            setStorageLocation(matchedInv?.storage_location || availableLocations[0] || "ZONE A - Main Rack");

            setDeliveryReceiptNumber(
                (returnRequest.resolution_details as any)?.delivery_receipt_number || 
                (returnRequest.resolution_details as any)?.tracking_number || 
                ""
            );
            setInvoiceNumber(returnRequest.po_number || "");
            setQcCondition("Passed QC Inspection - Brand New Replacement");
            setReceivedBy(user.getName() || "Warehouse QC Inspector");
            setNotes("");
        }
    }, [returnRequest, isOpen, inventoryItems, availableLocations]);

    if (!isOpen || !returnRequest) return null;

    const approvedQty = Number(returnRequest.defective_quantity) || 1;
    const rmaRef = returnRequest.resolution_details?.supplier_reference || "Auto-assigned";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (receivedQuantity <= 0) {
            toast.error("Please enter a valid received quantity greater than 0.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await receiveSupplierReplacementAction({
                returnRequestId: returnRequest.id,
                receivedQuantity: Number(receivedQuantity),
                storageLocation: storageLocation.trim() || undefined,
                deliveryReceiptNumber: deliveryReceiptNumber.trim() || undefined,
                invoiceNumber: invoiceNumber.trim() || undefined,
                qcCondition,
                receivedBy: receivedBy.trim() || user.getName() || "Warehouse QC Inspector",
                receivedById: user.getId() || undefined,
                notes: notes.trim() || undefined,
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to receive replacement supplies.");
            }

            toast.success(res.message || "Replacement goods received & added to inventory!");
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error receiving replacement:", err);
            toast.error(err.message || "Failed to process replacement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/[0.08] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                        Receive Supplier Replacement
                                    </h3>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        Approved for Replacement
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Claim #{returnRequest.return_request_number} • PO #{returnRequest.po_number} • Vendor: {returnRequest.supplier_name}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                        {/* Replacement Summary Banner */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                                        Approved Item For Replacement
                                    </span>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                        {returnRequest.item_name}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                        Item Code: {returnRequest.item_code}
                                    </p>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Approved Quantity
                                    </span>
                                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {approvedQty} {returnRequest.unit || "units"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-500/15 text-xs text-slate-600 dark:text-slate-300">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">RMA / Vendor Ref:</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{rmaRef}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Original Defect:</span>
                                    <span className="font-semibold text-rose-600 dark:text-rose-400">{returnRequest.defect_type || "Damaged"}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-[10px] text-slate-400 block">Expected Dispatch:</span>
                                    <span className="font-semibold">{returnRequest.resolution_details?.expected_replacement_date || "Dispatched"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Input Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            {/* Quantity Accepted */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Replacement Quantity Accepted &amp; Verified <span className="text-emerald-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={approvedQty * 2}
                                        value={receivedQuantity}
                                        onChange={(e) => setReceivedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                        {returnRequest.unit || "units"}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Approved by procurement: {approvedQty} {returnRequest.unit || "units"}
                                </p>
                            </div>

                            {/* Storage Location Allocation */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Target Storage Zone / Location <span className="text-emerald-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={storageLocation}
                                        onChange={(e) => setStorageLocation(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                                    >
                                        {availableLocations.map((loc) => (
                                            <option key={loc} value={loc}>
                                                {loc}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Directly allocates new stock into this warehouse shelf zone.
                                </p>
                            </div>

                            {/* Waybill / Delivery Receipt Number */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Delivery Receipt / Waybill # (DR #)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. DR-2026-9921 / Tracking #"
                                    value={deliveryReceiptNumber}
                                    onChange={(e) => setDeliveryReceiptNumber(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* QC Condition Verification */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Physical QC Inspection Result <span className="text-emerald-500">*</span>
                                </label>
                                <select
                                    value={qcCondition}
                                    onChange={(e) => setQcCondition(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="Passed QC Inspection - Brand New Replacement">Passed QC - Brand New / Intact</option>
                                    <option value="Passed QC Inspection - Functionally Verified">Passed QC - Tested & Operational</option>
                                    <option value="Minor Cosmetic Issue Accepted">Minor Cosmetic Discrepancy Accepted</option>
                                </select>
                            </div>

                            {/* Received By */}
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Receiving QC Inspector Name
                                </label>
                                <input
                                    type="text"
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    placeholder="Staff full name"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Receiving Remarks */}
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Receiving &amp; Inspection Remarks (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notes on packaging, courier carrier, batch serial number, or remarks..."
                                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs resize-none focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Inventory Impact Notice */}
                        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                            <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="leading-relaxed">
                                Confirming will immediately add <strong>{receivedQuantity} {returnRequest.unit || "units"}</strong> of{" "}
                                <strong>{returnRequest.item_name}</strong> to active usable inventory stock, record an official{" "}
                                <strong>Stock In</strong> movement, and close Return Claim #{returnRequest.return_request_number} as <strong>Resolved</strong>.
                            </p>
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200/60 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Restocking Inventory...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Confirm Receiving &amp; Restock</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
