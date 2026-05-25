import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number | null;
  image_url?: string | null;
}

interface SelectedVariant extends Variant {
  quantity: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariants: SelectedVariant[];
  onAddVariantSelection: (variant: Variant, quantity: number) => void;
  onRemoveVariantSelection: (variantId: string) => void;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onClearAll?: () => void;
  onCurrentVariantChange?: (variant: Variant | null) => void;
  mode?: 'default' | 'mobile';
}

type VisualOption = {
  key: string;
  label: string;
  imageUrl: string | null;
  variants: Variant[];
};

function getUniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getVariantStock(variant?: Variant) {
  return variant?.stock || 0;
}

function getVariantSummaryLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard option';
}

function getVariantPrimaryLabel(variant: { color: string | null; size: string | null }) {
  return variant.color || variant.size || 'Standard option';
}

function getVariantSecondaryLabel(variant: { color: string | null; size: string | null }) {
  if (variant.color && variant.size) {
    return variant.size;
  }

  return null;
}

function buildVisualOptions(variants: Variant[], hasColorDimension: boolean, hasVisualOnlyMode: boolean) {
  if (hasColorDimension) {
    const colors = getUniqueValues(variants.map((variant) => variant.color));

    return colors.map((color) => {
      const matchingVariants = variants.filter((variant) => variant.color === color);
      const previewVariant =
        matchingVariants.find((variant) => variant.image_url) ||
        matchingVariants.find((variant) => getVariantStock(variant) > 0) ||
        matchingVariants[0];

      return {
        key: color,
        label: color,
        imageUrl: previewVariant?.image_url || null,
        variants: matchingVariants,
      };
    });
  }

  if (hasVisualOnlyMode) {
    return variants.map((variant) => ({
      key: variant.id,
      label: getVariantPrimaryLabel(variant),
      imageUrl: variant.image_url || null,
      variants: [variant],
    }));
  }

  return [] as VisualOption[];
}

export function VariantSelector({
  variants,
  selectedVariants,
  onAddVariantSelection,
  onRemoveVariantSelection,
  onQuantityChange,
  onClearAll,
  onCurrentVariantChange,
  mode = 'default',
}: VariantSelectorProps) {
  const { formatPrice } = useCurrency();
  const isMobile = mode === 'mobile';

  const uniqueColors = useMemo(
    () => getUniqueValues(variants.map((variant) => variant.color)),
    [variants],
  );
  const uniqueSizes = useMemo(
    () => getUniqueValues(variants.map((variant) => variant.size)),
    [variants],
  );
  const hasColorDimension = uniqueColors.length > 0;
  const hasSizeDimension = uniqueSizes.length > 0;
  const hasVisualOnlyMode =
    !hasColorDimension &&
    variants.length > 1 &&
    variants.some((variant) => variant.image_url) &&
    !hasSizeDimension;

  const visualOptions = useMemo(
    () => buildVisualOptions(variants, hasColorDimension, hasVisualOnlyMode),
    [hasColorDimension, hasVisualOnlyMode, variants],
  );

  const [selectedVisualKey, setSelectedVisualKey] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState(1);

  useEffect(() => {
    if (visualOptions.length === 0) {
      setSelectedVisualKey(null);
      return;
    }

    setSelectedVisualKey((current) =>
      current && visualOptions.some((option) => option.key === current)
        ? current
        : visualOptions[0].key,
    );
  }, [visualOptions]);

  const variantsForSelectedVisual = useMemo(() => {
    if (visualOptions.length === 0) {
      return variants;
    }

    return visualOptions.find((option) => option.key === selectedVisualKey)?.variants || variants;
  }, [selectedVisualKey, variants, visualOptions]);

  const sizeOptions = useMemo(() => {
    if (hasColorDimension) {
      return getUniqueValues(variantsForSelectedVisual.map((variant) => variant.size));
    }

    if (!visualOptions.length && hasSizeDimension) {
      return uniqueSizes;
    }

    return [] as string[];
  }, [hasColorDimension, hasSizeDimension, uniqueSizes, variantsForSelectedVisual, visualOptions.length]);

  useEffect(() => {
    if (sizeOptions.length === 0) {
      setSelectedSize(null);
      return;
    }

    setSelectedSize((current) => {
      if (current && sizeOptions.includes(current)) {
        return current;
      }

      const firstInStockVariant = variantsForSelectedVisual.find((variant) => getVariantStock(variant) > 0);
      return firstInStockVariant?.size || sizeOptions[0];
    });
  }, [sizeOptions, variantsForSelectedVisual]);

  const currentVariant = useMemo(() => {
    if (sizeOptions.length > 0) {
      return variantsForSelectedVisual.find((variant) => variant.size === selectedSize) || null;
    }

    return variantsForSelectedVisual[0] || null;
  }, [selectedSize, sizeOptions.length, variantsForSelectedVisual]);

  const selectedCurrentVariant = currentVariant
    ? selectedVariants.find((variant) => variant.id === currentVariant.id) || null
    : null;

  useEffect(() => {
    onCurrentVariantChange?.(currentVariant);
  }, [currentVariant, onCurrentVariantChange]);

  useEffect(() => {
    if (!currentVariant) {
      setPendingQuantity(1);
      return;
    }

    setPendingQuantity(selectedCurrentVariant?.quantity ?? 1);
  }, [currentVariant, selectedCurrentVariant]);

  const selectedVariantCount = selectedVariants.length;
  const selectedItemCount = selectedVariants.reduce((sum, variant) => sum + variant.quantity, 0);
  const selectedTotal = selectedVariants.reduce(
    (sum, variant) => sum + variant.price * variant.quantity,
    0,
  );

  const addButtonLabel = selectedCurrentVariant ? 'Update Selection' : 'Add to Selection';
  const helperLabel = currentVariant ? getVariantSummaryLabel(currentVariant) : null;

  return (
    <div className="space-y-4">
      {visualOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">
            {hasColorDimension ? 'Select Color' : 'Select Style'}
          </p>
          <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 scroll-smooth [scrollbar-width:none] [touch-action:pan-x]">
            {visualOptions.map((option) => {
              const isSelected = selectedVisualKey === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  className={cn(
                    'relative min-w-[88px] snap-start overflow-hidden rounded-2xl border bg-card/80 p-1.5 text-left transition-all',
                    isMobile ? 'w-[92px]' : 'w-[104px]',
                    isSelected
                      ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]'
                      : 'border-border/70 hover:border-primary/50',
                  )}
                  onClick={() => setSelectedVisualKey(option.key)}
                >
                  <div className="overflow-hidden rounded-[0.95rem] bg-muted">
                    {option.imageUrl ? (
                      <img
                        src={option.imageUrl}
                        alt={option.label}
                        className={cn('w-full object-cover', isMobile ? 'h-14' : 'h-16')}
                      />
                    ) : (
                      <div className={cn('w-full bg-muted', isMobile ? 'h-14' : 'h-16')} />
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium capitalize text-foreground">
                    {option.label}
                  </p>
                  {isSelected ? (
                    <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {sizeOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Select Size
          </p>
          <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 scroll-smooth [scrollbar-width:none] [touch-action:pan-x]">
            {sizeOptions.map((size) => {
              const variantForSize = variantsForSelectedVisual.find((variant) => variant.size === size);
              const isSelected = selectedSize === size;
              const isAvailable = getVariantStock(variantForSize) > 0;

              return (
                <button
                  key={size}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => setSelectedSize(size)}
                  className={cn(
                    'snap-start rounded-2xl border px-4 py-3 text-left transition-all',
                    isMobile ? 'min-h-[74px] min-w-[132px] max-w-[150px]' : 'min-w-[96px]',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary))]'
                      : isAvailable
                        ? 'border-border/70 bg-card/70 text-foreground hover:border-primary/40'
                        : 'cursor-not-allowed border-border/50 bg-muted text-muted-foreground',
                  )}
                >
                  <p className="line-clamp-2 text-sm font-medium leading-5 [overflow-wrap:anywhere]">
                    {size}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {currentVariant ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quantity</p>
          <div className={cn('grid gap-2', isMobile ? 'grid-cols-[auto,1fr]' : 'grid-cols-[auto,1fr] sm:max-w-md')}>
            <div className="flex items-center gap-1 rounded-[1.15rem] border border-border/70 bg-card/80 px-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-xl"
                onClick={() => setPendingQuantity((current) => Math.max(1, current - 1))}
                disabled={pendingQuantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-semibold text-foreground">{pendingQuantity}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-xl"
                onClick={() => setPendingQuantity((current) => current + 1)}
                disabled={pendingQuantity >= Math.max(1, getVariantStock(currentVariant))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              className="h-12 min-w-0 overflow-hidden rounded-[1.15rem]"
              onClick={() => onAddVariantSelection(currentVariant, pendingQuantity)}
              disabled={getVariantStock(currentVariant) <= 0}
            >
              <span className="truncate">{addButtonLabel}</span>
            </Button>
          </div>

          {selectedCurrentVariant && helperLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{helperLabel} added to your selection</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedVariants.length > 0 ? (
        <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-card/80 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Selected Variants ({selectedVariantCount})</p>
              <p className="text-xs text-muted-foreground">
                {selectedVariantCount} variant{selectedVariantCount === 1 ? '' : 's'} / {selectedItemCount} item{selectedItemCount === 1 ? '' : 's'}
              </p>
            </div>
            {onClearAll ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={onClearAll}
              >
                Clear All
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {selectedVariants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-[1.35rem] border border-border/70 bg-background/80 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className={cn('shrink-0 overflow-hidden rounded-xl bg-muted', isMobile ? 'h-12 w-12' : 'h-14 w-14')}>
                    {variant.image_url ? (
                      <img
                        src={variant.image_url}
                        alt={getVariantSummaryLabel(variant)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium leading-tight text-foreground">
                          {getVariantSummaryLabel(variant)}
                        </p>
                        {getVariantSecondaryLabel(variant) ? (
                          <p className="text-xs text-muted-foreground">
                            {getVariantSecondaryLabel(variant)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-medium text-primary">
                          {formatPrice(variant.price)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                        onClick={() => onRemoveVariantSelection(variant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card px-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => onQuantityChange(variant.id, Math.max(1, variant.quantity - 1))}
                          disabled={variant.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center font-semibold text-foreground">{variant.quantity}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => onQuantityChange(variant.id, variant.quantity + 1)}
                          disabled={variant.stock != null ? variant.quantity >= variant.stock : false}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        {formatPrice(variant.price * variant.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              'rounded-[1.35rem] border p-3.5',
              isMobile
                ? 'border-border/70 bg-background/90'
                : 'border-primary/15 bg-primary/5',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className={cn(
                    'mt-0.5 rounded-full p-1.5',
                    isMobile ? 'bg-primary/12 text-primary' : 'bg-primary/10 text-primary',
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {isMobile ? `${selectedItemCount} item${selectedItemCount === 1 ? '' : 's'} selected` : 'Selected Items Total'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVariantCount} variant{selectedVariantCount === 1 ? '' : 's'} / {selectedItemCount} item{selectedItemCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {isMobile ? (
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total (Est.)</p>
                ) : null}
                <p className="text-right text-xl font-bold text-primary">{formatPrice(selectedTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
