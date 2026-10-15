-- Store the applicant-completed background investigation form with HR1 onboarding.
-- Review and run manually in the shared Supabase SQL Editor.
begin;

alter table public.hr1_onboardings
  add column if not exists background_information jsonb not null default '{}'::jsonb;

comment on column public.hr1_onboardings.background_information is
  'Sensitive personal and government information collected through the expiring, private HR1 onboarding link; accessible to HR admins only.';

commit;
