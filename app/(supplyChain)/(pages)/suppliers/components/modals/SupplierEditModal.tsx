// modal component for editing vendor records, commercial parameters, catalog, and operational status

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { sanitizeText } from "../../../../components/global/sanitize";
import { Supplier } from "../../types";
import {
    Building2,
    CreditCard,
    Package,
    Shield,
    FileText,
    Plus,
    Trash2,
    Check,
    X,
    Sparkles,
    AlertCircle,
    Receipt,
    Clock,
    Truck,
    RotateCcw,
    DollarSign
} from "lucide-react";

interface SupplierEditModalProps {
    isOpen: boolean;
    isSubmitting: boolean;
    editingSupplier: Supplier | null;
    categories: string[];
    setEditingSupplier: React.Dispatch<React.SetStateAction<Supplier | null>>;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

const PAYMENT_TERMS_OPTIONS = [
    "Net 30 Days",
    "Net 15 Days",
    "Net 60 Days",
    "Cash on Delivery (COD)",
    "Payment Upon Delivery",
    "100% Advance Payment",
    "50% DP, 50% Upon Delivery",
    "Net 7 Days",
    "Custom Terms",
];

const PAYMENT_METHOD_OPTIONS = [
    "Bank Transfer",
    "Company Check",
    "Cash on Delivery",
    "Electronic Fund Transfer (EFT)",
    "GCash / E-Wallet",
    "Letter of Credit (LC)",
    "Custom Method",
];

const DELIVERY_TERMS_OPTIONS = [
    "Door-to-Door Delivery (DDP)",
    "FOB Destination",
    "FOB Origin / Supplier Warehouse",
    "Pickup from Supplier Hub",
    "Direct Warehouse Dropoff",
    "Freight / Express Delivery",
];

const TAX_CLASSIFICATION_OPTIONS = [
    "VAT Registered (12%)",
    "Non-VAT Registered (3%)",
    "Tax Exempt",
    "Zero Rated",
];

const DEFAULT_TERMS = `1. Supplier shall deliver the items according to the quantity and specifications stated in the Purchase Order.
2. Delivered items are subject to inspection and verification.
3. Damaged, defective, or incorrect items may be rejected or returned.
4. Payment shall follow the agreed payment terms.
5. Supplier must provide the required delivery and supporting documents.`;

export function SupplierEditModal({
    isOpen,
    isSubmitting,
    editingSupplier,
    categories,
    setEditingSupplier,
    onClose,
    onSubmit,
}: SupplierEditModalProps) {
    const [activeTab, setActiveTab] = useState<"general" | "commercial" | "banking" | "catalog" | "status">("general");

    // Initialize structured products offer array
    const rawCatalog: any[] = useMemo(() => {
        if (!editingSupplier) return [];
        if (Array.isArray(editingSupplier.other_products_offer)) {
            return editingSupplier.other_products_offer;
        }
        if (typeof editingSupplier.other_products_offer === "string") {
            try {
                const parsed = JSON.parse(editingSupplier.other_products_offer);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }, [editingSupplier?.other_products_offer]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab("general");
        }
    }, [isOpen]);

    if (!isOpen || !editingSupplier) return null;

    // Helper to update top-level supplier properties
    const updateField = (field: keyof Supplier, value: any) => {
        setEditingSupplier((prev) => {
            if (!prev) return null;
            return { ...prev, [field]: value };
        });
    };

    // Catalog item helpers
    const handleAddCatalogItem = () => {
        const newItem = {
            id: `cat_${Date.now()}`,
            item_name: "",
            unit: "unit",
            unit_price: 0,
            discount: 0,
            shipping_fee: 0,
            tax_classification: editingSupplier.tax_type?.toLowerCase().includes("non-vat") ? "non-vat" : "vatable",
            tax_rate: editingSupplier.tax_type?.toLowerCase().includes("non-vat") ? 3 : 12,
            total_amount: 0,
            notes: "",
        };

        const currentCatalog = [...rawCatalog, newItem];
        updateField("other_products_offer", currentCatalog);
    };

    const handleUpdateCatalogItem = (index: number, field: string, val: any) => {
        const updated = [...rawCatalog];
        const target = { ...updated[index], [field]: val };

        // Recalculate totals
        const price = Number(target.unit_price) || 0;
        const disc = Number(target.discount) || 0;
        const ship = Number(target.shipping_fee) || 0;
        const taxRate = Number(target.tax_rate) !== undefined ? Number(target.tax_rate) : 12;
        const taxable = Math.max(0, price - disc);
        const tax = Number(((taxable * taxRate) / 100).toFixed(2));
        target.total_amount = Number((taxable + tax + ship).toFixed(2));

        updated[index] = target;
        updateField("other_products_offer", updated);
    };

    const handleRemoveCatalogItem = (index: number) => {
        const updated = rawCatalog.filter((_, i) => i !== index);
        updateField("other_products_offer", updated);
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[140] bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-4xl bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                <i className="fas fa-edit text-lg drop-shadow" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                                        Edit Supplier: {editingSupplier.name || "Vendor Profile"}
                                    </h3>
                                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] text-pink-600 dark:text-pink-400 font-bold border border-slate-300/80 dark:border-white/10 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.3)]">
                                        SUP-{String(editingSupplier.id).padStart(3, "0")}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Manage vendor identity, commercial agreements, products catalog, and compliance
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

                    {/* Navigation Tabs Bar */}
                    <div className="px-6 py-3 bg-[#e4eaf4] dark:bg-[#10121c] border-b border-slate-300/70 dark:border-white/[0.06] flex items-center justify-between flex-wrap gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] flex-wrap">
                            <button
                                type="button"
                                onClick={() => setActiveTab("general")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeTab === "general"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                1. General Profile
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("commercial")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeTab === "commercial"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                2. Commercial &amp; Terms
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("banking")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === "banking"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>3. Tax &amp; Banking</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("catalog")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === "catalog"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <Package className="w-3.5 h-3.5" />
                                <span>4. Products to Supply</span>
                                {rawCatalog.length > 0 && (
                                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                                        activeTab === "catalog" ? "bg-white text-pink-700" : "bg-pink-600 text-white"
                                    }`}>
                                        {rawCatalog.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("status")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeTab === "status"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                5. Status &amp; Notes
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Form Content */}
                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                        {/* TAB 1: General Profile */}
                        {activeTab === "general" && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Building2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Company &amp; Contact Details</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Supplier Company Name <span className="text-pink-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                value={editingSupplier.name || ""}
                                                onChange={(e) => updateField("name", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Category <span className="text-pink-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 pr-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer font-semibold"
                                                    value={editingSupplier.category || ""}
                                                    onChange={(e) => updateField("category", e.target.value)}
                                                    required
                                                >
                                                    {categories.map((cat) => (
                                                        <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                                            {cat}
                                                        </option>
                                                    ))}
                                                    <option value="General Supplies" className="dark:bg-slate-900 dark:text-slate-200">General Supplies</option>
                                                    <option value="Other" className="dark:bg-slate-900 dark:text-slate-200">Other</option>
                                                </select>
                                                <svg className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Contact Person <span className="text-pink-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.contact_person || ""}
                                                onChange={(e) => updateField("contact_person", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Phone Number <span className="text-pink-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-mono"
                                                value={editingSupplier.phone || ""}
                                                onChange={(e) => updateField("phone", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Email Address <span className="text-pink-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.email || ""}
                                                onChange={(e) => updateField("email", e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Website / Facebook Page Link
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                                placeholder="https://facebook.com/... or https://..."
                                                value={editingSupplier.fb_link || ""}
                                                onChange={(e) => updateField("fb_link", sanitizeText(e.target.value))}
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Complete Location / Office Address <span className="text-pink-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.location || ""}
                                                onChange={(e) => updateField("location", e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Commercial & Terms */}
                        {activeTab === "commercial" && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Clock className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Commercial Parameters &amp; Delivery Agreements</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Payment Terms
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    list="edit-payment-terms-list"
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                    value={editingSupplier.payment_terms || "Net 30 Days"}
                                                    onChange={(e) => updateField("payment_terms", e.target.value)}
                                                />
                                                <datalist id="edit-payment-terms-list">
                                                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Payment Method
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    list="edit-payment-method-list"
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                    value={editingSupplier.payment_method || "Bank Transfer"}
                                                    onChange={(e) => updateField("payment_method", e.target.value)}
                                                />
                                                <datalist id="edit-payment-method-list">
                                                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Delivery Terms
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    list="edit-delivery-terms-list"
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                    value={editingSupplier.delivery_terms || "Door-to-Door Delivery (DDP)"}
                                                    onChange={(e) => updateField("delivery_terms", e.target.value)}
                                                />
                                                <datalist id="edit-delivery-terms-list">
                                                    {DELIVERY_TERMS_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Standard Lead Time
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 3-5 Business Days"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.lead_time || ""}
                                                onChange={(e) => updateField("lead_time", e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Minimum Order Qty (MOQ)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 1 unit / No minimum"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.moq || ""}
                                                onChange={(e) => updateField("moq", e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Warranty Coverage
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 1 Year Standard Warranty"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.warranty || ""}
                                                onChange={(e) => updateField("warranty", e.target.value)}
                                            />
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Return &amp; Replacement Policy
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 7-day replacement for defective items upon delivery verification"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all"
                                                value={editingSupplier.return_policy || ""}
                                                onChange={(e) => updateField("return_policy", e.target.value)}
                                            />
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Governing Terms &amp; Conditions / Special Contract Clauses
                                            </label>
                                            <textarea
                                                rows={4}
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all font-mono leading-relaxed resize-y"
                                                placeholder={DEFAULT_TERMS}
                                                value={editingSupplier.terms_and_conditions || ""}
                                                onChange={(e) => updateField("terms_and_conditions", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Tax & Banking */}
                        {activeTab === "banking" && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <CreditCard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Tax Compliance &amp; Settlement Account Details</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                TIN / Tax Identification Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 123-456-789-000"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-mono font-bold"
                                                value={editingSupplier.tin || editingSupplier.tax_id || ""}
                                                onChange={(e) => {
                                                    updateField("tin", e.target.value);
                                                    updateField("tax_id", e.target.value);
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Tax Classification
                                            </label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 pr-9 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer font-semibold"
                                                    value={editingSupplier.tax_type || "VAT Registered (12%)"}
                                                    onChange={(e) => updateField("tax_type", e.target.value)}
                                                >
                                                    {TAX_CLASSIFICATION_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt} className="dark:bg-slate-900 dark:text-slate-200">
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                                <svg className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Settlement Bank Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. BDO Unibank, BPI, Metrobank"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                value={editingSupplier.bank_name || ""}
                                                onChange={(e) => updateField("bank_name", e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Account Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 0012-3456-7890"
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-mono font-bold"
                                                value={editingSupplier.bank_account_number || ""}
                                                onChange={(e) => updateField("bank_account_number", e.target.value)}
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                                Account Name / Beneficiary Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Acme Corporation Inc."
                                                className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-pink-500 transition-all font-semibold"
                                                value={editingSupplier.bank_account_name || ""}
                                                onChange={(e) => updateField("bank_account_name", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: Products to Supply (Catalog) */}
                        {activeTab === "catalog" && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                                Products to Supply Catalog ({rawCatalog.length})
                                            </h4>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleAddCatalogItem}
                                            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Catalog Item</span>
                                        </button>
                                    </div>

                                    {rawCatalog.length === 0 ? (
                                        <div className="p-8 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-center text-slate-400 dark:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35)] space-y-2">
                                            <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                No structured catalog products registered yet.
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                Click &ldquo;Add Catalog Item&rdquo; above to register items with unit pricing and specifications.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                            {rawCatalog.map((item, idx) => (
                                                <div
                                                    key={item.id || idx}
                                                    className="p-3 bg-white dark:bg-[#131522] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm space-y-2.5"
                                                >
                                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                                        <div className="sm:col-span-4">
                                                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Item Name / Description</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Industrial Tire 195/65 R15"
                                                                value={item.item_name || ""}
                                                                onChange={(e) => handleUpdateCatalogItem(idx, "item_name", e.target.value)}
                                                                className="w-full bg-[#ebf0f7] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-pink-500"
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-2">
                                                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Unit</label>
                                                            <input
                                                                type="text"
                                                                placeholder="unit, box, kg"
                                                                value={item.unit || "unit"}
                                                                onChange={(e) => handleUpdateCatalogItem(idx, "unit", e.target.value)}
                                                                className="w-full bg-[#ebf0f7] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-slate-900 dark:text-white focus:outline-none focus:border-pink-500"
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-3">
                                                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Unit Price (₱)</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step="any"
                                                                placeholder="0.00"
                                                                value={item.unit_price ?? ""}
                                                                onChange={(e) => handleUpdateCatalogItem(idx, "unit_price", e.target.value)}
                                                                className="w-full bg-[#ebf0f7] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-pink-500"
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-2 text-right">
                                                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Tax Rate (%)</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                value={item.tax_rate ?? 12}
                                                                onChange={(e) => handleUpdateCatalogItem(idx, "tax_rate", e.target.value)}
                                                                className="w-full bg-[#ebf0f7] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-pink-500"
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-1 flex justify-end items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCatalogItem(idx)}
                                                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Delete Item"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder="Product specifications / notes (optional)"
                                                            value={item.notes || ""}
                                                            onChange={(e) => handleUpdateCatalogItem(idx, "notes", e.target.value)}
                                                            className="w-full bg-[#f4f7fb] dark:bg-[#181a26] border border-slate-200/60 dark:border-white/5 rounded-lg px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-pink-500"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Legacy Products string */}
                                    <div className="pt-2 border-t border-slate-300/60 dark:border-white/10">
                                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Summary Products &amp; Services (Comma Separated)
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                            placeholder="Tires, Batteries, Motor Oil, Lubricants"
                                            value={editingSupplier.products || ""}
                                            onChange={(e) => updateField("products", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 5: Status & Notes */}
                        {activeTab === "status" && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Shield className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Operational Status &amp; Internal Audit Notes</span>
                                    </h4>

                                    <div className="p-4 bg-white dark:bg-[#10121b] rounded-2xl border border-slate-300/80 dark:border-white/10 shadow-sm">
                                        <label className="flex items-center gap-3.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(editingSupplier.is_active)}
                                                onChange={(e) => updateField("is_active", e.target.checked)}
                                                className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    Active Registered Supplier Status
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                        editingSupplier.is_active
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                                    }`}>
                                                        {editingSupplier.is_active ? "Active" : "Inactive / On Hold"}
                                                    </span>
                                                </span>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {editingSupplier.is_active
                                                        ? "This supplier is verified, active, and can be selected for Purchase Orders and Direct Procurement."
                                                        : "Inactive suppliers remain archived and will not receive automatic purchase allocations."}
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                                            Internal Profile Remarks &amp; Audit Notes
                                        </label>
                                        <textarea
                                            rows={4}
                                            className="w-full bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-pink-500 transition-all resize-y leading-relaxed"
                                            placeholder="Enter internal procurement notes, supplier accreditation details, rating remarks, etc."
                                            value={editingSupplier.notes || ""}
                                            onChange={(e) => updateField("notes", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-300/80 dark:border-white/10 shrink-0">
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                                All modifications will be updated across supplier records.
                            </span>

                            <div className="flex items-center gap-2">
                                <AppButton type="button" variant="neutral" size="sm" onClick={onClose}>
                                    Cancel
                                </AppButton>
                                <AppButton type="submit" variant="primary" size="sm" disabled={isSubmitting} loading={isSubmitting}>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save Supplier Profile</span>
                                </AppButton>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
}
