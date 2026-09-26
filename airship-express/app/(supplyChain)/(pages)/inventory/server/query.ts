"use server";
import { supabase } from '../../../lib/services/client/supabase';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { isRateLimited } from '../../../components/global/rateLimit';
import { sanitizeSearch } from '../../../components/global/sanitize';

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
export interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    city?: string | null;
    region?: string | null;
    courier: string | null;
    driver_name?: string | null;
    bulk_qr_code?: string | null;
    bulk_qr_city?: string | null;
    bulk_qr_courier?: string | null;
    scanned_by: string | null;
    scanner_name?: string | null;
    scanner_email?: string | null;
    scanner_role?: string | null;
    scanned_at: string;
    status: string;
    created_at: string;
    updated_at: string;
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
// Attach scanner information to parcels
async function attachScannerDetails(parcels: any[]) {
    if (!parcels || parcels.length === 0) return parcels;
    const userIds = Array.from(new Set(parcels.map(p => p.scanned_by).filter(Boolean))) as string[];
    if (userIds.length === 0) return parcels;

    try {
        const userMap = await resolveScannerUsers(userIds);

        return parcels.map(p => {
            if (!p.scanned_by) return p;
            const scanner = userMap.get(String(p.scanned_by).trim());
            return {
                ...p,
                scanner_name: scanner?.name || 'Unknown',
                scanner_email: scanner?.email || null,
                scanner_role: scanner?.role || 'Unknown',
            };
        });
    } catch (e) {
        console.warn('Error attaching scanner details:', e);
        return parcels;
    }
}

// get scanners summary with total scans and status counts
export async function fetchScannersSummary(): Promise<{ success: boolean; data: ScannerUser[]; error?: string }> {
    try {
        const { data: parcelsData, error: parcelsError } = await dbClient
            .from('parcels')
            .select('id, status, scanned_by, created_at');

        if (parcelsError) throw parcelsError;

        const uniqueUserIds = Array.from(
            new Set((parcelsData || []).map((p: any) => p.scanned_by).filter(Boolean))
        ) as string[];

        const userMap = await resolveScannerUsers(uniqueUserIds);

        const statsMap = new Map<string, ScannerUser>();

        (parcelsData || []).forEach((p: any) => {
            const rawId = p.scanned_by ? String(p.scanned_by).trim() : 'unassigned';
            const scannerId = rawId || 'unassigned';
            if (!statsMap.has(scannerId)) {
                if (scannerId === 'unassigned') {
                    statsMap.set(scannerId, {
                        id: 'unassigned',
                        name: 'Unassigned / System',
                        email: 'Automated or legacy scan',
                        role: 'System / Legacy',
                        scanned_count: 0,
                        status_counts: {},
                        last_scanned_at: null,
                    });
                } else {
                    const userInfo = userMap.get(scannerId) || {
                        name: 'Unknown',
                        email: '',
                        role: 'Unknown',
                    };
                    statsMap.set(scannerId, {
                        id: scannerId,
                        name: userInfo.name,
                        email: userInfo.email,
                        role: userInfo.role,
                        scanned_count: 0,
                        status_counts: {},
                        last_scanned_at: null,
                    });
                }
            }

            const item = statsMap.get(scannerId)!;
            item.scanned_count += 1;
            const statusKey = p.status || 'received';
            item.status_counts[statusKey] = (item.status_counts[statusKey] || 0) + 1;
            if (!item.last_scanned_at || (p.created_at && new Date(p.created_at) > new Date(item.last_scanned_at))) {
                item.last_scanned_at = p.created_at;
            }
        });

        const list = Array.from(statsMap.values()).sort((a, b) => b.scanned_count - a.scanned_count);

        return {
            success: true,
            data: list,
        };
    } catch (error: any) {
        console.error('Error fetching scanners summary:', error);
        return {
            success: false,
            data: [],
            error: error?.message || 'Failed to fetch scanner stats',
        };
    }
}

const FALLBACK_DRIVERS = [
    "MAGAT, ROSANT CARLO",
    "MANAAY, ANTHONY",
    "MELENCION, JAMES",
    "NUEVAS, KENNETH",
];

// get drivers summary with parcel counts
export async function fetchDriversSummary(): Promise<{ success: boolean; data: DriverOption[]; error?: string }> {
    try {
        const [{ data: parcelsData }, { data: empData }] = await Promise.all([
            dbClient.from('parcels').select('driver_name'),
            dbClient.from('mock_employees').select('id, display_name, position, department, role')
        ]);

        const driverCounts: Record<string, number> = {};
        (parcelsData || []).forEach((p: any) => {
            if (p.driver_name && typeof p.driver_name === 'string') {
                const name = p.driver_name.trim();
                if (name) {
                    driverCounts[name] = (driverCounts[name] || 0) + 1;
                }
            }
        });

        const allDriverNames = new Set<string>(FALLBACK_DRIVERS);
        (empData || []).forEach((emp: any) => {
            const pos = (emp.position || '').toLowerCase();
            const dept = (emp.department || '').toLowerCase();
            const role = (emp.role || '').toLowerCase();
            if (
                pos.includes('rider') ||
                pos.includes('driver') ||
                pos.includes('drop-off') ||
                pos.includes('pick-up') ||
                dept.includes('rider') ||
                dept.includes('driver') ||
                role.includes('rider') ||
                role.includes('driver')
            ) {
                const name = (emp.display_name || '').trim();
                if (name) {
                    allDriverNames.add(name);
                }
            }
        });

        // Also add any driver names present on parcels
        Object.keys(driverCounts).forEach(name => allDriverNames.add(name));

        const list: DriverOption[] = Array.from(allDriverNames)
            .sort((a, b) => a.localeCompare(b))
            .map(name => ({
                name,
                count: driverCounts[name] || 0,
            }));

        return {
            success: true,
            data: list,
        };
    } catch (err: any) {
        console.error('Error fetching drivers summary:', err);
        return {
            success: false,
            data: FALLBACK_DRIVERS.map(name => ({ name, count: 0 })),
            error: err?.message,
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
    scannedBy?: string;
    driver?: string;
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
        const { page = 1, limit = 15, search = '', status = '', dateFrom = '', dateTo = '', scannedBy = '', driver = '' } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let query = dbClient
            .from('parcels')
            .select('*', { count: 'exact' });
        if (search) {
            const sanitizedSearch = sanitizeSearch(search);
            query = query.or(`barcode.ilike.%${sanitizedSearch}%,` +
                `tracking_number.ilike.%${sanitizedSearch}%,` +
                `sender_name.ilike.%${sanitizedSearch}%`);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (scannedBy) {
            if (scannedBy === 'unassigned') {
                query = query.is('scanned_by', null);
            } else {
                query = query.eq('scanned_by', scannedBy);
            }
        }
        if (driver) {
            if (driver === 'unassigned') {
                query = query.is('driver_name', null);
            } else if (driver === 'assigned') {
                query = query.not('driver_name', 'is', null);
            } else {
                query = query.eq('driver_name', driver);
            }
        }
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo + 'T23:59:59');
        }
        const { data, count: totalCount, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error)
            throw error;

        const enrichedParcels = await attachScannerDetails(data || []);

        return {
            success: true,
            data: {
                parcels: enrichedParcels,
                totalItems: totalCount || 0,
                page,
                limit,
                totalPages: Math.ceil((totalCount || 0) / limit),
            },
            status: 200,
        };
    }
    catch (error) {
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
    parcelPage?: number;
    parcelLimit?: number;
    parcelSearch?: string;
    parcelStatus?: string;
    parcelDateFrom?: string;
    parcelDateTo?: string;
    parcelScannedBy?: string;
    parcelDriver?: string;
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
        const [inventoryResult, parcelsResult, suppliersResult, statsResult, scannersResult, driversResult] = await Promise.all([
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
                scannedBy: params.parcelScannedBy || '',
                driver: params.parcelDriver || '',
            }),
            fetchSuppliers(),
            fetchDashboardStats(),
            fetchScannersSummary(),
            fetchDriversSummary(),
        ]);
        return {
            success: true,
            data: {
                inventory: inventoryResult.success ? inventoryResult.data : null,
                parcels: parcelsResult.success ? parcelsResult.data : null,
                suppliers: suppliersResult.success ? suppliersResult.data : [],
                stats: statsResult.success ? statsResult.data : null,
                scanners: scannersResult.success ? scannersResult.data : [],
                drivers: driversResult.success ? driversResult.data : [],
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

export async function fetchInventoryRequests(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: 'all' | 'internal' | 'external';
}) {
    try {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const offset = (page - 1) * limit;

        // Try primary dbClient first, fallback to supabase
        const client = dbClient || supabase;

        let query = client
            .from('inventory_requests')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (params.status && params.status !== 'all') {
            query = query.ilike('status', params.status);
        }

        if (params.type === 'internal') {
            query = query.or('Internal_request.eq.true,requested_by.not.is.null');
        } else if (params.type === 'external') {
            query = query.or('Internal_request.eq.false,Internal_request.is.null');
        }

        if (params.search && params.search.trim()) {
            const s = sanitizeSearch(params.search.trim());
            query = query.or(`item_name.ilike.%${s}%,department.ilike.%${s}%,message.ilike.%${s}%`);
        }

        query = query.range(offset, offset + limit - 1);

        let { data: requests, count, error } = await query;

        // If filtering by Internal_request caused an issue (e.g. column missing), retry without type filter
        if (error && (error.message?.includes('Internal_request') || error.message?.includes('column'))) {
            console.warn('Retrying fetchInventoryRequests without type filter:', error.message);
            let fallbackQuery = client
                .from('inventory_requests')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (params.status && params.status !== 'all') {
                fallbackQuery = fallbackQuery.ilike('status', params.status);
            }

            if (params.search && params.search.trim()) {
                const s = sanitizeSearch(params.search.trim());
                fallbackQuery = fallbackQuery.or(`item_name.ilike.%${s}%,department.ilike.%${s}%`);
            }

            fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);
            const retryResult = await fallbackQuery;
            requests = retryResult.data;
            count = retryResult.count;
            error = retryResult.error;
        }

        if (error) {
            console.error('Error fetching inventory_requests:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch inventory requests',
                status: 500,
            };
        }

        // Fetch current inventory items to match real-time stock & feasibility
        const { data: allItems } = await client
            .from('inventory_items')
            .select('id, item_code, item_name, current_stock, minimum_stock, unit, status');

        // Fetch all approved requests to determine exporting stock per item
        const { data: approvedReqs } = await client
            .from('inventory_requests')
            .select('id, inventory_items_id, item_name, quantity_requested')
            .ilike('status', 'approved');

        const exportingMap = new Map<string, number>();
        for (const ar of approvedReqs || []) {
            const qty = Number(ar.quantity_requested || 0);
            if (ar.inventory_items_id) {
                const idKey = String(ar.inventory_items_id);
                exportingMap.set(idKey, (exportingMap.get(idKey) || 0) + qty);
            }
            if (ar.item_name) {
                const nameKey = ar.item_name.toLowerCase().trim();
                exportingMap.set(nameKey, (exportingMap.get(nameKey) || 0) + qty);
            }
        }

        const itemMapById = new Map<string, any>();
        const itemMapByName = new Map<string, any>();
        for (const it of allItems || []) {
            const idKey = String(it.id);
            const nameKey = (it.item_name || '').toLowerCase().trim();
            const exporting = exportingMap.get(idKey) ?? exportingMap.get(nameKey) ?? 0;
            const currentStock = Number(it.current_stock || 0);
            const availableStock = Math.max(0, currentStock - exporting);
            
            const enrichedItem = {
                ...it,
                exporting_stock: exporting,
                available_stock: availableStock,
            };
            itemMapById.set(idKey, enrichedItem);
            itemMapByName.set(nameKey, enrichedItem);
        }

        // Resolve user names for requested_by & approved_or_rejected_by
        const userIdsToResolve = (requests || [])
            .map((r: any) => [r.requested_by, r.approved_or_rejected_by])
            .flat()
            .filter((id): id is string => Boolean(id) && typeof id === 'string');
        const resolvedUsers = await resolveScannerUsers(userIdsToResolve);

        // Attach live item feasibility & resolved user info to each request
        const enrichedRequests = (requests || []).map((req: any) => {
            const idKey = req.inventory_items_id ? String(req.inventory_items_id) : (req.item_id ? String(req.item_id) : null);
            const nameKey = (req.item_name || '').toLowerCase().trim();
            const matchedItem = (idKey && itemMapById.get(idKey)) || itemMapByName.get(nameKey) || null;

            const isInternal = req.Internal_request === true || req.internal_request === true || req.is_internal === true || Boolean(req.requested_by);
            const reqUserInfo = req.requested_by ? resolvedUsers.get(String(req.requested_by).trim()) : null;
            const approverInfo = req.approved_or_rejected_by ? resolvedUsers.get(String(req.approved_or_rejected_by).trim()) : null;

            const requesterName = reqUserInfo?.name || (isInternal ? (req.department ? `${req.department} Staff` : 'Internal Staff') : (req.requester_system || 'External Integration'));
            const approverName = approverInfo?.name || req.approved_by || 'Authorized Personnel';

            const requestedQty = Number(req.quantity_requested || 1);
            const currentStock = matchedItem ? Number(matchedItem.current_stock || 0) : 0;
            const availableStock = matchedItem ? Number(matchedItem.available_stock || 0) : 0;
            const isStockFeasible = matchedItem ? (availableStock >= requestedQty && currentStock > 0) : false;

            return {
                ...req,
                is_internal: isInternal,
                requester_name: requesterName,
                approver_name: approverName,
                quantity_requested: requestedQty,
                inventory_item: matchedItem,
                current_stock: currentStock,
                available_stock: availableStock,
                is_stock_feasible: isStockFeasible,
            };
        });

        // Compute summary counts
        const { data: countData } = await client
            .from('inventory_requests')
            .select('status');

        let pendingCount = 0;
        let approvedCount = 0;
        let receivedCount = 0;
        let rejectedCount = 0;

        for (const r of countData || []) {
            const st = (r.status || '').toLowerCase();
            if (st === 'pending') pendingCount++;
            else if (st === 'approved') approvedCount++;
            else if (st === 'received' || st === 'fulfilled') receivedCount++;
            else if (st === 'rejected') rejectedCount++;
        }

        return {
            success: true,
            data: {
                requests: enrichedRequests,
                totalItems: count || (requests?.length || 0),
                totalPages: Math.ceil((count || (requests?.length || 0)) / limit) || 1,
                page,
                stats: {
                    total: countData?.length || (requests?.length || 0),
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

export async function createInternalInventoryRequest(formData: {
    item_id: string;
    item_name: string;
    item_code?: string;
    quantity_requested: number;
    department: string;
    requested_by?: string;
    purpose?: string;
    remarks?: string;
    message?: string;
    possible_delivery_date?: string;
}) {
    try {
        if (!formData.item_name || !formData.quantity_requested || formData.quantity_requested <= 0) {
            return {
                success: false,
                error: 'Please specify a valid item and quantity greater than 0',
                status: 400,
            };
        }

        // Check if requested_by is a valid UUID
        const isValidUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str || '');
        const requestedByUuid = isValidUUID(formData.requested_by) ? formData.requested_by : null;

        const payload: any = {
            inventory_items_id: formData.item_id ? Number(formData.item_id) : null,
            item_name: formData.item_name,
            quantity_requested: formData.quantity_requested,
            department: formData.department || 'Internal',
            status: 'pending',
            message: formData.purpose || formData.message || 'Internal requisition',
            remarks: formData.remarks?.trim() || null,
            Internal_request: true,
            requested_by: requestedByUuid,
            possible_delivery_date: formData.possible_delivery_date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        let { data, error } = await dbClient
            .from('inventory_requests')
            .insert([payload])
            .select()
            .single();

        // Fallback: If 'remarks' column has not been added to the database yet, merge into 'message'
        if (error && (error.message?.includes('remarks') || error.details?.includes('remarks') || error.code === '42703')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.remarks;
            fallbackPayload.message = [formData.purpose, formData.remarks].filter(Boolean).join(' — ') || 'Internal requisition';
            
            const retry = await dbClient
                .from('inventory_requests')
                .insert([fallbackPayload])
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error('Error creating internal request:', error);
            return {
                success: false,
                error: error.message || 'Failed to create internal request',
                status: 500,
            };
        }

        return {
            success: true,
            data,
            message: `Internal request created successfully`,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in createInternalInventoryRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to create internal request',
            status: 500,
        };
    }
}

export async function approveInventoryRequest(requestId: string, approvedBy?: string) {
    try {
        const { data: request, error: fetchErr } = await dbClient
            .from('inventory_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchErr || !request) {
            return {
                success: false,
                error: 'Request not found',
                status: 404,
            };
        }

        if (request.status?.toLowerCase() === 'approved') {
            return {
                success: false,
                error: 'This request is already approved',
                status: 400,
            };
        }

        const isValidUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str || '');
        const approverUuid = isValidUUID(approvedBy) ? approvedBy : null;

        const updatePayload: any = {
            status: 'approved',
            updated_at: new Date().toISOString(),
        };
        if (approverUuid) {
            updatePayload.approved_or_rejected_by = approverUuid;
        }

        const { data: updated, error: updateErr } = await dbClient
            .from('inventory_requests')
            .update(updatePayload)
            .eq('id', requestId)
            .select()
            .single();

        if (updateErr) {
            return {
                success: false,
                error: updateErr.message || 'Failed to approve request',
                status: 500,
            };
        }

        return {
            success: true,
            data: updated,
            message: `Request for ${request.item_name} approved and stock allocated for export`,
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

export async function rejectInventoryRequest(requestId: string, reason: string, rejectedBy?: string) {
    try {
        const isValidUUID = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str || '');
        const rejectorUuid = isValidUUID(rejectedBy) ? rejectedBy : null;

        const updatePayload: any = {
            status: 'rejected',
            updated_at: new Date().toISOString(),
        };
        if (rejectorUuid) {
            updatePayload.approved_or_rejected_by = rejectorUuid;
        }

        const { data: updated, error } = await dbClient
            .from('inventory_requests')
            .update(updatePayload)
            .eq('id', requestId)
            .select()
            .single();

        if (error) {
            return {
                success: false,
                error: error.message || 'Failed to reject request',
                status: 500,
            };
        }

        return {
            success: true,
            data: updated,
            message: 'Request rejected',
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
        const { data: request, error: reqErr } = await dbClient
            .from('inventory_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (reqErr || !request) {
            return {
                success: false,
                error: 'Request not found',
                status: 404,
            };
        }

        if (request.status?.toLowerCase() === 'received' || request.status?.toLowerCase() === 'fulfilled') {
            return {
                success: false,
                error: 'This request has already been released/received',
                status: 400,
            };
        }

        const deductQty = quantityToRelease && quantityToRelease > 0 
            ? Math.min(quantityToRelease, Number(request.quantity_requested || 1))
            : Number(request.quantity_requested || 1);

        // Find matching inventory item by inventory_items_id or item_name
        let itemQuery = dbClient.from('inventory_items').select('*');
        if (request.inventory_items_id) {
            itemQuery = itemQuery.eq('id', request.inventory_items_id);
        } else if (request.item_id) {
            itemQuery = itemQuery.eq('id', request.item_id);
        } else if (request.item_name) {
            itemQuery = itemQuery.ilike('item_name', request.item_name.trim());
        }

        const { data: itemData, error: itemErr } = await itemQuery.single();

        if (itemErr || !itemData) {
            return {
                success: false,
                error: `Inventory item '${request.item_name}' was not found in the warehouse catalog`,
                status: 404,
            };
        }

        const currentStock = Number(itemData.current_stock || 0);
        const newStock = Math.max(0, currentStock - deductQty);
        const minStock = Number(itemData.minimum_stock || 10);

        let newStatus = 'available';
        if (newStock <= 0) newStatus = 'out-of-stock';
        else if (newStock < minStock) newStatus = 'low-stock';

        // 1. Deduct stock from inventory_items
        const { error: stockUpdateErr } = await dbClient
            .from('inventory_items')
            .update({
                current_stock: newStock,
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', itemData.id);

        if (stockUpdateErr) {
            return {
                success: false,
                error: `Failed to deduct warehouse stock: ${stockUpdateErr.message}`,
                status: 500,
            };
        }

        // 2. Mark request as received
        const { data: updatedReq, error: reqUpdateErr } = await dbClient
            .from('inventory_requests')
            .update({
                status: 'received',
                updated_at: new Date().toISOString(),
            })
            .eq('id', requestId)
            .select()
            .single();

        if (reqUpdateErr) {
            console.warn('Could not update request status after stock deduction:', reqUpdateErr);
        }

        return {
            success: true,
            data: updatedReq,
            deductedQuantity: deductQty,
            remainingStock: newStock,
            itemName: itemData.item_name,
            unit: itemData.unit || 'pcs',
            message: `Successfully released ${deductQty} ${itemData.unit || 'pcs'} for ${request.item_name}. Stock deducted from inventory (${currentStock} -> ${newStock} ${itemData.unit || 'pcs'}).`,
            status: 200,
        };
    } catch (error: any) {
        console.error('Error in fulfillInventoryRequest:', error);
        return {
            success: false,
            error: error?.message || 'Failed to fulfill inventory request',
            status: 500,
        };
    }
}
