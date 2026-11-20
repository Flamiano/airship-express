"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/services/client/supabase";
import Portal from "../client/Portal";
import AdminPurchaseOrderReviewModal from "./AdminPurchaseOrderReviewModal";
import {
    X,
    Maximize2,
    Minimize2,
    FileText,
    CheckCircle2,
    Clock,
    Search,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Store,
    DollarSign,
    Package,
    Building2,
    User,
    Calendar,
    ArrowUpRight,
    Layers,
    LayoutGrid,
    Table as TableIcon,
    AlertCircle,
    Check,
    ClipboardCheck,
    Eye,
    Tag,
    Loader2
} from "lucide-react";

export interface AllPurchaseOrderReviewsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPOUpdated?: () => void;
    initialPoToReview?: string | null;
}

export default function AllPurchaseOrderReviewsModal({
    isOpen,
    onClose,
    onPOUpdated,
    initialPoToReview,
}: AllPurchaseOrderReviewsModalProps) {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [viewMode, setViewMode] = useState<"table" | "cards">("table");
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "all">("pending");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(6);

    // Active single PO review modal
    const [activeReviewPOId, setActiveReviewPOId] = useState<string | null>(initialPoToReview || null);

    // Fetch POs
    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("purchase_orders")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            const parsed = (data || []).map((po: any) => {
                let itemsList: any[] = [];
                if (typeof po.items === "string") {
                    try {
                        itemsList = JSON.parse(po.items);
                    } catch {
                        itemsList = [];
                    }
                } else if (Array.isArray(po.items)) {
                    itemsList = po.items;
                }
                return {
                    ...po,
                    parsedItems: itemsList,
                };
            });

            setOrders(parsed);
        } catch (err: any) {
            console.error("Error fetching purchase orders for review:", err);
            toast.error("Failed to load purchase orders for review");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchOrders();
        }
    }, [isOpen, fetchOrders]);

    // Keyboard shortcut Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !activeReviewPOId) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, activeReviewPOId, onClose]);

    // Statistics Counts
    const stats = useMemo(() => {
        const pendingCount = orders.filter(
            (o) => (o.admin_approval || "").toLowerCase() !== "approved" && (o.status || "").toLowerCase() !== "cancelled"
        ).length;
        const approvedCount = orders.filter(
            (o) => (o.admin_approval || "").toLowerCase() === "approved"
        ).length;
        const totalPendingValue = orders
            .filter((o) => (o.admin_approval || "").toLowerCase() !== "approved" && (o.status || "").toLowerCase() !== "cancelled")
            .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

        return {
            pendingCount,
            approvedCount,
            totalCount: orders.length,
            totalPendingValue,
        };
    }, [orders]);

    // Filtered list
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            const adminStatus = (o.admin_approval || "pending").toLowerCase();
            const poStatus = (o.status || "").toLowerCase();

            // Status Tab Filtering
            if (statusFilter === "pending") {
                if (adminStatus === "approved" || poStatus === "cancelled") {
                    return false;
                }
            } else if (statusFilter === "approved") {
                if (adminStatus !== "approved") {
                    return false;
                }
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const poNum = (o.po_number || "").toLowerCase();
                const supName = (o.supplier_name || "").toLowerCase();
                const cat = (o.category || "").toLowerCase();
                const notes = (o.notes || "").toLowerCase();
                const itemNames = (o.parsedItems || [])
                    .map((i: any) => (i.item_name || i.name || "").toLowerCase())
                    .join(" ");

                if (
                    !poNum.includes(q) &&
                    !supName.includes(q) &&
                    !cat.includes(q) &&
                    !notes.includes(q) &&
                    !itemNames.includes(q)
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [orders, statusFilter, searchQuery]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredOrders.slice(startIndex, startIndex + pageSize);
    }, [filteredOrders, currentPage, pageSize]);

    // Reset current page when filter/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, pageSize]);

    if (!isOpen) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
                {/* Modal Container */}
                <div
                    className={`flex flex-col bg-[#ebf0f7] dark:bg-[#141624] text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-white/10 overflow-hidden transition-all duration-300 ${
                        isFullScreen
                            ? "fixed inset-0 w-screen h-screen rounded-none z-[9999]"
                            : "w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-[-16px_-16px_36px_rgba(255,255,255,0.9),_16px_16px_36px_rgba(163,177,198,0.4)] dark:shadow-[-8px_-8px_24px_rgba(255,255,255,0.02),_12px_12px_32px_rgba(0,0,0,0.8)]"
                    }`}
                >
                    {/* Header Bar */}
                    <div className="p-4 sm:p-5 bg-[#ebf0f7] dark:bg-[#141624] border-b-2 border-slate-300 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
                        {/* Title & Icon */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(219,39,119,0.4)]">
                                <ClipboardCheck className="w-5 h-5 drop-shadow" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                        Purchase Order Review Center
                                    </h2>
                                    <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40 shadow-xs">
                                        Admin Approvals
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                                    Review and verify candidate POs awaiting Administrative verification prior to Financial Approval.
                                </p>
                            </div>
                        </div>

                        {/* Top Controls */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {/* Refresh Button */}
                            <button
                                type="button"
                                onClick={fetchOrders}
                                disabled={isLoading}
                                className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                title="Refresh purchase orders"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-pink-500" : ""}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>

                            {/* Fullscreen Toggle */}
                            <button
                                type="button"
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
                                aria-label={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
                            >
                                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                <span className="hidden sm:inline">{isFullScreen ? "Exit Full" : "Full Screen"}</span>
                            </button>

                            {/* Close Modal */}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 sm:p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_5px_rgba(255,255,255,0.02),_2px_2px_5px_rgba(0,0,0,0.6)] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2)] transition-all cursor-pointer"
                                title="Close modal"
                                aria-label="Close modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Metric Cards (Neumorphic) */}
                    <div className="px-4 sm:px-6 pt-4 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0 bg-[#ebf0f7]/70 dark:bg-[#141624]/70">
                        {/* 1. Pending Admin Review */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider block">
                                    Pending Admin Review
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                    {stats.pendingCount}
                                </span>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>

                        {/* 2. Total Pending Amount */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider block">
                                    Pending Review Value
                                </span>
                                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate block max-w-[150px]">
                                    ₱{stats.totalPendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>

                        {/* 3. Approved by Admin */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
                                    Admin Approved
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                    {stats.approvedCount}
                                </span>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>

                        {/* 4. Total PO Volume */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                                    All Purchase Orders
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                    {stats.totalCount}
                                </span>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Controls Toolbar (Neumorphic) */}
                    <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        {/* Filter Tabs */}
                        <div className="flex items-center p-1 rounded-2xl bg-[#e2e8f0] dark:bg-[#11131e] border border-white/60 dark:border-white/5 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex-wrap">
                            <button
                                type="button"
                                onClick={() => setStatusFilter("pending")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                    statusFilter === "pending"
                                        ? "bg-[#ebf0f7] dark:bg-[#181a29] text-pink-600 dark:text-pink-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.05),_1px_1px_4px_rgba(0,0,0,0.5)]"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending Review ({stats.pendingCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("approved")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                    statusFilter === "approved"
                                        ? "bg-[#ebf0f7] dark:bg-[#181a29] text-emerald-600 dark:text-emerald-400 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.05),_1px_1px_4px_rgba(0,0,0,0.5)]"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved ({stats.approvedCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                    statusFilter === "all"
                                        ? "bg-[#ebf0f7] dark:bg-[#181a29] text-slate-800 dark:text-slate-200 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),_2px_2px_5px_rgba(163,177,198,0.35)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.05),_1px_1px_4px_rgba(0,0,0,0.5)]"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>All POs ({stats.totalCount})</span>
                            </button>
                        </div>

                        {/* Search & Layout Toggle */}
                        <div className="flex items-center gap-2">
                            {/* Inset Neumorphic Search Box */}
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search PO#, supplier, item..."
                                    className="w-full pl-9 pr-8 py-2 rounded-2xl text-xs font-semibold bg-[#e2e8f0] dark:bg-[#11131e] text-slate-900 dark:text-white placeholder:text-slate-400 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35),_inset_-2px_-2px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/5 outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* View Switch: Table vs Cards */}
                            <div className="flex items-center p-0.5 rounded-2xl bg-[#e2e8f0] dark:bg-[#11131e] border border-white/60 dark:border-white/5 shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.35),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("table")}
                                    className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === "table"
                                            ? "bg-[#ebf0f7] dark:bg-[#181a29] text-pink-600 dark:text-pink-400 shadow-[-2px_-2px_4px_rgba(255,255,255,0.9),_2px_2px_4px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.05),_1px_1px_4px_rgba(0,0,0,0.5)]"
                                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                                    title="Table view"
                                >
                                    <TableIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("cards")}
                                    className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === "cards"
                                            ? "bg-[#ebf0f7] dark:bg-[#181a29] text-pink-600 dark:text-pink-400 shadow-[-2px_-2px_4px_rgba(255,255,255,0.9),_2px_2px_4px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_3px_rgba(255,255,255,0.05),_1px_1px_4px_rgba(0,0,0,0.5)]"
                                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    }`}
                                    title="Card Grid view"
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#ebf0f7] dark:bg-[#161826] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0d0e14,inset_-3px_-3px_6px_#222533]">
                                    <Loader2 className="animate-spin h-6 w-6 text-pink-600 dark:text-pink-400" />
                                </div>
                                <span className="text-xs font-bold text-slate-500">Loading purchase orders for review...</span>
                            </div>
                        ) : paginatedOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-[#e5ebf4] dark:bg-[#14151e] shadow-[inset_4px_4px_8px_#ccd5e2,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#0c0d12,inset_-4px_-4px_8px_#1e202c] mb-3.5">
                                    <ClipboardCheck className="h-7 w-7 text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    No Purchase Orders Found
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                                    {searchQuery
                                        ? `No results match "${searchQuery}". Try a different keyword.`
                                        : statusFilter === "pending"
                                        ? "All caught up! No purchase orders currently require administrative review."
                                        : "No purchase orders in this status category."}
                                </p>
                            </div>
                        ) : viewMode === "table" ? (
                            /* Neumorphic Table View */
                            <div className="rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_10px_rgba(255,255,255,0.02),_3px_3px_12px_rgba(0,0,0,0.5)] overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[#e4ebf5] dark:bg-[#12131f] border-b border-slate-200/80 dark:border-white/5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                <th className="py-3.5 px-4">PO Number</th>
                                                <th className="py-3.5 px-4">Supplier</th>
                                                <th className="py-3.5 px-4">Line Items</th>
                                                <th className="py-3.5 px-4">Total Amount</th>
                                                <th className="py-3.5 px-4">Order Date</th>
                                                <th className="py-3.5 px-4">Admin Review</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                                            {paginatedOrders.map((po) => {
                                                const isAdminApproved = (po.admin_approval || "").toLowerCase() === "approved";
                                                const isAdminRejected = (po.admin_approval || "").toLowerCase() === "rejected";
                                                const totalItemsCount = po.parsedItems?.reduce(
                                                    (sum: number, i: any) => sum + (Number(i.quantity) || 1),
                                                    0
                                                ) || 1;

                                                return (
                                                    <tr
                                                        key={po.id}
                                                        className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors"
                                                    >
                                                        {/* PO Number */}
                                                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                            <div className="flex items-center gap-1.5">
                                                                <FileText className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                                                                <span className="text-pink-600 dark:text-pink-400 font-black">
                                                                    {po.po_number || `PO-${po.id}`}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Supplier */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="font-bold text-slate-900 dark:text-white">
                                                                {po.supplier_name || "General Supplier"}
                                                            </div>
                                                            {po.category && (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                                    {po.category}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Line Items */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span className="font-bold">
                                                                    {po.parsedItems?.length || 1} SKU{po.parsedItems?.length > 1 ? "s" : ""}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    ({totalItemsCount} units)
                                                                </span>
                                                            </div>
                                                            {po.parsedItems?.[0] && (
                                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] italic">
                                                                    {po.parsedItems[0].name || po.parsedItems[0].item_name}
                                                                    {po.parsedItems.length > 1 && ` +${po.parsedItems.length - 1} more`}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Total Amount */}
                                                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                                                            ₱{Number(po.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>

                                                        {/* Order Date */}
                                                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">
                                                            {po.created_at ? new Date(po.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                                        </td>

                                                        {/* Admin Review Badge */}
                                                        <td className="py-3.5 px-4">
                                                            {isAdminApproved ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-black">
                                                                    <Check className="w-3 h-3" />
                                                                    Approved
                                                                </span>
                                                            ) : isAdminRejected ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[11px] font-black">
                                                                    <X className="w-3 h-3" />
                                                                    Rejected
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-black animate-pulse">
                                                                    <Clock className="w-3 h-3" />
                                                                    Pending Review
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-3.5 px-4">
                                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                                {po.status || "Pending"}
                                                            </span>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-3.5 px-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveReviewPOId(po.po_number || String(po.id))}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                                                    !isAdminApproved
                                                                        ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(219,39,119,0.35)] hover:shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_12px_rgba(219,39,119,0.5)] active:scale-95"
                                                                        : "bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                                                                }`}
                                                            >
                                                                {!isAdminApproved ? (
                                                                    <>
                                                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                                                        <span>Review & Approve</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                        <span>View Details</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            /* Neumorphic Cards Grid View */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {paginatedOrders.map((po) => {
                                    const isAdminApproved = (po.admin_approval || "").toLowerCase() === "approved";
                                    const isAdminRejected = (po.admin_approval || "").toLowerCase() === "rejected";

                                    return (
                                        <div
                                            key={po.id}
                                            className="p-5 rounded-3xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-3px_-3px_10px_rgba(255,255,255,0.02),_3px_3px_12px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-4 hover:shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),_8px_8px_20px_rgba(163,177,198,0.45)] transition-all"
                                        >
                                            <div className="space-y-3">
                                                {/* Card Header */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className="font-mono text-xs font-black text-pink-600 dark:text-pink-400 bg-[#e2e8f0] dark:bg-[#11131e] px-2.5 py-1 rounded-xl shadow-[inset_1px_1px_3px_rgba(163,177,198,0.35),_inset_-1px_-1px_3px_rgba(255,255,255,0.85)] border border-white/60 dark:border-white/5 inline-block mb-1">
                                                            {po.po_number || `PO-${po.id}`}
                                                        </span>
                                                        <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                                                            {po.supplier_name || "General Supplier"}
                                                        </h4>
                                                    </div>

                                                    {/* Approval Badge */}
                                                    {isAdminApproved ? (
                                                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black shrink-0">
                                                            Approved
                                                        </span>
                                                    ) : isAdminRejected ? (
                                                        <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black shrink-0">
                                                            Rejected
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black shrink-0 animate-pulse">
                                                            Pending Review
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta Info */}
                                                <div className="p-3 rounded-2xl bg-[#e4ebf5]/70 dark:bg-[#11131e]/70 border border-slate-200/50 dark:border-white/5 space-y-1.5 text-xs">
                                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                                        <span>Items:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {po.parsedItems?.length || 1} SKU(s)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                                        <span>Order Date:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {po.created_at ? new Date(po.created_at).toLocaleDateString() : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                                        <span>Delivery:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "TBD"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-300/50 dark:border-white/5">
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">Total Value:</span>
                                                        <span className="font-black text-pink-600 dark:text-pink-400 text-sm">
                                                            ₱{Number(po.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <button
                                                type="button"
                                                onClick={() => setActiveReviewPOId(po.po_number || String(po.id))}
                                                className={`w-full py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                                    !isAdminApproved
                                                        ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[-2px_-2px_6px_rgba(255,255,255,0.7),_2px_2px_8px_rgba(219,39,119,0.35)] hover:shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_12px_rgba(219,39,119,0.5)] active:scale-95"
                                                        : "bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.85),_2px_2px_5px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)]"
                                                }`}
                                            >
                                                {!isAdminApproved ? (
                                                    <>
                                                        <ClipboardCheck className="w-4 h-4" />
                                                        <span>Review & Approve PO</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-4 h-4" />
                                                        <span>View Details</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pagination Footer (Neumorphic) */}
                    <div className="p-4 sm:px-6 bg-[#ebf0f7] dark:bg-[#141624] border-t-2 border-slate-300 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                        {/* Page info & size selector */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>
                                Showing{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                    {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                </strong>{" "}
                                to{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                    {Math.min(currentPage * pageSize, filteredOrders.length)}
                                </strong>{" "}
                                of{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                    {filteredOrders.length}
                                </strong>{" "}
                                purchase order{filteredOrders.length !== 1 ? "s" : ""}
                            </span>

                            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-slate-700">
                                <span>Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="px-2 py-1 rounded-xl text-xs font-bold bg-[#e2e8f0] dark:bg-[#11131e] text-slate-800 dark:text-slate-200 border border-white/60 dark:border-white/5 shadow-[inset_1px_1px_2px_rgba(163,177,198,0.35)] outline-none cursor-pointer"
                                >
                                    <option value={5}>5</option>
                                    <option value={6}>6</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                </select>
                            </div>
                        </div>

                        {/* Page Navigation Buttons */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-white/80 dark:border-white/5 shadow-[-2px_-2px_4px_rgba(255,255,255,0.85),_2px_2px_4px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all cursor-pointer"
                                    title="First Page"
                                >
                                    <ChevronsLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-white/80 dark:border-white/5 shadow-[-2px_-2px_4px_rgba(255,255,255,0.85),_2px_2px_4px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all cursor-pointer"
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>

                                {/* Page Number Pills */}
                                {Array.from({ length: totalPages }).map((_, idx) => {
                                    const pageNum = idx + 1;
                                    // Show first, last, and current +/- 1
                                    if (
                                        pageNum === 1 ||
                                        pageNum === totalPages ||
                                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                    ) {
                                        const isActive = pageNum === currentPage;
                                        return (
                                            <button
                                                key={pageNum}
                                                type="button"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                                                    isActive
                                                        ? "bg-gradient-to-tr from-pink-600 to-rose-600 text-white shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),_2px_2px_6px_rgba(219,39,119,0.4)]"
                                                        : "bg-[#ebf0f7] dark:bg-[#161826] text-slate-700 dark:text-slate-300 hover:text-pink-600 border border-white/80 dark:border-white/5 shadow-[-2px_-2px_4px_rgba(255,255,255,0.85),_2px_2px_4px_rgba(163,177,198,0.3)]"
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    } else if (
                                        pageNum === currentPage - 2 ||
                                        pageNum === currentPage + 2
                                    ) {
                                        return (
                                            <span
                                                key={pageNum}
                                                className="px-1 text-slate-400 dark:text-slate-500 font-bold"
                                            >
                                                …
                                            </span>
                                        );
                                    }
                                    return null;
                                })}

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-white/80 dark:border-white/5 shadow-[-2px_-2px_4px_rgba(255,255,255,0.85),_2px_2px_4px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all cursor-pointer"
                                    title="Next Page"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl text-xs font-bold bg-[#ebf0f7] dark:bg-[#161826] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-white/80 dark:border-white/5 shadow-[-2px_-2px_4px_rgba(255,255,255,0.85),_2px_2px_4px_rgba(163,177,198,0.3)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] transition-all cursor-pointer"
                                    title="Last Page"
                                >
                                    <ChevronsRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sub-modal: Single Purchase Order Review Modal */}
                {activeReviewPOId && (
                    <AdminPurchaseOrderReviewModal
                        isOpen={!!activeReviewPOId}
                        purchaseOrderId={activeReviewPOId}
                        poNumber={activeReviewPOId.toUpperCase().startsWith("PO-") ? activeReviewPOId : undefined}
                        onClose={() => setActiveReviewPOId(null)}
                        onPOUpdated={() => {
                            fetchOrders();
                            onPOUpdated?.();
                        }}
                    />
                )}
            </div>
        </Portal>
    );
}
