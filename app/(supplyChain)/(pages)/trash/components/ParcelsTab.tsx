'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/(supplyChain)/components/ui/ConfirmModal';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { BulkActionsToolbar } from '@/app/(supplyChain)/components/global/BulkActionsToolbar';
import { useDebounce } from '@/app/(supplyChain)/hooks/useDebounce';
import { sanitizeSearch, sanitizeText, sanitizeNumber } from '@/app/(supplyChain)/components/global/sanitize';
import { Pagination } from '@/app/(supplyChain)/components/global/pagination';
import { TableContentLoader } from '@/app/(supplyChain)/components/global/Loader';
import Cards from '@/app/(supplyChain)/components/global/Cards';
import { CardsSkeleton, TableRowsSkeleton } from '@/app/(supplyChain)/components/ui/SkeletonLoader';
import { CrudActionButton } from '@/app/(supplyChain)/components/ui/CrudActionButton';
import { StatusBadge } from '@/app/(supplyChain)/components/ui/StatusBadge';
import { AppButton } from '@/app/(supplyChain)/components/ui/AppButton';
import { trashCache } from '../utils/trashCache';
import { TrashRetentionBadge } from './TrashRetentionBadge';

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

    const [archivedParcels, setArchivedParcels] = useState<ArchivedParcel[]>(() => {
        return trashCache.get<ArchivedParcel>('parcels') || [];
    });
    const [parcelLoading, setParcelLoading] = useState<boolean>(() => {
        return !trashCache.get('parcels');
    });
    const [parcelSearchTerm, setParcelSearchTerm] = useState('');
    const [parcelStatusFilter, setParcelStatusFilter] = useState('all');
    const [selectedParcelIds, setSelectedParcelIds] = useState<Set<number>>(new Set());
    const [parcelPage, setParcelPage] = useState(1);
    const [parcelTotalPages, setParcelTotalPages] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedParcelSearchTerm = useDebounce(parcelSearchTerm, 300);

    const fetchArchivedParcels = useCallback(async (force = false) => {
        const cached = trashCache.get<ArchivedParcel>('parcels');
        if (cached && !force && !trashCache.isStale('parcels')) {
            setArchivedParcels(cached);
            setParcelTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
            setParcelLoading(false);
            return;
        }

        if (!cached || cached.length === 0) {
            setParcelLoading(true);
        }

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

            trashCache.set('parcels', transformedData);
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

                trashCache.removeItem('parcels', parcel.id);
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

                trashCache.removeItem('parcels', parcel.id);
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

                trashCache.removeItems('parcels', selectedParcelIds);
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

                trashCache.removeItems('parcels', selectedParcelIds);
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
        const toneMap: Record<string, 'pink' | 'amber' | 'emerald' | 'purple' | 'indigo' | 'rose'> = {
            'received': 'pink',
            'sorting': 'amber',
            'ready_for_pickup': 'emerald',
            'picked_up': 'purple',
            'in_transit': 'indigo',
            'returned': 'rose',
        };
        const tone = toneMap[sanitizedStatus] || 'amber';
        return (
            <StatusBadge tone={tone} dot size="xs">
                {sanitizedStatus.charAt(0).toUpperCase() + sanitizedStatus.slice(1).replace(/_/g, ' ')}
            </StatusBadge>
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

    const paginatedParcels = useMemo(() => {
        const startIndex = (parcelPage - 1) * ITEMS_PER_PAGE;
        return filteredParcels.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredParcels, parcelPage]);

    const parcelStatuses = useMemo(() => ['all', ...Array.from(new Set(archivedParcels.map(p => p.status)))], [archivedParcels]);
    const isAllParcelsSelected = filteredParcels.length > 0 && selectedParcelIds.size === filteredParcels.length;

    useEffect(() => {
        setParcelTotalPages(Math.max(1, Math.ceil(filteredParcels.length / ITEMS_PER_PAGE)));
        if (parcelPage > Math.ceil(filteredParcels.length / ITEMS_PER_PAGE)) {
            setParcelPage(1);
        }
    }, [filteredParcels.length, parcelPage]);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.tagName === 'SELECT' ||
                target?.isContentEditable;

            // '/' or 'Ctrl+K' / 'Cmd+K' to focus search
            if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !isTyping) {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }

            // 'Escape' to clear search or selection
            if (e.key === 'Escape') {
                if (selectedParcelIds.size > 0) {
                    e.preventDefault();
                    setSelectedParcelIds(new Set());
                } else if (parcelSearchTerm || parcelStatusFilter !== 'all') {
                    e.preventDefault();
                    setParcelSearchTerm('');
                    setParcelStatusFilter('all');
                }
                searchInputRef.current?.blur();
                return;
            }

            // 'Ctrl+A' or 'Cmd+A' outside inputs to toggle select all
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isTyping) {
                e.preventDefault();
                if (isAllParcelsSelected) {
                    setSelectedParcelIds(new Set());
                } else {
                    setSelectedParcelIds(new Set(filteredParcels.map(p => p.id)));
                }
                return;
            }

            // 'Delete' or 'Backspace' outside inputs to delete selected
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping && selectedParcelIds.size > 0) {
                e.preventDefault();
                handleBulkDeleteParcels();
                return;
            }

            // 'Alt+R' to restore selected
            if (e.altKey && e.key.toLowerCase() === 'r' && !isTyping && selectedParcelIds.size > 0) {
                e.preventDefault();
                handleBulkRestoreParcels();
                return;
            }

            // 'Alt+ArrowLeft' / 'Alt+ArrowRight' for pagination
            if (e.altKey && e.key === 'ArrowLeft' && !isTyping && parcelPage > 1) {
                e.preventDefault();
                setParcelPage(p => Math.max(1, p - 1));
                return;
            }
            if (e.altKey && e.key === 'ArrowRight' && !isTyping && parcelPage < parcelTotalPages) {
                e.preventDefault();
                setParcelPage(p => Math.min(parcelTotalPages, p + 1));
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        filteredParcels,
        isAllParcelsSelected,
        selectedParcelIds,
        parcelSearchTerm,
        parcelStatusFilter,
        parcelPage,
        parcelTotalPages,
        handleBulkDeleteParcels,
        handleBulkRestoreParcels,
    ]);

    useEffect(() => {
        setIsMounted(true);
        fetchArchivedParcels();

        const unsubscribe = trashCache.subscribe((key, action) => {
            if (!key || key === 'parcels') {
                if (action === 'force-refresh' || action === 'invalidate') {
                    fetchArchivedParcels(true);
                } else {
                    const cached = trashCache.get<ArchivedParcel>('parcels');
                    if (cached) {
                        setArchivedParcels(cached);
                        setParcelTotalPages(Math.ceil(cached.length / ITEMS_PER_PAGE));
                    }
                }
            }
        });

        return unsubscribe;
    }, [fetchArchivedParcels]);

    return (
        <div className="space-y-4 text-slate-900 dark:text-slate-100 animate-in slide-in-from-bottom-4 duration-300">
            {/* stats */}
            {parcelLoading && archivedParcels.length === 0 ? (
                <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4" />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Cards
                        frontIcon="fa-solid fa-boxes"
                        header="Total Archived"
                        data={String(archivedParcels.length)}
                        arrow="fa-solid fa-folder-open"
                        description="Parcels in storage"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Archived Parcels"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Total Archived: ${archivedParcels.length} parcel(s)`}
                        tooltip="View parcel details"
                        frontTextColor="text-pink-500 dark:text-pink-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-truck"
                        header="Couriers"
                        data={String(new Set(archivedParcels.map(p => p.courier)).size)}
                        arrow="fa-solid fa-route"
                        description="Distinct couriers"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Courier Info"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Couriers: ${Array.from(new Set(archivedParcels.map(p => p.courier))).join(', ') || 'None'}`}
                        tooltip="View courier details"
                        frontTextColor="text-indigo-500 dark:text-indigo-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-city"
                        header="Destinations"
                        data={String(new Set(archivedParcels.map(p => p.city || p.destination).filter(Boolean)).size)}
                        arrow="fa-solid fa-map-location-dot"
                        description="Distinct destinations"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Destinations"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Destinations: ${Array.from(new Set(archivedParcels.map(p => p.city || p.destination).filter(Boolean))).join(', ') || 'None'}`}
                        tooltip="View destinations"
                        frontTextColor="text-blue-500 dark:text-blue-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />

                    <Cards
                        frontIcon="fa-solid fa-tags"
                        header="Statuses"
                        data={String(Math.max(0, parcelStatuses.length - 1))}
                        arrow="fa-solid fa-layer-group"
                        description="Distinct statuses"
                        backBg="bg-ink dark:bg-ink/90"
                        backHeader="Status Categories"
                        headerTextColor="text-muted dark:text-white/80"
                        backDescription={`Statuses: ${parcelStatuses.filter(s => s !== 'all').join(', ') || 'None'}`}
                        tooltip="View status categories"
                        frontTextColor="text-purple-500 dark:text-purple-400"
                        descriptionTextColor="text-slate-500 dark:text-slate-400"
                    />
                </div>
            )}

            {/* filter */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs pointer-events-none"></i>
                        <input
                            ref={searchInputRef}
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl pl-9 pr-14 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)]"
                            placeholder="Search barcode, tracking, sender, or courier..."
                            value={parcelSearchTerm}
                            onChange={handleSearchChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    searchInputRef.current?.blur();
                                    if (filteredParcels.length > 0) {
                                        toast.info(`Found ${filteredParcels.length} matching parcel(s)`, { duration: 1500 });
                                    }
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setParcelSearchTerm('');
                                    searchInputRef.current?.blur();
                                }
                            }}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none">
                            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700 select-none">
                                /
                            </kbd>
                        </div>
                    </div>
                    <div className="relative min-w-[150px]">
                        <select
                            className="w-full bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all shadow-[inset_1.5px_1.5px_4px_rgba(166,175,195,0.3),inset_-1.5px_-1.5px_4px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_4px_rgba(0,0,0,0.65)]"
                            value={parcelStatusFilter}
                            onChange={(e) => setParcelStatusFilter(e.target.value)}
                        >
                            {parcelStatuses.map(status => (
                                <option key={status} value={status} className="dark:bg-[#1c1d25]">
                                    {status === 'all' ? 'All Statuses' : status.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {(parcelSearchTerm || parcelStatusFilter !== 'all' || selectedParcelIds.size > 0) && (
                        <AppButton
                            type="button"
                            variant="neutral"
                            size="xs"
                            onClick={() => {
                                setParcelSearchTerm('');
                                setParcelStatusFilter('all');
                                setSelectedParcelIds(new Set());
                            }}
                        >
                            <i className="fas fa-rotate-left text-[11px]" />
                            <span>Reset Filters</span>
                        </AppButton>
                    )}
                </div>
            </div>

            {/* actions */}
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

            {/* table */}
            <div className="rounded-3xl bg-[#f0f3f8] dark:bg-[#191a24] border border-white/80 dark:border-[#2c2d3c] shadow-[8px_8px_24px_rgba(166,175,195,0.4),-8px_-8px_24px_rgba(255,255,255,0.95)] dark:shadow-[10px_10px_30px_rgba(0,0,0,0.75)] overflow-hidden">
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

                    <table className="table-pro w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                                <th className="w-10 text-center py-3 px-4">
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
                                <th className="py-3 px-4">Barcode</th>
                                <th className="py-3 px-4">Tracking</th>
                                <th className="py-3 px-4">Sender</th>
                                <th className="py-3 px-4">Destination</th>
                                <th className="py-3 px-4">City</th>
                                <th className="py-3 px-4">Courier</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Deleted By</th>
                                <th className="py-3 px-4">Deleted At & Auto-Purge</th>
                                <th className="text-right! py-3 px-4 w-[130px] min-w-[130px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                            {parcelLoading ? (
                                <TableRowsSkeleton
                                    rows={8}
                                    columns={[
                                        { type: 'checkbox', width: 'w-10' },
                                        { type: 'mono', width: 'w-24' },
                                        { type: 'mono', width: 'w-28' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'text', width: 'w-32' },
                                        { type: 'text', width: 'w-28' },
                                        { type: 'badge' },
                                        { type: 'badge' },
                                        { type: 'avatar-text', subtext: false },
                                        { type: 'date' },
                                        { type: 'actions', align: 'right', width: 'w-[130px]' },
                                    ]}
                                />
                            ) : paginatedParcels.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-16 h-16 rounded-3xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_2px_2px_5px_rgba(166,175,195,0.35),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65),inset_-1px_-1px_4px_rgba(255,255,255,0.05)] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                                                <i className="fas fa-trash-can text-2xl text-pink-500 dark:text-pink-400"></i>
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No archived parcels found</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Try adjusting your filters or search terms</p>
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
                                            <td data-label="Select" className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-between md:justify-center w-full">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const newSelected = new Set(selectedParcelIds);
                                                                if (newSelected.has(parcel.id)) newSelected.delete(parcel.id);
                                                                else newSelected.add(parcel.id);
                                                                setSelectedParcelIds(newSelected);
                                                            }}
                                                            aria-label={`Select ${parcel.barcode}`}
                                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-pink-500 focus:ring-pink-500/20 cursor-pointer accent-pink-500 bg-transparent"
                                                        />
                                                        <span className="md:hidden text-xs font-semibold text-slate-700 dark:text-slate-200">Select</span>
                                                    </label>
                                                    <span className="md:hidden font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                        {parcel.barcode}
                                                    </span>
                                                </div>
                                            </td>
                                            <td data-label="Barcode" className="py-3 px-4 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.barcode}>{parcel.barcode}</span>
                                            </td>
                                            <td data-label="Tracking" className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.tracking_number}>{parcel.tracking_number}</span>
                                            </td>
                                            <td data-label="Sender" className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.sender_name}>{parcel.sender_name}</span>
                                            </td>
                                            <td data-label="Destination" className="py-3 px-4 text-slate-700 dark:text-slate-300 text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.destination}>{parcel.destination}</span>
                                            </td>
                                            <td data-label="City" className="py-3 px-4 text-slate-600 dark:text-slate-400 text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.city || '—'}>{parcel.city || '—'}</span>
                                            </td>
                                            <td data-label="Courier" className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.courier}>{parcel.courier}</span>
                                            </td>
                                            <td data-label="Status" className="py-3 px-4">
                                                <div className="flex justify-end sm:justify-start">
                                                    {getStatusBadge(parcel.status)}
                                                </div>
                                            </td>
                                            <td data-label="Deleted By" className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium text-right sm:text-left">
                                                <span className="truncate inline-block text-right" title={parcel.deleted_by}>{parcel.deleted_by}</span>
                                            </td>
                                            <td data-label="Deleted At & Auto-Purge" className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                                <div className="flex flex-col items-end sm:items-start gap-1">
                                                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">{formatDate(parcel.deleted_at)}</span>
                                                    <TrashRetentionBadge deletedAt={parcel.deleted_at} />
                                                </div>
                                            </td>
                                            <td data-label="Actions" className="py-3 px-4 text-right whitespace-nowrap sm:w-[130px] sm:min-w-[130px] w-full">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <CrudActionButton
                                                        action="restore"
                                                        ariaLabel={`Restore parcel ${parcel.barcode}`}
                                                        title="Restore Parcel"
                                                        disabled={parcelLoading}
                                                        onClick={() => handleRestoreParcel(parcel)}
                                                    />
                                                    <CrudActionButton
                                                        action="delete"
                                                        ariaLabel={`Delete parcel ${parcel.barcode} permanently`}
                                                        title="Delete Permanently"
                                                        disabled={parcelLoading}
                                                        onClick={() => handleDeleteParcelPermanently(parcel)}
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

                {/* pagination */}
                <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/40">
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