export const PERFORMANCE_CYCLE_STATUSES = [
  "draft",
  "open",
  "in_review",
  "finalization",
  "closed",
] as const;

export const PERFORMANCE_CYCLE_STAGES = [
  "goal_setting",
  "goal_execution",
  "check_in",
  "self_assessment",
  "manager_assessment",
  "finalization",
  "closed",
] as const;

export type PerformanceCycleStatus =
  (typeof PERFORMANCE_CYCLE_STATUSES)[number];
export type PerformanceCycleStage = (typeof PERFORMANCE_CYCLE_STAGES)[number];

export type PerformanceCycle = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: PerformanceCycleStatus;
  stage: PerformanceCycleStage;
  created_by: string;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
};

export type CycleCreateInput = {
  name: string;
  period_start: string;
  period_end: string;
};

/**
 * A hard reason a cycle cannot advance to its next stage. `count` is the
 * number of cycle-linked records that are blocking the transition (0 when the
 * blocker is not about a countable population).
 */
export type PerformanceCycleReadinessBlocker = {
  code: string;
  label: string;
  count: number;
  description: string;
};

/**
 * An informational observation about a cycle's readiness. Warnings never block
 * an advance; they surface data the server cannot verify authoritatively.
 */
export type PerformanceCycleReadinessWarning = {
  code: string;
  label: string;
  description: string;
};

/**
 * Server-computed readiness for the cycle's next forward-only stage
 * transition. Exactly one implementation produces this shape; both the
 * read-only readiness endpoint and the advance operation consume it, so the
 * UI and the enforcement can never disagree.
 */
export type PerformanceCycleReadiness = {
  cycleId: string;
  ready: boolean;
  currentStage: PerformanceCycleStage;
  nextStage: PerformanceCycleStage | null;
  summary: string;
  blockers: PerformanceCycleReadinessBlocker[];
  warnings: PerformanceCycleReadinessWarning[];
};

/**
 * Closure readiness for the Open/Monitor/Close operating model. Narrower
 * than stage-advance readiness: only whether every cycle-linked appraisal
 * has reached `finalized`/`acknowledged`. Pending acknowledgment alone
 * never blocks. Returned on close rejection (409) and consumed by the
 * close-confirmation UI.
 */
export type PerformanceCycleClosureReadiness = {
  cycleId: string;
  ready: boolean;
  totalAppraisals: number;
  finalizedAppraisals: number;
  unfinishedAppraisals: number;
  blockers: PerformanceCycleReadinessBlocker[];
};

export type CurrentPerDevUser = {
  fullName: string;
  role: string;
  email: string | null;
};

export type PerDevSessionActor = {
  hrAdminId: string | null;
  accountType: "hr_admin" | "manager" | "employee";
  fullName: string;
  email: string | null;
  role: string;
};

export type PerDevSessionEmployee = {
  employeeUuid: string;
  employeeIdNumber: string | null;
  fullName: string | null;
};

export const PERFORMANCE_CYCLE_STAGE_LABELS: Record<
  PerformanceCycleStage,
  string
> = {
  goal_setting: "Goal Setting",
  goal_execution: "Goal Execution",
  check_in: "Check-in",
  self_assessment: "Self Assessment",
  manager_assessment: "Manager Assessment",
  finalization: "Finalization",
  closed: "Closed",
};

export const PERFORMANCE_CYCLE_STATUS_LABELS: Record<
  PerformanceCycleStatus,
  string
> = {
  draft: "Draft",
  open: "Open",
  in_review: "In Review",
  finalization: "Finalization",
  closed: "Closed",
};

export const PERFORMANCE_CYCLE_STATUS_TONES: Record<
  PerformanceCycleStatus,
  string
> = {
  draft: "bg-line text-muted",
  open: "bg-accent/10 text-accent",
  in_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  finalization: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  closed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const PERFORMANCE_GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "pending_completion",
  "completed",
] as const;

export type PerformanceGoalStatus = (typeof PERFORMANCE_GOAL_STATUSES)[number];

/**
 * Proposal approval lifecycle for employee goal-setting. Orthogonal to
 * `PerformanceGoalStatus` (execution/completion): approval tracks whether a
 * goal is official, status tracks how far the work has progressed.
 *
 *   draft                    employee-authored proposal, editable by owner
 *   pending_manager_approval submitted, awaiting manager/HR review
 *   approved                 official goal (all pre-workflow goals are approved)
 *   returned                 reviewer requested revision, editable by owner
 *   rejected                 terminal refusal, read-only
 */
export const GOAL_APPROVAL_STATUSES = [
  "draft",
  "pending_manager_approval",
  "approved",
  "returned",
  "rejected",
] as const;

export type GoalApprovalStatus = (typeof GOAL_APPROVAL_STATUSES)[number];

/**
 * Hybrid progress-tracking methods. Mirrors `GOAL_PROGRESS_METHODS` in
 * `lib/performance/goals.ts`. Kept in sync manually because that file is
 * server-only.
 */
export const GOAL_PROGRESS_METHODS = ["manual", "measurable"] as const;

export type GoalProgressMethod = (typeof GOAL_PROGRESS_METHODS)[number];

/**
 * Measurement kinds for measurable goals. Mirrors `GOAL_MEASUREMENT_TYPES`
 * in `lib/performance/goals.ts`. Display-only semantics.
 */
export const GOAL_MEASUREMENT_TYPES = [
  "number",
  "currency",
  "percentage",
  "custom",
] as const;

export type GoalMeasurementType = (typeof GOAL_MEASUREMENT_TYPES)[number];

/**
 * HR-admin status transitions for goals. Mirrors the server-side
 * `HR_GOAL_ADMIN_STATUS_TRANSITIONS` in `lib/performance/goals.ts`. Kept in
 * sync manually because that file is server-only.
 */
export const HR_GOAL_STATUS_TRANSITIONS: Record<
  PerformanceGoalStatus,
  readonly PerformanceGoalStatus[]
> = {
  not_started: ["in_progress"],
  in_progress: ["pending_completion"],
  pending_completion: ["completed"],
  completed: [],
};

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
   * Hybrid progress tracking: `manual` (progress entered directly) or
   * `measurable` (progress derived server-side from actual/target).
   * NULL on rows predating the measurement migration behaves as `manual`.
   */
  progress_method: GoalProgressMethod | null;
  measurement_type: GoalMeasurementType | null;
  target_value: number | null;
  actual_value: number | null;
  measurement_unit: string | null;
  /**
   * Proposal approval state (see `GoalApprovalStatus`). Every goal created
   * through manager/HR channels — including all rows predating the approval
   * workflow — is `approved`; employee self-proposals start as `draft`.
   */
  approval_status: GoalApprovalStatus;
  /** Server timestamp of the last proposal submission, null when never submitted. */
  submitted_at: string | null;
  /** Server timestamp of the last manager/HR review, null when never reviewed. */
  reviewed_at: string | null;
  /** `hr1_employees.id` of the reviewing manager/HR admin (server-derived), null when never reviewed. */
  reviewed_by: string | null;
  /** Reviewer note (required on return/reject, optional on approve). */
  review_note: string | null;
  /**
   * Presentation enrichment: the authenticated ACCOUNT (hr_admin) that created
   * the goal (`goal.created` audit actor), e.g. "cap cap". Resolved
   * server-side from the persisted audit trail on every scoped response.
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

export type GoalCreateInput = Partial<{
  employee_id: string;
  title: string;
  description: string | null;
  category: string | null;
  weight: number | null;
  start_date: string;
  due_date: string;
  priority: string;
  target: string | null;
  role_id: string | null;
  cycle_id: string | null;
  progress_method: GoalProgressMethod;
  measurement_type: GoalMeasurementType | null;
  target_value: number | null;
  actual_value: number | null;
  measurement_unit: string | null;
}>;

export type GoalUpdateInput = Partial<{
  employee_id: string;
  title: string;
  description: string | null;
  category: string | null;
  weight: number | null;
  start_date: string;
  due_date: string;
  priority: string;
  target: string | null;
  role_id: string | null;
  cycle_id: string | null;
  progress_percent: number;
  status: PerformanceGoalStatus;
  progress_method: GoalProgressMethod;
  measurement_type: GoalMeasurementType | null;
  target_value: number | null;
  measurement_unit: string | null;
}>;

export type GoalProgressInput = {
  progress_percent: number;
};

export type GoalActualUpdateInput = {
  actual_value: number;
  note?: string | null;
};

/**
 * DISPLAY-ONLY Goal Setting summary of the weights already recorded for an
 * employee (optionally scoped to one performance cycle, mirroring the
 * appraisal scoring scope). It is purely informational: the authoritative 100%
 * weight rule is enforced server-side at appraisal finalization
 * (`lib/performance/scoring.ts`) and is NOT re-implemented or weakened here.
 */
export type GoalWeightContext = {
  goalCount: number;
  weightTotal: number;
};

export const PERFORMANCE_GOAL_STATUS_LABELS: Record<
  PerformanceGoalStatus,
  string
> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_completion: "Pending Completion",
  completed: "Completed",
};

export const PERFORMANCE_GOAL_STATUS_TONES: Record<
  PerformanceGoalStatus,
  string
> = {
  not_started: "bg-line text-muted",
  in_progress: "bg-accent/10 text-accent",
  pending_completion: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/**
 * Employee-facing labels for the proposal approval lifecycle. Kept separate
 * from execution-status labels: approval answers "is this goal official?",
 * status answers "how far along is the work?".
 */
export const GOAL_APPROVAL_STATUS_LABELS: Record<GoalApprovalStatus, string> =
  {
    draft: "Draft",
    pending_manager_approval: "Pending Approval",
    approved: "Approved",
    returned: "Changes Requested",
    rejected: "Rejected",
  };

export const GOAL_APPROVAL_STATUS_TONES: Record<GoalApprovalStatus, string> = {
  draft: "bg-line text-muted",
  pending_manager_approval:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  returned: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/**
 * Client payload for employee proposal create/edit. Contains ONLY
 * employee-proposable definition fields — ownership, weight, approval,
 * status, and progress state are server-derived and never sent.
 */
export type GoalProposalInput = Partial<{
  title: string;
  description: string | null;
  category: string | null;
  target: string | null;
  cycle_id: string | null;
  start_date: string;
  due_date: string;
  priority: string;
  progress_method: GoalProgressMethod;
  measurement_type: GoalMeasurementType | null;
  target_value: number | null;
  measurement_unit: string | null;
}>;

/** Client payload for proposal review actions (approve/return/reject). */
export type GoalReviewInput = Partial<{
  weight: number | null;
  review_note: string | null;
}>;

export type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNumber?: string;
  status?: string | null;
  department?: string | null;
  job_position_id?: string | null;
  /**
   * DISPLAY-ONLY derived employee data used by the Goal Create flow. Values
   * are resolved server-side from the employee's own record and are never
   * submitted with the goal: `position` is the title of the employee's current
   * job position (join on `hr1_employees.job_position_id` →
   * `hr1_job_positions.title`), `managerId` is the employee's `manager_id`,
   * and `managerName` is the full name of that manager record.
   */
  position?: string | null;
  managerId?: string | null;
  managerName?: string | null;
};

export type JobPositionOption = {
  id: string;
  title: string;
  isActive: boolean;
};

export const CHECK_IN_FEEDBACK_TYPE = "check_in" as const;

export type CheckInFeedbackType = typeof CHECK_IN_FEEDBACK_TYPE;

/**
 * Server-side representation of a Check-in stored in the reused live table
 * `hr3_performance_feedback` (filtered to `feedback_type = 'check_in'`),
 * matching the ACTUAL live columns. No goal/cycle/update/account-level fields
 * exist in the schema, so none are represented.
 *
 * `given_by` is always the linked employee UUID of the authenticated actor,
 * resolved server-side. It is NOT an `hr_admin.id`.
 */
export type PerformanceCheckIn = {
  id: string;
  employee_id: string;
  given_by: string;
  feedback_type: CheckInFeedbackType;
  message: string;
  created_at: string;
  /**
   * HR-only presentation enrichment. The authenticated ACCOUNT (hr_admin)
   * that created the check-in (`checkin.created` audit actor), e.g. "cap cap".
   *
   * This is distinct from `given_by` (the linked employee identity, e.g.
   * "Ana Garcia"). When the check-in has no account-level audit event
   * (historical check-ins created before audit logging), this is absent and the
   * HR UI falls back to the employee-layer `given_by` name. It is NEVER derived
   * from the currently logged-in account for other people's check-ins, and it
   * never replaces the business-layer `given_by` field.
   */
  givenByAccountName?: string | null;
  /**
   * Lightweight conversation summary for list responses (`messageCount`,
   * latest comment time, acknowledgment state). Null when the list engine could
   * not compile it. Full conversation data is loaded only when the user opens
   * the check-in.
   */
  threadSummary?: CheckInThreadSummary | null;
};

export type CheckInCreateInput = {
  employee_id?: string;
  message: string;
  /**
   * Optional goal linkage intent for a goal-linked check-in. Consumed
   * server-side ONLY for the closed-cycle pre-write guard; it is never
   * persisted (the schema has no check-in ↔ goal column) — the durable link
   * is the evidence row filed afterwards via `check_in_id`.
   */
  goal_id?: string;
};

/**
 * Lightweight per-check-in conversation summary attached to list responses.
 *
 * Computed server-side in one aggregate query over
 * `hr3_performance_checkin_messages` (never an N+1). `messageCount` counts
 * visible conversation entries only (message/reply); the acknowledgment is
 * reported through the `acknowledged*` fields and never counts as a comment.
 */
export type CheckInThreadSummary = {
  messageCount: number;
  latestMessageAt: string | null;
  acknowledged: boolean;
  acknowledgedByEmployeeName: string | null;
  acknowledgedAt: string | null;
};

export const CHECK_IN_MESSAGE_KINDS = [
  "message",
  "reply",
  "acknowledgment",
] as const;

export type CheckInMessageKind = (typeof CHECK_IN_MESSAGE_KINDS)[number];

export type CheckInMessageCreateInput = {
  /**
   * When set, the message is stored as a `reply` attached to that comment.
   * When omitted/empty, the message is a top-level `message` comment.
   * The parent MUST belong to the same check-in; the server validates it.
   */
  parent_message_id?: string | null;
  message: string;
};

/**
 * Server-side representation of one conversation entry stored in the new
 * append-only `hr3_performance_checkin_messages` table.
 *
 * `employee_id` is the SUBJECT employee of the thread root (never the sender);
 * `author_employee_id` is the linked employee identity of the authenticated
 * sender, and `author_account_id` is the sender's `hr_admin.id` (only HR Admin
 * accounts carry one). All three are resolved server-side.
 *
 * `authorDisplayName` / `authorAccountName` are server-resolved presentation
 * fields. `authorAccountName` is populated ONLY for HR-admin readers, so
 * manager/employee readers never receive HR account information.
 */
export type PerformanceCheckInMessage = {
  id: string;
  check_in_id: string;
  parent_message_id: string | null;
  employee_id: string;
  author_employee_id: string;
  author_account_id: string | null;
  message_kind: "message" | "reply";
  message: string;
  created_at: string;
  authorDisplayName: string | null;
  authorAccountName?: string | null;
};

/**
 * Server-side representation of an employee's acknowledgment of a check-in.
 *
 * Stored as an append-only row with `message_kind = 'acknowledgment'` in
 * `hr3_performance_checkin_messages`. Distinct from ordinary comments and NEVER
 * returned inside `PerformanceCheckInThread.messages`.
 */
export type CheckInAcknowledgment = {
  id: string;
  check_in_id: string;
  employee_id: string;
  author_employee_id: string;
  author_account_id: string | null;
  message_kind: "acknowledgment";
  message: string;
  created_at: string;
  acknowledgedByEmployeeName: string | null;
};

/**
 * A check-in root plus its full private conversation.
 *
 * `messages` contains only visible conversation entries (message/reply) in
 * ascending order; the acknowledgment (if any) is exposed separately so it is
 * never rendered as an ordinary comment.
 *
 * `evidence` carries goal-evidence rows linked to this check-in (resolved
 * server-side inside `listCheckInThread`, already scope-filtered). It is
 * absent/empty for general check-ins, which render exactly as before.
 */
export type PerformanceCheckInThread = {
  checkIn: PerformanceCheckIn;
  messages: PerformanceCheckInMessage[];
  acknowledgment: CheckInAcknowledgment | null;
  evidence?: PerformanceGoalEvidenceItem[] | null;
};

/**
 * Server-side representation of one Goal Evidence record stored in the
 * append-only `hr3_performance_goal_evidence` table. Aligned EXACTLY to the
 * migration `20260921_create_hr3_performance_goal_evidence.sql`.
 *
 * `employee_id` is the GOAL OWNER, always resolved server-side from the goal
 * (never taken from the authenticated actor directly). `attachment_path` is
 * the bucket-relative storage path and is intentionally NOT exposed to the
 * browser; API responses expose `fileUrl` (a short-lived signed URL) instead.
 */
export type PerformanceGoalEvidence = {
  id: string;
  goal_id: string;
  employee_id: string;
  check_in_id: string | null;
  progress_percent: number;
  note: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  created_at: string;
};

/**
 * Client-facing representation of Goal Evidence returned by the API.
 *
 * `attachment_path` is never leaked: consumers receive only attachment
 * metadata plus a short-lived server-generated `fileUrl` (null when the record
 * has no attachment or a signed URL could not be generated).
 *
 * `goal_title` is populated only on thread-context payloads (evidence
 * attached to a check-in conversation) so the conversation can name the goal
 * without a second lookup. It is absent on goal-scoped list responses.
 */
export type PerformanceGoalEvidenceItem = Omit<
  PerformanceGoalEvidence,
  "attachment_path"
> & {
  fileUrl: string | null;
  goal_title?: string | null;
};

/**
 * Client-supplied attachment payload for creating Goal Evidence.
 *
 * `name` is a display-only original file name — it is NEVER used as the
 * storage path; the server derives the path (and its extension) from the MIME
 * type. `data` is base64-encoded file content (a `data:*;base64,` prefix is
 * tolerated and stripped server-side). `size` must match the decoded length.
 */
export type GoalEvidenceAttachmentInput = {
  name?: string | null;
  mime: string;
  size: number;
  data: string;
};

export type CreateGoalEvidenceInput = {
  /** Optional check-in the evidence is tied to; MUST belong to the goal's employee. */
  check_in_id?: string | null;
  progress_percent: number;
  note?: string | null;
  attachment?: GoalEvidenceAttachmentInput | null;
};

export const APPRAISAL_STATUSES = [
  "draft",
  "self_assessment",
  "manager_assessment",
  "finalized",
  "acknowledged",
] as const;

export type AppraisalStatus = (typeof APPRAISAL_STATUSES)[number];

/**
 * Server-side representation of a Performance Appraisal stored in the live
 * `hr3_performance_appraisals` table.
 *
 * The workflow is state-controlled through the `status` column:
 * draft → self_assessment → manager_assessment → finalized → acknowledged
 * (see `lib/performance/appraisals.ts` for the transition rules).
 *
 * Identity model (as the live schema provides): `employee_id` is the subject
 * employee, `reviewer_id` is the reviewer's linked employee identity, and
 * `reviewer_hr_admin_id` is the reviewer's HR account id. These are never
 * client-supplied for protected operations.
 *
 * Official scoring outputs are computed ONCE at finalization:
 * `final_score` (numeric 1.00–5.00) and `performance_rating` (rating-band
 * rank, integer 1..5). `letter_grade` is intentionally never populated and
 * `self_rating`/`manager_rating` remain informational. Per-goal and
 * per-competency ratings live in the appraisal result tables and are attached
 * as `goalResults`/`competencyResults` on single-record reads. A precomputed
 * `scoreSummary` (band key + label) is attached for finalized records.
 */
export type PerformanceAppraisal = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_period: string;
  status: AppraisalStatus;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  acknowledged_at: string | null;
  reviewer_hr_admin_id: string | null;
  cycle_id: string | null;
  final_score: number | null;
  performance_rating: number | null;
  /**
   * The manager/evaluator responsible for this appraisal's performance
   * assessment (goals/KPI + competencies). Resolved server-side from
   * `hr1_employees.manager_id` at creation time. Nullable: employees with
   * no manager have NULL. Immutable once set — does not change when
   * `manager_id` changes.
   */
  evaluator_id: string | null;
  /**
   * Frozen applicability snapshot: the applicable goal IDs at the time the
   * manager assessment was submitted.  NULL for pre-migration appraisals or
   * appraisals that have not yet been submitted.  Once set, finalization and
   * scoring-input reads use this snapshot instead of recomputing the live
   * applicable set, preventing applicability drift.
   */
  applicable_goal_ids_snapshot: string[] | null;
  /**
   * Frozen applicability snapshot: the applicable competency IDs at the time
   * the manager assessment was submitted.  NULL for pre-migration appraisals
   * or appraisals that have not yet been submitted.  Once set, finalization
   * and scoring-input reads use this snapshot instead of recomputing the live
   * applicable set.
   */
  applicable_competency_ids_snapshot: string[] | null;
  /**
   * Server-attached details (single-record reads only): the formal ratings
   * stored in `hr3_performance_appraisal_goal_results` /
   * `hr3_performance_appraisal_competency_results`.
   */
  goalResults?: AppraisalGoalResult[];
  competencyResults?: AppraisalCompetencyResult[];
  /** Precomputed official result for finalized/acknowledged records. */
  scoreSummary?: AppraisalScoreSummary;
  /**
   * HR-scope presentation enrichment: whether the CURRENT authenticated HR
   * account is the reviewer recorded on this appraisal
   * (`reviewer_hr_admin_id` + linked `reviewer_id`). Server-computed only for
   * HR-admin responses so HR UI can gate finalize affordances to the actual
   * reviewer. Never set on employee scopes.
   */
  currentUserIsHrReviewer?: boolean;
  /**
   * Presentation enrichment: whether the CURRENT authenticated employee is
   * the assigned evaluator for this appraisal (`evaluator_id`). Server-computed
   * for HR-admin and manager responses so UI can gate manager-assessment
   * affordances to the actual evaluator. Never set on employee scopes.
   */
  currentUserIsEvaluator?: boolean;
  /**
   * HR-scope presentation enrichment: the display name of the actor whose
   * audit event attributed this appraisal to its most recent action (manager
   * assessment submitted → finalized → created), for HR-admin UI attribution.
   * Derived from `hr3_audit_events` — resolved from `hr_admin` for HR-admin
   * actors and from `hr1_employees` for manager/employee actors. `null` when
   * no applicable audit event exists (historical records). Server-computed
   * ONLY for HR-admin responses; employees never receive this field.
   */
  reviewerByAccountName?: string | null;
  /**
   * Server-attached cycle display name. Resolved from `hr3_performance_cycles`
   * for Manager/Employee responses using the cycle IDs already present on the
   * authorized appraisal rows. `null` when `cycle_id` is absent or the cycle
   * record cannot be resolved. HR Admin responses populate this via the
   * existing `cycles` prop instead.
   */
  cycleName?: string | null;
};

export const APPRAISAL_STATUS_LABELS: Record<AppraisalStatus, string> = {
  draft: "Draft",
  self_assessment: "Self Assessment",
  manager_assessment: "Manager Assessment",
  finalized: "Finalized",
  acknowledged: "Acknowledged",
};

export const APPRAISAL_STATUS_TONES: Record<AppraisalStatus, string> = {
  draft: "bg-line text-muted",
  self_assessment: "bg-accent/10 text-accent",
  manager_assessment: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  finalized: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  acknowledged: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/**
 * DISPLAY-ONLY labels for appraisal statuses that predate the current
 * workflow vocabulary (draft → self_assessment → manager_assessment →
 * finalized → acknowledged).
 *
 * The workflow and APIs never write these values, never map them to a current
 * stage, and never migrate them (no DB changes). These maps only render legacy
 * records so existing data stays visible without masquerading as a live stage.
 */
export const LEGACY_APPRAISAL_STATUS_LABELS: Record<string, string> = {
  reviewed: "Legacy · Reviewed",
};

export const LEGACY_APPRAISAL_STATUS_TONES: Record<string, string> = {
  reviewed: "bg-line text-muted",
};

export type AppraisalCreateInput = {
  employee_id: string;
  review_period: string;
  cycle_id?: string;
};

/**
 * Approved final-performance rating bands.
 *
 * These are MATHEMATICAL boundaries evaluated against the unrounded computed
 * final score (`min` inclusive, `max` inclusive exactly as approved):
 *
 *   4.50 <= score <= 5.00  → Outstanding
 *   3.50 <= score <  4.50  → Exceeds Expectations
 *   2.50 <= score <  3.50  → Meets Expectations
 *   1.50 <= score <  2.50  → Needs Improvement
 *   1.00 <= score <  1.50  → Unsatisfactory
 *
 * `rank` is the documented integer stored in the appraisal's
 * `performance_rating` column (5 = Outstanding … 1 = Unsatisfactory) so the
 * column keeps the approved 1..5 model. Letter grades are never used.
 */
export const PERFORMANCE_RATING_BANDS = [
  { key: "outstanding", label: "Outstanding", min: 4.5, max: 5.0, rank: 5 },
  {
    key: "exceeds_expectations",
    label: "Exceeds Expectations",
    min: 3.5,
    max: 4.5,
    rank: 4,
  },
  {
    key: "meets_expectations",
    label: "Meets Expectations",
    min: 2.5,
    max: 3.5,
    rank: 3,
  },
  {
    key: "needs_improvement",
    label: "Needs Improvement",
    min: 1.5,
    max: 2.5,
    rank: 2,
  },
  {
    key: "unsatisfactory",
    label: "Unsatisfactory",
    min: 1.0,
    max: 1.5,
    rank: 1,
  },
] as const;

export type PerformanceRatingBandKey =
  (typeof PERFORMANCE_RATING_BANDS)[number]["key"];

export type PerformanceRatingBand = {
  key: PerformanceRatingBandKey;
  label: string;
  min: number;
  max: number;
  rank: number;
};

/** Resolves a computed (unrounded) final score to its approved band. */
export function performanceRatingBandFromScore(
  score: number,
): PerformanceRatingBand | null {
  for (const band of PERFORMANCE_RATING_BANDS) {
    if (score >= band.min && score <= band.max) return band;
  }
  return null;
}

/** Resolves the persisted `performance_rating` band rank (1..5) to a band. */
export function performanceRatingBandFromRank(
  rank: number,
): PerformanceRatingBand | null {
  if (!Number.isInteger(rank)) return null;
  return PERFORMANCE_RATING_BANDS.find((band) => band.rank === rank) ?? null;
}

/** One formal goal rating stored in `hr3_performance_appraisal_goal_results`. */
export type AppraisalGoalResult = {
  id: string;
  appraisal_id: string;
  goal_id: string;
  rating: number;
  created_at: string;
  /** Server-attached display name on single-record reads. */
  title?: string | null;
};

/** One formal competency rating stored in `hr3_performance_appraisal_competency_results`. */
export type AppraisalCompetencyResult = {
  id: string;
  appraisal_id: string;
  competency_id: string;
  rating: number;
  created_at: string;
  /** Server-attached display name on single-record reads. */
  name?: string | null;
};

/** Precomputed official result attached to finalized appraisals. */
export type AppraisalScoreSummary = {
  final_score: number;
  performance_rating: number;
  band_key: PerformanceRatingBandKey;
  band_label: string;
};

export type AppraisalGoalRatingInput = {
  goal_id: string;
  rating: number;
};

export type AppraisalCompetencyRatingInput = {
  competency_id: string;
  rating: number;
};

/** A goal eligible for scoring within an appraisal. */
export type AppraisalScoringGoal = {
  goal_id: string;
  title: string;
  weight: number | null;
  status: PerformanceGoalStatus;
  /** Read-only measurement context for measurable goals (never scored). */
  progress_percent: number | null;
  progress_method: GoalProgressMethod | null;
  measurement_type: GoalMeasurementType | null;
  target_value: number | null;
  actual_value: number | null;
  measurement_unit: string | null;
};

/** A competency eligible for scoring within an appraisal. */
export type AppraisalScoringCompetency = {
  competency_id: string;
  name: string;
  category: CompetencyCategory;
  current_level: number | null;
};

/**
 * Scoring inventory returned to the reviewer for an appraisal: the applicable
 * goals (with their weights) and applicable competencies, plus any ratings
 * already persisted for this appraisal.
 */
export type AppraisalScoringInputs = {
  appraisal_id: string;
  goals: AppraisalScoringGoal[];
  weight_total: number;
  competencies: AppraisalScoringCompetency[];
  existing_goal_ratings: AppraisalGoalRatingInput[];
  existing_competency_ratings: AppraisalCompetencyRatingInput[];
};

export const COMPETENCY_CATEGORIES = ["technical", "behavioral"] as const;

export type CompetencyCategory = (typeof COMPETENCY_CATEGORIES)[number];

/**
 * Competency LEVELS.
 *
 * Both the employee competency scores and the position competency requirements
 * store levels as plain integers, range-checked by the live schema (verified:
 * 0 and 6 are rejected; 1..5 are accepted by both tables). The value IS the
 * representation — it is NOT normalized to any other scale, and no label /
 * banding table exists yet. The rating semantics are finalized in a later
 * Scoring phase; this module only preserves and displays the stored values.
 */
export const COMPETENCY_LEVEL_MIN = 1;
export const COMPETENCY_LEVEL_MAX = 5;

/**
 * Server-side representation of a library Competency in the reused live table
 * `hr3_competencies`. `category` is constrained by the live schema to
 * 'technical' | 'behavioral' (verified by probe). `description` is nullable.
 */
export type Competency = {
  id: string;
  name: string;
  description: string | null;
  category: CompetencyCategory;
  created_at: string;
};

export type CompetencyInput = {
  name: string;
  description?: string | null;
  category: CompetencyCategory;
};

/**
 * Server-side representation of a Position Competency Requirement in the reused
 * live table `hr3_position_competency_requirements` (position ↔ competency ↔
 * required level). The live schema enforces uniqueness of (position_id,
 * competency_id) and a 1..5 required level.
 */
export type PositionCompetencyRequirement = {
  id: string;
  position_id: string;
  competency_id: string;
  required_level: number;
  created_at: string;
  updated_at: string;
};

export type PositionCompetencyRequirementInput = {
  position_id: string;
  competency_id: string;
  required_level: number;
};

/**
 * Only the required level is editable on an existing position↔competency
 * assignment. Moving a requirement to another position/competency is a
 * remove-then-add operation not exposed by this foundation.
 */
export type UpdatePositionCompetencyRequirementInput = {
  required_level: number;
};

/**
 * Server-side representation of ONE employee competency assessment row in the
 * reused live table `hr3_employee_competency_scores`.
 *
 * The table has NO unique constraint on (employee_id, competency_id) (verified
 * live), so assessments are APPEND-ONLY and form a history. The CURRENT state
 * is always the latest row per competency.
 *
 * `assessed_by` references an EMPLOYEE (`hr1_employees.id`), NOT `hr_admin.id`
 * (verified live via FK probe) — it is the linked employee of the acting HR
 * account, resolved server-side. The account-level attribution lives in the
 * audit trail.
 */
export type EmployeeCompetencyScore = {
  id: string;
  employee_id: string;
  competency_id: string;
  current_level: number;
  required_level: number | null;
  assessed_by: string;
  assessed_at: string;
};

export type EmployeeCompetencyAssessmentInput = {
  employee_id: string;
  competency_id: string;
  current_level: number;
  required_level?: number | null;
};

/**
 * Competency PROFILE item: the latest assessment per competency for an
 * employee, with a server-computed GAP.
 *
 * Gap is computed ONLY because both `required_level` and `current_level` are
 * integers on the same live-validated 1..5 scale — a safe, comparable numeric
 * basis (not invented ordering, not normalized). Effective required level
 * prefers the level stored on the latest assessment row, falling back to the
 * employee's POSITION requirement level, then null (shown as "Not assigned").
 * `gap` = effective_required_level - current_level; it stays null whenever
 * either side is unknown. NO score/percentage/metric is derived from it.
 */
export type EmployeeCompetencyProfileItem = {
  employee_id: string;
  competency_id: string;
  current_level: number;
  required_level: number | null;
  position_required_level: number | null;
  effective_required_level: number | null;
  gap: number | null;
  assessed_by: string;
  assessed_at: string;
};

export type PositionOption = {
  id: string;
  title: string;
  department: string;
};

/* =====================================================================
 * LEARNING & DEVELOPMENT (foundation)
 * ===================================================================== */

/**
 * Course enrollment PROGRESS bounds. The live schema CHECK on
 * `hr3_course_enrollments` (verified: 150 rejected, 42.5 accepted) enforces a
 * numeric 0..100 range with fractional progress allowed.
 */
export const COURSE_PROGRESS_MIN = 0;
export const COURSE_PROGRESS_MAX = 100;

/**
 * COURSE enrollment status — the vocabulary this module MANAGED for writes.
 *
 * IMPORTANT LIMITATION (reported): the live column `status` is free text with
 * NO check constraint and NO state machine. There is nothing in the schema
 * enforcing `enrolled → in_progress → completed`; legacy/unknown values are
 * displayed with a safe fallback. This module only allows these values when
 * WRITING, to keep the data readable; it does not pretend the DB enforces it.
 */
export const COURSE_ENROLLMENT_STATUSES = [
  "enrolled",
  "in_progress",
  "completed",
] as const;

export type CourseEnrollmentStatus =
  (typeof COURSE_ENROLLMENT_STATUSES)[number];

/**
 * TRAINING enrollment approval vocabulary (write-managed, free-text in DB).
 */
export const TRAINING_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type TrainingApprovalStatus =
  (typeof TRAINING_APPROVAL_STATUSES)[number];

/**
 * TRAINING attendance vocabulary (write-managed, free-text and nullable in DB).
 */
export const TRAINING_ATTENDANCE_STATUSES = ["attended", "absent"] as const;

export type TrainingAttendanceStatus =
  (typeof TRAINING_ATTENDANCE_STATUSES)[number];

/**
 * Training evaluation rating bounds. Verified live: the schema rejects 0, 6 and
 * 3.5 (integer + 1..5 CHECK), and the column is nullable (`rating` is optional
 * — a comments-only evaluation is valid).
 */
export const TRAINING_EVALUATION_RATING_MIN = 1;
export const TRAINING_EVALUATION_RATING_MAX = 5;

/** Server-side representation of `hr3_courses`. */
export type Course = {
  id: string;
  title: string;
  description: string | null;
  primary_content_url: string | null;
  duration_minutes: number | null;
  competency_id: string | null;
  created_by: string;
  created_at: string;
};

export type CourseInput = {
  title: string;
  description?: string | null;
  primary_content_url?: string | null;
  duration_minutes?: number | null;
  competency_id?: string | null;
};

/** Server-side representation of `hr3_course_enrollments`. */
export type CourseEnrollment = {
  id: string;
  employee_id: string;
  course_id: string;
  progress_percent: number;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
};

export type CourseEnrollmentInput = {
  employee_id: string;
  course_id: string;
};

/** Only progress/status are editable on an existing course enrollment. */
export type UpdateCourseEnrollmentInput = {
  status?: CourseEnrollmentStatus;
  progress_percent?: number;
};

/** Server-side representation of `hr3_training_sessions`. */
export type TrainingSession = {
  id: string;
  title: string;
  trainer_name: string | null;
  trainer_type: string | null;
  mode: string | null;
  venue: string | null;
  schedule_date: string | null;
  capacity: number | null;
  cost: number | null;
  status: string;
  created_at: string;
  session_type: string;
  competency_id: string | null;
};

export type TrainingSessionInput = {
  title: string;
  trainer_name?: string | null;
  trainer_type?: string | null;
  mode?: string | null;
  venue?: string | null;
  schedule_date?: string | null;
  capacity?: number | null;
  cost?: number | null;
  status?: string;
  session_type?: string;
  competency_id?: string | null;
};

/** Server-side representation of `hr3_training_enrollments`. */
export type TrainingEnrollment = {
  id: string;
  employee_id: string;
  session_id: string;
  approval_status: string;
  attendance_status: string | null;
  approved_by: string | null;
};

export type TrainingEnrollmentInput = {
  employee_id: string;
  session_id: string;
};

/** Approval/attendance are editable by HR; `approved_by` is server-derived. */
export type UpdateTrainingEnrollmentInput = {
  approval_status?: TrainingApprovalStatus;
  attendance_status?: TrainingAttendanceStatus | null;
};

/** Server-side representation of `hr3_training_evaluations`. */
export type TrainingEvaluation = {
  id: string;
  session_id: string;
  employee_id: string;
  rating: number | null;
  comments: string | null;
  submitted_at: string;
};

export type TrainingEvaluationInput = {
  session_id: string;
  employee_id: string;
  rating?: number | null;
  comments?: string | null;
};

/** Server-side representation of `hr3_certifications`. */
export type Certification = {
  id: string;
  employee_id: string;
  course_id: string | null;
  certificate_url: string | null;
  issued_at: string;
  expires_at: string | null;
};

export type CertificationInput = {
  employee_id: string;
  course_id?: string | null;
  certificate_url?: string | null;
  expires_at?: string | null;
};

/* =====================================================================
 * SUCCESSION PLANNING (foundation)
 * ===================================================================== */

/**
 * Risk level suggestions for a critical position. `hr3_critical_positions`
 * stores `risk_level` as FREE TEXT (verified live: no check constraint, the
 * column accepts arbitrary values). These are display/entry suggestions only —
 * the server never validates against them and never rewrites stored values.
 */
export const SUCCESSION_RISK_LEVEL_SUGGESTIONS = [
  "high",
  "medium",
  "low",
] as const;

/**
 * Readiness suggestions for a succession candidate. `readiness_level` is also
 * FREE TEXT (verified live: no check constraint; the DB default is
 * `'3plus_years'`). Suggestions mirror the legacy vocabulary but are
 * suggestions only. There is NO readiness calculation anywhere — readiness is
 * whatever the HR user typed/stored.
 */
export const SUCCESSION_READINESS_SUGGESTIONS = [
  "ready_now",
  "1_2_years",
  "2_3_years",
  "3plus_years",
] as const;

/** `hr3_succession_candidates.potential_rating` bounds (CHECK verified live:
 *  0 and 6 are rejected, 1 and 5 accepted). The column is nullable. */
export const SUCCESSION_POTENTIAL_RATING_MIN = 1;
export const SUCCESSION_POTENTIAL_RATING_MAX = 5;

export {
  SUCCESSION_MAX_RISK_LEVEL_LENGTH,
  SUCCESSION_MAX_REASON_LENGTH,
  SUCCESSION_MAX_READINESS_LENGTH,
  SUCCESSION_MAX_NOTES_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

/**
 * Server-side representation of a Critical Position in the reused live table
 * `hr3_critical_positions`.
 *
 * `position_id` references `hr1_job_positions.id` (FK verified live).
 * `risk_level` is NOT NULL FREE TEXT (DB default `'medium'`); `reason` is
 * nullable free text. `created_at` is DB-managed. No value is coerced or
 * rewritten — display code must render `risk_level`/`reason` as-is.
 */
export type CriticalPosition = {
  id: string;
  position_id: string;
  risk_level: string;
  reason: string | null;
  created_at: string;
};

export type CriticalPositionInput = {
  position_id: string;
  risk_level: string;
  reason?: string | null;
};

export type UpdateCriticalPositionInput = Partial<CriticalPositionInput>;

/**
 * HR-scope presentation enrichment for a Critical Position. Only the actual
 * live columns are carried; `positionTitle`/`positionDepartment`/`isActive`
 * come from the referenced `hr1_job_positions` row, and `candidateCount` is
 * the live count of `hr3_succession_candidates` rows for this position.
 */
export type CriticalPositionListItem = CriticalPosition & {
  positionTitle: string;
  positionDepartment: string;
  positionActive: boolean;
  candidateCount: number;
};

/**
 * Server-side representation of a Succession Candidate in the reused live
 * table `hr3_succession_candidates`.
 *
 * Relationships (FKs verified live): `position_id` → `hr3_critical_positions.id`
 * (the critical position the candidate succeeds), `employee_id` →
 * `hr1_employees.id`. `readiness_level` is NOT NULL FREE TEXT (DB default
 * `'3plus_years'`); `potential_rating` is an optional integer CHECKed to
 * 1..5; `performance_rating` is an optional numeric with NO DB check
 * (any finite number is accepted — never calculated or normalized here);
 * `development_notes` is optional free text. `updated_at` has no DB trigger,
 * so the server stamps it on every update.
 */
export type SuccessionCandidate = {
  id: string;
  position_id: string;
  employee_id: string;
  readiness_level: string;
  potential_rating: number | null;
  performance_rating: number | null;
  development_notes: string | null;
  updated_at: string;
};

export type SuccessionCandidateInput = {
  employee_id: string;
  readiness_level: string;
  potential_rating?: number | null;
  performance_rating?: number | null;
  development_notes?: string | null;
};

/** Only the editable candidate fields; `employee_id` is immutable (move =
 *  remove then re-add) and is never accepted on update. */
export type UpdateSuccessionCandidateInput = {
  readiness_level?: string;
  potential_rating?: number | null;
  performance_rating?: number | null;
  development_notes?: string | null;
};

/**
 * HR-scope presentation enrichment for a Succession Candidate. The raw live
 * columns are preserved; names/titles are resolved server-side from the
 * referenced `hr1_employees` / `hr1_job_positions` / `hr3_critical_positions`
 * rows.
 */
export type SuccessionCandidateListItem = SuccessionCandidate & {
  positionTitle: string;
  positionDepartment: string;
  riskLevel: string;
  employeeName: string;
  employeeNumber: string;
  employeeJobPosition: string | null;
  employeeDepartment: string | null;
  employeeStatus: string | null;
};

/**
 * DISPLAY-ONLY risk tones. `risk_level` is free text, so anything outside the
 * common vocabulary falls back to a neutral badge — the stored value is never
 * rewritten, only rendered.
 */
export function successionRiskTone(risk: string): string {
  switch (risk.trim().toLowerCase()) {
    case "high":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "medium":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "low":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default:
      return "bg-line text-muted";
  }
}

/**
 * DISPLAY-ONLY readiness tones. `readiness_level` is free text, so unknown
 * values get a neutral fallback badge. No readiness is ever calculated —
 * this only styles whatever the HR user stored.
 */
export function successionReadinessTone(readiness: string): string {
  switch (readiness.trim().toLowerCase()) {
    case "ready_now":
    case "now":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "1_2_years":
      return "bg-accent/10 text-accent";
    case "2_3_years":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "3plus_years":
    case "3_plus_years":
      return "bg-line text-muted";
    default:
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
  }
}

/** DISPLAY-ONLY label for the stored potential rating (1..5 or absent). */
export function successionPotentialLabel(rating: number | null): string {
  if (rating === null || rating === undefined) return "Not rated";
  return `${rating} / 5`;
}

/* =====================================================================
 * RECOGNITION & REWARDS
 * ===================================================================== */

export {
  REWARDS_MAX_MESSAGE_LENGTH,
  REWARDS_MAX_REWARD_DESCRIPTION_LENGTH,
  REWARDS_MAX_REASON_CATEGORY_LENGTH,
  REWARDS_MAX_VISIBILITY_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

/**
 * Reason categories confirmed accepted by the live
 * `hr3_recognitions_reason_category_check` (probed against the DB). The CHECK
 * constraint is authoritative; the server passes stored values through and
 * surfaces DB constraint errors as validation feedback rather than assuming
 * this list is complete.
 */
export const REWARDS_REASON_CATEGORY_SUGGESTIONS = [
  "teamwork",
  "performance",
] as const;

/** Visibility suggestions only — the column is free text (default `'public'`). */
export const REWARDS_VISIBILITY_SUGGESTIONS = ["public", "private"] as const;

/**
 * Redemption status suggestions only — `hr3_reward_redemptions.status` is FREE
 * TEXT (DB default `'pending'`) with no check/enum, so legacy values render
 * as-is and are never rewritten.
 */
export const REWARDS_REDEMPTION_STATUS_SUGGESTIONS = [
  "pending",
  "approved",
  "shipped",
  "fulfilled",
  "rejected",
  "cancelled",
] as const;

/**
 * Server-side representation of a Badge in the live library table
 * `hr3_badges`. This is a CATALOG of badge definitions (no assignment table
 * exists); a badge is assigned to an employee by attaching `badge_id` to an
 * `hr3_recognitions` row (FK verified live). `name` is NOT NULL; `description`
 * and `icon_url` are optional; there are no status/timestamp columns.
 */
export type Badge = {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
};

export type BadgeInput = {
  name: string;
  description?: string | null;
  icon_url?: string | null;
};

export type UpdateBadgeInput = Partial<BadgeInput>;

/** HR-scope presentation enrichment for a Badge (usage count + sample icon). */
export type BadgeListItem = Badge & {
  usageCount: number;
};

/**
 * Server-side representation of a Recognition in the live table
 * `hr3_recognitions`. `sender_id` and `recipient_id` both reference
 * `hr1_employees.id` (verified live). `badge_id` → `hr3_badges.id`.
 * `reason_category` is optional and governed by a DB CHECK constraint.
 * `points` is an integer (default 0) — it records how many points the sender
 * attached to the recognition; it does NOT modify any balance automatically
 * (no DB trigger). `visibility` is free text (default `'public'`). There is no
 * status/approval/updated_at column, so a recognition is a posted, historical
 * record (create + read only).
 */
export type Recognition = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  badge_id: string | null;
  reason_category: string | null;
  points: number;
  visibility: string;
  created_at: string;
};

export type RecognitionInput = {
  sender_id: string;
  recipient_id: string;
  message?: string | null;
  badge_id?: string | null;
  reason_category?: string | null;
  points?: number | null;
  visibility?: string | null;
};

/**
 * HR-scope presentation enrichment for a Recognition. Names/employee numbers
 * are resolved server-side from the referenced `hr1_employees` rows and the
 * badge from `hr3_badges`. Unknown `reason_category` values are preserved raw
 * (display-only neutral tone).
 */
export type RecognitionListItem = Recognition & {
  senderName: string;
  senderNumber: string;
  recipientName: string;
  recipientNumber: string;
  badgeName: string | null;
  badgeIconUrl: string | null;
};

/**
 * Server-side representation of an employee's point BALANCE in the live table
 * `hr3_employee_points`. One row per employee (unique `employee_id`, verified
 * live). `total_points` is an integer stored directly (default 0); the DB has
 * no non-negative check, enforced as application semantics here. `updated_at`
 * has no trigger — the server stamps it on every change. There is no points
 * transaction/ledger table and no automatic linkage to recognitions or
 * redemptions.
 */
export type EmployeePoints = {
  id: string;
  employee_id: string;
  total_points: number;
  updated_at: string;
};

export type SetPointsInput = {
  employee_id: string;
  total_points?: number | null;
  delta?: number | null;
};

/** HR-scope presentation enrichment for an employee point balance. */
export type EmployeePointsListItem = EmployeePoints & {
  employeeName: string;
  employeeNumber: string;
  employeeDepartment: string | null;
  employeeStatus: string | null;
};

/**
 * Server-side representation of a Rewards Redemption in the live table
 * `hr3_reward_redemptions`. `employee_id` → `hr1_employees.id`.
 * `reward_description` is FREE TEXT (no reward catalog table exists); it is
 * optional. `points_used` is an integer (no DB check); `status` is FREE TEXT
 * (default `'pending'`); `requested_at` defaults to now(); `processed_at` is
 * optional and set by the server when a redemption is processed. The schema has
 * no linkage between redemptions and `hr3_employee_points` (no trigger/FK), so
 * the balance is NOT auto-adjusted here; it is managed explicitly by HR.
 */
export type RewardRedemption = {
  id: string;
  employee_id: string;
  points_used: number;
  reward_description: string | null;
  status: string;
  requested_at: string;
  processed_at: string | null;
};

export type RedemptionInput = {
  employee_id: string;
  points_used: number;
  reward_description?: string | null;
  status?: string | null;
};

/**
 * Only the editable redemption fields. `employee_id` and `points_used` are
 * immutable (they describe the original request); `status` + `reward_description`
 * may change, and `processed_at` is stamped server-side when status changes.
 */
export type UpdateRedemptionInput = {
  status?: string;
  reward_description?: string | null;
};

/** HR-scope presentation enrichment for a reward redemption. */
export type RedemptionListItem = RewardRedemption & {
  employeeName: string;
  employeeNumber: string;
  employeeDepartment: string | null;
  employeeStatus: string | null;
};

/** DISPLAY-ONLY tone for a recognition reason category (free-value-safe). */
export function recognitionCategoryTone(category: string | null): string {
  switch ((category ?? "").trim().toLowerCase()) {
    case "teamwork":
      return "bg-accent/10 text-accent";
    case "performance":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default:
      return "bg-line text-muted";
  }
}

/** DISPLAY-ONLY tone for a redemption status (free-value-safe). */
export function redemptionStatusTone(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "approved":
      return "bg-accent/10 text-accent";
    case "fulfilled":
    case "shipped":
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "rejected":
    case "cancelled":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

/* =====================================================================
 * DEVELOPMENT PLANNING (read-only aggregation view)
 * ===================================================================== */

/** Identity shown in the Development Planning employee profile. */
export type DevelopmentEmployee = {
  id: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  jobPosition: string | null;
};

/**
 * One competency development need for an employee. Only surfaced when the
 * server-computed gap (effective_required_level − current_level) is a
 * positive integer — read-only; never derived into score changes.
 */
export type DevelopmentNeed = {
  competencyId: string;
  competencyName: string;
  competencyCategory: string | null;
  currentLevel: number;
  effectiveRequiredLevel: number | null;
  gap: number;
};

/** Course enrollment surfaced as learning evidence (read-only context). */
export type DevelopmentCourseEnrollment = CourseEnrollment & {
  courseTitle: string | null;
  competencyName: string | null;
};

/** Training enrollment surfaced as learning evidence with session context. */
export type DevelopmentTrainingEnrollment = TrainingEnrollment & {
  sessionTitle: string | null;
  scheduleDate: string | null;
  trainerName: string | null;
  mode: string | null;
  venue: string | null;
  competencyName: string | null;
};

/** Certification surfaced for the employee (read-only). */
export type DevelopmentCertification = Certification & {
  courseTitle: string | null;
};

/** Succession-specific context; only present when the employee is a candidate. */
export type DevelopmentSuccessionContext = {
  isCandidate: boolean;
  developmentNotes: string | null;
};

/** Full Development Planning profile for one employee. */
export type DevelopmentProfile = {
  employee: DevelopmentEmployee;
  developmentNeeds: DevelopmentNeed[];
  /** Appraisal-derived development actions (read-only follow-through). */
  developmentActions: DevelopmentActionItem[];
  learning: {
    courseEnrollments: DevelopmentCourseEnrollment[];
    trainingEnrollments: DevelopmentTrainingEnrollment[];
    certifications: DevelopmentCertification[];
  };
  goals: PerformanceGoal[];
  succession: DevelopmentSuccessionContext | null;
};

/* =====================================================================
 * DEVELOPMENT PLAN ITEMS (appraisal-linked, employee-authored actions)
 * ===================================================================== */

/** Status vocabulary for a development plan item. */
export const DEV_PLAN_ITEM_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type DevPlanItemStatus = (typeof DEV_PLAN_ITEM_STATUSES)[number];

export const DEV_PLAN_ITEM_STATUS_LABELS: Record<DevPlanItemStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

/**
 * One development plan item linked to an appraisal.
 *
 * Represents the client form row: ACTIONS TO BE TAKEN | TARGET | STATUS.
 * The employee specifies actions to support goals, develop competencies,
 * and perform job responsibilities.
 */
export type DevelopmentPlanItem = {
  id: string;
  appraisal_id: string;
  employee_id: string;
  action: string;
  target: string;
  status: DevPlanItemStatus;
  created_at: string;
  updated_at: string;
};

/** Input for creating a new development plan item. */
export type CreateDevelopmentPlanItemInput = {
  action: string;
  target: string;
  status?: DevPlanItemStatus;
};

/** Input for updating an existing development plan item. */
export type UpdateDevelopmentPlanItemInput = {
  action?: string;
  target?: string;
  status?: DevPlanItemStatus;
};

/**
 * One appraisal development action surfaced in the HR Development Profile
 * (read-only follow-through view). The item row itself plus the source
 * appraisal context (review period, status, cycle name) — all existing data,
 * no new fields. The finalized appraisal record is never modified; this is a
 * presentation of the same rows managed inside the appraisal workflow.
 */
export type DevelopmentActionItem = {
  id: string;
  appraisal_id: string;
  action: string;
  target: string;
  status: DevPlanItemStatus;
  created_at: string;
  updated_at: string;
  appraisalReviewPeriod: string | null;
  appraisalStatus: string | null;
  appraisalCycleName: string | null;
};

/* =====================================================================
 * MY DEVELOPMENT (employee self-scope, read-only aggregation view)
 * ===================================================================== */

/**
 * One competency in the employee's own development view. Narrow projection
 * of the existing profile model: display fields plus the server-derived
 * required level and gap. No assessor attribution, no other employees.
 */
export type MyDevelopmentCompetency = {
  competencyId: string;
  competencyName: string;
  competencyCategory: string | null;
  currentLevel: number;
  effectiveRequiredLevel: number | null;
  gap: number | null;
};

/** Own course enrollment with display labels (narrow, read-only). */
export type MyDevelopmentCourseEnrollment = {
  id: string;
  courseId: string;
  courseTitle: string | null;
  competencyName: string | null;
  progressPercent: number;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
};

/**
 * Own training enrollment with session context (narrow, read-only).
 * Approver identity is intentionally omitted.
 */
export type MyDevelopmentTrainingEnrollment = {
  id: string;
  sessionId: string;
  sessionTitle: string | null;
  scheduleDate: string | null;
  trainerName: string | null;
  mode: string | null;
  venue: string | null;
  competencyName: string | null;
  approvalStatus: string;
  attendanceStatus: string | null;
};

/** Own certification (narrow, read-only). */
export type MyDevelopmentCertification = {
  id: string;
  courseTitle: string | null;
  certificateUrl: string | null;
  issuedAt: string;
  expiresAt: string | null;
};

export type MyDevelopmentSummary = {
  openDevelopmentActions: number;
  competencyGaps: number;
  learningInProgress: number;
  certifications: number;
};

/**
 * Employee self-scope development payload. Intentionally narrow: own
 * finalized-history actions, own competencies, own learning summary, own
 * certifications. No succession, no other employees, no HR attribution.
 */
export type MyDevelopmentData = {
  developmentActions: DevelopmentActionItem[];
  competencies: MyDevelopmentCompetency[];
  learning: {
    courseEnrollments: MyDevelopmentCourseEnrollment[];
    trainingEnrollments: MyDevelopmentTrainingEnrollment[];
  };
  certifications: MyDevelopmentCertification[];
  summary: MyDevelopmentSummary;
};

/* =====================================================================
 * REPORTS & ANALYTICS (read-only, HR-admin-only org-wide snapshot)
 * ===================================================================== */

/**
 * Query parameters accepted by the Reports & Analytics endpoint. Filters are
 * selection scope only — they are validated server-side and are NEVER used as
 * an authorization source.
 */
export type PerformanceReportsQuery = {
  /** Exact-ish match on `hr1_employees.department` (compared case-insensitively). */
  department?: string | null;
  /** `hr1_job_positions.id` (validated as a UUID + existing position). */
  position_id?: string | null;
  /** `hr3_performance_cycles.id` (validated as a UUID + existing cycle). */
  cycle_id?: string | null;
};

/** The filters that were actually applied, echoed back for the UI/CSV. */
export type ReportsFilterSelection = {
  department: string | null;
  positionId: string | null;
  positionTitle: string | null;
  cycleId: string | null;
  cycleName: string | null;
};

/** Minimal filter-option records for the department/position/cycle controls. */
export type ReportDepartmentOption = {
  department: string;
};

export type ReportCycleOption = {
  id: string;
  name: string;
  status: string;
};

export type ReportCurrentCycle = {
  id: string;
  name: string;
  status: string;
  stage: string;
};

/** One entry in a labeled count list (display-ready label + count). */
export type ReportLabeledCount = {
  label: string;
  count: number;
};

/* ------------------------------------------------------------------ */

/** Final-score distribution across the APPROVED rating bands. */
export type ReportBandDistribution = {
  key: PerformanceRatingBandKey;
  label: string;
  rank: number;
  count: number;
};

/**
 * Performance Scores section.
 *
 * Only `finalized`/`acknowledged` appraisals contribute to the official score
 * distribution and averages. Legacy `reviewed` rows are never promoted into a
 * live status or an official score. `self_rating` / training are never implied.
 */
export type ReportPerformanceScores = {
  totalAppraisals: number;
  officiallyCompleted: number;
  averageFinalScore: number | null;
  /** officiallyCompleted / totalAppraisals, as a 0..100 percent. */
  completionRate: number | null;
  /** Raw status counts with display labels (incl. legacy display labels). */
  byStatus: ReportLabeledCount[];
  /** All five approved bands, zero-filled. */
  distribution: ReportBandDistribution[];
};

/* ------------------------------------------------------------------ */

export type ReportGoals = {
  totalGoals: number;
  byStatus: ReportLabeledCount[];
  averageProgress: number | null;
  /** Breakdowns are included only when the underlying data supports them. */
  byDepartment: ReportLabeledCount[];
  byPosition: ReportLabeledCount[];
  byCycle: ReportLabeledCount[];
};

/* ------------------------------------------------------------------ */

/** One competency with positive (current < required) gaps in scope. */
export type ReportCompetencyGap = {
  competencyId: string;
  competencyName: string;
  category: string | null;
  positiveGapCount: number;
  averageGap: number | null;
};

/**
 * Competencies section. Uses the existing latest-assessment-per-competency
 * profile logic; `current_level` here is the competency assessment level, NOT
 * an appraisal competency rating.
 */
export type ReportCompetencies = {
  employeesAssessed: number;
  assessments: number;
  averageCurrentLevel: number | null;
  positiveGapCount: number;
  /** false → "No competency assessments available". */
  hasAssessments: boolean;
  /** false (but hasAssessments) → "No gaps identified". */
  hasPositiveGaps: boolean;
  gapsByCompetency: ReportCompetencyGap[];
};

/* ------------------------------------------------------------------ */

export type ReportCourseEnrollmentCounts = {
  total: number;
  enrolled: number;
  inProgress: number;
  completed: number;
  completionRate: number | null;
};

export type ReportTrainingEnrollmentCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  attended: number;
  absent: number;
};

export type ReportTrainingEvaluations = {
  total: number;
  rated: number;
  averageRating: number | null;
};

/**
 * Learning & Development section. Learning never changes a performance score;
 * these metrics are informational only.
 */
export type ReportLearning = {
  courses: number;
  trainingSessions: number;
  courseEnrollments: ReportCourseEnrollmentCounts;
  trainingEnrollments: ReportTrainingEnrollmentCounts;
  trainingEvaluations: ReportTrainingEvaluations;
  certifications: number;
};

/* ------------------------------------------------------------------ */

/**
 * Succession section. `risk_level`/`readiness_level` are stored free text and
 * are counted/rendered as-is (never rewritten, never derived into timelines or
 * manager relationships).
 */
export type ReportSuccession = {
  criticalPositionCount: number;
  byRisk: ReportLabeledCount[];
  candidateCount: number;
  candidatesPerPosition: ReportLabeledCount[];
  readinessMix: ReportLabeledCount[];
  averagePotentialRating: number | null;
};

/* ------------------------------------------------------------------ */

export type ReportBadgeUsage = {
  badgeId: string;
  badgeName: string;
  usageCount: number;
};

export type ReportRecognitionByMonth = {
  /** `YYYY-MM` key derived from `created_at`. */
  month: string;
  count: number;
};

/**
 * Recognition & Rewards section. No reward catalog exists, so no payout/cost
 * can ever be calculated. No reward economy is invented.
 */
export type ReportRecognition = {
  recognitionCount: number;
  pointsAwarded: number;
  recognitionsByMonth: ReportRecognitionByMonth[];
  badgeUsage: ReportBadgeUsage[];
  redemptionTotal: number;
  redemptionsByStatus: ReportLabeledCount[];
};

/* ------------------------------------------------------------------ */

export type ReportRecentActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
};

/** Full Reports & Analytics server snapshot (single endpoint). */
export type PerformanceReportsSnapshot = {
  generatedAt: string;
  filters: ReportsFilterSelection;
  currentCycle: ReportCurrentCycle | null;
  filterOptions: {
    departments: string[];
    positions: JobPositionOption[];
    cycles: ReportCycleOption[];
  };
  performanceScores: ReportPerformanceScores;
  goals: ReportGoals;
  competencies: ReportCompetencies;
  learning: ReportLearning;
  succession: ReportSuccession;
  recognition: ReportRecognition;
  recentActivity: ReportRecentActivityItem[];
};

/* ------------------------------------------------------------------ */
/*  PerDev Notifications                                               */
/* ------------------------------------------------------------------ */

export const PERDEV_NOTIFICATION_TYPES = [
  "appraisal.created",
  "appraisal.self_assessment_submitted",
  "appraisal.manager_assessment_submitted",
  "appraisal.finalized",
  "appraisal.acknowledged",
  "checkin.created",
  "checkin.message_posted",
  "checkin.acknowledged",
  "goal.proposal_submitted",
  "goal.proposal_approved",
  "goal.proposal_returned",
  "goal.proposal_rejected",
  "goal.evidence_uploaded",
  "goal.completion_confirmed",
] as const;

export type PerDevNotificationType =
  (typeof PERDEV_NOTIFICATION_TYPES)[number];

export type PerDevNotification = {
  id: string;
  recipient_employee_id: string;
  actor_employee_id: string | null;
  actor_hr_admin_id: string | null;
  title: string;
  message: string;
  type: PerDevNotificationType;
  link: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

/* =====================================================================
 * FEEDBACK REQUESTS (Phase 1: separate request model)
 * ===================================================================== */

/**
 * A feedback request represents: "Employee A is requesting feedback from
 * Employee B about Employee A." The requested feedback is ABOUT the
 * requester (`requester_employee_id`); the recipient (`recipient_employee_id`)
 * is the person asked to provide it.
 *
 * Lifecycle: `pending` → `fulfilled` (response recorded) or `pending` →
 * `declined`. `fulfilled` / `declined` are terminal.
 *
 * Stored in the dedicated `hr3_performance_feedback_requests` table.
 * `hr3_performance_feedback` (check_in / recognition / coaching /
 * improvement) is never used for requests.
 */
export {
  MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH,
  MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH,
} from "@/performance-development-dashboard/lib/constants";

/** Status vocabulary for a feedback request (DB CHECK-enforced). */
export const FEEDBACK_REQUEST_STATUSES = [
  "pending",
  "fulfilled",
  "declined",
] as const;

export type FeedbackRequestStatus =
  (typeof FEEDBACK_REQUEST_STATUSES)[number];

export const FEEDBACK_REQUEST_STATUS_LABELS: Record<
  FeedbackRequestStatus,
  string
> = {
  pending: "Pending",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

/**
 * Server-side representation of one Feedback Request row in
 * `hr3_performance_feedback_requests`.
 *
 * `requester_employee_id` and `recipient_employee_id` both reference
 * `hr1_employees.id` (verified by FK). `request_message` is the optional
 * context the requester attached; `response_message` is the feedback response
 * recorded on fulfillment (null when pending, may remain null on decline).
 * `responded_at` is stamped when the request leaves `pending`.
 */
export type PerformanceFeedbackRequest = {
  id: string;
  requester_employee_id: string;
  recipient_employee_id: string;
  status: FeedbackRequestStatus;
  request_message: string | null;
  response_message: string | null;
  requested_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Input for creating a feedback request. The requester is always the
 * authenticated employee, resolved server-side — it is never client-supplied.
 */
export type FeedbackRequestCreateInput = {
  recipient_employee_id: string;
  request_message?: string | null;
};

/**
 * Input for responding to a feedback request. `decision` selects the terminal
 * state; `response_message` carries the feedback on fulfillment and is
 * optional on decline.
 */
export type FeedbackRequestRespondInput = {
  decision: Exclude<FeedbackRequestStatus, "pending">;
  response_message?: string | null;
};

/**
 * Presentation enrichment for a Feedback Request. Names/employee numbers are
 * resolved server-side from the referenced `hr1_employees` rows. Enrichment
 * is display-only and never used for authorization.
 */
export type FeedbackRequestListItem = PerformanceFeedbackRequest & {
  requesterName: string;
  requesterNumber: string;
  recipientName: string;
  recipientNumber: string;
};
