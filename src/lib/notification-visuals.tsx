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
      return 'bg-[#321c0d] text-[#ff8a33] md:bg-primary/15 md:text-primary';
    case 'new_order':
      return 'bg-[#173021] text-green-400 md:bg-green-500/15 md:text-green-600 md:dark:text-green-400';
    case 'promotion':
      return 'bg-[#32250e] text-amber-300 md:bg-amber-500/15 md:text-amber-700 md:dark:text-amber-300';
    case 'message':
      return 'bg-[#10263a] text-blue-300 md:bg-blue-500/15 md:text-blue-700 md:dark:text-blue-300';
    case 'group_buy':
      return 'bg-[#321c0d] text-[#ff8a33] md:bg-primary/15 md:text-primary';
    case 'wallet':
      return 'bg-[#30260f] text-yellow-300 md:bg-yellow-500/15 md:text-yellow-700 md:dark:text-yellow-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
