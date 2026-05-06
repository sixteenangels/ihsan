import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Truck, MapPin, Clock, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, Phone, CreditCard, ShoppingBag, PackageCheck, Plane, MapPinned, Ban, Users, Star, MessageSquare, Eye } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { OrderInvoice } from '@/components/orders/OrderInvoice';
import { RefundRequestDialog } from '@/components/orders/RefundRequestDialog';

interface OrderItem {
  id: string;
  product_name: string;
  variant_details: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_variant_id: string;
}

interface ShippingAddress {
  full_name: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
}

interface TrackingPoint {
  id: string;
  status: string;
  location_name: string;
  notes?: string;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  shipping_price: number;
  created_at: string;
  updated_at?: string;
  estimated_delivery_start: string;
  estimated_delivery_end: string;
  shipping_address: ShippingAddress | null;
  shipping_class_id: string | null;
  order_items: OrderItem[];
  order_tracking: TrackingPoint[];
}

const CUSTOMER_STATUS_TABS = [
  { value: 'all', label: 'All Orders', icon: Package },
  { value: 'active', label: 'Active', icon: Truck, statuses: ['pending', 'payment_received', 'order_placed', 'order_processed', 'confirmed', 'processing', 'packed_for_delivery', 'shipped', 'in_transit'] },
  { value: 'ready', label: 'Ready', icon: MapPinned, statuses: ['in_ghana', 'ready_for_delivery', 'handed_to_courier', 'out_for_delivery'] },
  { value: 'completed', label: 'Completed', icon: CheckCircle, statuses: ['delivered'] },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, statuses: ['cancelled', 'refunded'] },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  payment_received: { label: 'Payment Received', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  order_placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800', icon: Package },
  order_processed: { label: 'Order Processed', color: 'bg-blue-100 text-blue-800', icon: PackageCheck },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: Loader },
  packed_for_delivery: { label: 'Packed', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  in_ghana: { label: 'In Ghana', color: 'bg-orange-100 text-orange-800', icon: MapPin },
  ready_for_delivery: { label: 'Ready for Pickup', color: 'bg-teal-100 text-teal-800', icon: Package },
  handed_to_courier: { label: 'Handed to Courier', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-800', icon: XCircle },
};

// Standard (international) order checkpoints
const STANDARD_CHECKPOINTS = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'order_placed', label: 'Ordered' },
  { key: 'packed_for_delivery', label: 'Packed' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'in_ghana', label: 'In Ghana' },
  { key: 'ready_for_delivery', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
];

// Courier (Ready Now / local) order checkpoints
const COURIER_CHECKPOINTS = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'order_processed', label: 'Processed' },
  { key: 'handed_to_courier', label: 'Courier' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

// Check if shipping class name indicates courier
const COURIER_SHIPPING_NAME = 'standard courier';

function getCheckpointsForOrder(order: Order, shippingClassNames: Record<string, string>): typeof STANDARD_CHECKPOINTS {
  const shippingName = order.shipping_class_id ? shippingClassNames[order.shipping_class_id] : '';
  const isCourier = shippingName?.toLowerCase().includes('courier');
  // Also check if order uses courier statuses
  const hasCourierStatus = ['order_processed', 'handed_to_courier'].includes(order.status);
  return (isCourier || hasCourierStatus) ? COURIER_CHECKPOINTS : STANDARD_CHECKPOINTS;
}

function getProgressPercentage(status: string, checkpoints: typeof STANDARD_CHECKPOINTS): number {
  const keys = checkpoints.map(c => c.key);
  const idx = keys.indexOf(status);
  if (idx >= 0) return Math.round(((idx + 1) / keys.length) * 100);
  // Fallback: use standard order
  const allStatuses = [
    'pending', 'payment_received', 'order_placed', 'order_processed', 'confirmed', 'processing',
    'packed_for_delivery', 'shipped', 'in_transit', 'in_ghana',
    'ready_for_delivery', 'handed_to_courier', 'out_for_delivery', 'delivered',
  ];
  const allIdx = allStatuses.indexOf(status);
  if (allIdx < 0) return 0;
  // Map to closest checkpoint
  for (let i = keys.length - 1; i >= 0; i--) {
    if (allStatuses.indexOf(keys[i]) <= allIdx) {
      return Math.round(((i + 1) / keys.length) * 100);
    }
  }
  return 0;
}

function getCheckpointStatus(orderStatus: string, checkpointKey: string, checkpoints: typeof STANDARD_CHECKPOINTS): 'done' | 'current' | 'pending' {
  const allStatuses = [
    'pending', 'payment_received', 'order_placed', 'order_processed', 'confirmed', 'processing',
    'packed_for_delivery', 'shipped', 'in_transit', 'in_ghana',
    'ready_for_delivery', 'handed_to_courier', 'out_for_delivery', 'delivered',
  ];
  const orderIdx = allStatuses.indexOf(orderStatus);
  const checkIdx = allStatuses.indexOf(checkpointKey);
  if (checkIdx < 0 || orderIdx < 0) return 'pending';
  if (orderIdx >= checkIdx) return 'done';
  // Find the next checkpoint after current order status
  const keys = checkpoints.map(c => c.key);
  const currentCpIdx = keys.findIndex(k => allStatuses.indexOf(k) > orderIdx);
  if (currentCpIdx >= 0 && keys[currentCpIdx] === checkpointKey) return 'current';
  return 'pending';
}

// Generate auto notes for tracking entries
function getAutoNote(status: string, orderItems: OrderItem[]): string {
  const productName = orderItems[0]?.product_name || 'your order';
  switch (status) {
    case 'payment_received': return `We've received your payment for "${productName}". Thank you!`;
    case 'order_placed': return `Your order for "${productName}" has been placed successfully.`;
    case 'order_processed': return `Item verified and packed. Preparing for courier pickup.`;
    case 'confirmed': return `Your order has been confirmed and is being prepared.`;
    case 'processing': return `Your order is being processed.`;
    case 'packed_for_delivery': return `Your order has been packed and is ready for shipping.`;
    case 'shipped': return `Your order has been shipped!`;
    case 'in_transit': return `Your order is on its way.`;
    case 'in_ghana': return `Your order has arrived in Ghana!`;
    case 'ready_for_delivery': return `Your order is ready for pickup/delivery.`;
    case 'handed_to_courier': return `Courier has picked up your package.`;
    case 'out_for_delivery': return `Your order is on the way to your location.`;
    case 'delivered': return `Item received. Enjoy!`;
    case 'cancelled': return `Your order has been cancelled.`;
    case 'refunded': return `Your order has been refunded.`;
    default: return '';
  }
}

export default function MyOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [shippingClassNames, setShippingClassNames] = useState<Record<string, string>>({});
  const [reviewDialogOrder, setReviewDialogOrder] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please sign in to view your orders');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchShippingClasses();
    }
  }, [user]);

  const fetchShippingClasses = async () => {
    const { data } = await supabase.from('shipping_classes').select('id, name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(sc => { map[sc.id] = sc.name; });
      setShippingClassNames(map);
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        order_tracking (*)
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load orders');
    } else if (data) {
      const mappedOrders = data.map(order => ({
        ...order,
        shipping_address: order.shipping_address as unknown as ShippingAddress | null,
        order_tracking: (order.order_tracking || []).sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));
      setOrders(mappedOrders);

      // Fetch product images for order items
      const variantIds = data.flatMap(o => o.order_items?.map((i: any) => i.product_variant_id) || []);
      if (variantIds.length > 0) {
        const uniqueIds = [...new Set(variantIds)];
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('id', uniqueIds);
        
        if (variants) {
          const productIds = [...new Set(variants.map(v => v.product_id))];
          const { data: images } = await supabase
            .from('product_images')
            .select('product_id, image_url, order_index')
            .in('product_id', productIds)
            .order('order_index', { ascending: true });
          
          if (images) {
            const imgMap: Record<string, string> = {};
            const productImageMap: Record<string, string> = {};
            for (const img of images) {
              if (!productImageMap[img.product_id]) {
                productImageMap[img.product_id] = img.image_url;
              }
            }
            for (const v of variants) {
              if (productImageMap[v.product_id]) {
                imgMap[v.id] = productImageMap[v.product_id];
              }
            }
            setProductImages(imgMap);
          }
        }
      }
    }
    setLoading(false);
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    const tabConfig = CUSTOMER_STATUS_TABS.find(t => t.value === activeTab);
    return tabConfig?.statuses?.includes(order.status);
  });

  const getOrderCountForTab = (tabValue: string) => {
    if (tabValue === 'all') return orders.length;
    const tabConfig = CUSTOMER_STATUS_TABS.find(t => t.value === tabValue);
    return orders.filter(o => tabConfig?.statuses?.includes(o.status)).length;
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const toggleOrderExpansion = (orderId: string) => {
    setDetailsOrderId(detailsOrderId === orderId ? null : orderId);
  };

  const handleBuyAgain = async (order: Order) => {
    // Look up products + variants for each order item, then add to local cart
    const variantIds = order.order_items.map((i) => i.product_variant_id);
    if (variantIds.length === 0) return;

    const { data: variantRows } = await supabase
      .from('product_variants')
      .select('id, product_id, color, size, price_override, stock')
      .in('id', variantIds);

    if (!variantRows || variantRows.length === 0) {
      toast.error('Some products are no longer available.');
      return;
    }

    const productIds = [...new Set(variantRows.map((v) => v.product_id))];
    const { data: productRows } = await supabase
      .from('products')
      .select('id, name, description, base_price, is_group_buy_eligible, is_flash_deal, is_free_shipping, rating, review_count, product_images(image_url, order_index)')
      .in('id', productIds);

    if (!productRows) return;

    let added = 0;
    for (const item of order.order_items) {
      const variant = variantRows.find((v) => v.id === item.product_variant_id);
      if (!variant) continue;
      const productRow: any = productRows.find((p) => p.id === variant.product_id);
      if (!productRow) continue;
      const images = (productRow.product_images || [])
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((i: any) => i.image_url);
      const cartProduct = {
        id: productRow.id,
        name: productRow.name,
        description: productRow.description || '',
        category: '',
        basePrice: Number(productRow.base_price),
        images: images.length > 0 ? images : ['https://via.placeholder.com/400'],
        variants: [],
        shippingOptions: [],
        isGroupBuyEligible: !!productRow.is_group_buy_eligible,
        isFlashDeal: !!productRow.is_flash_deal,
        isFreeShippingEligible: !!productRow.is_free_shipping,
        rating: Number(productRow.rating) || 0,
        reviewCount: productRow.review_count || 0,
      };
      const cartVariant = {
        id: variant.id,
        size: variant.size || undefined,
        color: variant.color || undefined,
        price: variant.price_override != null ? Number(variant.price_override) : Number(productRow.base_price),
        stock: variant.stock || 0,
      };
      addToCart(cartProduct as any, cartVariant as any, item.quantity);
      added++;
    }
    if (added > 0) {
      toast.success(`Added ${added} item(s) to cart`);
      navigate('/cart');
    } else {
      toast.error('Could not re-add items.');
    }
  };

  const isCancelledStatus = (status: string) => ['cancelled', 'refunded'].includes(status);

  const handleConfirmDelivery = async (order: Order) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('user_id', user!.id);
    if (error) {
      toast.error('Failed to confirm delivery');
    } else {
      toast.success('Delivery confirmed!');
      fetchOrders();
      // Prompt to review
      setReviewDialogOrder(order);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewDialogOrder || !user) return;
    setReviewSubmitting(true);
    
    // Get product_id from order items via variant
    const variantId = reviewDialogOrder.order_items[0]?.product_variant_id;
    if (!variantId) { setReviewSubmitting(false); return; }
    
    const { data: variant } = await supabase
      .from('product_variants')
      .select('product_id')
      .eq('id', variantId)
      .single();
    
    if (!variant) { setReviewSubmitting(false); toast.error('Could not find product'); return; }
    
    const { error } = await supabase.from('reviews').insert({
      product_id: variant.product_id,
      user_id: user.id,
      rating: reviewRating,
      comment: reviewComment || null,
      is_verified: true,
      order_id: reviewDialogOrder.id,
    });
    
    if (error) {
      toast.error('Failed to submit review');
    } else {
      toast.success('Review submitted! It will appear after approval.');
    }
    setReviewSubmitting(false);
    setReviewDialogOrder(null);
    setReviewRating(5);
    setReviewComment('');
  };

  // Schedule a review prompt 72 hours after delivery confirmation.
  // Triggered when the orders list loads — checks for delivered orders without a review.
  useEffect(() => {
    if (!user || orders.length === 0) return;

    let cancelled = false;
    (async () => {
      const delivered = orders.filter((o) => o.status === 'delivered');
      if (delivered.length === 0) return;

      const orderIds = delivered.map((o) => o.id);
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('order_id')
        .in('order_id', orderIds)
        .eq('user_id', user.id);

      if (cancelled) return;
      const reviewedOrderIds = new Set((existingReviews || []).map((r) => r.order_id));

      const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
      const now = Date.now();
      const dismissedKey = `review_prompt_dismissed`;
      const dismissed: string[] = JSON.parse(localStorage.getItem(dismissedKey) || '[]');

      // Find first eligible delivered order not yet reviewed and >=72h old
      const eligible = delivered.find((o) => {
        if (reviewedOrderIds.has(o.id)) return false;
        if (dismissed.includes(o.id)) return false;
        const age = now - new Date(o.updated_at || o.created_at).getTime();
        return age >= SEVENTY_TWO_HOURS;
      });
      if (eligible && !reviewDialogOrder) {
        setReviewDialogOrder(eligible);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, user]);

  const dismissReviewPrompt = () => {
    if (reviewDialogOrder) {
      const key = 'review_prompt_dismissed';
      const dismissed: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!dismissed.includes(reviewDialogOrder.id)) {
        dismissed.push(reviewDialogOrder.id);
        localStorage.setItem(key, JSON.stringify(dismissed));
      }
    }
    setReviewDialogOrder(null);
    setReviewRating(5);
    setReviewComment('');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="text-center">Loading orders...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 pb-24 md:pb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-serif text-foreground mb-6">
          My Orders
        </h1>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full whitespace-nowrap mb-6">
            <TabsList className="inline-flex h-auto p-1 gap-1">
              {CUSTOMER_STATUS_TABS.map((tab) => {
                const Icon = tab.icon;
                const count = getOrderCountForTab(tab.value);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
                  <p className="text-muted-foreground mb-6">
                    {activeTab === 'all' 
                      ? "You haven't placed any orders yet."
                      : `No ${activeTab} orders found.`}
                  </p>
                  <Link to="/products">
                    <Button>Start Shopping</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const isExpanded = detailsOrderId === order.id;
                  const isCancelled = isCancelledStatus(order.status);
                  const checkpoints = getCheckpointsForOrder(order, shippingClassNames);
                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        {/* Order Header (not a button — actions live below) */}
                        <div className="p-4 bg-muted/50 border-b border-border">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {order.order_items[0] && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border bg-muted">
                                  {productImages[order.order_items[0].product_variant_id] ? (
                                    <img
                                      src={productImages[order.order_items[0].product_variant_id]}
                                      alt={order.order_items[0].product_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">
                                  {order.order_number}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(order.created_at).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                  })}
                                  {' · '}{order.order_items.length} item{order.order_items.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusBadge(order.status)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <p className="font-bold text-primary text-sm">
                              {formatPrice(order.total_amount)}
                            </p>
                            {(order as any).group_buy_id && (
                              <Badge className="bg-accent/10 text-accent-foreground gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                Group Buy
                              </Badge>
                            )}
                          </div>

                          {/* Quick action row — always visible */}
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleOrderExpansion(order.id)}
                              className="w-full"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              {isExpanded ? 'Hide' : 'Details'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBuyAgain(order)}
                              className="w-full"
                            >
                              <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                              Buy Again
                            </Button>
                            {order.status === 'delivered' ? (
                              <Button
                                size="sm"
                                onClick={() => setReviewDialogOrder(order)}
                                className="w-full"
                              >
                                <Star className="h-3.5 w-3.5 mr-1" />
                                Review
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConfirmDelivery(order)}
                                disabled={order.status !== 'out_for_delivery' && order.status !== 'ready_for_delivery'}
                                className="w-full"
                                title={
                                  order.status !== 'out_for_delivery' && order.status !== 'ready_for_delivery'
                                    ? 'Available once order is out for delivery'
                                    : undefined
                                }
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Confirm
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="p-4 space-y-4">
                            {/* Horizontal Progress Bar */}
                            {!isCancelled && (
                              <div className="space-y-3">
                                <Progress value={getProgressPercentage(order.status, checkpoints)} className="h-2" />
                                <div className="flex justify-between">
                                  {checkpoints.map((cp) => {
                                    const cpStatus = getCheckpointStatus(order.status, cp.key, checkpoints);
                                    return (
                                      <div key={cp.key} className="flex flex-col items-center flex-1">
                                        <div className={`w-3 h-3 rounded-full mb-1 ${
                                          cpStatus === 'done' ? 'bg-primary' :
                                          cpStatus === 'current' ? 'bg-primary/50 ring-2 ring-primary/30' :
                                          'bg-muted-foreground/20'
                                        }`} />
                                        <span className={`text-[10px] text-center leading-tight ${
                                          cpStatus === 'done' ? 'text-primary font-medium' :
                                          cpStatus === 'current' ? 'text-foreground' :
                                          'text-muted-foreground'
                                        }`}>
                                          {cp.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Vertical Timeline with Time | Status | Note */}
                            {!isCancelled && (
                              <div className="space-y-0">
                                <h4 className="text-sm font-semibold text-foreground mb-3">Status Updates</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border">
                                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium w-28">Time</th>
                                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium w-32">Status</th>
                                        <th className="text-left py-1.5 text-muted-foreground font-medium">Info</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {order.order_tracking.length > 0 ? (
                                        order.order_tracking.map((track, index) => (
                                          <tr key={track.id} className="border-b border-border/50">
                                            <td className="py-2 pr-3 text-muted-foreground align-top whitespace-nowrap">
                                              {format(new Date(track.created_at), 'MMM d h:mm a')}
                                            </td>
                                            <td className="py-2 pr-3 align-top">
                                              <span className={`font-medium ${index === order.order_tracking.length - 1 ? 'text-primary' : 'text-foreground'}`}>
                                                {statusConfig[track.status]?.label || track.status}
                                              </span>
                                            </td>
                                            <td className="py-2 text-muted-foreground align-top">
                                              {track.notes || getAutoNote(track.status, order.order_items)}
                                              {track.location_name && (
                                                <span className="block text-[10px] text-muted-foreground/60 mt-0.5">{track.location_name}</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        // Show current status as a single entry
                                        <tr className="border-b border-border/50">
                                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                            {format(new Date(order.created_at), 'MMM d h:mm a')}
                                          </td>
                                          <td className="py-2 pr-3">
                                            <span className="font-medium text-primary">
                                              {statusConfig[order.status]?.label || order.status}
                                            </span>
                                          </td>
                                          <td className="py-2 text-muted-foreground">
                                            {getAutoNote(order.status, order.order_items)}
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* Order Items with images */}
                            <div className="space-y-2">
                              {order.order_items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-border bg-muted">
                                    {productImages[item.product_variant_id] ? (
                                      <img
                                        src={productImages[item.product_variant_id]}
                                        alt={item.product_name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                                    {item.variant_details && (
                                      <p className="text-xs text-primary">{item.variant_details}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                  </div>
                                  <p className="font-semibold text-primary text-sm">{formatPrice(item.total_price)}</p>
                                </div>
                              ))}
                            </div>

                            {/* Delivery Info */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Truck className="h-3.5 w-3.5" />
                              {order.estimated_delivery_start && order.estimated_delivery_end ? (
                                <span>
                                  Est. delivery: {new Date(order.estimated_delivery_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {' - '}{new Date(order.estimated_delivery_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span>Delivery date pending</span>
                              )}
                            </div>

                            <Separator />

                            {/* Actions - Always visible, not hidden in dropdown */}
                            <div className="flex flex-wrap gap-2">
                              {order.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('orders')
                                      .update({ status: 'payment_received', updated_at: new Date().toISOString() })
                                      .eq('id', order.id)
                                      .eq('user_id', user!.id);
                                    if (error) toast.error('Failed to confirm payment');
                                    else { toast.success('Payment confirmed!'); fetchOrders(); }
                                  }}
                                >
                                  <CreditCard className="h-3.5 w-3.5 mr-1" />
                                  Confirm Payment
                                </Button>
                              )}
                              {(order.status === 'ready_for_delivery' || order.status === 'out_for_delivery') && (
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirmDelivery(order)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Confirm Delivery
                                </Button>
                              )}
                              {['pending', 'payment_received', 'order_placed'].includes(order.status) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={async () => {
                                    if (!confirm('Are you sure you want to cancel this order?')) return;
                                    const { error } = await supabase
                                      .from('orders')
                                      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                                      .eq('id', order.id)
                                      .eq('user_id', user!.id);
                                    if (error) toast.error('Failed to cancel order');
                                    else { toast.success('Order cancelled'); fetchOrders(); }
                                  }}
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  Cancel
                                </Button>
                              )}
                              <Link to={`/track-order/${order.id}`}>
                                <Button variant="outline" size="sm">
                                  <MapPin className="h-3.5 w-3.5 mr-1" />
                                  Track
                                </Button>
                              </Link>
                              <OrderInvoice order={order} />
                              
                              {/* Buy Again & Review - always visible for delivered */}
                              {order.status === 'delivered' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      toast.success('Items added to cart! Redirecting...');
                                      navigate('/cart');
                                    }}
                                  >
                                    <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                                    Buy Again
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReviewDialogOrder(order)}
                                  >
                                    <Star className="h-3.5 w-3.5 mr-1" />
                                    Leave Review
                                  </Button>
                                </>
                              )}
                            </div>

                            {/* Order Summary */}
                            <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{formatPrice(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Shipping</span>
                                <span>{formatPrice(order.shipping_price || 0)}</span>
                              </div>
                              <Separator className="my-1" />
                              <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span className="text-primary">{formatPrice(order.total_amount)}</span>
                              </div>
                            </div>

                            {/* Shipping Address */}
                            {order.shipping_address && (
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-primary" />
                                  Shipping Address
                                </h4>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <p className="font-medium text-foreground">{order.shipping_address.full_name}</p>
                                  <p>{order.shipping_address.address_line1}</p>
                                  <p>{order.shipping_address.city}{order.shipping_address.state && `, ${order.shipping_address.state}`}</p>
                                  <p>{order.shipping_address.country}</p>
                                  {order.shipping_address.phone && (
                                    <p className="flex items-center gap-1 mt-1">
                                      <Phone className="h-3 w-3" />
                                      {order.shipping_address.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />

      {/* Review Dialog */}
      <Dialog open={!!reviewDialogOrder} onOpenChange={(open) => !open && setReviewDialogOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How was your order?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rate your experience with {reviewDialogOrder?.order_items[0]?.product_name || 'this order'}
            </p>
            <div className="flex items-center gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 cursor-pointer transition-colors ${
                      star <= reviewRating
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div>
              <Label>Comment (optional)</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitReview} disabled={reviewSubmitting} className="flex-1">
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </Button>
              <Button variant="outline" onClick={() => setReviewDialogOrder(null)}>
                Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
