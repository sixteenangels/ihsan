-- Harden publicly exposed policies and RPC surfaces without changing app behavior.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can submit support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Guests can submit support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Authenticated users can create their own support requests" ON public.support_requests;

CREATE POLICY "Guests can submit support requests"
ON public.support_requests
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND status = 'new'
  AND priority IN ('normal', 'high')
  AND source IN ('help_center', 'delivery_issue_center')
  AND internal_notes IS NULL
  AND responded_at IS NULL
  AND assigned_admin_id IS NULL
  AND public_reply IS NULL
  AND resolution_summary IS NULL
  AND order_id IS NULL
  AND support_type IS NULL
  AND delivery_date IS NULL
  AND customer_phone IS NULL
  AND COALESCE(array_length(attachment_paths, 1), 0) = 0
);

CREATE POLICY "Authenticated users can create their own support requests"
ON public.support_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'new'
  AND source IN ('help_center', 'delivery_issue_center', 'after_sales_service')
  AND internal_notes IS NULL
  AND responded_at IS NULL
  AND assigned_admin_id IS NULL
  AND public_reply IS NULL
  AND resolution_summary IS NULL
);

DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Profile avatars are publicly accessible" ON storage.objects;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
  SELECT private.has_role(_user_id, _role);
$function$;

CREATE OR REPLACE FUNCTION private.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  );
$function$;

REVOKE ALL ON FUNCTION private.is_admin_or_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin_or_manager(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $function$
  SELECT private.is_admin_or_manager(_user_id);
$function$;

CREATE OR REPLACE FUNCTION private.check_expired_group_buys_internal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb public.group_buys%ROWTYPE;
  participant RECORD;
  now_value timestamptz := now();
  v_send_notifications boolean := true;
BEGIN
  FOR gb IN
    SELECT *
    FROM public.group_buys
    WHERE status = 'open'
      AND COALESCE(current_participants, 0) < min_participants
      AND COALESCE(extension_used, false) = false
      AND extension_notice_sent_at IS NULL
      AND expires_at > now_value
      AND expires_at <= now_value + interval '1 hour'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      gb.created_by,
      'Group Buy Expiring Soon',
      'Your group buy "' || COALESCE(gb.title, 'Group Buy') || '" has less than 1 hour left. You can extend it once by 2, 4, or 6 hours if it is still not filled.',
      'group_buy',
      jsonb_build_object('group_buy_id', gb.id, 'expires_at', gb.expires_at, 'can_extend', true)
    );

    UPDATE public.group_buys
    SET extension_notice_sent_at = now_value,
        updated_at = now_value
    WHERE id = gb.id;
  END LOOP;

  FOR gb IN
    SELECT *
    FROM public.group_buys
    WHERE status = 'open'
      AND expires_at <= now_value
  LOOP
    v_send_notifications := COALESCE((COALESCE(gb.settings, '{}'::jsonb)->>'automaticParticipantNotifications')::boolean, true);

    IF COALESCE(gb.current_participants, 0) >= gb.min_participants THEN
      UPDATE public.group_buys
      SET status = 'filled',
          updated_at = now_value
      WHERE id = gb.id;

      IF v_send_notifications THEN
        FOR participant IN
          SELECT user_id
          FROM public.group_buy_participants
          WHERE group_buy_id = gb.id
        LOOP
          INSERT INTO public.notifications (user_id, title, message, type, data)
          VALUES (
            participant.user_id,
            'Group Buy Closed Successfully',
            'The group buy "' || COALESCE(gb.title, 'Group Buy') || '" closed with enough participants and is now ready for fulfillment.',
            'group_buy',
            jsonb_build_object('group_buy_id', gb.id)
          );
        END LOOP;
      END IF;
    ELSE
      UPDATE public.group_buys
      SET status = 'cancelled',
          updated_at = now_value
      WHERE id = gb.id;

      IF v_send_notifications THEN
        FOR participant IN
          SELECT user_id
          FROM public.group_buy_participants
          WHERE group_buy_id = gb.id
        LOOP
          INSERT INTO public.notifications (user_id, title, message, type, data)
          VALUES (
            participant.user_id,
            'Group Buy Expired',
            'The group buy "' || COALESCE(gb.title, 'Group Buy') || '" expired without reaching its goal. Refund processing will begin.',
            'group_buy',
            jsonb_build_object('group_buy_id', gb.id)
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION private.check_expired_group_buys_internal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.check_expired_group_buys_internal() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    PERFORM private.check_expired_group_buys_internal();
    RETURN;
  END IF;

  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and managers can run this job.';
  END IF;

  PERFORM private.check_expired_group_buys_internal();
END;
$function$;

REVOKE ALL ON FUNCTION public.check_expired_group_buys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_expired_group_buys() TO authenticated, service_role;

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
$function$;

REVOKE ALL ON FUNCTION private.redeem_gift_card_internal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.redeem_gift_card_internal(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_gift_card(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a gift card.';
  END IF;

  RETURN private.redeem_gift_card_internal(input_code);
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_gift_card(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_coupon_redeemed(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_referral_code_total() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
