import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import type { AppRole } from "../../../payroll-benefits-dashboard/types";

const PAYROLL_WRITE_ROLES: AppRole[] = ["super_admin", "hr_payroll_admin"];

export type AdminSession = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
};

export async function requireAdmin(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hr_access_token")?.value;
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
    token
  );
  if (userError || !userData?.user) return null;

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("hr_admin")
    .select("id, full_name, email, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) return null;
  if (!PAYROLL_WRITE_ROLES.includes(admin.role as AppRole)) return null;

  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.full_name,
    role: admin.role as AppRole,
  };
}
