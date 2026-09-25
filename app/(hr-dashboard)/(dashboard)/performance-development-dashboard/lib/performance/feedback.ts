import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { resolveManagerDirectReportUuids } from "@/performance-development-dashboard/lib/auth/access";
import {
  getAuthenticatedActor,
  type PerDevActor,
} from "@/performance-development-dashboard/lib/auth/actor";
import { isPerDevHrAdminRole } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH,
  MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireOptionalText,
  requireValidUuid,
  ABSENT,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  FEEDBACK_REQUEST_STATUSES,
  type FeedbackRequestListItem,
  type FeedbackRequestRespondInput,
  type FeedbackRequestStatus,
  type PerformanceFeedbackRequest,
} from "@/performance-development-dashboard/types";

export type {
  FeedbackRequestCreateInput,
  FeedbackRequestListItem,
  FeedbackRequestRespondInput,
  FeedbackRequestStatus,
  PerformanceFeedbackRequest,
} from "@/performance-development-dashboard/types";

/**
 * Feedback Requests domain — request model plus Phase 2 service operations.
 * Route handlers live under `api/performance/feedback/requests`; no UI.
 *
 * A request represents: "Employee A is requesting feedback from Employee B
 * about Employee A." The requested feedback is ABOUT the requester.
 *
 *   requester_employee_id = the employee requesting feedback (the subject).
 *   recipient_employee_id = the person asked to provide feedback (the giver).
 *
 * Storage is the dedicated `hr3_performance_feedback_requests` table.
 * `hr3_performance_feedback` (shared live state for check_in / recognition /
 * coaching / improvement) is NEVER read or written by this domain.
 *
 * Status machine (DB CHECK-enforced, terminal states have no outgoing
 * transitions):
 *
 *   pending → fulfilled | declined
 *
 * Fulfillment records `response_message` and stamps `responded_at`; a decline
 * stamps `responded_at` and may leave `response_message` null. `updated_at`
 * has no database trigger and is stamped server-side on every write.
 *
 * Identity model: the ONLY identity source is `getAuthenticatedActor()`.
 * No second identity system is introduced; `hrAdminId` and `employeeUuid`
 * keep their existing meanings.
 *
 * Authorization design (enforced by Phase 2 routes; predicates live here):
 *
 *   Employee — may create a request only with requester = themselves
 *     (requesting on behalf of another employee is rejected); may view a
 *     request only when they are its requester or its recipient; may respond
 *     only to requests where recipient = themselves.
 *   Manager — same self-only rule as Employee in v1: may request feedback
 *     for themselves and respond to requests addressed to themselves.
 *     Manager scope does NOT automatically grant access to arbitrary
 *     employees' requests; `resolveManagerFeedbackScopedIds` exists ONLY for
 *     a later explicit manager-view feature and is not applied by default.
 *   PerDev HR Admin (`super_admin` / `hr_performance_admin`) — the `all`
 *     scope is defined for a later administrative-visibility phase; no route
 *     exposes it in Phase 1.
 *   Non-PerDev HR — rejected (403), never falls through to employee scope.
 *
 * Audit rule: `feedback.requested` / `feedback.responded` /
 * `feedback.declined` events carry ids, status, and timestamps ONLY — never
 * `request_message` or `response_message` content.
 */

export const FEEDBACK_REQUESTS_TABLE = "hr3_performance_feedback_requests";

/** Column set for feedback-request reads (every live column, nothing more). */
export const FEEDBACK_REQUEST_SELECT =
  "id, requester_employee_id, recipient_employee_id, status, request_message, response_message, requested_at, responded_at, created_at, updated_at";

/**
 * Allowed forward transitions. `pending` may move to either terminal state;
 * terminal states have no outgoing transitions (a responded request is never
 * reopened or edited).
 */
export const FEEDBACK_REQUEST_TRANSITIONS: Record<
  FeedbackRequestStatus,
  readonly FeedbackRequestStatus[]
> = {
  pending: ["fulfilled", "declined"],
  fulfilled: [],
  declined: [],
};

export function isFeedbackRequestStatus(
  value: unknown,
): value is FeedbackRequestStatus {
  return (
    typeof value === "string" &&
    (FEEDBACK_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Validates the optional context attached to a new request. Absent/null →
 * null; over-length → 400. Never truncated.
 */
export function requireFeedbackRequestMessage(
  value: unknown,
): string | null | NextResponse {
  const result = requireOptionalText(
    value,
    "request_message",
    MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH,
  );
  if (result instanceof NextResponse) return result;
  if (result === ABSENT) return null;
  return result;
}

export type ParsedFeedbackResponse =
  | { decision: "fulfilled"; responseMessage: string }
  | { decision: "declined"; responseMessage: string | null };

/**
 * Validates a response to a pending request. Fulfillment requires a
 * non-empty response; a decline accepts an optional response. Over-length
 * input is rejected, never truncated.
 */
export function requireFeedbackResponse(
  input: FeedbackRequestRespondInput,
): ParsedFeedbackResponse | NextResponse {
  const decision = input?.decision;
  if (decision !== "fulfilled" && decision !== "declined") {
    return BAD_REQUEST_RESPONSE(
      'decision must be either "fulfilled" or "declined".',
    );
  }

  const rawMessage = input?.response_message;

  if (decision === "fulfilled") {
    if (typeof rawMessage !== "string" || rawMessage.trim() === "") {
      return BAD_REQUEST_RESPONSE(
        "response_message is required when fulfilling a feedback request.",
      );
    }
    if (rawMessage.trim().length > MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH) {
      return BAD_REQUEST_RESPONSE(
        `response_message must be at most ${MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH} characters.`,
      );
    }
    return { decision, responseMessage: rawMessage.trim() };
  }

  const result = requireOptionalText(
    rawMessage,
    "response_message",
    MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH,
  );
  if (result instanceof NextResponse) return result;
  if (result === ABSENT) return { decision, responseMessage: null };
  return { decision, responseMessage: result };
}

/**
 * Validates a recipient employee id: well-formed UUID referencing an existing
 * `hr1_employees` row. A non-existent employee is a 400 (matching the
 * existing check-in convention), never a scope oracle.
 */
export async function requireFeedbackRecipientId(
  value: unknown,
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "recipient_employee_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireFeedbackRecipientId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate recipient employee" },
      { status: 500 },
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "recipient_employee_id does not reference an existing employee.",
    );
  }

  return id;
}

/**
 * Employee visibility predicate for a request row: the authenticated employee
 * sees a request only when they are its requester (feedback about them) or
 * its recipient (feedback asked of them).
 */
export function isWithinEmployeeFeedbackScope(
  request: Pick<
    PerformanceFeedbackRequest,
    "requester_employee_id" | "recipient_employee_id"
  >,
  employeeUuid: string,
): boolean {
  return (
    request.requester_employee_id === employeeUuid ||
    request.recipient_employee_id === employeeUuid
  );
}

/** Pure creation rule: the requester must be the authenticated employee. */
export function meetsSelfRequesterRule(
  actor: Pick<PerDevActor, "employeeUuid">,
  requesterEmployeeId: string,
): boolean {
  return (
    actor.employeeUuid !== null &&
    requesterEmployeeId === actor.employeeUuid
  );
}

/** Pure response rule: only the addressed recipient may respond. */
export function meetsRecipientRule(
  actor: Pick<PerDevActor, "employeeUuid">,
  request: Pick<PerformanceFeedbackRequest, "recipient_employee_id">,
): boolean {
  return (
    actor.employeeUuid !== null &&
    request.recipient_employee_id === actor.employeeUuid
  );
}

/**
 * Resolves the employee set for a LATER explicit manager-view feature: the
 * manager's own record plus active direct reports (`hr1_employees.manager_id`).
 * NOT applied to any Phase 1 scope — v1 managers see only requests where
 * they are the requester or the recipient.
 */
export async function resolveManagerFeedbackScopedIds(
  managerEmployeeUuid: string,
): Promise<string[]> {
  const directReportIds =
    await resolveManagerDirectReportUuids(managerEmployeeUuid);
  return [managerEmployeeUuid, ...directReportIds];
}

export type FeedbackRequestScope =
  | { kind: "all" }
  | { kind: "self"; employeeUuid: string };

/**
 * Resolves the caller's request-visibility scope for Phase 2 routes.
 *
 * - PerDev HR Admin → `all` (organization-wide administrative visibility,
 *   consumed by the list/get routes; kept separate from employee/manager
 *   access).
 * - Manager / Employee → `self`: only rows where requester = me (Received)
 *   or recipient = me (Given). Manager direct reports are deliberately NOT
 *   folded in.
 * - Non-PerDev HR, or an account with no linked employee → 403.
 */
export async function resolveFeedbackRequestScope(): Promise<
  FeedbackRequestScope | NextResponse
> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin") {
    if (!isPerDevHrAdminRole(actor.role)) return FORBIDDEN_RESPONSE();
    return { kind: "all" };
  }

  if (!actor.employeeUuid) return FORBIDDEN_RESPONSE();

  return { kind: "self", employeeUuid: actor.employeeUuid };
}

/* =====================================================================
 * READ MODELS
 * ===================================================================== */

export type ListFeedbackRequestsQuery = Record<string, unknown>;
export type CreateFeedbackRequestValues = Record<string, unknown>;
export type RespondFeedbackRequestValues = Record<string, unknown>;

type FeedbackEmployeeRow = {
  id: string;
  employee_id_number: string | null;
  first_name: string | null;
  last_name: string | null;
};

/**
 * Batched employee display resolution in ONE query. Display-only; never used
 * for authorization.
 */
async function loadFeedbackEmployeesById(
  ids: string[],
): Promise<Map<string, FeedbackEmployeeRow>> {
  const map = new Map<string, FeedbackEmployeeRow>();
  const unique = [...new Set(ids)].filter(Boolean) as string[];
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, employee_id_number, first_name, last_name")
    .in("id", unique);

  if (error) {
    console.error("loadFeedbackEmployeesById: query error:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row as FeedbackEmployeeRow);
  }
  return map;
}

function feedbackEmployeeDisplay(employee: FeedbackEmployeeRow | undefined): {
  name: string;
  number: string;
} {
  if (!employee) {
    return { name: "Unknown employee", number: "" };
  }
  return {
    name:
      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
      "Unknown employee",
    number: employee.employee_id_number ?? "",
  };
}

/**
 * Pure display enrichment for request rows: resolves requester/recipient
 * names and employee numbers server-side. Not used for authorization.
 */
async function enrichFeedbackRequests(
  rows: PerformanceFeedbackRequest[],
): Promise<FeedbackRequestListItem[]> {
  if (rows.length === 0) return [];

  const employees = await loadFeedbackEmployeesById(
    rows.flatMap((row) => [
      row.requester_employee_id,
      row.recipient_employee_id,
    ]),
  );

  return rows.map((row) => {
    const requesterDisplay = feedbackEmployeeDisplay(
      employees.get(row.requester_employee_id),
    );
    const recipientDisplay = feedbackEmployeeDisplay(
      employees.get(row.recipient_employee_id),
    );
    return {
      ...row,
      requesterName: requesterDisplay.name,
      requesterNumber: requesterDisplay.number,
      recipientName: recipientDisplay.name,
      recipientNumber: recipientDisplay.number,
    };
  });
}

/**
 * Lists feedback requests within authorized scope, newest first.
 *
 * - PerDev HR Admin: all requests (`all` scope).
 * - Manager / Employee: only requests where requester = me (Received) or
 *   recipient = me (Given), applied as constraints in the SAME query.
 * - Non-PerDev HR: 403 via `resolveFeedbackRequestScope()`.
 */
export async function listFeedbackRequests(): Promise<
  FeedbackRequestListItem[] | NextResponse
> {
  const scope = await resolveFeedbackRequestScope();
  if (scope instanceof NextResponse) return scope;

  let query = supabaseAdmin
    .from(FEEDBACK_REQUESTS_TABLE)
    .select(FEEDBACK_REQUEST_SELECT);

  if (scope.kind === "self") {
    query = query.or(
      `requester_employee_id.eq.${scope.employeeUuid},recipient_employee_id.eq.${scope.employeeUuid}`,
    );
  }

  const { data, error } = await query
    .order("requested_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listFeedbackRequests: query error:", error);
    return NextResponse.json(
      { error: "Failed to load feedback requests" },
      { status: 500 },
    );
  }

  return enrichFeedbackRequests((data ?? []) as PerformanceFeedbackRequest[]);
}

/**
 * Creates a feedback request (always `pending`).
 *
 * The requester is ALWAYS the authenticated employee, resolved server-side —
 * `requester_employee_id` is never accepted from the client, and PerDev HR
 * Admins cannot create on behalf of another employee. The recipient must be
 * an existing, different employee (self-requests are rejected before the DB
 * CHECK is reached). `status` and all timestamps are server-authored.
 */
export async function createFeedbackRequest(
  input: CreateFeedbackRequestValues,
): Promise<FeedbackRequestListItem | NextResponse> {
  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin" && !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RESPONSE();
  }
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }
  const requesterId = actor.employeeUuid;

  const recipientId = await requireFeedbackRecipientId(
    input?.recipient_employee_id,
  );
  if (recipientId instanceof NextResponse) return recipientId;

  if (recipientId === requesterId) {
    return BAD_REQUEST_RESPONSE(
      "You cannot request feedback from yourself.",
    );
  }

  const requestMessage = requireFeedbackRequestMessage(
    input?.request_message,
  );
  if (requestMessage instanceof NextResponse) return requestMessage;

  const { data, error } = await supabaseAdmin
    .from(FEEDBACK_REQUESTS_TABLE)
    .insert({
      requester_employee_id: requesterId,
      recipient_employee_id: recipientId,
      status: "pending",
      request_message: requestMessage,
      response_message: null,
      responded_at: null,
    })
    .select(FEEDBACK_REQUEST_SELECT)
    .single();

  if (error) {
    if (error.code === "23514") {
      return BAD_REQUEST_RESPONSE(
        "You cannot request feedback from yourself.",
      );
    }
    console.error("createFeedbackRequest: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create feedback request" },
      { status: 500 },
    );
  }

  const created = data as PerformanceFeedbackRequest;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.feedbackRequested,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.feedbackRequest,
    entityId: created.id,
    oldData: null,
    newData: {
      id: created.id,
      requester_employee_id: created.requester_employee_id,
      recipient_employee_id: created.recipient_employee_id,
      status: created.status,
      requested_at: created.requested_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichFeedbackRequests([created]);
  return enriched;
}

/**
 * Loads a single request inside the caller's scope.
 *
 * - PerDev HR Admin: any request (`all` scope); genuinely missing rows → 404.
 * - Manager / Employee: the row id AND the requester-or-recipient constraint
 *   are applied in the SAME query, so a missing row and an out-of-scope row
 *   resolve to the SAME 404 (no existence oracle). The follow-up predicate is
 *   a non-logging belt-and-braces check, never an authorization probe.
 * - Non-PerDev HR: 403.
 */
export async function getFeedbackRequest(
  requestId: string,
): Promise<FeedbackRequestListItem | NextResponse> {
  const id = requireValidUuid(requestId, "feedback request id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  const isAdmin =
    actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);
  if (actor.actorType === "hr_admin" && !isAdmin) {
    return FORBIDDEN_RESPONSE();
  }
  if (!isAdmin && !actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  let query = supabaseAdmin
    .from(FEEDBACK_REQUESTS_TABLE)
    .select(FEEDBACK_REQUEST_SELECT)
    .eq("id", id);

  if (!isAdmin) {
    if (!actor.employeeUuid) return FORBIDDEN_RESPONSE();
    query = query.or(
      `requester_employee_id.eq.${actor.employeeUuid},recipient_employee_id.eq.${actor.employeeUuid}`,
    );
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("getFeedbackRequest: query error:", error);
    return NextResponse.json(
      { error: "Failed to load feedback request" },
      { status: 500 },
    );
  }

  if (!data) return NOT_FOUND_RESPONSE("Feedback request");

  const row = data as PerformanceFeedbackRequest;

  if (
    !isAdmin &&
    actor.employeeUuid &&
    !isWithinEmployeeFeedbackScope(row, actor.employeeUuid)
  ) {
    return NOT_FOUND_RESPONSE("Feedback request");
  }

  const [enriched] = await enrichFeedbackRequests([row]);
  return enriched;
}

/**
 * Records the recipient's response to a pending request.
 *
 * ONLY the addressed recipient may respond: the row id AND
 * `recipient_employee_id = me` are applied in the SAME query, so the
 * requester, unrelated employees, managers-by-relationship, and HR Admins
 * acting beyond their own addressed requests all resolve to the same 404.
 * Terminal requests cannot be responded to again (409). The transition is
 * guarded with `eq("status", "pending")` so a concurrent response wins
 * exactly once. `request_message` is never modified.
 */
export async function respondFeedbackRequest(
  requestId: string,
  input: RespondFeedbackRequestValues,
): Promise<FeedbackRequestListItem | NextResponse> {
  const id = requireValidUuid(requestId, "feedback request id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return actor;

  if (actor.actorType === "hr_admin" && !isPerDevHrAdminRole(actor.role)) {
    return FORBIDDEN_RESPONSE();
  }
  if (!actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }
  const employeeUuid = actor.employeeUuid;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from(FEEDBACK_REQUESTS_TABLE)
    .select(FEEDBACK_REQUEST_SELECT)
    .eq("id", id)
    .eq("recipient_employee_id", employeeUuid)
    .maybeSingle();

  if (loadError) {
    console.error("respondFeedbackRequest: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load feedback request" },
      { status: 500 },
    );
  }

  if (!existing) return NOT_FOUND_RESPONSE("Feedback request");

  const row = existing as PerformanceFeedbackRequest;

  if (row.status !== "pending") {
    return CONFLICT_RESPONSE(
      "This feedback request has already been responded to.",
    );
  }

  const parsed = requireFeedbackResponse(
    input as FeedbackRequestRespondInput,
  );
  if (parsed instanceof NextResponse) return parsed;

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from(FEEDBACK_REQUESTS_TABLE)
    .update({
      status: parsed.decision,
      response_message: parsed.responseMessage,
      responded_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(FEEDBACK_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    console.error("respondFeedbackRequest: update error:", error);
    return NextResponse.json(
      { error: "Failed to respond to feedback request" },
      { status: 500 },
    );
  }

  if (!data) {
    return CONFLICT_RESPONSE(
      "This feedback request has already been responded to.",
    );
  }

  const updated = data as PerformanceFeedbackRequest;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason:
      parsed.decision === "fulfilled"
        ? PERFORMANCE_AUDIT_REASON.feedbackResponded
        : PERFORMANCE_AUDIT_REASON.feedbackDeclined,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.feedbackRequest,
    entityId: updated.id,
    oldData: { status: "pending" },
    newData: {
      id: updated.id,
      requester_employee_id: updated.requester_employee_id,
      recipient_employee_id: updated.recipient_employee_id,
      status: updated.status,
      responded_at: updated.responded_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichFeedbackRequests([updated]);
  return enriched;
}
