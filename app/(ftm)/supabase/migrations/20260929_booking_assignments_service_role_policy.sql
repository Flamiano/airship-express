BEGIN;

ALTER TABLE IF EXISTS public.booking_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_assignments_service_role_access"
  ON public.booking_assignments;

CREATE POLICY "booking_assignments_service_role_access"
  ON public.booking_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.booking_assignments
  TO service_role;

COMMIT;