/**
 * Performance Development Dashboard service (server-only).
 *
 * Aggregates lightweight reads from the existing PerDev tables into a single
 * snapshot served at `GET /api/performance/dashboard`.
 *
 * Actor-aware:
 *   - HR Admin: org-wide snapshot (existing behavior)
 *   - Manager: scoped to self + active direct reports
 *   - Employee: scoped to own records only
 *
 * `recentActivity` is HR-Admin-only. Manager and Employee dashboards
 * intentionally return an empty `recentActivity` array to avoid exposing
 * audit event details or HR Admin account names.
 *
 * Read-only: no writes, no migrations. All queries run in parallel where
 * independent.
 */
import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { selectAll, chunkedIn } from "@/performance-development-dashboard/lib/performance/serverUtils";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { chooseCurrentCycle } from "@/performance-development-dashboard/lib/performance/cycles";

type StatusRow = { status: string | null };
type AppraisalIdRow = { appraisal_id: string | null };
type CycleRow = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  stage: string;
};
type AuditEventRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

export type DashboardStatusBreakdown = {
  total: number;
  byStatus: Record<string, number>;
};

export type DashboardCurrentCycle = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  stage: string;
} | null;

export type DashboardActionItems = {
  goalsPendingCompletion: number;
  appraisalsAwaitingSelfAssessment: number;
  appraisalsAwaitingManagerAssessment: number;
  appraisalsAwaitingFinalization: number;
  redemptionsPending: number;
  trainingEnrollmentsPending: number;
};

export type DashboardRecentActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
};

export type DirectReportSummary = {
  employeeUuid: string;
  name: string;
  employeeIdNumber: string | null;
  department: string | null;
  goalsTotal: number;
  goalsCompleted: number;
  appraisalStatus: string | null;
  latestCheckIn: string | null;
};

export type PerformanceDashboardSnapshot = {
  generatedAt: string;
  actorType: "hr_admin" | "manager" | "employee";
  currentCycle: DashboardCurrentCycle;
  cycles: DashboardStatusBreakdown;
  actionItems: DashboardActionItems;
  goals: DashboardStatusBreakdown;
  appraisals: DashboardStatusBreakdown;
  competencyAndDevelopment: {
    competencies: number;
    positionRequirements: number | null;
    employeesAssessed: number;
    courses: number | null;
    trainingSessions: number | null;
    activeCourseEnrollments: number;
    certifications: number;
  };
  successionAndRecognition: {
    criticalPositions: number | null;
    successionCandidates: number | null;
    recognitions: number;
    badges: number | null;
    recognitionPoints: number;
    redemptionsPending: number;
  };
  recentActivity: DashboardRecentActivityItem[];
  directReports: DirectReportSummary[];
};

export type PerformanceDashboardResult =
  | PerformanceDashboardSnapshot
  | NextResponse;

async function requireRows<T>(
  label: string,
  run: () => PromiseLike<{ data?: T | null; error?: unknown }>
): Promise<T> {
  const { data, error } = await run();
  if (error) {
    console.error(`getPerformanceDashboard: ${label} error:`, error);
    throw new Error(label);
  }
  return data as T;
}

async function requireCount(
  label: string,
  run: () => PromiseLike<{ count?: number | null; error?: unknown }>
): Promise<number> {
  const { count, error } = await run();
  if (error) {
    console.error(`getPerformanceDashboard: ${label} error:`, error);
    throw new Error(label);
  }
  return count ?? 0;
}

function breakdown(rows: StatusRow[]): DashboardStatusBreakdown {
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    const status = row.status ?? "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { total: rows.length, byStatus };
}

async function resolveActorNames(
  events: AuditEventRow[]
): Promise<Map<string, string>> {
  const actorIds = [
    ...new Set(events.map((event) => event.actor_id).filter(Boolean)),
  ] as string[];

  if (actorIds.length === 0) return new Map();

  const names = new Map<string, string>();
  const adminBatches = await chunkedIn(actorIds, 100, async (chunk) => {
    const { data, error } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", chunk);
    if (error) {
      console.error("getPerformanceDashboard: actor names error:", error);
      return [];
    }
    return data ?? [];
  });

  for (const admin of adminBatches.flat()) {
    if (admin?.full_name) names.set(admin.id, admin.full_name);
  }
  return names;
}

/**
 * Builds direct-report summaries for a Manager. Each summary includes the
 * direct report's name, goal completion stats, current appraisal status, and
 * latest check-in date.
 */
async function buildDirectReportSummaries(
  managerUuid: string,
  directReportIds: string[]
): Promise<DirectReportSummary[]> {
  if (directReportIds.length === 0) return [];

  const allIds = [managerUuid, ...directReportIds];

  const [employeesResult, goalsResult, appraisalsResult, checkInsResult] =
    await Promise.all([
      supabaseAdmin
        .from("hr1_employees")
        .select("id, first_name, last_name, employee_id_number, department")
        .in("id", allIds),
      supabaseAdmin
        .from("hr3_performance_goals")
        .select("employee_id, status")
        .in("employee_id", allIds),
      supabaseAdmin
        .from("hr3_performance_appraisals")
        .select("employee_id, status, created_at, id")
        .in("employee_id", allIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      supabaseAdmin
        .from("hr3_performance_feedback")
        .select("employee_id, created_at")
        .eq("feedback_type", "check_in")
        .in("employee_id", allIds)
        .order("created_at", { ascending: false }),
    ]);

  const employees = employeesResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const appraisals = appraisalsResult.data ?? [];
  const checkIns = checkInsResult.data ?? [];

  // Index goals by employee
  const goalsByEmployee = new Map<
    string,
    { total: number; completed: number }
  >();
  for (const goal of goals) {
    const eid = goal.employee_id;
    if (!goalsByEmployee.has(eid)) goalsByEmployee.set(eid, { total: 0, completed: 0 });
    const entry = goalsByEmployee.get(eid)!;
    entry.total++;
    if (goal.status === "completed") entry.completed++;
  }

  // Index latest appraisal by employee (query ordered by created_at DESC, id DESC)
  const appraisalByEmployee = new Map<string, string>();
  for (const app of appraisals) {
    // First occurrence per employee is the most recent due to ordering
    if (!appraisalByEmployee.has(app.employee_id)) {
      appraisalByEmployee.set(app.employee_id, app.status ?? "unknown");
    }
  }

  // Index latest check-in by employee
  const checkInByEmployee = new Map<string, string>();
  for (const ci of checkIns) {
    if (!checkInByEmployee.has(ci.employee_id)) {
      checkInByEmployee.set(ci.employee_id, ci.created_at);
    }
  }

  const summaries: DirectReportSummary[] = [];
  for (const emp of employees) {
    const isManager = emp.id === managerUuid;
    const goalStats = goalsByEmployee.get(emp.id) ?? { total: 0, completed: 0 };
    const fullName = [emp.first_name, emp.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    summaries.push({
      employeeUuid: emp.id,
      name: fullName || "Unknown",
      employeeIdNumber: emp.employee_id_number ?? null,
      department: emp.department ?? null,
      goalsTotal: goalStats.total,
      goalsCompleted: goalStats.completed,
      appraisalStatus: appraisalByEmployee.get(emp.id) ?? null,
      latestCheckIn: checkInByEmployee.get(emp.id) ?? null,
    });
  }

  // Sort: direct reports first (not manager), then alphabetical
  summaries.sort((a, b) => {
    if (a.employeeUuid === managerUuid) return -1;
    if (b.employeeUuid === managerUuid) return 1;
    return a.name.localeCompare(b.name);
  });

  return summaries;
}

/**
 * Applies an employee-scope filter to a Supabase query builder. When
 * `employeeIds` is provided, adds `.in("employee_id", employeeIds)`. When null,
 * no filter is added (org-wide).
 */
function scopedQuery<T extends { in: Function; eq: Function }>(
  query: T,
  field: string,
  employeeIds: string[] | null
): T {
  if (!employeeIds) return query;
  if (employeeIds.length === 0) {
    // Never-match sentinel: an empty array means the caller has no employee
    // scope, so we must not leak org-wide data. Filtering on an impossible
    // UUID guarantees zero rows are returned.
    return query.eq(field, "00000000-0000-0000-0000-000000000000") as T;
  }
  if (employeeIds.length === 1) {
    return query.eq(field, employeeIds[0]) as T;
  }
  return query.in(field, employeeIds) as T;
}

export async function getPerformanceDashboard(): Promise<PerformanceDashboardResult> {
  // --- Actor resolution ---
  // Single source of truth: getAuthenticatedActor() resolves HR Admin,
  // Manager, or Employee in one call with no spurious console.error on
  // expected non-admin paths.
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const actorType = actor.actorType;
  const employeeUuid = actor.employeeUuid;

  let directReportIds: string[] | null = null;
  if (actorType === "manager" && employeeUuid) {
    directReportIds = await resolveManagerDirectReportUuids(employeeUuid);
  }

  const isHrAdmin = actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  // For Manager/Employee, the scoped employee ID list = self + (direct reports).
  // For HR Admin, null = org-wide.
  let scopedEmployeeIds: string[] | null = null;
  if (!isHrAdmin) {
    // HR admin with a non-PerDev role: reject.
    if (actorType === "hr_admin") {
      return NextResponse.json(
        { error: "Forbidden - This account does not have access to this dashboard" },
        { status: 403 }
      );
    }
    if (!employeeUuid) {
      return NextResponse.json(
        { error: "Forbidden - no linked employee identity" },
        { status: 403 }
      );
    }
    scopedEmployeeIds = [employeeUuid, ...(directReportIds ?? [])];
  }

  try {
    const [
      cycles,
      goalStatusRows,
      appraisalStatusRows,
      appraisalGoalResultRows,
      competencyCount,
      requirementCount,
      scoreEmployeeRows,
      courseCount,
      sessionCount,
      courseEnrollStatusRows,
      certificationCount,
      criticalPositionCount,
      successionCandidateCount,
      recognitionCount,
      badgeCount,
      recognitionPointRows,
      redemptionStatusRows,
      trainingApprovalRows,
    ] = await Promise.all([
      requireRows<CycleRow[]>("cycles", () =>
        supabaseAdmin
          .from("hr3_performance_cycles")
          .select(
            "id, name, period_start, period_end, status, stage"
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      ),
      requireRows<StatusRow[]>("goals", () =>
        scopedQuery(
          supabaseAdmin.from("hr3_performance_goals").select("status"),
          "employee_id",
          scopedEmployeeIds
        )
      ),
      requireRows<{ id: string; status: string | null }[]>("appraisals", () =>
        scopedQuery(
          supabaseAdmin.from("hr3_performance_appraisals").select("id, status"),
          "employee_id",
          scopedEmployeeIds
        )
      ),
      // Goal results for detecting submitted manager assessments.
      // Filtered in memory against the scoped appraisal IDs to avoid
      // depending on employee_id on the results table.
      requireRows<AppraisalIdRow[]>("appraisal goal results", () =>
        selectAll(
          supabaseAdmin
            .from("hr3_performance_appraisal_goal_results")
            .select("appraisal_id")
            .order("appraisal_id", { ascending: true }),
        ).then((rows) => ({ data: rows, error: null })),
      ),
      isHrAdmin
        ? requireCount("competencies", () =>
            supabaseAdmin
              .from("hr3_competencies")
              .select("id", { count: "exact", head: true })
          )
        : requireCount("competencies", () =>
            scopedQuery(
              supabaseAdmin
                .from("hr3_employee_competency_scores")
                .select("id", { count: "exact", head: true }),
              "employee_id",
              scopedEmployeeIds
            )
          ),
      isHrAdmin
        ? requireCount("position requirements", () =>
            supabaseAdmin
              .from("hr3_position_competency_requirements")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      requireRows<{ employee_id: string | null }[]>(
        "employee competency scores",
        () =>
          selectAll(
            scopedQuery(
              supabaseAdmin
                .from("hr3_employee_competency_scores")
                .select("employee_id")
                .order("employee_id", { ascending: true }),
              "employee_id",
              scopedEmployeeIds,
            ),
          ).then((rows) => ({ data: rows, error: null })),
      ),
      isHrAdmin
        ? requireCount("courses", () =>
            supabaseAdmin
              .from("hr3_courses")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      isHrAdmin
        ? requireCount("training sessions", () =>
            supabaseAdmin
              .from("hr3_training_sessions")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      requireRows<StatusRow[]>("course enrollments", () =>
        scopedQuery(
          supabaseAdmin.from("hr3_course_enrollments").select("status"),
          "employee_id",
          scopedEmployeeIds
        )
      ),
      requireCount("certifications", () =>
        scopedQuery(
          supabaseAdmin
            .from("hr3_certifications")
            .select("id", { count: "exact", head: true }),
          "employee_id",
          scopedEmployeeIds
        )
      ),
      isHrAdmin
        ? requireCount("critical positions", () =>
            supabaseAdmin
              .from("hr3_critical_positions")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      isHrAdmin
        ? requireCount("succession candidates", () =>
            supabaseAdmin
              .from("hr3_succession_candidates")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      requireCount("recognitions", () =>
        scopedQuery(
          supabaseAdmin
            .from("hr3_recognitions")
            .select("id", { count: "exact", head: true }),
          "recipient_id",
          scopedEmployeeIds
        )
      ),
      isHrAdmin
        ? requireCount("badges", () =>
            supabaseAdmin
              .from("hr3_badges")
              .select("id", { count: "exact", head: true })
          )
        : Promise.resolve(null),
      requireRows<{ points: number | null }[]>("recognition points", () =>
        scopedQuery(
          supabaseAdmin.from("hr3_recognitions").select("points"),
          "recipient_id",
          scopedEmployeeIds
        )
      ),
      requireRows<StatusRow[]>("redemptions", () =>
        scopedQuery(
          supabaseAdmin.from("hr3_reward_redemptions").select("status"),
          "employee_id",
          scopedEmployeeIds
        )
      ),
      requireRows<{ approval_status: string | null }[]>(
        "training enrollments",
        () =>
          scopedQuery(
            supabaseAdmin
              .from("hr3_training_enrollments")
              .select("approval_status"),
            "employee_id",
            scopedEmployeeIds
          )
      ),
    ]);

    // Audit events are HR-Admin-only. Manager and Employee dashboards
    // intentionally receive an empty recentActivity array to avoid
    // exposing audit event details or HR Admin account names.
    let auditEvents: AuditEventRow[] = [];
    if (isHrAdmin) {
      auditEvents = await requireRows<AuditEventRow[]>("audit events", () =>
        supabaseAdmin
          .from("hr3_audit_events")
          .select("id, actor_id, action, entity_type, entity_id, created_at")
          .order("created_at", { ascending: false })
          .limit(8)
      );
    }

    const chosenCycle = chooseCurrentCycle(cycles);
    const currentCycle: DashboardCurrentCycle = chosenCycle
      ? {
          id: chosenCycle.id,
          name: chosenCycle.name,
          periodStart: chosenCycle.period_start,
          periodEnd: chosenCycle.period_end,
          status: chosenCycle.status,
          stage: chosenCycle.stage,
        }
      : null;
    const cyclesBreakdown = breakdown(cycles);

    const agreementPending = trainingApprovalRows.filter(
      (row) => (row.approval_status ?? "").toLowerCase() === "pending"
    ).length;

    // Build a set of appraisal IDs that have persisted goal results,
    // indicating the manager has submitted their assessment.
    const appraisalIdsWithResults = new Set(
      appraisalGoalResultRows
        .map((row) => row.appraisal_id)
        .filter((id): id is string => Boolean(id))
    );

    const actionItems: DashboardActionItems = {
      goalsPendingCompletion:
        goalStatusRows.filter(
          (row) => row.status === "pending_completion"
        ).length,
      // Awaiting employee self-assessment
      appraisalsAwaitingSelfAssessment: appraisalStatusRows.filter(
        (row) => row.status === "self_assessment"
      ).length,
      // Awaiting manager assessment: status is manager_assessment AND no
      // persisted goal results yet (manager has not submitted).
      appraisalsAwaitingManagerAssessment: appraisalStatusRows.filter(
        (row) =>
          row.status === "manager_assessment" &&
          row.id &&
          !appraisalIdsWithResults.has(row.id)
      ).length,
      // Awaiting HR finalization: status is manager_assessment AND persisted
      // goal results exist (manager has submitted, HR needs to finalize).
      appraisalsAwaitingFinalization: appraisalStatusRows.filter(
        (row) =>
          row.status === "manager_assessment" &&
          row.id &&
          appraisalIdsWithResults.has(row.id)
      ).length,
      redemptionsPending: redemptionStatusRows.filter(
        (row) => (row.status ?? "").toLowerCase() === "pending"
      ).length,
      trainingEnrollmentsPending: agreementPending,
    };

    const activeCourseEnrollments = courseEnrollStatusRows.filter((row) => {
      const status = row.status ?? "";
      return status === "in_progress" || status === "enrolled";
    }).length;

    const employeesAssessed = new Set(
      scoreEmployeeRows
        .map((row) => row.employee_id)
        .filter((id): id is string => Boolean(id))
    ).size;

    const recognitionPoints = recognitionPointRows.reduce(
      (sum, row) => sum + (row.points ?? 0),
      0
    );

    const actorNames = isHrAdmin
      ? await resolveActorNames(auditEvents)
      : new Map<string, string>();

    // Build direct-report summaries (Manager only)
    const directReports =
      actorType === "manager" && employeeUuid
        ? await buildDirectReportSummaries(employeeUuid, directReportIds ?? [])
        : [];

    const snapshot: PerformanceDashboardSnapshot = {
      generatedAt: new Date().toISOString(),
      actorType,
      currentCycle,
      cycles: cyclesBreakdown,
      actionItems,
      goals: breakdown(goalStatusRows),
      appraisals: breakdown(appraisalStatusRows),
      competencyAndDevelopment: {
        competencies: competencyCount,
        positionRequirements: requirementCount,
        employeesAssessed,
        courses: courseCount,
        trainingSessions: sessionCount,
        activeCourseEnrollments,
        certifications: certificationCount,
      },
      successionAndRecognition: {
        criticalPositions: criticalPositionCount,
        successionCandidates: successionCandidateCount,
        recognitions: recognitionCount,
        badges: badgeCount,
        recognitionPoints,
        redemptionsPending: actionItems.redemptionsPending,
      },
      recentActivity: auditEvents.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entity_type,
        entityId: event.entity_id,
        createdAt: event.created_at,
        actorName: event.actor_id ? actorNames.get(event.actor_id) ?? null : null,
      })),
      directReports,
    };

    return snapshot;
  } catch (error) {
    console.error("getPerformanceDashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
