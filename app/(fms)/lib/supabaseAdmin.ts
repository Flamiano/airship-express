import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_FMS_SUPABASE_URL || "https://placeholder-fms.supabase.co";
const serviceRoleKey = process.env.FMS_SUPABASE_SERVICE_ROLE_KEY || "placeholder-fms-service-role-key";

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