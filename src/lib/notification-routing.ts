import type { Notification } from '@/hooks/useNotifications';

export interface NotificationTarget {
  href: string;
  label: string;
  kind: 'order' | 'group_buy' | 'product' | 'wallet' | 'promotion';
}

export function getNotificationDataValue(data: Record<string, unknown> | null | undefined, ...keys: string[]) {
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
  const orderId = getNotificationDataValue(notification.data, 'orderId', 'order_id');
  const groupBuyId = getNotificationDataValue(notification.data, 'groupBuyId', 'group_buy_id');
  const productId = getNotificationDataValue(notification.data, 'productId', 'product_id');

  switch (notification.type) {
    case 'order_status':
    case 'order':
    case 'refund_status':
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Track Order', kind: 'order' };
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy', kind: 'group_buy' };
      return null;
    case 'group_buy':
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy', kind: 'group_buy' };
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Track Order', kind: 'order' };
      return null;
    case 'product':
      if (productId) return { href: `/product/${productId}`, label: 'Open product', kind: 'product' };
      return null;
    case 'wallet':
      return { href: '/profile?tab=wallet', label: 'Open wallet', kind: 'wallet' };
    case 'promotion':
      return { href: '/products', label: 'Browse products', kind: 'promotion' };
    default:
      if (orderId) return { href: `/track-order/${orderId}`, label: 'Track Order', kind: 'order' };
      if (groupBuyId) return { href: `/group-buy/${groupBuyId}`, label: 'Open group buy', kind: 'group_buy' };
      if (productId) return { href: `/product/${productId}`, label: 'Open product', kind: 'product' };
      return null;
  }
}

export function buildNotificationDetailsHref(notificationId: string) {
  return `/notifications/${encodeURIComponent(notificationId)}`;
}
