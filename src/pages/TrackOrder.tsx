import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OrderTrackingMap } from '@/components/order/OrderTrackingMap';
import { OrderReviewDialog } from '@/components/orders/OrderReviewDialog';
import { RefundRequestDialog } from '@/components/orders/RefundRequestDialog';
import { AfterSalesServiceDialog } from '@/components/support/AfterSalesServiceDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Package, ArrowLeft, Search, CheckCircle, Clock, Truck, RefreshCcw, ShoppingBag, Star } from 'lucide-react';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  canRequestRefund,
  getRefundAvailabilityLabel,
  getRefundButtonReason,
  isDeliveredOrder,
} from '@/lib/orderHistory';
import { reAddOrderItemsToCart } from '@/lib/reorderOrder';
import { getProofOfDeliverySignedUrl } from '@/lib/proof-of-delivery';

interface OrderTrackingItem {
  id: string;
  product_name: string;
  product_id: string | null;
  product_variant_id: string | null;
  variant_details: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
}

interface OrderTrackingPoint {
  id: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ShippingClassSummary {
  name: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

interface ReceiptSummary {
  id: string;
  receipt_number: string;
  generated_at: string;
}

interface TrackingShippingAddress {
  full_name: string;
  phone?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
}

interface TrackedOrder {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  payment_reference: string | null;
  total_amount: number;
  subtotal: number;
  shipping_price: number | null;
  status: string | null;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  shipping_address: TrackingShippingAddress | null;
  fulfillment_stage: string | null;
  courier_name: string | null;
  courier_tracking_number: string | null;
  delivery_fee: number | null;
  courier_confirmed_at: string | null;
  customer_confirmed_at: string | null;
  group_buy_id: string | null;
  proof_of_delivery_verification_code: string | null;
  proof_of_delivery_recipient_name: string | null;
  proof_of_delivery_relationship: string | null;
  proof_of_delivery_recipient_phone: string | null;
  proof_of_delivery_signature_name: string | null;
  proof_of_delivery_note: string | null;
  proof_of_delivery_image_url: string | null;
  user_id: string;
  wallet_credit_used: number | null;
  order_items: OrderTrackingItem[];
  order_tracking: OrderTrackingPoint[];
  shipping_classes: ShippingClassSummary | null;
  receipt: ReceiptSummary | null;
}

const STATUS_ORDER = [
  'pending',
  'payment_received',
  'order_placed',
  'order_processed',
  'confirmed',
  'processing',
  'packed_for_delivery',
  'shipped',
  'in_transit',
  'in_ghana',
  'ready_for_delivery',
  'handed_to_courier',
  'out_for_delivery',
  'delivered',
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  payment_received: 'Payment Received',
  order_placed: 'Order Placed',
  order_processed: 'Order Processed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed_for_delivery: 'Packed',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  in_ghana: 'In Ghana',
  ready_for_delivery: 'Ready',
  handed_to_courier: 'Courier Handoff',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

type TrackingCheckpoint = {
  key: string;
  label: string;
  detail: string;
};

const SIMPLIFIED_CHECKPOINTS: TrackingCheckpoint[] = [
  { key: 'payment_received', label: 'Payment', detail: 'Payment is confirmed.' },
  { key: 'processing', label: 'Processing', detail: 'Your order is being prepared.' },
  { key: 'in_transit', label: 'In Transit', detail: 'Your package is moving through the delivery route.' },
  { key: 'delivered', label: 'Delivered', detail: 'Delivery is complete.' },
];

function formatStatusLabel(status: string) {
  return STATUS_LABELS[status] || status.replaceAll('_', ' ');
}

function getStatusIndex(status: string) {
  return STATUS_ORDER.indexOf(status);
}

function getCheckpointsForTrackedOrder(order: TrackedOrder) {
  return SIMPLIFIED_CHECKPOINTS;
}

function getTrackingProgressState(order: TrackedOrder, checkpoints: TrackingCheckpoint[]) {
  const fallbackStatus = order.status || 'pending';

  if (['cancelled', 'refunded'].includes(fallbackStatus)) {
    return {
      displayStatus: fallbackStatus,
      progressValue: 100,
      completedCheckpointIndex: -1,
      currentCheckpointIndex: -1,
    };
  }

  const trackedStatuses = order.order_tracking
    .map((point) => point.status)
    .filter((status) => getStatusIndex(status) >= 0);

  const statusCandidates = [fallbackStatus, ...trackedStatuses];
  const furthestStatus = statusCandidates.reduce((furthest, candidate) => {
    return getStatusIndex(candidate) > getStatusIndex(furthest) ? candidate : furthest;
  }, fallbackStatus);

  const furthestStatusIndex = getStatusIndex(furthestStatus);
  const completedCheckpointIndex = checkpoints.reduce((furthestIndex, checkpoint, checkpointIndex) => {
    return getStatusIndex(checkpoint.key) <= furthestStatusIndex ? checkpointIndex : furthestIndex;
  }, -1);

  const currentCheckpointIndex =
    completedCheckpointIndex >= checkpoints.length - 1
      ? completedCheckpointIndex
      : completedCheckpointIndex + 1;

  const progressValue =
    completedCheckpointIndex >= 0
      ? Math.round(((completedCheckpointIndex + 1) / checkpoints.length) * 100)
      : 0;

  return {
    displayStatus: furthestStatus,
    progressValue,
    completedCheckpointIndex,
    currentCheckpointIndex,
  };
}

function getCheckpointState(
  checkpointIndex: number,
  completedCheckpointIndex: number,
  currentCheckpointIndex: number,
): 'done' | 'current' | 'pending' {
  if (completedCheckpointIndex < 0 && checkpointIndex === currentCheckpointIndex) return 'current';
  if (checkpointIndex <= completedCheckpointIndex) return 'done';
  if (checkpointIndex === currentCheckpointIndex) return 'current';
  return 'pending';
}

function OrderProgressPanel({ order }: { order: TrackedOrder }) {
  const checkpoints = getCheckpointsForTrackedOrder(order);
  const { displayStatus, progressValue, completedCheckpointIndex, currentCheckpointIndex } =
    getTrackingProgressState(order, checkpoints);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="px-5 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Truck className="h-5 w-5 text-primary" />
            Order Progress
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            {formatStatusLabel(displayStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-5 sm:px-6">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-full space-y-3">
            <Progress value={progressValue} className="h-2" />
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${checkpoints.length}, minmax(4.5rem, 1fr))` }}
            >
              {checkpoints.map((checkpoint, checkpointIndex) => {
                const state = getCheckpointState(
                  checkpointIndex,
                  completedCheckpointIndex,
                  currentCheckpointIndex,
                );
                return (
                  <div key={checkpoint.key} className="flex min-w-0 flex-col items-center text-center">
                    <div
                      className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full border ${
                        state === 'done'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : state === 'current'
                            ? 'border-primary bg-primary/10 text-primary ring-4 ring-primary/10'
                            : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {state === 'done' ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        state === 'done' || state === 'current' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {checkpoint.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchedOrderId, setSearchedOrderId] = useState<string | null>(orderId || null);
  const [reviewDialogOrder, setReviewDialogOrder] = useState<TrackedOrder | null>(null);

  const { data: order, isLoading, error, refetch } = useQuery<TrackedOrder | null>({
    queryKey: ['order-tracking', searchedOrderId],
    queryFn: async () => {
      if (!searchedOrderId) return null;

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            product_id,
            product_variant_id,
            variant_details,
            quantity,
            unit_price,
            total_price
          ),
          order_tracking (
            id,
            location_name,
            latitude,
            longitude,
            status,
            notes,
            created_at
          ),
          shipping_classes (
            name,
            estimated_days_min,
            estimated_days_max
          )
        `);

      // Check if it's a UUID or an Ajyn order number. Keep IHS for legacy receipts.
      const normalizedSearchOrderId = searchedOrderId.trim().toUpperCase();
      if (/^(AJYN|IHS)-/.test(normalizedSearchOrderId)) {
        query = query.eq('order_number', normalizedSearchOrderId);
      } else {
        query = query.eq('id', searchedOrderId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: receipt } = await supabase
        .from('receipts')
        .select('id, receipt_number, generated_at')
        .eq('order_id', data.id)
        .maybeSingle();

      const orderItems = (data.order_items || []) as OrderTrackingItem[];
      const directProductIds = [
        ...new Set(
          orderItems
            .map((item) => item.product_id)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      ];
      const variantIds = [
        ...new Set(
          orderItems
            .map((item) => item.product_variant_id)
            .filter((variantId): variantId is string => Boolean(variantId)),
        ),
      ];

      let variantProductMap = new Map<string, string>();
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('id', variantIds);

        variantProductMap = new Map(
          (variants || []).map((variant) => [variant.id, variant.product_id]),
        );
      }

      const imageProductIds = [
        ...new Set([
          ...directProductIds,
          ...variantIds
            .map((variantId) => variantProductMap.get(variantId))
            .filter((productId): productId is string => Boolean(productId)),
        ]),
      ];

      const productImageMap = new Map<string, string>();
      if (imageProductIds.length > 0) {
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url, order_index')
          .in('product_id', imageProductIds)
          .order('order_index', { ascending: true });

        (images || []).forEach((image) => {
          if (!productImageMap.has(image.product_id)) {
            productImageMap.set(image.product_id, image.image_url);
          }
        });
      }

      const orderItemsWithImages = orderItems.map((item) => {
        const resolvedProductId =
          item.product_id ||
          (item.product_variant_id ? variantProductMap.get(item.product_variant_id) || null : null);

        return {
          ...item,
          image_url: resolvedProductId ? productImageMap.get(resolvedProductId) || null : null,
        };
      });

      return {
        ...data,
        shipping_address: (data.shipping_address as unknown as TrackingShippingAddress | null) ?? null,
        order_items: orderItemsWithImages,
        order_tracking: [...((data.order_tracking || []) as OrderTrackingPoint[])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
        shipping_classes: (data.shipping_classes as ShippingClassSummary | null) ?? null,
        receipt: receipt || null,
      };
    },
    enabled: !!searchedOrderId,
  });

  const { data: proofOfDeliveryImageUrl } = useQuery({
    queryKey: ['proof-of-delivery-image', order?.id, order?.proof_of_delivery_image_url],
    queryFn: async () => getProofOfDeliverySignedUrl(order?.proof_of_delivery_image_url),
    enabled: !!order?.proof_of_delivery_image_url,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchOrderNumber.trim()) {
      setSearchedOrderId(searchOrderNumber.trim());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-500';
      case 'payment_received': return 'bg-green-600';
      case 'cancelled':
      case 'refunded': return 'bg-red-500';
      case 'out_for_delivery': return 'bg-blue-500';
      case 'ready_for_delivery': return 'bg-teal-500';
      case 'in_ghana': return 'bg-orange-600';
      case 'in_transit':
      case 'shipped': return 'bg-orange-500';
      case 'packed_for_delivery': return 'bg-purple-500';
      case 'order_placed':
      case 'confirmed':
      case 'processing': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  const getEstimatedDelivery = () => {
    if (!order?.estimated_delivery_start || !order?.estimated_delivery_end) return undefined;
    return `${format(new Date(order.estimated_delivery_start), 'MMM d')} - ${format(new Date(order.estimated_delivery_end), 'MMM d, yyyy')}`;
  };

  const canManageOrder = Boolean(user && order?.user_id === user.id);
  const delivered = order ? isDeliveredOrder(order) : false;
  const refundOpen = order ? canRequestRefund(order) : false;
  const refundReason = order
    ? refundOpen
      ? getRefundAvailabilityLabel(order)
      : getRefundButtonReason(order)
    : undefined;

  const handleBuyAgain = async () => {
    if (!order) return;

    try {
      const added = await reAddOrderItemsToCart(order, addToCart);
      toast.success(`Added ${added} item(s) to cart`);
      navigate('/cart');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not re-add items.');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order || !user) return;

    const { data, error: updateError } = await supabase.rpc('confirm_order_delivery' as never, {
      order_id_input: order.id,
    } as never);

    if (updateError) {
      toast.error('Failed to confirm delivery');
      return;
    }

    const confirmedAt =
      Array.isArray(data) && data[0] && typeof data[0] === 'object' && 'confirmed_at' in data[0]
        ? String((data[0] as { confirmed_at: string }).confirmed_at)
        : new Date().toISOString();
    toast.success('Delivery confirmed!');
    await refetch();
    setReviewDialogOrder({
      ...order,
      status: 'delivered',
      customer_confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 max-w-4xl px-3 py-5 pb-28 sm:px-6 md:py-8 md:pb-8">
        <Link to="/" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground sm:text-base">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <h1 className="mb-6 text-2xl font-bold font-serif sm:text-3xl">Track Your Order</h1>

        {/* Search Form */}
        <Card className="mb-5 rounded-2xl border-border/70 shadow-sm sm:mb-6">
          <CardContent className="p-3.5 sm:p-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Enter order number (e.g., AJYN-20260517-XXXXXXXX)"
                value={searchOrderNumber}
                onChange={(e) => setSearchOrderNumber(e.target.value)}
                className="h-11 flex-1 rounded-xl"
              />
              <Button type="submit" className="h-11 w-full rounded-xl sm:w-auto">
                <Search className="h-4 w-4 mr-2" />
                Track
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Order Not Found</h2>
              <p className="text-muted-foreground">
                We couldn't find an order with that number. Please check and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="break-all text-lg sm:text-xl">Order {order.order_number}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {order.receipt?.receipt_number ? (
                      <Link to={`/receipt/${order.receipt.receipt_number}?order=${encodeURIComponent(order.order_number)}`}>
                        <Button variant="outline" size="sm">Receipt</Button>
                      </Link>
                    ) : null}
                    <Badge className={`${getStatusColor(order.status || '')} text-white`}>
                      {order.status?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Order Date</p>
                    <p className="font-medium">
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-medium">{formatPrice(Number(order.total_amount))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Shipping Method</p>
                    <p className="font-medium">{order.shipping_classes?.name || 'Standard'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="font-medium">{order.order_items.length} items</p>
                  </div>
                </div>
                {(order.payment_reference || Number(order.wallet_credit_used || 0) > 0) && (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm md:grid-cols-2">
                    {order.payment_reference && (
                      <div>
                        <p className="text-muted-foreground">Payment Reference</p>
                        <p className="font-medium text-foreground">{order.payment_reference}</p>
                      </div>
                    )}
                    {Number(order.wallet_credit_used || 0) > 0 && (
                      <div>
                        <p className="text-muted-foreground">Wallet Credit Used</p>
                        <p className="font-medium text-foreground">
                          {formatPrice(Number(order.wallet_credit_used))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {canManageOrder && !delivered && (
                      <RefundRequestDialog
                        order={order}
                        canRequest={refundOpen}
                        disabledReason={refundReason}
                        triggerLabel="Refund"
                      />
                    )}
                    {canManageOrder && delivered && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setReviewDialogOrder(order)}
                          className="h-11 flex-1 rounded-xl px-4 sm:flex-none"
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                        <Button
                          onClick={handleBuyAgain}
                          className="h-11 flex-1 rounded-xl bg-orange-500 px-4 text-white hover:bg-orange-600 sm:flex-none"
                        >
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Buy Again
                        </Button>
                      </>
                    )}
                    {canManageOrder && !delivered && (
                      <Button
                        variant={order.status === 'out_for_delivery' ? 'default' : 'outline'}
                        onClick={handleConfirmDelivery}
                        disabled={order.status !== 'out_for_delivery'}
                        className="h-11 rounded-xl px-4"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirm Delivery
                      </Button>
                    )}
                  </div>
                  {canManageOrder && delivered ? (
                    <AfterSalesServiceDialog
                      order={order}
                      triggerLabel="Request After-Sales Service"
                      className="h-11 w-full justify-center rounded-xl border-border/70 px-4 text-sm font-semibold"
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <OrderProgressPanel order={order} />

            {/* Tracking Map */}
            <OrderTrackingMap
              trackingPoints={order.order_tracking}
              orderStatus={order.status || 'pending'}
              estimatedDelivery={getEstimatedDelivery()}
              groupBuyId={order.group_buy_id}
            />

            {/* Order Items */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-muted/30 p-3">
                      <div className="flex gap-3">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
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
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-medium">{item.product_name}</p>
                            <div className="sm:text-right">
                              <p className="font-medium">{formatPrice(Number(item.total_price))}</p>
                            </div>
                          </div>
                          {item.variant_details && (
                            <p className="mt-1 text-sm font-medium text-primary">{item.variant_details}</p>
                          )}
                          <p className="mt-1 text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <p className="text-muted-foreground">Subtotal</p>
                    <p>{formatPrice(Number(order.subtotal))}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-muted-foreground">Shipping</p>
                    <p>{formatPrice(Number(order.shipping_price || 0))}</p>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center font-semibold">
                    <p>Total</p>
                    <p className="text-primary">{formatPrice(Number(order.total_amount))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {order.shipping_address && (
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <p className="font-medium">{order.shipping_address.full_name}</p>
                    <p>{order.shipping_address.address_line1}</p>
                    {order.shipping_address.address_line2 && (
                      <p>{order.shipping_address.address_line2}</p>
                    )}
                    <p>
                      {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                    </p>
                    <p>{order.shipping_address.country}</p>
                    <p className="mt-2 text-muted-foreground">{order.shipping_address.phone}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Logistics Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Fulfillment stage:</span>{' '}
                  <span className="font-medium text-foreground">
                    {(order.fulfillment_stage || 'new').replaceAll('_', ' ')}
                  </span>
                </p>
                {order.courier_name && (
                  <p>
                    <span className="text-muted-foreground">Courier:</span>{' '}
                    <span className="font-medium text-foreground">{order.courier_name}</span>
                  </p>
                )}
                {order.courier_tracking_number && (
                  <p>
                    <span className="text-muted-foreground">Courier tracking #:</span>{' '}
                    <span className="font-medium text-foreground">{order.courier_tracking_number}</span>
                  </p>
                )}
                {order.delivery_fee != null && (
                  <p>
                    <span className="text-muted-foreground">Delivery fee on receipt:</span>{' '}
                    <span className="font-medium text-foreground">{formatPrice(Number(order.delivery_fee))}</span>
                  </p>
                )}
                {order.courier_confirmed_at && (
                  <p>
                    <span className="text-muted-foreground">Courier confirmed at:</span>{' '}
                    <span className="font-medium text-foreground">
                      {format(new Date(order.courier_confirmed_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </p>
                )}
                {order.customer_confirmed_at && (
                  <p>
                    <span className="text-muted-foreground">Customer confirmed at:</span>{' '}
                    <span className="font-medium text-foreground">
                      {format(new Date(order.customer_confirmed_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </p>
                )}
                {order.proof_of_delivery_verification_code && (
                  <p>
                    <span className="text-muted-foreground">Verification code:</span>{' '}
                    <span className="font-medium text-foreground">{order.proof_of_delivery_verification_code}</span>
                  </p>
                )}
                {order.proof_of_delivery_recipient_name && (
                  <p>
                    <span className="text-muted-foreground">Received by:</span>{' '}
                    <span className="font-medium text-foreground">
                      {order.proof_of_delivery_recipient_name}
                      {order.proof_of_delivery_relationship ? ` (${order.proof_of_delivery_relationship})` : ''}
                    </span>
                  </p>
                )}
                {order.proof_of_delivery_recipient_phone && (
                  <p>
                    <span className="text-muted-foreground">Recipient phone:</span>{' '}
                    <span className="font-medium text-foreground">{order.proof_of_delivery_recipient_phone}</span>
                  </p>
                )}
                {order.proof_of_delivery_signature_name && (
                  <p>
                    <span className="text-muted-foreground">Typed signature:</span>{' '}
                    <span className="font-medium text-foreground">{order.proof_of_delivery_signature_name}</span>
                  </p>
                )}
                {order.proof_of_delivery_note && (
                  <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
                    {order.proof_of_delivery_note}
                  </div>
                )}
                {proofOfDeliveryImageUrl && (
                  <img
                    src={proofOfDeliveryImageUrl}
                    alt={`Proof of delivery for ${order.order_number}`}
                    className="h-28 w-full max-w-[8rem] rounded-2xl border border-border object-cover"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!order && !isLoading && !error && searchedOrderId && (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Order Not Found</h2>
              <p className="text-muted-foreground">
                We couldn't find an order with that number. Please check and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {!searchedOrderId && (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Enter Your Order Number</h2>
              <p className="text-muted-foreground">
                Enter your order number above to track your delivery
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
      <OrderReviewDialog
        open={!!reviewDialogOrder}
        order={reviewDialogOrder}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialogOrder(null);
          }
        }}
        onSubmitted={() => setReviewDialogOrder(null)}
      />
    </div>
  );
}
