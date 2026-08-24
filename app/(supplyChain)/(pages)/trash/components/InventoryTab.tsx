'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { BulkActionsToolbar } from '@/app/(supplyChain)/components/global/BulkActionsToolbar';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { sanitizeSearch, sanitizeText } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import Cards from '@/app/(supplyChain)/components/global/Cards';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';

interface ArchivedItem {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    current_stock: number;
    unit: string;
    archived_at: string;
    archived_by: string;
    archived_reason?: string;
    status: 'available' | 'low-stock' | 'out-of-stock';
    original_status?: string;
}

const ITEMS_PER_PAGE = 10;

export function InventoryTab() {
    const { confirm } = useConfirm();

    const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [itemPage, setItemPage] = useState(1);
    const [itemTotalPages, setItemTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Mock data - replace with actual API call
    const fetchArchivedItems = useCallback(async () => {
        setItemsLoading(true);
        try {
            const mockData: ArchivedItem[] = [
                {
                    id: 'arch1',
                    item_code: 'ITM-2023-001',
                    item_name: 'Old Server Rack',
                    category: 'Equipment',
                    current_stock: 1,
                    unit: 'unit',
                    archived_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
                    archived_by: 'John Doe',
                    archived_reason: 'Discontinued model - replaced with new version',
                    status: 'out-of-stock',
                },
                {
                    id: 'arch2',
                    item_code: 'ITM-2023-002',
                    item_name: 'CRT Monitor',
                    category: 'Equipment',
                    current_stock: 3,
                    unit: 'unit',
                    archived_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
                    archived_by: 'Jane Smith',
                    archived_reason: 'Obsolete technology - no longer supported',
                    status: 'out-of-stock',
                },
                {
                    id: 'arch3',
                    item_code: 'ITM-2023-003',
                    item_name: 'Floppy Disk Drive',
                    category: 'Equipment',
                    current_stock: 5,
                    unit: 'unit',
                    archived_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
                    archived_by: 'Mike Johnson',
                    archived_reason: 'No longer used in daily operations',
                    status: 'out-of-stock',
                },
                {
                    id: 'arch4',
                    item_code: 'ITM-2023-004',
                    item_name: 'Fax Machine',
                    category: 'Equipment',
                    current_stock: 2,
                    unit: 'unit',
                    archived_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
                    archived_by: 'Sarah Wilson',
                    archived_reason: 'Replaced by digital alternatives',
                    status: 'out-of-stock',
                },
            ];

            setArchivedItems(mockData);
            setItemTotalPages(Math.ceil(mockData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived items:', error);
            toast.error('Failed to load archived items');
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const handleRestoreItem = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'Restore Item',
            message: `Are you sure you want to restore "${sanitizeText(name)}" to active inventory?`,
            confirmText: 'Restore Item',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setItemsLoading(true);
            try {
                setArchivedItems(prev => prev.filter(item => item.id !== id));
                setSelectedItemIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(id);
                    return updated;
                });
                setItemTotalPages(Math.ceil((archivedItems.length - 1) / ITEMS_PER_PAGE));
                toast.success(`"${sanitizeText(name)}" restored successfully`);
            } catch (error) {
                toast.error('Failed to restore item');
                console.error(error);
            } finally {
                setItemsLoading(false);
            }
        }
    };

    const handleDeleteItemPermanently = async (id: string, name: string) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete "${sanitizeText(name)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setItemsLoading(true);
            try {
                setArchivedItems(prev => prev.filter(item => item.id !== id));
                setSelectedItemIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(id);
                    return updated;
                });
                setItemTotalPages(Math.ceil((archivedItems.length - 1) / ITEMS_PER_PAGE));
                toast.success(`"${sanitizeText(name)}" permanently deleted`);
            } catch (error) {
                toast.error('Failed to delete item');
                console.error(error);
            } finally {
                setItemsLoading(false);
            }
        }
    };

    const handleBulkRestoreItems = async () => {
        if (selectedItemIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedItemIds.size} Items`,
            message: `Are you sure you want to restore ${selectedItemIds.size} item(s) to active inventory?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setItemsLoading(true);
            try {
                setArchivedItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
                setItemTotalPages(Math.ceil((archivedItems.length - selectedItemIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedItemIds.size} item(s) restored successfully!`);
                setSelectedItemIds(new Set());
            } catch (error) {
                toast.error('Failed to restore items');
                console.error(error);
            } finally {
                setItemsLoading(false);
            }
        }
    };

    const handleBulkDeleteItems = async () => {
        if (selectedItemIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedItemIds.size} Items Permanently`,
            message: `Are you sure you want to permanently delete ${selectedItemIds.size} item(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setItemsLoading(true);
            try {
                setArchivedItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
                setItemTotalPages(Math.ceil((archivedItems.length - selectedItemIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedItemIds.size} item(s) permanently deleted.`);
                setSelectedItemIds(new Set());
            } catch (error) {
                toast.error('Failed to delete items');
                console.error(error);
            } finally {
                setItemsLoading(false);
            }
        }
    };

    const formatDate = (dateString: string) => {
        if (!isMounted) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(sanitizeSearch(e.target.value));
    };

    const filteredItems = useMemo(() => {
        const search = sanitizeSearch(debouncedSearchTerm);
        return archivedItems.filter(item => {
            const matchesSearch = item.item_name.toLowerCase().includes(search.toLowerCase()) ||
                item.item_code.toLowerCase().includes(search.toLowerCase()) ||
                (item.archived_reason && item.archived_reason.toLowerCase().includes(search.toLowerCase()));
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [archivedItems, debouncedSearchTerm, categoryFilter]);

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    const paginatedItems = getPaginatedData(filteredItems, itemPage);
    const itemCategories = useMemo(() => ['all', ...Array.from(new Set(archivedItems.map(item => item.category)))], [archivedItems]);
    const isAllItemsSelected = filteredItems.length > 0 && selectedItemIds.size === filteredItems.length;

    useEffect(() => {
        setItemTotalPages(Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE)));
        if (itemPage > Math.ceil(filteredItems.length / ITEMS_PER_PAGE)) {
            setItemPage(1);
        }
    }, [filteredItems.length, itemPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedItems();
    }, []);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fa-solid fa-boxes-stacked"
                    header="Total Archived"
                    data={String(archivedItems.length)}
                    arrow="fa-solid fa-folder-open"
                    description="Inventory items"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Archived Inventory"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total Archived: ${archivedItems.length} item(s)\nTotal Stock: ${archivedItems.reduce((sum, item) => sum + item.current_stock, 0)} units`}
                    tooltip="View inventory archive"
                    frontTextColor="text-pink-500 dark:text-pink-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />

                <Cards
                    frontIcon="fa-solid fa-tags"
                    header="Categories"
                    data={String(Math.max(0, itemCategories.length - 1))}
                    arrow="fa-solid fa-layer-group"
                    description="Distinct categories"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Item Categories"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Categories: ${itemCategories.filter(c => c !== 'all').join(', ') || 'None'}`}
                    tooltip="View item categories"
                    frontTextColor="text-indigo-500 dark:text-indigo-400"
                    descriptionTextColor="text-indigo-600 dark:text-indigo-400"
                />

                <Cards
                    frontIcon="fa-solid fa-cubes"
                    header="Total Stock"
                    data={String(archivedItems.reduce((sum, item) => sum + item.current_stock, 0))}
                    arrow="fa-solid fa-cubes-stacked"
                    description="Units archived"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Stock Details"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Cumulative stock volume across all ${archivedItems.length} archived items`}
                    tooltip="View stock details"
                    frontTextColor="text-emerald-500 dark:text-emerald-400"
                    descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                />

                <Cards
                    frontIcon="fa-solid fa-scale-balanced"
                    header="Unit Types"
                    data={String(new Set(archivedItems.map(item => item.unit).filter(Boolean)).size)}
                    arrow="fa-solid fa-ruler-combined"
                    description="Measurement units"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Unit Breakdown"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Units: ${Array.from(new Set(archivedItems.map(item => item.unit).filter(Boolean))).join(', ') || 'None'}`}
                    tooltip="View unit types"
                    frontTextColor="text-blue-500 dark:text-blue-400"
                    descriptionTextColor="text-blue-600 dark:text-blue-400"
                />
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            placeholder="Search item name or code..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            {itemCategories.map(cat => (
                                <option key={cat} value={cat} className="dark:bg-slate-900">
                                    {cat === 'all' ? 'All Categories' : cat}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(searchTerm || categoryFilter !== 'all' || selectedItemIds.size > 0) && (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            onClick={() => {
                                setSearchTerm('');
                                setCategoryFilter('all');
                                setSelectedItemIds(new Set());
                            }}
                        >
                            <i className="fas fa-rotate-left text-[11px]"></i>
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            <BulkActionsToolbar
                selectedCount={selectedItemIds.size}
                itemLabel="items"
                singleItemLabel="item"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestoreItems,
                        variant: 'success',
                        isLoading: itemsLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeleteItems,
                        variant: 'danger',
                        isLoading: itemsLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedItemIds(new Set())}
            />

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="overflow-x-auto relative">
                    {itemsLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllItemsSelected}
                                onChange={() => {
                                    if (isAllItemsSelected) {
                                        setSelectedItemIds(new Set());
                                    } else {
                                        setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredItems.length}</span>
                        </label>
                        {selectedItemIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedItemIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro">
                        <thead>
                            <tr>
                                <th className="w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllItemsSelected}
                                        onChange={() => {
                                            if (isAllItemsSelected) {
                                                setSelectedItemIds(new Set());
                                            } else {
                                                setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th>Code</th>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Unit</th>
                                <th>Archived By</th>
                                <th>Archived At</th>
                                <th>Reason</th>
                                <th className="text-right! w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-trash-can text-xl"></i>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">No archived items found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item) => {
                                    const isSelected = selectedItemIds.has(item.id);
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSelected = new Set(selectedItemIds);
                                                        if (newSelected.has(item.id)) newSelected.delete(item.id);
                                                        else newSelected.add(item.id);
                                                        setSelectedItemIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                                {item.item_code}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                {item.item_name}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                                                {item.current_stock}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                                                {item.unit}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {item.archived_by}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                {formatDate(item.archived_at)}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={item.archived_reason || ''}>
                                                {item.archived_reason || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap w-[130px] min-w-[130px]">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <CrudActionButton
                                                        action="restore"
                                                        ariaLabel={`Restore item ${item.item_name}`}
                                                        title="Restore Item"
                                                        disabled={itemsLoading}
                                                        onClick={() => handleRestoreItem(item.id, item.item_name)}
                                                    />
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete item ${item.item_name} permanently`}
                                                        title="Delete Permanently"
                                                        disabled={itemsLoading}
                                                        onClick={() => handleDeleteItemPermanently(item.id, item.item_name)}
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

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {paginatedItems.length > 0 ? ((itemPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(itemPage * ITEMS_PER_PAGE, filteredItems.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredItems.length}
                        </span> items
                    </span>
                    <Pagination
                        currentPage={itemPage}
                        totalPages={itemTotalPages}
                        onPageChange={setItemPage}
                    />
                </div>
            </div>
        </div>
    );
}