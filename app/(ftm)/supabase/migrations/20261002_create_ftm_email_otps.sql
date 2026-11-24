CREATE TABLE IF NOT EXISTS public.ftm_email_otps (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_sent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ftm_email_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ftm_email_otps FROM anon, authenticated;
GRANT ALL ON TABLE public.ftm_email_otps TO service_role;