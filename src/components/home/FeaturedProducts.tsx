import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useProducts, ProductWithDetails } from '@/hooks/useProducts';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductQuickView } from '@/components/products/ProductQuickView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Adapter to convert DB product to the format expected by ProductCard
function toProductCardFormat(product: ProductWithDetails) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category_name || 'Uncategorized',
    basePrice: product.base_price,
    images: product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'],
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size || undefined,
      color: v.color || undefined,
      price: v.price,
      stock: v.stock || 0,
    })),
    shippingOptions: product.shipping_rules
      .filter((r) => r.is_allowed && r.shipping_class)
      .map((r) => ({
        id: r.id,
        type: (r.shipping_class?.shipping_type?.name?.toLowerCase().includes('sea')
          ? 'sea'
          : r.shipping_class?.shipping_type?.name?.toLowerCase().includes('express')
          ? 'air_express'
          : 'air_normal') as 'sea' | 'air_normal' | 'air_express',
        name: r.shipping_class?.name || '',
        price: r.price,
        estimatedDays: r.shipping_class
          ? `${r.shipping_class.estimated_days_min}-${r.shipping_class.estimated_days_max} days`
          : '',
        available: true,
      })),
    isGroupBuyEligible: product.is_group_buy_eligible || false,
    isFlashDeal: product.is_flash_deal || false,
    isFreeShippingEligible: product.is_free_shipping || false,
    rating: product.rating || 0,
    reviewCount: product.review_count || 0,
  };
}

export function FeaturedProducts() {
  const { data: products, isLoading } = useProducts();
  const featuredProducts = products?.slice(0, 4) || [];
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);

  return (
    <section className="py-16 bg-card">
      <div className="container">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold font-serif text-foreground mb-2">
              Featured Products
            </h2>
            <p className="text-muted-foreground">
              Handpicked items from our best sellers
            </p>
          </div>
          <Link to="/products">
            <Button variant="ghost" className="group">
              View All
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-4">
                  <Skeleton className="aspect-square w-full rounded-lg mb-4" />
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))
            : featuredProducts.map((product) => {
                const cardProduct = toProductCardFormat(product);
                return (
                  <ProductCard 
                    key={product.id} 
                    product={cardProduct}
                    onQuickView={(p) => setQuickViewProduct(p)}
                  />
                );
              })}
        </div>

        {!isLoading && featuredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No products available yet.</p>
          </div>
        )}

        {/* Quick View Modal */}
        <ProductQuickView
          product={quickViewProduct}
          open={!!quickViewProduct}
          onOpenChange={(open) => !open && setQuickViewProduct(null)}
        />
      </div>
    </section>
  );
}
