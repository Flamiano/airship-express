-- ============================================================================
-- Workforce Management Sub-system — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL Editor (Project → SQL → New query).
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. profiles  (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'Fleet Driver'
    check (role in ('HR Admin', 'Operations Manager', 'Fleet Driver',
      'Hybrid/Rider', 'Appraiser', 'Appraiser/Rider',
      'Sales Representative', 'Office Staff', 'CSR/Marketing Staff',
      'Rider', 'Project Coordinator', 'Office-in-Charge',
      'Admin Assistant', 'In-House Rider', 'JNT Pick-Up Rider',
      'Airship Driver', 'HR Generalist', 'HR Officer',
      'Marketing/Admin Staff', 'Drop-Off Pick-Up Rider', 'Manila Rider')),
  avatar_initials text,
  terminal text default 'Unassigned',
  created_at timestamptz default now()
);

-- Rebuild the role constraint to include the real roster positions. This makes
-- the file safe to re-run against an existing database (the old constraint
-- allowed only the three app roles).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('HR Admin', 'Operations Manager', 'Fleet Driver',
      'Hybrid/Rider', 'Appraiser', 'Appraiser/Rider',
      'Sales Representative', 'Office Staff', 'CSR/Marketing Staff',
      'Rider', 'Project Coordinator', 'Office-in-Charge',
      'Admin Assistant', 'In-House Rider', 'JNT Pick-Up Rider',
      'Airship Driver', 'HR Generalist', 'HR Officer',
      'Marketing/Admin Staff', 'Drop-Off Pick-Up Rider', 'Manila Rider'));

-- ---------------------------------------------------------------------------
-- 2. attendance_logs
-- ---------------------------------------------------------------------------
create table if not exists attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  status text not null
    check (status in ('On-Shift', 'On-Break', 'Tardy', 'Absent', 'Clocked Out')),
  shift_start text,
  shift_end text,
  terminal text not null,
  last_scan timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_attendance_employee on attendance_logs(employee_id);
create index if not exists idx_attendance_status on attendance_logs(status);

-- ---------------------------------------------------------------------------
-- 3. shifts
-- ---------------------------------------------------------------------------
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  driver_id uuid references profiles(id) on delete set null,
  vehicle text not null,
  shift_date date not null,
  shift_time text not null,
  status text not null default 'Scheduled'
    check (status in ('Scheduled', 'In Progress', 'Completed', 'Pending Driver')),
  priority text not null default 'Normal'
    check (priority in ('Normal', 'High', 'Critical')),
  created_at timestamptz default now()
);
create index if not exists idx_shifts_driver on shifts(driver_id);
create index if not exists idx_shifts_date on shifts(shift_date);

-- ---------------------------------------------------------------------------
-- 4. timesheets
-- ---------------------------------------------------------------------------
create table if not exists timesheets (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_hours numeric(5,2) not null,
  overtime_hours numeric(5,2) default 0,
  load_ref text,
  total_pay numeric(10,2),
  status text not null default 'Pending Approval'
    check (status in ('Pending Approval', 'Approved', 'Flagged Overtime', 'Rejected')),
  created_at timestamptz default now()
);
create index if not exists idx_timesheets_employee on timesheets(employee_id);
create index if not exists idx_timesheets_status on timesheets(status);

-- ---------------------------------------------------------------------------
-- 5. leave_requests
-- ---------------------------------------------------------------------------
create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  leave_type text not null
    check (leave_type in ('Mandatory Fatigue Rest', 'Paid Time Off (PTO)', 'Medical Leave', 'Unpaid Leave')),
  start_date date not null,
  end_date date not null,
  days_count int not null,
  reason text,
  status text not null default 'Pending HR Review'
    check (status in ('Pending HR Review', 'Approved', 'Rejected')),
  balance_remaining int,
  created_at timestamptz default now()
);
create index if not exists idx_leave_employee on leave_requests(employee_id);
create index if not exists idx_leave_status on leave_requests(status);

-- ---------------------------------------------------------------------------
-- 6. freight_loads  (freight-to-driver dispatch, the wider-system hook)
-- Loads can be matched to available (On-Shift) drivers via shifts/driver_id.
-- ---------------------------------------------------------------------------
create table if not exists freight_loads (
  id uuid primary key default uuid_generate_v4(),
  load_ref text not null unique,
  origin text not null,
  destination text not null,
  pickup_date date not null,
  status text not null default 'Pending Driver'
    check (status in ('Pending Driver', 'Scheduled', 'In Transit', 'Delivered', 'On Hold', 'Cancelled')),
  priority text not null default 'Normal'
    check (priority in ('Normal', 'High', 'Critical')),
  driver_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_loads_status on freight_loads(status);
create index if not exists idx_loads_driver on freight_loads(driver_id);

-- ---------------------------------------------------------------------------
-- 7. skilling_progress  (Card 3)
-- ---------------------------------------------------------------------------
create table if not exists skilling_progress (
  id uuid primary key default uuid_generate_v4(),
  department text not null,
  certified_count int not null,
  total_count int not null,
  completion_rate int generated always as (
    case when total_count > 0 then (certified_count * 100 / total_count) else 0 end
  ) stored,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 8. workforce_forecast  (Card 1)
-- ---------------------------------------------------------------------------
create table if not exists workforce_forecast (
  id uuid primary key default uuid_generate_v4(),
  month text not null,
  freight_volume int not null,
  current_staff int not null,
  required_staff int not null,
  deficit int generated always as (required_staff - current_staff) stored,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 9. performance_metrics  (Card 2 readouts + Card 3 course count)
-- One snapshot row per period; the dashboard uses the latest row.
-- ---------------------------------------------------------------------------
create table if not exists performance_metrics (
  id uuid primary key default uuid_generate_v4(),
  snapshot_date date not null default current_date,
  avg_rating numeric(2,1) not null,
  on_time_rate numeric(4,1) not null,
  task_completion_rate numeric(4,1) not null,
  active_courses int not null default 0,
  updated_at timestamptz default now()
);

-- ============================================================================
-- Auto-create a profile row on signup (fallback if the client insert fails).
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'Fleet Driver',
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 2))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Enable Realtime for attendance_logs (Card 4 live feed).
-- ============================================================================
alter publication supabase_realtime add table attendance_logs;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles           enable row level security;
alter table attendance_logs    enable row level security;
alter table shifts             enable row level security;
alter table timesheets         enable row level security;
alter table leave_requests     enable row level security;
alter table skilling_progress  enable row level security;
alter table workforce_forecast enable row level security;
alter table performance_metrics enable row level security;
alter table freight_loads      enable row level security;

-- Helper: is the current user an HR Admin (incl. HR Generalist / HR Officer)?
create or replace function public.is_hr_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('HR Admin', 'HR Generalist', 'HR Officer')
  );
$$ language sql security definer stable;

-- Helper: is the current user HR Admin or Operations Manager (incl. the real
-- roster's management equivalents)?
create or replace function public.is_hr_or_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('HR Admin', 'Operations Manager', 'HR Generalist', 'HR Officer', 'Office-in-Charge')
  );
$$ language sql security definer stable;

-- ---- profiles ----
create policy "profiles readable by authenticated"
  on profiles for select using (auth.role() = 'authenticated');
create policy "users update own profile"
  on profiles for update using (id = auth.uid());
create policy "users insert own profile"
  on profiles for insert with check (id = auth.uid());
create policy "hr admin manages profiles"
  on profiles for all using (public.is_hr_admin());

-- ---- attendance_logs ----
create policy "attendance visible to hr/manager"
  on attendance_logs for select using (public.is_hr_or_manager());
create policy "attendance own visible"
  on attendance_logs for select using (employee_id = auth.uid());
create policy "attendance managed by hr/manager"
  on attendance_logs for all using (public.is_hr_or_manager());

-- ---- shifts ----
create policy "shifts visible to all authenticated"
  on shifts for select using (auth.role() = 'authenticated');
create policy "shifts managed by hr/manager"
  on shifts for all using (public.is_hr_or_manager());

-- ---- timesheets ----
create policy "timesheets visible to hr/manager"
  on timesheets for select using (public.is_hr_or_manager());
create policy "timesheets own visible"
  on timesheets for select using (employee_id = auth.uid());
create policy "timesheets managed by hr admin"
  on timesheets for all using (public.is_hr_admin());

-- ---- leave_requests ----
create policy "leave visible to hr/manager"
  on leave_requests for select using (public.is_hr_or_manager());
create policy "leave own visible"
  on leave_requests for select using (employee_id = auth.uid());
create policy "leave insert own"
  on leave_requests for insert with check (employee_id = auth.uid());
create policy "leave managed by hr admin"
  on leave_requests for update using (public.is_hr_admin());

-- ---- skilling_progress / workforce_forecast / performance_metrics (read-only analytics) ----
create policy "skilling readable"
  on skilling_progress for select using (auth.role() = 'authenticated');
create policy "skilling managed by hr admin"
  on skilling_progress for all using (public.is_hr_admin());
create policy "forecast readable"
  on workforce_forecast for select using (auth.role() = 'authenticated');
create policy "forecast managed by hr admin"
  on workforce_forecast for all using (public.is_hr_admin());
create policy "performance readable"
  on performance_metrics for select using (auth.role() = 'authenticated');
create policy "performance managed by hr admin"
  on performance_metrics for all using (public.is_hr_admin());

-- ---- freight_loads ----
create policy "loads visible to all authenticated"
  on freight_loads for select using (auth.role() = 'authenticated');
create policy "loads managed by hr/manager"
  on freight_loads for all using (public.is_hr_or_manager());
