import { useCompare } from '@/contexts/CompareContext';
import { useProducts } from '@/hooks/useProducts';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { X, GitCompare } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CompareBar() {
  const { isEnabled } = useFeatureFlags();
  const { compareItems, removeFromCompare, clearCompare } = useCompare();
  const { data: allProducts } = useProducts();

  const products = allProducts?.filter(p => compareItems.includes(p.id)) || [];

  if (compareItems.length === 0 || !isEnabled('compare')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 p-4">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-sm font-medium whitespace-nowrap">
            Compare ({compareItems.length}/4):
          </span>
          {products.map(product => (
            <div key={product.id} className="relative flex-shrink-0">
              <img
                src={product.images?.[0] || '/placeholder.svg'}
                alt={product.name}
                className="w-12 h-12 object-cover rounded border"
              />
              <button
                onClick={() => removeFromCompare(product.id)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearCompare}>
            Clear
          </Button>
          <Link to="/compare">
            <Button size="sm" disabled={compareItems.length < 2}>
              <GitCompare className="h-4 w-4 mr-1" />
              Compare Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}