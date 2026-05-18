CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'AJYN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$;

UPDATE public.orders AS o
SET order_number = regexp_replace(o.order_number, '^IHS-', 'AJYN-', 'i')
WHERE o.order_number ILIKE 'IHS-%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.orders AS existing
    WHERE existing.order_number = regexp_replace(o.order_number, '^IHS-', 'AJYN-', 'i')
      AND existing.id <> o.id
  );

UPDATE public.referral_codes AS rc
SET code = regexp_replace(rc.code, '^(IHSAN|IHS)-?', 'AJYN-', 'i')
WHERE rc.code ~* '^(IHSAN|IHS)-?'
  AND NOT EXISTS (
    SELECT 1
    FROM public.referral_codes AS existing
    WHERE existing.code = regexp_replace(rc.code, '^(IHSAN|IHS)-?', 'AJYN-', 'i')
      AND existing.id <> rc.id
  );
