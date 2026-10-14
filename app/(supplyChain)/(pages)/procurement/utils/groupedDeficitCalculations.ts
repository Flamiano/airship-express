import type { StockShortageItem, Supplier } from "../types/index.ts";

/**
 * Irregular or unchanging nouns ending in 's' that should not be stripped.
 */
const IRREGULAR_UNCHANGING_NOUNS = new Set([
    "gas",
    "bus",
    "lens",
    "status",
    "chassis",
    "series",
    "species",
    "canvas",
    "plus",
    "bias",
    "apparatus",
    "axis"
]);

/**
 * Normalizes item names:
 * - Trims leading and trailing whitespace
 * - Collapses internal whitespace/tabs into a single space
 * - Lowercases for case-insensitive matching
 */
export function normalizeItemName(name?: string | null): string {
    if (!name) return "";
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

/**
 * Converts simple plural forms to singular while preserving distinct product phrases.
 * E.g.:
 * - 'laptops' -> 'laptop'
 * - 'laptop' -> 'laptop'
 * - 'new items' -> 'new item'
 * - 'laptop stand' -> 'laptop stand' (last word 'stand' is unchanged)
 * - 'batteries' -> 'battery'
 * - 'boxes' -> 'box'
 */
export function toSingularForm(phrase?: string | null): string {
    const normalized = normalizeItemName(phrase);
    if (!normalized) return "";

    const words = normalized.split(" ");
    const lastWord = words[words.length - 1];

    if (IRREGULAR_UNCHANGING_NOUNS.has(lastWord)) {
        return normalized;
    }

    let singularLast = lastWord;

    if (lastWord.endsWith("ies") && lastWord.length > 4) {
        // e.g. batteries -> battery, supplies -> supply, accessories -> accessory
        singularLast = lastWord.slice(0, -3) + "y";
    } else if (
        (lastWord.endsWith("ses") && !lastWord.endsWith("sses")) ||
        lastWord.endsWith("xes") ||
        lastWord.endsWith("ches") ||
        lastWord.endsWith("shes")
    ) {
        // e.g. boxes -> box, watches -> watch, brushes -> brush
        singularLast = lastWord.slice(0, -2);
    } else if (lastWord.endsWith("sses")) {
        // e.g. glasses -> glass
        singularLast = lastWord.slice(0, -2);
    } else if (lastWord.endsWith("s") && !lastWord.endsWith("ss") && lastWord.length > 3) {
        // e.g. laptops -> laptop, monitors -> monitor, chairs -> chair, pens -> pen
        singularLast = lastWord.slice(0, -1);
    }

    words[words.length - 1] = singularLast;
    return words.join(" ");
}

/**
 * Returns a canonical grouping key for an item.
 * Prefers a stable catalog/item ID when available; otherwise uses normalized singular form.
 * Different products (e.g. 'Laptop' vs 'Laptop Stand') always have distinct keys!
 */
export function getCanonicalGroupKey(name?: string | null, catalogId?: string | number | null): string {
    const nameKey = toSingularForm(name);
    if (nameKey) return nameKey;
    if (catalogId && String(catalogId).trim()) {
        return `cat:${String(catalogId).trim().toLowerCase()}`;
    }
    return "";
}

export interface GroupedDeficitCalculationParams {
    inventoryItems: any[];
    requests: any[];
    purchaseOrders: any[];
    quotations?: any[];
    suppliers?: any[];
    onlyActionable?: boolean;
}

/**
 * Authoritative business calculation for grouped item deficits and remaining procurement quantities.
 *
 * Business Rules:
 * 1. Matching priority:
 *    - Stable inventory item ID or catalog relationship when available
 *    - Original request's item reference to the inventory item
 *    - Normalized singular item names when no reliable relationship exists
 * 2. Official Supplier & Minimum Stock:
 *    - If official supplier assigned: default minimum_stock = 10 (or explicitly configured value)
 *    - If no official supplier: minimum_stock = 0 (no replenishment buffer)
 * 3. Deficit calculation:
 *    - Unfulfilled approved demand only
 *    - Immediate shortage = max(0, approved demand - usable stock)
 *    - If stock is sufficient (usable stock >= demand), request stays in warehousing (deficit = 0)
 *    - If stock is insufficient, gross requirement = immediate shortage + (has official supplier ? min stock : 0)
 *    - Net deficit = max(0, gross requirement - active purchase order coverage)
 */
export function calculateGroupedStockShortages({
    inventoryItems = [],
    requests = [],
    purchaseOrders = [],
    quotations = [],
    suppliers = [],
    onlyActionable = false,
}: GroupedDeficitCalculationParams): StockShortageItem[] {
    // 1. Index usable stock and baseline inventory data by canonical key and identifiers
    const inventoryMap = new Map<string, {
        invRecord: any;
        usableStock: number;
        defectiveStock: number;
        minStock: number;
        configuredMinStock: number;
        officialSupplierId: number | string | null;
        supplierName: string | null;
        price: number;
        category: string;
        storageLocation: string;
        itemCode: string;
        displayName: string;
        unit: string;
    }>();

    inventoryItems.forEach((inv: any) => {
        const canonicalKey = toSingularForm(inv.item_name || inv.name);
        if (!canonicalKey) return;

        const current = Math.max(0, Number(inv.current_stock || 0));
        const defective = Math.max(0, Number(inv.defective_quantity || inv.damaged_stock || inv.quarantined_stock || 0));
        const usable = Math.max(0, current - defective);
        const configuredMin = Number(inv.minimum_stock ?? 0);
        const officialSupId = inv.official_supplier_id ?? null;
        const supName = inv.supplier || inv.supplier_name || null;
        const price = Number(inv.purchase_price || inv.price || 0);

        const entry = {
            invRecord: inv,
            usableStock: usable,
            defectiveStock: defective,
            minStock: configuredMin,
            configuredMinStock: configuredMin,
            officialSupplierId: officialSupId,
            supplierName: supName,
            price: price,
            category: inv.category || "General",
            storageLocation: inv.storage_location || "Central Warehouse",
            itemCode: inv.item_code || `ITM-${inv.id}`,
            displayName: inv.item_name || inv.name || "Warehouse Item",
            unit: inv.unit || "units",
        };

        if (!inventoryMap.has(canonicalKey)) {
            inventoryMap.set(canonicalKey, entry);
        } else {
            const existing = inventoryMap.get(canonicalKey)!;
            existing.usableStock += usable;
            existing.defectiveStock += defective;
            if (configuredMin > 0 && existing.configuredMinStock === 0) {
                existing.configuredMinStock = configuredMin;
                existing.minStock = configuredMin;
            }
            if (officialSupId && !existing.officialSupplierId) {
                existing.officialSupplierId = officialSupId;
            }
            if (supName && !existing.supplierName) {
                existing.supplierName = supName;
            }
            if (price > 0 && existing.price === 0) existing.price = price;
        }

        if (inv.catalog_item_id) {
            inventoryMap.set(`cat:${String(inv.catalog_item_id).toLowerCase().trim()}`, entry);
        }
        if (inv.item_code) {
            inventoryMap.set(`code:${String(inv.item_code).toLowerCase().trim()}`, entry);
        }
    });

    // 2. Track Active vs. Delivered / Dead Purchase Orders
    // Delivered POs have already been stocked into usable warehouse inventory!
    // Active POs (pending / issued / confirmed) cover demand without double counting.
    // Rejected / Cancelled POs do NOT cover demand.
    const activePoCoverageMap = new Map<string, {
        activeCoverageQty: number;
        deliveredCoverageQty: number;
        totalCoverageQty: number;
        orders: Array<{
            id: string;
            po_number: string;
            supplier_name?: string;
            quantity: number;
            covered_quantity?: number;
            status: string;
            admin_approval?: string;
            created_at?: string;
        }>;
    }>();

    const deliveredReqCoverageMap = new Map<string, number>();
    const awardedBidMap = new Map<string, { supplierName?: string; poNumber?: string }>();

    purchaseOrders.forEach((po: any) => {
        const poSt = String(po.status || "").trim().toLowerCase();
        const adminApp = String(po.admin_approval || "").trim().toLowerCase();
        const poNum = String(po.po_number || "");

        // Exclude rejected and cancelled POs from covering demand
        if (poSt === "rejected" || adminApp === "rejected" || poSt === "cancelled") {
            return;
        }

        // Exclude unawarded draft POs (sourcing drafts that are not awarded or approved)
        if ((poSt === "draft" || poSt.startsWith("draft")) && adminApp !== "approved" && !po.suppliers_qoutation_bid) {
            return;
        }

        const isDeliveredOrFullyReceived =
            poSt === "delivered" ||
            poSt === "completed" ||
            poSt === "received" ||
            poSt === "fulfilled" ||
            adminApp === "delivered" ||
            po.fully_received === true;

        // In-progress or Delivered POs (Pending, Issued, Sent, Confirmed, Delivered)
        let poItemsList: any[] = [];
        if (Array.isArray(po.items)) {
            poItemsList = po.items;
        } else if (typeof po.items === "string") {
            try {
                poItemsList = JSON.parse(po.items);
            } catch {
                poItemsList = [];
            }
        }

        // Fallback: If po.items is empty, synthesize from notes or item_name
        if (poItemsList.length === 0 && (po.item_name || po.notes)) {
            let extractedName = po.item_name || "";
            if (!extractedName && po.notes) {
                const match = po.notes.match(/\(([^)]+)\)/);
                if (match && match[1]) extractedName = match[1].trim();
            }
            if (extractedName) {
                poItemsList = [{
                    name: extractedName,
                    item_name: extractedName,
                    quantity_ordered: 1,
                    quantity: 1,
                }];
            }
        }

        const poReqId = po.request_id ? String(po.request_id).trim().toLowerCase() : "";
        let poReqNum = "";
        if (po.notes) {
            const match = po.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
            if (match && match[1]) poReqNum = match[1].trim().toLowerCase();
        }

        poItemsList.forEach((it: any) => {
            const itName = it.name || it.item_name;
            if (!itName) return;

            const canonicalKey = getCanonicalGroupKey(itName);
            const orderedQty = Number(it.quantity_ordered ?? it.quantity ?? 1);
            const receivedQty = Number(it.quantity_received || 0);

            // Coverage calculation:
            // Item coverage is the quantity ordered / received under this PO
            const itemCoverageQty = Math.max(orderedQty, receivedQty, 1);
            const activeInProgressQty = isDeliveredOrFullyReceived ? 0 : Math.max(0, orderedQty - receivedQty);
            const deliveredQty = isDeliveredOrFullyReceived ? itemCoverageQty : 0;

            if (isDeliveredOrFullyReceived) {
                if (poReqId) {
                    const k1 = `${poReqId}__${canonicalKey}`;
                    deliveredReqCoverageMap.set(k1, (deliveredReqCoverageMap.get(k1) || 0) + itemCoverageQty);
                    deliveredReqCoverageMap.set(poReqId, (deliveredReqCoverageMap.get(poReqId) || 0) + itemCoverageQty);
                }
                if (poReqNum) {
                    const k2 = `${poReqNum}__${canonicalKey}`;
                    deliveredReqCoverageMap.set(k2, (deliveredReqCoverageMap.get(k2) || 0) + itemCoverageQty);
                    deliveredReqCoverageMap.set(poReqNum, (deliveredReqCoverageMap.get(poReqNum) || 0) + itemCoverageQty);
                }
            }

            if (!activePoCoverageMap.has(canonicalKey)) {
                activePoCoverageMap.set(canonicalKey, {
                    activeCoverageQty: 0,
                    deliveredCoverageQty: 0,
                    totalCoverageQty: 0,
                    orders: [],
                });
            }

            const entry = activePoCoverageMap.get(canonicalKey)!;
            entry.activeCoverageQty += activeInProgressQty;
            entry.deliveredCoverageQty += deliveredQty;
            entry.totalCoverageQty += itemCoverageQty;

            entry.orders.push({
                id: String(po.id),
                po_number: poNum || `PO-${po.id}`,
                supplier_name: po.supplier_name || "Assigned Supplier",
                quantity: itemCoverageQty,
                covered_quantity: isDeliveredOrFullyReceived ? 0 : itemCoverageQty,
                status: po.status || (isDeliveredOrFullyReceived ? "Delivered" : "Pending"),
                admin_approval: po.admin_approval || "Pending",
                created_at: po.created_at,
            });

            // Map awarded bid info
            if (po.supplier_name && !awardedBidMap.has(canonicalKey)) {
                awardedBidMap.set(canonicalKey, {
                    supplierName: po.supplier_name,
                    poNumber: poNum || `PO-${po.id}`,
                });
            }
        });
    });

    // 3. Process Approved Requests:
    // Only approved requests should contribute to the approved demand quantity!
    interface GroupAccumulator {
        canonicalKey: string;
        representativeName: string;
        category: string;
        unit: string;
        totalApprovedDemand: number;
        relatedRequests: Array<{
            id: string;
            request_number: string;
            department?: string;
            requested_by?: string;
            quantity: number;
            status: string;
            item_name: string;
            created_at?: string;
        }>;
        requestIds: Set<string>;
        sourceDepartments: Set<string>;
        sourceRequestNumbers: Set<string>;
        isNewItem: boolean;
        sampleItemId?: string;
    }

    const groupMap = new Map<string, GroupAccumulator>();

    requests.forEach((req: any) => {
        const reqSt = String(req.status || "").trim().toLowerCase();
        // Exclude cancelled, rejected, delivered, completed, fulfilled requests
        if (
            reqSt === "cancelled" ||
            reqSt === "rejected" ||
            reqSt === "delivered" ||
            reqSt === "completed" ||
            reqSt === "fulfilled"
        ) {
            return;
        }

        let itemsList: any[] = [];
        if (Array.isArray(req.items)) {
            itemsList = req.items;
        } else if (typeof req.items === "string") {
            try {
                itemsList = JSON.parse(req.items);
            } catch {
                itemsList = [];
            }
        }

        // Fallback to top-level request item fields if items array is empty
        if (itemsList.length === 0 && (req.item_name || req.name || req.description)) {
            const qtyReq = Number(req.quantity_requested || req.quantity || 1);
            itemsList = [{
                name: req.item_name || req.name || req.description,
                item_name: req.item_name || req.name || req.description,
                quantity: qtyReq,
                quantity_requested: qtyReq,
                unit: req.unit || "units",
                category: req.category || req.department || "General",
                status: req.status || "Approved",
                is_approved: reqSt === "approved" || reqSt.includes("approved") || reqSt === "partially released",
            }];
        }

        itemsList.forEach((it: any) => {
            const rawItemName = String(it.name || it.item_name || "").trim();
            if (!rawItemName) return;

            const itemSt = String(it.status || "").trim().toLowerCase();
            // Item must not be rejected or cancelled
            if (itemSt === "rejected" || itemSt === "cancelled") return;

            // Must be approved: either item explicitly marked approved, or overall request approved
            const isApproved =
                it.is_approved === true ||
                it.is_approve === true ||
                itemSt === "approved" ||
                ((reqSt === "approved" || reqSt.includes("approved") || reqSt === "partially released") && itemSt !== "rejected");

            // Critical rule: only approved requests should contribute to the approved demand quantity!
            if (!isApproved) {
                return;
            }

            const rawReqId = String(req.id || "").trim().toLowerCase();
            const rawReqNum = String(req.request_number || "").trim().toLowerCase();
            const canonicalKey = getCanonicalGroupKey(rawItemName, it.catalog_item_id || it.id);

            const deliveredByPoForReq =
                (rawReqId && deliveredReqCoverageMap.get(`${rawReqId}__${canonicalKey}`)) ||
                (rawReqNum && deliveredReqCoverageMap.get(`${rawReqNum}__${canonicalKey}`)) ||
                (rawReqId && deliveredReqCoverageMap.get(rawReqId)) ||
                (rawReqNum && deliveredReqCoverageMap.get(rawReqNum)) ||
                0;

            const requestedQty = Number(it.quantity || it.quantity_requested || 1);
            const issuedQty = Number(it.issued_quantity || 0);

            // Exclude fulfilled / delivered items
            const isFulfilled =
                itemSt === "delivered" ||
                itemSt === "released" ||
                it.is_delivered === true ||
                it.is_released === true ||
                it.is_issued === true ||
                (deliveredByPoForReq >= requestedQty && requestedQty > 0);

            const outstandingQty = isFulfilled ? 0 : Math.max(0, requestedQty - issuedQty - deliveredByPoForReq);

            const refNum = req.request_number || `REQ-${String(req.id).slice(0, 8)}`;

            if (!groupMap.has(canonicalKey)) {
                // Select a polished representative name (preserve title case or inventory name if available)
                const invEntry = inventoryMap.get(canonicalKey);
                const reprName = invEntry?.displayName || rawItemName;

                groupMap.set(canonicalKey, {
                    canonicalKey,
                    representativeName: reprName,
                    category: it.category || req.category || req.department || invEntry?.category || "General",
                    unit: it.unit || req.unit || invEntry?.unit || "units",
                    totalApprovedDemand: 0,
                    relatedRequests: [],
                    requestIds: new Set<string>(),
                    sourceDepartments: new Set<string>(),
                    sourceRequestNumbers: new Set<string>(),
                    isNewItem: Boolean(it.is_new_item || (!it.catalog_item_id && !invEntry)),
                    sampleItemId: it.catalog_item_id || it.id,
                });
            }

            const group = groupMap.get(canonicalKey)!;
            group.totalApprovedDemand += outstandingQty;
            group.requestIds.add(String(req.id));
            if (req.department) group.sourceDepartments.add(req.department);
            if (refNum) group.sourceRequestNumbers.add(refNum);

            group.relatedRequests.push({
                id: String(req.id),
                request_number: refNum,
                department: req.department || "Warehouse",
                requested_by: req.requested_by || req.requester_name || "Department Staff",
                quantity: isFulfilled ? requestedQty : outstandingQty,
                status: isFulfilled ? "Delivered" : (it.status || req.status || "Approved"),
                item_name: rawItemName, // Preserve original casing/spelling for traceability!
                created_at: req.created_at,
            });
        });
    });

    // Pre-populate groupMap for any PO items that have active or delivered coverage
    activePoCoverageMap.forEach((entry, canonicalKey) => {
        if (canonicalKey.startsWith("cat:") || canonicalKey.startsWith("code:")) return;
        if (!groupMap.has(canonicalKey)) {
            const invEntry = inventoryMap.get(canonicalKey);
            const reprName = invEntry?.displayName || (canonicalKey.charAt(0).toUpperCase() + canonicalKey.slice(1));
            groupMap.set(canonicalKey, {
                canonicalKey,
                representativeName: reprName,
                category: invEntry?.category || "General",
                unit: invEntry?.unit || "units",
                totalApprovedDemand: 0,
                relatedRequests: [],
                requestIds: new Set<string>(),
                sourceDepartments: new Set<string>(),
                sourceRequestNumbers: new Set<string>(),
                isNewItem: false,
                sampleItemId: undefined,
            });
        }
    });

    // 4. Also include warehouse stock shortages that have NO active requisitions but are below safety threshold
    inventoryMap.forEach((invData, canonicalKey) => {
        // Skip alias keys (code: and cat:) to avoid generating duplicate shortage rows
        if (canonicalKey.startsWith("cat:") || canonicalKey.startsWith("code:")) {
            return;
        }

        if (!groupMap.has(canonicalKey)) {
            const bufferDeficit = Math.max(0, invData.minStock - invData.usableStock);
            const isShortage = invData.usableStock === 0 || invData.usableStock < invData.minStock;

            if (isShortage && bufferDeficit > 0) {
                groupMap.set(canonicalKey, {
                    canonicalKey,
                    representativeName: invData.displayName,
                    category: invData.category,
                    unit: invData.unit,
                    totalApprovedDemand: 0, // No requisition demand; purely safety buffer deficit
                    relatedRequests: [],
                    requestIds: new Set<string>(),
                    sourceDepartments: new Set<string>(["Warehouse"]),
                    sourceRequestNumbers: new Set<string>(),
                    isNewItem: false,
                    sampleItemId: invData.invRecord?.id,
                });
            }
        }
    });

    // 5. Final calculation and aggregation of each consolidated row
    const resultRows: StockShortageItem[] = [];
    const seenItemCodes = new Set<string>();

    groupMap.forEach((group, canonicalKey) => {
        if (canonicalKey.startsWith("cat:") || canonicalKey.startsWith("code:")) return;
        const invData = inventoryMap.get(canonicalKey);
        const usableStock = invData ? invData.usableStock : 0;

        // Resolve official supplier by official_supplier_id foreign key
        let officialSupplier: any = null;
        let hasOfficialSupplier = false;
        const officialSupplierId = invData?.officialSupplierId ?? null;

        if (officialSupplierId && Array.isArray(suppliers) && suppliers.length > 0) {
            officialSupplier = suppliers.find((s: any) => 
                String(s.id) === String(officialSupplierId) && 
                (s.is_active === undefined || s.is_active === true || s.is_active === "true") &&
                (s.status || "").toLowerCase() !== "inactive"
            ) || null;
            if (officialSupplier) {
                hasOfficialSupplier = true;
            }
        }

        // Section 5 Rules:
        // No official supplier: minimum_stock = 0.
        // Official supplier assigned: default minimum_stock = 10 (or explicitly configured value > 0).
        let effectiveMinStock = 0;
        if (hasOfficialSupplier) {
            effectiveMinStock = (invData?.configuredMinStock && invData.configuredMinStock > 0)
                ? invData.configuredMinStock
                : 10;
        } else {
            effectiveMinStock = 0;
        }

        const poCoverageEntry = activePoCoverageMap.get(canonicalKey);
        const activePoCoverage = poCoverageEntry ? poCoverageEntry.activeCoverageQty : 0;
        const totalCoveredQty = poCoverageEntry ? poCoverageEntry.totalCoverageQty : 0;
        const coveringOrders = poCoverageEntry ? poCoverageEntry.orders : [];

        // Calculate Deficits from Outstanding Demand (Section 4):
        // 1. Usable stock accounts for reservations/deliveries already in inventory.
        // 2. Active POs cover demand on the way without double counting.
        // 3. Delivered POs already stocked into usableStock do not subtract again.
        const totalApprovedDemand = group.totalApprovedDemand;
        const immediateShortage = Math.max(0, totalApprovedDemand - usableStock);

        let grossRequirement = 0;
        let replenishmentBuffer = 0;

        if (totalApprovedDemand > 0) {
            if (usableStock >= totalApprovedDemand) {
                // Scenario B: Usable stock is sufficient! Request stays in warehousing, no immediate procurement deficit.
                grossRequirement = 0;
                replenishmentBuffer = 0;
            } else {
                // Scenario C / D: Immediate shortage exists
                // Scenario C: official supplier assigned -> add minStock buffer (10)
                // Scenario D: no official supplier -> buffer is 0
                replenishmentBuffer = hasOfficialSupplier ? effectiveMinStock : 0;
                grossRequirement = immediateShortage + replenishmentBuffer;
            }
        } else {
            // No demand: pure safety stock replenishment (Scenario B post-issue or low-stock item)
            if (hasOfficialSupplier && usableStock < effectiveMinStock) {
                replenishmentBuffer = Math.max(0, effectiveMinStock - usableStock);
                grossRequirement = replenishmentBuffer;
            } else {
                grossRequirement = 0;
                replenishmentBuffer = 0;
            }
        }

        // Net deficit after accounting for active purchase order coverage
        const remainingDeficit = Math.max(0, grossRequirement - activePoCoverage);

        // If onlyActionable is requested, skip items where deficit is 0
        if (onlyActionable && remainingDeficit === 0) {
            return;
        }

        // Determine authoritative PO status indicator:
        let poStatusIndicator: 'Pending Purchase Order' | 'Waiting for Delivery' | 'Rejected Purchase Order' | 'Delivered' | 'Approval Pending' | null = null;
        let matchingPoNumber: string | null = null;
        let matchingPoId: string | null = null;

        if (coveringOrders.length > 0) {
            const latestPo = coveringOrders[coveringOrders.length - 1];
            matchingPoNumber = latestPo.po_number;
            matchingPoId = latestPo.id;

            const st = String(latestPo.status || "").trim().toLowerCase();
            const adm = String(latestPo.admin_approval || "").trim().toLowerCase();
            if (st === "delivered" || st === "completed") {
                poStatusIndicator = remainingDeficit === 0 ? "Delivered" : null;
            } else if (st === "rejected" || adm === "rejected") {
                poStatusIndicator = "Rejected Purchase Order";
            } else if (st === "issued") {
                poStatusIndicator = "Waiting for Delivery";
            } else if (st === "pending" || adm === "pending") {
                poStatusIndicator = "Approval Pending";
            } else {
                poStatusIndicator = "Approval Pending";
            }
        }

        const awardInfo = awardedBidMap.get(canonicalKey);
        const isBidAwarded = Boolean(awardInfo);

        // Price estimation: If no official supplier assigned, price is 0 (will be enriched if previous supplier exists)
        const unitPrice = hasOfficialSupplier ? Number(invData?.price || 0) : 0;
        const estimatedReorderCost = (remainingDeficit > 0 ? remainingDeficit : 0) * unitPrice;

        const sourceReqString = group.sourceRequestNumbers.size > 0 
            ? Array.from(group.sourceRequestNumbers).join(", ") 
            : "";
        const sourceDeptString = group.sourceDepartments.size > 0 
            ? Array.from(group.sourceDepartments).join(", ") 
            : (invData ? "Warehouse Safety Buffer" : "Department Staff");

        const primaryReqId = group.requestIds.size > 0 
            ? Array.from(group.requestIds)[0] 
            : undefined;

        // Alternative / candidate suppliers for discovery:
        const categoryKey = group.category.trim().toLowerCase();
        const matchingCategorySuppliers = suppliers.filter((s: any) => {
            if (!s || !s.category) return false;
            const isActive = s.is_active === undefined || s.is_active === true || s.is_active === "true";
            const isNotInactive = (s.status || "").toLowerCase() !== "inactive";
            const sCat = s.category.trim().toLowerCase();
            return isActive && isNotInactive && (sCat.includes(categoryKey) || categoryKey.includes(sCat) || sCat === "all" || sCat === "general");
        });

        const activeSupplierNames = hasOfficialSupplier 
            ? [officialSupplier.name] 
            : matchingCategorySuppliers.map((s: any) => s.name || s.company_name).filter(Boolean);

        const rowItem: StockShortageItem = {
            id: `grouped_${canonicalKey}`,
            item_code: invData?.itemCode || `GRP-${canonicalKey.slice(0, 8).toUpperCase()}`,
            item_name: group.representativeName,
            category: group.category,
            current_stock: usableStock,
            unit: group.unit,
            minimum_stock: effectiveMinStock,
            storage_location: invData?.storageLocation || "Central Warehouse",
            status: usableStock === 0 ? "out-of-stock" : "low-stock",
            updated_at: new Date().toISOString(),
            purchase_price: unitPrice,
            // Deficit represents the actual remaining uncovered quantity!
            deficit: remainingDeficit,
            remaining_deficit: remainingDeficit,
            immediate_shortage: immediateShortage,
            replenishment_buffer: replenishmentBuffer,
            official_supplier_id: officialSupplierId,
            estimated_reorder_cost: estimatedReorderCost,
            source_request: sourceReqString,
            source_department: sourceDeptString,
            is_new_item: group.isNewItem,
            is_from_request: group.totalApprovedDemand > 0,
            available_ratio: `${usableStock}/${group.totalApprovedDemand || effectiveMinStock || 1}`,
            request_id: primaryReqId,
            is_bid_awarded: isBidAwarded && remainingDeficit === 0,
            awarded_supplier_name: awardInfo?.supplierName,
            awarded_po_number: awardInfo?.poNumber,
            po_status_indicator: poStatusIndicator,
            matching_po_number: matchingPoNumber,
            matching_po_id: matchingPoId,
            has_official_active_supplier: hasOfficialSupplier,
            active_supplier_count: hasOfficialSupplier ? 1 : matchingCategorySuppliers.length,
            active_supplier_names: activeSupplierNames,
            matched_active_supplier: officialSupplier || null,

            // Grouped demand and deficit tracking properties
            normalized_item_key: canonicalKey,
            total_approved_demand: group.totalApprovedDemand,
            usable_stock: usableStock,
            active_po_coverage: activePoCoverage,
            covered_quantity: activePoCoverage,
            related_requests_count: group.relatedRequests.length,
            related_requests: group.relatedRequests,
            covering_purchase_orders: coveringOrders,
        };

        const codeKey = String(rowItem.item_code || "").trim().toLowerCase();
        const nameKey = String(rowItem.item_name || "").trim().toLowerCase();
        const dedupeKey = codeKey ? `code:${codeKey}` : `name:${nameKey}`;
        if (seenItemCodes.has(dedupeKey)) return;
        seenItemCodes.add(dedupeKey);

        resultRows.push(rowItem);
    });

    // Sort: items with uncovered deficits first, then by remaining deficit descending
    resultRows.sort((a, b) => {
        const defA = a.remaining_deficit ?? a.deficit ?? 0;
        const defB = b.remaining_deficit ?? b.deficit ?? 0;
        if (defA > 0 && defB === 0) return -1;
        if (defB > 0 && defA === 0) return 1;
        return defB - defA;
    });

    return resultRows;
}
