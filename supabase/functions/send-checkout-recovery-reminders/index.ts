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

const AJYN_EMAIL_MOBILE_STYLES = `
      table { border-spacing:0; }
      a { color:inherit; }
      @media only screen and (max-width: 600px) {
        .ajyn-shell { padding:0 !important; background:#ffffff !important; }
        .ajyn-card { width:100% !important; max-width:100% !important; border-left:0 !important; border-right:0 !important; border-radius:0 !important; box-shadow:none !important; }
        .ajyn-header { padding:24px 24px 12px !important; text-align:center !important; }
        .ajyn-header table, .ajyn-header tbody, .ajyn-header tr, .ajyn-header td { display:block !important; width:100% !important; }
        .ajyn-reference { max-width:none !important; margin-top:14px !important; padding-top:12px !important; border-top:1px solid #ece6e1 !important; text-align:center !important; font-size:10px !important; line-height:1.4 !important; word-break:break-word !important; }
        .ajyn-logo-mark { font-size:30px !important; }
        .ajyn-logo-word { font-size:10px !important; letter-spacing:0.42em !important; }
        .ajyn-hero { border-top:0 !important; padding:16px 24px 20px !important; }
        .ajyn-icon { width:58px !important; height:58px !important; margin-bottom:14px !important; font-size:28px !important; line-height:58px !important; }
        .ajyn-title { font-size:23px !important; line-height:1.24 !important; }
        .ajyn-content { padding:0 30px 26px !important; font-size:13px !important; line-height:1.65 !important; }
        .ajyn-status { margin:18px 0 !important; }
        .ajyn-status-icon-cell { width:50px !important; padding:15px 0 15px 16px !important; }
        .ajyn-status-icon { width:36px !important; height:36px !important; font-size:20px !important; line-height:33px !important; }
        .ajyn-status-copy { padding:14px 16px 14px 8px !important; }
        .ajyn-status-title { font-size:15px !important; }
        .ajyn-cta-wrap { margin:22px 0 0 !important; }
        .ajyn-cta { display:block !important; width:100% !important; box-sizing:border-box !important; padding:15px 18px !important; text-align:center !important; }
        .ajyn-help { padding:22px 30px !important; }
        .ajyn-contact { display:block !important; margin:8px 0 !important; }
        .ajyn-footer { padding:20px 24px !important; }
        .ajyn-footer-brand { letter-spacing:0.42em !important; }
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
              <td class="ajyn-header" style="padding:30px 38px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="middle">
                      <div class="ajyn-logo-mark" style="font-size:34px;line-height:1;font-family:Georgia,'Times New Roman',serif;color:#2a1710;letter-spacing:0.06em;">A</div>
                      <div class="ajyn-logo-word" style="font-size:11px;letter-spacing:0.52em;font-weight:700;color:#2a1710;margin-top:6px;">AJYN</div>
                    </td>
                    <td align="right" valign="middle" class="ajyn-reference" style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#2a1710;">
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
                <p style="margin:0 0 18px;">We will keep you updated every step of the way.</p>
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
                <span class="ajyn-contact" style="display:inline-block;margin:0 12px;font-size:12px;color:#2a1710;">&#9993; support@ajynworld.com</span>
                <span class="ajyn-contact" style="display:inline-block;margin:0 12px;font-size:12px;color:#2a1710;">&#9742; +233 20 123 4567</span>
              </td>
            </tr>
            <tr>
              <td class="ajyn-footer" style="background:#f5f2ef;padding:22px 38px;text-align:center;color:#6b625c;font-size:11px;line-height:1.7;">
                <div class="ajyn-footer-brand" style="letter-spacing:0.55em;color:#2a1710;font-weight:700;margin-bottom:8px;">AJYN</div>
                <div>Thank you for shopping with AJYN.</div>
                <div>&copy; 2026 AJYN. All rights reserved.</div>
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

    const profileMap = new Map((profiles || []).map((profile: ProfileRow) => [profile.user_id, profile]))
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const snapshot of rows) {
      const profile = profileMap.get(snapshot.user_id)

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
