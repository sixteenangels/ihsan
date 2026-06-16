import { AJYN_EMAIL_STYLES } from '@/lib/ajyn-email-styles';
import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';
import type { PrintableReceipt } from '@/lib/receipt-utils';
import { sanitizeEmailUrl } from '@/lib/security-url';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  getSupportWhatsAppUrl,
} from '@/lib/support-contact';

const SUPPORT_PHONE = SUPPORT_PHONE_DISPLAY;
const COPYRIGHT_YEAR = '2026';
const AJYN_EMAIL_LOGO_URL = 'https://www.ajynworld.com/ajyn-wordmark.svg';
const AJYN_EMAIL_LOGO_DARK_URL = 'https://www.ajynworld.com/ajyn-wordmark-dark.svg';

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
  preheaderAction?: {
    label: string;
    url: string;
  };
};

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
      <p style="margin:0 0 14px;">We have attached your receipt details for order <strong class="ajyn-text-dark">${escapeHtml(receipt.orderNumber)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;">
        <tr>
          <td class="ajyn-text-muted" style="padding:10px 0;font-size:13px;">Subtotal</td>
          <td align="right" class="ajyn-text-dark" style="padding:10px 0;font-size:13px;font-weight:700;">${escapeHtml(formatGhs(receipt.subtotal))}</td>
        </tr>
        <tr>
          <td class="ajyn-text-muted" style="padding:10px 0;font-size:13px;">Shipping</td>
          <td align="right" class="ajyn-text-dark" style="padding:10px 0;font-size:13px;font-weight:700;">${escapeHtml(formatGhs(receipt.shippingPrice || 0))}</td>
        </tr>
        <tr>
          <td class="ajyn-text-dark" style="padding:12px 0;border-top:1px solid #ece6e1;font-size:15px;font-weight:700;">Total</td>
          <td align="right" class="ajyn-text-dark" style="padding:12px 0;border-top:1px solid #ece6e1;font-size:15px;font-weight:700;">${escapeHtml(formatGhs(receipt.totalAmount))}</td>
        </tr>
      </table>
    `,
    statusTitle: 'Receipt Generated',
    statusText: 'Keep this email for your records. You can verify the receipt any time.',
    ctaLabel: 'VERIFY RECEIPT',
    ctaUrl: receipt.qrPayload,
    preheaderAction: { label: 'Verify receipt', url: receipt.qrPayload },
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
    preheaderAction: { label: 'Open help center', url: `${getAppUrl()}/help` },
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

  const trackUrl = `${getAppUrl()}/track-order/${encodeURIComponent(input.orderNumber)}`;

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
      ? "Your order is now in our system and we're preparing the next steps."
      : 'We will keep you updated every step of the way.',
    ctaLabel: 'TRACK MY ORDER',
    ctaUrl: trackUrl,
    preheaderAction: { label: 'View order', url: trackUrl },
    closing: isOrderPlaced ? undefined : '',
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
  const trackUrl = `${getAppUrl()}/track-order/${encodeURIComponent(input.orderNumber)}`;

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
    ctaUrl: trackUrl,
    preheaderAction: { label: 'View order', url: trackUrl },
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
  const helpUrl = `${getAppUrl()}/help`;

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
    preheaderAction: { label: 'Get help', url: helpUrl },
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
    ? `${input.eyebrow ? escapeHtml(input.eyebrow.toUpperCase()) : 'REFERENCE'} <span class="ajyn-text-brand">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '');
  const closingMessage = input.closing ?? 'We will keep you updated every step of the way.';
  const safeCtaUrl = input.ctaUrl ? sanitizeEmailUrl(input.ctaUrl) : null;
  const safePreheaderUrl = input.preheaderAction?.url ? sanitizeEmailUrl(input.preheaderAction.url) : safeCtaUrl;
  const preheaderActionLabel = input.preheaderAction?.label || 'View order';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(input.title)}</title>
    <style>
${AJYN_EMAIL_STYLES}
    </style>
  </head>
  <body class="body ajyn-body-bg ajyn-font-sans" style="margin:0;padding:0;background:#f5f5f5;color-scheme:light dark;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-body-bg" bgcolor="#f5f5f5" style="background:#f5f5f5;border-collapse:collapse;">
      <tr>
        <td align="center" class="ajyn-shell" bgcolor="#f5f5f5" style="padding:14px 0;background:#f5f5f5;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ajyn-card ajyn-light-bg" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #eeeeee;border-radius:4px;overflow:hidden;">
            ${
              safePreheaderUrl
                ? `<tr class="ajyn-preheader">
              <td class="ajyn-preheader-cell ajyn-light-bg ajyn-font-sans" bgcolor="#ffffff" style="padding:12px 44px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" class="ajyn-preheader-left ajyn-text-muted ajyn-font-sans" style="font-size:11px;line-height:1.4;">Thank you for shopping with ${BRAND_NAME}.</td>
                    <td align="right" class="ajyn-font-sans" style="font-size:11px;line-height:1.4;white-space:nowrap;">
                      <a href="${escapeHtml(safePreheaderUrl)}" class="ajyn-preheader-link">${escapeHtml(preheaderActionLabel)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td class="ajyn-container ajyn-light-bg" bgcolor="#ffffff" style="padding:28px 44px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-header-row">
                  <tr>
                    <td class="ajyn-logo-cell ajyn-light-bg" align="left" valign="middle" bgcolor="#ffffff" style="background:#ffffff;">
                      <div class="ajyn-logo-lockup" style="display:inline-block;text-align:left;">
                        ${getLogoMarkHtml()}
                      </div>
                    </td>
                    <td class="ajyn-ref-cell ajyn-text-dark ajyn-light-bg ajyn-font-sans" align="right" valign="middle" bgcolor="#ffffff" style="background:#ffffff;">
                      ${referenceLine}
                    </td>
                  </tr>
                </table>
                <div class="ajyn-desktop-divider" style="border-top:1px solid #ece7e2;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-hero-wrap ajyn-light-bg" bgcolor="#ffffff" style="padding:20px 44px 10px;background:#ffffff;">
                <div class="ajyn-hero-icon ajyn-hero-bg" style="width:60px;height:60px;border-radius:50%;background:#f2e9e1;display:inline-block;text-align:center;">
                  ${getPackageIconHtml()}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-title ajyn-text-dark ajyn-light-bg ajyn-font-serif" bgcolor="#ffffff" style="padding:0 44px 18px;background:#ffffff;font-size:21px;line-height:1.25;font-weight:700;">
                <span class="ajyn-gmail-text">${escapeHtml(input.title)}</span>
              </td>
            </tr>
            <tr>
              <td class="ajyn-body ajyn-light-bg ajyn-font-sans" bgcolor="#ffffff" style="padding:0 72px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:11px;">
                      <span class="ajyn-gmail-text">Hello ${escapeHtml(input.greetingName || 'there')},</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:11px;">
                      <span class="ajyn-gmail-text">${input.intro ? escapeHtml(input.intro) : `Thank you for shopping with ${BRAND_NAME}.`}</span>
                    </td>
                  </tr>
                  ${
                    input.bodyHtml
                      ? `<tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:19px;">
                      <div class="ajyn-gmail-text">${input.bodyHtml || ''}</div>
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    input.statusTitle || input.statusText
                      ? `<tr>
                    <td class="ajyn-status-row" style="padding-bottom:19px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status-card ajyn-soft-bg" bgcolor="#f7f4f2" style="background:#f7f4f2;border-radius:6px;padding:16px 19px;border-collapse:separate;">
                        <tr>
                          <td width="64" valign="middle" class="ajyn-status-icon-cell">
                            <div class="ajyn-status-check" style="width:48px;height:48px;border:2px solid #c18c5d;border-radius:50%;text-align:center;line-height:46px;font-size:24px;color:#c18c5d;">&#10003;</div>
                          </td>
                          <td valign="middle" class="ajyn-status-copy ajyn-text-dark ajyn-font-sans">
                            ${input.statusTitle ? `<div class="ajyn-status-title ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:14px;line-height:1.25;font-weight:700;padding-bottom:4px;">${escapeHtml(input.statusTitle)}</div>` : ''}
                            ${input.statusText ? `<div class="ajyn-status-text ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:11px;line-height:1.45;">${escapeHtml(input.statusText)}</div>` : ''}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    closingMessage
                      ? `<tr>
                    <td class="ajyn-copy ajyn-closing ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:19px;">
                      <span class="ajyn-gmail-text">${escapeHtml(closingMessage)}</span>
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    input.ctaLabel && safeCtaUrl
                      ? `<tr>
                    <td align="center" class="ajyn-cta-cell" style="padding-bottom:23px;">
                      <a href="${escapeHtml(safeCtaUrl)}" class="ajyn-cta ajyn-black-bg ajyn-text-orange ajyn-font-sans" style="display:block;width:225px;max-width:100%;box-sizing:border-box;background:#000000;color:#c18c5d;font-weight:700;letter-spacing:1.9px;padding:14px 18px;border-radius:5px;font-size:12px;line-height:1;text-transform:uppercase;text-align:center;">${escapeHtml(input.ctaLabel)}</a>
                    </td>
                  </tr>`
                      : ''
                  }
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-divider-cell ajyn-light-bg" bgcolor="#ffffff" style="padding:0 44px;background:#ffffff;">
                <hr style="border:none;border-top:1px solid #ece7e2;margin:0;">
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-help ajyn-light-bg" bgcolor="#ffffff" style="padding:17px 42px 15px;background:#ffffff;">
                <div class="ajyn-help-icon" style="padding-bottom:4px;color:#c18c5d;font-size:22px;line-height:1;">${getSupportIconHtml()}</div>
                <div class="ajyn-help-title ajyn-text-dark ajyn-gmail-text ajyn-font-serif" style="font-size:14px;line-height:1.25;font-weight:700;">Need help?</div>
                <div class="ajyn-help-subtitle ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:11px;line-height:1.35;padding-bottom:11px;">We're here for you.</div>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;">
                  <tr>
                    <td class="ajyn-contact ajyn-text-dark ajyn-font-sans" style="font-size:11px;line-height:1.3;">${getEmailIconHtml()}&nbsp; <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" class="ajyn-gmail-text">${SUPPORT_EMAIL}</a></td>
                    <td class="ajyn-contact-divider" width="28" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td class="ajyn-contact ajyn-text-dark ajyn-font-sans" style="font-size:11px;line-height:1.3;">${getWhatsAppIconHtml()}&nbsp; <a href="${escapeHtml(getSupportWhatsAppUrl())}" class="ajyn-gmail-text">${SUPPORT_PHONE}</a></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-footer ajyn-footer-bg" bgcolor="#ffffff" style="padding:18px 44px 20px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding-bottom:14px;">
                      ${getFooterBrandMarkHtml()}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-footer-copy ajyn-text-muted ajyn-font-sans" style="font-size:11px;line-height:1.5;padding-bottom:8px;">Thank you for shopping with ${BRAND_NAME}.</td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-footer-legal ajyn-text-muted ajyn-font-sans" style="font-size:10px;line-height:1.5;">&copy; ${COPYRIGHT_YEAR} ${BRAND_NAME}. All rights reserved.</td>
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

function getLogoMarkHtml() {
  return `
    <img class="ajyn-logo-mark ajyn-wordmark-light" src="${AJYN_EMAIL_LOGO_URL}" width="110" height="48" alt="AJYN" style="display:block;width:110px;height:48px;border:0;outline:none;text-decoration:none;object-fit:contain;">
    <img class="ajyn-logo-mark ajyn-wordmark-dark" src="${AJYN_EMAIL_LOGO_DARK_URL}" width="110" height="48" alt="AJYN" style="display:none;width:110px;height:48px;border:0;outline:none;text-decoration:none;object-fit:contain;">
  `;
}

function getFooterBrandMarkHtml() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-footer-mark-wrap ajyn-footer-mark-bg ajyn-soft-bg" bgcolor="#f7f4f2" style="width:100%;max-width:100%;margin:0 auto;border-collapse:separate;border-radius:8px;background:#f7f4f2;background-color:#f7f4f2;">
      <tr>
        <td align="center" style="padding:18px 24px;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-light" src="${AJYN_EMAIL_LOGO_URL}" width="110" height="48" alt="AJYN" style="display:block;width:110px;height:48px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-dark" src="${AJYN_EMAIL_LOGO_DARK_URL}" width="110" height="48" alt="AJYN" style="display:none;width:110px;height:48px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
        </td>
      </tr>
    </table>
  `;
}

function getPackageIconHtml() {
  return `
    <span class="ajyn-package-icon-text" aria-hidden="true" style="display:block;margin:13px auto 0;color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:32px;">&#9633;</span>
  `;
}

function getSupportIconHtml() {
  return `
    <span class="ajyn-support-icon-text" aria-hidden="true" style="display:block;margin:0 auto;color:#c18c5d;-webkit-text-fill-color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:22px;">?</span>
  `;
}

function getEmailIconHtml() {
  return `
    <span class="ajyn-contact-icon-text" aria-hidden="true" style="display:inline-block;vertical-align:0;color:#c18c5d;-webkit-text-fill-color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;line-height:1;">@</span>
  `;
}

function getWhatsAppIconHtml() {
  return `
    <span class="ajyn-contact-icon-text" aria-hidden="true" style="display:inline-block;vertical-align:0;color:#c18c5d;-webkit-text-fill-color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;line-height:1;">WA</span>
  `;
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
