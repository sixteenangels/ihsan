-- Support intake for guests and tracked refund wallet credits.

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  source text NOT NULL DEFAULT 'help_center',
  internal_notes text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Admins can manage support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Users can view their own support requests" ON public.support_requests;

CREATE POLICY "Anyone can submit support requests"
ON public.support_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage support requests"
ON public.support_requests
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view their own support requests"
ON public.support_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created_at
ON public.support_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS update_support_requests_updated_at ON public.support_requests;
CREATE TRIGGER update_support_requests_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS reference_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_reference_key
ON public.wallet_transactions(reference_key)
WHERE reference_key IS NOT NULL;

ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS refund_channel text NOT NULL DEFAULT 'original_payment'
    CHECK (refund_channel IN ('original_payment', 'wallet_credit', 'mixed')),
  ADD COLUMN IF NOT EXISTS wallet_credit_amount numeric NOT NULL DEFAULT 0;

INSERT INTO public.store_settings (key, value)
VALUES
  ('supportEmail', '"halimaahmed621@gmail.com"'::jsonb),
  ('supportPhone', '""'::jsonb),
  ('supportLocation', '"Accra, Ghana"'::jsonb),
  ('supportHours', '"9 AM - 6 PM GMT"'::jsonb)
ON CONFLICT (key) DO NOTHING;
