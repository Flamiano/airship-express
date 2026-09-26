BEGIN;

CREATE TABLE IF NOT EXISTS public.fuel_costs (
  cost_entry_id uuid PRIMARY KEY REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  liters numeric,
  odometer_reading numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_costs (
  cost_entry_id uuid PRIMARY KEY REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  maintenance_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.toll_costs (
  cost_entry_id uuid PRIMARY KEY REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  toll_location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parking_costs (
  cost_entry_id uuid PRIMARY KEY REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  parking_location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.other_costs (
  cost_entry_id uuid PRIMARY KEY REFERENCES public.cost_entries(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toll_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_costs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'fuel_costs', 'maintenance_costs', 'toll_costs', 'parking_costs', 'other_costs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_service_role_%s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "allow_service_role_%s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', table_name, table_name);
  END LOOP;
END $$;

COMMIT;

-- Verify the category tables:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN
-- ('fuel_costs', 'maintenance_costs', 'toll_costs', 'parking_costs', 'other_costs');
