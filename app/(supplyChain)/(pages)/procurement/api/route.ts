//app/(supplyChain)/procurement/api/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { sanitizeText, sanitizeNumber } from '@/app/(supplyChain)/components/global/sanitize';
import { headers } from 'next/headers';

// ============================================================
// TYPES
// ============================================================
interface PurchaseRequestItem {
    name: string;
    quantity: number;
}

interface PurchaseRequest {
    id?: string;
    request_number?: string;
    type: string;
    description: string;
    requested_by: string;
    department: string;
    supplier_id: string;
    supplier_name: string;
    amount: number;
    priority: string;
    date: string;
    status: string;
    items: PurchaseRequestItem[];
    reason: string;
    created_at?: string;
    updated_at?: string;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string;
    notes: string;
    items: any[];
    created_at?: string;
    updated_at?: string;
}

interface Supplier {
    id: string;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string | null;
    notes: string | null;
    is_active: boolean;
}

// // ============================================================
// // RATE LIMITING (Simple in-memory)
// // ============================================================
// const rateLimiter = new Map<string, { count: number; resetTime: number }>();

// function isRateLimited(key: string): boolean {
//     const now = Date.now();
//     const userRate = rateLimiter.get(key);

//     if (userRate) {
//         if (now < userRate.resetTime) {
//             if (userRate.count >= 10) {
//                 return true;
//             }
//             userRate.count++;
//         } else {
//             rateLimiter.set(key, { count: 1, resetTime: now + 60000 });
//         }
//     } else {
//         rateLimiter.set(key, { count: 1, resetTime: now + 60000 });
//     }

//     return false;
// }

// ============================================================
// GENERATE REQUEST NUMBER
// ============================================================
function generateRequestNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PR-${year}${month}${day}-${random}`;
}

// ============================================================
// GET - Fetch purchase requests with pagination & filtering
// ============================================================
export async function GET(request: NextRequest) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // if (isRateLimited(`${ip}:procurement_get`)) {
        //     return NextResponse.json(
        //         { success: false, error: 'Too many requests. Please wait.' },
        //         { status: 429 }
        //     );
        // }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const tab = searchParams.get('tab') || 'all';
        const includeOrders = searchParams.get('includeOrders') === 'true';
        const includeSuppliers = searchParams.get('includeSuppliers') === 'true';

        // ============================================================
        // BUILD QUERY
        // ============================================================
        let query = supabase
            .from('purchase_requests')
            .select('*', { count: 'exact' });

        // Apply search filter
        if (search) {
            query = query.or(
                `request_number.ilike.%${search}%,` +
                `requested_by.ilike.%${search}%,` +
                `supplier_name.ilike.%${search}%,` +
                `description.ilike.%${search}%`
            );
        }

        // Apply tab filter
        if (tab === 'pending') {
            query = query.eq('status', 'Pending');
        } else if (tab === 'approved') {
            query = query.in('status', ['Approved', 'Completed']);
        }

        // Get total count first
        const { count: totalCount, error: countError } = await query;
        if (countError) throw countError;

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        if (totalCount && from < totalCount) {
            query = query.range(from, to);
        }

        const { data: requests, error: requestsError } = await query.order('created_at', { ascending: false });

        if (requestsError) {
            if (requestsError.code === 'PGRST103') {
                // Range error - return empty array with correct pagination
                return NextResponse.json({
                    success: true,
                    data: {
                        requests: [],
                        totalItems: totalCount || 0,
                        page,
                        limit,
                        totalPages: Math.ceil((totalCount || 0) / limit)
                    }
                });
            }
            throw requestsError;
        }

        // ============================================================
        // TRANSFORM REQUESTS
        // ============================================================
        const transformedRequests: PurchaseRequest[] = (requests || []).map((req: any) => ({
            id: req.id,
            request_number: req.request_number || '',
            type: req.type || '',
            description: req.description || '',
            requested_by: req.requested_by || '',
            department: req.department || '',
            supplier_id: req.supplier_id || '',
            supplier_name: req.supplier_name || '',
            amount: req.amount || 0,
            priority: req.priority || 'Normal',
            date: req.date || req.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            status: req.status || 'Pending',
            items: req.items || [],
            reason: req.reason || '',
            created_at: req.created_at,
            updated_at: req.updated_at,
        }));

        // ============================================================
        // PREPARE RESPONSE DATA
        // ============================================================
        const responseData: any = {
            requests: transformedRequests,
            totalItems: totalCount || 0,
            page,
            limit,
            totalPages: Math.ceil((totalCount || 0) / limit)
        };

        // Include purchase orders if requested
        if (includeOrders) {
            const { data: orders, error: ordersError } = await supabase
                .from('purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (!ordersError) {
                responseData.purchaseOrders = orders || [];
            }
        }

        // Include suppliers if requested
        if (includeSuppliers) {
            const { data: suppliers, error: suppliersError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (!suppliersError) {
                responseData.suppliers = suppliers || [];
            }
        }

        // ============================================================
        // GET COUNTS
        // ============================================================
        try {
            const { count: allCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true });

            const { count: pendingCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'Pending');

            const { count: approvedCount } = await supabase
                .from('purchase_requests')
                .select('*', { count: 'exact', head: true })
                .in('status', ['Approved', 'Completed']);

            responseData.counts = {
                all: allCount || 0,
                pending: pendingCount || 0,
                approved: approvedCount || 0
            };
        } catch (countError) {
            console.error('Error fetching counts:', countError);
        }

        return NextResponse.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching procurement data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch procurement data' },
            { status: 500 }
        );
    }
}

// ============================================================
// POST - Create a new purchase request
// ============================================================
export async function POST(request: NextRequest) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // if (isRateLimited(`${ip}:procurement_post`)) {
        //     return NextResponse.json(
        //         { success: false, error: 'Too many requests. Please wait.' },
        //         { status: 429 }
        //     );
        // }

        const body = await request.json();

        // Validate required fields
        const {
            type,
            description,
            requested_by,
            department,
            supplier_id,
            supplier_name,
            amount,
            priority,
            status,
            date,
            items,
            reason
        } = body;

        if (!requested_by || !supplier_id || !reason) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: requested_by, supplier_id, and reason are required' },
                { status: 400 }
            );
        }

        // Validate items
        if (!items || items.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one item is required' },
                { status: 400 }
            );
        }

        const hasInvalidItem = items.some(
            (item: PurchaseRequestItem) => !item.name?.trim() || !item.quantity || item.quantity <= 0
        );

        if (hasInvalidItem) {
            return NextResponse.json(
                { success: false, error: 'Invalid item data - each item must have a name and valid quantity' },
                { status: 400 }
            );
        }

        // Verify supplier exists
        const { data: supplier, error: supplierError } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('id', supplier_id)
            .maybeSingle();

        if (supplierError || !supplier) {
            return NextResponse.json(
                { success: false, error: 'Invalid supplier selected' },
                { status: 400 }
            );
        }

        // Sanitize input
        const sanitizedRequestedBy = sanitizeText(requested_by);
        const sanitizedReason = sanitizeText(reason);
        const sanitizedItems = items.map((item: PurchaseRequestItem) => ({
            name: sanitizeText(item.name),
            quantity: sanitizeNumber(item.quantity),
        }));

        // Generate request number
        const requestNumber = generateRequestNumber();

        // Insert into database
        const { data, error } = await supabase
            .from('purchase_requests')
            .insert({
                request_number: requestNumber,
                type: type || 'New Request',
                description: description || sanitizedItems.map((i: any) => `${i.name} (${i.quantity})`).join(', '),
                requested_by: sanitizedRequestedBy,
                department: department || 'Fleet',
                supplier_id,
                supplier_name: supplier.name,
                amount: amount || 0,
                priority: priority || 'Normal',
                status: status || 'Pending',
                date: date || new Date().toISOString().split('T')[0],
                items: sanitizedItems,
                reason: sanitizedReason,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating purchase request:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to create purchase request' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data,
            message: 'Purchase request created successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating purchase request:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create purchase request' },
            { status: 500 }
        );
    }
}

// ============================================================
// PUT - Update an existing purchase request
// ============================================================
export async function PUT(request: NextRequest) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // if (isRateLimited(`${ip}:procurement_put`)) {
        //     return NextResponse.json(
        //         { success: false, error: 'Too many requests. Please wait.' },
        //         { status: 429 }
        //     );
        // }

        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Request ID is required' },
                { status: 400 }
            );
        }

        // Verify request exists
        const { data: existing, error: checkError } = await supabase
            .from('purchase_requests')
            .select('id, status')
            .eq('id', id)
            .maybeSingle();

        if (checkError || !existing) {
            return NextResponse.json(
                { success: false, error: 'Purchase request not found' },
                { status: 404 }
            );
        }

        // Only allow editing of pending requests
        if (existing.status !== 'Pending') {
            return NextResponse.json(
                { success: false, error: 'Only pending requests can be edited' },
                { status: 400 }
            );
        }

        // Sanitize update data
        const sanitizedUpdate: any = { updated_at: new Date().toISOString() };

        if (updateData.requested_by) sanitizedUpdate.requested_by = sanitizeText(updateData.requested_by);
        if (updateData.reason) sanitizedUpdate.reason = sanitizeText(updateData.reason);
        if (updateData.type) sanitizedUpdate.type = updateData.type;
        if (updateData.description) sanitizedUpdate.description = updateData.description;
        if (updateData.department) sanitizedUpdate.department = updateData.department;
        if (updateData.supplier_id) {
            // Verify supplier exists
            const { data: supplier, error: supplierError } = await supabase
                .from('suppliers')
                .select('id, name')
                .eq('id', updateData.supplier_id)
                .maybeSingle();

            if (supplierError || !supplier) {
                return NextResponse.json(
                    { success: false, error: 'Invalid supplier selected' },
                    { status: 400 }
                );
            }

            sanitizedUpdate.supplier_id = updateData.supplier_id;
            sanitizedUpdate.supplier_name = supplier.name;
        }
        if (updateData.amount !== undefined) sanitizedUpdate.amount = updateData.amount;
        if (updateData.priority) sanitizedUpdate.priority = updateData.priority;
        if (updateData.status) sanitizedUpdate.status = updateData.status;
        if (updateData.date) sanitizedUpdate.date = updateData.date;
        if (updateData.items) {
            const hasInvalidItem = updateData.items.some(
                (item: PurchaseRequestItem) => !item.name?.trim() || !item.quantity || item.quantity <= 0
            );
            if (hasInvalidItem) {
                return NextResponse.json(
                    { success: false, error: 'Invalid item data' },
                    { status: 400 }
                );
            }
            sanitizedUpdate.items = updateData.items.map((item: PurchaseRequestItem) => ({
                name: sanitizeText(item.name),
                quantity: sanitizeNumber(item.quantity),
            }));
        }

        // Update in database
        const { data, error } = await supabase
            .from('purchase_requests')
            .update(sanitizedUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating purchase request:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to update purchase request' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data,
            message: 'Purchase request updated successfully'
        });

    } catch (error) {
        console.error('Error updating purchase request:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update purchase request' },
            { status: 500 }
        );
    }
}

// ============================================================
// DELETE - Delete one or multiple purchase requests
// ============================================================
export async function DELETE(request: NextRequest) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // if (isRateLimited(`${ip}:procurement_delete`)) {
        //     return NextResponse.json(
        //         { success: false, error: 'Too many requests. Please wait.' },
        //         { status: 429 }
        //     );
        // }

        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get('id');
        const ids = searchParams.get('ids');

        // Handle single delete
        if (id) {
            // Verify request exists and is pending
            const { data: existing, error: checkError } = await supabase
                .from('purchase_requests')
                .select('id, status')
                .eq('id', id)
                .maybeSingle();

            if (checkError || !existing) {
                return NextResponse.json(
                    { success: false, error: 'Purchase request not found' },
                    { status: 404 }
                );
            }

            if (existing.status !== 'Pending') {
                return NextResponse.json(
                    { success: false, error: 'Only pending requests can be deleted' },
                    { status: 400 }
                );
            }

            const { error: deleteError } = await supabase
                .from('purchase_requests')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('Error deleting purchase request:', deleteError);
                return NextResponse.json(
                    { success: false, error: 'Failed to delete purchase request' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                data: { deleted: 1 },
                message: 'Purchase request deleted successfully'
            });
        }

        // Handle bulk delete
        if (ids) {
            let idsArray: string[];
            try {
                idsArray = JSON.parse(ids);
            } catch {
                idsArray = ids.split(',').map((s: string) => s.trim());
            }

            if (!idsArray || idsArray.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'No IDs provided for deletion' },
                    { status: 400 }
                );
            }

            // Verify all requests exist and are pending
            const { data: existing, error: checkError } = await supabase
                .from('purchase_requests')
                .select('id, status')
                .in('id', idsArray);

            if (checkError) {
                return NextResponse.json(
                    { success: false, error: 'Failed to verify requests' },
                    { status: 500 }
                );
            }

            const pendingIds = existing?.filter(r => r.status === 'Pending').map(r => r.id) || [];
            const nonPending = existing?.filter(r => r.status !== 'Pending').map(r => r.id) || [];

            if (pendingIds.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'No pending requests found to delete' },
                    { status: 400 }
                );
            }

            const { error: deleteError } = await supabase
                .from('purchase_requests')
                .delete()
                .in('id', pendingIds);

            if (deleteError) {
                console.error('Error deleting purchase requests:', deleteError);
                return NextResponse.json(
                    { success: false, error: 'Failed to delete purchase requests' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                data: {
                    deleted: pendingIds.length,
                    skipped: nonPending.length,
                    skippedIds: nonPending,
                },
                message: `Successfully deleted ${pendingIds.length} request(s)`
            });
        }

        return NextResponse.json(
            { success: false, error: 'Missing ID or IDs parameter' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Error deleting purchase request:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete purchase request' },
            { status: 500 }
        );
    }
}

// ============================================================
// PATCH - Approve or reject a purchase request
// ============================================================
export async function PATCH(request: NextRequest) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // if (isRateLimited(`${ip}:procurement_patch`)) {
        //     return NextResponse.json(
        //         { success: false, error: 'Too many requests. Please wait.' },
        //         { status: 429 }
        //     );
        // }

        const body = await request.json();
        const { id, action } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Request ID is required' },
                { status: 400 }
            );
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
                { status: 400 }
            );
        }

        // Verify request exists and is pending
        const { data: existing, error: checkError } = await supabase
            .from('purchase_requests')
            .select('id, status')
            .eq('id', id)
            .maybeSingle();

        if (checkError || !existing) {
            return NextResponse.json(
                { success: false, error: 'Purchase request not found' },
                { status: 404 }
            );
        }

        if (existing.status !== 'Pending') {
            return NextResponse.json(
                { success: false, error: `Request is already ${existing.status.toLowerCase()}` },
                { status: 400 }
            );
        }

        const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

        const { data, error } = await supabase
            .from('purchase_requests')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Error ${action}ing purchase request:`, error);
            return NextResponse.json(
                { success: false, error: `Failed to ${action} purchase request` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data,
            message: `Request ${action}d successfully`
        });

    } catch (error) {
        console.error('Error updating purchase request:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update purchase request' },
            { status: 500 }
        );
    }
}