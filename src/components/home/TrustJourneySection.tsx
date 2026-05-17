import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Package, ShieldCheck, Truck, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const trustPillars = [
  {
    icon: Globe,
    title: 'Transparent cross-border pricing',
    description: 'See product value, shipping context, and purchase progress without guesswork.',
  },
  {
    icon: Truck,
    title: 'Flexible delivery decisions',
    description: 'Compare shipping classes, choose faster delivery when needed, and track every stage after payment.',
  },
  {
    icon: Users,
    title: 'Group-buy savings when it matters',
    description: 'Unlock stronger prices by joining shared demand instead of shopping alone every time.',
  },
];

const confidencePoints = [
  {
    icon: ShieldCheck,
    title: 'Retry-safe checkout',
    description: 'Interrupted payments and advanced packaging choices are already built into the order flow.',
  },
  {
    icon: Wallet,
    title: 'Wallet and loyalty support',
    description: 'Stack earned credits and loyalty redemptions without digging through multiple screens.',
  },
  {
    icon: Package,
    title: 'Clear post-purchase follow-through',
    description: 'Track delivery, confirm receipt, request support, and return to older orders quickly.',
  },
];

const journeySteps = [
  {
    step: '01',
    title: 'Browse or join a deal',
    description: 'Start with open catalog browsing, flash deals, or a group-buy opportunity that matches your budget.',
  },
  {
    step: '02',
    title: 'Choose shipping with context',
    description: 'Review delivery timing, shipping class details, and protection options before committing to payment.',
  },
  {
    step: '03',
    title: 'Track the order confidently',
    description: 'Follow status updates, delivery progress, and post-purchase actions from one compact order system.',
  },
];

export function TrustJourneySection() {
  return (
    <section className="py-12 sm:py-16">
      <div className="container px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                Why AJYN Works
              </Badge>
              <h2 className="mt-4 max-w-2xl text-2xl font-bold font-serif text-foreground sm:text-3xl">
                Cross-border shopping that stays clear, flexible, and easy to revisit
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                The storefront is built to help customers make confident decisions quickly, then return later
                without getting lost in delivery details or order clutter.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {trustPillars.map((pillar) => {
                  const Icon = pillar.icon;

                  return (
                    <div
                      key={pillar.title}
                      className="rounded-2xl border border-border/70 bg-background/80 p-4"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-foreground">{pillar.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
            <CardContent className="flex h-full flex-col p-6 sm:p-8">
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                Shopper Confidence
              </Badge>
              <h3 className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">
                Built for repeat orders, not one-off browsing
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                The best ecommerce flows stay useful after the first purchase. AJYN already has the operational
                pieces to make reordering, tracking, and payment recovery feel dependable.
              </p>

              <div className="mt-6 space-y-4">
                {confidencePoints.map((point) => {
                  const Icon = point.icon;

                  return (
                    <div
                      key={point.title}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{point.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{point.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="sm:flex-1">
                  <Link to="/products">
                    Start Shopping
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="sm:flex-1">
                  <Link to="/delivery-zones">See Delivery Zones</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 overflow-hidden border-border/70 bg-card shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                  How It Works
                </Badge>
                <h3 className="mt-4 text-2xl font-bold font-serif text-foreground sm:text-3xl">
                  A simpler path from discovery to delivery
                </h3>
              </div>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-right sm:text-base">
                Customers should understand the journey in seconds: discover products, choose delivery with context,
                and keep tracking easy after checkout.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {journeySteps.map((step) => (
                <div
                  key={step.step}
                  className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary/80">
                    Step {step.step}
                  </p>
                  <h4 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
