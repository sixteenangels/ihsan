import { describe, expect, it } from 'vitest';

import {
  buildReceiptHtml,
  buildReceiptQrPayload,
  buildReceiptQrUrl,
  buildReceiptVerificationUrl,
  type PrintableReceipt,
} from '@/lib/receipt-utils';

describe('receipt utilities', () => {
  it('builds receipt URLs from the current browser origin', () => {
    expect(buildReceiptQrPayload('REC 001', 'ORD/1')).toBe(
      'https://ajyn.test/receipt/REC%20001?order=ORD%2F1',
    );
    expect(buildReceiptVerificationUrl('REC 001')).toBe(
      'https://ajyn.test/receipt/REC%20001?order=REC%20001',
    );
    expect(buildReceiptQrUrl('hello world')).toContain('data=hello%20world');
  });

  it('escapes receipt content and renders optional totals rows', () => {
    const receipt: PrintableReceipt = {
      receiptNumber: 'REC-001',
      generatedAt: '2026-05-11T12:00:00.000Z',
      qrPayload: buildReceiptQrPayload('REC-001', 'ORD-001'),
      orderNumber: 'ORD-001',
      orderStatus: 'Delivered',
      orderDate: '2026-05-10T08:00:00.000Z',
      customerName: '<A & B>',
      customerEmail: 'buyer@example.com',
      subtotal: 100,
      shippingPrice: 15,
      packagingCost: 5,
      walletCreditUsed: 20,
      totalAmount: 100,
      shippingAddress: {
        full_name: '<Jane Doe>',
        address_line1: '1 Main <Street>',
        city: 'Accra & Tema',
        country: 'Ghana',
        phone: '+2335550101',
      },
      items: [
        {
          productName: '<Widget>',
          variantDetails: 'Red & "Large"',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
        },
      ],
    };

    const html = buildReceiptHtml(receipt);

    expect(html).toContain('&lt;A &amp; B&gt;');
    expect(html).toContain('&lt;Jane Doe&gt;');
    expect(html).toContain('1 Main &lt;Street&gt;');
    expect(html).toContain('&lt;Widget&gt;');
    expect(html).toContain('Red &amp; &quot;Large&quot;');
    expect(html).toContain('Wallet Credit');
    expect(html).toContain('Packaging');
    expect(html).toContain('GHS 100.00');
  });
});
