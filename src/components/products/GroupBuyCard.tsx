import { Link } from 'react-router-dom';
import { Users, Clock, Share2 } from 'lucide-react';
import { GroupBuyWithProduct } from '@/hooks/useGroupBuys';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { JoinGroupBuyDialog } from '@/components/groupbuy/JoinGroupBuyDialog';
import { toast } from 'sonner';

interface GroupBuyCardProps {
  groupBuy: GroupBuyWithProduct;
}

export function GroupBuyCard({ groupBuy }: GroupBuyCardProps) {
  const { formatPrice } = useCurrency();
  
  if (!groupBuy.product) return null;

  const progress = ((groupBuy.current_participants || 0) / groupBuy.min_participants) * 100;
  const daysLeft = Math.ceil(
    (new Date(groupBuy.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const discountedPrice =
    groupBuy.product.base_price * (1 - (groupBuy.discount_percentage || 0) / 100);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/group-buy/${groupBuy.id}`;
    const text = `Join this group buy and save ${groupBuy.discount_percentage || 0}%! ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border bg-card">
      <Link to={`/group-buy/${groupBuy.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={groupBuy.product.images[0] || '/placeholder.svg'}
            alt={groupBuy.product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
          <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground text-lg px-3 py-1">
            {groupBuy.discount_percentage || 0}% OFF
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 bg-background/50 hover:bg-background/80"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-lg font-bold text-primary-foreground line-clamp-1">
              {groupBuy.product.name}
            </h3>
          </div>
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(groupBuy.product.base_price)}
            </p>
            <p className="text-xl font-bold text-primary">
              {formatPrice(discountedPrice)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{daysLeft > 0 ? `${daysLeft}d left` : 'Ending soon'}</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{groupBuy.current_participants || 0}/{groupBuy.min_participants} joined</span>
            </div>
            <span className="text-primary font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>

        {/* Participant avatars */}
        <div className="flex -space-x-1 mb-3">
          {Array.from({ length: Math.min(groupBuy.current_participants || 0, 5) }).map((_, i) => (
            <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card text-[10px] flex items-center justify-center text-primary font-medium">
              {i + 1}
            </div>
          ))}
          {(groupBuy.current_participants || 0) > 5 && (
            <div className="w-6 h-6 rounded-full bg-muted border-2 border-card text-[10px] flex items-center justify-center text-muted-foreground">
              +{(groupBuy.current_participants || 0) - 5}
            </div>
          )}
        </div>

        <JoinGroupBuyDialog
          groupBuy={{
            id: groupBuy.id,
            product_id: groupBuy.product_id,
            min_participants: groupBuy.min_participants,
            current_participants: groupBuy.current_participants,
            discount_percentage: groupBuy.discount_percentage,
            expires_at: groupBuy.expires_at,
            product: {
              name: groupBuy.product.name,
              base_price: groupBuy.product.base_price,
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
