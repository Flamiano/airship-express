import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SPNC_URL;
  const serviceKey = process.env.SUPABASE_SPNC_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase environment variables. Add NEXT_PUBLIC_SPNC_URL and SUPABASE_SPNC_ROLE_KEY to your environment."
    );
  }

  return createClient(url, serviceKey);
}