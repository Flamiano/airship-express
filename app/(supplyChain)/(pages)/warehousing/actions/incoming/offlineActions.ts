"use server";

import { supabase } from "../../../../lib/services/client/supabase";
import { revalidatePath } from "next/cache";
import { sanitizeBarcode } from "../../../../components/global/sanitize";

export interface OfflineParcelItem {
    barcode: string;
    scanned_at?: string;
    tracking_number?: string;
    sender_name?: string | null;
    customer_name?: string | null;
    customer_number?: string | null;
    destination?: string | null;
    courier?: string | null;
    courier_id?: string | null;
    region?: string | null;
    city?: string | null;
    foundMock?: boolean;
    alreadyInQueue?: boolean;
    alreadyInParcels?: boolean;
}

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

/**
 * Fetch mock third-party parcel info for a list of scanned barcodes
 * and check if any already exist in receiving_queue or parcels.
 */
export async function fetchBatchMockParcels(barcodes: string[]) {
    try {
        const sanitizedList = Array.from(
            new Set(barcodes.map(b => sanitizeBarcode(b)).filter(Boolean))
        );

        if (sanitizedList.length === 0) {
            return {
                success: true,
                data: [],
            };
        }

        // 1. Check existing in receiving_queue
        const { data: queueData } = await supabase
            .from('receiving_queue')
            .select('barcode, status')
            .in('barcode', sanitizedList);

        const queueMap = new Map((queueData || []).map(q => [q.barcode, q.status]));

        // 2. Check existing in parcels
        const { data: parcelsData } = await supabase
            .from('parcels')
            .select('barcode, status')
            .in('barcode', sanitizedList);

        const parcelsMap = new Map((parcelsData || []).map(p => [p.barcode, p.status]));

        // 3. Fetch from mock_third_party_parcels
        const { data: mockData, error: mockError } = await supabase
            .from('mock_third_party_parcels')
            .select('*')
            .in('barcode', sanitizedList);

        if (mockError) {
            console.error('Error fetching mock parcels:', mockError);
        }

        const mockMap = new Map((mockData || []).map(m => [m.barcode, m]));

        // 4. Map results
        const results: OfflineParcelItem[] = sanitizedList.map(barcode => {
            const mock = mockMap.get(barcode);
            const inQueue = queueMap.has(barcode);
            const inParcels = parcelsMap.has(barcode);

            return {
                barcode,
                tracking_number: mock?.tracking_number || generateTrackingNumber(),
                sender_name: mock?.sender_name || null,
                customer_name: mock?.customer_name || null,
                customer_number: mock?.customer_number || null,
                destination: mock?.destination || null,
                courier: mock?.courier || null,
                courier_id: mock?.courier_id || null,
                region: mock?.region || null,
                city: mock?.city || null,
                foundMock: !!mock,
                alreadyInQueue: inQueue,
                alreadyInParcels: inParcels,
            };
        });

        return {
            success: true,
            data: results,
        };
    } catch (error) {
        console.error('fetchBatchMockParcels error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch parcel details',
            data: [],
        };
    }
}

import { cookies } from "next/headers";

/**
 * Batch insert offline scanned parcels into the receiving_queue table.
 */
export async function batchInsertOfflineParcels(items: OfflineParcelItem[], scannedBy?: string) {
    try {
        if (!items || items.length === 0) {
            return {
                success: false,
                error: 'No parcels provided',
                insertedCount: 0,
            };
        }

        let finalScannedBy = scannedBy?.trim() || null;
        if (!finalScannedBy) {
            try {
                const cookieStore = await cookies();
                const token = cookieStore.get('session_token')?.value || cookieStore.get('sc_session_token')?.value;
                if (token) {
                    const { data } = await supabase
                        .from('sessions')
                        .select('user_id')
                        .eq('session_token', token)
                        .maybeSingle();
                    if (data?.user_id) {
                        finalScannedBy = data.user_id;
                    }
                }
            } catch {
                // Ignore cookie lookup error
            }
        }

        const validItems = items.filter(item => !item.alreadyInQueue && !item.alreadyInParcels);

        if (validItems.length === 0) {
            return {
                success: false,
                error: 'All selected parcels already exist in queue or inventory.',
                insertedCount: 0,
            };
        }

        const rowsToInsert = validItems.map(item => ({
            barcode: sanitizeBarcode(item.barcode),
            tracking_number: item.tracking_number || generateTrackingNumber(),
            sender_name: item.sender_name || null,
            customer_name: item.customer_name || null,
            customer_number: item.customer_number || null,
            destination: item.destination || null,
            courier: item.courier || null,
            courier_id: item.courier_id || null,
            region: item.region || null,
            city: item.city || null,
            status: 'pending',
            scanned_by: finalScannedBy || null,
            scanned_at: item.scanned_at || new Date().toISOString(),
        }));

        const { data, error } = await supabase
            .from('receiving_queue')
            .insert(rowsToInsert)
            .select();

        if (error) {
            console.error('Batch insert receiving_queue error:', error);
            return {
                success: false,
                error: error.message || 'Database error inserting parcels',
                insertedCount: 0,
            };
        }

        revalidatePath('/warehousing');

        return {
            success: true,
            insertedCount: data ? data.length : rowsToInsert.length,
            data,
        };
    } catch (error) {
        console.error('batchInsertOfflineParcels error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            insertedCount: 0,
        };
    }
}
