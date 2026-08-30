import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ERROR_CODES,
  errorResponse,
  handle,
  internalError,
  validateJson,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const ONBOARDING_UPDATE_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  briefed: { type: "boolean", optional: true },
  notes: { type: "string", optional: true, max: 2000 },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_onboarding_records").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ records: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ records: data ?? [] });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;
  const actor = admin.user;

  const parsed = await validateJson(request, ONBOARDING_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const briefed = !!body.briefed;

  let briefedBy: string | null = null;
  if (briefed) {
    if (!actor.employeeId) {
      return errorResponse(
        ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
        "Your account is not linked to an employee profile yet. Contact HR."
      );
    }
    briefedBy = actor.employeeId;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_onboarding_records")
    .upsert(
      {
        employee_id: body.employee_id,
        briefed,
        briefed_at: briefed ? new Date().toISOString() : null,
        briefed_by: briefedBy,
        notes: body.notes ?? null,
      },
      { onConflict: "employee_id" }
    )
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ record: data?.[0] });
});
