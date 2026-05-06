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

  const activeGroupBuys = groupBuys?.filter(gb => gb.status === 'open') || [];
  const totalParticipants = activeGroupBuys.reduce((sum, g) => sum + (g.current_participants || 0), 0);
  const maxDiscount = Math.max(...activeGroupBuys.map(g => g.discount_percentage || 0), 0);

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
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold font-serif text-foreground mb-3">Group Buys</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join forces with other shoppers to unlock exclusive discounts.
          </p>
        </div>

        {/* Stats */}
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
            <p className="text-3xl font-bold text-primary">Up to {maxDiscount}%</p>
            <p className="text-sm text-muted-foreground">Savings</p>
          </div>
        </div>

        {/* Tabs: Active / My Group Buys */}
        <Tabs defaultValue="active" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="active">Active Group Buys</TabsTrigger>
            {user && (
              <TabsTrigger value="mine">
                My Group Buys
                {myGroupBuys && myGroupBuys.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{myGroupBuys.length}</Badge>
                )}
              </TabsTrigger>
            )}
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

          {user && (
            <TabsContent value="mine">
              {myLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myGroupBuys && myGroupBuys.length > 0 ? (
                <div className="space-y-4">
                  {myGroupBuys.map((p) => {
                    const gb = p.group_buy;
                    const progress = ((gb.current_participants || 0) / gb.min_participants) * 100;
                    const discountedPrice = gb.product.base_price * (1 - (gb.discount_percentage || 0) / 100);
                    const statusIcon = gb.status === 'filled' ? <CheckCircle className="h-4 w-4" /> :
                                       gb.status === 'cancelled' ? <XCircle className="h-4 w-4" /> :
                                       <Clock className="h-4 w-4" />;
                    const statusColor = gb.status === 'filled' ? 'bg-primary/10 text-primary' :
                                        gb.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                                        'bg-accent/10 text-accent-foreground';

                    return (
                      <Link key={p.id} to={`/group-buy/${gb.id}`}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <img
                                  src={gb.product.images[0] || '/placeholder.svg'}
                                  alt={gb.product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium text-foreground truncate">{gb.title || gb.product.name}</h3>
                                  <Badge className={`${statusColor} gap-1 flex-shrink-0`}>
                                    {statusIcon} {gb.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm mb-2">
                                  <span className="text-primary font-bold">{formatPrice(discountedPrice)}</span>
                                  <span className="text-muted-foreground">Qty: {p.quantity || 1}</span>
                                  {p.payment_status === 'paid' && (
                                    <span className="text-primary text-xs">✓ Paid</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(progress, 100)} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {gb.current_participants || 0}/{gb.min_participants}
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
          )}
        </Tabs>

        {/* Info Section */}
        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl bg-card border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">Why Group Buy?</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary">✓</span> Save up to 25% on regular prices</li>
              <li className="flex items-start gap-2"><span className="text-primary">✓</span> Share shipping costs with others</li>
              <li className="flex items-start gap-2"><span className="text-primary">✓</span> Get access to bulk pricing</li>
              <li className="flex items-start gap-2"><span className="text-primary">✓</span> Easy refund if group doesn't fill</li>
            </ul>
          </div>
          <div className="p-8 rounded-2xl bg-card border border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">Group Buy Rules</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary">1.</span> Pay when you join to secure your spot</li>
              <li className="flex items-start gap-2"><span className="text-primary">2.</span> Share the link to fill the group faster</li>
              <li className="flex items-start gap-2"><span className="text-primary">3.</span> When group fills, admin creates your order</li>
              <li className="flex items-start gap-2"><span className="text-primary">4.</span> Full refund if the group doesn't reach its goal</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
