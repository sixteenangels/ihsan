import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';
import { buildReceiptHtml, type PrintableReceipt } from '@/lib/receipt-utils';

export function buildReceiptEmailSubject(receipt: PrintableReceipt) {
  return `Your ${BRAND_NAME} receipt ${receipt.receiptNumber}`
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
      <h1 style="font-size:24px;margin:0 0 16px;">${BRAND_SUPPORT_NAME}</h1>
      <p>Hello ${escapeHtml(input.customerName || 'there')},</p>
      <p>We have an update on your support request: <strong>${escapeHtml(input.subject)}</strong>.</p>
      <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:16px 0;white-space:pre-wrap;">${escapeHtml(input.reply)}</div>
      ${input.summary ? `<p><strong>Resolution summary:</strong> ${escapeHtml(input.summary)}</p>` : ''}
      <p>If you need anything else, simply reply to this email or contact us again through the Help Center.</p>
      <p>Thank you,<br />${BRAND_SUPPORT_NAME}</p>
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
    BRAND_SUPPORT_NAME,
  ].filter(Boolean).join('\n');
}

export function buildOrderStatusEmailSubject(input: {
  orderNumber: string;
  statusLabel: string;
}) {
  return `Order ${input.orderNumber} update: ${input.statusLabel}`;
}

export function buildOrderStatusEmailHtml(input: {
  customerName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  note?: string | null;
}) {
  return `
    <div style="font-family:Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:24px;margin:0 0 16px;">Your ${BRAND_NAME} order is now ${escapeHtml(input.statusLabel)}</h1>
      <p>Hello ${escapeHtml(input.customerName || 'there')},</p>
      <p>Order <strong>${escapeHtml(input.orderNumber)}</strong> has a new status.</p>
      <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Status:</strong> ${escapeHtml(input.statusLabel)}</p>
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
      </div>
      ${input.note ? `<p><strong>Admin note:</strong> ${escapeHtml(input.note)}</p>` : ''}
      <p>Thank you for shopping with ${BRAND_NAME}.</p>
    </div>
  `;
}

export function buildOrderStatusEmailText(input: {
  customerName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  note?: string | null;
}) {
  return [
    `Hello ${input.customerName || 'there'},`,
    '',
    `Order ${input.orderNumber} is now ${input.statusLabel}.`,
    input.message,
    input.note ? `Admin note: ${input.note}` : '',
    '',
    `Thank you for shopping with ${BRAND_NAME}.`,
  ].filter(Boolean).join('\n');
}

export function buildDeliveryWindowEmailSubject(input: {
  orderNumber: string;
}) {
  return `Updated delivery estimate for order ${input.orderNumber}`;
}

export function buildDeliveryWindowEmailHtml(input: {
  customerName: string;
  orderNumber: string;
  startDateLabel: string;
  endDateLabel: string;
}) {
  return `
    <div style="font-family:Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:24px;margin:0 0 16px;">Your delivery estimate has been updated</h1>
      <p>Hello ${escapeHtml(input.customerName || 'there')},</p>
      <p>Your order <strong>${escapeHtml(input.orderNumber)}</strong> is currently estimated to arrive between:</p>
      <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:16px 0;">
        <p style="margin:0;font-size:18px;font-weight:600;">${escapeHtml(input.startDateLabel)} to ${escapeHtml(input.endDateLabel)}</p>
      </div>
      <p>We will keep you updated if anything changes.</p>
    </div>
  `;
}

export function buildDeliveryWindowEmailText(input: {
  customerName: string;
  orderNumber: string;
  startDateLabel: string;
  endDateLabel: string;
}) {
  return [
    `Hello ${input.customerName || 'there'},`,
    '',
    `Your order ${input.orderNumber} is now estimated to arrive between ${input.startDateLabel} and ${input.endDateLabel}.`,
    '',
    'We will keep you updated if anything changes.',
  ].join('\n');
}

export function buildRefundEmailSubject(input: {
  orderNumber: string;
  statusLabel: string;
}) {
  return `Refund update for order ${input.orderNumber}: ${input.statusLabel}`;
}

export function buildRefundEmailHtml(input: {
  customerName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  adminNotes?: string | null;
}) {
  return `
    <div style="font-family:Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:24px;margin:0 0 16px;">Refund request ${escapeHtml(input.statusLabel)}</h1>
      <p>Hello ${escapeHtml(input.customerName || 'there')},</p>
      <p>There is an update for your refund request on order <strong>${escapeHtml(input.orderNumber)}</strong>.</p>
      <div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin:16px 0;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
      ${input.adminNotes ? `<p><strong>Admin note:</strong> ${escapeHtml(input.adminNotes)}</p>` : ''}
      <p>If you have further questions, please reply through the Help Center.</p>
    </div>
  `;
}

export function buildRefundEmailText(input: {
  customerName: string;
  orderNumber: string;
  statusLabel: string;
  message: string;
  adminNotes?: string | null;
}) {
  return [
    `Hello ${input.customerName || 'there'},`,
    '',
    `Your refund request for order ${input.orderNumber} is now ${input.statusLabel}.`,
    '',
    input.message,
    input.adminNotes ? `Admin note: ${input.adminNotes}` : '',
    '',
    'If you have further questions, please reply through the Help Center.',
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
