
export interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    city?: string | null;
    region?: string | null;
    courier: string | null;
    driver_name?: string | null;
    bulk_qr_code?: string | null;
    bulk_qr_city?: string | null;
    bulk_qr_courier?: string | null;
    status: string;
    scanned_by?: string | null;
    scanner_name?: string | null;
    scanner_email?: string | null;
    scanner_role?: string | null;
    created_at: string;
    updated_at: string;
}

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

export interface InventoryRequest {
    id: string;
    inventory_items_id?: number | null;
    request_number?: string;
    item_id?: string | null;
    item_code?: string | null;
    item_name: string;
    quantity_requested: number;
    department?: string | null;
    message?: string | null;
    approved_or_rejected_by?: string | null;
    possible_delivery_date?: string | null;
    requester_system?: string | null;
    requested_by?: string | null;
    purpose?: string | null;
    remarks?: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'received' | 'fulfilled';
    rejection_reason?: string | null;
    is_internal?: boolean;
    Internal_request?: boolean | null;
    internal_request?: boolean | null;
    created_at: string;
    updated_at?: string;
    approved_at?: string | null;
    approved_by?: string | null;
    fulfilled_at?: string | null;
    fulfilled_by?: string | null;
}

export interface InventoryItem {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    current_stock: number;
    unit: string;
    minimum_stock: number;
    storage_location: string;
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

export interface GroupedParcels {
    date: string;
    parcels: Parcel[];
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
    supplier: string;
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