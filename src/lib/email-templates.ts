import { BRAND_NAME, BRAND_SUPPORT_NAME } from '@/lib/brand';
import type { PrintableReceipt } from '@/lib/receipt-utils';

const SUPPORT_EMAIL = 'support@ajyn.com';
const SUPPORT_PHONE = '+233 20 123 4567';

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
      .ajyn-footer-bg { background:#f8f4f1 !important;background-color:#f8f4f1 !important; }
      .ajyn-hero-bg { background:#f2e9e1 !important;background-color:#f2e9e1 !important; }
      .ajyn-black-bg, .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important; }
      .ajyn-text-dark { color:#111111 !important;-webkit-text-fill-color:#111111 !important; }
      .ajyn-text-orange, .ajyn-cta { color:#c47b43 !important;-webkit-text-fill-color:#c47b43 !important; }
      .ajyn-text-brand { color:#B87432 !important;-webkit-text-fill-color:#B87432 !important; }
      .ajyn-logo-frame { width:78px !important;height:78px !important;border-radius:999px !important;overflow:hidden !important;background:#ffffff !important;background-color:#ffffff !important;border:1px solid #f1ebe6 !important;box-sizing:border-box !important;display:inline-flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;text-align:center !important;line-height:1 !important; }
      .ajyn-logo-ink { fill:#202124 !important; }
      .ajyn-logo-cutout { fill:#ffffff !important; }
      .ajyn-logo-stroke { stroke:#202124 !important; }
      .ajyn-logo-dot { fill:#b85b0e !important; }
      u + .body .ajyn-gmail-text {
        color:#ffffff !important;
        -webkit-text-fill-color:#ffffff !important;
        mix-blend-mode:difference !important;
      }
      u + .body .ajyn-gmail-text p,
      u + .body .ajyn-gmail-text strong,
      u + .body .ajyn-gmail-text span {
        color:#ffffff !important;
        -webkit-text-fill-color:#ffffff !important;
        mix-blend-mode:difference !important;
      }
      @media (prefers-color-scheme: dark) {
        body, .ajyn-body-bg, .ajyn-shell { background:#09070d !important;background-color:#09070d !important;background-image:linear-gradient(#09070d,#09070d) !important; }
        .ajyn-card, .ajyn-container, .ajyn-header-row, .ajyn-logo-cell, .ajyn-ref-cell, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-soft-bg, .ajyn-status-card { background:#24201d !important;background-color:#24201d !important;background-image:linear-gradient(#24201d,#24201d) !important; }
        .ajyn-footer-bg, .ajyn-footer { background:#211d1a !important;background-color:#211d1a !important;background-image:linear-gradient(#211d1a,#211d1a) !important; }
        .ajyn-hero-bg, .ajyn-hero-icon { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-logo-frame { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important;border-color:#171514 !important; }
        .ajyn-logo-ink { fill:#f8f4ef !important; }
        .ajyn-logo-cutout { fill:#171514 !important; }
        .ajyn-logo-stroke { stroke:#f8f4ef !important; }
        .ajyn-text-dark, .ajyn-gmail-text, .ajyn-gmail-text p, .ajyn-gmail-text strong, .ajyn-gmail-text span, .ajyn-copy, .ajyn-title, .ajyn-status-title, .ajyn-status-text, .ajyn-help-title, .ajyn-help-subtitle, .ajyn-contact, .ajyn-footer-brand, .ajyn-footer-copy, .ajyn-footer-legal, .ajyn-logo-word, .ajyn-ref-cell { color:#f8f4ef !important;-webkit-text-fill-color:#f8f4ef !important; }
        .ajyn-text-brand { color:#ff9d4d !important;-webkit-text-fill-color:#ff9d4d !important; }
        .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;color:#c47b43 !important;-webkit-text-fill-color:#c47b43 !important; }
      }
      @media only screen and (max-width: 600px) {
        body { background:#09070d !important; }
        .ajyn-shell { padding:10px 0 !important;background:#09070d !important; }
        .ajyn-card { width:100% !important;max-width:100% !important;border-radius:6px !important;border:none !important; }
        .ajyn-container { padding:18px 28px 0 !important; }
        .ajyn-header-row, .ajyn-header-row tbody, .ajyn-header-row tr, .ajyn-logo-cell, .ajyn-ref-cell { display:block !important;width:100% !important;box-sizing:border-box !important; }
        .ajyn-logo-cell { text-align:center !important;padding:0 !important; }
        .ajyn-logo-lockup { margin:0 auto !important; }
        .ajyn-logo-frame { display:flex !important;margin:0 auto 2px !important; }
        .ajyn-logo-mark { width:58px !important;height:34px !important; }
        .ajyn-logo-word { font-size:8px !important;letter-spacing:0.38em !important;padding-left:0.38em !important; }
        .ajyn-desktop-divider { display:none !important; }
        .ajyn-ref-cell { border-top:1px solid #ece7e2 !important;text-align:center !important;padding:9px 0 7px !important;font-size:8px !important;line-height:1.25 !important;letter-spacing:0.03em !important; }
        .ajyn-hero-wrap { padding:9px 28px 6px !important; }
        .ajyn-hero-icon { width:52px !important;height:52px !important; }
        .ajyn-package-icon { width:28px !important;height:28px !important;margin:11px auto 0 !important; }
        .ajyn-title { font-size:16px !important;line-height:1.2 !important;padding:0 22px 10px !important;white-space:nowrap !important; }
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
        .ajyn-support-icon-img { width:20px !important;height:20px !important; }
        .ajyn-help-title { font-size:12px !important; }
        .ajyn-help-subtitle { font-size:10px !important;padding-bottom:10px !important; }
        .ajyn-contact { font-size:8px !important;white-space:nowrap !important; }
        .ajyn-contact-divider { width:16px !important; }
        .ajyn-footer { border-radius:6px !important;padding:12px 20px 14px !important; }
        .ajyn-footer-brand { font-size:12px !important;letter-spacing:8px !important;padding-left:8px !important;padding-bottom:2px !important; }
        .ajyn-footer-dot { padding-bottom:8px !important; }
        .ajyn-footer-copy { font-size:10px !important;padding-bottom:8px !important; }
        .ajyn-footer-legal { font-size:9px !important; }
      }
      @media only screen and (max-width: 600px) and (prefers-color-scheme: dark) {
        .ajyn-logo-cell, .ajyn-ref-cell { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-logo-frame { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important;border-color:#171514 !important; }
        .ajyn-ref-cell { border-top-color:#3b332e !important; }
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
    ? `${input.eyebrow ? escapeHtml(input.eyebrow.toUpperCase()) : 'REFERENCE'} <span class="ajyn-text-brand" style="color:#B87432;-webkit-text-fill-color:#B87432;">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '');
  const closingMessage = input.closing || 'We will keep you updated every step of the way.';

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
                    <td class="ajyn-logo-cell ajyn-light-bg" align="left" valign="middle" bgcolor="#ffffff" style="padding:0 0 14px;background:#ffffff;background-color:#ffffff;">
                      <div class="ajyn-logo-lockup" style="display:inline-block;text-align:center;">
                        <div class="ajyn-logo-frame" style="width:78px;height:78px;border-radius:999px;overflow:hidden;background:#ffffff;background-color:#ffffff;border:1px solid #f1ebe6;box-sizing:border-box;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1;">
                          ${getLogoMarkHtml()}
                          <div class="ajyn-logo-word ajyn-text-dark ajyn-gmail-text" style="padding-top:0;padding-left:0.46em;color:#111111;-webkit-text-fill-color:#111111;font-size:11px;line-height:1;letter-spacing:0.46em;font-weight:700;">AJYN</div>
                        </div>
                      </div>
                    </td>
                    <td class="ajyn-ref-cell ajyn-text-dark ajyn-light-bg" align="right" valign="middle" bgcolor="#ffffff" style="padding:0 0 14px;background:#ffffff;background-color:#ffffff;color:#111111;-webkit-text-fill-color:#111111;font-size:11px;line-height:1.4;text-transform:uppercase;">
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
                      <div class="ajyn-status-check" style="width:48px;height:48px;border:2px solid #b87432;border-radius:50%;text-align:center;line-height:46px;font-size:24px;color:#b87432;">&#10003;</div>
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
                  <tr>
                    <td class="ajyn-copy ajyn-closing ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:19px;color:#111111;-webkit-text-fill-color:#111111;">
                <span class="ajyn-gmail-text" style="color:#111111;-webkit-text-fill-color:#111111;">${escapeHtml(closingMessage)}</span>
                    </td>
                  </tr>
                  ${
                    input.ctaLabel && input.ctaUrl
                      ? `<tr>
                    <td align="center" class="ajyn-cta-cell" style="padding-bottom:23px;">
                <a href="${escapeHtml(input.ctaUrl)}" class="ajyn-cta ajyn-black-bg ajyn-text-orange" style="display:block;width:225px;max-width:100%;box-sizing:border-box;background:#000000;background-color:#000000;background-image:linear-gradient(#000000,#000000);color:#c47b43;-webkit-text-fill-color:#c47b43;font-weight:700;letter-spacing:1.9px;padding:14px 18px;border-radius:5px;font-size:12px;line-height:1;text-transform:uppercase;text-align:center;">${escapeHtml(input.ctaLabel)}</a>
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
                <div class="ajyn-help-icon" style="padding-bottom:4px;color:#b87432;font-size:22px;line-height:1;">${getSupportIconHtml()}</div>
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
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-footer ajyn-footer-bg" bgcolor="#f8f4f1" style="background:#f8f4f1;background-color:#f8f4f1;border-radius:0;padding:15px 20px 17px;border-collapse:separate;">
                  <tr>
                    <td align="center">
                      <div class="ajyn-footer-brand ajyn-text-dark ajyn-gmail-text" style="font-size:12px;line-height:1;letter-spacing:10px;padding-left:10px;font-weight:700;padding-bottom:3px;color:#111111;-webkit-text-fill-color:#111111;">AJYN</div>
                      <div class="ajyn-footer-dot" style="color:#b87432;font-size:12px;line-height:1;padding-bottom:8px;">&bull;</div>
                      <div class="ajyn-footer-copy ajyn-text-dark ajyn-gmail-text" style="font-size:11px;line-height:1.4;padding-bottom:8px;color:#111111;-webkit-text-fill-color:#111111;">Thank you for shopping with ${BRAND_NAME}.</div>
                      <div class="ajyn-footer-legal ajyn-text-dark ajyn-gmail-text" style="font-size:10px;line-height:1.5;color:#111111;-webkit-text-fill-color:#111111;">&copy; 2025 ${BRAND_NAME}. All rights reserved.</div>
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

function getLogoMarkHtml() {
  return `
    <svg class="ajyn-logo-mark" width="78" height="46" viewBox="45 105 435 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AJYN" style="display:block;margin:0 auto;">
      <path class="ajyn-logo-ink" fill="#202124" d="M58 158c48 54 133 54 219 102-70-21-154-7-209-74-6-8-9-17-10-28Z"/>
      <path class="ajyn-logo-ink" fill="#202124" d="M72 231c51 57 146 37 214 91-69-18-157 12-210-61-7-10-8-20-4-30Z"/>
      <path class="ajyn-logo-ink" fill="#202124" d="M220 392 328 118h27l111 274h-49L340 171 266 392h-46Z"/>
      <path class="ajyn-logo-cutout" fill="#ffffff" d="M299 321 342 195l52 126H299Z"/>
      <path class="ajyn-logo-stroke" fill="none" stroke="#202124" stroke-linecap="round" stroke-width="17" d="M264 262c47 17 90 45 139 70"/>
      <circle class="ajyn-logo-dot" cx="430" cy="130" r="22" fill="#b85b0e"/>
    </svg>
  `;
}

function getPackageIconHtml() {
  return `
    <svg class="ajyn-package-icon" width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:14px auto 0;">
      <path d="M11 16.5 24 9l13 7.5v15L24 39l-13-7.5v-15Z" stroke="#B87432" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M11.8 16.8 24 24l12.2-7.2M24 24v14.2M17.4 12.6 30.6 20" stroke="#B87432" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function getSupportIconHtml() {
  return `
    <svg class="ajyn-support-icon-img" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
      <path d="M4.75 12.75v-1.4a7.25 7.25 0 0 1 14.5 0v1.4" stroke="#B87432" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M5 12.5h2.25v5H5.8A2.3 2.3 0 0 1 3.5 15.2v-.4A2.3 2.3 0 0 1 5 12.5Zm14 0h-2.25v5h1.45a2.3 2.3 0 0 0 2.3-2.3v-.4a2.3 2.3 0 0 0-1.5-2.3Z" stroke="#B87432" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M16.75 17.5c0 1.8-1.25 2.75-3.75 2.75" stroke="#B87432" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

function getEmailIconHtml() {
  return `
    <svg class="ajyn-contact-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:-2px;color:currentColor;">
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
      <path d="M4.5 7 12 12.5 19.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function getWhatsAppIconHtml() {
  return `
    <svg class="ajyn-contact-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:-2px;color:currentColor;">
      <path d="M5.2 18.7 6.1 15.5A7.2 7.2 0 1 1 8.7 18l-3.5.7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9.4 8.9c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.3 0 .5-.1.7l-.4.5c.6 1.1 1.4 1.9 2.5 2.5l.5-.4c.2-.2.4-.2.7-.1l1.4.6c.3.1.4.3.4.6v.5c0 .3-.1.5-.4.7-.4.3-.9.4-1.5.4-3.2-.1-6.2-3.1-6.3-6.3 0-.6.1-1.1.4-1.5Z" fill="currentColor"/>
    </svg>
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
