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
    status: string;
}

/**
 * Get all items with low stock (current_stock <= minimum_stock)
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {

    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch inventory items: ${error.message}`);
    }

    if (!data || data.length === 0) {
        return [];
    }


    const lowStockItems = data.filter((item: any) => {
        const currentStock = Number(item.current_stock) || 0;
        const minimumStock = Number(item.minimum_stock) || 0;
        return currentStock <= minimumStock;
    });


    lowStockItems.sort((a: any, b: any) => {
        return Number(a.current_stock) - Number(b.current_stock);
    });

    return lowStockItems;
}

/**
 * Get items that are out of stock
 */
export async function getOutOfStockItems(): Promise<LowStockItem[]> {

    const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch out of stock items: ${error.message}`);
    }

    if (!data || data.length === 0) {
        return [];
    }

    const outOfStockItems = data.filter((item: any) => {
        return Number(item.current_stock) === 0;
    });

    return outOfStockItems;
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