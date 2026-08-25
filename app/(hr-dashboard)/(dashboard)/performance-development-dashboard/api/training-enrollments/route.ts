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
  type FieldError,
  type Schema,
} from "../lib/validate";
import { getAuthenticatedHrUser } from "../lib/auth";

export const dynamic = "force-dynamic";

const ATTENDANCE_STATUSES = ["attended", "missed", ""] as const;
const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;

const EMPLOYEE_PROFILE_MESSAGE =
  "Your account is not linked to an employee profile yet. Contact HR.";

const TRAINING_ENROLLMENT_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid", optional: true },
  session_id: { type: "uuid" },
};

const TRAINING_ENROLLMENT_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  approval_status: {
    type: "string",
    optional: true,
    enum: APPROVAL_STATUSES,
  },
  attendance_status: { type: "string", optional: true, enum: ATTENDANCE_STATUSES },
};

const TRAINING_ENROLLMENT_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin
    .from("hr3_training_enrollments")
    .select("*, hr3_training_sessions(title, schedule_date, session_type)");
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

async function assertSessionHasCapacity(
  sessionId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select("id, capacity")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { ok: false, response: internalError(sessionError) };
  }

  if (!session) {
    return {
      ok: false,
      response: errorResponse(ERROR_CODES.NOT_FOUND, "Training session not found"),
    };
  }

  if (session.capacity === null || session.capacity === undefined) {
    return { ok: true };
  }

  const { count, error: countError } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countError) {
    return { ok: false, response: internalError(countError) };
  }

  if ((count ?? 0) >= session.capacity) {
    return {
      ok: false,
      response: errorResponse(ERROR_CODES.CONFLICT, "Training session is full"),
    };
  }

  return { ok: true };
}

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  if (!user.employeeId) {
    return errorResponse(ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED, EMPLOYEE_PROFILE_MESSAGE);
  }

  const parsed = await validateJson(request, TRAINING_ENROLLMENT_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let employeeId: string | null = null;
  let approvalStatus: string;
  let approvedBy: string | null = null;

  if (user.isAdmin) {
    if (typeof body.employee_id !== "string" || !body.employee_id) {
      const errors: FieldError[] = [
        { field: "employee_id", message: "employee_id is required when assigning a session" },
      ];
      return validationResponse(errors);
    }
    employeeId = body.employee_id;
    approvalStatus = "approved";
    approvedBy = user.employeeId;
  } else {
    employeeId = user.employeeId;
    approvalStatus = "pending";
    approvedBy = null;
  }

  const capacity = await assertSessionHasCapacity(body.session_id as string);
  if (!capacity.ok) return capacity.response;

  const { data: existing } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("session_id", body.session_id)
    .maybeSingle();

  if (existing) {
    return errorResponse(ERROR_CODES.CONFLICT, "Already assigned to this session");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .insert({
      employee_id: employeeId,
      session_id: body.session_id,
      approval_status: approvalStatus,
      approved_by: approvedBy,
      attendance_status: null,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return errorResponse(ERROR_CODES.CONFLICT, "Already assigned to this session");
    }
    return internalError(error);
  }

  return NextResponse.json({ enrollment: data?.[0] }, { status: 201 });
});

export const PUT = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  if (!user.isAdmin) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "Only HR administrators can update training approvals and attendance."
    );
  }

  const parsed = await validateJson(request, TRAINING_ENROLLMENT_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (body.approval_status === undefined && body.attendance_status === undefined) {
    return validationResponse([
      {
        field: "approval_status",
        message: "Provide approval_status or attendance_status to update",
      },
    ]);
  }

  const payload: Record<string, unknown> = {};

  if (body.approval_status !== undefined) {
    payload.approval_status = body.approval_status;
    if (body.approval_status === "approved" || body.approval_status === "rejected") {
      if (!user.employeeId) {
        return errorResponse(
          ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
          EMPLOYEE_PROFILE_MESSAGE
        );
      }
      payload.approved_by = user.employeeId;
    }
  }

  if (body.attendance_status !== undefined) {
    payload.attendance_status = body.attendance_status ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .update(payload)
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Training enrollment not found");
  }

  return NextResponse.json({ enrollment: data[0] });
});

export const DELETE = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  if (!user.isAdmin) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "Only HR administrators can unassign staff."
    );
  }

  const errors = validateQuery(request.url, TRAINING_ENROLLMENT_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Training enrollment not found");
  }

  return NextResponse.json({ success: true });
});
