import type { Notification } from '@/hooks/useNotifications';
import {
  type OfficialOrderTrackingStatus,
  formatOfficialOrderStatusLabel,
  getDefaultOrderTrackingNote,
  normalizeOrderTimelineStatus,
} from '@/lib/orderTrackingTimeline';

export const NOTIFICATIONS_SCROLL_KEY = 'ajyn_notifications_scroll_position';

export type NotificationFilter = 'all' | 'orders' | 'promotions' | 'system';

const BACKEND_FIELD_LINE =
  /^\s*(status|orderId|order_id|userId|user_id|notificationId|notification_id|groupBuyId|group_buy_id|productId|product_id)\s*:\s*.+$/gim;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const ORDER_STATUS_FOLLOW_UPS: Partial<Record<OfficialOrderTrackingStatus, string>> = {
  payment_received: "We'll notify you once your order has been reviewed and confirmed.",
  confirmed: "We'll keep you updated as your order moves to processing.",
  order_placed: "We'll notify you when your order starts processing.",
  order_processed: "We'll notify you when your package is shipped.",
  shipped: "We'll notify you when your package is in transit.",
  in_transit: "We'll notify you when your package arrives in Ghana.",
  in_ghana: "We'll notify you when your package is ready for final delivery.",
  processing: "We'll notify you when your package is ready for delivery.",
  ready_for_delivery: "We'll notify you once your package is handed to our delivery partner.",
  handed_to_courier: 'Please keep your phone nearby in case our delivery partner needs to contact you.',
  out_for_delivery: 'Please keep your phone nearby so delivery can be completed smoothly.',
  delivered: 'Thank you for shopping with AJYN.',
  cancelled: 'Contact support if you believe this cancellation was made in error.',
  refunded: 'Contact support if the refund does not appear on your original payment method.',
};

function getStringDataValue(data: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!data) return null;

  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusLabel(notification: Pick<Notification, 'data'>) {
  const status = getStringDataValue(notification.data, 'status', 'order_status');
  if (!status) return null;

  const officialStatus = normalizeOrderTimelineStatus(status);
  return officialStatus ? formatOfficialOrderStatusLabel(officialStatus) : titleCase(status);
}

function cleanCustomerText(value: string) {
  return value
    .replace(BACKEND_FIELD_LINE, '')
    .replace(UUID_PATTERN, '')
    .replace(/\b([a-z]+(?:_[a-z0-9]+)+)\b/gi, (match) => titleCase(match))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getNotificationDisplayTitle(notification: Pick<Notification, 'title' | 'type' | 'data'>) {
  const statusLabel = getStatusLabel(notification);
  let title = cleanCustomerText(notification.title || '');

  if (statusLabel && /order\s+status/i.test(title)) {
    title = title.replace(/(order\s+status\s*:?\s*)(.+)?/i, `Order Status: ${statusLabel}`);
  }

  if (!title && statusLabel) {
    title = `Order Status: ${statusLabel}`;
  }

  return title || 'Notification';
}

export function getNotificationDisplayMessage(notification: Pick<Notification, 'message' | 'type' | 'data'>) {
  const status = getStringDataValue(notification.data, 'status', 'order_status');
  const officialStatus = status ? normalizeOrderTimelineStatus(status) : null;
  const message = cleanCustomerText(notification.message || '');

  if (message) return message;
  if (officialStatus) return getDefaultOrderTrackingNote(officialStatus);

  return 'Open this notification for the latest AJYN update.';
}

export function getNotificationDetailParagraphs(notification: Pick<Notification, 'message' | 'type' | 'data'>) {
  const status = getStringDataValue(notification.data, 'status', 'order_status');
  const officialStatus = status ? normalizeOrderTimelineStatus(status) : null;
  const message = getNotificationDisplayMessage(notification);
  const paragraphs = message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const followUp = officialStatus ? ORDER_STATUS_FOLLOW_UPS[officialStatus] : null;

  if (followUp && !paragraphs.some((paragraph) => paragraph.toLowerCase() === followUp.toLowerCase())) {
    paragraphs.push(followUp);
  }

  return paragraphs.length > 0 ? paragraphs : ['Open this notification for the latest AJYN update.'];
}

export function isOrderNotification(notification: Pick<Notification, 'type' | 'data'>) {
  return (
    ['order_status', 'order', 'refund_status', 'new_order'].includes(notification.type) ||
    Boolean(getStringDataValue(notification.data, 'orderId', 'order_id'))
  );
}

export function getNotificationFilter(notification: Pick<Notification, 'type' | 'data'>): NotificationFilter {
  if (isOrderNotification(notification)) return 'orders';
  if (notification.type === 'promotion' || notification.type === 'product') return 'promotions';
  return 'system';
}

export function getNotificationEyebrow(notification: Pick<Notification, 'type' | 'data'>) {
  switch (notification.type) {
    case 'order_status':
    case 'order':
    case 'refund_status':
      return 'Order update';
    case 'new_order':
      return 'Order received';
    case 'promotion':
      return 'Promotion';
    case 'message':
      return 'Message';
    case 'group_buy':
      return 'Group buy update';
    case 'wallet':
      return 'Wallet update';
    default:
      return 'Notification';
  }
}
