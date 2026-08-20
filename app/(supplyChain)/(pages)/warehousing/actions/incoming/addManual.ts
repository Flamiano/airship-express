"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const rateLimiter = new Map<string, { count: number; resetTime: number }>();

const generateTrackingNumber = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).toUpperCase().slice(2, 7);
    return `TRK-${date}-${random}`;
};

export async function addManualParcel(data: {
    barcode: string;
    sender_name?: string;
    destination: string;
    region: string;
    city: string;
    province: string;
    courier_id?: number;
    customer_name?: string;
    customer_number?: string;
}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // Rate limiting
        const now = Date.now();
        const userRate = rateLimiter.get(ip);
        if (userRate) {
            if (now < userRate.resetTime) {
                if (userRate.count >= 5) {
                    return {
                        success: false,
                        error: 'Too many requests. Please try again later.',
                        status: 429,
                    };
                }
                userRate.count++;
            } else {
                rateLimiter.set(ip, { count: 1, resetTime: now + 60000 });
            }
        } else {
            rateLimiter.set(ip, { count: 1, resetTime: now + 60000 });
        }

        // Sanitize inputs
        const trimmedBarcode = data.barcode.trim();
        const trimmedDestination = data.destination.trim();
        const trimmedRegion = data.region.trim();
        const trimmedCity = data.city.trim();
        const trimmedProvince = data.province.trim();

        // Generate tracking number automatically
        const trackingNumber = generateTrackingNumber();

        // VALIDATION

        // Validate barcode
        if (!trimmedBarcode) {
            return {
                success: false,
                error: 'Barcode is required',
                status: 400,
            };
        }

        if (trimmedBarcode.length < 3 || trimmedBarcode.length > 50) {
            return {
                success: false,
                error: 'Barcode must be between 3 and 50 characters',
                status: 400,
            };
        }

        if (!/^[a-zA-Z0-9-_]+$/.test(trimmedBarcode)) {
            return {
                success: false,
                error: 'Invalid barcode format. Only alphanumeric, hyphens, and underscores allowed.',
                status: 400,
            };
        }

        // Validate destination
        if (!trimmedDestination) {
            return {
                success: false,
                error: 'Destination is required',
                status: 400,
            };
        }

        if (trimmedDestination.length < 2) {
            return {
                success: false,
                error: 'Destination must be at least 2 characters',
                status: 400,
            };
        }

        // Validate region
        if (!trimmedRegion) {
            return {
                success: false,
                error: 'Region is required',
                status: 400,
            };
        }

        if (trimmedRegion.length < 2) {
            return {
                success: false,
                error: 'Region must be at least 2 characters',
                status: 400,
            };
        }

        // Validate city
        if (!trimmedCity) {
            return {
                success: false,
                error: 'City is required',
                status: 400,
            };
        }

        if (trimmedCity.length < 2) {
            return {
                success: false,
                error: 'City must be at least 2 characters',
                status: 400,
            };
        }

        // Validate province
        if (!trimmedProvince) {
            return {
                success: false,
                error: 'Province is required',
                status: 400,
            };
        }

        if (trimmedProvince.length < 2) {
            return {
                success: false,
                error: 'Province must be at least 2 characters',
                status: 400,
            };
        }

        // Validate optional fields
        if (data.sender_name && data.sender_name.trim().length < 2) {
            return {
                success: false,
                error: 'Sender name must be at least 2 characters',
                status: 400,
            };
        }

        if (data.customer_name && data.customer_name.trim().length < 2) {
            return {
                success: false,
                error: 'Customer name must be at least 2 characters',
                status: 400,
            };
        }

        // Validate customer number - digits only, max 11
        if (data.customer_number) {
            const customerNumber = data.customer_number.trim();
            if (!/^\d+$/.test(customerNumber)) {
                return {
                    success: false,
                    error: 'Customer number must contain only digits',
                    status: 400,
                };
            }
            if (customerNumber.length > 11) {
                return {
                    success: false,
                    error: 'Customer number must not exceed 11 digits',
                    status: 400,
                };
            }
        }

        // CHECK FOR DUPLICATES

        // Check barcode duplicate
        const { data: existingBarcode, error: checkBarcodeError } = await supabase
            .from('receiving_queue')
            .select('barcode')
            .eq('barcode', trimmedBarcode)
            .maybeSingle();

        if (checkBarcodeError) {
            console.error('Error checking barcode:', checkBarcodeError);
            return {
                success: false,
                error: 'Failed to check for duplicates',
                status: 500,
            };
        }

        if (existingBarcode) {
            return {
                success: false,
                error: 'Duplicate barcode detected - already in queue',
                status: 409,
            };
        }

        // GET COURIER NAME

        let courierName = null;
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

        // PREPARE INSERT DATA

        const insertData = {
            barcode: trimmedBarcode,
            tracking_number: trackingNumber,
            sender_name: data.sender_name?.trim() || null,
            destination: trimmedDestination,
            region: trimmedRegion,
            city: trimmedCity,
            courier: courierName,
            courier_id: data.courier_id || null,
            customer_name: data.customer_name?.trim() || null,
            customer_number: data.customer_number?.trim() || null,
            status: 'pending',
            scanned_at: new Date().toISOString(),
        };

        // INSERT WITH RETRY LOGIC

        let retries = 3;
        let inserted = false;
        let lastError = null;

        while (retries > 0 && !inserted) {
            try {
                const { data: result, error } = await supabase
                    .from('receiving_queue')
                    .insert([insertData])
                    .select();

                if (error) {
                    if (error.code === '23505') {
                        const newTrackingNumber = generateTrackingNumber();
                        const newInsertData = {
                            ...insertData,
                            tracking_number: newTrackingNumber
                        };

                        const { data: retryData, error: retryError } = await supabase
                            .from('receiving_queue')
                            .insert([newInsertData])
                            .select();

                        if (retryError) throw retryError;
                        inserted = true;

                        revalidatePath('/warehousing');
                        revalidatePath('/incoming');
                        return {
                            success: true,
                            data: {
                                trackingNumber: newTrackingNumber,
                                barcode: trimmedBarcode
                            },
                            status: 201,
                        };
                    }
                    throw error;
                }

                inserted = true;

                revalidatePath('/warehousing');
                revalidatePath('/incoming');
                revalidatePath('/dashboard');

                return {
                    success: true,
                    data: {
                        trackingNumber: trackingNumber,
                        barcode: trimmedBarcode
                    },
                    status: 201,
                };
            } catch (error) {
                lastError = error;
                retries--;
                console.error(`Insert attempt failed (${retries} retries left):`, error);

                if (retries === 0) {
                    return {
                        success: false,
                        error: 'Failed to add parcel after multiple attempts',
                        status: 500,
                    };
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return {
            success: false,
            error: 'Failed to add parcel',
            status: 500,
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