import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { GroupBuyCard } from '@/components/products/GroupBuyCard';
import { useGroupBuys } from '@/hooks/useGroupBuys';
import { useMyGroupBuys } from '@/hooks/useMyGroupBuys';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Users, Loader2, Clock, CheckCircle, XCircle, Ban, HelpCircle, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { canExtendGroupBuy, formatGroupBuyTimeRemaining } from '@/lib/groupBuyTiming';
import { ExtendGroupBuyButton } from '@/components/groupbuy/ExtendGroupBuyButton';

export default function GroupBuys() {
  const { user } = useAuth();
  const { data: groupBuys, isLoading } = useGroupBuys();
  const { data: myGroupBuys, isLoading: myLoading } = useMyGroupBuys();
  const { formatPrice } = useCurrency();
  const { isEnabled } = useFeatureFlags();

  if (!isEnabled('group_buys')) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-16 text-center sm:px-6">
          <Ban className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Feature Disabled</h1>
          <p className="text-muted-foreground">Group Buys is currently disabled.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const activeGroupBuys = groupBuys?.filter((groupBuy) => groupBuy.status === 'open') || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex min-h-[60vh] items-center justify-center px-4 py-8 sm:px-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-5 pb-28 sm:px-6 md:py-8 md:pb-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground sm:text-3xl">
                <span>Active Group Buys</span>
                <Sparkles className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              </h1>
              <p className="text-sm text-muted-foreground">Shop together. Save more.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 shrink-0 rounded-full px-3 text-[11px]">
              <Link to="/help">
                <HelpCircle className="h-3.5 w-3.5" />
                How it works
              </Link>
            </Button>
          </div>

          <Tabs defaultValue="active" className="mb-8">
            <TabsList className={`mb-4 grid h-auto w-full gap-2 rounded-2xl border border-border/70 bg-card/70 p-1 sm:inline-flex sm:w-auto sm:grid-cols-none ${user ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <TabsTrigger value="active">Active Group Buys</TabsTrigger>
              {user ? (
                <TabsTrigger value="mine">
                  My Group Buys
                  {myGroupBuys && myGroupBuys.length > 0 ? (
                    <Badge variant="secondary" className="ml-2">{myGroupBuys.length}</Badge>
                  ) : null}
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="active">
              {activeGroupBuys.length > 0 ? (
                <div className="space-y-3">
                  {activeGroupBuys.map((groupBuy) => (
                    <GroupBuyCard key={groupBuy.id} groupBuy={groupBuy} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold mb-2">No Active Group Buys</h2>
                  <p className="text-muted-foreground">Check back later!</p>
                </div>
              )}
            </TabsContent>

            {user ? (
              <TabsContent value="mine">
                {myLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : myGroupBuys && myGroupBuys.length > 0 ? (
                  <div className="space-y-4">
                    {myGroupBuys.map((participation) => {
                      const groupBuy = participation.group_buy;
                      const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
                      const groupPrice = getGroupBuyUnitPrice({
                        basePrice: groupBuy.product.base_price,
                        groupPrice: groupBuy.group_price,
                        discountPercentage: groupBuy.discount_percentage,
                      });
                      const statusIcon = groupBuy.status === 'filled'
                        ? <CheckCircle className="h-4 w-4" />
                        : groupBuy.status === 'cancelled'
                          ? <XCircle className="h-4 w-4" />
                          : <Clock className="h-4 w-4" />;
                      const statusLabel = groupBuy.status === 'open'
                        ? formatGroupBuyTimeRemaining(groupBuy.expires_at)
                        : groupBuy.status === 'filled'
                          ? 'Filled'
                          : groupBuy.status === 'cancelled'
                            ? 'Cancelled'
                            : groupBuy.status === 'expired'
                              ? 'Expired'
                              : 'Closed';
                      const statusColor = groupBuy.status === 'filled'
                        ? 'bg-primary/10 text-primary'
                        : groupBuy.status === 'cancelled'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-accent/10 text-accent-foreground';
                      const isHost = groupBuy.created_by === user?.id;
                      const allowExtension = canExtendGroupBuy({
                        currentParticipants: groupBuy.current_participants,
                        expiresAt: groupBuy.expires_at,
                        extensionUsed: groupBuy.extension_used,
                        minParticipants: groupBuy.min_participants,
                        status: groupBuy.status,
                      });

                      return (
                        <Card key={participation.id} className="rounded-2xl border-border/70 transition-shadow hover:shadow-md">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <Link to={`/group-buy/${groupBuy.id}`} className="h-20 w-full overflow-hidden rounded-xl bg-muted sm:w-20 sm:flex-shrink-0">
                                <img
                                  src={groupBuy.product.images[0] || '/placeholder.svg'}
                                  alt={groupBuy.product.name}
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <Link to={`/group-buy/${groupBuy.id}`} className="font-medium text-foreground transition-colors hover:text-primary sm:truncate">
                                    {groupBuy.title || groupBuy.product.name}
                                  </Link>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={`${statusColor} gap-1 flex-shrink-0`}>
                                      {statusIcon} {statusLabel}
                                    </Badge>
                                    <ExtendGroupBuyButton
                                      canExtend={allowExtension}
                                      extensionUsed={groupBuy.extension_used}
                                      groupBuyId={groupBuy.id}
                                      isHost={isHost}
                                      className="h-8 px-3 text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                                  <span className="text-primary font-bold">{formatPrice(groupPrice)}</span>
                                  <span className="text-muted-foreground">Qty: {participation.quantity || 1}</span>
                                  {participation.payment_status === 'paid' ? (
                                    <span className="text-primary text-xs">Paid</span>
                                  ) : null}
                                    {isHost && groupBuy.status === 'open' ? (
                                      <span className="text-xs text-muted-foreground">
                                        {groupBuy.extension_used
                                          ? `Extended by ${groupBuy.extension_hours}h`
                                          : allowExtension
                                            ? 'Extension available now'
                                            : 'Extension unlocks in the final hour'}
                                      </span>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(progress, 100)} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {groupBuy.current_participants || 0}/{groupBuy.min_participants}
                                  </span>
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button asChild variant="ghost" size="sm" className="rounded-xl px-3 text-xs">
                                    <Link to={`/group-buy/${groupBuy.id}`}>
                                      {groupBuy.status === 'filled' ? 'Order Details' : 'View Details'}
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-bold mb-2">No Group Buys Yet</h2>
                    <p className="text-muted-foreground">Join a group buy to see it here!</p>
                  </div>
                )}
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
