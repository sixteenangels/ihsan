import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

interface PriceAlertProductSummary {
  id: string;
  name: string;
  base_price: number;
}

export interface PriceDropAlertWithProduct extends Tables<'price_drop_alerts'> {
  image_url: string | null;
  product: PriceAlertProductSummary | null;
}

interface UpdatePriceDropAlertTargetInput {
  id: string;
  productId: string | null;
  targetPrice: number | null;
}

export function usePriceDropAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['price-drop-alerts', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<PriceDropAlertWithProduct[]> => {
      if (!user?.id) {
        return [];
      }

      const { data: alerts, error: alertsError } = await supabase
        .from('price_drop_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (alertsError) {
        throw alertsError;
      }

      const productIds = (alerts || [])
        .map((alert) => alert.product_id)
        .filter((productId): productId is string => Boolean(productId));

      if (productIds.length === 0) {
        return (alerts || []).map((alert) => ({
          ...alert,
          image_url: null,
          product: null,
        }));
      }

      const [{ data: products, error: productsError }, { data: images, error: imagesError }] =
        await Promise.all([
          supabase
            .from('products')
            .select('id, name, base_price')
            .in('id', productIds),
          supabase
            .from('product_images')
            .select('product_id, image_url, order_index')
            .in('product_id', productIds)
            .order('order_index', { ascending: true }),
        ]);

      if (productsError) {
        throw productsError;
      }

      if (imagesError) {
        throw imagesError;
      }

      const productsById = new Map(
        (products || []).map((product) => [
          product.id,
          {
            id: product.id,
            name: product.name,
            base_price: Number(product.base_price),
          },
        ]),
      );

      const imagesByProductId = new Map<string, string>();
      (images || []).forEach((image) => {
        if (!imagesByProductId.has(image.product_id)) {
          imagesByProductId.set(image.product_id, image.image_url);
        }
      });

      return (alerts || []).map((alert) => ({
        ...alert,
        image_url: alert.product_id ? imagesByProductId.get(alert.product_id) || null : null,
        product: alert.product_id ? productsById.get(alert.product_id) || null : null,
      }));
    },
  });
}

export function useUpdatePriceDropAlertTarget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, targetPrice }: UpdatePriceDropAlertTargetInput) => {
      if (!user?.id) {
        throw new Error('Sign in to manage price alerts.');
      }

      const payload: TablesUpdate<'price_drop_alerts'> = {
        target_price: targetPrice,
      };

      const { error } = await supabase
        .from('price_drop_alerts')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-drop-alerts', user?.id] });
      if (variables.productId) {
        queryClient.invalidateQueries({
          queryKey: ['price-drop-alert', variables.productId, user?.id],
        });
      }
    },
  });
}

export function useDeletePriceDropAlert() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string | null }) => {
      if (!user?.id) {
        throw new Error('Sign in to manage price alerts.');
      }

      const { error } = await supabase
        .from('price_drop_alerts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return { productId };
    },
    onSuccess: ({ productId }) => {
      queryClient.invalidateQueries({ queryKey: ['price-drop-alerts', user?.id] });
      if (productId) {
        queryClient.invalidateQueries({
          queryKey: ['price-drop-alert', productId, user?.id],
        });
      }
    },
  });
}
