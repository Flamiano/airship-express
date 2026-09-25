-- Optional hybrid goal-progress measurement columns on hr3_performance_goals.
--
-- Every existing row keeps working exactly as before: progress_method
-- defaults to 'manual', the measurement columns default to NULL, and a NULL
-- (or 'manual') method means the existing manual progress_percent behavior.
-- No historical progress, check-in snapshots, or appraisal history are
-- rewritten by this migration.
--
-- Measurable goals record target_value/actual_value as double precision and
-- the server derives progress_percent from them; the application layer
-- enforces target > 0 and actual >= 0 in addition to the CHECK constraints
-- below. progress_percent itself keeps its existing range semantics.

ALTER TABLE hr3_performance_goals
  ADD COLUMN progress_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN measurement_type text,
  ADD COLUMN target_value double precision,
  ADD COLUMN actual_value double precision,
  ADD COLUMN measurement_unit varchar(24);

-- Method vocabulary. NULL is not possible (DEFAULT 'manual' backfills
-- existing rows), but the application treats a missing/unknown method as
-- manual for defense in depth.
ALTER TABLE hr3_performance_goals
  ADD CONSTRAINT chk_goal_progress_method
    CHECK (progress_method IN ('manual', 'measurable'));

-- Measurement vocabulary; NULL means "not a measurable goal".
ALTER TABLE hr3_performance_goals
  ADD CONSTRAINT chk_goal_measurement_type
    CHECK (
      measurement_type IS NULL
      OR measurement_type IN ('number', 'currency', 'percentage', 'custom')
    );

-- A measurable target must be positive; NULL means "no measurable target".
ALTER TABLE hr3_performance_goals
  ADD CONSTRAINT chk_goal_target_value
    CHECK (target_value IS NULL OR target_value > 0);

-- Actuals cannot be negative; NULL means "not yet recorded".
ALTER TABLE hr3_performance_goals
  ADD CONSTRAINT chk_goal_actual_value
    CHECK (actual_value IS NULL OR actual_value >= 0);
