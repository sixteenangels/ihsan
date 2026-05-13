import { STORAGE_KEYS, getStoredItem, removeStoredItems } from '@/lib/brand';

export interface CheckoutRecoverySnapshot {
  itemCount: number;
  subtotal: number;
  productNames: string[];
  shippingLabel?: string | null;
  updatedAt: string;
}

const STORAGE_KEY = STORAGE_KEYS.checkoutRecovery;
const LEGACY_STORAGE_KEYS = STORAGE_KEYS.checkoutRecoveryLegacy;
const CHECKOUT_RECOVERY_EVENT = STORAGE_KEYS.checkoutRecoveryEvent;

export function loadCheckoutRecoverySnapshot(): CheckoutRecoverySnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedSnapshot = getStoredItem(window.localStorage, [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
    if (!storedSnapshot) {
      return null;
    }

    const parsed = JSON.parse(storedSnapshot.value) as CheckoutRecoverySnapshot;
    if (!parsed || parsed.itemCount <= 0) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckoutRecoverySnapshot(snapshot: CheckoutRecoverySnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  removeStoredItems(window.localStorage, LEGACY_STORAGE_KEYS);
  window.dispatchEvent(new Event(CHECKOUT_RECOVERY_EVENT));
}

export function clearCheckoutRecoverySnapshot() {
  if (typeof window === 'undefined') {
    return;
  }

  removeStoredItems(window.localStorage, [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  window.dispatchEvent(new Event(CHECKOUT_RECOVERY_EVENT));
}

export { CHECKOUT_RECOVERY_EVENT };
