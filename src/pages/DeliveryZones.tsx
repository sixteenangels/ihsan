import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Truck, Plane, Ship } from 'lucide-react';

const deliveryZones = [
  { region: 'Greater Accra', city: 'Accra, Tema, Kasoa', days: '1-3 days', available: true, type: 'express' },
  { region: 'Ashanti', city: 'Kumasi, Obuasi', days: '2-4 days', available: true, type: 'standard' },
  { region: 'Western', city: 'Takoradi, Tarkwa', days: '3-5 days', available: true, type: 'standard' },
  { region: 'Central', city: 'Cape Coast, Winneba', days: '2-4 days', available: true, type: 'standard' },
  { region: 'Eastern', city: 'Koforidua, Nkawkaw', days: '2-4 days', available: true, type: 'standard' },
  { region: 'Volta', city: 'Ho, Keta', days: '3-5 days', available: true, type: 'standard' },
  { region: 'Northern', city: 'Tamale', days: '5-7 days', available: true, type: 'extended' },
  { region: 'Upper East', city: 'Bolgatanga', days: '5-8 days', available: true, type: 'extended' },
  { region: 'Upper West', city: 'Wa', days: '5-8 days', available: true, type: 'extended' },
  { region: 'Bono', city: 'Sunyani', days: '3-5 days', available: true, type: 'standard' },
  { region: 'Bono East', city: 'Techiman', days: '3-5 days', available: true, type: 'standard' },
  { region: 'Ahafo', city: 'Goaso', days: '4-6 days', available: true, type: 'extended' },
  { region: 'Savannah', city: 'Damongo', days: '6-9 days', available: true, type: 'extended' },
  { region: 'North East', city: 'Nalerigu', days: '6-9 days', available: true, type: 'extended' },
  { region: 'Oti', city: 'Dambai', days: '5-7 days', available: true, type: 'extended' },
  { region: 'Western North', city: 'Sefwi-Wiawso', days: '4-6 days', available: true, type: 'extended' },
];

const shippingMethods = [
  { icon: Plane, name: 'Air Express', desc: 'Fastest from origin country to Ghana. 7-14 days international + local delivery.', color: 'text-primary' },
  { icon: Ship, name: 'Sea Freight', desc: 'Most affordable for heavy/bulk items. 4-8 weeks international + local delivery.', color: 'text-blue-500' },
  { icon: Truck, name: 'Local Delivery', desc: 'After items arrive in Ghana, we deliver to your door.', color: 'text-green-500' },
];

export default function DeliveryZones() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <MapPin className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Delivery Zones</h1>
            <p className="text-muted-foreground">Where we deliver across Ghana and estimated times</p>
          </div>
        </div>

        {/* Shipping Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {shippingMethods.map((method) => (
            <Card key={method.name}>
              <CardContent className="pt-6">
                <method.icon className={`h-8 w-8 ${method.color} mb-3`} />
                <h3 className="font-semibold text-foreground mb-1">{method.name}</h3>
                <p className="text-sm text-muted-foreground">{method.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Zones Table */}
        <Card>
          <CardHeader>
            <CardTitle>All 16 Regions of Ghana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deliveryZones.map((zone) => (
                <div key={zone.region} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{zone.region}</p>
                    <p className="text-sm text-muted-foreground">{zone.city}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {zone.days}
                    </div>
                    <Badge variant={zone.type === 'express' ? 'default' : zone.type === 'standard' ? 'secondary' : 'outline'}>
                      {zone.type === 'express' ? 'Express' : zone.type === 'standard' ? 'Standard' : 'Extended'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info Note */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> Delivery times shown are for local delivery within Ghana after items have arrived from the origin country. International shipping times depend on the shipping method chosen at checkout (Air Express or Sea Freight). For remote areas, delivery may take additional 1-2 days.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
