-- ============================================================================
-- Migration: create the tables a comment bug in an earlier schema.sql hid.
--
-- A previous schema.sql had the CREATE TABLE for freight_loads swallowed by a
-- `--` comment (no newline before the statement), so those statements and the
-- ones after them never ran. This file idempotently creates the two tables
-- that are still missing from the live database:
--
--   1. public.freight_loads        (the /loads dispatch module)
--   2. public.performance_metrics  (dashboard Card 2 readouts / Card 3 courses)
--
-- Because the comment bug swallowed everything from freight_loads onward, the
-- RLS helper functions (is_hr_admin / is_hr_or_manager) and the uuid-ossp
-- extension may ALSO be missing. This file is self-contained: it recreates the
-- extension, the helper functions, the tables, RLS, and policies, so it works
-- against a fresh database or the existing one.
--
-- HOW TO APPLY:
--   Supabase → SQL Editor → New query → paste this → Run.
--   Then run `npm run db:setup` to seed the new tables.
--
-- Safe to run more than once (all statements are idempotent).
-- ============================================================================

begin;

-- The tables default to uuid_generate_v4(), so make sure the extension exists.
create extension if not exists "uuid-ossp";

-- RLS helpers used by the policies below (idempotent; also defined in
-- schema.sql). Recreated here so this migration runs standalone.
create or replace function public.is_hr_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('HR Admin', 'HR Generalist', 'HR Officer')
  );
$$ language sql security definer stable;

create or replace function public.is_hr_or_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('HR Admin', 'Operations Manager', 'HR Generalist', 'HR Officer', 'Office-in-Charge')
  );
$$ language sql security definer stable;

-- ---- 1. freight_loads (missing because the CREATE TABLE was commented out) ---
create table if not exists public.freight_loads (
  id uuid primary key default uuid_generate_v4(),
  load_ref text not null unique,
  origin text not null,
  destination text not null,
  pickup_date date not null,
  status text not null default 'Pending Driver'
    check (status in ('Pending Driver', 'Scheduled', 'In Transit', 'Delivered', 'On Hold', 'Cancelled')),
  priority text not null default 'Normal'
    check (priority in ('Normal', 'High', 'Critical')),
  driver_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_loads_status on public.freight_loads(status);
create index if not exists idx_loads_driver on public.freight_loads(driver_id);

alter table public.freight_loads enable row level security;

drop policy if exists "loads visible to all authenticated" on public.freight_loads;
create policy "loads visible to all authenticated"
  on public.freight_loads for select using (auth.role() = 'authenticated');

drop policy if exists "loads managed by hr/manager" on public.freight_loads;
create policy "loads managed by hr/manager"
  on public.freight_loads for all using (public.is_hr_or_manager());

-- ---- 2. performance_metrics (Card 2 readouts + Card 3 course count) ---------
create table if not exists public.performance_metrics (
  id uuid primary key default uuid_generate_v4(),
  snapshot_date date not null default current_date,
  avg_rating numeric(2,1) not null,
  on_time_rate numeric(4,1) not null,
  task_completion_rate numeric(4,1) not null,
  active_courses int not null default 0,
  updated_at timestamptz default now()
);

alter table public.performance_metrics enable row level security;

drop policy if exists "performance readable" on public.performance_metrics;
create policy "performance readable"
  on public.performance_metrics for select using (auth.role() = 'authenticated');

drop policy if exists "performance managed by hr admin" on public.performance_metrics;
create policy "performance managed by hr admin"
  on public.performance_metrics for all using (public.is_hr_admin());

commit;
