import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useProducts } from '@/hooks/useProducts';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { ProductCard } from './ProductCard';
import { useMemo } from 'react';

interface RecentlyViewedProductsProps {
  currentProductId?: string;
}

export function RecentlyViewedProducts({ currentProductId }: RecentlyViewedProductsProps) {
  const { recentlyViewed } = useRecentlyViewed();
  const { data: products } = useProducts();
  const { isEnabled } = useFeatureFlags();

  const recentProducts = useMemo(() => {
    if (!products || recentlyViewed.length === 0) return [];
    return recentlyViewed
      .filter((id) => id !== currentProductId)
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .slice(0, 6);
  }, [products, recentlyViewed, currentProductId]);

  if (recentProducts.length === 0 || !isEnabled('recently_viewed')) return null;

  return (
    <div className="mt-10 sm:mt-12">
      <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
        <h2 className="text-xl font-bold font-serif text-foreground sm:text-2xl">Recently Viewed</h2>
        <span className="text-xs text-muted-foreground sm:text-sm">{recentProducts.length} items</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {recentProducts.map((product: any) => (
          <ProductCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              description: product.description || '',
              category: product.category_name || 'Uncategorized',
              basePrice: product.base_price,
              images: product.images?.length > 0 ? product.images : ['https://via.placeholder.com/400'],
              variants: product.variants?.map((v: any) => ({
                id: v.id,
                size: v.size || undefined,
                color: v.color || undefined,
                price: v.price,
                stock: v.stock || 0,
              })) || [],
              shippingOptions: [],
              isGroupBuyEligible: product.is_group_buy_eligible || false,
              isFlashDeal: product.is_flash_deal || false,
              isFreeShippingEligible: product.is_free_shipping || false,
              rating: product.rating || 0,
              reviewCount: product.review_count || 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
