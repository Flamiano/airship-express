import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import {
  auditActorFromIdentity,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  BAD_REQUEST_RESPONSE,
  requireNonEmptyText,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import type {
  PerformanceCycleReadiness,
  PerformanceCycleReadinessBlocker,
  PerformanceCycleReadinessWarning,
} from "@/performance-development-dashboard/types";

export const PERFORMANCE_CYCLE_STATUSES = [
  "draft",
  "open",
  "in_review",
  "finalization",
  "closed",
] as const;

export const PERFORMANCE_CYCLE_STAGES = [
  "goal_setting",
  "goal_execution",
  "check_in",
  "self_assessment",
  "manager_assessment",
  "finalization",
  "closed",
] as const;

/**
 * Explicit forward-only stage transitions. A cycle advances exactly one stage
 * at a time, never skipping. `closed` has no next stage; advancing it (or
 * advancing past it) is rejected.
 */
export const PERFORMANCE_CYCLE_STAGE_TRANSITIONS = {
  goal_setting: "goal_execution",
  goal_execution: "check_in",
  check_in: "self_assessment",
  self_assessment: "manager_assessment",
  manager_assessment: "finalization",
  finalization: "closed",
  closed: undefined,
} as const;

/**
 * Statuses treated as "active" for current-cycle selection, shared by the
 * dashboard and reports services (open, in_review, finalization).
 */
export const ACTIVE_CYCLE_STATUSES = new Set(["open", "in_review", "finalization"]);

export const DRAFT_CYCLE_STATUS = "draft";

export type CurrentCycleRow = {
  id: string;
  name: string;
  status: string | null;
  stage: string | null;
};

/**
 * Current-cycle selection: prefer the first cycle in an ACTIVE status,
 * otherwise the DRAFT cycle, otherwise null. Callers pass cycles ordered
 * newest first; ordering is never changed. The dashboard and reports services
 * both call this so the rule lives in exactly one place.
 */
export function chooseCurrentCycle<T extends CurrentCycleRow>(
  rows: T[]
): T | null {
  const active = rows.find(
    (row) => row.status !== null && ACTIVE_CYCLE_STATUSES.has(row.status)
  );
  if (active) return active;
  const fallback = rows.find((row) => row.status === DRAFT_CYCLE_STATUS);
  return fallback ?? null;
}

const CYCLE_SELECT =
  "id, name, period_start, period_end, status, stage, created_by, created_at, opened_at, closed_at";

export type PerformanceCycle = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: (typeof PERFORMANCE_CYCLE_STATUSES)[number];
  stage: (typeof PERFORMANCE_CYCLE_STAGES)[number];
  created_by: string;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
};

/**
 * Untrusted POST body. Only `name`, `period_start`, and `period_end` are ever
 * read. Client-supplied `created_by`, employee UUIDs, HR admin IDs, `status`,
 * and `stage` values in the body are ignored; the creator and initial
 * status/stage are always resolved server-side.
 */
export type CreatePerformanceCycleInput = Record<string, unknown>;

const CYCLE_NOT_FOUND_RESPONSE = () =>
  NextResponse.json(
    { error: "Performance cycle not found" },
    { status: 404 }
  );

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireValidDate(
  value: unknown,
  field: string
): string | NextResponse {
  if (typeof value !== "string" || !DATE_PATTERN.test(value.trim())) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be a valid date in YYYY-MM-DD format.`
    );
  }

  const trimmed = value.trim();
  const parsed = new Date(`${trimmed}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
    return BAD_REQUEST_RESPONSE(`${field} must be a valid calendar date.`);
  }

  return trimmed;
}

async function loadCycleOr404(
  cycleId: string
): Promise<PerformanceCycle | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select(CYCLE_SELECT)
    .eq("id", cycleId)
    .maybeSingle();

  if (error) {
    console.error("loadCycleOr404: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance cycle" },
      { status: 500 }
    );
  }

  if (!data) return CYCLE_NOT_FOUND_RESPONSE();

  return data as PerformanceCycle;
}

/**
 * Applies a lifecycle transition only while the cycle still matches the given
 * `guards` (the "expected current state"). This is concurrency-safe: if
 * another request changed the cycle between the initial load and this update,
 * the filtered update matches zero rows and a 400 is returned instead of
 * silently overwriting a cycle that already transitioned.
 */
async function transitionCycle(
  cycleId: string,
  guards: Record<string, string>,
  payload: Record<string, unknown>
): Promise<PerformanceCycle | NextResponse> {
  let query = supabaseAdmin
    .from("hr3_performance_cycles")
    .update(payload)
    .eq("id", cycleId);

  for (const [column, value] of Object.entries(guards)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.select(CYCLE_SELECT).maybeSingle();

  if (!error && data) return data as PerformanceCycle;

  if (error && error.code !== "PGRST116") {
    console.error("transitionCycle: update error:", error);
    return NextResponse.json(
      { error: "Failed to update performance cycle" },
      { status: 500 }
    );
  }

  console.error(
    "transitionCycle: no row matched the expected state for cycle:",
    cycleId
  );
  return NextResponse.json(
    {
      error:
        "Performance cycle is not in the expected state for this operation. It may have been changed by another request.",
    },
    { status: 400 }
  );
}

/**
 * HR administrative operation. Requires the module-level HR admin scope
 * (`super_admin` / `hr_performance_admin`) via the authorization layer, which
 * delegates to `requireHrAdmin()`.
 *
 * New cycles always start in the database's intended initial state
 * (`status = "draft"`, `stage = "goal_setting"`); the client may not choose
 * the initial status or stage. `created_by` is always the authenticated HR
 * admin's ID and is never taken from the request body.
 *
 * Mutation → audit (`cycle.created`) with the acting HR account as the actor.
 */
export async function createPerformanceCycle(
  input: CreatePerformanceCycleInput
): Promise<PerformanceCycle | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const name = requireNonEmptyText(input?.name, "name", 255);
  if (name instanceof NextResponse) return name;

  const periodStart = requireValidDate(input?.period_start, "period_start");
  if (periodStart instanceof NextResponse) return periodStart;

  const periodEnd = requireValidDate(input?.period_end, "period_end");
  if (periodEnd instanceof NextResponse) return periodEnd;

  const startTime = new Date(`${periodStart}T00:00:00Z`).getTime();
  const endTime = new Date(`${periodEnd}T00:00:00Z`).getTime();

  if (startTime > endTime) {
    return BAD_REQUEST_RESPONSE("period_start must be on or before period_end.");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .insert({
      name,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      stage: "goal_setting",
      created_by: identity.hrAdminId,
    })
    .select(CYCLE_SELECT)
    .single();

  if (error) {
    console.error("createPerformanceCycle: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create performance cycle" },
      { status: 500 }
    );
  }

  const created = data as PerformanceCycle;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.cycleCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.performanceCycle,
    entityId: created.id,
    oldData: null,
    newData: {
      name: created.name,
      period_start: created.period_start,
      period_end: created.period_end,
      status: created.status,
      stage: created.stage,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * HR administrative operation with the same access requirement as
 * `createPerformanceCycle`. Returns all cycles ordered newest first
 * (`created_at` desc, then `id` desc for a deterministic total order).
 */
export async function listPerformanceCycles(): Promise<
  PerformanceCycle[] | NextResponse
> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select(CYCLE_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listPerformanceCycles: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance cycles" },
      { status: 500 }
    );
  }

  return (data ?? []) as PerformanceCycle[];
}

/**
 * `draft → open`. Sets `status = "open"` and stamps `opened_at`, leaving the
 * stage unchanged (a fresh cycle starts at `goal_setting`). Rejects any cycle
 * that is not currently `draft`. `name`, `period_start`, `period_end`,
 * `created_by`, and `created_at` are never modified, and none of `status`,
 * `stage`, `opened_at`, or `created_by` are ever accepted from the client.
 *
 * Mutation → audit (`cycle.opened`) with the acting HR account as the actor.
 */
export async function openPerformanceCycle(
  cycleId: string
): Promise<PerformanceCycle | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(cycleId, "cycle id");
  if (id instanceof NextResponse) return id;

  const existing = await loadCycleOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.status !== "draft") {
    return BAD_REQUEST_RESPONSE(
      `Cannot open performance cycle: only draft cycles can be opened. Current status: "${existing.status}".`
    );
  }

  const opened = await transitionCycle(
    id,
    { status: "draft" },
    { status: "open", opened_at: new Date().toISOString() }
  );
  if (opened instanceof NextResponse) return opened;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.cycleOpened,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.performanceCycle,
    entityId: opened.id,
    oldData: { status: existing.status, stage: existing.stage },
    newData: {
      status: opened.status,
      stage: opened.stage,
      opened_at: opened.opened_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return opened;
}

/**
 * The authoritative readiness rules for the next forward-only stage
 * transition, computed from data the live schema actually links to a cycle:
 *
 *   hr3_performance_goals.cycle_id
 *   hr3_performance_appraisals.cycle_id
 *
 * Check-ins (`hr3_performance_feedback`) have no cycle or goal relationship in
 * the schema, so check-in coverage can never be verified per cycle and is
 * surfaced as an informational warning, never a blocker. No expected employee
 * population is invented either: readiness is derived solely from verifiable
 * cycle-linked records, and no client input is trusted.
 */
async function computeCycleReadiness(
  cycle: PerformanceCycle
): Promise<PerformanceCycleReadiness | NextResponse> {
  const [goalResult, appraisalResult] = await Promise.all([
    supabaseAdmin
      .from("hr3_performance_goals")
      .select("id, employee_id, status")
      .eq("cycle_id", cycle.id),
    supabaseAdmin
      .from("hr3_performance_appraisals")
      .select("id, employee_id, status, evaluator_id")
      .eq("cycle_id", cycle.id),
  ]);

  if (goalResult.error) {
    console.error("computeCycleReadiness: goal query error:", goalResult.error);
    return NextResponse.json(
      { error: "Failed to load performance cycle readiness" },
      { status: 500 }
    );
  }

  if (appraisalResult.error) {
    console.error(
      "computeCycleReadiness: appraisal query error:",
      appraisalResult.error
    );
    return NextResponse.json(
      { error: "Failed to load performance cycle readiness" },
      { status: 500 }
    );
  }

  const goals = goalResult.data ?? [];
  const appraisals = appraisalResult.data ?? [];

  const totalGoals = goals.length;
  const startedGoals = goals.filter(
    (goal) => goal.status !== "not_started"
  ).length;
  const unstartedGoals = totalGoals - startedGoals;

  const totalAppraisals = appraisals.length;
  const draftAppraisals = appraisals.filter(
    (appraisal) => appraisal.status === "draft"
  ).length;
  const selfAssessmentAppraisals = appraisals.filter(
    (appraisal) => appraisal.status === "self_assessment"
  ).length;
  const managerAssessmentAppraisals = appraisals.filter(
    (appraisal) => appraisal.status === "manager_assessment"
  ).length;
  const finalizedAppraisals = appraisals.filter(
    (appraisal) =>
      appraisal.status === "finalized" || appraisal.status === "acknowledged"
  ).length;

  // Employee scope: derived from appraisals linked to this cycle.
  // There is no employee-cycle junction table; appraisals define the
  // in-scope population.
  const inScopeEmployeeIds = [
    ...new Set(appraisals.map((a) => a.employee_id).filter(Boolean)),
  ];
  const goalEmployeeIds = [
    ...new Set(goals.map((g) => g.employee_id).filter(Boolean)),
  ];
  const employeesWithGoals = new Set(goalEmployeeIds);
  const employeesMissingGoals = inScopeEmployeeIds.filter(
    (eid) => !employeesWithGoals.has(eid)
  );
  const employeesMissingGoalsCount = employeesMissingGoals.length;

  const blockers: PerformanceCycleReadinessBlocker[] = [];
  const warnings: PerformanceCycleReadinessWarning[] = [];

  const nextStage = PERFORMANCE_CYCLE_STAGE_TRANSITIONS[cycle.stage];
  let summary: string;

  switch (cycle.stage) {
    case "goal_setting": {
      summary =
        totalGoals === 0
          ? "No goals are linked to this cycle."
          : `${totalGoals} goal${totalGoals === 1 ? "" : "s"} linked to this cycle.`;
      if (totalGoals === 0) {
        blockers.push({
          code: "no_cycle_goals",
          label: "No goals for this cycle",
          count: 0,
          description:
            "Add at least one goal linked to this cycle before moving it to Goal Execution.",
        });
      } else if (employeesMissingGoalsCount > 0) {
        blockers.push({
          code: "employees_missing_goals",
          label: "Employees missing cycle goals",
          count: employeesMissingGoalsCount,
          description: `${employeesMissingGoalsCount} employee${
            employeesMissingGoalsCount === 1 ? "" : "s"
          } linked to this cycle ${
            employeesMissingGoalsCount === 1 ? "has" : "have"
          } no goals assigned.`,
        });
      }
      break;
    }

    case "goal_execution": {
      summary = `${startedGoals} of ${totalGoals} goal${
        totalGoals === 1 ? "" : "s"
      } have started.`;
      if (totalGoals === 0) {
        blockers.push({
          code: "no_cycle_goals",
          label: "No goals for this cycle",
          count: 0,
          description:
            "Add at least one goal linked to this cycle before moving it to Check-in.",
        });
      } else if (unstartedGoals > 0) {
        blockers.push({
          code: "goals_not_started",
          label: "Goals not started",
          count: unstartedGoals,
          description: `${unstartedGoals} goal${
            unstartedGoals === 1 ? "" : "s"
          } linked to this cycle ${
            unstartedGoals === 1 ? "has" : "have"
          } not been started yet.`,
        });
      }
      warnings.push({
        code: "checkins_not_linked",
        label: "Check-in coverage not verifiable",
        description:
          "Check-ins are not linked to performance cycles in the current data model, so check-in completion cannot be verified for this cycle.",
      });
      break;
    }

    case "check_in": {
      summary =
        totalAppraisals === 0
          ? "No appraisals are linked to this cycle."
          : `${totalAppraisals} appraisal${
              totalAppraisals === 1 ? "" : "s"
            } linked to this cycle.`;
      if (totalAppraisals === 0) {
        blockers.push({
          code: "no_cycle_appraisals",
          label: "No appraisals for this cycle",
          count: 0,
          description:
            "Create at least one appraisal linked to this cycle before moving it to Self Assessment.",
        });
      }
      warnings.push({
        code: "checkins_not_linked",
        label: "Check-in coverage not verifiable",
        description:
          "Check-ins are not linked to performance cycles in the current data model, so check-in completion cannot be verified for this cycle.",
      });
      break;
    }

    case "self_assessment": {
      const pendingSelfAssessments = draftAppraisals + selfAssessmentAppraisals;
      summary = `${totalAppraisals - pendingSelfAssessments} of ${totalAppraisals} appraisal${
        totalAppraisals === 1 ? "" : "s"
      } have a submitted self assessment.`;
      if (pendingSelfAssessments > 0) {
        blockers.push({
          code: "self_assessments_incomplete",
          label: "Self assessments incomplete",
          count: pendingSelfAssessments,
          description: `${pendingSelfAssessments} appraisal${
            pendingSelfAssessments === 1 ? "" : "s"
          } linked to this cycle ${
            pendingSelfAssessments === 1 ? "has" : "have"
          } not submitted a self assessment yet.`,
        });
      }

      // Missing evaluator: appraisals in self_assessment or
      // manager_assessment with no evaluator assigned.
      const missingEvaluatorCount = appraisals.filter(
        (a) =>
          (a.status === "self_assessment" ||
            a.status === "manager_assessment") &&
          !a.evaluator_id,
      ).length;
      if (missingEvaluatorCount > 0) {
        blockers.push({
          code: "appraisals_missing_evaluator",
          label: "Appraisals missing evaluator",
          count: missingEvaluatorCount,
          description: `${missingEvaluatorCount} appraisal${
            missingEvaluatorCount === 1 ? "" : "s"
          } linked to this cycle ${
            missingEvaluatorCount === 1 ? "has" : "have"
          } no evaluator assigned. Assign or reassign an evaluator before advancing.`,
        });
      }
      break;
    }

    case "manager_assessment": {
      // Appraisals still in self_assessment have not yet been handed to the
      // manager; these remain a blocker exactly as before.
      const pendingSelfAssessments = draftAppraisals + selfAssessmentAppraisals;

      // Appraisals that have reached manager_assessment status but have no
      // persisted goal or competency result rows.  Because the status stays
      // at "manager_assessment" after submission, persisted rows are the
      // only reliable signal that a manager has actually submitted.
      const managerAssessmentIds = appraisals
        .filter((a) => a.status === "manager_assessment")
        .map((a) => a.id);

      let submittedManagerAssessmentIds = new Set<string>();

      if (managerAssessmentIds.length > 0) {
        const [goalResults, competencyResults] = await Promise.all([
          supabaseAdmin
            .from("hr3_performance_appraisal_goal_results")
            .select("appraisal_id")
            .in("appraisal_id", managerAssessmentIds),
          supabaseAdmin
            .from("hr3_performance_appraisal_competency_results")
            .select("appraisal_id")
            .in("appraisal_id", managerAssessmentIds),
        ]);

        if (goalResults.error) {
          console.error(
            "computeCycleReadiness: goal results query error:",
            goalResults.error
          );
          return NextResponse.json(
            { error: "Failed to load performance cycle readiness" },
            { status: 500 }
          );
        }

        if (competencyResults.error) {
          console.error(
            "computeCycleReadiness: competency results query error:",
            competencyResults.error
          );
          return NextResponse.json(
            { error: "Failed to load performance cycle readiness" },
            { status: 500 }
          );
        }

        submittedManagerAssessmentIds = new Set<string>([
          ...((goalResults.data ?? []).map((r) => r.appraisal_id) as string[]),
          ...((competencyResults.data ?? []).map(
            (r) => r.appraisal_id
          ) as string[]),
        ]);
      }

      const managerAssessmentsNotSubmitted =
        managerAssessmentIds.length -
        managerAssessmentIds.filter((id) =>
          submittedManagerAssessmentIds.has(id)
        ).length;

      summary = `${totalAppraisals - pendingSelfAssessments - managerAssessmentsNotSubmitted} of ${totalAppraisals} appraisal${
        totalAppraisals === 1 ? "" : "s"
      } have a submitted manager assessment.`;

      if (pendingSelfAssessments > 0) {
        blockers.push({
          code: "manager_assessments_incomplete",
          label: "Manager assessments incomplete",
          count: pendingSelfAssessments,
          description: `${pendingSelfAssessments} appraisal${
            pendingSelfAssessments === 1 ? "" : "s"
          } linked to this cycle ${
            pendingSelfAssessments === 1 ? "is" : "are"
          } still awaiting a manager assessment.`,
        });
      }

      if (managerAssessmentsNotSubmitted > 0) {
        blockers.push({
          code: "manager_assessments_not_submitted",
          label: "Manager assessments not submitted",
          count: managerAssessmentsNotSubmitted,
          description: `${managerAssessmentsNotSubmitted} appraisal${
            managerAssessmentsNotSubmitted === 1 ? "" : "s"
          } ${
            managerAssessmentsNotSubmitted === 1 ? "is" : "are"
          } still awaiting a manager submission.`,
        });
      }

      // Missing evaluator: appraisals in self_assessment or
      // manager_assessment with no evaluator assigned.
      const missingEvaluatorCount = appraisals.filter(
        (a) =>
          (a.status === "self_assessment" ||
            a.status === "manager_assessment") &&
          !a.evaluator_id,
      ).length;
      if (missingEvaluatorCount > 0) {
        blockers.push({
          code: "appraisals_missing_evaluator",
          label: "Appraisals missing evaluator",
          count: missingEvaluatorCount,
          description: `${missingEvaluatorCount} appraisal${
            missingEvaluatorCount === 1 ? "" : "s"
          } linked to this cycle ${
            missingEvaluatorCount === 1 ? "has" : "have"
          } no evaluator assigned. Assign or reassign an evaluator before advancing.`,
        });
      }

      break;
    }

    case "finalization": {
      const notFinalized =
        draftAppraisals + selfAssessmentAppraisals + managerAssessmentAppraisals;
      summary = `${finalizedAppraisals} of ${totalAppraisals} appraisal${
        totalAppraisals === 1 ? "" : "s"
      } are finalized.`;
      if (notFinalized > 0) {
        blockers.push({
          code: "appraisals_not_finalized",
          label: "Appraisals not finalized",
          count: notFinalized,
          description: `${notFinalized} appraisal${
            notFinalized === 1 ? "" : "s"
          } linked to this cycle ${
            notFinalized === 1 ? "is" : "are"
          } not finalized yet.`,
        });
      }
      break;
    }

    default: {
      summary = "This cycle has no next stage.";
      blockers.push({
        code: "no_next_stage",
        label: "No next stage",
        count: 0,
        description: "This cycle is closed and cannot advance any further.",
      });
    }
  }

  return {
    cycleId: cycle.id,
    ready: blockers.length === 0 && Boolean(nextStage),
    currentStage: cycle.stage,
    nextStage: nextStage ?? null,
    summary,
    blockers,
    warnings,
  };
}

/**
 * Read-only readiness report for a cycle's next stage transition. Requires the
 * same module-level HR admin scope as the cycle lifecycle operations. Performs
 * no writes and records no audit event; a non-existent cycle returns 404 using
 * the module's existing convention.
 */
export async function getCycleReadiness(
  cycleId: string
): Promise<PerformanceCycleReadiness | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(cycleId, "cycle id");
  if (id instanceof NextResponse) return id;

  const cycle = await loadCycleOr404(id);
  if (cycle instanceof NextResponse) return cycle;

  return computeCycleReadiness(cycle);
}

/**
 * Advances the cycle exactly one stage along the confirmed forward-only stage
 * flow. The client never supplies the target stage; the server looks up the
 * next stage in `PERFORMANCE_CYCLE_STAGE_TRANSITIONS`.
 *
 * The SAME `computeCycleReadiness` implementation used by the readiness
 * endpoint is enforced here: when the cycle has any readiness blocker the
 * advance is rejected with 409 and the cycle is left completely unchanged (no
 * write, no audit event). Readiness is never trusted from the client.
 *
 * Intermediate advances leave `status` unchanged: no additional status
 * transitions are invented beyond the confirmed lifecycle. The final advance
 * (`finalization → closed`) is the only one that also sets `status =
 * "closed"` and stamps `closed_at`, keeping status and stage consistent.
 *
 * Mutation → audit (`cycle.stage_advanced`) with the acting HR account as the
 * actor. The audit event stays `cycle.stage_advanced` even when the advance
 * reaches the terminal closed stage; the resulting `status`/`closed_at` are
 * carried in the event `newData`. The dedicated close operation records
 * `cycle.closed`.
 */
export async function advancePerformanceCycle(
  cycleId: string
): Promise<PerformanceCycle | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(cycleId, "cycle id");
  if (id instanceof NextResponse) return id;

  const existing = await loadCycleOr404(id);
  if (existing instanceof NextResponse) return existing;

  const nextStage = PERFORMANCE_CYCLE_STAGE_TRANSITIONS[existing.stage];
  if (!nextStage) {
    return BAD_REQUEST_RESPONSE(
      `Cannot advance performance cycle: stage "${existing.stage}" has no next stage.`
    );
  }

  const readiness = await computeCycleReadiness(existing);
  if (readiness instanceof NextResponse) return readiness;

  if (!readiness.ready) {
    return NextResponse.json(
      {
        error: "Performance cycle is not ready to advance.",
        readiness,
      },
      { status: 409 }
    );
  }

  const terminal = nextStage === "closed";

  const advanced = await transitionCycle(
    id,
    { stage: existing.stage },
    terminal
      ? {
          status: "closed",
          stage: "closed",
          closed_at: new Date().toISOString(),
        }
      : { stage: nextStage }
  );
  if (advanced instanceof NextResponse) return advanced;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.cycleStageAdvanced,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.performanceCycle,
    entityId: advanced.id,
    oldData: { status: existing.status, stage: existing.stage },
    newData: {
      status: advanced.status,
      stage: advanced.stage,
      opened_at: advanced.opened_at,
      closed_at: advanced.closed_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return advanced;
}

/**
 * Closes a cycle that has reached the finalization portion of the lifecycle.
 * Draft cycles and cycles still before finalization are rejected, so a draft
 * can never be closed and an open cycle cannot be closed directly. Both
 * `status` and `stage` become `"closed"` and `closed_at` is stamped.
 * Reopening is intentionally never offered.
 *
 * Defense-in-depth: requires `stage = "finalization"` AND `status` to be one
 * of the active statuses (`"open"`, `"in_review"`, or `"finalization"`).
 * This rejects draft and already-closed cycles even if stage were somehow
 * mismatched.
 *
 * Mutation → audit (`cycle.closed`) with the acting HR account as the actor.
 */
export async function closePerformanceCycle(
  cycleId: string
): Promise<PerformanceCycle | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(cycleId, "cycle id");
  if (id instanceof NextResponse) return id;

  const existing = await loadCycleOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.stage !== "finalization") {
    return BAD_REQUEST_RESPONSE(
      `Cannot close performance cycle: only cycles in the finalization portion of the lifecycle can be closed. Current stage: "${existing.stage}".`
    );
  }

  if (
    existing.status !== "open" &&
    existing.status !== "in_review" &&
    existing.status !== "finalization"
  ) {
    return BAD_REQUEST_RESPONSE(
      `Cannot close performance cycle: cycle status must be active (open, in_review, or finalization). Current status: "${existing.status}".`
    );
  }

  const closed = await transitionCycle(
    id,
    { stage: "finalization", status: existing.status },
    {
      status: "closed",
      stage: "closed",
      closed_at: new Date().toISOString(),
    }
  );
  if (closed instanceof NextResponse) return closed;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.cycleClosed,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.performanceCycle,
    entityId: closed.id,
    oldData: { status: existing.status, stage: existing.stage },
    newData: {
      status: closed.status,
      stage: closed.stage,
      closed_at: closed.closed_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return closed;
}