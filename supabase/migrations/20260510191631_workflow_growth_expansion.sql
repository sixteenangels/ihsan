-- Persistent growth and operations workflows.

CREATE TABLE IF NOT EXISTS public.checkout_recovery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  product_names text[] NOT NULL DEFAULT '{}',
  shipping_label text,
  checkout_path text NOT NULL DEFAULT '/checkout',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reminded', 'recovered', 'dismissed')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reminder_due_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  reminded_at timestamptz,
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.checkout_recovery_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their checkout recovery" ON public.checkout_recovery_snapshots;
CREATE POLICY "Users can manage their checkout recovery"
ON public.checkout_recovery_snapshots
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage checkout recovery" ON public.checkout_recovery_snapshots;
CREATE POLICY "Admins can manage checkout recovery"
ON public.checkout_recovery_snapshots
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_checkout_recovery_due
ON public.checkout_recovery_snapshots(status, reminder_due_at)
WHERE status IN ('active', 'reminded');

CREATE TABLE IF NOT EXISTS public.checkout_recovery_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.checkout_recovery_snapshots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'in_app')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_recovery_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their checkout reminders" ON public.checkout_recovery_reminders;
CREATE POLICY "Users can view their checkout reminders"
ON public.checkout_recovery_reminders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage checkout reminders" ON public.checkout_recovery_reminders;
CREATE POLICY "Admins can manage checkout reminders"
ON public.checkout_recovery_reminders
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE TABLE IF NOT EXISTS public.restock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  variant_label text,
  desired_quantity integer NOT NULL DEFAULT 1 CHECK (desired_quantity > 0),
  intent text NOT NULL DEFAULT 'hold_without_deposit'
    CHECK (intent IN ('notify_only', 'hold_without_deposit', 'ready_for_deposit')),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'deposit_requested', 'reserved', 'fulfilled', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  expected_restock_date date,
  admin_notes text,
  assigned_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create restock reservations" ON public.restock_reservations;
CREATE POLICY "Users can create restock reservations"
ON public.restock_reservations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Guests can create restock reservations" ON public.restock_reservations;
CREATE POLICY "Guests can create restock reservations"
ON public.restock_reservations
FOR INSERT
WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Users can view their restock reservations" ON public.restock_reservations;
CREATE POLICY "Users can view their restock reservations"
ON public.restock_reservations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage restock reservations" ON public.restock_reservations;
CREATE POLICY "Admins can manage restock reservations"
ON public.restock_reservations
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_restock_reservations_product
ON public.restock_reservations(product_id, status);

CREATE INDEX IF NOT EXISTS idx_restock_reservations_created
ON public.restock_reservations(created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_recommendation_scores (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  view_count integer NOT NULL DEFAULT 0,
  cart_count integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  recommendation_click_count integer NOT NULL DEFAULT 0,
  revenue_score numeric NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_recommendation_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recommendation scores are public" ON public.product_recommendation_scores;
CREATE POLICY "Recommendation scores are public"
ON public.product_recommendation_scores
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage recommendation scores" ON public.product_recommendation_scores;
CREATE POLICY "Admins can manage recommendation scores"
ON public.product_recommendation_scores
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE TABLE IF NOT EXISTS public.product_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('view', 'cart_add', 'checkout_seed', 'order_complete', 'recommendation_click')),
  source text,
  weight numeric NOT NULL DEFAULT 1,
  revenue numeric NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_recommendation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can add recommendation events" ON public.product_recommendation_events;
CREATE POLICY "Anyone can add recommendation events"
ON public.product_recommendation_events
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view recommendation events" ON public.product_recommendation_events;
CREATE POLICY "Admins can view recommendation events"
ON public.product_recommendation_events
FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_recommendation_events_product_created
ON public.product_recommendation_events(product_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_product_recommendation_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  event_score numeric;
BEGIN
  event_score := CASE NEW.event_type
    WHEN 'view' THEN 1
    WHEN 'recommendation_click' THEN 2
    WHEN 'checkout_seed' THEN 3
    WHEN 'cart_add' THEN 5
    WHEN 'order_complete' THEN 8
    ELSE 1
  END * greatest(NEW.weight, 0);

  INSERT INTO public.product_recommendation_scores (
    product_id,
    view_count,
    cart_count,
    order_count,
    recommendation_click_count,
    revenue_score,
    score,
    last_event_at
  )
  VALUES (
    NEW.product_id,
    CASE WHEN NEW.event_type = 'view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'cart_add' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'order_complete' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'recommendation_click' THEN 1 ELSE 0 END,
    greatest(NEW.revenue, 0),
    event_score + greatest(NEW.revenue, 0) * 0.05,
    NEW.created_at
  )
  ON CONFLICT (product_id) DO UPDATE
  SET view_count = public.product_recommendation_scores.view_count + CASE WHEN NEW.event_type = 'view' THEN 1 ELSE 0 END,
      cart_count = public.product_recommendation_scores.cart_count + CASE WHEN NEW.event_type = 'cart_add' THEN 1 ELSE 0 END,
      order_count = public.product_recommendation_scores.order_count + CASE WHEN NEW.event_type = 'order_complete' THEN 1 ELSE 0 END,
      recommendation_click_count = public.product_recommendation_scores.recommendation_click_count + CASE WHEN NEW.event_type = 'recommendation_click' THEN 1 ELSE 0 END,
      revenue_score = public.product_recommendation_scores.revenue_score + greatest(NEW.revenue, 0),
      score = public.product_recommendation_scores.score + event_score + greatest(NEW.revenue, 0) * 0.05,
      last_event_at = greatest(coalesce(public.product_recommendation_scores.last_event_at, NEW.created_at), NEW.created_at),
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_recommendation_event_score ON public.product_recommendation_events;
CREATE TRIGGER product_recommendation_event_score
AFTER INSERT ON public.product_recommendation_events
FOR EACH ROW EXECUTE FUNCTION public.update_product_recommendation_score();

CREATE TABLE IF NOT EXISTS public.group_buy_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id uuid NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  channel text,
  visits integer NOT NULL DEFAULT 0,
  joins integer NOT NULL DEFAULT 0,
  rewards_issued integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_buy_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view group buy invites by code" ON public.group_buy_invites;
CREATE POLICY "Anyone can view group buy invites by code"
ON public.group_buy_invites
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create group buy invites" ON public.group_buy_invites;
CREATE POLICY "Users can create group buy invites"
ON public.group_buy_invites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "Admins can manage group buy invites" ON public.group_buy_invites;
CREATE POLICY "Admins can manage group buy invites"
ON public.group_buy_invites
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

ALTER TABLE public.group_buy_participants
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS unit_price_at_join numeric,
  ADD COLUMN IF NOT EXISTS tier_label_at_join text;

CREATE TABLE IF NOT EXISTS public.group_buy_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id uuid NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  min_participants integer NOT NULL CHECK (min_participants > 0),
  group_price numeric,
  discount_percentage numeric,
  reward_coupon_percent numeric NOT NULL DEFAULT 0,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_buy_id, min_participants)
);

ALTER TABLE public.group_buy_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group buy tiers are public" ON public.group_buy_tiers;
CREATE POLICY "Group buy tiers are public"
ON public.group_buy_tiers
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage group buy tiers" ON public.group_buy_tiers;
CREATE POLICY "Admins can manage group buy tiers"
ON public.group_buy_tiers
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE TABLE IF NOT EXISTS public.pick_pack_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  scan_code text NOT NULL,
  scan_type text NOT NULL DEFAULT 'manual' CHECK (scan_type IN ('qr', 'barcode', 'manual')),
  action text NOT NULL CHECK (action IN ('picked', 'quality_checked', 'packed', 'awaiting_dispatch', 'dispatched')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pick_pack_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage pick pack scans" ON public.pick_pack_scans;
CREATE POLICY "Admins can manage pick pack scans"
ON public.pick_pack_scans
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pick_pack_scans_order_created
ON public.pick_pack_scans(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users can view their coupon redemptions"
ON public.coupon_redemptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins can manage coupon redemptions"
ON public.coupon_redemptions
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.mark_coupon_redeemed(
  coupon_id_input uuid,
  order_id_input uuid,
  discount_amount_input numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_coupon public.coupons%ROWTYPE;
  target_order public.orders%ROWTYPE;
  redemption_recorded boolean := false;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a coupon.';
  END IF;

  SELECT *
  INTO target_coupon
  FROM public.coupons
  WHERE id = coupon_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;

  IF coalesce(target_coupon.is_active, false) = false THEN
    RAISE EXCEPTION 'This coupon is inactive.';
  END IF;

  IF target_coupon.starts_at IS NOT NULL AND target_coupon.starts_at > now() THEN
    RAISE EXCEPTION 'This coupon is not active yet.';
  END IF;

  IF target_coupon.expires_at IS NOT NULL AND target_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'This coupon has expired.';
  END IF;

  IF target_coupon.max_uses IS NOT NULL AND coalesce(target_coupon.current_uses, 0) >= target_coupon.max_uses THEN
    RAISE EXCEPTION 'This coupon has reached its usage limit.';
  END IF;

  SELECT *
  INTO target_order
  FROM public.orders
  WHERE id = order_id_input
    AND user_id = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for this user.';
  END IF;

  IF target_coupon.min_order_amount IS NOT NULL AND target_order.subtotal < target_coupon.min_order_amount THEN
    RAISE EXCEPTION 'This order does not meet the coupon minimum.';
  END IF;

  IF coalesce(target_coupon.first_order_only, false) AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE user_id = current_user_id
      AND id <> order_id_input
      AND created_at < target_order.created_at
  ) THEN
    RAISE EXCEPTION 'This coupon is only available for first orders.';
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
    current_user_id,
    greatest(coalesce(discount_amount_input, 0), 0)
  )
  ON CONFLICT (coupon_id, order_id) DO NOTHING
  RETURNING true INTO redemption_recorded;

  IF redemption_recorded THEN
    UPDATE public.coupons
    SET current_uses = coalesce(current_uses, 0) + 1
    WHERE id = coupon_id_input;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_coupon_redeemed(uuid, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_checkout_recovery_status(
  snapshot_id_input uuid,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkout_recovery_snapshots
  SET status = next_status,
      recovered_at = CASE WHEN next_status = 'recovered' THEN now() ELSE recovered_at END,
      updated_at = now()
  WHERE id = snapshot_id_input
    AND user_id = auth.uid()
    AND next_status IN ('active', 'reminded', 'recovered', 'dismissed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_checkout_recovery_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_group_buy_invite_visit(invite_code_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.group_buy_invites
  SET visits = visits + 1,
      updated_at = now()
  WHERE invite_code = upper(trim(invite_code_input));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_group_buy_invite_visit(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_group_buy_invite_reward()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  invite_row public.group_buy_invites%ROWTYPE;
  reward_code text;
  reward_percent numeric;
  expiry_days integer;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.referred_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO invite_row
  FROM public.group_buy_invites
  WHERE invite_code = upper(trim(NEW.invite_code))
  LIMIT 1;

  IF NOT FOUND OR invite_row.inviter_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.group_buy_invites
  SET joins = joins + 1,
      rewards_issued = rewards_issued + 1,
      updated_at = now()
  WHERE id = invite_row.id;

  reward_percent := 5;
  expiry_days := 14;
  reward_code := 'GBREF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.coupons (
    code,
    type,
    value,
    max_uses,
    current_uses,
    is_active,
    expires_at,
    marketing_label
  )
  VALUES (
    reward_code,
    'percentage',
    reward_percent,
    1,
    0,
    true,
    now() + make_interval(days => expiry_days),
    'Group buy invite reward'
  );

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  )
  VALUES (
    invite_row.inviter_user_id,
    'Group buy invite reward',
    format('Your group buy invite converted. Use %s for %s%% off your next order.', reward_code, reward_percent),
    'promotion',
    jsonb_build_object(
      'coupon_code', reward_code,
      'group_buy_id', NEW.group_buy_id,
      'invite_code', invite_row.invite_code
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_buy_invite_reward ON public.group_buy_participants;
CREATE TRIGGER group_buy_invite_reward
AFTER INSERT ON public.group_buy_participants
FOR EACH ROW EXECUTE FUNCTION public.handle_group_buy_invite_reward();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'send-checkout-recovery-reminders'
  ) THEN
    PERFORM cron.unschedule('send-checkout-recovery-reminders');
  END IF;
END;
$$;

SELECT cron.schedule(
  'send-checkout-recovery-reminders',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jcwagkwjdhtuugcfbhui.supabase.co/functions/v1/send-checkout-recovery-reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"limit": 50}'::jsonb
    ) AS request_id;
  $$
);
