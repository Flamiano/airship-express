-- Adds frozen applicability snapshot columns to hr3_performance_appraisals.
--
-- When a manager assessment is successfully submitted, the applicable goal and
-- competency ID sets are persisted as JSONB snapshots.  Finalization and the
-- scoring-input read path use these snapshots instead of recomputing the live
-- applicable set, preventing applicability drift when employee competency
-- scores or position requirements change after submission.
--
-- Historical appraisals (NULL snapshots) continue to use the existing live
-- recomputation behavior.

ALTER TABLE hr3_performance_appraisals
  ADD COLUMN applicable_goal_ids_snapshot jsonb,
  ADD COLUMN applicable_competency_ids_snapshot jsonb;

-- Validate the columns are either NULL or a JSON array.  Application-layer
-- code enforces that array elements are valid UUID strings.
ALTER TABLE hr3_performance_appraisals
  ADD CONSTRAINT chk_appraisal_goal_ids_snapshot
    CHECK (
      applicable_goal_ids_snapshot IS NULL
      OR jsonb_typeof(applicable_goal_ids_snapshot) = 'array'
    );

ALTER TABLE hr3_performance_appraisals
  ADD CONSTRAINT chk_appraisal_competency_ids_snapshot
    CHECK (
      applicable_competency_ids_snapshot IS NULL
      OR jsonb_typeof(applicable_competency_ids_snapshot) = 'array'
    );
