// app/(supplyChain)/ai/actions/get_receiving_queue.ts

import { supabase } from "../../lib/services/client/supabase";

export interface ReceivingQueueItem {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    destination: string | null;
    courier: string | null;
    scanned_at: string;
    status: 'pending' | 'verified' | 'rejected';
    courier_id: number | null;
    region: string | null;
}

/**
 * Get receiving queue items
 */
export async function getReceivingQueue(
    status?: 'pending' | 'verified' | 'rejected'
): Promise<ReceivingQueueItem[]> {


    let query = supabase
        .from('receiving_queue')
        .select('*')
        .order('scanned_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch receiving queue: ${error.message}`);
    }

    return data || [];
}

/**
 * Get receiving queue summary
 */
export async function getReceivingQueueSummary(): Promise<{
    total: number;
    pending: number;
    verified: number;
    rejected: number;
}> {


    const { data, error } = await supabase
        .from('receiving_queue')
        .select('status');

    if (error) throw error;

    const total = data?.length || 0;
    const pending = data?.filter((i: any) => i.status === 'pending').length || 0;
    const verified = data?.filter((i: any) => i.status === 'verified').length || 0;
    const rejected = data?.filter((i: any) => i.status === 'rejected').length || 0;

    return { total, pending, verified, rejected };
}