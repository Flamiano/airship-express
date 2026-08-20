"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { headers } from "next/headers";
import { isRateLimited } from "@/app/(supplyChain)/components/global/rateLimit";

export async function getLastScan() {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        //  fetch last scan from server
        const { data, error } = await supabase
            .from('receiving_queue')
            .select('barcode, status')
            .order('scanned_at', { ascending: false })
            .limit(1);

        if (error) {
            return {
                success: false,
                error: 'Failed to fetch last scan',
                status: 500,
            };
        }

        if (data && data.length > 0) {
            return {
                success: true,
                data: {
                    barcode: data[0].barcode,
                    status: data[0].status,
                },
                status: 200,
            };
        }

        return {
            success: true,
            data: null,
            status: 200,
        };
    } catch (error) {
        return {
            success: false,
            error: 'Internal server error',
            status: 500,
        };
    }
}