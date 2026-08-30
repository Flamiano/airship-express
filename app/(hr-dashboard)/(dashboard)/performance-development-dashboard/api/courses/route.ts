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

const COURSE_BODY_SCHEMA: Schema = {
  title: { type: "string", min: 1, max: 200 },
  description: { type: "string", optional: true, max: 2000 },
  duration_minutes: { type: "number", integer: true, min: 1, max: 10080 },
  competency_id: { type: "uuid", optional: true },
};

const COURSE_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  title: { type: "string", optional: true, max: 200 },
  description: { type: "string", optional: true, max: 2000 },
  duration_minutes: { type: "number", optional: true, integer: true, min: 1, max: 10080 },
  competency_id: { type: "uuid", optional: true },
};

const COURSE_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .select("*, hr3_competencies(name)");

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ courses: data ?? [] });
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

  const parsed = await validateJson(request, COURSE_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (body.competency_id) {
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
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .insert({
      title: body.title,
      description: body.description,
      duration_minutes: body.duration_minutes,
      competency_id: body.competency_id || null,
      created_by: actor.employeeId,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ course: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, COURSE_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .update({
      title: body.title,
      description: body.description,
      duration_minutes: body.duration_minutes,
      competency_id: body.competency_id || null,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Course not found");
  }

  return NextResponse.json({ course: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, COURSE_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Course not found");
  }

  return NextResponse.json({ success: true });
});
