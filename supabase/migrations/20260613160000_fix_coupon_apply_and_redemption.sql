-- Fix coupon validation/redemption: per-user reuse guard and explicit user id for service-role redemption.

DROP FUNCTION IF EXISTS public.mark_coupon_redeemed(uuid, uuid, numeric);

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

CREATE OR REPLACE FUNCTION public.mark_coupon_redeemed(
  coupon_id_input uuid,
  order_id_input uuid,
  discount_amount_input numeric,
  user_id_input uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  target_coupon public.coupons%ROWTYPE;
  resolved_user_id uuid;
  redemption_recorded boolean := false;
BEGIN
  resolved_user_id := COALESCE(
    user_id_input,
    auth.uid(),
    (SELECT user_id FROM public.orders WHERE id = order_id_input LIMIT 1)
  );

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve coupon redemption user.';
  END IF;

  SELECT *
  INTO target_coupon
  FROM public.coupons
  WHERE id = coupon_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;

  IF COALESCE(target_coupon.is_active, false) = false THEN
    RAISE EXCEPTION 'This coupon is inactive.';
  END IF;

  IF target_coupon.starts_at IS NOT NULL AND target_coupon.starts_at > now() THEN
    RAISE EXCEPTION 'This coupon is not active yet.';
  END IF;

  IF target_coupon.expires_at IS NOT NULL AND target_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'This coupon has expired.';
  END IF;

  IF target_coupon.max_uses IS NOT NULL
     AND COALESCE(target_coupon.current_uses, 0) >= target_coupon.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coupon_redemptions
    WHERE coupon_id = coupon_id_input
      AND user_id = resolved_user_id
      AND order_id IS DISTINCT FROM order_id_input
  ) THEN
    RAISE EXCEPTION 'You have already used this coupon.';
  END IF;

  INSERT INTO public.coupon_redemptions (
    coupon_id,
    order_id,
    user_id,
    discount_amount
  )
  VALUES (
    coupon_id_input,
    order_id_input,
    resolved_user_id,
    GREATEST(COALESCE(discount_amount_input, 0), 0)
  )
  ON CONFLICT (coupon_id, order_id) DO NOTHING
  RETURNING true INTO redemption_recorded;

  IF redemption_recorded THEN
    UPDATE public.coupons
    SET current_uses = COALESCE(current_uses, 0) + 1
    WHERE id = coupon_id_input;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_coupon_redeemed(uuid, uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_coupon_redeemed(uuid, uuid, numeric, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
