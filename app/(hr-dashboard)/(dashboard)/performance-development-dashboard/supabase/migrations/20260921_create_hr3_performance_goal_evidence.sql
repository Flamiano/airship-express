create table public.hr3_performance_goal_evidence (
  id uuid not null default gen_random_uuid (),
  goal_id uuid not null,
  employee_id uuid not null,
  check_in_id uuid null,
  progress_percent smallint not null,
  note text null,
  attachment_path text null,
  attachment_name text null,
  attachment_mime text null,
  attachment_size integer null,
  created_at timestamp with time zone not null default now(),
  constraint hr3_performance_goal_evidence_pkey primary key (id),
  constraint hr3_performance_goal_evidence_goal_id_fkey foreign key (goal_id) references hr3_performance_goals (id) on delete cascade,
  constraint hr3_performance_goal_evidence_employee_id_fkey foreign key (employee_id) references hr1_employees (id) on delete cascade,
  constraint hr3_performance_goal_evidence_check_in_id_fkey foreign key (check_in_id) references hr3_performance_feedback (id) on delete cascade,
  constraint hr3_performance_goal_evidence_progress_percent_check check (progress_percent >= 0 and progress_percent <= 100),
  constraint hr3_performance_goal_evidence_attachment_size_check check (attachment_size is null or attachment_size >= 0),
  constraint hr3_performance_goal_evidence_attachment_check check (
    (
      attachment_path is null
      and attachment_name is null
      and attachment_mime is null
      and attachment_size is null
    )
    or (
      attachment_path is not null
      and attachment_name is not null
      and attachment_mime is not null
      and attachment_size is not null
    )
  )
) tablespace pg_default;

create index if not exists idx_hr3_performance_goal_evidence_goal
  on public.hr3_performance_goal_evidence using btree (goal_id, created_at) tablespace pg_default;

create index if not exists idx_hr3_performance_goal_evidence_employee
  on public.hr3_performance_goal_evidence using btree (employee_id, created_at) tablespace pg_default;

create index if not exists idx_hr3_performance_goal_evidence_check_in
  on public.hr3_performance_goal_evidence using btree (check_in_id) tablespace pg_default;
