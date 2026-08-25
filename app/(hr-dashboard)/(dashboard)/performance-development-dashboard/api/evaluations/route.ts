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

const EVALUATION_BODY_SCHEMA: Schema = {
  session_id: { type: "uuid" },
  employee_id: { type: "uuid", optional: true },
  rating: { type: "number", min: 1, max: 5 },
  comments: { type: "string", optional: true, max: 2000 },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_training_evaluations")
    .select("*, hr3_training_sessions(title)");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ evaluations: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ evaluations: data ?? [] });
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

  const parsed = await validateJson(request, EVALUATION_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let employeeId: string | null = null;
  if (user.isAdmin && typeof body.employee_id === "string" && body.employee_id) {
    employeeId = body.employee_id;
  } else {
    employeeId = user.employeeId;
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select("id")
    .eq("id", body.session_id)
    .maybeSingle();

  if (sessionError) {
    return internalError(sessionError);
  }

  if (!session) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Training session not found");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_evaluations")
    .insert({
      session_id: body.session_id,
      employee_id: employeeId,
      rating: body.rating,
      comments: body.comments,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return errorResponse(ERROR_CODES.CONFLICT, "You already submitted an evaluation for this session");
    }
    return internalError(error);
  }

  return NextResponse.json({ evaluation: data?.[0] }, { status: 201 });
});
