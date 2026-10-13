// app/(supplyChain)/(pages)/procurement/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { 
    Layers, 
    ArrowRight, 
    RefreshCw, 
    Sparkles, 
    Package, 
    HelpCircle,
    UserCheck
} from "lucide-react";
import { supabase } from "../../lib/services/client/supabase";
import { user } from "../../lib/services/Class/user";
import { useConfirm } from "../../components/ui/ConfirmModal";
import { SessionGuard } from "../../components/server/SessionGuard";
import { CardsSkeleton } from "../../components/ui/SkeletonLoader";
import AiQuestions from "../../components/global/AiQuestions";

// Procurement Stage Components
import { ProcurementLifecycleNav, ProcurementStageId } from "./components/ProcurementLifecycleNav";
import { StageStockShortages } from "./components/StageStockShortages";
import { StageFindPotentialSuppliers } from "./components/StageFindPotentialSuppliers";
import { PotentialSuppliersTab } from "../suppliers/components/tables/PotentialSuppliersTab";
import { StageSupplierReturns } from "./components/StageSupplierReturns";

// Modals
import { PurchaseOrderModal } from "../../components/modals/PurchaseOrderModal";
import { ChartDetailModal } from "../../components/modals/ChartDetailModal";
import { DigitalReceiptModal } from "../../components/modals/DigitalReceiptModal";
import { AddPotentialSupplierModal } from "../suppliers/components/modals/AddPotentialSupplierModal";
import { VendorQuotationViewModal } from "../suppliers/components/modals/VendorQuotationViewModal";
import { SupplierMessageModal } from "../suppliers/components/modals/SupplierMessageModal";

// Types
import { 
    PurchaseRequest, 
    StockShortageItem, 
    Supplier, 
    SupplierQuotationItem, 
    PurchaseOrder 
} from "./types/index";
import { 
    fetchProcurementData, 
} from "./utils/procurementApi";
import { fetchApprovedRequisitionsForProcurement } from "../inventory/server/query";

// Re-export modals for external imports
export { PurchaseOrderModal, ChartDetailModal, DigitalReceiptModal };

export default function ProcurementPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { confirm } = useConfirm();

    // Parse URL parameter to active stage
    const parseStageParam = (param: string | null): ProcurementStageId => {
        if (!param) return 1;
        const normalized = param.toLowerCase().trim();
        if (normalized === "1" || normalized === "requests" || normalized === "shortages") return 1;
        if (normalized === "2" || normalized === "suppliers" || normalized === "sourcing") return 2;
        if (normalized === "3" || normalized === "quotations" || normalized === "quotes" || normalized === "compare") return 3;
        if (normalized === "4" || normalized === "returns" || normalized === "supplier_returns" || normalized === "defective") return 4;
        return 1;
    };

    const [currentStage, setCurrentStage] = useState<ProcurementStageId>(() =>
        parseStageParam(searchParams.get("stage") || searchParams.get("tab"))
    );

    // Global loading and role state
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [userRole, setUserRole] = useState<string>(() => user.getRole() || "Admin");

    // Core Procurement Datasets
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [shortages, setShortages] = useState<StockShortageItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [quotations, setQuotations] = useState<SupplierQuotationItem[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [supplierReturnsCount, setSupplierReturnsCount] = useState<number>(0);

    // Workflow Inter-Stage Transfer State
    const [activeSourcingFocus, setActiveSourcingFocus] = useState<{
        itemName?: string;
        requestNumber?: string;
        category?: string;
        previousSupplier?: string | null;
    } | null>(null);

    const [selectedRequestNumberForQuotes, setSelectedRequestNumberForQuotes] = useState<string | null>(null);

    // Modal Visibility & Payloads

    const [isPOModalOpen, setIsPOModalOpen] = useState(false);
    const [selectedPOForModal, setSelectedPOForModal] = useState<PurchaseOrder | null>(null);
    const [poModalPrefillRequest, setPoModalPrefillRequest] = useState<any | null>(null);

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [receiptModalPO, setReceiptModalPO] = useState<any | null>(null);

    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);

    const [isQuoteViewModalOpen, setIsQuoteViewModalOpen] = useState(false);
    const [selectedQuoteForModal, setSelectedQuoteForModal] = useState<SupplierQuotationItem | null>(null);
    const [quoteModalSupplier, setQuoteModalSupplier] = useState<any | null>(null);

    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [selectedSupplierForMessage, setSelectedSupplierForMessage] = useState<any | null>(null);

    // Synchronize role changes
    useEffect(() => {
        const handleStorageChange = () => {
            const storedRole = user.getRole();
            if (storedRole) setUserRole(storedRole);
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const normalizedRole = (userRole || "").trim().toLowerCase();
    const canApproveReject = ["admin", "executive", "purchase officer"].includes(normalizedRole);
    const canCreateRequest = ["admin", "purchase officer", "executive", "supervisor"].includes(normalizedRole);

    // Master Fetch Data
    const loadAllProcurementData = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            else setIsRefreshing(true);

            // 1. Fetch Purchase Requests, Inventory, Quotes, and Approved Requests via Server Action
            const [procDataRes, inventoryRes, quotesRes, approvedReqsServerRes, returnsCountRes] = await Promise.allSettled([
                fetchProcurementData({
                    page: 1,
                    limit: 100,
                    includeOrders: true,
                    includeSuppliers: true,
                    tab: "all",
                }),
                supabase
                    .from("inventory_items")
                    .select("*")
                    .order("current_stock", { ascending: true }),
                supabase
                    .from("supplier_quotations")
                    .select("*")
                    .order("created_at", { ascending: false }),
                fetchApprovedRequisitionsForProcurement(),
                supabase
                    .from("supplier_return_requests")
                    .select("*", { count: "exact", head: true })
                    .neq("status", "Resolved"),
            ]);

            if (returnsCountRes.status === "fulfilled" && returnsCountRes.value?.count !== null && returnsCountRes.value?.count !== undefined) {
                setSupplierReturnsCount(returnsCountRes.value.count);
            } else {
                try {
                    const { count: incCount } = await supabase
                        .from("warehouse_damage_incidents")
                        .select("*", { count: "exact", head: true })
                        .neq("status", "Resolved");
                    if (incCount !== null && incCount !== undefined) setSupplierReturnsCount(incCount);
                } catch {}
            }

            // Consolidate Suppliers
            const allSuppliersList: any[] = [];
            if (procDataRes.status === "fulfilled" && procDataRes.value?.suppliers) {
                allSuppliersList.push(...procDataRes.value.suppliers);
            }
            if (approvedReqsServerRes.status === "fulfilled" && approvedReqsServerRes.value?.suppliers) {
                allSuppliersList.push(...approvedReqsServerRes.value.suppliers);
            }

            const seenSupIds = new Set<string>();
            const uniqueSuppliers = allSuppliersList.filter((s: any) => {
                const sid = String(s.id || s.name || "");
                if (!sid || seenSupIds.has(sid)) return false;
                seenSupIds.add(sid);
                return true;
            });
            setSuppliers(uniqueSuppliers);

            // Compute active supplier categories (normalized lowercase)
            const activeSupplierCategories = new Set<string>();
            uniqueSuppliers.forEach((s: any) => {
                const isActive = s.is_active === undefined || s.is_active === true || s.is_active === "true";
                const isNotInactive = (s.status || "").toLowerCase() !== "inactive";
                if (isActive && isNotInactive && s.category) {
                    activeSupplierCategories.add(String(s.category).trim().toLowerCase());
                }
            });
            if (approvedReqsServerRes.status === "fulfilled" && Array.isArray(approvedReqsServerRes.value?.activeCategories)) {
                approvedReqsServerRes.value.activeCategories.forEach((cat: string) => {
                    if (cat) activeSupplierCategories.add(cat.trim().toLowerCase());
                });
            }

            // Process Procurement Requests & Orders
            const rawOrdersList: any[] = (procDataRes.status === "fulfilled" && procDataRes.value?.purchaseOrders) ? procDataRes.value.purchaseOrders : [];
            const rawQuotesList: any[] = (quotesRes.status === "fulfilled" && quotesRes.value.data) ? (quotesRes.value.data as any[]) : [];

            if (procDataRes.status === "fulfilled" && procDataRes.value) {
                setRequests(procDataRes.value.requests || []);
                setPurchaseOrders(rawOrdersList);
            }

            // 1. Compute Delivered Orders & Delivered Items per-request
            // Once a PO becomes Delivered, only its specific items are marked delivered!
            const deliveredReqItemsSet = new Set<string>();
            const deliveredGlobalItemNames = new Set<string>();

            rawOrdersList.forEach((po: any) => {
                const poSt = (po.status || "").toLowerCase();
                if (poSt === "delivered" || po.fully_received === true) {
                    const reqId = po.request_id ? String(po.request_id).trim().toLowerCase() : "";
                    let reqNum = "";
                    if (po.notes) {
                        const match = po.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                        if (match && match[1]) {
                            reqNum = match[1].trim().toLowerCase();
                        }
                    }

                    if (Array.isArray(po.items)) {
                        po.items.forEach((it: any) => {
                            const itName = String(it.name || it.item_name || "").trim().toLowerCase();
                            if (itName) {
                                deliveredGlobalItemNames.add(itName);
                                if (reqId) {
                                    deliveredReqItemsSet.add(`${reqId}__${itName}`);
                                }
                                if (reqNum) {
                                    deliveredReqItemsSet.add(`${reqNum}__${itName}`);
                                    deliveredReqItemsSet.add(`${reqNum.replace(/[^a-z0-9]/g, "")}__${itName}`);
                                }
                            }
                        });
                    }
                }
            });

            // 2. Track Completed / Delivered / Cancelled / Rejected POs so they do NOT lock items in Stage 1
            const completedOrDeadPoReqNumbers = new Set<string>();
            const completedOrDeadPoItemKeys = new Set<string>();

            rawOrdersList.forEach((po: any) => {
                const poSt = (po.status || "").toLowerCase();
                const isCompletedOrDead = poSt === "delivered" || poSt === "completed" || poSt === "cancelled" || poSt === "rejected" || po.fully_received === true;
                if (isCompletedOrDead) {
                    if (po.request_id) completedOrDeadPoReqNumbers.add(String(po.request_id).trim().toLowerCase());
                    if (po.notes) {
                        const match = po.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                        if (match && match[1]) completedOrDeadPoReqNumbers.add(match[1].trim().toLowerCase());
                    }
                    if (Array.isArray(po.items)) {
                        po.items.forEach((it: any) => {
                            const itName = String(it.name || it.item_name || "").trim().toLowerCase();
                            if (itName) completedOrDeadPoItemKeys.add(itName);
                        });
                    }
                }
            });

            // Compute Awarded Bids Map (from active in-progress quotations & POs ONLY)
            const awardedBidMap = new Map<string, { supplierName?: string; poNumber?: string }>();

            rawQuotesList.forEach((q: any) => {
                const st = (q.status || "").toLowerCase();
                if (st.includes("accept") || st.includes("award") || st.includes("approve")) {
                    const qItem = String(q.item_name || "").trim().toLowerCase();
                    const qNum = String(q.request_number || "").trim().toLowerCase();
                    const qId = String(q.request_id || "").trim().toLowerCase();

                    // If this quote's requisition or item was delivered/completed/cancelled, DO NOT lock the item
                    if (qNum && completedOrDeadPoReqNumbers.has(qNum)) return;
                    if (qId && completedOrDeadPoReqNumbers.has(qId)) return;
                    if (qItem && completedOrDeadPoItemKeys.has(qItem)) return;

                    const info = { supplierName: q.supplier_name };
                    if (qItem) {
                        awardedBidMap.set(qItem, info);
                        if (qNum) {
                            awardedBidMap.set(`${qNum}__${qItem}`, info);
                            awardedBidMap.set(`${qNum.replace(/[^a-z0-9]/g, "")}__${qItem}`, info);
                        }
                        if (qId) {
                            awardedBidMap.set(`${qId}__${qItem}`, info);
                        }
                    } else if (qNum) {
                        awardedBidMap.set(qNum, info);
                        awardedBidMap.set(qNum.replace(/[^a-z0-9]/g, ""), info);
                    }
                }
            });

            rawOrdersList.forEach((po: any) => {
                const poSt = (po.status || "").toLowerCase();
                const poNum = String(po.po_number || "").toLowerCase();
                // Exclude draft POs as well as delivered, completed, cancelled, and rejected POs from locking/awarding items
                // Draft POs are merely in sourcing phase — only show awarded after awarding or approving the quotation/PO
                const isActiveInProgress = 
                    poSt !== "draft" && 
                    !poSt.includes("draft") && 
                    !poNum.includes("draft") &&
                    poSt !== "cancelled" && 
                    poSt !== "rejected" && 
                    poSt !== "delivered" && 
                    poSt !== "completed" && 
                    po.fully_received !== true;
                
                if (isActiveInProgress) {
                    const info = { supplierName: po.supplier_name, poNumber: po.po_number };
                    const poReqId = String(po.request_id || "").trim().toLowerCase();
                    
                    let poReqNum = "";
                    if (po.notes) {
                        const match = po.notes.match(/Requisition\s*#?([A-Za-z0-9-]+)/i);
                        if (match && match[1]) {
                            poReqNum = match[1].trim().toLowerCase();
                        }
                    }

                    if (Array.isArray(po.items) && po.items.length > 0) {
                        po.items.forEach((it: any) => {
                            const itName = String(it.name || it.item_name || "").trim().toLowerCase();
                            if (itName) {
                                awardedBidMap.set(itName, info);
                                if (poReqId) awardedBidMap.set(`${poReqId}__${itName}`, info);
                                if (poReqNum) awardedBidMap.set(`${poReqNum}__${itName}`, info);
                            }
                        });
                    } else {
                        if (poReqId) awardedBidMap.set(poReqId, info);
                        if (poReqNum) awardedBidMap.set(poReqNum, info);
                    }
                }
            });

            // 3. Compute Previous Supplier Map (from inventory items, historical POs, and quotes)
            const previousSupplierMap = new Map<string, { supplierName: string; supplierId?: string | number; email?: string; phone?: string; lastPurchaseDate?: string; unitPrice?: number }>();

            if (inventoryRes.status === "fulfilled" && inventoryRes.value.data) {
                inventoryRes.value.data.forEach((inv: any) => {
                    const itemKey = (inv.item_name || "").trim().toLowerCase();
                    const codeKey = (inv.item_code || "").trim().toLowerCase();
                    const supName = inv.supplier || inv.supplier_name || inv.vendor || inv.vendor_name;
                    if (supName) {
                        const entry = { 
                            supplierName: String(supName).trim(), 
                            unitPrice: Number(inv.purchase_price) || 0 
                        };
                        if (itemKey) previousSupplierMap.set(itemKey, entry);
                        if (codeKey) previousSupplierMap.set(codeKey, entry);
                    }
                });
            }

            rawOrdersList.forEach((po: any) => {
                const poSup = po.supplier_name || po.supplier;
                if (poSup && (po.status || "").toLowerCase() !== "cancelled") {
                    if (Array.isArray(po.items)) {
                        po.items.forEach((it: any) => {
                            const itKey = (it.item_name || it.name || "").trim().toLowerCase();
                            const itCode = (it.item_code || "").trim().toLowerCase();
                            const itPrice = Number(it.unit_price || it.price) || 0;
                            const entry = { 
                                supplierName: String(poSup).trim(), 
                                supplierId: po.supplier_id,
                                lastPurchaseDate: po.created_at || po.order_date,
                                unitPrice: itPrice 
                            };
                            if (itKey) previousSupplierMap.set(itKey, entry);
                            if (itCode) previousSupplierMap.set(itCode, entry);
                        });
                    }
                }
            });

            rawQuotesList.forEach((q: any) => {
                const qSup = q.supplier_name;
                const qItem = (q.item_name || "").trim().toLowerCase();
                if (qSup && qItem && !previousSupplierMap.has(qItem)) {
                    previousSupplierMap.set(qItem, {
                        supplierName: String(qSup).trim(),
                        supplierId: q.supplier_id,
                        email: q.contact_email,
                        phone: q.contact_phone,
                        lastPurchaseDate: q.created_at,
                        unitPrice: Number(q.unit_price) || 0
                    });
                }
            });

            // Process Inventory Shortages & Approved Requisition Deficits (Stage 1)
            const shortageMap = new Map<string, StockShortageItem>();

            if (inventoryRes.status === "fulfilled" && inventoryRes.value.data) {
                const invItems = inventoryRes.value.data;
                invItems
                    .filter((item: any) => {
                        const cur = Number(item.current_stock) || 0;
                        const min = Number(item.minimum_stock) || 0;
                        const status = (item.status || "").toLowerCase();
                        return cur <= min || status === "low-stock" || status === "out-of-stock";
                    })
                    .forEach((item: any) => {
                        const cur = Number(item.current_stock) || 0;
                        const min = Number(item.minimum_stock) || 0;
                        const deficit = Math.max(0, min - cur);
                        const price = Number(item.purchase_price) || 0;
                        const itemKey = (item.item_name || "").trim().toLowerCase();

                        // If item was delivered via a PO and restocked, skip only if stock is restored
                        if (deliveredGlobalItemNames.has(itemKey) && cur >= min) {
                            return;
                        }

                        const matchAward = awardedBidMap.get(itemKey);
                        const prevSup = previousSupplierMap.get(itemKey) || (item.item_code ? previousSupplierMap.get(item.item_code.toLowerCase()) : null);

                        shortageMap.set(itemKey, {
                            id: item.id,
                            item_code: item.item_code || `ITM-${item.id}`,
                            item_name: item.item_name || "Warehouse Item",
                            category: item.category || "General",
                            current_stock: cur,
                            unit: item.unit || "units",
                            minimum_stock: min,
                            storage_location: item.storage_location || "Binondo Central Hub",
                            status: cur === 0 ? "out-of-stock" : "low-stock",
                            updated_at: item.updated_at,
                            description: item.description,
                            supplier: item.supplier,
                            purchase_price: price,
                            deficit: deficit > 0 ? deficit : 1,
                            estimated_reorder_cost: (deficit > 0 ? deficit : 1) * (price || 150),
                            is_bid_awarded: Boolean(matchAward),
                            awarded_supplier_name: matchAward?.supplierName,
                            awarded_po_number: matchAward?.poNumber,
                            previous_supplier: prevSup?.supplierName || item.supplier || null,
                            previous_supplier_id: prevSup?.supplierId || null,
                            previous_supplier_email: prevSup?.email || null,
                            previous_supplier_phone: prevSup?.phone || null,
                            previous_purchase_date: prevSup?.lastPurchaseDate || null,
                            previous_unit_price: prevSup?.unitPrice || null,
                        });
                    });
            }

            // Extract approved requests to check for lacking quantities & missing active supplier categories
            // Exclude cancelled, rejected, delivered, completed, or fulfilled requests
            const isReqDead = (r: any) => {
                const st = (r.status || "").toLowerCase();
                return st === "cancelled" || st === "rejected" || st === "completed" || st === "delivered" || st === "fulfilled";
            };

            const rawApprovedList: any[] = [];
            if (approvedReqsServerRes.status === "fulfilled" && approvedReqsServerRes.value?.data) {
                const srvReqs = approvedReqsServerRes.value.data.filter((r: any) => !isReqDead(r));
                rawApprovedList.push(...srvReqs);
            }
            if (procDataRes.status === "fulfilled" && procDataRes.value?.requests) {
                const prs = procDataRes.value.requests.filter((r: any) => {
                    const st = (r.status || "").toLowerCase();
                    return !isReqDead(r) && (st.includes("approved") || st === "partially released");
                });
                rawApprovedList.push(...prs);
            }

            // Deduplicate requests
            const seenReqKeys = new Set<string>();
            const approvedReqList: any[] = [];
            for (const r of rawApprovedList) {
                const key = String(r.id || r.request_number || Math.random());
                if (!seenReqKeys.has(key)) {
                    seenReqKeys.add(key);
                    approvedReqList.push(r);
                }
            }

            approvedReqList.forEach((req: any) => {
                const reqStatus = (req.status || "").toLowerCase();
                let itemsList: any[] = [];
                if (Array.isArray(req.items) && req.items.length > 0) itemsList = req.items;
                else if (typeof req.items === "string") {
                    try {
                        const parsed = JSON.parse(req.items);
                        if (Array.isArray(parsed) && parsed.length > 0) itemsList = parsed;
                    } catch {}
                }

                // If items array is missing or empty, build from root requisition fields
                if (itemsList.length === 0 && (req.item_name || req.name || req.description)) {
                    const reqQty = Number(req.quantity_requested || req.quantity || 1);
                    const appQty = req.quantity_approved !== undefined ? Number(req.quantity_approved) : 0;
                    const remQty = req.quantity_remaining !== undefined ? Number(req.quantity_remaining) : reqQty;
                    itemsList = [{
                        name: req.item_name || req.name || req.description,
                        item_name: req.item_name || req.name || req.description,
                        quantity: reqQty,
                        quantity_requested: reqQty,
                        unit: req.unit || "units",
                        available_quantity: appQty,
                        deficit_quantity: remQty,
                        is_new_item: req.is_new_item ?? true,
                        category: req.category || req.department || "General",
                        status: req.status || "Pending",
                        is_approved: reqStatus.includes("approved"),
                    }];
                }

                const refNum = req.request_number || `REQ-${String(req.id).slice(0, 8)}`;
                const rawReqId = String(req.id || "");
                const matchedUuid = rawReqId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];

                itemsList.forEach((item: any, idx: number) => {
                    const itemName = String(item.name || item.item_name || "").trim();
                    if (!itemName) return;

                    // Check if this specific item is approved
                    const isItemApproved = item.is_approved === true || item.is_approve === true || item.status === "Approved" || (reqStatus.includes("approved") && item.status !== "Rejected");
                    if (!isItemApproved) {
                        return; // Do not push unapproved items into procurement
                    }

                    const itemKey = itemName.toLowerCase();
                    const totalReq = Number(item.quantity || item.quantity_requested || 1);
                    const avail = Number(item.available_quantity ?? item.approved_quantity ?? 0);
                    const issued = Number(item.issued_quantity || 0);
                    const deficit = Number(item.deficit_quantity ?? item.remaining_quantity ?? Math.max(0, totalReq - avail - issued));

                    // Check if this specific item in this request has already been released or delivered
                    const isItemFinished =
                        item.status === "Delivered" ||
                        item.status === "Released" ||
                        item.is_delivered === true ||
                        item.is_released === true ||
                        item.is_issued === true ||
                        reqStatus === "completed" ||
                        reqStatus === "delivered" ||
                        reqStatus === "fulfilled" ||
                        (issued >= totalReq && totalReq > 0) ||
                        (matchedUuid && deliveredReqItemsSet.has(`${matchedUuid.toLowerCase()}__${itemKey}`)) ||
                        (refNum && deliveredReqItemsSet.has(`${refNum.toLowerCase()}__${itemKey}`)) ||
                        (refNum && deliveredReqItemsSet.has(`${refNum.toLowerCase().replace(/[^a-z0-9]/g, "")}__${itemKey}`));

                    // Skip fully released / delivered items with 0 remaining deficit
                    if (isItemFinished && deficit === 0) {
                        return;
                    }

                    const isNewItem = Boolean(item.is_new_item || (!item.catalog_item_id && avail === 0));

                    // Category check against active suppliers
                    const itemCat = String(item.category || req.category || req.department || "General").trim();
                    const catKey = itemCat.toLowerCase();
                    const matchingActiveSuppliers = uniqueSuppliers.filter((s: any) => {
                        const sCat = String(s.category || "").toLowerCase();
                        return (s.is_active === undefined || s.is_active === true || s.is_active === "true") &&
                               (s.status || "").toLowerCase() !== "inactive" &&
                               (sCat.includes(catKey) || catKey.includes(sCat) || sCat === "all" || sCat === "general");
                    });
                    const activeSupplierCount = matchingActiveSuppliers.length;
                    const activeSupplierNames = matchingActiveSuppliers.map((s: any) => s.name || s.company_name).filter(Boolean);
                    const hasActiveSupplier = activeSupplierCount > 0 || activeSupplierCategories.has(catKey);

                    // User Rule:
                    // Only add to Stage 1 if there is a real remaining deficit (> 0), or it's a new item needing sourcing
                    const shouldAddToStage1 = deficit > 0 || isNewItem || (!hasActiveSupplier && !isItemFinished);

                    if (shouldAddToStage1) {
                        const effectiveDeficit = deficit > 0 ? deficit : (isItemFinished ? 0 : totalReq);
                        if (effectiveDeficit <= 0) return; // Ignore zero deficits

                        const itemPrice = Number(item.price || item.unit_price || item.purchase_price || 150);
                        const itemCleanKey = itemKey.replace(/[^a-z0-9]/g, "_");
                        const shortageId = matchedUuid 
                            ? `${matchedUuid}_item_${idx}_${itemCleanKey}` 
                            : `req-shortage-${String(req.id || "gen")}-${idx}_${itemCleanKey}`;

                        const existing = shortageMap.get(itemKey);
                        const prevSup = previousSupplierMap.get(itemKey) || (item.item_code ? previousSupplierMap.get(item.item_code.toLowerCase()) : null);

                        // Check if bid is awarded strictly for this item
                        const refKey = refNum.toLowerCase();
                        const matchAward = awardedBidMap.get(`${refKey}__${itemKey}`) ||
                                           (matchedUuid ? awardedBidMap.get(`${matchedUuid.toLowerCase()}__${itemKey}`) : null) ||
                                           awardedBidMap.get(itemKey);
                        const isBidAwarded = Boolean(matchAward);

                        if (existing) {
                            // If existing shortage was only from the baseline warehouse buffer and not from a requisition, overwrite with true requisition deficit
                            if (!existing.is_from_request) {
                                existing.deficit = effectiveDeficit;
                                existing.is_from_request = true;
                            } else {
                                existing.deficit = (existing.deficit || 0) + effectiveDeficit;
                            }
                            existing.estimated_reorder_cost = existing.deficit * (existing.purchase_price || itemPrice);
                            
                            // Combine source request references (e.g. #PR-2026-905106)
                            if (!existing.source_request) {
                                existing.source_request = refNum;
                            } else if (!existing.source_request.includes(refNum)) {
                                existing.source_request = `${existing.source_request}, ${refNum}`;
                            }

                            if (!existing.source_department) {
                                existing.source_department = req.department || "Warehouse";
                            }
                            existing.is_new_item = isNewItem || existing.is_new_item;
                            existing.has_no_active_supplier = !hasActiveSupplier || existing.has_no_active_supplier;
                            existing.active_supplier_count = activeSupplierCount;
                            existing.active_supplier_names = activeSupplierNames;
                            existing.available_ratio = `${avail}/${totalReq}`;
                            existing.previous_supplier = existing.previous_supplier || prevSup?.supplierName || item.supplier || null;
                            existing.previous_supplier_id = existing.previous_supplier_id || prevSup?.supplierId || null;
                            existing.previous_purchase_date = existing.previous_purchase_date || prevSup?.lastPurchaseDate || null;
                            existing.previous_unit_price = existing.previous_unit_price || prevSup?.unitPrice || null;
                            
                            if (matchedUuid && !existing.request_id) {
                                existing.request_id = matchedUuid;
                            }
                            if (isBidAwarded) {
                                existing.is_bid_awarded = true;
                                existing.awarded_supplier_name = matchAward?.supplierName || existing.awarded_supplier_name;
                                existing.awarded_po_number = matchAward?.poNumber || existing.awarded_po_number;
                            }
                        } else {
                            shortageMap.set(itemKey, {
                                id: shortageId,
                                request_id: matchedUuid || String(req.id || ""),
                                item_code: item.catalog_item_code || item.item_code || `REQ-${refNum}-${idx + 1}`,
                                item_name: itemName,
                                category: itemCat,
                                current_stock: avail,
                                unit: item.unit || "units",
                                minimum_stock: totalReq,
                                storage_location: item.storage_location || "Central Warehouse (Procurement Shortage Queue)",
                                status: avail === 0 ? "out-of-stock" : "low-stock",
                                deficit: effectiveDeficit,
                                estimated_reorder_cost: effectiveDeficit * itemPrice,
                                source_request: refNum,
                                source_department: req.department || "Warehouse",
                                is_from_request: true,
                                is_new_item: isNewItem,
                                has_no_active_supplier: !hasActiveSupplier,
                                active_supplier_count: activeSupplierCount,
                                active_supplier_names: activeSupplierNames,
                                available_ratio: `${avail}/${totalReq}`,
                                is_bid_awarded: isBidAwarded,
                                awarded_supplier_name: matchAward?.supplierName,
                                awarded_po_number: matchAward?.poNumber,
                                previous_supplier: prevSup?.supplierName || item.supplier || null,
                                previous_supplier_id: prevSup?.supplierId || null,
                                previous_purchase_date: prevSup?.lastPurchaseDate || null,
                                previous_unit_price: prevSup?.unitPrice || null,
                            });
                        }
                    }
                });
            });

            // Final enrichment of shortage items with verified active supplier status and contact records
            const enrichedShortages: StockShortageItem[] = Array.from(shortageMap.values()).map((sItem) => {
                const rawSupName = (sItem.supplier || sItem.previous_supplier || "").trim();
                const rawCat = (sItem.category || "").trim().toLowerCase();

                // 1. Direct name lookup in uniqueSuppliers
                let matchedSup: any = null;
                if (rawSupName) {
                    matchedSup = uniqueSuppliers.find((s: any) => 
                        s && s.name && s.name.trim().toLowerCase() === rawSupName.toLowerCase()
                    ) || null;
                }

                // 2. Category lookup for active suppliers
                let categoryActiveSup: any = null;
                if (rawCat) {
                    categoryActiveSup = uniqueSuppliers.find((s: any) => {
                        if (!s || !s.category) return false;
                        const isActive = s.is_active === undefined || s.is_active === true || s.is_active === "true";
                        const isNotInactive = (s.status || "").toLowerCase() !== "inactive";
                        return isActive && isNotInactive && s.category.trim().toLowerCase() === rawCat;
                    }) || null;
                }

                const isDirectSupActive = matchedSup 
                    ? (matchedSup.is_active === undefined || matchedSup.is_active === true || matchedSup.is_active === "true") && ((matchedSup.status || "").toLowerCase() !== "inactive")
                    : false;

                const hasOfficialActiveSupplier = isDirectSupActive || Boolean(categoryActiveSup);
                const matchedActiveSupplier = isDirectSupActive ? matchedSup : categoryActiveSup;

                return {
                    ...sItem,
                    has_official_active_supplier: hasOfficialActiveSupplier,
                    is_supplier_active: isDirectSupActive,
                    matched_active_supplier: matchedActiveSupplier,
                    previous_supplier_obj: matchedSup || null,
                    previous_supplier_email: matchedSup?.email || sItem.previous_supplier_email || null,
                    previous_supplier_phone: matchedSup?.phone || sItem.previous_supplier_phone || null,
                };
            });

            setShortages(enrichedShortages);

            // Process Supplier Quotations
            if (quotesRes.status === "fulfilled" && quotesRes.value.data) {
                setQuotations(quotesRes.value.data as SupplierQuotationItem[]);
            }
        } catch (err: any) {
            console.error("Error loading procurement data:", err);
            toast.error("Notice: Could not load some procurement data.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAllProcurementData();
    }, [loadAllProcurementData]);

    // Realtime Supabase Subscription for Procurement Hub
    useEffect(() => {
        const channelName = `procurement_realtime_${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "purchase_requests" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        const newReq = payload.new as any;
                        const reqName = newReq?.item_name || (Array.isArray(newReq?.items) && newReq.items[0]?.name) || "Requisition Request";
                        toast.info(`Procurement Alert: New request "${reqName}" added`, { duration: 3500 });
                    }
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "inventory_items" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "suppliers" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_quotations" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "purchase_orders" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "inventory_requests" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadAllProcurementData]);

    // Handle Stage switching and URL updates
    const handleStageChange = (stage: ProcurementStageId) => {
        setCurrentStage(stage);
        try {
            const currentParams = new URLSearchParams(searchParams.toString());
            currentParams.set("stage", String(stage));
            window.history.replaceState(null, "", `${pathname}?${currentParams.toString()}`);
        } catch {
            // fallback
        }
    };

    // --- WORKFLOW ACTIONS ---
    // 1. Find Suppliers for Shortage (Stage 1 -> Stage 2 bridge)
    const handleFindSuppliersForItem = (shortageItem: StockShortageItem) => {
        if (shortageItem.is_bid_awarded) {
            toast.info(`Bid has already been awarded for "${shortageItem.item_name}"${shortageItem.awarded_supplier_name ? ` to ${shortageItem.awarded_supplier_name}` : ""}.`);
            return;
        }
        setActiveSourcingFocus({
            itemName: shortageItem.item_name,
            requestNumber: shortageItem.source_request,
            category: shortageItem.category,
            previousSupplier: shortageItem.previous_supplier || null,
        });
        handleStageChange(2);
        if (shortageItem.previous_supplier) {
            toast.info(`Switched to Stage 2: Sourcing for "${shortageItem.item_name}". Previous supplier: ${shortageItem.previous_supplier}`);
        } else {
            toast.info(`Switched to Stage 2: Locating suppliers for shortage item "${shortageItem.item_name}".`);
        }
    };

    // 6. View Quotes for Supplier (Stage 2 -> Stage 3 bridge)
    const handleCompareQuotesForSupplier = (sup: Supplier) => {
        setSelectedRequestNumberForQuotes(null);
        handleStageChange(3);
        toast.info(`Switched to Stage 3: Comparing submitted quotes for "${sup.name}".`);
    };

    // 7. Award Bid / Accept Quotation
    const handleAwardBid = async (quote: SupplierQuotationItem) => {
        try {
            await supabase
                .from("supplier_quotations")
                .update({ status: "accepted" })
                .eq("id", quote.id);

            if (quote.request_number) {
                await supabase
                    .from("supplier_quotations")
                    .update({ status: "rejected" })
                    .neq("id", quote.id)
                    .eq("request_number", quote.request_number);
            }

            // Also sync suppliers_qoutation_bid on any existing purchase order linked to this request or quotation
            try {
                if (quote.request_id) {
                    await supabase
                        .from("purchase_orders")
                        .update({
                            suppliers_qoutation_bid: Number(quote.id),
                            supplier_name: quote.supplier_name,
                            supplier_id: quote.supplier_id ? Number(quote.supplier_id) : undefined,
                        })
                        .eq("request_id", String(quote.request_id));
                } else if (quote.request_number) {
                    await supabase
                        .from("purchase_orders")
                        .update({
                            suppliers_qoutation_bid: Number(quote.id),
                            supplier_name: quote.supplier_name,
                            supplier_id: quote.supplier_id ? Number(quote.supplier_id) : undefined,
                        })
                        .ilike("notes", `%${quote.request_number}%`);
                }
            } catch (poErr) {
                console.warn("Could not sync suppliers_qoutation_bid on PO:", poErr);
            }

            setQuotations((prev) =>
                prev.map((q) => {
                    if (q.id === quote.id) return { ...q, status: "accepted" };
                    if (quote.request_number && q.request_number === quote.request_number) {
                        return { ...q, status: "rejected" };
                    }
                    return q;
                })
            );

            toast.success(`Quotation from "${quote.supplier_name}" accepted successfully.`);
            loadAllProcurementData(true);
        } catch (err: any) {
            console.error("Error accepting quote:", err);
            toast.error("Failed to accept quote.");
        }
    };

    // 8. Record New Manual Quotation
    const handleRecordNewQuote = async (quoteData: any) => {
        try {
            const { data, error } = await supabase
                .from("supplier_quotations")
                .insert([quoteData])
                .select("*")
                .single();

            if (error) throw error;

            setQuotations((prev) => [data as SupplierQuotationItem, ...prev]);
            toast.success(`Quotation from "${quoteData.supplier_name}" recorded successfully!`);
        } catch (err: any) {
            console.error("Error recording quote:", err);
            toast.error(err.message || "Failed to record quotation.");
        }
    };

    // 12. View Quotation Document Modal
    const handleViewQuotationDocument = (quote: SupplierQuotationItem) => {
        setSelectedQuoteForModal(quote);
        const matchedSup = suppliers.find((s) => s.name.toLowerCase() === quote.supplier_name.toLowerCase());
        setQuoteModalSupplier({
            id: quote.supplier_id || matchedSup?.id || 1,
            name: quote.supplier_name,
            contact_person: quote.contact_person || matchedSup?.contact_person || "Sales Representative",
            phone: quote.contact_phone || matchedSup?.phone || "",
            email: quote.contact_email || matchedSup?.email || "",
            category: matchedSup?.category || "Supplies",
            location: matchedSup?.location || "Metro Manila",
        });
        setIsQuoteViewModalOpen(true);
    };

    // 13. Direct Supplier Messaging Handler (from Stage 1 or anywhere)
    const handleMessageSupplier = useCallback((supplier: any, shortageItem?: StockShortageItem) => {
        let targetSupplier = supplier;
        if (!targetSupplier && shortageItem) {
            targetSupplier = shortageItem.matched_active_supplier
                || shortageItem.previous_supplier_obj
                || suppliers.find(s => s.name?.toLowerCase() === (shortageItem.supplier || shortageItem.previous_supplier)?.toLowerCase())
                || {
                    name: shortageItem.previous_supplier || shortageItem.supplier || "Supplier",
                    id: shortageItem.previous_supplier_id || String(Date.now()),
                    email: shortageItem.previous_supplier_email || "",
                    phone: shortageItem.previous_supplier_phone || "",
                    category: shortageItem.category || "General",
                    is_active: shortageItem.is_supplier_active ?? false,
                    notes: `Supplier for ${shortageItem.item_name}`
                };
        }

        if (targetSupplier) {
            setSelectedSupplierForMessage(targetSupplier);
            setIsMessageModalOpen(true);
        } else {
            toast.error("Supplier contact information is not available.");
        }
    }, [suppliers]);

    // 14. Direct PO Creation from Shortage (Stage 1)
    const handleCreatePOFromShortage = useCallback((shortageItem: StockShortageItem, supplier?: any) => {
        const targetSup = supplier || shortageItem.matched_active_supplier 
            || suppliers.find(s => s.name?.toLowerCase() === (shortageItem.supplier || shortageItem.previous_supplier)?.toLowerCase()) 
            || null;

        const deficitQty = Math.max(1, Number(shortageItem.deficit) || 1);
        const unitPrice = Number(shortageItem.purchase_price || shortageItem.previous_unit_price || 0);

        setPoModalPrefillRequest({
            id: `shortage_${shortageItem.id}_${Date.now()}`,
            supplier_id: targetSup?.id || shortageItem.previous_supplier_id || '',
            supplier_name: targetSup?.name || shortageItem.supplier || shortageItem.previous_supplier || '',
            description: `Replenishment order for ${shortageItem.item_name}`,
            department: shortageItem.category,
            amount: deficitQty * unitPrice,
            allowEditItems: true,
            items: [
                {
                    name: shortageItem.item_name,
                    item_name: shortageItem.item_name,
                    quantity: deficitQty,
                    unit_price: unitPrice,
                    unit: shortageItem.unit || 'units',
                    total: deficitQty * unitPrice,
                }
            ]
        });
        setSelectedPOForModal(null);
        setIsPOModalOpen(true);
    }, [suppliers]);

    // Compute navigation badge counts
    const navCounts = useMemo(() => {
        return {
            stockShortages: shortages.length,
            totalSuppliers: suppliers.length,
            quotationsCount: quotations.length,
            supplierReturnsCount: supplierReturnsCount,
        };
    }, [shortages, suppliers, quotations, supplierReturnsCount]);

    return (
        <SessionGuard requiredRole={["Admin", "Purchase Officer", "Executive", "Supervisor"]}>
            <div className="p-4 sm:p-6 lg:p-7 space-y-6 fade-in bgCard">
                {/* 1. Master Page Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-300/80 dark:border-white/10 pb-5">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-white/80 dark:border-white/[0.06] flex items-center justify-center text-pink-600 dark:text-pink-400 text-xl shrink-0 mt-0.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)]">
                            <i className="fa-solid fa-cart-flatbed" />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    Procurement &amp; Strategic Sourcing Hub
                                </h1>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                End-to-end operational procurement: Monitor stock shortages, find potential suppliers, and collect &amp; compare quotations.
                            </p>

                            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#12131b] border border-white/80 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_3px_rgba(163,177,198,0.3),_inset_-1.5px_-1.5px_3px_rgba(255,255,255,0.85)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)] text-[11px] text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                                <span className="font-bold text-slate-500">Authenticated Role:</span>
                                <span className="font-black text-slate-800 dark:text-slate-100 capitalize">
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => loadAllProcurementData(true)}
                            className="p-2.5 px-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#1a1c2c] text-slate-600 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 text-xs font-bold transition-all shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),_3px_3px_8px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),_2px_2px_6px_rgba(0,0,0,0.5)] active:shadow-[inset_1px_1px_3px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.06] cursor-pointer flex items-center gap-2"
                            title="Refresh Datasets"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-pink-500" : ""}`} />
                            <span className="text-xs font-black hidden sm:inline">Refresh Hub</span>
                        </button>
                    </div>
                </div>

                {/* 2. AI Questions Helper - Strictly Solid Pink and Slate */}
                <AiQuestions
                    title="Procurement Intelligent Co-Pilot"
                    subtitle="Ask questions or trigger instant workflow actions"
                    questions={[
                        { question: "Monitor warehouse stock shortages and deficits", color: "bg-pink-500" },
                        { question: "Find potential suppliers on logistics sourcing map", color: "bg-pink-500" },
                        { question: "Collect and compare supplier quotations and pricing", color: "bg-pink-500" },
                    ]}
                />

                {/* 3. 3-Stage Lifecycle Stepper Navigation */}
                <ProcurementLifecycleNav
                    currentStage={currentStage}
                    onSelectStage={handleStageChange}
                    counts={navCounts}
                />

                {/* 4. Stage Workspaces Rendering */}
                {isLoading ? (
                    <div className="py-12 space-y-4">
                        <CardsSkeleton count={3} />
                    </div>
                ) : (
                    <div>
                        {/* STAGE 1: Stock Shortages */}
                        {currentStage === 1 && (
                            <StageStockShortages
                                shortages={shortages}
                                isLoading={isLoading}
                                onFindSuppliersForItem={handleFindSuppliersForItem}
                                onRefresh={() => loadAllProcurementData(true)}
                                onMessageSupplier={handleMessageSupplier}
                                onCreatePO={handleCreatePOFromShortage}
                            />
                        )}

                        {/* STAGE 2: Find potential suppliers */}
                        {currentStage === 2 && (
                            <StageFindPotentialSuppliers
                                suppliers={suppliers}
                                shortages={shortages}
                                activeSourcingFocus={activeSourcingFocus}
                                onClearSourcingFocus={() => setActiveSourcingFocus(null)}
                                onRefresh={() => loadAllProcurementData(true)}
                                onOpenPOModal={(item, sup) => {
                                    setSelectedPOForModal(null);
                                    setIsPOModalOpen(true);
                                }}
                            />
                        )}

                        {/* STAGE 3: Collect and compare quotations (Transferred from /suppliers?tab=potential) */}
                        {currentStage === 3 && (
                            <PotentialSuppliersTab
                                registeredSuppliers={suppliers}
                                onSupplierPromoted={() => loadAllProcurementData(true)}
                                onViewPurchaseOrder={(po) => {
                                    if (po) {
                                        setReceiptModalPO(po);
                                        setIsReceiptModalOpen(true);
                                    }
                                }}
                            />
                        )}

                        {/* STAGE 4: Supplier Returns & Defective Item Resolution */}
                        {currentStage === 4 && (
                            <StageSupplierReturns
                                onRefreshParent={() => loadAllProcurementData(true)}
                            />
                        )}
                    </div>
                )}

                {/* 5. MODALS INTEGRATION */}

                {/* A. Direct Supplier Messaging Modal */}
                <SupplierMessageModal
                    isOpen={isMessageModalOpen}
                    onClose={() => {
                        setIsMessageModalOpen(false);
                        setSelectedSupplierForMessage(null);
                    }}
                    supplier={selectedSupplierForMessage}
                />

                {/* B. Purchase Order Modal */}
                {isPOModalOpen && (
                    <PurchaseOrderModal
                        isOpen={isPOModalOpen}
                        onClose={() => {
                            setIsPOModalOpen(false);
                            setSelectedPOForModal(null);
                            setPoModalPrefillRequest(null);
                        }}
                        request={poModalPrefillRequest || null}
                        suppliers={suppliers}
                        onOrderCreated={(newPO) => {
                            setIsPOModalOpen(false);
                            setPoModalPrefillRequest(null);
                            loadAllProcurementData(true);
                        }}
                    />
                )}

                {/* C. Official Digital Receipt Modal */}
                {isReceiptModalOpen && receiptModalPO && (
                    <DigitalReceiptModal
                        isOpen={isReceiptModalOpen}
                        onClose={() => {
                            setIsReceiptModalOpen(false);
                            setReceiptModalPO(null);
                        }}
                        order={receiptModalPO}
                    />
                )}

                {/* D. Add Potential Supplier Lead Modal */}
                {isAddSupplierModalOpen && (
                    <AddPotentialSupplierModal
                        isOpen={isAddSupplierModalOpen}
                        onClose={() => setIsAddSupplierModalOpen(false)}
                        onSupplierAdded={() => {
                            setIsAddSupplierModalOpen(false);
                            loadAllProcurementData(true);
                            toast.success("Supplier lead registered successfully.");
                        }}
                        availableRequests={requests.map((r) => ({
                            id: r.id,
                            requestNumber: r.request_number,
                            itemName: r.items && r.items[0] ? (r.items[0].name || r.items[0].item_name || "Item") : r.description,
                            category: r.department,
                        }))}
                    />
                )}

                {/* E. Vendor Quotation View Modal */}
                {isQuoteViewModalOpen && quoteModalSupplier && (
                    <VendorQuotationViewModal
                        supplier={quoteModalSupplier}
                        initialQuote={selectedQuoteForModal as any}
                        onClose={() => {
                            setIsQuoteViewModalOpen(false);
                            setSelectedQuoteForModal(null);
                            setQuoteModalSupplier(null);
                        }}
                        onAwardBid={(sup, quote) => {
                            setIsQuoteViewModalOpen(false);
                            if (selectedQuoteForModal) {
                                handleAwardBid(selectedQuoteForModal);
                            }
                        }}
                    />
                )}
            </div>
        </SessionGuard>
    );
}
