BEGIN;

CREATE TABLE IF NOT EXISTS public.route_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text,
  bulk_qr_code text,
  courier text,
  pickup_location text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  delivery_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geojson jsonb,
  distance_km numeric,
  estimated_duration_min numeric,
  planned_delivery_date date,
  status text NOT NULL DEFAULT 'draft',
  generated_by text DEFAULT 'OR-Tools',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_plans
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS baseline_route jsonb,
  ADD COLUMN IF NOT EXISTS optimized_route jsonb,
  ADD COLUMN IF NOT EXISTS stop_sequence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS depot jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_id text,
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS vehicle_info jsonb,
  ADD COLUMN IF NOT EXISTS driver_info jsonb,
  ADD COLUMN IF NOT EXISTS baseline_distance_km numeric,
  ADD COLUMN IF NOT EXISTS baseline_duration_min numeric,
  ADD COLUMN IF NOT EXISTS optimized_distance_km numeric,
  ADD COLUMN IF NOT EXISTS optimized_duration_min numeric,
  ADD COLUMN IF NOT EXISTS distance_saved_km numeric,
  ADD COLUMN IF NOT EXISTS fuel_efficiency_km_per_l numeric,
  ADD COLUMN IF NOT EXISTS baseline_fuel_liters numeric,
  ADD COLUMN IF NOT EXISTS optimized_fuel_liters numeric,
  ADD COLUMN IF NOT EXISTS fuel_saved_liters numeric,
  ADD COLUMN IF NOT EXISTS optimization_result jsonb,
  ADD COLUMN IF NOT EXISTS route_details jsonb,
  ADD COLUMN IF NOT EXISTS fuel_savings numeric,
  ADD COLUMN IF NOT EXISTS eta_impact_min numeric;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE public.route_plans
SET optimized_distance_km = distance_km
WHERE optimized_distance_km IS NULL AND distance_km IS NOT NULL;

UPDATE public.route_plans
SET optimized_duration_min = estimated_duration_min
WHERE optimized_duration_min IS NULL AND estimated_duration_min IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_plans_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.route_plans
      ADD CONSTRAINT route_plans_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'route_plans_driver_id_fkey'
  ) THEN
    ALTER TABLE public.route_plans
      ADD CONSTRAINT route_plans_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS route_plans_idempotency_key_uidx
  ON public.route_plans(idempotency_key);
CREATE INDEX IF NOT EXISTS route_plans_vehicle_idx ON public.route_plans(vehicle_id);
CREATE INDEX IF NOT EXISTS route_plans_driver_idx ON public.route_plans(driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_key_uidx
  ON public.bookings(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.route_plan_bookings (
  route_plan_id uuid NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_plan_id, booking_id)
);

CREATE INDEX IF NOT EXISTS route_plan_bookings_booking_idx
  ON public.route_plan_bookings(booking_id);

COMMIT;