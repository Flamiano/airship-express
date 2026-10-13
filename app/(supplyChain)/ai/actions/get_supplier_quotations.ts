// app/(supplyChain)/ai/actions/get_supplier_quotations.ts

import { supabase } from "../../lib/services/client/supabase";

export interface SupplierQuotation {
    id: number | string;
    supplier_id?: number | null;
    supplier_name: string;
    request_number: string;
    item_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_amount: number;
    availability: string;
    lead_time_days?: string | null;
    status: string;
    created_at: string;
}

export interface SupplierMeeting {
    id: string;
    supplier_name: string;
    title: string;
    meeting_type: string;
    meeting_date: string;
    start_time: string;
    end_time?: string | null;
    meeting_link?: string | null;
    agenda: string;
    status: string;
    request_number?: string | null;
}

export interface QuotationsAndMeetingsSummary {
    totalQuotations: number;
    pendingQuotations: number;
    totalMeetings: number;
    scheduledMeetings: number;
    recentQuotations: SupplierQuotation[];
    upcomingMeetings: SupplierMeeting[];
}

/**
 * Fetch supplier quotations
 */
export async function getSupplierQuotations(params?: {
    supplier?: string;
    request_number?: string;
    status?: string;
    limit?: number;
}): Promise<SupplierQuotation[]> {
    let q = supabase
        .from('supplier_quotations')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.supplier) {
        q = q.ilike('supplier_name', `%${params.supplier}%`);
    }

    if (params?.request_number) {
        q = q.ilike('request_number', `%${params.request_number}%`);
    }

    if (params?.status) {
        q = q.ilike('status', `%${params.status}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching supplier quotations:', error);
        return [];
    }

    return (data || []) as SupplierQuotation[];
}

/**
 * Fetch supplier meetings
 */
export async function getSupplierMeetings(params?: {
    status?: string;
    supplier?: string;
    limit?: number;
}): Promise<SupplierMeeting[]> {
    let q = supabase
        .from('supplier_meetings')
        .select('*')
        .order('meeting_date', { ascending: true });

    if (params?.status) {
        q = q.ilike('status', `%${params.status}%`);
    }

    if (params?.supplier) {
        q = q.ilike('supplier_name', `%${params.supplier}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching supplier meetings:', error);
        return [];
    }

    return (data || []) as SupplierMeeting[];
}

/**
 * Aggregated summary of vendor quotations and meetings
 */
export async function getQuotationsAndMeetingsSummary(): Promise<QuotationsAndMeetingsSummary> {
    const [quotes, meetings] = await Promise.all([
        getSupplierQuotations({ limit: 100 }),
        getSupplierMeetings({ limit: 100 }),
    ]);

    let pendingQuotations = 0;
    quotes.forEach(quote => {
        const st = (quote.status || '').toLowerCase();
        if (st.includes('pending')) {
            pendingQuotations++;
        }
    });

    let scheduledMeetings = 0;
    meetings.forEach(m => {
        const st = (m.status || '').toLowerCase();
        if (st.includes('scheduled')) {
            scheduledMeetings++;
        }
    });

    return {
        totalQuotations: quotes.length,
        pendingQuotations,
        totalMeetings: meetings.length,
        scheduledMeetings,
        recentQuotations: quotes.slice(0, 10),
        upcomingMeetings: meetings.slice(0, 10),
    };
}
