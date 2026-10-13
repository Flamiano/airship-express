"use server";
import { supabase } from '../../../lib/services/client/supabase';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { isRateLimited } from '../../../components/global/rateLimit';
import { sanitizeSearch } from '../../../components/global/sanitize';
import { evaluateItemMatch } from '../utils/itemMatching';
import { logStockMovement } from './stock-movements';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || '';
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || 
                       process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || '';

const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
export interface LatestPOInfo {
    poi_id?: string;
    purchase_order_id?: string;
    po_number?: string;
    status?: string;
    paid?: boolean;
    fully_received?: boolean;
    quantity_ordered?: number;
    quantity_received?: number;
    unit_price?: number;
    supplier_name?: string;
    delivery_date?: string;
    is_request?: boolean;
    request_number?: string;
    request_id?: string;
    created_at?: string;
    has_pending_pr?: boolean;
    pending_pr_number?: string;
    pending_pr_id?: string;
}
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
    latest_po?: LatestPOInfo | null;
    force_updated_by?: string | null;
    force_updated_by_name?: string | null;
    force_updated_at?: string | null;
    force_reason?: string | null;
}
export interface DriverOption {
    name: string;
    count: number;
}
export interface ScannerUser {
    id: string;
    name: string;
    email: string;
    role: string;
    scanned_count: number;
    status_counts: Record<string, number>;
    last_scanned_at: string | null;
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
/**
 * Attaches the latest PO / PO item or pending PR info to each inventory item
 */
async function attachLatestPOToItems(items: any[]) {
    if (!items || items.length === 0)
        return items;
    const itemIds = items.map(item => item.id).filter(Boolean);
    try {
        // 1. Fetch latest POIs for these items
        const { data: poiData } = await supabase
            .from('purchase_order_items')
            .select(`
                id,
                purchase_order_id,
                inventory_item_id,
                item_name,
                quantity_ordered,
                quantity_received,
                unit_price,
                stocked_in_at,
                created_at,
                purchase_orders (
                    id,
                    po_number,
                    status,
                    paid,
                    fully_received,
                    supplier_name,
                    delivery_date,
                    created_at
                )
            `)
            .in('inventory_item_id', itemIds)
            .order('created_at', { ascending: false });

        // Map PO by item id (first occurrence is latest due to ordering)
        const poMap = new Map<string, LatestPOInfo>();
        if (poiData) {
            for (const poi of poiData) {
                const key = String(poi.inventory_item_id);
                if (!poMap.has(key)) {
                    const po = (poi as any).purchase_orders;
                    poMap.set(key, {
                        poi_id: poi.id,
                        purchase_order_id: poi.purchase_order_id,
                        po_number: po?.po_number,
                        status: po?.status,
                        paid: po?.paid,
                        fully_received: po?.fully_received,
                        quantity_ordered: poi.quantity_ordered,
                        quantity_received: poi.quantity_received,
                        unit_price: poi.unit_price,
                        supplier_name: po?.supplier_name,
                        delivery_date: po?.delivery_date,
                        is_request: false,
                        created_at: po?.created_at || poi.created_at,
                    });
                }
            }
        }

        // 2. fetch purchase requests for active pipeline (pending and approved) or recent window (last 60 days)
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data: prData } = await supabase
            .from('purchase_requests')
            .select('id, request_number, status, supplier_name, items, created_at')
            .or(`status.in.(Pending,Approved),created_at.gte.${sixtyDaysAgo}`)
            .order('created_at', { ascending: false })
            .limit(300);

        // index prs by inventory item id and lowercased item name for o(1) matching
        const prsByItemId = new Map<string, { pr: any; item: any }[]>();
        const prsByItemName = new Map<string, { pr: any; item: any }[]>();

        for (const pr of prData || []) {
            const prItems = Array.isArray(pr.items) ? pr.items : [];
            for (const pi of prItems) {
                if (pi.inventory_item_id != null) {
                    const idKey = String(pi.inventory_item_id);
                    if (!prsByItemId.has(idKey)) prsByItemId.set(idKey, []);
                    prsByItemId.get(idKey)!.push({ pr, item: pi });
                }
                const nameKey = (pi.name || pi.item_name || '').toLowerCase().trim();
                if (nameKey) {
                    if (!prsByItemName.has(nameKey)) prsByItemName.set(nameKey, []);
                    prsByItemName.get(nameKey)!.push({ pr, item: pi });
                }
            }
        }

        const latestActivityMap = new Map<string, LatestPOInfo>();

        for (const item of items) {
            const key = String(item.id);
            const nameKey = (item.item_name || '').toLowerCase().trim();
            const existingPO = poMap.get(key);

            // fast indexed lookup for matching purchase requests
            const candidates = [
                ...(prsByItemId.get(key) || []),
                ...(prsByItemName.get(nameKey) || [])
            ];
            const seenPrIds = new Set<string>();
            const matchingEntries: { pr: any; item: any }[] = [];
            for (const c of candidates) {
                if (!seenPrIds.has(c.pr.id)) {
                    seenPrIds.add(c.pr.id);
                    matchingEntries.push(c);
                }
            }

            const pendingEntry = matchingEntries.find(e => (e.pr.status || '').toLowerCase() === 'pending');
            const hasPendingPR = Boolean(pendingEntry);
            const latestEntry = matchingEntries[0];

            let chosenActivity: LatestPOInfo | null = null;

            if (latestEntry) {
                const latestPR = latestEntry.pr;
                const matchingItem = latestEntry.item;

                const prInfo: LatestPOInfo = {
                    is_request: true,
                    request_id: latestPR.id,
                    request_number: latestPR.request_number,
                    status: latestPR.status,
                    supplier_name: latestPR.supplier_name,
                    quantity_ordered: matchingItem?.quantity || 0,
                    quantity_received: 0,
                    unit_price: matchingItem?.unit_price || matchingItem?.price || 0,
                    created_at: latestPR.created_at,
                    has_pending_pr: hasPendingPR,
                    pending_pr_number: pendingEntry?.pr.request_number,
                    pending_pr_id: pendingEntry?.pr.id,
                };

                if (!existingPO) {
                    chosenActivity = prInfo;
                } else {
                    const poDate = existingPO.created_at ? new Date(existingPO.created_at).getTime() : 0;
                    const prDate = latestPR.created_at ? new Date(latestPR.created_at).getTime() : 0;
                    const isPOFinished = ['delivered', 'cancelled', 'completed'].includes((existingPO.status || '').toLowerCase());

                    if (hasPendingPR) {
                        // if there is an active pending pr, that takes precedence over any completed/previous po
                        if (pendingEntry && pendingEntry.pr.id !== latestPR.id) {
                            const pendingMatch = pendingEntry.item;
                            chosenActivity = {
                                is_request: true,
                                request_id: pendingEntry.pr.id,
                                request_number: pendingEntry.pr.request_number,
                                status: pendingEntry.pr.status,
                                supplier_name: pendingEntry.pr.supplier_name,
                                quantity_ordered: pendingMatch?.quantity || 0,
                                quantity_received: 0,
                                unit_price: pendingMatch?.unit_price || pendingMatch?.price || 0,
                                created_at: pendingEntry.pr.created_at,
                                has_pending_pr: true,
                                pending_pr_number: pendingEntry.pr.request_number,
                                pending_pr_id: pendingEntry.pr.id,
                            };
                        } else {
                            chosenActivity = prInfo;
                        }
                    } else if (isPOFinished && (prDate > poDate || ['approved'].includes((latestPR.status || '').toLowerCase()))) {
                        // previous po is finished and there is a newer or approved pr waiting
                        chosenActivity = prInfo;
                    } else if (prDate > poDate && !isPOFinished && (existingPO.status || '').toLowerCase() === 'draft') {
                        // pr created after draft po
                        chosenActivity = prInfo;
                    } else {
                        // po is the active/latest activity
                        chosenActivity = {
                            ...existingPO,
                            has_pending_pr: hasPendingPR,
                            pending_pr_number: pendingEntry?.pr.request_number,
                            pending_pr_id: pendingEntry?.pr.id,
                        };
                    }
                }
            } else if (existingPO) {
                chosenActivity = {
                    ...existingPO,
                    has_pending_pr: false,
                };
            }

            if (chosenActivity) {
                latestActivityMap.set(key, chosenActivity);
            }
        }

        // 3. fetch active inventory_requests (approved & pending) to compute exporting_stock and available_stock
        let exportingMap = new Map<string, number>();
        let pendingCountMap = new Map<string, number>();
        try {
            const { data: reqData } = await supabase
                .from('inventory_requests')
                .select('*')
                .or('status.ilike.approved,status.ilike.pending');

            if (reqData && reqData.length > 0) {
                for (const req of reqData) {
                    const status = (req.status || '').toLowerCase();
                    const qty = Number(req.quantity_requested || req.quantity || 0);
                    const idKey = req.item_id ? String(req.item_id) : null;
                    const nameKey = (req.item_name || '').toLowerCase().trim();

                    if (status === 'approved') {
                        if (idKey) exportingMap.set(idKey, (exportingMap.get(idKey) || 0) + qty);
                        if (nameKey) exportingMap.set(nameKey, (exportingMap.get(nameKey) || 0) + qty);
                    } else if (status === 'pending') {
                        if (idKey) pendingCountMap.set(idKey, (pendingCountMap.get(idKey) || 0) + 1);
                        if (nameKey) pendingCountMap.set(nameKey, (pendingCountMap.get(nameKey) || 0) + 1);
                    }
                }
            }
        } catch (reqErr) {
            console.warn('Error fetching inventory_requests for stock metadata:', reqErr);
        }

        return items.map(item => {
            const idKey = String(item.id);
            const nameKey = (item.item_name || '').toLowerCase().trim();
            const exporting = exportingMap.get(idKey) ?? exportingMap.get(nameKey) ?? 0;
            const pendingCount = pendingCountMap.get(idKey) ?? pendingCountMap.get(nameKey) ?? 0;
            const currentStock = Number(item.current_stock || 0);
            const availableStock = Math.max(0, currentStock - exporting);

            return {
                ...item,
                exporting_stock: exporting,
                available_stock: availableStock,
                pending_requests_count: pendingCount,
                latest_po: latestActivityMap.get(idKey) || null,
            };
        });
    }
    catch (err) {
        console.warn('Error attaching latest PO to items:', err);
        return items;
    }
}
// In-memory cache for resolved user profiles (5 minutes TTL)
const userProfileCache = new Map<string, { data: { name: string; email: string; role: string }; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedUser(id: string) {
    const cached = userProfileCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    if (cached) {
        userProfileCache.delete(id);
    }
    return null;
}

function setCachedUser(id: string, data: { name: string; email: string; role: string }) {
    userProfileCache.set(id, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

/**
 * Highly optimized scanner user resolver with memory caching & parallel queries
 */
async function resolveScannerUsers(userIds: string[]): Promise<Map<string, { name: string; email: string; role: string }>> {
    const resultMap = new Map<string, { name: string; email: string; role: string }>();
    if (!userIds || userIds.length === 0) return resultMap;

    const cleanedIds = Array.from(new Set(userIds.map(id => String(id).trim()).filter(Boolean)));
    if (cleanedIds.length === 0) return resultMap;

    // 1. Check memory cache first (0ms latency for repeated lookups)
    const uncachedIds: string[] = [];
    cleanedIds.forEach(id => {
        const cached = getCachedUser(id);
        if (cached) {
            resultMap.set(id, cached);
        } else {
            uncachedIds.push(id);
        }
    });

    if (uncachedIds.length === 0) {
        return resultMap;
    }

    const extractName = (record: any): string => {
        if (!record) return '';
        if (typeof record.display_name === 'string' && record.display_name.trim()) return record.display_name.trim();
        if (typeof record.full_name === 'string' && record.full_name.trim()) return record.full_name.trim();
        if (typeof record.name === 'string' && record.name.trim()) return record.name.trim();
        if (typeof record.hr_employee_name === 'string' && record.hr_employee_name.trim()) return record.hr_employee_name.trim();
        if (record.first_name || record.last_name) {
            const combined = [record.first_name, record.last_name].filter(Boolean).join(' ').trim();
            if (combined) return combined;
        }
        if (record.raw_user_meta_data) {
            const meta = record.raw_user_meta_data;
            const metaName = meta.display_name || meta.full_name || meta.name;
            if (metaName && typeof metaName === 'string' && metaName.trim()) return metaName.trim();
        }
        if (record.user_metadata) {
            const meta = record.user_metadata;
            const metaName = meta.display_name || meta.full_name || meta.name;
            if (metaName && typeof metaName === 'string' && metaName.trim()) return metaName.trim();
        }
        if (typeof record.email === 'string' && record.email.includes('@')) {
            const prefix = record.email.split('@')[0];
            if (prefix) return prefix;
        }
        return '';
    };

    const extractRole = (record: any): string => {
        if (!record) return 'Operator';
        return record.role || record.position || record.department || record.user_metadata?.role || 'Operator';
    };

    try {
        // 2. Query users and mock_employees in PARALLEL in a single roundtrip
        const [usersResult, empResult] = await Promise.all([
            dbClient
                .from('users')
                .select('id, display_name, name, full_name, first_name, last_name, email, role, position, department')
                .in('id', uncachedIds),
            dbClient
                .from('mock_employees')
                .select('id, display_name, full_name, name, first_name, last_name, email, role, position')
                .in('id', uncachedIds),
        ]);

        if (usersResult.data && usersResult.data.length > 0) {
            usersResult.data.forEach((u: any) => {
                const name = extractName(u) || 'Unknown';
                const email = u.email || '';
                const role = extractRole(u);
                const info = { name, email, role };
                const uid = String(u.id).trim();
                resultMap.set(uid, info);
                setCachedUser(uid, info);
            });
        }

        if (empResult.data && empResult.data.length > 0) {
            empResult.data.forEach((e: any) => {
                const uid = String(e.id).trim();
                if (!resultMap.has(uid)) {
                    const name = extractName(e) || 'Unknown';
                    const email = e.email || '';
                    const role = extractRole(e);
                    const info = { name, email, role };
                    resultMap.set(uid, info);
                    setCachedUser(uid, info);
                }
            });
        }

        // 3. For any remaining IDs (rare), check sessions & auth in parallel
        const stillMissing = uncachedIds.filter(id => !resultMap.has(id));
        if (stillMissing.length > 0) {
            const [sessionResult] = await Promise.all([
                dbClient
                    .from('sessions')
                    .select('user_id, hr_employee_name, email')
                    .in('user_id', stillMissing),
            ]);

            if (sessionResult.data && sessionResult.data.length > 0) {
                sessionResult.data.forEach((s: any) => {
                    const sid = s.user_id ? String(s.user_id).trim() : '';
                    if (sid && !resultMap.has(sid)) {
                        const name = s.hr_employee_name || (s.email ? s.email.split('@')[0] : '') || 'Unknown';
                        const info = { name, email: s.email || '', role: 'Operator' };
                        resultMap.set(sid, info);
                        setCachedUser(sid, info);
                    }
                });
            }

            // Cache remaining unresolved IDs as 'Unknown' so they don't re-query on every request
            const unresolved = uncachedIds.filter(id => !resultMap.has(id));
            unresolved.forEach(id => {
                const fallbackInfo = { name: 'Unknown', email: '', role: 'Unknown' };
                resultMap.set(id, fallbackInfo);
                setCachedUser(id, fallbackInfo);
            });
        }
    } catch (e) {
        console.error('Error resolving scanner users:', e);
    }

    return resultMap;
}

/**
 * Attaches the display name/email of the user who performed a force update
 */
async function attachForceUpdateDetails(items: any[]) {
    if (!items || items.length === 0)
        return items;
    const userIds = items
        .map(i => i.force_updated_by)
        .filter((id): id is string => Boolean(id) && typeof id === 'string');
    if (userIds.length === 0)
        return items;
    try {
        const userMap = await resolveScannerUsers(userIds);
        return items.map(item => ({
            ...item,
            force_updated_by_name: item.force_updated_by ? (userMap.get(item.force_updated_by)?.name || 'Admin') : null,
        }));
    }
    catch (err) {
        console.warn('Error attaching force update details:', err);
        return items;
    }
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
        let query = dbClient
            .from('inventory_items')
            .select('*', { count: 'exact' });
        if (search) {
            const sanitizedSearch = sanitizeSearch(search);
            query = query.or(`item_name.ilike.%${sanitizedSearch}%,` +
                `item_code.ilike.%${sanitizedSearch}%`);
        }
        if (category !== 'all') {
            query = query.eq('category', category);
        }
        if (status !== 'all') {
            query = query.eq('status', status);
        }
        const { data, count: totalCount, error } = await query
            .order('item_name')
            .range(from, to);
        if (error)
            throw error;
        // enrich items with latest po / poi and pr tracking
        const itemsWithPo = await attachLatestPOToItems(data || []);
        const enrichedItems = await attachForceUpdateDetails(itemsWithPo);
        return {
            success: true,
            data: {
                items: enrichedItems,
                totalItems: totalCount || 0,
                page,
                limit,
                totalPages: Math.ceil((totalCount || 0) / limit),
            },
            status: 200,
        };
    }
    catch (error) {
        console.error('Error fetching inventory items:', error);
        return {
            success: false,
            error: 'Failed to fetch inventory items',
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
        if (error)
            throw error;
        return {
            success: true,
            data: data || [],
            status: 200,
        };
    }
    catch (error) {
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
        if (totalError)
            throw totalError;
        const { count: lowStock, error: lowError } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'low-stock');
        if (lowError)
            throw lowError;
        const { count: outOfStock, error: outError } = await supabase
            .from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'out-of-stock');
        if (outError)
            throw outError;
        const { data: categoryData, error: categoryError } = await supabase
            .from('inventory_items')
            .select('category', { count: 'exact' });
        if (categoryError)
            throw categoryError;
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
        if (lowItemsError)
            throw lowItemsError;
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
    }
    catch (error) {
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
        const [inventoryResult, suppliersResult, statsResult] = await Promise.all([
            fetchInventoryItems({
                page: params.inventoryPage || 1,
                limit: params.inventoryLimit || 15,
                search: params.inventorySearch || '',
                category: params.inventoryCategory || 'all',
                status: params.inventoryStatus || 'all',
            }),
            fetchSuppliers(),
            fetchDashboardStats(),
        ]);
        return {
            success: true,
            data: {
                inventory: inventoryResult.success ? inventoryResult.data : null,
                suppliers: suppliersResult.success ? suppliersResult.data : [],
                stats: statsResult.success ? statsResult.data : null,
            },
            status: 200,
        };
    }
    catch (error) {
        console.error('Error fetching inventory page data:', error);
        return {
            success: false,
            error: 'Failed to fetch inventory page data',
            status: 500,
        };
    }
}

// ==========================================
// INVENTORY REQUESTS SERVER ACTIONS
// ==========================================
// Standardized Inventory & Purchase Requests
// ==========================================

export async function fetchInventoryRequests(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    department?: string;
    priority?: string;
    type?: 'all' | 'internal' | 'external';
}) {
    try {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const offset = (page - 1) * limit;

        const client = dbClient || supabase;

        // 1. Fetch live inventory items for matching
        const { data: allItems } = await client
            .from('inventory_items')
            .select('id, item_code, item_name, category, current_stock, minimum_stock, unit, status');

        const itemMapById = new Map<string, any>();
        const itemMapByName = new Map<string, any>();
        for (const it of allItems || []) {
            const idKey = String(it.id);
            const nameKey = (it.item_name || '').toLowerCase().trim();
            itemMapById.set(idKey, it);
            itemMapByName.set(nameKey, it);
        }

        // 2. Query public.purchase_requests
        let query = client
            .from('purchase_requests')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (params.status && params.status !== 'all') {
            const st = params.status.toLowerCase();
            if (st === 'received' || st === 'delivered' || st === 'completed' || st === 'fulfilled') {
                query = query.or('status.ilike.delivered,status.ilike.received,status.ilike.fulfilled,status.ilike.completed,status.eq.Delivered,status.eq.Received');
            } else if (st === 'approved') {
                query = query.or('status.ilike.approved,status.eq.Approved');
            } else if (st === 'pending') {
                query = query.or('status.ilike.pending,status.eq.Pending');
            } else if (st === 'rejected') {
                query = query.or('status.ilike.rejected,status.eq.Rejected');
            } else {
                const capStatus = params.status.charAt(0).toUpperCase() + params.status.slice(1).toLowerCase();
                query = query.or(`status.ilike.${params.status},status.eq.${capStatus}`);
            }
        }

        if (params.department && params.department !== 'all') {
            query = query.ilike('department', params.department);
        }

        if (params.priority && params.priority !== 'all') {
            query = query.ilike('priority', params.priority);
        }

        if (params.search && params.search.trim()) {
            const s = sanitizeSearch(params.search.trim());
            query = query.or(`request_number.ilike.%${s}%,requested_by.ilike.%${s}%,department.ilike.%${s}%,description.ilike.%${s}%,purpose.ilike.%${s}%`);
        }

        query = query.range(offset, offset + limit - 1);

        let { data: prRequests, count, error } = await query;

        // Fallback to inventory_requests if purchase_requests table query fails
        if (error) {
            console.warn('Fallback to inventory_requests due to purchase_requests error:', error.message);
            let fbQuery = client
                .from('inventory_requests')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (params.status && params.status !== 'all') {
                fbQuery = fbQuery.ilike('status', params.status);
            }
            const fallbackRes = await fbQuery;
            if (!fallbackRes.error && fallbackRes.data) {
                prRequests = fallbackRes.data.map((r: any) => ({
                    id: r.id,
                    request_number: r.request_number || `#REQ-${String(r.id).slice(0, 8).toUpperCase()}`,
                    request_type: 'Regular',
                    type: 'Internal Requisition',
                    description: r.message || r.purpose || 'Internal inventory requisition',
                    purpose: r.purpose || r.message || 'Internal usage',
                    requested_by: r.requested_by || 'Inventory User',
                    department: r.department || 'Warehouse',
                    items: [{
                        name: r.item_name,
                        quantity: Number(r.quantity_requested || 1),
                        unit: 'units',
                        specs: r.remarks || ''
                    }],
                    priority: 'Normal',
                    status: (r.status || 'Pending').charAt(0).toUpperCase() + (r.status || 'Pending').slice(1).toLowerCase(),
                    created_at: r.created_at,
                    updated_at: r.updated_at,
                    rejection_reason: r.rejection_reason || null,
                }));
                count = fallbackRes.count;
                error = null;
            }
        }

        if (error) {
            console.error('Error fetching purchase_requests:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch inventory requests',
                status: 500,
            };
        }

        // 3. Enrich each request with matching inventory catalog items
        const enrichedRequests = (prRequests || []).map((req: any) => {
            const rawItems = Array.isArray(req.items) ? req.items : [];
            const parsedItems = rawItems.map((itemEntry: any) => {
                const itemName = itemEntry.name || itemEntry.item_name || 'Unspecified Item';
                const idKey = itemEntry.id ? String(itemEntry.id) : (itemEntry.inventory_items_id ? String(itemEntry.inventory_items_id) : undefined);
                const qty = Number(itemEntry.quantity || 1);

                const matchEval = evaluateItemMatch(
                    itemName,
                    qty,
                    (allItems || []) as any,
                    idKey || itemEntry.item_code
                );

                const matchedItem = matchEval.matchedItem;
                const currentStock = matchEval.currentStock;
                const minStock = matchEval.minimumStock;
                const isFeasible = matchEval.isStockSufficient;
                const itemCategory = itemEntry.category || itemEntry.category_name || (req as any).category || matchedItem?.category || '';

                const rawApproved = itemEntry.approved_quantity ?? itemEntry.exported_quantity;
                let itemApprovedQty: number | null = rawApproved !== undefined && rawApproved !== null ? Number(rawApproved) : null;

                // Fallback: parse from admin_notes if not explicitly defined on item and status is approved
                if (itemApprovedQty === null && (req.status || '').toLowerCase() === 'approved' && req.admin_notes) {
                    const notesStr = String(req.admin_notes);
                    const escaped = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escaped}[^\\(]*\\(-(\\d+)`, 'i');
                    const m = notesStr.match(regex) || notesStr.match(/\(-(\d+)/);
                    if (m && m[1]) {
                        itemApprovedQty = Number(m[1]);
                    } else if (notesStr.toLowerCase().includes('0 on hand')) {
                        itemApprovedQty = 0;
                    }
                }

                if (itemApprovedQty === null) {
                    itemApprovedQty = (req.status || '').toLowerCase() === 'approved' ? qty : 0;
                }

                const reqStatusLower = (req.status || '').toLowerCase();
                const isReqDelivered = reqStatusLower === 'delivered' || reqStatusLower === 'completed' || reqStatusLower === 'fulfilled' || reqStatusLower === 'received' || Boolean(req.completed_at);
                const isItemReleased = itemEntry.is_released === true || itemEntry.is_issued === true || (itemEntry.status || '').toLowerCase() === 'delivered' || (itemEntry.status || '').toLowerCase() === 'released' || isReqDelivered;

                const itemRemaining = isItemReleased ? 0 : Math.max(0, qty - (itemApprovedQty || 0));
                const normalizedItemStatus = isItemReleased ? 'Released' : itemEntry.status || (itemEntry.is_approved === true || itemEntry.is_approve === true ? 'Approved' : (req.status || '').toLowerCase() === 'approved' ? 'Approved' : 'Pending');
                const isItemApproved = isItemReleased || normalizedItemStatus === 'Approved' || Boolean(itemEntry.is_approved || itemEntry.is_approve);

                return {
                    ...itemEntry,
                    id: itemEntry.id || itemEntry.item_id || idKey,
                    item_id: itemEntry.item_id || itemEntry.id || idKey,
                    name: itemName,
                    item_name: itemName,
                    category: itemCategory,
                    quantity: qty,
                    status: normalizedItemStatus,
                    is_approved: isItemApproved,
                    is_approve: isItemApproved,
                    is_released: isItemReleased,
                    is_issued: isItemReleased,
                    released_by: itemEntry.released_by || null,
                    released_at: itemEntry.released_at || req.completed_at || null,
                    approved_quantity: itemApprovedQty,
                    exported_quantity: itemApprovedQty,
                    remaining_quantity: itemRemaining,
                    available_quantity: itemEntry.available_quantity !== undefined ? Number(itemEntry.available_quantity) : itemApprovedQty,
                    deficit_quantity: itemEntry.deficit_quantity !== undefined ? Number(itemEntry.deficit_quantity) : itemRemaining,
                    unit: itemEntry.unit || matchedItem?.unit || 'pcs',
                    specs: itemEntry.specs || itemEntry.specifications || itemEntry.remarks || '',
                    matched_item: matchedItem,
                    match_type: matchEval.matchType,
                    match_candidates: matchEval.candidates,
                    current_stock: currentStock,
                    minimum_stock: minStock,
                    is_in_stock: currentStock > 0,
                    is_feasible: isFeasible,
                };
            });

            const primaryItemName = parsedItems.length > 0 
                ? (parsedItems.length === 1 ? parsedItems[0].name : `${parsedItems[0].name} (+${parsedItems.length - 1} more)`)
                : (req.description || 'Inventory Item Request');

            const totalQty = parsedItems.reduce((acc: number, cur: any) => acc + cur.quantity, 0) || 1;
            const totalApprovedQty = parsedItems.reduce((acc: number, cur: any) => acc + Number(cur.approved_quantity ?? 0), 0);
            const totalRemainingQty = Math.max(0, totalQty - totalApprovedQty);
            const totalIssuedQty = parsedItems.reduce((acc: number, cur: any) => {
                const isItemReleased = cur.is_released === true || cur.is_issued === true || (cur.status || '').toLowerCase() === 'released';
                const issued = cur.issued_quantity !== undefined ? Number(cur.issued_quantity) : isItemReleased ? Number(cur.approved_quantity ?? cur.quantity) : 0;
                return acc + issued;
            }, 0);
            const totalDeficitQty = parsedItems.reduce((acc: number, cur: any) => {
                const reqQ = Number(cur.quantity || 0);
                const isItemReleased = cur.is_released === true || cur.is_issued === true || (cur.status || '').toLowerCase() === 'released';
                const issued = cur.issued_quantity !== undefined ? Number(cur.issued_quantity) : isItemReleased ? Number(cur.approved_quantity ?? cur.quantity) : 0;
                const deficit = cur.deficit_quantity !== undefined ? Number(cur.deficit_quantity) : Math.max(0, reqQ - issued);
                return acc + deficit;
            }, 0);

            const reqStatusLower = (req.status || '').toLowerCase();
            const anyItemReleased = parsedItems.length > 0 && parsedItems.some((pi: any) => pi.is_released === true || pi.is_issued === true || (pi.status || '').toLowerCase() === 'released' || (pi.status || '').toLowerCase() === 'delivered');
            const isReqDelivered = reqStatusLower === 'delivered' || reqStatusLower === 'completed' || reqStatusLower === 'fulfilled' || reqStatusLower === 'received' || Boolean(req.completed_at) || anyItemReleased;
            const isPartialHandover = isReqDelivered && (totalDeficitQty > 0 || (totalIssuedQty > 0 && totalIssuedQty < totalQty));
            const isApprovedStatus = reqStatusLower === 'approved' || reqStatusLower.includes('approved');
            const isPartial = isApprovedStatus && totalApprovedQty < totalQty && totalApprovedQty > 0;
            const isZeroExported = isApprovedStatus && totalApprovedQty === 0;

            const primaryMatchedItem = parsedItems[0]?.matched_item || null;
            const allItemsFeasible = parsedItems.length > 0 && parsedItems.every((pi: any) => pi.is_feasible);
            const primaryReleasingOfficer = parsedItems.find((pi: any) => pi.released_by)?.released_by || null;
            const primaryReleaseDate = parsedItems.find((pi: any) => pi.released_at)?.released_at || req.completed_at || null;

            const statusNormalized = isReqDelivered
                ? 'Completed'
                : isApprovedStatus
                ? 'Approved'
                : (req.status || 'Pending');

            let formattedAdminNotes = req.admin_notes;
            if (isReqDelivered && formattedAdminNotes) {
                if (isPartialHandover) {
                    formattedAdminNotes = formattedAdminNotes
                        .replace(
                            /Available in warehouse \(Ready to issue\):/gi,
                            `Supplies Partially Issued (${totalIssuedQty}/${totalQty} given, Deficit: ${totalDeficitQty}):`
                        )
                        .replace(
                            /Supplies Issued to Department \(Warehouse Handover Fulfilled\):/gi,
                            `Supplies Partially Issued (${totalIssuedQty}/${totalQty} given, Deficit: ${totalDeficitQty}):`
                        );
                } else {
                    formattedAdminNotes = formattedAdminNotes.replace(
                        /Available in warehouse \(Ready to issue\):/gi,
                        'Supplies Issued to Department (Warehouse Handover Fulfilled):'
                    );
                }
            }

            return {
                ...req,
                status: statusNormalized,
                raw_status: req.status,
                admin_notes: formattedAdminNotes,
                items: parsedItems,
                item_name: primaryItemName,
                quantity_requested: totalQty,
                quantity_approved: totalApprovedQty,
                quantity_exported: totalApprovedQty,
                quantity_remaining: totalRemainingQty,
                issued_quantity: totalIssuedQty,
                deficit_quantity: totalDeficitQty,
                is_partial_handover: isPartialHandover,
                is_partially_approved: isPartial,
                is_zero_exported: isZeroExported,
                is_released: isReqDelivered,
                is_issued: isReqDelivered,
                fulfilled_at: primaryReleaseDate,
                fulfilled_by: primaryReleasingOfficer,
                completed_at: primaryReleaseDate,
                unit: parsedItems[0]?.unit || 'units',
                inventory_item: primaryMatchedItem,
                matched_inventory_items: parsedItems.map((pi: any) => pi.matched_item).filter(Boolean),
                current_stock: primaryMatchedItem?.current_stock ?? 0,
                available_stock: primaryMatchedItem?.current_stock ?? 0,
                is_stock_feasible: allItemsFeasible,
                requester_name: req.requested_by || 'Department Requester',
                department: req.department || 'Warehouse',
                priority: req.priority || 'Normal',
            };
        });

        // 3b. Sort by Priority (Critical -> Urgent -> Normal) and Created At (newest first)
        const getPriorityRank = (p?: string) => {
            const low = (p || '').toLowerCase().trim();
            if (low === 'critical') return 1;
            if (low === 'urgent' || low === 'high') return 2;
            return 3;
        };

        enrichedRequests.sort((a: any, b: any) => {
            const rankA = getPriorityRank(a.priority);
            const rankB = getPriorityRank(b.priority);
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });

        // 4. Compute status counts from purchase_requests
        const { data: countData } = await client
            .from('purchase_requests')
            .select('status');

        let pendingCount = 0;
        let approvedCount = 0;
        let receivedCount = 0;
        let rejectedCount = 0;

        for (const r of countData || []) {
            const st = (r.status || '').toLowerCase();
            if (st === 'pending') pendingCount++;
            else if (st === 'approved') approvedCount++;
            else if (st === 'completed' || st === 'received' || st === 'fulfilled' || st === 'delivered') receivedCount++;
            else if (st === 'rejected') rejectedCount++;
        }

        return {
            success: true,
            data: {
                requests: enrichedRequests,
                totalItems: count || (prRequests?.length || 0),
                totalPages: Math.ceil((count || (prRequests?.length || 0)) / limit) || 1,
                page,
                stats: {
                    total: countData?.length || (prRequests?.length || 0),
                    pending: pendingCount,
                    approved: approvedCount,
                    received: receivedCount,
                    rejected: rejectedCount,
                }
            },
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in fetchInventoryRequests:', error);
        return {
            success: false,
            error: error?.message || 'Failed to fetch requests',
            status: 500,
        };
    }
}

export async function createPurchaseRequest(formData: {
    request_type?: 'Regular' | 'Advance';
    type?: string;
    description: string;
    purpose: string;
    requested_by: string;
    requester_position?: string;
    requester_contact?: string;
    department: string;
    requested_for?: string;
    items: Array<{
        name: string;
        category?: string;
        quantity: number;
        unit?: string;
        specs?: string;
    }>;
    priority?: 'Normal' | 'Urgent' | 'Critical';
    needed_by_date?: string;
    urgency_reason?: string;
    advance_reason?: string;
    requester_notes?: string;
}) {
    try {
        if (!formData.requested_by?.trim()) {
            return { success: false, error: 'Requester name is required', status: 400 };
        }
        if (!formData.department?.trim()) {
            return { success: false, error: 'Department is required', status: 400 };
        }
        if (!formData.items || formData.items.length === 0) {
            return { success: false, error: 'At least one item is required in the request', status: 400 };
        }

        const validItems = formData.items.filter(i => i.name?.trim() && Number(i.quantity) > 0);
        if (validItems.length === 0) {
            return { success: false, error: 'Please enter valid item names and quantities (> 0)', status: 400 };
        }

        const client = dbClient || supabase;

        // Generate request number if needed
        const reqNum = `PR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        const payload: any = {
            request_number: reqNum,
            request_type: formData.request_type || 'Regular',
            type: formData.type || 'Inventory Addition',
            description: formData.description || formData.purpose || 'Department inventory requisition',
            purpose: formData.purpose || formData.description || 'Department operational requirement',
            requested_by: formData.requested_by.trim(),
            requester_position: formData.requester_position?.trim() || null,
            requester_contact: formData.requester_contact?.trim() || null,
            department: formData.department.trim(),
            requested_for: formData.requested_for?.trim() || null,
            items: validItems.map((item, idx) => {
                const itemId = (item as any).id || (item as any).item_id || crypto.randomUUID();
                return {
                    id: itemId,
                    item_id: itemId,
                    name: item.name.trim(),
                    category: item.category?.trim() || '',
                    quantity: Number(item.quantity || 1),
                    unit: item.unit?.trim() || 'pcs',
                    specs: item.specs?.trim() || '',
                    status: (item as any).status || 'Pending'
                };
            }),
            priority: formData.priority || 'Normal',
            needed_by_date: formData.needed_by_date || null,
            urgency_reason: formData.priority !== 'Normal' ? (formData.urgency_reason?.trim() || 'Urgent requirement for operations') : null,
            advance_reason: formData.request_type === 'Advance' ? (formData.advance_reason?.trim() || 'Advance procurement needed') : null,
            requester_notes: formData.requester_notes?.trim() || null,
            status: 'Pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await client
            .from('purchase_requests')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating purchase_request:', error);
            return {
                success: false,
                error: error.message || 'Failed to submit inventory request',
                status: 500,
            };
        }

        return {
            success: true,
            data,
            message: `Request #${data.request_number || reqNum} submitted successfully!`,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in createPurchaseRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to submit request',
            status: 500,
        };
    }
}

export async function createInternalInventoryRequest(formData: {
    item_id?: string;
    item_name: string;
    item_code?: string;
    quantity_requested: number;
    unit?: string;
    department: string;
    requested_by?: string;
    requester_position?: string;
    requester_contact?: string;
    purpose?: string;
    remarks?: string;
    message?: string;
    priority?: 'Normal' | 'Urgent' | 'Critical';
    needed_by_date?: string;
}) {
    return createPurchaseRequest({
        request_type: 'Regular',
        type: 'Inventory Requisition',
        description: formData.purpose || formData.message || `Requisition for ${formData.item_name}`,
        purpose: formData.purpose || formData.message || 'Internal operational requirement',
        requested_by: formData.requested_by || 'Internal Staff',
        requester_position: formData.requester_position,
        requester_contact: formData.requester_contact,
        department: formData.department || 'Warehouse',
        items: [{
            name: formData.item_name,
            quantity: formData.quantity_requested || 1,
            unit: formData.unit || 'pcs',
            specs: formData.remarks || ''
        }],
        priority: formData.priority || 'Normal',
        needed_by_date: formData.needed_by_date,
        requester_notes: formData.remarks,
    });
}

export async function approveInventoryRequest(
    requestId: string, 
    approvedBy?: string, 
    adminNotes?: string,
    performerName?: string,
    options?: {
        itemIndex?: number;
        action?: 'approve' | 'reject';
        approvedQuantity?: number;
        rejectionReason?: string;
    }
) {
    try {
        const client = dbClient || supabase;

        const isValidUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str || '');
        const effectivePerformer = performerName || (approvedBy && !isValidUUID(approvedBy) ? approvedBy : 'Executive');

        // 1. Fetch the request record first to inspect the items requested
        let requestRecord: any = null;
        const prRes = await client
            .from('purchase_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (prRes.data) {
            requestRecord = prRes.data;
        } else {
            const irRes = await client
                .from('inventory_requests')
                .select('*')
                .eq('id', requestId)
                .maybeSingle();
            if (irRes.data) {
                requestRecord = irRes.data;
            }
        }

        // 2. Parse items to evaluate
        let rawItems: any[] = [];
        if (requestRecord) {
            if (Array.isArray(requestRecord.items) && requestRecord.items.length > 0) {
                rawItems = requestRecord.items;
            } else if (typeof requestRecord.items === 'string') {
                try {
                    const parsed = JSON.parse(requestRecord.items);
                    if (Array.isArray(parsed)) rawItems = parsed;
                } catch (e) {}
            }

            if (rawItems.length === 0 && (requestRecord.item_name || requestRecord.name)) {
                rawItems = [{
                    name: requestRecord.item_name || requestRecord.name,
                    quantity: Number(requestRecord.quantity_requested || requestRecord.quantity || 1),
                    unit: requestRecord.unit || 'units'
                }];
            }
        }

        // 3. Fetch live inventory catalog items
        const { data: invCatalog } = await client
            .from('inventory_items')
            .select('*');

        const routedToWarehouseLog: string[] = [];
        const routedToProcurementLog: string[] = [];

        // Helper to evaluate and configure a single item's stock & routing
        const evaluateSingleItem = (reqItem: any) => {
            const reqName = String(reqItem.name || reqItem.item_name || '').trim();
            const totalReqQty = Number(reqItem.quantity || reqItem.quantity_requested || 1);
            if (!reqName) return;

            const matchEval = invCatalog && invCatalog.length > 0 
                ? evaluateItemMatch(reqName, totalReqQty, invCatalog as any)
                : { matchedItem: null };
            const targetItem = matchEval.matchedItem;

            if (targetItem) {
                const stockOnHand = Number(targetItem.current_stock ?? (targetItem as any).quantity ?? 0);
                const customApproved = options?.approvedQuantity !== undefined ? Number(options.approvedQuantity) : null;
                const availableQty = customApproved !== null ? Math.min(stockOnHand, customApproved) : Math.min(stockOnHand, totalReqQty);
                const deficitQty = Math.max(0, totalReqQty - availableQty);

                reqItem.available_quantity = availableQty;
                reqItem.quantity_requested = totalReqQty;
                reqItem.deficit_quantity = deficitQty;
                reqItem.is_new_item = false;
                reqItem.stock_on_hand = stockOnHand;
                reqItem.catalog_item_id = targetItem.id;
                reqItem.catalog_item_code = targetItem.item_code;
                reqItem.storage_location = targetItem.storage_location || 'Central Warehouse';
                reqItem.unit = reqItem.unit || targetItem.unit || 'units';
                reqItem.approved_quantity = availableQty;
                reqItem.remaining_quantity = deficitQty;
                reqItem.status = 'Approved';
                reqItem.is_approved = true;
                reqItem.is_approve = true;
                reqItem.approved_at = new Date().toISOString();

                if (availableQty > 0) {
                    routedToWarehouseLog.push(`${targetItem.item_name} (${availableQty}/${totalReqQty} available for warehouse issuance)`);
                }
                if (deficitQty > 0) {
                    routedToProcurementLog.push(`${targetItem.item_name} (${deficitQty} lacking units queued for procurement)`);
                }
            } else {
                // Brand new item not currently in catalog
                const deficitQty = totalReqQty;

                reqItem.available_quantity = 0;
                reqItem.quantity_requested = totalReqQty;
                reqItem.deficit_quantity = deficitQty;
                reqItem.is_new_item = true;
                reqItem.stock_on_hand = 0;
                reqItem.approved_quantity = 0;
                reqItem.remaining_quantity = totalReqQty;
                reqItem.status = 'Approved';
                reqItem.is_approved = true;
                reqItem.is_approve = true;
                reqItem.approved_at = new Date().toISOString();

                routedToProcurementLog.push(`${reqName} (New Item: ${totalReqQty} units queued for procurement)`);
            }
        };

        // 4. Process Item-by-Item or Bulk Approval
        if (options && options.itemIndex !== undefined && rawItems[options.itemIndex]) {
            const targetItem = rawItems[options.itemIndex];
            if (options.action === 'reject') {
                targetItem.status = 'Rejected';
                targetItem.is_approved = false;
                targetItem.is_approve = false;
                targetItem.rejected_at = new Date().toISOString();
                targetItem.approved_quantity = 0;
                targetItem.available_quantity = 0;
                targetItem.deficit_quantity = 0;
                targetItem.rejection_reason = options.rejectionReason || 'Item rejected by reviewer';
            } else {
                evaluateSingleItem(targetItem);
            }
        } else if (rawItems.length > 0) {
            // Bulk approve all items that are not explicitly rejected
            for (const reqItem of rawItems) {
                if (reqItem.status !== 'Rejected') {
                    evaluateSingleItem(reqItem);
                }
            }
        }

        // Determine overall request status from item statuses
        const hasPending = rawItems.some((it) => !it.status || it.status === 'Pending');
        const allApproved = rawItems.length > 0 && rawItems.every((it) => it.status === 'Approved');
        const allRejected = rawItems.length > 0 && rawItems.every((it) => it.status === 'Rejected');
        const hasApproved = rawItems.some((it) => it.status === 'Approved');
        
        // If there are still items pending review, the overall request must remain 'Pending'
        const overallStatus = hasPending ? 'Pending' : allApproved ? 'Approved' : allRejected ? 'Rejected' : hasApproved ? 'Approved' : 'Pending';

        const totalReq = rawItems.reduce((acc, it) => acc + Number(it.quantity || it.quantity_requested || 1), 0);
        const totalAvail = rawItems.reduce((acc, it) => acc + Number(it.available_quantity ?? 0), 0);
        const totalDeficit = Math.max(0, totalReq - totalAvail);

        // 5. Update request record status
        const updatePayload: any = {
            items: rawItems,
            status: overallStatus,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (approvedBy && isValidUUID(approvedBy)) {
            updatePayload.reviewed_by = approvedBy;
        }

        const noteParts: string[] = [];
        if (adminNotes && adminNotes.trim()) noteParts.push(adminNotes.trim());
        if (routedToWarehouseLog.length > 0) {
            noteParts.push(`Available in warehouse (Ready to issue): ${routedToWarehouseLog.join('; ')}`);
        }
        if (routedToProcurementLog.length > 0) {
            noteParts.push(`Routed to Procurement Stage 1: ${routedToProcurementLog.join('; ')}`);
        }
        if (noteParts.length > 0) {
            updatePayload.admin_notes = noteParts.join(' | ');
        }

        let updateRes = await client
            .from('purchase_requests')
            .update(updatePayload)
            .eq('id', requestId)
            .select()
            .maybeSingle();

        // If foreign key constraint fails on reviewed_by (error code 23503), retry without reviewed_by
        if (updateRes.error && updateRes.error.code === '23503' && updatePayload.reviewed_by) {
            delete updatePayload.reviewed_by;
            updateRes = await client
                .from('purchase_requests')
                .update(updatePayload)
                .eq('id', requestId)
                .select()
                .maybeSingle();
        }

        let updatedRecord = updateRes.data;

        // Also ensure inventory_requests is synchronized if it exists
        const irUpdateRes = await client
            .from('inventory_requests')
            .update({ 
                status: overallStatus, 
                admin_notes: updatePayload.admin_notes || undefined,
                updated_at: new Date().toISOString() 
            })
            .eq('id', requestId)
            .select()
            .maybeSingle();

        if (!updatedRecord && irUpdateRes.data) {
            updatedRecord = irUpdateRes.data;
        }

        if (updateRes.error && !updatedRecord) {
            console.error('Failed to update purchase_requests:', updateRes.error);
            return { 
                success: false, 
                error: updateRes.error.message || 'Failed to approve request in database', 
                status: 500 
            };
        }

        const data = updatedRecord || requestRecord;

        const refNum = data?.request_number || requestRecord?.request_number || requestId.slice(0, 8);
        let successMessage = `Request #${refNum} updated! `;
        if (options?.itemIndex !== undefined) {
            const targetItem = rawItems[options.itemIndex];
            successMessage = `Item "${targetItem?.name || 'Item'}" ${options.action === 'reject' ? 'rejected' : 'approved'} successfully.`;
        } else if (totalAvail > 0 && totalDeficit > 0) {
            successMessage += `${totalAvail}/${totalReq} available routed to Warehousing (/warehousing?tab=issue) for issuing without deduction. ${totalDeficit} lacking unit(s) routed to Procurement (/procurement?stage=1).`;
        } else if (totalAvail > 0 && totalDeficit === 0) {
            successMessage += `All ${totalReq} units available and routed to Warehousing (/warehousing?tab=issue) for issuing. Stock will be deducted upon physical dispatch.`;
        } else {
            successMessage += `Items not currently available in warehouse; full request of ${totalReq} unit(s) routed to Procurement (/procurement?stage=1).`;
        }

        return {
            success: true,
            data,
            message: successMessage,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in approveInventoryRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to approve request',
            status: 500,
        };
    }
}

export async function rejectInventoryRequest(requestId: string, reason: string, rejectedBy?: string, adminNotes?: string) {
    try {
        if (!reason || !reason.trim()) {
            return { success: false, error: 'Rejection reason is required', status: 400 };
        }

        const client = dbClient || supabase;
        const updatePayload: any = {
            status: 'Rejected',
            rejection_reason: reason.trim(),
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const isValidUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str || '');
        if (rejectedBy && isValidUUID(rejectedBy)) {
            updatePayload.reviewed_by = rejectedBy;
        }
        if (adminNotes) {
            updatePayload.admin_notes = adminNotes.trim();
        }

        let updateRes = await client
            .from('purchase_requests')
            .update(updatePayload)
            .eq('id', requestId)
            .select()
            .maybeSingle();

        if (updateRes.error && updateRes.error.code === '23503' && updatePayload.reviewed_by) {
            delete updatePayload.reviewed_by;
            updateRes = await client
                .from('purchase_requests')
                .update(updatePayload)
                .eq('id', requestId)
                .select()
                .maybeSingle();
        }

        let updatedRecord = updateRes.data;

        if (updateRes.error || !updatedRecord) {
            // Try updating inventory_requests fallback
            const irRes = await client
                .from('inventory_requests')
                .update({ status: 'Rejected', rejection_reason: reason.trim(), updated_at: new Date().toISOString() })
                .eq('id', requestId)
                .select()
                .maybeSingle();
            if (irRes.data) {
                updatedRecord = irRes.data;
            }
        }

        const data = updatedRecord;

        return {
            success: true,
            data,
            message: `Request #${data?.request_number || requestId.slice(0, 8)} rejected.`,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in rejectInventoryRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to reject request',
            status: 500,
        };
    }
}

export async function fulfillInventoryRequest(requestId: string, releasedBy: string = 'Staff', quantityToRelease?: number) {
    try {
        const client = dbClient || supabase;
        let request: any = null;

        // Try purchase_requests first
        const { data: prData } = await client
            .from('purchase_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (prData) {
            request = prData;
            await client
                .from('purchase_requests')
                .update({
                    status: 'Completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requestId);
        } else {
            // Try inventory_requests
            const { data: irData, error: irErr } = await client
                .from('inventory_requests')
                .select('*')
                .eq('id', requestId)
                .maybeSingle();

            if (irErr || !irData) {
                return {
                    success: false,
                    error: 'Request not found',
                    status: 404,
                };
            }
            request = irData;
            await client
                .from('inventory_requests')
                .update({
                    status: 'received',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requestId);
        }

        // Deduct inventory stock & record audit trail
        const qtyToDeduct = Number(quantityToRelease || request.quantity_requested || 1);
        let matchedItem: any = null;

        // Try to find inventory item by ID, item_code, or item_name
        if (request.inventory_items_id || request.item_id) {
            const targetId = request.inventory_items_id || request.item_id;
            const { data: itemById } = await client
                .from('inventory_items')
                .select('*')
                .eq('id', targetId)
                .maybeSingle();
            matchedItem = itemById;
        }

        if (!matchedItem && request.item_name) {
            const { data: itemByName } = await client
                .from('inventory_items')
                .select('*')
                .ilike('item_name', request.item_name.trim())
                .maybeSingle();
            matchedItem = itemByName;
        }

        if (matchedItem) {
            const prevStock = Number(matchedItem.current_stock || 0);
            const newStock = Math.max(0, prevStock - qtyToDeduct);

            // Update inventory_items
            await client
                .from('inventory_items')
                .update({
                    current_stock: newStock,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', matchedItem.id);

            // Log Stock Out Movement
            await logStockMovement({
                item_id: matchedItem.id,
                item_code: matchedItem.item_code || 'N/A',
                item_name: matchedItem.item_name,
                movement_type: 'Stock Out',
                quantity: -qtyToDeduct,
                previous_stock: prevStock,
                new_stock: newStock,
                reference_number: request.request_number || `IR-${requestId.slice(0, 8)}`,
                reason: request.purpose || request.message || `Requisition released to ${request.department || 'Department'}`,
                department: request.department || 'Internal Department',
                performed_by: releasedBy,
            });
        }

        return {
            success: true,
            data: request,
            message: `Request #${request.request_number || requestId.slice(0, 8)} released and deducted from inventory!`,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in fulfillInventoryRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to fulfill request',
            status: 500,
        };
    }
}

/**
 * Add an OpenStreetMap discovered business as a Potential Supplier in the Supabase suppliers table.
 * Strictly leaves the original Purchase Request in 'Pending' status.
 */
export async function addPotentialSupplier(params: {
    supplier: {
        name: string;
        category?: string;
        contact_person?: string;
        phone?: string;
        email?: string;
        location?: string;
        products?: string;
        website?: string;
        osm_id?: string;
        osm_type?: string;
        tags?: Record<string, string>;
    };
    requestId?: string;
    itemName?: string;
    itemId?: string;
}) {
    try {
        const client = dbClient || supabase;
        const { supplier } = params;

        if (!supplier || !supplier.name) {
            return {
                success: false,
                error: 'Supplier name is required.',
                status: 400,
            };
        }

        const trimmedName = supplier.name.trim();
        const osmId = supplier.osm_id ? String(supplier.osm_id) : '';
        const trimmedItemName = params.itemName ? params.itemName.trim() : '';
        const trimmedItemId = params.itemId ? params.itemId.trim() : '';

        // 1. Check for duplicates in existing suppliers table
        const { data: existingByName } = await client
            .from('suppliers')
            .select('*')
            .ilike('name', trimmedName)
            .limit(1);

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const extractValidUUID = (val?: string | null): string | null => {
            if (!val || typeof val !== 'string') return null;
            const clean = val.trim();
            if (UUID_REGEX.test(clean)) return clean;
            const match = clean.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
            return match ? match[0] : null;
        };

        const validPurchaseRequestId = extractValidUUID(params.requestId);
        const itemTag = trimmedItemName ? `Item: ${trimmedItemName}` : '';
        const itemIdTag = trimmedItemId ? `Item ID: ${trimmedItemId}` : '';
        const reqTagParts = [
            params.requestId ? `Request ID: ${params.requestId}` : '',
            itemIdTag,
            itemTag
        ].filter(Boolean);
        const requestIdTag = reqTagParts.length > 0 ? `[${reqTagParts.join(' | ')}]` : '';

        if (existingByName && existingByName.length > 0) {
            const existing = existingByName[0];
            const existingNotes = (existing.notes || '').toLowerCase();
            const targetReq = (params.requestId || '').toLowerCase().trim();
            const targetItem = trimmedItemName.toLowerCase();
            const targetItemId = trimmedItemId.toLowerCase();

            // Check if already added for THIS SPECIFIC ITEM under this request
            const isAlreadyInThisRequest = (
                (targetItemId && existingNotes.includes(targetItemId)) ||
                (targetReq && targetItem && existingNotes.includes(targetReq) && existingNotes.includes(targetItem)) ||
                (targetReq && !targetItem && !targetItemId && (existingNotes.includes(`request id: ${targetReq}`) || existingNotes.includes(targetReq)))
            );

            // Block ONLY if already added to this exact item in this request
            if (isAlreadyInThisRequest) {
                return {
                    success: false,
                    alreadyExistsInThisRequest: true,
                    error: `Duplicate: "${trimmedName}" is already listed as a potential supplier for ${trimmedItemName ? `"${trimmedItemName}" in ` : ''}this specific request.`,
                    message: `Duplicate: "${trimmedName}" is already listed as a potential supplier for ${trimmedItemName ? `"${trimmedItemName}" in ` : ''}this specific request.`,
                    supplier: existing,
                    status: 409,
                };
            }

            // If it exists in DB, link this new item/request to it
            if (requestIdTag) {
                const updatedNotes = `${existing.notes || ''} | ${requestIdTag}`.trim();
                const updatePayload: Record<string, any> = { notes: updatedNotes };
                if (validPurchaseRequestId) {
                    updatePayload.purchase_request_id = validPurchaseRequestId;
                }
                if (supplier.products && (!existing.products || !existing.products.includes(supplier.products))) {
                    updatePayload.products = existing.products ? `${existing.products}, ${supplier.products}` : supplier.products;
                }
                await client
                    .from('suppliers')
                    .update(updatePayload)
                    .eq('id', existing.id);
            }

            return {
                success: true,
                alreadyExistsInThisRequest: false,
                isLinkedToNewRequest: true,
                message: `"${trimmedName}" has been successfully added as a Potential Supplier for ${trimmedItemName ? `"${trimmedItemName}"` : 'this request'}.`,
                supplier: existing,
                status: 200,
            };
        }

        if (osmId) {
            const { data: existingByOsm } = await client
                .from('suppliers')
                .select('*')
                .ilike('notes', `%OSM ID: %${osmId}%`)
                .limit(1);

            if (existingByOsm && existingByOsm.length > 0) {
                const existing = existingByOsm[0];
                const existingNotes = (existing.notes || '').toLowerCase();
                const targetReq = (params.requestId || '').toLowerCase().trim();
                const targetItem = trimmedItemName.toLowerCase();
                const targetItemId = trimmedItemId.toLowerCase();

                const isAlreadyInThisRequest = (
                    (targetItemId && existingNotes.includes(targetItemId)) ||
                    (targetReq && targetItem && existingNotes.includes(targetReq) && existingNotes.includes(targetItem)) ||
                    (targetReq && !targetItem && !targetItemId && (existingNotes.includes(`request id: ${targetReq}`) || existingNotes.includes(targetReq)))
                );

                if (isAlreadyInThisRequest) {
                    return {
                        success: false,
                        alreadyExistsInThisRequest: true,
                        error: `Duplicate: "${existing.name}" is already listed as a potential supplier for ${trimmedItemName ? `"${trimmedItemName}" in ` : ''}this specific request.`,
                        message: `Duplicate: "${existing.name}" is already listed as a potential supplier for ${trimmedItemName ? `"${trimmedItemName}" in ` : ''}this specific request.`,
                        supplier: existing,
                        status: 409,
                    };
                }

                if (requestIdTag) {
                    const updatedNotes = `${existing.notes || ''} | ${requestIdTag}`.trim();
                    const updatePayload: Record<string, any> = { notes: updatedNotes };
                    if (validPurchaseRequestId) {
                        updatePayload.purchase_request_id = validPurchaseRequestId;
                    }
                    if (supplier.products && (!existing.products || !existing.products.includes(supplier.products))) {
                        updatePayload.products = existing.products ? `${existing.products}, ${supplier.products}` : supplier.products;
                    }
                    await client
                        .from('suppliers')
                        .update(updatePayload)
                        .eq('id', existing.id);
                }

                return {
                    success: true,
                    alreadyExistsInThisRequest: false,
                    isLinkedToNewRequest: true,
                    message: `"${existing.name}" has been successfully added as a Potential Supplier for ${trimmedItemName ? `"${trimmedItemName}"` : 'this request'}.`,
                    supplier: existing,
                    status: 200,
                };
            }
        }

        // 2. Insert new record with Potential status and OpenStreetMap source metadata
        const noteItems = [
            'Status: Potential / Pending Evaluation',
            requestIdTag,
            'Source: OpenStreetMap',
            `OSM ID: ${supplier.osm_type || 'node'}/${osmId || 'N/A'}`
        ].filter(Boolean);

        const notesMetadata = noteItems.join(' | ');

        // Email validation for constraint: chk_supplier_email_format
        const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        let sanitizedEmail: string | null = null;
        if (supplier.email && typeof supplier.email === 'string') {
            let cleanEmail = supplier.email.trim();
            if (cleanEmail.startsWith('mailto:')) cleanEmail = cleanEmail.replace(/^mailto:/i, '').trim();
            if (cleanEmail.includes(',') || cleanEmail.includes(';') || cleanEmail.includes(' ')) {
                const parts = cleanEmail.split(/[,;\s]+/);
                const match = parts.find((p) => EMAIL_REGEX.test(p.trim()));
                if (match) cleanEmail = match.trim();
            }
            if (EMAIL_REGEX.test(cleanEmail)) {
                sanitizedEmail = cleanEmail;
            }
        }

        // Phone validation for constraint: chk_supplier_phone_format
        const PHONE_REGEX = /^\+?[0-9\s\-\(\)]{7,20}$/;
        let sanitizedPhone = '+63 2 8000 0000';
        if (supplier.phone && typeof supplier.phone === 'string') {
            const cleanPhone = supplier.phone.trim().replace(/[^0-9+\s\-()]/g, '').trim();
            if (cleanPhone.length >= 7 && cleanPhone.length <= 20 && PHONE_REGEX.test(cleanPhone)) {
                sanitizedPhone = cleanPhone;
            } else {
                const digits = supplier.phone.replace(/\D/g, '');
                if (digits.length >= 7 && digits.length <= 15) {
                    sanitizedPhone = digits.startsWith('63') ? `+${digits}` : digits.startsWith('0') ? `+63 ${digits.slice(1)}` : `+63 ${digits}`;
                }
            }
        }

        const insertPayload: Record<string, any> = {
            name: trimmedName,
            purchase_request_id: validPurchaseRequestId || null,
            category: supplier.category || 'Potential Supplier',
            contact_person: supplier.contact_person || 'Store Contact',
            phone: sanitizedPhone,
            email: sanitizedEmail, // Passes NULL when invalid or missing, complying with chk_supplier_email_format
            location: supplier.location || 'Metro Manila, Philippines',
            products: supplier.products || 'OpenStreetMap Discovered Goods',
            notes: notesMetadata,
            fb_link: supplier.website || '',
            is_active: false, // Potential supplier pending procurement evaluation
        };

        const { data: inserted, error: insertError } = await client
            .from('suppliers')
            .insert(insertPayload)
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting potential supplier into Supabase:', insertError);
            return {
                success: false,
                error: insertError.message || 'Failed to save potential supplier.',
                status: 500,
            };
        }

        return {
            success: true,
            alreadyExists: false,
            message: `"${trimmedName}" has been successfully added as a Potential Supplier (Status: Pending Evaluation).`,
            supplier: inserted,
            status: 201,
        };
    } catch (error: any) {
        console.error('Error in addPotentialSupplier:', error);
        return {
            success: false,
            error: error?.message || 'Failed to process potential supplier addition.',
            status: 500,
        };
    }
}

/**
 * Safely unlinks a potential supplier from a specific item/request without deleting
 * the supplier if they are active, registered, or linked to other items/requests.
 */
export async function removePotentialSupplierLinkage(params: {
    supplierId: number | string;
    requestId?: string;
    itemId?: string;
    itemName?: string;
}) {
    try {
        const client = dbClient || supabase;
        const { supplierId, requestId, itemId, itemName } = params;

        // 1. Fetch supplier record
        const { data: supplier, error: fetchErr } = await client
            .from('suppliers')
            .select('*')
            .eq('id', supplierId)
            .single();

        if (fetchErr || !supplier) {
            return { success: false, error: fetchErr?.message || 'Supplier not found' };
        }

        const notes = supplier.notes || '';
        const notesLower = notes.toLowerCase();
        const targetReq = (requestId || '').toLowerCase().trim();
        const targetItemId = (itemId || '').toLowerCase().trim();
        const targetItemName = (itemName || '').toLowerCase().trim();

        // Check if supplier is registered/active or has other links
        const isActive = supplier.is_active === true;
        
        // Count how many item / request links are present in notes
        const bracketedLinks = notes.match(/\[[^\]]*(?:Request ID|Item ID|Item:)[^\]]*\]/gi) || [];
        const pipeSegments = notes.split('|').map((s: string) => s.trim()).filter(Boolean);
        
        const hasOtherLinks = bracketedLinks.length > 1 || 
            (!bracketedLinks.length && pipeSegments.filter((seg: string) => seg.toLowerCase().includes('request id:') || seg.toLowerCase().includes('item:')).length > 1);

        if (isActive || hasOtherLinks) {
            // Unlink specifically this item/request from notes
            let updatedNotes = notes;

            if (targetItemId) {
                // Remove bracketed segment containing targetItemId
                const regex = new RegExp(`\\[[^\\]]*${targetItemId}[^\\]]*\\]\\s*\\|?\\s*`, 'gi');
                updatedNotes = updatedNotes.replace(regex, '');
            }

            if (targetItemName && updatedNotes === notes) {
                // Remove bracketed or pipe segment containing targetItemName
                const regex = new RegExp(`\\[[^\\]]*${targetItemName}[^\\]]*\\]\\s*\\|?\\s*`, 'gi');
                updatedNotes = updatedNotes.replace(regex, '');
            }

            if (targetReq && targetItemName && updatedNotes === notes) {
                const segRegex = new RegExp(`\\|?\\s*Request ID:\\s*${targetReq}[^|]*Item:\\s*${targetItemName}[^|]*`, 'gi');
                updatedNotes = updatedNotes.replace(segRegex, '');
            }

            // Clean up trailing/leading pipes
            updatedNotes = updatedNotes.replace(/\s*\|\s*\|+/g, ' | ').replace(/^(\s*\|\s*)+/, '').replace(/(\s*\|\s*)+$/, '').trim();

            const updatePayload: Record<string, any> = { notes: updatedNotes };
            if (supplier.purchase_request_id && targetReq && String(supplier.purchase_request_id).toLowerCase().trim() === targetReq && !hasOtherLinks) {
                updatePayload.purchase_request_id = null;
            }

            await client
                .from('suppliers')
                .update(updatePayload)
                .eq('id', supplierId);

            return { success: true, unlinkedOnly: true, message: 'Supplier unlinked from item.' };
        }

        // If it was solely created as a transient OSM potential supplier for this single item, delete it
        const { error: delErr } = await client
            .from('suppliers')
            .delete()
            .eq('id', supplierId);

        if (delErr) {
            return { success: false, error: delErr.message };
        }

        return { success: true, unlinkedOnly: false, message: 'Potential supplier removed.' };
    } catch (err: any) {
        console.error('Error in removePotentialSupplierLinkage:', err);
        return { success: false, error: err?.message || 'Failed to remove supplier linkage' };
    }
}

/**
 * Fetch all purchase requests directly from the database (bypassing client RLS)
 */
export async function fetchPurchaseRequestsForSourcing() {
    try {
        const client = dbClient || supabase;
        const { data, error } = await client
            .from('purchase_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error in fetchPurchaseRequestsForSourcing:', error);
            return [];
        }
        return data || [];
    } catch (err: any) {
        console.error('Exception in fetchPurchaseRequestsForSourcing:', err);
        return [];
    }
}

/**
 * Delete / remove a potential supplier from Supabase
 */
export async function deletePotentialSupplier(supplierId: number | string) {
    return removePotentialSupplierLinkage({ supplierId });
}

/**
 * Fetch approved requisitions and suppliers reliably via Service Role
 * to populate Procurement Stage 1 (Stock Shortages & Requisitions) without RLS barriers.
 */
export async function fetchApprovedRequisitionsForProcurement() {
    try {
        const client = dbClient || supabase;

        // 1. Fetch active suppliers to check categories
        const { data: suppliers } = await client
            .from('suppliers')
            .select('*');

        const activeCategories = (suppliers || [])
            .filter((s: any) => s && (s.is_active === undefined || s.is_active === true) && s.status !== 'inactive')
            .map((s: any) => (s.category || '').toLowerCase().trim())
            .filter(Boolean);

        // 2. Fetch purchase requests (Approved or Pending containing individually approved items with remaining deficits)
        const { data: prData, error: prErr } = await client
            .from('purchase_requests')
            .select('*')
            .not('status', 'in', '("Rejected","Cancelled","Delivered","Completed","Fulfilled")')
            .order('created_at', { ascending: false });

        if (prErr) {
            console.error('Error fetching purchase_requests for procurement:', prErr);
        }

        // 3. Fetch fallback inventory_requests
        const { data: irData, error: irErr } = await client
            .from('inventory_requests')
            .select('*')
            .not('status', 'in', '("Rejected","Cancelled","Delivered","Completed","Fulfilled")')
            .order('created_at', { ascending: false });

        if (irErr) {
            console.warn('Fallback inventory_requests fetch notice:', irErr.message);
        }

        const allReqs = [...(prData || []), ...(irData || [])].filter((r: any) => {
            const st = String(r.status || '').toLowerCase();
            if (st === 'rejected' || st === 'cancelled' || st === 'delivered' || st === 'completed' || st === 'fulfilled') {
                return false;
            }
            const items = Array.isArray(r.items) ? r.items : (typeof r.items === 'string' ? JSON.parse(r.items || '[]') : []);
            if (items.length > 0) {
                // If all items are already released or have 0 deficit, do not include in active procurement shortage queue
                const hasAnyDeficitOrUnreleased = items.some((it: any) => {
                    const reqQty = Number(it.quantity || it.quantity_requested || 1);
                    const issued = Number(it.issued_quantity || 0);
                    const deficit = it.deficit_quantity !== undefined 
                        ? Number(it.deficit_quantity) 
                        : (it.remaining_quantity !== undefined ? Number(it.remaining_quantity) : Math.max(0, reqQty - issued));
                    const isFullyReleased = it.status === 'Released' || it.status === 'Delivered' || it.is_released === true || it.is_issued === true || (issued >= reqQty && reqQty > 0);
                    return deficit > 0 && !isFullyReleased;
                });
                return hasAnyDeficitOrUnreleased;
            }
            return true;
        });

        return {
            success: true,
            data: allReqs,
            activeCategories: Array.from(new Set(activeCategories)),
            suppliers: suppliers || []
        };
    } catch (err: any) {
        console.error('Exception in fetchApprovedRequisitionsForProcurement:', err);
        return { success: false, data: [], activeCategories: [], suppliers: [] };
    }
}

/**
 * Server action to issue warehouse supplies to department with guaranteed DB update & audit logging
 */
export async function issueRequisitionSupplies(payload: {
    requestId: string;
    requestNumber?: string;
    department?: string;
    recipientName: string;
    recipientEmployeeId?: string;
    releasingOfficer: string;
    handoverLocation?: string;
    handoverNotes?: string;
    issuedItems: Record<string, number>;
    items: any[];
}) {
    try {
        const client = dbClient || supabase;

        // 1. Fetch current inventory items to decrement stock accurately
        const { data: invCatalog, error: catalogErr } = await client
            .from('inventory_items')
            .select('*');

        if (catalogErr) {
            console.error('Error fetching inventory_items catalog:', catalogErr);
        }

        const catalog = Array.isArray(invCatalog) ? invCatalog : [];
        const itemsList = Array.isArray(payload.items) ? payload.items : [];

        // Decrement stock for issued quantities
        for (let i = 0; i < itemsList.length; i++) {
            const reqItem = itemsList[i];
            const key = reqItem.id || `item-${i}`;
            
            // Resolve quantity to issue
            let qtyToIssue = Number(payload.issuedItems?.[key]);
            if (isNaN(qtyToIssue) || qtyToIssue === undefined) {
                qtyToIssue = Number(payload.issuedItems?.[`item-${i}`]) || Number(payload.issuedItems?.[String(reqItem.id)]) || 0;
            }
            if (qtyToIssue <= 0) {
                qtyToIssue = Number(reqItem.issued_quantity) || Number(reqItem.available_quantity) || Number(reqItem.approved_quantity) || Number(reqItem.quantity || reqItem.quantity_requested) || 0;
            }

            if (qtyToIssue > 0) {
                const itemName = (reqItem.name || reqItem.item_name || '').trim();
                const itemCode = (reqItem.item_code || '').trim();
                const catItemId = reqItem.catalog_item_id || reqItem.item_id || reqItem.inventory_items_id;

                // Match against inventory_items
                const matchedInv = catalog.find((inv: any) => {
                    if (catItemId && String(inv.id) === String(catItemId)) return true;
                    if (reqItem.id && String(inv.id) === String(reqItem.id)) return true;
                    if (itemCode && inv.item_code && String(inv.item_code).trim().toLowerCase() === itemCode.toLowerCase()) return true;
                    if (inv.item_name && itemName && String(inv.item_name).trim().toLowerCase() === itemName.toLowerCase()) return true;
                    if (inv.item_name && itemName && (
                        String(inv.item_name).toLowerCase().includes(itemName.toLowerCase()) || 
                        itemName.toLowerCase().includes(String(inv.item_name).toLowerCase())
                    )) return true;
                    return false;
                });

                if (matchedInv) {
                    const curStock = Number(matchedInv.current_stock) || 0;
                    const newStock = Math.max(0, curStock - qtyToIssue);
                    const minStock = Number(matchedInv.minimum_stock) || 0;
                    const newStatus = newStock === 0 ? 'out-of-stock' : newStock <= minStock ? 'low-stock' : 'available';

                    // Update inventory_items with valid schema fields
                    const { error: updateErr } = await client
                        .from('inventory_items')
                        .update({
                            current_stock: newStock,
                            status: newStatus,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', matchedInv.id);

                    if (updateErr) {
                        console.error(`Failed to update stock for item ${matchedInv.id} (${matchedInv.item_name}):`, updateErr);
                    }

                    // Log stock movement with exact item_id and request_id in metadata
                    await logStockMovement({
                        item_id: String(matchedInv.id),
                        item_code: matchedInv.item_code || `ITM-${matchedInv.id}`,
                        item_name: matchedInv.item_name,
                        movement_type: 'Stock Out',
                        quantity: qtyToIssue,
                        previous_stock: curStock,
                        new_stock: newStock,
                        reference_number: payload.requestNumber || `REQ-${payload.requestId}`,
                        reason: `Issued to ${payload.department || 'Department'} (Recipient: ${payload.recipientName})`,
                        notes: payload.handoverNotes || `Requisition fulfilled by ${payload.releasingOfficer}`,
                        department: payload.department || 'Warehouse',
                        performed_by: payload.releasingOfficer,
                        metadata: {
                            request_id: payload.requestId,
                            request_number: payload.requestNumber,
                            item_id: String(matchedInv.id),
                            catalog_item_id: String(matchedInv.id),
                            requisition_item_id: reqItem.id || reqItem.item_id || key,
                            recipient_name: payload.recipientName,
                            recipient_id: payload.recipientEmployeeId,
                            action: 'DEPARTMENT_ISSUE_FULFILLMENT',
                        },
                    });
                }
            }
        }

        const releaseTimestamp = new Date().toISOString();
        const releaseNotes = payload.handoverNotes
            ? `[Released by ${payload.releasingOfficer} to ${payload.recipientName}]: ${payload.handoverNotes}`
            : `Released by ${payload.releasingOfficer} to ${payload.recipientName}`;

        const updatedItems = itemsList.map((it: any, idx: number) => {
            const key = it.id || `item-${idx}`;
            const reqQty = Number(it.quantity || it.quantity_requested || 0);
            const prevIssued = Number(it.issued_quantity) || 0;
            
            // Resolve newly issued quantity from payload
            let newlyIssued = Number(payload.issuedItems?.[key]);
            if (isNaN(newlyIssued) || newlyIssued === undefined) {
                newlyIssued = Number(payload.issuedItems?.[`item-${idx}`]) || Number(payload.issuedItems?.[String(it.id)]) || 0;
            }
            if (newlyIssued <= 0 && prevIssued === 0) {
                newlyIssued = Number(it.available_quantity) || Number(it.approved_quantity) || reqQty;
            }

            const totalIssued = Math.min(reqQty, prevIssued + Math.max(0, newlyIssued));
            const deficitQty = Math.max(0, reqQty - totalIssued);
            const isItemFullyIssued = totalIssued >= reqQty && reqQty > 0;

            return {
                ...it,
                is_released: totalIssued > 0,
                is_issued: totalIssued > 0,
                status: isItemFullyIssued ? 'Released' : 'Partially Released',
                issued_quantity: totalIssued,
                deficit_quantity: deficitQty,
                remaining_quantity: deficitQty,
                approved_quantity: totalIssued,
                exported_quantity: totalIssued,
                released_by: payload.releasingOfficer,
                released_at: releaseTimestamp,
                recipient_name: payload.recipientName,
                recipient_employee_id: payload.recipientEmployeeId,
                handover_notes: payload.handoverNotes || it.handover_notes || null,
            };
        });

        const totalDeficitRemaining = updatedItems.reduce((acc: number, it: any) => acc + (Number(it.deficit_quantity) || 0), 0);
        const isFullyFulfilled = totalDeficitRemaining === 0;
        const finalStatus = isFullyFulfilled ? 'Completed' : 'Partially Released';

        // 1. Update purchase_requests
        const { error: prErr } = await client
            .from('purchase_requests')
            .update({
                status: finalStatus,
                completed_at: isFullyFulfilled ? releaseTimestamp : null,
                items: updatedItems,
                admin_notes: releaseNotes,
                updated_at: releaseTimestamp,
            })
            .eq('id', payload.requestId);

        if (prErr) {
            console.error('Error updating purchase_requests on supply issuance:', prErr);
        }

        // 2. Update inventory_requests if table exists
        try {
            await client
                .from('inventory_requests')
                .update({
                    status: isFullyFulfilled ? 'received' : 'partially received',
                    items: updatedItems,
                    admin_notes: releaseNotes,
                    updated_at: releaseTimestamp,
                })
                .eq('id', payload.requestId);
        } catch (irErr) {
            console.warn('inventory_requests update skipped:', irErr);
        }

        return {
            success: true,
            message: isFullyFulfilled
                ? `Supplies successfully issued and requisition fully fulfilled!`
                : `Supplies issued! ${totalDeficitRemaining} units remaining in deficit.`,
            data: {
                id: payload.requestId,
                status: finalStatus,
                isFullyFulfilled,
                totalDeficitRemaining,
                completed_at: isFullyFulfilled ? releaseTimestamp : null,
                fulfilled_at: releaseTimestamp,
                fulfilled_by: payload.releasingOfficer,
                items: updatedItems,
            },
        };
    } catch (err: any) {
        console.error('Error in issueRequisitionSupplies:', err);
        return {
            success: false,
            error: err?.message || 'Failed to issue supplies',
        };
    }
}

