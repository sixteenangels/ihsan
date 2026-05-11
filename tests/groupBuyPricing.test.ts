import { describe, expect, it } from 'vitest';

import {
  getGroupBuySavingsPercent,
  getGroupBuyUnitPrice,
} from '@/lib/groupBuyPricing';

describe('group buy pricing helpers', () => {
  it('prefers the explicit group price when provided', () => {
    expect(
      getGroupBuyUnitPrice({
        basePrice: 120,
        groupPrice: 90,
        discountPercentage: 50,
      }),
    ).toBe(90);
  });

  it('calculates the discounted unit price when no group price exists', () => {
    expect(
      getGroupBuyUnitPrice({
        basePrice: 200,
        groupPrice: null,
        discountPercentage: 25,
      }),
    ).toBe(150);
  });

  it('rounds savings percent and never returns a negative savings value', () => {
    expect(
      getGroupBuySavingsPercent({
        basePrice: 99,
        groupPrice: null,
        discountPercentage: 15,
      }),
    ).toBe(15);

    expect(
      getGroupBuySavingsPercent({
        basePrice: 100,
        groupPrice: 125,
      }),
    ).toBe(0);
  });

  it('returns zero savings when the base price is missing or invalid', () => {
    expect(
      getGroupBuySavingsPercent({
        basePrice: 0,
        groupPrice: 10,
      }),
    ).toBe(0);
  });
});
