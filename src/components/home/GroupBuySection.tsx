import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { useGroupBuys, GroupBuyWithProduct } from '@/hooks/useGroupBuys';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { formatGroupBuyTimeRemaining } from '@/lib/groupBuyTiming';
import { useCurrency } from '@/hooks/useCurrency';
import { ParticipantAvatarStack } from '@/components/groupbuy/ParticipantAvatarStack';
import { useGroupBuyParticipantFaces } from '@/hooks/useGroupBuyParticipantFaces';

function GroupBuyCardFromDB({ groupBuy }: { groupBuy: GroupBuyWithProduct }) {
  const { formatPrice } = useCurrency();
  const { data: participantFaces = [] } = useGroupBuyParticipantFaces(groupBuy.id, 4);

  if (!groupBuy.product) return null;

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const progressPercent = Math.min(progress, 100);
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
    <Card className="rounded-[1.4rem] border-border/70 bg-card/95 shadow-sm transition-all duration-300 hover:shadow-md">
      <CardContent className="p-3">
        <div className="flex gap-3">
          <Link to={`/product/${groupBuy.product_id}?groupBuy=${groupBuy.id}`} className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-muted">
            <img
              src={groupBuy.product.images[0] || 'https://via.placeholder.com/400'}
              alt={groupBuy.product.name}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
              {savingsPercent}% OFF
            </Badge>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="line-clamp-1 text-sm font-bold text-foreground">
                  {groupBuy.product.name}
                </h3>
                <p className="text-xs text-muted-foreground">{formatGroupBuyTimeRemaining(groupBuy.expires_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground line-through">
                  {formatPrice(groupBuy.product.base_price)}
                </p>
                <p className="text-lg font-black text-primary">{formatPrice(discountedPrice)}</p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{groupBuy.current_participants || 0}/{groupBuy.min_participants} joined</span>
                </div>
                <span className="font-semibold text-primary">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <ParticipantAvatarStack
                faces={participantFaces}
                totalCount={groupBuy.current_participants}
                maxVisible={4}
                sizeClassName="h-6 w-6"
              />
              <Link to={`/product/${groupBuy.product_id}?groupBuy=${groupBuy.id}`}>
                <Button className="h-8 rounded-xl px-3 text-xs font-bold">Join Existing</Button>
              </Link>
            </div>
          </div>
        </div>
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
