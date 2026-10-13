// app/(supplyChain)/ai/actions/get_stock_movements.ts

import { supabase } from "../../lib/services/client/supabase";

export interface StockMovement {
    id: string;
    item_id?: string | null;
    item_code: string;
    item_name: string;
    movement_type: 'Stock In' | 'Stock Out' | 'Adjustment' | string;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reference_number?: string | null;
    reason?: string | null;
    department?: string | null;
    performed_by: string;
    created_at: string;
    metadata?: any;
}

export interface StockMovementsSummary {
    totalMovements: number;
    stockInCount: number;
    stockOutCount: number;
    adjustmentCount: number;
    totalQuantityIn: number;
    totalQuantityOut: number;
    recentMovements: StockMovement[];
    movementsByDepartment: Record<string, number>;
}

/**
 * Fetch stock movements with optional type, department, or item code filters
 */
export async function getStockMovements(params?: {
    movement_type?: string;
    item_code?: string;
    department?: string;
    limit?: number;
}): Promise<StockMovement[]> {
    let q = supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.movement_type) {
        q = q.eq('movement_type', params.movement_type);
    }

    if (params?.item_code) {
        q = q.ilike('item_code', `%${params.item_code}%`);
    }

    if (params?.department) {
        q = q.ilike('department', `%${params.department}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching stock movements:', error);
        return [];
    }

    return (data || []) as StockMovement[];
}

/**
 * Get aggregated summary metrics for stock movements
 */
export async function getStockMovementsSummary(): Promise<StockMovementsSummary> {
    const movements = await getStockMovements({ limit: 200 });

    let stockInCount = 0;
    let stockOutCount = 0;
    let adjustmentCount = 0;
    let totalQuantityIn = 0;
    let totalQuantityOut = 0;
    const movementsByDepartment: Record<string, number> = {};

    movements.forEach(m => {
        const type = (m.movement_type || '').toLowerCase();
        const qty = Number(m.quantity) || 0;

        if (type.includes('in')) {
            stockInCount++;
            totalQuantityIn += qty;
        } else if (type.includes('out')) {
            stockOutCount++;
            totalQuantityOut += qty;
        } else if (type.includes('adj')) {
            adjustmentCount++;
        }

        const dept = m.department || 'General / Unspecified';
        movementsByDepartment[dept] = (movementsByDepartment[dept] || 0) + 1;
    });

    return {
        totalMovements: movements.length,
        stockInCount,
        stockOutCount,
        adjustmentCount,
        totalQuantityIn,
        totalQuantityOut,
        recentMovements: movements.slice(0, 10),
        movementsByDepartment,
    };
}
