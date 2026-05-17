import { useEffect } from 'react';
import { useCompare } from '@/contexts/CompareContext';
import { useProducts } from '@/hooks/useProducts';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { GitCompare } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CompareBarProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export function CompareBar({ onVisibilityChange }: CompareBarProps) {
  const { isEnabled } = useFeatureFlags();
  const { compareItems, clearCompare } = useCompare();
  const { data: allProducts } = useProducts();

  const products = allProducts?.filter(p => compareItems.includes(p.id)) || [];
  const isVisible = compareItems.length > 0 && isEnabled('compare');

  useEffect(() => {
    onVisibilityChange?.(isVisible);

    return () => {
      onVisibilityChange?.(false);
    };
  }, [isVisible, onVisibilityChange]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[4.9rem] z-40 rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:p-4 md:shadow-lg">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden rounded-full bg-primary/10 p-2 text-primary sm:flex">
            <GitCompare className="h-4 w-4" />
          </div>
          <div className="flex -space-x-2 overflow-hidden pl-1">
            {products.slice(0, 3).map(product => (
              <img
                key={product.id}
                src={product.images?.[0] || '/placeholder.svg'}
                alt={product.name}
                className="h-10 w-10 rounded-xl border-2 border-background object-cover shadow-sm"
              />
            ))}
            {compareItems.length > 3 && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-background bg-muted text-xs font-semibold text-muted-foreground shadow-sm">
                +{compareItems.length - 3}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Compare Ready
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              {compareItems.length} product{compareItems.length === 1 ? '' : 's'} selected
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Open a side-by-side view when you have at least two items.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearCompare} className="hidden sm:inline-flex">
            Clear
          </Button>
          <Link to="/compare">
            <Button size="sm" disabled={compareItems.length < 2} className="min-w-[7.5rem]">
              <GitCompare className="mr-1 h-4 w-4" />
              Compare
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
