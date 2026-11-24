-- RBAC role-change audit trail. Apply this migration in Supabase before using role management.
CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  old_role text,
  new_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_change_audit_admin_read ON public.role_change_audit;
CREATE POLICY role_change_audit_admin_read ON public.role_change_audit
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS role_change_audit_service_role ON public.role_change_audit;
CREATE POLICY role_change_audit_service_role ON public.role_change_audit
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
