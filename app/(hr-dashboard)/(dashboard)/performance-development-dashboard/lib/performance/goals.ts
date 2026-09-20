import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  assertEmployeeOwnsRecord,
  resolveManagerDirectReportUuids,
} from "@/performance-development-dashboard/lib/auth/access";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { requireHrEmployee } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromIdentity,
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireFiniteNumber,
  requireProgressPercent,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";

/**
 * Resolves the set of employee IDs a Manager may access: the manager's own
 * employee record plus all active direct reports. Returns null for HR Admin
 * (org-wide) and Employee (self-only handled separately).
 */
async function resolveManagerScopedEmployeeIds(
  managerEmployeeUuid: string
): Promise<string[]> {
  const directReportIds = await resolveManagerDirectReportUuids(
    managerEmployeeUuid
  );
  return [managerEmployeeUuid, ...directReportIds];
}

/**
 * Checks whether a goal's employee_id falls within a Manager's scope.
 */
function isGoalInManagerScope(
  goalEmployeeId: string,
  scopedIds: string[]
): boolean {
  return scopedIds.includes(goalEmployeeId);
}

/**
 * Goal lifecycle.
 *
 * `hr3_performance_goals.status` is a plain, unconstrained `text` column with
 * DB default `'not_started'` (verified live today: no check constraint, the
 * table accepts arbitrary status text, and the table is currently empty). The
 * domain therefore defines the conservative set below, which keeps the database
 * default as the initial state and adds only states the schema can faithfully
 * represent for the currently supported workflow:
 *
 *   not_started        initial state on creation (DB default, preserved)
 *   in_progress        work has started; set when the employee records progress
 *   pending_completion employee submitted completion, awaiting review
 *   completed          terminal state; reachable only through an explicit
 *                      HR-admin transition (manager review is deferred)
 *
 * All mutations follow the linear forward flow and can never regress a state,
 * skip a state, or reopen a completed goal. Conceptual-model statuses without
 * DB grounding (draft, pending_employee, active, manager_review) are
 * intentionally NOT used.
 */
export const PERFORMANCE_GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "pending_completion",
  "completed",
] as const;

export type PerformanceGoalStatus = (typeof PERFORMANCE_GOAL_STATUSES)[number];

/**
 * The only status transitions HR administration may perform through the goal
 * PATCH route, keyed by current state. Each transition moves the goal exactly
 * one step along the linear lifecycle, exactly like the employee-facing
 * operations. No regressions, skips, or reopen transitions exist, and
 * `completed` is terminal. No manager-review behavior is invented.
 */
export const HR_GOAL_ADMIN_STATUS_TRANSITIONS: Record<
  PerformanceGoalStatus,
  readonly PerformanceGoalStatus[]
> = {
  not_started: ["in_progress"],
  in_progress: ["pending_completion"],
  pending_completion: ["completed"],
  completed: [],
};

export function isPerformanceGoalStatus(
  value: unknown
): value is PerformanceGoalStatus {
  return (
    typeof value === "string" &&
    (PERFORMANCE_GOAL_STATUSES as readonly string[]).includes(value)
  );
}

const GOAL_SELECT =
  "id, employee_id, assigned_by, role_id, title, description, category, weight, status, start_date, due_date, created_at, updated_at, priority, progress_percent, target, cycle_id";

/**
 * Server-side representation of `hr3_performance_goals`, matching the actual
 * live columns and nullability (not a conceptual projection).
 */
export type PerformanceGoal = {
  id: string;
  employee_id: string;
  assigned_by: string;
  role_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  weight: number | null;
  status: PerformanceGoalStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  priority: string;
  progress_percent: number;
  target: string | null;
  cycle_id: string | null;
  /**
   * Presentation enrichment: the authenticated ACCOUNT (hr_admin) that created
   * the goal (`goal.created` audit actor), e.g. "cap cap". Resolved
   * server-side from the persisted audit trail on every scoped response
   * (HR Admin, Manager, and Employee).
   *
   * This is distinct from `assigned_by` (the linked employee identity, e.g.
   * "Ana Garcia"). When the goal has no account-level audit event (historical
   * goals created before audit logging, or goals assigned by a
   * Manager/Employee account), this is absent and the UI falls back to the
   * employee-layer `assigned_by` name. It is NEVER derived from the currently
   * logged-in account for other people's goals.
   */
  assignedByAccountName?: string | null;
};

export type ListPerformanceGoalsQuery = Record<string, unknown>;
export type CreatePerformanceGoalInput = Record<string, unknown>;
export type UpdatePerformanceGoalInput = Record<string, unknown>;
export type UpdateGoalProgressInput = Record<string, unknown>;

/**
 * Business fields captured in goal audit events. Only these diffable state
 * fields are recorded; identity/timestamp bookkeeping (`id`, `created_at`,
 * `updated_at`) is omitted so audit payloads stay small and factual.
 */
const GOAL_AUDIT_FIELDS: readonly (keyof PerformanceGoal)[] = [
  "employee_id",
  "assigned_by",
  "role_id",
  "title",
  "description",
  "category",
  "weight",
  "status",
  "start_date",
  "due_date",
  "priority",
  "progress_percent",
  "target",
  "cycle_id",
];

/** Small explicit snapshot for a goal creation audit event. */
function goalCreatedAuditData(goal: PerformanceGoal): Record<string, unknown> {
  return {
    id: goal.id,
    employee_id: goal.employee_id,
    assigned_by: goal.assigned_by,
    title: goal.title,
    status: goal.status,
    progress_percent: goal.progress_percent,
    start_date: goal.start_date,
    due_date: goal.due_date,
    cycle_id: goal.cycle_id,
  };
}

/** Old/new values of only the fields that actually changed between two states. */
function goalAuditDiff(
  existing: PerformanceGoal,
  updated: PerformanceGoal
): { oldData: Record<string, unknown>; newData: Record<string, unknown> } {
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};

  for (const field of GOAL_AUDIT_FIELDS) {
    if (existing[field] !== updated[field]) {
      oldData[field] = existing[field];
      newData[field] = updated[field];
    }
  }

  return { oldData, newData };
}

/**
 * Batched HR-account enrichment for Goal attribution display.
 *
 * Resolves WHO ASSIGNED each goal by reading the `goal.created` audit events
 * for the given goal ids in ONE query, then mapping those actor_ids
 * (`hr_admin.id`) back to account names in ONE query. Goals without a
 * `goal.created` audit event (e.g. historical goals created before audit
 * logging) keep `assignedByAccountName = null` so the caller falls back to the
 * employee-layer `assigned_by` identity.
 *
 * Applied to every scoped response (HR Admin, Manager, Employee). Goals
 * assigned by an HR Admin account resolve to that account's name (e.g.
 * "cap cap"); goals assigned by a Manager/Employee account (audit
 * actor_type "employee") have an actor_id in `hr1_employees`, never in
 * `hr_admin`, so they keep `assignedByAccountName = null` and the caller
 * falls back to the employee-layer `assigned_by` name.
 *
 * Critical: this never attributes a goal to the currently authenticated
 * account. Attribution is always read from persisted audit data only, so a
 * client cannot influence or spoof it.
 */
export async function enrichGoalsWithAssignerAccount(
  goals: PerformanceGoal[]
): Promise<PerformanceGoal[]> {
  if (goals.length === 0) return goals;

  const goalIds = [...new Set(goals.map((goal) => goal.id))];

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from("hr3_audit_events")
    .select("entity_id, actor_id")
    .eq("entity_type", PERFORMANCE_AUDIT_ENTITY_TYPE.goal)
    .eq("action", PERFORMANCE_AUDIT_REASON.goalCreated)
    .in("entity_id", goalIds);

  if (auditError) {
    console.error("enrichGoalsWithAssignerAccount: audit query error:", auditError);
    return goals.map((goal) => ({ ...goal, assignedByAccountName: null }));
  }

  const accountIds = [
    ...new Set(
      (auditRows ?? []).map((row) => row.actor_id).filter(Boolean)
    ),
  ] as string[];

  const accountNamesById: Record<string, string> = {};
  if (accountIds.length > 0) {
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", accountIds);

    if (accountsError) {
      console.error(
        "enrichGoalsWithAssignerAccount: account lookup error:",
        accountsError
      );
    } else {
      for (const account of accounts ?? []) {
        if (account.id && account.full_name) {
          accountNamesById[account.id] = account.full_name;
        }
      }
    }
  }

  const accountNameByGoalId: Record<string, string> = {};
  for (const row of auditRows ?? []) {
    if (
      row.entity_id &&
      row.actor_id &&
      accountNamesById[row.actor_id]
    ) {
      accountNameByGoalId[row.entity_id] = accountNamesById[row.actor_id];
    }
  }

  return goals.map((goal) => ({
    ...goal,
    assignedByAccountName: accountNameByGoalId[goal.id] ?? null,
  }));
}

function requireNonEmptyText(
  value: unknown,
  field: string
): string | NextResponse {
  if (typeof value !== "string" || value.trim() === "") {
    return BAD_REQUEST_RESPONSE(
      `${field} is required and must be a non-empty string.`
    );
  }
  return value.trim();
}

function requireOptionalText(
  value: unknown,
  field: string
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

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

function requireOptionalDate(
  value: unknown,
  field: string
): string | null | NextResponse {
  if (value === undefined || value === null || value === "") return null;
  return requireValidDate(value, field);
}

/**
 * `weight` and `progress_percent` are stored as `numeric`. When provided,
 * weight must be > 0 and <= 100. null is allowed (no weight assigned).
 */
function requireWeight(value: unknown): number | null | NextResponse {
  if (value === undefined || value === null || value === "") return null;
  const numeric = requireFiniteNumber(value, "weight");
  if (numeric instanceof NextResponse) return numeric;
  if (numeric <= 0 || numeric > 100) {
    return BAD_REQUEST_RESPONSE(
      "weight must be greater than 0 and at most 100."
    );
  }
  return numeric;
}

async function requireExistingEmployeeId(
  value: unknown
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
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE("employee_id does not reference an existing employee.");
  }

  return id;
}

async function requireExistingCycleId(
  value: unknown
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
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "cycle_id does not reference an existing performance cycle."
    );
  }

  if (data.status === "closed") {
    return CONFLICT_RESPONSE(
      "Cannot create or move a goal into a closed performance cycle."
    );
  }

  return id;
}

/**
 * Prevents goal-plan mutations once the relevant appraisal has reached a
 * protected stage. Returns a 409 when:
 *
 *   A. The target cycle is closed.
 *
 *   OR
 *
 *   B. An appraisal exists for that employee matching the cycle where:
 *      - status is `finalized` or `acknowledged`, OR
 *      - status is `manager_assessment` AND persisted goal/competency result
 *        rows exist (meaning the manager has already submitted).
 *
 * Matching semantics follow `loadApplicableGoals` in appraisals.ts:
 *   - appraisal.cycle_id IS NULL matches all goals for the employee.
 *   - appraisal.cycle_id must equal the goal's cycle.
 */
async function assertGoalPlanEditable({
  employeeId,
  cycleId,
}: {
  employeeId: string;
  cycleId: string | null;
}): Promise<NextResponse | null> {
  // Check closed cycle
  if (cycleId) {
    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("hr3_performance_cycles")
      .select("status")
      .eq("id", cycleId)
      .maybeSingle();

    if (cycleError) {
      console.error("assertGoalPlanEditable: cycle query error:", cycleError);
      return NextResponse.json(
        { error: "Failed to validate performance cycle" },
        { status: 500 }
      );
    }

    if (cycle?.status === "closed") {
      return CONFLICT_RESPONSE(
        "The performance cycle is closed. Goal plan changes are not allowed."
      );
    }
  }

  // Find appraisals matching the employee and cycle semantics
  const appraisalQuery = supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("id, status, cycle_id")
    .eq("employee_id", employeeId);

  const { data: appraisals, error: appraisalError } = await appraisalQuery;

  if (appraisalError) {
    console.error(
      "assertGoalPlanEditable: appraisal query error:",
      appraisalError
    );
    return NextResponse.json(
      { error: "Failed to validate appraisal state" },
      { status: 500 }
    );
  }

  // Filter to appraisals that match the cycle semantics:
  // - cycle_id IS NULL matches all goals (legacy appraisals)
  // - cycle_id must equal the goal's cycle
  const matchingAppraisals = (appraisals ?? []).filter((a) => {
    if (!a.cycle_id) return true; // null cycle covers everything
    if (cycleId && a.cycle_id === cycleId) return true;
    if (!cycleId && !a.cycle_id) return true;
    return false;
  });

  for (const appraisal of matchingAppraisals) {
    // Finalized or acknowledged → blocked
    if (
      appraisal.status === "finalized" ||
      appraisal.status === "acknowledged"
    ) {
      return CONFLICT_RESPONSE(
        "The related appraisal has been finalized or acknowledged. Goal plan changes are not allowed."
      );
    }

    // Manager assessment with persisted result rows → blocked
    if (appraisal.status === "manager_assessment") {
      const [goalResults, competencyResults] = await Promise.all([
        supabaseAdmin
          .from("hr3_performance_appraisal_goal_results")
          .select("id")
          .eq("appraisal_id", appraisal.id)
          .limit(1),
        supabaseAdmin
          .from("hr3_performance_appraisal_competency_results")
          .select("id")
          .eq("appraisal_id", appraisal.id)
          .limit(1),
      ]);

      if (
        (goalResults.data ?? []).length > 0 ||
        (competencyResults.data ?? []).length > 0
      ) {
        return CONFLICT_RESPONSE(
          "The manager assessment has been submitted for this appraisal. Goal plan changes are not allowed."
        );
      }
    }
  }

  return null;
}

async function requireExistingRoleId(
  value: unknown
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "role_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingRoleId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate role" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "role_id does not reference an existing job position."
    );
  }

  return id;
}

function validateStartBeforeDue(
  startDate: string | null,
  dueDate: string | null
): NextResponse | null {
  if (!startDate || !dueDate) return null;
  const startTime = new Date(`${startDate}T00:00:00Z`).getTime();
  const dueTime = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (startTime > dueTime) {
    return BAD_REQUEST_RESPONSE("start_date must be on or before due_date.");
  }
  return null;
}

async function loadGoalOr404(
  goalId: string
): Promise<PerformanceGoal | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .select(GOAL_SELECT)
    .eq("id", goalId)
    .maybeSingle();

  if (error) {
    console.error("loadGoalOr404: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance goal" },
      { status: 500 }
    );
  }

    if (!data) return NOT_FOUND_RESPONSE("Performance goal");

  return data as PerformanceGoal;
}

/**
 * Applies an update only while the goal still matches the given `guards` (the
 * expected current state). This avoids unsafe read-then-write for state
 * transitions and progress updates: if another request changed the goal between
 * the initial load and this update, the filtered update matches zero rows and a
 * 409 is returned instead of silently overwriting the newer state.
 */
async function transitionGoal(
  goalId: string,
  guards: Record<string, string>,
  payload: Record<string, unknown>
): Promise<PerformanceGoal | NextResponse> {
  let query = supabaseAdmin
    .from("hr3_performance_goals")
    .update(payload)
    .eq("id", goalId);

  for (const [column, value] of Object.entries(guards)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.select(GOAL_SELECT).maybeSingle();

  if (!error && data) return data as PerformanceGoal;

  if (error && error.code !== "PGRST116") {
    console.error("transitionGoal: update error:", error);
    return NextResponse.json(
      { error: "Failed to update performance goal" },
      { status: 500 }
    );
  }

  console.error(
    "transitionGoal: no row matched the expected state for goal:",
    goalId
  );
  return NextResponse.json(
    {
      error:
        "Performance goal was changed by another request and is no longer in the expected state for this operation.",
    },
    { status: 409 }
  );
}

/**
 * Lists goals.
 *
 * Role-aware:
 * - HR admin scope requests all goals and may filter by `employee_id`,
 *   `status`, and `cycle_id` (all validated server-side).
 * - Manager scope: sees own goals plus active direct report goals. May filter
 *   by `status`. The `employee_id` filter is restricted to the manager's
 *   scoped set.
 * - Employee scope: sees only their own goals.
 */
export async function listPerformanceGoals(
  input: ListPerformanceGoalsQuery
): Promise<PerformanceGoal[] | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType !== "hr_admin") {
    if (!actor.employeeUuid) {
      return FORBIDDEN_RESPONSE();
    }

    const isManager = actor.actorType === "manager";

    let scopedIds: string[];
    if (isManager) {
      scopedIds = await resolveManagerScopedEmployeeIds(actor.employeeUuid);
    } else {
      scopedIds = [actor.employeeUuid];
    }

    let query = supabaseAdmin
      .from("hr3_performance_goals")
      .select(GOAL_SELECT)
      .in("employee_id", scopedIds);

    if (input?.status !== undefined && input?.status !== null) {
      const status = requireNonEmptyText(input.status, "status");
      if (status instanceof NextResponse) return status;
      if (!isPerformanceGoalStatus(status)) {
        return BAD_REQUEST_RESPONSE(
          `status must be one of: ${PERFORMANCE_GOAL_STATUSES.join(", ")}.`
        );
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("listPerformanceGoals: employee query error:", error);
      return NextResponse.json(
        { error: "Failed to load performance goals" },
        { status: 500 }
      );
    }

    return enrichGoalsWithAssignerAccount((data ?? []) as PerformanceGoal[]);
  }

  let query = supabaseAdmin.from("hr3_performance_goals").select(GOAL_SELECT);

  if (input?.employee_id !== undefined && input?.employee_id !== null) {
    const employeeId = requireValidUuid(input.employee_id, "employee_id");
    if (employeeId instanceof NextResponse) return employeeId;
    query = query.eq("employee_id", employeeId);
  }

  if (input?.status !== undefined && input?.status !== null) {
    const status = requireNonEmptyText(input.status, "status");
    if (status instanceof NextResponse) return status;
    if (!isPerformanceGoalStatus(status)) {
      return BAD_REQUEST_RESPONSE(
        `status must be one of: ${PERFORMANCE_GOAL_STATUSES.join(", ")}.`
      );
    }
    query = query.eq("status", status);
  }

  if (input?.cycle_id !== undefined && input?.cycle_id !== null) {
    const cycleId = requireValidUuid(input.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;
    query = query.eq("cycle_id", cycleId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listPerformanceGoals: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance goals" },
      { status: 500 }
    );
  }

  return enrichGoalsWithAssignerAccount((data ?? []) as PerformanceGoal[]);
}

/**
 * Creates/assigns a goal through HR administration or Manager scope.
 *
 * `assigned_by` is always the authenticated user's linked employee record
 * (resolved server-side) and is never taken from the request body. The initial
 * status is always the DB default `not_started`; `created_at`/`updated_at` are
 * supplied by the database.
 *
 * HR Admin: may assign to any employee.
 * Manager: may assign only to active direct reports.
 * Employee: cannot create goals (403).
 */
export async function createPerformanceGoal(
  input: CreatePerformanceGoalInput
): Promise<PerformanceGoal | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const isHrAdmin = actor.actorType === "hr_admin";

  let assignerEmployeeUuid: string;
  let allowedEmployeeIds: string[] | null = null;

  if (isHrAdmin) {
    if (!actor.employeeUuid) {
      console.error(
        "createPerformanceGoal: HR admin has no linked employee record:",
        actor.hrAdminId
      );
      return BAD_REQUEST_RESPONSE(
        "The authenticated HR admin has no linked employee record and cannot assign goals."
      );
    }
    assignerEmployeeUuid = actor.employeeUuid;
  } else {
    if (actor.actorType !== "manager" || !actor.employeeUuid) {
      return FORBIDDEN_RESPONSE();
    }

    assignerEmployeeUuid = actor.employeeUuid;
    allowedEmployeeIds = await resolveManagerScopedEmployeeIds(
      actor.employeeUuid
    );
  }

  const title = requireNonEmptyText(input?.title, "title");
  if (title instanceof NextResponse) return title;

  const description = requireOptionalText(input?.description, "description");
  if (description instanceof NextResponse) return description;

  const category = requireOptionalText(input?.category, "category");
  if (category instanceof NextResponse) return category;

  const target = requireOptionalText(input?.target, "target");
  if (target instanceof NextResponse) return target;

  const weight = requireWeight(input?.weight);
  if (weight instanceof NextResponse) return weight;

  const startDate = requireOptionalDate(input?.start_date, "start_date");
  if (startDate instanceof NextResponse) return startDate;

  const dueDate = requireOptionalDate(input?.due_date, "due_date");
  if (dueDate instanceof NextResponse) return dueDate;

  const dateOrderError = validateStartBeforeDue(startDate, dueDate);
  if (dateOrderError) return dateOrderError;

  let priority: string | null = null;
  if (input?.priority !== undefined && input?.priority !== null) {
    const parsedPriority = requireNonEmptyText(input.priority, "priority");
    if (parsedPriority instanceof NextResponse) return parsedPriority;
    priority = parsedPriority;
  }

  let progress = 0;
  if (input?.progress_percent !== undefined && input?.progress_percent !== null) {
    const parsedProgress = requireProgressPercent(
      input.progress_percent,
      "progress_percent"
    );
    if (parsedProgress instanceof NextResponse) return parsedProgress;
    progress = parsedProgress as number;
  }

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  if (allowedEmployeeIds && !allowedEmployeeIds.includes(employeeId)) {
    return FORBIDDEN_RESPONSE();
  }

  let roleId: string | null = null;
  if (input?.role_id !== undefined && input?.role_id !== null) {
    const parsedRoleId = await requireExistingRoleId(input.role_id);
    if (parsedRoleId instanceof NextResponse) return parsedRoleId;
    roleId = parsedRoleId;
  }

  let cycleId: string | null = null;
  if (input?.cycle_id !== undefined && input?.cycle_id !== null) {
    const parsedCycleId = await requireExistingCycleId(input.cycle_id);
    if (parsedCycleId instanceof NextResponse) return parsedCycleId;
    cycleId = parsedCycleId;
  }

  const editableError = await assertGoalPlanEditable({
    employeeId,
    cycleId,
  });
  if (editableError) return editableError;

  const payload: Record<string, unknown> = {
    employee_id: employeeId,
    assigned_by: assignerEmployeeUuid,
    title,
    description,
    category,
    target,
    weight,
    start_date: startDate,
    due_date: dueDate,
    role_id: roleId,
    cycle_id: cycleId,
    status: "not_started",
  };

  if (priority !== null) payload.priority = priority;
  payload.progress_percent = progress;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .insert(payload)
    .select(GOAL_SELECT)
    .single();

  if (error) {
    console.error("createPerformanceGoal: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create performance goal" },
      { status: 500 }
    );
  }

  const created = data as PerformanceGoal;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: created.id,
    oldData: null,
    newData: goalCreatedAuditData(created),
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichGoalsWithAssignerAccount([created]);
  return enriched;
}

/**
 * Retrieves a single goal within authorized scope.
 *
 * HR admin scope may read any goal (a 404 is only ever returned to an
 * already-authorized admin). Manager scope may read goals belonging to
 * themselves or their active direct reports. Employee scope may only read
 * goals they own. To avoid disclosing record existence, both "goal does not
 * exist" and "goal belongs to someone else" are answered with the same generic
 * 403 on the non-admin path.
 */
export async function getPerformanceGoal(
  goalId: string
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return FORBIDDEN_RESPONSE();

  if (actor.actorType !== "hr_admin") {
    if (!actor.employeeUuid) return FORBIDDEN_RESPONSE();

    const existing = await loadGoalOr404(id);
    if (existing instanceof NextResponse) return FORBIDDEN_RESPONSE();

    if (actor.actorType === "manager") {
      const scopedIds = await resolveManagerScopedEmployeeIds(
        actor.employeeUuid
      );
      if (!isGoalInManagerScope(existing.employee_id, scopedIds)) {
        return FORBIDDEN_RESPONSE();
      }
      const [enrichedManager] = await enrichGoalsWithAssignerAccount([existing]);
      return enrichedManager;
    }

    const owned = await assertEmployeeOwnsRecord(existing);
    if (owned instanceof NextResponse) return owned;
    const [enrichedEmployee] = await enrichGoalsWithAssignerAccount([existing]);
    return enrichedEmployee;
  }

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const [enriched] = await enrichGoalsWithAssignerAccount([existing]);
  return enriched;
}

/**
 * Update a goal.
 *
 * HR Admin: may update any goal's fields and status transitions.
 * Manager: may update field values (title, description, etc.) on goals
 *   belonging to themselves or their active direct reports. Status transitions
 *   are restricted to the same forward flow as HR Admin.
 * Employee: cannot update goals (403).
 *
 * `status` may only change along `HR_GOAL_ADMIN_STATUS_TRANSITIONS` — exactly
 * one forward step with no regressions, skips, or reopening. `completed` is
 * terminal. The update is additionally guarded on the current status whenever a
 * transition is performed, so a concurrent employee action cannot be
 * overwritten silently.
 */
export async function updatePerformanceGoal(
  goalId: string,
  input: UpdatePerformanceGoalInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const isHrAdmin = actor.actorType === "hr_admin";

  if (!isHrAdmin) {
    if (actor.actorType !== "manager" || !actor.employeeUuid) {
      return FORBIDDEN_RESPONSE();
    }

    const scopedIds = await resolveManagerScopedEmployeeIds(
      actor.employeeUuid
    );
    if (!isGoalInManagerScope(existing.employee_id, scopedIds)) {
      return FORBIDDEN_RESPONSE();
    }
  }

  const patch: Record<string, unknown> = {};

  if ("title" in input) {
    const title = requireNonEmptyText(input.title, "title");
    if (title instanceof NextResponse) return title;
    patch.title = title;
  }

  if ("description" in input) {
    const description = requireOptionalText(input.description, "description");
    if (description instanceof NextResponse) return description;
    patch.description = description;
  }

  if ("category" in input) {
    const category = requireOptionalText(input.category, "category");
    if (category instanceof NextResponse) return category;
    patch.category = category;
  }

  if ("target" in input) {
    const target = requireOptionalText(input.target, "target");
    if (target instanceof NextResponse) return target;
    patch.target = target;
  }

  if ("weight" in input) {
    const weight = requireWeight(input.weight);
    if (weight instanceof NextResponse) return weight;
    patch.weight = weight;
  }

  let nextStart: string | null = existing.start_date;
  let nextDue: string | null = existing.due_date;

  if ("start_date" in input) {
    const startDate = requireOptionalDate(input.start_date, "start_date");
    if (startDate instanceof NextResponse) return startDate;
    nextStart = startDate;
    patch.start_date = startDate;
  }

  if ("due_date" in input) {
    const dueDate = requireOptionalDate(input.due_date, "due_date");
    if (dueDate instanceof NextResponse) return dueDate;
    nextDue = dueDate;
    patch.due_date = dueDate;
  }

  const dateOrderError = validateStartBeforeDue(nextStart, nextDue);
  if (dateOrderError) return dateOrderError;

  if ("priority" in input) {
    const priority = requireNonEmptyText(input.priority, "priority");
    if (priority instanceof NextResponse) return priority;
    patch.priority = priority;
  }

  if ("role_id" in input) {
    if (input.role_id === undefined || input.role_id === null) {
      patch.role_id = null;
    } else {
      const roleId = await requireExistingRoleId(input.role_id);
      if (roleId instanceof NextResponse) return roleId;
      patch.role_id = roleId;
    }
  }

  if ("employee_id" in input) {
    const employeeId = await requireExistingEmployeeId(input.employee_id);
    if (employeeId instanceof NextResponse) return employeeId;

    // Manager IDOR: the new employee must be within the manager's scope
    if (!isHrAdmin) {
      const scopedIds = await resolveManagerScopedEmployeeIds(
        actor.employeeUuid!
      );
      if (!scopedIds.includes(employeeId)) {
        return FORBIDDEN_RESPONSE();
      }
    }

    patch.employee_id = employeeId;
  }

  if ("cycle_id" in input) {
    if (input.cycle_id === undefined || input.cycle_id === null) {
      patch.cycle_id = null;
    } else {
      const cycleId = await requireExistingCycleId(input.cycle_id);
      if (cycleId instanceof NextResponse) return cycleId;
      patch.cycle_id = cycleId;
    }
  }

  if ("progress_percent" in input) {
    if (input.progress_percent === undefined || input.progress_percent === null) {
      return BAD_REQUEST_RESPONSE(
        "progress_percent must be a number between 0 and 100."
      );
    }
    const progress = requireProgressPercent(input.progress_percent, "progress_percent");
    if (progress instanceof NextResponse) return progress;
    patch.progress_percent = progress;
  }

  if ("status" in input) {
    const status = input.status;
    if (!isPerformanceGoalStatus(status)) {
      return BAD_REQUEST_RESPONSE(
        `status must be one of: ${PERFORMANCE_GOAL_STATUSES.join(", ")}.`
      );
    }

    const allowedTransitions = HR_GOAL_ADMIN_STATUS_TRANSITIONS[existing.status];
    if (!allowedTransitions.includes(status)) {
      return CONFLICT_RESPONSE(
        `Status cannot be changed from "${existing.status}" to "${status}". Allowed transitions from "${existing.status}": ${
          allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "none"
        }.`
      );
    }

    patch.status = status;
  }

  // Goal-plan editability guard: prevent mutations when the relevant appraisal
  // is in a protected stage. Checks the existing employee/cycle, and when
  // employee_id or cycle_id changes, also checks the new target.
  const goalPlanFieldsChanged =
    "weight" in patch || "employee_id" in patch || "cycle_id" in patch;

  if (goalPlanFieldsChanged) {
    // Check the existing employee/cycle (pre-change state)
    const existingError = await assertGoalPlanEditable({
      employeeId: existing.employee_id,
      cycleId: existing.cycle_id,
    });
    if (existingError) return existingError;

    // When employee_id or cycle_id changes, also check the new target
    if ("employee_id" in patch || "cycle_id" in patch) {
      const newEmployeeId = (patch.employee_id as string) ?? existing.employee_id;
      const newCycleId = patch.hasOwnProperty("cycle_id")
        ? (patch.cycle_id as string | null)
        : existing.cycle_id;
      const newError = await assertGoalPlanEditable({
        employeeId: newEmployeeId,
        cycleId: newCycleId,
      });
      if (newError) return newError;
    }
  }

  if (Object.keys(patch).length === 0) {
    return BAD_REQUEST_RESPONSE("No updatable fields were provided.");
  }

  patch.updated_at = new Date().toISOString();

  let query = supabaseAdmin
    .from("hr3_performance_goals")
    .update(patch)
    .eq("id", id);

  if ("status" in patch) {
    query = query.eq("status", existing.status);
  }

  const { data, error } = await query.select(GOAL_SELECT).maybeSingle();

  if (!error && data) {
    const updated = data as PerformanceGoal;

    const { oldData, newData } = goalAuditDiff(existing, updated);
    const completedByAdmin =
      existing.status === "pending_completion" && updated.status === "completed";

    const auditError = await insertAuditEvent({
      actor: auditActorFromPerDevActor(actor),
      reason: completedByAdmin
        ? PERFORMANCE_AUDIT_REASON.goalCompleted
        : PERFORMANCE_AUDIT_REASON.goalUpdated,
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
      entityId: updated.id,
      oldData,
      newData,
    });
    if (auditError instanceof NextResponse) return auditError;

    const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
    return enriched;
  }

  if (error && error.code !== "PGRST116") {
    console.error("updatePerformanceGoal: update error:", error);
    return NextResponse.json(
      { error: "Failed to update performance goal" },
      { status: 500 }
    );
  }

  console.error(
    "updatePerformanceGoal: no row matched the expected state for goal:",
    id
  );
  return NextResponse.json(
    {
      error:
        "Performance goal was changed by another request and is no longer in the expected state for this operation.",
    },
    { status: 409 }
  );
}

/**
 * Progress update.
 *
 * The employee identity is resolved server-side and the goal must belong to
 * that employee or be within a Manager's direct-report scope. Progress may
 * only be recorded while the goal is `not_started` or `in_progress`; recording
 * progress always moves the goal to `in_progress`. The update is guarded on
 * the current status so a concurrent submit/update cannot be silently
 * overwritten.
 */
export async function updateGoalProgress(
  goalId: string,
  input: UpdateGoalProgressInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  if (identity.accountType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(
      identity.employeeUuid
    );
    if (!isGoalInManagerScope(existing.employee_id, scopedIds)) {
      return FORBIDDEN_RESPONSE();
    }
  } else {
    if (existing.employee_id !== identity.employeeUuid) {
      return FORBIDDEN_RESPONSE();
    }
  }

  if (existing.status !== "not_started" && existing.status !== "in_progress") {
    return CONFLICT_RESPONSE(
      `Cannot update progress: goal status "${existing.status}" does not allow progress updates. Only not_started or in_progress goals accept progress updates.`
    );
  }

  const progress = requireProgressPercent(input?.progress_percent, "progress_percent");
  if (progress instanceof NextResponse) return progress;
  if (progress === null) {
    return BAD_REQUEST_RESPONSE(
      "progress_percent is required and must be a number between 0 and 100."
    );
  }

  const updated = await transitionGoal(
    id,
    { status: existing.status },
    {
      progress_percent: progress,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.goalProgressUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}

/**
 * Employee submits that their goal is complete.
 *
 * The employee identity is resolved server-side and the goal must belong to
 * that employee. Only a goal that is `not_started` or `in_progress` can be
 * submitted; submission moves it to `pending_completion`. Review of the
 * submission is intentionally deferred (no manager relationship exists).
 */
export async function submitGoalCompletion(
  goalId: string
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  const identity = await assertEmployeeOwnsRecord(existing);
  if (identity instanceof NextResponse) return identity;

  if (existing.status !== "not_started" && existing.status !== "in_progress") {
    return CONFLICT_RESPONSE(
      `Cannot submit goal: status "${existing.status}" does not allow submission. Only not_started or in_progress goals can be submitted.`
    );
  }

  const updated = await transitionGoal(
    id,
    { status: existing.status },
    {
      status: "pending_completion",
      updated_at: new Date().toISOString(),
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.goalSubmitted,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}