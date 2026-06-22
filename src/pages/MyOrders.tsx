import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Loader2,
  MapPinned,
  Package,
  ShoppingBag,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CompactOrderHistoryCard } from '@/components/orders/CompactOrderHistoryCard';
import { OrderReviewDialog } from '@/components/orders/OrderReviewDialog';
import { RefundRequestDialog } from '@/components/orders/RefundRequestDialog';
import { AfterSalesServiceDialog } from '@/components/support/AfterSalesServiceDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ensureAuthenticatedUser,
  fetchCustomerOrdersForUser,
  type CustomerOrder,
} from '@/lib/fetch-user-orders';
import { hasUnpaidDeferredShipping, getDeferredShippingStatusLabel } from '@/lib/deferredShipping';
import { PayDeferredShippingButton } from '@/components/orders/PayDeferredShippingButton';
import { canRequestRefund, getRefundAvailabilityLabel, getRefundButtonReason } from '@/lib/orderHistory';
import { reAddOrderItemsToCart } from '@/lib/reorderOrder';
import { toast } from 'sonner';

type Order = CustomerOrder;

const CUSTOMER_STATUS_TABS: ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
  statuses: readonly string[];
}> = [
  { value: 'all', label: 'All Orders', icon: Package, statuses: [] },
  {
    value: 'active',
    label: 'Active',
    icon: Truck,
    statuses: [
      'pending',
      'payment_received',
      'order_placed',
      'order_processed',
      'confirmed',
      'processing',
      'packed_for_delivery',
      'shipped',
      'in_transit',
    ],
  },
  {
    value: 'ready',
    label: 'Ready',
    icon: MapPinned,
    statuses: ['in_ghana', 'ready_for_delivery', 'handed_to_courier', 'out_for_delivery'],
  },
  { value: 'completed', label: 'Completed', icon: CheckCircle, statuses: ['delivered'] },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, statuses: ['cancelled', 'refunded'] },
] as const;

const REVIEW_PROMPT_DISMISSED_KEY = 'review_prompt_dismissed';
const REVIEW_PROMPT_DELAY_MS = 72 * 60 * 60 * 1000;

type ReviewDialogMode = 'manual' | 'prompt' | null;

export default function MyOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [reviewDialogOrder, setReviewDialogOrder] = useState<Order | null>(null);
  const [reviewDialogMode, setReviewDialogMode] = useState<ReviewDialogMode>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to view your orders');
      setLoading(false);
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const activeUser = user ?? (await ensureAuthenticatedUser());
      const mappedOrders = await fetchCustomerOrdersForUser(activeUser.id);
      setOrders(mappedOrders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load orders.';
      setLoadError(message);
      setOrders([]);

      if (/sign in again/i.test(message)) {
        toast.error(message);
        navigate('/auth');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!authLoading && user) {
      void fetchOrders();
    }
  }, [authLoading, fetchOrders, user]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    const tabConfig = CUSTOMER_STATUS_TABS.find((tab) => tab.value === activeTab);
    return tabConfig?.statuses?.includes(order.status || '');
  });

  const getOrderCountForTab = (tabValue: string) => {
    if (tabValue === 'all') return orders.length;

    const tabConfig = CUSTOMER_STATUS_TABS.find((tab) => tab.value === tabValue);
    return orders.filter((order) => tabConfig?.statuses?.includes(order.status || '')).length;
  };

  const handleTrackOrder = (order: Order) => {
    navigate(`/track-order/${order.id}`);
  };

  const handleBuyAgain = async (order: Order) => {
    try {
      const added = await reAddOrderItemsToCart(order, addToCart);
      toast.success(`Added ${added} item(s) to cart`);
      navigate('/cart');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not re-add items.');
    }
  };

  const handleConfirmDelivery = async (order: Order) => {
    if (!user) return;

    const { data, error } = await supabase.rpc('confirm_order_delivery' as never, {
      order_id_input: order.id,
    } as never);

    if (error) {
      toast.error('Failed to confirm delivery');
      return;
    }

    const confirmationRows = Array.isArray(data) ? data : [];
    const confirmedAt =
      confirmationRows[0] &&
      typeof confirmationRows[0] === 'object' &&
      'confirmed_at' in confirmationRows[0]
        ? String((confirmationRows[0] as { confirmed_at: string }).confirmed_at)
        : new Date().toISOString();
    toast.success('Delivery confirmed!');
    await fetchOrders();
    setReviewDialogOrder({ ...order, status: 'delivered', customer_confirmed_at: confirmedAt });
    setReviewDialogMode('manual');
  };

  useEffect(() => {
    if (!user || orders.length === 0 || reviewDialogOrder) return;

    let cancelled = false;

    (async () => {
      const deliveredOrders = orders.filter((order) => order.status === 'delivered');
      if (deliveredOrders.length === 0) return;

      const orderIds = deliveredOrders.map((order) => order.id);
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('order_id')
        .in('order_id', orderIds)
        .eq('user_id', user.id);

      if (cancelled) return;

      const reviewedOrderIds = new Set((existingReviews || []).map((review) => review.order_id));
      const dismissed: string[] = JSON.parse(localStorage.getItem(REVIEW_PROMPT_DISMISSED_KEY) || '[]');
      const now = Date.now();

      const eligibleOrder = deliveredOrders.find((order) => {
        if (reviewedOrderIds.has(order.id)) return false;
        if (dismissed.includes(order.id)) return false;

        const deliveryAge = now - new Date(order.updated_at || order.created_at).getTime();
        return deliveryAge >= REVIEW_PROMPT_DELAY_MS;
      });

      if (eligibleOrder) {
        setReviewDialogOrder(eligibleOrder);
        setReviewDialogMode('prompt');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orders, reviewDialogOrder, user]);

  const openManualReview = (order: Order) => {
    setReviewDialogOrder(order);
    setReviewDialogMode('manual');
  };

  const closeReviewDialog = (open: boolean) => {
    if (open) return;
    setReviewDialogOrder(null);
    setReviewDialogMode(null);
  };

  const dismissReviewPrompt = () => {
    if (reviewDialogMode === 'prompt' && reviewDialogOrder) {
      const dismissed: string[] = JSON.parse(localStorage.getItem(REVIEW_PROMPT_DISMISSED_KEY) || '[]');
      if (!dismissed.includes(reviewDialogOrder.id)) {
        dismissed.push(reviewDialogOrder.id);
        localStorage.setItem(REVIEW_PROMPT_DISMISSED_KEY, JSON.stringify(dismissed));
      }
    }

    setReviewDialogOrder(null);
    setReviewDialogMode(null);
  };

  if (authLoading || (loading && user)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-3 py-16 pb-28 sm:px-6 md:pb-8">
          <div className="flex items-center justify-center gap-3 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading orders...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground md:text-3xl">My Orders</h1>
          </div>
          <Link to="/products">
            <Button variant="outline" className="w-full sm:w-auto">
              Continue Shopping
            </Button>
          </Link>
        </div>

        {loadError ? (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchOrders()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="mobile-scroll-pills mb-5 w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto gap-1 p-1.5">
              {CUSTOMER_STATUS_TABS.map((tab) => {
                const Icon = tab.icon;
                const count = getOrderCountForTab(tab.value);

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value={activeTab}>
            {filteredOrders.length === 0 ? (
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="px-5 py-16 text-center sm:px-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">No orders found</h3>
                  <p className="mb-6 text-muted-foreground">
                    {activeTab === 'all' ? "You haven't placed any orders yet." : `No ${activeTab} orders found.`}
                  </p>
                  <Link to="/products">
                    <Button className="h-11 rounded-xl">Start Shopping</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const refundOpen = canRequestRefund(order);
                  const refundReason = refundOpen
                    ? getRefundAvailabilityLabel(order)
                    : getRefundButtonReason(order);

                  return (
                    <CompactOrderHistoryCard
                      key={order.id}
                      order={order}
                      formatPrice={formatPrice}
                      onTrack={handleTrackOrder}
                      onConfirmDelivery={handleConfirmDelivery}
                      onReview={openManualReview}
                      onBuyAgain={handleBuyAgain}
                      afterSalesAction={
                        <AfterSalesServiceDialog
                          order={order}
                          triggerLabel="Request After-Sales Service"
                          className="h-9 w-full justify-center rounded-xl border-border/70 px-3 text-xs font-semibold"
                        />
                      }
                      refundAction={
                        <RefundRequestDialog
                          order={order}
                          canRequest={refundOpen}
                          disabledReason={refundReason}
                          triggerLabel="Refund"
                          className="h-8 w-full px-2 text-[11px] sm:text-xs"
                        />
                      }
                      footerSlot={
                        <div className="flex flex-col gap-2">
                          {order.group_buy_id ? (
                            <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-[0.12em]">
                              <Users className="mr-1 h-3 w-3" />
                              Group Buy
                            </Badge>
                          ) : null}
                          {getDeferredShippingStatusLabel(order) ? (
                            <Badge variant="outline" className="w-fit rounded-full text-[10px] uppercase tracking-[0.12em]">
                              {getDeferredShippingStatusLabel(order)}
                            </Badge>
                          ) : null}
                          {hasUnpaidDeferredShipping(order) ? (
                            <PayDeferredShippingButton
                              orderId={order.id}
                              orderNumber={order.order_number}
                              amount={Number(order.shipping_price || 0)}
                              formatPrice={formatPrice}
                              onPaid={() => void fetchOrders()}
                              className="h-9 w-full rounded-xl"
                            />
                          ) : null}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />

      <OrderReviewDialog
        open={!!reviewDialogOrder}
        order={reviewDialogOrder}
        onOpenChange={closeReviewDialog}
        onSubmitted={() => {
          setReviewDialogOrder(null);
          setReviewDialogMode(null);
        }}
        onLater={dismissReviewPrompt}
      />
    </div>
  );
}
