// app/(supplyChain)/(pages)/purchase-orders/server/actions/delivery-inventory.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { logStockMovement } from '../../../inventory/server/stock-movements';

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

export interface DeliveryItemResult {
    itemName: string;
    action: 'updated' | 'created';
    itemId: string | number;
    itemCode: string;
    supplier: string;
    quantityAdded: number;
    previousStock: number;
    newStock: number;
}

export interface DeliveryProcessingResult {
    success: boolean;
    poId: string;
    poNumber: string;
    updatedCount: number;
    createdCount: number;
    items: DeliveryItemResult[];
    error?: string;
}

export interface ProcessDeliveredPOsResponse {
    success: boolean;
    results: DeliveryProcessingResult[];
    summary: {
        totalOrders: number;
        totalUpdated: number;
        totalCreated: number;
    };
    error?: string;
}

const normalize = (val?: string | null): string => (val || '').toLowerCase().trim();

function isSameSupplier(s1?: string | null, s2?: string | null): boolean {
    const a = normalize(s1);
    const b = normalize(s2);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

function parseOrderItems(rawItems: any): any[] {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
        try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [];
        }
    }
    if (typeof rawItems === 'object') return [rawItems];
    return [];
}

function generateUniqueItemCode(name: string, supplier: string, existingCodes: Set<string>): string {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'ITEM';
    const cleanSupp = supplier.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'SUP';

    for (let i = 0; i < 50; i++) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const candidate = `SKU-${cleanName}-${cleanSupp}-${rand}`;
        if (!existingCodes.has(candidate.toLowerCase())) {
            existingCodes.add(candidate.toLowerCase());
            return candidate;
        }
    }

    const fallback = `SKU-${cleanName}-${Date.now().toString().slice(-6)}`;
    existingCodes.add(fallback.toLowerCase());
    return fallback;
}

/**
 * Processes delivered purchase orders:
 * For each item in the order:
 * 1. If an inventory item with the same name exists from the SAME supplier:
 *    - Update quantity (+ ordered qty)
 *    - Log Stock In movement
 * 2. If the item is from a DIFFERENT supplier or does not exist:
 *    - Create a new inventory item record with this supplier and quantity
 *    - Log Stock In movement
 * Also updates PO status to 'Delivered' and fully_received to true.
 */
export interface ProcessDeliveredOptions {
    storageLocation?: string;
    deliveryReceiptNumber?: string;
    invoiceNumber?: string;
    notes?: string;
    condition?: string;
    customQuantities?: Record<string, number>;
}

export async function processDeliveredPurchaseOrdersAction(
    poIds: string[],
    performer?: { name?: string; role?: string; id?: string },
    options?: ProcessDeliveredOptions
): Promise<ProcessDeliveredPOsResponse> {
    try {
        if (!poIds || poIds.length === 0) {
            return {
                success: false,
                results: [],
                summary: { totalOrders: 0, totalUpdated: 0, totalCreated: 0 },
                error: 'No purchase order IDs provided',
            };
        }

        // 1. Fetch Purchase Orders
        const { data: orders, error: poError } = await dbClient
            .from('purchase_orders')
            .select('*')
            .in('id', poIds);

        if (poError || !orders || orders.length === 0) {
            return {
                success: false,
                results: [],
                summary: { totalOrders: 0, totalUpdated: 0, totalCreated: 0 },
                error: poError?.message || 'Purchase orders not found',
            };
        }

        // 2. Fetch all existing inventory items and valid warehouse storage zones
        const [{ data: invData, error: invError }, { data: zonesData }] = await Promise.all([
            dbClient.from('inventory_items').select('*'),
            dbClient.from('warehouse_storage_zones').select('zone_code')
        ]);

        if (invError) {
            return {
                success: false,
                results: [],
                summary: { totalOrders: 0, totalUpdated: 0, totalCreated: 0 },
                error: invError.message || 'Failed to fetch inventory items',
            };
        }

        const validZoneCodes = new Set(
            (zonesData || []).map((z: any) => String(z.zone_code || '').toUpperCase().trim())
        );
        const defaultZoneCode = zonesData && zonesData.length > 0 ? zonesData[0].zone_code : null;

        const allInventory: any[] = invData || [];
        const existingCodes = new Set(
            allInventory.map((i: any) => String(i.item_code || '').toLowerCase().trim())
        );

        const results: DeliveryProcessingResult[] = [];
        let grandTotalUpdated = 0;
        let grandTotalCreated = 0;
        let lastDbError: string | null = null;

        for (const order of orders) {
            const poResult: DeliveryProcessingResult = {
                success: true,
                poId: order.id,
                poNumber: order.po_number || order.id.slice(0, 8),
                updatedCount: 0,
                createdCount: 0,
                items: [],
            };

            // Parse items list from PO
            let orderItems = parseOrderItems(order.items);

            // Fallback: check purchase_order_items table if order.items is empty
            if (orderItems.length === 0) {
                const { data: poiItems } = await dbClient
                    .from('purchase_order_items')
                    .select('*')
                    .eq('purchase_order_id', order.id);

                if (poiItems && poiItems.length > 0) {
                    orderItems = poiItems.map((pi: any) => ({
                        item_name: pi.item_name,
                        quantity: pi.quantity_ordered || 1,
                        quantity_received: pi.quantity_received || pi.quantity_ordered || 1,
                        unit_price: pi.unit_price || 0,
                    }));
                }
            }

            // If still no items, fallback to request description or single generic item
            if (orderItems.length === 0) {
                orderItems = [{
                    item_name: order.notes || 'Delivered Goods',
                    quantity: 1,
                    unit_price: order.total_amount || 0,
                }];
            }

            const poSupplier = (order.supplier_name || 'Supplier').trim();

            let itemIdx = 0;
            for (const item of orderItems) {
                const rawName = item.item_name || item.name || item.description || 'Inventory Item';
                const itemName = String(rawName).trim();
                const numReceived = Number(item.quantity_received);
                const defaultQty = (numReceived > 0)
                    ? numReceived
                    : (Number(item.quantity) || Number(item.quantity_ordered) || 1);
                
                // Determine item key for customQuantities mapping
                const key = item.id || `item-${itemIdx}`;
                let itemQty = defaultQty;
                if (options?.customQuantities) {
                    if (options.customQuantities[key] !== undefined) {
                        itemQty = Number(options.customQuantities[key]);
                    } else if (options.customQuantities[itemName] !== undefined) {
                        itemQty = Number(options.customQuantities[itemName]);
                    } else if (item.name && options.customQuantities[item.name] !== undefined) {
                        itemQty = Number(options.customQuantities[item.name]);
                    }
                }
                itemIdx++;

                if (itemQty <= 0) {
                    continue; // 0 received for this line item
                }

                const itemUnit = String(item.unit || item.uom || 'units').trim();
                const itemCategory = String(item.category || order.category || 'General').trim();
                const itemPrice = Math.max(0, Number(item.unit_price ?? item.price ?? 0));
                const itemSupplier = String(item.supplier || poSupplier).trim();
                // Validate target storage location to prevent foreign key constraint violations
                let targetStorageLocation: string | null = null;
                if (options?.storageLocation && validZoneCodes.has(options.storageLocation.toUpperCase().trim())) {
                    targetStorageLocation = options.storageLocation.trim();
                } else if (order.delivery_location && validZoneCodes.has(order.delivery_location.toUpperCase().trim())) {
                    targetStorageLocation = order.delivery_location.trim();
                } else {
                    targetStorageLocation = defaultZoneCode;
                }
                const refNumber = options?.deliveryReceiptNumber || options?.invoiceNumber || order.po_number;

                // Look for an existing inventory item with the same name AND same supplier
                const matchingItem = allInventory.find((inv: any) => {
                    if (normalize(inv.item_name) !== normalize(itemName)) return false;

                    // If existing inventory item has an assigned supplier, verify it matches
                    if (inv.supplier && inv.supplier.trim()) {
                        return isSameSupplier(inv.supplier, itemSupplier);
                    }

                    // If existing item has NO supplier assigned yet, treat it as matching and we will link this supplier
                    return true;
                });

                if (matchingItem) {
                    // --- CASE 1: MATCHING SUPPLIER ALREADY EXISTS -> UPDATE QUANTITY ---
                    const previousStock = Number(matchingItem.current_stock ?? 0);
                    const newStock = previousStock + itemQty;
                    const minStock = Number(matchingItem.minimum_stock ?? 10);
                    const newStatus = newStock <= 0 ? 'out-of-stock' : newStock < minStock ? 'low-stock' : 'available';

                    const updatePayload: Record<string, any> = {
                        current_stock: newStock,
                        status: newStatus,
                        updated_at: new Date().toISOString(),
                    };

                    // Only assign a valid storage location
                    if (targetStorageLocation) {
                        updatePayload.storage_location = targetStorageLocation;
                    } else if (matchingItem.storage_location && validZoneCodes.has(String(matchingItem.storage_location).toUpperCase().trim())) {
                        updatePayload.storage_location = matchingItem.storage_location;
                    }

                    // Backfill supplier if it was empty
                    if (!matchingItem.supplier || !matchingItem.supplier.trim()) {
                        updatePayload.supplier = itemSupplier;
                        matchingItem.supplier = itemSupplier;
                    }

                    // Update price if PO provides positive unit price
                    if (itemPrice > 0) {
                        updatePayload.purchase_price = itemPrice;
                        matchingItem.purchase_price = itemPrice;
                    }

                    const { error: updateErr } = await dbClient
                        .from('inventory_items')
                        .update(updatePayload)
                        .eq('id', matchingItem.id);

                    if (updateErr) {
                        console.error('Failed to update inventory item:', updateErr);
                        lastDbError = updateErr.message;
                    } else {
                        // Reflect in memory
                        matchingItem.current_stock = newStock;
                        matchingItem.status = newStatus;

                        // Log Stock Movement
                        await logStockMovement({
                            item_id: matchingItem.id,
                            item_code: matchingItem.item_code,
                            item_name: matchingItem.item_name,
                            movement_type: 'Stock In',
                            quantity: itemQty,
                            previous_stock: previousStock,
                            new_stock: newStock,
                            reference_number: refNumber,
                            reason: options?.notes || `Stock In from delivered PO #${order.po_number} (${itemSupplier})`,
                            notes: `Updated stock +${itemQty} (${itemSupplier}) | PO #${order.po_number}${options?.deliveryReceiptNumber ? ` | DR #${options.deliveryReceiptNumber}` : ''}`,
                            department: order.department || 'Warehouse / Procurement',
                            performed_by: performer?.name || 'Warehouse Staff',
                            performed_by_id: performer?.id || null,
                            metadata: {
                                po_id: order.id,
                                po_number: order.po_number,
                                dr_number: options?.deliveryReceiptNumber || null,
                                invoice_number: options?.invoiceNumber || null,
                                condition: options?.condition || null,
                                supplier: itemSupplier,
                                action: 'EXISTING_SUPPLIER_QUANTITY_UPDATE',
                            },
                        });

                        poResult.updatedCount++;
                        grandTotalUpdated++;
                        poResult.items.push({
                            itemName,
                            action: 'updated',
                            itemId: matchingItem.id,
                            itemCode: matchingItem.item_code,
                            supplier: itemSupplier,
                            quantityAdded: itemQty,
                            previousStock,
                            newStock,
                        });
                    }
                } else {
                    // --- CASE 2: DIFFERENT SUPPLIER OR BRAND NEW ITEM -> CREATE NEW INVENTORY ITEM ---
                    const newCode = generateUniqueItemCode(itemName, itemSupplier, existingCodes);
                    const minStock = 10;
                    const newStatus = itemQty <= 0 ? 'out-of-stock' : itemQty < minStock ? 'low-stock' : 'available';

                    const insertPayload = {
                        item_code: newCode,
                        item_name: itemName,
                        category: itemCategory,
                        unit: itemUnit,
                        current_stock: itemQty,
                        minimum_stock: minStock,
                        storage_location: targetStorageLocation,
                        supplier: itemSupplier,
                        purchase_price: itemPrice,
                        description: item.description || `Procured from ${itemSupplier} via PO #${order.po_number}`,
                        status: newStatus,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    const { data: createdItem, error: insertErr } = await dbClient
                        .from('inventory_items')
                        .insert([insertPayload])
                        .select()
                        .single();

                    if (insertErr || !createdItem) {
                        console.error('Failed to create new inventory item for supplier:', insertErr);
                        lastDbError = insertErr?.message || 'Failed to create new inventory item';
                    } else {
                        // Add to in-memory inventory pool
                        allInventory.push(createdItem);

                        // Log Stock Movement
                        await logStockMovement({
                            item_id: createdItem.id,
                            item_code: createdItem.item_code,
                            item_name: createdItem.item_name,
                            movement_type: 'Stock In',
                            quantity: itemQty,
                            previous_stock: 0,
                            new_stock: itemQty,
                            reference_number: refNumber,
                            reason: options?.notes || `New item created from delivered PO #${order.po_number} (${itemSupplier})`,
                            notes: `New item created +${itemQty} for supplier ${itemSupplier} | PO #${order.po_number}${options?.deliveryReceiptNumber ? ` | DR #${options.deliveryReceiptNumber}` : ''}`,
                            department: order.department || 'Warehouse / Procurement',
                            performed_by: performer?.name || 'Warehouse Staff',
                            performed_by_id: performer?.id || null,
                            metadata: {
                                po_id: order.id,
                                po_number: order.po_number,
                                dr_number: options?.deliveryReceiptNumber || null,
                                invoice_number: options?.invoiceNumber || null,
                                condition: options?.condition || null,
                                supplier: itemSupplier,
                                is_new_item: true,
                                action: 'NEW_SUPPLIER_ITEM_CREATED',
                            },
                        });

                        poResult.createdCount++;
                        grandTotalCreated++;
                        poResult.items.push({
                            itemName,
                            action: 'created',
                            itemId: createdItem.id,
                            itemCode: createdItem.item_code,
                            supplier: itemSupplier,
                            quantityAdded: itemQty,
                            previousStock: 0,
                            newStock: itemQty,
                        });
                    }
                }
            }

            // If zero items were successfully updated or created, don't mark PO delivered
            if (poResult.updatedCount === 0 && poResult.createdCount === 0 && orderItems.length > 0) {
                poResult.success = false;
                poResult.error = lastDbError || 'No inventory items could be updated or created in database.';
                results.push(poResult);
                continue;
            }

            // 3. Mark the Purchase Order as Delivered & Fully Received
            await dbClient
                .from('purchase_orders')
                .update({
                    status: 'Delivered',
                    fully_received: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

            // 4. Update the associated Purchase Request per-item
            // Mark matching items as Delivered while preserving remaining undelivered items
            try {
                let targetReqId = order.request_id;
                let targetReqNumber: string | null = null;
                if (!targetReqId && order.notes) {
                    const reqMatch = order.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                    if (reqMatch && reqMatch[1]) {
                        targetReqNumber = reqMatch[1].trim();
                    }
                }

                if (targetReqId || targetReqNumber) {
                    let reqQuery = dbClient.from('purchase_requests').select('*');
                    if (targetReqId) {
                        reqQuery = reqQuery.eq('id', targetReqId);
                    } else if (targetReqNumber) {
                        reqQuery = reqQuery.ilike('request_number', targetReqNumber);
                    }
                    const { data: prRows } = await reqQuery;

                    if (prRows && prRows.length > 0) {
                        const deliveredItemsInThisPO = parseOrderItems(order.items);
                        const deliveredItemNamesSet = new Set(
                            deliveredItemsInThisPO.map((it: any) => normalize(it.name || it.item_name))
                        );

                        for (const pr of prRows) {
                            const rawItems = Array.isArray(pr.items) ? pr.items : (typeof pr.items === 'string' ? JSON.parse(pr.items || '[]') : []);
                            
                            let hasUndeliveredApprovedItems = false;
                            const updatedPrItems = rawItems.map((prItem: any) => {
                                const prItemName = normalize(prItem.name || prItem.item_name);
                                const isItemApproved = prItem.is_approved === true || prItem.is_approve === true || prItem.status === 'Approved' || (pr.status === 'Approved' && prItem.status !== 'Rejected');
                                
                                if (deliveredItemNamesSet.has(prItemName)) {
                                    return {
                                        ...prItem,
                                        status: 'Delivered',
                                        is_delivered: true,
                                        quantity_remaining: 0,
                                        deficit_quantity: 0,
                                        delivered_at: new Date().toISOString(),
                                        delivered_po_number: order.po_number,
                                    };
                                } else {
                                    if (isItemApproved && prItem.status !== 'Delivered' && !prItem.is_delivered) {
                                        hasUndeliveredApprovedItems = true;
                                    }
                                    return prItem;
                                }
                            });

                            const newReqStatus = hasUndeliveredApprovedItems ? 'Approved' : 'Delivered';
                            await dbClient
                                .from('purchase_requests')
                                .update({
                                    status: newReqStatus,
                                    items: updatedPrItems,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', pr.id);
                        }
                    }
                }
            } catch (prUpdateErr) {
                console.warn('Note: Non-critical update of associated purchase request skipped:', prUpdateErr);
            }

            // 5. Also synchronize purchase_order_items records if present
            try {
                const { data: poiRecords } = await dbClient
                    .from('purchase_order_items')
                    .select('id, item_name, quantity_ordered')
                    .eq('purchase_order_id', order.id);

                if (poiRecords && poiRecords.length > 0) {
                    for (const poi of poiRecords) {
                        const matched = allInventory.find((i: any) => 
                            normalize(i.item_name) === normalize(poi.item_name) &&
                            (isSameSupplier(i.supplier, poSupplier) || !i.supplier)
                        );
                        if (matched) {
                            await dbClient
                                .from('purchase_order_items')
                                .update({
                                    inventory_item_id: matched.id,
                                    quantity_received: poi.quantity_ordered || 1,
                                    stocked_in_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', poi.id);
                        }
                    }
                }
            } catch (poiSyncErr) {
                console.warn('Note: Non-critical sync of purchase_order_items skipped:', poiSyncErr);
            }

            results.push(poResult);
        }

        // Revalidate Next.js cache so inventory, movements, procurement, warehousing, and PO tabs update instantly
        try {
            revalidatePath('/purchase-orders');
            revalidatePath('/inventory');
            revalidatePath('/procurement');
            revalidatePath('/warehousing');
        } catch (revErr) {
            console.warn('revalidatePath notice:', revErr);
        }

        if (grandTotalUpdated === 0 && grandTotalCreated === 0 && orders.length > 0) {
            return {
                success: false,
                results,
                summary: {
                    totalOrders: orders.length,
                    totalUpdated: 0,
                    totalCreated: 0,
                },
                error: lastDbError || 'No items could be added or updated in inventory. Please verify storage zone selection.',
            };
        }

        return {
            success: true,
            results,
            summary: {
                totalOrders: orders.length,
                totalUpdated: grandTotalUpdated,
                totalCreated: grandTotalCreated,
            },
        };
    } catch (err: any) {
        console.error('Error in processDeliveredPurchaseOrdersAction:', err);
        return {
            success: false,
            results: [],
            summary: { totalOrders: 0, totalUpdated: 0, totalCreated: 0 },
            error: err?.message || 'Unexpected error processing delivered purchase order',
        };
    }
}
