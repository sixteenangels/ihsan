import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Package, Bell, BellOff, Save, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface LowStockVariant {
  id: string;
  stock: number | null;
  size: string | null;
  color: string | null;
  sku: string | null;
  product_id: string;
  products: {
    id: string;
    name: string;
    item_code: string;
  } | null;
}

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;

export function LowStockAlerts() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const queryClient = useQueryClient();

  const { data: lowStockVariants, isLoading, refetch } = useQuery({
    queryKey: ['admin-low-stock-detailed'],
    queryFn: async (): Promise<LowStockVariant[]> => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          stock,
          size,
          color,
          sku,
          product_id,
          products(id, name, item_code)
        `)
        .lt('stock', LOW_STOCK_THRESHOLD)
        .eq('is_active', true)
        .order('stock', { ascending: true });

      if (error) throw error;
      return (data || []) as LowStockVariant[];
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const { error } = await supabase
        .from('product_variants')
        .update({ stock })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Stock updated successfully');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-low-stock-detailed'] });
    },
    onError: () => {
      toast.error('Failed to update stock');
    },
  });

  const startEditing = (variant: LowStockVariant) => {
    setEditingId(variant.id);
    setEditStock(variant.stock || 0);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditStock(0);
  };

  const saveStock = (id: string) => {
    updateStockMutation.mutate({ id, stock: editStock });
  };

  const dismissAlert = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    toast.info('Alert dismissed');
  };

  const dismissAll = () => {
    const allIds = lowStockVariants?.map(v => v.id) || [];
    setDismissedIds(new Set(allIds));
    toast.info('All alerts dismissed');
  };

  const resetDismissed = () => {
    setDismissedIds(new Set());
    refetch();
  };

  const visibleAlerts = lowStockVariants?.filter(v => !dismissedIds.has(v.id)) || [];
  const criticalCount = visibleAlerts.filter(v => (v.stock || 0) <= CRITICAL_STOCK_THRESHOLD).length;
  const outOfStockCount = visibleAlerts.filter(v => v.stock === 0).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading stock alerts...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={outOfStockCount > 0 ? 'border-destructive' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${outOfStockCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {outOfStockCount}
            </p>
          </CardContent>
        </Card>

        <Card className={criticalCount > 0 ? 'border-orange-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Critical (≤{CRITICAL_STOCK_THRESHOLD})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${criticalCount > 0 ? 'text-orange-500' : 'text-foreground'}`}>
              {criticalCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Low Stock (&lt;{LOW_STOCK_THRESHOLD})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {visibleAlerts.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
        {visibleAlerts.length > 0 && (
          <Button variant="outline" size="sm" onClick={dismissAll}>
            <BellOff className="h-4 w-4 mr-1" />
            Dismiss All
          </Button>
        )}
        {dismissedIds.size > 0 && (
          <Button variant="ghost" size="sm" onClick={resetDismissed}>
            Show Dismissed ({dismissedIds.size})
          </Button>
        )}
      </div>

      {/* Alerts List */}
      {visibleAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">All products have sufficient stock</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visibleAlerts.map((variant) => {
                const isCritical = (variant.stock || 0) <= CRITICAL_STOCK_THRESHOLD;
                const isOutOfStock = variant.stock === 0;
                const isEditing = editingId === variant.id;

                return (
                  <div
                    key={variant.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOutOfStock
                        ? 'border-destructive bg-destructive/5'
                        : isCritical
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-border bg-muted/50'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {variant.products?.name || 'Unknown Product'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>SKU: {variant.sku || variant.products?.item_code || 'N/A'}</span>
                        {variant.size && <span>• Size: {variant.size}</span>}
                        {variant.color && <span>• Color: {variant.color}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={editStock}
                            onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => saveStock(variant.id)}
                            disabled={updateStockMutation.isPending}
                          >
                            <Save className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Badge
                            variant={isOutOfStock ? 'destructive' : isCritical ? 'secondary' : 'outline'}
                            className={`cursor-pointer ${isCritical && !isOutOfStock ? 'bg-orange-500 text-white' : ''}`}
                            onClick={() => startEditing(variant)}
                          >
                            {variant.stock || 0} in stock
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(variant)}
                          >
                            Update
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissAlert(variant.id)}
                          >
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}