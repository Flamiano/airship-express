-- Route Plans workflow migration
-- Upgrades public.route_plans to the workflow schema expected by the booking and route-planning flow.
-- Safe to run multiple times via IF EXISTS / IF NOT EXISTS guards.

BEGIN;

-- 1) Ensure the base route_plans table exists with the workflow columns used by the app.
CREATE TABLE IF NOT EXISTS public.route_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id text,
  courier text,
  pickup_location text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  delivery_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geojson jsonb,
  distance_km numeric,
  estimated_duration_min numeric,
  planned_delivery_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status = ANY (ARRAY['draft'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])
  ),
  generated_by text DEFAULT 'OR-Tools',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT route_plans_pkey PRIMARY KEY (id),
  CONSTRAINT route_plans_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL,
  CONSTRAINT route_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS trip_id text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric,
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric,
  ADD COLUMN IF NOT EXISTS delivery_destinations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS route_geojson jsonb,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS estimated_duration_min numeric,
  ADD COLUMN IF NOT EXISTS planned_delivery_date date,
  ADD COLUMN IF NOT EXISTS generated_by text DEFAULT 'OR-Tools',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2) Normalize route status to the workflow values used by the app.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'route_plans' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.route_plans DROP CONSTRAINT IF EXISTS route_plans_status_check;
    ALTER TABLE public.route_plans
      ADD CONSTRAINT route_plans_status_check
      CHECK (status = ANY (ARRAY['draft'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));
  END IF;
END $$;

-- 3) Add foreign-key linkage for bookings and parcels if missing.
-- First, convert existing route_plan_id columns from text to uuid to match route_plans.id type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    -- Check if route_plan_id exists and convert it from text to uuid if needed
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'route_plan_id'
        AND data_type = 'text'
    ) THEN
      -- Drop the foreign key constraint if it exists before altering the column
      ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_route_plan_id_fkey;
      -- Alter the column type from text to uuid
      ALTER TABLE public.bookings ALTER COLUMN route_plan_id TYPE uuid USING route_plan_id::uuid;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'route_plan_id'
    ) THEN
      -- Column doesn't exist, create it as uuid
      ALTER TABLE public.bookings ADD COLUMN route_plan_id uuid;
    END IF;
    
    -- Add the remaining booking columns
    ALTER TABLE public.bookings
      ADD COLUMN IF NOT EXISTS courier text,
      ADD COLUMN IF NOT EXISTS total_parcels integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_weight numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS booking_type text DEFAULT 'Standard';
      
    -- Add the foreign-key constraint
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_route_plan_id_fkey;
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_route_plan_id_fkey
      FOREIGN KEY (route_plan_id) REFERENCES public.route_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Same for parcels (only if the table exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'parcels'
  ) THEN
    -- Check if route_plan_id exists and convert it from text to uuid if needed
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'parcels' AND column_name = 'route_plan_id'
        AND data_type = 'text'
    ) THEN
      -- Drop the foreign key constraint if it exists before altering the column
      ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_route_plan_id_fkey;
      -- Alter the column type from text to uuid
      ALTER TABLE public.parcels ALTER COLUMN route_plan_id TYPE uuid USING route_plan_id::uuid;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'parcels' AND column_name = 'route_plan_id'
    ) THEN
      -- Column doesn't exist, create it as uuid
      ALTER TABLE public.parcels ADD COLUMN route_plan_id uuid;
    END IF;
    
    -- Add the remaining parcel columns
    ALTER TABLE public.parcels
      ADD COLUMN IF NOT EXISTS booking_id text,
      ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Normal',
      ADD COLUMN IF NOT EXISTS weight_kg numeric,
      ADD COLUMN IF NOT EXISTS length_cm numeric,
      ADD COLUMN IF NOT EXISTS width_cm numeric,
      ADD COLUMN IF NOT EXISTS height_cm numeric,
      ADD COLUMN IF NOT EXISTS pickup_address text,
      ADD COLUMN IF NOT EXISTS delivery_address text,
      ADD COLUMN IF NOT EXISTS date_received timestamp with time zone DEFAULT now();
      
    -- Add the foreign-key constraint
    ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_route_plan_id_fkey;
    ALTER TABLE public.parcels
      ADD CONSTRAINT parcels_route_plan_id_fkey
      FOREIGN KEY (route_plan_id) REFERENCES public.route_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Add useful indexes (only for tables that exist).
CREATE INDEX IF NOT EXISTS route_plans_trip_idx ON public.route_plans(trip_id);
CREATE INDEX IF NOT EXISTS route_plans_courier_idx ON public.route_plans(courier);
CREATE INDEX IF NOT EXISTS route_plans_status_idx ON public.route_plans(status);
CREATE INDEX IF NOT EXISTS route_plans_created_by_idx ON public.route_plans(created_by);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    CREATE INDEX IF NOT EXISTS route_plan_bookings_idx ON public.bookings(route_plan_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'parcels'
  ) THEN
    CREATE INDEX IF NOT EXISTS route_plan_parcels_idx ON public.parcels(route_plan_id);
  END IF;
END $$;

COMMIT;
