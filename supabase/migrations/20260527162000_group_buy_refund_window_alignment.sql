BEGIN;

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
      AND now() >= (
        CASE
          WHEN orders.group_buy_id IS NOT NULL THEN
            COALESCE(
              (
                SELECT gbp.joined_at
                FROM public.group_buy_participants gbp
                WHERE gbp.group_buy_id = orders.group_buy_id
                  AND gbp.user_id = orders.user_id
                ORDER BY gbp.joined_at DESC
                LIMIT 1
              ),
              orders.updated_at,
              orders.created_at
            ) + interval '1 hour'
          ELSE
            COALESCE(orders.updated_at, orders.created_at) + interval '48 hours'
        END
      )
    RETURNING id, group_buy_id
  )
  INSERT INTO public.order_tracking (order_id, status, location_name, notes)
  SELECT
    updated_orders.id,
    'confirmed',
    'AJYN',
    CASE
      WHEN updated_orders.group_buy_id IS NOT NULL
        THEN 'The 1-hour group-buy leave window elapsed; participation automatically confirmed.'
      ELSE 'The 48-hour refund request window elapsed; order automatically confirmed.'
    END
  FROM updated_orders
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.order_tracking
    WHERE order_tracking.order_id = updated_orders.id
      AND order_tracking.status = 'confirmed'
      AND order_tracking.notes = CASE
        WHEN updated_orders.group_buy_id IS NOT NULL
          THEN 'The 1-hour group-buy leave window elapsed; participation automatically confirmed.'
        ELSE 'The 48-hour refund request window elapsed; order automatically confirmed.'
      END
  );
END;
$$;

UPDATE public.order_tracking
SET notes = 'The 1-hour group-buy leave window elapsed; participation automatically confirmed.'
FROM public.orders
WHERE orders.id = order_tracking.order_id
  AND orders.group_buy_id IS NOT NULL
  AND order_tracking.status = 'confirmed'
  AND order_tracking.notes = 'The 48-hour refund request window elapsed; order automatically confirmed.';

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
          WHEN orders.group_buy_id IS NOT NULL THEN
            COALESCE(
              (
                SELECT gbp.joined_at
                FROM public.group_buy_participants gbp
                WHERE gbp.group_buy_id = orders.group_buy_id
                  AND gbp.user_id = auth.uid()
                ORDER BY gbp.joined_at DESC
                LIMIT 1
              ),
              CASE
                WHEN orders.status = 'order_placed' THEN orders.updated_at
                ELSE orders.created_at
              END
            ) + interval '1 hour'
          ELSE
            (
              CASE
                WHEN orders.status = 'order_placed' THEN orders.updated_at
                ELSE orders.created_at
              END
            ) + interval '48 hours'
        END
      )
  )
);

SELECT public.confirm_orders_after_refund_window();

COMMIT;
