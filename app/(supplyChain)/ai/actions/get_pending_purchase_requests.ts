// app/(supplyChain)/ai/actions/get_pending_purchase_requests.ts

import { supabase } from "../../lib/services/client/supabase";

export interface PendingPurchaseRequestItem {
    name: string;
    quantity: number;
    unit_price?: number;
    total?: number;
}

export interface PendingPurchaseRequest {
    id: string;
    request_number: string;
    type?: string;
    description?: string;
    requested_by: string;
    department?: string;
    supplier_id: string;
    supplier_name: string;
    supplier_email?: string;
    amount: number;
    priority: string;
    date: string;
    status: string;
    items: PendingPurchaseRequestItem[];
    reason?: string;
    has_po?: boolean;
}

/**
 * Get purchase requests that do NOT have a purchase order yet
 */
export async function getPendingPurchaseRequests(): Promise<{
    success: boolean;
    count: number;
    requests: PendingPurchaseRequest[];
}> {
    try {
        // 1. Fetch approved and pending purchase requests
        const { data: requests, error: reqError } = await supabase
            .from('purchase_requests')
            .select('*')
            .in('status', ['Approved', 'Pending'])
            .order('created_at', { ascending: false });

        if (reqError) {
            console.error('Error fetching purchase requests:', reqError);
            return { success: false, count: 0, requests: [] };
        }

        // 2. Fetch existing purchase orders to identify which request_ids already have POs
        const { data: pos, error: poError } = await supabase
            .from('purchase_orders')
            .select('request_id');

        const existingReqIds = new Set<string>();
        if (!poError && pos) {
            pos.forEach(p => {
                if (p.request_id) existingReqIds.add(p.request_id);
            });
        }

        // 3. Fetch suppliers email mapping
        const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, email, name');

        const supplierEmailMap = new Map<string, string>();
        if (suppliers) {
            suppliers.forEach(s => {
                if (s.id && s.email) supplierEmailMap.set(s.id, s.email);
            });
        }

        // 4. Filter requests without POs
        const unfulfilledRequests: PendingPurchaseRequest[] = (requests || [])
            .filter(r => !existingReqIds.has(r.id))
            .map(r => ({
                id: r.id,
                request_number: r.request_number || `PR-${r.id.slice(0, 6)}`,
                type: r.type || 'Standard',
                description: r.description || '',
                requested_by: r.requested_by || 'Staff',
                department: r.department || 'Warehouse',
                supplier_id: r.supplier_id,
                supplier_name: r.supplier_name || 'Generic Supplier',
                supplier_email: supplierEmailMap.get(r.supplier_id) || '',
                amount: r.amount || 0,
                priority: r.priority || 'Normal',
                date: r.date || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
                status: r.status || 'Approved',
                items: Array.isArray(r.items) ? r.items : [],
                reason: r.reason || '',
                has_po: false
            }));

        return {
            success: true,
            count: unfulfilledRequests.length,
            requests: unfulfilledRequests
        };
    } catch (err) {
        console.error('Error in getPendingPurchaseRequests:', err);
        return { success: false, count: 0, requests: [] };
    }
}
