CREATE OR REPLACE FUNCTION private.redeem_gift_card_internal(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  IF COALESCE(target_card.is_active, true) = false THEN
    RAISE EXCEPTION 'This gift card is inactive.';
  END IF;

  IF target_card.expires_at IS NOT NULL AND target_card.expires_at < now() THEN
    RAISE EXCEPTION 'This gift card has expired.';
  END IF;

  IF target_card.redeemed_by IS NOT NULL THEN
    RAISE EXCEPTION 'This gift card has already been redeemed.';
  END IF;

  redeem_amount := COALESCE(target_card.balance, 0);
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
  ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

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
$function$;

REVOKE ALL ON FUNCTION private.redeem_gift_card_internal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.redeem_gift_card_internal(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
