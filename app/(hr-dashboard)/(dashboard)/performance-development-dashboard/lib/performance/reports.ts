/**
 * Reports & Analytics service (server-only, HR-admin-only, read-only).
 *
 * Composes the existing PerDev list services and business-rule helpers into a
 * single organization-wide snapshot served at `GET /api/performance/reports`.
 *
 * - No writes, no audit events, no new tables, no migrations.
 * - Server-side authorization via `assertHrAdminScope()`.
 * - All independent reads are parallelized with `Promise.all` (one browser
 *   request total).
 * - Filters are SELECTION SCOPE ONLY and are never an authorization source.
 * - Reuses existing list services, scoring bands, status labels/tones and the
 *   dashboard current-cycle rule instead of duplicating business logic.
 */
import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import { chooseCurrentCycle } from "@/performance-development-dashboard/lib/performance/cycles";
import { listAppraisals } from "@/performance-development-dashboard/lib/performance/appraisals";
import { listPerformanceGoals, type PerformanceGoal } from "@/performance-development-dashboard/lib/performance/goals";
import { listCompetencies, listEmployeeCompetencies } from "@/performance-development-dashboard/lib/performance/competencies";
import {
  listCertifications,
  listCourseEnrollments,
  listCourses,
  listTrainingEnrollments,
  listTrainingEvaluations,
  listTrainingSessions,
} from "@/performance-development-dashboard/lib/performance/learning";
import { listCriticalPositions, listSuccessionCandidates } from "@/performance-development-dashboard/lib/performance/succession";
import { listBadges, listRecognitions, listRewardRedemptions } from "@/performance-development-dashboard/lib/performance/rewards";
import {
  APPRAISAL_STATUS_LABELS,
  LEGACY_APPRAISAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUSES,
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_RATING_BANDS,
  performanceRatingBandFromRank,
  performanceRatingBandFromScore,
  type Badge,
  type Competency,
  type CriticalPositionListItem,
  type EmployeeCompetencyProfileItem,
  type PerformanceAppraisal,
  type PerformanceReportsQuery,
  type PerformanceReportsSnapshot,
  type Recognition,
  type ReportBandDistribution,
  type ReportCompetencyGap,
  type ReportLabeledCount,
  type ReportRecentActivityItem,
} from "@/performance-development-dashboard/types";

type JobPositionRow = {
  id: string;
  title: string;
  department: string | null;
  is_active: boolean | null;
};

type EmployeeRow = {
  id: string;
  employee_id_number: string | null;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  job_position_id: string | null;
  status: string | null;
};

type AuditEventRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

type AuditQueryResult = {
  data?: AuditEventRow[] | null;
  error?: unknown;
};

type CycleRow = {
  id: string;
  name: string;
  status: string;
  stage: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filter-value validation. Returns the normalized value, `null` when the filter
 * was absent/empty (no filter applied), or a 400 `NextResponse` for malformed
 * input.
 */
function requireValidUuidFilter(
  value: unknown,
  field: string,
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return NextResponse.json(
      { error: `${field} must be a valid UUID.` },
      { status: 400 },
    );
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!UUID_PATTERN.test(trimmed)) {
    return NextResponse.json(
      { error: `${field} must be a valid UUID.` },
      { status: 400 },
    );
  }
  return trimmed.toLowerCase();
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return round(sum / values.length);
}

function toLabeled(map: Map<string, number>): ReportLabeledCount[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/* =====================================================================
 * Public API — called only from the API route.
 * ===================================================================== */

export async function getPerformanceReports(
  query: PerformanceReportsQuery,
): Promise<PerformanceReportsSnapshot | NextResponse> {
  const scope = await assertHrAdminScope();
  if (scope instanceof NextResponse) return scope;

  /* ---- 1. Parse + validate filters (selection scope only). ---------- */

  let department: string | null = null;
  if (
    query?.department !== undefined &&
    query?.department !== null &&
    typeof query.department === "string" &&
    query.department.trim() !== ""
  ) {
    department = query.department.trim();
  }

  const positionId = requireValidUuidFilter(query?.position_id, "position_id");
  if (positionId instanceof NextResponse) return positionId;

  const cycleId = requireValidUuidFilter(query?.cycle_id, "cycle_id");
  if (cycleId instanceof NextResponse) return cycleId;

  /* ---- 2. Parallel reference + domain reads. ------------------------ */

  const [
    employeeRows,
    positionRows,
    cycleRows,
    appraisalsResult,
    goalsResult,
    profileResult,
    competenciesResult,
    coursesResult,
    sessionsResult,
    courseEnrollmentsResult,
    trainingEnrollmentsResult,
    evaluationsResult,
    certificationsResult,
    criticalPositionsResult,
    candidatesResult,
    recognitionsResult,
    badgesResult,
    redemptionsResult,
    auditResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("hr1_employees")
      .select(
        "id, employee_id_number, first_name, last_name, department, job_position_id, status",
      )
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabaseAdmin
      .from("hr1_job_positions")
      .select("id, title, department, is_active")
      .order("title", { ascending: true }),
    supabaseAdmin
      .from("hr3_performance_cycles")
      .select(
        "id, name, period_start, period_end, status, stage, created_by, created_at, opened_at, closed_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    listAppraisals({}),
    listPerformanceGoals({}),
    listEmployeeCompetencies({}),
    listCompetencies({}),
    listCourses({}),
    listTrainingSessions({}),
    listCourseEnrollments({}),
    listTrainingEnrollments({}),
    listTrainingEvaluations({}),
    listCertifications({}),
    listCriticalPositions({}),
    listSuccessionCandidates({}),
    listRecognitions(),
    listBadges(),
    listRewardRedemptions(),
    supabaseAdmin
      .from("hr3_audit_events")
      .select("id, actor_id, action, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const results = [
    appraisalsResult,
    goalsResult,
    profileResult,
    competenciesResult,
    coursesResult,
    sessionsResult,
    courseEnrollmentsResult,
    trainingEnrollmentsResult,
    evaluationsResult,
    certificationsResult,
    criticalPositionsResult,
    candidatesResult,
    recognitionsResult,
    badgesResult,
    redemptionsResult,
  ] as (unknown | NextResponse)[];
  const failed = results.find((result) => result instanceof NextResponse);
  if (failed) return failed as NextResponse;

  if (employeeRows.error) {
    console.error("getPerformanceReports: employee query error:", employeeRows.error);
    return NextResponse.json(
      { error: "Failed to load employees." },
      { status: 500 },
    );
  }
  if (positionRows.error) {
    console.error("getPerformanceReports: position query error:", positionRows.error);
    return NextResponse.json(
      { error: "Failed to load job positions." },
      { status: 500 },
    );
  }
  if (cycleRows.error) {
    console.error("getPerformanceReports: cycle query error:", cycleRows.error);
    return NextResponse.json(
      { error: "Failed to load performance cycles." },
      { status: 500 },
    );
  }

  /* ---- 3. Reference maps + employee scope. -------------------------- */

  const employees = (employeeRows.data ?? []) as EmployeeRow[];
  const positions = (positionRows.data ?? []) as JobPositionRow[];
  const cycles = (cycleRows.data ?? []) as CycleRow[];

  const positionById = new Map(positions.map((position) => [position.id, position]));
  const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));

  if (positionId && !positionById.has(positionId)) {
    return NextResponse.json(
      { error: "position_id does not reference an existing job position." },
      { status: 400 },
    );
  }
  if (cycleId && !cycleById.has(cycleId)) {
    return NextResponse.json(
      { error: "cycle_id does not reference an existing performance cycle." },
      { status: 400 },
    );
  }

  let employeeScope: Set<string> | null = null;
  if (department || positionId) {
    const normalizedDepartment = department?.toLowerCase() ?? null;
    employeeScope = new Set(
      employees
        .filter((employee) => {
          if (
            normalizedDepartment &&
            (employee.department ?? "").trim().toLowerCase() !== normalizedDepartment
          ) {
            return false;
          }
          if (positionId && employee.job_position_id !== positionId) return false;
          return true;
        })
        .map((employee) => employee.id),
    );
  }

  const inScope = (employeeId: string | null | undefined): boolean => {
    if (!employeeId) return false;
    if (!employeeScope) return true;
    return employeeScope.has(employeeId);
  };

  /* ---- 4. Enrich + build the aggregate snapshot. -------------------- */

  const appraisals = appraisalsResult as PerformanceAppraisal[];
  const goals = goalsResult as PerformanceGoal[];
  const profileItems = profileResult as EmployeeCompetencyProfileItem[];
  const competencies = competenciesResult as Competency[];
  const courses = coursesResult as unknown[];
  const sessions = sessionsResult as unknown[];
  const criticalPositions = criticalPositionsResult as CriticalPositionListItem[];
  const badges = badgesResult as Badge[];

  const chosenCycle = chooseCurrentCycle(cycles);
  const currentCycle = chosenCycle
    ? {
        id: chosenCycle.id,
        name: chosenCycle.name,
        status: chosenCycle.status,
        stage: chosenCycle.stage ?? "closed",
      }
    : null;

  const snapshot: PerformanceReportsSnapshot = {
    generatedAt: new Date().toISOString(),
    filters: {
      department,
      positionId,
      positionTitle: positionId ? (positionById.get(positionId)?.title ?? null) : null,
      cycleId,
      cycleName: cycleId ? (cycleById.get(cycleId)?.name ?? null) : null,
    },
    currentCycle,
    filterOptions: {
      departments: [
        ...new Set(
          employees.map((employee) => employee.department).filter(Boolean),
        ),
      ].sort((a, b) => (a as string).localeCompare(b as string)) as string[],
      positions: positions.map((position) => ({
        id: position.id,
        title: position.title,
        isActive: position.is_active ?? false,
      })),
      cycles: cycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
      })),
    },
    performanceScores: scoreAppraisals({
      rows: appraisals,
      inScope,
      cycleId,
    }),
    goals: buildGoalsReport({
      goals,
      inScope,
      cycleId,
      employeesById,
      positionById,
      cycleById,
    }),
    competencies: buildCompetenciesReport({
      profileItems,
      inScope,
      competenciesById: new Map(competencies.map((competency) => [competency.id, competency])),
    }),
    learning: buildLearningReport({
      courses,
      sessions,
      courseEnrollments: courseEnrollmentsResult as unknown[],
      trainingEnrollments: trainingEnrollmentsResult as unknown[],
      evaluations: evaluationsResult as unknown[],
      certifications: certificationsResult as unknown[],
      inScope,
    }),
    succession: buildSuccessionReport({
      criticalPositions,
      candidates: candidatesResult as unknown[],
      department,
      positionId,
    }),
    recognition: buildRecognitionReport({
      recognitions: recognitionsResult as Recognition[],
      redemptions: redemptionsResult as unknown[],
      inScope,
      badgesById: new Map(badges.map((badge) => [badge.id, badge])),
    }),
    recentActivity: await resolveRecentActivity(auditResult),
  };

  return snapshot;
}

/* =====================================================================
 * Report section builders.
 * ===================================================================== */

function scoreAppraisals(input: {
  rows: PerformanceAppraisal[];
  inScope: (employeeId: string | null | undefined) => boolean;
  cycleId: string | null;
}): PerformanceReportsSnapshot["performanceScores"] {
  const scoped = input.rows.filter(
    (row) =>
      input.inScope(row.employee_id) &&
      (!input.cycleId || row.cycle_id === input.cycleId),
  );

  const totalAppraisals = scoped.length;

  const official = scoped.filter(
    (row) => row.status === "finalized" || row.status === "acknowledged",
  );
  const officiallyCompleted = official.length;

  const finalScores = official
    .map((row) => row.final_score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  const distribution: ReportBandDistribution[] = PERFORMANCE_RATING_BANDS.map(
    (band) => ({ key: band.key, label: band.label, rank: band.rank, count: 0 }),
  );

  for (const row of official) {
    let bandKey: (typeof PERFORMANCE_RATING_BANDS)[number]["key"] | null = null;
    if (typeof row.performance_rating === "number") {
      bandKey = performanceRatingBandFromRank(row.performance_rating)?.key ?? null;
    }
    if (!bandKey && typeof row.final_score === "number") {
      bandKey = performanceRatingBandFromScore(row.final_score)?.key ?? null;
    }
    if (bandKey) {
      const entry = distribution.find((item) => item.key === bandKey);
      if (entry) entry.count += 1;
    }
  }

  const statusCounts = new Map<string, number>();
  for (const row of scoped) {
    const status = row.status ?? "unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const byStatus: ReportLabeledCount[] = [...statusCounts.entries()].map(
    ([status, count]) => ({
      label:
        APPRAISAL_STATUS_LABELS[status as keyof typeof APPRAISAL_STATUS_LABELS] ??
        LEGACY_APPRAISAL_STATUS_LABELS[status] ??
        status,
      count,
    }),
  );

  return {
    totalAppraisals,
    officiallyCompleted,
    averageFinalScore: average(finalScores),
    completionRate:
      totalAppraisals === 0 ? null : round((officiallyCompleted / totalAppraisals) * 100),
    byStatus,
    distribution,
  };
}

function buildGoalsReport(input: {
  goals: PerformanceGoal[];
  inScope: (employeeId: string | null | undefined) => boolean;
  cycleId: string | null;
  employeesById: Map<string, EmployeeRow>;
  positionById: Map<string, JobPositionRow>;
  cycleById: Map<string, CycleRow>;
}): PerformanceReportsSnapshot["goals"] {
  const scoped = input.goals.filter(
    (goal) =>
      input.inScope(goal.employee_id) && (!input.cycleId || goal.cycle_id === input.cycleId),
  );

  const labelForStatus = PERFORMANCE_GOAL_STATUS_LABELS as Record<string, string>;

  const statusCounts = new Map<string, number>();
  for (const goal of scoped) {
    const status = goal.status ?? "unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const byStatus: ReportLabeledCount[] = [];
  for (const status of PERFORMANCE_GOAL_STATUSES) {
    byStatus.push({
      label: labelForStatus[status] ?? status,
      count: statusCounts.get(status) ?? 0,
    });
  }
  for (const status of statusCounts.keys()) {
    if (!PERFORMANCE_GOAL_STATUSES.includes(status as (typeof PERFORMANCE_GOAL_STATUSES)[number])) {
      byStatus.push({ label: labelForStatus[status] ?? status, count: statusCounts.get(status) ?? 0 });
    }
  }

  const progress = scoped
    .map((goal) => goal.progress_percent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const byDepartment = new Map<string, number>();
  const byPosition = new Map<string, number>();
  const byCycle = new Map<string, number>();

  for (const goal of scoped) {
    const employee = goal.employee_id
      ? input.employeesById.get(goal.employee_id)
      : undefined;

    const department = employee?.department?.trim() || "Unassigned";
    byDepartment.set(department, (byDepartment.get(department) ?? 0) + 1);

    const positionTitle = employee?.job_position_id
      ? (input.positionById.get(employee.job_position_id)?.title ?? "Unassigned")
      : "Unassigned";
    byPosition.set(positionTitle, (byPosition.get(positionTitle) ?? 0) + 1);

    const cycleName = goal.cycle_id
      ? (input.cycleById.get(goal.cycle_id)?.name ?? "Unassigned")
      : "Unassigned";
    byCycle.set(cycleName, (byCycle.get(cycleName) ?? 0) + 1);
  }

  return {
    totalGoals: scoped.length,
    byStatus,
    averageProgress: average(progress),
    byDepartment: toLabeled(byDepartment),
    byPosition: toLabeled(byPosition),
    byCycle: toLabeled(byCycle),
  };
}

function buildCompetenciesReport(input: {
  profileItems: EmployeeCompetencyProfileItem[];
  inScope: (employeeId: string | null | undefined) => boolean;
  competenciesById: Map<string, Competency>;
}): PerformanceReportsSnapshot["competencies"] {
  const scoped = input.profileItems.filter((item) => input.inScope(item.employee_id));

  const employeesAssessed = new Set(scoped.map((item) => item.employee_id)).size;

  const currentLevels = scoped
    .map((item) => item.current_level)
    .filter((value): value is number => typeof value === "number");

  const positiveGaps = scoped.filter((item) => item.gap !== null && item.gap > 0);

  const gapsByCompetencyMap = new Map<
    string,
    { competencyId: string; gaps: number[]; positive: number }
  >();
  for (const item of scoped) {
    if (item.gap === null) continue;
    let entry = gapsByCompetencyMap.get(item.competency_id);
    if (!entry) {
      entry = { competencyId: item.competency_id, gaps: [], positive: 0 };
      gapsByCompetencyMap.set(item.competency_id, entry);
    }
    entry.gaps.push(item.gap);
    if (item.gap > 0) entry.positive += 1;
  }

  const gapsByCompetency: ReportCompetencyGap[] = [
    ...gapsByCompetencyMap.values(),
  ]
    .filter((entry) => entry.positive > 0)
    .map((entry) => {
      const competency = input.competenciesById.get(entry.competencyId);
      return {
        competencyId: entry.competencyId,
        competencyName: competency?.name ?? "Unknown competency",
        category: competency?.category ?? null,
        positiveGapCount: entry.positive,
        averageGap: average(entry.gaps),
      };
    })
    .sort((a, b) => b.positiveGapCount - a.positiveGapCount);

  return {
    employeesAssessed,
    assessments: scoped.length,
    averageCurrentLevel: average(currentLevels),
    positiveGapCount: positiveGaps.length,
    hasAssessments: scoped.length > 0,
    hasPositiveGaps: positiveGaps.length > 0,
    gapsByCompetency,
  };
}

type CourseEnrollmentRow = {
  employee_id: string | null;
  status: string;
  completed_at: string | null;
};

type TrainingEnrollmentRow = {
  employee_id: string | null;
  approval_status: string;
  attendance_status: string | null;
};

type TrainingEvaluationRow = {
  employee_id: string | null;
  rating: number | null;
};

function buildLearningReport(input: {
  courses: unknown[];
  sessions: unknown[];
  courseEnrollments: unknown[];
  trainingEnrollments: unknown[];
  evaluations: unknown[];
  certifications: unknown[];
  inScope: (employeeId: string | null | undefined) => boolean;
}): PerformanceReportsSnapshot["learning"] {
  const courseRows = (input.courseEnrollments as CourseEnrollmentRow[]).filter((row) =>
    input.inScope(row.employee_id),
  );
  const enrolled = courseRows.filter((row) => row.status === "enrolled").length;
  const inProgress = courseRows.filter((row) => row.status === "in_progress").length;
  const completed = courseRows.filter((row) => row.status === "completed").length;

  const trainingRows = (input.trainingEnrollments as TrainingEnrollmentRow[]).filter(
    (row) => input.inScope(row.employee_id),
  );
  const pending = trainingRows.filter((row) => row.approval_status === "pending").length;
  const approved = trainingRows.filter((row) => row.approval_status === "approved").length;
  const rejected = trainingRows.filter((row) => row.approval_status === "rejected").length;
  const attended = trainingRows.filter((row) => row.attendance_status === "attended").length;
  const absent = trainingRows.filter((row) => row.attendance_status === "absent").length;

  const evaluationRows = (input.evaluations as TrainingEvaluationRow[]).filter((row) =>
    input.inScope(row.employee_id),
  );
  const rated = evaluationRows
    .map((row) => row.rating)
    .filter((rating): rating is number => typeof rating === "number");

  const certifications = (input.certifications as CourseEnrollmentRow[]).filter((row) =>
    input.inScope(row.employee_id),
  ).length;

  return {
    courses: input.courses.length,
    trainingSessions: input.sessions.length,
    courseEnrollments: {
      total: courseRows.length,
      enrolled,
      inProgress,
      completed,
      completionRate:
        courseRows.length === 0 ? null : round((completed / courseRows.length) * 100),
    },
    trainingEnrollments: {
      total: trainingRows.length,
      pending,
      approved,
      rejected,
      attended,
      absent,
    },
    trainingEvaluations: {
      total: evaluationRows.length,
      rated: rated.length,
      averageRating: average(rated),
    },
    certifications,
  };
}

function buildSuccessionReport(input: {
  criticalPositions: CriticalPositionListItem[];
  candidates: unknown[];
  department: string | null;
  positionId: string | null;
}): PerformanceReportsSnapshot["succession"] {
  const normalizedDepartment = input.department?.toLowerCase() ?? null;
  const scopedPositions = input.criticalPositions.filter((position) => {
    if (
      normalizedDepartment &&
      (position.positionDepartment ?? "").trim().toLowerCase() !== normalizedDepartment
    ) {
      return false;
    }
    if (input.positionId && position.position_id !== input.positionId) return false;
    return true;
  });

  const memberIds = new Set(scopedPositions.map((position) => position.id));
  const scopedCandidates = (
    input.candidates as {
      position_id: string | null;
      readiness_level: string;
      potential_rating: number | null;
    }[]
  ).filter((candidate) => candidate.position_id && memberIds.has(candidate.position_id));

  const riskCounts = new Map<string, number>();
  for (const position of scopedPositions) {
    const risk = position.risk_level?.trim() || "Unassigned";
    riskCounts.set(risk, (riskCounts.get(risk) ?? 0) + 1);
  }

  const readinessCounts = new Map<string, number>();
  for (const candidate of scopedCandidates) {
    const readiness = candidate.readiness_level?.trim() || "Unassigned";
    readinessCounts.set(readiness, (readinessCounts.get(readiness) ?? 0) + 1);
  }

  const potentialRatings = scopedCandidates
    .map((candidate) => candidate.potential_rating)
    .filter((rating): rating is number => typeof rating === "number");

  return {
    criticalPositionCount: scopedPositions.length,
    byRisk: toLabeled(riskCounts),
    candidateCount: scopedCandidates.length,
    candidatesPerPosition: scopedPositions.map((position) => ({
      label: position.positionTitle,
      count: position.candidateCount,
    })),
    readinessMix: toLabeled(readinessCounts),
    averagePotentialRating: average(potentialRatings),
  };
}

function buildRecognitionReport(input: {
  recognitions: Recognition[];
  redemptions: unknown[];
  inScope: (employeeId: string | null | undefined) => boolean;
  badgesById: Map<string, Badge>;
}): PerformanceReportsSnapshot["recognition"] {
  const scopedRecognition = input.recognitions.filter((row) =>
    input.inScope(row.recipient_id),
  );

  const pointsAwarded = scopedRecognition.reduce(
    (sum, row) => sum + (typeof row.points === "number" ? row.points : 0),
    0,
  );

  const byMonth = new Map<string, number>();
  for (const row of scopedRecognition) {
    const month = (row.created_at ?? "").slice(0, 7);
    if (month) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  const recognitionsByMonth = [...byMonth.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const badgeCounts = new Map<string, number>();
  for (const row of scopedRecognition) {
    if (!row.badge_id) continue;
    badgeCounts.set(row.badge_id, (badgeCounts.get(row.badge_id) ?? 0) + 1);
  }
  const badgeUsage = [...badgeCounts.entries()]
    .map(([badgeId, usageCount]) => ({
      badgeId,
      badgeName: input.badgesById.get(badgeId)?.name ?? "Unknown badge",
      usageCount,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);

  const scopedRedemptions = (
    input.redemptions as {
      employee_id: string | null;
      status: string | null;
    }[]
  ).filter((row) => input.inScope(row.employee_id));

  const redemptionCounts = new Map<string, number>();
  for (const row of scopedRedemptions) {
    const status = row.status?.trim() || "Unassigned";
    redemptionCounts.set(status, (redemptionCounts.get(status) ?? 0) + 1);
  }

  return {
    recognitionCount: scopedRecognition.length,
    pointsAwarded,
    recognitionsByMonth,
    badgeUsage,
    redemptionTotal: scopedRedemptions.length,
    redemptionsByStatus: toLabeled(redemptionCounts),
  };
}

async function resolveRecentActivity(
  result: AuditQueryResult,
): Promise<ReportRecentActivityItem[]> {
  const events = (result?.data ?? []) as AuditEventRow[];
  if (events.length === 0) return [];

  const actorIds = [
    ...new Set(events.map((event) => event.actor_id).filter(Boolean)),
  ] as string[];

  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", actorIds);
    if (error) {
      console.error("getPerformanceReports: actor name lookup error:", error);
    } else {
      for (const admin of data ?? []) {
        if (admin?.id && admin.full_name) names.set(admin.id, admin.full_name);
      }
    }
  }

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entity_type,
    entityId: event.entity_id,
    createdAt: event.created_at,
    actorName: event.actor_id ? (names.get(event.actor_id) ?? null) : null,
  }));
}