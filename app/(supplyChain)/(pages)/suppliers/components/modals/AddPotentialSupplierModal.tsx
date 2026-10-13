// app/(supplyChain)/(pages)/suppliers/components/modals/AddPotentialSupplierModal.tsx
"use client";

import React, { useState, useMemo } from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import {
    Store,
    Building2,
    User,
    Phone,
    Mail,
    MapPin,
    Globe,
    Package,
    Tag,
    FileText,
    DollarSign,
    Sparkles,
    X,
    PlusCircle,
    Layers,
    Clock,
    CheckCircle2
} from "lucide-react";

export const SUPPLIER_CATEGORIES = [
    "General Supplies",
    "Packaging & Boxes",
    "Auto Parts & Tires",
    "Fleet Maintenance",
    "IT & Electronics",
    "Office Supplies & Equipment",
    "Safety & PPE",
    "Warehousing & Material Handling",
    "Tools & Hardware",
    "Cleaning & Janitorial",
    "Packaging & Shipping Consumables",
    "Other",
];

interface AddPotentialSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSupplierAdded: () => void;
    availableRequests?: Array<{
        id: string;
        requestNumber: string;
        itemName: string;
        category?: string;
        department?: string;
        supplierCount?: number;
    }>;
    initialRequestId?: string;
}

export function AddPotentialSupplierModal({
    isOpen,
    onClose,
    onSupplierAdded,
    availableRequests = [],
    initialRequestId = "",
}: AddPotentialSupplierModalProps) {
    const [selectedRequestId, setSelectedRequestId] = useState<string>(initialRequestId);
    const [customRequestNumber, setCustomRequestNumber] = useState<string>("");
    const [name, setName] = useState<string>("");
    const [category, setCategory] = useState<string>("Packaging & Boxes");
    const [contactPerson, setContactPerson] = useState<string>("");
    const [phone, setPhone] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [location, setLocation] = useState<string>("Metro Manila, Philippines");
    const [website, setWebsite] = useState<string>("");
    const [products, setProducts] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    // Filter requests that are: (1) New and have no suppliers yet, OR (2) Category is 'others' / 'other'
    const eligibleRequests = useMemo(() => {
        return availableRequests.filter((req) => {
            // Keep if explicitly preselected by clicking "+ Add Lead" on a group
            if (initialRequestId && req.id === initialRequestId) return true;
            // 1. Has no potential suppliers
            const hasNoSuppliers = req.supplierCount === undefined || req.supplierCount === 0;
            // 2. Or category is 'others' / 'other'
            const cat = (req.category || "").trim().toLowerCase();
            const isOthers = cat === "others" || cat === "other" || cat.includes("other");
            return hasNoSuppliers || isOthers;
        });
    }, [availableRequests, initialRequestId]);

    // Optional Quote entry
    const [hasQuote, setHasQuote] = useState<boolean>(false);
    const [quotePrice, setQuotePrice] = useState<string>("");
    const [quoteQuantity, setQuoteQuantity] = useState<string>("1");
    const [quoteUnit, setQuoteUnit] = useState<string>("pcs");
    const [quoteShippingFee, setQuoteShippingFee] = useState<string>("0");
    const [quoteDiscount, setQuoteDiscount] = useState<string>("0");
    const [quoteTaxType, setQuoteTaxType] = useState<string>("VAT 12%");
    const [quoteTaxRate, setQuoteTaxRate] = useState<string>("12");
    const [quoteLeadTime, setQuoteLeadTime] = useState<string>("3-5");
    const [quoteAvailability, setQuoteAvailability] = useState<string>("In Stock (Immediate Dispatch)");

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Live quotation calculation engine
    const quoteSubtotal = useMemo(() => {
        const p = parseFloat(quotePrice) || 0;
        const q = parseFloat(quoteQuantity) || 1;
        return Math.max(0, p * q);
    }, [quotePrice, quoteQuantity]);

    const quoteDiscountNum = useMemo(() => {
        return Math.max(0, parseFloat(quoteDiscount) || 0);
    }, [quoteDiscount]);

    const quoteShippingNum = useMemo(() => {
        return Math.max(0, parseFloat(quoteShippingFee) || 0);
    }, [quoteShippingFee]);

    const quoteEffectiveTaxRate = useMemo(() => {
        if (quoteTaxType === "VAT 12%") return 12;
        if (quoteTaxType === "Non-VAT 0%" || quoteTaxType === "Zero-Rated 0%") return 0;
        return Math.max(0, parseFloat(quoteTaxRate) || 0);
    }, [quoteTaxType, quoteTaxRate]);

    const quoteTaxAmount = useMemo(() => {
        const taxableBase = Math.max(0, quoteSubtotal - quoteDiscountNum);
        return (taxableBase * quoteEffectiveTaxRate) / 100;
    }, [quoteSubtotal, quoteDiscountNum, quoteEffectiveTaxRate]);

    const quoteCalculatedTotal = useMemo(() => {
        const taxableBase = Math.max(0, quoteSubtotal - quoteDiscountNum);
        return taxableBase + quoteShippingNum + quoteTaxAmount;
    }, [quoteSubtotal, quoteDiscountNum, quoteShippingNum, quoteTaxAmount]);

    // Reset form when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setSelectedRequestId(initialRequestId);
            setCustomRequestNumber("");
            setName("");
            setContactPerson("");
            setPhone("");
            setEmail("");
            setLocation("Metro Manila, Philippines");
            setWebsite("");
            setProducts("");
            setNotes("");
            setHasQuote(false);
            setQuotePrice("");
            setQuoteQuantity("1");
            setQuoteUnit("pcs");
            setQuoteShippingFee("0");
            setQuoteDiscount("0");
            setQuoteTaxType("VAT 12%");
            setQuoteTaxRate("12");
            setQuoteLeadTime("3-5");
            setQuoteAvailability("In Stock (Immediate Dispatch)");

            // Auto-select category if PR is selected
            if (initialRequestId) {
                const found = eligibleRequests.find((r) => r.id === initialRequestId);
                if (found?.category) {
                    setCategory(found.category);
                }
                if (found?.itemName) {
                    setProducts(found.itemName);
                }
            }
        }
    }, [isOpen, initialRequestId, eligibleRequests]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Supplier / Business Name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Determine linked request details
            let linkedPrId: string | null = null;
            let linkedReqNumber = "";

            if (selectedRequestId && selectedRequestId !== "unlinked") {
                const matched = availableRequests.find((r) => r.id === selectedRequestId);
                if (matched) {
                    linkedPrId = matched.id;
                    linkedReqNumber = matched.requestNumber;
                } else {
                    linkedReqNumber = selectedRequestId;
                }
            } else if (customRequestNumber.trim()) {
                linkedReqNumber = customRequestNumber.trim();
            }

            // Build notes tag so it gets grouped cleanly
            const notesTags = [
                "[Manual Potential Supplier Lead]",
                `Added: ${new Date().toLocaleDateString()}`,
                linkedReqNumber ? `Request ID: ${linkedReqNumber}` : null,
                notes.trim() ? `Remarks: ${notes.trim()}` : null,
            ]
                .filter(Boolean)
                .join(" | ");

            const supplierPayload: Record<string, any> = {
                name: name.trim(),
                category: category || "General Supplies",
                contact_person: contactPerson.trim() || null,
                phone: phone.trim() || null,
                email: email.trim() || null,
                location: location.trim() || "Metro Manila, Philippines",
                products: products.trim() || `${category} Supplies`,
                fb_link: website.trim() || null,
                notes: notesTags,
                is_active: false,
            };

            // Only attach purchase_request_id if valid UUID
            if (linkedPrId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkedPrId)) {
                supplierPayload.purchase_request_id = linkedPrId;
            }

            // 1. Insert into public.suppliers
            const { data: insertedSupplier, error: insertError } = await supabase
                .from("suppliers")
                .insert([supplierPayload])
                .select()
                .single();

            if (insertError) {
                console.error("Error inserting potential supplier:", insertError);
                throw insertError;
            }

            // 2. If quote was provided, insert initial quotation record with financial breakdown
            if (hasQuote && quotePrice && !isNaN(Number(quotePrice)) && Number(quotePrice) > 0) {
                const unitPrice = Number(quotePrice);
                const qty = Number(quoteQuantity) || 1;

                const quotePayload: Record<string, any> = {
                    supplier_id: insertedSupplier.id,
                    supplier_name: name.trim(),
                    contact_person: contactPerson.trim() || name.trim(),
                    contact_phone: phone.trim() || null,
                    contact_email: email.trim() || null,
                    request_number: linkedReqNumber || `REQ-${Date.now().toString().slice(-6)}`,
                    item_name: products.trim() || `${category} item`,
                    quantity: qty,
                    unit: quoteUnit || "pcs",
                    unit_price: unitPrice,
                    subtotal: quoteSubtotal,
                    shipping_fee: quoteShippingNum,
                    discount: quoteDiscountNum,
                    tax_type: quoteTaxType,
                    tax_rate: quoteEffectiveTaxRate,
                    tax_amount: quoteTaxAmount,
                    total_amount: quoteCalculatedTotal,
                    availability: quoteAvailability,
                    lead_time_days: quoteLeadTime || "3-5",
                    notes: `Manually Recorded Quote | Sourced Lead`,
                    status: "pending",
                };

                const { error: quoteErr } = await supabase
                    .from("supplier_quotations")
                    .insert([quotePayload]);

                if (quoteErr) {
                    console.warn("Notice saving initial supplier quotation:", quoteErr);
                }
            }

            toast.success(`Potential supplier "${name}" added successfully!`);
            onSupplierAdded();
            onClose();
        } catch (err: any) {
            console.error("Failed to add potential supplier:", err);
            toast.error(err?.message || "Failed to add potential supplier.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[130] bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-3xl bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                <PlusCircle className="w-6 h-6 drop-shadow" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                                        Add Potential Supplier
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60">
                                        Sourcing Lead
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Manually record a discovered vendor lead or store for requisition price comparison.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] cursor-pointer transition-all"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                        {/* Section 1: Requisition Link */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-3">
                            <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                <span>Link to Purchase Requisition (Requisition Group)</span>
                            </label>

                            <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <select
                                            value={selectedRequestId}
                                            onChange={(e) => {
                                                setSelectedRequestId(e.target.value);
                                                if (e.target.value !== "unlinked" && e.target.value !== "custom") {
                                                    const match = eligibleRequests.find((r) => r.id === e.target.value);
                                                    if (match?.category) setCategory(match.category);
                                                    if (match?.itemName && !products) setProducts(match.itemName);
                                                }
                                            }}
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        >
                                            <option value="unlinked">-- Standalone / General Sourcing Lead --</option>
                                            {eligibleRequests.map((req) => {
                                                const cat = (req.category || "").trim().toLowerCase();
                                                const isOthers = cat === "others" || cat === "other" || cat.includes("other");
                                                const badge = (req.supplierCount === 0 || req.supplierCount === undefined)
                                                    ? "New • No Supplier"
                                                    : isOthers
                                                    ? "Category: Others"
                                                    : "";

                                                return (
                                                    <option key={req.id} value={req.id}>
                                                        {req.requestNumber} - {req.itemName} ({badge || req.department || "Warehouse"})
                                                    </option>
                                                );
                                            })}
                                            <option value="custom">+ Type Custom Requisition Number...</option>
                                        </select>
                                    </div>

                                    {selectedRequestId === "custom" && (
                                        <div>
                                            <input
                                                type="text"
                                                value={customRequestNumber}
                                                onChange={(e) => setCustomRequestNumber(e.target.value)}
                                                placeholder="e.g. PR-00459"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                            />
                                        </div>
                                    )}
                                </div>

                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-0.5">
                                    <Sparkles className="w-3 h-3 text-pink-500 shrink-0" />
                                    <span>Showing requisitions that are new without assigned suppliers, or categorized under &ldquo;Others&rdquo;.</span>
                                </p>
                            </div>
                        </div>

                        {/* Section 2: Business & Contact Details */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-4">
                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-300/70 dark:border-white/10 pb-2">
                                <Building2 className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                <span>Supplier Business &amp; Contact Details</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Supplier / Store Name <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Apex Industrial Supplies & Packaging"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Category <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        >
                                            {SUPPLIER_CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Contact Representative
                                    </label>
                                    <div className="relative">
                                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={contactPerson}
                                            onChange={(e) => setContactPerson(e.target.value)}
                                            placeholder="e.g. Maria Santos (Sales Mgr)"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Phone / Mobile
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+63 912 345 6789 or (02) 8123 4567"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Email Address <span className="text-slate-400 text-[10px]">(Enables 1-Click RFQ)</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="sales@apexsupplies.ph"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Physical Store / Warehouse Address
                                    </label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="e.g. 452 Juan Luna St, Binondo, Manila"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Products &amp; Items Offered
                                    </label>
                                    <div className="relative">
                                        <Package className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={products}
                                            onChange={(e) => setProducts(e.target.value)}
                                            placeholder="e.g. Corrugated boxes, packaging tape, pallet stretch wrap"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Website / Facebook Page
                                    </label>
                                    <div className="relative">
                                        <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                            placeholder="https://facebook.com/apexsupplies"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Sourcing Remarks / Notes
                                    </label>
                                    <div className="relative">
                                        <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="e.g. Sourced via walk-in visit, recommended supplier"
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Optional Initial Quotation Entry */}
                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hasQuote}
                                        onChange={(e) => setHasQuote(e.target.checked)}
                                        className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>Record Initial Price Quotation / Canvas Bid (Optional)</span>
                                </label>
                                <span className="text-[10px] text-slate-400">
                                    Enables immediate bid comparison
                                </span>
                            </div>

                            {hasQuote && (
                                <div className="space-y-3 pt-2 border-t border-slate-300/60 dark:border-white/10 animate-in fade-in duration-150">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Unit Price (₱) <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={quotePrice}
                                                    onChange={(e) => setQuotePrice(e.target.value)}
                                                    placeholder="e.g. 150.00"
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Quantity &amp; Unit
                                            </label>
                                            <div className="flex gap-1.5">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={quoteQuantity}
                                                    onChange={(e) => setQuoteQuantity(e.target.value)}
                                                    className="w-16 bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                                />
                                                <input
                                                    type="text"
                                                    value={quoteUnit}
                                                    onChange={(e) => setQuoteUnit(e.target.value)}
                                                    placeholder="pcs"
                                                    className="flex-1 bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Lead Time (Days)
                                            </label>
                                            <input
                                                type="text"
                                                value={quoteLeadTime}
                                                onChange={(e) => setQuoteLeadTime(e.target.value)}
                                                placeholder="3-5"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Additional Fees, Tax & Discount */}
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Discount (₱)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={quoteDiscount}
                                                onChange={(e) => setQuoteDiscount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Shipping Fee (₱)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={quoteShippingFee}
                                                onChange={(e) => setQuoteShippingFee(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Tax Type
                                            </label>
                                            <select
                                                value={quoteTaxType}
                                                onChange={(e) => setQuoteTaxType(e.target.value)}
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                            >
                                                <option value="VAT 12%">VAT (12%)</option>
                                                <option value="Non-VAT 0%">Non-VAT (0%)</option>
                                                <option value="Zero-Rated 0%">Zero-Rated (0%)</option>
                                                <option value="Others">Others / Custom VAT (%)</option>
                                                <option value="Custom %">Custom Tax %</option>
                                            </select>
                                        </div>

                                        {(quoteTaxType === "Custom %" || quoteTaxType === "Others") ? (
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Custom Rate (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    value={quoteTaxRate}
                                                    onChange={(e) => setQuoteTaxRate(e.target.value)}
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    Stock Availability
                                                </label>
                                                <input
                                                    type="text"
                                                    value={quoteAvailability}
                                                    onChange={(e) => setQuoteAvailability(e.target.value)}
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] rounded-none px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Real-time Calculation Summary Badge */}
                                    <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-300/60 dark:border-pink-800/40 flex items-center justify-between text-xs">
                                        <div className="space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                                            <div>
                                                Subtotal: <span className="font-mono font-bold">₱{quoteSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                {quoteDiscountNum > 0 && <span className="text-emerald-600 dark:text-emerald-400 ml-2 font-bold">-₱{quoteDiscountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                                                {quoteShippingNum > 0 && <span className="ml-2">+₱{quoteShippingNum.toLocaleString(undefined, { minimumFractionDigits: 2 })} ship</span>}
                                                <span className="ml-2 text-slate-500">+₱{quoteTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({quoteEffectiveTaxRate}% Tax)</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 block">Total Quoted Bid</span>
                                            <span className="font-mono text-base font-black text-pink-700 dark:text-pink-300">
                                                ₱{quoteCalculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </AppButton>
                            <AppButton
                                type="submit"
                                variant="primary"
                                size="md"
                                disabled={isSubmitting || !name.trim()}
                                className="bg-pink-600 hover:bg-pink-500 text-white font-black cursor-pointer shadow-md"
                            >
                                <PlusCircle className="w-4 h-4" />
                                <span>{isSubmitting ? "Adding..." : "Add Potential Supplier"}</span>
                            </AppButton>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
