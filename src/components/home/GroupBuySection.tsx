import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { useGroupBuys } from '@/hooks/useGroupBuys';
import { GroupBuyCard } from '@/components/products/GroupBuyCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
                <GroupBuyCard key={groupBuy.id} groupBuy={groupBuy} />
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
