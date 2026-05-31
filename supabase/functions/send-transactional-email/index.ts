import nodemailer from 'npm:nodemailer'
import { corsHeaders, createServiceSupabaseClient, jsonResponse, requireAdminOrInternalRequest } from '../_shared/auth.ts'

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

type EmailProvider = 'resend' | 'gmail_smtp'

const DEFAULT_FROM_ADDRESS = 'no-reply@ajyn.app'
const DEFAULT_FROM_NAME = 'AJYN'
const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function extractEmailAddress(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const angleAddress = trimmed.match(/<([^>]+)>/)?.[1]?.trim()
  const address = angleAddress || trimmed

  return EMAIL_ADDRESS_PATTERN.test(address) ? address : null
}

function buildBrandedFromAddress(input?: string | null, fallbackAddress?: string | null) {
  const fromName = Deno.env.get('EMAIL_FROM_NAME')?.trim() || DEFAULT_FROM_NAME
  const address =
    extractEmailAddress(input) ||
    extractEmailAddress(fallbackAddress) ||
    DEFAULT_FROM_ADDRESS

  return `${fromName} <${address}>`
}

async function updateOutboxStatus(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  id: string,
  input: {
    status: 'queued' | 'sent' | 'failed'
    providerMessageId?: string | null
    errorMessage?: string | null
    sentAt?: string | null
  },
) {
  await supabase
    .from('outgoing_emails')
    .update({
      status: input.status,
      provider_message_id: input.providerMessageId ?? null,
      error_message: input.errorMessage ?? null,
      sent_at: input.sentAt ?? null,
    })
    .eq('id', id)
}

async function sendWithResend(payload: EmailPayload, fromEmail: string, apiKey: string) {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    throw new Error(resendBody?.message || JSON.stringify(resendBody))
  }

  return {
    provider: 'resend' as const,
    providerMessageId: resendBody?.id || null,
  }
}

async function sendWithGmailSmtp(payload: EmailPayload, fromEmail: string) {
  const smtpHost = Deno.env.get('GMAIL_SMTP_HOST') || 'smtp.gmail.com'
  const smtpPort = Number(Deno.env.get('GMAIL_SMTP_PORT') || '465')
  const smtpUser = Deno.env.get('GMAIL_SMTP_USER')
  const smtpPass = Deno.env.get('GMAIL_SMTP_PASS')

  if (!smtpUser || !smtpPass) {
    throw new Error('GMAIL_SMTP_USER or GMAIL_SMTP_PASS is not configured')
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const result = await transporter.sendMail({
    from: fromEmail,
    replyTo: Deno.env.get('REPLY_TO_EMAIL') || fromEmail,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })

  return {
    provider: 'gmail_smtp' as const,
    providerMessageId: result.messageId || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createServiceSupabaseClient()

  try {
    const { actor, errorResponse } = await requireAdminOrInternalRequest(req, supabase)
    if (errorResponse) {
      return errorResponse
    }

    const payload = await req.json() as EmailPayload

    if (!payload.to || !payload.subject || !payload.html) {
      return jsonResponse({ error: 'Missing required fields: to, subject, html' }, 400)
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
        requested_by: actor?.id || payload.requestedBy || null,
        status: 'queued',
      })
      .select('id')
      .single()

    if (outboxError) throw outboxError

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resendFromEmail = buildBrandedFromAddress(Deno.env.get('FROM_EMAIL'))
    const gmailFromEmail = buildBrandedFromAddress(Deno.env.get('GMAIL_FROM_EMAIL'), Deno.env.get('GMAIL_SMTP_USER'))
    const providerPreference = (Deno.env.get('EMAIL_PROVIDER_PREFERENCE') || 'resend_first').toLowerCase()
    const gmailConfigured = Boolean(Deno.env.get('GMAIL_SMTP_USER') && Deno.env.get('GMAIL_SMTP_PASS'))
    const resendConfigured = Boolean(resendApiKey)

    const providerOrder: EmailProvider[] =
      providerPreference === 'gmail_first'
        ? ['gmail_smtp', 'resend']
        : providerPreference === 'gmail_only'
          ? ['gmail_smtp']
          : providerPreference === 'resend_only'
            ? ['resend']
            : ['resend', 'gmail_smtp']

    const availableProviders = providerOrder.filter((provider) => {
      if (provider === 'resend') return resendConfigured
      if (provider === 'gmail_smtp') return gmailConfigured
      return false
    })

    if (availableProviders.length === 0) {
      await updateOutboxStatus(supabase, outboxRow.id, {
        status: 'failed',
        errorMessage: 'No configured email providers. Set RESEND_API_KEY and/or Gmail SMTP secrets.',
      })

      return jsonResponse({ queued: false, sent: false, reason: 'Missing email provider configuration' })
    }

    const providerErrors: Array<{ provider: EmailProvider; error: string }> = []

    for (const provider of availableProviders) {
      try {
        const result = provider === 'resend'
          ? await sendWithResend(payload, resendFromEmail, resendApiKey!)
          : await sendWithGmailSmtp(payload, gmailFromEmail)

        await updateOutboxStatus(supabase, outboxRow.id, {
          status: 'sent',
          providerMessageId: result.providerMessageId,
          sentAt: new Date().toISOString(),
        })

        return jsonResponse({
          queued: true,
          sent: true,
          provider: result.provider,
          id: result.providerMessageId,
          attemptedProviders: availableProviders,
        })
      } catch (providerError) {
        const message = providerError instanceof Error ? providerError.message : 'Unknown provider error'
        providerErrors.push({ provider, error: message })
      }
    }

    await updateOutboxStatus(supabase, outboxRow.id, {
      status: 'failed',
      errorMessage: providerErrors.map((item) => `${item.provider}: ${item.error}`).join(' | '),
    })

    return jsonResponse({
      queued: true,
      sent: false,
      attemptedProviders: availableProviders,
      errors: providerErrors,
    }, 502)
  } catch (error) {
    console.error('send-transactional-email error', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
