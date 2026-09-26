import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { handle, internalError } from "../lib/validate";
import { requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const auth = await requireHrAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, department, is_active")
    .eq("is_active", true)
    .order("title");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({
    job_positions: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      department: row.department ?? null,
      is_active: row.is_active ?? true,
    })),
  });
});
