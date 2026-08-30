// app/(supplyChain)/ai/actions/get_inventory.ts

import { getLowStockItems, getInventorySummary } from './get_low_stock';

/**
 * Get inventory summary - alias for getInventorySummary
 */
export async function getInventory() {
    return await getInventorySummary();
}

/**
 * Get all inventory items with low stock
 */
export async function getInventoryItems() {
    return await getLowStockItems();
}

/**
 * Get inventory summary (alias)
 */
export async function getInventoryData() {
    return await getInventorySummary();
}