import { corsHeaders, createServiceSupabaseClient, jsonResponse, requireAuthenticatedActor } from '../_shared/auth.ts';

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('Live_Secret_Key');
    if (!secretKey) {
      return jsonResponse({ verified: false, error: 'Payment verification not configured' }, 500);
    }

    const supabase = createServiceSupabaseClient();
    const { actor, errorResponse } = await requireAuthenticatedActor(req, supabase);
    if (errorResponse || !actor) {
      return errorResponse!;
    }

    const { reference } = await req.json();
    if (!reference || typeof reference !== 'string') {
      return jsonResponse({ verified: false, error: 'Missing payment reference' }, 400);
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
      );
    }

    const txn = paystackData.data;
    const metadataUserId =
      typeof txn?.metadata?.user_id === 'string' ? txn.metadata.user_id : null;
    const customerEmail = normalizeEmail(txn?.customer?.email);
    const actorEmail = normalizeEmail(actor.email);

    if (metadataUserId && metadataUserId !== actor.id) {
      return jsonResponse({ verified: false, error: 'Payment does not belong to this user' }, 403);
    }

    if (!metadataUserId && !customerEmail) {
      return jsonResponse({ verified: false, error: 'Payment could not be matched to a user' }, 403);
    }

    if (!metadataUserId && customerEmail && actorEmail && customerEmail !== actorEmail) {
      return jsonResponse({ verified: false, error: 'Payment does not belong to this user' }, 403);
    }

    const verified = txn?.status === 'success';
    console.log(
      `Payment ${reference}: actor=${actor.id} status=${txn?.status} amount=${txn?.amount} currency=${txn?.currency}`,
    );

    return jsonResponse({
      verified,
      status: txn?.status || null,
      amount: typeof txn?.amount === 'number' ? txn.amount : null,
      currency: typeof txn?.currency === 'string' ? txn.currency : null,
      reference: typeof txn?.reference === 'string' ? txn.reference : reference,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying payment:', error);
    return jsonResponse({ verified: false, error: errorMessage }, 500);
  }
});
