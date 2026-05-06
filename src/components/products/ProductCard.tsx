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
      <Link to={`/product/${product.id}`}>
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border bg-card">
          <div className="flex">
            {/* Image - horizontal layout */}
            <div className="relative w-28 sm:w-48 flex-shrink-0 overflow-hidden">
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
            <CardContent className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">{product.category}</p>
                <h3 className="font-semibold text-foreground text-sm sm:text-lg mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 hidden sm:block">
                  {product.description}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-base sm:text-xl font-bold text-primary">
                  {formatPrice(product.basePrice)}
                </p>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-accent-foreground text-accent-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {product.rating}
                  </span>
                  <div className="flex gap-0.5 ml-1">
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
    <Link to={`/product/${product.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border bg-card">
        <div className="relative aspect-square overflow-hidden">
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
              className="bg-background/80 hover:bg-background z-10 h-7 w-7 sm:h-8 sm:w-8"
              onClick={handleWishlistClick}
            >
              <Heart className={`h-3.5 w-3.5 ${inWishlist ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 hover:bg-background z-10 h-7 w-7 sm:h-8 sm:w-8"
              onClick={handleCompareClick}
            >
              <GitCompare className={`h-3.5 w-3.5 ${inCompare ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
            {onQuickView && (
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 hover:bg-background z-10 h-7 w-7 sm:h-8 sm:w-8"
                onClick={handleQuickView}
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
          {/* Badges */}
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
            {product.isGroupBuyEligible && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5">
                <Users className="h-2.5 w-2.5 mr-0.5" />
                Group
              </Badge>
            )}
            {product.isFreeShippingEligible && (
              <Badge className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5">
                <Truck className="h-2.5 w-2.5 mr-0.5" />
                Free Ship
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">{product.category}</p>
          <h3 className="font-semibold text-foreground line-clamp-1 text-xs sm:text-sm mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-sm sm:text-lg font-bold text-primary">
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
