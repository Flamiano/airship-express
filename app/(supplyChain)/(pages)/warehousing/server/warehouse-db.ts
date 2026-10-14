import { createClient } from "@supabase/supabase-js";
import { DamagedMissingIncident, StorageLocationZone } from "../types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPPLYCHAIN_SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPPLYCHAIN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseWarehouseDb = (serviceRoleKey && supabaseUrl)
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : createClient(supabaseUrl, anonKey);

// ==========================================
// 1. DAMAGE & MISSING INCIDENTS DB OPERATIONS
// ==========================================

export async function fetchDamageIncidentsFromDB(): Promise<DamagedMissingIncident[]> {
    try {
        const { data, error } = await supabaseWarehouseDb
            .from("warehouse_damage_incidents")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.warn("Supabase fetch warehouse_damage_incidents error:", error.message);
            return [];
        }

        return (data || []).map((row: any) => {
            let normalizedStatus: DamagedMissingIncident["status"] = "Under Investigation";
            const rawStatus = String(row.status || "").toLowerCase().trim();
            if (rawStatus.includes("replac") || rawStatus.includes("restor") || rawStatus === "resolved") {
                normalizedStatus = "Replaced / Restored";
            } else if (rawStatus.includes("return") || rawStatus.includes("rma") || rawStatus.includes("transit")) {
                normalizedStatus = "Returned to Vendor (RMA)";
            } else if (rawStatus.includes("written") || rawStatus.includes("write") || rawStatus.includes("deduct") || rawStatus.includes("scrap")) {
                normalizedStatus = "Written Off";
            } else {
                normalizedStatus = "Under Investigation";
            }

            return {
                id: String(row.id),
                incident_number: row.incident_number,
                item_id: String(row.item_id || ""),
                item_code: row.item_code,
                item_name: row.item_name,
                category: row.category || "General Supplies",
                quantity: Number(row.quantity) || 1,
                unit: row.unit || "units",
                discrepancy_type: row.discrepancy_type,
                severity: row.severity || "Moderate",
                unit_cost: Number(row.unit_cost) || 0,
                total_estimated_loss: Number(row.total_estimated_loss) || 0,
                detected_at_location: row.detected_at_location || "",
                reported_by: row.reported_by || "Warehouse Staff",
                reported_at: row.reported_at || row.created_at || new Date().toISOString(),
                status: normalizedStatus,
                action_taken: row.action_taken || "Stock Deducted / Disposed",
                incident_notes: row.incident_notes || "",
            };
        });
    } catch (err) {
        console.error("fetchDamageIncidentsFromDB unexpected error:", err);
        return [];
    }
}

export async function insertDamageIncidentToDB(
    incident: Omit<DamagedMissingIncident, "id"> & { id?: string }
): Promise<DamagedMissingIncident> {
    const payload = {
        incident_number: incident.incident_number,
        item_id: incident.item_id ? String(incident.item_id) : null,
        item_code: incident.item_code,
        item_name: incident.item_name,
        category: incident.category,
        quantity: incident.quantity,
        unit: incident.unit,
        discrepancy_type: incident.discrepancy_type,
        severity: incident.severity,
        unit_cost: incident.unit_cost,
        total_estimated_loss: incident.total_estimated_loss,
        detected_at_location: incident.detected_at_location,
        reported_by: incident.reported_by,
        reported_at: incident.reported_at || new Date().toISOString(),
        status: incident.status,
        action_taken: incident.action_taken,
        incident_notes: incident.incident_notes,
    };

    const { data, error } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .insert([payload])
        .select()
        .single();

    if (error) {
        throw new Error(error.message || "Failed to insert damage incident into database.");
    }

    return {
        id: String(data.id),
        incident_number: data.incident_number,
        item_id: String(data.item_id || ""),
        item_code: data.item_code,
        item_name: data.item_name,
        category: data.category || "General Supplies",
        quantity: Number(data.quantity) || 1,
        unit: data.unit || "units",
        discrepancy_type: data.discrepancy_type,
        severity: data.severity,
        unit_cost: Number(data.unit_cost) || 0,
        total_estimated_loss: Number(data.total_estimated_loss) || 0,
        detected_at_location: data.detected_at_location || "",
        reported_by: data.reported_by || "Warehouse Staff",
        reported_at: data.reported_at || data.created_at,
        status: data.status,
        action_taken: data.action_taken,
        incident_notes: data.incident_notes || "",
    };
}

export async function updateDamageIncidentStatusInDB(
    id: string,
    newStatus: DamagedMissingIncident["status"],
    actionTaken?: DamagedMissingIncident["action_taken"]
): Promise<void> {
    const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
    };
    if (actionTaken) {
        updatePayload.action_taken = actionTaken;
    }

    const { error } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .update(updatePayload)
        .eq("id", id);

    if (error) {
        throw new Error(error.message || "Failed to update incident status in database.");
    }
}

export async function restoreDamageIncidentStockInDB(
    incidentId: string,
    restoredBy?: string,
    restoreReason?: string
): Promise<{ success: boolean; restoredQuantity: number; itemName: string; newStock?: number }> {
    // 1. Fetch incident
    const { data: incident, error: incFetchErr } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .select("*")
        .eq("id", incidentId)
        .single();

    if (incFetchErr || !incident) {
        throw new Error(incFetchErr?.message || "Incident not found in database.");
    }

    const qtyToRestore = Number(incident.quantity) || 1;

    // 2. Locate inventory item
    let invItem: any = null;
    if (incident.item_id) {
        const { data: itemData } = await supabaseWarehouseDb
            .from("inventory_items")
            .select("*")
            .eq("id", incident.item_id)
            .maybeSingle();
        invItem = itemData;
    }

    if (!invItem && incident.item_code) {
        const { data: itemData } = await supabaseWarehouseDb
            .from("inventory_items")
            .select("*")
            .eq("item_code", incident.item_code)
            .maybeSingle();
        invItem = itemData;
    }

    if (!invItem && incident.item_name) {
        const { data: itemData } = await supabaseWarehouseDb
            .from("inventory_items")
            .select("*")
            .ilike("item_name", incident.item_name)
            .maybeSingle();
        invItem = itemData;
    }

    let newStock = 0;
    if (invItem) {
        const prevStock = Number(invItem.current_stock) || 0;
        newStock = prevStock + qtyToRestore;
        const minStock = Number(invItem.minimum_stock) || 0;
        const newStatus = newStock === 0 ? "out-of-stock" : newStock <= minStock ? "low-stock" : "available";

        // Update inventory_items
        await supabaseWarehouseDb
            .from("inventory_items")
            .update({
                current_stock: newStock,
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", invItem.id);

        // Record stock movement
        const movementPayload = {
            item_id: String(invItem.id),
            item_code: invItem.item_code || incident.item_code,
            item_name: invItem.item_name || incident.item_name,
            movement_type: "Stock In",
            quantity: qtyToRestore,
            previous_stock: prevStock,
            new_stock: newStock,
            reference_number: incident.incident_number,
            reason: restoreReason || `Restored from Discrepancy (${incident.incident_number}): item repaired/replaced/restocked`,
            department: "Warehouse / Storage",
            performed_by: restoredBy || "Warehouse Staff",
            metadata: {
                incident_number: incident.incident_number,
                action: "DISCREPANCY_STOCK_RESTORED",
                incident_id: incident.id,
            },
            created_at: new Date().toISOString(),
        };

        await supabaseWarehouseDb.from("stock_movements").insert([movementPayload]);
    }

    // 3. Update warehouse_damage_incidents
    const restoreNote = `[Restored: +${qtyToRestore} units to inventory by ${restoredBy || "Warehouse Staff"} on ${new Date().toLocaleDateString()}]`;
    const updatedNotes = incident.incident_notes
        ? `${incident.incident_notes} | ${restoreNote}`
        : restoreNote;

    const { error: incUpdateErr } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .update({
            status: "Replaced / Restored",
            action_taken: "Repackaged",
            incident_notes: updatedNotes,
            updated_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

    if (incUpdateErr) {
        throw new Error(incUpdateErr.message || "Failed to update incident status to Replaced / Restored.");
    }

    return {
        success: true,
        restoredQuantity: qtyToRestore,
        itemName: incident.item_name,
        newStock,
    };
}

export async function writeOffDamageIncidentStockInDB(
    incidentId: string,
    performedBy?: string,
    deductStockIfAvailable: boolean = true
): Promise<{ success: boolean; deductedQuantity: number; itemName: string }> {
    // 1. Fetch incident
    const { data: incident, error: incFetchErr } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .select("*")
        .eq("id", incidentId)
        .single();

    if (incFetchErr || !incident) {
        throw new Error(incFetchErr?.message || "Incident not found in database.");
    }

    const qtyToDeduct = Number(incident.quantity) || 1;
    const alreadyDeducted = incident.action_taken === "Stock Deducted / Disposed" || incident.status === "Written Off";

    if (deductStockIfAvailable && !alreadyDeducted) {
        let invItem: any = null;
        if (incident.item_id) {
            const { data: itemData } = await supabaseWarehouseDb
                .from("inventory_items")
                .select("*")
                .eq("id", incident.item_id)
                .maybeSingle();
            invItem = itemData;
        }

        if (!invItem && incident.item_code) {
            const { data: itemData } = await supabaseWarehouseDb
                .from("inventory_items")
                .select("*")
                .eq("item_code", incident.item_code)
                .maybeSingle();
            invItem = itemData;
        }

        if (invItem) {
            const curStock = Number(invItem.current_stock) || 0;
            const newStock = Math.max(0, curStock - qtyToDeduct);
            const minStock = Number(invItem.minimum_stock) || 0;
            const newStatus = newStock === 0 ? "out-of-stock" : newStock <= minStock ? "low-stock" : "available";

            await supabaseWarehouseDb
                .from("inventory_items")
                .update({
                    current_stock: newStock,
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", invItem.id);

            await supabaseWarehouseDb.from("stock_movements").insert([{
                item_id: String(invItem.id),
                item_code: invItem.item_code || incident.item_code,
                item_name: invItem.item_name || incident.item_name,
                movement_type: "Stock Out",
                quantity: qtyToDeduct,
                previous_stock: curStock,
                new_stock: newStock,
                reference_number: incident.incident_number,
                reason: `Damaged Discrepancy Write-Off: ${incident.discrepancy_type}`,
                department: "Warehouse / Storage",
                performed_by: performedBy || "Warehouse Staff",
                metadata: {
                    incident_number: incident.incident_number,
                    action: "DAMAGE_DISCREPANCY_WRITE_OFF",
                },
                created_at: new Date().toISOString(),
            }]);
        }
    }

    await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .update({
            status: "Written Off",
            action_taken: "Stock Deducted / Disposed",
            updated_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

    return {
        success: true,
        deductedQuantity: qtyToDeduct,
        itemName: incident.item_name,
    };
}

export async function returnToVendorDamageIncidentInDB(
    incidentId: string,
    rmaReference?: string
): Promise<{ success: boolean; itemName: string }> {
    const { data: incident } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .select("*")
        .eq("id", incidentId)
        .single();

    if (!incident) throw new Error("Incident not found.");

    const updatedNotes = rmaReference 
        ? `${incident.incident_notes || ""} | [RMA Reference: ${rmaReference}]`
        : incident.incident_notes;

    await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .update({
            status: "Returned to Vendor (RMA)",
            action_taken: "Quarantine for Claim",
            incident_notes: updatedNotes,
            updated_at: new Date().toISOString(),
        })
        .eq("id", incidentId);

    return { success: true, itemName: incident.item_name };
}

export async function deleteDamageIncidentFromDB(id: string): Promise<void> {
    const { error } = await supabaseWarehouseDb
        .from("warehouse_damage_incidents")
        .delete()
        .eq("id", id);

    if (error) {
        throw new Error(error.message || "Failed to delete incident from database.");
    }
}

// ==========================================
// 2. STORAGE ZONES DB OPERATIONS
// ==========================================

export async function fetchStorageZonesFromDB(): Promise<StorageLocationZone[]> {
    try {
        const { data, error } = await supabaseWarehouseDb
            .from("warehouse_storage_zones")
            .select("*")
            .order("zone_code", { ascending: true });

        if (error) {
            console.warn("Supabase fetch warehouse_storage_zones error:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        return data.map((row: any) => formatZoneRow(row));
    } catch (err) {
        console.error("fetchStorageZonesFromDB unexpected error:", err);
        return [];
    }
}

function formatZoneRow(row: any): StorageLocationZone {
    let aislesArr: string[] = [];
    if (Array.isArray(row.aisles)) {
        aislesArr = row.aisles;
    } else if (typeof row.aisles === "string") {
        try {
            aislesArr = JSON.parse(row.aisles);
        } catch {
            aislesArr = [row.aisles];
        }
    }

    return {
        id: String(row.id),
        zone_code: row.zone_code,
        zone_name: row.zone_name,
        building_or_hub: row.building_or_hub || "Main Hub",
        type: row.type || "Shelving Unit",
        total_capacity_units: Number(row.total_capacity_units) || 0,
        current_utilized_units: Number(row.current_utilized_units) || 0,
        aisles: aislesArr,
        supervisor: row.supervisor || undefined,
        description: row.description || "",
    };
}

export async function insertStorageZoneToDB(
    zone: Omit<StorageLocationZone, "id"> & { id?: string }
): Promise<StorageLocationZone> {
    const payload = {
        zone_code: zone.zone_code.toUpperCase(),
        zone_name: zone.zone_name,
        building_or_hub: zone.building_or_hub || "Main Hub",
        type: zone.type,
        total_capacity_units: Number(zone.total_capacity_units) || 0,
        current_utilized_units: Number(zone.current_utilized_units) || 0,
        aisles: zone.aisles || [],
        description: zone.description || "",
        supervisor: zone.supervisor || null,
    };

    const { data, error } = await supabaseWarehouseDb
        .from("warehouse_storage_zones")
        .insert([payload])
        .select()
        .single();

    if (error) {
        throw new Error(error.message || "Failed to create storage zone in database.");
    }

    return formatZoneRow(data);
}

export async function updateStorageZoneInDB(
    id: string,
    updates: Partial<Omit<StorageLocationZone, "id">>
): Promise<StorageLocationZone> {
    const payload: any = {
        updated_at: new Date().toISOString(),
    };

    if (updates.zone_code !== undefined) payload.zone_code = updates.zone_code.toUpperCase().trim();
    if (updates.zone_name !== undefined) payload.zone_name = updates.zone_name.trim();
    if (updates.building_or_hub !== undefined) payload.building_or_hub = updates.building_or_hub.trim();
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.total_capacity_units !== undefined) payload.total_capacity_units = Number(updates.total_capacity_units) || 0;
    if (updates.current_utilized_units !== undefined) payload.current_utilized_units = Number(updates.current_utilized_units) || 0;
    if (updates.aisles !== undefined) payload.aisles = updates.aisles;
    if (updates.description !== undefined) payload.description = updates.description.trim();
    if (updates.supervisor !== undefined) payload.supervisor = updates.supervisor ? updates.supervisor.trim() : null;

    const { data, error } = await supabaseWarehouseDb
        .from("warehouse_storage_zones")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw new Error(error.message || "Failed to update storage zone in database.");
    }

    return formatZoneRow(data);
}

export async function deleteStorageZoneFromDB(id: string): Promise<void> {
    const { error } = await supabaseWarehouseDb
        .from("warehouse_storage_zones")
        .delete()
        .eq("id", id);

    if (error) {
        throw new Error(error.message || "Failed to delete storage zone from database.");
    }
}

