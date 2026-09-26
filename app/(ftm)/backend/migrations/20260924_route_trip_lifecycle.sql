BEGIN;

ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS fuel_savings numeric,
  ADD COLUMN IF NOT EXISTS eta_impact_min numeric,
  ADD COLUMN IF NOT EXISTS optimization_result jsonb,
  ADD COLUMN IF NOT EXISTS route_details jsonb;

CREATE TABLE IF NOT EXISTS public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL,
  sequence integer NOT NULL,
  name text NOT NULL,
  latitude numeric,
  longitude numeric,
  parcel_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  arrived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  status text NOT NULL,
  remarks text,
  latitude numeric,
  longitude numeric,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS route_plan_id uuid,
  ADD COLUMN IF NOT EXISTS courier_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pickup_proof_url text,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS estimated_duration_min numeric,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_sequence ON public.trip_stops(trip_id, sequence);
CREATE INDEX IF NOT EXISTS idx_trip_events_trip_created ON public.trip_events(trip_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trips_driver_status ON public.trips(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_route_plan ON public.trips(route_plan_id);

COMMIT;
