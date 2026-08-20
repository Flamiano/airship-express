"use server";

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sanitizeBarcode, sanitizeSearch } from '@/app/(supplyChain)/components/global/sanitize';
import { isRateLimited } from '@/app/(supplyChain)/components/global/rateLimit';

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

// RECEIVE ALL PARCELS

export async function receiveAllParcels() {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:receive_all`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const { data: parcels, error: fetchError } = await supabase
            .from('receiving_queue')
            .select('*')
            .neq('status', 'verified');

        if (fetchError) {
            return {
                success: false,
                error: 'Failed to fetch parcels',
                status: 500,
            };
        }

        if (!parcels || parcels.length === 0) {
            return {
                success: false,
                error: 'No parcels to receive',
                status: 404,
            };
        }

        const parcelsToInsert = parcels.map((p: any) => ({
            barcode: p.barcode,
            tracking_number: p.tracking_number,
            sender_name: p.sender_name || 'Unknown Sender',
            customer_name: p.customer_name || 'Unknown Customer',
            customer_number: p.customer_number || null,
            destination: p.destination || 'Unknown Destination',
            region: p.region || null,
            city: p.city || null,
            courier: p.courier || 'Unknown Courier',
            courier_id: p.courier_id || null,
            status: 'received',
            created_at: p.scanned_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
            .from('parcels')
            .insert(parcelsToInsert);

        if (insertError) {
            if (insertError.code === '23505') {
                return {
                    success: false,
                    error: 'Duplicate parcels detected in system',
                    status: 409,
                };
            }
            return {
                success: false,
                error: 'Failed to insert parcels',
                status: 500,
            };
        }

        const { error: deleteError } = await supabase
            .from('receiving_queue')
            .delete()
            .neq('status', 'verified');

        if (deleteError) {
            revalidatePath('/warehousing');
            return {
                success: true,
                data: { received: parcels.length, warning: true },
                status: 207,
            };
        }

        revalidatePath('/warehousing');

        return {
            success: true,
            data: { received: parcels.length },
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

// SCAN BARCODE

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

        if (!sanitized || sanitized.length < 3 || sanitized.length > 50) {
            return {
                success: false,
                error: 'Invalid barcode format',
                status: 400,
            };
        }

        const { data: existingQueue, error: checkQueueError } = await supabase
            .from('receiving_queue')
            .select('barcode, status')
            .eq('barcode', sanitized)
            .maybeSingle();

        if (checkQueueError) {
            return {
                success: false,
                error: 'Failed to check for duplicates',
                status: 500,
            };
        }

        if (existingQueue) {
            return {
                success: false,
                error: `Duplicate barcode detected - already in queue (Status: ${existingQueue.status})`,
                status: 409,
                data: {
                    existsIn: 'queue',
                    status: existingQueue.status
                }
            };
        }

        const { data: existingParcels, error: checkParcelsError } = await supabase
            .from('parcels')
            .select('barcode, status, created_at')
            .eq('barcode', sanitized)
            .maybeSingle();

        if (checkParcelsError) {
            return {
                success: false,
                error: 'Failed to check for duplicates',
                status: 500,
            };
        }

        if (existingParcels) {
            const receivedDate = new Date(existingParcels.created_at).toLocaleDateString();
            return {
                success: false,
                error: `Duplicate barcode detected - already received (Date: ${receivedDate})`,
                status: 409,
                data: {
                    existsIn: 'parcels',
                    status: existingParcels.status,
                    receivedAt: existingParcels.created_at
                }
            };
        }

        const trackingNumber = generateTrackingNumber();

        const { data, error } = await supabase
            .from('receiving_queue')
            .insert([
                {
                    barcode: sanitized,
                    tracking_number: trackingNumber,
                    status: 'pending',
                    scanned_at: new Date().toISOString(),
                }
            ])
            .select();

        if (error) {
            return {
                success: false,
                error: 'Failed to add parcel',
                status: 500,
            };
        }

        revalidatePath('/warehousing');

        return {
            success: true,
            data: { trackingNumber },
            status: 201,
        };
    } catch (error) {
        return {
            success: false,
            error: 'Internal server error',
            status: 500,
        };
    }
}

// DELETE SINGLE PARCEL

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

        if (checkError || !existing) {
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

// DELETE MULTIPLE PARCELS

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

// RECEIVE MULTIPLE PARCELS

export async function receiveMultipleParcels(parcelIds: number[]) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:receive_batch`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        if (!parcelIds || parcelIds.length === 0) {
            return {
                success: false,
                error: 'No parcels selected for receiving',
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

        // Fetch parcels to receive
        const { data: parcels, error: fetchError } = await supabase
            .from('receiving_queue')
            .select('*')
            .in('id', validIds);

        if (fetchError) {
            return {
                success: false,
                error: 'Failed to fetch parcels',
                status: 500,
            };
        }

        if (!parcels || parcels.length === 0) {
            return {
                success: false,
                error: 'No valid parcels found to receive',
                status: 404,
            };
        }

        // Check which parcels are already verified
        const alreadyVerified = parcels.filter(p => p.status === 'verified');
        const pendingParcels = parcels.filter(p => p.status !== 'verified');

        if (alreadyVerified.length > 0) {
            const verifiedIds = alreadyVerified.map(p => p.id);

            if (pendingParcels.length === 0) {
                return {
                    success: false,
                    error: 'All selected parcels are already received',
                    status: 400,
                    data: {
                        alreadyVerified: verifiedIds,
                        alreadyVerifiedCount: verifiedIds.length,
                    }
                };
            }

            // Continue with only pending parcels
            const pendingIds = pendingParcels.map(p => p.id);

            // Transform pending parcels for insertion
            const parcelsToInsert = pendingParcels.map((p: any) => ({
                barcode: p.barcode,
                tracking_number: p.tracking_number,
                sender_name: p.sender_name || 'Unknown Sender',
                customer_name: p.customer_name || null,
                customer_number: p.customer_number || null,
                destination: p.destination || 'Unknown Destination',
                region: p.region || null,
                city: p.city || null,
                courier: p.courier || 'Unknown Courier',
                courier_id: p.courier_id || null,
                status: 'received',
                created_at: p.scanned_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }));

            // Insert into parcels table
            const { error: insertError } = await supabase
                .from('parcels')
                .insert(parcelsToInsert);

            if (insertError) {
                if (insertError.code === '23505') {
                    return {
                        success: false,
                        error: 'Duplicate parcels detected in system',
                        status: 409,
                    };
                }
                return {
                    success: false,
                    error: 'Failed to insert parcels',
                    status: 500,
                };
            }

            // Delete received parcels from queue
            const { error: deleteError } = await supabase
                .from('receiving_queue')
                .delete()
                .in('id', pendingIds);

            if (deleteError) {
                // Still return success but with warning
                revalidatePath('/warehousing');
                return {
                    success: true,
                    data: {
                        received: pendingParcels.length,
                        skipped: alreadyVerified.length,
                        skippedIds: verifiedIds,
                        warning: true,
                    },
                    status: 207,
                };
            }

            revalidatePath('/warehousing');
            revalidatePath('/incoming');
            revalidatePath('/dashboard');

            return {
                success: true,
                data: {
                    received: pendingParcels.length,
                    skipped: alreadyVerified.length,
                    skippedIds: verifiedIds,
                },
                status: 200,
            };
        }

        // All selected are pending - proceed with all
        const parcelsToInsert = parcels.map((p: any) => ({
            barcode: p.barcode,
            tracking_number: p.tracking_number,
            sender_name: p.sender_name || 'Unknown Sender',
            customer_name: p.customer_name || null,
            customer_number: p.customer_number || null,
            destination: p.destination || 'Unknown Destination',
            region: p.region || null,
            city: p.city || null,
            courier: p.courier || 'Unknown Courier',
            courier_id: p.courier_id || null,
            status: 'received',
            created_at: p.scanned_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        // Insert into parcels table
        const { error: insertError } = await supabase
            .from('parcels')
            .insert(parcelsToInsert);

        if (insertError) {
            if (insertError.code === '23505') {
                return {
                    success: false,
                    error: 'Duplicate parcels detected in system',
                    status: 409,
                };
            }
            return {
                success: false,
                error: 'Failed to insert parcels',
                status: 500,
            };
        }

        // Delete received parcels from queue
        const allIds = parcels.map(p => p.id);
        const { error: deleteError } = await supabase
            .from('receiving_queue')
            .delete()
            .in('id', allIds);

        if (deleteError) {
            // Still return success but with warning
            revalidatePath('/warehousing');
            return {
                success: true,
                data: {
                    received: parcels.length,
                    skipped: 0,
                    warning: true,
                },
                status: 207,
            };
        }

        revalidatePath('/warehousing');
        revalidatePath('/incoming');
        revalidatePath('/dashboard');

        return {
            success: true,
            data: {
                received: parcels.length,
                skipped: 0,
            },
            status: 200,
        };
    } catch (error) {
        console.error('Unexpected error in receiveMultipleParcels:', error);
        return {
            success: false,
            error: 'Internal server error',
            status: 500,
        };
    }
}

// ADD MANUAL PARCEL

export async function addManualParcel(data: {
    barcode: string;
    sender_name?: string;
    destination: string;
    region: string;
    city: string;
    courier?: string;
    courier_id?: number;
    customer_name?: string;
    customer_number?: string;
}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:add_manual`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const trimmedBarcode = sanitizeBarcode(data.barcode);
        const trimmedDestination = sanitizeSearch(data.destination);
        const trimmedRegion = sanitizeSearch(data.region);
        const trimmedCity = sanitizeSearch(data.city);
        const trimmedSender = data.sender_name ? sanitizeSearch(data.sender_name) : '';
        const trimmedCustomerName = data.customer_name ? sanitizeSearch(data.customer_name) : '';
        const trimmedCustomerNumber = data.customer_number ? sanitizeSearch(data.customer_number) : '';

        // Validate barcode
        if (!trimmedBarcode || trimmedBarcode.length < 3 || trimmedBarcode.length > 50) {
            return {
                success: false,
                error: 'Invalid barcode format',
                status: 400,
            };
        }

        // Validate destination
        if (!trimmedDestination || trimmedDestination.length < 2) {
            return {
                success: false,
                error: 'Destination is required and must be at least 2 characters',
                status: 400,
            };
        }

        // Validate region
        if (!trimmedRegion || trimmedRegion.length < 2) {
            return {
                success: false,
                error: 'Region is required and must be at least 2 characters',
                status: 400,
            };
        }

        // Validate city
        if (!trimmedCity || trimmedCity.length < 2) {
            return {
                success: false,
                error: 'City is required and must be at least 2 characters',
                status: 400,
            };
        }

        // Validate customer number if provided
        if (trimmedCustomerNumber && !/^\d+$/.test(trimmedCustomerNumber)) {
            return {
                success: false,
                error: 'Customer number must contain only digits',
                status: 400,
            };
        }

        if (trimmedCustomerNumber && trimmedCustomerNumber.length > 11) {
            return {
                success: false,
                error: 'Customer number must not exceed 11 digits',
                status: 400,
            };
        }

        // Check for duplicates in queue
        const { data: existingQueue, error: checkQueueError } = await supabase
            .from('receiving_queue')
            .select('barcode')
            .eq('barcode', trimmedBarcode)
            .maybeSingle();

        if (checkQueueError) {
            return {
                success: false,
                error: 'Failed to check for duplicates',
                status: 500,
            };
        }

        if (existingQueue) {
            return {
                success: false,
                error: 'Duplicate barcode detected - already in queue',
                status: 409,
            };
        }

        // Check for duplicates in parcels
        const { data: existingParcels, error: checkParcelsError } = await supabase
            .from('parcels')
            .select('barcode')
            .eq('barcode', trimmedBarcode)
            .maybeSingle();

        if (checkParcelsError) {
            return {
                success: false,
                error: 'Failed to check for duplicates',
                status: 500,
            };
        }

        if (existingParcels) {
            return {
                success: false,
                error: 'Duplicate barcode detected - already received',
                status: 409,
            };
        }

        const trackingNumber = generateTrackingNumber();

        // Get courier name if courier_id is provided
        let courierName = data.courier;
        if (data.courier_id) {
            const { data: courier, error: courierError } = await supabase
                .from('couriers')
                .select('name')
                .eq('id', data.courier_id)
                .single();

            if (!courierError && courier) {
                courierName = courier.name;
            }
        }

        const { data: result, error } = await supabase
            .from('receiving_queue')
            .insert([
                {
                    barcode: trimmedBarcode,
                    tracking_number: trackingNumber,
                    sender_name: trimmedSender || null,
                    destination: trimmedDestination,
                    region: trimmedRegion,
                    city: trimmedCity,
                    courier: courierName || null,
                    courier_id: data.courier_id || null,
                    customer_name: trimmedCustomerName || null,
                    customer_number: trimmedCustomerNumber || null,
                    status: 'pending',
                    scanned_at: new Date().toISOString(),
                }
            ])
            .select();

        if (error) {
            return {
                success: false,
                error: 'Failed to add parcel',
                status: 500,
            };
        }

        revalidatePath('/warehousing');
        revalidatePath('/incoming');

        return {
            success: true,
            data: { trackingNumber },
            status: 201,
        };
    } catch (error) {
        console.error('Unexpected error in addManualParcel:', error);
        return {
            success: false,
            error: 'Internal server error',
            status: 500,
        };
    }
}