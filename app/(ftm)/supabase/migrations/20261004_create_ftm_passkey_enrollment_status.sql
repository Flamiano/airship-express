CREATE TABLE IF NOT EXISTS public.ftm_passkey_enrollment_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Registered')),
  registered_at timestamptz,
  registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'Registered') = (registered_at IS NOT NULL))
);

ALTER TABLE public.ftm_passkey_enrollment_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ftm_passkey_enrollment_status FROM anon, authenticated;
GRANT ALL ON TABLE public.ftm_passkey_enrollment_status TO service_role;