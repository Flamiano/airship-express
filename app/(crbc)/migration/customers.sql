create table public.customers (
  id uuid not null default gen_random_uuid (),
  customer_id text not null default (
    'CUS-'::text || lpad(
      (nextval('customer_id_seq'::regclass))::text,
      4,
      '0'::text
    )
  ),
  full_name text not null,
  phone text null,
  address text null,
  created_at timestamp with time zone not null default now(),
  email text null,
  status text not null default 'active'::text,
  source text not null default 'walk_in'::text,
  auth_user_id uuid null,
  updated_at timestamp with time zone not null default now(),
  role text not null default 'customer'::text,
  constraint customers_pkey primary key (id),
  constraint customers_auth_user_id_key unique (auth_user_id),
  constraint customers_customer_id_key unique (customer_id),
  constraint customers_source_check check (
    (
      source = any (
        array['online'::text, 'walk_in'::text, 'phone'::text]
      )
    )
  ),
  constraint customers_status_check check (
    (
      status = any (array['active'::text, 'inactive'::text])
    )
  )
) TABLESPACE pg_default;