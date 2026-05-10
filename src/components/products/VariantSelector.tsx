import { useEffect, useMemo, useState } from 'react';
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

function getVariantStock(variant?: Variant) {
  return variant?.stock || 0;
}

function getUniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function VariantSelector({
  variants,
  selectedVariants,
  onVariantToggle,
  onQuantityChange,
}: VariantSelectorProps) {
  const { formatPrice } = useCurrency();

  const uniqueColors = useMemo(
    () => getUniqueValues(variants.map((variant) => variant.color)),
    [variants],
  );
  const uniqueSizes = useMemo(
    () => getUniqueValues(variants.map((variant) => variant.size)),
    [variants],
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    if (uniqueColors.length === 0) {
      setSelectedColor(null);
      return;
    }

    setSelectedColor((currentColor) =>
      currentColor && uniqueColors.includes(currentColor) ? currentColor : uniqueColors[0],
    );
  }, [uniqueColors]);

  const variantsForSelectedColor = useMemo(() => {
    if (uniqueColors.length === 0) return variants;
    return variants.filter((variant) => variant.color === selectedColor);
  }, [selectedColor, uniqueColors.length, variants]);

  const sizesForSelectedColor = useMemo(
    () => getUniqueValues(variantsForSelectedColor.map((variant) => variant.size)),
    [variantsForSelectedColor],
  );

  useEffect(() => {
    if (sizesForSelectedColor.length === 0) {
      setSelectedSize(null);
      return;
    }

    setSelectedSize((currentSize) => {
      if (currentSize && sizesForSelectedColor.includes(currentSize)) {
        return currentSize;
      }

      const firstInStockVariant = variantsForSelectedColor.find((variant) => getVariantStock(variant) > 0);
      return firstInStockVariant?.size || sizesForSelectedColor[0];
    });
  }, [sizesForSelectedColor, variantsForSelectedColor]);

  const currentVariant = useMemo(() => {
    if (sizesForSelectedColor.length === 0) {
      return variantsForSelectedColor[0];
    }

    return variantsForSelectedColor.find((variant) => variant.size === selectedSize);
  }, [selectedSize, sizesForSelectedColor.length, variantsForSelectedColor]);

  const isVariantSelected = (variantId: string) => {
    return selectedVariants.some((variant) => variant.id === variantId);
  };

  const getSelectedQuantity = (variantId: string) => {
    const selected = selectedVariants.find((variant) => variant.id === variantId);
    return selected?.quantity || 1;
  };

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
                  : 'border-border hover:border-primary/50',
              )}
              onClick={() => onVariantToggle(variant)}
            >
              <div>
                <p className="font-medium text-foreground">{formatPrice(variant.price)}</p>
                <p className="text-sm text-muted-foreground">{getVariantStock(variant)} in stock</p>
              </div>
              {isSelected && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={(event) => {
                      event.stopPropagation();
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
                    onClick={(event) => {
                      event.stopPropagation();
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
      {uniqueColors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Colour</h4>
            {selectedColor && (
              <span className="text-sm text-muted-foreground capitalize">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {uniqueColors.map((color) => {
              const hexColor = getColorHex(color);
              const isSelected = selectedColor === color;
              const colorVariants = variants.filter((variant) => variant.color === color);
              const availableSizeCount = colorVariants.filter((variant) => getVariantStock(variant) > 0).length;

              return (
                <button
                  key={color}
                  onClick={() => {
                    setSelectedColor(color);
                    setSelectedSize(null);
                  }}
                  className={cn(
                    'flex min-h-12 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50',
                  )}
                  title={`${color} - ${availableSizeCount} available size${availableSizeCount === 1 ? '' : 's'}`}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border"
                    style={hexColor ? { backgroundColor: hexColor } : undefined}
                  >
                    {isSelected && hexColor && (
                      <Check
                        className={cn(
                          'h-4 w-4',
                          hexColor === '#FFFFFF' || hexColor === '#FFFDD0'
                            ? 'text-foreground'
                            : 'text-white',
                        )}
                      />
                    )}
                    {!hexColor && <span className="text-[10px] font-medium uppercase">{color.slice(0, 2)}</span>}
                  </span>
                  <span className="capitalize">{color}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizesForSelectedColor.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">
              Size{selectedColor ? ` for ${selectedColor}` : ''}
            </h4>
            <span className="text-xs text-muted-foreground">
              {sizesForSelectedColor.length} option{sizesForSelectedColor.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizesForSelectedColor.map((size) => {
              const variantForSize = variantsForSelectedColor.find((variant) => variant.size === size);
              const isSelected = selectedSize === size;
              const isAvailable = getVariantStock(variantForSize) > 0;

              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!isAvailable}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isAvailable
                        ? 'border-border text-foreground hover:border-primary/50'
                        : 'cursor-not-allowed border-border bg-muted text-muted-foreground line-through',
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {currentVariant && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">{formatPrice(currentVariant.price)}</p>
              <p className="text-sm text-muted-foreground">
                {getVariantStock(currentVariant) > 0 ? (
                  <span className="text-primary">{getVariantStock(currentVariant)} in stock</span>
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
                    onQuantityChange(currentVariant.id, Math.max(1, getSelectedQuantity(currentVariant.id) - 1))
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-medium">{getSelectedQuantity(currentVariant.id)}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => onQuantityChange(currentVariant.id, getSelectedQuantity(currentVariant.id) + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}

          <Button
            className="w-full"
            onClick={() => onVariantToggle(currentVariant)}
            disabled={getVariantStock(currentVariant) === 0}
          >
            {isVariantSelected(currentVariant.id) ? 'Remove from Selection' : 'Add to Selection'}
          </Button>
        </div>
      )}

      {selectedVariants.length > 0 && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
          <h4 className="font-medium text-foreground">{selectedVariants.length} variant(s) selected</h4>
          <div className="space-y-1">
            {selectedVariants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {variant.color || 'Default'}
                  {variant.size && ` - ${variant.size}`} x {variant.quantity}
                </span>
                <span className="font-medium text-foreground">
                  {formatPrice(variant.price * variant.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
