export interface CheckoutCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  min_order_amount: number | null;
  current_uses: number | null;
  max_uses?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  auto_apply?: boolean | null;
  first_order_only?: boolean | null;
  marketing_label?: string | null;
}

export function normalizeCoupon(data: unknown): CheckoutCoupon | null {
  if (!data) return null;

  const raw =
    typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : (data as Record<string, unknown>);

  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.code !== 'string') {
    return null;
  }

  const type = raw.type === 'fixed_amount' ? 'fixed_amount' : 'percentage';

  return {
    id: raw.id,
    code: String(raw.code).toUpperCase(),
    type,
    value: Number(raw.value),
    min_order_amount: raw.min_order_amount == null ? null : Number(raw.min_order_amount),
    current_uses: raw.current_uses == null ? null : Number(raw.current_uses),
    max_uses: raw.max_uses == null ? null : Number(raw.max_uses),
    starts_at: (raw.starts_at as string | null | undefined) ?? null,
    expires_at: (raw.expires_at as string | null | undefined) ?? null,
    auto_apply: Boolean(raw.auto_apply),
    first_order_only: Boolean(raw.first_order_only),
    marketing_label: (raw.marketing_label as string | null | undefined) ?? null,
  };
}

export function isCouponEligibleForOrder(
  coupon: CheckoutCoupon,
  selectedSubtotal: number,
  userOrderCount: number,
) {
  const now = new Date();

  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return false;
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    return false;
  }

  if (
    coupon.min_order_amount != null &&
    Number.isFinite(coupon.min_order_amount) &&
    selectedSubtotal + 0.0001 < coupon.min_order_amount
  ) {
    return false;
  }

  if (
    coupon.max_uses != null &&
    Number.isFinite(coupon.max_uses) &&
    Number(coupon.current_uses || 0) >= coupon.max_uses
  ) {
    return false;
  }

  if (coupon.first_order_only && userOrderCount > 0) {
    return false;
  }

  return true;
}

export function getCouponDiscountAmount(coupon: CheckoutCoupon, selectedSubtotal: number) {
  if (coupon.type === 'percentage') {
    return Math.round(((selectedSubtotal * coupon.value) / 100 + Number.EPSILON) * 100) / 100;
  }

  return Math.round((Math.min(coupon.value, selectedSubtotal) + Number.EPSILON) * 100) / 100;
}

export function getCouponIneligibilityMessage(
  coupon: CheckoutCoupon,
  selectedSubtotal: number,
  userOrderCount: number,
) {
  if (coupon.first_order_only && userOrderCount > 0) {
    return 'This coupon is only available for first orders.';
  }

  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    return 'This coupon is not active yet.';
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return 'This coupon has expired.';
  }

  if (
    coupon.min_order_amount != null &&
    selectedSubtotal + 0.0001 < coupon.min_order_amount
  ) {
    return `Minimum order amount of ${coupon.min_order_amount.toFixed(2)} required.`;
  }

  if (
    coupon.max_uses != null &&
    Number(coupon.current_uses || 0) >= coupon.max_uses
  ) {
    return 'This coupon has reached its usage limit.';
  }

  return 'This coupon is not eligible for this order.';
}
