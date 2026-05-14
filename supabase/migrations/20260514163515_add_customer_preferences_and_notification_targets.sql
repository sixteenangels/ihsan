CREATE TABLE IF NOT EXISTS public.customer_preferences (
  user_id uuid PRIMARY KEY,
  region text,
  interests text[] NOT NULL DEFAULT '{}',
  order_updates_enabled boolean NOT NULL DEFAULT true,
  deal_alerts_enabled boolean NOT NULL DEFAULT true,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own customer preferences" ON public.customer_preferences;
CREATE POLICY "Users can view their own customer preferences"
ON public.customer_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own customer preferences" ON public.customer_preferences;
CREATE POLICY "Users can insert their own customer preferences"
ON public.customer_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own customer preferences" ON public.customer_preferences;
CREATE POLICY "Users can update their own customer preferences"
ON public.customer_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all customer preferences" ON public.customer_preferences;
CREATE POLICY "Admins can manage all customer preferences"
ON public.customer_preferences
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()));

DROP TRIGGER IF EXISTS update_customer_preferences_updated_at ON public.customer_preferences;
CREATE TRIGGER update_customer_preferences_updated_at
BEFORE UPDATE ON public.customer_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
