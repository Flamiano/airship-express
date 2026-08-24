"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const queryRateLimiter = new Map<string, { count: number; resetTime: number }>();

function isQueryRateLimited(key: string): boolean {
    const now = Date.now();
    const record = queryRateLimiter.get(key);

    if (!record || now > record.resetTime) {
        queryRateLimiter.set(key, { count: 1, resetTime: now + 60000 });
        return false;
    }

    if (record.count >= 30) {
        return true;
    }

    record.count++;
    queryRateLimiter.set(key, record);
    return false;
}

interface FetchParcelsParams {
    filter?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export async function fetchParcels(params: FetchParcelsParams = {}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isQueryRateLimited(`${ip}:fetch_parcels`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
                data: [],
                pagination: { page: 1, total: 0, totalPages: 1 },
                stats: { scanned: 0, topCourier: '' },
            };
        }

        const { filter, search, page = 1, limit = 10 } = params;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('receiving_queue')
            .select('*', { count: 'exact' })
            .eq('status', 'pending')
            .order('scanned_at', { ascending: false });

        if (filter) {
            query = query.eq('courier', filter);
        }

        if (search) {
            query = query.or(`barcode.ilike.%${search}%,tracking_number.ilike.%${search}%`);
        }

        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            return {
                success: false,
                error: 'Failed to fetch parcels',
                status: 500,
                data: [],
                pagination: { page: 1, total: 0, totalPages: 1 },
                stats: { scanned: 0, topCourier: '' },
            };
        }

        const { data: allData, error: statsError } = await supabase
            .from('receiving_queue')
            .select('courier')
            .eq('status', 'pending');

        let stats = { scanned: 0, topCourier: '' };

        if (!statsError && allData) {
            const total = allData.length;

            const courierCount: Record<string, number> = {};
            allData.forEach((p: any) => {
                if (p.courier) {
                    courierCount[p.courier] = (courierCount[p.courier] || 0) + 1;
                }
            });

            let topCourier = '';
            let maxCount = 0;
            for (const [courier, count] of Object.entries(courierCount)) {
                if (count > maxCount) {
                    maxCount = count;
                    topCourier = courier;
                }
            }

            stats = {
                scanned: total,
                topCourier: topCourier || 'No couriers'
            };
        }

        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        return {
            success: true,
            data: data || [],
            pagination: {
                page,
                total: totalItems,
                totalPages,
                limit,
            },
            stats,
            status: 200,
        };
    } catch (error) {
        return {
            success: false,
            error: 'Internal server error',
            status: 500,
            data: [],
            pagination: { page: 1, total: 0, totalPages: 1 },
            stats: { scanned: 0, topCourier: '' },
        };
    }
}

export async function getParcelCount() {
    try {
        const { count, error } = await supabase
            .from('receiving_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) throw error;
        return { success: true, count: count || 0 };
    } catch (error) {
        return { success: false, count: 0 };
    }
}