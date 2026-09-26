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

// Appraisal lifecycle transitions are enforced as a workflow:
// draft → reviewed → finalized. Only these (including self/identity
// transitions) are permitted when a client submits a status change.
const APPRAISAL_ALLOWED_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  draft: ["draft", "reviewed"],
  reviewed: ["reviewed", "finalized"],
  finalized: ["finalized"],
};

const APPRAISAL_BODY_SCHEMA: Schema = {
  employee_id: { type: "uuid" },
  review_period: { type: "string", min: 1, max: 100 },
  reviewer_hr_admin_id: { type: "uuid", optional: true },
  self_rating: { type: "number", optional: true },
  status: { type: "string", optional: true, enum: APPRAISAL_STATUSES },
};

const APPRAISAL_UPDATE_SCHEMA: Schema = {
  id: { type: "uuid" },
  status: { type: "string", optional: true, enum: APPRAISAL_STATUSES },
  manager_rating: { type: "number", optional: true, min: 1, max: 10 },
  final_score: { type: "number", optional: true, min: 0, max: 100 },
  self_rating: { type: "number", optional: true, min: 1, max: 5 },
  reviewer_hr_admin_id: { type: "uuid", optional: true },
  performance_rating: { type: "string", optional: true, max: 50 },
  letter_grade: { type: "string", optional: true, max: 10 },
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

  const insertPayload: Record<string, unknown> = {
    employee_id: body.employee_id,
    reviewer_id: actor.employeeId,
    review_period: body.review_period,
    status: body.status || "draft",
  };

  if (body.reviewer_hr_admin_id) {
    insertPayload.reviewer_hr_admin_id = body.reviewer_hr_admin_id;
  }
  if (body.self_rating !== undefined && body.self_rating !== null) {
    insertPayload.self_rating = body.self_rating;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .insert(insertPayload)
    .select();

  if (error) {
    return internalError(error);
  }

  return NextResponse.json({ appraisal: data?.[0] }, { status: 201 });
});

async function loadAppraisal(id: string) {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("id, employee_id, status, reviewer_hr_admin_id, self_rating, manager_rating")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error } as const;
  if (!data) return { missing: true } as const;
  return { appraisal: data } as const;
}

async function loadOpenPips(employeeId: string) {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_improvement_plans")
    .select("id, status")
    .eq("employee_id", employeeId)
    .in("status", ["active", "failed"]);

  if (error) return { error } as const;
  return { pips: data ?? [] } as const;
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
  const isOwnAppraisal =
    !!user.employeeId && appraisal.employee_id === user.employeeId;

  if (!isAdmin && !isOwnAppraisal) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "You don't have permission to update this appraisal."
    );
  }

  // Self-appraisal is checked BEFORE the admin manager-review branch so that
  // admin privilege can never turn into self-manager privilege.
  if (isOwnAppraisal) {
    const reviewerFields = [
      "manager_dimension_scores",
      "manager_rating",
      "final_score",
      "goal_scores",
      "status",
      "reviewer_hr_admin_id",
      "performance_rating",
      "letter_grade",
      "comments",
      "strengths",
      "improvements",
    ];
    const hasReviewerFields = reviewerFields.some(
      (field) => body[field] !== undefined && body[field] !== null
    );

    if (hasReviewerFields) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "You cannot review or finalize your own appraisal."
      );
    }

    const hasSelfRating =
      body.self_rating !== undefined && body.self_rating !== null;

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasSelfRating) {
      if (appraisal.status === "finalized") {
        return errorResponse(
          ERROR_CODES.FORBIDDEN,
          "Finalized appraisals cannot be modified."
        );
      }
      payload.self_rating = body.self_rating;
    }

    if (!hasSelfRating && !body.acknowledge) {
      return validationResponse([
        { field: "acknowledge", message: "acknowledge must be true" },
      ]);
    }

    // acknowledged_at column does not exist on hr3_performance_appraisals;
    // a future schema migration should add it. For now, simply bump
    // updated_at as a no-op acknowledgement marker.
    const { data, error } = await supabaseAdmin
      .from("hr3_performance_appraisals")
      .update(payload)
      .eq("id", appraisal.id)
      .select();

    if (error) {
      return internalError(error);
    }

    return NextResponse.json({ appraisal: data?.[0] });
  }

  // Reaching this point means the actor is an HR Admin editing an appraisal
  // that belongs to another employee. The employee/appraisee is the only one
  // allowed to set or change their own self_rating, so an HR Admin/reviewer
  // must never persist a self_rating change. Field-level check: only reject
  // when a self_rating is actually being submitted, so a manager-review
  // request that happens to carry a stale self_rating is rejected (not
  // silently rewritten) rather than blocking unrelated review fields.
  const hasSelfRating =
    body.self_rating !== undefined && body.self_rating !== null;
  if (hasSelfRating) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "You cannot edit the employee's self rating."
    );
  }

  // The HR Admin may only manager-review
  // (mark reviewed / finalize) an appraisal for which they are the assigned
  // reviewer. reviewer_hr_admin_id stores hr_admin.id == user.userId (the
  // auth-user UUID), never the employee's id or employee_id_number.
  const isAssignedReviewer = appraisal.reviewer_hr_admin_id === user.userId;

  if (
    appraisal.reviewer_hr_admin_id !== null &&
    appraisal.reviewer_hr_admin_id !== undefined &&
    !isAssignedReviewer
  ) {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "You are not the assigned reviewer for this appraisal."
    );
  }

  if (appraisal.status === "finalized") {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      "Finalized appraisals cannot be modified."
    );
  }

  // Status-transition enforcement: draft → reviewed → finalized. The current
  // persisted status is the source of truth. When a status is submitted we
  // only allow the transitions from APPRAISAL_ALLOWED_TRANSITIONS; any other
  // requested transition is rejected rather than silently rewritten, so a
  // client cannot bypass the workflow by jumping intermediate states.
  const requestedStatus = body.status;
  if (requestedStatus !== undefined && requestedStatus !== null) {
    const currentStatus = String(appraisal.status);
    const requested = String(requestedStatus);
    const allowed = APPRAISAL_ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(requested)) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        `Invalid appraisal status transition: ${currentStatus} → ${requested}.`
      );
    }
  }

  // Server-side finalization gates (reviewed → finalized). These run BEFORE
  // any database mutation. All sources are the persisted appraisal row or the
  // existing PIP resource — no migrated columns and no scoring changes.
  if (body.status === "finalized") {
    // Gate 1: the appraisal must have an assigned HR Admin reviewer.
    if (
      appraisal.reviewer_hr_admin_id === null ||
      appraisal.reviewer_hr_admin_id === undefined
    ) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "Cannot finalize: no HR Admin reviewer is assigned to this appraisal."
      );
    }

    // Gate 2: the employee must have completed their self rating (persisted).
    if (
      appraisal.self_rating === null ||
      appraisal.self_rating === undefined
    ) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "Cannot finalize: the employee has not submitted their self rating."
      );
    }

    // Gate 3: the manager/reviewer portion must be complete. The reviewer may
    // persist manager_rating in this same request (via manager_dimension_scores
    // or body.manager_rating) or it may already be persisted from the earlier
    // Mark Reviewed step, so we accept either the persisted value or the value
    // this request will persist. Individual dimension scores are intentionally
    // not validated because they are not persisted.
    const persistedManagerRating =
      appraisal.manager_rating !== null &&
      appraisal.manager_rating !== undefined;
    const willSetManagerRating =
      (Array.isArray(body.manager_dimension_scores) &&
        body.manager_dimension_scores.length > 0) ||
      (body.manager_rating !== undefined && body.manager_rating !== null);

    if (!persistedManagerRating && !willSetManagerRating) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "Cannot finalize: the manager rating has not been completed."
      );
    }

    // Gate 4: no active or failed PIP for the appraisal employee.
    const pips = await loadOpenPips(appraisal.employee_id as string);
    if ("error" in pips) {
      return internalError(pips.error);
    }
    if (pips.pips.length > 0) {
      return errorResponse(
        ERROR_CODES.FORBIDDEN,
        "Cannot finalize: the employee has an open performance improvement plan."
      );
    }
  }

  // NOTE: hr3_performance_appraisals does NOT have columns for
  // manager_dimension_scores / goal_scores / strengths / improvements /
  // acknowledged_at. Sending them in the PATCH payload causes PostgREST to
  // reject the whole update with PGRST204. We therefore only persist the
  // columns that actually exist on the table.
  const managerDimensionScores = Array.isArray(body.manager_dimension_scores)
    ? body.manager_dimension_scores
    : [];

  const managerAverage: number | undefined =
    managerDimensionScores.length > 0
      ? Math.round(
          (managerDimensionScores.reduce(
            (sum: number, d: { score: number }) => sum + d.score,
            0
          ) /
            managerDimensionScores.length) *
            10
        ) / 10
      : (body.manager_rating as number | undefined);

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined && body.status !== null) {
    payload.status = body.status;
  }
  if (body.comments !== undefined && body.comments !== null) {
    payload.comments = body.comments;
  }
  if (body.self_rating !== undefined && body.self_rating !== null) {
    payload.self_rating = body.self_rating;
  }
  if (body.reviewer_hr_admin_id) {
    payload.reviewer_hr_admin_id = body.reviewer_hr_admin_id;
  }
  // performance_rating / letter_grade columns are numeric in the DB; the UI
  // currently submits text labels (e.g. "S", "B"). Only persist numeric
  // values to avoid 22P02 invalid input syntax for type numeric errors.
  if (
    body.performance_rating !== undefined &&
    body.performance_rating !== null &&
    typeof body.performance_rating === "number"
  ) {
    payload.performance_rating = body.performance_rating;
  }
  if (
    body.letter_grade !== undefined &&
    body.letter_grade !== null &&
    typeof body.letter_grade === "number"
  ) {
    payload.letter_grade = body.letter_grade;
  }

  // Persist the manager rating (summary of dimension scores) which IS a
  // real column. manager_dimension_scores itself is not a column, so it is
  // intentionally not written.
  if (managerAverage !== undefined) {
    payload.manager_rating = managerAverage;
  }

  if (body.status === "finalized") {
    payload.final_score = managerAverage ?? (body.final_score as number | undefined);
    payload.finalized_at = new Date().toISOString();
  }

  // Note: acknowledged_at is handled in the self-appraisal branch above. The
  // admin branch intentionally does not write it (column does not exist).

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
