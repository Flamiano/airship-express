// app/(supplyChain)/inventory/components/tabs/InventoryTab.tsx

'use client';

import { InventoryItem } from '../../types';
import { sanitizeSearch } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { ShoppingCart, ArrowDown, ArrowUp } from 'lucide-react';

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
    onStockIn: (itemName: string, item?: InventoryItem) => void;
    onStockOut: (itemName: string) => void;
    onAddItem: () => void;
    onOrderPO?: (item: InventoryItem) => void;
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
    onOrderPO,
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

                <AppButton
                    type="button"
                    variant="neutral"
                    size="sm"
                    className="ml-auto"
                    onClick={onClearFilters}
                >
                    <i className="fas fa-rotate-left text-xs" />
                    <span>Reset</span>
                </AppButton>
            </div>

            {/* Scrollable Table Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[560px] relative">
                {isLoading && <TableContentLoader />}

                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                        <tr>
                            <th className="w-10 px-3.5 py-3 text-center">
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
                            <th className="w-10 px-2 py-3">#</th>
                            <th className="px-4 py-3 min-w-[200px]">Item Information</th>
                            <th className="px-3.5 py-3 min-w-[130px]">Category</th>
                            <th className="px-3.5 py-3 min-w-[110px]">Stock Level</th>
                            <th className="px-3.5 py-3 min-w-[110px]">Status</th>
                            <th className="px-4 py-3 min-w-[180px]">Latest PO / Request</th>
                            <th className="px-4 py-3 min-w-[200px]">Audit / Overrides</th>
                            <th className="px-4 py-3 text-right! min-w-[210px] w-[210px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-20 text-center text-slate-400 dark:text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-inner">
                                            <i className="fas fa-box-open text-2xl"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No inventory items found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Try adjusting your search keywords or active filters</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            items.map((item, index) => {
                                const isSelected = selectedIds.has(item.id);
                                const po = item.latest_po;
                                const isDelivered = po?.status === 'Delivered';
                                const hasReceivableStock = isDelivered && ((po?.quantity_received || 0) < (po?.quantity_ordered || 0));
                                const isForced = Boolean(item.force_updated_at || item.force_updated_by || item.force_reason);

                                const isStockCritical = item.current_stock === 0;
                                const isStockLow = item.current_stock > 0 && item.current_stock <= (item.minimum_stock || 10);

                                return (
                                    <tr
                                        key={item.id}
                                        className={`transition-colors duration-150 group ${isSelected
                                            ? 'bg-pink-50/40 dark:bg-pink-950/20'
                                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <td className="px-3.5 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onSelect(item.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 transition-colors"
                                            />
                                        </td>

                                        {/* Row Index */}
                                        <td className="px-2 py-3 text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </td>

                                        {/* Item Name & Item Code */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 hover:text-pink-600 transition-colors">
                                                        {item.item_name}
                                                    </span>
                                                    {isForced && (
                                                        <span
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shadow-2xs cursor-help"
                                                            title={`OVERRIDE AUDIT:\n• Performed by: ${item.force_updated_by_name || 'Admin'}\n• Timestamp: ${item.force_updated_at ? new Date(item.force_updated_at).toLocaleString() : 'N/A'}\n• Reason: "${item.force_reason || 'Manual override'}"`}
                                                        >
                                                            <i className="fas fa-shield-halved text-[8px] text-amber-600 dark:text-amber-400"></i>
                                                            <span>FORCED</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                        {item.item_code}
                                                    </span>
                                                    {item.storage_location && (
                                                        <span className="text-slate-400 flex items-center gap-1">
                                                            <i className="fas fa-location-dot text-[8px]"></i>
                                                            {item.storage_location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Category */}
                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                            <StatusBadge tone="neutral" size="xs">
                                                {item.category}
                                            </StatusBadge>
                                        </td>

                                        {/* Stock Level */}
                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                            <div className="space-y-0.5">
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-sm font-extrabold font-mono ${
                                                        isStockCritical
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : isStockLow
                                                                ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-slate-900 dark:text-slate-100'
                                                    }`}>
                                                        {item.current_stock}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                         {item.unit}
                                                    </span>
                                                </div>
                                                <span className="block text-[10px] text-slate-400 font-mono">
                                                    Min: {item.minimum_stock || 10}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status Badge */}
                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                            <StatusBadge
                                                tone={
                                                    item.status === 'available'
                                                        ? 'emerald'
                                                        : item.status === 'low-stock'
                                                            ? 'amber'
                                                            : 'rose'
                                                }
                                                dot
                                                size="xs"
                                            >
                                                {item.status === 'available'
                                                    ? 'Available'
                                                    : item.status === 'low-stock'
                                                        ? 'Low Stock'
                                                        : 'Out of Stock'}
                                            </StatusBadge>
                                        </td>

                                        {/* Latest PO / Request */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {po ? (
                                                po.is_request ? (
                                                    <StatusBadge tone="amber" icon="fas fa-clock" size="xs">
                                                        <span className="font-mono">{po.request_number}</span>
                                                        <span className="opacity-85">({po.status})</span>
                                                    </StatusBadge>
                                                ) : (
                                                    <div className="flex flex-col space-y-1">
                                                        <StatusBadge
                                                            tone={isDelivered ? 'pink' : po.status === 'Confirmed' ? 'purple' : 'indigo'}
                                                            icon={`fas ${isDelivered ? 'fa-truck-ramp-box' : 'fa-file-invoice'}`}
                                                            size="xs"
                                                        >
                                                            <span className="font-mono">{po.po_number}</span>
                                                            <span>• {po.status}</span>
                                                        </StatusBadge>
                                                        {po.quantity_ordered && po.quantity_ordered > 0 && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                    {po.quantity_received || 0} / {po.quantity_ordered}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400">received</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 text-xs italic">No PO</span>
                                            )}
                                        </td>

                                        {/* Audit / Overrides Column */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {isForced ? (
                                                <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 space-y-1 max-w-[220px]">
                                                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 truncate">
                                                        <i className="fas fa-user-shield text-[10px] text-amber-600 dark:text-amber-400 shrink-0"></i>
                                                        <span className="truncate">{item.force_updated_by_name || 'Admin'}</span>
                                                    </div>
                                                    {item.force_updated_at && (
                                                        <div className="text-[9px] text-slate-400 font-mono">
                                                            {new Date(item.force_updated_at).toLocaleString([], {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </div>
                                                    )}
                                                    {item.force_reason && (
                                                        <p className="text-[10px] text-slate-600 dark:text-slate-300 italic truncate" title={item.force_reason}>
                                                            "{item.force_reason}"
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 text-xs font-mono pl-2">-</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right whitespace-nowrap min-w-[210px] w-[210px]">
                                            <div className="flex items-center justify-end gap-2.5">
                                                {/* Add / Request PO Button */}
                                                <CrudActionButton
                                                    action="custom"
                                                    label="Order"
                                                    icon={ShoppingCart}
                                                    ariaLabel="Order / Purchase Request"
                                                    title="Order / Purchase Request"
                                                    onClick={() => onOrderPO?.(item)}
                                                />

                                                {/* Stock In Button */}
                                                <CrudActionButton
                                                    action="custom"
                                                    label="In"
                                                    icon={ArrowDown}
                                                    ariaLabel={hasReceivableStock ? `Ready to receive on PO #${po?.po_number}` : 'Stock In'}
                                                    title={hasReceivableStock ? `Ready to receive on PO #${po?.po_number}` : 'Stock In'}
                                                    onClick={() => onStockIn(item.item_name, item)}
                                                />

                                                {/* Stock Out Button */}
                                                <CrudActionButton
                                                    action="custom"
                                                    label="Out"
                                                    icon={ArrowUp}
                                                    ariaLabel="Stock Out"
                                                    title="Stock Out"
                                                    onClick={() => onStockOut(item.item_name)}
                                                />

                                                {/* Edit Button */}
                                                <CrudActionButton
                                                    action="edit"
                                                    ariaLabel="Edit Item"
                                                    title="Edit Item"
                                                    onClick={() => onEdit(item)}
                                                />

                                                {/* Delete Button */}
                                                <CrudActionButton
                                                    action="delete"
                                                    ariaLabel="Delete Item"
                                                    title="Delete Item"
                                                    onClick={() => onDelete(item.id, item.item_name)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Bar - FIXED */}
            <div className="flex-shrink-0 p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    Showing <span className="font-bold text-slate-800 dark:text-slate-200">{startIndex}</span> to{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{endIndex}</span> of{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{totalItems}</span> items
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