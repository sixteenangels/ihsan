import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  productId: string;
}

export function PriceDropAlert({ productId }: Props) {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const queryClient = useQueryClient();

  const { data: alert } = useQuery({
    queryKey: ['price-drop-alert', productId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('price_drop_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const toggleAlert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not logged in');
      if (alert) {
        const { error } = await supabase
          .from('price_drop_alerts')
          .delete()
          .eq('id', alert.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('price_drop_alerts')
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-drop-alert', productId] });
      toast.success(alert ? 'Price alert removed' : 'You\'ll be notified when the price drops!');
    },
    onError: () => toast.error('Failed to update alert'),
  });

  if (!user || !isEnabled('price_drop_alerts')) return null;

  return (
    <Button
      variant={alert ? 'default' : 'outline'}
      size="sm"
      onClick={() => toggleAlert.mutate()}
      disabled={toggleAlert.isPending}
    >
      {toggleAlert.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : alert ? (
        <>
          <BellOff className="h-4 w-4 mr-1" />
          Remove Alert
        </>
      ) : (
        <>
          <Bell className="h-4 w-4 mr-1" />
          Alert on Price Drop
        </>
      )}
    </Button>
  );
}
