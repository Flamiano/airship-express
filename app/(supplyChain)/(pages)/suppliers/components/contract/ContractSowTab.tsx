// app/(supplyChain)/(pages)/suppliers/components/contract/ContractSowTab.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
    FileText,
    Download,
    RefreshCw,
    Sparkles,
    CheckCircle2,
    Calendar,
    Building2,
    ShieldCheck,
    ChevronDown,
    ChevronRight,
    Edit3,
    FileCheck2,
    RotateCcw,
    Scale,
    FileSpreadsheet,
    HelpCircle,
    UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
    ContractTerms,
    ContractSignatories,
    CONTRACT_ELEMENTS,
    CONTRACT_CATEGORIES,
    ContractCategory,
    buildContractFromQuotation,
    getDefaultContractTerms,
} from "../../utils/contractElements";
import {
    exportContractPdf,
    exportContractWord,
} from "../../utils/contractExport";

interface ContractSowTabProps {
    supplier: any;
    quote: any;
    formData: any;
    otherProducts: any[];
    contractTerms: ContractTerms;
    setContractTerms: React.Dispatch<React.SetStateAction<ContractTerms>>;
    contractNumber: string;
    setContractNumber: (num: string) => void;
    effectiveDate: string;
    setEffectiveDate: (date: string) => void;
    expirationDate: string;
    setExpirationDate: (date: string) => void;
    signatories: ContractSignatories;
    setSignatories: React.Dispatch<React.SetStateAction<ContractSignatories>>;
}

export function ContractSowTab({
    supplier,
    quote,
    formData,
    otherProducts,
    contractTerms,
    setContractTerms,
    contractNumber,
    setContractNumber,
    effectiveDate,
    setEffectiveDate,
    expirationDate,
    setExpirationDate,
    signatories,
    setSignatories,
}: ContractSowTabProps) {
    // Collapsed state for categories
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [activeFilterCategory, setActiveFilterCategory] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Toggle collapse
    const toggleCategory = (cat: string) => {
        setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
    };

    // Calculate completed count
    const completedCount = useMemo(() => {
        return CONTRACT_ELEMENTS.filter((el) => {
            const val = contractTerms[el.key];
            return typeof val === "string" && val.trim().length > 0;
        }).length;
    }, [contractTerms]);

    // Handle term change
    const handleTermChange = (key: keyof ContractTerms, value: string) => {
        setContractTerms((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    // Re-sync from Quotation
    const handleResyncFromQuote = () => {
        const freshTerms = buildContractFromQuotation(supplier, quote, formData, otherProducts);
        setContractTerms(freshTerms);
        toast.success("All 20 contract clauses re-synchronized from Quotation & Supplier profile!");
    };

    // Reset to Standard Procurement Defaults
    const handleResetDefaults = () => {
        const defaultTerms = getDefaultContractTerms();
        setContractTerms(defaultTerms);
        toast.info("Contract terms reset to ISO 10845 standard procurement baselines.");
    };

    // Download PDF handler
    const handleDownloadPdf = async () => {
        await exportContractPdf({
            contractNumber: contractNumber || "AGR-2026-0001",
            supplierName: formData.name || supplier?.name || "Supplier",
            supplierContact: formData.contact_person || supplier?.contact_person,
            supplierPhone: formData.phone || supplier?.phone,
            supplierEmail: formData.email || supplier?.email,
            supplierAddress: formData.location || supplier?.location,
            effectiveDate,
            expirationDate,
            terms: contractTerms,
            signatories,
        });
    };

    // Download Word handler
    const handleDownloadWord = async () => {
        await exportContractWord({
            contractNumber: contractNumber || "AGR-2026-0001",
            supplierName: formData.name || supplier?.name || "Supplier",
            supplierContact: formData.contact_person || supplier?.contact_person,
            supplierPhone: formData.phone || supplier?.phone,
            supplierEmail: formData.email || supplier?.email,
            supplierAddress: formData.location || supplier?.location,
            effectiveDate,
            expirationDate,
            terms: contractTerms,
            signatories,
        });
    };

    // Filter elements
    const filteredElements = useMemo(() => {
        return CONTRACT_ELEMENTS.filter((el) => {
            if (activeFilterCategory !== "All" && el.category !== activeFilterCategory) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchLabel = el.label.toLowerCase().includes(q);
                const matchDesc = el.description.toLowerCase().includes(q);
                const matchVal = (contractTerms[el.key] || "").toLowerCase().includes(q);
                return matchLabel || matchDesc || matchVal;
            }
            return true;
        });
    }, [activeFilterCategory, searchQuery, contractTerms]);

    // Group elements by category
    const groupedElements = useMemo(() => {
        const groups: Record<ContractCategory, typeof CONTRACT_ELEMENTS> = {
            "Scope & Schedule": [],
            "Commercial & Financial": [],
            "Quality & Risk Management": [],
            "Governance & Legal": [],
        };
        filteredElements.forEach((el) => {
            if (groups[el.category]) {
                groups[el.category].push(el);
            }
        });
        return groups;
    }, [filteredElements]);

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Header / Control Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181a29] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/25">
                        <Scale className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base text-slate-900 dark:text-white">
                                PMBOK & ISO 10845 Contract & SOW Table
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60">
                                {completedCount}/20 Clauses Complete
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Auto-filled from quotation #{quote?.request_number || quote?.quotation_number || "REF"} and commercial parameters. Fully editable for formal activation.
                        </p>
                    </div>
                </div>

                {/* Export & Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleResyncFromQuote}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        title="Re-populate terms from quotation line items and commercial parameters"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                        Re-sync Quote
                    </button>
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        title="Reset all clauses to standard procurement baseline"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        PDF Contract
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadWord}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Word (.doc)
                    </button>
                </div>
            </div>

            {/* Contract Metadata & Signatories Quick Config Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Contract Number
                    </label>
                    <input
                        type="text"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        placeholder="AGR-2026-0001"
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Effective Date
                    </label>
                    <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Expiration Date
                    </label>
                    <input
                        type="date"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Seller Signatory Name
                    </label>
                    <input
                        type="text"
                        value={signatories.seller.name}
                        onChange={(e) =>
                            setSignatories((prev) => ({
                                ...prev,
                                seller: { ...prev.seller, name: e.target.value },
                            }))
                        }
                        placeholder={formData.contact_person || "Authorized Representative"}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                        type="button"
                        onClick={() => setActiveFilterCategory("All")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                            activeFilterCategory === "All"
                                ? "bg-pink-600 text-white"
                                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        }`}
                    >
                        All (20)
                    </button>
                    {CONTRACT_CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveFilterCategory(cat)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                                activeFilterCategory === cat
                                    ? "bg-pink-600 text-white"
                                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="w-full sm:w-64">
                    <input
                        type="text"
                        placeholder="Search clause keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1 rounded-xl text-xs bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                    />
                </div>
            </div>

            {/* The 20 Elements Grouped Table */}
            <div className="space-y-4">
                {CONTRACT_CATEGORIES.map((category) => {
                    const elementsInCat = groupedElements[category];
                    if (!elementsInCat || elementsInCat.length === 0) return null;

                    const isCollapsed = !!collapsedCategories[category];

                    return (
                        <div
                            key={category}
                            className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#181a29] overflow-hidden shadow-sm"
                        >
                            {/* Category Accordion Header */}
                            <button
                                type="button"
                                onClick={() => toggleCategory(category)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#151724] border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 flex items-center justify-center text-xs font-black">
                                        {elementsInCat.length}
                                    </span>
                                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                                        {category}
                                    </h5>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <span className="text-[11px] font-medium hidden sm:inline">
                                        {isCollapsed ? "Expand" : "Collapse"}
                                    </span>
                                    {isCollapsed ? (
                                        <ChevronRight className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </div>
                            </button>

                            {/* Category Elements Body */}
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-200/60 dark:divide-white/5">
                                    {elementsInCat.map((el) => {
                                        const currentValue = contractTerms[el.key] || "";
                                        const isFilled = currentValue.trim().length > 0;

                                        return (
                                            <div
                                                key={el.key}
                                                className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                            >
                                                {/* Left column: Number, Label, Guidelines */}
                                                <div className="lg:col-span-4 flex flex-col justify-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[11px] font-black flex items-center justify-center shrink-0">
                                                            {el.number}
                                                        </span>
                                                        <span className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                                                            {el.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed pl-7">
                                                        {el.description}
                                                    </p>
                                                    <div className="pl-7 mt-2 flex items-center gap-1.5">
                                                        {isFilled ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                                                <CheckCircle2 className="w-3 h-3" /> Configured
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right column: Editable Textarea */}
                                                <div className="lg:col-span-8 flex flex-col">
                                                    <textarea
                                                        rows={Math.max(3, Math.min(8, currentValue.split("\n").length + 1))}
                                                        value={currentValue}
                                                        onChange={(e) => handleTermChange(el.key, e.target.value)}
                                                        placeholder={`Enter or customize ${el.label}...`}
                                                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#141624] border border-slate-300 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white dark:focus:bg-[#1c1f33] transition-all resize-y leading-relaxed font-sans"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Signatories Review Box */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#181a29] border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-pink-600" />
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        Signatories & Authorization
                    </h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                        <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400">
                            Buyer Authority
                        </span>
                        <div>
                            <span className="text-slate-500 block text-[10px]">Officer Name:</span>
                            <input
                                type="text"
                                value={signatories.buyer.name}
                                onChange={(e) =>
                                    setSignatories((prev) => ({
                                        ...prev,
                                        buyer: { ...prev.buyer, name: e.target.value },
                                    }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <span className="text-slate-500 block text-[10px]">Title:</span>
                            <input
                                type="text"
                                value={signatories.buyer.title}
                                onChange={(e) =>
                                    setSignatories((prev) => ({
                                        ...prev,
                                        buyer: { ...prev.buyer, title: e.target.value },
                                    }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                        <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400">
                            Seller Authority
                        </span>
                        <div>
                            <span className="text-slate-500 block text-[10px]">Representative Name:</span>
                            <input
                                type="text"
                                value={signatories.seller.name}
                                onChange={(e) =>
                                    setSignatories((prev) => ({
                                        ...prev,
                                        seller: { ...prev.seller, name: e.target.value },
                                    }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <span className="text-slate-500 block text-[10px]">Title:</span>
                            <input
                                type="text"
                                value={signatories.seller.title}
                                onChange={(e) =>
                                    setSignatories((prev) => ({
                                        ...prev,
                                        seller: { ...prev.seller, title: e.target.value },
                                    }))
                                }
                                className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#1a1c2d] border border-slate-300 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

