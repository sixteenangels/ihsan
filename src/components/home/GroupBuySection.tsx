import { Link } from 'react-router-dom';
import { ArrowRight, Users, Clock } from 'lucide-react';
import { useGroupBuys, GroupBuyWithProduct } from '@/hooks/useGroupBuys';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function GroupBuyCardFromDB({ groupBuy }: { groupBuy: GroupBuyWithProduct }) {
  if (!groupBuy.product) return null;

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const discountedPrice =
    groupBuy.product.base_price * (1 - (groupBuy.discount_percentage || 0) / 100);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border bg-card">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={groupBuy.product.images[0] || 'https://via.placeholder.com/400'}
          alt={groupBuy.product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground text-lg px-3 py-1">
          {groupBuy.discount_percentage || 0}% OFF
        </Badge>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-bold text-primary-foreground line-clamp-1">
            {groupBuy.product.name}
          </h3>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground line-through">
              ${groupBuy.product.base_price.toFixed(2)}
            </p>
            <p className="text-xl font-bold text-primary">${discountedPrice.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{daysLeft} days left</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {groupBuy.current_participants || 0}/{groupBuy.min_participants} joined
              </span>
            </div>
            <span className="text-primary font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Link to={`/product/${groupBuy.product_id}?groupBuy=${groupBuy.id}`}>
          <Button className="w-full">Join Group Buy</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function GroupBuySection() {
  const { data: groupBuys, isLoading } = useGroupBuys();

  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-serif text-foreground mb-1">
                Active Group Buys
              </h2>
              <p className="text-muted-foreground">Join together, save more</p>
            </div>
          </div>
          <Link to="/group-buys">
            <Button variant="ghost" className="group">
              View All
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden bg-card">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))
            : groupBuys?.slice(0, 3).map((groupBuy) => (
                <GroupBuyCardFromDB key={groupBuy.id} groupBuy={groupBuy} />
              ))}
        </div>

        {!isLoading && (!groupBuys || groupBuys.length === 0) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No active group buys at the moment.</p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12 p-8 rounded-2xl bg-card border border-border">
          <h3 className="text-xl font-bold text-foreground mb-6 text-center">
            How Group Buys Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-3">
                1
              </div>
              <h4 className="font-semibold text-foreground mb-1">Join a Group</h4>
              <p className="text-sm text-muted-foreground">
                Find a product and join the group buy
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-3">
                2
              </div>
              <h4 className="font-semibold text-foreground mb-1">Share & Invite</h4>
              <p className="text-sm text-muted-foreground">
                Invite friends to unlock bigger discounts
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-3">
                3
              </div>
              <h4 className="font-semibold text-foreground mb-1">Goal Reached</h4>
              <p className="text-sm text-muted-foreground">
                When the group fills, the deal goes through
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-3">
                4
              </div>
              <h4 className="font-semibold text-foreground mb-1">Save Together</h4>
              <p className="text-sm text-muted-foreground">
                Everyone gets the discounted price
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
