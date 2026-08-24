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

const GOAL_CATEGORIES = ["individual", "department", "company"] as const;
const GOAL_STATUSES = ["not_started", "in_progress", "completed", "missed"] as const;
const GOAL_PRIORITIES = ["low", "medium", "high"] as const;

const GOAL_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid", optional: true },
  title: { type: "string", min: 1, max: 200 },
  description: { type: "string", optional: true, max: 2000 },
  category: { type: "string", optional: true, enum: GOAL_CATEGORIES },
  status: { type: "string", optional: true, enum: GOAL_STATUSES },
  priority: { type: "string", optional: true, enum: GOAL_PRIORITIES },
  progress_percent: { type: "number", optional: true, min: 0, max: 100 },
  target: { type: "string", optional: true, max: 500 },
  due_date: { type: "date", optional: true },
};

const GOAL_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  title: { type: "string", optional: true, max: 200 },
  description: { type: "string", optional: true, max: 2000 },
  category: { type: "string", optional: true, enum: GOAL_CATEGORIES },
  status: { type: "string", optional: true, enum: GOAL_STATUSES },
  priority: { type: "string", optional: true, enum: GOAL_PRIORITIES },
  progress_percent: { type: "number", optional: true, min: 0, max: 100 },
  target: { type: "string", optional: true, max: 500 },
  due_date: { type: "date", optional: true },
};

const GOAL_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_performance_goals").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ goals: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ goals: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = await validateJson(request, GOAL_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let employeeId: string | null = null;
  if (user.isAdmin && typeof body.employee_id === "string" && body.employee_id) {
    employeeId = body.employee_id;
  } else {
    employeeId = user.employeeId;
  }

  if (!employeeId || !user.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .insert({
      employee_id: employeeId,
      assigned_by: user.employeeId,
      title: body.title,
      description: body.description,
      category: body.category,
      status: body.status || "not_started",
      priority: body.priority || "medium",
      progress_percent: body.progress_percent ?? 0,
      target: body.target,
      due_date: body.due_date,
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ goal: data?.[0] }, { status: 201 });
});

async function loadOwnedGoal(id: string, userEmployeeId: string | null, isAdmin: boolean) {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .select("id, employee_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error } as const;
  if (!data) return { missing: true } as const;
  if (!isAdmin && data.employee_id !== userEmployeeId) {
    return { forbidden: true } as const;
  }
  return { goal: data } as const;
}

export const PUT = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = await validateJson(request, GOAL_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const owned = await loadOwnedGoal(
    body.id as string,
    user.employeeId,
    user.isAdmin
  );
  if ("error" in owned) return internalError(owned.error);
  if ("missing" in owned) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Goal not found");
  }
  if ("forbidden" in owned) {
    return errorResponse(ERROR_CODES.FORBIDDEN, "You can only update your own goals.");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .update({
      title: body.title,
      description: body.description,
      category: body.category,
      status: body.status,
      priority: body.priority,
      progress_percent: body.progress_percent,
      target: body.target,
      due_date: body.due_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ goal: data?.[0] });
});

export const DELETE = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const errors = validateQuery(request.url, GOAL_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const owned = await loadOwnedGoal(id, user.employeeId, user.isAdmin);
  if ("error" in owned) return internalError(owned.error);
  if ("missing" in owned) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Goal not found");
  }
  if ("forbidden" in owned) {
    return errorResponse(ERROR_CODES.FORBIDDEN, "You can only delete your own goals.");
  }

  const { error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .delete()
    .eq("id", id);

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ success: true });
});
