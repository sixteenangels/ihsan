
CREATE TABLE public.manager_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.manager_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage permissions" ON public.manager_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view own permissions" ON public.manager_permissions
  FOR SELECT USING (auth.uid() = user_id);
