-- Fleet AI conversation memory.
-- Written and read exclusively by the Express backend using the service
-- role key (see services/fleetAiService.js). RLS is enabled with a
-- permissive service-role policy plus an authenticated "own rows only"
-- policy, matching the pattern used by the other FTM tables.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text,
  page text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_id_idx on public.ai_conversations (user_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null,
  structured_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_id_idx on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists allow_service_role_ai_conversations on public.ai_conversations;
create policy allow_service_role_ai_conversations
  on public.ai_conversations
  for all
  to public
  using (true)
  with check (true);

drop policy if exists allow_owner_select_ai_conversations on public.ai_conversations;
create policy allow_owner_select_ai_conversations
  on public.ai_conversations
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists allow_service_role_ai_messages on public.ai_messages;
create policy allow_service_role_ai_messages
  on public.ai_messages
  for all
  to public
  using (true)
  with check (true);

drop policy if exists allow_owner_select_ai_messages on public.ai_messages;
create policy allow_owner_select_ai_messages
  on public.ai_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
