export interface Supplier {
    id: string;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string | null;
    notes: string | null;
    is_active: boolean;
    created_at?: string;
    rating?: number;
    distanceKm?: number;
    coords?: {
        lat: number;
        lng: number;
        displayName: string;
    };
}

export interface PurchaseRequestItem {
    name: string;
    item_name?: string;
    quantity: number;
    unit_price?: number;
    price?: number;
    total?: number;
    unit?: string;
    category?: string;
}

export interface PurchaseRequest {
    id: string;
    request_number: string;
    type: string;
    description: string;
    requested_by: string;
    department: string;
    supplier_id: string;
    supplier_name: string;
    amount: number;
    priority: string;
    date: string;
    status: string;
    items: PurchaseRequestItem[];
    reason: string;
    created_at?: string;
    updated_at?: string;
}

export interface StockShortageItem {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    current_stock: number;
    unit: string;
    minimum_stock: number;
    storage_location: string;
    status: 'available' | 'low-stock' | 'out-of-stock';
    updated_at?: string;
    description?: string;
    supplier?: string;
    purchase_price?: number;
    deficit: number;
    estimated_reorder_cost: number;
    source_request?: string;
    source_department?: string;
    is_new_item?: boolean;
    is_from_request?: boolean;
    available_ratio?: string;
    has_no_active_supplier?: boolean;
    request_id?: string;
    is_bid_awarded?: boolean;
    awarded_supplier_name?: string;
    awarded_po_number?: string;
    po_status_indicator?: 'Pending Purchase Order' | 'Waiting for Delivery' | 'Rejected Purchase Order' | 'Delivered' | 'Approval Pending' | null;
    matching_po_number?: string | null;
    matching_po_id?: string | null;
    previous_supplier?: string | null;
    previous_supplier_id?: string | number | null;
    previous_supplier_email?: string | null;
    previous_supplier_phone?: string | null;
    previous_purchase_date?: string | null;
    previous_unit_price?: number | null;
    previous_supplier_obj?: any;
    active_supplier_count?: number;
    active_supplier_names?: string[];
    has_official_active_supplier?: boolean;
    is_supplier_active?: boolean;
    matched_active_supplier?: any;

    // Grouped demand and deficit tracking
    normalized_item_key?: string;
    total_approved_demand?: number;
    requested_demand?: number;
    usable_stock?: number;
    active_po_coverage?: number;
    covered_quantity?: number;
    remaining_deficit?: number;
    immediate_shortage?: number;
    replenishment_buffer?: number;
    official_supplier_id?: number | string | null;
    related_requests_count?: number;
    related_requests?: Array<{
        id: string;
        request_number: string;
        department?: string;
        requested_by?: string;
        quantity: number;
        status: string;
        item_name: string;
        created_at?: string;
    }>;
    covering_purchase_orders?: Array<{
        id: string;
        po_number: string;
        supplier_name?: string;
        quantity: number;
        covered_quantity?: number;
        status: string;
        admin_approval?: string;
        created_at?: string;
    }>;
}

export interface SupplierQuotationItem {
    id: number;
    supplier_id?: number | string;
    supplier_name: string;
    contact_person?: string;
    contact_phone?: string;
    contact_email?: string;
    request_number: string;
    request_id?: string | number | null;
    item_name: string;
    products?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal?: number;
    shipping_fee?: number;
    discount?: number;
    tax_type?: string;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    availability: string;
    lead_time_days: string;
    services_offered?: string[];
    other_products_offer?: any[];
    notes?: string;
    status: string;
    purchase_order_id?: string | null;
    created_at?: string;
}

export interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    subtotal?: number;
    discount?: number;
    shipping_fee?: number;
    tax_rate?: number;
    tax_amount?: number;
    total_amount: number;
    status: string;
    delivery_date: string;
    delivery_location?: string;
    payment_terms?: string;
    terms_and_conditions?: string;
    notes: string;
    items: any[];
    paid: boolean;
    suppliers_qoutation_bid?: number | null;
    created_at?: string;
    updated_at?: string;
}

export interface PurchaseRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    suppliers: Supplier[];
    role: string;
    onRequestSubmitted?: (request: any) => void;
    editData?: any;
    isEdit?: boolean;
    readOnly?: boolean;
}

export interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    request?: PurchaseRequest | null;
    suppliers: Supplier[];
    onOrderCreated?: (order: any) => void;
    defaultAdminApproval?: 'Pending' | 'Approved';
}

export interface ChartDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    month: string;
    monthIndex: number;
    orders: PurchaseOrder[];
    totalAmount: number;
}
