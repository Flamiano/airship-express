import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { internalError, handle } from "../lib/validate";
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_employee_points").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ points: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query;

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ points: data ?? [] });
});
