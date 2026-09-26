-- ============================================================================
-- QUICK FIX: Disable Row Level Security on FTM tables
-- Paste this in Supabase SQL Editor and run
-- ============================================================================

BEGIN;

-- Disable RLS on all tables to allow service-role writes
ALTER TABLE public.route_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries DISABLE ROW LEVEL SECURITY;

COMMIT;
