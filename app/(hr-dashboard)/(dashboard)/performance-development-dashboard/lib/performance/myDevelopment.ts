/**
 * My Development — employee self-scope read-only aggregation service.
 *
 * Server-authoritative "own data only" composition for the future Employee
 * My Development experience. The function accepts NO employee identity: the
 * subject is always derived from the authenticated actor, so IDOR is
 * impossible by construction (there is no identifier to tamper with).
 *
 * Scope policy (mirrors every existing dual-mode loader):
 * - Employee / Manager: the actor's OWN hr1 employee UUID. Managers receive
 *   their own development data only — never direct-report or team data.
 * - PerDev HR Admin: own linked-employee profile only (loaders are called
 *   with an explicit own-employee filter so their org-wide branch can never
 *   engage); denied when no linked employee identity exists. This endpoint
 *   is not a replacement for the HR Development Profile.
 * - Non-PerDev HR admin: denied (403), matching all existing PerDev policy.
 * - Unauthenticated: the actor resolver's own 401/403 passes through.
 *
 * Included sources (all read-only; zero writes, zero audit rows):
 * - Development Actions: own `hr3_performance_development_plan_items` rows
 *   reached per-appraisal through the scoped `listDevPlanItems` (which
 *   re-authorizes each appraisal), restricted to `finalized`/`acknowledged`
 *   appraisals so in-flight appraisal work never leaks into history.
 * - Competencies: own profile via `listEmployeeCompetencies` (gap/required
 *   levels as computed by the existing model; nothing invented).
 * - Learning: own enrollments via the dual-mode L&D loaders (self-scope
 *   forced server-side) plus catalog reads for display labels.
 * - Certifications: own rows via `listCertifications`.
 *
 * Never included: succession/Candidates, other employees, HR account
 * attribution, approver identities, assessor identities.
 */

import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  getAuthenticatedActor,
} from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { listAppraisals } from "@/performance-development-dashboard/lib/performance/appraisals";
import {
  listCompetencies,
  listEmployeeCompetencies,
} from "@/performance-development-dashboard/lib/performance/competencies";
import { listDevPlanItems } from "@/performance-development-dashboard/lib/performance/developmentPlanItems";
import {
  listCertifications,
  listCourseEnrollments,
  listCourses,
  listTrainingEnrollments,
  listTrainingSessions,
} from "@/performance-development-dashboard/lib/performance/learning";
import { FORBIDDEN_RESPONSE } from "@/performance-development-dashboard/lib/performance/validation";
import type {
  DevelopmentActionItem,
  MyDevelopmentCertification,
  MyDevelopmentCompetency,
  MyDevelopmentCourseEnrollment,
  MyDevelopmentData,
  MyDevelopmentTrainingEnrollment,
} from "@/performance-development-dashboard/types";

/** Appraisal lifecycle states whose development actions count as history. */
const HISTORICAL_APPRAISAL_STATUSES = ["finalized", "acknowledged"] as const;

export async function getMyDevelopment(): Promise<
  MyDevelopmentData | NextResponse
> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const isPerDevHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  // Non-PerDev HR admin: explicit denial, never an employee fallback.
  if (actor.actorType === "hr_admin" && !isPerDevHrAdmin) {
    return FORBIDDEN_RESPONSE();
  }

  // The ONLY subject: the actor's own linked employee. Managers, employees,
  // and PerDev HR admins with a linked identity all resolve here; HR admins
  // without one have no own profile to return.
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }
  const subjectId = actor.employeeUuid;

  // PerDev HR admins must pass an explicit own-employee filter: called
  // without one, the dual-mode loaders below would take their org-wide
  // branch. Non-HR callers pass nothing and the loaders force own scope.
  const ownFilter: { employee_id?: string } = isPerDevHrAdmin
    ? { employee_id: subjectId }
    : {};

  const [
    appraisalsResult,
    profileResult,
    competencyCatalogResult,
    courseEnrollmentResult,
    courseCatalogResult,
    trainingEnrollmentResult,
    sessionCatalogResult,
    certificationResult,
  ] = await Promise.all([
    listAppraisals({}),
    listEmployeeCompetencies(ownFilter),
    listCompetencies({}),
    listCourseEnrollments(ownFilter),
    listCourses({}),
    listTrainingEnrollments(ownFilter),
    listTrainingSessions({}),
    listCertifications(ownFilter),
  ]);

  const failed = [
    appraisalsResult,
    profileResult,
    competencyCatalogResult,
    courseEnrollmentResult,
    courseCatalogResult,
    trainingEnrollmentResult,
    sessionCatalogResult,
    certificationResult,
  ].find((result) => result instanceof NextResponse);
  if (failed) return failed as NextResponse;

  // Narrow types after the guard. The appraisals list is scope-filtered by
  // role upstream, but the employee branch also returns rows where the actor
  // is evaluator — restrict to OWN rows here, then to finalized history.
  const ownHistoricalAppraisals = (
    appraisalsResult as Awaited<ReturnType<typeof listAppraisals>> as Array<{
      id: string;
      employee_id: string;
      review_period: string;
      status: string;
      cycle_id: string | null;
    }>
  ).filter(
    (appraisal) =>
      appraisal.employee_id === subjectId &&
      (
        HISTORICAL_APPRAISAL_STATUSES as readonly string[]
      ).includes(appraisal.status),
  );

  // Cycle names for the action source context (read-only lookup, own cycles
  // only — ids come from the already-filtered appraisal set).
  const cycleIds = [
    ...new Set(
      ownHistoricalAppraisals
        .map((appraisal) => appraisal.cycle_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const cycleNamesById = new Map<string, string>();
  if (cycleIds.length > 0) {
    const { data: cycles, error: cycleError } = await supabaseAdmin
      .from("hr3_performance_cycles")
      .select("id, name")
      .in("id", cycleIds);
    if (cycleError) {
      console.error("getMyDevelopment: cycle query error:", cycleError);
      return NextResponse.json(
        { error: "Failed to load My Development." },
        { status: 500 },
      );
    }
    for (const cycle of (cycles ?? []) as { id: string; name: string }[]) {
      cycleNamesById.set(cycle.id, cycle.name);
    }
  }

  // Per-appraisal scoped reads; each call re-authorizes the appraisal, and
  // every appraisal here is already own + finalized/acknowledged.
  const actionLists = await Promise.all(
    ownHistoricalAppraisals.map((appraisal) =>
      listDevPlanItems(appraisal.id),
    ),
  );
  const actionListFailure = actionLists.find(
    (result) => result instanceof NextResponse,
  );
  if (actionListFailure) return actionListFailure as NextResponse;

  const appraisalById = new Map(
    ownHistoricalAppraisals.map((appraisal) => [appraisal.id, appraisal]),
  );
  const developmentActions: DevelopmentActionItem[] = actionLists.flatMap(
    (items) =>
      (
        items as Awaited<ReturnType<typeof listDevPlanItems>> as Array<{
          id: string;
          appraisal_id: string;
          action: string;
          target: string;
          status: DevelopmentActionItem["status"];
          created_at: string;
          updated_at: string;
        }>
      ).map((item) => {
        const appraisal = appraisalById.get(item.appraisal_id);
        return {
          id: item.id,
          appraisal_id: item.appraisal_id,
          action: item.action,
          target: item.target,
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
          appraisalReviewPeriod: appraisal?.review_period ?? null,
          appraisalStatus: appraisal?.status ?? null,
          appraisalCycleName:
            (appraisal?.cycle_id &&
              cycleNamesById.get(appraisal.cycle_id)) ??
            null,
        };
      }),
  );
  developmentActions.sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );

  const competenciesById = new Map(
    (
      competencyCatalogResult as Awaited<
        ReturnType<typeof listCompetencies>
      > as Array<{ id: string; name: string; category: string | null }>
    ).map((competency) => [competency.id, competency]),
  );
  const competencies: MyDevelopmentCompetency[] = (
    profileResult as Awaited<
      ReturnType<typeof listEmployeeCompetencies>
    > as Array<{
      competency_id: string;
      current_level: number;
      effective_required_level: number | null;
      gap: number | null;
    }>
  )
    .map((item) => ({
      competencyId: item.competency_id,
      competencyName:
        competenciesById.get(item.competency_id)?.name ??
        "Unknown competency",
      competencyCategory:
        competenciesById.get(item.competency_id)?.category ?? null,
      currentLevel: item.current_level,
      effectiveRequiredLevel: item.effective_required_level,
      gap: item.gap,
    }))
    .sort((a, b) => a.competencyName.localeCompare(b.competencyName));

  const coursesById = new Map(
    (
      courseCatalogResult as Awaited<ReturnType<typeof listCourses>> as Array<{
        id: string;
        title: string;
        competency_id: string | null;
      }>
    ).map((course) => [course.id, course]),
  );
  const sessionsById = new Map(
    (
      sessionCatalogResult as Awaited<
        ReturnType<typeof listTrainingSessions>
      > as Array<{
        id: string;
        title: string;
        schedule_date: string | null;
        trainer_name: string | null;
        mode: string | null;
        venue: string | null;
        competency_id: string | null;
      }>
    ).map((session) => [session.id, session]),
  );

  const courseEnrollments: MyDevelopmentCourseEnrollment[] = (
    courseEnrollmentResult as Awaited<
      ReturnType<typeof listCourseEnrollments>
    > as Array<{
      id: string;
      course_id: string;
      progress_percent: number;
      status: string;
      enrolled_at: string;
      completed_at: string | null;
    }>
  )
    .slice()
    .sort((a, b) =>
      a.enrolled_at < b.enrolled_at ? 1 : a.enrolled_at > b.enrolled_at ? -1 : 0,
    )
    .map((enrollment) => {
      const course = coursesById.get(enrollment.course_id);
      const competency = course?.competency_id
        ? competenciesById.get(course.competency_id)
        : null;
      return {
        id: enrollment.id,
        courseId: enrollment.course_id,
        courseTitle: course?.title ?? null,
        competencyName: competency?.name ?? null,
        progressPercent: enrollment.progress_percent,
        status: enrollment.status,
        enrolledAt: enrollment.enrolled_at,
        completedAt: enrollment.completed_at,
      };
    });

  const trainingEnrollments: MyDevelopmentTrainingEnrollment[] = (
    trainingEnrollmentResult as Awaited<
      ReturnType<typeof listTrainingEnrollments>
    > as Array<{
      id: string;
      session_id: string;
      approval_status: string;
      attendance_status: string | null;
    }>
  )
    .slice()
    .sort((a, b) => {
      const aTitle = sessionsById.get(a.session_id)?.title ?? "";
      const bTitle = sessionsById.get(b.session_id)?.title ?? "";
      return aTitle.localeCompare(bTitle);
    })
    .map((enrollment) => {
      const session = sessionsById.get(enrollment.session_id);
      const competency = session?.competency_id
        ? competenciesById.get(session.competency_id)
        : null;
      return {
        id: enrollment.id,
        sessionId: enrollment.session_id,
        sessionTitle: session?.title ?? null,
        scheduleDate: session?.schedule_date ?? null,
        trainerName: session?.trainer_name ?? null,
        mode: session?.mode ?? null,
        venue: session?.venue ?? null,
        competencyName: competency?.name ?? null,
        approvalStatus: enrollment.approval_status,
        attendanceStatus: enrollment.attendance_status,
      };
    });

  const certifications: MyDevelopmentCertification[] = (
    certificationResult as Awaited<
      ReturnType<typeof listCertifications>
    > as Array<{
      id: string;
      course_id: string | null;
      certificate_url: string | null;
      issued_at: string;
      expires_at: string | null;
    }>
  )
    .slice()
    .sort((a, b) =>
      a.issued_at < b.issued_at ? 1 : a.issued_at > b.issued_at ? -1 : 0,
    )
    .map((certification) => ({
      id: certification.id,
      courseTitle: certification.course_id
        ? (coursesById.get(certification.course_id)?.title ?? null)
        : null,
      certificateUrl: certification.certificate_url,
      issuedAt: certification.issued_at,
      expiresAt: certification.expires_at,
    }));

  return {
    developmentActions,
    competencies,
    learning: { courseEnrollments, trainingEnrollments },
    certifications,
    summary: {
      // "Open": any action not in the terminal completed state.
      openDevelopmentActions: developmentActions.filter(
        (item) => item.status !== "completed",
      ).length,
      // "Gap": positive server-derived gap (same rule as the HR profile).
      competencyGaps: competencies.filter(
        (item) => item.gap !== null && item.gap > 0,
      ).length,
      // "In progress": course enrollments with no completion recorded
      // (completed_at null and no completed status — status is free text in
      // the DB, so both signals are required); training enrollments have no
      // progress/completion field, so approved sessions count as active.
      learningInProgress:
        courseEnrollments.filter(
          (enrollment) =>
            enrollment.completedAt === null &&
            enrollment.status !== "completed",
        ).length +
        trainingEnrollments.filter(
          (enrollment) => enrollment.approvalStatus === "approved",
        ).length,
      certifications: certifications.length,
    },
  };
}
