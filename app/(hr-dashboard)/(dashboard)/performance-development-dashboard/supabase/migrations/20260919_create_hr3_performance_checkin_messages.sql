create table public.hr3_performance_checkin_messages (
  id uuid not null default gen_random_uuid (),
  check_in_id uuid not null,
  parent_message_id uuid null,
  employee_id uuid not null,
  author_employee_id uuid not null,
  author_account_id uuid null,
  message_kind text not null default 'message'::text,
  message text not null,
  created_at timestamp with time zone not null default now(),
  constraint hr3_performance_checkin_messages_pkey primary key (id),
  constraint hr3_performance_checkin_messages_check_in_id_fkey foreign KEY (check_in_id) references hr3_performance_feedback (id) on delete CASCADE,
  constraint hr3_performance_checkin_messages_parent_message_id_fkey foreign KEY (parent_message_id) references hr3_performance_checkin_messages (id) on delete CASCADE,
  constraint hr3_performance_checkin_messages_employee_id_fkey foreign KEY (employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr3_performance_checkin_messages_author_employee_id_fkey foreign KEY (author_employee_id) references hr1_employees (id) on delete CASCADE,
  constraint hr3_performance_checkin_messages_author_account_id_fkey foreign KEY (author_account_id) references hr_admin (id) on delete set NULL,
  constraint hr3_performance_checkin_messages_message_kind_check check (
    message_kind = any (
      array['message'::text, 'reply'::text, 'acknowledgment'::text]
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_hr3_performance_checkin_messages_thread
  on public.hr3_performance_checkin_messages using btree (check_in_id, created_at, id) TABLESPACE pg_default;

create unique index IF not exists uq_hr3_performance_checkin_messages_ack
  on public.hr3_performance_checkin_messages (check_in_id, author_employee_id)
  where message_kind = 'acknowledgment'::text;