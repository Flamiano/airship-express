// app/(supplyChain)/ai/lib/action-registry.ts

import {
    getParcels,
    getParcelStats,
    getTodayParcels,
    getLowStockItems,
    getOutOfStockItems,
    getInventorySummary,
    getInventory,
    getInventoryItems,
    getReceivingQueue,
    getReceivingQueueSummary,
    getSuppliers,
    getSuppliersSummary,
    getPurchaseOrders,
    getPurchaseOrdersSummary,
} from '../actions';

// Registry to store all actions
const actionRegistry = new Map<string, {
    fn: Function;
    description: string;
    keywords: string[];
}>();

let isRegistered = false;

/**
 * Register all actions statically with direct imports
 */
export function registerAllActions(): void {
    if (isRegistered) {
        return;
    }


    // DIRECT REGISTRATION with imported functions
    const actionsToRegister: Record<string, { fn: Function; description: string; keywords: string[] }> = {
        'get_parcels': {
            fn: getParcels,
            description: 'Get parcels data',
            keywords: ['parcel', 'parcels', 'shipment', 'shipments']
        },
        'get_parcel_stats': {
            fn: getParcelStats,
            description: 'Get parcel statistics',
            keywords: ['statistics', 'stats', 'count', 'today']
        },
        'get_today_parcels': {
            fn: getTodayParcels,
            description: 'Get today\'s parcels',
            keywords: ['today', 'parcels', 'received']
        },
        'get_low_stock': {
            fn: getLowStockItems,
            description: 'Get low stock items',
            keywords: ['low stock', 'stock', 'inventory', 'low']
        },
        'get_low_stock_items': {
            fn: getLowStockItems,
            description: 'Get low stock items',
            keywords: ['low stock', 'stock', 'inventory', 'low']
        },
        'get_out_of_stock_items': {
            fn: getOutOfStockItems,
            description: 'Get out of stock items',
            keywords: ['out of stock', 'zero stock', 'no stock']
        },
        'get_inventory': {
            fn: getInventory,
            description: 'Get inventory summary',
            keywords: ['inventory', 'items', 'total']
        },
        'get_inventory_summary': {
            fn: getInventorySummary,
            description: 'Get inventory summary',
            keywords: ['inventory', 'summary', 'total']
        },
        'get_inventory_items': {
            fn: getInventoryItems,
            description: 'Get inventory items',
            keywords: ['inventory', 'items', 'all items']
        },

        'get_receiving_queue': {
            fn: getReceivingQueue,
            description: 'Get receiving queue',
            keywords: ['receiving', 'queue']
        },
        'get_receiving_queue_summary': {
            fn: getReceivingQueueSummary,
            description: 'Get receiving queue summary',
            keywords: ['receiving', 'queue', 'summary']
        },
        'get_suppliers': {
            fn: getSuppliers,
            description: 'Get suppliers list and details',
            keywords: ['supplier', 'suppliers', 'vendor', 'vendors', 'contractor', 'partner']
        },
        'get_suppliers_summary': {
            fn: getSuppliersSummary,
            description: 'Get supplier counts and category breakdown',
            keywords: ['supplier summary', 'supplier count', 'how many suppliers', 'active suppliers']
        },
        'get_purchase_orders': {
            fn: getPurchaseOrders,
            description: 'Get purchase orders and details',
            keywords: ['purchase order', 'purchase orders', 'po', 'pos', 'orders', 'spent', 'expense']
        },
        'get_purchase_orders_summary': {
            fn: getPurchaseOrdersSummary,
            description: 'Get purchase orders aggregate metrics, totals, spend, and status breakdown',
            keywords: ['po summary', 'purchase order summary', 'total spend', 'po metrics', 'procurement spend']
        },
    };

    let registeredCount = 0;
    for (const [name, config] of Object.entries(actionsToRegister)) {
        if (typeof config.fn === 'function') {
            actionRegistry.set(name, {
                fn: config.fn,
                description: config.description,
                keywords: config.keywords,
            });
            registeredCount++;
        } else {
        }
    }

    isRegistered = true;
}

/**
 * Execute an action by name
 */
export async function executeAction(actionName: string, query: string): Promise<any> {
    const action = actionRegistry.get(actionName);
    if (!action) {
        throw new Error(`Unknown action: ${actionName}`);
    }

    try {
        const result = await action.fn(query);
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * Get all registered action names
 */
export function getRegisteredActions(): string[] {
    return Array.from(actionRegistry.keys());
}

/**
 * Get action descriptions for the classifier (dynamic)
 */
export function getActionDescriptions(): string {
    const descriptions: string[] = [];

    for (const [name, action] of actionRegistry) {
        descriptions.push(`- ${name}: Get ${action.description}`);
    }

    return descriptions.join('\n');
}

/**
 * Auto-detect which actions to execute based on the query
 */
export function detectActions(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const detected: string[] = [];

    if (lowerQuery.includes('low stock') ||
        lowerQuery.includes('low-stock') ||
        (lowerQuery.includes('stock') && lowerQuery.includes('low'))) {
        detected.push('get_low_stock');
    }

    if (lowerQuery.includes('inventory') ||
        lowerQuery.includes('stock') ||
        lowerQuery.includes('items')) {
        if (!detected.includes('get_inventory')) {
            detected.push('get_inventory');
        }
        if (!detected.includes('get_low_stock')) {
            detected.push('get_low_stock');
        }
    }

    if (lowerQuery.includes('parcel') ||
        lowerQuery.includes('parcels') ||
        lowerQuery.includes('shipment')) {
        detected.push('get_parcels');
    }

    if (lowerQuery.includes('courier') ||
        lowerQuery.includes('performance')) {
        detected.push('get_courier_performance');
    }

    if (lowerQuery.includes('receiving') ||
        lowerQuery.includes('queue')) {
        detected.push('get_receiving_queue');
    }

    if (lowerQuery.includes('supplier') ||
        lowerQuery.includes('vendors')) {
        detected.push('get_suppliers');
    }

    return [...new Set(detected)];
}

/**
 * Execute all matching actions for a query
 */
export async function executeMatchingActions(query: string): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const matchedActions = detectActions(query);


    if (matchedActions.length === 0) {
        return results;
    }

    for (const actionName of matchedActions) {
        try {
            const result = await executeAction(actionName, query);
            results[actionName] = result;
        } catch (error) {
            results[actionName] = { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    return results;
}