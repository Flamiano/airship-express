import { createClient } from "@supabase/supabase-js";

const ftmSupabaseUrl =
    process.env.NEXT_PUBLIC_FTM_SUPABASE_URL ||
    process.env.NEXT_PUBLIC__FTM_SUPABASE_URL ||
    process.env.FTM_SUPABASE_URL;

const ftmSupabaseAnonKey =
    process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC__FTM_SUPABASE_ANON_KEY ||
    process.env.FTM_SUPABASE_ANON_KEY;

if (!ftmSupabaseUrl || !ftmSupabaseAnonKey) {
    console.warn("Warning: FTM Supabase credentials (NEXT_PUBLIC_FTM_SUPABASE_URL / NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY) are missing in environment variables.");
}

export const ftmSupabase = createClient(
    ftmSupabaseUrl || "https://placeholder-ftm.supabase.co",
    ftmSupabaseAnonKey || "placeholder-ftm-anon-key"
);