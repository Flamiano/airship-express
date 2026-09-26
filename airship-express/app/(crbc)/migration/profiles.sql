create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text null,
  role text not null default 'customer'::text,
  contact_number integer null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;