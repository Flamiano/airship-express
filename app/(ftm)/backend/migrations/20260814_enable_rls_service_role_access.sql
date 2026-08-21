-- Enable RLS service role access for vehicles and other tables
-- This migration allows service-role authenticated requests to read/write data
-- Run this via Supabase SQL Editor

-- Enable RLS on tables (idempotent)
-- Note: parcels table is in a separate PARCELS_SUPABASE_URL project, so we skip it here
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.route_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "allow_service_role_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "allow_authenticated_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "allow_service_role_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_authenticated_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_service_role_bookings" ON public.bookings;
DROP POLICY IF EXISTS "allow_authenticated_bookings" ON public.bookings;
DROP POLICY IF EXISTS "allow_service_role_users" ON public.users;
DROP POLICY IF EXISTS "allow_authenticated_users" ON public.users;
DROP POLICY IF EXISTS "allow_service_role_cost_entries" ON public.cost_entries;
DROP POLICY IF EXISTS "allow_authenticated_cost_entries" ON public.cost_entries;
DROP POLICY IF EXISTS "allow_service_role_route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "allow_authenticated_route_plans" ON public.route_plans;

-- Create policies for vehicles table (allow service role and authenticated users)
CREATE POLICY "allow_service_role_vehicles" ON public.vehicles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for trips table
CREATE POLICY "allow_service_role_trips" ON public.trips
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for bookings table
CREATE POLICY "allow_service_role_bookings" ON public.bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for users table
CREATE POLICY "allow_service_role_users" ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for cost_entries table
CREATE POLICY "allow_service_role_cost_entries" ON public.cost_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for route_plans table
CREATE POLICY "allow_service_role_route_plans" ON public.route_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);
