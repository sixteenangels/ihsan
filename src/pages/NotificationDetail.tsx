import { useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Bell, ChevronRight, Package } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotification, useNotifications } from '@/hooks/useNotifications';
import {
  getNotificationDetailParagraphs,
  getNotificationDisplayTitle,
  getNotificationEyebrow,
} from '@/lib/notification-display';
import { getNotificationTarget } from '@/lib/notification-routing';
import { getNotificationColor, getNotificationIcon } from '@/lib/notification-visuals';
import { cn } from '@/lib/utils';

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

  const title = notification ? getNotificationDisplayTitle(notification) : '';
  const paragraphs = notification ? getNotificationDetailParagraphs(notification) : [];

  return (
    <div className="min-h-screen bg-[#101010] md:bg-background">
      <Header />
      <main className="min-h-[calc(100vh-4rem)] px-3 py-5 pb-10 sm:px-6 md:py-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-self-start rounded-full px-1 text-sm font-medium text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010] md:focus-visible:ring-ring md:focus-visible:ring-offset-background"
              onClick={goBack}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </button>
            <h1 className="text-center text-sm font-semibold text-white md:text-foreground">Notification</h1>
            <div />
          </div>

          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Bell className="h-8 w-8 animate-pulse text-primary" />
            </div>
          ) : notification ? (
            <Card className="rounded-2xl border-[#2d2d2d] bg-[#1b1b1b] shadow-[0_22px_55px_-36px_hsl(0_0%_0%/0.9)] md:border-border/70 md:bg-card md:shadow-sm">
              <CardContent className="p-5 sm:p-8">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      'mb-4 flex h-16 w-16 items-center justify-center rounded-full text-primary',
                      getNotificationColor(notification.type),
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary md:text-xs">
                    {getNotificationEyebrow(notification).toUpperCase()}
                  </p>
                  <h2 className="mt-3 max-w-md break-words text-xl font-semibold leading-snug text-white md:text-foreground">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm text-[#a6a6a6] md:text-muted-foreground">
                    {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                <div className="mt-6 space-y-5 border-t border-[#303030] pt-6 md:border-border/70">
                  {paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="break-words text-sm leading-7 text-[#dedede] sm:text-base md:text-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                {orderTarget ? (
                  <Button
                    asChild
                    className="mt-16 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 md:mt-9 md:rounded-xl"
                  >
                    <Link to={orderTarget.href}>
                      <Package className="h-4 w-4" />
                      Track Order
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-[#262626] bg-[#181818] shadow-sm md:border-border/70 md:bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="mb-3 h-10 w-10 text-[#8d8d8d] md:text-muted-foreground" />
                <p className="text-lg font-medium text-white md:text-foreground">Notification not found</p>
                <p className="mt-1 text-sm text-[#9a9a9a] md:text-muted-foreground">
                  This notification may have been removed.
                </p>
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
