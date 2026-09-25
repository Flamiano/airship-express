import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  assertHrAdminScope,
  resolveManagerDirectReportUuids,
} from "@/performance-development-dashboard/lib/auth/access";
import { getAuthenticatedActor } from "@/performance-development-dashboard/lib/auth/actor";
import { requireHrEmployee } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromPerDevActor,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  BAD_REQUEST_RESPONSE,
  FORBIDDEN_RESPONSE,
  requireNonEmptyText,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  MAX_DEV_PLAN_ACTION_LENGTH,
  MAX_DEV_PLAN_TARGET_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  DEV_PLAN_ITEM_STATUSES,
  type CreateDevelopmentPlanItemInput,
  type DevelopmentPlanItem,
  type DevPlanItemStatus,
  type UpdateDevelopmentPlanItemInput,
} from "@/performance-development-dashboard/types";

export type {
  CreateDevelopmentPlanItemInput,
  DevelopmentPlanItem,
  DevPlanItemStatus,
  UpdateDevelopmentPlanItemInput,
};

/* ── Constants ─────────────────────────────────────────────────────── */

const DEV_PLAN_ITEM_SELECT =
  "id, appraisal_id, employee_id, action, target, status, created_at, updated_at";

const VALID_STATUSES = new Set<string>(DEV_PLAN_ITEM_STATUSES);

/* ── Helpers ───────────────────────────────────────────────────────── */

function isValidStatus(value: string): value is DevPlanItemStatus {
  return VALID_STATUSES.has(value);
}

function badRequest(message: string): NextResponse {
  return BAD_REQUEST_RESPONSE(message);
}

function loadDevPlanItemOr404(
  id: string,
): Promise<DevelopmentPlanItem | NextResponse> {
  return loadDevPlanItem(id);
}

async function loadDevPlanItem(
  id: string,
): Promise<DevelopmentPlanItem | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .select(DEV_PLAN_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("loadDevPlanItem: query error:", error);
    return badRequest("Failed to load development plan item.");
  }

  if (!data) {
    return NextResponse.json(
      { error: "Development plan item not found." },
      { status: 404 },
    );
  }

  return data as DevelopmentPlanItem;
}

async function loadAppraisalForDevPlan(
  appraisalId: string,
): Promise<{ employee_id: string; status: string } | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("employee_id, status")
    .eq("id", appraisalId)
    .maybeSingle();

  if (error) {
    console.error("loadAppraisalForDevPlan: query error:", error);
    return badRequest("Failed to load appraisal.");
  }

  if (!data) {
    return NextResponse.json(
      { error: "Appraisal not found." },
      { status: 404 },
    );
  }

  return data;
}

/**
 * Actor scope for development-plan access, resolved BEFORE any appraisal or
 * item row is read: org-wide for PerDev HR Admin, otherwise the
 * server-resolved employee set (self for employees, self + active direct
 * reports for managers).
 */
type DevPlanActorScope = { orgWide: true } | { employeeIds: string[] };

async function resolveDevPlanActorScope(): Promise<
  DevPlanActorScope | NextResponse
> {
  const hrScope = await assertHrAdminScope();
  if (!(hrScope instanceof NextResponse)) {
    return { orgWide: true };
  }

  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  if (identity.accountType === "manager") {
    const directReports = await resolveManagerDirectReportUuids(
      identity.employeeUuid,
    );
    return { employeeIds: [identity.employeeUuid, ...directReports] };
  }

  return { employeeIds: [identity.employeeUuid] };
}

/**
 * Loads the appraisal anchor for a development-plan operation constrained by
 * the actor's already-resolved scope, so out-of-scope appraisal rows are
 * never read. HR scope preserves the 404 miss; scoped misses preserve the
 * 403 denial (a missing id previously 404'd here — no data is disclosed
 * either way).
 */
async function loadAppraisalForDevPlanScoped(
  appraisalId: string,
  scope: DevPlanActorScope,
): Promise<{ employee_id: string; status: string } | NextResponse> {
  if ("orgWide" in scope) {
    return loadAppraisalForDevPlan(appraisalId);
  }

  if (scope.employeeIds.length === 0) {
    return FORBIDDEN_RESPONSE();
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("employee_id, status")
    .eq("id", appraisalId)
    .in("employee_id", scope.employeeIds)
    .maybeSingle();

  if (error) {
    console.error("loadAppraisalForDevPlanScoped: query error:", error);
    return badRequest("Failed to load appraisal.");
  }

  if (!data) {
    return FORBIDDEN_RESPONSE();
  }

  return data;
}

/**
 * Authorize that the authenticated actor can manage development plan items
 * for the given appraisal. Returns the appraisal's employee_id on success,
 * or a NextResponse error.
 *
 * Authorization rules:
 * - HR Admin: full access (assertHrAdminScope)
 * - Manager: can manage items for direct reports' appraisals
 * - Employee: can manage items for their own appraisal
 */
async function authorizeDevPlanAccess(
  appraisalEmployeeId: string,
): Promise<string | NextResponse> {
  // HR Admin check first
  const hrScope = await assertHrAdminScope();
  if (!(hrScope instanceof NextResponse)) {
    return appraisalEmployeeId;
  }

  // Manager / Employee check
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  // Employee owns the appraisal
  if (identity.employeeUuid === appraisalEmployeeId) {
    return appraisalEmployeeId;
  }

  // Manager: check direct-report relationship
  if (identity.accountType === "manager") {
    const directReports = await resolveManagerDirectReportUuids(
      identity.employeeUuid,
    );
    if (directReports.includes(appraisalEmployeeId)) {
      return appraisalEmployeeId;
    }
  }

  return FORBIDDEN_RESPONSE();
}

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * List all development plan items for an appraisal.
 *
 * Authorization: HR Admin, Manager (direct reports), or Employee (self).
 */
export async function listDevPlanItems(
  appraisalId: string,
): Promise<DevelopmentPlanItem[] | NextResponse> {
  const appraisalIdValid = requireValidUuid(appraisalId, "appraisal id");
  if (appraisalIdValid instanceof NextResponse) return appraisalIdValid;

  const listScope = await resolveDevPlanActorScope();
  if (listScope instanceof NextResponse) return listScope;

  const appraisal = await loadAppraisalForDevPlanScoped(
    appraisalIdValid,
    listScope,
  );
  if (appraisal instanceof NextResponse) return appraisal;

  const authResult = await authorizeDevPlanAccess(appraisal.employee_id);
  if (authResult instanceof NextResponse) return authResult;

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .select(DEV_PLAN_ITEM_SELECT)
    .eq("appraisal_id", appraisalIdValid)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listDevPlanItems: query error:", error);
    return badRequest("Failed to load development plan items.");
  }

  return (data ?? []) as DevelopmentPlanItem[];
}

/**
 * Create a new development plan item for an appraisal.
 *
 * Authorization: HR Admin, Manager (direct reports), or Employee (self).
 * The appraisal must not be finalized or acknowledged.
 */
export async function createDevPlanItem(
  appraisalId: string,
  input: CreateDevelopmentPlanItemInput,
): Promise<DevelopmentPlanItem | NextResponse> {
  const appraisalIdValid = requireValidUuid(appraisalId, "appraisal id");
  if (appraisalIdValid instanceof NextResponse) return appraisalIdValid;

  const createScope = await resolveDevPlanActorScope();
  if (createScope instanceof NextResponse) return createScope;

  const appraisal = await loadAppraisalForDevPlanScoped(
    appraisalIdValid,
    createScope,
  );
  if (appraisal instanceof NextResponse) return appraisal;

  // Cannot add items to finalized/acknowledged appraisals
  if (appraisal.status === "finalized" || appraisal.status === "acknowledged") {
    return badRequest(
      "Cannot add development plan items to a finalized or acknowledged appraisal.",
    );
  }

  const authResult = await authorizeDevPlanAccess(appraisal.employee_id);
  if (authResult instanceof NextResponse) return authResult;

  const action = requireNonEmptyText(
    input?.action,
    "action",
    MAX_DEV_PLAN_ACTION_LENGTH,
  );
  if (action instanceof NextResponse) return action;

  const target = requireNonEmptyText(
    input?.target,
    "target",
    MAX_DEV_PLAN_TARGET_LENGTH,
  );
  if (target instanceof NextResponse) return target;

  let status: DevPlanItemStatus = "not_started";
  if (input?.status !== undefined) {
    if (!isValidStatus(input.status)) {
      return badRequest(
        `status must be one of: ${DEV_PLAN_ITEM_STATUSES.join(", ")}.`,
      );
    }
    status = input.status;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .insert({
      appraisal_id: appraisalIdValid,
      employee_id: appraisal.employee_id,
      action,
      target,
      status,
    })
    .select(DEV_PLAN_ITEM_SELECT)
    .single();

  if (error) {
    console.error("createDevPlanItem: insert error:", error);
    return badRequest("Failed to create development plan item.");
  }

  // Audit event (best-effort)
  const actor = await getAuthenticatedActor();
  if (!(actor instanceof NextResponse)) {
    await insertAuditEvent({
      actor: auditActorFromPerDevActor(actor),
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.developmentPlanItem,
      entityId: data.id,
      reason: PERFORMANCE_AUDIT_REASON.devPlanItemCreated,
    });
  }

  return data as DevelopmentPlanItem;
}

/**
 * Update an existing development plan item.
 *
 * Authorization: HR Admin, Manager (direct reports), or Employee (self).
 * The appraisal must not be finalized or acknowledged.
 */
export async function updateDevPlanItem(
  itemId: string,
  input: UpdateDevelopmentPlanItemInput,
): Promise<DevelopmentPlanItem | NextResponse> {
  const itemIdValid = requireValidUuid(itemId, "development plan item id");
  if (itemIdValid instanceof NextResponse) return itemIdValid;

  const existing = await loadDevPlanItemOr404(itemIdValid);
  if (existing instanceof NextResponse) return existing;

  // Load the appraisal to check status and authorize, constrained by the
  // actor's already-resolved scope so out-of-scope rows are never read.
  // The item row itself is keyed by unguessable UUID and discarded unless
  // its appraisal authorizes.
  const itemScope = await resolveDevPlanActorScope();
  if (itemScope instanceof NextResponse) return itemScope;

  const appraisal = await loadAppraisalForDevPlanScoped(
    existing.appraisal_id,
    itemScope,
  );
  if (appraisal instanceof NextResponse) return appraisal;

  if (appraisal.status === "finalized" || appraisal.status === "acknowledged") {
    return badRequest(
      "Cannot edit development plan items on a finalized or acknowledged appraisal.",
    );
  }

  const authResult = await authorizeDevPlanAccess(appraisal.employee_id);
  if (authResult instanceof NextResponse) return authResult;

  const updates: Record<string, unknown> = {};

  if (input?.action !== undefined) {
    const action = requireNonEmptyText(
      input.action,
      "action",
      MAX_DEV_PLAN_ACTION_LENGTH,
    );
    if (action instanceof NextResponse) return action;
    updates.action = action;
  }

  if (input?.target !== undefined) {
    const target = requireNonEmptyText(
      input.target,
      "target",
      MAX_DEV_PLAN_TARGET_LENGTH,
    );
    if (target instanceof NextResponse) return target;
    updates.target = target;
  }

  if (input?.status !== undefined) {
    if (!isValidStatus(input.status)) {
      return badRequest(
        `status must be one of: ${DEV_PLAN_ITEM_STATUSES.join(", ")}.`,
      );
    }
    updates.status = input.status;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .update(updates)
    .eq("id", itemIdValid)
    .select(DEV_PLAN_ITEM_SELECT)
    .single();

  if (error) {
    console.error("updateDevPlanItem: update error:", error);
    return badRequest("Failed to update development plan item.");
  }

  // Audit event (best-effort)
  const actor = await getAuthenticatedActor();
  if (!(actor instanceof NextResponse)) {
    await insertAuditEvent({
      actor: auditActorFromPerDevActor(actor),
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.developmentPlanItem,
      entityId: itemIdValid,
      reason: PERFORMANCE_AUDIT_REASON.devPlanItemUpdated,
    });
  }

  return data as DevelopmentPlanItem;
}

/**
 * Delete a development plan item.
 *
 * Authorization: HR Admin, Manager (direct reports), or Employee (self).
 * The appraisal must not be finalized or acknowledged.
 */
export async function deleteDevPlanItem(itemId: string): Promise<NextResponse> {
  const itemIdValid = requireValidUuid(itemId, "development plan item id");
  if (itemIdValid instanceof NextResponse) return itemIdValid;

  const existing = await loadDevPlanItemOr404(itemIdValid);
  if (existing instanceof NextResponse) return existing;

  const deleteScope = await resolveDevPlanActorScope();
  if (deleteScope instanceof NextResponse) return deleteScope;

  const appraisal = await loadAppraisalForDevPlanScoped(
    existing.appraisal_id,
    deleteScope,
  );
  if (appraisal instanceof NextResponse) return appraisal;

  if (appraisal.status === "finalized" || appraisal.status === "acknowledged") {
    return badRequest(
      "Cannot delete development plan items on a finalized or acknowledged appraisal.",
    );
  }

  const authResult = await authorizeDevPlanAccess(appraisal.employee_id);
  if (authResult instanceof NextResponse) return authResult;

  const { error } = await supabaseAdmin
    .from("hr3_performance_development_plan_items")
    .delete()
    .eq("id", itemIdValid);

  if (error) {
    console.error("deleteDevPlanItem: delete error:", error);
    return badRequest("Failed to delete development plan item.");
  }

  // Audit event (best-effort)
  const actor = await getAuthenticatedActor();
  if (!(actor instanceof NextResponse)) {
    await insertAuditEvent({
      actor: auditActorFromPerDevActor(actor),
      entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.developmentPlanItem,
      entityId: itemIdValid,
      reason: PERFORMANCE_AUDIT_REASON.devPlanItemDeleted,
    });
  }

  return NextResponse.json({ success: true });
}
