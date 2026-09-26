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
  constraint hr2_attendance_logs_pkey primary key (id),
  constraint hr2_attendance_logs_employee_id_fkey foreign KEY (employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr2_attendance_logs_status_check check (
    (
      status = any (
        array[
          'On-Shift'::text,
          'On-Break'::text,
          'Tardy'::text,
          'Absent'::text,
          'Clocked Out'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_attendance_employee on public.hr2_attendance_logs using btree (employee_id) TABLESPACE pg_default;

create table public.hr2_freight_loads (
  id uuid not null default gen_random_uuid (),
  load_ref text not null,
  origin text not null,
  destination text not null,
  pickup_date date not null,
  status text not null,
  priority text not null,
  driver_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint hr2_freight_loads_pkey primary key (id),
  constraint hr2_freight_loads_load_ref_key unique (load_ref),
  constraint hr2_freight_loads_driver_id_fkey foreign KEY (driver_id) references hr1_employees (id) on delete set null,
  constraint hr2_freight_loads_priority_check check (
    (
      priority = any (
        array['Normal'::text, 'High'::text, 'Critical'::text]
      )
    )
  ),
  constraint hr2_freight_loads_status_check check (
    (
      status = any (
        array[
          'Pending Driver'::text,
          'Scheduled'::text,
          'In Transit'::text,
          'Delivered'::text,
          'On Hold'::text,
          'Cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_freight_driver on public.hr2_freight_loads using btree (driver_id) TABLESPACE pg_default;

create index IF not exists idx_hr2_freight_status on public.hr2_freight_loads using btree (status) TABLESPACE pg_default;

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
  constraint hr2_leave_requests_pkey primary key (id),
  constraint hr2_leave_requests_employee_id_fkey foreign KEY (employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr2_leave_requests_status_check check (
    (
      status = any (
        array[
          'Pending HR Review'::text,
          'Approved'::text,
          'Rejected'::text,
          'Cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_leave_employee on public.hr2_leave_requests using btree (employee_id) TABLESPACE pg_default;

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
  constraint hr2_leave_requests_pkey primary key (id),
  constraint hr2_leave_requests_employee_id_fkey foreign KEY (employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr2_leave_requests_status_check check (
    (
      status = any (
        array[
          'Pending HR Review'::text,
          'Approved'::text,
          'Rejected'::text,
          'Cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_leave_employee on public.hr2_leave_requests using btree (employee_id) TABLESPACE pg_default;

create table public.hr2_performance_metrics (
  id uuid not null default gen_random_uuid (),
  snapshot_date date not null default CURRENT_DATE,
  avg_rating numeric(2, 1) not null,
  on_time_rate numeric(4, 1) not null,
  task_completion_rate numeric(4, 1) not null,
  active_courses integer not null default 0,
  updated_at timestamp with time zone null default now(),
  constraint hr2_performance_metrics_pkey primary key (id)
) TABLESPACE pg_default;

create table public.hr2_rfid_bind (
  id uuid not null default gen_random_uuid (),
  employee_id uuid not null,
  rfid_uid text not null,
  card_status text not null default 'Active'::text,
  issued_at timestamp with time zone null default now(),
  last_used_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint hr2_rfid_bind_pkey primary key (id),
  constraint hr2_rfid_bind_employee_id_key unique (employee_id),
  constraint hr2_rfid_bind_rfid_uid_key unique (rfid_uid),
  constraint hr2_rfid_bind_employee_id_fkey foreign KEY (employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr2_rfid_bind_card_status_check check (
    (
      card_status = any (
        array['Active'::text, 'Suspended'::text, 'Lost'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_rfid_employee on public.hr2_rfid_bind using btree (employee_id) TABLESPACE pg_default;

create index IF not exists idx_hr2_rfid_uid on public.hr2_rfid_bind using btree (rfid_uid) TABLESPACE pg_default;

create table public.hr2_shifts (
  id uuid not null default gen_random_uuid (),
  title text not null,
  driver_id uuid null,
  vehicle text not null,
  shift_date date not null,
  shift_time text not null,
  status text not null,
  priority text not null,
  created_at timestamp with time zone null default now(),
  constraint hr2_shifts_pkey primary key (id),
  constraint hr2_shifts_driver_id_fkey foreign KEY (driver_id) references hr1_employees (id) on delete set null,
  constraint hr2_shifts_priority_check check (
    (
      priority = any (
        array['Normal'::text, 'High'::text, 'Critical'::text]
      )
    )
  ),
  constraint hr2_shifts_status_check check (
    (
      status = any (
        array[
          'Pending Driver'::text,
          'Scheduled'::text,
          'In Progress'::text,
          'Completed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr2_shifts_driver on public.hr2_shifts using btree (driver_id) TABLESPACE pg_default;

create table public.hr2_skilling_progress (
  id uuid not null default gen_random_uuid (),
  department text not null,
  certified_count integer not null default 0,
  total_count integer not null default 0,
  created_at timestamp with time zone null default now(),
  constraint hr2_skilling_progress_pkey primary key (id)
) TABLESPACE pg_default;

create table public.hr2_workforce_forecast (
  id uuid not null default gen_random_uuid (),
  month text not null,
  freight_volume integer not null,
  current_staff integer not null,
  required_staff integer not null,
  created_at timestamp with time zone null default now(),
  constraint hr2_workforce_forecast_pkey primary key (id)
) TABLESPACE pg_default;