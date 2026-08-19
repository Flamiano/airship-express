'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { BulkActionsToolbar } from '@/app/(supplyChain)/components/global/BulkActionsToolbar';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { sanitizeSearch, sanitizeText, sanitizeNumber } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import Cards from '@/app/(supplyChain)/components/global/Cards';

interface ArchivedPurchaseOrder {
    id: string;
    po_number: string;
    request_id: string | null;
    supplier_id: number | null;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string | null;
    notes: string | null;
    items: any[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string;
    deleted_by: string;
    deletion_reason: string | null;
    original_id: string;
}

const ITEMS_PER_PAGE = 10;

export function PurchaseOrdersTab() {
    const { confirm } = useConfirm();

    const [archivedPurchaseOrders, setArchivedPurchaseOrders] = useState<ArchivedPurchaseOrder[]>([]);
    const [poLoading, setPoLoading] = useState(false);
    const [poSearchTerm, setPoSearchTerm] = useState('');
    const [poStatusFilter, setPoStatusFilter] = useState('all');
    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(new Set());
    const [poPage, setPoPage] = useState(1);
    const [poTotalPages, setPoTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedPoSearchTerm = useDebounce(poSearchTerm, 300);

    const fetchArchivedPurchaseOrders = useCallback(async () => {
        setPoLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchase_orders_archive')
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) throw error;

            const transformedData: ArchivedPurchaseOrder[] = (data || []).map((po: any) => ({
                id: po.id,
                po_number: sanitizeText(po.po_number),
                request_id: po.request_id,
                supplier_id: po.supplier_id ? sanitizeNumber(po.supplier_id) : null,
                supplier_name: sanitizeText(po.supplier_name),
                total_amount: sanitizeNumber(po.total_amount || 0),
                status: sanitizeText(po.status || 'Draft'),
                delivery_date: po.delivery_date,
                notes: po.notes ? sanitizeText(po.notes) : null,
                items: po.items || [],
                created_by: po.created_by ? sanitizeText(po.created_by) : null,
                created_at: po.created_at,
                updated_at: po.updated_at,
                deleted_at: po.deleted_at || new Date().toISOString(),
                deleted_by: sanitizeText(po.deleted_by || 'Unknown'),
                deletion_reason: po.deletion_reason ? sanitizeText(po.deletion_reason) : null,
                original_id: po.original_id || po.id,
            }));

            setArchivedPurchaseOrders(transformedData);
            setPoTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived purchase orders:', error);
            toast.error('Failed to load archived purchase orders');
        } finally {
            setPoLoading(false);
        }
    }, []);

    const handleRestorePurchaseOrder = async (po: ArchivedPurchaseOrder) => {
        const confirmed = await confirm({
            title: 'Restore Purchase Order',
            message: `Are you sure you want to restore "${sanitizeText(po.po_number)}" to active purchase orders?`,
            confirmText: 'Restore',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                const { error: insertError } = await supabase
                    .from('purchase_orders')
                    .insert({
                        id: po.original_id,
                        po_number: po.po_number,
                        request_id: po.request_id,
                        supplier_id: po.supplier_id,
                        supplier_name: po.supplier_name,
                        total_amount: po.total_amount,
                        status: po.status,
                        delivery_date: po.delivery_date,
                        notes: po.notes,
                        items: po.items,
                        created_by: po.created_by,
                        created_at: po.created_at,
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) throw insertError;

                const { error: deleteError } = await supabase
                    .from('purchase_orders_archive')
                    .delete()
                    .eq('id', po.id);

                if (deleteError) throw deleteError;

                setArchivedPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - 1) / ITEMS_PER_PAGE));
                setSelectedPoIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(po.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(po.po_number)}" restored successfully`);
            } catch (error) {
                toast.error('Failed to restore purchase order');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleDeletePurchaseOrderPermanently = async (po: ArchivedPurchaseOrder) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete "${sanitizeText(po.po_number)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                const { error } = await supabase
                    .from('purchase_orders_archive')
                    .delete()
                    .eq('id', po.id);

                if (error) throw error;

                setArchivedPurchaseOrders(prev => prev.filter(p => p.id !== po.id));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - 1) / ITEMS_PER_PAGE));
                setSelectedPoIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(po.id);
                    return updated;
                });
                toast.success(`"${sanitizeText(po.po_number)}" permanently deleted`);
            } catch (error) {
                toast.error('Failed to delete purchase order');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleBulkRestorePurchaseOrders = async () => {
        if (selectedPoIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedPoIds.size} Purchase Orders`,
            message: `Are you sure you want to restore ${selectedPoIds.size} purchase order(s) to active?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                const posToRestore = archivedPurchaseOrders.filter(po => selectedPoIds.has(po.id));
                for (const po of posToRestore) {
                    const { error: insertError } = await supabase
                        .from('purchase_orders')
                        .insert({
                            id: po.original_id,
                            po_number: po.po_number,
                            request_id: po.request_id,
                            supplier_id: po.supplier_id,
                            supplier_name: po.supplier_name,
                            total_amount: po.total_amount,
                            status: po.status,
                            delivery_date: po.delivery_date,
                            notes: po.notes,
                            items: po.items,
                            created_by: po.created_by,
                            created_at: po.created_at,
                            updated_at: new Date().toISOString(),
                        });

                    if (insertError) throw insertError;

                    await supabase
                        .from('purchase_orders_archive')
                        .delete()
                        .eq('id', po.id);
                }

                setArchivedPurchaseOrders(prev => prev.filter(po => !selectedPoIds.has(po.id)));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - selectedPoIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedPoIds.size} purchase order(s) restored successfully!`);
                setSelectedPoIds(new Set());
            } catch (error) {
                toast.error('Failed to restore purchase orders');
                console.error(error);
            } finally {
                setPoLoading(false);
            }
        }
    };

    const handleBulkDeletePurchaseOrders = async () => {
        if (selectedPoIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedPoIds.size} Purchase Orders Permanently`,
            message: `Are you sure you want to permanently delete ${selectedPoIds.size} purchase order(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setPoLoading(true);
            try {
                for (const poId of selectedPoIds) {
                    await supabase
                        .from('purchase_orders_archive')
                        .delete()
                        .eq('id', poId);
                }

                setArchivedPurchaseOrders(prev => prev.filter(po => !selectedPoIds.has(po.id)));
                setPoTotalPages(Math.ceil((archivedPurchaseOrders.length - selectedPoIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedPoIds.size} purchase order(s) permanently deleted.`);
                setSelectedPoIds(new Set());
            } catch (error) {
                toast.error('Failed to delete purchase orders');
                console.error(error);
            } finally {
                setPoLoading(false);
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

    const getStatusBadge = useCallback((status: string) => {
        const sanitizedStatus = sanitizeText(status);
        const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
            'Draft': { bg: "bg-slate-50 dark:bg-slate-700/50", text: "text-slate-600 dark:text-slate-300", dot: "bg-slate-400 dark:bg-slate-500" },
            'Sent': { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-400 dark:bg-blue-500" },
            'Confirmed': { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-400 dark:bg-indigo-500" },
            'Delivered': { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400 dark:bg-emerald-500" },
            'Cancelled': { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", dot: "bg-red-400 dark:bg-red-500" },
        };
        const style = statusMap[sanitizedStatus] || statusMap['Draft'];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {sanitizedStatus.charAt(0).toUpperCase() + sanitizedStatus.slice(1).replace(/_/g, ' ')}
            </span>
        );
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPoSearchTerm(sanitizeSearch(e.target.value));
    };

    const filteredPurchaseOrders = useMemo(() => {
        const search = sanitizeSearch(debouncedPoSearchTerm);
        return archivedPurchaseOrders.filter(po => {
            const matchesSearch = po.po_number.toLowerCase().includes(search.toLowerCase()) ||
                po.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
                (po.notes && po.notes.toLowerCase().includes(search.toLowerCase()));
            const matchesStatus = poStatusFilter === 'all' || po.status === poStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [archivedPurchaseOrders, debouncedPoSearchTerm, poStatusFilter]);

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    const paginatedPurchaseOrders = getPaginatedData(filteredPurchaseOrders, poPage);
    const poStatuses = useMemo(() => ['all', ...Array.from(new Set(archivedPurchaseOrders.map(po => po.status)))], [archivedPurchaseOrders]);
    const isAllPoSelected = filteredPurchaseOrders.length > 0 && selectedPoIds.size === filteredPurchaseOrders.length;

    useEffect(() => {
        setPoTotalPages(Math.max(1, Math.ceil(filteredPurchaseOrders.length / ITEMS_PER_PAGE)));
        if (poPage > Math.ceil(filteredPurchaseOrders.length / ITEMS_PER_PAGE)) {
            setPoPage(1);
        }
    }, [filteredPurchaseOrders.length, poPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedPurchaseOrders();
    }, []);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fa-solid fa-file-invoice"
                    header="Total Archived"
                    data={String(archivedPurchaseOrders.length)}
                    arrow="fa-solid fa-folder-open"
                    description="Purchase orders"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Archived POs"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total Archived: ${archivedPurchaseOrders.length} order(s)\nTotal Value: ₱${archivedPurchaseOrders.reduce((sum, po) => sum + po.total_amount, 0).toLocaleString()}`}
                    tooltip="View purchase order archive"
                    frontTextColor="text-pink-500 dark:text-pink-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />

                <Cards
                    frontIcon="fa-solid fa-coins"
                    header="Total Value"
                    data={`₱${archivedPurchaseOrders.reduce((sum, po) => sum + po.total_amount, 0).toLocaleString()}`}
                    arrow="fa-solid fa-chart-line"
                    description="Archived value"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Financial Summary"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Cumulative value of ${archivedPurchaseOrders.length} archived purchase orders`}
                    tooltip="View value details"
                    frontTextColor="text-emerald-500 dark:text-emerald-400"
                    descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                />

                <Cards
                    frontIcon="fa-solid fa-tags"
                    header="Statuses"
                    data={String(Math.max(0, poStatuses.length - 1))}
                    arrow="fa-solid fa-layer-group"
                    description="Distinct statuses"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Status Categories"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Statuses: ${poStatuses.filter(s => s !== 'all').join(', ') || 'None'}`}
                    tooltip="View status categories"
                    frontTextColor="text-purple-500 dark:text-purple-400"
                    descriptionTextColor="text-purple-600 dark:text-purple-400"
                />

                <Cards
                    frontIcon="fa-solid fa-handshake"
                    header="Suppliers"
                    data={String(new Set(archivedPurchaseOrders.map(po => po.supplier_name).filter(Boolean)).size)}
                    arrow="fa-solid fa-building"
                    description="Distinct suppliers"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Supplier Summary"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Suppliers: ${Array.from(new Set(archivedPurchaseOrders.map(po => po.supplier_name).filter(Boolean))).join(', ') || 'None'}`}
                    tooltip="View supplier details"
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
                            placeholder="Search PO number or supplier..."
                            value={poSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            value={poStatusFilter}
                            onChange={(e) => setPoStatusFilter(e.target.value)}
                        >
                            {poStatuses.map(status => (
                                <option key={status} value={status} className="dark:bg-slate-900">
                                    {status === 'all' ? 'All Statuses' : status}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(poSearchTerm || poStatusFilter !== 'all' || selectedPoIds.size > 0) && (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            onClick={() => {
                                setPoSearchTerm('');
                                setPoStatusFilter('all');
                                setSelectedPoIds(new Set());
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
                selectedCount={selectedPoIds.size}
                itemLabel="purchase orders"
                singleItemLabel="purchase order"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestorePurchaseOrders,
                        variant: 'success',
                        isLoading: poLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeletePurchaseOrders,
                        variant: 'danger',
                        isLoading: poLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedPoIds(new Set())}
            />

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="overflow-x-auto relative">
                    {poLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllPoSelected}
                                onChange={() => {
                                    if (isAllPoSelected) {
                                        setSelectedPoIds(new Set());
                                    } else {
                                        setSelectedPoIds(new Set(filteredPurchaseOrders.map(po => po.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredPurchaseOrders.length}</span>
                        </label>
                        {selectedPoIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedPoIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro">
                        <thead>
                            <tr>
                                <th className="w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllPoSelected}
                                        onChange={() => {
                                            if (isAllPoSelected) {
                                                setSelectedPoIds(new Set());
                                            } else {
                                                setSelectedPoIds(new Set(filteredPurchaseOrders.map(po => po.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th>PO Number</th>
                                <th>Supplier</th>
                                <th>Total Amount</th>
                                <th>Status</th>
                                <th>Deleted By</th>
                                <th>Deleted At</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPurchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-file-invoice text-xl"></i>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">No archived purchase orders found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPurchaseOrders.map((po) => {
                                    const isSelected = selectedPoIds.has(po.id);
                                    return (
                                        <tr
                                            key={po.id}
                                            className={`transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSelected = new Set(selectedPoIds);
                                                        if (newSelected.has(po.id)) newSelected.delete(po.id);
                                                        else newSelected.add(po.id);
                                                        setSelectedPoIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                {po.po_number}
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                                {po.supplier_name}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">
                                                ₱{po.total_amount.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStatusBadge(po.status)}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {po.deleted_by}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                {formatDate(po.deleted_at)}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleRestorePurchaseOrder(po)}
                                                        disabled={poLoading}
                                                        title="Restore Purchase Order"
                                                    >
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                        <span>Restore</span>
                                                    </button>
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleDeletePurchaseOrderPermanently(po)}
                                                        disabled={poLoading}
                                                        title="Delete Permanently"
                                                    >
                                                        <i className="fas fa-trash-can text-[10px]"></i>
                                                        <span>Delete</span>
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

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {paginatedPurchaseOrders.length > 0 ? ((poPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(poPage * ITEMS_PER_PAGE, filteredPurchaseOrders.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredPurchaseOrders.length}
                        </span> orders
                    </span>
                    <Pagination
                        currentPage={poPage}
                        totalPages={poTotalPages}
                        onPageChange={setPoPage}
                    />
                </div>
            </div>
        </div>
    );
}