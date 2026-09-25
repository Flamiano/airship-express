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
  requireActiveEmployeeId,
  requireNonEmptyText,
  requireOptionalText,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  SUCCESSION_POTENTIAL_RATING_MAX,
  SUCCESSION_POTENTIAL_RATING_MIN,
  type CriticalPosition,
  type CriticalPositionInput,
  type CriticalPositionListItem,
  type SuccessionCandidate,
  type SuccessionCandidateInput,
  type SuccessionCandidateListItem,
  type UpdateCriticalPositionInput,
  type UpdateSuccessionCandidateInput,
} from "@/performance-development-dashboard/types";
import {
  SUCCESSION_MAX_NOTES_LENGTH,
  SUCCESSION_MAX_READINESS_LENGTH,
  SUCCESSION_MAX_REASON_LENGTH,
  SUCCESSION_MAX_RISK_LEVEL_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

export type {
  CriticalPosition,
  CriticalPositionInput,
  CriticalPositionListItem,
  SuccessionCandidate,
  SuccessionCandidateInput,
  SuccessionCandidateListItem,
  UpdateCriticalPositionInput,
  UpdateSuccessionCandidateInput,
} from "@/performance-development-dashboard/types";

/**
 * Succession Planning domain (foundation).
 *
 * MODEL (two explicit, separately-managed concepts, reflecting the live schema)
 *
 *   CRITICAL POSITION  → `hr3_critical_positions` — one row per job position
 *                        (FK `position_id` → `hr1_job_positions.id`) that the
 *                        organization treats as critical, with a free-text
 *                        `risk_level` and nullable `reason`.
 *   SUCCESSION CANDIDATE → `hr3_succession_candidates` — one row per
 *                        employee the organization records as a successor to a
 *                        CRITICAL POSITION (FK `position_id` →
 *                        `hr3_critical_positions.id`, FK `employee_id` →
 *                        `hr1_employees.id`), with free-text `readiness_level`,
 *                        optional integer `potential_rating` (CHECK 1..5),
 *                        optional numeric `performance_rating` (no DB check),
 *                        and optional `development_notes`.
 *
 * CRITICAL POSITION → SUCCESSION CANDIDATE is the ONLY relationship this module
 * understands. Candidates are never inferred from job titles, departments,
 * organizational hierarchy, HR demo data, employee creator identity, or the
 * logged-in account. Readiness/ratings are EXPLICIT stored fields, never
 * computed: there is no readiness formula, no gap, no score derivation.
 *
 * NON-GOALS (explicitly NOT automated, in line with the separation rules):
 *   - no promotion / job-position-change workflow (never touches
 *     `hr1_employees.job_position_id`),
 *   - no manager/reporting assignment,
 *   - no appraisal creation or appraisal scoring,
 *   - no competency assessment creation,
 *   - no development-plan creation,
 *   - no readiness calculation from appraisal score, competency gap, training,
 *     tenure, title, or department.
 *
 * SCOPE / AUTHORIZATION
 *   Succession planning is organization-level HR planning data with no
 *   employee self-service concept, so EVERY operation (reads and mutations)
 *   requires HR admin scope (`assertHrAdminScope`, roles per the existing
 *   `DASHBOARD_ACCESS[PERFORMANCE_DEVELOPMENT]`). The client never supplies an
 *   actor: attribution is resolved server-side through the established
 *   hr_admin → hr1_employees identity chain and recorded in `hr3_audit_events`
 *   as the ACTUAL HR ACCOUNT (`actor_id` = `hr_admin.id`, via
 *   `auditActorFromIdentity`), never the linked employee.
 *
 * DATA-VOCABULARY HONESTY
 *   `risk_level` and `readiness_level` are free text (verified live: no check
 *   constraints, arbitrary values accepted; `readiness_level` DB default
 *   `'3plus_years'`). Values are stored and rendered as-is. Unknown/legacy
 *   values render with a neutral badge — never silently rewritten, never
 *   rejected on read. Write validation here only enforces "non-empty, bounded
 *   length" because the columns are NOT NULL; it never restricts vocabulary.
 *   `potential_rating` uses the schema's own 1..5 CHECK. `performance_rating`
 *   accepts any finite number (the DB imposes no range) and is never
 *   normalized into a score.
 *
 * DELETION (only where business semantics require it)
 *   A candidate can be removed (`succession_candidate.removed`): the live
 *   table has no status/archive column, so removal is a real row delete.
 *   A critical position can be deleted only after its candidates are removed
 *   first — the FK to candidates is RESTRICT (verified live), and silently
 *   cascading rows off a plan is not acceptable, so the server pre-checks and
 *   returns a 409 with the blocking count.
 *
 * `updated_at` on candidates has NO database trigger (verified live), so the
 * server stamps it explicitly on every update.
 */

const CRITICAL_POSITION_SELECT =
  "id, position_id, risk_level, reason, created_at";
const CANDIDATE_SELECT =
  "id, position_id, employee_id, readiness_level, potential_rating, performance_rating, development_notes, updated_at";

const NOT_FOUND_CANDIDATE_RESPONSE = () =>
  NextResponse.json({ error: "Succession candidate not found" }, { status: 404 });

const NOT_FOUND_CRITICAL_RESPONSE = () =>
  NextResponse.json(
    { error: "Critical position not found" },
    { status: 404 }
  );

/**
 * Validates an OPTIONAL integer in the schema's 1..5 range. Absent → ABSENT
 * marker; null → null (clear); anything else must pass the live CHECK.
 */
function requirePotentialRating(
  value: unknown
): number | null | typeof ABSENT | NextResponse {
  if (value === undefined) return ABSENT;
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < SUCCESSION_POTENTIAL_RATING_MIN ||
    value > SUCCESSION_POTENTIAL_RATING_MAX
  ) {
    return BAD_REQUEST_RESPONSE(
      `potential_rating must be an integer between ${SUCCESSION_POTENTIAL_RATING_MIN} and ${SUCCESSION_POTENTIAL_RATING_MAX}, or null.`
    );
  }
  return value;
}

/**
 * Validates an OPTIONAL numeric performance rating. The live column is
 * `numeric` with NO range check (verified: 101, -1, 5.5 and 0 all accepted),
 * so only finite-number validity is enforced — no range policy is invented and
 * nothing is computed from it.
 */
function requirePerformanceRating(
  value: unknown
): number | null | typeof ABSENT | NextResponse {
  if (value === undefined) return ABSENT;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value.trim());
  }
  return BAD_REQUEST_RESPONSE(
    "performance_rating must be a valid number, or null."
  );
}

async function requireExistingJobPositionId(
  value: unknown
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "position_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingJobPositionId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate job position" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "position_id does not reference an existing job position."
    );
  }

  return id;
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
    return BAD_REQUEST_RESPONSE(
      "employee_id does not reference an existing employee."
    );
  }

  return id;
}

async function requireExistingCriticalPositionId(
  value: unknown
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "critical position id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingCriticalPositionId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate critical position" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "critical position id does not reference an existing critical position."
    );
  }

  return id;
}

type JobPositionRow = {
  id: string;
  title: string;
  department: string;
  is_active: boolean;
};

async function loadJobPositionsById(ids: string[]): Promise<Map<string, JobPositionRow>> {
  const map = new Map<string, JobPositionRow>();
  if (ids.length === 0) return map;

  const unique = [...new Set(ids)].filter(Boolean) as string[];
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("hr1_job_positions")
    .select("id, title, department, is_active")
    .in("id", unique);

  if (error) {
    console.error("loadJobPositionsById: query error:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

type EmployeeRow = {
  id: string;
  employee_id_number: string;
  first_name: string;
  last_name: string;
  department: string | null;
  job_position_id: string | null;
  status: string;
};

/**
 * Server enrichment for Critical Position rows: resolves the referenced job
 * position's title/department/active flag and the LIVE count of succession
 * candidate rows per critical position. Pure display enrichment — never used
 * for authorization.
 */
async function enrichCriticalPositions(
  rows: CriticalPosition[]
): Promise<CriticalPositionListItem[]> {
  if (rows.length === 0) return [];

  const jobPositionIds = rows.map((row) => row.position_id);
  const jobPositions = await loadJobPositionsById(jobPositionIds);

  const { data: candidateRows, error: candidateError } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select("position_id")
    .in(
      "position_id",
      rows.map((row) => row.id)
    );

  if (candidateError) {
    console.error(
      "enrichCriticalPositions: candidate count query error:",
      candidateError
    );
  }

  const countByPosition = new Map<string, number>();
  for (const row of candidateRows ?? []) {
    countByPosition.set(
      row.position_id,
      (countByPosition.get(row.position_id) ?? 0) + 1
    );
  }

  return rows.map((row) => {
    const jobPosition = jobPositions.get(row.position_id);
    return {
      ...row,
      positionTitle: jobPosition?.title ?? "Unknown position",
      positionDepartment: jobPosition?.department ?? "",
      positionActive: jobPosition?.is_active ?? false,
      candidateCount: countByPosition.get(row.id) ?? 0,
    };
  });
}

/**
 * Server enrichment for Succession Candidate rows: resolves the critical
 * position's job position (the role being succeeded) and the candidate
 * employee's name/number/status/current job. Pure display enrichment — never
 * used for authorization and never used to infer relationships.
 */
async function enrichSuccessionCandidates(
  rows: SuccessionCandidate[]
): Promise<SuccessionCandidateListItem[]> {
  if (rows.length === 0) return [];

  const criticalPositionIds = rows.map((row) => row.position_id);
  const employeeIds = rows.map((row) => row.employee_id);

  const [criticalRows, employeeRows] = await Promise.all([
    supabaseAdmin
      .from("hr3_critical_positions")
      .select("id, position_id, risk_level")
      .in("id", criticalPositionIds),
    supabaseAdmin
      .from("hr1_employees")
      .select(
        "id, employee_id_number, first_name, last_name, department, job_position_id, status"
      )
      .in("id", employeeIds),
  ]);

  if (criticalRows.error) {
    console.error(
      "enrichSuccessionCandidates: critical position query error:",
      criticalRows.error
    );
  }
  if (employeeRows.error) {
    console.error(
      "enrichSuccessionCandidates: employee query error:",
      employeeRows.error
    );
  }

  const criticalById = new Map<string, { position_id: string; risk_level: string }>();
  for (const row of criticalRows.data ?? []) {
    criticalById.set(row.id, { position_id: row.position_id, risk_level: row.risk_level });
  }

  const employeesById = new Map<string, EmployeeRow>();
  for (const row of employeeRows.data ?? []) {
    employeesById.set(row.id, row);
  }

  const allJobPositionIds = [
    ...new Set([
      ...rows.map((row) => criticalById.get(row.position_id)?.position_id),
      ...rows.map((row) => employeesById.get(row.employee_id)?.job_position_id),
    ]),
  ].filter((id): id is string => Boolean(id));

  const jobPositions = await loadJobPositionsById(allJobPositionIds);

  return rows.map((row) => {
    const critical = criticalById.get(row.position_id);
    const employee = employeesById.get(row.employee_id);
    const criticalJob = critical ? jobPositions.get(critical.position_id) : undefined;
    const employeeJob = employee?.job_position_id
      ? jobPositions.get(employee.job_position_id)
      : undefined;

    const name = employee
      ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
      : "Unknown employee";

    return {
      ...row,
      positionTitle: criticalJob?.title ?? "Unknown position",
      positionDepartment: criticalJob?.department ?? "",
      riskLevel: critical?.risk_level ?? "",
      employeeName: name,
      employeeNumber: employee?.employee_id_number ?? "",
      employeeJobPosition: employeeJob?.title ?? null,
      employeeDepartment: employee?.department ?? null,
      employeeStatus: employee?.status ?? null,
    };
  });
}

/* =====================================================================
 * CRITICAL POSITIONS
 * ===================================================================== */

export type ListCriticalPositionsQuery = Record<string, unknown>;

/**
 * Lists critical positions with presentation enrichment, newest first. HR
 * admin scope only. Optional `job_position_id` filter must reference an
 * existing job position (validated server-side).
 */
export async function listCriticalPositions(
  input: ListCriticalPositionsQuery
): Promise<CriticalPositionListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  let query = supabaseAdmin
    .from("hr3_critical_positions")
    .select(CRITICAL_POSITION_SELECT);

  if (input?.job_position_id !== undefined && input?.job_position_id !== null) {
    const jobPositionId = await requireExistingJobPositionId(
      input.job_position_id
    );
    if (jobPositionId instanceof NextResponse) return jobPositionId;
    query = query.eq("position_id", jobPositionId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listCriticalPositions: query error:", error);
    return NextResponse.json(
      { error: "Failed to load critical positions" },
      { status: 500 }
    );
  }

  return enrichCriticalPositions((data ?? []) as CriticalPosition[]);
}

/**
 * Reads one critical position (HR admin scope) enriched for display.
 */
export async function getCriticalPosition(
  criticalPositionId: string
): Promise<CriticalPositionListItem | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(criticalPositionId, "critical position id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select(CRITICAL_POSITION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getCriticalPosition: query error:", error);
    return NextResponse.json(
      { error: "Failed to load critical position" },
      { status: 500 }
    );
  }

  if (!data) return NOT_FOUND_CRITICAL_RESPONSE();

  const [enriched] = await enrichCriticalPositions([data as CriticalPosition]);
  return enriched;
}

/**
 * Creates a critical position (HR admin scope).
 *
 * `position_id` must reference an existing `hr1_job_positions` row;
 * `risk_level` is required (NOT NULL free text — vocabulary suggestions exist
 * in the UI but are never enforced here); `reason` is optional. Mutation →
 * audit (`critical_position.created`) with the ACTING HR ACCOUNT as the actor.
 */
export async function createCriticalPosition(
  input: CriticalPositionInput
): Promise<CriticalPositionListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const positionId = await requireExistingJobPositionId(input?.position_id);
  if (positionId instanceof NextResponse) return positionId;

  const riskLevel = requireNonEmptyText(
    input?.risk_level,
    "risk_level",
    SUCCESSION_MAX_RISK_LEVEL_LENGTH
  );
  if (riskLevel instanceof NextResponse) return riskLevel;

  let reason: string | null = null;
  const reasonValue = requireOptionalText(
    input?.reason,
    "reason",
    SUCCESSION_MAX_REASON_LENGTH
  );
  if (reasonValue instanceof NextResponse) return reasonValue;
  if (reasonValue !== ABSENT) reason = reasonValue;

  const duplicateCheck = await supabaseAdmin
    .from("hr3_critical_positions")
    .select("id")
    .eq("position_id", positionId)
    .maybeSingle();

  if (duplicateCheck.error) {
    console.error(
      "createCriticalPosition: duplicate check error:",
      duplicateCheck.error
    );
    return NextResponse.json(
      { error: "Failed to create critical position" },
      { status: 500 }
    );
  }

  if (duplicateCheck.data) {
    return BAD_REQUEST_RESPONSE(
      "This job position is already marked as critical."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .insert({ position_id: positionId, risk_level: riskLevel, reason })
    .select(CRITICAL_POSITION_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return BAD_REQUEST_RESPONSE(
        "This job position is already marked as critical."
      );
    }
    console.error("createCriticalPosition: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create critical position" },
      { status: 500 }
    );
  }

  const created = data as CriticalPosition;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.criticalPositionCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.criticalPosition,
    entityId: created.id,
    oldData: null,
    newData: {
      position_id: created.position_id,
      risk_level: created.risk_level,
      reason: created.reason,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichCriticalPositions([created]);
  return enriched;
}

/**
 * Updates editable critical-position fields (HR admin scope): `position_id`,
 * `risk_level`, `reason`. `id`/`created_at` are never client-supplied.
 * Mutation → audit (`critical_position.updated`).
 */
export async function updateCriticalPosition(
  criticalPositionId: string,
  input: UpdateCriticalPositionInput
): Promise<CriticalPositionListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(criticalPositionId, "critical position id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select(CRITICAL_POSITION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateCriticalPosition: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load critical position" },
      { status: 500 }
    );
  }

  if (!existing) return NOT_FOUND_CRITICAL_RESPONSE();

  const prev = existing as CriticalPosition;
  const patch: Record<string, unknown> = {};

  if ("position_id" in input) {
    const positionId = await requireExistingJobPositionId(input.position_id);
    if (positionId instanceof NextResponse) return positionId;

    if (positionId !== prev.position_id) {
      const duplicateCheck = await supabaseAdmin
        .from("hr3_critical_positions")
        .select("id")
        .eq("position_id", positionId)
        .maybeSingle();
      if (duplicateCheck.data) {
        return BAD_REQUEST_RESPONSE(
          "This job position is already marked as critical."
        );
      }
    }

    patch.position_id = positionId;
  }

  if ("risk_level" in input) {
    const riskLevel = requireNonEmptyText(
      input.risk_level,
      "risk_level",
      SUCCESSION_MAX_RISK_LEVEL_LENGTH
    );
    if (riskLevel instanceof NextResponse) return riskLevel;
    patch.risk_level = riskLevel;
  }

  if ("reason" in input) {
    const reasonValue = requireOptionalText(
      input.reason,
      "reason",
      SUCCESSION_MAX_REASON_LENGTH
    );
    if (reasonValue instanceof NextResponse) return reasonValue;
    patch.reason = reasonValue === ABSENT ? prev.reason : reasonValue;
  }

  if (Object.keys(patch).length === 0) {
    return BAD_REQUEST_RESPONSE("No updatable fields were provided.");
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .update(patch)
    .eq("id", id)
    .select(CRITICAL_POSITION_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return BAD_REQUEST_RESPONSE(
        "This job position is already marked as critical."
      );
    }
    console.error("updateCriticalPosition: update error:", error);
    return NextResponse.json(
      { error: "Failed to update critical position" },
      { status: 500 }
    );
  }

  if (!data) return NOT_FOUND_CRITICAL_RESPONSE();

  const updated = data as CriticalPosition;

  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  for (const field of ["position_id", "risk_level", "reason"] as const) {
    if (prev[field] !== updated[field]) {
      oldData[field] = prev[field];
      newData[field] = updated[field];
    }
  }

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.criticalPositionUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.criticalPosition,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichCriticalPositions([updated]);
  return enriched;
}

/**
 * Deletes a critical position (HR admin scope) — only when it has NO
 * succession candidates, because the candidates FK is RESTRICT (verified live)
 * and silently removing a plan's candidates would be destructive. A blocking
 * 409 reports the count. Mutation → audit (`critical_position.deleted`).
 */
export async function deleteCriticalPosition(
  criticalPositionId: string
): Promise<{ id: string; deleted: boolean } | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(criticalPositionId, "critical position id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_critical_positions")
    .select("id, position_id, risk_level")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("deleteCriticalPosition: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load critical position" },
      { status: 500 }
    );
  }

  if (!existing) return NOT_FOUND_CRITICAL_RESPONSE();

  const { count, error: countError } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select("id", { count: "exact", head: true })
    .eq("position_id", id);

  if (countError) {
    console.error(
      "deleteCriticalPosition: candidate count error:",
      countError
    );
    return NextResponse.json(
      { error: "Failed to check succession candidates" },
      { status: 500 }
    );
  }

  if ((count ?? 0) > 0) {
    return CONFLICT_RESPONSE(
      `This critical position still has ${count} succession candidate${
        count === 1 ? "" : "s"
      }. Remove them first before deleting the critical position.`
    );
  }

  const { error } = await supabaseAdmin
    .from("hr3_critical_positions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteCriticalPosition: delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete critical position" },
      { status: 500 }
    );
  }

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.criticalPositionDeleted,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.criticalPosition,
    entityId: id,
    oldData: { position_id: existing.position_id, risk_level: existing.risk_level },
    newData: null,
  });
  if (auditError instanceof NextResponse) return auditError;

  return { id, deleted: true };
}

/* =====================================================================
 * SUCCESSION CANDIDATES
 * ===================================================================== */

export type ListSuccessionCandidatesQuery = Record<string, unknown>;

/**
 * Lists succession candidates with presentation enrichment, newest first. HR
 * admin scope only. Optional `critical_position_id` filter must reference an
 * existing critical position (validated server-side).
 */
export async function listSuccessionCandidates(
  input: ListSuccessionCandidatesQuery
): Promise<SuccessionCandidateListItem[] | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  let query = supabaseAdmin
    .from("hr3_succession_candidates")
    .select(CANDIDATE_SELECT);

  if (
    input?.critical_position_id !== undefined &&
    input?.critical_position_id !== null
  ) {
    const criticalPositionId = await requireExistingCriticalPositionId(
      input.critical_position_id
    );
    if (criticalPositionId instanceof NextResponse) return criticalPositionId;
    query = query.eq("position_id", criticalPositionId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("listSuccessionCandidates: query error:", error);
    return NextResponse.json(
      { error: "Failed to load succession candidates" },
      { status: 500 }
    );
  }

  return enrichSuccessionCandidates((data ?? []) as SuccessionCandidate[]);
}

/**
 * Reads one succession candidate (HR admin scope) enriched for display.
 */
export async function getSuccessionCandidate(
  candidateId: string
): Promise<SuccessionCandidateListItem | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(candidateId, "candidate id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select(CANDIDATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getSuccessionCandidate: query error:", error);
    return NextResponse.json(
      { error: "Failed to load succession candidate" },
      { status: 500 }
    );
  }

  if (!data) return NOT_FOUND_CANDIDATE_RESPONSE();

  const [enriched] = await enrichSuccessionCandidates([
    data as SuccessionCandidate,
  ]);
  return enriched;
}

/**
 * Adds an employee as a successor to a critical position (HR admin scope).
 *
 * `criticalPositionId` is the `hr3_critical_positions` row the candidate is
 * recorded against (resolved server-side from the route; the client passes it
 * only as the URL parameter and it is re-validated against the DB). `employee_id`
 * must reference an existing employee. `readiness_level` is required (NOT NULL
 * free text); `potential_rating` is the schema's optional 1..5; the optional
 * `performance_rating` accepts any finite number; `development_notes` optional.
 *
 * NO automatic side effects are performed — this never changes the employee's
 * job position, never marks them a manager, never creates appraisals,
 * competencies, or development plans. Mutation → audit
 * (`succession_candidate.added`).
 */
export async function createSuccessionCandidate(
  criticalPositionId: string,
  input: SuccessionCandidateInput
): Promise<SuccessionCandidateListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const positionId = await requireExistingCriticalPositionId(criticalPositionId);
  if (positionId instanceof NextResponse) return positionId;

  const employeeId = await requireActiveEmployeeId(input?.employee_id, "employee_id");
  if (employeeId instanceof NextResponse) return employeeId;

  const readinessLevel = requireNonEmptyText(
    input?.readiness_level,
    "readiness_level",
    SUCCESSION_MAX_READINESS_LENGTH
  );
  if (readinessLevel instanceof NextResponse) return readinessLevel;

  const potentialRating = requirePotentialRating(input?.potential_rating);
  if (potentialRating instanceof NextResponse) return potentialRating;

  const performanceRating = requirePerformanceRating(input?.performance_rating);
  if (performanceRating instanceof NextResponse) return performanceRating;

  let developmentNotes: string | null = null;
  const notesValue = requireOptionalText(
    input?.development_notes,
    "development_notes",
    SUCCESSION_MAX_NOTES_LENGTH
  );
  if (notesValue instanceof NextResponse) return notesValue;
  if (notesValue !== ABSENT) developmentNotes = notesValue;

  const payload: Record<string, unknown> = {
    position_id: positionId,
    employee_id: employeeId,
    readiness_level: readinessLevel,
  };
  if (potentialRating !== ABSENT) payload.potential_rating = potentialRating;
  if (performanceRating !== ABSENT) payload.performance_rating = performanceRating;
  payload.development_notes = developmentNotes;

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .insert(payload)
    .select(CANDIDATE_SELECT)
    .single();

  if (error) {
    console.error("createSuccessionCandidate: insert error:", error);
    return NextResponse.json(
      { error: "Failed to add succession candidate" },
      { status: 500 }
    );
  }

  const created = data as SuccessionCandidate;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.successionCandidateAdded,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.successionCandidate,
    entityId: created.id,
    oldData: null,
    newData: {
      position_id: created.position_id,
      employee_id: created.employee_id,
      readiness_level: created.readiness_level,
      potential_rating: created.potential_rating,
      performance_rating: created.performance_rating,
      development_notes: created.development_notes,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichSuccessionCandidates([created]);
  return enriched;
}

/**
 * Updates a succession candidate (HR admin scope).
 *
 * Editable: `readiness_level`, `potential_rating`, `performance_rating`,
 * `development_notes`. `employee_id` and `position_id` are immutable — moving a
 * candidate to another employee or another critical position is a remove +
 * re-add operation, never a silent reassignment. `updated_at` is stamped
 * server-side (the table has no trigger). Mutation → audit
 * (`succession_candidate.updated`).
 */
export async function updateSuccessionCandidate(
  candidateId: string,
  input: UpdateSuccessionCandidateInput
): Promise<SuccessionCandidateListItem | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(candidateId, "candidate id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select(CANDIDATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateSuccessionCandidate: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load succession candidate" },
      { status: 500 }
    );
  }

  if (!existing) return NOT_FOUND_CANDIDATE_RESPONSE();

  const prev = existing as SuccessionCandidate;
  const patch: Record<string, unknown> = {};

  if ("readiness_level" in input) {
    if (input.readiness_level === undefined || input.readiness_level === null) {
      return BAD_REQUEST_RESPONSE(
        "readiness_level is required and must be non-empty."
      );
    }
    const readinessLevel = requireNonEmptyText(
      input.readiness_level,
      "readiness_level",
      SUCCESSION_MAX_READINESS_LENGTH
    );
    if (readinessLevel instanceof NextResponse) return readinessLevel;
    patch.readiness_level = readinessLevel;
  }

  if ("potential_rating" in input) {
    const potentialRating = requirePotentialRating(input.potential_rating);
    if (potentialRating instanceof NextResponse) return potentialRating;
    patch.potential_rating =
      potentialRating === ABSENT ? prev.potential_rating : potentialRating;
  }

  if ("performance_rating" in input) {
    const performanceRating = requirePerformanceRating(input.performance_rating);
    if (performanceRating instanceof NextResponse) return performanceRating;
    patch.performance_rating =
      performanceRating === ABSENT
        ? prev.performance_rating
        : performanceRating;
  }

  if ("development_notes" in input) {
    const notesValue = requireOptionalText(
      input.development_notes,
      "development_notes",
      SUCCESSION_MAX_NOTES_LENGTH
    );
    if (notesValue instanceof NextResponse) return notesValue;
    patch.development_notes =
      notesValue === ABSENT ? prev.development_notes : notesValue;
  }

  if (Object.keys(patch).length === 0) {
    return BAD_REQUEST_RESPONSE("No updatable fields were provided.");
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .update(patch)
    .eq("id", id)
    .select(CANDIDATE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("updateSuccessionCandidate: update error:", error);
    return NextResponse.json(
      { error: "Failed to update succession candidate" },
      { status: 500 }
    );
  }

  if (!data) return NOT_FOUND_CANDIDATE_RESPONSE();

  const updated = data as SuccessionCandidate;

  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  for (const field of [
    "readiness_level",
    "potential_rating",
    "performance_rating",
    "development_notes",
  ] as const) {
    if (prev[field] !== updated[field]) {
      oldData[field] = prev[field];
      newData[field] = updated[field];
    }
  }

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.successionCandidateUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.successionCandidate,
    entityId: updated.id,
    oldData,
    newData,
  });
  if (auditError instanceof NextResponse) return auditError;

  const [enriched] = await enrichSuccessionCandidates([updated]);
  return enriched;
}

/**
 * Removes a succession candidate (HR admin scope).
 *
 * The live table has no status/archive column (verified), so removal is a real
 * row delete — never a position/job change for the employee. Their
 * `hr1_employees` row, job position, manager relationships (none inferred),
 * appraisals, competencies, and development plans are all untouched. Mutation
 * → audit (`succession_candidate.removed`).
 */
export async function deleteSuccessionCandidate(
  candidateId: string
): Promise<{ id: string; deleted: boolean } | NextResponse> {
  const identity = await assertHrAdminScope();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(candidateId, "candidate id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .select("id, position_id, employee_id, readiness_level")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("deleteSuccessionCandidate: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load succession candidate" },
      { status: 500 }
    );
  }

  if (!existing) return NOT_FOUND_CANDIDATE_RESPONSE();

  const { error } = await supabaseAdmin
    .from("hr3_succession_candidates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteSuccessionCandidate: delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove succession candidate" },
      { status: 500 }
    );
  }

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.successionCandidateRemoved,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.successionCandidate,
    entityId: id,
    oldData: {
      position_id: existing.position_id,
      employee_id: existing.employee_id,
      readiness_level: existing.readiness_level,
    },
    newData: null,
  });
  if (auditError instanceof NextResponse) return auditError;

  return { id, deleted: true };
}