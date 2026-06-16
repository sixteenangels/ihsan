import { getCorsHeaders, createServiceSupabaseClient, jsonResponse, requireAdminOrInternalRequest, type ServiceSupabaseClient } from '../_shared/auth.ts'
import { buildAjynEmailHtml, escapeHtml } from '../_shared/ajyn-email-template.ts'

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

function sanitizeInternalPath(path: string | null | undefined, fallback = '/checkout') {
  const trimmed = String(path || '').trim()
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('@')) {
    return fallback
  }

  if (!/^\/[A-Za-z0-9][A-Za-z0-9/_?=&%.+-]*$/.test(trimmed)) {
    return fallback
  }

  return trimmed
}

function buildSafeAppUrl(path: string, appOrigin: string) {
  return new URL(sanitizeInternalPath(path), appOrigin).toString()
}

function formatGhs(amount: number) {
  return `GHS ${Number(amount || 0).toFixed(2)}`
}

function buildEmail(snapshot: RecoverySnapshot, profile?: ProfileRow) {
  const name = profile?.name || 'there'
  const productList = snapshot.product_names.slice(0, 4).join(', ')
  const appUrl = Deno.env.get('APP_URL') || 'https://www.ajynworld.com'
  const checkoutUrl = buildSafeAppUrl(snapshot.checkout_path || '/checkout', appUrl)
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
      preheaderAction: { label: 'Resume checkout', url: checkoutUrl },
    }),
  }
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
    return new Response(null, { headers: getCorsHeaders(req) })
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
      const internalAutomationKey = Deno.env.get('INTERNAL_AUTOMATIONS_KEY')
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(internalAutomationKey
            ? { 'x-internal-automation-key': internalAutomationKey }
            : {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
              }),
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
