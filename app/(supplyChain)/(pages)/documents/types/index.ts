// type definitions for document management, suppliers, and audit activity history
import { user } from "../../../lib/services/Class/user";

export interface Document {
    id: string;
    title: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    category: string;
    document_type: string;
    supplier: string | null;
    po_number: string | null;
    parcel_batch: string | null;
    uploaded_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    user_id?: string | null;
    session_id?: string | null;
    role?: string | null;
    purchase_id?: string | null;
    force_inserted_by?: string | null;
    document_verification_id?: string | null;
    purchase_orders?: {
        id: string;
        po_number: string;
        supplier_name: string;
        status: string;
        total_amount: number;
    } | null;
    force_user_name?: string | null;
}

export interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
}

export interface Activity {
    id: string;
    user_name: string;
    user_email: string | null;
    action_type: string;
    target_resource: string;
    document_id: string | null;
    document_title: string | null;
    timestamp: string;
    status: string;
    details: any;
}

export const DEFAULT_USER = {
    name: user.getName() || 'System User',
    email: user.getEmail() || 'system@company.com'
};
