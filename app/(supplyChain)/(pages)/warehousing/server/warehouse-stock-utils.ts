// app/(supplyChain)/(pages)/warehousing/server/warehouse-stock-utils.ts

/**
 * Helper to match an item from a requisition with the warehouse inventory catalog.
 */
export function matchInventoryItem(item: any, inventoryItems: any[]): any | null {
    if (!item || !Array.isArray(inventoryItems) || inventoryItems.length === 0) return null;

    const catItemId = item.catalog_item_id || item.item_id || item.inventory_items_id || item.id;
    const itemCode = (item.item_code || item.code || "").trim().toLowerCase();
    const itemName = (item.item_name || item.name || "").trim().toLowerCase();

    // 1. Direct ID match
    if (catItemId) {
        const byId = inventoryItems.find((inv) => String(inv.id) === String(catItemId));
        if (byId) return byId;
    }

    // 2. Exact item_code match
    if (itemCode) {
        const byCode = inventoryItems.find(
            (inv) => inv.item_code && String(inv.item_code).trim().toLowerCase() === itemCode
        );
        if (byCode) return byCode;
    }

    // 3. Exact item_name match
    if (itemName) {
        const byName = inventoryItems.find(
            (inv) => inv.item_name && String(inv.item_name).trim().toLowerCase() === itemName
        );
        if (byName) return byName;
    }

    // 4. Substring / partial name match
    if (itemName) {
        const bySub = inventoryItems.find(
            (inv) =>
                inv.item_name &&
                (String(inv.item_name).trim().toLowerCase().includes(itemName) ||
                    itemName.includes(String(inv.item_name).trim().toLowerCase()))
        );
        if (bySub) return bySub;
    }

    return null;
}

/**
 * Calculates live warehouse stock availability for a single requisition item.
 */
export function getItemAvailableStock(item: any, inventoryItems: any[]): {
    matchedItem: any | null;
    inStock: number;
    availableToIssue: number;
    remainingDeficit: number;
} {
    const matched = matchInventoryItem(item, inventoryItems);
    const inStock = Number(matched?.current_stock) || 0;
    const reqQty = Number(item.quantity || item.quantity_requested) || 1;
    const prevIssued = Number(item.issued_quantity) || 0;
    const remainingDeficit = item.deficit_quantity !== undefined
        ? Number(item.deficit_quantity)
        : Math.max(0, reqQty - prevIssued);

    const isItemCompleted =
        item.is_released === true ||
        item.is_issued === true ||
        item.status === "Delivered" ||
        item.status === "Released";

    // If item is already 100% issued/released with no remaining deficit
    if (isItemCompleted && remainingDeficit === 0) {
        return { matchedItem: matched, inStock, availableToIssue: 0, remainingDeficit: 0 };
    }

    const targetQty = remainingDeficit > 0 ? remainingDeficit : reqQty;

    let availableToIssue = 0;
    if (matched) {
        // Bound by actual physical inventory stock on hand
        availableToIssue = Math.min(inStock, targetQty);
    } else {
        // If not in catalog, fallback to item.available_quantity if specified, bounded by targetQty
        const fallback = Number(item.available_quantity) || 0;
        availableToIssue = Math.min(fallback, targetQty);
    }

    return {
        matchedItem: matched,
        inStock,
        availableToIssue: Math.max(0, availableToIssue),
        remainingDeficit,
    };
}

/**
 * Evaluates whether an approved requisition has available warehouse stock to be issued.
 * Returns true if at least one approved item has units available to issue (availableToIssue > 0).
 */
export function checkRequestHasAvailableStock(req: any, inventoryItems: any[]): boolean {
    if (!req) return false;

    const rawItems = Array.isArray(req.items)
        ? req.items
        : typeof req.items === "string"
        ? JSON.parse(req.items || "[]")
        : [];

    if (rawItems.length === 0) {
        const avail = Number(req.available_quantity || 0);
        return avail > 0;
    }

    // Check if at least one active/approved item has stock available to issue
    return rawItems.some((item: any) => {
        // Skip explicitly rejected items
        if (item.status === "Rejected" || item.is_rejected === true) return false;

        const { availableToIssue } = getItemAvailableStock(item, inventoryItems);
        return availableToIssue > 0;
    });
}
