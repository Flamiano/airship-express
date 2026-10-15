"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../../lib/services/client/supabase";
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
    supplier: string;
    department: string;
    amount: string;
    status: string;
    date: string;
    consignee?: string;
    area?: string;
    received?: string;
}

export interface OperationsSummaryData {
    pendingInboundOrders: number;
    activeInventorySkus: number;
    anomaliesCount: number;
    activeSuppliersCount: number;
    totalStockUnits?: number;
    sortingParcels?: number;
    deliveredParcels?: number;
}

export interface ProcurementSummaryData {
    openPOs: number;
    pendingApprovals: number;
    mtdSpend: number;
    budgetUtilizationPct: number;
}

export interface PageKpisData {
    totalStockUnits: number;
    totalStockUnitsFormatted: string;
    inventorySkus: number;
    lowStockAlerts: number;
    openPOs: number;
    mtdSpend: number;
    mtdSpendFormatted: string;
    activeSuppliers: number;
    totalSuppliers: number;
    parcelsToday?: number;
    parcelsChangePct?: string;
    readyForDispatch?: number;
    readyPct?: string;
    dispatchedMtd?: number;
    dispatchedChangePct?: string;
    ontimeRate?: string;
}

export interface DailyTrendPoint {
    dayLabel: string;
    dateStr: string;
    receivedCount: number;
    deliveredCount: number;
}

export interface IssuedPOAnalyticsItem {
    id: string;
    po_number: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string | null;
    items_count: number;
    distinct_items: string[];
    admin_approval: string | null;
    financial_approval: string | null;
    fully_received: boolean;
    delivery_status: 'Fully Received' | 'Partially Received' | 'Awaiting Delivery';
    has_approval_inconsistency: boolean;
    inconsistency_reason?: string;
    created_at: string;
}

export interface IssuedPOsAnalyticsData {
    issuedOrdersCount: number;
    totalApprovedValue: number;
    distinctItemsOrderedCount: number;
    awaitingDeliveryCount: number;
    partiallyReceivedCount: number;
    fullyReceivedCount: number;
    inconsistentApprovalCount: number;
    monthlyTrend: { month: string; count: number; value: number }[];
    issuedOrdersList: IssuedPOAnalyticsItem[];
}

export interface DefectiveIncidentAnalyticsItem {
    id: string;
    incident_number: string;
    item_code: string;
    item_name: string;
    quantity: number;
    unit: string;
    discrepancy_type: string;
    defect_type: string;
    severity: string;
    status: string;
    po_number: string;
    supplier_name: string;
    detected_at_location: string;
    reported_at: string;
    created_at: string;
    action_taken?: string;
}

export interface DefectiveItemsAnalyticsData {
    totalDefectiveUnits: number;
    affectedItemsCount: number;
    affectedDeliveriesCount: number;
    awaitingReviewUnits: number;
    quarantinedUnits: number;
    approvedForReturnUnits: number;
    actuallyReturnedUnits: number;
    categoriesBreakdown: Record<string, number>;
    topSuppliers: { supplier: string; defectiveUnits: number; incidentCount: number }[];
    unresolvedCases: DefectiveIncidentAnalyticsItem[];
    completedCases: DefectiveIncidentAnalyticsItem[];
}

export interface ReplacementCaseAnalyticsItem {
    id: string;
    return_request_number: string;
    incident_id: string;
    po_number: string;
    supplier_name: string;
    item_name: string;
    defective_quantity: number;
    replacement_quantity_received: number;
    outstanding_quantity: number;
    replacement_received_date: string | null;
    status: string;
    qc_condition: string;
    expected_replacement_date: string | null;
    created_at: string;
}

export interface ReplacementItemsAnalyticsData {
    totalReplacementsReceived: number;
    replacementDeliveriesCount: number;
    awaitingFulfillmentCount: number;
    awaitingInspectionUnits: number;
    acceptedAfterInspectionUnits: number;
    rejectedDuringInspectionUnits: number;
    replacementCases: ReplacementCaseAnalyticsItem[];
}

export interface ExecutiveDataPayload {
    parcels: any[];
    inventory: any[];
    procurement: any[];
    documents: any[];
    purchaseOrders: any[];
    suppliers: any[];
    damageIncidents?: any[];
    supplierReturns?: any[];
    issuedPOsAnalytics: IssuedPOsAnalyticsData;
    defectiveItemsAnalytics: DefectiveItemsAnalyticsData;
    replacementAnalytics: ReplacementItemsAnalyticsData;
    insights: ExecutiveInsight[];
    kpis: ExecutiveKPI[];
    pageKpis: PageKpisData;
    operationsSummary: OperationsSummaryData;
    procurementSummary: ProcurementSummaryData;
    recentTransactions: ExecutiveTransaction[];
    dailyTrend: DailyTrendPoint[];
    statusBreakdown: Record<string, number>;
    poStatusBreakdown: Record<string, number>;
    inventoryCategoryBreakdown: Record<string, number>;
    procurementStatusBreakdown: Record<string, number>;
    documentTypeBreakdown: Record<string, number>;
    supplierCategoryBreakdown: Record<string, number>;
    forecast7Day?: any;
    lastUpdated: string;
}

const CACHE_KEY = "AIRSHIP_EXECUTIVE_DATA_CACHE_V8";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface DateRange {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
}

interface FetchDataOptions {
    isManualRefresh?: boolean;
    isSilent?: boolean;
    dateRange?: DateRange | null;
}

export function useExecutiveData() {
    const [data, setData] = useState<ExecutiveDataPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);
    const [activeDateRange, setActiveDateRange] = useState<DateRange | null>(null);
    const isMounted = useRef(true);
    // keep the latest applied range accessible inside the fetchData callback
    const activeDateRangeRef = useRef<DateRange | null>(null);

    // hydrate from cache
    useEffect(() => {
        isMounted.current = true;
        try {
            // Clean up any stale older cache versions (V1 to V7)
            if (typeof window !== "undefined") {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith("AIRSHIP_EXECUTIVE_DATA_CACHE_") && key !== CACHE_KEY) {
                        sessionStorage.removeItem(key);
                    }
                }
            }

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
    const fetchData = useCallback(async (options: boolean | FetchDataOptions = false) => {
        const isManual = typeof options === 'boolean' ? options : !!options?.isManualRefresh;
        const isSilent = typeof options === 'object' && !!options?.isSilent;
        // use explicitly passed range, or fall back to the ref (last applied)
        const rawRange =
            typeof options === 'object' && options?.dateRange !== undefined
                ? options.dateRange
                : activeDateRangeRef.current;

        const range: DateRange | null = (() => {
            if (!rawRange || (!rawRange.from && !rawRange.to)) return null;
            let from = (rawRange.from || rawRange.to || '').trim();
            let to = (rawRange.to || rawRange.from || '').trim();
            if (!from && !to) return null;
            if (!from) from = to;
            if (!to) to = from;
            if (from > to) {
                const tmp = from;
                from = to;
                to = tmp;
            }
            return { from, to };
        })();

        if (isManual) {
            setIsRefreshing(true);
        } else if (!isSilent && !isLoadedFromCache) {
            setLoading(true);
        }

        try {
            const [
                parcelsRes,
                inventoryRes,
                procurementRes,
                documentsRes,
                purchaseOrdersRes,
                suppliersRes,
                damageIncidentsRes,
                supplierReturnsRes
            ] = await Promise.all([
                Promise.resolve({ data: [] as any[], error: null }),
                (() => {
                    let q = supabase
                        .from('inventory_items')
                        .select('id, item_code, item_name, category, current_stock, minimum_stock, status, purchase_price, supplier, created_at');
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('purchase_requests')
                        .select('id, request_number, request_type, type, description, purpose, requested_by, department, items, priority, needed_by_date, status, created_at')
                        .order('created_at', { ascending: false });
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('supplier_documents')
                        .select('id, title, file_type, category, document_type, supplier, created_at')
                        .order('created_at', { ascending: false })
                        .limit(200);
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('purchase_orders')
                        .select('id, po_number, supplier_name, total_amount, status, paid, delivery_date, items, admin_approval, financial_approval, fully_received, subtotal, discount, tax_amount, shipping_fee, created_at')
                        .order('created_at', { ascending: false })
                        .limit(500);
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('suppliers')
                        .select('id, name, category, location, is_active, created_at')
                        .order('name', { ascending: true });
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('warehouse_damage_incidents')
                        .select('id, incident_number, item_id, item_code, item_name, quantity, quantity_received, unit, discrepancy_type, defect_type, severity, status, purchase_order_id, po_number, supplier_id, supplier_name, reported_at, created_at, action_taken, detected_at_location')
                        .order('created_at', { ascending: false });
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })(),
                (() => {
                    let q = supabase
                        .from('supplier_return_requests')
                        .select('id, return_request_number, incident_id, purchase_order_id, po_number, supplier_id, supplier_name, defective_quantity, requested_resolution, proposed_resolution, status, resolution_details, inspection_date, created_at, updated_at')
                        .order('created_at', { ascending: false });
                    if (range?.from) q = q.gte('created_at', range.from);
                    if (range?.to)   q = q.lte('created_at', range.to + 'T23:59:59.999Z');
                    return q;
                })()
            ]);

            if (!isMounted.current) return;

            const parcels = parcelsRes.data || [];
            const inventory = inventoryRes.data || [];
            const procurement = procurementRes.data || [];
            const documents = documentsRes.data || [];
            const purchaseOrders = purchaseOrdersRes.data || [];
            const suppliers = suppliersRes.data || [];
            const damageIncidents = damageIncidentsRes.data || [];
            const supplierReturns = supplierReturnsRes.data || [];

            // fetch WASM forecast in parallel
            let forecast7Day: any = null;
            try {
                const fcRes = await fetch('/forecast/api');
                if (fcRes.ok) {
                    const fcJson = await fcRes.json();
                    if (fcJson.success && fcJson.parcel_7_day) {
                        forecast7Day = fcJson.parcel_7_day;
                    }
                }
            } catch (fcErr) {
                console.warn("Forecast prefetch failed:", fcErr);
            }

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            // ── Daily trend ──────────────────────────────────────────────
            // When a date range is active, enumerate each day in that range.
            // Otherwise fall back to the last 7 days.
            const dailyTrend: DailyTrendPoint[] = [];

            if (range?.from && range?.to) {
                const start = new Date(range.from);
                const end = new Date(range.to);
                // cap at 90 days to avoid overflowing the chart
                const MAX_DAYS = 90;
                let cursor = new Date(start);
                let dayCount = 0;
                while (cursor <= end && dayCount < MAX_DAYS) {
                    const dStr = cursor.toISOString().split('T')[0];
                    const dayLabel = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dailyTrend.push({
                        dayLabel,
                        dateStr: dStr,
                        receivedCount: parcels.filter(p => p.created_at && p.created_at.startsWith(dStr)).length,
                        deliveredCount: parcels.filter(p => p.created_at && p.created_at.startsWith(dStr) && p.status === 'delivered').length,
                    });
                    cursor.setDate(cursor.getDate() + 1);
                    dayCount++;
                }
            } else {
                // default: last 7 days
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dStr = d.toISOString().split('T')[0];
                    const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dailyTrend.push({
                        dayLabel,
                        dateStr: dStr,
                        receivedCount: parcels.filter(p => p.created_at && p.created_at.startsWith(dStr)).length,
                        deliveredCount: parcels.filter(p => p.created_at && p.created_at.startsWith(dStr) && p.status === 'delivered').length,
                    });
                }
            }

            // ── Page KPIs ─────────────────────────────────────────────────
            // When a date range is active, "today" metrics become "in-range" metrics.
            let parcelsTodayCount: number;
            let parcelsYesterdayCount: number;
            let parcelsChangePct: string;

            if (range?.from) {
                // In-range: all parcels already ARE the filtered set
                parcelsTodayCount = parcels.length;
                // "Yesterday" period = same-length window immediately before the from date
                const fromDate = new Date(range.from);
                const toDate   = range.to ? new Date(range.to) : fromDate;
                const rangeDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
                const prevFrom = new Date(fromDate); prevFrom.setDate(prevFrom.getDate() - rangeDays);
                const prevTo   = new Date(fromDate); prevTo.setDate(prevTo.getDate() - 1);
                const prevFromStr = prevFrom.toISOString().split('T')[0];
                const prevToStr   = prevTo.toISOString().split('T')[0];
                // We can't re-query Supabase here, so approximate using the parcels we already have
                parcelsYesterdayCount = parcels.filter(p =>
                    p.created_at && p.created_at >= prevFromStr && p.created_at.split('T')[0] <= prevToStr
                ).length;
                if (parcelsYesterdayCount > 0) {
                    const diffPct = ((parcelsTodayCount - parcelsYesterdayCount) / parcelsYesterdayCount * 100).toFixed(1);
                    parcelsChangePct = `${Number(diffPct) >= 0 ? '+' : ''}${diffPct}% vs prev period`;
                } else {
                    parcelsChangePct = parcelsTodayCount > 0 ? 'New in range' : 'No data in range';
                }
            } else {
                // Default: today vs yesterday
                const yesterdayDate = new Date(now);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
                parcelsTodayCount = parcels.filter(p => p.created_at && p.created_at.startsWith(todayStr)).length;
                parcelsYesterdayCount = parcels.filter(p => p.created_at && p.created_at.startsWith(yesterdayStr)).length;
                if (parcelsYesterdayCount > 0) {
                    const diffPct = ((parcelsTodayCount - parcelsYesterdayCount) / parcelsYesterdayCount * 100).toFixed(1);
                    parcelsChangePct = `${Number(diffPct) >= 0 ? '+' : ''}${diffPct}% vs yesterday`;
                } else if (parcelsTodayCount > 0) {
                    parcelsChangePct = '+100% vs yesterday';
                } else {
                    parcelsChangePct = '0% vs yesterday';
                }
            }

            // dispatch stats — scoped to the filtered parcels
            const readyParcels = parcels.filter(p => p.status === 'ready' || p.status === 'ready_for_pickup' || p.status === 'sorting');
            const readyPctVal = parcels.length > 0 ? ((readyParcels.length / parcels.length) * 100).toFixed(1) : "0.0";

            // "Dispatched MTD" = parcels in a dispatched status within the current result set
            const dispatchedParcelsMtd = range?.from
                ? parcels.filter(p => p.status === 'delivered' || p.status === 'picked_up' || p.status === 'in_transit').length
                : (() => {
                    const currentMonthStr = now.toISOString().slice(0, 7);
                    return parcels.filter(p =>
                        p.created_at && p.created_at.startsWith(currentMonthStr) &&
                        (p.status === 'delivered' || p.status === 'picked_up' || p.status === 'in_transit')
                    ).length;
                })();

            const deliveredTotal = parcels.filter(p => p.status === 'delivered').length;

            const ontimeRateVal = parcels.length > 0 ? ((deliveredTotal / parcels.length) * 100).toFixed(1) : "0.0";

            const totalStockUnits = inventory.reduce((sum, item) => sum + (Number(item.current_stock) || 0), 0);
            const activeSuppliersCount = suppliers.filter((s: any) => s.is_active !== false).length;

            // operations summary
            const pendingInboundOrders = purchaseOrders.filter(po => po.status !== 'Cancelled' && po.status !== 'Delivered').length;
            const sortingParcels = parcels.filter(p => p.status === 'sorting').length;
            const deliveredParcels = parcels.filter(p => p.status === 'delivered').length;
            const anomaliesCount = inventory.filter(i => i.current_stock <= i.minimum_stock).length;

            // procurement summary
            const openPOs = purchaseOrders.filter(po => po.status !== 'Cancelled' && po.status !== 'Delivered').length;
            const periodPOs = range?.from ? purchaseOrders.length : openPOs;
            const pendingApprovals = procurement.filter(pr => pr.status === 'Pending').length;
            const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
            const mtdSpend = range?.from
                ? purchaseOrders.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0)
                : purchaseOrders
                    .filter(po => po.created_at && po.created_at.startsWith(currentMonthStr))
                    .reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);
            
            const approvedPRsCount = procurement.filter(pr => pr.status === 'Approved' || pr.status === 'Completed').length;
            const budgetUtilizationPct = procurement.length > 0
                ? Math.round((approvedPRsCount / procurement.length) * 100)
                : 0;

            const pageKpis: PageKpisData = {
                totalStockUnits,
                totalStockUnitsFormatted: `${totalStockUnits.toLocaleString()} Units`,
                inventorySkus: inventory.length,
                lowStockAlerts: anomaliesCount,
                openPOs: periodPOs,
                mtdSpend,
                mtdSpendFormatted: `₱${mtdSpend.toLocaleString()}`,
                activeSuppliers: activeSuppliersCount,
                totalSuppliers: suppliers.length,
                parcelsToday: parcelsTodayCount,
                parcelsChangePct,
                readyForDispatch: readyParcels.length,
                readyPct: `${readyPctVal}% of total queue`,
                dispatchedMtd: dispatchedParcelsMtd,
                dispatchedChangePct: range?.from
                    ? `${dispatchedParcelsMtd} shipments in period`
                    : `${dispatchedParcelsMtd} shipments this month`,
                ontimeRate: `${ontimeRateVal}%`,
            };

            const operationsSummary: OperationsSummaryData = {
                pendingInboundOrders,
                activeInventorySkus: inventory.length,
                anomaliesCount,
                activeSuppliersCount,
                totalStockUnits,
                sortingParcels,
                deliveredParcels,
            };

            const procurementSummary: ProcurementSummaryData = {
                openPOs,
                pendingApprovals,
                mtdSpend,
                budgetUtilizationPct,
            };

            // breakdowns
            const statusBreakdown: Record<string, number> = {};
            parcels.forEach(p => {
                const s = (p.status || 'unknown').trim();
                statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
            });

            const poStatusBreakdown: Record<string, number> = {};
            purchaseOrders.forEach((po: any) => {
                const st = (po.status || 'Pending').trim();
                poStatusBreakdown[st] = (poStatusBreakdown[st] || 0) + 1;
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

            // recent purchase orders transactions
            const recentTransactions: ExecutiveTransaction[] = purchaseOrders.slice(0, 8).map((po: any) => {
                const poNum = po.po_number || `PO-${String(po.id).slice(0, 8)}`;
                const supName = po.supplier_name || 'Approved Supplier';
                const dept = po.department || 'Warehouse Supply';
                const amt = Number(po.total_amount) || 0;
                const st = (po.status || 'Pending').toUpperCase();
                const dt = po.created_at ? new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                return {
                    id: poNum,
                    supplier: supName,
                    department: dept,
                    amount: `₱${amt.toLocaleString()}`,
                    status: st,
                    date: dt,
                    consignee: supName,
                    area: dept,
                    received: dt,
                };
            });

            // automated insights focused on warehousing, inventory, POs, and suppliers
            const insights: ExecutiveInsight[] = [];
            if (anomaliesCount > 0) {
                insights.push({
                    id: 'inventory-stock-alert',
                    title: 'Low Stock Safety Alert',
                    description: `${anomaliesCount} items in inventory_items are at or below minimum threshold. Restocking purchase requisition recommended.`,
                    type: 'warning',
                    metric: `${anomaliesCount} low stock`,
                    change: 'Restock needed',
                    actionable: true,
                    actionText: 'View Operations',
                    actionLink: '?tab=operations',
                });
            }

            if (openPOs > 0) {
                insights.push({
                    id: 'open-po-pipeline',
                    title: 'Inbound PO Fulfillment Pipeline',
                    description: `${openPOs} active purchase orders are currently open with suppliers totaling ₱${mtdSpend.toLocaleString()} in committed spend.`,
                    type: 'positive',
                    metric: `${openPOs} active POs`,
                    change: `₱${mtdSpend.toLocaleString()} spend`,
                    actionable: true,
                    actionText: 'Inspect Orders',
                    actionLink: '?tab=issued-pos',
                });
            }

            if (pendingApprovals > 0) {
                insights.push({
                    id: 'pending-procurement',
                    title: 'Pending Purchase Requisitions',
                    description: `${pendingApprovals} purchase requests in purchase_requests require manager approval.`,
                    type: 'neutral',
                    metric: `${pendingApprovals} pending`,
                    change: 'Action required',
                    actionable: true,
                    actionText: 'Review Pipeline',
                    actionLink: '?tab=issued-pos',
                });
            }

            insights.push({
                id: 'supplier-network',
                title: 'Supplier Partner Network',
                description: `${activeSuppliersCount} of ${suppliers.length} registered vendors are verified and active for inventory replenishment.`,
                type: 'positive',
                metric: `${activeSuppliersCount} active`,
                change: 'Network verified',
                actionable: true,
                actionText: 'View Deep Dive',
                actionLink: '?tab=kpis',
            });

            // tab kpis
            const kpis: ExecutiveKPI[] = [
                {
                    id: 'warehouse-stock',
                    label: 'Warehouse Stock Units',
                    value: totalStockUnits.toLocaleString(),
                    change: `${inventory.length} catalogued SKUs`,
                    changeType: 'up',
                    icon: 'fa-boxes-stacked',
                    color: 'text-pink-500',
                    description: 'Total active stock units across warehouse storage racks',
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
                    id: 'po-spend',
                    label: 'PO Spend Commitments',
                    value: `₱${mtdSpend.toLocaleString()}`,
                    change: `${openPOs} active purchase orders`,
                    changeType: 'up',
                    icon: 'fa-file-invoice-dollar',
                    color: 'text-indigo-500',
                    description: 'Purchase orders committed to approved vendors',
                },
                {
                    id: 'active-suppliers',
                    label: 'Active Suppliers',
                    value: activeSuppliersCount,
                    change: `${suppliers.length} registered`,
                    changeType: 'up',
                    icon: 'fa-handshake',
                    color: 'text-blue-500',
                    description: 'Approved vendor suppliers in database',
                },
                {
                    id: 'pending-requests',
                    label: 'Pending Requisitions',
                    value: pendingApprovals,
                    change: `${procurement.length} total PRs`,
                    changeType: 'neutral',
                    icon: 'fa-clock',
                    color: 'text-purple-500',
                    description: 'Purchase requests awaiting manager approval',
                },
                {
                    id: 'documents',
                    label: 'Compliance Documents',
                    value: documents.length,
                    change: `${Object.keys(documentTypeBreakdown).length} categories`,
                    changeType: 'up',
                    icon: 'fa-file-alt',
                    color: 'text-cyan-500',
                    description: 'Archived procurement documents & invoices',
                },
            ];

            // ── Issued Purchase Orders Analytics ──────────────────────────
            const validIssuedStatuses = ['Issued', 'Sent to Supplier', 'Delivered', 'In Transit'];
            const eligibleIssuedPOs = purchaseOrders.filter((po: any) => {
                const status = po.status || '';
                const finApproval = po.financial_approval || '';
                if (['Draft', 'Pending', 'Cancelled', 'Rejected'].includes(status)) return false;
                return validIssuedStatuses.includes(status) || finApproval === 'Approved';
            });

            let totalApprovedValue = 0;
            const distinctItemsSet = new Set<string>();
            let awaitingDeliveryCount = 0;
            let partiallyReceivedCount = 0;
            let fullyReceivedCount = 0;
            let inconsistentApprovalCount = 0;

            const issuedOrdersList: IssuedPOAnalyticsItem[] = eligibleIssuedPOs.map((po: any) => {
                const totalAmt = Number(po.total_amount) || 0;
                totalApprovedValue += totalAmt;

                let parsedItems: any[] = [];
                if (Array.isArray(po.items)) {
                    parsedItems = po.items;
                } else if (typeof po.items === 'string') {
                    try { parsedItems = JSON.parse(po.items); } catch {}
                }

                const poItemNames: string[] = [];
                let hasAnyReceived = false;
                let allItemsReceived = parsedItems.length > 0;

                parsedItems.forEach((it: any) => {
                    const itName = it.name || it.item_name || 'Item';
                    poItemNames.push(itName);
                    distinctItemsSet.add(itName.toLowerCase().trim());
                    const qOrd = Number(it.quantity_ordered ?? it.quantity ?? 0);
                    const qRec = Number(it.quantity_received ?? 0);
                    if (qRec > 0) hasAnyReceived = true;
                    if (qRec < qOrd || qOrd === 0) allItemsReceived = false;
                });

                let deliveryStatus: 'Fully Received' | 'Partially Received' | 'Awaiting Delivery' = 'Awaiting Delivery';
                if (po.fully_received === true || po.status === 'Delivered' || (parsedItems.length > 0 && allItemsReceived)) {
                    deliveryStatus = 'Fully Received';
                    fullyReceivedCount++;
                } else if (hasAnyReceived) {
                    deliveryStatus = 'Partially Received';
                    partiallyReceivedCount++;
                } else {
                    deliveryStatus = 'Awaiting Delivery';
                    awaitingDeliveryCount++;
                }

                let hasInconsistency = false;
                let inconsistencyReason = '';
                if (po.financial_approval === 'Approved' && ['Cancelled', 'Draft'].includes(po.status)) {
                    hasInconsistency = true;
                    inconsistencyReason = `Financial approval granted but status is ${po.status}`;
                    inconsistentApprovalCount++;
                } else if (['Delivered', 'Issued'].includes(po.status) && po.financial_approval !== 'Approved' && po.admin_approval !== 'Approved') {
                    hasInconsistency = true;
                    inconsistencyReason = `Status is ${po.status} but financial approval is ${po.financial_approval || 'Pending'}`;
                    inconsistentApprovalCount++;
                }

                return {
                    id: String(po.id),
                    po_number: po.po_number || `PO-${String(po.id).slice(0, 8)}`,
                    supplier_name: po.supplier_name || 'Approved Supplier',
                    total_amount: totalAmt,
                    status: po.status || 'Issued',
                    delivery_date: po.delivery_date ? String(po.delivery_date).split('T')[0] : null,
                    items_count: parsedItems.length,
                    distinct_items: poItemNames,
                    admin_approval: po.admin_approval || null,
                    financial_approval: po.financial_approval || null,
                    fully_received: !!po.fully_received,
                    delivery_status: deliveryStatus,
                    has_approval_inconsistency: hasInconsistency,
                    inconsistency_reason: inconsistencyReason || undefined,
                    created_at: po.created_at || new Date().toISOString()
                };
            });

            const monthlyTrendMap = new Map<string, { count: number; value: number }>();
            eligibleIssuedPOs.forEach((po: any) => {
                const month = po.created_at ? po.created_at.slice(0, 7) : todayStr.slice(0, 7);
                const cur = monthlyTrendMap.get(month) || { count: 0, value: 0 };
                cur.count += 1;
                cur.value += Number(po.total_amount) || 0;
                monthlyTrendMap.set(month, cur);
            });
            const monthlyTrend = Array.from(monthlyTrendMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, stats]) => ({
                    month,
                    count: stats.count,
                    value: stats.value
                }));

            const issuedPOsAnalytics: IssuedPOsAnalyticsData = {
                issuedOrdersCount: eligibleIssuedPOs.length,
                totalApprovedValue,
                distinctItemsOrderedCount: distinctItemsSet.size,
                awaitingDeliveryCount,
                partiallyReceivedCount,
                fullyReceivedCount,
                inconsistentApprovalCount,
                monthlyTrend,
                issuedOrdersList
            };

            // ── Defective Items Received Analytics ─────────────────────────
            const eligibleDamageIncidents = damageIncidents.filter((inc: any) =>
                !['Cancelled', 'Rejected'].includes(inc.status)
            );

            let totalDefectiveUnits = 0;
            const affectedItemsSet = new Set<string>();
            const affectedDeliveriesSet = new Set<string>();
            let awaitingReviewUnits = 0;
            let quarantinedUnits = 0;
            let approvedForReturnUnits = 0;
            let actuallyReturnedUnits = 0;
            const categoriesBreakdown: Record<string, number> = {};
            const supplierDefectsMap = new Map<string, { units: number; incidents: number }>();
            const unresolvedCases: DefectiveIncidentAnalyticsItem[] = [];
            const completedCases: DefectiveIncidentAnalyticsItem[] = [];

            eligibleDamageIncidents.forEach((inc: any) => {
                const qty = Number(inc.quantity) || 0;
                totalDefectiveUnits += qty;

                const itemKey = (inc.item_name || inc.item_code || 'Item').trim();
                affectedItemsSet.add(itemKey.toLowerCase());

                const deliveryKey = inc.po_number || inc.incident_number || 'Delivery';
                affectedDeliveriesSet.add(deliveryKey);

                const st = inc.status || 'Reported';
                if (['Under Review', 'Reported', 'Pending Review', 'Pending'].includes(st)) {
                    awaitingReviewUnits += qty;
                } else if (st === 'Quarantined') {
                    quarantinedUnits += qty;
                } else if (st === 'Approved for Return') {
                    approvedForReturnUnits += qty;
                } else if (['Returned to Supplier', 'Replaced / Restored', 'Resolved'].includes(st)) {
                    actuallyReturnedUnits += qty;
                }

                const cat = (inc.discrepancy_type || inc.defect_type || 'Damaged').trim();
                categoriesBreakdown[cat] = (categoriesBreakdown[cat] || 0) + qty;

                const sup = inc.supplier_name || 'Unknown Supplier';
                const sStat = supplierDefectsMap.get(sup) || { units: 0, incidents: 0 };
                sStat.units += qty;
                sStat.incidents += 1;
                supplierDefectsMap.set(sup, sStat);

                const incidentItem: DefectiveIncidentAnalyticsItem = {
                    id: String(inc.id),
                    incident_number: inc.incident_number || `INC-${String(inc.id).slice(0, 8)}`,
                    item_code: inc.item_code || 'ITM-N/A',
                    item_name: inc.item_name || 'Item',
                    quantity: qty,
                    unit: inc.unit || 'units',
                    discrepancy_type: inc.discrepancy_type || 'Damaged',
                    defect_type: inc.defect_type || 'Damaged',
                    severity: inc.severity || 'Moderate',
                    status: st,
                    po_number: inc.po_number || 'N/A',
                    supplier_name: sup,
                    detected_at_location: inc.detected_at_location || 'Receiving Dock',
                    reported_at: inc.reported_at ? String(inc.reported_at).split('T')[0] : 'Recent',
                    created_at: inc.created_at || new Date().toISOString(),
                    action_taken: inc.action_taken || undefined
                };

                if (['Resolved', 'Replaced / Restored'].includes(st)) {
                    completedCases.push(incidentItem);
                } else {
                    unresolvedCases.push(incidentItem);
                }
            });

            const topSuppliers = Array.from(supplierDefectsMap.entries())
                .map(([supplier, s]) => ({ supplier, defectiveUnits: s.units, incidentCount: s.incidents }))
                .sort((a, b) => b.defectiveUnits - a.defectiveUnits)
                .slice(0, 5);

            const defectiveItemsAnalytics: DefectiveItemsAnalyticsData = {
                totalDefectiveUnits,
                affectedItemsCount: affectedItemsSet.size,
                affectedDeliveriesCount: affectedDeliveriesSet.size,
                awaitingReviewUnits,
                quarantinedUnits,
                approvedForReturnUnits,
                actuallyReturnedUnits,
                categoriesBreakdown,
                topSuppliers,
                unresolvedCases,
                completedCases
            };

            // ── Replacement Items Received Analytics ───────────────────────
            const eligibleReplacements = supplierReturns.filter((ret: any) =>
                (ret.requested_resolution || '').toLowerCase() === 'replacement' ||
                (ret.proposed_resolution || '').toLowerCase() === 'replacement'
            );

            let totalReplacementsReceived = 0;
            let replacementDeliveriesCount = 0;
            let awaitingFulfillmentCount = 0;
            let awaitingInspectionUnits = 0;
            let acceptedAfterInspectionUnits = 0;
            let rejectedDuringInspectionUnits = 0;

            const replacementCases: ReplacementCaseAnalyticsItem[] = eligibleReplacements.map((ret: any) => {
                const resDetails = typeof ret.resolution_details === 'string'
                    ? (() => { try { return JSON.parse(ret.resolution_details); } catch { return {}; } })()
                    : (ret.resolution_details || {});

                const defQty = Number(ret.defective_quantity) || 0;
                const recQty = Number(resDetails.replacement_quantity_received) || 0;
                const outstanding = Math.max(0, defQty - recQty);

                if (recQty > 0) {
                    totalReplacementsReceived += recQty;
                    replacementDeliveriesCount++;
                }

                if (outstanding > 0 && !['Resolved', 'Closed'].includes(ret.status)) {
                    awaitingFulfillmentCount++;
                }

                const qcCond = resDetails.qc_condition || (recQty > 0 ? 'Passed QC Inspection - Brand New Replacement' : 'Awaiting Delivery');
                const recStatus = (resDetails.replacement_receiving_status || '').toLowerCase();

                if (recStatus.includes('pending') || recStatus.includes('inspection')) {
                    awaitingInspectionUnits += recQty;
                } else if (qcCond.toLowerCase().includes('pass') || qcCond.toLowerCase().includes('brand new') || ret.status === 'Resolved') {
                    acceptedAfterInspectionUnits += recQty;
                } else if (qcCond.toLowerCase().includes('fail') || qcCond.toLowerCase().includes('reject')) {
                    rejectedDuringInspectionUnits += recQty;
                }

                return {
                    id: String(ret.id),
                    return_request_number: ret.return_request_number || `SRR-${String(ret.id).slice(0, 8)}`,
                    incident_id: ret.incident_id ? String(ret.incident_id) : 'N/A',
                    po_number: ret.po_number || 'N/A',
                    supplier_name: ret.supplier_name || 'Approved Supplier',
                    item_name: ret.item_name || 'Item',
                    defective_quantity: defQty,
                    replacement_quantity_received: recQty,
                    outstanding_quantity: outstanding,
                    replacement_received_date: resDetails.replacement_received_date ? String(resDetails.replacement_received_date).split('T')[0] : (recQty > 0 ? 'Recorded' : null),
                    status: ret.status || 'In Progress',
                    qc_condition: qcCond,
                    expected_replacement_date: resDetails.expected_replacement_date ? String(resDetails.expected_replacement_date).split('T')[0] : null,
                    created_at: ret.created_at || new Date().toISOString()
                };
            });

            const replacementAnalytics: ReplacementItemsAnalyticsData = {
                totalReplacementsReceived,
                replacementDeliveriesCount,
                awaitingFulfillmentCount,
                awaitingInspectionUnits,
                acceptedAfterInspectionUnits,
                rejectedDuringInspectionUnits,
                replacementCases
            };

            const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            const payload: ExecutiveDataPayload = {
                parcels,
                inventory,
                procurement,
                documents,
                purchaseOrders,
                suppliers,
                damageIncidents,
                supplierReturns,
                issuedPOsAnalytics,
                defectiveItemsAnalytics,
                replacementAnalytics,
                insights,
                kpis,
                pageKpis,
                operationsSummary,
                procurementSummary,
                recentTransactions,
                dailyTrend,
                statusBreakdown,
                poStatusBreakdown,
                inventoryCategoryBreakdown,
                procurementStatusBreakdown,
                documentTypeBreakdown,
                supplierCategoryBreakdown,
                forecast7Day,
                lastUpdated: nowStr,
            };

            setData(payload);
            setIsLoadedFromCache(false);

            try {
                if (!range?.from) {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                        timestamp: Date.now(),
                        payload,
                    }));
                }
            } catch (err) {
                console.warn("Could not save executive data to sessionStorage:", err);
            }

            if (isManual) {
                toast.success("Executive data revalidated from database!");
            }
        } catch (error) {
            console.error("Error fetching executive data:", error);
            if (isManual) {
                toast.error("Failed to refresh database metrics");
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [isLoadedFromCache]);

    // Initial fetch on mount
    useEffect(() => {
        isMounted.current = true;
        fetchData();
        return () => {
            isMounted.current = false;
        };
    }, [fetchData]);

    // Realtime Supabase subscriptions for live executive updates across all charts & metrics
    useEffect(() => {
        let debounceTimer: NodeJS.Timeout | null = null;

        const handleTableChange = (payload: any) => {
            if (!isMounted.current) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            // Coalesce rapid batch changes (e.g. bulk stock movements, defect logging, status changes)
            debounceTimer = setTimeout(() => {
                if (isMounted.current) {
                    fetchData({ isSilent: true });
                }
            }, 500);
        };

        const channel = supabase
            .channel(`executive_realtime_${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requests' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_damage_incidents' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_return_requests' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_quotations' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_documents' }, handleTableChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, handleTableChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' && isMounted.current) {
                    setIsRealtimeActive(true);
                }
            });

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const applyDateFilter = useCallback((range: DateRange) => {
        activeDateRangeRef.current = range;
        setActiveDateRange(range);
        sessionStorage.removeItem(CACHE_KEY); // bust cache so filtered data is fresh
        fetchData({ isManualRefresh: true, dateRange: range });
    }, [fetchData]);

    const resetDateFilter = useCallback(() => {
        activeDateRangeRef.current = null;
        setActiveDateRange(null);
        sessionStorage.removeItem(CACHE_KEY);
        fetchData({ isManualRefresh: true, dateRange: null });
    }, [fetchData]);

    return {
        data,
        loading,
        isRefreshing,
        isLoadedFromCache,
        isRealtimeActive,
        activeDateRange,
        refresh: () => fetchData(true),
        applyDateFilter,
        resetDateFilter,
    };
}
