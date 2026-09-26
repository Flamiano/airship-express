import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import { MAX_CHECK_IN_MESSAGE_LENGTH } from "@/performance-development-dashboard/lib/constants";
import {
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  createNotifications,
} from "@/performance-development-dashboard/lib/performance/notifications";
import { rejectIfDraftCycle } from "@/performance-development-dashboard/lib/performance/cycles";
import { listEvidenceForCheckIn } from "@/performance-development-dashboard/lib/performance/goalEvidence";
import {
  CHECK_IN_FEEDBACK_TYPE,
  type CheckInAcknowledgment,
  type CheckInThreadSummary,
  type PerformanceCheckIn,
  type PerformanceCheckInMessage,
  type PerformanceCheckInThread,
} from "@/performance-development-dashboard/types";

/**
 * Check-ins domain.
 *
 * A Check-in is an ongoing performance conversation: a single, factual
 * conversational entry. It is intentionally NOT a rating, score, appraisal,
 * competency assessment, manager evaluation, or final evaluation.
 *
 * The transactional table is the reused live table
 * `hr3_performance_feedback`, which has no goal/cycle relationship and stores
 * the check-in content in a single `message` text column. Only the columns the
 * actual schema provides are used; no structured check-in fields or
 * goal/cycle/follow-up relationships are invented.
 *
 * Identity model:
 *
 *   hr_admin            authenticated HR account
 *   hr1_employees       central employee identity
 *   given_by            hr3_performance_feedback.given_by → hr1_employees.id
 *
 * `given_by` therefore represents the LINKED EMPLOYEE identity of the
 * authenticated actor, never the raw `hr_admin.id`. It is always derived
 * server-side from `getAuthenticatedActor()` → `actor.employeeUuid` and is
 * never accepted from the client.
 *
 * Supported scopes:
 *   1. Employee  — always scoped to `employee_id = me OR given_by = me`
 *   2. Manager   — `employee_id` within the server-resolved set of the
 *      manager's own employee record plus their active direct reports
 *      (`hr1_employees.manager_id`)
 *   3. HR admin  — all records, optional employee_id filter
 *
 * Records are APPEND-ONLY. No PATCH/PUT/DELETE, no status transitions, and
 * existing feedback rows are never mutated.
 *
 * CONVERSATION LAYER
 * ------------------
 * Each check-in root can carry a private two-way conversation in the dedicated
 * append-only table `hr3_performance_checkin_messages` (`message` / `reply` /
 * `acknowledgment` rows). The root row in `hr3_performance_feedback` is never
 * modified. All conversation operations re-authorize against the root through
 * `getCheckIn`, so HR organization-wide, manager self + active direct reports,
 * and employee owner-or-author scoping apply identically, and read/write
 * through conversation endpoints inherits the no-existence-oracle contract.
 */

/**
 * App-level ceiling for a check-in message.
 *
 * The live column is plain `text` with no database length limit, so the limit
 * below is a domain policy enforced by rejecting (400) rather than silently
 * truncating. It matches the maximum the previous application used for this
 * exact table (1000 characters).
 */

const CHECK_IN_SELECT =
  "id, employee_id, given_by, feedback_type, message, created_at";

/**
 * Column set for the conversation layer (`hr3_performance_checkin_messages`).
 * The acknowledgment rows use the same shape; `message_kind` discriminates.
 */
const CHECK_IN_MESSAGE_SELECT =
  "id, check_in_id, parent_message_id, employee_id, author_employee_id, author_account_id, message_kind, message, created_at";

export type ListCheckInsQuery = Record<string, unknown>;
export type CreatePerformanceCheckInInput = Record<string, unknown>;
export type CreateCheckInMessageInput = Record<string, unknown>;

const CHECK_IN_NOT_FOUND_RESPONSE = () =>
  NextResponse.json(
    { error: "Performance check-in not found" },
    { status: 404 },
  );

function requireNonEmptyText(
  value: unknown,
  field: string,
): string | NextResponse {
  if (typeof value !== "string" || value.trim() === "") {
    return BAD_REQUEST_RESPONSE(
      `${field} is required and must be a non-empty string.`,
    );
  }
  return value.trim();
}

/**
 * A check-in message must be a non-empty trimmed string no longer than
 * `MAX_CHECK_IN_MESSAGE_LENGTH`. Over-length input is rejected, never
 * truncated.
 */
function requireCheckInMessage(value: unknown): string | NextResponse {
  const message = requireNonEmptyText(value, "message");
  if (message instanceof NextResponse) return message;

  if (message.length > MAX_CHECK_IN_MESSAGE_LENGTH) {
    return BAD_REQUEST_RESPONSE(
      `message must be at most ${MAX_CHECK_IN_MESSAGE_LENGTH} characters.`,
    );
  }

  return message;
}

/**
 * Validates an HR-supplied check-in subject against `hr1_employees`.
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
 * Established employee read scope for check-ins, matching the prior feedback
 * semantics: a user sees check-ins about them (employee_id) or authored by
 * them (given_by).
 */
function isWithinEmployeeScope(
  checkIn: PerformanceCheckIn,
  employeeUuid: string,
): boolean {
  return (
    checkIn.employee_id === employeeUuid || checkIn.given_by === employeeUuid
  );
}

/**
 * Resolves the set of employee IDs a Manager may access: the manager's own
 * employee record plus all active direct reports (resolved server-side from
 * `hr1_employees.manager_id`). Returns null-free; always contains the manager
 * themselves.
 */
async function resolveManagerScopedEmployeeIds(
  managerEmployeeUuid: string,
): Promise<string[]> {
  const directReportIds =
    await resolveManagerDirectReportUuids(managerEmployeeUuid);
  return [managerEmployeeUuid, ...directReportIds];
}

/**
 * Loads a single check-in (ALWAYS filtered on the DB to `feedback_type =
 * 'check_in'`), returning a generic 404 for other feedback types so recognition,
 * coaching, and improvement records are never exposed or resolved through this
 * API.
 */
async function loadCheckInOr404(
  checkInId: string,
): Promise<PerformanceCheckIn | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .select(CHECK_IN_SELECT)
    .eq("id", checkInId)
    .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE)
    .maybeSingle();

  if (error) {
    console.error("loadCheckInOr404: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance check-in" },
      { status: 500 },
    );
  }

  if (!data) return CHECK_IN_NOT_FOUND_RESPONSE();

  return data as PerformanceCheckIn;
}

/**
 * Loads a single check-in INSIDE an established employee scope.
 *
 * The record UUID AND the employee's server-resolved UUID (as owner `employee_id`
 * OR author `given_by`) are applied as constraints in the SAME query, so a
 * check-in that does not exist and a check-in outside the caller's scope
 * resolve to the SAME not-found response (no record-existence oracle). The
 * `feedback_type = 'check_in'` filter is preserved, so recognition, coaching,
 * and improvement records stay unreachable through this API.
 */
async function loadCheckInWithinScope(
  checkInId: string,
  employeeUuid: string,
): Promise<PerformanceCheckIn | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .select(CHECK_IN_SELECT)
    .eq("id", checkInId)
    .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE)
    .or(`employee_id.eq.${employeeUuid},given_by.eq.${employeeUuid}`)
    .maybeSingle();

  if (error) {
    console.error("loadCheckInWithinScope: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance check-in" },
      { status: 500 },
    );
  }

  if (!data) return CHECK_IN_NOT_FOUND_RESPONSE();

  return data as PerformanceCheckIn;
}

/**
 * Loads a single check-in INSIDE an established Manager scope.
 *
 * The record UUID AND the manager's server-resolved scoped employee set (self
 * + active direct reports) are applied as constraints in the SAME query, so a
 * check-in that does not exist and a check-in outside the manager's scope
 * resolve to the SAME not-found response (no record-existence oracle). The
 * `feedback_type = 'check_in'` filter is preserved.
 */
async function loadCheckInWithinManagerScope(
  checkInId: string,
  scopedEmployeeIds: string[],
): Promise<PerformanceCheckIn | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .select(CHECK_IN_SELECT)
    .eq("id", checkInId)
    .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE)
    .in("employee_id", scopedEmployeeIds)
    .maybeSingle();

  if (error) {
    console.error("loadCheckInWithinManagerScope: query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance check-in" },
      { status: 500 },
    );
  }

  if (!data) return CHECK_IN_NOT_FOUND_RESPONSE();

  return data as PerformanceCheckIn;
}

/**
 * Batched HR-account enrichment for Check-in attribution display.
 *
 * Resolves WHO AUTHORED each check-in by reading the `checkin.created` audit
 * events for the given check-in ids in ONE query, then mapping those actor_ids
 * (`hr_admin.id`) back to account names in ONE query. Check-ins without a
 * `checkin.created` audit event (e.g. historical check-ins created before
 * audit logging) keep `givenByAccountName = null` so the caller falls back to
 * the employee-layer `given_by` identity.
 *
 * Critical: this never attributes a check-in to the currently authenticated
 * account. Attribution is read from persisted audit data only, and it never
 * replaces the business-layer `given_by` field.
 *
 * HR-ONLY. Callers must invoke this exclusively for HR-admin responses;
 * employee-scoped responses must remain untouched so employees never receive
 * HR account information through this display change.
 */
export async function enrichCheckInsWithAccountName(
  checkIns: PerformanceCheckIn[],
): Promise<PerformanceCheckIn[]> {
  if (checkIns.length === 0) return checkIns;

  const checkInIds = [...new Set(checkIns.map((checkIn) => checkIn.id))];

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from("hr3_audit_events")
    .select("entity_id, actor_id")
    .eq("entity_type", PERFORMANCE_AUDIT_ENTITY_TYPE.checkIn)
    .eq("action", PERFORMANCE_AUDIT_REASON.checkInCreated)
    .in("entity_id", checkInIds);

  if (auditError) {
    console.error(
      "enrichCheckInsWithAccountName: audit query error:",
      auditError,
    );
    return checkIns.map((checkIn) => ({
      ...checkIn,
      givenByAccountName: null,
    }));
  }

  const accountIds = [
    ...new Set((auditRows ?? []).map((row) => row.actor_id).filter(Boolean)),
  ] as string[];

  const accountNamesById: Record<string, string> = {};
  if (accountIds.length > 0) {
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, full_name")
      .in("id", accountIds);

    if (accountsError) {
      console.error(
        "enrichCheckInsWithAccountName: account lookup error:",
        accountsError,
      );
    } else {
      for (const account of accounts ?? []) {
        if (account.id && account.full_name) {
          accountNamesById[account.id] = account.full_name;
        }
      }
    }
  }

  const accountNameByCheckInId: Record<string, string> = {};
  for (const row of auditRows ?? []) {
    if (row.entity_id && row.actor_id && accountNamesById[row.actor_id]) {
      accountNameByCheckInId[row.entity_id] = accountNamesById[row.actor_id];
    }
  }

  return checkIns.map((checkIn) => ({
    ...checkIn,
    givenByAccountName: accountNameByCheckInId[checkIn.id] ?? null,
  }));
}

/**
 * Batch employee display-name resolution (`first_name last_name`) in ONE query.
 * Employee identities are read from `hr1_employees` server-side; client
 * identity is never used to build these names.
 */
async function resolveEmployeeNames(
  employeeIds: string[],
): Promise<Record<string, string>> {
  if (employeeIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, first_name, last_name")
    .in("id", employeeIds);

  if (error) {
    console.error("resolveEmployeeNames: query error:", error);
    return {};
  }

  const namesById: Record<string, string> = {};
  for (const employee of data ?? []) {
    namesById[employee.id] = `${employee.first_name ?? ""} ${
      employee.last_name ?? ""
    }`.trim();
  }
  return namesById;
}

/**
 * HR account display-name resolution in ONE query. Only invoked for HR-admin
 * readers so manager/employee readers never receive HR account information.
 */
async function resolveAccountNames(
  hrAdminIds: string[],
): Promise<Record<string, string>> {
  if (hrAdminIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("hr_admin")
    .select("id, full_name")
    .in("id", hrAdminIds);

  if (error) {
    console.error("resolveAccountNames: query error:", error);
    return {};
  }

  const namesById: Record<string, string> = {};
  for (const account of data ?? []) {
    if (account.id && account.full_name) {
      namesById[account.id] = account.full_name;
    }
  }
  return namesById;
}

/**
 * Resolves author attribution for thread messages.
 *
 * `authorDisplayName` is always the linked-employee identity name.
 * `authorAccountName` (the `hr_admin` account name) is attached ONLY when the
 * reader is an HR admin — employees/managers never receive the key, mirroring
 * the existing `givenByAccountName` safeguarding on check-in roots.
 */
async function resolveMessageAuthorNames(
  messages: PerformanceCheckInMessage[],
  includeAccount: boolean,
): Promise<PerformanceCheckInMessage[]> {
  if (messages.length === 0) return messages;

  const employeeIds = [
    ...new Set(messages.map((m) => m.author_employee_id).filter(Boolean)),
  ];
  const accountIds = includeAccount
    ? [
        ...new Set(
          messages.map((m) => m.author_account_id ?? "").filter(Boolean),
        ),
      ]
    : [];

  const [employeeNames, accountNames] = await Promise.all([
    resolveEmployeeNames(employeeIds),
    includeAccount
      ? resolveAccountNames(accountIds)
      : Promise.resolve({} as Record<string, string>),
  ]);

  return messages.map((message) => ({
    ...message,
    authorDisplayName: employeeNames[message.author_employee_id] ?? null,
    ...(includeAccount
      ? {
          authorAccountName: message.author_account_id
            ? (accountNames[message.author_account_id] ?? null)
            : null,
        }
      : {}),
  }));
}

/**
 * Attaches a lightweight conversation summary to a list of check-ins WITHOUT an
 * N+1: one aggregate query over `hr3_performance_checkin_messages` for all list
 * rows, aggregated in memory. `message/reply` rows count as comments; the
 * acknowledgment is reported separately and never counted as a comment.
 */
async function attachCheckInThreadSummaries(
  checkIns: PerformanceCheckIn[],
): Promise<PerformanceCheckIn[]> {
  if (checkIns.length === 0) return checkIns;

  const checkInIds = [...new Set(checkIns.map((checkIn) => checkIn.id))];

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .select(
      "check_in_id, message_kind, message, created_at, author_employee_id",
    )
    .in("check_in_id", checkInIds);

  if (error) {
    console.error("attachCheckInThreadSummaries: query error:", error);
    return checkIns.map((checkIn) => ({ ...checkIn, threadSummary: null }));
  }

  type Aggregate = {
    messageCount: number;
    latestMessageAt: string | null;
    ack: { author_employee_id: string; created_at: string } | null;
  };

  const byCheckIn = new Map<string, Aggregate>();
  for (const row of data ?? []) {
    let aggregate = byCheckIn.get(row.check_in_id);
    if (!aggregate) {
      aggregate = { messageCount: 0, latestMessageAt: null, ack: null };
      byCheckIn.set(row.check_in_id, aggregate);
    }

    if (row.message_kind === "acknowledgment") {
      if (!aggregate.ack || row.created_at > aggregate.ack.created_at) {
        aggregate.ack = row;
      }
    } else {
      aggregate.messageCount += 1;
      if (
        !aggregate.latestMessageAt ||
        row.created_at > aggregate.latestMessageAt
      ) {
        aggregate.latestMessageAt = row.created_at;
      }
    }
  }

  const ackAuthorIds = [
    ...new Set(
      [...byCheckIn.values()]
        .map((aggregate) => aggregate.ack?.author_employee_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const ackNamesById = await resolveEmployeeNames(ackAuthorIds);

  return checkIns.map((checkIn) => {
    const aggregate = byCheckIn.get(checkIn.id);
    if (!aggregate) {
      return { ...checkIn, threadSummary: null };
    }

    return {
      ...checkIn,
      threadSummary: {
        messageCount: aggregate.messageCount,
        latestMessageAt: aggregate.latestMessageAt,
        acknowledged: aggregate.ack !== null,
        acknowledgedByEmployeeName: aggregate.ack
          ? (ackNamesById[aggregate.ack.author_employee_id] ?? null)
          : null,
        acknowledgedAt: aggregate.ack ? aggregate.ack.created_at : null,
      } satisfies CheckInThreadSummary,
    };
  });
}

/**
 * Lists check-ins within authorized scope.
 *
 * Role-aware:
 * - HR admin scope: all check-ins (`feedback_type = 'check_in'`), with an
 *   optional validated `employee_id` filter.
 * - Manager scope: check-ins belonging to the manager themselves or to their
 *   active direct reports (`employee_id` within the server-resolved scoped
 *   set: `hr1_employees.manager_id` relationship). A client-supplied
 *   `employee_id` is never used as an authorization identity.
 * - Employee scope: only check-ins where `employee_id = me OR given_by = me`
 *   (identity resolved server-side). A client-supplied `employee_id` is never
 *   used as an authorization identity and never narrows/expands the employee
 *   scope.
 */
export async function listCheckIns(
  input: ListCheckInsQuery,
): Promise<PerformanceCheckIn[] | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    let query = supabaseAdmin
      .from("hr3_performance_feedback")
      .select(CHECK_IN_SELECT)
      .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE);

    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = requireValidUuid(input.employee_id, "employee_id");
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("listCheckIns: query error:", error);
      return NextResponse.json(
        { error: "Failed to load performance check-ins" },
        { status: 500 },
      );
    }

    const enriched = await enrichCheckInsWithAccountName(
      (data ?? []) as PerformanceCheckIn[],
    );
    return attachCheckInThreadSummaries(enriched);
  }

  // HR admin with a non-PerDev role: reject, do not fall through.
  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RESPONSE();
  }

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  let query = supabaseAdmin
    .from("hr3_performance_feedback")
    .select(CHECK_IN_SELECT)
    .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE);

  if (actor.actorType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(actor.employeeUuid);
    query = query.in("employee_id", scopedIds);
  } else {
    query = query.or(
      `employee_id.eq.${actor.employeeUuid},given_by.eq.${actor.employeeUuid}`,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listCheckIns: employee query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance check-ins" },
      { status: 500 },
    );
  }

  return attachCheckInThreadSummaries((data ?? []) as PerformanceCheckIn[]);
}

/**
 * Creates a check-in (append-only).
 *
 * `given_by` is always `identity.employeeUuid` resolved server-side from the
 * authenticated session and is never taken from the request body. `feedback_type`
 * is always forced to `check_in`. No client-supplied `given_by`, `feedback_type`,
 * identity, or role is ever trusted.
 *
 * Scope:
 * - HR admin: may file a check-in for any validated employee (defaults to own
 *   linked employee record when no employee_id is supplied).
 * - Manager: may file a check-in for themselves or an active direct report
 *   (server-verified). If no employee_id is supplied, defaults to self.
 * - Employee: employee_id is always the authenticated employee; a
 *   client-supplied employee_id is silently ignored.
 *
 * If the authenticated account has no linked employee record,
 * the operation is rejected (403), because a check-in cannot be authored
 * without an employee identity for `given_by`.
 */
export async function createCheckIn(
  input: CreatePerformanceCheckInInput,
): Promise<PerformanceCheckIn | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  let employeeId: string;

  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    if (
      input?.employee_id === undefined ||
      input?.employee_id === null ||
      input?.employee_id === ""
    ) {
      employeeId = actor.employeeUuid;
    } else {
      const parsedEmployeeId = await requireExistingEmployeeId(
        input.employee_id,
      );
      if (parsedEmployeeId instanceof NextResponse) return parsedEmployeeId;
      employeeId = parsedEmployeeId;
    }
  } else if (actor.actorType === "hr_admin") {
    // HR admin with a non-PerDev role: reject.
    return FORBIDDEN_RESPONSE();
  } else if (actor.actorType === "manager") {
    if (
      input?.employee_id === undefined ||
      input?.employee_id === null ||
      input?.employee_id === ""
    ) {
      employeeId = actor.employeeUuid;
    } else {
      const parsedEmployeeId = await requireExistingEmployeeId(
        input.employee_id,
      );
      if (parsedEmployeeId instanceof NextResponse) return parsedEmployeeId;

      const scopedIds = await resolveManagerScopedEmployeeIds(
        actor.employeeUuid,
      );
      if (!scopedIds.includes(parsedEmployeeId)) {
        return FORBIDDEN_RESPONSE();
      }
      employeeId = parsedEmployeeId;
    }
  } else {
    employeeId = actor.employeeUuid;
  }

  const message = requireCheckInMessage(input?.message);
  if (message instanceof NextResponse) return message;

  // Closed-cycle governance for goal-linked check-ins. When the caller
  // links the new check-in to a goal (`goal_id` is linkage intent only and
  // is never persisted — the schema has no check-in ↔ goal/cycle column),
  // the goal's cycle must not be closed. This runs BEFORE the shell/message
  // row is written so a rejection can never orphan a check-in, and before
  // audit/notification so denial is side-effect free. General check-ins
  // (no goal_id) are cycle-unaware by schema and always proceed. The
  // evidence filed afterwards re-enforces the same rule inside
  // createGoalEvidence.
  const rawGoalId = input?.goal_id;
  if (rawGoalId !== undefined && rawGoalId !== null && rawGoalId !== "") {
    if (typeof rawGoalId !== "string") {
      return BAD_REQUEST_RESPONSE("goal_id must be a string.");
    }
    const goalId = requireValidUuid(rawGoalId, "goal_id");
    if (goalId instanceof NextResponse) return goalId;

    const { data: goal, error: goalError } = await supabaseAdmin
      .from("hr3_performance_goals")
      .select("id, employee_id, cycle_id")
      .eq("id", goalId)
      .maybeSingle();

    if (goalError) {
      console.error("createCheckIn: linked goal query error:", goalError);
      return NextResponse.json(
        { error: "Failed to validate linked goal" },
        { status: 500 }
      );
    }
    if (!goal) return NOT_FOUND_RESPONSE("Performance goal");

    // The linked goal must belong to the check-in subject (mirrors the
    // ownership rule createGoalEvidence enforces for check_in_id).
    if (goal.employee_id !== employeeId) {
      return BAD_REQUEST_RESPONSE(
        "goal_id must reference a goal belonging to this check-in's employee."
      );
    }

    if (goal.cycle_id) {
      const { data: cycle, error: cycleError } = await supabaseAdmin
        .from("hr3_performance_cycles")
        .select("status")
        .eq("id", goal.cycle_id)
        .maybeSingle();
      if (cycleError) {
        console.error("createCheckIn: cycle query error:", cycleError);
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

      // Draft-cycle activation: a goal-linked check-in is active execution
      // and requires an opened cycle. General check-ins never reach here.
      const draftCycleError = await rejectIfDraftCycle(goal.cycle_id);
      if (draftCycleError) return draftCycleError;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_feedback")
    .insert({
      employee_id: employeeId,
      given_by: actor.employeeUuid,
      feedback_type: CHECK_IN_FEEDBACK_TYPE,
      message,
    })
    .select(CHECK_IN_SELECT)
    .single();

  if (error) {
    console.error("createCheckIn: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create performance check-in" },
      { status: 500 },
    );
  }

  const created = data as PerformanceCheckIn;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.checkInCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.checkIn,
    entityId: created.id,
    oldData: null,
    newData: {
      id: created.id,
      employee_id: created.employee_id,
      given_by: created.given_by,
      feedback_type: created.feedback_type,
      message: created.message,
      created_at: created.created_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  /* Best-effort notifications: notify the recipient of the check-in. */
  {
    const recipientId =
      created.employee_id !== actor.employeeUuid
        ? created.employee_id
        : created.given_by && created.given_by !== actor.employeeUuid
          ? created.given_by
          : null;
    if (recipientId) {
      await createNotifications([
        {
          type: "checkin.created",
          title: "Check-In Created",
          message: `A new check-in has been created for you.`,
          actor_employee_id: actor.employeeUuid,
          recipient_employee_id: recipientId,
          link: `/performance-development-dashboard/check-ins?checkin=${created.id}`,
          entity_id: created.id,
        },
      ]);
    }
  }

  // HR creators see their account attribution immediately. Employee/Manager
  // creators keep the business-layer identity; employee-facing responses are
  // never enriched with hr_admin account information.
  if (actor.actorType === "hr_admin") {
    const [enriched] = await enrichCheckInsWithAccountName([created]);
    return enriched;
  }

  return created;
}

/**
 * Retrieves a single check-in within authorized scope.
 *
 * Role/scope-aware:
 * - HR admin scope may read any check-in. A non-existent record returns 404.
 * - Manager scope may read check-ins belonging to themselves or their active
 *   direct reports. The manager's server-resolved scoped employee set is
 *   applied inside the load, so "does not exist" and "not in your scope" are
 *   indistinguishable (both 404). Only records within their scope are read.
 * - Any other authenticated user is treated as an employee. The employee's
 *   server-resolved UUID is asserted FIRST and applied as an owner-or-author
 *   constraint inside the load, so "does not exist" and "not in your scope"
 *   are indistinguishable (both 404). Only records within their established
 *   scope are ever read.
 *
 * Non-check-in feedback rows resolve to 404 because the loader always filters
 * the database to `feedback_type = 'check_in'`.
 */
export async function getCheckIn(
  checkInId: string,
): Promise<PerformanceCheckIn | NextResponse> {
  const id = requireValidUuid(checkInId, "check-in id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    // HR admin scope: may read any check-in; 404 only for a genuinely missing
    // record to an already-authorized admin.
    const existing = await loadCheckInOr404(id);
    if (existing instanceof NextResponse) return existing;

    const [enriched] = await enrichCheckInsWithAccountName([existing]);
    return enriched;
  }

  // HR admin with a non-PerDev role: reject, do not fall through.
  if (actor.actorType === "hr_admin") {
    return FORBIDDEN_RESPONSE();
  }

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  if (actor.actorType === "manager") {
    // Manager scope: apply the server-resolved scoped set (self + active
    // direct reports) inside the query, so missing and out-of-scope resolve to
    // the same not-found response.
    const scopedIds = await resolveManagerScopedEmployeeIds(actor.employeeUuid);
    return loadCheckInWithinManagerScope(id, scopedIds);
  }

  // Employee scope: resolve the authenticated employee FIRST, then load with
  // their UUID (owner or author) applied inside the query. A record that is
  // missing and a record outside the caller's scope resolve to the same
  // not-found response.
  const existing = await loadCheckInWithinScope(id, actor.employeeUuid);
  if (existing instanceof NextResponse) return existing;

  if (!isWithinEmployeeScope(existing, actor.employeeUuid)) {
    console.error(
      "getCheckIn: check-in is not within the requesting employee's scope",
    );
    return FORBIDDEN_RESPONSE();
  }

  return existing;
}

/**
 * Loads the parent of a reply inside the SAME check-in thread.
 *
 * The parent id AND the thread root id are applied in one query, so a parent
 * from another check-in (or an acknowledgment) never resolves. Acknowledgment
 * rows are excluded on purpose: you cannot reply to an acknowledgment.
 */
async function loadParentMessageInThread(
  parentMessageId: string,
  checkInId: string,
): Promise<{ id: string } | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .select("id")
    .eq("id", parentMessageId)
    .eq("check_in_id", checkInId)
    .in("message_kind", ["message", "reply"])
    .maybeSingle();

  if (error) {
    console.error("loadParentMessageInThread: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate reply parent" },
      { status: 500 },
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "Reply parent must reference an existing comment in this check-in thread.",
    );
  }

  return data;
}

/**
 * Loads the full private conversation for one check-in.
 *
 * Authorization reuses `getCheckIn`, so every scope rule (HR organization-wide,
 * manager self + active direct reports, employee owner-or-author) and the
 * no-existence-oracle 404 behavior apply unchanged. Only `message`/`reply`
 * rows are returned as `messages`; the acknowledgment (if any) is surfaced
 * separately and is never rendered as an ordinary comment.
 *
 * Author display names are resolved server-side; HR account names are attached
 * only for HR-admin readers.
 *
 * Goal evidence linked to the check-in is attached as `evidence`, resolved
 * server-side through `listEvidenceForCheckIn` (per-row evidence read
 * authorization applies; out-of-scope rows are omitted). General check-ins
 * carry an empty array.
 */
export async function listCheckInThread(
  checkInId: string,
): Promise<PerformanceCheckInThread | NextResponse> {
  const root = await getCheckIn(checkInId);
  if (root instanceof NextResponse) return root;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const includeAccount = actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);

  const messagesQuery = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .select(CHECK_IN_MESSAGE_SELECT)
    .eq("check_in_id", checkInId)
    .in("message_kind", ["message", "reply"])
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (messagesQuery.error) {
    console.error(
      "listCheckInThread: messages query error:",
      messagesQuery.error,
    );
    return NextResponse.json(
      { error: "Failed to load the check-in conversation" },
      { status: 500 },
    );
  }

  const acknowledgmentQuery = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .select(CHECK_IN_MESSAGE_SELECT)
    .eq("check_in_id", checkInId)
    .eq("message_kind", "acknowledgment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (acknowledgmentQuery.error) {
    console.error(
      "listCheckInThread: acknowledgment query error:",
      acknowledgmentQuery.error,
    );
    return NextResponse.json(
      { error: "Failed to load the check-in conversation" },
      { status: 500 },
    );
  }

  const messages = await resolveMessageAuthorNames(
    (messagesQuery.data ?? []) as PerformanceCheckInMessage[],
    includeAccount,
  );

  let acknowledgment: CheckInAcknowledgment | null = null;
  if (acknowledgmentQuery.data) {
    const ackRow = acknowledgmentQuery.data as unknown as CheckInAcknowledgment;
    const ackNamesById = await resolveEmployeeNames([
      ackRow.author_employee_id,
    ]);
    acknowledgment = {
      ...ackRow,
      acknowledgedByEmployeeName:
        ackNamesById[ackRow.author_employee_id] ?? null,
    };
  }

  return { checkIn: root, messages, acknowledgment, evidence: await listEvidenceForCheckIn(checkInId, actor) };
}

/**
 * Posts a `message` (top-level comment) or `reply` (attached to a comment) to
 * an authorized check-in conversation.
 *
 * Authorization reuses `getCheckIn` for the ROOT, then enforces the authoring
 * scope on the SUBJECT employee:
 * - HR admin: any authorized check-in (existing HR scope).
 * - Manager: subject within the manager's server-resolved self + active
 *   direct reports.
 * - Employee: subject must be the authenticated employee's own UUID.
 *
 * `employee_id`, `author_employee_id`, `author_account_id`, and `message_kind`
 * are always derived server-side and never read from the request. A supplied
 * `parent_message_id` is validated to belong to the SAME check-in, so a message
 * from one check-in can never be attached to another.
 *
 * Audit attribution uses the authenticated account via
 * `auditActorFromPerDevActor` (`hr_admin.id` for HR, never the linked employee
 * as a substitute).
 */
export async function createCheckInMessage(
  checkInId: string,
  input: CreateCheckInMessageInput,
): Promise<PerformanceCheckInMessage | NextResponse> {
  const root = await getCheckIn(checkInId);
  if (root instanceof NextResponse) return root;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    // Existing HR scope applies (any authorized check-in).
  } else if (actor.actorType === "hr_admin") {
    // HR admin with a non-PerDev role: reject.
    return FORBIDDEN_RESPONSE();
  } else if (actor.actorType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(actor.employeeUuid);
    if (!scopedIds.includes(root.employee_id)) {
      return FORBIDDEN_RESPONSE();
    }
  } else if (root.employee_id !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const message = requireCheckInMessage(input?.message);
  if (message instanceof NextResponse) return message;

  const rawParent = input?.parent_message_id;
  const hasParent =
    rawParent !== undefined && rawParent !== null && rawParent !== "";

  let parentMessageId: string | null = null;
  if (hasParent) {
    const parsed = requireValidUuid(rawParent, "parent_message_id");
    if (parsed instanceof NextResponse) return parsed;

    const parent = await loadParentMessageInThread(parsed, checkInId);
    if (parent instanceof NextResponse) return parent;

    parentMessageId = parsed;
  }

  const messageKind = hasParent ? "reply" : "message";

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .insert({
      check_in_id: checkInId,
      parent_message_id: parentMessageId,
      employee_id: root.employee_id,
      author_employee_id: actor.employeeUuid,
      author_account_id: actor.hrAdminId,
      message_kind: messageKind,
      message,
    })
    .select(CHECK_IN_MESSAGE_SELECT)
    .single();

  if (error) {
    console.error("createCheckInMessage: insert error:", error);
    return NextResponse.json(
      { error: "Failed to post to the check-in conversation" },
      { status: 500 },
    );
  }

  const createdMessage = data as PerformanceCheckInMessage;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.checkInMessagePosted,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.checkIn,
    entityId: checkInId,
    oldData: null,
    newData: {
      id: createdMessage.id,
      check_in_id: createdMessage.check_in_id,
      parent_message_id: createdMessage.parent_message_id,
      employee_id: createdMessage.employee_id,
      author_employee_id: createdMessage.author_employee_id,
      author_account_id: createdMessage.author_account_id,
      message_kind: createdMessage.message_kind,
      message: createdMessage.message,
      created_at: createdMessage.created_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  /* Best-effort notifications: notify the other party in the conversation. */
  {
    // Determine the correct recipient based on who authored the message:
    // - If the subject employee authored it → notify given_by (the check-in
    //   creator/manager) if available and different from the author.
    // - If someone else authored it → notify the subject employee.
    const recipientId =
      createdMessage.author_employee_id !== root.employee_id
        ? root.employee_id
        : root.given_by && root.given_by !== actor.employeeUuid
          ? root.given_by
          : null;
    if (recipientId) {
      await createNotifications([
        {
          type: "checkin.message_posted",
          title: "New Check-In Message",
          message: `A new message has been posted in your check-in conversation.`,
          actor_employee_id: actor.employeeUuid,
          recipient_employee_id: recipientId,
          link: `/performance-development-dashboard/check-ins?checkin=${root.id}`,
          entity_id: root.id,
        },
      ]);
    }
  }

  const includeAccount = actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);
  const [resolved] = await resolveMessageAuthorNames(
    [createdMessage],
    includeAccount,
  );
  return resolved;
}

/**
 * Records the subject employee's acknowledgment of a check-in (append-only
 * `message_kind = 'acknowledgment'` row).
 *
 * Only the SUBJECT employee identity may acknowledge (an HR admin or manager
 * acknowledges only when they are the actual recipient of the check-in — i.e.
 * their linked employee UUID equals the check-in's `employee_id`). No
 * acknowledgment use case is invented for the HR/manager role.
 *
 * Idempotent: an existing acknowledgment for the same employee + check-in
 * returns the existing record instead of inserting a duplicate. A partial
 * unique index on `(check_in_id, author_employee_id) where message_kind =
 * 'acknowledgment'` makes concurrent double-submissions safe at the database
 * level too.
 */
export async function acknowledgeCheckIn(
  checkInId: string,
): Promise<CheckInAcknowledgment | NextResponse> {
  const root = await getCheckIn(checkInId);
  if (root instanceof NextResponse) return root;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  if (root.employee_id !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  const existing = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .select(CHECK_IN_MESSAGE_SELECT)
    .eq("check_in_id", checkInId)
    .eq("message_kind", "acknowledgment")
    .eq("author_employee_id", actor.employeeUuid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    console.error("acknowledgeCheckIn: existing lookup error:", existing.error);
    return NextResponse.json(
      { error: "Failed to acknowledge the check-in" },
      { status: 500 },
    );
  }

  if (existing.data) {
    const ackNamesById = await resolveEmployeeNames([actor.employeeUuid]);
    return {
      ...(existing.data as unknown as CheckInAcknowledgment),
      acknowledgedByEmployeeName: ackNamesById[actor.employeeUuid] ?? null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_checkin_messages")
    .insert({
      check_in_id: checkInId,
      parent_message_id: null,
      employee_id: root.employee_id,
      author_employee_id: actor.employeeUuid,
      author_account_id: actor.hrAdminId,
      message_kind: "acknowledgment",
      message: "Acknowledged this check-in.",
    })
    .select(CHECK_IN_MESSAGE_SELECT)
    .single();

  if (error) {
    // Unique-violation from a concurrent acknowledgment: treat as idempotent
    // success by returning the existing record.
    if (error.code === "23505") {
      const retry = await supabaseAdmin
        .from("hr3_performance_checkin_messages")
        .select(CHECK_IN_MESSAGE_SELECT)
        .eq("check_in_id", checkInId)
        .eq("message_kind", "acknowledgment")
        .eq("author_employee_id", actor.employeeUuid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!retry.error && retry.data) {
        const ackNamesById = await resolveEmployeeNames([actor.employeeUuid]);
        return {
          ...(retry.data as unknown as CheckInAcknowledgment),
          acknowledgedByEmployeeName: ackNamesById[actor.employeeUuid] ?? null,
        };
      }
    }

    console.error("acknowledgeCheckIn: insert error:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge the check-in" },
      { status: 500 },
    );
  }

  const created = data as unknown as CheckInAcknowledgment;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.checkInAcknowledged,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.checkIn,
    entityId: checkInId,
    oldData: null,
    newData: {
      id: created.id,
      check_in_id: created.check_in_id,
      employee_id: created.employee_id,
      author_employee_id: created.author_employee_id,
      author_account_id: created.author_account_id,
      message_kind: created.message_kind,
      message: created.message,
      created_at: created.created_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  /* Best-effort notification: notify the check-in author. */
  {
    const recipientId =
      root.given_by && root.given_by !== actor.employeeUuid
        ? root.given_by
        : null;
    if (recipientId) {
      await createNotifications([
        {
          type: "checkin.acknowledged",
          title: "Check-In Acknowledged",
          message: `The employee has acknowledged the check-in.`,
          actor_employee_id: actor.employeeUuid,
          recipient_employee_id: recipientId,
          link: `/performance-development-dashboard/check-ins?checkin=${root.id}`,
          entity_id: root.id,
        },
      ]);
    }
  }

  const ackNamesById = await resolveEmployeeNames([actor.employeeUuid]);
  return {
    ...created,
    acknowledgedByEmployeeName: ackNamesById[actor.employeeUuid] ?? null,
  };
}
