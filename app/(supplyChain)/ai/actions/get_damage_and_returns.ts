// app/(supplyChain)/ai/actions/get_damage_and_returns.ts

import { supabase } from "../../lib/services/client/supabase";

export interface DamageIncident {
    id: string;
    incident_number: string;
    item_code: string;
    item_name: string;
    category?: string | null;
    quantity: number;
    unit?: string | null;
    discrepancy_type: string;
    severity: string;
    unit_cost: number;
    total_estimated_loss: number;
    detected_at_location?: string | null;
    reported_by: string;
    status: string;
    action_taken: string;
    po_number?: string | null;
    supplier_name?: string | null;
    defect_type?: string | null;
    defect_description?: string | null;
    requested_resolution?: string | null;
    created_at: string;
}

export interface SupplierReturnRequest {
    id: string;
    return_request_number: string;
    po_number: string;
    supplier_name: string;
    item_code: string;
    item_name: string;
    defective_quantity: number;
    defect_type: string;
    defect_description: string;
    requested_resolution: string;
    status: string;
    supplier_responsibility: string;
    finance_verified: boolean;
    created_at: string;
}

export interface DamageAndReturnsSummary {
    totalIncidents: number;
    openIncidents: number;
    resolvedIncidents: number;
    totalEstimatedLoss: number;
    totalReturnRequests: number;
    pendingReturns: number;
    financeVerifiedReturns: number;
    incidentsByDefectType: Record<string, number>;
    recentIncidents: DamageIncident[];
    recentReturns: SupplierReturnRequest[];
}

/**
 * Fetch warehouse damage incidents
 */
export async function getDamageIncidents(params?: {
    status?: string;
    defect_type?: string;
    item_code?: string;
    limit?: number;
}): Promise<DamageIncident[]> {
    let q = supabase
        .from('warehouse_damage_incidents')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.status) {
        q = q.ilike('status', `%${params.status}%`);
    }

    if (params?.defect_type) {
        q = q.ilike('defect_type', `%${params.defect_type}%`);
    }

    if (params?.item_code) {
        q = q.ilike('item_code', `%${params.item_code}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching warehouse damage incidents:', error);
        return [];
    }

    return (data || []) as DamageIncident[];
}

/**
 * Fetch supplier return requests
 */
export async function getSupplierReturns(params?: {
    status?: string;
    supplier?: string;
    po_number?: string;
    limit?: number;
}): Promise<SupplierReturnRequest[]> {
    let q = supabase
        .from('supplier_return_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.status) {
        q = q.ilike('status', `%${params.status}%`);
    }

    if (params?.supplier) {
        q = q.ilike('supplier_name', `%${params.supplier}%`);
    }

    if (params?.po_number) {
        q = q.ilike('po_number', `%${params.po_number}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching supplier return requests:', error);
        return [];
    }

    return (data || []) as SupplierReturnRequest[];
}

/**
 * Aggregated summary of defects, warehouse damages, and supplier return requests
 */
export async function getDamageAndReturnsSummary(): Promise<DamageAndReturnsSummary> {
    const [incidents, returns] = await Promise.all([
        getDamageIncidents({ limit: 150 }),
        getSupplierReturns({ limit: 150 }),
    ]);

    let openIncidents = 0;
    let resolvedIncidents = 0;
    let totalEstimatedLoss = 0;
    const incidentsByDefectType: Record<string, number> = {};

    incidents.forEach(inc => {
        const st = (inc.status || '').toLowerCase();
        if (st.includes('resolve') || st.includes('closed') || st.includes('disposed')) {
            resolvedIncidents++;
        } else {
            openIncidents++;
        }

        totalEstimatedLoss += Number(inc.total_estimated_loss) || 0;

        const def = inc.defect_type || inc.discrepancy_type || 'Unspecified Defect';
        incidentsByDefectType[def] = (incidentsByDefectType[def] || 0) + 1;
    });

    let pendingReturns = 0;
    let financeVerifiedReturns = 0;

    returns.forEach(ret => {
        const st = (ret.status || '').toLowerCase();
        if (!st.includes('completed') && !st.includes('resolved') && !st.includes('rejected')) {
            pendingReturns++;
        }
        if (ret.finance_verified) {
            financeVerifiedReturns++;
        }
    });

    return {
        totalIncidents: incidents.length,
        openIncidents,
        resolvedIncidents,
        totalEstimatedLoss,
        totalReturnRequests: returns.length,
        pendingReturns,
        financeVerifiedReturns,
        incidentsByDefectType,
        recentIncidents: incidents.slice(0, 10),
        recentReturns: returns.slice(0, 10),
    };
}
