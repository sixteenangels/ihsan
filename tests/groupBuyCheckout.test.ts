import { describe, expect, it } from 'vitest';

import { hasRequiredGroupBuyDeliveryDetails } from '@/lib/groupBuyCheckout';

describe('group buy delivery validation', () => {
  it('requires the full saved delivery address and contact email', () => {
    expect(
      hasRequiredGroupBuyDeliveryDetails({
        address: {
          full_name: 'Jane Doe',
          phone: '+233000000000',
          address_line1: '123 Market Street',
          city: 'Accra',
          country: 'Ghana',
        },
        email: 'jane@example.com',
      }),
    ).toBe(true);
  });

  it('fails when the saved delivery address is incomplete', () => {
    expect(
      hasRequiredGroupBuyDeliveryDetails({
        address: {
          full_name: 'Jane Doe',
          phone: '',
          address_line1: '123 Market Street',
          city: 'Accra',
          country: 'Ghana',
        },
        email: 'jane@example.com',
      }),
    ).toBe(false);
  });
});
