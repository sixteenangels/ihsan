import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCategories } from '@/hooks/useCategories';
import { useProducts, ProductWithDetails } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Eye } from 'lucide-react';
import { ProductQuickView } from '@/components/products/ProductQuickView';
import { formatCategoryLabel, getCategoryIconComponent } from '@/lib/categoryIcons';

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
  const [quickViewProduct, setQuickViewProduct] = useState<ReturnType<typeof toQuickViewFormat> | null>(null);

  const getCategoryProducts = (categoryId: string) => {
    return products?.filter((p) => p.category_id === categoryId).slice(0, 3) || [];
  };

  const isLoading = categoriesLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex min-h-[60vh] items-center justify-center px-4 py-8 sm:px-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-10 text-center sm:mb-12">
          <h1 className="mb-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
            Shop by Category
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Browse our curated collection of products from around the world
          </p>
        </div>

        <div className="space-y-10 sm:space-y-12">
          {categories?.filter((c) => c.is_active).map((category) => {
            const categoryProducts = getCategoryProducts(category.id);
            const Icon = getCategoryIconComponent(category.name);

            return (
              <div key={category.id} className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                        {formatCategoryLabel(category.name)}
                      </h2>
                      <p className="text-sm text-muted-foreground">{category.product_count || 0} products</p>
                    </div>
                  </div>
                  <Link
                    to={`/products?category=${category.id}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline sm:text-base"
                  >
                    View All
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {categoryProducts.length > 0 ? (
                    categoryProducts.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`}>
                        <Card className="group relative overflow-hidden transition-all hover:shadow-md">
                          <div className="relative aspect-video overflow-hidden">
                            <img
                              src={product.images[0] || '/placeholder.svg'}
                              alt={product.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 z-10 h-8 w-8 bg-background/80 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuickViewProduct(toQuickViewFormat(product));
                              }}
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          <CardContent className="p-3 sm:p-4">
                            <h3 className="line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-primary">
                              {product.name}
                            </h3>
                            <p className="font-bold text-primary">
                              GHS {product.base_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  ) : (
                    <Card className="col-span-full p-8 text-center">
                      <p className="text-muted-foreground">Products coming soon</p>
                    </Card>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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
