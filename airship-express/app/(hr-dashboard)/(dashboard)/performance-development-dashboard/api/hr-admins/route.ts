import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAuthenticatedHrUser } from "../lib/auth";
import { handle, internalError } from "../lib/validate";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("hr_admin")
    .select("id, full_name, email, role, employee_id")
    .order("full_name");

  if (error) {
    return internalError(error);
  }

  const admins = (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    employee_id: row.employee_id,
  }));

  return NextResponse.json({ admins });
});
