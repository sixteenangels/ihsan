import { useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { loadPaystack, type PaystackTransactionResponse } from '@/lib/paystack';
import { getSupabaseFunctionErrorMessage } from '@/lib/errors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PayDeferredShippingButtonProps {
  orderId: string;
  orderNumber: string;
  amount: number;
  formatPrice: (amount: number) => string;
  onPaid?: () => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function PayDeferredShippingButton({
  orderId,
  orderNumber,
  amount,
  formatPrice,
  onPaid,
  className,
  size = 'sm',
}: PayDeferredShippingButtonProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayShipping = async () => {
    if (!user?.email) {
      toast.error('Sign in to pay shipping fees.');
      return;
    }

    if (amount <= 0) {
      toast.error('Shipping fee is not ready yet.');
      return;
    }

    setIsProcessing(true);

    try {
      const paystack = await loadPaystack();
      const { data: configData, error: configError } = await supabase.functions.invoke('get-paystack-key');

      if (configError || !configData?.publicKey) {
        throw new Error('Unable to connect to payment service.');
      }

      const reference = `shipping_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      await new Promise<void>((resolve, reject) => {
        const handler = paystack.setup({
          key: configData.publicKey,
          email: user.email!,
          amount: Math.round(amount * 100),
          currency: 'GHS',
          ref: reference,
          metadata: {
            type: 'deferred_shipping',
            user_id: user.id,
            order_id: orderId,
          },
          callback(response: PaystackTransactionResponse) {
            supabase.functions
              .invoke('pay-deferred-shipping', {
                body: {
                  orderId,
                  paymentReference: response.reference,
                  expectedAmount: amount,
                },
              })
              .then(({ data, error }) => {
                if (error) {
                  reject(new Error(getSupabaseFunctionErrorMessage(error, 'Shipping payment failed.')));
                  return;
                }

                if ((data as { error?: string } | null)?.error) {
                  reject(new Error((data as { error: string }).error));
                  return;
                }

                toast.success(`Shipping paid for order ${orderNumber}.`);
                onPaid?.();
                resolve();
              })
              .catch(reject);
          },
          onClose() {
            reject(new Error('Payment cancelled.'));
          },
        });

        handler.openIframe();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shipping payment failed.';
      if (message !== 'Payment cancelled.') {
        toast.error(message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={handlePayShipping}
      disabled={isProcessing}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Truck className="h-4 w-4" />
      )}
      Pay shipping {formatPrice(amount)}
    </Button>
  );
}
