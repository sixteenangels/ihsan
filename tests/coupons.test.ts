import { describe, expect, it } from 'vitest';
import {
  getCouponDiscountAmount,
  isCouponEligibleForOrder,
  normalizeCoupon,
} from '@/lib/coupons';

describe('coupons', () => {
  it('normalizes jsonb coupon payloads with string numerics', () => {
    const coupon = normalizeCoupon({
      id: '8bc4c25d-104f-423a-8c93-fb5c82fdec80',
      code: 'save20',
      type: 'percentage',
      value: '10.00',
      min_order_amount: '0.00',
      current_uses: '0',
      max_uses: '1',
      first_order_only: false,
    });

    expect(coupon?.code).toBe('SAVE20');
    expect(coupon?.value).toBe(10);
    expect(coupon?.min_order_amount).toBe(0);
  });

  it('treats zero minimum order as eligible', () => {
    const coupon = normalizeCoupon({
      id: '1',
      code: 'REF',
      type: 'percentage',
      value: 5,
      min_order_amount: '0.00',
      current_uses: 0,
      max_uses: 1,
    });

    expect(coupon).not.toBeNull();
    expect(isCouponEligibleForOrder(coupon!, 25, 2)).toBe(true);
  });

  it('calculates percentage and fixed discounts', () => {
    const percentage = normalizeCoupon({
      id: '1',
      code: 'SAVE20',
      type: 'percentage',
      value: 10,
    });
    const fixed = normalizeCoupon({
      id: '2',
      code: 'FLAT5',
      type: 'fixed_amount',
      value: 5,
    });

    expect(getCouponDiscountAmount(percentage!, 200)).toBe(20);
    expect(getCouponDiscountAmount(fixed!, 3)).toBe(3);
  });
});
