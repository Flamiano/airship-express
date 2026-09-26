-- ============================================================================
-- FTM Database Schema Normalization Migration
-- Removes duplicate attributes from bookings, route_plans, and trips tables
-- Safe to run multiple times - all operations are idempotent
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create Junction Table for Multiple Bookings per Route Plan
-- ============================================================================
-- This allows one route plan to contain multiple bookings (and vice versa)
-- while maintaining backward compatibility with existing one-to-one relationships

CREATE TABLE IF NOT EXISTS public.route_plan_bookings (
  route_plan_id uuid NOT NULL,
  booking_id text NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (route_plan_id, booking_id),
  CONSTRAINT route_plan_bookings_route_plan_fkey 
    FOREIGN KEY (route_plan_id) REFERENCES public.route_plans(id) ON DELETE CASCADE,
  CONSTRAINT route_plan_bookings_booking_fkey 
    FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

-- Index for fast lookup by booking_id
CREATE INDEX IF NOT EXISTS idx_route_plan_bookings_booking_id 
  ON public.route_plan_bookings(booking_id);

-- Migrate existing data from bookings.route_plan_id to junction table
-- Only add if not already present
INSERT INTO public.route_plan_bookings (route_plan_id, booking_id)
SELECT DISTINCT b.route_plan_id, b.id
FROM public.bookings b
WHERE b.route_plan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.route_plan_bookings rpb 
    WHERE rpb.route_plan_id = b.route_plan_id 
      AND rpb.booking_id = b.id
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: Add Deprecated Columns (Bridge for Existing Code)
-- Keep old columns but mark them as deprecated - will be removed in Step 4
-- ============================================================================

DO $$
BEGIN
  -- Add deprecated columns to bookings if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' 
      AND column_name = '_deprecated_courier'
  ) THEN
    ALTER TABLE public.bookings 
      ADD COLUMN _deprecated_courier text,
      ADD COLUMN _deprecated_driver_id text,
      ADD COLUMN _deprecated_driver_name text,
      ADD COLUMN _deprecated_vehicle_id text,
      ADD COLUMN _deprecated_vehicle_plate text;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Ensure Correct Data in Source Tables
-- ============================================================================

-- Make sure route_plans has all necessary columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'route_plans' 
      AND column_name = 'courier'
  ) THEN
    ALTER TABLE public.route_plans ADD COLUMN courier text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'route_plans' 
      AND column_name = 'pickup_location'
  ) THEN
    ALTER TABLE public.route_plans ADD COLUMN pickup_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'route_plans' 
      AND column_name = 'pickup_latitude'
  ) THEN
    ALTER TABLE public.route_plans 
      ADD COLUMN pickup_latitude numeric,
      ADD COLUMN pickup_longitude numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'route_plans' 
      AND column_name = 'delivery_destinations'
  ) THEN
    ALTER TABLE public.route_plans 
      ADD COLUMN delivery_destinations jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Ensure trips has all necessary columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' 
      AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN driver_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' 
      AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN driver_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' 
      AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN vehicle_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' 
      AND column_name = 'vehicle_plate'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN vehicle_plate text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' 
      AND column_name = 'route_plan_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3.5: Backfill Deprecated Columns (After Source Tables Are Ready)
-- ============================================================================

-- Backfill deprecated columns from source tables now that they exist
UPDATE public.bookings b
SET _deprecated_courier = rp.courier
FROM public.route_plans rp
WHERE b.route_plan_id = rp.id
  AND b._deprecated_courier IS NULL;

UPDATE public.bookings b
SET 
  _deprecated_driver_id = t.driver_id,
  _deprecated_driver_name = t.driver_name,
  _deprecated_vehicle_id = t.vehicle_id,
  _deprecated_vehicle_plate = t.vehicle_plate
FROM public.trips t
WHERE b.id = t.booking_id
  AND b._deprecated_driver_id IS NULL;

-- ============================================================================
-- STEP 4: Create Materialized View for Easy Access to All Related Data
-- This helps existing code access all necessary info with a simple join
-- ============================================================================

CREATE OR REPLACE VIEW public.v_booking_with_route_trip AS
SELECT 
  b.id as booking_id,
  b.status as booking_status,
  b.pickup_location as booking_pickup_location,
  b.pickup_latitude as booking_pickup_latitude,
  b.pickup_longitude as booking_pickup_longitude,
  b.delivery_destinations as booking_delivery_destinations,
  b.route_plan_id,
  
  rp.id as route_plan_id_actual,
  rp.courier,
  rp.pickup_location as route_pickup_location,
  rp.pickup_latitude as route_pickup_latitude,
  rp.pickup_longitude as route_pickup_longitude,
  rp.delivery_destinations as route_delivery_destinations,
  rp.distance_km,
  rp.estimated_duration_min,
  rp.route_geojson,
  rp.status as route_plan_status,
  
  t.id as trip_id,
  t.driver_id,
  t.driver_name,
  t.vehicle_id,
  t.vehicle_plate,
  t.status as trip_status,
  t.progress as trip_progress,
  t.estimated_departure,
  t.estimated_arrival,
  t.actual_departure,
  t.actual_arrival
FROM public.bookings b
LEFT JOIN public.route_plans rp ON b.route_plan_id = rp.id
LEFT JOIN public.trips t ON rp.trip_id = t.id OR (t.booking_id = b.id AND t.booking_id IS NOT NULL);

-- ============================================================================
-- STEP 5: Create Convenience Functions
-- ============================================================================

-- Function to get courier for a booking (with fallback chain)
CREATE OR REPLACE FUNCTION public.fn_get_booking_courier(booking_id text)
RETURNS text AS $$
DECLARE
  courier_name text;
BEGIN
  -- Try: route_plan.courier
  SELECT rp.courier INTO courier_name
  FROM public.route_plans rp
  WHERE rp.id = (SELECT route_plan_id FROM public.bookings WHERE id = booking_id)
  LIMIT 1;
  
  IF courier_name IS NOT NULL THEN
    RETURN courier_name;
  END IF;
  
  -- Fallback: _deprecated_courier
  SELECT _deprecated_courier INTO courier_name
  FROM public.bookings
  WHERE id = booking_id;
  
  RETURN COALESCE(courier_name, 'Unassigned');
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get driver info for a booking
CREATE OR REPLACE FUNCTION public.fn_get_booking_driver(booking_id text)
RETURNS TABLE(driver_id text, driver_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.driver_id, t.driver_name
  FROM public.trips t
  WHERE t.booking_id = booking_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get vehicle info for a booking
CREATE OR REPLACE FUNCTION public.fn_get_booking_vehicle(booking_id text)
RETURNS TABLE(vehicle_id text, vehicle_plate text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.vehicle_id, t.vehicle_plate
  FROM public.trips t
  WHERE t.booking_id = booking_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- STEP 6: Add Helpful Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_route_plan_id 
  ON public.bookings(route_plan_id);

CREATE INDEX IF NOT EXISTS idx_route_plans_courier 
  ON public.route_plans(courier);

CREATE INDEX IF NOT EXISTS idx_route_plans_trip_id 
  ON public.route_plans(trip_id);

CREATE INDEX IF NOT EXISTS idx_trips_booking_id 
  ON public.trips(booking_id);

CREATE INDEX IF NOT EXISTS idx_trips_route_plan_id 
  ON public.trips(route_plan_id);

CREATE INDEX IF NOT EXISTS idx_trips_driver_id 
  ON public.trips(driver_id);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id 
  ON public.trips(vehicle_id);

-- ============================================================================
-- STEP 7: Create Audit Log Entry (Optional - for tracking changes)
-- ============================================================================

-- Add comment to tables explaining the migration
COMMENT ON TABLE public.route_plan_bookings IS 
  'Junction table for normalized many-to-many relationship between route_plans and bookings. Added 2026-08-14 as part of schema normalization.';

COMMENT ON COLUMN public.bookings._deprecated_courier IS 
  'DEPRECATED: Use route_plans.courier instead. Kept for backward compatibility during migration. Remove in final cleanup phase.';

COMMENT ON COLUMN public.bookings._deprecated_driver_id IS 
  'DEPRECATED: Use trips.driver_id instead. Kept for backward compatibility during migration. Remove in final cleanup phase.';

COMMENT ON COLUMN public.bookings._deprecated_driver_name IS 
  'DEPRECATED: Use trips.driver_name instead. Kept for backward compatibility during migration. Remove in final cleanup phase.';

COMMENT ON COLUMN public.bookings._deprecated_vehicle_id IS 
  'DEPRECATED: Use trips.vehicle_id instead. Kept for backward compatibility during migration. Remove in final cleanup phase.';

COMMENT ON COLUMN public.bookings._deprecated_vehicle_plate IS 
  'DEPRECATED: Use trips.vehicle_plate instead. Kept for backward compatibility during migration. Remove in final cleanup phase.';

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- 
-- ✅ Created route_plan_bookings junction table
--    - Allows multiple bookings per route plan
--    - Migrated existing data automatically
--
-- ✅ Added deprecated columns to bookings (backward compatible)
--    - _deprecated_courier (from route_plans)
--    - _deprecated_driver_id, _deprecated_driver_name (from trips)
--    - _deprecated_vehicle_id, _deprecated_vehicle_plate (from trips)
--
-- ✅ Ensured all source tables have correct columns
--    - route_plans has: courier, pickup_location, delivery_destinations
--    - trips has: driver_id, driver_name, vehicle_id, vehicle_plate
--
-- ✅ Created convenience view: v_booking_with_route_trip
--    - Single query to get all related data
--    - SELECT * FROM v_booking_with_route_trip WHERE booking_id = '...'
--
-- ✅ Created helper functions
--    - fn_get_booking_courier(booking_id)
--    - fn_get_booking_driver(booking_id)
--    - fn_get_booking_vehicle(booking_id)
--
-- ✅ Added indexes for optimal query performance
--
-- NEXT STEPS FOR APPLICATION:
-- 1. Update backend code to read from source tables:
--    - bookings.courier         → SELECT courier FROM route_plans WHERE id = booking.route_plan_id
--    - bookings.driver_id       → SELECT driver_id FROM trips WHERE booking_id = booking.id
--    - bookings.vehicle_plate   → SELECT vehicle_plate FROM trips WHERE booking_id = booking.id
--
-- 2. Update missions/page.tsx and other frontend code to use view or functions
--    - Replace direct column access with view queries or function calls
--
-- 3. After testing (1-2 weeks):
--    - Run FINAL_CLEANUP.sql to remove deprecated columns
--    - Drop junction table if not needed
--    - Archive this migration log
--
-- ============================================================================

COMMIT;
