import type { ReactNode } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Clock3,
  Package,
  RefreshCcw,
  Search,
  ShoppingBag,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  canRequestRefund,
  formatCustomerOrderStatus,
  getDeliveryWindowLabel,
  getOrderReference,
  isDeliveredOrder,
} from '@/lib/orderHistory';
import { cn } from '@/lib/utils';

interface CompactOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  image_url?: string | null;
}

export interface CompactOrderHistoryOrder {
  id: string;
  order_number: string;
  status: string | null;
  total_amount: number;
  created_at: string;
  updated_at?: string | null;
  estimated_delivery_start?: string | null;
  estimated_delivery_end?: string | null;
  courier_tracking_number?: string | null;
  payment_reference?: string | null;
  customer_confirmed_at?: string | null;
  order_items: CompactOrderItem[];
}

interface CompactOrderHistoryCardProps {
  order: CompactOrderHistoryOrder;
  formatPrice: (amount: number) => string;
  onTrack: (order: CompactOrderHistoryOrder) => void;
  onConfirmDelivery?: (order: CompactOrderHistoryOrder) => void;
  onReview?: (order: CompactOrderHistoryOrder) => void;
  onBuyAgain?: (order: CompactOrderHistoryOrder) => void;
  refundAction?: ReactNode;
  footerSlot?: ReactNode;
  className?: string;
}

const STATUS_STYLES: Record<
  string,
  { badgeClassName: string; icon: typeof Clock3 }
> = {
  pending: { badgeClassName: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300', icon: Clock3 },
  payment_received: { badgeClassName: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2 },
  order_placed: { badgeClassName: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300', icon: Package },
  order_processed: { badgeClassName: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300', icon: Package },
  confirmed: { badgeClassName: 'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300', icon: CheckCircle2 },
  processing: { badgeClassName: 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300', icon: Clock3 },
  packed_for_delivery: { badgeClassName: 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/20 dark:text-fuchsia-300', icon: Package },
  shipped: { badgeClassName: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-300', icon: Truck },
  in_transit: { badgeClassName: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-300', icon: Truck },
  in_ghana: { badgeClassName: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300', icon: Truck },
  ready_for_delivery: { badgeClassName: 'bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-300', icon: Truck },
  handed_to_courier: { badgeClassName: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-300', icon: Truck },
  out_for_delivery: { badgeClassName: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20 dark:text-cyan-300', icon: Truck },
  delivered: { badgeClassName: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2 },
  refunded: { badgeClassName: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300', icon: XCircle },
  cancelled: { badgeClassName: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300', icon: XCircle },
};

const actionButtonClassName = 'h-8 min-w-0 gap-1.5 rounded-md px-2 text-[11px] font-medium sm:text-xs';

export function CompactOrderHistoryCard({
  order,
  formatPrice,
  onTrack,
  onConfirmDelivery,
  onReview,
  onBuyAgain,
  refundAction,
  footerSlot,
  className,
}: CompactOrderHistoryCardProps) {
  const primaryItem = order.order_items[0];
  const delivered = isDeliveredOrder(order);
  const refundOpen = canRequestRefund(order);
  const canConfirmDelivery = order.status === 'out_for_delivery';
  const badgeStyle = STATUS_STYLES[order.status || 'pending'] || STATUS_STYLES.pending;
  const BadgeIcon = badgeStyle.icon;
  const additionalItems = Math.max(order.order_items.length - 1, 0);

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md sm:rounded-3xl',
        className,
      )}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted sm:h-14 sm:w-14">
            {primaryItem?.image_url ? (
              <img
                src={primaryItem.image_url}
                alt={primaryItem.product_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-[15px]">
                  {primaryItem?.product_name || 'Order item'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {format(new Date(order.created_at), 'MMM d, yyyy')} - {order.order_items.length} item
                  {order.order_items.length > 1 ? 's' : ''}
                </p>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                  badgeStyle.badgeClassName,
                )}
              >
                <BadgeIcon className="mr-1 h-3 w-3" />
                {formatCustomerOrderStatus(order.status)}
              </Badge>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">Order ID</p>
                <p className="truncate font-medium text-foreground">{order.order_number}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">Reference</p>
                <p className="truncate font-medium text-foreground">{getOrderReference(order)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">Delivery</p>
                <p className="truncate font-medium text-foreground">{getDeliveryWindowLabel(order)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/75">Total</p>
                <p className="truncate font-semibold text-foreground">{formatPrice(order.total_amount)}</p>
              </div>
            </div>

            {additionalItems > 0 ? (
              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                +{additionalItems} more item{additionalItems > 1 ? 's' : ''} in this order
              </p>
            ) : null}

            {footerSlot ? <div className="mt-2 flex flex-wrap gap-2">{footerSlot}</div> : null}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTrack(order)}
                className={actionButtonClassName}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Track</span>
              </Button>

              {delivered ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReview?.(order)}
                  className={actionButtonClassName}
                  disabled={!onReview}
                >
                  <Star className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Review</span>
                </Button>
              ) : (
                refundAction || (
                  <Button variant="outline" size="sm" disabled className={actionButtonClassName}>
                    <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{refundOpen ? 'Refund' : 'Locked'}</span>
                  </Button>
                )
              )}

              {delivered ? (
                <Button
                  size="sm"
                  onClick={() => onBuyAgain?.(order)}
                  className={actionButtonClassName}
                  disabled={!onBuyAgain}
                >
                  <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Buy Again</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={canConfirmDelivery ? 'default' : 'outline'}
                  onClick={() => onConfirmDelivery?.(order)}
                  className={cn(
                    actionButtonClassName,
                    canConfirmDelivery && 'bg-emerald-600 text-white hover:bg-emerald-700',
                  )}
                  disabled={!onConfirmDelivery || !canConfirmDelivery}
                  title={
                    !canConfirmDelivery
                      ? 'Confirm delivery becomes available once your order is out for delivery.'
                      : undefined
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate sm:hidden">Confirm</span>
                  <span className="hidden sm:inline">Confirm Delivery</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
