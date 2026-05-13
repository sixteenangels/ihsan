export const BRAND_NAME = 'AJYN';
export const BRAND_SHORT_NAME = 'AJYN';
export const BRAND_TAGLINE = 'Global Shopping Made Simple';
export const BRAND_SUPPORT_NAME = `${BRAND_NAME} Support`;
export const BRAND_ADMIN_NAME = `${BRAND_NAME} Admin`;
export const BRAND_TEAM_NAME = `${BRAND_NAME} Team`;
export const BRAND_SUPPORT_DESK = `${BRAND_NAME} Support Desk`;
export const BRAND_REFERRAL_PREFIX = 'AJYN';
export const BRAND_DOWNLOAD_SLUG = 'ajyn';
export const BRAND_TEST_ORIGIN = 'https://ajyn.test';

export const STORAGE_KEYS = {
  cart: 'ajyn_scan_cart_v1',
  cartLegacy: ['ihsan_cart_v2'],
  tempSession: 'ajyn_scan_temp_session',
  tempSessionLegacy: ['ihsan_temp_session'],
  sessionMode: 'ajyn_scan_session_mode',
  sessionModeLegacy: ['ihsan_session_mode'],
  buildId: 'ajyn-scan-app-build-id',
  buildIdLegacy: ['ihsan-app-build-id'],
  checkoutRecovery: 'ajyn_scan_checkout_recovery_v1',
  checkoutRecoveryLegacy: ['ihsan_checkout_recovery_v1'],
  checkoutRecoveryEvent: 'ajyn-scan:checkout-recovery-updated',
  checkoutRecoveryEventLegacy: ['ihsan:checkout-recovery-updated'],
  pendingReferralCode: 'ajyn_scan_pending_referral_code',
  pendingReferralCodeLegacy: ['ihsan_pending_referral_code'],
  processedReferralPrefix: 'ajyn_scan_processed_referral',
  processedReferralPrefixLegacy: ['ihsan_processed_referral'],
  adminSwipeHintDismissed: 'ajyn_scan_admin_swipe_hint_dismissed',
  adminSwipeHintDismissedLegacy: ['ihsan_admin_swipe_hint_dismissed'],
} as const;

export function getStoredItem(
  storage: Storage,
  keys: readonly string[],
): { key: string; value: string } | null {
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value != null) {
      return { key, value };
    }
  }

  return null;
}

export function removeStoredItems(storage: Storage, keys: readonly string[]) {
  keys.forEach((key) => storage.removeItem(key));
}
