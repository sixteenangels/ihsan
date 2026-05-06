import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, Users, Zap, Truck, Clock, Heart, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import { Product } from '@/types';

interface ExtendedProduct extends Product {
  isReadyNow?: boolean;
}

interface ProductQuickViewProps {
  product: ExtendedProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductQuickView({ product, open, onOpenChange }: ProductQuickViewProps) {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  if (!product) return null;

  const inWishlist = isInWishlist(product.id);
  const images = product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'];

  // Get unique colors and sizes from variants
  const colors = useMemo(() => {
    const colorSet = new Set<string>();
    product.variants?.forEach(v => {
      if (v.color) colorSet.add(v.color);
    });
    return Array.from(colorSet);
  }, [product.variants]);

  const sizes = useMemo(() => {
    const sizeSet = new Set<string>();
    product.variants?.forEach(v => {
      if (v.size) sizeSet.add(v.size);
    });
    return Array.from(sizeSet);
  }, [product.variants]);

  const handleWishlistClick = () => {
    if (!user) {
      toast.error('Please sign in to save items');
      return;
    }
    toggleWishlist(product.id);
  };

  const handleAddToCart = () => {
    const variant = selectedVariant 
      ? product.variants?.find(v => v.id === selectedVariant)
      : product.variants?.[0];
    
    if (!variant) {
      toast.error('Please select a variant');
      return;
    }

    addToCart(product, variant as any, 1);
    toast.success('Added to cart');
    onOpenChange(false);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1);
  };

  const currentPrice = selectedVariant 
    ? product.variants?.find(v => v.id === selectedVariant)?.price || product.basePrice
    : product.basePrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-background">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Image Section */}
          <div className="relative bg-muted aspect-square">
            <img
              src={images[currentImageIndex]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                  onClick={handlePrevImage}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                  onClick={handleNextImage}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                
                {/* Thumbnails */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.slice(0, 5).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                        idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1">
              {product.isReadyNow && (
                <Badge className="bg-primary text-primary-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  Ready Now
                </Badge>
              )}
              {product.isFlashDeal && (
                <Badge className="bg-destructive text-destructive-foreground">
                  <Zap className="h-3 w-3 mr-1" />
                  Flash Deal
                </Badge>
              )}
              {product.isGroupBuyEligible && (
                <Badge variant="secondary" className="bg-accent text-accent-foreground">
                  <Users className="h-3 w-3 mr-1" />
                  Group Buy
                </Badge>
              )}
              {product.isFreeShippingEligible && (
                <Badge className="bg-secondary text-secondary-foreground">
                  <Truck className="h-3 w-3 mr-1" />
                  Free Shipping
                </Badge>
              )}
            </div>
          </div>

          {/* Product Info Section */}
          <div className="p-6 flex flex-col">
            <DialogHeader className="text-left mb-4">
              <p className="text-sm text-muted-foreground">{product.category}</p>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {product.name}
              </DialogTitle>
            </DialogHeader>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(product.rating)
                        ? 'fill-accent-foreground text-accent-foreground'
                        : 'text-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {product.rating} ({product.reviewCount} reviews)
              </span>
            </div>

            {/* Price */}
            <p className="text-3xl font-bold text-primary mb-4">
              {formatPrice(currentPrice)}
            </p>

            <Separator className="mb-4" />

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground mb-4 line-clamp-3">
                {product.description}
              </p>
            )}

            {/* Color Selection */}
            {colors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(color => {
                    const variant = product.variants?.find(v => v.color === color);
                    const isSelected = selectedVariant === variant?.id || 
                      (!selectedVariant && product.variants?.[0]?.color === color);
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedVariant(variant?.id || null)}
                        className={`px-4 py-2 rounded-md text-sm border transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {sizes.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Size</p>
                <div className="flex gap-2 flex-wrap">
                  {sizes.map(size => {
                    const variant = product.variants?.find(v => v.size === size);
                    const isSelected = selectedVariant === variant?.id;
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedVariant(variant?.id || null)}
                        className={`w-10 h-10 rounded-md text-sm border transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipping Info */}
            {product.shippingOptions && product.shippingOptions.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Shipping Options</p>
                <div className="space-y-1">
                  {product.shippingOptions.slice(0, 2).map(opt => (
                    <div key={opt.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{opt.name}</span>
                      <span>{opt.estimatedDays}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex gap-3 pt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handleWishlistClick}
              >
                <Heart className={`h-5 w-5 ${inWishlist ? 'fill-destructive text-destructive' : ''}`} />
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!product.variants || product.variants.length === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            </div>

            <Link
              to={`/product/${product.id}`}
              className="mt-3 text-center text-sm text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              View Full Details
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
