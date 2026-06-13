import { getCorsHeaders, createServiceSupabaseClient, jsonResponse, requireAuthenticatedActor } from '../_shared/auth.ts';

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toSubunitAmount(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const secretKey = Deno.env.get('Live_Secret_Key');
    if (!secretKey) {
      return jsonResponse({ verified: false, error: 'Payment verification not configured' }, 500, req);
    }

    const supabase = createServiceSupabaseClient();
    const { actor, errorResponse } = await requireAuthenticatedActor(req, supabase);
    if (errorResponse || !actor) {
      return errorResponse!;
    }

    const { reference } = await req.json();
    if (!reference || typeof reference !== 'string') {
      return jsonResponse({ verified: false, error: 'Missing payment reference' }, 400, req);
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.status) {
      console.error('Paystack verify failed:', paystackData);
      return jsonResponse(
        {
          verified: false,
          error: paystackData.message || 'Verification failed',
        },
        200,
        req,
      );
    }

    const txn = paystackData.data;
    const metadataUserId =
      typeof txn?.metadata?.user_id === 'string' ? txn.metadata.user_id : null;
    const customerEmail = normalizeEmail(txn?.customer?.email);
    const actorEmail = normalizeEmail(actor.email);

    if (metadataUserId && metadataUserId !== actor.id) {
      return jsonResponse({ verified: false, error: 'Payment does not belong to this user' }, 403, req);
    }

    if (!metadataUserId && !customerEmail) {
      return jsonResponse({ verified: false, error: 'Payment could not be matched to a user' }, 403, req);
    }

    if (!metadataUserId && customerEmail && actorEmail && customerEmail !== actorEmail) {
      return jsonResponse({ verified: false, error: 'Payment does not belong to this user' }, 403, req);
    }

    const verified = txn?.status === 'success';
    const amount = toSubunitAmount(txn?.amount);
    const currency = typeof txn?.currency === 'string' ? txn.currency.toUpperCase() : 'GHS';

    if (verified && amount != null) {
      const { error: recordError } = await supabase
        .from('verified_paystack_payments')
        .upsert(
          {
            reference: typeof txn?.reference === 'string' ? txn.reference : reference,
            user_id: actor.id,
            amount_subunits: amount,
            currency,
            verified_at: new Date().toISOString(),
          },
          { onConflict: 'reference' },
        );

      if (recordError) {
        console.error('Failed to record verified payment:', recordError);
        return jsonResponse({ verified: false, error: 'Could not record verified payment' }, 500, req);
      }
    }

    console.log(
      `Payment ${reference}: actor=${actor.id} status=${txn?.status} amount=${txn?.amount} currency=${txn?.currency}`,
    );

    return jsonResponse({
      verified,
      status: txn?.status || null,
      amount,
      requestedAmount: toSubunitAmount(txn?.requested_amount),
      currency: typeof txn?.currency === 'string' ? txn.currency : null,
      reference: typeof txn?.reference === 'string' ? txn.reference : reference,
    }, 200, req);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying payment:', error);
    return jsonResponse({ verified: false, error: errorMessage }, 500, req);
  }
});
