import { getCachedSupabaseClient } from "./supabaseClientFactory";

const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "placeholder-anon-key";

const supabaseUrl =
  process.env.NEXT_PUBLIC__FTM_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  FALLBACK_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  FALLBACK_SUPABASE_ANON_KEY;

if (!process.env.NEXT_PUBLIC__FTM_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    "Missing NEXT_PUBLIC__FTM_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL. Falling back to placeholder client values."
  );
}

export const supabase = getCachedSupabaseClient(supabaseUrl, supabaseAnonKey);
