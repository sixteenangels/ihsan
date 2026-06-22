import { getCorsHeaders, createServiceSupabaseClient, jsonResponse, requireAuthenticatedActor } from '../_shared/auth.ts';

interface PayDeferredShippingBody {
  orderId?: string;
  paymentReference?: string;
  expectedAmount?: number;
}

interface VerifiedPayment {
  amount: number | null;
  currency: string | null;
  reference: string;
  requestedAmount: number | null;
  status: string | null;
  verified: boolean;
}

function assertString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message);
  }

  return value.trim();
}

function toMoney(value: unknown) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function toCents(value: number) {
  return Math.round(toMoney(value) * 100);
}

function toSubunitAmount(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.round(numberValue);
}

function isVerifiedPaymentAmountValid(payment: VerifiedPayment, expectedAmount: number) {
  if (payment.amount === expectedAmount) return true;

  return (
    payment.requestedAmount === expectedAmount &&
    payment.amount != null &&
    payment.amount >= expectedAmount
  );
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function verifyPaystackPayment(
  reference: string,
  actor: { id: string; email?: string | null },
): Promise<VerifiedPayment> {
  const secretKey = Deno.env.get('Live_Secret_Key');
  if (!secretKey) {
    throw new Error('Payment verification is not configured.');
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
    console.error('Paystack verification failed:', paystackData);
    throw new Error(paystackData.message || 'Payment verification failed.');
  }

  const txn = paystackData.data;
  const metadataUserId =
    typeof txn?.metadata?.user_id === 'string' ? txn.metadata.user_id : null;
  const customerEmail = normalizeEmail(txn?.customer?.email);
  const actorEmail = normalizeEmail(actor.email);

  if (metadataUserId && metadataUserId !== actor.id) {
    throw new Error('Payment does not belong to this user.');
  }

  if (!metadataUserId && actorEmail && customerEmail && actorEmail !== customerEmail) {
    throw new Error('Payment email does not match your account.');
  }

  const status = typeof txn?.status === 'string' ? txn.status : null;
  const verified = status === 'success';

  return {
    verified,
    status,
    currency: typeof txn?.currency === 'string' ? txn.currency : null,
    amount: toSubunitAmount(txn?.amount),
    reference: typeof txn?.reference === 'string' ? txn.reference : reference,
    requestedAmount: toSubunitAmount(txn?.requested_amount),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { actor, errorResponse } = await requireAuthenticatedActor(req, supabase);
    if (errorResponse || !actor) {
      return errorResponse!;
    }

    const body = (await req.json().catch(() => ({}))) as PayDeferredShippingBody;
    const orderId = assertString(body.orderId, 'Order is required.');
    const paymentReference = assertString(body.paymentReference, 'Payment reference is required.');
    const expectedAmount = toMoney(body.expectedAmount);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, order_number, shipping_payment_deferred, shipping_price, shipping_fee_paid_at, shipping_payment_reference, status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order || order.user_id !== actor.id) {
      throw new Error('Order not found.');
    }

    if (!order.shipping_payment_deferred) {
      throw new Error('This order does not have deferred shipping.');
    }

    if (order.shipping_fee_paid_at) {
      return jsonResponse({ success: true, alreadyPaid: true, orderId: order.id }, 200, req);
    }

    const shippingDue = toMoney(order.shipping_price);
    if (shippingDue <= 0) {
      throw new Error('Shipping fee has not been set yet. Please wait for admin confirmation.');
    }

    if (expectedAmount > 0 && Math.abs(expectedAmount - shippingDue) > 0.01) {
      throw new Error('Shipping amount changed. Refresh and try again.');
    }

    const { data: existingPayment } = await supabase
      .from('orders')
      .select('id')
      .eq('shipping_payment_reference', paymentReference)
      .maybeSingle();

    if (existingPayment) {
      return jsonResponse({ success: true, alreadyPaid: true, orderId: order.id }, 200, req);
    }

    const verification = await verifyPaystackPayment(paymentReference, actor);
    if (!verification.verified) {
      throw new Error('Payment could not be confirmed.');
    }

    if (verification.currency?.toUpperCase() !== 'GHS') {
      throw new Error('Payment currency mismatch.');
    }

    const expectedCents = toCents(shippingDue);
    if (!isVerifiedPaymentAmountValid(verification, expectedCents)) {
      throw new Error('Payment amount mismatch.');
    }

    const paidAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_fee_paid_at: paidAt,
        shipping_payment_reference: paymentReference,
        updated_at: paidAt,
      })
      .eq('id', orderId)
      .eq('user_id', actor.id)
      .is('shipping_fee_paid_at', null);

    if (updateError) throw updateError;

    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: order.status || 'payment_received',
      location_name: 'Shipping Payment',
      notes: `Deferred shipping fee paid for order ${order.order_number}.`,
    });

    return jsonResponse({ success: true, orderId: order.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shipping payment failed.';
    return jsonResponse({ error: message }, 400, req);
  }
});
