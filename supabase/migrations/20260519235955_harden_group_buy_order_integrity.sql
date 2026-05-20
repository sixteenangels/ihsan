-- Harden group-buy privacy, payment joins, and admin-created participant orders.

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS goal_reached_at timestamptz;

UPDATE public.group_buys
SET goal_reached_at = COALESCE(goal_reached_at, updated_at, now())
WHERE COALESCE(current_participants, 0) >= min_participants
  AND goal_reached_at IS NULL;

UPDATE public.group_buys
SET status = 'open',
    updated_at = now()
WHERE status = 'filled'
  AND expires_at > now()
  AND COALESCE(current_participants, 0) < COALESCE(max_participants, min_participants);

UPDATE public.group_buys
SET status = 'filled',
    updated_at = now()
WHERE status = 'open'
  AND COALESCE(current_participants, 0) >= COALESCE(max_participants, min_participants);

DROP POLICY IF EXISTS "Participants are viewable by everyone" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Anyone can view participant counts" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can view their own group buy participation" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users and admins can view group buy participation" ON public.group_buy_participants;

CREATE POLICY "Users and admins can view group buy participation"
ON public.group_buy_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can create orders for customers" ON public.orders;
CREATE POLICY "Admins and managers can create orders for customers"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can delete failed group buy orders" ON public.orders;
CREATE POLICY "Admins and managers can delete failed group buy orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_manager(auth.uid())
  AND (is_group_buy_master IS TRUE OR parent_order_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Admins and managers can create order items for any order" ON public.order_items;
CREATE POLICY "Admins and managers can create order items for any order"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_manager(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.customer_preferences TO authenticated;

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

  IF p_payment_reference IS NULL OR btrim(p_payment_reference) = '' THEN
    RAISE EXCEPTION 'Missing payment reference';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_group_buy_id::text, 0));

  SELECT *
  INTO v_group_buy
  FROM public.group_buys
  WHERE id = p_group_buy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group buy not found';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.group_buy_participants
  WHERE group_buy_id = p_group_buy_id
    AND user_id = v_user_id;

  IF FOUND AND v_existing.payment_status = 'paid' THEN
    RETURN v_existing;
  END IF;

  IF v_group_buy.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'This group buy is no longer open';
  END IF;

  IF v_group_buy.expires_at <= now() THEN
    RAISE EXCEPTION 'This group buy has expired';
  END IF;

  v_cap := COALESCE(v_group_buy.max_participants, v_group_buy.min_participants);

  IF NOT FOUND AND COALESCE(v_group_buy.current_participants, 0) >= v_cap THEN
    RAISE EXCEPTION 'This group buy is full';
  END IF;

  IF FOUND THEN
    UPDATE public.group_buy_participants
    SET quantity = p_quantity,
        variant_id = p_variant_id,
        payment_reference = p_payment_reference,
        payment_status = 'paid',
        shipping_address = p_shipping_address,
        invite_code = p_invite_code,
        referred_by_user_id = p_referred_by_user_id,
        unit_price_at_join = p_unit_price_at_join,
        tier_label_at_join = p_tier_label_at_join
    WHERE id = v_existing.id
    RETURNING * INTO v_participant;
  ELSE
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
      'paid',
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
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.group_buy_id::text, 0));

  SELECT *
  INTO gb_record
  FROM public.group_buys
  WHERE id = NEW.group_buy_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group buy not found';
  END IF;

  IF gb_record.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'This group buy is no longer open';
  END IF;

  IF gb_record.expires_at <= now() THEN
    RAISE EXCEPTION 'This group buy has expired';
  END IF;

  participant_cap := COALESCE(gb_record.max_participants, gb_record.min_participants);

  IF COALESCE(gb_record.current_participants, 0) >= participant_cap THEN
    RAISE EXCEPTION 'This group buy is full';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_group_buy_join_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_group_buy_join_rules_before_insert ON public.group_buy_participants;
CREATE TRIGGER enforce_group_buy_join_rules_before_insert
BEFORE INSERT ON public.group_buy_participants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_group_buy_join_rules();

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
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_buys
    SET current_participants = COALESCE(current_participants, 0) + 1,
        updated_at = now_value
    WHERE id = NEW.group_buy_id
    RETURNING * INTO gb_record;

    participant_cap := COALESCE(gb_record.max_participants, gb_record.min_participants);

    IF gb_record.status = 'open'
       AND gb_record.current_participants >= gb_record.min_participants
       AND gb_record.goal_reached_at IS NULL THEN
      UPDATE public.group_buys
      SET goal_reached_at = now_value,
          updated_at = now_value
      WHERE id = NEW.group_buy_id
      RETURNING * INTO gb_record;

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

      INSERT INTO public.notifications (user_id, title, message, type, data)
      SELECT ur.user_id,
        'Group Buy Goal Reached',
        'Group buy "' || COALESCE(gb_record.title, 'Group Buy') || '" has reached ' || gb_record.min_participants || ' participants. It can keep growing until the cap is reached.',
        'group_buy',
        jsonb_build_object('group_buy_id', NEW.group_buy_id)
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
      LIMIT 1;
    END IF;

    IF gb_record.status = 'open'
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

    IF gb_record.status = 'filled'
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

NOTIFY pgrst, 'reload schema';
