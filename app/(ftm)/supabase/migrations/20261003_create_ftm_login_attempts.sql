CREATE TABLE IF NOT EXISTS public.ftm_login_attempts (
  email text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ftm_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ftm_login_attempts FROM anon, authenticated;
GRANT ALL ON TABLE public.ftm_login_attempts TO service_role;