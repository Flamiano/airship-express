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
  MAX_EVIDENCE_ATTACHMENT_NAME_LENGTH,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  MAX_EVIDENCE_NOTE_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import { rejectIfDraftCycle } from "@/performance-development-dashboard/lib/performance/cycles";
import { createNotifications } from "@/performance-development-dashboard/lib/performance/notifications";
import {
  buildEvidenceAttachmentPath,
  createEvidenceFileUrl,
  deleteEvidenceAttachment,
  isAllowedEvidenceFileSize,
  isAllowedEvidenceMime,
  uploadEvidenceAttachment,
} from "@/performance-development-dashboard/lib/performance/evidenceStorage";
import {
  ABSENT,
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireOptionalText,
  requireProgressPercent,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  CHECK_IN_FEEDBACK_TYPE,
  type CreateGoalEvidenceInput,
  type PerformanceGoalEvidence,
  type PerformanceGoalEvidenceItem,
} from "@/performance-development-dashboard/types";

export type {
  CreateGoalEvidenceInput,
} from "@/performance-development-dashboard/types";

/**
 * Goal Evidence service.
 *
 * Evidence is append-only: one row per submitted proof of goal progress,
 * stored in `hr3_performance_goal_evidence`. Attachments are stored server-side
 * in the private `hr3` Storage bucket and only ever reach the client as
 * short-lived signed URLs (never the raw path, never a public URL).
 *
 * Identity model:
 * - `employee_id` on a record is the GOAL OWNER, always resolved from the
 *   goal server-side. It is never taken from the authenticated actor directly.
 *
 * Authorization (mirrors `getPerformanceGoal`):
 * - PerDev HR admin: may view any goal's evidence (404 for missing goals).
 * - Non-PerDev HR admin: generic 403, never fall through.
 * - Manager: may view evidence only for goals belonging to themselves or their
 *   active direct reports.
 * - Employee: may view evidence only for goals they own.
 * - CREATING evidence is an OWNER-ONLY action: the authenticated actor must be
 *   the goal owner's linked employee. Managers may not file evidence for
 *   direct reports, and HR admins may not file evidence on others' behalf.
 *
 * On the non-admin path the goal's existence is never disclosed: both
 * "goal belongs to someone else" and "no such goal" collapse into the same
 * generic 403.
 */

/** Minimal goal reference needed for evidence authorization. */
type EvidenceGoalRef = {
  id: string;
  employee_id: string;
  title: string | null;
  approval_status: string | null;
  cycle_id: string | null;
  status: string | null;
};

const EVIDENCE_SELECT = [
  "id",
  "goal_id",
  "employee_id",
  "check_in_id",
  "progress_percent",
  "note",
  "attachment_path",
  "attachment_name",
  "attachment_mime",
  "attachment_size",
  "created_at",
].join(",");

/** Maximum base64 length a valid attachment can have (10 MB file + padding). */
const MAX_EVIDENCE_ATTACHMENT_ENCODED_LENGTH =
  Math.ceil(MAX_EVIDENCE_FILE_SIZE_BYTES / 3) * 4 + 4;

async function loadGoalOr404(
  goalId: string
): Promise<EvidenceGoalRef | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goals")
    .select("id, employee_id, title, approval_status, cycle_id, status")
    .eq("id", goalId)
    .maybeSingle();

  if (error) {
    console.error("goalEvidence: loadGoal query error:", error);
    return NextResponse.json(
      { error: "Failed to load performance goal" },
      { status: 500 }
    );
  }
  if (!data) return NOT_FOUND_RESPONSE("Performance goal");

  return {
    id: data.id,
    employee_id: data.employee_id,
    title: (data.title as string | null) ?? null,
    approval_status: (data.approval_status as string | null) ?? null,
    cycle_id: (data.cycle_id as string | null) ?? null,
    status: (data.status as string | null) ?? null,
  } as EvidenceGoalRef;
}

async function loadEvidenceOr404(
  evidenceId: string
): Promise<PerformanceGoalEvidence | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goal_evidence")
    .select(EVIDENCE_SELECT)
    .eq("id", evidenceId)
    .maybeSingle();

  if (error) {
    console.error("loadEvidenceOr404: query error:", error);
    return NextResponse.json(
      { error: "Failed to load goal evidence" },
      { status: 500 }
    );
  }
  if (!data) return NOT_FOUND_RESPONSE("Goal evidence");

  return data as unknown as PerformanceGoalEvidence;
}

/**
 * Resolves the set of employee IDs a Manager may access: the manager's own
 * HR record plus all active direct reports.
 */
async function resolveManagerScopedEmployeeIds(
  managerEmployeeUuid: string
): Promise<string[]> {
  const directReportIds = await resolveManagerDirectReportUuids(
    managerEmployeeUuid
  );
  return [managerEmployeeUuid, ...directReportIds];
}

function isGoalInManagerScope(
  goalEmployeeId: string,
  scopedIds: string[]
): boolean {
  return scopedIds.includes(goalEmployeeId);
}

/** Loads the authoritative manager (`hr1_employees.manager_id`) of an employee. */
async function loadEvidenceOwnerManagerId(
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
 * Best-effort evidence notification: the owner's CURRENT active manager
 * receives `goal.evidence_uploaded` with a goal deep link. Failures never
 * roll back the evidence workflow; a missing/inactive manager safely no-ops.
 * Mirrors the proposal `notifyProposalEvent` pattern in `goals.ts`.
 */
async function notifyEvidenceUploaded(input: {
  goalId: string;
  goalTitle: string | null;
  ownerEmployeeId: string;
  actor: PerDevActor;
}): Promise<void> {
  try {
    const managerId = await loadEvidenceOwnerManagerId(input.ownerEmployeeId);
    if (!managerId) return;

    const { data: manager } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, status")
      .eq("id", managerId)
      .maybeSingle();
    if (!manager || (manager.status && manager.status !== "active")) return;

    const goalLabel = input.goalTitle ? `"${input.goalTitle}"` : "their goal";
    await createNotifications([
      {
        recipient_employee_id: manager.id as string,
        actor_employee_id: input.actor.employeeUuid,
        actor_hr_admin_id: input.actor.hrAdminId,
        title: "New Goal Evidence",
        message: `${input.actor.accountFullName} uploaded supporting evidence for ${goalLabel}.`,
        type: "goal.evidence_uploaded",
        link: `/performance-development-dashboard/goals?goal=${input.goalId}`,
        entity_id: input.goalId,
      },
    ]);
  } catch (error) {
    console.error("notifyEvidenceUploaded (goal.evidence_uploaded):", error);
  }
}

/**
 * Authorizes a READ of a goal's evidence. Returns the goal on success or a
 * `NextResponse` denial (see module docstring for the exact matrix).
 */
async function authorizeGoalAccess(
  goalId: string,
  actor: PerDevActor
): Promise<{ goal: EvidenceGoalRef } | NextResponse> {
  if (actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role)) {
    const goal = await loadGoalOr404(goalId);
    if (goal instanceof NextResponse) return goal;
    return { goal };
  }

  if (actor.actorType === "hr_admin") return FORBIDDEN_RESPONSE();
  if (!actor.employeeUuid) return FORBIDDEN_RESPONSE();

  const goal = await loadGoalOr404(goalId);
  if (goal instanceof NextResponse) return FORBIDDEN_RESPONSE();

  if (actor.actorType === "manager") {
    const scopedIds = await resolveManagerScopedEmployeeIds(
      actor.employeeUuid
    );
    if (!isGoalInManagerScope(goal.employee_id, scopedIds)) {
      return FORBIDDEN_RESPONSE();
    }
    return { goal };
  }

  if (goal.employee_id !== actor.employeeUuid) return FORBIDDEN_RESPONSE();
  return { goal };
}

/** Strips the storage path from the DB row so it can never reach the browser. */
function toEvidenceItem(row: PerformanceGoalEvidence): PerformanceGoalEvidenceItem {
  return {
    id: row.id,
    goal_id: row.goal_id,
    employee_id: row.employee_id,
    check_in_id: row.check_in_id,
    progress_percent: row.progress_percent,
    note: row.note,
    attachment_name: row.attachment_name,
    attachment_mime: row.attachment_mime,
    attachment_size: row.attachment_size,
    created_at: row.created_at,
    fileUrl: null,
  };
}

async function toEvidenceItemWithUrl(
  row: PerformanceGoalEvidence
): Promise<PerformanceGoalEvidenceItem> {
  const item = toEvidenceItem(row);
  if (row.attachment_path) {
    item.fileUrl = await createEvidenceFileUrl(row.attachment_path);
  }
  return item;
}

/**
 * Lists all evidence for a goal in ascending chronological order (append-only
 * history). Each row with an attachment carries a fresh short-lived signed URL.
 */
export async function listGoalEvidence(
  goalId: string
): Promise<PerformanceGoalEvidenceItem[] | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return FORBIDDEN_RESPONSE();

  const authorized = await authorizeGoalAccess(id, actor);
  if (authorized instanceof NextResponse) return authorized;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goal_evidence")
    .select(EVIDENCE_SELECT)
    .eq("goal_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listGoalEvidence: query error:", error);
    return NextResponse.json(
      { error: "Failed to load goal evidence" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as PerformanceGoalEvidence[];
  const items: PerformanceGoalEvidenceItem[] = [];
  for (const row of rows) {
    items.push(await toEvidenceItemWithUrl(row));
  }
  return items;
}

/**
 * Lists the evidence rows linked to one check-in, for embedding in the
 * check-in conversation (`listCheckInThread`).
 *
 * This is the ONLY read path keyed by `check_in_id`: the goal-scoped list
 * needs a goal id and the file route needs an evidence id, neither of which
 * a conversation client knows. No new endpoint is involved — the caller
 * attaches the result to the existing thread response.
 *
 * Authorization is per-row through `authorizeGoalAccess` (the same matrix as
 * every other evidence read): rows outside the caller's scope are skipped,
 * never leaked. A lookup failure also yields `[]` so a supplementary
 * evidence query can never break the primary conversation load.
 */
export async function listEvidenceForCheckIn(
  checkInId: string,
  actor: PerDevActor
): Promise<PerformanceGoalEvidenceItem[]> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_goal_evidence")
    .select(EVIDENCE_SELECT)
    .eq("check_in_id", checkInId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) {
    console.error("listEvidenceForCheckIn: query error:", error);
    return [];
  }

  const rows = data as unknown as PerformanceGoalEvidence[];
  const items: PerformanceGoalEvidenceItem[] = [];
  for (const row of rows) {
    const authorized = await authorizeGoalAccess(row.goal_id, actor);
    if (authorized instanceof NextResponse) continue;
    const item = await toEvidenceItemWithUrl(row);
    item.goal_title = authorized.goal.title;
    items.push(item);
  }
  return items;
}

/**
 * Creates a Goal Evidence record (with an optional attachment).
 *
 * Server-side guarantees:
 * - The goal is loaded and owned; `employee_id` is derived from the goal.
 * - `check_in_id` (optional) must reference a check-in whose `employee_id`
 *   matches the goal owner, and it is never invented or reused from other
 *   employees.
 * - `progress_percent` is a required integer in 0..100 (column is smallint).
 * - Attachments are validated against the MIME allowlist and the 10 MB cap,
 *   decoded server-side, and uploaded with a server-authored storage path.
 * - If the DB insert fails after the file already landed in the bucket, the
 *   object is removed best-effort so no orphaned files remain.
 * - The audit event is recorded ONLY after the evidence row was created; no
 *   audit record ever claims success for a failed creation.
 */
export async function createGoalEvidence(
  goalId: string,
  input: CreateGoalEvidenceInput
): Promise<PerformanceGoalEvidenceItem | NextResponse> {
  const id = requireValidUuid(goalId, "goal id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return FORBIDDEN_RESPONSE();

  const goal = await loadGoalOr404(id);
  if (goal instanceof NextResponse) return FORBIDDEN_RESPONSE();

  if (!actor.employeeUuid || goal.employee_id !== actor.employeeUuid) {
    return FORBIDDEN_RESPONSE();
  }

  // Proposal workflow separation (MVP): evidence may be created only for
  // approved (official) goals. Draft/pending/returned/rejected proposals
  // cannot receive evidence. Reads of existing evidence are unaffected.
  if (goal.approval_status !== "approved") {
    return NextResponse.json(
      {
        error:
          'Evidence can only be added to approved goals. Current approval state: "' +
          (goal.approval_status ?? "unknown") +
          '".',
      },
      { status: 409 }
    );
  }

  // Closed-cycle governance: a closed performance period accepts no new
  // evidence. Rejected BEFORE storage upload, DB insert, audit, and
  // notification, so a denied attempt leaves no side effects. Reads,
  // signed URLs, and history are unaffected. Goals without a cycle
  // (legacy NULL) keep existing behavior and never match a cycle.
  if (goal.cycle_id) {
    const { data: cycle, error: cycleError } = await supabaseAdmin
      .from("hr3_performance_cycles")
      .select("status")
      .eq("id", goal.cycle_id)
      .maybeSingle();
    if (cycleError) {
      console.error("createGoalEvidence: cycle query error:", cycleError);
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

  // Draft-cycle activation: evidence upload is active execution and
  // requires an opened cycle. Reads, signed URLs, and history are
  // unaffected; legacy NULL-cycle goals keep existing behavior.
  const draftCycleError = await rejectIfDraftCycle(goal.cycle_id);
  if (draftCycleError) return draftCycleError;

  // Completed-goal immutability: a completed goal is a terminal historical
  // record and accepts no new evidence. Reads, signed URLs, and history
  // are unaffected.
  if (goal.status === "completed") {
    return CONFLICT_RESPONSE(
      "This goal is already completed and can no longer accept new evidence."
    );
  }

  let checkInId: string | null = null;
  if (
    input.check_in_id !== undefined &&
    input.check_in_id !== null &&
    input.check_in_id !== ""
  ) {
    const validated = requireValidUuid(input.check_in_id, "check_in_id");
    if (validated instanceof NextResponse) return validated;
    checkInId = validated;

    const { data: checkIn, error: checkInError } = await supabaseAdmin
      .from("hr3_performance_feedback")
      .select("id, employee_id")
      .eq("id", checkInId)
      .eq("feedback_type", CHECK_IN_FEEDBACK_TYPE)
      .eq("employee_id", goal.employee_id)
      .maybeSingle();

    if (checkInError) {
      console.error("createGoalEvidence: check-in query error:", checkInError);
      return NextResponse.json(
        { error: "Failed to validate check-in reference" },
        { status: 500 }
      );
    }
    if (!checkIn) {
      return BAD_REQUEST_RESPONSE(
        "check_in_id must reference a check-in belonging to this goal's employee."
      );
    }
  }

  const progress = requireProgressPercent(
    input.progress_percent,
    "progress_percent"
  );
  if (progress instanceof NextResponse) return progress;
  if (progress === null) {
    return BAD_REQUEST_RESPONSE("progress_percent is required.");
  }
  if (!Number.isInteger(progress)) {
    return BAD_REQUEST_RESPONSE(
      "progress_percent must be an integer between 0 and 100."
    );
  }

  const noteResult = requireOptionalText(
    input.note,
    "note",
    MAX_EVIDENCE_NOTE_LENGTH
  );
  if (noteResult instanceof NextResponse) return noteResult;
  const note = noteResult === ABSENT ? null : noteResult;

  let attachmentPath: string | null = null;
  let attachmentContent: Uint8Array | null = null;
  let attachmentName: string | null = null;
  let attachmentMime: string | null = null;
  let attachmentSize: number | null = null;

  if (input.attachment !== undefined && input.attachment !== null) {
    const att = input.attachment;

    if (typeof att.mime !== "string" || !isAllowedEvidenceMime(att.mime)) {
      return BAD_REQUEST_RESPONSE(
        "attachment.mime must be one of: image/png, image/jpeg, image/webp, application/pdf."
      );
    }
    if (typeof att.data !== "string" || att.data === "") {
      return BAD_REQUEST_RESPONSE(
        "attachment.data must be a non-empty base64 string."
      );
    }
    if (att.data.length > MAX_EVIDENCE_ATTACHMENT_ENCODED_LENGTH) {
      return BAD_REQUEST_RESPONSE(
        `attachment must not exceed ${MAX_EVIDENCE_FILE_SIZE_BYTES} bytes.`
      );
    }

    const decoded = Buffer.from(
      att.data.replace(/^data:[^;]+;base64,/, ""),
      "base64"
    );
    if (!isAllowedEvidenceFileSize(decoded.length)) {
      return BAD_REQUEST_RESPONSE(
        `attachment must be between 1 byte and ${MAX_EVIDENCE_FILE_SIZE_BYTES} bytes.`
      );
    }
    if (
      typeof att.size !== "number" ||
      !Number.isInteger(att.size) ||
      att.size !== decoded.length
    ) {
      return BAD_REQUEST_RESPONSE(
        "attachment.size must match the decoded size of attachment.data."
      );
    }

    if (att.name !== undefined && att.name !== null) {
      if (typeof att.name !== "string") {
        return BAD_REQUEST_RESPONSE("attachment.name must be a string.");
      }
      const trimmed = att.name.trim();
      if (trimmed.length > MAX_EVIDENCE_ATTACHMENT_NAME_LENGTH) {
        return BAD_REQUEST_RESPONSE(
          `attachment.name must be at most ${MAX_EVIDENCE_ATTACHMENT_NAME_LENGTH} characters.`
        );
      }
      // Display-only: strip path separators so it can never look like a path.
      attachmentName = trimmed.replace(/[/\\]/g, "") || null;
    }

    attachmentContent = decoded;
    attachmentMime = att.mime.toLowerCase();
    attachmentSize = decoded.length;
  }

  if (attachmentContent && attachmentMime) {
    const path = buildEvidenceAttachmentPath({
      employeeId: goal.employee_id,
      goalId: goal.id,
      mime: attachmentMime,
    });
    if (!path) {
      return BAD_REQUEST_RESPONSE("attachment.mime is not supported.");
    }

    const uploaded = await uploadEvidenceAttachment({
      path,
      data: attachmentContent,
      mime: attachmentMime,
    });
    if (!uploaded.ok) {
      return NextResponse.json(
        { error: "Failed to upload evidence attachment" },
        { status: 500 }
      );
    }
    attachmentPath = uploaded.path;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("hr3_performance_goal_evidence")
    .insert({
      goal_id: goal.id,
      employee_id: goal.employee_id,
      check_in_id: checkInId,
      progress_percent: progress,
      note,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
      attachment_size: attachmentSize,
    })
    .select(EVIDENCE_SELECT)
    .single();

  if (insertError) {
    console.error("createGoalEvidence: insert error:", insertError);
    if (attachmentPath) {
      await deleteEvidenceAttachment(attachmentPath);
    }
    return NextResponse.json(
      { error: "Failed to create goal evidence" },
      { status: 500 }
    );
  }

  const createdEvidence = created as unknown as PerformanceGoalEvidence;

  const auditError = await insertAuditEvent({
    actor: auditActorFromPerDevActor(actor),
    reason: PERFORMANCE_AUDIT_REASON.goalEvidenceCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.goal,
    entityId: goal.id,
    oldData: null,
    newData: {
      id: createdEvidence.id,
      goal_id: createdEvidence.goal_id,
      employee_id: createdEvidence.employee_id,
      check_in_id: createdEvidence.check_in_id,
      progress_percent: createdEvidence.progress_percent,
      attachment_mime: createdEvidence.attachment_mime,
      attachment_size: createdEvidence.attachment_size,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  // Secondary side effect: notify the owner's current active manager.
  // Best-effort only — evidence success is returned regardless.
  await notifyEvidenceUploaded({
    goalId: goal.id,
    goalTitle: goal.title,
    ownerEmployeeId: goal.employee_id,
    actor,
  });

  return toEvidenceItemWithUrl(createdEvidence);
}

/**
 * Authorizes access to an evidence record and returns a fresh short-lived
 * signed URL for its attachment. Geared at the file-serving route: the client
 * must not proxy file content, so the route redirects the browser here.
 */
export async function getEvidenceFileUrl(
  evidenceId: string
): Promise<{ fileUrl: string } | NextResponse> {
  const id = requireValidUuid(evidenceId, "evidence id");
  if (id instanceof NextResponse) return id;

  const actor = await getAuthenticatedActor();
  if (actor instanceof NextResponse) return FORBIDDEN_RESPONSE();

  const evidence = await loadEvidenceOr404(id);
  if (evidence instanceof NextResponse) {
    const isPerDevAdmin =
      actor.actorType === "hr_admin" && isPerDevHrAdminRole(actor.role);
    return isPerDevAdmin ? evidence : FORBIDDEN_RESPONSE();
  }

  const authorized = await authorizeGoalAccess(evidence.goal_id, actor);
  if (authorized instanceof NextResponse) return authorized;

  const attachmentPath = evidence.attachment_path;
  if (!attachmentPath) {
    return NextResponse.json(
      { error: "This goal evidence record has no attachment" },
      { status: 404 }
    );
  }

  const fileUrl = await createEvidenceFileUrl(attachmentPath);
  if (!fileUrl) {
    return NextResponse.json(
      { error: "Failed to generate file URL for goal evidence" },
      { status: 500 }
    );
  }

  return { fileUrl };
}