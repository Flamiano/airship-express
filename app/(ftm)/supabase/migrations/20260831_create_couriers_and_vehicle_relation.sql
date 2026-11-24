BEGIN;

CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.couriers (code, name)
VALUES
  ('JNT', 'JNT Express'),
  ('SPX', 'ShopeeXpress'),
  ('LEX', 'Lazada Express'),
  ('FLASH', 'Flash Express'),
  ('TIKTOK', 'TikTok Delivery'),
  ('LBC', 'LBC'),
  ('GOGO', 'GOGO Xpress'),
  ('AIRSHIP', 'Airship Express')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE IF EXISTS public.vehicles
  ADD COLUMN IF NOT EXISTS courier_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_courier_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_courier_id_fkey
      FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_courier_id
  ON public.vehicles(courier_id);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow reading active couriers" ON public.couriers;
CREATE POLICY "Allow reading active couriers"
  ON public.couriers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

COMMIT;
