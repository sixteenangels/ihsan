import { useStoreSettings } from './useStoreSettings';

const FEATURE_KEYS = {
  group_buys: 'feature_group_buys',
  flash_deals: 'feature_flash_deals',
  reviews: 'feature_reviews',
  qa: 'feature_qa',
  wishlist: 'feature_wishlist',
  compare: 'feature_compare',
  bundles: 'feature_bundles',
  price_drop_alerts: 'feature_price_drop_alerts',
  recently_viewed: 'feature_recently_viewed',
  live_chat: 'feature_live_chat',
  abandoned_cart: 'feature_abandoned_cart',
  welcome_modal: 'feature_welcome_modal',
  cookie_consent: 'feature_cookie_consent',
  push_notifications: 'feature_push_notifications',
} as const;

export type FeatureKey = keyof typeof FEATURE_KEYS;

export function useFeatureFlags() {
  const { data: settings, isLoading } = useStoreSettings();

  const isEnabled = (feature: FeatureKey): boolean => {
    if (!settings) return true; // Default to enabled while loading
    const key = FEATURE_KEYS[feature];
    const value = settings[key];
    // Default to true if not set
    return value === undefined || value === null ? true : !!value;
  };

  return { isEnabled, isLoading };
}

export { FEATURE_KEYS };
