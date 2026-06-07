import { useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Bell } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotification, useNotifications } from '@/hooks/useNotifications';
import { getNotificationTarget } from '@/lib/notification-routing';
import { cn } from '@/lib/utils';
import { getNotificationColor, getNotificationIcon } from './Notifications';

function getNotificationLabel(type: string) {
  switch (type) {
    case 'order_status':
    case 'order':
    case 'refund_status':
      return 'Order update';
    case 'new_order':
      return 'Order received';
    case 'promotion':
      return 'Promotion';
    case 'message':
      return 'Message';
    case 'group_buy':
      return 'Group buy update';
    case 'wallet':
      return 'Wallet update';
    default:
      return 'Notification';
  }
}

export default function NotificationDetail() {
  const { notificationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notification, isLoading } = useNotification(notificationId);
  const { markAsRead } = useNotifications(1);

  useEffect(() => {
    if (notification && !notification.is_read) {
      markAsRead(notification.id);
    }
  }, [markAsRead, notification]);

  const target = notification ? getNotificationTarget(notification) : null;
  const orderTarget = target?.kind === 'order' ? target : null;
  const cameFromNotifications = Boolean((location.state as { fromNotifications?: boolean } | null)?.fromNotifications);

  const goBack = () => {
    if (cameFromNotifications) {
      navigate(-1);
      return;
    }

    navigate('/notifications');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <button
          type="button"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-primary"
          onClick={goBack}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </button>

        <div className="mx-auto max-w-2xl">
          <h1 className="mb-5 text-center text-base font-semibold text-foreground">Notification</h1>

          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Bell className="h-8 w-8 animate-pulse text-primary" />
            </div>
          ) : notification ? (
            <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      'mb-4 flex h-14 w-14 items-center justify-center rounded-full',
                      getNotificationColor(notification.type),
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {getNotificationLabel(notification.type)}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-foreground">{notification.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                <div className="border-t border-border/70 pt-6">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-base">
                    {notification.message}
                  </p>
                </div>

                {orderTarget ? (
                  <Button asChild className="h-11 w-full rounded-xl">
                    <Link to={orderTarget.href}>
                      Track Order
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-medium text-foreground">Notification not found</p>
                <p className="mt-1 text-sm text-muted-foreground">This notification may have been removed.</p>
                <Button className="mt-6 rounded-xl" onClick={() => navigate('/notifications')}>
                  Back to notifications
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
