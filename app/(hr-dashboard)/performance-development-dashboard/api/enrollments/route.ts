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

const ENROLLMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;

const ENROLLMENT_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid", optional: true },
  course_id: { type: "uuid" },
};

const ENROLLMENT_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  progress_percent: { type: "number", optional: true, min: 0, max: 100 },
  status: { type: "string", optional: true, enum: ENROLLMENT_STATUSES },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_course_enrollments")
    .select("*, hr3_courses(title)");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ enrollments: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ enrollments: data ?? [] });
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

  const parsed = await validateJson(request, ENROLLMENT_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let employeeId: string | null = null;
  if (user.isAdmin && typeof body.employee_id === "string" && body.employee_id) {
    employeeId = body.employee_id;
  } else {
    employeeId = user.employeeId;
  }

  const { data: course, error: courseError } = await supabaseAdmin
    .from("hr3_courses")
    .select("id")
    .eq("id", body.course_id)
    .maybeSingle();

  if (courseError) {
    return internalError(courseError);
  }

  if (!course) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Course not found");
  }

  const { data: existing } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("course_id", body.course_id)
    .maybeSingle();

  if (existing) {
    return errorResponse(ERROR_CODES.CONFLICT, "Already enrolled in this course");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .insert({
      employee_id: employeeId,
      course_id: body.course_id,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return errorResponse(ERROR_CODES.CONFLICT, "Already enrolled in this course");
    }
    return internalError(error);
  }

  return NextResponse.json({ enrollment: data?.[0] }, { status: 201 });
});

async function loadOwnedEnrollment(id: string, userEmployeeId: string | null, isAdmin: boolean) {
  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .select("id, employee_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error } as const;
  if (!data) return { missing: true } as const;
  if (!isAdmin && data.employee_id !== userEmployeeId) {
    return { forbidden: true } as const;
  }
  return { enrollment: data } as const;
}

export const PUT = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = await validateJson(request, ENROLLMENT_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const owned = await loadOwnedEnrollment(
    body.id as string,
    user.employeeId,
    user.isAdmin
  );
  if ("error" in owned) return internalError(owned.error);
  if ("missing" in owned) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Course enrollment not found");
  }
  if ("forbidden" in owned) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "You can only update your own enrollments."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .update({
      progress_percent: body.progress_percent,
      status: body.status,
      completed_at: body.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ enrollment: data?.[0] });
});
