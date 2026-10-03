import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create Supabase server client with optional role-based cookie options
 * @param role - User role for session timeout: 'staff' (8h) | 'customer' (30m idle / 24h max)
 */
export const createClient = async (role?: "staff" | "customer") => {
  const cookieStore = await cookies();

  // Role-based cookie options for session timeout
  const cookieOptions: CookieOptions = {};

  if (role === "staff") {
    // Staff: 8 hours max age
    cookieOptions.maxAge = 60 * 10; // 10 mins
  } else if (role === "customer") {
    // Set cookie maxAge to 30 mins absolute max
    cookieOptions.maxAge = 60 * 10; // 10 mins
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_PUB_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Merge role-based options with existing options
              const mergedOptions: CookieOptions = {
                ...options,
                ...cookieOptions,
                // Preserve security settings
                secure: options.secure ?? true,
                sameSite: options.sameSite ?? "lax",
                httpOnly: options.httpOnly ?? true,
                path: options.path ?? "/",
              };
              cookieStore.set(name, value, mergedOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

/**
 * Create client with automatic role detection from existing session
 */
export const createClientWithRole = async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CRBC_SUPABASE_PUB_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op for read-only client
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return supabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return createClient(profile?.role as "staff" | "customer" | undefined);
};