-- PerDev Feedback Requests (Phase 1: separate request model).
--
-- A request represents: "Employee A is requesting feedback from Employee B
-- about Employee A." The requested feedback is ABOUT the requester.
--
--   requester_employee_id = the employee requesting feedback (the subject).
--   recipient_employee_id = the person being asked to provide feedback (the giver).
--
-- Lifecycle (see lib/performance/feedback.ts):
--   pending   -> fulfilled (response_message + responded_at populated) or
--   pending   -> declined  (responded_at populated, response_message may stay NULL).
-- fulfilled / declined are terminal.
--
-- This table is SEPARATE from hr3_performance_feedback, which remains shared
-- live state for check_in / recognition / coaching / improvement rows and is
-- NOT modified by this migration. No second feedback-content table is created
-- in this phase.
--
-- updated_at has no database trigger (matching every other PerDev table); the
-- server stamps it on every write.

create table public.hr3_performance_feedback_requests (
  id uuid not null default gen_random_uuid (),
  requester_employee_id uuid not null,
  recipient_employee_id uuid not null,
  status text not null default 'pending'::text,
  request_message text null,
  response_message text null,
  requested_at timestamp with time zone not null default now(),
  responded_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hr3_performance_feedback_requests_pkey primary key (id),
  constraint hr3_performance_feedback_requests_requester_id_fkey foreign key (requester_employee_id) references hr1_employees (id) on delete cascade,
  constraint hr3_performance_feedback_requests_recipient_id_fkey foreign key (recipient_employee_id) references hr1_employees (id) on delete cascade,
  constraint hr3_performance_feedback_requests_status_check check (
    status = any (
      array['pending'::text, 'fulfilled'::text, 'declined'::text]
    )
  ),
  constraint hr3_performance_feedback_requests_no_self_request check (
    requester_employee_id <> recipient_employee_id
  )
) tablespace pg_default;

-- Requester history: "feedback I have requested", newest first.
create index if not exists idx_hr3_performance_feedback_requests_requester_history
  on public.hr3_performance_feedback_requests using btree (requester_employee_id, created_at desc) tablespace pg_default;

-- Recipient queue: "feedback requested from me", newest first.
create index if not exists idx_hr3_performance_feedback_requests_recipient_history
  on public.hr3_performance_feedback_requests using btree (recipient_employee_id, created_at desc) tablespace pg_default;

-- Recipient pending queue: outstanding requests addressed to one person.
-- (A bare status index is omitted: status has only three values, so only the
-- composite partial index below is useful.)
create index if not exists idx_hr3_performance_feedback_requests_recipient_pending
  on public.hr3_performance_feedback_requests using btree (recipient_employee_id, requested_at desc) tablespace pg_default
  where status = 'pending'::text;
