import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { handle } from "../../lib/validate";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const cookieStore = await cookies();

  const token = cookieStore.get("hr_access_token")?.value;
  if (token) {
    try {
      await supabaseAdmin.auth.admin.signOut(token);
    } catch (cause) {
      console.error("[performance-development] admin signOut failed:", cause);
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_HR_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  cookieStore.delete("hr_access_token");
  cookieStore.delete("hr_refresh_token");
  cookieStore.delete("hr_role");

  return NextResponse.json({ success: true });
});
