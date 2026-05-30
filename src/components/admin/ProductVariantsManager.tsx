import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface VariantData {
  id?: string;
  size: string;
  color: string;
  price_override: string;
  stock: string;
  sku: string;
  image_url?: string | null;
  image_file?: File | null;
  image_preview_url?: string | null;
}

interface ProductVariantsManagerProps {
  variants: VariantData[];
  onVariantsChange: (variants: VariantData[]) => void;
  basePrice: string;
}

interface DraftCombination {
  color: string;
  size: string;
  sizeIndex: number;
  combinationIndex: number;
  stock: string;
}

const defaultVariant: VariantData = {
  size: '',
  color: '',
  price_override: '',
  stock: '0',
  sku: '',
  image_url: null,
  image_file: null,
  image_preview_url: null,
};

function splitCommaValues(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitStockValues(value: string) {
  const values = value.split(',').map((entry) => entry.trim());

  if (values.length === 1 && values[0] === '') {
    return [];
  }

  return values;
}

function buildVariantKey(variant: VariantData) {
  return `${variant.color.trim().toLowerCase()}::${variant.size.trim().toLowerCase()}`;
}

function formatSkuPart(value: string, fallback: string) {
  return (value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getStockForCombination(
  stockValues: string[],
  sizeIndex: number,
  combinationIndex: number,
  sizeCount: number,
) {
  if (stockValues.length === 0) return '0';
  if (stockValues.length > sizeCount) return stockValues[combinationIndex] ?? stockValues[0] ?? '0';
  return stockValues[sizeIndex] ?? stockValues[0] ?? '0';
}

function buildVariantCombinations(variant: VariantData) {
  const sizes = splitCommaValues(variant.size);
  const colors = splitCommaValues(variant.color);
  const stockValues = splitStockValues(variant.stock);
  const sizeValues = sizes.length > 0 ? sizes : [''];
  const colorValues = colors.length > 0 ? colors : [''];
  const combinations = colorValues.flatMap((color) =>
    sizeValues.map((size, sizeIndex) => ({ color, size, sizeIndex })),
  );

  return combinations.map(({ color, size, sizeIndex }, index) => {
    const totalCombinations = combinations.length;
    const skuSuffix = formatSkuPart([color, size].filter(Boolean).join('-'), `VAR-${index + 1}`);

    return {
      ...variant,
      id: totalCombinations === 1 ? variant.id : undefined,
      color,
      size,
      stock: getStockForCombination(stockValues, sizeIndex, index, sizeValues.length),
      sku:
        variant.sku.trim() && totalCombinations > 1
          ? `${variant.sku.trim()}-${skuSuffix}`
          : variant.sku.trim(),
    };
  });
}

function buildDraftCombinations(variant: VariantData): DraftCombination[] {
  if (!variant.color.trim() && !variant.size.trim()) {
    return [];
  }

  const sizes = splitCommaValues(variant.size);
  const colors = splitCommaValues(variant.color);
  const stockValues = splitStockValues(variant.stock);
  const sizeValues = sizes.length > 0 ? sizes : [''];
  const colorValues = colors.length > 0 ? colors : [''];
  const combinations = colorValues.flatMap((color) =>
    sizeValues.map((size, sizeIndex) => ({ color, size, sizeIndex })),
  );

  return combinations.map((combination, index) => ({
    ...combination,
    combinationIndex: index,
    stock: getStockForCombination(stockValues, combination.sizeIndex, index, sizeValues.length),
  }));
}

function parseStock(stock: string) {
  return parseInt(stock, 10) || 0;
}

function mergeGeneratedVariant(existing: VariantData, generated: VariantData) {
  const hasGeneratedImage = Boolean(generated.image_file || generated.image_url);

  return {
    ...existing,
    color: generated.color,
    size: generated.size,
    stock: generated.stock,
    price_override: generated.price_override.trim() ? generated.price_override : existing.price_override,
    sku: generated.sku.trim() ? generated.sku : existing.sku,
    image_file: generated.image_file || existing.image_file,
    image_preview_url: generated.image_preview_url || existing.image_preview_url,
    image_url: hasGeneratedImage ? generated.image_url : existing.image_url,
  };
}

export function ProductVariantsManager({ variants, onVariantsChange, basePrice }: ProductVariantsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentVariant, setCurrentVariant] = useState<VariantData>(defaultVariant);
  const variantImageInputRef = useRef<HTMLInputElement>(null);
  const draftCombinations = useMemo(
    () => buildDraftCombinations(currentVariant),
    [currentVariant],
  );

  const handleDraftStockChange = (combinationIndex: number, stock: string) => {
    const nextStockValues = draftCombinations.map((combination) =>
      combination.combinationIndex === combinationIndex ? stock : combination.stock,
    );

    setCurrentVariant((prev) => ({
      ...prev,
      stock: nextStockValues.join(', '),
    }));
  };

  const handleAddVariant = () => {
    if (!currentVariant.size && !currentVariant.color) {
      return;
    }

    const generatedVariants = buildVariantCombinations(currentVariant);
    const baseVariants = editingIndex !== null
      ? variants.filter((_, index) => index !== editingIndex)
      : [...variants];
    const nextVariants = [...baseVariants];
    const existingIndexesByKey = new Map(
      baseVariants.map((variant, index) => [buildVariantKey(variant), index]),
    );
    const seenGeneratedKeys = new Set<string>();
    let addedCount = 0;
    let updatedCount = 0;

    generatedVariants.forEach((variant) => {
      const key = buildVariantKey(variant);
      if (seenGeneratedKeys.has(key)) return;

      seenGeneratedKeys.add(key);

      const existingIndex = existingIndexesByKey.get(key);
      if (existingIndex != null) {
        nextVariants[existingIndex] = mergeGeneratedVariant(nextVariants[existingIndex], variant);
        updatedCount += 1;
        return;
      }

      existingIndexesByKey.set(key, nextVariants.length);
      nextVariants.push(variant);
      addedCount += 1;
    });

    onVariantsChange(nextVariants);

    if (updatedCount > 0 && addedCount > 0) {
      toast.success(`Staged ${updatedCount} update${updatedCount === 1 ? '' : 's'} and ${addedCount} new variant${addedCount === 1 ? '' : 's'}. Save the product to publish.`);
    } else if (updatedCount > 0) {
      toast.success(`Staged ${updatedCount} variant update${updatedCount === 1 ? '' : 's'}. Save the product to publish.`);
    } else if (addedCount > 1) {
      toast.success(`Created ${addedCount} inventory variants. Save the product to publish.`);
    }

    setCurrentVariant(defaultVariant);
    setShowForm(false);
    setEditingIndex(null);
  };

  const handleEditVariant = (index: number) => {
    setCurrentVariant(variants[index]);
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleRemoveVariant = (index: number) => {
    onVariantsChange(variants.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    setCurrentVariant(defaultVariant);
    setShowForm(false);
    setEditingIndex(null);
  };

  const handleVariantImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Variant image is too large. Max 5MB.');
      return;
    }

    setCurrentVariant((prev) => ({
      ...prev,
      image_file: file,
      image_preview_url: URL.createObjectURL(file),
    }));

    if (variantImageInputRef.current) {
      variantImageInputRef.current.value = '';
    }
  };

  const clearVariantImage = () => {
    setCurrentVariant((prev) => ({
      ...prev,
      image_url: null,
      image_file: null,
      image_preview_url: null,
    }));
  };

  const getVariantDisplayPrice = (variant: VariantData) => {
    if (variant.price_override) {
      return parseFloat(variant.price_override);
    }
    return basePrice ? parseFloat(basePrice) : 0;
  };

  const groupedVariants = variants.reduce<Record<string, Array<{ variant: VariantData; index: number }>>>(
    (groups, variant, index) => {
      const colorKey = variant.color.trim() || 'No variant';
      if (!groups[colorKey]) {
        groups[colorKey] = [];
      }

      groups[colorKey].push({ variant, index });
      return groups;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-base font-semibold">Product Variants</Label>
        {!showForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-primary/50">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-color">Variant</Label>
                <Input
                  id="variant-color"
                  value={currentVariant.color}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, color: e.target.value })}
                  placeholder="e.g., Black"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one variant option like Black, then add all available sizes in the next field.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-size">Sizes</Label>
                <Input
                  id="variant-size"
                  value={currentVariant.size}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, size: e.target.value })}
                  placeholder="e.g., S, M, L, XL"
                />
                <p className="text-xs text-muted-foreground">
                  Commas create separate size options that customers select under this variant.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="variant-stock">Stock per Size</Label>
                <Input
                  id="variant-stock"
                  value={currentVariant.stock}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, stock: e.target.value })}
                  placeholder="e.g., 5, 3, 2, 8 or 5 for all"
                />
                <p className="text-xs text-muted-foreground">
                  Match the size order, enter one number for all, or use the stock boxes below.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-price">Price Override</Label>
                <Input
                  id="variant-price"
                  type="number"
                  step="0.01"
                  value={currentVariant.price_override}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, price_override: e.target.value })}
                  placeholder="Leave empty for base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-sku">SKU Prefix</Label>
                <Input
                  id="variant-sku"
                  value={currentVariant.sku}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, sku: e.target.value })}
                  placeholder="Optional SKU"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="space-y-1">
                <Label>Variant Image</Label>
                <p className="text-xs text-muted-foreground">
                  Upload a variant-specific image. If you create multiple combinations at once, the same image will be applied to those new rows until you edit them individually.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-20 w-20 overflow-hidden rounded-xl border border-border bg-background">
                  {currentVariant.image_preview_url || currentVariant.image_url ? (
                    <img
                      src={currentVariant.image_preview_url || currentVariant.image_url || ''}
                      alt="Variant preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    ref={variantImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleVariantImageSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => variantImageInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {currentVariant.image_preview_url || currentVariant.image_url ? 'Replace Image' : 'Upload Image'}
                  </Button>
                  {(currentVariant.image_preview_url || currentVariant.image_url) ? (
                    <Button type="button" variant="outline" className="flex-1" onClick={clearVariantImage}>
                      Remove Image
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {draftCombinations.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Inventory rows to save</p>
                    <p className="text-xs text-muted-foreground">
                      Set stock for each variant and size before saving.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {draftCombinations.length} row{draftCombinations.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {draftCombinations.map((combination) => (
                    <div
                      key={`${combination.color}-${combination.size}-${combination.combinationIndex}`}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(6.75rem,8rem)] items-end gap-3 rounded-md border border-border bg-background p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {combination.color || 'Default variant'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Size: {combination.size || 'Default size'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`variant-stock-${combination.combinationIndex}`}
                          className="text-xs"
                        >
                          Stock
                        </Label>
                        <Input
                          id={`variant-stock-${combination.combinationIndex}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={combination.stock}
                          className="h-11"
                          onChange={(event) =>
                            handleDraftStockChange(combination.combinationIndex, event.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddVariant}
                disabled={!currentVariant.size && !currentVariant.color}
              >
                Save Variant{editingIndex === null && draftCombinations.length > 1 ? `s (${draftCombinations.length})` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {variants.length > 0 && (
        <div className="space-y-3">
          {Object.entries(groupedVariants).map(([color, entries]) => (
            <div key={color} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">Variant: {color}</p>
                  <p className="text-xs text-muted-foreground">
                    {entries.length} size option{entries.length === 1 ? '' : 's'} in inventory
                  </p>
                </div>
                <Badge variant="secondary">
                  {entries.reduce((sum, entry) => sum + parseStock(entry.variant.stock), 0)} total
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {entries.map(({ variant, index }) => (
                  <div
                    key={`${variant.color}-${variant.size}-${index}`}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {variant.image_preview_url || variant.image_url ? (
                          <img
                            src={variant.image_preview_url || variant.image_url || ''}
                            alt={`${variant.color || 'Default'} variant`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImagePlus className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap gap-2">
                        <Badge variant="outline">Size: {variant.size || 'Default'}</Badge>
                        <Badge variant={parseStock(variant.stock) > 0 ? 'secondary' : 'destructive'}>
                          {parseStock(variant.stock)} in stock
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${getVariantDisplayPrice(variant).toFixed(2)}
                        {variant.sku ? ` - SKU: ${variant.sku}` : ''}
                      </p>
                    </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleEditVariant(index)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveVariant(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {variants.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No variants added. Add a variant, comma-separated sizes, and stock to create selectable inventory.
        </p>
      )}
    </div>
  );
}
