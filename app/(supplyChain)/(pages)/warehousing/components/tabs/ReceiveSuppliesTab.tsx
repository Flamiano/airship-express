"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
    Truck, 
    CheckCircle2, 
    Clock, 
    Search, 
    Filter, 
    Plus, 
    Boxes, 
    ArrowDownToLine, 
    FileText, 
    Building2, 
    Calendar, 
    PackageCheck,
    Barcode,
    MapPin,
    AlertCircle,
    X,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Eye,
    ShieldCheck,
    Sparkles,
    RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import Portal from "../../../../components/client/Portal";
import { useDebounce } from "../../../../hooks/useDebounce";
import Cards from "../../../../components/global/Cards";
import { InboundShipmentItem } from "../../types";
import { processDeliveredPurchaseOrdersAction } from "../../../purchase-orders/server/actions/delivery-inventory";
import { logStockMovement } from "../../../inventory/server/stock-movements";
import { DigitalReceiptModal } from "../../../../components/modals/DigitalReceiptModal";
import { Pagination } from "../../../../components/global/pagination";
import { user } from "../../../../lib/services/Class/user";
import { ReportDefectiveItemsModal } from "../modals/ReportDefectiveItemsModal";
import { ReceiveReplacementModal } from "../modals/ReceiveReplacementModal";
import { 
    fetchApprovedReplacementReturnsAction, 
    SupplierReturnRequestRecord 
} from "../../server/supplier-returns-actions";
import { StorageLocationZone } from "../../types";
import { fetchStorageZonesFromDB } from "../../server/warehouse-db";

interface ReceiveSuppliesTabProps {
    inventoryItems: any[];
    purchaseOrders: any[];
    onRefresh: () => void;
}

export function ReceiveSuppliesTab({
    inventoryItems,
    purchaseOrders,
    onRefresh,
}: ReceiveSuppliesTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Delivered">("All");
    const [expandedPOId, setExpandedPOId] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 8;

    // Modal state for Viewing PO Details (view-only)
    const [viewingPO, setViewingPO] = useState<any | null>(null);

    // Modal state for Receiving a PO
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState<any | null>(null);
    const [receiptForm, setReceiptForm] = useState({
        deliveryReceiptNumber: "",
        invoiceNumber: "",
        storageLocation: "",
        condition: "Passed QC Inspection",
        receivedBy: "",
        notes: "",
        itemsReceived: {} as Record<string, number>, // itemId -> qty
    });

    // Direct Stock In modal (ad-hoc receiving)
    const [isDirectStockModalOpen, setIsDirectStockModalOpen] = useState(false);
    const [directStockForm, setDirectStockForm] = useState({
        itemId: "",
        quantity: 1,
        supplierName: "",
        storageLocation: "",
        reason: "",
        drNumber: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal state for Reporting Defective Items
    const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
    const [defectModalTargetPO, setDefectModalTargetPO] = useState<any | null>(null);

    // State for Receiving Approved Replacements
    const [approvedReplacements, setApprovedReplacements] = useState<SupplierReturnRequestRecord[]>([]);
    const [isLoadingReplacements, setIsLoadingReplacements] = useState<boolean>(false);
    const [isReplacementModalOpen, setIsReplacementModalOpen] = useState<boolean>(false);
    const [selectedReplacementClaim, setSelectedReplacementClaim] = useState<SupplierReturnRequestRecord | null>(null);

    const loadApprovedReplacements = useCallback(async () => {
        setIsLoadingReplacements(true);
        try {
            const res = await fetchApprovedReplacementReturnsAction();
            if (res.success && res.data) {
                setApprovedReplacements(res.data);
            }
        } catch (err) {
            console.error("Error fetching approved replacements:", err);
        } finally {
            setIsLoadingReplacements(false);
        }
    }, []);

    useEffect(() => {
        loadApprovedReplacements();

        const channel = supabase
            .channel(`warehouse_replacements_realtime_${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "supplier_return_requests",
                },
                () => {
                    loadApprovedReplacements();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadApprovedReplacements]);

    // State for Storage Zones
    const [storageZones, setStorageZones] = useState<StorageLocationZone[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState<boolean>(false);

    const loadStorageZones = useCallback(async () => {
        setIsLoadingZones(true);
        try {
            const zones = await fetchStorageZonesFromDB();
            setStorageZones(zones);
        } catch (err) {
            console.error("Error loading storage zones in ReceiveSuppliesTab:", err);
        } finally {
            setIsLoadingZones(false);
        }
    }, []);

    useEffect(() => {
        loadStorageZones();

        const channel = supabase
            .channel(`warehouse_receive_zones_realtime_${Math.random().toString(36).substring(2, 9)}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "warehouse_storage_zones",
                },
                () => {
                    loadStorageZones();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadStorageZones]);

    // Live Realtime Subscription for Purchase Orders & Inventory Items
    useEffect(() => {
        const channelId = `warehouse_receive_po_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "purchase_orders" },
                () => {
                    onRefresh();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "inventory_items" },
                () => {
                    onRefresh();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [onRefresh]);

    // Keep viewingPO in sync when live purchase order data updates
    useEffect(() => {
        if (viewingPO) {
            const updated = purchaseOrders.find((p) => String(p.id) === String(viewingPO.id));
            if (updated) {
                setViewingPO(updated);
            }
        }
    }, [purchaseOrders]);

    // Filter purchase orders strictly: ONLY get those with status Issued (or Delivered/received) AND approved by financial AND approved by admin
    const eligibleOrders = useMemo(() => {
        return purchaseOrders.filter((po) => {
            const finApproved = String(po.financial_approval || "").trim().toLowerCase() === "approved";
            const admApproved = String(po.admin_approval || "").trim().toLowerCase() === "approved";
            const st = String(po.status || "").trim().toLowerCase();
            const isIssuedOrDelivered = st === "issued" || st === "delivered" || st === "received";
            return finApproved && admApproved && isIssuedOrDelivered;
        });
    }, [purchaseOrders]);

    // Filter eligible purchase orders using debouncedSearchTerm and statusFilter
    const filteredOrders = useMemo(() => {
        return eligibleOrders.filter((po) => {
            const matchesSearch = 
                (po.po_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (po.supplier_name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (Array.isArray(po.items) && po.items.some((i: any) => (i.item_name || i.name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase())));

            const isDelivered = (po.status || "").toLowerCase() === "delivered" || (po.status || "").toLowerCase() === "received";
            const matchesStatus = 
                statusFilter === "All" ||
                (statusFilter === "Delivered" && isDelivered) ||
                (statusFilter === "Pending" && !isDelivered);

            return matchesSearch && matchesStatus;
        });
    }, [eligibleOrders, debouncedSearchTerm, statusFilter]);

    // Reset pagination on filter or search term change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter]);

    // Paginated slice
    const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredOrders.slice(start, start + pageSize);
    }, [filteredOrders, currentPage, pageSize]);

    // Quick Stats based on eligible orders
    const stats = useMemo(() => {
        const pendingCount = eligibleOrders.filter((po) => {
            const st = (po.status || "").toLowerCase();
            return st !== "delivered" && st !== "received";
        }).length;
        const deliveredCount = eligibleOrders.filter((po) => {
            const st = (po.status || "").toLowerCase();
            return st === "delivered" || st === "received";
        }).length;
        const totalItemsInPending = eligibleOrders
            .filter((po) => {
                const st = (po.status || "").toLowerCase();
                return st !== "delivered" && st !== "received";
            })
            .reduce((acc, po) => acc + (Array.isArray(po.items) ? po.items.length : 1), 0);

        return {
            pendingOrders: pendingCount,
            deliveredOrders: deliveredCount,
            itemsAwaiting: totalItemsInPending,
            totalStockUnits: inventoryItems.reduce((acc, item) => acc + (Number(item.current_stock) || 0), 0),
        };
    }, [eligibleOrders, inventoryItems]);

    // Open Receive Modal for a PO (no hardcoded fallback strings)
    const handleOpenReceiveModal = (po: any) => {
        setSelectedPO(po);
        const initialItemsMap: Record<string, number> = {};
        if (Array.isArray(po.items)) {
            po.items.forEach((item: any, idx: number) => {
                const key = item.id || `item-${idx}`;
                const qty = Number(item.quantity || item.quantity_ordered) || 1;
                initialItemsMap[key] = qty;
            });
        }
        const defaultZone = storageZones.length > 0 ? storageZones[0].zone_code : "";
        setReceiptForm({
            deliveryReceiptNumber: "",
            invoiceNumber: po.po_number || `PO-${po.id}`,
            storageLocation: defaultZone,
            condition: "Passed QC Inspection",
            receivedBy: "",
            notes: "",
            itemsReceived: initialItemsMap,
        });
        setIsReceiveModalOpen(true);
    };

    // Confirm Receiving & Restocking
    const handleConfirmReceiving = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPO) return;

        if (!receiptForm.storageLocation || !receiptForm.storageLocation.trim()) {
            toast.error("Please select a valid Storage Location Destination zone.");
            return;
        }

        setIsSubmitting(true);
        try {
            const deliveryRes = await processDeliveredPurchaseOrdersAction(
                [selectedPO.id],
                {
                    name: receiptForm.receivedBy || user.getName() || "Warehouse Staff",
                    role: user.getRole() || "Warehouse Officer",
                    id: user.getId() || undefined,
                },
                {
                    storageLocation: receiptForm.storageLocation.trim(),
                    deliveryReceiptNumber: receiptForm.deliveryReceiptNumber || undefined,
                    invoiceNumber: receiptForm.invoiceNumber || undefined,
                    notes: receiptForm.notes || undefined,
                    condition: receiptForm.condition || undefined,
                    customQuantities: receiptForm.itemsReceived,
                }
            );

            if (!deliveryRes.success) {
                throw new Error(deliveryRes.error || "Failed to process warehouse delivery.");
            }

            const { totalUpdated, totalCreated } = deliveryRes.summary;
            const details: string[] = [];
            if (totalCreated > 0) details.push(`${totalCreated} new item(s) created in inventory`);
            if (totalUpdated > 0) details.push(`${totalUpdated} stock updated`);
            const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";

            toast.success(`Purchase Order #${selectedPO.po_number} received!${detailStr} & stock movement recorded.`);
            setIsReceiveModalOpen(false);
            onRefresh();
        } catch (err: any) {
            console.error("Error receiving supplies:", err);
            toast.error(err.message || "Failed to complete receiving.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Direct Stock In confirmation
    const handleConfirmDirectStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!directStockForm.itemId || directStockForm.quantity <= 0) {
            toast.error("Please select an item and enter a valid quantity.");
            return;
        }

        setIsSubmitting(true);
        try {
            const matchedInv = inventoryItems.find((inv) => String(inv.id) === String(directStockForm.itemId));
            if (!matchedInv) throw new Error("Item not found");

            const qty = Number(directStockForm.quantity);
            const previousStock = Number(matchedInv.current_stock) || 0;
            const newStock = previousStock + qty;
            const minStock = Number(matchedInv.minimum_stock) || 10;
            const newStatus = newStock <= 0 ? "out-of-stock" : newStock < minStock ? "low-stock" : "available";

            const { error: invErr } = await supabase
                .from("inventory_items")
                .update({
                    current_stock: newStock,
                    status: newStatus,
                    storage_location: directStockForm.storageLocation || matchedInv.storage_location,
                    supplier: directStockForm.supplierName || matchedInv.supplier,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", matchedInv.id);

            if (invErr) throw invErr;

            // Log Stock Movement
            await logStockMovement({
                item_id: matchedInv.id,
                item_code: matchedInv.item_code || `ITM-${matchedInv.id}`,
                item_name: matchedInv.item_name,
                movement_type: "Stock In",
                quantity: qty,
                previous_stock: previousStock,
                new_stock: newStock,
                reference_number: directStockForm.drNumber || "DIRECT-STOCK-IN",
                reason: directStockForm.reason || "Direct warehouse replenishment",
                notes: `Direct stock-in +${qty} ${matchedInv.unit || "units"} | ${directStockForm.storageLocation || matchedInv.storage_location || "Warehouse"}`,
                department: "Warehouse",
                performed_by: user.getName() || "Warehouse Staff",
                performed_by_id: user.getId() || null,
                metadata: {
                    dr_number: directStockForm.drNumber || null,
                    supplier: directStockForm.supplierName || matchedInv.supplier || null,
                    action: "DIRECT_STOCK_IN",
                },
            });

            toast.success(`Restocked ${qty} units of "${matchedInv.item_name}" & recorded stock movement!`);
            setIsDirectStockModalOpen(false);
            onRefresh();
        } catch (err: any) {
            console.error("Error direct stock:", err);
            toast.error(err.message || "Failed to stock item.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Overview & Metrics - Cards Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Cards
                    frontIcon="fas fa-clock mr-1"
                    header="Inbound Orders"
                    data={stats.pendingOrders.toString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Awaiting Delivery"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Inbound Deliveries"
                    backIcon="fas fa-truck"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.pendingOrders} purchase orders currently awaiting receipt, dock check-in, or vendor dispatch.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Items Expected"
                    data={stats.itemsAwaiting.toString()}
                    arrow="fas fa-arrow-right mr-1"
                    description="Line Items"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Expected Line Items"
                    backIcon="fas fa-boxes-stacked"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.itemsAwaiting} line items expected across all pending vendor purchase orders.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-circle-check mr-1"
                    header="Received & Stocked"
                    data={stats.deliveredOrders.toString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Orders Processed"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Received Orders"
                    backIcon="fas fa-circle-check"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.deliveredOrders} purchase orders completed, verified through quality control, and stocked.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-box mr-1"
                    header="Warehouse Stock"
                    data={stats.totalStockUnits.toLocaleString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Total Units"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Warehouse Inventory"
                    backIcon="fas fa-warehouse"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total inventory on hand: ${stats.totalStockUnits.toLocaleString()} physical units stored across warehouse zones.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            {/* 2. Controls & Actions Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by PO #, supplier name, or item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] p-0.5 border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] shrink-0">
                        {(["All", "Pending", "Delivered"] as const).map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setStatusFilter(filter)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    statusFilter === filter
                                        ? "bg-pink-500 text-white shadow-[0_2px_8px_rgba(236,72,153,0.35)]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={eligibleOrders.length === 0}
                        onClick={() => {
                            if (eligibleOrders.length === 0) return;
                            setDefectModalTargetPO(null);
                            setIsDefectModalOpen(true);
                        }}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            eligibleOrders.length === 0
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60 shadow-none pointer-events-none"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] cursor-pointer active:scale-95"
                        }`}
                        title={
                            eligibleOrders.length === 0
                                ? "No receiving shipments available to report defective items"
                                : "Report damaged, nonconforming, or defective items during receiving or inspection"
                        }
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Report Defective Items</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsDirectStockModalOpen(true)}
                        className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ad-hoc Stock In</span>
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        className="p-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] text-slate-600 dark:text-slate-300 hover:text-pink-600 text-xs font-bold transition-all cursor-pointer active:scale-95"
                        title="Refresh Supplier Shipments"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Approved Supplier Replacements Ready for Warehouse Intake */}
            {approvedReplacements.length > 0 && (
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 shadow-[3px_3px_7px_rgba(166,175,195,0.25),-3px_-3px_7px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5)] space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <RotateCcw className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                        Approved Supplier Replacements Awaiting Intake ({approvedReplacements.length})
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        Dock Intake Ready
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Approved defective return claims with Replacement resolution. Ready for dock verification and inventory restock.
                                </p>
                            </div>
                        </div>

                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {approvedReplacements.reduce((acc, r) => acc + (Number(r.defective_quantity) || 0), 0)} units total pending
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-500/15">
                        {approvedReplacements.map((rep) => (
                            <div
                                key={`rep_card_${rep.id}`}
                                className="p-3 sm:p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-emerald-500/20 flex items-center justify-between gap-3 shadow-xs"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                            {rep.item_name}
                                        </span>
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
                                            {rep.defective_quantity} {rep.unit}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        PO #{rep.po_number} • Vendor: {rep.supplier_name} • RMA: {rep.resolution_details?.supplier_reference || "Assigned"}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedReplacementClaim(rep);
                                        setIsReplacementModalOpen(true);
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Receive Replacement</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Inbound Supplier Shipments Table / Cards */}
            <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                    <div className="p-12 text-center rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)]">
                        <Truck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Supplier Orders Found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            No supplier orders match your search or filter. Issue purchase orders in Procurement or use Ad-hoc Stock In.
                        </p>
                    </div>
                ) : (
                    paginatedOrders.map((po) => {
                        const isDelivered = po.status === "Delivered" || po.status === "received";
                        const isExpanded = expandedPOId === po.id;
                        const itemsList = Array.isArray(po.items) ? po.items : [];
                        const poReplacements = approvedReplacements.filter(
                            (r) => r.po_number === po.po_number || r.purchase_order_id === po.id
                        );

                        return (
                            <div
                                key={po.id}
                                className="rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] overflow-hidden transition-all"
                            >
                                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-start gap-3.5 min-w-[240px]">
                                        <div
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                isDelivered
                                                    ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400"
                                                    : "bg-[#f0f4f9] dark:bg-[#14151c] text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            <Truck className="w-5 h-5" />
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                                    #{po.po_number || `PO-${po.id}`}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                                        isDelivered
                                                            ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40"
                                                            : "bg-pink-500 text-white"
                                                    }`}
                                                >
                                                    {isDelivered ? "Received" : "Issued"}
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                    <span>Admin: Approved</span>
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                                                    <span>Finance: Approved</span>
                                                </span>
                                                {poReplacements.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                                                        <RotateCcw className="w-3 h-3 text-emerald-500" />
                                                        <span>Replacement Ready ({poReplacements.length})</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-pink-500" />
                                                <span>{po.supplier_name || "Assigned Supplier"}</span>
                                            </div>

                                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                                                <span>Ordered: {new Date(po.created_at || Date.now()).toLocaleDateString()}</span>
                                                {po.delivery_date && (
                                                    <span>• Delivered: {new Date(po.delivery_date).toLocaleDateString()}</span>
                                                )}
                                                <span>• {itemsList.length} items</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setViewingPO(po)}
                                            className="px-3 py-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-[#e2e8f0] dark:hover:bg-[#1a1c2d] text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),_2px_2px_5px_rgba(163,177,198,0.3)] dark:shadow-[-1px_-1px_4px_rgba(255,255,255,0.02),_1px_1px_4px_rgba(0,0,0,0.4)] active:shadow-[inset_1px_1px_2px_rgba(163,177,198,0.4)] border border-white/60 dark:border-white/[0.05]"
                                            title="View complete purchase order details (view only)"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-pink-500" />
                                            <span>View PO Details</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setExpandedPOId(isExpanded ? null : po.id)}
                                            className="px-3 py-2 rounded-2xl bg-[#f0f4f9] dark:bg-[#14151c] hover:bg-[#e4ebf5] text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>{isExpanded ? "Hide Items" : "View Items"}</span>
                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDefectModalTargetPO(po);
                                                setIsDefectModalOpen(true);
                                            }}
                                            className="px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                            title="Report Defective / Damaged items for this purchase order"
                                        >
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                            <span>Report Defect</span>
                                        </button>

                                        {/* Approved Replacement Receiving Button if this PO has approved replacement claims */}
                                        {poReplacements.map((rep) => (
                                            <button
                                                key={`btn_rep_${rep.id}`}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedReplacementClaim(rep);
                                                    setIsReplacementModalOpen(true);
                                                }}
                                                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                                title={`Receive approved replacement for Claim #${rep.return_request_number} (${rep.item_name})`}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                                <span>Receive Replacement ({rep.defective_quantity} {rep.unit})</span>
                                            </button>
                                        ))}

                                        {!isDelivered ? (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenReceiveModal(po)}
                                                className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                            >
                                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                                <span>Receive Supplies</span>
                                            </button>
                                        ) : (
                                            <div className="px-3 py-1.5 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 text-xs font-bold border border-pink-200 dark:border-pink-800/40 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Stocked in Warehouse</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Line Items Detail */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-white/[0.04] bg-[#f8fafc]/50 dark:bg-[#141624]/30">
                                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2.5">
                                            Ordered Items Breakdown:
                                        </h5>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                                        <th className="pb-2">Item Name</th>
                                                        <th className="pb-2">SKU / Code</th>
                                                        <th className="pb-2 text-right">Quantity Ordered</th>
                                                        <th className="pb-2 text-right">Unit Price</th>
                                                        <th className="pb-2 text-right">Current Warehouse Stock</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {itemsList.map((item: any, idx: number) => {
                                                        const matchedInv = inventoryItems.find(
                                                            (inv) => 
                                                                (inv.item_name && (item.item_name || item.name) && inv.item_name.toLowerCase() === (item.item_name || item.name).toLowerCase())
                                                        );

                                                        return (
                                                            <tr key={idx} className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10">
                                                                <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                                                    {item.item_name || item.name || "Supplies"}
                                                                </td>
                                                                <td className="py-2.5 font-mono text-[11px] text-slate-400">
                                                                    {item.item_code || matchedInv?.item_code || "—"}
                                                                </td>
                                                                <td className="py-2.5 text-right font-black text-pink-600 dark:text-pink-400">
                                                                    {item.quantity || item.quantity_ordered || 1} {item.unit || "units"}
                                                                </td>
                                                                <td className="py-2.5 text-right text-slate-600 dark:text-slate-300 font-mono">
                                                                    ₱{Number(item.unit_price || item.price || 0).toLocaleString()}
                                                                </td>
                                                                <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                                                                    {matchedInv ? `${matchedInv.current_stock} ${matchedInv.unit}` : "Not in inventory"}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Pagination Controls */}
                {filteredOrders.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 px-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredOrders.length)}</span> of{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{filteredOrders.length}</span> purchase orders
                        </p>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            {/* 4. Modal: Receive Shipment from Supplier */}
            {isReceiveModalOpen && selectedPO && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-xl rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <ArrowDownToLine className="w-5 h-5 text-pink-500" />
                                        <span>Receive Inbound Supplies</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        PO #{selectedPO.po_number} • Supplier: {selectedPO.supplier_name}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsReceiveModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmReceiving} className="mt-5 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Delivery Receipt (DR) #
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={receiptForm.deliveryReceiptNumber}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, deliveryReceiptNumber: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                            placeholder="Enter DR #"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            PO Number
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={selectedPO?.po_number ? `#${selectedPO.po_number}` : (receiptForm.invoiceNumber ? `#${receiptForm.invoiceNumber}` : "—")}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#101118] shadow-[inset_1px_1px_3px_rgba(166,175,195,0.25),inset_-1px_-1px_3px_rgba(255,255,255,0.6)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold cursor-not-allowed select-none opacity-90"
                                            placeholder="PO Number"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Storage Location Destination <span className="text-pink-500 font-black">*</span>
                                        </label>
                                        <select
                                            required
                                            value={receiptForm.storageLocation}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, storageLocation: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        >
                                            <option value="">-- Select Destination Storage Zone (Required) --</option>
                                            {storageZones.map((zone) => (
                                                <option key={zone.id || zone.zone_code} value={zone.zone_code}>
                                                    {zone.zone_code} — {zone.zone_name} ({zone.building_or_hub || "Main Hub"})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Quality Inspection Result
                                        </label>
                                        <select
                                            value={receiptForm.condition}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, condition: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="Passed QC Inspection">Passed QC Inspection (100% Good)</option>
                                            <option value="Minor Packaging Wear">Minor Packaging Wear (Acceptable)</option>
                                            <option value="Partial Delivery">Partial Delivery (Follow-up Needed)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Line items quantity confirmation */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                        Verify Received Quantities:
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {Array.isArray(selectedPO.items) && selectedPO.items.map((item: any, idx: number) => {
                                            const key = item.id || `item-${idx}`;
                                            const curVal = receiptForm.itemsReceived[key] ?? Number(item.quantity || item.quantity_ordered || 1);

                                            return (
                                                <div
                                                    key={key}
                                                    className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3"
                                                >
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                            {item.item_name || item.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            Ordered: {item.quantity || item.quantity_ordered} {item.unit || "units"}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-slate-500 font-bold">Qty Received:</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={curVal}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10) || 0;
                                                                setReceiptForm({
                                                                    ...receiptForm,
                                                                    itemsReceived: {
                                                                        ...receiptForm.itemsReceived,
                                                                        [key]: val,
                                                                    },
                                                                });
                                                            }}
                                                            className="w-20 px-2 py-1 text-xs text-right font-black rounded-lg bg-white dark:bg-[#1a1c29] border border-slate-300 dark:border-slate-700 text-pink-600 dark:text-pink-400 focus:outline-none focus:border-pink-500"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Receiving Notes &amp; Inspector Remarks
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={receiptForm.notes}
                                        onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        placeholder="Add inspection remarks or notes..."
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsReceiveModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition-all shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Restocking Inventory...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Confirm &amp; Restock</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 5. Modal: Ad-hoc Direct Stock In */}
            {isDirectStockModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-lg rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-pink-500" />
                                        <span>Ad-hoc Warehouse Stock In</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Directly increase warehouse stock without an existing Purchase Order.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsDirectStockModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#f0f3f8] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmDirectStock} className="mt-5 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Select Inventory Item to Restock
                                    </label>
                                    <select
                                        required
                                        value={directStockForm.itemId}
                                        onChange={(e) => setDirectStockForm({ ...directStockForm, itemId: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                    >
                                        <option value="">-- Choose Item from Inventory --</option>
                                        {inventoryItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.item_name} ({item.item_code}) - Current: {item.current_stock} {item.unit}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Quantity to Add
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            required
                                            value={directStockForm.quantity}
                                            onChange={(e) => setDirectStockForm({ ...directStockForm, quantity: parseInt(e.target.value, 10) || 1 })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Supplier / Source Name
                                        </label>
                                        <input
                                            type="text"
                                            value={directStockForm.supplierName}
                                            onChange={(e) => setDirectStockForm({ ...directStockForm, supplierName: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="Enter supplier name"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Storage Bin / Location <span className="text-pink-500 font-black">*</span>
                                        </label>
                                        <select
                                            required
                                            value={directStockForm.storageLocation}
                                            onChange={(e) => setDirectStockForm({ ...directStockForm, storageLocation: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        >
                                            <option value="">-- Select Destination Storage Zone (Required) --</option>
                                            {storageZones.map((zone) => (
                                                <option key={zone.id || zone.zone_code} value={zone.zone_code}>
                                                    {zone.zone_code} — {zone.zone_name} ({zone.building_or_hub || "Main Hub"})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            DR or Reference #
                                        </label>
                                        <input
                                            type="text"
                                            value={directStockForm.drNumber}
                                            onChange={(e) => setDirectStockForm({ ...directStockForm, drNumber: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                            placeholder="Enter reference #"
                                        />
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsDirectStockModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition-all shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.55)] cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Confirm Stock In</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* View-Only Purchase Order Details Modal */}
            <DigitalReceiptModal
                isOpen={Boolean(viewingPO)}
                onClose={() => setViewingPO(null)}
                order={viewingPO}
            />

            {/* Modal for Reporting Defective Items & Initiating Supplier Return */}
            <ReportDefectiveItemsModal
                isOpen={isDefectModalOpen}
                onClose={() => {
                    setIsDefectModalOpen(false);
                    setDefectModalTargetPO(null);
                }}
                purchaseOrders={eligibleOrders}
                initialPO={defectModalTargetPO}
                onSuccess={() => {
                    onRefresh();
                }}
            />

            {/* Modal for Receiving Approved Supplier Replacements */}
            <ReceiveReplacementModal
                isOpen={isReplacementModalOpen}
                onClose={() => {
                    setIsReplacementModalOpen(false);
                    setSelectedReplacementClaim(null);
                }}
                returnRequest={selectedReplacementClaim}
                inventoryItems={inventoryItems}
                onSuccess={() => {
                    loadApprovedReplacements();
                    onRefresh();
                }}
            />
        </div>
    );
}
