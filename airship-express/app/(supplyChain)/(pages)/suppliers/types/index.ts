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
    status: string;
    paid: boolean;
    delivery_date: string | null;
    notes: string | null;
    items: PurchaseOrderItem[];
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
