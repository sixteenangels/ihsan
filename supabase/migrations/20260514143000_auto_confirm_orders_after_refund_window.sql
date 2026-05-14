CREATE OR REPLACE FUNCTION public.confirm_orders_after_refund_window()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  WITH updated_orders AS (
    UPDATE public.orders
    SET
      status = 'confirmed'::public.order_status,
      updated_at = now()
    WHERE status = 'order_placed'::public.order_status
      AND updated_at <= now() - interval '48 hours'
    RETURNING id
  )
  INSERT INTO public.order_tracking (order_id, status, location_name, notes)
  SELECT
    updated_orders.id,
    'confirmed',
    'AJYN',
    'The 48-hour refund request window elapsed; order automatically confirmed.'
  FROM updated_orders
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.order_tracking
    WHERE order_tracking.order_id = updated_orders.id
      AND order_tracking.status = 'confirmed'
      AND order_tracking.notes = 'The 48-hour refund request window elapsed; order automatically confirmed.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_orders_after_refund_window() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_orders_after_refund_window() FROM anon;
REVOKE ALL ON FUNCTION public.confirm_orders_after_refund_window() FROM authenticated;

CREATE POLICY "Users can add delivery confirmation tracking"
ON public.order_tracking
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'delivered'
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_tracking.order_id
      AND orders.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create refund requests" ON public.refund_requests;

CREATE POLICY "Users can create refund requests"
ON public.refund_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = refund_requests.order_id
      AND orders.user_id = auth.uid()
      AND orders.customer_confirmed_at IS NULL
      AND orders.status IN ('pending', 'payment_received', 'order_placed')
      AND now() < (
        CASE
          WHEN orders.status = 'order_placed' THEN orders.updated_at
          ELSE orders.created_at
        END + interval '48 hours'
      )
  )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'confirm-orders-after-refund-window'
  ) THEN
    PERFORM cron.unschedule('confirm-orders-after-refund-window');
  END IF;
END;
$$;

SELECT cron.schedule(
  'confirm-orders-after-refund-window',
  '0 * * * *',
  $$SELECT public.confirm_orders_after_refund_window();$$
);
