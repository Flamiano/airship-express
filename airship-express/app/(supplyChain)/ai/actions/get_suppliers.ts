// app/(supplyChain)/ai/actions/get_suppliers.ts

import { supabase } from "../../lib/services/client/supabase";

export interface Supplier {
    id: string | number;
    name: string;
    category?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    location?: string;
    is_active?: boolean;
    products?: string;
    created_at?: string;
}

/**
 * Get all suppliers or search by category / query
 */
export async function getSuppliers(params?: { category?: string; query?: string; limit?: number }): Promise<Supplier[]> {
    let q = supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

    if (params?.category) {
        q = q.ilike('category', `%${params.category}%`);
    }

    if (params?.query) {
        q = q.or(`name.ilike.%${params.query}%,contact_person.ilike.%${params.query}%,category.ilike.%${params.query}%`);
    }

    if (params?.limit) {
        q = q.limit(params.limit);
    }

    const { data, error } = await q;

    if (error) {
        console.error('Error fetching suppliers:', error);
        return [];
    }

    return (data || []) as Supplier[];
}

/**
 * Get supplier summary (counts by category, total active)
 */
export async function getSuppliersSummary(): Promise<{
    total: number;
    activeCount: number;
    inactiveCount: number;
    categories: Record<string, number>;
}> {
    const suppliers = await getSuppliers();

    const categories: Record<string, number> = {};
    let activeCount = 0;
    let inactiveCount = 0;

    suppliers.forEach(s => {
        const cat = s.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
        if (s.is_active === false) {
            inactiveCount++;
        } else {
            activeCount++;
        }
    });

    return {
        total: suppliers.length,
        activeCount,
        inactiveCount,
        categories,
    };
}
