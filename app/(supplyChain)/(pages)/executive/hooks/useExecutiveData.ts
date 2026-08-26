"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { toast } from "sonner";

export interface ExecutiveInsight {
    id: string;
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
    metric?: string;
    change?: string;
    actionable?: boolean;
    actionText?: string;
    actionLink?: string;
}

export interface ExecutiveKPI {
    id: string;
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    icon: string;
    color: string;
    description: string;
}

export interface ExecutiveTransaction {
    id: string;
    consignee: string;
    courier: string;
    area: string;
    status: string;
    received: string;
}

export interface OperationsSummaryData {
    receivingQueuePending: number;
    sortingParcels: number;
    deliveredParcels: number;
    anomaliesCount: number;
}

export interface ProcurementSummaryData {
    openPOs: number;
    pendingApprovals: number;
    mtdSpend: number;
    budgetUtilizationPct: number;
}

export interface PageKpisData {
    parcelsToday: number;
    parcelsChangePct: string;
    readyForDispatch: number;
    readyPct: string;
    dispatchedMtd: number;
    dispatchedChangePct: string;
    ontimeRate: string;
}

export interface DailyTrendPoint {
    dayLabel: string;
    dateStr: string;
    receivedCount: number;
    deliveredCount: number;
}

export interface ExecutiveDataPayload {
    parcels: any[];
    inventory: any[];
    procurement: any[];
    documents: any[];
    purchaseOrders: any[];
    receivingQueue: any[];
    couriers: any[];
    suppliers: any[];
    insights: ExecutiveInsight[];
    kpis: ExecutiveKPI[];
    pageKpis: PageKpisData;
    operationsSummary: OperationsSummaryData;
    procurementSummary: ProcurementSummaryData;
    recentTransactions: ExecutiveTransaction[];
    dailyTrend: DailyTrendPoint[];
    courierBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    inventoryCategoryBreakdown: Record<string, number>;
    procurementStatusBreakdown: Record<string, number>;
    documentTypeBreakdown: Record<string, number>;
    supplierCategoryBreakdown: Record<string, number>;
    lastUpdated: string;
}

const CACHE_KEY = "AIRSHIP_EXECUTIVE_DATA_CACHE_V2";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useExecutiveData() {
    const [data, setData] = useState<ExecutiveDataPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);
    const isMounted = useRef(true);

    // hydrate from cache
    useEffect(() => {
        isMounted.current = true;
        try {
            const cachedStr = sessionStorage.getItem(CACHE_KEY);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
                    setData(parsed.payload);
                    setIsLoadedFromCache(true);
                    setLoading(false);
                }
            }
        } catch (err) {
            console.warn("Failed to load executive cache:", err);
        }
    }, []);

    // fetch data
    const fetchData = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) {
            setIsRefreshing(true);
        } else if (!isLoadedFromCache) {
            setLoading(true);
        }

        try {
            const [
                parcelsRes,
                inventoryRes,
                procurementRes,
                documentsRes,
                purchaseOrdersRes,
                receivingQueueRes,
                couriersRes,
                suppliersRes
            ] = await Promise.all([
                supabase
                    .from('parcels')
                    .select('id, barcode, tracking_number, sender_name, destination, courier, status, created_at, region, city')
                    .order('created_at', { ascending: false })
                    .limit(500),
                supabase
                    .from('inventory_items')
                    .select('id, item_code, item_name, category, current_stock, minimum_stock, status, purchase_price, supplier')
                    .limit(500),
                supabase
                    .from('purchase_requests')
                    .select('id, request_number, type, department, supplier_name, amount, priority, status, date, created_at')
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('documents')
                    .select('id, title, file_type, category, document_type, supplier, created_at')
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('purchase_orders')
                    .select('id, po_number, supplier_name, total_amount, status, paid, created_at')
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('receiving_queue')
                    .select('id, barcode, tracking_number, courier, status, scanned_at')
                    .order('scanned_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('couriers')
                    .select('id, code, name, is_active')
                    .order('name', { ascending: true }),
                supabase
                    .from('suppliers')
                    .select('id, name, category, location, is_active')
                    .order('name', { ascending: true }),
            ]);

            if (!isMounted.current) return;

            const parcels = parcelsRes.data || [];
            const inventory = inventoryRes.data || [];
            const procurement = procurementRes.data || [];
            const documents = documentsRes.data || [];
            const purchaseOrders = purchaseOrdersRes.data || [];
            const receivingQueue = receivingQueueRes.data || [];
            const couriers = couriersRes.data || [];
            const suppliers = suppliersRes.data || [];

            // daily parcel trends 7d
            const dailyTrend: DailyTrendPoint[] = [];
            const now = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const receivedCount = parcels.filter(p => p.created_at && p.created_at.startsWith(dStr)).length;
                const deliveredCount = parcels.filter(p => p.created_at && p.created_at.startsWith(dStr) && p.status === 'delivered').length;

                dailyTrend.push({
                    dayLabel,
                    dateStr: dStr,
                    receivedCount,
                    deliveredCount
                });
            }

            // today vs yesterday
            const todayStr = now.toISOString().split('T')[0];
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

            const parcelsTodayCount = parcels.filter(p => p.created_at && p.created_at.startsWith(todayStr)).length;
            const parcelsYesterdayCount = parcels.filter(p => p.created_at && p.created_at.startsWith(yesterdayStr)).length;

            let parcelsChangePct = "0% vs yesterday";
            if (parcelsYesterdayCount > 0) {
                const diffPct = ((parcelsTodayCount - parcelsYesterdayCount) / parcelsYesterdayCount * 100).toFixed(1);
                parcelsChangePct = `${Number(diffPct) >= 0 ? '+' : ''}${diffPct}% vs yesterday`;
            } else if (parcelsTodayCount > 0) {
                parcelsChangePct = `+100% vs yesterday`;
            }

            // dispatch stats mtd
            const readyParcels = parcels.filter(p => p.status === 'ready' || p.status === 'ready_for_pickup' || p.status === 'sorting');
            const readyPctVal = parcels.length > 0 ? ((readyParcels.length / parcels.length) * 100).toFixed(1) : "0.0";

            const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
            const dispatchedParcelsMtd = parcels.filter(p =>
                p.created_at && p.created_at.startsWith(currentMonthStr) &&
                (p.status === 'delivered' || p.status === 'picked_up' || p.status === 'in_transit')
            ).length;

            const deliveredTotal = parcels.filter(p => p.status === 'delivered').length;
            const ontimeRateVal = parcels.length > 0 ? ((deliveredTotal / parcels.length) * 100).toFixed(1) : "0.0";

            const pageKpis: PageKpisData = {
                parcelsToday: parcelsTodayCount,
                parcelsChangePct,
                readyForDispatch: readyParcels.length,
                readyPct: `${readyPctVal}% of total queue`,
                dispatchedMtd: dispatchedParcelsMtd,
                dispatchedChangePct: `${dispatchedParcelsMtd} shipments this month`,
                ontimeRate: `${ontimeRateVal}%`,
            };

            // operations summary
            const receivingQueuePending = receivingQueue.filter(q => q.status === 'pending').length;
            const sortingParcels = parcels.filter(p => p.status === 'sorting').length;
            const deliveredParcels = parcels.filter(p => p.status === 'delivered').length;
            const anomaliesCount = inventory.filter(i => i.current_stock <= i.minimum_stock).length;

            const operationsSummary: OperationsSummaryData = {
                receivingQueuePending,
                sortingParcels,
                deliveredParcels,
                anomaliesCount,
            };

            // procurement summary
            const openPOs = purchaseOrders.filter(po => po.status !== 'Cancelled' && po.status !== 'Delivered').length;
            const pendingApprovals = procurement.filter(pr => pr.status === 'Pending').length;
            const mtdSpend = purchaseOrders
                .filter(po => po.created_at && po.created_at.startsWith(currentMonthStr))
                .reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);
            
            const approvedPRsCount = procurement.filter(pr => pr.status === 'Approved' || pr.status === 'Completed').length;
            const budgetUtilizationPct = procurement.length > 0
                ? Math.round((approvedPRsCount / procurement.length) * 100)
                : 0;

            const procurementSummary: ProcurementSummaryData = {
                openPOs,
                pendingApprovals,
                mtdSpend,
                budgetUtilizationPct,
            };

            // breakdowns
            const courierBreakdown: Record<string, number> = {};
            parcels.forEach(p => {
                const c = (p.courier || 'Unassigned').trim();
                courierBreakdown[c] = (courierBreakdown[c] || 0) + 1;
            });

            const statusBreakdown: Record<string, number> = {};
            parcels.forEach(p => {
                const s = (p.status || 'unknown').trim();
                statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
            });

            const inventoryCategoryBreakdown: Record<string, number> = {};
            inventory.forEach(i => {
                const cat = (i.category || 'General').trim();
                inventoryCategoryBreakdown[cat] = (inventoryCategoryBreakdown[cat] || 0) + 1;
            });

            const procurementStatusBreakdown: Record<string, number> = {};
            procurement.forEach(pr => {
                const st = (pr.status || 'Pending').trim();
                procurementStatusBreakdown[st] = (procurementStatusBreakdown[st] || 0) + 1;
            });

            const documentTypeBreakdown: Record<string, number> = {};
            documents.forEach(d => {
                const dt = (d.document_type || d.category || 'General').trim();
                documentTypeBreakdown[dt] = (documentTypeBreakdown[dt] || 0) + 1;
            });

            const supplierCategoryBreakdown: Record<string, number> = {};
            suppliers.forEach(sup => {
                const cat = (sup.category || 'General').trim();
                supplierCategoryBreakdown[cat] = (supplierCategoryBreakdown[cat] || 0) + 1;
            });

            // recent transactions
            const recentTransactions: ExecutiveTransaction[] = parcels.slice(0, 6).map((p) => ({
                id: p.tracking_number || p.barcode || String(p.id),
                consignee: p.destination || p.sender_name || "Database Record",
                courier: p.courier || "Airship Express",
                area: p.city || p.region || "Central Warehouse",
                status: (p.status || "sorting").replace(/_/g, ' ').toUpperCase(),
                received: p.created_at ? new Date(p.created_at).toLocaleString('sv-SE').slice(0, 16) : "-",
            }));

            // automated insights
            const insights: ExecutiveInsight[] = [];
            if (parcelsTodayCount > 0 || parcelsYesterdayCount > 0) {
                insights.push({
                    id: 'parcel-volume-trend',
                    title: 'Parcel Ingestion Trend',
                    description: parcelsTodayCount >= parcelsYesterdayCount
                        ? `Today's parcel ingestion (${parcelsTodayCount}) is on pace vs yesterday (${parcelsYesterdayCount}).`
                        : `Today's parcel intake (${parcelsTodayCount}) is lower than yesterday (${parcelsYesterdayCount}).`,
                    type: parcelsTodayCount >= parcelsYesterdayCount ? 'positive' : 'neutral',
                    metric: `${parcelsTodayCount} today`,
                    change: parcelsChangePct,
                    actionable: true,
                    actionText: 'View Parcels',
                    actionLink: '/warehousing?tab=incoming',
                });
            }

            if (anomaliesCount > 0) {
                insights.push({
                    id: 'inventory-stock-alert',
                    title: 'Low Stock Alert',
                    description: `${anomaliesCount} items in inventory_items are at or below minimum threshold. Replenishment purchase request recommended.`,
                    type: 'warning',
                    metric: `${anomaliesCount} items`,
                    change: 'Low stock',
                    actionable: true,
                    actionText: 'View Inventory',
                    actionLink: '/inventory',
                });
            }

            if (pendingApprovals > 0) {
                insights.push({
                    id: 'pending-procurement',
                    title: 'Pending Purchase Requests',
                    description: `${pendingApprovals} purchase requests in purchase_requests require manager approval.`,
                    type: 'neutral',
                    metric: `${pendingApprovals} pending`,
                    change: 'Action required',
                    actionable: true,
                    actionText: 'Review Requests',
                    actionLink: '/procurement',
                });
            }

            insights.push({
                id: 'fulfillment-rate',
                title: 'Order Fulfillment Rate',
                description: `${ontimeRateVal}% of total recorded parcels are in delivered status.`,
                type: Number(ontimeRateVal) >= 80 ? 'positive' : 'warning',
                metric: `${ontimeRateVal}%`,
                change: `${deliveredTotal} delivered`,
                actionable: true,
                actionText: 'Inspect Logistics',
                actionLink: '/warehousing?tab=sorting',
            });

            // tab kpis
            const activeCouriersCount = Object.keys(courierBreakdown).length;
            const kpis: ExecutiveKPI[] = [
                {
                    id: 'total-parcels',
                    label: 'Total Parcels',
                    value: parcels.length,
                    change: parcelsChangePct,
                    changeType: parcelsTodayCount >= parcelsYesterdayCount ? 'up' : 'neutral',
                    icon: 'fa-box',
                    color: 'text-pink-500',
                    description: 'Total parcels recorded in database',
                },
                {
                    id: 'delivery-rate',
                    label: 'Delivery Rate',
                    value: `${ontimeRateVal}%`,
                    change: `${deliveredTotal} completed`,
                    changeType: Number(ontimeRateVal) >= 80 ? 'up' : 'neutral',
                    icon: 'fa-check-circle',
                    color: 'text-emerald-500',
                    description: 'Percentage of parcels delivered',
                },
                {
                    id: 'active-couriers',
                    label: 'Active Couriers',
                    value: activeCouriersCount,
                    change: `${couriers.length} registered`,
                    changeType: 'up',
                    icon: 'fa-truck',
                    color: 'text-blue-500',
                    description: 'Couriers handling active shipments',
                },
                {
                    id: 'inventory-items',
                    label: 'Inventory SKUs',
                    value: inventory.length,
                    change: `${anomaliesCount} low stock`,
                    changeType: anomaliesCount > 0 ? 'down' : 'neutral',
                    icon: 'fa-warehouse',
                    color: 'text-amber-500',
                    description: 'Catalogued inventory items in database',
                },
                {
                    id: 'pending-requests',
                    label: 'Pending Requests',
                    value: pendingApprovals,
                    change: `${procurement.length} total PRs`,
                    changeType: 'neutral',
                    icon: 'fa-clock',
                    color: 'text-purple-500',
                    description: 'Purchase requests awaiting approval',
                },
                {
                    id: 'documents',
                    label: 'Documents Logged',
                    value: documents.length,
                    change: `${Object.keys(documentTypeBreakdown).length} categories`,
                    changeType: 'up',
                    icon: 'fa-file-alt',
                    color: 'text-indigo-500',
                    description: 'Archived documents in database',
                },
            ];

            const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            const payload: ExecutiveDataPayload = {
                parcels,
                inventory,
                procurement,
                documents,
                purchaseOrders,
                receivingQueue,
                couriers,
                suppliers,
                insights,
                kpis,
                pageKpis,
                operationsSummary,
                procurementSummary,
                recentTransactions,
                dailyTrend,
                courierBreakdown,
                statusBreakdown,
                inventoryCategoryBreakdown,
                procurementStatusBreakdown,
                documentTypeBreakdown,
                supplierCategoryBreakdown,
                lastUpdated: nowStr,
            };

            setData(payload);

            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    payload,
                }));
            } catch (err) {
                console.warn("Could not save executive data to sessionStorage:", err);
            }

            if (isManualRefresh) {
                toast.success("Executive data revalidated from database!");
            }
        } catch (error) {
            console.error("Error fetching executive data:", error);
            if (isManualRefresh) {
                toast.error("Failed to refresh database metrics");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [isLoadedFromCache]);

    useEffect(() => {
        fetchData();
        return () => {
            isMounted.current = false;
        };
    }, [fetchData]);

    return {
        data,
        loading,
        isRefreshing,
        isLoadedFromCache,
        refresh: () => fetchData(true),
    };
}
