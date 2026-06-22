-- Allow customers to defer shipping payment at checkout; admin sets the final fee later.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_payment_deferred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_shipping_price numeric,
  ADD COLUMN IF NOT EXISTS shipping_fee_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_payment_reference text;

INSERT INTO public.store_settings (key, value)
VALUES ('deferShippingPaymentEnabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.get_public_store_settings()
RETURNS TABLE (
  key text,
  value jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT store_settings.key, store_settings.value
  FROM public.store_settings
  WHERE store_settings.key = ANY (
    ARRAY[
      'group_buy_settings',
      'heroCarouselImages',
      'loyaltyEnabled',
      'loyaltyPointsPerOrder',
      'loyaltyPointsToCurrencyRate',
      'loyaltyMinOrderAmount',
      'loyaltyMinRedeemPoints',
      'couponsEnabled',
      'giftCardsEnabled',
      'deferShippingPaymentEnabled',
      'maintenanceEndTime',
      'maintenanceMode',
      'maintenanceStartTime',
      'mapProvider',
      'mapboxPublicKey',
      'mapbox_public_key',
      'reinforcedPackagingCost',
      'supportEmail',
      'supportHours',
      'supportLocation',
      'supportPhone',
      'vapidPublicKey',
      'vapid_public_key'
    ]
  )
  OR store_settings.key LIKE 'feature\_%' ESCAPE '\';
$$;
