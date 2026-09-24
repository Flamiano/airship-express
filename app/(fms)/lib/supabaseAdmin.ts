import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_FMS_SUPABASE_URL!;
const serviceRoleKey = process.env.FMS_SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);