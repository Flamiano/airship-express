"use server";

import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";

export interface Courier {
    id: number;
    code: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    contact_number: string | null;
    email: string | null;
    website: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export async function getActiveCouriers(): Promise<Courier[]> {
    try {
        const { data, error } = await supabase
            .from('couriers')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            return [];
        }

        return data || [];
    } catch (error) {
        return [];
    }
}