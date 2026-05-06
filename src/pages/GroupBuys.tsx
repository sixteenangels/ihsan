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
        <main className="container py-16 text-center">
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
        <main className="container py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 pb-24 md:pb-8">
        <div className="text-center mb-12">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold font-serif text-foreground mb-3">Group Buys</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join other shoppers to unlock fixed group pricing on products you already want.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
          <div className="text-center p-4 rounded-xl bg-card border border-border">
            <p className="text-3xl font-bold text-primary">{activeGroupBuys.length}</p>
            <p className="text-sm text-muted-foreground">Active Groups</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-card border border-border">
            <p className="text-3xl font-bold text-primary">{totalParticipants}</p>
            <p className="text-sm text-muted-foreground">Participants</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-card border border-border">
            <p className="text-3xl font-bold text-primary">Up to {maxSavings}%</p>
            <p className="text-sm text-muted-foreground">Potential Savings</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="mb-8">
          <TabsList className="mb-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <img
                                  src={groupBuy.product.images[0] || '/placeholder.svg'}
                                  alt={groupBuy.product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-foreground truncate">
                                    {groupBuy.title || groupBuy.product.name}
                                  </h3>
                                  <Badge className={`${statusColor} gap-1 flex-shrink-0`}>
                                    {statusIcon} {groupBuy.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm mb-2">
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

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-card border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">Why Group Buy?</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Lock in a fixed group price before checkout</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Share the link to fill the target faster</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Keep the same price for every approved participant</li>
              <li className="flex items-start gap-2"><span className="text-primary">+</span> Get refunded if the group does not fill</li>
            </ul>
          </div>
          <div className="p-8 rounded-2xl bg-card border border-border">
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
