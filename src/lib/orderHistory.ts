import { format } from 'date-fns';

export type OrderLifecycleSnapshot = {
  order_number: string;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  group_buy_id?: string | null;
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

export const STANDARD_REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;
export const GROUP_BUY_REFUND_WINDOW_MS = 60 * 60 * 1000;
export const REFUND_WINDOW_STATUSES = new Set(['pending', 'payment_received', 'order_placed']);
const STANDARD_AUTO_CONFIRM_NOTE = 'The 48-hour refund request window elapsed; order automatically confirmed.';
const GROUP_BUY_AUTO_CONFIRM_NOTE = 'The 1-hour group-buy leave window elapsed; participation automatically confirmed.';

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

export function isGroupBuyOrder(order: Pick<OrderLifecycleSnapshot, 'group_buy_id'>) {
  return Boolean(order.group_buy_id);
}

export function getRefundWindowStart(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at'>,
) {
  return new Date(order.status === 'order_placed' ? order.updated_at || order.created_at : order.created_at);
}

export function getRefundWindowEnd(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at' | 'group_buy_id'>,
) {
  return new Date(
    getRefundWindowStart(order).getTime() +
      (isGroupBuyOrder(order) ? GROUP_BUY_REFUND_WINDOW_MS : STANDARD_REFUND_WINDOW_MS),
  );
}

export function getRefundWindowLabel(
  order: Pick<OrderLifecycleSnapshot, 'group_buy_id'>,
) {
  return isGroupBuyOrder(order) ? '1-hour group-buy join window' : '48-hour payment window';
}

export function getRefundAvailabilityLabel(
  order: Pick<OrderLifecycleSnapshot, 'group_buy_id'>,
) {
  return isGroupBuyOrder(order)
    ? 'Refund available during the 1-hour group-buy join window.'
    : 'Refund available during the 48-hour payment window.';
}

export function getAutoConfirmationTrackingNote(
  order: Pick<OrderLifecycleSnapshot, 'group_buy_id'>,
) {
  return isGroupBuyOrder(order) ? GROUP_BUY_AUTO_CONFIRM_NOTE : STANDARD_AUTO_CONFIRM_NOTE;
}

export function normalizeOrderTrackingNote(
  order: Pick<OrderLifecycleSnapshot, 'group_buy_id'>,
  note: string | null | undefined,
) {
  if (!note) {
    return null;
  }

  if (note === STANDARD_AUTO_CONFIRM_NOTE && isGroupBuyOrder(order)) {
    return GROUP_BUY_AUTO_CONFIRM_NOTE;
  }

  return note;
}

export function canRequestRefund(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at' | 'group_buy_id' | 'customer_confirmed_at'>,
  now = Date.now(),
) {
  return (
    REFUND_WINDOW_STATUSES.has(order.status || '') &&
    !isDeliveredOrder(order) &&
    now < getRefundWindowEnd(order).getTime()
  );
}

export function getRefundButtonReason(
  order: Pick<OrderLifecycleSnapshot, 'status' | 'created_at' | 'updated_at' | 'group_buy_id' | 'customer_confirmed_at'>,
) {
  if (isDeliveredOrder(order)) {
    return 'Refund requests close once delivery is confirmed.';
  }

  if (!REFUND_WINDOW_STATUSES.has(order.status || '')) {
    return `Refund requests are only available during the ${getRefundWindowLabel(order)}.`;
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
