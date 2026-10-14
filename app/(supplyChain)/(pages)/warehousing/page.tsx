// app/(supplyChain)/(pages)/warehousing/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
    Warehouse, 
    RefreshCw, 
    Layers, 
    Box, 
    ShieldCheck, 
    AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/services/client/supabase";
import { user } from "../../lib/services/Class/user";
import { SessionGuard } from "../../components/server/SessionGuard";
import { CardsSkeleton } from "../../components/ui/SkeletonLoader";
import AiQuestions from "../../components/global/AiQuestions";

import { WarehousingTabsNav, WarehousingTabId } from "./components/TabsWrapper";
import { ReceiveSuppliesTab } from "./components/tabs/ReceiveSuppliesTab";
import { IssueRequestsTab } from "./components/tabs/IssueRequestsTab";
import { StorageLocationsTab } from "./components/tabs/StorageLocationsTab";
import { DamagedMissingSuppliesTab } from "./components/tabs/DamagedMissingSuppliesTab";
import { supabaseWarehouseDb } from "./server/warehouse-db";
import { fetchInventoryRequests } from "../inventory/server/query";
import { checkRequestHasAvailableStock } from "./server/warehouse-stock-utils";

function WarehousingContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Parse URL tab parameter
    const parseTabParam = (param: string | null): WarehousingTabId => {
        if (!param) return "receive";
        const normalized = param.toLowerCase().trim();
        if (normalized === "receive" || normalized === "receiving" || normalized === "inbound") return "receive";
        if (normalized === "issue" || normalized === "issuing" || normalized === "requests") return "issue";
        if (normalized === "locations" || normalized === "storage" || normalized === "zones") return "locations";
        if (normalized === "damages" || normalized === "damaged" || normalized === "missing") return "damages";
        return "receive";
    };

    const [activeTab, setActiveTab] = useState<WarehousingTabId>(() =>
        parseTabParam(searchParams.get("tab"))
    );

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [userRole, setUserRole] = useState<string>(() => user.getRole() || "Admin");

    // Master datasets
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [departmentRequests, setDepartmentRequests] = useState<any[]>([]);
    const [dbDamageCount, setDbDamageCount] = useState<number>(0);
    const [dbZonesCount, setDbZonesCount] = useState<number>(0);

    // Sync role changes
    useEffect(() => {
        const handleStorageChange = () => {
            const storedRole = user.getRole();
            if (storedRole) setUserRole(storedRole);
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    // Load warehouse operational data
    const loadWarehouseData = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            else setIsRefreshing(true);

            const [invRes, poRes, reqsRes, prRes, irRes, dmgRes, zonesRes] = await Promise.allSettled([
                supabase
                    .from("inventory_items")
                    .select("*")
                    .order("item_name", { ascending: true }),
                supabase
                    .from("purchase_orders")
                    .select("*")
                    .order("created_at", { ascending: false }),
                fetchInventoryRequests({ page: 1, limit: 100, status: "all" }),
                supabase
                    .from("purchase_requests")
                    .select("*")
                    .order("created_at", { ascending: false }),
                supabase
                    .from("inventory_requests")
                    .select("*")
                    .order("created_at", { ascending: false }),
                supabaseWarehouseDb
                    .from("warehouse_damage_incidents")
                    .select("id", { count: "exact" }),
                supabaseWarehouseDb
                    .from("warehouse_storage_zones")
                    .select("id", { count: "exact" }),
            ]);

            if (invRes.status === "fulfilled" && invRes.value.data) {
                setInventoryItems(invRes.value.data);
            }

            if (poRes.status === "fulfilled" && poRes.value.data) {
                setPurchaseOrders(poRes.value.data);
            }

            if (dmgRes.status === "fulfilled" && dmgRes.value.data) {
                setDbDamageCount(dmgRes.value.count ?? dmgRes.value.data.length);
            }

            if (zonesRes.status === "fulfilled" && zonesRes.value.data) {
                setDbZonesCount(zonesRes.value.count ?? zonesRes.value.data.length);
            }

            const rawReqs: any[] = [];
            
            // 1. Prefer enriched requests from fetchInventoryRequests server action
            if (reqsRes.status === "fulfilled" && reqsRes.value?.success && Array.isArray(reqsRes.value.data?.requests)) {
                rawReqs.push(...reqsRes.value.data.requests);
            }

            // 2. Add any direct database requests
            if (prRes.status === "fulfilled" && prRes.value.data) {
                rawReqs.push(...prRes.value.data);
            }
            if (irRes.status === "fulfilled" && irRes.value.data) {
                rawReqs.push(...irRes.value.data);
            }

            // Deduplicate requests by id / request_number & filter strictly for Approved (with available stocks) or Completed/Released
            const seenReqIds = new Set<string>();
            const mergedReqs: any[] = [];
            const liveInv = invRes.status === "fulfilled" && invRes.value.data ? invRes.value.data : [];
            for (const req of rawReqs) {
                const key = String(req.id || req.request_number || Math.random());
                if (!seenReqIds.has(key)) {
                    seenReqIds.add(key);
                    const st = String(req.status || "").trim().toLowerCase();
                    const rawItems = Array.isArray(req.items) ? req.items : (typeof req.items === "string" ? JSON.parse(req.items || "[]") : []);
                    const hasReleasedItems = rawItems.some((it: any) => it.is_released || it.is_issued || it.status === "Released" || it.status === "Delivered");
                    const hasApprovedItems = rawItems.some((it: any) => it.is_approved || it.is_approve || it.status === "Approved" || Number(it.approved_quantity) > 0 || Number(it.available_quantity) > 0);
                    const isCompleted = st === "completed" || st === "delivered" || st === "received" || Boolean(req.completed_at) || hasReleasedItems;
                    const isApproved = (st === "approved" || st.includes("approved") || st === "partially approved" || st === "partially released" || hasApprovedItems) && st !== "rejected";

                    const hasAvailableStock = checkRequestHasAvailableStock(req, liveInv);

                    // Requisitions with approved items (or partially approved) and available stock, or completed records
                    if (isCompleted || (isApproved && hasAvailableStock)) {
                        mergedReqs.push(req);
                    }
                }
            }
            setDepartmentRequests(mergedReqs);
        } catch (err: any) {
            console.error("Error loading warehouse data:", err);
            toast.error("Could not load warehouse data.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadWarehouseData();

        const channelId = `warehousing_master_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requests" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory_requests" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "warehouse_damage_incidents" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "warehouse_storage_zones" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "supplier_return_requests" }, () => {
                loadWarehouseData(true);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => {
                loadWarehouseData(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadWarehouseData]);

    // Handle tab change and synchronize URL
    const handleTabChange = (tabId: WarehousingTabId) => {
        setActiveTab(tabId);
        try {
            const currentParams = new URLSearchParams(searchParams.toString());
            currentParams.set("tab", tabId);
            window.history.replaceState(null, "", `${pathname}?${currentParams.toString()}`);
        } catch {
            // fallback
        }
    };

    // Tab badges counts calculated dynamically from live database
    const counts = useMemo(() => {
        const pendingInbound = purchaseOrders.filter((po) => {
            const finApproved = String(po.financial_approval || "").trim().toLowerCase() === "approved";
            const admApproved = String(po.admin_approval || "").trim().toLowerCase() === "approved";
            const st = String(po.status || "").trim().toLowerCase();
            const notDelivered = st !== "delivered" && st !== "received";
            return finApproved && admApproved && notDelivered;
        }).length;

        const approvedRequests = departmentRequests.filter((r) => {
            const st = String(r.status || "").trim().toLowerCase();
            const isCompleted = st === "delivered" || st === "completed" || st === "fulfilled" || st === "received";
            const isRejected = st === "rejected" || st === "cancelled";
            if (isCompleted || isRejected) return false;

            const isApproved = st === "approved" || st.includes("approved") || st === "partially approved";
            const items = Array.isArray(r.items) ? r.items : (typeof r.items === "string" ? JSON.parse(r.items || "[]") : []);
            const hasApprovedItems = items.some((i: any) => i.is_approved === true || i.is_approve === true || String(i.status || "").toLowerCase() === "approved");

            const hasAvailableStock = checkRequestHasAvailableStock(r, inventoryItems);
            return (isApproved || hasApprovedItems) && hasAvailableStock;
        }).length;

        // Calculate locations count from database zones or mapped storage locations
        let totalLocations = dbZonesCount;
        if (totalLocations === 0) {
            const uniqueLocs = new Set(inventoryItems.map((i) => i.storage_location).filter(Boolean));
            totalLocations = uniqueLocs.size;
        }

        // Calculate incidents count directly from database
        const incidentsCount = dbDamageCount;

        return {
            pendingInbound,
            approvedRequests,
            totalLocations,
            incidentsCount,
        };
    }, [purchaseOrders, departmentRequests, inventoryItems, dbZonesCount, dbDamageCount]);

    return (
        <SessionGuard requiredRole={["Admin", "Purchase Officer", "Operator", "Executive"]}>
            <div className="p-4 sm:p-6 lg:p-7 space-y-6 fade-in bgCard">
                {/* 1. Master Page Header with Neumorphic Card Styling */}
                <div className="p-5 sm:p-6 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/40 flex items-center justify-center text-pink-600 dark:text-pink-400 text-xl shrink-0 mt-0.5 shadow-xs">
                            <Warehouse className="w-6 h-6" />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    Warehouse &amp; Materials Logistics Hub
                                </h1>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                End-to-end warehouse materials control: Receive supplies from suppliers, issue approved requests to departments, manage storage locations, and record damaged or missing supplies.
                            </p>

                            <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-xs shadow-pink-500/50" />
                                <span className="font-medium text-slate-500">Authenticated Role:</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 capitalize">
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => loadWarehouseData(true)}
                            className="p-2.5 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold transition-all shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] border border-white/70 dark:border-[#2a2b38] active:scale-95 cursor-pointer flex items-center gap-1.5"
                            title="Refresh Warehouse Datasets"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-pink-500" : ""}`} />
                            <span className="text-xs font-bold hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                {/* 2. AI Questions Helper - Strictly Solid Pink and Slate */}
                <AiQuestions
                    title="Warehouse Logistics Co-Pilot"
                    subtitle="Ask questions or trigger instant warehouse operations"
                    questions={[
                        { question: "Verify and receive inbound supplies from vendor purchase orders", color: "bg-pink-500" },
                        { question: "Dispense and issue approved supply requisitions to departments", color: "bg-pink-500" },
                        { question: "Organize warehouse racks, aisles, bins, and storage locations", color: "bg-pink-500" },
                        { question: "Log damaged goods, broken items, or audit count discrepancies", color: "bg-pink-500" },
                    ]}
                />

                {/* 3. 4-Tab Stepper Navigation */}
                <WarehousingTabsNav
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    counts={counts}
                />

                {/* 4. Active Tab Panel */}
                {isLoading ? (
                    <div className="py-12 space-y-4">
                        <CardsSkeleton count={4} />
                    </div>
                ) : (
                    <div>
                        {/* TAB 1: Receive supplies from suppliers */}
                        {activeTab === "receive" && (
                            <ReceiveSuppliesTab
                                inventoryItems={inventoryItems}
                                purchaseOrders={purchaseOrders}
                                onRefresh={() => loadWarehouseData(true)}
                            />
                        )}

                        {/* TAB 2: Issue approved requests to departments */}
                        {activeTab === "issue" && (
                            <IssueRequestsTab
                                requests={departmentRequests}
                                inventoryItems={inventoryItems}
                                onRefresh={() => loadWarehouseData(true)}
                            />
                        )}

                        {/* TAB 3: Manage storage locations */}
                        {activeTab === "locations" && (
                            <StorageLocationsTab
                                inventoryItems={inventoryItems}
                                onRefresh={() => loadWarehouseData(true)}
                            />
                        )}

                        {/* TAB 4: Record damaged or missing supplies */}
                        {activeTab === "damages" && (
                            <DamagedMissingSuppliesTab
                                inventoryItems={inventoryItems}
                                onRefresh={() => loadWarehouseData(true)}
                            />
                        )}
                    </div>
                )}
            </div>
        </SessionGuard>
    );
}

export default function WarehousingPage() {
    return (
        <Suspense
            fallback={
                <div className="py-12 space-y-4 max-w-7xl mx-auto px-4">
                    <CardsSkeleton count={4} />
                </div>
            }
        >
            <WarehousingContent />
        </Suspense>
    );
}