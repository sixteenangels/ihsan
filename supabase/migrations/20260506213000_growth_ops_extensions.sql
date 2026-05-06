ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS supplier_sku text,
ADD COLUMN IF NOT EXISTS procurement_notes text,
ADD COLUMN IF NOT EXISTS expected_restock_date date;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_logs;
CREATE POLICY "Admins can manage audit logs"
ON public.audit_logs
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON public.audit_logs(entity_type, entity_id);

INSERT INTO public.store_settings (key, value)
VALUES
  ('giftCardsEnabled', 'true'::jsonb),
  ('loyaltyPointsToCurrencyRate', '0.01'::jsonb),
  ('loyaltyMinRedeemPoints', '100'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_card public.gift_cards%ROWTYPE;
  redeem_amount numeric;
  wallet_reference text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a gift card.';
  END IF;

  SELECT *
  INTO target_card
  FROM public.gift_cards
  WHERE upper(code) = upper(trim(input_code))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift card not found.';
  END IF;

  IF coalesce(target_card.is_active, true) = false THEN
    RAISE EXCEPTION 'This gift card is inactive.';
  END IF;

  IF target_card.expires_at IS NOT NULL AND target_card.expires_at < now() THEN
    RAISE EXCEPTION 'This gift card has expired.';
  END IF;

  IF target_card.redeemed_by IS NOT NULL THEN
    RAISE EXCEPTION 'This gift card has already been redeemed.';
  END IF;

  redeem_amount := coalesce(target_card.balance, 0);
  IF redeem_amount <= 0 THEN
    RAISE EXCEPTION 'This gift card has no remaining balance.';
  END IF;

  wallet_reference := format('gift-card:%s:%s', target_card.id, current_user_id);

  UPDATE public.gift_cards
  SET redeemed_by = current_user_id,
      balance = 0
  WHERE id = target_card.id;

  INSERT INTO public.wallet_transactions (
    user_id,
    amount,
    type,
    description,
    created_by,
    reference_key
  )
  VALUES (
    current_user_id,
    redeem_amount,
    'credit',
    format('Gift card %s redeemed', target_card.code),
    current_user_id,
    wallet_reference
  )
  ON CONFLICT (reference_key) DO NOTHING;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type
  )
  VALUES (
    current_user_id,
    'Gift Card Redeemed',
    format('Gift card %s added GHS %s to your wallet.', target_card.code, to_char(redeem_amount, 'FM999999990.00')),
    'wallet'
  );

  RETURN jsonb_build_object(
    'gift_card_id', target_card.id,
    'code', target_card.code,
    'amount', redeem_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text) TO authenticated;
