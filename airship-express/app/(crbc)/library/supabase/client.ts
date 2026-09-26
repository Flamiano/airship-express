import { createBrowserClient } from "@supabase/ssr";


export const createClient = () => createBrowserClient(
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_PUB_KEY!
);
