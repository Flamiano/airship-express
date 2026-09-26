// search and filter control bar for media gallery
'use client';

import React from 'react';
import { Search, XCircle, Filter, RefreshCw, X } from 'lucide-react';
import { FilterState } from '../../types';
import { AppButton } from '../../../../components/ui/AppButton';

interface GalleryFilterBarProps {
    filterState: FilterState;
    categories: string[];
    suppliers: string[];
    showFilters: boolean;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFilterChange: (key: keyof FilterState, value: any) => void;
    onClearFilters: () => void;
}

export function GalleryFilterBar({
    filterState,
    categories,
    suppliers,
    showFilters,
    searchInputRef,
    onSearchChange,
    onFilterChange,
    onClearFilters
}: GalleryFilterBarProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={`Search by ${
                                filterState.searchType === 'all'
                                    ? 'title, uploader, supplier, or PO'
                                    : filterState.searchType === 'title'
                                        ? 'title'
                                        : filterState.searchType === 'uploader'
                                            ? 'uploader name'
                                            : filterState.searchType === 'supplier'
                                                ? 'supplier name'
                                                : 'PO number'
                            }...`}
                            value={filterState.searchTerm}
                            onChange={onSearchChange}
                            className="w-full pl-10 pr-9 py-2.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                        />
                        {filterState.searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    onFilterChange('searchTerm', '');
                                    setTimeout(() => searchInputRef.current?.focus(), 50);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 cursor-pointer"
                                title="Clear search"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <select
                        value={filterState.searchType}
                        onChange={(e) => {
                            onFilterChange('searchType', e.target.value);
                            setTimeout(() => searchInputRef.current?.focus(), 50);
                        }}
                        className="py-2.5 px-3.5 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                    >
                        <option value="all">All Fields</option>
                        <option value="title">Title</option>
                        <option value="uploader">Uploader</option>
                        <option value="supplier">Supplier</option>
                        <option value="po">PO Number</option>
                    </select>
                </div>
            </div>

            {showFilters && (
                <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center text-xs border border-pink-200/80 dark:border-pink-800/50">
                                <Filter className="w-3.5 h-3.5" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                Filter Options
                            </h3>
                        </div>

                        <AppButton type="button" variant="neutral" size="xs" onClick={onClearFilters}>
                            <RefreshCw className="w-3 h-3" />
                            <span>Reset All</span>
                        </AppButton>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Category
                            </label>
                            <div className="relative">
                                <select
                                    value={filterState.selectedCategory}
                                    onChange={(e) => onFilterChange('selectedCategory', e.target.value)}
                                    className="w-full py-2.5 pl-3 pr-8 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Supplier
                            </label>
                            <div className="relative">
                                <select
                                    value={filterState.selectedSupplier}
                                    onChange={(e) => onFilterChange('selectedSupplier', e.target.value)}
                                    className="w-full py-2.5 pl-3 pr-8 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                                >
                                    {suppliers.map((sup) => (
                                        <option key={sup} value={sup}>
                                            {sup}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Extension
                            </label>
                            <div className="relative">
                                <select
                                    value={filterState.selectedExtension}
                                    onChange={(e) => onFilterChange('selectedExtension', e.target.value)}
                                    className="w-full py-2.5 pl-3 pr-8 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                                >
                                    <option value="all">All Extensions</option>
                                    <option value="jpg">.jpg / .jpeg</option>
                                    <option value="png">.png</option>
                                    <option value="pdf">.pdf</option>
                                    <option value="word">.doc / .docx (Word)</option>
                                    <option value="excel">.xls / .xlsx (Excel)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Date Range
                            </label>
                            <div className="relative">
                                <select
                                    value={filterState.dateRange}
                                    onChange={(e) => onFilterChange('dateRange', e.target.value as any)}
                                    className="w-full py-2.5 pl-3 pr-8 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all cursor-pointer shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">Last 7 Days</option>
                                    <option value="month">Last 30 Days</option>
                                    <option value="year">Last Year</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Active Filters
                            </label>
                            <div className="min-h-9.5 p-1 bg-[#ebf0f7] dark:bg-[#14151c] rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25)] flex flex-wrap items-center gap-1.5">
                                {filterState.selectedCategory !== 'All' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs">
                                        <span>{filterState.selectedCategory}</span>
                                        <button
                                            onClick={() => onFilterChange('selectedCategory', 'All')}
                                            className="p-0.5 hover:bg-pink-200/60 rounded transition-colors text-pink-700 dark:text-pink-300 cursor-pointer"
                                            title="Remove filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {filterState.selectedExtension !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs">
                                        <span className="uppercase">.{filterState.selectedExtension}</span>
                                        <button
                                            onClick={() => onFilterChange('selectedExtension', 'all')}
                                            className="p-0.5 hover:bg-pink-200/60 rounded transition-colors text-pink-700 dark:text-pink-300 cursor-pointer"
                                            title="Remove filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {filterState.selectedSupplier !== 'All' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs">
                                        <span>{filterState.selectedSupplier}</span>
                                        <button
                                            onClick={() => onFilterChange('selectedSupplier', 'All')}
                                            className="p-0.5 hover:bg-purple-200/60 rounded transition-colors text-purple-700 dark:text-purple-300 cursor-pointer"
                                            title="Remove filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {filterState.dateRange !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50 shadow-2xs">
                                        <span className="capitalize">{filterState.dateRange}</span>
                                        <button
                                            onClick={() => onFilterChange('dateRange', 'all')}
                                            className="p-0.5 hover:bg-emerald-200/60 rounded transition-colors text-emerald-700 dark:text-emerald-300 cursor-pointer"
                                            title="Remove filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {filterState.selectedCategory === 'All' &&
                                    filterState.selectedSupplier === 'All' &&
                                    filterState.dateRange === 'all' &&
                                    !filterState.searchTerm && (
                                        <span className="text-xs text-slate-400 dark:text-slate-500 italic px-2">
                                            No active filters applied
                                        </span>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
