// type definitions for document management, suppliers, and audit activity history
import { user } from "../../../lib/services/Class/user";

export interface Document {
    id: string;
    supplier_id?: number | null;
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
    file_url?: string | null;
    extracted_text?: string | null;
    extracted_data?: any;
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
    Price?: string | null;
    extracted?: {
        text?: string | null;
        description?: string | null;
        visual_objects?: string[];
        vendor_name?: string | null;
        po_number?: string | null;
        price?: string | null;
        summary?: string | null;
        document_type?: string | null;
        category?: string | null;
        confidence_score?: number;
        extracted_at?: string;
        [key: string]: any;
    } | null;
}

export interface Supplier {
    id: number;
    name: string;
    category: string;
    contact_person: string;
    phone: string;
    email: string;
    location: string;
    is_active?: boolean;
    status?: string;
    document_count?: number;
    photo_count?: number;
    total_files?: number;
    total_size?: number;
    latest_upload?: string | null;
}

export interface Activity {
    id: string;
    user_name: string;
    user_email: string | null;
    user_id?: string | null;
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
