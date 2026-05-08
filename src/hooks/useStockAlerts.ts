import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface StockAlertRow {
  id: string;
  user_id: string;
  product_id: string;
  product_variant_id: string | null;
  created_at: string;
  last_notified_at: string | null;
}

interface StockAlertProductSummary {
  id: string;
  name: string;
  base_price: number;
  expected_restock_date: string | null;
}

interface StockAlertVariantSummary {
  id: string;
  color: string | null;
  size: string | null;
  stock: number | null;
}

export interface StockAlertWithDetails extends StockAlertRow {
  image_url: string | null;
  product: StockAlertProductSummary | null;
  variant: StockAlertVariantSummary | null;
}

function readExpectedRestockDate(product: object): string | null {
  const value = (product as { expected_restock_date?: unknown }).expected_restock_date;
  return typeof value === 'string' ? value : null;
}

export function useStockAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stock-alerts', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<StockAlertWithDetails[]> => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('stock_alerts' as never)
        .select('id, user_id, product_id, product_variant_id, created_at, last_notified_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const alerts = (data || []) as StockAlertRow[];
      const productIds = alerts.map((alert) => alert.product_id);
      const variantIds = alerts
        .map((alert) => alert.product_variant_id)
        .filter((variantId): variantId is string => Boolean(variantId));

      const [
        { data: products, error: productsError },
        { data: images, error: imagesError },
        { data: variants, error: variantsError },
      ] = await Promise.all([
        productIds.length > 0
          ? supabase
              .from('products')
              .select('id, name, base_price, expected_restock_date')
              .in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        productIds.length > 0
          ? supabase
              .from('product_images')
              .select('product_id, image_url, order_index')
              .in('product_id', productIds)
              .order('order_index', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        variantIds.length > 0
          ? supabase
              .from('product_variants')
              .select('id, color, size, stock')
              .in('id', variantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (productsError) {
        throw productsError;
      }

      if (imagesError) {
        throw imagesError;
      }

      if (variantsError) {
        throw variantsError;
      }

      const productsById = new Map(
        (products || []).map((product) => [
          product.id,
          {
            id: product.id,
            name: product.name,
            base_price: Number(product.base_price),
            expected_restock_date: readExpectedRestockDate(product),
          },
        ]),
      );

      const imagesByProductId = new Map<string, string>();
      (images || []).forEach((image) => {
        if (!imagesByProductId.has(image.product_id)) {
          imagesByProductId.set(image.product_id, image.image_url);
        }
      });

      const variantsById = new Map(
        (variants || []).map((variant) => [
          variant.id,
          {
            id: variant.id,
            color: variant.color,
            size: variant.size,
            stock: variant.stock,
          },
        ]),
      );

      return alerts.map((alert) => ({
        ...alert,
        image_url: imagesByProductId.get(alert.product_id) || null,
        product: productsById.get(alert.product_id) || null,
        variant: alert.product_variant_id
          ? variantsById.get(alert.product_variant_id) || null
          : null,
      }));
    },
  });
}

export function useDeleteStockAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      productId,
      variantId,
    }: {
      id: string;
      productId: string;
      variantId: string | null;
    }) => {
      if (!user?.id) {
        throw new Error('Sign in to manage restock alerts.');
      }

      const { error } = await supabase
        .from('stock_alerts' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return { productId, variantId };
    },
    onSuccess: ({ productId, variantId }) => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts', user?.id] });
      queryClient.invalidateQueries({
        queryKey: ['stock-alert', user?.id, productId, variantId || 'product'],
      });
    },
  });
}
