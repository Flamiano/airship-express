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
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

const FEEDBACK_TYPES = ["check_in", "recognition", "coaching", "improvement"] as const;

const FEEDBACK_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid", optional: true },
  feedback_type: { type: "string", optional: true, enum: FEEDBACK_TYPES },
  message: { type: "string", min: 1, max: 1000 },
};

const FEEDBACK_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  message: { type: "string", optional: true, min: 1, max: 1000 },
  feedback_type: { type: "string", optional: true, enum: FEEDBACK_TYPES },
};

const FEEDBACK_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
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

async function loadOwnedFeedback(id: string, actorEmployeeId: string | null, isAdmin: boolean) {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .select("id, given_by")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error } as const;
  if (!data) return { missing: true } as const;
  if (!isAdmin && data.given_by !== actorEmployeeId) {
    return { forbidden: true } as const;
  }
  return { feedback: data } as const;
}

export const PUT = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = await validateJson(request, FEEDBACK_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value as Record<string, unknown>;

  const feedbackId = body.id as string;
  const owned = await loadOwnedFeedback(feedbackId, user.employeeId, user.isAdmin);
  if ("error" in owned) return internalError(owned.error);
  if ("missing" in owned) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Feedback not found");
  }
  if ("forbidden" in owned) {
    return errorResponse(ERROR_CODES.FORBIDDEN, "You can only edit your own feedback.");
  }

  const payload: Record<string, unknown> = {};
  if (body.message !== undefined) payload.message = body.message;
  if (body.feedback_type !== undefined) payload.feedback_type = body.feedback_type;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .update(payload)
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ feedback: data?.[0] });
});

export const DELETE = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const errors = validateQuery(request.url, FEEDBACK_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const owned = await loadOwnedFeedback(id, user.employeeId, user.isAdmin);
  if ("error" in owned) return internalError(owned.error);
  if ("missing" in owned) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Feedback not found");
  }
  if ("forbidden" in owned) {
    return errorResponse(ERROR_CODES.FORBIDDEN, "You can only delete your own feedback.");
  }

  const { error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .delete()
    .eq("id", id);

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ success: true });
});
