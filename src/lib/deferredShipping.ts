export type DeferredShippingOrderFields = {
  shipping_payment_deferred?: boolean | null;
  shipping_price?: number | null;
  estimated_shipping_price?: number | null;
  shipping_fee_paid_at?: string | null;
};

export function hasUnpaidDeferredShipping(order: DeferredShippingOrderFields): boolean {
  return Boolean(
    order.shipping_payment_deferred &&
      Number(order.shipping_price || 0) > 0 &&
      !order.shipping_fee_paid_at,
  );
}

export function getDeferredShippingStatusLabel(order: DeferredShippingOrderFields): string | null {
  if (!order.shipping_payment_deferred) {
    return null;
  }

  if (order.shipping_fee_paid_at) {
    return 'Shipping paid';
  }

  if (Number(order.shipping_price || 0) > 0) {
    return 'Shipping payment due';
  }

  return 'Shipping fee pending admin quote';
}
