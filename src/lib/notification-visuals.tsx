import { Info, MessageCircle, Package, ShoppingBag, Tag, Users, Wallet } from 'lucide-react';

export function getNotificationIcon(type: string) {
  switch (type) {
    case 'order_status':
    case 'refund_status':
    case 'order':
      return <Package className="h-4 w-4" />;
    case 'new_order':
      return <ShoppingBag className="h-4 w-4" />;
    case 'promotion':
      return <Tag className="h-4 w-4" />;
    case 'message':
      return <MessageCircle className="h-4 w-4" />;
    case 'group_buy':
      return <Users className="h-4 w-4" />;
    case 'wallet':
      return <Wallet className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export function getNotificationColor(type: string) {
  switch (type) {
    case 'order_status':
    case 'refund_status':
    case 'order':
    case 'new_order':
    case 'promotion':
    case 'message':
    case 'group_buy':
    case 'wallet':
      return 'border border-primary/20 bg-primary/15 text-primary';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
