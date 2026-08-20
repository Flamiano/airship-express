
export interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    courier: string | null;
    status: string;
    created_at: string;
    updated_at: string
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
}

export interface PurchaseRequestFormData {
    requested_by: string;
    supplier: string;
    items: { name: string; quantity: number }[];
    reason: string;
    status: string;
}