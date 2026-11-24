BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  route_plan_id uuid NULL REFERENCES public.route_plans(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_assignments_status_check CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT booking_assignments_booking_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_assignments_driver_status
  ON public.booking_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_assignments_vehicle_status
  ON public.booking_assignments(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_assignments_route_plan
  ON public.booking_assignments(route_plan_id);

ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;

COMMIT;
