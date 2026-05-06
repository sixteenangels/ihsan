import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from './ProductCard';
import { Loader2 } from 'lucide-react';
import { Product } from '@/types';

interface RelatedProductsProps {
  productId: string;
  categoryId: string | null;
}

export function RelatedProducts({ productId, categoryId }: RelatedProductsProps) {
  const { data: relatedProducts, isLoading } = useQuery({
    queryKey: ['related-products', productId, categoryId],
    queryFn: async (): Promise<Product[]> => {
      if (!categoryId) return [];

      // Fetch products from the same category, excluding current product
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, base_price, rating, review_count, is_flash_deal, is_group_buy_eligible, is_free_shipping, categories(name)')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .neq('id', productId)
        .limit(4);

      if (error) throw error;

      // Fetch first image for each product
      const productIds = products?.map(p => p.id) || [];
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .in('product_id', productIds)
        .eq('order_index', 0);

      const imageMap = new Map<string, string>();
      images?.forEach(img => {
        imageMap.set(img.product_id, img.image_url);
      });

      return (products || []).map(product => ({
        id: product.id,
        name: product.name,
        description: '',
        category: (product.categories as { name: string } | null)?.name || 'Uncategorized',
        basePrice: product.base_price,
        images: [imageMap.get(product.id) || 'https://via.placeholder.com/300'],
        variants: [],
        shippingOptions: [],
        isGroupBuyEligible: product.is_group_buy_eligible || false,
        isFlashDeal: product.is_flash_deal || false,
        isFreeShippingEligible: product.is_free_shipping || false,
        rating: product.rating || 0,
        reviewCount: product.review_count || 0,
      }));
    },
    enabled: !!categoryId,
  });

  if (!categoryId || isLoading) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    return null;
  }

  if (!relatedProducts || relatedProducts.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold font-serif text-foreground mb-6">
        Related Products
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {relatedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
