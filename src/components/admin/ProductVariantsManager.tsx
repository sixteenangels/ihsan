import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';

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

export function ProductVariantsManager({ variants, onVariantsChange, basePrice }: ProductVariantsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentVariant, setCurrentVariant] = useState<VariantData>(defaultVariant);

  const handleAddVariant = () => {
    if (!currentVariant.size && !currentVariant.color) {
      return;
    }

    if (editingIndex !== null) {
      const updated = [...variants];
      updated[editingIndex] = currentVariant;
      onVariantsChange(updated);
    } else {
      onVariantsChange([...variants, currentVariant]);
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="variant-size">Size</Label>
                <Input
                  id="variant-size"
                  value={currentVariant.size}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, size: e.target.value })}
                  placeholder="e.g., S, M, L, XL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-color">Color</Label>
                <Input
                  id="variant-color"
                  value={currentVariant.color}
                  onChange={(e) => setCurrentVariant({ ...currentVariant, color: e.target.value })}
                  placeholder="e.g., Red, Blue, Black"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {variant.size && (
                    <Badge variant="secondary">Size: {variant.size}</Badge>
                  )}
                  {variant.color && (
                    <Badge variant="secondary">Color: {variant.color}</Badge>
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