-- Prevent duplicate L&D records via database-level UNIQUE protection.
--
-- Each business rule enforces one record per employee per course/session:
--   1. One course enrollment per employee per course.
--   2. One training enrollment per employee per training session.
--   3. One training evaluation per employee per training session.
--
-- The companion diagnostic script (supabase/scripts/check_ld_duplicates_before_unique_constraints.sql)
-- confirmed zero duplicates across all three tables before this migration.

-- 1. Course enrollments: one enrollment per employee per course.
CREATE UNIQUE INDEX uq_course_enrollments_employee_course
ON hr3_course_enrollments (employee_id, course_id);

-- 2. Training enrollments: one enrollment per employee per training session.
CREATE UNIQUE INDEX uq_training_enrollments_employee_session
ON hr3_training_enrollments (employee_id, session_id);

-- 3. Training evaluations: one evaluation per employee per training session.
CREATE UNIQUE INDEX uq_training_evaluations_session_employee
ON hr3_training_evaluations (session_id, employee_id);
