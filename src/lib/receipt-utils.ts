import { format } from 'date-fns';

interface ReceiptItem {
  productName: string;
  variantDetails: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptAddress {
  full_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface PrintableReceipt {
  receiptNumber: string;
  generatedAt: string;
  qrPayload: string;
  orderNumber: string;
  orderStatus: string;
  orderDate?: string | null;
  customerName: string;
  customerEmail?: string | null;
  subtotal: number;
  shippingPrice: number;
  packagingCost?: number;
  walletCreditUsed?: number;
  totalAmount: number;
  shippingAddress?: ReceiptAddress | null;
  items: ReceiptItem[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(amount: number) {
  return `GHS ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildReceiptQrPayload(receiptNumber: string, orderNumber: string) {
  const fallbackOrigin = 'https://controlled-commerce-hub-main.vercel.app';
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : fallbackOrigin;

  return `${origin}/receipt/${encodeURIComponent(receiptNumber)}?order=${encodeURIComponent(orderNumber)}`;
}

export function buildReceiptVerificationUrl(receiptNumber: string) {
  return buildReceiptQrPayload(receiptNumber, receiptNumber);
}

export function buildReceiptQrUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
}

export function buildReceiptHtml(receipt: PrintableReceipt) {
  const address = receipt.shippingAddress;
  const orderDate = receipt.orderDate
    ? format(new Date(receipt.orderDate), 'MMMM d, yyyy')
    : 'N/A';
  const receiptDate = format(new Date(receipt.generatedAt), 'MMMM d, yyyy');
  const qrUrl = buildReceiptQrUrl(receipt.qrPayload);
  const verificationUrl = receipt.qrPayload;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(receipt.receiptNumber)}</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; color: #111827; padding: 32px; max-width: 840px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 20px; margin-bottom: 24px; }
      .brand { font-size: 28px; font-weight: 700; }
      .meta { text-align: right; }
      .meta p, .details p { margin: 4px 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
      .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
      .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { text-align: left; padding: 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280; }
      td { padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
      td.right, th.right { text-align: right; }
      .totals { margin-left: auto; width: 320px; }
      .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
      .totals-row.total { border-top: 2px solid #111827; font-weight: 700; font-size: 18px; margin-top: 8px; padding-top: 12px; }
      .qr { text-align: center; }
      .qr img { width: 180px; height: 180px; }
      .link { word-break: break-all; font-size: 12px; color: #2563eb; }
      .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">Ihsan</div>
        <p>Official order receipt</p>
      </div>
      <div class="meta">
        <p><strong>Receipt:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
        <p><strong>Order:</strong> ${escapeHtml(receipt.orderNumber)}</p>
        <p><strong>Generated:</strong> ${escapeHtml(receiptDate)}</p>
      </div>
    </div>

    <div class="grid">
      <div class="card details">
        <div class="label">Customer</div>
        <p><strong>${escapeHtml(receipt.customerName)}</strong></p>
        ${receipt.customerEmail ? `<p>${escapeHtml(receipt.customerEmail)}</p>` : ''}
        <p><strong>Status:</strong> ${escapeHtml(receipt.orderStatus)}</p>
        <p><strong>Order Date:</strong> ${escapeHtml(orderDate)}</p>
      </div>
      <div class="card details">
        <div class="label">Shipping Address</div>
        ${
          address
            ? `
              <p>${escapeHtml(address.full_name || receipt.customerName)}</p>
              <p>${escapeHtml(address.address_line1 || '')}</p>
              ${address.address_line2 ? `<p>${escapeHtml(address.address_line2)}</p>` : ''}
              <p>${escapeHtml([address.city, address.state, address.postal_code].filter(Boolean).join(', '))}</p>
              ${address.country ? `<p>${escapeHtml(address.country)}</p>` : ''}
              ${address.phone ? `<p>${escapeHtml(address.phone)}</p>` : ''}
            `
            : '<p>No shipping address captured.</p>'
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Details</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.productName)}</td>
                <td>${escapeHtml(item.variantDetails || '-')}</td>
                <td class="right">${item.quantity}</td>
                <td class="right">${escapeHtml(formatMoney(item.unitPrice))}</td>
                <td class="right">${escapeHtml(formatMoney(item.totalPrice))}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>

    <div class="grid">
      <div class="card qr">
        <div class="label">Verification QR</div>
        <img src="${qrUrl}" alt="Receipt QR code" />
        <p class="link">${escapeHtml(verificationUrl)}</p>
      </div>
      <div class="card">
        <div class="label">Totals</div>
        <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(receipt.subtotal))}</span></div>
        <div class="totals-row"><span>Shipping</span><span>${escapeHtml(formatMoney(receipt.shippingPrice || 0))}</span></div>
        ${
          receipt.packagingCost && receipt.packagingCost > 0
            ? `<div class="totals-row"><span>Packaging</span><span>${escapeHtml(formatMoney(receipt.packagingCost))}</span></div>`
            : ''
        }
        ${
          receipt.walletCreditUsed && receipt.walletCreditUsed > 0
            ? `<div class="totals-row"><span>Wallet Credit</span><span>- ${escapeHtml(formatMoney(receipt.walletCreditUsed))}</span></div>`
            : ''
        }
        <div class="totals-row total"><span>Total</span><span>${escapeHtml(formatMoney(receipt.totalAmount))}</span></div>
      </div>
    </div>

    <div class="footer">
      Thank you for shopping with Ihsan. Keep this receipt for your records.
    </div>
  </body>
</html>`;
}

export function printReceipt(receipt: PrintableReceipt) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    throw new Error('Unable to open print preview.');
  }

  printWindow.document.write(buildReceiptHtml(receipt));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function downloadReceipt(receipt: PrintableReceipt) {
  const blob = new Blob([buildReceiptHtml(receipt)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${receipt.receiptNumber}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
