import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    toggleSubscription,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser.
            Try using a modern browser like Chrome, Firefox, or Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSubscribed ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get instant notifications on your device when your order status changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === 'denied' 
                ? 'You have blocked notifications. Enable them in browser settings.'
                : isSubscribed 
                  ? 'You will receive push notifications for order updates'
                  : 'Enable to receive order status updates on your device'
              }
            </p>
          </div>
          
          {permission === 'denied' ? (
            <Button variant="outline" size="sm" disabled>
              Blocked
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={isSubscribed}
                onCheckedChange={toggleSubscription}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
