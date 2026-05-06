-- Align review moderation and product/group-buy controls with the current app flow.

ALTER TABLE public.reviews
ALTER COLUMN is_approved SET DEFAULT false;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS allow_standard_packaging boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_reinforced_packaging boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS group_buy_price numeric;

ALTER TABLE public.group_buys
ADD COLUMN IF NOT EXISTS group_price numeric;
