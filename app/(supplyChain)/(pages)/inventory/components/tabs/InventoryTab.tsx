// app/(supplyChain)/inventory/components/tabs/InventoryTab.tsx

'use client';

import { InventoryItem } from '../../types';
import { getStatusBadge } from '../../utils/helpers';
import { sanitizeSearch } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';

interface InventoryTabProps {
    items: InventoryItem[];
    totalItems: number;
    currentPage: number;
    totalPages: number;
    searchTerm: string;
    categoryFilter: string;
    statusFilter: string;
    selectedIds: Set<string>;
    itemsPerPage: number;
    isLoading?: boolean;
    onSearchChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onPageChange: (page: number) => void;
    onSelectAll: () => void;
    onSelect: (id: string) => void;
    onClearFilters: () => void;
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string, name: string) => void;
    onStockIn: (itemName: string) => void;
    onStockOut: (itemName: string) => void;
    onAddItem: () => void;
}

export function InventoryTab({
    items,
    totalItems,
    currentPage,
    totalPages,
    searchTerm,
    categoryFilter,
    statusFilter,
    selectedIds,
    itemsPerPage,
    isLoading = false,
    onSearchChange,
    onCategoryChange,
    onStatusChange,
    onPageChange,
    onSelectAll,
    onSelect,
    onClearFilters,
    onEdit,
    onDelete,
    onStockIn,
    onStockOut,
    onAddItem,
}: InventoryTabProps) {
    const allSelected = items.length > 0 && selectedIds.size === items.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

    // Calculate the correct range display
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-slate-950/50 overflow-hidden transition-colors flex flex-col">
            {/* Filter Bar - Stays fixed */}
            <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-3 bg-slate-50/60 dark:bg-slate-900/40 backdrop-blur-md">
                <div className="relative flex-1 min-w-[220px] max-w-xs group">
                    <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                    <input
                        className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-2xs"
                        placeholder="Search by item name or code..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(sanitizeSearch(e.target.value))}
                    />
                </div>

                <div className="relative min-w-[160px] group">
                    <i className="fas fa-filter absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                    <select
                        className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pl-9 pr-8 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer shadow-2xs appearance-none"
                        value={categoryFilter}
                        onChange={(e) => onCategoryChange(e.target.value)}
                    >
                        <option value="all" className="dark:bg-slate-900">All Categories</option>
                        <option value="Packaging Materials" className="dark:bg-slate-900">Packaging Materials</option>
                        <option value="Warehouse Supplies" className="dark:bg-slate-900">Warehouse Supplies</option>
                        <option value="Equipment" className="dark:bg-slate-900">Equipment</option>
                        <option value="Warehouse Equipment" className="dark:bg-slate-900">Warehouse Equipment</option>
                    </select>
                    <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none"></i>
                </div>

                <div className="relative min-w-[150px] group">
                    <i className="fas fa-tag absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-pink-500 text-xs pointer-events-none transition-colors"></i>
                    <select
                        className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pl-9 pr-8 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 dark:focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/20 transition-all cursor-pointer shadow-2xs appearance-none"
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value)}
                    >
                        <option value="all" className="dark:bg-slate-900">All Statuses</option>
                        <option value="available" className="dark:bg-slate-900">Available</option>
                        <option value="low-stock" className="dark:bg-slate-900">Low Stock</option>
                        <option value="out-of-stock" className="dark:bg-slate-900">Out of Stock</option>
                    </select>
                    <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[10px] pointer-events-none"></i>
                </div>

                <button
                    className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 active:scale-95 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                    onClick={onClearFilters}
                >
                    <i className="fas fa-times text-[11px]"></i>
                    Clear filters
                </button>
            </div>

            {/* Scrollable Table Container - Only this scrolls */}
            <div className="flex-1 overflow-y-auto max-h-[500px] relative">

                {isLoading && <TableContentLoader />}

                <table className="table-pro p-1">
                    <thead>
                        <tr>
                            <th className="w-10 text-center">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={onSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 transition-colors"
                                />
                            </th>
                            <th className="w-12">#</th>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2.5">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-inner">
                                            <i className="fas fa-box-open text-xl"></i>
                                        </div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">No inventory items found</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">Try adjusting your active filters or search parameters</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            items.map((item, index) => {
                                const isSelected = selectedIds.has(item.id);
                                return (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors duration-150 group ${isSelected
                                            ? 'bg-pink-50/50 dark:bg-pink-500/10'
                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                            }`}
                                    >
                                        <td data-label="" className="text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onSelect(item.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 transition-colors"
                                            />
                                        </td>
                                        <td data-label="#" className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </td>
                                        <td data-label="Item Name" className="text-slate-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                                            {item.item_name}
                                        </td>
                                        <td data-label="Category" className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-medium border border-slate-200/60 dark:border-slate-700/50">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td data-label="Stock" className="text-slate-900 dark:text-slate-100 font-bold whitespace-nowrap font-mono">
                                            {item.current_stock}
                                        </td>
                                        <td data-label="Status" className="whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border
                                    ${item.status === 'available'
                                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-600 dark:bg-emerald-500/40 dark:text-emerald-200 dark:border-emerald-800'
                                                        : item.status === 'low-stock'
                                                            ? 'bg-amber-100 text-amber-700 border-amber-600 dark:bg-amber-500/40 dark:text-amber-200 dark:border-amber-800'
                                                            : 'bg-rose-100 text-rose-700 border-rose-600 dark:bg-rose-500/40 dark:text-rose-200 dark:border-rose-800'
                                                    }`}
                                            >
                                                {item.status === 'available'
                                                    ? 'Available'
                                                    : item.status === 'low-stock'
                                                        ? 'Low Stock'
                                                        : 'Out of Stock'}
                                            </span>
                                        </td>
                                        <td data-label="Actions" className="text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => onStockIn(item.item_name)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/20 active:scale-95 rounded-lg transition-all border border-emerald-100 dark:border-emerald-500/20 shadow-2xs"
                                                    title="Stock In"
                                                >
                                                    <i className="fas fa-arrow-down text-[10px]"></i>
                                                    <span>In</span>
                                                </button>

                                                <button
                                                    onClick={() => onStockOut(item.item_name)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100/70 dark:hover:bg-amber-500/20 active:scale-95 rounded-lg transition-all border border-amber-100 dark:border-amber-500/20 shadow-2xs"
                                                    title="Stock Out"
                                                >
                                                    <i className="fas fa-arrow-up text-[10px]"></i>
                                                    <span>Out</span>
                                                </button>

                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="inline-flex items-center justify-center p-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                                                    title="Edit Item"
                                                >
                                                    <i className="fas fa-edit text-[11px]"></i>
                                                </button>

                                                <button
                                                    onClick={() => onDelete(item.id, item.item_name)}
                                                    className="inline-flex items-center justify-center p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all active:scale-95"
                                                    title="Delete Item"
                                                >
                                                    <i className="fas fa-trash text-[11px]"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Bar - FIXED - Stays fixed */}
            <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{startIndex}</span> to{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{endIndex}</span> of{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{totalItems}</span> items
                </span>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
}