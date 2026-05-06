import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface BackInStockAlertProps {
  productId: string;
  productName: string;
  variantId?: string | null;
  isOutOfStock: boolean;
}

export function BackInStockAlert({
  productId,
  productName,
  variantId,
  isOutOfStock,
}: BackInStockAlertProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: existingAlert } = useQuery({
    queryKey: ['stock-alert', user?.id, productId, variantId || 'product'],
    queryFn: async () => {
      if (!user) return null;

      let query = (supabase as any)
        .from('stock_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId);

      query = variantId
        ? query.eq('product_variant_id', variantId)
        : query.is('product_variant_id', null);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOutOfStock,
  });

  const toggleAlert = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Please sign in to save stock alerts.');
      }

      if (existingAlert) {
        const { error } = await (supabase as any)
          .from('stock_alerts')
          .delete()
          .eq('id', existingAlert.id);

        if (error) throw error;
        return 'removed';
      }

      const { error } = await (supabase as any)
        .from('stock_alerts')
        .insert({
          user_id: user.id,
          product_id: productId,
          product_variant_id: variantId || null,
        });

      if (error) throw error;
      return 'created';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['stock-alert', user?.id, productId, variantId || 'product'],
      });
      toast.success(
        result === 'created'
          ? `${productName} has been added to your restock alerts.`
          : 'Restock alert removed.',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update restock alert.');
    },
  });

  if (!isOutOfStock) {
    return null;
  }

  return (
    <Button
      variant={existingAlert ? 'default' : 'outline'}
      size="sm"
      onClick={() => toggleAlert.mutate()}
      disabled={toggleAlert.isPending}
    >
      {toggleAlert.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <BellRing className="h-4 w-4 mr-1" />
          {existingAlert ? 'Alert Saved' : 'Notify Me When Restocked'}
        </>
      )}
    </Button>
  );
}
