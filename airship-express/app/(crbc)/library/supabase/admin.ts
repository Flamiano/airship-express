import { createClient } from "@supabase/supabase-js";

export const adminCreateClient = () => createClient(
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_SERVICE_ROLE_KEY!
)