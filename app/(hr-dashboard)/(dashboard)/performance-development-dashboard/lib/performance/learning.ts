import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import { requireHrEmployee } from "@/performance-development-dashboard/lib/auth/hrIdentity";
import {
  auditActorFromIdentity,
  insertAuditEvent,
  PERFORMANCE_AUDIT_ENTITY_TYPE,
  PERFORMANCE_AUDIT_REASON,
} from "@/performance-development-dashboard/lib/performance/audit";
import {
  MAX_CERT_URL_LENGTH,
  MAX_COURSE_DESCRIPTION_LENGTH,
  MAX_COURSE_TITLE_LENGTH,
  MAX_COURSE_URL_LENGTH,
  MAX_EVALUATION_COMMENT_LENGTH,
  MAX_SESSION_TITLE_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import {
  ABSENT,
  BAD_REQUEST_RESPONSE,
  CONFLICT_RESPONSE,
  FORBIDDEN_RESPONSE,
  requireNonEmptyText,
  requireOptionalText,
  requireValidUuid,
} from "@/performance-development-dashboard/lib/performance/validation";
import {
  COURSE_ENROLLMENT_STATUSES,
  COURSE_PROGRESS_MAX,
  COURSE_PROGRESS_MIN,
  TRAINING_APPROVAL_STATUSES,
  TRAINING_ATTENDANCE_STATUSES,
  TRAINING_EVALUATION_RATING_MAX,
  TRAINING_EVALUATION_RATING_MIN,
  type Certification,
  type CertificationInput,
  type Course,
  type CourseEnrollment,
  type CourseEnrollmentInput,
  type CourseInput,
  type TrainingEnrollment,
  type TrainingEnrollmentInput,
  type TrainingEvaluation,
  type TrainingEvaluationInput,
  type TrainingSession,
  type TrainingSessionInput,
  type UpdateCourseEnrollmentInput,
  type UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";

export type {
  Certification,
  CertificationInput,
  Course,
  CourseEnrollment,
  CourseEnrollmentInput,
  CourseInput,
  TrainingEnrollment,
  TrainingEnrollmentInput,
  TrainingEvaluation,
  TrainingEvaluationInput,
  TrainingSession,
  TrainingSessionInput,
  UpdateCourseEnrollmentInput,
  UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";

/**
 * Learning & Development domain (foundation).
 *
 * Four FINAL concepts, each mapped to its own live table (verified 0-row and
 * structurally probed before any code was written):
 *
 *   COURSE            → `hr3_courses`                  (catalog / content)
 *   COURSE ENROLLMENT → `hr3_course_enrollments`       (progress/status/completion)
 *   TRAINING SESSION  → `hr3_training_sessions`        (scheduled classroom/training)
 *   TRAINING ENROLLMENT → `hr3_training_enrollments`   (approval/attendance)
 *   TRAINING EVALUATION → `hr3_training_evaluations`   (1–5 rating, optional)
 *   CERTIFICATION     → `hr3_certifications`           (issued certificates)
 *
 * They are NEVER collapsed into one entity. A course is content; a training
 * session is a scheduled event; an enrollment links an employee to either; an
 * evaluation is an employee's feedback on a session; a certification is a
 * standalone issued record.
 *
 * COMPETENCY CONNECTION — DISPLAY ONLY
 *   `hr3_courses.competency_id` and `hr3_training_sessions.competency_id`
 *   reference the competency library, so a course/session may be linked to the
 *   competency it trains. THE LINK IS STRICTLY DISPLAY-ONLY. Verifying live:
 *   marking a course enrollment complete does NOT add/mutate any row in
 *   `hr3_employee_competency_scores` (no trigger exists), and this module never
 *   touches that table. Level changes happen ONLY through an explicit HR
 *   assessment in the Competency module. No automatic increases, ever.
 *
 * STATUS VOCABULARY — WRITE-MANAGED vs SCHEMA (REPORTED LIMITATION)
 *   Verified live, `hr3_course_enrollments.status`, `hr3_training_sessions.
 *   status`/`session_type`, and `hr3_training_enrollments.approval_status`/
 *   `attendance_status` are all FREE-TEXT columns with NO check constraint,
 *   and there is NO unique constraint on any enrollment pair (`(employee_id,
 *   course_id)` and `(employee_id, session_id)`). So:
 *     - On WRITE this module only accepts a small managed vocabulary (listed in
 *       `types/`), and rejects duplicate enrollments at the application layer
 *       (the schema alone permits them).
 *     - The DB itself does NOT enforce transitions (`enrolled → in_progress →
 *       completed`, `pending → approved`), so this module does not pretend to
 *       hold a DB-level state machine. Legacy/unknown values are DISPLAYED as
 *      -is with a neutral fallback; only writes are controlled.
 *     - What the schema DOES enforce is kept in place: progress_percent is
 *       numeric 0..100 (verified), evaluation rating is an integer 1..5
 *       (verified: 0/6/3.5 rejected), and the FK targets are real
 *       (course.created_by → hr_admin.id, training_enrollments.approved_by →
 *       hr1_employees.id).
 *
 * WHO MAY DO WHAT
 *   - HR scope (account role super_admin / hr_performance_admin): create/
 *     update courses and sessions, enroll employees (course + session), update
 *     course-enrollment progress/status, approve/reject session enrollments and
 *     record attendance, record session evaluations on any employee's behalf,
 *     and issue certifications. No DELETE anywhere (this foundation exposes
 *     only create/update/read — the schema supports deletion but the module
 *     deliberately does not).
 *   - EMPLOYEE scope: read the course catalog and the training schedule, and
 *     read THEIR OWN enrollments, evaluations and certifications. An employee
 *     may submit an evaluation for a session THEY were enrolled in, recorded
 *     against their own `employee_id` (server-derived; a foreign employee_id or
 *     a non-attended session is rejected). Supplying any other employee's id on
 *     a read is a generic 403 (never a leak).
 *
 * IDENTITY RULES
 *   - `hr3_courses.created_by` references `hr_admin.id`, so it is always set
 *     server-side to the acting admin account id (never a client value).
 *   - `hr3_training_enrollments.approved_by` references `hr1_employees.id`
 *     (verified live: an hr_admin id is rejected), so it is always the acting
 *     HR account's LINKED EMPLOYEE uuid written server-side when approval is
 *     granted/rejected. The account attribution lives in the audit trail.
 *   - Employees can never self-enroll, self-certify, or write courses/sessions.
 *
 * NOT IN SCOPE (later phases): reporting/analytics, mandatory-course rules,
 * certification validity status (the table has no status field and no
 * date-based validity semantics — dates are shown as facts only), scoring,
 * and any automatic competency/appraisal effect of completing learning.
 */

export {
  MAX_COURSE_TITLE_LENGTH,
  MAX_COURSE_DESCRIPTION_LENGTH,
  MAX_COURSE_URL_LENGTH,
  MAX_SESSION_TITLE_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  MAX_EVALUATION_COMMENT_LENGTH,
  MAX_CERT_URL_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

const COURSE_SELECT =
  "id, title, description, primary_content_url, duration_minutes, competency_id, created_by, created_at";
const ENROLLMENT_SELECT =
  "id, employee_id, course_id, progress_percent, status, enrolled_at, completed_at";
const SESSION_SELECT =
  "id, title, trainer_name, trainer_type, mode, venue, schedule_date, capacity, cost, status, created_at, session_type, competency_id";
const TRAINING_ENROLLMENT_SELECT =
  "id, employee_id, session_id, approval_status, attendance_status, approved_by";
const EVALUATION_SELECT =
  "id, session_id, employee_id, rating, comments, submitted_at";
const CERTIFICATION_SELECT =
  "id, employee_id, course_id, certificate_url, issued_at, expires_at";

function requireOptionalInteger(
  value: unknown,
  field: string,
  opts: { allowNull?: boolean; min?: number; required?: boolean } = {}
): number | null | typeof ABSENT | NextResponse {
  const { allowNull = true, min, required = false } = opts;
  if (value === undefined) return required ? BAD_REQUEST_RESPONSE(`${field} is required.`) : ABSENT;
  if (value === null) {
    if (allowNull) return null;
    return BAD_REQUEST_RESPONSE(`${field} must be a number.`);
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return BAD_REQUEST_RESPONSE(`${field} must be an integer.`);
  }
  if (min !== undefined && value < min) {
    return BAD_REQUEST_RESPONSE(`${field} must be at least ${min}.`);
  }
  return value;
}

function requireOptionalNumber(
  value: unknown,
  field: string,
  opts: { allowNull?: boolean; min?: number } = {}
): number | null | typeof ABSENT | NextResponse {
  const { allowNull = true, min } = opts;
  if (value === undefined) return ABSENT;
  if (value === null) {
    if (allowNull) return null;
    return BAD_REQUEST_RESPONSE(`${field} must be a number.`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return BAD_REQUEST_RESPONSE(`${field} must be a number.`);
  }
  if (min !== undefined && value < min) {
    return BAD_REQUEST_RESPONSE(`${field} must be at least ${min}.`);
  }
  return value;
}

function requireOptionalIsoDate(
  value: unknown,
  field: string
): string | null | typeof ABSENT | NextResponse {
  if (value === undefined) return ABSENT;
  if (value === null) return null;
  if (typeof value !== "string") {
    return BAD_REQUEST_RESPONSE(`${field} must be an ISO date string.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return BAD_REQUEST_RESPONSE(`${field} must be a valid ISO date string.`);
  }
  return parsed.toISOString();
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

async function requireExistingCourseId(
  value: unknown,
  opts: { allowNull?: boolean } = {}
): Promise<string | null | NextResponse> {
  const { allowNull = true } = opts;
  if (value === undefined) return allowNull ? null : BAD_REQUEST_RESPONSE("course_id is required.");
  if (value === null) return allowNull ? null : BAD_REQUEST_RESPONSE("course_id must not be null.");

  const id = requireValidUuid(value, "course_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingCourseId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate course" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE("course_id does not reference an existing course.");
  }

  return id;
}

async function requireExistingSessionId(
  value: unknown
): Promise<string | NextResponse> {
  const id = requireValidUuid(value, "session_id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingSessionId: query error:", error);
    return NextResponse.json(
      { error: "Failed to validate training session" },
      { status: 500 }
    );
  }

  if (!data) {
    return BAD_REQUEST_RESPONSE(
      "session_id does not reference an existing training session."
    );
  }

  return id;
}

async function requireExistingCompetencyIdOrNull(
  value: unknown
): Promise<string | null | typeof ABSENT | NextResponse> {
  const id = requireOptionalText(value, "competency_id", 36);
  if (id === ABSENT || id === null || id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_competencies")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("requireExistingCompetencyIdOrNull: query error:", error);
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

/* =====================================================================
 * COURSES
 * ===================================================================== */

export type ListCoursesQuery = Record<string, unknown>;

/**
 * Lists the course catalog. Any authenticated PerDev user may browse it.
 * `search` is a case-insensitive title filter; `competency_id` filters to books
 * linked to one competency. Ordered by title for a stable catalog.
 */
export async function listCourses(
  input: ListCoursesQuery
): Promise<Course[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  let query = supabaseAdmin.from("hr3_courses").select(COURSE_SELECT);

  if (input?.search !== undefined && input?.search !== null) {
    const search = String(input.search).trim();
    if (search) query = query.ilike("title", `%${search}%`);
  }

  if (input?.competency_id !== undefined && input?.competency_id !== null) {
    const competencyId = await requireExistingCompetencyIdOrNull(
      input.competency_id
    );
    if (competencyId === ABSENT || competencyId instanceof NextResponse) {
      if (competencyId instanceof NextResponse) return competencyId;
    } else {
      query = query.eq("competency_id", competencyId);
    }
  }

  const { data, error } = await query.order("title", { ascending: true });

  if (error) {
    console.error("listCourses: query error:", error);
    return NextResponse.json(
      { error: "Failed to load courses" },
      { status: 500 }
    );
  }

  return (data ?? []) as Course[];
}

/**
 * Reads one course. Any authenticated PerDev user may read the catalog.
 */
export async function getCourse(
  courseId: string
): Promise<Course | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(courseId, "course id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .select(COURSE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getCourse: query error:", error);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return data as Course;
}

/**
 * Creates a course. HR scope only. `title` required; `description`,
 * `primary_content_url`, `duration_minutes` (≥ 0; the schema has no check, so
 * the module enforces it) and `competency_id` (display link) optional.
 * `created_by` is ALWAYS the acting hr_admin account id. Mutation → audit
 * (`course.created`).
 */
export async function createCourse(
  input: CourseInput
): Promise<Course | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const title = requireNonEmptyText(input?.title, "title", MAX_COURSE_TITLE_LENGTH);
  if (title instanceof NextResponse) return title;

  const description = requireOptionalText(
    input?.description,
    "description",
    MAX_COURSE_DESCRIPTION_LENGTH
  );
  if (description instanceof NextResponse) return description;

  const url = requireOptionalText(
    input?.primary_content_url,
    "primary_content_url",
    MAX_COURSE_URL_LENGTH
  );
  if (url instanceof NextResponse) return url;

  const duration = requireOptionalInteger(input?.duration_minutes, "duration_minutes", {
    min: 0,
  });
  if (duration instanceof NextResponse) return duration;

  const competencyId = await requireExistingCompetencyIdOrNull(
    input?.competency_id
  );
  if (competencyId === ABSENT || competencyId instanceof NextResponse) {
    if (competencyId instanceof NextResponse) return competencyId;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .insert({
      title,
      description: description === ABSENT ? null : description,
      primary_content_url: url === ABSENT ? null : url,
      duration_minutes: duration === ABSENT ? null : duration,
      competency_id: competencyId === ABSENT ? null : competencyId,
      created_by: admin.hrAdminId,
    })
    .select(COURSE_SELECT)
    .single();

  if (error) {
    console.error("createCourse: insert error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }

  const created = data as Course;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.courseCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.course,
    entityId: created.id,
    oldData: null,
    newData: {
      title: created.title,
      description: created.description,
      primary_content_url: created.primary_content_url,
      duration_minutes: created.duration_minutes,
      competency_id: created.competency_id,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Updates editable course fields (title, description, primary_content_url,
 * duration_minutes, competency_id — all real columns; `created_by`/`created_at`
 * are never client-supplied, and `id` is immutable). HR scope only.
 * Mutation → audit (`course.updated`).
 */
export async function updateCourse(
  courseId: string,
  input: CourseInput
): Promise<Course | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(courseId, "course id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_courses")
    .select(COURSE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateCourse: load error:", loadError);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const prev = existing as Course;

  const title = requireNonEmptyText(input?.title, "title", MAX_COURSE_TITLE_LENGTH);
  if (title instanceof NextResponse) return title;

  const description = requireOptionalText(
    input?.description,
    "description",
    MAX_COURSE_DESCRIPTION_LENGTH
  );
  if (description instanceof NextResponse) return description;

  const url = requireOptionalText(
    input?.primary_content_url,
    "primary_content_url",
    MAX_COURSE_URL_LENGTH
  );
  if (url instanceof NextResponse) return url;

  const duration = requireOptionalInteger(input?.duration_minutes, "duration_minutes", {
    min: 0,
  });
  if (duration instanceof NextResponse) return duration;

  const competencyId = await requireExistingCompetencyIdOrNull(
    input?.competency_id
  );
  if (competencyId instanceof NextResponse) return competencyId;

  const updates: Record<string, unknown> = {
    title,
    description: description === ABSENT ? prev.description : description,
    primary_content_url: url === ABSENT ? prev.primary_content_url : url,
    duration_minutes:
      duration === ABSENT ? prev.duration_minutes : duration,
    competency_id:
      competencyId === ABSENT ? prev.competency_id : competencyId,
  };

  const { data, error } = await supabaseAdmin
    .from("hr3_courses")
    .update(updates)
    .eq("id", id)
    .select(COURSE_SELECT)
    .single();

  if (error) {
    console.error("updateCourse: update error:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }

  const updated = data as Course;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.courseUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.course,
    entityId: updated.id,
    oldData: {
      title: prev.title,
      description: prev.description,
      primary_content_url: prev.primary_content_url,
      duration_minutes: prev.duration_minutes,
      competency_id: prev.competency_id,
    },
    newData: {
      title: updated.title,
      description: updated.description,
      primary_content_url: updated.primary_content_url,
      duration_minutes: updated.duration_minutes,
      competency_id: updated.competency_id,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * COURSE ENROLLMENTS
 * ===================================================================== */

export type ListCourseEnrollmentsQuery = Record<string, unknown>;

/**
 * Lists course enrollments.
 *
 * HR scope: all (optional `employee_id` filter, must exist) and optional
 * `course_id` filter (must exist). Employee scope: forced to the employee's
 * own enrollments — supplying any other employee_id is a generic 403.
 */
export async function listCourseEnrollments(
  input: ListCourseEnrollmentsQuery
): Promise<CourseEnrollment[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  let query = supabaseAdmin
    .from("hr3_course_enrollments")
    .select(ENROLLMENT_SELECT);

  if (admin instanceof NextResponse) {
    query = query.eq("employee_id", identity.employeeUuid);
  } else {
    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = await requireExistingEmployeeId(input.employee_id);
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }
  }

  if (input?.course_id !== undefined && input?.course_id !== null) {
    const courseId = await requireExistingCourseId(input.course_id, {
      allowNull: false,
    });
    if (courseId instanceof NextResponse) return courseId;
    query = query.eq("course_id", courseId as string);
  }

  const { data, error } = await query
    .order("enrolled_at", { ascending: true })
    .order("employee_id", { ascending: true });

  if (error) {
    console.error("listCourseEnrollments: query error:", error);
    return NextResponse.json(
      { error: "Failed to load course enrollments" },
      { status: 500 }
    );
  }

  return (data ?? []) as CourseEnrollment[];
}

/**
 * Reads one course enrollment. Employee scope may only read their own.
 */
export async function getCourseEnrollment(
  enrollmentId: string
): Promise<CourseEnrollment | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(enrollmentId, "enrollment id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .select(ENROLLMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getCourseEnrollment: query error:", error);
    return NextResponse.json(
      { error: "Failed to load course enrollment" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Course enrollment not found" },
      { status: 404 }
    );
  }

  const enrollment = data as CourseEnrollment;

  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) {
    if (enrollment.employee_id !== identity.employeeUuid) {
      console.error(
        "getCourseEnrollment: employee attempted a foreign enrollment"
      );
      return FORBIDDEN_RESPONSE();
    }
  }

  return enrollment;
}

/**
 * Enrolls an employee in a course (HR scope only). `employee_id` and
 * `course_id` must reference real rows. The schema has NO unique constraint on
 * (employee_id, course_id) (verified), so the module enforces de-duplication at
 * the application layer with a 409 — the same intent the constraint would back
 * if it existed.
 */
export async function createCourseEnrollment(
  input: CourseEnrollmentInput
): Promise<CourseEnrollment | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const courseId = await requireExistingCourseId(input?.course_id, {
    allowNull: false,
  });
  if (courseId instanceof NextResponse) return courseId;

  const { data: duplicate } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .select("id")
    .eq("employee_id", employeeId as string)
    .eq("course_id", courseId as string)
    .maybeSingle();

  if (duplicate) {
    return CONFLICT_RESPONSE(
      "This employee is already enrolled in this course."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .insert({
      employee_id: employeeId as string,
      course_id: courseId as string,
    })
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) {
    console.error("createCourseEnrollment: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create course enrollment" },
      { status: 500 }
    );
  }

  const created = data as CourseEnrollment;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.courseEnrollmentCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.courseEnrollment,
    entityId: created.id,
    oldData: null,
    newData: {
      employee_id: created.employee_id,
      course_id: created.course_id,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Updates an existing course enrollment (HR scope only). Only
 * `status` (managed write vocabulary; see types) and `progress_percent`
 * (numeric 0..100, the exact range the schema check enforces) are editable.
 * `employee_id`/`course_id` are never mutable through this endpoint.
 *
 * Completion is CONTROLLED at the application layer (the DB has no such
 * enforcement — reported limitation): moving to `completed` sets
 * `completed_at = now()` and forces `progress_percent = 100`; any other status
 * clears `completed_at`. This module never writes competency scores when a
 * course is completed.
 */
export async function updateCourseEnrollment(
  enrollmentId: string,
  input: UpdateCourseEnrollmentInput
): Promise<CourseEnrollment | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(enrollmentId, "enrollment id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .select(ENROLLMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateCourseEnrollment: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load course enrollment" },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Course enrollment not found" },
      { status: 404 }
    );
  }

  const prev = existing as CourseEnrollment;

  let status: string | null = null;
  if (input?.status !== undefined) {
    if (
      typeof input.status !== "string" ||
      !COURSE_ENROLLMENT_STATUSES.includes(
        input.status as (typeof COURSE_ENROLLMENT_STATUSES)[number]
      )
    ) {
      return BAD_REQUEST_RESPONSE(
        `status must be one of: ${COURSE_ENROLLMENT_STATUSES.join(", ")}.`
      );
    }
    status = input.status;
  }

  let progress: number | null = null;
  if (input?.progress_percent !== undefined) {
    if (
      typeof input.progress_percent !== "number" ||
      !Number.isFinite(input.progress_percent) ||
      input.progress_percent < COURSE_PROGRESS_MIN ||
      input.progress_percent > COURSE_PROGRESS_MAX
    ) {
      return BAD_REQUEST_RESPONSE(
        `progress_percent must be a number between ${COURSE_PROGRESS_MIN} and ${COURSE_PROGRESS_MAX}.`
      );
    }
    progress = input.progress_percent;
  }

  if (status === null && progress === null) {
    return BAD_REQUEST_RESPONSE(
      "At least one of status or progress_percent must be provided."
    );
  }

  const nextStatus = status ?? prev.status;
  const finalProgress =
    progress !== null
      ? progress
      : nextStatus === "completed"
        ? COURSE_PROGRESS_MAX
        : prev.progress_percent;
  const completedAt =
    nextStatus === "completed" ? new Date().toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from("hr3_course_enrollments")
    .update({
      status: nextStatus,
      progress_percent: finalProgress,
      completed_at: completedAt,
    })
    .eq("id", id)
    .select(ENROLLMENT_SELECT)
    .single();

  if (error) {
    console.error("updateCourseEnrollment: update error:", error);
    return NextResponse.json(
      { error: "Failed to update course enrollment" },
      { status: 500 }
    );
  }

  const updated = data as CourseEnrollment;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.courseEnrollmentUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.courseEnrollment,
    entityId: updated.id,
    oldData: {
      status: prev.status,
      progress_percent: prev.progress_percent,
      completed_at: prev.completed_at,
    },
    newData: {
      status: updated.status,
      progress_percent: updated.progress_percent,
      completed_at: updated.completed_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * TRAINING SESSIONS
 * ===================================================================== */

export type ListTrainingSessionsQuery = Record<string, unknown>;

/**
 * Lists training sessions. Any authenticated PerDev user may view the training
 * schedule. `search` filters the title case-insensitively.
 */
export async function listTrainingSessions(
  input: ListTrainingSessionsQuery
): Promise<TrainingSession[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  let query = supabaseAdmin
    .from("hr3_training_sessions")
    .select(SESSION_SELECT);

  if (input?.search !== undefined && input?.search !== null) {
    const search = String(input.search).trim();
    if (search) query = query.ilike("title", `%${search}%`);
  }

  const { data, error } = await query
    .order("schedule_date", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("listTrainingSessions: query error:", error);
    return NextResponse.json(
      { error: "Failed to load training sessions" },
      { status: 500 }
    );
  }

  return (data ?? []) as TrainingSession[];
}

/**
 * Reads one training session. Any authenticated PerDev user may view it.
 */
export async function getTrainingSession(
  sessionId: string
): Promise<TrainingSession | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(sessionId, "session id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getTrainingSession: query error:", error);
    return NextResponse.json(
      { error: "Failed to load training session" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Training session not found" },
      { status: 404 }
    );
  }

  return data as TrainingSession;
}

/**
 * Creates a training session. HR scope only. `title` required. `status` and
 * `session_type` are free-text columns with no check constraint (verified); the
 * module keeps them readable by accepting any non-empty value ≤ 60 characters
 * and defaulting to `scheduled` / `development` when omitted — it does not
 * invent a transition model the DB cannot hold. `schedule_date`, `capacity`
 * (≥ 0), `cost` (≥ 0, numeric) and the display-only `competency_id` are
 * optional. Mutation → audit (`training_session.created`).
 */
export async function createTrainingSession(
  input: TrainingSessionInput
): Promise<TrainingSession | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const title = requireNonEmptyText(input?.title, "title", MAX_SESSION_TITLE_LENGTH);
  if (title instanceof NextResponse) return title;

  const trainerName = requireOptionalText(
    input?.trainer_name,
    "trainer_name",
    MAX_COURSE_TITLE_LENGTH
  );
  if (trainerName instanceof NextResponse) return trainerName;

  const trainerType = requireOptionalText(
    input?.trainer_type,
    "trainer_type",
    MAX_SHORT_TEXT_LENGTH
  );
  if (trainerType instanceof NextResponse) return trainerType;

  const mode = requireOptionalText(input?.mode, "mode", MAX_SHORT_TEXT_LENGTH);
  if (mode instanceof NextResponse) return mode;

  const venue = requireOptionalText(input?.venue, "venue", MAX_COURSE_TITLE_LENGTH);
  if (venue instanceof NextResponse) return venue;

  const scheduleDate = requireOptionalIsoDate(
    input?.schedule_date,
    "schedule_date"
  );
  if (scheduleDate instanceof NextResponse) return scheduleDate;

  const capacity = requireOptionalInteger(input?.capacity, "capacity", {
    min: 0,
  });
  if (capacity instanceof NextResponse) return capacity;

  const cost = requireOptionalNumber(input?.cost, "cost", { min: 0 });
  if (cost instanceof NextResponse) return cost;

  const status = requireOptionalText(input?.status, "status", MAX_SHORT_TEXT_LENGTH);
  if (status instanceof NextResponse) return status;

  const sessionType = requireOptionalText(
    input?.session_type,
    "session_type",
    MAX_SHORT_TEXT_LENGTH
  );
  if (sessionType instanceof NextResponse) return sessionType;

  const competencyId = await requireExistingCompetencyIdOrNull(
    input?.competency_id
  );
  if (competencyId === ABSENT || competencyId instanceof NextResponse) {
    if (competencyId instanceof NextResponse) return competencyId;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .insert({
      title,
      trainer_name: trainerName === ABSENT ? null : trainerName,
      trainer_type: trainerType === ABSENT ? null : trainerType,
      mode: mode === ABSENT ? null : mode,
      venue: venue === ABSENT ? null : venue,
      schedule_date: scheduleDate === ABSENT ? null : scheduleDate,
      capacity: capacity === ABSENT ? null : capacity,
      cost: cost === ABSENT ? null : cost,
      status: status === ABSENT ? "scheduled" : status,
      session_type: sessionType === ABSENT ? "development" : sessionType,
      competency_id: competencyId === ABSENT ? null : competencyId,
    })
    .select(SESSION_SELECT)
    .single();

  if (error) {
    console.error("createTrainingSession: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create training session" },
      { status: 500 }
    );
  }

  const created = data as TrainingSession;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.trainingSessionCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.trainingSession,
    entityId: created.id,
    oldData: null,
    newData: {
      title: created.title,
      trainer_name: created.trainer_name,
      trainer_type: created.trainer_type,
      mode: created.mode,
      venue: created.venue,
      schedule_date: created.schedule_date,
      capacity: created.capacity,
      cost: created.cost,
      status: created.status,
      session_type: created.session_type,
      competency_id: created.competency_id,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Updates editable session fields. HR scope only. Only real columns are
 * editable; `id`/`created_at` are never client-supplied. Mutation → audit
 * (`training_session.updated`).
 */
export async function updateTrainingSession(
  sessionId: string,
  input: TrainingSessionInput
): Promise<TrainingSession | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const id = requireValidUuid(sessionId, "session id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_training_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateTrainingSession: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load training session" },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Training session not found" },
      { status: 404 }
    );
  }

  const prev = existing as TrainingSession;

  const title = requireNonEmptyText(input?.title, "title", MAX_SESSION_TITLE_LENGTH);
  if (title instanceof NextResponse) return title;

  const trainerName = requireOptionalText(
    input?.trainer_name,
    "trainer_name",
    MAX_COURSE_TITLE_LENGTH
  );
  if (trainerName instanceof NextResponse) return trainerName;

  const trainerType = requireOptionalText(
    input?.trainer_type,
    "trainer_type",
    MAX_SHORT_TEXT_LENGTH
  );
  if (trainerType instanceof NextResponse) return trainerType;

  const mode = requireOptionalText(input?.mode, "mode", MAX_SHORT_TEXT_LENGTH);
  if (mode instanceof NextResponse) return mode;

  const venue = requireOptionalText(input?.venue, "venue", MAX_COURSE_TITLE_LENGTH);
  if (venue instanceof NextResponse) return venue;

  const scheduleDate = requireOptionalIsoDate(
    input?.schedule_date,
    "schedule_date"
  );
  if (scheduleDate instanceof NextResponse) return scheduleDate;

  const capacity = requireOptionalInteger(input?.capacity, "capacity", {
    min: 0,
  });
  if (capacity instanceof NextResponse) return capacity;

  const cost = requireOptionalNumber(input?.cost, "cost", { min: 0 });
  if (cost instanceof NextResponse) return cost;

  const status = requireOptionalText(input?.status, "status", MAX_SHORT_TEXT_LENGTH);
  if (status instanceof NextResponse) return status;

  const sessionType = requireOptionalText(
    input?.session_type,
    "session_type",
    MAX_SHORT_TEXT_LENGTH
  );
  if (sessionType instanceof NextResponse) return sessionType;

  const competencyId = await requireExistingCompetencyIdOrNull(
    input?.competency_id
  );
  if (competencyId instanceof NextResponse) return competencyId;

  const updates: Record<string, unknown> = {
    title,
    trainer_name: trainerName === ABSENT ? prev.trainer_name : trainerName,
    trainer_type: trainerType === ABSENT ? prev.trainer_type : trainerType,
    mode: mode === ABSENT ? prev.mode : mode,
    venue: venue === ABSENT ? prev.venue : venue,
    schedule_date:
      scheduleDate === ABSENT ? prev.schedule_date : scheduleDate,
    capacity: capacity === ABSENT ? prev.capacity : capacity,
    cost: cost === ABSENT ? prev.cost : cost,
    status: status === ABSENT ? prev.status : status,
    session_type: sessionType === ABSENT ? prev.session_type : sessionType,
    competency_id: competencyId === ABSENT ? prev.competency_id : competencyId,
  };

  const { data, error } = await supabaseAdmin
    .from("hr3_training_sessions")
    .update(updates)
    .eq("id", id)
    .select(SESSION_SELECT)
    .single();

  if (error) {
    console.error("updateTrainingSession: update error:", error);
    return NextResponse.json(
      { error: "Failed to update training session" },
      { status: 500 }
    );
  }

  const updated = data as TrainingSession;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.trainingSessionUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.trainingSession,
    entityId: updated.id,
    oldData: {
      title: prev.title,
      status: prev.status,
      session_type: prev.session_type,
      schedule_date: prev.schedule_date,
      capacity: prev.capacity,
      cost: prev.cost,
      venue: prev.venue,
    },
    newData: {
      title: updated.title,
      status: updated.status,
      session_type: updated.session_type,
      schedule_date: updated.schedule_date,
      capacity: updated.capacity,
      cost: updated.cost,
      venue: updated.venue,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * TRAINING ENROLLMENTS
 * ===================================================================== */

export type ListTrainingEnrollmentsQuery = Record<string, unknown>;

/**
 * Lists training enrollments.
 *
 * HR scope: all, with optional `employee_id` (must exist) and `session_id`
 * (must exist) filters. Employee scope: forced to the employee's own
 * enrollments — any foreign employee_id is a generic 403.
 */
export async function listTrainingEnrollments(
  input: ListTrainingEnrollmentsQuery
): Promise<TrainingEnrollment[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  let query = supabaseAdmin
    .from("hr3_training_enrollments")
    .select(TRAINING_ENROLLMENT_SELECT);

  if (admin instanceof NextResponse) {
    query = query.eq("employee_id", identity.employeeUuid);
  } else {
    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = await requireExistingEmployeeId(input.employee_id);
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }
  }

  if (input?.session_id !== undefined && input?.session_id !== null) {
    const sessionId = await requireExistingSessionId(input.session_id);
    if (sessionId instanceof NextResponse) return sessionId;
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query
    .order("session_id", { ascending: true })
    .order("employee_id", { ascending: true });

  if (error) {
    console.error("listTrainingEnrollments: query error:", error);
    return NextResponse.json(
      { error: "Failed to load training enrollments" },
      { status: 500 }
    );
  }

  return (data ?? []) as TrainingEnrollment[];
}

/**
 * Reads one training enrollment. Employee scope may only read their own.
 */
export async function getTrainingEnrollment(
  enrollmentId: string
): Promise<TrainingEnrollment | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(enrollmentId, "enrollment id");
  if (id instanceof NextResponse) return id;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .select(TRAINING_ENROLLMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getTrainingEnrollment: query error:", error);
    return NextResponse.json(
      { error: "Failed to load training enrollment" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Training enrollment not found" },
      { status: 404 }
    );
  }

  const enrollment = data as TrainingEnrollment;

  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) {
    if (enrollment.employee_id !== identity.employeeUuid) {
      console.error(
        "getTrainingEnrollment: employee attempted a foreign enrollment"
      );
      return FORBIDDEN_RESPONSE();
    }
  }

  return enrollment;
}

/**
 * Enrolls an employee in a training session (HR scope only). The schema has NO
 * unique constraint on (employee_id, session_id) (verified), so the module
 * de-duplicates at the application layer with a 409. Mutation → audit
 * (`training_enrollment.created`).
 */
export async function createTrainingEnrollment(
  input: TrainingEnrollmentInput
): Promise<TrainingEnrollment | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  const sessionId = await requireExistingSessionId(input?.session_id);
  if (sessionId instanceof NextResponse) return sessionId;

  const { data: duplicate } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .select("id")
    .eq("employee_id", employeeId as string)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (duplicate) {
    return CONFLICT_RESPONSE(
      "This employee is already enrolled in this training session."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .insert({
      employee_id: employeeId as string,
      session_id: sessionId,
    })
    .select(TRAINING_ENROLLMENT_SELECT)
    .single();

  if (error) {
    console.error("createTrainingEnrollment: insert error:", error);
    return NextResponse.json(
      { error: "Failed to create training enrollment" },
      { status: 500 }
    );
  }

  const created = data as TrainingEnrollment;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.trainingEnrollmentCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.trainingEnrollment,
    entityId: created.id,
    oldData: null,
    newData: {
      employee_id: created.employee_id,
      session_id: created.session_id,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/**
 * Updates approval/attendance of a training enrollment (HR scope only).
 *
 * `approval_status` and `attendance_status` are free-text columns with no check
 * (verified), so the module write-manages a small vocabulary (see types).
 * `approved_by` references `hr1_employees.id` (an hr_admin id is rejected by
 * the FK), so when approval is set to granted/rejected the module records the
 * acting HR account's LINKED EMPLOYEE uuid server-side. Mutation → audit
 * (`training_enrollment.updated`).
 */
export async function updateTrainingEnrollment(
  enrollmentId: string,
  input: UpdateTrainingEnrollmentInput
): Promise<TrainingEnrollment | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const id = requireValidUuid(enrollmentId, "enrollment id");
  if (id instanceof NextResponse) return id;

  const { data: existing, error: loadError } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .select(TRAINING_ENROLLMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("updateTrainingEnrollment: load error:", loadError);
    return NextResponse.json(
      { error: "Failed to load training enrollment" },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Training enrollment not found" },
      { status: 404 }
    );
  }

  const prev = existing as TrainingEnrollment;

  let approvalStatus: string | null = null;
  if (input?.approval_status !== undefined) {
    if (
      typeof input.approval_status !== "string" ||
      !TRAINING_APPROVAL_STATUSES.includes(
        input.approval_status as (typeof TRAINING_APPROVAL_STATUSES)[number]
      )
    ) {
      return BAD_REQUEST_RESPONSE(
        `approval_status must be one of: ${TRAINING_APPROVAL_STATUSES.join(", ")}.`
      );
    }
    approvalStatus = input.approval_status;
  }

  let attendanceStatus: string | null | typeof ABSENT = ABSENT;
  if (input?.attendance_status !== undefined) {
    if (input.attendance_status === null) {
      attendanceStatus = null;
    } else if (
      typeof input.attendance_status === "string" &&
      TRAINING_ATTENDANCE_STATUSES.includes(
        input.attendance_status as (typeof TRAINING_ATTENDANCE_STATUSES)[number]
      )
    ) {
      attendanceStatus = input.attendance_status;
    } else {
      return BAD_REQUEST_RESPONSE(
        `attendance_status must be one of: ${TRAINING_ATTENDANCE_STATUSES.join(", ")} or null.`
      );
    }
  }

  if (approvalStatus === null && attendanceStatus === ABSENT) {
    return BAD_REQUEST_RESPONSE(
      "At least one of approval_status or attendance_status must be provided."
    );
  }

  const nextApproval = approvalStatus ?? prev.approval_status;
  const updates: Record<string, unknown> = {
    approval_status: nextApproval,
    attendance_status:
      attendanceStatus === ABSENT ? prev.attendance_status : attendanceStatus,
  };

  if (
    (nextApproval === "approved" || nextApproval === "rejected") &&
    prev.approved_by === null
  ) {
    updates.approved_by = identity.employeeUuid;
  }

  const { data, error } = await supabaseAdmin
    .from("hr3_training_enrollments")
    .update(updates)
    .eq("id", id)
    .select(TRAINING_ENROLLMENT_SELECT)
    .single();

  if (error) {
    console.error("updateTrainingEnrollment: update error:", error);
    return NextResponse.json(
      { error: "Failed to update training enrollment" },
      { status: 500 }
    );
  }

  const updated = data as TrainingEnrollment;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.trainingEnrollmentUpdated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.trainingEnrollment,
    entityId: updated.id,
    oldData: {
      approval_status: prev.approval_status,
      attendance_status: prev.attendance_status,
      approved_by: prev.approved_by,
    },
    newData: {
      approval_status: updated.approval_status,
      attendance_status: updated.attendance_status,
      approved_by: updated.approved_by,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return updated;
}

/* =====================================================================
 * TRAINING EVALUATIONS
 * ===================================================================== */

export type ListTrainingEvaluationsQuery = Record<string, unknown>;

/**
 * Lists session evaluations.
 *
 * HR scope: all, with optional `session_id` (must exist) and `employee_id`
 * (must exist) filters (can be combined). Employee scope: only the employee's
 * own evaluations, against their own id — a foreign employee_id is a generic
 * 403.
 */
export async function listTrainingEvaluations(
  input: ListTrainingEvaluationsQuery
): Promise<TrainingEvaluation[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  let query = supabaseAdmin
    .from("hr3_training_evaluations")
    .select(EVALUATION_SELECT);

  if (admin instanceof NextResponse) {
    query = query.eq("employee_id", identity.employeeUuid);
  } else {
    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = await requireExistingEmployeeId(input.employee_id);
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }
  }

  if (input?.session_id !== undefined && input?.session_id !== null) {
    const sessionId = await requireExistingSessionId(input.session_id);
    if (sessionId instanceof NextResponse) return sessionId;
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query
    .order("submitted_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listTrainingEvaluations: query error:", error);
    return NextResponse.json(
      { error: "Failed to load training evaluations" },
      { status: 500 }
    );
  }

  return (data ?? []) as TrainingEvaluation[];
}

/**
 * Records a session evaluation. `rating` is an optional integer 1..5 (the exact
 * schema check — verified live: 0/6/3.5 rejected; the column is nullable, so a
 * comments-only evaluation is valid) and `comments` is optional.
 *
 * HR scope: may record on any employee's behalf. Employee scope: may record for
 * a session they are enrolled in and only against their own `employee_id` —
 * supplying a different employee_id is a generic 403, and the session must exist.
 * Mutation → audit (`training_evaluation.created`).
 */
export async function createTrainingEvaluation(
  input: TrainingEvaluationInput
): Promise<TrainingEvaluation | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  const sessionId = await requireExistingSessionId(input?.session_id);
  if (sessionId instanceof NextResponse) return sessionId;

  let employeeId: string | NextResponse;
  if (admin instanceof NextResponse) {
    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      if (String(input.employee_id).trim() !== identity.employeeUuid) {
        console.error(
          "createTrainingEvaluation: employee attempted to evaluate on another employee's behalf"
        );
        return FORBIDDEN_RESPONSE();
      }
    }
    employeeId = identity.employeeUuid as string;
  } else {
    employeeId = await requireExistingEmployeeId(input?.employee_id);
    if (employeeId instanceof NextResponse) return employeeId;
    employeeId = employeeId as string;
  }

  const employeeScope =
    admin instanceof NextResponse ? (identity.employeeUuid as string) : null;

  if (employeeScope) {
    const { data: enrolled } = await supabaseAdmin
      .from("hr3_training_enrollments")
      .select("id")
      .eq("employee_id", employeeScope)
      .eq("session_id", sessionId as string)
      .maybeSingle();

    if (!enrolled) {
      return CONFLICT_RESPONSE(
        "You can only evaluate a training session you are enrolled in."
      );
    }
  }

  let rating: number | null | typeof ABSENT = ABSENT;
  if (input?.rating !== undefined && input?.rating !== null) {
    if (
      typeof input.rating !== "number" ||
      !Number.isInteger(input.rating) ||
      input.rating < TRAINING_EVALUATION_RATING_MIN ||
      input.rating > TRAINING_EVALUATION_RATING_MAX
    ) {
      return BAD_REQUEST_RESPONSE(
        `rating must be an integer between ${TRAINING_EVALUATION_RATING_MIN} and ${TRAINING_EVALUATION_RATING_MAX}.`
      );
    }
    rating = input.rating;
  }

  const comments = requireOptionalText(
    input?.comments,
    "comments",
    MAX_EVALUATION_COMMENT_LENGTH
  );
  if (comments instanceof NextResponse) return comments;

  const { data, error } = await supabaseAdmin
    .from("hr3_training_evaluations")
    .insert({
      session_id: sessionId as string,
      employee_id: employeeId as string,
      rating: rating === ABSENT ? null : rating,
      comments: comments === ABSENT ? null : comments,
    })
    .select(EVALUATION_SELECT)
    .single();

  if (error) {
    console.error("createTrainingEvaluation: insert error:", error);
    return NextResponse.json(
      { error: "Failed to record training evaluation" },
      { status: 500 }
    );
  }

  const created = data as TrainingEvaluation;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(identity),
    reason: PERFORMANCE_AUDIT_REASON.trainingEvaluationCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.trainingEvaluation,
    entityId: created.id,
    oldData: null,
    newData: {
      session_id: created.session_id,
      employee_id: created.employee_id,
      rating: created.rating,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}

/* =====================================================================
 * CERTIFICATIONS
 * ===================================================================== */

export type ListCertificationsQuery = Record<string, unknown>;

/**
 * Lists certifications.
 *
 * HR scope: all, with optional `employee_id` (must exist) filter. Employee
 * scope: only their own certifications — any foreign employee_id is a generic
 * 403.
 *
 * NOTE: `hr3_certifications` has NO status/validity field and this module adds
 * none. `issued_at`/`expires_at` are shown as dates only; no derived
 * "valid/expired" state is computed anywhere.
 */
export async function listCertifications(
  input: ListCertificationsQuery
): Promise<Certification[] | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  const admin = await assertHrAdminScope();

  let query = supabaseAdmin
    .from("hr3_certifications")
    .select(CERTIFICATION_SELECT);

  if (admin instanceof NextResponse) {
    query = query.eq("employee_id", identity.employeeUuid);
  } else {
    if (input?.employee_id !== undefined && input?.employee_id !== null) {
      const employeeId = await requireExistingEmployeeId(input.employee_id);
      if (employeeId instanceof NextResponse) return employeeId;
      query = query.eq("employee_id", employeeId);
    }
  }

  const { data, error } = await query
    .order("issued_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listCertifications: query error:", error);
    return NextResponse.json(
      { error: "Failed to load certifications" },
      { status: 500 }
    );
  }

  return (data ?? []) as Certification[];
}

/**
 * Issues a certification to an employee (HR scope only). `employee_id`
 * required; `course_id` optional (may be null — must exist when provided);
 * `certificate_url` optional; `expires_at` optional ISO date; `issued_at` is
 * always the database default (now()) and is never client-supplied. No status
 * column exists, so nothing is derived from the dates. Mutation → audit
 * (`certification.created`).
 */
export async function createCertification(
  input: CertificationInput
): Promise<Certification | NextResponse> {
  const admin = await assertHrAdminScope();
  if (admin instanceof NextResponse) return admin;

  const employeeId = await requireExistingEmployeeId(input?.employee_id);
  if (employeeId instanceof NextResponse) return employeeId;

  let courseId: string | null | typeof ABSENT = ABSENT;
  if (input?.course_id !== undefined && input?.course_id !== null) {
    const verified = await requireExistingCourseId(input.course_id, {
      allowNull: false,
    });
    if (verified instanceof NextResponse) return verified;
    courseId = verified as string;
  } else if (input?.course_id === null) {
    courseId = null;
  }

  const url = requireOptionalText(
    input?.certificate_url,
    "certificate_url",
    MAX_CERT_URL_LENGTH
  );
  if (url instanceof NextResponse) return url;

  const expiresAt = requireOptionalIsoDate(input?.expires_at, "expires_at");
  if (expiresAt instanceof NextResponse) return expiresAt;

  const { data, error } = await supabaseAdmin
    .from("hr3_certifications")
    .insert({
      employee_id: employeeId as string,
      course_id: courseId === ABSENT ? null : courseId,
      certificate_url: url === ABSENT ? null : url,
      expires_at: expiresAt === ABSENT ? null : expiresAt,
    })
    .select(CERTIFICATION_SELECT)
    .single();

  if (error) {
    console.error("createCertification: insert error:", error);
    return NextResponse.json(
      { error: "Failed to issue certification" },
      { status: 500 }
    );
  }

  const created = data as Certification;

  const auditError = await insertAuditEvent({
    actor: auditActorFromIdentity(admin),
    reason: PERFORMANCE_AUDIT_REASON.certificationCreated,
    entityType: PERFORMANCE_AUDIT_ENTITY_TYPE.certification,
    entityId: created.id,
    oldData: null,
    newData: {
      employee_id: created.employee_id,
      course_id: created.course_id,
      certificate_url: created.certificate_url,
      issued_at: created.issued_at,
      expires_at: created.expires_at,
    },
  });
  if (auditError instanceof NextResponse) return auditError;

  return created;
}