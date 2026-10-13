// app/(supplyChain)/ai/lib/action-registry.ts

import {
    getLowStockItems,
    getOutOfStockItems,
    getInventorySummary,
    getInventory,
    getInventoryItems,
    getStockMovements,
    getStockMovementsSummary,
    getSuppliers,
    getSuppliersSummary,
    getPurchaseOrders,
    getPurchaseOrdersSummary,
    getPendingPurchaseRequests,
    getDamageIncidents,
    getSupplierReturns,
    getDamageAndReturnsSummary,
    getUserActivityLogs,
    getUserActivitySummary,
    getSupplierQuotations,
    getSupplierMeetings,
    getQuotationsAndMeetingsSummary,
    getDocumentVerifications,
    getDocumentVerificationsSummary,
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

    const actionsToRegister: Record<string, { fn: Function; description: string; keywords: string[] }> = {
        // Inventory & Low Stock
        'get_low_stock': {
            fn: getLowStockItems,
            description: 'Get low stock items below minimum threshold',
            keywords: ['low stock', 'stock', 'inventory', 'low', 'threshold', 'depleted']
        },
        'get_low_stock_items': {
            fn: getLowStockItems,
            description: 'Get low stock items list',
            keywords: ['low stock items', 'reorder needed', 'restock list']
        },
        'get_out_of_stock_items': {
            fn: getOutOfStockItems,
            description: 'Get completely out-of-stock items (zero balance)',
            keywords: ['out of stock', 'zero stock', 'no stock', 'empty stock']
        },
        'get_inventory': {
            fn: getInventory,
            description: 'Get inventory summary metrics and categories',
            keywords: ['inventory', 'items', 'total items', 'catalog']
        },
        'get_inventory_summary': {
            fn: getInventorySummary,
            description: 'Get high-level inventory totals, item counts, and status breakdown',
            keywords: ['inventory summary', 'stock health', 'total inventory']
        },
        'get_inventory_items': {
            fn: getInventoryItems,
            description: 'Get catalogued inventory items',
            keywords: ['inventory items', 'all items', 'sku list', 'skus']
        },

        // Stock Movements & Audit Trail
        'get_stock_movements': {
            fn: getStockMovements,
            description: 'Get chronological stock movement history (Stock In, Stock Out, Adjustments)',
            keywords: ['stock movements', 'stock movement', 'stock in', 'stock out', 'adjustment', 'movement log', 'transfers']
        },
        'get_stock_movements_summary': {
            fn: getStockMovementsSummary,
            description: 'Get aggregated stock movements summary by type, department, and volume',
            keywords: ['stock movement summary', 'movement metrics', 'warehouse transfers', 'consumption by department']
        },

        // Suppliers
        'get_suppliers': {
            fn: getSuppliers,
            description: 'Get approved supplier directory and vendor details',
            keywords: ['supplier', 'suppliers', 'vendor', 'vendors', 'contractor', 'partner']
        },
        'get_suppliers_summary': {
            fn: getSuppliersSummary,
            description: 'Get supplier counts, active statuses, and category distribution',
            keywords: ['supplier summary', 'supplier count', 'how many suppliers', 'active suppliers']
        },

        // Purchase Orders & Requests
        'get_purchase_orders': {
            fn: getPurchaseOrders,
            description: 'Get purchase orders, total amounts, statuses, and delivery schedules',
            keywords: ['purchase order', 'purchase orders', 'po', 'pos', 'orders', 'spent', 'expense']
        },
        'get_purchase_orders_summary': {
            fn: getPurchaseOrdersSummary,
            description: 'Get purchase orders aggregate metrics, totals, spend, and status breakdown',
            keywords: ['po summary', 'purchase order summary', 'total spend', 'po metrics', 'procurement spend']
        },
        'get_pending_purchase_requests': {
            fn: getPendingPurchaseRequests,
            description: 'Get purchase requests that do not have a purchase order yet',
            keywords: ['create purchase order', 'create po', 'generate po', 'pending request', 'purchase request without po', 'unfulfilled request', 'convert request']
        },

        // Warehouse Damages, Defects & Supplier Returns
        'get_damage_incidents': {
            fn: getDamageIncidents,
            description: 'Get warehouse damage incident reports, defect types, severity, and estimated loss',
            keywords: ['damage incident', 'damage reports', 'warehouse damage', 'damaged items', 'broken', 'defect', 'incident']
        },
        'get_supplier_returns': {
            fn: getSupplierReturns,
            description: 'Get supplier return requests, replacement claims, defective quantities, and finance status',
            keywords: ['supplier return', 'return request', 'return to vendor', 'defective goods', 'replacement claim', 'rma']
        },
        'get_damage_and_returns_summary': {
            fn: getDamageAndReturnsSummary,
            description: 'Get aggregated financial loss, open damage incidents, and supplier return metrics',
            keywords: ['damage summary', 'defect summary', 'return summary', 'estimated loss', 'total damage loss', 'defect rate']
        },

        // User Activity, Sessions & Security
        'get_user_activity_logs': {
            fn: getUserActivityLogs,
            description: 'Get audit logs of user actions across supply chain modules',
            keywords: ['user activity', 'activity log', 'audit log', 'system events', 'user logs', 'who changed']
        },
        'get_user_activity_summary': {
            fn: getUserActivitySummary,
            description: 'Get security audit summary, active sessions count, blocked devices, and pending appeals',
            keywords: ['user activity summary', 'active sessions', 'blocked devices', 'security summary', 'appeals count']
        },

        // Supplier Quotations & Meetings
        'get_supplier_quotations': {
            fn: getSupplierQuotations,
            description: 'Get vendor quotations, pricing bids, unit costs, and lead times for purchase requests',
            keywords: ['quotation', 'quotations', 'quote', 'quotes', 'vendor bid', 'price quote', 'bids']
        },
        'get_supplier_meetings': {
            fn: getSupplierMeetings,
            description: 'Get scheduled vendor meetings, video conferences, agendas, and negotiation sessions',
            keywords: ['supplier meeting', 'vendor meeting', 'scheduled meeting', 'supplier call', 'conference']
        },
        'get_quotations_and_meetings_summary': {
            fn: getQuotationsAndMeetingsSummary,
            description: 'Get summary metrics of vendor quotations and upcoming scheduled meetings',
            keywords: ['quotation summary', 'meetings summary', 'vendor negotiation', 'active quotes']
        },

        // Document Verifications & Gemini OCR Receipt Matching
        'get_document_verifications': {
            fn: getDocumentVerifications,
            description: 'Get document verifications and Gemini OCR receipt matching results against POs',
            keywords: ['document verification', 'ocr verification', 'receipt matching', 'mismatched receipts', 'matched receipts', 'forced verification']
        },
        'get_document_verifications_summary': {
            fn: getDocumentVerificationsSummary,
            description: 'Get summary of receipt audit verifications (matched, mismatched, pending, forced)',
            keywords: ['ocr summary', 'verification summary', 'receipt audit', 'matching accuracy']
        },
    };

    for (const [name, config] of Object.entries(actionsToRegister)) {
        if (typeof config.fn === 'function') {
            actionRegistry.set(name, {
                fn: config.fn,
                description: config.description,
                keywords: config.keywords,
            });
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

    // Damage & Defects & Returns
    if (lowerQuery.includes('damage') ||
        lowerQuery.includes('defect') ||
        lowerQuery.includes('broken') ||
        lowerQuery.includes('loss') ||
        lowerQuery.includes('return') ||
        lowerQuery.includes('replacement')) {
        detected.push('get_damage_and_returns_summary');
        if (lowerQuery.includes('incident') || lowerQuery.includes('report')) {
            detected.push('get_damage_incidents');
        }
        if (lowerQuery.includes('return') || lowerQuery.includes('rma') || lowerQuery.includes('vendor return')) {
            detected.push('get_supplier_returns');
        }
    }

    // Stock Movements & Adjustments
    if (lowerQuery.includes('stock movement') ||
        lowerQuery.includes('stock movements') ||
        lowerQuery.includes('stock in') ||
        lowerQuery.includes('stock out') ||
        lowerQuery.includes('adjustment') ||
        lowerQuery.includes('transfer')) {
        detected.push('get_stock_movements_summary');
        detected.push('get_stock_movements');
    }

    // Low stock & Inventory
    if (lowerQuery.includes('low stock') ||
        lowerQuery.includes('low-stock') ||
        (lowerQuery.includes('stock') && lowerQuery.includes('low'))) {
        detected.push('get_low_stock');
    }

    if (lowerQuery.includes('out of stock') ||
        lowerQuery.includes('zero stock') ||
        lowerQuery.includes('empty stock')) {
        detected.push('get_out_of_stock_items');
    }

    if (lowerQuery.includes('inventory') ||
        lowerQuery.includes('items') ||
        lowerQuery.includes('sku')) {
        if (!detected.includes('get_inventory')) {
            detected.push('get_inventory');
        }
        if (!detected.includes('get_low_stock')) {
            detected.push('get_low_stock');
        }
    }

    // Suppliers & Vendors
    if (lowerQuery.includes('supplier') ||
        lowerQuery.includes('vendor') ||
        lowerQuery.includes('contractor') ||
        lowerQuery.includes('partner')) {
        if (lowerQuery.includes('quote') || lowerQuery.includes('quotation') || lowerQuery.includes('bid')) {
            detected.push('get_supplier_quotations');
        } else if (lowerQuery.includes('meeting') || lowerQuery.includes('call') || lowerQuery.includes('conference')) {
            detected.push('get_supplier_meetings');
        } else {
            detected.push('get_suppliers_summary');
            detected.push('get_suppliers');
        }
    }

    // Quotations / Bids
    if (lowerQuery.includes('quotation') || lowerQuery.includes('quote') || lowerQuery.includes('bid')) {
        detected.push('get_supplier_quotations');
    }

    // Purchase Requests & Purchase Orders
    if (lowerQuery.includes('create purchase order') ||
        lowerQuery.includes('create po') ||
        lowerQuery.includes('generate po') ||
        lowerQuery.includes('request without po') ||
        lowerQuery.includes('pending request') ||
        lowerQuery.includes('no purchase order')) {
        detected.push('get_pending_purchase_requests');
    } else if (lowerQuery.includes('purchase order') ||
        lowerQuery.includes('purchase orders') ||
        lowerQuery.includes('po ') ||
        lowerQuery.includes('spend') ||
        lowerQuery.includes('procurement spend')) {
        detected.push('get_purchase_orders_summary');
    }

    // Document Verifications & Receipt OCR
    if (lowerQuery.includes('ocr') ||
        lowerQuery.includes('receipt') ||
        lowerQuery.includes('verification') ||
        lowerQuery.includes('mismatch') ||
        lowerQuery.includes('matched')) {
        detected.push('get_document_verifications_summary');
    }

    // User Activity & Security
    if (lowerQuery.includes('user activity') ||
        lowerQuery.includes('audit log') ||
        lowerQuery.includes('security') ||
        lowerQuery.includes('active session') ||
        lowerQuery.includes('blocked device') ||
        lowerQuery.includes('appeal')) {
        detected.push('get_user_activity_summary');
        detected.push('get_user_activity_logs');
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