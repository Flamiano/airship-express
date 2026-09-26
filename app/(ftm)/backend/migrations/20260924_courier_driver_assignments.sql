BEGIN;

-- Drivers are permanently owned by one registered courier, matching vehicles.
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS courier_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_courier_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_courier_id_fkey
      FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_driver_courier_status
  ON public.users(courier_id, role, status);

-- Keep assignments queryable and enforceable from every FTM workflow.
ALTER TABLE IF EXISTS public.bookings
  ADD COLUMN IF NOT EXISTS courier_id uuid;
ALTER TABLE IF EXISTS public.trips
  ADD COLUMN IF NOT EXISTS courier_id uuid;
ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS courier_id uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_courier_id_fkey') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_courier_id_fkey
      FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trips')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_courier_id_fkey') THEN
    ALTER TABLE public.trips ADD CONSTRAINT trips_courier_id_fkey
      FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'route_plans')
    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_plans_courier_id_fkey') THEN
    ALTER TABLE public.route_plans ADD CONSTRAINT route_plans_courier_id_fkey
      FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_courier_id ON public.bookings(courier_id);
CREATE INDEX IF NOT EXISTS idx_trips_courier_id ON public.trips(courier_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_courier_id ON public.route_plans(courier_id);

COMMIT;
