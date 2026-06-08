import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';
import type { PrintableReceipt } from '@/lib/receipt-utils';

const SUPPORT_EMAIL = 'support@ajynworld.com';
const SUPPORT_PHONE = '+233 20 123 4567';
const EMAIL_LOGO_URL = 'https://www.ajynworld.com/favicon.png';

type AjynEmailInput = {
  eyebrow?: string;
  reference?: string;
  icon?: string;
  title: string;
  greetingName?: string;
  intro?: string;
  bodyHtml?: string;
  statusTitle?: string;
  statusText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  closing?: string;
};

const AJYN_EMAIL_MOBILE_STYLES = `
      table { border-spacing:0; }
      a { color:inherit; }
      @media only screen and (max-width: 600px) {
        .ajyn-container { padding:24px 18px !important; }
        .ajyn-logo { max-width:120px !important; }
        .ajyn-reference { padding:24px 0 20px !important; font-size:14px !important; }
        .ajyn-status-orb { width:72px !important; height:72px !important; }
        .ajyn-status-symbol { font-size:34px !important; line-height:72px !important; }
        .ajyn-title { font-size:34px !important; line-height:1.18 !important; }
        .ajyn-copy { font-size:16px !important; line-height:1.7 !important; }
        .ajyn-status-card { padding:18px !important; border-radius:14px !important; }
        .ajyn-status-cell { display:block !important; width:100% !important; padding:0 0 14px !important; text-align:center !important; }
        .ajyn-status-check { margin:0 auto !important; }
        .ajyn-status-copy { display:block !important; width:100% !important; text-align:center !important; }
        .ajyn-status-title { font-size:24px !important; }
        .ajyn-cta { padding:17px 16px !important; font-size:15px !important; letter-spacing:2px !important; }
        .ajyn-help-title { font-size:28px !important; }
        .ajyn-contact-divider { display:none !important; }
        .ajyn-contact { display:block !important; margin:10px 0 !important; }
        .ajyn-footer { border-radius:14px !important; padding:28px 18px !important; }
        .ajyn-footer-brand { font-size:19px !important; letter-spacing:9px !important; }
      }
`;

export function buildReceiptEmailSubject(receipt: PrintableReceipt) {
  return `Your ${BRAND_NAME} receipt ${receipt.receiptNumber}`;
}

export function buildReceiptEmailText(receipt: PrintableReceipt) {
  return [
    `Receipt: ${receipt.receiptNumber}`,
    `Order: ${receipt.orderNumber}`,
    `Total: GHS ${receipt.totalAmount.toFixed(2)}`,
    `Verification: ${receipt.qrPayload}`,
  ].join('\n');
}

export function buildReceiptEmailHtml(receipt: PrintableReceipt) {
  return buildAjynEmailHtml({
    eyebrow: `Receipt ${receipt.receiptNumber}`,
    reference: receipt.orderNumber,
    icon: '&#9634;',
    title: 'Your Receipt Is Ready',
    greetingName: receipt.customerName,
    intro: `Thank you for shopping with ${BRAND_NAME}.`,
    bodyHtml: `
      <p style="margin:0 0 14px;">We have attached your receipt details for order <strong>${escapeHtml(receipt.orderNumber)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:10px 0;color:#6b625c;font-size:13px;">Subtotal</td>
          <td align="right" style="padding:10px 0;color:#2a1710;font-size:13px;font-weight:700;">${escapeHtml(formatGhs(receipt.subtotal))}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b625c;font-size:13px;">Shipping</td>
          <td align="right" style="padding:10px 0;color:#2a1710;font-size:13px;font-weight:700;">${escapeHtml(formatGhs(receipt.shippingPrice || 0))}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-top:1px solid #ece6e1;color:#2a1710;font-size:15px;font-weight:700;">Total</td>
          <td align="right" style="padding:12px 0;border-top:1px solid #ece6e1;color:#2a1710;font-size:15px;font-weight:700;">${escapeHtml(formatGhs(receipt.totalAmount))}</td>
        </tr>
      </table>
    `,
    statusTitle: 'Receipt Generated',
    statusText: 'Keep this email for your records. You can verify the receipt any time.',
    ctaLabel: 'VERIFY RECEIPT',
    ctaUrl: receipt.qrPayload,
  });
}

export function buildSupportReplyEmailHtml(input: {
  customerName: string;
  subject: string;
  reply: string;
  summary?: string | null;
}) {
  return buildAjynEmailHtml({
    eyebrow: 'Support Update',
    icon: '&#9993;',
    title: 'We Have An Update For You',
    greetingName: input.customerName,
    intro: `We have an update on your support request: ${input.subject}.`,
    bodyHtml: `
      <div style="padding:16px;border:1px solid #ece6e1;border-radius:12px;background:#fbfaf8;margin:16px 0;white-space:pre-wrap;">${escapeHtml(input.reply)}</div>
      ${input.summary ? `<p style="margin:0 0 14px;"><strong>Resolution summary:</strong> ${escapeHtml(input.summary)}</p>` : ''}
    `,
    statusTitle: 'Support Reply Sent',
    statusText: 'If you need anything else, simply reply to this email or contact us through the Help Center.',
  });
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
  const normalizedStatus = input.statusLabel.toLowerCase();
  const isOrderPlaced = normalizedStatus.includes('placed');
  const title = normalizedStatus.includes('placed')
    ? 'Your Order Has Been Placed'
    : `Your Order Is ${titleCase(input.statusLabel)}`;

  return buildAjynEmailHtml({
    eyebrow: 'Order',
    reference: `#${input.orderNumber}`,
    icon: '&#9634;',
    title,
    greetingName: input.customerName,
    intro: isOrderPlaced
      ? `Thank you for shopping with ${BRAND_NAME}.`
      : `Order ${input.orderNumber} has a new status.`,
    bodyHtml: `<p style="margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(input.message)}</p>${input.note ? `<p style="margin:0 0 14px;"><strong>Admin note:</strong> ${escapeHtml(input.note)}</p>` : ''}`,
    statusTitle: input.statusLabel,
    statusText: isOrderPlaced
      ? 'Your order is now in our system and we are preparing the next steps.'
      : 'We will keep you updated every step of the way.',
    ctaLabel: 'TRACK MY ORDER',
    ctaUrl: `${getAppUrl()}/track-order/${encodeURIComponent(input.orderNumber)}`,
  });
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
  return buildAjynEmailHtml({
    eyebrow: `Order ${input.orderNumber}`,
    reference: input.orderNumber,
    icon: '&#9671;',
    title: 'Your Delivery Window Was Updated',
    greetingName: input.customerName,
    intro: `Your order ${input.orderNumber} is currently estimated to arrive between ${input.startDateLabel} and ${input.endDateLabel}.`,
    statusTitle: 'Delivery Estimate',
    statusText: `${input.startDateLabel} to ${input.endDateLabel}`,
    ctaLabel: 'TRACK MY ORDER',
    ctaUrl: `${getAppUrl()}/track-order/${encodeURIComponent(input.orderNumber)}`,
  });
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
  return buildAjynEmailHtml({
    eyebrow: `Order ${input.orderNumber}`,
    reference: input.orderNumber,
    icon: '&#8635;',
    title: `Refund Request ${titleCase(input.statusLabel)}`,
    greetingName: input.customerName,
    intro: `There is an update for your refund request on order ${input.orderNumber}.`,
    bodyHtml: `<p style="margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(input.message)}</p>${input.adminNotes ? `<p style="margin:0 0 14px;"><strong>Admin note:</strong> ${escapeHtml(input.adminNotes)}</p>` : ''}`,
    statusTitle: input.statusLabel,
    statusText: 'If you have further questions, please reply through the Help Center.',
  });
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

export function buildAjynEmailHtml(input: AjynEmailInput) {
  const preview = input.intro || input.statusText || input.title;
  const referenceLine = input.reference
    ? `${input.eyebrow ? escapeHtml(input.eyebrow) : 'Reference'} <span style="color:#B87432;font-weight:600;">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '');
  const closingMessage = input.closing || 'We will keep you updated every step of the way.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.title)}</title>
    <style>
${AJYN_EMAIL_MOBILE_STYLES}
    </style>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ajyn-container" style="max-width:600px;width:100%;padding:30px 20px;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding-bottom:25px;">
                <img src="${escapeHtml(getEmailLogoUrl())}" alt="AJYN" class="ajyn-logo" style="max-width:150px;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td>
                <hr style="border:none;border-top:1px solid #ece7e2;margin:0;">
              </td>
            </tr>
            ${
              referenceLine
                ? `<tr>
              <td align="center" class="ajyn-reference" style="padding:30px 0 25px 0;font-size:18px;text-transform:uppercase;color:#111111;">
                ${referenceLine}
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td align="center" style="padding-bottom:25px;">
                <div class="ajyn-status-orb" style="width:90px;height:90px;border-radius:50%;background:#F5F0EB;display:inline-block;text-align:center;">
                  <span class="ajyn-status-symbol" style="display:block;color:#B87432;font-size:42px;line-height:90px;">${input.icon || '&#10003;'}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:30px;">
                <h1 class="ajyn-title" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:46px;line-height:1.2;color:#111111;font-weight:700;">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr>
              <td class="ajyn-copy" style="font-size:18px;line-height:1.8;padding-bottom:15px;color:#111111;">
                Hello ${escapeHtml(input.greetingName || 'there')},
              </td>
            </tr>
            <tr>
              <td class="ajyn-copy" style="font-size:18px;line-height:1.8;padding-bottom:15px;color:#111111;">
                ${input.intro ? escapeHtml(input.intro) : `Thank you for shopping with ${BRAND_NAME}.`}
              </td>
            </tr>
            ${
              input.bodyHtml
                ? `<tr>
              <td class="ajyn-copy" style="font-size:18px;line-height:1.8;padding-bottom:30px;color:#111111;">
                ${input.bodyHtml || ''}
              </td>
            </tr>`
                : ''
            }
            ${
              input.statusTitle || input.statusText
                ? `<tr>
              <td style="padding-bottom:30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status-card" style="background:#F7F4F2;border-radius:16px;padding:25px;border-collapse:separate;">
                  <tr>
                    <td width="90" valign="top" class="ajyn-status-cell">
                      <div class="ajyn-status-check" style="width:70px;height:70px;border:3px solid #B87432;border-radius:50%;text-align:center;line-height:70px;font-size:30px;color:#B87432;">&#10003;</div>
                    </td>
                    <td valign="middle" class="ajyn-status-copy">
                      ${input.statusTitle ? `<div class="ajyn-status-title" style="font-size:30px;font-weight:700;color:#111111;padding-bottom:8px;">${escapeHtml(input.statusTitle)}</div>` : ''}
                      ${input.statusText ? `<div style="font-size:18px;line-height:1.6;color:#333333;">${escapeHtml(input.statusText)}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td class="ajyn-copy" style="font-size:18px;line-height:1.8;padding-bottom:30px;color:#111111;">
                ${escapeHtml(closingMessage)}
              </td>
            </tr>
            ${
              input.ctaLabel && input.ctaUrl
                ? `<tr>
              <td align="center" style="padding-bottom:40px;">
                <a href="${escapeHtml(input.ctaUrl)}" class="ajyn-cta" style="display:block;background:#000000;color:#C47B43;text-decoration:none;font-weight:700;letter-spacing:3px;padding:20px;border-radius:8px;font-size:18px;text-transform:uppercase;text-align:center;">${escapeHtml(input.ctaLabel)}</a>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td>
                <hr style="border:none;border-top:1px solid #ece7e2;margin:0;">
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-help" style="padding:40px 0 30px 0;">
                <div style="padding-bottom:12px;color:#B87432;font-size:36px;line-height:1;">&#9681;</div>
                <div class="ajyn-help-title" style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;padding-bottom:10px;color:#111111;">Need help?</div>
                <div style="font-size:18px;color:#555555;padding-bottom:25px;">We're here for you.</div>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;">
                  <tr>
                    <td class="ajyn-contact" style="font-size:16px;color:#111111;">&#9993;&nbsp; ${SUPPORT_EMAIL}</td>
                    <td class="ajyn-contact-divider" style="padding:0 18px;color:#cccccc;">|</td>
                    <td class="ajyn-contact" style="font-size:16px;color:#111111;">&#9742;&nbsp; ${SUPPORT_PHONE}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-footer" style="background:#F8F4F1;border-radius:18px;padding:35px 20px;border-collapse:separate;">
                  <tr>
                    <td align="center">
                      <div class="ajyn-footer-brand" style="font-size:22px;letter-spacing:12px;font-weight:600;padding-bottom:4px;color:#111111;">AJYN</div>
                      <div style="color:#B87432;font-size:20px;padding-bottom:18px;">&bull;</div>
                      <div style="font-size:18px;padding-bottom:20px;color:#111111;">Thank you for shopping with ${BRAND_NAME}.</div>
                      <div style="font-size:15px;color:#666666;">&copy; 2026 ${BRAND_NAME}. All rights reserved.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getAppUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'https://www.ajynworld.com';
}

function getEmailLogoUrl() {
  return EMAIL_LOGO_URL;
}

function formatGhs(amount: number) {
  return `GHS ${Number(amount || 0).toFixed(2)}`;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
