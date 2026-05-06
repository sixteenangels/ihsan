
-- 1. Auto-approve all reviews going forward
ALTER TABLE public.reviews ALTER COLUMN is_approved SET DEFAULT true;
UPDATE public.reviews SET is_approved = true WHERE is_approved = false OR is_approved IS NULL;

-- 2. Add fragile + reinforced packaging cost to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_fragile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reinforced_packaging_cost numeric;

-- 3. Seed global default reinforced packaging cost in store_settings
INSERT INTO public.store_settings (key, value)
VALUES ('reinforced_packaging_default_cost', '25'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Add packaging + wallet + selected items to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS packaging_type text,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_credit_used numeric DEFAULT 0;

-- 5. Wallet transactions table (admin-credited store credit)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text NOT NULL,
  order_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can manage wallet transactions"
  ON public.wallet_transactions FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id);

-- 6. Admin message templates
CREATE TABLE IF NOT EXISTS public.admin_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage message templates"
  ON public.admin_message_templates FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE TRIGGER admin_message_templates_updated_at
  BEFORE UPDATE ON public.admin_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Seed Standard Courier shipping class
DO $$
DECLARE
  air_type_id uuid;
BEGIN
  -- Try to find an existing "Air" or any active shipping type to attach to
  SELECT id INTO air_type_id FROM public.shipping_types WHERE is_active = true ORDER BY created_at LIMIT 1;

  IF air_type_id IS NULL THEN
    INSERT INTO public.shipping_types (name, description, is_active)
    VALUES ('Courier', 'Local courier delivery', true)
    RETURNING id INTO air_type_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shipping_classes WHERE name = 'Standard Courier (Pay Delivery Fee on Receipt)'
  ) THEN
    INSERT INTO public.shipping_classes (shipping_type_id, name, estimated_days_min, estimated_days_max, base_price, is_active)
    VALUES (air_type_id, 'Standard Courier (Pay Delivery Fee on Receipt)', 1, 3, 0, true);
  END IF;
END $$;
