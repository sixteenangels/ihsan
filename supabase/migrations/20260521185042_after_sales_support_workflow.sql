-- After-sales support workflow and secure attachment uploads.

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS support_type text
    CHECK (support_type IN (
      'damaged_item',
      'wrong_item_received',
      'missing_item_accessory',
      'refund_request',
      'exchange_request',
      'product_quality_concern',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS delivery_date timestamptz,
  ADD COLUMN IF NOT EXISTS product_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS attachment_paths text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_support_requests_category_status_created_at
ON public.support_requests(category, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_support_type_status_created_at
ON public.support_requests(support_type, status, created_at DESC)
WHERE support_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_requests_order_id
ON public.support_requests(order_id)
WHERE order_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'after-sales-attachments',
  'after-sales-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Customers and admins can view after-sales attachments" ON storage.objects;
CREATE POLICY "Customers and admins can view after-sales attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'after-sales-attachments'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR is_admin_or_manager(auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers and admins can upload after-sales attachments" ON storage.objects;
CREATE POLICY "Customers and admins can upload after-sales attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'after-sales-attachments'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR is_admin_or_manager(auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers and admins can update after-sales attachments" ON storage.objects;
CREATE POLICY "Customers and admins can update after-sales attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'after-sales-attachments'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR is_admin_or_manager(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'after-sales-attachments'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR is_admin_or_manager(auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers and admins can delete after-sales attachments" ON storage.objects;
CREATE POLICY "Customers and admins can delete after-sales attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'after-sales-attachments'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    OR is_admin_or_manager(auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
