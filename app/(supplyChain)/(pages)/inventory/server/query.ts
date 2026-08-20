'use server';

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isRateLimited } from '@/app/(supplyChain)/components/global/rateLimit';
import { sanitizeSearch } from '@/app/(supplyChain)/components/global/sanitize';

// types
export interface InventoryItem {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    current_stock: number;
    unit: string;
    minimum_stock: number;
    storage_location: string;
    status: 'available' | 'low-stock' | 'out-of-stock';
    updated_at: string;
    description?: string;
    supplier?: string;
    purchase_price?: number;
    created_at?: string;
}

export interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    region: string | null;
    courier: string | null;
    scanned_by: string | null;
    scanned_at: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    is_active: boolean;
}

// get inventory items with pagination and filters
export async function fetchInventoryItems(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:inventory_fetch`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const { page = 1, limit = 30, search = '', category = 'all', status = 'all' } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('inventory_items')
            .select('*', { count: 'exact' });

        if (search) {
            const sanitizedSearch = sanitizeSearch(search);
            query = query.or(
                `item_name.ilike.%${sanitizedSearch}%,` +
                `item_code.ilike.%${sanitizedSearch}%`
            );
        }

        if (category !== 'all') {
            query = query.eq('category', category);
        }

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { count: totalCount, error: countError } = await query;
        if (countError) throw countError;

        const { data, error } = await query
            .order('item_name')
            .range(from, to);

        if (error) throw error;

        return {
            success: true,
            data: {
                items: data || [],
                totalItems: totalCount || 0,
                page,
                limit,
                totalPages: Math.ceil((totalCount || 0) / limit),
            },
            status: 200,
        };
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        return {
            success: false,
            error: 'Failed to fetch inventory items',
            status: 500,
        };
    }
}

// get parcels with pagination and filters
export async function fetchParcels(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:parcels_fetch`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const { page = 1, limit = 15, search = '', status = '', dateFrom = '', dateTo = '' } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('parcels')
            .select('*', { count: 'exact' });

        if (search) {
            const sanitizedSearch = sanitizeSearch(search);
            query = query.or(
                `barcode.ilike.%${sanitizedSearch}%,` +
                `tracking_number.ilike.%${sanitizedSearch}%,` +
                `sender_name.ilike.%${sanitizedSearch}%`
            );
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo + 'T23:59:59');
        }

        const { count: totalCount, error: countError } = await query;
        if (countError) throw countError;

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            success: true,
            data: {
                parcels: data || [],
                totalItems: totalCount || 0,
                page,
                limit,
                totalPages: Math.ceil((totalCount || 0) / limit),
            },
            status: 200,
        };
    } catch (error) {
        console.error('Error fetching parcels:', error);
        return {
            success: false,
            error: 'Failed to fetch parcels',
            status: 500,
        };
    }
}

// get all active suppliers
export async function fetchSuppliers() {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:suppliers_fetch`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        return {
            success: true,
            data: data || [],
            status: 200,
        };
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        return {
            success: false,
            error: 'Failed to fetch suppliers',
            status: 500,
        };
    }
}

// get dashboard statistics
export async function fetchDashboardStats() {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:dashboard_stats`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        const { count: totalItems, error: totalError } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        const { count: lowStock, error: lowError } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'low-stock');

        if (lowError) throw lowError;

        const { count: outOfStock, error: outError } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'out-of-stock');

        if (outError) throw outError;

        const { data: categoryData, error: categoryError } = await supabase
            .from('inventory_items')
            .select('category', { count: 'exact' });

        if (categoryError) throw categoryError;

        const categoryCounts: Record<string, number> = {};
        categoryData?.forEach(item => {
            categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        });

        const { data: lowStockItems, error: lowItemsError } = await supabase
            .from('inventory_items')
            .select('id, item_name, current_stock, minimum_stock, unit, status')
            .in('status', ['low-stock', 'out-of-stock'])
            .order('current_stock', { ascending: true })
            .limit(6);

        if (lowItemsError) throw lowItemsError;

        return {
            success: true,
            data: {
                totalItems: totalItems || 0,
                lowStock: lowStock || 0,
                outOfStock: outOfStock || 0,
                categoryCounts,
                lowStockItems: lowStockItems || [],
            },
            status: 200,
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return {
            success: false,
            error: 'Failed to fetch dashboard stats',
            status: 500,
        };
    }
}

// fetch all the data needed for the inventory page in one go, running everything simultaneously so it's faster
export async function fetchInventoryPageData(params: {
    inventoryPage?: number;
    inventoryLimit?: number;
    inventorySearch?: string;
    inventoryCategory?: string;
    inventoryStatus?: string;
    parcelPage?: number;
    parcelLimit?: number;
    parcelSearch?: string;
    parcelStatus?: string;
    parcelDateFrom?: string;
    parcelDateTo?: string;
}) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        if (isRateLimited(`${ip}:inventory_page`)) {
            return {
                success: false,
                error: 'Too many requests. Please wait.',
                status: 429,
            };
        }

        // run all queries at the same time so it don't wait for each one to finish before starting the next
        const [
            inventoryResult,
            parcelsResult,
            suppliersResult,
            statsResult,
        ] = await Promise.all([
            fetchInventoryItems({
                page: params.inventoryPage || 1,
                limit: params.inventoryLimit || 15,
                search: params.inventorySearch || '',
                category: params.inventoryCategory || 'all',
                status: params.inventoryStatus || 'all',
            }),
            fetchParcels({
                page: params.parcelPage || 1,
                limit: params.parcelLimit || 30,
                search: params.parcelSearch || '',
                status: params.parcelStatus || '',
                dateFrom: params.parcelDateFrom || '',
                dateTo: params.parcelDateTo || '',
            }),
            fetchSuppliers(),
            fetchDashboardStats(),
        ]);

        return {
            success: true,
            data: {
                inventory: inventoryResult.success ? inventoryResult.data : null,
                parcels: parcelsResult.success ? parcelsResult.data : null,
                suppliers: suppliersResult.success ? suppliersResult.data : [],
                stats: statsResult.success ? statsResult.data : null,
            },
            status: 200,
        };
    } catch (error) {
        console.error('Error fetching inventory page data:', error);
        return {
            success: false,
            error: 'Failed to fetch inventory page data',
            status: 500,
        };
    }
}