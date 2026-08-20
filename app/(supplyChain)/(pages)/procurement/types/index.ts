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
}

export interface PurchaseRequestItem {
    name: string;
    quantity: number;
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

export interface PurchaseOrder {
    id: string;
    po_number: string;
    request_id: string;
    supplier_id: string;
    supplier_name: string;
    total_amount: number;
    status: string;
    delivery_date: string;
    notes: string;
    items: any[];
    paid: boolean;
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
}

export interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: PurchaseRequest | null;
    suppliers: Supplier[];
    onOrderCreated?: (order: any) => void;
}

export interface ChartDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    month: string;
    monthIndex: number;
    orders: PurchaseOrder[];
    totalAmount: number;
}
