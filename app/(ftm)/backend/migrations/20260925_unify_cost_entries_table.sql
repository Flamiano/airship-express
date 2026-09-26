-- Unify the cost model into a single canonical table.
-- The legacy split tables (fuel_costs, maintenance_costs, toll_costs,
-- parking_costs, other_costs) are no longer the source of truth.

ALTER TABLE IF EXISTS public.cost_entries
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS category_details jsonb DEFAULT '{}'::jsonb;

-- Backfill the new metadata column for existing rows where it is blank.
UPDATE public.cost_entries
SET category_details = COALESCE(category_details, '{}'::jsonb)
WHERE category_details IS NULL;

-- Helpful indexes for the driver and vehicle lookups used by the app.
CREATE INDEX IF NOT EXISTS idx_cost_entries_driver_id
  ON public.cost_entries (driver_id);

CREATE INDEX IF NOT EXISTS idx_cost_entries_vehicle_id
  ON public.cost_entries (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_cost_entries_category_date
  ON public.cost_entries (category, entry_date DESC);

-- Keep compatibility for any reads that still expect a `notes`-style object.
-- (No legacy tables are used by the app anymore; this is a migration safety net.)
COMMENT ON COLUMN public.cost_entries.category_details IS
  'Structured metadata for the chosen cost category stored in the same table as the base cost entry.';


 DROP TABLE IF EXISTS public.fuel_costs;
 DROP TABLE IF EXISTS public.maintenance_costs;
 DROP TABLE IF EXISTS public.toll_costs;
 DROP TABLE IF EXISTS public.parking_costs;
 DROP TABLE IF EXISTS public.other_costs;
