// app/(supplyChain)/(pages)/inventory/server/actions/purchase-request.ts
'use server';

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { revalidatePath } from 'next/cache';

export interface CreateScopedPRParams {
    inventory_item_id: string | number;
    item_name: string;
    quantity: number;
    unit_price?: number;
    supplier_id: string;
    supplier_name?: string;
    requested_by: string;
    department?: string;
    priority?: string;
    reason?: string;
}

export async function createScopedPurchaseRequestAction(params: CreateScopedPRParams) {
    try {
        const {
            inventory_item_id,
            item_name,
            quantity,
            unit_price = 0,
            supplier_id,
            requested_by,
            department = 'Warehouse',
            priority = 'Normal',
            reason = 'Inventory replenishment',
        } = params;

        if (!inventory_item_id || !item_name) {
            return { success: false, error: 'Inventory item is required', status: 400 };
        }

        if (!quantity || quantity <= 0) {
            return { success: false, error: 'Quantity must be greater than 0', status: 400 };
        }

        if (!supplier_id) {
            return { success: false, error: 'Supplier is required', status: 400 };
        }

        // Fetch supplier name if not provided
        let finalSupplierName = params.supplier_name || '';
        if (!finalSupplierName) {
            const { data: sup } = await supabase
                .from('suppliers')
                .select('name')
                .eq('id', supplier_id)
                .single();
            finalSupplierName = sup?.name || 'Unknown Supplier';
        }

        const requestNumber = `PR-${Date.now().toString().slice(-6)}`;
        const totalAmount = quantity * unit_price;

        // Structured JSONB line items embedding inventory_item_id
        const itemsPayload = [
            {
                inventory_item_id: Number(inventory_item_id),
                item_name: item_name,
                name: item_name,
                quantity: quantity,
                unit_price: unit_price,
                total: totalAmount,
            },
        ];

        const prData = {
            request_number: requestNumber,
            type: 'Inventory Replenishment',
            description: `${item_name} (${quantity})`,
            requested_by: requested_by || 'Inventory Manager',
            department: department,
            supplier_id: String(supplier_id),
            supplier_name: finalSupplierName,
            amount: totalAmount,
            priority: priority,
            date: new Date().toISOString().split('T')[0],
            status: 'Pending',
            items: itemsPayload,
            reason: reason,
        };

        const { data, error } = await supabase
            .from('purchase_requests')
            .insert([prData])
            .select()
            .single();

        if (error) {
            console.error('Error inserting purchase_request:', error);
            return { success: false, error: error.message || 'Failed to create Purchase Request' };
        }

        revalidatePath('/inventory');
        revalidatePath('/procurement');

        return {
            success: true,
            data: {
                id: data.id,
                request_number: requestNumber,
                item_name,
                quantity,
                supplier_name: finalSupplierName,
            },
        };
    } catch (err: any) {
        console.error('Server error in createScopedPurchaseRequestAction:', err);
        return { success: false, error: err?.message || 'Unexpected server error' };
    }
}
