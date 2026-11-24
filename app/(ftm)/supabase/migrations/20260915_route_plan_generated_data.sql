-- Persist identifiers already supplied by the route-planning workflow.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS bulk_qr_code text;
