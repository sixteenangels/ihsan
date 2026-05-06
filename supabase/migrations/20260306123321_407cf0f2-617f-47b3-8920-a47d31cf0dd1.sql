
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Allow customers to update their own order status (for confirm payment/delivery/cancel)
CREATE POLICY "Users can update their own orders status"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
