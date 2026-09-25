-- ==================================================================================================
-- WORKFORCE MANAGEMENT DATABASE REFERENCE (LOCKED-IN VERSION)
-- Scope: HR/Workforce Submodule + Basic HR1 Integration
-- ==================================================================================================

-- 1. Create AI schema for pgvector
create schema ai_analytics;

-- ==================================================================================================
-- HR1 INTEGRATIONS (Core Employee & Positions)
-- ==================================================================================================

create table public.hr1_job_positions (
  id uuid not null default gen_random_uuid (),
  title character varying not null,
  department character varying not null,
  description text not null,
  requirements text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hr1_job_positions_pkey primary key (id)
) TABLESPACE pg_default;

create table public.hr1_employees (
  id uuid not null default gen_random_uuid (),
  email text not null,
  full_name text not null,
  position_id uuid null,
  role text not null,
  avatar_initials text null,
  terminal text null,
  rfid_uid text null,
  created_at timestamp with time zone null default now(),
  constraint hr1_employees_pkey primary key (id),
  constraint hr1_employees_position_id_fkey foreign key (position_id) references public.hr1_job_positions (id) on delete set null
) TABLESPACE pg_default;

-- ==================================================================================================
-- HR2 WORKFORCE MANAGEMENT
-- ==================================================================================================

-- 2. Audit Logs
create table public.hr2_audit_logs (
  id uuid not null default gen_random_uuid (),
  admin_id uuid not null,
  action_type text not null,
  table_affected text not null,
  record_id uuid not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamp with time zone null default now(),
  constraint hr2_audit_logs_pkey primary key (id)
) TABLESPACE pg_default;

-- 3. System Settings
create table public.hr2_system_settings (
  id uuid not null default gen_random_uuid (),
  setting_key text not null,
  setting_value text not null,
  description text null,
  updated_at timestamp with time zone null default now(),
  constraint hr2_system_settings_pkey primary key (id),
  constraint hr2_system_settings_key_unique unique (setting_key)
) TABLESPACE pg_default;

-- Initialize default settings
insert into public.hr2_system_settings (setting_key, setting_value, description) values
  ('late_threshold_minutes', '15', 'Minutes past schedule before an employee is tagged as Tardy.'),
  ('absent_threshold_minutes', '120', 'Minutes past schedule before an employee is tagged as Absent.'),
  ('awol_threshold_days', '3', 'Consecutive days absent before an employee is tagged as AWOL.')
on conflict (setting_key) do nothing;

-- 4. Attendance Logs
create table public.hr2_attendance_logs (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  status text not null,
  shift_start time without time zone not null,
  shift_end time without time zone not null,
  terminal text not null,
  last_scan timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  time_in timestamp with time zone null default now(),
  time_out timestamp with time zone null,
  is_deleted boolean not null default false,
  constraint hr2_attendance_logs_pkey primary key (id),
  constraint hr2_attendance_logs_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete CASCADE,
  constraint hr2_attendance_logs_status_check check (
    status in ('On-Shift', 'On-Break', 'Tardy', 'Absent', 'Clocked Out')
  )
) TABLESPACE pg_default;

create index idx_hr2_attendance_employee on public.hr2_attendance_logs using btree (employee_id);

-- 5. Leave Requests
create table public.hr2_leave_requests (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days_count integer not null,
  reason text null,
  status text not null,
  balance_remaining integer null default 0,
  created_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  constraint hr2_leave_requests_pkey primary key (id),
  constraint hr2_leave_requests_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete CASCADE,
  constraint hr2_leave_requests_status_check check (
    status in ('Pending HR Review', 'Approved', 'Rejected', 'Cancelled')
  )
) TABLESPACE pg_default;

create index idx_hr2_leave_employee on public.hr2_leave_requests using btree (employee_id);

-- 6. Performance Metrics
create table public.hr2_performance_metrics (
  id uuid not null default gen_random_uuid (),
  snapshot_date date not null default CURRENT_DATE,
  avg_rating numeric(2, 1) not null,
  on_time_rate numeric(4, 1) not null,
  task_completion_rate numeric(4, 1) not null,
  active_courses integer not null default 0,
  top_performers_pct numeric(5, 2) null,
  steady_workers_pct numeric(5, 2) null,
  needs_review_pct numeric(5, 2) null,
  updated_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  constraint hr2_performance_metrics_pkey primary key (id)
) TABLESPACE pg_default;

-- 7. RFID Bindings
create table public.hr2_rfid_bind (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  rfid_uid text not null,
  card_status text not null default 'Active',
  issued_at timestamp with time zone null default now(),
  last_used_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  constraint hr2_rfid_bind_pkey primary key (id),
  constraint hr2_rfid_bind_employee_id_key unique (employee_id),
  constraint hr2_rfid_bind_rfid_uid_key unique (rfid_uid),
  constraint hr2_rfid_bind_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete CASCADE,
  constraint hr2_rfid_bind_card_status_check check (
    card_status in ('Active', 'Suspended', 'Lost')
  )
) TABLESPACE pg_default;

create index idx_hr2_rfid_employee on public.hr2_rfid_bind using btree (employee_id);
create index idx_hr2_rfid_uid on public.hr2_rfid_bind using btree (rfid_uid);

-- 8. Shifts
create table public.hr2_shifts (
  id uuid not null default gen_random_uuid (),
  title text not null,
  employee_id uuid null,
  shift_date date not null,
  
  -- Office Specific
  shift_time text null,
  break_duration_minutes integer null default 0,
  
  -- Rider Specific
  vehicle text null,
  expected_arrival text null,
  gate_in text null,
  gate_out text null,
  
  status text not null,
  priority text not null,
  override_reason text null,
  created_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  
  constraint hr2_shifts_pkey primary key (id),
  constraint hr2_shifts_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete set null,
  constraint hr2_shifts_priority_check check (
    priority in ('Normal', 'High', 'Critical')
  ),
  constraint hr2_shifts_status_check check (
    status in ('Pending Driver', 'Scheduled', 'In Progress', 'Completed')
  )
) TABLESPACE pg_default;

create index idx_hr2_shifts_employee on public.hr2_shifts using btree (employee_id);

-- 9. Timesheets
create table public.hr2_timesheets (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  week_start date not null,
  week_end date not null,
  total_hours numeric(5, 2) not null default 0,
  overtime_hours numeric(5, 2) not null default 0,
  load_ref text null,
  total_pay numeric(12, 2) null default 0,
  status text not null,
  created_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  constraint hr2_timesheets_pkey primary key (id),
  constraint hr2_timesheets_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete CASCADE,
  constraint hr2_timesheets_status_check check (
    status in ('Pending Approval', 'Approved', 'Rejected', 'Flagged Overtime')
  )
) TABLESPACE pg_default;

create index idx_hr2_timesheets_employee on public.hr2_timesheets using btree (employee_id);

-- 10. Workforce Forecast
create table public.hr2_workforce_forecast (
  id uuid not null default gen_random_uuid (),
  month text not null,
  freight_volume integer not null,
  current_staff integer not null,
  required_staff integer not null,
  deficit integer generated always as (required_staff - current_staff) stored,
  workforce_demand integer null,
  active_capacity integer null,
  created_at timestamp with time zone null default now(),
  is_deleted boolean not null default false,
  constraint hr2_workforce_forecast_pkey primary key (id)
) TABLESPACE pg_default;

-- 11. AI Analytics (Vector Store for Gemma)
create table ai_analytics.employee_summaries (
  id uuid not null default gen_random_uuid(),
  employee_id uuid not null,
  summary_text text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint ai_employee_summaries_pkey primary key (id),
  constraint ai_employee_summaries_employee_id_fkey foreign key (employee_id) references public.hr1_employees (id) on delete CASCADE
) TABLESPACE pg_default;