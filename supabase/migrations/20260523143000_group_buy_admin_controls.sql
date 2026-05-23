ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.group_buys
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'minParticipantsRequired', GREATEST(COALESCE(min_participants, 2), 2),
  'maxParticipantsAllowed', GREATEST(COALESCE(max_participants, min_participants, 2), 2),
  'countdownDurationValue', 48,
  'countdownDurationUnit', 'hours',
  'autoCloseWhenFull', true,
  'autoConfirmWhenTargetReached', false,
  'manualConfirmationRequired', true,
  'visibleByDefault', true,
  'featuredByDefault', false,
  'participationOpen', CASE WHEN status = 'cancelled' THEN false ELSE true END,
  'allowPartialFulfillment', false,
  'participantLimitPerUser', 1,
  'allowDuplicateParticipation', false,
  'requireFullPaymentBeforeJoining', true,
  'automaticParticipantNotifications', true,
  'allowAdminCancellation', true,
  'allowedShippingMethods', jsonb_build_array('air_shipping', 'sea_shipping', 'courier_delivery'),
  'defaultShippingMethod', 'air_shipping'
)
WHERE settings = '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.join_group_buy_after_payment(
  p_group_buy_id uuid,
  p_quantity integer,
  p_variant_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL,
  p_invite_code text DEFAULT NULL,
  p_referred_by_user_id uuid DEFAULT NULL,
  p_unit_price_at_join numeric DEFAULT NULL,
  p_tier_label_at_join text DEFAULT NULL
)
RETURNS public.group_buy_participants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_group_buy public.group_buys%ROWTYPE;
  v_existing public.group_buy_participants%ROWTYPE;
  v_participant public.group_buy_participants%ROWTYPE;
  v_cap integer;
  v_settings jsonb := '{}'::jsonb;
  v_participation_open boolean := true;
  v_allow_duplicate_participation boolean := false;
  v_participant_limit integer := 1;
  v_payment_status text := 'reserved';
  v_existing_quantity integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in to join this group buy';
  END IF;

  IF p_group_buy_id IS NULL THEN
    RAISE EXCEPTION 'Missing group buy';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Choose at least one item';
  END IF;

  v_payment_status := CASE
    WHEN p_payment_reference IS NULL OR btrim(p_payment_reference) = '' THEN 'reserved'
    ELSE 'paid'
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_group_buy_id::text, 0));

  SELECT *
  INTO v_group_buy
  FROM public.group_buys
  WHERE id = p_group_buy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group buy not found';
  END IF;

  v_settings := COALESCE(v_group_buy.settings, '{}'::jsonb);
  v_participation_open := COALESCE((v_settings->>'participationOpen')::boolean, true);
  v_allow_duplicate_participation := COALESCE((v_settings->>'allowDuplicateParticipation')::boolean, false);
  v_participant_limit := GREATEST(COALESCE((v_settings->>'participantLimitPerUser')::integer, 1), 1);

  IF COALESCE((v_settings->>'requireFullPaymentBeforeJoining')::boolean, true)
     AND v_payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Full payment is required before joining this group buy';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.group_buy_participants
  WHERE group_buy_id = p_group_buy_id
    AND user_id = v_user_id;

  IF v_group_buy.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'This group buy is no longer open';
  END IF;

  IF NOT v_participation_open THEN
    RAISE EXCEPTION 'Participation for this group buy is currently closed';
  END IF;

  IF v_group_buy.expires_at <= now() THEN
    RAISE EXCEPTION 'This group buy has expired';
  END IF;

  v_cap := COALESCE(v_group_buy.max_participants, v_group_buy.min_participants);

  IF NOT FOUND AND COALESCE(v_group_buy.current_participants, 0) >= v_cap THEN
    RAISE EXCEPTION 'This group buy is full';
  END IF;

  IF FOUND THEN
    v_existing_quantity := GREATEST(COALESCE(v_existing.quantity, 0), 0);

    IF v_existing.payment_status = 'paid' AND NOT v_allow_duplicate_participation THEN
      RETURN v_existing;
    END IF;

    IF v_existing.payment_status = 'paid' AND v_allow_duplicate_participation THEN
      IF v_existing_quantity + p_quantity > v_participant_limit THEN
        RAISE EXCEPTION 'Participant limit per user reached for this group buy';
      END IF;

      UPDATE public.group_buy_participants
      SET quantity = v_existing_quantity + p_quantity,
          variant_id = p_variant_id,
          payment_reference = COALESCE(p_payment_reference, payment_reference),
          payment_status = CASE
            WHEN v_payment_status = 'paid' THEN 'paid'
            ELSE COALESCE(payment_status, 'reserved')
          END,
          shipping_address = COALESCE(p_shipping_address, shipping_address),
          invite_code = COALESCE(p_invite_code, invite_code),
          referred_by_user_id = COALESCE(p_referred_by_user_id, referred_by_user_id),
          unit_price_at_join = COALESCE(p_unit_price_at_join, unit_price_at_join),
          tier_label_at_join = COALESCE(p_tier_label_at_join, tier_label_at_join)
      WHERE id = v_existing.id
      RETURNING * INTO v_participant;
    ELSE
      IF p_quantity > v_participant_limit THEN
        RAISE EXCEPTION 'Participant limit per user reached for this group buy';
      END IF;

      UPDATE public.group_buy_participants
      SET quantity = p_quantity,
          variant_id = p_variant_id,
          payment_reference = p_payment_reference,
          payment_status = v_payment_status,
          shipping_address = p_shipping_address,
          invite_code = p_invite_code,
          referred_by_user_id = p_referred_by_user_id,
          unit_price_at_join = p_unit_price_at_join,
          tier_label_at_join = p_tier_label_at_join
      WHERE id = v_existing.id
      RETURNING * INTO v_participant;
    END IF;
  ELSE
    IF p_quantity > v_participant_limit THEN
      RAISE EXCEPTION 'Participant limit per user reached for this group buy';
    END IF;

    INSERT INTO public.group_buy_participants (
      group_buy_id,
      user_id,
      quantity,
      variant_id,
      payment_reference,
      payment_status,
      shipping_address,
      invite_code,
      referred_by_user_id,
      unit_price_at_join,
      tier_label_at_join
    )
    VALUES (
      p_group_buy_id,
      v_user_id,
      p_quantity,
      p_variant_id,
      p_payment_reference,
      v_payment_status,
      p_shipping_address,
      p_invite_code,
      p_referred_by_user_id,
      p_unit_price_at_join,
      p_tier_label_at_join
    )
    RETURNING * INTO v_participant;
  END IF;

  RETURN v_participant;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_group_buy_after_payment(
  uuid,
  integer,
  uuid,
  text,
  jsonb,
  text,
  uuid,
  numeric,
  text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_group_buy_join_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb_record public.group_buys%ROWTYPE;
  participant_cap integer;
  participation_open boolean := true;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.group_buy_id::text, 0));

  SELECT *
  INTO gb_record
  FROM public.group_buys
  WHERE id = NEW.group_buy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group buy not found';
  END IF;

  participation_open := COALESCE((COALESCE(gb_record.settings, '{}'::jsonb)->>'participationOpen')::boolean, true);

  IF gb_record.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'This group buy is no longer open';
  END IF;

  IF NOT participation_open THEN
    RAISE EXCEPTION 'Participation for this group buy is currently closed';
  END IF;

  IF gb_record.expires_at <= now() THEN
    RAISE EXCEPTION 'This group buy has expired';
  END IF;

  IF COALESCE((COALESCE(gb_record.settings, '{}'::jsonb)->>'requireFullPaymentBeforeJoining')::boolean, true)
     AND COALESCE(NEW.payment_status, 'pending') <> 'paid' THEN
    RAISE EXCEPTION 'Full payment is required before joining this group buy';
  END IF;

  participant_cap := COALESCE(gb_record.max_participants, gb_record.min_participants);

  IF COALESCE(gb_record.current_participants, 0) >= participant_cap THEN
    RAISE EXCEPTION 'This group buy is full';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_group_buy_join_rules() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_group_buy_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gb_record public.group_buys%ROWTYPE;
  participant RECORD;
  participant_cap integer;
  now_value timestamptz := now();
  v_settings jsonb := '{}'::jsonb;
  v_auto_close_when_full boolean := true;
  v_auto_confirm_when_target_reached boolean := false;
  v_manual_confirmation_required boolean := true;
  v_send_notifications boolean := true;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_buys
    SET current_participants = COALESCE(current_participants, 0) + 1,
        updated_at = now_value
    WHERE id = NEW.group_buy_id
    RETURNING * INTO gb_record;

    participant_cap := COALESCE(gb_record.max_participants, gb_record.min_participants);
    v_settings := COALESCE(gb_record.settings, '{}'::jsonb);
    v_auto_close_when_full := COALESCE((v_settings->>'autoCloseWhenFull')::boolean, true);
    v_auto_confirm_when_target_reached := COALESCE((v_settings->>'autoConfirmWhenTargetReached')::boolean, false);
    v_manual_confirmation_required := COALESCE((v_settings->>'manualConfirmationRequired')::boolean, true);
    v_send_notifications := COALESCE((v_settings->>'automaticParticipantNotifications')::boolean, true);

    IF gb_record.status = 'open'
       AND gb_record.current_participants >= gb_record.min_participants
       AND gb_record.goal_reached_at IS NULL THEN
      UPDATE public.group_buys
      SET goal_reached_at = now_value,
          updated_at = now_value
      WHERE id = NEW.group_buy_id
      RETURNING * INTO gb_record;

      IF v_send_notifications THEN
        FOR participant IN
          SELECT user_id
          FROM public.group_buy_participants
          WHERE group_buy_id = NEW.group_buy_id
        LOOP
          INSERT INTO public.notifications (user_id, title, message, type, data)
          VALUES (
            participant.user_id,
            'Group Buy Goal Reached!',
            'The group buy "' || COALESCE(gb_record.title, 'Group Buy') || '" has reached its first target.',
            'group_buy',
            jsonb_build_object('group_buy_id', NEW.group_buy_id)
          );
        END LOOP;
      END IF;

      INSERT INTO public.notifications (user_id, title, message, type, data)
      SELECT ur.user_id,
        'Group Buy Goal Reached',
        'Group buy "' || COALESCE(gb_record.title, 'Group Buy') || '" has reached ' || gb_record.min_participants || ' participants.',
        'group_buy',
        jsonb_build_object('group_buy_id', NEW.group_buy_id)
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
      LIMIT 1;

      IF v_auto_confirm_when_target_reached AND NOT v_manual_confirmation_required THEN
        UPDATE public.group_buys
        SET status = 'filled',
            updated_at = now_value
        WHERE id = NEW.group_buy_id;
      END IF;
    END IF;

    IF gb_record.status = 'open'
       AND v_auto_close_when_full
       AND gb_record.current_participants >= participant_cap THEN
      UPDATE public.group_buys
      SET status = 'filled',
          updated_at = now_value
      WHERE id = NEW.group_buy_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.group_buys
    SET current_participants = GREATEST(COALESCE(current_participants, 0) - 1, 0),
        updated_at = now_value
    WHERE id = OLD.group_buy_id
    RETURNING * INTO gb_record;

    v_settings := COALESCE(gb_record.settings, '{}'::jsonb);
    v_auto_close_when_full := COALESCE((v_settings->>'autoCloseWhenFull')::boolean, true);

    IF gb_record.status = 'filled'
       AND v_auto_close_when_full
       AND gb_record.expires_at > now_value
       AND gb_record.current_participants < COALESCE(gb_record.max_participants, gb_record.min_participants) THEN
      UPDATE public.group_buys
      SET status = 'open',
          updated_at = now_value
      WHERE id = OLD.group_buy_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_group_buy_count() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
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

GRANT EXECUTE ON FUNCTION public.check_expired_group_buys() TO authenticated;

NOTIFY pgrst, 'reload schema';
