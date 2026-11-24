BEGIN;

ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_route_plans ON public.route_plans;
CREATE POLICY allow_service_role_route_plans
  ON public.route_plans
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_bookings ON public.bookings;
CREATE POLICY allow_service_role_bookings
  ON public.bookings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_fuel_logs ON public.fuel_logs;
CREATE POLICY allow_service_role_fuel_logs
  ON public.fuel_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_cost_entries ON public.cost_entries;
CREATE POLICY allow_service_role_cost_entries
  ON public.cost_entries
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_users ON public.users;
CREATE POLICY allow_service_role_users
  ON public.users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_vehicles ON public.vehicles;
CREATE POLICY allow_service_role_vehicles
  ON public.vehicles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_service_role_trips ON public.trips;
CREATE POLICY allow_service_role_trips
  ON public.trips
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can create booking assignments"
  ON public.booking_assignments;

COMMIT;
