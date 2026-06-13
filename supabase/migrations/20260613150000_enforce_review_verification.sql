-- Prevent clients from forging verified-purchase badges on product reviews.

CREATE OR REPLACE FUNCTION public.enforce_review_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.is_verified := (
    NEW.order_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = NEW.order_id
        AND o.user_id = NEW.user_id
        AND o.status = 'delivered'
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_review_verification ON public.reviews;
CREATE TRIGGER enforce_review_verification
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_verification();
