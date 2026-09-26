-- Goal Evidence upload notification vocabulary.
--
-- Extends the PerDev notification CHECK with `goal.evidence_uploaded`,
-- fired best-effort AFTER successful evidence creation to the goal owner's
-- CURRENT active manager (server-resolved via hr1_employees.manager_id).
--
-- Additive/safe: every previously valid type is preserved. Re-running is
-- safe: it drops the current vocabulary CHECK (whichever generation) and
-- re-adds the same target definition. Follows the exact pattern of
-- `20260924_add_goal_approval_workflow.sql` block 7.
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
      'goal.proposal_rejected',
      'goal.evidence_uploaded'
    ));
