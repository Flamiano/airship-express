"use client";

import React, { useState, useEffect } from "react";
import Portal from "../../../../components/client/Portal";
import { 
    X, 
    Download, 
    FileText, 
    Building2, 
    Calendar, 
    ExternalLink, 
    Maximize2, 
    Minimize2,
    Tag,
    Sparkles,
    CheckCircle2,
    Scale,
    FileSpreadsheet,
    FileCheck2,
    ShieldCheck,
    UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { 
    CONTRACT_ELEMENTS, 
    CONTRACT_CATEGORIES,
    ContractCategory 
} from "../../utils/contractElements";
import { 
    exportContractPdf, 
    exportContractWord 
} from "../../utils/contractExport";

interface SupplierDocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    document: {
        id: string;
        fileName: string;
        fileUrl?: string;
        publicUrl?: string;
        documentType?: string;
        supplierName?: string;
        supplierCategory?: string;
        supplierContact?: string;
        supplierPhone?: string;
        supplierEmail?: string;
        fileType?: string;
        createdAt?: string;
        summary?: string;
        extractedData?: any;
        isContract?: boolean;
        contractNumber?: string;
        contractTitle?: string;
        contractTerms?: any;
        signatories?: any;
        effectiveDate?: string;
        expirationDate?: string;
        status?: string;
    } | null;
}

export function SupplierDocumentPreviewModal({
    isOpen,
    onClose,
    document: doc,
}: SupplierDocumentPreviewModalProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<ContractCategory | "all">("all");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen]);

    if (!isOpen || !doc) return null;

    const fileUrl = doc.fileUrl || doc.publicUrl || "";
    const isPdf = (doc.fileName || "").toLowerCase().endsWith(".pdf") || doc.fileType === "application/pdf";
    const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName || "") || (doc.fileType || "").startsWith("image/");
    const isContract = Boolean(doc.isContract || doc.contractTerms);

    const handleDownloadPdf = async () => {
        if (!doc.contractTerms) {
            toast.error("Contract terms are not loaded.");
            return;
        }
        await exportContractPdf({
            contractNumber: doc.contractNumber || "AGR-2026-0001",
            supplierName: doc.supplierName || "Supplier",
            supplierContact: doc.supplierContact,
            supplierPhone: doc.supplierPhone,
            supplierEmail: doc.supplierEmail,
            effectiveDate: doc.effectiveDate,
            expirationDate: doc.expirationDate,
            terms: doc.contractTerms,
            signatories: doc.signatories ? {
                buyer: {
                    name: doc.signatories.buyer?.name || "Airship Express Procurement Officer",
                    title: doc.signatories.buyer?.title || "Head of Procurement",
                    signed_at: doc.signatories.buyer?.signed_at || null,
                },
                seller: {
                    name: doc.signatories.seller?.name || doc.supplierContact || doc.supplierName || "",
                    title: doc.signatories.seller?.title || "Authorized Representative",
                    signed_at: doc.signatories.seller?.signed_at || null,
                },
            } : undefined,
        });
    };

    const handleDownloadWord = async () => {
        if (!doc.contractTerms) {
            toast.error("Contract terms are not loaded.");
            return;
        }
        await exportContractWord({
            contractNumber: doc.contractNumber || "AGR-2026-0001",
            supplierName: doc.supplierName || "Supplier",
            supplierContact: doc.supplierContact,
            supplierPhone: doc.supplierPhone,
            supplierEmail: doc.supplierEmail,
            effectiveDate: doc.effectiveDate,
            expirationDate: doc.expirationDate,
            terms: doc.contractTerms,
            signatories: doc.signatories ? {
                buyer: {
                    name: doc.signatories.buyer?.name || "Airship Express Procurement Officer",
                    title: doc.signatories.buyer?.title || "Head of Procurement",
                    signed_at: doc.signatories.buyer?.signed_at || null,
                },
                seller: {
                    name: doc.signatories.seller?.name || doc.supplierContact || doc.supplierName || "",
                    title: doc.signatories.seller?.title || "Authorized Representative",
                    signed_at: doc.signatories.seller?.signed_at || null,
                },
            } : undefined,
        });
    };

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[150] bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className={`relative w-full ${
                        isFullscreen ? "max-w-[98vw] h-[95vh]" : "max-w-4xl max-h-[90vh]"
                    } bg-[#f0f4fa] dark:bg-[#151724] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-none overflow-hidden my-auto flex flex-col transition-all duration-200 animate-in zoom-in-95`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 sm:px-6 sm:py-4.5 border-b border-slate-300/80 dark:border-white/10 flex items-center justify-between bg-[#ebf0f7] dark:bg-[#131522] shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                {isContract ? <Scale className="w-5 h-5 drop-shadow" /> : <FileText className="w-5 h-5 drop-shadow" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-black text-base text-slate-900 dark:text-white truncate">
                                    {doc.fileName}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                                    <span className="font-bold text-pink-600 dark:text-pink-400">
                                        {doc.supplierName}
                                    </span>
                                    <span>•</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40">
                                        {isContract ? "Master Procurement Agreement & SOW" : (doc.documentType || "Contract Document")}
                                    </span>
                                    {isContract && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                            20 PMBOK Elements
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            {isContract && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleDownloadPdf}
                                        className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 border border-pink-200 dark:border-pink-800/50 shadow-xs cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold"
                                        title="Download Contract PDF"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Export PDF</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadWord}
                                        className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 shadow-xs cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold"
                                        title="Download Word Document"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Export Word</span>
                                    </button>
                                </>
                            )}

                            {!isContract && fileUrl && (
                                <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={doc.fileName}
                                    className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold"
                                    title="Download Document"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Download</span>
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer transition-all hidden md:flex items-center"
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1d1f2e] text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-white/80 dark:border-white/5 cursor-pointer transition-all"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {isContract ? (
                            /* Contract & SOW View with 20 Elements */
                            <div className="space-y-4 animate-in fade-in duration-200">
                                {/* Contract Header Card */}
                                <div className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[-4px_-4px_10px_rgba(255,255,255,0.8),_4px_4px_10px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.03),_4px_4px_10px_rgba(0,0,0,0.5)]">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-300/70 dark:border-white/10">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                                                    {doc.contractTitle || "Master Procurement Agreement & Statement of Work"}
                                                </h4>
                                                <span className="font-mono text-xs px-2.5 py-0.5 rounded-none bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 font-bold border border-pink-200 dark:border-pink-800/40">
                                                    {doc.contractNumber || "AGR-2026-0001"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Legally binding agreement formulated under PMBOK Procurement Management &amp; ISO 10845 standard.
                                            </p>
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                            {doc.status || "Active Agreement"}
                                        </span>
                                    </div>

                                    {/* Signatories & Dates Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3.5 text-xs">
                                        <div className="p-3 rounded-2xl bg-white dark:bg-[#10121b] border border-slate-200/80 dark:border-white/5 shadow-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Effective Date</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {doc.effectiveDate || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "Immediate")}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white dark:bg-[#10121b] border border-slate-200/80 dark:border-white/5 shadow-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Expiration Date</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                {doc.expirationDate || "Continuous / 1 Year Renewal"}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white dark:bg-[#10121b] border border-slate-200/80 dark:border-white/5 shadow-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Buyer Signatory</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                {doc.signatories?.buyer?.name || "Airship Express Procurement Officer"}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white dark:bg-[#10121b] border border-slate-200/80 dark:border-white/5 shadow-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Seller Signatory</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                {doc.signatories?.seller?.name || doc.supplierContact || doc.supplierName}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Category Filters */}
                                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35)] overflow-x-auto max-w-full">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCategory("all")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                            selectedCategory === "all"
                                                ? "bg-pink-600 text-white shadow-xs"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        All Elements (20)
                                    </button>
                                    {CONTRACT_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                                selectedCategory === cat
                                                    ? "bg-pink-600 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Accordion / List of Elements */}
                                <div className="space-y-3">
                                    {CONTRACT_ELEMENTS.filter(
                                        (elem) => selectedCategory === "all" || elem.category === selectedCategory
                                    ).map((elem) => {
                                        const clauseText = doc.contractTerms?.[elem.key] || "";
                                        return (
                                            <div
                                                key={elem.number}
                                                className="p-4 rounded-2xl bg-white dark:bg-[#10121b] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-mono text-xs font-bold flex items-center justify-center">
                                                            {elem.number}
                                                        </span>
                                                        <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                                                            {elem.label}
                                                        </h5>
                                                    </div>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                        {elem.category}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#141624] border border-slate-200/60 dark:border-white/5 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                    {clauseText || <span className="text-slate-400 italic">No specific clause specified.</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Standard Document Viewer Container */
                            <>
                                {(doc.summary || doc.extractedData) && (
                                    <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131d] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                            <Sparkles className="w-4 h-4 text-pink-500" />
                                            <span>Document Intelligence &amp; Key Details</span>
                                        </div>
                                        {doc.summary && (
                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {doc.summary}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="w-full min-h-[420px] rounded-2xl bg-[#e6ecf5] dark:bg-[#0f1017] border border-slate-300/60 dark:border-white/[0.06] shadow-[inset_2px_2px_6px_rgba(166,175,195,0.35)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)] overflow-hidden flex items-center justify-center relative">
                                    {fileUrl ? (
                                        isPdf ? (
                                            <iframe
                                                src={`${fileUrl}#toolbar=1`}
                                                className="w-full h-full min-h-[500px] border-none"
                                                title={doc.fileName}
                                            />
                                        ) : isImage ? (
                                            <div className="p-4 max-h-[600px] overflow-auto flex items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={fileUrl}
                                                    alt={doc.fileName}
                                                    className="max-h-[550px] max-w-full object-contain rounded-xl shadow-md"
                                                />
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center space-y-3">
                                                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center mx-auto">
                                                    <FileText className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                        {doc.fileName}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        This file format cannot be displayed directly in the browser preview.
                                                    </p>
                                                </div>
                                                <a
                                                    href={fileUrl}
                                                    download={doc.fileName}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-all shadow-md shadow-pink-500/20"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    <span>Download to View File</span>
                                                </a>
                                            </div>
                                        )
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 text-xs">
                                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            No document file URL available.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 sm:px-6 border-t border-slate-300/80 dark:border-white/10 bg-[#ebf0f7] dark:bg-[#131522] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                                Recorded on {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
