-- Development Plan Items
-- Stores the employee's development plan actions linked to an appraisal.
-- Columns mirror the client form: ACTIONS TO BE TAKEN | TARGET | STATUS

CREATE TABLE IF NOT EXISTS hr3_performance_development_plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  uuid NOT NULL REFERENCES hr3_performance_appraisals(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES hr1_employees(id),
  action        text NOT NULL,
  target        text NOT NULL,
  status        text NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One appraisal can have many development plan items (ordered list).
CREATE INDEX IF NOT EXISTS idx_dev_plan_items_appraisal
  ON hr3_performance_development_plan_items (appraisal_id);

-- Authorization scoping: look up items by employee.
CREATE INDEX IF NOT EXISTS idx_dev_plan_items_employee
  ON hr3_performance_development_plan_items (employee_id);
