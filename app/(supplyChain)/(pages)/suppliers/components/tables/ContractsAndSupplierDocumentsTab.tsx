"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { 
    FileText, 
    Search, 
    Filter, 
    PlusCircle, 
    RefreshCw, 
    Building2, 
    Download, 
    Eye, 
    Trash2, 
    Calendar, 
    Tag, 
    CheckCircle2, 
    ShieldCheck, 
    FileSignature, 
    Layers, 
    ChevronDown, 
    ChevronUp,
    X,
    ExternalLink,
    Paperclip,
    Sparkles,
    FolderKanban
} from "lucide-react";
import Cards from "../../../../components/global/Cards";
import { Pagination } from "../../../../components/global/pagination";
import { useConfirm } from "../../../../components/ui/ConfirmModal";
import { Supplier } from "../../types";
import { SupplierDocumentPreviewModal } from "../modals/SupplierDocumentPreviewModal";
import { UploadSupplierDocumentModal } from "../modals/UploadSupplierDocumentModal";

export interface SupplierDocumentItem {
    id: string;
    supplierId: number;
    supplierName: string;
    supplierCategory?: string;
    supplierContact?: string;
    supplierEmail?: string;
    supplierPhone?: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    documentType: string;
    storagePath?: string;
    fileUrl?: string;
    publicUrl?: string;
    extractedText?: string | null;
    extractedData?: any;
    summary?: string;
    createdAt?: string;
    uploadedBy?: string | null;
}

interface ContractsAndSupplierDocumentsTabProps {
    registeredSuppliers: Supplier[];
    onRefresh?: () => void;
}

export function ContractsAndSupplierDocumentsTab({
    registeredSuppliers,
    onRefresh,
}: ContractsAndSupplierDocumentsTabProps) {
    const { confirm } = useConfirm();

    // Data states
    const [documents, setDocuments] = useState<SupplierDocumentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("all");
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
    const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<number>>(new Set());

    // Pagination states
    const GROUPS_PER_PAGE = 5;
    const DOCS_PER_PAGE = 9;
    const [groupPage, setGroupPage] = useState(1);
    const [flatPage, setFlatPage] = useState(1);

    // Modals
    const [previewDoc, setPreviewDoc] = useState<SupplierDocumentItem | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadInitialSupplierId, setUploadInitialSupplierId] = useState<number | undefined>(undefined);

    // Reset pagination on filter or view mode changes
    useEffect(() => {
        setGroupPage(1);
        setFlatPage(1);
    }, [debouncedSearch, selectedSupplierFilter, selectedTypeFilter, viewMode]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch documents
    const loadDocuments = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            else setIsRefreshing(true);

            const res = await fetch("/api/suppliers/documents");
            const data = await res.json();

            if (res.ok && data.success && Array.isArray(data.documents)) {
                setDocuments(data.documents);
                // Expand all suppliers that have documents by default
                const supIdsWithDocs = new Set<number>(
                    data.documents.map((d: SupplierDocumentItem) => Number(d.supplierId)).filter(Boolean)
                );
                setExpandedSupplierIds(supIdsWithDocs);
            } else {
                setDocuments([]);
            }
        } catch (err) {
            console.error("Error loading supplier documents:", err);
            toast.error("Failed to load supplier documents.");
            setDocuments([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    // Delete document handler
    const handleDeleteDocument = async (doc: SupplierDocumentItem) => {
        const confirmed = await confirm({
            title: "Delete Supplier Document?",
            message: `Are you sure you want to permanently delete "${doc.fileName}" for supplier "${doc.supplierName}"? This action cannot be undone.`,
            confirmText: "Delete Document",
            cancelText: "Cancel",
            confirmVariant: "danger",
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/suppliers/documents?id=${doc.id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to delete document.");
            }

            toast.success(`Document "${doc.fileName}" deleted.`);
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        } catch (err: any) {
            console.error("Error deleting document:", err);
            toast.error(err.message || "Failed to delete document.");
        }
    };

    // Filtered documents
    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            // Search term match
            const term = debouncedSearch.toLowerCase().trim();
            const matchesSearch =
                !term ||
                (doc.fileName || "").toLowerCase().includes(term) ||
                (doc.supplierName || "").toLowerCase().includes(term) ||
                (doc.documentType || "").toLowerCase().includes(term) ||
                (doc.supplierCategory || "").toLowerCase().includes(term);

            // Supplier filter match
            const matchesSupplier =
                selectedSupplierFilter === "all" ||
                String(doc.supplierId) === selectedSupplierFilter;

            // Type filter match
            const matchesType =
                selectedTypeFilter === "all" ||
                (doc.documentType || "").toLowerCase().includes(selectedTypeFilter.toLowerCase());

            return matchesSearch && matchesSupplier && matchesType;
        });
    }, [documents, debouncedSearch, selectedSupplierFilter, selectedTypeFilter]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const totalDocs = documents.length;
        const contractsCount = documents.filter((d) => {
            const t = (d.documentType || "").toLowerCase();
            return t.includes("contract") || t.includes("agreement") || t.includes("sla");
        }).length;

        const complianceCount = documents.filter((d) => {
            const t = (d.documentType || "").toLowerCase();
            return t.includes("permit") || t.includes("2303") || t.includes("bir") || t.includes("dti") || t.includes("sec") || t.includes("accreditation");
        }).length;

        const distinctSuppliersWithDocs = new Set(documents.map((d) => d.supplierId)).size;

        return {
            totalDocs,
            contractsCount,
            complianceCount,
            distinctSuppliersWithDocs,
        };
    }, [documents]);

    // Group documents by supplier
    const groupedBySupplier = useMemo(() => {
        const map = new Map<number, { supplier: Supplier | null; supplierName: string; docs: SupplierDocumentItem[] }>();

        // 1. Initialize for all registered suppliers that match the filter
        registeredSuppliers.forEach((s) => {
            if (selectedSupplierFilter === "all" || String(s.id) === selectedSupplierFilter) {
                map.set(s.id, {
                    supplier: s,
                    supplierName: s.name,
                    docs: [],
                });
            }
        });

        // 2. Distribute filtered documents
        filteredDocuments.forEach((doc) => {
            const sId = Number(doc.supplierId);
            if (!map.has(sId)) {
                map.set(sId, {
                    supplier: null,
                    supplierName: doc.supplierName,
                    docs: [doc],
                });
            } else {
                map.get(sId)!.docs.push(doc);
            }
        });

        // Convert to array and filter out empty groups if a search term is present
        const result = Array.from(map.entries()).map(([supplierId, group]) => ({
            supplierId,
            ...group,
        }));

        if (debouncedSearch || selectedTypeFilter !== "all") {
            return result.filter((g) => g.docs.length > 0);
        }

        return result;
    }, [registeredSuppliers, filteredDocuments, selectedSupplierFilter, debouncedSearch, selectedTypeFilter]);

    // Pagination calculations
    const totalGroupPages = Math.max(1, Math.ceil(groupedBySupplier.length / GROUPS_PER_PAGE));
    const totalFlatPages = Math.max(1, Math.ceil(filteredDocuments.length / DOCS_PER_PAGE));

    const paginatedGrouped = useMemo(() => {
        const start = (groupPage - 1) * GROUPS_PER_PAGE;
        return groupedBySupplier.slice(start, start + GROUPS_PER_PAGE);
    }, [groupedBySupplier, groupPage]);

    const paginatedFlat = useMemo(() => {
        const start = (flatPage - 1) * DOCS_PER_PAGE;
        return filteredDocuments.slice(start, start + DOCS_PER_PAGE);
    }, [filteredDocuments, flatPage]);

    const toggleSupplierExpand = (id: number) => {
        setExpandedSupplierIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedSupplierIds(new Set(groupedBySupplier.map((g) => g.supplierId)));
    };

    const collapseAll = () => {
        setExpandedSupplierIds(new Set());
    };

    // Helper icon getter
    const getDocTypeIcon = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes("contract") || t.includes("agreement") || t.includes("sla")) return "fa-solid fa-file-contract text-pink-500";
        if (t.includes("quotation") || t.includes("proposal")) return "fa-solid fa-file-invoice-dollar text-pink-500";
        if (t.includes("permit") || t.includes("license")) return "fa-solid fa-certificate text-pink-500";
        if (t.includes("2303") || t.includes("bir") || t.includes("tax")) return "fa-solid fa-landmark text-pink-500";
        if (t.includes("nda")) return "fa-solid fa-shield-halved text-pink-500";
        return "fa-solid fa-file-lines text-slate-500";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Top KPI Summary Cards - Using 3D Flipping Cards Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fa-solid fa-file-lines mr-1"
                    header="Total Documents"
                    data={String(metrics.totalDocs)}
                    arrow="fa-solid fa-folder-open mr-1"
                    description="Files &amp; attachments"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Repository Overview"
                    backIcon="fa-solid fa-folder-open"
                    backDescription={`${metrics.totalDocs} total documents, contracts, permits, and price proposals archived across all commercial suppliers.`}
                    tooltip="Total archived supplier documentation"
                    badge={metrics.totalDocs > 0 ? "Active Archive" : "Empty"}
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fa-solid fa-file-contract mr-1"
                    header="Active Contracts"
                    data={String(metrics.contractsCount)}
                    arrow="fa-solid fa-file-signature mr-1"
                    description="Service agreements &amp; SLAs"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Contract Repository"
                    backIcon="fa-solid fa-file-contract"
                    backDescription={`${metrics.contractsCount} formal supply contracts, Master Service Agreements (MSAs), and signed SLAs on record.`}
                    tooltip="Signed supplier contracts on file"
                    badge="Agreements"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fa-solid fa-shield-check mr-1"
                    header="Tax &amp; Compliance"
                    data={String(metrics.complianceCount)}
                    arrow="fa-solid fa-certificate mr-1"
                    description="BIR 2303, DTI, Permits"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Regulatory Files"
                    backIcon="fa-solid fa-shield-check"
                    backDescription={`${metrics.complianceCount} verified compliance files including Mayor's permits, BIR 2303 certificates, and SEC/DTI registrations.`}
                    tooltip="Tax & legal compliance records"
                    badge="Verified"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fa-solid fa-building-circle-check mr-1"
                    header="Covered Suppliers"
                    data={`${metrics.distinctSuppliersWithDocs} / ${registeredSuppliers.length}`}
                    arrow="fa-solid fa-handshake mr-1"
                    description="Suppliers with docs"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Coverage Proportion"
                    backIcon="fa-solid fa-building-circle-check"
                    backDescription={`${metrics.distinctSuppliersWithDocs} out of ${registeredSuppliers.length} registered suppliers currently have at least one document or contract archived.`}
                    tooltip="Proportion of suppliers with documentation"
                    badge="Coverage"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
            </div>

            {/* 2. Control Panel & Filters Container (Neumorphic) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border-2 border-slate-300 dark:border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by supplier name, document title, or category..."
                        className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-pink-500/40 placeholder:text-slate-400 transition-all"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Supplier Filter */}
                    <select
                        value={selectedSupplierFilter}
                        onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                        className="px-3 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] text-xs font-bold text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                        <option value="all">All Suppliers ({registeredSuppliers.length})</option>
                        {registeredSuppliers.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                                {s.name}
                            </option>
                        ))}
                    </select>

                    {/* Document Type Filter */}
                    <select
                        value={selectedTypeFilter}
                        onChange={(e) => setSelectedTypeFilter(e.target.value)}
                        className="px-3 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] text-xs font-bold text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                        <option value="all">All Document Types</option>
                        <option value="contract">Contracts &amp; SLAs</option>
                        <option value="quotation">Quotations &amp; Proposals</option>
                        <option value="permit">Business Permits</option>
                        <option value="2303">BIR 2303 / Tax</option>
                        <option value="nda">NDAs</option>
                        <option value="accreditation">Accreditations</option>
                    </select>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-2xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                        <button
                            type="button"
                            onClick={() => setViewMode("grouped")}
                            className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all cursor-pointer ${
                                viewMode === "grouped"
                                    ? "bg-pink-500 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-pink-600"
                            }`}
                            title="Group by Supplier"
                        >
                            By Supplier
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("flat")}
                            className={`px-3 py-1 text-[11px] font-black rounded-xl transition-all cursor-pointer ${
                                viewMode === "flat"
                                    ? "bg-pink-500 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-pink-600"
                            }`}
                            title="All Documents List"
                        >
                            All Files
                        </button>
                    </div>

                    {/* Expand/Collapse (Only in grouped view) */}
                    {viewMode === "grouped" && (
                        <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#12131b] p-1 rounded-2xl border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                            <button
                                type="button"
                                onClick={expandAll}
                                className="px-2.5 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-pink-600 rounded-xl transition-colors cursor-pointer"
                            >
                                Expand
                            </button>
                            <button
                                type="button"
                                onClick={collapseAll}
                                className="px-2.5 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-pink-600 rounded-xl transition-colors cursor-pointer"
                            >
                                Collapse
                            </button>
                        </div>
                    )}

                    {/* Upload Document Action */}
                    <button
                        type="button"
                        onClick={() => {
                            setUploadInitialSupplierId(undefined);
                            setIsUploadModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.6),_3px_3px_8px_rgba(219,39,119,0.45)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Upload Document</span>
                    </button>

                    {/* Refresh */}
                    <button
                        type="button"
                        onClick={() => loadDocuments(true)}
                        disabled={isLoading || isRefreshing}
                        className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 border border-white/80 dark:border-white/[0.05] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),_2px_2px_6px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.6)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        title="Reload documents"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-pink-500" : ""}`} />
                    </button>
                </div>
            </div>

            {/* 3. Main Documents View */}
            {isLoading ? (
                <div className="p-12 sm:p-16 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center animate-spin">
                        <FileText className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        Loading contracts &amp; supplier documents...
                    </p>
                    <p className="text-xs text-slate-400">
                        Querying supplier document records and storage buckets
                    </p>
                </div>
            ) : documents.length === 0 ? (
                /* Primary Empty State - Zero documents recorded */
                <div className="p-10 sm:p-16 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/80 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_10px_rgba(0,0,0,0.55)] text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/90 dark:border-white/10 shadow-[inset_2.5px_2.5px_5px_rgba(163,177,198,0.4),_inset_-2.5px_-2.5px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2.5px_2.5px_6px_rgba(0,0,0,0.7)] flex items-center justify-center text-pink-500 mb-1 transition-transform duration-300 hover:scale-105">
                        <FolderKanban className="w-10 h-10" />
                    </div>
                    <div className="max-w-md space-y-1.5">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                            No Supplier Documents or Contracts Yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            No supplier contracts, quotation proposals, or compliance certificates have been recorded yet. Upload files for your suppliers to centralize all vendor records.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setUploadInitialSupplierId(undefined);
                            setIsUploadModalOpen(true);
                        }}
                        className="mt-2 px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(219,39,119,0.45)] active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Upload First Supplier Document</span>
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" />
                            Contracts &amp; SLAs
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" />
                            Quotations &amp; Proposals
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-pink-500" />
                            BIR 2303 &amp; Business Permits
                        </span>
                    </div>
                </div>
            ) : (viewMode === "grouped" && groupedBySupplier.length === 0) || (viewMode === "flat" && filteredDocuments.length === 0) ? (
                /* Filter & Search Empty State */
                <div className="p-10 sm:p-14 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/80 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_10px_rgba(0,0,0,0.55)] text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/90 dark:border-white/10 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.35),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.7)] flex items-center justify-center text-pink-500 mb-1">
                        <Search className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        No Matching Supplier Documents Found
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        No files matched your active query {debouncedSearch ? `"${debouncedSearch}"` : ""} or selected filters. Try clearing your search keywords or switching filter criteria.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm("");
                            setSelectedSupplierFilter("all");
                            setSelectedTypeFilter("all");
                        }}
                        className="mt-1 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : viewMode === "grouped" ? (
                /* Grouped by Supplier Accordion Layout */
                <div className="space-y-4">
                    <div className="space-y-4">
                        {paginatedGrouped.map((group) => {
                        const isExpanded = expandedSupplierIds.has(group.supplierId);
                        const hasDocs = group.docs.length > 0;

                        return (
                            <div
                                key={group.supplierId}
                                className="rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/80 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_10px_rgba(0,0,0,0.55)] overflow-hidden transition-all"
                            >
                                {/* Accordion Header */}
                                <div
                                    onClick={() => toggleSupplierExpand(group.supplierId)}
                                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors select-none"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.45)]">
                                            <Building2 className="w-5 h-5 drop-shadow" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                                    {group.supplierName}
                                                </h3>
                                                {group.supplier?.category && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ebf0f7] dark:bg-[#12131b] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]">
                                                        {group.supplier.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                                {group.supplier?.location || "Metro Manila"} • {group.supplier?.contact_person || "Contact on file"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        {/* Document Count Badge */}
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                                                hasDocs
                                                    ? "bg-pink-500 text-white shadow-xs"
                                                    : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                                            }`}
                                        >
                                            <Paperclip className="w-3.5 h-3.5" />
                                            <span>{group.docs.length} File{group.docs.length !== 1 ? "s" : ""}</span>
                                        </span>

                                        {/* Upload Button Shortcut for this supplier */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUploadInitialSupplierId(group.supplierId);
                                                setIsUploadModalOpen(true);
                                            }}
                                            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer transition-all"
                                            title={`Upload document for ${group.supplierName}`}
                                        >
                                            <PlusCircle className="w-4 h-4" />
                                        </button>

                                        {/* Expand Chevron */}
                                        <div className="p-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-500">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Content (Document Cards Grid) */}
                                {isExpanded && (
                                    <div className="p-4 sm:p-5 pt-0 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/40 dark:bg-[#12131f]/40">
                                        {!hasDocs ? (
                                            <div className="p-6 rounded-2xl bg-white/60 dark:bg-[#171926] border border-dashed border-slate-300 dark:border-white/10 text-center space-y-2 mt-4">
                                                <p className="text-xs text-slate-500">
                                                    No documents uploaded for this supplier yet.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUploadInitialSupplierId(group.supplierId);
                                                        setIsUploadModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 text-xs font-bold border border-pink-200 dark:border-pink-800/40 hover:bg-pink-100 transition-colors"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    <span>Upload First Document</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
                                                {group.docs.map((doc) => (
                                                    <div
                                                        key={doc.id}
                                                        className="p-4 rounded-2xl bg-white dark:bg-[#181a27] border border-slate-200/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.25)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-3 group"
                                                    >
                                                        <div>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center text-xs">
                                                                        <i className={getDocTypeIcon(doc.documentType)} />
                                                                    </div>
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40">
                                                                        {doc.documentType || "Document"}
                                                                    </span>
                                                                </div>

                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                                                </span>
                                                            </div>

                                                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-2 line-clamp-2 leading-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                                                {doc.fileName}
                                                            </h4>

                                                            {doc.summary && (
                                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                                    {doc.summary}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDoc(doc)}
                                                                className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] text-slate-700 dark:text-slate-200 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span>View</span>
                                                            </button>

                                                            <div className="flex items-center gap-1.5">
                                                                {(doc.fileUrl || doc.publicUrl) && (
                                                                    <a
                                                                        href={doc.fileUrl || doc.publicUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        download={doc.fileName}
                                                                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 transition-colors"
                                                                        title="Download File"
                                                                    >
                                                                        <Download className="w-3.5 h-3.5" />
                                                                    </a>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteDocument(doc)}
                                                                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                                                    title="Delete Document"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>

                    {/* Pagination for Grouped View */}
                    {groupedBySupplier.length > 0 && (
                        <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(163,177,198,0.25)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Showing{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {(groupPage - 1) * GROUPS_PER_PAGE + 1}
                                    </span>{" "}
                                    to{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {Math.min(groupPage * GROUPS_PER_PAGE, groupedBySupplier.length)}
                                    </span>{" "}
                                    of{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {groupedBySupplier.length}
                                    </span>{" "}
                                    suppliers
                                </span>
                            </div>

                            <Pagination
                                currentPage={groupPage}
                                totalPages={totalGroupPages}
                                onPageChange={setGroupPage}
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* Flat Document Grid Layout with Pagination */
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedFlat.map((doc) => (
                            <div
                                key={doc.id}
                                className="p-5 rounded-3xl bg-[#f0f4fa] dark:bg-[#151726] border border-white/80 dark:border-white/[0.06] shadow-[-5px_-5px_12px_rgba(255,255,255,0.85),_5px_5px_12px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_8px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-3 group"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40">
                                            {doc.documentType || "Document"}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                        </span>
                                    </div>

                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2 line-clamp-2 leading-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                        {doc.fileName}
                                    </h4>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                        <span className="font-bold truncate text-slate-700 dark:text-slate-300">
                                            {doc.supplierName}
                                        </span>
                                    </div>

                                    {doc.summary && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                                            {doc.summary}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(doc)}
                                        className="px-3.5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Preview Document</span>
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        {(doc.fileUrl || doc.publicUrl) && (
                                            <a
                                                href={doc.fileUrl || doc.publicUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={doc.fileName}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 transition-colors"
                                                title="Download File"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteDocument(doc)}
                                            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="Delete Document"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination for Flat View */}
                    {filteredDocuments.length > 0 && (
                        <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),_3px_3px_8px_rgba(163,177,198,0.25)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                    Showing{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {(flatPage - 1) * DOCS_PER_PAGE + 1}
                                    </span>{" "}
                                    to{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {Math.min(flatPage * DOCS_PER_PAGE, filteredDocuments.length)}
                                    </span>{" "}
                                    of{" "}
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {filteredDocuments.length}
                                    </span>{" "}
                                    documents
                                </span>
                            </div>

                            <Pagination
                                currentPage={flatPage}
                                totalPages={totalFlatPages}
                                onPageChange={setFlatPage}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 4. Modals */}
            {previewDoc && (
                <SupplierDocumentPreviewModal
                    isOpen={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                    document={previewDoc}
                />
            )}

            {isUploadModalOpen && (
                <UploadSupplierDocumentModal
                    isOpen={isUploadModalOpen}
                    onClose={() => setIsUploadModalOpen(false)}
                    suppliers={registeredSuppliers}
                    initialSupplierId={uploadInitialSupplierId}
                    onDocumentUploaded={() => {
                        loadDocuments(true);
                        if (onRefresh) onRefresh();
                    }}
                />
            )}
        </div>
    );
}
