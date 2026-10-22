// app/(supplyChain)/(pages)/inventory/components/tabs/StockMovementsTab.tsx
'use client';

import React, { useState, useMemo, memo } from 'react';
import { StockMovement, StockMovementStats } from '../../types';
import { sanitizeSearch } from '../../../../components/global/sanitize';
import { Pagination } from '../../../../components/global/pagination';
import { TableContentLoader } from '../../../../components/global/Loader';
import { AppButton } from '../../../../components/ui/AppButton';
import { StockMovementDetailModal } from '../modals/StockMovementDetailModal';
import { 
    Search, 
    Filter, 
    Calendar, 
    User, 
    ArrowDownLeft, 
    ArrowUpRight, 
    SlidersHorizontal, 
    Clock, 
    Package, 
    Hash, 
    ChevronDown, 
    History,
    ExternalLink,
    Building2,
    Store
} from 'lucide-react';

function formatMetadataAction(action?: string): string {
    if (!action) return '';
    return action
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StockMovementsTabProps {
    movements: StockMovement[];
    totalMovements: number;
    currentPage: number;
    totalPages: number;
    stats: StockMovementStats | null;
    isLoading?: boolean;
    searchTerm: string;
    typeFilter: string;
    dateRangeFilter: string;
    userDeptFilter: string;
    userDeptOptions?: string[];
    onSearchChange: (value: string) => void;
    onTypeChange: (value: string) => void;
    onDateRangeChange: (value: string) => void;
    onUserDeptChange: (value: string) => void;
    onClearFilters: () => void;
    onPageChange: (page: number) => void;
}

export const StockMovementsTab = memo(function StockMovementsTab({
    movements,
    totalMovements,
    currentPage,
    totalPages,
    stats,
    isLoading = false,
    searchTerm,
    typeFilter,
    dateRangeFilter,
    userDeptFilter,
    userDeptOptions = [],
    onSearchChange,
    onTypeChange,
    onDateRangeChange,
    onUserDeptChange,
    onClearFilters,
    onPageChange,
}: StockMovementsTabProps) {
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
    const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

    const handleRowClick = (movement: StockMovement) => {
        setSelectedMovement(movement);
        setShowDetailModal(true);
    };

    const hasActiveFilters = searchTerm !== '' || typeFilter !== 'all' || dateRangeFilter !== 'all' || userDeptFilter !== 'all';

    const itemsPerPage = 20;
    const startIndex = totalMovements === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalMovements);

    return (
        <div className="space-y-6">
            {/* Header Title & Short Description */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 text-sm">
                            <i className="fas fa-arrow-right-arrow-left"></i>
                        </span>
                        <span>Stock Movements</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Track all inventory stock-in, stock-out, and adjustment activities.
                    </p>
                </div>
            </div>

            {/* Summary Cards (Calculated from movement records) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Stock In */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Total Stock In
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                            +{stats ? stats.totalStockIn.toLocaleString() : '0'}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Supplies received into stock
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ArrowDownLeft className="w-5 h-5 stroke-[2]" />
                    </div>
                </div>

                {/* Total Stock Out */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Total Stock Out
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                            -{stats ? stats.totalStockOut.toLocaleString() : '0'}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Supplies issued & released
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                        <ArrowUpRight className="w-5 h-5 stroke-[2]" />
                    </div>
                </div>

                {/* Adjustments */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Adjustments
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                            {stats ? stats.adjustmentsCount.toLocaleString() : '0'}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {stats && stats.netAdjustments !== 0 
                                ? `Net ${stats.netAdjustments > 0 ? '+' : ''}${stats.netAdjustments} units`
                                : 'Manual stock corrections'}
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <SlidersHorizontal className="w-5 h-5 stroke-[2]" />
                    </div>
                </div>

                {/* Movements Today */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#161722] border border-white/90 dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.25),-6px_-6px_16px_rgba(255,255,255,0.85)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-between transition-all">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Movements Today
                        </span>
                        <h4 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                            {stats ? stats.movementsToday.toLocaleString() : '0'}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Activity recorded today
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.05] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                        <Clock className="w-5 h-5 stroke-[2]" />
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl border border-white/90 dark:border-white/[0.08] shadow-[14px_14px_40px_rgba(166,175,195,0.35),-14px_-14px_40px_rgba(255,255,255,0.95)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.8),-4px_-4px_12px_rgba(255,255,255,0.03)] overflow-hidden transition-colors flex flex-col">
                {/* Filter Toolbar */}
                <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                        {/* Search Input (Item Code, Item Name, or Reference Number) */}
                        <div className="relative flex-1 min-w-[220px] max-w-sm group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none group-focus-within:text-pink-500 transition-colors w-4 h-4" />
                            <input
                                className="w-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 transition-all"
                                placeholder="Search by item code, item name, or reference..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                            />
                        </div>

                        {/* Movement Type Filter */}
                        <div className="relative min-w-[150px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                                value={typeFilter}
                                onChange={(e) => onTypeChange(e.target.value)}
                            >
                                <option value="all">All Movement Types</option>
                                <option value="Stock In">Stock In</option>
                                <option value="Stock Out">Stock Out / Issued</option>
                                <option value="Adjustment">Adjustment</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>

                        {/* Date Range Filter */}
                        <div className="relative min-w-[140px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                                value={dateRangeFilter}
                                onChange={(e) => onDateRangeChange(e.target.value)}
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Past 7 Days</option>
                                <option value="month">Past 30 Days</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>

                        {/* User / Department Filter */}
                        <div className="relative min-w-[170px] group">
                            <select
                                className="w-full appearance-none bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.06] rounded-2xl px-3.5 py-2.5 pl-4 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)] focus:outline-none focus:border-pink-500 cursor-pointer transition-all"
                                value={userDeptFilter}
                                onChange={(e) => onUserDeptChange(e.target.value)}
                            >
                                <option value="all">All Users / Depts</option>
                                {userDeptOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                        </div>
                    </div>

                    {/* Reset Filters Action */}
                    {hasActiveFilters && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={onClearFilters}
                            className="cursor-pointer"
                        >
                            <i className="fas fa-rotate-left text-xs mr-1.5" />
                            <span>Reset Filters</span>
                        </AppButton>
                    )}
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[640px] relative">
                    {isLoading && <TableContentLoader />}

                    <table className="w-full table-pro border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-[#ebf0f7]/95 dark:bg-[#14151e]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 font-extrabold uppercase tracking-wider text-[11px] select-none shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                            <tr>
                                <th className="px-4 py-3.5">Date & Time</th>
                                <th className="px-4 py-3.5">Item Code</th>
                                <th className="px-4 py-3.5">Item Name</th>
                                <th className="px-4 py-3.5">Movement Type</th>
                                <th className="px-4 py-3.5 text-right">Quantity</th>
                                <th className="px-4 py-3.5 text-right">Previous</th>
                                <th className="px-4 py-3.5 text-right">New Stock</th>
                                <th className="px-4 py-3.5">Reference</th>
                                <th className="px-4 py-3.5">Reason</th>
                                <th className="px-4 py-3.5">Department</th>
                                <th className="px-4 py-3.5">Supplier</th>
                                <th className="px-4 py-3.5">Action</th>
                                <th className="px-4 py-3.5">Performed By</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04] text-xs">
                            {movements.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={13} className="block w-full md:table-cell px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                                            <div className="w-14 h-14 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151e] border border-white/80 dark:border-white/[0.06] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-400 dark:text-slate-500">
                                                <History className="w-7 h-7 stroke-[1.5]" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                {hasActiveFilters ? 'No Matching Movements Found' : 'No Movement Records Yet'}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                                                {hasActiveFilters 
                                                    ? 'Try adjusting your search criteria or resetting the applied filters.' 
                                                    : 'Every stock in, stock out, and adjustment transaction will automatically be recorded here with a complete audit trail.'}
                                            </p>
                                            {hasActiveFilters && (
                                                <AppButton type="button" variant="neutral" size="sm" onClick={onClearFilters}>
                                                    Reset Filters
                                                </AppButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                movements.map((movement) => {
                                    const isStockIn = movement.movement_type === 'Stock In';
                                    const isStockOut = movement.movement_type === 'Stock Out';
                                    const isAdjustment = movement.movement_type === 'Adjustment';

                                    const qtyNumber = movement.quantity;
                                    const formattedQty = isStockIn
                                        ? `+${Math.abs(qtyNumber)}`
                                        : isStockOut
                                        ? `-${Math.abs(qtyNumber)}`
                                        : qtyNumber > 0
                                        ? `+${qtyNumber}`
                                        : `${qtyNumber}`;

                                    const formattedDate = new Date(movement.created_at).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                    });

                                    return (
                                        <tr
                                            key={movement.id}
                                            onClick={() => handleRowClick(movement)}
                                            className="hover:bg-slate-500/5 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                            title="Click to view full movement details"
                                        >
                                            {/* Date & Time */}
                                            <td data-label="Date & Time" className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span className="font-medium">{formattedDate}</span>
                                                </div>
                                            </td>

                                            {/* Item Code */}
                                            <td data-label="Item Code" className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="font-mono text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-pink-500/10 dark:bg-pink-500/15 px-2 py-0.5 rounded-lg border border-pink-500/20">
                                                    {movement.item_code}
                                                </span>
                                            </td>

                                            {/* Item Name */}
                                            <td data-label="Item Name" className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                                                <div className="flex items-center gap-1.5" title={movement.item_name}>
                                                    <Package className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span className="truncate">{movement.item_name}</span>
                                                </div>
                                            </td>

                                            {/* Movement Type */}
                                            <td data-label="Movement Type" className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                                    isStockIn
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : isStockOut
                                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        isStockIn ? 'bg-emerald-500' : isStockOut ? 'bg-rose-500' : 'bg-amber-500'
                                                    }`} />
                                                    {movement.movement_type}
                                                </span>
                                            </td>

                                            {/* Quantity */}
                                            <td data-label="Quantity" className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-sm">
                                                <span className={
                                                    isStockIn
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : isStockOut
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-amber-600 dark:text-amber-400'
                                                }>
                                                    {formattedQty}
                                                </span>
                                            </td>

                                            {/* Previous Stock */}
                                            <td data-label="Previous" className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                                                {movement.previous_stock.toLocaleString()}
                                            </td>

                                            {/* New Stock */}
                                            <td data-label="New Stock" className="px-4 py-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                                                {movement.new_stock.toLocaleString()}
                                            </td>

                                            {/* Reference */}
                                            <td data-label="Reference" className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-white/[0.05] px-2 py-0.5 rounded-md border border-slate-300/50 dark:border-white/[0.08]">
                                                    {movement.reference_number || movement.reference || '—'}
                                                </span>
                                            </td>

                                            {/* Reason */}
                                            <td data-label="Reason" className="px-4 py-3.5 text-slate-600 dark:text-slate-400 max-w-[220px] truncate" title={movement.reason || movement.notes || ''}>
                                                {movement.reason || movement.notes || '—'}
                                            </td>

                                            {/* Department */}
                                            <td data-label="Department" className="px-4 py-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span className="truncate max-w-[130px]" title={movement.department || 'Warehouse'}>
                                                        {movement.department || 'Warehouse'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Supplier (from metadata) */}
                                            <td data-label="Supplier" className="px-4 py-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                {movement.metadata?.supplier ? (
                                                    <div className="flex items-center gap-1.5 font-medium text-xs">
                                                        <Store className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                        <span className="truncate max-w-[160px]" title={movement.metadata.supplier}>
                                                            {movement.metadata.supplier}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">—</span>
                                                )}
                                            </td>

                                            {/* Action (from metadata) */}
                                            <td data-label="Action" className="px-4 py-3.5 whitespace-nowrap">
                                                {movement.metadata?.action ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                                        String(movement.metadata.action).includes('NEW') || String(movement.metadata.action).includes('STOCK_IN')
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                            : String(movement.metadata.action).includes('OUT')
                                                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                    }`}>
                                                        {formatMetadataAction(movement.metadata.action)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">—</span>
                                                )}
                                            </td>

                                            {/* Performed By */}
                                            <td data-label="Performed By" className="px-4 py-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span>{movement.performed_by || 'Warehouse Staff'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex-shrink-0 p-4 border-t border-slate-200/60 dark:border-white/[0.06] bg-[#ebf0f7]/70 dark:bg-[#14151e]/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Showing <span className="font-extrabold text-slate-900 dark:text-slate-100">{startIndex}</span> to{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{endIndex}</span> of{' '}
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{totalMovements}</span> movement records
                    </span>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>

            {/* Movement Details Modal */}
            <StockMovementDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                movement={selectedMovement}
            />
        </div>
    );
});
