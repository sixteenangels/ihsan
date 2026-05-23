CREATE SCHEMA IF NOT EXISTS private;

-- Lock down store settings and expose only the customer-safe subset through RPC.
DROP POLICY IF EXISTS "Store settings are viewable by everyone" ON public.store_settings;
DROP POLICY IF EXISTS "Admins and managers can view store settings" ON public.store_settings;
CREATE POLICY "Admins and managers can view store settings"
ON public.store_settings
FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

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
      'loyaltyEnabled',
      'loyaltyPointsPerOrder',
      'loyaltyPointsToCurrencyRate',
      'loyaltyMinOrderAmount',
      'loyaltyMinRedeemPoints',
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

REVOKE ALL ON FUNCTION private.get_public_store_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_store_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_store_settings()
RETURNS TABLE (
  key text,
  value jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT * FROM private.get_public_store_settings();
$$;

GRANT EXECUTE ON FUNCTION public.get_public_store_settings() TO anon, authenticated;

-- Replace public receipt verification with a redacted view.
CREATE OR REPLACE FUNCTION private.verify_public_receipt(public_receipt_number text)
RETURNS TABLE (
  receipt_number text,
  generated_at timestamptz,
  order_number text,
  order_status text,
  order_date timestamptz,
  customer_name text,
  customer_email text,
  subtotal numeric,
  shipping_price numeric,
  packaging_cost numeric,
  wallet_credit_used numeric,
  total_amount numeric,
  shipping_address jsonb,
  items jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT
    r.receipt_number,
    r.generated_at,
    o.order_number,
    COALESCE(o.status::text, 'pending') AS order_status,
    o.created_at AS order_date,
    COALESCE(
      NULLIF(split_part(COALESCE(p.name, o.shipping_address ->> 'full_name', 'Customer'), ' ', 1), ''),
      'Customer'
    ) AS customer_name,
    NULL::text AS customer_email,
    o.subtotal,
    o.shipping_price,
    o.packaging_cost,
    o.wallet_credit_used,
    o.total_amount,
    CASE
      WHEN jsonb_typeof(o.shipping_address) = 'object' THEN jsonb_strip_nulls(
        jsonb_build_object(
          'city', o.shipping_address ->> 'city',
          'state', o.shipping_address ->> 'state',
          'country', o.shipping_address ->> 'country'
        )
      )
      ELSE '{}'::jsonb
    END AS shipping_address,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_name', oi.product_name,
            'variant_details', oi.variant_details,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
          ORDER BY oi.created_at
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM public.receipts r
  JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles p ON p.user_id = o.user_id
  WHERE r.receipt_number = public_receipt_number
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.verify_public_receipt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_public_receipt(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_receipt(public_receipt_number text)
RETURNS TABLE (
  receipt_number text,
  generated_at timestamptz,
  order_number text,
  order_status text,
  order_date timestamptz,
  customer_name text,
  customer_email text,
  subtotal numeric,
  shipping_price numeric,
  packaging_cost numeric,
  wallet_credit_used numeric,
  total_amount numeric,
  shipping_address jsonb,
  items jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT * FROM private.verify_public_receipt(public_receipt_number);
$$;

GRANT EXECUTE ON FUNCTION public.verify_receipt(text) TO anon, authenticated;

-- Make proof-of-delivery storage private and accessible only to the order owner or admins.
UPDATE storage.buckets
SET public = false
WHERE id = 'proof-of-delivery';

DROP POLICY IF EXISTS "Proof of delivery is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Order owners can view proof of delivery" ON storage.objects;
CREATE POLICY "Order owners can view proof of delivery"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'proof-of-delivery'
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id::text = split_part(name, '/', 1)
      AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
  )
);

-- Lock down group-buy invites while keeping sharing flows available through narrow RPCs.
DROP POLICY IF EXISTS "Anyone can view group buy invites by code" ON public.group_buy_invites;
DROP POLICY IF EXISTS "Users can create group buy invites" ON public.group_buy_invites;
CREATE POLICY "Participants can create group buy invites"
ON public.group_buy_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = inviter_user_id
  AND (
    EXISTS (
      SELECT 1
      FROM public.group_buy_participants
      WHERE group_buy_participants.group_buy_id = group_buy_invites.group_buy_id
        AND group_buy_participants.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_buys
      WHERE group_buys.id = group_buy_invites.group_buy_id
        AND group_buys.created_by = auth.uid()
    )
  )
);

REVOKE SELECT ON TABLE public.group_buy_invites FROM anon;

CREATE TABLE IF NOT EXISTS public.group_buy_invite_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.group_buy_invites(id) ON DELETE CASCADE,
  visitor_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, visitor_token)
);

ALTER TABLE public.group_buy_invite_visit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view group buy invite visit events" ON public.group_buy_invite_visit_events;
CREATE POLICY "Admins can view group buy invite visit events"
ON public.group_buy_invite_visit_events
FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION private.resolve_group_buy_invite(invite_code_input text)
RETURNS TABLE (
  invite_code text,
  inviter_user_id uuid,
  group_buy_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT
    gbi.invite_code,
    gbi.inviter_user_id,
    gbi.group_buy_id
  FROM public.group_buy_invites gbi
  WHERE gbi.invite_code = upper(trim(invite_code_input))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.resolve_group_buy_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_group_buy_invite(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_group_buy_invite(invite_code_input text)
RETURNS TABLE (
  invite_code text,
  inviter_user_id uuid,
  group_buy_id uuid
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT * FROM private.resolve_group_buy_invite(invite_code_input);
$$;

GRANT EXECUTE ON FUNCTION public.resolve_group_buy_invite(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.record_group_buy_invite_visit(text);
DROP FUNCTION IF EXISTS private.record_group_buy_invite_visit(text, text);

CREATE OR REPLACE FUNCTION private.record_group_buy_invite_visit(
  invite_code_input text,
  visitor_token_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  normalized_code text := upper(trim(coalesce(invite_code_input, '')));
  normalized_token text := nullif(trim(coalesce(visitor_token_input, '')), '');
  target_invite_id uuid;
  inserted_visit_id uuid;
BEGIN
  IF normalized_code = '' OR normalized_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT id
  INTO target_invite_id
  FROM public.group_buy_invites
  WHERE invite_code = normalized_code
  LIMIT 1;

  IF target_invite_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.group_buy_invite_visit_events (invite_id, visitor_token)
  VALUES (target_invite_id, normalized_token)
  ON CONFLICT (invite_id, visitor_token) DO NOTHING
  RETURNING id INTO inserted_visit_id;

  IF inserted_visit_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.group_buy_invites
  SET visits = visits + 1,
      updated_at = now()
  WHERE id = target_invite_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.record_group_buy_invite_visit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_group_buy_invite_visit(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_group_buy_invite_visit(
  invite_code_input text,
  visitor_token_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT private.record_group_buy_invite_visit(invite_code_input, visitor_token_input);
$$;

GRANT EXECUTE ON FUNCTION public.record_group_buy_invite_visit(text, text) TO anon, authenticated;

-- Move recommendation writes behind a validated RPC.
DROP POLICY IF EXISTS "Anyone can add recommendation events" ON public.product_recommendation_events;
REVOKE INSERT ON TABLE public.product_recommendation_events FROM anon, authenticated;

DROP FUNCTION IF EXISTS private.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text);

CREATE OR REPLACE FUNCTION private.record_recommendation_event(
  product_id_input uuid,
  event_type_input text,
  source_input text DEFAULT NULL,
  quantity_input integer DEFAULT 1,
  product_variant_id_input uuid DEFAULT NULL,
  order_id_input uuid DEFAULT NULL,
  metadata_input jsonb DEFAULT '{}'::jsonb,
  session_id_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  normalized_event_type text := trim(coalesce(event_type_input, ''));
  normalized_source text := nullif(left(trim(coalesce(source_input, '')), 120), '');
  normalized_session_id text := nullif(left(trim(coalesce(session_id_input, '')), 120), '');
  normalized_metadata jsonb := CASE
    WHEN jsonb_typeof(metadata_input) = 'object' THEN metadata_input
    ELSE '{}'::jsonb
  END;
  normalized_quantity integer := greatest(1, least(coalesce(quantity_input, 1), 25));
  actual_quantity integer := normalized_quantity;
  actual_revenue numeric := 0;
BEGIN
  IF product_id_input IS NULL THEN
    RETURN false;
  END IF;

  IF normalized_event_type NOT IN (
    'view',
    'cart_add',
    'checkout_seed',
    'order_complete',
    'recommendation_click'
  ) THEN
    RETURN false;
  END IF;

  IF normalized_event_type = 'order_complete' THEN
    IF actor_id IS NULL OR order_id_input IS NULL THEN
      RETURN false;
    END IF;

    SELECT
      greatest(1, coalesce(sum(oi.quantity), 0)),
      greatest(0, coalesce(sum(oi.total_price), 0))
    INTO actual_quantity, actual_revenue
    FROM public.orders o
    JOIN public.order_items oi
      ON oi.order_id = o.id
    WHERE o.id = order_id_input
      AND o.user_id = actor_id
      AND oi.product_id = product_id_input
      AND (
        product_variant_id_input IS NULL
        OR oi.product_variant_id = product_variant_id_input
      );

    IF actual_revenue <= 0 THEN
      RETURN false;
    END IF;
  ELSE
    actual_quantity := CASE
      WHEN normalized_event_type IN ('cart_add', 'checkout_seed') THEN greatest(1, least(normalized_quantity, 5))
      ELSE 1
    END;
  END IF;

  INSERT INTO public.product_recommendation_events (
    user_id,
    session_id,
    product_id,
    event_type,
    source,
    weight,
    revenue,
    metadata
  )
  VALUES (
    actor_id,
    normalized_session_id,
    product_id_input,
    normalized_event_type,
    normalized_source,
    actual_quantity,
    actual_revenue,
    jsonb_strip_nulls(
      normalized_metadata
      || jsonb_build_object(
        'order_id', order_id_input,
        'product_variant_id', product_variant_id_input
      )
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_recommendation_event(
  product_id_input uuid,
  event_type_input text,
  source_input text DEFAULT NULL,
  quantity_input integer DEFAULT 1,
  product_variant_id_input uuid DEFAULT NULL,
  order_id_input uuid DEFAULT NULL,
  metadata_input jsonb DEFAULT '{}'::jsonb,
  session_id_input text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT private.record_recommendation_event(
    product_id_input,
    event_type_input,
    source_input,
    quantity_input,
    product_variant_id_input,
    order_id_input,
    metadata_input,
    session_id_input
  );
$$;

GRANT EXECUTE ON FUNCTION public.record_recommendation_event(uuid, text, text, integer, uuid, uuid, jsonb, text) TO anon, authenticated;

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

DO $$
DECLARE
  automation_secret text;
BEGIN
  SELECT decrypted_secret
  INTO automation_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('internal_automations_key', 'service_role_key')
  ORDER BY CASE WHEN name = 'internal_automations_key' THEN 0 ELSE 1 END
  LIMIT 1;

  IF coalesce(automation_secret, '') <> '' THEN
    PERFORM cron.schedule(
      'send-checkout-recovery-reminders',
      '*/30 * * * *',
      format(
        $job$
        SELECT
          net.http_post(
            url := 'https://jcwagkwjdhtuugcfbhui.supabase.co/functions/v1/send-checkout-recovery-reminders',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || %1$L,
              'apikey', %1$L
            ),
            body := '{"limit": 50}'::jsonb
          ) AS request_id;
        $job$,
        automation_secret
      )
    );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
