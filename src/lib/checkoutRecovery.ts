export interface CheckoutRecoverySnapshot {
  itemCount: number;
  subtotal: number;
  productNames: string[];
  shippingLabel?: string | null;
  updatedAt: string;
}

const STORAGE_KEY = 'ihsan_checkout_recovery_v1';
const CHECKOUT_RECOVERY_EVENT = 'ihsan:checkout-recovery-updated';

export function loadCheckoutRecoverySnapshot(): CheckoutRecoverySnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as CheckoutRecoverySnapshot;
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
  window.dispatchEvent(new Event(CHECKOUT_RECOVERY_EVENT));
}

export function clearCheckoutRecoverySnapshot() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHECKOUT_RECOVERY_EVENT));
}

export { CHECKOUT_RECOVERY_EVENT };
