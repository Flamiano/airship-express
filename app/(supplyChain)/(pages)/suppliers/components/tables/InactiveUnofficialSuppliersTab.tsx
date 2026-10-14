"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
    Building2, 
    Search, 
    Filter, 
    MapPin, 
    Phone, 
    Mail, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Eye, 
    Video, 
    RefreshCw, 
    ShoppingBag, 
    FileText, 
    Sparkles, 
    Check, 
    ShieldAlert, 
    ShieldCheck, 
    SlidersHorizontal,
    ArrowUpDown,
    Tag,
    X,
    ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import { Supplier, PurchaseOrder } from "../../types";
import { SearchableDropdown, SearchableDropdownOption } from "../../../../components/ui/SearchableDropdown";
import { Pagination } from "../../../../components/global/pagination";
import { SetSupplierMeetingModal } from "../../../procurement/components/SetSupplierMeetingModal";
import { fetchSupplierMeetingsAction } from "../../../procurement/server/meeting-actions";
import { SupplierViewModal } from "../modals/SupplierViewModal";
import { SupplierReviewModal } from "../modals/SupplierReviewModal";
import type { PotentialSupplierItem } from "./PotentialSuppliersTab";

export interface InactiveSupplierItem extends Supplier {
    poCount?: number;
    quoteCount?: number;
    lastTransactionDate?: string | null;
    classification?: "inactive" | "unofficial_lead" | "pending_verification";
}

interface InactiveUnofficialSuppliersTabProps {
    onRefreshParent?: () => void;
    onViewPurchaseOrder?: (po: any) => void;
}

const ITEMS_PER_PAGE = 8;

export function InactiveUnofficialSuppliersTab({
    onRefreshParent,
    onViewPurchaseOrder,
}: InactiveUnofficialSuppliersTabProps) {
    const [suppliersList, setSuppliersList] = useState<InactiveSupplierItem[]>([]);
    const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusTypeFilter, setStatusTypeFilter] = useState<"all" | "inactive" | "unofficial_lead" | "pending_verification">("all");
    const [sortBy, setSortBy] = useState<"name" | "last_transaction" | "po_count">("last_transaction");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [currentPage, setCurrentPage] = useState(1);

    // Modals
    const [selectedViewSupplier, setSelectedViewSupplier] = useState<Supplier | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    // Supplier Review & Activation Modal State (Stage 3 equivalent)
    const [reviewActivationSupplier, setReviewActivationSupplier] = useState<PotentialSupplierItem | null>(null);

    const [selectedMeetingSupplier, setSelectedMeetingSupplier] = useState<any | null>(null);
    const [selectedMeetingForEdit, setSelectedMeetingForEdit] = useState<any | null>(null);
    const [meetingsList, setMeetingsList] = useState<any[]>([]);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

    const [isUpdatingStatusId, setIsUpdatingStatusId] = useState<number | null>(null);

    // Fetch inactive and unofficial suppliers alongside POs and Quotations
    const loadInactiveSuppliersData = async (silent = false) => {
        try {
            if (!silent) setIsLoading(true);

            // Fetch suppliers, purchase orders, quotations, and meetings in parallel
            const [suppliersRes, posRes, quotesRes, serverMeetingsRes] = await Promise.allSettled([
                supabase.from("suppliers").select("*").order("name"),
                supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
                supabase.from("supplier_quotations").select("*").order("created_at", { ascending: false }),
                fetchSupplierMeetingsAction(),
            ]);

            const allSuppliers: Supplier[] = (suppliersRes.status === "fulfilled" && suppliersRes.value?.data) ? suppliersRes.value.data : [];
            const pos: PurchaseOrder[] = (posRes.status === "fulfilled" && posRes.value?.data) ? posRes.value.data : [];
            const quotes: any[] = (quotesRes.status === "fulfilled" && quotesRes.value?.data) ? quotesRes.value.data : [];

            let fetchedMeetings: any[] = [];
            if (serverMeetingsRes.status === "fulfilled" && serverMeetingsRes.value?.success && Array.isArray(serverMeetingsRes.value.data)) {
                fetchedMeetings = serverMeetingsRes.value.data;
            } else {
                try {
                    const { data: clientMeetings } = await supabase
                        .from("supplier_meetings")
                        .select("*")
                        .order("meeting_date", { ascending: false });
                    if (clientMeetings && Array.isArray(clientMeetings)) {
                        fetchedMeetings = clientMeetings;
                    }
                } catch (cErr) {
                    console.warn("Client fallback for supplier_meetings notice:", cErr);
                }
            }
            setMeetingsList(fetchedMeetings);

            setAllPurchaseOrders(pos);

            // Filter inactive OR unofficial/unverified suppliers (Section 6)
            // Active verified suppliers must appear in Active Suppliers directory, not in Inactive & Unofficial Suppliers tab.
            const filtered = allSuppliers.filter((s) => {
                const isInactive = s.is_active === false || (s.status || "").toLowerCase() === "inactive";
                const notesLower = (s.notes || "").toLowerCase();
                
                // Explicit lead markers (do NOT match commercial term "Lead Time:")
                const hasExplicitLeadMarker = 
                    notesLower.includes("[manual potential supplier lead]") ||
                    notesLower.includes("[potential supplier lead]") ||
                    /(?<!\b(?:lead\s*time|leadtime))\b(potential lead|unofficial lead|sales lead|raw lead)\b/i.test(notesLower) ||
                    notesLower.includes("pending evaluation") ||
                    notesLower.includes("openstreetmap") ||
                    (s as any).verification_status === "unverified" ||
                    (s as any).verification_status === "lead";

                // Active and officially verified suppliers belong in active directory only
                if (!isInactive && !hasExplicitLeadMarker) {
                    return false;
                }

                return isInactive || hasExplicitLeadMarker;
            });

            // Map stats: PO count, Quote count, last transaction date, classification
            const enriched: InactiveSupplierItem[] = filtered.map((s) => {
                const sName = (s.name || "").toLowerCase().trim();
                const sId = Number(s.id);

                // Match purchase orders
                const matchedPOs = pos.filter((po) => {
                    const poSupId = po.supplier_id ? Number(po.supplier_id) : null;
                    const poSupName = (po.supplier_name || "").toLowerCase().trim();
                    return (poSupId && poSupId === sId) || (sName && poSupName === sName);
                });

                // Match quotations
                const matchedQuotes = quotes.filter((q) => {
                    const qSupId = q.supplier_id ? Number(q.supplier_id) : null;
                    const qSupName = (q.supplier_name || "").toLowerCase().trim();
                    return (qSupId && qSupId === sId) || (sName && qSupName === sName);
                });

                // Determine last transaction date
                const dates: number[] = [];
                matchedPOs.forEach((po) => {
                    if (po.created_at) dates.push(new Date(po.created_at).getTime());
                });
                matchedQuotes.forEach((q) => {
                    if (q.created_at) dates.push(new Date(q.created_at).getTime());
                });
                if (s.created_at) {
                    dates.push(new Date(s.created_at).getTime());
                }

                const lastTimestamp = dates.length > 0 ? Math.max(...dates) : null;
                const lastDateStr = lastTimestamp ? new Date(lastTimestamp).toISOString() : null;

                // Determine classification:
                // Active verified suppliers are never classified as unofficial leads
                const notesLower = (s.notes || "").toLowerCase();
                const isInactive = s.is_active === false || (s.status || "").toLowerCase() === "inactive";
                const hasLeadMarker = 
                    notesLower.includes("[manual potential supplier lead]") ||
                    notesLower.includes("[potential supplier lead]") ||
                    /(?<!\b(?:lead\s*time|leadtime))\b(potential lead|unofficial lead|sales lead|raw lead)\b/i.test(notesLower) ||
                    notesLower.includes("openstreetmap") ||
                    (s as any).verification_status === "unverified" ||
                    (s as any).verification_status === "lead";

                let classification: "inactive" | "unofficial_lead" | "pending_verification" = "inactive";
                if (notesLower.includes("pending evaluation") || (s as any).verification_status === "pending_verification") {
                    classification = "pending_verification";
                } else if (hasLeadMarker) {
                    classification = "unofficial_lead";
                } else if (isInactive) {
                    classification = "inactive";
                }

                return {
                    ...s,
                    poCount: matchedPOs.length,
                    quoteCount: matchedQuotes.length,
                    lastTransactionDate: lastDateStr,
                    classification,
                };
            });

            setSuppliersList(enriched);
        } catch (err: any) {
            console.error("Error loading inactive and unofficial suppliers:", err);
            toast.error("Failed to load inactive and unofficial suppliers.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInactiveSuppliersData();

        const channel = supabase
            .channel("inactive_suppliers_and_meetings_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_meetings" },
                () => {
                    loadInactiveSuppliersData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "suppliers" },
                () => {
                    loadInactiveSuppliersData(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Helper to check if there is an active (pending or scheduled) meeting for a supplier
    const getSupplierActiveMeeting = useCallback((supplier: Supplier | InactiveSupplierItem) => {
        const activeMeetings = (meetingsList || []).filter((m) => {
            const st = (m.status || "").toLowerCase().trim();
            return st === "scheduled" || st === "pending";
        });

        if (activeMeetings.length === 0) return null;

        const sIdNum = supplier.id && !isNaN(Number(supplier.id)) ? Number(supplier.id) : null;
        const sEmail = (supplier.email || "").toLowerCase().trim();
        const sName = (supplier.name || "").toLowerCase().trim();
        const sClean = sName.split(" - ")[0].split(" (")[0].trim();

        return activeMeetings.find((m) => {
            const mIdNum = m.supplier_id ? Number(m.supplier_id) : null;
            const matchesId = Boolean(sIdNum && mIdNum && sIdNum === mIdNum);
            const mEmail = (m.supplier_email || "").toLowerCase().trim();
            const matchesEmail = Boolean(sEmail && mEmail && sEmail === mEmail);
            const mName = (m.supplier_name || "").toLowerCase().trim();
            const mClean = mName.split(" - ")[0].split(" (")[0].trim();
            const matchesName = Boolean(
                (sName && mName && sName === mName) ||
                (sClean && mClean && (sClean === mClean || mName.includes(sClean) || sName.includes(mClean)))
            );
            return matchesId || matchesEmail || matchesName;
        }) || null;
    }, [meetingsList]);

    // Unique categories from list
    const categories = useMemo(() => {
        const set = new Set<string>();
        suppliersList.forEach((s) => {
            if (s.category) set.add(s.category);
        });
        return Array.from(set).sort();
    }, [suppliersList]);

    const categoryOptions: SearchableDropdownOption[] = useMemo(() => {
        return [
            { value: "all", label: "All Categories", icon: "fas fa-layer-group" },
            ...categories.map((cat) => ({
                value: cat,
                label: cat,
                icon: "fas fa-tags",
            })),
        ];
    }, [categories]);

    // Filter and Sort
    const filteredAndSortedSuppliers = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();

        return suppliersList
            .filter((s) => {
                // Search filter
                if (query) {
                    const name = (s.name || "").toLowerCase();
                    const category = (s.category || "").toLowerCase();
                    const contact = (s.contact_person || "").toLowerCase();
                    const email = (s.email || "").toLowerCase();
                    const phone = (s.phone || "").toLowerCase();
                    const location = (s.location || "").toLowerCase();
                    const products = (s.products || "").toLowerCase();
                    const notes = (s.notes || "").toLowerCase();

                    const matches =
                        name.includes(query) ||
                        category.includes(query) ||
                        contact.includes(query) ||
                        email.includes(query) ||
                        phone.includes(query) ||
                        location.includes(query) ||
                        products.includes(query) ||
                        notes.includes(query);

                    if (!matches) return false;
                }

                // Category filter
                if (categoryFilter !== "all" && s.category !== categoryFilter) {
                    return false;
                }

                // Classification / statusType filter
                if (statusTypeFilter !== "all" && s.classification !== statusTypeFilter) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                let comparison = 0;
                if (sortBy === "name") {
                    comparison = (a.name || "").localeCompare(b.name || "");
                } else if (sortBy === "last_transaction") {
                    const timeA = a.lastTransactionDate ? new Date(a.lastTransactionDate).getTime() : 0;
                    const timeB = b.lastTransactionDate ? new Date(b.lastTransactionDate).getTime() : 0;
                    comparison = timeA - timeB;
                } else if (sortBy === "po_count") {
                    comparison = (a.poCount || 0) - (b.poCount || 0);
                }

                return sortOrder === "asc" ? comparison : -comparison;
            });
    }, [suppliersList, searchTerm, categoryFilter, statusTypeFilter, sortBy, sortOrder]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedSuppliers.length / ITEMS_PER_PAGE));
    const paginatedSuppliers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedSuppliers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedSuppliers, currentPage]);

    // Toggle active status (Supplier Activation & Verification Workflow)
    const handleToggleActivation = async (supplier: InactiveSupplierItem) => {
        try {
            setIsUpdatingStatusId(supplier.id);
            const newActiveState = !supplier.is_active;

            // Clean notes if activating from potential/lead
            let updatedNotes = supplier.notes || "";
            if (newActiveState) {
                updatedNotes = updatedNotes
                    .replace(/\[Status:\s*Potential[^\]]*\]/gi, "")
                    .replace(/Status:\s*Potential\s*\|\s*/gi, "")
                    .trim();
            }

            const { error } = await supabase
                .from("suppliers")
                .update({ 
                    is_active: newActiveState,
                    notes: updatedNotes,
                    updated_at: new Date().toISOString()
                })
                .eq("id", supplier.id);

            if (error) throw error;

            toast.success(
                newActiveState
                    ? `Supplier "${supplier.name}" has been activated and verified as an official vendor.`
                    : `Supplier "${supplier.name}" is now marked inactive.`
            );

            loadInactiveSuppliersData(true);
            onRefreshParent?.();
        } catch (err: any) {
            console.error("Error updating supplier activation:", err);
            toast.error(err.message || "Failed to update supplier status.");
        } finally {
            setIsUpdatingStatusId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Card & Filter Bar */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center justify-center font-bold text-base shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35)]">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    Inactive &amp; Unofficial Suppliers Directory
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30">
                                    {suppliersList.length} Total
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                Audit transaction histories, schedule verification meetings, and manage vendor records pending official activation.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => loadInactiveSuppliersData(true)}
                        className="p-2.5 px-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1c2c] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.06] cursor-pointer flex items-center gap-2 self-start sm:self-auto"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
                        <span className="text-xs font-black">Refresh</span>
                    </button>
                </div>

                {/* Filter and Search Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search inactive/unofficial suppliers..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full py-2 pl-9 pr-3 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                        />
                    </div>

                    {/* Category Filter */}
                    <div>
                        <SearchableDropdown
                            value={categoryFilter}
                            onChange={(val) => {
                                setCategoryFilter(val);
                                setCurrentPage(1);
                            }}
                            options={categoryOptions}
                            placeholder="All Categories"
                        />
                    </div>

                    {/* Sub-status Classification Filter */}
                    <div className="flex items-center gap-1 bg-[#ebf0f7] dark:bg-[#14151c] p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)]">
                        <button
                            type="button"
                            onClick={() => {
                                setStatusTypeFilter("all");
                                setCurrentPage(1);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center cursor-pointer ${
                                statusTypeFilter === "all"
                                    ? "bg-pink-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusTypeFilter("inactive");
                                setCurrentPage(1);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center cursor-pointer ${
                                statusTypeFilter === "inactive"
                                    ? "bg-pink-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                        >
                            Inactive
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusTypeFilter("unofficial_lead");
                                setCurrentPage(1);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center cursor-pointer ${
                                statusTypeFilter === "unofficial_lead"
                                    ? "bg-pink-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                        >
                            Leads
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusTypeFilter("pending_verification");
                                setCurrentPage(1);
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center cursor-pointer ${
                                statusTypeFilter === "pending_verification"
                                    ? "bg-pink-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                        >
                            Verification
                        </button>
                    </div>

                    {/* Sorting Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="flex-1 py-2 px-3 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35)] rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="last_transaction">Sort: Last Transaction</option>
                            <option value="po_count">Sort: Orders Count</option>
                            <option value="name">Sort: Supplier Name</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                            className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1c2c] text-slate-600 dark:text-slate-300 hover:text-pink-600 border border-white/60 dark:border-white/[0.06] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] active:scale-95 cursor-pointer"
                            title={`Toggle Order (${sortOrder.toUpperCase()})`}
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Suppliers Cards / Table Grid */}
            {isLoading ? (
                <div className="p-12 text-center space-y-3 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c]">
                    <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Loading inactive and unofficial suppliers...</p>
                </div>
            ) : filteredAndSortedSuppliers.length === 0 ? (
                <div className="p-12 text-center space-y-3 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[inset_2px_2px_6px_rgba(163,177,198,0.25)]">
                    <Building2 className="w-10 h-10 text-slate-400 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        No inactive or unofficial suppliers found
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No suppliers match your current search and filter criteria. Try resetting the filters above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3.5">
                        {paginatedSuppliers.map((supplier) => {
                            const isInactive = supplier.is_active === false;
                            const isLead = supplier.classification === "unofficial_lead";
                            const isPending = supplier.classification === "pending_verification";

                            return (
                                <div
                                    key={supplier.id}
                                    className="p-4 sm:p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#151724] border border-white/90 dark:border-white/10 shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_10px_rgba(255,255,255,0.02),_6px_6px_16px_rgba(0,0,0,0.6)] hover:border-pink-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    {/* Left: Supplier Info & Classification Badges */}
                                    <div className="space-y-2 min-w-0 flex-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)]">
                                                <Building2 className="w-4 h-4" />
                                            </div>

                                            <div>
                                                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                                    {supplier.name}
                                                </h3>
                                                <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                    <span>{supplier.category || "General Supplies"}</span>
                                                    <span>•</span>
                                                    <span className="font-mono text-pink-600 dark:text-pink-400">
                                                        SUP-{String(supplier.id).padStart(3, "0")}
                                                    </span>
                                                </p>
                                            </div>

                                            {/* Status Badges */}
                                            <div className="flex items-center gap-1.5 flex-wrap ml-auto md:ml-2">
                                                {isInactive ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Inactive Status
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Active Record
                                                    </span>
                                                )}

                                                {isPending ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Pending Verification
                                                    </span>
                                                ) : isLead ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" />
                                                        Unofficial Lead
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Contacts & Location */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <MapPin className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                <span className="truncate">{supplier.location || "Metro Manila, Philippines"}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Phone className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                <span className="truncate">{supplier.phone || "No phone listed"}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Mail className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                <span className="truncate">{supplier.email || "No email listed"}</span>
                                            </div>
                                        </div>

                                        {/* Products & Services Preview */}
                                        {(supplier.products || supplier.services_offered) && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">Offers: </span>
                                                {supplier.products || (Array.isArray(supplier.services_offered) ? supplier.services_offered.join(", ") : supplier.services_offered)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Middle: Transactions History Summary */}
                                    <div className="flex items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-slate-300/70 dark:border-white/10 pt-3 md:pt-0 md:pl-5 shrink-0 flex-wrap sm:flex-nowrap">
                                        <div className="text-center sm:text-left">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                                Purchase Orders
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <ShoppingBag className="w-3.5 h-3.5 text-pink-600" />
                                                <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                                                    {supplier.poCount || 0}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-center sm:text-left">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                                Quotations
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <FileText className="w-3.5 h-3.5 text-pink-600" />
                                                <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                                                    {supplier.quoteCount || 0}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-center sm:text-left">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                                Last Transaction
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mt-0.5 font-mono">
                                                {supplier.lastTransactionDate
                                                    ? new Date(supplier.lastTransactionDate).toLocaleDateString()
                                                    : "None Recorded"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Available Actions */}
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-300/70 dark:border-white/10">
                                        {/* View Details & Full History */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedViewSupplier(supplier);
                                                setIsViewModalOpen(true);
                                            }}
                                            className="px-3 py-2 rounded-xl bg-[#e8ecf4] dark:bg-[#1a1c2d] text-slate-700 dark:text-slate-200 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] flex items-center gap-1.5 cursor-pointer border border-white/60 dark:border-white/10"
                                            title="View Supplier Profile & Full Transaction History"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-pink-500" />
                                            <span>Details &amp; History</span>
                                        </button>

                                        {/* Set / Update Meeting (Does NOT auto-activate) */}
                                        {(() => {
                                            const existingMeeting = getSupplierActiveMeeting(supplier);
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedMeetingSupplier({
                                                            id: supplier.id,
                                                            name: supplier.name,
                                                            email: supplier.email,
                                                            phone: supplier.phone,
                                                            contact_person: supplier.contact_person,
                                                        });
                                                        setSelectedMeetingForEdit(existingMeeting);
                                                        setIsMeetingModalOpen(true);
                                                    }}
                                                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                                        existingMeeting
                                                            ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 border border-pink-500/40 hover:bg-pink-100 dark:hover:bg-pink-900/50 shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_5px_rgba(163,177,198,0.3)]"
                                                            : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(219,39,119,0.35)]"
                                                    }`}
                                                    title={
                                                        existingMeeting
                                                            ? `Update scheduled meeting with ${supplier.name} (${existingMeeting.meeting_date} @ ${existingMeeting.start_time})`
                                                            : "Schedule verification or evaluation meeting with supplier"
                                                    }
                                                >
                                                    <Video className={`w-3.5 h-3.5 ${existingMeeting ? "text-pink-600 dark:text-pink-400" : "text-pink-200"}`} />
                                                    <span>{existingMeeting ? "Update" : "Set Meeting"}</span>
                                                </button>
                                            );
                                        })()}

                                        {/* Review & Activate (Supplier Review & Activation Modal - Same as Stage 3) */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const mappedPotentialSupplier: PotentialSupplierItem = {
                                                    id: String(supplier.id),
                                                    dbSupplierId: Number(supplier.id),
                                                    name: supplier.name,
                                                    category: supplier.category || "General",
                                                    location: supplier.location || (supplier as any).address || "Manila, Philippines",
                                                    phone: supplier.phone || "",
                                                    email: supplier.email || "",
                                                    website: supplier.website || "",
                                                    contact_person: supplier.contact_person || "",
                                                    products: supplier.products || (Array.isArray((supplier as any).other_products_offer) ? (supplier as any).other_products_offer.map((p: any) => p.item_name).join(", ") : ""),
                                                    notes: supplier.notes || "",
                                                    coords: { lat: 14.5995, lng: 120.9842, displayName: supplier.location || "Metro Manila" },
                                                    distanceKm: 0,
                                                    source: "inactive-suppliers",
                                                    matchLevel: "exact",
                                                    isSavedInDB: true,
                                                };
                                                setReviewActivationSupplier(mappedPotentialSupplier);
                                            }}
                                            className="px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-pink-600 hover:bg-pink-500 text-white shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(219,39,119,0.35)]"
                                            title="Open Supplier Review & Activation Modal"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5 text-pink-200" />
                                            <span>Verify &amp; Activate</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pt-2">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* View Supplier Modal (Enhanced with Full Transaction History) */}
            {isViewModalOpen && selectedViewSupplier && (
                <SupplierViewModal
                    isOpen={isViewModalOpen}
                    supplier={selectedViewSupplier}
                    purchaseOrders={allPurchaseOrders}
                    onClose={() => {
                        setIsViewModalOpen(false);
                        setSelectedViewSupplier(null);
                    }}
                    onEdit={() => {}}
                    onDelete={async (id, name) => {
                        try {
                            const { error } = await supabase.from("suppliers").delete().eq("id", id);
                            if (error) throw error;
                            toast.success(`Supplier "${name}" deleted.`);
                            setIsViewModalOpen(false);
                            setSelectedViewSupplier(null);
                            loadInactiveSuppliersData(true);
                            onRefreshParent?.();
                        } catch (err: any) {
                            toast.error(err.message || "Failed to delete supplier.");
                        }
                    }}
                    onScheduleMeeting={(sup) => {
                        const existing = getSupplierActiveMeeting(sup);
                        setSelectedMeetingSupplier({
                            id: sup.id,
                            name: sup.name,
                            email: sup.email,
                            phone: sup.phone,
                            contact_person: sup.contact_person,
                        });
                        setSelectedMeetingForEdit(existing);
                        setIsMeetingModalOpen(true);
                    }}
                />
            )}

            {/* Supplier Review & Activation Modal (Same as Stage 3) */}
            <SupplierReviewModal
                isOpen={!!reviewActivationSupplier}
                onClose={() => setReviewActivationSupplier(null)}
                supplier={reviewActivationSupplier}
                onSupplierActivated={() => {
                    setReviewActivationSupplier(null);
                    loadInactiveSuppliersData(true);
                    onRefreshParent?.();
                }}
            />

            {/* Set Supplier Meeting Modal (Does NOT auto-activate supplier) */}
            {isMeetingModalOpen && selectedMeetingSupplier && (
                <SetSupplierMeetingModal
                    isOpen={isMeetingModalOpen}
                    supplier={selectedMeetingSupplier}
                    meeting={selectedMeetingForEdit}
                    onClose={() => {
                        setIsMeetingModalOpen(false);
                        setSelectedMeetingSupplier(null);
                        setSelectedMeetingForEdit(null);
                    }}
                    onMeetingScheduled={() => {
                        setIsMeetingModalOpen(false);
                        setSelectedMeetingSupplier(null);
                        setSelectedMeetingForEdit(null);
                        toast.success("Supplier verification meeting scheduled successfully.");
                        loadInactiveSuppliersData(true);
                    }}
                    onMeetingRemoved={() => {
                        setIsMeetingModalOpen(false);
                        setSelectedMeetingSupplier(null);
                        setSelectedMeetingForEdit(null);
                        toast.success("Scheduled meeting removed successfully.");
                        loadInactiveSuppliersData(true);
                    }}
                />
            )}
        </div>
    );
}
