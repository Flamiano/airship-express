import "server-only";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type AdminContext = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function getAdminContextByUserId(
  userId: string
): Promise<AdminContext | null> {
  const { data } = await supabaseAdmin
    .from("hr_admin")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.full_name || "Admin",
    email: data.email || "",
    role: data.role || "hr_payroll_admin",
  };
}

export function adminFirstName(ctx: AdminContext | null): string {
  if (!ctx?.name) return "Admin";
  return ctx.name.split(" ")[0];
}
