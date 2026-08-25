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

const APPRAISAL_STATUSES = ["draft", "reviewed", "finalized"] as const;

const APPRAISAL_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  review_period: { type: "string", min: 1, max: 100 },
  status: { type: "string", optional: true, enum: APPRAISAL_STATUSES },
};

const APPRAISAL_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  status: { type: "string", optional: true, enum: APPRAISAL_STATUSES },
  manager_rating: { type: "number", optional: true, min: 1, max: 10 },
  final_score: { type: "number", optional: true, min: 0, max: 100 },
  comments: { type: "string", optional: true, max: 2000 },
  strengths: { type: "string", optional: true, max: 2000 },
  improvements: { type: "string", optional: true, max: 2000 },
  manager_dimension_scores: {
    type: "array",
    optional: true,
    max: 50,
    item: {
      dimension: { type: "string", max: 200 },
      score: { type: "number", min: 1, max: 5 },
    },
  },
  goal_scores: {
    type: "array",
    optional: true,
    max: 50,
    item: {
      goal_id: { type: "uuid" },
      title: { type: "string", max: 500 },
      score: { type: "number", min: 1, max: 5 },
    },
  },
  acknowledge: { type: "boolean", optional: true },
};

const APPRAISAL_DELETE_SCHEMA: Schema = {
  id: { type: "uuid" },
};

export const GET = handle(async () => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  let query = supabaseAdmin.from("hr3_performance_appraisals").select("*");
  if (!user.isAdmin) {
    if (!user.employeeId) {
      return NextResponse.json({ appraisals: [] });
    }
    query = query.eq("employee_id", user.employeeId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ appraisals: data ?? [] });
});

export const POST = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;
  const actor = admin.user;

  const parsed = await validateJson(request, APPRAISAL_BODY_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  if (!actor.employeeId) {
    return errorResponse(
      ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
      "Your account is not linked to an employee profile yet. Contact HR."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .insert({
      employee_id: body.employee_id,
      reviewer_id: actor.employeeId,
      review_period: body.review_period,
      status: body.status || "draft",
    })
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ appraisal: data?.[0] }, { status: 201 });
});

async function loadAppraisal(id: string) {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("id, employee_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error } as const;
  if (!data) return { missing: true } as const;
  return { appraisal: data } as const;
}

export const PUT = handle(async (request: Request) => {
  const auth = await getAuthenticatedHrUser();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const parsed = await validateJson(request, APPRAISAL_UPDATE_SCHEMA);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const loaded = await loadAppraisal(body.id as string);
  if ("error" in loaded) return internalError(loaded.error);
  if ("missing" in loaded) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Appraisal not found");
  }

  const appraisal = loaded.appraisal;
  const isAdmin = user.isAdmin;
  const isOwner =
    !isAdmin && !!user.employeeId && appraisal.employee_id === user.employeeId;

  if (!isAdmin && !isOwner) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "You don't have permission to update this appraisal."
    );
  }

  const hasRatingFields =
    body.status !== undefined ||
    body.manager_rating !== undefined ||
    body.final_score !== undefined ||
    body.comments !== undefined ||
    body.strengths !== undefined ||
    body.improvements !== undefined ||
    body.manager_dimension_scores !== undefined ||
    body.goal_scores !== undefined;

  if (isOwner) {
    if (hasRatingFields) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "You can only acknowledge this appraisal."
      );
    }
    if (!body.acknowledge) {
      return validationResponse([
        { field: "acknowledge", message: "acknowledge must be true" },
      ]);
    }

    const { data, error } = await supabaseAdmin
      .from("hr3_performance_appraisals")
      .update({
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", appraisal.id)
      .select();

    if (error) {
      return internalError(error);
    }

    return NextResponse.json({ appraisal: data?.[0] });
  }

  const managerDimensionScores = Array.isArray(body.manager_dimension_scores)
    ? body.manager_dimension_scores
    : [];

  const managerAverage =
    managerDimensionScores.length > 0
      ? Math.round(
          (managerDimensionScores.reduce(
            (sum: number, d: { score: number }) => sum + d.score,
            0
          ) /
            managerDimensionScores.length) *
            10
        ) / 10
      : body.manager_rating;

  const payload: Record<string, unknown> = {
    status: body.status,
    comments: body.comments,
    strengths: body.strengths,
    improvements: body.improvements,
    updated_at: new Date().toISOString(),
  };

  if (Array.isArray(body.goal_scores)) {
    payload.goal_scores = body.goal_scores;
  }

  if (managerDimensionScores.length > 0) {
    payload.manager_dimension_scores = managerDimensionScores;
    payload.manager_rating = managerAverage;
  }

  if (body.status === "finalized") {
    payload.final_score =
      managerAverage ?? body.final_score;
    payload.finalized_at = new Date().toISOString();
  }

  if (body.acknowledge) {
    payload.acknowledged_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .update(payload)
    .eq("id", appraisal.id)
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ appraisal: data?.[0] });
});

export const DELETE = handle(async (request: Request) => {
  const admin = await requireHrAdmin();
  if (!admin.ok) return admin.response;

  const errors = validateQuery(request.url, APPRAISAL_DELETE_SCHEMA);
  if (errors.length > 0) return validationResponse(errors);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")!;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return internalError(error);
  }

  if (!data || data.length === 0) {
    return errorResponse(ERROR_CODES.NOT_FOUND, "Appraisal not found");
  }

  return NextResponse.json({ success: true });
});
