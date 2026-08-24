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

const LEVEL_SCHEMA = { type: "number", integer: true, min: 1, max: 5 } as const;

const SCORE_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  competency_id: { type: "uuid" },
  current_level: LEVEL_SCHEMA,
  required_level: LEVEL_SCHEMA,
};

const SCORE_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  current_level: { type: "number", optional: true, integer: true, min: 1, max: 5 },
  required_level: { type: "number", optional: true, integer: true, min: 1, max: 5 },
};

const SCORE_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_employee_competency_scores")
    .select("*, hr3_competencies(name, category)");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ scores: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query;

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ scores: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;
  const actor = admin.user;

  if (!actor.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const parsed = await validateJson(request, SCORE_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data: competency, error: competencyError } = await supabaseAdmin
    .from("hr3_competencies")
    .select("id")
    .eq("id", body.competency_id)
    .maybeSingle();

  if (competencyError) {
    return internalError(competencyError);
  }

  if (!competency) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Competency not found");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_employee_competency_scores")
    .insert({
      employee_id: body.employee_id,
      competency_id: body.competency_id,
      current_level: body.current_level,
      required_level: body.required_level,
      assessed_by: actor.employeeId,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ score: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, SCORE_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_employee_competency_scores")
    .update({
      current_level: body.current_level,
      required_level: body.required_level,
      assessed_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Competency score not found");
  }

  return NextResponse.json({ score: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, SCORE_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_employee_competency_scores")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Competency score not found");
  }

  return NextResponse.json({ success: true });
});
