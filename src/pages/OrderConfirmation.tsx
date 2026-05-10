import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Package, MapPin, Truck, Share2, Copy } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { RecommendedProductsSection } from '@/components/products/RecommendedProductsSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface ShippingAddress {
  full_name: string;
  address_line1: string;
  city: string;
  state?: string;
  country: string;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  shipping_address: ShippingAddress | null;
}

interface OrderProductSeed {
  product_id: string | null;
  product_variant_id: string | null;
}

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderProductIds, setOrderProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          product_variant_id
        )
      `)
      .eq('id', orderId)
      .single();

    if (data) {
      const orderItems = (data.order_items || []) as OrderProductSeed[];
      const directProductIds = orderItems
        .map((item) => item.product_id)
        .filter((productId): productId is string => Boolean(productId));
      const variantIds = orderItems
        .map((item) => item.product_variant_id)
        .filter((variantId): variantId is string => Boolean(variantId));
      let resolvedVariantProductIds: string[] = [];

      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, product_id')
          .in('id', variantIds);

        resolvedVariantProductIds =
          variants?.map((variant) => variant.product_id).filter(Boolean) || [];
      }

      setOrderProductIds([...new Set([...directProductIds, ...resolvedVariantProductIds])]);
      const { order_items: _orderItems, ...orderRow } = data;
      setOrder({
        ...orderRow,
        shipping_address: orderRow.shipping_address as unknown as ShippingAddress | null,
      });
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  const handleShareWhatsApp = () => {
    if (!order) return;
    const text = `I just placed an order on Ihsan! Order #${order.order_number} - ${formatPrice(order.total_amount)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-16 sm:px-6"><div className="text-center">Loading...</div></main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-16 sm:px-6"><div className="text-center">Order not found</div></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-10 pb-24 sm:px-6 sm:py-16 md:pb-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>

          <h1 className="mb-2 text-2xl font-bold font-serif text-foreground sm:text-3xl">Order Confirmed!</h1>
          <p className="mb-8 text-sm text-muted-foreground sm:text-base">
            Thank you for your order. We&apos;ve received your payment and will process your order shortly.
          </p>

          <Card className="mb-8 text-left">
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-semibold text-foreground">{order.order_number}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-semibold text-primary">{formatPrice(order.total_amount)}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Delivery Address</p>
                    <p className="font-medium text-foreground">{order.shipping_address?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.shipping_address?.address_line1}, {order.shipping_address?.city}
                      {order.shipping_address?.state && `, ${order.shipping_address.state}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{order.shipping_address?.country}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Estimated Delivery</p>
                    <p className="font-medium text-foreground">
                      {order.estimated_delivery_start && order.estimated_delivery_end ? (
                        <>
                          {new Date(order.estimated_delivery_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' - '}
                          {new Date(order.estimated_delivery_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </>
                      ) : (
                        'Delivery date pending'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardContent className="p-6">
              <h3 className="mb-3 flex items-center justify-center gap-2 font-semibold text-foreground">
                <Share2 className="h-5 w-5" />
                Share your order
              </h3>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="outline" onClick={handleShareWhatsApp} className="w-full sm:w-auto">
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="w-full sm:w-auto">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={`/track-order/${order.id}`}>
              <Button size="lg" className="w-full sm:w-auto">
                <Package className="mr-2 h-4 w-4" />
                Track Order
              </Button>
            </Link>
            <Link to="/my-orders">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">View All Orders</Button>
            </Link>
            <Link to="/products">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">Continue Shopping</Button>
            </Link>
          </div>

          <div className="mt-12 text-left">
            <RecommendedProductsSection
              title="Keep the order momentum going"
              description="Picked from the same shopping pattern so it is easy to add a follow-up order or share with someone else."
              seedProductIds={orderProductIds}
              excludeProductIds={orderProductIds}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
