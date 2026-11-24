BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text,
  page text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx
  ON public.ai_conversations (user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'assistant')),
  content text NOT NULL,
  structured_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx
  ON public.ai_messages (conversation_id, created_at);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_service_role_ai_conversations
  ON public.ai_conversations;
CREATE POLICY allow_service_role_ai_conversations
  ON public.ai_conversations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS allow_owner_select_ai_conversations
  ON public.ai_conversations;
CREATE POLICY allow_owner_select_ai_conversations
  ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS allow_service_role_ai_messages
  ON public.ai_messages;
CREATE POLICY allow_service_role_ai_messages
  ON public.ai_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS allow_owner_select_ai_messages
  ON public.ai_messages;
CREATE POLICY allow_owner_select_ai_messages
  ON public.ai_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations AS conversation
      WHERE conversation.id = ai_messages.conversation_id
        AND conversation.user_id = auth.uid()
    )
  );

COMMIT;
