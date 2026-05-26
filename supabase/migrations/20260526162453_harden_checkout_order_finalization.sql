BEGIN;

-- Paid order creation must happen through the secured Edge Function.
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders status" ON public.orders;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "System can insert points" ON public.loyalty_points;

-- Prevent replaying the same gateway reference into multiple orders.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference_unique
ON public.orders (payment_reference)
WHERE payment_reference IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.confirm_order_delivery(uuid);

CREATE OR REPLACE FUNCTION private.confirm_order_delivery(order_id_input uuid)
RETURNS TABLE(order_id uuid, confirmed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_order public.orders%ROWTYPE;
  confirmation_time timestamptz := now();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to confirm delivery.';
  END IF;

  SELECT *
  INTO target_order
  FROM public.orders
  WHERE id = order_id_input
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for this user.';
  END IF;

  IF target_order.status IN ('cancelled'::public.order_status, 'refunded'::public.order_status) THEN
    RAISE EXCEPTION 'This order can no longer be confirmed as delivered.';
  END IF;

  IF target_order.customer_confirmed_at IS NOT NULL THEN
    order_id := target_order.id;
    confirmed_at := target_order.customer_confirmed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.orders
  SET
    status = 'delivered'::public.order_status,
    customer_confirmed_at = confirmation_time,
    updated_at = confirmation_time
  WHERE id = target_order.id;

  INSERT INTO public.order_tracking (order_id, status, location_name, notes)
  SELECT
    target_order.id,
    'delivered',
    'Delivered',
    'Customer confirmed delivery.'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.order_tracking
    WHERE order_tracking.order_id = target_order.id
      AND order_tracking.status = 'delivered'
      AND order_tracking.notes = 'Customer confirmed delivery.'
  );

  order_id := target_order.id;
  confirmed_at := confirmation_time;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.confirm_order_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.confirm_order_delivery(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_order_delivery(order_id_input uuid)
RETURNS TABLE(order_id uuid, confirmed_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$
  SELECT * FROM private.confirm_order_delivery(order_id_input);
$$;

REVOKE ALL ON FUNCTION public.confirm_order_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_delivery(uuid) TO authenticated;

COMMIT;
