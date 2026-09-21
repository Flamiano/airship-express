import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import {
  requireHrEmployee,
} from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromIdentity,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  MAX_COMPETENCY_DESCRIPTION_LENGTH,
  MAX_COMPETENCY_NAME_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  ABSENT,
  BAD_REQUEST_RESPONSE,
  FORBIDDEN_RESPONSE,
  requireLevel,
  requireNonEmptyText,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  COMPETENCY_CATEGORIES,
  COMPETENCY_LEVEL_MAX,
  COMPETENCY_LEVEL_MIN,
  type Competency,
  type CompetencyCategory,
  type CompetencyInput,
  type EmployeeCompetencyAssessmentInput,
  type EmployeeCompetencyProfileItem,
  type EmployeeCompetencyScore,
  type PositionCompetencyRequirement,
  type PositionCompetencyRequirementInput,
  type UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";

export type {
  Competency,
  CompetencyCategory,
  CompetencyInput,
  EmployeeCompetencyAssessmentInput,
  EmployeeCompetencyProfileItem,
  EmployeeCompetencyScore,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";

/**
 * Competency Management domain (foundation).
 *
 * Four concepts are kept SEPARATE (never collapsed into one entity):
 *
 *   COMPETENCY             → `hr3_competencies` — a defined organizational
 *                            capability/behavior/skill (the library).
 *   POSITION REQUIREMENT   → `hr3_position_competency_requirements` — the
 *                            competency + required level expected of a job
 *                            position.
 *   EMPLOYEE COMPETENCY    → `hr3_employee_competency_scores` — the employee's
 *                            currently assessed state against a competency
 *                            (append-only assessment history; the profile is
 *                            the LATEST row per competency).
 *   APPRAISAL RESULT       → `hr3_performance_appraisal_competency_results` —
 *                            a formal appraisal-scoped result. Intentionally
 *                            UNTOUCHED here: it belongs to the future official
 *                            evaluation / scoring phase. No automatic
 *                            population, no appraisal integration.
 *
 * LEVELS / RATINGS
 *   Levels are plain integers, enforced to 1..5 by the live schema on BOTH the
 *   score and requirement tables (verified: 0/6 rejected, 1..5 accepted). This
 *   module PRESERVES that representation as-is — no normalization, no 1–5
 *   "conversion", no bands, no labels invented. The rating semantics are not
 *   finalized and will be decided in a later Scoring phase. Because both sides
 *   (current_level and required_level) are integers on the SAME live-validated
 *   scale, a simple GAP difference is safe to compute server-side:
 *   gap = effective_required_level − current_level, exposed only when both are
 *   known, and NEVER turned into a score/percentage.
 *
 * GAP SOURCING
 *   effective_required_level prefers the `required_level` column stored on the
 *   latest assessment row, and falls back to the employee's POSITION
 *   requirement level (via hr1_employees.job_position_id → the requirements
 *   table). `null` is shown as "Not assigned" — it is never silently zeroed.
 *
 * WHO MAY DO WHAT
 *   - HR scope (account role super_admin / hr_performance_admin, per the
 *     existing identity foundation): manage the competency library, manage
 *     position competency requirements, and record employee competency
 *     assessments. No organizational manager relationship exists in the data
 *     model (verified), so NONE is inferred from titles/departments —
 *     see `lib/auth/access.ts`.
 *   - Any other authenticated user acts as an EMPLOYEE and may only READ:
 *     the competency library, the requirements of THEIR OWN position, and
 *     THEIR OWN competency profile. Supplying another employee's id or a
 *     foreign position id is rejected with a generic 403 (never a leak).
 *
 * ASSESSOR IDENTITY
 *   The live `assessed_by` column references `hr1_employees.id` (FK verified
 *   live), NOT `hr_admin.id`. So the recorded assessor is the LINKED EMPLOYEE
 *   of the acting HR account (`requireHrEmployee().employeeUuid`), resolved
 *   server-side. The account-level attribution (which HR ACCOUNT acted) is
 *   carried by the audit trail, as in the other PerDev modules. The client can
 *   never supply an assessor, and employees can never create assessments.
 *
 * ASSESSMENTS ARE APPEND-ONLY
 *   `hr3_employee_competency_scores` has NO unique constraint on
 *   (employee_id, competency_id) (verified live), so each assessment is a new
 *   row that forms a history, and a re-assessment is a NEW assessment — the
 *   current state is simply the latest row. There is no UPDATE/DELETE.
 *
 * NOT IN SCOPE (later phases): performance scoring, 60/40 goals/competencies,
 * weighted final scores, rating bands, automatic level increases, automatic
 * appraisal competency results, and any link between course/training/goal/
 * recognition completion and a level change.
 */

export {
  MAX_COMPETENCY_NAME_LENGTH,
  MAX_COMPETENCY_DESCRIPTION_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

const COMPETENCY_SELECT = "id, name, description, category, created_at";
const REQUIREMENT_SELECT =
  "id, position_id, competency_id, required_level, created_at, updated_at";
const SCORE_SELECT =
  "id, employee_id, competency_id, current_level, required_level, assessed_by, assessed_at";

/**
 * Validates an OPTIONAL text value (for fields that may be omitted/cleared).
 * Absent (undefined) → returns the `ABSENT` marker so the caller can decide
 * whether to keep the existing value; null → returns null (clear); string →
 * trimmed/validated, empty string collapsed to null.
 */
function requireOptionalDescription(
  value: unknown,
  field: string,
  maxLength: number
): string | null | NextResponse {
  if (value === undefined) return ABSENT;
  if (value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return BAD_REQUEST_RESPONSE(
      `${field} must be at most ${maxLength} characters.`
    );
  }
  return trimmed || null;
}

function requireCompetencyCategory(
  value: unknown
): CompetencyCategory | NextResponse {
  if (
    typeof value !== "string" ||
    !COMPETENCY_CATEGORIES.includes(value as CompetencyCategory)
  ) {
    return BAD_REQUEST_RESPONSE(
      "category must be one of: technical, behavioral."
    );
  }
  return value as CompetencyCategory;
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

async function requireExistingCompetencyId(
  value: unknown
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "competency_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingCompetencyId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate competency" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "competency_id does not reference an existing competency."
    );
  }

  return id;
}

async function requireExistingPositionId(
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
    console.error("requireExistingPositionId: query error:", error);
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

async function loadEmployeePosition(
  employeeUuid: string
): Promise<{ id: string; job_position_id: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, job_position_id")
    .eq("id", employeeUuid)
    .maybeSingle();
  return (data as { id: string; job_position_id: string | null } | null) ?? null;
}

/* =====================================================================
 * COMPETENCY LIBRARY
 * ===================================================================== */

export type ListCompetenciesQuery = Record<string, unknown>;

/**
 * Lists the competency library. Any authenticated PerDev user may browse it.
 * `search` is a server-side case-insensitive name filter; `category` must be an
 * actual category. Ordering by name keeps the library stable and readable.
 */
export async function listCompetencies(
  input: ListCompetenciesQuery
): Promise<Competency[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  let query = supabaseAdmin.from("hr3_competencies").select(COMPETENCY_SELECT);

  if (input?.search !== undefined && input?.search !== null) {
    const search = String(input.search).trim();
    if (search) query = query.ilike("name", `%${search}%`);
  }

  if (input?.category !== undefined && input?.category !== null) {
    const category = requireCompetencyCategory(input.category);
    if (category instanceof NextResponse) return category;
    query = query.eq("category", category);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("listCompetencies: query error:", error);
    return NextResponse.json(
      { error: "Failed to load competencies" },
      { status: 500 }
    );
  }

  return (data ?? []) as Competency[];
}

/**
 * Reads one competency. Employee-or-HR authenticated users may both read the
 * library.
 */
export async function getCompetency(
  competencyId: string
): Promise<Competency | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(competencyId, "competency id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .select(COMPETENCY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getCompetency: query error:", error);
    return NextResponse.json({ error: "Failed to load competency" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Competency not found" }, { status: 404 });
  }

  return data as Competency;
}

/**
 * Creates a competency library entry. HR scope only. `name` is required,
 * `description` optional (empty string is stored as null), `category` must be a
 * real schema category. Mutation → audit (`competency.created`).
 */
export async function createCompetency(
  input: CompetencyInput
): Promise<Competency | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const name = requireNonEmptyText(input?.name, "name", MAX_COMPETENCY_NAME_LENGTH);
  if (name instanceof NextResponse) return name;

  const category = requireCompetencyCategory(input?.category);
  if (category instanceof NextResponse) return category;

  let description: string | null = null;
  const descriptionValue = requireOptionalDescription(
    input?.description,
    "description",
    MAX_COMPETENCY_DESCRIPTION_LENGTH
  );
  if (descriptionValue instanceof NextResponse) return descriptionValue;
  if (descriptionValue !== ABSENT) {
    description = descriptionValue;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .insert({
      name,
      category,
      description,
    })
    .select(COMPETENCY_SELECT)
    .single();

  if (error) {
    console.error("createCompetency: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create competency" },
      { status: 500 }
    );
  }

  const created = data as Competency;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.competencyCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.competency,
    entityId: created.id,
    oldData: null,
    newData: {
      name: created.name,
      category: created.category,
      description: created.description,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Updates editable library fields (name, category, description — all real
 * columns; `id`, `created_at` are never supplied by the client). HR scope only.
 * Mutation → audit (`competency.updated`).
 */
export async function updateCompetency(
  competencyId: string,
  input: CompetencyInput
): Promise<Competency | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(competencyId, "competency id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_competencies")
    .select(COMPETENCY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateCompetency: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load competency" },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json({ error: "Competency not found" }, { status: 404 });
  }

  const prev = existing as Competency;

  const name = requireNonEmptyText(input?.name, "name", MAX_COMPETENCY_NAME_LENGTH);
  if (name instanceof NextResponse) return name;

  const category = requireCompetencyCategory(input?.category);
  if (category instanceof NextResponse) return category;

  const descriptionValue = requireOptionalDescription(
    input?.description,
    "description",
    MAX_COMPETENCY_DESCRIPTION_LENGTH
  );
  if (descriptionValue instanceof NextResponse) return descriptionValue;
  const description =
    descriptionValue === ABSENT ? prev.description : descriptionValue;

  const updates: Record<string, unknown> = {
    name,
    category,
    description,
  };

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .update(updates)
    .eq("id", id)
    .select(COMPETENCY_SELECT)
    .single();

  if (error) {
    console.error("updateCompetency: update error:", error);
    return NextResponse.json(
      { error: "Failed to update competency" },
      { status: 500 }
    );
  }

  const updated = data as Competency;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.competencyUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.competency,
    entityId: updated.id,
    oldData: { name: prev.name, category: prev.category, description: prev.description },
    newData: {
      name: updated.name,
      category: updated.category,
      description: updated.description,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * POSITION COMPETENCY REQUIREMENTS
 * ===================================================================== */

export type ListPositionRequirementsQuery = Record<string, unknown>;

/**
 * Lists position competency requirements.
 *
 * HR scope: optional `position_id` filter (must exist). Employee scope: forced
 * to the employee's OWN position (discovered from `job_position_id`); supplying
 * any other position_id yields a generic 403, and a malformed position_id is
 * rejected outright.
 */
export async function listPositionCompetencyRequirements(
  input: ListPositionRequirementsQuery
): Promise<PositionCompetencyRequirement[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  let query = supabaseAdmin
    .from("hr3_position_competency_requirements")
    .select(REQUIREMENT_SELECT);

  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) {
    let ownPositionId: string | null = null;

    if (input?.position_id !== undefined && input?.position_id !== null) {
      const parsed = requireValidUuid(input.position_id, "position_id");
      if (parsed instanceof NextResponse) return parsed;
      ownPositionId = parsed;
    }

    const employeeRow = await loadEmployeePosition(identity.employeeUuid);
    const myPositionId = employeeRow?.job_position_id ?? null;

    if (ownPositionId && ownPositionId !== myPositionId) {
      console.error(
        "listPositionCompetencyRequirements: employee attempted a foreign position"
      );
      return FORBIDDEN_RESPONSE();
    }

    if (!myPositionId) return [];
    query = query.eq("position_id", myPositionId);
  } else if (input?.position_id !== undefined && input?.position_id !== null) {
    const positionId = await requireExistingPositionId(input.position_id);
    if (positionId instanceof NextResponse) return positionId;
    query = query.eq("position_id", positionId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listPositionCompetencyRequirements: query error:", error);
    return NextResponse.json(
      { error: "Failed to load position competency requirements" },
      { status: 500 }
    );
  }

  return (data ?? []) as PositionCompetencyRequirement[];
}

/**
 * Reads one position requirement. Employee scope may only read a requirement
 * belonging to their own position.
 */
export async function getPositionCompetencyRequirement(
  requirementId: string
): Promise<PositionCompetencyRequirement | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(requirementId, "requirement id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_position_competency_requirements")
    .select(REQUIREMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getPositionCompetencyRequirement: query error:", error);
    return NextResponse.json(
      { error: "Failed to load position competency requirement" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Position competency requirement not found" },
      { status: 404 }
    );
  }

  const requirement = data as PositionCompetencyRequirement;

  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) {
    const employeeRow = await loadEmployeePosition(identity.employeeUuid);
    if (employeeRow?.job_position_id !== requirement.position_id) {
      console.error(
        "getPositionCompetencyRequirement: employee attempted a foreign requirement"
      );
      return FORBIDDEN_RESPONSE();
    }
  }

  return requirement;
}

/**
 * Assigns a competency as required for a position (HR scope only).
 *
 * The live schema enforces uniqueness of (position_id, competency_id), so a
 * duplicate assignment is rejected with a clear 400 (backstopped by the unique
 * constraint). Required level is validated to 1..5.
 */
export async function createPositionCompetencyRequirement(
  input: PositionCompetencyRequirementInput
): Promise<PositionCompetencyRequirement | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const positionId = await requireExistingPositionId(input?.position_id);
  if (positionId instanceof NextResponse) return positionId;

  const competencyId = await requireExistingCompetencyId(input?.competency_id);
  if (competencyId instanceof NextResponse) return competencyId;

  const requiredLevel = requireLevel(input?.required_level, "required_level");
  if (requiredLevel instanceof NextResponse) return requiredLevel;

  const { data: duplicate } = await supabaseAdmin
    .from("hr3_position_competency_requirements")
    .select("id")
    .eq("position_id", positionId)
    .eq("competency_id", competencyId)
    .maybeSingle();

  if (duplicate) {
    return BAD_REQUEST_RESPONSE(
      "This competency is already required for this position."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_position_competency_requirements")
    .insert({
      position_id: positionId,
      competency_id: competencyId,
      required_level: requiredLevel,
    })
    .select(REQUIREMENT_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return BAD_REQUEST_RESPONSE(
        "This competency is already required for this position."
      );
    }
    console.error(
      "createPositionCompetencyRequirement: insert error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to create position competency requirement" },
      { status: 500 }
    );
  }

  const created = data as PositionCompetencyRequirement;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.positionCompetencyCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.positionCompetency,
    entityId: created.id,
    oldData: null,
    newData: {
      position_id: created.position_id,
      competency_id: created.competency_id,
      required_level: created.required_level,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Changes the required level of an existing position requirement (HR scope
 * only). Only `required_level` is editable here — moving the requirement to a
 * different position/competency is a remove-then-add operation not exposed by
 * this foundation.
 */
export async function updatePositionCompetencyRequirement(
  requirementId: string,
  input: UpdatePositionCompetencyRequirementInput
): Promise<PositionCompetencyRequirement | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(requirementId, "requirement id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_position_competency_requirements")
    .select(REQUIREMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error(
      "updatePositionCompetencyRequirement: load error:",
      loadError
    );
    return NextResponse.json(
      { error: "Failed to load position competency requirement" },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Position competency requirement not found" },
      { status: 404 }
    );
  }

  const prev = existing as PositionCompetencyRequirement;

  const requiredLevel = requireLevel(input?.required_level, "required_level");
  if (requiredLevel instanceof NextResponse) return requiredLevel;

  const { data, error } = await supabaseAdmin
    .from("hr3_position_competency_requirements")
    .update({
      required_level: requiredLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(REQUIREMENT_SELECT)
    .single();

  if (error) {
    console.error(
      "updatePositionCompetencyRequirement: update error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to update position competency requirement" },
      { status: 500 }
    );
  }

  const updated = data as PositionCompetencyRequirement;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.positionCompetencyUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.positionCompetency,
    entityId: updated.id,
    oldData: { required_level: prev.required_level },
    newData: { required_level: updated.required_level },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * EMPLOYEE COMPETENCY PROFILE + ASSESSMENTS
 * ===================================================================== */

export type ListEmployeeCompetenciesQuery = Record<string, unknown>;

type EmployeeRow = { id: string; job_position_id: string | null };
type ScoreRow = {
  id: string;
  employee_id: string;
  competency_id: string;
  current_level: number;
  required_level: number | null;
  assessed_by: string;
  assessed_at: string;
};

/**
 * Loads the employee competency PROFILE: the latest assessment row per
 * (employee, competency), with the server-computed gap (see header).
 *
 * HR scope: optional `employee_id` (must exist) and optional `competency_id`
 * (must exist) filters; without an employee filter, ALL employees are included.
 * Employee scope: only the requesting employee, and supplying a different
 * employee_id is a generic 403.
 */
export async function listEmployeeCompetencies(
  input: ListEmployeeCompetenciesQuery
): Promise<EmployeeCompetencyProfileItem[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  let employeeId: string | null = null;
  if (input?.employee_id !== undefined && input?.employee_id !== null) {
    const parsed = requireValidUuid(input.employee_id, "employee_id");
    if (parsed instanceof NextResponse) return parsed;
    employeeId = parsed;
  }

  if (admin instanceof NextResponse) {
    if (employeeId && employeeId !== identity.employeeUuid) {
      console.error(
        "listEmployeeCompetencies: employee attempted another employee's profile"
      );
      return FORBIDDEN_RESPONSE();
    }
    employeeId = identity.employeeUuid;
  } else if (employeeId) {
    const verified = await requireExistingEmployeeId(employeeId);
    if (verified instanceof NextResponse) return verified;
  }

  let competencyFilter: string | null = null;
  if (input?.competency_id !== undefined && input?.competency_id !== null) {
    const verified = await requireExistingCompetencyId(input.competency_id);
    if (verified instanceof NextResponse) return verified;
    competencyFilter = verified;
  }

  /* Load the subject employee(s) with their positions. */
  let employees: EmployeeRow[] = [];
  if (employeeId) {
    const row = await loadEmployeePosition(employeeId);
    if (row) employees = [row];
  } else {
    const { data, error } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, job_position_id")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (error) {
      console.error("listEmployeeCompetencies: employee query error:", error);
      return NextResponse.json(
        { error: "Failed to load employees" },
        { status: 500 }
      );
    }
    employees = (data ?? []) as EmployeeRow[];
  }

  if (employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);

  /* Load all score rows for those employees, ordered so "latest" is deterministic. */
  let scoreQuery = supabaseAdmin
    .from("hr3_employee_competency_scores")
    .select(SCORE_SELECT)
    .in("employee_id", employeeIds);

  if (competencyFilter) {
    scoreQuery = scoreQuery.eq("competency_id", competencyFilter);
  }

  const { data: scoreData, error: scoreError } = await scoreQuery
    .order("assessed_at", { ascending: true })
    .order("id", { ascending: true });

  if (scoreError) {
    console.error("listEmployeeCompetencies: score query error:", scoreError);
    return NextResponse.json(
      { error: "Failed to load employee competency scores" },
      { status: 500 }
    );
  }

  /* Latest per (employee_id, competency_id): last row wins in the ordered list. */
  const latestByKey = new Map<string, ScoreRow>();
  for (const row of (scoreData ?? []) as ScoreRow[]) {
    latestByKey.set(`${row.employee_id}:${row.competency_id}`, row);
  }

  /* Position requirement standards for the relevant positions. */
  const positionIds = [
    ...new Set(
      employees.map((e) => e.job_position_id).filter((p): p is string => !!p)
    ),
  ];
  const requirementByPosition = new Map<string, Map<string, number>>();
  if (positionIds.length > 0) {
    const { data: reqData } = await supabaseAdmin
      .from("hr3_position_competency_requirements")
      .select("position_id, competency_id, required_level")
      .in("position_id", positionIds);
    for (const req of (reqData ?? []) as {
      position_id: string;
      competency_id: string;
      required_level: number;
    }[]) {
      let inner = requirementByPosition.get(req.position_id);
      if (!inner) {
        inner = new Map<string, number>();
        requirementByPosition.set(req.position_id, inner);
      }
      inner.set(req.competency_id, req.required_level);
    }
  }

  /* Index scores by employee_id for O(1) lookup per employee. */
  const scoresByEmployee = new Map<string, ScoreRow[]>();
  for (const row of latestByKey.values()) {
    const list = scoresByEmployee.get(row.employee_id);
    if (list) {
      list.push(row);
    } else {
      scoresByEmployee.set(row.employee_id, [row]);
    }
  }

  const items: EmployeeCompetencyProfileItem[] = [];

  for (const employee of employees) {
    const positionRequirements =
      (employee.job_position_id &&
        requirementByPosition.get(employee.job_position_id)) ||
      new Map<string, number>();

    const employeeScores = scoresByEmployee.get(employee.id) ?? [];

    for (const score of employeeScores) {
      const positionRequired = positionRequirements.get(score.competency_id) ?? null;
      const effectiveRequired = score.required_level ?? positionRequired;
      items.push({
        employee_id: employee.id,
        competency_id: score.competency_id,
        current_level: score.current_level,
        required_level: score.required_level,
        position_required_level: positionRequired,
        effective_required_level: effectiveRequired,
        gap:
          effectiveRequired === null
            ? null
            : effectiveRequired - score.current_level,
        assessed_by: score.assessed_by,
        assessed_at: score.assessed_at,
      });
    }
  }

  items.sort(
    (a, b) =>
      a.employee_id.localeCompare(b.employee_id) ||
      a.competency_id.localeCompare(b.competency_id)
  );

  return items;
}

/**
 * Records an employee competency ASSESSMENT (HR scope only).
 *
 * `assessed_by` is ALWAYS the acting HR account's linked employee
 * (`requireHrEmployee().employeeUuid`), never a client value. Assessments are
 * append-only (a new row per assessment), so re-assessment creates a new row
 * rather than mutating history. Mutation → audit
 * (`employee_competency.assessed`).
 */
export async function createEmployeeCompetencyAssessment(
  input: EmployeeCompetencyAssessmentInput
): Promise<EmployeeCompetencyScore | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const competencyId = await requireExistingCompetencyId(input?.competency_id);
  if (competencyId instanceof NextResponse) return competencyId;

  const currentLevel = requireLevel(input?.current_level, "current_level");
  if (currentLevel instanceof NextResponse) return currentLevel;

  const requiredLevel = requireLevel(
    input?.required_level,
    "required_level",
    { allowNull: true }
  );
  if (requiredLevel instanceof NextResponse) return requiredLevel;

  const { data, error } = await supabaseAdmin
    .from("hr3_employee_competency_scores")
    .insert({
      employee_id: employeeId,
      competency_id: competencyId,
      current_level: currentLevel,
      required_level: requiredLevel === null ? null : requiredLevel,
      assessed_by: identity.employeeUuid,
    })
    .select(SCORE_SELECT)
    .single();

  if (error) {
    console.error(
      "createEmployeeCompetencyAssessment: insert error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to record competency assessment" },
      { status: 500 }
    );
  }

  const created = data as EmployeeCompetencyScore;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.employeeCompetencyAssessed,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.employeeCompetency,
    entityId: created.id,
    oldData: null,
    newData: {
      employee_id: created.employee_id,
      competency_id: created.competency_id,
      current_level: created.current_level,
      required_level: created.required_level,
      assessed_by: created.assessed_by,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}