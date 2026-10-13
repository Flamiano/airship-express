// app/(supplyChain)/(pages)/supplier-portal/quote/page.tsx
"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
    Building2, 
    Send, 
    CheckCircle2, 
    Truck, 
    Clock, 
    ShieldCheck, 
    MapPin, 
    Tag, 
    Sparkles, 
    FileText, 
    Boxes, 
    Plus, 
    Check, 
    Trophy, 
    Bot, 
    Edit3, 
    RefreshCw, 
    Users, 
    Scale, 
    CreditCard, 
    CalendarCheck2, 
    FileCheck2, 
    UploadCloud, 
    FileUp, 
    File, 
    Trash2, 
    ChevronLeft, 
    ChevronRight, 
    Loader2, 
    Paperclip,
    FileSpreadsheet,
    HelpCircle,
    Eye,
    X,
    Maximize2
} from "lucide-react";
import { toast } from "sonner";

export interface OtherProductOfferItem {
    id: string;
    item_name: string;
    unit: string;
    unit_price: number | string;
    subtotal?: number;
    tax_classification: string;
    tax_rate?: number;
    tax_amount?: number;
    shipping_fee: number | string;
    discount: number | string;
    total_amount: number;
    notes?: string;
}

export const PRODUCT_UNIT_OPTIONS = [
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "units", label: "Units" },
    { value: "box", label: "Box" },
    { value: "boxes", label: "Boxes" },
    { value: "pack", label: "Pack" },
    { value: "packs", label: "Packs" },
    { value: "set", label: "Set" },
    { value: "sets", label: "Sets" },
    { value: "pair", label: "Pair" },
    { value: "pairs", label: "Pairs" },
    { value: "kg", label: "Kilogram (kg)" },
    { value: "g", label: "Grams (g)" },
    { value: "liters", label: "Liters (L)" },
    { value: "meters", label: "Meters (m)" },
    { value: "rolls", label: "Rolls" },
    { value: "lot", label: "Lot" },
    { value: "bundle", label: "Bundle" },
    { value: "carton", label: "Carton" },
    { value: "ream", label: "Ream" },
];

interface SupplierQuotationRecord {
    id: number;
    supplier_id?: number;
    supplier_name: string;
    contact_person?: string;
    contact_phone?: string;
    contact_email?: string;
    request_number: string;
    item_name: string;
    products?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal?: number;
    shipping_fee?: number;
    discount?: number;
    tax_type?: string;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    availability: string;
    lead_time_days: string;
    services_offered?: string[];
    other_products_offer?: OtherProductOfferItem[];
    notes?: string;
    status: string;
    created_at?: string;
    updated_at?: string;
}

interface UploadedDocItem {
    id?: string;
    file_name: string;
    file_type: string;
    file_base64: string;
    document_type: string;
    file_size_formatted?: string;
    extracted_text?: string;
    extracted_data?: any;
}

// Custom Lucide-compatible Philippine Peso (₱) Icon
function PesoSign({ className = "w-4 h-4" }: { className?: string }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M7 21V4h7a5 5 0 0 1 0 10H7" />
            <path d="M4 8h12" />
            <path d="M4 11h12" />
        </svg>
    );
}

const FORM_STEPS = [
    { id: 1, label: "Profile & Catalog", short: "Supplier", icon: Building2 },
    { id: 2, label: "Pricing & Stock", short: "Pricing", icon: PesoSign },
    { id: 3, label: "Other Products Offer", short: "Other Offers", icon: Boxes },
    { id: 4, label: "Value Inclusions", short: "Inclusions", icon: ShieldCheck },
    { id: 5, label: "Terms & Conditions", short: "Terms (AI)", icon: Scale },
    { id: 6, label: "Supporting Evidence", short: "Evidence", icon: UploadCloud },
    { id: 7, label: "Review & Submit", short: "Review", icon: FileCheck2 },
];

function QuoteContent() {
    const searchParams = useSearchParams();
    const reqParam = searchParams.get("req") || "";
    const supplierParam = searchParams.get("supplier") || "";
    const itemParam = searchParams.get("item") || "";
    const qtyParam = searchParams.get("qty") || "1";
    const unitParam = searchParams.get("unit") || "units";
    const catParam = searchParams.get("cat") || searchParams.get("category") || "";
    const locParam = searchParams.get("loc") || searchParams.get("location") || "";

    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);

    // Form fields - Step 1: Profile & Catalog
    const [supplierName, setSupplierName] = useState<string>(supplierParam);
    const [category, setCategory] = useState<string>("");
    const [customCategory, setCustomCategory] = useState<string>(catParam || "");
    const [isOtherCategory, setIsOtherCategory] = useState<boolean>(true);
    const [location, setLocation] = useState<string>(locParam || "");
    const [productsOffered, setProductsOffered] = useState<string>("");
    const [contactPerson, setContactPerson] = useState<string>("");
    const [contactPhone, setContactPhone] = useState<string>("");
    const [contactEmail, setContactEmail] = useState<string>("");

    // Form fields - Step 2: Pricing, Shipping, Discounts, Taxes & Stock
    const [availability, setAvailability] = useState<string>("In Stock (Immediate Dispatch)");
    const [unitPrice, setUnitPrice] = useState<string>("");
    const [shippingFee, setShippingFee] = useState<string>("0");
    const [discount, setDiscount] = useState<string>("0");
    const [taxType, setTaxType] = useState<string>("VAT (12%)");
    const [customTaxRate, setCustomTaxRate] = useState<string>("12");
    const [leadTimeDays, setLeadTimeDays] = useState<string>("2-3");

    // Form fields - Step 3: Other Products Offer (Optional)
    const [otherProductsOffer, setOtherProductsOffer] = useState<OtherProductOfferItem[]>([]);

    const handleAddOtherProduct = () => {
        const newItem: OtherProductOfferItem = {
            id: `offer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            item_name: "",
            unit: "pcs",
            unit_price: "",
            tax_classification: "VAT (12%)",
            tax_rate: 12,
            tax_amount: 0,
            shipping_fee: "0",
            discount: "0",
            total_amount: 0,
            notes: "",
        };
        setOtherProductsOffer((prev) => [...prev, newItem]);
    };

    const handleRemoveOtherProduct = (index: number) => {
        setOtherProductsOffer((prev) => prev.filter((_, idx) => idx !== index));
        toast.info("Removed product offer from list.");
    };

    const handleUpdateOtherProduct = (index: number, field: keyof OtherProductOfferItem, value: any) => {
        setOtherProductsOffer((prev) => {
            const updated = [...prev];
            const item = { ...updated[index], [field]: value };

            const price = Math.max(0, Number(item.unit_price || 0));
            const sub = price;
            const disc = Math.max(0, Number(item.discount || 0));
            const ship = Math.max(0, Number(item.shipping_fee || 0));

            let rate = 12;
            if (item.tax_classification === "Non-VAT / Exempt (0%)" || item.tax_classification === "Zero-Rated (0%)") {
                rate = 0;
            } else if (item.tax_classification === "VAT (12%)") {
                rate = 12;
            } else if (item.tax_classification === "Others" || item.tax_classification === "Custom Rate") {
                if (field === "tax_rate") {
                    rate = Math.max(0, Number(value) || 0);
                } else {
                    rate = item.tax_rate !== undefined ? Math.max(0, Number(item.tax_rate) || 0) : 12;
                }
            } else if (item.tax_rate !== undefined) {
                rate = Math.max(0, Number(item.tax_rate) || 0);
            }

            const taxable = Math.max(0, sub - disc);
            const taxAmt = (taxable * rate) / 100;
            const total = taxable + ship + taxAmt;

            item.subtotal = sub;
            item.tax_rate = rate;
            item.tax_amount = taxAmt;
            item.total_amount = total;

            updated[index] = item;
            return updated;
        });
    };

    // Form fields - Step 4: Value Inclusions
    const [servicesOffered, setServicesOffered] = useState<string[]>([
        "Free Delivery within Metro Manila", 
        "Official BIR Receipt / Invoice",
        "1-Year Replacement Warranty"
    ]);
    const [customService, setCustomService] = useState<string>("");
    
    // Form fields - Step 4: Terms and Conditions
    const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 Days (Standard B2B)");
    const [warrantyTerms, setWarrantyTerms] = useState<string>("1-Year Replacement Warranty");
    const [priceValidity, setPriceValidity] = useState<string>("30 Days Validity");
    const [deliveryTerms, setDeliveryTerms] = useState<string>("Door-to-Door Delivery (Airship Manila DDP)");
    const [supplierTerms, setSupplierTerms] = useState<string>(
        "1. All goods supplied are guaranteed brand new, authentic, and subject to 7-day inspection upon arrival.\n2. Invoice and Official Receipt issued upon delivery.\n3. Defective units will be replaced free of charge within 48 hours."
    );

    // AI Document Terms Extractor State
    const [termsFile, setTermsFile] = useState<{ name: string; base64: string; type: string; size: string } | null>(null);
    const [isExtractingTerms, setIsExtractingTerms] = useState<boolean>(false);

    // Form fields - Step 5: Supporting Evidence Documents & Remarks
    const [supportingDocs, setSupportingDocs] = useState<UploadedDocItem[]>([]);
    const [notes, setNotes] = useState<string>("");
    const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);

    // Image lightbox preview modal state
    const [previewImage, setPreviewImage] = useState<{ src: string; title: string; type?: string; size?: string } | null>(null);

    const isImageFile = (doc: { file_type?: string; file_name?: string; file_base64?: string }) => {
        if (doc.file_type && doc.file_type.startsWith("image/")) return true;
        if (doc.file_name && /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(doc.file_name)) return true;
        if (doc.file_base64 && doc.file_base64.startsWith("data:image/")) return true;
        return false;
    };

    // Quotations & Ranking State
    const [quotations, setQuotations] = useState<SupplierQuotationRecord[]>([]);
    const [userSubmittedQuote, setUserSubmittedQuote] = useState<SupplierQuotationRecord | null>(null);
    const [isLoadingQuotations, setIsLoadingQuotations] = useState<boolean>(true);

    // Supplier duplicate check indicator & active database categories
    const [existingSupplierNotice, setExistingSupplierNotice] = useState<string | null>(null);
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);

    // Financial calculations
    const subtotal = useMemo(() => {
        const u = Number(unitPrice) || 0;
        const q = Number(qtyParam) || 1;
        return u * q;
    }, [unitPrice, qtyParam]);

    const discountNum = useMemo(() => Math.max(0, Number(discount) || 0), [discount]);
    const shippingNum = useMemo(() => Math.max(0, Number(shippingFee) || 0), [shippingFee]);

    const effectiveTaxRate = useMemo(() => {
        if (taxType === "Non-VAT / Exempt (0%)" || taxType === "Zero-Rated (0%)") return 0;
        if (taxType === "VAT (12%)") return 12;
        return Math.max(0, Number(customTaxRate) || 0);
    }, [taxType, customTaxRate]);

    const taxableBase = useMemo(() => Math.max(0, subtotal - discountNum), [subtotal, discountNum]);
    const taxAmount = useMemo(() => (taxableBase * (effectiveTaxRate / 100)), [taxableBase, effectiveTaxRate]);
    const calculatedTotal = useMemo(() => taxableBase + shippingNum + taxAmount, [taxableBase, shippingNum, taxAmount]);

    // Parsed list of supplier terms/clauses
    const supplierTermsList = useMemo(() => {
        if (!supplierTerms.trim()) return [];
        return supplierTerms
            .split(/\r?\n+/)
            .map((l) => l.trim())
            .filter((l) => {
                const clean = l.replace(/^[\d+.)\-*•\s]+/, "").trim();
                return clean.length > 0;
            });
    }, [supplierTerms]);

    // Check if the current last line has empty content
    const isLastClauseEmpty = useMemo(() => {
        const trimmed = supplierTerms.trim();
        if (!trimmed) return false;
        const lines = supplierTerms.split(/\r?\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) return false;
        const lastLine = lines[lines.length - 1];
        const cleanContent = lastLine.replace(/^[\d+.)\-*•\s]+/, "").trim();
        return cleanContent.length === 0;
    }, [supplierTerms]);

    const handleAddClause = () => {
        const trimmed = supplierTerms.trim();
        if (!trimmed) {
            setSupplierTerms("1. ");
            return;
        }

        const lines = trimmed.split(/\r?\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const cleanContent = lastLine.replace(/^[\d+.)\-*•\s]+/, "").trim();
            if (!cleanContent) {
                toast.error("Please fill in the previous clause before adding a new line.");
                return;
            }
        }

        let nextNum = lines.length + 1;
        lines.forEach((l) => {
            const m = l.match(/^\s*(\d+)[\.\)]/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n >= nextNum) nextNum = n + 1;
            }
        });

        const addition = `${nextNum}. `;
        setSupplierTerms((prev) => `${prev.trim()}\n${addition}`);
    };

    // AI Document Terms Selection Handler
    const handleTermsFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            toast.error("File exceeds 20MB limit. Please select a smaller document.");
            return;
        }

        const formattedSize = `${(file.size / 1024).toFixed(1)} KB`;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setTermsFile({
                name: file.name,
                base64,
                type: file.type || "application/pdf",
                size: formattedSize,
            });
            toast.info(`Document "${file.name}" loaded. Click "Extract Terms with AI" to parse terms.`);
        };
        reader.readAsDataURL(file);
    };

    // Helper function to format extracted clauses as a clean numbered list and append to bottom
    const formatClausesAsList = (rawText: string, currentExisting: string): string => {
        if (!rawText || !rawText.trim()) return currentExisting;

        // Break raw text into distinct clause lines
        const rawLines = rawText
            .split(/\r?\n+/)
            .map((l) => l.trim())
            .filter(Boolean);

        const newItems: string[] = [];

        rawLines.forEach((line) => {
            // If line contains multiple numbered sub-clauses like "1. Item 2. Item", split them
            const splitNumbered = line.split(/(?=\b\d+[\.\)]\s+)/g);
            splitNumbered.forEach((part) => {
                const clean = part.replace(/^[\d+.)\-*•\s]+/, "").trim();
                if (clean.length > 0) {
                    newItems.push(clean);
                }
            });
        });

        if (newItems.length === 0 && rawText.trim()) {
            const clean = rawText.trim().replace(/^[\d+.)\-*•\s]+/, "").trim();
            if (clean) newItems.push(clean);
        }

        if (newItems.length === 0) return currentExisting;

        const existingTrimmed = currentExisting.trim();

        // Determine the next continuous starting number from existing content
        let startNumber = 1;
        if (existingTrimmed) {
            const existingLines = existingTrimmed.split(/\r?\n+/).filter((l) => l.trim().length > 0);
            let maxNum = 0;
            existingLines.forEach((l) => {
                const m = l.match(/^\s*(\d+)[\.\)]/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    if (n > maxNum) maxNum = n;
                }
            });
            startNumber = maxNum > 0 ? maxNum + 1 : existingLines.length + 1;
        }

        const formattedList = newItems.map((item, idx) => `${startNumber + idx}. ${item}`).join("\n");

        if (existingTrimmed) {
            return `${existingTrimmed}\n${formattedList}`;
        }
        return formattedList;
    };

    // Extract Terms with Gemini AI
    const handleExtractTermsWithAI = async () => {
        if (!termsFile) {
            toast.error("Please choose or upload a document first.");
            return;
        }

        setIsExtractingTerms(true);
        const loadToast = toast.loading(`AI analyzing and extracting clauses from "${termsFile.name}"...`);
        try {
            const res = await fetch("/api/suppliers/extract-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileBase64: termsFile.base64,
                    fileName: termsFile.name,
                    fileType: termsFile.type,
                    documentType: "Supplier Terms & Conditions Agreement",
                }),
            });

            const data = await res.json();
            toast.dismiss(loadToast);

            if (!res.ok || !data.success || !data.extractedData) {
                toast.error(data.error || "Failed to extract terms from document.");
                return;
            }

            const ext = data.extractedData;
            let rawExtracted = "";

            if (ext.terms_and_conditions && typeof ext.terms_and_conditions === "string" && ext.terms_and_conditions.trim()) {
                rawExtracted = ext.terms_and_conditions.trim();
            } else if (Array.isArray(ext.terms_and_conditions) && ext.terms_and_conditions.length > 0) {
                rawExtracted = ext.terms_and_conditions.join("\n");
            } else if (ext.document_summary) {
                rawExtracted = ext.document_summary;
            } else if (ext.extracted_text) {
                rawExtracted = ext.extracted_text.slice(0, 1500);
            }

            if (rawExtracted) {
                setSupplierTerms((prev) => formatClausesAsList(rawExtracted, prev));
            }

            // Intelligently sync related parameters if found in the document
            if (ext.payment_terms) setPaymentTerms(ext.payment_terms);
            if (ext.warranty) setWarrantyTerms(ext.warranty);
            if (ext.delivery_terms) setDeliveryTerms(ext.delivery_terms);
            if (ext.lead_time) setLeadTimeDays(ext.lead_time);

            // Also attach to supporting evidence documents automatically
            setSupportingDocs((prev) => {
                const exists = prev.some((d) => d.file_name === termsFile.name);
                if (exists) return prev;
                return [
                    ...prev,
                    {
                        file_name: termsFile.name,
                        file_type: termsFile.type,
                        file_base64: termsFile.base64,
                        document_type: "Terms & Conditions Contract",
                        file_size_formatted: termsFile.size,
                        extracted_text: rawExtracted,
                        extracted_data: ext,
                    }
                ];
            });

            toast.success(`✨ Extracted clauses added to the bottom of your terms list!`);
        } catch (err: any) {
            toast.dismiss(loadToast);
            toast.error(err?.message || "Error during AI document extraction.");
        } finally {
            setIsExtractingTerms(false);
        }
    };

    // Supporting Evidence Document Upload Handler
    const handleSupportingDocUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string = "Supporting Evidence / Quotation Proposal") => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            if (file.size > 20 * 1024 * 1024) {
                toast.error(`"${file.name}" exceeds 20MB limit.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                const formattedSize = `${(file.size / 1024).toFixed(1)} KB`;
                setSupportingDocs((prev) => [
                    ...prev,
                    {
                        file_name: file.name,
                        file_type: file.type || "application/pdf",
                        file_base64: base64,
                        document_type: docType,
                        file_size_formatted: formattedSize,
                    }
                ]);
                toast.success(`Attached "${file.name}" (${formattedSize})`);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeSupportingDoc = (index: number) => {
        setSupportingDocs((prev) => prev.filter((_, idx) => idx !== index));
        toast.info("Document removed from attachment list.");
    };

    // Step Validation
    const validateStep = (stepNumber: number): boolean => {
        if (stepNumber === 1) {
            if (!supplierName.trim()) {
                toast.error("Please enter your company/store name.");
                return false;
            }
            const finalCat = isOtherCategory && customCategory.trim() ? customCategory.trim() : category;
            if (!finalCat || !finalCat.trim()) {
                toast.error("Please specify your business category.");
                return false;
            }
            if (!productsOffered.trim()) {
                toast.error("Please specify the products you supply.");
                return false;
            }
            if (!location.trim()) {
                toast.error("Please enter your business location.");
                return false;
            }
            if (!contactPerson.trim()) {
                toast.error("Please enter the contact person.");
                return false;
            }
            if (!contactPhone.trim()) {
                toast.error("Please enter your phone number.");
                return false;
            }
            if (!contactEmail.trim()) {
                toast.error("Please enter your official business email.");
                return false;
            }
            return true;
        }

        if (stepNumber === 2) {
            if (!unitPrice || Number(unitPrice) <= 0) {
                toast.error("Please enter a valid offered unit price.");
                return false;
            }
            if (!leadTimeDays.trim()) {
                toast.error("Please enter delivery lead time.");
                return false;
            }
            return true;
        }

        if (stepNumber === 3) {
            // Optional tab: Validate only if supplier filled in items
            for (let i = 0; i < otherProductsOffer.length; i++) {
                const it = otherProductsOffer[i];
                if (!it.item_name.trim() && (it.unit_price !== "" && Number(it.unit_price) > 0)) {
                    toast.error(`Please provide a product name for Offer #${i + 1}.`);
                    return false;
                }
                if (it.item_name.trim() && (it.unit_price === "" || Number(it.unit_price) <= 0)) {
                    toast.error(`Please provide a valid unit price for "${it.item_name}".`);
                    return false;
                }
            }
            return true;
        }

        if (stepNumber === 4) {
            return true;
        }

        if (stepNumber === 5) {
            if (!paymentTerms || !warrantyTerms || !priceValidity || !deliveryTerms) {
                toast.error("Please complete the commercial and warranty terms.");
                return false;
            }
            return true;
        }

        if (stepNumber === 6) {
            return true;
        }

        if (stepNumber === 7) {
            if (!agreedToTerms) {
                toast.error("Please acknowledge and agree to the supplier authenticity terms before submitting.");
                return false;
            }
            return true;
        }

        return true;
    };

    const goToNextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, 7));
        }
    };

    const goToPrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Categories display
    const allDisplayCategories = useMemo(() => {
        const list: string[] = [];
        activeCategories.forEach((c) => {
            if (c && c.trim() && !list.includes(c.trim())) {
                list.push(c.trim());
            }
        });
        if (list.length === 0) {
            ["Construction & Hardware Supplies", "Electronics & IT Equipment", "Office Supplies & Paper", "Machinery & Heavy Equipment", "Logistics & Packaging Materials", "Raw Materials & Chemicals"].forEach((c) => {
                if (!list.includes(c)) list.push(c);
            });
        }
        return list;
    }, [activeCategories]);

    const commonServices = [
        "Free Delivery within Metro Manila",
        "Official BIR Receipt / Invoice",
        "1-Year Replacement Warranty",
        "Bulk Order Tier Discount",
        "Flexible 30-Day Payment Terms",
        "Free Product Samples / Demo",
    ];

    // Fetch active categories and all quotations for this request
    const fetchPortalData = async () => {
        setIsLoadingCategories(true);
        setIsLoadingQuotations(true);
        try {
            const targetName = supplierParam || supplierName;
            const params = new URLSearchParams();
            if (reqParam) params.set("req", reqParam);
            if (targetName.trim()) params.set("name", targetName.trim());

            const res = await fetch(`/api/supplier-portal/quote?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                const fetchedActive: string[] = Array.isArray(data.categories) ? data.categories : [];
                setActiveCategories(fetchedActive);

                if (Array.isArray(data.quotations)) {
                    setQuotations(data.quotations);
                }

                if (data.existingQuote) {
                    const eq = data.existingQuote;
                    setUserSubmittedQuote(eq);
                    if (!unitPrice) setUnitPrice(String(eq.unit_price || ""));
                    if (eq.shipping_fee !== undefined && eq.shipping_fee !== null) setShippingFee(String(eq.shipping_fee));
                    if (eq.discount !== undefined && eq.discount !== null) setDiscount(String(eq.discount));
                    if (eq.tax_type) {
                        if (eq.tax_type.startsWith("Others") || eq.tax_type === "Custom Rate") {
                            setTaxType("Others");
                        } else {
                            setTaxType(eq.tax_type);
                        }
                    }
                    if (eq.tax_rate !== undefined && eq.tax_rate !== null) setCustomTaxRate(String(eq.tax_rate));
                    if (!leadTimeDays) setLeadTimeDays(String(eq.lead_time_days || "2-3"));
                    if (eq.availability) setAvailability(eq.availability);
                    if (eq.products && !productsOffered) setProductsOffered(eq.products);
                    if (Array.isArray(eq.services_offered) && eq.services_offered.length > 0) {
                        setServicesOffered(eq.services_offered);
                    }
                    if (Array.isArray(eq.other_products_offer) && eq.other_products_offer.length > 0) {
                        setOtherProductsOffer(eq.other_products_offer);
                    }
                    if (eq.notes) {
                        const termsMatch = eq.notes.match(/\[Terms:\s*([^\]]+)\]/);
                        if (termsMatch) {
                            const termsStr = termsMatch[1];
                            const payMatch = termsStr.match(/Payment=([^|]+)/);
                            if (payMatch) setPaymentTerms(payMatch[1].trim());
                            const warMatch = termsStr.match(/Warranty=([^|]+)/);
                            if (warMatch) setWarrantyTerms(warMatch[1].trim());
                            const valMatch = termsStr.match(/Validity=([^|]+)/);
                            if (valMatch) setPriceValidity(valMatch[1].trim());
                            const delMatch = termsStr.match(/Delivery=([^|]+)/);
                            if (delMatch) setDeliveryTerms(delMatch[1].trim());
                            const clMatch = termsStr.match(/Clauses=([^|]+)/);
                            if (clMatch) setSupplierTerms(clMatch[1].trim());
                            
                            const remainingNote = eq.notes.replace(/\[Terms:[^\]]+\]/, "").trim();
                            if (remainingNote && !notes) setNotes(remainingNote);
                        } else if (!notes) {
                            setNotes(eq.notes);
                        }
                    }
                }

                // Determine category matching:
                let targetCategory = catParam;
                if (data.supplier) {
                    const found = data.supplier;
                    const statusLabel = found.is_active ? "Registered Active Supplier" : "Potential Supplier";
                    setExistingSupplierNotice(`Supplier "${found.name}" found in database (${statusLabel}). Your proposal will be saved under this profile.`);
                    if (found.location && !locParam && !location) {
                        setLocation(found.location);
                    }
                    if (found.products && !productsOffered) {
                        setProductsOffered(found.products);
                    }
                    if (found.category) {
                        targetCategory = found.category;
                    }
                    if (found.contact_person && !contactPerson) {
                        setContactPerson(found.contact_person);
                    }
                    if (found.phone && !contactPhone) {
                        setContactPhone(found.phone);
                    }
                    if (found.email && !contactEmail) {
                        setContactEmail(found.email);
                    }
                }

                if (targetCategory && fetchedActive.includes(targetCategory)) {
                    setCategory(targetCategory);
                    setIsOtherCategory(false);
                } else if (targetCategory) {
                    setIsOtherCategory(true);
                    setCustomCategory(targetCategory);
                } else if (fetchedActive.length > 0) {
                    setCategory(fetchedActive[0]);
                    setIsOtherCategory(false);
                } else {
                    setIsOtherCategory(true);
                }
            }
        } catch (err) {
            console.warn("Could not fetch active supplier portal data:", err);
        } finally {
            setIsLoadingCategories(false);
            setIsLoadingQuotations(false);
        }
    };

    useEffect(() => {
        fetchPortalData();
    }, [supplierParam, reqParam]);

    const toggleService = (svc: string) => {
        setServicesOffered((prev) =>
            prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
        );
    };

    const addCustomService = () => {
        const trimmed = customService.trim();
        if (!trimmed) {
            toast.error("Please type a service or value offer before clicking Add.");
            return;
        }
        if (servicesOffered.includes(trimmed)) {
            toast.error(`"${trimmed}" is already added.`);
            return;
        }
        setServicesOffered((prev) => [...prev, trimmed]);
        setCustomService("");
        toast.success(`Added service: "${trimmed}"`);
    };

    // Detect if bid has already been awarded to a vendor
    const awardedQuote = useMemo(() => {
        return quotations.find(
            (q) => (q.status || "").toLowerCase() === "accepted" || (q as any).is_winner === true
        ) || null;
    }, [quotations]);

    const isBidAwarded = Boolean(awardedQuote);

    // Calculate ranked leaderboard and AI recommendations
    const rankedQuotations = useMemo(() => {
        const list = [...quotations];
        return list.sort((a, b) => Number(a.unit_price) - Number(b.unit_price));
    }, [quotations]);

    // Leaderboard Pagination State (show only 2 bids per page)
    const [leaderboardPage, setLeaderboardPage] = useState<number>(1);
    const LEADERBOARD_PAGE_SIZE = 2;

    const totalLeaderboardPages = useMemo(() => {
        return Math.max(1, Math.ceil(rankedQuotations.length / LEADERBOARD_PAGE_SIZE));
    }, [rankedQuotations.length]);

    const paginatedLeaderboard = useMemo(() => {
        const startIdx = (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE;
        return rankedQuotations.slice(startIdx, startIdx + LEADERBOARD_PAGE_SIZE);
    }, [rankedQuotations, leaderboardPage]);

    useEffect(() => {
        if (leaderboardPage > totalLeaderboardPages) {
            setLeaderboardPage(totalLeaderboardPages);
        }
    }, [totalLeaderboardPages, leaderboardPage]);

    // AI recommendation analysis
    const aiAnalysis = useMemo(() => {
        if (rankedQuotations.length === 0) {
            return {
                recommendedQuote: null,
                bestPrice: null,
                fastestLeadTime: null,
                userRank: null,
                summary: "No quotations recorded yet. Be the first vendor to submit a proposal to secure the #1 ranking position!"
            };
        }

        const bestPriceQuote = rankedQuotations[0];
        
        let fastest = rankedQuotations[0];
        let minDays = 999;
        rankedQuotations.forEach((q) => {
            const num = parseInt(q.lead_time_days) || 3;
            if (num < minDays) {
                minDays = num;
                fastest = q;
            }
        });

        const userIndex = rankedQuotations.findIndex(
            (q) => q.supplier_name.toLowerCase().trim() === supplierName.toLowerCase().trim()
        );
        const userRank = userIndex !== -1 ? userIndex + 1 : null;

        let summary = "";
        if (awardedQuote) {
            summary = `🏆 Bidding Awarded: Requisition #${reqParam || "RFQ"} has concluded and was officially awarded to "${awardedQuote.supplier_name}" at ₱${Number(awardedQuote.unit_price).toLocaleString()} / ${awardedQuote.unit || "unit"}. Proposal submissions are closed.`;
        } else if (userRank === 1) {
            summary = `🎉 Outstanding! Your proposal currently holds the Rank #1 position with the most competitive price of ₱${Number(bestPriceQuote.unit_price).toLocaleString()} / ${bestPriceQuote.unit}.`;
        } else if (userRank && userRank > 1) {
            const diff = Number(unitPrice || 0) - Number(bestPriceQuote.unit_price);
            summary = `💡 AI Strategy Advice: You are currently Rank #${userRank}. Lowering your price by ₱${Math.max(1, diff).toLocaleString()} or reducing lead time to ${fastest.lead_time_days} days will help you reclaim the #1 Winner spot.`;
        } else {
            summary = `🏆 AI Top Pick: "${bestPriceQuote.supplier_name}" leads the bidding board with ₱${Number(bestPriceQuote.unit_price).toLocaleString()} / ${bestPriceQuote.unit} and ${bestPriceQuote.lead_time_days} days delivery time.`;
        }

        return {
            recommendedQuote: awardedQuote || bestPriceQuote,
            bestPrice: bestPriceQuote,
            fastestLeadTime: fastest,
            userRank,
            summary
        };
    }, [rankedQuotations, supplierName, unitPrice, awardedQuote, reqParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isBidAwarded) {
            toast.error(`Bidding has concluded. The bid was awarded to ${awardedQuote?.supplier_name || "a selected vendor"}. Submissions are closed.`);
            return;
        }

        if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(5)) {
            return;
        }

        if (!agreedToTerms) {
            toast.error("Please acknowledge and agree to the supplier authenticity terms before submitting.");
            return;
        }

        const finalCategory = isOtherCategory && customCategory.trim() 
            ? customCategory.trim() 
            : category;

        setIsSubmitting(true);
        try {
            const fullTermsNote = `[Terms: Payment=${paymentTerms} | Warranty=${warrantyTerms} | Validity=${priceValidity} | Delivery=${deliveryTerms}${supplierTerms.trim() ? ` | Clauses: ${supplierTerms.trim()}` : ""}] ${notes.trim()}`.trim();

            const quoteData = {
                supplier_name: supplierName.trim(),
                category: finalCategory,
                location: location.trim(),
                products: productsOffered.trim() || itemParam || "Requested Goods",
                contact_person: contactPerson.trim(),
                contact_phone: contactPhone.trim(),
                contact_email: contactEmail.trim(),
                request_number: reqParam,
                item_name: itemParam || "Requested Goods",
                quantity: Number(qtyParam || 1),
                unit: unitParam,
                unit_price: Number(unitPrice),
                subtotal,
                shipping_fee: shippingNum,
                discount: discountNum,
                tax_type: (taxType === "Others" || taxType === "Custom Rate") ? `Others (${effectiveTaxRate}%)` : taxType,
                tax_rate: effectiveTaxRate,
                tax_amount: taxAmount,
                total_amount: calculatedTotal,
                availability,
                lead_time_days: leadTimeDays,
                services_offered: servicesOffered,
                other_products_offer: otherProductsOffer.filter(it => it.item_name.trim() || Number(it.unit_price) > 0),
                payment_terms: paymentTerms,
                warranty_terms: warrantyTerms,
                price_validity: priceValidity,
                delivery_terms: deliveryTerms,
                supplier_terms: supplierTerms.trim(),
                notes: fullTermsNote,
                documents: supportingDocs,
                is_update: isEditMode || !!userSubmittedQuote,
            };

            const response = await fetch("/api/supplier-portal/quote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(quoteData),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                toast.error(data.error || "Failed to save quotation.");
                return;
            }

            setIsSubmitted(true);
            setIsEditMode(false);
            toast.success(
                data.isUpdated 
                    ? "Quotation, terms, documents & supplier profile updated successfully!" 
                    : "Quotation, terms & documents submitted successfully! Logged on the live bidding board."
            );
            
            await fetchPortalData();
        } catch (err: any) {
            toast.error(err?.message || "Failed to submit quotation. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeFinalCategory = isOtherCategory && customCategory.trim() ? customCategory.trim() : category;

    return (
        <div className="min-h-screen bg-[#eaf0f8] dark:bg-[#0e1019] text-slate-800 dark:text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 selection:bg-pink-500 selection:text-white transition-colors duration-300">
            <div className="w-full max-w-7xl relative z-10 space-y-6">
                {/* Brand Header with Neumorphic Badge */}
                <div className="text-center space-y-2.5">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#eaf0f8] dark:bg-[#151726] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.6)] border border-white/80 dark:border-white/[0.06] text-pink-600 dark:text-pink-400 text-xs font-black tracking-wider uppercase">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Airship Express Vendor Portal</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Vendor Quotation & Service Proposal
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        Submit and update your company quotation, pricing, terms & conditions with AI clause extraction, and supporting evidence files. View real-time bidding rankings alongside your proposal.
                    </p>
                </div>

                {/* Awarded Bid Announcement Banner */}
                {isBidAwarded && (
                    <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500/50 text-amber-950 dark:text-amber-100 shadow-md flex items-start gap-3.5 animate-in fade-in-50 duration-300">
                        <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                    Bidding Concluded & Awarded
                                </span>
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm flex items-center gap-1">
                                    <Trophy className="w-3 h-3" />
                                    Winner Selected
                                </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                The procurement evaluation for purchase requisition <strong>#{reqParam || "RFQ"}</strong> is finalized. The bid has been officially awarded to <strong>{awardedQuote?.supplier_name}</strong> at <strong>₱{Number(awardedQuote?.unit_price).toLocaleString()} / {awardedQuote?.unit || "unit"}</strong>. New proposal submissions and modifications are disabled.
                            </p>
                        </div>
                    </div>
                )}

                {/* Request Overview Card */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/90 dark:border-white/[0.08] shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_6px_6px_16px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_20px_rgba(0,0,0,0.7)] space-y-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.06] pb-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-sm">
                                <FileText className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Requisition Reference:</span>
                            <span className="font-mono text-xs font-black text-pink-600 dark:text-pink-400 bg-[#e8eef6] dark:bg-[#12141f] px-2.5 py-0.5 rounded-lg shadow-[inset_1px_1px_3px_rgba(163,177,198,0.35),_inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.05]">
                                {reqParam || "RFQ-PROCUREMENT-2026"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {aiAnalysis.userRank && (
                                <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-3 py-1 rounded-full border border-pink-200 dark:border-pink-800/40 flex items-center gap-1.5 shadow-sm">
                                    <Trophy className="w-3.5 h-3.5 text-pink-500" />
                                    Your Rank: #{aiAnalysis.userRank}
                                </span>
                            )}
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Sourcing & Bidding Portal
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04]">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Requested Item</span>
                            <strong className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block break-words whitespace-normal leading-snug">
                                {itemParam || "Office & Warehouse Materials"}
                            </strong>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04]">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Quantity Needed</span>
                            <strong className="text-sm font-extrabold text-pink-600 dark:text-pink-400 mt-0.5 block">
                                {qtyParam} {unitParam}
                            </strong>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04]">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Delivery Destination</span>
                            <strong className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block break-words whitespace-normal leading-snug">
                                352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)
                            </strong>
                        </div>
                    </div>
                </div>

                {/* 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column (7 cols): Step Form or Confirmation Card */}
                    <div className="lg:col-span-7 space-y-6">
                        {isSubmitted && !isEditMode ? (
                            /* Submission Confirmation Screen */
                            <div className="p-6 sm:p-8 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/90 dark:border-white/[0.08] shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_6px_6px_16px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_20px_rgba(0,0,0,0.7)] text-center space-y-5 animate-in zoom-in-95 duration-300">
                                <div className="w-14 h-14 rounded-3xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(16,185,129,0.35)]">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                                        Quotation & Supplier Terms Logged!
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                        Your quote, extracted terms, and supporting documents for <strong className="text-pink-600 dark:text-pink-400">{itemParam || "Requested Goods"}</strong> are recorded and actively ranked.
                                    </p>
                                </div>

                                <div className="p-5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-left max-w-lg mx-auto space-y-2 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Supplier Name:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{supplierName}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Business Category:</span>
                                        <span className="font-bold text-pink-600 dark:text-pink-400">{activeFinalCategory}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Offered Unit Price:</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{Number(unitPrice).toLocaleString()} / {unitParam}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Subtotal ({qtyParam} {unitParam}):</span>
                                        <span className="font-semibold text-slate-900 dark:text-white">₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {discountNum > 0 && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                            <span className="text-pink-600 dark:text-pink-400">Discount:</span>
                                            <span className="font-semibold text-pink-600 dark:text-pink-400">-₱{discountNum.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Shipping Fee:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {shippingNum > 0 ? `+₱${shippingNum.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00 (Free)"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Tax ({taxType === "Others" || taxType === "Custom Rate" ? `${effectiveTaxRate}% VAT` : taxType}):</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {taxAmount > 0 ? `+₱${taxAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-900 dark:text-white font-extrabold">Grand Total:</span>
                                        <span className="font-black text-sm text-pink-600 dark:text-pink-400">₱{calculatedTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Lead Time:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{leadTimeDays} business days</span>
                                    </div>

                                    {/* Terms Summary */}
                                    <div className="pt-2 pb-1 text-[11px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Scale className="w-3.5 h-3.5" />
                                        <span>Commercial & Warranty Terms</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Payment:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentTerms}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Warranty:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{warrantyTerms}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                        <span className="text-slate-500 dark:text-slate-400">Delivery:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{deliveryTerms}</span>
                                    </div>

                                    {/* Structured Specific Clauses List */}
                                    {supplierTermsList.length > 0 && (
                                        <div className="pt-2 pb-1 text-left">
                                            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider block mb-1">
                                                Fulfillment Clauses & Conditions ({supplierTermsList.length}):
                                            </span>
                                            <div className="space-y-1 bg-[#e2e8f0] dark:bg-[#0e101a] p-2.5 rounded-xl max-h-36 overflow-y-auto">
                                                {supplierTermsList.map((clause, idx) => {
                                                    const cleanText = clause.replace(/^[\d+.)\-*•\s]+/, "").trim();
                                                    return (
                                                        <div key={idx} className="text-slate-800 dark:text-slate-200 font-medium text-[11px] flex items-start gap-1.5 leading-snug">
                                                            <span className="text-pink-600 dark:text-pink-400 font-bold shrink-0">{idx + 1}.</span>
                                                            <span>{cleanText || clause}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Supporting Documents count */}
                                    {supportingDocs.length > 0 && (
                                        <div className="pt-2">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Supporting Evidence Uploaded:</span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {supportingDocs.map((doc, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[10px] font-semibold border border-pink-200 dark:border-pink-800">
                                                        <FileText className="w-2.5 h-2.5" />
                                                        {doc.file_name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditMode(true);
                                            setCurrentStep(1);
                                        }}
                                        className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Edit / Update Proposal Details</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isLoadingQuotations}
                                        onClick={fetchPortalData}
                                        className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuotations ? "animate-spin" : ""}`} />
                                        <span>{isLoadingQuotations ? "Refreshing..." : "Refresh Leaderboard"}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Progressive Stepper Form */
                            <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/90 dark:border-white/[0.08] shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_6px_6px_16px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_20px_rgba(0,0,0,0.7)] space-y-6">
                                
                                {isEditMode && (
                                    <div className="p-3.5 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/40 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-pink-700 dark:text-pink-300">
                                            <Edit3 className="w-4 h-4 text-pink-500" />
                                            <span>Editing Proposal Mode — Navigate the steps to update details anytime.</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditMode(false)}
                                            className="text-xs text-pink-600 dark:text-pink-400 font-bold hover:underline"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}

                                {/* STEPPER TABS HEADER */}
                                <div className="p-2 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.35),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04]">
                                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                                        {FORM_STEPS.map((step) => {
                                            const IconComponent = step.icon;
                                            const isActive = currentStep === step.id;
                                            const isPast = currentStep > step.id;

                                            return (
                                                <button
                                                    key={step.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (step.id < currentStep || validateStep(currentStep)) {
                                                            setCurrentStep(step.id);
                                                        }
                                                    }}
                                                    className={`py-2 px-1.5 sm:px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                                        isActive
                                                            ? "bg-pink-600 text-white shadow-md font-extrabold scale-[1.02]"
                                                            : isPast
                                                            ? "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold"
                                                            : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {isPast ? (
                                                            <Check className="w-3.5 h-3.5 stroke-[3] text-pink-600 dark:text-pink-400" />
                                                        ) : (
                                                            <IconComponent className="w-3.5 h-3.5" />
                                                        )}
                                                        <span className="text-[10px] hidden md:inline">Step {step.id}</span>
                                                    </div>
                                                    <span className="text-[10px] sm:text-[11px] truncate max-w-full">
                                                        {step.short}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* STEP 1: Profile, Catalog, Location & Contact */}
                                {currentStep === 1 && (
                                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <Building2 className="w-4 h-4" />
                                                <span>Step 1: Supplier Profile, Catalog & Contacts</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">1 of 7</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <span>Company / Store Name *</span>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                            Vendor Identity
                                                        </span>
                                                    </span>
                                                    {existingSupplierNotice && (
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                            ✓ Existing record detected
                                                        </span>
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={supplierName}
                                                    onChange={(e) => setSupplierName(e.target.value)}
                                                    placeholder="e.g. Acme Supplies Corp."
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                />
                                                {existingSupplierNotice && (
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                                                        {existingSupplierNotice}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Supplier Category */}
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Tag className="w-3.5 h-3.5 text-pink-500" />
                                                        <span>Supplier Business Category *</span>
                                                    </span>
                                                    {activeCategories.length > 0 ? (
                                                        <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-400">
                                                            {activeCategories.length} Active in Database
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-slate-400">
                                                            Active Categories
                                                        </span>
                                                    )}
                                                </label>
                                                <div className={`grid grid-cols-1 ${isOtherCategory ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2`}>
                                                    <select
                                                        value={isOtherCategory ? "Other Category" : category}
                                                        onChange={(e) => {
                                                            if (e.target.value === "Other Category") {
                                                                setIsOtherCategory(true);
                                                            } else {
                                                                setIsOtherCategory(false);
                                                                setCategory(e.target.value);
                                                            }
                                                        }}
                                                        className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40 cursor-pointer"
                                                    >
                                                        {allDisplayCategories.map((cat) => (
                                                            <option key={cat} value={cat}>
                                                                {cat}
                                                            </option>
                                                        ))}
                                                        <option value="Other Category">+ Other / Custom Category (Enter Below)</option>
                                                    </select>

                                                    {isOtherCategory && (
                                                        <input
                                                            type="text"
                                                            required
                                                            value={customCategory}
                                                            onChange={(e) => setCustomCategory(e.target.value)}
                                                            placeholder="Specify custom business category..."
                                                            className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Products Offered */}
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Boxes className="w-3.5 h-3.5 text-pink-500" />
                                                        <span>Products & Catalog Supplied *</span>
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-400">
                                                        Catalog Summary
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={productsOffered}
                                                    onChange={(e) => setProductsOffered(e.target.value)}
                                                    placeholder="e.g. Industrial Tools, Power Equipment, Safety Gear, Hardware Fasteners..."
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>

                                            {/* Business Location */}
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <MapPin className="w-3.5 h-3.5 text-pink-500" />
                                                        <span>Business Location / Address *</span>
                                                    </span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={location}
                                                    onChange={(e) => setLocation(e.target.value)}
                                                    placeholder="e.g. 501 Juan Luna St., Binondo, Manila"
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Person *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={contactPerson}
                                                    onChange={(e) => setContactPerson(e.target.value)}
                                                    placeholder="e.g. Juan dela Cruz"
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone / Mobile *</label>
                                                <input
                                                    type="tel"
                                                    required
                                                    value={contactPhone}
                                                    onChange={(e) => setContactPhone(e.target.value)}
                                                    placeholder="e.g. +63 917 123 4567"
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>

                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Business Email *</label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={contactEmail}
                                                    onChange={(e) => setContactEmail(e.target.value)}
                                                    placeholder="e.g. sales@yourcompany.com"
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Step 1 Actions */}
                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-3 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>Next: Pricing & Stock</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: Pricing & Stock Availability */}
                                {currentStep === 2 && (
                                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <PesoSign className="w-4 h-4" />
                                                <span>Step 2: Pricing, Shipping & Tax Structure (PHP ₱)</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">2 of 7</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Availability Status *</label>
                                                <select
                                                    required
                                                    value={availability}
                                                    onChange={(e) => setAvailability(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                >
                                                    <option value="In Stock (Immediate Dispatch)">In Stock (Immediate Dispatch)</option>
                                                    <option value="Available on Order (2-3 Days)">Available on Order (2-3 Days)</option>
                                                    <option value="Partial Stock Available">Partial Stock Available</option>
                                                    <option value="Made-to-Order (Indent)">Made-to-Order (Indent)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Offered Unit Price (₱) *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-pink-600 dark:text-pink-400">₱</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required
                                                        min="0.01"
                                                        value={unitPrice}
                                                        onChange={(e) => setUnitPrice(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-black text-emerald-600 dark:text-emerald-400 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lead Time (Days) *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={leadTimeDays}
                                                    onChange={(e) => setLeadTimeDays(e.target.value)}
                                                    placeholder="e.g. 1-2 days"
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Row 2: Shipping Fee, Discount & Tax Settings */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span>Shipping / Freight Fee (₱)</span>
                                                    <span className="text-[10px] font-semibold text-slate-400">0 for Free Delivery</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">₱</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={shippingFee}
                                                        onChange={(e) => setShippingFee(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span>Proposal Discount (₱)</span>
                                                    <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-400">Special deduction</span>
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-pink-500">-₱</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={discount}
                                                        onChange={(e) => setDiscount(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-pink-600 dark:text-pink-400 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                    <span>Tax Classification</span>
                                                    <span className="text-[10px] font-semibold text-slate-400">{effectiveTaxRate}% Rate</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={taxType}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setTaxType(val);
                                                            if ((val === "Others" || val === "Custom Rate") && (!customTaxRate || customTaxRate === "0")) {
                                                                setCustomTaxRate("12");
                                                            }
                                                        }}
                                                        className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                    >
                                                        <option value="VAT (12%)">VAT (12%)</option>
                                                        <option value="Non-VAT / Exempt (0%)">Non-VAT / Exempt (0%)</option>
                                                        <option value="Zero-Rated (0%)">Zero-Rated (0%)</option>
                                                        <option value="Others">Others / Custom VAT (%)</option>
                                                    </select>
                                                    {(taxType === "Others" || taxType === "Custom Rate") && (
                                                        <div className="w-24 relative shrink-0">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                max="100"
                                                                value={customTaxRate}
                                                                onChange={(e) => setCustomTaxRate(e.target.value)}
                                                                placeholder="%"
                                                                className="w-full pl-3 pr-6 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Total Calculation & Itemized Financial Highlight */}
                                        {Number(unitPrice) > 0 && (
                                            <div className="p-4 rounded-3xl bg-[#eaf0f8] dark:bg-[#141624] shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),_4px_4px_12px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_3px_3px_8px_rgba(0,0,0,0.6)] border border-pink-500/30 space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-2.5">
                                                    <div>
                                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-600 dark:text-pink-400 block">
                                                            Quotation Financial Breakdown
                                                        </span>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <strong className="text-xs font-black text-slate-900 dark:text-white break-words">
                                                                {itemParam || "Requested Goods"}
                                                            </strong>
                                                            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                                                                • {qtyParam} {unitParam} × ₱{Number(unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-left sm:text-right shrink-0">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Grand Total Bid</span>
                                                        <span className="text-lg sm:text-xl font-black text-pink-600 dark:text-pink-400 font-mono tracking-tight">
                                                            ₱{calculatedTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Mini Grid Breakdown */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                    <div className="p-2.5 rounded-xl bg-[#e2e8f0]/80 dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04]">
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Subtotal</span>
                                                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                            ₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-[#e2e8f0]/80 dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04]">
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Discount</span>
                                                        <span className="font-mono font-bold text-pink-600 dark:text-pink-400">
                                                            {discountNum > 0 ? `-₱${discountNum.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00"}
                                                        </span>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-[#e2e8f0]/80 dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04]">
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Shipping Fee</span>
                                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            {shippingNum > 0 ? `+₱${shippingNum.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00 (Free)"}
                                                        </span>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-[#e2e8f0]/80 dark:bg-[#10121b] border border-white/60 dark:border-white/[0.04]">
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Tax ({taxType === "Others" || taxType === "Custom Rate" ? `${effectiveTaxRate}% VAT` : taxType})</span>
                                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            {taxAmount > 0 ? `+₱${taxAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00 (0%)"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2 Actions */}
                                        <div className="pt-4 flex justify-between">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-2.5 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>Next: Other Products Offer</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: Other Products Offer (Optional) */}
                                {currentStep === 3 && (
                                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                    <Boxes className="w-4 h-4" />
                                                    <span>Step 3: Other Products / Additional Item Offers (Optional)</span>
                                                </h3>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    Propose additional items, companion supplies, or bundle packages. This step is completely optional.
                                                </p>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">3 of 7</span>
                                        </div>

                                        {/* Optional Banner */}
                                        <div className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-pink-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25)]">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 shrink-0">
                                                    Optional Tab
                                                </span>
                                                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                                    {otherProductsOffer.length === 0
                                                        ? "No extra product offers added. You can skip this step or click Add Product Offer below."
                                                        : `${otherProductsOffer.length} extra product offer(s) configured.`}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleAddOtherProduct}
                                                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Product Offer</span>
                                            </button>
                                        </div>

                                        {/* Product list */}
                                        {otherProductsOffer.length === 0 ? (
                                            <div className="p-8 rounded-3xl bg-[#e9f0f8] dark:bg-[#121420] border border-dashed border-slate-300 dark:border-white/10 text-center space-y-3 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25)]">
                                                <div className="w-12 h-12 rounded-2xl bg-white/70 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-sm">
                                                    <Boxes className="w-6 h-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                        No Extra Products Added (Optional)
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                                        If you have alternative models, replacement supplies, or companion gear that Airship Express can purchase together, add them here.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddOtherProduct}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e2e8f0] dark:bg-[#181a2a] hover:bg-pink-50 dark:hover:bg-pink-950/40 text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold border border-white/60 dark:border-white/[0.04] transition-all cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>+ Add First Extra Product Offer</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {otherProductsOffer.map((item, index) => (
                                                    <div
                                                        key={item.id || index}
                                                        className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)] space-y-3.5 transition-all"
                                                    >
                                                        {/* Header of Item */}
                                                        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06] pb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-lg bg-pink-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                                                    {index + 1}
                                                                </span>
                                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                                                    {item.item_name ? item.item_name : `Product Offer #${index + 1}`}
                                                                </h4>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveOtherProduct(index)}
                                                                className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[11px] font-bold border border-rose-200/60 dark:border-rose-900/40 flex items-center gap-1 cursor-pointer transition-all"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                <span>Remove</span>
                                                            </button>
                                                        </div>

                                                        {/* Fields Grid */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                                                            {/* Product Name */}
                                                            <div className="sm:col-span-5 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Product / Item Name *
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={item.item_name}
                                                                    onChange={(e) => handleUpdateOtherProduct(index, "item_name", e.target.value)}
                                                                    placeholder="e.g. Safety Helmet Class B / Heavy Duty Gloves"
                                                                    className="w-full px-3.5 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                                                />
                                                            </div>

                                                            {/* Unit Option */}
                                                            <div className="sm:col-span-3 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Unit Option *
                                                                </label>
                                                                <select
                                                                    value={item.unit || "pcs"}
                                                                    onChange={(e) => handleUpdateOtherProduct(index, "unit", e.target.value)}
                                                                    className="w-full px-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                                                                >
                                                                    {PRODUCT_UNIT_OPTIONS.map((u) => (
                                                                        <option key={u.value} value={u.value}>
                                                                            {u.label}
                                                                        </option>
                                                                    ))}
                                                                    {/* Custom fallback if existing value is outside preset */}
                                                                    {item.unit && !PRODUCT_UNIT_OPTIONS.some((o) => o.value === item.unit) && (
                                                                        <option value={item.unit}>{item.unit}</option>
                                                                    )}
                                                                </select>
                                                            </div>

                                                            {/* Unit Price */}
                                                            <div className="sm:col-span-4 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Unit Price (₱) *
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-pink-600 dark:text-pink-400">₱</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={item.unit_price}
                                                                        onChange={(e) => handleUpdateOtherProduct(index, "unit_price", e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-black text-emerald-600 dark:text-emerald-400 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Tax Classification */}
                                                            <div className="sm:col-span-4 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                        Tax Classification
                                                                    </label>
                                                                    {(item.tax_classification === "Others" || item.tax_classification === "Custom Rate") && (
                                                                        <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400">
                                                                            {item.tax_rate ?? 12}% Rate
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-1.5">
                                                                    <select
                                                                        value={item.tax_classification}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            handleUpdateOtherProduct(index, "tax_classification", val);
                                                                            if ((val === "Others" || val === "Custom Rate") && (item.tax_rate === undefined || item.tax_rate === 0)) {
                                                                                handleUpdateOtherProduct(index, "tax_rate", 12);
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                                                                    >
                                                                        <option value="VAT (12%)">VAT (12%)</option>
                                                                        <option value="Non-VAT / Exempt (0%)">Non-VAT / Exempt (0%)</option>
                                                                        <option value="Zero-Rated (0%)">Zero-Rated (0%)</option>
                                                                        <option value="Others">Others / Custom VAT (%)</option>
                                                                    </select>
                                                                    {(item.tax_classification === "Others" || item.tax_classification === "Custom Rate") && (
                                                                        <div className="w-16 relative shrink-0">
                                                                            <input
                                                                                type="number"
                                                                                step="0.1"
                                                                                min="0"
                                                                                max="100"
                                                                                value={item.tax_rate !== undefined ? item.tax_rate : 12}
                                                                                onChange={(e) => handleUpdateOtherProduct(index, "tax_rate", e.target.value)}
                                                                                placeholder="%"
                                                                                className="w-full pl-2 pr-5 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                                                                            />
                                                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Shipping / Freight Fee */}
                                                            <div className="sm:col-span-4 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Shipping / Freight (₱)
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">₱</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={item.shipping_fee}
                                                                        onChange={(e) => handleUpdateOtherProduct(index, "shipping_fee", e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-slate-900 dark:text-white"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Discount */}
                                                            <div className="sm:col-span-4 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Discount (₱)
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-pink-500">-₱</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={item.discount}
                                                                        onChange={(e) => handleUpdateOtherProduct(index, "discount", e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-bold text-pink-600 dark:text-pink-400"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Item Notes / Specs */}
                                                            <div className="sm:col-span-12 space-y-1">
                                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                    Item Specifications / Remarks (Optional)
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={item.notes || ""}
                                                                    onChange={(e) => handleUpdateOtherProduct(index, "notes", e.target.value)}
                                                                    placeholder="e.g. Brand new sealed, warranty included, manufacturer certificate..."
                                                                    className="w-full px-3.5 py-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/[0.04] text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddOtherProduct}
                                                        className="px-4 py-2 rounded-xl bg-[#e2e8f0] dark:bg-[#181a2a] hover:bg-pink-50 dark:hover:bg-pink-950/40 text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold border border-white/60 dark:border-white/[0.04] flex items-center gap-1.5 transition-all cursor-pointer"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>+ Add Another Product Offer</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3 Actions */}
                                        <div className="pt-4 flex justify-between">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-2.5 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>{otherProductsOffer.length > 0 ? "Next: Value Inclusions" : "Skip / Next: Value Inclusions"}</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: Value Inclusions */}
                                {currentStep === 4 && (
                                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Step 4: Proposal Inclusions & Value Offers</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">4 of 7</span>
                                        </div>

                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Select any complimentary services, guarantees, or special value terms included in your quote.
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {commonServices.map((svc) => {
                                                const isSelected = servicesOffered.includes(svc);
                                                return (
                                                    <button
                                                        key={svc}
                                                        type="button"
                                                        onClick={() => toggleService(svc)}
                                                        className={`p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                                            isSelected
                                                                ? "bg-pink-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_2px_2px_6px_rgba(219,39,119,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)]"
                                                                : "bg-[#e8ecf4] dark:bg-[#12141f] text-slate-700 dark:text-slate-300 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.3),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),_inset_-2px_-2px_4px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04]"
                                                        }`}
                                                    >
                                                        <span className="leading-snug">{svc}</span>
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-white text-pink-600" : "bg-slate-300/60 dark:bg-slate-700 text-transparent"}`}>
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Custom Extra Service Entry */}
                                        <div className="flex gap-2 pt-2">
                                            <input
                                                type="text"
                                                value={customService}
                                                onChange={(e) => setCustomService(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addCustomService();
                                                    }
                                                }}
                                                placeholder="Add custom service (e.g. Free Spare Parts, 60-Day Terms)..."
                                                className="flex-1 px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                            />
                                            <button
                                                type="button"
                                                disabled={!customService.trim()}
                                                onClick={addCustomService}
                                                className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Offer</span>
                                            </button>
                                        </div>

                                        {/* Step 3 Actions */}
                                        <div className="pt-4 flex justify-between">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-2.5 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>Next: Terms & Conditions</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 5: Terms & Conditions with AI Document Extractor */}
                                {currentStep === 5 && (
                                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <Scale className="w-4 h-4" />
                                                <span>Step 5: Supplier Terms & Conditions (AI Extraction)</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">5 of 7</span>
                                        </div>

                                        {/* AI Document Clause Extractor Box */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-pink-300/70 dark:border-pink-900/40 space-y-3 shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-sm">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <strong className="text-xs font-black text-slate-900 dark:text-white block">
                                                        AI Document Terms Extractor
                                                    </strong>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                        Upload contract / terms agreement & AI will extract clauses into the form automatically.
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                                <label className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-pink-400/80 dark:border-pink-700/60 bg-white/70 dark:bg-[#151726] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-pink-50/50 dark:hover:bg-pink-950/30 transition-all">
                                                    <FileUp className="w-4 h-4 text-pink-500" />
                                                    <span className="truncate max-w-[200px] sm:max-w-xs">
                                                        {termsFile ? termsFile.name : "Choose Terms Agreement / Contract File (PDF, DOCX, IMG)"}
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                                                        onChange={handleTermsFileSelect}
                                                        className="hidden"
                                                    />
                                                </label>

                                                <button
                                                    type="button"
                                                    disabled={!termsFile || isExtractingTerms}
                                                    onClick={handleExtractTermsWithAI}
                                                    className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isExtractingTerms ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span>Extracting...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            <span>Extract Terms with AI</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Payment Terms */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <CreditCard className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Payment Terms *</span>
                                                </label>
                                                <select
                                                    value={paymentTerms}
                                                    onChange={(e) => setPaymentTerms(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                >
                                                    <option value="Net 30 Days (Standard B2B)">Net 30 Days (Standard B2B Credit)</option>
                                                    <option value="Net 15 Days">Net 15 Days</option>
                                                    <option value="Net 60 Days">Net 60 Days</option>
                                                    <option value="50% Downpayment / 50% Upon Delivery">50% Downpayment / 50% Upon Delivery</option>
                                                    <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                                                    <option value="Full Advance Payment (Prepayment)">Full Advance Payment (Prepayment)</option>
                                                    <option value="Custom Billing Arrangement">Custom Billing Arrangement</option>
                                                </select>
                                            </div>

                                            {/* Warranty Policy */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Warranty & Return Policy *</span>
                                                </label>
                                                <select
                                                    value={warrantyTerms}
                                                    onChange={(e) => setWarrantyTerms(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                >
                                                    <option value="1-Year Replacement Warranty">1-Year Replacement Warranty</option>
                                                    <option value="2-Year Comprehensive Warranty">2-Year Comprehensive Warranty</option>
                                                    <option value="6-Month Limited Parts Warranty">6-Month Limited Parts Warranty</option>
                                                    <option value="30-Day Money-Back Guarantee">30-Day Money-Back Guarantee</option>
                                                    <option value="7-Day Replacement for Factory Defects">7-Day Replacement for Factory Defects</option>
                                                    <option value="Standard Manufacturer Warranty">Standard Manufacturer Warranty</option>
                                                    <option value="As-Is / No Warranty">As-Is / No Warranty</option>
                                                </select>
                                            </div>

                                            {/* Price Validity */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <CalendarCheck2 className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Price Validity Period *</span>
                                                </label>
                                                <select
                                                    value={priceValidity}
                                                    onChange={(e) => setPriceValidity(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                >
                                                    <option value="30 Days Validity">30 Days Validity (Standard)</option>
                                                    <option value="15 Days Validity">15 Days Validity</option>
                                                    <option value="45 Days Validity">45 Days Validity</option>
                                                    <option value="60 Days Validity">60 Days Validity</option>
                                                    <option value="90 Days Validity">90 Days Validity</option>
                                                </select>
                                            </div>

                                            {/* Delivery Incoterms */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <Truck className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Delivery & Incoterms *</span>
                                                </label>
                                                <select
                                                    value={deliveryTerms}
                                                    onChange={(e) => setDeliveryTerms(e.target.value)}
                                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
                                                >
                                                    <option value="Door-to-Door Delivery (Airship Manila DDP)">Door-to-Door Delivery (Airship Manila DDP)</option>
                                                    <option value="Warehouse Pickup / Ex-Works">Warehouse Pickup / Ex-Works</option>
                                                    <option value="FOB Manila Port / Freight Station">FOB Manila Port / Freight Station</option>
                                                    <option value="Express 24-Hour Dispatch">Express 24-Hour Dispatch</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Supplier Specific Terms Textarea with AI insertion target & List Layout */}
                                        <div className="space-y-2.5 pt-2">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Supplier Specific Terms, Fulfillment Clauses & Conditions</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-2 py-0.5 rounded-md border border-pink-200 dark:border-pink-800/40">
                                                        {supplierTermsList.length} {supplierTermsList.length === 1 ? "Clause" : "Clauses"} Listed
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={isLastClauseEmpty}
                                                        onClick={handleAddClause}
                                                        title={isLastClauseEmpty ? "Please fill in the current clause before adding another line" : "Add next clause line"}
                                                        className="px-2.5 py-1 rounded-lg bg-[#e2e7f0] dark:bg-[#141624] hover:bg-pink-100 dark:hover:bg-pink-950/60 text-pink-600 dark:text-pink-400 text-[10px] font-bold shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e2e7f0] dark:disabled:hover:bg-[#141624]"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Add Clause Line</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <textarea
                                                rows={6}
                                                value={supplierTerms}
                                                onChange={(e) => setSupplierTerms(e.target.value)}
                                                placeholder="1. First term / condition...&#10;2. Second term / condition...&#10;Extracted AI clauses will be added to the bottom of this list."
                                                className="w-full px-4 py-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-mono font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all leading-relaxed"
                                            />

                                            {/* Live Structured Clauses List Preview */}
                                            {supplierTermsList.length > 0 && (
                                                <div className="p-3 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <FileCheck2 className="w-3 h-3 text-pink-500" />
                                                        <span>Clause List View Preview ({supplierTermsList.length}):</span>
                                                    </span>
                                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                        {supplierTermsList.map((clause, idx) => {
                                                            const cleanClause = clause.replace(/^[\d+.)\-*•\s]+/, "").trim();
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    className="p-2 rounded-xl bg-white/80 dark:bg-[#151726] border border-slate-200/70 dark:border-white/[0.04] shadow-sm flex items-start gap-2 text-xs"
                                                                >
                                                                    <span className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] leading-snug">
                                                                        {cleanClause || clause}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Step 4 Actions */}
                                        <div className="pt-4 flex justify-between">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-2.5 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>Next: Supporting Evidence</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 6: Supporting Evidence Documents */}
                                {currentStep === 6 && (
                                    <div className="space-y-5 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <UploadCloud className="w-4 h-4" />
                                                <span>Step 6: Supporting Evidence & Documentation</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">6 of 7</span>
                                        </div>

                                        {/* Supporting Documents Upload Area (uploaded into supplier_documents) */}
                                        <div className="space-y-2.5">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <Paperclip className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Upload Evidence Files (Quotation Proposal, Specs, DTI/SEC, Catalog Images)</span>
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-400">
                                                    Saved in supplier_documents
                                                </span>
                                            </label>

                                            <label className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-[#eaf0f8] dark:bg-[#12141f] hover:border-pink-500 dark:hover:border-pink-500 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                                                <div className="w-10 h-10 rounded-2xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center">
                                                    <UploadCloud className="w-5 h-5" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                                        Click or drop supporting evidence files here
                                                    </span>
                                                    <span className="text-[11px] text-slate-400">
                                                        PDF, Excel/CSV, Word DOCX, Image Quotations (up to 20MB per file)
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                                                    onChange={handleSupportingDocUpload}
                                                    className="hidden"
                                                />
                                            </label>

                                            {/* List of Attached Supporting Documents with Image Previews */}
                                            {supportingDocs.length > 0 && (
                                                <div className="space-y-2 pt-1">
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                        Attached Evidence Files ({supportingDocs.length}):
                                                    </span>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {supportingDocs.map((doc, idx) => {
                                                            const isImg = isImageFile(doc);
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="p-2.5 rounded-xl bg-white dark:bg-[#10121d] border border-slate-200 dark:border-white/[0.06] shadow-sm flex items-center justify-between gap-2"
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        {isImg && doc.file_base64 ? (
                                                                            <div 
                                                                                onClick={() => setPreviewImage({ src: doc.file_base64, title: doc.file_name, type: doc.file_type, size: doc.file_size_formatted })}
                                                                                className="relative group cursor-pointer w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-pink-500/40"
                                                                                title="Click to preview image"
                                                                            >
                                                                                <img 
                                                                                    src={doc.file_base64} 
                                                                                    alt={doc.file_name} 
                                                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                                                                />
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                    <Eye className="w-3.5 h-3.5 text-white" />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center shrink-0">
                                                                                <File className="w-4 h-4" />
                                                                            </div>
                                                                        )}
                                                                        <div className="min-w-0">
                                                                            <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                                                {doc.file_name}
                                                                            </strong>
                                                                            <span className="text-[10px] text-slate-400 block">
                                                                                {doc.file_size_formatted || "Uploaded"} • {doc.document_type}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {isImg && doc.file_base64 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setPreviewImage({ src: doc.file_base64, title: doc.file_name, type: doc.file_type, size: doc.file_size_formatted })}
                                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-all cursor-pointer"
                                                                                title="Preview Image"
                                                                            >
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeSupportingDoc(idx)}
                                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                                                                            title="Remove File"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Remarks / Proposal Notes */}
                                        <div className="space-y-1.5 pt-2">
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Additional Remarks / Proposal Message
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Add any additional remarks or notes for the procurement team..."
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#e8ecf4] dark:bg-[#10121b] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] border border-white/60 dark:border-white/[0.04] text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                                            />
                                        </div>

                                        {/* Step 5 Actions */}
                                        <div className="pt-3 flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-3 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back to Terms</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={goToNextStep}
                                                className="px-6 py-3 rounded-2xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                                            >
                                                <span>Next: Review Proposal (Step 7)</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 7: Comprehensive Review & Image Previews */}
                                {currentStep === 7 && (
                                    <div className="space-y-5 animate-in fade-in-50 duration-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                                                <FileCheck2 className="w-4 h-4" />
                                                <span>Step 7: Comprehensive Proposal Review & Verification</span>
                                            </h3>
                                            <span className="text-[10px] font-bold text-slate-400">7 of 7</span>
                                        </div>

                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Please review your complete supplier proposal, pricing structure, commercial clauses, and supporting evidence files before final submission.
                                        </p>

                                        {/* Section 1: Supplier Profile & Identification */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>1. Supplier Profile & Identification</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(1)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 1</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Company / Store Name:</span>
                                                    <strong className="text-slate-900 dark:text-white">{supplierName || "—"}</strong>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Business Category:</span>
                                                    <strong className="text-pink-600 dark:text-pink-400">{activeFinalCategory || "—"}</strong>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <span className="text-slate-400 text-[10px] block">Products & Catalog Supplied:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{productsOffered || "—"}</span>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <span className="text-slate-400 text-[10px] block">Business Location / Address:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{location || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Contact Person:</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{contactPerson || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Phone & Email:</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{contactPhone || "—"} • {contactEmail || "—"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 2: Pricing, Stock & Total Proposal Value */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <PesoSign className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>2. Primary Requested Item Financial Structure</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(2)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 2</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/20 border border-slate-200/60 dark:border-white/[0.03]">
                                                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Unit Price:</span>
                                                    <strong className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        ₱{Number(unitPrice || 0).toLocaleString()} / {unitParam}
                                                    </strong>
                                                </div>
                                                <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/20 border border-slate-200/60 dark:border-white/[0.03]">
                                                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Volume / Quantity:</span>
                                                    <strong className="text-slate-800 dark:text-slate-200">{qtyParam} {unitParam}</strong>
                                                </div>
                                                <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/20 border border-slate-200/60 dark:border-white/[0.03]">
                                                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Subtotal:</span>
                                                    <strong className="text-slate-900 dark:text-white font-mono">
                                                        ₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </strong>
                                                </div>
                                                <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-500/20">
                                                    <span className="text-pink-600 dark:text-pink-400 text-[10px] block font-bold uppercase">Grand Total:</span>
                                                    <strong className="text-sm font-black text-pink-600 dark:text-pink-400 font-mono">
                                                        ₱{calculatedTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </strong>
                                                </div>
                                            </div>

                                            {/* Financial details breakdown row */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Discount:</span>
                                                    <span className="font-semibold text-pink-600 dark:text-pink-400">
                                                        {discountNum > 0 ? `-₱${discountNum.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "None (₱0.00)"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Shipping Fee:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {shippingNum > 0 ? `₱${shippingNum.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "Free Delivery"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Tax ({taxType === "Others" || taxType === "Custom Rate" ? `${effectiveTaxRate}% VAT` : taxType}):</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {taxAmount > 0 ? `+₱${taxAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} (${effectiveTaxRate}%)` : "₱0.00"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Lead Time / Stock:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {leadTimeDays} days • {availability}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 3: Other Products & Additional Item Offers */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <Boxes className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>3. Other Products & Additional Item Offers ({otherProductsOffer.length})</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(3)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 3</span>
                                                </button>
                                            </div>

                                            {otherProductsOffer.length === 0 ? (
                                                <p className="text-[11px] text-slate-400 italic py-1">
                                                    No additional products offered. (Optional)
                                                </p>
                                            ) : (
                                                <div className="space-y-2.5 pt-1">
                                                    {otherProductsOffer.map((offer, idx) => {
                                                        const p = Number(offer.unit_price || 0);
                                                        const itemSub = p;
                                                        const disc = Number(offer.discount || 0);
                                                        const ship = Number(offer.shipping_fee || 0);
                                                        const rate = offer.tax_rate !== undefined ? Number(offer.tax_rate) : (offer.tax_classification === "VAT (12%)" || offer.tax_classification === "vatable" ? 12 : 0);
                                                        const itemTax = offer.tax_amount !== undefined ? Number(offer.tax_amount) : (Math.max(0, itemSub - disc) * (rate / 100));
                                                        const itemTot = offer.total_amount !== undefined ? Number(offer.total_amount) : (Math.max(0, itemSub - disc) + ship + itemTax);

                                                        return (
                                                            <div 
                                                                key={offer.id || idx}
                                                                className="p-3 rounded-xl bg-white/70 dark:bg-black/20 border border-slate-200/70 dark:border-white/[0.04] space-y-1.5"
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <strong className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                                                            {offer.item_name || `Additional Item #${idx + 1}`}
                                                                        </strong>
                                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                            Unit: <strong className="text-slate-700 dark:text-slate-300 capitalize">{offer.unit || "unit"}</strong> • ₱{p.toLocaleString("en-PH", { minimumFractionDigits: 2 })} / {offer.unit || "unit"}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <span className="text-xs font-black text-pink-600 dark:text-pink-400 font-mono block">
                                                                            ₱{itemTot.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                        <span className="text-[9px] uppercase font-bold text-slate-400">
                                                                            {rate > 0 ? `${rate}% VAT` : "VAT Exempt / 0%"}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/[0.03] text-[10px] text-slate-500 dark:text-slate-400">
                                                                    <span>Base Price: ₱{itemSub.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                                                                    {rate > 0 && <span className="text-slate-500 dark:text-slate-400">• Tax: +₱{itemTax.toLocaleString("en-PH", { minimumFractionDigits: 2 })} ({rate}%)</span>}
                                                                    {disc > 0 && <span className="text-pink-600 dark:text-pink-400 font-semibold">• Disc: -₱{disc.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>}
                                                                    {ship > 0 && <span>• Freight: +₱{ship.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>}
                                                                    {offer.notes && <span className="italic truncate max-w-xs">• Note: {offer.notes}</span>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Section 4: Value Inclusions & Service Offers */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>4. Included Value-Added Services ({servicesOffered.length})</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(4)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 4</span>
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {servicesOffered.map((svc, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 text-[11px] font-semibold border border-pink-200 dark:border-pink-800/40">
                                                        <Check className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                                        {svc}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Section 5: Commercial Terms & Fulfillment Clauses */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <Scale className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>5. Commercial Terms & Fulfillment Clauses</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(5)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 5</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Payment Terms:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentTerms}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Warranty & Return:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{warrantyTerms}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Price Validity:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{priceValidity}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 text-[10px] block">Delivery & Incoterms:</span>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{deliveryTerms}</span>
                                                </div>
                                            </div>

                                            {supplierTermsList.length > 0 && (
                                                <div className="pt-2">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                        Fulfillment Clauses & Conditions List ({supplierTermsList.length}):
                                                    </span>
                                                    <div className="space-y-1 bg-[#e2e8f0] dark:bg-[#0e101a] p-2.5 rounded-xl max-h-36 overflow-y-auto">
                                                        {supplierTermsList.map((clause, idx) => {
                                                            const cleanText = clause.replace(/^[\d+.)\-*•\s]+/, "").trim();
                                                            return (
                                                                <div key={idx} className="text-slate-800 dark:text-slate-200 font-medium text-[11px] flex items-start gap-1.5 leading-snug">
                                                                    <span className="text-pink-600 dark:text-pink-400 font-bold shrink-0">{idx + 1}.</span>
                                                                    <span>{cleanText || clause}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Section 6: Supporting Evidence Files & Interactive Image Previews */}
                                        <div className="p-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.25),_inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] space-y-2.5 text-xs">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-white/[0.05]">
                                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                                    <Paperclip className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>6. Supporting Evidence Documents & Image Previews ({supportingDocs.length})</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(6)}
                                                    className="text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    <span>Edit Step 6</span>
                                                </button>
                                            </div>

                                            {supportingDocs.length === 0 ? (
                                                <p className="text-[11px] text-slate-400 italic py-1">
                                                    No supporting documents attached. (Optional)
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                                    {supportingDocs.map((doc, idx) => {
                                                        const isImg = isImageFile(doc);
                                                        return (
                                                            <div 
                                                                key={idx}
                                                                className="p-2 rounded-xl bg-white dark:bg-[#151726] border border-slate-200/80 dark:border-white/[0.06] shadow-sm flex flex-col justify-between gap-2"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    {isImg && doc.file_base64 ? (
                                                                        <div 
                                                                            onClick={() => setPreviewImage({ src: doc.file_base64, title: doc.file_name, type: doc.file_type, size: doc.file_size_formatted })}
                                                                            className="relative group cursor-pointer w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-pink-500/30 bg-black/10"
                                                                            title="Click to view full image"
                                                                        >
                                                                            <img 
                                                                                src={doc.file_base64} 
                                                                                alt={doc.file_name} 
                                                                                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                                <Maximize2 className="w-4 h-4 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-14 h-14 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center shrink-0">
                                                                            <FileText className="w-6 h-6" />
                                                                        </div>
                                                                    )}

                                                                    <div className="min-w-0 flex-1">
                                                                        <strong className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                                                                            {doc.file_name}
                                                                        </strong>
                                                                        <span className="text-[10px] text-slate-400 block">
                                                                            {doc.file_size_formatted || "Document"}
                                                                        </span>
                                                                        <span className="text-[9px] font-semibold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                                                            {doc.document_type}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {isImg && doc.file_base64 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewImage({ src: doc.file_base64, title: doc.file_name, type: doc.file_type, size: doc.file_size_formatted })}
                                                                        className="w-full py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/60 text-pink-600 dark:text-pink-400 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                                                    >
                                                                        <Eye className="w-3 h-3" />
                                                                        <span>Preview Image</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Remarks Section in Review if present */}
                                        {notes && notes.trim() && (
                                            <div className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] space-y-1 text-xs">
                                                <span className="text-[10px] font-bold uppercase text-slate-400">Additional Remarks:</span>
                                                <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{notes}</p>
                                            </div>
                                        )}

                                        {/* Authenticity Agreement Checkbox */}
                                        <div 
                                            onClick={() => setAgreedToTerms(!agreedToTerms)}
                                            className="p-3.5 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.3),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-start gap-3 cursor-pointer select-none transition-all hover:border-pink-500/40"
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-all ${agreedToTerms ? "bg-pink-600 text-white shadow-sm" : "bg-slate-300 dark:bg-slate-700 text-transparent"}`}>
                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            </div>
                                            <div className="text-xs space-y-0.5">
                                                <span className="font-bold text-slate-900 dark:text-white block">
                                                    Supplier Terms & Authenticity Commitment *
                                                </span>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    I confirm on behalf of <strong>{supplierName || "our company"}</strong> that all offered products, pricing, clauses, and attached evidence are authentic, accurate, and comply with the stated delivery and warranty terms.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Final Submission Card / Actions */}
                                        <div className="pt-3 flex items-center justify-between gap-3">
                                            <button
                                                type="button"
                                                onClick={goToPrevStep}
                                                className="px-5 py-3 rounded-2xl bg-[#e2e7f0] dark:bg-[#141624] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Back to Evidence</span>
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={isSubmitting || isLoadingCategories || isLoadingQuotations || !agreedToTerms || isBidAwarded}
                                                className="flex-1 py-3.5 px-6 rounded-2xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white font-black text-sm shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>{isEditMode || userSubmittedQuote ? "Updating Quotation..." : "Submitting Proposal..."}</span>
                                                    </>
                                                ) : isBidAwarded ? (
                                                    <>
                                                        <Trophy className="w-4 h-4 text-amber-300" />
                                                        <span>Bidding Concluded (Bid Awarded)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {isEditMode || userSubmittedQuote ? (
                                                            <>
                                                                <Check className="w-4 h-4" />
                                                                <span>Save Changes & Update Ranking</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send className="w-4 h-4" />
                                                                <span>Submit Price Quotation & Terms</span>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>

                    {/* Right Column (5 cols): Live Quotations Leaderboard & AI Recommendation Side Panel */}
                    <div className="lg:col-span-5 space-y-4">
                        {/* AI Recommendation Spotlight Card */}
                        <div className="p-5 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-pink-500/30 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_6px_6px_16px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_20px_rgba(0,0,0,0.7)] space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-sm">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        AI Recommendation & Insights
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/40">
                                    Live Evaluator
                                </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                {aiAnalysis.summary}
                            </p>

                            {aiAnalysis.recommendedQuote && (
                                <div className="p-3 rounded-2xl bg-[#e8ecf4] dark:bg-[#12141f] border border-white/60 dark:border-white/[0.05] shadow-[inset_1px_1px_3px_rgba(163,177,198,0.35),_inset_-1px_-1px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)] space-y-1 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Recommended Vendor</span>
                                        <span className="text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                                            <Trophy className="w-3 h-3" />
                                            Rank #1
                                        </span>
                                    </div>
                                    <strong className="text-xs font-extrabold text-slate-900 dark:text-white block">
                                        {aiAnalysis.recommendedQuote.supplier_name}
                                    </strong>
                                    <div className="flex items-center justify-between text-[11px] pt-1">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            ₱{Number(aiAnalysis.recommendedQuote.unit_price).toLocaleString()} / {aiAnalysis.recommendedQuote.unit}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                                            ⏱️ {aiAnalysis.recommendedQuote.lead_time_days} days lead time
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard of All Supplier Quotations */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/90 dark:border-white/[0.08] shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),_6px_6px_16px_rgba(163,177,198,0.4)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),_6px_6px_20px_rgba(0,0,0,0.7)] space-y-4">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/[0.06] pb-3">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                        All Vendor Quotations & Rankings
                                    </h3>
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-[#e8ecf4] dark:bg-[#12141f] px-2.5 py-0.5 rounded-full border border-white/60 dark:border-white/[0.05]">
                                    {rankedQuotations.length} {rankedQuotations.length === 1 ? "Bid" : "Bids"}
                                </span>
                            </div>

                            {isLoadingQuotations ? (
                                <div className="py-8 text-center space-y-2">
                                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="text-xs text-slate-400">Loading quotations & rankings...</p>
                                </div>
                            ) : rankedQuotations.length === 0 ? (
                                <div className="py-8 px-4 rounded-2xl bg-[#e9f0f8] dark:bg-[#121420] border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        No proposals submitted yet
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                                        Submit your quotation to lock in your proposal as the #1 ranked candidate!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-3 pr-1">
                                        {paginatedLeaderboard.map((quote, pIdx) => {
                                            const rank = (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + pIdx + 1;
                                            const isCurrentUser = 
                                                quote.supplier_name.toLowerCase().trim() === supplierName.toLowerCase().trim();

                                            const isAwardWinner = 
                                                (quote.status || "").toLowerCase() === "accepted" || 
                                                (quote as any).is_winner === true || 
                                                (awardedQuote && quote.id === awardedQuote.id);

                                            const isRank1 = rank === 1;
                                            const isRank2 = rank === 2;
                                            const isRank3 = rank === 3;

                                            return (
                                                <div
                                                    key={quote.id || pIdx}
                                                    className={`p-4 rounded-2xl transition-all duration-200 ${
                                                        isAwardWinner
                                                            ? "bg-amber-50/70 dark:bg-[#1a1711] border-2 border-amber-500 shadow-md"
                                                            : isCurrentUser
                                                            ? "bg-[#eef4fd] dark:bg-[#171b2d] border-2 border-pink-500 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(219,39,119,0.25)]"
                                                            : "bg-[#e9f0f8] dark:bg-[#121420] border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.3),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)]"
                                                    }`}
                                                >
                                                    {/* Header with Rank Badge & Name */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {isAwardWinner ? (
                                                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-extrabold">
                                                                    <Trophy className="w-3 h-3 text-slate-950" />
                                                                    Bid Winner (Awarded)
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm ${
                                                                        isRank1
                                                                            ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-extrabold"
                                                                            : isRank2
                                                                            ? "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                                                                            : isRank3
                                                                            ? "bg-amber-700/80 text-white"
                                                                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                                    }`}
                                                                >
                                                                    {isRank1 && <Trophy className="w-3 h-3" />}
                                                                    Rank #{rank}
                                                                </span>
                                                            )}

                                                            {!isAwardWinner && isRank1 && (
                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                                                                    Lowest Bid
                                                                </span>
                                                            )}

                                                            {isCurrentUser && (
                                                                <span className="text-[10px] font-black text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-950/60 px-2 py-0.5 rounded-md border border-pink-300 dark:border-pink-800 animate-pulse">
                                                                    ★ Your Submission
                                                                </span>
                                                            )}
                                                        </div>

                                                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                                            {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : "Active"}
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 space-y-1.5">
                                                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                                            <strong className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                                                {quote.supplier_name}
                                                            </strong>
                                                            <div className="text-right">
                                                                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                                    ₱{Number(quote.unit_price).toLocaleString()}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 block">
                                                                    / {quote.unit || "unit"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-white/[0.04]">
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px]">Item Sourced:</span>
                                                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                                                                    {quote.item_name || itemParam || "Requested Goods"}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px]">Total Proposal:</span>
                                                                <span className="font-bold text-pink-600 dark:text-pink-400 font-mono block">
                                                                    ₱{Number(quote.total_amount || 0).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Financial details pills */}
                                                        {(Number(quote.shipping_fee) > 0 || Number(quote.discount) > 0 || Number(quote.tax_amount) > 0 || quote.tax_type) && (
                                                            <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                                                                {Number(quote.discount) > 0 && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800/40">
                                                                        -₱{Number(quote.discount).toLocaleString()} Disc
                                                                    </span>
                                                                )}
                                                                {Number(quote.shipping_fee) > 0 && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                                                        +₱{Number(quote.shipping_fee).toLocaleString()} Ship
                                                                    </span>
                                                                )}
                                                                {quote.tax_type && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                                                        {quote.tax_type}
                                                                    </span>
                                                                )}
                                                                {quote.other_products_offer && Array.isArray(quote.other_products_offer) && quote.other_products_offer.length > 0 && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/40">
                                                                        +{quote.other_products_offer.length} Extra Offer{quote.other_products_offer.length > 1 ? "s" : ""}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {quote.products && (
                                                            <div className="pt-1 text-[11px]">
                                                                <span className="text-slate-400 block text-[10px]">Products & Catalog:</span>
                                                                <span className="font-medium text-slate-700 dark:text-slate-300 line-clamp-1 text-[11px]">
                                                                    📦 {quote.products}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                Lead Time: <strong className="text-slate-800 dark:text-slate-200">{quote.lead_time_days} days</strong>
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                                                                {quote.availability || "In Stock"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Leaderboard Pagination Bar (2 bids per page, default rank 1 & 2) */}
                                    {rankedQuotations.length > 0 && (
                                        <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
                                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                Showing Rank <span className="font-mono text-pink-600 dark:text-pink-400 font-extrabold">{(leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + 1}</span>–<span className="font-mono text-pink-600 dark:text-pink-400 font-extrabold">{Math.min(leaderboardPage * LEADERBOARD_PAGE_SIZE, rankedQuotations.length)}</span> of <span className="font-mono">{rankedQuotations.length}</span> {rankedQuotations.length === 1 ? "Bid" : "Bids"}
                                            </div>

                                            {totalLeaderboardPages > 1 && (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setLeaderboardPage((p) => Math.max(1, p - 1))}
                                                        disabled={leaderboardPage === 1}
                                                        className="p-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#12141f] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35),_inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.6)] cursor-pointer"
                                                        title="Previous Ranks"
                                                    >
                                                        <ChevronLeft className="w-3.5 h-3.5" />
                                                    </button>

                                                    <div className="flex items-center gap-1">
                                                        {Array.from({ length: totalLeaderboardPages }).map((_, pageIdx) => {
                                                            const pageNum = pageIdx + 1;
                                                            const isActive = pageNum === leaderboardPage;
                                                            return (
                                                                <button
                                                                    key={pageNum}
                                                                    type="button"
                                                                    onClick={() => setLeaderboardPage(pageNum)}
                                                                    className={`w-6 h-6 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center ${
                                                                        isActive
                                                                            ? "bg-pink-600 text-white shadow-[-1px_-1px_3px_rgba(255,255,255,0.8),_1px_1px_3px_rgba(219,39,119,0.35)]"
                                                                            : "bg-[#e8ecf4] dark:bg-[#12141f] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35),_inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.6)]"
                                                                    }`}
                                                                >
                                                                    {pageNum}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setLeaderboardPage((p) => Math.min(totalLeaderboardPages, p + 1))}
                                                        disabled={leaderboardPage === totalLeaderboardPages}
                                                        className="p-1.5 rounded-xl bg-[#e8ecf4] dark:bg-[#12141f] text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35),_inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.6)] cursor-pointer"
                                                        title="Next Ranks"
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-4">
                    Airship Express Supply Chain Management • Binondo, Manila, Philippines
                </div>
            </div>

            {/* Interactive Image Lightbox Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <div 
                        className="relative max-w-4xl w-full bg-[#151726] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 min-w-0">
                                <Eye className="w-4 h-4 text-pink-500 shrink-0" />
                                <span className="font-bold text-sm text-white truncate">{previewImage.title}</span>
                                {previewImage.size && (
                                    <span className="text-xs text-slate-400 bg-white/10 px-2.5 py-0.5 rounded-full shrink-0">
                                        {previewImage.size}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
                                title="Close Preview"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="w-full flex-1 overflow-auto flex items-center justify-center p-2 rounded-2xl bg-black/50 min-h-[260px] max-h-[65vh]">
                            <img 
                                src={previewImage.src} 
                                alt={previewImage.title} 
                                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg"
                            />
                        </div>

                        <div className="w-full flex items-center justify-between pt-2 text-xs text-slate-400">
                            <span className="hidden sm:inline">Click outside or press Close to return to review</span>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer ml-auto"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SupplierQuotePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#eaf0f8] dark:bg-[#0e1019] flex items-center justify-center text-slate-400">Loading Portal...</div>}>
            <QuoteContent />
        </Suspense>
    );
}
