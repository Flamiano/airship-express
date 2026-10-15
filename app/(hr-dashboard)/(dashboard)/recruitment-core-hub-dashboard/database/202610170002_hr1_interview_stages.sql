-- Track the recruitment stage for each HR1 interview or assessment schedule.
-- Existing records stay marked as legacy instead of being assigned a false stage.
alter table public.hr1_interviews
  add column if not exists stage text not null default 'Legacy / Unspecified';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hr1_interviews_stage_check'
      and conrelid = 'public.hr1_interviews'::regclass
  ) then
    alter table public.hr1_interviews
      add constraint hr1_interviews_stage_check
      check (stage in ('Legacy / Unspecified', 'Initial Interview', 'Assessment', 'Final Interview'));
  end if;
end $$;

create index if not exists hr1_interviews_applicant_stage_schedule_idx
  on public.hr1_interviews(applicant_id, stage, scheduled_date desc);

comment on column public.hr1_interviews.stage is
  'Recruitment stage: Initial Interview, Assessment, or Final Interview. Legacy rows remain unspecified.';

create or replace function public.hr1_validate_interview_stage_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prior_stage text;
begin
  if new.stage = 'Assessment' then
    prior_stage := 'Initial Interview';
  elsif new.stage = 'Final Interview' then
    prior_stage := 'Assessment';
  else
    prior_stage := null;
  end if;

  if prior_stage is not null and not exists (
    select 1
    from public.hr1_interviews previous
    where previous.applicant_id = new.applicant_id
      and previous.stage = prior_stage
      and previous.status = 'Completed'
      and previous.outcome = 'Passed'
      and previous.id is distinct from new.id
  ) then
    raise exception 'The applicant must pass % before this stage can be scheduled', prior_stage;
  end if;

  if new.stage <> 'Legacy / Unspecified' and exists (
    select 1
    from public.hr1_interviews existing
    where existing.applicant_id = new.applicant_id
      and existing.stage = new.stage
      and existing.status <> 'Cancelled'
      and existing.id is distinct from new.id
  ) then
    raise exception 'This applicant already has a non-cancelled record for stage %', new.stage;
  end if;

  return new;
end;
$$;

drop trigger if exists hr1_interviews_validate_stage_order on public.hr1_interviews;
create trigger hr1_interviews_validate_stage_order
  before insert or update of applicant_id, stage, status, outcome
  on public.hr1_interviews
  for each row execute function public.hr1_validate_interview_stage_order();
