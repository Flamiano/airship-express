-- Employee goal proposal + manager approval workflow on hr3_performance_goals.
--
-- Adds an approval lifecycle that is SEPARATE from the existing execution
-- status (not_started/in_progress/pending_completion/completed), which keeps
-- its completion-only meaning. New columns:
--
--   approval_status  draft | pending_manager_approval | approved | returned | rejected
--   submitted_at     when the owner last submitted the proposal
--   reviewed_at      when the reviewer last reviewed it
--   reviewed_by      hr1_employees.id of the reviewing manager/HR admin (server-derived)
--   review_note      reviewer note (required on return/reject, optional on approve)
--
-- BACKFILL ORDERING (critical): the column is added NULLABLE first so no
-- default is imposed, existing rows are explicitly backfilled to 'approved'
-- (they entered through manager/HR channels and remain official goals), and
-- only then is NOT NULL + DEFAULT 'draft' established. New employee proposals
-- are 'draft'; new manager/HR-created goals are written explicitly as
-- 'approved' by the application. The 'draft' DB default is a fail-closed
-- safety net for out-of-band inserts, never relied upon by the app.
--
-- No historical progress, check-in snapshots, or appraisal history are
-- rewritten by this migration.

-- 1. Approval lifecycle column, added nullable first (no implicit default).
ALTER TABLE hr3_performance_goals
  ADD COLUMN approval_status text;

-- 2. Backfill: every pre-existing goal is an official (approved) goal.
UPDATE hr3_performance_goals
  SET approval_status = 'approved'
  WHERE approval_status IS NULL;

-- 3. Enforce presence; fail closed to 'draft' for future out-of-band inserts.
ALTER TABLE hr3_performance_goals
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE hr3_performance_goals
  ALTER COLUMN approval_status SET DEFAULT 'draft';

-- 4. Approval vocabulary.
ALTER TABLE hr3_performance_goals
  ADD CONSTRAINT chk_goal_approval_status
    CHECK (
      approval_status IN (
        'draft',
        'pending_manager_approval',
        'approved',
        'returned',
        'rejected'
      )
    );

-- 5. Review audit columns (all nullable; reviewed_by references the
-- employee identity of the reviewer, matching the competencies assessor
-- convention where actor identity is an hr1_employees.id).
ALTER TABLE hr3_performance_goals
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES hr1_employees(id),
  ADD COLUMN review_note text;

-- 6. Proposal queue lookup: goals of an employee by approval state.
CREATE INDEX IF NOT EXISTS idx_perf_goals_employee_approval
  ON hr3_performance_goals (employee_id, approval_status);

-- 7. Notification vocabulary extension for the proposal workflow.
-- The original CHECK constraint carries an auto-generated name, so it is
-- dropped by lookup (matching any CHECK on the table that mentions a known
-- existing type) and re-added with the four goal.proposal_* values included.
-- Re-running this block is safe: it drops the current vocabulary CHECK
-- (whichever generation) and re-adds the same target definition.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'hr3_performance_notifications'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%appraisal.created%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE hr3_performance_notifications DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END
$$;

ALTER TABLE hr3_performance_notifications
  ADD CONSTRAINT chk_perdev_notification_type
    CHECK (type IN (
      'appraisal.created',
      'appraisal.self_assessment_submitted',
      'appraisal.manager_assessment_submitted',
      'appraisal.finalized',
      'appraisal.acknowledged',
      'checkin.created',
      'checkin.message_posted',
      'checkin.acknowledged',
      'goal.proposal_submitted',
      'goal.proposal_approved',
      'goal.proposal_returned',
      'goal.proposal_rejected'
    ));
