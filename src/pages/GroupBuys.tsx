import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { GroupBuyCard } from '@/components/products/GroupBuyCard';
import { useGroupBuys } from '@/hooks/useGroupBuys';
import { useMyGroupBuys } from '@/hooks/useMyGroupBuys';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Users, Loader2, Clock, CheckCircle, XCircle, Ban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';

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
  const totalParticipants = activeGroupBuys.reduce((sum, groupBuy) => {
    return sum + (groupBuy.current_participants || 0);
  }, 0);
  const maxSavings = Math.max(
    ...activeGroupBuys.map((groupBuy) =>
      getGroupBuySavingsPercent({
        basePrice: groupBuy.product?.base_price || 0,
        groupPrice: groupBuy.group_price,
        discountPercentage: groupBuy.discount_percentage,
      }),
    ),
    0,
  );

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
      <main className="container px-3 py-6 pb-28 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-8 text-center sm:mb-12">
          <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 sm:p-4">
            <Users className="h-8 w-8 text-primary sm:h-12 sm:w-12" />
          </div>
          <h1 className="mb-3 text-2xl font-bold font-serif text-foreground sm:text-4xl">Group Buys</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-lg">
            Join other shoppers to unlock fixed group pricing on products you already want.
          </p>
        </div>

        <div className="mx-auto mb-8 grid max-w-2xl grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xl font-bold text-primary sm:text-3xl">{activeGroupBuys.length}</p>
            <p className="text-[11px] text-muted-foreground sm:text-sm">Active</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xl font-bold text-primary sm:text-3xl">{totalParticipants}</p>
            <p className="text-[11px] text-muted-foreground sm:text-sm">Joined</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xl font-bold text-primary sm:text-3xl">{maxSavings}%</p>
            <p className="text-[11px] text-muted-foreground sm:text-sm">Savings</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="mb-8">
          <TabsList className={`mb-6 grid h-auto w-full gap-2 rounded-2xl p-1 sm:inline-flex sm:w-auto sm:grid-cols-none ${user ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
              <div className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                    const statusColor = groupBuy.status === 'filled'
                      ? 'bg-primary/10 text-primary'
                      : groupBuy.status === 'cancelled'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-accent/10 text-accent-foreground';

                    return (
                      <Link key={participation.id} to={`/group-buy/${groupBuy.id}`}>
                        <Card className="rounded-2xl border-border/70 transition-shadow hover:shadow-md">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <div className="h-20 w-full overflow-hidden rounded-xl bg-muted sm:w-20 sm:flex-shrink-0">
                                <img
                                  src={groupBuy.product.images[0] || '/placeholder.svg'}
                                  alt={groupBuy.product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <h3 className="font-medium text-foreground sm:truncate">
                                    {groupBuy.title || groupBuy.product.name}
                                  </h3>
                                  <Badge className={`${statusColor} gap-1 flex-shrink-0`}>
                                    {statusIcon} {groupBuy.status}
                                  </Badge>
                                </div>
                                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                                  <span className="text-primary font-bold">{formatPrice(groupPrice)}</span>
                                  <span className="text-muted-foreground">Qty: {participation.quantity || 1}</span>
                                  {participation.payment_status === 'paid' ? (
                                    <span className="text-primary text-xs">Paid</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(progress, 100)} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {groupBuy.current_participants || 0}/{groupBuy.min_participants}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
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

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-2 md:gap-8">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-xl font-bold text-foreground mb-4">Why Group Buy?</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Lock in a fixed group price before checkout</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Share the link to fill the target faster</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Keep the same price for every approved participant</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Get refunded if the group does not fill</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-xl font-bold text-foreground mb-4">Group Buy Rules</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary">1.</span> Pay when you join to secure your spot</li>
              <li className="flex items-start gap-2"><span className="text-primary">2.</span> The listed group price stays fixed for the offer</li>
              <li className="flex items-start gap-2"><span className="text-primary">3.</span> When the target fills, admin creates the collective order</li>
              <li className="flex items-start gap-2"><span className="text-primary">4.</span> Full refund if the group does not reach its goal</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
