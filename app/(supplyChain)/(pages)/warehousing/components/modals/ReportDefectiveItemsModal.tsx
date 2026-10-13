"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    AlertTriangle, 
    UploadCloud, 
    X, 
    CheckCircle2, 
    Image as ImageIcon, 
    FileText, 
    ChevronRight, 
    ShieldAlert, 
    Trash2, 
    Loader2, 
    Building2, 
    Calendar, 
    Package,
    ArrowRight,
    Sparkles,
    Eye
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import Portal from "../../../../components/client/Portal";
import { user } from "../../../../lib/services/Class/user";
import { 
    reportDefectiveItemAction, 
    DefectType, 
    RequestedResolution 
} from "../../server/supplier-returns-actions";

interface ReportDefectiveItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrders: any[];
    initialPO?: any | null;
    onSuccess?: () => void;
}

export function ReportDefectiveItemsModal({
    isOpen,
    onClose,
    purchaseOrders,
    initialPO,
    onSuccess,
}: ReportDefectiveItemsModalProps) {
    // Selection state
    const [selectedPOId, setSelectedPOId] = useState<string>("");
    const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

    // Form inputs
    const [defectiveQuantity, setDefectiveQuantity] = useState<number>(1);
    const [defectType, setDefectType] = useState<DefectType>("Damaged");
    const [defectDescription, setDefectDescription] = useState<string>("");
    const [requestedResolution, setRequestedResolution] = useState<RequestedResolution>("Replacement");
    const [inspectionDate, setInspectionDate] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [additionalNotes, setAdditionalNotes] = useState<string>("");
    const [isDiscoveredPostReceiving, setIsDiscoveredPostReceiving] = useState<boolean>(false);

    // Photos / Evidence state
    const [uploadedEvidence, setUploadedEvidence] = useState<{ url: string; name: string }[]>([]);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    // Step state: 1 = Form Entry, 2 = Review Summary
    const [currentStep, setCurrentStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Set initial PO if passed
    useEffect(() => {
        if (isOpen) {
            if (initialPO) {
                setSelectedPOId(String(initialPO.id || initialPO.po_number));
            } else if (purchaseOrders.length > 0 && !selectedPOId) {
                setSelectedPOId(String(purchaseOrders[0].id || purchaseOrders[0].po_number));
            }
            setSelectedItemIndex(0);
            setCurrentStep(1);
        }
    }, [isOpen, initialPO, purchaseOrders]);

    // Active selected PO
    const activePO = useMemo(() => {
        if (!selectedPOId) return null;
        return (
            purchaseOrders.find(
                (po) =>
                    String(po.id) === selectedPOId ||
                    String(po.po_number) === selectedPOId
            ) || null
        );
    }, [selectedPOId, purchaseOrders]);

    // Available items for the selected PO
    const poItems = useMemo(() => {
        if (!activePO) return [];
        if (Array.isArray(activePO.items) && activePO.items.length > 0) {
            return activePO.items;
        }
        return [
            {
                name: activePO.item_name || "General Supplies",
                item_name: activePO.item_name || "General Supplies",
                item_code: activePO.item_code || "ITM-PO",
                quantity: activePO.quantity || 1,
                unit: activePO.unit || "units",
            },
        ];
    }, [activePO]);

    const activeItem = poItems[selectedItemIndex] || poItems[0] || null;

    // Recorded or eligible quantity received
    const maxEligibleQty = useMemo(() => {
        if (!activeItem) return 1;
        const recorded = Number(
            activeItem.quantity_received ||
            activeItem.quantity_ordered ||
            activeItem.quantity ||
            1
        );
        return Math.max(1, recorded);
    }, [activeItem]);

    // Auto-adjust defective quantity if exceeds new max
    useEffect(() => {
        if (defectiveQuantity > maxEligibleQty) {
            setDefectiveQuantity(maxEligibleQty);
        }
    }, [maxEligibleQty]);

    // Handle evidence photos upload to Supabase Storage
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadedUrls: { url: string; name: string }[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split(".").pop();
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                const filePath = `defects/${Date.now()}_${sanitizedName}`;

                // Try supplier_documents first, fallback to documents
                let { error: uploadError } = await supabase.storage
                    .from("supplier_documents")
                    .upload(filePath, file, { cacheControl: "3600", upsert: true });

                let publicUrl = "";
                if (!uploadError) {
                    const { data: urlData } = supabase.storage
                        .from("supplier_documents")
                        .getPublicUrl(filePath);
                    publicUrl = urlData.publicUrl;
                } else {
                    const { error: docErr } = await supabase.storage
                        .from("documents")
                        .upload(filePath, file, { cacheControl: "3600", upsert: true });

                    if (docErr) throw new Error(docErr.message);

                    const { data: docUrlData } = supabase.storage
                        .from("documents")
                        .getPublicUrl(filePath);
                    publicUrl = docUrlData.publicUrl;
                }

                if (publicUrl) {
                    uploadedUrls.push({ url: publicUrl, name: file.name });
                }
            }

            setUploadedEvidence((prev) => [...prev, ...uploadedUrls]);
            toast.success(`${uploadedUrls.length} evidence photo(s) uploaded successfully.`);
        } catch (err: any) {
            console.error("Error uploading evidence:", err);
            toast.error(err.message || "Failed to upload photo evidence.");
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = "";
        }
    };

    const handleRemoveEvidence = (indexToRemove: number) => {
        setUploadedEvidence((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // Proceed to Review Summary
    const handleProceedToReview = (e: React.FormEvent) => {
        e.preventDefault();

        if (!activePO) {
            toast.error("Please select a valid Purchase Order.");
            return;
        }

        if (!activeItem) {
            toast.error("Please select an item from the Purchase Order.");
            return;
        }

        if (defectiveQuantity <= 0) {
            toast.error("Defective quantity must be greater than zero.");
            return;
        }

        if (defectiveQuantity > maxEligibleQty) {
            toast.error(
                `Defective quantity (${defectiveQuantity}) cannot exceed eligible received quantity (${maxEligibleQty}).`
            );
            return;
        }

        if (!defectDescription.trim()) {
            toast.error("Please provide a detailed defect description.");
            return;
        }

        setCurrentStep(2);
    };

    // Final Submission
    const handleFinalSubmit = async () => {
        if (!activePO || !activeItem) return;

        setIsSubmitting(true);
        try {
            const reporterName = user.getName() || "Warehouse Staff";
            const reporterId = user.getId() || undefined;

            const res = await reportDefectiveItemAction({
                purchaseOrderId: activePO.id,
                poNumber: activePO.po_number || `PO-${activePO.id}`,
                supplierId: activePO.supplier_id,
                supplierName: activePO.supplier_name || "Vendor",
                supplierEmail: activePO.supplier_email,
                itemId: activeItem.id || activeItem.item_id,
                itemCode: activeItem.item_code || activeItem.code || "ITM-UNSPECIFIED",
                itemName: activeItem.item_name || activeItem.name || "Supplies",
                unit: activeItem.unit || "units",
                quantityReceived: maxEligibleQty,
                defectiveQuantity: Number(defectiveQuantity),
                defectType,
                defectDescription,
                evidenceUrls: uploadedEvidence.map((e) => e.url),
                inspectionDate,
                requestedResolution,
                additionalNotes,
                reporterName,
                reporterId,
                isDiscoveredPostReceiving,
            });

            if (!res.success) {
                throw new Error(res.error || "Failed to report defective items.");
            }

            toast.success(
                `Defective incident ${res.incidentNumber} & Return Request ${res.returnRequestNumber} created successfully! Defective stock moved to quarantine.`
            );

            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Submission error:", err);
            toast.error(err.message || "Failed to submit defect report.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/[0.08] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-500/20 shadow-sm">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Report Defective Items
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300">
                                        Step {currentStep} of 2
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {currentStep === 1
                                        ? "Log damaged, nonconforming, or defective supplies to quarantine & initiate return"
                                        : "Review and verify incident details before forwarding to Procurement"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="p-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                        {currentStep === 1 ? (
                            <form id="defectForm" onSubmit={handleProceedToReview} className="space-y-4">
                                {/* Row 1: Purchase Order & Supplier */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Related Purchase Order <span className="text-pink-500">*</span>
                                        </label>
                                        <select
                                            value={selectedPOId}
                                            onChange={(e) => {
                                                setSelectedPOId(e.target.value);
                                                setSelectedItemIndex(0);
                                            }}
                                            required
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm"
                                        >
                                            <option value="">Select Purchase Order...</option>
                                            {purchaseOrders.map((po) => (
                                                <option key={po.id || po.po_number} value={po.id || po.po_number}>
                                                    #{po.po_number} — {po.supplier_name || "Supplier"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Supplier <span className="text-slate-400 font-normal">(Auto-populated)</span>
                                        </label>
                                        <div className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                            <span className="font-semibold truncate">
                                                {activePO?.supplier_name || "Select a PO above"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: PO Line Item & Quantity */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Item on Purchase Order <span className="text-pink-500">*</span>
                                        </label>
                                        <select
                                            value={selectedItemIndex}
                                            onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
                                            required
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm"
                                        >
                                            {poItems.map((item: any, idx: number) => (
                                                <option key={idx} value={idx}>
                                                    {item.item_name || item.name || `Item ${idx + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Received / Expected Qty
                                        </label>
                                        <div className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                                            {maxEligibleQty} {activeItem?.unit || "units"}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Defective Quantity <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={maxEligibleQty}
                                            value={defectiveQuantity}
                                            onChange={(e) => setDefectiveQuantity(Number(e.target.value))}
                                            required
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Defect Type & Requested Resolution */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Defect Classification <span className="text-pink-500">*</span>
                                        </label>
                                        <select
                                            value={defectType}
                                            onChange={(e) => setDefectType(e.target.value as DefectType)}
                                            required
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm"
                                        >
                                            <option value="Damaged">Damaged (Physical impact, broken packaging)</option>
                                            <option value="Defective">Defective (Functional failure, manufacturing defect)</option>
                                            <option value="Incorrect Item">Incorrect Item (Wrong SKU / Barcode delivered)</option>
                                            <option value="Wrong Specification">Wrong Specification (Size, rating, color mismatch)</option>
                                            <option value="Missing Parts">Missing Parts (Incomplete package components)</option>
                                            <option value="Other">Other Nonconformance</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Requested Resolution
                                        </label>
                                        <select
                                            value={requestedResolution}
                                            onChange={(e) => setRequestedResolution(e.target.value as RequestedResolution)}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm"
                                        >
                                            <option value="Replacement">Replacement (Vendor supplies new units)</option>
                                            <option value="Refund">Refund (Credit back / refund disbursement)</option>
                                            <option value="Supplier Credit">Supplier Credit (Credit note for future PO)</option>
                                            <option value="Pending Supplier Review">Pending Supplier Review</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 4: Inspection Date & Reported By */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Inspection Date
                                        </label>
                                        <input
                                            type="date"
                                            value={inspectionDate}
                                            onChange={(e) => setInspectionDate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Reported By <span className="text-slate-400 font-normal">(Authenticated)</span>
                                        </label>
                                        <div className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold truncate">
                                            {user.getName() || "Warehouse Receiving Staff"}
                                        </div>
                                    </div>
                                </div>

                                {/* Defect Description */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Defect Description & Nonconformance Details <span className="text-pink-500">*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={defectDescription}
                                        onChange={(e) => setDefectDescription(e.target.value)}
                                        placeholder="Describe the defect, condition upon inspection, batch numbers, or reasons for rejection..."
                                        required
                                        className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-[#14151c] border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 shadow-sm resize-none"
                                    />
                                </div>

                                {/* Photos & Evidence Dropzone */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Photos & Evidence <span className="text-slate-400 font-normal">(Supabase Storage)</span>
                                        </label>
                                        <span className="text-[11px] text-slate-400">
                                            {uploadedEvidence.length} file(s) attached
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/20 text-center hover:border-pink-500/50 transition-colors">
                                        <input
                                            type="file"
                                            id="defect-evidence-upload"
                                            multiple
                                            accept="image/*,.pdf"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="defect-evidence-upload"
                                            className="cursor-pointer flex flex-col items-center justify-center gap-1.5 text-xs"
                                        >
                                            {isUploading ? (
                                                <div className="flex items-center gap-2 text-pink-600 font-bold">
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Uploading evidence photos to storage...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <UploadCloud className="w-7 h-7 text-pink-500" />
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        Click or drop photos of defective parts & packaging
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Supports PNG, JPG, WebP, PDF. Stored securely.
                                                    </span>
                                                </>
                                            )}
                                        </label>
                                    </div>

                                    {/* Previews */}
                                    {uploadedEvidence.length > 0 && (
                                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {uploadedEvidence.map((ev, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-video flex items-center justify-center"
                                                >
                                                    <img
                                                        src={ev.url}
                                                        alt={ev.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = "none";
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <a
                                                            href={ev.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded-lg bg-white/80 text-slate-900 hover:bg-white text-xs"
                                                            title="View full image"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveEvidence(idx)}
                                                            className="p-1 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 text-xs cursor-pointer"
                                                            title="Remove image"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Discovery timing checkbox */}
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                                    <input
                                        type="checkbox"
                                        id="postReceivingCheckbox"
                                        checked={isDiscoveredPostReceiving}
                                        onChange={(e) => setIsDiscoveredPostReceiving(e.target.checked)}
                                        className="mt-0.5 rounded text-pink-600 focus:ring-pink-500"
                                    />
                                    <label htmlFor="postReceivingCheckbox" className="cursor-pointer">
                                        <span className="font-bold">Discovered after receiving completed?</span>
                                        <span className="block text-[11px] opacity-90">
                                            If checked, this item was already restocked into usable inventory. Submitting will safely deduct the {defectiveQuantity} unit(s) from usable stock and move them to quarantine stock with a traceable movement record.
                                        </span>
                                    </label>
                                </div>
                            </form>
                        ) : (
                            /* Step 2: Review Summary */
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 text-xs text-pink-800 dark:text-pink-300">
                                    <p className="font-bold">
                                        Please review the defect incident details carefully before submitting.
                                    </p>
                                    <p className="text-[11px] opacity-90 mt-0.5">
                                        A formal Return Request will be initiated and forwarded to the Procurement team for supplier negotiations. Usable stock will not be contaminated.
                                    </p>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5 text-xs">
                                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Purchase Order</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                #{activePO?.po_number}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Supplier</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {activePO?.supplier_name}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Affected Item</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {activeItem?.item_name || activeItem?.name}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Defective Quantity</span>
                                            <span className="font-bold text-pink-600 dark:text-pink-400 text-sm">
                                                {defectiveQuantity} {activeItem?.unit || "units"} (out of {maxEligibleQty} received)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Defect Type</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {defectType}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Requested Resolution</span>
                                            <span className="font-bold text-slate-800 dark:text-white">
                                                {requestedResolution}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[11px] mb-1">Defect Description</span>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                            {defectDescription}
                                        </div>
                                    </div>

                                    {uploadedEvidence.length > 0 && (
                                        <div>
                                            <span className="text-slate-400 block text-[11px] mb-1">
                                                Evidence Photos ({uploadedEvidence.length})
                                            </span>
                                            <div className="flex items-center gap-2 overflow-x-auto py-1">
                                                {uploadedEvidence.map((ev, i) => (
                                                    <img
                                                        key={i}
                                                        src={ev.url}
                                                        alt={ev.name}
                                                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                                        <span>Inspection Date: {inspectionDate}</span>
                                        <span>Reported By: {user.getName() || "Warehouse Staff"}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Controls */}
                    <div className="p-4 sm:p-5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/40 dark:bg-white/[0.02]">
                        {currentStep === 1 ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="defectForm"
                                    disabled={!activePO || isUploading}
                                    className="px-5 py-2.5 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-[0_4px_14px_rgba(236,72,153,0.4)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                    <span>Review Summary</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    Back to Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFinalSubmit}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-[0_4px_14px_rgba(236,72,153,0.45)] transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Submitting & Quarantining Stock...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Confirm & Submit Return Request</span>
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
