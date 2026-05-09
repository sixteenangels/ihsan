UPDATE public.products
SET
  is_active = true,
  updated_at = now()
WHERE is_active IS DISTINCT FROM true;

UPDATE public.product_variants
SET
  is_active = true,
  updated_at = now()
WHERE is_active IS DISTINCT FROM true;
