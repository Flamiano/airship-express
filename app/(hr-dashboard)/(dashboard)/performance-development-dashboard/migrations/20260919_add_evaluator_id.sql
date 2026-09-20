-- Add evaluator_id to hr3_performance_appraisals.
-- Nullable for backward compatibility with existing rows.
-- Represents the manager/evaluator responsible for the employee's performance assessment.
ALTER TABLE hr3_performance_appraisals
ADD COLUMN evaluator_id uuid REFERENCES hr1_employees(id);

-- Partial index for authorization queries (skip NULLs).
CREATE INDEX idx_appraisals_evaluator_id
ON hr3_performance_appraisals(evaluator_id)
WHERE evaluator_id IS NOT NULL;
