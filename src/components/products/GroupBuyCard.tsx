import { Link } from 'react-router-dom';
import { Hourglass, LockKeyhole, Star } from 'lucide-react';
import { GroupBuyWithProduct } from '@/hooks/useGroupBuys';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
import { getGroupBuySavingsPercent, getGroupBuyUnitPrice } from '@/lib/groupBuyPricing';
import { formatGroupBuyTimeRemaining } from '@/lib/groupBuyTiming';
import { ParticipantAvatarStack } from '@/components/groupbuy/ParticipantAvatarStack';
import { useGroupBuyParticipantFaces } from '@/hooks/useGroupBuyParticipantFaces';

interface GroupBuyCardProps {
  groupBuy: GroupBuyWithProduct;
}

export function GroupBuyCard({ groupBuy }: GroupBuyCardProps) {
  const { formatPrice } = useCurrency();
  const { data: participantFaces = [] } = useGroupBuyParticipantFaces(groupBuy.id, 5);
  
  if (!groupBuy.product) return null;

  const currentParticipants = groupBuy.current_participants || 0;
  const participantGoal = groupBuy.min_participants;
  const participantsNeeded = Math.max(0, participantGoal - currentParticipants);
  const progress = (currentParticipants / participantGoal) * 100;
  const progressPercent = Math.min(progress, 100);
  const discountedPrice = getGroupBuyUnitPrice({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });
  const effectiveDiscount = getGroupBuySavingsPercent({
    basePrice: groupBuy.product.base_price,
    groupPrice: groupBuy.group_price,
    discountPercentage: groupBuy.discount_percentage,
  });
  const productSummary = groupBuy.product.category_name || groupBuy.product.description || 'Limited group deal';
  const hasRating = Boolean(groupBuy.product.rating);
  const ratingLabel = hasRating
    ? `${Number(groupBuy.product.rating).toFixed(1)} rated`
    : formatGroupBuyTimeRemaining(groupBuy.expires_at);
  const inviteText = participantsNeeded > 0
    ? `${participantsNeeded} more ${participantsNeeded === 1 ? 'person' : 'people'} needed`
    : 'Goal reached';
  const inviteSubtext = participantsNeeded <= 0
    ? 'This deal is ready to move forward.'
    : participantsNeeded === 1
      ? 'Almost there. Help unlock the deal.'
      : `Invite ${participantsNeeded} more ${participantsNeeded === 1 ? 'shopper' : 'shoppers'} to close the gap.`;

  const handleShare = async () => {
    const url = `${window.location.origin}/group-buy/${groupBuy.id}`;
    const text = `Join this group buy on ${groupBuy.product.name} for ${formatPrice(discountedPrice)}. ${inviteText}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: groupBuy.product.name, text, url });
        return;
      } catch {
        return;
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden rounded-[1.35rem] border-border/70 bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="grid grid-cols-[minmax(104px,36%)_minmax(0,1fr)] gap-0 p-0 sm:grid-cols-[172px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
        <Link to={`/group-buy/${groupBuy.id}`} className="relative min-h-[184px] overflow-hidden bg-muted sm:min-h-[230px]">
          <img
            src={groupBuy.product.images[0] || '/placeholder.svg'}
            alt={groupBuy.product.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20" />
          {effectiveDiscount > 0 ? (
            <Badge className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground shadow-lg">
              {effectiveDiscount}% OFF
            </Badge>
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-start justify-between gap-2">
              <Badge className="h-6 min-w-0 max-w-[58%] truncate rounded-full bg-primary/15 px-2 text-[10px] font-bold text-primary hover:bg-primary/15 sm:max-w-[54%]">
                {hasRating ? (
                  <Star className="mr-1 h-3 w-3 flex-shrink-0 fill-primary" />
                ) : (
                  <Hourglass className="mr-1 h-3 w-3 flex-shrink-0" />
                )}
                <span className="truncate">{ratingLabel}</span>
              </Badge>
              <div className="w-[4.4rem] flex-shrink-0 text-right leading-none sm:w-[4.8rem]">
                <p className="text-[11px] text-muted-foreground line-through">
                  {formatPrice(groupBuy.product.base_price)}
                </p>
                <p className="text-lg font-black text-primary">{formatPrice(discountedPrice)}</p>
              </div>
            </div>

            <Link to={`/group-buy/${groupBuy.id}`} className="group block min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-base">
                {groupBuy.title || groupBuy.product.name}
              </h3>
            </Link>
            <p className="line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">{productSummary}</p>
          </div>

            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-primary sm:text-base">
                    {currentParticipants}/{participantGoal} joined
                  </p>
                  <p className="text-[10px] font-semibold text-foreground">{inviteText}</p>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">{inviteSubtext}</p>
                </div>
                <div className="w-12 flex-shrink-0 text-right sm:w-14">
                  <p className="text-base font-black text-primary sm:text-lg">{Math.round(progressPercent)}%</p>
                  <p className="text-[9px] text-muted-foreground">of goal reached</p>
                </div>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-muted [&>div]:bg-primary" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <ParticipantAvatarStack
                faces={participantFaces}
                totalCount={currentParticipants}
                maxVisible={3}
                sizeClassName="h-6 w-6"
                showRemainingLabel={false}
              />
              <p className="min-w-0 flex-1 truncate text-right text-[10px] leading-tight text-muted-foreground">
                Buyers get it for <span className="font-bold text-foreground">{formatPrice(discountedPrice)}</span>
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-1.5 sm:gap-2">
              <JoinGroupBuyDialog
                triggerLabel="Join"
                signedOutLabel="Join"
                joinedLabel="Joined"
                triggerClassName="h-8 min-w-0 justify-center overflow-hidden rounded-xl border border-primary/30 bg-background px-2 text-xs font-bold text-foreground hover:bg-primary/10"
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
                }}
              />
              <Button className="h-8 min-w-0 gap-1.5 overflow-hidden rounded-xl px-2 text-xs font-bold sm:gap-2" onClick={handleShare}>
                <LockKeyhole className="h-3.5 w-3.5" />
                <span className="truncate lg:hidden">Invite</span>
                <span className="hidden truncate lg:inline">Invite friends</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
