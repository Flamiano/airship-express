-- HR1 department employee request, HR Admin review, and job-posting source link.
-- This file is not executed automatically by the application.
alter table public.hr1_job_positions
  add column if not exists manpower_request_id uuid references public.hr1_manpower_requests(id),
  add column if not exists posting_status text not null default 'Legacy',
  add column if not exists number_of_positions integer,
  add column if not exists salary_range text,
  add column if not exists employment_type text,
  add column if not exists work_arrangement text,
  add column if not exists work_location text,
  add column if not exists benefits text,
  add column if not exists hiring_deadline date;

create unique index if not exists hr1_job_positions_manpower_request_unique
  on public.hr1_job_positions(manpower_request_id) where manpower_request_id is not null;

alter table public.hr1_job_positions enable row level security;
alter table public.hr1_manpower_requests enable row level security;

drop policy if exists "Allow all access to authenticated users" on public.hr1_job_positions;
drop policy if exists "Authenticated users can submit manpower requests" on public.hr1_manpower_requests;
drop policy if exists "Authenticated users can view manpower requests" on public.hr1_manpower_requests;
drop policy if exists "HR1 department members can read requests" on public.hr1_manpower_requests;
drop policy if exists "HR1 department managers can submit requests" on public.hr1_manpower_requests;
drop policy if exists "Active department employees can submit requests" on public.hr1_manpower_requests;
drop policy if exists "HR1 admins can review requests" on public.hr1_manpower_requests;
drop policy if exists "HR1 admins can manage job positions" on public.hr1_job_positions;
drop policy if exists "Public can view published HR1 jobs" on public.hr1_job_positions;
drop policy if exists "Authenticated users can read HR1 job positions" on public.hr1_job_positions;

create policy "HR1 department members can read requests" on public.hr1_manpower_requests
  for select to authenticated using (
    exists (select 1 from public.hr_admin h where h.id = auth.uid()
      and h.role in ('super_admin', 'hr_recruitment_admin'))
    or exists (select 1 from public.hr1_employees e where e.auth_user_id = auth.uid()
      and e.status = 'active' and e.department = hr1_manpower_requests.department)
  );

create policy "Active department employees can submit requests" on public.hr1_manpower_requests
  for insert to authenticated with check (
    requested_by = auth.uid() and status = 'Pending'
    and exists (select 1 from public.hr1_employees e where e.auth_user_id = auth.uid()
      and e.status = 'active' and e.department = hr1_manpower_requests.department)
  );

create policy "HR1 admins can review requests" on public.hr1_manpower_requests
  for update to authenticated using (exists (select 1 from public.hr_admin h
    where h.id = auth.uid() and h.role in ('super_admin', 'hr_recruitment_admin')))
  with check (exists (select 1 from public.hr_admin h
    where h.id = auth.uid() and h.role in ('super_admin', 'hr_recruitment_admin')));

create policy "HR1 admins can manage job positions" on public.hr1_job_positions
  for all to authenticated using (exists (select 1 from public.hr_admin h
    where h.id = auth.uid() and h.role in ('super_admin', 'hr_recruitment_admin')))
  with check (exists (select 1 from public.hr_admin h
    where h.id = auth.uid() and h.role in ('super_admin', 'hr_recruitment_admin')));

-- Preserve internal read access because other HR modules reference job titles
-- while restricting authenticated INSERT/UPDATE/DELETE to HR1 reviewers.
create policy "Authenticated users can read HR1 job positions"
  on public.hr1_job_positions for select to authenticated using (true);

create or replace function public.hr1_is_approved_manpower_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hr1_manpower_requests r
    where r.id = p_request_id and r.status = 'Approved');
$$;
revoke all on function public.hr1_is_approved_manpower_request(uuid) from public;
grant execute on function public.hr1_is_approved_manpower_request(uuid) to anon, authenticated;

create policy "Public can view published HR1 jobs" on public.hr1_job_positions
  for select to anon, authenticated using (
    is_active = true and posting_status = 'Published' and manpower_request_id is not null
    and public.hr1_is_approved_manpower_request(manpower_request_id)
  );

create or replace function public.hr1_create_job_posting_from_request(p_request_id uuid)
returns public.hr1_job_positions language plpgsql security definer set search_path = public as $$
declare v_request public.hr1_manpower_requests%rowtype; v_position public.hr1_job_positions%rowtype;
begin
  if not exists (select 1 from public.hr_admin h where h.id = auth.uid()
    and h.role in ('super_admin', 'hr_recruitment_admin')) then
    raise exception 'Only HR Recruitment Admin or Super Admin may create job postings';
  end if;
  select * into v_request from public.hr1_manpower_requests where id = p_request_id for update;
  if not found then raise exception 'Manpower request not found'; end if;
  if v_request.status <> 'Approved' then raise exception 'Only approved requests can become job postings'; end if;
  if v_request.positions_posted >= v_request.number_of_positions then raise exception 'Approved headcount already fully posted'; end if;
  if exists (select 1 from public.hr1_job_positions where manpower_request_id = p_request_id) then
    raise exception 'A job posting already exists for this manpower request';
  end if;
  insert into public.hr1_job_positions (title, department, description, requirements, is_active,
    manpower_request_id, posting_status, number_of_positions, salary_range, employment_type,
    work_arrangement, work_location, benefits, hiring_deadline)
  values (v_request.position_title, v_request.department, v_request.job_description,
    v_request.requirements, false, v_request.id, 'Draft', v_request.number_of_positions,
    v_request.salary_range, v_request.employment_type, v_request.work_arrangement,
    v_request.work_location, v_request.benefits, v_request.hiring_deadline)
  returning * into v_position;
  update public.hr1_manpower_requests set positions_posted = coalesce(positions_posted, 0) + v_request.number_of_positions, updated_at = now()
    where id = p_request_id;
  return v_position;
end; $$;

revoke all on function public.hr1_create_job_posting_from_request(uuid) from public, anon;
grant execute on function public.hr1_create_job_posting_from_request(uuid) to authenticated;
comment on column public.hr1_job_positions.posting_status is
  'Legacy rows remain non-public until linked to an approved manpower request and explicitly published.';
