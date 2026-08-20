"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isRateLimited } from "@/app/(supplyChain)/components/global/rateLimit";


export async function deleteParcel(parcelId: number) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:delete_parcel`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        if (!parcelId || isNaN(parcelId)) {
            return {
                success: false,
                error: 'Invalid parcel ID',
                status: 400,
            };
        }

        const { data: existing, error: checkError } = await supabase
            .from('receiving_queue')
            .select('id')
            .eq('id', parcelId)
            .maybeSingle();

        if (checkError) {
            return {
                success: false,
                error: 'Failed to verify parcel existence',
                status: 500,
            };
        }

        if (!existing) {
            return {
                success: false,
                error: 'Parcel not found',
                status: 404,
            };
        }

        const { error: deleteError } = await supabase
            .from('receiving_queue')
            .delete()
            .eq('id', parcelId);

        if (deleteError) {
            return {
                success: false,
                error: 'Failed to delete parcel',
                status: 500,
            };
        }

        revalidatePath('/warehousing');

        return {
            success: true,
            data: { id: parcelId },
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

export async function deleteMultipleParcels(parcelIds: number[]) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:delete_batch`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        if (!parcelIds || parcelIds.length === 0) {
            return {
                success: false,
                error: 'No parcels selected for deletion',
                status: 400,
            };
        }

        const validIds = parcelIds.filter(id => id && !isNaN(id));
        if (validIds.length === 0) {
            return {
                success: false,
                error: 'Invalid parcel IDs provided',
                status: 400,
            };
        }

        const { data: existingParcels, error: checkError } = await supabase
            .from('receiving_queue')
            .select('id')
            .in('id', validIds);

        if (checkError) {
            return {
                success: false,
                error: 'Failed to verify parcels',
                status: 500,
            };
        }

        if (!existingParcels || existingParcels.length === 0) {
            return {
                success: false,
                error: 'No valid parcels found to delete',
                status: 404,
            };
        }

        const existingIds = existingParcels.map(p => p.id);
        const notFound = validIds.filter(id => !existingIds.includes(id));

        const { data: deleted, error: deleteError } = await supabase
            .from('receiving_queue')
            .delete()
            .in('id', existingIds)
            .select();

        if (deleteError) {
            return {
                success: false,
                error: 'Failed to delete parcels',
                status: 500,
            };
        }

        revalidatePath('/warehousing');

        return {
            success: true,
            data: {
                deleted: deleted?.length || 0,
                notFound: notFound,
                totalRequested: parcelIds.length,
            },
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