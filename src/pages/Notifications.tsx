import { useEffect, useMemo, useState } from 'react';
import { formatStoreDateTime } from '@/lib/date-utils';
import { ArrowLeft, Bell, ChevronRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import {
  NOTIFICATIONS_SCROLL_KEY,
  getNotificationDisplayMessage,
  getNotificationDisplayTitle,
  getNotificationFilter,
  type NotificationFilter,
} from '@/lib/notification-display';
import { buildNotificationDetailsHref } from '@/lib/notification-routing';
import { getNotificationColor, getNotificationIcon } from '@/lib/notification-visuals';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'orders', label: 'Orders' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'system', label: 'System' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(500);
  const legacyNotificationId = searchParams.get('notification');
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

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

  const filterCounts = useMemo(() => {
    return notifications.reduce<Record<NotificationFilter, number>>(
      (counts, notification) => {
        counts.all += 1;
        counts[getNotificationFilter(notification)] += 1;
        return counts;
      },
      { all: 0, orders: 0, promotions: 0, system: 0 },
    );
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((notification) => getNotificationFilter(notification) === activeFilter);
  }, [activeFilter, notifications]);

  return (
    <div className="min-h-screen bg-[#101010] md:bg-background">
      <Header />
      <main className="min-h-[calc(100vh-4rem)] px-3 py-5 pb-10 sm:px-6 md:py-8">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            to="/"
            className="mb-4 inline-flex h-10 items-center rounded-full pr-3 text-sm font-semibold text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010] md:mb-5 md:h-auto md:rounded-none md:pr-0 md:font-medium md:focus-visible:ring-ring md:focus-visible:ring-offset-background"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="hidden text-xs font-semibold uppercase tracking-[0.28em] text-primary md:block">
                AJYN Updates
              </p>
              <h1 className="text-2xl font-bold text-white md:font-serif md:text-3xl md:text-foreground">
                Notifications
              </h1>
            </div>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                className="h-9 shrink-0 rounded-full px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary md:px-3"
                onClick={() => markAllAsRead()}
              >
                Mark all as read
              </Button>
            ) : null}
          </div>

          <div className="-mx-1 mb-5 overflow-x-auto pb-1 mobile-scroll-pills">
            <div className="flex min-w-max gap-2 px-1">
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary bg-primary/15 text-primary shadow-sm md:bg-primary md:text-primary-foreground'
                        : 'border-[#202020] bg-[#191919] text-[#a5a5a5] hover:border-primary/40 hover:text-white md:border-border md:bg-card md:text-muted-foreground md:hover:text-foreground',
                    )}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        isActive
                          ? 'bg-primary/15 text-primary md:bg-primary-foreground/20 md:text-primary-foreground'
                          : 'bg-[#252525] text-[#8d8d8d] md:bg-muted md:text-muted-foreground',
                      )}
                    >
                      {filterCounts[filter.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Bell className="h-8 w-8 animate-pulse text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <Card className="rounded-2xl border-[#262626] bg-[#181818] shadow-sm md:border-border/70 md:bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="mb-3 h-10 w-10 text-[#8d8d8d] md:text-muted-foreground" />
                <p className="text-lg font-medium text-white md:text-foreground">No notifications yet</p>
                <p className="mt-1 max-w-sm text-sm text-[#9a9a9a] md:text-muted-foreground">
                  Your order, wallet, and group-buy updates will appear here.
                </p>
              </CardContent>
            </Card>
          ) : visibleNotifications.length === 0 ? (
            <Card className="rounded-2xl border-[#262626] bg-[#181818] shadow-sm md:border-border/70 md:bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-3 h-9 w-9 text-[#8d8d8d] md:text-muted-foreground" />
                <p className="text-base font-medium text-white md:text-foreground">Nothing in this section</p>
                <p className="mt-1 text-sm text-[#9a9a9a] md:text-muted-foreground">Try another notification filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {visibleNotifications.map((notification) => {
                const title = getNotificationDisplayTitle(notification);
                const message = getNotificationDisplayMessage(notification);

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-[#181818] p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010] md:rounded-2xl md:border-border md:bg-card md:p-3.5 md:focus-visible:ring-ring md:focus-visible:ring-offset-background',
                      !notification.is_read && 'border-primary/65 bg-primary/5 md:border-primary/45',
                    )}
                    aria-label={`Open notification: ${title}`}
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
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        getNotificationColor(notification.type),
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white md:text-foreground">{title}</p>
                        {!notification.is_read ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#b6b6b6] md:text-sm md:text-muted-foreground">
                        {message}
                      </p>
                      <p className="mt-2 text-xs text-[#9a9a9a] md:text-muted-foreground">
                        {formatStoreDateTime(notification.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#8d8d8d] transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
