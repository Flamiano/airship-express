import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import type { PerDevActor } from "@/performance-development-dashboard/lib/auth/actor";

/**
 * PerDev account-level audit attribution.
 *
 * Persists WHO PERFORMED an action (the authenticated account) separately from
 * the business-table employee identity, using the existing live table
 * `hr3_audit_events`. No schema change, no RPC, no transaction wrapper.
 *
 * Dimension mapping:
 *
 *   WHO PERFORMED THE ACTION?   → actor_type + actor_id (hr_admin.id)
 *   WHICH EMPLOYEE IS LINKED?   → employeeUuid / employeeIdNumber (context only)
 *   WHO IS THE BUSINESS SUBJECT? → entity_type + entity_id (the record)
 *
 * `actor_id` is ALWAYS the authenticated account id (`hr_admin.id`), never the
 * linked employee UUID. The business record keeps its existing employee FK
 * (`goals.assigned_by`, `feedback.given_by` → `hr1_employees.id`).
 *
 * REASON / ACTION CONVENTION
 * --------------------------
 * Verified live: `hr3_audit_events` has a NOT NULL `action` column with NO
 * default (the operation is carried in the stable `<entity>.<verb>` format),
 * and a `reason` column the same shape. Both are written with the SAME
 * canonical string so the operation is consistently readable either way:
 *
 *   goal.created           goal was created
 *   goal.updated           goal fields/status were updated by HR admin
 *   goal.progress_updated  employee recorded progress
 *   goal.submitted         employee submitted for completion
 *   goal.completed         HR admin moved pending_completion → completed
 *   checkin.created        check-in was created
 *   checkin.message_posted a conversation message/reply was posted to a check-in
 *   checkin.acknowledged   the subject employee acknowledged a check-in
 *   appraisal.created      appraisal record was created (state: draft)
 *   appraisal.self_assessment_submitted   employee moved draft → self_assessment
 *   appraisal.manager_assessment_submitted reviewer moved self_assessment → manager_assessment
 *   appraisal.finalized    reviewer moved manager_assessment → finalized
 *   appraisal.acknowledged employee moved finalized → acknowledged
 *   cycle.created          performance cycle created (state: draft)
 *   cycle.opened           draft cycle opened (status → open)
 *   cycle.stage_advanced   cycle advanced exactly one stage
 *   cycle.closed           cycle closed (finalization → closed)
 *   competency.created     competency library entry created
 *   competency.updated     competency library fields edited
 *   position_competency.created    competency assigned required to a position
 *   position_competency.updated    required level of a position requirement changed
 *   employee_competency.assessed   employee competency assessment recorded
 *   course.created         training course created
 *   course.updated         training course fields edited
 *   course_enrollment.created     employee enrolled in a course
 *   course_enrollment.updated     course enrollment progress/status/completion changed
 *   training_session.created      training session created
 *   training_session.updated      training session fields edited
 *   training_enrollment.created   employee enrolled in a training session
 *   training_enrollment.updated   session approval/attendance updated
 *   training_evaluation.created   employee submitted a session evaluation
 *   certification.created         certification issued to an employee
 *   critical_position.created     critical position added to succession plan
 *   critical_position.updated     critical position risk/reason edited
 *   critical_position.deleted     critical position removed from succession plan
 *   succession_candidate.added    employee marked as successor to a position
 *   succession_candidate.updated  candidate readiness/ratings/notes edited
 *   succession_candidate.removed  candidate removed from a critical position
 *   recognition.created           employee recognition posted
 *   badge.created                 badge library entry created
 *   badge.updated                 badge library fields edited
 *   badge.deleted                 badge library entry removed (only when unused)
 *   points.awarded                employee point balance set or adjusted
 *   redemption.created            reward redemption requested
 *   redemption.updated            redemption status/description changed
 *
 * Recognition is create-only (historical record; schema has no updated_at or
 * status columns), so no recognition.update/approve/reject events exist. Badge
 * assignment happens by attaching `badge_id` to a recognition (no separate
 * assignment table), so no badge.assign event exists. Points are not linked to
 * recognitions/redemptions by any trigger, so only the explicit set/adjust
 * balance mutation is recorded.
 *
 * Also recorded on the existing `action` column (required by the live schema)
 * with the identical value.
 *
 * ENTITY TYPE CONVENTION
 * ----------------------
 *   goal      → `hr3_performance_goals` row (entity_id = goal.id)
 *   check_in  → `hr3_performance_feedback` row with feedback_type='check_in'
 *               (entity_id = feedback.id)
 *   appraisal → `hr3_performance_appraisals` row (entity_id = appraisal.id)
 *   performance_cycle → `hr3_performance_cycles` row (entity_id = cycle.id)
 *   competency → `hr3_competencies` row (entity_id = competency.id)
 *   position_competency → `hr3_position_competency_requirements` row
 *               (entity_id = the position↔competency assignment row id)
 *   employee_competency → `hr3_employee_competency_scores` row
 *               (entity_id = the assessment row id)
 *   critical_position → `hr3_critical_positions` row
 *               (entity_id = the critical position row id)
 *   succession_candidate → `hr3_succession_candidates` row
 *               (entity_id = the candidate row id)
 *   recognition → `hr3_recognitions` row (entity_id = the recognition id)
 *   badge → `hr3_badges` row (entity_id = the badge id)
 *   employee_points → `hr3_employee_points` row
 *               (entity_id = the balance row id)
 *   reward_redemption → `hr3_reward_redemptions` row
 *               (entity_id = the redemption id)
 *
 * ATOMICITY LIMITATION
 * --------------------
 * The business mutation and the audit insert are two separate PostgREST calls
 * with no shared transaction (the PerDev layer has no RPC/transaction
 * abstraction). This helper therefore cannot make them atomic. Callers MUST run
 * the business mutation first and, if this helper returns a failure response,
 * surface it instead of reporting success — the write has happened but its
 * required attribution is unverified. See each domain caller.
 */

/** Canonical audit reason values. */
export const PERFORMANCE_AUDIT_REASON = {
  goalCreated: "goal.created",
  goalUpdated: "goal.updated",
  goalProgressUpdated: "goal.progress_updated",
  goalSubmitted: "goal.submitted",
  goalCompleted: "goal.completed",
  checkInCreated: "checkin.created",
  checkInMessagePosted: "checkin.message_posted",
  checkInAcknowledged: "checkin.acknowledged",
  appraisalCreated: "appraisal.created",
  appraisalSelfAssessmentSubmitted: "appraisal.self_assessment_submitted",
  appraisalManagerAssessmentSubmitted: "appraisal.manager_assessment_submitted",
  appraisalFinalized: "appraisal.finalized",
  appraisalAcknowledged: "appraisal.acknowledged",
  appraisalSelfAssessmentStarted: "appraisal.self_assessment_started",
  appraisalEvaluatorReassigned: "appraisal.evaluator_reassigned",
  cycleCreated: "cycle.created",
  cycleOpened: "cycle.opened",
  cycleStageAdvanced: "cycle.stage_advanced",
  cycleClosed: "cycle.closed",
  competencyCreated: "competency.created",
  competencyUpdated: "competency.updated",
  positionCompetencyCreated: "position_competency.created",
  positionCompetencyUpdated: "position_competency.updated",
  employeeCompetencyAssessed: "employee_competency.assessed",
  courseCreated: "course.created",
  courseUpdated: "course.updated",
  courseEnrollmentCreated: "course_enrollment.created",
  courseEnrollmentUpdated: "course_enrollment.updated",
  trainingSessionCreated: "training_session.created",
  trainingSessionUpdated: "training_session.updated",
  trainingEnrollmentCreated: "training_enrollment.created",
  trainingEnrollmentUpdated: "training_enrollment.updated",
  trainingEvaluationCreated: "training_evaluation.created",
  certificationCreated: "certification.created",
  criticalPositionCreated: "critical_position.created",
  criticalPositionUpdated: "critical_position.updated",
  criticalPositionDeleted: "critical_position.deleted",
  successionCandidateAdded: "succession_candidate.added",
  successionCandidateUpdated: "succession_candidate.updated",
  successionCandidateRemoved: "succession_candidate.removed",
  recognitionCreated: "recognition.created",
  badgeCreated: "badge.created",
  badgeUpdated: "badge.updated",
  badgeDeleted: "badge.deleted",
  pointsAwarded: "points.awarded",
  redemptionCreated: "redemption.created",
  redemptionUpdated: "redemption.updated",
  devPlanItemCreated: "development_plan_item.created",
  devPlanItemUpdated: "development_plan_item.updated",
  devPlanItemDeleted: "development_plan_item.deleted",
} as const;

export type PerformanceAuditReason =
  (typeof PERFORMANCE_AUDIT_REASON)[keyof typeof PERFORMANCE_AUDIT_REASON];

/** Canonical audit entity_type values. */
export const PERFORMANCE_AUDIT_ENTITY_TYPE = {
  goal: "goal",
  checkIn: "check_in",
  appraisal: "appraisal",
  performanceCycle: "performance_cycle",
  competency: "competency",
  positionCompetency: "position_competency",
  employeeCompetency: "employee_competency",
  course: "course",
  courseEnrollment: "course_enrollment",
  trainingSession: "training_session",
  trainingEnrollment: "training_enrollment",
  trainingEvaluation: "training_evaluation",
  certification: "certification",
  criticalPosition: "critical_position",
  successionCandidate: "succession_candidate",
  recognition: "recognition",
  badge: "badge",
  employeePoints: "employee_points",
  rewardRedemption: "reward_redemption",
  developmentPlanItem: "development_plan_item",
} as const;

export type PerformanceAuditEntityType =
  (typeof PERFORMANCE_AUDIT_ENTITY_TYPE)[keyof typeof PERFORMANCE_AUDIT_ENTITY_TYPE];

/**
 * The audit-relevant slice of an actor. Kept deliberately small: account
 * identity is required for attribution, linked employee identity is carried as
 * context. Derive it from the already-resolved identity/actor — never from the
 * client.
 *
 * `actorType` stays HR-admin-centric ("hr_admin" | "employee") for backwards
 * compatibility with existing audit consumers; Manager accounts attribute to
 * "employee" (a manager is also an employee record). `actorId` is the
 * authenticated account id: `hr_admin.id` for HR Admin accounts, and the
 * `hr1_employees.id` for Manager/Employee accounts.
 */
export type AuditActorRef = {
  actorType: "hr_admin" | "employee";
  actorId: string;
  employeeUuid: string | null;
  employeeIdNumber: string | null;
};

/**
 * Minimal shape shared by the PerDev identity objects already resolved
 * server-side through `getAuthenticatedActor()`.
 */
export type AuditIdentityRef = {
  hrAdminId: string | null;
  accountType?: "hr_admin" | "manager" | "employee";
  employeeUuid?: string | null;
  employeeIdNumber?: string | null;
};

/**
 * Builds an audit actor from an already-resolved PerDev identity WITHOUT any
 * additional identity query. The identity was produced by the single resolver
 * chain (`getAuthenticatedActor()` via `requireHrEmployee`/`requireHrAdmin`),
 * so this neither reconstructs the hr_admin → employee mapping nor trusts
 * anything from the request.
 *
 * HR Admin accounts attribute with `actorId = hrAdmin.id`. Manager and
 * Employee accounts attribute as "employee" with `actorId` set to their
 * `hr1_employees.id` (never a client-supplied value).
 */
export function auditActorFromIdentity(
  identity: AuditIdentityRef,
): AuditActorRef {
  if (!identity.accountType || identity.accountType === "hr_admin") {
    return {
      actorType: "hr_admin",
      actorId: identity.hrAdminId ?? "",
      employeeUuid: identity.employeeUuid ?? null,
      employeeIdNumber: identity.employeeIdNumber ?? null,
    };
  }

  return {
    actorType: "employee",
    actorId: identity.employeeUuid ?? identity.hrAdminId ?? "",
    employeeUuid: identity.employeeUuid ?? null,
    employeeIdNumber: identity.employeeIdNumber ?? null,
  };
}

/**
 * Builds an audit actor from a full `PerDevActor` (used by session-level code
 * that already holds the abstraction). Kept separate so the two entry points
 * stay explicit.
 */
export function auditActorFromPerDevActor(actor: PerDevActor): AuditActorRef {
  if (actor.actorType === "hr_admin") {
    return {
      actorType: "hr_admin",
      actorId: actor.hrAdminId ?? "",
      employeeUuid: actor.employeeUuid,
      employeeIdNumber: actor.employeeIdNumber,
    };
  }

  return {
    actorType: "employee",
    actorId: actor.employeeUuid ?? actor.hrAdminId ?? "",
    employeeUuid: actor.employeeUuid,
    employeeIdNumber: actor.employeeIdNumber,
  };
}

export type InsertAuditEventInput = {
  actor: AuditActorRef;
  reason: PerformanceAuditReason;
  entityType: PerformanceAuditEntityType;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
};

/**
 * Inserts one audit event into `hr3_audit_events`.
 *
 * Returns `null` on success, or a NextResponse (500) on failure. The response
 * explicitly states that the business operation already completed but its audit
 * attribution was not recorded, so callers never silently claim full success.
 *
 * Only factual business fields belong in `oldData`/`newData`; callers pass
 * small explicit objects, never whole rows, secrets, tokens, or session data.
 */
export async function insertAuditEvent(
  input: InsertAuditEventInput,
): Promise<NextResponse | null> {
  const { error } = await supabaseAdmin.from("hr3_audit_events").insert({
    actor_type: input.actor.actorType,
    actor_id: input.actor.actorId,
    action: input.reason,
    entity_type: input.entityType,
    entity_id: input.entityId,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    reason: input.reason,
  });

  if (error) {
    console.error(
      `insertAuditEvent: audit insert failed for ${input.reason} on ${input.entityType} ${input.entityId}:`,
      error,
    );
    return NextResponse.json(
      {
        error:
          "Operation completed but its audit attribution could not be recorded. The change may have been applied; do not assume it was rejected without checking. Please contact an administrator.",
      },
      { status: 500 },
    );
  }

  return null;
}
