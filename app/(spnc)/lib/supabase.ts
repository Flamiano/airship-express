import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SERVICE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase environment variables. Add NEXT_PUBLIC_SERVICE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment."
    );
  }

  return createClient(url, serviceKey);
}