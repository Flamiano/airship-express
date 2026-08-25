import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ERROR_CODES,
  errorResponse,
  handle,
  internalError,
  validateJson,
  validateQuery,
  validationResponse,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser, requireHrAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

const PIP_STATUSES = ["active", "completed", "failed"] as const;

const PIP_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  reason: { type: "string", min: 1, max: 1000 },
  action_plan: { type: "string", min: 1, max: 2000 },
  start_date: { type: "date" },
  end_date: { type: "date", optional: true },
};

const PIP_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  action_plan: { type: "string", optional: true, max: 2000 },
  status: { type: "string", optional: true, enum: PIP_STATUSES },
  end_date: { type: "date", optional: true },
};

const PIP_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_performance_improvement_plans")
    .select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ pips: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ pips: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, PIP_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_improvement_plans")
    .insert({
      employee_id: body.employee_id,
      reason: body.reason,
      action_plan: body.action_plan,
      start_date: body.start_date,
      end_date: body.end_date,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ pip: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, PIP_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_improvement_plans")
    .update({
      action_plan: body.action_plan,
      status: body.status,
      end_date: body.end_date,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Performance improvement plan not found");
  }

  return NextResponse.json({ pip: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, PIP_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_improvement_plans")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Performance improvement plan not found");
  }

  return NextResponse.json({ success: true });
});
