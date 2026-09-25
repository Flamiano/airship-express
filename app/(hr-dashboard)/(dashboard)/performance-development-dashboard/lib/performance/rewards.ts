import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import {
  auditActorFromIdentity,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  ABSENT,
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  NOT_FOUND_RESPONSE,
  requireActiveEmployeeId,
  requireNonEmptyText,
  requireNonNegativeInteger,
  requireOptionalText,
  requireSignedInteger,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import type {
  Badge,
  BadgeInput,
  BadgeListItem,
  EmployeePoints,
  EmployeePointsListItem,
  Recognition,
  RecognitionInput,
  RecognitionListItem,
  RedemptionInput,
  RedemptionListItem,
  RewardRedemption,
  SetPointsInput,
  UpdateBadgeInput,
  UpdateRedemptionInput,
} from "@/performance-development-dashboard/types";
import {
  REWARDS_MAX_MESSAGE_LENGTH,
  REWARDS_MAX_REASON_CATEGORY_LENGTH,
  REWARDS_MAX_REWARD_DESCRIPTION_LENGTH,
  REWARDS_MAX_VISIBILITY_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

export type {
  Badge,
  BadgeInput,
  BadgeListItem,
  EmployeePoints,
  EmployeePointsListItem,
  Recognition,
  RecognitionInput,
  RecognitionListItem,
  RedemptionInput,
  RedemptionListItem,
  RewardRedemption,
  SetPointsInput,
  UpdateBadgeInput,
  UpdateRedemptionInput,
} from "@/performance-development-dashboard/types";

/**
 * Recognition & Rewards domain.
 *
 * MODEL (four distinct, separately-managed concepts, exactly as the live schema
 * supports — relationships are FK-verified, nothing is inferred):
 *
 *   BADGE (`hr3_badges`)            badge DEFINITION library. name is NOT NULL,
 *                                   description/icon_url optional. There is NO
 *                                   badge-assignment table: a badge becomes
 *                                   assigned by attaching `badge_id` to a
 *                                   recognition row (FK → hr3_badges.id).
 *   RECOGNITION (`hr3_recognitions`) a posted recognition record from a sender
 *                                   employee to a recipient employee (both FK →
 *                                   hr1_employees.id). Optional message,
 *                                   optional badge_id, optional reason_category
 *                                   (DB CHECK constraint is the authority),
 *                                   integer `points` (default 0), free-text
 *                                   `visibility` (default 'public'). Has no
 *                                   status/approval or updated_at column → a
 *                                   recognition is historical: create + read
 *                                   only.
 *   EMPLOYEE POINTS (`hr3_employee_points`) ONE row per employee (unique
 *                                   employee_id, verified live). `total_points`
 *                                   is the current stored balance, an integer
 *                                   (default 0, no DB non-negative check).
 *                                   `updated_at` has no trigger — the server
 *                                   stamps it. There is no points ledger table.
 *   REWARD REDEMPTION (`hr3_reward_redemptions`) a requested redemption for an
 *                                   employee (FK → hr1_employees.id) with
 *                                   integer `points_used`, free-text
 *                                   `reward_description` (NO reward-catalog
 *                                   table exists), free-text `status` (default
 *                                   'pending'), `requested_at`, optional
 *                                   `processed_at` (server-stamped when the
 *                                   status changes).
 *
 * NO AUTOMATIC ECONOMY / NO PERFORMANCE LINK
 *   The live schema has NO trigger linking recognitions, the points balance,
 *   or redemptions (verified by probe: inserting a recognition with points does
 *   not change `hr3_employee_points`, and inserting a redemption does not
 *   deduct from it). Therefore this domain NEVER automatically:
 *     - credits recognition points into the balance,
 *     - deducts redemption `points_used` from the balance,
 *     - expires, converts, transfers, or monetizes points,
 *     - derives points from appraisals, goals, competencies, training,
 *       succession readiness, tenure, title, or department.
 *   The balance is managed EXPLICITLY by HR through `setEmployeePoints`
 *   (absolute set or delta adjust, non-negative enforced as application
 *   semantics because a negative balance has no coherent business meaning and
 *   would make redemption math impossible). The redemption status change never
 *   touches the balance either. The consumption-is-not-transactional limitation
 *   is reported rather than papered over.
 *
 * DATA-VOCABULARY HONESTY
 *   `reason_category` is governed by a DB CHECK constraint whose full vocabulary
 *   could not be enumerated from PostgREST (probes confirmed at least
 *   'teamwork' and 'performance'). The server therefore does NOT assume the
 *   list is complete: it bounds length and lets the constraint be the
 *   validator, mapping constraint-violation errors to a clear response.
 *   `visibility` and redemption `status` are FREE TEXT with NO check constraint
 *   — values are stored/rendered as-is; legacy/unknown values never crash the
 *   UI and are never silently rewritten.
 *
 * DELETION (history preservation)
 *   Recognitions, point balances, and redemptions are NEVER deleted — they are
 *   historical records with no status/archive column, and removing them would
 *   silently destroy history. Badge library entries MAY be deleted only when
 *   unused; the recognition FK → badges is RESTRICT (verified live), so the
 *   server pre-checks usage and returns a 409 listing the blocking count.
 *
 * SCOPE / AUTHORIZATION
 *   Every operation (reads and mutations) requires HR admin scope
 *   (`assertHrAdminScope`). The sender of a recognition is a BUSINESS field
 *   (an employee selected by HR, validated against `hr1_employees`) — it is
 *   never the linked employee of the acting account and never used for
 *   authorization. Attribution is ALWAYS the acting HR account via
 *   `auditActorFromIdentity` (actor_id = hr_admin.id), never client-supplied.
 */

const BADGE_SELECT = "id, name, description, icon_url";
const RECOGNITION_SELECT =
  "id, sender_id, recipient_id, message, badge_id, reason_category, points, visibility, created_at";
const POINTS_SELECT = "id, employee_id, total_points, updated_at";
const REDEMPTION_SELECT =
  "id, employee_id, points_used, reward_description, status, requested_at, processed_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function constraintMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const code = (error as { code?: string }).code;
    if (code === "23514") {
      return "A database rule rejected that value. Recognition reason category must use one of the accepted values (e.g. teamwork, performance).";
    }
    if (code === "23505") {
      return "That record already exists and cannot be duplicated.";
    }
    if (code === "23503") {
      return "A referenced record is no longer valid; please refresh and try again.";
    }
  }
  return fallback;
}

type EmployeeRow = {
  id: string;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  department: string | null;
  status: string;
};

async function loadEmployeesById(ids: string[]): Promise<Map<string, EmployeeRow>> {
  const map = new Map<string, EmployeeRow>();
  const unique = [...new Set(ids)].filter(Boolean) as string[];
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select(
      "id, employee_id_number, first_name, last_name, department, status"
    )
    .in("id", unique);

  if (error) {
    console.error("loadEmployeesById: query error:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

async function loadBadgesById(ids: string[]): Promise<Map<string, Badge>> {
  const map = new Map<string, Badge>();
  const unique = [...new Set(ids)].filter(Boolean) as string[];
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .select(BADGE_SELECT)
    .in("id", unique);

  if (error) {
    console.error("loadBadgesById: query error:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row as Badge);
  }
  return map;
}

async function requireExistingEmployeeId(value: unknown): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "employee id");
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
    return BAD_REQUEST_RESPONSE(
      "employee id does not reference an existing employee."
    );
  }
  return id;
}

async function requireExistingBadgeId(
  value: unknown,
  field = "badge id"
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, field);
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingBadgeId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate badge" },
      { status: 500 }
    );
  }
  if (!data) {
    return BAD_REQUEST_RESPONSE(`${field} does not reference an existing badge.`);
  }
  return id;
}

function employeeDisplay(employee: EmployeeRow | undefined): {
  name: string;
  number: string;
} {
  if (!employee) {
    return { name: "Unknown employee", number: "" };
  }
  return {
    name: `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Unknown employee",
    number: employee.employee_id_number ?? "",
  };
}

/* =====================================================================
 * BADGES
 * ===================================================================== */

/**
 * Lists badge library entries with usage counts (recognitions referencing each
 * badge), ordered by name. HR admin scope. Never used for authorization.
 */
export async function listBadges(): Promise<BadgeListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .select(BADGE_SELECT)
    .order("name", { ascending: true });

  if (error) {
    console.error("listBadges: query error:", error);
    return NextResponse.json(
      { error: "Failed to load badges" },
      { status: 500 }
    );
  }

  return enrichBadges((data ?? []) as Badge[]);
}

export async function getBadge(
  badgeId: string
): Promise<BadgeListItem | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(badgeId, "badge id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .select(BADGE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getBadge: query error:", error);
    return NextResponse.json({ error: "Failed to load badge" }, { status: 500 });
  }
  if (!data) return NOT_FOUND_RESPONSE("Badge");

  const [enriched] = await enrichBadges([data as Badge]);
  return enriched;
}

/**
 * Creates a badge library entry (HR admin scope). Only `name` is required.
 * Mutation → audit (`badge.created`).
 */
export async function createBadge(
  input: BadgeInput | undefined
): Promise<BadgeListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const raw: Record<string, unknown> = isRecord(input) ? input : {};
  const name = requireNonEmptyText(raw.name, "name", 100);
  if (name instanceof NextResponse) return name;
  const description = requireOptionalText(
    raw.description,
    "description",
    2000
  );
  if (description instanceof NextResponse) return description;
  const iconUrl = requireOptionalText(raw.icon_url, "icon_url", 500);
  if (iconUrl instanceof NextResponse) return iconUrl;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .insert({
      name,
      description:
        description === ABSENT ? null : (description as string | null),
      icon_url: iconUrl === ABSENT ? null : (iconUrl as string | null),
    })
    .select(BADGE_SELECT)
    .single();

  if (error) {
    console.error("createBadge: insert error:", error);
    return NextResponse.json(
      { error: constraintMessage(error, "Failed to create badge") },
      { status: 400 }
    );
  }

  const [enriched] = await enrichBadges([data as Badge]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.badgeCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.badge,
    entityId: data.id,
    oldData: null,
    newData: { name: data.name, description: data.description, icon_url: data.icon_url },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Updates a badge library entry (HR admin scope). Mutation → audit
 * (`badge.updated`).
 */
export async function updateBadge(
  badgeId: string,
  input: UpdateBadgeInput | undefined
): Promise<BadgeListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(badgeId, "badge id");
  if (id instanceof NextResponse) return id;

  const existing = await loadBadgesById([id]);
  const before = existing.get(id);
  if (!before) return NOT_FOUND_RESPONSE("Badge");

  const raw: Record<string, unknown> = isRecord(input) ? input : {};
  const name = raw.name === undefined ? before.name : requireNonEmptyText(raw.name, "name", 100);
  if (name instanceof NextResponse) return name;
  const description =
    raw.description === undefined
      ? before.description
      : requireOptionalText(raw.description, "description", 2000);
  if (description instanceof NextResponse) return description;
  const iconUrl =
    raw.icon_url === undefined
      ? before.icon_url
      : requireOptionalText(raw.icon_url, "icon_url", 500);
  if (iconUrl instanceof NextResponse) return iconUrl;

  const { data, error } = await supabaseAdmin
    .from("hr3_badges")
    .update({
      name,
      description: description as string | null,
      icon_url: iconUrl as string | null,
    })
    .eq("id", id)
    .select(BADGE_SELECT)
    .single();

  if (error) {
    console.error("updateBadge: update error:", error);
    return NextResponse.json(
      { error: constraintMessage(error, "Failed to update badge") },
      { status: 400 }
    );
  }

  const [enriched] = await enrichBadges([data as Badge]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.badgeUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.badge,
    entityId: id,
    oldData: { name: before.name, description: before.description, icon_url: before.icon_url },
    newData: { name: data.name, description: data.description, icon_url: data.icon_url },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Deletes a badge library entry (HR admin scope) — ONLY when it is not used by
 * any recognition: the recognition FK → `hr3_badges` is RESTRICT (verified
 * live), so the server pre-checks and returns a 409 with the blocking count
 * rather than leaving the DB to fail obscurely. Mutation → audit
 * (`badge.deleted`).
 */
export async function deleteBadge(
  badgeId: string
): Promise<{ id: string; deleted: boolean } | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(badgeId, "badge id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_badges")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    console.error("deleteBadge: load error:", loadError);
    return NextResponse.json({ error: "Failed to load badge" }, { status: 500 });
  }
  if (!existing) return NOT_FOUND_RESPONSE("Badge");

  const { count, error: countError } = await supabaseAdmin
    .from("hr3_recognitions")
    .select("id", { count: "exact", head: true })
    .eq("badge_id", id);
  if (countError) {
    console.error("deleteBadge: usage count error:", countError);
    return NextResponse.json(
      { error: "Failed to check badge usage" },
      { status: 500 }
    );
  }
  if ((count ?? 0) > 0) {
    return CONFLICT_RESPONSE(
      `This badge is used by ${count} recognition${count === 1 ? "" : "s"}. It can only be deleted after those recognitions are removed (keeping recognition history intact is recommended instead).`
    );
  }

  const { error } = await supabaseAdmin.from("hr3_badges").delete().eq("id", id);
  if (error) {
    console.error("deleteBadge: delete error:", error);
    return NextResponse.json({ error: "Failed to delete badge" }, { status: 500 });
  }

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.badgeDeleted,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.badge,
    entityId: id,
    oldData: { name: existing.name },
    newData: null,
  });
  if (auditError instanceof NextResponse) return auditError;

  return { id, deleted: true };
}

/**
 * Pure display enrichment for badge rows: adds the live count of recognitions
 * referencing each badge. Not used for authorization.
 */
async function enrichBadges(rows: Badge[]): Promise<BadgeListItem[]> {
  if (rows.length === 0) return [];

  const { data: usageRows, error: usageError } = await supabaseAdmin
    .from("hr3_recognitions")
    .select("badge_id")
    .in(
      "badge_id",
      rows.map((row) => row.id)
    );
  if (usageError) {
    console.error("enrichBadges: usage query error:", usageError);
  }

  const usageCount = new Map<string, number>();
  for (const row of usageRows ?? []) {
    if (row.badge_id) {
      usageCount.set(row.badge_id, (usageCount.get(row.badge_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    ...row,
    usageCount: usageCount.get(row.id) ?? 0,
  }));
}

/* =====================================================================
 * RECOGNITIONS
 * ===================================================================== */

/**
 * Lists recognitions with presentation enrichment, newest first. HR admin
 * scope. Recognition is historical — no update/delete operations are exposed.
 */
export async function listRecognitions(): Promise<RecognitionListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("hr3_recognitions")
    .select(RECOGNITION_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listRecognitions: query error:", error);
    return NextResponse.json(
      { error: "Failed to load recognitions" },
      { status: 500 }
    );
  }

  return enrichRecognitions((data ?? []) as Recognition[]);
}

export async function getRecognition(
  recognitionId: string
): Promise<RecognitionListItem | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(recognitionId, "recognition id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_recognitions")
    .select(RECOGNITION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getRecognition: query error:", error);
    return NextResponse.json(
      { error: "Failed to load recognition" },
      { status: 500 }
    );
  }
  if (!data) return NOT_FOUND_RESPONSE("Recognition");

  const [enriched] = await enrichRecognitions([data as Recognition]);
  return enriched;
}

/**
 * Creates a recognition (HR admin scope).
 *
 * Recognition is a NEW/CURRENT employee award recorded at creation time
 * (no backdate field; `created_at` is server-stamped). Both the SENDER
 * (employee giving) and the RECIPIENT (employee being recognized) must
 * therefore reference ACTIVE employees — inactive employees keep full
 * historical visibility through the list/get enrichment, which resolves
 * names regardless of status.
 *
 * The SENDER is a business field — an employee the HR user selects (validated
 * against `hr1_employees`). It is never the linked employee of the acting
 * account and never used for authorization; the audit actor is always the
 * acting HR account (`recognition.created`).
 *
 * `reason_category` is validated by the DB CHECK constraint (the server bounds
 * length and maps constraint errors to a clear response rather than assuming a
 * complete vocabulary). `points` attaches awarded-points context to the
 * recognition record only — it never modifies any balance automatically.
 */
export async function createRecognition(
  input: RecognitionInput | undefined
): Promise<RecognitionListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const raw: Record<string, unknown> = isRecord(input) ? input : {};
  const senderId = await requireActiveEmployeeId(raw.sender_id, "sender_id");
  if (senderId instanceof NextResponse) return senderId;
  const recipientId = await requireActiveEmployeeId(raw.recipient_id, "recipient_id");
  if (recipientId instanceof NextResponse) return recipientId;
  if (senderId === recipientId) {
    return BAD_REQUEST_RESPONSE(
      "The sender and recipient cannot be the same employee."
    );
  }

  const message = requireOptionalText(raw.message, "message", REWARDS_MAX_MESSAGE_LENGTH);
  if (message instanceof NextResponse) return message;

  let badgeId: string | null | typeof ABSENT = ABSENT;
  if (raw.badge_id !== undefined && raw.badge_id !== null) {
    const resolvedBadgeId = await requireExistingBadgeId(
      raw.badge_id,
      "badge id"
    );
    if (resolvedBadgeId instanceof NextResponse) return resolvedBadgeId;
    badgeId = resolvedBadgeId;
  } else if (raw.badge_id === null) {
    badgeId = null;
  }

  const reasonCategory = requireOptionalText(
    raw.reason_category,
    "reason_category",
    REWARDS_MAX_REASON_CATEGORY_LENGTH
  );
  if (reasonCategory instanceof NextResponse) return reasonCategory;

  const points = requireNonNegativeInteger(raw.points, "points", { optional: true });
  if (points instanceof NextResponse) return points;

  const visibility = requireOptionalText(
    raw.visibility,
    "visibility",
    REWARDS_MAX_VISIBILITY_LENGTH
  );
  if (visibility instanceof NextResponse) return visibility;

  const { data, error } = await supabaseAdmin
    .from("hr3_recognitions")
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      message: message === ABSENT ? null : (message as string | null),
      badge_id:
        badgeId === ABSENT ? null : (badgeId as string | null),
      reason_category:
        reasonCategory === ABSENT || reasonCategory === null
          ? null
          : (reasonCategory as string),
      points: points === ABSENT || points === null ? 0 : (points as number),
      visibility:
        visibility === ABSENT || visibility === null
          ? "public"
          : (visibility as string),
    })
    .select(RECOGNITION_SELECT)
    .single();

  if (error) {
    console.error("createRecognition: insert error:", error);
    return NextResponse.json(
      {
        error: constraintMessage(
          error,
          "Failed to create recognition. The database rejected the submitted values."
        ),
      },
      { status: 400 }
    );
  }

  const [enriched] = await enrichRecognitions([data as Recognition]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.recognitionCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.recognition,
    entityId: data.id,
    oldData: null,
    newData: {
      sender_id: senderId,
      recipient_id: recipientId,
      badge_id: data.badge_id,
      reason_category: data.reason_category,
      points: data.points,
      visibility: data.visibility,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Pure display enrichment for recognition rows: resolves sender/recipient
 * names/numbers from `hr1_employees` and the badge name/icon from
 * `hr3_badges`. Not used for authorization.
 */
async function enrichRecognitions(
  rows: Recognition[]
): Promise<RecognitionListItem[]> {
  if (rows.length === 0) return [];

  const employeeIds = [
    ...new Set(rows.flatMap((row) => [row.sender_id, row.recipient_id])),
  ];
  const badgeIds = rows
    .map((row) => row.badge_id)
    .filter((id): id is string => Boolean(id));

  const [employees, badges] = await Promise.all([
    loadEmployeesById(employeeIds),
    loadBadgesById(badgeIds),
  ]);

  return rows.map((row) => {
    const sender = employees.get(row.sender_id);
    const recipient = employees.get(row.recipient_id);
    const badge = row.badge_id ? badges.get(row.badge_id) : undefined;
    const senderDisplay = employeeDisplay(sender);
    const recipientDisplay = employeeDisplay(recipient);
    return {
      ...row,
      senderName: senderDisplay.name,
      senderNumber: senderDisplay.number,
      recipientName: recipientDisplay.name,
      recipientNumber: recipientDisplay.number,
      badgeName: badge?.name ?? null,
      badgeIconUrl: badge?.icon_url ?? null,
    };
  });
}

/* =====================================================================
 * EMPLOYEE POINTS
 * ===================================================================== */

/**
 * Lists the current point balance for every employee that HAS a balance row,
 * enriched with employee names, ordered by employee name. HR admin scope.
 * (Employees without a balance row are simply absent — balance is created on
 * first set.)
 */
export async function listEmployeePoints(): Promise<EmployeePointsListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("hr3_employee_points")
    .select(POINTS_SELECT)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listEmployeePoints: query error:", error);
    return NextResponse.json(
      { error: "Failed to load employee points" },
      { status: 500 }
    );
  }

  return enrichEmployeePoints((data ?? []) as EmployeePoints[]);
}

/**
 * Sets or adjusts an employee's point BALANCE (HR admin scope).
 *
 * The live table is one row per employee (unique `employee_id`, verified
 * live). Supports an absolute `total_points` set OR a `delta` adjust
 * (new = current + delta, starting at 0 when no row exists). `updated_at` is
 * stamped server-side (no DB trigger). The new balance is enforced >= 0 as
 * application semantics (a negative balance has no coherent meaning and would
 * break redemption math). Mutation → audit (`points.awarded`).
 */
export async function setEmployeePoints(
  input: SetPointsInput | undefined
): Promise<EmployeePointsListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const raw: Record<string, unknown> = isRecord(input) ? input : {};
  const employeeId = await requireExistingEmployeeId(raw.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const totalValue = requireNonNegativeInteger(raw.total_points, "total_points", {
    optional: true,
  });
  if (totalValue instanceof NextResponse) return totalValue;
  const deltaValue = requireSignedInteger(raw.delta, "delta", {
    optional: true,
  });
  if (deltaValue instanceof NextResponse) return deltaValue;

  const hasTotal = totalValue !== ABSENT && totalValue !== null;
  const hasDelta = deltaValue !== ABSENT && deltaValue !== null;
  if (hasTotal === hasDelta) {
    return BAD_REQUEST_RESPONSE(
      "Provide exactly one of total_points (absolute set) or delta (adjust by amount)."
    );
  }

  // Reject zero deltas explicitly — a no-op adjustment is not allowed.
  if (hasDelta && (deltaValue as number) === 0) {
    return BAD_REQUEST_RESPONSE("Delta must not be zero.");
  }

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_employee_points")
    .select("id, total_points")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (loadError) {
    console.error("setEmployeePoints: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load current balance" },
      { status: 500 }
    );
  }

  const previousTotal = existing?.total_points ?? 0;
  const newTotal = hasTotal
    ? (totalValue as number)
    : previousTotal + (deltaValue as number);

  if (newTotal < 0) {
    return CONFLICT_RESPONSE(
      "Insufficient points — the resulting balance cannot be negative."
    );
  }

  const now = new Date().toISOString();
  let balancedRowId = existing?.id ?? null;

  if (!existing) {
    // No row yet — insert one. Handle unique-violation 23505 from a
    // concurrent insert by re-reading; the caller should retry if the
    // race cannot be resolved.
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("hr3_employee_points")
      .insert({
        employee_id: employeeId,
        total_points: newTotal,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        // Concurrent insert won the race. Re-read the existing row so we
        // can report the current state rather than double-apply points.
        const { data: concurrent } = await supabaseAdmin
          .from("hr3_employee_points")
          .select("id")
          .eq("employee_id", employeeId)
          .maybeSingle();
        if (concurrent) {
          return CONFLICT_RESPONSE(
            "A concurrent update created this employee's point balance. Please retry."
          );
        }
      }
      console.error("setEmployeePoints: insert error:", insertError);
      return NextResponse.json(
        { error: constraintMessage(insertError, "Failed to set employee points") },
        { status: 400 }
      );
    }
    balancedRowId = inserted.id;
  } else {
    // Row exists — conditional update: only write if the balance still
    // matches what we read. This prevents lost-update races.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("hr3_employee_points")
      .update({ total_points: newTotal, updated_at: now })
      .eq("id", existing.id)
      .eq("total_points", previousTotal)
      .select("id");
    if (updateError) {
      console.error("setEmployeePoints: update error:", updateError);
      return NextResponse.json(
        { error: constraintMessage(updateError, "Failed to set employee points") },
        { status: 400 }
      );
    }
    if (!updated || updated.length === 0) {
      // The balance changed between our read and write — stale read.
      return CONFLICT_RESPONSE(
        "The point balance was modified by another request. Please reload and try again."
      );
    }
  }

  const { data: result, error: readError } = await supabaseAdmin
    .from("hr3_employee_points")
    .select(POINTS_SELECT)
    .eq("id", balancedRowId)
    .single();
  if (readError || !result) {
    console.error("setEmployeePoints: read-back error:", readError);
    return NextResponse.json(
      { error: "Failed to load updated balance" },
      { status: 500 }
    );
  }

  const [enriched] = await enrichEmployeePoints([result as EmployeePoints]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.pointsAwarded,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.employeePoints,
    entityId: result.id,
    oldData: existing ? { employee_id: employeeId, total_points: existing.total_points } : null,
    newData: {
      employee_id: employeeId,
      total_points: result.total_points,
      delta: hasDelta ? (deltaValue as number) : null,
      set_total: hasTotal ? (totalValue as number) : null,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Pure display enrichment for point balance rows: resolves employee
 * name/number/department/status from `hr1_employees`. Not used for
 * authorization.
 */
async function enrichEmployeePoints(
  rows: EmployeePoints[]
): Promise<EmployeePointsListItem[]> {
  if (rows.length === 0) return [];

  const employees = await loadEmployeesById(rows.map((row) => row.employee_id));

  return rows.map((row) => {
    const employee = employees.get(row.employee_id);
    const display = employeeDisplay(employee);
    return {
      ...row,
      employeeName: display.name,
      employeeNumber: display.number,
      employeeDepartment: employee?.department ?? null,
      employeeStatus: employee?.status ?? null,
    };
  });
}

/* =====================================================================
 * REWARD REDEMPTIONS
 * ===================================================================== */

/**
 * Lists reward redemptions with presentation enrichment, newest first. HR admin
 * scope. Redemptions are historical — never deleted.
 */
export async function listRewardRedemptions(): Promise<RedemptionListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .select(REDEMPTION_SELECT)
    .order("requested_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listRewardRedemptions: query error:", error);
    return NextResponse.json(
      { error: "Failed to load reward redemptions" },
      { status: 500 }
    );
  }

  return enrichRedemptions((data ?? []) as RewardRedemption[]);
}

export async function getRewardRedemption(
  redemptionId: string
): Promise<RedemptionListItem | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(redemptionId, "redemption id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .select(REDEMPTION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getRewardRedemption: query error:", error);
    return NextResponse.json(
      { error: "Failed to load reward redemption" },
      { status: 500 }
    );
  }
  if (!data) return NOT_FOUND_RESPONSE("Reward redemption");

  const [enriched] = await enrichRedemptions([data as RewardRedemption]);
  return enriched;
}

/**
 * Creates a reward redemption REQUEST record (HR admin scope).
 *
 * `points_used` is validated as a non-negative integer (a negative amount has
 * no business meaning). `reward_description` is free text — there is NO reward
 * catalog table in the live schema. `status` defaults to `'pending'` (free
 * text, no enum). The redemption record does NOT automatically consume the
 * employee's balance: the live schema provides no transactional linkage (no
 * trigger, no balance FK), so the balance is managed explicitly by HR and this
 * limitation is reported rather than hidden. Mutation → audit
 * (`redemption.created`).
 */
export async function createRewardRedemption(
  input: RedemptionInput | undefined
): Promise<RedemptionListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const raw: Record<string, unknown> = isRecord(input) ? input : {};
  const employeeId = await requireExistingEmployeeId(raw.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const pointsUsed = requireNonNegativeInteger(raw.points_used, "points_used");
  if (pointsUsed instanceof NextResponse) return pointsUsed;

  const description = requireOptionalText(
    raw.reward_description,
    "reward_description",
    REWARDS_MAX_REWARD_DESCRIPTION_LENGTH
  );
  if (description instanceof NextResponse) return description;

  const status = requireOptionalText(raw.status, "status", 50);
  if (status instanceof NextResponse) return status;

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .insert({
      employee_id: employeeId,
      points_used: pointsUsed as number,
      reward_description:
        description === ABSENT ? null : (description as string | null),
      status: status === ABSENT || status === null ? "pending" : (status as string),
    })
    .select(REDEMPTION_SELECT)
    .single();

  if (error) {
    console.error("createRewardRedemption: insert error:", error);
    return NextResponse.json(
      { error: constraintMessage(error, "Failed to create reward redemption") },
      { status: 400 }
    );
  }

  const [enriched] = await enrichRedemptions([data as RewardRedemption]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.redemptionCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.rewardRedemption,
    entityId: data.id,
    oldData: null,
    newData: {
      employee_id: data.employee_id,
      points_used: data.points_used,
      reward_description: data.reward_description,
      status: data.status,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Updates a reward redemption (HR admin scope).
 *
 * Only `status` and `reward_description` are editable; `employee_id` and
 * `points_used` describe the original request and stay immutable. `status` is
 * free text (no enum) — legacy values are preserved, not rewritten. When the
 * status CHANGES, `processed_at` is stamped server-side. Mutating the status
 * never adjusts the point balance (no transactional linkage exists). Mutation →
 * audit (`redemption.updated`).
 */
export async function updateRewardRedemption(
  redemptionId: string,
  input: UpdateRedemptionInput | undefined
): Promise<RedemptionListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(redemptionId, "redemption id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .select(REDEMPTION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    console.error("updateRewardRedemption: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load reward redemption" },
      { status: 500 }
    );
  }
  if (!existing) return NOT_FOUND_RESPONSE("Reward redemption");

  const raw: Record<string, unknown> = isRecord(input) ? input : {};

  let nextStatus = existing.status;
  if (raw.status !== undefined) {
    const status = requireNonEmptyText(raw.status, "status", 50);
    if (status instanceof NextResponse) return status;
    nextStatus = status as string;
  }

  let nextDescription: string | null = existing.reward_description;
  if (raw.reward_description !== undefined) {
    const description = requireOptionalText(
      raw.reward_description,
      "reward_description",
      REWARDS_MAX_REWARD_DESCRIPTION_LENGTH
    );
    if (description instanceof NextResponse) return description;
    nextDescription = description as string | null;
  }

  const statusChanged = nextStatus !== existing.status;
  const patch: Record<string, unknown> = {
    status: nextStatus,
    reward_description: nextDescription,
  };
  if (statusChanged) {
    patch.processed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_reward_redemptions")
    .update(patch)
    .eq("id", id)
    .select(REDEMPTION_SELECT)
    .single();

  if (error) {
    console.error("updateRewardRedemption: update error:", error);
    return NextResponse.json(
      { error: constraintMessage(error, "Failed to update reward redemption") },
      { status: 400 }
    );
  }

  const [enriched] = await enrichRedemptions([data as RewardRedemption]);
  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.redemptionUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.rewardRedemption,
    entityId: id,
    oldData: {
      status: existing.status,
      reward_description: existing.reward_description,
      processed_at: existing.processed_at,
    },
    newData: {
      status: data.status,
      reward_description: data.reward_description,
      processed_at: data.processed_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return enriched;
}

/**
 * Pure display enrichment for redemption rows: resolves employee
 * name/number/department/status from `hr1_employees`. Not used for
 * authorization.
 */
async function enrichRedemptions(
  rows: RewardRedemption[]
): Promise<RedemptionListItem[]> {
  if (rows.length === 0) return [];

  const employees = await loadEmployeesById(rows.map((row) => row.employee_id));

  return rows.map((row) => {
    const employee = employees.get(row.employee_id);
    const display = employeeDisplay(employee);
    return {
      ...row,
      employeeName: display.name,
      employeeNumber: display.number,
      employeeDepartment: employee?.department ?? null,
      employeeStatus: employee?.status ?? null,
    };
  });
}