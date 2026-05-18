import { Link } from 'react-router-dom';
import { ArrowRight, Users, Clock } from 'lucide-react';
import { useGroupBuys, GroupBuyWithProduct } from '@/hooks/useGroupBuys';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { useCurrency } from '@/hooks/useCurrency';

function GroupBuyCardFromDB({ groupBuy }: { groupBuy: GroupBuyWithProduct }) {
  const { formatPrice } = useCurrency();

  if (!groupBuy.product) return null;

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const discountedPrice = getGroupBuyUnitPrice({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });
  const savingsPercent = getGroupBuySavingsPercent({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={groupBuy.product.images[0] || 'https://via.placeholder.com/400'}
          alt={groupBuy.product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <Badge className="absolute left-2 top-2 bg-accent px-2.5 py-1 text-xs text-accent-foreground sm:left-3 sm:top-3 sm:text-lg">
          {savingsPercent}% OFF
        </Badge>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg font-bold text-primary-foreground line-clamp-1">
            {groupBuy.product.name}
          </h3>
        </div>
      </div>
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(groupBuy.product.base_price)}
            </p>
            <p className="text-xl font-bold text-primary">{formatPrice(discountedPrice)}</p>
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
          <Button className="h-10 w-full rounded-xl">Join Group Buy</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function GroupBuySection() {
  const { data: groupBuys, isLoading } = useGroupBuys();

  return (
    <section className="bg-background py-10 sm:py-16">
      <div className="container px-3 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Users className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
            </div>
            <div>
              <h2 className="mb-1 text-2xl font-bold font-serif text-foreground sm:text-3xl">
                Active Group Buys
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">Join together, save more</p>
            </div>
          </div>
          <Link to="/group-buys">
            <Button variant="ghost" className="group w-full justify-between sm:w-auto">
              View All
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      </div>
    </section>
  );
}
