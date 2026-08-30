-- Customer Interactions
-- Channel (WALK_IN / PHONE_CALL / PORTAL) belongs here, NOT on the customers record.

create table public.customer_interactions (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  interaction_type text not null,
  notes text null,
  interaction_date timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint customer_interactions_pkey primary key (id),
  constraint customer_interactions_customer_id_fkey foreign key (customer_id)
    references customers (id)
    on delete cascade,
  constraint customer_interactions_type_check check (
    interaction_type = any (
      array['WALK_IN'::text, 'PHONE_CALL'::text, 'PORTAL'::text]
    )
  )
) TABLESPACE pg_default;

create index if not exists customer_interactions_customer_id_idx
  on public.customer_interactions (customer_id);

alter table public.customer_interactions enable row level security;

create policy "Staff can read customer interactions"
  on public.customer_interactions for select
  using (true);

create policy "Staff can create customer interactions"
  on public.customer_interactions for insert
  with check (true);

-- Remove channel from the permanent customer identity.
-- Channel is transactional: it lives on customer_interactions / booking_requests.
alter table public.customers drop constraint if exists customers_source_check;
alter table public.customers drop column if exists source;
