'use server';

import { createClient } from '@supabase/supabase-js';
import { StockMovement, StockMovementsQueryParams, StockMovementStats } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Log a new stock movement into the audit trail.
 * Strictly uses public.stock_movements table.
 */
export async function logStockMovement(entry: {
    item_id?: string | number | null;
    item_code: string;
    item_name: string;
    movement_type: 'Stock In' | 'Stock Out' | 'Adjustment';
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reference?: string | null;
    reference_number?: string | null;
    reason?: string | null;
    notes?: string | null;
    department?: string | null;
    performed_by?: string | null;
    performed_by_id?: string | null;
    metadata?: Record<string, any>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const ref = entry.reference_number || entry.reference || null;
        const performedBy = entry.performed_by || 'Warehouse Staff';
        const reasonText = entry.reason || entry.notes || null;

        const movementPayload: Record<string, any> = {
            item_id: entry.item_id ? String(entry.item_id) : null,
            item_code: entry.item_code,
            item_name: entry.item_name,
            movement_type: entry.movement_type,
            quantity: Number(entry.quantity),
            previous_stock: Number(entry.previous_stock ?? 0),
            new_stock: Number(entry.new_stock ?? 0),
            reference_number: ref,
            reason: reasonText,
            department: entry.department || null,
            performed_by: performedBy,
            performed_by_id: entry.performed_by_id || null,
            metadata: entry.metadata || {},
            created_at: new Date().toISOString(),
        };

        // Insert strictly into dedicated stock_movements table
        const { data: smData, error: smError } = await (dbClient as any)
            .from('stock_movements')
            .insert([movementPayload])
            .select('id')
            .single();

        if (smError) {
            console.error('Failed to insert into stock_movements:', smError);
            return { success: false, error: smError.message };
        }

        return { success: true, id: (smData as any)?.id };
    } catch (err: any) {
        console.error('Unexpected error in logStockMovement:', err);
        return { success: false, error: err?.message || 'Failed to log stock movement' };
    }
}

/**
 * Fetch movements with server-side / client-side matching filters, pagination, and calculated stats.
 * Strictly queries public.stock_movements.
 */
export async function fetchStockMovements(params: StockMovementsQueryParams = {}): Promise<{
    success: boolean;
    data?: {
        movements: StockMovement[];
        totalCount: number;
        totalPages: number;
        stats: StockMovementStats;
        userDeptOptions: string[];
    };
    error?: string;
}> {
    try {
        const {
            search = '',
            type = 'all',
            dateRange = 'all',
            userDepartment = 'all',
            page = 1,
            limit = 20,
        } = params;

        // Query exclusively from stock_movements table
        const { data: smRows, error: smError } = await (dbClient as any)
            .from('stock_movements')
            .select('*')
            .order('created_at', { ascending: false });

        if (smError) {
            console.error('Error fetching stock_movements:', smError);
            return {
                success: false,
                error: smError.message || 'Failed to fetch stock movements',
            };
        }

        const allRecords: StockMovement[] = (smRows || []).map((r: any) => ({
            id: String(r.id),
            item_id: r.item_id,
            item_code: r.item_code || 'N/A',
            item_name: r.item_name || 'Item',
            movement_type: r.movement_type,
            quantity: Number(r.quantity || 0),
            previous_stock: Number(r.previous_stock ?? 0),
            new_stock: Number(r.new_stock ?? 0),
            reference: r.reference_number,
            reference_number: r.reference_number,
            reason: r.reason,
            notes: r.reason,
            department: r.department,
            performed_by: r.performed_by || 'Warehouse Staff',
            performed_by_id: r.performed_by_id,
            created_at: r.created_at || new Date().toISOString(),
            metadata: r.metadata || {},
        }));

        // Sort all records descending by created_at
        allRecords.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Extract unique User / Department options for the filter dropdown
        const userDeptSet = new Set<string>();
        for (const r of allRecords) {
            if (r.performed_by) userDeptSet.add(r.performed_by.trim());
            if (r.department) userDeptSet.add(r.department.trim());
        }
        const userDeptOptions = Array.from(userDeptSet).sort();

        // Calculate Summary Cards from all records
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000;

        let totalStockIn = 0;
        let totalStockOut = 0;
        let adjustmentsCount = 0;
        let netAdjustments = 0;
        let movementsToday = 0;

        for (const r of allRecords) {
            const movementTime = new Date(r.created_at).getTime();
            if (movementTime >= todayStart && movementTime < todayEnd) {
                movementsToday++;
            }

            if (r.movement_type === 'Stock In') {
                totalStockIn += Math.abs(r.quantity);
            } else if (r.movement_type === 'Stock Out') {
                totalStockOut += Math.abs(r.quantity);
            } else if (r.movement_type === 'Adjustment') {
                adjustmentsCount++;
                netAdjustments += r.quantity;
            }
        }

        const stats: StockMovementStats = {
            totalStockIn,
            totalStockOut,
            adjustmentsCount,
            netAdjustments,
            movementsToday,
        };

        // Filter records
        let filtered = allRecords;

        // Search filter (Item Code, Item Name, Reference, Department, Performer, or Metadata)
        if (search.trim()) {
            const term = search.trim().toLowerCase();
            filtered = filtered.filter(r =>
                r.item_code.toLowerCase().includes(term) ||
                r.item_name.toLowerCase().includes(term) ||
                (r.reference_number && r.reference_number.toLowerCase().includes(term)) ||
                (r.reason && r.reason.toLowerCase().includes(term)) ||
                (r.department && r.department.toLowerCase().includes(term)) ||
                (r.performed_by && r.performed_by.toLowerCase().includes(term)) ||
                (r.metadata && JSON.stringify(r.metadata).toLowerCase().includes(term))
            );
        }

        // Movement Type filter
        if (type !== 'all') {
            filtered = filtered.filter(r => r.movement_type.toLowerCase() === type.toLowerCase());
        }

        // Date Range filter
        if (dateRange !== 'all') {
            const nowDate = new Date();
            filtered = filtered.filter(r => {
                const recDate = new Date(r.created_at);
                if (dateRange === 'today') {
                    return recDate.toDateString() === nowDate.toDateString();
                } else if (dateRange === 'week') {
                    const oneWeekAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return recDate >= oneWeekAgo;
                } else if (dateRange === 'month') {
                    const oneMonthAgo = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, nowDate.getDate());
                    return recDate >= oneMonthAgo;
                }
                return true;
            });
        }

        // User / Department filter
        if (userDepartment !== 'all') {
            const ud = userDepartment.toLowerCase();
            filtered = filtered.filter(r =>
                (r.performed_by && r.performed_by.toLowerCase().includes(ud)) ||
                (r.department && r.department.toLowerCase().includes(ud))
            );
        }

        const totalCount = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / limit));
        const startIndex = (page - 1) * limit;
        const paginated = filtered.slice(startIndex, startIndex + limit);

        return {
            success: true,
            data: {
                movements: paginated,
                totalCount,
                totalPages,
                stats,
                userDeptOptions,
            },
        };
    } catch (err: any) {
        console.error('Error fetching stock movements:', err);
        return {
            success: false,
            error: err?.message || 'Failed to fetch stock movements',
        };
    }
}
