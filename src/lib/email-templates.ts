import { buildReceiptHtml, type PrintableReceipt } from '@/lib/receipt-utils';

export function buildReceiptEmailSubject(receipt: PrintableReceipt) {
  return `Your Ihsan receipt ${receipt.receiptNumber}`
}

export function buildReceiptEmailText(receipt: PrintableReceipt) {
  return [
    `Receipt: ${receipt.receiptNumber}`,
    `Order: ${receipt.orderNumber}`,
    `Total: GHS ${receipt.totalAmount.toFixed(2)}`,
    `Verification: ${receipt.qrPayload}`,
  ].join('\n')
}

export function buildReceiptEmailHtml(receipt: PrintableReceipt) {
  return buildReceiptHtml(receipt)
}

export function buildSupportReplyEmailHtml(input: {
  customerName: string;
  subject: string;
  reply: string;
  summary?: string | null;
}) {
  return `
    <div style="font-family:Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:24px;margin:0 0 16px;">Ihsan Support</h1>
      <p>Hello ${escapeHtml(input.customerName || 'there')},</p>
      <p>We have an update on your support request: <strong>${escapeHtml(input.subject)}</strong>.</p>
      <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:16px 0;white-space:pre-wrap;">${escapeHtml(input.reply)}</div>
      ${input.summary ? `<p><strong>Resolution summary:</strong> ${escapeHtml(input.summary)}</p>` : ''}
      <p>If you need anything else, simply reply to this email or contact us again through the Help Center.</p>
      <p>Thank you,<br />Ihsan Support</p>
    </div>
  `;
}

export function buildSupportReplyEmailText(input: {
  customerName: string;
  subject: string;
  reply: string;
  summary?: string | null;
}) {
  return [
    `Hello ${input.customerName || 'there'},`,
    '',
    `We have an update on your support request: ${input.subject}.`,
    '',
    input.reply,
    '',
    input.summary ? `Resolution summary: ${input.summary}` : '',
    '',
    'Thank you,',
    'Ihsan Support',
  ].filter(Boolean).join('\n');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
