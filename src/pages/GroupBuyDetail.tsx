import { useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
import { GroupBuyShareSheet } from '@/components/groupbuy/GroupBuyShareSheet';
import { ExtendGroupBuyButton } from '@/components/groupbuy/ExtendGroupBuyButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/hooks/useCurrency';
import { Users, Clock, ArrowLeft, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { canExtendGroupBuy, getGroupBuyDisplayStatus, getGroupBuyStatusLabel } from '@/lib/groupBuyTiming';
import { ParticipantAvatarStack } from '@/components/groupbuy/ParticipantAvatarStack';
import { useGroupBuyParticipantFaces } from '@/hooks/useGroupBuyParticipantFaces';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

interface GroupBuyDetailData {
  created_by: string;
  id: string;
  product_id: string;
  title: string | null;
  min_participants: number;
  max_participants: number | null;
  current_participants: number | null;
  discount_percentage: number | null;
  extension_hours: number | null;
  extension_used: boolean;
  group_price: number | null;
  expires_at: string;
  settings: Json;
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
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const inviteCode = searchParams.get('invite')?.trim().toUpperCase() || null;

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    const visitorStorageKey = `ajyn_group_buy_invite_visit:${inviteCode}`;
    let visitorToken = '';

    try {
      visitorToken =
        window.localStorage.getItem(visitorStorageKey) ||
        `visit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(visitorStorageKey, visitorToken);
    } catch {
      visitorToken = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    void supabase.rpc('record_group_buy_invite_visit' as never, {
      invite_code_input: inviteCode,
      visitor_token_input: visitorToken,
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
  const { data: participantFaces = [] } = useGroupBuyParticipantFaces(id, 8);

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
  const progressPercent = Math.min(progress, 100);
  const currentParticipants = groupBuy.current_participants || 0;
  const participantsNeeded = Math.max(0, groupBuy.min_participants - currentParticipants);
  const activeTier = [...groupBuy.tiers]
    .filter((tier) => currentParticipants >= tier.min_participants)
    .sort((left, right) => right.min_participants - left.min_participants)[0];
  const nextTier = groupBuy.tiers.find((tier) => currentParticipants < tier.min_participants);
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
  const displayStatus = getGroupBuyDisplayStatus({
    currentParticipants: groupBuy.current_participants,
    expiresAt: groupBuy.expires_at,
    minParticipants: groupBuy.min_participants,
    status: groupBuy.status,
  });
  const statusLabel = getGroupBuyStatusLabel({
    currentParticipants: groupBuy.current_participants,
    expiresAt: groupBuy.expires_at,
    minParticipants: groupBuy.min_participants,
    status: groupBuy.status,
  });
  const isFilled = displayStatus === 'filled';
  const isExpired = displayStatus === 'expired';
  const isCancelled = displayStatus === 'cancelled' || displayStatus === 'closed';
  const isOpen = displayStatus === 'open';
  const isHost = groupBuy.created_by === user?.id;
  const allowExtension = canExtendGroupBuy({
    currentParticipants: groupBuy.current_participants,
    expiresAt: groupBuy.expires_at,
    extensionUsed: groupBuy.extension_used,
    minParticipants: groupBuy.min_participants,
    status: groupBuy.status,
  });
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
              ) : isExpired ? (
                <Badge className="absolute right-3 top-3 bg-destructive px-3 py-1 text-sm text-destructive-foreground sm:right-4 sm:top-4 sm:text-lg">
                  <XCircle className="h-4 w-4 mr-1" />
                  EXPIRED
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
                    <div
                      className={`flex items-center gap-1 ${
                        isFilled
                          ? 'text-primary'
                          : isExpired || isCancelled
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {isFilled ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : isExpired || isCancelled ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {statusLabel}
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
                    <span className="font-medium text-primary">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
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

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
              <ParticipantAvatarStack
                faces={participantFaces}
                totalCount={currentParticipants}
                maxVisible={8}
                sizeClassName="h-8 w-8"
              />
              <p className="text-sm text-muted-foreground">
                {currentParticipants > 0
                  ? `${currentParticipants} shopper${currentParticipants === 1 ? '' : 's'} in this group`
                  : 'Be the first face in this group'}
              </p>
            </div>

            {isOpen ? (
              <div className="space-y-3">
                <ExtendGroupBuyButton
                  canExtend={allowExtension}
                  extensionUsed={groupBuy.extension_used}
                  groupBuyId={groupBuy.id}
                  isHost={isHost}
                  className="h-10 w-full"
                />
                <JoinGroupBuyDialog
                  inviteCode={inviteCode}
                  groupBuy={{
                    id: groupBuy.id,
                    product_id: groupBuy.product_id,
                    min_participants: groupBuy.min_participants,
                    max_participants: groupBuy.max_participants,
                    current_participants: groupBuy.current_participants,
                    discount_percentage: groupBuy.discount_percentage,
                    group_price: groupBuy.group_price,
                    expires_at: groupBuy.expires_at,
                    settings: groupBuy.settings,
                    status: groupBuy.status,
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
              <div className="space-y-4 pt-1">
                <Card className={isFilled ? 'border-primary/40' : 'border-destructive/50'}>
                  <CardContent className="p-4 text-center">
                    <p className={`font-medium ${isFilled ? 'text-primary' : 'text-destructive'}`}>
                      {isFilled
                        ? 'This group buy is filled and ready for processing.'
                        : isExpired
                          ? 'This group buy expired before reaching its target.'
                          : isCancelled
                            ? 'This group buy has been cancelled.'
                            : 'This group buy is no longer accepting participants.'}
                    </p>
                  </CardContent>
                </Card>

                <Button asChild variant="outline" className="h-11 w-full rounded-xl">
                  <Link to={`/product/${groupBuy.product.id}`}>View Full Product Details</Link>
                </Button>
              </div>
            )}
            {isOpen ? (
              <Button asChild variant="outline" className="h-11 w-full rounded-xl">
                <Link to={`/product/${groupBuy.product.id}`}>View Full Product Details</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
