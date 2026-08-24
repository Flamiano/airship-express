create table public.delivery_policies (
  id uuid not null default gen_random_uuid (),
  policy text not null,
  coverage text not null,
  min_days integer not null,
  max_days integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint delivery_policies_pkey primary key (id),
  constraint delivery_policies_check check ((max_days >= min_days)),
  constraint delivery_policies_min_days_check check ((min_days >= 1))
) TABLESPACE pg_default;