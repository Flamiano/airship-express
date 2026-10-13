export interface InboundShipmentItem {
    id: string;
    po_number: string;
    supplier_name: string;
    supplier_id?: number | null;
    order_date: string;
    expected_delivery_date?: string | null;
    actual_delivery_date?: string | null;
    status: 'Pending' | 'In Transit' | 'Partially Received' | 'Delivered' | 'Inspected';
    total_amount: number;
    items: {
        id?: string;
        item_name: string;
        item_code?: string;
        quantity_ordered: number;
        quantity_received: number;
        unit?: string;
        unit_price?: number;
    }[];
    delivery_receipt_number?: string | null;
    invoice_number?: string | null;
    received_by?: string | null;
    notes?: string | null;
}

export interface ApprovedDepartmentRequest {
    id: string;
    request_number: string;
    department: string;
    requested_by: string;
    requester_position?: string;
    created_at: string;
    needed_by_date?: string | null;
    priority: 'Normal' | 'Urgent' | 'Critical';
    status: 'Approved' | 'Partially Issued' | 'Delivered' | 'Completed';
    items: {
        id?: string;
        item_name: string;
        item_code?: string;
        category?: string;
        quantity_requested: number;
        quantity_issued: number;
        unit?: string;
        current_stock?: number;
        storage_location?: string;
    }[];
    issued_at?: string | null;
    issued_by?: string | null;
    recipient_signature?: string | null;
    handover_notes?: string | null;
}

export interface StorageLocationZone {
    id: string;
    zone_code: string; // e.g. "ZONE-A"
    zone_name: string; // e.g. "Fleet Maintenance & Heavy Spares"
    building_or_hub: string; // e.g. "Binondo Central Hub"
    type: 'Pallet Rack' | 'Shelving Unit' | 'Secure Cabinet' | 'Cold Room' | 'Floor Staging';
    total_capacity_units: number;
    current_utilized_units: number;
    aisles: string[];
    description: string;
    supervisor?: string;
}

export interface DamagedMissingIncident {
    id: string;
    incident_number: string; // e.g. "DISC-2026-001"
    item_id: string;
    item_code: string;
    item_name: string;
    category: string;
    quantity: number;
    unit: string;
    discrepancy_type: 'Damaged in Transit' | 'Expired Shelf-Life' | 'Defective from Supplier' | 'Missing during Audit' | 'Water / Environmental Damage' | 'Spillage';
    severity: 'Minor' | 'Moderate' | 'Severe / Total Loss';
    unit_cost: number;
    total_estimated_loss: number;
    detected_at_location: string;
    reported_by: string;
    reported_at: string;
    status: 'Under Investigation' | 'Written Off' | 'Returned to Vendor (RMA)' | 'Replaced / Restored';
    action_taken: 'Stock Deducted / Disposed' | 'Quarantine for Claim' | 'Vendor Replacement' | 'Repackaged';
    incident_notes: string;
}
