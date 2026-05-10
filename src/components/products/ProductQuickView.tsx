import { useEffect, useMemo, useState } from 'react';
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
import { Product, ProductVariant } from '@/types';

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
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const variants = useMemo(() => product?.variants ?? [], [product?.variants]);

  // Get unique colors and sizes from variants
  const colors = useMemo(() => {
    const colorSet = new Set<string>();
    variants.forEach((v) => {
      if (v.color) colorSet.add(v.color);
    });
    return Array.from(colorSet);
  }, [variants]);

  const sizes = useMemo(() => {
    const sizeSet = new Set<string>();
    variants.forEach((v) => {
      if (v.size) sizeSet.add(v.size);
    });
    return Array.from(sizeSet);
  }, [variants]);

  useEffect(() => {
    setSelectedColor((currentColor) =>
      currentColor && colors.includes(currentColor) ? currentColor : colors[0] || null,
    );
  }, [colors]);

  const variantsForSelectedColor = useMemo(() => {
    if (colors.length === 0) return variants;
    return variants.filter((variant) => variant.color === selectedColor);
  }, [colors.length, selectedColor, variants]);

  const sizesForSelectedColor = useMemo(() => {
    const sizeSet = new Set<string>();
    variantsForSelectedColor.forEach((variant) => {
      if (variant.size) sizeSet.add(variant.size);
    });
    return Array.from(sizeSet);
  }, [variantsForSelectedColor]);

  useEffect(() => {
    if (sizesForSelectedColor.length === 0) {
      const fallbackVariant = variantsForSelectedColor[0];
      setSelectedSize(null);
      setSelectedVariant(fallbackVariant?.id || null);
      return;
    }

    setSelectedSize((currentSize) => {
      const nextSize =
        currentSize && sizesForSelectedColor.includes(currentSize)
          ? currentSize
          : variantsForSelectedColor.find((variant) => (variant.stock || 0) > 0)?.size || sizesForSelectedColor[0];
      const nextVariant = variantsForSelectedColor.find((variant) => variant.size === nextSize);
      setSelectedVariant(nextVariant?.id || null);
      return nextSize;
    });
  }, [sizesForSelectedColor, variantsForSelectedColor]);

  if (!product) return null;

  const inWishlist = isInWishlist(product.id);
  const images = product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'];

  const handleWishlistClick = () => {
    if (!user) {
      toast.error('Please sign in to save items');
      return;
    }
    toggleWishlist(product.id);
  };

  const handleAddToCart = () => {
    const variant: ProductVariant | null = selectedVariant
      ? product.variants?.find((v) => v.id === selectedVariant) || null
      : null;

    if (!variant && product.variants && product.variants.length > 0) {
      addToCart(product, null, 1);
      toast.success('Added to cart. Choose your variant at checkout.');
      onOpenChange(false);
      return;
    }

    addToCart(product, variant, 1);
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
                    const isSelected = selectedColor === color;
                    const availableSizes = variants.filter((variant) => variant.color === color && (variant.stock || 0) > 0).length;
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedColor(color);
                          setSelectedSize(null);
                          setSelectedVariant(null);
                        }}
                        className={`px-4 py-2 rounded-md text-sm border transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary'
                        }`}
                        title={`${availableSizes} available size${availableSizes === 1 ? '' : 's'}`}
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
                <p className="text-sm font-medium mb-2">
                  Size{selectedColor ? ` for ${selectedColor}` : ''}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {sizesForSelectedColor.map(size => {
                    const variant = variantsForSelectedColor.find(v => v.size === size);
                    const isSelected = selectedSize === size && selectedVariant === variant?.id;
                    const isAvailable = (variant?.stock || 0) > 0;
                    return (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedSize(size);
                          setSelectedVariant(variant?.id || null);
                        }}
                        disabled={!isAvailable}
                        className={`w-10 h-10 rounded-md text-sm border transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : isAvailable
                              ? 'border-border hover:border-primary'
                              : 'border-border bg-muted text-muted-foreground line-through cursor-not-allowed'
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
                    <div key={opt.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{opt.name}</span>
                        <span>{opt.estimatedDays}</span>
                      </div>
                      {opt.details && (
                        <p className="text-xs text-muted-foreground">{opt.details}</p>
                      )}
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
