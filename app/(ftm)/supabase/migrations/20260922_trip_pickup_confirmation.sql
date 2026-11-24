-- Persist the hub pickup stage before a delivery trip can start.
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS pickup_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pickup_proof_url text,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trips_pickup_status
  ON public.trips(pickup_status);