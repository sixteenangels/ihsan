
-- Fix orders table: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins and managers can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

CREATE POLICY "Admins and managers can update all orders"
ON public.orders FOR UPDATE
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create their own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

-- Fix order_items table
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;

CREATE POLICY "Users can create order items for their orders"
ON public.order_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users can view their own order items"
ON public.order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- Fix order_tracking table
DROP POLICY IF EXISTS "Admins can manage order tracking" ON public.order_tracking;
DROP POLICY IF EXISTS "Users can view tracking for their orders" ON public.order_tracking;

CREATE POLICY "Admins can manage order tracking"
ON public.order_tracking FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view tracking for their orders"
ON public.order_tracking FOR SELECT
USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_tracking.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- Fix notifications table
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR is_broadcast = true OR is_admin_or_manager(auth.uid()));
