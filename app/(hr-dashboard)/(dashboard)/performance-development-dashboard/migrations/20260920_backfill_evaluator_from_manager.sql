-- Evaluator Backfill Migration
-- Backfills evaluator_id for in-flight appraisals that lack an assigned
-- evaluator but whose subject employee has a known manager.
--
-- This is a ONE-TIME backfill for existing data. New appraisals should
-- always have evaluator_id assigned at creation time.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Preview: inspect affected rows before running the UPDATE.
--    Run this SELECT first to review which appraisals will be changed.
-- ──────────────────────────────────────────────────────────────────────

/*
SELECT
  a.id            AS appraisal_id,
  a.employee_id,
  a.status,
  a.evaluator_id  AS current_evaluator_id,
  e.manager_id    AS employee_manager_id
FROM hr3_performance_appraisals a
JOIN hr1_employees e ON e.id = a.employee_id
WHERE a.status IN ('self_assessment', 'manager_assessment')
  AND a.evaluator_id IS NULL
  AND e.manager_id IS NOT NULL;
*/

-- ──────────────────────────────────────────────────────────────────────
-- 2. Backfill: set evaluator_id = employee's manager_id for appraisals
--    where evaluator_id IS NULL and the employee has a known manager.
--
-- ⚠️  RUN MANUALLY AFTER REVIEW
--    Do NOT execute this migration automatically. Review the preview
--    SELECT above, confirm the affected rows are correct, then run
--    this UPDATE by hand.
-- ──────────────────────────────────────────────────────────────────────

/*
UPDATE hr3_performance_appraisals a
SET evaluator_id = e.manager_id,
    updated_at = now()
FROM hr1_employees e
WHERE e.id = a.employee_id
  AND a.status IN ('self_assessment', 'manager_assessment')
  AND a.evaluator_id IS NULL
  AND e.manager_id IS NOT NULL;
*/
