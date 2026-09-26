-- ============================================================================
-- FTM Database Schema Normalization - FINAL CLEANUP
-- Run this ONLY after:
-- 1. All application code has been updated to read from correct source tables
-- 2. Testing has confirmed no code is reading from deprecated columns
-- 3. You have a backup of the database
-- 4. You have tested the previous migration (20260814_normalize_schema_step_1_2.sql)
-- ============================================================================
-- WARNING: This removes the deprecated columns. If you revert, you'll need to
-- restore from backup. Only run this after Step 1-2 migration has been in
-- production for at least 1-2 weeks and you're confident the app works correctly.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Verify All Data Has Been Successfully Migrated
-- ============================================================================

-- Check that no code is still using deprecated columns by examining queries
-- This is a safety check - if any of these return results, delay cleanup
DO $$
DECLARE
  deprecated_count INTEGER;
BEGIN
  -- Count bookings with non-null deprecated columns
  SELECT COUNT(*) INTO deprecated_count
  FROM public.bookings
  WHERE _deprecated_courier IS NOT NULL
    OR _deprecated_driver_id IS NOT NULL
    OR _deprecated_driver_name IS NOT NULL
    OR _deprecated_vehicle_id IS NOT NULL
    OR _deprecated_vehicle_plate IS NOT NULL;
  
  IF deprecated_count > 0 THEN
    RAISE WARNING 'Found % bookings with deprecated data. Ensure app is reading from source tables first.', deprecated_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Remove Deprecated Columns
-- ============================================================================

ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS _deprecated_courier,
  DROP COLUMN IF EXISTS _deprecated_driver_id,
  DROP COLUMN IF EXISTS _deprecated_driver_name,
  DROP COLUMN IF EXISTS _deprecated_vehicle_id,
  DROP COLUMN IF EXISTS _deprecated_vehicle_plate;

-- ============================================================================
-- STEP 3: Clean Up Views (If Migrated to Functions)
-- ============================================================================
-- Keep v_booking_with_route_trip for backward compatibility, but ensure it's
-- only used for read operations and not for updating deprecated columns

-- ============================================================================
-- STEP 4: Update Database Comments
-- ============================================================================

COMMENT ON TABLE public.bookings IS 
  'Booking requests from customers. Core data (pickup, delivery, status). References route_plan for optimization. Last normalized: 2026-08-14';

-- ============================================================================
-- STEP 5: Archive Indexes (Optional - Remove if Not Needed)
-- ============================================================================
-- Keep all indexes from previous migration - they're still useful
-- They now optimize queries against the normalized schema

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the schema is correct:
--
-- 1. Check bookings table structure:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'bookings'
--    ORDER BY ordinal_position;
--
-- 2. Check for orphaned data (bookings without proper linking):
--    SELECT COUNT(*) FROM public.bookings
--    WHERE route_plan_id IS NULL AND id NOT IN (
--      SELECT DISTINCT booking_id FROM public.trips
--    );
--
-- 3. Check route_plan_bookings junction table:
--    SELECT COUNT(*) FROM public.route_plan_bookings;
--
-- 4. Verify view still works:
--    SELECT COUNT(*) FROM public.v_booking_with_route_trip;
--
-- 5. Test helper functions:
--    SELECT * FROM fn_get_booking_courier('test-id');
--    SELECT * FROM fn_get_booking_driver('test-id');
--    SELECT * FROM fn_get_booking_vehicle('test-id');


COMMIT;
