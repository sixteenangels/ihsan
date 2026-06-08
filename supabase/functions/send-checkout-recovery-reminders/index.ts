import { corsHeaders, createServiceSupabaseClient, jsonResponse, requireAdminOrInternalRequest, type ServiceSupabaseClient } from '../_shared/auth.ts'

interface RecoverySnapshot {
  id: string
  user_id: string
  item_count: number
  subtotal: number
  product_names: string[]
  shipping_label: string | null
  checkout_path: string
}

interface ProfileRow {
  user_id: string
  name: string | null
  email: string | null
}

interface CustomerPreferenceRow {
  user_id: string
  deal_alerts_enabled: boolean | null
}

const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'support@ajyn.com'

const AJYN_EMAIL_MOBILE_STYLES = `
      :root { color-scheme:light only;supported-color-schemes:light; }
      table { border-spacing:0;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0; }
      img { border:0;outline:none;text-decoration:none; }
      a { color:inherit;text-decoration:none; }
      .ajyn-body-bg { color-scheme:light only; }
      .ajyn-light-bg { background:#ffffff !important;background-color:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important; }
      .ajyn-soft-bg { background:#f7f4f2 !important;background-color:#f7f4f2 !important;background-image:linear-gradient(#f7f4f2,#f7f4f2) !important; }
      .ajyn-footer-bg { background:#f8f4f1 !important;background-color:#f8f4f1 !important;background-image:linear-gradient(#f8f4f1,#f8f4f1) !important; }
      .ajyn-hero-bg { background:#f2e9e1 !important;background-color:#f2e9e1 !important;background-image:linear-gradient(#f2e9e1,#f2e9e1) !important; }
      .ajyn-black-bg, .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important; }
      .ajyn-text-dark { color:#111111 !important;-webkit-text-fill-color:#111111 !important; }
      .ajyn-text-orange, .ajyn-cta { color:#c47b43 !important;-webkit-text-fill-color:#c47b43 !important; }
      .ajyn-text-brand { color:#B87432 !important;-webkit-text-fill-color:#B87432 !important; }
      @media (prefers-color-scheme: dark) {
        .ajyn-card, .ajyn-container, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help { background:#ffffff !important;background-color:#ffffff !important;background-image:linear-gradient(#ffffff,#ffffff) !important; }
        .ajyn-status-card { background:#f7f4f2 !important;background-color:#f7f4f2 !important;background-image:linear-gradient(#f7f4f2,#f7f4f2) !important; }
        .ajyn-footer { background:#f8f4f1 !important;background-color:#f8f4f1 !important;background-image:linear-gradient(#f8f4f1,#f8f4f1) !important; }
        .ajyn-hero-icon { background:#f2e9e1 !important;background-color:#f2e9e1 !important;background-image:linear-gradient(#f2e9e1,#f2e9e1) !important; }
        .ajyn-text-dark, .ajyn-copy, .ajyn-title, .ajyn-status-title, .ajyn-status-text, .ajyn-help-title, .ajyn-help-subtitle, .ajyn-contact, .ajyn-footer-brand, .ajyn-footer-copy, .ajyn-footer-legal, .ajyn-logo-word, .ajyn-ref-cell { color:#111111 !important;-webkit-text-fill-color:#111111 !important; }
        .ajyn-text-brand { color:#B87432 !important;-webkit-text-fill-color:#B87432 !important; }
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
        .ajyn-logo-mark { width:74px !important;height:43px !important; }
        .ajyn-logo-word { font-size:10px !important;letter-spacing:0.42em !important;padding-left:0.42em !important; }
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
`

function formatGhs(amount: number) {
  return `GHS ${Number(amount || 0).toFixed(2)}`
}

function buildEmail(snapshot: RecoverySnapshot, profile?: ProfileRow) {
  const name = profile?.name || 'there'
  const productList = snapshot.product_names.slice(0, 4).join(', ')
  const appUrl = Deno.env.get('APP_URL') || 'https://www.ajynworld.com'
  const checkoutUrl = `${appUrl}${snapshot.checkout_path || '/checkout'}`
  const shippingLine = snapshot.shipping_label ? ` with ${snapshot.shipping_label}` : ''

  return {
    subject: 'Your AJYN checkout is waiting',
    text: `Hi ${name}, your cart has ${snapshot.item_count} item(s) worth ${formatGhs(snapshot.subtotal)}. Continue checkout: ${checkoutUrl}`,
    html: buildAjynEmailHtml({
      eyebrow: 'Checkout Reminder',
      icon: '&#9634;',
      title: 'Your Checkout Is Waiting',
      greetingName: name,
      intro: `You still have ${snapshot.item_count} item(s) selected for checkout.`,
      bodyHtml: `
        <p style="margin:0 0 14px;"><strong>${escapeHtml(formatGhs(snapshot.subtotal))}</strong>${escapeHtml(shippingLine)}</p>
        ${productList ? `<p style="margin:0 0 14px;">${escapeHtml(productList)}</p>` : ''}
      `,
      statusTitle: 'Cart Saved',
      statusText: 'Your items are still waiting. Complete checkout before they sell out.',
      ctaLabel: 'RESUME CHECKOUT',
      ctaUrl: checkoutUrl,
    }),
  }
}

function buildAjynEmailHtml(input: {
  eyebrow?: string
  reference?: string
  icon?: string
  title: string
  greetingName?: string
  intro?: string
  bodyHtml?: string
  statusTitle?: string
  statusText?: string
  ctaLabel?: string
  ctaUrl?: string
}) {
  const preview = input.intro || input.statusText || input.title
  const referenceLine = input.reference
    ? `${input.eyebrow ? escapeHtml(input.eyebrow.toUpperCase()) : 'REFERENCE'} <span class="ajyn-text-brand" style="color:#B87432;-webkit-text-fill-color:#B87432;">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(input.title)}</title>
    <style>
${AJYN_EMAIL_MOBILE_STYLES}
    </style>
  </head>
  <body class="ajyn-body-bg" style="margin:0;padding:0;background:#f5f5f5;background-color:#f5f5f5;color:#111111;font-family:Arial,Helvetica,sans-serif;color-scheme:light only;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-body-bg" bgcolor="#f5f5f5" style="background:#f5f5f5;background-color:#f5f5f5;border-collapse:collapse;">
      <tr>
        <td align="center" class="ajyn-shell" bgcolor="#f5f5f5" style="padding:14px 0;background:#f5f5f5;background-color:#f5f5f5;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ajyn-card ajyn-light-bg" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border:1px solid #eeeeee;border-radius:4px;overflow:hidden;">
            <tr>
              <td class="ajyn-container ajyn-light-bg" bgcolor="#ffffff" style="padding:28px 44px 0;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-header-row">
                  <tr>
                    <td class="ajyn-logo-cell ajyn-light-bg" align="left" valign="middle" bgcolor="#ffffff" style="padding:0 0 14px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                      <div class="ajyn-logo-lockup" style="display:inline-block;text-align:center;">
                        ${getLogoMarkHtml()}
                        <div class="ajyn-logo-word ajyn-text-dark" style="padding-top:0;padding-left:0.46em;color:#111111;-webkit-text-fill-color:#111111;font-size:11px;line-height:1;letter-spacing:0.46em;font-weight:700;">AJYN</div>
                      </div>
                    </td>
                    <td class="ajyn-ref-cell ajyn-text-dark ajyn-light-bg" align="right" valign="middle" bgcolor="#ffffff" style="padding:0 0 14px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);color:#111111;-webkit-text-fill-color:#111111;font-size:11px;line-height:1.4;text-transform:uppercase;">
                      ${referenceLine}
                    </td>
                  </tr>
                </table>
                <div class="ajyn-desktop-divider" style="border-top:1px solid #ece7e2;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-hero-wrap ajyn-light-bg" bgcolor="#ffffff" style="padding:20px 44px 10px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                <div class="ajyn-hero-icon ajyn-hero-bg" style="width:60px;height:60px;border-radius:50%;background:#f2e9e1;background-color:#f2e9e1;background-image:linear-gradient(#f2e9e1,#f2e9e1);display:inline-block;text-align:center;">
                  ${getPackageIconHtml()}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-title ajyn-text-dark ajyn-light-bg" bgcolor="#ffffff" style="padding:0 44px 18px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.25;color:#111111;-webkit-text-fill-color:#111111;font-weight:700;">
                ${escapeHtml(input.title)}
              </td>
            </tr>
            <tr>
              <td class="ajyn-body ajyn-light-bg" bgcolor="#ffffff" style="padding:0 104px 0;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:11px;color:#111111;-webkit-text-fill-color:#111111;">
                Hello ${escapeHtml(input.greetingName || 'there')},
                    </td>
                  </tr>
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:11px;color:#111111;-webkit-text-fill-color:#111111;">
                ${input.intro ? escapeHtml(input.intro) : 'Thank you for shopping with AJYN.'}
                    </td>
                  </tr>
                  ${
                    input.bodyHtml
                      ? `<tr>
                    <td class="ajyn-copy ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:19px;color:#111111;-webkit-text-fill-color:#111111;">
                ${input.bodyHtml || ''}
                    </td>
                  </tr>`
                      : ''
                  }
                  ${
                    input.statusTitle || input.statusText
                      ? `<tr>
                    <td class="ajyn-status-row" style="padding-bottom:19px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status-card ajyn-soft-bg" bgcolor="#f7f4f2" style="background:#f7f4f2;background-color:#f7f4f2;background-image:linear-gradient(#f7f4f2,#f7f4f2);border-radius:6px;padding:16px 19px;border-collapse:separate;">
                  <tr>
                    <td width="64" valign="middle" class="ajyn-status-icon-cell">
                      <div class="ajyn-status-check" style="width:48px;height:48px;border:2px solid #b87432;border-radius:50%;text-align:center;line-height:46px;font-size:24px;color:#b87432;">&#10003;</div>
                    </td>
                    <td valign="middle" class="ajyn-status-copy ajyn-text-dark" style="color:#111111;-webkit-text-fill-color:#111111;">
                      ${input.statusTitle ? `<div class="ajyn-status-title ajyn-text-dark" style="font-size:14px;line-height:1.25;font-weight:700;color:#111111;-webkit-text-fill-color:#111111;padding-bottom:4px;">${escapeHtml(input.statusTitle)}</div>` : ''}
                      ${input.statusText ? `<div class="ajyn-status-text ajyn-text-dark" style="font-size:10px;line-height:1.45;color:#111111;-webkit-text-fill-color:#111111;">${escapeHtml(input.statusText)}</div>` : ''}
                    </td>
                  </tr>
                </table>
                    </td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td class="ajyn-copy ajyn-closing ajyn-text-dark" style="font-size:12px;line-height:1.6;padding-bottom:19px;color:#111111;-webkit-text-fill-color:#111111;">
                We will keep you updated every step of the way.
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
              <td class="ajyn-divider-cell ajyn-light-bg" bgcolor="#ffffff" style="padding:0 44px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                <hr style="border:none;border-top:1px solid #ece7e2;margin:0;">
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-help ajyn-light-bg" bgcolor="#ffffff" style="padding:17px 42px 15px;background:#ffffff;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);">
                <div class="ajyn-help-icon" style="padding-bottom:4px;color:#b87432;font-size:22px;line-height:1;">${getSupportIconHtml()}</div>
                <div class="ajyn-help-title ajyn-text-dark" style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.25;font-weight:700;color:#111111;-webkit-text-fill-color:#111111;">Need help?</div>
                <div class="ajyn-help-subtitle ajyn-text-dark" style="font-size:11px;line-height:1.35;color:#111111;-webkit-text-fill-color:#111111;padding-bottom:11px;">We're here for you.</div>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;">
                  <tr>
                    <td class="ajyn-contact ajyn-text-dark" style="font-size:11px;line-height:1.3;color:#111111;-webkit-text-fill-color:#111111;">${getEmailIconHtml()}&nbsp; ${escapeHtml(SUPPORT_EMAIL)}</td>
                    <td class="ajyn-contact-divider" width="28" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td class="ajyn-contact ajyn-text-dark" style="font-size:11px;line-height:1.3;color:#111111;-webkit-text-fill-color:#111111;">${getWhatsAppIconHtml()}&nbsp; +233 20 123 4567</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-footer ajyn-footer-bg" bgcolor="#f8f4f1" style="background:#f8f4f1;background-color:#f8f4f1;background-image:linear-gradient(#f8f4f1,#f8f4f1);border-radius:0;padding:15px 20px 17px;border-collapse:separate;">
                  <tr>
                    <td align="center">
                      <div class="ajyn-footer-brand ajyn-text-dark" style="font-size:12px;line-height:1;letter-spacing:10px;padding-left:10px;font-weight:700;padding-bottom:3px;color:#111111;-webkit-text-fill-color:#111111;">AJYN</div>
                      <div class="ajyn-footer-dot" style="color:#b87432;font-size:12px;line-height:1;padding-bottom:8px;">&bull;</div>
                      <div class="ajyn-footer-copy ajyn-text-dark" style="font-size:11px;line-height:1.4;padding-bottom:8px;color:#111111;-webkit-text-fill-color:#111111;">Thank you for shopping with AJYN.</div>
                      <div class="ajyn-footer-legal ajyn-text-dark" style="font-size:10px;line-height:1.5;color:#111111;-webkit-text-fill-color:#111111;">&copy; 2025 AJYN. All rights reserved.</div>
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
</html>`
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getLogoMarkHtml() {
  return `
    <svg class="ajyn-logo-mark" width="78" height="46" viewBox="45 105 435 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AJYN" style="display:block;margin:0 auto;">
      <path fill="#202124" d="M58 158c48 54 133 54 219 102-70-21-154-7-209-74-6-8-9-17-10-28Z"/>
      <path fill="#202124" d="M72 231c51 57 146 37 214 91-69-18-157 12-210-61-7-10-8-20-4-30Z"/>
      <path fill="#202124" d="M220 392 328 118h27l111 274h-49L340 171 266 392h-46Z"/>
      <path fill="#ffffff" d="M299 321 342 195l52 126H299Z"/>
      <path fill="none" stroke="#202124" stroke-linecap="round" stroke-width="17" d="M264 262c47 17 90 45 139 70"/>
      <circle cx="430" cy="130" r="22" fill="#b85b0e"/>
    </svg>
  `
}

function getPackageIconHtml() {
  return `
    <svg class="ajyn-package-icon" width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:14px auto 0;">
      <path d="M11 16.5 24 9l13 7.5v15L24 39l-13-7.5v-15Z" stroke="#B87432" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M11.8 16.8 24 24l12.2-7.2M24 24v14.2M17.4 12.6 30.6 20" stroke="#B87432" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

function getSupportIconHtml() {
  return `
    <svg class="ajyn-support-icon-img" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
      <path d="M4.75 12.75v-1.4a7.25 7.25 0 0 1 14.5 0v1.4" stroke="#B87432" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M5 12.5h2.25v5H5.8A2.3 2.3 0 0 1 3.5 15.2v-.4A2.3 2.3 0 0 1 5 12.5Zm14 0h-2.25v5h1.45a2.3 2.3 0 0 0 2.3-2.3v-.4a2.3 2.3 0 0 0-1.5-2.3Z" stroke="#B87432" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M16.75 17.5c0 1.8-1.25 2.75-3.75 2.75" stroke="#B87432" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `
}

function getEmailIconHtml() {
  return `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:-2px;">
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="#111111" stroke-width="1.8"/>
      <path d="M4.5 7 12 12.5 19.5 7" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

function getWhatsAppIconHtml() {
  return `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:-2px;">
      <path d="M5.2 18.7 6.1 15.5A7.2 7.2 0 1 1 8.7 18l-3.5.7Z" stroke="#111111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9.4 8.9c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.3 0 .5-.1.7l-.4.5c.6 1.1 1.4 1.9 2.5 2.5l.5-.4c.2-.2.4-.2.7-.1l1.4.6c.3.1.4.3.4.6v.5c0 .3-.1.5-.4.7-.4.3-.9.4-1.5.4-3.2-.1-6.2-3.1-6.3-6.3 0-.6.1-1.1.4-1.5Z" fill="#111111"/>
    </svg>
  `
}

async function markSnapshotReminded(supabase: ServiceSupabaseClient, snapshotId: string) {
  await supabase
    .from('checkout_recovery_snapshots')
    .update({
      status: 'reminded',
      reminded_at: new Date().toISOString(),
      reminder_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', snapshotId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createServiceSupabaseClient()
    const { errorResponse } = await requireAdminOrInternalRequest(req, supabase)
    if (errorResponse) {
      return errorResponse
    }
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const limit = Math.min(Number(body?.limit || 25), 100)

    const { data: snapshots, error: snapshotsError } = await supabase
      .from('checkout_recovery_snapshots')
      .select('id, user_id, item_count, subtotal, product_names, shipping_label, checkout_path')
      .in('status', ['active', 'reminded'])
      .lte('reminder_due_at', new Date().toISOString())
      .limit(limit)

    if (snapshotsError) throw snapshotsError

    const rows = (snapshots || []) as RecoverySnapshot[]
    const profileIds = rows.map((snapshot) => snapshot.user_id)
    const { data: profiles } = profileIds.length > 0
      ? await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', profileIds)
      : { data: [] as ProfileRow[] }
    const { data: preferences } = profileIds.length > 0
      ? await supabase
          .from('customer_preferences')
          .select('user_id, deal_alerts_enabled')
          .in('user_id', profileIds)
      : { data: [] as CustomerPreferenceRow[] }

    const profileMap = new Map((profiles || []).map((profile: ProfileRow) => [profile.user_id, profile]))
    const preferenceMap = new Map(
      (preferences || []).map((preference: CustomerPreferenceRow) => [preference.user_id, preference]),
    )
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const snapshot of rows) {
      const profile = profileMap.get(snapshot.user_id)
      const preference = preferenceMap.get(snapshot.user_id)

      if (preference?.deal_alerts_enabled === false) {
        skipped += 1
        await markSnapshotReminded(supabase, snapshot.id)
        continue
      }

      const { error: inAppNotificationError } = await supabase.from('notifications').insert({
        user_id: snapshot.user_id,
        title: 'Resume your checkout',
        message: `You still have ${snapshot.item_count} item${snapshot.item_count === 1 ? '' : 's'} waiting in checkout.`,
        type: 'promotion',
        data: {
          checkout_path: snapshot.checkout_path,
          snapshot_id: snapshot.id,
        },
      })

      if (inAppNotificationError) {
        console.error('Failed to create checkout recovery notification', snapshot.id, inAppNotificationError)
      }

      const { error: inAppReminderError } = await supabase.from('checkout_recovery_reminders').insert({
        snapshot_id: snapshot.id,
        user_id: snapshot.user_id,
        channel: 'in_app',
        status: inAppNotificationError ? 'failed' : 'sent',
        error_message: inAppNotificationError?.message || null,
        sent_at: inAppNotificationError ? null : new Date().toISOString(),
      })

      if (inAppReminderError) {
        console.error('Failed to record checkout recovery in-app reminder', snapshot.id, inAppReminderError)
      }

      if (!profile?.email) {
        skipped += 1
        await markSnapshotReminded(supabase, snapshot.id)
        continue
      }

      const email = buildEmail(snapshot, profile)
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({
          to: profile.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          replyTo: SUPPORT_EMAIL,
          headers: {
            'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}?subject=Unsubscribe%20AJYN%20deal%20reminders>`,
            'X-AJYN-Email-Type': 'checkout_recovery',
          },
          type: 'checkout_recovery',
          relatedEntityType: 'checkout_recovery_snapshot',
          relatedEntityId: snapshot.id,
          requestedBy: snapshot.user_id,
        }),
      })

      await supabase.from('checkout_recovery_reminders').insert({
        snapshot_id: snapshot.id,
        user_id: snapshot.user_id,
        channel: 'email',
        status: emailResponse.ok ? 'sent' : 'failed',
        error_message: emailResponse.ok ? null : await emailResponse.text(),
        sent_at: emailResponse.ok ? new Date().toISOString() : null,
      })

      if (emailResponse.ok) {
        sent += 1
      } else {
        failed += 1
      }

      await markSnapshotReminded(supabase, snapshot.id)
    }

    return jsonResponse({ processed: rows.length, sent, skipped, failed })
  } catch (error) {
    console.error('send-checkout-recovery-reminders error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
