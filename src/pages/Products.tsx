import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  BookmarkPlus,
  Filter,
  Flame,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Truck,
  Users,
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
const SORT_LABELS: Record<string, string> = {
  newest: 'Newest',
  'price-low': 'Price: Low to High',
  'price-high': 'Price: High to Low',
  rating: 'Best Rating',
  'name-asc': 'Name: A to Z',
  'name-desc': 'Name: Z to A',
};

type ProductCardData = Product;
type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

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
      image_url: variant.image_url || null,
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

  const selectedCategoryLabel =
    categories?.find(
      (category) => category.id === selectedCategory || category.name === selectedCategory,
    )?.name || selectedCategory;

  const activeFilterChips: ActiveFilterChip[] = [
    currentSavedSearchFilters.searchQuery
      ? {
          key: 'search',
          label: `Search: ${currentSavedSearchFilters.searchQuery}`,
          onRemove: () => setSearchQuery(''),
        }
      : null,
    currentSavedSearchFilters.selectedCategory
      ? {
          key: 'category',
          label: selectedCategoryLabel,
          onRemove: () => setSelectedCategory(''),
        }
      : null,
    currentSavedSearchFilters.sortBy !== DEFAULT_SORT_BY
      ? {
          key: 'sort',
          label: `Sort: ${SORT_LABELS[currentSavedSearchFilters.sortBy] || 'Custom'}`,
          onRemove: () => setSortBy(DEFAULT_SORT_BY),
        }
      : null,
    currentSavedSearchFilters.priceRange[0] > 0 ||
    currentSavedSearchFilters.priceRange[1] < maxPrice
      ? {
          key: 'price',
          label: `GHS ${currentSavedSearchFilters.priceRange[0].toLocaleString()} - GHS ${currentSavedSearchFilters.priceRange[1].toLocaleString()}`,
          onRemove: () => setPriceRange([0, maxPrice]),
        }
      : null,
    currentSavedSearchFilters.groupBuyOnly
      ? {
          key: 'group-buy',
          label: 'Group Buys',
          onRemove: () =>
            setFilters((currentFilters) => ({ ...currentFilters, groupBuyOnly: false })),
        }
      : null,
    currentSavedSearchFilters.flashDealsOnly
      ? {
          key: 'flash',
          label: 'Flash Deals',
          onRemove: () =>
            setFilters((currentFilters) => ({ ...currentFilters, flashDealsOnly: false })),
        }
      : null,
    currentSavedSearchFilters.freeShippingOnly
      ? {
          key: 'free-shipping',
          label: 'Free Shipping',
          onRemove: () =>
            setFilters((currentFilters) => ({ ...currentFilters, freeShippingOnly: false })),
        }
      : null,
  ].filter((value): value is ActiveFilterChip => Boolean(value));

  const quickDiscoveryActions = [
    {
      key: 'flash',
      label: 'Flash Deals',
      icon: Flame,
      active: filters.flashDealsOnly,
      onClick: () =>
        setFilters((currentFilters) => ({
          ...currentFilters,
          flashDealsOnly: !currentFilters.flashDealsOnly,
        })),
    },
    {
      key: 'group-buy',
      label: 'Group Buys',
      icon: Users,
      active: filters.groupBuyOnly,
      onClick: () =>
        setFilters((currentFilters) => ({
          ...currentFilters,
          groupBuyOnly: !currentFilters.groupBuyOnly,
        })),
    },
    {
      key: 'free-shipping',
      label: 'Free Shipping',
      icon: Truck,
      active: filters.freeShippingOnly,
      onClick: () =>
        setFilters((currentFilters) => ({
          ...currentFilters,
          freeShippingOnly: !currentFilters.freeShippingOnly,
        })),
    },
    {
      key: 'top-rated',
      label: 'Top Rated',
      icon: Star,
      active: sortBy === 'rating',
      onClick: () => setSortBy((currentSort) => (currentSort === 'rating' ? DEFAULT_SORT_BY : 'rating')),
    },
  ];

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
      <main className="container overflow-x-hidden px-3 py-5 pb-28 sm:px-6 md:py-8 md:pb-8">
        <section className="mb-4 rounded-[1.4rem] border border-border/70 bg-card/95 p-3.5 shadow-sm sm:rounded-[1.75rem] sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
            Discovery
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            Discover exciting products from around the world
          </p>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, brands, or categories"
                aria-label="Search products, brands, or categories"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 rounded-xl border-border/70 bg-background pl-9 pr-9 text-xs"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant={activeFilterCount > 0 ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 rounded-xl px-3 text-xs"
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Filter
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Products</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Sort</h4>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">{SORT_LABELS.newest}</SelectItem>
                        <SelectItem value="price-low">{SORT_LABELS['price-low']}</SelectItem>
                        <SelectItem value="price-high">{SORT_LABELS['price-high']}</SelectItem>
                        <SelectItem value="rating">{SORT_LABELS.rating}</SelectItem>
                        <SelectItem value="name-asc">{SORT_LABELS['name-asc']}</SelectItem>
                        <SelectItem value="name-desc">{SORT_LABELS['name-desc']}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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

                  <div className="space-y-3 border-t border-border/70 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-foreground">Saved Searches</h4>
                        <p className="text-xs text-muted-foreground">
                          {user ? 'Save and reopen filtered views.' : 'Sign in to save searches.'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={openSaveSearchDialog}
                        disabled={saveSavedSearchMutation.isPending || !hasCustomSearchState}
                      >
                        <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>

                    {user ? (
                      savedSearchesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading saved searches...
                        </div>
                      ) : savedSearches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Save a filtered view here to jump back into it later.
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
                                className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
                              >
                                <Button
                                  variant={isActive ? 'default' : 'ghost'}
                                  size="sm"
                                  className="rounded-full px-3"
                                  onClick={() => applySavedSearch(savedSearch)}
                                >
                                  <Bookmark className="mr-1.5 h-3.5 w-3.5" />
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
                      )
                    ) : null}
                  </div>

                  <Button variant="outline" className="w-full rounded-xl" onClick={clearFilters}>
                    Reset Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((filterChip) => (
                <button
                  key={filterChip.key}
                  type="button"
                  onClick={filterChip.onRemove}
                  aria-label={`Remove filter ${filterChip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  <span>{filterChip.label}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Featured Filters
            </p>
            <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {quickDiscoveryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    type="button"
                    className={`inline-flex h-8 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                      action.active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/70 bg-background text-foreground'
                    }`}
                    onClick={action.onClick}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Categories
            </p>
            <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <button
                type="button"
                className={`inline-flex h-8 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                  selectedCategory === ''
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 bg-background text-foreground'
                }`}
                onClick={() => setSelectedCategory('')}
              >
                <Package className="h-3.5 w-3.5" />
                All
              </button>
              {categories?.map((category) => {
                const isSelected =
                  selectedCategory === category.name || selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`inline-flex h-8 max-w-[150px] shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/70 bg-background text-foreground'
                    }`}
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
                    />
                    <span className="truncate">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
            All Products
          </h1>
          <div className="flex shrink-0 items-center rounded-xl border border-border bg-card/80 p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-lg md:h-9 md:w-9"
              onClick={() => setViewMode('grid')}
              aria-label="Show products in grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-lg md:h-9 md:w-9"
              onClick={() => setViewMode('list')}
              aria-label="Show products in list view"
            >
              <List className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-5 hidden items-center justify-end gap-3 md:flex">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10 w-44 rounded-xl">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{SORT_LABELS.newest}</SelectItem>
                <SelectItem value="price-low">{SORT_LABELS['price-low']}</SelectItem>
                <SelectItem value="price-high">{SORT_LABELS['price-high']}</SelectItem>
                <SelectItem value="rating">{SORT_LABELS.rating}</SelectItem>
                <SelectItem value="name-asc">{SORT_LABELS['name-asc']}</SelectItem>
                <SelectItem value="name-desc">{SORT_LABELS['name-desc']}</SelectItem>
              </SelectContent>
            </Select>
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
                ? 'grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4'
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
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-md">
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
