import { createClient } from "@supabase/supabase-js";
import { error } from "console";

const ftmSupabaseUrl = process.env.FTM_SUPABASE_URL;
const ftmSupabaseAnnonKey = process.env.FTM_SUPABASE_ANON_KEY;

if (!ftmSupabaseUrl || !ftmSupabaseAnnonKey) {
    throw new Error('missing creds');
}

export const ftmSupabase = createClient(ftmSupabaseUrl, ftmSupabaseAnnonKey);