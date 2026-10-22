"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
    AlertTriangle, 
    FileWarning, 
    Search, 
    Plus, 
    CheckCircle2, 
    Trash2, 
    ShieldAlert, 
    Boxes, 
    Building2, 
    Calendar, 
    Clock, 
    DollarSign,
    Filter,
    X,
    RefreshCw,
    MoreVertical,
    RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import { DamagedMissingIncident, StorageLocationZone } from "../../types";
import Portal from "../../../../components/client/Portal";
import { useDebounce } from "../../../../hooks/useDebounce";
import Cards from "../../../../components/global/Cards";
import { logStockMovement } from "../../../inventory/server/stock-movements";
import { user } from "../../../../lib/services/Class/user";
import { Pagination } from "../../../../components/global/pagination";
import { 
    fetchDamageIncidentsFromDB, 
    insertDamageIncidentToDB, 
    updateDamageIncidentStatusInDB,
    restoreDamageIncidentStockInDB,
    writeOffDamageIncidentStockInDB,
    returnToVendorDamageIncidentInDB,
    deleteDamageIncidentFromDB,
    fetchStorageZonesFromDB,
    supabaseWarehouseDb
} from "../../server/warehouse-db";

interface DamagedMissingSuppliesTabProps {
    inventoryItems: any[];
    onRefresh: () => void;
}

export function DamagedMissingSuppliesTab({
    inventoryItems,
    onRefresh,
}: DamagedMissingSuppliesTabProps) {
    const [incidents, setIncidents] = useState<DamagedMissingIncident[]>([]);
    const [isLoadingIncidents, setIsLoadingIncidents] = useState<boolean>(true);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 8;

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, typeFilter, statusFilter]);

    // Storage zones for location detection and option input
    const [zones, setZones] = useState<StorageLocationZone[]>([]);

    // Modal state for Reporting Discrepancy
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportForm, setReportForm] = useState({
        itemId: "",
        quantity: 1,
        discrepancy_type: "Damaged in Transit" as DamagedMissingIncident["discrepancy_type"],
        severity: "Moderate" as DamagedMissingIncident["severity"],
        detected_at_location: "",
        reported_by: "",
        incident_notes: "",
        deductStock: true, // auto-deduct from inventory stock
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selected item for the report modal
    const selectedReportItem = useMemo(() => {
        return inventoryItems.find((inv) => String(inv.id) === String(reportForm.itemId));
    }, [inventoryItems, reportForm.itemId]);

    const availableStock = Math.max(0, Number(selectedReportItem?.current_stock) || 0);

    // Load zones directly from database
    const loadZones = useCallback(async () => {
        try {
            const data = await fetchStorageZonesFromDB();
            setZones(data);
        } catch (err: any) {
            console.warn("Failed to load storage zones for discrepancy logging:", err);
        }
    }, []);

    // Load incidents directly from database
    const loadIncidents = useCallback(async () => {
        try {
            setIsLoadingIncidents(true);
            const data = await fetchDamageIncidentsFromDB();
            setIncidents(data);
        } catch (err: any) {
            console.error("Failed to load damage incidents:", err);
        } finally {
            setIsLoadingIncidents(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                localStorage.removeItem("airship_damage_incidents");
            } catch {
                // ignore
            }
        }
        loadIncidents();
        loadZones();
    }, [loadIncidents, loadZones]);

    // Supabase Live Realtime Subscription for damage incidents, storage zones & inventory
    useEffect(() => {
        const channelId = `warehouse_damage_incidents_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "warehouse_damage_incidents" },
                () => {
                    loadIncidents();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "warehouse_storage_zones" },
                () => {
                    loadZones();
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
    }, [loadIncidents, loadZones, onRefresh]);

    // Filter incidents
    const filteredIncidents = useMemo(() => {
        return incidents.filter((inc) => {
            const matchesSearch =
                (inc.incident_number || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (inc.item_name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (inc.item_code || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (inc.reported_by || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesType = typeFilter === "All" || inc.discrepancy_type === typeFilter;
            const matchesStatus = statusFilter === "All" || inc.status === statusFilter;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [incidents, debouncedSearchTerm, typeFilter, statusFilter]);

    const totalPages = Math.ceil(filteredIncidents.length / pageSize) || 1;

    const paginatedIncidents = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredIncidents.slice(startIndex, startIndex + pageSize);
    }, [filteredIncidents, currentPage, pageSize]);

    // Quick Stats
    const stats = useMemo(() => {
        const totalUnitsDamaged = incidents.reduce((acc, i) => acc + i.quantity, 0);
        const totalLossValue = incidents.reduce((acc, i) => acc + i.total_estimated_loss, 0);
        const activeUnderInvestigation = incidents.filter((i) => i.status === "Under Investigation").length;
        const writtenOffCount = incidents.filter((i) => i.status === "Written Off").length;

        return {
            totalIncidents: incidents.length,
            totalUnitsDamaged,
            totalLossValue,
            activeUnderInvestigation,
            writtenOffCount,
        };
    }, [incidents]);

    // Handle Report Discrepancy Submission to Database
    const handleConfirmReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportForm.itemId || reportForm.quantity <= 0) {
            toast.error("Please select an item and enter a valid quantity.");
            return;
        }

        setIsSubmitting(true);
        try {
            const matchedInv = inventoryItems.find((inv) => String(inv.id) === String(reportForm.itemId));
            if (!matchedInv) throw new Error("Inventory item not found");

            const unitPrice = Number(matchedInv.purchase_price) || 100;
            const totalLoss = reportForm.quantity * unitPrice;
            const incidentNum = `DISC-${new Date().getFullYear()}-${String(incidents.length + 1).padStart(3, "0")}`;

            // If user checked "Deduct from Inventory Stock", update Supabase inventory and stock_movements
            if (reportForm.deductStock) {
                const curStock = Number(matchedInv.current_stock) || 0;
                const deductQty = Math.max(1, Number(reportForm.quantity) || 1);
                const newStock = Math.max(0, curStock - deductQty);
                const minStock = Number(matchedInv.minimum_stock) || 0;
                const newStatus = newStock === 0 ? "out-of-stock" : newStock <= minStock ? "low-stock" : "available";

                // 1. Update inventory_items using service role client
                const { error: invErr } = await supabaseWarehouseDb
                    .from("inventory_items")
                    .update({
                        current_stock: newStock,
                        status: newStatus,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", matchedInv.id);

                if (invErr) {
                    console.error("Failed to update inventory_items:", invErr);
                    throw new Error(invErr.message || "Failed to update item stock.");
                }

                // 2. Immediately put in stock_movements table
                const movementPayload = {
                    item_id: String(matchedInv.id),
                    item_code: matchedInv.item_code || `ITM-${matchedInv.id}`,
                    item_name: matchedInv.item_name,
                    movement_type: "Stock Out",
                    quantity: deductQty,
                    previous_stock: curStock,
                    new_stock: newStock,
                    reference_number: incidentNum,
                    reason: `Damaged/Missing Discrepancy (${reportForm.discrepancy_type}): ${reportForm.incident_notes || "Damaged supplies write-off"}`,
                    department: "Warehouse / Storage",
                    performed_by: reportForm.reported_by || user.getName() || "Warehouse Staff",
                    performed_by_id: user.getId() || null,
                    metadata: {
                        incident_number: incidentNum,
                        discrepancy_type: reportForm.discrepancy_type,
                        severity: reportForm.severity,
                        detected_at_location: reportForm.detected_at_location,
                        action: "DAMAGE_DISCREPANCY_WRITE_OFF",
                        loss_value: totalLoss,
                    },
                    created_at: new Date().toISOString(),
                };

                const { error: smErr } = await supabaseWarehouseDb
                    .from("stock_movements")
                    .insert([movementPayload]);

                if (smErr) {
                    console.warn("Direct insert into stock_movements warning, invoking logStockMovement:", smErr);
                    await logStockMovement({
                        item_id: matchedInv.id,
                        item_code: matchedInv.item_code || `ITM-${matchedInv.id}`,
                        item_name: matchedInv.item_name,
                        movement_type: "Stock Out",
                        quantity: deductQty,
                        previous_stock: curStock,
                        new_stock: newStock,
                        reference_number: incidentNum,
                        reason: `${reportForm.discrepancy_type}: ${reportForm.incident_notes || "Damaged/missing stock write-off"}`,
                        notes: `Severity: ${reportForm.severity} | Location: ${reportForm.detected_at_location || "Warehouse"}`,
                        department: "Warehouse / Storage",
                        performed_by: reportForm.reported_by || user.getName() || "Warehouse Staff",
                        performed_by_id: user.getId() || null,
                        metadata: {
                            incident_number: incidentNum,
                            discrepancy_type: reportForm.discrepancy_type,
                            severity: reportForm.severity,
                            detected_at_location: reportForm.detected_at_location,
                            action: "DAMAGE_DISCREPANCY_WRITE_OFF",
                        },
                    });
                }

                // 3. Update warehouse_storage_zones capacity if detected location matches a zone
                const normLoc = (reportForm.detected_at_location || matchedInv.storage_location || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                const affectedZone = zones.find((z) => {
                    const normCode = (z.zone_code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const normName = (z.zone_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    return normLoc && (normLoc.includes(normCode) || normLoc.includes(normName) || normCode.includes(normLoc));
                });
                if (affectedZone) {
                    const updatedUtilized = Math.max(0, (Number(affectedZone.current_utilized_units) || 0) - deductQty);
                    await supabaseWarehouseDb
                        .from("warehouse_storage_zones")
                        .update({
                            current_utilized_units: updatedUtilized,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", affectedZone.id);
                }
            }

            // Insert directly into public.warehouse_damage_incidents database table
            const inserted = await insertDamageIncidentToDB({
                incident_number: incidentNum,
                item_id: String(matchedInv.id),
                item_code: matchedInv.item_code || `ITM-${matchedInv.id}`,
                item_name: matchedInv.item_name,
                category: matchedInv.category || "General Supplies",
                quantity: reportForm.quantity,
                unit: matchedInv.unit || "units",
                discrepancy_type: reportForm.discrepancy_type,
                severity: reportForm.severity,
                unit_cost: unitPrice,
                total_estimated_loss: totalLoss,
                detected_at_location: reportForm.detected_at_location,
                reported_by: reportForm.reported_by || user.getName() || "Warehouse Staff",
                reported_at: new Date().toISOString(),
                status: reportForm.deductStock ? "Written Off" : "Under Investigation",
                action_taken: reportForm.deductStock ? "Stock Deducted / Disposed" : "Quarantine for Claim",
                incident_notes: reportForm.incident_notes || "Reported during warehouse operations.",
            });

            setIncidents((prev) => [inserted, ...prev]);
            toast.success(`Incident ${inserted.incident_number} recorded in database!`);
            setIsReportModalOpen(false);
            setReportForm({
                itemId: "",
                quantity: 1,
                discrepancy_type: "Damaged in Transit",
                severity: "Moderate",
                detected_at_location: "",
                reported_by: "",
                incident_notes: "",
                deductStock: true,
            });
            onRefresh();
        } catch (err: any) {
            console.error("Error reporting discrepancy:", err);
            toast.error(err.message || "Failed to log discrepancy to database.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update Incident status in Database with automatic stock adjustments
    const handleUpdateStatus = async (incidentId: string, newStatus: DamagedMissingIncident["status"]) => {
        try {
            setIsLoadingIncidents(true);
            const targetIncident = incidents.find((i) => i.id === incidentId);
            const performer = user.getName() || "Warehouse Staff";

            if (newStatus === "Replaced / Restored") {
                await restoreDamageIncidentStockInDB(incidentId, performer);
                setIncidents((prev) =>
                    prev.map((inc) =>
                        inc.id === incidentId
                            ? { ...inc, status: "Replaced / Restored", action_taken: "Repackaged" }
                            : inc
                    )
                );
                toast.success(`Incident updated to "Replaced / Restored" & stock restored to inventory.`);
                onRefresh();
            } else if (newStatus === "Written Off") {
                await writeOffDamageIncidentStockInDB(incidentId, performer, true);
                setIncidents((prev) =>
                    prev.map((inc) =>
                        inc.id === incidentId
                            ? { ...inc, status: "Written Off", action_taken: "Stock Deducted / Disposed" }
                            : inc
                    )
                );
                toast.success(`Incident updated to "Written Off" & stock written off.`);
                onRefresh();
            } else if (newStatus === "Returned to Vendor (RMA)") {
                await returnToVendorDamageIncidentInDB(incidentId);
                setIncidents((prev) =>
                    prev.map((inc) =>
                        inc.id === incidentId
                            ? { ...inc, status: "Returned to Vendor (RMA)", action_taken: "Quarantine for Claim" }
                            : inc
                    )
                );
                toast.success(`Incident status updated to "Returned to Vendor (RMA)".`);
            } else {
                await updateDamageIncidentStatusInDB(incidentId, "Under Investigation", "Quarantine for Claim");
                setIncidents((prev) =>
                    prev.map((inc) =>
                        inc.id === incidentId
                            ? { ...inc, status: "Under Investigation", action_taken: "Quarantine for Claim" }
                            : inc
                    )
                );
                toast.success(`Incident status updated to "Under Investigation".`);
            }
        } catch (err: any) {
            console.error("Error updating incident status:", err);
            toast.error(err.message || "Failed to update incident status.");
        } finally {
            setIsLoadingIncidents(false);
        }
    };

    // Quick restore action for warehouse discrepancies
    const handleRestoreStock = async (inc: DamagedMissingIncident) => {
        if (!confirm(`Restore ${inc.quantity} ${inc.unit} of "${inc.item_name}" back to active warehouse inventory?\n\nThis will increase current inventory stock, record a "Stock In" movement, and automatically mark the incident as "Replaced / Restored".`)) {
            return;
        }

        try {
            setIsLoadingIncidents(true);
            const performer = user.getName() || "Warehouse Staff";
            const res = await restoreDamageIncidentStockInDB(inc.id, performer);
            setIncidents((prev) =>
                prev.map((item) =>
                    item.id === inc.id
                        ? { ...item, status: "Replaced / Restored", action_taken: "Repackaged" }
                        : item
                )
            );
            toast.success(`Successfully restored ${res.restoredQuantity} units of ${res.itemName} back to inventory! Status is now Replaced / Restored.`);
            onRefresh();
        } catch (err: any) {
            console.error("Error restoring incident stock:", err);
            toast.error(err.message || "Failed to restore stock into inventory.");
        } finally {
            setIsLoadingIncidents(false);
        }
    };

    // Delete Incident from Database
    const handleDeleteIncident = async (incidentId: string) => {
        if (!confirm("Are you sure you want to delete this incident report from the database?")) return;
        try {
            await deleteDamageIncidentFromDB(incidentId);
            setIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
            toast.success("Incident record removed from database.");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete incident record.");
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Overview & Metrics - Cards Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Cards
                    frontIcon="fas fa-triangle-exclamation mr-1"
                    header="Total Incidents"
                    data={stats.totalIncidents.toString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Logged Reports"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Incident Reports"
                    backIcon="fas fa-file-circle-exclamation"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.totalIncidents} damage, loss, or breakage discrepancy incidents recorded in database.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-boxes-packing mr-1"
                    header="Affected Units"
                    data={stats.totalUnitsDamaged.toString()}
                    arrow="fas fa-arrow-down mr-1"
                    description="Damaged / Missing"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Physical Loss Units"
                    backIcon="fas fa-boxes-packing"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.totalUnitsDamaged} units recorded as physically damaged, expired, or unaccounted for.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-peso-sign mr-1"
                    header="Estimated Loss"
                    data={`₱${stats.totalLossValue.toLocaleString()}`}
                    arrow="fas fa-chart-line-down mr-1"
                    description="Financial Impact"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Financial Impact"
                    backIcon="fas fa-file-invoice-dollar"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Total monetary damage value: ₱${stats.totalLossValue.toLocaleString()} across recorded incidents.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-shield-halved mr-1"
                    header="Under Investigation"
                    data={stats.activeUnderInvestigation.toString()}
                    arrow="fas fa-clock mr-1"
                    description="Open Audits"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Open Investigations"
                    backIcon="fas fa-shield-halved"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${stats.activeUnderInvestigation} discrepancy incidents currently pending internal or supplier audit.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            {/* 2. Controls & Actions Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-[260px] flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by incident #, item, or reporter..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 transition-colors"
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

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                        <option value="All">All Discrepancy Types</option>
                        <option value="Damaged in Transit">Damaged in Transit</option>
                        <option value="Expired Shelf-Life">Expired Shelf-Life</option>
                        <option value="Defective from Supplier">Defective from Supplier</option>
                        <option value="Missing during Audit">Missing during Audit</option>
                        <option value="Water / Environmental Damage">Water Damage</option>
                        <option value="Spillage">Spillage</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Under Investigation">Under Investigation</option>
                        <option value="Written Off">Written Off</option>
                        <option value="Returned to Vendor (RMA)">Returned to Vendor (RMA)</option>
                        <option value="Replaced / Restored">Replaced / Restored</option>
                    </select>

                    <button
                        type="button"
                        onClick={loadIncidents}
                        disabled={isLoadingIncidents}
                        title="Reload Incidents"
                        className="p-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-500 hover:text-pink-500 transition-colors cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIncidents ? "animate-spin" : ""}`} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (inventoryItems.length > 0) {
                                const firstItem = inventoryItems[0];
                                setReportForm({
                                    itemId: String(firstItem.id),
                                    quantity: 1,
                                    discrepancy_type: "Damaged in Transit",
                                    severity: "Moderate",
                                    detected_at_location: firstItem.storage_location || "",
                                    reported_by: "",
                                    incident_notes: "",
                                    deductStock: true,
                                });
                            } else {
                                setReportForm({
                                    itemId: "",
                                    quantity: 1,
                                    discrepancy_type: "Damaged in Transit",
                                    severity: "Moderate",
                                    detected_at_location: "",
                                    reported_by: "",
                                    incident_notes: "",
                                    deductStock: true,
                                });
                            }
                            setIsReportModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Report Discrepancy</span>
                    </button>
                </div>
            </div>

            {/* 3. Incidents Log Table */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)]">
                {isLoadingIncidents ? (
                    <div className="p-12 text-center">
                        <RefreshCw className="w-8 h-8 mx-auto text-pink-500 animate-spin mb-3" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Loading Incidents...</h4>
                        <p className="text-xs text-slate-400 mt-1">Fetching latest incident records.</p>
                    </div>
                ) : filteredIncidents.length === 0 ? (
                    <div className="p-12 text-center">
                        <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Discrepancy Incidents Logged</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            All warehouse supplies and inventory records are fully reconciled in the database. Use Report Discrepancy if damaged or missing goods are identified.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-pro w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                    <th className="pb-3">Incident #</th>
                                    <th className="pb-3">Item Details</th>
                                    <th className="pb-3">Discrepancy Type</th>
                                    <th className="pb-3 text-right">Quantity</th>
                                    <th className="pb-3 text-right">Est. Loss</th>
                                    <th className="pb-3">Location</th>
                                    <th className="pb-3">Status</th>
                                    <th className="pb-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {paginatedIncidents.map((inc) => (
                                    <tr key={inc.id} className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10">
                                        <td data-label="Incident #" className="py-3 font-mono font-bold text-pink-600 dark:text-pink-400">
                                            {inc.incident_number}
                                            <div className="text-[10px] text-slate-400 font-sans">
                                                {new Date(inc.reported_at).toLocaleDateString()}
                                            </div>
                                        </td>

                                        <td data-label="Item" className="py-3">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">{inc.item_name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                {inc.item_code} • {inc.category}
                                            </div>
                                        </td>

                                        <td data-label="Discrepancy" className="py-3">
                                            <div className="font-semibold text-slate-700 dark:text-slate-300">{inc.discrepancy_type}</div>
                                            {inc.incident_notes && (
                                                <div className="text-[10px] text-slate-400 truncate max-w-xs">{inc.incident_notes}</div>
                                            )}
                                        </td>

                                        <td data-label="Quantity" className="py-3 text-right font-black text-red-600 dark:text-red-400 font-mono">
                                            -{inc.quantity} {inc.unit}
                                        </td>

                                        <td data-label="Est. Loss" className="py-3 text-right font-black text-slate-900 dark:text-white font-mono">
                                            ₱{inc.total_estimated_loss.toLocaleString()}
                                        </td>

                                        <td data-label="Location" className="py-3 text-slate-500 text-[11px]">
                                            {inc.detected_at_location || "-"}
                                        </td>

                                        <td data-label="Status" className="py-3">
                                            <select
                                                value={inc.status}
                                                onChange={(e) => handleUpdateStatus(inc.id, e.target.value as any)}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border focus:outline-none transition-all ${
                                                    inc.status === "Written Off"
                                                        ? "bg-pink-50 dark:bg-pink-950/40 text-pink-600 border-pink-200 dark:border-pink-800/40"
                                                        : inc.status === "Returned to Vendor (RMA)"
                                                        ? "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                                                        : inc.status === "Replaced / Restored"
                                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800/40"
                                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800/40"
                                                }`}
                                            >
                                                <option value="Under Investigation">Under Investigation</option>
                                                <option value="Written Off">Written Off</option>
                                                <option value="Returned to Vendor (RMA)">Returned to Vendor (RMA)</option>
                                                <option value="Replaced / Restored">Replaced / Restored</option>
                                            </select>
                                        </td>

                                        <td data-label="Actions" className="py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {inc.status !== "Replaced / Restored" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreStock(inc)}
                                                        title={`Restore ${inc.quantity} ${inc.unit} back to active inventory`}
                                                        className="px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/50 transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        <span>Restore</span>
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Restored</span>
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteIncident(inc.id)}
                                                    title="Delete record from database"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {filteredIncidents.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredIncidents.length)}</span> of{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredIncidents.length}</span> discrepancy incidents
                        </div>
                        {totalPages > 1 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* 4. Modal: Report Discrepancy or Damage */}
            {isReportModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-lg rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-pink-500" />
                                        <span>Log Damaged or Missing Supplies</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Record inventory discrepancy directly into database and adjust stock.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsReportModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmReport} className="mt-5 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Select Affected Inventory Item
                                    </label>
                                    <select
                                        required
                                        value={reportForm.itemId}
                                        onChange={(e) => {
                                            const selected = inventoryItems.find((inv) => String(inv.id) === e.target.value);
                                            const itemLocation = selected?.storage_location || "";
                                            const inStock = Math.max(0, Number(selected?.current_stock) || 0);
                                            setReportForm({
                                                ...reportForm,
                                                itemId: e.target.value,
                                                detected_at_location: itemLocation,
                                                severity: "Moderate", // Automatically Moderate (Damaged Components)
                                                quantity: inStock > 0 ? Math.min(reportForm.quantity, inStock) : 1,
                                            });
                                        }}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                    >
                                        <option value="">-- Choose Item from Inventory --</option>
                                        {inventoryItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.item_name} ({item.item_code}) • In Stock: {item.current_stock} {item.unit} • Loc: {item.storage_location || "None"}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Quantity Damaged / Missing
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={availableStock > 0 ? availableStock : undefined}
                                            required
                                            value={reportForm.quantity}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                if (isNaN(val)) return;
                                                const clamped = availableStock > 0 
                                                    ? Math.min(availableStock, Math.max(1, val))
                                                    : Math.max(1, val);
                                                setReportForm({ ...reportForm, quantity: clamped });
                                            }}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Discrepancy Type
                                        </label>
                                        <select
                                            value={reportForm.discrepancy_type}
                                            onChange={(e) => setReportForm({ ...reportForm, discrepancy_type: e.target.value as any })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="Damaged in Transit">Damaged in Transit</option>
                                            <option value="Expired Shelf-Life">Expired Shelf-Life</option>
                                            <option value="Defective from Supplier">Defective from Supplier</option>
                                            <option value="Missing during Audit">Missing during Audit</option>
                                            <option value="Water / Environmental Damage">Water / Environmental Damage</option>
                                            <option value="Spillage">Spillage</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Severity Level
                                        </label>
                                        <select
                                            value={reportForm.severity}
                                            onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value as any })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        >
                                            <option value="Moderate">Moderate (Damaged Components)</option>
                                            <option value="Minor">Minor (Cosmetic / Repackable)</option>
                                            <option value="Severe / Total Loss">Severe / Total Loss (Unusable)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Detected Storage Location
                                        </label>
                                        <select
                                            value={reportForm.detected_at_location}
                                            onChange={(e) => setReportForm({ ...reportForm, detected_at_location: e.target.value })}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        >
                                            {reportForm.detected_at_location && !zones.some((z) => z.zone_code === reportForm.detected_at_location) ? (
                                                <option value={reportForm.detected_at_location}>
                                                    {reportForm.detected_at_location} (Detected Location)
                                                </option>
                                            ) : (
                                                <option value="">-- Choose Storage Location / Zone --</option>
                                            )}
                                            {zones.map((z) => (
                                                <option key={z.id} value={z.zone_code}>
                                                    {z.zone_code} - {z.zone_name} ({z.type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Incident Description &amp; Cause
                                    </label>
                                    <textarea
                                        rows={2}
                                        required
                                        value={reportForm.incident_notes}
                                        onChange={(e) => setReportForm({ ...reportForm, incident_notes: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        placeholder="Explain how the damage or shortage occurred..."
                                    />
                                </div>

                                {/* Option to automatically deduct from stock */}
                                <div className="p-3 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-pink-200/50 dark:border-pink-900/30 shadow-[inset_2px_2px_4px_rgba(166,175,195,0.25)] flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="deductStock"
                                        checked={reportForm.deductStock}
                                        onChange={(e) => setReportForm({ ...reportForm, deductStock: e.target.checked })}
                                        className="mt-1 accent-pink-500 w-4 h-4 rounded cursor-pointer"
                                    />
                                    <label htmlFor="deductStock" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <span className="font-bold text-pink-600 dark:text-pink-400 block">Deduct from Warehouse Stock immediately</span>
                                        <span>Automatically subtracts the affected quantity from physical inventory count and logs write-off.</span>
                                    </label>
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsReportModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-[#1e1f2b] border border-white/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-[2px_2px_5px_rgba(166,175,195,0.4),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.03)] active:scale-95"
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
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Record Discrepancy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
