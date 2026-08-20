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

interface ArchivedParcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string;
    destination: string;
    courier: string;
    status: string;
    created_at: string;
    updated_at: string;
    courier_id: number | null;
    region: string | null;
    bulk_qr_code: string | null;
    driver_name: string | null;
    customer_name: string | null;
    city: string | null;
    priority: string | null;
    date_received: string | null;
    customer_number: string | null;
    received_by: string | null;
    bulk_qr_city: string | null;
    bulk_qr_courier: string | null;
    deleted_at: string;
    deleted_by: string;
    deletion_reason: string | null;
    original_id: number;
}

const ITEMS_PER_PAGE = 10;

export function ParcelsTab() {
    const { confirm } = useConfirm();

    const [archivedParcels, setArchivedParcels] = useState<ArchivedParcel[]>([]);
    const [parcelLoading, setParcelLoading] = useState(false);
    const [parcelSearchTerm, setParcelSearchTerm] = useState('');
    const [parcelStatusFilter, setParcelStatusFilter] = useState('all');
    const [selectedParcelIds, setSelectedParcelIds] = useState<Set<number>>(new Set());
    const [parcelPage, setParcelPage] = useState(1);
    const [parcelTotalPages, setParcelTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const debouncedParcelSearchTerm = useDebounce(parcelSearchTerm, 300);

    const fetchArchivedParcels = useCallback(async () => {
        setParcelLoading(true);
        try {
            const { data, error } = await supabase
                .from('parcels_archive')
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) throw error;

            const transformedData: ArchivedParcel[] = (data || []).map((parcel: any) => ({
                id: parcel.id,
                barcode: sanitizeText(parcel.barcode),
                tracking_number: sanitizeText(parcel.tracking_number),
                sender_name: sanitizeText(parcel.sender_name),
                destination: sanitizeText(parcel.destination),
                courier: sanitizeText(parcel.courier),
                status: sanitizeText(parcel.status || 'sorting'),
                created_at: parcel.created_at,
                updated_at: parcel.updated_at,
                courier_id: parcel.courier_id ? sanitizeNumber(parcel.courier_id) : null,
                region: parcel.region ? sanitizeText(parcel.region) : null,
                bulk_qr_code: parcel.bulk_qr_code ? sanitizeText(parcel.bulk_qr_code) : null,
                driver_name: parcel.driver_name ? sanitizeText(parcel.driver_name) : null,
                customer_name: parcel.customer_name ? sanitizeText(parcel.customer_name) : null,
                city: parcel.city ? sanitizeText(parcel.city) : null,
                priority: parcel.priority ? sanitizeText(parcel.priority) : null,
                date_received: parcel.date_received,
                customer_number: parcel.customer_number ? sanitizeText(parcel.customer_number) : null,
                received_by: parcel.received_by ? sanitizeText(parcel.received_by) : null,
                bulk_qr_city: parcel.bulk_qr_city ? sanitizeText(parcel.bulk_qr_city) : null,
                bulk_qr_courier: parcel.bulk_qr_courier ? sanitizeText(parcel.bulk_qr_courier) : null,
                deleted_at: parcel.deleted_at || new Date().toISOString(),
                deleted_by: sanitizeText(parcel.deleted_by || 'Unknown'),
                deletion_reason: parcel.deletion_reason ? sanitizeText(parcel.deletion_reason) : null,
                original_id: parcel.original_id || parcel.id,
            }));

            setArchivedParcels(transformedData);
            setParcelTotalPages(Math.ceil(transformedData.length / ITEMS_PER_PAGE));
        } catch (error) {
            console.error('Error fetching archived parcels:', error);
            toast.error('Failed to load archived parcels');
        } finally {
            setParcelLoading(false);
        }
    }, []);

    const handleRestoreParcel = async (parcel: ArchivedParcel) => {
        const confirmed = await confirm({
            title: 'Restore Parcel',
            message: `Are you sure you want to restore parcel "${sanitizeText(parcel.barcode)}" to active parcels?`,
            confirmText: 'Restore',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setParcelLoading(true);
            try {
                const { error: insertError } = await supabase
                    .from('parcels')
                    .insert({
                        id: parcel.original_id,
                        barcode: parcel.barcode,
                        tracking_number: parcel.tracking_number,
                        sender_name: parcel.sender_name,
                        destination: parcel.destination,
                        courier: parcel.courier,
                        status: parcel.status,
                        created_at: parcel.created_at,
                        updated_at: new Date().toISOString(),
                        courier_id: parcel.courier_id,
                        region: parcel.region,
                        bulk_qr_code: parcel.bulk_qr_code,
                        driver_name: parcel.driver_name,
                        customer_name: parcel.customer_name,
                        city: parcel.city,
                        priority: parcel.priority,
                        date_received: parcel.date_received,
                        customer_number: parcel.customer_number,
                        received_by: parcel.received_by,
                        bulk_qr_city: parcel.bulk_qr_city,
                        bulk_qr_courier: parcel.bulk_qr_courier,
                    });

                if (insertError) throw insertError;

                const { error: deleteError } = await supabase
                    .from('parcels_archive')
                    .delete()
                    .eq('id', parcel.id);

                if (deleteError) throw deleteError;

                setArchivedParcels(prev => prev.filter(p => p.id !== parcel.id));
                setParcelTotalPages(Math.ceil((archivedParcels.length - 1) / ITEMS_PER_PAGE));
                setSelectedParcelIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(parcel.id);
                    return updated;
                });
                toast.success(`Parcel "${sanitizeText(parcel.barcode)}" restored successfully`);
            } catch (error) {
                toast.error('Failed to restore parcel');
                console.error(error);
            } finally {
                setParcelLoading(false);
            }
        }
    };

    const handleDeleteParcelPermanently = async (parcel: ArchivedParcel) => {
        const confirmed = await confirm({
            title: 'Permanent Delete',
            message: `Are you sure you want to permanently delete parcel "${sanitizeText(parcel.barcode)}"? This action cannot be undone.`,
            confirmText: 'Delete Permanently',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setParcelLoading(true);
            try {
                const { error } = await supabase
                    .from('parcels_archive')
                    .delete()
                    .eq('id', parcel.id);

                if (error) throw error;

                setArchivedParcels(prev => prev.filter(p => p.id !== parcel.id));
                setParcelTotalPages(Math.ceil((archivedParcels.length - 1) / ITEMS_PER_PAGE));
                setSelectedParcelIds(prev => {
                    const updated = new Set(prev);
                    updated.delete(parcel.id);
                    return updated;
                });
                toast.success(`Parcel "${sanitizeText(parcel.barcode)}" permanently deleted`);
            } catch (error) {
                toast.error('Failed to delete parcel');
                console.error(error);
            } finally {
                setParcelLoading(false);
            }
        }
    };

    const handleBulkRestoreParcels = async () => {
        if (selectedParcelIds.size === 0) return;

        const confirmed = await confirm({
            title: `Restore ${selectedParcelIds.size} Parcels`,
            message: `Are you sure you want to restore ${selectedParcelIds.size} parcel(s) to active?`,
            confirmText: 'Restore All',
            confirmVariant: 'success'
        });

        if (confirmed) {
            setParcelLoading(true);
            try {
                const parcelsToRestore = archivedParcels.filter(p => selectedParcelIds.has(p.id));
                for (const parcel of parcelsToRestore) {
                    const { error: insertError } = await supabase
                        .from('parcels')
                        .insert({
                            id: parcel.original_id,
                            barcode: parcel.barcode,
                            tracking_number: parcel.tracking_number,
                            sender_name: parcel.sender_name,
                            destination: parcel.destination,
                            courier: parcel.courier,
                            status: parcel.status,
                            created_at: parcel.created_at,
                            updated_at: new Date().toISOString(),
                            courier_id: parcel.courier_id,
                            region: parcel.region,
                            bulk_qr_code: parcel.bulk_qr_code,
                            driver_name: parcel.driver_name,
                            customer_name: parcel.customer_name,
                            city: parcel.city,
                            priority: parcel.priority,
                            date_received: parcel.date_received,
                            customer_number: parcel.customer_number,
                            received_by: parcel.received_by,
                            bulk_qr_city: parcel.bulk_qr_city,
                            bulk_qr_courier: parcel.bulk_qr_courier,
                        });

                    if (insertError) throw insertError;

                    await supabase
                        .from('parcels_archive')
                        .delete()
                        .eq('id', parcel.id);
                }

                setArchivedParcels(prev => prev.filter(p => !selectedParcelIds.has(p.id)));
                setParcelTotalPages(Math.ceil((archivedParcels.length - selectedParcelIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedParcelIds.size} parcel(s) restored successfully!`);
                setSelectedParcelIds(new Set());
            } catch (error) {
                toast.error('Failed to restore parcels');
                console.error(error);
            } finally {
                setParcelLoading(false);
            }
        }
    };

    const handleBulkDeleteParcels = async () => {
        if (selectedParcelIds.size === 0) return;

        const confirmed = await confirm({
            title: `Delete ${selectedParcelIds.size} Parcels Permanently`,
            message: `Are you sure you want to permanently delete ${selectedParcelIds.size} parcel(s)? This action cannot be undone.`,
            confirmText: 'Delete All',
            confirmVariant: 'danger'
        });

        if (confirmed) {
            setParcelLoading(true);
            try {
                for (const parcelId of selectedParcelIds) {
                    await supabase
                        .from('parcels_archive')
                        .delete()
                        .eq('id', parcelId);
                }

                setArchivedParcels(prev => prev.filter(p => !selectedParcelIds.has(p.id)));
                setParcelTotalPages(Math.ceil((archivedParcels.length - selectedParcelIds.size) / ITEMS_PER_PAGE));
                toast.success(`${selectedParcelIds.size} parcel(s) permanently deleted.`);
                setSelectedParcelIds(new Set());
            } catch (error) {
                toast.error('Failed to delete parcels');
                console.error(error);
            } finally {
                setParcelLoading(false);
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
            'received': { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-400 dark:bg-blue-500" },
            'sorting': { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-400 dark:bg-amber-500" },
            'ready_for_pickup': { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400 dark:bg-emerald-500" },
            'picked_up': { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-400 dark:bg-purple-500" },
            'in_transit': { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-400 dark:bg-indigo-500" },
            'returned': { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-400 dark:bg-rose-500" },
        };
        const style = statusMap[sanitizedStatus] || statusMap['sorting'];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {sanitizedStatus.charAt(0).toUpperCase() + sanitizedStatus.slice(1).replace(/_/g, ' ')}
            </span>
        );
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setParcelSearchTerm(sanitizeSearch(e.target.value));
    };

    const filteredParcels = useMemo(() => {
        const search = sanitizeSearch(debouncedParcelSearchTerm);
        return archivedParcels.filter(parcel => {
            const matchesSearch = parcel.barcode.toLowerCase().includes(search.toLowerCase()) ||
                parcel.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
                parcel.sender_name.toLowerCase().includes(search.toLowerCase()) ||
                parcel.courier.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = parcelStatusFilter === 'all' || parcel.status === parcelStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [archivedParcels, debouncedParcelSearchTerm, parcelStatusFilter]);

    const getPaginatedData = <T,>(data: T[], page: number): T[] => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    };

    const paginatedParcels = getPaginatedData(filteredParcels, parcelPage);
    const parcelStatuses = useMemo(() => ['all', ...Array.from(new Set(archivedParcels.map(p => p.status)))], [archivedParcels]);
    const isAllParcelsSelected = filteredParcels.length > 0 && selectedParcelIds.size === filteredParcels.length;

    useEffect(() => {
        setParcelTotalPages(Math.max(1, Math.ceil(filteredParcels.length / ITEMS_PER_PAGE)));
        if (parcelPage > Math.ceil(filteredParcels.length / ITEMS_PER_PAGE)) {
            setParcelPage(1);
        }
    }, [filteredParcels.length, parcelPage]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedParcels();
    }, []);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Cards
                    frontIcon="fa-solid fa-boxes"
                    header="Total Archived"
                    data={String(archivedParcels.length)}
                    arrow="fa-solid fa-folder-open"
                    description="Parcels"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Archived Parcels"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total Archived: ${archivedParcels.length} parcel(s)`}
                    tooltip="View parcel archive"
                    frontTextColor="text-pink-500 dark:text-pink-400"
                    descriptionTextColor="text-pink-600 dark:text-pink-400"
                />

                <Cards
                    frontIcon="fa-solid fa-truck"
                    header="Couriers"
                    data={String(new Set(archivedParcels.map(p => p.courier)).size)}
                    arrow="fa-solid fa-route"
                    description="Unique couriers"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Courier Breakdown"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Couriers: ${Array.from(new Set(archivedParcels.map(p => p.courier))).filter(Boolean).join(', ') || 'None'}`}
                    tooltip="View courier details"
                    frontTextColor="text-blue-500 dark:text-blue-400"
                    descriptionTextColor="text-blue-600 dark:text-blue-400"
                />

                <Cards
                    frontIcon="fa-solid fa-tags"
                    header="Statuses"
                    data={String(Math.max(0, parcelStatuses.length - 1))}
                    arrow="fa-solid fa-layer-group"
                    description="Distinct statuses"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Parcel Statuses"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Statuses: ${parcelStatuses.filter(s => s !== 'all').join(', ') || 'None'}`}
                    tooltip="View status categories"
                    frontTextColor="text-purple-500 dark:text-purple-400"
                    descriptionTextColor="text-purple-600 dark:text-purple-400"
                />

                <Cards
                    frontIcon="fa-solid fa-location-dot"
                    header="Destinations"
                    data={String(new Set(archivedParcels.map(p => p.destination || p.city).filter(Boolean)).size)}
                    arrow="fa-solid fa-map-pin"
                    description="Unique destinations"
                    backBg="bg-ink dark:bg-ink/90"
                    backHeader="Destination Breakdown"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Destinations: ${Array.from(new Set(archivedParcels.map(p => p.destination || p.city).filter(Boolean))).join(', ') || 'None'}`}
                    tooltip="View destination details"
                    frontTextColor="text-emerald-500 dark:text-emerald-400"
                    descriptionTextColor="text-emerald-600 dark:text-emerald-400"
                />
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            placeholder="Search barcode, tracking, sender, or courier..."
                            value={parcelSearchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 dark:focus:border-pink-500 transition-all shadow-2xs"
                            value={parcelStatusFilter}
                            onChange={(e) => setParcelStatusFilter(e.target.value)}
                        >
                            {parcelStatuses.map(status => (
                                <option key={status} value={status} className="dark:bg-slate-900">
                                    {status === 'all' ? 'All Statuses' : status.replace(/_/g, ' ').toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(parcelSearchTerm || parcelStatusFilter !== 'all' || selectedParcelIds.size > 0) && (
                        <button
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            onClick={() => {
                                setParcelSearchTerm('');
                                setParcelStatusFilter('all');
                                setSelectedParcelIds(new Set());
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
                selectedCount={selectedParcelIds.size}
                itemLabel="parcels"
                singleItemLabel="parcel"
                floating={false}
                actions={[
                    {
                        label: 'Restore Selected',
                        icon: 'fa-undo',
                        onClick: handleBulkRestoreParcels,
                        variant: 'success',
                        isLoading: parcelLoading,
                        mobileLabel: 'Restore',
                    },
                    {
                        label: 'Delete Permanently',
                        icon: 'fa-trash-can',
                        onClick: handleBulkDeleteParcels,
                        variant: 'danger',
                        isLoading: parcelLoading,
                        mobileLabel: 'Delete',
                    },
                ]}
                onClear={() => setSelectedParcelIds(new Set())}
            />

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="overflow-x-auto relative">
                    {parcelLoading && <TableContentLoader />}

                    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllParcelsSelected}
                                onChange={() => {
                                    if (isAllParcelsSelected) {
                                        setSelectedParcelIds(new Set());
                                    } else {
                                        setSelectedParcelIds(new Set(filteredParcels.map(p => p.id)));
                                    }
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Select All</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/80 px-2 py-0.5 rounded-full font-mono">{filteredParcels.length}</span>
                        </label>
                        {selectedParcelIds.size > 0 && (
                            <span className="text-xs font-medium text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/40 px-2.5 py-0.5 rounded-full">
                                {selectedParcelIds.size} selected
                            </span>
                        )}
                    </div>

                    <table className="table-pro">
                        <thead>
                            <tr>
                                <th className="w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllParcelsSelected}
                                        onChange={() => {
                                            if (isAllParcelsSelected) {
                                                setSelectedParcelIds(new Set());
                                            } else {
                                                setSelectedParcelIds(new Set(filteredParcels.map(p => p.id)));
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                    />
                                </th>
                                <th>Barcode</th>
                                <th>Tracking</th>
                                <th>Sender</th>
                                <th>Destination</th>
                                <th>City</th>
                                <th>Courier</th>
                                <th>Status</th>
                                <th>Deleted By</th>
                                <th>Deleted At</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedParcels.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-boxes text-xl"></i>
                                            </div>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300">No archived parcels found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedParcels.map((parcel) => {
                                    const isSelected = selectedParcelIds.has(parcel.id);
                                    return (
                                        <tr
                                            key={parcel.id}
                                            className={`transition-all duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${isSelected ? 'bg-pink-50/30 dark:bg-pink-950/20' : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSelected = new Set(selectedParcelIds);
                                                        if (newSelected.has(parcel.id)) newSelected.delete(parcel.id);
                                                        else newSelected.add(parcel.id);
                                                        setSelectedParcelIds(newSelected);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                {parcel.barcode}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                {parcel.tracking_number}
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                                {parcel.sender_name}
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                                {parcel.destination}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                {parcel.city || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                                {parcel.courier}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStatusBadge(parcel.status)}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                {parcel.deleted_by}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                {formatDate(parcel.deleted_at)}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleRestoreParcel(parcel)}
                                                        disabled={parcelLoading}
                                                        title="Restore Parcel"
                                                    >
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                        <span>Restore</span>
                                                    </button>
                                                    <button
                                                        className="px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all duration-200 font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer hover:scale-105"
                                                        onClick={() => handleDeleteParcelPermanently(parcel)}
                                                        disabled={parcelLoading}
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
                            {paginatedParcels.length > 0 ? ((parcelPage - 1) * ITEMS_PER_PAGE) + 1 : 0}
                        </span> to{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Math.min(parcelPage * ITEMS_PER_PAGE, filteredParcels.length)}
                        </span> of{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {filteredParcels.length}
                        </span> parcels
                    </span>
                    <Pagination
                        currentPage={parcelPage}
                        totalPages={parcelTotalPages}
                        onPageChange={setParcelPage}
                    />
                </div>
            </div>
        </div>
    );
}