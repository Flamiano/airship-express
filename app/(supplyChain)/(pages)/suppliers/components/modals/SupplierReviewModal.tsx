// app/(supplyChain)/(pages)/suppliers/components/modals/SupplierReviewModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppButton } from "../../../../components/ui/AppButton";
import Portal from "../../../../components/client/Portal";
import { supabase } from "../../../../lib/services/client/supabase";
import {
    Building2,
    Store,
    ShieldCheck,
    CheckCircle2,
    X,
    FileText,
    UploadCloud,
    Sparkles,
    Trash2,
    RefreshCw,
    MapPin,
    Phone,
    Mail,
    Globe,
    CreditCard,
    Truck,
    RotateCcw,
    Shield,
    Clock,
    Layers,
    Package,
    AlertCircle,
    Info,
    Check,
    Eye,
    ChevronDown,
    FileCheck2,
    ClipboardCheck,
    Edit3,
    Download,
    ExternalLink,
    Boxes,
    Scale,
    CalendarCheck2,
    Coins,
    CheckCheck,
    Award,
    Tag,
    Maximize2,
    Plus,
} from "lucide-react";
import type { PotentialSupplierItem } from "../tables/PotentialSuppliersTab";

export const PRODUCT_UNIT_OPTIONS = [
    "piece",
    "box",
    "set",
    "pack",
    "roll",
    "lot",
    "ream",
    "bundle",
    "carton",
    "pair",
    "kg",
    "meter",
    "liter",
    "unit",
];

const DEFAULT_TERMS_AND_CONDITIONS = `1. Supplier shall deliver the items according to the quantity and specifications stated in the Purchase Order.
2. Delivered items are subject to inspection and verification.
3. Damaged, defective, or incorrect items may be rejected or returned.
4. Payment shall follow the agreed payment terms.
5. Supplier must provide the required delivery and supporting documents.`;

export const PAYMENT_METHOD_OPTIONS = [
    "Bank Transfer",
    "Cheque / Check",
    "Cash on Delivery (COD)",
    "GCash / E-Wallet",
    "Credit Card / Corporate Card",
    "Letter of Credit (LC)",
    "Other",
];

export const PAYMENT_TERMS_OPTIONS = [
    "Net 30 Days",
    "Net 15 Days",
    "Net 60 Days",
    "Net 7 Days",
    "Payment Upon Delivery (COD)",
    "50% Advance, 50% Upon Delivery",
    "100% Advance Payment",
    "2/10 Net 30",
    "Other",
];

export function formatTermsAsList(terms: string): string {
    if (!terms) return "";
    let cleaned = terms.trim();

    // Split inline numbered items like "1. ... 2. ... 3. ..." or "1) ... 2) ..." into separate lines
    cleaned = cleaned.replace(/(\.|\;|\:)?\s+(?=(\d+\.|\d+\)|\(\d+\))\s+)/g, "$1\n");

    // Split bullet points on the same line into separate lines
    cleaned = cleaned.replace(/(\.|\;)?\s+(?=[•\-\*]\s+)/g, "$1\n");

    // Clean up lines and rejoin
    return cleaned
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .join("\n");
}

export interface StagedDocument {
    id: string;
    file?: File;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileBase64?: string;
    publicUrl?: string;
    storagePath?: string;
    isExisting?: boolean;
    documentType: string;
    isExtracting?: boolean;
    extractedData?: any;
    extractedText?: string;
    summary?: string;
    uploadedBy?: string | null;
    /** True when the file came from the supplier (no uploaded_by in supplier_documents). Read-only. */
    isSupplierUpload?: boolean;
}

export interface OtherProductItem {
    id: string;
    item_name: string;
    unit: string;
    unit_price: number | string;
    discount?: number | string;
    shipping_fee?: number | string;
    tax_classification?: "vatable" | "zero_rated" | "exempt" | "others" | string;
    tax_rate?: number | string;
    total_amount?: number | string;
    notes?: string;
    is_awarded_item?: boolean;
}

interface SupplierReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: PotentialSupplierItem | null;
    currentUserId?: string | null;
    onSupplierActivated: () => void;
}

export function SupplierReviewModal({
    isOpen,
    onClose,
    supplier,
    currentUserId,
    onSupplierActivated,
}: SupplierReviewModalProps) {
    // Form fields state
    const [formData, setFormData] = useState({
        name: "",
        category: "",
        contact_person: "",
        phone: "",
        email: "",
        location: "",
        website: "",
        products: "",
        notes: "",
        payment_method: "Bank Transfer",
        payment_terms: "Net 30 Days",
        delivery_terms: "FOB Destination / Direct Delivery",
        return_policy: "7-day return on defective/damaged items",
        warranty: "1 Year Standard Warranty",
        lead_time: "3-5 Business Days",
        moq: "No minimum / 1 unit",
        terms_and_conditions: DEFAULT_TERMS_AND_CONDITIONS,
    });

    // Staged documents state (both local and Supabase stored files)
    const [stagedDocs, setStagedDocs] = useState<StagedDocument[]>([]);
    const [otherProducts, setOtherProducts] = useState<OtherProductItem[]>([]);
    const [defaultTerms, setDefaultTerms] = useState<string>(DEFAULT_TERMS_AND_CONDITIONS);
    const [selectedDocType, setSelectedDocType] = useState<string>("Business Permit");
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showConfirmActivate, setShowConfirmActivate] = useState<boolean>(false);
    const [activeSection, setActiveSection] = useState<"general" | "terms" | "other_products" | "docs" | "review">("general");
    const [isCustomPaymentMethod, setIsCustomPaymentMethod] = useState<boolean>(false);
    const [isCustomPaymentTerms, setIsCustomPaymentTerms] = useState<boolean>(false);
    const [previewDoc, setPreviewDoc] = useState<StagedDocument | null>(null);
    const [submittedProposal, setSubmittedProposal] = useState<any | null>(null);
    const [isLoadingSubmittedQuote, setIsLoadingSubmittedQuote] = useState<boolean>(false);
    const [showFullTermsModal, setShowFullTermsModal] = useState<boolean>(false);
    const [fullTermsDraft, setFullTermsDraft] = useState<string>("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize or reset form when modal opens with supplier data & load submitted quotation + files
    useEffect(() => {
        let isCancelled = false;

        async function loadSupplierAndQuotationData() {
            if (!isOpen || !supplier) return;

            setIsLoadingSubmittedQuote(true);

            // Resolve real numeric supplier ID from dbSupplierId, id, submittedQuote, or lookup by name
            let resolvedSupplierId: number | null = null;
            if (supplier.dbSupplierId && !isNaN(Number(supplier.dbSupplierId))) {
                resolvedSupplierId = Number(supplier.dbSupplierId);
            } else if (!isNaN(Number(supplier.id)) && Number(supplier.id) > 0) {
                resolvedSupplierId = Number(supplier.id);
            } else if (supplier.submittedQuote?.supplier_id && !isNaN(Number(supplier.submittedQuote.supplier_id))) {
                resolvedSupplierId = Number(supplier.submittedQuote.supplier_id);
            }

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

            let quote: any = supplier.submittedQuote || null;

            // 1. Fetch from supplier_quotations if not already present
            if (!quote && (resolvedSupplierId || supplier.name)) {
                try {
                    let quoteQuery = supabase.from("supplier_quotations").select("*");
                    const rawName = supplier.name?.trim() || "";
                    const cleanName = rawName.split(" - ")[0].split(" (")[0].trim();

                    if (resolvedSupplierId) {
                        quoteQuery = quoteQuery.or(`supplier_id.eq.${resolvedSupplierId},supplier_name.ilike.%${cleanName}%`);
                    } else if (cleanName) {
                        quoteQuery = quoteQuery.ilike("supplier_name", `%${cleanName}%`);
                    }

                    const { data: quoteRows } = await quoteQuery.order("created_at", { ascending: false }).limit(1);
                    if (quoteRows && quoteRows.length > 0) {
                        quote = quoteRows[0];
                        if (!resolvedSupplierId && quote.supplier_id) {
                            resolvedSupplierId = Number(quote.supplier_id);
                        }
                    }
                } catch (err) {
                    console.warn("Error fetching supplier quotation:", err);
                }
            }

            if (isCancelled) return;
            setSubmittedProposal(quote);

            // 2. Fetch all existing documents from supplier_documents via API (bypasses RLS)
            let loadedDocs: StagedDocument[] = [];
            const targetDocSupplierId = resolvedSupplierId || quote?.supplier_id;

            try {
                const params = new URLSearchParams();
                if (targetDocSupplierId) params.append("supplier_id", String(targetDocSupplierId));
                if (supplier.name) params.append("supplier_name", supplier.name);
                if (quote?.id) params.append("quotation_id", String(quote.id));

                const res = await fetch(`/api/suppliers/documents?${params.toString()}`);
                const json = await res.json();

                if (json.success && Array.isArray(json.documents)) {
                    loadedDocs = json.documents.map((d: any) => ({
                        ...d,
                        isExisting: true,
                        isSupplierUpload: !d.uploadedBy,
                    }));
                }
            } catch (apiErr) {
                console.error("API error fetching supplier documents:", apiErr);
            }

            // Fallback: If API returned empty, attempt direct client query
            if (loadedDocs.length === 0 && targetDocSupplierId) {
                try {
                    const { data: dbDocs } = await supabase
                        .from("supplier_documents")
                        .select("*")
                        .eq("supplier_id", Number(targetDocSupplierId))
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

                            loadedDocs.push({
                                id: String(dbDoc.id || `doc_${Math.random()}`),
                                fileName: dbDoc.file_name || "Quotation Evidence Document",
                                fileType: dbDoc.file_name?.toLowerCase().endsWith(".pdf") 
                                    ? "application/pdf" 
                                    : (/\.(png|jpe?g|webp|gif|svg)$/i.test(dbDoc.file_name || "") ? "image/jpeg" : "application/octet-stream"),
                                fileSize: 102400,
                                documentType: dbDoc.document_type || "Vendor Quotation Evidence",
                                storagePath: dbDoc.storage_path,
                                publicUrl,
                                isExisting: true,
                                uploadedBy: dbDoc.uploaded_by || null,
                                isSupplierUpload: !dbDoc.uploaded_by,
                                extractedData: dbDoc.extracted_data || null,
                                extractedText: dbDoc.extracted_text || null,
                                summary: dbDoc.extracted_data?.document_summary || undefined,
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error fetching supplier documents fallback:", err);
                }
            }

            if (isCancelled) return;
            setStagedDocs(loadedDocs);

            // 3. Parse all parameters from submittedQuote & supplier notes
            const discoveredLocation = supplier.location || supplier.streetAddress || supplier.city || (quote?.location || "");
            const discoveredProducts = quote?.products || supplier.products || (supplier.services_offered && supplier.services_offered.length > 0 ? supplier.services_offered.join(", ") : "");
            const discoveredWebsite = supplier.website || "";

            let rawNotes = supplier.notes || quote?.notes || "";
            let cleanNotes = rawNotes;
            let parsedPaymentMethod = "";
            let parsedPaymentTerms = quote?.payment_terms || "";
            let parsedDeliveryTerms = quote?.delivery_terms || "";
            let parsedReturnPolicy = quote?.price_validity || "";
            let parsedWarranty = quote?.warranty_terms || "";
            let parsedLeadTime = quote?.lead_time_days ? `${quote.lead_time_days} Business Days` : "";
            let parsedMoq = "";
            let parsedClauses = "";

            // Check if rawNotes has [Terms: Payment=... | Warranty=... | Validity=... | Delivery=... | Clauses: ...]
            if (cleanNotes.includes("[Terms:")) {
                const termsMatch = cleanNotes.match(/\[Terms:\s*([^\]]+)\]/i);
                if (termsMatch && termsMatch[1]) {
                    const termsContent = termsMatch[1];
                    const parts = termsContent.split("|").map(p => p.trim());
                    for (const part of parts) {
                        if (/^Payment=/i.test(part)) parsedPaymentTerms = parsedPaymentTerms || part.replace(/^Payment=/i, "").trim();
                        else if (/^Warranty=/i.test(part)) parsedWarranty = parsedWarranty || part.replace(/^Warranty=/i, "").trim();
                        else if (/^Validity=/i.test(part)) parsedReturnPolicy = parsedReturnPolicy || part.replace(/^Validity=/i, "").trim();
                        else if (/^Delivery=/i.test(part)) parsedDeliveryTerms = parsedDeliveryTerms || part.replace(/^Delivery=/i, "").trim();
                        else if (/^Clauses:\s*/i.test(part)) {
                            const clauseText = part.replace(/^Clauses:\s*/i, "").trim();
                            if (clauseText) {
                                parsedClauses = clauseText;
                            }
                        }
                    }
                }
                cleanNotes = cleanNotes.replace(/\[Terms:\s*[^\]]+\]/i, "").trim();
            }

            if (cleanNotes.includes("--- Terms & Conditions ---")) {
                const parts = cleanNotes.split(/---+\s*Terms\s*&\s*Conditions\s*---+/i);
                cleanNotes = (parts[0] || "").trim();
                if (parts[1] && parts[1].trim()) {
                    parsedClauses = parts[1].trim();
                }
            }

            // Extract and strip all commercial lines from notes
            const lines = cleanNotes.split("\n");
            const remainingNotes: string[] = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (/^Payment Method:\s*/i.test(trimmed)) {
                    parsedPaymentMethod = trimmed.replace(/^Payment Method:\s*/i, "").trim();
                } else if (/^Payment Terms:\s*/i.test(trimmed)) {
                    parsedPaymentTerms = parsedPaymentTerms || trimmed.replace(/^Payment Terms:\s*/i, "").trim();
                } else if (/^Delivery Terms:\s*/i.test(trimmed)) {
                    parsedDeliveryTerms = parsedDeliveryTerms || trimmed.replace(/^Delivery Terms:\s*/i, "").trim();
                } else if (/^Return Policy:\s*/i.test(trimmed)) {
                    parsedReturnPolicy = parsedReturnPolicy || trimmed.replace(/^Return Policy:\s*/i, "").trim();
                } else if (/^Warranty:\s*/i.test(trimmed)) {
                    parsedWarranty = parsedWarranty || trimmed.replace(/^Warranty:\s*/i, "").trim();
                } else if (/^Lead Time:\s*/i.test(trimmed)) {
                    parsedLeadTime = parsedLeadTime || trimmed.replace(/^Lead Time:\s*/i, "").trim();
                } else if (/^MOQ:\s*/i.test(trimmed)) {
                    parsedMoq = trimmed.replace(/^MOQ:\s*/i, "").trim();
                } else {
                    remainingNotes.push(line);
                }
            }

            cleanNotes = remainingNotes.join("\n").trim();
            if (cleanNotes.startsWith("Notes: ")) {
                cleanNotes = cleanNotes.replace(/^Notes:\s*/i, "").trim();
            }

            // Build terms & conditions from the supplier's quotation
            let initialTerms = "";
            if (quote?.supplier_terms && quote.supplier_terms.trim()) {
                initialTerms = quote.supplier_terms.trim();
            } else if (parsedClauses && parsedClauses.trim()) {
                initialTerms = parsedClauses.trim();
            } else if (quote) {
                const servicesText = Array.isArray(quote.services_offered)
                    ? quote.services_offered.join(", ")
                    : (typeof quote.services_offered === "string" && quote.services_offered ? quote.services_offered : "");

                const termsList: string[] = [
                    `1. Scope & Validity: Pricing and quantities quoted under Reference ${quote.request_number || 'Quotation'} are valid for ${quote.price_validity || '30 days'}.`,
                    `2. Payment Terms: ${quote.payment_terms || parsedPaymentTerms || 'Standard Payment Terms'}.`,
                    `3. Delivery Terms: ${quote.delivery_terms || parsedDeliveryTerms || 'FOB Destination / Direct Delivery'} (Lead time: ${quote.lead_time_days ? `${quote.lead_time_days} business days` : (parsedLeadTime || '3-5 Business Days')}).`,
                    `4. Warranty & Guarantee: ${quote.warranty_terms || parsedWarranty || 'Standard replacement and warranty terms apply'}.`,
                ];

                if (servicesText) {
                    termsList.push(`5. Value-Add Inclusions: ${servicesText}.`);
                }

                initialTerms = termsList.join("\n");
            } else {
                initialTerms = DEFAULT_TERMS_AND_CONDITIONS;
            }

            const initialPaymentMethod = parsedPaymentMethod || "Bank Transfer";
            const initialPaymentTerms = parsedPaymentTerms || "Net 30 Days";

            setDefaultTerms(initialTerms);

            setFormData({
                name: quote?.supplier_name || supplier.name || "",
                category: quote?.category || supplier.category || "General Supplies",
                contact_person: quote?.contact_person || supplier.contact_person || "",
                phone: quote?.contact_phone || supplier.phone || "",
                email: quote?.contact_email || supplier.email || "",
                location: discoveredLocation,
                website: discoveredWebsite,
                products: discoveredProducts,
                notes: cleanNotes,
                payment_method: initialPaymentMethod,
                payment_terms: initialPaymentTerms,
                delivery_terms: parsedDeliveryTerms || "FOB Destination / Direct Delivery",
                return_policy: parsedReturnPolicy || "7-day return on defective/damaged items",
                warranty: parsedWarranty || "1 Year Standard Warranty",
                lead_time: parsedLeadTime || "3-5 Business Days",
                moq: parsedMoq || "No minimum / 1 unit",
                terms_and_conditions: initialTerms,
            });

            setIsCustomPaymentMethod(!PAYMENT_METHOD_OPTIONS.includes(initialPaymentMethod));
            setIsCustomPaymentTerms(!PAYMENT_TERMS_OPTIONS.includes(initialPaymentTerms));

            // Hydrate products to supply from quote and/or supplier
            const rawOtherProducts = Array.isArray(quote?.other_products_offer)
                ? quote.other_products_offer
                : (Array.isArray(supplier?.other_products_offer) ? supplier.other_products_offer : []);

            const initialProductsList: any[] = [];

            // 1. Automatically include the primary requested / awarded quotation product
            const supplierAny = supplier as any;
            const primaryItemName = (quote?.item_name || supplierAny?.itemName || supplierAny?.item_name || quote?.products || supplier?.products || "").trim();
            if (primaryItemName) {
                const pPrice = Number(quote?.unit_price ?? supplierAny?.unitPrice ?? supplierAny?.unit_price ?? 0);
                const pDisc = Number(quote?.discount ?? 0);
                const pShip = Number(quote?.shipping_fee ?? 0);
                const pTaxRate = Number(quote?.tax_rate ?? 12);
                const pTaxClassification = quote?.tax_type || (pTaxRate === 0 ? "exempt" : "vatable");
                const pTaxable = Math.max(0, pPrice - pDisc);
                const pTax = Number(((pTaxable * pTaxRate) / 100).toFixed(2));
                const pTotal = Number((pTaxable + pTax + pShip).toFixed(2));

                initialProductsList.push({
                    id: `awarded_${quote?.id || Date.now()}`,
                    item_name: primaryItemName,
                    unit: quote?.unit || supplierAny?.unit || "unit",
                    unit_price: pPrice,
                    discount: pDisc,
                    shipping_fee: pShip,
                    tax_classification: pTaxClassification,
                    tax_rate: pTaxRate,
                    total_amount: pTotal,
                    notes: quote?.notes ? `Quotation Note: ${quote.notes}` : `Awarded Quotation Product for Requisition #${quote?.request_number || ''}`,
                    is_awarded_item: true,
                });
            }

            // 2. Append additional product offerings from the quotation / catalog
            rawOtherProducts.forEach((p: any, idx: number) => {
                const pName = String(p.item_name || p.name || "").trim();
                if (!pName) return;
                const alreadyExists = initialProductsList.some(
                    (it) => it.item_name.toLowerCase() === pName.toLowerCase()
                );
                if (!alreadyExists) {
                    initialProductsList.push({
                        id: p.id || `op_${Date.now()}_${idx}`,
                        item_name: pName,
                        unit: p.unit || "unit",
                        unit_price: p.unit_price != null ? Number(p.unit_price) : 0,
                        discount: p.discount != null ? Number(p.discount) : 0,
                        shipping_fee: p.shipping_fee != null ? Number(p.shipping_fee) : 0,
                        tax_classification: p.tax_classification || "vatable",
                        tax_rate: p.tax_rate != null ? Number(p.tax_rate) : 12,
                        total_amount: p.total_amount != null ? Number(p.total_amount) : undefined,
                        notes: p.notes || "",
                        is_awarded_item: false,
                    });
                }
            });

            setOtherProducts(initialProductsList);

            setActiveSection("general");
            setIsLoadingSubmittedQuote(false);
        }

        loadSupplierAndQuotationData();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, supplier]);

    if (!isOpen || !supplier) return null;

    // Handle Form Input Change
    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Reset Terms to Supplier Quotation Template
    const handleResetTerms = () => {
        setFormData(prev => ({ ...prev, terms_and_conditions: defaultTerms }));
        toast.info("Terms and Conditions reset to quotation terms.");
    };

    // Open Full Terms & Conditions Modal
    const handleOpenFullTermsModal = () => {
        setFullTermsDraft(formData.terms_and_conditions || "");
        setShowFullTermsModal(true);
    };

    // Save Full Terms & Conditions
    const handleSaveFullTerms = () => {
        handleChange("terms_and_conditions", fullTermsDraft);
        setShowFullTermsModal(false);
        toast.success("Terms & Conditions updated!");
    };

    // Handle File Selection
    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newStaged: StagedDocument[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Check size (max 15MB)
            if (file.size > 15 * 1024 * 1024) {
                toast.error(`File "${file.name}" exceeds 15MB limit.`);
                continue;
            }

            try {
                const base64 = await readFileAsBase64(file);
                const docItem: StagedDocument = {
                    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    file,
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    fileBase64: base64,
                    documentType: selectedDocType,
                };
                newStaged.push(docItem);
            } catch (err) {
                console.error("Error reading file:", err);
                toast.error(`Failed to read "${file.name}"`);
            }
        }

        if (newStaged.length > 0) {
            setStagedDocs(prev => [...prev, ...newStaged]);
            toast.success(`Added ${newStaged.length} document${newStaged.length > 1 ? "s" : ""}. You can now run AI extraction.`);
            // Automatically trigger AI extraction for the newly added documents
            newStaged.forEach(doc => triggerAIExtraction(doc.id, doc));
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    // Trigger AI Extraction on a staged document and automatically add terms & conditions
    const triggerAIExtraction = async (docId: string, directDoc?: StagedDocument, autoApply: boolean = true) => {
        const doc = directDoc || stagedDocs.find(d => d.id === docId);
        if (!doc) return;

        // Set loading state
        setStagedDocs(prev => prev.map(d => d.id === docId ? { ...d, isExtracting: true } : d));

        try {
            let base64ToUse = doc.fileBase64;
            // If it's a Supabase existing doc without base64 in state, fetch it from publicUrl
            if (!base64ToUse && doc.publicUrl) {
                try {
                    const blobRes = await fetch(doc.publicUrl);
                    const blob = await blobRes.blob();
                    base64ToUse = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (fetchErr) {
                    console.error("Could not fetch remote file for AI extraction:", fetchErr);
                }
            }

            if (!base64ToUse) {
                throw new Error("File content is not accessible for AI extraction.");
            }

            const res = await fetch("/api/suppliers/extract-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileBase64: base64ToUse,
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    documentType: doc.documentType,
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || "Failed to extract information");
            }

            const extracted = result.extractedData || {};

            setStagedDocs(prev => prev.map(d => {
                if (d.id === docId) {
                    return {
                        ...d,
                        isExtracting: false,
                        fileBase64: base64ToUse || d.fileBase64,
                        extractedData: extracted,
                        extractedText: extracted.extracted_text || result.rawText || "",
                        summary: extracted.document_summary || `Extracted ${Object.keys(extracted).filter(k => extracted[k]).length} fields`,
                    };
                }
                return d;
            }));

            if (autoApply) {
                handleApplyExtractedData(extracted);
                if (extracted.terms_and_conditions) {
                    toast.success(`AI extracted terms & conditions from "${doc.fileName}" and added to Tab 2!`);
                } else {
                    toast.success(`AI extracted details from "${doc.fileName}" and updated form!`);
                }
            } else {
                toast.success(`AI extracted details from "${doc.fileName}"! Click "Extract and Add Terms & Conditions" to apply.`);
            }
        } catch (err: any) {
            console.error("AI Extraction error:", err);
            toast.error(err?.message || "AI extraction failed for document");
            setStagedDocs(prev => prev.map(d => d.id === docId ? { ...d, isExtracting: false } : d));
        }
    };

    // Apply AI extracted data to the form (including Terms & Conditions in Tab 2)
    const handleApplyExtractedData = (extracted: any) => {
        if (!extracted) return;

        // Calculate count of extracted fields that are non-empty
        const candidateFields = [
            extracted.supplier_name,
            extracted.category,
            extracted.contact_person,
            extracted.phone,
            extracted.email,
            extracted.location,
            extracted.website,
            extracted.tax_id,
            extracted.products,
            extracted.payment_method,
            extracted.payment_terms,
            extracted.delivery_terms,
            extracted.warranty,
            extracted.lead_time,
            extracted.moq,
            extracted.return_policy,
            extracted.terms_and_conditions,
            extracted.notes,
        ].filter(Boolean);

        const appliedCount = Math.max(candidateFields.length, 1);

        setFormData(prev => {
            const updated = { ...prev };

            if (extracted.supplier_name && (!prev.name || prev.name.trim() === "")) {
                updated.name = extracted.supplier_name;
            }
            if (extracted.category && (!prev.category || prev.category === "General Supplies")) {
                updated.category = extracted.category;
            }
            if (extracted.contact_person && !prev.contact_person) {
                updated.contact_person = extracted.contact_person;
            }
            if (extracted.phone && !prev.phone) {
                updated.phone = extracted.phone;
            }
            if (extracted.email && !prev.email) {
                updated.email = extracted.email;
            }
            if (extracted.location && (!prev.location || prev.location.length < 5)) {
                updated.location = extracted.location;
            }
            if (extracted.website && !prev.website) {
                updated.website = extracted.website;
            }
            if (extracted.products && !prev.products) {
                updated.products = extracted.products;
            }
            if (extracted.payment_method) {
                updated.payment_method = extracted.payment_method;
                const isPreset = PAYMENT_METHOD_OPTIONS.filter(o => o !== "Other").includes(extracted.payment_method);
                setIsCustomPaymentMethod(!isPreset);
            }
            if (extracted.payment_terms) {
                updated.payment_terms = extracted.payment_terms;
                const isPreset = PAYMENT_TERMS_OPTIONS.filter(o => o !== "Other").includes(extracted.payment_terms);
                setIsCustomPaymentTerms(!isPreset);
            }
            if (extracted.delivery_terms) {
                updated.delivery_terms = extracted.delivery_terms;
            }
            if (extracted.warranty) {
                updated.warranty = extracted.warranty;
            }
            if (extracted.lead_time) {
                updated.lead_time = extracted.lead_time;
            }
            if (extracted.moq) {
                updated.moq = extracted.moq;
            }
            if (extracted.return_policy) {
                updated.return_policy = extracted.return_policy;
            }
            // Extract and add Terms & Conditions into Tab 2 (insert at bottom of current terms formatted as list)
            if (extracted.terms_and_conditions && extracted.terms_and_conditions.trim()) {
                const formattedNewTerms = formatTermsAsList(extracted.terms_and_conditions.trim());
                const currentTerms = (prev.terms_and_conditions || "").trim();
                if (!currentTerms) {
                    updated.terms_and_conditions = formattedNewTerms;
                } else if (!currentTerms.includes(formattedNewTerms) && !currentTerms.includes(extracted.terms_and_conditions.trim())) {
                    updated.terms_and_conditions = `${currentTerms}\n\n--- Extracted Terms & Conditions ---\n${formattedNewTerms}`;
                }
            }
            if (extracted.notes) {
                updated.notes = prev.notes ? `${prev.notes}\n${extracted.notes}` : extracted.notes;
            }

            return updated;
        });

        toast.success(`Applied ${appliedCount} extracted field(s) including Terms & Conditions to the supplier profile!`);
    };

    // Remove Staged Document
    const handleRemoveDoc = (docId: string) => {
        // Supplier-submitted files are read-only and cannot be removed
        setStagedDocs(prev => prev.filter(d => d.id !== docId || d.isSupplierUpload));
    };

    // Remove Other Product
    const handleRemoveOtherProduct = (indexToRemove: number) => {
        const removedItem = otherProducts[indexToRemove];
        setOtherProducts(prev => prev.filter((_, idx) => idx !== indexToRemove));
        toast.success(`Removed "${removedItem?.item_name || 'Item'}" from other products offer`);
    };

    // Add Other Product
    const handleAddOtherProduct = () => {
        setOtherProducts(prev => [
            ...prev,
            {
                id: `op_${Date.now()}_${prev.length}`,
                item_name: "",
                unit: "unit",
                unit_price: 0,
                discount: 0,
                shipping_fee: 0,
                tax_classification: "vatable",
                total_amount: 0,
                notes: "",
            }
        ]);
    };

    // Update Other Product field
    const handleUpdateOtherProduct = (index: number, field: string, value: any) => {
        setOtherProducts(prev => {
            const updated = [...prev];
            const current = { ...updated[index], [field]: value };
            const price = Number(field === "unit_price" ? value : current.unit_price || 0);
            const disc = Number(field === "discount" ? value : current.discount || 0);
            const ship = Number(field === "shipping_fee" ? value : current.shipping_fee || 0);
            const taxClass = field === "tax_classification" ? value : current.tax_classification || "vatable";
            
            let taxRate = 12;
            if (taxClass === "zero_rated" || taxClass === "exempt" || taxClass === "Non-VAT / Exempt (0%)" || taxClass === "Zero-Rated (0%)") {
                taxRate = 0;
            } else if (taxClass === "vatable" || taxClass === "VAT (12%)") {
                taxRate = 12;
            } else if (taxClass === "others" || taxClass === "Others") {
                taxRate = field === "tax_rate" ? Math.max(0, Number(value) || 0) : Math.max(0, Number(current.tax_rate ?? 12));
            } else if (current.tax_rate !== undefined) {
                taxRate = Math.max(0, Number(current.tax_rate) || 0);
            }

            const taxable = Math.max(0, price - disc);
            const tax = (taxable * taxRate) / 100;
            current.tax_rate = taxRate;
            current.total_amount = taxable + ship + tax;
            updated[index] = current;
            return updated;
        });
    };

    const supplierUploadedDocs = stagedDocs.filter(d => d.isSupplierUpload);
    const adminUploadedDocs = stagedDocs.filter(d => !d.isSupplierUpload);

    // Approve & Activate Supplier
    const handleActivateSupplier = async () => {
        if (!formData.name.trim()) {
            toast.error("Supplier Business Name is required.");
            return;
        }

        setIsSubmitting(true);
        try {
            let candidateItemName: string | undefined;
            if (supplier?.products) {
                candidateItemName = supplier.products.replace(/^\d+\s*[a-zA-Z]*\s+of\s+/i, '').trim();
            }

            const payload = {
                supplierId: supplier.dbSupplierId || supplier.id,
                supplierData: {
                    ...formData,
                    other_products_offer: otherProducts,
                },
                documents: stagedDocs.filter(d => !d.isExisting && !!d.fileBase64).map(d => ({
                    file_base64: d.fileBase64,
                    file_name: d.fileName,
                    file_type: d.fileType,
                    document_type: d.documentType,
                    extracted_text: d.extractedText || null,
                    extracted_data: d.extractedData || null,
                })),
                userId: currentUserId || null,
                officialForInventoryItemName: candidateItemName || undefined,
            };

            const res = await fetch("/api/suppliers/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to activate supplier.");
            }

            toast.success(data.message || `Supplier "${formData.name}" is now an Active Supplier!`);
            onSupplierActivated();
            onClose();
        } catch (err: any) {
            console.error("Error approving supplier:", err);
            toast.error(err?.message || "Failed to activate supplier.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 bg-slate-950/80 dark:bg-black/90 backdrop-blur-md z-[130] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="relative w-full max-w-4xl bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                                        Supplier Review & Activation
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60">
                                        Review Stage
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Review discovered details, verify documents with AI, and activate this vendor.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-2xl bg-[#ebf0f7] dark:bg-[#151724] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] cursor-pointer transition-all active:scale-95"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Discovery Origin & Nav Bar */}
                    <div className="px-6 py-3 bg-[#e4eaf4] dark:bg-[#10121c] border-b border-slate-300/70 dark:border-white/[0.06] flex items-center justify-between flex-wrap gap-2 shrink-0">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Store className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                            <span>Source: <strong className="text-slate-800 dark:text-slate-100">{supplier.source || "Supplier Discovery"}</strong></span>
                            <span className="text-slate-400">•</span>
                            <span>Distance: <strong className="text-slate-800 dark:text-slate-100">{supplier.distanceKm.toFixed(1)} km</strong></span>
                            {supplier.matchLevel && (
                                <>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                                        {supplier.matchLevel} Match
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#e2e8f2] dark:bg-[#111320] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]">
                            <button
                                type="button"
                                onClick={() => setActiveSection("general")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeSection === "general"
                                        ? "bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.6),_2px_2px_5px_rgba(219,39,119,0.4)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                1. General & Info
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("terms")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeSection === "terms"
                                        ? "bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.6),_2px_2px_5px_rgba(219,39,119,0.4)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                2. Terms & Conditions
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("other_products")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeSection === "other_products"
                                        ? "bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.6),_2px_2px_5px_rgba(219,39,119,0.4)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>3. Products to Supply</span>
                                {otherProducts.length > 0 && (
                                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                                        activeSection === "other_products" ? "bg-white text-pink-700" : "bg-pink-600 text-white"
                                    }`}>
                                        {otherProducts.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("docs")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeSection === "docs"
                                        ? "bg-pink-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.6),_2px_2px_5px_rgba(219,39,119,0.4)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <span>4. Docs & AI</span>
                                {stagedDocs.length > 0 && (
                                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                                        activeSection === "docs" ? "bg-white text-pink-700" : "bg-pink-600 text-white"
                                    }`}>
                                        {stagedDocs.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("review")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeSection === "review"
                                        ? "bg-emerald-600 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.6),_2px_2px_5px_rgba(5,150,105,0.4)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>5. Review & Summary</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Modal Content */}
                    <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                        {/* TAB 1: General & Contact Information */}
                        {activeSection === "general" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[inset_1px_1px_3px_rgba(245,158,11,0.15)] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">
                                        Review the supplier information discovered from the sourcing result. Missing fields are left blank so you can verify or enrich them prior to activation.
                                    </p>
                                </div>

                                {/* Section 1.1: Basic Information */}
                                <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <Building2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Business Identity & Categorization</span>
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Supplier / Business Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={e => handleChange("name", e.target.value)}
                                                placeholder="e.g. Acme Supplies Corp."
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Category <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.category}
                                                onChange={e => handleChange("category", e.target.value)}
                                                placeholder="e.g. Office Supplies / IT Hardware / Fleet"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Contact Person
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.contact_person}
                                                onChange={e => handleChange("contact_person", e.target.value)}
                                                placeholder={formData.contact_person ? "" : "Not provided"}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Phone Contact
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={e => handleChange("phone", e.target.value)}
                                                placeholder={formData.phone ? "" : "Not provided (e.g. +63 917 123 4567)"}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => handleChange("email", e.target.value)}
                                                placeholder={formData.email ? "" : "Not provided (e.g. sales@vendor.com)"}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Website / Online Page
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.website}
                                                onChange={e => handleChange("website", e.target.value)}
                                                placeholder={formData.website ? "" : "Not provided (e.g. https://vendor.com)"}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Physical Location / Address <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.location}
                                                onChange={e => handleChange("location", e.target.value)}
                                                placeholder="Street address, City, Province/State"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Products / What They Supply
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={formData.products}
                                                onChange={e => handleChange("products", e.target.value)}
                                                placeholder={formData.products ? "" : "Not provided (e.g. Toner, A4 Copy Paper, Office Stationary, Industrial Packaging)"}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Internal Notes / Profile Remarks
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={formData.notes}
                                                onChange={e => handleChange("notes", e.target.value)}
                                                placeholder="Add internal procurement notes, references, or sourcing remarks..."
                                                className="w-full min-h-[140px] px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all resize-y leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("terms")}
                                        className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_4px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>Next: Commercial & Terms &rarr;</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Commercial Terms & Terms and Conditions */}
                        {activeSection === "terms" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                {/* Commercial Terms Grid */}
                                <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <CreditCard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                        <span>Commercial & Fulfillment Parameters</span>
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Payment Method
                                            </label>
                                            <select
                                                value={isCustomPaymentMethod ? "Other" : (PAYMENT_METHOD_OPTIONS.includes(formData.payment_method) ? formData.payment_method : "Other")}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === "Other") {
                                                        setIsCustomPaymentMethod(true);
                                                        if (PAYMENT_METHOD_OPTIONS.includes(formData.payment_method)) {
                                                            handleChange("payment_method", "");
                                                        }
                                                    } else {
                                                        setIsCustomPaymentMethod(false);
                                                        handleChange("payment_method", val);
                                                    }
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all cursor-pointer"
                                            >
                                                {PAYMENT_METHOD_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            {isCustomPaymentMethod && (
                                                <input
                                                    type="text"
                                                    value={formData.payment_method}
                                                    onChange={e => handleChange("payment_method", e.target.value)}
                                                    placeholder="Specify other payment method..."
                                                    className="mt-2 w-full px-3.5 py-2 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 text-xs transition-all animate-in fade-in duration-150"
                                                    autoFocus
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Payment Terms
                                            </label>
                                            <select
                                                value={isCustomPaymentTerms ? "Other" : (PAYMENT_TERMS_OPTIONS.includes(formData.payment_terms) ? formData.payment_terms : "Other")}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === "Other") {
                                                        setIsCustomPaymentTerms(true);
                                                        if (PAYMENT_TERMS_OPTIONS.includes(formData.payment_terms)) {
                                                            handleChange("payment_terms", "");
                                                        }
                                                    } else {
                                                        setIsCustomPaymentTerms(false);
                                                        handleChange("payment_terms", val);
                                                    }
                                                }}
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all cursor-pointer"
                                            >
                                                {PAYMENT_TERMS_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            {isCustomPaymentTerms && (
                                                <input
                                                    type="text"
                                                    value={formData.payment_terms}
                                                    onChange={e => handleChange("payment_terms", e.target.value)}
                                                    placeholder="Specify other payment terms (e.g. Net 45 Days)..."
                                                    className="mt-2 w-full px-3.5 py-2 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 text-xs transition-all animate-in fade-in duration-150"
                                                    autoFocus
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Delivery Terms
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.delivery_terms}
                                                onChange={e => handleChange("delivery_terms", e.target.value)}
                                                placeholder="e.g. FOB Destination / Direct Delivery"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Return Policy
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.return_policy}
                                                onChange={e => handleChange("return_policy", e.target.value)}
                                                placeholder="e.g. 7-day return on defective goods"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Warranty Coverage
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.warranty}
                                                onChange={e => handleChange("warranty", e.target.value)}
                                                placeholder="e.g. 1 Year Standard Warranty"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Standard Lead Time
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.lead_time}
                                                onChange={e => handleChange("lead_time", e.target.value)}
                                                placeholder="e.g. 3-5 Business Days"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3">
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Minimum Order Quantity (MOQ)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.moq}
                                                onChange={e => handleChange("moq", e.target.value)}
                                                placeholder="e.g. 1 unit / No minimum / 10 boxes"
                                                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Terms and Conditions Textarea */}
                                <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5 flex-wrap gap-2">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>Governing Terms and Conditions and Vendor Submitted Terms &amp; Special Clauses</span>
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleOpenFullTermsModal}
                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#181a29] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                                title="View and edit in full modal"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5" />
                                                <span>View Full & Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleResetTerms}
                                                className="px-2.5 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-600 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                                title="Reset to default template"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Reset Template</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                                        <span>These terms will govern purchase orders and delivery agreements with this vendor. You can freely edit or expand them.</span>
                                        <button
                                            type="button"
                                            onClick={handleOpenFullTermsModal}
                                            className="text-pink-600 dark:text-pink-400 hover:underline font-bold flex items-center gap-1 cursor-pointer shrink-0"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Expand Full Editor</span>
                                        </button>
                                    </div>

                                    <textarea
                                        rows={8}
                                        value={formData.terms_and_conditions}
                                        onChange={e => handleChange("terms_and_conditions", e.target.value)}
                                        placeholder="Enter vendor terms and conditions..."
                                        className="w-full px-4 py-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-slate-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("general")}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer"
                                    >
                                        &larr; Back to General Info
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("other_products")}
                                        className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_4px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>Next: Products to Supply ({otherProducts.length}) &rarr;</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Products to Supply from Quotation & Catalog */}
                        {activeSection === "other_products" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-[inset_1px_1px_3px_rgba(236,72,153,0.15)] text-pink-900 dark:text-pink-200 flex items-start gap-2.5">
                                    <Boxes className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-xs">Quotation Awarded Products &amp; Catalog Items to Supply</p>
                                        <p className="text-[11px] opacity-90 leading-relaxed">
                                            Review the awarded quotation item(s) and additional products supplied by this vendor. You can adjust details, unit pricing, or add extra catalog items. All confirmed items here will be registered in the <code className="font-mono font-bold text-pink-700 dark:text-pink-300">suppliers.other_products_offer</code> catalog upon supplier activation.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-300/70 dark:border-white/10 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Boxes className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                                Products to Supply ({otherProducts.length})
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {otherProducts.length === 1 ? "1 item ready to activate" : `${otherProducts.length} items ready to activate`}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleAddOtherProduct}
                                            className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_2px_2px_6px_rgba(219,39,119,0.4)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] active:scale-95 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Product to Supply</span>
                                        </button>
                                    </div>

                                    {otherProducts.length === 0 ? (
                                        <div className="p-8 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] border-2 border-dashed border-slate-300/80 dark:border-white/10 shadow-[inset_2px_2px_6px_rgba(163,177,198,0.3),_inset_-2px_-2px_6px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5)] text-center space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-white/5 mx-auto flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)]">
                                                <Package className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Products to Supply</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                                                    This supplier currently has no items listed in their quotation or catalog. You can add products manually or proceed to activate.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddOtherProduct}
                                                className="px-4 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Product to Supply</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {otherProducts.map((prod, idx) => {
                                                const price = Number(prod.unit_price || 0);
                                                const disc = Number(prod.discount || 0);
                                                const ship = Number(prod.shipping_fee || 0);
                                                const taxRate = (prod.tax_classification === "others" || prod.tax_classification === "Others")
                                                    ? (prod.tax_rate !== undefined ? Number(prod.tax_rate) : 12)
                                                    : (prod.tax_classification === "vatable" || prod.tax_classification === "VAT (12%)" ? 12 : 0);
                                                const taxable = Math.max(0, price - disc);
                                                const tax = (taxable * taxRate) / 100;
                                                const total = taxable + ship + tax;

                                                return (
                                                    <div
                                                        key={prod.id || `prod-${idx}`}
                                                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_6px_rgba(0,0,0,0.5)] space-y-3 transition-all hover:border-pink-500/30"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                                                <span className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono text-[11px] font-black flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(219,39,119,0.2)]">
                                                                    #{idx + 1}
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    value={prod.item_name}
                                                                    onChange={e => handleUpdateOtherProduct(idx, "item_name", e.target.value)}
                                                                    placeholder="Product / Item Name & Description"
                                                                    className="w-full px-3 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                />
                                                            </div>

                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {prod.is_awarded_item && (
                                                                    <span className="text-[9px] px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-1 shadow-xs whitespace-nowrap">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                        Awarded Bid Item
                                                                    </span>
                                                                )}

                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-bold text-slate-400">Unit:</span>
                                                                    <select
                                                                        value={prod.unit || "unit"}
                                                                        onChange={e => handleUpdateOtherProduct(idx, "unit", e.target.value)}
                                                                        className="px-2.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 capitalize cursor-pointer"
                                                                    >
                                                                        {PRODUCT_UNIT_OPTIONS.map(u => (
                                                                            <option key={u} value={u}>{u}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveOtherProduct(idx)}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold shadow-[-1px_-1px_3px_rgba(255,255,255,0.7),_1px_1px_3px_rgba(225,29,72,0.2)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                                                    title="Remove product from list"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    <span>Remove</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-1 text-[11px]">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                                    Unit Price (₱)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={prod.unit_price}
                                                                    onChange={e => handleUpdateOtherProduct(idx, "unit_price", e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                />
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                                        Tax Class
                                                                    </label>
                                                                    {(prod.tax_classification === "others" || prod.tax_classification === "Others") && (
                                                                        <span className="text-[9px] font-bold text-pink-600 dark:text-pink-400">
                                                                            {prod.tax_rate ?? 12}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-1.5">
                                                                    <select
                                                                        value={prod.tax_classification || "vatable"}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            handleUpdateOtherProduct(idx, "tax_classification", val);
                                                                            if (val === "others" && (prod.tax_rate === undefined || prod.tax_rate === 0)) {
                                                                                handleUpdateOtherProduct(idx, "tax_rate", 12);
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 cursor-pointer"
                                                                    >
                                                                        <option value="vatable">12% VAT</option>
                                                                        <option value="zero_rated">0% Zero-Rated</option>
                                                                        <option value="exempt">VAT-Exempt</option>
                                                                        <option value="others">Others / Custom VAT</option>
                                                                    </select>
                                                                    {(prod.tax_classification === "others" || prod.tax_classification === "Others") && (
                                                                        <div className="w-16 relative shrink-0">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max="100"
                                                                                step="0.1"
                                                                                value={prod.tax_rate !== undefined ? prod.tax_rate : 12}
                                                                                onChange={e => handleUpdateOtherProduct(idx, "tax_rate", e.target.value)}
                                                                                placeholder="%"
                                                                                className="w-full pl-2 pr-4 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white font-bold text-xs text-center focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                            />
                                                                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                                    Shipping Fee (₱)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={prod.shipping_fee || 0}
                                                                    onChange={e => handleUpdateOtherProduct(idx, "shipping_fee", e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                                    Discount (₱)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={prod.discount || 0}
                                                                    onChange={e => handleUpdateOtherProduct(idx, "discount", e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-emerald-600 dark:text-emerald-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                />
                                                            </div>

                                                            <div className="col-span-2 sm:col-span-4 md:col-span-1">
                                                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                                    Calculated Total
                                                                </label>
                                                                <div className="px-2.5 py-1.5 rounded-xl bg-pink-100/70 dark:bg-pink-950/40 border border-pink-300 dark:border-pink-800/60 shadow-[inset_1px_1px_3px_rgba(219,39,119,0.2)] font-mono font-black text-pink-700 dark:text-pink-300 text-xs">
                                                                    ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={prod.notes || ""}
                                                                onChange={e => handleUpdateOtherProduct(idx, "notes", e.target.value)}
                                                                placeholder="Optional specs, brand, warranty or notes for this item..."
                                                                className="w-full px-3 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-700 dark:text-slate-300 text-[11px] focus:outline-none focus:ring-2 focus:ring-pink-500/40 placeholder:italic"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("terms")}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer"
                                    >
                                        &larr; Back to Commercial Terms
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("docs")}
                                        className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_4px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>Next: Verification Documents &rarr;</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: Optional Document Upload & AI Extraction */}
                        {activeSection === "docs" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-[inset_1px_1px_3px_rgba(236,72,153,0.15)] text-pink-900 dark:text-pink-200 flex items-start gap-2.5">
                                    <Sparkles className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-xs">AI-Powered Verification & Document Intelligence</p>
                                        <p className="text-[11px] opacity-90">
                                            Upload business permits, rate sheets, price quotes, or contracts. Gemini AI extracts structured vendor data and automatically matches fields.
                                        </p>
                                    </div>
                                </div>

                                {/* Upload Dropzone */}
                                <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-300/70 dark:border-white/10 pb-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                                Upload Supporting Document
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500">Document Type:</span>
                                            <select
                                                value={selectedDocType}
                                                onChange={e => setSelectedDocType(e.target.value)}
                                                className="px-3 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_4px_rgba(163,177,198,0.4),_inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.6)] text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all cursor-pointer"
                                            >
                                                <option value="Business Permit">Business / Mayor's Permit</option>
                                                <option value="BIR 2303 / Tax ID">BIR 2303 / Tax Certificate</option>
                                                <option value="DTI / SEC Registration">DTI / SEC Registration</option>
                                                <option value="Quotation / Price Catalog">Quotation / Price Catalog</option>
                                                <option value="Supplier Agreement">Supplier Agreement / Contract</option>
                                                <option value="Company Profile">Company Profile / Brochure</option>
                                                <option value="Other">Other Supporting Document</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Drag and Drop Zone */}
                                    <div
                                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setIsDragOver(false);
                                            handleFilesSelected(e.dataTransfer.files);
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                                            isDragOver
                                                ? "border-pink-500 bg-pink-500/10 scale-[0.99] shadow-[inset_2px_2px_6px_rgba(219,39,119,0.3)]"
                                                : "border-slate-300 dark:border-white/20 hover:border-pink-500/60 bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_6px_rgba(163,177,198,0.3),_inset_-2px_-2px_6px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.5)]"
                                        }`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,application/pdf"
                                            multiple
                                            className="hidden"
                                            onChange={e => handleFilesSelected(e.target.files)}
                                        />
                                        <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#151724] text-pink-600 dark:text-pink-400 flex items-center justify-center mb-2.5 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.3)]">
                                            <UploadCloud className="w-6 h-6" />
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                            Click to select or drag & drop files here
                                        </p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            Supports PDF, PNG, JPG, WEBP (Up to 15MB per file)
                                        </p>
                                    </div>

                                    {/* Staged Documents List & AI Results */}
                                    {stagedDocs.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                <span>Staged Verification Documents ({stagedDocs.length})</span>
                                            </h5>

                                            {/* Uploaded by Supplier (read-only) */}
                                            {supplierUploadedDocs.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            Uploaded by Supplier ({supplierUploadedDocs.length})
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-300/80 dark:border-white/10 flex items-center gap-1 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]">
                                                            <Shield className="w-3 h-3" />
                                                            Read-only
                                                        </span>
                                                    </div>
                                                    {supplierUploadedDocs.map(doc => (
                                                        <div
                                                            key={doc.id}
                                                            className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_6px_rgba(0,0,0,0.5)] flex items-center justify-between flex-wrap gap-2"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
                                                                    <FileCheck2 className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-xs" title={doc.fileName}>
                                                                        {doc.fileName}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <span className="font-semibold text-pink-600 dark:text-pink-400">{doc.documentType}</span>
                                                                        <span>•</span>
                                                                        <span>Submitted by supplier</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDoc(doc)}
                                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#181a29] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                                                title="Preview Document"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span>Preview</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Uploaded by Admin (editable) */}
                                            {adminUploadedDocs.length > 0 && (
                                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-1">
                                                    Uploaded by Admin ({adminUploadedDocs.length})
                                                </span>
                                            )}

                                            <div className="space-y-3">
                                                {adminUploadedDocs.map(doc => (
                                                    <div
                                                        key={doc.id}
                                                        className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/10 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_6px_rgba(0,0,0,0.5)] space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-[inset_1px_1px_2px_rgba(219,39,119,0.2)]">
                                                                    <FileCheck2 className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-xs">
                                                                        {doc.fileName}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                                        <span className="font-semibold text-pink-600 dark:text-pink-400">{doc.documentType}</span>
                                                                        <span>•</span>
                                                                        <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/10 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] hover:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                                                    title="Preview Document"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                    <span>Preview</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerAIExtraction(doc.id, undefined, true)}
                                                                    disabled={doc.isExtracting}
                                                                    className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-black flex items-center gap-1.5 shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_2px_2px_6px_rgba(219,39,119,0.4)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                                                    title="Extract and add terms & conditions and vendor details"
                                                                >
                                                                    {doc.isExtracting ? (
                                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Sparkles className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>{doc.isExtracting ? "Extracting..." : "Extract and Add Terms & Conditions"}</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveDoc(doc.id)}
                                                                    className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 shadow-[-1px_-1px_3px_rgba(255,255,255,0.7),_1px_1px_3px_rgba(225,29,72,0.2)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all cursor-pointer active:scale-95"
                                                                    title="Remove document"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* AI Extraction Insight Box */}
                                                        {doc.extractedData && (
                                                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-[inset_1px_1px_4px_rgba(16,185,129,0.15)] text-emerald-950 dark:text-emerald-200 space-y-2.5">
                                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                                    <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                                                        <Sparkles className="w-3.5 h-3.5" />
                                                                        AI Extracted Information
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApplyExtractedData(doc.extractedData)}
                                                                        className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-[-1px_-1px_3px_rgba(255,255,255,0.6),_1px_1px_4px_rgba(5,150,105,0.4)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer"
                                                                    >
                                                                        <Check className="w-3 h-3" />
                                                                        <span>Extract and Add Terms & Conditions</span>
                                                                    </button>
                                                                </div>

                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                                                                    {doc.extractedData.supplier_name && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Name:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.supplier_name}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.tax_id && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">TIN / Tax ID:</span>
                                                                            <span className="font-mono font-bold text-slate-900 dark:text-white">{doc.extractedData.tax_id}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.contact_person && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Contact:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.contact_person}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.phone && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Phone:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.phone}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.payment_terms && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Payment Terms:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.payment_terms}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.delivery_terms && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Delivery Terms:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.delivery_terms}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.warranty && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Warranty:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.warranty}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.lead_time && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">Lead Time:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.lead_time}</span>
                                                                        </div>
                                                                    )}
                                                                    {doc.extractedData.moq && (
                                                                        <div className="p-2.5 rounded-xl bg-[#ebf0f7]/80 dark:bg-black/30 border border-white/70 dark:border-white/5 shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(163,177,198,0.2)]">
                                                                            <span className="text-[10px] text-slate-500 block">MOQ:</span>
                                                                            <span className="font-bold text-slate-900 dark:text-white">{doc.extractedData.moq}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Extracted Terms & Conditions */}
                                                                    {doc.extractedData.terms_and_conditions && (
                                                                        <div className="col-span-2 sm:col-span-3 p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-[inset_1px_1px_3px_rgba(236,72,153,0.15)] text-slate-900 dark:text-white space-y-1">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-[10px] text-pink-700 dark:text-pink-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                                    <Shield className="w-3 h-3" />
                                                                                    Extracted Terms & Conditions (Added to Tab 2):
                                                                                </span>
                                                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                                                    Synced to Tab 2
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] text-slate-800 dark:text-slate-100 whitespace-pre-line leading-relaxed font-mono">
                                                                                {doc.extractedData.terms_and_conditions}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {doc.extractedData.document_summary && (
                                                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1 border-t border-emerald-500/20">
                                                                        &ldquo;{doc.extractedData.document_summary}&rdquo;
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("other_products")}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer"
                                    >
                                        &larr; Back to Products to Supply ({otherProducts.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("review")}
                                        className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:shadow-[inset_1px_1px_4px_rgba(0,0,0,0.3)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>Next: Final Review & Summary &rarr;</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TAB 5: Comprehensive Review & Activation Summary */}
                        {activeSection === "review" && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <div className="p-4 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                                    <ClipboardCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-xs">Final Supplier Verification & Review</p>
                                        <p className="text-[11px] opacity-90">
                                            Please verify all supplier information compiled across General Info, Commercial Terms, and Attached Documents before activating.
                                        </p>
                                    </div>
                                </div>

                                {/* Section 0 Review: Discovered / Submitted Quotation & Proposal */}
                                {(submittedProposal || supplier.submittedQuote) && (() => {
                                    const proposal = submittedProposal || supplier.submittedQuote;
                                    const servicesList: string[] = Array.isArray(proposal.services_offered)
                                        ? proposal.services_offered
                                        : (typeof proposal.services_offered === "string" && proposal.services_offered
                                            ? proposal.services_offered.split(",").map((s: string) => s.trim())
                                            : []);

                                    return (
                                        <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-pink-500/30 dark:border-pink-500/20 space-y-4">
                                            <div className="flex items-center justify-between border-b border-pink-500/20 pb-2.5">
                                                 <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                     <Tag className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                     <span>Vendor Quotation &amp; Pricing Proposal</span>
                                                 </h4>
                                                 <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                     {proposal.status || "Submitted Proposal"}
                                                 </span>
                                             </div>

                                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                 <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                                     <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Item / Product</span>
                                                     <p className="font-bold text-slate-900 dark:text-white truncate">{proposal.item_name || proposal.products || "Custom Items"}</p>
                                                     {proposal.category && <p className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">{proposal.category}</p>}
                                                 </div>

                                                 <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                                     <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Quoted Quantity</span>
                                                     <p className="font-bold text-slate-900 dark:text-white truncate">
                                                         {proposal.quantity ? `${proposal.quantity.toLocaleString()} ${proposal.unit || "units"}` : "Standard"}
                                                     </p>
                                                     {proposal.availability && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold capitalize">{proposal.availability}</p>}
                                                 </div>

                                                 <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                                     <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Quoted Unit Price</span>
                                                     <p className="font-black text-pink-600 dark:text-pink-400 truncate">
                                                         {proposal.unit_price ? `₱${Number(proposal.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Custom"}
                                                     </p>
                                                     <p className="text-[10px] text-slate-400">per {proposal.unit || "unit"}</p>
                                                 </div>

                                                 <div className="p-3 rounded-xl bg-pink-100/60 dark:bg-pink-950/40 border border-pink-500/30 space-y-0.5">
                                                     <span className="text-[10px] text-pink-700 dark:text-pink-300 uppercase font-black tracking-wider">Total Quoted Value</span>
                                                     <p className="font-black text-slate-900 dark:text-white text-sm truncate">
                                                         {proposal.total_amount ? `₱${Number(proposal.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (proposal.unit_price && proposal.quantity ? `₱${(Number(proposal.unit_price) * Number(proposal.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—")}
                                                     </p>
                                                     <p className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">Total Contract Value</p>
                                                 </div>
                                             </div>

                                             {/* Subtotal, Discount, Shipping, Tax Breakdown */}
                                             {(Number(proposal.discount || 0) > 0 || Number(proposal.shipping_fee || 0) > 0 || Number(proposal.tax_amount || 0) > 0 || proposal.tax_type) && (
                                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                                                     <div className="p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 space-y-0.5">
                                                         <span className="text-[9px] text-slate-400 font-bold uppercase block">Subtotal</span>
                                                         <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                             ₱{Number(proposal.subtotal || (proposal.unit_price && proposal.quantity ? Number(proposal.unit_price) * Number(proposal.quantity) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                         </span>
                                                     </div>
                                                     <div className="p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 space-y-0.5">
                                                         <span className="text-[9px] text-slate-400 font-bold uppercase block">Discount</span>
                                                         <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                             {Number(proposal.discount || 0) > 0 ? `-₱${Number(proposal.discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00"}
                                                         </span>
                                                     </div>
                                                     <div className="p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 space-y-0.5">
                                                         <span className="text-[9px] text-slate-400 font-bold uppercase block">Shipping Fee</span>
                                                         <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                             {Number(proposal.shipping_fee || 0) > 0 ? `₱${Number(proposal.shipping_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Free"}
                                                         </span>
                                                     </div>
                                                     <div className="p-2 rounded-lg bg-white/70 dark:bg-black/30 border border-slate-200/80 dark:border-white/5 space-y-0.5">
                                                         <span className="text-[9px] text-slate-400 font-bold uppercase block">Tax ({proposal.tax_type || `${proposal.tax_rate || 0}%`})</span>
                                                         <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                             +₱{Number(proposal.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                         </span>
                                                     </div>
                                                 </div>
                                             )}

                                            {servicesList.length > 0 && (
                                                <div className="space-y-1 pt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                        Included Services &amp; Value-Adds:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {servicesList.map((svc: string, idx: number) => (
                                                            <span
                                                                key={`rev-svc-${idx}`}
                                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 dark:bg-pink-950/50 text-pink-800 dark:text-pink-200 border border-pink-200 dark:border-pink-800"
                                                            >
                                                                ✓ {svc}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Section 1 Review: General & Contact Info */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>1. General & Contact Profile</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("general")}
                                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#141624] text-slate-600 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Edit Info</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Business Name</span>
                                            <p className="font-black text-slate-900 dark:text-white truncate">{formData.name || "—"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Category</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.category || "General Supplies"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contact Person</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.contact_person || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Phone</span>
                                            <p className="font-mono font-bold text-slate-900 dark:text-white truncate">{formData.phone || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.email || "Not Provided"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Website</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.website || "Not Provided"}</p>
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3 p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Location / Physical Address</span>
                                            <p className="font-semibold text-slate-900 dark:text-white leading-snug">{formData.location || "Not Provided"}</p>
                                        </div>

                                        {formData.products && (
                                            <div className="sm:col-span-2 md:col-span-3 p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Products Offered</span>
                                                <p className="font-medium text-slate-900 dark:text-white leading-relaxed">{formData.products}</p>
                                            </div>
                                        )}

                                        {formData.notes && (
                                            <div className="sm:col-span-2 md:col-span-3 p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Internal Notes</span>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{formData.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section 2 Review: Commercial & Terms */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>2. Commercial & Governance Parameters</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("terms")}
                                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#141624] text-slate-600 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Edit Terms</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payment Method</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.payment_method || "N/A"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payment Terms</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.payment_terms || "N/A"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Delivery Terms</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.delivery_terms || "N/A"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Return Policy</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.return_policy || "N/A"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Warranty</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.warranty || "N/A"}</p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-0.5">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Lead Time / MOQ</span>
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{formData.lead_time || "—"} / {formData.moq || "—"}</p>
                                        </div>

                                        <div className="sm:col-span-2 md:col-span-3 p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Governing Terms and Conditions and Vendor Submitted Terms &amp; Special Clauses</span>
                                                <span className="text-[9px] font-bold text-pink-600 dark:text-pink-400">
                                                    (Includes AI Extracted Terms)
                                                </span>
                                            </div>
                                            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line max-h-36 overflow-y-auto leading-relaxed">
                                                {formData.terms_and_conditions || "Default terms apply."}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3 Review: Products to Supply */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <Boxes className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>3. Products to Supply Catalog ({otherProducts.length})</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("other_products")}
                                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#141624] text-slate-600 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Edit Products to Supply</span>
                                        </button>
                                    </div>

                                    {otherProducts.length === 0 ? (
                                        <div className="p-4 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-center text-slate-400 dark:text-slate-500">
                                            <p className="text-xs italic">No catalog items or awarded products are listed. You can add items in Tab 3.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-2xl border border-slate-300/70 dark:border-white/10">
                                            <table className="w-full text-left border-collapse text-[11px]">
                                                <thead>
                                                    <tr className="bg-[#e2e8f2] dark:bg-[#111320] text-slate-500 dark:text-slate-400 border-b border-slate-300/80 dark:border-white/10">
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Product / Item</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Unit</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Unit Price</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Tax</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Shipping</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Discount</th>
                                                        <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Total Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 bg-white dark:bg-[#10121b]">
                                                    {otherProducts.map((item, idx) => {
                                                        const price = Number(item.unit_price || 0);
                                                        const disc = Number(item.discount || 0);
                                                        const ship = Number(item.shipping_fee || 0);
                                                        const taxRate = item.tax_rate != null ? Number(item.tax_rate) : (item.tax_classification === "vatable" || item.tax_classification === "VAT (12%)" ? 12 : 0);
                                                        const tax = (Math.max(0, price - disc) * taxRate) / 100;
                                                        const tot = Math.max(0, price - disc) + ship + tax;

                                                        return (
                                                            <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span>{item.item_name || `Product Item #${idx + 1}`}</span>
                                                                        {item.is_awarded_item && (
                                                                            <span className="px-1.5 py-0.5 rounded-full font-bold text-[8px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-0.5 whitespace-nowrap shadow-xs">
                                                                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                                                Awarded Item
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {item.notes && <div className="text-[10px] text-slate-400 font-normal italic">{item.notes}</div>}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap capitalize">
                                                                    {item.unit || "unit"}
                                                                </td>
                                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                                                    ₱{price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
                                    )}
                                </div>

                                {/* Section 4 Review: Supporting Documents */}
                                <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                            <span>4. Attached Verification Documents ({stagedDocs.length})</span>
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("docs")}
                                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#141624] text-slate-600 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Upload / Edit Docs</span>
                                        </button>
                                    </div>

                                    {stagedDocs.length === 0 ? (
                                        <div className="p-4 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-center text-slate-400 dark:text-slate-500">
                                            <p className="text-xs italic">No supporting documents attached (Optional). You can still proceed to activate.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {stagedDocs.map(doc => (
                                                <div
                                                    key={doc.id}
                                                    className="p-3 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{doc.fileName}</p>
                                                            <p className="text-[10px] text-slate-400">{doc.documentType} • {(doc.fileSize / 1024).toFixed(0)} KB</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {doc.extractedData ? (
                                                            <span className="px-2 py-0.5 rounded-none bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                                                                AI Extracted
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-none bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold shrink-0">
                                                                Uploaded
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewDoc(doc)}
                                                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/70 dark:border-white/10 text-xs font-bold transition-all cursor-pointer"
                                                            title="Preview Document"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section 5 Review: AI-Extracted Document Intelligence & Details */}
                                {stagedDocs.some(d => !!d.extractedData) && (
                                    <div className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-300/70 dark:border-white/10 pb-2.5">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <span>5. AI-Extracted Document Intelligence ({stagedDocs.filter(d => !!d.extractedData).length})</span>
                                            </h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                Extracted with Gemini AI
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            {stagedDocs.filter(d => !!d.extractedData).map(doc => {
                                                const ext = doc.extractedData;
                                                return (
                                                    <div
                                                        key={`extracted-review-${doc.id}`}
                                                        className="p-4 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-300/60 dark:border-white/10 pb-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                                <span className="font-bold text-xs text-slate-900 dark:text-white">{doc.fileName}</span>
                                                                <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">({doc.documentType})</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDoc(doc)}
                                                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 text-[10px] font-bold flex items-center gap-1 border border-slate-300/70 dark:border-white/10 transition-all cursor-pointer"
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                                <span>Preview File</span>
                                                            </button>
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
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Contact Person:</span>
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
                                                            {ext.payment_method && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Payment Method:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.payment_method}</span>
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
                                                            {ext.lead_time && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">Lead Time:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.lead_time}</span>
                                                                </div>
                                                            )}
                                                            {ext.moq && (
                                                                <div className="p-2 rounded-none bg-white/70 dark:bg-black/40">
                                                                    <span className="text-[10px] text-slate-400 block font-bold">MOQ:</span>
                                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">{ext.moq}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Extracted Terms & Conditions from Document */}
                                                        {ext.terms_and_conditions && (
                                                            <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-slate-900 dark:text-white space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] text-pink-700 dark:text-pink-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                        <Shield className="w-3 h-3" />
                                                                        Extracted Terms & Conditions from Document:
                                                                    </span>
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-none bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                                        Added to Tab 2
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-800 dark:text-slate-100 whitespace-pre-line leading-relaxed font-mono">
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

                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection("docs")}
                                        className="px-4 py-2 rounded-none text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        &larr; Back to Verification Documents
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-5 sm:px-6 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>
                                {activeSection === "review" ? (
                                    <>Ready to activate as <strong className="text-slate-800 dark:text-slate-200">{formData.name || supplier.name}</strong></>
                                ) : (
                                    <>Step {activeSection === "general" ? "1/5" : activeSection === "terms" ? "2/5" : activeSection === "other_products" ? "3/5" : activeSection === "docs" ? "4/5" : "5/5"} • <span className="text-slate-400">Navigate to Tab 5 to Approve & Activate</span></>
                                )}
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <AppButton
                                type="button"
                                variant="neutral"
                                size="md"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                <span>Cancel</span>
                            </AppButton>

                            {/* Enable Approve & Activate Supplier ONLY in Tab 5 */}
                            {activeSection === "review" ? (
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    onClick={() => {
                                        if (!formData.name.trim()) {
                                            toast.error("Supplier Business Name is required.");
                                            return;
                                        }
                                        setShowConfirmActivate(true);
                                    }}
                                    disabled={isSubmitting || !formData.name.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 font-black cursor-pointer"
                                >
                                    {isSubmitting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    <span>{isSubmitting ? "Activating..." : "Approve & Activate Supplier"}</span>
                                </AppButton>
                            ) : (
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    onClick={() => {
                                        if (activeSection === "general") setActiveSection("terms");
                                        else if (activeSection === "terms") setActiveSection("other_products");
                                        else if (activeSection === "other_products") setActiveSection("docs");
                                        else if (activeSection === "docs") setActiveSection("review");
                                    }}
                                    className="bg-pink-600 hover:bg-pink-500 text-white border-0 font-bold cursor-pointer"
                                >
                                    <span>
                                        {activeSection === "general" && "Next: Commercial Terms \u2192"}
                                        {activeSection === "terms" && `Next: Products to Supply (${otherProducts.length}) \u2192`}
                                        {activeSection === "other_products" && "Next: Verification Docs \u2192"}
                                        {activeSection === "docs" && "Next: Final Review \u2192"}
                                    </span>
                                </AppButton>
                            )}
                        </div>
                    </div>
                </div>

                {/* Confirmation Dialog Modal */}
                {showConfirmActivate && (
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[140] flex items-center justify-center p-4 animate-in fade-in duration-150"
                        onClick={() => setShowConfirmActivate(false)}
                    >
                        <div
                            className="w-full max-w-lg bg-[#ebf0f7] dark:bg-[#141624] rounded-2xl border border-slate-300/80 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-5"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    <ShieldCheck className="w-7 h-7" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                                        Confirm Supplier Activation
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Are you sure you want to approve and activate <strong className="text-slate-900 dark:text-white">&ldquo;{formData.name}&rdquo;</strong> as an official active supplier?
                                    </p>
                                </div>
                            </div>

                            {/* Summary Box */}
                            <div className="p-4 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Category:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formData.category || "General Supplies"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Payment Terms:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formData.payment_terms || "N/A"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Delivery Terms:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formData.delivery_terms || "N/A"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Other Products Offer:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{otherProducts.length} product(s) accepted</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Attached Documents:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{stagedDocs.length} file(s)</span>
                                </div>
                                {formData.email && (
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-300/60 dark:border-white/10">
                                        <span className="text-slate-500 dark:text-slate-400">Account Provisioning:</span>
                                        <span className="font-bold text-pink-600 dark:text-pink-400">Auto-create user &amp; email credentials to {formData.email}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {formData.email 
                                    ? "This will store the vendor profile, upload documents, register their user account in the Users table & Authentication, and dispatch their auto-generated login password via Gmail."
                                    : "This will store the vendor profile in your active suppliers directory and attach all uploaded verification documents."
                                }
                            </p>

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmActivate(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300/80 dark:border-white/10 text-xs font-bold transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmActivate(false);
                                        handleActivateSupplier();
                                    }}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Yes, Approve & Activate</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Preview Modal */}
                {previewDoc && (
                    <div
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
                        onClick={() => setPreviewDoc(null)}
                    >
                        <div
                            className="relative w-full max-w-4xl bg-[#ebf0f7] dark:bg-[#141624] rounded-2xl border border-slate-300/80 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Preview Header */}
                            <div className="p-4 sm:px-6 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#e8ecf4] dark:bg-[#10121b] shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-xs shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                            {previewDoc.fileName}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <span className="font-semibold text-pink-600 dark:text-pink-400">{previewDoc.documentType}</span>
                                            <span>•</span>
                                            <span>{(previewDoc.fileSize / 1024).toFixed(1)} KB</span>
                                            <span>•</span>
                                            <span className="uppercase text-[10px] font-mono">{previewDoc.fileType.split("/")[1] || "FILE"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <a
                                        href={previewDoc.publicUrl || previewDoc.fileBase64}
                                        download={previewDoc.fileName}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/80 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all"
                                        title="Download / Open File"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Download</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(null)}
                                        className="p-1.5 rounded-xl bg-white dark:bg-[#141624] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-300/80 dark:border-white/10 transition-all cursor-pointer"
                                        title="Close Preview"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Content */}
                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#f0f4fa] dark:bg-[#121420] flex items-center justify-center min-h-[350px]">
                                {previewDoc.fileType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(previewDoc.fileName) ? (
                                    <div className="flex flex-col items-center justify-center w-full">
                                        <img
                                            src={previewDoc.publicUrl || previewDoc.fileBase64}
                                            alt={previewDoc.fileName}
                                            className="max-h-[68vh] max-w-full object-contain rounded-xl border border-slate-300/70 dark:border-white/10"
                                        />
                                    </div>
                                ) : previewDoc.fileType === "application/pdf" || previewDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                                    <iframe
                                        src={previewDoc.publicUrl || previewDoc.fileBase64}
                                        title={previewDoc.fileName}
                                        className="w-full h-[68vh] border border-slate-300/70 dark:border-white/10 rounded-xl bg-white"
                                    />
                                ) : (
                                    <div className="text-center p-8 space-y-4 max-w-md mx-auto">
                                        <div className="w-16 h-16 rounded-xl bg-pink-500/10 text-pink-600 mx-auto flex items-center justify-center">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{previewDoc.fileName}</p>
                                            <p className="text-xs text-slate-400 mt-1">Direct in-browser preview is available for images and PDF documents.</p>
                                        </div>
                                        <a
                                            href={previewDoc.publicUrl || previewDoc.fileBase64}
                                            download={previewDoc.fileName}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition-all"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>Download & Open File</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Preview Footer */}
                            {previewDoc.extractedData && (
                                <div className="p-3.5 px-6 border-t border-slate-300/80 dark:border-white/10 bg-[#e8ecf4] dark:bg-[#10121b] text-xs flex items-center justify-between flex-wrap gap-2 shrink-0">
                                    <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        AI Data: {previewDoc.extractedData.supplier_name || previewDoc.extractedData.category || "Structured Fields Verified"}
                                    </span>
                                    {previewDoc.extractedData.tax_id && (
                                        <span className="text-[11px] font-mono text-slate-400">
                                            TIN: {previewDoc.extractedData.tax_id}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Full Terms & Conditions Editor Modal */}
                {showFullTermsModal && (
                    <div
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[170] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
                        onClick={() => setShowFullTermsModal(false)}
                    >
                        <div
                            className="relative w-full max-w-4xl bg-[#ebf0f7] dark:bg-[#141624] rounded-2xl border border-slate-300/80 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col h-[88vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-4 sm:px-6 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#e8ecf4] dark:bg-[#10121b] shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-xs shrink-0">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                            <span>Governing Terms and Conditions and Vendor Submitted Terms &amp; Special Clauses</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                                                Full Editor &amp; Viewer
                                            </span>
                                        </h4>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {formData.name || supplier.name} • Governing purchase agreements &amp; clauses
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFullTermsDraft(formatTermsAsList(fullTermsDraft))}
                                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#181a29] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/80 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Format into clean numbered list"
                                    >
                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                        <span>Format as List</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFullTermsDraft(defaultTerms);
                                            toast.info("Reset to quotation terms template.");
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#181a29] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 border border-slate-300/80 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Reset to quotation terms"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Reset</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowFullTermsModal(false)}
                                        className="p-1.5 rounded-xl bg-white dark:bg-[#181a29] text-slate-500 hover:text-rose-600 border border-slate-300/80 dark:border-white/10 transition-all cursor-pointer"
                                        title="Close Editor"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Editor Body */}
                            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#f0f4fa] dark:bg-[#121420] flex flex-col space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 flex-wrap gap-1">
                                    <span>Edit and customize contract terms, warranty clauses, payment obligations, and cancellation policies below:</span>
                                    <span className="font-mono text-[10px] text-slate-400">
                                        {fullTermsDraft.split("\n").filter(Boolean).length} lines • {fullTermsDraft.length} chars
                                    </span>
                                </div>

                                <textarea
                                    value={fullTermsDraft}
                                    onChange={(e) => setFullTermsDraft(e.target.value)}
                                    placeholder="Enter or paste full terms and conditions..."
                                    className="w-full flex-1 min-h-[380px] p-4 rounded-xl bg-white dark:bg-[#10121b] border border-slate-300/80 dark:border-white/10 text-slate-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-pink-500/40 transition-all resize-none"
                                />
                            </div>

                            {/* Footer */}
                            <div className="p-4 sm:px-6 border-t border-slate-300/80 dark:border-white/10 flex items-center justify-between flex-wrap gap-3 bg-[#e8ecf4] dark:bg-[#10121b] shrink-0">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Edits will be saved to Tab 2 and used in the supplier profile registration.
                                </span>

                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowFullTermsModal(false)}
                                        className="px-4 py-2 rounded-xl bg-white dark:bg-[#181a29] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300/80 dark:border-white/10 text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSaveFullTerms}
                                        className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Save &amp; Apply Terms</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Portal>
    );
}
