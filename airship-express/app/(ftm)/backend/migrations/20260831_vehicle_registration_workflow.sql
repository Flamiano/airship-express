BEGIN;

ALTER TABLE IF EXISTS public.vehicles
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS vin_number text,
  ADD COLUMN IF NOT EXISTS engine_number text,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS registration_expiry date,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS availability text DEFAULT 'Available',
  ADD COLUMN IF NOT EXISTS courier_id uuid;

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text,
  expiry_date date,
  file_url text,
  status text NOT NULL DEFAULT 'Valid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_documents_vehicle_id_idx ON public.vehicle_documents(vehicle_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vehicle managers read vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Vehicle managers read vehicle documents" ON public.vehicle_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Vehicle managers create vehicle documents" ON public.vehicle_documents;
CREATE POLICY "Vehicle managers create vehicle documents" ON public.vehicle_documents
  FOR INSERT TO authenticated WITH CHECK (true);

COMMIT;
