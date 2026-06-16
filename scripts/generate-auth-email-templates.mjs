import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const stylesSource = fs.readFileSync(path.join(root, 'src/lib/ajyn-email-styles.ts'), 'utf8');
const AJYN_EMAIL_STYLES = stylesSource.match(/export const AJYN_EMAIL_STYLES = `([\s\S]*?)`;/)?.[1] ?? '';

const BRAND_NAME = 'AJYN';
const COPYRIGHT_YEAR = '2026';
const SUPPORT_EMAIL = 'support@ajynworld.com';
const SUPPORT_PHONE = '+233 508664788';
const WHATSAPP_URL = 'https://wa.me/233508664788';
const LOGO_LIGHT = 'https://www.ajynworld.com/ajyn-wordmark.svg';
const LOGO_DARK = 'https://www.ajynworld.com/ajyn-wordmark-dark.svg';

const logoMarkHtml = `
    <img class="ajyn-logo-mark ajyn-wordmark-light" src="${LOGO_LIGHT}" width="110" height="48" alt="AJYN" style="display:block;width:110px;height:48px;border:0;outline:none;text-decoration:none;object-fit:contain;">
    <img class="ajyn-logo-mark ajyn-wordmark-dark" src="${LOGO_DARK}" width="110" height="48" alt="AJYN" style="display:none;width:110px;height:48px;border:0;outline:none;text-decoration:none;object-fit:contain;">`;

const footerMarkHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-footer-mark-wrap ajyn-footer-mark-bg ajyn-soft-bg" bgcolor="#f7f4f2" style="width:100%;max-width:100%;margin:0 auto;border-collapse:separate;border-radius:8px;background:#f7f4f2;">
      <tr>
        <td align="center" style="padding:18px 24px;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-light" src="${LOGO_LIGHT}" width="110" height="48" alt="AJYN" style="display:block;width:110px;height:48px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
          <img class="ajyn-footer-mark-img ajyn-wordmark-dark" src="${LOGO_DARK}" width="110" height="48" alt="AJYN" style="display:none;width:110px;height:48px;margin:0 auto;border:0;outline:none;text-decoration:none;object-fit:contain;">
        </td>
      </tr>
    </table>`;

function buildAuthEmailHtml(config) {
  const {
    pageTitle,
    previewText,
    referenceHtml,
    title,
    intro,
    bodyHtml = '',
    statusTitle,
    statusText,
    ctaLabel,
    ctaHref,
    preheaderLabel,
    preheaderHref,
    closing = '',
    footerNote = `Thank you for shopping with ${BRAND_NAME}.`,
  } = config;

  const preheaderRow =
    preheaderHref && preheaderLabel
      ? `<tr class="ajyn-preheader">
              <td class="ajyn-preheader-cell ajyn-light-bg ajyn-font-sans" bgcolor="#ffffff" style="padding:12px 44px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" class="ajyn-preheader-left ajyn-text-muted ajyn-font-sans" style="font-size:11px;line-height:1.4;">Thank you for shopping with ${BRAND_NAME}.</td>
                    <td align="right" class="ajyn-font-sans" style="font-size:11px;line-height:1.4;white-space:nowrap;">
                      <a href="${preheaderHref}" class="ajyn-preheader-link">${preheaderLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
      : '';

  const statusRow =
    statusTitle || statusText
      ? `<tr>
                    <td class="ajyn-status-row" style="padding-bottom:19px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-status-card ajyn-soft-bg" bgcolor="#f7f4f2" style="background:#f7f4f2;border-radius:6px;padding:16px 19px;border-collapse:separate;">
                        <tr>
                          <td width="64" valign="middle" class="ajyn-status-icon-cell">
                            <div class="ajyn-status-check" style="width:48px;height:48px;border:2px solid #c18c5d;border-radius:50%;text-align:center;line-height:46px;font-size:24px;color:#c18c5d;">&#10003;</div>
                          </td>
                          <td valign="middle" class="ajyn-status-copy ajyn-text-dark ajyn-font-sans">
                            ${statusTitle ? `<div class="ajyn-status-title ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:14px;line-height:1.25;font-weight:700;padding-bottom:4px;">${statusTitle}</div>` : ''}
                            ${statusText ? `<div class="ajyn-status-text ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:11px;line-height:1.45;">${statusText}</div>` : ''}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
      : '';

  const bodyContentRow = bodyHtml
    ? `<tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:19px;">
                      <div class="ajyn-gmail-text">${bodyHtml}</div>
                    </td>
                  </tr>`
    : '';

  const closingRow = closing
    ? `<tr>
                    <td class="ajyn-copy ajyn-closing ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:19px;">
                      <span class="ajyn-gmail-text">${closing}</span>
                    </td>
                  </tr>`
    : '';

  const ctaRow =
    ctaLabel && ctaHref
      ? `<tr>
                    <td align="center" class="ajyn-cta-cell" style="padding-bottom:23px;">
                      <a href="${ctaHref}" class="ajyn-cta ajyn-black-bg ajyn-text-orange ajyn-font-sans" style="display:block;width:225px;max-width:100%;box-sizing:border-box;background:#000000;color:#c18c5d;font-weight:700;letter-spacing:1.9px;padding:14px 18px;border-radius:5px;font-size:12px;line-height:1;text-transform:uppercase;text-align:center;">${ctaLabel}</a>
                    </td>
                  </tr>`
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${pageTitle}</title>
    <style>
${AJYN_EMAIL_STYLES}
    </style>
  </head>
  <body class="body ajyn-body-bg ajyn-font-sans" style="margin:0;padding:0;background:#f5f5f5;color-scheme:light dark;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-body-bg" bgcolor="#f5f5f5" style="background:#f5f5f5;border-collapse:collapse;">
      <tr>
        <td align="center" class="ajyn-shell" bgcolor="#f5f5f5" style="padding:14px 0;background:#f5f5f5;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="ajyn-card ajyn-light-bg" bgcolor="#ffffff" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #eeeeee;border-radius:4px;overflow:hidden;">
            ${preheaderRow}
            <tr>
              <td class="ajyn-container ajyn-light-bg" bgcolor="#ffffff" style="padding:28px 44px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="ajyn-header-row">
                  <tr>
                    <td class="ajyn-logo-cell ajyn-light-bg" align="left" valign="middle" bgcolor="#ffffff" style="background:#ffffff;">
                      <div class="ajyn-logo-lockup" style="display:inline-block;text-align:left;">${logoMarkHtml}</div>
                    </td>
                    <td class="ajyn-ref-cell ajyn-text-dark ajyn-light-bg ajyn-font-sans" align="right" valign="middle" bgcolor="#ffffff" style="background:#ffffff;">${referenceHtml}</td>
                  </tr>
                </table>
                <div class="ajyn-desktop-divider" style="border-top:1px solid #ece7e2;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-hero-wrap ajyn-light-bg" bgcolor="#ffffff" style="padding:20px 44px 10px;background:#ffffff;">
                <div class="ajyn-hero-icon ajyn-hero-bg" style="width:60px;height:60px;border-radius:50%;background:#f2e9e1;display:inline-block;text-align:center;">
                  <span class="ajyn-package-icon-text" aria-hidden="true" style="display:block;margin:13px auto 0;color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:32px;">&#9633;</span>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" class="ajyn-title ajyn-text-dark ajyn-light-bg ajyn-font-serif" bgcolor="#ffffff" style="padding:0 44px 18px;background:#ffffff;font-size:21px;line-height:1.25;font-weight:700;">
                <span class="ajyn-gmail-text">${title}</span>
              </td>
            </tr>
            <tr>
              <td class="ajyn-body ajyn-light-bg ajyn-font-sans" bgcolor="#ffffff" style="padding:0 72px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:11px;">
                      <span class="ajyn-gmail-text">Hello there,</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="ajyn-copy ajyn-text-dark ajyn-font-sans" style="font-size:13px;line-height:1.6;padding-bottom:11px;">
                      <span class="ajyn-gmail-text">${intro}</span>
                    </td>
                  </tr>
                  ${bodyContentRow}
                  ${statusRow}
                  ${closingRow}
                  ${ctaRow}
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
                <div class="ajyn-help-icon" style="padding-bottom:4px;color:#c18c5d;font-size:22px;line-height:1;"><span class="ajyn-support-icon-text" aria-hidden="true" style="display:block;margin:0 auto;color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:22px;">?</span></div>
                <div class="ajyn-help-title ajyn-text-dark ajyn-gmail-text ajyn-font-serif" style="font-size:14px;line-height:1.25;font-weight:700;">Need help?</div>
                <div class="ajyn-help-subtitle ajyn-text-dark ajyn-gmail-text ajyn-font-sans" style="font-size:11px;line-height:1.35;padding-bottom:11px;">We're here for you.</div>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="border-collapse:collapse;">
                  <tr>
                    <td class="ajyn-contact ajyn-text-dark ajyn-font-sans" style="font-size:11px;line-height:1.3;"><span class="ajyn-contact-icon-text" aria-hidden="true" style="display:inline-block;vertical-align:0;color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;line-height:1;">@</span>&nbsp; <a href="mailto:${SUPPORT_EMAIL}" class="ajyn-gmail-text">${SUPPORT_EMAIL}</a></td>
                    <td class="ajyn-contact-divider" width="28" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td class="ajyn-contact ajyn-text-dark ajyn-font-sans" style="font-size:11px;line-height:1.3;"><span class="ajyn-contact-icon-text" aria-hidden="true" style="display:inline-block;vertical-align:0;color:#c18c5d;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;line-height:1;">WA</span>&nbsp; <a href="${WHATSAPP_URL}" class="ajyn-gmail-text">${SUPPORT_PHONE}</a></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="ajyn-footer ajyn-footer-bg" bgcolor="#ffffff" style="padding:18px 44px 20px;background:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding-bottom:14px;">${footerMarkHtml}</td>
                  </tr>
                  <tr>
                    <td align="center" class="ajyn-footer-copy ajyn-text-muted ajyn-font-sans" style="font-size:11px;line-height:1.5;padding-bottom:8px;">${footerNote}</td>
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

const authTemplates = [
  {
    filename: 'confirmation.html',
    pageTitle: 'Verify your AJYN email',
    previewText: 'Confirm your AJYN email address.',
    referenceHtml: 'EMAIL <span class="ajyn-text-brand">VERIFICATION</span>',
    title: 'Verify Your Email Address',
    intro: 'Thank you for creating your AJYN account. Confirm this email address so we can keep your account secure and send order updates to the right place.',
    statusTitle: 'Verification Link',
    statusText: 'This link expires shortly and can only be used once.',
    ctaLabel: 'VERIFY EMAIL',
    ctaHref: '{{ .ConfirmationURL }}',
    preheaderLabel: 'Verify email',
    preheaderHref: '{{ .ConfirmationURL }}',
  },
  {
    filename: 'recovery.html',
    pageTitle: 'Reset your AJYN password',
    previewText: 'Reset your AJYN password securely.',
    referenceHtml: 'ACCOUNT <span class="ajyn-text-brand">RECOVERY</span>',
    title: 'Reset Your Password',
    intro: 'We received a request to reset the password for your AJYN account.',
    statusTitle: 'Password Reset',
    statusText: 'Use this link only if you requested the reset.',
    ctaLabel: 'RESET PASSWORD',
    ctaHref: '{{ .ConfirmationURL }}',
    preheaderLabel: 'Reset password',
    preheaderHref: '{{ .ConfirmationURL }}',
    footerNote: 'If you did not request this, you can ignore this email.',
  },
  {
    filename: 'magic-link.html',
    pageTitle: 'Your AJYN sign-in link',
    previewText: 'Use your secure AJYN sign-in link.',
    referenceHtml: 'SECURE <span class="ajyn-text-brand">SIGN IN</span>',
    title: 'Your Sign-In Link',
    intro: 'Use the secure link below to sign in to AJYN. This link expires shortly and can only be used once.',
    statusTitle: 'Secure Sign In',
    statusText: 'Open this link on the device where you want to sign in.',
    ctaLabel: 'SIGN IN',
    ctaHref: '{{ .ConfirmationURL }}',
    preheaderLabel: 'Sign in',
    preheaderHref: '{{ .ConfirmationURL }}',
  },
  {
    filename: 'invite.html',
    pageTitle: 'You are invited to AJYN',
    previewText: 'You have been invited to create an AJYN account.',
    referenceHtml: 'ACCOUNT <span class="ajyn-text-brand">INVITE</span>',
    title: 'You Are Invited',
    intro: 'You have been invited to create an AJYN account.',
    statusTitle: 'Account Invite',
    statusText: 'Accept the invitation to finish setting up your account.',
    ctaLabel: 'ACCEPT INVITE',
    ctaHref: '{{ .ConfirmationURL }}',
    preheaderLabel: 'Accept invite',
    preheaderHref: '{{ .ConfirmationURL }}',
  },
  {
    filename: 'email-change.html',
    pageTitle: 'Confirm your new AJYN email',
    previewText: 'Confirm your new AJYN account email.',
    referenceHtml: 'EMAIL <span class="ajyn-text-brand">CHANGE</span>',
    title: 'Confirm Your New Email',
    intro: 'Confirm that you want to use {{ .NewEmail }} for your AJYN account.',
    statusTitle: 'Email Change',
    statusText: 'We will send account and order updates to the confirmed address.',
    ctaLabel: 'CONFIRM EMAIL',
    ctaHref: '{{ .ConfirmationURL }}',
    preheaderLabel: 'Confirm email',
    preheaderHref: '{{ .ConfirmationURL }}',
    footerNote: 'If you did not request this, contact support.',
  },
  {
    filename: 'reauthentication.html',
    pageTitle: 'Your AJYN verification code',
    previewText: 'Use this code to continue securely.',
    referenceHtml: 'SECURITY <span class="ajyn-text-brand">CODE</span>',
    title: 'Verify It Is You',
    intro: 'Use this code to continue:',
    bodyHtml:
      '<div class="ajyn-text-dark ajyn-font-sans" style="font-size:34px;letter-spacing:0.18em;font-weight:700;background:#f7f4f2;border-radius:6px;padding:18px;margin:18px 0;text-align:center;">{{ .Token }}</div><p class="ajyn-text-muted ajyn-font-sans" style="margin:0;font-size:12px;line-height:1.6;">This code expires shortly. Do not share it with anyone.</p>',
    preheaderLabel: 'Security code',
    preheaderHref: '{{ .SiteURL }}',
  },
];

const outputDir = path.join(root, 'supabase/templates');
for (const template of authTemplates) {
  const html = buildAuthEmailHtml(template);
  fs.writeFileSync(path.join(outputDir, template.filename), html, 'utf8');
  console.log(`Wrote ${template.filename}`);
}
