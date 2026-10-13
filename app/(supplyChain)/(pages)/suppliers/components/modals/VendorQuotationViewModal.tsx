// app/(supplyChain)/(pages)/suppliers/components/modals/VendorQuotationViewModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
    Tag,
    FileText,
    Clock,
    Truck,
    CreditCard,
    Shield,
    Check,
    Award,
    Download,
    Eye,
    X,
    Building2,
    MapPin,
    Phone,
    Mail,
    Boxes,
    FileCheck2,
    ExternalLink,
    Scale,
    AlertCircle,
    UserCheck,
    Loader2,
    File,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import Portal from "../../../../components/client/Portal";
import { supabase } from "../../../../lib/services/client/supabase";
import type { PotentialSupplierItem, SupplierQuotationItem } from "../tables/PotentialSuppliersTab";

interface VendorQuotationViewModalProps {
    supplier: PotentialSupplierItem | null;
    initialQuote?: SupplierQuotationItem | null;
    onClose: () => void;
    onProceedToActivate?: (supplier: PotentialSupplierItem) => void;
    onAwardBid?: (supplier: PotentialSupplierItem, quote: any) => void;
}

interface QuotationDocument {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    documentType: string;
    storagePath?: string;
    publicUrl: string;
    extractedText?: string | null;
    extractedData?: any | null;
    summary?: string;
}

export function VendorQuotationViewModal({
    supplier,
    initialQuote,
    onClose,
    onProceedToActivate,
    onAwardBid,
}: VendorQuotationViewModalProps) {
    const [quote, setQuote] = useState<any>(initialQuote || supplier?.submittedQuote || null);
    const [documents, setDocuments] = useState<QuotationDocument[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [previewDoc, setPreviewDoc] = useState<QuotationDocument | null>(null);

    useEffect(() => {
        if (!supplier) return;

        let isCancelled = false;

        async function fetchQuotationAndFiles() {
            if (!supplier) return;
            setIsLoading(true);

            try {
                // 1. Resolve real supplier ID from multiple candidate properties
                let resolvedSupplierId: number | null = null;
                if (supplier.dbSupplierId && !isNaN(Number(supplier.dbSupplierId))) {
                    resolvedSupplierId = Number(supplier.dbSupplierId);
                } else if (!isNaN(Number(supplier.id)) && Number(supplier.id) > 0) {
                    resolvedSupplierId = Number(supplier.id);
                } else if (supplier.submittedQuote?.supplier_id && !isNaN(Number(supplier.submittedQuote.supplier_id))) {
                    resolvedSupplierId = Number(supplier.submittedQuote.supplier_id);
                } else if (initialQuote?.supplier_id && !isNaN(Number(initialQuote.supplier_id))) {
                    resolvedSupplierId = Number(initialQuote.supplier_id);
                }

                // If no numeric ID yet, lookup by name in suppliers table (supporting fuzzy name match)
                if (!resolvedSupplierId && supplier.name) {
                    const rawName = supplier.name.trim();
                    const cleanName = rawName.split(" - ")[0].split(" (")[0].trim();
                    const firstWord = cleanName.split(" ")[0].trim();

                    try {
                        const { data: matchedSuppliers } = await supabase
                            .from("suppliers")
                            .select("id, name")
                            .or(`name.ilike.%${cleanName}%,name.ilike.%${firstWord}%,name.ilike.%${rawName}%`)
                            .limit(5);

                        if (matchedSuppliers && matchedSuppliers.length > 0) {
                            resolvedSupplierId = matchedSuppliers[0].id;
                        }
                    } catch (sErr) {
                        console.warn("Error matching supplier by name:", sErr);
                    }
                }

                // 2. Fetch quotation if not already provided or if needing refresh
                let quotationData = initialQuote || supplier.submittedQuote || null;
                if (!quotationData && (resolvedSupplierId || supplier.name)) {
                    try {
                        let quoteQuery = supabase.from("supplier_quotations").select("*");
                        const rawName = supplier.name?.trim() || "";
                        const cleanName = rawName.split(" - ")[0].split(" (")[0].trim();

                        if (resolvedSupplierId) {
                            quoteQuery = quoteQuery.or(`supplier_id.eq.${resolvedSupplierId},supplier_name.ilike.%${cleanName}%`);
                        } else if (cleanName) {
                            quoteQuery = quoteQuery.ilike("supplier_name", `%${cleanName}%`);
                        }

                        const { data: quoteRows } = await quoteQuery
                            .order("created_at", { ascending: false })
                            .limit(1);

                        if (quoteRows && quoteRows.length > 0) {
                            const foundQuote = quoteRows[0];
                            quotationData = foundQuote;
                            if (!resolvedSupplierId && foundQuote?.supplier_id) {
                                resolvedSupplierId = Number(foundQuote.supplier_id);
                            }
                        }
                    } catch (qErr) {
                        console.warn("Error fetching supplier quotation:", qErr);
                    }
                }

                if (isCancelled) return;
                setQuote(quotationData);

                // 3. Fetch documents from supplier_documents via API (bypasses RLS)
                let docsList: QuotationDocument[] = [];
                const targetSupId = resolvedSupplierId || quotationData?.supplier_id;

                try {
                    const params = new URLSearchParams();
                    if (targetSupId) params.append("supplier_id", String(targetSupId));
                    if (supplier.name) params.append("supplier_name", supplier.name);
                    if (quotationData?.id) params.append("quotation_id", String(quotationData.id));

                    const res = await fetch(`/api/suppliers/documents?${params.toString()}`);
                    const json = await res.json();

                    if (json.success && Array.isArray(json.documents)) {
                        docsList = json.documents;
                    }
                } catch (apiErr) {
                    console.error("API error fetching supplier documents:", apiErr);
                }

                // Fallback: If API returned empty, attempt direct client query
                if (docsList.length === 0 && targetSupId) {
                    try {
                        const { data: dbDocs } = await supabase
                            .from("supplier_documents")
                            .select("*")
                            .eq("supplier_id", Number(targetSupId))
                            .order("created_at", { ascending: false });

                        if (dbDocs && dbDocs.length > 0) {
                            for (const dbDoc of dbDocs) {
                                let publicUrl = dbDoc.file_url || "";
                                if (!publicUrl && dbDoc.storage_path) {
                                    const { data: urlData } = supabase.storage
                                        .from("supplier_documents")
                                        .getPublicUrl(dbDoc.storage_path);
                                    publicUrl = urlData?.publicUrl || "";
                                }

                                const fileName = dbDoc.file_name || "Quotation Attachment";
                                const isPdf = fileName.toLowerCase().endsWith(".pdf");
                                const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);

                                docsList.push({
                                    id: String(dbDoc.id || `doc_${Math.random()}`),
                                    fileName,
                                    fileType: isPdf ? "application/pdf" : (isImg ? "image/png" : "application/octet-stream"),
                                    fileSize: 102400,
                                    documentType: dbDoc.document_type || "Vendor Quotation Evidence",
                                    storagePath: dbDoc.storage_path,
                                    publicUrl,
                                    extractedText: dbDoc.extracted_text || null,
                                    extractedData: dbDoc.extracted_data || null,
                                    summary: dbDoc.extracted_data?.document_summary || undefined,
                                });
                            }
                        }
                    } catch (docErr) {
                        console.error("Fallback error fetching supplier documents:", docErr);
                    }
                }

                if (isCancelled) return;
                setDocuments(docsList);
            } catch (err) {
                console.error("Error loading quotation and files:", err);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        }

        fetchQuotationAndFiles();

        return () => {
            isCancelled = true;
        };
    }, [supplier, initialQuote]);

    if (!supplier) return null;

    const servicesList: string[] = Array.isArray(quote?.services_offered)
        ? quote.services_offered
        : (typeof quote?.services_offered === "string" && quote.services_offered
            ? quote.services_offered.split(",").map((s: string) => s.trim())
            : (supplier.services_offered || []));

    // Parse clauses from notes or supplier_terms
    let rawClauses = quote?.supplier_terms || "";
    if (!rawClauses && quote?.notes) {
        if (quote.notes.includes("Clauses:")) {
            const match = quote.notes.match(/Clauses:\s*([^\]]+)/i);
            if (match && match[1]) rawClauses = match[1].trim();
        } else if (quote.notes.includes("--- Terms & Conditions ---")) {
            const parts = quote.notes.split(/---+\s*Terms\s*&\s*Conditions\s*---+/i);
            if (parts[1]) rawClauses = parts[1].trim();
        }
    }

    const isQuoteAwarded = quote?.status === "accepted" || supplier?.submittedQuote?.status === "accepted";

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/80 dark:bg-black/90 backdrop-blur-md z-[130] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-4xl bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                                        Vendor Quotation &amp; Proposal Details
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60">
                                        View Only
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Review submitted pricing, terms &amp; conditions, and attached evidence files from this vendor.
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

                    {/* Scrollable Content */}
                    <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                        {isLoading ? (
                            <div className="py-16 text-center space-y-3">
                                <Loader2 className="w-8 h-8 text-pink-600 animate-spin mx-auto" />
                                <p className="text-xs font-bold text-slate-500">Loading vendor quotation proposal &amp; files...</p>
                            </div>
                        ) : (
                            <>
                                {/* Top Vendor Profile Strip */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-3">
                                    <div className="flex items-start justify-between flex-wrap gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <h4 className="font-black text-base text-slate-900 dark:text-white">
                                                    {quote?.supplier_name || supplier.name}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                                    {quote?.category || supplier.category || "General Supplies"}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{quote?.location || supplier.location || "Metro Manila, Philippines"}</span>
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Quotation Status</span>
                                            {isQuoteAwarded ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1 mt-0.5">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Bid Awarded</span>
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border border-pink-300 dark:border-pink-800 inline-block mt-0.5">
                                                    {quote?.status || "Quotation Submitted"}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/5 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">Contact:</span>
                                            <strong className="text-slate-800 dark:text-slate-200 truncate">
                                                {quote?.contact_person || supplier.contact_person || "Store Representative"}
                                            </strong>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3 h-3 text-pink-500 shrink-0" />
                                            <span className="font-mono text-slate-800 dark:text-slate-200">
                                                {quote?.contact_phone || supplier.phone || "Not provided"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-3 h-3 text-pink-500 shrink-0" />
                                            <span className="text-slate-800 dark:text-slate-200 truncate" title={quote?.contact_email || supplier.email}>
                                                {quote?.contact_email || supplier.email || "Not provided"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quotation Financials & Pricing Summary */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Tag className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Quoted Products &amp; Pricing Breakdown</span>
                                    </h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Item / Supply</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">
                                                {quote?.item_name || quote?.products || supplier.products || "Requested Items"}
                                            </p>
                                            {quote?.request_number && (
                                                <span className="text-[10px] font-mono text-pink-600 dark:text-pink-400">Ref: {quote.request_number}</span>
                                            )}
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Quoted Quantity</span>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {quote?.quantity ? `${quote.quantity.toLocaleString()} ${quote.unit || "units"}` : "Standard"}
                                            </p>
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold capitalize">
                                                {quote?.availability || "In Stock"}
                                            </span>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Quoted Unit Price</span>
                                            <p className="font-black text-pink-600 dark:text-pink-400 text-sm">
                                                {quote?.unit_price ? `₱${Number(quote.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Custom"}
                                            </p>
                                            <span className="text-[10px] text-slate-400">per {quote?.unit || "unit"}</span>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Subtotal</span>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                                                ₱{Number(quote?.subtotal || (quote?.unit_price && quote?.quantity ? Number(quote.unit_price) * Number(quote.quantity) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                            <span className="text-[10px] text-slate-400">Base Cost</span>
                                        </div>
                                    </div>

                                    {/* Itemized Financial Breakdown Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Trade Discount</span>
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                                {Number(quote?.discount || 0) > 0 ? `-₱${Number(quote.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00 (None)"}
                                            </p>
                                            <span className="text-[10px] text-slate-400">Price reduction</span>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Shipping / Freight</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                {Number(quote?.shipping_fee || 0) > 0 ? `₱${Number(quote.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00 (Free / Inc.)"}
                                            </p>
                                            <span className="text-[10px] text-slate-400">Logistics fee</span>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                                                Tax ({quote?.tax_type || `${quote?.tax_rate || 0}%`})
                                            </span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                ₱{Number(quote?.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                            <span className="text-[10px] text-slate-400 font-mono">{quote?.tax_type || "Standard Tax"}</span>
                                        </div>

                                        <div className="p-3 rounded-2xl bg-pink-100/80 dark:bg-pink-950/60 border border-pink-500/40 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.25)] space-y-0.5">
                                            <span className="text-[10px] text-pink-700 dark:text-pink-300 uppercase font-black tracking-wider block">Total Quoted Value</span>
                                            <p className="font-black text-slate-900 dark:text-white text-base">
                                                {quote?.total_amount ? `₱${Number(quote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (quote?.unit_price && quote?.quantity ? `₱${(Number(quote.unit_price) * Number(quote.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—")}
                                            </p>
                                            <span className="text-[10px] text-pink-600 dark:text-pink-400 font-black uppercase">Grand Total Contract</span>
                                        </div>
                                    </div>

                                    {/* Products & Catalog Line */}
                                    {quote?.products && (
                                        <div className="p-3 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/60 dark:border-white/5 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25)] space-y-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Catalog / Products Offered</span>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">{quote.products}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Other Products Offered (Optional Multi-Item Catalog) */}
                                {quote?.other_products_offer && Array.isArray(quote.other_products_offer) && quote.other_products_offer.length > 0 && (
                                    <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-3.5">
                                        <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                <Boxes className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <span>Other Products Offered &amp; Additional Catalog Items</span>
                                            </h4>
                                            <span className="text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800/60">
                                                {quote.other_products_offer.length} Item{quote.other_products_offer.length > 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto rounded-2xl border border-slate-300/70 dark:border-white/10 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.2)]">
                                            <table className="w-full text-left border-collapse text-[11px]">
                                                <thead>
                                                    <tr className="bg-[#e2e8f2] dark:bg-[#111320] text-slate-500 dark:text-slate-400 border-b border-slate-300/80 dark:border-white/10">
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Item Description</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Unit</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Unit Price</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Tax Class</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Shipping Fee</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Discount</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Total Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 bg-[#f0f4fa]/70 dark:bg-[#151724]/70">
                                                    {quote.other_products_offer.map((item: any, iIdx: number) => {
                                                        const price = Number(item.unit_price || 0);
                                                        const sub = price;
                                                        const disc = Number(item.discount || 0);
                                                        const ship = Number(item.shipping_fee || 0);
                                                        const taxRate = item.tax_rate != null ? Number(item.tax_rate) : (item.tax_classification === "vatable" || item.tax_classification === "VAT (12%)" ? 12 : 0);
                                                        const tax = item.tax_amount != null ? Number(item.tax_amount) : (Math.max(0, sub - disc) * (taxRate / 100));
                                                        const tot = Number(item.total_amount != null ? item.total_amount : (Math.max(0, sub - disc) + ship + tax));

                                                        return (
                                                            <tr key={item.id || iIdx} className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors">
                                                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                                                                    <div>{item.item_name || `Additional Item #${iIdx + 1}`}</div>
                                                                    {item.notes && <div className="text-[10px] text-slate-400 font-normal italic">{item.notes}</div>}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap capitalize">
                                                                    {item.unit || "unit"}
                                                                </td>
                                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                                    ₱{price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                        {taxRate > 0 ? `${taxRate}% VAT` : "0% / Exempt"}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                                    {ship > 0 ? `₱${ship.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "Free"}
                                                                </td>
                                                                <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                    {disc > 0 ? `-₱${disc.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                                                                </td>
                                                                <td className="py-2.5 px-3 font-mono font-black text-pink-600 dark:text-pink-400 text-right whitespace-nowrap">
                                                                    ₱{tot.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Commercial Terms & Value-Add Inclusions */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <CreditCard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Commercial &amp; Fulfillment Commitments</span>
                                    </h4>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                                        <div className="p-2.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Terms</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{quote?.payment_terms || "Standard terms"}</p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery Terms</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{quote?.delivery_terms || "FOB Destination"}</p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Warranty / Guarantee</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{quote?.warranty_terms || "Standard replacement"}</p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-0.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Lead Time / Validity</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">
                                                {quote?.lead_time_days ? `${quote.lead_time_days} days` : "2-3 days"} • {quote?.price_validity || "30 days"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Buyer Delivery Destination */}
                                    <div className="p-2.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] flex items-center justify-between text-[11px] gap-2">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Buyer Delivery Destination:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-right" title={quote?.delivery_location || "352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)"}>
                                            {quote?.delivery_location || "352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)"}
                                        </span>
                                    </div>

                                    {/* Value Add Inclusions */}
                                    {servicesList.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                <Award className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                                Value-Add Inclusions &amp; Services Offered by Vendor:
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {servicesList.map((svc, idx) => (
                                                    <span
                                                        key={`view-svc-${idx}`}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-200 border border-pink-200 dark:border-pink-800/60 flex items-center gap-1"
                                                    >
                                                        <Check className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                                        <span>{svc}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Vendor Submitted Clauses */}
                                    {rawClauses && (
                                        <div className="p-3.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] space-y-1.5">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                                Governing Terms and Conditions and Vendor Submitted Terms &amp; Special Clauses:
                                            </span>
                                            <p className="text-[11px] text-slate-800 dark:text-slate-100 font-mono whitespace-pre-line leading-relaxed">
                                                {rawClauses}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Uploaded Evidence Documents & Quotation Files */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <FileCheck2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>Uploaded Evidence &amp; Quotation Documents ({documents.length})</span>
                                        </h4>
                                    </div>

                                    {documents.length === 0 ? (
                                        <div className="p-5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-dashed border-slate-300 dark:border-white/10 text-center text-slate-400 dark:text-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.25)] space-y-1">
                                            <File className="w-6 h-6 mx-auto opacity-60" />
                                            <p className="text-xs font-semibold">No supporting files attached with this quotation.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {documents.map((doc) => (
                                                <div
                                                    key={doc.id}
                                                    className="p-3.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 font-bold shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)]">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate" title={doc.fileName}>
                                                                {doc.fileName}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {doc.documentType}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewDoc(doc)}
                                                            className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                                                            title="Preview File"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Preview</span>
                                                        </button>

                                                        {doc.publicUrl && (
                                                            <a
                                                                href={doc.publicUrl}
                                                                download={doc.fileName}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-xs transition-all flex items-center justify-center cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                                                                title="Download File"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-5 sm:px-6 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Quotation Review Mode • View Only
                        </span>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/80 dark:border-white/10 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.04),_2px_2px_4px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] text-xs font-bold transition-all cursor-pointer"
                            >
                                Close
                            </button>

                            {/* Award Bid button if not awarded yet; Register & Activate button if already awarded */}
                            {!isQuoteAwarded && onAwardBid && quote ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onAwardBid(supplier, quote);
                                        onClose();
                                    }}
                                    className="px-5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>Award Bid to this Supplier</span>
                                </button>
                            ) : isQuoteAwarded && onProceedToActivate ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onProceedToActivate(supplier);
                                        onClose();
                                    }}
                                    className="px-5 py-2 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)] transition-all active:scale-95"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    <span>Register &amp; Activate Supplier &rarr;</span>
                                </button>
                            ) : onProceedToActivate ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onProceedToActivate(supplier);
                                        onClose();
                                    }}
                                    className="px-5 py-2 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)] transition-all active:scale-95"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    <span>Register &amp; Activate Supplier &rarr;</span>
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Document Preview / Lightbox Modal */}
                {previewDoc && (
                    <div
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
                        onClick={() => setPreviewDoc(null)}
                    >
                        <div
                            className="relative w-full max-w-4xl bg-[#ebf0f7] dark:bg-[#141624] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Preview Header */}
                            <div className="p-4 sm:px-6 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#e8ecf4] dark:bg-[#10121b] shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)]">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                            {previewDoc.fileName}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <span className="font-semibold text-pink-600 dark:text-pink-400">{previewDoc.documentType}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {previewDoc.publicUrl && (
                                        <a
                                            href={previewDoc.publicUrl}
                                            download={previewDoc.fileName}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/80 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] cursor-pointer"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Download</span>
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(null)}
                                        className="p-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-300/80 dark:border-white/10 transition-all cursor-pointer shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]"
                                        title="Close Preview"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Body */}
                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#f0f4fa] dark:bg-[#121420] flex items-center justify-center min-h-[350px]">
                                {previewDoc.fileType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.fileName) ? (
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <img
                                            src={previewDoc.publicUrl}
                                            alt={previewDoc.fileName}
                                            className="max-h-[68vh] max-w-full object-contain rounded-xl border border-slate-300/70 dark:border-white/10"
                                        />
                                    </div>
                                ) : previewDoc.fileType === "application/pdf" || previewDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                                    <iframe
                                        src={previewDoc.publicUrl}
                                        title={previewDoc.fileName}
                                        className="w-full h-[68vh] border border-slate-300/70 dark:border-white/10 rounded-xl bg-white"
                                    />
                                ) : (
                                    <div className="text-center p-8 space-y-4 max-w-md mx-auto">
                                        <FileText className="w-12 h-12 text-pink-600 mx-auto" />
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{previewDoc.fileName}</p>
                                            <p className="text-xs text-slate-400 mt-1">Direct in-browser preview is available for images and PDF documents.</p>
                                        </div>
                                        {previewDoc.publicUrl && (
                                            <a
                                                href={previewDoc.publicUrl}
                                                download={previewDoc.fileName}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-all cursor-pointer"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>Download &amp; Open Locally</span>
                                            </a>
                                        )}
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
