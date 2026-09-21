-- READ-ONLY: L&D duplicate check before applying unique constraints.
-- Run this against the Supabase database to verify no duplicates exist.
-- Do NOT modify any data.
--
-- These queries identify duplicate groups that would prevent adding
-- UNIQUE constraints. Review the results carefully before proceeding.

-- 1. Training evaluations: find (session_id, employee_id) groups with count > 1
--    Business rule: one evaluation per employee per training session.
SELECT
  session_id,
  employee_id,
  COUNT(*) AS duplicate_count
FROM hr3_training_evaluations
GROUP BY session_id, employee_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Training enrollments: find (employee_id, session_id) groups with count > 1
--    Business rule: one enrollment per employee per training session.
SELECT
  employee_id,
  session_id,
  COUNT(*) AS duplicate_count
FROM hr3_training_enrollments
GROUP BY employee_id, session_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Course enrollments: find (employee_id, course_id) groups with count > 1
--    Business rule: one enrollment per employee per course.
SELECT
  employee_id,
  course_id,
  COUNT(*) AS duplicate_count
FROM hr3_course_enrollments
GROUP BY employee_id, course_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. Total row counts for reference
SELECT 'training_evaluations' AS table_name, COUNT(*) AS total_rows FROM hr3_training_evaluations
UNION ALL
SELECT 'training_enrollments', COUNT(*) FROM hr3_training_enrollments
UNION ALL
SELECT 'course_enrollments', COUNT(*) FROM hr3_course_enrollments;
