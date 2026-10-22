// modal component displaying detailed profile and history for a single supplier

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Portal from "../../../../components/client/Portal";
import { AppButton } from "../../../../components/ui/AppButton";
import { Supplier, PurchaseOrder } from "../../types";
import { getStatusBadge, getPaidBadge } from "../../utils/formatters";
import { supabase } from "../../../../lib/services/client/supabase";
import {
    Building2,
    CreditCard,
    FileText,
    Store,
    Phone,
    Mail,
    MapPin,
    Globe,
    Shield,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Package,
    Eye,
    Download,
    ExternalLink,
    FileCheck2,
    Sparkles,
    Edit3,
    Trash2,
    X,
    ShoppingBag,
    Video,
    AlertTriangle
} from "lucide-react";

interface SupplierViewModalProps {
    isOpen: boolean;
    supplier: Supplier | null;
    purchaseOrders: PurchaseOrder[];
    onClose: () => void;
    onEdit: (supplier: Supplier) => void;
    onDelete: (id: number, name: string) => void;
    onScheduleMeeting?: (supplier: Supplier) => void;
}

const DEFAULT_TERMS_AND_CONDITIONS = `1. Supplier shall deliver the items according to the quantity and specifications stated in the Purchase Order.
2. Delivered items are subject to inspection and verification.
3. Damaged, defective, or incorrect items may be rejected or returned.
4. Payment shall follow the agreed payment terms.
5. Supplier must provide the required delivery and supporting documents.`;

// Parse structured commercial parameters and terms from notes
function parseSupplierData(supplier: Supplier | null) {
    if (!supplier) {
        return {
            cleanNotes: "",
            termsAndConditions: DEFAULT_TERMS_AND_CONDITIONS,
            paymentMethod: "Bank Transfer",
            paymentTerms: "Net 30 Days",
            deliveryTerms: "FOB Destination / Direct Delivery",
            returnPolicy: "7-day return on defective/damaged items",
            warranty: "1 Year Standard Warranty",
            leadTime: "3-5 Business Days",
            moq: "No minimum / 1 unit",
        };
    }

    let rawNotes = supplier.notes || "";
    let cleanNotes = rawNotes;
    let termsAndConditions = "";
    let paymentMethod = "";
    let paymentTerms = "";
    let deliveryTerms = "";
    let returnPolicy = "";
    let warranty = "";
    let leadTime = "";
    let moq = "";

    // 1. Extract Terms & Conditions block
    if (cleanNotes.includes("--- Terms & Conditions ---")) {
        const parts = cleanNotes.split(/---+\s*Terms\s*&\s*Conditions\s*---+/i);
        cleanNotes = (parts[0] || "").trim();
        termsAndConditions = (parts[1] || "").trim();
    }

    // 2. Extract Commercial parameters
    const lines = cleanNotes.split("\n");
    const remainingNotes: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (/^Payment Method:\s*/i.test(trimmed)) {
            paymentMethod = trimmed.replace(/^Payment Method:\s*/i, "").trim();
        } else if (/^Payment Terms:\s*/i.test(trimmed)) {
            paymentTerms = trimmed.replace(/^Payment Terms:\s*/i, "").trim();
        } else if (/^Delivery Terms:\s*/i.test(trimmed)) {
            deliveryTerms = trimmed.replace(/^Delivery Terms:\s*/i, "").trim();
        } else if (/^Return Policy:\s*/i.test(trimmed)) {
            returnPolicy = trimmed.replace(/^Return Policy:\s*/i, "").trim();
        } else if (/^Warranty:\s*/i.test(trimmed)) {
            warranty = trimmed.replace(/^Warranty:\s*/i, "").trim();
        } else if (/^Lead Time:\s*/i.test(trimmed)) {
            leadTime = trimmed.replace(/^Lead Time:\s*/i, "").trim();
        } else if (/^MOQ:\s*/i.test(trimmed)) {
            moq = trimmed.replace(/^MOQ:\s*/i, "").trim();
        } else {
            remainingNotes.push(line);
        }
    }

    cleanNotes = remainingNotes.join("\n").trim();
    if (cleanNotes.startsWith("Notes: ")) {
        cleanNotes = cleanNotes.replace(/^Notes:\s*/i, "").trim();
    }

    return {
        cleanNotes,
        termsAndConditions: termsAndConditions || DEFAULT_TERMS_AND_CONDITIONS,
        paymentMethod: paymentMethod || "Bank Transfer",
        paymentTerms: paymentTerms || "Net 30 Days",
        deliveryTerms: deliveryTerms || "FOB Destination / Direct Delivery",
        returnPolicy: returnPolicy || "7-day return on defective/damaged items",
        warranty: warranty || "1 Year Standard Warranty",
        leadTime: leadTime || "3-5 Business Days",
        moq: moq || "No minimum / 1 unit",
    };
}

export function SupplierViewModal({
    isOpen,
    supplier,
    purchaseOrders,
    onClose,
    onEdit,
    onDelete,
    onScheduleMeeting,
}: SupplierViewModalProps) {
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "terms" | "products" | "docs" | "orders">("general");
    const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);

    // Enhanced Transaction History State
    const [supplierFullOrders, setSupplierFullOrders] = useState<any[]>([]);
    const [supplierQuotations, setSupplierQuotations] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historySubTab, setHistorySubTab] = useState<"all" | "active" | "completed" | "rejected" | "quotes">("all");

    const rawOtherProducts: any[] = useMemo(() => {
        if (!supplier) return [];
        if (Array.isArray(supplier.other_products_offer)) {
            return supplier.other_products_offer;
        }
        if (typeof supplier.other_products_offer === 'string') {
            try {
                const parsed = JSON.parse(supplier.other_products_offer);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }, [supplier]);

    useEffect(() => {
        if (isOpen && supplier?.id) {
            setIsLoadingDocs(true);
            fetch(`/api/suppliers/documents?supplier_id=${supplier.id}`)
                .then((res) => res.json())
                .then((json) => {
                    setIsLoadingDocs(false);
                    if (json.success && Array.isArray(json.documents)) {
                        setDocuments(json.documents);
                    } else {
                        // Fallback to direct query if API had issues
                        supabase
                            .from("supplier_documents")
                            .select("*")
                            .eq("supplier_id", supplier.id)
                            .order("created_at", { ascending: false })
                            .then(({ data }) => setDocuments(data || []));
                    }
                })
                .catch(() => {
                    setIsLoadingDocs(false);
                    setDocuments([]);
                });
            setActiveTab("general");

            // Fetch comprehensive transaction history (orders and quotations)
            setIsLoadingHistory(true);
            const supName = (supplier.name || "").trim();
            const supId = supplier.id ? Number(supplier.id) : null;

            Promise.all([
                supabase
                    .from("purchase_orders")
                    .select("*")
                    .or(supId ? `supplier_id.eq.${supId},supplier_name.ilike.%${supName}%` : `supplier_name.ilike.%${supName}%`)
                    .order("created_at", { ascending: false }),
                supabase
                    .from("supplier_quotations")
                    .select("*")
                    .or(supId ? `supplier_id.eq.${supId},supplier_name.ilike.%${supName}%` : `supplier_name.ilike.%${supName}%`)
                    .order("created_at", { ascending: false }),
            ])
            .then(([posRes, quotesRes]) => {
                setSupplierFullOrders(posRes.data || []);
                setSupplierQuotations(quotesRes.data || []);
            })
            .catch((err) => {
                console.warn("Failed to load supplier transaction history:", err);
            })
            .finally(() => {
                setIsLoadingHistory(false);
            });
        } else {
            setDocuments([]);
            setPreviewDoc(null);
            setSupplierFullOrders([]);
            setSupplierQuotations([]);
        }
    }, [isOpen, supplier?.id, supplier?.name]);

    if (!isOpen || !supplier) return null;

    const parsed = parseSupplierData(supplier);
    const supplierOrders = purchaseOrders.filter((po) => po.supplier_id === supplier.id);
    const docsWithExtracted = documents.filter(d => !!d.extracted_data);

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[130] bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-4xl bg-[#f0f4fa] dark:bg-[#151724] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[96vh] sm:max-h-[92vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-3.5 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-start sm:items-center justify-between gap-2.5 bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)] mt-0.5 sm:mt-0">
                                <Building2 className="w-4 h-4 sm:w-6 sm:h-6 drop-shadow" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                                    <h3 className="font-black text-sm sm:text-lg text-slate-900 dark:text-white tracking-tight break-words">
                                        {supplier.name}
                                    </h3>
                                    <span className="font-mono text-[9px] sm:text-[11px] px-2 py-0.5 rounded-md bg-[#e8ecf4] dark:bg-[#10121b] text-pink-600 dark:text-pink-400 font-bold border border-slate-300/80 dark:border-white/10 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.3)] shrink-0">
                                        SUP-{String(supplier.id).padStart(3, "0")}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                                        supplier.is_active !== false
                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                                    }`}>
                                        {supplier.is_active !== false ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    Category: <strong className="text-slate-700 dark:text-slate-300">{supplier.category || "General Supplies"}</strong> • Registered Profile
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.35)] shrink-0 cursor-pointer transition-all active:scale-95 mt-0.5 sm:mt-0"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation Tabs Bar */}
                    <div className="px-3 sm:px-6 py-2 sm:py-2.5 bg-[#e4eaf4] dark:bg-[#10121c] border-b border-slate-300/70 dark:border-white/[0.06] overflow-x-auto no-scrollbar shrink-0">
                        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] flex-nowrap shrink-0 w-max">
                            <button
                                type="button"
                                onClick={() => setActiveTab("general")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                    activeTab === "general"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                1. General &amp; Info
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("terms")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                    activeTab === "terms"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                2. Commercial &amp; Terms
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("products")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                                    activeTab === "products"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <Package className="w-3.5 h-3.5" />
                                <span>3. Products</span>
                                {rawOtherProducts.length > 0 && (
                                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                                        activeTab === "products" ? "bg-white text-pink-700" : "bg-pink-600 text-white"
                                    }`}>
                                        {rawOtherProducts.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("docs")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                                    activeTab === "docs"
                                        ? "bg-pink-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <span>4. Docs &amp; AI</span>
                                {documents.length > 0 && (
                                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                                        activeTab === "docs" ? "bg-white text-pink-700" : "bg-pink-600 text-white"
                                    }`}>
                                        {documents.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("orders")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                                    activeTab === "orders"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>5. Orders ({supplierFullOrders.length + supplierQuotations.length})</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-xs">
                        {/* TAB 1: General & Profile Information */}
                        {activeTab === "general" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Building2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Business Identity & Contact Profile</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Supplier Name</span>
                                            <p className="font-black text-slate-900 dark:text-white truncate">{supplier.name}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Category</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{supplier.category || "General Supplies"}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contact Person</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{supplier.contact_person || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Phone</span>
                                            <p className="font-mono font-bold text-slate-900 dark:text-white truncate">{supplier.phone || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{supplier.email || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Website / Social</span>
                                            {supplier.fb_link ? (
                                                <a
                                                    href={supplier.fb_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-bold text-pink-600 dark:text-pink-400 hover:underline truncate block"
                                                >
                                                    {supplier.fb_link}
                                                </a>
                                            ) : (
                                                <p className="font-bold text-slate-400">Not Provided</p>
                                            )}
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3 p-3.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-2.5">
                                            <div className="flex items-center justify-between border-b border-slate-300/60 dark:border-white/10 pb-1.5">
                                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                    <CreditCard className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                                    Tax Identification &amp; Settlement Banking Profile
                                                </span>
                                                <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">
                                                    Official Payment Destination
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                                                <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl border border-slate-200/60 dark:border-white/5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">TIN / Tax ID</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {supplier.tin || supplier.tax_id || "Not Registered"}
                                                    </span>
                                                </div>
                                                <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl border border-slate-200/60 dark:border-white/5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tax Classification</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {supplier.tax_type || "VAT Registered (12%)"}
                                                    </span>
                                                </div>
                                                <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl border border-slate-200/60 dark:border-white/5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Name</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                        {supplier.bank_name || "BDO / Standard B2B Bank"}
                                                    </span>
                                                </div>
                                                <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl border border-slate-200/60 dark:border-white/5 sm:col-span-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Account Name</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                        {supplier.bank_account_name || supplier.name || "Corporate Account"}
                                                    </span>
                                                </div>
                                                <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl border border-slate-200/60 dark:border-white/5">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Account Number</span>
                                                    <span className="font-mono font-bold text-pink-600 dark:text-pink-400">
                                                        {supplier.bank_account_number || "•••• •••• ••••"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {supplier.products && (
                                            <div className="sm:col-span-2 md:col-span-3 p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-1">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Products &amp; Services Offered</span>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {supplier.products.split(",").map((product: string, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2.5 py-1 bg-[#ebf0f7] dark:bg-[#14151e] text-slate-800 dark:text-slate-200 border border-slate-300/70 dark:border-white/10 shadow-[-1.5px_-1.5px_3px_rgba(255,255,255,0.8),_1.5px_1.5px_3px_rgba(163,177,198,0.3)] rounded-none text-xs font-semibold"
                                                        >
                                                            {product.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {parsed.cleanNotes && (
                                            <div className="sm:col-span-2 md:col-span-3 p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Profile Remarks &amp; Notes</span>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{parsed.cleanNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Commercial & Terms & Conditions */}
                        {activeTab === "terms" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <CreditCard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Commercial &amp; Fulfillment Parameters</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payment Method</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.paymentMethod}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payment Terms</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.paymentTerms}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Delivery Terms</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.deliveryTerms}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Return Policy</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.returnPolicy}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Warranty Coverage</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.warranty}</p>
                                        </div>

                                        <div className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Lead Time / MOQ</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{parsed.leadTime} / {parsed.moq}</p>
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3 p-3.5 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                                                    <Shield className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                                    Governing Terms and Conditions and Vendor Submitted Terms &amp; Special Clauses
                                                </span>
                                                <span className="text-[9px] font-bold text-pink-600 dark:text-pink-400">
                                                    Contractual Agreement
                                                </span>
                                            </div>
                                            <p className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line max-h-48 overflow-y-auto leading-relaxed p-2.5 rounded-none bg-white/70 dark:bg-black/30 border border-slate-300/60 dark:border-white/10">
                                                {parsed.termsAndConditions}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Products to Supply (Catalog) */}
                        {activeTab === "products" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                                Products to Supply Catalog ({rawOtherProducts.length})
                                            </h4>
                                        </div>
                                        <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/60 px-2.5 py-0.5 rounded-full border border-pink-200 dark:border-pink-800/60">
                                            Registered in Supplier Activation
                                        </span>
                                    </div>

                                    {rawOtherProducts.length === 0 ? (
                                        <div className="p-8 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-center text-slate-400 dark:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] space-y-3">
                                            <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                No structured catalog items recorded in &ldquo;Products to Supply&rdquo;.
                                            </p>
                                            {supplier.products && (
                                                <div className="pt-2 text-xs">
                                                    <span className="text-slate-400 block mb-1">Standard Product List:</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{supplier.products}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {rawOtherProducts.map((prod: any, idx: number) => {
                                                    const price = Number(prod.unit_price ?? prod.price ?? 0);
                                                    const disc = Number(prod.discount || 0);
                                                    const taxR = prod.tax_rate !== undefined ? Number(prod.tax_rate) : 12;
                                                    const netPrice = Math.max(0, price - disc);
                                                    return (
                                                        <div
                                                            key={prod.id || idx}
                                                            className="p-3.5 bg-white dark:bg-[#121420] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between gap-2.5"
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                                            {prod.item_name || prod.name || "Product Item"}
                                                                        </span>
                                                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300">
                                                                            {prod.unit || "unit"}
                                                                        </span>
                                                                    </div>
                                                                    {prod.notes && (
                                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                                                            {prod.notes}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Unit Price</span>
                                                                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                                                        ₱{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                                                <div className="flex items-center gap-2">
                                                                    <span>Tax: <strong className="text-slate-700 dark:text-slate-300">{taxR}% {prod.tax_classification || "VAT"}</strong></span>
                                                                    {disc > 0 && (
                                                                        <span>Disc: <strong className="text-emerald-600">₱{disc.toFixed(2)}</strong></span>
                                                                    )}
                                                                </div>
                                                                <span className="font-mono font-bold text-pink-600 dark:text-pink-400 text-xs">
                                                                    Net: ₱{netPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 4: Verification Documents & AI Data */}
                        {activeTab === "docs" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>Attached Verification Documents ({documents.length})</span>
                                        </h4>
                                    </div>

                                    {isLoadingDocs ? (
                                        <div className="p-6 text-center text-slate-400 text-xs">
                                            Loading attached documents...
                                        </div>
                                    ) : documents.length === 0 ? (
                                        <div className="p-6 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-center text-slate-400 dark:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]">
                                            <p className="text-xs italic">No verification documents attached to this supplier record.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {documents.map((doc) => {
                                                const fileUrl = doc.file_url || (doc.storage_path ? supabase.storage.from("supplier_documents").getPublicUrl(doc.storage_path).data?.publicUrl : "");
                                                return (
                                                    <div
                                                        key={doc.id}
                                                        className="p-3 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 flex items-center justify-between gap-3 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                                    {doc.file_name}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {fileUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc({ url: fileUrl, name: doc.file_name, type: doc.document_type })}
                                                                    className="px-2.5 py-1 rounded-none bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                                                                    title="Preview Document"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                    <span>Preview</span>
                                                                </button>
                                                            )}
                                                            {fileUrl && (
                                                                <a
                                                                    href={fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1.5 rounded-none bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 border border-slate-300/70 dark:border-white/10 text-xs font-bold transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]"
                                                                    title="Open in new tab"
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* AI Extracted Breakdown if available */}
                                {docsWithExtracted.length > 0 && (
                                    <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <span>AI-Extracted Document Intelligence</span>
                                            </h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                Extracted with Gemini AI
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            {docsWithExtracted.map((doc) => {
                                                const ext = doc.extracted_data;
                                                return (
                                                    <div
                                                        key={`ext-view-${doc.id}`}
                                                        className="p-4 rounded-none bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-3 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)]"
                                                    >
                                                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-300/60 dark:border-white/10 pb-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                                                                <span className="font-bold text-xs text-slate-900 dark:text-white">{doc.file_name}</span>
                                                                <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">({doc.document_type})</span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
                                                            {ext.supplier_name && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Extracted Name:</span>
                                                                    <span className="font-bold text-slate-900 dark:text-white truncate block">{ext.supplier_name}</span>
                                                                </div>
                                                            )}
                                                            {ext.tax_id && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">TIN / Tax ID:</span>
                                                                    <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{ext.tax_id}</span>
                                                                </div>
                                                            )}
                                                            {ext.contact_person && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Contact:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.contact_person}</span>
                                                                </div>
                                                            )}
                                                            {ext.phone && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Phone:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.phone}</span>
                                                                </div>
                                                            )}
                                                            {ext.email && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Email:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.email}</span>
                                                                </div>
                                                            )}
                                                            {ext.payment_terms && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Payment Terms:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.payment_terms}</span>
                                                                </div>
                                                            )}
                                                            {ext.delivery_terms && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Delivery Terms:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.delivery_terms}</span>
                                                                </div>
                                                            )}
                                                            {ext.warranty && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Warranty:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.warranty}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {ext.terms_and_conditions && (
                                                            <div className="p-3 rounded-none bg-pink-500/10 border border-pink-500/20 text-slate-900 dark:text-white space-y-1">
                                                                <span className="text-[10px] text-pink-700 dark:text-pink-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                    <Shield className="w-3 h-3" />
                                                                    Extracted Terms & Conditions from Document:
                                                                </span>
                                                                <p className="text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-mono">
                                                                    {ext.terms_and_conditions}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {ext.document_summary && (
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1 border-t border-slate-300/60 dark:border-white/10">
                                                                Document Summary: &ldquo;{ext.document_summary}&rdquo;
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 4: Transactions History (POs, Quotations, Separated Lifecycles) */}
                        {activeTab === "orders" && (() => {
                            const activeOrders = supplierFullOrders.filter((po) => {
                                const st = (po.status || "").toLowerCase().trim();
                                return ["pending", "draft", "issued", "sent", "confirmed", "in progress"].includes(st);
                            });

                            const completedOrders = supplierFullOrders.filter((po) => {
                                const st = (po.status || "").toLowerCase().trim();
                                return ["delivered", "completed", "fulfilled"].includes(st);
                            });

                            const rejectedOrders = supplierFullOrders.filter((po) => {
                                const st = (po.status || "").toLowerCase().trim();
                                return ["rejected", "cancelled"].includes(st);
                            });

                            return (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-3 flex-wrap gap-2">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                <ShoppingBag className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <span>Actual Transaction History ({supplierFullOrders.length + supplierQuotations.length})</span>
                                            </h4>

                                            {/* Subtab Switcher */}
                                            <div className="flex items-center gap-1 bg-[#e8ecf4] dark:bg-[#10121b] p-1 rounded-2xl border border-slate-300/70 dark:border-white/10 text-[11px] font-bold overflow-x-auto no-scrollbar max-w-full flex-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySubTab("all")}
                                                    className={`px-2.5 py-1 rounded-xl transition-all shrink-0 whitespace-nowrap ${
                                                        historySubTab === "all" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    All ({supplierFullOrders.length + supplierQuotations.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySubTab("active")}
                                                    className={`px-2.5 py-1 rounded-xl transition-all shrink-0 whitespace-nowrap ${
                                                        historySubTab === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Active ({activeOrders.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySubTab("completed")}
                                                    className={`px-2.5 py-1 rounded-xl transition-all shrink-0 whitespace-nowrap ${
                                                        historySubTab === "completed" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Completed ({completedOrders.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySubTab("rejected")}
                                                    className={`px-2.5 py-1 rounded-xl transition-all shrink-0 whitespace-nowrap ${
                                                        historySubTab === "rejected" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Rejected ({rejectedOrders.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setHistorySubTab("quotes")}
                                                    className={`px-2.5 py-1 rounded-xl transition-all shrink-0 whitespace-nowrap ${
                                                        historySubTab === "quotes" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400"
                                                    }`}
                                                >
                                                    Quotations ({supplierQuotations.length})
                                                </button>
                                            </div>
                                        </div>

                                        {isLoadingHistory ? (
                                            <div className="p-8 text-center text-xs text-slate-400">
                                                Loading transaction history...
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                                {/* Quotations Subtab */}
                                                {historySubTab === "quotes" && (
                                                    supplierQuotations.length === 0 ? (
                                                        <p className="text-xs italic text-slate-400 p-4 text-center">No quotations recorded for this supplier.</p>
                                                    ) : (
                                                        supplierQuotations.map((q) => (
                                                            <div
                                                                key={`quote-${q.id}`}
                                                                className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 flex items-center justify-between gap-3 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35)]"
                                                            >
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                                            {q.item_name || "Quoted Supplies"}
                                                                        </span>
                                                                        <span className="text-[10px] text-pink-600 font-mono">
                                                                            ({q.request_number || "Direct Submission"})
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                                        Lead time: {q.lead_time_days || "3-5"} days • {q.availability || "In Stock"} • {new Date(q.created_at).toLocaleDateString()}
                                                                    </p>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400">
                                                                        ₱{Number(q.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                        (q.status || "").toLowerCase() === "accepted"
                                                                            ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                                                            : (q.status || "").toLowerCase() === "rejected"
                                                                            ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                                                                            : "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                                                    }`}>
                                                                        {q.status || "Pending"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )
                                                )}

                                                {/* Purchase Orders Subtabs */}
                                                {historySubTab !== "quotes" && (() => {
                                                    const displayOrders = 
                                                        historySubTab === "active" ? activeOrders :
                                                        historySubTab === "completed" ? completedOrders :
                                                        historySubTab === "rejected" ? rejectedOrders :
                                                        supplierFullOrders;

                                                    if (displayOrders.length === 0) {
                                                        return (
                                                            <p className="text-xs italic text-slate-400 p-4 text-center">
                                                                No {historySubTab !== "all" ? historySubTab : ""} purchase order transactions found.
                                                            </p>
                                                        );
                                                    }

                                                    return displayOrders.map((po) => {
                                                        let poItems: any[] = [];
                                                        if (Array.isArray(po.items)) poItems = po.items;
                                                        else if (typeof po.items === "string") {
                                                            try {
                                                                const parsed = JSON.parse(po.items);
                                                                if (Array.isArray(parsed)) poItems = parsed;
                                                            } catch {}
                                                        }

                                                        const isReorder = (po.notes || "").toLowerCase().includes("reorder");

                                                        return (
                                                            <div
                                                                key={po.id}
                                                                className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-2 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35)]"
                                                            >
                                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                                                                            {po.po_number}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            • {new Date(po.created_at).toLocaleDateString()}
                                                                        </span>
                                                                        {isReorder && (
                                                                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-500/15 text-blue-600 border border-blue-500/30">
                                                                                Deficit Reorder
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-2.5">
                                                                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 font-mono">
                                                                            ₱{Number(po.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                        <div>{getStatusBadge(po.status)}</div>
                                                                        <div>{getPaidBadge(po.paid || false)}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Ordered Items List */}
                                                                {poItems.length > 0 && (
                                                                    <div className="pt-1.5 border-t border-slate-300/60 dark:border-white/10 flex items-center gap-2 flex-wrap">
                                                                        <span className="text-[10px] text-slate-400 font-bold">Items:</span>
                                                                        {poItems.map((it: any, iIdx: number) => (
                                                                            <span
                                                                                key={iIdx}
                                                                                className="text-[10px] px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/40 text-slate-700 dark:text-slate-300 font-semibold border border-slate-300/50 dark:border-white/5"
                                                                            >
                                                                                {Number(it.quantity || it.quantity_ordered || 1)}x {it.name || it.item_name || "Item"}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-300/80 dark:border-white/10 bg-[#ebf0f7] dark:bg-[#131522] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between shrink-0 gap-2.5">
                        <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            className="w-full sm:w-auto justify-center"
                            onClick={() => onDelete(supplier.id, supplier.name)}
                        >
                            Delete Supplier
                        </AppButton>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                            {onScheduleMeeting && (
                                <button
                                    type="button"
                                    onClick={() => onScheduleMeeting(supplier)}
                                    className="flex-1 sm:flex-initial justify-center px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Schedule Meeting</span>
                                </button>
                            )}
                            <AppButton type="button" variant="neutral" size="sm" className="flex-1 sm:flex-initial justify-center" onClick={onClose}>
                                Close
                            </AppButton>
                            <AppButton
                                type="button"
                                variant="primary"
                                size="sm"
                                className="flex-1 sm:flex-initial justify-center"
                                onClick={() => {
                                    onEdit(supplier);
                                    onClose();
                                }}
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Supplier</span>
                            </AppButton>
                        </div>
                    </div>
                </div>

                {/* In-Modal Document Preview Modal */}
                {previewDoc && (
                    <div
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[160] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
                        onClick={() => setPreviewDoc(null)}
                    >
                        <div
                            className="relative w-full max-w-4xl bg-[#ebf0f7] dark:bg-[#141624] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 sm:px-6 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#e8ecf4] dark:bg-[#10121b] shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-none bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)]">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                            {previewDoc.name}
                                        </h4>
                                        <p className="text-[11px] text-slate-400">
                                            {previewDoc.type}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <a
                                        href={previewDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={previewDoc.name}
                                        className="px-3 py-1.5 rounded-none bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/80 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]"
                                        title="Download File"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(null)}
                                        className="p-1.5 rounded-none bg-[#ebf0f7] dark:bg-[#141624] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-300/80 dark:border-white/10 transition-all cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]"
                                        title="Close Preview"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#f0f4fa] dark:bg-[#121420] flex items-center justify-center min-h-[350px]">
                                {previewDoc.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/) ? (
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.name}
                                        className="max-h-[68vh] max-w-full object-contain rounded-none shadow-lg border border-slate-300/70 dark:border-white/10"
                                    />
                                ) : previewDoc.name.toLowerCase().endsWith(".pdf") || previewDoc.url.toLowerCase().includes(".pdf") ? (
                                    <iframe
                                        src={previewDoc.url}
                                        title={previewDoc.name}
                                        className="w-full h-[68vh] border border-slate-300/70 dark:border-white/10 rounded-none bg-white shadow-inner"
                                    />
                                ) : (
                                    <div className="text-center p-8 space-y-4 max-w-md mx-auto">
                                        <div className="w-16 h-16 rounded-none bg-pink-500/10 text-pink-600 mx-auto flex items-center justify-center shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)]">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{previewDoc.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">Direct in-browser preview is available for images and PDF documents.</p>
                                        </div>
                                        <a
                                            href={previewDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-none bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>Open File in Browser</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Portal>
    );
}
