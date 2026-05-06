-- Add "Ready Now" category (ready availability items)
INSERT INTO public.categories (name, slug, icon, is_active)
VALUES ('Ready Now', 'ready-now', 'Package', true)
ON CONFLICT (slug) DO NOTHING;

-- Add is_ready_now column to products for readily available items
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_ready_now boolean DEFAULT false;

-- Make sure product_shipping_rules table exists and has proper structure
-- This allows admin to set custom shipping prices per product
ALTER TABLE public.product_shipping_rules 
ADD COLUMN IF NOT EXISTS is_allowed boolean DEFAULT true;