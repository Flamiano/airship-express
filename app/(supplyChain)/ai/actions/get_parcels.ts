// app/(supplyChain)/ai/actions/get_parcels.ts

import { supabase } from "../../lib/services/client/supabase";

export interface ParcelFilters {
    status?: string;
    courier?: string;
    dateFrom?: string;
    dateTo?: string;
    destination?: string;
    limit?: number;
}

export interface Parcel {
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
}

/**
 * Get parcels from the database with optional filters
 */
export async function getParcels(filters: ParcelFilters = {}): Promise<Parcel[]> {

    let query = supabase
        .from('parcels')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    if (filters.courier) {
        query = query.eq('courier', filters.courier);
    }

    if (filters.destination) {
        query = query.eq('destination', filters.destination);
    }

    if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch parcels: ${error.message}`);
    }

    return data || [];
}

/**
 * Get parcel statistics (counts by status, date, etc.)
 */
export async function getParcelStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    today: number;
    yesterday: number;
}> {
    // FIX: Get all parcels and calculate stats in JavaScript instead of using .group()
    const { data: allParcels, error: fetchError } = await supabase
        .from('parcels')
        .select('status, created_at');

    if (fetchError) throw fetchError;

    const parcels = allParcels || [];

    // Calculate total
    const total = parcels.length;

    // Calculate by status
    const byStatus: Record<string, number> = {};
    parcels.forEach((parcel: any) => {
        byStatus[parcel.status] = (byStatus[parcel.status] || 0) + 1;
    });

    // Calculate today's count
    const today = new Date().toISOString().split('T')[0];
    const todayCount = parcels.filter((p: any) =>
        p.created_at?.startsWith(today)
    ).length;

    // Calculate yesterday's count
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayCount = parcels.filter((p: any) =>
        p.created_at?.startsWith(yesterday)
    ).length;

    return {
        total,
        byStatus,
        today: todayCount,
        yesterday: yesterdayCount,
    };
}

/**
 * Get parcels received today
 */
export async function getTodayParcels(): Promise<Parcel[]> {
    const today = new Date().toISOString().split('T')[0];
    return getParcels({
        dateFrom: today,
        status: 'received'
    });
}