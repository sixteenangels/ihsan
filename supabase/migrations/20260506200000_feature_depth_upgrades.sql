-- Deepen support ticketing, fulfillment metadata, and customer restock alerts.

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_reply text,
  ADD COLUMN IF NOT EXISTS resolution_summary text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_stage text NOT NULL DEFAULT 'new'
    CHECK (fulfillment_stage IN ('new', 'picked', 'quality_checked', 'packed', 'awaiting_dispatch', 'dispatched')),
  ADD COLUMN IF NOT EXISTS fulfillment_checks jsonb NOT NULL DEFAULT
    '{"picked": false, "quality_checked": false, "packed": false, "awaiting_dispatch": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_tracking_number text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_note text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_image_url text,
  ADD COLUMN IF NOT EXISTS proof_of_delivery_at timestamptz;

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz
);

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stock alerts" ON public.stock_alerts;
DROP POLICY IF EXISTS "Users can create their own stock alerts" ON public.stock_alerts;
DROP POLICY IF EXISTS "Users can delete their own stock alerts" ON public.stock_alerts;
DROP POLICY IF EXISTS "Admins can view stock alerts" ON public.stock_alerts;

CREATE POLICY "Users can view their own stock alerts"
ON public.stock_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create their own stock alerts"
ON public.stock_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stock alerts"
ON public.stock_alerts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can view stock alerts"
ON public.stock_alerts
FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_variant
ON public.stock_alerts(product_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_user
ON public.stock_alerts(user_id, created_at DESC);

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
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.receipt_number,
    r.generated_at,
    o.order_number,
    COALESCE(o.status::text, 'pending') AS order_status,
    o.created_at AS order_date,
    COALESCE(p.name, o.shipping_address ->> 'full_name', 'Customer') AS customer_name,
    p.email AS customer_email,
    o.subtotal,
    o.shipping_price,
    o.packaging_cost,
    o.wallet_credit_used,
    o.total_amount,
    CASE
      WHEN jsonb_typeof(o.shipping_address) = 'object' THEN o.shipping_address
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

GRANT EXECUTE ON FUNCTION public.verify_receipt(text) TO anon, authenticated;
