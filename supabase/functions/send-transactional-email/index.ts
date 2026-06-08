import nodemailer from 'npm:nodemailer'
import { corsHeaders, createServiceSupabaseClient, jsonResponse, requireAdminOrInternalRequest } from '../_shared/auth.ts'

interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
  type?: string
  relatedEntityType?: string
  relatedEntityId?: string
  requestedBy?: string
}

type EmailProvider = 'resend' | 'gmail_smtp'

const DEFAULT_FROM_ADDRESS = 'no-reply@ajynworld.com'
const DEFAULT_FROM_NAME = 'AJYN'
const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const EMAIL_REDACTION = '[email redacted]'

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

function normalizeEmail(value?: string | null) {
  return extractEmailAddress(value)?.toLowerCase() || null
}

function redactEmailAddresses(value: string) {
  return value.replace(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g, EMAIL_REDACTION)
}

function isSmtpLoginAddress(value?: string | null) {
  const smtpUser = normalizeEmail(Deno.env.get('GMAIL_SMTP_USER'))
  const address = normalizeEmail(value)

  return Boolean(smtpUser && address && smtpUser === address)
}

function canUseGmailFromAddress(fromEmail: string) {
  const smtpUser = normalizeEmail(Deno.env.get('GMAIL_SMTP_USER'))
  const requestedFrom = normalizeEmail(fromEmail)
  const allowSendAsAlias = Deno.env.get('GMAIL_ALLOW_SEND_AS_ALIAS') === 'true'

  if (!smtpUser || !requestedFrom) return false
  if (smtpUser === requestedFrom) return false

  return allowSendAsAlias
}

function buildSafeReplyToAddress(fromEmail: string) {
  const configuredReplyTo = Deno.env.get('REPLY_TO_EMAIL') || 'support@ajynworld.com'
  if (!configuredReplyTo || isSmtpLoginAddress(configuredReplyTo)) {
    return fromEmail
  }

  return buildBrandedFromAddress(configuredReplyTo, fromEmail)
}

function sanitizeCustomHeaders(headers?: Record<string, string>) {
  if (!headers) return undefined

  const sanitized = Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key.trim(), String(value).trim()] as const)
      .filter(([key, value]) => key && value && !/[\r\n]/.test(key) && !/[\r\n]/.test(value)),
  )

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function normalizeEmailHtmlForClients(html: string) {
  const lightLockedColors = ['#ffffff', '#f7f4f2', '#f8f4f1', '#f2e9e1']
  const darkInkLockedColors = ['#111111', '#202124']

  const withoutLightBackgroundLocks = lightLockedColors.reduce((output, color) => {
    const escapedColor = color.replace('#', '\\#')
    const lockPattern = new RegExp(
      `\\s*background-image\\s*:\\s*linear-gradient\\(\\s*${escapedColor}\\s*,\\s*${escapedColor}\\s*\\)\\s*!important\\s*;?`,
      'gi',
    )
    const inlineLockPattern = new RegExp(
      `\\s*background-image\\s*:\\s*linear-gradient\\(\\s*${escapedColor}\\s*,\\s*${escapedColor}\\s*\\)\\s*;?`,
      'gi',
    )

    return output.replace(lockPattern, '').replace(inlineLockPattern, '')
  }, html)

  return darkInkLockedColors
    .reduce((output, color) => {
      const escapedColor = color.replace('#', '\\#')
      const textFillPattern = new RegExp(
        `\\s*-webkit-text-fill-color\\s*:\\s*${escapedColor}\\s*!important\\s*;?`,
        'gi',
      )
      const inlineTextFillPattern = new RegExp(
        `\\s*-webkit-text-fill-color\\s*:\\s*${escapedColor}\\s*;?`,
        'gi',
      )
      const colorPattern = new RegExp(
        `\\s*color\\s*:\\s*${escapedColor}\\s*!important\\s*;?`,
        'gi',
      )
      const inlineColorPattern = new RegExp(
        `\\s*color\\s*:\\s*${escapedColor}\\s*;?`,
        'gi',
      )
      const fillPattern = new RegExp(
        `\\s*fill\\s*:\\s*${escapedColor}\\s*!important\\s*;?`,
        'gi',
      )
      const strokePattern = new RegExp(
        `\\s*stroke\\s*:\\s*${escapedColor}\\s*!important\\s*;?`,
        'gi',
      )

      return output
        .replace(textFillPattern, '')
        .replace(inlineTextFillPattern, '')
        .replace(colorPattern, '')
        .replace(inlineColorPattern, '')
        .replace(fillPattern, '')
        .replace(strokePattern, '')
    }, withoutLightBackgroundLocks)
    .replace(/\sfill="#202124"/gi, ' fill="currentColor"')
    .replace(/\sstroke="#202124"/gi, ' stroke="currentColor"')
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
  const replyTo = buildBrandedFromAddress(payload.replyTo, buildSafeReplyToAddress(fromEmail))

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AJYN Supabase Edge Function',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text || undefined,
      reply_to: replyTo,
      headers: sanitizeCustomHeaders(payload.headers),
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
    replyTo: buildBrandedFromAddress(payload.replyTo, buildSafeReplyToAddress(fromEmail)),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    headers: sanitizeCustomHeaders(payload.headers),
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

    payload.html = normalizeEmailHtmlForClients(payload.html)

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
    const gmailFromInput = Deno.env.get('GMAIL_FROM_EMAIL')
    const gmailFromEmail = buildBrandedFromAddress(gmailFromInput)
    const providerPreference = (Deno.env.get('EMAIL_PROVIDER_PREFERENCE') || 'resend_first').toLowerCase()
    const gmailConfigured = Boolean(
      Deno.env.get('GMAIL_SMTP_USER') &&
      Deno.env.get('GMAIL_SMTP_PASS') &&
      gmailFromInput?.trim() &&
      canUseGmailFromAddress(gmailFromEmail),
    )
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
        errorMessage:
          'No safe email provider configured. Set RESEND_API_KEY for branded email, or configure Gmail SMTP with a verified branded send-as alias.',
      })

      return jsonResponse({
        queued: false,
        sent: false,
        reason:
          'No safe email provider configured. Gmail SMTP will not be used unless the visible sender is a verified branded send-as alias.',
      })
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
        const rawMessage = providerError instanceof Error ? providerError.message : 'Unknown provider error'
        const message = redactEmailAddresses(rawMessage)
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
    return jsonResponse({
      error: error instanceof Error ? redactEmailAddresses(error.message) : 'Unknown error',
    }, 500)
  }
})
