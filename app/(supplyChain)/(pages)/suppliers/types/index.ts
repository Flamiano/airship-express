// type definitions for suppliers module

export interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string;
    notes: string;
    fb_link: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Commercial, terms & banking fields
    other_products_offer?: any[] | string | null;
    payment_terms?: string | null;
    payment_method?: string | null;
    delivery_terms?: string | null;
    warranty?: string | null;
    lead_time?: string | null;
    lead_time_days?: number | string | null;
    moq?: string | null;
    return_policy?: string | null;
    terms_and_conditions?: string | null;
    tin?: string | null;
    tax_id?: string | null;
    tax_type?: string | null;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    [key: string]: any;
}

export interface PurchaseOrderItem {
    name?: string;
    quantity?: number;
    price?: number;
    total?: number;
    [key: string]: any;
}

export interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string | null;
    supplier_id: number | null;
    supplier_name: string;
    total_amount: number;
    category?: string | null;
    subtotal?: number;
    discount?: number;
    shipping_fee?: number;
    tax_rate?: number;
    tax_amount?: number;
    status: string;
    paid: boolean;
    admin_approval?: "Pending" | "Approved" | "Rejected" | string;
    admin_approved_at?: string | null;
    admin_approved_by?: string | null;
    financial_approval?: "Pending" | "Approved" | "Rejected" | string;
    financial_approved_at?: string | null;
    financial_approved_by?: string | null;
    delivery_date: string | null;
    delivery_location?: string | null;
    payment_terms?: string | null;
    terms_and_conditions?: string | null;
    notes: string | null;
    items: PurchaseOrderItem[];
    suppliers_qoutation_bid?: number | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface NewSupplierFormState {
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    products: string;
    fb_link: string;
    notes: string;
}

export interface SelectedChartData {
    supplierName?: string;
    orderCount?: number;
    totalSpent?: number;
    category?: string;
    suppliers?: Supplier[];
}

export interface SupplierStats {
    totalOrders: number;
    totalSpent: number;
    topSupplierName: string;
    topSupplierOrders: number;
    statusCounts: Record<string, number>;
}

export const ITEMS_PER_PAGE = 10;
export const PO_ITEMS_PER_PAGE = 15;
