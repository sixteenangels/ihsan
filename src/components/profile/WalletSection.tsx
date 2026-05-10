import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { useWalletTransactions, useWalletBalance } from '@/hooks/useWallet';
import { useCurrency } from '@/hooks/useCurrency';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RpcError = {
  message: string;
};

type RedeemGiftCardResult = {
  amount: number | string | null;
} | null;

type RedeemGiftCardRpc = (
  fn: 'redeem_gift_card',
  args: { input_code: string }
) => Promise<{
  data: RedeemGiftCardResult;
  error: RpcError | null;
}>;

export function WalletSection() {
  const queryClient = useQueryClient();
  const { data: txs, isLoading } = useWalletTransactions();
  const balance = useWalletBalance();
  const { formatPrice } = useCurrency();
  const [giftCardCode, setGiftCardCode] = useState('');

  const redeemGiftCardMutation = useMutation({
    mutationFn: async () => {
      const trimmedCode = giftCardCode.trim().toUpperCase();
      if (!trimmedCode) {
        throw new Error('Enter a gift card code.');
      }

      const redeemGiftCard = supabase.rpc.bind(supabase) as unknown as RedeemGiftCardRpc;
      const { data, error } = await redeemGiftCard('redeem_gift_card', {
        input_code: trimmedCode,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      toast.success(`Gift card redeemed. ${formatPrice(Number(data?.amount || 0))} added to your wallet.`);
      setGiftCardCode('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          My Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="text-3xl font-bold text-primary">{formatPrice(balance)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Store credit. Use at checkout. Cannot be withdrawn.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Redeem Gift Card</h4>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter gift card code"
              value={giftCardCode}
              onChange={(event) => setGiftCardCode(event.target.value.toUpperCase())}
            />
            <Button
              onClick={() => redeemGiftCardMutation.mutate()}
              disabled={redeemGiftCardMutation.isPending || !giftCardCode.trim()}
            >
              {redeemGiftCardMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {redeemGiftCardMutation.isPending ? 'Redeeming' : 'Redeem'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Redeemed gift cards are converted into wallet credit you can use at checkout.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">History</h4>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          ) : (txs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(txs || []).map((t) => (
                <div key={t.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  {t.type === 'credit' ? (
                    <ArrowDownCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Badge variant={t.type === 'credit' ? 'default' : 'destructive'}>
                        {t.type === 'credit' ? '+' : '-'}
                        {formatPrice(Number(t.amount))}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1">{t.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
