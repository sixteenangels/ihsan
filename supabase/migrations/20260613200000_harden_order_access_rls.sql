-- Harden order access by restoring SECURITY DEFINER role helpers used in RLS policies.
-- Migration 20260613140000 switched these to SECURITY INVOKER; if private schema grants
-- drift again, admin/customer order reads fail silently in the app.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id = auth.uid() THEN private.has_role(_user_id, _role)
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role) THEN private.has_role(_user_id, _role)
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id = auth.uid() THEN private.is_admin_or_manager(_user_id)
    WHEN private.has_role(auth.uid(), 'admin'::public.app_role) THEN private.is_admin_or_manager(_user_id)
    ELSE false
  END;
$function$;

DROP POLICY IF EXISTS "Admins and managers can create orders for customers" ON public.orders;

CREATE POLICY "Admins and managers can create orders for customers"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_manager(auth.uid()));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_or_manager(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
