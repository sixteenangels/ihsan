import { useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Bell, Info, MessageCircle, Package, ShoppingBag, Tag, Users, Wallet } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import { buildNotificationDetailsHref } from '@/lib/notification-routing';
import { cn } from '@/lib/utils';

export const NOTIFICATIONS_SCROLL_KEY = 'ajyn_notifications_scroll_position';

export function getNotificationIcon(type: string) {
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

export function getNotificationColor(type: string) {
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

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(500);
  const legacyNotificationId = searchParams.get('notification');

  useEffect(() => {
    if (legacyNotificationId) {
      navigate(buildNotificationDetailsHref(legacyNotificationId), { replace: true });
    }
  }, [legacyNotificationId, navigate]);

  useEffect(() => {
    if (isLoading || notifications.length === 0) return undefined;

    const storedPosition = window.sessionStorage.getItem(NOTIFICATIONS_SCROLL_KEY);
    if (!storedPosition) return undefined;

    const scrollY = Number(storedPosition);
    if (!Number.isFinite(scrollY)) {
      window.sessionStorage.removeItem(NOTIFICATIONS_SCROLL_KEY);
      return undefined;
    }

    let innerFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        window.sessionStorage.removeItem(NOTIFICATIONS_SCROLL_KEY);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [isLoading, notifications.length]);

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
            <h1 className="font-serif text-3xl font-bold text-foreground">Notifications</h1>
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
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-3 sm:p-4">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border border-transparent p-3 text-left transition-colors hover:bg-muted/40',
                    !notification.is_read && 'border-primary/25 bg-primary/5',
                  )}
                  onClick={() => {
                    window.sessionStorage.setItem(NOTIFICATIONS_SCROLL_KEY, String(window.scrollY));
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                    navigate(buildNotificationDetailsHref(notification.id), {
                      state: { fromNotifications: true },
                    });
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
                      {!notification.is_read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
