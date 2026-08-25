import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
      console.error("[performance-development] signOut failed:", cause);
    }
  }

  cookieStore.delete("hr_access_token");
  cookieStore.delete("hr_refresh_token");
  cookieStore.delete("hr_role");

  return NextResponse.json({ success: true });
});
