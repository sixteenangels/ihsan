
-- Add payment_reference column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create index for payment reference lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference) WHERE payment_reference IS NOT NULL;
