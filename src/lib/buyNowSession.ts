const BUY_NOW_SESSION_KEY = 'ajyn:pending-buy-now';
const BUY_NOW_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export interface PendingBuyNowVariant {
  variantId: string;
  quantity: number;
}

export interface PendingBuyNowSession {
  productId: string;
  selectedVariants: PendingBuyNowVariant[];
  selectedShippingRuleId?: string | null;
  createdAt: number;
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function savePendingBuyNowSession(input: Omit<PendingBuyNowSession, 'createdAt'>) {
  if (!canUseSessionStorage()) return;

  window.sessionStorage.setItem(
    BUY_NOW_SESSION_KEY,
    JSON.stringify({
      ...input,
      createdAt: Date.now(),
    } satisfies PendingBuyNowSession),
  );
}

export function readPendingBuyNowSession(productId?: string | null) {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(BUY_NOW_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingBuyNowSession>;
    if (!parsed.productId || !Array.isArray(parsed.selectedVariants) || !parsed.createdAt) {
      clearPendingBuyNowSession();
      return null;
    }

    if (Date.now() - parsed.createdAt > BUY_NOW_SESSION_MAX_AGE_MS) {
      clearPendingBuyNowSession();
      return null;
    }

    if (productId && parsed.productId !== productId) {
      return null;
    }

    return parsed as PendingBuyNowSession;
  } catch {
    clearPendingBuyNowSession();
    return null;
  }
}

export function clearPendingBuyNowSession() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(BUY_NOW_SESSION_KEY);
}
