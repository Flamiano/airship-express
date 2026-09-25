import { getCachedSupabaseClient } from "../../lib/supabaseClientFactory";

const hasHrCredentials = Boolean(
  process.env.NEXT_PUBLIC_HR_SUPABASE_URL && process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY
);

const useHrAuth = process.env.NEXT_PUBLIC_FTM_AUTH_PROVIDER === "hr" && hasHrCredentials;

const supabaseUrl = useHrAuth
  ? process.env.NEXT_PUBLIC_HR_SUPABASE_URL
  : process.env.NEXT_PUBLIC__FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = useHrAuth
  ? process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC__FTM_SUPABASE_URL or NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY in ../.env"
  );
}

export const supabase = getCachedSupabaseClient(supabaseUrl, supabaseAnonKey);
