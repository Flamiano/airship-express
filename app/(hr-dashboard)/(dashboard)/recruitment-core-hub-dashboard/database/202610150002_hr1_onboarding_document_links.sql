-- Secure HR1 onboarding document links.
-- Review and run manually in the shared Supabase SQL Editor.
begin;

alter table public.hr1_onboardings
  add column if not exists required_documents text[] not null default '{}'::text[];

alter table public.hr1_applicant_documents
  add column if not exists onboarding_id uuid
    references public.hr1_onboardings(id) on delete set null;

create index if not exists hr1_applicant_documents_onboarding_idx
  on public.hr1_applicant_documents(onboarding_id, created_at desc)
  where onboarding_id is not null;

create table if not exists public.hr1_onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.hr1_onboardings(id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists hr1_onboarding_invites_onboarding_idx
  on public.hr1_onboarding_invites(onboarding_id, created_at desc);

-- Keep the existing resumes bucket private; enable only the onboarding file types.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
where id = 'resumes';

revoke all on public.hr1_onboarding_invites from public, anon;
grant select, insert, update, delete on public.hr1_onboarding_invites to authenticated;
alter table public.hr1_onboarding_invites enable row level security;
drop policy if exists "HR1 admins can manage onboarding invites"
  on public.hr1_onboarding_invites;
create policy "HR1 admins can manage onboarding invites"
  on public.hr1_onboarding_invites
  for all to authenticated
  using (exists (
    select 1 from public.hr_admin h
    where h.id = auth.uid()
      and h.role in ('super_admin', 'hr_recruitment_admin')
  ))
  with check (exists (
    select 1 from public.hr_admin h
    where h.id = auth.uid()
      and h.role in ('super_admin', 'hr_recruitment_admin')
  ));

comment on column public.hr1_onboardings.required_documents is
  'Document categories specifically requested by HR for this onboarding; empty means no extra documents are requested.';
comment on column public.hr1_applicant_documents.onboarding_id is
  'Links a private uploaded applicant document to the onboarding request that collected it.';
commit;
