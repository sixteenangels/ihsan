import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface VariantData {
  id?: string;
  size: string;
  color: string;
  price_override: string;
  stock: string;
  sku: string;
}

interface ProductVariantsManagerProps {
  variants: VariantData[];
  onVariantsChange: (variants: VariantData[]) => void;
  basePrice: string;
}

const defaultVariant: VariantData = {
  size: '',
  color: '',
  price_override: '',
  stock: '0',
  sku: '',
};

function splitCommaValues(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function buildVariantCombinations(variant: VariantData) {
  const sizes = splitCommaValues(variant.size);
  const colors = splitCommaValues(variant.color);
  const sizeValues = sizes.length > 0 ? sizes : [''];
  const colorValues = colors.length > 0 ? colors : [''];
  const combinations = colorValues.flatMap((color) =>
    sizeValues.map((size) => ({ color, size })),
  );

  return combinations.map(({ color, size }, index) => {
    const totalCombinations = combinations.length;
    const skuSuffix = formatSkuPart([color, size].filter(Boolean).join('-'), `VAR-${index + 1}`);

    return {
      ...variant,
      id: totalCombinations === 1 ? variant.id : undefined,
      color,
      size,
      sku:
        variant.sku.trim() && totalCombinations > 1
          ? `${variant.sku.trim()}-${skuSuffix}`
          : variant.sku.trim(),
    };
  });
}

export function ProductVariantsManager({ variants, onVariantsChange, basePrice }: ProductVariantsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentVariant, setCurrentVariant] = useState<VariantData>(defaultVariant);

  const handleAddVariant = () => {
    if (!currentVariant.size && !currentVariant.color) {
      return;
    }

    const generatedVariants = buildVariantCombinations(currentVariant);
    const existingKeys = new Set(
      variants
        .filter((_, index) => index !== editingIndex)
        .map(buildVariantKey),
    );
    const uniqueGeneratedVariants = generatedVariants.filter((variant) => {
      const key = buildVariantKey(variant);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (uniqueGeneratedVariants.length === 0) {
      toast.error('Those variant combinations already exist.');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...variants];
      updated.splice(editingIndex, 1, ...uniqueGeneratedVariants);
      onVariantsChange(updated);
    } else {
      onVariantsChange([...variants, ...uniqueGeneratedVariants]);
    }

    if (uniqueGeneratedVariants.length > 1) {
      toast.success(`Created ${uniqueGeneratedVariants.length} variants.`);
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

  const getVariantDisplayPrice = (variant: VariantData) => {
    if (variant.price_override) {
      return parseFloat(variant.price_override);
    }
    return basePrice ? parseFloat(basePrice) : 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Product Variants</Label>
        {!showForm && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        )}
      </div>

      {/* Variant Form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-size">Size(s)</Label>
                <Input
                  id="variant-size"
                  value={currentVariant.size}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, size: e.target.value })}
                  placeholder="e.g., S, M, L, XL"
                />
                <p className="text-xs text-muted-foreground">
                  Separate sizes with commas to create one variant per size.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-color">Colour</Label>
                <Input
                  id="variant-color"
                  value={currentVariant.color}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, color: e.target.value })}
                  placeholder="e.g., Black"
                />
                <p className="text-xs text-muted-foreground">
                  You can also enter multiple colours with commas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <Label htmlFor="variant-stock">Stock *</Label>
                <Input
                  id="variant-stock"
                  type="number"
                  value={currentVariant.stock}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-sku">SKU</Label>
                <Input
                  id="variant-sku"
                  value={currentVariant.sku}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, sku: e.target.value })}
                  placeholder="Optional SKU"
                />
              </div>
            </div>

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
                {editingIndex !== null ? 'Update' : 'Add'} Variant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variants List */}
      {variants.length > 0 && (
        <div className="space-y-2">
          {variants.map((variant, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-2 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
                <div className="flex flex-wrap gap-2">
                  {variant.size && (
                    <Badge variant="secondary">Size: {variant.size}</Badge>
                  )}
                  {variant.color && (
                    <Badge variant="secondary">Colour: {variant.color}</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  ${getVariantDisplayPrice(variant).toFixed(2)} • {variant.stock} in stock
                  {variant.sku && ` • SKU: ${variant.sku}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditVariant(index)}
                >
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
      )}

      {variants.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No variants added. Click "Add Variant" to create size/color options.
        </p>
      )}
    </div>
  );
}
