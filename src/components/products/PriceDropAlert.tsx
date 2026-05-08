import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  productId: string;
  productName?: string;
  currentPrice?: number;
}

interface PriceDropAlertRecord {
  id: string;
  product_id: string | null;
  target_price: number | null;
}

export function PriceDropAlert({ productId, productName, currentPrice }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { isEnabled } = useFeatureFlags();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');

  const { data: alert } = useQuery({
    queryKey: ['price-drop-alert', productId, user?.id],
    queryFn: async (): Promise<PriceDropAlertRecord | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('price_drop_alerts')
        .select('id, product_id, target_price')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    setTargetPrice(alert?.target_price != null ? String(alert.target_price) : '');
  }, [alert]);

  const saveAlertMutation = useMutation({
    mutationFn: async (nextTargetPrice: number | null) => {
      if (!user) {
        throw new Error('Sign in to save price alerts.');
      }

      if (alert) {
        const payload: TablesUpdate<'price_drop_alerts'> = {
          target_price: nextTargetPrice,
        };

        const { error } = await supabase
          .from('price_drop_alerts')
          .update(payload)
          .eq('id', alert.id)
          .eq('user_id', user.id);

        if (error) throw error;
        return 'updated';
      }

      const payload: TablesInsert<'price_drop_alerts'> = {
        user_id: user.id,
        product_id: productId,
        target_price: nextTargetPrice,
      };

      const { error } = await supabase.from('price_drop_alerts').insert(payload);
      if (error) throw error;
      return 'created';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['price-drop-alert', productId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['price-drop-alerts', user?.id] });
      setIsDialogOpen(false);
      toast.success(
        result === 'created'
          ? 'Price alert saved.'
          : 'Price alert updated.',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save price alert.');
    },
  });

  const removeAlertMutation = useMutation({
    mutationFn: async () => {
      if (!user || !alert) {
        throw new Error('No price alert to remove.');
      }

      const { error } = await supabase
        .from('price_drop_alerts')
        .delete()
        .eq('id', alert.id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-drop-alert', productId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['price-drop-alerts', user?.id] });
      setIsDialogOpen(false);
      setTargetPrice('');
      toast.success('Price alert removed.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove price alert.');
    },
  });

  if (!isEnabled('price_drop_alerts')) return null;

  const handleOpen = () => {
    if (!user) {
      toast.info('Sign in to save price alerts.');
      navigate('/auth');
      return;
    }

    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const trimmed = targetPrice.trim();
    const nextTargetPrice = trimmed === '' ? null : Number(trimmed);

    if (trimmed !== '' && (!Number.isFinite(nextTargetPrice) || nextTargetPrice <= 0)) {
      toast.error('Enter a valid target price or leave it blank for any drop.');
      return;
    }

    if (alert && alert.target_price === nextTargetPrice) {
      toast.info('No changes to save.');
      return;
    }

    saveAlertMutation.mutate(nextTargetPrice);
  };

  const productLabel = productName || 'this product';
  const currentPriceLabel = typeof currentPrice === 'number' ? formatPrice(currentPrice) : null;

  return (
    <>
      <Button
        variant={alert ? 'default' : 'outline'}
        size="sm"
        onClick={handleOpen}
        disabled={saveAlertMutation.isPending || removeAlertMutation.isPending}
      >
        {saveAlertMutation.isPending || removeAlertMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : alert ? (
          <>
            <BellOff className="mr-1 h-4 w-4" />
            Manage Price Alert
          </>
        ) : (
          <>
            <Bell className="mr-1 h-4 w-4" />
            Alert on Price Drop
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{alert ? 'Manage price alert' : 'Create price alert'}</DialogTitle>
            <DialogDescription>
              {currentPriceLabel
                ? `${productLabel} is currently ${currentPriceLabel}. Leave the target blank to be notified about any drop.`
                : `Leave the target blank to be notified about any price drop for ${productLabel}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="target-price">Target price</Label>
            <Input
              id="target-price"
              type="number"
              min="0"
              step="0.01"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
              placeholder="Any drop"
            />
          </div>

          <DialogFooter>
            {alert && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => removeAlertMutation.mutate()}
                disabled={saveAlertMutation.isPending || removeAlertMutation.isPending}
              >
                Remove Alert
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saveAlertMutation.isPending || removeAlertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveAlertMutation.isPending || removeAlertMutation.isPending}
            >
              {alert ? 'Save Changes' : 'Save Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
