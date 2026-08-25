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

const CERTIFICATION_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  course_id: { type: "uuid" },
  certificate_url: { type: "string", optional: true, max: 500 },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_certifications")
    .select("*, hr3_courses(title)");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ certifications: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ certifications: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const parsed = await validateJson(request, CERTIFICATION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

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

  const { data, error } = await supabaseAdmin
    .from("hr3_certifications")
    .insert({
      employee_id: body.employee_id,
      course_id: body.course_id,
      certificate_url: body.certificate_url,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ certification: data?.[0] }, { status: 201 });
});
