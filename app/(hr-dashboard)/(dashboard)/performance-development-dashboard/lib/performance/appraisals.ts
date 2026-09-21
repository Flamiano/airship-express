import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { selectAll, chunkedIn } from "@/performance-development-dashboard/lib/performance/serverUtils";
import {
  assertEmployeeOwnsRecord,
  assertHrAdminScope,
  resolveManagerDirectReportUuids,
} from "@/performance-development-dashboard/lib/auth/access";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import {
  requireHrEmployee,
  isPerDevHrAdminRole,
  type AuthenticatedHrEmployee,
} from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromIdentity,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  BAD_REQUEST_RESPONSE,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  createNotifications,
  type CreatePerDevNotificationInput,
} from "@/performance-development-dashboard/lib/performance/notifications";
import {
  MAX_APPRAISAL_TEXT_LENGTH,
  MAX_REVIEW_PERIOD_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  calculateScoring,
  isScoreRating,
  roundScore,
  SCORING_RATING_MAX,
  SCORING_RATING_MIN,
} from "@/performance-development-dashboard/lib/performance/scoring";
import {
  performanceRatingBandFromRank,
  type AppraisalCompetencyResult,
  type AppraisalGoalResult,
  type AppraisalScoringInputs,
  type AppraisalStatus,
  type PerformanceAppraisal,
} from "@/performance-development-dashboard/types";

/**
 * Appraisal / Evaluation domain (foundation + scoring).
 *
 * A PerDev appraisal is a FORMAL, staged evaluation — deliberately distinct
 * from Check-ins, which are ongoing informal feedback. It reuses the existing
 * live table `hr3_performance_appraisals`.
 *
 * WORKFLOW (state-controlled via the existing `status` column):
 *
 *   draft ──► self_assessment ──► manager_assessment ──► finalized ──► acknowledged
 *
 * The live `status` column is an unconstrained varchar (verified live: default
 * 'draft'; an inherited legacy row stores 'reviewed'). The status values above
 * are a server-defined vocabulary, and every transition is enforced by the
 * server with a guarded update (`.eq("status", expectedFrom)`) so the client
 * can never skip stages, move backwards, reopen finalized/acknowledged records,
 * or inject an arbitrary status.
 *
 * LEGACY / UNKNOWN STATUSES
 *   Records whose `status` is not in the vocabulary (e.g. the inherited row
 *   with status 'reviewed') are readable but have NO allowed transitions: they
 *   cannot be modified through this foundation.
 *
 * SCORING (approved rules, computed ONCE during finalization)
 *   - Final Score = (Goal Score × 0.60) + (Competency Score × 0.40).
 *   - Goal Score = Σ(goal rating × goal weight), weights must total 100%.
 *   - Competency Score = average of the applicable appraisal competency
 *     ratings (equal weights).
 *   - Final Performance Rating = the single approved band resolved from the
 *     unrounded final score; persisted as the band rank (1..5) in
 *     `performance_rating`. `letter_grade` is NEVER populated.
 *   - Scoring inputs (goal + competency ratings) are required at finalization,
 *     stored in the appointment result tables, and are NOT recomputed on later
 *     reads of an already-finalized record.
 *   - `self_rating` never contributes mathematically to any score.
 *
 * IDENTITY MODEL (as the live schema provides):
 *
 *   employee_id           subject employee (hr1_employees.id)
 *   reviewer_id           reviewer's linked employee identity
 *   reviewer_hr_admin_id  reviewer HR account (hr_admin.id)
 *
 * `reviewer_id` alone never identifies the actual account; the account is
 * `reviewer_hr_admin_id`, resolved through the shared actor chain. Protected
 * operations derive every identity server-side from the authenticated session;
 * the client can never set `reviewer_id`, `reviewer_hr_admin_id`, `status`,
 * or the actor.
 *
 * MANAGER AUTHORIZATION SEAM
 *   Manager Assessment is authorized by the EXACT evaluator relationship
 *   recorded on the appraisal: `evaluator_id === authenticated employeeUuid`.
 *   If that relationship does not match, it is a 403. The HR Admin process
 *   administrator cannot submit the manager assessment. Only the assigned
 *   evaluator/manager can.
 *
 *   Finalization is authorized by the HR Admin reviewer relationship:
 *   `reviewer_hr_admin_id === authenticated hrAdminId` AND
 *   `reviewer_id === authenticated employeeUuid`. The Manager cannot finalize.
 *
 * SELF-ASSESSMENT FIELDS USED
 *   `strengths`, `improvements` (narrative, server DOMAIN length-capped). The
 *   `comments` field is reserved for the reviewer's evaluation narrative.
 */

export {
  MAX_REVIEW_PERIOD_LENGTH,
  MAX_APPRAISAL_TEXT_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

const APPRAISAL_SELECT =
  "id, employee_id, reviewer_id, review_period, status, comments, strengths, improvements, created_at, updated_at, finalized_at, acknowledged_at, reviewer_hr_admin_id, cycle_id, final_score, performance_rating, evaluator_id, applicable_goal_ids_snapshot, applicable_competency_ids_snapshot";

const GOAL_RESULT_SELECT = "id, appraisal_id, goal_id, rating, created_at";
const COMPETENCY_RESULT_SELECT =
  "id, appraisal_id, competency_id, rating, created_at";

export type ListAppraisalsQuery = Record<string, unknown>;
export type CreateAppraisalInput = Record<string, unknown>;
export type SubmitSelfAssessmentInput = Record<string, unknown>;
export type SubmitManagerAssessmentInput = Record<string, unknown>;

/** Allowed one-step forward transitions. Off-map states have no transitions. */
export const APPRAISAL_TRANSITIONS: Partial<
  Record<AppraisalStatus, AppraisalStatus>
> = {
  draft: "self_assessment",
  self_assessment: "manager_assessment",
  manager_assessment: "finalized",
  finalized: "acknowledged",
};

const APPRAISAL_NOT_FOUND_RESPONSE = () =>
  NextResponse.json(
    { error: "Performance appraisal not found" },
    { status: 404 },
  );

/**
 * 403: authenticated but not authorized. Generic so record existence and
 * reviewer identity are never revealed (matches module conventions).
 */
const FORBIDDEN_RECORD_RESPONSE = () =>
  NextResponse.json(
    { error: "Forbidden - You do not have access to this record" },
    { status: 403 },
  );

const STATE_CONFLICT_RESPONSE = () =>
  NextResponse.json(
    {
      error:
        "Invalid state transition - the appraisal is not in the state required for this action.",
    },
    { status: 409 },
  );

/**
 * Rejects the operation if the appraisal belongs to a closed performance cycle.
 * Null cycle_id is intentionally allowed (legacy appraisals may lack a cycle).
 */
async function rejectIfClosedCycle(
  cycleId: string | null,
): Promise<NextResponse | null> {
  if (!cycleId) return null;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select("status")
    .eq("id", cycleId)
    .maybeSingle();

  if (error) {
    console.error("rejectIfClosedCycle: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate performance cycle" },
      { status: 500 },
    );
  }

  if (data?.status === "closed") {
    return BAD_REQUEST_RESPONSE(
      "Cannot modify an appraisal linked to a closed performance cycle.",
    );
  }

  return null;
}

function requireOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | NextResponse {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${maxLength} characters.`,
    );
  }
  return trimmed;
}

function requireReviewPeriod(value: unknown): string | NextResponse {
  const period = requireOptionalText(
    value,
    "review_period",
    MAX_REVIEW_PERIOD_LENGTH,
  );
  if (period instanceof NextResponse) return period;
  if (!period) {
    return BAD_REQUEST_RESPONSE(
      "review_period is required and must be a non-empty string.",
    );
  }
  return period;
}

/**
 * Validates an appraisal subject against `hr1_employees`.
 */
async function requireExistingEmployeeId(
  value: unknown,
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "employee_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingEmployeeId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate employee" },
      { status: 500 },
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "employee_id does not reference an existing employee.",
    );
  }

  return id;
}

/**
 * Validates an evaluator against `hr1_employees` and rejects inactive employees.
 * Used when reassigning evaluators to ensure the target is a valid, active employee.
 */
async function requireActiveEmployeeId(
  value: unknown,
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "evaluator_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireActiveEmployeeId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate employee" },
      { status: 500 },
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "evaluator_id does not reference an existing employee.",
    );
  }

  if (data.status && data.status !== "active") {
    return BAD_REQUEST_RESPONSE(
      "Cannot assign an inactive employee as evaluator.",
    );
  }

  return id;
}

/**
 * Resolves the evaluator (direct manager) for an employee from
 * `hr1_employees.manager_id`. Returns the manager's employee UUID, or NULL
 * if the employee has no manager. Server-side only — never from client input.
 */
async function resolveEvaluatorId(employeeId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("manager_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    console.error("resolveEvaluatorId: query error:", error);
    return null;
  }

  return data?.manager_id ?? null;
}

/**
 * Validates an optional appraisal cycle against `hr3_performance_cycles`,
 * anchoring appraisals into the cycle lifecycle without inventing columns.
 */
async function requireExistingCycleId(
  value: unknown,
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "cycle_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingCycleId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate performance cycle" },
      { status: 500 },
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "cycle_id does not reference an existing performance cycle.",
    );
  }

  if (data.status === "closed") {
    return BAD_REQUEST_RESPONSE(
      "Cannot create an appraisal for a closed performance cycle.",
    );
  }

  return id;
}

/**
 * Loads a single appraisal row with optional authorization constraints applied
 * INSIDE the query, so a record that does not exist and a record that exists
 * but falls outside the requester's scope resolve to the SAME not-found
 * response (no record-existence oracle).
 *
 * `constraints` are identity predicates derived server-side from the
 * authenticated actor (subject employee, reviewer account, reviewer employee).
 * They are never derived from the request body — a caller can only ever narrow
 * the load, never widen it.
 */
async function loadAppraisalScoped(
  appraisalId: string,
  constraints: {
    employee_id?: string;
    reviewer_hr_admin_id?: string | null;
    reviewer_id?: string;
  } = {},
): Promise<PerformanceAppraisal | NextResponse> {
  let query = supabaseAdmin
    .from("hr3_performance_appraisals")
    .select(APPRAISAL_SELECT)
    .eq("id", appraisalId);

  if (constraints.employee_id) {
    query = query.eq("employee_id", constraints.employee_id);
  }
  if (constraints.reviewer_hr_admin_id) {
    query = query.eq("reviewer_hr_admin_id", constraints.reviewer_hr_admin_id);
  }
  if (constraints.reviewer_id) {
    query = query.eq("reviewer_id", constraints.reviewer_id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("loadAppraisalScoped: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance appraisal" },
      { status: 500 },
    );
  }

  if (!data) return APPRAISAL_NOT_FOUND_RESPONSE();

  return data as PerformanceAppraisal;
}

/**
 * Loads a single appraisal row without caller-scope constraints, 404 if
 * missing, 500 on unexpected error. Used for already-authorized HR-admin-wide
 * reads and by flows that assert ownership after load.
 */
async function loadAppraisalOr404(
  appraisalId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  return loadAppraisalScoped(appraisalId);
}

/**
 * The formal ratings already stored for an appraisal in the two result tables.
 */
async function loadScoringResults(appraisalId: string): Promise<{
  goalResults: AppraisalGoalResult[];
  competencyResults: AppraisalCompetencyResult[];
}> {
  const [goalQuery, competencyQuery] = await Promise.all([
    supabaseAdmin
      .from("hr3_performance_appraisal_goal_results")
      .select(GOAL_RESULT_SELECT)
      .eq("appraisal_id", appraisalId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("hr3_performance_appraisal_competency_results")
      .select(COMPETENCY_RESULT_SELECT)
      .eq("appraisal_id", appraisalId)
      .order("created_at", { ascending: true }),
  ]);

  if (goalQuery.error) {
    console.error("loadScoringResults: goal results error:", goalQuery.error);
  }
  if (competencyQuery.error) {
    console.error(
      "loadScoringResults: competency results error:",
      competencyQuery.error,
    );
  }

  return {
    goalResults: (goalQuery.data ?? []) as AppraisalGoalResult[],
    competencyResults: (competencyQuery.data ??
      []) as AppraisalCompetencyResult[],
  };
}

type ApplicableGoalRow = {
  id: string;
  title: string;
  weight: number | null;
  status: string;
};

/**
 * The goals applicable to an appraisal: the subject employee's goals, scoped
 * to the appraisal cycle when one is set (`cycle_id`). These are the goals
 * that must all be rated and whose weights must total exactly 100%.
 */
async function loadApplicableGoals(
  employeeId: string,
  cycleId: string | null,
): Promise<ApplicableGoalRow[] | NextResponse> {
  let query = supabaseAdmin
    .from("hr3_performance_goals")
    .select("id, title, weight, status")
    .eq("employee_id", employeeId);
  if (cycleId) query = query.eq("cycle_id", cycleId);

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("loadApplicableGoals: query error:", error);
    return NextResponse.json(
      { error: "Failed to load appraisal goals for scoring" },
      { status: 500 },
    );
  }

  return (data ?? []) as ApplicableGoalRow[];
}

type ApplicableCompetencyRow = {
  competency_id: string;
  name: string;
  category: string;
  current_level: number | null;
};

/**
 * The competencies applicable to an appraisal:
 *
 *   - Primary source: the competencies required by the employee's job position
 *     (`hr1_employees.job_position_id` → `hr3_position_competency_requirements`).
 *   - Fallback: the competencies the employee has an operational score for
 *     (latest `hr3_employee_competency_scores` row per competency).
 *
 * The employee's operational record (`current_level`) is returned as
 * informational context only — it is NEVER used as the appraisal rating.
 */
async function loadApplicableCompetencies(
  employeeId: string,
): Promise<ApplicableCompetencyRow[] | NextResponse> {
  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, job_position_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "loadApplicableCompetencies: employee query error:",
      employeeError,
    );
    return NextResponse.json(
      { error: "Failed to load employee for appraisal scoring" },
      { status: 500 },
    );
  }

  const { data: scores, error: scoresError } = await supabaseAdmin
    .from("hr3_employee_competency_scores")
    .select("competency_id, current_level")
    .eq("employee_id", employeeId)
    .order("assessed_at", { ascending: true })
    .order("id", { ascending: true });

  if (scoresError) {
    console.error(
      "loadApplicableCompetencies: score query error:",
      scoresError,
    );
    return NextResponse.json(
      {
        error:
          "Failed to load employee competency scores for appraisal scoring",
      },
      { status: 500 },
    );
  }

  const currentLevelByCompetency = new Map<string, number>();
  for (const row of scores ?? []) {
    currentLevelByCompetency.set(row.competency_id, row.current_level);
  }

  let competencyIds: string[] = [];

  if (employee?.job_position_id) {
    const { data: requirements, error: requirementsError } = await supabaseAdmin
      .from("hr3_position_competency_requirements")
      .select("competency_id")
      .eq("position_id", employee.job_position_id);

    if (requirementsError) {
      console.error(
        "loadApplicableCompetencies: requirement query error:",
        requirementsError,
      );
      return NextResponse.json(
        {
          error:
            "Failed to load position competency requirements for appraisal scoring",
        },
        { status: 500 },
      );
    }

    competencyIds = (requirements ?? []).map((row) => row.competency_id);
  }

  if (competencyIds.length === 0) {
    competencyIds = [...currentLevelByCompetency.keys()];
  }

  if (competencyIds.length === 0) return [];

  const { data: competencies, error: competenciesError } = await supabaseAdmin
    .from("hr3_competencies")
    .select("id, name, category")
    .in("id", competencyIds);

  if (competenciesError) {
    console.error(
      "loadApplicableCompetencies: competency query error:",
      competenciesError,
    );
    return NextResponse.json(
      { error: "Failed to load competencies for appraisal scoring" },
      { status: 500 },
    );
  }

  return (competencies ?? [])
    .map((competency) => ({
      competency_id: competency.id,
      name: competency.name,
      category: competency.category,
      current_level: currentLevelByCompetency.get(competency.id) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parses and validates an array of `{ goal_id|competency_id, rating }` inputs.
 * Enforces the array shape, 1–5 integer ratings, and input-level uniqueness.
 */
function parseAppraisalRatings(
  value: unknown,
  idField: "goal_id" | "competency_id",
  label: string,
): { values: { id: string; rating: number }[] } | NextResponse {
  if (!Array.isArray(value)) {
    return BAD_REQUEST_RESPONSE(`${label} ratings must be an array.`);
  }

  const seen = new Set<string>();
  const values: { id: string; rating: number }[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return BAD_REQUEST_RESPONSE(
        `Each ${label} rating must be an object with ${idField} and rating.`,
      );
    }
    const row = item as Record<string, unknown>;
    const id = requireValidUuid(row[idField], idField);
    if (id instanceof NextResponse) return id;

    const rating = row["rating"];
    if (!isScoreRating(rating)) {
      return BAD_REQUEST_RESPONSE(
        `Each ${label} rating must be a whole number between ${SCORING_RATING_MIN} and ${SCORING_RATING_MAX}.`,
      );
    }

    if (seen.has(id)) {
      return BAD_REQUEST_RESPONSE(
        `Duplicate ${label} ratings are not allowed.`,
      );
    }
    seen.add(id);
    values.push({ id, rating });
  }

  return { values };
}

/**
 * Verifies the provided ratings cover EXACTLY the applicable appraisal set:
 * no extraneous entries and no missing entries. Returns null when valid.
 */
function requireExactRatingSet(
  provided: { id: string; rating: number }[],
  applicableIds: string[],
  label: string,
): NextResponse | null {
  const providedSet = new Set(provided.map((entry) => entry.id));
  const applicableSet = new Set(applicableIds);

  for (const entry of provided) {
    if (!applicableSet.has(entry.id)) {
      return BAD_REQUEST_RESPONSE(
        `An ${label} rating references an item that is not part of this appraisal's ${label} set.`,
      );
    }
  }

  for (const applicableId of applicableIds) {
    if (!providedSet.has(applicableId)) {
      return BAD_REQUEST_RESPONSE(
        `Every applicable ${label} requires a rating before finalizing.`,
      );
    }
  }

  return null;
}

/**
 * Attaches the stored scoring results and a precomputed band summary to an
 * appraisal response. No score is recomputed here — the official result is
 * frozen at finalization time.
 *
 * NOTE: This performs per-record queries (scoring results plus goal/competency
 * title lookups) and is intended for single-record reads only. If batch use is
 * ever needed, callers should batch the goal/competency title lookups
 * themselves, as `enrichAppraisalsWithReviewerAccount` already does.
 */
async function enrichAppraisalWithScoring(
  appraisal: PerformanceAppraisal,
): Promise<PerformanceAppraisal> {
  const results = await loadScoringResults(appraisal.id);

  const goalIds = results.goalResults.map((result) => result.goal_id);
  const competencyIds = results.competencyResults.map(
    (result) => result.competency_id,
  );

  const [goalsQuery, competenciesQuery] = await Promise.all([
    goalIds.length > 0
      ? supabaseAdmin
          .from("hr3_performance_goals")
          .select("id, title")
          .in("id", goalIds)
      : Promise.resolve({ data: [], error: null } as const),
    competencyIds.length > 0
      ? supabaseAdmin
          .from("hr3_competencies")
          .select("id, name")
          .in("id", competencyIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);

  const titleById = new Map(
    (goalsQuery.data ?? []).map((goal) => [goal.id, goal.title] as const),
  );
  const nameById = new Map(
    (competenciesQuery.data ?? []).map(
      (competency) => [competency.id, competency.name] as const,
    ),
  );

  const enriched: PerformanceAppraisal = {
    ...appraisal,
    goalResults: results.goalResults.map((result) => ({
      ...result,
      title: titleById.get(result.goal_id) ?? null,
    })),
    competencyResults: results.competencyResults.map((result) => ({
      ...result,
      name: nameById.get(result.competency_id) ?? null,
    })),
  };

  if (
    appraisal.final_score !== null &&
    appraisal.final_score !== undefined &&
    appraisal.performance_rating !== null &&
    appraisal.performance_rating !== undefined
  ) {
    const band = performanceRatingBandFromRank(appraisal.performance_rating);
    if (band) {
      enriched.scoreSummary = {
        final_score: appraisal.final_score,
        performance_rating: appraisal.performance_rating,
        band_key: band.key,
        band_label: band.label,
      };
    }
  }

  return enriched;
}

/**
 * Reviewer authorization boundary.
 *
 * The reviewer of an appraisal is the HR account recorded in
 * `reviewer_hr_admin_id` (with `reviewer_id` matching their linked employee).
 * This is the EXACT existing relationship on the record — nothing is inferred
 * from job titles, departments, or demo manager data. Only that reviewer may
 * record the manager assessment or finalize the appraisal (403 otherwise).
 *
 * Called AFTER the appraisal has already been loaded constrained to the
 * caller's reviewer identity; the field comparison here is a retained
 * defense-in-depth re-validation (it always passes for a scoped load).
 */
async function assertReviewerScope(
  existing: PerformanceAppraisal,
): Promise<AuthenticatedHrEmployee | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  if (
    !existing.reviewer_hr_admin_id ||
    existing.reviewer_hr_admin_id !== identity.hrAdminId ||
    existing.reviewer_id !== identity.employeeUuid
  ) {
    console.error(
      "assertReviewerScope: actor is not the reviewer recorded on this appraisal",
    );
    return FORBIDDEN_RECORD_RESPONSE();
  }

  return identity;
}

/**
 * Returns the scoped employee UUIDs for a manager: the manager themselves plus
 * all active direct reports (resolved server-side via `manager_id`).
 */
async function resolveManagerScopedEmployeeIds(
  managerEmployeeUuid: string,
): Promise<string[]> {
  const directReportIds =
    await resolveManagerDirectReportUuids(managerEmployeeUuid);
  return [managerEmployeeUuid, ...directReportIds];
}

/**
 * Batch-loads cycle names for the given appraisal rows. Only resolves cycle
 * IDs already present on the appraisals — no arbitrary cycle lookup is
 * performed. Returns a map of cycle ID → cycle name.
 */
async function resolveCycleNames(
  appraisals: PerformanceAppraisal[],
): Promise<Map<string, string>> {
  const cycleIds = [
    ...new Set(
      appraisals.map((a) => a.cycle_id).filter((id): id is string => !!id),
    ),
  ];

  if (cycleIds.length === 0) return new Map();

  const batches = await chunkedIn(cycleIds, 100, async (chunk) => {
    const { data, error } = await supabaseAdmin
      .from("hr3_performance_cycles")
      .select("id, name")
      .in("id", chunk);
    if (error) {
      console.error("resolveCycleNames: query error:", error);
      return [];
    }
    return data ?? [];
  });

  const nameById = new Map<string, string>();
  for (const cycle of batches.flat()) {
    if (cycle.id && cycle.name) nameById.set(cycle.id, cycle.name);
  }
  return nameById;
}

/**
 * Attaches `cycleName` to each appraisal from the provided cycle name map.
 * Non-null `cycle_id` values that cannot be resolved produce `cycleName: null`.
 */
function attachCycleNames(
  appraisals: PerformanceAppraisal[],
  cycleNames: Map<string, string>,
): PerformanceAppraisal[] {
  return appraisals.map((appraisal) => ({
    ...appraisal,
    cycleName: appraisal.cycle_id
      ? (cycleNames.get(appraisal.cycle_id) ?? null)
      : null,
  }));
}

/**
 * HR Admin reviewer check: the current user is the exact reviewer recorded
 * on the appraisal (reviewer_hr_admin_id + reviewer_id).
 */
function isCurrentUserHrReviewer(
  appraisal: PerformanceAppraisal,
  admin: { hrAdminId: string | null; employeeUuid: string | null },
): boolean {
  return (
    appraisal.reviewer_hr_admin_id === admin.hrAdminId &&
    appraisal.reviewer_id === admin.employeeUuid
  );
}

/**
 * Evaluator check: the current user is the assigned evaluator for this
 * appraisal (evaluator_id matches employeeUuid).
 */
function isCurrentUserEvaluator(
  appraisal: PerformanceAppraisal,
  identity: { employeeUuid: string | null },
): boolean {
  return (
    !!appraisal.evaluator_id &&
    !!identity.employeeUuid &&
    appraisal.evaluator_id === identity.employeeUuid
  );
}

/**
 * Guarded, state-controlled transition.
 *
 * Executes the UPDATE guarded by `.eq("status", expectedFrom)` so the row can
 * only transition from the exact expected state. Verified live: a zero-row
 * guarded update resolves with `data: null` and NO error (not PGRST116, which
 * only surfaces on multi-row `.maybeSingle()`), so a missing row — i.e.
 * somebody already moved the record — falls through to → 409. That 409 also
 * blocks skipping stages, going backwards, and reopening finalized or
 * acknowledged appraisals, because every guard compares against the exact
 * expected prior status.
 *
 * Mutation first, audit second (the existing PerDev pattern).
 */
async function transitionAppraisal(options: {
  id: string;
  expectedFrom: AppraisalStatus;
  nextTo: AppraisalStatus;
  updates: Record<string, unknown>;
  actor: AuthenticatedHrEmployee;
  reason: (typeof PERFORMANCE_AUDIT_REASON)[keyof typeof PERFORMANCE_AUDIT_REASON];
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
}): Promise<PerformanceAppraisal | NextResponse> {
  const payload: Record<string, unknown> = {
    ...options.updates,
    status: options.nextTo,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .update(payload)
    .eq("id", options.id)
    .eq("status", options.expectedFrom)
    .select(APPRAISAL_SELECT)
    .maybeSingle();

  if (!error && data) {
    const updated = data as PerformanceAppraisal;

    const auditError = await insertAuditEvent({
      actor: auditActorFromIdentity(options.actor),
      reason: options.reason,
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.appraisal,
      entityId: updated.id,
      oldData: options.oldData,
      newData: options.newData,
    });
    if (auditError instanceof NextResponse) return auditError;

    return updated;
  }

  if (error && error.code !== "PGRST116") {
    console.error("transitionAppraisal: update error:", error);
    return NextResponse.json(
      { error: "Failed to update performance appraisal" },
      { status: 500 },
    );
  }

  console.error(
    "transitionAppraisal: appraisal is not in the expected state:",
    options.id,
  );
  return STATE_CONFLICT_RESPONSE();
}

/**
 * Resolves `reviewerByAccountName` from the `reviewer_hr_admin_id` column on
 * each appraisal.  This is the ONLY authoritative source for the HR Admin
 * reviewer identity — audit events record who *performed* an action, not who
 * is the *assigned* reviewer for the appraisal.
 *
 * HR-ADMIN-ONLY: this is intentionally called only on the HR admin response
 * branch.  Manager and Employee branches skip this enrichment entirely, so
 * those actors never receive HR Admin account attribution.
 *
 * READ-ONLY: this only SELECTs from `hr_admin` for name resolution.  It does
 * NOT create, change, or re-attribute audit events.
 *
 * @param appraisals HR-scope rows that will be returned to an authenticated
 *   HR admin (batched hr_admin lookup).
 */
async function enrichAppraisalsWithReviewerAccount(
  appraisals: PerformanceAppraisal[],
): Promise<PerformanceAppraisal[]> {
  if (appraisals.length === 0) return appraisals;

  const hrAdminIds = [
    ...new Set(
      appraisals
        .map((a) => a.reviewer_hr_admin_id)
        .filter((id): id is string => !!id),
    ),
  ];

  if (hrAdminIds.length === 0) {
    return appraisals.map((a) => ({ ...a, reviewerByAccountName: null }));
  }

  const nameById = await resolveHrAdminNames(hrAdminIds);

  return appraisals.map((appraisal) => ({
    ...appraisal,
    reviewerByAccountName:
      appraisal.reviewer_hr_admin_id && nameById[appraisal.reviewer_hr_admin_id]
        ? nameById[appraisal.reviewer_hr_admin_id]
        : null,
  }));
}

/**
 * Directly resolves `reviewer_hr_admin_id` from the `hr_admin` table for
 * appraisals where the audit-based enrichment failed to produce a name.
 * This is a targeted batch query that only fires when there are unresolved
 * appraisals, keeping the happy-path fast.
 */
async function enrichUnresolvedReviewersFromHrAdmin(
  appraisals: PerformanceAppraisal[],
): Promise<PerformanceAppraisal[]> {
  const unresolved = appraisals.filter(
    (a) => !a.reviewerByAccountName && a.reviewer_hr_admin_id,
  );
  if (unresolved.length === 0) return appraisals;

  const hrAdminIds = [
    ...new Set(unresolved.map((a) => a.reviewer_hr_admin_id!)),
  ];

  const batches = await chunkedIn(hrAdminIds, 100, async (chunk) => {
    const { data, error } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", chunk);
    if (error) {
      console.error("enrichUnresolvedReviewersFromHrAdmin: query error:", error);
      return [];
    }
    return data ?? [];
  });

  const nameById: Record<string, string> = {};
  for (const account of batches.flat()) {
    if (account.id && account.full_name)
      nameById[account.id] = account.full_name;
  }

  return appraisals.map((appraisal) => {
    if (appraisal.reviewerByAccountName) return appraisal;
    const fallbackName =
      appraisal.reviewer_hr_admin_id && nameById[appraisal.reviewer_hr_admin_id]
        ? nameById[appraisal.reviewer_hr_admin_id]
        : null;
    return { ...appraisal, reviewerByAccountName: fallbackName };
  });
}

/**
 * Batch HR-admin account display-name resolution from `hr_admin` table.
 */
async function resolveHrAdminNames(
  hrAdminIds: string[],
): Promise<Record<string, string>> {
  if (hrAdminIds.length === 0) return {};
  const batches = await chunkedIn(hrAdminIds, 100, async (chunk) => {
    const { data, error } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", chunk);
    if (error) {
      console.error("resolveHrAdminNames: query error:", error);
      return [];
    }
    return data ?? [];
  });
  const names: Record<string, string> = {};
  for (const account of batches.flat()) {
    if (account.id && account.full_name) names[account.id] = account.full_name;
  }
  return names;
}

/**
 * Lists appraisals within authorized scope.
 *
 * Role-aware:
 * - HR admin scope: all appraisals, optional validated `employee_id` filter.
 *   Each row is enriched with `currentUserIsReviewer` so HR UI can gate
 *   reviewer-only affordances.
 * - Manager scope: appraisals for the manager themselves and their active
 *   direct reports (resolved server-side via `manager_id`).
 * - Employee scope: only their OWN appraisals (`employee_id = me`).
 */
export async function listAppraisals(
  input: ListAppraisalsQuery,
): Promise<PerformanceAppraisal[] | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  // HR admin scope: org-wide
  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    const identity = await requireHrEmployee();
    if (identity instanceof NextResponse) return identity;

    let query = supabaseAdmin
      .from("hr3_performance_appraisals")
      .select(APPRAISAL_SELECT);

    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = requireValidUuid(input.employee_id, "employee_id");
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await selectAll(
      query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    ).then((rows) => ({ data: rows, error: null }));

    if (error) {
      console.error("listAppraisals: query error:", error);
      return NextResponse.json(
        { error: "Failed to load performance appraisals" },
        { status: 500 },
      );
    }
    const rows = (data ?? []) as PerformanceAppraisal[];

    const enriched = await enrichAppraisalsWithReviewerAccount(rows);
    const fullyResolved = await enrichUnresolvedReviewersFromHrAdmin(enriched);

    return fullyResolved.map((appraisal) => ({
      ...appraisal,
      currentUserIsHrReviewer: isCurrentUserHrReviewer(appraisal, identity),
      currentUserIsEvaluator: isCurrentUserEvaluator(appraisal, identity),
    }));
  }

  // HR admin with a non-PerDev role: reject, do not fall through to
  // employee/manager logic.
  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  // Manager or Employee: require employee identity
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  // Manager scope: self + active direct reports, plus any appraisal where
  // the manager is the assigned evaluator (even if the subject is not a
  // direct report).
  if (identity.accountType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(
      identity.employeeUuid,
    );

    const scopedList = scopedIds.map((id) => `"${id}"`).join(",");
    let query = supabaseAdmin
      .from("hr3_performance_appraisals")
      .select(APPRAISAL_SELECT)
      .or(
        `employee_id.in.(${scopedList}),evaluator_id.eq.${identity.employeeUuid}`,
      );

    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = requireValidUuid(input.employee_id, "employee_id");
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("listAppraisals: manager query error:", error);
      return NextResponse.json(
        { error: "Failed to load performance appraisals" },
        { status: 500 },
      );
    }

    const managerRows = (data ?? []) as PerformanceAppraisal[];
    const cycleNames = await resolveCycleNames(managerRows);
    return attachCycleNames(managerRows, cycleNames).map((appraisal) => ({
      ...appraisal,
      currentUserIsHrReviewer: isCurrentUserHrReviewer(appraisal, identity),
      currentUserIsEvaluator: isCurrentUserEvaluator(appraisal, identity),
    }));
  }

  // Employee scope: own appraisals, plus any appraisal where the employee
  // is the assigned evaluator.
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select(APPRAISAL_SELECT)
    .or(
      `employee_id.eq.${identity.employeeUuid},evaluator_id.eq.${identity.employeeUuid}`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listAppraisals: employee query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance appraisals" },
      { status: 500 },
    );
  }

  const employeeRows = (data ?? []) as PerformanceAppraisal[];
  const cycleNames = await resolveCycleNames(employeeRows);
  return attachCycleNames(employeeRows, cycleNames).map((appraisal) => ({
    ...appraisal,
    currentUserIsHrReviewer: isCurrentUserHrReviewer(appraisal, identity),
    currentUserIsEvaluator: isCurrentUserEvaluator(appraisal, identity),
  }));
}

/**
 * Retrieves a single appraisal within authorized scope.
 *
 * - HR admin scope may read any appraisal (enriched with
 *   `currentUserIsReviewer`). A non-existent record returns 404.
 * - Manager scope may read appraisals for themselves and their active direct
 *   reports (resolved server-side via `manager_id`).
 * - Employee scope: the owning employee's UUID is asserted FIRST and applied
 *   as an equality constraint inside the load, so "does not exist" and "not
 *   your appraisal" are indistinguishable (both 404). Only their own appraisal
 *   is ever read.
 *
 * Single-record reads attach the stored scoring results (`goalResults`,
 * `competencyResults`) and, for finalized records, the precomputed
 * `scoreSummary`.
 */
export async function getAppraisal(
  appraisalId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  // HR admin scope: may read any appraisal
  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    const identity = await requireHrEmployee();
    if (identity instanceof NextResponse) return identity;

    const existing = await loadAppraisalOr404(id);
    if (existing instanceof NextResponse) return existing;

    const enriched = await enrichAppraisalWithScoring(existing);

    const [enrichedWithReviewer] = await enrichAppraisalsWithReviewerAccount([
      enriched,
    ]);
    const [fullyResolved] = await enrichUnresolvedReviewersFromHrAdmin([
      enrichedWithReviewer,
    ]);

    return {
      ...fullyResolved,
      currentUserIsHrReviewer: isCurrentUserHrReviewer(existing, identity),
      currentUserIsEvaluator: isCurrentUserEvaluator(existing, identity),
    };
  }

  // HR admin with a non-PerDev role: reject, do not fall through to
  // employee/manager logic.
  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  // Manager or Employee: require employee identity
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  // Manager scope: self + active direct reports, plus any appraisal where
  // the manager is the assigned evaluator.
  if (identity.accountType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(
      identity.employeeUuid,
    );

    const existing = await loadAppraisalOr404(id);
    if (existing instanceof NextResponse) return existing;

    const isInScope = scopedIds.includes(existing.employee_id);
    const isEvaluator = isCurrentUserEvaluator(existing, identity);

    if (!isInScope && !isEvaluator) {
      return APPRAISAL_NOT_FOUND_RESPONSE();
    }

    const withScoring = await enrichAppraisalWithScoring(existing);

    return {
      ...withScoring,
      currentUserIsHrReviewer: isCurrentUserHrReviewer(existing, identity),
      currentUserIsEvaluator: isCurrentUserEvaluator(existing, identity),
    };
  }

  // Employee scope: own appraisal, plus any appraisal where the employee
  // is the assigned evaluator.
  const existing = await loadAppraisalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const isOwner = existing.employee_id === identity.employeeUuid;
  const isEvaluator = isCurrentUserEvaluator(existing, identity);

  if (!isOwner && !isEvaluator) {
    return APPRAISAL_NOT_FOUND_RESPONSE();
  }

  const withScoring = await enrichAppraisalWithScoring(existing);

  return {
    ...withScoring,
    currentUserIsHrReviewer: isCurrentUserHrReviewer(existing, identity),
    currentUserIsEvaluator: isCurrentUserEvaluator(existing, identity),
  };
}

/**
 * Returns the scoring inventory a reviewer needs to fill in before
 * finalization: the applicable goals (with weights), the applicable
 * competencies, and any ratings already persisted for this appraisal.
 *
 * Authorized for: the HR Admin reviewer OR the assigned evaluator.
 */
export async function getAppraisalScoringInputs(
  appraisalId: string,
): Promise<AppraisalScoringInputs | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  // Evaluator scope: authorized by persisted evaluator_id assignment.
  // Works for any employee type (manager or plain employee).
  // HR admins with a non-PerDev role are also rejected here (evaluator_id
  // check will fail) rather than falling through to the HR admin path.
  if (actor.actorType !== "hr_admin" || !isPerDevHrAdminRole(actor.role)) {
    const employee = await requireHrEmployee();
    if (employee instanceof NextResponse) return employee;

    const existing = await loadAppraisalOr404(id);
    if (existing instanceof NextResponse) return existing;

    // Authorization: actor must be the assigned evaluator
    if (
      !existing.evaluator_id ||
      existing.evaluator_id !== employee.employeeUuid
    ) {
      return FORBIDDEN_RECORD_RESPONSE();
    }

    // Use snapshot when available (submitted appraisal); fall back to live.
    const evaluatorUseSnapshot =
      existing.applicable_goal_ids_snapshot !== null &&
      existing.applicable_competency_ids_snapshot !== null;

    let goals: ApplicableGoalRow[];
    let competencies: ApplicableCompetencyRow[];

    if (evaluatorUseSnapshot) {
      const { data: goalRows, error: goalRowsError } = await supabaseAdmin
        .from("hr3_performance_goals")
        .select("id, title, weight, status")
        .in("id", existing.applicable_goal_ids_snapshot!);

      if (goalRowsError) {
        console.error(
          "getAppraisalScoringInputs: snapshot goal query error:",
          goalRowsError,
        );
        return NextResponse.json(
          { error: "Failed to load appraisal goals for scoring" },
          { status: 500 },
        );
      }
      goals = (goalRows ?? []) as ApplicableGoalRow[];

      const { data: compRows, error: compRowsError } = await supabaseAdmin
        .from("hr3_competencies")
        .select("id, name, category")
        .in("id", existing.applicable_competency_ids_snapshot!);

      if (compRowsError) {
        console.error(
          "getAppraisalScoringInputs: snapshot competency query error:",
          compRowsError,
        );
        return NextResponse.json(
          { error: "Failed to load competencies for appraisal scoring" },
          { status: 500 },
        );
      }

      const { data: scores, error: scoresError } = await supabaseAdmin
        .from("hr3_employee_competency_scores")
        .select("competency_id, current_level")
        .eq("employee_id", existing.employee_id)
        .in("competency_id", existing.applicable_competency_ids_snapshot!);

      if (scoresError) {
        console.error(
          "getAppraisalScoringInputs: snapshot competency score query error:",
          scoresError,
        );
        return NextResponse.json(
          { error: "Failed to load employee competency scores for appraisal scoring" },
          { status: 500 },
        );
      }

      const currentLevelByCompetency = new Map<string, number>();
      for (const row of scores ?? []) {
        currentLevelByCompetency.set(row.competency_id, row.current_level);
      }

      competencies = (compRows ?? [])
        .map((c) => ({
          competency_id: c.id,
          name: c.name,
          category: c.category,
          current_level: currentLevelByCompetency.get(c.id) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const g = await loadApplicableGoals(existing.employee_id, existing.cycle_id);
      if (g instanceof NextResponse) return g;
      goals = g;

      const c = await loadApplicableCompetencies(existing.employee_id);
      if (c instanceof NextResponse) return c;
      competencies = c;
    }

    const results = await loadScoringResults(id);

    const weightTotal = goals.reduce(
      (sum, goal) => sum + (typeof goal.weight === "number" ? goal.weight : 0),
      0,
    );

    return {
      appraisal_id: id,
      goals: goals.map((goal) => ({
        goal_id: goal.id,
        title: goal.title,
        weight: goal.weight,
        status:
          goal.status as AppraisalScoringInputs["goals"][number]["status"],
      })),
      weight_total: weightTotal,
      competencies: competencies.map((competency) => ({
        competency_id: competency.competency_id,
        name: competency.name,
        category:
          competency.category as AppraisalScoringInputs["competencies"][number]["category"],
        current_level: competency.current_level,
      })),
      existing_goal_ratings: results.goalResults.map((result) => ({
        goal_id: result.goal_id,
        rating: result.rating,
      })),
      existing_competency_ratings: results.competencyResults.map((result) => ({
        competency_id: result.competency_id,
        rating: result.rating,
      })),
    };
  }

  // HR Admin reviewer path
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const existing = await loadAppraisalScoped(id, {
    reviewer_hr_admin_id: identity.hrAdminId,
    reviewer_id: identity.employeeUuid,
  });
  if (existing instanceof NextResponse) return existing;

  const reviewer = await assertReviewerScope(existing);
  if (reviewer instanceof NextResponse) return reviewer;

  // Use snapshot when available (submitted appraisal); fall back to live.
  const hrUseSnapshot =
    existing.applicable_goal_ids_snapshot !== null &&
    existing.applicable_competency_ids_snapshot !== null;

  let goals: ApplicableGoalRow[];
  let competencies: ApplicableCompetencyRow[];

  if (hrUseSnapshot) {
    const { data: goalRows, error: goalRowsError } = await supabaseAdmin
      .from("hr3_performance_goals")
      .select("id, title, weight, status")
      .in("id", existing.applicable_goal_ids_snapshot!);

    if (goalRowsError) {
      console.error(
        "getAppraisalScoringInputs: hr snapshot goal query error:",
        goalRowsError,
      );
      return NextResponse.json(
        { error: "Failed to load appraisal goals for scoring" },
        { status: 500 },
      );
    }
    goals = (goalRows ?? []) as ApplicableGoalRow[];

    const { data: compRows, error: compRowsError } = await supabaseAdmin
      .from("hr3_competencies")
      .select("id, name, category")
      .in("id", existing.applicable_competency_ids_snapshot!);

    if (compRowsError) {
      console.error(
        "getAppraisalScoringInputs: hr snapshot competency query error:",
        compRowsError,
      );
      return NextResponse.json(
        { error: "Failed to load competencies for appraisal scoring" },
        { status: 500 },
      );
    }

    const { data: scores, error: scoresError } = await supabaseAdmin
      .from("hr3_employee_competency_scores")
      .select("competency_id, current_level")
      .eq("employee_id", existing.employee_id)
      .in("competency_id", existing.applicable_competency_ids_snapshot!);

    if (scoresError) {
      console.error(
        "getAppraisalScoringInputs: hr snapshot competency score query error:",
        scoresError,
      );
      return NextResponse.json(
        { error: "Failed to load employee competency scores for appraisal scoring" },
        { status: 500 },
      );
    }

    const currentLevelByCompetency = new Map<string, number>();
    for (const row of scores ?? []) {
      currentLevelByCompetency.set(row.competency_id, row.current_level);
    }

    competencies = (compRows ?? [])
      .map((c) => ({
        competency_id: c.id,
        name: c.name,
        category: c.category,
        current_level: currentLevelByCompetency.get(c.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const g = await loadApplicableGoals(existing.employee_id, existing.cycle_id);
    if (g instanceof NextResponse) return g;
    goals = g;

    const c = await loadApplicableCompetencies(existing.employee_id);
    if (c instanceof NextResponse) return c;
    competencies = c;
  }

  const results = await loadScoringResults(id);

  const weightTotal = goals.reduce(
    (sum, goal) => sum + (typeof goal.weight === "number" ? goal.weight : 0),
    0,
  );

  return {
    appraisal_id: id,
    goals: goals.map((goal) => ({
      goal_id: goal.id,
      title: goal.title,
      weight: goal.weight,
      status: goal.status as AppraisalScoringInputs["goals"][number]["status"],
    })),
    weight_total: weightTotal,
    competencies: competencies.map((competency) => ({
      competency_id: competency.competency_id,
      name: competency.name,
      category:
        competency.category as AppraisalScoringInputs["competencies"][number]["category"],
      current_level: competency.current_level,
    })),
    existing_goal_ratings: results.goalResults.map((result) => ({
      goal_id: result.goal_id,
      rating: result.rating,
    })),
    existing_competency_ratings: results.competencyResults.map((result) => ({
      competency_id: result.competency_id,
      rating: result.rating,
    })),
  };
}

/**
 * Creates (initiates) an appraisal through HR administration scope.
 *
 * The server determines every identity:
 *   employee_id            subject (validated against hr1_employees)
 *   reviewer_id            the authenticating HR account's linked employee
 *   reviewer_hr_admin_id   the authenticating HR account id
 *
 * The client provides only `employee_id`, `review_period`, and an optional
 * `cycle_id`. The reviewer assignment is NOT a guess: it is the exact existing
 * account-linked identity of the HR admin who initiates the appraisal, stored
 * the same way the inherited appraisal row stores it. No organizational
 * manager is invented.
 */
export async function createAppraisal(
  input: CreateAppraisalInput,
): Promise<PerformanceAppraisal | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const reviewPeriod = requireReviewPeriod(input?.review_period);
  if (reviewPeriod instanceof NextResponse) return reviewPeriod;

  let cycleId: string | null = null;
  if (
    input?.cycle_id !== undefined &&
    input?.cycle_id !== null &&
    input?.cycle_id !== ""
  ) {
    const parsedCycle = await requireExistingCycleId(input.cycle_id);
    if (parsedCycle instanceof NextResponse) return parsedCycle;
    cycleId = parsedCycle;
  }

  // Resolve evaluator from employee's current manager (server-side only).
  const evaluatorId = await resolveEvaluatorId(employeeId);

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .insert({
      employee_id: employeeId,
      reviewer_id: identity.employeeUuid,
      reviewer_hr_admin_id: identity.hrAdminId,
      review_period: reviewPeriod,
      status: "self_assessment",
      cycle_id: cycleId,
      evaluator_id: evaluatorId,
    })
    .select(APPRAISAL_SELECT)
    .single();

  if (error) {
    console.error("createAppraisal: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create performance appraisal" },
      { status: 500 },
    );
  }

  const created = data as PerformanceAppraisal;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.appraisalCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.appraisal,
    entityId: created.id,
    oldData: null,
    newData: {
      status: created.status,
      employee_id: created.employee_id,
      reviewer_id: created.reviewer_id,
      reviewer_hr_admin_id: created.reviewer_hr_admin_id,
      review_period: created.review_period,
      evaluator_id: created.evaluator_id,
      ...(created.cycle_id ? { cycle_id: created.cycle_id } : {}),
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  /* Best-effort notifications: notify the employee and the assigned evaluator. */
  try {
    let cycleLabel: string | null = null;
    if (cycleId) {
      const { data: cycleRow } = await supabaseAdmin
        .from("hr3_performance_cycles")
        .select("name")
        .eq("id", cycleId)
        .maybeSingle();
      cycleLabel = cycleRow?.name ?? null;
    }
    const notifPayload: CreatePerDevNotificationInput[] = [
      {
        type: "appraisal.created",
        title: "Appraisal Created",
        message: `Your ${reviewPeriod} appraisal has been created${cycleLabel ? ` for ${cycleLabel}` : ""}.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: employeeId,
        link: null,
      },
    ];
    if (evaluatorId && evaluatorId !== employeeId) {
      notifPayload.push({
        type: "appraisal.created",
        title: "New Direct Report Appraisal",
        message: `A ${reviewPeriod} appraisal has been created for one of your direct reports.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: evaluatorId,
        link: null,
      });
    }
    await createNotifications(notifPayload);
  } catch (notificationError) {
    console.error(
      "createAppraisal: best-effort notification failed:",
      notificationError,
    );
  }

  return {
    ...created,
    currentUserIsHrReviewer: true,
    currentUserIsEvaluator: false,
  };
}

/**
 * Employee Self Assessment.
 *
 * The employee may record their self-assessment ONLY while the appraisal is in
 * `self_assessment`, and ONLY on their own appraisal (`assertEmployeeOwnsRecord`). It
 * writes the narrative `strengths`/`improvements` fields and moves the record
 * to `manager_assessment` (Manager's turn). No scoring fields are written.
 */
export async function submitSelfAssessment(
  appraisalId: string,
  input: SubmitSelfAssessmentInput,
): Promise<PerformanceAppraisal | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const existing = await loadAppraisalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const owned = await assertEmployeeOwnsRecord(existing);
  if (owned instanceof NextResponse) return owned;

  const strengths = requireOptionalText(
    input?.strengths,
    "strengths",
    MAX_APPRAISAL_TEXT_LENGTH,
  );
  if (strengths instanceof NextResponse) return strengths;

  const improvements = requireOptionalText(
    input?.improvements,
    "improvements",
    MAX_APPRAISAL_TEXT_LENGTH,
  );
  if (improvements instanceof NextResponse) return improvements;

  if (!strengths && !improvements) {
    return BAD_REQUEST_RESPONSE(
      "Provide at least a strength or an improvement for the self assessment.",
    );
  }

  if (existing.status !== "self_assessment") {
    return STATE_CONFLICT_RESPONSE();
  }

  const closedCycleError = await rejectIfClosedCycle(existing.cycle_id);
  if (closedCycleError) return closedCycleError;

  const result = await transitionAppraisal({
    id,
    expectedFrom: "self_assessment",
    nextTo: "manager_assessment",
    updates: {
      strengths: strengths || null,
      improvements: improvements || null,
    },
    actor: identity,
    reason: PERFORMANCE_AUDIT_REASON.appraisalSelfAssessmentSubmitted,
    oldData: { status: existing.status },
    newData: {
      status: "manager_assessment",
      strengths: strengths || null,
      improvements: improvements || null,
    },
  });

  /* Best-effort notifications: notify the evaluator and HR reviewer. */
  if (!(result instanceof NextResponse)) {
    const evaluatorUuid = result.evaluator_id;
    const hrUuid = result.reviewer_id;
    const notifPayload: CreatePerDevNotificationInput[] = [];
    if (evaluatorUuid) {
      notifPayload.push({
        type: "appraisal.self_assessment_submitted",
        title: "Self Assessment Submitted",
        message: `An employee has submitted their self-assessment for ${result.review_period}.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: evaluatorUuid,
        link: null,
      });
    }
    if (
      hrUuid &&
      hrUuid !== evaluatorUuid &&
      hrUuid !== identity.employeeUuid
    ) {
      notifPayload.push({
        type: "appraisal.self_assessment_submitted",
        title: "Self Assessment Submitted",
        message: `A self-assessment has been submitted for ${result.review_period}.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: hrUuid,
        link: null,
      });
    }
    if (notifPayload.length > 0) await createNotifications(notifPayload);
  }

  return result;
}

/**
 * Manager Assessment.
 *
 * Authorized for: the assigned evaluator (evaluator_id) ONLY.
 * The HR Admin process administrator cannot submit the manager assessment.
 * The actor's identity is resolved BEFORE any record is read and
 * applied inside the load, so a record outside the caller's scope is
 * indistinguishable from a non-existent record (both 404).
 *
 * The evaluator/manager writes the complete Manager Assessment:
 *   - Evaluation narrative (comments)
 *   - Goal/KPI ratings (1–5 per applicable goal)
 *   - Competency ratings (1–5 per applicable competency)
 *
 * Goal and competency ratings are persisted into the appraisal result tables
 * at assessment time. The final score is NOT computed here — it is computed
 * once at finalization by the HR Admin.
 *
 * Status remains `manager_assessment` — only the HR Admin's finalizeAppraisal
 * advances the status to `finalized`.
 */
export async function submitManagerAssessment(
  appraisalId: string,
  input: SubmitManagerAssessmentInput,
): Promise<PerformanceAppraisal | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  // Resolve the employee identity — never trust client-supplied role or evaluator.
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  // Load the appraisal within any scope the employee can access.
  const loaded = await loadAppraisalOr404(id);
  if (loaded instanceof NextResponse) return loaded;

  // Authorization: the authenticated employee must be the assigned evaluator.
  if (!loaded.evaluator_id || loaded.evaluator_id !== identity.employeeUuid) {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  const existing = loaded;

  const comments = requireOptionalText(
    input?.comments,
    "comments",
    MAX_APPRAISAL_TEXT_LENGTH,
  );
  if (comments instanceof NextResponse) return comments;

  if (!comments) {
    return BAD_REQUEST_RESPONSE(
      "comments are required for the manager assessment.",
    );
  }

  if (existing.status !== "manager_assessment") {
    return STATE_CONFLICT_RESPONSE();
  }

  const closedCycleError = await rejectIfClosedCycle(existing.cycle_id);
  if (closedCycleError) return closedCycleError;

  // Manager assessment intentionally uses a conservative one-submission model.
  // Because the status remains manager_assessment after submission, the status
  // alone cannot distinguish an unsaved assessment from an already-submitted one.
  // Persisted result rows are therefore used as the submission signal to prevent
  // duplicate inserts and scoring corruption.
  const [existingGoalResults, existingCompetencyResults] = await Promise.all([
    supabaseAdmin
      .from("hr3_performance_appraisal_goal_results")
      .select("id")
      .eq("appraisal_id", id)
      .limit(1),
    supabaseAdmin
      .from("hr3_performance_appraisal_competency_results")
      .select("id")
      .eq("appraisal_id", id)
      .limit(1),
  ]);

  if (existingGoalResults.error) {
    console.error(
      "submitManagerAssessment: existing goal results query error:",
      existingGoalResults.error,
    );
    return NextResponse.json(
      { error: "Failed to check existing goal results" },
      { status: 500 },
    );
  }
  if (existingCompetencyResults.error) {
    console.error(
      "submitManagerAssessment: existing competency results query error:",
      existingCompetencyResults.error,
    );
    return NextResponse.json(
      { error: "Failed to check existing competency results" },
      { status: 500 },
    );
  }

  if (
    (existingGoalResults.data ?? []).length > 0 ||
    (existingCompetencyResults.data ?? []).length > 0
  ) {
    return NextResponse.json(
      {
        error:
          "The manager assessment has already been submitted for this appraisal.",
      },
      { status: 409 },
    );
  }

  // --- Goal and Competency ratings (new: persisted at assessment time) ---

  const goalParsed = parseAppraisalRatings(
    input?.goalRatings,
    "goal_id",
    "goal",
  );
  if (goalParsed instanceof NextResponse) return goalParsed;

  const competencyParsed = parseAppraisalRatings(
    input?.competencyRatings,
    "competency_id",
    "competency",
  );
  if (competencyParsed instanceof NextResponse) return competencyParsed;

  const goals = await loadApplicableGoals(
    existing.employee_id,
    existing.cycle_id,
  );
  if (goals instanceof NextResponse) return goals;
  if (goals.length === 0) {
    return BAD_REQUEST_RESPONSE(
      "The appraisal has no applicable goals to rate. Assign goals before submitting the manager assessment.",
    );
  }

  const competencies = await loadApplicableCompetencies(existing.employee_id);
  if (competencies instanceof NextResponse) return competencies;
  if (competencies.length === 0) {
    return BAD_REQUEST_RESPONSE(
      "The appraisal has no applicable competencies to rate. Associate competencies before submitting the manager assessment.",
    );
  }

  const goalSetError = requireExactRatingSet(
    goalParsed.values,
    goals.map((goal) => goal.id),
    "goal",
  );
  if (goalSetError) return goalSetError;

  const competencySetError = requireExactRatingSet(
    competencyParsed.values,
    competencies.map((competency) => competency.competency_id),
    "competency",
  );
  if (competencySetError) return competencySetError;

  // Validate weight total is exactly 100%
  const goalEntries = goalParsed.values.map((rating) => {
    const goal = goals.find((candidate) => candidate.id === rating.id);
    return { rating: rating.rating, weight: goal?.weight ?? Number.NaN };
  });
  const scoring = calculateScoring({
    goalEntries,
    competencyRatings: competencyParsed.values.map((rating) => rating.rating),
  });
  if (!scoring.ok) {
    return BAD_REQUEST_RESPONSE(scoring.error);
  }

  // Persist goal results
  const insertedGoalResultIds: string[] = [];
  const { data: insertedGoalRows, error: goalInsertError } = await supabaseAdmin
    .from("hr3_performance_appraisal_goal_results")
    .insert(
      goalParsed.values.map((rating) => ({
        appraisal_id: id,
        goal_id: rating.id,
        rating: rating.rating,
      })),
    )
    .select("id");
  if (goalInsertError) {
    console.error(
      "submitManagerAssessment: goal result insert error:",
      goalInsertError,
    );
    return NextResponse.json(
      { error: "Failed to persist the goal ratings for this appraisal" },
      { status: 500 },
    );
  }
  for (const row of insertedGoalRows ?? []) {
    insertedGoalResultIds.push(row.id);
  }

  // Persist competency results
  const insertedCompetencyResultIds: string[] = [];
  const { data: insertedCompetencyRows, error: competencyInsertError } =
    await supabaseAdmin
      .from("hr3_performance_appraisal_competency_results")
      .insert(
        competencyParsed.values.map((rating) => ({
          appraisal_id: id,
          competency_id: rating.id,
          rating: rating.rating,
        })),
      )
      .select("id");
  if (competencyInsertError) {
    await removeScoringResults(
      insertedGoalResultIds,
      insertedCompetencyResultIds,
    );
    console.error(
      "submitManagerAssessment: competency result insert error:",
      competencyInsertError,
    );
    return NextResponse.json(
      { error: "Failed to persist the competency ratings for this appraisal" },
      { status: 500 },
    );
  }
  for (const row of insertedCompetencyRows ?? []) {
    insertedCompetencyResultIds.push(row.id);
  }

  // Persist manager assessment — status stays at manager_assessment.
  // Only finalizeAppraisal (HR Admin) advances the status to finalized.
  // The applicability snapshots freeze the goal/competency ID sets that passed
  // validation, preventing future drift when employee competency scores or
  // position requirements change after submission.
  const result = await transitionAppraisal({
    id,
    expectedFrom: "manager_assessment",
    nextTo: "manager_assessment",
    updates: {
      comments,
      applicable_goal_ids_snapshot: goals.map((goal) => goal.id),
      applicable_competency_ids_snapshot: competencies.map(
        (competency) => competency.competency_id,
      ),
    },
    actor: identity,
    reason: PERFORMANCE_AUDIT_REASON.appraisalManagerAssessmentSubmitted,
    oldData: { status: existing.status },
    newData: {
      status: "manager_assessment",
      comments,
      goal_ratings: goalParsed.values.map((rating) => ({
        goal_id: rating.id,
        rating: rating.rating,
      })),
      competency_ratings: competencyParsed.values.map((rating) => ({
        competency_id: rating.id,
        rating: rating.rating,
      })),
    },
  });

  // If transition failed, clean up the scoring results
  if (result instanceof NextResponse) {
    await removeScoringResults(
      insertedGoalResultIds,
      insertedCompetencyResultIds,
    );
  }

  /* Best-effort notifications: notify the employee and HR reviewer. */
  if (!(result instanceof NextResponse)) {
    const employeeUuid = result.employee_id;
    const hrUuid = result.reviewer_id;
    const notifPayload: CreatePerDevNotificationInput[] = [];
    if (employeeUuid) {
      notifPayload.push({
        type: "appraisal.manager_assessment_submitted",
        title: "Manager Assessment Completed",
        message: `Your manager has completed their assessment for ${result.review_period}.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: employeeUuid,
        link: null,
      });
    }
    if (hrUuid && hrUuid !== employeeUuid && hrUuid !== identity.employeeUuid) {
      notifPayload.push({
        type: "appraisal.manager_assessment_submitted",
        title: "Manager Assessment Completed",
        message: `A manager assessment has been submitted for ${result.review_period}.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: hrUuid,
        link: null,
      });
    }
    if (notifPayload.length > 0) await createNotifications(notifPayload);
  }

  return result;
}

/**
 * Finalization — the ONLY place official scoring is computed and persisted.
 *
 * Authorized for: the HR Admin reviewer ONLY. The actor's identity is resolved
 * BEFORE any record is read and applied inside the load, so a record outside
 * the caller's scope is indistinguishable from a non-existent record (both 404).
 *
 * Occurs strictly after the manager assessment. The Manager has already
 * persisted goal and competency ratings into the appraisal result tables
 * during submitManagerAssessment(). This function:
 *
 *   1. reads the existing goal + competency ratings from the result tables,
 *   2. validates they cover exactly the applicable set,
 *   3. computes Goal Score (weighted), Competency Score (average), Final Score
 *      (60/40) and the approved rating band from the unrounded final score,
 *   4. persists `finalized_at`, `final_score`, and `performance_rating` (band
 *      rank), guarded so only the exact preceding state can be finalized.
 *
 * The official result is NEVER recomputed on later reads of this record.
 */
export async function finalizeAppraisal(
  appraisalId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  // Finalization is HR Admin reviewer only — Manager cannot finalize.
  // HR admins with a non-PerDev role are also rejected here.
  if (actor.actorType !== "hr_admin" || !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  const reviewerIdentity = await requireHrEmployee();
  if (reviewerIdentity instanceof NextResponse) return reviewerIdentity;

  const existing = await loadAppraisalScoped(id, {
    reviewer_hr_admin_id: reviewerIdentity.hrAdminId,
    reviewer_id: reviewerIdentity.employeeUuid,
  });
  if (existing instanceof NextResponse) return existing;

  const reviewer = await assertReviewerScope(existing);
  if (reviewer instanceof NextResponse) return reviewer;

  const identity = reviewerIdentity;

  if (existing.status !== "manager_assessment") {
    return STATE_CONFLICT_RESPONSE();
  }

  const closedCycleError = await rejectIfClosedCycle(existing.cycle_id);
  if (closedCycleError) return closedCycleError;

  // Use the frozen applicability snapshots when available (post-migration
  // appraisals that have been submitted).  This prevents applicability drift
  // when employee competency scores or position requirements change after
  // manager submission.  For pre-migration appraisals (NULL snapshots), fall
  // back to the live recomputation.
  const useSnapshot =
    existing.applicable_goal_ids_snapshot !== null &&
    existing.applicable_competency_ids_snapshot !== null;

  let goals: ApplicableGoalRow[];
  let goalIds: string[];

  if (useSnapshot) {
    goalIds = existing.applicable_goal_ids_snapshot!;
    const { data: goalRows, error: goalRowsError } = await supabaseAdmin
      .from("hr3_performance_goals")
      .select("id, title, weight, status")
      .in("id", goalIds);

    if (goalRowsError) {
      console.error("finalizeAppraisal: snapshot goal query error:", goalRowsError);
      return NextResponse.json(
        { error: "Failed to load appraisal goals for scoring" },
        { status: 500 },
      );
    }

    goals = (goalRows ?? []) as ApplicableGoalRow[];
  } else {
    const result = await loadApplicableGoals(
      existing.employee_id,
      existing.cycle_id,
    );
    if (result instanceof NextResponse) return result;
    goals = result;
    goalIds = goals.map((goal) => goal.id);
  }

  if (goals.length === 0) {
    return BAD_REQUEST_RESPONSE(
      "The appraisal has no applicable goals to score. Assign goals before finalizing.",
    );
  }

  let competencies: ApplicableCompetencyRow[];
  let competencyIds: string[];

  if (useSnapshot) {
    competencyIds = existing.applicable_competency_ids_snapshot!;
    const { data: compRows, error: compRowsError } = await supabaseAdmin
      .from("hr3_competencies")
      .select("id, name, category")
      .in("id", competencyIds);

    if (compRowsError) {
      console.error(
        "finalizeAppraisal: snapshot competency query error:",
        compRowsError,
      );
      return NextResponse.json(
        { error: "Failed to load competencies for appraisal scoring" },
        { status: 500 },
      );
    }

    const { data: scores, error: scoresError } = await supabaseAdmin
      .from("hr3_employee_competency_scores")
      .select("competency_id, current_level")
      .eq("employee_id", existing.employee_id)
      .in("competency_id", competencyIds);

    if (scoresError) {
      console.error(
        "finalizeAppraisal: snapshot competency score query error:",
        scoresError,
      );
      return NextResponse.json(
        { error: "Failed to load employee competency scores for appraisal scoring" },
        { status: 500 },
      );
    }

    const currentLevelByCompetency = new Map<string, number>();
    for (const row of scores ?? []) {
      currentLevelByCompetency.set(row.competency_id, row.current_level);
    }

    competencies = (compRows ?? [])
      .map((c) => ({
        competency_id: c.id,
        name: c.name,
        category: c.category,
        current_level: currentLevelByCompetency.get(c.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const result = await loadApplicableCompetencies(existing.employee_id);
    if (result instanceof NextResponse) return result;
    competencies = result;
    competencyIds = competencies.map((c) => c.competency_id);
  }

  if (competencies.length === 0) {
    return BAD_REQUEST_RESPONSE(
      "The appraisal has no applicable competencies to score. Associate competencies before finalizing.",
    );
  }

  // Read the EXISTING ratings persisted by the Manager at assessment time
  const existingResults = await loadScoringResults(id);

  const existingGoalRatings = existingResults.goalResults.map((result) => ({
    id: result.goal_id,
    rating: result.rating,
  }));
  const existingCompetencyRatings = existingResults.competencyResults.map(
    (result) => ({
      id: result.competency_id,
      rating: result.rating,
    }),
  );

  // Validate existing goal ratings cover exactly the applicable set
  const goalSetError = requireExactRatingSet(
    existingGoalRatings,
    goalIds,
    "goal",
  );
  if (goalSetError) return goalSetError;

  // Validate existing competency ratings cover exactly the applicable set
  const competencySetError = requireExactRatingSet(
    existingCompetencyRatings,
    competencyIds,
    "competency",
  );
  if (competencySetError) return competencySetError;

  const goalEntries = existingGoalRatings.map((rating) => {
    const goal = goals.find((candidate) => candidate.id === rating.id);
    return { rating: rating.rating, weight: goal?.weight ?? Number.NaN };
  });

  const scoring = calculateScoring({
    goalEntries,
    competencyRatings: existingCompetencyRatings.map((rating) => rating.rating),
  });
  if (!scoring.ok) {
    return BAD_REQUEST_RESPONSE(scoring.error);
  }

  const finalizedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .update({
      status: "finalized",
      finalized_at: finalizedAt,
      final_score: scoring.calculation.finalScoreDisplay,
      performance_rating: scoring.calculation.band.rank,
      updated_at: finalizedAt,
    })
    .eq("id", id)
    .eq("status", "manager_assessment")
    .select(APPRAISAL_SELECT)
    .maybeSingle();

  if (updateError && updateError.code !== "PGRST116") {
    console.error("finalizeAppraisal: update error:", updateError);
    return NextResponse.json(
      { error: "Failed to finalize performance appraisal" },
      { status: 500 },
    );
  }

  if (!updated) {
    console.error(
      "finalizeAppraisal: appraisal is not in the expected state:",
      id,
    );
    return STATE_CONFLICT_RESPONSE();
  }

  const finalized = updated as PerformanceAppraisal;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.appraisalFinalized,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.appraisal,
    entityId: finalized.id,
    oldData: { status: existing.status },
    newData: {
      status: finalized.status,
      finalized_at: finalizedAt,
      final_score: scoring.calculation.finalScoreDisplay,
      performance_rating: scoring.calculation.band.rank,
      goal_score: roundScore(scoring.calculation.goalScore, 2),
      competency_score: roundScore(scoring.calculation.competencyScore, 2),
      goal_ratings: existingGoalRatings,
      competency_ratings: existingCompetencyRatings,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  /* Best-effort notifications: notify the employee and evaluator. */
  {
    const employeeUuid = finalized.employee_id;
    const evaluatorUuid = finalized.evaluator_id;
    const notifPayload: CreatePerDevNotificationInput[] = [];
    if (employeeUuid) {
      notifPayload.push({
        type: "appraisal.finalized",
        title: "Appraisal Finalized",
        message: `Your ${finalized.review_period} appraisal has been finalized by HR.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: employeeUuid,
        link: null,
      });
    }
    if (
      evaluatorUuid &&
      evaluatorUuid !== employeeUuid &&
      evaluatorUuid !== identity.employeeUuid
    ) {
      notifPayload.push({
        type: "appraisal.finalized",
        title: "Appraisal Finalized",
        message: `The ${finalized.review_period} appraisal you assessed has been finalized by HR.`,
        actor_employee_id: identity.employeeUuid,
        recipient_employee_id: evaluatorUuid,
        link: null,
      });
    }
    if (notifPayload.length > 0) await createNotifications(notifPayload);
  }

  return enrichAppraisalWithScoring(finalized);
}

/**
 * Removes ONLY the scoring-result rows this request inserted (compensation
 * helper). Scoped to the freshly inserted row ids so a request that loses the
 * finalization race can never delete scoring rows written by another request.
 * No delete is issued for a result table the request did not write to.
 */
async function removeScoringResults(
  goalResultIds: string[],
  competencyResultIds: string[],
): Promise<void> {
  if (goalResultIds.length > 0) {
    await supabaseAdmin
      .from("hr3_performance_appraisal_goal_results")
      .delete()
      .in("id", goalResultIds);
  }
  if (competencyResultIds.length > 0) {
    await supabaseAdmin
      .from("hr3_performance_appraisal_competency_results")
      .delete()
      .in("id", competencyResultIds);
  }
}

/**
 * Employee Acknowledgement.
 *
 * ACKNOWLEDGEMENT ≠ AGREEMENT. It records that the subject employee has
 * received/reviewed the final evaluation (`acknowledged_at`); it does NOT
 * overwrite the evaluation content and carries no agreement/dispute semantics.
 *
 * Employee-only, own record only, and only from `finalized`.
 */
export async function acknowledgeAppraisal(
  appraisalId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const existing = await loadAppraisalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const owned = await assertEmployeeOwnsRecord(existing);
  if (owned instanceof NextResponse) return owned;

  if (existing.status !== "finalized") {
    return STATE_CONFLICT_RESPONSE();
  }

  const acknowledgedAt = new Date().toISOString();

  const result = await transitionAppraisal({
    id,
    expectedFrom: "finalized",
    nextTo: "acknowledged",
    updates: { acknowledged_at: acknowledgedAt },
    actor: identity,
    reason: PERFORMANCE_AUDIT_REASON.appraisalAcknowledged,
    oldData: { status: existing.status },
    newData: { status: "acknowledged", acknowledged_at: acknowledgedAt },
  });

  /* Best-effort notification: notify the HR reviewer. */
  if (!(result instanceof NextResponse)) {
    const hrUuid = result.reviewer_id;
    if (hrUuid && hrUuid !== identity.employeeUuid) {
      await createNotifications([
        {
          type: "appraisal.acknowledged",
          title: "Appraisal Acknowledged",
          message: `The employee has acknowledged their ${result.review_period} appraisal.`,
          actor_employee_id: identity.employeeUuid,
          recipient_employee_id: hrUuid,
          link: null,
        },
      ]);
    }
  }

  return result;
}

/**
 * Legacy draft recovery: HR Admin reviewer explicitly starts the self-assessment
 * phase for an appraisal that is still in "draft" status. This exists because
 * some older appraisals were created with "draft" status and never advanced.
 *
 * Guard: HR Admin reviewer only (reviewer_hr_admin_id + reviewer_id match).
 * Precondition: existing.status === "draft".
 * Effect: guarded transition draft -> self_assessment.
 */
export async function startSelfAssessmentByHrAdmin(
  appraisalId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType !== "hr_admin" || !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  const reviewerIdentity = await requireHrEmployee();
  if (reviewerIdentity instanceof NextResponse) return reviewerIdentity;

  const existing = await loadAppraisalScoped(id, {
    reviewer_hr_admin_id: reviewerIdentity.hrAdminId,
    reviewer_id: reviewerIdentity.employeeUuid,
  });
  if (existing instanceof NextResponse) return existing;

  const reviewer = await assertReviewerScope(existing);
  if (reviewer instanceof NextResponse) return reviewer;

  if (existing.status !== "draft") {
    return STATE_CONFLICT_RESPONSE();
  }

  const closedCycleError = await rejectIfClosedCycle(existing.cycle_id);
  if (closedCycleError) return closedCycleError;

  return transitionAppraisal({
    id,
    expectedFrom: "draft",
    nextTo: "self_assessment",
    updates: {},
    actor: reviewerIdentity,
    reason: PERFORMANCE_AUDIT_REASON.appraisalSelfAssessmentStarted,
    oldData: { status: existing.status },
    newData: { status: "self_assessment" },
  });
}

/**
 * Recovery operation: HR Admin reviewer reassigns the evaluator on an active
 * appraisal. This exists because the originally assigned manager may have left
 * the organisation or become inactive before completing their assessment.
 *
 * Guard: HR Admin reviewer only (reviewer_hr_admin_id + reviewer_id match).
 * Precondition: existing.status IN ('self_assessment', 'manager_assessment').
 * Effect: update evaluator_id only (no status change).
 */
export async function reassignAppraisalEvaluator(
  appraisalId: string,
  evaluatorId: string,
): Promise<PerformanceAppraisal | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType !== "hr_admin" || !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RECORD_RESPONSE();
  }

  const reviewerIdentity = await requireHrEmployee();
  if (reviewerIdentity instanceof NextResponse) return reviewerIdentity;

  const existing = await loadAppraisalScoped(id, {
    reviewer_hr_admin_id: reviewerIdentity.hrAdminId,
    reviewer_id: reviewerIdentity.employeeUuid,
  });
  if (existing instanceof NextResponse) return existing;

  const reviewer = await assertReviewerScope(existing);
  if (reviewer instanceof NextResponse) return reviewer;

  if (
    existing.status !== "self_assessment" &&
    existing.status !== "manager_assessment"
  ) {
    return STATE_CONFLICT_RESPONSE();
  }

  const closedCycleError = await rejectIfClosedCycle(existing.cycle_id);
  if (closedCycleError) return closedCycleError;

  // Validate the new evaluator exists in hr1_employees and is active.
  const validatedEvaluatorId = await requireActiveEmployeeId(evaluatorId);
  if (validatedEvaluatorId instanceof NextResponse) return validatedEvaluatorId;

  if (existing.evaluator_id === validatedEvaluatorId) {
    return BAD_REQUEST_RESPONSE(
      "The selected evaluator is already assigned to this appraisal.",
    );
  }

  if (validatedEvaluatorId === existing.employee_id) {
    return BAD_REQUEST_RESPONSE(
      "The evaluator cannot be the subject employee of the appraisal.",
    );
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .update({
      evaluator_id: validatedEvaluatorId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", existing.status)
    .select(APPRAISAL_SELECT)
    .maybeSingle();

  if (!error && data) {
    const updated = data as PerformanceAppraisal;

    const auditError = await insertAuditEvent({
      actor: auditActorFromIdentity(reviewerIdentity),
      reason: PERFORMANCE_AUDIT_REASON.appraisalEvaluatorReassigned,
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.appraisal,
      entityId: updated.id,
      oldData: { evaluator_id: existing.evaluator_id },
      newData: { evaluator_id: validatedEvaluatorId },
    });
    if (auditError instanceof NextResponse) return auditError;

    return updated;
  }

  if (error && error.code !== "PGRST116") {
    console.error("reassignAppraisalEvaluator: update error:", error);
    return NextResponse.json(
      { error: "Failed to reassign evaluator" },
      { status: 500 },
    );
  }

  return STATE_CONFLICT_RESPONSE();
}
