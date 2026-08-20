// app/(supplyChain)/ai/actions/get_purchase_orders.ts

import { supabase } from "../../lib/services/client/supabase";

export interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    is_paid: boolean;
    created_at: string;
    expected_delivery_date?: string;
    items?: any[];
}

/**
 * Get purchase orders with optional status or supplier filter
 */
export async function getPurchaseOrders(params?: { status?: string; supplier?: string; is_paid?: boolean; limit?: number }): Promise<PurchaseOrder[]> {
    let q = supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.status) {
        q = q.eq('status', params.status);
    }

    if (params?.supplier) {
        q = q.ilike('supplier_name', `%${params.supplier}%`);
    }

    if (typeof params?.is_paid === 'boolean') {
        q = q.eq('is_paid', params.is_paid);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching purchase orders:', error);
        return [];
    }

    return (data || []) as PurchaseOrder[];
}

/**
 * Get aggregated purchase orders summary stats
 */
export async function getPurchaseOrdersSummary(): Promise<{
    totalPOs: number;
    totalSpend: number;
    pendingCount: number;
    confirmedCount: number;
    deliveredCount: number;
    cancelledCount: number;
    paidCount: number;
    unpaidCount: number;
}> {
    const orders = await getPurchaseOrders({ limit: 1000 });

    let totalSpend = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    orders.forEach(po => {
        totalSpend += po.total_amount || 0;
        const s = (po.status || '').toLowerCase();
        if (s === 'pending' || s === 'draft' || s === 'sent') pendingCount++;
        else if (s === 'confirmed') confirmedCount++;
        else if (s === 'delivered') deliveredCount++;
        else if (s === 'cancelled') cancelledCount++;

        if (po.is_paid) paidCount++;
        else unpaidCount++;
    });

    return {
        totalPOs: orders.length,
        totalSpend,
        pendingCount,
        confirmedCount,
        deliveredCount,
        cancelledCount,
        paidCount,
        unpaidCount,
    };
}
