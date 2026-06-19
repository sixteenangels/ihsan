-- Expose checkout savings toggles publicly and enforce them server-side.

INSERT INTO public.store_settings (key, value)
VALUES ('couponsEnabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.store_setting_is_enabled(
  setting_key text,
  default_enabled boolean DEFAULT true
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT COALESCE(
    CASE
      WHEN value = 'true'::jsonb THEN true
      WHEN value = 'false'::jsonb THEN false
      WHEN jsonb_typeof(value) = 'boolean' THEN (value)::text::boolean
      WHEN jsonb_typeof(value) = 'string' THEN lower(trim(both '"' from value::text)) = 'true'
      ELSE default_enabled
    END,
    default_enabled
  )
  FROM public.store_settings
  WHERE key = setting_key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.get_public_store_settings()
RETURNS TABLE (
  key text,
  value jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT store_settings.key, store_settings.value
  FROM public.store_settings
  WHERE store_settings.key = ANY (
    ARRAY[
      'group_buy_settings',
      'heroCarouselImages',
      'loyaltyEnabled',
      'loyaltyPointsPerOrder',
      'loyaltyPointsToCurrencyRate',
      'loyaltyMinOrderAmount',
      'loyaltyMinRedeemPoints',
      'couponsEnabled',
      'giftCardsEnabled',
      'maintenanceEndTime',
      'maintenanceMode',
      'maintenanceStartTime',
      'mapProvider',
      'mapboxPublicKey',
      'mapbox_public_key',
      'reinforcedPackagingCost',
      'supportEmail',
      'supportHours',
      'supportLocation',
      'supportPhone',
      'vapidPublicKey',
      'vapid_public_key'
    ]
  )
  OR store_settings.key LIKE 'feature\_%' ESCAPE '\';
$$;

CREATE OR REPLACE FUNCTION public.validate_coupon_by_code(
  coupon_code_input text,
  order_subtotal_input numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  target_coupon public.coupons%ROWTYPE;
  normalized_code text := upper(trim(coupon_code_input));
  prior_order_count integer := 0;
BEGIN
  IF NOT private.store_setting_is_enabled('couponsEnabled', true) THEN
    RAISE EXCEPTION 'Coupons are currently disabled.';
  END IF;

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to apply a coupon.';
  END IF;

  IF normalized_code IS NULL OR normalized_code = '' THEN
    RAISE EXCEPTION 'Please enter a coupon code.';
  END IF;

  SELECT *
  INTO target_coupon
  FROM public.coupons
  WHERE upper(code) = normalized_code
  LIMIT 1;

  IF NOT FOUND OR COALESCE(target_coupon.is_active, false) = false THEN
    RAISE EXCEPTION 'Invalid coupon code.';
  END IF;

  IF target_coupon.starts_at IS NOT NULL AND target_coupon.starts_at > now() THEN
    RAISE EXCEPTION 'This coupon is not active yet.';
  END IF;

  IF target_coupon.expires_at IS NOT NULL AND target_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'This coupon has expired.';
  END IF;

  IF target_coupon.min_order_amount IS NOT NULL
     AND COALESCE(order_subtotal_input, 0) < target_coupon.min_order_amount THEN
    RAISE EXCEPTION 'This order does not meet the coupon minimum.';
  END IF;

  IF target_coupon.max_uses IS NOT NULL
     AND COALESCE(target_coupon.current_uses, 0) >= target_coupon.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions
    WHERE coupon_id = target_coupon.id
      AND user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'You have already used this coupon.';
  END IF;

  IF COALESCE(target_coupon.first_order_only, false) THEN
    SELECT count(*)
    INTO prior_order_count
    FROM public.orders
    WHERE user_id = current_user_id
      AND status <> 'cancelled';

    IF prior_order_count > 0 THEN
      RAISE EXCEPTION 'This coupon is only available for first orders.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', target_coupon.id,
    'code', target_coupon.code,
    'type', target_coupon.type,
    'value', target_coupon.value,
    'min_order_amount', target_coupon.min_order_amount,
    'max_uses', target_coupon.max_uses,
    'current_uses', target_coupon.current_uses,
    'starts_at', target_coupon.starts_at,
    'expires_at', target_coupon.expires_at,
    'auto_apply', target_coupon.auto_apply,
    'first_order_only', target_coupon.first_order_only,
    'marketing_label', target_coupon.marketing_label,
    'is_active', target_coupon.is_active
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF NOT private.store_setting_is_enabled('giftCardsEnabled', true) THEN
    RAISE EXCEPTION 'Gift card redemption is currently disabled.';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a gift card.';
  END IF;

  RETURN private.redeem_gift_card_internal(input_code);
END;
$function$;

NOTIFY pgrst, 'reload schema';
