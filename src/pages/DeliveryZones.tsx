import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useCurrency } from '@/hooks/useCurrency';
import { MapPin, Clock, Truck, Plane, Ship } from 'lucide-react';

type ShippingType = Tables<'shipping_types'>;
type ShippingClass = Tables<'shipping_classes'> & {
  shipping_types: Pick<ShippingType, 'id' | 'name' | 'description'> | null;
};

function getShippingIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes('sea')) return Ship;
  if (normalized.includes('express')) return Truck;
  return Plane;
}

export default function DeliveryZones() {
  const { formatPrice } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: async () => {
      const [{ data: shippingTypes, error: typesError }, { data: shippingClasses, error: classesError }] = await Promise.all([
        supabase
          .from('shipping_types')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('shipping_classes')
          .select(`
            *,
            shipping_types!inner(id, name, description, is_active)
          `)
          .eq('is_active', true)
          .eq('shipping_types.is_active', true)
          .order('estimated_days_min')
          .order('name'),
      ]);

      if (typesError) throw typesError;
      if (classesError) throw classesError;

      return {
        shippingTypes: (shippingTypes || []) as ShippingType[],
        shippingClasses: (shippingClasses || []) as ShippingClass[],
      };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-8 flex items-start gap-3 sm:items-center">
          <MapPin className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground sm:text-3xl">Delivery Zones</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Live delivery options and estimated timelines based on the current shipping setup.
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(data?.shippingTypes || []).map((method) => {
            const Icon = getShippingIcon(method.name);
            return (
            <Card key={method.name}>
              <CardContent className="pt-6">
                <Icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground mb-1">{method.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {method.description || 'Available as an active shipping method at checkout.'}
                </p>
              </CardContent>
            </Card>
            );
          })}
          {!isLoading && (data?.shippingTypes.length || 0) === 0 && (
            <Card className="md:col-span-3">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No shipping methods are active right now. Add or enable them in the admin shipping settings.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Shipping Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading delivery options...</p>
            ) : (data?.shippingClasses.length || 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No active shipping classes are configured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data?.shippingClasses.map((shippingClass) => (
                <div
                  key={shippingClass.id}
                  className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{shippingClass.name}</p>
                      <Badge variant="secondary">
                        {shippingClass.shipping_types?.name || 'Shipping option'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {shippingClass.description || shippingClass.shipping_types?.description || 'Configured in the admin shipping dashboard.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {shippingClass.estimated_days_min}-{shippingClass.estimated_days_max} days
                    </div>
                    <Badge variant="outline">
                      {shippingClass.base_price != null
                        ? `From ${formatPrice(Number(shippingClass.base_price))}`
                        : 'Price shown at checkout'}
                    </Badge>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> Final delivery availability still depends on the products in your cart and the shipping rules assigned to them. The checkout page shows the exact options available for each order.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
