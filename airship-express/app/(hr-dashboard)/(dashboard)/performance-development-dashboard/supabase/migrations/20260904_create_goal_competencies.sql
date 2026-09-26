-- ============================================================================
-- Performance & Development — Goal ↔ Competency junction table
-- ============================================================================

create extension if not exists "uuid-ossp";

create table if not exists hr3_goal_competencies (
  id            uuid primary key default uuid_generate_v4(),
  goal_id       uuid not null references hr3_performance_goals(id) on delete cascade,
  competency_id uuid not null references hr3_competencies(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid
);

create unique index if not exists idx_goal_competencies_unique
  on hr3_goal_competencies (goal_id, competency_id);

create index if not exists idx_goal_competencies_goal
  on hr3_goal_competencies (goal_id);

create index if not exists idx_goal_competencies_competency
  on hr3_goal_competencies (competency_id);

alter table hr3_goal_competencies enable row level security;

create policy "Admins can manage goal competencies"
  on hr3_goal_competencies
  for all
  to authenticated
  using (
    exists (
      select 1 from hr_admin a
      where a.id = auth.uid()
        and a.role in ('super_admin', 'hr_payroll_admin', 'hr_performance_admin')
    )
  )
  with check (
    exists (
      select 1 from hr_admin a
      where a.id = auth.uid()
        and a.role in ('super_admin', 'hr_payroll_admin', 'hr_performance_admin')
    )
  );

create policy "Employees can view goal competencies for accessible goals"
  on hr3_goal_competencies
  for select
  to authenticated
  using (
    exists (
      select 1 from hr3_performance_goals g
      where g.id = goal_id
        and (
          g.employee_id in (
            select e.id from hr1_employees e
            where e.employee_id_number = (
              select a.employee_id from hr_admin a where a.id = auth.uid()
            )
          )
          or exists (
            select 1 from hr_admin a
            where a.id = auth.uid()
              and a.role in ('super_admin', 'hr_payroll_admin', 'hr_performance_admin')
          )
        )
    )
  );
