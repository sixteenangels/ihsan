
DROP POLICY IF EXISTS "Admins and managers can update all orders" ON public.orders;

CREATE POLICY "Admins and managers can update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
