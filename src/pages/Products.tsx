import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  BookmarkPlus,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CategoryIconDisplay } from '@/components/categories/CategoryIconDisplay';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductQuickView } from '@/components/products/ProductQuickView';
import { useProducts, ProductWithDetails } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import type { Product } from '@/types';
import {
  useDeleteSavedSearch,
  useSaveSavedSearch,
  useSavedSearches,
  type SavedSearch,
  type SavedSearchFilters,
} from '@/hooks/useSavedSearches';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const DEFAULT_SORT_BY = 'newest';
const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];
const DEFAULT_FILTERS = {
  groupBuyOnly: false,
  flashDealsOnly: false,
  freeShippingOnly: false,
};

type ProductCardData = Product;

function parseNumberParam(value: string | null, fallback: number) {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanParam(value: string | null) {
  return value === '1' || value === 'true';
}

function buildDefaultSavedSearchName(filters: SavedSearchFilters) {
  if (filters.searchQuery) {
    return `Search: ${filters.searchQuery}`;
  }

  if (filters.selectedCategory) {
    return `${filters.selectedCategory} picks`;
  }

  if (filters.flashDealsOnly) {
    return 'Flash deals';
  }

  if (filters.groupBuyOnly) {
    return 'Group buys';
  }

  if (filters.freeShippingOnly) {
    return 'Free shipping';
  }

  return 'Saved product search';
}

function countActiveFilters(filters: SavedSearchFilters, maxPrice: number) {
  let count = 0;

  if (filters.searchQuery) count += 1;
  if (filters.selectedCategory) count += 1;
  if (filters.sortBy !== DEFAULT_SORT_BY) count += 1;
  if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) count += 1;
  if (filters.groupBuyOnly) count += 1;
  if (filters.flashDealsOnly) count += 1;
  if (filters.freeShippingOnly) count += 1;

  return count;
}

function sameSavedSearchFilters(a: SavedSearchFilters, b: SavedSearchFilters) {
  return (
    a.searchQuery === b.searchQuery &&
    a.selectedCategory === b.selectedCategory &&
    a.sortBy === b.sortBy &&
    a.priceRange[0] === b.priceRange[0] &&
    a.priceRange[1] === b.priceRange[1] &&
    a.groupBuyOnly === b.groupBuyOnly &&
    a.flashDealsOnly === b.flashDealsOnly &&
    a.freeShippingOnly === b.freeShippingOnly
  );
}

// Adapter to convert DB product to the format expected by ProductCard
function toProductCardFormat(product: ProductWithDetails): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    category: product.category_name || 'Uncategorized',
    basePrice: product.base_price,
    images: product.images.length > 0 ? product.images : ['https://via.placeholder.com/400'],
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size || undefined,
      color: variant.color || undefined,
      price: variant.price,
      stock: variant.stock || 0,
    })),
    shippingOptions: product.shipping_rules
      .filter((rule) => rule.is_allowed && rule.shipping_class)
      .map((rule) => ({
        id: rule.id,
        type: (rule.shipping_class?.shipping_type?.name?.toLowerCase().includes('sea')
          ? 'sea'
          : rule.shipping_class?.shipping_type?.name?.toLowerCase().includes('express')
            ? 'air_express'
            : 'air_normal') as 'sea' | 'air_normal' | 'air_express',
        name: rule.shipping_class?.name || '',
        details:
          rule.shipping_class?.description || rule.shipping_class?.shipping_type?.description || undefined,
        price: rule.price,
        estimatedDays: rule.shipping_class
          ? `${rule.shipping_class.estimated_days_min}-${rule.shipping_class.estimated_days_max} days`
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialSearch = searchParams.get('q') || '';
  const initialSortBy = searchParams.get('sort') || DEFAULT_SORT_BY;
  const initialMinPrice = parseNumberParam(searchParams.get('minPrice'), DEFAULT_PRICE_RANGE[0]);
  const initialMaxPrice = parseNumberParam(searchParams.get('maxPrice'), DEFAULT_PRICE_RANGE[1]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Math.max(0, Math.min(initialMinPrice, initialMaxPrice)),
    Math.max(initialMinPrice, initialMaxPrice),
  ]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    groupBuyOnly: parseBooleanParam(searchParams.get('groupBuy')),
    flashDealsOnly: parseBooleanParam(searchParams.get('flashDeals')),
    freeShippingOnly: parseBooleanParam(searchParams.get('freeShipping')),
  });
  const [quickViewProduct, setQuickViewProduct] = useState<ProductCardData | null>(null);
  const [savedSearchName, setSavedSearchName] = useState('');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: savedSearches = [], isLoading: savedSearchesLoading } = useSavedSearches();
  const saveSavedSearchMutation = useSaveSavedSearch();
  const deleteSavedSearchMutation = useDeleteSavedSearch();

  // Calculate max price from products
  const maxPrice = useMemo(() => {
    if (!products || products.length === 0) return DEFAULT_PRICE_RANGE[1];
    return Math.ceil(Math.max(...products.map((product) => product.base_price)) / 100) * 100;
  }, [products]);

  useEffect(() => {
    setPriceRange((currentRange) => {
      const nextMin = Math.min(currentRange[0], maxPrice);
      const nextMax = Math.min(Math.max(currentRange[1], nextMin), maxPrice);

      if (nextMin === currentRange[0] && nextMax === currentRange[1]) {
        return currentRange;
      }

      return [nextMin, nextMax];
    });
  }, [maxPrice]);

  const currentSavedSearchFilters = useMemo<SavedSearchFilters>(
    () => ({
      searchQuery: searchQuery.trim(),
      selectedCategory,
      sortBy,
      priceRange,
      groupBuyOnly: filters.groupBuyOnly,
      flashDealsOnly: filters.flashDealsOnly,
      freeShippingOnly: filters.freeShippingOnly,
    }),
    [filters, priceRange, searchQuery, selectedCategory, sortBy],
  );

  const activeFilterCount = useMemo(
    () => countActiveFilters(currentSavedSearchFilters, maxPrice),
    [currentSavedSearchFilters, maxPrice],
  );

  const hasCustomSearchState = activeFilterCount > 0;

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (currentSavedSearchFilters.searchQuery) {
      nextParams.set('q', currentSavedSearchFilters.searchQuery);
    }

    if (currentSavedSearchFilters.selectedCategory) {
      nextParams.set('category', currentSavedSearchFilters.selectedCategory);
    }

    if (currentSavedSearchFilters.sortBy !== DEFAULT_SORT_BY) {
      nextParams.set('sort', currentSavedSearchFilters.sortBy);
    }

    if (currentSavedSearchFilters.priceRange[0] > 0) {
      nextParams.set('minPrice', String(currentSavedSearchFilters.priceRange[0]));
    }

    if (currentSavedSearchFilters.priceRange[1] < maxPrice) {
      nextParams.set('maxPrice', String(currentSavedSearchFilters.priceRange[1]));
    }

    if (currentSavedSearchFilters.groupBuyOnly) {
      nextParams.set('groupBuy', '1');
    }

    if (currentSavedSearchFilters.flashDealsOnly) {
      nextParams.set('flashDeals', '1');
    }

    if (currentSavedSearchFilters.freeShippingOnly) {
      nextParams.set('freeShipping', '1');
    }

    setSearchParams(nextParams, { replace: true });
  }, [currentSavedSearchFilters, maxPrice, setSearchParams]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = [...products];

    if (currentSavedSearchFilters.searchQuery) {
      const query = currentSavedSearchFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.category_name?.toLowerCase().includes(query),
      );
    }

    if (currentSavedSearchFilters.selectedCategory) {
      filtered = filtered.filter(
        (product) =>
          product.category_name === currentSavedSearchFilters.selectedCategory ||
          product.category_id === currentSavedSearchFilters.selectedCategory,
      );
    }

    filtered = filtered.filter(
      (product) =>
        product.base_price >= currentSavedSearchFilters.priceRange[0] &&
        product.base_price <= currentSavedSearchFilters.priceRange[1],
    );

    if (currentSavedSearchFilters.groupBuyOnly) {
      filtered = filtered.filter((product) => product.is_group_buy_eligible);
    }

    if (currentSavedSearchFilters.flashDealsOnly) {
      filtered = filtered.filter((product) => product.is_flash_deal);
    }

    if (currentSavedSearchFilters.freeShippingOnly) {
      filtered = filtered.filter((product) => product.is_free_shipping);
    }

    switch (currentSavedSearchFilters.sortBy) {
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
  }, [currentSavedSearchFilters, products]);

  const isLoading = productsLoading || categoriesLoading;

  const applySavedSearch = (savedSearch: SavedSearch) => {
    setSearchQuery(savedSearch.filters.searchQuery);
    setSelectedCategory(savedSearch.filters.selectedCategory);
    setSortBy(savedSearch.filters.sortBy);
    setPriceRange(savedSearch.filters.priceRange);
    setFilters({
      groupBuyOnly: savedSearch.filters.groupBuyOnly,
      flashDealsOnly: savedSearch.filters.flashDealsOnly,
      freeShippingOnly: savedSearch.filters.freeShippingOnly,
    });
    toast.success(`Applied saved search: ${savedSearch.name}`);
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSearchQuery('');
    setSortBy(DEFAULT_SORT_BY);
    setPriceRange([0, maxPrice]);
    setFilters(DEFAULT_FILTERS);
  };

  const openSaveSearchDialog = () => {
    if (!user) {
      toast.info('Sign in to save searches to your account.');
      navigate('/auth');
      return;
    }

    if (!hasCustomSearchState) {
      toast.error('Adjust the search or filters before saving.');
      return;
    }

    setSavedSearchName(buildDefaultSavedSearchName(currentSavedSearchFilters));
    setIsSaveDialogOpen(true);
  };

  const handleSaveSearch = async () => {
    const trimmedName = savedSearchName.trim();
    if (!trimmedName) {
      toast.error('Give this saved search a name.');
      return;
    }

    try {
      await saveSavedSearchMutation.mutateAsync({
        name: trimmedName,
        filters: currentSavedSearchFilters,
      });

      toast.success('Saved search added to your account.');
      setIsSaveDialogOpen(false);
      setSavedSearchName('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save search.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container overflow-x-hidden px-4 py-5 pb-24 sm:px-6 md:py-8 md:pb-8">
        <div className="mb-6 md:mb-8">
          <h1 className="mb-2 text-2xl font-bold font-serif text-foreground sm:text-3xl">
            All Products
          </h1>
          <p className="mb-4 text-sm text-muted-foreground sm:text-base">
            Discover {filteredProducts.length} products from around the world
          </p>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Save your best filters</p>
                <p className="text-xs text-muted-foreground">
                  {user
                    ? 'Store this search so you can reapply it with one tap later.'
                    : 'Sign in to save searches to your account and revisit them later.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} active filters</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSaveSearchDialog}
                  disabled={saveSavedSearchMutation.isPending || !hasCustomSearchState}
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Save Search
                </Button>
              </div>
            </div>

            {user && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Bookmark className="h-4 w-4 text-primary" />
                  Saved searches
                </div>

                {savedSearchesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved searches...
                  </div>
                ) : savedSearches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Save a filtered view here to quickly jump back into it later.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {savedSearches.map((savedSearch) => {
                      const isActive = sameSavedSearchFilters(
                        savedSearch.filters,
                        currentSavedSearchFilters,
                      );

                      return (
                        <div
                          key={savedSearch.id}
                          className="flex items-center gap-1 rounded-full border border-border bg-background p-1"
                        >
                          <Button
                            variant={isActive ? 'default' : 'ghost'}
                            size="sm"
                            className="rounded-full px-3"
                            onClick={() => applySavedSearch(savedSearch)}
                          >
                            {savedSearch.name}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            disabled={deleteSavedSearchMutation.isPending}
                            onClick={() =>
                              deleteSavedSearchMutation.mutate(savedSearch.id, {
                                onSuccess: () => {
                                  toast.success(`Removed saved search: ${savedSearch.name}`);
                                },
                                onError: (error) => {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : 'Failed to delete saved search.',
                                  );
                                },
                              })
                            }
                            aria-label={`Delete saved search ${savedSearch.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 pr-4">
            <Badge
              variant={selectedCategory === '' ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5 text-center text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={() => setSelectedCategory('')}
            >
              🛍️ All
            </Badge>
            {categories?.map((category) => {
              return (
                <Badge
                  key={category.id}
                  variant={
                    selectedCategory === category.name || selectedCategory === category.id
                      ? 'default'
                      : 'outline'
                  }
                  className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-center text-xs sm:py-2 sm:text-sm"
                  onClick={() =>
                    setSelectedCategory((currentCategory) =>
                      currentCategory === category.name || currentCategory === category.id
                        ? ''
                        : category.name,
                    )
                  }
                >
                  <CategoryIconDisplay
                    categoryName={category.name}
                    icon={category.icon}
                    className="h-3.5 w-3.5 shrink-0"
                    emojiClassName="text-sm"
                  />
                  {category.name} ({category.product_count || 0})
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filter Products</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
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
                      <span>GHS {priceRange[0].toLocaleString()}</span>
                      <span>GHS {priceRange[1].toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Product Type</h4>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={filters.groupBuyOnly}
                      onCheckedChange={(checked) =>
                        setFilters((currentFilters) => ({
                          ...currentFilters,
                          groupBuyOnly: checked === true,
                        }))
                      }
                    />
                    <span className="text-sm text-foreground">Group Buy Eligible</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={filters.flashDealsOnly}
                      onCheckedChange={(checked) =>
                        setFilters((currentFilters) => ({
                          ...currentFilters,
                          flashDealsOnly: checked === true,
                        }))
                      }
                    />
                    <span className="text-sm text-foreground">Flash Deals Only</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={filters.freeShippingOnly}
                      onCheckedChange={(checked) =>
                        setFilters((currentFilters) => ({
                          ...currentFilters,
                          freeShippingOnly: checked === true,
                        }))
                      }
                    />
                    <span className="text-sm text-foreground">Free Shipping</span>
                  </label>
                </div>

                <Button variant="outline" className="w-full" onClick={clearFilters}>
                  Reset Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-3 sm:gap-4'
            }
          >
            {filteredProducts.map((product) => {
              const cardProduct = toProductCardFormat(product);
              return (
                <ProductCard
                  key={product.id}
                  product={cardProduct}
                  onQuickView={(nextProduct) => setQuickViewProduct(nextProduct)}
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        )}

        {!isLoading && filteredProducts.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg text-muted-foreground">No products found</p>
            <Button variant="link" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        <ProductQuickView
          product={quickViewProduct}
          open={!!quickViewProduct}
          onOpenChange={(open) => !open && setQuickViewProduct(null)}
        />
      </main>
      <Footer />

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>
              Store your current filters so you can reuse them later with one tap.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="saved-search-name">Search name</Label>
            <Input
              id="saved-search-name"
              value={savedSearchName}
              onChange={(event) => setSavedSearchName(event.target.value)}
              placeholder="Weekend deals"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={saveSavedSearchMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={saveSavedSearchMutation.isPending}>
              {saveSavedSearchMutation.isPending ? 'Saving...' : 'Save Search'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
