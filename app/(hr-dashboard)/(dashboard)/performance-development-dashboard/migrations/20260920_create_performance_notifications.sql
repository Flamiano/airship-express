-- Performance Development Notifications
-- Dedicated notification storage for PerDev workflow events.
-- Recipient-based targeting: each notification is addressed to a specific employee.

CREATE TABLE IF NOT EXISTS hr3_performance_notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_employee_id uuid NOT NULL REFERENCES hr1_employees(id),
  actor_employee_id     uuid NULL REFERENCES hr1_employees(id),
  actor_hr_admin_id     uuid NULL REFERENCES hr_admin(id),
  title                 text NOT NULL,
  message               text NOT NULL,
  type                  text NOT NULL
                        CHECK (type IN (
                          'appraisal.created',
                          'appraisal.self_assessment_submitted',
                          'appraisal.manager_assessment_submitted',
                          'appraisal.finalized',
                          'appraisal.acknowledged',
                          'checkin.created',
                          'checkin.message_posted',
                          'checkin.acknowledged'
                        )),
  link                  text NULL,
  entity_id             uuid NULL,
  is_read               boolean NOT NULL DEFAULT false,
  read_at               timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: notifications for a specific recipient, ordered by recency.
CREATE INDEX IF NOT EXISTS idx_perdev_notifs_recipient_created
  ON hr3_performance_notifications (recipient_employee_id, created_at DESC);

-- Fast unread count: notifications for a specific recipient, unread only.
CREATE INDEX IF NOT EXISTS idx_perdev_notifs_recipient_unread
  ON hr3_performance_notifications (recipient_employee_id, is_read)
  WHERE is_read = false;
