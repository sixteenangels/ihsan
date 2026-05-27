import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Bell, ArrowLeft, Package, Tag, MessageCircle, Info, ShoppingBag, Users, Wallet } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { buildNotificationDetailsHref, getNotificationTarget } from '@/lib/notification-routing';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'order_status':
    case 'refund_status':
    case 'order':
      return <Package className="h-4 w-4" />;
    case 'new_order':
      return <ShoppingBag className="h-4 w-4" />;
    case 'promotion':
      return <Tag className="h-4 w-4" />;
    case 'message':
      return <MessageCircle className="h-4 w-4" />;
    case 'group_buy':
      return <Users className="h-4 w-4" />;
    case 'wallet':
      return <Wallet className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'order_status':
    case 'refund_status':
    case 'order':
      return 'bg-primary/10 text-primary';
    case 'new_order':
      return 'bg-green-500/10 text-green-600';
    case 'promotion':
      return 'bg-accent/10 text-accent-foreground';
    case 'message':
      return 'bg-secondary/10 text-secondary-foreground';
    case 'group_buy':
      return 'bg-primary/10 text-primary';
    case 'wallet':
      return 'bg-amber-500/10 text-amber-600';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getNotificationMetaEntries(notification: Notification) {
  const data = notification.data || {};

  return Object.entries(data).filter(([key, value]) => {
    if (['manual_notification', 'delivery_copy', 'campaign_id'].includes(key)) {
      return false;
    }

    return ['string', 'number', 'boolean'].includes(typeof value);
  });
}

export default function Notifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedNotificationId = searchParams.get('notification');
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(100);

  const selectedNotification = useMemo(() => {
    if (selectedNotificationId) {
      return notifications.find((notification) => notification.id === selectedNotificationId) || null;
    }

    return notifications[0] || null;
  }, [notifications, selectedNotificationId]);

  useEffect(() => {
    if (selectedNotification && !selectedNotification.is_read) {
      markAsRead(selectedNotification.id);
    }
  }, [markAsRead, selectedNotification]);

  const selectedTarget = selectedNotification ? getNotificationTarget(selectedNotification) : null;
  const selectedMetaEntries = selectedNotification ? getNotificationMetaEntries(selectedNotification) : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <Link to="/" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">Updates</p>
            <h1 className="text-3xl font-bold font-serif text-foreground">Notifications</h1>
          </div>
          {unreadCount > 0 ? (
            <Button variant="outline" className="rounded-xl" onClick={() => markAllAsRead()}>
              Mark all read
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Bell className="h-8 w-8 animate-pulse text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No notifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your order, wallet, and group-buy updates will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border border-transparent p-3 text-left transition-colors hover:bg-muted/40',
                      selectedNotification?.id === notification.id && 'border-primary/25 bg-primary/5',
                      !notification.is_read && 'bg-primary/5',
                    )}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                      setSearchParams({ notification: notification.id });
                    }}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        getNotificationColor(notification.type),
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        {!notification.is_read ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Full details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNotification ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                          getNotificationColor(selectedNotification.type),
                        )}
                      >
                        {getNotificationIcon(selectedNotification.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">{selectedNotification.title}</h2>
                          <Badge variant="outline" className="rounded-full">
                            {selectedNotification.type.replaceAll('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {format(new Date(selectedNotification.created_at), 'EEEE, MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedNotification.message}
                      </p>
                    </div>

                    {selectedMetaEntries.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedMetaEntries.map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="rounded-full">
                            {key.replaceAll('_', ' ')}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {selectedTarget ? (
                        <Button asChild className="rounded-xl">
                          <Link to={selectedTarget.href}>{selectedTarget.label}</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[16rem] items-center justify-center text-center text-sm text-muted-foreground">
                    Select a notification to view the full message.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
