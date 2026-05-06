-- Create chat_messages table for live support
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID,
  message TEXT NOT NULL,
  is_from_admin BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_read BOOLEAN DEFAULT false,
  is_broadcast BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pdf_url TEXT,
  qr_code TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Chat messages policies
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all messages"
ON public.chat_messages
FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id OR is_broadcast = true OR is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Receipts policies
CREATE POLICY "Users can view receipts for their orders"
ON public.receipts
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orders 
  WHERE orders.id = receipts.order_id 
  AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))
));

CREATE POLICY "Admins can manage all receipts"
ON public.receipts
FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$;

-- Trigger for receipt number generation
CREATE TRIGGER generate_receipt_number_trigger
BEFORE INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.generate_receipt_number();