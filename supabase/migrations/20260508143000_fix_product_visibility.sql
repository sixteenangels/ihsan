UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;

UPDATE public.product_variants
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE public.products
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE public.product_variants
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;

CREATE POLICY "Active products are viewable by everyone"
ON public.products
FOR SELECT
USING (coalesce(is_active, true) = true OR is_admin_or_manager(auth.uid()));
