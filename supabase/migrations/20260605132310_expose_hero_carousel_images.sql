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

NOTIFY pgrst, 'reload schema';
