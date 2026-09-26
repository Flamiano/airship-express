ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;