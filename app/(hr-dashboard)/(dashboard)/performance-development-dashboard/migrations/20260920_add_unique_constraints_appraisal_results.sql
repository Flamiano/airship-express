-- Prevent duplicate goal and competency ratings per appraisal.
-- Each (appraisal_id, goal_id) and (appraisal_id, competency_id) pair must be unique.

-- IMPORTANT: Before executing this migration, run the duplicate-check script
-- (check_duplicates_before_unique_constraints.sql) against the live database.
-- If any duplicates are reported, they must be reviewed and de-duplicated manually
-- before this migration can be applied. Do NOT execute this migration if duplicates exist.

CREATE UNIQUE INDEX uq_appraisal_goal_results_appraisal_goal
ON hr3_performance_appraisal_goal_results (appraisal_id, goal_id);

CREATE UNIQUE INDEX uq_appraisal_competency_results_appraisal_competency
ON hr3_performance_appraisal_competency_results (appraisal_id, competency_id);

-- Cleanup SQL (commented out — do NOT run automatically).
-- Only run after confirming no duplicates remain via the read-only check.
--
-- WITH duplicates AS (
--   SELECT id, ROW_NUMBER() OVER (
--     PARTITION BY appraisal_id, goal_id ORDER BY created_at
--   ) AS rn
--   FROM hr3_performance_appraisal_goal_results
-- )
-- DELETE FROM hr3_performance_appraisal_goal_results
-- WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
--
-- WITH duplicates AS (
--   SELECT id, ROW_NUMBER() OVER (
--     PARTITION BY appraisal_id, competency_id ORDER BY created_at
--   ) AS rn
--   FROM hr3_performance_appraisal_competency_results
-- )
-- DELETE FROM hr3_performance_appraisal_competency_results
-- WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
