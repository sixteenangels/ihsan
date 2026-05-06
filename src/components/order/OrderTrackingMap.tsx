import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, Truck, CheckCircle } from 'lucide-react';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different tracking points
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const originIcon = createCustomIcon('#22c55e'); // Green for origin
const currentIcon = createCustomIcon('#f97316'); // Orange for current location
const destinationIcon = createCustomIcon('#ef4444'); // Red for destination

interface TrackingPoint {
  id: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  notes: string | null;
}

interface OrderTrackingMapProps {
  trackingPoints: TrackingPoint[];
  orderStatus: string;
  estimatedDelivery?: string;
}

function MapBoundsUpdater({ points }: { points: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  
  return null;
}

export function OrderTrackingMap({ trackingPoints, orderStatus, estimatedDelivery }: OrderTrackingMapProps) {
  const validPoints = trackingPoints.filter(p => p.latitude && p.longitude);
  
  if (validPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Order Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-4" />
            <p>No tracking information available yet</p>
            <p className="text-sm">Check back later for updates</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const coordinates: [number, number][] = validPoints.map(p => [p.latitude!, p.longitude!]);
  const center: [number, number] = coordinates[coordinates.length - 1];
  const latestPoint = validPoints[validPoints.length - 1];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'bg-green-500';
      case 'out_for_delivery': return 'bg-blue-500';
      case 'in_transit': return 'bg-orange-500';
      case 'shipped': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'out_for_delivery': 
      case 'in_transit': 
      case 'shipped': return <Truck className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Order Tracking
          </CardTitle>
          <Badge className={`${getStatusColor(orderStatus)} text-white`}>
            {getStatusIcon(orderStatus)}
            <span className="ml-1 capitalize">{orderStatus.replace('_', ' ')}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        <div className="h-64 rounded-lg overflow-hidden border border-border">
          <MapContainer
            center={center}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater points={coordinates} />
            
            {/* Draw route line */}
            {coordinates.length > 1 && (
              <Polyline
                positions={coordinates}
                color="#f97316"
                weight={3}
                opacity={0.7}
                dashArray="10, 10"
              />
            )}
            
            {/* Markers for each tracking point */}
            {validPoints.map((point, index) => {
              const isFirst = index === 0;
              const isLast = index === validPoints.length - 1;
              const icon = isFirst ? originIcon : isLast ? currentIcon : createCustomIcon('#94a3b8');
              
              return (
                <Marker
                  key={point.id}
                  position={[point.latitude!, point.longitude!]}
                  icon={icon}
                >
                  <Popup>
                    <div className="p-1">
                      <p className="font-semibold">{point.location_name || 'Location'}</p>
                      <p className="text-sm text-muted-foreground">{point.status}</p>
                      {point.notes && <p className="text-sm mt-1">{point.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(point.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Current Status */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{latestPoint.location_name || 'In Transit'}</p>
              <p className="text-sm text-muted-foreground">{latestPoint.status}</p>
              {latestPoint.notes && (
                <p className="text-sm mt-1">{latestPoint.notes}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Updated: {new Date(latestPoint.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Tracking History */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Tracking History</h4>
          <div className="space-y-3">
            {validPoints.slice().reverse().map((point, index) => (
              <div key={point.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  {index < validPoints.length - 1 && (
                    <div className="w-0.5 h-full bg-muted-foreground/20 my-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium">{point.location_name || point.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(point.created_at).toLocaleString()}
                  </p>
                  {point.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{point.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {estimatedDelivery && (
          <div className="text-center pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">Estimated Delivery</p>
            <p className="font-semibold text-primary">{estimatedDelivery}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
