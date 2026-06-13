-- Security hardening: group-buy payment integrity, private schema lockdown,
-- role probing prevention, checkout recovery URL validation, and manager helpers.

CREATE TABLE IF NOT EXISTS public.verified_paystack_payments (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_subunits integer NOT NULL CHECK (amount_subunits >= 0),
  currency text NOT NULL DEFAULT 'GHS',
  verified_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verified_paystack_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their verified payments" ON public.verified_paystack_payments;
CREATE POLICY "Users can view their verified payments"
ON public.verified_paystack_payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_buy_participants_payment_reference_unique
ON public.group_buy_participants (payment_reference)
WHERE payment_reference IS NOT NULL AND btrim(payment_reference) <> '';

CREATE OR REPLACE FUNCTION private.is_safe_checkout_path(path_input text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(path_input, '') ~ '^/[A-Za-z0-9][A-Za-z0-9/_?=&%.+-]*$'
    AND COALESCE(path_input, '') !~ '@'
    AND left(COALESCE(path_input, ''), 2) <> '//';
$function$;

CREATE OR REPLACE FUNCTION public.validate_checkout_recovery_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF NOT private.is_safe_checkout_path(NEW.checkout_path) THEN
    RAISE EXCEPTION 'Invalid checkout path.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_checkout_recovery_snapshot_path ON public.checkout_recovery_snapshots;
CREATE TRIGGER validate_checkout_recovery_snapshot_path
BEFORE INSERT OR UPDATE OF checkout_path ON public.checkout_recovery_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.validate_checkout_recovery_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_group_buy_payment_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
       AND NEW.payment_status = 'paid'
       AND OLD.payment_status IS DISTINCT FROM 'paid'
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Payment status can only be marked paid after verified payment.';
    END IF;

    IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
       AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Payment reference cannot be changed directly.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     AND COALESCE(NEW.payment_status, 'pending') = 'paid'
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Direct paid participation is not allowed.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_group_buy_payment_escalation ON public.group_buy_participants;
CREATE TRIGGER prevent_group_buy_payment_escalation
BEFORE INSERT OR UPDATE ON public.group_buy_participants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_group_buy_payment_escalation();

DROP POLICY IF EXISTS "Users can join group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.group_buy_participants;

CREATE OR REPLACE FUNCTION public.has_manager_permission(permission_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN NOT private.is_admin_or_manager(auth.uid()) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.manager_permissions mp
      WHERE mp.user_id = auth.uid()
        AND mp.permission = permission_slug
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id = auth.uid() THEN private.has_role(_user_id, _role)
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role) THEN private.has_role(_user_id, _role)
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id = auth.uid() THEN private.is_admin_or_manager(_user_id)
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role) THEN private.is_admin_or_manager(_user_id)
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.check_expired_group_buys()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and managers can run this job.';
  END IF;

  PERFORM private.check_expired_group_buys_internal();
END;
$function$;

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
SECURITY DEFINER
SET search_path = public, private, pg_temp
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
  v_payment_reference text := NULLIF(btrim(p_payment_reference), '');
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

  IF v_payment_reference IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.verified_paystack_payments vpp
      WHERE vpp.reference = v_payment_reference
        AND vpp.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Payment has not been verified for this account.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.group_buy_participants gbp
      WHERE gbp.payment_reference = v_payment_reference
        AND gbp.user_id <> v_user_id
    ) OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.payment_reference = v_payment_reference
        AND o.user_id <> v_user_id
    ) THEN
      RAISE EXCEPTION 'This payment reference has already been used.';
    END IF;

    v_payment_status := 'paid';
  ELSE
    v_payment_status := 'reserved';
  END IF;

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
          payment_reference = COALESCE(v_payment_reference, payment_reference),
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
          payment_reference = v_payment_reference,
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
      v_payment_reference,
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

DROP POLICY IF EXISTS "Admins and managers can create orders for customers" ON public.orders;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

REVOKE EXECUTE ON FUNCTION private.check_expired_group_buys_internal() FROM authenticated;
REVOKE EXECUTE ON FUNCTION private.redeem_gift_card_internal(text) FROM authenticated;

REVOKE ALL ON FUNCTION public.has_manager_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_manager_permission(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.join_group_buy_after_payment(uuid, integer, uuid, text, jsonb, text, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_buy_after_payment(uuid, integer, uuid, text, jsonb, text, uuid, numeric, text) TO authenticated, service_role;

UPDATE storage.buckets
SET
  file_size_limit = COALESCE(file_size_limit, 5242880),
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'product-images'
  AND allowed_mime_types IS NULL;

NOTIFY pgrst, 'reload schema';
