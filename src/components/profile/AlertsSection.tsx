import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  ExternalLink,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  useDeleteSavedSearch,
  useSavedSearches,
  type SavedSearchFilters,
} from '@/hooks/useSavedSearches';
import {
  useDeletePriceDropAlert,
  usePriceDropAlerts,
  useUpdatePriceDropAlertTarget,
} from '@/hooks/usePriceDropAlerts';
import { useDeleteStockAlert, useStockAlerts } from '@/hooks/useStockAlerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const DEFAULT_SORT_BY = 'newest';
const DEFAULT_PRICE_RANGE: [number, number] = [0, 10000];

function buildSavedSearchPath(filters: SavedSearchFilters) {
  const params = new URLSearchParams();

  if (filters.searchQuery) {
    params.set('q', filters.searchQuery);
  }

  if (filters.selectedCategory) {
    params.set('category', filters.selectedCategory);
  }

  if (filters.sortBy && filters.sortBy !== DEFAULT_SORT_BY) {
    params.set('sort', filters.sortBy);
  }

  if (filters.priceRange[0] > DEFAULT_PRICE_RANGE[0]) {
    params.set('minPrice', String(filters.priceRange[0]));
  }

  if (filters.priceRange[1] < DEFAULT_PRICE_RANGE[1]) {
    params.set('maxPrice', String(filters.priceRange[1]));
  }

  if (filters.groupBuyOnly) {
    params.set('groupBuy', '1');
  }

  if (filters.flashDealsOnly) {
    params.set('flashDeals', '1');
  }

  if (filters.freeShippingOnly) {
    params.set('freeShipping', '1');
  }

  const query = params.toString();
  return query ? `/products?${query}` : '/products';
}

function summarizeSavedSearch(filters: SavedSearchFilters) {
  const parts: string[] = [];

  if (filters.searchQuery) {
    parts.push(`Search "${filters.searchQuery}"`);
  }

  if (filters.selectedCategory) {
    parts.push(filters.selectedCategory);
  }

  if (
    filters.priceRange[0] > DEFAULT_PRICE_RANGE[0] ||
    filters.priceRange[1] < DEFAULT_PRICE_RANGE[1]
  ) {
    parts.push(`GHS ${filters.priceRange[0]}-${filters.priceRange[1]}`);
  }

  if (filters.groupBuyOnly) parts.push('Group buy');
  if (filters.flashDealsOnly) parts.push('Flash deals');
  if (filters.freeShippingOnly) parts.push('Free shipping');

  return parts.length > 0 ? parts.join(' / ') : 'All products';
}

function formatVariantLabel(color: string | null, size: string | null) {
  return [color, size].filter(Boolean).join(' / ') || 'Any variant';
}

export function AlertsSection() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { isEnabled } = useFeatureFlags();
  const { data: savedSearches = [], isLoading: savedSearchesLoading } = useSavedSearches();
  const deleteSavedSearchMutation = useDeleteSavedSearch();
  const { data: priceAlerts = [], isLoading: priceAlertsLoading } = usePriceDropAlerts();
  const updatePriceDropAlertTargetMutation = useUpdatePriceDropAlertTarget();
  const deletePriceDropAlertMutation = useDeletePriceDropAlert();
  const { data: stockAlerts = [], isLoading: stockAlertsLoading } = useStockAlerts();
  const deleteStockAlertMutation = useDeleteStockAlert();
  const [targetPriceDrafts, setTargetPriceDrafts] = useState<Record<string, string>>({});

  const handleSavedSearchDelete = (id: string, name: string) => {
    deleteSavedSearchMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted saved search: ${name}`),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to delete saved search.');
      },
    });
  };

  const handlePriceAlertSave = async (
    alertId: string,
    productId: string | null,
    currentTargetPrice: number | null,
  ) => {
    const rawValue = (targetPriceDrafts[alertId] ?? '').trim();
    const nextTargetPrice = rawValue === '' ? null : Number(rawValue);

    if (rawValue !== '' && (!Number.isFinite(nextTargetPrice) || nextTargetPrice <= 0)) {
      toast.error('Enter a valid target price or leave it blank for any drop.');
      return;
    }

    if (nextTargetPrice === currentTargetPrice) {
      toast.info('No changes to save.');
      return;
    }

    try {
      await updatePriceDropAlertTargetMutation.mutateAsync({
        id: alertId,
        productId,
        targetPrice: nextTargetPrice,
      });
      toast.success('Price alert updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update price alert.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Saved Searches
          </CardTitle>
          <CardDescription>Reuse the product filters you want to come back to later.</CardDescription>
        </CardHeader>
        <CardContent>
          {savedSearchesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading saved searches...
            </div>
          ) : savedSearches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved searches yet. Save filters from the products page to see them here.
            </p>
          ) : (
            <div className="space-y-3">
              {savedSearches.map((savedSearch) => (
                <div
                  key={savedSearch.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{savedSearch.name}</p>
                      <Badge variant="secondary">Saved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {summarizeSavedSearch(savedSearch.filters)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(buildSavedSearchPath(savedSearch.filters))}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Search
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleSavedSearchDelete(savedSearch.id, savedSearch.name)}
                      disabled={deleteSavedSearchMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isEnabled('price_drop_alerts') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Price Drop Alerts
            </CardTitle>
            <CardDescription>
              Keep your alerts broad or set a target price for each product.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {priceAlertsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading price alerts...
              </div>
            ) : priceAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No price alerts yet. Use the product page to subscribe to price drops.
              </p>
            ) : (
              <div className="space-y-4">
                {priceAlerts.map((alert) => {
                  const draftValue =
                    targetPriceDrafts[alert.id] ??
                    (alert.target_price != null ? String(alert.target_price) : '');

                  return (
                    <div
                      key={alert.id}
                      className="flex flex-col gap-4 rounded-xl border border-border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {alert.product?.name || 'Product unavailable'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Current price:{' '}
                            {alert.product ? formatPrice(alert.product.base_price) : 'Unavailable'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {alert.product_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/product/${alert.product_id}`)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Product
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deletePriceDropAlertMutation.isPending}
                            onClick={() =>
                              deletePriceDropAlertMutation.mutate(
                                { id: alert.id, productId: alert.product_id },
                                {
                                  onSuccess: () => toast.success('Price alert removed.'),
                                  onError: (error) => {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : 'Failed to remove price alert.',
                                    );
                                  },
                                },
                              )
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="w-full sm:max-w-xs">
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            Target price
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftValue}
                            onChange={(event) =>
                              setTargetPriceDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [alert.id]: event.target.value,
                              }))
                            }
                            placeholder="Any drop"
                          />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            handlePriceAlertSave(alert.id, alert.product_id, alert.target_price)
                          }
                          disabled={updatePriceDropAlertTargetMutation.isPending}
                        >
                          Save Target
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Restock Alerts
          </CardTitle>
          <CardDescription>
            Track the products and variants you asked us to notify you about.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockAlertsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading restock alerts...
            </div>
          ) : stockAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No restock alerts yet. Subscribe on an out-of-stock product to watch it here.
            </p>
          ) : (
            <div className="space-y-3">
              {stockAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {alert.product?.name || 'Product unavailable'}
                      </p>
                      <Badge variant="secondary">
                        {formatVariantLabel(alert.variant?.color || null, alert.variant?.size || null)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Added on {new Date(alert.created_at).toLocaleDateString()}
                    </p>
                    {alert.product?.expected_restock_date && (
                      <p className="text-sm text-muted-foreground">
                        Expected restock on{' '}
                        {new Date(alert.product.expected_restock_date).toLocaleDateString()}
                      </p>
                    )}
                    {alert.last_notified_at && (
                      <p className="text-sm text-muted-foreground">
                        Last notified on {new Date(alert.last_notified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/product/${alert.product_id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Product
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteStockAlertMutation.isPending}
                      onClick={() =>
                        deleteStockAlertMutation.mutate(
                          {
                            id: alert.id,
                            productId: alert.product_id,
                            variantId: alert.product_variant_id,
                          },
                          {
                            onSuccess: () => toast.success('Restock alert removed.'),
                            onError: (error) => {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : 'Failed to remove restock alert.',
                              );
                            },
                          },
                        )
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
