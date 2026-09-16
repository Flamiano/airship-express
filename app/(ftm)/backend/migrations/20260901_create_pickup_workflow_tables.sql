-- Parcel Pickup Workflow Migration
-- Creates tables for warehouse parcel pickup route planning system
-- Includes parcels_for_pickup, route_plan_parcels, pickup_events, and locations
-- Safe to run multiple times via IF EXISTS / IF NOT EXISTS guards

BEGIN;

-- ============================================================================
-- 1. Ensure locations table exists (warehouses/pickup locations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.locations
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- ============================================================================
-- 2. Create parcels_for_pickup table
-- Stores parcel information relevant to pickup operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.parcels_for_pickup (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tracking_number VARCHAR(50) NOT NULL UNIQUE,
  sender_name VARCHAR(255) NOT NULL,
  sender_phone VARCHAR(20),
  recipient_name VARCHAR(255) NOT NULL,
  recipient_phone VARCHAR(20),
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10, 8),
  pickup_lng DECIMAL(11, 8),
  parcel_type VARCHAR(50),
  courier VARCHAR(100),
  weight_kg DECIMAL(10, 2),
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (
    status = ANY (ARRAY[
      'received'::text,
      'ready_for_pickup'::text,
      'assigned_to_route'::text,
      'out_for_pickup'::text,
      'picked_up'::text,
      'pickup_failed'::text,
      'cancelled'::text
    ])
  ),
  received_at TIMESTAMP WITH TIME ZONE,
  assigned_route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL,
  last_pickup_attempt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT parcels_for_pickup_pkey PRIMARY KEY (id)
);

-- Create indexes for parcels_for_pickup
CREATE INDEX IF NOT EXISTS idx_parcels_for_pickup_status ON public.parcels_for_pickup(status);
CREATE INDEX IF NOT EXISTS idx_parcels_for_pickup_assigned_route ON public.parcels_for_pickup(assigned_route_plan_id);
CREATE INDEX IF NOT EXISTS idx_parcels_for_pickup_received_at ON public.parcels_for_pickup(received_at);
CREATE INDEX IF NOT EXISTS idx_parcels_for_pickup_tracking ON public.parcels_for_pickup(tracking_number);

-- ============================================================================
-- 3. Extend route_plans table for pickup workflow
-- NOTE: assigned_vehicle_id and assigned_driver_id are TEXT to match existing
--       vehicles and drivers tables which use TEXT IDs, not UUID
-- ============================================================================
ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS route_number VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS planned_pickup_time TIME,
  ADD COLUMN IF NOT EXISTS warehouse_location_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_vehicle_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_driver_id TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_route_plan_id uuid;

-- Add foreign key constraints if they don't already exist
-- These are added separately to handle cases where referenced tables don't exist yet
DO $$
BEGIN
  -- FK to locations table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'route_plans_warehouse_location_fkey'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations') THEN
      ALTER TABLE public.route_plans 
        ADD CONSTRAINT route_plans_warehouse_location_fkey 
        FOREIGN KEY (warehouse_location_id) REFERENCES public.locations(id);
    END IF;
  END IF;

  -- FK to vehicles table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'route_plans_assigned_vehicle_fkey'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
      ALTER TABLE public.route_plans 
        ADD CONSTRAINT route_plans_assigned_vehicle_fkey 
        FOREIGN KEY (assigned_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- FK to drivers table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'route_plans_assigned_driver_fkey'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
      ALTER TABLE public.route_plans 
        ADD CONSTRAINT route_plans_assigned_driver_fkey 
        FOREIGN KEY (assigned_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- FK to next route_plan (self-referencing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'route_plans_next_route_plan_fkey'
  ) THEN
    ALTER TABLE public.route_plans 
      ADD CONSTRAINT route_plans_next_route_plan_fkey 
      FOREIGN KEY (next_route_plan_id) REFERENCES public.route_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Extend status check constraint to include pickup workflow statuses
ALTER TABLE IF EXISTS public.route_plans DROP CONSTRAINT IF EXISTS route_plans_status_check;
ALTER TABLE IF EXISTS public.route_plans
  ADD CONSTRAINT route_plans_status_check CHECK (
    status = ANY (ARRAY[
      'draft'::text,
      'planned'::text,
      'vehicle_assigned'::text,
      'driver_assigned'::text,
      'ready'::text,
      'in_progress'::text,
      'completed'::text,
      'completed_with_remaining'::text,
      'failed'::text,
      'cancelled'::text,
      'assigned'::text
    ])
  );

-- Create indexes for route_plans
CREATE INDEX IF NOT EXISTS idx_route_plans_status ON public.route_plans(status);
CREATE INDEX IF NOT EXISTS idx_route_plans_pickup_date ON public.route_plans(pickup_date);
CREATE INDEX IF NOT EXISTS idx_route_plans_assigned_driver ON public.route_plans(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_assigned_vehicle ON public.route_plans(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_created_at ON public.route_plans(created_at);

-- ============================================================================
-- 4. Create route_plan_parcels junction table
-- Links route plans to parcels with pickup status tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.route_plan_parcels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_plan_id uuid NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  parcel_id uuid NOT NULL REFERENCES public.parcels_for_pickup(id) ON DELETE RESTRICT,
  assignment_order INT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  picked_up_at TIMESTAMP WITH TIME ZONE,
  pickup_confirmed_by TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status = ANY (ARRAY['pending'::text, 'picked_up'::text, 'failed'::text])
  ),
  failure_note TEXT,
  CONSTRAINT route_plan_parcels_pkey PRIMARY KEY (id),
  CONSTRAINT unique_route_parcel UNIQUE (route_plan_id, parcel_id)
);

-- Add FK to drivers if drivers table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'route_plan_parcels_pickup_confirmed_by_fkey'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
      ALTER TABLE public.route_plan_parcels 
        ADD CONSTRAINT route_plan_parcels_pickup_confirmed_by_fkey 
        FOREIGN KEY (pickup_confirmed_by) REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create indexes for route_plan_parcels
CREATE INDEX IF NOT EXISTS idx_route_plan_parcels_route ON public.route_plan_parcels(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_route_plan_parcels_parcel ON public.route_plan_parcels(parcel_id);
CREATE INDEX IF NOT EXISTS idx_route_plan_parcels_status ON public.route_plan_parcels(status);

-- ============================================================================
-- 5. Create pickup_events table (audit trail)
-- Event log for tracking all pickup workflow events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickup_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_plan_id uuid NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type = ANY (ARRAY[
      'route_created'::text,
      'vehicle_assigned'::text,
      'driver_assigned'::text,
      'pickup_started'::text,
      'parcel_picked_up'::text,
      'parcel_not_picked_up'::text,
      'pickup_completed'::text,
      'pickup_failed'::text,
      'route_replanned'::text
    ])
  ),
  parcel_id uuid REFERENCES public.parcels_for_pickup(id) ON DELETE SET NULL,
  driver_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  CONSTRAINT pickup_events_pkey PRIMARY KEY (id)
);

-- Add FK to drivers if drivers table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pickup_events_driver_id_fkey'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
      ALTER TABLE public.pickup_events 
        ADD CONSTRAINT pickup_events_driver_id_fkey 
        FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create indexes for pickup_events
CREATE INDEX IF NOT EXISTS idx_pickup_events_route ON public.pickup_events(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_pickup_events_timestamp ON public.pickup_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_pickup_events_type ON public.pickup_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pickup_events_parcel ON public.pickup_events(parcel_id);

-- ============================================================================
-- 6. Enable Row Level Security (if needed)
-- ============================================================================
-- ALTER TABLE public.parcels_for_pickup ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.route_plan_parcels ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pickup_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service role access
-- These allow the backend service role to perform CRUD operations
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE tablename = 'parcels_for_pickup'
--   ) THEN
--     CREATE POLICY "Service role can manage parcels" ON public.parcels_for_pickup
--       AS PERMISSIVE FOR ALL
--       USING (auth.role() = 'service_role')
--       WITH CHECK (auth.role() = 'service_role');
--   END IF;
-- END $$;

-- ============================================================================
-- 7. Insert sample warehouse location (optional demo data)
-- ============================================================================
INSERT INTO public.locations (name, address, latitude, longitude, is_active)
VALUES (
  'Main Warehouse',
  'Binondo, Manila',
  14.5951,
  120.9811,
  TRUE
)
ON CONFLICT DO NOTHING;

COMMIT;

-- Migration verification script (run separately to verify tables exist)
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN (
--   'parcels_for_pickup', 'route_plan_parcels', 'pickup_events', 'locations'
-- )
-- ORDER BY table_name;

-- Check foreign key constraints were created
-- SELECT constraint_name, table_name, column_name 
-- FROM information_schema.key_column_usage
-- WHERE table_schema = 'public' AND table_name IN (
--   'parcels_for_pickup', 'route_plans', 'route_plan_parcels', 'pickup_events'
-- )
-- ORDER BY table_name, constraint_name;

-- NOTE: If drivers or vehicles tables don't exist, the foreign key constraints
-- for those tables will be skipped. They can be added manually after those
-- tables are created by running:
-- 
-- ALTER TABLE public.route_plans 
--   ADD CONSTRAINT route_plans_assigned_vehicle_fkey 
--   FOREIGN KEY (assigned_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
--
-- ALTER TABLE public.route_plans 
--   ADD CONSTRAINT route_plans_assigned_driver_fkey 
--   FOREIGN KEY (assigned_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
--
-- ALTER TABLE public.route_plan_parcels 
--   ADD CONSTRAINT route_plan_parcels_pickup_confirmed_by_fkey 
--   FOREIGN KEY (pickup_confirmed_by) REFERENCES public.drivers(id) ON DELETE SET NULL;
--
-- ALTER TABLE public.pickup_events 
--   ADD CONSTRAINT pickup_events_driver_id_fkey 
--   FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;