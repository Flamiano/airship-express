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
    User
} from "lucide-react";
import { StockShortageItem } from "../types/index";
import Cards from "../../../components/global/Cards";
import { Pagination } from "../../../components/global/pagination";
import Portal from "../../../components/client/Portal";
import { AppButton } from "../../../components/ui/AppButton";

interface StageStockShortagesProps {
    shortages: StockShortageItem[];
    isLoading: boolean;
    onFindSuppliersForItem: (shortageItem: StockShortageItem) => void;
    onRefresh: () => void;
    onMessageSupplier?: (supplier: any, shortageItem?: StockShortageItem) => void;
    onCreatePO?: (shortageItem: StockShortageItem, supplier?: any) => void;
}

const formatCurrency = (amount: number) => `₱${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function StageStockShortages({
    shortages,
    isLoading,
    onFindSuppliersForItem,
    onRefresh,
    onMessageSupplier,
    onCreatePO,
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
        const outOfStockCount = shortages.filter((s) => s.current_stock === 0 || s.status === "out-of-stock").length;
        const lowStockCount = shortages.filter((s) => s.current_stock > 0 && (s.current_stock <= s.minimum_stock || s.status === "low-stock")).length;
        const totalShortageCost = shortages.reduce((sum, s) => sum + (Number(s.estimated_reorder_cost) || 0), 0);

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
                (item.storage_location || "").toLowerCase().includes(q);

            const matchesCategory =
                categoryFilter === "all" ||
                (item.category || "").toLowerCase() === categoryFilter.toLowerCase();

            const isZero = item.current_stock === 0 || item.status === "out-of-stock";
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
                    <table className="min-w-[1100px] w-full text-left border-collapse text-xs table-fixed">
                        <thead>
                            <tr className="bg-[#e2e8f0]/80 dark:bg-[#10121d] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200/70 dark:border-white/[0.06]">
                                <th className="py-3 px-4 w-[240px]">Item Code &amp; Name</th>
                                <th className="py-3 px-4 w-[160px]">Source Request / Dept</th>
                                <th className="py-3 px-4 w-[200px]">Supplier &amp; Sourcing</th>
                                <th className="py-3 px-4 w-[150px]">Category &amp; Location</th>
                                <th className="py-3 px-4 w-[170px]">Stock Level &amp; Deficit</th>
                                <th className="py-3 px-4 w-[130px]">Est. Cost</th>
                                <th className="py-3 px-4 text-right w-[170px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                            {paginatedShortages.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-pink-500 opacity-80" />
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Shortages Found</p>
                                        <p className="text-[11px] mt-0.5">All warehouse parts and supplies match your filter or are within safe inventory levels.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedShortages.map((item, index) => {
                                    const isZero = item.current_stock === 0 || item.status === "out-of-stock";
                                    const stockPercent = item.minimum_stock > 0
                                        ? Math.min(100, Math.round((item.current_stock / item.minimum_stock) * 100))
                                        : 0;

                                    const supplierName = item.matched_active_supplier?.name || item.supplier || item.previous_supplier || "";

                                    return (
                                        <tr
                                            key={`${item.id}-${item.item_code}-${index}`}
                                            className="hover:bg-white/40 dark:hover:bg-white/[0.02] transition-colors"
                                        >
                                            {/* Column 1: Item Code & Name (Truncated with Ellipsis) */}
                                            <td className="py-3.5 px-4 w-[240px]">
                                                <button
                                                    type="button"
                                                    onClick={() => setViewItem(item)}
                                                    className="text-left font-bold text-slate-900 dark:text-white hover:text-pink-600 dark:hover:text-pink-400 transition-colors block cursor-pointer group"
                                                    title={`Click to view full details for ${item.item_name}`}
                                                >
                                                    <span className="truncate block max-w-[210px] text-xs group-hover:underline">
                                                        {item.item_name}
                                                    </span>
                                                </button>

                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                                        {item.item_code}
                                                    </span>

                                                    {item.is_new_item && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-extrabold uppercase tracking-wide">
                                                            New
                                                        </span>
                                                    )}

                                                    {item.is_bid_awarded && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-0.5">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                            Awarded
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Column 2: Source Request / Department */}
                                            <td className="py-3.5 px-4 w-[160px]">
                                                {item.source_request ? (
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
                                                        <span>Warehouse Buffer</span>
                                                        <span className="text-[10px] block text-slate-400">Direct Reorder</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Column 3: Supplier & Sourcing */}
                                            <td className="py-3.5 px-4 w-[200px]">
                                                {item.has_official_active_supplier ? (
                                                    <div>
                                                        <span 
                                                            className="font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[180px] text-[11px]" 
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
                                                            className="font-bold text-blue-800 dark:text-blue-300 truncate block max-w-[180px] text-[11px]" 
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

                                            {/* Column 4: Category & Location */}
                                            <td className="py-3.5 px-4 w-[150px]">
                                                <span 
                                                    className="font-semibold text-slate-700 dark:text-slate-300 truncate block max-w-[130px] text-xs" 
                                                    title={item.category || "General"}
                                                >
                                                    {item.category || "General"}
                                                </span>
                                                <span 
                                                    className="text-slate-400 dark:text-slate-500 text-[10px] truncate block max-w-[130px] mt-0.5" 
                                                    title={item.storage_location || "Central Warehouse"}
                                                >
                                                    {item.storage_location || "Central Warehouse"}
                                                </span>
                                            </td>

                                            {/* Column 5: Stock Level & Deficit */}
                                            <td className="py-3.5 px-4 w-[170px]">
                                                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                                    <span className={isZero ? "text-pink-600 dark:text-pink-400 font-black" : "text-slate-700 dark:text-slate-300 font-extrabold"}>
                                                        {item.current_stock} {item.unit}
                                                    </span>
                                                    <span className="text-slate-400 font-normal">
                                                        / {item.minimum_stock} {item.unit}
                                                    </span>
                                                </div>
                                                <div className="w-28 h-1.5 rounded-full bg-[#d8e2ee] dark:bg-[#10121d] overflow-hidden mb-1">
                                                    <div
                                                        className={`h-full rounded-full ${isZero ? "bg-pink-600" : "bg-pink-500"}`}
                                                        style={{ width: `${stockPercent}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="font-black text-pink-600 dark:text-pink-400">
                                                        -{item.deficit} {item.unit}
                                                    </span>
                                                    <span
                                                        className={`px-1.5 py-0.2 rounded-md font-bold uppercase text-[9px] ${
                                                            isZero
                                                                ? "text-rose-600 dark:text-rose-400"
                                                                : "text-amber-600 dark:text-amber-400"
                                                        }`}
                                                    >
                                                        {isZero ? "Depleted" : "Low"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Column 6: Est. Cost */}
                                            <td className="py-3.5 px-4 w-[130px]">
                                                <span className="font-bold text-slate-900 dark:text-white block text-xs">
                                                    {formatCurrency(item.estimated_reorder_cost)}
                                                </span>
                                                {(item.purchase_price || item.previous_unit_price) ? (
                                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                                        @ ₱{Number(item.purchase_price || item.previous_unit_price).toLocaleString()}/{item.unit}
                                                    </span>
                                                ) : null}
                                            </td>

                                            {/* Column 7: Actions */}
                                            <td className="py-3.5 px-4 text-right w-[170px]">
                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                    {/* View Modal Trigger */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewItem(item)}
                                                        className="p-1.5 rounded-md bg-[#ebf0f7] dark:bg-[#1b1c2b] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 border border-white/80 dark:border-white/[0.08] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),_2px_2px_4px_rgba(163,177,198,0.25)] transition-all cursor-pointer"
                                                        title="View Complete Item Details"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Contextual Action */}
                                                    {item.is_bid_awarded ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                                            Awarded
                                                        </span>
                                                    ) : item.has_official_active_supplier ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => onCreatePO?.(item, item.matched_active_supplier)}
                                                                className="px-2.5 py-1.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                                                title="Create PO with official supplier"
                                                            >
                                                                <ShoppingCart className="w-3 h-3" />
                                                                <span>PO</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => onMessageSupplier?.(item.matched_active_supplier, item)}
                                                                className="p-1.5 rounded-md bg-[#ebf0f7] dark:bg-[#1b1c2b] text-slate-700 dark:text-slate-300 hover:text-pink-600 border border-white/80 dark:border-white/[0.08] text-[10px] font-bold cursor-pointer"
                                                                title="Message active supplier"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5 text-pink-500" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onFindSuppliersForItem(item)}
                                                            className="px-2.5 py-1.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                                            title="Find potential suppliers"
                                                        >
                                                            <Store className="w-3 h-3" />
                                                            <span>Find</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
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
                                {/* Stock & Metrics Strip */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Current Stock</span>
                                        <span className={`text-base font-black ${viewItem.current_stock === 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"}`}>
                                            {viewItem.current_stock} <span className="text-xs font-normal text-slate-500">{viewItem.unit}</span>
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Min Safety Level</span>
                                        <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                            {viewItem.minimum_stock} <span className="text-xs font-normal text-slate-500">{viewItem.unit}</span>
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                        <span className="text-[10px] font-bold text-rose-500 block uppercase">Deficit Required</span>
                                        <span className="text-base font-black text-rose-600 dark:text-rose-400">
                                            -{viewItem.deficit} <span className="text-xs font-normal text-rose-500">{viewItem.unit}</span>
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/70 dark:border-white/[0.04]">
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Est. Reorder Cost</span>
                                        <span className="text-base font-black text-slate-800 dark:text-slate-100">
                                            {formatCurrency(viewItem.estimated_reorder_cost)}
                                        </span>
                                    </div>
                                </div>

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
                                    {viewItem.has_official_active_supplier ? (
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
                                                <span>Create Purchase Order</span>
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
                                            <span>Find Potential Suppliers</span>
                                        </AppButton>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
