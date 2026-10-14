"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
    AlertTriangle, 
    Search, 
    Boxes, 
    DollarSign, 
    Store, 
    RefreshCw, 
    CheckCircle2, 
    ArrowRight,
    MapPin,
    Tag,
    MessageSquare,
    ShoppingCart,
    Send,
    Eye,
    X,
    Info,
    FileText,
    Building2,
    Calendar,
    Phone,
    Mail,
    User,
    ChevronDown,
    ChevronRight,
    Layers,
    RotateCw
} from "lucide-react";
import { StockShortageItem } from "../types/index";
import Cards from "../../../components/global/Cards";
import { Pagination } from "../../../components/global/pagination";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";
import { CrudActionButton } from "../../../components/ui/CrudActionButton";

interface StageStockShortagesProps {
    shortages: StockShortageItem[];
    isLoading: boolean;
    onFindSuppliersForItem: (shortageItem: StockShortageItem) => void;
    onRefresh: () => void;
    onMessageSupplier?: (supplier: any, shortageItem?: StockShortageItem) => void;
    onCreatePO?: (shortageItem: StockShortageItem, supplier?: any) => void;
    onOrderAgainFromSameSupplier?: (shortageItem: StockShortageItem, supplierName: string) => void;
}

const formatCurrency = (amount: number) => `₱${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function StageStockShortages({
    shortages,
    isLoading,
    onFindSuppliersForItem,
    onRefresh,
    onMessageSupplier,
    onCreatePO,
    onOrderAgainFromSameSupplier,
}: StageStockShortagesProps) {
    // 1. Search Debouncing State
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // 2. Filters & Pagination State
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "out-of-stock" | "low-stock">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // 3. View Details Modal State
    const [viewItem, setViewItem] = useState<StockShortageItem | null>(null);

    // 4. Expandable Detail Rows for Grouped Items State
    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());

    const toggleRowExpansion = (key: string) => {
        setExpandedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Debounce search input by 300ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
            setCurrentPage(1);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchInput]);

    // Metrics calculations
    const metrics = useMemo(() => {
        const outOfStockCount = shortages.filter((s) => {
            const stock = s.usable_stock !== undefined ? s.usable_stock : s.current_stock;
            return stock === 0 || s.status === "out-of-stock";
        }).length;
        const lowStockCount = shortages.filter((s) => {
            const stock = s.usable_stock !== undefined ? s.usable_stock : s.current_stock;
            return stock > 0 && (stock <= s.minimum_stock || s.status === "low-stock");
        }).length;
        const totalShortageCost = shortages.reduce((sum, s) => {
            const hasAnySupplier = Boolean(
                s.has_official_active_supplier ||
                s.matched_active_supplier?.name ||
                s.supplier ||
                s.previous_supplier
            );
            if (!hasAnySupplier) return sum;
            const remDeficit = s.remaining_deficit !== undefined ? s.remaining_deficit : s.deficit;
            const unitPrice = Number(s.purchase_price || s.previous_unit_price || 0);
            const cost = unitPrice > 0 ? (remDeficit * unitPrice) : (Number(s.estimated_reorder_cost) || 0);
            return sum + cost;
        }, 0);

        return {
            totalShortages: shortages.length,
            outOfStockCount,
            lowStockCount,
            totalShortageCost,
        };
    }, [shortages]);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        shortages.forEach((s) => {
            if (s.category) set.add(s.category);
        });
        return Array.from(set);
    }, [shortages]);

    // Filtered Shortages
    const filteredShortages = useMemo(() => {
        const q = debouncedSearch.toLowerCase().trim();
        return shortages.filter((item) => {
            const matchesSearch =
                !q ||
                (item.item_name || "").toLowerCase().includes(q) ||
                (item.item_code || "").toLowerCase().includes(q) ||
                (item.category || "").toLowerCase().includes(q) ||
                (item.source_request || "").toLowerCase().includes(q) ||
                (item.source_department || "").toLowerCase().includes(q) ||
                (item.supplier || "").toLowerCase().includes(q) ||
                (item.previous_supplier || "").toLowerCase().includes(q) ||
                (item.storage_location || "").toLowerCase().includes(q) ||
                (item.related_requests && item.related_requests.some((r) =>
                    (r.request_number || "").toLowerCase().includes(q) ||
                    (r.item_name || "").toLowerCase().includes(q) ||
                    (r.department || "").toLowerCase().includes(q)
                )) ||
                (item.covering_purchase_orders && item.covering_purchase_orders.some((po) =>
                    (po.po_number || "").toLowerCase().includes(q) ||
                    (po.supplier_name || "").toLowerCase().includes(q)
                ));

            const matchesCategory =
                categoryFilter === "all" ||
                (item.category || "").toLowerCase() === categoryFilter.toLowerCase();

            const stock = item.usable_stock !== undefined ? item.usable_stock : item.current_stock;
            const isZero = stock === 0 || item.status === "out-of-stock";
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "out-of-stock" && isZero) ||
                (statusFilter === "low-stock" && !isZero);

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [shortages, debouncedSearch, categoryFilter, statusFilter]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredShortages.length / pageSize));
    const paginatedShortages = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredShortages.slice(start, start + pageSize);
    }, [filteredShortages, currentPage, pageSize]);

    const handleCategoryChange = (val: string) => {
        setCategoryFilter(val);
        setCurrentPage(1);
    };

    const handleStatusChange = (val: "all" | "out-of-stock" | "low-stock") => {
        setStatusFilter(val);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* 1. Top KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Total Shortages"
                    data={String(metrics.totalShortages)}
                    arrow="fas fa-triangle-exclamation mr-1"
                    description="Reorder required"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Shortage Details"
                    backIcon="fas fa-boxes-stacked"
                    backDescription={`${metrics.totalShortages} items currently have warehouse stock below minimum thresholds or are fully depleted.`}
                    tooltip="Inventory items below safety buffer levels"
                    badge={metrics.totalShortages > 0 ? "Action Required" : "Optimal"}
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-circle-exclamation mr-1"
                    header="Out of Stock"
                    data={String(metrics.outOfStockCount)}
                    arrow="fas fa-arrow-down mr-1"
                    description="Zero warehouse stock"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Stockout Alert"
                    backIcon="fas fa-circle-exclamation"
                    backDescription={`${metrics.outOfStockCount} items have zero available quantity in storage. Immediate vendor reordering needed.`}
                    tooltip="Critical stockouts requiring urgent procurement"
                    badge={metrics.outOfStockCount > 0 ? "Critical" : "Clear"}
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
                <Cards
                    frontIcon="fas fa-battery-quarter mr-1"
                    header="Low Stock Buffer"
                    data={String(metrics.lowStockCount)}
                    arrow="fas fa-shield-halved mr-1"
                    description="Below safety threshold"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Buffer Deficit"
                    backIcon="fas fa-battery-quarter"
                    backDescription={`${metrics.lowStockCount} items have positive stock remaining but have dropped below reorder buffer levels.`}
                    tooltip="Items nearing depletion"
                    badge="Warning"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
                <Cards
                    frontIcon="fas fa-peso-sign mr-1"
                    header="Replenishment Cost"
                    data={formatCurrency(metrics.totalShortageCost)}
                    arrow="fas fa-coins mr-1"
                    description="Est. procurement spend"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Procurement Budget"
                    backIcon="fas fa-peso-sign"
                    backDescription={`Total estimated expenditure of ${formatCurrency(metrics.totalShortageCost)} to restore all warehouse items to recommended stock levels.`}
                    tooltip="Estimated total replenishment value"
                    badge="Estimate"
                    frontTextColor="text-slate-500 dark:text-slate-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />
            </div>

            {/* 2. Stock Shortages Table Container */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] shadow-[-6px_-6px_16px_rgba(255,255,255,0.85),_6px_6px_16px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),_2px_2px_10px_rgba(0,0,0,0.55)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-pink-500" />
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                Warehouse Stock Shortages &amp; Inventory Deficits
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Showing all inventory items with low stock and out-of-stock statuses requiring vendor replenishment.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onRefresh}
                        className="p-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1c2c] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold transition-all shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.06] cursor-pointer flex items-center gap-1.5"
                        title="Refresh Shortages"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="text-xs font-bold hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {/* Filters with Debounced Search */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search item, code, department, supplier, or location..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),_inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),_inset_-2px_-2px_5px_rgba(255,255,255,0.02)] transition-all"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                            value={categoryFilter}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-extrabold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => handleStatusChange(e.target.value as any)}
                            className="px-3.5 py-2.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-extrabold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.35),_inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] cursor-pointer"
                        >
                            <option value="all">All Severity</option>
                            <option value="out-of-stock">Out of Stock Only</option>
                            <option value="low-stock">Low Stock Only</option>
                        </select>
                    </div>
                </div>

                {/* Structured Multi-Column Table */}
                <div className="overflow-x-auto rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),_3px_3px_8px_rgba(163,177,198,0.3)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                    <table className="min-w-[1380px] w-full text-left border-collapse text-xs table-fixed">
                        <thead>
                            <tr className="bg-[#e2e8f0]/80 dark:bg-[#10121d] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200/70 dark:border-white/[0.06]">
                                <th className="py-3 px-4 w-[230px]">Item Code &amp; Name</th>
                                <th className="py-3 px-3 w-[150px]">Source Request / Dept</th>
                                <th className="py-3 px-3 w-[180px]">Supplier &amp; Sourcing</th>
                                <th className="py-3 px-3 w-[130px]">Category</th>
                                <th className="py-3 px-3 w-[120px]">Location</th>
                                <th className="py-3 px-3 w-[130px]">Stock Level</th>
                                <th className="py-3 px-3 w-[120px]">Approved Demand</th>
                                <th className="py-3 px-3 w-[130px]">Deficit</th>
                                <th className="py-3 px-3 w-[120px]">Est. Cost</th>
                                <th className="py-3 px-4 text-right w-[160px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                            {paginatedShortages.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-pink-500 opacity-80" />
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Shortages Found</p>
                                        <p className="text-[11px] mt-0.5">All warehouse parts and supplies match your filter or are within safe inventory levels.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedShortages.map((item, index) => {
                                    const rowKey = String(item.id || item.item_name || index);
                                    const isExpanded = expandedRowKeys.has(rowKey);

                                    const approvedDemand = item.total_approved_demand ?? item.requested_demand ?? item.deficit;
                                    const usableStock = item.usable_stock !== undefined ? item.usable_stock : item.current_stock;
                                    const isPoDelivered =
                                        item.po_status_indicator === 'Delivered' ||
                                        (item.covering_purchase_orders && item.covering_purchase_orders.length > 0 && item.covering_purchase_orders.every(po => {
                                            const s = (po.status || "").toLowerCase();
                                            return s === "delivered" || s === "completed" || s === "received" || s === "fulfilled";
                                        }));
                                    const poCoverage = isPoDelivered ? 0 : (item.active_po_coverage ?? item.covered_quantity ?? 0);
                                    const remDeficit = item.remaining_deficit !== undefined ? item.remaining_deficit : item.deficit;

                                    const isZero = usableStock === 0 || item.status === "out-of-stock";
                                    const supplierName = item.matched_active_supplier?.name || item.supplier || item.previous_supplier || "";
                                    const hasExpandableContent = (item.related_requests && item.related_requests.length > 0) || (item.covering_purchase_orders && item.covering_purchase_orders.length > 0);

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors border-b border-slate-200/60 dark:divide-white/[0.05]">
                                                {/* Column 1: Item Code & Name (With Expandable Toggle) */}
                                                <td className="py-3.5 px-4 w-[230px]">
                                                    <div className="flex items-start gap-2">
                                                        {hasExpandableContent ? (
                                                             <button
                                                                type="button"
                                                                onClick={() => toggleRowExpansion(rowKey)}
                                                                className={`mt-0.5 p-1 rounded-md transition-all cursor-pointer ${
                                                                    isExpanded
                                                                        ? "bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 rotate-90"
                                                                        : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500"
                                                                }`}
                                                                title={isExpanded ? "Collapse grouped item breakdown" : "Expand grouped requests and purchase orders"}
                                                                aria-label="Toggle details"
                                                            >
                                                                <ChevronRight className="w-3.5 h-3.5 transition-transform" />
                                                            </button>
                                                        ) : (
                                                            <div className="w-5 shrink-0" />
                                                        )}

                                                        <div className="min-w-0 flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewItem(item)}
                                                                className="text-left font-bold text-slate-900 dark:text-white hover:text-pink-600 dark:hover:text-pink-400 transition-colors block cursor-pointer group"
                                                                title={`Click to view full details for ${item.item_name}`}
                                                            >
                                                                <span className="truncate block max-w-[170px] text-xs group-hover:underline">
                                                                    {item.item_name}
                                                                </span>
                                                            </button>

                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                                                    {item.item_code}
                                                                </span>

                                                                {item.related_requests_count && item.related_requests_count > 1 ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleRowExpansion(rowKey)}
                                                                        className="text-[9px] px-1.5 py-0.5 rounded-md bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-extrabold flex items-center gap-1 cursor-pointer hover:bg-pink-200 transition-colors"
                                                                        title="Multiple approved requests grouped. Click to view breakdown."
                                                                    >
                                                                        <Layers className="w-2.5 h-2.5" />
                                                                        <span>{item.related_requests_count} Reqs</span>
                                                                    </button>
                                                                ) : null}

                                                                {item.is_new_item && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold uppercase tracking-wide">
                                                                        New
                                                                    </span>
                                                                )}

                                                                {item.po_status_indicator ? (
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 border ${
                                                                        item.po_status_indicator === 'Delivered'
                                                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                                            : item.po_status_indicator === 'Waiting for Delivery'
                                                                            ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                                            : item.po_status_indicator === 'Rejected Purchase Order'
                                                                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                                                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                                    }`} title={`Purchase Order #${item.matching_po_number || ''}${item.po_status_indicator === 'Approval Pending' ? ' (Awaiting Admin Approval)' : ''}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                                            item.po_status_indicator === 'Delivered'
                                                                                ? 'bg-emerald-500'
                                                                                : item.po_status_indicator === 'Waiting for Delivery'
                                                                                ? 'bg-sky-500'
                                                                                : item.po_status_indicator === 'Rejected Purchase Order'
                                                                                ? 'bg-rose-500'
                                                                                : 'bg-amber-500'
                                                                        }`} />
                                                                        <span>{item.po_status_indicator}</span>
                                                                        {item.matching_po_number && (
                                                                            <span className="font-mono text-[8px] opacity-75">#{item.matching_po_number}</span>
                                                                        )}
                                                                    </span>
                                                                ) : item.is_bid_awarded ? (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-0.5">
                                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                                        Awarded
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Column 2: Source Request / Department */}
                                                <td className="py-3.5 px-3 w-[150px]">
                                                    {item.related_requests_count && item.related_requests_count > 1 ? (
                                                        <div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRowExpansion(rowKey)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono font-bold text-[10px] border border-pink-200/50 dark:border-pink-900/40 cursor-pointer hover:bg-pink-200 transition-colors"
                                                                title="Click to view all grouped requests"
                                                            >
                                                                <Layers className="w-2.5 h-2.5" />
                                                                <span>{item.related_requests_count} Grouped Reqs</span>
                                                            </button>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block max-w-[130px] mt-0.5" title={item.source_department || "Multiple Departments"}>
                                                                {item.source_department || "Multiple Departments"}
                                                            </span>
                                                        </div>
                                                    ) : item.source_request ? (
                                                        <div>
                                                            <span className="inline-block px-2 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-mono font-bold text-[10px] border border-pink-200/50 dark:border-pink-900/40">
                                                                {item.source_request.startsWith("#") ? item.source_request : `#${item.source_request}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block max-w-[130px] mt-0.5" title={item.source_department || "Staff Request"}>
                                                                {item.source_department || "Department Staff"}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">Warehouse Buffer</span>
                                                            <span className="text-[10px] block text-slate-400">Direct Reorder</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Column 3: Supplier & Sourcing */}
                                                <td className="py-3.5 px-3 w-[180px]">
                                                    {item.has_official_active_supplier ? (
                                                        <div>
                                                            <span 
                                                                className="font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[160px] text-[11px]" 
                                                                title={supplierName}
                                                            >
                                                                {supplierName}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                                                                <Store className="w-2.5 h-2.5 text-emerald-500" />
                                                                Official Supplier
                                                            </span>
                                                        </div>
                                                    ) : item.previous_supplier ? (
                                                        <div>
                                                            <span 
                                                                className="font-bold text-blue-800 dark:text-blue-300 truncate block max-w-[160px] text-[11px]" 
                                                                title={item.previous_supplier}
                                                            >
                                                                {item.previous_supplier}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                                                                <Store className="w-2.5 h-2.5 text-blue-500" />
                                                                Prev Winner (Inactive)
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px] flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                                                No Supplier
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 block mt-0.5">
                                                                Sourcing required
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Column 4: Category (Dedicated Column) */}
                                                <td className="py-3.5 px-3 w-[130px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span 
                                                            className="font-semibold text-slate-700 dark:text-slate-300 truncate block max-w-[110px] text-xs" 
                                                            title={item.category || "General"}
                                                        >
                                                            {item.category || "General"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Column 5: Location (Dedicated Column) */}
                                                <td className="py-3.5 px-3 w-[120px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-3 h-3 text-pink-500 shrink-0" />
                                                        <span 
                                                            className="text-slate-600 dark:text-slate-300 text-xs truncate block max-w-[100px] font-medium" 
                                                            title={item.storage_location || "Central Warehouse"}
                                                        >
                                                            {item.storage_location || "Central Warehouse"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Column 6: Stock Level & Severity (Dedicated Column) */}
                                                <td className="py-3.5 px-3 w-[130px]">
                                                    <div>
                                                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                                                            {usableStock} <span className="font-normal text-[11px] text-slate-500">{item.unit}</span>
                                                        </div>
                                                        <div className="mt-1">
                                                            {isZero ? (
                                                                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-extrabold border border-rose-300/50 dark:border-rose-900/40">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                                                    <span>Out of Stock</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-300/50 dark:border-amber-900/40">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                    <span>Low Stock</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Column 7: Approved Demand (Dedicated Column) */}
                                                <td className="py-3.5 px-3 w-[120px]">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            {approvedDemand} <span className="font-normal text-[11px] text-slate-500">{item.unit}</span>
                                                        </div>
                                                        {poCoverage > 0 && (
                                                            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-700 dark:text-sky-300 mt-1 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-200/50 dark:border-sky-900/30">
                                                                <span>PO: +{poCoverage}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Column 8: Deficit & Coverage Status (Dedicated Column) */}
                                                <td className="py-3.5 px-3 w-[130px]">
                                                    <div>
                                                        {remDeficit > 0 ? (
                                                            <>
                                                                <div className="text-xs font-black text-pink-600 dark:text-pink-400">
                                                                    -{remDeficit} <span className="font-medium text-[11px] text-pink-500/80">{item.unit}</span>
                                                                </div>
                                                                <div className="mt-1">
                                                                    <span className="px-1.5 py-0.5 rounded-md font-bold uppercase text-[9px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/30">
                                                                        Uncovered
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                                    0 <span className="font-medium text-[11px] text-emerald-500/80">{item.unit}</span>
                                                                </div>
                                                                <div className="mt-1">
                                                                    <span className="px-1.5 py-0.5 rounded-md font-bold uppercase text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30">
                                                                        Covered
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Column 9: Est. Cost */}
                                                <td className="py-3.5 px-3 w-[120px]">
                                                    {(() => {
                                                        const hasAnySupplier = Boolean(
                                                            item.has_official_active_supplier ||
                                                            item.matched_active_supplier?.name ||
                                                            item.supplier ||
                                                            item.previous_supplier
                                                        );
                                                        const unitPrice = hasAnySupplier
                                                            ? Number(item.purchase_price || item.previous_unit_price || 0)
                                                            : 0;
                                                        const cost = hasAnySupplier
                                                            ? (unitPrice > 0 ? remDeficit * unitPrice : Number(item.estimated_reorder_cost || 0))
                                                            : 0;

                                                        return (
                                                            <div>
                                                                <span className="font-bold text-slate-900 dark:text-white block text-xs">
                                                                    {formatCurrency(cost)}
                                                                </span>
                                                                {hasAnySupplier && unitPrice > 0 ? (
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                                                        @ ₱{Number(unitPrice).toLocaleString()}/{item.unit}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                                                        No pricing
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Column 10: Actions (CrudActionButton) */}
                                                <td className="py-3.5 px-4 text-right w-[160px]">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Standard View Action */}
                                                        <CrudActionButton
                                                            action="view"
                                                            onClick={() => setViewItem(item)}
                                                            ariaLabel="View Complete Item Details"
                                                            title="View Details"
                                                        />

                                                        {/* Contextual Procurement Action: Reorder / Covered / Sourcing */}
                                                        {remDeficit <= 0 ? (
                                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                                <span>Covered</span>
                                                            </span>
                                                        ) : (() => {
                                                            const availableSupName = item.matched_active_supplier?.name || item.previous_supplier || (item.covering_purchase_orders && item.covering_purchase_orders[0]?.supplier_name) || null;
                                                            return (
                                                                <>
                                                                    {availableSupName ? (
                                                                        <CrudActionButton
                                                                            action="custom"
                                                                            icon={RotateCw}
                                                                            label="Reorder"
                                                                            variant="pink"
                                                                            onClick={() => {
                                                                                if (onCreatePO) {
                                                                                    onCreatePO(item, item.matched_active_supplier);
                                                                                } else if (onOrderAgainFromSameSupplier && availableSupName) {
                                                                                    onOrderAgainFromSameSupplier(item, availableSupName);
                                                                                } else {
                                                                                    onFindSuppliersForItem(item);
                                                                                }
                                                                            }}
                                                                            ariaLabel={`Reorder remaining deficit of ${remDeficit} ${item.unit} from ${availableSupName}`}
                                                                            title={`Reorder ${remDeficit} ${item.unit} via Create Purchase Order`}
                                                                        />
                                                                    ) : null}

                                                                    {item.matched_active_supplier && (
                                                                        <CrudActionButton
                                                                            action="message"
                                                                            icon={MessageSquare}
                                                                            label="Message"
                                                                            onClick={() => onMessageSupplier?.(item.matched_active_supplier, item)}
                                                                            ariaLabel="Message active supplier"
                                                                            title="Message active supplier"
                                                                        />
                                                                    )}

                                                                    <CrudActionButton
                                                                        action="open"
                                                                        icon={Store}
                                                                        label="Find"
                                                                        variant={availableSupName ? "neutral" : "pink"}
                                                                        onClick={() => onFindSuppliersForItem(item)}
                                                                        ariaLabel={`Find potential suppliers for remaining deficit of ${remDeficit} ${item.unit}`}
                                                                        title={`Find potential suppliers for ${remDeficit} ${item.unit}`}
                                                                    />
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Detail View Drawer */}
                                            {isExpanded && (
                                                <tr key={`${rowKey}-expanded`} className="bg-slate-50/90 dark:bg-[#0f111c] border-b border-slate-200/80 dark:border-white/[0.08]">
                                                    <td colSpan={10} className="p-4 sm:p-5">
                                                        <div className="space-y-4">
                                                            {/* 1. Mathematical Breakdown Banner */}
                                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#151726] border border-white/80 dark:border-white/[0.06] shadow-sm flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="flex items-center gap-2">
                                                                    <Info className="w-4 h-4 text-pink-500 shrink-0" />
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white">
                                                                        Procurement Deficit Formula:
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 font-mono text-[11px] font-bold flex-wrap">
                                                                    <span className="text-slate-600 dark:text-slate-300">
                                                                        Approved Demand: <strong className="text-slate-900 dark:text-white">{approvedDemand}</strong>
                                                                    </span>
                                                                    <span className="text-slate-400">−</span>
                                                                    <span className="text-slate-600 dark:text-slate-300">
                                                                        Usable Stock: <strong className="text-emerald-600 dark:text-emerald-400">{usableStock}</strong>
                                                                    </span>
                                                                    {poCoverage > 0 && (
                                                                        <>
                                                                            <span className="text-slate-400">−</span>
                                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                                Active PO Coverage: <strong className="text-sky-600 dark:text-sky-400">{poCoverage}</strong>
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    <span className="text-slate-400">=</span>
                                                                    <span className={`px-2.5 py-0.5 rounded-lg font-black ${
                                                                        remDeficit > 0 
                                                                            ? "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-300/50" 
                                                                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50"
                                                                    }`}>
                                                                        Remaining Deficit: {remDeficit} {item.unit}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* 2. Side-by-side: Related Requests & Covering Purchase Orders */}
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                {/* Panel A: Related Approved Requisitions */}
                                                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] space-y-3 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                                                                            <FileText className="w-3.5 h-3.5 text-pink-500" />
                                                                            <span>Related Approved Requests ({item.related_requests?.length || 1})</span>
                                                                        </h4>
                                                                        <span className="text-[10px] font-bold text-slate-400">
                                                                            Total: {approvedDemand} {item.unit}
                                                                        </span>
                                                                    </div>

                                                                    {item.related_requests && item.related_requests.length > 0 ? (
                                                                        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-[#11121d]">
                                                                            <table className="w-full text-left text-[11px]">
                                                                                <thead>
                                                                                    <tr className="bg-slate-100/80 dark:bg-[#161826] text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[9px] border-b border-slate-200/60 dark:border-white/[0.05]">
                                                                                        <th className="py-2 px-3">Req Number</th>
                                                                                        <th className="py-2 px-3">Original Item Name</th>
                                                                                        <th className="py-2 px-3">Department</th>
                                                                                        <th className="py-2 px-3 text-right">Qty</th>
                                                                                        <th className="py-2 px-3 text-right">Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04]">
                                                                                    {item.related_requests.map((req, rIdx) => (
                                                                                        <tr key={`${req.id || req.request_number}-${rIdx}`} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                                                                            <td className="py-2 px-3 font-mono font-bold text-pink-600 dark:text-pink-400">
                                                                                                #{req.request_number || req.id}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200" title="Original user input casing preserved">
                                                                                                {req.item_name}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                                                                                {req.department || "Staff Requisition"}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                                                                                                {req.quantity} {item.unit}
                                                                                            </td>
                                                                                            <td className="py-2 px-3 text-right">
                                                                                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[9px]">
                                                                                                    {req.status}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                                                                            Direct warehouse buffer shortage (no explicit requisitions linked).
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Panel B: Covering Purchase Orders */}
                                                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#141624] border border-white/80 dark:border-white/[0.06] space-y-3 shadow-inner">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                                                                            <ShoppingCart className="w-3.5 h-3.5 text-sky-500" />
                                                                            <span>Covering Purchase Orders ({item.covering_purchase_orders?.length || 0})</span>
                                                                        </h4>
                                                                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                                                                            Covered: {poCoverage} {item.unit}
                                                                        </span>
                                                                    </div>

                                                                    {item.covering_purchase_orders && item.covering_purchase_orders.length > 0 ? (
                                                                        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-[#11121d]">
                                                                            <table className="w-full text-left text-[11px]">
                                                                                <thead>
                                                                                    <tr className="bg-slate-100/80 dark:bg-[#161826] text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[9px] border-b border-slate-200/60 dark:border-white/[0.05]">
                                                                                        <th className="py-2 px-3">PO Number</th>
                                                                                        <th className="py-2 px-3">Supplier</th>
                                                                                        <th className="py-2 px-3 text-right">Qty Covered</th>
                                                                                        <th className="py-2 px-3 text-right">Lifecycle Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04]">
                                                                                    {item.covering_purchase_orders.map((po, pIdx) => {
                                                                                        const isDelivered = String(po.status || "").toLowerCase() === "delivered" || String(po.status || "").toLowerCase() === "completed";
                                                                                        return (
                                                                                            <tr key={`${po.id || po.po_number}-${pIdx}`} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                                                                                <td className="py-2 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                                                                                                    #{po.po_number || po.id}
                                                                                                </td>
                                                                                                <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                                                                                                    {po.supplier_name || "Supplier"}
                                                                                                </td>
                                                                                                <td className="py-2 px-3 text-right font-black text-sky-600 dark:text-sky-400">
                                                                                                    {po.covered_quantity || po.quantity} {item.unit}
                                                                                                </td>
                                                                                                <td className="py-2 px-3 text-right">
                                                                                                    <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                                                                                                        isDelivered
                                                                                                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                                                                                            : String(po.status || "").toLowerCase() === "issued"
                                                                                                            ? "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300"
                                                                                                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                                                                                    }`}>
                                                                                                        {po.status}
                                                                                                    </span>
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-[#11121d] text-center text-slate-400 text-xs">
                                                                            <span>No purchase orders currently allocated to this item.</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 3. Pagination & Items Counter Footer */}
                {filteredShortages.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.05] text-xs">
                        <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                            Showing <span className="font-bold text-slate-800 dark:text-slate-100">{Math.min(filteredShortages.length, (currentPage - 1) * pageSize + 1)}</span> to{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-100">{Math.min(filteredShortages.length, currentPage * pageSize)}</span> of{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-100">{filteredShortages.length}</span> shortages
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                <span>Rows:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shadow-[inset_1px_1px_3px_rgba(163,177,198,0.3)]"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>

                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 4. Complete Shortage Details View Modal */}
            {viewItem && (
                <Portal>
                    <div 
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setViewItem(null)}
                    >
                        <div 
                            className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.4),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8)] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-5 sm:p-6 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-4 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                                        <Boxes className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                                                {viewItem.item_name}
                                            </h3>
                                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {viewItem.item_code}
                                            </span>
                                            {(() => {
                                                const vStock = viewItem.usable_stock !== undefined ? viewItem.usable_stock : viewItem.current_stock;
                                                const vIsZero = vStock === 0 || viewItem.status === "out-of-stock";
                                                return vIsZero ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-extrabold flex items-center gap-1 border border-rose-300/50 dark:border-rose-900/40">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        <span>Out of Stock</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold flex items-center gap-1 border border-amber-300/50 dark:border-amber-900/40">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                        <span>Low Stock</span>
                                                    </span>
                                                );
                                            })()}
                                            {viewItem.po_status_indicator && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border ${
                                                    viewItem.po_status_indicator === 'Delivered'
                                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                        : viewItem.po_status_indicator === 'Waiting for Delivery'
                                                        ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                        : viewItem.po_status_indicator === 'Rejected Purchase Order'
                                                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        viewItem.po_status_indicator === 'Delivered'
                                                            ? 'bg-emerald-500'
                                                            : viewItem.po_status_indicator === 'Waiting for Delivery'
                                                            ? 'bg-sky-500'
                                                            : viewItem.po_status_indicator === 'Rejected Purchase Order'
                                                            ? 'bg-rose-500'
                                                            : 'bg-amber-500'
                                                    }`} />
                                                    <span>{viewItem.po_status_indicator}</span>
                                                    {viewItem.matching_po_number && (
                                                        <span className="font-mono text-[9px] opacity-75">#{viewItem.matching_po_number}</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Inventory Stock Deficit &amp; Sourcing Specifications
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setViewItem(null)}
                                    className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Scrollable Body */}
                            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                                {(() => {
                                    const modalDemand = viewItem.total_approved_demand ?? viewItem.requested_demand ?? viewItem.deficit;
                                    const modalStock = viewItem.usable_stock !== undefined ? viewItem.usable_stock : viewItem.current_stock;
                                    const isModalPoDelivered =
                                        viewItem.po_status_indicator === 'Delivered' ||
                                        (viewItem.covering_purchase_orders && viewItem.covering_purchase_orders.length > 0 && viewItem.covering_purchase_orders.every(po => {
                                            const s = (po.status || "").toLowerCase();
                                            return s === "delivered" || s === "completed" || s === "received" || s === "fulfilled";
                                        }));
                                    const modalPoCoverage = isModalPoDelivered ? 0 : (viewItem.active_po_coverage ?? viewItem.covered_quantity ?? 0);
                                    const modalDeficit = viewItem.remaining_deficit !== undefined ? viewItem.remaining_deficit : viewItem.deficit;
                                    const modalIsZero = modalStock === 0 || viewItem.status === "out-of-stock";

                                    return (
                                        <>
                                            {/* Stock & Grouped Metrics Strip */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Approved Demand</span>
                                                    <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                                        {modalDemand} <span className="text-xs font-normal text-slate-500">{viewItem.unit}</span>
                                                    </span>
                                                </div>

                                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Usable Stock</span>
                                                        <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase ${
                                                            modalIsZero
                                                                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                                        }`}>
                                                            {modalIsZero ? "Out of Stock" : "Low Stock"}
                                                        </span>
                                                    </div>
                                                    <span className={`text-base font-black ${modalStock === 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                        {modalStock} <span className="text-xs font-normal text-slate-500">{viewItem.unit}</span>
                                                    </span>
                                                </div>

                                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                                    <span className="text-[10px] font-bold text-sky-500 block uppercase">PO Coverage</span>
                                                    <span className="text-base font-black text-sky-600 dark:text-sky-400">
                                                        {modalPoCoverage > 0 ? `+${modalPoCoverage}` : "0"} <span className="text-xs font-normal text-sky-500">{viewItem.unit}</span>
                                                    </span>
                                                    {isModalPoDelivered && (
                                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold block mt-0.5">
                                                            PO Delivered
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                                    <span className="text-[10px] font-bold text-rose-500 block uppercase">Remaining Deficit</span>
                                                    <span className={`text-base font-black ${modalDeficit > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                        {modalDeficit > 0 ? `-${modalDeficit}` : "0"} <span className="text-xs font-normal text-slate-500">{viewItem.unit}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Formula Calculation Callout */}
                                            <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.04] text-xs flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <Info className="w-4 h-4 text-pink-500 shrink-0" />
                                                    <span className="font-extrabold text-slate-700 dark:text-slate-200">
                                                        Formula: Demand ({modalDemand}) − Usable Stock ({modalStock}){modalPoCoverage > 0 ? ` − PO Coverage (${modalPoCoverage})` : ""}
                                                    </span>
                                                </div>
                                                <span className={`font-black px-2 py-0.5 rounded-lg text-[11px] ${
                                                    modalDeficit > 0
                                                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                                                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                                }`}>
                                                    {modalDeficit > 0 ? `${modalDeficit} ${viewItem.unit} Uncovered` : "Fully Covered"}
                                                </span>
                                            </div>

                                            {/* Related Requests List */}
                                            {viewItem.related_requests && viewItem.related_requests.length > 0 && (
                                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                                                            <FileText className="w-4 h-4 text-pink-500" />
                                                            <span>Grouped Requisitions ({viewItem.related_requests.length})</span>
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            Total Demand: {modalDemand} {viewItem.unit}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1.5 pt-1">
                                                        {viewItem.related_requests.map((req, rIdx) => (
                                                            <div key={rIdx} className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-[#161826] border border-slate-200/60 dark:border-white/[0.04] text-xs">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono font-bold text-pink-600 dark:text-pink-400">
                                                                            #{req.request_number || req.id}
                                                                        </span>
                                                                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                                                                            {req.item_name}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                                                        Dept: {req.department || "Staff Request"} • {req.status}
                                                                    </span>
                                                                </div>
                                                                <span className="font-black text-slate-900 dark:text-white">
                                                                    {req.quantity} {viewItem.unit}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Covering Purchase Orders List */}
                                            {viewItem.covering_purchase_orders && viewItem.covering_purchase_orders.length > 0 && (
                                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                                                            <ShoppingCart className="w-4 h-4 text-sky-500" />
                                                            <span>Covering Purchase Orders ({viewItem.covering_purchase_orders.length})</span>
                                                        </h4>
                                                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                                                            Covered: {modalPoCoverage} {viewItem.unit}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1.5 pt-1">
                                                        {viewItem.covering_purchase_orders.map((po, pIdx) => (
                                                            <div key={pIdx} className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-[#161826] border border-slate-200/60 dark:border-white/[0.04] text-xs">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                                                                            #{po.po_number || po.id}
                                                                        </span>
                                                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                            {po.supplier_name || "Supplier"}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                                                        Status: {po.status}
                                                                    </span>
                                                                </div>
                                                                <span className="font-black text-sky-600 dark:text-sky-400">
                                                                    +{po.covered_quantity || po.quantity} {viewItem.unit}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Requisition & Department Details */}
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-pink-500" />
                                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                                        Source Requisition &amp; Location
                                                    </h4>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                                                    <div>
                                                        <span className="text-slate-400 text-[10px] block">Source Requisition:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {viewItem.source_request ? `#${viewItem.source_request}` : "Warehouse Direct Inventory"}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className="text-slate-400 text-[10px] block">Requesting Department:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {viewItem.source_department || "Supply Chain Inventory"}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <span className="text-slate-400 text-[10px] block">Storage Bin Location:</span>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {viewItem.storage_location || "Binondo Central Hub"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Supplier Sourcing Information */}
                                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Store className="w-4 h-4 text-pink-500" />
                                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                                        Supplier Contract &amp; Sourcing Status
                                                    </h4>
                                                </div>

                                                {viewItem.has_official_active_supplier ? (
                                                    <div className="space-y-1.5 text-xs pt-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-slate-400">Official Active Supplier:</span>
                                                            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                {viewItem.matched_active_supplier?.name || viewItem.supplier}
                                                            </strong>
                                                        </div>
                                                        {viewItem.matched_active_supplier?.contact_person && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-slate-400">Contact Person:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{viewItem.matched_active_supplier.contact_person}</span>
                                                            </div>
                                                        )}
                                                        {viewItem.matched_active_supplier?.email && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-slate-400">Email:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{viewItem.matched_active_supplier.email}</span>
                                                            </div>
                                                        )}
                                                        {(viewItem.purchase_price || viewItem.previous_unit_price) && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-slate-400">Contract Unit Price:</span>
                                                                <span className="text-slate-900 dark:text-slate-100 font-mono font-bold">
                                                                    ₱{Number(viewItem.purchase_price || viewItem.previous_unit_price).toLocaleString()} / {viewItem.unit}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : viewItem.previous_supplier ? (
                                                    <div className="space-y-1.5 text-xs pt-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-slate-400">Previous Winning Bidder:</span>
                                                            <strong className="text-blue-600 dark:text-blue-400 font-bold">
                                                                {viewItem.previous_supplier}
                                                            </strong>
                                                        </div>
                                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 p-2 rounded-xl border border-blue-200/50 dark:border-blue-900/40">
                                                            This supplier previously supplied this part, but does not have an active standing order contract. You can send an inquiry or source other quotes in Stage 2.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
                                                        No active supplier or previous contract found for this inventory item. Proceed to <strong>Stage 2 (Find Potential Suppliers)</strong> to source matching logistics vendors.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Full Description / Specs */}
                                            {viewItem.description && (
                                                <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04] space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Specifications / Notes</span>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                        {viewItem.description}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="p-4 sm:p-5 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md shrink-0 flex-wrap">
                                <AppButton
                                    type="button"
                                    variant="neutral"
                                    size="md"
                                    pill={false}
                                    className="!rounded-lg"
                                    onClick={() => setViewItem(null)}
                                >
                                    <span>Close</span>
                                </AppButton>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {(() => {
                                        const modalDeficit = viewItem.remaining_deficit !== undefined ? viewItem.remaining_deficit : viewItem.deficit;
                                        if (modalDeficit <= 0) {
                                            return (
                                                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Demand is Fully Covered</span>
                                                </div>
                                            );
                                        }

                                        return viewItem.has_official_active_supplier ? (
                                            <>
                                                <AppButton
                                                    type="button"
                                                    variant="pink"
                                                    size="md"
                                                    pill={false}
                                                    className="!rounded-lg"
                                                    onClick={() => {
                                                        const item = viewItem;
                                                        setViewItem(null);
                                                        onCreatePO?.(item, item.matched_active_supplier);
                                                    }}
                                                >
                                                    <ShoppingCart className="w-4 h-4 mr-1.5" />
                                                    <span>Create Purchase Order ({modalDeficit})</span>
                                                </AppButton>

                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="md"
                                                    pill={false}
                                                    className="!rounded-lg"
                                                    onClick={() => {
                                                        const item = viewItem;
                                                        setViewItem(null);
                                                        onMessageSupplier?.(item.matched_active_supplier, item);
                                                    }}
                                                >
                                                    <MessageSquare className="w-4 h-4 mr-1.5 text-pink-500" />
                                                    <span>Message Supplier</span>
                                                </AppButton>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {(() => {
                                                    const prevSup = viewItem.previous_supplier || (viewItem.covering_purchase_orders && viewItem.covering_purchase_orders[0]?.supplier_name) || null;
                                                    return prevSup ? (
                                                        <AppButton
                                                            type="button"
                                                            variant="neutral"
                                                            size="md"
                                                            pill={false}
                                                            className="!rounded-lg text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                            onClick={() => {
                                                                const item = viewItem;
                                                                setViewItem(null);
                                                                if (onOrderAgainFromSameSupplier) {
                                                                    onOrderAgainFromSameSupplier(item, prevSup);
                                                                } else {
                                                                    onFindSuppliersForItem(item);
                                                                }
                                                            }}
                                                        >
                                                            <RotateCw className="w-4 h-4 mr-1.5 text-blue-500" />
                                                            <span>Order Again from {prevSup} ({modalDeficit})</span>
                                                        </AppButton>
                                                    ) : null;
                                                })()}
                                                <AppButton
                                                    type="button"
                                                    variant="pink"
                                                    size="md"
                                                    pill={false}
                                                    className="!rounded-lg"
                                                    onClick={() => {
                                                        const item = viewItem;
                                                        setViewItem(null);
                                                        onFindSuppliersForItem(item);
                                                    }}
                                                >
                                                    <Store className="w-4 h-4 mr-1.5" />
                                                    <span>Find Potential Suppliers ({modalDeficit})</span>
                                                </AppButton>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
