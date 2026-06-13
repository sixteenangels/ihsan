import { getCorsHeaders, createServiceSupabaseClient, jsonResponse, requireAuthenticatedActor } from '../_shared/auth.ts';

type CheckoutFlow = 'cart' | 'buy_now';

interface CheckoutItemInput {
  productId: string;
  productVariantId?: string | null;
  quantity: number;
}

interface CreateCheckoutOrderBody {
  flow?: CheckoutFlow;
  paymentReference?: string | null;
  items?: CheckoutItemInput[];
  shippingClassId?: string | null;
  addressId?: string | null;
  packagingChoice?: 'standard' | 'reinforced' | null;
  couponId?: string | null;
  loyaltyPointsToRedeem?: number | null;
  useWalletCredit?: boolean;
  recoverySnapshotId?: string | null;
  expectedTotal?: number | null;
}

interface ProductRow {
  id: string;
  name: string;
  base_price: number;
  is_active: boolean | null;
  is_free_shipping: boolean | null;
  is_fragile: boolean | null;
  reinforced_packaging_cost: number | null;
  allow_standard_packaging: boolean | null;
  allow_reinforced_packaging: boolean | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  price_override: number | null;
  stock: number | null;
  is_active: boolean | null;
}

interface CouponRow {
  id: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  min_order_amount: number | null;
  current_uses: number | null;
  max_uses: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  first_order_only: boolean | null;
}

interface ShippingClassRow {
  id: string;
  name: string;
  base_price: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean | null;
}

interface ShippingRuleRow {
  product_id: string;
  shipping_class_id: string;
  price: number | null;
  is_allowed: boolean | null;
  shipping_classes: ShippingClassRow | null;
}

interface StoreSettings {
  loyaltyEnabled: boolean;
  loyaltyPointsToCurrencyRate: number;
  loyaltyMinRedeemPoints: number;
  loyaltyPointsPerOrder: number;
  loyaltyMinOrderAmount: number;
  reinforcedPackagingCost: number;
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

  // Paystack can include customer-paid fees in `amount`; `requested_amount`
  // remains the amount AJYN asked Paystack to collect. Never accept underpayment.
  return (
    payment.requestedAmount === expectedAmount &&
    payment.amount != null &&
    payment.amount >= expectedAmount
  );
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function formatVariantLabel(variant: VariantRow | null) {
  if (!variant) return 'Standard option';
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard option';
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeItems(rawItems: CheckoutItemInput[], flow: CheckoutFlow) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('No checkout items were provided.');
  }

  const grouped = new Map<string, CheckoutItemInput>();

  for (const item of rawItems) {
    const productId = assertString(item.productId, 'Invalid checkout product.');
    const productVariantId =
      typeof item.productVariantId === 'string' && item.productVariantId.trim() !== ''
        ? item.productVariantId.trim()
        : null;
    const quantity = Math.floor(Number(item.quantity || 0));

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
      throw new Error('Invalid checkout quantity.');
    }

    const key = `${productId}:${productVariantId || 'standard'}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      grouped.set(key, { productId, productVariantId, quantity });
    }
  }

  const normalizedItems = [...grouped.values()];

  if (flow === 'buy_now') {
    const buyNowProductIds = new Set(normalizedItems.map((item) => item.productId));
    if (buyNowProductIds.size !== 1) {
      throw new Error('Buy Now can only create an order for one product.');
    }
  }

  return normalizedItems;
}

async function getStoreSettings(supabase: ReturnType<typeof createServiceSupabaseClient>) {
  const settings: StoreSettings = {
    loyaltyEnabled: true,
    loyaltyPointsToCurrencyRate: 0.01,
    loyaltyMinRedeemPoints: 100,
    loyaltyPointsPerOrder: 1,
    loyaltyMinOrderAmount: 0,
    reinforcedPackagingCost: 0,
  };

  const { data, error } = await supabase.from('store_settings').select('key, value');
  if (error) throw error;

  for (const row of data || []) {
    if (!(row.key in settings)) continue;
    const value = row.value;
    if (typeof value === 'boolean') {
      (settings as Record<string, unknown>)[row.key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      (settings as Record<string, unknown>)[row.key] = value;
    }
  }

  return settings;
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

  if (!metadataUserId && !customerEmail) {
    throw new Error('Payment could not be matched to a user.');
  }

  if (!metadataUserId && customerEmail && actorEmail && customerEmail !== actorEmail) {
    throw new Error('Payment does not belong to this user.');
  }

  return {
    verified: txn?.status === 'success',
    status: txn?.status || null,
    amount: toSubunitAmount(txn?.amount),
    currency: typeof txn?.currency === 'string' ? txn.currency : null,
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

    const body = (await req.json().catch(() => ({}))) as CreateCheckoutOrderBody;
    const flow: CheckoutFlow = body.flow === 'buy_now' ? 'buy_now' : 'cart';
    const items = normalizeItems(body.items || [], flow);
    const paymentReference =
      typeof body.paymentReference === 'string' && body.paymentReference.trim() !== ''
        ? body.paymentReference.trim()
        : null;
    const addressId = assertString(body.addressId, 'Choose a delivery address before payment.');
    const shippingClassId =
      typeof body.shippingClassId === 'string' && body.shippingClassId.trim() !== ''
        ? body.shippingClassId.trim()
        : null;
    const packagingChoice = body.packagingChoice === 'standard' ? 'standard' : 'reinforced';

    if (paymentReference) {
      const { data: existingOrder, error: existingError } = await supabase
        .from('orders')
        .select('id, user_id, order_number, total_amount')
        .eq('payment_reference', paymentReference)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingOrder) {
        if (existingOrder.user_id !== actor.id) {
          return jsonResponse({ error: 'Payment reference already belongs to another order.' }, 409, req);
        }

        const { count: itemCount, error: itemCountError } = await supabase
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', existingOrder.id);

        if (itemCountError) throw itemCountError;

        if ((itemCount || 0) > 0) {
          return jsonResponse({
            order: {
              id: existingOrder.id,
              order_number: existingOrder.order_number,
              total_amount: Number(existingOrder.total_amount || 0),
            },
            alreadyExists: true,
          }, 200, req);
        }

        await supabase.from('orders').delete().eq('id', existingOrder.id).eq('user_id', actor.id);
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [
      ...new Set(items.map((item) => item.productVariantId).filter((id): id is string => !!id)),
    ];

    const [{ data: products, error: productsError }, { data: allActiveVariants, error: variantsError }] =
      await Promise.all([
        supabase
          .from('products')
          .select(
            'id, name, base_price, is_active, is_free_shipping, is_fragile, reinforced_packaging_cost, allow_standard_packaging, allow_reinforced_packaging',
          )
          .in('id', productIds),
        supabase
          .from('product_variants')
          .select('id, product_id, color, size, price_override, stock, is_active')
          .in('product_id', productIds)
          .eq('is_active', true),
      ]);

    if (productsError) throw productsError;
    if (variantsError) throw variantsError;

    const productsById = new Map<string, ProductRow>();
    for (const product of (products || []) as ProductRow[]) {
      productsById.set(product.id, product);
    }

    const variantsById = new Map<string, VariantRow>();
    const activeVariantCountByProduct = new Map<string, number>();
    for (const variant of (allActiveVariants || []) as VariantRow[]) {
      variantsById.set(variant.id, variant);
      activeVariantCountByProduct.set(
        variant.product_id,
        (activeVariantCountByProduct.get(variant.product_id) || 0) + 1,
      );
    }

    const orderItems = [];
    let subtotal = 0;
    let hasFragileItems = false;
    const quantitiesByProduct = new Map<string, number>();

    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product || product.is_active === false) {
        throw new Error('One of the selected products is no longer available.');
      }

      const productRequiresVariant = (activeVariantCountByProduct.get(product.id) || 0) > 0;
      const variant = item.productVariantId ? variantsById.get(item.productVariantId) || null : null;

      if (productRequiresVariant && !variant) {
        throw new Error(`${product.name} requires a selected variant.`);
      }

      if (variant && variant.product_id !== product.id) {
        throw new Error('Selected variant does not belong to the product.');
      }

      if (variant?.stock != null && item.quantity > Number(variant.stock)) {
        throw new Error(`${product.name} does not have enough stock for this selection.`);
      }

      const unitPrice = toMoney(variant?.price_override ?? product.base_price);
      const lineTotal = toMoney(unitPrice * item.quantity);
      subtotal = toMoney(subtotal + lineTotal);
      quantitiesByProduct.set(product.id, (quantitiesByProduct.get(product.id) || 0) + item.quantity);

      if (product.is_fragile) {
        hasFragileItems = true;
        if (packagingChoice === 'standard' && product.allow_standard_packaging === false) {
          throw new Error(`${product.name} requires reinforced packaging.`);
        }

        if (packagingChoice === 'reinforced') {
          if (product.allow_reinforced_packaging === false) {
            throw new Error(`${product.name} does not support reinforced packaging.`);
          }
        }
      }

      orderItems.push({
        product_id: product.id,
        product_variant_id: variant?.id || null,
        product_name: product.name,
        variant_details: formatVariantLabel(variant),
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: lineTotal,
      });
    }

    const settings = await getStoreSettings(supabase);
    let fragilePackagingCost = 0;
    if (hasFragileItems && packagingChoice === 'reinforced') {
      for (const item of items) {
        const product = productsById.get(item.productId);
        if (product?.is_fragile) {
          const productPackagingCost =
            toMoney(product.reinforced_packaging_cost) > 0
              ? toMoney(product.reinforced_packaging_cost)
              : settings.reinforcedPackagingCost;
          fragilePackagingCost = toMoney(fragilePackagingCost + productPackagingCost * item.quantity);
        }
      }
    }

    let shippingPrice = 0;
    let shippingClass: ShippingClassRow | null = null;
    if (shippingClassId) {
      const { data: shippingRows, error: shippingError } = await supabase
        .from('product_shipping_rules')
        .select(
          'product_id, shipping_class_id, price, is_allowed, shipping_classes!inner(id, name, base_price, estimated_days_min, estimated_days_max, is_active)',
        )
        .in('product_id', productIds)
        .eq('shipping_class_id', shippingClassId)
        .eq('is_allowed', true)
        .eq('shipping_classes.is_active', true);

      if (shippingError) throw shippingError;

      const ruleByProduct = new Map<string, ShippingRuleRow>();
      for (const row of (shippingRows || []) as ShippingRuleRow[]) {
        ruleByProduct.set(row.product_id, row);
        shippingClass = row.shipping_classes;
      }

      for (const productId of productIds) {
        const product = productsById.get(productId)!;
        const rule = ruleByProduct.get(productId);
        if (!rule) {
          throw new Error('The selected shipping method is not available for all selected products.');
        }

        if (product.is_free_shipping) continue;
        const quantity = quantitiesByProduct.get(productId) || 0;
        const unitShipping = toMoney(rule.price ?? rule.shipping_classes?.base_price ?? 0);
        shippingPrice = toMoney(shippingPrice + unitShipping * quantity);
      }
    } else if (flow === 'cart') {
      throw new Error('Choose a shipping method before payment.');
    } else {
      const { data: availableRules, error: availableRulesError } = await supabase
        .from('product_shipping_rules')
        .select('id')
        .in('product_id', productIds)
        .eq('is_allowed', true)
        .limit(1);
      if (availableRulesError) throw availableRulesError;
      if ((availableRules || []).length > 0) {
        throw new Error('Choose a shipping method before payment.');
      }
    }

    const { data: address, error: addressError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', actor.id)
      .maybeSingle();

    if (addressError) throw addressError;
    if (!address) {
      throw new Error('Delivery address not found.');
    }

    if (!address.phone || !address.address_line1 || !address.city || !address.country) {
      throw new Error('Add complete delivery address details before payment.');
    }

    let discount = 0;
    let coupon: CouponRow | null = null;
    if (body.couponId) {
      const couponId = assertString(body.couponId, 'Invalid coupon.');
      const { data: couponData, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .maybeSingle();

      if (couponError) throw couponError;
      coupon = couponData as CouponRow | null;

      const now = new Date();
      if (!coupon || coupon.is_active === false) {
        throw new Error('Coupon is no longer available.');
      }
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        throw new Error('Coupon is not active yet.');
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        throw new Error('Coupon has expired.');
      }
      if (coupon.min_order_amount && subtotal < Number(coupon.min_order_amount)) {
        throw new Error('This order does not meet the coupon minimum.');
      }
      if (coupon.max_uses && Number(coupon.current_uses || 0) >= Number(coupon.max_uses)) {
        throw new Error('Coupon usage limit has been reached.');
      }
      if (coupon.first_order_only) {
        const { count, error: orderCountError } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', actor.id)
          .neq('status', 'cancelled');
        if (orderCountError) throw orderCountError;
        if ((count || 0) > 0) {
          throw new Error('This coupon is only available for first orders.');
        }
      }

      const { count: priorRedemptions, error: priorRedemptionError } = await supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('user_id', actor.id);
      if (priorRedemptionError) throw priorRedemptionError;
      if ((priorRedemptions || 0) > 0) {
        throw new Error('You have already used this coupon.');
      }

      discount =
        coupon.type === 'percentage'
          ? toMoney((subtotal * Number(coupon.value)) / 100)
          : toMoney(coupon.value);
    }

    const totalBeforeCredits = Math.max(
      0,
      toMoney(subtotal + shippingPrice + fragilePackagingCost - discount),
    );

    const requestedLoyaltyPoints = Math.max(
      0,
      Math.floor(Number(body.loyaltyPointsToRedeem || 0)),
    );
    const { data: loyaltyBalance, error: loyaltyError } = await supabase.rpc(
      'get_checkout_loyalty_balance',
      { p_user_id: actor.id },
    );
    if (loyaltyError) throw loyaltyError;

    const availablePoints = Math.max(0, Math.floor(Number(loyaltyBalance || 0)));
    const maxPointsByOrderValue =
      settings.loyaltyPointsToCurrencyRate > 0
        ? Math.floor(totalBeforeCredits / settings.loyaltyPointsToCurrencyRate)
        : 0;
    const maxRedeemablePoints = Math.max(0, Math.min(availablePoints, maxPointsByOrderValue));
    const loyaltyPointsApplied =
      requestedLoyaltyPoints >= settings.loyaltyMinRedeemPoints
        ? Math.min(requestedLoyaltyPoints, maxRedeemablePoints)
        : 0;

    if (requestedLoyaltyPoints > 0 && loyaltyPointsApplied !== requestedLoyaltyPoints) {
      throw new Error('Requested loyalty points are not available for this order.');
    }

    const loyaltyDiscount = toMoney(loyaltyPointsApplied * settings.loyaltyPointsToCurrencyRate);
    const subtotalAfterLoyalty = Math.max(0, toMoney(totalBeforeCredits - loyaltyDiscount));

    let walletApplied = 0;
    if (body.useWalletCredit) {
      const { data: walletBalance, error: walletError } = await supabase.rpc(
        'get_checkout_wallet_balance',
        { p_user_id: actor.id },
      );
      if (walletError) throw walletError;

      walletApplied = toMoney(Math.min(Math.max(0, Number(walletBalance || 0)), subtotalAfterLoyalty));
    }

    const total = Math.max(0, toMoney(subtotalAfterLoyalty - walletApplied));
    if (typeof body.expectedTotal === 'number' && Math.abs(toMoney(body.expectedTotal) - total) > 0.01) {
      throw new Error('Checkout totals changed. Please review before paying.');
    }

    if (total > 0 && !paymentReference) {
      throw new Error('Payment reference is required for this order.');
    }

    if (paymentReference) {
      const verification = await verifyPaystackPayment(paymentReference, actor);
      if (!verification.verified) {
        throw new Error('Payment could not be confirmed.');
      }
      if (verification.currency?.toUpperCase() !== 'GHS') {
        throw new Error('Payment currency mismatch.');
      }
      const expectedAmount = toCents(total);
      if (!isVerifiedPaymentAmountValid(verification, expectedAmount)) {
        console.error('Payment amount mismatch:', {
          reference: verification.reference,
          expectedAmount,
          paidAmount: verification.amount,
          requestedAmount: verification.requestedAmount,
          currency: verification.currency,
        });
        throw new Error('Payment amount mismatch.');
      }
    }

    const orderNumber = `AJYN-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const estimatedMin = Number(shippingClass?.estimated_days_min || 7);
    const estimatedMax = Number(shippingClass?.estimated_days_max || 14);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: actor.id,
        subtotal,
        shipping_price: shippingPrice,
        total_amount: total,
        shipping_class_id: shippingClassId,
        shipping_address: JSON.parse(JSON.stringify(address)),
        status: 'payment_received',
        payment_reference: paymentReference,
        notes:
          flow === 'buy_now'
            ? 'Instant checkout via Buy Now'
            : loyaltyPointsApplied > 0
              ? `Loyalty redeemed: ${loyaltyPointsApplied} points`
              : null,
        estimated_delivery_start: addDays(estimatedMin),
        estimated_delivery_end: addDays(estimatedMax),
        packaging_type: fragilePackagingCost > 0 ? packagingChoice : null,
        packaging_cost: fragilePackagingCost,
        wallet_credit_used: walletApplied,
      })
      .select('id, order_number, total_amount')
      .single();

    if (orderError) throw orderError;

    const cleanupIncompleteOrder = async () => {
      await supabase.from('order_tracking').delete().eq('order_id', order.id);
      await supabase.from('order_items').delete().eq('order_id', order.id);
      await supabase.from('orders').delete().eq('id', order.id).eq('user_id', actor.id);
    };

    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItems.map((item) => ({
        ...item,
        order_id: order.id,
      })),
    );
    if (itemsError) {
      await cleanupIncompleteOrder();
      throw itemsError;
    }

    const { error: trackingError } = await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'payment_received',
      location_name: paymentReference ? 'Payment Gateway' : 'Checkout',
      notes: "We've successfully received your payment and your order is now being prepared.",
    });
    if (trackingError) {
      await cleanupIncompleteOrder();
      throw trackingError;
    }

    if (walletApplied > 0) {
      const { error: walletError } = await supabase.from('wallet_transactions').insert({
        user_id: actor.id,
        amount: walletApplied,
        type: 'debit',
        description: `Used for order ${order.order_number}`,
        order_id: order.id,
        created_by: actor.id,
        reference_key: `order:${order.id}:wallet-debit`,
      });
      if (walletError) throw walletError;
    }

    if (loyaltyPointsApplied > 0) {
      const { error: loyaltyRedeemError } = await supabase.from('loyalty_points').insert({
        user_id: actor.id,
        points: loyaltyPointsApplied,
        type: 'redeem',
        description: `Order #${order.order_number} - redeemed ${loyaltyPointsApplied} points`,
        order_id: order.id,
      });
      if (loyaltyRedeemError) throw loyaltyRedeemError;
    }

    if (settings.loyaltyEnabled && total >= settings.loyaltyMinOrderAmount) {
      const pointsToAward = Math.floor(total * settings.loyaltyPointsPerOrder);
      if (pointsToAward > 0) {
        const { error: loyaltyAwardError } = await supabase.from('loyalty_points').insert({
          user_id: actor.id,
          points: pointsToAward,
          type: 'earn',
          description: `Order #${order.order_number} - ${pointsToAward} points earned`,
          order_id: order.id,
        });
        if (loyaltyAwardError) throw loyaltyAwardError;
      }
    }

    if (coupon) {
      const { error: redemptionError } = await supabase.rpc('mark_coupon_redeemed', {
        coupon_id_input: coupon.id,
        order_id_input: order.id,
        discount_amount_input: discount,
        user_id_input: actor.id,
      });
      if (redemptionError) throw redemptionError;
    }

    const recoveryPayload = {
      status: 'recovered',
      recovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (body.recoverySnapshotId) {
      await supabase
        .from('checkout_recovery_snapshots')
        .update(recoveryPayload)
        .eq('id', body.recoverySnapshotId)
        .eq('user_id', actor.id);
    } else {
      await supabase
        .from('checkout_recovery_snapshots')
        .update(recoveryPayload)
        .eq('user_id', actor.id)
        .eq('status', 'active');
    }

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager']);

    if (adminRoles?.length) {
      const { error: adminNotificationError } = await supabase.from('notifications').insert(
        adminRoles.map((role: { user_id: string }) => ({
          user_id: role.user_id,
          title: flow === 'buy_now' ? 'New Buy Now Order' : 'New Order Received',
          message: `Order ${order.order_number} - GHS ${toMoney(total).toFixed(2)} placed.`,
          type: 'new_order',
          data: { orderId: order.id, orderNumber: order.order_number, total, source: flow },
        })),
      );

      if (adminNotificationError) {
        console.error('Failed to notify admins about checkout order', adminNotificationError);
      }
    }

    return jsonResponse({
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: Number(order.total_amount || total),
      },
      alreadyExists: false,
    }, 200, req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not create checkout order.';
    console.error('create-checkout-order failed:', error);
    return jsonResponse({ error: message }, 400, req);
  }
});
