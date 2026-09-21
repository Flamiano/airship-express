-- READ-ONLY: Duplicate check before applying unique constraints.
-- Run this against the Supabase database to verify no duplicates exist.
-- Do NOT modify any data.

-- 1. Goal results: find (appraisal_id, goal_id) groups with count > 1
SELECT
  appraisal_id,
  goal_id,
  COUNT(*) AS duplicate_count
FROM hr3_performance_appraisal_goal_results
GROUP BY appraisal_id, goal_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Competency results: find (appraisal_id, competency_id) groups with count > 1
SELECT
  appraisal_id,
  competency_id,
  COUNT(*) AS duplicate_count
FROM hr3_performance_appraisal_competency_results
GROUP BY appraisal_id, competency_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Total row counts for reference
SELECT 'goal_results' AS table_name, COUNT(*) AS total_rows FROM hr3_performance_appraisal_goal_results
UNION ALL
SELECT 'competency_results', COUNT(*) FROM hr3_performance_appraisal_competency_results;
