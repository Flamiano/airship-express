/**
 * Development Planning — read-only aggregation service.
 *
 * Composes existing read-only services into a single profile object, plus
 * two narrow identity lookups (employee row, job-position row). No mutations,
 * no audit events, no new tables.
 */

import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import { listCompetencies, listEmployeeCompetencies } from "@/performance-development-dashboard/lib/performance/competencies";
import { listPerformanceGoals } from "@/performance-development-dashboard/lib/performance/goals";
import {
  listCertifications,
  listCourseEnrollments,
  listCourses,
  listTrainingEnrollments,
  listTrainingSessions,
} from "@/performance-development-dashboard/lib/performance/learning";
import { listSuccessionCandidates } from "@/performance-development-dashboard/lib/performance/succession";
import type {
  Certification,
  Competency,
  Course,
  CourseEnrollment,
  DevelopmentActionItem,
  DevelopmentCertification,
  DevelopmentCourseEnrollment,
  DevelopmentEmployee,
  DevelopmentProfile,
  DevelopmentTrainingEnrollment,
  EmployeeCompetencyProfileItem,
  PerformanceGoal,
  SuccessionCandidateListItem,
  TrainingEnrollment,
  TrainingSession,
} from "@/performance-development-dashboard/types";

export type DevelopmentProfileQuery = { employee_id?: string | null };

/* -------------------------------------------------------------------------- */
/* Internal helpers (never exported)                                          */
/* -------------------------------------------------------------------------- */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireValidUuid(value: string, fieldName: string): string | NextResponse {
  if (!UUID_PATTERN.test(value)) {
    return NextResponse.json(
      { error: `Invalid ${fieldName} format. Expected a UUID.` },
      { status: 400 },
    );
  }
  return value;
}

async function loadEmployeeIdentity(
  employeeId: string,
): Promise<DevelopmentEmployee | NextResponse> {
  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, employee_id_number, first_name, last_name, department, job_position_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    console.error("[development] Failed to load employee identity:", employeeError);
    return NextResponse.json(
      { error: "Failed to load employee profile." },
      { status: 500 },
    );
  }

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  let jobPosition: string | null = null;
  if (employee.job_position_id) {
    const { data: position } = await supabaseAdmin
      .from("hr1_job_positions")
      .select("id, title")
      .eq("id", employee.job_position_id)
      .maybeSingle();
    jobPosition = position?.title ?? null;
  }

  return {
    id: employee.id,
    name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Unknown employee",
    employeeNumber: employee.employee_id_number ?? null,
    department: employee.department ?? null,
    jobPosition,
  };
}

/* -------------------------------------------------------------------------- */
/* Development actions (read-only appraisal follow-through)                */
/* -------------------------------------------------------------------------- */

type AppraisalContextRow = {
  id: string;
  review_period: string | null;
  status: string | null;
  cycle_id: string | null;
  created_at: string;
};

type DevActionRow = {
  id: string;
  appraisal_id: string;
  action: string;
  target: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/**
 * Loads the employee's appraisal development actions with their source
 * appraisal context (review period, status, cycle name) for the read-only
 * follow-through section of the HR Development Profile.
 *
 * HR scope only (the caller already enforces `assertHrAdminScope`). Reads the
 * same rows managed inside the appraisal workflow — including items on
 * finalized appraisals, which are historical records. Nothing is written, so
 * appraisal locking, scoring, and applicability snapshots are untouched.
 */
async function loadDevelopmentActions(
  employeeId: string,
): Promise<DevelopmentActionItem[] | NextResponse> {
  const { data: appraisals, error: appraisalError } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("id, review_period, status, cycle_id, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (appraisalError) {
    console.error("[development] Failed to load appraisals:", appraisalError);
    return NextResponse.json(
      { error: "Failed to load development actions." },
      { status: 500 },
    );
  }

  const appraisalRows = (appraisals ?? []) as AppraisalContextRow[];
  const appraisalById = new Map(appraisalRows.map((row) => [row.id, row]));

  const cycleIds = [
    ...new Set(
      appraisalRows
        .map((row) => row.cycle_id)
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
      console.error("[development] Failed to load cycles:", cycleError);
      return NextResponse.json(
        { error: "Failed to load development actions." },
        { status: 500 },
      );
    }
    for (const cycle of (cycles ?? []) as { id: string; name: string }[]) {
      cycleNamesById.set(cycle.id, cycle.name);
    }
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .select("id, appraisal_id, action, target, status, created_at, updated_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (itemsError) {
    console.error("[development] Failed to load development actions:", itemsError);
    return NextResponse.json(
      { error: "Failed to load development actions." },
      { status: 500 },
    );
  }

  return ((items ?? []) as DevActionRow[]).map((item) => {
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
        (appraisal?.cycle_id && cycleNamesById.get(appraisal.cycle_id)) ?? null,
    } as DevelopmentActionItem;
  });
}

/* -------------------------------------------------------------------------- */
/* Public API — called only from the API route                                */
/* -------------------------------------------------------------------------- */

export async function getDevelopmentProfile(
  query: DevelopmentProfileQuery,
): Promise<DevelopmentProfile | NextResponse> {
  const authResult = await assertHrAdminScope();
  if (authResult instanceof NextResponse) return authResult;

  const rawEmployeeId = query?.employee_id;
  if (rawEmployeeId === undefined || rawEmployeeId === null || rawEmployeeId === "") {
    return NextResponse.json(
      { error: "employee_id is required." },
      { status: 400 },
    );
  }

  const employeeId = requireValidUuid(rawEmployeeId, "employee_id");
  if (employeeId instanceof NextResponse) return employeeId;

  const employee = await loadEmployeeIdentity(employeeId);
  if (employee instanceof NextResponse) return employee;

  // Parallel fetches — all read-only; each re-authorises internally (HR scope).
  const [
    profileResult,
    competencyResult,
    courseResult,
    courseEnrollmentResult,
    sessionResult,
    trainingEnrollmentResult,
    certificationResult,
    goalResult,
    candidateResult,
  ] = await Promise.all([
    listEmployeeCompetencies({ employee_id: employeeId }),
    listCompetencies({}),
    listCourses({}),
    listCourseEnrollments({ employee_id: employeeId }),
    listTrainingSessions({}),
    listTrainingEnrollments({ employee_id: employeeId }),
    listCertifications({ employee_id: employeeId }),
    listPerformanceGoals({ employee_id: employeeId }),
    listSuccessionCandidates({}),
  ]);

  // If any downstream service returned an error response, surface it directly.
  const failed = [
    profileResult,
    competencyResult,
    courseResult,
    courseEnrollmentResult,
    sessionResult,
    trainingEnrollmentResult,
    certificationResult,
    goalResult,
    candidateResult,
  ].find((result) => result instanceof NextResponse);
  if (failed) return failed as NextResponse;

  // Narrow types after the guard.
  const profileItems = profileResult as EmployeeCompetencyProfileItem[];
  const competencies = competencyResult as Competency[];
  const courses = courseResult as Course[];
  const courseEnrollments = courseEnrollmentResult as CourseEnrollment[];
  const sessions = sessionResult as TrainingSession[];
  const trainingEnrollments = trainingEnrollmentResult as TrainingEnrollment[];
  const certifications = certificationResult as Certification[];
  const goals = goalResult as PerformanceGoal[];
  const candidates = candidateResult as SuccessionCandidateListItem[];

  const competenciesById = new Map(competencies.map((c) => [c.id, c]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  const developmentNeeds = profileItems
    .filter((item) => item.gap !== null && item.gap > 0)
    .map((item) => {
      const competency = competenciesById.get(item.competency_id);
      return {
        competencyId: item.competency_id,
        competencyName: competency?.name ?? "Unknown competency",
        competencyCategory: competency?.category ?? null,
        currentLevel: item.current_level,
        effectiveRequiredLevel: item.effective_required_level,
        gap: item.gap as number,
      };
    })
    .sort((a, b) => a.competencyName.localeCompare(b.competencyName));

  const developmentCourseEnrollments = courseEnrollments
    .slice()
    .sort((a, b) => a.enrolled_at.localeCompare(b.enrolled_at))
    .map((enrollment): DevelopmentCourseEnrollment => {
      const course = coursesById.get(enrollment.course_id);
      const competency = course?.competency_id
        ? competenciesById.get(course.competency_id)
        : null;
      return {
        ...enrollment,
        courseTitle: course?.title ?? null,
        competencyName: competency?.name ?? null,
      };
    });

  const developmentTrainingEnrollments = trainingEnrollments
    .slice()
    .sort((a, b) => {
      const aTitle = sessionsById.get(a.session_id)?.title ?? "";
      const bTitle = sessionsById.get(b.session_id)?.title ?? "";
      return aTitle.localeCompare(bTitle);
    })
    .map((enrollment): DevelopmentTrainingEnrollment => {
      const session = sessionsById.get(enrollment.session_id);
      const competency = session?.competency_id
        ? competenciesById.get(session.competency_id)
        : null;
      return {
        ...enrollment,
        sessionTitle: session?.title ?? null,
        scheduleDate: session?.schedule_date ?? null,
        trainerName: session?.trainer_name ?? null,
        mode: session?.mode ?? null,
        venue: session?.venue ?? null,
        competencyName: competency?.name ?? null,
      };
    });

  const developmentCertifications = certifications
    .slice()
    .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
    .map((certification): DevelopmentCertification => {
      const course = certification.course_id
        ? coursesById.get(certification.course_id)
        : null;
      return { ...certification, courseTitle: course?.title ?? null };
    });

  const candidatesForEmployee = candidates.filter(
    (candidate) => candidate.employee_id === employeeId,
  );

  const succession =
    candidatesForEmployee.length > 0
      ? {
          isCandidate: true as const,
          developmentNotes: candidatesForEmployee[0].development_notes ?? null,
        }
      : null;

  const developmentActions = await loadDevelopmentActions(employeeId);
  if (developmentActions instanceof NextResponse) return developmentActions;

  return {
    employee,
    developmentNeeds,
    developmentActions,
    learning: {
      courseEnrollments: developmentCourseEnrollments,
      trainingEnrollments: developmentTrainingEnrollments,
      certifications: developmentCertifications,
    },
    goals,
    succession,
  };
}
