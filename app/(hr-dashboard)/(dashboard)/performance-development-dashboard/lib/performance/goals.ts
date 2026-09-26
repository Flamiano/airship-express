import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { selectAll, chunkedIn } from "@/performance-development-dashboard/lib/performance/serverUtils";
import {
  assertEmployeeOwnsRecord,
  resolveManagerDirectReportUuids,
} from "@/performance-development-dashboard/lib/auth/access";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import type { PerDevActor } from "@/performance-development-dashboard/lib/auth/actor";
import { requireHrEmployee, isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromIdentity,
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  ABSENT,
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireFiniteNumber,
  requireProgressPercent,
  requireValidUuid,
  requireActiveEmployeeId,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  MAX_GOAL_MEASUREMENT_UNIT_LENGTH,
  MAX_GOAL_PROGRESS_NOTE_LENGTH,
  MAX_GOAL_REVIEW_NOTE_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import { createNotifications } from "@/performance-development-dashboard/lib/performance/notifications";
import { roundScore } from "@/performance-development-dashboard/lib/performance/scoring";
import { rejectIfDraftCycle } from "@/performance-development-dashboard/lib/performance/cycles";

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
 * Explicit goal-list scopes for the "My / Department / Organization"
 * experience. Absent scope preserves the historical per-role default
 * (employee: own; manager: self + direct reports; PerDev HR: org-wide).
 *
 *   my           goals owned by the authenticated employee (all roles)
 *   department   goals owned by employees in one department:
 *                HR names any department via `department`; manager/employee
 *                are restricted to their own department (server-derived)
 *   organization org-wide listing; PerDev HR Admin only
 */
export const PERFORMANCE_GOAL_SCOPES = [
  "my",
  "department",
  "organization",
] as const;

export type PerformanceGoalScope = (typeof PERFORMANCE_GOAL_SCOPES)[number];

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase();
}

function requireGoalScope(value: unknown): PerformanceGoalScope | NextResponse | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(
      `scope must be one of: ${PERFORMANCE_GOAL_SCOPES.join(", ")}.`
    );
  }
  const scope = value.trim().toLowerCase();
  if (
    !(PERFORMANCE_GOAL_SCOPES as readonly string[]).includes(scope)
  ) {
    return BAD_REQUEST_RESPONSE(
      `scope must be one of: ${PERFORMANCE_GOAL_SCOPES.join(", ")}.`
    );
  }
  return scope as PerformanceGoalScope;
}

function requireDepartmentName(
  value: unknown
): string | NextResponse | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim() === "") {
    return BAD_REQUEST_RESPONSE("department must be a non-empty string.");
  }
  return value.trim();
}

/**
 * Resolves an employee's own department name (raw, unnormalized) or null
 * when the record is missing or has no department.
 */
async function loadEmployeeDepartment(
  employeeUuid: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("department")
    .eq("id", employeeUuid)
    .maybeSingle();

  if (error || !data) return null;
  const department = ((data.department ?? "") as string).trim();
  return department === "" ? null : department;
}

/**
 * Resolves the employee UUIDs whose department matches (case-insensitive,
 * following the reports-module convention). Department lives on
 * `hr1_employees`, not on the goal row.
 */
async function loadEmployeeIdsInDepartment(
  normalizedDepartment: string
): Promise<string[] | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, department");

  if (error) {
    console.error("loadEmployeeIdsInDepartment: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance goals" },
      { status: 500 }
    );
  }

  return (data ?? [])
    .filter(
      (row) =>
        (((row.department ?? "") as string).trim().toLowerCase() ===
          normalizedDepartment)
    )
    .map((row) => row.id as string);
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

/**
 * Proposal approval lifecycle. Orthogonal to `PerformanceGoalStatus`
 * (execution/completion): approval tracks whether a goal is official, status
 * tracks how far the work has progressed. Never mixed: approval states are
 * never written to `status`, and completion states are never written to
 * `approval_status`.
 */
export const GOAL_APPROVAL_STATUSES = [
  "draft",
  "pending_manager_approval",
  "approved",
  "returned",
  "rejected",
] as const;

export type GoalApprovalStatus = (typeof GOAL_APPROVAL_STATUSES)[number];

export function isGoalApprovalStatus(
  value: unknown
): value is GoalApprovalStatus {
  return (
    typeof value === "string" &&
    (GOAL_APPROVAL_STATUSES as readonly string[]).includes(value)
  );
}

const GOAL_SELECT =
  "id, employee_id, assigned_by, role_id, title, description, category, weight, status, start_date, due_date, created_at, updated_at, priority, progress_percent, target, cycle_id, progress_method, measurement_type, target_value, actual_value, measurement_unit, approval_status, submitted_at, reviewed_at, reviewed_by, review_note";

/**
 * Hybrid goal-progress tracking methods.
 *
 * - `manual`: progress_percent is entered directly by an authorized user
 *   (the historical behavior; also the effective behavior when the column
 *   is NULL on rows predating the measurement migration).
 * - `measurable`: progress_percent is derived server-side as
 *   actual_value / target_value * 100 (capped at 100); clients may never
 *   submit progress_percent for these goals.
 */
export const GOAL_PROGRESS_METHODS = ["manual", "measurable"] as const;

export type GoalProgressMethod = (typeof GOAL_PROGRESS_METHODS)[number];

/** Measurement kinds for `measurable` goals. Display-only semantics. */
export const GOAL_MEASUREMENT_TYPES = [
  "number",
  "currency",
  "percentage",
  "custom",
] as const;

export type GoalMeasurementType = (typeof GOAL_MEASUREMENT_TYPES)[number];

export function isGoalProgressMethod(
  value: unknown
): value is GoalProgressMethod {
  return (
    typeof value === "string" &&
    (GOAL_PROGRESS_METHODS as readonly string[]).includes(value)
  );
}

export function isGoalMeasurementType(
  value: unknown
): value is GoalMeasurementType {
  return (
    typeof value === "string" &&
    (GOAL_MEASUREMENT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Server-authoritative measured-progress calculation.
 *
 * Returns the canonical `progress_percent` for a target/actual pair:
 * `actual / target * 100`, rounded to 2 decimals per existing numeric
 * precision conventions, capped at 100 so the historical 0–100 progress
 * invariant holds. Achievement above target (e.g. 120%) is derived for
 * display from the same inputs and never stored.
 */
export function calculateMeasuredProgress(
  targetValue: number,
  actualValue: number
): number {
  if (
    !Number.isFinite(targetValue) ||
    !Number.isFinite(actualValue) ||
    !(targetValue > 0) ||
    !(actualValue >= 0)
  ) {
    throw new Error("calculateMeasuredProgress requires finite target > 0 and finite actual >= 0.");
  }
  return Math.min(100, roundScore((actualValue / targetValue) * 100, 2));
}

function requireProgressMethod(
  value: unknown,
  field: string
): GoalProgressMethod | NextResponse {
  if (!isGoalProgressMethod(value)) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be one of: ${GOAL_PROGRESS_METHODS.join(", ")}.`
    );
  }
  return value;
}

function requireMeasurementType(
  value: unknown,
  field: string
): GoalMeasurementType | NextResponse {
  if (!isGoalMeasurementType(value)) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be one of: ${GOAL_MEASUREMENT_TYPES.join(", ")}.`
    );
  }
  return value;
}

/** Target must be a finite number greater than zero. */
function requireTargetValue(
  value: unknown,
  field: string
): number | NextResponse {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return BAD_REQUEST_RESPONSE(`${field} must be a number greater than 0.`);
  }
  return numeric;
}

/** Actual must be a finite number at or above zero. */
function requireActualValue(
  value: unknown,
  field: string
): number | NextResponse {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be a number at or above 0.`
    );
  }
  return numeric;
}

function requireMeasurementUnit(
  value: unknown,
  field: string
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_GOAL_MEASUREMENT_UNIT_LENGTH) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${MAX_GOAL_MEASUREMENT_UNIT_LENGTH} characters.`
    );
  }
  return trimmed || null;
}

function requireProgressNote(
  value: unknown,
  field: string
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_GOAL_PROGRESS_NOTE_LENGTH) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${MAX_GOAL_PROGRESS_NOTE_LENGTH} characters.`
    );
  }
  return trimmed || null;
}

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
   * Hybrid progress tracking: `manual` (progress_percent entered directly)
   * or `measurable` (progress_percent derived server-side from
   * actual_value / target_value). Rows predating the measurement migration
   * carry NULL here and behave as `manual`.
   */
  progress_method: GoalProgressMethod | null;
  /** Display-only measurement kind for `measurable` goals. */
  measurement_type: GoalMeasurementType | null;
  /** Positive measurement target for `measurable` goals. */
  target_value: number | null;
  /** Latest recorded actual for `measurable` goals (NULL = not yet set). */
  actual_value: number | null;
  /** Display-only unit label (e.g. "PHP", "Orders"); NULL when unused. */
  measurement_unit: string | null;
  /**
   * Proposal approval state. Goals created through manager/HR channels —
   * including all rows predating the approval workflow — are `approved`;
   * employee self-proposals start as `draft`.
   */
  approval_status: GoalApprovalStatus;
  /** Server timestamp of the last proposal submission, null when never submitted. */
  submitted_at: string | null;
  /** Server timestamp of the last manager/HR review, null when never reviewed. */
  reviewed_at: string | null;
  /** `hr1_employees.id` of the reviewing manager/HR admin (server-derived). */
  reviewed_by: string | null;
  /** Reviewer note (required on return/reject, optional on approve). */
  review_note: string | null;
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
export type CreateOwnGoalProposalInput = Record<string, unknown>;
export type UpdateOwnGoalProposalInput = Record<string, unknown>;
export type ReviewGoalProposalInput = Record<string, unknown>;

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
  "progress_method",
  "measurement_type",
  "target_value",
  "actual_value",
  "measurement_unit",
  "approval_status",
  "review_note",
];

/** Small explicit snapshot for a goal creation audit event. */
function goalCreatedAuditData(goal: PerformanceGoal): Record<string, unknown> {
  return {
    id: goal.id,
    employee_id: goal.employee_id,
    assigned_by: goal.assigned_by,
    title: goal.title,
    status: goal.status,
    approval_status: goal.approval_status,
    progress_percent: goal.progress_percent,
    start_date: goal.start_date,
    due_date: goal.due_date,
    cycle_id: goal.cycle_id,
    progress_method: goal.progress_method,
    measurement_type: goal.measurement_type,
    target_value: goal.target_value,
    actual_value: goal.actual_value,
    measurement_unit: goal.measurement_unit,
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

  const auditBatches = await chunkedIn(goalIds, 100, async (chunk) => {
    const { data, error } = await supabaseAdmin
      .from("hr3_audit_events")
      .select("entity_id, actor_id")
      .eq("entity_type", PERFORMANCE_AUDIT_ENTITY_TYPE.goal)
      .eq("action", PERFORMANCE_AUDIT_REASON.goalCreated)
      .in("entity_id", chunk);
    if (error) {
      console.error("enrichGoalsWithAssignerAccount: audit query error:", error);
      return [];
    }
    return data ?? [];
  });
  const auditRows = auditBatches.flat();

  const accountIds = [
    ...new Set(
      auditRows.map((row) => row.actor_id).filter(Boolean)
    ),
  ] as string[];

  const accountNamesById: Record<string, string> = {};
  if (accountIds.length > 0) {
    const accountBatches = await chunkedIn(accountIds, 100, async (chunk) => {
      const { data, error } = await supabaseAdmin
        .from("hr_admin")
        .select("id, full_name")
        .in("id", chunk);
      if (error) {
        console.error(
          "enrichGoalsWithAssignerAccount: account lookup error:",
          error
        );
        return [];
      }
      return data ?? [];
    });

    for (const account of accountBatches.flat()) {
      if (account.id && account.full_name) {
        accountNamesById[account.id] = account.full_name;
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
 *   `status`, `cycle_id`, and `department` (all validated server-side).
 *   Department is resolved through `hr1_employees` membership
 *   (case-insensitive); the goal row itself carries no department.
 * - Manager scope: sees own goals plus active direct report goals. May filter
 *   by `status`. The `employee_id` filter is restricted to the manager's
 *   scoped set.
 * - Employee scope: sees only their own goals.
 *
 * Explicit `scope` ("my" | "department" | "organization"; absent preserves
 * the defaults above):
 * - `my`: own goals only, for every role (HR resolves its linked employee).
 * - `department`: goals of department members. HR names the department via
 *   `department` (required); manager/employee are restricted to their own
 *   department (server-derived, explicit mismatch is 403).
 * - `organization`: org-wide listing; PerDev HR Admin only.
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

    const scope = requireGoalScope(input?.scope);
    if (scope instanceof NextResponse) return scope;

    if (scope === "organization") {
      return FORBIDDEN_RESPONSE();
    }

    let scopedIds: string[];
    if (isManager && scope !== "my") {
      scopedIds = await resolveManagerScopedEmployeeIds(actor.employeeUuid);
    } else {
      scopedIds = [actor.employeeUuid];
    }

    if (scope === "department") {
      const explicit = requireDepartmentName(input?.department);
      if (explicit instanceof NextResponse) return explicit;

      const ownDepartment = await loadEmployeeDepartment(actor.employeeUuid);
      const ownNormalized =
        ownDepartment !== null
          ? normalizeDepartmentName(ownDepartment)
          : null;
      const requested =
        explicit !== null ? normalizeDepartmentName(explicit) : ownNormalized;

      if (requested === null) {
        // No department to resolve: no explicit value and the actor has
        // no department. Fail closed with an empty set.
        return [];
      }
      if (requested !== ownNormalized) {
        // A department outside the actor's own is never served.
        return FORBIDDEN_RESPONSE();
      }

      const memberIds = await loadEmployeeIdsInDepartment(requested);
      if (memberIds instanceof NextResponse) return memberIds;
      scopedIds = scopedIds.filter((id) => memberIds.includes(id));
      if (scopedIds.length === 0) return [];
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

    // Scope-safe read filters for DISPLAY-ONLY helpers (weight allocation).
    // Without these, `loadWeightContext` as manager/employee ignores its
    // `employee_id`/`cycle_id` params and sums cross-cycle / cross-employee
    // rows (e.g. 100+100+100 across cycles → "300% / 100%"). `employee_id`
    // is restricted to the caller's scoped set (never widened); `cycle_id`
    // is a pure read filter (closed cycles remain readable).
    if (
      input?.employee_id !== undefined &&
      input?.employee_id !== null &&
      input?.employee_id !== ""
    ) {
      const employeeId = requireValidUuid(input.employee_id, "employee_id");
      if (employeeId instanceof NextResponse) return employeeId;
      if (!scopedIds.includes(employeeId)) {
        return FORBIDDEN_RESPONSE();
      }
      query = query.eq("employee_id", employeeId);
    }

    if (
      input?.cycle_id !== undefined &&
      input?.cycle_id !== null &&
      input?.cycle_id !== ""
    ) {
      const cycleId = requireValidUuid(input.cycle_id, "cycle_id");
      if (cycleId instanceof NextResponse) return cycleId;
      query = query.eq("cycle_id", cycleId);
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

  // HR admin with a non-PerDev role: reject, do not fall through.
  if (actor.actorType === "hr_admin" && !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RESPONSE();
  }

  let query = supabaseAdmin.from("hr3_performance_goals").select(GOAL_SELECT);

  const scope = requireGoalScope(input?.scope);
  if (scope instanceof NextResponse) return scope;

  if (scope === "my") {
    const identity = await requireHrEmployee();
    if (identity instanceof NextResponse) return identity;
    query = query.eq("employee_id", identity.employeeUuid);
  } else if (scope === "department") {
    const explicit = requireDepartmentName(input?.department);
    if (explicit instanceof NextResponse) return explicit;
    if (explicit === null) {
      return BAD_REQUEST_RESPONSE(
        "department is required when scope is department."
      );
    }

    const memberIds = await loadEmployeeIdsInDepartment(
      normalizeDepartmentName(explicit)
    );
    if (memberIds instanceof NextResponse) return memberIds;
    if (memberIds.length === 0) return [];
    query = query.in("employee_id", memberIds);
  }

  if (input?.employee_id !== undefined && input?.employee_id !== null) {
    const employeeId = requireValidUuid(input.employee_id, "employee_id");
    if (employeeId instanceof NextResponse) return employeeId;
    query = query.eq("employee_id", employeeId);
  }

  // Explicit department outside the department scope acts as an additional
  // HR-only filter (intersected with any scope/employee constraint above).
  if (
    scope !== "department" &&
    input?.department !== undefined &&
    input?.department !== null &&
    input?.department !== ""
  ) {
    const explicit = requireDepartmentName(input?.department);
    if (explicit instanceof NextResponse) return explicit;
    if (explicit !== null) {
      const memberIds = await loadEmployeeIdsInDepartment(
        normalizeDepartmentName(explicit)
      );
      if (memberIds instanceof NextResponse) return memberIds;
      if (memberIds.length === 0) return [];
      query = query.in("employee_id", memberIds);
    }
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

  const { data, error } = await selectAll(
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  ).then((rows) => ({ data: rows, error: null }));

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

  const isHrAdmin = actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

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
  } else if (actor.actorType === "hr_admin") {
    // HR admin with a non-PerDev role: reject.
    return FORBIDDEN_RESPONSE();
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

  /**
   * Hybrid progress configuration. Defaults to manual; measurement fields
   * are only stored for `measurable` goals. For measurable goals the client
   * may supply an initial actual (optional); progress is always derived
   * server-side and any client-supplied progress_percent is ignored.
   */
  let progressMethod: GoalProgressMethod = "manual";
  if (input?.progress_method !== undefined && input?.progress_method !== null) {
    const parsed = requireProgressMethod(input.progress_method, "progress_method");
    if (parsed instanceof NextResponse) return parsed;
    progressMethod = parsed;
  }

  let measurementType: GoalMeasurementType | null = null;
  let targetValue: number | null = null;
  let actualValue: number | null = null;
  let measurementUnit: string | null = null;

  if (progressMethod === "measurable") {
    if (input?.measurement_type === undefined || input?.measurement_type === null) {
      return BAD_REQUEST_RESPONSE(
        "measurement_type is required for measurable goals."
      );
    }
    const parsedType = requireMeasurementType(input.measurement_type, "measurement_type");
    if (parsedType instanceof NextResponse) return parsedType;
    measurementType = parsedType;

    if (input?.target_value === undefined || input?.target_value === null) {
      return BAD_REQUEST_RESPONSE(
        "target_value is required for measurable goals."
      );
    }
    const parsedTarget = requireTargetValue(input.target_value, "target_value");
    if (parsedTarget instanceof NextResponse) return parsedTarget;
    targetValue = parsedTarget;

    const parsedUnit = requireMeasurementUnit(input?.measurement_unit, "measurement_unit");
    if (parsedUnit instanceof NextResponse) return parsedUnit;
    measurementUnit =
      measurementType === "percentage" ? null : parsedUnit;

    if (input?.actual_value !== undefined && input?.actual_value !== null) {
      const parsedActual = requireActualValue(input.actual_value, "actual_value");
      if (parsedActual instanceof NextResponse) return parsedActual;
      actualValue = parsedActual;
    }

    progress =
      actualValue === null
        ? 0
        : calculateMeasuredProgress(targetValue, actualValue);
  }

  const employeeId = await requireActiveEmployeeId(input?.employee_id, "employee_id");
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
    // Manager/HR-created goals enter through an authorized channel and are
    // official immediately: they never pass through proposal approval.
    approval_status: "approved",
    progress_method: progressMethod,
    measurement_type: measurementType,
    target_value: targetValue,
    actual_value: actualValue,
    measurement_unit: measurementUnit,
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

  // HR admin with a non-PerDev role: reject, do not fall through.
  if (actor.actorType === "hr_admin" && !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RESPONSE();
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

  const isHrAdmin = actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  if (!isHrAdmin) {
    if (actor.actorType === "hr_admin") {
      // HR admin with a non-PerDev role: reject.
      return FORBIDDEN_RESPONSE();
    }
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

  // Proposal workflow separation: official definition edits apply to approved
  // goals only. Draft/pending/returned/rejected proposals are managed through
  // the proposal endpoints (owner edits, submit, manager/HR review), never
  // through this path — so approval cannot be bypassed via PATCH, including
  // status transitions.
  if (existing.approval_status !== "approved") {
    return CONFLICT_RESPONSE(
      `Only approved goals can be edited here. Current approval state: "${existing.approval_status}". Proposals use the proposal workflow until approved.`
    );
  }

  // Completed-goal immutability: a completed goal is a terminal historical
  // record. Definition, weight, progress, and status edits are rejected;
  // reads and history are unaffected. The dedicated completion-confirmation
  // transition (pending_completion → completed) runs while the goal is
  // still pending, so it is never subject to this guard.
  if (existing.status === "completed") {
    return CONFLICT_RESPONSE(
      "This goal is already completed and can no longer be modified."
    );
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

  /**
   * Hybrid progress configuration. Goal-edit authority (HR Admin / in-scope
   * Manager) may change the tracking method, measurement type, target, and
   * unit — but NEVER actual_value (updated exclusively through the progress
   * endpoint, which carries progress-update authorization) and NEVER
   * progress_percent directly for measurable goals (server-calculated).
   */
  const existingMethod: GoalProgressMethod =
    existing.progress_method ?? "manual";
  let nextMethod = existingMethod;
  if (
    input?.progress_method !== undefined &&
    input?.progress_method !== null
  ) {
    const parsed = requireProgressMethod(
      input.progress_method,
      "progress_method"
    );
    if (parsed instanceof NextResponse) return parsed;
    nextMethod = parsed;
    patch.progress_method = parsed;
  }

  let nextType: GoalMeasurementType | null =
    existing.measurement_type ?? null;
  if (
    input?.measurement_type !== undefined &&
    input?.measurement_type !== null
  ) {
    const parsed = requireMeasurementType(
      input.measurement_type,
      "measurement_type"
    );
    if (parsed instanceof NextResponse) return parsed;
    nextType = parsed;
    patch.measurement_type = parsed;
  } else if (input?.measurement_type === null) {
    nextType = null;
    patch.measurement_type = null;
  }

  let nextTarget: number | null = existing.target_value ?? null;
  if (input?.target_value !== undefined && input?.target_value !== null) {
    const parsed = requireTargetValue(input.target_value, "target_value");
    if (parsed instanceof NextResponse) return parsed;
    nextTarget = parsed;
    patch.target_value = parsed;
  } else if (input?.target_value === null) {
    nextTarget = null;
    patch.target_value = null;
  }

  if (
    input?.measurement_unit !== undefined &&
    input?.measurement_unit !== null
  ) {
    const parsed = requireMeasurementUnit(
      input.measurement_unit,
      "measurement_unit"
    );
    if (parsed instanceof NextResponse) return parsed;
    patch.measurement_unit = parsed;
  } else if (input?.measurement_unit === null) {
    patch.measurement_unit = null;
  }

  if (nextMethod === "manual") {
    // Method is the source of truth: manual goals carry no measurement
    // configuration, so any supplied values are cleared rather than stored.
    if (existingMethod === "measurable") {
      // Measurable → manual: retain the current calculated progress as the
      // starting manual value; clear measurement fields so they can never
      // affect progress again. Audit history preserves the prior state.
      patch.measurement_type = null;
      patch.target_value = null;
      patch.actual_value = null;
      patch.measurement_unit = null;
    } else if (
      "measurement_type" in input ||
      "target_value" in input ||
      "actual_value" in input ||
      "measurement_unit" in input
    ) {
      patch.measurement_type = null;
      patch.target_value = null;
      patch.actual_value = null;
      patch.measurement_unit = null;
    }
  } else {
    // Measurable goals require a type and a target (from this request or
    // already stored). Actual values arrive only via the progress endpoint.
    if (nextType === null) {
      return BAD_REQUEST_RESPONSE(
        "measurement_type is required for measurable goals."
      );
    }
    if (nextTarget === null) {
      return BAD_REQUEST_RESPONSE(
        "target_value is required for measurable goals."
      );
    }
    if (nextType === "percentage") {
      patch.measurement_unit = null;
    }
    if ("progress_percent" in input) {
      return BAD_REQUEST_RESPONSE(
        "progress_percent cannot be set directly for measurable goals; update actual_value through the progress endpoint."
      );
    }
    if ("actual_value" in input) {
      return BAD_REQUEST_RESPONSE(
        "actual_value cannot be set through goal editing; use the progress update endpoint."
      );
    }
    // Recompute progress from the (possibly new) target and the stored
    // actual. No actual recorded yet → 0 (explicit unmeasured state).
    const storedActual = existing.actual_value ?? null;
    patch.progress_percent =
      storedActual === null
        ? 0
        : calculateMeasuredProgress(nextTarget, storedActual);
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

  // Completion-confirmation governance (normal workflow: employee submits at
  // 100% → manager confirms; HR Admin retains administrative fallback).
  // The transition map above already restricts completion to
  // pending_completion → completed. Additionally:
  // - Manager authority is direct-report-only: a manager may never confirm
  //   their own goal through manager authority (self remains in the edit
  //   scope above, but completion requires someone else's confirmation).
  // - Effective canonical progress must be exactly 100%, so a 0–99% pending
  //   goal (including legacy rows predating the submit gate) can never be
  //   completed through this service.
  if (patch.status === "completed") {
    if (!isHrAdmin) {
      if (!actor.employeeUuid || existing.employee_id === actor.employeeUuid) {
        return FORBIDDEN_RESPONSE();
      }
    }
    // Draft-cycle activation: completion confirmation is active execution
    // and requires an opened cycle.
    const draftCycleError = await rejectIfDraftCycle(existing.cycle_id);
    if (draftCycleError) return draftCycleError;
    const effectiveProgress =
      "progress_percent" in patch &&
      typeof patch.progress_percent === "number"
        ? (patch.progress_percent as number)
        : existing.progress_percent;
    if (effectiveProgress !== 100) {
      return CONFLICT_RESPONSE(
        "Goal progress must reach 100% before completion can be confirmed."
      );
    }
  }

  // Goal-plan editability guard: prevent mutations when the relevant appraisal
  // is in a protected stage. Checks the existing employee/cycle, and when
  // employee_id or cycle_id changes, also checks the new target.
  // Measurement configuration (method/target) joins weight/employee/cycle
  // here: changing what a goal measures mid-appraisal would confuse the
  // review, while display-only type/unit edits stay unrestricted.
  const goalPlanFieldsChanged =
    "weight" in patch ||
    "employee_id" in patch ||
    "cycle_id" in patch ||
    "progress_method" in patch ||
    "target_value" in patch;

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

    // Best-effort completion notification: the goal owner learns their goal
    // was confirmed as completed. Failures never roll back the completion.
    // `createNotifications` skips actor==recipient, so an HR admin confirming
    // a linked-employee own goal produces no self-notification.
    if (completedByAdmin) {
      try {
        await createNotifications([
          {
            recipient_employee_id: updated.employee_id,
            actor_employee_id: actor.employeeUuid,
            actor_hr_admin_id: actor.hrAdminId,
            title: "Goal Completed",
            message: `Your goal "${updated.title}" has been confirmed as completed.`,
            type: "goal.completion_confirmed",
            link: `/performance-development-dashboard/goals?goal=${updated.id}`,
            entity_id: updated.id,
          },
        ]);
      } catch (notificationError) {
        console.error(
          "updatePerformanceGoal (goal.completion_confirmed):",
          notificationError
        );
      }
    }

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

  // Proposal workflow separation: only approved (official) goals accept
  // progress updates. Draft/pending/returned/rejected proposals are locked
  // until approval. Hybrid Goal Progress calculation itself is unchanged.
  if (existing.approval_status !== "approved") {
    return CONFLICT_RESPONSE(
      `Cannot update progress: approval state "${existing.approval_status}" does not allow progress updates. Only approved goals accept progress updates.`
    );
  }

  // Draft-cycle activation: active execution requires an opened cycle.
  // Planning (proposals, reviews, assignment) stays available in draft.
  const draftCycleError = await rejectIfDraftCycle(existing.cycle_id);
  if (draftCycleError) return draftCycleError;

  if (existing.status !== "not_started" && existing.status !== "in_progress") {
    return CONFLICT_RESPONSE(
      `Cannot update progress: goal status "${existing.status}" does not allow progress updates. Only not_started or in_progress goals accept progress updates.`
    );
  }

  const goalPlanError = await assertGoalPlanEditable({
    employeeId: existing.employee_id,
    cycleId: existing.cycle_id,
  });
  if (goalPlanError) return goalPlanError;

  const progressNote = requireProgressNote(input?.note, "note");
  if (progressNote instanceof NextResponse) return progressNote;

  const method: GoalProgressMethod = existing.progress_method ?? "manual";

  let progress: number;
  let actualValue: number | null = existing.actual_value ?? null;

  if (method === "measurable") {
    // Server-authoritative calculation: any client-supplied
    // progress_percent is ignored, never trusted.
    if (existing.target_value === null || !(existing.target_value > 0)) {
      return BAD_REQUEST_RESPONSE(
        "This measurable goal has no valid target; ask an authorized goal editor to set one."
      );
    }
    if (input?.actual_value === undefined || input?.actual_value === null) {
      return BAD_REQUEST_RESPONSE(
        "actual_value is required to update a measurable goal."
      );
    }
    const parsedActual = requireActualValue(input.actual_value, "actual_value");
    if (parsedActual instanceof NextResponse) return parsedActual;
    actualValue = parsedActual;
    progress = calculateMeasuredProgress(existing.target_value, actualValue);
  } else {
    const parsed = requireProgressPercent(input?.progress_percent, "progress_percent");
    if (parsed instanceof NextResponse) return parsed;
    if (parsed === null) {
      return BAD_REQUEST_RESPONSE(
        "progress_percent is required and must be a number between 0 and 100."
      );
    }
    progress = parsed;
  }

  const updated = await transitionGoal(
    id,
    { status: existing.status },
    {
      progress_percent: progress,
      ...(method === "measurable" ? { actual_value: actualValue } : {}),
      status: "in_progress",
      updated_at: new Date().toISOString(),
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);
  if (progressNote !== null) {
    // The note is event metadata, not goal state: it rides along in the
    // audit record so progress changes stay reconstructable with context.
    (newData as Record<string, unknown>).note = progressNote;
  }

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

  // Proposal workflow separation: only approved (official) goals can be
  // submitted for completion. Unapproved proposals cannot enter
  // pending_completion through this API.
  if (existing.approval_status !== "approved") {
    return CONFLICT_RESPONSE(
      `Cannot submit goal: approval state "${existing.approval_status}" does not allow submission. Only approved goals can be submitted.`
    );
  }

  // Draft-cycle activation: completion submission is active execution and
  // requires an opened cycle.
  const draftCycleError = await rejectIfDraftCycle(existing.cycle_id);
  if (draftCycleError) return draftCycleError;

  if (existing.status !== "not_started" && existing.status !== "in_progress") {
    return CONFLICT_RESPONSE(
      `Cannot submit goal: status "${existing.status}" does not allow submission. Only not_started or in_progress goals can be submitted.`
    );
  }

  // Completion governance: an approved goal may be submitted for completion
  // ONLY when its canonical progress is exactly 100%. This holds for both
  // manual goals (employee-recorded 0–100) and measurable goals (canonical
  // progress is already capped at 100 by calculateMeasuredProgress, so
  // 100% and 120% achievement are both eligible). 100% never auto-submits;
  // the employee must explicitly invoke this operation.
  if (existing.progress_percent !== 100) {
    return CONFLICT_RESPONSE(
      "Goal progress must reach 100% before it can be submitted for completion."
    );
  }

  const goalPlanError = await assertGoalPlanEditable({
    employeeId: existing.employee_id,
    cycleId: existing.cycle_id,
  });
  if (goalPlanError) return goalPlanError;

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

/* =====================================================================
 * EMPLOYEE GOAL PROPOSALS + MANAGER/HR REVIEW
 * ===================================================================== */

/**
 * Proposal workflow (MVP).
 *
 * Two state machines stay separate:
 *   approval_status (draft → pending_manager_approval → approved, with
 *     returned → pending resubmission and terminal rejected)
 *   status (not_started → in_progress → pending_completion → completed)
 *
 * `assigned_by` keeps its established meaning (the assigner identity). For
 * self-proposals the owner assigns to themselves, so `assigned_by` is the
 * owner's own employee UUID on this path — documented here rather than
 * redefined. No `created_by` column is introduced: creator == owner on every
 * proposal path, and the audit trail records the acting account.
 *
 * Client-supplied `employee_id`, `assigned_by`, `manager_id`, `weight`,
 * `approval_status`, `reviewed_by`, `reviewed_at`, `submitted_at`,
 * `review_note`, `status`, `actual_value`, and `progress_percent` are NEVER
 * authoritative on proposal paths: they are ignored and replaced with
 * server values below.
 */

function requireOptionalReviewNote(
  value: unknown
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE("review_note must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_GOAL_REVIEW_NOTE_LENGTH) {
    return BAD_REQUEST_RESPONSE(
      `review_note must be at most ${MAX_GOAL_REVIEW_NOTE_LENGTH} characters.`
    );
  }
  return trimmed;
}

function requireReviewNote(value: unknown): string | NextResponse {
  if (typeof value !== "string" || value.trim() === "") {
    return BAD_REQUEST_RESPONSE(
      "review_note is required to return or reject a proposal."
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_GOAL_REVIEW_NOTE_LENGTH) {
    return BAD_REQUEST_RESPONSE(
      `review_note must be at most ${MAX_GOAL_REVIEW_NOTE_LENGTH} characters.`
    );
  }
  return trimmed;
}

type ProposalDefinitionFields = {
  title: string;
  description: string | null;
  category: string | null;
  target: string | null;
  cycleId: string | null;
  startDate: string | null;
  dueDate: string | null;
  priority: string | null;
  progressMethod: GoalProgressMethod;
  measurementType: GoalMeasurementType | null;
  targetValue: number | null;
  measurementUnit: string | null;
};

/**
 * Parses the employee-proposable definition fields with the same validation
 * semantics as official goal creation. Weight, ownership, approval, status,
 * and progress state are never parsed here — callers apply server values.
 */
async function parseProposalDefinitionFields(
  input: CreateOwnGoalProposalInput
): Promise<ProposalDefinitionFields | NextResponse> {
  const title = requireNonEmptyText(input?.title, "title");
  if (title instanceof NextResponse) return title;

  const description = requireOptionalText(input?.description, "description");
  if (description instanceof NextResponse) return description;

  const category = requireOptionalText(input?.category, "category");
  if (category instanceof NextResponse) return category;

  const target = requireOptionalText(input?.target, "target");
  if (target instanceof NextResponse) return target;

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

  let progressMethod: GoalProgressMethod = "manual";
  if (input?.progress_method !== undefined && input?.progress_method !== null) {
    const parsed = requireProgressMethod(input.progress_method, "progress_method");
    if (parsed instanceof NextResponse) return parsed;
    progressMethod = parsed;
  }

  let measurementType: GoalMeasurementType | null = null;
  let targetValue: number | null = null;
  let measurementUnit: string | null = null;

  if (progressMethod === "measurable") {
    if (input?.measurement_type === undefined || input?.measurement_type === null) {
      return BAD_REQUEST_RESPONSE(
        "measurement_type is required for measurable goals."
      );
    }
    const parsedType = requireMeasurementType(input.measurement_type, "measurement_type");
    if (parsedType instanceof NextResponse) return parsedType;
    measurementType = parsedType;

    if (input?.target_value === undefined || input?.target_value === null) {
      return BAD_REQUEST_RESPONSE(
        "target_value is required for measurable goals."
      );
    }
    const parsedTarget = requireTargetValue(input.target_value, "target_value");
    if (parsedTarget instanceof NextResponse) return parsedTarget;
    targetValue = parsedTarget;

    const parsedUnit = requireMeasurementUnit(input?.measurement_unit, "measurement_unit");
    if (parsedUnit instanceof NextResponse) return parsedUnit;
    measurementUnit =
      measurementType === "percentage" ? null : parsedUnit;
  }

  let cycleId: string | null = null;
  if (input?.cycle_id !== undefined && input?.cycle_id !== null) {
    const parsedCycleId = await requireExistingCycleId(input.cycle_id);
    if (parsedCycleId instanceof NextResponse) return parsedCycleId;
    cycleId = parsedCycleId;
  }

  return {
    title,
    description: description === ABSENT ? null : description,
    category: category === ABSENT ? null : category,
    target: target === ABSENT ? null : target,
    cycleId,
    startDate,
    dueDate,
    priority,
    progressMethod,
    measurementType,
    targetValue,
    measurementUnit,
  };
}

/**
 * Derives `role_id` from the employee's authoritative HR1 position, the same
 * source the goal-create form displays. Client-supplied `role_id` is never
 * accepted on proposal paths.
 */
async function resolveOwnRoleId(
  employeeUuid: string
): Promise<string | null> {
  const { data: employee } = await supabaseAdmin
    .from("hr1_employees")
    .select("job_position_id")
    .eq("id", employeeUuid)
    .maybeSingle();

  const positionId = employee?.job_position_id ?? null;
  if (!positionId) return null;

  const { data: position } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id")
    .eq("id", positionId)
    .maybeSingle();

  return position?.id ?? null;
}

/** Loads the authoritative manager (`hr1_employees.manager_id`) of an employee. */
async function loadEmployeeManagerId(
  employeeUuid: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("hr1_employees")
    .select("manager_id")
    .eq("id", employeeUuid)
    .maybeSingle();

  return (data?.manager_id as string | null) ?? null;
}

/**
 * Resolves proposal review authority using CURRENT HR1-derived relationships
 * (no reviewer snapshot is stored at submit time).
 *
 * Allowed: the goal owner's current authoritative manager, or a PerDev HR
 * Admin (operational fallback). Denied: non-PerDev HR, unrelated managers,
 * former managers after a transfer, and — explicitly — the goal owner, even
 * if corrupted HR1 data lists the employee as their own manager.
 */
async function resolveProposalReviewer(
  actor: PerDevActor,
  goal: PerformanceGoal
): Promise<{ reviewerEmployeeUuid: string | null } | NextResponse> {
  const isHrAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  if (actor.actorType === "hr_admin" && !isHrAdmin) {
    return FORBIDDEN_RESPONSE();
  }

  // Self-review defense: the owner can never review their own proposal
  // through employee/manager authority, regardless of HR1 manager data.
  if (!isHrAdmin && actor.employeeUuid === goal.employee_id) {
    return FORBIDDEN_RESPONSE();
  }

  if (isHrAdmin) {
    return { reviewerEmployeeUuid: actor.employeeUuid };
  }

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const managerId = await loadEmployeeManagerId(goal.employee_id);
  if (!managerId || managerId !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  return { reviewerEmployeeUuid: actor.employeeUuid };
}

/** Best-effort proposal notification: failures never roll back the workflow. */
async function notifyProposalEvent(input: {
  recipientEmployeeId: string | null;
  actor: PerDevActor;
  title: string;
  message: string;
  type:
    | "goal.proposal_submitted"
    | "goal.proposal_approved"
    | "goal.proposal_returned"
    | "goal.proposal_rejected";
  goalId: string;
}): Promise<void> {
  if (!input.recipientEmployeeId) return;
  try {
    await createNotifications([
      {
        recipient_employee_id: input.recipientEmployeeId,
        actor_employee_id: input.actor.employeeUuid,
        actor_hr_admin_id: input.actor.hrAdminId,
        title: input.title,
        message: input.message,
        type: input.type,
        link: `/performance-development-dashboard/goals?goal=${input.goalId}`,
        entity_id: input.goalId,
      },
    ]);
  } catch (error) {
    console.error(`notifyProposalEvent (${input.type}):`, error);
  }
}

/** Requires the goal to be in draft/returned state for owner edits. */
function requireEditableProposal(
  goal: PerformanceGoal
): NextResponse | null {
  if (goal.approval_status !== "draft" && goal.approval_status !== "returned") {
    return CONFLICT_RESPONSE(
      `Only draft or returned proposals can be edited. Current approval state: "${goal.approval_status}".`
    );
  }
  return null;
}

/**
 * Creates a self-owned goal proposal (draft).
 *
 * Only non-HR actors acting on themselves. HR Admin and Manager official
 * creation continues through `createPerformanceGoal`. All authority-bearing
 * fields are server-derived; any client-supplied counterparts are ignored.
 */
export async function createOwnGoalProposal(
  input: CreateOwnGoalProposalInput
): Promise<PerformanceGoal | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RESPONSE();
  }
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const activeId = await requireActiveEmployeeId(
    actor.employeeUuid,
    "employee_id"
  );
  if (activeId instanceof NextResponse) return activeId;

  const fields = await parseProposalDefinitionFields(input);
  if (fields instanceof NextResponse) return fields;

  const roleId = await resolveOwnRoleId(actor.employeeUuid);

  const planError = await assertGoalPlanEditable({
    employeeId: actor.employeeUuid,
    cycleId: fields.cycleId,
  });
  if (planError) return planError;

  const payload: Record<string, unknown> = {
    employee_id: actor.employeeUuid,
    // Self-proposed assignment: the owner is their own assigner on this path.
    // `assigned_by` keeps its assigner meaning; no created_by column exists
    // because creator == owner on every proposal path.
    assigned_by: actor.employeeUuid,
    title: fields.title,
    description: fields.description,
    category: fields.category,
    target: fields.target,
    weight: null,
    start_date: fields.startDate,
    due_date: fields.dueDate,
    role_id: roleId,
    cycle_id: fields.cycleId,
    status: "not_started",
    approval_status: "draft",
    progress_method: fields.progressMethod,
    measurement_type: fields.measurementType,
    target_value: fields.targetValue,
    actual_value: null,
    measurement_unit: fields.measurementUnit,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
  };

  if (fields.priority !== null) payload.priority = fields.priority;
  payload.progress_percent = 0;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .insert(payload)
    .select(GOAL_SELECT)
    .single();

  if (error) {
    console.error("createOwnGoalProposal: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create goal proposal" },
      { status: 500 }
    );
  }

  const created = data as PerformanceGoal;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalCreated,
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
 * Edits the owner's own proposal while it is `draft` or `returned`.
 * Definition fields only; ownership, weight, approval, status, and progress
 * state are never editable here. Pending/approved/rejected goals are locked.
 */
export async function updateOwnGoalProposal(
  goalId: string,
  input: UpdateOwnGoalProposalInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RESPONSE();
  }
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.employee_id !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const editableError = requireEditableProposal(existing);
  if (editableError) return editableError;

  const fields = await parseProposalDefinitionFields(input);
  if (fields instanceof NextResponse) return fields;

  const roleId = await resolveOwnRoleId(actor.employeeUuid);

  for (const cycleId of [fields.cycleId, existing.cycle_id]) {
    const planError = await assertGoalPlanEditable({
      employeeId: existing.employee_id,
      cycleId,
    });
    if (planError) return planError;
  }

  const updated = await transitionGoal(
    id,
    { approval_status: existing.approval_status },
    {
      title: fields.title,
      description: fields.description,
      category: fields.category,
      target: fields.target,
      start_date: fields.startDate,
      due_date: fields.dueDate,
      ...(fields.priority !== null ? { priority: fields.priority } : {}),
      role_id: roleId,
      cycle_id: fields.cycleId,
      progress_method: fields.progressMethod,
      measurement_type: fields.measurementType,
      target_value: fields.targetValue,
      measurement_unit: fields.measurementUnit,
      updated_at: new Date().toISOString(),
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalUpdated,
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
 * Submits the owner's `draft`/`returned` proposal for manager review.
 * Clears prior review state so stale manager instructions are never mistaken
 * for the current review (history remains in the audit trail). Submission is
 * allowed even when the employee currently has no active manager: the
 * proposal enters `pending_manager_approval` for PerDev HR Admin review. No
 * manager identity is invented.
 */
export async function submitGoalProposal(
  goalId: string
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RESPONSE();
  }
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.employee_id !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  if (
    existing.approval_status !== "draft" &&
    existing.approval_status !== "returned"
  ) {
    return CONFLICT_RESPONSE(
      `Only draft or returned proposals can be submitted. Current approval state: "${existing.approval_status}".`
    );
  }

  // A proposal without a performance cycle cannot be weight-evaluated by the
  // reviewer (weight allocation is cycle-scoped) and can never become
  // appraisal-applicable (applicability filters by cycle). Drafts may exist
  // without a cycle, but submission fails closed so direct API calls cannot
  // bypass the requirement. The cycle must exist and must not be closed,
  // reusing the existing goal-cycle validation.
  if (!existing.cycle_id) {
    return BAD_REQUEST_RESPONSE(
      "A performance cycle is required before this proposal can be submitted for manager review. Edit your proposal to select a performance cycle."
    );
  }
  const submitCycle = await requireExistingCycleId(existing.cycle_id);
  if (submitCycle instanceof NextResponse) return submitCycle;

  const planError = await assertGoalPlanEditable({
    employeeId: existing.employee_id,
    cycleId: existing.cycle_id,
  });
  if (planError) return planError;

  const now = new Date().toISOString();

  const updated = await transitionGoal(
    id,
    { approval_status: existing.approval_status },
    {
      approval_status: "pending_manager_approval",
      submitted_at: now,
      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      updated_at: now,
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalSubmitted,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  const managerId = await loadEmployeeManagerId(updated.employee_id);
  let notifyManagerId: string | null = null;
  if (managerId) {
    const { data: manager } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, status")
      .eq("id", managerId)
      .maybeSingle();
    if (manager && (!manager.status || manager.status === "active")) {
      notifyManagerId = manager.id as string;
    }
  }

  await notifyProposalEvent({
    recipientEmployeeId: notifyManagerId,
    actor,
    title: "New goal proposal submitted",
    message: `${actor.accountFullName} submitted a goal proposal for your review.`,
    type: "goal.proposal_submitted",
    goalId: updated.id,
  });

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}

/**
 * Approves a pending proposal. The reviewer MUST supply the goal's appraisal
 * weight (validated with existing weight semantics); it is the only path by
 * which a proposal gains a weight. Execution status is untouched (remains
 * `not_started`); no appraisal is created or modified.
 */
export async function approveGoalProposal(
  goalId: string,
  input: ReviewGoalProposalInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.approval_status !== "pending_manager_approval") {
    return CONFLICT_RESPONSE(
      `Only pending proposals can be approved. Current approval state: "${existing.approval_status}".`
    );
  }

  if (existing.status !== "not_started") {
    return CONFLICT_RESPONSE(
      `Only proposals in pre-execution state can be approved. Current status: "${existing.status}".`
    );
  }

  const reviewer = await resolveProposalReviewer(actor, existing);
  if (reviewer instanceof NextResponse) return reviewer;

  const weight = requireWeight(input?.weight);
  if (weight instanceof NextResponse) return weight;
  if (weight === null) {
    return BAD_REQUEST_RESPONSE(
      "weight is required to approve a goal proposal."
    );
  }

  const note = requireOptionalReviewNote(input?.review_note);
  if (note instanceof NextResponse) return note;

  const planError = await assertGoalPlanEditable({
    employeeId: existing.employee_id,
    cycleId: existing.cycle_id,
  });
  if (planError) return planError;

  const now = new Date().toISOString();

  const updated = await transitionGoal(
    id,
    { approval_status: existing.approval_status },
    {
      approval_status: "approved",
      weight,
      reviewed_by: reviewer.reviewerEmployeeUuid,
      reviewed_at: now,
      review_note: note,
      updated_at: now,
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalApproved,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  await notifyProposalEvent({
    recipientEmployeeId: updated.employee_id,
    actor,
    title: "Goal proposal approved",
    message: `Your goal proposal "${updated.title}" was approved with a weight of ${weight}%.`,
    type: "goal.proposal_approved",
    goalId: updated.id,
  });

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}

/**
 * Returns a pending proposal for revision. Requires a reviewer note so the
 * owner knows what to change. Weight is cleared (NULL); execution status is
 * untouched. The owner may edit and resubmit.
 */
export async function returnGoalProposal(
  goalId: string,
  input: ReviewGoalProposalInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.approval_status !== "pending_manager_approval") {
    return CONFLICT_RESPONSE(
      `Only pending proposals can be returned. Current approval state: "${existing.approval_status}".`
    );
  }

  if (existing.status !== "not_started") {
    return CONFLICT_RESPONSE(
      `Only proposals in pre-execution state can be returned. Current status: "${existing.status}".`
    );
  }

  const reviewer = await resolveProposalReviewer(actor, existing);
  if (reviewer instanceof NextResponse) return reviewer;

  const note = requireReviewNote(input?.review_note);
  if (note instanceof NextResponse) return note;

  const now = new Date().toISOString();

  const updated = await transitionGoal(
    id,
    { approval_status: existing.approval_status },
    {
      approval_status: "returned",
      weight: null,
      reviewed_by: reviewer.reviewerEmployeeUuid,
      reviewed_at: now,
      review_note: note,
      updated_at: now,
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalReturned,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  await notifyProposalEvent({
    recipientEmployeeId: updated.employee_id,
    actor,
    title: "Goal proposal returned for revision",
    message: `Your goal proposal "${updated.title}" was returned for revision.`,
    type: "goal.proposal_returned",
    goalId: updated.id,
  });

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}

/**
 * Rejects a pending proposal. Terminal for the MVP: the row is preserved as
 * history, never becomes appraisal-applicable, and cannot be resubmitted
 * (the owner may start a new draft proposal instead).
 */
export async function rejectGoalProposal(
  goalId: string,
  input: ReviewGoalProposalInput
): Promise<PerformanceGoal | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const existing = await loadGoalOr404(id);
  if (existing instanceof NextResponse) return existing;

  if (existing.approval_status !== "pending_manager_approval") {
    return CONFLICT_RESPONSE(
      `Only pending proposals can be rejected. Current approval state: "${existing.approval_status}".`
    );
  }

  if (existing.status !== "not_started") {
    return CONFLICT_RESPONSE(
      `Only proposals in pre-execution state can be rejected. Current status: "${existing.status}".`
    );
  }

  const reviewer = await resolveProposalReviewer(actor, existing);
  if (reviewer instanceof NextResponse) return reviewer;

  const note = requireReviewNote(input?.review_note);
  if (note instanceof NextResponse) return note;

  const now = new Date().toISOString();

  const updated = await transitionGoal(
    id,
    { approval_status: existing.approval_status },
    {
      approval_status: "rejected",
      weight: null,
      reviewed_by: reviewer.reviewerEmployeeUuid,
      reviewed_at: now,
      review_note: note,
      updated_at: now,
    }
  );
  if (updated instanceof NextResponse) return updated;

  const { oldData, newData } = goalAuditDiff(existing, updated);

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalProposalRejected,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  await notifyProposalEvent({
    recipientEmployeeId: updated.employee_id,
    actor,
    title: "Goal proposal rejected",
    message: `Your goal proposal "${updated.title}" was rejected.`,
    type: "goal.proposal_rejected",
    goalId: updated.id,
  });

  const [enriched] = await enrichGoalsWithAssignerAccount([updated]);
  return enriched;
}