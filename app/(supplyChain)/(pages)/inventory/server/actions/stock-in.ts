// app/(supplyChain)/(pages)/inventory/server/actions/stock-in.ts
'use server';

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { revalidatePath } from 'next/cache';
import { calculateItemStatus } from '../../utils/helpers';

export interface StockInParams {
    inventory_item_id: string | number;
    poi_id?: string | null;
    quantity: number;
    force?: boolean;
    force_reason?: string;
    userId?: string | null;
    userRole?: string | null;
    supplier?: string;
    reference?: string;
    remarks?: string;
}

export interface StockInResult {
    success: boolean;
    error?: string;
    status?: number;
    data?: any;
    exceeded?: boolean;
}

/**
 * Server-side validated stock-in action (Phase 2)
 */
export async function stockInItemAction(params: StockInParams): Promise<StockInResult> {
    try {
        const {
            inventory_item_id,
            poi_id,
            quantity,
            force = false,
            force_reason = '',
            userId = null,
            userRole = 'User',
            supplier = '',
            reference = '',
            remarks = '',
        } = params;

        if (!inventory_item_id) {
            return { success: false, error: 'Inventory item ID is required', status: 400 };
        }

        if (!quantity || quantity <= 0) {
            return { success: false, error: 'Quantity must be greater than 0', status: 400 };
        }

        // 1. Fetch the target inventory item
        const { data: item, error: itemError } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('id', inventory_item_id)
            .single();

        if (itemError || !item) {
            return { success: false, error: 'Target inventory item not found', status: 404 };
        }

        // 2. Fetch associated purchase_order_items (POI)
        let poi: any = null;

        if (poi_id) {
            const { data: poiData } = await supabase
                .from('purchase_order_items')
                .select(`
                    *,
                    purchase_orders (
                        id,
                        po_number,
                        status,
                        paid,
                        fully_received,
                        supplier_name
                    )
                `)
                .eq('id', poi_id)
                .maybeSingle();
            poi = poiData;
        } else {
            // Find latest POI for this inventory item where PO status is 'Delivered'
            const { data: poiList } = await supabase
                .from('purchase_order_items')
                .select(`
                    *,
                    purchase_orders!inner (
                        id,
                        po_number,
                        status,
                        paid,
                        fully_received,
                        supplier_name,
                        created_at
                    )
                `)
                .eq('inventory_item_id', inventory_item_id)
                .eq('purchase_orders.status', 'Delivered')
                .order('created_at', { ascending: false })
                .limit(1);

            if (poiList && poiList.length > 0) {
                poi = poiList[0];
            }
        }

        // Resolve user record and role against public.users table
        let validUserUUID: string | null = null;
        let dbUserRole: string | null = null;
        const isValidUUIDFormat = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

        if (isValidUUIDFormat) {
            try {
                const { data: userExists } = await supabase
                    .from('users')
                    .select('id, role, display_name, status')
                    .eq('id', userId)
                    .maybeSingle();

                if (userExists?.id) {
                    validUserUUID = userExists.id;
                    dbUserRole = userExists.role;
                }
            } catch (err) {
                console.warn('Could not verify user in users table:', err);
            }
        }

        // If provided userId not found in users table, fallback to any active user in users table
        if (!validUserUUID) {
            try {
                const { data: fallbackUser } = await supabase
                    .from('users')
                    .select('id, role')
                    .eq('status', 'Active')
                    .limit(1)
                    .maybeSingle();
                if (fallbackUser?.id) {
                    validUserUUID = fallbackUser.id;
                    if (!dbUserRole) dbUserRole = fallbackUser.role;
                }
            } catch (err) {
                console.warn('Could not query fallback user:', err);
            }
        }

        const effectiveRole = dbUserRole || userRole || 'Employee';
        const isAdminOrManager = effectiveRole === 'Admin' || effectiveRole === 'Manager';

        // 3. Validation Logic
        let exceededLimit = false;

        if (!poi) {
            // No matching delivered PO found
            if (!force) {
                return {
                    success: false,
                    error: `No delivered Purchase Order found for "${item.item_name}". Stock-in requires a delivered PO, or Admin/Manager authorization.`,
                    status: 400,
                };
            }

            if (!isAdminOrManager) {
                return {
                    success: false,
                    error: 'Force stock-in without a delivered PO requires Admin or Manager role.',
                    status: 403,
                };
            }
        } else {
            const po = poi.purchase_orders;
            if (po?.status !== 'Delivered') {
                if (!force) {
                    return {
                        success: false,
                        error: `Purchase Order #${po?.po_number || ''} is in "${po?.status}" status. Stock-in is only allowed once the order is "Delivered".`,
                        status: 400,
                    };
                }

                if (!isAdminOrManager) {
                    return {
                        success: false,
                        error: 'Force stock-in for non-delivered PO requires Admin or Manager role.',
                        status: 403,
                    };
                }
            }

            const currentReceived = poi.quantity_received || 0;
            const ordered = poi.quantity_ordered || 0;
            const remaining = Math.max(0, ordered - currentReceived);

            if (quantity + currentReceived > ordered) {
                exceededLimit = true;
                const diff = (quantity + currentReceived) - ordered;

                if (!force) {
                    return {
                        success: false,
                        error: `Exceeds delivered quantity on PO #${po?.po_number || ''} by ${diff}. (Ordered: ${ordered}, Already Received: ${currentReceived}).`,
                        exceeded: true,
                        status: 400,
                    };
                }

                if (!isAdminOrManager) {
                    return {
                        success: false,
                        error: `Exceeds delivered quantity on PO #${po?.po_number || ''}. Force stock-in requires Admin or Manager authorization.`,
                        status: 403,
                    };
                }
            }
        }

        // 4. Update inventory_items
        const newStock = (item.current_stock || 0) + quantity;
        const newStatus = calculateItemStatus(newStock, item.minimum_stock || 10);

        const inventoryUpdatePayload: Record<string, any> = {
            current_stock: newStock,
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        if (validUserUUID) {
            inventoryUpdatePayload.updated_by = validUserUUID;
        }

        if (force) {
            if (validUserUUID) {
                inventoryUpdatePayload.force_updated_by = validUserUUID;
            }
            inventoryUpdatePayload.force_updated_at = new Date().toISOString();
            inventoryUpdatePayload.force_reason = force_reason || 'Manual override during stock-in';
        }

        let { error: updateInvError } = await supabase
            .from('inventory_items')
            .update(inventoryUpdatePayload)
            .eq('id', inventory_item_id);

        // If auth.users FK constraint fails (23503), retry update without FK fields
        if (updateInvError && (updateInvError as any).code === '23503') {
            delete inventoryUpdatePayload.updated_by;
            delete inventoryUpdatePayload.force_updated_by;
            const retryRes = await supabase
                .from('inventory_items')
                .update(inventoryUpdatePayload)
                .eq('id', inventory_item_id);
            updateInvError = retryRes.error;
        }

        if (updateInvError) {
            console.error('Error updating inventory item:', updateInvError);
            return { success: false, error: `Failed to update inventory stock level: ${updateInvError.message}`, status: 500 };
        }

        // Log administrative override to user_activity
        if (force && validUserUUID) {
            try {
                await supabase.from('user_activity').insert({
                    user_id: validUserUUID,
                    action: 'INVENTORY_STOCK_OVERRIDE',
                    module: 'Inventory',
                    description: `Manual administrative override during stock-in for item "${item.item_name}" (SKU: ${item.sku || item.item_code || 'N/A'}). Quantity added: +${quantity} (New stock: ${newStock}). Reason: ${force_reason || 'Manual override'}`,
                    created_at: new Date().toISOString(),
                });
            } catch (uaErr) {
                console.warn('Could not log user_activity for inventory override:', uaErr);
            }
        }

        // 5. Update purchase_order_items & stock_in_logs if PO item exists
        if (poi) {
            const newQtyReceived = (poi.quantity_received || 0) + quantity;

            const { error: poiUpdateError } = await supabase
                .from('purchase_order_items')
                .update({
                    quantity_received: newQtyReceived,
                    stocked_in_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', poi.id);

            if (poiUpdateError) {
                console.error('Error updating purchase_order_items:', poiUpdateError);
            }

            // Insert into stock_in_logs
            const logPayload: Record<string, any> = {
                purchase_order_item_id: poi.id,
                inventory_item_id: item.id,
                quantity_added: quantity,
                exceeded_limit: exceededLimit,
                forced: force,
            };

            if (validUserUUID) {
                logPayload.performed_by = validUserUUID;
                if (force) {
                    logPayload.forced_by = validUserUUID;
                }
            }

            let { error: logError } = await supabase
                .from('stock_in_logs')
                .insert([logPayload]);

            // If auth.users FK fails on stock_in_logs (23503), retry without performed_by/forced_by
            if (logError && (logError as any).code === '23503') {
                delete logPayload.performed_by;
                delete logPayload.forced_by;
                const retryLog = await supabase
                    .from('stock_in_logs')
                    .insert([logPayload]);
                logError = retryLog.error;
            }

            if (logError) {
                console.warn('Warning: Could not write to stock_in_logs:', logError);
            }

            // Check if all line items on this PO are now fully received
            const poId = poi.purchase_order_id;
            if (poId) {
                const { data: allPoi } = await supabase
                    .from('purchase_order_items')
                    .select('id, quantity_ordered, quantity_received')
                    .eq('purchase_order_id', poId);

                const isAllReceived = allPoi && allPoi.length > 0 && allPoi.every(
                    (p: any) => (p.quantity_received || 0) >= (p.quantity_ordered || 0)
                );

                if (isAllReceived) {
                    await supabase
                        .from('purchase_orders')
                        .update({ fully_received: true })
                        .eq('id', poId);
                }
            }
        }

        revalidatePath('/inventory');
        return {
            success: true,
            data: {
                item_name: item.item_name,
                previous_stock: item.current_stock,
                new_stock: newStock,
                quantity_added: quantity,
                po_number: poi?.purchase_orders?.po_number || reference || null,
            },
        };
    } catch (err: any) {
        console.error('Server error in stockInItemAction:', err);
        return { success: false, error: err?.message || 'An unexpected error occurred during stock-in', status: 500 };
    }
}
