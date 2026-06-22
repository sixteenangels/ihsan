import { useStoreSettings } from '@/hooks/useStoreSettings';
import { parseBooleanStoreSetting } from '@/lib/storeSettingFlags';

export function useCheckoutFeatureFlags() {
  const { data: storeSettings } = useStoreSettings();

  return {
    couponsEnabled: parseBooleanStoreSetting(storeSettings?.couponsEnabled, true),
    giftCardsEnabled: parseBooleanStoreSetting(storeSettings?.giftCardsEnabled, true),
    loyaltyEnabled: parseBooleanStoreSetting(storeSettings?.loyaltyEnabled, true),
    deferShippingPaymentEnabled: parseBooleanStoreSetting(storeSettings?.deferShippingPaymentEnabled, false),
  };
}
