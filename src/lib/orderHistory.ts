import { format } from 'date-fns';

export type OrderLifecycleSnapshot = {
  order_number: string;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  customer_confirmed_at?: string | null;
  courier_tracking_number?: string | null;
  payment_reference?: string | null;
  estimated_delivery_start?: string | null;
  estimated_delivery_end?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  payment_received: 'Payment Received',
  order_placed: 'Order Placed',
  order_processed: 'Processed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed_for_delivery: 'Packed',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  in_ghana: 'In Ghana',
  ready_for_delivery: 'Ready for Delivery',
  handed_to_courier: 'With Courier',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;
export const REFUND_WINDOW_STATUSES = new Set(['pending', 'payment_received', 'order_placed']);

export function formatCustomerOrderStatus(status: string | null | undefined) {
  if (!status) return 'Pending';
  return STATUS_LABELS[status] || status.replaceAll('_', ' ');
}

export function isCancelledOrderStatus(status: string | null | undefined) {
  return status === 'cancelled' || status === 'refunded';
}

export function isDeliveredOrder(order: Pick<OrderLifecycleSnapshot, 'status' | 'customer_confirmed_at'>) {
  return order.status === 'delivered' || Boolean(order.customer_confirmed_at);
}

export function getRefundWindowStart(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at'>,
) {
  return new Date(order.status === 'order_placed' ? order.updated_at || order.created_at : order.created_at);
}

export function getRefundWindowEnd(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at'>,
) {
  return new Date(getRefundWindowStart(order).getTime() + REFUND_WINDOW_MS);
}

export function canRequestRefund(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at' | 'customer_confirmed_at'>,
  now = Date.now(),
) {
  return (
    REFUND_WINDOW_STATUSES.has(order.status || '') &&
    !isDeliveredOrder(order) &&
    now < getRefundWindowEnd(order).getTime()
  );
}

export function getRefundButtonReason(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at' | 'customer_confirmed_at'>,
) {
  if (isDeliveredOrder(order)) {
    return 'Refund requests close once delivery is confirmed.';
  }

  if (!REFUND_WINDOW_STATUSES.has(order.status || '')) {
    return 'Refund requests are only available during the 48-hour payment window.';
  }

  return `Refund window closed on ${format(getRefundWindowEnd(order), 'MMM d, yyyy h:mm a')}.`;
}

export function getOrderReference(
  order: Pick<OrderLifecycleSnapshot, 'courier_tracking_number' | 'payment_reference'>,
) {
  return order.courier_tracking_number || order.payment_reference || 'Pending assignment';
}

export function getDeliveryWindowLabel(
  order: Pick<OrderLifecycleSnapshot, 'estimated_delivery_start' | 'estimated_delivery_end'>,
) {
  if (!order.estimated_delivery_start || !order.estimated_delivery_end) {
    return 'Pending';
  }

  return `${format(new Date(order.estimated_delivery_start), 'MMM d')} - ${format(
    new Date(order.estimated_delivery_end),
    'MMM d',
  )}`;
}
