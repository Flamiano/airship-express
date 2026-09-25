-- Canonical FTM alert lifecycle and append-only alert history.
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','DISMISSED','EXPIRED')),
  source_type text NOT NULL,
  source_id text NOT NULL,
  driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  vehicle_id text,
  trip_id text,
  booking_id text,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action_required boolean NOT NULL DEFAULT false,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text,
  new_status text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_status_created_at_idx ON public.alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_severity_idx ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS alerts_source_idx ON public.alerts(source_type, source_id);
CREATE INDEX IF NOT EXISTS alerts_driver_idx ON public.alerts(driver_id);
CREATE INDEX IF NOT EXISTS alerts_vehicle_idx ON public.alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS alerts_trip_idx ON public.alerts(trip_id);
CREATE INDEX IF NOT EXISTS alert_history_created_at_idx ON public.alert_history(created_at DESC);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_service_role ON public.alerts;
CREATE POLICY alerts_service_role ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS alert_history_service_role ON public.alert_history;
CREATE POLICY alert_history_service_role ON public.alert_history FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS alerts_authenticated_read ON public.alerts;
CREATE POLICY alerts_authenticated_read ON public.alerts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role IN ('admin', 'dispatcher', 'fleet_manager') OR alerts.driver_id = auth.uid())
  )
);
DROP POLICY IF EXISTS alert_history_authenticated_read ON public.alert_history;
CREATE POLICY alert_history_authenticated_read ON public.alert_history FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'dispatcher', 'fleet_manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.alerts a
    WHERE a.id = alert_history.alert_id AND a.driver_id = auth.uid()
  )
);
