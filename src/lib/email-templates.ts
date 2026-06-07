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
        .ajyn-shell { padding:0 !important; background:#ffffff !important; }
        .ajyn-card { width:100% !important; max-width:100% !important; border-left:0 !important; border-right:0 !important; border-radius:0 !important; box-shadow:none !important; }
        .ajyn-header { padding:18px 28px 8px !important; text-align:center !important; }
        .ajyn-reference { font-size:9px !important; line-height:1.35 !important; word-break:break-word !important; }
        .ajyn-brand-cell { text-align:center !important; }
        .ajyn-header .ajyn-logo-lockup { display:table !important; width:auto !important; margin:0 auto !important; }
        .ajyn-header .ajyn-logo-lockup tr { display:table-row !important; width:auto !important; }
        .ajyn-header .ajyn-logo-lockup td { display:table-cell !important; width:auto !important; }
        .ajyn-logo-img { width:58px !important; height:58px !important; margin:0 auto !important; }
        .ajyn-logo-word { font-size:10px !important; letter-spacing:0.34em !important; padding-left:0.34em !important; margin-top:2px !important; }
        .ajyn-hero { border-top:0 !important; padding:13px 24px 17px !important; }
        .ajyn-icon { width:52px !important; height:52px !important; margin-bottom:13px !important; font-size:26px !important; line-height:52px !important; }
        .ajyn-title { font-size:20px !important; line-height:1.25 !important; }
        .ajyn-content { padding:0 48px 20px !important; font-size:11px !important; line-height:1.55 !important; }
        .ajyn-status { margin:16px 0 !important; border-radius:6px !important; }
        .ajyn-status-icon-cell { width:50px !important; padding:14px 0 14px 14px !important; }
        .ajyn-status-icon { width:38px !important; height:38px !important; font-size:20px !important; line-height:35px !important; }
        .ajyn-status-copy { padding:13px 14px 13px 8px !important; }
        .ajyn-status-title { font-size:14px !important; }
        .ajyn-cta-wrap { margin:18px 0 0 !important; }
        .ajyn-cta { display:block !important; width:100% !important; box-sizing:border-box !important; padding:14px 16px !important; text-align:center !important; border-radius:6px !important; }
        .ajyn-help { padding:18px 48px !important; }
        .ajyn-contact { display:block !important; margin:8px 0 !important; }
        .ajyn-footer { padding:20px 24px !important; border-radius:6px !important; }
        .ajyn-footer-brand { margin-bottom:10px !important; }
        .ajyn-footer-brand-word { font-size:12px !important; letter-spacing:0.56em !important; padding-left:0.56em !important; }
        .ajyn-footer-brand-dot { width:4px !important; height:4px !important; }
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

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.title)}</title>
    <style>
${AJYN_EMAIL_MOBILE_STYLES}
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f2ef;color:#2a1710;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ef;border-collapse:collapse;">
      <tr>
        <td align="center" class="ajyn-shell" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-card" style="width:100%;max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #ece6e1;border-radius:10px;overflow:hidden;box-shadow:0 18px 42px rgba(42,23,16,0.08);">
            <tr>
              <td class="ajyn-header" style="padding:30px 38px 16px;text-align:center;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" class="ajyn-brand-cell" style="text-align:center;padding:0 0 12px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" align="center" class="ajyn-logo-lockup" style="margin:0 auto;border-collapse:collapse;">
                        <tr>
                          <td align="center" style="padding:0;">
                            <img class="ajyn-logo-img" src="${escapeHtml(getEmailLogoUrl())}" width="64" height="64" alt="AJYN" style="display:block;width:64px;height:64px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
                          </td>
                        </tr>
                        <tr>
                          <td align="center" class="ajyn-logo-word" style="padding:2px 0 0 0;padding-left:0.4em;font-size:11px;line-height:1;letter-spacing:0.4em;font-weight:700;color:#2a1710;">AJYN</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-reference" style="border-top:1px solid #ece6e1;padding:10px 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#2a1710;text-align:center;">
                      ${input.eyebrow ? escapeHtml(input.eyebrow) : ''}${input.reference ? ` <span style="color:#c46f35;">${escapeHtml(input.reference)}</span>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-hero" style="border-top:1px solid #ece6e1;padding:34px 38px 26px;text-align:center;">
                <div class="ajyn-icon" style="width:72px;height:72px;border-radius:50%;background:#eee4dc;margin:0 auto 18px;color:#b96a35;font-size:34px;line-height:72px;text-align:center;">${input.icon || '&#10003;'}</div>
                <h1 class="ajyn-title" style="margin:0;color:#2a1710;font-size:27px;line-height:1.25;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr>
              <td class="ajyn-content" style="padding:0 68px 28px;color:#2a1710;font-size:14px;line-height:1.7;">
                <p style="margin:0 0 14px;">Hello ${escapeHtml(input.greetingName || 'there')},</p>
                ${input.intro ? `<p style="margin:0 0 14px;">${escapeHtml(input.intro)}</p>` : ''}
                ${input.bodyHtml || ''}
                ${
                  input.statusTitle || input.statusText
                    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status" style="margin:22px 0;border-collapse:collapse;background:#f7f4f1;border-radius:9px;">
                        <tr>
                          <td width="58" valign="top" class="ajyn-status-icon-cell" style="padding:18px 0 18px 20px;">
                            <div class="ajyn-status-icon" style="width:42px;height:42px;border:2px solid #c46f35;border-radius:50%;color:#c46f35;line-height:39px;text-align:center;font-size:24px;">&#10003;</div>
                          </td>
                          <td class="ajyn-status-copy" style="padding:17px 20px 17px 10px;">
                            ${input.statusTitle ? `<div class="ajyn-status-title" style="font-weight:700;font-size:16px;color:#2a1710;margin-bottom:3px;">${escapeHtml(input.statusTitle)}</div>` : ''}
                            ${input.statusText ? `<div style="font-size:12px;line-height:1.5;color:#3f332d;">${escapeHtml(input.statusText)}</div>` : ''}
                          </td>
                        </tr>
                      </table>`
                    : ''
                }
                ${input.closing ? `<p style="margin:0 0 18px;">${escapeHtml(input.closing)}</p>` : '<p style="margin:0 0 18px;">We will keep you updated every step of the way.</p>'}
                ${
                  input.ctaLabel && input.ctaUrl
                    ? `<div class="ajyn-cta-wrap" style="text-align:center;margin:24px 0 4px;">
                        <a href="${escapeHtml(input.ctaUrl)}" class="ajyn-cta" style="display:inline-block;background:#111111;color:#c46f35;text-decoration:none;border-radius:5px;padding:14px 42px;font-size:12px;letter-spacing:0.14em;font-weight:700;">${escapeHtml(input.ctaLabel)}</a>
                      </div>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td class="ajyn-help" style="padding:22px 38px;border-top:1px solid #ece6e1;text-align:center;color:#2a1710;">
                <div style="font-size:22px;color:#c46f35;line-height:1;">&#9681;</div>
                <div style="font-size:15px;font-weight:700;margin-top:2px;">Need help?</div>
                <div style="font-size:12px;color:#6b625c;margin:4px 0 14px;">We are here for you.</div>
                <span class="ajyn-contact" style="display:inline-block;margin:0 12px;font-size:12px;color:#2a1710;">&#9993; ${SUPPORT_EMAIL}</span>
                <span class="ajyn-contact" style="display:inline-block;margin:0 12px;font-size:12px;color:#2a1710;">&#9742; ${SUPPORT_PHONE}</span>
              </td>
            </tr>
            <tr>
              <td class="ajyn-footer" style="background:#f5f2ef;padding:22px 38px;text-align:center;color:#6b625c;font-size:11px;line-height:1.7;">
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" class="ajyn-footer-brand" style="margin:0 auto 12px;border-collapse:collapse;">
                  <tr>
                    <td align="center" class="ajyn-footer-brand-word" style="padding:0 0 2px;padding-left:0.56em;color:#2a1710;font-size:12px;line-height:1;letter-spacing:0.56em;font-weight:700;">AJYN</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0;">
                      <span class="ajyn-footer-brand-dot" style="display:inline-block;width:4px;height:4px;border-radius:999px;background:#b85b0e;line-height:4px;font-size:0;">&nbsp;</span>
                    </td>
                  </tr>
                </table>
                <div>Thank you for shopping with ${BRAND_NAME}.</div>
                <div>&copy; 2026 ${BRAND_NAME}. All rights reserved.</div>
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
