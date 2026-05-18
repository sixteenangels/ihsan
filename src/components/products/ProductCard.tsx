import { Link } from 'react-router-dom';
import { Star, Users, Zap, Truck, Heart, GitCompare, Clock, Eye } from 'lucide-react';
import { Product } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { useCompare } from '@/contexts/CompareContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';

interface ExtendedProduct extends Product {
  isReadyNow?: boolean;
}

interface ProductCardProps {
  product: ExtendedProduct;
  onQuickView?: (product: ExtendedProduct) => void;
  viewMode?: 'grid' | 'list';
}

export function ProductCard({ product, onQuickView, viewMode = 'grid' }: ProductCardProps) {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isInCompare, addToCompare, removeFromCompare, compareItems, maxItems } = useCompare();
  const inWishlist = isInWishlist(product.id);
  const inCompare = isInCompare(product.id);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to save items');
      return;
    }
    toggleWishlist(product.id);
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inCompare) {
      removeFromCompare(product.id);
      toast.info('Removed from compare');
    } else {
      if (compareItems.length >= maxItems) {
        toast.error(`Max ${maxItems} products can be compared`);
        return;
      }
      addToCompare(product.id);
      toast.success('Added to compare');
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  if (viewMode === 'list') {
    return (
      <Link to={`/product/${product.id}`} className="block h-full">
        <Card className="group h-full overscroll-contain rounded-2xl border-border/70 bg-card shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex flex-col min-[420px]:flex-row">
            {/* Image - horizontal layout */}
            <div className="relative aspect-[1.8/1] w-full shrink-0 overflow-hidden bg-muted min-[420px]:h-28 min-[420px]:w-28 sm:h-auto sm:w-48">
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {product.isReadyNow && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    Ready
                  </Badge>
                )}
                {product.isFlashDeal && (
                  <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Flash
                  </Badge>
                )}
              </div>
            </div>
            {/* Content */}
            <CardContent className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{product.category}</p>
                <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:mb-2 sm:text-lg">
                  {product.name}
                </h3>
                <p className="mb-2 hidden text-sm text-muted-foreground sm:line-clamp-2">
                  {product.description}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-bold text-primary sm:text-xl">
                  {formatPrice(product.basePrice)}
                </p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent-foreground text-accent-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {product.rating}
                    </span>
                  </div>
                  <div className="ml-auto flex gap-0.5 sm:ml-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleWishlistClick}>
                      <Heart className={`h-3.5 w-3.5 ${inWishlist ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
                    </Button>
                    {onQuickView && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleQuickView}>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </Link>
    );
  }

  // Grid view - 2 columns on mobile with compact cards
  return (
    <Link to={`/product/${product.id}`} className="block h-full">
      <Card className="group h-full overscroll-contain rounded-2xl border-border/70 bg-card shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="relative aspect-[1/1.04] overflow-hidden bg-muted">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="z-10 h-8 w-8 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background sm:h-8 sm:w-8"
              onClick={handleWishlistClick}
            >
              <Heart className={`h-3.5 w-3.5 ${inWishlist ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="z-10 h-8 w-8 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background sm:h-8 sm:w-8"
              onClick={handleCompareClick}
            >
              <GitCompare className={`h-3.5 w-3.5 ${inCompare ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
            {onQuickView && (
              <Button
                variant="ghost"
                size="icon"
                className="z-10 hidden h-8 w-8 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background sm:inline-flex"
                onClick={handleQuickView}
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isReadyNow && (
              <Badge className="max-w-[5rem] truncate bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground sm:max-w-none sm:text-[10px]">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Ready
              </Badge>
            )}
            {product.isFlashDeal && (
              <Badge className="max-w-[5rem] truncate bg-destructive px-1.5 py-0.5 text-[9px] text-destructive-foreground sm:max-w-none sm:text-[10px]">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Flash
              </Badge>
            )}
            {product.isGroupBuyEligible && (
              <Badge variant="secondary" className="max-w-[5rem] truncate bg-accent px-1.5 py-0.5 text-[9px] text-accent-foreground sm:max-w-none sm:text-[10px]">
                <Users className="h-2.5 w-2.5 mr-0.5" />
                Group
              </Badge>
            )}
            {product.isFreeShippingEligible && (
              <Badge className="hidden bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground sm:inline-flex">
                <Truck className="h-2.5 w-2.5 mr-0.5" />
                Free Ship
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-2.5 sm:p-4">
          <p className="mb-1 text-[11px] text-muted-foreground sm:text-xs">{product.category}</p>
          <h3 className="mb-2 line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-sm">
            {product.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-primary sm:text-lg">
              {formatPrice(product.basePrice)}
            </p>
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-accent-foreground text-accent-foreground" />
              <span className="text-[10px] sm:text-sm text-muted-foreground">
                {product.rating}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
