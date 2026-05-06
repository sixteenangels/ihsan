import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  type?: string
  relatedEntityType?: string
  relatedEntityId?: string
  requestedBy?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const payload = await req.json() as EmailPayload

    if (!payload.to || !payload.subject || !payload.html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: outboxRow, error: outboxError } = await supabase
      .from('outgoing_emails')
      .insert({
        to_email: payload.to,
        subject: payload.subject,
        html_content: payload.html,
        text_content: payload.text || null,
        email_type: payload.type || 'transactional',
        related_entity_type: payload.relatedEntityType || null,
        related_entity_id: payload.relatedEntityId || null,
        requested_by: payload.requestedBy || null,
        status: 'queued',
      })
      .select('id')
      .single()

    if (outboxError) throw outboxError

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'Ihsan <no-reply@ihsan.app>'

    if (!resendApiKey) {
      await supabase
        .from('outgoing_emails')
        .update({
          status: 'failed',
          error_message: 'RESEND_API_KEY is not configured',
        })
        .eq('id', outboxRow.id)

      return new Response(
        JSON.stringify({ queued: false, sent: false, reason: 'Missing email provider configuration' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text || undefined,
      }),
    })

    const resendBody = await resendResponse.json()

    if (!resendResponse.ok) {
      await supabase
        .from('outgoing_emails')
        .update({
          status: 'failed',
          error_message: resendBody?.message || JSON.stringify(resendBody),
        })
        .eq('id', outboxRow.id)

      return new Response(
        JSON.stringify({ queued: true, sent: false, provider: 'resend', error: resendBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    await supabase
      .from('outgoing_emails')
      .update({
        status: 'sent',
        provider_message_id: resendBody?.id || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', outboxRow.id)

    return new Response(
      JSON.stringify({ queued: true, sent: true, provider: 'resend', id: resendBody?.id || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('send-transactional-email error', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
