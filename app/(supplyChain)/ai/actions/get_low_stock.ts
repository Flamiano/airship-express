// app/(supplyChain)/ai/actions/get_low_stock.ts

import { supabase } from "../../lib/services/client/supabase";

export interface LowStockItem {
    id: number;
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
    current_stock: number;
    minimum_stock: number;
    storage_location: string | null;
    supplier: string | null;
    supplier_id?: string | number | null;
    supplier_name?: string | null;
    supplier_email?: string | null;
    supplier_contact?: string | null;
    purchase_price?: number;
    suggested_quantity: number;
    stock_type: 'out_of_stock' | 'low_stock';
    status: string;
}

/**
 * Helper to fetch and build supplier lookup map
 */
async function getSupplierMap(): Promise<Map<string, any>> {
    const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, email, contact_person, is_active');

    const map = new Map<string, any>();
    if (suppliers) {
        suppliers.forEach((s: any) => {
            map.set(String(s.id), s);
            if (s.name) {
                map.set(s.name.toLowerCase().trim(), s);
            }
        });
    }
    return map;
}

/**
 * Get all items with low stock or out of stock (current_stock <= minimum_stock)
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
    const [itemsRes, supplierMap] = await Promise.all([
        supabase
            .from('inventory_items')
            .select('*')
            .eq('is_active', true),
        getSupplierMap(),
    ]);

    if (itemsRes.error) {
        throw new Error(`Failed to fetch inventory items: ${itemsRes.error.message}`);
    }

    const data = itemsRes.data;
    if (!data || data.length === 0) {
        return [];
    }

    const filtered = data.filter((item: any) => {
        const currentStock = Number(item.current_stock) || 0;
        const minimumStock = Number(item.minimum_stock) || 0;
        return currentStock <= minimumStock;
    });

    const lowStockItems: LowStockItem[] = filtered.map((item: any) => {
        const currentStock = Number(item.current_stock) || 0;
        const minimumStock = Number(item.minimum_stock) || 0;
        const rawSupplier = item.supplier ? String(item.supplier).trim() : null;

        let matchedSupplier = null;
        if (rawSupplier) {
            matchedSupplier = supplierMap.get(rawSupplier) || supplierMap.get(rawSupplier.toLowerCase());
        }

        const suggestedQty = currentStock === 0
            ? Math.max(10, minimumStock * 2 || 20)
            : Math.max(5, (minimumStock * 2) - currentStock);

        return {
            id: item.id,
            item_code: item.item_code || `ITEM-${item.id}`,
            item_name: item.item_name || 'Unnamed Item',
            category: item.category || 'General',
            unit: item.unit || 'pcs',
            current_stock: currentStock,
            minimum_stock: minimumStock,
            storage_location: item.storage_location || null,
            supplier: rawSupplier,
            supplier_id: matchedSupplier?.id || (item.supplier_id ? item.supplier_id : null),
            supplier_name: matchedSupplier?.name || rawSupplier || 'Default Supplier',
            supplier_email: matchedSupplier?.email || null,
            supplier_contact: matchedSupplier?.contact_person || null,
            purchase_price: Number(item.purchase_price) || Number(item.unit_price) || 0,
            suggested_quantity: suggestedQty,
            stock_type: currentStock === 0 ? 'out_of_stock' : 'low_stock',
            status: item.status || (currentStock === 0 ? 'Out of Stock' : 'Low Stock'),
        };
    });

    // Sort by current_stock ascending (0/out of stock first)
    lowStockItems.sort((a, b) => a.current_stock - b.current_stock);

    return lowStockItems;
}

/**
 * Get items that are strictly out of stock (current_stock === 0)
 */
export async function getOutOfStockItems(): Promise<LowStockItem[]> {
    const allLow = await getLowStockItems();
    return allLow.filter(it => it.current_stock === 0);
}

/**
 * Get inventory summary
 */
export async function getInventorySummary(): Promise<{
    totalItems: number;
    lowStockCount: number;
    outOfStockCount: number;
    availableCount: number;
    byCategory: Record<string, number>;
}> {
    const { data: items, error } = await supabase
        .from('inventory_items')
        .select('status, category, current_stock, minimum_stock')
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch inventory summary: ${error.message}`);
    }

    const inventoryItems = items || [];
    const totalItems = inventoryItems.length;

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let availableCount = 0;

    inventoryItems.forEach((item: any) => {
        const currentStock = Number(item.current_stock) || 0;
        const minimumStock = Number(item.minimum_stock) || 0;

        if (currentStock === 0) {
            outOfStockCount++;
        } else if (currentStock <= minimumStock) {
            lowStockCount++;
        } else {
            availableCount++;
        }
    });

    const byCategory: Record<string, number> = {};
    inventoryItems.forEach((item: any) => {
        const category = item.category || 'Uncategorized';
        byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
        totalItems,
        lowStockCount,
        outOfStockCount,
        availableCount,
        byCategory,
    };
}

export const getLowStock = getLowStockItems;
export const getInventorySummaryData = getInventorySummary;