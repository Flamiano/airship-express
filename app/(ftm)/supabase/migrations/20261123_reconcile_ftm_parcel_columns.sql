BEGIN;

ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS pickup_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS pickup_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS dropoff_location text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS dropoff_latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS dropoff_longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS bulk_parcel_count integer,
  ADD COLUMN IF NOT EXISTS parcel_count integer,
  ADD COLUMN IF NOT EXISTS package_count integer,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS qr_code text;

CREATE UNIQUE INDEX IF NOT EXISTS parcels_tracking_number_uidx
  ON public.parcels (tracking_number)
  WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS parcels_status_created_at_idx
  ON public.parcels (status, created_at DESC);
CREATE INDEX IF NOT EXISTS parcels_route_plan_id_idx
  ON public.parcels (route_plan_id)
  WHERE route_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS parcels_bulk_qr_code_idx
  ON public.parcels (bulk_qr_code)
  WHERE bulk_qr_code IS NOT NULL;

COMMIT;
