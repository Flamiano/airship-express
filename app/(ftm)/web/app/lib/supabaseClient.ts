import { getCachedSupabaseClient } from "../../lib/supabaseClientFactory";

const FALLBACK_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "placeholder-anon-key";

const hasHrCredentials = Boolean(
  process.env.NEXT_PUBLIC_HR_SUPABASE_URL && process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY
);

const useHrAuth = process.env.NEXT_PUBLIC_FTM_AUTH_PROVIDER === "hr" && hasHrCredentials;

const supabaseUrl = useHrAuth
  ? process.env.NEXT_PUBLIC_HR_SUPABASE_URL || FALLBACK_SUPABASE_URL
  : process.env.NEXT_PUBLIC__FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;

const supabaseAnonKey = useHrAuth
  ? process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

if (!useHrAuth && !process.env.NEXT_PUBLIC__FTM_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    "Missing NEXT_PUBLIC__FTM_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL. Falling back to placeholder client values."
  );
}

export const supabase = getCachedSupabaseClient(supabaseUrl, supabaseAnonKey);
