import type { ReactNode } from 'react';
import { formatStoreDate } from '@/lib/date-utils';
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
  afterSalesAction?: ReactNode;
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

const actionButtonClassName = 'h-8 min-w-0 gap-1.5 rounded-lg px-2 text-[11px] font-semibold sm:text-xs';

export function CompactOrderHistoryCard({
  order,
  formatPrice,
  onTrack,
  onConfirmDelivery,
  onReview,
  onBuyAgain,
  afterSalesAction,
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
  const itemCountLabel = `${order.order_items.length} item${order.order_items.length > 1 ? 's' : ''}`;

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-sm ring-1 ring-white/5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:rounded-[1.35rem]',
        className,
      )}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.75rem_minmax(0,1fr)]">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted shadow-inner sm:h-[4.75rem] sm:w-[4.75rem]">
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
            <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-[15px]">
                  {primaryItem?.product_name || 'Order item'}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  <span className="text-foreground/80">Order Id:</span> {order.order_number}
                </p>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  'w-fit max-w-full shrink-0 justify-center rounded-md border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] min-[380px]:max-w-[6.75rem] sm:max-w-none sm:text-[9px]',
                  badgeStyle.badgeClassName,
                )}
              >
                <BadgeIcon className="mr-1 h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{formatCustomerOrderStatus(order.status)}</span>
              </Badge>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-[11px] text-muted-foreground">
                  {formatStoreDate(order.created_at)} - {itemCountLabel}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Delivery: <span className="font-medium text-foreground/80">{getDeliveryWindowLabel(order)}</span>
                </p>
                {additionalItems > 0 ? (
                  <p className="truncate text-[10px] text-muted-foreground">
                    +{additionalItems} more item{additionalItems > 1 ? 's' : ''}
                  </p>
                ) : null}
                {footerSlot ? <div className="flex flex-wrap gap-1.5 pt-0.5">{footerSlot}</div> : null}
              </div>

              <div className="min-w-[5.25rem] text-right">
                <p className="truncate text-xs font-bold text-foreground">{formatPrice(order.total_amount)}</p>
                <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{getOrderReference(order)}</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-3 gap-2">
            <Button
              size="sm"
              onClick={() => onTrack(order)}
              className={cn(actionButtonClassName, 'bg-primary text-primary-foreground hover:bg-primary/90')}
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
                className={cn(actionButtonClassName, 'bg-orange-500 text-white hover:bg-orange-600')}
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
            {delivered && afterSalesAction ? <div className="col-span-3">{afterSalesAction}</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
