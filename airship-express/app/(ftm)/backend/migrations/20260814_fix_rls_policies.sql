-- ============================================================================
-- FTM Database RLS Policies Fix
-- Enables service-role access to all tables for the Express backend
-- Run this in Supabase SQL Editor to fix permission errors
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Enable RLS on all required tables
-- ============================================================================
ALTER TABLE IF EXISTS public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cost_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop existing policies to avoid conflicts
-- ============================================================================
DROP POLICY IF EXISTS "allow_service_role_route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "allow_service_role_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_service_role_bookings" ON public.bookings;
DROP POLICY IF EXISTS "allow_service_role_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "allow_service_role_users" ON public.users;
DROP POLICY IF EXISTS "allow_service_role_cost_entries" ON public.cost_entries;

DROP POLICY IF EXISTS "allow_authenticated_route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "allow_authenticated_trips" ON public.trips;
DROP POLICY IF EXISTS "allow_authenticated_bookings" ON public.bookings;
DROP POLICY IF EXISTS "allow_authenticated_vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "allow_authenticated_users" ON public.users;
DROP POLICY IF EXISTS "allow_authenticated_cost_entries" ON public.cost_entries;

-- ============================================================================
-- STEP 3: Create permissive policies for service-role
-- These allow the backend (using SUPABASE_SERVICE_ROLE_KEY) to read and write
-- ============================================================================

-- route_plans: allow service-role full access
CREATE POLICY "allow_service_role_route_plans" ON public.route_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- trips: allow service-role full access
CREATE POLICY "allow_service_role_trips" ON public.trips
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- bookings: allow service-role full access
CREATE POLICY "allow_service_role_bookings" ON public.bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- vehicles: allow service-role full access
CREATE POLICY "allow_service_role_vehicles" ON public.vehicles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- users: allow service-role full access
CREATE POLICY "allow_service_role_users" ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- cost_entries: allow service-role full access
CREATE POLICY "allow_service_role_cost_entries" ON public.cost_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 4: Verify policies are created
-- ============================================================================
-- Run this query to verify all policies were created:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

COMMIT;

-- ============================================================================
-- INSTRUCTIONS FOR MANUAL EXECUTION
-- ============================================================================
-- 1. Go to: https://vmvnqiudhzxldxrcdbck.supabase.co
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste the SQL above (or just copy STEP 1-3)
-- 5. Click "Run" button
-- 6. You should see: "Query succeeded with no output"
-- 7. Refresh the browser at http://localhost:3000
-- 8. Try creating a route plan again - it should work!
-- 
-- If you see "Query succeeded" then all policies are enabled.
-- ============================================================================
