import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OrderTrackingMap } from '@/components/order/OrderTrackingMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Package, ArrowLeft, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchedOrderId, setSearchedOrderId] = useState<string | null>(orderId || null);

  const { data: order, isLoading, error } = useQuery({
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

      // Check if it's a UUID or order number
      if (searchedOrderId.startsWith('IHS-')) {
        query = query.eq('order_number', searchedOrderId);
      } else {
        query = query.eq('id', searchedOrderId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!searchedOrderId,
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold font-serif mb-6">Track Your Order</h1>

        {/* Search Form */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Enter order number (e.g., IHS-20251226-XXXXXXXX)"
                value={searchOrderNumber}
                onChange={(e) => setSearchOrderNumber(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
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
          <Card>
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Order {order.order_number}</CardTitle>
                  <Badge className={`${getStatusColor(order.status || '')} text-white`}>
                    {order.status?.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                    <p className="font-medium">
                      {(order.shipping_classes as any)?.name || 'Standard'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="font-medium">
                      {(order.order_items as any[])?.length || 0} items
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Map */}
            <OrderTrackingMap
              trackingPoints={(order.order_tracking as any[]) || []}
              orderStatus={order.status || 'pending'}
              estimatedDelivery={getEstimatedDelivery()}
            />

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(order.order_items as any[])?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        {item.variant_details && (
                          <p className="text-sm text-primary font-medium">{item.variant_details}</p>
                        )}
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium">{formatPrice(Number(item.total_price))}</p>
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
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <p className="font-medium">{(order.shipping_address as any).full_name}</p>
                    <p>{(order.shipping_address as any).address_line1}</p>
                    {(order.shipping_address as any).address_line2 && (
                      <p>{(order.shipping_address as any).address_line2}</p>
                    )}
                    <p>
                      {(order.shipping_address as any).city}, {(order.shipping_address as any).state} {(order.shipping_address as any).postal_code}
                    </p>
                    <p>{(order.shipping_address as any).country}</p>
                    <p className="mt-2 text-muted-foreground">{(order.shipping_address as any).phone}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!order && !isLoading && !error && searchedOrderId && (
          <Card>
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
          <Card>
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
    </div>
  );
}
