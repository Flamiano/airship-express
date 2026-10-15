
export interface DriverOption {
    name: string;
    count: number;
}

export interface ScannerUser {
    id: string;
    name: string;
    email: string;
    role: string;
    scanned_count: number;
    status_counts: Record<string, number>;
    last_scanned_at: string | null;
}

export interface LatestPOInfo {
    poi_id?: string;
    purchase_order_id?: string;
    po_number?: string;
    status?: string; // 'Draft' | 'Sent' | 'Confirmed' | 'Delivered' | 'Cancelled' | 'Pending' | 'Approved' | 'Rejected'
    paid?: boolean;
    fully_received?: boolean;
    quantity_ordered?: number;
    quantity_received?: number;
    unit_price?: number;
    supplier_name?: string;
    is_request?: boolean;
    request_number?: string;
    request_id?: string;
    delivery_date?: string;
    created_at?: string;
    has_pending_pr?: boolean;
    pending_pr_number?: string;
    pending_pr_id?: string;
}

export interface PurchaseRequestItemEntry {
    id?: string;
    name: string;
    item_name?: string;
    item_code?: string;
    category?: string;
    quantity: number;
    approved_quantity?: number;
    exported_quantity?: number;
    remaining_quantity?: number;
    unit?: string;
    specs?: string;
    specifications?: string;
    remarks?: string;
    issued_quantity?: number;
    deficit_quantity?: number;
    is_released?: boolean;
    is_issued?: boolean;
    is_approved?: boolean;
    is_approve?: boolean;
    status?: string;
}

export interface InventoryRequest {
    id: string;
    request_number?: string;
    request_type?: 'Regular' | 'Advance' | string;
    type?: string;
    description?: string;
    purpose?: string | null;
    requested_by?: string | null;
    requester_name?: string | null;
    requester_position?: string | null;
    requester_contact?: string | null;
    department?: string | null;
    requested_for?: string | null;
    items?: PurchaseRequestItemEntry[];
    priority?: 'Normal' | 'Urgent' | 'Critical' | string;
    needed_by_date?: string | null;
    urgency_reason?: string | null;
    advance_reason?: string | null;
    requester_notes?: string | null;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'pending' | 'approved' | 'rejected' | 'received' | 'fulfilled';
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string | null;
    admin_notes?: string | null;
    requires_bidding?: boolean;
    bidding_status?: string | null;
    purchase_order_id?: string | null;
    completed_at?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at?: string;
    
    // Legacy & computed compatibility fields
    inventory_items_id?: number | null;
    item_id?: string | null;
    item_code?: string | null;
    item_name: string;
    quantity_requested: number;
    unit?: string;
    message?: string | null;
    remarks?: string | null;
    approved_or_rejected_by?: string | null;
    possible_delivery_date?: string | null;
    requester_system?: string | null;
    is_internal?: boolean;
    Internal_request?: boolean | null;
    internal_request?: boolean | null;
    approved_at?: string | null;
    approved_by?: string | null;
    approver_name?: string | null;
    fulfilled_at?: string | null;
    fulfilled_by?: string | null;
    is_released?: boolean;
    is_issued?: boolean;
    inventory_item?: InventoryItem | null;
    matched_inventory_items?: InventoryItem[];
    current_stock?: number;
    available_stock?: number;
    is_stock_feasible?: boolean;
    quantity_approved?: number;
    quantity_exported?: number;
    quantity_remaining?: number;
    issued_quantity?: number;
    deficit_quantity?: number;
    is_partial_handover?: boolean;
    is_partially_approved?: boolean;
    is_zero_exported?: boolean;
}

export interface InventoryItem {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    current_stock: number;
    unit: string;
    minimum_stock: number;
    min_stock?: number;
    storage_location: string;
    warehouse_storage_zone_id?: string | null;
    status: 'available' | 'low-stock' | 'out-of-stock';
    updated_at: string;
    description?: string;
    supplier?: string;
    purchase_price?: number;
    latest_po?: LatestPOInfo | null;
    force_updated_by?: string | null;
    force_updated_by_name?: string | null;
    force_updated_at?: string | null;
    force_reason?: string | null;
    exporting_stock?: number;
    quarantine_stock?: number;
    available_stock?: number;
    pending_requests_count?: number;
}

export interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    is_active: boolean;
}

export interface WarehouseStorageZone {
    id: string;
    zone_code: string;
    zone_name: string;
    building_or_hub?: string;
    type?: string;
    total_capacity_units: number;
    current_utilized_units: number;
    aisles?: string[] | string;
    description?: string;
    status?: string;
}

export interface AddItemFormData {
    item_code: string;
    item_name: string;
    category: string;
    unit: string;
    description: string;
    current_stock: number;
    minimum_stock: number;
    storage_location: string;
    warehouse_storage_zone_id?: string | null;
    supplier?: string;
    status: string;
    purchase_price: number;
}

export interface EditItemFormData extends AddItemFormData {
    id: string;
}

export interface StockInFormData {
    item: string;
    quantity: number;
    supplier: string;
    reference: string;
    remarks: string;
}

export interface StockOutFormData {
    item: string;
    quantity: number;
    department: string;
    purpose: string;
    remarks: string;
    request_id?: string;
    request_number?: string;
}

export interface InternalRequestFormData {
    item_id: string;
    item_name: string;
    item_code: string;
    quantity_requested: number;
    department: string;
    requested_by: string;
    purpose: string;
    remarks?: string;
}

export interface PurchaseRequestFormData {
    requested_by: string;
    supplier: string;
    items: { name: string; quantity: number }[];
    reason: string;
    status: string;
}

export type StockMovementType = 'Stock In' | 'Stock Out' | 'Adjustment';

export interface StockMovement {
    id: string;
    item_id?: string | number | null;
    item_code: string;
    item_name: string;
    movement_type: StockMovementType;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reference?: string | null;
    reference_number?: string | null;
    reason?: string | null;
    notes?: string | null;
    department?: string | null;
    performed_by: string;
    performed_by_id?: string | null;
    created_at: string;
    metadata?: Record<string, any>;
}

export interface StockMovementStats {
    totalStockIn: number;
    totalStockOut: number;
    adjustmentsCount: number;
    netAdjustments: number;
    movementsToday: number;
}

export interface StockMovementsQueryParams {
    search?: string;
    type?: string;
    dateRange?: string; // 'all' | 'today' | 'week' | 'month'
    userDepartment?: string;
    page?: number;
    limit?: number;
}