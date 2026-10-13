// app/(supplyChain)/ai/actions/get_document_verifications.ts

import { supabase } from "../../lib/services/client/supabase";

export interface DocumentVerification {
    id: string;
    purchase_order_id: string;
    uploaded_file_url: string;
    extracted_json: any;
    compared_fields?: any;
    match_result: 'pending' | 'matched' | 'mismatched' | 'forced' | string;
    document_id?: string | null;
    submitted_by: string;
    resolved_by?: string | null;
    created_at: string;
    resolved_at?: string | null;
}

export interface DocumentVerificationsSummary {
    totalVerifications: number;
    matchedCount: number;
    mismatchedCount: number;
    pendingCount: number;
    forcedCount: number;
    recentVerifications: DocumentVerification[];
}

/**
 * Fetch document verifications with optional match_result filter
 */
export async function getDocumentVerifications(params?: {
    match_result?: string;
    purchase_order_id?: string;
    limit?: number;
}): Promise<DocumentVerification[]> {
    let q = supabase
        .from('document_verifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (params?.match_result) {
        q = q.eq('match_result', params.match_result);
    }

    if (params?.purchase_order_id) {
        q = q.eq('purchase_order_id', params.purchase_order_id);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    } else {
        q = q.limit(50);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching document verifications:', error);
        return [];
    }

    return (data || []) as DocumentVerification[];
}

/**
 * Aggregated summary of document verifications (Gemini OCR receipt vs PO comparisons)
 */
export async function getDocumentVerificationsSummary(): Promise<DocumentVerificationsSummary> {
    const verifications = await getDocumentVerifications({ limit: 150 });

    let matchedCount = 0;
    let mismatchedCount = 0;
    let pendingCount = 0;
    let forcedCount = 0;

    verifications.forEach(v => {
        const res = (v.match_result || '').toLowerCase();
        if (res === 'matched') matchedCount++;
        else if (res === 'mismatched') mismatchedCount++;
        else if (res === 'forced') forcedCount++;
        else pendingCount++;
    });

    return {
        totalVerifications: verifications.length,
        matchedCount,
        mismatchedCount,
        pendingCount,
        forcedCount,
        recentVerifications: verifications.slice(0, 10),
    };
}
