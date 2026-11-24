CREATE TABLE IF NOT EXISTS public.ftm_security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  otp_lifetime_seconds integer NOT NULL DEFAULT 60 CHECK (otp_lifetime_seconds IN (60, 120, 240, 300, 600)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id)
);

INSERT INTO public.ftm_security_settings (id, otp_lifetime_seconds)
VALUES (true, 60)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ftm_security_settings ENABLE ROW LEVEL SECURITY;
