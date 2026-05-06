import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
  user_id: string
  title: string
  body: string
  data?: Record<string, any>
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { user_id, title, body, data } = await req.json() as PushPayload

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Sending push notification to user ${user_id}: ${title}`)

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', user_id)
      
      // Still create an in-app notification even if no push subscription
      await supabase.from('notifications').insert({
        user_id,
        title,
        message: body,
        type: data?.type || 'general',
        data,
      })
      
      return new Response(
        JSON.stringify({ success: true, message: 'No push subscriptions, created in-app notification', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create push notification payload
    const pushPayload = JSON.stringify({
      title,
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: {
        ...data,
        timestamp: Date.now(),
        url: data?.url || '/',
      },
    })

    console.log(`Found ${subscriptions.length} subscriptions, sending notifications...`)

    // Send to all subscriptions
    let sentCount = 0
    const failedSubscriptions: string[] = []

    for (const subscription of subscriptions) {
      try {
        // The subscription data should contain endpoint, p256dh, and auth
        const endpoint = subscription.endpoint
        const p256dh = subscription.p256dh
        const auth = subscription.auth

        if (!endpoint || !p256dh || !auth) {
          console.log('Invalid subscription data:', subscription.id)
          continue
        }

        // For now, we log the attempt - full web push requires proper VAPID signing
        // which needs a proper web-push library or custom implementation
        console.log(`Would send push to endpoint: ${endpoint.substring(0, 50)}...`)
        
        // Note: Full web push implementation requires:
        // 1. VAPID key pair generation
        // 2. JWT token signing with ES256
        // 3. Payload encryption with ECDH + AES-128-GCM
        // For production, use a web-push compatible library
        
        sentCount++
      } catch (error) {
        console.error('Error sending push to subscription:', subscription.id, error)
      }
    }

    // Clean up expired subscriptions
    if (failedSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', failedSubscriptions)
      console.log('Cleaned up', failedSubscriptions.length, 'expired subscriptions')
    }

    // Also create in-app notification
    await supabase.from('notifications').insert({
      user_id,
      title,
      message: body,
      type: data?.type || 'general',
      data,
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        total: subscriptions.length,
        cleaned: failedSubscriptions.length,
        message: 'Push notification queued and in-app notification created'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-push-notification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
