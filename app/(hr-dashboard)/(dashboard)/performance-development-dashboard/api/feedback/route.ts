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
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

const FEEDBACK_TYPES = ["check_in", "recognition", "coaching", "improvement"] as const;

const FEEDBACK_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid", optional: true },
  feedback_type: { type: "string", optional: true, enum: FEEDBACK_TYPES },
  message: { type: "string", min: 1, max: 1000 },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_performance_feedback").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ feedback: [] });
    }
    query = query.or(
      `employee_id.eq.${user.employeeId},given_by.eq.${user.employeeId}`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ feedback: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  if (!user.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const parsed = await validateJson(request, FEEDBACK_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let employeeId: string | null = null;
  if (user.isAdmin && typeof body.employee_id === "string" && body.employee_id) {
    employeeId = body.employee_id;
  } else {
    employeeId = user.employeeId;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .insert({
      employee_id: employeeId,
      given_by: user.employeeId,
      feedback_type: body.feedback_type || "check_in",
      message: body.message,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ feedback: data?.[0] }, { status: 201 });
});
