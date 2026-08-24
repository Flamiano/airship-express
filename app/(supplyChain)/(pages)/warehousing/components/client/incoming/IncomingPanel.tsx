"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast, Toaster } from "sonner";
import { fetchParcels } from "@/app/(supplyChain)/(pages)/warehousing/actions/incoming/incomingPanel";
import IncomingHeader from "./IncomingHeader";
import ScanPanel from "./ScanPanel";
import TableFilters from "./TableFilters";
import { IncomingTable } from "./ParcelTable";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";

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
    status: 'pending' | 'verified' | 'rejected';
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
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);
    const limit = 15;
    const isMounted = useRef(true);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const subscriptionRef = useRef<any>(null);
    const isInitialLoad = useRef(true);

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

            if (!result.success) {
                if (showLoading) {
                    toast.error(result.error || 'Failed to load parcels', {
                        duration: 5000,
                    });
                }
                if (showLoading) {
                    setLoading(false);
                } else {
                    setIsRefreshing(false);
                }
                return;
            }

            if (isMounted.current) {
                setParcels(result.data);
                setTotalItems(result.pagination.total);
                setTotalPages(result.pagination.totalPages);
                setStats(result.stats);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Error fetching parcels:', error);
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
    }, [filter, search, page, limit]);

    const updateStatsOnly = useCallback(async () => {
        try {
            const result = await fetchParcels({
                filter: filter || undefined,
                search: search || undefined,
                page: 1,
                limit: 1,
            });

            if (result.success && isMounted.current) {
                setStats(result.stats);
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

    const handleScan = useCallback(() => {
        setStats(prev => ({
            ...prev,
            scanned: prev.scanned + 1
        }));
        setTimeout(() => {
            handleRealtimeUpdate();
        }, 500);
    }, [handleRealtimeUpdate]);

    const handleAddManual = useCallback(() => {
        setStats(prev => ({
            ...prev,
            scanned: prev.scanned + 1
        }));
        setTimeout(() => {
            handleRealtimeUpdate();
        }, 500);
    }, [handleRealtimeUpdate]);

    const handleDelete = useCallback((parcelId: number) => {
        setParcels(prev => prev.filter(p => p.id !== parcelId));
        setStats(prev => ({
            ...prev,
            scanned: Math.max(0, prev.scanned - 1)
        }));
        setTotalItems(prev => Math.max(0, prev - 1));
        setTimeout(() => {
            handleRealtimeUpdate();
        }, 500);
    }, [handleRealtimeUpdate]);

    const handleBatchDelete = useCallback((deletedIds: number[]) => {
        setParcels(prev => prev.filter(p => !deletedIds.includes(p.id)));
        setStats(prev => ({
            ...prev,
            scanned: Math.max(0, prev.scanned - deletedIds.length)
        }));
        setTotalItems(prev => Math.max(0, prev - deletedIds.length));
        setTimeout(() => {
            handleRealtimeUpdate();
        }, 500);
    }, [handleRealtimeUpdate]);

    useEffect(() => {
        console.log('Setting up real-time subscription...');

        const subscription = supabase
            .channel('incoming_panel_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'receiving_queue',
                },
                (payload) => {
                    console.log('Real-time update received:', payload.eventType);
                    if (refreshTimeoutRef.current) {
                        clearTimeout(refreshTimeoutRef.current);
                    }
                    refreshTimeoutRef.current = setTimeout(() => {
                        handleRealtimeUpdate();
                    }, 300);
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log(' Real-time subscription active');
                }
            });

        subscriptionRef.current = subscription;

        return () => {
            console.log('Cleaning up real-time subscription...');
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
            }
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [handleRealtimeUpdate]);

    useEffect(() => {
        setMounted(true);
    }, []);

    //  Handle page change
    const handlePageChange = useCallback((newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    }, [totalPages]);

    //  Handle filter change - reset to page 1
    const handleFilterChange = useCallback((courier: string) => {
        setFilter(courier);
        setPage(1);
    }, []);

    //  Handle search - reset to page 1
    const handleSearch = useCallback((searchTerm: string) => {
        setSearch(searchTerm);
        setPage(1);
    }, []);

    //  Initial load
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

    const hasNoData = !loading && parcels.length === 0;

    return (
        <>
            <div
                data-panel="incoming"
                className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 mx-auto min-h-screen bg-slate-50/50"
            >
                <section className="space-y-5">
                    <IncomingHeader onReceiveAll={() => fetchParcelsData(true)} />
                    <ScanPanel
                        scanned={stats.scanned}
                        topCourier={stats.topCourier}
                        onScan={handleScan}
                    />
                </section>

                <section className="space-y-4">
                    <TableFilters
                        onFilterChange={handleFilterChange}
                        onSearch={handleSearch}
                        onAddManual={handleAddManual}
                    />

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
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 animate-pulse">
                            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-12 bg-slate-50 rounded-lg w-full"></div>
                            ))}
                            <div className="flex justify-between items-center pt-2">
                                <div className="h-4 bg-slate-100 rounded w-48"></div>
                                <div className="h-8 bg-slate-100 rounded-lg w-64"></div>
                            </div>
                        </div>
                    ) : hasNoData ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                            <i className="fas fa-box-open text-4xl text-slate-300 mb-4"></i>
                            <h3 className="text-lg font-semibold text-slate-700">No pending parcels</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                There are currently no parcels in the receiving queue.
                                <br />
                                Scan a barcode or add manually to get started.
                            </p>
                            <button
                                onClick={() => fetchParcelsData(true)}
                                className="mt-4 px-4 py-2 text-sm font-medium text-pink-600 hover:text-pink-700 transition-colors"
                            >
                                <i className="fas fa-sync-alt mr-2"></i>
                                Refresh
                            </button>
                        </div>
                    ) : (
                        <IncomingTable
                            initialParcels={parcels}
                            onDelete={handleDelete}
                            onBatchDelete={handleBatchDelete}
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
        </>
    );
}