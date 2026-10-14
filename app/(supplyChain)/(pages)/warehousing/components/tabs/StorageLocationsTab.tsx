"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
    Warehouse, 
    Layers, 
    Search, 
    Plus, 
    ArrowRightLeft, 
    Boxes, 
    MapPin, 
    Building2, 
    CheckCircle2, 
    SlidersHorizontal,
    Box,
    Grid3X3,
    AlertCircle,
    X,
    RefreshCw,
    Trash2,
    Eye,
    AlertTriangle,
    Pencil
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../../lib/services/client/supabase";
import Portal from "../../../../components/client/Portal";
import { useDebounce } from "../../../../hooks/useDebounce";
import Cards from "../../../../components/global/Cards";
import { StorageLocationZone } from "../../types";
import { Pagination } from "../../../../components/global/pagination";
import { 
    fetchStorageZonesFromDB, 
    insertStorageZoneToDB, 
    updateStorageZoneInDB,
    deleteStorageZoneFromDB,
    supabaseWarehouseDb
} from "../../server/warehouse-db";

interface StorageLocationsTabProps {
    inventoryItems: any[];
    onRefresh: () => void;
}

export function StorageLocationsTab({
    inventoryItems,
    onRefresh,
}: StorageLocationsTabProps) {
    const [zones, setZones] = useState<StorageLocationZone[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState<boolean>(true);

    const [selectedZone, setSelectedZone] = useState<string>("All");
    const [itemSearchTerm, setItemSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(itemSearchTerm, 300);

    // Modal state for Viewing Storage Zone & Bin Details
    const [viewingZone, setViewingZone] = useState<StorageLocationZone | null>(null);
    const [viewZoneSearch, setViewZoneSearch] = useState("");

    // Pagination state for storage directory
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 10;

    // Modal state for Relocating Stock
    const [isRelocateModalOpen, setIsRelocateModalOpen] = useState(false);
    const [relocateForm, setRelocateForm] = useState({
        itemId: "",
        currentLocation: "",
        newLocation: "",
        quantity: 1,
        reason: "",
    });

    // Modal state for Adding a Storage Zone / Bin
    const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState(false);
    const [newZoneForm, setNewZoneForm] = useState({
        zone_code: "",
        zone_name: "",
        building_or_hub: "Binondo Central Hub",
        type: "Shelving Unit" as StorageLocationZone["type"],
        total_capacity_units: 100,
        supervisor: "",
        aislesInput: "",
        description: "",
    });

    const resetNewZoneForm = () => {
        setNewZoneForm({
            zone_code: "",
            zone_name: "",
            building_or_hub: "Binondo Central Hub",
            type: "Shelving Unit",
            total_capacity_units: 100,
            supervisor: "",
            aislesInput: "",
            description: "",
        });
    };

    // Modal state for Editing an existing Storage Zone / Bin
    const [editingZone, setEditingZone] = useState<StorageLocationZone | null>(null);
    const [editZoneForm, setEditZoneForm] = useState({
        zone_code: "",
        zone_name: "",
        building_or_hub: "Binondo Central Hub",
        type: "Shelving Unit" as StorageLocationZone["type"],
        total_capacity_units: 100,
        supervisor: "",
        aislesInput: "",
        description: "",
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch storage zones from database
    const loadZones = useCallback(async () => {
        try {
            setIsLoadingZones(true);
            const data = await fetchStorageZonesFromDB();
            setZones(data);
        } catch (err: any) {
            console.error("Failed to load storage zones from database:", err);
        } finally {
            setIsLoadingZones(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                localStorage.removeItem("airship_storage_zones");
            } catch {
                // ignore
            }
        }
        loadZones();
    }, [loadZones]);

    // Live Realtime Subscription for Storage Zones & Inventory Items (stock in, stock out, relocations)
    useEffect(() => {
        const channelId = `warehouse_locations_realtime_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase
            .channel(channelId)
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
                    loadZones();
                    onRefresh();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadZones, onRefresh]);

    // Keep viewingZone in sync when zones list updates via realtime
    useEffect(() => {
        if (viewingZone) {
            const updated = zones.find((z) => z.id === viewingZone.id);
            if (updated) {
                setViewingZone(updated);
            }
        }
    }, [zones]);

    // Helper to find inventory items assigned to a zone (by warehouse_storage_zone_id or storage_location code/name)
    const getZoneItems = useCallback((zone: StorageLocationZone, items: any[]) => {
        if (!zone) return [];
        const zCode = (zone.zone_code || "").toLowerCase().trim();
        const zName = (zone.zone_name || "").toLowerCase().trim();
        const normCode = zCode.replace(/[^a-z0-9]/g, "");
        const normName = zName.replace(/[^a-z0-9]/g, "");

        return items.filter((item) => {
            if (item.warehouse_storage_zone_id && String(item.warehouse_storage_zone_id) === String(zone.id)) {
                return true;
            }
            const itemLoc = (item.storage_location || "").toLowerCase().trim();
            if (!itemLoc) return false;
            const normLoc = itemLoc.replace(/[^a-z0-9]/g, "");
            return (
                (zCode && itemLoc.includes(zCode)) ||
                (zName && itemLoc.includes(zName)) ||
                (normCode && (normLoc.includes(normCode) || normCode.includes(normLoc))) ||
                (normName && (normLoc.includes(normName) || normName.includes(normLoc)))
            );
        });
    }, []);

    // Overall capacity utilization across all zones, dynamically calculated from live inventory
    const { totalCapacityAllZones, totalUtilizedAllZones, overallUtilizationPct } = useMemo(() => {
        const totalCap = zones.reduce((acc, z) => acc + (Number(z.total_capacity_units) || 0), 0);
        const totalUtil = zones.reduce((acc, zone) => {
            const itemsInZone = getZoneItems(zone, inventoryItems);
            const stockSum = itemsInZone.reduce((sum, item) => sum + Math.max(0, Number(item.current_stock) || 0), 0);
            return acc + (itemsInZone.length > 0 ? stockSum : Math.max(0, Number(zone.current_utilized_units) || 0));
        }, 0);
        const pct = totalCap > 0 ? Math.min(100, Math.round((totalUtil / totalCap) * 100)) : 0;
        return {
            totalCapacityAllZones: totalCap,
            totalUtilizedAllZones: totalUtil,
            overallUtilizationPct: pct,
        };
    }, [zones, inventoryItems, getZoneItems]);

    // Keep database current_utilized_units synchronized with inventory items
    useEffect(() => {
        if (zones.length === 0 || inventoryItems.length === 0) return;

        zones.forEach(async (zone) => {
            const itemsInZone = getZoneItems(zone, inventoryItems);
            if (itemsInZone.length > 0) {
                const stockSum = itemsInZone.reduce((sum, item) => sum + Math.max(0, Number(item.current_stock) || 0), 0);
                if (Number(zone.current_utilized_units) !== stockSum) {
                    try {
                        await supabaseWarehouseDb
                            .from("warehouse_storage_zones")
                            .update({
                                current_utilized_units: stockSum,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", zone.id);
                    } catch {
                        // ignore background sync errors
                    }
                }
            }
        });
    }, [zones, inventoryItems, getZoneItems]);

    // Items for current viewingZone modal
    const viewingZoneItems = useMemo(() => {
        if (!viewingZone) return [];
        return getZoneItems(viewingZone, inventoryItems);
    }, [viewingZone, inventoryItems, getZoneItems]);

    const filteredZoneItems = useMemo(() => {
        if (!viewZoneSearch.trim()) return viewingZoneItems;
        const term = viewZoneSearch.toLowerCase().trim();
        return viewingZoneItems.filter((it) => 
            (it.item_name || "").toLowerCase().includes(term) ||
            (it.item_code || "").toLowerCase().includes(term) ||
            (it.category || "").toLowerCase().includes(term)
        );
    }, [viewingZoneItems, viewZoneSearch]);

    // Filter items mapped to location
    const filteredItems = useMemo(() => {
        return inventoryItems.filter((item) => {
            const matchesSearch = 
                (item.item_name || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (item.item_code || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (item.storage_location || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const matchesZone = 
                selectedZone === "All" ||
                (item.storage_location || "").toLowerCase().includes(selectedZone.toLowerCase());

            return matchesSearch && matchesZone;
        });
    }, [inventoryItems, debouncedSearchTerm, selectedZone]);

    // Reset pagination on filter or search term change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, selectedZone]);

    // Paginated slice
    const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredItems.slice(start, start + pageSize);
    }, [filteredItems, currentPage, pageSize]);

    // Selected item for relocation modal
    const selectedRelocateItem = useMemo(() => {
        return inventoryItems.find((inv) => String(inv.id) === String(relocateForm.itemId));
    }, [inventoryItems, relocateForm.itemId]);

    const availableStock = Math.max(0, Number(selectedRelocateItem?.current_stock) || 0);

    // Handle Relocate stock in inventory_items
    const handleConfirmRelocate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!relocateForm.itemId || !relocateForm.newLocation.trim()) {
            toast.error("Please select an item and a destination location.");
            return;
        }

        setIsSubmitting(true);
        try {
            const matchedInv = inventoryItems.find((inv) => String(inv.id) === String(relocateForm.itemId));
            if (!matchedInv) throw new Error("Item not found");

            const currentInStock = Math.max(0, Number(matchedInv.current_stock) || 0);
            const moveUnits = currentInStock > 0 
                ? Math.min(currentInStock, Math.max(1, Number(relocateForm.quantity) || 1)) 
                : 0;

            // 1. Update inventory_items storage_location
            const updatePayload: any = {
                storage_location: relocateForm.newLocation.trim(),
                updated_at: new Date().toISOString(),
            };

            const { error: invErr } = await supabaseWarehouseDb
                .from("inventory_items")
                .update(updatePayload)
                .eq("id", matchedInv.id);

            if (invErr) {
                throw new Error(invErr.message || "Failed to update item location.");
            }

            // 2. Identify target and source storage zones
            const normNew = relocateForm.newLocation.toLowerCase().replace(/[^a-z0-9]/g, "");
            const normOld = (matchedInv.storage_location || "").toLowerCase().replace(/[^a-z0-9]/g, "");

            const targetZone = zones.find((z) => {
                const normCode = (z.zone_code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                const normName = (z.zone_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                return normNew.includes(normCode) || normNew.includes(normName) || normCode.includes(normNew);
            });

            const sourceZone = zones.find((z) => {
                const normCode = (z.zone_code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                const normName = (z.zone_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                return normOld && (normOld.includes(normCode) || normOld.includes(normName) || normCode.includes(normOld));
            });

            // 3. Update target zone capacity in warehouse_storage_zones
            if (targetZone && moveUnits > 0) {
                const newUtilized = Math.min(
                    Number(targetZone.total_capacity_units) || 999999,
                    (Number(targetZone.current_utilized_units) || 0) + moveUnits
                );
                await supabaseWarehouseDb
                    .from("warehouse_storage_zones")
                    .update({
                        current_utilized_units: newUtilized,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", targetZone.id);
            }

            // 4. Update source zone capacity if distinct
            if (sourceZone && (!targetZone || sourceZone.id !== targetZone.id) && moveUnits > 0) {
                const reducedUtilized = Math.max(0, (Number(sourceZone.current_utilized_units) || 0) - moveUnits);
                await supabaseWarehouseDb
                    .from("warehouse_storage_zones")
                    .update({
                        current_utilized_units: reducedUtilized,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", sourceZone.id);
            }

            toast.success(`"${matchedInv.item_name}" relocated to ${relocateForm.newLocation}!`);
            setIsRelocateModalOpen(false);

            // Re-fetch zones and invoke parent refresh to keep everything in sync
            await loadZones();
            onRefresh();
        } catch (err: any) {
            console.error("Error relocating item:", err);
            toast.error(err.message || "Failed to relocate item.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Add New Zone to Database
    const handleCreateZone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newZoneForm.zone_code.trim() || !newZoneForm.zone_name.trim()) {
            toast.error("Please enter a Zone Code and Zone Name.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Parse aislesInput into string array
            let parsedAisles: string[] = [];
            if (newZoneForm.aislesInput.trim()) {
                parsedAisles = newZoneForm.aislesInput
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            if (parsedAisles.length === 0) {
                parsedAisles = [`${newZoneForm.zone_code.trim().toUpperCase()}-01 (Primary)`];
            }

            const inserted = await insertStorageZoneToDB({
                zone_code: newZoneForm.zone_code.trim().toUpperCase(),
                zone_name: newZoneForm.zone_name.trim(),
                building_or_hub: newZoneForm.building_or_hub.trim() || "Main Hub",
                type: newZoneForm.type,
                total_capacity_units: Number(newZoneForm.total_capacity_units) || 0,
                current_utilized_units: 0,
                aisles: parsedAisles,
                supervisor: newZoneForm.supervisor.trim() || undefined,
                description: newZoneForm.description.trim(),
            });

            setZones((prev) => [...prev, inserted]);
            toast.success(`Storage Zone ${inserted.zone_code} saved to database!`);
            setIsAddZoneModalOpen(false);
            resetNewZoneForm();
        } catch (err: any) {
            console.error("Error creating storage zone:", err);
            toast.error(err.message || "Failed to create storage zone in database.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete zone from database
    const handleDeleteZone = async (zoneId: string, zoneCode: string) => {
        if (!confirm(`Are you sure you want to delete zone ${zoneCode} from the database?`)) return;
        try {
            await deleteStorageZoneFromDB(zoneId);
            setZones((prev) => prev.filter((z) => z.id !== zoneId));
            toast.success(`Storage Zone ${zoneCode} deleted from database.`);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete storage zone.");
        }
    };

    // Open edit modal pre-filled with selected zone data
    const handleOpenEditZone = (zone: StorageLocationZone) => {
        setEditingZone(zone);
        setEditZoneForm({
            zone_code: zone.zone_code || "",
            zone_name: zone.zone_name || "",
            building_or_hub: zone.building_or_hub || "Binondo Central Hub",
            type: zone.type || "Shelving Unit",
            total_capacity_units: Number(zone.total_capacity_units) || 100,
            supervisor: zone.supervisor || "",
            aislesInput: Array.isArray(zone.aisles) ? zone.aisles.join(", ") : "",
            description: zone.description || "",
        });
    };

    // Save edited zone to database
    const handleSaveEditZone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingZone) return;

        if (!editZoneForm.zone_code.trim() || !editZoneForm.zone_name.trim()) {
            toast.error("Please enter a Zone Code and Zone Name.");
            return;
        }

        setIsSubmittingEdit(true);
        try {
            let parsedAisles: string[] = [];
            if (editZoneForm.aislesInput.trim()) {
                parsedAisles = editZoneForm.aislesInput
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            if (parsedAisles.length === 0) {
                parsedAisles = [`${editZoneForm.zone_code.trim().toUpperCase()}-01 (Primary)`];
            }

            const updated = await updateStorageZoneInDB(editingZone.id, {
                zone_code: editZoneForm.zone_code.trim().toUpperCase(),
                zone_name: editZoneForm.zone_name.trim(),
                building_or_hub: editZoneForm.building_or_hub.trim() || "Main Hub",
                type: editZoneForm.type,
                total_capacity_units: Math.max(1, Number(editZoneForm.total_capacity_units) || 0),
                aisles: parsedAisles,
                supervisor: editZoneForm.supervisor.trim() || undefined,
                description: editZoneForm.description.trim(),
            });

            setZones((prev) => prev.map((z) => (z.id === editingZone.id ? updated : z)));
            if (viewingZone && viewingZone.id === editingZone.id) {
                setViewingZone(updated);
            }

            toast.success(`Storage Zone ${updated.zone_code} updated successfully!`);
            setEditingZone(null);
            await loadZones();
            onRefresh();
        } catch (err: any) {
            console.error("Error updating storage zone:", err);
            toast.error(err.message || "Failed to update storage zone in database.");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Overview & Metrics - Cards Component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Cards
                    frontIcon="fas fa-warehouse mr-1"
                    header="Storage Zones"
                    data={zones.length.toString()}
                    arrow="fas fa-layer-group mr-1"
                    description="Active Zones"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Warehouse Storage Zones"
                    backIcon="fas fa-warehouse"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${zones.length} active warehouse storage zones, aisles, and bin layouts saved in database.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-boxes-stacked mr-1"
                    header="Total Capacity"
                    data={zones.reduce((acc, z) => acc + (z.total_capacity_units || 0), 0).toLocaleString()}
                    arrow="fas fa-arrow-up mr-1"
                    description="Max Units"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Warehouse Max Capacity"
                    backIcon="fas fa-boxes-stacked"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Maximum collective warehouse storage capacity across all racks, pallets, and bin spaces.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-cubes mr-1"
                    header="Mapped SKUs"
                    data={inventoryItems.length.toString()}
                    arrow="fas fa-arrow-right mr-1"
                    description="Active SKUs"
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Assigned Stock Items"
                    backIcon="fas fa-cubes"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`${inventoryItems.length} inventory items actively mapped to warehouse shelf coordinates.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />

                <Cards
                    frontIcon="fas fa-chart-pie mr-1"
                    header="Capacity Utilization"
                    data={`${overallUtilizationPct}%`}
                    arrow="fas fa-boxes-stacked mr-1"
                    description={`${totalUtilizedAllZones.toLocaleString()} / ${totalCapacityAllZones.toLocaleString()} Units`}
                    backBg="bg-slate-900 dark:bg-slate-900"
                    backHeader="Warehouse Capacity"
                    backIcon="fas fa-chart-pie"
                    headerTextColor="text-muted dark:text-white/80"
                    backDescription={`Live warehouse capacity utilization across all zones (${totalUtilizedAllZones.toLocaleString()} of ${totalCapacityAllZones.toLocaleString()} units), dynamically updated on stock in and stock out.`}
                    tooltip="Click to flip card"
                    frontTextColor="text-pink-600 dark:text-pink-400"
                    descriptionTextColor="text-slate-500 dark:text-slate-400"
                />
            </div>

            {/* 2. Warehouse Zones Cards Grid */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Grid3X3 className="w-4 h-4 text-pink-500" />
                        <span>Warehouse Storage Layout &amp; Bin Zones</span>
                    </h3>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadZones}
                            disabled={isLoadingZones}
                            title="Reload Zones from Database"
                            className="p-2 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-500 hover:text-pink-500 transition-colors cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingZones ? "animate-spin" : ""}`} />
                        </button>

                        {zones.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (inventoryItems.length > 0) {
                                        const firstItem = inventoryItems[0];
                                        const inStock = Math.max(0, Number(firstItem.current_stock) || 0);
                                        setRelocateForm({
                                            itemId: String(firstItem.id),
                                            currentLocation: firstItem.storage_location || "",
                                            newLocation: zones[0]?.zone_code || "",
                                            quantity: inStock > 0 ? inStock : 0,
                                            reason: "",
                                        });
                                    }
                                    setIsRelocateModalOpen(true);
                                }}
                                className="px-4 py-2 rounded-2xl bg-[#f0f3f8] dark:bg-[#1e1f2b] border border-white/80 dark:border-white/10 text-pink-600 dark:text-pink-400 hover:text-pink-500 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_5px_rgba(166,175,195,0.4),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.03)] active:scale-95"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Relocate Item</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsAddZoneModalOpen(true)}
                            className="px-4 py-2 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New Zone / Bin</span>
                        </button>
                    </div>
                </div>

                {isLoadingZones ? (
                    <div className="p-8 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] text-center">
                        <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Loading Zones from Database...</h4>
                    </div>
                ) : zones.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04)] text-center">
                        <Warehouse className="w-10 h-10 text-pink-400 mx-auto mb-2 opacity-60" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Storage Zones in Database</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            There are currently no storage zones recorded in the database. Click &quot;New Zone / Bin&quot; to establish your warehouse sections.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {zones.map((zone) => {
                            const itemsInZone = getZoneItems(zone, inventoryItems);

                            // Calculate actual units: sum live current_stock of all items stored in this zone
                            const stockFromItems = itemsInZone.reduce(
                                (acc, i) => acc + Math.max(0, Number(i.current_stock) || 0),
                                0
                            );

                            // Utilized units reflects the live stock in this zone
                            const actualUtilizedUnits = itemsInZone.length > 0 ? stockFromItems : Math.max(0, Number(zone.current_utilized_units) || 0);

                            const totalCap = Number(zone.total_capacity_units) || 0;
                            const utilizationPct = totalCap > 0
                                ? Math.min(100, Math.round((actualUtilizedUnits / totalCap) * 100))
                                : 0;

                            const isHighCapacity = utilizationPct >= 90;
                            const isModerateCapacity = utilizationPct >= 70 && utilizationPct < 90;

                            return (
                                <div
                                    key={zone.id}
                                    className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40 font-mono">
                                                {zone.zone_code}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-bold text-slate-400">{zone.type}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewingZone(zone);
                                                        setViewZoneSearch("");
                                                    }}
                                                    title={`View details and stored items in ${zone.zone_code}`}
                                                    className="px-2.5 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-pink-500 hover:text-white dark:hover:bg-pink-500 dark:hover:text-white text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-900/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>View</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditZone(zone)}
                                                    title={`Edit ${zone.zone_code} details & capacity`}
                                                    className="px-2.5 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-pink-500 hover:text-white dark:hover:bg-pink-500 dark:hover:text-white text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-pink-500" />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteZone(zone.id, zone.zone_code)}
                                                    title="Delete zone from database"
                                                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mt-2">
                                            {zone.zone_name}
                                        </h4>

                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="truncate">{zone.building_or_hub || "Main Hub"}</span>
                                            {zone.supervisor && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <span className="truncate">Lead: {zone.supervisor}</span>
                                                </>
                                            )}
                                        </div>

                                        {zone.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                {zone.description}
                                            </p>
                                        )}

                                        {zone.aisles && zone.aisles.length > 0 && (
                                            <div className="mt-3 text-[11px] text-slate-400 space-y-1">
                                                <div className="font-semibold text-slate-600 dark:text-slate-300">Aisles &amp; Bins:</div>
                                                <div className="pl-1 flex items-center gap-1.5 flex-wrap">
                                                    {zone.aisles.map((a, idx) => (
                                                        <span key={idx} className="px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-[#14151c] text-[10px] font-mono font-semibold border border-slate-200/50 dark:border-slate-800">
                                                            {a}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/[0.06]">
                                        <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                                            <span className="text-slate-500">Capacity Utilization</span>
                                            <span className={isHighCapacity ? "text-rose-600 dark:text-rose-400" : isModerateCapacity ? "text-amber-600 dark:text-amber-400" : "text-pink-600 dark:text-pink-400"}>
                                                {utilizationPct}%
                                            </span>
                                        </div>

                                        <div className="w-full h-2 rounded-full bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    isHighCapacity
                                                        ? "bg-rose-500"
                                                        : isModerateCapacity
                                                        ? "bg-amber-500"
                                                        : "bg-pink-500"
                                                }`}
                                                style={{ width: `${utilizationPct}%` }}
                                            />
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                            <span>{actualUtilizedUnits.toLocaleString()} / {totalCap.toLocaleString()} units</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                {itemsInZone.length} SKUs Assigned
                                            </span>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-white/[0.04]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewingZone(zone);
                                                    setViewZoneSearch("");
                                                }}
                                                className="w-full py-1.5 px-3 rounded-xl bg-pink-50 dark:bg-pink-950/30 hover:bg-pink-100 dark:hover:bg-pink-950/50 text-pink-600 dark:text-pink-400 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>View Zone &amp; Bin Stock ({itemsInZone.length} SKUs)</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Items Location Explorer & Mappings */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#f0f3f8] dark:bg-[#1d1e28] border border-white/70 dark:border-[#2a2b38] shadow-[3px_3px_7px_rgba(166,175,195,0.35),-3px_-3px_7px_rgba(255,255,255,0.9),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.04),inset_0_1px_1px_rgba(255,255,255,0.06)] space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Box className="w-4 h-4 text-pink-500" />
                            <span>Inventory Stock Location Directory</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Locate warehouse items by rack, shelf, bin, or zone code.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="relative min-w-[220px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search item or location..."
                                value={itemSearchTerm}
                                onChange={(e) => setItemSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                            />
                        </div>

                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer"
                        >
                            <option value="All">All Storage Locations</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.zone_code}>
                                    {z.zone_code} - {z.zone_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                <th className="pb-2.5">Item Name</th>
                                <th className="pb-2.5">SKU / Code</th>
                                <th className="pb-2.5">Category</th>
                                <th className="pb-2.5">Storage Location / Bin</th>
                                <th className="pb-2.5 text-right">In Stock</th>
                                <th className="pb-2.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                                        No inventory items match your search.
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10">
                                        <td className="py-3 font-bold text-slate-800 dark:text-slate-200">
                                            {item.item_name}
                                        </td>
                                        <td className="py-3 font-mono text-[11px] text-slate-400">
                                            {item.item_code}
                                        </td>
                                        <td className="py-3 text-slate-500">
                                            {item.category}
                                        </td>
                                        <td className="py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                <MapPin className="w-3 h-3 text-pink-500" />
                                                <span>{item.storage_location || "Unassigned"}</span>
                                            </span>
                                        </td>
                                        <td className="py-3 text-right font-black text-slate-900 dark:text-white font-mono">
                                            {item.current_stock} {item.unit || "units"}
                                        </td>
                                        <td className="py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const inStock = Math.max(0, Number(item.current_stock) || 0);
                                                    setRelocateForm({
                                                        itemId: String(item.id),
                                                        currentLocation: item.storage_location || "",
                                                        newLocation: zones[0]?.zone_code || "",
                                                        quantity: inStock > 0 ? inStock : 0,
                                                        reason: "",
                                                    });
                                                    setIsRelocateModalOpen(true);
                                                }}
                                                className="px-3 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-500 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                                            >
                                                Relocate
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredItems.length > 0 && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, filteredItems.length)}</span> of{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredItems.length}</span> SKUs
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

            {/* 4. Modal: Relocate Item */}
            {isRelocateModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-md rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <ArrowRightLeft className="w-5 h-5 text-pink-500" />
                                        <span>Relocate Warehouse Stock</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Assign item to a different storage rack, shelf, or bin.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsRelocateModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleConfirmRelocate} className="mt-5 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Select Inventory Item
                                    </label>
                                    <select
                                        required
                                        value={relocateForm.itemId}
                                        onChange={(e) => {
                                            const item = inventoryItems.find((i) => String(i.id) === e.target.value);
                                            const inStock = Math.max(0, Number(item?.current_stock) || 0);
                                            setRelocateForm({
                                                ...relocateForm,
                                                itemId: e.target.value,
                                                currentLocation: item?.storage_location || "",
                                                quantity: inStock > 0 ? inStock : 0,
                                            });
                                        }}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                    >
                                        <option value="">-- Choose Item --</option>
                                        {inventoryItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.item_name} ({item.item_code}) • In Stock: {item.current_stock} {item.unit || "units"} • Loc: {item.storage_location || "None"}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Current Storage Location
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={relocateForm.currentLocation || "Unassigned"}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        New Target Storage Location / Bin
                                    </label>
                                    <div className="space-y-2">
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setRelocateForm({ ...relocateForm, newLocation: e.target.value });
                                                }
                                            }}
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="">-- Or Select from Configured Zones --</option>
                                            {zones.map((z) => (
                                                <option key={z.id} value={z.zone_code}>
                                                    {z.zone_code} - {z.zone_name} ({z.type})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            required
                                            value={relocateForm.newLocation}
                                            onChange={(e) => setRelocateForm({ ...relocateForm, newLocation: e.target.value })}
                                            placeholder="e.g. ZONE-A / Aisle 2 / Bin 04"
                                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                            Stock Units to Allocate / Relocate into Target Zone
                                        </label>
                                        {selectedRelocateItem && (
                                            <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg ${
                                                availableStock > 0 
                                                    ? "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20" 
                                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            }`}>
                                                In Stock: {availableStock} {selectedRelocateItem.unit || "units"}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min={availableStock > 0 ? 1 : 0}
                                        max={availableStock}
                                        disabled={availableStock === 0}
                                        required
                                        value={availableStock === 0 ? 0 : relocateForm.quantity}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === "") {
                                                setRelocateForm({ ...relocateForm, quantity: 0 });
                                                return;
                                            }
                                            const val = parseInt(raw, 10);
                                            if (isNaN(val)) return;
                                            const clamped = Math.min(availableStock, Math.max(availableStock > 0 ? 1 : 0, val));
                                            setRelocateForm({ ...relocateForm, quantity: clamped });
                                        }}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                                        placeholder={availableStock > 0 ? `Max ${availableStock}` : "0"}
                                    />
                                    {availableStock === 0 ? (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                            ⚠️ This item currently has 0 units in stock. Relocation will update the item's assigned storage location without adding units to zone capacity.
                                        </p>
                                    ) : (
                                        <div className="flex items-center justify-between mt-1 text-[10px]">
                                            <span className="text-slate-400 dark:text-slate-500">
                                                Max allocatable: {availableStock} {selectedRelocateItem?.unit || "units"} (Current In Stock)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setRelocateForm({ ...relocateForm, quantity: availableStock })}
                                                className="text-pink-600 dark:text-pink-400 hover:underline font-bold cursor-pointer"
                                            >
                                                Set to Max ({availableStock})
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsRelocateModalOpen(false)}
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
                                                <span>Relocating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Confirm Relocation</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 5. Modal: Add New Storage Zone / Bin */}
            {isAddZoneModalOpen && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-pink-500" />
                                        <span>Add Warehouse Storage Zone</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Define a new rack, aisle, shelf, or staging area directly in the database.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAddZoneModalOpen(false);
                                        resetNewZoneForm();
                                    }}
                                    className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateZone} className="mt-5 space-y-4 overflow-y-auto pr-1 flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Zone Code <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={newZoneForm.zone_code}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, zone_code: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono font-bold uppercase"
                                            placeholder="e.g. ZONE-A"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Storage Type <span className="text-pink-500">*</span>
                                        </label>
                                        <select
                                            value={newZoneForm.type}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, type: e.target.value as any })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="Shelving Unit">Shelving Unit</option>
                                            <option value="Pallet Rack">Pallet Rack</option>
                                            <option value="Secure Cabinet">Secure Cabinet</option>
                                            <option value="Cold Room">Cold Room</option>
                                            <option value="Floor Staging">Floor Staging</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Zone Name <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={newZoneForm.zone_name}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, zone_name: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                            placeholder="e.g. Heavy Spares & Pallet Racks"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Warehouse Facility / Hub
                                        </label>
                                        <input
                                            type="text"
                                            value={newZoneForm.building_or_hub}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, building_or_hub: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="e.g. Binondo Central Hub, Building 2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Total Capacity (Units) <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            required
                                            value={newZoneForm.total_capacity_units || ""}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, total_capacity_units: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                            placeholder="e.g. 500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Supervisor / Zone Lead
                                        </label>
                                        <input
                                            type="text"
                                            value={newZoneForm.supervisor}
                                            onChange={(e) => setNewZoneForm({ ...newZoneForm, supervisor: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="e.g. Engr. Marco Santos"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                            Aisles &amp; Bins Breakdown
                                        </label>
                                        <span className="text-[10px] text-slate-400">Comma-separated</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={newZoneForm.aislesInput}
                                        onChange={(e) => setNewZoneForm({ ...newZoneForm, aislesInput: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                        placeholder="e.g. A-01, A-02, A-03, Rack B-1"
                                    />
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        Stored as a JSON array in database. Defaults to [ZONE-01 (Primary)] if left empty.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Operational Description &amp; Storage Notes
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={newZoneForm.description}
                                        onChange={(e) => setNewZoneForm({ ...newZoneForm, description: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 resize-none"
                                        placeholder="Special handling rules, temperature control, security requirements, or location remarks..."
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddZoneModalOpen(false);
                                            resetNewZoneForm();
                                        }}
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
                                                <span>Creating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Create Zone</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 5. Modal: View Storage Zone Details & Bin Inspection */}
            {viewingZone && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-y-auto space-y-5">
                            {/* Modal Header */}
                            <div className="flex items-start justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800/40 font-mono">
                                            {viewingZone.zone_code}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ebf0f7] dark:bg-[#14151c] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800">
                                            {viewingZone.type}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-slate-500">
                                            {viewingZone.building_or_hub || "Main Hub"}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2 flex items-center gap-2">
                                        <Warehouse className="w-5 h-5 text-pink-500" />
                                        <span>{viewingZone.zone_name}</span>
                                    </h3>
                                    {viewingZone.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {viewingZone.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenEditZone(viewingZone)}
                                        title={`Edit ${viewingZone.zone_code} details & capacity`}
                                        className="px-3 py-1.5 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] hover:bg-pink-500 hover:text-white dark:hover:bg-pink-500 dark:hover:text-white text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-pink-500" />
                                        <span>Edit Zone</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewingZone(null)}
                                        className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Capacity & Key Metrics */}
                            {(() => {
                                const zoneStock = viewingZoneItems.reduce((acc, it) => acc + Math.max(0, Number(it.current_stock) || 0), 0);
                                const zoneCap = Number(viewingZone.total_capacity_units) || 0;
                                const zoneUtilized = viewingZoneItems.length > 0 ? zoneStock : Math.max(0, Number(viewingZone.current_utilized_units) || 0);
                                const zonePct = zoneCap > 0 ? Math.min(100, Math.round((zoneUtilized / zoneCap) * 100)) : 0;
                                const zoneAvailable = Math.max(0, zoneCap - zoneUtilized);
                                const isHigh = zonePct >= 90;
                                const isMod = zonePct >= 70 && zonePct < 90;

                                return (
                                    <>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Total Capacity</div>
                                                <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                                                    {zoneCap.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-slate-400">Max Units Allowed</div>
                                            </div>

                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                                <div className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400">Stock Utilized</div>
                                                <div className="text-base font-black text-pink-600 dark:text-pink-400 mt-0.5 font-mono">
                                                    {zoneUtilized.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-slate-400">Live Units in Storage</div>
                                            </div>

                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Available Space</div>
                                                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                                                    {zoneAvailable.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-slate-400">Remaining Units</div>
                                            </div>

                                            <div className="p-3.5 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 shadow-[inset_1px_1px_3px_rgba(166,175,195,0.3),inset_-1px_-1px_3px_rgba(255,255,255,0.8)] dark:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Assigned SKUs</div>
                                                <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                                                    {viewingZoneItems.length}
                                                </div>
                                                <div className="text-[10px] text-slate-400">Distinct Products</div>
                                            </div>
                                        </div>

                                        {/* Capacity Utilization Progress Bar */}
                                        <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between text-xs font-bold">
                                                <span className="text-slate-600 dark:text-slate-300">Live Capacity Utilization</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                    isHigh
                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                                        : isMod
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                                }`}>
                                                    {zonePct}% Utilized ({isHigh ? "Near Full Capacity" : isMod ? "High Storage Utilization" : "Optimal Storage Level"})
                                                </span>
                                            </div>

                                            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shadow-inner">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        isHigh
                                                            ? "bg-rose-500"
                                                            : isMod
                                                            ? "bg-amber-500"
                                                            : "bg-pink-500"
                                                    }`}
                                                    style={{ width: `${zonePct}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>{zoneUtilized.toLocaleString()} units stored</span>
                                                <span>{zoneCap.toLocaleString()} total units capacity</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Zone Lead & Aisles Metadata */}
                            <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-slate-600 dark:text-slate-300 p-3 rounded-2xl bg-[#ebf0f7]/70 dark:bg-[#14151c]/70 border border-slate-200/50 dark:border-slate-800">
                                <div>
                                    <span className="font-bold text-slate-500">Zone Supervisor / Lead:</span>{" "}
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingZone.supervisor || "Central Warehouse Lead"}</span>
                                </div>
                                {viewingZone.aisles && viewingZone.aisles.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-500">Aisles &amp; Bins:</span>
                                        {viewingZone.aisles.map((a, idx) => (
                                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1d1e28] border border-slate-200 dark:border-slate-800 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Stored Inventory Items in this Zone */}
                            <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                                        <Box className="w-3.5 h-3.5 text-pink-500" />
                                        <span>Stored Items &amp; Active SKUs ({viewingZoneItems.length})</span>
                                    </h4>

                                    {viewingZoneItems.length > 0 && (
                                        <div className="relative min-w-[220px]">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Filter items in this bin..."
                                                value={viewZoneSearch}
                                                onChange={(e) => setViewZoneSearch(e.target.value)}
                                                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="overflow-x-auto max-h-[280px] rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                    <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-[#f0f3f8] dark:bg-[#1d1e28] border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                                            <tr>
                                                <th className="py-2.5 px-3">Item Name</th>
                                                <th className="py-2.5 px-3">SKU / Code</th>
                                                <th className="py-2.5 px-3">Category</th>
                                                <th className="py-2.5 px-3 text-right">Stock Level</th>
                                                <th className="py-2.5 px-3 text-right">Status</th>
                                                <th className="py-2.5 px-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-[#f8fafc]/40 dark:bg-[#141624]/20">
                                            {filteredZoneItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                                                        {viewingZoneItems.length === 0
                                                            ? `No inventory items are currently stored in ${viewingZone.zone_code}.`
                                                            : "No items match your filter in this zone."}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredZoneItems.map((item) => {
                                                    const stock = Number(item.current_stock) || 0;
                                                    const minStock = Number(item.minimum_stock) || 10;
                                                    const isOutOfStock = stock <= 0;
                                                    const isLowStock = !isOutOfStock && stock < minStock;

                                                    return (
                                                        <tr key={item.id} className="hover:bg-pink-50/20 dark:hover:bg-pink-950/10">
                                                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                                                                {item.item_name}
                                                            </td>
                                                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                                                {item.item_code}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-slate-500">
                                                                {item.category || "General"}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                                                                {stock} {item.unit || "units"}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                    isOutOfStock
                                                                        ? "bg-red-50 text-red-600 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40"
                                                                        : isLowStock
                                                                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40"
                                                                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40"
                                                                }`}>
                                                                    {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const inStock = Math.max(0, Number(item.current_stock) || 0);
                                                                        setRelocateForm({
                                                                            itemId: String(item.id),
                                                                            currentLocation: item.storage_location || viewingZone.zone_code,
                                                                            newLocation: zones.find((z) => z.id !== viewingZone.id)?.zone_code || "",
                                                                            quantity: inStock > 0 ? inStock : 0,
                                                                            reason: `Relocated from ${viewingZone.zone_code}`,
                                                                        });
                                                                        setIsRelocateModalOpen(true);
                                                                    }}
                                                                    className="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-500 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    Relocate
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (inventoryItems.length > 0) {
                                            const firstItem = inventoryItems[0];
                                            const inStock = Math.max(0, Number(firstItem.current_stock) || 0);
                                            setRelocateForm({
                                                itemId: String(firstItem.id),
                                                currentLocation: firstItem.storage_location || "",
                                                newLocation: viewingZone.zone_code,
                                                quantity: inStock > 0 ? inStock : 0,
                                                reason: `Move to ${viewingZone.zone_code}`,
                                            });
                                        }
                                        setIsRelocateModalOpen(true);
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] text-pink-600 dark:text-pink-400 hover:text-pink-500 border border-pink-200/60 dark:border-pink-900/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    <span>Relocate an Item to this Zone</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setViewingZone(null)}
                                    className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* 6. Modal: Edit Storage Zone Details & Capacity */}
            {editingZone && (
                <Portal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                        <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-[#f0f3f8] dark:bg-[#1a1c29] border border-white/80 dark:border-white/10 shadow-[12px_12px_36px_rgba(166,175,195,0.5),-12px_-12px_36px_rgba(255,255,255,0.95),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[14px_14px_40px_rgba(0,0,0,0.85),-8px_-8px_24px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.07)] p-6 overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Pencil className="w-4 h-4 text-pink-500" />
                                        <span>Edit Storage Zone ({editingZone.zone_code})</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Update layout details, capacity limit, or location coordinates.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingZone(null)}
                                    className="w-8 h-8 rounded-full bg-[#ebf0f7] dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEditZone} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Zone Code <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editZoneForm.zone_code}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, zone_code: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono font-bold uppercase"
                                            placeholder="e.g. ZONE-A"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Storage Type <span className="text-pink-500">*</span>
                                        </label>
                                        <select
                                            value={editZoneForm.type}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, type: e.target.value as any })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="Shelving Unit">Shelving Unit</option>
                                            <option value="Pallet Rack">Pallet Rack</option>
                                            <option value="Secure Cabinet">Secure Cabinet</option>
                                            <option value="Cold Room">Cold Room</option>
                                            <option value="Floor Staging">Floor Staging</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Zone Name <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editZoneForm.zone_name}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, zone_name: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-bold"
                                            placeholder="e.g. Heavy Spares & Pallet Racks"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Warehouse Facility / Hub
                                        </label>
                                        <input
                                            type="text"
                                            value={editZoneForm.building_or_hub}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, building_or_hub: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="e.g. Binondo Central Hub, Building 2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Total Capacity (Units) <span className="text-pink-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            required
                                            value={editZoneForm.total_capacity_units || ""}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, total_capacity_units: parseInt(e.target.value, 10) || 0 })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                            placeholder="e.g. 500"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Affects dynamic capacity utilization across the warehouse.
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                            Supervisor / Zone Lead
                                        </label>
                                        <input
                                            type="text"
                                            value={editZoneForm.supervisor}
                                            onChange={(e) => setEditZoneForm({ ...editZoneForm, supervisor: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                                            placeholder="e.g. Engr. Marco Santos"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                            Aisles &amp; Bins Breakdown
                                        </label>
                                        <span className="text-[10px] text-slate-400">Comma-separated</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={editZoneForm.aislesInput}
                                        onChange={(e) => setEditZoneForm({ ...editZoneForm, aislesInput: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 font-mono"
                                        placeholder="e.g. A-01, A-02, A-03, Rack B-1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Operational Description &amp; Storage Notes
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={editZoneForm.description}
                                        onChange={(e) => setEditZoneForm({ ...editZoneForm, description: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#ebf0f7] dark:bg-[#14151c] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.35),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.04)] border border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 resize-none"
                                        placeholder="Special handling rules, temperature control, security requirements, or location remarks..."
                                    />
                                </div>

                                <div className="pt-3 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setEditingZone(null)}
                                        className="px-4 py-2 rounded-xl bg-[#f0f3f8] dark:bg-[#1e1f2b] border border-white/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-[2px_2px_5px_rgba(166,175,195,0.4),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_5px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.03)] active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingEdit}
                                        className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black shadow-[0_4px_14px_rgba(236,72,153,0.45),inset_0_1px_1.5px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.25)] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isSubmittingEdit ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Saving Changes...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Save Changes</span>
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
