ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assignment_status text;

UPDATE public.vehicles
SET assignment_status = 'accepted'
WHERE courier_id IS NOT NULL AND assignment_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_assignment_status
  ON public.vehicles(assignment_status);
