import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

function formatGhs(amount: number) {
  return `GHS ${Number(amount || 0).toFixed(2)}`
}

function buildEmail(snapshot: RecoverySnapshot, profile?: ProfileRow) {
  const name = profile?.name ? ` ${profile.name}` : ''
  const productList = snapshot.product_names.slice(0, 4).join(', ')
  const appUrl = Deno.env.get('APP_URL') || 'https://controlled-commerce-hub-main.vercel.app'
  const checkoutUrl = `${appUrl}${snapshot.checkout_path || '/checkout'}`

  return {
    subject: 'Your AJYN checkout is waiting',
    text: `Hi${name}, your cart has ${snapshot.item_count} item(s) worth ${formatGhs(snapshot.subtotal)}. Continue checkout: ${checkoutUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>Your checkout is waiting</h2>
        <p>Hi${name}, you still have ${snapshot.item_count} item(s) selected for checkout.</p>
        <p><strong>${formatGhs(snapshot.subtotal)}</strong>${snapshot.shipping_label ? ` with ${snapshot.shipping_label}` : ''}</p>
        ${productList ? `<p>${productList}</p>` : ''}
        <p><a href="${checkoutUrl}" style="display:inline-block;background:#111827;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">Resume checkout</a></p>
      </div>
    `,
  }
}

async function markSnapshotReminded(supabase: ReturnType<typeof createClient>, snapshotId: string) {
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
    const supabase = createClient(supabaseUrl, serviceRoleKey)
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

      await supabase.from('notifications').insert({
        user_id: snapshot.user_id,
        title: 'Resume your checkout',
        message: `You still have ${snapshot.item_count} item${snapshot.item_count === 1 ? '' : 's'} waiting in checkout.`,
        type: 'promotion',
        data: {
          checkout_path: snapshot.checkout_path,
          snapshot_id: snapshot.id,
        },
      })

      await supabase.from('checkout_recovery_reminders').insert({
        snapshot_id: snapshot.id,
        user_id: snapshot.user_id,
        channel: 'in_app',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

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

    return new Response(
      JSON.stringify({ processed: rows.length, sent, skipped, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('send-checkout-recovery-reminders error', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
