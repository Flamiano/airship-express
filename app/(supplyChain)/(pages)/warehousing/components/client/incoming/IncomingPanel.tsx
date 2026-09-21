"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { fetchParcels } from "../../../actions/incoming/incomingPanel";
import { fetchBatchMockParcels, batchInsertOfflineParcels } from "../../../actions/incoming/offlineActions";
import IncomingHeader from "./IncomingHeader";
import ScanPanel from "./ScanPanel";
import TableFilters from "./TableFilters";
import { IncomingTable } from "./ParcelTable";
import { supabase } from "../../../../../lib/services/client/supabase";
import { TableSkeleton } from "../../../../../components/ui/SkeletonLoader";
import { getOfflineScans, removeOfflineScan, updateMultipleOfflineScans } from "./offlineStorage";
import { user } from "../../../../../lib/services/Class/user";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    region: string | null;
    courier: string | null;
    scanned_by: string | null;
    scanned_at: string;
    status: 'pending' | 'verified' | 'rejected' | 'not_synced';
    is_fetched?: boolean;
}

export default function IncomingPanel() {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ scanned: 0, topCourier: '' });
    const [filter, setFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFetchingMock, setIsFetchingMock] = useState(false);
    const [isAddingToQueue, setIsAddingToQueue] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);
    const limit = 15;
    const isMounted = useRef(true);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const subscriptionRef = useRef<any>(null);

    const getOfflineParcelsList = useCallback((): Parcel[] => {
        const offlineList = getOfflineScans();
        const currentUserId = user.getUserId() || user.getName() || null;
        return offlineList.map((scan, index) => ({
            id: -(index + 1) * 1000 - (new Date(scan.scanned_at).getTime() || (Date.now() + index)),
            barcode: scan.barcode,
            tracking_number: scan.tracking_number || scan.barcode,
            sender_name: scan.sender_name || null,
            customer_name: scan.customer_name || null,
            customer_number: scan.customer_number || null,
            destination: scan.destination || null,
            region: scan.region || null,
            courier: scan.courier || null,
            scanned_by: currentUserId,
            scanned_at: scan.scanned_at,
            status: 'not_synced' as const,
            is_fetched: scan.is_fetched || false,
        }));
    }, []);

    // Track online/offline status and local offline storage updates
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine);
            const handleOnline = () => setIsOnline(true);
            const handleOffline = () => setIsOnline(false);
            const handleOfflineStorageUpdate = () => {
                const offlineList = getOfflineParcelsList();
                setParcels(prev => {
                    const dbParcels = prev.filter(p => p.status !== 'not_synced');
                    const dbBarcodes = new Set(dbParcels.map(p => p.barcode.toUpperCase()));
                    const remainingOffline = offlineList.filter(op => !dbBarcodes.has(op.barcode.toUpperCase()));
                    return [...remainingOffline, ...dbParcels];
                });
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            window.addEventListener('offline_scans_updated', handleOfflineStorageUpdate);
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                window.removeEventListener('offline_scans_updated', handleOfflineStorageUpdate);
            };
        }
    }, [getOfflineParcelsList]);

    const fetchParcelsData = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            } else {
                setIsRefreshing(true);
            }
            const result = await fetchParcels({
                filter: filter || undefined,
                search: search || undefined,
                page,
                limit,
            });

            const offlineParcels = getOfflineParcelsList();

            if (!result.success) {
                if (showLoading) {
                    toast.error(result.error || 'Failed to load parcels from server', {
                        duration: 5000,
                    });
                }
                // Even if network fails, show locally stored offline parcels
                if (isMounted.current) {
                    setParcels(offlineParcels);
                    setTotalItems(offlineParcels.length);
                    setTotalPages(1);
                    setStats({ scanned: offlineParcels.length, topCourier: '' });
                    setLastUpdate(new Date());
                }
                return;
            }

            if (isMounted.current) {
                const dbBarcodes = new Set(result.data.map(p => p.barcode.toUpperCase()));
                // Filter out any offline items that might have already been inserted into db
                const pendingOffline = offlineParcels.filter(op => {
                    if (dbBarcodes.has(op.barcode.toUpperCase())) {
                        removeOfflineScan(op.barcode);
                        return false;
                    }
                    return true;
                });

                setParcels([...pendingOffline, ...result.data]);
                setTotalItems(result.pagination.total + pendingOffline.length);
                setTotalPages(result.pagination.totalPages || 1);
                setStats({
                    ...result.stats,
                    scanned: result.stats.scanned + pendingOffline.length,
                });
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Error fetching parcels:', error);
            const offlineParcels = getOfflineParcelsList();
            if (isMounted.current) {
                setParcels(offlineParcels);
                setTotalItems(offlineParcels.length);
            }
            if (showLoading) {
                toast.error('Failed to load parcels', {
                    description: error instanceof Error ? error.message : 'Please refresh the page',
                    duration: 5000,
                });
            }
        } finally {
            if (showLoading) {
                setLoading(false);
            } else {
                setIsRefreshing(false);
            }
        }
    }, [filter, search, page, limit, getOfflineParcelsList]);

    const updateStatsOnly = useCallback(async () => {
        try {
            const result = await fetchParcels({
                filter: filter || undefined,
                search: search || undefined,
                page: 1,
                limit: 1,
            });
            const offlineList = getOfflineScans();
            if (result.success && isMounted.current) {
                setStats({
                    ...result.stats,
                    scanned: result.stats.scanned + offlineList.length,
                });
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }, [filter, search]);

    const handleRealtimeUpdate = useCallback(() => {
        if (!isMounted.current) return;
        requestAnimationFrame(() => {
            fetchParcelsData(false);
        });
    }, [fetchParcelsData]);

    const handleScan = useCallback((scannedBarcode?: string, isOffline?: boolean) => {
        if (scannedBarcode) {
            const currentUserId = user.getUserId() || user.getName() || null;
            const offlineCheck = isOffline !== undefined ? isOffline : (typeof window !== 'undefined' && !navigator.onLine);
            const optimisticParcel: Parcel = {
                id: -Date.now(),
                barcode: scannedBarcode,
                tracking_number: scannedBarcode,
                sender_name: null,
                customer_name: null,
                customer_number: null,
                destination: null,
                region: null,
                courier: null,
                scanned_by: currentUserId,
                scanned_at: new Date().toISOString(),
                status: offlineCheck ? 'not_synced' : 'pending',
                is_fetched: false,
            };
            setParcels(prev => {
                if (prev.some(p => p.barcode.toUpperCase() === scannedBarcode.toUpperCase())) return prev;
                return [optimisticParcel, ...prev];
            });
            setStats(prev => ({
                ...prev,
                scanned: prev.scanned + 1
            }));
            setTotalItems(prev => prev + 1);
            setLastUpdate(new Date());
        }
    }, []);

    // 1. Fetch data from mock_third_party_parcels
    const handleFetchMockData = useCallback(async (parcelsToFetch?: Parcel[]) => {
        const notSynced = parcelsToFetch || parcels.filter(p => p.status === 'not_synced');
        if (!notSynced || notSynced.length === 0) return;

        if (typeof window !== 'undefined' && !navigator.onLine) {
            toast.error('Offline', {
                description: 'You are currently offline. Connect to the internet to fetch data from mock third-party parcels.',
                duration: 4000,
            });
            return;
        }

        setIsFetchingMock(true);
        const toastId = toast.loading(`Querying mock_third_party_parcels for ${notSynced.length} parcel(s)...`);

        try {
            const barcodes = notSynced.map(p => p.barcode);
            const result = await fetchBatchMockParcels(barcodes);

            if (!result.success || !result.data) {
                toast.error(result.error || 'Failed to query mock parcel details', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            const resultMap = new Map(result.data.map(m => [m.barcode.toUpperCase(), m]));

            // Update offlineStorage
            const updatedOffline = notSynced.map(p => {
                const mock = resultMap.get(p.barcode.toUpperCase());
                return {
                    barcode: p.barcode,
                    scanned_at: p.scanned_at,
                    tracking_number: mock?.tracking_number || p.tracking_number,
                    sender_name: mock?.sender_name || null,
                    customer_name: mock?.customer_name || null,
                    customer_number: mock?.customer_number || null,
                    destination: mock?.destination || null,
                    courier: mock?.courier || null,
                    courier_id: mock?.courier_id || null,
                    region: mock?.region || null,
                    city: mock?.city || null,
                    is_fetched: true,
                };
            });
            updateMultipleOfflineScans(updatedOffline);

            // Update state
            setParcels(prev => prev.map(p => {
                if (p.status === 'not_synced') {
                    const mock = resultMap.get(p.barcode.toUpperCase());
                    if (mock) {
                        return {
                            ...p,
                            tracking_number: mock.tracking_number || p.tracking_number,
                            sender_name: mock.sender_name || null,
                            customer_name: mock.customer_name || null,
                            customer_number: mock.customer_number || null,
                            destination: mock.destination || null,
                            courier: mock.courier || null,
                            region: mock.region || null,
                            is_fetched: true,
                        };
                    }
                }
                return p;
            }));

            toast.success(`Fetched data for ${notSynced.length} parcel(s) from mock database`, {
                id: toastId,
                description: 'Parcel details updated in table. Click "Add in Queue" to insert into database.',
                duration: 4000,
            });
        } catch (error) {
            console.error('Error fetching mock data:', error);
            toast.error('Failed to fetch mock parcel details', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsFetchingMock(false);
        }
    }, [parcels]);

    // 2. Add into receiving queue table
    const handleAddInQueue = useCallback(async (parcelsToInsert?: Parcel[]) => {
        const notSynced = parcelsToInsert || parcels.filter(p => p.status === 'not_synced');
        if (!notSynced || notSynced.length === 0) return;

        if (typeof window !== 'undefined' && !navigator.onLine) {
            toast.error('Offline', {
                description: 'You are currently offline. Connect to the internet to add parcels into the receiving queue.',
                duration: 4000,
            });
            return;
        }

        setIsAddingToQueue(true);
        const toastId = toast.loading(`Inserting ${notSynced.length} parcel(s) into receiving queue table...`);

        try {
            const barcodes = notSynced.map(p => p.barcode);
            // Fetch any missing mock data first if needed
            const mockResult = await fetchBatchMockParcels(barcodes);

            if (!mockResult.success || !mockResult.data) {
                toast.error(mockResult.error || 'Failed to prepare parcel data for insertion', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            const currentUserId = user.getUserId() || user.getName() || undefined;
            const insertResult = await batchInsertOfflineParcels(mockResult.data, currentUserId);

            if (!insertResult.success) {
                toast.error(insertResult.error || 'Failed to insert parcels into receiving queue table', {
                    id: toastId,
                    duration: 5000,
                });
                return;
            }

            // Remove synced barcodes from offline storage
            barcodes.forEach(b => removeOfflineScan(b));

            toast.success(`Successfully added ${insertResult.insertedCount || notSynced.length} parcel(s) to receiving queue`, {
                id: toastId,
                duration: 3500,
            });

            // Refresh table list from database
            fetchParcelsData(false);
        } catch (error) {
            console.error('Error inserting offline parcels into queue:', error);
            toast.error('Failed to insert parcels into queue', {
                id: toastId,
                description: error instanceof Error ? error.message : 'Please try again',
                duration: 5000,
            });
        } finally {
            setIsAddingToQueue(false);
        }
    }, [parcels, fetchParcelsData]);

    const handleAddManual = useCallback(() => {
        setStats(prev => ({
            ...prev,
            scanned: prev.scanned + 1
        }));
        handleRealtimeUpdate();
    }, [handleRealtimeUpdate]);

    const handleDelete = useCallback((parcelId: number) => {
        setParcels(prev => {
            const target = prev.find(p => p.id === parcelId);
            if (target && (target.status === 'not_synced' || target.id < 0)) {
                removeOfflineScan(target.barcode);
            }
            return prev.filter(p => p.id !== parcelId);
        });
        setStats(prev => ({
            ...prev,
            scanned: Math.max(0, prev.scanned - 1)
        }));
        setTotalItems(prev => Math.max(0, prev - 1));
        setLastUpdate(new Date());
    }, []);

    const handleBatchDelete = useCallback((deletedIds: number[]) => {
        setParcels(prev => {
            const targets = prev.filter(p => deletedIds.includes(p.id));
            targets.forEach(t => {
                if (t.status === 'not_synced' || t.id < 0) {
                    removeOfflineScan(t.barcode);
                }
            });
            return prev.filter(p => !deletedIds.includes(p.id));
        });
        setStats(prev => ({
            ...prev,
            scanned: Math.max(0, prev.scanned - deletedIds.length)
        }));
        setTotalItems(prev => Math.max(0, prev - deletedIds.length));
        setLastUpdate(new Date());
    }, []);

    useEffect(() => {
        console.log('Setting up real-time subscription...');
        const subscription = supabase
            .channel('incoming_panel_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'receiving_queue',
            }, (payload) => {
                console.log('Real-time update received:', payload.eventType);
                if (!isMounted.current) return;

                if (payload.eventType === 'INSERT') {
                    const newRow = payload.new as Parcel;
                    if (newRow && newRow.status === 'pending') {
                        setParcels(prev => {
                            const existsIndex = prev.findIndex(p => p.barcode === newRow.barcode || p.id === newRow.id);
                            if (existsIndex !== -1) {
                                const copy = [...prev];
                                copy[existsIndex] = newRow;
                                return copy;
                            }
                            return [newRow, ...prev];
                        });
                        setStats(prev => ({
                            ...prev,
                            scanned: prev.scanned + 1
                        }));
                        setTotalItems(prev => prev + 1);
                        setLastUpdate(new Date());
                    }
                } else if (payload.eventType === 'DELETE') {
                    const oldRow = payload.old as { id: number };
                    if (oldRow && oldRow.id) {
                        setParcels(prev => prev.filter(p => p.id !== oldRow.id));
                        setStats(prev => ({
                            ...prev,
                            scanned: Math.max(0, prev.scanned - 1)
                        }));
                        setTotalItems(prev => Math.max(0, prev - 1));
                        setLastUpdate(new Date());
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const updatedRow = payload.new as Parcel;
                    if (updatedRow) {
                        if (updatedRow.status !== 'pending') {
                            setParcels(prev => prev.filter(p => p.id !== updatedRow.id));
                            setStats(prev => ({
                                ...prev,
                                scanned: Math.max(0, prev.scanned - 1)
                            }));
                            setTotalItems(prev => Math.max(0, prev - 1));
                        } else {
                            setParcels(prev => prev.map(p => (p.id === updatedRow.id || p.barcode === updatedRow.barcode) ? updatedRow : p));
                        }
                        setLastUpdate(new Date());
                    }
                }

                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }
                refreshTimeoutRef.current = setTimeout(() => {
                    updateStatsOnly();
                }, 800);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Real-time subscription active');
                }
            });

        subscriptionRef.current = subscription;
        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
            }
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [updateStatsOnly]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // page change
    const handlePageChange = useCallback((newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    }, [totalPages]);

    // filter change
    const handleFilterChange = useCallback((courier: string) => {
        setFilter(courier);
        setPage(1);
    }, []);

    // search
    const handleSearch = useCallback((searchTerm: string) => {
        setSearch(searchTerm);
        setPage(1);
    }, []);

    // initial load
    useEffect(() => {
        isMounted.current = true;
        fetchParcelsData(true);
        return () => {
            isMounted.current = false;
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [filter, search, page]);

    const formatTime = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleTimeString();
    };

    const notSyncedParcels = parcels.filter(p => p.status === 'not_synced');
    const notSyncedCount = notSyncedParcels.length;
    const hasNoData = !loading && parcels.length === 0;

    return (
        <div data-panel="incoming" className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 mx-auto min-h-screen bg-slate-50/50 card">
            <section className="space-y-5">
                <IncomingHeader onReceiveAll={() => fetchParcelsData(true)}/>
                <ScanPanel scanned={stats.scanned} topCourier={stats.topCourier} onScan={handleScan}/>
            </section>

            {notSyncedCount > 0 && (
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-4 transition-colors">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                            <i className="fas fa-satellite-dish text-sm"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {notSyncedCount} Offline Scan{notSyncedCount > 1 ? 's' : ''} (Not Synced)
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isOnline
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {isOnline ? 'Online — Ready to Sync' : 'Offline — Connect to Sync'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                                {isOnline
                                    ? 'Fetch third-party parcel details or add all offline scans directly to the receiving queue.'
                                    : 'Scans are saved locally. Connect to the internet to fetch data and insert into the database.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={() => handleFetchMockData(notSyncedParcels)}
                            disabled={!isOnline || isFetchingMock}
                            title={!isOnline ? "Connect to internet to fetch mock data" : "Fetch details from mock third-party parcels"}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            <i className={`fas ${isFetchingMock ? 'fa-spinner fa-spin' : 'fa-database'} text-xs text-slate-500 dark:text-slate-400`}></i>
                            <span>{isFetchingMock ? 'Fetching...' : '1. Fetch Data'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleAddInQueue(notSyncedParcels)}
                            disabled={!isOnline || isAddingToQueue}
                            title={!isOnline ? "Connect to internet to insert into receiving queue" : "Insert all not-synced parcels into receiving queue"}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white border border-emerald-600 dark:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            <i className={`fas ${isAddingToQueue ? 'fa-spinner fa-spin' : 'fa-inbox'} text-xs`}></i>
                            <span>{isAddingToQueue ? 'Adding...' : '2. Add in Queue'}</span>
                        </button>
                    </div>
                </div>
            )}

            <section className="space-y-4">
                <TableFilters onFilterChange={handleFilterChange} onSearch={handleSearch} onAddManual={handleAddManual}/>

                <div className="flex items-center justify-between">
                    {isRefreshing && !loading && (
                        <div className="flex items-center gap-2 px-1 text-xs font-medium text-slate-500 animate-pulse">
                            <i className="fas fa-arrows-rotate fa-spin text-pink-500 text-[11px]"></i>
                            <span>Syncing...</span>
                        </div>
                    )}
                    <div className="flex-1"></div>
                    {mounted && lastUpdate && (
                        <span className="text-[10px] text-slate-400">
                            <i className="far fa-clock mr-1"></i>
                            Updated: {formatTime(lastUpdate)}
                        </span>
                    )}
                </div>

                {loading ? (
                    <TableSkeleton rows={8}/>
                ) : hasNoData ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-12 text-center transition-colors">
                        <div className="relative z-10 max-w-md mx-auto space-y-4">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/60 mx-auto">
                                <i className="fas fa-inbox text-xl"></i>
                            </div>

                            <div className="space-y-1.5">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    {filter || search ? 'No Matching Parcels Found' : 'Receiving Queue is Empty'}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                    {filter || search ? (
                                        <>No parcels match your current filter criteria. Try clearing your filters or search term to see all queue items.</>
                                    ) : (
                                        <>All incoming parcels have been processed into inventory. Scan a new barcode or add an entry manually to begin receiving.</>
                                    )}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                                {filter || search ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilter("");
                                            setSearch("");
                                            setPage(1);
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        <i className="fas fa-undo-alt text-[11px]"></i>
                                        <span>Clear Filters</span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (typeof window !== 'undefined' && window.openManualEntryModal) {
                                                    window.openManualEntryModal();
                                                }
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white border border-pink-600 text-xs font-semibold transition-colors cursor-pointer"
                                        >
                                            <i className="fas fa-plus text-[11px]"></i>
                                            <span>Add Manual Entry</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => fetchParcelsData(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        >
                                            <i className="fas fa-sync-alt text-[11px]"></i>
                                            <span>Refresh List</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <IncomingTable
                        initialParcels={parcels}
                        onDelete={handleDelete}
                        onBatchDelete={handleBatchDelete}
                        onFetchMockData={handleFetchMockData}
                        onAddInQueue={handleAddInQueue}
                        isOnline={isOnline}
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        onPageChange={handlePageChange}
                        onRefresh={() => fetchParcelsData(true)}
                        isLoading={isRefreshing}
                    />
                )}
            </section>
        </div>
    );
}
