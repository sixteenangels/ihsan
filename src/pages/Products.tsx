import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, Loader2, Search, X, LayoutGrid, List, icons as lucideIcons } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductQuickView } from '@/components/products/ProductQuickView';
import { useProducts, ProductWithDetails } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { getCategoryIconName } from '@/lib/categoryIcons';

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

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialSearch = searchParams.get('q') || '';
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    groupBuyOnly: false,
    flashDealsOnly: false,
    freeShippingOnly: false,
  });
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  // Calculate max price from products
  const maxPrice = useMemo(() => {
    if (!products || products.length === 0) return 10000;
    return Math.ceil(Math.max(...products.map((p) => p.base_price)) / 100) * 100;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description?.toLowerCase().includes(query)) ||
          (p.category_name?.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_name === selectedCategory);
    }

    // Price range filter
    filtered = filtered.filter(
      (p) => p.base_price >= priceRange[0] && p.base_price <= priceRange[1]
    );

    if (filters.groupBuyOnly) {
      filtered = filtered.filter((p) => p.is_group_buy_eligible);
    }

    if (filters.flashDealsOnly) {
      filtered = filtered.filter((p) => p.is_flash_deal);
    }

    if (filters.freeShippingOnly) {
      filtered = filtered.filter((p) => p.is_free_shipping);
    }

    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.base_price - b.base_price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.base_price - a.base_price);
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'name-asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    return filtered;
  }, [products, selectedCategory, sortBy, filters, searchQuery, priceRange]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value) {
      searchParams.set('q', value);
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
    if (category === selectedCategory) {
      searchParams.delete('category');
    } else {
      searchParams.set('category', category);
    }
    setSearchParams(searchParams);
  };

  const isLoading = productsLoading || categoriesLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container overflow-x-hidden px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8">
        {/* Page Header with Search */}
        <div className="mb-6 md:mb-8">
          <h1 className="mb-2 text-3xl font-bold font-serif text-foreground">
            All Products
          </h1>
          <p className="mb-4 text-sm text-muted-foreground sm:text-base">
            Discover {filteredProducts.length} products from around the world
          </p>
          {/* Search Bar */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => handleSearchChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === '' ? 'default' : 'outline'}
            className="max-w-full cursor-pointer px-3 py-1.5 text-xs whitespace-normal text-center sm:px-4 sm:py-2 sm:text-sm"
            onClick={() => handleCategoryChange('')}
          >
            All
          </Badge>
          {categories?.map((cat) => {
            const iconName = getCategoryIconName(cat.name);
            const CatIcon = (lucideIcons as any)[iconName] || lucideIcons.Package;
            return (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.name ? 'default' : 'outline'}
                className="flex max-w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs whitespace-normal text-center sm:py-2 sm:text-sm"
                onClick={() => handleCategoryChange(cat.name)}
              >
                <CatIcon className="h-3.5 w-3.5 shrink-0" />
                {cat.name} ({cat.product_count || 0})
              </Badge>
            );
          })}
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filter Products</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Price Range */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Price Range</h4>
                  <div className="px-2">
                    <Slider
                      value={priceRange}
                      onValueChange={(value) => setPriceRange(value as [number, number])}
                      max={maxPrice}
                      min={0}
                      step={100}
                      className="mb-4"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>₵{priceRange[0].toLocaleString()}</span>
                      <span>₵{priceRange[1].toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Product Type</h4>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={filters.groupBuyOnly}
                      onCheckedChange={(checked) =>
                        setFilters((f) => ({ ...f, groupBuyOnly: !!checked }))
                      }
                    />
                    <span className="text-sm text-foreground">Group Buy Eligible</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={filters.flashDealsOnly}
                      onCheckedChange={(checked) =>
                        setFilters((f) => ({ ...f, flashDealsOnly: !!checked }))
                      }
                    />
                    <span className="text-sm text-foreground">Flash Deals Only</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={filters.freeShippingOnly}
                      onCheckedChange={(checked) =>
                        setFilters((f) => ({ ...f, freeShippingOnly: !!checked }))
                      }
                    />
                    <span className="text-sm text-foreground">Free Shipping</span>
                  </label>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPriceRange([0, maxPrice]);
                    setFilters({
                      groupBuyOnly: false,
                      flashDealsOnly: false,
                      freeShippingOnly: false,
                    });
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center self-start rounded-md border border-border">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Best Rating</SelectItem>
                  <SelectItem value="name-asc">Name: A to Z</SelectItem>
                  <SelectItem value="name-desc">Name: Z to A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Product Grid/List */}
        {!isLoading && (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
            : "flex flex-col gap-3 sm:gap-4"
          }>
            {filteredProducts.map((product) => {
              const cardProduct = toProductCardFormat(product);
              return (
                <ProductCard 
                  key={product.id} 
                  product={cardProduct}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        )}

        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">No products found</p>
            <Button
              variant="link"
              onClick={() => {
                setSelectedCategory('');
                setSearchQuery('');
                handleSearchChange('');
                setPriceRange([0, maxPrice]);
                setFilters({
                  groupBuyOnly: false,
                  flashDealsOnly: false,
                  freeShippingOnly: false,
                });
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}

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
