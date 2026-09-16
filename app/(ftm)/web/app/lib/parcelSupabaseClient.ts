import { getCachedSupabaseClient } from "../../lib/supabaseClientFactory";

const parcelSupabaseUrl = process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL!;
const parcelSupabaseAnonKey = process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY!;

if (!parcelSupabaseUrl || !parcelSupabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL or NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY in ../.env"
  );
}

export const parcelSupabase = getCachedSupabaseClient(parcelSupabaseUrl, parcelSupabaseAnonKey);