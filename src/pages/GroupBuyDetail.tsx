import { useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
import { GroupBuyShareSheet } from '@/components/groupbuy/GroupBuyShareSheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/useCurrency';
import { Users, Clock, ArrowLeft, Loader2, CheckCircle, Send, Target, UserPlus } from 'lucide-react';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import type { Database } from '@/integrations/supabase/types';

type GroupBuyParticipantSummary = Pick<
  Database['public']['Tables']['group_buy_participants']['Row'],
  'id' | 'joined_at'
>;

interface GroupBuyDetailData {
  id: string;
  product_id: string;
  title: string | null;
  min_participants: number;
  max_participants: number | null;
  current_participants: number | null;
  discount_percentage: number | null;
  group_price: number | null;
  expires_at: string;
  status: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    rating: number | null;
    review_count: number | null;
    category_name: string | null;
    images: string[];
  } | null;
  participants: GroupBuyParticipantSummary[];
  tiers: Array<{
    id: string;
    min_participants: number;
    group_price: number | null;
    discount_percentage: number | null;
    reward_coupon_percent: number | null;
    label: string;
  }>;
}

export default function GroupBuyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { formatPrice } = useCurrency();
  const inviteCode = searchParams.get('invite')?.trim().toUpperCase() || null;

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    void supabase.rpc('record_group_buy_invite_visit' as never, {
      invite_code_input: inviteCode,
    } as never);
  }, [inviteCode]);

  const { data: groupBuy, isLoading } = useQuery({
    queryKey: ['group-buy-detail', id],
    queryFn: async (): Promise<GroupBuyDetailData> => {
      const { data, error } = await supabase
        .from('group_buys')
        .select(`
          *,
          products(id, name, description, base_price, rating, review_count, categories(name))
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;

      const { data: images } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', data.product_id)
        .order('order_index');

      const { data: participants } = await supabase
        .from('group_buy_participants')
        .select('id, joined_at')
        .eq('group_buy_id', id!);

      const { data: tiers } = await supabase
        .from('group_buy_tiers' as never)
        .select('id, min_participants, group_price, discount_percentage, reward_coupon_percent, label')
        .eq('group_buy_id', id!)
        .order('min_participants', { ascending: true });

      const productData = data.products as {
        id: string;
        name: string;
        description: string | null;
        base_price: number;
        rating: number | null;
        review_count: number | null;
        categories: { name: string } | null;
      } | null;

      return {
        ...data,
        discount_percentage: data.discount_percentage ? Number(data.discount_percentage) : null,
        group_price: data.group_price != null ? Number(data.group_price) : null,
        product: productData
          ? {
              id: productData.id,
              name: productData.name,
              description: productData.description,
              base_price: Number(productData.base_price),
              rating: productData.rating ? Number(productData.rating) : null,
              review_count: productData.review_count,
              category_name: productData.categories?.name || null,
              images: images?.map((image) => image.image_url) || [],
            }
          : null,
        participants: (participants || []) as GroupBuyParticipantSummary[],
        tiers: ((tiers as unknown[]) || []).map((tier) => {
          const typedTier = tier as {
            id: string;
            min_participants: number;
            group_price: number | string | null;
            discount_percentage: number | string | null;
            reward_coupon_percent: number | string | null;
            label: string;
          };

          return {
            id: typedTier.id,
            min_participants: typedTier.min_participants,
            group_price: typedTier.group_price != null ? Number(typedTier.group_price) : null,
            discount_percentage:
              typedTier.discount_percentage != null ? Number(typedTier.discount_percentage) : null,
            reward_coupon_percent:
              typedTier.reward_coupon_percent != null ? Number(typedTier.reward_coupon_percent) : null,
            label: typedTier.label,
          };
        }),
      };
    },
    enabled: !!id,
  });

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

  if (!groupBuy || !groupBuy.product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Group Buy Not Found</h1>
          <Link to="/group-buys"><Button>Browse Group Buys</Button></Link>
        </main>
        <Footer />
      </div>
    );
  }

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const currentParticipants = groupBuy.current_participants || 0;
  const participantsNeeded = Math.max(0, groupBuy.min_participants - currentParticipants);
  const activeTier = [...groupBuy.tiers]
    .filter((tier) => currentParticipants >= tier.min_participants)
    .sort((left, right) => right.min_participants - left.min_participants)[0];
  const nextTier = groupBuy.tiers.find((tier) => currentParticipants < tier.min_participants);
  const daysLeft = Math.ceil(
    (new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const groupPrice = getGroupBuyUnitPrice({
    basePrice: groupBuy.product.base_price,
    groupPrice: activeTier?.group_price ?? groupBuy.group_price,
    discountPercentage: activeTier?.discount_percentage ?? groupBuy.discount_percentage,
  });
  const savingsPercent = getGroupBuySavingsPercent({
    basePrice: groupBuy.product.base_price,
    groupPrice: activeTier?.group_price ?? groupBuy.group_price,
    discountPercentage: activeTier?.discount_percentage ?? groupBuy.discount_percentage,
  });
  const isFilled = groupBuy.status === 'filled';
  const isCancelled = groupBuy.status === 'cancelled' || groupBuy.status === 'closed';
  const milestones = [
    {
      key: 'started',
      target: 1,
      label: 'Started',
      helper: 'The host locked the campaign and opened the share link.',
    },
    {
      key: 'momentum',
      target: Math.max(2, Math.ceil(groupBuy.min_participants / 2)),
      label: 'Momentum',
      helper: 'Halfway there makes the share push feel real.',
    },
    {
      key: 'filled',
      target: groupBuy.min_participants,
      label: 'Price locked',
      helper: 'The admin-set group price is secured once this target fills.',
    },
    ...(groupBuy.max_participants && groupBuy.max_participants > groupBuy.min_participants
      ? [
          {
            key: 'maxed',
            target: groupBuy.max_participants,
            label: 'Squad full',
            helper: 'After this, new buyers need the next group.',
          },
        ]
      : []),
  ].filter((milestone, index, array) => array.findIndex((item) => item.target === milestone.target) === index);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-3 py-5 pb-28 sm:px-6 md:py-8 md:pb-8">
        <Link to="/group-buys" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Group Buys
        </Link>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-sm">
              <img
                src={groupBuy.product.images[0] || '/placeholder.svg'}
                alt={groupBuy.product.name}
                className="w-full h-full object-cover"
              />
              {savingsPercent > 0 ? (
                <Badge className="absolute left-3 top-3 bg-accent px-3 py-1 text-sm text-accent-foreground sm:left-4 sm:top-4 sm:text-lg">
                  {savingsPercent}% OFF
                </Badge>
              ) : null}
              {isFilled ? (
                <Badge className="absolute right-3 top-3 bg-green-600 px-3 py-1 text-sm text-white sm:right-4 sm:top-4 sm:text-lg">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  FILLED
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">{groupBuy.product.category_name}</p>
              <h1 className="text-[1.65rem] font-bold font-serif leading-tight text-foreground sm:text-3xl">
                {groupBuy.title || groupBuy.product.name}
              </h1>
              <p className="text-muted-foreground mt-2">{groupBuy.product.description}</p>
            </div>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground line-through">
                      {formatPrice(groupBuy.product.base_price)}
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(groupPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {groupBuy.current_participants || 0} / {groupBuy.min_participants} joined
                      </span>
                    </div>
                    <span className="font-medium text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-3" />
                  {groupBuy.max_participants ? (
                    <p className="text-xs text-muted-foreground">
                      Max {groupBuy.max_participants} participants
                    </p>
                  ) : null}
                  {activeTier ? (
                    <p className="text-xs font-medium text-primary">
                      Active tier: {activeTier.label}
                    </p>
                  ) : null}
                  {nextTier ? (
                    <p className="text-xs text-muted-foreground">
                      Next tier at {nextTier.min_participants} joined
                      {nextTier.group_price != null ? `: ${formatPrice(nextTier.group_price)}` : ''}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-primary/15 bg-primary/5 shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                      Invite Plan
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {participantsNeeded > 0
                        ? `${participantsNeeded} more ${participantsNeeded === 1 ? 'person' : 'people'} needed`
                        : 'Target filled and ready'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Everyone joining this round keeps the same admin-set price of {formatPrice(groupPrice)}.
                    </p>
                  </div>
                  <div className="rounded-full bg-background p-3 text-primary">
                    <Send className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <UserPlus className="h-4 w-4 text-primary" />
                      Best next move
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {participantsNeeded > 0
                        ? `Share this link with ${Math.min(participantsNeeded, 3)} focused friend${Math.min(participantsNeeded, 3) === 1 ? '' : 's'} first.`
                        : 'Use the link to build interest for the next group while this one closes out.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Target className="h-4 w-4 text-primary" />
                      Goal
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {groupBuy.min_participants} participants are needed to secure the final group run.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Reward
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Every filled seat keeps the discount moving toward the finished order batch.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {milestones.map((milestone) => {
                    const complete = currentParticipants >= milestone.target;
                    const current = !complete && currentParticipants + 1 >= milestone.target;

                    return (
                      <div
                        key={milestone.key}
                        className={`rounded-xl border p-4 ${
                          complete
                            ? 'border-primary/40 bg-primary/10'
                            : current
                              ? 'border-accent/50 bg-accent/10'
                              : 'border-border bg-background/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{milestone.label}</p>
                            <p className="text-sm text-muted-foreground">{milestone.helper}</p>
                          </div>
                          <Badge variant={complete ? 'default' : 'outline'}>
                            {milestone.target} joined
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {groupBuy.participants.slice(0, 8).map((participant, index) => (
                  <div
                    key={participant.id}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium text-primary"
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
              {groupBuy.participants.length > 8 ? (
                <span className="text-sm text-muted-foreground">
                  +{groupBuy.participants.length - 8} more
                </span>
              ) : null}
            </div>

            {!isCancelled ? (
              <div className="space-y-3">
                  <JoinGroupBuyDialog
                    inviteCode={inviteCode}
                    groupBuy={{
                      id: groupBuy.id,
                      product_id: groupBuy.product_id,
                    min_participants: groupBuy.min_participants,
                    current_participants: groupBuy.current_participants,
                    discount_percentage: groupBuy.discount_percentage,
                    group_price: groupBuy.group_price,
                    expires_at: groupBuy.expires_at,
                      product: {
                        name: groupBuy.product.name,
                        base_price: groupBuy.product.base_price,
                      },
                      tiers: groupBuy.tiers,
                    }}
                  />
                <GroupBuyShareSheet
                  groupBuyId={groupBuy.id}
                  title={groupBuy.title || groupBuy.product.name}
                  price={groupPrice}
                  savingsPercent={savingsPercent}
                  participantsNeeded={participantsNeeded}
                  targetParticipants={groupBuy.min_participants}
                />
              </div>
            ) : (
              <Card className="border-destructive/50">
                <CardContent className="p-4 text-center">
                  <p className="font-medium text-destructive">This group buy has been cancelled or expired.</p>
                </CardContent>
              </Card>
            )}

            <Link to={`/product/${groupBuy.product.id}`}>
              <Button variant="outline" className="h-11 w-full rounded-xl">View Full Product Details</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
