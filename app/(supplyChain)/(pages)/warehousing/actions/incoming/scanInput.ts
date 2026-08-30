"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sanitizeBarcode } from "@/app/(supplyChain)/components/global/sanitize";
import { toast } from "sonner";
import { isRateLimited } from "@/app/(supplyChain)/components/global/rateLimit";

const generateTrackingNumber = () => {
    const date = new Date();
    const dateStr = date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomStr = '';
    for (let i = 0; i < 5; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TRK-${dateStr}-${randomStr}`;
};

export async function scanBarcode(barcodeValue: string) {
    try {

        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:scan_barcode`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const sanitized = sanitizeBarcode(barcodeValue);

        if (!sanitized || sanitized.length < 2 || sanitized.length > 100) {
            return {
                success: false,
                error: 'Invalid barcode',
                status: 400,
            };
        }

        const { data: existingInQueue, error: queueError } = await supabase
            .from('receiving_queue')
            .select('barcode, status')
            .eq('barcode', sanitized)
            .maybeSingle();

        if (queueError) {
        }

        if (existingInQueue) {
            return {
                success: false,
                error: `Duplicate in queue (Status: ${existingInQueue.status})`,
                status: 409,
                data: { existsIn: 'queue', status: existingInQueue.status }
            };
        }

        const { data: existingInParcels, error: parcelsError } = await supabase
            .from('parcels')
            .select('barcode, status, created_at')
            .eq('barcode', sanitized)
            .maybeSingle();

        if (parcelsError) {
        }

        if (existingInParcels) {
            const receivedDate = new Date(existingInParcels.created_at).toLocaleDateString();
            return {
                success: false,
                error: `Already received on ${receivedDate}`,
                status: 409,
                data: {
                    existsIn: 'parcels',
                    status: existingInParcels.status,
                    receivedAt: existingInParcels.created_at
                }
            };
        }

        const { data: mockParcel, error: mockError } = await supabase
            .from('mock_third_party_parcels')
            .select('*')
            .eq('barcode', sanitized)
            .maybeSingle();

        if (mockError) {
            toast.error(`ScanInputMockError: ${mockError}`);
        }


        const trackingNumber = generateTrackingNumber();

        const insertData: any = {
            barcode: sanitized,
            tracking_number: trackingNumber,
            status: 'pending',
            scanned_at: new Date().toISOString(),
        };

        if (mockParcel) {

            if (mockParcel.sender_name) insertData.sender_name = mockParcel.sender_name;
            if (mockParcel.customer_name) insertData.customer_name = mockParcel.customer_name;
            if (mockParcel.customer_number) insertData.customer_number = mockParcel.customer_number;
            if (mockParcel.destination) insertData.destination = mockParcel.destination;
            if (mockParcel.courier) insertData.courier = mockParcel.courier;
            if (mockParcel.courier_id) insertData.courier_id = mockParcel.courier_id;
            if (mockParcel.region) insertData.region = mockParcel.region;
            if (mockParcel.city) insertData.city = mockParcel.city;

        }


        const { data: insertResult, error: insertError } = await supabase
            .from('receiving_queue')
            .insert([insertData])
            .select();

        if (insertError) {

            if (insertError.code === '23505') {
                const newTrackingNumber = generateTrackingNumber();
                const newInsertData = { ...insertData, tracking_number: newTrackingNumber };

                const { data: retryData, error: retryError } = await supabase
                    .from('receiving_queue')
                    .insert([newInsertData])
                    .select();

                if (retryError) {
                    return {
                        success: false,
                        error: 'Failed to add parcel after retry',
                        status: 500,
                    };
                }

                revalidatePath('/warehousing');
                return {
                    success: true,
                    data: {
                        trackingNumber: newTrackingNumber,
                        mockParcel: mockParcel || null
                    },
                    status: 201,
                };
            }

            return {
                success: false,
                error: `Database error: ${insertError.message}`,
                status: 500,
            };
        }

        revalidatePath('/warehousing');
        return {
            success: true,
            data: {
                trackingNumber,
                mockParcel: mockParcel || null
            },
            status: 201,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            status: 500,
        };
    }
}