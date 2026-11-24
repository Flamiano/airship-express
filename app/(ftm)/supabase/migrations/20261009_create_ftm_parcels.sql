BEGIN;

CREATE TABLE IF NOT EXISTS public.parcels (
  id text PRIMARY KEY,
  tracking_number text,
  customer_name text,
  customer_phone text,
  sender_name text,
  sender_phone text,
  recipient_name text,
  recipient_phone text,
  pickup_address text,
  pickup_location text,
  pickup_lat numeric(10, 7),
  pickup_lng numeric(10, 7),
  pickup_latitude numeric(10, 7),
  pickup_longitude numeric(10, 7),
  dropoff_location text,
  delivery_address text,
  destination text,
  address text,
  dest_lat numeric(10, 7),
  dest_lng numeric(10, 7),
  dropoff_latitude numeric(10, 7),
  dropoff_longitude numeric(10, 7),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  courier text,
  courier_id text,
  weight_kg numeric(10, 2) NOT NULL DEFAULT 0,
  parcel_type text,
  status text NOT NULL DEFAULT 'picked_up',
  notes text,
  bulk_qr_code text,
  bulk_parcel_count integer,
  parcel_count integer,
  package_count integer,
  quantity integer,
  booking_id text,
  route_plan_id uuid REFERENCES public.route_plans(id) ON DELETE SET NULL,
  trip_id text,
  qr_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  collected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS route_plan_id uuid,
  ADD COLUMN IF NOT EXISTS collected_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parcels_route_plan_id_fkey'
      AND conrelid = 'public.parcels'::regclass
  ) THEN
    ALTER TABLE public.parcels
      ADD CONSTRAINT parcels_route_plan_id_fkey
      FOREIGN KEY (route_plan_id)
      REFERENCES public.route_plans(id)
      ON DELETE SET NULL;
  END IF;
END $$;

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

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parcels FROM anon, authenticated;
GRANT ALL ON TABLE public.parcels TO service_role;

COMMIT;
