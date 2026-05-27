import type { Notification } from '@/hooks/useNotifications';

export interface NotificationTarget {
  href: string;
  label: string;
}

function getDataValue(data: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!data) {
    return null;
  }

  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

export function getNotificationTarget(notification: Pick<Notification, 'type' | 'data'>): NotificationTarget | null {
  const orderId = getDataValue(notification.data, 'orderId', 'order_id');
  const groupBuyId = getDataValue(notification.data, 'groupBuyId', 'group_buy_id');
  const productId = getDataValue(notification.data, 'productId', 'product_id');

  switch (notification.type) {
    case 'order_status':
    case 'order':
    case 'refund_status':
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Open order' };
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy' };
      return null;
    case 'group_buy':
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy' };
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Open order' };
      return null;
    case 'product':
      if (productId) return { href: `/product/${productId}`, label: 'Open product' };
      return null;
    case 'wallet':
      return { href: '/profile?tab=wallet', label: 'Open wallet' };
    case 'promotion':
      return { href: '/products', label: 'Browse products' };
    default:
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Open order' };
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy' };
      if (productId) return { href: `/product/${productId}`, label: 'Open product' };
      return null;
  }
}

export function buildNotificationDetailsHref(notificationId: string) {
  return `/notifications?notification=${encodeURIComponent(notificationId)}`;
}
