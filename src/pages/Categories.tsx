import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCategories } from '@/hooks/useCategories';
import { useProducts, ProductWithDetails } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Eye } from 'lucide-react';
import { icons } from 'lucide-react';
import { ProductQuickView } from '@/components/products/ProductQuickView';
import { getCategoryIconName } from '@/lib/categoryIcons';

// Convert product to quick view format
function toQuickViewFormat(product: ProductWithDetails) {
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

export default function Categories() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: products, isLoading: productsLoading } = useProducts();
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);

  const getCategoryProducts = (categoryId: string) => {
    return products?.filter((p) => p.category_id === categoryId).slice(0, 3) || [];
  };

  const isLoading = categoriesLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-serif text-foreground mb-3">
            Shop by Category
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse our curated collection of products from around the world
          </p>
        </div>

        {/* Category Grid */}
        <div className="space-y-12">
          {categories?.filter(c => c.is_active).map((category) => {
            const categoryProducts = getCategoryProducts(category.id);
            return (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const iconName = getCategoryIconName(category.name);
                      const Icon = (icons as any)[iconName] || icons.Package;
                      return (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {category.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {category.product_count || 0} products
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/products?category=${category.id}`}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View All
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryProducts.length > 0 ? (
                    categoryProducts.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`}>
                        <Card className="group overflow-hidden hover:shadow-md transition-all relative">
                          <div className="aspect-video overflow-hidden relative">
                            <img
                              src={product.images[0] || '/placeholder.svg'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Quick View Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 bg-background/80 hover:bg-background z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuickViewProduct(toQuickViewFormat(product));
                              }}
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-primary font-bold">
                              ₵{product.base_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  ) : (
                    <Card className="col-span-full p-8 text-center">
                      <p className="text-muted-foreground">
                        Products coming soon
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick View Modal */}
        <ProductQuickView
          product={quickViewProduct}
          open={!!quickViewProduct}
          onOpenChange={(open) => !open && setQuickViewProduct(null)}
        />
      </main>
      <Footer />
    </div>
  );
}
