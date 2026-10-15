-- HR1 applicant privacy and private resume storage.
-- Review before applying to the shared HR production project.
-- Existing resume objects and applicant rows are preserved.

begin;

-- The public application form now submits through a server route. Only HR
-- Recruitment Admins and Super Admins may read or manage applicant rows.
alter table public.hr1_applicants enable row level security;

-- Remove every previous applicant policy before adding the HR-only policy.
-- PostgreSQL combines permissive policies with OR, so leaving one broad policy
-- in place would defeat the HR-only rule below.
do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'hr1_applicants'
  loop
    execute format('drop policy if exists %I on public.hr1_applicants', v_policy.policyname);
  end loop;
end;
$$;

create policy "HR1 recruitment admins can manage applicants"
  on public.hr1_applicants
  for all to authenticated
  using (
    exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  )
  with check (
    exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  );

-- The old SECURITY DEFINER RPC returned the entire applicant row to anyone
-- who knew an email and reference. Public status lookups now use a server
-- endpoint with a limited response, so disable direct execution of the old RPC.
revoke all on function public.get_application_status(text, text)
  from public, anon, authenticated;

-- Schema audit confirmed there is no existing applicant-document table.
-- Keep file metadata separate from applicant PII and private storage objects.
create table if not exists public.hr1_applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.hr1_applicants(id) on delete cascade,
  document_type text not null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  submission_status text not null default 'Submitted'
    check (submission_status in ('Submitted', 'Resubmission Required')),
  verification_status text not null default 'Pending Verification'
    check (verification_status in ('Pending Verification', 'Verified', 'Rejected')),
  verification_remarks text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr1_applicant_documents_applicant_idx
  on public.hr1_applicant_documents(applicant_id, created_at desc);

revoke all on table public.hr1_applicant_documents from public, anon;
grant select, insert, update, delete on table public.hr1_applicant_documents to authenticated;

alter table public.hr1_applicant_documents enable row level security;
drop policy if exists "HR1 recruitment admins can manage applicant documents"
  on public.hr1_applicant_documents;
create policy "HR1 recruitment admins can manage applicant documents"
  on public.hr1_applicant_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  )
  with check (
    exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  );

-- Keep old files, but turn off public reads. New public submissions are
-- uploaded server-side; the HR form uploads only through an HR session.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'resumes';

-- Remove only Storage policies whose expressions reference the resumes bucket;
-- leave other HR subsystem buckets and their policies untouched.
do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%resumes%'
        or coalesce(with_check, '') ilike '%resumes%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;
end;
$$;

create policy "HR1 recruitment admins can upload resumes"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'applicants'
    and exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  );

create policy "HR1 recruitment admins can delete resumes"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'applicants'
    and exists (
      select 1 from public.hr_admin h
      where h.id = auth.uid()
        and h.role in ('super_admin', 'hr_recruitment_admin')
    )
  );

commit;
