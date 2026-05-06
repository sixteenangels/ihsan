import { useState, useMemo } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number | null;
}

interface SelectedVariant extends Variant {
  quantity: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariants: SelectedVariant[];
  onVariantToggle: (variant: Variant) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
}

// Common color mappings for visual swatches
const colorMap: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  purple: '#A855F7',
  pink: '#EC4899',
  orange: '#F97316',
  gray: '#6B7280',
  grey: '#6B7280',
  brown: '#92400E',
  navy: '#1E3A5A',
  beige: '#D4C4A8',
  gold: '#D4AF37',
  silver: '#C0C0C0',
  cream: '#FFFDD0',
  maroon: '#800000',
  teal: '#14B8A6',
  coral: '#FF7F50',
  olive: '#808000',
};

function getColorHex(colorName: string | null): string | null {
  if (!colorName) return null;
  const normalized = colorName.toLowerCase().trim();
  return colorMap[normalized] || null;
}

export function VariantSelector({
  variants,
  selectedVariants,
  onVariantToggle,
  onQuantityChange,
}: VariantSelectorProps) {
  const { formatPrice } = useCurrency();
  
  // Group variants by color and size
  const uniqueColors = useMemo(() => {
    const colors = new Set<string>();
    variants.forEach((v) => {
      if (v.color) colors.add(v.color);
    });
    return Array.from(colors);
  }, [variants]);

  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    variants.forEach((v) => {
      if (v.size) sizes.add(v.size);
    });
    return Array.from(sizes);
  }, [variants]);

  const [selectedColor, setSelectedColor] = useState<string | null>(
    uniqueColors.length > 0 ? uniqueColors[0] : null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(
    uniqueSizes.length > 0 ? uniqueSizes[0] : null
  );

  // Find the variant that matches current selection
  const currentVariant = useMemo(() => {
    return variants.find((v) => {
      const colorMatch = !uniqueColors.length || v.color === selectedColor;
      const sizeMatch = !uniqueSizes.length || v.size === selectedSize;
      return colorMatch && sizeMatch;
    });
  }, [variants, selectedColor, selectedSize, uniqueColors.length, uniqueSizes.length]);

  const isVariantSelected = (variantId: string) => {
    return selectedVariants.some((v) => v.id === variantId);
  };

  const getSelectedQuantity = (variantId: string) => {
    const selected = selectedVariants.find((v) => v.id === variantId);
    return selected?.quantity || 1;
  };

  // If no colors or sizes, show simple variant list
  if (uniqueColors.length === 0 && uniqueSizes.length === 0) {
    return (
      <div className="space-y-3">
        {variants.map((variant) => {
          const isSelected = isVariantSelected(variant.id);
          const quantity = getSelectedQuantity(variant.id);
          
          return (
            <div
              key={variant.id}
              className={cn(
                'flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => onVariantToggle(variant)}
            >
              <div>
                <p className="font-medium text-foreground">
                  {formatPrice(variant.price)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {variant.stock || 0} in stock
                </p>
              </div>
              {isSelected && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuantityChange(variant.id, Math.max(1, quantity - 1));
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuantityChange(variant.id, quantity + 1);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Color Selector */}
      {uniqueColors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Color</h4>
            {selectedColor && (
              <span className="text-sm text-muted-foreground capitalize">
                {selectedColor}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {uniqueColors.map((color) => {
              const hexColor = getColorHex(color);
              const isSelected = selectedColor === color;
              
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'relative h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center',
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                      : 'border-border hover:border-primary/50'
                  )}
                  style={hexColor ? { backgroundColor: hexColor } : undefined}
                  title={color}
                >
                  {!hexColor && (
                    <span className="text-xs font-medium text-foreground uppercase">
                      {color.slice(0, 2)}
                    </span>
                  )}
                  {isSelected && hexColor && (
                    <Check
                      className={cn(
                        'h-5 w-5',
                        hexColor === '#FFFFFF' || hexColor === '#FFFDD0'
                          ? 'text-foreground'
                          : 'text-white'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {uniqueSizes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Size</h4>
          <div className="flex flex-wrap gap-2">
            {uniqueSizes.map((size) => {
              const isSelected = selectedSize === size;
              // Check if this size is available for selected color
              const variantForSize = variants.find(
                (v) =>
                  v.size === size &&
                  (uniqueColors.length === 0 || v.color === selectedColor)
              );
              const isAvailable = variantForSize && (variantForSize.stock || 0) > 0;

              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!isAvailable}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isAvailable
                      ? 'border-border hover:border-primary/50 text-foreground'
                      : 'border-border bg-muted text-muted-foreground cursor-not-allowed line-through'
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Selection Info */}
      {currentVariant && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(currentVariant.price)}
              </p>
              <p className="text-sm text-muted-foreground">
                {(currentVariant.stock || 0) > 0 ? (
                  <span className="text-primary">
                    {currentVariant.stock} in stock
                  </span>
                ) : (
                  <span className="text-destructive">Out of stock</span>
                )}
              </p>
            </div>
            {isVariantSelected(currentVariant.id) ? (
              <Badge className="bg-primary text-primary-foreground">
                <Check className="h-3 w-3 mr-1" />
                Added
              </Badge>
            ) : null}
          </div>

          {isVariantSelected(currentVariant.id) ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantity:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    onQuantityChange(
                      currentVariant.id,
                      Math.max(1, getSelectedQuantity(currentVariant.id) - 1)
                    )
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-medium">
                  {getSelectedQuantity(currentVariant.id)}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    onQuantityChange(
                      currentVariant.id,
                      getSelectedQuantity(currentVariant.id) + 1
                    )
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}

          <Button
            className="w-full"
            onClick={() => onVariantToggle(currentVariant)}
            disabled={(currentVariant.stock || 0) === 0}
          >
            {isVariantSelected(currentVariant.id)
              ? 'Remove from Selection'
              : 'Add to Selection'}
          </Button>
        </div>
      )}

      {/* Selected Variants Summary */}
      {selectedVariants.length > 0 && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <h4 className="font-medium text-foreground">
            {selectedVariants.length} variant(s) selected
          </h4>
          <div className="space-y-1">
            {selectedVariants.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {v.color || 'Default'}
                  {v.size && ` - ${v.size}`} × {v.quantity}
                </span>
                <span className="font-medium text-foreground">
                  {formatPrice(v.price * v.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
