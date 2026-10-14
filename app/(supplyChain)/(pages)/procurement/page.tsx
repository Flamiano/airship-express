// app/(supplyChain)/(pages)/procurement/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
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
import { findBestMatchingPO, getPOStatusIndicator, normalizeItemName } from "../../lib/utils";
import { calculateGroupedStockShortages } from "./utils/groupedDeficitCalculations";
import { ReorderDeficitModal } from "./components/ReorderDeficitModal";

// Re-export modals for external imports
export { PurchaseOrderModal, ChartDetailModal, DigitalReceiptModal };

function ProcurementContent() {
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
        deficit?: number;
        shortageItem?: StockShortageItem;
        orderAgainSupplier?: string | null;
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

    // Reorder Deficit Modal State
    const [isReorderDeficitModalOpen, setIsReorderDeficitModalOpen] = useState(false);
    const [reorderShortageItem, setReorderShortageItem] = useState<StockShortageItem | null>(null);
    const [reorderSupplierName, setReorderSupplierName] = useState<string | null>(null);
    const [reorderSupplierId, setReorderSupplierId] = useState<number | string | null>(null);
    const [reorderQuotation, setReorderQuotation] = useState<any | null>(null);

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

            // Calculate Grouped Item Deficits and Remaining Procurement Quantities (Only active actionable deficits)
            const groupedShortages = calculateGroupedStockShortages({
                inventoryItems: inventoryRes.status === "fulfilled" && inventoryRes.value?.data ? inventoryRes.value.data : [],
                requests: approvedReqList,
                purchaseOrders: rawOrdersList,
                quotations: rawQuotesList,
                suppliers: uniqueSuppliers,
                onlyActionable: true,
            });

            // Final enrichment of shortage items with verified previous supplier contact records
            const enrichedShortages: StockShortageItem[] = groupedShortages.map((sItem) => {
                const itemKey = (sItem.item_name || "").trim().toLowerCase();
                const prevSup = previousSupplierMap.get(itemKey) || (sItem.item_code ? previousSupplierMap.get(sItem.item_code.toLowerCase()) : null);

                const prevSupplierName = sItem.previous_supplier || prevSup?.supplierName || null;
                const prevSupplierId = sItem.previous_supplier_id || prevSup?.supplierId || null;
                const prevEmail = sItem.previous_supplier_email || prevSup?.email || null;
                const prevPhone = sItem.previous_supplier_phone || prevSup?.phone || null;
                const prevPurchaseDate = sItem.previous_purchase_date || prevSup?.lastPurchaseDate || null;
                const prevUnitPrice = sItem.previous_unit_price ?? prevSup?.unitPrice ?? null;

                const hasOfficialSupplier = Boolean(sItem.has_official_active_supplier || sItem.matched_active_supplier);
                const hasPreviousSupplier = Boolean(prevSupplierName);
                const hasDirectSupplier = Boolean(sItem.supplier);
                const hasAnySupplier = hasOfficialSupplier || hasPreviousSupplier || hasDirectSupplier;

                const remDeficit = sItem.remaining_deficit !== undefined ? sItem.remaining_deficit : sItem.deficit;
                const effectiveUnitPrice = hasAnySupplier
                    ? Number(sItem.purchase_price || prevUnitPrice || 0)
                    : 0;
                const estimatedCost = hasAnySupplier
                    ? (remDeficit * effectiveUnitPrice)
                    : 0;

                return {
                    ...sItem,
                    purchase_price: effectiveUnitPrice,
                    estimated_reorder_cost: estimatedCost,
                    previous_supplier: prevSupplierName,
                    previous_supplier_id: prevSupplierId,
                    previous_supplier_email: prevEmail,
                    previous_supplier_phone: prevPhone,
                    previous_purchase_date: prevPurchaseDate,
                    previous_unit_price: prevUnitPrice,
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

    // Realtime Supabase Subscription for All Procurement Stages & Tabs
    useEffect(() => {
        const channelName = `procurement_master_realtime_${Math.random().toString(36).substring(2, 9)}`;
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
                { event: "*", schema: "public", table: "stock_movements" },
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
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        const newQuote = payload.new as any;
                        const supName = newQuote?.supplier_name || "A vendor";
                        toast.info(`Procurement Alert: New quotation received from ${supName}`, { duration: 3500 });
                    }
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
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_return_requests" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        toast.info(`Procurement Alert: New supplier return request logged`, { duration: 3500 });
                    }
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "warehouse_damage_incidents" },
                () => {
                    loadAllProcurementData(true);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "supplier_meetings" },
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
        const remainingDeficit = shortageItem.remaining_deficit !== undefined
            ? Number(shortageItem.remaining_deficit)
            : Number(shortageItem.deficit) || 0;

        if (remainingDeficit <= 0) {
            toast.info(`Demand for "${shortageItem.item_name}" is already fully covered by usable stock and active purchase orders.`);
            return;
        }

        setActiveSourcingFocus({
            itemName: shortageItem.item_name,
            requestNumber: shortageItem.source_request,
            category: shortageItem.category,
            previousSupplier: shortageItem.previous_supplier || null,
            deficit: remainingDeficit,
            shortageItem: shortageItem,
        });
        handleStageChange(2);
        if (shortageItem.previous_supplier) {
            toast.info(`Switched to Stage 2: Sourcing ${remainingDeficit} units for "${shortageItem.item_name}". Previous supplier: ${shortageItem.previous_supplier}`);
        } else {
            toast.info(`Switched to Stage 2: Locating suppliers for remaining deficit of ${remainingDeficit} units ("${shortageItem.item_name}").`);
        }
    };

    // 2. Order Again from Same Supplier Shortcut (Stage 1 / Stage 2) - Uses Create Purchase Order modal
    const handleOrderAgainFromSameSupplier = (shortageItem: StockShortageItem, supplierName: string) => {
        const remainingDeficit = shortageItem.remaining_deficit !== undefined
            ? Number(shortageItem.remaining_deficit)
            : Number(shortageItem.deficit) || 0;

        if (remainingDeficit <= 0) {
            toast.info(`Demand for "${shortageItem.item_name}" is already fully covered.`);
            return;
        }

        const matchedSup = suppliers.find((s) => s.name?.toLowerCase() === supplierName.toLowerCase());
        handleCreatePOFromShortage(shortageItem, matchedSup);
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

            // Only sync suppliers_qoutation_bid on an open unawarded draft PO for this request (never touch approved/delivered/in-flight POs)
            try {
                if (quote.request_id) {
                    await supabase
                        .from("purchase_orders")
                        .update({
                            suppliers_qoutation_bid: Number(quote.id),
                            supplier_name: quote.supplier_name,
                            supplier_id: quote.supplier_id ? Number(quote.supplier_id) : undefined,
                        })
                        .eq("request_id", String(quote.request_id))
                        .ilike("status", "draft")
                        .is("admin_approved_at", null);
                }
            } catch (poErr) {
                console.warn("Could not sync suppliers_qoutation_bid on draft PO:", poErr);
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

    // 14. Direct PO Creation from Shortage (Stage 1) - Opens Create Purchase Order modal
    const handleCreatePOFromShortage = useCallback((shortageItem: StockShortageItem, supplier?: any) => {
        const targetSup = supplier || shortageItem.matched_active_supplier 
            || suppliers.find(s => s.name?.toLowerCase() === (shortageItem.supplier || shortageItem.previous_supplier)?.toLowerCase()) 
            || null;

        const supName = targetSup?.name || shortageItem.supplier || shortageItem.previous_supplier || '';
        const supId = targetSup?.id || shortageItem.previous_supplier_id || '';

        const deficitQty = Math.max(1, Number(shortageItem.remaining_deficit ?? shortageItem.deficit) || 1);
        const unitPrice = Number(shortageItem.purchase_price || shortageItem.previous_unit_price || 0);

        setPoModalPrefillRequest({
            id: `shortage_${shortageItem.id}_${Date.now()}`,
            request_number: shortageItem.source_request || undefined,
            supplier_id: supId ? String(supId) : '',
            supplier_name: supName,
            description: `Replenishment order for ${shortageItem.item_name}`,
            department: shortageItem.category || "General",
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

    // 15. Reorder directly from Stage 3 (Quotation & Outreach Pipeline)
    const handleReorderFromStage3 = useCallback((itemData: any, supplier: any, quote?: any) => {
        const itemName = itemData?.itemName || itemData?.name || quote?.item_name || "";
        const matchedShortage = shortages.find(s => 
            s.item_name?.toLowerCase() === itemName.toLowerCase() ||
            normalizeItemName(s.item_name || "") === normalizeItemName(itemName)
        );

        const qty = Number(itemData?.quantityRequested || quote?.quantity || 1);
        const shortageToUse: StockShortageItem = matchedShortage || {
            id: `stage3_reorder_${Date.now()}`,
            item_code: `ITEM-${Date.now().toString().slice(-4)}`,
            item_name: itemName,
            category: itemData?.category || itemData?.department || "General",
            current_stock: 0,
            unit: itemData?.unit || quote?.unit || "units",
            minimum_stock: 0,
            storage_location: "Main Warehouse",
            status: 'out-of-stock',
            total_approved_demand: qty,
            usable_stock: 0,
            active_po_coverage: 0,
            remaining_deficit: qty,
            deficit: qty,
            estimated_reorder_cost: Number(quote?.total_amount || 0),
            previous_supplier: supplier?.name || quote?.supplier_name,
            previous_supplier_id: supplier?.id || quote?.supplier_id,
            previous_unit_price: quote?.unit_price,
            covering_purchase_orders: [],
        };

        const supName = supplier?.name || quote?.supplier_name || null;
        setReorderShortageItem(shortageToUse);
        setReorderSupplierName(supName);
        setReorderSupplierId(supplier?.id || quote?.supplier_id || null);
        setReorderQuotation(quote || null);
        setIsReorderDeficitModalOpen(true);
    }, [shortages]);

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
                                onOrderAgainFromSameSupplier={handleOrderAgainFromSameSupplier}
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
                                    handleCreatePOFromShortage(item, sup);
                                }}
                            />
                        )}

                        {/* STAGE 3: Collect and compare quotations (Transferred from /suppliers?tab=potential) */}
                        {currentStage === 3 && (
                            <PotentialSuppliersTab
                                registeredSuppliers={suppliers}
                                shortages={shortages}
                                onSupplierPromoted={() => loadAllProcurementData(true)}
                                onReorder={handleReorderFromStage3}
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

                {/* F. Reorder Deficit Modal */}
                {isReorderDeficitModalOpen && reorderShortageItem && (
                    <ReorderDeficitModal
                        isOpen={isReorderDeficitModalOpen}
                        onClose={() => {
                            setIsReorderDeficitModalOpen(false);
                            setReorderShortageItem(null);
                            setReorderSupplierName(null);
                            setReorderSupplierId(null);
                            setReorderQuotation(null);
                        }}
                        item={reorderShortageItem}
                        supplierName={reorderSupplierName}
                        supplierId={reorderSupplierId}
                        quotation={reorderQuotation}
                        registeredSuppliers={suppliers}
                        onOrderCreated={() => {
                            setIsReorderDeficitModalOpen(false);
                            setReorderShortageItem(null);
                            setReorderSupplierName(null);
                            setReorderSupplierId(null);
                            setReorderQuotation(null);
                            loadAllProcurementData(true);
                        }}
                    />
                )}
            </div>
        </SessionGuard>
    );
}

export default function ProcurementPage() {
    return (
        <Suspense
            fallback={
                <div className="py-12 space-y-4 max-w-7xl mx-auto px-4">
                    <CardsSkeleton count={4} />
                </div>
            }
        >
            <ProcurementContent />
        </Suspense>
    );
}

