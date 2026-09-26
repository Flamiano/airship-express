// supplier directory table component with search, filtering, and pagination

"use client";

import React from "react";
import { Supplier } from "../../types";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { CrudActionButton } from "../../../../components/ui/CrudActionButton";
import { Pagination } from "../../../../components/global/pagination";
import { SupplierDirectorySkeleton } from "../../../../components/ui/SkeletonLoader";

interface SupplierDirectoryTableProps {
    isLoading: boolean;
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    categoryFilter: string;
    setCategoryFilter: (val: string) => void;
    categories: string[];
    filteredSuppliers: Supplier[];
    paginatedSuppliers: Supplier[];
    selectedSuppliers: Set<number>;
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    setCurrentPage: (page: number) => void;
    onToggleSelect: (id: number) => void;
    onSelectAll: () => void;
    onBulkDelete: () => void;
    onClearSelection: () => void;
    onToggleActive: (id: number, currentStatus: boolean) => void;
    onViewSupplier: (supplier: Supplier) => void;
    onEditSupplier: (supplier: Supplier) => void;
    onDeleteSupplier: (id: number, name: string) => void;
}

export function SupplierDirectoryTable({
    isLoading,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    categories,
    filteredSuppliers,
    paginatedSuppliers,
    selectedSuppliers,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    onToggleSelect,
    onSelectAll,
    onBulkDelete,
    onClearSelection,
    onToggleActive,
    onViewSupplier,
    onEditSupplier,
    onDeleteSupplier,
}: SupplierDirectoryTableProps) {
    return (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75),-6px_-6px_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] flex flex-col">
            {/* filter bar */}
            <div className="flex-shrink-0 pb-4 mb-3 border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.35),inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.9)] text-pink-500 dark:text-pink-400 flex items-center justify-center">
                        <i className="fas fa-building text-xs" />
                    </div>
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        Supplier Directory
                    </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 sm:flex-initial sm:w-64">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full py-2 pl-8 pr-3 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-all"
                        />
                    </div>

                    <div className="relative w-full sm:w-44">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            aria-label="Filter by category"
                            className="w-full py-2 pl-3 pr-8 bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-pink-500 transition-all cursor-pointer appearance-none"
                        >
                            <option value="">All categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat} className="dark:bg-slate-900 dark:text-slate-200">
                                    {cat}
                                </option>
                            ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none" />
                    </div>

                    {selectedSuppliers.size > 0 && (
                        <button
                            type="button"
                            onClick={onBulkDelete}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200/70 dark:border-rose-800/50 rounded-2xl shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95 shrink-0"
                        >
                            <i className="fas fa-trash-alt text-[10px]" />
                            <span>Delete Selected ({selectedSuppliers.size})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* bulk selection toolbar */}
            {selectedSuppliers.size > 0 && (
                <div className="px-4 py-2.5 mb-3 bg-[#ebf0f7] dark:bg-[#14151c] rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-xl bg-gradient-to-b from-pink-500 to-pink-600 text-white font-bold text-xs border border-pink-400/80 shadow-[0_2px_6px_rgba(236,72,153,0.3)]">
                            {selectedSuppliers.size}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {selectedSuppliers.size} supplier{selectedSuppliers.size > 1 ? 's' : ''} selected
                        </span>
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="text-[11px] text-slate-500 hover:text-pink-600 dark:hover:text-pink-400 underline font-medium cursor-pointer ml-1"
                        >
                            Deselect all
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onBulkDelete}
                            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/50 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)]"
                        >
                            <i className="fas fa-trash-alt text-[10px]" />
                            <span>Delete Selected ({selectedSuppliers.size})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* scrollable table */}
            <div className="flex-1 overflow-y-auto md:max-h-[500px] relative">
                {isLoading ? (
                    <SupplierDirectorySkeleton rows={itemsPerPage} />
                ) : filteredSuppliers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        No suppliers found
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-[#ebf0f7]/40 dark:bg-[#14151c]/40 shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.25)]">
                        <table className="table-pro w-full text-left text-xs border-collapse p-1" id="supplierTableId">
                            <thead className="bg-[#e4ebf5] dark:bg-[#14151c] border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="w-10 py-3.5 px-4">
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedSuppliers.size === filteredSuppliers.length &&
                                                filteredSuppliers.length > 0
                                            }
                                            onChange={onSelectAll}
                                            aria-label="Select all suppliers"
                                            className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer accent-pink-600"
                                        />
                                    </th>
                                    <th className="py-3.5 px-4">Supplier ID</th>
                                    <th className="py-3.5 px-4">Supplier Name</th>
                                    <th className="py-3.5 px-4">Category</th>
                                    <th className="py-3.5 px-4">Contact</th>
                                    <th className="py-3.5 px-4">Location</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4 text-right! sm:w-[150px] sm:min-w-[150px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                {paginatedSuppliers.map((supplier) => (
                                    <tr
                                        key={supplier.id}
                                        onClick={() => onViewSupplier(supplier)}
                                        className="hover:bg-white/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                    >
                                        <td data-label="Select" className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-between md:justify-center w-full">
                                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSuppliers.has(supplier.id)}
                                                        onChange={() => onToggleSelect(supplier.id)}
                                                        aria-label={`Select ${supplier.name}`}
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-pink-500 focus:ring-pink-500 dark:focus:ring-offset-slate-900 cursor-pointer accent-pink-600"
                                                    />
                                                    <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select Supplier</span>
                                                </label>
                                                <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60">
                                                    SUP-{String(supplier.id).padStart(3, '0')}
                                                </span>
                                            </div>
                                        </td>
                                        <td data-label="Supplier ID" className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400 text-right sm:text-left">
                                            SUP-{String(supplier.id).padStart(3, '0')}
                                        </td>
                                        <td data-label="Supplier Name" className="py-3 px-4">
                                            <div className="text-right sm:text-left min-w-0 max-w-[220px] sm:max-w-none ml-auto sm:ml-0">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{supplier.name}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{supplier.email}</div>
                                            </div>
                                        </td>
                                        <td data-label="Category" className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium text-right sm:text-left">
                                            {supplier.category}
                                        </td>
                                        <td data-label="Contact" className="py-3 px-4">
                                            <div className="text-right sm:text-left min-w-0 max-w-[220px] sm:max-w-none ml-auto sm:ml-0">
                                                <div className="text-slate-800 dark:text-slate-200 font-medium truncate">{supplier.contact_person}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{supplier.phone}</div>
                                            </div>
                                        </td>
                                        <td data-label="Location" className="py-3 px-4 text-slate-700 dark:text-slate-300 text-right sm:text-left truncate max-w-[200px] sm:max-w-none ml-auto sm:ml-0">
                                            {supplier.location}
                                        </td>
                                        <td data-label="Status" className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end sm:justify-start">
                                                <StatusBadge
                                                    tone={supplier.is_active ? 'emerald' : 'neutral'}
                                                    dot
                                                    size="xs"
                                                    interactive
                                                    onClick={() => onToggleActive(supplier.id, supplier.is_active)}
                                                    title={`Click to set ${supplier.name} as ${supplier.is_active ? 'Inactive' : 'Active'}`}
                                                >
                                                    {supplier.is_active ? 'Active' : 'Inactive'}
                                                </StatusBadge>
                                            </div>
                                        </td>
                                        <td data-label="Action" className="py-3 px-4 text-right sm:w-[150px] sm:min-w-[150px] w-full" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
                                                <CrudActionButton
                                                    action="view"
                                                    ariaLabel={`View ${supplier.name}`}
                                                    onClick={() => onViewSupplier(supplier)}
                                                />
                                                <CrudActionButton
                                                    action="edit"
                                                    ariaLabel={`Edit ${supplier.name}`}
                                                    onClick={() => onEditSupplier(supplier)}
                                                />
                                                <CrudActionButton
                                                    action="delete"
                                                    ariaLabel={`Delete ${supplier.name}`}
                                                    onClick={() => onDeleteSupplier(supplier.id, supplier.name)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* pagination */}
            <div className="flex-shrink-0 pagination-container-class flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-800 dark:text-white">
                            {filteredSuppliers.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                            {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                            {filteredSuppliers.length}
                        </span> suppliers
                    </span>

                    {selectedSuppliers.size > 0 && (
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200/60 dark:border-slate-800 animate-in fade-in duration-150">
                            <span className="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/80 dark:border-pink-900/40 shadow-[inset_1px_1px_2px_rgba(166,175,195,0.2)]">
                                {selectedSuppliers.size} selected
                            </span>

                            <button
                                onClick={onBulkDelete}
                                className="px-3 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200/70 dark:border-rose-800/50 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                            >
                                <i className="fas fa-trash-alt text-xs" />
                                <span>Delete Selected</span>
                            </button>

                            <button
                                onClick={onClearSelection}
                                className="w-7 h-7 rounded-xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/70 dark:border-[#2a2b38] shadow-[2px_2px_4px_rgba(166,175,195,0.3),-2px_-2px_4px_rgba(255,255,255,0.9)] transition-all cursor-pointer active:scale-95"
                                title="Clear selection"
                                aria-label="Clear selection"
                            >
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                    )}
                </div>

                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
        </div>
    );
}
