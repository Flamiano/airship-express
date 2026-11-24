alter table public.trips
  add column if not exists actual_fuel_consumed_liters numeric(12, 3);
