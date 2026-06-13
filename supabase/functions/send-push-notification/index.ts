import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'
import { getCorsHeaders } from '../_shared/auth.ts'
import { sanitizeInternalPath, sanitizePushNavigationUrl } from '../_shared/security-url.ts'

interface PushPayload {
  user_id: string
  title: string
  body: string
  data?: Record<string, unknown>
}

interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function jsonResponse(body: Record<string, unknown>, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function getStringDataValue(data: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!data) return null

  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getPushTargetUrl(data: Record<string, unknown> | undefined) {
  const explicitUrl = getStringDataValue(data, 'url')
  if (explicitUrl) {
    return sanitizePushNavigationUrl(explicitUrl)
  }

  const notificationId = getStringDataValue(data, 'notificationId', 'notification_id')
  if (notificationId) {
    return sanitizeInternalPath(`/notifications/${encodeURIComponent(notificationId)}`)
  }

  const orderId = getStringDataValue(data, 'orderId', 'order_id')
  if (orderId) {
    return sanitizeInternalPath(`/track-order/${encodeURIComponent(orderId)}`)
  }

  return '/notifications'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '')

    if (!accessToken) {
      return jsonResponse({ error: 'Missing authorization token' }, 401, req)
    }

    const {
      data: { user: actor },
      error: actorError,
    } = await supabase.auth.getUser(accessToken)

    if (actorError || !actor) {
      return jsonResponse({ error: 'Invalid authorization token' }, 401, req)
    }

    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', actor.id)
      .maybeSingle()

    if (roleError) {
      console.error('Error checking actor role:', roleError)
      return jsonResponse({ error: 'Could not verify permissions' }, 500, req)
    }

    const actorRole = roleRow?.role
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      return jsonResponse({ error: 'Only admins and managers can send push notifications' }, 403, req)
    }

    const { user_id, title, body, data } = await req.json() as PushPayload
    const notificationData =
      data && typeof data === 'object' && !Array.isArray(data)
        ? data
        : {}

    if (!user_id || !title || !body) {
      return jsonResponse({ error: 'Missing required fields: user_id, title, body' }, 400, req)
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return jsonResponse({ error: 'Failed to fetch subscriptions' }, 500, req)
    }

    const storedSubscriptions = (subscriptions || []) as StoredSubscription[]
    if (storedSubscriptions.length === 0) {
      return jsonResponse({
        success: true,
        configured: true,
        message: 'No push subscriptions found for this user',
        sent: 0,
        total: 0,
      }, 200, req)
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@ajyn.app'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys are missing, skipping push delivery')
      return jsonResponse({
        success: true,
        configured: false,
        message: 'Web push is not configured. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.',
        sent: 0,
        total: storedSubscriptions.length,
      }, 200, req)
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const pushPayload = JSON.stringify({
      title,
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: {
        ...notificationData,
        timestamp: Date.now(),
        url: getPushTargetUrl(notificationData),
      },
    })

    let sentCount = 0
    const failedSubscriptions: string[] = []

    for (const subscription of storedSubscriptions) {
      try {
        if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
          continue
        }

        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          pushPayload,
        )

        sentCount++
      } catch (error) {
        console.error('Error sending push to subscription:', subscription.id, error)
        const statusCode =
          typeof error === 'object' && error && 'statusCode' in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null

        if (statusCode === 404 || statusCode === 410) {
          failedSubscriptions.push(subscription.id)
        }
      }
    }

    if (failedSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', failedSubscriptions)
    }

    return jsonResponse({
      success: true,
      configured: true,
      sent: sentCount,
      total: storedSubscriptions.length,
      cleaned: failedSubscriptions.length,
      message: sentCount > 0
        ? 'Push notification sent'
        : 'No active subscriptions accepted the notification',
    }, 200, req)
  } catch (error) {
    console.error('Error in send-push-notification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: errorMessage }, 500, req)
  }
})
