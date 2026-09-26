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

const PUT_SCHEMA: Schema = {
  goal_id: { type: "uuid" as const },
  competency_ids: { type: "array" as const, optional: true, max: 100 },
};

const DELETE_SCHEMA: Schema = {
  goal_id: { type: "uuid" as const },
  competency_id: { type: "uuid" as const },
};

export const GET = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("goal_id");

  let query = supabaseAdmin
    .from("hr3_goal_competencies")
    .select("*, hr3_competencies(name, category)")
    .order("created_at", { ascending: true });

  if (goalId) {
    query = query.eq("goal_id", goalId);
  }

  if (!user.isAdmin && user.employeeId) {
    const { data: employeeRows } = await supabaseAdmin
      .from("hr1_employees")
      .select("id")
      .eq("employee_id_number", user.employeeNumber)
      .limit(1);

    const employeeId = employeeRows?.[0]?.id;
    if (!employeeId) {
      return NextResponse.json({ goal_competencies: [] });
    }

    const { data: ownGoalIds } = await supabaseAdmin
      .from("hr3_performance_goals")
      .select("id")
      .eq("employee_id", employeeId);

    const ids = (ownGoalIds ?? []).map((g: { id: string }) => g.id);
    if (ids.length === 0) {
      return NextResponse.json({ goal_competencies: [] });
    }

    query = query.in("goal_id", ids);
  }

  const { data, error } = await query;

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ goal_competencies: data ?? [] });
});

export const PUT = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;
  const actor = admin.user;

  const parsed = await validateJson(request, PUT_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const goalId = body.goal_id as string;
  const competencyIds = (body.competency_ids as string[] | undefined) ?? [];

  const { data: goal, error: goalError } = await supabaseAdmin
    .from("hr3_performance_goals")
    .select("id")
    .eq("id", goalId)
    .maybeSingle();

  if (goalError) {
    return internalError(goalError);
  }

  if (!goal) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Goal not found");
  }

  if (competencyIds.length > 0) {
    const { data: competencies, error: compError } = await supabaseAdmin
      .from("hr3_competencies")
      .select("id")
      .in("id", competencyIds);

    if (compError) {
      return internalError(compError);
    }

    const validIds = new Set((competencies ?? []).map((c: { id: string }) => c.id));
    const invalid = competencyIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        `Competency not found: ${invalid[0]}`
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("hr3_goal_competencies")
    .delete()
    .eq("goal_id", goalId);

  if (deleteError) {
    return internalError(deleteError);
  }

  if (competencyIds.length > 0) {
    const rows = competencyIds.map((competencyId) => ({
      goal_id: goalId,
      competency_id: competencyId,
      created_by: actor.employeeId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("hr3_goal_competencies")
      .insert(rows);

    if (insertError) {
      return internalError(insertError);
    }
  }

  const { data: updated } = await supabaseAdmin
    .from("hr3_goal_competencies")
    .select("*, hr3_competencies(name, category)")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ goal_competencies: updated ?? [] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get("goal_id")!;
  const competencyId = searchParams.get("competency_id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_goal_competencies")
    .delete()
    .eq("goal_id", goalId)
    .eq("competency_id", competencyId)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Goal competency link not found");
  }

  return NextResponse.json({ success: true });
});
