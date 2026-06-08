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

const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'support@ajynworld.com'
const EMAIL_LOGO_URL = 'https://www.ajynworld.com/favicon.png'

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
    ? `${input.eyebrow ? escapeHtml(input.eyebrow) : 'Reference'} <span style="color:#B87432;font-weight:600;">${escapeHtml(input.reference)}</span>`
    : escapeHtml(input.eyebrow || '')

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
                ${input.intro ? escapeHtml(input.intro) : 'Thank you for shopping with AJYN.'}
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
                We will keep you updated every step of the way.
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
                    <td class="ajyn-contact" style="font-size:16px;color:#111111;">&#9993;&nbsp; ${escapeHtml(SUPPORT_EMAIL)}</td>
                    <td class="ajyn-contact-divider" style="padding:0 18px;color:#cccccc;">|</td>
                    <td class="ajyn-contact" style="font-size:16px;color:#111111;">&#9742;&nbsp; +233 20 123 4567</td>
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
                      <div style="font-size:18px;padding-bottom:20px;color:#111111;">Thank you for shopping with AJYN.</div>
                      <div style="font-size:15px;color:#666666;">&copy; 2026 AJYN. All rights reserved.</div>
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

function getEmailLogoUrl() {
  return EMAIL_LOGO_URL
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
