import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHECKOUT_RECOVERY_EVENT,
  clearCheckoutRecoverySnapshot,
  loadCheckoutRecoverySnapshot,
  saveCheckoutRecoverySnapshot,
  type CheckoutRecoverySnapshot,
} from '@/lib/checkoutRecovery';

const STORAGE_KEY = 'ihsan_checkout_recovery_v1';

describe('checkout recovery snapshot helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and reloads a checkout recovery snapshot', () => {
    const snapshot: CheckoutRecoverySnapshot = {
      itemCount: 2,
      subtotal: 150,
      productNames: ['Premium Blender', 'Travel Mug'],
      shippingLabel: 'Express',
      updatedAt: '2026-05-11T12:00:00.000Z',
    };
    const handler = vi.fn();

    window.addEventListener(CHECKOUT_RECOVERY_EVENT, handler);
    saveCheckoutRecoverySnapshot(snapshot);

    expect(loadCheckoutRecoverySnapshot()).toEqual(snapshot);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(CHECKOUT_RECOVERY_EVENT, handler);
  });

  it('clears a saved snapshot and dispatches the update event', () => {
    const handler = vi.fn();

    saveCheckoutRecoverySnapshot({
      itemCount: 1,
      subtotal: 30,
      productNames: ['Desk Lamp'],
      updatedAt: '2026-05-11T12:00:00.000Z',
    });

    window.addEventListener(CHECKOUT_RECOVERY_EVENT, handler);
    clearCheckoutRecoverySnapshot();

    expect(loadCheckoutRecoverySnapshot()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(CHECKOUT_RECOVERY_EVENT, handler);
  });

  it('ignores invalid or empty stored snapshots', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(loadCheckoutRecoverySnapshot()).toBeNull();

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        itemCount: 0,
        subtotal: 0,
        productNames: [],
        updatedAt: '2026-05-11T12:00:00.000Z',
      }),
    );
    expect(loadCheckoutRecoverySnapshot()).toBeNull();
  });
});
