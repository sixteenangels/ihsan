import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';
import type { PrintableReceipt } from '@/lib/receipt-utils';
import { sanitizeEmailUrl } from '@/lib/security-url';

const SUPPORT_EMAIL = 'support@ajynworld.com';
const SUPPORT_PHONE = '+233 20 123 4567';
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
};

const AJYN_EMAIL_MOBILE_STYLES = `
      :root { color-scheme:light dark;supported-color-schemes:light dark; }
      table { border-spacing:0;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0; }
      img { border:0;outline:none;text-decoration:none; }
      a { color:inherit;text-decoration:none; }
      .ajyn-body-bg { color-scheme:light dark; }
      .ajyn-light-bg { background:#ffffff !important;background-color:#ffffff !important; }
      .ajyn-soft-bg { background:#f7f4f2 !important;background-color:#f7f4f2 !important; }
      .ajyn-footer-mark-bg { background:#f9f6f2 !important;background-color:#f9f6f2 !important;border-radius:10px !important; }
      .ajyn-footer-bg { background:#ffffff !important;background-color:#ffffff !important; }
      .ajyn-hero-bg { background:#f2e9e1 !important;background-color:#f2e9e1 !important; }
      .ajyn-black-bg, .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important; }
      .ajyn-text-dark { color:#111111 !important;-webkit-text-fill-color:#111111 !important; }
      .ajyn-text-muted { color:#6b625c !important;-webkit-text-fill-color:#6b625c !important; }
      .ajyn-text-orange, .ajyn-cta { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
      .ajyn-text-brand { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
      .ajyn-logo-mark, .ajyn-footer-mark-img { width:96px !important;height:42px !important;margin:0 auto !important; }
      .ajyn-wordmark-light { display:block !important;max-height:none !important;overflow:visible !important; }
      .ajyn-wordmark-dark { display:none !important;max-height:0 !important;overflow:hidden !important; }
      @media (prefers-color-scheme: dark) {
        body, .ajyn-body-bg, .ajyn-shell { background:#09070d !important;background-color:#09070d !important;background-image:linear-gradient(#09070d,#09070d) !important; }
        .ajyn-card, .ajyn-container, .ajyn-header-row, .ajyn-logo-cell, .ajyn-ref-cell, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help, .ajyn-footer, .ajyn-footer-bg { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-soft-bg, .ajyn-status-card { background:#24201d !important;background-color:#24201d !important;background-image:linear-gradient(#24201d,#24201d) !important; }
        .ajyn-footer-mark-bg { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-hero-bg, .ajyn-hero-icon { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-text-dark, .ajyn-gmail-text, .ajyn-gmail-text p, .ajyn-gmail-text strong, .ajyn-gmail-text span, .ajyn-copy, .ajyn-title, .ajyn-status-title, .ajyn-status-text, .ajyn-help-title, .ajyn-help-subtitle, .ajyn-contact, .ajyn-ref-cell { color:#f8f4ef !important;-webkit-text-fill-color:#f8f4ef !important; }
        .ajyn-text-muted, .ajyn-footer-copy, .ajyn-footer-legal { color:#a89a90 !important;-webkit-text-fill-color:#a89a90 !important; }
        .ajyn-text-brand { color:#ff9d4d !important;-webkit-text-fill-color:#ff9d4d !important; }
        .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-wordmark-light { display:none !important;max-height:0 !important;overflow:hidden !important; }
        .ajyn-wordmark-dark { display:block !important;max-height:none !important;overflow:visible !important; }
      }
      @media only screen and (max-width: 600px) {
        body { background:#ffffff !important;background-color:#ffffff !important; }
        .ajyn-shell { padding:0 !important;background:#ffffff !important;background-color:#ffffff !important; }
        .ajyn-card { width:100% !important;max-width:100% !important;border-radius:6px !important;border:none !important; }
        .ajyn-container { padding:18px 28px 0 !important; }
        .ajyn-header-row, .ajyn-header-row tbody, .ajyn-header-row tr, .ajyn-logo-cell, .ajyn-ref-cell { display:block !important;width:100% !important;box-sizing:border-box !important; }
        .ajyn-logo-cell { text-align:center !important;padding:0 !important; }
        .ajyn-logo-lockup { margin:0 auto !important; }
        .ajyn-logo-mark { width:96px !important;height:42px !important;margin:0 auto !important; }
        .ajyn-desktop-divider { margin-top:13px !important; }
        .ajyn-ref-cell { border-top:1px solid #ece7e2 !important;text-align:center !important;padding:9px 0 7px !important;font-size:8px !important;line-height:1.25 !important;letter-spacing:0.03em !important; }
        .ajyn-hero-wrap { padding:9px 28px 6px !important; }
        .ajyn-hero-icon { width:52px !important;height:52px !important; }
        .ajyn-package-icon-text { font-size:25px !important;line-height:28px !important;margin:11px auto 0 !important; }
        .ajyn-title { font-size:16px !important;line-height:1.2 !important;padding:0 22px 10px !important;white-space:normal !important;overflow-wrap:break-word !important; }
        .ajyn-copy { font-size:10px !important;line-height:1.45 !important;padding-bottom:7px !important; }
        .ajyn-copy p { margin:0 0 5px !important; }
        .ajyn-body { padding:0 29px 4px !important; }
        .ajyn-status-row { padding-bottom:9px !important; }
        .ajyn-status-card { padding:10px 14px !important;border-radius:6px !important; }
        .ajyn-status-icon-cell { width:50px !important; }
        .ajyn-status-check { width:38px !important;height:38px !important;line-height:36px !important;font-size:20px !important; }
        .ajyn-status-title { font-size:14px !important;padding-bottom:3px !important; }
        .ajyn-status-text { font-size:8px !important;line-height:1.35 !important; }
        .ajyn-closing { padding-bottom:9px !important; }
        .ajyn-cta-cell { padding-bottom:13px !important; }
        .ajyn-cta { width:100% !important;box-sizing:border-box !important;padding:11px 14px !important;border-radius:5px !important;font-size:11px !important;letter-spacing:1.8px !important; }
        .ajyn-divider-cell { padding:0 43px !important; }
        .ajyn-help { padding:12px 0 12px !important; }
        .ajyn-help-icon { padding-bottom:3px !important; }
        .ajyn-support-icon-text { font-size:20px !important;line-height:20px !important; }
        .ajyn-help-title { font-size:12px !important; }
        .ajyn-help-subtitle { font-size:10px !important;padding-bottom:10px !important; }
        .ajyn-contact { font-size:8px !important;white-space:nowrap !important; }
        .ajyn-contact-divider { width:16px !important; }
        .ajyn-footer { padding:16px 24px 18px !important; }
        .ajyn-footer-mark-wrap { width:100% !important;max-width:100% !important; }
        .ajyn-footer-mark-bg td { padding:14px 24px !important; }
        .ajyn-footer-mark-img, .ajyn-logo-mark { width:88px !important;height:38px !important; }
        .ajyn-footer-copy { font-size:10px !important;padding-top:12px !important;padding-bottom:8px !important; }
        .ajyn-footer-legal { font-size:9px !important; }
      }
      @media only screen and (max-width: 600px) and (prefers-color-scheme: dark) {
        body, .ajyn-body-bg, .ajyn-shell { background:#09070d !important;background-color:#09070d !important;background-image:linear-gradient(#09070d,#09070d) !important; }
        .ajyn-card, .ajyn-container, .ajyn-header-row, .ajyn-logo-cell, .ajyn-ref-cell, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-soft-bg, .ajyn-status-card { background:#24201d !important;background-color:#24201d !important;background-image:linear-gradient(#24201d,#24201d) !important; }
        .ajyn-footer, .ajyn-footer-bg { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-footer-mark-bg { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-hero-bg, .ajyn-hero-icon { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-ref-cell { border-top-color:#3b332e !important; }
        .ajyn-wordmark-light { display:none !important;max-height:0 !important;overflow:hidden !important; }
        .ajyn-wordmark-dark { display:block !important;max-height:none !important;overflow:visible !important; }
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
      ? "Your order is now in our system and we're preparing the next steps."
      : 'We will keep you updated every step of the way.',
    ctaLabel: 'TRACK MY ORDER',
    ctaUrl: `${getAppUrl()}/track-order/${encodeURIComponent(input.orderNumber)}`,
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
    ? `${input.eyebrow ? escapeHtml(input.eyebrow.toUpperCase()) : 'REFERENCE'} <span class="ajyn-text-brand" style="color:#c18c5d;-webkit-text-fill-color:#c18c5d;">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '');
  const closingMessage = input.closing ?? 'We will keep you updated every step of the way.';

  const safeCtaUrl = input.ctaUrl ? sanitizeEmailUrl(input.ctaUrl) : null;

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
${AJYN_EMAIL_MOBILE_STYLES}
    </style>
  </head>
  <body class="body ajyn-body-bg" style="margin:0;padding:0;background:#f5f5f5;background-color:#f5f5f5;color:#111111;font-family:Arial,Helvetica,sans-serif;color-scheme:light dark;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-body-bg" bgcolor="#f5f5f5" style="background:#f5f5f5;background-color:#f5f5f5;border-collapse:collapse;">
      <tr>
        <td align="center" class="ajyn-shell" bgcolor="#f5f5f5" style="padding:14px 0;background:#f5f5f5;background-color:#f5f5f5;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ajyn-card ajyn-light-bg" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;background-color:#ffffff;border:1px solid #eeeeee;border-radius:4px;overflow:hidden;">
            <tr>
              <td class="ajyn-container ajyn-light-bg" bgcolor="#ffffff" style="padding:28px 44px 0;background:#ffffff;background-color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-header-row">
                  <tr>
                    <td class="ajyn-logo-cell ajyn-light-bg" align="center" valign="middle" bgcolor="#ffffff" style="padding:0 0 13px;background:#ffffff;background-color:#ffffff;">
                      <div class="ajyn-logo-lockup" style="display:inline-block;text-align:center;">
                        ${getLogoMarkHtml()}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="ajyn-ref-cell ajyn-text-dark ajyn-light-bg" align="center" valign="middle" bgcolor="#ffffff" style="border-top:1px solid #ece7e2;padding:10px 0 11px;background:#ffffff;background-color:#ffffff;color:#111111;-webkit-text-fill-color:#111111;font-size:11px;line-height:1.4;text-transform:uppercase;">
                      ${referenceLine}
                    </td>
                  </tr>
                </table>
                <div class="ajyn-desktop-divider" style="border-top:1px solid #ece7e2;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-hero-wrap ajyn-light-bg" bgcolor="#ffffff" style="padding:20px 44px 10px;background:#ffffff;background-color:#ffffff;">
                <div class="ajyn-hero-icon ajyn-hero-bg" style="width:60px;height:60px;border-radius:50%;background:#f2e9e1;background-color:#f2e9e1;display:inline-block;text-align:center;">
                  ${getPackageIconHtml()}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-title ajyn-text-dark ajyn-light-bg" bgcolor="#ffffff" style="padding:0 44px 18px;background:#ffffff;background-color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.25;color:#111111;-webkit-text-fill-color:#111111;font-weight:700;">
                <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${escapeHtml(input.title)}</span>
              </td>
            </tr>
            <tr>
              <td class="ajyn-body ajyn-light-bg" bgcolor="#ffffff" style="padding:0 104px 0;background:#ffffff;background-color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:11px;color:#111111;-webkit-text-fill-color:#111111;">
                <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">Hello ${escapeHtml(input.greetingName || 'there')},</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:11px;color:#111111;-webkit-text-fill-color:#111111;">
                <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${input.intro ? escapeHtml(input.intro) : `Thank you for shopping with ${BRAND_NAME}.`}</span>
                    </td>
                  </tr>
                  ${
                    input.bodyHtml
                      ? `<tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:19px;color:#111111;-webkit-text-fill-color:#111111;">
                <div class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${input.bodyHtml || ''}</div>
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    input.statusTitle || input.statusText
                      ? `<tr>
                    <td class="ajyn-status-row" style="padding-bottom:19px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status-card ajyn-soft-bg" bgcolor="#f7f4f2" style="background:#f7f4f2;background-color:#f7f4f2;border-radius:6px;padding:16px 19px;border-collapse:separate;">
                  <tr>
                    <td width="64" valign="middle" class="ajyn-status-icon-cell">
                      <div class="ajyn-status-check" style="width:48px;height:48px;border:2px solid #c18c5d;border-radius:50%;text-align:center;line-height:46px;font-size:24px;color:#c18c5d;">&#10003;</div>
                    </td>
                    <td valign="middle" class="ajyn-status-copy ajyn-text-dark" style="color:#111111;-webkit-text-fill-color:#111111;">
                      ${input.statusTitle ? `<div class="ajyn-status-title ajyn-text-dark ajyn-gmail-text" style="font-size:14px;line-height:1.25;font-weight:700;color:#111111;-webkit-text-fill-color:#111111;padding-bottom:4px;">${escapeHtml(input.statusTitle)}</div>` : ''}
                      ${input.statusText ? `<div class="ajyn-status-text ajyn-text-dark ajyn-gmail-text" style="font-size:10px;line-height:1.45;color:#111111;-webkit-text-fill-color:#111111;">${escapeHtml(input.statusText)}</div>` : ''}
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
                    <td class="ajyn-copy ajyn-closing ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:19px;color:#111111;-webkit-text-fill-color:#111111;">
                <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${escapeHtml(closingMessage)}</span>
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    input.ctaLabel && safeCtaUrl
                      ? `<tr>
                    <td align="center" class="ajyn-cta-cell" style="padding-bottom:23px;">
                <a href="${escapeHtml(safeCtaUrl)}" class="ajyn-cta ajyn-black-bg ajyn-text-orange" style="display:block;width:225px;max-width:100%;box-sizing:border-box;background:#000000;background-color:#000000;background-image:linear-gradient(#000000,#000000);color:#c18c5d;-webkit-text-fill-color:#c18c5d;font-weight:700;letter-spacing:1.9px;padding:14px 18px;border-radius:5px;font-size:12px;line-height:1;text-transform:uppercase;text-align:center;">${escapeHtml(input.ctaLabel)}</a>
                    </td>
                  </tr>`
                      : ''
                  }
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-divider-cell ajyn-light-bg" bgcolor="#ffffff" style="padding:0 44px;background:#ffffff;background-color:#ffffff;">
                <hr style="border:none;border-top:1px solid #ece7e2;margin:0;">
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-help ajyn-light-bg" bgcolor="#ffffff" style="padding:17px 42px 15px;background:#ffffff;background-color:#ffffff;">
                <div class="ajyn-help-icon" style="padding-bottom:4px;color:#c18c5d;font-size:22px;line-height:1;">${getSupportIconHtml()}</div>
                <div class="ajyn-help-title ajyn-text-dark ajyn-gmail-text" style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.25;font-weight:700;color:#111111;-webkit-text-fill-color:#111111;">Need help?</div>
                <div class="ajyn-help-subtitle ajyn-text-dark ajyn-gmail-text" style="font-size:11px;line-height:1.35;color:#111111;-webkit-text-fill-color:#111111;padding-bottom:11px;">We're here for you.</div>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;">
                  <tr>
                    <td class="ajyn-contact ajyn-text-dark" style="font-size:11px;line-height:1.3;color:#111111;-webkit-text-fill-color:#111111;">${getEmailIconHtml()}&nbsp; <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${SUPPORT_EMAIL}</span></td>
                    <td class="ajyn-contact-divider" width="28" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td class="ajyn-contact ajyn-text-dark" style="font-size:11px;line-height:1.3;color:#111111;-webkit-text-fill-color:#111111;">${getWhatsAppIconHtml()}&nbsp; <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${SUPPORT_PHONE}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-footer ajyn-footer-bg" bgcolor="#ffffff" style="padding:18px 44px 20px;background:#ffffff;background-color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding-bottom:14px;">
                      ${getFooterBrandMarkHtml()}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-footer-copy ajyn-text-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;padding-bottom:8px;color:#6b625c;-webkit-text-fill-color:#6b625c;">Thank you for shopping with ${BRAND_NAME}.</td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-footer-legal ajyn-text-muted" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.5;color:#6b625c;-webkit-text-fill-color:#6b625c;">&copy; ${COPYRIGHT_YEAR} ${BRAND_NAME}. All rights reserved.</td>
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
    <img class="ajyn-logo-mark ajyn-wordmark-light" src="${AJYN_EMAIL_LOGO_URL}" width="96" height="42" alt="AJYN" style="display:block;width:96px;height:42px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
    <img class="ajyn-logo-mark ajyn-wordmark-dark" src="${AJYN_EMAIL_LOGO_DARK_URL}" width="96" height="42" alt="AJYN" style="display:none;width:96px;height:42px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
  `;
}

function getFooterBrandMarkHtml() {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" align="center" class="ajyn-footer-mark-wrap ajyn-footer-mark-bg" bgcolor="#f9f6f2" style="margin:0 auto;border-collapse:separate;border-radius:10px;background:#f9f6f2;background-color:#f9f6f2;">
      <tr>
        <td align="center" style="padding:16px 40px;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-light" src="${AJYN_EMAIL_LOGO_URL}" width="96" height="42" alt="AJYN" style="display:block;width:96px;height:42px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-dark" src="${AJYN_EMAIL_LOGO_DARK_URL}" width="96" height="42" alt="AJYN" style="display:none;width:96px;height:42px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
        </td>
      </tr>
    </table>
  `;
}

function getPackageIconHtml() {
  return `
    <span class="ajyn-package-icon-text" aria-hidden="true" style="display:block;margin:13px auto 0;color:#c18c5d;-webkit-text-fill-color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:32px;">&#9633;</span>
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
